/**
 * FULFILLMENT (canon 0.30.306). The Admin panel is the sole source of the
 * figures. Ten rows, three columns, one day at a time. The console section
 * reads that day and draws a stacked bar for the cells that are not null.
 */

import { HttpError, nowIso, textOrNull } from "./audit";
import { CONFIG_KEYS, FULFILLMENT_UNIT_GRAMS_DEFAULT, GRAMS_PER_LB, PREPACK_UNITS_DEFAULT, format2, formatGrams, parseFulfillmentUnitGrams, parsePrepackUnits } from "./config";
import { CONSOLE_ICON_STROKE, GRIP_MARK_PATH, GRIP_MARK_VIEWBOX, TRAILER_CARGO, consoleIconSvg, type ConsoleIconName } from "./consoleicons";
import { getConfigValue, insertLog, requireActor } from "./db";
import { isCalendarDate } from "./farmday";
import { t, tFill, type Locale } from "./i18n";
import { esc } from "./ui";

export const FULFILLMENT_OVERRIDE_PATH = "/admin/lookups/fulfillment_override";

export const FULFILLMENT_ROWS = [
  { key: "bulk_bud", name: "Bulk Bud", unit: "g" },
  { key: "biomass_trim", name: "Biomass/Trim", unit: "g" },
  { key: "prepack", name: "Prepack", unit: "ea" },
  { key: "prerolls", name: "Prerolls", unit: "ea" },
  { key: "shake", name: "Shake", unit: "g" },
  { key: "bulk_distillate", name: "Bulk Distillate", unit: "g" },
  { key: "vapes", name: "Vapes", unit: "ea" },
  { key: "mobs", name: "MOBs", unit: "ea" },
  { key: "bulk_isolate", name: "Bulk Isolate (THCA)", unit: "g" },
  { key: "bulk_infused", name: "Bulk Infused", unit: "g" },
] as const;

export type FulfillmentRowKey = (typeof FULFILLMENT_ROWS)[number]["key"];
export type FulfillmentUnit = "g" | "ea";

export const FULFILLMENT_COLUMNS = [
  { key: "accepted", label: "Accepted" },
  { key: "submitted", label: "Submitted" },
  { key: "shipping_today", label: "Shipping Today" },
] as const;

export const FULFILLMENT_PANES = [
  { key: "shipping_today", label: "Shipping today", icon: "shipping" },
  { key: "submitted", label: "Submitted", icon: "submitted" },
  { key: "accepted", label: "Accepted", icon: "accepted" },
] as const;

export type FulfillmentCol = (typeof FULFILLMENT_COLUMNS)[number]["key"];

export type FulfillmentCell = {
  rowKey: string;
  col: string;
  value: number;
  unit: string;
  bagGrams?: number | null;
};

export type FulfillmentSeries = {
  key: string;
  name: string;
  unit: FulfillmentUnit;
  value: number;
  grams: number;
  share: number;
  hue: number;
  /** lbs: Bulk Bud or split Prepack. legacy: an unsplit Prepack row. unit: the other rows. */
  kind: "lbs" | "unit" | "legacy";
};

export type FulfillmentDay = {
  cells: FulfillmentCell[];
  unitGrams: Record<string, number>;
  prepackUnits: readonly string[];
};

/** Pounds at GRAMS_PER_LB. Two decimals, half up, thousands grouped, labelled lbs.
 * A positive figure under one hundredth of a pound reads "<0.01 lbs"
 * (one 3.5 g bag is 3.5 / 448). */
export function formatFulfillmentLbs(grams: number): string {
  if (!Number.isFinite(grams)) return "";
  const pounds = grams / GRAMS_PER_LB;
  if (grams > 0 && pounds < 0.01) return "<0.01 lbs";
  return `${format2(pounds)} lbs`;
}

