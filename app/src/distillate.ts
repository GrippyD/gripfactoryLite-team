/**
 * LD1, the distillate ledger (canon 0.30.561).
 * Zoho listings with UOM L are the liters on hand. The ledger records what a
 * processor finished, what shipped, and a signed adjust, plus physical counts.
 * Grams are stored. Liters are grams over 1,000, shown to two decimals.
 * BowHouse yield stays blank: toll lots record a customer and no returned liters.
 */

import { HttpError, nowIso, requireReason, textOrNull } from "./audit";
import { roundGrams } from "./config";
import { insertLog, logsForInsert, requireActor } from "./db";
import { farmToday } from "./effective";
import { isCalendarDate } from "./farmday";
import { t, type Locale } from "./i18n";
import { reportCsv, type ReportColumn, type ReportView } from "./reports";
import { tollLotSql } from "./toll";

export const DISTILLATE_ON_HAND_KEY = "distillate_on_hand" as const;
export const PROCESSORS_PATH = "/admin/lookups/processors";
export const DISTILLATE_ENTRY_PATH = "/ops/distillate";
export const GRAMS_PER_LITER = 1000;
export const BOWHOUSE_ID = "proc-bowhouse";
export const ENTRY_LOG_REASON = "distillate entry";

export const SEED_PROCESSORS: ReadonlyArray<{ id: string; name: string }> = [
  { id: BOWHOUSE_ID, name: "BowHouse" },
  { id: "proc-mitten", name: "Mitten" },
  { id: "proc-sauce", name: "Sauce" },
  { id: "proc-cannalicious", name: "Cannalicious" },
  { id: "proc-oakcanna", name: "Oakcanna" },
  { id: "proc-golden-lion", name: "Golden Lion" },
];

export const MOVEMENT_KINDS = ["finished", "shipped", "adjust"] as const;
export type MovementKind = (typeof MOVEMENT_KINDS)[number];

/** Bare columns, bound dates. The year predicate leads so the year index applies. */
export const MOVEMENTS_AS_OF_SQL = `SELECT id, moved_on, harvest_year, processor, kind, grams, ref, note, entered_by, created_at, voided_at
  FROM distillate_movements
  WHERE moved_on <= ? AND voided_at IS NULL`;

export const MOVEMENTS_YEAR_SQL = `SELECT id, moved_on, harvest_year, processor, kind, grams, ref, note, entered_by, created_at, voided_at
  FROM distillate_movements
  WHERE harvest_year = ? AND moved_on <= ? AND voided_at IS NULL`;

export const COUNTS_AS_OF_SQL = `SELECT id, counted_on, harvest_year, processor, grams, counted_by, note, created_at, voided_at
  FROM distillate_counts
  WHERE counted_on <= ? AND voided_at IS NULL`;

export const COUNTS_YEAR_SQL = `SELECT id, counted_on, harvest_year, processor, grams, counted_by, note, created_at, voided_at
  FROM distillate_counts
  WHERE harvest_year = ? AND counted_on <= ? AND voided_at IS NULL`;

export const RECENT_MOVEMENTS_SQL = `SELECT id, moved_on, harvest_year, processor, kind, grams, ref, note, voided_at, created_at
  FROM distillate_movements
  WHERE moved_on <= ?
  ORDER BY moved_on DESC, created_at DESC
  LIMIT 20`;

export const RECENT_MOVEMENTS_YEAR_SQL = `SELECT id, moved_on, harvest_year, processor, kind, grams, ref, note, voided_at, created_at
  FROM distillate_movements
  WHERE harvest_year = ? AND moved_on <= ?
  ORDER BY moved_on DESC, created_at DESC
  LIMIT 20`;

export const RECENT_COUNTS_SQL = `SELECT id, counted_on, harvest_year, processor, grams, note, voided_at, created_at
  FROM distillate_counts
  WHERE counted_on <= ?
  ORDER BY counted_on DESC, created_at DESC
  LIMIT 20`;

export const RECENT_COUNTS_YEAR_SQL = `SELECT id, counted_on, harvest_year, processor, grams, note, voided_at, created_at
  FROM distillate_counts
  WHERE harvest_year = ? AND counted_on <= ?
  ORDER BY counted_on DESC, created_at DESC
  LIMIT 20`;

const METRC_DISTILLATE_SQL = `SELECT quantity, uom, item, category
  FROM metrc_packages
  WHERE gone_at IS NULL
    AND (lower(item) LIKE '%distillate%' OR lower(category) LIKE '%distillate%')`;

const ZOHO_DISTILLATE_SQL = `SELECT item_name, market_uom, market_qty, zoho_mounted_at
  FROM listings
  WHERE source = 'zoho' AND deleted_at IS NULL AND lower(item_name) LIKE '%distillate%'`;

