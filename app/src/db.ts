import { HttpError, nowIso } from "./audit";
import { FARM_DAY_START_HOUR_DEFAULT, farmDay, parseFarmDayStartHour } from "./farmday";
import {
  CONFIG_KEYS,
  ITEM_KIND_WET,
  ITEM_KIND_WET_TOTAL,
  LOC_IN_TRANSIT,
  LOT_STATUS,
  SITE_OF_LOCATION,
  barnLocationForSite,
  formatGrams,
  isMetrcTag,
  isPrepackWpr,
  metrcFacingTag,
  farmHarvestSql,
  parseCryoCategories,
  parseCryoTypeCategories,
  parseExtractionCodes,
  projectedDryYieldPct,
  roundGrams,
  INTERNAL_LOGISTICS_STAGE,
  SCHEDULE_STAGES,
  SCHEDULE_STATUS,
  NON_TRIM_SOURCE_SQL,
  WIP_SOURCE,
  WIP_STATUS,
  type ScheduleStage,
} from "./config";
import type { WetWeightsCsvRow } from "./csv";
import type {
  DrySpaceRow,
  DryingLotRow,
  InventorySheet,
  OutcomeRow,
  RecallableBatch,
  SheetPkgRow,
  UnloadedLotRow,
} from "./inventory";
import { buildInventorySheet } from "./inventory";
import type { MetrcFgInventory } from "./metrc";
import { itemKindOrderSql } from "./ledger";
import { formatLotToken } from "./mint";
import type { LedgerDef, LookupName, QueueDef } from "./pipeline";

export type PersonRow = {
  id: string;
  display_name: string;
  is_active: number;
  /** Canon 0.30.67: the login email when the row is a login identity (owner: "make all Supervisors the email"). */
  email?: string | null;
};

/** Canon 0.30.40: license_value scopes a location to one license line; null
 * means every license at its farm. */
export type LookupOption = {
  value: string;
  label: string;
  tone?: string | null;
  farm_code?: string | null;
  license_value?: string | null;
};

export type QueueRow = {
  id: string;
  values: Record<string, string>;
};

export async function listPeople(db: D1Database, activeOnly: boolean): Promise<PersonRow[]> {
  const sql = activeOnly
    ? `SELECT id, display_name, is_active, email FROM people WHERE deleted_at IS NULL AND is_active = 1 ORDER BY display_name`
    : `SELECT id, display_name, is_active, email FROM people WHERE deleted_at IS NULL ORDER BY display_name`;
  const result = await db.prepare(sql).all<PersonRow>();
  return result.results ?? [];
}

export async function getPerson(db: D1Database, id: string): Promise<PersonRow | null> {
  return db
    .prepare(
      `SELECT id, display_name, is_active FROM people WHERE id = ? AND deleted_at IS NULL`
    )
    .bind(id)
    .first<PersonRow>();
}

export async function requireActor(db: D1Database, personId: string | null): Promise<PersonRow> {
  if (!personId) throw new HttpError(400, "Select a person.");
  const person = await getPerson(db, personId);
  if (!person || person.is_active !== 1) {
    throw new HttpError(400, "Select an active person.");
  }
  return person;
}

export async function listLookup(db: D1Database, name: LookupName): Promise<LookupOption[]> {
  switch (name) {
    case "farms":
      return mapLookup(
        await db
          .prepare(
            `SELECT code AS value, display_name AS label FROM farms WHERE deleted_at IS NULL ORDER BY code`
          )
          .all<LookupOption>()
      );
    case "grow_methods":
      return mapLookup(
        await db
          .prepare(
            `SELECT code AS value, display_name AS label FROM grow_methods WHERE deleted_at IS NULL ORDER BY code`
          )
          .all<LookupOption>()
      );
    case "strains":
      return mapLookup(
        await db
          .prepare(
            `SELECT id AS value, name || ' (' || hbn_code || ')' AS label FROM strains WHERE deleted_at IS NULL ORDER BY name`
          )
          .all<LookupOption>()
      );
    case "dry_spaces":
      return mapLookup(
        await db
          .prepare(
            `SELECT id AS value, name AS label FROM dry_spaces WHERE deleted_at IS NULL ORDER BY name`
          )
          .all<LookupOption>()
      );
    case "package_types":
      return mapLookup(
        await db
          .prepare(
            `SELECT code AS value, display_name AS label FROM package_types WHERE deleted_at IS NULL ORDER BY code`
          )
          .all<LookupOption>()
      );
    case "harvest_batches":
      // THE HBN THAT CAME BACK (canon 0.30.84; his pick "HBN pencil on the lot"):
      // the lot pencil's HBN options. Every batch not voided, open ones first and
      // newest first, labeled farm / strain / date with the HBN, a complete one
      // marked; the lot's current batch is always in the list, so a plain Save
      // never moves a lot by default.
      return mapLookup(
        await db
          .prepare(
            `SELECT b.id AS value,
                    COALESCE(b.farm_code, '') || ' / ' || COALESCE(s.name, '') || ' / ' || COALESCE(b.entry_date, '')
                      || ' (' || COALESCE(b.hbn, '') || ')'
                      || CASE WHEN b.status = 'open' THEN '' ELSE ' complete' END AS label
             FROM harvest_batches b
             LEFT JOIN strains s ON s.id = b.strain_id
             WHERE b.deleted_at IS NULL AND ${farmHarvestSql("b")}
             ORDER BY CASE WHEN b.status = 'open' THEN 0 ELSE 1 END, b.created_at DESC`
          )
          .all<LookupOption>()
      );
    case "people":
      return mapLookup(
        await db
          .prepare(
            `SELECT id AS value, display_name AS label FROM people WHERE deleted_at IS NULL AND is_active = 1 ORDER BY display_name`
          )
          .all<LookupOption>()
      );
    case "silo_number":
    case "inventory_location":
    case "field_location":
    case "license":
    case "item_kind":
    case "failure_mode":
    case "testing_lab":
    case "label_stock":
    case "label_printer":
    case "listing_category":
    case "sign_off_name":
      return listLookupValues(db, name);
  }
}

export async function listLookupValues(db: D1Database, category: string): Promise<LookupOption[]> {
  return mapLookup(
    await db
      .prepare(
        `SELECT value, label, tone, farm_code, license_value FROM lookup_values
         WHERE category = ? AND deleted_at IS NULL
         ORDER BY sort_order, value`
      )
      .bind(category)
      .all<LookupOption>()
  );
}

function mapLookup(result: D1Result<LookupOption>): LookupOption[] {
  return result.results ?? [];
}

export async function countQueue(db: D1Database, def: QueueDef): Promise<number> {
  const table = def.entity;
  // THE METRC-BORN HBN STAYS OUT OF THE HARVEST (canon 0.30.196): the HBN Queue counts the farm's batches.
  const born = table === "harvest_batches" ? ` AND ${farmHarvestSql(table)}` : "";
  const row = await db
    .prepare(
      `SELECT COUNT(*) AS n FROM ${table} WHERE deleted_at IS NULL AND status = ?${born}`
    )
    .bind(def.predicate.value)
    .first<{ n: number }>();
  return Number(row?.n ?? 0);
}

/** Pane-only hide (owner ruling 2026-08-28): a finished lot (non-voided) removes its batch
 * from the wet weight pane; a weighing lot keeps it visible for resume.
 * THE HBN THAT CAME BACK (canon 0.30.84; owner report 2026-09-15, verbatim in the canon
 * row): the finished statuses were spelled out as drying, in_transit and trimmed on
 * 2026-08-28, three days before the Unloaded Queue (status unloaded) existed, so Finish
 * unload brought yesterday's HBN back into the pane and a satellite crew weighed into it.
 * Finished now means every lot status but weighing, and both clauses of the ruling hold:
 * the batch hides when it has a finished lot and no weighing lot; a weighing lot keeps
 * it visible so the crew can resume (or move) that lot. Written against the b alias of
 * the hbn_queue query in listHarvestQueueRows. */
/** THE TRUCK RECORD (canon 0.30.226): a batch hides only when it has no weighing
 * lot and every finished lot finished before the farm's today (effective_date,
 * else the day of updated_at). An HBN finished today stays for its next truck.
 * The bound value is that today. */
export const NO_FINISHED_LOT_SQL =
  "AND (EXISTS (SELECT 1 FROM wet_weight_entries w2 WHERE w2.harvest_batch_id = b.id AND w2.deleted_at IS NULL AND w2.status = 'weighing') OR NOT EXISTS (SELECT 1 FROM wet_weight_entries w WHERE w.harvest_batch_id = b.id AND w.deleted_at IS NULL AND w.status <> 'weighing') OR EXISTS (SELECT 1 FROM wet_weight_entries w3 WHERE w3.harvest_batch_id = b.id AND w3.deleted_at IS NULL AND w3.status <> 'weighing' AND COALESCE(NULLIF(w3.effective_date, ''), substr(w3.updated_at, 1, 10)) >= ?))";

/** PRODUCTION SCHEDULING (canon 0.30.97): Trim Packages Entry lists only
 * unloaded lots with a non-deleted trim schedule row in status scheduled. */
export const TRIM_SCHEDULED_SQL =
  "AND EXISTS (SELECT 1 FROM production_schedules ps WHERE ps.wet_weight_entry_id = w.id AND ps.stage = 'trim' AND ps.status = 'scheduled' AND ps.deleted_at IS NULL)";

/** PRODUCTION SCHEDULING (canon 0.30.97) as THE CRYO RUN (canon 0.30.110)
 * reshaped it: a cryo-queue container is scheduled when a live run (an
 * HBN-level cryo schedule row in status scheduled) took it in as an input. */
export const CRYO_SCHEDULED_SQL =
  "AND EXISTS (SELECT 1 FROM cryo_run_inputs i JOIN production_schedules ps ON ps.id = i.run_id AND ps.deleted_at IS NULL AND ps.status = 'scheduled' WHERE i.wip_package_id = p.id)";

/** Left pane rows only: listQueueRows plus the station's paneFilter. The Data Queues
 * tables, /export CSVs, and the queue_pick select fallback keep listQueueRows unfiltered. */
export async function listPaneRows(
  db: D1Database,
  def: QueueDef,
  paneFilter?: "no_finished_lot" | "trim_scheduled" | "cryo_scheduled",
  farmCodes?: readonly string[]
): Promise<QueueRow[]> {
  if (paneFilter === "no_finished_lot" && def.entity === "harvest_batches") {
    const startHour = parseFarmDayStartHour(await getConfigValue(db, CONFIG_KEYS.farm_day_start_hour)) || FARM_DAY_START_HOUR_DEFAULT;
    return listHarvestQueueRows(db, def, NO_FINISHED_LOT_SQL, [farmDay(nowIso(), startHour)], farmCodes);
  }
  if (paneFilter === "trim_scheduled" && def.entity === "wet_weight_entries") {
    return listLotQueueRows(db, def, TRIM_SCHEDULED_SQL);
  }
  if (paneFilter === "cryo_scheduled" && def.entity === "wip_packages") {
    return listPackageQueueRows(db, def, CRYO_SCHEDULED_SQL);
  }
  return listQueueRows(db, def);
}

async function listHarvestQueueRows(
  db: D1Database,
  def: QueueDef,
  filterSql: string,
  extraBinds: unknown[] = [],
  farmCodes?: readonly string[]
): Promise<QueueRow[]> {
  const farms = (farmCodes ?? []).filter((code) => code.length > 0);
  const farmSql = farms.length > 0 ? ` AND b.farm_code IN (${farms.map(() => "?").join(", ")})` : "";
  const result = await db
    .prepare(
      `SELECT b.id, b.hbn, b.entry_date, b.farm_code, s.name AS strain_name, b.created_at
       FROM harvest_batches b
       LEFT JOIN strains s ON s.id = b.strain_id
       WHERE b.deleted_at IS NULL AND b.status = ? AND ${farmHarvestSql("b")} ${filterSql}${farmSql}
       ORDER BY b.created_at DESC`
    )
    .bind(def.predicate.value, ...extraBinds, ...farms)
    .all<Record<string, unknown>>();
  return toQueueRows(result.results ?? []);
}

/** Owner ruling 2026-08-31: the short lot id computed in SQL, written against the
 * b alias of the harvest_batches join. Must match shortLotId in config.ts exactly:
 * the HBN's last 5 digits alone (owner ruling 2026-09-01, alpha feedback: the lot
 * code is always the last 5 of the HBN; the tag pair is the parked traveler format). */
export const SHORT_LOT_ID_SQL = "substr(b.hbn, -5)";

export async function listQueueRows(db: D1Database, def: QueueDef): Promise<QueueRow[]> {
  if (def.entity === "harvest_batches") {
    return listHarvestQueueRows(db, def, "");
  }
  if (def.entity === "wet_weight_entries") {
    return listLotQueueRows(db, def, "");
  }
  return listPackageQueueRows(db, def, "");
}

async function listLotQueueRows(db: D1Database, def: QueueDef, filterSql: string): Promise<QueueRow[]> {
  // Owner ruling 2026-08-31: trucks are record-borne, so a lot with a
  // truck_number labels itself 'Truck <n> - <hbn>'. Legacy lots keep their old
  // Truck N catalog names via d.name; the LEFT JOIN resolves soft-deleted rows.
  // Owner ruling 2026-08-31: the Unloaded Queue and all subsequent queues
  // identify each lot by short_id, with the strain and the dry total.
  // Owner ruling 2026-09-08 (canon 0.30.9): from Trim Packages Entry forward
  // the strain shown is the MARKET strain (a blank one inherits the strain
  // name at Acquire; 0036 backfilled). The lot queues before Trim show no
  // strain column, so one query serves them all.
  const result = await db
    .prepare(
      `SELECT w.id, b.hbn, b.metrc_harvest_tag, ${SHORT_LOT_ID_SQL} AS short_id,
              COALESCE(b.market_strain, s.name) AS strain_name,
              w.weight_grams, w.wet_spear_weight_grams, w.dry_weight_grams,
              d.name AS dry_space_name, w.truck_number,
              CASE WHEN w.truck_number IS NOT NULL THEN 'Truck ' || w.truck_number || ' - ' || b.hbn ELSE d.name END AS truck_label,
              w.notes, w.created_at
       FROM wet_weight_entries w
       LEFT JOIN harvest_batches b ON b.id = w.harvest_batch_id
       LEFT JOIN strains s ON s.id = b.strain_id
       LEFT JOIN dry_spaces d ON d.id = w.actual_dryspc
       WHERE w.deleted_at IS NULL AND w.status = ? ${filterSql}
       ORDER BY d.name, w.created_at DESC`
    )
    .bind(def.predicate.value)
    .all<Record<string, unknown>>();
  return toQueueRows(result.results ?? []);
}

async function listPackageQueueRows(db: D1Database, def: QueueDef, filterSql: string): Promise<QueueRow[]> {
  const result = await db
    .prepare(
      `SELECT p.id, p.package_code, p.package_type_code, p.weight_grams, p.cryo_weight_grams,
              b.hbn, b.metrc_harvest_tag, ${SHORT_LOT_ID_SQL} AS short_id,
              COALESCE(b.market_strain, s.name) AS strain_name, p.created_at,
              p.trim_date, p.trim_operator, p.cryo_date, p.cryo_operator${
                def.key === "testing_queue" ? ", p.source" : ""
              }${
                def.key === "testing_queue"
                  ? `, COALESCE(
                      (SELECT m.lab_test_status FROM metrc_packages m
                        WHERE m.gone_at IS NULL AND m.tag = UPPER(TRIM(p.package_code)) LIMIT 1),
                      (SELECT m.lab_test_status FROM metrc_packages m
                        JOIN local_inventory_items i ON i.deleted_at IS NULL AND i.wip_package_id = p.id
                          AND m.tag = UPPER(TRIM(i.metrc_tag))
                        WHERE m.gone_at IS NULL LIMIT 1),
                      'not in METRC'
                    ) AS lab_status_metrc`
                  : ""
              }
       FROM wip_packages p
       LEFT JOIN wet_weight_entries w ON w.id = p.wet_weight_entry_id
       LEFT JOIN harvest_batches b ON b.id = w.harvest_batch_id
       LEFT JOIN strains s ON s.id = b.strain_id
       WHERE p.deleted_at IS NULL AND p.status = ? ${filterSql}
       ORDER BY p.created_at DESC`
    )
    .bind(def.predicate.value)
    .all<Record<string, unknown>>();
  return toQueueRows(result.results ?? []);
}

function toQueueRows(rows: Record<string, unknown>[]): QueueRow[] {
  return rows.map((row) => {
    const values: Record<string, string> = {};
    for (const [key, value] of Object.entries(row)) {
      if (key === "id") continue;
      values[key] = value == null ? "" : String(value);
    }
    return { id: String(row.id), values };
  });
}

/** PRODUCTION SCHEDULING (canon 0.30.97): one item under an HBN group. `id` is
 * the lot or package id on the available pane, and the schedule row id on the
 * working and complete panes (the POST targets). */
export type ScheduleItemRow = {
  id: string;
  itemId: string;
  harvest_batch_id: string;
  hbn: string;
  farm_code: string;
  strain_name: string;
  entry_date: string;
  identity: string;
  status?: "scheduled" | "complete";
  scheduled_at?: string;
  completed_at?: string | null;
  workDone?: "trimmed" | "cryo weighed" | null;
  /** THE SCHEDULER BY PACKAGE (canon 0.30.196): a prepack row's METRC-facing tag. */
  tag?: string;
  /** THE PACKAGE READS IN FOUR LINES (canon 0.30.199): a prepack row's live grams and its ledger location. */
  grams?: number;
  location?: string | null;
  /** THE PREPACK HEADINGS (canon 0.30.229): the HBN's grow method display name, or null when the batch has none. */
  grow_method?: string | null;
};

/** THE HBN ON THE SCHEDULING PANES (canon 0.30.102; owner, 2026-09-16,
 * verbatim: "Need the HBN listed on the left pane of the scheduling nodes.
 * The information in there isn't pointing us in the right place."): the
 * group heads with the full HBN alone on all three panes. The farm / strain /
 * date simple label the build hand chose is gone from the station. */
export type ScheduleHbnGroup = {
  harvest_batch_id: string;
  hbn: string;
  farm_code: string;
  strain_name: string;
  entry_date: string;
  items: ScheduleItemRow[];
};

export type ProductionScheduleRow = {
  id: string;
  stage: string;
  wet_weight_entry_id: string | null;
  wip_package_id: string | null;
  harvest_batch_id: string;
  status: string;
  effective_date: string | null;
  scheduled_at: string;
  scheduled_by: string | null;
  completed_at: string | null;
  completed_by: string | null;
};

const BORN_PACKAGE_SQL = `COALESCE((SELECT li.package_code FROM local_inventory_items li WHERE li.wet_weight_entry_id = w.id AND li.deleted_at IS NULL ORDER BY li.created_at ASC LIMIT 1), ${SHORT_LOT_ID_SQL})`;

function trimIdentity(row: { short_id: string; strain_name: string; dry_weight_grams: number | string | null; package_code: string }): string {
  return [row.short_id, row.strain_name, `${formatGrams(row.dry_weight_grams)} g`, row.package_code].filter(Boolean).join(" / ");
}

/** THE CRYO RUN (canon 0.30.110; owner: "collapse the lines to their HBN, do
 * not expose individual containers on the scheduled surface"): a pasteurization
 * line reads the HBN's pool, never a container. */
export function cryoRunIdentity(row: { containers: number | string; in_grams: number | string | null; outputs?: number | string | null; out_grams?: number | string | null }): string {
  const n = Number(row.containers);
  const head = `${n} ${n === 1 ? "container" : "containers"} / ${formatGrams(row.in_grams)} g in`;
  if (row.outputs == null) return head;
  const o = Number(row.outputs);
  return `${head} / ${o} out, ${formatGrams(row.out_grams)} g`;
}

/** Group flat schedule rows under their HBN, keeping first-seen order (the
 * loader's ORDER BY). One predicate for the pane and the counts: voided lots,
 * packages, or HBNs never enter the list. */
export function groupScheduleByHbn(rows: ScheduleItemRow[]): ScheduleHbnGroup[] {
  const groups: ScheduleHbnGroup[] = [];
  const idx = new Map<string, ScheduleHbnGroup>();
  for (const row of rows) {
    let g = idx.get(row.harvest_batch_id);
    if (!g) {
      g = {
        harvest_batch_id: row.harvest_batch_id,
        hbn: row.hbn,
        farm_code: row.farm_code,
        strain_name: row.strain_name,
        entry_date: row.entry_date,
        items: [],
      };
      idx.set(row.harvest_batch_id, g);
      groups.push(g);
    }
    g.items.push(row);
  }
  return groups;
}

type TrimAvailRow = {
  item_id: string;
  harvest_batch_id: string;
  hbn: string;
  entry_date: string;
  farm_code: string;
  strain_name: string | null;
  short_id: string;
  dry_weight_grams: number | null;
  package_code: string | null;
};

async function listTrimAvailable(db: D1Database, hbnId?: string): Promise<TrimAvailRow[]> {
  const hbnClause = hbnId ? "AND b.id = ?" : "";
  const binds: string[] = hbnId ? [hbnId] : [];
  const result = await db
    .prepare(
      `SELECT w.id AS item_id, b.id AS harvest_batch_id, b.hbn, b.entry_date, b.farm_code,
              COALESCE(b.market_strain, s.name) AS strain_name,
              ${SHORT_LOT_ID_SQL} AS short_id, w.dry_weight_grams, ${BORN_PACKAGE_SQL} AS package_code
       FROM harvest_batches b
       JOIN wet_weight_entries w ON w.harvest_batch_id = b.id
       LEFT JOIN strains s ON s.id = b.strain_id
       WHERE b.deleted_at IS NULL AND w.deleted_at IS NULL AND w.status = ?
         AND NOT EXISTS (
           SELECT 1 FROM production_schedules ps
           WHERE ps.wet_weight_entry_id = w.id AND ps.stage = ? AND ps.deleted_at IS NULL
         ) ${hbnClause}
       ORDER BY b.created_at DESC, w.created_at DESC`
    )
    .bind(LOT_STATUS.unloaded, SCHEDULE_STAGES.trim, ...binds)
    .all<TrimAvailRow>();
  return result.results ?? [];
}

/** THE CRYO RUN (canon 0.30.110): an HBN's cryo-queue trim containers not yet
 * taken into a live run, pooled; one row per HBN. */
type CryoPoolRow = {
  harvest_batch_id: string;
  hbn: string;
  entry_date: string;
  farm_code: string;
  strain_name: string | null;
  containers: number;
  in_grams: number | null;
};

/** A container is free for a run while it waits in the Cryo Queue and no live
 * (non-deleted) run holds it as an input; a container in a finished run has
 * left the queue as pasteurized, and one in an unscheduled run is free again
 * (owner, his pick: later-trimmed containers "wait for a new schedule"). */
const CRYO_FREE_CONTAINER_SQL = `p.deleted_at IS NULL AND p.status = ? AND ${NON_TRIM_SOURCE_SQL}
         AND NOT EXISTS (
           SELECT 1 FROM cryo_run_inputs i
           JOIN production_schedules ps ON ps.id = i.run_id AND ps.deleted_at IS NULL
           WHERE i.wip_package_id = p.id
         )`;

async function listCryoAvailable(db: D1Database, hbnId?: string): Promise<CryoPoolRow[]> {
  const hbnClause = hbnId ? "AND b.id = ?" : "";
  const binds: string[] = hbnId ? [hbnId] : [];
  const result = await db
    .prepare(
      `SELECT b.id AS harvest_batch_id, b.hbn, b.entry_date, b.farm_code,
              COALESCE(b.market_strain, s.name) AS strain_name,
              COUNT(p.id) AS containers, COALESCE(SUM(p.weight_grams), 0) AS in_grams
       FROM harvest_batches b
       JOIN wet_weight_entries w ON w.harvest_batch_id = b.id AND w.deleted_at IS NULL
       JOIN wip_packages p ON p.wet_weight_entry_id = w.id
       LEFT JOIN strains s ON s.id = b.strain_id
       WHERE b.deleted_at IS NULL AND ${CRYO_FREE_CONTAINER_SQL} ${hbnClause}
       GROUP BY b.id, b.hbn, b.entry_date, b.farm_code, b.market_strain, s.name, b.created_at
       ORDER BY b.created_at DESC`
    )
    .bind(WIP_STATUS.cryo_queue, ...binds)
    .all<CryoPoolRow>();
  return result.results ?? [];
}

export type CryoFreeContainer = { id: string; package_type_code: string; weight_grams: number; wet_weight_entry_id: string };

/** The containers a >> takes into the run: the HBN's free cryo-queue containers at that moment. */
export async function listCryoFreeContainers(db: D1Database, hbnId: string): Promise<CryoFreeContainer[]> {
  const result = await db
    .prepare(
      `SELECT p.id, p.package_type_code, p.weight_grams, p.wet_weight_entry_id
       FROM wip_packages p
       JOIN wet_weight_entries w ON w.id = p.wet_weight_entry_id AND w.deleted_at IS NULL
       WHERE w.harvest_batch_id = ? AND ${CRYO_FREE_CONTAINER_SQL}
       ORDER BY p.created_at ASC`
    )
    .bind(hbnId, WIP_STATUS.cryo_queue)
    .all<CryoFreeContainer>();
  return result.results ?? [];
}

/** THE PACKAGE READS IN FOUR LINES (canon 0.30.199): a prepack row's identity is
 * the whole tag; the panes draw the strain, the grams, the HBN and the location
 * on their own lines from the row's fields. */
function prepackIdentity(tag: string | null, code: string): string {
  return metrcFacingTag({ metrc_tag: tag, package_code: code });
}

type PrepackFeed = {
  package_id: string;
  package_type_code: string;
  package_code: string;
  harvest_batch_id: string;
  hbn: string;
  farm_code: string;
  entry_date: string;
  strain_name: string | null;
  metrc_tag: string | null;
  qty: number;
  location: string | null;
  grow_method: string | null;
};

/** THE PACKAGE CARRIES ITS HBN (canon 0.30.196): the feed reads the HBN from
 * the package. The lot is optional (a package adopted onto a METRC-born batch
 * has none); a package whose lot was voided stays out as before. */