/** The bag size stored on a split Prepack cell, else the size written in its row key. */
function splitBagGrams(cell: { rowKey: string; bagGrams?: number | null }): number | null {
  if (!cell.rowKey.startsWith("prepack@")) return null;
  if (cell.bagGrams != null && Number.isFinite(Number(cell.bagGrams)) && Number(cell.bagGrams) > 0) return Number(cell.bagGrams);
  const n = Number(cell.rowKey.slice("prepack@".length));
  return Number.isFinite(n) && n > 0 ? n : null;
}

type EditableRow = { key: string; unit: FulfillmentUnit; bagGrams: number | null };

/** The grid rows: every standing row, with Prepack expanded to one row per bag size. */
function editableRows(units: readonly string[]): EditableRow[] {
  const out: EditableRow[] = [];
  for (const row of FULFILLMENT_ROWS) {
    if (row.key !== "prepack") {
      out.push({ key: row.key, unit: row.unit, bagGrams: null });
      continue;
    }
    for (const size of units) out.push({ key: `prepack@${size}`, unit: "ea", bagGrams: Number(size) });
  }
  return out;
}

const ROW_BY_KEY = new Map(FULFILLMENT_ROWS.map((row, index) => [row.key, { ...row, hue: index + 1 }]));

function eachGrams(key: string, unitGrams: Readonly<Record<string, number>>): number {
  const typed = unitGrams[key];
  if (typed != null && Number.isFinite(typed) && typed > 0) return typed;
  return FULFILLMENT_UNIT_GRAMS_DEFAULT[key] ?? 1;
}

/** The series present for one column: doc order, a zero included, a missing row left out.
 * Grams are the measure of the bar. An each is its value times the grams in one each.
 * Split Prepack cells (prepack@size) collapse to one line whose grams are count times bag_grams.
 * An unsplit prepack row stays its own line, at the config grams, and is not part of the pounds. */
export function fulfillmentSeries(
  cells: readonly { rowKey: string; value: number; bagGrams?: number | null }[],
  unitGrams: Readonly<Record<string, number>>
): FulfillmentSeries[] {
  const byKey = new Map(cells.map((cell) => [cell.rowKey, cell]));
  const present: FulfillmentSeries[] = [];
  for (const row of FULFILLMENT_ROWS) {
    const spec = ROW_BY_KEY.get(row.key)!;
    if (row.key === "prepack") {
      const split = cells.filter((cell) => cell.rowKey.startsWith("prepack@"));
      if (split.length > 0) {
        let grams = 0;
        for (const cell of split) grams += Number(cell.value) * (splitBagGrams(cell) ?? 0);
        present.push({ key: "prepack", name: "Prepack", unit: "ea", value: grams, grams, share: 0, hue: spec.hue, kind: "lbs" });
      }
      const legacy = byKey.get("prepack");
      if (legacy) {
        const value = Number(legacy.value);
        const grams = value * eachGrams("prepack", unitGrams);
        present.push({
          key: split.length > 0 ? "prepack_legacy" : "prepack",
          name: "Prepack",
          unit: "ea",
          value,
          grams,
          share: 0,
          hue: spec.hue,
          kind: "legacy",
        });
      }
      continue;
    }
    const cell = byKey.get(row.key);
    if (!cell) continue;
    const value = Number(cell.value);
    const grams = spec.unit === "ea" ? value * eachGrams(row.key, unitGrams) : value;
    present.push({
      key: row.key,
      name: row.name,
      unit: spec.unit,
      value,
      grams,
      share: 0,
      hue: spec.hue,
      kind: row.key === "bulk_bud" ? "lbs" : "unit",
    });
  }
  const total = present.reduce((sum, row) => sum + row.grams, 0);
  for (const row of present) row.share = total > 0 ? row.grams / total : 0;
  return present;
}

type BarBox = { x: number; y: number; width: number; height: number };

/** Widths in the box, hundredths, summing to the box width when any share is positive.
 * A zero share stays at no width. */
export function segmentWidths(shares: readonly number[], width: number): number[] {
  const target = Math.round(width * 100);
  const raw = shares.map((share) => (share > 0 ? Math.floor(share * target) : 0));
  const last = shares.reduce((at, share, index) => (share > 0 ? index : at), -1);
  if (last >= 0) {
    const used = raw.reduce((sum, n) => sum + n, 0);
    raw[last] += target - used;
  }
  return raw.map((n) => n / 100);
}

