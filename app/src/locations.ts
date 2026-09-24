/**
 * THE CHANGE LOCATION SETUP (canon 0.30.40). Owner, 2026-09-11, verbatim in
 * the canon row: "Create the "Change Location" setup": a plants/packages
 * toggle, a farm, a license, the package (or plant) to move, to/from, the seed
 * locations (field locations for plants per farm from his METRC exports plus
 * Barn; inventory locations for packages per farm, the processor's rooms,
 * racks and stations under its own license), an Execute button, a warning,
 * and: "All movements are within the license itself, so the CSV is for a
 * location change, not a transfer manifest."
 *
 * THE MOVE LAW: a move never leaves its license. Execute records the move in
 * location_changes (one group per Execute), writes the new location onto the
 * ledger item and onto the METRC mirror row (the crew's move is the truth on
 * the ground; the next METRC drop re-asserts the state's, so a file left
 * unuploaded shows up as a difference), and pends the METRC Location Change
 * file on /admin/uploads, the one export home. Packages print the METRC tag
 * when the ledger holds one and the internal code otherwise; plants print
 * their tag. The location printed is the location's label, METRC's own word.
 */

import { HttpError, nowIso, textOrNull } from "./audit";
import {
  FLOOR_SITE_ORDER,
  isKnownSiteLicense,
  LICENSE_AU_PROCESSOR,
  LOC_IN_TRANSIT,
  metrcFacingTag,
  metrcLocationName,
  isMetrcTag,
  SITE_LICENSES,
  SYSTEM_REASON,
  type FloorSite,
} from "./config";
import { csvCell } from "./csv";
import { insertLog, listLookupValues, logsForInsert, requireActor, type LookupOption } from "./db";
import { locationChangeCsv } from "./interco";
import type { ActionOk } from "./actions";

export type LocationKind = "plants" | "packages";

export const LOCATION_KINDS: readonly LocationKind[] = ["plants", "packages"];

export function parseLocationKind(value: string | null | undefined): LocationKind {
  return value === "plants" ? "plants" : "packages";
}

export function parseFarm(value: string | null | undefined): FloorSite | null {
  const v = String(value ?? "").trim().toUpperCase();
  return (FLOOR_SITE_ORDER as readonly string[]).includes(v) ? (v as FloorSite) : null;
}

/** The licenses a move may happen under at a farm: every site line for
 * packages; plants never live under the processor. */
export function licensesForChange(farm: FloorSite, kind: LocationKind): readonly string[] {
  const all = SITE_LICENSES[farm];
  return kind === "plants" ? all.filter((l) => l !== LICENSE_AU_PROCESSOR) : all;
}

/** A location offers itself to a farm and license when its farm matches and
 * its license scope is blank (every license at the farm) or that license. */
export function locationOptionsFor(
  options: readonly LookupOption[],
  farm: FloorSite,
  license: string
): LookupOption[] {
  return options.filter((o) => {
    if ((o.farm_code ?? "") !== farm) return false;
    const scope = String(o.license_value ?? "").trim();
    return !scope || scope === license;
  });
}

export const LOCATION_CATEGORY: Record<LocationKind, "field_location" | "inventory_location"> = {
  plants: "field_location",
  packages: "inventory_location",
};

/** The destinations for a kind at a farm and license: the seeded lookup rows,
 * plus (plants) any location the METRC mirror knows for that license that the
 * seed does not, so a row METRC added since the seed is still reachable. */
export async function listDestinationOptions(
  db: D1Database,
  kind: LocationKind,
  farm: FloorSite,
  license: string
): Promise<LookupOption[]> {
  const seeded = locationOptionsFor(await listLookupValues(db, LOCATION_CATEGORY[kind]), farm, license);
  if (kind !== "plants") return seeded;
  const known = new Set(seeded.map((o) => o.label));
  const mirror = await db
    .prepare(
      `SELECT DISTINCT location FROM metrc_plants
       WHERE license_value = ? AND gone_at IS NULL AND location IS NOT NULL AND location <> ''
       ORDER BY location`
    )
    .bind(license)
    .all<{ location: string }>();
  const extra = (mirror.results ?? [])
    .map((r) => String(r.location))
    .filter((loc) => !known.has(loc))
    .map((loc) => ({ value: loc, label: loc, farm_code: farm, license_value: license, tone: "metrc" }));
  return [...seeded, ...extra];
}

