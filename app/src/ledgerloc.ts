/**
 * THE RECONCILE LEDGER LOCATION (canon 0.30.135). Owner, 2026-09-20, verbatim:
 * "add a new button to Admin: [Reconcile Ledger Location]
 *  1. Select Farm: (inert for now--we're all one farm as long as interco is out
 *     of the chain)
 *  2. Select Location - Start with just the drying locations/freezers
 *     1. Purge
 *        1. Reason
 *        2. Admin PIN
 *     2. Edit
 *        1. All the data that's in the location becomes editable plus a note
 *           before saving changes - reflect all on the changelog - No changes
 *           to the original CSV, but add something to the data queue that's
 *           more like a note that can be aknowe=ledged that the change
 *           occurred."
 *
 * The page: the farm select stands inert on the landing farm; the location
 * select lists the drying locations (every dry space but the truck sentinel,
 * by the METRC location it stands over); the picked location shows its live
 * ledger packages. Purge voids every one of them under a typed reason and the
 * Admin PIN. Edit opens every package's fields (kind, code, tag, grams, farm,
 * location) with one note, and saves each changed field as its own change-log
 * line under that note. Neither cuts a METRC file; each writes a reconcile
 * note (migration 0063) that stands on Pending Data Uploads until acknowledged.
 * The FFZ inventory picker entry left under THE FFZ INVENTORY (canon 0.30.225).
 */

import { HttpError, nowIso, parseGrams, requireText, textOrNull } from "./audit";
import { CONFIG_KEYS, ITEM_KIND_ORDER, LANDING_FARM, formatGrams, normalizeMetrcTag, SYSTEM_REASON } from "./config";
import {
  getConfigValue,
  insertLog,
  listLocalInventory,
  logsForInsert,
  requireActor,
  type LocalInventoryListRow,
  type LookupOption,
} from "./db";
import { t, type Locale } from "./i18n";
import { esc } from "./ui";
import type { ActionOk } from "./actions";

export const LEDGER_LOCATION_PATH = "/admin/reconcile-location";
export const LEDGER_LOCATION_PURGE_PATH = `${LEDGER_LOCATION_PATH}/purge`;
export const LEDGER_LOCATION_EDIT_PATH = `${LEDGER_LOCATION_PATH}/edit`;
/** The acknowledge post for a note, under the export home like every queue control. */
export function reconcileNoteAckPath(id: string): string {
  return `/admin/uploads/reconcile_note/${encodeURIComponent(id)}/acknowledge`;
}

export const RECONCILE_KIND = { purge: "purge", edit: "edit" } as const;

export const RECONCILE_REFUSAL = {
  location: "Pick a drying location.",
  reason: "Reason is required.",
  pin: "Purging needs the Admin PIN.",
  nothing: "Nothing at that location to purge.",
  note: "Note is required.",
  unchanged: "Nothing changed; the ledger stands as it was.",
  kind: "Kind must be one of WIP, SPR, FG.",
  moved: "A package can only move to a drying location.",
} as const;

function personIdFrom(form: FormData): string | null {
  return textOrNull(form.get("person_id"));
}

export type DryingLocation = {
  /** The METRC location the space stands over (location_name, else the space's name); the ledger's word. */
  value: string;
  label: string;
  kind: string;
  space_type: string | null;
  farm_code: string | null;
};

/** The drying locations and freezers: every dry space but the truck sentinel,
 * by the METRC location it stands over, each once. */
export async function listDryingLocations(db: D1Database): Promise<DryingLocation[]> {
  const result = await db
    .prepare(
      `SELECT name, kind, space_type, location_name, farm_code FROM dry_spaces
       WHERE deleted_at IS NULL AND kind <> 'truck'
       ORDER BY CASE WHEN space_type = 'freezer' THEN 2 WHEN space_type = 'dry_room' THEN 1 ELSE 0 END, name`
    )
    .all<{ name: string; kind: string; space_type: string | null; location_name: string | null; farm_code: string | null }>();
  const seen = new Set<string>();
  const out: DryingLocation[] = [];
  for (const row of result.results ?? []) {
    const value = (row.location_name ?? "").trim() || row.name;
    if (seen.has(value)) continue;
    seen.add(value);
    out.push({ value, label: value === row.name ? row.name : `${row.name} (${value})`, kind: row.kind, space_type: row.space_type, farm_code: row.farm_code });
  }
  return out;
}