const PREPACK_PARENT_SQL = `
  SELECT p.id AS package_id, p.package_type_code, p.package_code,
         b.id AS harvest_batch_id, b.hbn, b.farm_code, b.entry_date,
         COALESCE(b.market_strain, st.name, '') AS strain_name, li.metrc_tag, li.qty, li.location,
         gm.display_name AS grow_method
  FROM wip_packages p
  JOIN harvest_batches b ON b.id = p.harvest_batch_id AND b.deleted_at IS NULL
  LEFT JOIN wet_weight_entries w ON w.id = p.wet_weight_entry_id AND w.deleted_at IS NULL
  LEFT JOIN strains st ON st.id = b.strain_id
  LEFT JOIN grow_methods gm ON gm.code = b.grow_method_code AND gm.deleted_at IS NULL
  JOIN local_inventory_items li ON li.id = (
    SELECT i.id FROM local_inventory_items i
    WHERE i.wip_package_id = p.id AND i.deleted_at IS NULL AND i.qty > 0
    ORDER BY i.created_at ASC LIMIT 1
  )
  WHERE p.deleted_at IS NULL AND p.source IN ('${WIP_SOURCE.cryo}', '${WIP_SOURCE.metrc}')
    AND (p.wet_weight_entry_id IS NULL OR w.id IS NOT NULL)
    AND p.status = '${WIP_STATUS.released}' AND p.test_outcome = 'passed'`;

async function listPrepackAvailable(db: D1Database, packageId?: string): Promise<PrepackFeed[]> {
  const categories = parseCryoTypeCategories(await getConfigValue(db, CONFIG_KEYS.cryo_type_categories));
  const packageClause = packageId ? "AND p.id = ?" : "";
  const result = await db
    .prepare(
      `${PREPACK_PARENT_SQL} ${packageClause}
       AND NOT EXISTS (
         SELECT 1 FROM production_schedules ps
         WHERE ps.wip_package_id = p.id AND ps.stage = '${SCHEDULE_STAGES.prepack}' AND ps.deleted_at IS NULL
       )
       ORDER BY b.created_at DESC, p.created_at ASC`
    )
    .bind(...(packageId ? [packageId] : []))
    .all<PrepackFeed>();
  return (result.results ?? []).filter((row) => isPrepackWpr(row.package_type_code, categories) && isMetrcTag(row.metrc_tag));
}

/** THE SCHEDULER BY PACKAGE (canon 0.30.196): the one package a >> names, when it still stands in Available. */
export async function findPrepackAvailable(db: D1Database, packageId: string): Promise<{ package_id: string; harvest_batch_id: string } | null> {
  const row = (await listPrepackAvailable(db, packageId))[0];
  return row ? { package_id: row.package_id, harvest_batch_id: row.harvest_batch_id } : null;
}

function prepackAvailableRow(row: PrepackFeed): ScheduleItemRow {
  return {
    id: row.package_id,
    itemId: row.package_id,
    harvest_batch_id: row.harvest_batch_id,
    hbn: row.hbn,
    farm_code: row.farm_code,
    strain_name: row.strain_name ?? "",
    entry_date: row.entry_date,
    identity: prepackIdentity(row.metrc_tag, row.package_code),
    tag: metrcFacingTag({ metrc_tag: row.metrc_tag, package_code: row.package_code }),
    grams: Number(row.qty),
    location: row.location,
    grow_method: row.grow_method,
  };
}

/** THE SCHEDULER BY PACKAGE (canon 0.30.196): the Prepack page's three panes, one row per package. */
export async function listPrepackPanes(db: D1Database): Promise<{ available: ScheduleItemRow[]; working: ScheduleItemRow[]; complete: ScheduleItemRow[] }> {
  const [available, working, complete] = await Promise.all([
    listPrepackAvailable(db),
    listPrepackScheduled(db, SCHEDULE_STATUS.scheduled),
    listPrepackScheduled(db, SCHEDULE_STATUS.complete),
  ]);
  return { available: available.map(prepackAvailableRow), working, complete };
}

async function listPrepackScheduled(db: D1Database, status: string): Promise<ScheduleItemRow[]> {
  const order = status === SCHEDULE_STATUS.complete ? "ps.completed_at DESC" : "ps.scheduled_at DESC";
  const result = await db
    .prepare(
      `SELECT ps.id, ps.status, ps.scheduled_at, ps.completed_at,
              p.id AS package_id, p.package_code,
              b.id AS harvest_batch_id, b.hbn, b.farm_code, b.entry_date,
              COALESCE(b.market_strain, st.name, '') AS strain_name,
              li.metrc_tag, COALESCE(li.qty, 0) AS qty, li.location
       FROM production_schedules ps
       JOIN wip_packages p ON p.id = ps.wip_package_id AND p.deleted_at IS NULL
       JOIN harvest_batches b ON b.id = p.harvest_batch_id AND b.deleted_at IS NULL
       LEFT JOIN wet_weight_entries w ON w.id = p.wet_weight_entry_id AND w.deleted_at IS NULL
       LEFT JOIN strains st ON st.id = b.strain_id
       LEFT JOIN local_inventory_items li ON li.id = (
         SELECT i.id FROM local_inventory_items i
         WHERE i.wip_package_id = p.id AND i.deleted_at IS NULL
         ORDER BY i.created_at ASC LIMIT 1
       )
       WHERE ps.deleted_at IS NULL AND ps.stage = '${SCHEDULE_STAGES.prepack}' AND ps.status = ?
         AND (p.wet_weight_entry_id IS NULL OR w.id IS NOT NULL)
       ORDER BY ${order}`
    )
    .bind(status)
    .all<{
      id: string;
      status: string;
      scheduled_at: string;
      completed_at: string | null;
      package_id: string;
      package_code: string;
      harvest_batch_id: string;
      hbn: string;
      farm_code: string;
      entry_date: string;
      strain_name: string | null;
      metrc_tag: string | null;
      qty: number;
      location: string | null;
    }>();
  return (result.results ?? []).map((row) => ({
    id: row.id,
    itemId: row.package_id,
    harvest_batch_id: row.harvest_batch_id,
    hbn: row.hbn,
    farm_code: row.farm_code,
    strain_name: row.strain_name ?? "",
    entry_date: row.entry_date,
    identity: prepackIdentity(row.metrc_tag, row.package_code),
    status: row.status === SCHEDULE_STATUS.complete ? "complete" : "scheduled",
    scheduled_at: row.scheduled_at,
    completed_at: row.completed_at,
    workDone: null,
    tag: metrcFacingTag({ metrc_tag: row.metrc_tag, package_code: row.package_code }),
    grams: Number(row.qty),
    location: row.location,
  }));
}

export async function listScheduleAvailable(db: D1Database, stage: ScheduleStage): Promise<ScheduleHbnGroup[]> {
  if (stage === SCHEDULE_STAGES.prepack) {
    return groupScheduleByHbn((await listPrepackAvailable(db)).map(prepackAvailableRow));
  }
  if (stage === SCHEDULE_STAGES.trim) {
    return groupScheduleByHbn(
      (await listTrimAvailable(db)).map((row) => ({
        id: row.item_id,
        itemId: row.item_id,
        harvest_batch_id: row.harvest_batch_id,
        hbn: row.hbn,
        farm_code: row.farm_code,
        strain_name: row.strain_name ?? "",
        entry_date: row.entry_date,
        identity: trimIdentity({
          short_id: row.short_id,
          strain_name: row.strain_name ?? "",
          dry_weight_grams: row.dry_weight_grams,
          package_code: row.package_code ?? row.short_id,
        }),
      }))
    );
  }
  // THE CRYO RUN (canon 0.30.110): one line per HBN, the pool, no containers.
  return groupScheduleByHbn(
    (await listCryoAvailable(db)).map((row) => ({
      id: row.harvest_batch_id,
      itemId: row.harvest_batch_id,
      harvest_batch_id: row.harvest_batch_id,
      hbn: row.hbn,
      farm_code: row.farm_code,
      strain_name: row.strain_name ?? "",
      entry_date: row.entry_date,
      identity: cryoRunIdentity(row),
    }))
  );
}

/** Available items of one HBN for a stage (the >> post). */
export async function listAvailableScheduleItemsForHbn(
  db: D1Database,
  stage: ScheduleStage,
  hbnId: string
): Promise<Array<{ itemId: string; harvest_batch_id: string }>> {
  // THE SCHEDULER BY PACKAGE (canon 0.30.196): prepack has no HBN-wide >>.
  if (stage === SCHEDULE_STAGES.prepack) return [];
  if (stage === SCHEDULE_STAGES.trim) {
    return (await listTrimAvailable(db, hbnId)).map((row) => ({
      itemId: row.item_id,
      harvest_batch_id: row.harvest_batch_id,
    }));
  }
  // THE CRYO RUN: the item is the HBN itself; its free containers become the run's inputs.
  return (await listCryoAvailable(db, hbnId)).map((row) => ({
    itemId: row.harvest_batch_id,
    harvest_batch_id: row.harvest_batch_id,
  }));
}

type TrimSchedRow = TrimAvailRow & {
  id: string;
  status: string;
  scheduled_at: string;
  completed_at: string | null;
  lot_status: string;
};

/** THE CRYO RUN (canon 0.30.110): a pasteurization schedule row IS the run: one
 * production_schedules row per HBN (stage cryo, no item columns), its inputs in
 * cryo_run_inputs, its outputs the wip_packages rows that point at it. */
export type CryoRunRow = {
  id: string;
  status: string;
  scheduled_at: string;
  completed_at: string | null;
  effective_date: string | null;
  harvest_batch_id: string;
  hbn: string;
  entry_date: string;
  farm_code: string;
  strain_name: string | null;
  containers: number;
  in_grams: number | null;
  outputs: number;
  out_grams: number | null;
};

const CRYO_RUN_SELECT = `SELECT ps.id, ps.status, ps.scheduled_at, ps.completed_at, ps.effective_date,
              b.id AS harvest_batch_id, b.hbn, b.entry_date, b.farm_code,
              COALESCE(b.market_strain, s.name) AS strain_name,
              (SELECT COUNT(*) FROM cryo_run_inputs i WHERE i.run_id = ps.id) AS containers,
              (SELECT COALESCE(SUM(i.weight_grams), 0) FROM cryo_run_inputs i WHERE i.run_id = ps.id) AS in_grams,
              (SELECT COUNT(*) FROM wip_packages o WHERE o.cryo_run_id = ps.id AND o.deleted_at IS NULL) AS outputs,
              (SELECT COALESCE(SUM(o.weight_grams), 0) FROM wip_packages o WHERE o.cryo_run_id = ps.id AND o.deleted_at IS NULL) AS out_grams
       FROM production_schedules ps
       JOIN harvest_batches b ON b.id = ps.harvest_batch_id AND b.deleted_at IS NULL
       LEFT JOIN strains s ON s.id = b.strain_id
       WHERE ps.deleted_at IS NULL AND ps.stage = '${SCHEDULE_STAGES.cryo}' AND ps.wip_package_id IS NULL`;

export async function listCryoRuns(db: D1Database, status?: string): Promise<CryoRunRow[]> {
  const order = status === SCHEDULE_STATUS.complete ? "ps.completed_at DESC, ps.scheduled_at DESC" : "ps.scheduled_at DESC";
  const result = status
    ? await db.prepare(`${CRYO_RUN_SELECT} AND ps.status = ? ORDER BY ${order}`).bind(status).all<CryoRunRow>()
    : await db.prepare(`${CRYO_RUN_SELECT} ORDER BY ${order}`).all<CryoRunRow>();
  return result.results ?? [];
}

export async function getCryoRun(db: D1Database, id: string): Promise<CryoRunRow | null> {
  return db.prepare(`${CRYO_RUN_SELECT} AND ps.id = ?`).bind(id).first<CryoRunRow>();
}

export type CryoRunInputRow = { id: string; wip_package_id: string; package_type_code: string; weight_grams: number; wet_weight_entry_id: string | null; package_code: string | null; status: string | null };

export async function listCryoRunInputs(db: D1Database, runId: string): Promise<CryoRunInputRow[]> {
  const result = await db
    .prepare(
      `SELECT i.id, i.wip_package_id, i.package_type_code, i.weight_grams,
              p.wet_weight_entry_id, p.package_code, p.status
       FROM cryo_run_inputs i
       LEFT JOIN wip_packages p ON p.id = i.wip_package_id
       WHERE i.run_id = ?
       ORDER BY i.created_at ASC, i.id ASC`
    )
    .bind(runId)
    .all<CryoRunInputRow>();
  return result.results ?? [];
}

export type CryoOutputRow = {
  id: string;
  package_code: string;
  package_type_code: string;
  weight_grams: number;
  cryo_date: string | null;
  cryo_operator: string | null;
  status: string;
  created_at: string;
};

/** The run's outputs, newest first (the trim line's entered list, canon 0.30.9). */
export async function listCryoRunOutputs(db: D1Database, runId: string): Promise<CryoOutputRow[]> {
  const result = await db
    .prepare(
      `SELECT id, package_code, package_type_code, weight_grams, cryo_date, cryo_operator, status, created_at
       FROM wip_packages WHERE cryo_run_id = ? AND deleted_at IS NULL
       ORDER BY created_at DESC, id DESC`
    )
    .bind(runId)
    .all<CryoOutputRow>();
  return result.results ?? [];
}

/** THE POOL BY CATEGORY (canon 0.30.121). Owner, 2026-09-18, of the pool table:
 * "here is the surface that should show the available weight in each category,
 * so the TL in cryo knows they're not over-issuing one particular product
 * category." One line per product category: the trim types that read as it
 * (app_config cryo_type_categories: BUD; SMALLS as WPR; SHAKE as SHA), what the
 * run took in under those types, what has been entered out under the category,
 * and the difference as the category's available weight. A category entered
 * with no type behind it (an output off the list) still lists with 0 in. */
export type CryoPoolLine = { category_code: string; type_codes: string[]; in_grams: number; out_grams: number };
export type CryoPool = { lines: CryoPoolLine[] };

/** The pool (owner: "The containers created in trim constitute a total weight
 * by product type.  That's what's consumed."), in by type and out by category,
 * folded to one line per category (canon 0.30.121) in the type list's order
 * (BUD, WPR, SHA); a category off the list falls after them in the order it
 * first appears. */
export async function listCryoRunPool(db: D1Database, runId: string): Promise<CryoPool> {
  const typeCategories = await getCryoTypeCategories(db);
  const ins = await db
    .prepare(
      `SELECT package_type_code, COALESCE(SUM(weight_grams), 0) AS grams
       FROM cryo_run_inputs WHERE run_id = ? GROUP BY package_type_code ORDER BY MIN(created_at), package_type_code`
    )
    .bind(runId)
    .all<{ package_type_code: string; grams: number }>();
  const outs = await db
    .prepare(
      `SELECT package_type_code, COALESCE(SUM(weight_grams), 0) AS grams
       FROM wip_packages WHERE cryo_run_id = ? AND deleted_at IS NULL GROUP BY package_type_code ORDER BY MIN(created_at), package_type_code`
    )
    .bind(runId)
    .all<{ package_type_code: string; grams: number }>();
  return foldCryoPool(
    (ins.results ?? []).map((r) => ({ package_type_code: r.package_type_code, grams: Number(r.grams) })),
    (outs.results ?? []).map((r) => ({ category_code: r.package_type_code, grams: Number(r.grams) })),
    typeCategories
  );
}

/** Pure fold of the run's inputs by type and outputs by category into the
 * pool's lines, one per category, ordered by the type list (canon 0.30.121). */
export function foldCryoPool(
  ins: Array<{ package_type_code: string; grams: number }>,
  outs: Array<{ category_code: string; grams: number }>,
  typeCategories: ReadonlyMap<string, string>
): CryoPool {
  const categoryOrder: string[] = [];
  for (const cat of typeCategories.values()) if (!categoryOrder.includes(cat)) categoryOrder.push(cat);
  const lines = new Map<string, CryoPoolLine>();
  const lineFor = (category: string): CryoPoolLine => {
    let line = lines.get(category);
    if (!line) {
      line = { category_code: category, type_codes: [], in_grams: 0, out_grams: 0 };
      lines.set(category, line);
    }
    return line;
  };
  for (const r of ins) {
    const type = String(r.package_type_code).toUpperCase();
    const category = typeCategories.get(type) ?? type;
    const line = lineFor(category);
    if (!line.type_codes.includes(type)) line.type_codes.push(type);
    line.in_grams = roundGrams(line.in_grams + Number(r.grams));
  }
  for (const r of outs) {
    const line = lineFor(String(r.category_code).toUpperCase());
    line.out_grams = roundGrams(line.out_grams + Number(r.grams));
  }
  const rank = (category: string) => {
    const i = categoryOrder.indexOf(category);
    return i === -1 ? categoryOrder.length : i;
  };
  const ordered = [...lines.values()];
  const firstSeen = new Map(ordered.map((l, i) => [l.category_code, i]));
  ordered.sort((a, b) => rank(a.category_code) - rank(b.category_code) || (firstSeen.get(a.category_code) ?? 0) - (firstSeen.get(b.category_code) ?? 0));
  return { lines: ordered };
}

/** THE CRYO CATEGORIES (canon 0.30.112): the product categories a cryo line may
 * be entered under, from app_config in the owner's order (WPR, BUD, SHA). */
export async function listCryoCategories(db: D1Database): Promise<string[]> {
  return parseCryoCategories(await getConfigValue(db, CONFIG_KEYS.cryo_product_categories));
}

/** THE CRYO POOL BY TYPE (canon 0.30.119): the trim types that go to cryo and
 * the category each reads as (BUD=BUD, SMALLS=WPR, SHAKE=SHA), from app_config. */
export async function getCryoTypeCategories(db: D1Database): Promise<Map<string, string>> {
  return parseCryoTypeCategories(await getConfigValue(db, CONFIG_KEYS.cryo_type_categories));
}

export type HbnHarvestPackage = { id: string; wet_weight_entry_id: string; package_code: string; metrc_tag: string | null; qty: number; created_at: string };

/** THE CRYO RUN (canon 0.30.110; owner: "The HBN continues to be important to
 * the background data for METRC"): the HBN's harvest packages, the ledger rows
 * born at Finish lot, one per lot in lot order; the New Packages file names
 * them as the ingredients. */
export async function listHbnHarvestPackages(db: D1Database, harvestBatchId: string): Promise<HbnHarvestPackage[]> {
  const result = await db
    .prepare(
      `SELECT li.id, li.wet_weight_entry_id, li.package_code, li.metrc_tag, li.qty, li.created_at
       FROM local_inventory_items li
       JOIN wet_weight_entries w ON w.id = li.wet_weight_entry_id AND w.deleted_at IS NULL
       WHERE w.harvest_batch_id = ? AND li.deleted_at IS NULL AND li.wet_weight_entry_id IS NOT NULL
       ORDER BY w.created_at ASC, li.created_at ASC`
    )
    .bind(harvestBatchId)
    .all<HbnHarvestPackage>();
  return result.results ?? [];
}

export type PendingNewPackagesRow = {
  id: string;
  harvest_batch_id: string;
  hbn: string;
  outputs: number;
  out_grams: number | null;
  newest_activity: string;
  filename: string;
};

/** The New Packages files waiting at the export home: finished runs with
 * outputs and no upload mark (or clear) of the kind on the run. */
export async function listPendingNewPackagesUploads(db: D1Database): Promise<PendingNewPackagesRow[]> {
  const result = await db
    .prepare(
      `SELECT ps.id, ps.harvest_batch_id, b.hbn,
              (SELECT COUNT(*) FROM wip_packages o WHERE o.cryo_run_id = ps.id AND o.deleted_at IS NULL) AS outputs,
              (SELECT COALESCE(SUM(o.weight_grams), 0) FROM wip_packages o WHERE o.cryo_run_id = ps.id AND o.deleted_at IS NULL) AS out_grams,
              COALESCE(ps.completed_at, ps.updated_at) AS newest_activity
       FROM production_schedules ps
       JOIN harvest_batches b ON b.id = ps.harvest_batch_id AND b.deleted_at IS NULL
       WHERE ps.deleted_at IS NULL AND ps.stage = '${SCHEDULE_STAGES.cryo}' AND ps.wip_package_id IS NULL
         AND ps.status = '${SCHEDULE_STATUS.complete}'
         AND EXISTS (SELECT 1 FROM wip_packages o WHERE o.cryo_run_id = ps.id AND o.deleted_at IS NULL)
         AND NOT EXISTS (
           SELECT 1 FROM metrc_uploads u WHERE u.ref_id = ps.id AND u.kind = 'new_packages' AND u.deleted_at IS NULL
         )
       ORDER BY newest_activity DESC`
    )
    .all<Omit<PendingNewPackagesRow, "filename">>();
  return (result.results ?? []).map((row) => ({ ...row, filename: newPackagesFilename(row.hbn) }));
}

export function newPackagesFilename(hbn: string): string {
  return `new_packages_${String(hbn).replace(/[^A-Za-z0-9._-]+/g, "_")}.xlsx`;
}

async function listTrimScheduled(db: D1Database, status: string): Promise<ScheduleItemRow[]> {
  const order = status === SCHEDULE_STATUS.complete ? "ps.completed_at DESC" : "ps.scheduled_at DESC";
  const result = await db
    .prepare(
      `SELECT ps.id, ps.status, ps.scheduled_at, ps.completed_at,
              w.id AS item_id, w.status AS lot_status, w.dry_weight_grams,
              b.id AS harvest_batch_id, b.hbn, b.entry_date, b.farm_code,
              COALESCE(b.market_strain, s.name) AS strain_name,
              ${SHORT_LOT_ID_SQL} AS short_id, ${BORN_PACKAGE_SQL} AS package_code
       FROM production_schedules ps
       JOIN wet_weight_entries w ON w.id = ps.wet_weight_entry_id AND w.deleted_at IS NULL
       JOIN harvest_batches b ON b.id = w.harvest_batch_id AND b.deleted_at IS NULL
       LEFT JOIN strains s ON s.id = b.strain_id
       WHERE ps.deleted_at IS NULL AND ps.stage = ? AND ps.status = ?
       ORDER BY ${order}`
    )
    .bind(SCHEDULE_STAGES.trim, status)
    .all<TrimSchedRow>();
  return (result.results ?? []).map((row) => ({
    id: row.id,
    itemId: row.item_id,
    harvest_batch_id: row.harvest_batch_id,
    hbn: row.hbn,
    farm_code: row.farm_code,
    strain_name: row.strain_name ?? "",
    entry_date: row.entry_date,
    identity: trimIdentity({
      short_id: row.short_id,
      strain_name: row.strain_name ?? "",
      dry_weight_grams: row.dry_weight_grams,
      package_code: row.package_code ?? row.short_id,
    }),
    status: row.status === SCHEDULE_STATUS.complete ? "complete" : "scheduled",
    scheduled_at: row.scheduled_at,
    completed_at: row.completed_at,
    workDone: row.lot_status !== LOT_STATUS.unloaded ? "trimmed" : null,
  }));
}

async function listCryoScheduled(db: D1Database, status: string): Promise<ScheduleItemRow[]> {
  // THE CRYO RUN (canon 0.30.110): one line per run, the pool in and out; the
  // containers never show. A run with outputs reads cryo weighed.
  return (await listCryoRuns(db, status)).map((row) => ({
    id: row.id,
    itemId: row.id,
    harvest_batch_id: row.harvest_batch_id,
    hbn: row.hbn,
    farm_code: row.farm_code,
    strain_name: row.strain_name ?? "",
    entry_date: row.entry_date,
    identity: cryoRunIdentity(row),
    status: row.status === SCHEDULE_STATUS.complete ? "complete" : "scheduled",
    scheduled_at: row.scheduled_at,
    completed_at: row.completed_at,
    workDone: Number(row.outputs) > 0 ? "cryo weighed" : null,
  }));
}

async function listStageRows(db: D1Database, stage: ScheduleStage, status: string): Promise<ScheduleItemRow[]> {
  if (stage === SCHEDULE_STAGES.trim) return listTrimScheduled(db, status);
  if (stage === SCHEDULE_STAGES.prepack) return listPrepackScheduled(db, status);
  return listCryoScheduled(db, status);
}

export async function listScheduleWorking(db: D1Database, stage: ScheduleStage): Promise<ScheduleHbnGroup[]> {
  return groupScheduleByHbn(await listStageRows(db, stage, SCHEDULE_STATUS.scheduled));
}

export async function listScheduleComplete(db: D1Database, stage: ScheduleStage): Promise<ScheduleHbnGroup[]> {
  return groupScheduleByHbn(await listStageRows(db, stage, SCHEDULE_STATUS.complete));
}

export async function getScheduleRow(db: D1Database, id: string): Promise<ProductionScheduleRow | null> {
  return db
    .prepare(
      `SELECT id, stage, wet_weight_entry_id, wip_package_id, harvest_batch_id, status,
              effective_date, scheduled_at, scheduled_by, completed_at, completed_by
       FROM production_schedules WHERE id = ? AND deleted_at IS NULL`
    )
    .bind(id)
    .first<ProductionScheduleRow>();
}

export async function findOpenScheduleForLot(
  db: D1Database,
  lotId: string
): Promise<{ id: string; status: string } | null> {
  return db
    .prepare(
      `SELECT id, status FROM production_schedules
       WHERE wet_weight_entry_id = ? AND stage = ? AND deleted_at IS NULL`
    )
    .bind(lotId, SCHEDULE_STAGES.trim)
    .first<{ id: string; status: string }>();
}

export async function farmDisplayName(db: D1Database, code: string): Promise<string> {
  if (!code) return "";
  const row = await db
    .prepare(`SELECT display_name FROM farms WHERE code = ? AND deleted_at IS NULL`)
    .bind(code)
    .first<{ display_name: string }>();
  return row?.display_name ?? code;
}

export type DrySpaceOptionRow = LookupOption & { kind: string; farm_code: string | null };

/** The Move To rule: the row's kind is allowed for the batch's farm AND the row is
 * shared (farm_code NULL) or scoped to that farm (owner ruling 2026-08-28).
 * Owner ruling 2026-08-31: truck-kind rows never stand in the catalog, so kind
 * truck drops out here entirely; that keeps the bare sentinel 'Truck' row from
 * ever rendering. Truck options derive from the batch's own lots instead. */
export function filterDrySpaces(
  rows: readonly DrySpaceOptionRow[],
  kinds: readonly string[],
  farmCode: string
): LookupOption[] {
  const allowed = new Set(kinds);
  allowed.delete("truck");
  return rows
    .filter((row) => allowed.has(row.kind) && (row.farm_code == null || row.farm_code === farmCode))
    .map((row) => ({ value: row.value, label: row.label }));
}

/** Dry spaces limited to the given kinds and farm, for the farm-filtered Move To select. */
export async function listDrySpacesByKinds(
  db: D1Database,
  kinds: readonly string[],
  farmCode: string
): Promise<LookupOption[]> {
  const result = await db
    .prepare(
      `SELECT id AS value, name AS label, kind, farm_code FROM dry_spaces WHERE deleted_at IS NULL ORDER BY name`
    )
    .all<DrySpaceOptionRow>();
  return filterDrySpaces(result.results ?? [], kinds, farmCode);
}