/* ------------------------------------------------------------ the picks */

export type PackagePick = {
  source: "ledger" | "mirror";
  item_id: string | null;
  tag: string | null;
  package_code: string | null;
  label: string;
  location: string | null;
  strain: string | null;
  item: string | null;
  qty: number | null;
  uom: string | null;
};

export type LedgerPackageRow = {
  id: string;
  package_code: string;
  metrc_tag: string | null;
  item_kind: string;
  qty: number;
  uom: string;
  location: string;
  strain_name: string | null;
};

/** The ledger's packages under a license, off the road. */
export async function listLedgerPackagesForLicense(db: D1Database, license: string): Promise<LedgerPackageRow[]> {
  const result = await db
    .prepare(
      `SELECT i.id, i.package_code, i.metrc_tag, i.item_kind, i.qty, i.uom, i.location,
              COALESCE(hb.market_strain, s.name) AS strain_name
       FROM local_inventory_items i
       LEFT JOIN strains s ON s.id = i.strain_id
       LEFT JOIN harvest_batches hb ON hb.id = i.harvest_batch_id
       WHERE i.deleted_at IS NULL AND i.license_value = ? AND i.location <> ?
       ORDER BY i.location, i.package_code`
    )
    .bind(license, LOC_IN_TRANSIT)
    .all<LedgerPackageRow>();
  return result.results ?? [];
}

function pickFromLedger(row: LedgerPackageRow): PackagePick {
  return {
    source: "ledger",
    item_id: row.id,
    tag: isMetrcTag(row.metrc_tag) ? String(row.metrc_tag).toUpperCase() : null,
    package_code: row.package_code,
    label: metrcFacingTag(row),
    location: row.location,
    strain: row.strain_name,
    item: row.item_kind,
    qty: Number(row.qty),
    uom: row.uom,
  };
}

/** A typed or scanned pick resolves in order: the ledger's METRC tag, the
 * ledger's internal code, then the METRC mirror's tag, all under the license. */
export async function resolvePackagePick(db: D1Database, license: string, pickRaw: string): Promise<PackagePick | null> {
  const pick = String(pickRaw ?? "").trim();
  if (!pick) return null;
  const upper = pick.toUpperCase();
  const ledger = await db
    .prepare(
      `SELECT i.id, i.package_code, i.metrc_tag, i.item_kind, i.qty, i.uom, i.location,
              COALESCE(hb.market_strain, s.name) AS strain_name
       FROM local_inventory_items i
       LEFT JOIN strains s ON s.id = i.strain_id
       LEFT JOIN harvest_batches hb ON hb.id = i.harvest_batch_id
       WHERE i.deleted_at IS NULL AND i.license_value = ?
         AND (UPPER(TRIM(i.metrc_tag)) = ? OR i.package_code = ? OR i.id = ?)
       ORDER BY CASE WHEN UPPER(TRIM(i.metrc_tag)) = ? THEN 0 ELSE 1 END, i.created_at DESC
       LIMIT 1`
    )
    .bind(license, upper, pick, pick, upper)
    .first<LedgerPackageRow>();
  if (ledger) return pickFromLedger(ledger);
  const mirror = await db
    .prepare(
      `SELECT tag, location, item, item_strain, quantity, uom FROM metrc_packages
       WHERE tag = ? AND license_value = ? AND gone_at IS NULL`
    )
    .bind(upper, license)
    .first<{ tag: string; location: string | null; item: string | null; item_strain: string | null; quantity: number | null; uom: string | null }>();
  if (!mirror) return null;
  return {
    source: "mirror",
    item_id: null,
    tag: mirror.tag,
    package_code: null,
    label: mirror.tag,
    location: mirror.location,
    strain: mirror.item_strain,
    item: mirror.item,
    qty: mirror.quantity == null ? null : Number(mirror.quantity),
    uom: mirror.uom,
  };
}

export type PlantLocationCount = { location: string; n: number; strains: number };