/** The stacked bar: rects left to right, each a hue of its row. */
export function stackedBar(series: readonly FulfillmentSeries[], box: BarBox): string {
  const widths = segmentWidths(series.map((row) => row.share), box.width);
  let x = box.x;
  return series
    .map((row, index) => {
      const w = widths[index] ?? 0;
      const rect = `<rect class="hc-fill-${row.hue}" data-fulfill-segment="${esc(row.key)}" fill="currentColor" stroke="none" x="${fmt(x)}" y="${fmt(box.y)}" width="${fmt(w)}" height="${fmt(box.height)}"/>`;
      x += w;
      return rect;
    })
    .join("");
}

function fmt(n: number): string {
  const rounded = Math.round(n * 100) / 100;
  return String(rounded);
}

function legendText(row: FulfillmentSeries, locale: Locale): string {
  if (row.kind === "lbs") return `${t(locale, row.name)} ${formatFulfillmentLbs(row.grams)}`;
  if (row.kind === "legacy") return `${t(locale, "Prepack (unsplit)")} ${formatGrams(row.value)} ${row.unit}`;
  return `${t(locale, row.name)} ${formatGrams(row.value)} ${row.unit}`;
}

function legend(series: readonly FulfillmentSeries[], locale: Locale): string {
  if (series.length === 0) return `<p class="muted" data-fulfill-empty>${esc(t(locale, "No figures typed for this day."))}</p>`;
  const items = series
    .map((row) => {
      const flag = row.kind === "legacy" ? " data-fulfill-legacy" : "";
      return `<li data-fulfill-legend="${esc(row.key)}"${flag}><span class="hc-fill-swatch hc-fill-${row.hue}"></span>${esc(legendText(row, locale))}</li>`;
    })
    .join("");
  return `<ul class="hc-fill-legend">${items}</ul>`;
}

function plainNum(n: number): string {
  const text = n.toFixed(8).replace(/0+$/, "").replace(/\.$/, "");
  return text === "-0" ? "0" : text;
}

/** The GRIP outline, scaled to the trailer panel's full height and centered in it. */
function gripOutline(): string {
  const scale = TRAILER_CARGO.height / GRIP_MARK_VIEWBOX.height;
  const drawnW = GRIP_MARK_VIEWBOX.width * scale;
  const drawnH = GRIP_MARK_VIEWBOX.height * scale;
  const x = TRAILER_CARGO.x + (TRAILER_CARGO.width - drawnW) / 2;
  const y = TRAILER_CARGO.y + (TRAILER_CARGO.height - drawnH) / 2;
  return `<path data-fulfill-grip-outline d="${GRIP_MARK_PATH}" fill="none" stroke="currentColor" stroke-width="${CONSOLE_ICON_STROKE}" vector-effect="non-scaling-stroke" pointer-events="none" aria-hidden="true" transform="translate(${plainNum(x)} ${plainNum(y)}) scale(${plainNum(scale)})"/>`;
}

function withCargo(icon: string, rects: string): string {
  const at = icon.indexOf("data-icon-trailer-cargo");
  if (at < 0) return icon;
  const end = icon.indexOf("/>", at);
  if (end < 0) return icon;
  return icon.slice(0, end + 2) + rects + gripOutline() + icon.slice(end + 2);
}