/** Owner ruling 2026-08-31: trucks are record-borne, so one batch's truck options
 * derive from the distinct truck numbers on its own non-voided lots, numerically
 * sorted. A different HBN starts back at zero. */
export async function listBatchTruckNumbers(
  db: D1Database,
  harvestBatchId: string
): Promise<string[]> {
  const result = await db
    .prepare(
      `SELECT DISTINCT truck_number FROM wet_weight_entries
       WHERE harvest_batch_id = ? AND truck_number IS NOT NULL AND deleted_at IS NULL
       ORDER BY CAST(truck_number AS INTEGER)`
    )
    .bind(harvestBatchId)
    .all<{ truck_number: string }>();
  return (result.results ?? []).map((row) => String(row.truck_number));
}

/** THE TRUCK RECORD (canon 0.30.226): the next Truck # is one past the numbers
 * already on this farm's lots of the same farm day (effective_date, else the
 * created day). */
export async function listFarmDayTruckNumbers(db: D1Database, farmCode: string, day: string): Promise<string[]> {
  const startHour = parseFarmDayStartHour(await getConfigValue(db, CONFIG_KEYS.farm_day_start_hour)) || FARM_DAY_START_HOUR_DEFAULT;
  const result = await db
    .prepare(
      `SELECT w.truck_number, w.effective_date, w.created_at
       FROM wet_weight_entries w
       JOIN harvest_batches b ON b.id = w.harvest_batch_id
       WHERE b.farm_code = ? AND w.deleted_at IS NULL AND w.truck_number IS NOT NULL AND TRIM(w.truck_number) <> ''`
    )
    .bind(farmCode)
    .all<{ truck_number: string; effective_date: string | null; created_at: string }>();
  const numbers: string[] = [];
  for (const row of result.results ?? []) {
    const when = (row.effective_date ?? "").trim() || farmDay(row.created_at, startHour);
    if (when === day) numbers.push(String(row.truck_number));
  }
  return numbers;
}

export type OpenHbnOption = { id: string; hbn: string; label: string };

/** Minted open HBNs of one farm, header first, then newest by entry date. */
export async function listOpenFarmHbns(db: D1Database, farmCode: string, headerId: string): Promise<OpenHbnOption[]> {
  const result = await db
    .prepare(
      `SELECT b.id, b.hbn, b.entry_date, b.farm_code, COALESCE(s.name, '') AS strain_name
       FROM harvest_batches b
       LEFT JOIN strains s ON s.id = b.strain_id
       WHERE b.deleted_at IS NULL AND b.status = 'open' AND b.farm_code = ? AND ${farmHarvestSql("b")}
       ORDER BY b.entry_date DESC, b.created_at DESC`
    )
    .bind(farmCode)
    .all<{ id: string; hbn: string; entry_date: string; farm_code: string; strain_name: string }>();
  const rows = result.results ?? [];
  const header = rows.find((row) => row.id === headerId);
  const rest = rows.filter((row) => row.id !== headerId);
  const ordered = header ? [header, ...rest] : rest;
  return ordered.map((row) => ({
    id: row.id,
    hbn: row.hbn,
    label: [row.farm_code, row.strain_name, row.entry_date].filter(Boolean).join(" / "),
  }));
}

function hbnOptionLabel(row: { farm_code: string; strain_name: string; entry_date: string }): string {
  return [row.farm_code, row.strain_name, row.entry_date].filter(Boolean).join(" / ");
}

/** THE IN-TRANSIT RULE (canon 0.30.320), the gate's fix (canon 0.30.322): the
 * field select lists an open ARL or PNS batch while Finish Load YES has not
 * closed it AND under the farm-day rule of NO_FINISHED_LOT_SQL: no lot yet, a
 * weighing lot open, or a lot finished within the farm's today (a pass earlier
 * today keeps the HBN for the day's later loads; a finish before today, the
 * truck flow's or the pass's, leaves it, so last week's HBNs never crowd the
 * select). The Demote of that HBN's lot back to weighing clears the close and
 * opens a weighing lot. The bound value is the farm's today. */
export const FIELD_OPEN_HBN_SQL = `AND b.field_closed_at IS NULL ${NO_FINISHED_LOT_SQL}`;

export async function listFieldHbns(db: D1Database): Promise<OpenHbnOption[]> {
  const startHour = parseFarmDayStartHour(await getConfigValue(db, CONFIG_KEYS.farm_day_start_hour)) || FARM_DAY_START_HOUR_DEFAULT;
  const result = await db
    .prepare(
      `SELECT b.id, b.hbn, b.entry_date, b.farm_code, COALESCE(s.name, '') AS strain_name
       FROM harvest_batches b
       LEFT JOIN strains s ON s.id = b.strain_id
       WHERE b.deleted_at IS NULL AND b.status = 'open' AND b.farm_code IN ('ARL', 'PNS') AND ${farmHarvestSql("b")}
       ${FIELD_OPEN_HBN_SQL}
       ORDER BY b.entry_date DESC, b.created_at DESC`
    )
    .bind(farmDay(nowIso(), startHour))
    .all<{ id: string; hbn: string; entry_date: string; farm_code: string; strain_name: string }>();
  return (result.results ?? []).map((row) => ({
    id: row.id,
    hbn: row.hbn,
    label: hbnOptionLabel(row),
  }));
}

export type FieldDestination = { code: string; display_name: string };

/** Farms that have a dry space of their own. Penn South has none, so it is not a destination. */
export async function listFieldDestinations(db: D1Database): Promise<FieldDestination[]> {
  const result = await db
    .prepare(
      `SELECT DISTINCT f.code, f.display_name
       FROM farms f
       JOIN dry_spaces d ON d.farm_code = f.code AND d.deleted_at IS NULL AND d.kind <> 'truck'
       WHERE f.deleted_at IS NULL
       ORDER BY f.display_name`
    )
    .all<FieldDestination>();
  return result.results ?? [];
}

/** Hang in Place at Penn North, the Arlington Dry Room at Arlington. */
export async function fieldHoldingSpaceId(db: D1Database, farmCode: string): Promise<string | null> {
  const name = farmCode === "PNN" ? "Hang in Place" : farmCode === "ARL" ? "Arlington Dry Room" : null;
  if (!name) return null;
  const row = await db
    .prepare(`SELECT id FROM dry_spaces WHERE deleted_at IS NULL AND farm_code = ? AND name = ?`)
    .bind(farmCode, name)
    .first<{ id: string }>();
  return row?.id ?? null;
}

export type FieldLoadRow = {
  id: string;
  operator_name: string | null;
  destination_farm_code: string;
  destination_name: string;
  status: string;
  started_at: string;
  sent_at: string | null;
  effective_date: string;
};

const FIELD_LOAD_SELECT = `SELECT l.id, l.operator_name, l.destination_farm_code, f.display_name AS destination_name,
            l.status, l.started_at, l.sent_at, l.effective_date
     FROM field_loads l
     JOIN farms f ON f.code = l.destination_farm_code`;

export async function listOpenFieldLoads(db: D1Database): Promise<FieldLoadRow[]> {
  const result = await db
    .prepare(`${FIELD_LOAD_SELECT} WHERE l.deleted_at IS NULL AND l.status = 'open' ORDER BY l.started_at DESC`)
    .all<FieldLoadRow>();
  return result.results ?? [];
}

export async function getFieldLoad(db: D1Database, id: string): Promise<FieldLoadRow | null> {
  return (
    (await db
      .prepare(`${FIELD_LOAD_SELECT} WHERE l.id = ? AND l.deleted_at IS NULL`)
      .bind(id)
      .first<FieldLoadRow>()) ?? null
  );
}

export type FieldToteRow = {
  id: string;
  weight_grams: number;
  created_at: string;
  harvest_batch_id: string;
  hbn: string;
  lot_id: string;
  lot_grams: number;
  lot_status: string;
};

/** Live totes on one load, newest first. */
export async function listFieldLoadTotes(db: D1Database, loadId: string): Promise<FieldToteRow[]> {
  const result = await db
    .prepare(
      `SELECT t.id, t.weight_grams, t.created_at, t.harvest_batch_id, b.hbn,
              w.id AS lot_id, w.weight_grams AS lot_grams, w.status AS lot_status
       FROM wet_weights t
       JOIN wet_weight_entries w ON w.id = t.wet_weight_entry_id AND w.deleted_at IS NULL
       JOIN harvest_batches b ON b.id = t.harvest_batch_id
       WHERE t.field_load_id = ? AND t.deleted_at IS NULL
       ORDER BY t.created_at DESC, t.id DESC`
    )
    .bind(loadId)
    .all<FieldToteRow>();
  return result.results ?? [];
}

export type FieldSentHbn = { hbn: string; grams: number };

export type FieldSentLoad = FieldLoadRow & {
  tote_count: number;
  grams: number;
  hbns: FieldSentHbn[];
};

/** THE IN-TRANSIT RULE (canon 0.30.320): every load still in transit, newest
 * first, however old. A received load stays in the record and is not listed. */
export async function listInTransitFieldLoads(db: D1Database): Promise<FieldSentLoad[]> {
  const loads = await db
    .prepare(
      `${FIELD_LOAD_SELECT}
       WHERE l.deleted_at IS NULL AND l.status = 'in_transit' AND l.sent_at IS NOT NULL
       ORDER BY l.sent_at DESC`
    )
    .all<FieldLoadRow>();
  const recent = loads.results ?? [];
  if (recent.length === 0) return [];
  const ids = recent.map((row) => row.id);
  const totes = await db
    .prepare(
      `SELECT t.field_load_id, t.weight_grams, b.hbn
       FROM wet_weights t
       JOIN harvest_batches b ON b.id = t.harvest_batch_id
       WHERE t.deleted_at IS NULL AND t.field_load_id IN (${ids.map(() => "?").join(", ")})`
    )
    .bind(...ids)
    .all<{ field_load_id: string; weight_grams: number; hbn: string }>();
  const byLoad = new Map<string, { grams: number; n: number; hbns: Map<string, number> }>();
  for (const tote of totes.results ?? []) {
    const cur = byLoad.get(tote.field_load_id) ?? { grams: 0, n: 0, hbns: new Map<string, number>() };
    cur.n += 1;
    cur.grams += Number(tote.weight_grams);
    cur.hbns.set(tote.hbn, (cur.hbns.get(tote.hbn) ?? 0) + Number(tote.weight_grams));
    byLoad.set(tote.field_load_id, cur);
  }
  return recent.map((row) => {
    const cur = byLoad.get(row.id);
    return {
      ...row,
      tote_count: cur?.n ?? 0,
      grams: cur?.grams ?? 0,
      hbns: [...(cur?.hbns.entries() ?? [])].map(([hbn, grams]) => ({ hbn, grams })),
    };
  });
}

export type LotSummary = {
  id: string;
  created_at: string;
  weight_grams: number;
  /** THE FOUR START TAPS (canon 0.30.89): the resume list names each lot by its Move To, truck and Team Lead. */
  truck_number?: string | null;
  dry_space_name?: string | null;
  team_lead?: string | null;
  hbn?: string | null;
};

/** Lots for one harvest batch in one status, newest first (resume links on the picked page). */
export async function listLotsByStatus(
  db: D1Database,
  harvestBatchId: string,
  status: string
): Promise<LotSummary[]> {
  const result = await db
    .prepare(
      `SELECT w.id, w.created_at, w.weight_grams, w.truck_number, d.name AS dry_space_name, w.team_lead, b.hbn
       FROM wet_weight_entries w
       LEFT JOIN dry_spaces d ON d.id = w.actual_dryspc
       JOIN harvest_batches b ON b.id = w.harvest_batch_id
       WHERE w.harvest_batch_id = ? AND w.status = ? AND w.deleted_at IS NULL
       ORDER BY w.created_at DESC`
    )
    .bind(harvestBatchId, status)
    .all<LotSummary>();
  return result.results ?? [];
}

export type LotRow = {
  id: string;
  status: string;
  notes: string | null;
  weight_grams: number;
  /** Owner ruling 2026-08-31: NULL until an unload begins; then the live total
   * of the lot's non-voided dry_weights rows. */
  dry_weight_grams: number | null;
  harvest_batch_id: string;
  hbn: string | null;
  /** Owner ruling 2026-08-31: the unload page heads with shortLotId(hbn, tag) plus the strain. */
  metrc_harvest_tag: string | null;
  strain_name: string | null;
  farm_code: string | null;
  dry_space_name: string | null;
  dry_space_kind: string | null;
  /** THE DRY SPACE TYPE (canon 0.30.106): silo, dry_room or freezer; the unload panel reads it. */
  dry_space_type: string | null;
  /** Owner ruling 2026-08-31: record-borne truck number; the lot page labels the
   * destination Truck <n> from this, never from the bare sentinel row's name. */
  truck_number: string | null;
  /** Owner ruling 2026-09-07 (canon 0.29.1): spear or bucked, set at wet
   * weigh-in. The receive mints from it; the unload derives its mode from it. */
  material_form: string | null;
  /** Canon 0.30.67: the hand-typed Team Lead (team_lead), else the retired picker's person for older lots. */
  lead_name: string | null;
  /** Canon 0.30.67: the login that started the lot, the Supervisor (created_by). */
  supervisor_name: string | null;
  /** THE PLANT COUNT (canon 0.30.62): null until typed at Finish lot, Load Silo, or by the pencil. */
  plant_count: number | null;
  created_at: string;
};

export async function getLot(db: D1Database, id: string): Promise<LotRow | null> {
  return db
    .prepare(
      `SELECT w.id, w.status, w.notes, w.weight_grams, w.dry_weight_grams, w.harvest_batch_id, w.created_at,
              b.hbn, b.metrc_harvest_tag, b.farm_code, b.entry_date, s.name AS strain_name,
              d.name AS dry_space_name, d.kind AS dry_space_kind, d.space_type AS dry_space_type,
              w.truck_number, w.material_form, COALESCE(w.team_lead, p.display_name) AS lead_name,
              COALESCE(c.email, c.display_name) AS supervisor_name, w.plant_count
       FROM wet_weight_entries w
       LEFT JOIN harvest_batches b ON b.id = w.harvest_batch_id
       LEFT JOIN strains s ON s.id = b.strain_id
       LEFT JOIN dry_spaces d ON d.id = w.actual_dryspc
       LEFT JOIN people p ON p.id = w.lead_person_id
       LEFT JOIN people c ON c.id = w.created_by
       WHERE w.id = ? AND w.deleted_at IS NULL`
    )
    .bind(id)
    .first<LotRow>();
}

export type LotWeightRow = {
  id: string;
  weight_grams: number;
  created_at: string;
  harvest_batch_id?: string | null;
  hbn?: string | null;
};

export async function listLotWeights(
  db: D1Database,
  ledger: LedgerDef,
  lotId: string
): Promise<LotWeightRow[]> {
  const sql =
    ledger.table === "wet_weights"
      ? `SELECT w.id, w.weight_grams, w.created_at, w.harvest_batch_id, b.hbn
         FROM wet_weights w
         LEFT JOIN harvest_batches b ON b.id = w.harvest_batch_id
         WHERE w.wet_weight_entry_id = ? AND w.deleted_at IS NULL
         ORDER BY w.created_at DESC`
      : `SELECT id, weight_grams, created_at FROM ${ledger.table}
         WHERE ${ledger.parentField} = ? AND deleted_at IS NULL
         ORDER BY created_at DESC`;
  const result = await db.prepare(sql).bind(lotId).all<LotWeightRow>();
  return result.results ?? [];
}

export async function countLotWeights(
  db: D1Database,
  ledger: LedgerDef,
  lotId: string
): Promise<number> {
  const row = await db
    .prepare(
      `SELECT COUNT(*) AS n FROM ${ledger.table} WHERE ${ledger.parentField} = ? AND deleted_at IS NULL`
    )
    .bind(lotId)
    .first<{ n: number }>();
  return Number(row?.n ?? 0);
}

/** The lot's ledger total column stays the live total of its non-voided ledger
 * rows: weight_grams over wet_weights (owner ruling 2026-08-28), dry_weight_grams
 * over dry_weights (owner ruling 2026-08-31). Runs inside the same db.batch as
 * the add, edit, or void it follows. */
export function lotTotalRecomputeStmt(
  db: D1Database,
  ledger: LedgerDef,
  lotId: string,
  actorId: string,
  ts: string
): D1PreparedStatement {
  return db
    .prepare(
      `UPDATE wet_weight_entries SET ${ledger.totalField} = (
         SELECT COALESCE(ROUND(SUM(weight_grams), 2), 0) FROM ${ledger.table}
         WHERE ${ledger.parentField} = ? AND deleted_at IS NULL
       ), updated_at = ?, updated_by = ?
       WHERE id = ? AND deleted_at IS NULL`
    )
    .bind(lotId, ts, actorId, lotId);
}

/** One read of the Inventory sheet. FG menu is parsed by the caller.
 * Owner ruling 2026-09-01: "Trim and BIO only." The caller fetches the raw
 * app_config extraction_type_codes value like it fetches the yield; the parsed
 * codes bound the extraction pool below. */
export async function loadInventorySheet(
  db: D1Database,
  nowIso: string,
  yieldRaw: string | null,
  extractionCodesRaw: string | null,
  fg: MetrcFgInventory | null
): Promise<InventorySheet> {
  const [
    spaces,
    dryingLots,
    unloadedLots,
    extractionPackages,
    livePackages,
    cryoPackages,
    testingPackages,
    outcomes,
  ] = await Promise.all([
    listNonTruckDrySpaces(db),
    listDryingLotsForSheet(db),
    listUnloadedLotsForSheet(db),
    listExtractionBoundPackages(db, parseExtractionCodes(extractionCodesRaw)),
    listLiveWipPackages(db),
    listWipPackagesByStatus(db, WIP_STATUS.cryo_queue),
    listWipPackagesByStatus(db, WIP_STATUS.testing_queue),
    listReleasedOutcomes(db),
  ]);
  return buildInventorySheet({
    yieldPct: projectedDryYieldPct(yieldRaw),
    nowIso,
    spaces,
    dryingLots,
    unloadedLots,
    extractionPackages,
    livePackages,
    cryoPackages,
    testingPackages,
    outcomes,
    fg,
  });
}

/** app_config values (canon L-4: values live in data). NULL when the key is absent. */
export async function getConfigValue(db: D1Database, key: string): Promise<string | null> {
  const row = await db
    .prepare(`SELECT value FROM app_config WHERE key = ? AND deleted_at IS NULL`)
    .bind(key)
    .first<{ value: string }>();
  return row?.value ?? null;
}

export async function getHarvestByHbn(
  db: D1Database,
  hbn: string
): Promise<{ id: string } | null> {
  return db
    .prepare(`SELECT id FROM harvest_batches WHERE hbn = ?`)
    .bind(hbn)
    .first<{ id: string }>();
}

/** A null harvest_file_seq reads as the load's rank by created_at, then id.
 * Voided loads count, the same order the backfill writes. */
export const HARVEST_FILE_SEQ_SQL = `COALESCE(w.harvest_file_seq, (
  SELECT COUNT(*) FROM wet_weight_entries wseq
  WHERE wseq.harvest_batch_id = w.harvest_batch_id
    AND (
      wseq.created_at < w.created_at
      OR (wseq.created_at = w.created_at AND wseq.id <= w.id)
    )
))`;

/** ONE HARVEST FILE PER LOAD (canon 0.30.249): a finished, non-voided load
 * pends its own file until its own wet_weights mark (ref_id is the load).
 * A batch-level mark (ref_id null) covers each load of that batch created
 * before the mark. An edit, an unload, or a trim does not re-pend the file. */
export const PENDING_WET_UPLOADS_SQL = `SELECT w.id, w.harvest_batch_id, b.hbn, b.harvest_year, b.lot_serial,
       ${HARVEST_FILE_SEQ_SQL} AS seq, w.weight_grams AS wet_total_grams, w.plant_count,
       w.truck_number, d.name AS space_name, w.updated_at AS newest_activity
FROM wet_weight_entries w
JOIN harvest_batches b ON b.id = w.harvest_batch_id AND b.deleted_at IS NULL
LEFT JOIN dry_spaces d ON d.id = w.actual_dryspc
WHERE w.deleted_at IS NULL AND w.status <> 'weighing'
  AND NOT EXISTS (
    SELECT 1 FROM metrc_uploads u
    WHERE u.harvest_batch_id = w.harvest_batch_id AND u.kind = 'wet_weights' AND u.deleted_at IS NULL
      AND (
        u.ref_id = w.id
        OR (u.ref_id IS NULL AND w.created_at < u.uploaded_at)
      )
  )
ORDER BY w.updated_at DESC`;

export type ImportQueueRow = {
  id: string;
  filename: string;
  kind: string;
  byte_size: number;
  status: string;
  created_at: string;
  created_by: string;
  uploaded_by: string;
};

export async function listImportQueue(db: D1Database): Promise<ImportQueueRow[]> {
  const result = await db
    .prepare(
      `SELECT q.id, q.filename, q.kind, q.byte_size, q.status, q.created_at, q.created_by,
              COALESCE(p.display_name, q.created_by) AS uploaded_by
       FROM import_queue q
       LEFT JOIN people p ON p.id = q.created_by
       WHERE q.deleted_at IS NULL
       ORDER BY q.created_at DESC`
    )
    .all<ImportQueueRow>();
  return result.results ?? [];
}

export type PendingUploadRow = {
  /** The load id; keys the download, the tags and the mark. */
  id: string;
  harvest_batch_id: string;
  hbn: string;
  seq: number;
  /** Owner terms law 2026-08-31: Lot = the YY### serial (year + sequential order). */
  lot: string;
  load_label: string;
  wet_total_grams: number;
  plant_count: number | null;
  newest_activity: string;
  tag_count: number;
  unassigned: number;
  tags_locked: boolean;
};

export type ChangedUploadRow = {
  id: string;
  hbn: string;
  seq: number;
  marked_at: string;
  then_grams: number;
  now_grams: number;
  then_count: number | null;
  now_count: number | null;
};

export async function listPendingUploads(db: D1Database): Promise<PendingUploadRow[]> {
  const result = await db.prepare(PENDING_WET_UPLOADS_SQL).all<{
    id: string;
    harvest_batch_id: string;
    hbn: string;
    harvest_year: number;
    lot_serial: number;
    seq: number | null;
    wet_total_grams: number;
    plant_count: number | null;
    truck_number: string | null;
    space_name: string | null;
    newest_activity: string;
  }>();
  const rows = result.results ?? [];
  const tagRows = await db
    .prepare(
      `SELECT wet_weight_entry_id, harvest_batch_id FROM harvest_plant_tags WHERE deleted_at IS NULL`
    )
    .all<{ wet_weight_entry_id: string | null; harvest_batch_id: string }>();
  const locked = new Set(
    (
      await db
        .prepare(`SELECT ref_id FROM metrc_uploads WHERE kind = 'wet_weights' AND deleted_at IS NULL AND ref_id IS NOT NULL`)
        .all<{ ref_id: string }>()
    ).results?.map((row) => row.ref_id) ?? []
  );
  const byLoad = new Map<string, number>();
  const unassigned = new Map<string, number>();
  for (const tag of tagRows.results ?? []) {
    if (tag.wet_weight_entry_id) byLoad.set(tag.wet_weight_entry_id, (byLoad.get(tag.wet_weight_entry_id) ?? 0) + 1);
    else unassigned.set(tag.harvest_batch_id, (unassigned.get(tag.harvest_batch_id) ?? 0) + 1);
  }
  return rows.map((row) => {
    const truck = String(row.truck_number ?? "").trim();
    return {
      id: row.id,
      harvest_batch_id: row.harvest_batch_id,
      hbn: row.hbn,
      seq: Number(row.seq ?? 1),
      lot: formatLotToken(Number(row.harvest_year), Number(row.lot_serial)),
      load_label: truck ? `Truck ${truck}` : row.space_name ?? "",
      wet_total_grams: Number(row.wet_total_grams),
      plant_count: row.plant_count == null ? null : Number(row.plant_count),
      newest_activity: row.newest_activity,
      tag_count: byLoad.get(row.id) ?? 0,
      unassigned: unassigned.get(row.harvest_batch_id) ?? 0,
      tags_locked: locked.has(row.id),
    };
  });
}

export async function listChangedAfterUpload(db: D1Database): Promise<ChangedUploadRow[]> {
  const result = await db
    .prepare(
      `SELECT w.id, b.hbn, ${HARVEST_FILE_SEQ_SQL} AS seq, w.weight_grams AS now_grams, w.plant_count AS now_count,
              u.uploaded_at AS marked_at, u.file_wet_grams AS then_grams, u.file_plant_count AS then_count
       FROM wet_weight_entries w
       JOIN harvest_batches b ON b.id = w.harvest_batch_id AND b.deleted_at IS NULL
       JOIN metrc_uploads u ON u.id = (
         SELECT u2.id FROM metrc_uploads u2
         WHERE u2.ref_id = w.id AND u2.kind = 'wet_weights' AND u2.deleted_at IS NULL AND u2.file_wet_grams IS NOT NULL
         ORDER BY u2.uploaded_at DESC LIMIT 1
       )
       WHERE w.deleted_at IS NULL
         AND (
           ABS(COALESCE(w.weight_grams, 0) - COALESCE(u.file_wet_grams, 0)) > 0.001
           OR COALESCE(w.plant_count, -1) <> COALESCE(u.file_plant_count, -1)
         )
       ORDER BY u.uploaded_at DESC`
    )
    .all<{
      id: string;
      hbn: string;
      seq: number | null;
      now_grams: number;
      now_count: number | null;
      marked_at: string;
      then_grams: number;
      then_count: number | null;
    }>();
  return (result.results ?? []).map((row) => ({
    id: row.id,
    hbn: row.hbn,
    seq: Number(row.seq ?? 1),
    marked_at: row.marked_at,
    then_grams: Number(row.then_grams),
    now_grams: Number(row.now_grams),
    then_count: row.then_count == null ? null : Number(row.then_count),
    now_count: row.now_count == null ? null : Number(row.now_count),
  }));
}

/** Owner ruling 2026-08-31: the Plant fill rule; the batch's non-voided plant
 * tags in a stable order (created_at, then tag; a replace stamps one shared
 * timestamp) so repeated downloads walk the identical sequence. */
export async function listBatchPlantTags(
  db: D1Database,
  harvestBatchId: string
): Promise<string[]> {
  const result = await db
    .prepare(
      `SELECT tag FROM harvest_plant_tags
       WHERE harvest_batch_id = ? AND deleted_at IS NULL
       ORDER BY created_at, tag`
    )
    .bind(harvestBatchId)
    .all<{ tag: string }>();
  return (result.results ?? []).map((row) => String(row.tag));
}