/** Where the mirror's plants stand under a license, with counts. */
export async function listPlantLocationsForLicense(db: D1Database, license: string): Promise<PlantLocationCount[]> {
  const result = await db
    .prepare(
      `SELECT COALESCE(location, '') AS location, COUNT(*) AS n, COUNT(DISTINCT strain) AS strains
       FROM metrc_plants WHERE license_value = ? AND gone_at IS NULL
       GROUP BY COALESCE(location, '') ORDER BY location`
    )
    .bind(license)
    .all<PlantLocationCount>();
  return result.results ?? [];
}

export type PlantRow = { tag: string; strain: string | null; location: string | null; phase: string };

export async function listPlantsAt(db: D1Database, license: string, location: string): Promise<PlantRow[]> {
  const result = await db
    .prepare(
      `SELECT tag, strain, location, phase FROM metrc_plants
       WHERE license_value = ? AND gone_at IS NULL AND COALESCE(location, '') = ?
       ORDER BY tag`
    )
    .bind(license, location)
    .all<PlantRow>();
  return result.results ?? [];
}

export async function findPlant(db: D1Database, license: string, tagRaw: string): Promise<PlantRow | null> {
  const tag = String(tagRaw ?? "").trim().toUpperCase();
  if (!tag) return null;
  return db
    .prepare(`SELECT tag, strain, location, phase FROM metrc_plants WHERE tag = ? AND license_value = ? AND gone_at IS NULL`)
    .bind(tag, license)
    .first<PlantRow>();
}

/* ---------------------------------------------------------- the execute */

export type LocationChangeRow = {
  id: string;
  group_id: string;
  kind: LocationKind;
  farm_code: string;
  license_value: string;
  tag: string | null;
  item_id: string | null;
  label: string;
  from_location: string | null;
  to_location: string;
  move_date: string;
  created_at: string;
};

const D1_MAX_PARAMS = 100;

function chunk<T>(rows: T[], per: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < rows.length; i += per) out.push(rows.slice(i, i + per));
  return out;
}

function today(): string {
  return nowIso().slice(0, 10);
}

export function normalizeMoveDate(raw: string | null | undefined): string {
  const s = String(raw ?? "").trim();
  if (!s) return today();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) throw new HttpError(400, "The move date must be YYYY-MM-DD.");
  return s;
}

/** Execute. Validates farm, license, kind and destination against the seeded
 * locations (plants may also land on a location the METRC mirror knows),
 * then writes the move everywhere it belongs in one batch. */