function paneMarkup(col: (typeof FULFILLMENT_PANES)[number], cells: readonly FulfillmentCell[], unitGrams: Record<string, number>, locale: Locale): string {
  const series = fulfillmentSeries(
    cells.filter((cell) => cell.col === col.key).map((cell) => ({ rowKey: cell.rowKey, value: Number(cell.value), bagGrams: cell.bagGrams ?? null })),
    unitGrams
  );
  const label = t(locale, col.label);
  const icon = consoleIconSvg(col.icon as ConsoleIconName, { label });
  let picture: string;
  if (col.key === "shipping_today") {
    picture = withCargo(icon, stackedBar(series, TRAILER_CARGO));
  } else if (series.length === 0) {
    picture = `<div class="hc-fill-beside">${icon}</div>`;
  } else {
    const band = stackedBar(series, { x: 0, y: 0, width: 100, height: 30 });
    picture = `<div class="hc-fill-beside">${icon}<svg class="hc-fill-band" viewBox="0 0 100 30" preserveAspectRatio="none" aria-hidden="true">${band}</svg></div>`;
  }
  return `<div class="hc-fill-pane" data-hc-fill="${esc(col.key)}">
      <div class="hc-gate-name">${esc(label)}</div>
      ${picture}
      ${legend(series, locale)}
    </div>`;
}

export function fulfillmentSection(day: FulfillmentDay, locale: Locale = "en"): string {
  const panes = FULFILLMENT_PANES.map((col) => paneMarkup(col, day.cells, day.unitGrams, locale)).join("");
  return `<details class="hc-section" data-hc-section="fulfillment" open>
      <summary>${esc(t(locale, "Fulfillment"))}</summary>
      <div class="hc-fill">${panes}</div>
    </details>`;
}

export function emptyFulfillment(): FulfillmentDay {
  return { cells: [], unitGrams: parseFulfillmentUnitGrams(null), prepackUnits: [...PREPACK_UNITS_DEFAULT] };
}

/** A calendar day from the query, else the farm's today. */
export function fulfillmentDateOf(picked: string | null | undefined, today: string): string {
  const value = String(picked ?? "").trim();
  return value && isCalendarDate(value) ? value : today;
}

export async function listFulfillmentCells(db: D1Database, day: string): Promise<FulfillmentCell[]> {
  const rows = await db
    .prepare(
      `SELECT row_key, col, value, unit, bag_grams FROM fulfillment_overrides
       WHERE entry_date = ? AND deleted_at IS NULL
       ORDER BY row_key, col`
    )
    .bind(day)
    .all<{ row_key: string; col: string; value: number; unit: string; bag_grams: number | null }>();
  return (rows.results ?? []).map((row) => ({
    rowKey: row.row_key,
    col: row.col,
    value: Number(row.value),
    unit: row.unit,
    bagGrams: row.bag_grams == null ? null : Number(row.bag_grams),
  }));
}

/** The day's cells and the config rows. Nothing else, and nothing per cell. */
export async function loadFulfillmentSection(db: D1Database, day: string): Promise<FulfillmentDay> {
  const [cells, rawGrams, rawUnits] = await Promise.all([
    listFulfillmentCells(db, day),
    getConfigValue(db, CONFIG_KEYS.fulfillment_unit_grams),
    getConfigValue(db, CONFIG_KEYS.prepack_units),
  ]);
  return {
    cells,
    unitGrams: parseFulfillmentUnitGrams(rawGrams),
    prepackUnits: parsePrepackUnits(rawUnits),
  };
}

function cellName(rowKey: string, col: string): string {
  return `${rowKey}:${col}`;
}

function inputCell(name: string, value: string, unit: string): string {
  return `<td><input type="number" data-fulfill-cell="${esc(name)}" name="${esc(name)}" min="0" step="1" inputmode="numeric" value="${esc(value)}"> <span class="muted">${esc(unit)}</span></td>`;
}