/** What the picker offers: the drying locations and freezers. */
export async function listReconcileLocations(db: D1Database, locale: Locale = "en"): Promise<DryingLocation[]> {
  void locale;
  return listDryingLocations(db);
}

/** The live ledger packages a picked location holds. */
export async function listReconcileItems(db: D1Database, location: string): Promise<LocalInventoryListRow[]> {
  return listLocalInventory(db, { location });
}

export type ReconcileNoteRow = {
  id: string;
  kind: string;
  farm_code: string | null;
  location: string;
  note: string;
  summary: string;
  detail: string | null;
  acknowledged_at: string | null;
  created_at: string;
  created_by_name: string | null;
};

const NOTE_SELECT = `SELECT n.id, n.kind, n.farm_code, n.location, n.note, n.summary, n.detail, n.acknowledged_at, n.created_at,
              COALESCE(p.email, p.display_name) AS created_by_name
       FROM reconcile_notes n
       LEFT JOIN people p ON p.id = n.created_by`;

/** The notes still standing on the queue, oldest first. */
export async function listOpenReconcileNotes(db: D1Database): Promise<ReconcileNoteRow[]> {
  const result = await db
    .prepare(`${NOTE_SELECT}
       WHERE n.deleted_at IS NULL AND n.acknowledged_at IS NULL
       ORDER BY n.created_at ASC`)
    .all<ReconcileNoteRow>();
  return result.results ?? [];
}

export async function getReconcileNote(db: D1Database, id: string): Promise<ReconcileNoteRow | null> {
  return db.prepare(`${NOTE_SELECT} WHERE n.id = ? AND n.deleted_at IS NULL`).bind(id).first<ReconcileNoteRow>();
}

function locationOf(form: FormData): string {
  const value = textOrNull(form.get("location"));
  if (!value) throw new HttpError(400, RECONCILE_REFUSAL.location);
  return value;
}

/** A location the picker offers: a drying location or a freezer. */
async function requireReconcileLocation(db: D1Database, value: string): Promise<DryingLocation> {
  const hit = (await listReconcileLocations(db)).find((l) => l.value === value);
  if (!hit) throw new HttpError(400, RECONCILE_REFUSAL.location);
  return hit;
}

function noteInsert(
  db: D1Database,
  row: { id: string; kind: string; farm_code: string | null; location: string; note: string; summary: string; detail: string | null },
  actorId: string,
  ts: string
): D1PreparedStatement[] {
  const record = { ...row, acknowledged_at: null, acknowledged_by: null, created_at: ts, created_by: actorId, updated_at: ts, updated_by: actorId };
  return [
    db
      .prepare(
        `INSERT INTO reconcile_notes (
          id, kind, farm_code, location, note, summary, detail, acknowledged_at, acknowledged_by,
          created_at, created_by, updated_at, updated_by, deleted_at, deleted_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?, ?, ?, ?, NULL, NULL)`
      )
      .bind(row.id, row.kind, row.farm_code, row.location, row.note, row.summary, row.detail, ts, actorId, ts, actorId),
    ...logsForInsert(db, "reconcile_notes", row.id, record, actorId, SYSTEM_REASON.reconcile_note, ts),
  ];
}

function packagesWord(n: number): string {
  return n === 1 ? "1 package" : `${n} packages`;
}

/** Purge: every live ledger package at the location is voided under the typed
 * reason (its delete_reason) and the Admin PIN, each with its change-log line;
 * one note rides the queue. Nothing at the location refuses in words. */