export async function changeLocation(db: D1Database, form: FormData): Promise<ActionOk> {
  const actor = await requireActor(db, String(form.get("person_id") ?? "").trim() || null);
  const kind = parseLocationKind(textOrNull(form.get("kind")));
  const farm = parseFarm(textOrNull(form.get("farm_code")));
  if (!farm) throw new HttpError(400, "Pick a farm.");
  const license = String(textOrNull(form.get("license_value")) ?? "").trim();
  if (!license || !isKnownSiteLicense(license) || !licensesForChange(farm, kind).includes(license)) {
    throw new HttpError(400, "Pick one of the farm's licenses for this kind.");
  }
  const toValue = String(textOrNull(form.get("to_location")) ?? "").trim();
  if (!toValue) throw new HttpError(400, "Pick where it goes.");
  const destinations = await listDestinationOptions(db, kind, farm, license);
  const dest = destinations.find((o) => o.value === toValue);
  if (!dest) throw new HttpError(400, "That location is not one of this license's locations; add it in Admin, Data Lookups first.");
  const moveDate = normalizeMoveDate(textOrNull(form.get("move_date")));
  const ts = nowIso();
  const groupId = crypto.randomUUID();
  const stmts: D1PreparedStatement[] = [];
  const rows: LocationChangeRow[] = [];
  const toLabel = dest.label;

  if (kind === "packages") {
    const pick = String(textOrNull(form.get("pick")) ?? "").trim();
    if (!pick) throw new HttpError(400, "Type or scan the package to move.");
    const found = await resolvePackagePick(db, license, pick);
    if (!found) throw new HttpError(404, "No package by that tag or code under this license.");
    const fromLabel = found.location ?? null;
    if (found.source === "ledger" && found.location === dest.value) {
      throw new HttpError(400, "That package is already there.");
    }
    if (found.source === "mirror" && (found.location ?? "") === toLabel) {
      throw new HttpError(400, "That package is already there.");
    }
    rows.push({
      id: crypto.randomUUID(),
      group_id: groupId,
      kind,
      farm_code: farm,
      license_value: license,
      tag: found.tag,
      item_id: found.item_id,
      label: found.label,
      from_location: fromLabel,
      to_location: toLabel,
      move_date: moveDate,
      created_at: ts,
    });
    if (found.item_id) {
      // The ledger stores the location's value (BARN, Trim Room 1); METRC's
      // word is the label and rides the file.
      stmts.push(
        db
          .prepare(
            `UPDATE local_inventory_items SET location = ?, updated_at = ?, updated_by = ?
             WHERE id = ? AND deleted_at IS NULL`
          )
          .bind(dest.value, ts, actor.id, found.item_id),
        insertLog(db, {
          record_table: "local_inventory_items",
          record_id: found.item_id,
          field: "location",
          old_value: found.location,
          new_value: dest.value,
          actor_person_id: actor.id,
          reason: SYSTEM_REASON.location_changed,
          changed_at: ts,
        })
      );
    }
    if (found.tag) {
      stmts.push(
        db
          .prepare(`UPDATE metrc_packages SET location = ?, changed_at = ? WHERE tag = ? AND license_value = ?`)
          .bind(toLabel, ts, found.tag, license)
      );
    }
  } else {
    const pick = String(textOrNull(form.get("pick")) ?? "").trim();
    const fromLocation = String(textOrNull(form.get("from_location")) ?? "").trim();
    let plants: PlantRow[];
    if (pick) {
      const one = await findPlant(db, license, pick);
      if (!one) throw new HttpError(404, "No plant by that tag under this license; mount the license's plants export first.");
      plants = [one];
    } else if (fromLocation) {
      plants = await listPlantsAt(db, license, fromLocation);
      if (plants.length === 0) throw new HttpError(404, "No plants stand at that location under this license.");
    } else {
      throw new HttpError(400, "Type or scan a plant tag, or pick the location the plants leave.");
    }
    if (plants.every((p) => (p.location ?? "") === toLabel)) {
      throw new HttpError(400, "Those plants are already there.");
    }
    for (const p of plants) {
      rows.push({
        id: crypto.randomUUID(),
        group_id: groupId,
        kind,
        farm_code: farm,
        license_value: license,
        tag: p.tag,
        item_id: null,
        label: p.tag,
        from_location: p.location,
        to_location: toLabel,
        move_date: moveDate,
        created_at: ts,
      });
    }
    // The mirror rows take the new location in chunks under D1's parameter cap.
    for (const part of chunk(plants.map((p) => p.tag), D1_MAX_PARAMS - 3)) {
      const marks = part.map(() => "?").join(", ");
      stmts.push(
        db
          .prepare(`UPDATE metrc_plants SET location = ?, changed_at = ? WHERE license_value = ? AND tag IN (${marks})`)
          .bind(toLabel, ts, license, ...part)
      );
    }
  }

  // The move rows, multi-row inserts under the cap (13 columns a row).
  const cols = [
    "id", "group_id", "kind", "farm_code", "license_value", "tag", "item_id", "label",
    "from_location", "to_location", "move_date", "created_at", "created_by", "updated_at", "updated_by",
  ];
  const per = Math.max(1, Math.floor(D1_MAX_PARAMS / cols.length));
  for (const part of chunk(rows, per)) {
    const marks = part.map(() => `(${cols.map(() => "?").join(", ")})`).join(", ");
    const values: unknown[] = [];
    for (const r of part) {
      values.push(
        r.id, r.group_id, r.kind, r.farm_code, r.license_value, r.tag, r.item_id, r.label,
        r.from_location, r.to_location, r.move_date, ts, actor.id, ts, actor.id
      );
    }
    stmts.push(db.prepare(`INSERT INTO location_changes (${cols.join(", ")}) VALUES ${marks}`).bind(...values));
  }
  // One log row per Execute, on the group (a bulk plant move is one act).
  stmts.push(
    ...logsForInsert(
      db,
      "location_changes",
      groupId,
      {
        group_id: groupId,
        kind,
        farm_code: farm,
        license_value: license,
        to_location: toLabel,
        moved: rows.length,
        move_date: moveDate,
        created_at: ts,
        created_by: actor.id,
      },
      actor.id,
      SYSTEM_REASON.location_changed,
      ts
    )
  );
  for (const part of chunk(stmts, 400)) await db.batch(part);
  const q = new URLSearchParams({
    kind,
    farm: farm,
    license,
    ok: "moved",
    n: String(rows.length),
    to: toLabel,
    group: groupId,
  });
  return { redirect: `/inventory/change-locations?${q.toString()}` };
}