export type HarvestLoadRow = {
  id: string;
  harvest_batch_id: string;
  hbn: string;
  seq: number;
  weight_grams: number;
  plant_count: number | null;
  status: string;
  effective_date: string | null;
  created_at: string;
};

export async function getHarvestLoad(db: D1Database, loadId: string): Promise<HarvestLoadRow | null> {
  const row = await db
    .prepare(
      `SELECT w.id, w.harvest_batch_id, b.hbn, w.harvest_file_seq AS seq, w.weight_grams, w.plant_count,
              w.status, w.effective_date, w.created_at
       FROM wet_weight_entries w
       JOIN harvest_batches b ON b.id = w.harvest_batch_id
       WHERE w.id = ? AND w.deleted_at IS NULL`
    )
    .bind(loadId)
    .first<{
      id: string;
      harvest_batch_id: string;
      hbn: string;
      seq: number | null;
      weight_grams: number;
      plant_count: number | null;
      status: string;
      effective_date: string | null;
      created_at: string;
    }>();
  if (!row) return null;
  let seq = row.seq == null ? null : Number(row.seq);
  if (seq == null) {
    const rank = await db
      .prepare(
        `SELECT COUNT(*) AS n FROM wet_weight_entries
         WHERE harvest_batch_id = ? AND (created_at < ? OR (created_at = ? AND id <= ?))`
      )
      .bind(row.harvest_batch_id, row.created_at, row.created_at, row.id)
      .first<{ n: number }>();
    seq = Number(rank?.n ?? 1);
  }
  return {
    id: row.id,
    harvest_batch_id: row.harvest_batch_id,
    hbn: row.hbn,
    seq,
    weight_grams: Number(row.weight_grams ?? 0),
    plant_count: row.plant_count == null ? null : Number(row.plant_count),
    status: row.status,
    effective_date: row.effective_date,
    created_at: row.created_at,
  };
}

export async function listLoadPlantTags(db: D1Database, loadId: string): Promise<string[]> {
  const result = await db
    .prepare(
      `SELECT tag FROM harvest_plant_tags
       WHERE wet_weight_entry_id = ? AND deleted_at IS NULL
       ORDER BY created_at, tag`
    )
    .bind(loadId)
    .all<{ tag: string }>();
  return (result.results ?? []).map((row) => String(row.tag));
}

export async function loadHasWetMark(db: D1Database, loadId: string): Promise<boolean> {
  const row = await db
    .prepare(
      `SELECT 1 AS n FROM metrc_uploads
       WHERE ref_id = ? AND kind = 'wet_weights' AND deleted_at IS NULL LIMIT 1`
    )
    .bind(loadId)
    .first<{ n: number }>();
  return Boolean(row);
}

/** Owner ruling 2026-08-31: the wet weights file's rows, one per non-voided
 * wet_weights scale read belonging to the batch's finished (not weighing) lots,
 * ordered by created_at. Each read rides its lot's destination (a truck lot
 * renders Truck <truck_number>, never the bare sentinel name) and the lot's
 * updated_at as the provisional finish date. */
export async function listWetWeightUploadReads(
  db: D1Database,
  harvestBatchId: string,
  loadId = ""
): Promise<WetWeightsCsvRow[]> {
  const result = await db
    .prepare(
      `SELECT r.weight_grams, d.name AS dry_space_name, w.truck_number,
              b.hbn, w.updated_at AS entry_updated_at, w.effective_date, w.created_at, w.id AS entry_id, w.plant_count
       FROM wet_weights r
       JOIN wet_weight_entries w ON w.id = r.wet_weight_entry_id
       JOIN harvest_batches b ON b.id = w.harvest_batch_id
       LEFT JOIN dry_spaces d ON d.id = w.actual_dryspc
       WHERE w.harvest_batch_id = ? AND w.deleted_at IS NULL AND w.status <> 'weighing'
         AND r.deleted_at IS NULL
         AND (? = '' OR w.id = ?)
       ORDER BY r.created_at`
    )
    .bind(harvestBatchId, loadId, loadId)
    .all<WetWeightsCsvRow>();
  return result.results ?? [];
}

/** Owner ruling 2026-08-31: the Plant fill rule; the finished entries the tag
 * split distributes over, one row per non-voided finished (not weighing) lot,
 * its weight_grams the lot's wet total. Each entry rides its destination (a
 * truck lot renders Truck <truck_number>, never the bare sentinel name) and
 * its updated_at as the provisional finish date, like the read rows do. The
 * order is stable (created_at, then id) for deterministic files. */
export async function listWetWeightUploadEntries(
  db: D1Database,
  harvestBatchId: string,
  loadId = ""
): Promise<WetWeightsCsvRow[]> {
  const result = await db
    .prepare(
      `SELECT w.weight_grams, d.name AS dry_space_name, w.truck_number,
              b.hbn, w.updated_at AS entry_updated_at, w.effective_date, w.created_at, w.id AS entry_id, w.plant_count
       FROM wet_weight_entries w
       JOIN harvest_batches b ON b.id = w.harvest_batch_id
       LEFT JOIN dry_spaces d ON d.id = w.actual_dryspc
       WHERE w.harvest_batch_id = ? AND w.deleted_at IS NULL AND w.status <> 'weighing'
         AND (? = '' OR w.id = ?)
       ORDER BY w.created_at, w.id`
    )
    .bind(harvestBatchId, loadId, loadId)
    .all<WetWeightsCsvRow>();
  return result.results ?? [];
}

/** Non-truck dry spaces for the Inventory drying gauges. Trucks are Inbound. */
export async function listNonTruckDrySpaces(db: D1Database): Promise<DrySpaceRow[]> {
  const result = await db
    .prepare(
      `SELECT id, name, kind FROM dry_spaces
       WHERE deleted_at IS NULL AND kind <> 'truck'
       ORDER BY CASE kind WHEN 'silo' THEN 0 ELSE 1 END, name`
    )
    .all<DrySpaceRow>();
  return result.results ?? [];
}

/** Drying lots on non-truck spaces. Trucks never appear on the drying sheet. */
export async function listDryingLotsForSheet(db: D1Database): Promise<DryingLotRow[]> {
  const result = await db
    .prepare(
      `SELECT w.actual_dryspc AS dry_space_id, ${SHORT_LOT_ID_SQL} AS short_id,
              COALESCE(s.name, '') AS strain_name,
              w.weight_grams, w.updated_at
       FROM wet_weight_entries w
       LEFT JOIN harvest_batches b ON b.id = w.harvest_batch_id
       LEFT JOIN strains s ON s.id = b.strain_id
       JOIN dry_spaces d ON d.id = w.actual_dryspc
       WHERE w.deleted_at IS NULL AND w.status = 'drying' AND d.kind <> 'truck'
       ORDER BY d.name, w.created_at DESC`
    )
    .all<DryingLotRow>();
  return result.results ?? [];
}

export async function listUnloadedLotsForSheet(db: D1Database): Promise<UnloadedLotRow[]> {
  const result = await db
    .prepare(
      `SELECT ${SHORT_LOT_ID_SQL} AS short_id, COALESCE(s.name, '') AS strain_name,
              COALESCE(d.name, '') AS space_name, w.dry_weight_grams
       FROM wet_weight_entries w
       LEFT JOIN harvest_batches b ON b.id = w.harvest_batch_id
       LEFT JOIN strains s ON s.id = b.strain_id
       LEFT JOIN dry_spaces d ON d.id = w.actual_dryspc
       WHERE w.deleted_at IS NULL AND w.status = 'unloaded'
       ORDER BY w.created_at DESC`
    )
    .all<UnloadedLotRow>();
  return result.results ?? [];
}

// Canon 0.30.9: from Trim forward the strain shown is the market strain.
const WIP_SHEET_SELECT = `SELECT p.package_code, ${SHORT_LOT_ID_SQL} AS short_id,
              COALESCE(b.market_strain, s.name, '') AS strain_name, p.weight_grams
       FROM wip_packages p
       LEFT JOIN wet_weight_entries w ON w.id = p.wet_weight_entry_id
       LEFT JOIN harvest_batches b ON b.id = w.harvest_batch_id
       LEFT JOIN strains s ON s.id = b.strain_id`;

export type TrimPackageRow = {
  id: string;
  package_code: string;
  package_type_code: string;
  weight_grams: number;
  status: string;
  trim_date: string | null;
  trim_operator: string | null;
  created_at: string;
};

/** Owner ruling 2026-09-08 (canon 0.30.9, verbatim: "Trim packages entry
 * should show the entered packages below the working pane, ordered by latest
 * to oldest"): the lot's live packages, newest first. */
export async function listLotTrimPackages(db: D1Database, lotId: string): Promise<TrimPackageRow[]> {
  const result = await db
    .prepare(
      `SELECT p.id, p.package_code, p.package_type_code, p.weight_grams, p.status,
              p.trim_date, p.trim_operator, p.created_at
       FROM wip_packages p
       WHERE p.wet_weight_entry_id = ? AND p.deleted_at IS NULL
       ORDER BY p.created_at DESC, p.package_code DESC`
    )
    .bind(lotId)
    .all<TrimPackageRow>();
  return result.results ?? [];
}

/** Owner ruling 2026-09-01, verbatim: "Trim and BIO only." Extraction-bound =
 * wip_packages in status created whose package_type_code is in the configured
 * list (app_config extraction_type_codes, seeded TRIM,BIO). This replaces the
 * old t.is_bud = 0 mapping, which wrongly swept SMALLS and WASTE in. One bound
 * placeholder per code; the codes never interpolate into the SQL. */
export function extractionBoundSql(codeCount: number): string {
  const placeholders = Array.from({ length: codeCount }, () => "?").join(", ");
  return `${WIP_SHEET_SELECT}
       WHERE p.deleted_at IS NULL AND p.status = 'created'
         AND p.package_type_code IN (${placeholders})
       ORDER BY p.created_at DESC`;
}

export async function listExtractionBoundPackages(
  db: D1Database,
  codes: readonly string[]
): Promise<SheetPkgRow[]> {
  const result = await db
    .prepare(extractionBoundSql(codes.length))
    .bind(...codes)
    .all<SheetPkgRow>();
  return result.results ?? [];
}

/** Live = non-voided and not released. */
export async function listLiveWipPackages(db: D1Database): Promise<SheetPkgRow[]> {
  // THE CRYO RUN (canon 0.30.110): a pasteurized trim container is archival,
  // its grams live on in the run's outputs; it is no longer material here.
  const result = await db
    .prepare(
      `${WIP_SHEET_SELECT}
       WHERE p.deleted_at IS NULL AND p.status <> 'released' AND p.status <> '${WIP_STATUS.pasteurized}' AND p.status <> '${WIP_STATUS.gone}' AND p.status <> '${WIP_STATUS.packed}'
       ORDER BY p.created_at DESC`
    )
    .all<SheetPkgRow>();
  return result.results ?? [];
}

export async function listWipPackagesByStatus(
  db: D1Database,
  status: string
): Promise<SheetPkgRow[]> {
  const result = await db
    .prepare(
      `${WIP_SHEET_SELECT}
       WHERE p.deleted_at IS NULL AND p.status = ?
       ORDER BY p.created_at DESC`
    )
    .bind(status)
    .all<SheetPkgRow>();
  return result.results ?? [];
}

export async function listReleasedOutcomes(db: D1Database): Promise<OutcomeRow[]> {
  const result = await db
    .prepare(
      `SELECT test_outcome FROM wip_packages
       WHERE deleted_at IS NULL AND status = 'released'
         AND test_outcome IS NOT NULL AND trim(test_outcome) <> ''
       ORDER BY created_at DESC`
    )
    .all<OutcomeRow>();
  return result.results ?? [];
}

/** Open batches with zero non-voided wet_weight_entries, newest first. */
export async function listRecallableBatches(db: D1Database): Promise<RecallableBatch[]> {
  const result = await db
    .prepare(
      `SELECT b.id, b.hbn, b.entry_date, b.farm_code, b.grow_method_code, b.strain_id,
              b.manicure, b.planned_dryspc, b.start_time, b.zone, b.rows_text,
              b.metrc_harvest_tag, b.license_value
       FROM harvest_batches b
       WHERE b.deleted_at IS NULL AND b.status = 'open' AND ${farmHarvestSql("b")}
         AND NOT EXISTS (
           SELECT 1 FROM wet_weight_entries w
           WHERE w.harvest_batch_id = b.id AND w.deleted_at IS NULL
         )
       ORDER BY b.created_at DESC`
    )
    .all<RecallableBatch>();
  return result.results ?? [];
}

/** Owner ruling 2026-08-31: "The weights of the original package and what's
 * left after a record is created should be on the weight recording pages."
 * The trim picked view's Recorded line: the sum of the lot's existing
 * non-voided wip_packages weights, 2-decimal like the lot total recompute. */
export async function sumLotPackageGrams(db: D1Database, lotId: string): Promise<number> {
  const row = await db
    .prepare(
      `SELECT COALESCE(ROUND(SUM(weight_grams), 2), 0) AS total FROM wip_packages
       WHERE wet_weight_entry_id = ? AND deleted_at IS NULL`
    )
    .bind(lotId)
    .first<{ total: number }>();
  return Number(row?.total ?? 0);
}

export async function getRow(
  db: D1Database,
  table: string,
  id: string
): Promise<Record<string, unknown> | null> {
  assertTable(table);
  if (table === "package_types") {
    return db
      .prepare(`SELECT * FROM package_types WHERE code = ?`)
      .bind(id)
      .first<Record<string, unknown>>();
  }
  if (table === "farms" || table === "grow_methods") {
    return db
      .prepare(`SELECT * FROM ${table} WHERE code = ?`)
      .bind(id)
      .first<Record<string, unknown>>();
  }
  // Owner ruling 2026-09-01: app_config rides the reasoned edit path, keyed by
  // its config key like the code tables are keyed by code.
  if (table === "app_config") {
    return db
      .prepare(`SELECT * FROM app_config WHERE key = ?`)
      .bind(id)
      .first<Record<string, unknown>>();
  }
  return db.prepare(`SELECT * FROM ${table} WHERE id = ?`).bind(id).first<Record<string, unknown>>();
}

export async function listTable(
  db: D1Database,
  table: string
): Promise<Record<string, unknown>[]> {
  assertTable(table);
  if (table === "record_change_log") {
    const result = await db
      .prepare(`SELECT * FROM record_change_log ORDER BY changed_at DESC`)
      .all<Record<string, unknown>>();
    return result.results ?? [];
  }
  const result = await db
    .prepare(`SELECT * FROM ${table} WHERE deleted_at IS NULL ORDER BY created_at DESC`)
    .all<Record<string, unknown>>();
  return result.results ?? [];
}

export async function listChangeLog(
  db: D1Database,
  limit = 200
): Promise<Record<string, unknown>[]> {
  const result = await db
    .prepare(
      `SELECT l.*, p.display_name AS actor_name
       FROM record_change_log l
       LEFT JOIN people p ON p.id = l.actor_person_id
       ORDER BY l.changed_at DESC
       LIMIT ?`
    )
    .bind(limit)
    .all<Record<string, unknown>>();
  return result.results ?? [];
}

export async function listAdminRows(
  db: D1Database,
  table: "people" | "farms" | "grow_methods" | "strains" | "dry_spaces" | "package_types" | "app_config"
): Promise<Record<string, unknown>[]> {
  // Owner ruling 2026-09-01: the App config section on Lookups lists the
  // standing keys (key, value, updated_at) with the Edit control only.
  if (table === "app_config") {
    const result = await db
      .prepare(
        `SELECT key AS id, key, value, updated_at FROM app_config WHERE deleted_at IS NULL ORDER BY key`
      )
      .all<Record<string, unknown>>();
    return result.results ?? [];
  }
  if (table === "farms") {
    const result = await db
      .prepare(
        `SELECT code AS id, code, display_name, created_at FROM farms WHERE deleted_at IS NULL ORDER BY code`
      )
      .all<Record<string, unknown>>();
    return result.results ?? [];
  }
  if (table === "grow_methods") {
    const result = await db
      .prepare(
        `SELECT code AS id, code, display_name, hbn_code, created_at FROM grow_methods WHERE deleted_at IS NULL ORDER BY code`
      )
      .all<Record<string, unknown>>();
    return result.results ?? [];
  }
  if (table === "people") {
    const result = await db
      .prepare(
        `SELECT id, display_name, email, phone, is_active, created_at FROM people WHERE deleted_at IS NULL ORDER BY display_name`
      )
      .all<Record<string, unknown>>();
    return result.results ?? [];
  }
  if (table === "strains") {
    const result = await db
      .prepare(
        `SELECT id, name, abbr, hbn_code, created_at FROM strains WHERE deleted_at IS NULL ORDER BY name`
      )
      .all<Record<string, unknown>>();
    return result.results ?? [];
  }
  if (table === "dry_spaces") {
    // THE DRY SPACE TYPE (canon 0.30.106): the lookup lists the type, the capacity and its unit.
    const result = await db
      .prepare(
        `SELECT id, name, space_type, capacity, capacity_uom, kind, farm_code, created_at
         FROM dry_spaces WHERE deleted_at IS NULL ORDER BY name`
      )
      .all<Record<string, unknown>>();
    return result.results ?? [];
  }
  const result = await db
    .prepare(
      `SELECT code AS id, code, display_name, is_bud, created_at FROM package_types WHERE deleted_at IS NULL ORDER BY code`
    )
    .all<Record<string, unknown>>();
  return result.results ?? [];
}

const ALLOWED_TABLES = new Set([
  "farms",
  "grow_methods",
  "strains",
  "dry_spaces",
  "package_types",
  "people",
  "harvest_batches",
  "wet_weight_entries",
  "wet_weights",
  "dry_weights",
  "wip_packages",
  "record_change_log",
  // Owner ruling 2026-09-01: standing config keys edit with a reason on the
  // record path; voidRecord refuses the table outright.
  "app_config",
  // Owner ruling 2026-09-02: Import Data queue; reasoned void, no Edit.
  "import_queue",
  "lookup_values",
  "local_inventory_items",
  "interco_movements",
  "interco_movement_items",
  "interco_receipts",
  "unload_sessions",
  "metrc_uploads",
  "audits",
  "audit_notes",
  "internal_test_results",
  "external_test_results",
  "label_templates",
  "suppliers",
  "purchase_orders",
  "purchase_order_lines",
  "listings",
  "sales_orders",
  "sales_order_lines",
  // Canon 0.30.6: the Load Silo station's load records (reasoned pencil).
  "silo_loads",
]);

export function assertTable(table: string): void {
  if (!ALLOWED_TABLES.has(table)) {
    throw new HttpError(404, `Unknown table: ${table}`);
  }
}

export type LocalInventoryListRow = {
  id: string;
  item_kind: string;
  package_code: string;
  /** THE TAG LAW (canon 0.30.38): the METRC package tag when captured. */
  metrc_tag?: string | null;
  harvest_batch_id: string | null;
  wet_weight_entry_id: string | null;
  strain_id: string | null;
  strain_name: string | null;
  qty: number;
  uom: string;
  farm_code: string;
  farm_name: string | null;
  license_value: string;
  location: string;
  location_label: string | null;
  parent_item_id?: string | null;
  created_at: string;
  hbn?: string | null;
};

export async function listLocalInventory(
  db: D1Database,
  filters: { item_kind?: string; farm?: string; location?: string; strain?: string } = {}
): Promise<LocalInventoryListRow[]> {
  const clauses = ["i.deleted_at IS NULL"];
  const binds: unknown[] = [];
  if (filters.item_kind) {
    clauses.push("i.item_kind = ?");
    binds.push(filters.item_kind);
  }
  if (filters.farm) {
    clauses.push("i.farm_code = ?");
    binds.push(filters.farm);
  }
  if (filters.location) {
    clauses.push("i.location = ?");
    binds.push(filters.location);
  }
  if (filters.strain) {
    clauses.push("i.strain_id = ?");
    binds.push(filters.strain);
  }
  const result = await db
    .prepare(
      `SELECT i.id, i.item_kind, i.package_code, i.harvest_batch_id, i.wet_weight_entry_id,
              i.strain_id, COALESCE(hb.market_strain, s.name) AS strain_name, i.qty, i.uom, i.farm_code,
              f.display_name AS farm_name, i.license_value, i.location, i.metrc_tag,
              COALESCE(lv.label, f2.display_name, i.location) AS location_label,
              i.parent_item_id, i.created_at, hb.hbn
       FROM local_inventory_items i
       LEFT JOIN strains s ON s.id = i.strain_id
       LEFT JOIN harvest_batches hb ON hb.id = i.harvest_batch_id
       LEFT JOIN farms f ON f.code = i.farm_code
       LEFT JOIN lookup_values lv
         ON lv.category = 'inventory_location' AND lv.value = i.location AND lv.deleted_at IS NULL
       LEFT JOIN farms f2 ON f2.code = i.location AND f2.deleted_at IS NULL
       WHERE ${clauses.join(" AND ")}
       ORDER BY ${itemKindOrderSql("i")}, i.created_at DESC`
    )
    .bind(...binds)
    .all<LocalInventoryListRow>();
  return result.results ?? [];
}

export async function getInventoryItemForLot(
  db: D1Database,
  wetWeightEntryId: string
): Promise<{
  id: string;
  qty: number;
  package_code: string;
  metrc_tag: string | null;
  location: string;
  item_kind: string;
  farm_code: string;
} | null> {
  return db
    .prepare(
      `SELECT id, qty, package_code, metrc_tag, location, item_kind, farm_code
       FROM local_inventory_items
       WHERE wet_weight_entry_id = ? AND deleted_at IS NULL
       ORDER BY created_at ASC
       LIMIT 1`
    )
    .bind(wetWeightEntryId)
    .first();
}

/** THE TAG LAW (canon 0.30.38): the bucked child a lot's unload minted (its code
 * ends -B, canon 0.28.8), so the Packages from Harvests file can print the
 * child's METRC tag once the crew has typed it. */
export async function getBuckedChildForLot(
  db: D1Database,
  wetWeightEntryId: string
): Promise<{ id: string; package_code: string; metrc_tag: string | null } | null> {
  return db
    .prepare(
      `SELECT id, package_code, metrc_tag
       FROM local_inventory_items
       WHERE wet_weight_entry_id = ? AND deleted_at IS NULL AND package_code LIKE '%-B'
       ORDER BY created_at DESC
       LIMIT 1`
    )
    .bind(wetWeightEntryId)
    .first();
}

export async function listLookupValueRows(
  db: D1Database,
  category: string
): Promise<Record<string, unknown>[]> {
  const result = await db
    .prepare(
      `SELECT id, category, value, label, tone, farm_code, license_value, sort_order, created_at
       FROM lookup_values WHERE category = ? AND deleted_at IS NULL
       ORDER BY sort_order, value`
    )
    .bind(category)
    .all<Record<string, unknown>>();
  return result.results ?? [];
}

export async function lookupValueReferenced(
  db: D1Database,
  category: string,
  value: string
): Promise<boolean> {
  if (category === "silo_number") {
    const row = await db
      .prepare(
        `SELECT id FROM harvest_batches WHERE planned_dryspc = ? AND deleted_at IS NULL LIMIT 1`
      )
      .bind(value)
      .first();
    return Boolean(row);
  }
  if (category === "inventory_location") {
    const row = await db
      .prepare(
        `SELECT id FROM local_inventory_items WHERE location = ? AND deleted_at IS NULL LIMIT 1`
      )
      .bind(value)
      .first();
    return Boolean(row);
  }
  if (category === "license") {
    const inv = await db
      .prepare(
        `SELECT id FROM local_inventory_items WHERE license_value = ? AND deleted_at IS NULL LIMIT 1`
      )
      .bind(value)
      .first();
    if (inv) return true;
    const batch = await db
      .prepare(
        `SELECT id FROM harvest_batches WHERE license_value = ? AND deleted_at IS NULL LIMIT 1`
      )
      .bind(value)
      .first();
    if (batch) return true;
    const mv = await db
      .prepare(
        `SELECT id FROM interco_movements
         WHERE (origin_license = ? OR destination_license = ?) AND deleted_at IS NULL LIMIT 1`
      )
      .bind(value, value)
      .first();
    return Boolean(mv);
  }
  if (category === "item_kind") {
    const row = await db
      .prepare(
        `SELECT id FROM local_inventory_items WHERE item_kind = ? AND deleted_at IS NULL LIMIT 1`
      )
      .bind(value)
      .first();
    return Boolean(row);
  }
  return false;
}

export async function listOutboundInventory(db: D1Database): Promise<LocalInventoryListRow[]> {
  const result = await db
    .prepare(
      `SELECT i.id, i.item_kind, i.package_code, i.harvest_batch_id, i.wet_weight_entry_id,
              i.strain_id, COALESCE(hb.market_strain, s.name) AS strain_name, i.qty, i.uom, i.farm_code,
              f.display_name AS farm_name, i.license_value, i.location, i.metrc_tag,
              COALESCE(lv.label, f2.display_name, i.location) AS location_label,
              i.created_at
       FROM local_inventory_items i
       LEFT JOIN strains s ON s.id = i.strain_id
       LEFT JOIN harvest_batches hb ON hb.id = i.harvest_batch_id
       LEFT JOIN farms f ON f.code = i.farm_code
       LEFT JOIN lookup_values lv
         ON lv.category = 'inventory_location' AND lv.value = i.location AND lv.deleted_at IS NULL
       LEFT JOIN farms f2 ON f2.code = i.location AND f2.deleted_at IS NULL
       WHERE i.deleted_at IS NULL
         AND i.item_kind IN ('SPR', 'WIP')
         AND i.location <> 'IN-TRANSIT'
         AND NOT EXISTS (
           SELECT 1 FROM interco_movement_items mi
           JOIN interco_movements m ON m.id = mi.movement_id
           WHERE mi.local_inventory_item_id = i.id
             AND mi.deleted_at IS NULL
             AND m.deleted_at IS NULL
             AND m.status = 'building'
         )
       ORDER BY i.farm_code, ${itemKindOrderSql("i")}, i.created_at DESC`
    )
    .all<LocalInventoryListRow>();
  return result.results ?? [];
}

const INTERCO_MOVEMENT_COLS = `id, movement_kind, origin_farm, destination_farm, origin_license, destination_license,
              truck_number, driver, planned_route, transfer_type, invoice_number, payment_term_days,
              planned_departure, planned_arrival, gross_weight, gross_weight_uom,
              transporter_license, transporter_phone, driver_occupational_license, driver_license_number,
              vehicle_make, vehicle_model, vehicle_plate, metrc_manifest_number, status, exported_at, completed_at, created_at,
              origin_location, destination_location`;