export type ProcessorRow = {
  id: string;
  name: string;
  active: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type MovementRow = {
  id: string;
  moved_on: string;
  harvest_year: string;
  processor: string;
  kind: string;
  grams: number;
  ref: string | null;
  note: string | null;
  voided_at: string | null;
  created_at: string;
};

export type CountRow = {
  id: string;
  counted_on: string;
  harvest_year: string;
  processor: string | null;
  grams: number;
  note: string | null;
  voided_at: string | null;
  created_at: string;
};

type ActionOk = { redirect: string };

function esc(s: unknown): string {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function clip(raw: unknown, max: number): string {
  const text = String(raw ?? "").trim();
  return text.length > max ? text.slice(0, max) : text;
}

function personIdFrom(form: FormData): string | null {
  return textOrNull(form.get("person_id"));
}

/** T1 records a toll customer and no returned liters. Yield stays blank. */
export function bowHouseYieldLitersPerPound(): null {
  return null;
}

export function litersToGrams(liters: number): number {
  return roundGrams(liters * GRAMS_PER_LITER);
}

export function formatLitersFromGrams(grams: number): string {
  const liters = Number(grams) / GRAMS_PER_LITER;
  if (!Number.isFinite(liters)) return "";
  const rounded = Math.sign(liters) * Math.round(Math.abs(liters) * 100) / 100;
  const safe = Object.is(rounded, -0) ? 0 : rounded;
  return safe.toFixed(2);
}

export function harvestYearFromItemName(name: string): string | null {
  const match = /(?:^|[^0-9])(20\d{2})(?![0-9])/.exec(name);
  return match ? match[1] : null;
}

export function isLiterUom(uom: string | null | undefined): boolean {
  return (uom ?? "").trim().toLowerCase() === "l";
}

export type LedgerMove = { kind: string; grams: number; moved_on: string; voided_at?: string | null; processor?: string; harvest_year?: string };

/** Finished minus shipped plus adjust, over the rows handed in. */
export function ledgerGrams(rows: readonly LedgerMove[]): number {
  let finished = 0;
  let shipped = 0;
  let adjust = 0;
  for (const row of rows) {
    if (row.voided_at) continue;
    const grams = Number(row.grams);
    if (!Number.isFinite(grams)) continue;
    if (row.kind === "finished") finished += grams;
    else if (row.kind === "shipped") shipped += grams;
    else if (row.kind === "adjust") adjust += grams;
  }
  return finished - shipped + adjust;
}

export function varianceOverOneLiter(countGrams: number, ledgerAtCount: number): boolean {
  return Math.abs(Number(countGrams) - Number(ledgerAtCount)) > GRAMS_PER_LITER;
}

type KindParts = { finished: number; shipped: number; adjust: number; ledger: number };

function partsOf(rows: readonly LedgerMove[]): KindParts {
  let finished = 0;
  let shipped = 0;
  let adjust = 0;
  for (const row of rows) {
    if (row.voided_at) continue;
    const grams = Number(row.grams);
    if (!Number.isFinite(grams)) continue;
    if (row.kind === "finished") finished += grams;
    else if (row.kind === "shipped") shipped += grams;
    else if (row.kind === "adjust") adjust += grams;
  }
  return { finished, shipped, adjust, ledger: finished - shipped + adjust };
}

function rowsAsOf(rows: readonly LedgerMove[], asOf: string): LedgerMove[] {
  return rows.filter((row) => row.moved_on <= asOf);
}

export function metrcDistillateLiters(
  rows: readonly { quantity: number | null; uom: string | null; item?: string | null; category?: string | null }[]
): number | null {
  let liters = 0;
  let any = false;
  for (const row of rows) {
    const label = `${row.item ?? ""} ${row.category ?? ""}`;
    if (!/distillate/i.test(label)) continue;
    const uom = (row.uom ?? "").trim().toLowerCase();
    const qty = Number(row.quantity);
    if (!Number.isFinite(qty)) continue;
    if (uom === "l" || uom === "liter" || uom === "liters" || uom === "litre" || uom === "litres") {
      liters += qty;
      any = true;
    } else if (uom === "g" || uom === "gram" || uom === "grams") {
      liters += qty / GRAMS_PER_LITER;
      any = true;
    }
  }
  return any ? liters : null;
}

export async function listProcessors(db: D1Database): Promise<ProcessorRow[]> {
  const result = await db
    .prepare(
      `SELECT id, name, active, created_at, updated_at, deleted_at
       FROM processors
       ORDER BY name`
    )
    .all<ProcessorRow>();
  return result.results ?? [];
}

export async function listActiveProcessors(db: D1Database): Promise<Array<{ id: string; name: string }>> {
  const result = await db
    .prepare(
      `SELECT id, name FROM processors
       WHERE active = 1 AND deleted_at IS NULL
       ORDER BY name`
    )
    .all<{ id: string; name: string }>();
  return result.results ?? [];
}

export function processorsPage(rows: readonly ProcessorRow[], locale: Locale, ok?: string): string {
  const flash = ok ? `<p class="banner ok" data-processor-flash>${esc(t(locale, "Saved."))}</p>` : "";
  const body = rows
    .map((row) => {
      const deleted = row.deleted_at != null && row.deleted_at !== "";
      const yieldHtml = row.id === BOWHOUSE_ID ? `<td data-bowhouse-yield=""></td>` : `<td></td>`;
      const controls = deleted
        ? `<td>${esc(t(locale, "Deleted"))}</td>`
        : `<td>
            <form method="post" action="${PROCESSORS_PATH}" class="stack" data-processor-rename>
              <input type="hidden" name="action" value="rename">
              <input type="hidden" name="id" value="${esc(row.id)}">
              <label class="field">${esc(t(locale, "Name"))} <input name="name" value="${esc(row.name)}" required maxlength="80"></label>
              <label class="field">${esc(t(locale, "Reason"))} <input name="reason" required></label>
              <button type="submit">${esc(t(locale, "Rename"))}</button>
            </form>
            <form method="post" action="${PROCESSORS_PATH}" data-processor-active>
              <input type="hidden" name="action" value="active">
              <input type="hidden" name="id" value="${esc(row.id)}">
              <input type="hidden" name="active" value="${row.active === 1 ? "0" : "1"}">
              <label class="field">${esc(t(locale, "Reason"))} <input name="reason" required></label>
              <button type="submit">${esc(t(locale, row.active === 1 ? "Mark inactive" : "Mark active"))}</button>
            </form>
            <form method="post" action="${PROCESSORS_PATH}" data-processor-delete>
              <input type="hidden" name="action" value="delete">
              <input type="hidden" name="id" value="${esc(row.id)}">
              <label class="field">${esc(t(locale, "Reason"))} <input name="reason" required></label>
              <button type="submit">${esc(t(locale, "Soft delete"))}</button>
            </form>
          </td>`;
      return `<tr data-processor="${esc(row.name)}" data-processor-id="${esc(row.id)}" data-active="${row.active === 1 ? "1" : "0"}" data-deleted="${deleted ? "1" : "0"}">
        <td>${esc(row.name)}</td>
        <td>${esc(t(locale, row.active === 1 ? "Yes" : "No"))}</td>
        ${yieldHtml}
        ${controls}
      </tr>`;
    })
    .join("");
  return `<h1>${esc(t(locale, "Processors"))}</h1>
    ${flash}
    <p class="muted">${esc(t(locale, "BowHouse yield is blank. Toll lots record no liters returned."))}</p>
    <form method="post" action="${PROCESSORS_PATH}" class="stack" data-processor-add>
      <input type="hidden" name="action" value="add">
      <label class="field">${esc(t(locale, "Name"))} <input name="name" required maxlength="80"></label>
      <label class="field">${esc(t(locale, "Reason"))} <input name="reason" required></label>
      <button type="submit">${esc(t(locale, "Add processor"))}</button>
    </form>
    <table class="data">
      <thead><tr>
        <th>${esc(t(locale, "Name"))}</th>
        <th>${esc(t(locale, "Active"))}</th>
        <th>${esc(t(locale, "Yield (L per lb)"))}</th>
        <th>${esc(t(locale, "Edit"))}</th>
      </tr></thead>
      <tbody>${body}</tbody>
    </table>`;
}

export async function saveProcessor(db: D1Database, form: FormData): Promise<ActionOk> {
  const actor = await requireActor(db, personIdFrom(form));
  const action = String(form.get("action") ?? "add");
  const reason = requireReason(textOrNull(form.get("reason")));
  const ts = nowIso();
  const back = `${PROCESSORS_PATH}?ok=1`;
  if (action === "add") {
    const name = clip(form.get("name"), 80);
    if (!name) throw new HttpError(400, "A processor needs a name.");
    const existing = await listProcessors(db);
    if (existing.some((row) => row.name.toLowerCase() === name.toLowerCase())) {
      throw new HttpError(400, "That name is already in the lookup.");
    }
    const id = crypto.randomUUID();
    const record = {
      id,
      name,
      active: 1,
      created_at: ts,
      created_by: actor.id,
      updated_at: ts,
      updated_by: actor.id,
    };
    await db.batch([
      db
        .prepare(
          `INSERT INTO processors (
            id, name, active, created_at, created_by, updated_at, updated_by, deleted_at, deleted_by
          ) VALUES (?, ?, 1, ?, ?, ?, ?, NULL, NULL)`
        )
        .bind(id, name, ts, actor.id, ts, actor.id),
      ...logsForInsert(db, "processors", id, record, actor.id, reason, ts),
    ]);
    return { redirect: back };
  }
  const id = textOrNull(form.get("id"));
  if (!id) throw new HttpError(400, "Unknown row.");
  const current = await db
    .prepare(
      `SELECT id, name, active, deleted_at FROM processors WHERE id = ?`
    )
    .bind(id)
    .first<{ id: string; name: string; active: number; deleted_at: string | null }>();
  if (!current) throw new HttpError(404, "Unknown row.");
  if (current.deleted_at) throw new HttpError(400, "That row is already voided.");
  if (action === "rename") {
    const name = clip(form.get("name"), 80);
    if (!name) throw new HttpError(400, "A processor needs a name.");
    const existing = await listProcessors(db);
    if (existing.some((row) => row.id !== id && row.name.toLowerCase() === name.toLowerCase())) {
      throw new HttpError(400, "That name is already in the lookup.");
    }
    if (name === current.name) return { redirect: back };
    await db.batch([
      db
        .prepare(`UPDATE processors SET name = ?, updated_at = ?, updated_by = ? WHERE id = ? AND deleted_at IS NULL`)
        .bind(name, ts, actor.id, id),
      insertLog(db, {
        record_table: "processors",
        record_id: id,
        field: "name",
        old_value: current.name,
        new_value: name,
        actor_person_id: actor.id,
        reason,
        changed_at: ts,
      }),
    ]);
    return { redirect: back };
  }
  if (action === "active") {
    const active = String(form.get("active") ?? "") === "1" ? 1 : 0;
    if (active === Number(current.active)) return { redirect: back };
    await db.batch([
      db
        .prepare(`UPDATE processors SET active = ?, updated_at = ?, updated_by = ? WHERE id = ? AND deleted_at IS NULL`)
        .bind(active, ts, actor.id, id),
      insertLog(db, {
        record_table: "processors",
        record_id: id,
        field: "active",
        old_value: String(current.active),
        new_value: String(active),
        actor_person_id: actor.id,
        reason,
        changed_at: ts,
      }),
    ]);
    return { redirect: back };
  }
  if (action === "delete") {
    await db.batch([
      db
        .prepare(
          `UPDATE processors SET deleted_at = ?, deleted_by = ?, updated_at = ?, updated_by = ?
           WHERE id = ? AND deleted_at IS NULL`
        )
        .bind(ts, actor.id, ts, actor.id, id),
      insertLog(db, {
        record_table: "processors",
        record_id: id,
        field: "deleted_at",
        old_value: null,
        new_value: ts,
        actor_person_id: actor.id,
        reason,
        changed_at: ts,
      }),
    ]);
    return { redirect: back };
  }
  throw new HttpError(400, "Unknown row.");
}

type TollOption = { id: string; hbn: string; customer: string };

export type DistillateDesk = {
  today: string;
  processors: Array<{ id: string; name: string }>;
  tollLots: TollOption[];
  movements: MovementRow[];
  counts: CountRow[];
  names: Map<string, string>;
};

export async function loadDistillateDesk(db: D1Database, today: string): Promise<DistillateDesk> {
  const processors = await listActiveProcessors(db);
  const all = await listProcessors(db);
  const names = new Map(all.map((row) => [row.id, row.name]));
  const toll = await db
    .prepare(
      `SELECT id, hbn, customer FROM harvest_batches
       WHERE deleted_at IS NULL AND ${tollLotSql("")}
       ORDER BY hbn`
    )
    .all<TollOption>();
  const movements = await db.prepare(RECENT_MOVEMENTS_SQL).bind(today).all<MovementRow>();
  const counts = await db.prepare(RECENT_COUNTS_SQL).bind(today).all<CountRow>();
  return {
    today,
    processors,
    tollLots: toll.results ?? [],
    movements: movements.results ?? [],
    counts: counts.results ?? [],
    names,
  };
}

function kindOptions(locale: Locale): string {
  return MOVEMENT_KINDS.map((kind) => `<option value="${kind}">${esc(t(locale, kindLabel(kind)))}</option>`).join("");
}

function kindLabel(kind: string): string {
  if (kind === "finished") return "Finished";
  if (kind === "shipped") return "Shipped";
  return "Adjust";
}

function processorOptions(rows: ReadonlyArray<{ id: string; name: string }>, blank: string): string {
  const head = blank ? `<option value="">${esc(blank)}</option>` : "";
  const body = rows
    .map((row) => `<option value="${esc(row.id)}" data-processor-option="${esc(row.name)}">${esc(row.name)}</option>`)
    .join("");
  return head + body;
}

export function distillateEntryPage(desk: DistillateDesk, locale: Locale, ok?: string): string {
  const flash = ok ? `<p class="banner ok" data-distillate-flash>${esc(t(locale, "Saved."))}</p>` : "";
  const procs = processorOptions(desk.processors, "");
  const countProcs = processorOptions(desk.processors, t(locale, "House count"));
  const tolls = [`<option value="">${esc(t(locale, "from toll lot"))}</option>`]
    .concat(
      desk.tollLots.map(
        (lot) => `<option value="${esc(lot.id)}">${esc(lot.hbn)} ${esc(lot.customer)}</option>`
      )
    )
    .join("");
  const moves = desk.movements
    .map((row) => {
      const voided = row.voided_at ? "1" : "0";
      const voidForm = row.voided_at
        ? esc(t(locale, "Voided"))
        : `<form method="post" action="${DISTILLATE_ENTRY_PATH}">
            <input type="hidden" name="action" value="void">
            <input type="hidden" name="table" value="movements">
            <input type="hidden" name="id" value="${esc(row.id)}">
            <label class="field">${esc(t(locale, "Reason"))} <input name="reason" required></label>
            <button type="submit">${esc(t(locale, "Void"))}</button>
          </form>`;
      return `<tr data-movement-kind="${esc(row.kind)}" data-movement-id="${esc(row.id)}" data-voided="${voided}">
        <td>${esc(row.moved_on)}</td>
        <td>${esc(row.harvest_year)}</td>
        <td>${esc(desk.names.get(row.processor) ?? row.processor)}</td>
        <td>${esc(t(locale, kindLabel(row.kind)))}</td>
        <td>${esc(formatLitersFromGrams(Number(row.grams)))}</td>
        <td>${esc(row.ref ?? "")}</td>
        <td>${esc(row.note ?? "")}</td>
        <td>${voidForm}</td>
      </tr>`;
    })
    .join("");
  const counts = desk.counts
    .map((row) => {
      const voided = row.voided_at ? "1" : "0";
      const voidForm = row.voided_at
        ? esc(t(locale, "Voided"))
        : `<form method="post" action="${DISTILLATE_ENTRY_PATH}">
            <input type="hidden" name="action" value="void">
            <input type="hidden" name="table" value="counts">
            <input type="hidden" name="id" value="${esc(row.id)}">
            <label class="field">${esc(t(locale, "Reason"))} <input name="reason" required></label>
            <button type="submit">${esc(t(locale, "Void"))}</button>
          </form>`;
      const who = row.processor ? desk.names.get(row.processor) ?? row.processor : t(locale, "House count");
      return `<tr data-count-id="${esc(row.id)}" data-voided="${voided}">
        <td>${esc(row.counted_on)}</td>
        <td>${esc(row.harvest_year)}</td>
        <td>${esc(who)}</td>
        <td>${esc(formatLitersFromGrams(Number(row.grams)))}</td>
        <td>${esc(row.note ?? "")}</td>
        <td>${voidForm}</td>
      </tr>`;
    })
    .join("");
  return `<h1>${esc(t(locale, "Distillate"))}</h1>
    ${flash}
    <form method="post" action="${DISTILLATE_ENTRY_PATH}" class="stack" data-distillate-movement>
      <input type="hidden" name="action" value="movement">
      <label class="field">${esc(t(locale, "Date"))} <input type="date" name="moved_on" required value="${esc(desk.today)}"></label>
      <label class="field">${esc(t(locale, "Harvest year"))} <input name="harvest_year" required maxlength="4" inputmode="numeric"></label>
      <label class="field">${esc(t(locale, "Processor"))} <select name="processor" required>${procs}</select></label>
      <label class="field">${esc(t(locale, "Kind"))} <select name="kind" required>${kindOptions(locale)}</select></label>
      <label class="field">${esc(t(locale, "Liters"))} <input name="liters" required inputmode="decimal"></label>
      <label class="field">${esc(t(locale, "Reference"))} <input name="ref" maxlength="120"></label>
      <label class="field">${esc(t(locale, "from toll lot"))} <select name="toll_lot">${tolls}</select></label>
      <label class="field">${esc(t(locale, "Note"))} <input name="note" maxlength="500"></label>
      <button type="submit">${esc(t(locale, "Add a movement"))}</button>
    </form>
    <form method="post" action="${DISTILLATE_ENTRY_PATH}" class="stack" data-distillate-count>
      <input type="hidden" name="action" value="count">
      <label class="field">${esc(t(locale, "Date"))} <input type="date" name="counted_on" required value="${esc(desk.today)}"></label>
      <label class="field">${esc(t(locale, "Harvest year"))} <input name="harvest_year" required maxlength="4" inputmode="numeric"></label>
      <label class="field">${esc(t(locale, "Processor"))} <select name="processor">${countProcs}</select></label>
      <label class="field">${esc(t(locale, "Liters"))} <input name="liters" required inputmode="decimal"></label>
      <label class="field">${esc(t(locale, "Note"))} <input name="note" maxlength="500"></label>
      <button type="submit">${esc(t(locale, "Add a count"))}</button>
    </form>
    <h2>${esc(t(locale, "Recent movements"))}</h2>
    <table class="data"><thead><tr>
      <th>${esc(t(locale, "Date"))}</th>
      <th>${esc(t(locale, "Harvest year"))}</th>
      <th>${esc(t(locale, "Processor"))}</th>
      <th>${esc(t(locale, "Kind"))}</th>
      <th>${esc(t(locale, "Liters"))}</th>
      <th>${esc(t(locale, "Reference"))}</th>
      <th>${esc(t(locale, "Note"))}</th>
      <th>${esc(t(locale, "Void"))}</th>
    </tr></thead><tbody>${moves}</tbody></table>
    <h2>${esc(t(locale, "Recent counts"))}</h2>
    <table class="data"><thead><tr>
      <th>${esc(t(locale, "Date"))}</th>
      <th>${esc(t(locale, "Harvest year"))}</th>
      <th>${esc(t(locale, "Processor"))}</th>
      <th>${esc(t(locale, "Liters"))}</th>
      <th>${esc(t(locale, "Note"))}</th>
      <th>${esc(t(locale, "Void"))}</th>
    </tr></thead><tbody>${counts}</tbody></table>`;
}

function parseLiters(raw: unknown): number {
  const text = String(raw ?? "").trim();
  if (!/^-?\d+(\.\d+)?$/.test(text)) throw new HttpError(400, "Liters must be a number.");
  const n = Number(text);
  if (!Number.isFinite(n)) throw new HttpError(400, "Liters must be a number.");
  return n;
}

function parseYear(raw: unknown): string {
  const text = String(raw ?? "").trim();
  if (!/^20\d{2}$/.test(text)) throw new HttpError(400, "Harvest year is four digits.");
  return text;
}

async function assertDate(db: D1Database, raw: unknown, label: string): Promise<string> {
  const date = String(raw ?? "").trim();
  if (!isCalendarDate(date)) throw new HttpError(400, `${label} must be a date.`);
  const today = await farmToday(db, nowIso());
  if (date > today) throw new HttpError(400, "That date is in the future.");
  return date;
}

async function liveProcessor(db: D1Database, id: string): Promise<{ id: string; name: string }> {
  const row = await db
    .prepare(`SELECT id, name, active, deleted_at FROM processors WHERE id = ?`)
    .bind(id)
    .first<{ id: string; name: string; active: number; deleted_at: string | null }>();
  if (!row || row.deleted_at) throw new HttpError(400, "Pick a processor.");
  if (Number(row.active) !== 1) throw new HttpError(400, "That processor is not active.");
  return { id: row.id, name: row.name };
}

export async function saveDistillateEntry(db: D1Database, form: FormData): Promise<ActionOk> {
  const actor = await requireActor(db, personIdFrom(form));
  const action = String(form.get("action") ?? "");
  const ts = nowIso();
  if (action === "void") {
    const reason = requireReason(textOrNull(form.get("reason")));
    const id = textOrNull(form.get("id"));
    const table = String(form.get("table") ?? "");
    if (!id) throw new HttpError(400, "Unknown row.");
    if (table === "movements") {
      const row = await db
        .prepare(`SELECT id, voided_at FROM distillate_movements WHERE id = ?`)
        .bind(id)
        .first<{ id: string; voided_at: string | null }>();
      if (!row) throw new HttpError(404, "Unknown row.");
      if (row.voided_at) throw new HttpError(400, "That row is already voided.");
      await db.batch([
        db.prepare(`UPDATE distillate_movements SET voided_at = ? WHERE id = ? AND voided_at IS NULL`).bind(ts, id),
        insertLog(db, {
          record_table: "distillate_movements",
          record_id: id,
          field: "voided_at",
          old_value: null,
          new_value: ts,
          actor_person_id: actor.id,
          reason,
          changed_at: ts,
        }),
      ]);
      return { redirect: `${DISTILLATE_ENTRY_PATH}?ok=1` };
    }
    if (table === "counts") {
      const row = await db
        .prepare(`SELECT id, voided_at FROM distillate_counts WHERE id = ?`)
        .bind(id)
        .first<{ id: string; voided_at: string | null }>();
      if (!row) throw new HttpError(404, "Unknown row.");
      if (row.voided_at) throw new HttpError(400, "That row is already voided.");
      await db.batch([
        db.prepare(`UPDATE distillate_counts SET voided_at = ? WHERE id = ? AND voided_at IS NULL`).bind(ts, id),
        insertLog(db, {
          record_table: "distillate_counts",
          record_id: id,
          field: "voided_at",
          old_value: null,
          new_value: ts,
          actor_person_id: actor.id,
          reason,
          changed_at: ts,
        }),
      ]);
      return { redirect: `${DISTILLATE_ENTRY_PATH}?ok=1` };
    }
    throw new HttpError(400, "Unknown row.");
  }
  if (action === "movement") {
    const movedOn = await assertDate(db, form.get("moved_on"), "Date");
    const year = parseYear(form.get("harvest_year"));
    const processor = await liveProcessor(db, String(form.get("processor") ?? ""));
    const kind = String(form.get("kind") ?? "");
    if (!MOVEMENT_KINDS.includes(kind as MovementKind)) throw new HttpError(400, "Kind must be finished, shipped, or adjust.");
    const liters = parseLiters(form.get("liters"));
    const grams = litersToGrams(liters);
    if (kind === "adjust") {
      if (grams === 0) throw new HttpError(400, "A movement needs liters above zero.");
      if (!textOrNull(form.get("note"))) throw new HttpError(400, "An adjustment needs a note.");
    } else if (grams <= 0) {
      throw new HttpError(400, "A movement needs liters above zero.");
    }
    const tollId = textOrNull(form.get("toll_lot"));
    let ref = clip(form.get("ref"), 120) || null;
    if (tollId) {
      const lot = await db
        .prepare(
          `SELECT id, hbn FROM harvest_batches WHERE id = ? AND deleted_at IS NULL AND ${tollLotSql("")}`
        )
        .bind(tollId)
        .first<{ id: string; hbn: string }>();
      if (!lot) throw new HttpError(400, "Pick a toll lot.");
      ref = `toll lot ${lot.hbn}`;
    }
    const note = clip(form.get("note"), 500) || null;
    const id = crypto.randomUUID();
    const record: Record<string, unknown> = {
      id,
      moved_on: movedOn,
      harvest_year: year,
      processor: processor.id,
      kind,
      grams,
      ref,
      note,
      entered_by: actor.id,
      created_at: ts,
    };
    await db.batch([
      db
        .prepare(
          `INSERT INTO distillate_movements (
            id, moved_on, harvest_year, processor, kind, grams, ref, note, entered_by, created_at, voided_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`
        )
        .bind(id, movedOn, year, processor.id, kind, grams, ref, note, actor.id, ts),
      ...logsForInsert(db, "distillate_movements", id, record, actor.id, ENTRY_LOG_REASON, ts),
    ]);
    return { redirect: `${DISTILLATE_ENTRY_PATH}?ok=1` };
  }
  if (action === "count") {
    const countedOn = await assertDate(db, form.get("counted_on"), "Date");
    const year = parseYear(form.get("harvest_year"));
    const processorRaw = textOrNull(form.get("processor"));
    const processor = processorRaw ? await liveProcessor(db, processorRaw) : null;
    const liters = parseLiters(form.get("liters"));
    if (liters < 0) throw new HttpError(400, "A count cannot be negative.");
    const grams = litersToGrams(liters);
    const note = clip(form.get("note"), 500) || null;
    const id = crypto.randomUUID();
    const record: Record<string, unknown> = {
      id,
      counted_on: countedOn,
      harvest_year: year,
      processor: processor?.id ?? null,
      grams,
      counted_by: actor.id,
      note,
      created_at: ts,
    };
    await db.batch([
      db
        .prepare(
          `INSERT INTO distillate_counts (
            id, counted_on, harvest_year, processor, grams, counted_by, note, created_at, voided_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL)`
        )
        .bind(id, countedOn, year, processor?.id ?? null, grams, actor.id, note, ts),
      ...logsForInsert(db, "distillate_counts", id, record, actor.id, ENTRY_LOG_REASON, ts),
    ]);
    return { redirect: `${DISTILLATE_ENTRY_PATH}?ok=1` };
  }
  throw new HttpError(400, "Unknown row.");
}

type ZohoItem = {
  item_name: string;
  market_uom: string | null;
  market_qty: number | null;
  zoho_mounted_at: string | null;
  year: string;
  liters: number | null;
  flag: string;
};

type LedgerLine = {
  year: string;
  processorId: string;
  processor: string;
  finished: number;
  shipped: number;
  adjust: number;
  ledger: number;
  countDate: string;
  countGrams: number | null;
  variance: number | null;
  flag: string;
  yield: string;
};

export type DistillateReportModel = {
  asOf: string;
  year: string;
  lines: LedgerLine[];
  zoho: ZohoItem[];
  mountDate: string;
  metrcLiters: number | null;
  message: string;
  house: Map<string, { counted_on: string; grams: number; created_at: string }>;
};

const REPORT_COLUMNS: ReportColumn[] = [
  { key: "harvest_year", label: "Harvest year" },
  { key: "section", label: "Section" },
  { key: "line", label: "Line" },
  { key: "zoho_l", label: "Zoho liters" },
  { key: "finished_l", label: "Finished liters" },
  { key: "shipped_l", label: "Shipped liters" },
  { key: "adjust_l", label: "Adjust liters" },
  { key: "ledger_l", label: "Ledger liters" },
  { key: "count_date", label: "Count date" },
  { key: "count_l", label: "Count liters" },
  { key: "variance_l", label: "Variance (L)" },
  { key: "flag", label: "Flag" },
  { key: "yield", label: "Yield (L per lb)" },
  { key: "note", label: "Note" },
];

function blankRow(year: string, section: string, line: string): Record<string, string | number> {
  return {
    harvest_year: year,
    section,
    line,
    zoho_l: "",
    finished_l: "",
    shipped_l: "",
    adjust_l: "",
    ledger_l: "",
    count_date: "",
    count_l: "",
    variance_l: "",
    flag: "",
    yield: "",
    note: "",
  };
}

function newestCount(counts: readonly CountRow[], year: string, processorId: string | null): CountRow | null {
  const matches = counts.filter((row) => row.harvest_year === year && (row.processor ?? null) === processorId && !row.voided_at);
  matches.sort((a, b) => (a.counted_on < b.counted_on ? 1 : a.counted_on > b.counted_on ? -1 : a.created_at < b.created_at ? 1 : -1));
  return matches[0] ?? null;
}

export async function loadDistillateModel(db: D1Database, asOf: string, year: string): Promise<DistillateReportModel> {
  const movements = year
    ? await db.prepare(MOVEMENTS_YEAR_SQL).bind(year, asOf).all<MovementRow>()
    : await db.prepare(MOVEMENTS_AS_OF_SQL).bind(asOf).all<MovementRow>();
  const counts = year
    ? await db.prepare(COUNTS_YEAR_SQL).bind(year, asOf).all<CountRow>()
    : await db.prepare(COUNTS_AS_OF_SQL).bind(asOf).all<CountRow>();
  const zohoRaw = await db
    .prepare(ZOHO_DISTILLATE_SQL)
    .all<{ item_name: string; market_uom: string | null; market_qty: number | null; zoho_mounted_at: string | null }>();
  const metrcRaw = await db
    .prepare(METRC_DISTILLATE_SQL)
    .all<{ quantity: number | null; uom: string | null; item: string | null; category: string | null }>();
  const processors = await listProcessors(db);
  const names = new Map(processors.map((row) => [row.id, row.name]));
  const moveRows = movements.results ?? [];
  const countRows = counts.results ?? [];
  const zoho: ZohoItem[] = [];
  let mountDate = "";
  for (const row of zohoRaw.results ?? []) {
    if (!/distillate/i.test(row.item_name)) continue;
    const found = harvestYearFromItemName(row.item_name);
    const itemYear = found ?? "Year unknown";
    if (year && itemYear !== year) continue;
    const mounted = (row.zoho_mounted_at ?? "").slice(0, 10);
    if (mounted > mountDate) mountDate = mounted;
    if (!isLiterUom(row.market_uom)) {
      zoho.push({
        item_name: row.item_name,
        market_uom: row.market_uom,
        market_qty: row.market_qty,
        zoho_mounted_at: row.zoho_mounted_at,
        year: itemYear,
        liters: null,
        flag: "UOM is not L",
      });
      continue;
    }
    const qty = Number(row.market_qty);
    zoho.push({
      item_name: row.item_name,
      market_uom: row.market_uom,
      market_qty: row.market_qty,
      zoho_mounted_at: row.zoho_mounted_at,
      year: itemYear,
      liters: Number.isFinite(qty) ? qty : null,
      flag: found ? "" : "Year unknown",
    });
  }
  const years = new Set<string>();
  for (const row of moveRows) years.add(row.harvest_year);
  for (const row of countRows) years.add(row.harvest_year);
  for (const row of zoho) years.add(row.year);
  const lines: LedgerLine[] = [];
  for (const itemYear of years) {
    if (itemYear === "Year unknown") continue;
    const ids = new Set<string>();
    for (const row of moveRows) if (row.harvest_year === itemYear) ids.add(row.processor);
    for (const row of countRows) if (row.harvest_year === itemYear && row.processor) ids.add(row.processor);
    const ordered = [...ids].sort((a, b) => (names.get(a) ?? a).localeCompare(names.get(b) ?? b));
    for (const id of ordered) {
      const mine = moveRows.filter((row) => row.harvest_year === itemYear && row.processor === id);
      const parts = partsOf(mine);
      const count = newestCount(countRows, itemYear, id);
      let variance: number | null = null;
      let flag = "";
      if (count) {
        const atCount = partsOf(mine.filter((row) => row.moved_on <= count.counted_on));
        variance = Number(count.grams) - atCount.ledger;
        if (varianceOverOneLiter(Number(count.grams), atCount.ledger)) flag = "Over 1 L";
      }
      lines.push({
        year: itemYear,
        processorId: id,
        processor: names.get(id) ?? id,
        finished: parts.finished,
        shipped: parts.shipped,
        adjust: parts.adjust,
        ledger: parts.ledger,
        countDate: count?.counted_on ?? "",
        countGrams: count ? Number(count.grams) : null,
        variance,
        flag,
        yield: "",
      });
    }
  }
  const metrcLiters = metrcDistillateLiters(metrcRaw.results ?? []);
  const house = new Map<string, { counted_on: string; grams: number; created_at: string }>();
  for (const row of countRows) {
    if (row.processor) continue;
    const have = house.get(row.harvest_year);
    const later = !have || row.counted_on > have.counted_on || (row.counted_on === have.counted_on && row.created_at > have.created_at);
    if (later) house.set(row.harvest_year, { counted_on: row.counted_on, grams: Number(row.grams), created_at: row.created_at });
  }
  return { asOf, year, lines, zoho, mountDate, metrcLiters, message: "", house };
}

function yearSortKey(year: string): string {
  if (year === "Year unknown") return "9998";
  if (year === "All years") return "9999";
  return year;
}

export function distillateView(model: DistillateReportModel, locale: Locale): ReportView {
  const rows: Record<string, string | number>[] = [];
  const years = [...new Set([...model.lines.map((row) => row.year), ...model.zoho.map((row) => row.year)])].sort((a, b) =>
    yearSortKey(a).localeCompare(yearSortKey(b))
  );
  const summaries: string[] = [];
  let grandFinished = 0;
  let grandShipped = 0;
  let grandAdjust = 0;
  let grandLedger = 0;
  let grandZoho = 0;
  let anyZohoLiters = false;
  let anyLedger = false;
  for (const year of years) {
    const items = model.zoho.filter((row) => row.year === year).sort((a, b) => a.item_name.localeCompare(b.item_name));
    let zohoSum = 0;
    let zohoAny = false;
    for (const item of items) {
      const row = blankRow(yearLabel(year, locale), t(locale, "Zoho"), item.item_name);
      if (item.liters != null) {
        row.zoho_l = item.liters.toFixed(2);
        zohoSum += item.liters;
        zohoAny = true;
        anyZohoLiters = true;
      }
      row.flag = item.flag ? t(locale, item.flag) : "";
      row.note = (item.zoho_mounted_at ?? "").slice(0, 10);
      rows.push(row);
    }
    const house = model.lines.filter((row) => row.year === year);
    const houseCount = newestHouse(model, year);
    if (items.length > 0) {
      const total = blankRow(yearLabel(year, locale), t(locale, "Zoho"), t(locale, "Year total"));
      if (zohoAny) {
        total.zoho_l = zohoSum.toFixed(2);
        grandZoho += zohoSum;
      }
      if (houseCount) {
        total.count_date = houseCount.counted_on;
        total.count_l = formatLitersFromGrams(Number(houseCount.grams));
        if (zohoAny) {
          const varianceGrams = Number(houseCount.grams) - Math.round(zohoSum * GRAMS_PER_LITER);
          total.variance_l = formatLitersFromGrams(varianceGrams);
          if (Math.abs(varianceGrams) > GRAMS_PER_LITER) total.flag = t(locale, "Over 1 L");
        }
      }
      total._total = "1";
      rows.push(total);
    }
    let yFinished = 0;
    let yShipped = 0;
    let yAdjust = 0;
    let yLedger = 0;
    for (const line of house) {
      anyLedger = true;
      yFinished += line.finished;
      yShipped += line.shipped;
      yAdjust += line.adjust;
      yLedger += line.ledger;
      const row = blankRow(yearLabel(year, locale), t(locale, "Ledger"), line.processor);
      row.finished_l = formatLitersFromGrams(line.finished);
      row.shipped_l = formatLitersFromGrams(line.shipped);
      row.adjust_l = formatLitersFromGrams(line.adjust);
      row.ledger_l = formatLitersFromGrams(line.ledger);
      row.count_date = line.countDate;
      row.count_l = line.countGrams == null ? "" : formatLitersFromGrams(line.countGrams);
      row.variance_l = line.variance == null ? "" : formatLitersFromGrams(line.variance);
      row.flag = line.flag ? t(locale, line.flag) : "";
      row.yield = "";
      rows.push(row);
      summaries.push(
        `<span data-ledger-row="${esc(line.processor)}" data-year="${esc(line.year)}" data-ledger-liters="${esc(
          formatLitersFromGrams(line.ledger)
        )}" data-variance-liters="${esc(line.variance == null ? "" : formatLitersFromGrams(line.variance))}" data-flag="${esc(
          line.flag
        )}" data-yield=""></span>`
      );
    }
    if (house.length > 0) {
      grandFinished += yFinished;
      grandShipped += yShipped;
      grandAdjust += yAdjust;
      grandLedger += yLedger;
      const total = blankRow(yearLabel(year, locale), t(locale, "Ledger"), t(locale, "Year total"));
      total.finished_l = formatLitersFromGrams(yFinished);
      total.shipped_l = formatLitersFromGrams(yShipped);
      total.adjust_l = formatLitersFromGrams(yAdjust);
      total.ledger_l = formatLitersFromGrams(yLedger);
      total._total = "1";
      rows.push(total);
    }
  }
  if (anyZohoLiters) {
    const total = blankRow(t(locale, "All years"), t(locale, "Zoho"), t(locale, "Grand total"));
    total.zoho_l = grandZoho.toFixed(2);
    total._total = "1";
    rows.push(total);
  }
  if (anyLedger) {
    const total = blankRow(t(locale, "All years"), t(locale, "Ledger"), t(locale, "Grand total"));
    total.finished_l = formatLitersFromGrams(grandFinished);
    total.shipped_l = formatLitersFromGrams(grandShipped);
    total.adjust_l = formatLitersFromGrams(grandAdjust);
    total.ledger_l = formatLitersFromGrams(grandLedger);
    total._total = "1";
    rows.push(total);
  }
  const metrc =
    model.metrcLiters == null
      ? ""
      : `<p data-metrc-liters="${esc(model.metrcLiters.toFixed(2))}">${esc(
          t(locale, "METRC distillate")
        )}: ${esc(model.metrcLiters.toFixed(2))} L</p>`;
  const footnoteParts = [
    t(locale, "Zoho liters are the latest mount. The as-of date leaves out later movements and counts. It does not rewind Zoho."),
    t(locale, "BowHouse yield is blank. Toll lots record no liters returned."),
  ];
  if (model.metrcLiters == null) {
    footnoteParts.push(
      t(locale, "The METRC mirror holds no distillate package in liters or grams, so the compliance column is left out.")
    );
  }
  if (model.message) footnoteParts.unshift(model.message);
  const mount = model.mountDate ? ` ${t(locale, "Mount date")} ${model.mountDate}.` : "";
  return {
    key: DISTILLATE_ON_HAND_KEY,
    title: "Distillate on hand",
    columns: REPORT_COLUMNS,
    rows,
    groupBy: "harvest_year",
    heading: `${t(locale, "As of")} ${model.asOf}.${mount}`,
    empty: t(locale, "No distillate rows."),
    footnote: footnoteParts.join(" "),
    belowTable: `${metrc}${summaries.join("")}`,
  };
}

function yearLabel(year: string, locale: Locale): string {
  return year === "Year unknown" ? t(locale, "Year unknown") : year;
}

function newestHouse(model: DistillateReportModel, year: string): { counted_on: string; grams: number } | null {
  return model.house.get(year) ?? null;
}

export async function loadDistillateOnHand(
  db: D1Database,
  params: URLSearchParams,
  today: string,
  locale: Locale
): Promise<{ view: ReportView; filterHtml: string; csv: string; asOf: string; year: string }> {
  const rawAsOf = (params.get("as_of") ?? "").trim();
  const rawYear = (params.get("year") ?? "").trim();
  let message = "";
  let asOf = today;
  if (rawAsOf) {
    if (!isCalendarDate(rawAsOf)) message = t(locale, "As of must be a date.");
    else asOf = rawAsOf;
  }
  let year = "";
  if (rawYear) {
    if (!/^20\d{2}$/.test(rawYear)) message = message || t(locale, "Harvest year is four digits.");
    else year = rawYear;
  }
  const model = message
    ? { asOf, year, lines: [], zoho: [], mountDate: "", metrcLiters: null, message, house: new Map<string, { counted_on: string; grams: number; created_at: string }>() }
    : await loadDistillateModel(db, asOf, year);
  const yearRows = await db
    .prepare(
      `SELECT harvest_year FROM distillate_movements
       UNION
       SELECT harvest_year FROM distillate_counts`
    )
    .all<{ harvest_year: string }>();
  const yearSet = new Set<string>(["2025", "2026"]);
  for (const row of yearRows.results ?? []) if (/^20\d{2}$/.test(row.harvest_year)) yearSet.add(row.harvest_year);
  for (const item of model.zoho) if (/^20\d{2}$/.test(item.year)) yearSet.add(item.year);
  const options = [`<option value="">${esc(t(locale, "All years"))}</option>`]
    .concat(
      [...yearSet]
        .sort()
        .map((value) => `<option value="${esc(value)}"${value === year ? " selected" : ""}>${esc(value)}</option>`)
    )
    .join("");
  const filterHtml = `<label class="field">${esc(t(locale, "Harvest year"))} <select name="year">${options}</select></label>
    <label class="field">${esc(t(locale, "As of"))} <input type="date" name="as_of" value="${esc(asOf)}"></label>`;
  const view = distillateView(model, locale);
  const recentMoves = year
    ? await db.prepare(RECENT_MOVEMENTS_YEAR_SQL).bind(year, asOf).all<MovementRow>()
    : await db.prepare(RECENT_MOVEMENTS_SQL).bind(asOf).all<MovementRow>();
  const recentCounts = year
    ? await db.prepare(RECENT_COUNTS_YEAR_SQL).bind(year, asOf).all<CountRow>()
    : await db.prepare(RECENT_COUNTS_SQL).bind(asOf).all<CountRow>();
  const names = new Map((await listProcessors(db)).map((row) => [row.id, row.name]));
  if (!message) {
    view.belowTable = `${view.belowTable ?? ""}${recentHtml(recentMoves.results ?? [], recentCounts.results ?? [], names, locale)}`;
  }
  return { view, filterHtml, csv: reportCsv(view), asOf, year };
}

function recentHtml(
  movements: readonly MovementRow[],
  counts: readonly CountRow[],
  names: Map<string, string>,
  locale: Locale
): string {
  const moveRows = movements
    .map(
      (row) => `<tr data-recent-movement="${esc(row.id)}">
        <td>${esc(row.moved_on)}</td>
        <td>${esc(row.harvest_year)}</td>
        <td>${esc(names.get(row.processor) ?? row.processor)}</td>
        <td>${esc(t(locale, kindLabel(row.kind)))}</td>
        <td>${esc(formatLitersFromGrams(Number(row.grams)))}</td>
        <td>${row.voided_at ? esc(t(locale, "Voided")) : ""}</td>
      </tr>`
    )
    .join("");
  const countRows = counts
    .map((row) => {
      const who = row.processor ? names.get(row.processor) ?? row.processor : t(locale, "House count");
      return `<tr data-recent-count="${esc(row.id)}">
        <td>${esc(row.counted_on)}</td>
        <td>${esc(row.harvest_year)}</td>
        <td>${esc(who)}</td>
        <td>${esc(formatLitersFromGrams(Number(row.grams)))}</td>
        <td>${row.voided_at ? esc(t(locale, "Voided")) : ""}</td>
      </tr>`;
    })
    .join("");
  return `<h2>${esc(t(locale, "Recent movements"))}</h2>
    <table class="data"><thead><tr>
      <th>${esc(t(locale, "Date"))}</th><th>${esc(t(locale, "Harvest year"))}</th><th>${esc(t(locale, "Processor"))}</th>
      <th>${esc(t(locale, "Kind"))}</th><th>${esc(t(locale, "Liters"))}</th><th>${esc(t(locale, "Void"))}</th>
    </tr></thead><tbody>${moveRows}</tbody></table>
    <h2>${esc(t(locale, "Recent counts"))}</h2>
    <table class="data"><thead><tr>
      <th>${esc(t(locale, "Date"))}</th><th>${esc(t(locale, "Harvest year"))}</th><th>${esc(t(locale, "Processor"))}</th>
      <th>${esc(t(locale, "Liters"))}</th><th>${esc(t(locale, "Void"))}</th>
    </tr></thead><tbody>${countRows}</tbody></table>`;
}

export { rowsAsOf };