export async function purgeLocation(db: D1Database, form: FormData): Promise<ActionOk> {
  const actor = await requireActor(db, personIdFrom(form));
  const location = locationOf(form);
  await requireReconcileLocation(db, location);
  const reason = textOrNull(form.get("reason"));
  if (!reason) throw new HttpError(400, RECONCILE_REFUSAL.reason);
  const pin = await getConfigValue(db, CONFIG_KEYS.admin_pin);
  const entered = textOrNull(form.get("admin_pin"));
  if (!pin || entered !== pin) throw new HttpError(403, RECONCILE_REFUSAL.pin);
  const items = await listReconcileItems(db, location);
  if (items.length === 0) throw new HttpError(400, RECONCILE_REFUSAL.nothing);
  const ts = nowIso();
  const logReason = `${SYSTEM_REASON.reconcile_purge}: ${reason}`;
  const stmts: D1PreparedStatement[] = [];
  let grams = 0;
  for (const item of items) {
    grams += Number(item.qty ?? 0);
    stmts.push(
      db
        .prepare(
          `UPDATE local_inventory_items SET deleted_at = ?, deleted_by = ?, delete_reason = ?, updated_at = ?, updated_by = ?
           WHERE id = ? AND deleted_at IS NULL`
        )
        .bind(ts, actor.id, reason, ts, actor.id, item.id),
      insertLog(db, {
        record_table: "local_inventory_items",
        record_id: item.id,
        field: "deleted_at",
        old_value: null,
        new_value: ts,
        actor_person_id: actor.id,
        reason: logReason,
        changed_at: ts,
      })
    );
  }
  const noteId = crypto.randomUUID();
  const detail = JSON.stringify(
    items.map((i) => ({ id: i.id, package_code: i.package_code, metrc_tag: i.metrc_tag ?? null, item_kind: i.item_kind, qty: Number(i.qty ?? 0), farm_code: i.farm_code }))
  );
  stmts.push(
    ...noteInsert(
      db,
      {
        id: noteId,
        kind: RECONCILE_KIND.purge,
        farm_code: LANDING_FARM,
        location,
        note: reason,
        summary: `${packagesWord(items.length)} voided, ${formatGrams(Math.round(grams * 100) / 100)} g, at ${location}`,
        detail,
      },
      actor.id,
      ts
    )
  );
  await db.batch(stmts);
  return { redirect: `${LEDGER_LOCATION_PATH}?location=${encodeURIComponent(location)}&ok=purged&n=${items.length}` };
}

const EDIT_FIELDS = ["item_kind", "package_code", "metrc_tag", "qty", "farm_code", "location"] as const;
type EditField = (typeof EDIT_FIELDS)[number];

export function editFieldName(field: EditField, itemId: string): string {
  return `${field}__${itemId}`;
}

type Change = { item: LocalInventoryListRow; field: EditField; old: string | null; next: string | null; value: unknown };

/** Edit: every package at the location arrives with its fields; each field
 * that differs from the ledger becomes an UPDATE and a change-log line under
 * the one typed note; a form that changes nothing refuses in words. A package
 * may move only to another drying location. */
export async function saveLocationEdits(db: D1Database, form: FormData): Promise<ActionOk> {
  const actor = await requireActor(db, personIdFrom(form));
  const location = locationOf(form);
  await requireReconcileLocation(db, location);
  const note = textOrNull(form.get("note"));
  if (!note) throw new HttpError(400, RECONCILE_REFUSAL.note);
  // A package moves only to a drying location or freezer.
  const locations = await listDryingLocations(db);
  const items = await listReconcileItems(db, location);
  const changes: Change[] = [];
  for (const item of items) {
    // A field absent from the post is unchanged (canon 0.30.9 boundary law).
    const has = (f: EditField) => form.has(editFieldName(f, item.id));
    if (has("item_kind")) {
      const raw = String(textOrNull(form.get(editFieldName("item_kind", item.id))) ?? "").toUpperCase();
      if (!(ITEM_KIND_ORDER as readonly string[]).includes(raw)) throw new HttpError(400, RECONCILE_REFUSAL.kind);
      if (raw !== item.item_kind) changes.push({ item, field: "item_kind", old: item.item_kind, next: raw, value: raw });
    }
    if (has("package_code")) {
      const code = requireText(form.get(editFieldName("package_code", item.id)), "Package code");
      if (code !== item.package_code) changes.push({ item, field: "package_code", old: item.package_code, next: code, value: code });
    }
    if (has("metrc_tag")) {
      const tag = normalizeMetrcTag(textOrNull(form.get(editFieldName("metrc_tag", item.id))));
      const old = item.metrc_tag ?? null;
      if ((tag ?? null) !== old) changes.push({ item, field: "metrc_tag", old, next: tag, value: tag });
    }
    if (has("qty")) {
      const qty = parseGrams(form.get(editFieldName("qty", item.id)), "Grams");
      const old = Math.round(Number(item.qty ?? 0) * 100) / 100;
      if (qty !== old) changes.push({ item, field: "qty", old: String(old), next: String(qty), value: qty });
    }
    if (has("farm_code")) {
      const farm = requireText(form.get(editFieldName("farm_code", item.id)), "Farm").toUpperCase();
      if (farm !== item.farm_code) changes.push({ item, field: "farm_code", old: item.farm_code, next: farm, value: farm });
    }
    if (has("location")) {
      const next = requireText(form.get(editFieldName("location", item.id)), "Location");
      if (next !== item.location) {
        if (!locations.some((l) => l.value === next)) throw new HttpError(400, RECONCILE_REFUSAL.moved);
        changes.push({ item, field: "location", old: item.location, next, value: next });
      }
    }
  }
  if (changes.length === 0) throw new HttpError(400, RECONCILE_REFUSAL.unchanged);
  const ts = nowIso();
  const logReason = `${SYSTEM_REASON.reconcile_edit}: ${note}`;
  const stmts: D1PreparedStatement[] = [];
  for (const c of changes) {
    stmts.push(
      db
        .prepare(`UPDATE local_inventory_items SET ${c.field} = ?, updated_at = ?, updated_by = ? WHERE id = ? AND deleted_at IS NULL`)
        .bind(c.value, ts, actor.id, c.item.id),
      insertLog(db, {
        record_table: "local_inventory_items",
        record_id: c.item.id,
        field: c.field,
        old_value: c.old,
        new_value: c.next,
        actor_person_id: actor.id,
        reason: logReason,
        changed_at: ts,
      })
    );
  }
  const touched = new Set(changes.map((c) => c.item.id)).size;
  const noteId = crypto.randomUUID();
  const detail = JSON.stringify(
    changes.map((c) => ({ id: c.item.id, package_code: c.item.package_code, field: c.field, old: c.old, new: c.next }))
  );
  stmts.push(
    ...noteInsert(
      db,
      {
        id: noteId,
        kind: RECONCILE_KIND.edit,
        farm_code: LANDING_FARM,
        location,
        note,
        summary: `${changes.length === 1 ? "1 field" : `${changes.length} fields`} on ${packagesWord(touched)} edited at ${location}`,
        detail,
      },
      actor.id,
      ts
    )
  );
  await db.batch(stmts);
  return { redirect: `${LEDGER_LOCATION_PATH}?location=${encodeURIComponent(location)}&ok=edited&n=${changes.length}` };
}