export type IntercoMovementRow = {
  id: string;
  movement_kind: string;
  origin_farm: string | null;
  destination_farm: string | null;
  origin_license: string;
  destination_license: string;
  truck_number: string | null;
  driver: string | null;
  planned_route: string | null;
  transfer_type: string | null;
  invoice_number: string | null;
  payment_term_days: string | null;
  planned_departure: string | null;
  planned_arrival: string | null;
  gross_weight: string | null;
  gross_weight_uom: string | null;
  transporter_license: string | null;
  transporter_phone: string | null;
  driver_occupational_license: string | null;
  driver_license_number: string | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  vehicle_plate: string | null;
  metrc_manifest_number: string | null;
  status: string;
  exported_at: string | null;
  completed_at: string | null;
  created_at: string;
  origin_location?: string | null;
  destination_location?: string | null;
  item_count?: number;
};

export async function getMovement(db: D1Database, id: string): Promise<IntercoMovementRow | null> {
  return db
    .prepare(
      `SELECT ${INTERCO_MOVEMENT_COLS}
       FROM interco_movements WHERE id = ? AND deleted_at IS NULL`
    )
    .bind(id)
    .first<IntercoMovementRow>();
}

export type IntercoMovementItemRow = {
  id: string;
  movement_id: string;
  local_inventory_item_id: string;
  qty: number;
  uom: string;
  received_qty: number | null;
  received_at: string | null;
  received_by: string | null;
  receipt_id: string | null;
  rejected_at: string | null;
  rejected_by: string | null;
  reject_reason: string | null;
  package_code: string;
  /** THE TAG LAW (canon 0.30.38): the package's METRC tag when the ledger holds
   * one; the manifest and receive files print it in place of the code. THE
   * MANIFEST BUILDER (canon 0.30.125): a mirror-born item carries its own tag
   * (interco_movement_items.metrc_tag) and no ledger item behind it. */
  metrc_tag?: string | null;
  /** THE MANIFEST BUILDER: the wholesale price typed beside the package, if any. */
  wholesale_price?: string | null;
  item_kind: string;
  strain_name: string | null;
  location: string;
  farm_code: string;
  harvest_batch_id: string | null;
  hbn?: string | null;
  is_wet_lot?: number;
  /** Canon 0.30.9: the wet lot this item carries (the born package's lot, or
   * the WET item's own id), so a receipt can flip a truck lot off the road. */
  lot_id?: string | null;
};

export async function listMovementItems(
  db: D1Database,
  movementId: string
): Promise<IntercoMovementItemRow[]> {
  const result = await db
    .prepare(
      `SELECT mi.id, mi.movement_id, mi.local_inventory_item_id, mi.qty, mi.uom,
              mi.received_qty, mi.received_at, mi.received_by, mi.receipt_id, mi.rejected_at, mi.rejected_by,
              mi.reject_reason,
              COALESCE(i.package_code, mi.metrc_tag, '') AS package_code,
              COALESCE(mi.metrc_tag, i.metrc_tag) AS metrc_tag,
              mi.wholesale_price,
              COALESCE(i.item_kind, CASE WHEN mi.metrc_tag IS NULL THEN 'WET' ELSE 'METRC' END) AS item_kind,
              COALESCE(hb.market_strain, s.name, lot_b.market_strain, lot_s.name) AS strain_name,
              COALESCE(i.location, '') AS location,
              COALESCE(i.farm_code, lot_b.farm_code, '') AS farm_code,
              COALESCE(i.harvest_batch_id, lot_b.id) AS harvest_batch_id,
              COALESCE(hb.hbn, lot_b.hbn) AS hbn,
              CASE WHEN i.id IS NULL THEN 1 ELSE 0 END AS is_wet_lot,
              COALESCE(i.wet_weight_entry_id, w.id) AS lot_id
       FROM interco_movement_items mi
       LEFT JOIN local_inventory_items i ON i.id = mi.local_inventory_item_id
       LEFT JOIN strains s ON s.id = i.strain_id
       LEFT JOIN harvest_batches hb ON hb.id = i.harvest_batch_id
       LEFT JOIN wet_weight_entries w ON w.id = mi.local_inventory_item_id
       LEFT JOIN harvest_batches lot_b ON lot_b.id = w.harvest_batch_id
       LEFT JOIN strains lot_s ON lot_s.id = lot_b.strain_id
       WHERE mi.movement_id = ? AND mi.deleted_at IS NULL
       ORDER BY COALESCE(i.package_code, lot_b.hbn, mi.metrc_tag, mi.created_at), mi.created_at`
    )
    .bind(movementId)
    .all<IntercoMovementItemRow>();
  return result.results ?? [];
}

/** Owner ruling 2026-09-06 (canon 0.27.0): the Inventory by Location report:
 * "totals be product type, grouped by location grouped by farm", and locations
 * "visible only if there's material in them" (the HAVING clause and the fold's
 * zero drop). The farm is the location's Admin assignment when set (0029), else
 * the material's own farm; in-transit rows therefore ride under their origin
 * farm at IN-TRANSIT.
 *
 * Owner report 2026-09-06 (canon 0.27.2, "confusion illustrated"): wet lots ARE
 * material, and the report must agree with the interco floor. Pre-ledger lot
 * material folds in as WET rows: weighing lots sit in their site barn,
 * in-transit lots ride IN-TRANSIT under their origin farm. From finish onward
 * the ledger carries the lot (hang mints SPR, silo mints WIP, a truck mints
 * nothing until receipt), so only weighing and in-transit lots fold. */
/** Owner ruling 2026-09-09 (canon 0.30.23, verbatim: "the origin farm is
 * listed as farm in the report.  The current farm should be the header the
 * list is sitting under.  I'm good with the farm of origin on the report"):
 * site is WHERE the material sits now (the header); farm is where it came
 * from (a column). Silo 1 at PNN holding an ARL lot reads PNN / Silo 1 / ARL. */
export type InventoryByLocationRow = {
  site: string;
  farm: string;
  location: string;
  item_kind: string;
  uom: string;
  total: number;
};

/** The site a location sits at: the code's side convention first (BARN, CSA,
 * the silos, the site barns, CSB), then the Admin inventory_location farm,
 * then a dry space's farm scope, then IN-TRANSIT for the road; blank when
 * nobody has placed the location (it shows as unassigned, never as the
 * material's origin). */
export function siteForLocation(
  location: string,
  locationFarms: Map<string, string>,
  drySpaceFarms: Map<string, string> = new Map()
): string {
  const known = SITE_OF_LOCATION[location];
  if (known) return known;
  const lookup = locationFarms.get(location);
  if (lookup) return lookup;
  const dry = drySpaceFarms.get(location);
  if (dry) return dry;
  if (location === LOC_IN_TRANSIT) return LOC_IN_TRANSIT;
  return "";
}

export type WetLotMaterialRow = {
  status: string;
  farm_code: string | null;
  weight_grams: number;
  /** Canon 0.30.69: the lot's Move To, so a lot weighing into a silo reads under that silo (filling), live. */
  dry_space_name?: string | null;
  dry_space_kind?: string | null;
};


/** Weighing and in-transit wet lots, the two lot states the ledger cannot see.
 * The NOT EXISTS guard keeps a lot from ever counting twice should a minted
 * lot find its way back into either status. */
export async function listWetLotMaterial(db: D1Database): Promise<WetLotMaterialRow[]> {
  const result = await db
    .prepare(
      `SELECT w.status AS status, b.farm_code AS farm_code, w.weight_grams AS weight_grams,
              d.name AS dry_space_name, d.kind AS dry_space_kind
       FROM wet_weight_entries w
       LEFT JOIN harvest_batches b ON b.id = w.harvest_batch_id
       LEFT JOIN dry_spaces d ON d.id = w.actual_dryspc AND d.deleted_at IS NULL
       WHERE w.deleted_at IS NULL
         AND w.status IN ('${LOT_STATUS.weighing}', '${LOT_STATUS.in_transit}')
         AND NOT EXISTS (
           SELECT 1 FROM local_inventory_items li
           WHERE li.wet_weight_entry_id = w.id AND li.deleted_at IS NULL
         )`
    )
    .all<WetLotMaterialRow>();
  return result.results ?? [];
}

/** Pure fold: wet-lot material joins the ledger rows under the same laws.
 * Location: the site barn for a weighing lot (barn = universal inbox; an
 * unknown batch farm defaults to BARN), IN-TRANSIT for the road. Farm: the
 * location's Admin assignment when set, else the lot's batch farm. Visibility:
 * zero totals drop, exactly the ledger arm's HAVING SUM <> 0.
 * THE SILO SHAPE AND THE LIVE WET WEIGHT (canon 0.30.69; owner: "Live inventory
 * on all screens, including the Inventory by Location report"): a lot weighing
 * INTO a silo (the wet weight screen filling it) reads under that silo, not the
 * barn, as it fills; and every silo location with material closes with a Wet
 * total row, the silo's wet weight at the bottom of its rows. */
export function foldWetLotsIntoLocationRows(
  ledger: InventoryByLocationRow[],
  lots: WetLotMaterialRow[],
  locationFarms: Map<string, string>,
  drySpaceFarms: Map<string, string> = new Map(),
  siloNames: Set<string> = new Set()
): InventoryByLocationRow[] {
  const groups = new Map<string, InventoryByLocationRow>();
  for (const lot of lots) {
    const batchFarm = lot.farm_code ?? "";
    const fillingSilo = lot.status === LOT_STATUS.weighing && lot.dry_space_kind === "silo" && lot.dry_space_name ? lot.dry_space_name : null;
    const location =
      lot.status === LOT_STATUS.in_transit
        ? LOC_IN_TRANSIT
        : fillingSilo ?? barnLocationForSite(batchFarm === "ARL" || batchFarm === "PNS" ? batchFarm : "PNN");
    // Canon 0.30.23: the site is where the lot sits (its barn, or the road);
    // the farm is the batch's origin, kept as a column.
    const site = siteForLocation(location, locationFarms, drySpaceFarms);
    const key = `${site}\u0000${batchFarm}\u0000${location}`;
    const row =
      groups.get(key) ?? { site, farm: batchFarm, location, item_kind: ITEM_KIND_WET, uom: "g", total: 0 };
    row.total += Number(lot.weight_grams);
    groups.set(key, row);
  }
  const wetRows = [...groups.values()]
    .map((r) => ({ ...r, total: roundGrams(r.total) }))
    .filter((r) => r.total !== 0);
  const merged = [...ledger, ...wetRows];
  merged.sort((a, b) => {
    if (a.site !== b.site) return a.site < b.site ? -1 : 1;
    if (a.location !== b.location) return a.location < b.location ? -1 : 1;
    if (a.farm !== b.farm) return a.farm < b.farm ? -1 : 1;
    if (a.item_kind !== b.item_kind) return a.item_kind < b.item_kind ? -1 : 1;
    return 0;
  });
  if (siloNames.size === 0) return merged;
  // The Wet total row closes each silo's run of rows (the rows are sorted by
  // site then location, so a silo's rows are contiguous).
  const out: InventoryByLocationRow[] = [];
  for (let i = 0; i < merged.length; i++) {
    const row = merged[i];
    out.push(row);
    const next = merged[i + 1];
    const runEnds = !next || next.site !== row.site || next.location !== row.location;
    if (runEnds && siloNames.has(row.location)) {
      let total = 0;
      for (let j = i; j >= 0 && merged[j].site === row.site && merged[j].location === row.location; j--) total += Number(merged[j].total);
      out.push({ site: row.site, farm: "", location: row.location, item_kind: ITEM_KIND_WET_TOTAL, uom: "g", total: roundGrams(total) });
    }
  }
  return out;
}

export async function listInventoryByLocation(db: D1Database): Promise<InventoryByLocationRow[]> {
  // Canon 0.30.23: grouped by the item's ORIGIN farm and its location; the
  // site (the header) is resolved in code from the location.
  const ledger = await db
    .prepare(
      `SELECT COALESCE(i.farm_code, '') AS farm,
              i.location AS location,
              i.item_kind AS item_kind,
              i.uom AS uom,
              SUM(i.qty) AS total
       FROM local_inventory_items i
       WHERE i.deleted_at IS NULL
       GROUP BY COALESCE(i.farm_code, ''), i.location, i.item_kind, i.uom
       HAVING SUM(i.qty) <> 0
       ORDER BY location, farm, item_kind`
    )
    .all<Omit<InventoryByLocationRow, "site">>();
  const lots = await listWetLotMaterial(db);
  const [farms, drySpaces] = await Promise.all([
    db
      .prepare(
        `SELECT value, farm_code FROM lookup_values
         WHERE category = 'inventory_location' AND deleted_at IS NULL AND farm_code IS NOT NULL`
      )
      .all<{ value: string; farm_code: string }>(),
    db
      .prepare(`SELECT name, kind, farm_code FROM dry_spaces WHERE deleted_at IS NULL`)
      .all<{ name: string; kind: string; farm_code: string | null }>(),
  ]);
  const locationFarms = new Map((farms.results ?? []).map((r) => [r.value, r.farm_code]));
  const drySpaceFarms = new Map(
    (drySpaces.results ?? []).filter((r): r is { name: string; kind: string; farm_code: string } => !!r.farm_code).map((r) => [r.name, r.farm_code])
  );
  const siloNames = new Set((drySpaces.results ?? []).filter((r) => r.kind === "silo").map((r) => r.name));
  const placed = (ledger.results ?? []).map((r) => ({
    ...r,
    site: siteForLocation(r.location, locationFarms, drySpaceFarms),
  }));
  return foldWetLotsIntoLocationRows(placed, lots, locationFarms, drySpaceFarms, siloNames);
}

/** Owner ruling 2026-09-06 (canon 0.26.0): logistics moves join the Admin Data
 * Queues. One row per non-deleted movement, newest first, with item and
 * received counts so the queue can offer or refuse the reasoned void. */
export type MovementQueueRow = {
  id: string;
  created_at: string;
  movement_kind: string;
  origin_farm: string | null;
  destination_farm: string | null;
  origin_license: string;
  destination_license: string;
  truck_number: string | null;
  status: string;
  item_count: number;
  received_count: number;
};

export async function listMovementQueueRows(db: D1Database): Promise<MovementQueueRow[]> {
  const result = await db
    .prepare(
      `SELECT m.id, m.created_at, m.movement_kind, m.origin_farm, m.destination_farm,
              m.origin_license, m.destination_license, m.truck_number, m.status,
              (SELECT count(*) FROM interco_movement_items i
                WHERE i.movement_id = m.id AND i.deleted_at IS NULL) AS item_count,
              (SELECT count(*) FROM interco_movement_items i
                WHERE i.movement_id = m.id AND i.deleted_at IS NULL AND i.received_at IS NOT NULL) AS received_count
       FROM interco_movements m
       WHERE m.deleted_at IS NULL
       ORDER BY m.created_at DESC`
    )
    .all<MovementQueueRow>();
  return result.results ?? [];
}

export type InboundTruckLot = {
  id: string;
  truck_number: string | null;
  weight_grams: number;
  farm_code: string | null;
  entry_date: string | null;
  strain_name: string | null;
  hbn: string | null;
  created_at: string;
  license_value?: string | null;
  /** Owner ruling 2026-09-07 (canon 0.29.1): the receive stops asking; the
   * arrivals line shows the lot's form set at wet weigh-in. */
  material_form?: string | null;
  /** Owner bug report 2026-09-08 (canon 0.30.9, "589af120 is an orphan"): THE
   * TRUCK CARRIES ITS PAPER. The open manifest riding this lot (through its
   * born package or as a WET item), so the truck row can name it and the
   * manifest never lists on its own. */
  manifest_id?: string | null;
  metrc_manifest_number?: string | null;
};

/** The open interco manifest carrying a lot, matched through the lot's born
 * package (li.wet_weight_entry_id) or the WET item that IS the lot id. Written
 * against the w alias of wet_weight_entries. */
const RIDING_MANIFEST_MATCH = `
  FROM interco_movements m
  JOIN interco_movement_items mi ON mi.movement_id = m.id
  LEFT JOIN local_inventory_items li ON li.id = mi.local_inventory_item_id
  WHERE m.deleted_at IS NULL AND m.status = 'completed' AND m.movement_kind = 'interco'
    AND mi.deleted_at IS NULL AND mi.receipt_id IS NULL AND mi.rejected_at IS NULL
    AND COALESCE(li.wet_weight_entry_id, mi.local_inventory_item_id) = w.id`;

/** Owner bug report 2026-09-04 (canon 0.22.0): a finished wet truck lot IS
 * inbound to the crew. The interco rework lists them on the floor road strip
 * and on each site's arrivals page. Canon 0.30.9: each row carries its open
 * manifest, the newest when a lot somehow has two. */
export async function listInboundTruckLots(db: D1Database): Promise<InboundTruckLot[]> {
  const result = await db
    .prepare(
      `SELECT w.id, w.truck_number, w.weight_grams, b.farm_code, b.entry_date,
              COALESCE(b.market_strain, s.name) AS strain_name, b.hbn, w.created_at, b.license_value,
              w.material_form,
              (SELECT m.id ${RIDING_MANIFEST_MATCH} ORDER BY m.completed_at DESC LIMIT 1) AS manifest_id,
              (SELECT m.metrc_manifest_number ${RIDING_MANIFEST_MATCH} ORDER BY m.completed_at DESC LIMIT 1) AS metrc_manifest_number
       FROM wet_weight_entries w
       LEFT JOIN harvest_batches b ON b.id = w.harvest_batch_id
       LEFT JOIN strains s ON s.id = b.strain_id
       WHERE w.deleted_at IS NULL AND w.status = 'in_transit'
       ORDER BY w.created_at DESC`
    )
    .all<InboundTruckLot>();
  return result.results ?? [];
}

/** Barn-resident wet lots still at a site (not yet on the road). */
export async function listSiteWetLots(db: D1Database, farmCode: string): Promise<InboundTruckLot[]> {
  const result = await db
    .prepare(
      `SELECT w.id, w.truck_number, w.weight_grams, b.farm_code, b.entry_date,
              COALESCE(b.market_strain, s.name) AS strain_name, b.hbn, w.created_at, b.license_value,
              w.material_form
       FROM wet_weight_entries w
       LEFT JOIN harvest_batches b ON b.id = w.harvest_batch_id
       LEFT JOIN strains s ON s.id = b.strain_id
       WHERE w.deleted_at IS NULL AND w.status = 'weighing' AND b.farm_code = ?
       ORDER BY w.created_at DESC`
    )
    .bind(farmCode)
    .all<InboundTruckLot>();
  return result.results ?? [];
}

/** Weighing lots for the four-window trees, placed by the batch license. */
export async function listWeighingLots(db: D1Database): Promise<InboundTruckLot[]> {
  const result = await db
    .prepare(
      `SELECT w.id, w.truck_number, w.weight_grams, b.farm_code, b.entry_date,
              COALESCE(b.market_strain, s.name) AS strain_name, b.hbn, w.created_at, b.license_value
       FROM wet_weight_entries w
       LEFT JOIN harvest_batches b ON b.id = w.harvest_batch_id
       LEFT JOIN strains s ON s.id = b.strain_id
       WHERE w.deleted_at IS NULL AND w.status = 'weighing'
         AND NOT EXISTS (
           SELECT 1 FROM local_inventory_items li
           WHERE li.wet_weight_entry_id = w.id AND li.deleted_at IS NULL
         )
       ORDER BY w.created_at DESC`
    )
    .all<InboundTruckLot>();
  return result.results ?? [];
}

/** The active manifest (gate fix 0.28.2, builder amendment 2): the newest
 * building movement CARRYING AT LEAST ONE live item. A header-only save (an
 * empty building row) never steals the pane or the focus law; it stays
 * voidable in the Admin logistics queue. */
export async function getActiveBuildingMovement(db: D1Database): Promise<IntercoMovementRow | null> {
  const row = await db
    .prepare(
      `SELECT ${INTERCO_MOVEMENT_COLS}
       FROM interco_movements
       WHERE deleted_at IS NULL AND movement_kind = 'interco' AND status = 'building'
         AND id IN (SELECT movement_id FROM interco_movement_items WHERE deleted_at IS NULL)
       ORDER BY created_at DESC
       LIMIT 1`
    )
    .first<IntercoMovementRow>();
  return row ?? null;
}

/** Completed manifests with an open item: the road and the Arrivals pane.
 * Owner bug report 2026-09-08 (canon 0.30.9, "589af120 is an orphan"): THE
 * TRUCK CARRIES ITS PAPER. A manifest riding an in-transit truck lot (through
 * the lot's born package or as a WET item) is excluded here; its truck row
 * names the manifest and the one-button receive closes it. */
export async function listInboundMovements(db: D1Database): Promise<IntercoMovementRow[]> {
  const result = await db
    .prepare(
      `SELECT m.id, m.movement_kind, m.origin_farm, m.destination_farm, m.origin_license,
              m.destination_license, m.truck_number, m.driver, m.planned_route, m.transfer_type,
              m.invoice_number, m.payment_term_days, m.planned_departure, m.planned_arrival,
              m.gross_weight, m.gross_weight_uom, m.transporter_license, m.transporter_phone,
              m.driver_occupational_license, m.driver_license_number, m.vehicle_make, m.vehicle_model,
              m.vehicle_plate, m.metrc_manifest_number, m.status, m.exported_at, m.completed_at, m.created_at,
              (SELECT COUNT(*) FROM interco_movement_items mi
               WHERE mi.movement_id = m.id AND mi.deleted_at IS NULL
                 AND mi.receipt_id IS NULL AND mi.rejected_at IS NULL) AS item_count
       FROM interco_movements m
       WHERE m.deleted_at IS NULL AND m.status = 'completed' AND m.movement_kind = 'interco'
         AND EXISTS (
           SELECT 1 FROM interco_movement_items mi
           WHERE mi.movement_id = m.id AND mi.deleted_at IS NULL
             AND mi.receipt_id IS NULL AND mi.rejected_at IS NULL
         )
         AND NOT EXISTS (
           SELECT 1 FROM interco_movement_items mi2
           LEFT JOIN local_inventory_items li ON li.id = mi2.local_inventory_item_id
           JOIN wet_weight_entries w ON w.id = COALESCE(li.wet_weight_entry_id, mi2.local_inventory_item_id)
           WHERE mi2.movement_id = m.id AND mi2.deleted_at IS NULL
             AND mi2.receipt_id IS NULL AND mi2.rejected_at IS NULL
             AND w.deleted_at IS NULL AND w.status = 'in_transit'
         )
       ORDER BY m.completed_at DESC`
    )
    .all<IntercoMovementRow>();
  return result.results ?? [];
}

export type IntercoReceiptRow = {
  id: string;
  movement_id: string;
  note: string | null;
  created_at: string;
  created_by: string | null;
  received_by_name: string | null;
  origin_farm: string | null;
  destination_farm: string | null;
  item_count: number;
};

export async function listReceipts(db: D1Database): Promise<IntercoReceiptRow[]> {
  const result = await db
    .prepare(
      `SELECT r.id, r.movement_id, r.note, r.created_at, r.created_by,
              p.display_name AS received_by_name, m.origin_farm, m.destination_farm,
              (SELECT COUNT(*) FROM interco_movement_items mi
               WHERE mi.receipt_id = r.id AND mi.deleted_at IS NULL) AS item_count
       FROM interco_receipts r
       JOIN interco_movements m ON m.id = r.movement_id
       LEFT JOIN people p ON p.id = r.created_by
       WHERE r.deleted_at IS NULL
       ORDER BY r.created_at DESC`
    )
    .all<IntercoReceiptRow>();
  return result.results ?? [];
}

export async function getReceipt(db: D1Database, id: string): Promise<IntercoReceiptRow | null> {
  return db
    .prepare(
      `SELECT r.id, r.movement_id, r.note, r.created_at, r.created_by,
              p.display_name AS received_by_name, m.origin_farm, m.destination_farm,
              (SELECT COUNT(*) FROM interco_movement_items mi
               WHERE mi.receipt_id = r.id AND mi.deleted_at IS NULL) AS item_count
       FROM interco_receipts r
       JOIN interco_movements m ON m.id = r.movement_id
       LEFT JOIN people p ON p.id = r.created_by
       WHERE r.id = ? AND r.deleted_at IS NULL`
    )
    .bind(id)
    .first<IntercoReceiptRow>();
}

export async function listBuildingMovements(db: D1Database): Promise<IntercoMovementRow[]> {
  const result = await db
    .prepare(
      `SELECT ${INTERCO_MOVEMENT_COLS}
       FROM interco_movements
       WHERE deleted_at IS NULL AND movement_kind = 'interco' AND status = 'building'
       ORDER BY created_at DESC`
    )
    .all<IntercoMovementRow>();
  return result.results ?? [];
}

export async function listFinishedOutboundMovements(db: D1Database): Promise<IntercoMovementRow[]> {
  const result = await db
    .prepare(
      `SELECT ${INTERCO_MOVEMENT_COLS}
       FROM interco_movements
       WHERE deleted_at IS NULL AND movement_kind = 'interco' AND status = 'completed'
       ORDER BY completed_at DESC, created_at DESC`
    )
    .all<IntercoMovementRow>();
  return result.results ?? [];
}

export type DrySpaceResidentItem = LocalInventoryListRow & { on_building: number };

export type DrySpaceInventorySpace = {
  id: string;
  name: string;
  kind: string;
  farm_code: string | null;
  farm_name: string;
  items: DrySpaceResidentItem[];
};

export async function listDrySpaceInventory(db: D1Database): Promise<DrySpaceInventorySpace[]> {
  const spaces = await db
    .prepare(
      `SELECT d.id, d.name, d.kind, d.farm_code, COALESCE(f.display_name, d.farm_code, '') AS farm_name
       FROM dry_spaces d
       LEFT JOIN farms f ON f.code = d.farm_code AND f.deleted_at IS NULL
       WHERE d.deleted_at IS NULL AND d.kind <> 'truck'
       ORDER BY d.farm_code, d.name`
    )
    .all<{ id: string; name: string; kind: string; farm_code: string | null; farm_name: string }>();
  const items = await db
    .prepare(
      `SELECT i.id, i.item_kind, i.package_code, i.harvest_batch_id, i.wet_weight_entry_id,
              i.strain_id, COALESCE(hb.market_strain, s.name) AS strain_name, i.qty, i.uom, i.farm_code,
              f.display_name AS farm_name, i.license_value, i.location, i.metrc_tag,
              COALESCE(lv.label, f2.display_name, i.location) AS location_label,
              i.created_at,
              CASE WHEN EXISTS (
                SELECT 1 FROM interco_movement_items mi
                JOIN interco_movements m ON m.id = mi.movement_id
                WHERE mi.local_inventory_item_id = i.id
                  AND mi.deleted_at IS NULL
                  AND m.deleted_at IS NULL
                  AND m.status = 'building'
              ) THEN 1 ELSE 0 END AS on_building
       FROM local_inventory_items i
       LEFT JOIN strains s ON s.id = i.strain_id
       LEFT JOIN harvest_batches hb ON hb.id = i.harvest_batch_id
       LEFT JOIN farms f ON f.code = i.farm_code
       LEFT JOIN lookup_values lv
         ON lv.category = 'inventory_location' AND lv.value = i.location AND lv.deleted_at IS NULL
       LEFT JOIN farms f2 ON f2.code = i.location AND f2.deleted_at IS NULL
       WHERE i.deleted_at IS NULL
         AND i.item_kind IN ('SPR', 'WIP')
       ORDER BY i.created_at DESC`
    )
    .all<DrySpaceResidentItem>();
  const byLocation = new Map<string, DrySpaceResidentItem[]>();
  for (const item of items.results ?? []) {
    const list = byLocation.get(item.location) ?? [];
    list.push(item);
    byLocation.set(item.location, list);
  }
  return (spaces.results ?? []).map((space) => ({
    ...space,
    items: byLocation.get(space.name) ?? [],
  }));
}