/** The override grid. Prepack is one row per bag size. A live unsplit row is read-only, with a Clear. */
export function fulfillmentOverridePage(
  date: string,
  cells: readonly FulfillmentCell[],
  locale: Locale = "en",
  ok?: string,
  units: readonly string[] = [...PREPACK_UNITS_DEFAULT]
): string {
  const byName = new Map(cells.map((cell) => [cellName(cell.rowKey, cell.col), cell]));
  const heads = FULFILLMENT_COLUMNS.map((col) => `<th>${esc(t(locale, col.label))}</th>`).join("");
  const parts: string[] = [];
  for (const row of FULFILLMENT_ROWS) {
    if (row.key === "prepack") {
      for (const size of units) {
        const key = `prepack@${size}`;
        const inputs = FULFILLMENT_COLUMNS.map((col) => {
          const name = cellName(key, col.key);
          const value = byName.has(name) ? String(byName.get(name)!.value) : "";
          return inputCell(name, value, "ea");
        }).join("");
        parts.push(`<tr><th>${esc(tFill(locale, "Prepack {size} g", { size }))}</th>${inputs}</tr>`);
      }
      const legacy = cells.filter((cell) => cell.rowKey === "prepack");
      if (legacy.length > 0) {
        const byCol = new Map(legacy.map((cell) => [cell.col, cell]));
        const tds = FULFILLMENT_COLUMNS.map((col) => {
          const cell = byCol.get(col.key);
          if (!cell) return "<td></td>";
          const name = cellName("prepack", col.key);
          const count = `${formatGrams(cell.value)} ea`;
          return `<td><span data-fulfill-legacy data-fulfill-readonly="${esc(name)}">${esc(count)}</span> <button type="submit" name="clear_prepack" value="${esc(col.key)}">${esc(t(locale, "Clear"))}</button></td>`;
        }).join("");
        parts.push(`<tr data-fulfill-legacy><th>${esc(t(locale, "Prepack (unsplit, legacy)"))}</th>${tds}</tr>`);
      }
      continue;
    }
    const inputs = FULFILLMENT_COLUMNS.map((col) => {
      const name = cellName(row.key, col.key);
      const value = byName.has(name) ? String(byName.get(name)!.value) : "";
      return inputCell(name, value, row.unit);
    }).join("");
    parts.push(`<tr><th>${esc(t(locale, row.name))}</th>${inputs}</tr>`);
  }
  const flash = ok === "saved" ? `<p class="banner ok" data-fulfill-flash>${esc(t(locale, "Figures saved."))}</p>` : "";
  return `<h1>${esc(t(locale, "Fulfillment Override"))}</h1>
    ${flash}
    <form method="get" action="${FULFILLMENT_OVERRIDE_PATH}" class="hc-day">
      <label class="field">${esc(t(locale, "Day"))}
        <input type="date" name="date" value="${esc(date)}" data-fulfill-date onchange="this.form.submit()">
      </label>
    </form>
    <form method="post" action="${FULFILLMENT_OVERRIDE_PATH}" class="stack" data-fulfill-grid>
      <input type="hidden" name="entry_date" value="${esc(date)}">
      <div class="report-scroll"><table class="fulfill-grid">
        <thead><tr><th></th>${heads}</tr></thead>
        <tbody>${parts.join("")}</tbody>
      </table></div>
      <button type="submit">${esc(t(locale, "Save"))}</button>
    </form>`;
}

type ParsedCell = { kind: "blank" } | { kind: "value"; value: number } | { kind: "bad" };

function parseCell(raw: unknown): ParsedCell {
  const text = String(raw ?? "").trim();
  if (text === "") return { kind: "blank" };
  if (!/^\d+$/.test(text)) return { kind: "bad" };
  return { kind: "value", value: Number(text) };
}

function pushClear(
  db: D1Database,
  stmts: Parameters<D1Database["batch"]>[0],
  prior: { id: string; value: number },
  actorId: string,
  ts: string
): void {
  stmts.push(
    db
      .prepare(
        `UPDATE fulfillment_overrides
         SET deleted_at = ?, deleted_by = ?, delete_reason = ?, updated_at = ?, updated_by = ?
         WHERE id = ? AND deleted_at IS NULL`
      )
      .bind(ts, actorId, "cleared", ts, actorId, prior.id),
    insertLog(db, {
      record_table: "fulfillment_overrides",
      record_id: prior.id,
      field: "value",
      old_value: String(Number(prior.value)),
      new_value: null,
      actor_person_id: actorId,
      reason: "cleared",
      changed_at: ts,
    })
  );
}