/** Acknowledge: the note leaves the queue with the hand and the hour that saw it, logged. */
export async function acknowledgeReconcileNote(db: D1Database, id: string, form: FormData): Promise<ActionOk> {
  const actor = await requireActor(db, personIdFrom(form));
  const note = await getReconcileNote(db, id);
  if (!note) throw new HttpError(404, "Unknown reconcile note.");
  if (!note.acknowledged_at) {
    const ts = nowIso();
    await db.batch([
      db
        .prepare(
          `UPDATE reconcile_notes SET acknowledged_at = ?, acknowledged_by = ?, updated_at = ?, updated_by = ?
           WHERE id = ? AND acknowledged_at IS NULL AND deleted_at IS NULL`
        )
        .bind(ts, actor.id, ts, actor.id, id),
      insertLog(db, {
        record_table: "reconcile_notes",
        record_id: id,
        field: "acknowledged_at",
        old_value: null,
        new_value: ts,
        actor_person_id: actor.id,
        reason: SYSTEM_REASON.reconcile_acknowledged,
        changed_at: ts,
      }),
    ]);
  }
  return { redirect: "/admin/uploads?ok=acknowledged" };
}

/* ------------------------------------------------------------------ the page */

export type ReconcilePageInput = {
  farms: LookupOption[];
  locations: DryingLocation[];
  picked: string | null;
  items: LocalInventoryListRow[];
  openNotes: number;
  locale?: Locale;
  ok?: string;
  n?: string;
};

function flashFor(ok: string | undefined, n: string | undefined, locale: Locale): string {
  if (ok === "purged") {
    return `<p class="banner ok" data-reconcile-flash="purged">${esc(t(locale, "Purged. The packages are voided under your reason; a note waits on Pending Data Uploads."))}</p>`;
  }
  if (ok === "edited") {
    const count = Number(n ?? "0");
    const word = count === 1 ? t(locale, "1 field saved") : t(locale, "{n} fields saved").replace("{n}", String(count));
    return `<p class="banner ok" data-reconcile-flash="edited">${esc(word)}. ${esc(t(locale, "Every change is on the change log under your note; a note waits on Pending Data Uploads."))}</p>`;
  }
  return "";
}