export type PendingReceiveUploadRow = {
  id: string;
  movement_id: string;
  filename: string;
  newest_activity: string;
  harvest_batch_id: string;
};

export async function listPendingReceiveUploads(db: D1Database): Promise<PendingReceiveUploadRow[]> {
  const result = await db
    .prepare(
      `SELECT r.id, r.movement_id, r.created_at AS newest_activity,
              COALESCE((
                SELECT i.harvest_batch_id FROM interco_movement_items mi
                JOIN local_inventory_items i ON i.id = mi.local_inventory_item_id
                WHERE mi.receipt_id = r.id AND mi.deleted_at IS NULL
                  AND i.harvest_batch_id IS NOT NULL
                LIMIT 1
              ), r.id) AS harvest_batch_id
       FROM interco_receipts r
       WHERE r.deleted_at IS NULL
         AND NOT EXISTS (
           SELECT 1 FROM metrc_uploads u
           WHERE u.ref_id = r.id AND u.kind = 'receive_manifest' AND u.deleted_at IS NULL
         )
       ORDER BY r.created_at DESC`
    )
    .all<{ id: string; movement_id: string; newest_activity: string; harvest_batch_id: string }>();
  return (result.results ?? []).map((row) => ({
    ...row,
    filename: `receive_manifest_${row.id.replaceAll("-", "").slice(0, 8)}.csv`,
  }));
}

/** One-export-home law (owner, canon 0.22.0): every METRC-bound CSV surfaces
 * in exactly one place, /admin/uploads. A completed movement (interco or
 * virtual) pends its manifest here until a metrc_uploads stamp (kind manifest,
 * ref_id = the movement) marks it uploaded. */
export type PendingManifestUploadRow = {
  id: string;
  movement_kind: string;
  origin_license: string | null;
  destination_license: string | null;
  metrc_manifest_number: string | null;
  newest_activity: string;
  filename: string;
};

/** THE TAG LAW (canon 0.30.38): where a pending METRC file would print an
 * internal code in a tag column. Keyed the way the export home's rows are:
 * movements (manifests, receives), harvest batches (package files, location
 * changes) and split parents. A wet item on a manifest has no ledger row yet
 * and counts as untagged. */
export type TagGaps = {
  movements: Set<string>;
  batches: Set<string>;
  parents: Set<string>;
};

export async function listTagGaps(db: D1Database): Promise<TagGaps> {
  const untaggedSql = `(i.metrc_tag IS NULL OR TRIM(i.metrc_tag) = '' OR LENGTH(TRIM(i.metrc_tag)) <> 24)`;
  const movements = await db
    .prepare(
      `SELECT DISTINCT mi.movement_id AS id
       FROM interco_movement_items mi
       LEFT JOIN local_inventory_items i ON i.id = mi.local_inventory_item_id AND i.deleted_at IS NULL
       WHERE mi.deleted_at IS NULL
         AND (mi.metrc_tag IS NULL OR LENGTH(TRIM(mi.metrc_tag)) <> 24)
         AND (i.id IS NULL OR ${untaggedSql})`
    )
    .all<{ id: string }>();
  const batches = await db
    .prepare(
      `SELECT DISTINCT i.harvest_batch_id AS id
       FROM local_inventory_items i
       WHERE i.deleted_at IS NULL AND i.harvest_batch_id IS NOT NULL AND ${untaggedSql}`
    )
    .all<{ id: string }>();
  const parents = await db
    .prepare(
      `SELECT DISTINCT COALESCE(i.parent_item_id, i.id) AS id
       FROM local_inventory_items i
       WHERE i.deleted_at IS NULL AND ${untaggedSql}`
    )
    .all<{ id: string }>();
  const ids = (rows: { results?: Array<{ id: string }> }) =>
    new Set((rows.results ?? []).map((r) => String(r.id)).filter(Boolean));
  return { movements: ids(movements), batches: ids(batches), parents: ids(parents) };
}

/** THE MANIFEST BUILDER (canon 0.30.125; his pick "Dim, no >>"): the tags
 * riding a finished, unvoided manifest out of one origin license, tag to
 * movement id, so the origin pane reads them dim and the finish refuses them. */
/** THE PHONE LOGIN (canon 0.30.127): the person already carrying a phone, if
 * any, so an edit or an add refuses a second person on the same number. */
export async function personIdByPhone(db: D1Database, phone: string): Promise<string | null> {
  const row = await db
    .prepare(`SELECT id FROM people WHERE phone = ? AND deleted_at IS NULL`)
    .bind(phone)
    .first<{ id: string }>();
  return row?.id ?? null;
}

export async function listManifestedTags(db: D1Database, originLicense: string): Promise<Map<string, string>> {
  const result = await db
    .prepare(
      `SELECT mi.metrc_tag, m.id AS movement_id
       FROM interco_movement_items mi
       JOIN interco_movements m ON m.id = mi.movement_id
       WHERE m.origin_license = ? AND m.status = 'completed' AND m.deleted_at IS NULL
         AND mi.deleted_at IS NULL AND mi.metrc_tag IS NOT NULL
       ORDER BY m.completed_at DESC, m.created_at DESC`
    )
    .bind(originLicense)
    .all<{ metrc_tag: string; movement_id: string }>();
  const out = new Map<string, string>();
  for (const row of result.results ?? []) {
    if (!out.has(row.metrc_tag)) out.set(row.metrc_tag, row.movement_id);
  }
  return out;
}

/** THE MANIFEST BUILDER: the newest finished manifest out of one origin
 * license per destination, its T3 header columns, so the header prefills when
 * the destination is picked (the route and the truck rarely change on a pair). */
export async function listManifestHeaderPrefills(
  db: D1Database,
  originLicense: string
): Promise<Record<string, Record<string, string>>> {
  const result = await db
    .prepare(
      `SELECT destination_license, planned_route, transfer_type, invoice_number, payment_term_days,
              planned_departure, planned_arrival, gross_weight, gross_weight_uom,
              transporter_license, transporter_phone, driver, driver_occupational_license, driver_license_number,
              vehicle_make, vehicle_model, vehicle_plate
       FROM interco_movements
       WHERE origin_license = ? AND status = 'completed' AND deleted_at IS NULL
       ORDER BY COALESCE(completed_at, created_at) DESC`
    )
    .bind(originLicense)
    .all<Record<string, string | null>>();
  const out: Record<string, Record<string, string>> = {};
  for (const row of result.results ?? []) {
    const dest = String(row.destination_license ?? "");
    if (!dest || out[dest]) continue;
    const values: Record<string, string> = {};
    for (const [key, value] of Object.entries(row)) {
      if (key === "destination_license") continue;
      const text = String(value ?? "").trim();
      if (text) values[key] = text;
    }
    out[dest] = values;
  }
  return out;
}

export async function listPendingManifestUploads(db: D1Database): Promise<PendingManifestUploadRow[]> {
  const result = await db
    .prepare(
      `SELECT m.id, m.movement_kind, m.origin_license, m.destination_license,
              m.metrc_manifest_number, COALESCE(m.completed_at, m.created_at) AS newest_activity
       FROM interco_movements m
       WHERE m.deleted_at IS NULL AND m.status = 'completed'
         AND NOT EXISTS (
           SELECT 1 FROM metrc_uploads u
           WHERE u.ref_id = m.id AND u.kind = 'manifest' AND u.deleted_at IS NULL
         )
       ORDER BY COALESCE(m.completed_at, m.created_at) DESC`
    )
    .all<{
      id: string;
      movement_kind: string;
      origin_license: string | null;
      destination_license: string | null;
      metrc_manifest_number: string | null;
      newest_activity: string;
    }>();
  return (result.results ?? []).map((row) => ({
    ...row,
    filename: `manifest_${row.id.replaceAll("-", "").slice(0, 8)}.csv`,
  }));
}

export async function listVirtualMovements(db: D1Database): Promise<IntercoMovementRow[]> {
  const result = await db
    .prepare(
      `SELECT ${INTERCO_MOVEMENT_COLS}
       FROM interco_movements
       WHERE deleted_at IS NULL AND movement_kind = 'virtual'
       ORDER BY created_at DESC`
    )
    .all<IntercoMovementRow>();
  return result.results ?? [];
}

export type UnloadSessionRow = {
  id: string;
  wet_weight_entry_id: string;
  operator_name: string | null;
  weigh_mode: string | null;
  bucked_on_site: number | null;
  truck_number: string | null;
  finished_at: string | null;
  // THE EFFECTIVE DATE PER STATION (canon 0.30.94): the unload's transaction date.
  effective_date?: string | null;
};

export async function getOpenUnloadSession(
  db: D1Database,
  lotId: string
): Promise<UnloadSessionRow | null> {
  return db
    .prepare(
      `SELECT id, wet_weight_entry_id, operator_name, weigh_mode, bucked_on_site, truck_number, finished_at, effective_date
       FROM unload_sessions
       WHERE wet_weight_entry_id = ? AND deleted_at IS NULL AND finished_at IS NULL
       ORDER BY created_at DESC
       LIMIT 1`
    )
    .bind(lotId)
    .first<UnloadSessionRow>();
}

export async function countSessionWeights(db: D1Database, sessionId: string): Promise<number> {
  const row = await db
    .prepare(
      `SELECT COUNT(*) AS n FROM dry_weights WHERE session_id = ? AND deleted_at IS NULL`
    )
    .bind(sessionId)
    .first<{ n: number }>();
  return Number(row?.n ?? 0);
}

export type PendingPackageUploadRow = {
  id: string;
  kind: string;
  harvest_batch_id: string;
  hbn: string;
  lot: string;
  seq: number | null;
  newest_activity: string;
};

export async function listPendingPackageUploads(db: D1Database): Promise<PendingPackageUploadRow[]> {
  // Owner bug report 2026-09-08 (canon 0.30.5): the list and the mark must
  // read ONE predicate. A voided lot or batch pends nothing (the mark refused
  // those as Unknown batch while the list still showed them). Canon 0.30.1
  // fork 7: the package_finish arms are gone with the tool; a legacy
  // queue_finish choice in the log pends no file.
  const result = await db
    .prepare(
      `SELECT s.id, b.id AS harvest_batch_id, b.hbn, b.harvest_year, b.lot_serial, ${HARVEST_FILE_SEQ_SQL} AS seq,
              s.finished_at AS newest_activity,
              CASE
                WHEN d.kind = 'silo' THEN 'package_adjust'
                WHEN s.weigh_mode = 'bucked' THEN 'package_from_harvest'
                ELSE 'package_adjust'
              END AS kind
       FROM unload_sessions s
       JOIN wet_weight_entries w ON w.id = s.wet_weight_entry_id AND w.deleted_at IS NULL
       JOIN harvest_batches b ON b.id = w.harvest_batch_id AND b.deleted_at IS NULL
       LEFT JOIN dry_spaces d ON d.id = w.actual_dryspc
       WHERE s.deleted_at IS NULL AND s.finished_at IS NOT NULL
         AND NOT EXISTS (
           SELECT 1 FROM metrc_uploads u
           WHERE u.ref_id = s.id AND u.deleted_at IS NULL
             AND u.kind IN ('package_from_harvest', 'package_adjust')
         )
       UNION ALL
       SELECT s.id, b.id AS harvest_batch_id, b.hbn, b.harvest_year, b.lot_serial, ${HARVEST_FILE_SEQ_SQL} AS seq,
              s.finished_at AS newest_activity,
              'package_adjust' AS kind
       FROM unload_sessions s
       JOIN wet_weight_entries w ON w.id = s.wet_weight_entry_id AND w.deleted_at IS NULL
       JOIN harvest_batches b ON b.id = w.harvest_batch_id AND b.deleted_at IS NULL
       LEFT JOIN dry_spaces d ON d.id = w.actual_dryspc
       JOIN record_change_log l
         ON l.record_table = 'unload_sessions' AND l.record_id = s.id
        AND l.field = 'reconcile_choice' AND l.new_value = 'queue_adjust'
       WHERE s.deleted_at IS NULL AND s.finished_at IS NOT NULL
         AND s.weigh_mode = 'bucked'
         AND (d.kind IS NULL OR d.kind <> 'silo')
         AND NOT EXISTS (
           SELECT 1 FROM metrc_uploads u
           WHERE u.ref_id = s.id AND u.deleted_at IS NULL AND u.kind = 'package_adjust'
         )
       UNION ALL
       SELECT w.id, b.id AS harvest_batch_id, b.hbn, b.harvest_year, b.lot_serial, ${HARVEST_FILE_SEQ_SQL} AS seq,
              w.updated_at AS newest_activity,
              'package_adjust' AS kind
       FROM wet_weight_entries w
       JOIN harvest_batches b ON b.id = w.harvest_batch_id AND b.deleted_at IS NULL
       JOIN record_change_log l
         ON l.record_table = 'wet_weight_entries' AND l.record_id = w.id
        AND l.field = 'trim_reconcile_choice' AND l.new_value = 'queue_adjust'
       WHERE w.deleted_at IS NULL
         AND NOT EXISTS (
           SELECT 1 FROM metrc_uploads u
           WHERE u.ref_id = w.id AND u.deleted_at IS NULL AND u.kind = 'package_adjust'
         )
       ORDER BY newest_activity DESC`
    )
    .all<{
      id: string;
      harvest_batch_id: string;
      hbn: string;
      harvest_year: number;
      lot_serial: number;
      seq: number | null;
      newest_activity: string;
      kind: string;
    }>();
  return (result.results ?? []).map((row) => ({
    id: row.id,
    kind: row.kind,
    harvest_batch_id: row.harvest_batch_id,
    hbn: row.hbn,
    lot: formatLotToken(Number(row.harvest_year), Number(row.lot_serial)),
    seq: row.seq == null ? null : Number(row.seq),
    newest_activity: row.newest_activity,
  }));
}

export type HarvestYearRow = {
  harvest_year: number;
  batches: number;
  lots_finished: number;
  wet_grams: number;
  dry_grams: number;
};

export async function listHarvestsByYear(
  db: D1Database,
  farm?: string
): Promise<HarvestYearRow[]> {
  const farmClause = farm ? "AND b.farm_code = ?" : "";
  const binds = farm ? [farm] : [];
  const result = await db
    .prepare(
      `SELECT b.harvest_year,
              COUNT(DISTINCT b.id) AS batches,
              SUM(CASE WHEN w.id IS NOT NULL AND w.status <> 'weighing' THEN 1 ELSE 0 END) AS lots_finished,
              COALESCE(ROUND(SUM(CASE WHEN w.id IS NOT NULL AND w.status <> 'weighing' THEN w.weight_grams ELSE 0 END), 2), 0) AS wet_grams,
              COALESCE(ROUND(SUM(CASE WHEN w.id IS NOT NULL AND w.status <> 'weighing' THEN COALESCE(w.dry_weight_grams, 0) ELSE 0 END), 2), 0) AS dry_grams
       FROM harvest_batches b
       LEFT JOIN wet_weight_entries w ON w.harvest_batch_id = b.id AND w.deleted_at IS NULL
       WHERE b.deleted_at IS NULL AND ${farmHarvestSql("b")} ${farmClause}
       GROUP BY b.harvest_year
       ORDER BY b.harvest_year DESC`
    )
    .bind(...binds)
    .all<HarvestYearRow>();
  return result.results ?? [];
}

export type ProductMixRow = {
  package_type_code: string;
  display_name: string | null;
  total_grams: number;
};

export async function listProductMix(db: D1Database, year: number): Promise<ProductMixRow[]> {
  const result = await db
    .prepare(
      `SELECT p.package_type_code, t.display_name,
              COALESCE(ROUND(SUM(p.weight_grams), 2), 0) AS total_grams
       FROM wip_packages p
       JOIN wet_weight_entries w ON w.id = p.wet_weight_entry_id
       JOIN harvest_batches b ON b.id = w.harvest_batch_id
       LEFT JOIN package_types t ON t.code = p.package_type_code
       WHERE p.deleted_at IS NULL AND b.harvest_year = ?
       GROUP BY p.package_type_code, t.display_name
       ORDER BY p.package_type_code`
    )
    .bind(year)
    .all<ProductMixRow>();
  return result.results ?? [];
}

export type TatSpanSource = {
  record_table: string;
  record_id: string;
  old_value: string | null;
  new_value: string | null;
  reason: string;
  changed_at: string;
  farm_code: string | null;
  strain_name: string | null;
  grow_method_code: string | null;
  harvest_batch_id: string | null;
  wet_weight_entry_id: string | null;
  entry_date: string | null;
  package_created_at: string | null;
};

export async function listTatStatusLogs(db: D1Database): Promise<TatSpanSource[]> {
  const lots = await db
    .prepare(
      `SELECT l.record_table, l.record_id, l.old_value, l.new_value, l.reason, l.changed_at,
              b.farm_code, s.name AS strain_name, b.grow_method_code, b.id AS harvest_batch_id,
              w.id AS wet_weight_entry_id, b.entry_date, NULL AS package_created_at
       FROM record_change_log l
       JOIN wet_weight_entries w ON w.id = l.record_id
       JOIN harvest_batches b ON b.id = w.harvest_batch_id
       LEFT JOIN strains s ON s.id = b.strain_id
       WHERE l.record_table = 'wet_weight_entries' AND l.field = 'status'`
    )
    .all<TatSpanSource>();
  const pkgs = await db
    .prepare(
      `SELECT l.record_table, l.record_id, l.old_value, l.new_value, l.reason, l.changed_at,
              b.farm_code, s.name AS strain_name, b.grow_method_code, b.id AS harvest_batch_id,
              p.wet_weight_entry_id, b.entry_date,
              COALESCE((SELECT MIN(ip.created_at) FROM cryo_run_inputs ri JOIN wip_packages ip ON ip.id = ri.wip_package_id WHERE ri.run_id = p.cryo_run_id), p.created_at) AS package_created_at
       FROM record_change_log l
       JOIN wip_packages p ON p.id = l.record_id
       LEFT JOIN wet_weight_entries w ON w.id = p.wet_weight_entry_id
       LEFT JOIN harvest_batches b ON b.id = w.harvest_batch_id
       LEFT JOIN strains s ON s.id = b.strain_id
       WHERE l.record_table = 'wip_packages' AND l.field = 'status'`
    )
    .all<TatSpanSource>();
  return [...(lots.results ?? []), ...(pkgs.results ?? [])];
}