/** Writes the day's cells. A typed cell inserts or updates. A blank where a
 * value stood soft-deletes it. An untouched cell writes nothing. Nothing is
 * hard-deleted. An unsplit Prepack count is refused. A legacy row is cleared
 * only by its Clear control, and its bag_grams is never written. */
export async function saveFulfillmentOverride(db: D1Database, form: FormData): Promise<{ redirect: string }> {
  const actor = await requireActor(db, textOrNull(form.get("person_id")));
  const date = textOrNull(form.get("entry_date")) ?? "";
  if (!isCalendarDate(date)) throw new HttpError(400, "Pick a day.");
  const units = parsePrepackUnits(await getConfigValue(db, CONFIG_KEYS.prepack_units));
  const rows = editableRows(units);
  const parsed = new Map<string, ParsedCell>();
  for (const row of rows) {
    for (const col of FULFILLMENT_COLUMNS) {
      const name = cellName(row.key, col.key);
      const cell = parseCell(form.get(name));
      if (cell.kind === "bad") throw new HttpError(400, "Each figure must be a whole number of zero or more.");
      parsed.set(name, cell);
    }
  }
  for (const col of FULFILLMENT_COLUMNS) {
    const raw = form.get(cellName("prepack", col.key));
    if (raw != null && String(raw).trim() !== "") throw new HttpError(400, "A Prepack count needs a bag size.");
  }
  const existing = await db
    .prepare(
      `SELECT id, row_key, col, value, bag_grams FROM fulfillment_overrides
       WHERE entry_date = ? AND deleted_at IS NULL`
    )
    .bind(date)
    .all<{ id: string; row_key: string; col: string; value: number; bag_grams: number | null }>();
  const live = new Map((existing.results ?? []).map((row) => [cellName(row.row_key, row.col), row]));
  const ts = nowIso();
  const stmts: Parameters<D1Database["batch"]>[0] = [];
  for (const row of rows) {
    for (const col of FULFILLMENT_COLUMNS) {
      const name = cellName(row.key, col.key);
      const cell = parsed.get(name);
      if (!cell || cell.kind === "bad") continue;
      const prior = live.get(name);
      if (cell.kind === "blank") {
        if (!prior) continue;
        pushClear(db, stmts, prior, actor.id, ts);
        continue;
      }
      if (prior) {
        if (Number(prior.value) === cell.value) continue;
        stmts.push(
          db
            .prepare(
              `UPDATE fulfillment_overrides
               SET value = ?, unit = ?, updated_at = ?, updated_by = ?
               WHERE id = ? AND deleted_at IS NULL`
            )
            .bind(cell.value, row.unit, ts, actor.id, prior.id),
          insertLog(db, {
            record_table: "fulfillment_overrides",
            record_id: prior.id,
            field: "value",
            old_value: String(Number(prior.value)),
            new_value: String(cell.value),
            actor_person_id: actor.id,
            reason: "typed",
            changed_at: ts,
          })
        );
        continue;
      }
      const id = crypto.randomUUID();
      stmts.push(
        db
          .prepare(
            `INSERT INTO fulfillment_overrides (
              id, entry_date, row_key, col, value, unit, bag_grams, created_at, created_by, updated_at, updated_by
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          )
          .bind(id, date, row.key, col.key, cell.value, row.unit, row.bagGrams, ts, actor.id, ts, actor.id),
        insertLog(db, {
          record_table: "fulfillment_overrides",
          record_id: id,
          field: "value",
          old_value: null,
          new_value: String(cell.value),
          actor_person_id: actor.id,
          reason: "typed",
          changed_at: ts,
        })
      );
    }
  }
  const clearCol = textOrNull(form.get("clear_prepack"));
  if (clearCol && FULFILLMENT_COLUMNS.some((col) => col.key === clearCol)) {
    const prior = live.get(cellName("prepack", clearCol));
    if (prior) pushClear(db, stmts, prior, actor.id, ts);
  }
  if (stmts.length) await db.batch(stmts);
  return { redirect: `${FULFILLMENT_OVERRIDE_PATH}?date=${encodeURIComponent(date)}&ok=saved` };
}