export function reconcileLocationPage(input: ReconcilePageInput): string {
  const locale = input.locale ?? "en";
  const farmOptions = input.farms
    .map((f) => `<option value="${esc(f.value)}"${f.value === LANDING_FARM ? " selected" : ""}>${esc(f.label)}</option>`)
    .join("");
  const locationOptions = [
    `<option value="">${esc(t(locale, "Pick a location"))}</option>`,
    ...input.locations.map(
      (l) => `<option value="${esc(l.value)}"${input.picked === l.value ? " selected" : ""}>${esc(l.label)}</option>`
    ),
  ].join("");
  const picker = `<form class="stack reconcile-pick" method="get" action="${LEDGER_LOCATION_PATH}" data-reconcile-pick>
      <label class="field">${esc(t(locale, "Farm"))}
        <select name="farm" disabled data-farm-inert>${farmOptions}</select>
      </label>
      <p class="muted">${esc(t(locale, "One farm while Interco Logistics is out of the chain."))}</p>
      <label class="field">${esc(t(locale, "Location"))}
        <select name="location" required data-location-pick onchange="this.form.submit()">${locationOptions}</select>
      </label>
      <noscript><button type="submit" class="secondary">${esc(t(locale, "Show"))}</button></noscript>
    </form>`;
  const notesLine =
    input.openNotes > 0
      ? `<p class="muted" data-open-notes="${esc(String(input.openNotes))}"><a href="/admin/uploads">${esc(
          input.openNotes === 1 ? t(locale, "1 reconciliation note waits on Pending Data Uploads.") : t(locale, "{n} reconciliation notes wait on Pending Data Uploads.").replace("{n}", String(input.openNotes))
        )}</a></p>`
      : "";
  let body = "";
  if (input.picked) {
    const total = input.items.reduce((s, i) => s + Number(i.qty ?? 0), 0);
    const count = `<h2>${esc(input.picked)} <span class="tile-count" data-reconcile-count>${esc(String(input.items.length))}</span></h2>
      <p class="muted">${esc(
        input.items.length === 0
          ? t(locale, "No live ledger packages at this location.")
          : `${t(locale, "Live ledger packages")}: ${input.items.length} · ${formatGrams(Math.round(total * 100) / 100)} g`
      )}</p>`;
    if (input.items.length === 0) {
      body = `${count}`;
    } else {
      const kindOptions = (current: string) =>
        ITEM_KIND_ORDER.map((k) => `<option value="${k}"${k === current ? " selected" : ""}>${k}</option>`).join("");
      const moveTargets = input.locations;
      const locOptions = (current: string) => {
        const known = moveTargets.some((l) => l.value === current);
        return [
          ...(known ? [] : [`<option value="${esc(current)}" selected>${esc(current)}</option>`]),
          ...moveTargets.map((l) => `<option value="${esc(l.value)}"${l.value === current ? " selected" : ""}>${esc(l.label)}</option>`),
        ].join("");
      };
      const rows = input.items
        .map(
          (i) => `<tr data-reconcile-item="${esc(i.id)}">
          <td><select name="${esc(editFieldName("item_kind", i.id))}">${kindOptions(i.item_kind)}</select></td>
          <td><input type="text" name="${esc(editFieldName("package_code", i.id))}" value="${esc(i.package_code)}" required></td>
          <td><input type="text" name="${esc(editFieldName("metrc_tag", i.id))}" value="${esc(i.metrc_tag ?? "")}" placeholder="1A4..."></td>
          <td>${esc(i.strain_name ?? "")}</td>
          <td class="hbn">${esc(i.hbn ?? "")}</td>
          <td><input type="text" name="${esc(editFieldName("qty", i.id))}" value="${esc(String(Math.round(Number(i.qty ?? 0) * 100) / 100))}" inputmode="decimal" class="grams" required></td>
          <td><input type="text" name="${esc(editFieldName("farm_code", i.id))}" value="${esc(i.farm_code)}" size="4" required></td>
          <td><select name="${esc(editFieldName("location", i.id))}">${locOptions(i.location)}</select></td>
        </tr>`
        )
        .join("");
      const head = `<tr><th>${esc(t(locale, "Kind"))}</th><th>${esc(t(locale, "Package code"))}</th><th>${esc(t(locale, "METRC tag"))}</th><th>${esc(
        t(locale, "Strain")
      )}</th><th>HBN</th><th>${esc(t(locale, "Grams"))}</th><th>${esc(t(locale, "Farm"))}</th><th>${esc(t(locale, "Location"))}</th></tr>`;
      const editForm = `<details class="reconcile-edit" data-reconcile-edit open>
        <summary>${esc(t(locale, "Edit"))}</summary>
        <form class="stack" method="post" action="${LEDGER_LOCATION_EDIT_PATH}" data-reconcile-edit-form>
          <input type="hidden" name="location" value="${esc(input.picked)}">
          <table class="data wide reconcile-table"><thead>${head}</thead><tbody>${rows}</tbody></table>
          <label class="field">${esc(t(locale, "Note"))} <input type="text" name="note" required placeholder="${esc(t(locale, "why these change"))}"></label>
          <p class="muted">${esc(t(locale, "Every changed field lands on the change log under this note. No METRC file is cut; a note that can be acknowledged waits on Pending Data Uploads."))}</p>
          <button type="submit">${esc(t(locale, "Save changes"))}</button>
        </form>
      </details>`;
      const purgeForm = `<details class="reconcile-purge" data-reconcile-purge>
        <summary>${esc(t(locale, "Purge"))}</summary>
        <form class="stack" method="post" action="${LEDGER_LOCATION_PURGE_PATH}" data-reconcile-purge-form>
          <input type="hidden" name="location" value="${esc(input.picked)}">
          <p class="muted">${esc(
            t(locale, "Voids every live ledger package at this location under your reason. Lots, loads and METRC's own records are untouched; a note that can be acknowledged waits on Pending Data Uploads.")
          )}</p>
          <label class="field">${esc(t(locale, "Reason"))} <input type="text" name="reason" required></label>
          <label class="field">${esc(t(locale, "Admin PIN"))} <input type="password" name="admin_pin" inputmode="numeric" autocomplete="off" required></label>
          <button type="submit" class="danger">${esc(t(locale, "Purge"))} ${esc(String(input.items.length))}</button>
        </form>
      </details>`;
      body = `${count}${editForm}${purgeForm}`;
    }
  } else {
    body = `<p class="muted">${esc(t(locale, "Pick a location to see what the ledger holds there."))}</p>`;
  }
  return `<h1>${esc(t(locale, "Reconcile Ledger Location"))}</h1>
    ${flashFor(input.ok, input.n, locale)}
    ${notesLine}
    ${picker}
    <section class="reconcile-body" data-reconcile-location="${esc(input.picked ?? "")}">${body}</section>`;
}