export function insertLog(
  db: D1Database,
  row: {
    record_table: string;
    record_id: string;
    field: string;
    old_value: string | null;
    new_value: string | null;
    actor_person_id: string | null;
    reason: string;
    changed_at: string;
  }
): D1PreparedStatement {
  return db
    .prepare(
      `INSERT INTO record_change_log (
        id, record_table, record_id, field, old_value, new_value, actor_person_id, reason, changed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      crypto.randomUUID(),
      row.record_table,
      row.record_id,
      row.field,
      row.old_value,
      row.new_value,
      row.actor_person_id,
      row.reason,
      row.changed_at
    );
}

export function logsForInsert(
  db: D1Database,
  table: string,
  id: string,
  record: Record<string, unknown>,
  actorId: string | null,
  reason: string,
  changedAt: string
): D1PreparedStatement[] {
  const stmts: D1PreparedStatement[] = [];
  for (const [field, value] of Object.entries(record)) {
    if (value == null || value === "") continue;
    stmts.push(
      insertLog(db, {
        record_table: table,
        record_id: id,
        field,
        old_value: null,
        new_value: String(value),
        actor_person_id: actorId,
        reason,
        changed_at: changedAt,
      })
    );
  }
  return stmts;
}

export async function listChangeLogForRecord(
  db: D1Database,
  table: string,
  id: string
): Promise<Array<Record<string, unknown>>> {
  const result = await db
    .prepare(
      `SELECT l.*, p.display_name AS actor_name
       FROM record_change_log l
       LEFT JOIN people p ON p.id = l.actor_person_id
       WHERE l.record_table = ? AND l.record_id = ?
       ORDER BY l.changed_at DESC`
    )
    .bind(table, id)
    .all<Record<string, unknown>>();
  return result.results ?? [];
}

export async function listAudits(
  db: D1Database,
  kind: string,
  finished: boolean
): Promise<Array<Record<string, unknown>>> {
  const clause = finished ? "a.finished_at IS NOT NULL" : "a.finished_at IS NULL";
  const result = await db
    .prepare(
      `SELECT a.*,
              (SELECT COUNT(*) FROM audit_notes n WHERE n.audit_id = a.id AND n.deleted_at IS NULL) AS note_count
       FROM audits a
       WHERE a.deleted_at IS NULL AND a.kind = ? AND ${clause}
       ORDER BY COALESCE(a.finished_at, a.started_at) DESC`
    )
    .bind(kind)
    .all<Record<string, unknown>>();
  return result.results ?? [];
}

export async function listAuditNotes(db: D1Database, auditId: string): Promise<Array<Record<string, unknown>>> {
  const result = await db
    .prepare(
      `SELECT * FROM audit_notes WHERE audit_id = ? AND deleted_at IS NULL ORDER BY created_at`
    )
    .bind(auditId)
    .all<Record<string, unknown>>();
  return result.results ?? [];
}

export async function newestFinishedInternalAudit(db: D1Database): Promise<string | null> {
  const row = await db
    .prepare(
      `SELECT finished_at FROM audits
       WHERE deleted_at IS NULL AND kind = 'internal' AND finished_at IS NOT NULL
       ORDER BY finished_at DESC LIMIT 1`
    )
    .first<{ finished_at: string }>();
  return row?.finished_at ?? null;
}

export async function listUnfinishedExternalTests(db: D1Database): Promise<Array<Record<string, unknown>>> {
  const result = await db
    .prepare(
      `SELECT net_weight_grams, batch_weight_grams FROM external_test_results
       WHERE deleted_at IS NULL AND (finished_testing IS NULL OR trim(finished_testing) = '')`
    )
    .all<Record<string, unknown>>();
  return result.results ?? [];
}

export async function listExternalTests(
  db: D1Database,
  filters: { facility?: string; status?: string; year?: string } = {}
): Promise<Array<Record<string, unknown>>> {
  const clauses = ["deleted_at IS NULL"];
  const binds: unknown[] = [];
  if (filters.facility) {
    clauses.push("testing_facility = ?");
    binds.push(filters.facility);
  }
  if (filters.status) {
    clauses.push("status = ?");
    binds.push(filters.status);
  }
  if (filters.year) {
    clauses.push("(entered_testing LIKE ? OR created_at LIKE ?)");
    binds.push(`${filters.year}%`, `${filters.year}%`);
  }
  const result = await db
    .prepare(
      `SELECT * FROM external_test_results WHERE ${clauses.join(" AND ")} ORDER BY created_at DESC`
    )
    .bind(...binds)
    .all<Record<string, unknown>>();
  return result.results ?? [];
}

export async function listExternalTestsForFtq(db: D1Database): Promise<Array<{ sample_tag: string; attempt: number; status: string | null }>> {
  const result = await db
    .prepare(
      `SELECT sample_tag, attempt, status FROM external_test_results
       WHERE deleted_at IS NULL AND sample_tag IS NOT NULL AND trim(sample_tag) <> ''`
    )
    .all<{ sample_tag: string; attempt: number; status: string | null }>();
  return result.results ?? [];
}

export async function listFailedFailureModes(db: D1Database): Promise<string[]> {
  const result = await db
    .prepare(
      `SELECT failure_mode FROM external_test_results
       WHERE deleted_at IS NULL AND status = 'Failed' AND failure_mode IS NOT NULL`
    )
    .all<{ failure_mode: string }>();
  return (result.results ?? []).map((r) => r.failure_mode);
}

export async function listFinishedExternalAudits(
  db: D1Database,
  filters: { agency?: string; from?: string; to?: string } = {}
): Promise<Array<Record<string, unknown>>> {
  const clauses = ["a.deleted_at IS NULL", "a.kind = 'external'", "a.finished_at IS NOT NULL"];
  const binds: unknown[] = [];
  if (filters.agency) {
    clauses.push("a.agency = ?");
    binds.push(filters.agency);
  }
  if (filters.from) {
    clauses.push("a.finished_at >= ?");
    binds.push(filters.from);
  }
  if (filters.to) {
    clauses.push("a.finished_at <= ?");
    binds.push(`${filters.to}T23:59:59.999Z`);
  }
  const result = await db
    .prepare(
      `SELECT a.*,
              (SELECT COUNT(*) FROM audit_notes n WHERE n.audit_id = a.id AND n.deleted_at IS NULL) AS note_count
       FROM audits a
       WHERE ${clauses.join(" AND ")}
       ORDER BY a.finished_at DESC`
    )
    .bind(...binds)
    .all<Record<string, unknown>>();
  return result.results ?? [];
}

export async function listInternalTestingReport(
  db: D1Database,
  filters: { year?: string; strain?: string } = {}
): Promise<Array<Record<string, unknown>>> {
  const clauses = ["i.deleted_at IS NULL"];
  const binds: unknown[] = [];
  if (filters.year) {
    clauses.push("(b.entry_date LIKE ? OR i.tested_at LIKE ?)");
    binds.push(`${filters.year}%`, `${filters.year}%`);
  }
  if (filters.strain) {
    clauses.push("s.name = ?");
    binds.push(filters.strain);
  }
  const result = await db
    .prepare(
      `SELECT i.hbn, i.source, i.analyte, i.value, i.tested_at, i.created_at,
              b.entry_date, s.name AS strain_name
       FROM internal_test_results i
       LEFT JOIN harvest_batches b ON b.hbn = i.hbn AND b.deleted_at IS NULL
       LEFT JOIN strains s ON s.id = b.strain_id
       WHERE ${clauses.join(" AND ")}
       ORDER BY i.tested_at DESC, i.created_at DESC`
    )
    .bind(...binds)
    .all<Record<string, unknown>>();
  return result.results ?? [];
}

export async function listLabelTemplates(db: D1Database): Promise<Array<Record<string, unknown>>> {
  const result = await db
    .prepare(`SELECT * FROM label_templates WHERE deleted_at IS NULL ORDER BY name`)
    .all<Record<string, unknown>>();
  return result.results ?? [];
}

export async function listSuppliers(db: D1Database): Promise<Array<Record<string, unknown>>> {
  const result = await db
    .prepare(
      `SELECT s.*,
              (SELECT COUNT(*) FROM purchase_orders p WHERE p.supplier_id = s.id AND p.deleted_at IS NULL) AS po_count
       FROM suppliers s
       WHERE s.deleted_at IS NULL
       ORDER BY s.company_name`
    )
    .all<Record<string, unknown>>();
  return result.results ?? [];
}

export async function listPurchaseOrders(
  db: D1Database,
  tab: string
): Promise<Array<Record<string, unknown>>> {
  const clauses = ["p.deleted_at IS NULL"];
  if (tab === "open") clauses.push("p.status = 'open'");
  if (tab === "draft") clauses.push("p.status = 'draft'");
  if (tab === "closed") clauses.push("p.status IN ('closed', 'cancelled')");
  const result = await db
    .prepare(
      `SELECT p.*, s.company_name AS supplier_name,
              COALESCE((SELECT SUM(l.qty * l.unit_price_cents) FROM purchase_order_lines l
                        WHERE l.purchase_order_id = p.id AND l.deleted_at IS NULL), 0) AS total_cents
       FROM purchase_orders p
       LEFT JOIN suppliers s ON s.id = p.supplier_id
       WHERE ${clauses.join(" AND ")}
       ORDER BY p.created_at DESC`
    )
    .all<Record<string, unknown>>();
  return result.results ?? [];
}

export async function getPurchaseOrder(db: D1Database, id: string): Promise<Record<string, unknown> | null> {
  return db
    .prepare(
      `SELECT p.*, s.company_name AS supplier_name, pe.display_name AS created_by_name
       FROM purchase_orders p
       LEFT JOIN suppliers s ON s.id = p.supplier_id
       LEFT JOIN people pe ON pe.id = p.created_by
       WHERE p.id = ? AND p.deleted_at IS NULL`
    )
    .bind(id)
    .first<Record<string, unknown>>();
}

export async function listPoLines(db: D1Database, poId: string): Promise<Array<Record<string, unknown>>> {
  const result = await db
    .prepare(
      `SELECT * FROM purchase_order_lines WHERE purchase_order_id = ? AND deleted_at IS NULL ORDER BY created_at`
    )
    .bind(poId)
    .all<Record<string, unknown>>();
  return result.results ?? [];
}

export async function maxPoSeq(db: D1Database, farm: string, yy: string): Promise<number> {
  const result = await db
    .prepare(`SELECT po_number FROM purchase_orders WHERE po_number LIKE ?`)
    .bind(`PO-${farm}-${yy}-%`)
    .all<{ po_number: string }>();
  let max = 0;
  for (const row of result.results ?? []) {
    const n = Number(String(row.po_number).split("-").pop());
    if (Number.isInteger(n) && n > max) max = n;
  }
  return max;
}

export type PendingSplitUploadRow = {
  id: string;
  parent_code: string;
  harvest_batch_id: string;
  filename: string;
  newest_activity: string;
};

export async function listPendingSplitUploads(db: D1Database): Promise<PendingSplitUploadRow[]> {
  const result = await db
    .prepare(
      `SELECT p.id, p.package_code AS parent_code,
              COALESCE(p.harvest_batch_id, p.id) AS harvest_batch_id,
              MAX(c.created_at) AS newest_activity
       FROM local_inventory_items c
       JOIN local_inventory_items p ON p.id = c.parent_item_id
       WHERE c.deleted_at IS NULL AND p.deleted_at IS NULL
       GROUP BY p.id, p.package_code, p.harvest_batch_id
       HAVING MAX(c.created_at) > COALESCE((
         SELECT MAX(u.uploaded_at) FROM metrc_uploads u
         WHERE u.ref_id = p.id AND u.kind = 'package_split' AND u.deleted_at IS NULL
       ), '')
       ORDER BY newest_activity DESC`
    )
    .all<{
      id: string;
      parent_code: string;
      harvest_batch_id: string;
      newest_activity: string;
    }>();
  return (result.results ?? []).map((row) => ({
    ...row,
    filename: `package_split_${row.parent_code.replace(/[^A-Za-z0-9._-]+/g, "_")}.csv`,
  }));
}

export async function listSplitChildren(
  db: D1Database,
  parentId: string
): Promise<Array<{ id: string; package_code: string; metrc_tag: string | null; qty: number; created_at: string }>> {
  const result = await db
    .prepare(
      `SELECT id, package_code, metrc_tag, qty, created_at FROM local_inventory_items
       WHERE parent_item_id = ? AND deleted_at IS NULL
       ORDER BY created_at, package_code`
    )
    .bind(parentId)
    .all<{ id: string; package_code: string; metrc_tag: string | null; qty: number; created_at: string }>();
  return result.results ?? [];
}

export async function listListings(db: D1Database): Promise<Array<Record<string, unknown>>> {
  const result = await db
    .prepare(
      `SELECT l.*, COALESCE(hb.market_strain, s.name, i.package_code) AS item_display_name
       FROM listings l
       LEFT JOIN local_inventory_items i ON i.id = l.package_item_id
       LEFT JOIN harvest_batches hb ON hb.id = i.harvest_batch_id
       LEFT JOIN strains s ON s.id = i.strain_id
       WHERE l.deleted_at IS NULL
       ORDER BY l.created_at DESC`
    )
    .all<Record<string, unknown>>();
  return result.results ?? [];
}

export async function inventoryQtyByTag(db: D1Database): Promise<Map<string, number>> {
  const result = await db
    .prepare(
      `SELECT package_code, SUM(qty) AS qty FROM local_inventory_items
       WHERE deleted_at IS NULL GROUP BY package_code`
    )
    .all<{ package_code: string; qty: number }>();
  const map = new Map<string, number>();
  for (const row of result.results ?? []) map.set(row.package_code, Number(row.qty));
  return map;
}

export async function inventoryItemsById(
  db: D1Database
): Promise<Map<string, { qty: number; deleted: boolean }>> {
  const result = await db
    .prepare(`SELECT id, qty, deleted_at FROM local_inventory_items`)
    .all<{ id: string; qty: number; deleted_at: string | null }>();
  const map = new Map<string, { qty: number; deleted: boolean }>();
  for (const row of result.results ?? []) {
    map.set(row.id, { qty: Number(row.qty), deleted: Boolean(row.deleted_at) });
  }
  return map;
}

export async function listSalesOrders(db: D1Database): Promise<Array<Record<string, unknown>>> {
  const result = await db
    .prepare(
      `SELECT o.*,
              (SELECT GROUP_CONCAT(l2.item_name || ' ' || l2.qty_grams, '; ')
               FROM sales_order_lines sl
               JOIN listings l2 ON l2.id = sl.listing_id
               WHERE sl.sales_order_id = o.id AND sl.deleted_at IS NULL) AS lines_label
       FROM sales_orders o
       WHERE o.deleted_at IS NULL
       ORDER BY o.created_at DESC`
    )
    .all<Record<string, unknown>>();
  return result.results ?? [];
}

export async function listSoLines(db: D1Database, soId: string): Promise<Array<Record<string, unknown>>> {
  const result = await db
    .prepare(
      `SELECT sl.*, l.item_name, l.package_tag, l.package_label, l.category
       FROM sales_order_lines sl
       LEFT JOIN listings l ON l.id = sl.listing_id
       WHERE sl.sales_order_id = ? AND sl.deleted_at IS NULL
       ORDER BY sl.created_at`
    )
    .bind(soId)
    .all<Record<string, unknown>>();
  return result.results ?? [];
}

export async function maxSoSeq(db: D1Database, yy: string): Promise<number> {
  const result = await db
    .prepare(`SELECT so_number FROM sales_orders WHERE so_number LIKE ?`)
    .bind(`SO-${yy}-%`)
    .all<{ so_number: string }>();
  let max = 0;
  for (const row of result.results ?? []) {
    const n = Number(String(row.so_number).split("-").pop());
    if (Number.isInteger(n) && n > max) max = n;
  }
  return max;
}

export async function listLabelPackages(db: D1Database): Promise<Array<Record<string, unknown>>> {
  const inv = await db
    .prepare(
      `SELECT i.id, COALESCE(i.metrc_tag, i.package_code) AS tag, COALESCE(hb.market_strain, s.name, i.item_kind) AS item_or_strain,
              i.qty AS net_weight_grams, i.created_at AS packaged_date,
              i.license_value AS license_number, COALESCE(f.display_name, i.farm_code) AS facility_name
       FROM local_inventory_items i
       LEFT JOIN strains s ON s.id = i.strain_id
       LEFT JOIN harvest_batches hb ON hb.id = i.harvest_batch_id
       LEFT JOIN farms f ON f.code = i.farm_code
       WHERE i.deleted_at IS NULL
       ORDER BY i.package_code`
    )
    .all<Record<string, unknown>>();
  const tests = await db
    .prepare(
      `SELECT id, COALESCE(source_metrc_tag, sample_tag) AS tag,
              COALESCE(item_name, strain, sample_tag) AS item_or_strain,
              net_weight_grams, COALESCE(entered_testing, created_at) AS packaged_date,
              license_number, testing_facility AS facility_name
       FROM external_test_results
       WHERE deleted_at IS NULL AND COALESCE(source_metrc_tag, sample_tag) IS NOT NULL
       ORDER BY created_at DESC`
    )
    .all<Record<string, unknown>>();
  return [...(inv.results ?? []), ...(tests.results ?? [])];
}

export async function latestFinalizedPotency(db: D1Database, tag: string): Promise<string> {
  const row = await db
    .prepare(
      `SELECT finalized_potency FROM external_test_results
       WHERE deleted_at IS NULL AND (source_metrc_tag = ? OR sample_tag = ?)
         AND finalized_potency IS NOT NULL
       ORDER BY attempt DESC, created_at DESC LIMIT 1`
    )
    .bind(tag, tag)
    .first<{ finalized_potency: number }>();
  return row?.finalized_potency == null ? "" : String(row.finalized_potency);
}


/* --------------------------------------------------- Drying Operations: Load Silo (canon 0.30.6) */

export type BarnWetLotRow = {
  id: string;
  /** THE FINISHED LOT IS ELIGIBLE (canon 0.30.130): drying, or in_transit for a truck-era lot that finished; a load turns in_transit to drying. */
  status: string;
  /** THE FINISHED LOT IS ELIGIBLE (canon 0.30.130): where the born package sits
   * right now, whatever that is (a barn, a room, a silo name a pencil moved it
   * to); null when the lot has no live package. Under 0.30.73 this was the barn
   * the lot waited in and the pane's gate; it gates nothing now. */
  barn_location: string | null;
  hbn: string | null;
  metrc_harvest_tag: string | null;
  farm_code: string | null;
  truck_number?: string | null;
  strain_label: string | null;
  entry_date: string | null;
  weight_grams: number;
  material_form: string | null;
  actual_dryspc: string | null;
  planned_space_name: string | null;
  planned_space_kind: string | null;
  /** THE LOADING SILO (canon 0.30.81): the silo the HBN planned (harvest_batches.planned_dryspc, the Silo # lookup value, matched to "Silo N" by name), for a truck lot whose space is the sentinel; null when none. */
  planned_silo_id?: string | null;
  package_code: string | null;
  item_id: string | null;
  /** Canon 0.30.67: the hand-typed Team Lead, else the retired picker's person for older lots. */
  lead_name: string | null;
  /** Canon 0.30.67: the login that started the lot, the Supervisor. */
  supervisor_name: string | null;
  notes: string | null;
  /** THE PLANT COUNT (canon 0.30.62): null until typed at Finish lot, here, or by the pencil. */
  plant_count: number | null;
  /** THE LOAD AND THE LOT (canon 0.30.241): the HBN this part belongs to. */
  harvest_batch_id?: string | null;
  /** When Finish load moved the part to drying. On a weighing lot exposed by
   * a sent field load, the earliest sent_at of the loads its totes ride. */
  finished_at?: string | null;
  /** THE IN-TRANSIT RULE (canon 0.30.320): in-transit loads whose live totes sit on this weighing lot. */
  in_transit_loads?: number;
  planned_silo_name?: string | null;
  planned_dryspc?: string | null;
};

/** THE FINISHED LOT IS ELIGIBLE (canon 0.30.130). Owner, 2026-09-19, verbatim:
 * "how do i get lots 27, 28, and 29 when the load dry space page doesn't show
 * them?  I'm assuming this is leftover interco logistics keep that logistics
 * page live, but sever its hold on where ledger inventory lands." and "regardless
 * of what farm the HBN indicates, assume it's elligible for dry space loading as
 * soon as the "finish lot" routine runs in wet weight entry". The Load Silo pane
 * reads every lot Finish lot has run on (status drying, or in_transit for a
 * truck-era lot) that no open silo load holds, whatever the HBN's farm and
 * wherever its born package sits; the package rides along (LEFT JOIN on the
 * lot's earliest live item, the one getInventoryItemForLot names) so the load
 * can move it from where it is. The 0.30.73 gate (the package live in BARN, ARL
 * BARN or PNS BARN) is repealed; the label still rides last-6-of-tag / origin
 * farm / market strain (strain name when no market strain). */
const BARN_WET_LOT_SELECT = `SELECT w.id, w.status, li.location AS barn_location, b.id AS harvest_batch_id, b.hbn, b.metrc_harvest_tag, b.farm_code, w.truck_number,
              COALESCE(b.market_strain, s.name) AS strain_label, b.entry_date,
              w.weight_grams, w.material_form, w.actual_dryspc, w.updated_at AS finished_at,
              d.name AS planned_space_name, d.kind AS planned_space_kind,
              ps.id AS planned_silo_id, ps.name AS planned_silo_name, b.planned_dryspc,
              li.package_code, li.id AS item_id, COALESCE(w.team_lead, p.display_name) AS lead_name,
              COALESCE(c.email, c.display_name) AS supervisor_name, w.notes, w.plant_count
       FROM wet_weight_entries w
       JOIN harvest_batches b ON b.id = w.harvest_batch_id AND b.deleted_at IS NULL
       LEFT JOIN local_inventory_items li ON li.id = (
         SELECT i.id FROM local_inventory_items i
         WHERE i.wet_weight_entry_id = w.id AND i.deleted_at IS NULL
         ORDER BY i.created_at ASC, i.id ASC LIMIT 1)
       LEFT JOIN strains s ON s.id = b.strain_id
       LEFT JOIN dry_spaces d ON d.id = w.actual_dryspc
       LEFT JOIN dry_spaces ps ON ps.kind = 'silo' AND ps.deleted_at IS NULL AND ps.name = 'Silo ' || COALESCE(b.planned_dryspc, '')
       LEFT JOIN people p ON p.id = w.lead_person_id
       LEFT JOIN people c ON c.id = w.created_by
       WHERE w.deleted_at IS NULL AND w.status IN (?, ?)
         AND NOT EXISTS (
           SELECT 1 FROM silo_loads l
           WHERE l.wet_weight_entry_id = w.id AND l.ended_at IS NULL AND l.deleted_at IS NULL)`;

/** The Load Silo pane: every finished lot no open load holds (canon 0.30.130),
 * newest change first. The barnLocation argument of 0.30.73 narrowed the pane
 * to one barn; it is kept for the callers that pass it and narrows nothing. */
export async function listBarnWetLots(db: D1Database, barnLocation?: string): Promise<BarnWetLotRow[]> {
  void barnLocation;
  const result = await db
    .prepare(`${BARN_WET_LOT_SELECT}
       ORDER BY w.updated_at DESC`)
    .bind(LOT_STATUS.drying, LOT_STATUS.in_transit)
    .all<BarnWetLotRow>();
  return result.results ?? [];
}

export async function getBarnWetLot(db: D1Database, lotId: string, barnLocation?: string): Promise<BarnWetLotRow | null> {
  const rows = await listBarnWetLots(db, barnLocation);
  return rows.find((r) => r.id === lotId) ?? null;
}

/** THE IN-TRANSIT RULE (canon 0.30.320): a weighing lot of an ARL or PNS HBN
 * with a live tote on an in-transit load. truck_number is null. finished_at
 * is the earliest send. The loads count is those in-transit loads. */
const WEIGHING_IN_TRANSIT_SELECT = `SELECT w.id, w.status, li.location AS barn_location, b.id AS harvest_batch_id, b.hbn, b.metrc_harvest_tag, b.farm_code,
              NULL AS truck_number,
              COALESCE(b.market_strain, s.name) AS strain_label, b.entry_date,
              w.weight_grams, w.material_form, w.actual_dryspc,
              (
                SELECT MIN(l.sent_at) FROM wet_weights tw
                JOIN field_loads l ON l.id = tw.field_load_id AND l.deleted_at IS NULL AND l.status = 'in_transit'
                WHERE tw.wet_weight_entry_id = w.id AND tw.deleted_at IS NULL
              ) AS finished_at,
              d.name AS planned_space_name, d.kind AS planned_space_kind,
              ps.id AS planned_silo_id, ps.name AS planned_silo_name, b.planned_dryspc,
              li.package_code, li.id AS item_id, COALESCE(w.team_lead, p.display_name) AS lead_name,
              COALESCE(c.email, c.display_name) AS supervisor_name, w.notes, w.plant_count,
              (
                SELECT COUNT(DISTINCT l.id) FROM wet_weights tw
                JOIN field_loads l ON l.id = tw.field_load_id AND l.deleted_at IS NULL AND l.status = 'in_transit'
                WHERE tw.wet_weight_entry_id = w.id AND tw.deleted_at IS NULL
              ) AS in_transit_loads
       FROM wet_weight_entries w
       JOIN harvest_batches b ON b.id = w.harvest_batch_id AND b.deleted_at IS NULL
       LEFT JOIN local_inventory_items li ON li.id = (
         SELECT i.id FROM local_inventory_items i
         WHERE i.wet_weight_entry_id = w.id AND i.deleted_at IS NULL
         ORDER BY i.created_at ASC, i.id ASC LIMIT 1)
       LEFT JOIN strains s ON s.id = b.strain_id
       LEFT JOIN dry_spaces d ON d.id = w.actual_dryspc
       LEFT JOIN dry_spaces ps ON ps.kind = 'silo' AND ps.deleted_at IS NULL AND ps.name = 'Silo ' || COALESCE(b.planned_dryspc, '')
       LEFT JOIN people p ON p.id = w.lead_person_id
       LEFT JOIN people c ON c.id = w.created_by
       WHERE w.deleted_at IS NULL AND w.status = ?
         AND b.farm_code IN ('ARL', 'PNS')
         AND EXISTS (
           SELECT 1 FROM wet_weights tw
           JOIN field_loads l ON l.id = tw.field_load_id AND l.deleted_at IS NULL AND l.status = 'in_transit'
           WHERE tw.wet_weight_entry_id = w.id AND tw.deleted_at IS NULL)`;

/** The Dry Queue: the finished lots Load Silo may load, plus the weighing
 * lots a sent field load has exposed. Load Silo keeps listBarnWetLots. */
export async function listDryQueueLots(db: D1Database): Promise<BarnWetLotRow[]> {
  const [finished, weighing] = await Promise.all([
    listBarnWetLots(db),
    db.prepare(WEIGHING_IN_TRANSIT_SELECT).bind(LOT_STATUS.weighing).all<BarnWetLotRow>(),
  ]);
  const exposed = (weighing.results ?? []).map((row) => ({
    ...row,
    truck_number: null,
    in_transit_loads: Number(row.in_transit_loads ?? 0),
  }));
  return [...finished, ...exposed];
}

/** THE LOAD AND THE LOT (canon 0.30.241): the parts of one HBN still waiting
 * for a space (drying or a truck-era in_transit, no open load), plus a
 * weighing lot a sent field load has exposed (canon 0.30.320). */
export async function listLotParts(db: D1Database, harvestBatchId: string): Promise<BarnWetLotRow[]> {
  const rows = await listDryQueueLots(db);
  return rows.filter((row) => row.harvest_batch_id === harvestBatchId);
}

export type OpenLogisticsSchedule = {
  id: string;
  harvest_batch_id: string;
  scheduled_at: string;
  hbn: string | null;
  farm_code: string | null;
  strain_label: string | null;
  metrc_harvest_tag: string | null;
  planned_silo_name: string | null;
};

export async function listOpenLogisticsSchedules(db: D1Database): Promise<OpenLogisticsSchedule[]> {
  const result = await db
    .prepare(
      `SELECT ps.id, ps.harvest_batch_id, ps.scheduled_at, b.hbn, b.farm_code, b.metrc_harvest_tag,
              COALESCE(b.market_strain, st.name, '') AS strain_label,
              silo.name AS planned_silo_name
       FROM production_schedules ps
       JOIN harvest_batches b ON b.id = ps.harvest_batch_id AND b.deleted_at IS NULL
       LEFT JOIN strains st ON st.id = b.strain_id
       LEFT JOIN dry_spaces silo ON silo.kind = 'silo' AND silo.deleted_at IS NULL
         AND silo.name = 'Silo ' || COALESCE(b.planned_dryspc, '')
       WHERE ps.stage = ? AND ps.status = ? AND ps.deleted_at IS NULL
       ORDER BY ps.scheduled_at ASC`
    )
    .bind(INTERNAL_LOGISTICS_STAGE, SCHEDULE_STATUS.scheduled)
    .all<OpenLogisticsSchedule>();
  return result.results ?? [];
}

export type FinishedLogisticsRow = {
  id: string;
  harvest_batch_id: string;
  hbn: string | null;
  farm_code: string | null;
  strain_label: string | null;
  metrc_harvest_tag: string | null;
  completed_at: string | null;
  space_name: string | null;
};

/** Lots whose pass was completed inside the window, newest first, with the space of the latest load. */
export async function listFinishedLogistics(db: D1Database, sinceIso: string): Promise<FinishedLogisticsRow[]> {
  const result = await db
    .prepare(
      `SELECT ps.id, ps.harvest_batch_id, ps.completed_at, b.hbn, b.farm_code, b.metrc_harvest_tag,
              COALESCE(b.market_strain, s.name) AS strain_label,
              (
                SELECT d.name FROM silo_loads l
                JOIN wet_weight_entries w ON w.id = l.wet_weight_entry_id
                JOIN dry_spaces d ON d.id = l.dry_space_id
                WHERE w.harvest_batch_id = ps.harvest_batch_id AND l.deleted_at IS NULL
                ORDER BY l.loaded_at DESC LIMIT 1
              ) AS space_name
       FROM production_schedules ps
       JOIN harvest_batches b ON b.id = ps.harvest_batch_id
       LEFT JOIN strains s ON s.id = b.strain_id
       WHERE ps.stage = ? AND ps.status = ? AND ps.deleted_at IS NULL AND ps.completed_at >= ?
       ORDER BY ps.completed_at DESC`
    )
    .bind(INTERNAL_LOGISTICS_STAGE, SCHEDULE_STATUS.complete, sinceIso)
    .all<FinishedLogisticsRow>();
  return result.results ?? [];
}

/** One row per scheduled HBN for Load Silo and the drying Available panes.
 * The row id is the harvest batch, so a pick loads every part. */
export async function listScheduledLotsForLoad(db: D1Database): Promise<BarnWetLotRow[]> {
  const [parts, open] = await Promise.all([listBarnWetLots(db), listOpenLogisticsSchedules(db)]);
  const covered = new Set(open.map((row) => row.harvest_batch_id));
  const byBatch = new Map<string, BarnWetLotRow[]>();
  for (const part of parts) {
    const batch = part.harvest_batch_id ?? "";
    if (!batch || !covered.has(batch)) continue;
    const group = byBatch.get(batch);
    if (group) group.push(part);
    else byBatch.set(batch, [part]);
  }
  const order = new Map(open.map((row, i) => [row.harvest_batch_id, i]));
  return [...byBatch.entries()]
    .sort((a, b) => (order.get(a[0]) ?? 0) - (order.get(b[0]) ?? 0))
    .map(([, group]) => syntheticLot(group));
}

export type MenuEntryRow = {
  id: string;
  harvest_batch_id: string;
  status: string;
  created_at: string;
  updated_at: string;
  truck_number: string | null;
  loaded: number;
  /** Latest change-log instant that set this part in_transit. Null when the log has none. */
  transit_at: string | null;
};

/** Today's farm-day lots, plus every part still in_transit (on the road). */
export async function listMenuEntries(db: D1Database, startIso: string, endIso: string): Promise<MenuEntryRow[]> {
  const result = await db
    .prepare(
      `SELECT w.id, w.harvest_batch_id, w.status, w.created_at, w.updated_at, w.truck_number,
              CASE WHEN EXISTS (
                SELECT 1 FROM silo_loads l
                WHERE l.wet_weight_entry_id = w.id AND l.deleted_at IS NULL
              ) THEN 1 ELSE 0 END AS loaded,
              (
                SELECT c.changed_at FROM record_change_log c
                WHERE c.record_table = 'wet_weight_entries' AND c.record_id = w.id
                  AND c.field = 'status' AND c.new_value = 'in_transit'
                ORDER BY c.changed_at DESC
                LIMIT 1
              ) AS transit_at
       FROM wet_weight_entries w
       WHERE w.deleted_at IS NULL
         AND (
           w.harvest_batch_id IN (
             SELECT w2.harvest_batch_id FROM wet_weight_entries w2
             WHERE w2.deleted_at IS NULL
             GROUP BY w2.harvest_batch_id
             HAVING MIN(w2.created_at) >= ? AND MIN(w2.created_at) < ?
           )
           OR w.status = 'in_transit'
         )`
    )
    .bind(startIso, endIso)
    .all<MenuEntryRow>();
  return result.results ?? [];
}

export type MenuDryingLoad = {
  id: string;
  space_id: string;
  space_name: string;
  space_type: string | null;
  loaded_at: string;
  started_at: string | null;
  paused_at: string | null;
  paused_seconds: number;
};

/** Open loads in silos and dry rooms. Freezers are not drying. */
export async function listMenuDryingLoads(db: D1Database): Promise<MenuDryingLoad[]> {
  const result = await db
    .prepare(
      `SELECT l.id, l.loaded_at, l.started_at, l.paused_at, l.paused_seconds,
              d.id AS space_id, d.name AS space_name, d.space_type
       FROM silo_loads l
       JOIN dry_spaces d ON d.id = l.dry_space_id AND d.deleted_at IS NULL
       WHERE l.ended_at IS NULL AND l.deleted_at IS NULL
         AND COALESCE(d.space_type, 'silo') <> 'freezer'`
    )
    .all<MenuDryingLoad>();
  return result.results ?? [];
}

function syntheticLot(group: BarnWetLotRow[]): BarnWetLotRow {
  const first = group[0];
  const trucks = [...new Set(group.map((part) => String(part.truck_number ?? "").trim()).filter(Boolean))];
  const missing = group.some((part) => !part.item_id);
  const plant = group.every((part) => part.plant_count != null)
    ? group.reduce((sum, part) => sum + Number(part.plant_count), 0)
    : null;
  return {
    ...first,
    id: first.harvest_batch_id || first.id,
    weight_grams: group.reduce((sum, part) => sum + Number(part.weight_grams ?? 0), 0),
    truck_number: trucks.length === 1 ? trucks[0] : null,
    item_id: missing ? null : first.item_id,
    plant_count: plant,
  };
}

/** A silo as the strip draws it. THE HARVEST CONSOLE (canon 0.30.73): shape is
 * data (cylinder, or box for the Arlington Dry Room, migration 0049) and
 * farm_code the site it stands at (PNN for the five; ARL for the room). */
/** THE DRY SPACE TYPE (canon 0.30.106): a silo row carries its type (silo,
 * dry_room, freezer), its capacity with the unit, and the METRC location its
 * loads sit at when that differs from its name (migration 0057). */
export type SiloRow = {
  id: string;
  name: string;
  shape?: string | null;
  farm_code?: string | null;
  space_type?: string | null;
  capacity?: number | string | null;
  capacity_uom?: string | null;
  location_name?: string | null;
};

/** The silos (kind silo): the silos first in name order, then the dry rooms, then the freezers. */
export async function listSilos(db: D1Database): Promise<SiloRow[]> {
  const result = await db
    .prepare(
      `SELECT id, name, shape, farm_code, space_type, capacity, capacity_uom, location_name
       FROM dry_spaces WHERE kind = 'silo' AND deleted_at IS NULL
       ORDER BY CASE WHEN space_type = 'freezer' THEN 2 WHEN space_type = 'dry_room' THEN 1 ELSE 0 END, name`
    )
    .all<SiloRow>();
  return result.results ?? [];
}

export type SiloLoadRow = {
  id: string;
  dry_space_id: string;
  silo_name: string | null;
  wet_weight_entry_id: string;
  hbn: string | null;
  metrc_harvest_tag: string | null;
  strain_label: string | null;
  farm_code: string | null;
  weight_grams: number | null;
  /** THE UNLOADING SILO (canon 0.30.77): the lot's dry grams weighed out so far at Unload Dry Space; null until an unload begins. */
  dry_weight_grams?: number | null;
  loaded_at: string;
  started_at: string | null;
  paused_at: string | null;
  paused_seconds: number;
  ended_at: string | null;
  notes: string | null;
  /** THE DRYING SCHEDULE (canon 0.30.226): the lot's Truck #, so a Working row reads the label Load Silo reads. */
  truck_number?: string | null;
};

const SILO_LOAD_SELECT = `SELECT l.id, l.dry_space_id, d.name AS silo_name, l.wet_weight_entry_id,
              b.hbn, b.metrc_harvest_tag, COALESCE(b.market_strain, s.name) AS strain_label, b.farm_code,
              w.weight_grams, w.dry_weight_grams, l.loaded_at, l.started_at, l.paused_at, l.paused_seconds, l.ended_at, l.notes,
              w.truck_number
       FROM silo_loads l
       LEFT JOIN dry_spaces d ON d.id = l.dry_space_id
       LEFT JOIN wet_weight_entries w ON w.id = l.wet_weight_entry_id
       LEFT JOIN harvest_batches b ON b.id = w.harvest_batch_id
       LEFT JOIN strains s ON s.id = b.strain_id`;

/** Open loads (not ended, not voided), newest first: what the circles show.
 * THE VOIDED LOT LEAVES ITS SILO (canon 0.30.116): a load whose lot was voided
 * is no load; the tiles never show one, whatever the load row says. */
export async function listOpenSiloLoads(db: D1Database): Promise<SiloLoadRow[]> {
  const result = await db
    .prepare(`${SILO_LOAD_SELECT}
       WHERE l.deleted_at IS NULL AND l.ended_at IS NULL AND w.deleted_at IS NULL
       ORDER BY l.loaded_at DESC`)
    .all<SiloLoadRow>();
  return result.results ?? [];
}

/** THE EMPTY CLOCK (canon 0.30.270): the moment a space's last load left it.
 * The unload finish's press is ended_at. A load that left by its lot's void
 * has no ended_at, so the moment is deleted_at. The newer of the two wins.
 * An open load is not a departure. effective_date is not this moment. */
export async function listSiloEmptySince(db: D1Database): Promise<{ dry_space_id: string; left_at: string }[]> {
  const result = await db
    .prepare(
      `SELECT dry_space_id,
              MAX(CASE WHEN ended_at IS NOT NULL AND TRIM(ended_at) <> '' THEN ended_at ELSE deleted_at END) AS left_at
       FROM silo_loads
       WHERE (ended_at IS NOT NULL AND TRIM(ended_at) <> '')
          OR (deleted_at IS NOT NULL AND TRIM(deleted_at) <> '')
       GROUP BY dry_space_id`
    )
    .all<{ dry_space_id: string; left_at: string }>();
  return (result.results ?? []).filter((row) => Boolean(row.left_at));
}

/** The lots a silo tile counts besides its open loads (canon 0.30.69): the lots
 * weighing into a silo (the wet weight screen filling it) and the finished lots
 * that wait in the barn for Load Silo, one row per lot with its grams.
 * THE LOADING SILO (canon 0.30.81; owner, 2026-09-15, verbatim: "when a
 * satellite farm's material is received at PNN and it's in the barn with a wet
 * weight, it should be set as "loading" in the correctly assigned silo"): a
 * received truck lot keeps the truck sentinel as its space until the crew's
 * location change, so it never reached a silo tile. Now a finished lot whose
 * space is not a silo is assigned to the silo the HBN planned (harvest_batches
 * .planned_dryspc, the Silo # lookup value, matched to "Silo N" by name); a
 * weighing lot still fills only the silo it weighs into. THE FINISHED LOT IS
 * ELIGIBLE (canon 0.30.130): the 0.30.81 clause that counted the planned lot
 * only while its package sat in the PNN barn is gone with the ledger's hold. */
export type SiloLotGramsRow = {
  dry_space_id: string;
  status: string;
  weight_grams: number;
  lots: number;
  /** The lot behind the row (canon 0.30.81), so a loading tile can name it. */
  lot_id?: string | null;
  hbn?: string | null;
  metrc_harvest_tag?: string | null;
  /** True when the silo came from the HBN's planned number, not the lot's own space. */
  planned?: number | null;
  /** THE STRAIN ON THE LOT LINE (canon 0.30.183): the market strain, else the strain's name (the 0.30.149 rule). */
  strain_label?: string | null;
};

export async function listSiloLotGrams(db: D1Database): Promise<SiloLotGramsRow[]> {
  const result = await db
    .prepare(
      `SELECT CASE WHEN d.kind = 'silo' THEN d.id ELSE p.id END AS dry_space_id, w.status AS status,
              COALESCE(w.weight_grams, 0) AS weight_grams, 1 AS lots,
              w.id AS lot_id, b.hbn, b.metrc_harvest_tag,
              CASE WHEN d.kind = 'silo' THEN 0 ELSE 1 END AS planned,
              COALESCE(b.market_strain, s.name) AS strain_label
       FROM wet_weight_entries w
       LEFT JOIN dry_spaces d ON d.id = w.actual_dryspc AND d.deleted_at IS NULL
       LEFT JOIN harvest_batches b ON b.id = w.harvest_batch_id
       LEFT JOIN strains s ON s.id = b.strain_id
       LEFT JOIN dry_spaces p ON p.kind = 'silo' AND p.deleted_at IS NULL AND p.name = 'Silo ' || COALESCE(b.planned_dryspc, '')
       WHERE w.deleted_at IS NULL
         AND (
           (w.status = 'weighing' AND d.kind = 'silo')
           OR (w.status = 'drying'
             AND NOT EXISTS (
               SELECT 1 FROM silo_loads l WHERE l.wet_weight_entry_id = w.id AND l.deleted_at IS NULL AND l.ended_at IS NULL
             )
             AND (d.kind = 'silo' OR p.id IS NOT NULL))
         )
       ORDER BY w.updated_at DESC`
    )
    .all<SiloLotGramsRow>();
  return (result.results ?? []).filter((r) => r.dry_space_id != null);
}

/** The mirror predicate for one fresh frozen kind (canon 0.30.75): the whole Item name, or its first " - " segment. The cube that read it left under canon 0.30.225; landing still uses this. */
export function ffzKindClause(alias: string): string {
  return `(UPPER(TRIM(COALESCE(${alias}.item, ''))) = ? OR UPPER(COALESCE(${alias}.item, '')) LIKE ?)`;
}

export function ffzKindBinds(kinds: readonly string[]): string[] {
  const out: string[] = [];
  for (const kind of kinds) out.push(kind.toUpperCase(), `${kind.toUpperCase()} - %`);
  return out;
}

export async function getSiloLoad(db: D1Database, id: string): Promise<SiloLoadRow | null> {
  return db
    .prepare(`${SILO_LOAD_SELECT} WHERE l.id = ? AND l.deleted_at IS NULL`)
    .bind(id)
    .first<SiloLoadRow>();
}

/** The open load occupying a silo, if any (owner ruling 2026-09-08, canon
 * 0.30.19, verbatim: "occupied silos should not accept more product"): a silo
 * holds one load until its unload finish ends it. */
export async function getOpenSiloLoadForSilo(db: D1Database, siloId: string): Promise<SiloLoadRow | null> {
  // THE VOIDED LOT LEAVES ITS SILO (canon 0.30.116): a voided lot's load does not occupy the silo.
  return db
    .prepare(`${SILO_LOAD_SELECT}
       WHERE l.dry_space_id = ? AND l.deleted_at IS NULL AND l.ended_at IS NULL AND w.deleted_at IS NULL
       ORDER BY l.loaded_at DESC LIMIT 1`)
    .bind(siloId)
    .first<SiloLoadRow>();
}

export async function getOpenSiloLoadForLot(db: D1Database, lotId: string): Promise<SiloLoadRow | null> {
  return db
    .prepare(`${SILO_LOAD_SELECT}
       WHERE l.wet_weight_entry_id = ? AND l.deleted_at IS NULL AND l.ended_at IS NULL
       ORDER BY l.loaded_at DESC LIMIT 1`)
    .bind(lotId)
    .first<SiloLoadRow>();
}

/** THE JOINT UNLOAD (canon 0.30.226): every open load in one space, first
 * loaded first (the last one takes the share's remainder); a voided lot's
 * load is no load (canon 0.30.116). */
export async function listOpenSiloLoadsInSpace(db: D1Database, spaceId: string): Promise<SiloLoadRow[]> {
  const result = await db
    .prepare(`${SILO_LOAD_SELECT}
       WHERE l.dry_space_id = ? AND l.deleted_at IS NULL AND l.ended_at IS NULL AND w.deleted_at IS NULL
       ORDER BY l.loaded_at ASC, l.id ASC`)
    .bind(spaceId)
    .all<SiloLoadRow>();
  return result.results ?? [];
}

/** THE DRYING SCHEDULE'S COMPLETE PANE (canon 0.30.226): a lot unloaded from a
 * space (the space it dried in, its actual_dryspc, which Load Silo sets) at or
 * after `sinceIso`. The unload is a finished unload session (the normal
 * finish) or an ended load (the freezer's line removed ends the load and voids
 * the session); a lot that has moved on to trim still counts, a lot demoted
 * back to drying does not. */
export type DryingCompleteRow = {
  lot_id: string;
  status: string;
  truck_number: string | null;
  weight_grams: number | null;
  dry_weight_grams: number | null;
  space_id: string;
  space_name: string | null;
  space_type: string | null;
  shape: string | null;
  hbn: string | null;
  metrc_harvest_tag: string | null;
  farm_code: string | null;
  strain_label: string | null;
  package_code: string | null;
  /** The latest finished unload session's finish instant and its effective day. */
  finished_at: string | null;
  effective_date: string | null;
  /** The latest ended load's end instant. */
  ended_at: string | null;
  /** THE RUN (canon 0.30.248): the latest ended load's clock fields, its run read at its end. */
  run_loaded_at?: string | null;
  run_started_at?: string | null;
  run_paused_at?: string | null;
  run_paused_seconds?: number | null;
  run_ended_at?: string | null;
};

export async function listDryingComplete(db: D1Database, sinceIso: string): Promise<DryingCompleteRow[]> {
  const result = await db
    .prepare(
      `SELECT w.id AS lot_id, w.status, w.truck_number, w.weight_grams, w.dry_weight_grams,
              d.id AS space_id, d.name AS space_name, d.space_type, d.shape,
              b.hbn, b.metrc_harvest_tag, b.farm_code, COALESCE(b.market_strain, s.name) AS strain_label,
              li.package_code,
              (SELECT u.finished_at FROM unload_sessions u
                WHERE u.wet_weight_entry_id = w.id AND u.deleted_at IS NULL AND u.finished_at IS NOT NULL
                ORDER BY u.finished_at DESC LIMIT 1) AS finished_at,
              (SELECT u.effective_date FROM unload_sessions u
                WHERE u.wet_weight_entry_id = w.id AND u.deleted_at IS NULL AND u.finished_at IS NOT NULL
                ORDER BY u.finished_at DESC LIMIT 1) AS effective_date,
              (SELECT l.ended_at FROM silo_loads l
                WHERE l.wet_weight_entry_id = w.id AND l.deleted_at IS NULL AND l.ended_at IS NOT NULL
                ORDER BY l.ended_at DESC LIMIT 1) AS ended_at,
              rl.loaded_at AS run_loaded_at, rl.started_at AS run_started_at, rl.paused_at AS run_paused_at,
              rl.paused_seconds AS run_paused_seconds, rl.ended_at AS run_ended_at
       FROM wet_weight_entries w
       JOIN harvest_batches b ON b.id = w.harvest_batch_id AND b.deleted_at IS NULL
       JOIN dry_spaces d ON d.id = w.actual_dryspc AND d.kind = 'silo'
       LEFT JOIN silo_loads rl ON rl.id = (
         SELECT l.id FROM silo_loads l
         WHERE l.wet_weight_entry_id = w.id AND l.deleted_at IS NULL AND l.ended_at IS NOT NULL
         ORDER BY l.ended_at DESC, l.id DESC LIMIT 1)
       LEFT JOIN strains s ON s.id = b.strain_id
       LEFT JOIN local_inventory_items li ON li.id = (
         SELECT i.id FROM local_inventory_items i
         WHERE i.wet_weight_entry_id = w.id AND i.deleted_at IS NULL
         ORDER BY i.created_at ASC, i.id ASC LIMIT 1)
       WHERE w.deleted_at IS NULL AND w.status IN (?, ?, ?)
         AND (
           EXISTS (SELECT 1 FROM unload_sessions u
                   WHERE u.wet_weight_entry_id = w.id AND u.deleted_at IS NULL AND u.finished_at >= ?)
           OR EXISTS (SELECT 1 FROM silo_loads l
                   WHERE l.wet_weight_entry_id = w.id AND l.deleted_at IS NULL AND l.ended_at >= ?)
         )`
    )
    .bind(LOT_STATUS.unloaded, LOT_STATUS.trimmed, LOT_STATUS.frozen, sinceIso, sinceIso)
    .all<DryingCompleteRow>();
  return result.results ?? [];
}

export type PendingLocationChangeRow = {
  id: string;
  harvest_batch_id: string;
  hbn: string | null;
  lot: string;
  silo_name: string | null;
  /** The place the file name uses: the space's METRC location, else its name. */
  file_location: string | null;
  seq: number | null;
  newest_activity: string;
};

/** The export home's Location changes section: every load without its mark.
 * One predicate with the mark (canon 0.30.5): voided lots pend nothing. */
export async function listPendingLocationChangeUploads(db: D1Database): Promise<PendingLocationChangeRow[]> {
  const result = await db
    .prepare(
      `SELECT l.id, b.id AS harvest_batch_id, b.hbn, b.harvest_year, b.lot_serial, ${HARVEST_FILE_SEQ_SQL} AS seq,
              d.name AS silo_name, COALESCE(NULLIF(TRIM(d.location_name), ''), d.name) AS file_location,
              l.loaded_at AS newest_activity
       FROM silo_loads l
       JOIN wet_weight_entries w ON w.id = l.wet_weight_entry_id AND w.deleted_at IS NULL
       JOIN harvest_batches b ON b.id = w.harvest_batch_id AND b.deleted_at IS NULL
       LEFT JOIN dry_spaces d ON d.id = l.dry_space_id
       WHERE l.deleted_at IS NULL
         AND NOT EXISTS (
           SELECT 1 FROM metrc_uploads u
           WHERE u.ref_id = l.id AND u.deleted_at IS NULL AND u.kind = 'location_change'
         )
       ORDER BY l.loaded_at DESC`
    )
    .all<{
      id: string;
      harvest_batch_id: string;
      hbn: string | null;
      harvest_year: number;
      lot_serial: number;
      silo_name: string | null;
      file_location: string | null;
      seq: number | null;
      newest_activity: string;
    }>();
  return (result.results ?? []).map((row) => ({
    id: row.id,
    harvest_batch_id: row.harvest_batch_id,
    hbn: row.hbn,
    lot: `${String(row.harvest_year).slice(-2)}${String(row.lot_serial).padStart(3, "0")}`,
    silo_name: row.silo_name,
    file_location: row.file_location,
    seq: row.seq == null ? null : Number(row.seq),
    newest_activity: row.newest_activity,
  }));
}

/* ------------------------------------------------------------ fulfillment */

/** Canon 0.30.18: one row per Zoho Sales Order export mounted. */
export type SoMountRow = {
  id: string;
  filename: string;
  row_count: number;
  order_count: number;
  ignored_count: number;
  created_at: string;
  created_by: string | null;
};

/** One mounted Zoho sales order. zoho_status and internal_status are Zoho's
 * columns as mounted; pick_status (NULL, picking, fulfilled) is ours. */
export type MountedOrderRow = {
  id: string;
  so_number: string;
  zoho_so_id: string | null;
  customer_name: string | null;
  customer_id: string | null;
  order_date: string | null;
  expected_ship: string | null;
  zoho_status: string | null;
  internal_status: string | null;
  sales_person: string | null;
  customer_license: string | null;
  destination_license: string | null;
  origin_license: string | null;
  delivery_method: string | null;
  location_name: string | null;
  pick_status: string | null;
  picked_by: string | null;
  picked_at: string | null;
  fulfilled_by: string | null;
  fulfilled_at: string | null;
  pick_notes: string | null;
  first_mount_id: string | null;
  last_mount_id: string | null;
  created_at: string;
  updated_at: string;
};

export type MountedLineRow = {
  id: string;
  sales_order_id: string;
  seq: number;
  item_name: string | null;
  sku: string | null;
  product_sub: string | null;
  readout_category: string | null;
  quantity_ordered: number;
  quantity_invoiced: number;
  quantity_packed: number;
  unit: string | null;
  item_price: number | null;
  location_code: string | null;
  line_location_name: string | null;
  picked_qty: number | null;
  short_flag: number;
  pick_note: string | null;
};

const MOUNTED_ORDER_COLUMNS = `id, so_number, zoho_so_id, customer_name, customer_id, order_date, expected_ship,
  zoho_status, internal_status, sales_person, customer_license, destination_license, origin_license,
  delivery_method, location_name, pick_status, picked_by, picked_at, fulfilled_by, fulfilled_at, pick_notes,
  first_mount_id, last_mount_id, created_at, updated_at`;

const MOUNTED_LINE_COLUMNS = `id, sales_order_id, seq, item_name, sku, product_sub, readout_category,
  quantity_ordered, quantity_invoiced, quantity_packed, unit, item_price, location_code, line_location_name,
  picked_qty, short_flag, pick_note`;

/** Mounts, newest first (the page shows the latest as its summary line). */
export async function listSoMounts(db: D1Database, limit = 20): Promise<SoMountRow[]> {
  const result = await db
    .prepare(
      `SELECT id, filename, row_count, order_count, ignored_count, created_at, created_by
       FROM so_mounts WHERE deleted_at IS NULL ORDER BY created_at DESC LIMIT ?`
    )
    .bind(limit)
    .all<SoMountRow>();
  return result.results ?? [];
}

/** Every live mounted order, soonest ship first, then by SO number. */
export async function listMountedOrders(db: D1Database): Promise<MountedOrderRow[]> {
  const result = await db
    .prepare(
      `SELECT ${MOUNTED_ORDER_COLUMNS} FROM mounted_sales_orders
       WHERE deleted_at IS NULL
       ORDER BY COALESCE(expected_ship, '9999-12-31'), so_number`
    )
    .all<MountedOrderRow>();
  return result.results ?? [];
}

export async function getMountedOrder(db: D1Database, id: string): Promise<MountedOrderRow | null> {
  return db
    .prepare(`SELECT ${MOUNTED_ORDER_COLUMNS} FROM mounted_sales_orders WHERE id = ? AND deleted_at IS NULL`)
    .bind(id)
    .first<MountedOrderRow>();
}

export async function getMountedOrderByNumber(db: D1Database, soNumber: string): Promise<MountedOrderRow | null> {
  return db
    .prepare(`SELECT ${MOUNTED_ORDER_COLUMNS} FROM mounted_sales_orders WHERE so_number = ? AND deleted_at IS NULL`)
    .bind(soNumber)
    .first<MountedOrderRow>();
}

/** Every live line across every live order, in seq order; the caller groups
 * by sales_order_id (one query for the readouts instead of one per order). */
export async function listMountedLines(db: D1Database): Promise<MountedLineRow[]> {
  const result = await db
    .prepare(
      `SELECT ${MOUNTED_LINE_COLUMNS} FROM mounted_sales_order_lines
       WHERE deleted_at IS NULL ORDER BY sales_order_id, seq`
    )
    .all<MountedLineRow>();
  return result.results ?? [];
}

export async function listMountedOrderLines(db: D1Database, orderId: string): Promise<MountedLineRow[]> {
  const result = await db
    .prepare(
      `SELECT ${MOUNTED_LINE_COLUMNS} FROM mounted_sales_order_lines
       WHERE sales_order_id = ? AND deleted_at IS NULL ORDER BY seq`
    )
    .bind(orderId)
    .all<MountedLineRow>();
  return result.results ?? [];
}

/** Lines of one order including soft-deleted ones (the re-mount matches by
 * seq and revives a line the export brings back). */
export async function listMountedOrderLinesAll(
  db: D1Database,
  orderId: string
): Promise<Array<MountedLineRow & { deleted_at: string | null }>> {
  const result = await db
    .prepare(
      `SELECT ${MOUNTED_LINE_COLUMNS}, deleted_at FROM mounted_sales_order_lines
       WHERE sales_order_id = ? ORDER BY seq`
    )
    .bind(orderId)
    .all<MountedLineRow & { deleted_at: string | null }>();
  return result.results ?? [];
}

/** Orders with their lines attached, for the readouts and the pick pane. */
export async function listMountedOrdersWithLines(
  db: D1Database
): Promise<Array<MountedOrderRow & { lines: MountedLineRow[] }>> {
  const [orders, lines] = await Promise.all([listMountedOrders(db), listMountedLines(db)]);
  const byOrder = new Map<string, MountedLineRow[]>();
  for (const line of lines) {
    const list = byOrder.get(line.sales_order_id);
    if (list) list.push(line);
    else byOrder.set(line.sales_order_id, [line]);
  }
  return orders.map((o) => ({ ...o, lines: byOrder.get(o.id) ?? [] }));
}

/** Every order row, voided ones included: the re-mount keys on so_number,
 * which is unique across the table, so a voided order the export still
 * carries revives rather than colliding. */
export async function listMountedOrdersAll(
  db: D1Database
): Promise<Array<MountedOrderRow & { deleted_at: string | null }>> {
  const result = await db
    .prepare(`SELECT ${MOUNTED_ORDER_COLUMNS}, deleted_at FROM mounted_sales_orders ORDER BY so_number`)
    .all<MountedOrderRow & { deleted_at: string | null }>();
  return result.results ?? [];
}

/** Every line row, soft-deleted ones included, for the re-mount's seq match. */
export async function listMountedLinesAll(
  db: D1Database
): Promise<Array<MountedLineRow & { deleted_at: string | null }>> {
  const result = await db
    .prepare(`SELECT ${MOUNTED_LINE_COLUMNS}, deleted_at FROM mounted_sales_order_lines ORDER BY sales_order_id, seq`)
    .all<MountedLineRow & { deleted_at: string | null }>();
  return result.results ?? [];
}

/** Labor hours report: one row per saved console value, newest date first. */
export async function listLaborHours(
  db: D1Database,
  from: string,
  to: string
): Promise<Array<{ work_date: string; operation: string; value: number; unit: string; updated_at: string }>> {
  const result = await db
    .prepare(
      `SELECT work_date, operation, value, unit, updated_at FROM (
         SELECT work_date, CASE WHEN farm_code = 'ALL' THEN 'Harvest hours' ELSE 'Harvest hours, ' || farm_code END AS operation, hours AS value, 'h' AS unit, updated_at
         FROM harvest_labor_hours WHERE work_date >= ? AND work_date <= ?
         UNION ALL
         SELECT work_date, 'Trim DLH, ' || shift AS operation, hours AS value, 'h' AS unit, updated_at
         FROM trim_labor_hours WHERE work_date >= ? AND work_date <= ?
         UNION ALL
         SELECT work_date, 'Trim input lbs, ' || shift AS operation, lbs AS value, 'lb' AS unit, updated_at
         FROM trim_line_inputs WHERE work_date >= ? AND work_date <= ?
         UNION ALL
         SELECT work_date, 'Prepack hours' AS operation, hours AS value, 'h' AS unit, updated_at
         FROM prepack_labor_hours WHERE work_date >= ? AND work_date <= ?
       )
       ORDER BY work_date DESC, operation ASC`
    )
    .bind(from, to, from, to, from, to, from, to)
    .all<{ work_date: string; operation: string; value: number; unit: string; updated_at: string }>();
  return (result.results ?? []).map((row) => ({ ...row, value: Number(row.value) }));
}