/* ------------------------------------------------------------ the files */

/** PROVISIONAL, like the package header of canon 0.30.6: METRC's plants
 * location-change shape as the Scribe knows it; the owner owes the real
 * templates and the shape swaps in one edit. */
export const PLANT_LOCATION_CHANGE_CSV_HEADER = "Plant,Location,Sublocation,ChangeDate";

export function plantLocationChangeCsv(rows: ReadonlyArray<{ tag: string; location: string; changeDate: string }>): string {
  // THE LOCATION WITHOUT THE FARM (canon 0.30.82): METRC gets the location without our site prefix.
  const body = rows.map((r) => [r.tag, metrcLocationName(r.location), "", r.changeDate].map(csvCell).join(","));
  return PLANT_LOCATION_CHANGE_CSV_HEADER + "\r\n" + (body.length ? body.join("\r\n") + "\r\n" : "");
}

export type PendingLocationMoveRow = {
  group_id: string;
  kind: LocationKind;
  farm_code: string;
  license_value: string;
  moved: number;
  from_summary: string;
  to_location: string;
  move_date: string;
  newest_activity: string;
  /** Packages in the group whose label is an internal code, not a METRC tag. */
  untagged: number;
};

/** The export home's rows: one per Execute without its mark. */
export async function listPendingLocationMoves(db: D1Database): Promise<PendingLocationMoveRow[]> {
  const result = await db
    .prepare(
      `SELECT c.group_id, c.kind, c.farm_code, c.license_value, COUNT(*) AS moved,
              MIN(COALESCE(c.from_location, '')) AS from_min, MAX(COALESCE(c.from_location, '')) AS from_max,
              MAX(c.to_location) AS to_location, MAX(c.move_date) AS move_date, MAX(c.created_at) AS newest_activity,
              SUM(CASE WHEN c.tag IS NULL OR c.tag = '' THEN 1 ELSE 0 END) AS untagged
       FROM location_changes c
       WHERE c.deleted_at IS NULL
         AND NOT EXISTS (
           SELECT 1 FROM metrc_uploads u
           WHERE u.ref_id = c.group_id AND u.deleted_at IS NULL AND u.kind = 'location_move'
         )
       GROUP BY c.group_id, c.kind, c.farm_code, c.license_value
       ORDER BY MAX(c.created_at) DESC`
    )
    .all<{
      group_id: string;
      kind: LocationKind;
      farm_code: string;
      license_value: string;
      moved: number;
      from_min: string;
      from_max: string;
      to_location: string;
      move_date: string;
      newest_activity: string;
      untagged: number;
    }>();
  return (result.results ?? []).map((r) => ({
    group_id: r.group_id,
    kind: r.kind,
    farm_code: r.farm_code,
    license_value: r.license_value,
    moved: Number(r.moved),
    from_summary: r.from_min === r.from_max ? r.from_min : "several",
    to_location: r.to_location,
    move_date: r.move_date,
    newest_activity: r.newest_activity,
    untagged: Number(r.untagged),
  }));
}

export async function listLocationMoveRows(db: D1Database, groupId: string): Promise<LocationChangeRow[]> {
  const result = await db
    .prepare(
      `SELECT id, group_id, kind, farm_code, license_value, tag, item_id, label, from_location, to_location, move_date, created_at
       FROM location_changes WHERE group_id = ? AND deleted_at IS NULL ORDER BY label`
    )
    .bind(groupId)
    .all<LocationChangeRow>();
  return result.results ?? [];
}