/** The queue's section: one row per open note with its Acknowledge control;
 * an empty list renders nothing. */
export function reconcileNotesSection(rows: ReconcileNoteRow[], locale: Locale = "en"): string {
  if (rows.length === 0) return "";
  const head = `<tr><th>${esc(t(locale, "When"))}</th><th>${esc(t(locale, "Kind"))}</th><th>${esc(t(locale, "Location"))}</th><th>${esc(
    t(locale, "Note")
  )}</th><th>${esc(t(locale, "What changed"))}</th><th>${esc(t(locale, "By"))}</th><th>${esc(t(locale, "Controls"))}</th></tr>`;
  const body = rows
    .map(
      (r) => `<tr data-reconcile-note="${esc(r.id)}" data-reconcile-kind="${esc(r.kind)}">
        <td>${esc(r.created_at)}</td>
        <td>${esc(t(locale, r.kind === RECONCILE_KIND.purge ? "Purge" : "Edit"))}</td>
        <td>${esc(r.location)}</td>
        <td>${esc(r.note)}</td>
        <td>${esc(r.summary)}</td>
        <td>${esc(r.created_by_name ?? "")}</td>
        <td class="row-actions">
          <form method="post" action="${esc(reconcileNoteAckPath(r.id))}">
            <button type="submit">${esc(t(locale, "Acknowledge"))}</button>
          </form>
        </td>
      </tr>`
    )
    .join("");
  return `<details class="queue-fold" data-fold="reconcile_notes" open><summary><h2 data-count="${rows.length}">${esc(t(locale, "Reconciliation notes"))} <span class="tile-count">${rows.length}</span></h2></summary>
    <p class="muted">${esc(t(locale, "Ledger changes made on Reconcile Ledger Location. No METRC file rides them; acknowledging records that a hand saw the change."))}</p>
    <table class="data" data-reconcile-notes><thead>${head}</thead><tbody>${body}</tbody></table></details>`;
}