export function locationMoveFilename(kind: LocationKind, license: string, moveDate: string, groupId: string): string {
  return `location_change_${kind}_${license.replace(/[^A-Za-z0-9]+/g, "")}_${moveDate.replaceAll("-", "")}_${groupId.slice(0, 8)}.csv`;
}

/** The METRC Location Change file for one Execute: packages in the package
 * shape (Label = the METRC tag or the internal code), plants in the plants
 * shape (Plant = the tag). */
export async function locationMoveCsv(
  db: D1Database,
  groupId: string
): Promise<{ body: string; filename: string; kind: LocationKind; license: string }> {
  const rows = await listLocationMoveRows(db, groupId);
  if (rows.length === 0) throw new HttpError(404, "Unknown location change.");
  const kind = rows[0].kind;
  const license = rows[0].license_value;
  const moveDate = rows[0].move_date;
  const body =
    kind === "plants"
      ? plantLocationChangeCsv(rows.map((r) => ({ tag: r.label, location: r.to_location, changeDate: r.move_date })))
      : locationChangeCsv(rows.map((r) => ({ label: r.label, location: r.to_location, moveDate: r.move_date })));
  return { body, filename: locationMoveFilename(kind, license, moveDate, groupId), kind, license };
}

/** Marking the file uploaded stamps metrc_uploads (kind location_move, ref_id
 * the group), which clears the row from the one export home. */
export async function markLocationMoveUploaded(db: D1Database, groupId: string, form: FormData): Promise<ActionOk> {
  const actor = await requireActor(db, String(form.get("person_id") ?? "").trim() || null);
  const built = await locationMoveCsv(db, groupId);
  const id = crypto.randomUUID();
  const ts = nowIso();
  const record = {
    id,
    kind: "location_move",
    harvest_batch_id: groupId,
    filename: built.filename,
    uploaded_at: ts,
    ref_id: groupId,
    created_at: ts,
    created_by: actor.id,
    updated_at: ts,
    updated_by: actor.id,
  };
  await db.batch([
    db
      .prepare(
        `INSERT INTO metrc_uploads (
          id, kind, harvest_batch_id, filename, uploaded_at, ref_id,
          created_at, created_by, updated_at, updated_by, deleted_at, deleted_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL)`
      )
      .bind(id, "location_move", groupId, built.filename, ts, groupId, ts, actor.id, ts, actor.id),
    ...logsForInsert(db, "metrc_uploads", id, record, actor.id, SYSTEM_REASON.upload_marked, ts),
  ]);
  return { redirect: "/admin/uploads?ok=upload_marked" };
}

/** Recent Executes for the page's own list, newest first. */
export async function listRecentLocationMoves(db: D1Database, limit = 20): Promise<PendingLocationMoveRow[]> {
  const result = await db
    .prepare(
      `SELECT c.group_id, c.kind, c.farm_code, c.license_value, COUNT(*) AS moved,
              MIN(COALESCE(c.from_location, '')) AS from_min, MAX(COALESCE(c.from_location, '')) AS from_max,
              MAX(c.to_location) AS to_location, MAX(c.move_date) AS move_date, MAX(c.created_at) AS newest_activity,
              SUM(CASE WHEN c.tag IS NULL OR c.tag = '' THEN 1 ELSE 0 END) AS untagged
       FROM location_changes c
       WHERE c.deleted_at IS NULL
       GROUP BY c.group_id, c.kind, c.farm_code, c.license_value
       ORDER BY MAX(c.created_at) DESC LIMIT ?`
    )
    .bind(limit)
    .all<{
      group_id: string;
      kind: LocationKind;
      farm_code: string;
      license_value: string;
      moved: number;
      from_min: string;
      from_max: string;
      to_location: string;
      move_date: string;
      newest_activity: string;
      untagged: number;
    }>();
  return (result.results ?? []).map((r) => ({
    group_id: r.group_id,
    kind: r.kind,
    farm_code: r.farm_code,
    license_value: r.license_value,
    moved: Number(r.moved),
    from_summary: r.from_min === r.from_max ? r.from_min : "several",
    to_location: r.to_location,
    move_date: r.move_date,
    newest_activity: r.newest_activity,
    untagged: Number(r.untagged),
  }));
}
