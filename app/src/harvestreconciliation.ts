/**
 * HARVEST WEIGHT RECONCILIATION (BRIEF HR1). One line per wet lot, the grain
 * of the harvest feed. The range is harvest_batches.entry_date. Pounds are
 * shown at 448 g and at the standard pound, 453.59237 g. The METRC mirror's
 * harvest weight is converted from the UOM the row carried. Harvest hours, when
 * a rate is stated, are harvest_labor_hours (work_date, farm_code).
 */

import { format2, formatGrams, GRAMS_PER_LB, roundGrams, shortLotId } from "./config";
import { DRY_STRAIN_FARMS, DRY_STRAIN_GROW_METHODS, resolveDryStrainRange } from "./drystrain";
import { dayAfter } from "./farmday";
import { t, tFill, type Locale } from "./i18n";
import { parseHbn } from "./mint";
import type { ReportColumn, ReportView } from "./reports";
import { esc } from "./ui";

export const HARVEST_RECONCILE_KEY = "harvest_reconciliation" as const;
/** METRC's own pound, grams. Not the house pound. */
export const STANDARD_GRAMS_PER_LB = 453.59237;
export const STANDARD_GRAMS_PER_LB_TEXT = "453.59237";
/** D1 allows 100 bound parameters. The name lookup stays under that. */
export const METRC_NAME_CHUNK = 90;

export const HARVEST_RECONCILE_EMPTY = "No lot was harvested in that range.";
export const HARVEST_RECONCILE_NO_METRC = "No METRC harvest";
export const HARVEST_RECONCILE_METRC_ONLY = "METRC only";
export const HARVEST_RECONCILE_WET_TOTAL = "Wet total";
export const HARVEST_RECONCILE_DRY_TOTAL = "Dry total";
export const HARVEST_RECONCILE_POUND_LAW =
  "The app's pound is 448 g. The standard pound is 453.59237 g. Both are shown. METRC and the sheets use the standard pound.";
export const HARVEST_RECONCILE_DATE_COLUMN = "A lot is in range on harvest_batches.entry_date.";
export const HARVEST_RECONCILE_RATIO = "448 g against {standard} g, {pct} percent";
export const HARVEST_RECONCILE_RATE =
  "Wet pounds per hour: {at448} at 448 g, {atStandard} at {standard} g, over {hours} hours on harvest_labor_hours.";
export const HARVEST_RECONCILE_NO_HOURS = "No harvest hours on harvest_labor_hours for these dates.";
export const HARVEST_RECONCILE_GROW_HOURS =
  "Pounds per hour is not stated: harvest_labor_hours holds {hours} hours for these dates and has no grow method.";

const LOTS_FROM = `SELECT w.id AS lot_id, b.hbn, b.entry_date, b.farm_code, b.grow_method_code,
       s.name AS strain_name, b.market_strain,
       COALESCE((SELECT SUM(ww.weight_grams) FROM wet_weights ww WHERE ww.wet_weight_entry_id = w.id AND ww.deleted_at IS NULL), w.weight_grams, 0) AS wet_grams,
       (SELECT SUM(dw.weight_grams) FROM dry_weights dw WHERE dw.wet_weight_entry_id = w.id AND dw.deleted_at IS NULL) AS dry_grams
FROM wet_weight_entries w
JOIN harvest_batches b ON b.id = w.harvest_batch_id AND b.deleted_at IS NULL AND b.is_test = 0
LEFT JOIN strains s ON s.id = b.strain_id`;

/** Live lots in the entry_date window. Dates are bound. Wet and dry sums seek the entry id. */
export function harvestReconcileLotsSql(hasFarm: boolean, hasGrow: boolean): string {
  const filters = ["w.deleted_at IS NULL", "b.entry_date >= ?", "b.entry_date <= ?"];
  if (hasFarm) filters.push("b.farm_code = ?");
  if (hasGrow) filters.push("b.grow_method_code = ?");
  return `${LOTS_FROM} WHERE ${filters.join(" AND ")} ORDER BY b.entry_date, b.hbn, w.id`;
}

/** Mirror harvests whose start falls in the window. The column is compared as stored. */
export const HARVEST_RECONCILE_METRC_RANGE_SQL = `SELECT name, total_wet_weight, unit_of_weight, harvest_start_date, changed_at
FROM metrc_harvests
WHERE gone_at IS NULL AND harvest_start_date >= ? AND harvest_start_date < ?`;

/** One live mirror row per harvest name. At most METRC_NAME_CHUNK names. */
export function harvestReconcileMetrcNamesSql(count: number): string {
  const marks = new Array(count).fill("?").join(", ");
  return `SELECT name, total_wet_weight, unit_of_weight, harvest_start_date, changed_at
FROM metrc_harvests
WHERE gone_at IS NULL AND name IN (${marks})`;
}

export const HARVEST_RECONCILE_LIVE_HBN_SQL = `SELECT hbn FROM harvest_batches
WHERE deleted_at IS NULL AND is_test = 0 AND hbn IS NOT NULL AND hbn <> ''`;

/** Cutting and bucking hours, the console's harvest_labor_hours, by work_date. */
export function harvestReconcileHoursSql(hasFarm: boolean): string {
  const farm = hasFarm ? " AND farm_code = ?" : "";
  return `SELECT COALESCE(SUM(hours), 0) AS hours
FROM harvest_labor_hours
WHERE work_date >= ? AND work_date <= ?${farm}`;
}

export const HARVEST_RECONCILE_COLUMNS: ReportColumn[] = [
  { key: "short_id", label: "HBN short id" },
  { key: "strain", label: "Strain" },
  { key: "market_strain", label: "Market strain" },
  { key: "farm", label: "Farm" },
  { key: "wet_grams", label: "Wet grams" },
  { key: "wet_lb_448", label: "Wet lb at 448 g" },
  { key: "wet_lb_standard", label: "Wet lb at 453.59237 g" },
  { key: "wet_diff", label: "Wet lb difference" },
  { key: "dry_grams", label: "Dry grams" },
  { key: "dry_lb_448", label: "Dry lb at 448 g" },
  { key: "dry_lb_standard", label: "Dry lb at 453.59237 g" },
  { key: "dry_diff", label: "Dry lb difference" },
  { key: "metrc_lb", label: "METRC lb" },
  { key: "metrc_uom", label: "METRC UOM" },
  { key: "flag", label: "Flag" },
];

export type HarvestReconcileLot = {
  lotId: string;
  hbn: string;
  entryDate: string;
  farm: string;
  growMethod: string;
  strain: string;
  marketStrain: string;
  wetGrams: number;
  dryGrams: number | null;
  metrcPounds: number | null;
  metrcUom: string;
  metrcMatched: boolean;
};

export type HarvestReconcileMetrcOnly = {
  name: string;
  harvestStart: string;
  pounds: number | null;
  uom: string;
};

export type HarvestReconcileModel = {
  from: string;
  to: string;
  farm: string;
  grow: string;
  lots: HarvestReconcileLot[];
  metrcOnly: HarvestReconcileMetrcOnly[];
  hours: number;
};

export type HarvestReconcileLoaded = {
  view: ReportView;
  filterHtml: string;
  from: string;
  to: string;
  ok: boolean;
  csv: string;
};

/** From and To as typed. Blank From is 30 days before today, blank To is today, cap 366. */
export function resolveHarvestReconcileRange(from: string | null, to: string | null, today: string) {
  return resolveDryStrainRange(from, to, today);
}

/** Half up, away from zero, to a fixed number of decimal places. */
export function roundPlaces(value: number, places: number): number {
  if (!Number.isFinite(value)) return value;
  const factor = 10 ** places;
  return (Math.sign(value) * Math.round(Math.abs(value) * factor)) / factor;
}

/** Four decimals, no thousands commas. */
export function fixedPlaces(value: number, places: number): string {
  return roundPlaces(value, places).toFixed(places);
}

export function poundsAt(grams: number, gramsPerLb: number): number {
  return grams / gramsPerLb;
}

/** (standard pound - 448) / 448, as a percent. Computed, not a stored figure. */
export function poundGapPercent(): number {
  return ((STANDARD_GRAMS_PER_LB - GRAMS_PER_LB) / GRAMS_PER_LB) * 100;
}

export function poundGapPercentText(): string {
  return fixedPlaces(poundGapPercent(), 4);
}

const UOM_GRAMS = new Set(["g", "gram", "grams"]);
const UOM_POUNDS = new Set(["lb", "lbs", "pound", "pounds"]);
const UOM_KG = new Set(["kg", "kgs", "kilogram", "kilograms"]);
const UOM_OZ = new Set(["oz", "ounce", "ounces"]);

/** Standard pounds from the mirror's own unit. Null when the unit is not one of the four. */
export function metrcToStandardPounds(weight: number, uom: string): number | null {
  if (!Number.isFinite(weight)) return null;
  const key = uom.trim().toLowerCase().replaceAll(".", "");
  if (UOM_GRAMS.has(key)) return weight / STANDARD_GRAMS_PER_LB;
  if (UOM_POUNDS.has(key)) return weight;
  if (UOM_KG.has(key)) return (weight * 1000) / STANDARD_GRAMS_PER_LB;
  if (UOM_OZ.has(key)) return weight / 16;
  return null;
}

export function chunkList<T>(items: readonly T[], size = METRC_NAME_CHUNK): T[][] {
  const out: T[][] = [];
  const step = size > 0 ? size : METRC_NAME_CHUNK;
  for (let i = 0; i < items.length; i += step) out.push(items.slice(i, i + step));
  return out;
}

function marketShown(strain: string, market: string): string {
  const typed = market.trim();
  if (!typed) return "";
  if (typed.toLowerCase() === strain.trim().toLowerCase()) return "";
  return typed;
}

function pagePounds(grams: number): string {
  return format2(poundsAt(grams, GRAMS_PER_LB));
}

function pageStandard(grams: number): string {
  return format2(poundsAt(grams, STANDARD_GRAMS_PER_LB));
}

function pageDiff(grams: number): string {
  const diff = poundsAt(grams, GRAMS_PER_LB) - poundsAt(grams, STANDARD_GRAMS_PER_LB);
  return format2(diff);
}

function csvPounds(grams: number): string {
  return fixedPlaces(poundsAt(grams, GRAMS_PER_LB), 4);
}

function csvStandard(grams: number): string {
  return fixedPlaces(poundsAt(grams, STANDARD_GRAMS_PER_LB), 4);
}

function csvDiff(grams: number): string {
  const diff = poundsAt(grams, GRAMS_PER_LB) - poundsAt(grams, STANDARD_GRAMS_PER_LB);
  return fixedPlaces(diff, 4);
}

function pageMetrc(pounds: number | null): string {
  if (pounds == null) return "";
  return format2(pounds);
}

function csvMetrc(pounds: number | null): string {
  if (pounds == null) return "";
  return fixedPlaces(pounds, 4);
}

type LotSql = {
  lot_id: string;
  hbn: string | null;
  entry_date: string | null;
  farm_code: string | null;
  grow_method_code: string | null;
  strain_name: string | null;
  market_strain: string | null;
  wet_grams: number | null;
  dry_grams: number | null;
};

type MetrcSql = {
  name: string;
  total_wet_weight: number | null;
  unit_of_weight: string | null;
  harvest_start_date: string | null;
  changed_at: string | null;
};

function keepLatest(map: Map<string, MetrcSql>, row: MetrcSql): void {
  const prev = map.get(row.name);
  if (!prev || String(row.changed_at ?? "") > String(prev.changed_at ?? "")) map.set(row.name, row);
}

function metrcOf(row: MetrcSql): { pounds: number | null; uom: string } {
  const uom = String(row.unit_of_weight ?? "").trim();
  const weight = row.total_wet_weight == null ? null : Number(row.total_wet_weight);
  const pounds = weight == null ? null : metrcToStandardPounds(weight, uom);
  return { pounds, uom };
}

function metrcOnlyKept(name: string, farm: string, grow: string): boolean {
  if (!farm && !grow) return true;
  const parts = parseHbn(name);
  if (!parts) return false;
  if (farm && parts.farm.toUpperCase() !== farm) return false;
  if (grow && parts.grow_code.toUpperCase() !== grow) return false;
  return true;
}

async function readMetrcByName(db: D1Database, names: readonly string[]): Promise<Map<string, MetrcSql>> {
  const map = new Map<string, MetrcSql>();
  for (const chunk of chunkList(names)) {
    if (chunk.length === 0) continue;
    const got = await db.prepare(harvestReconcileMetrcNamesSql(chunk.length)).bind(...chunk).all<MetrcSql>();
    for (const row of got.results ?? []) keepLatest(map, row);
  }
  return map;
}

async function readModel(
  db: D1Database,
  filter: { from: string; to: string; farm: string; grow: string }
): Promise<HarvestReconcileModel> {
  const lotBinds: unknown[] = [filter.from, filter.to];
  if (filter.farm) lotBinds.push(filter.farm);
  if (filter.grow) lotBinds.push(filter.grow);
  const lotsGot = await db
    .prepare(harvestReconcileLotsSql(Boolean(filter.farm), Boolean(filter.grow)))
    .bind(...lotBinds)
    .all<LotSql>();
  const lotRows = lotsGot.results ?? [];
  const names = [...new Set(lotRows.map((row) => String(row.hbn ?? "")).filter((name) => name !== ""))];
  const metrcByName = await readMetrcByName(db, names);
  const lots: HarvestReconcileLot[] = lotRows.map((row) => {
    const hbn = String(row.hbn ?? "");
    const hit = hbn ? metrcByName.get(hbn) : undefined;
    const metrc = hit ? metrcOf(hit) : { pounds: null, uom: "" };
    return {
      lotId: String(row.lot_id),
      hbn,
      entryDate: String(row.entry_date ?? ""),
      farm: String(row.farm_code ?? ""),
      growMethod: String(row.grow_method_code ?? ""),
      strain: String(row.strain_name ?? ""),
      marketStrain: String(row.market_strain ?? ""),
      wetGrams: Number(row.wet_grams ?? 0),
      dryGrams: row.dry_grams == null ? null : Number(row.dry_grams),
      metrcPounds: hit ? metrc.pounds : null,
      metrcUom: hit ? metrc.uom : "",
      metrcMatched: Boolean(hit),
    };
  });

  const upper = dayAfter(filter.to);
  const rangeGot = await db
    .prepare(HARVEST_RECONCILE_METRC_RANGE_SQL)
    .bind(filter.from, upper)
    .all<MetrcSql>();
  const liveGot = await db.prepare(HARVEST_RECONCILE_LIVE_HBN_SQL).bind().all<{ hbn: string }>();
  const live = new Set((liveGot.results ?? []).map((row) => String(row.hbn)));
  const inRange = new Map<string, MetrcSql>();
  for (const row of rangeGot.results ?? []) keepLatest(inRange, row);
  const metrcOnly: HarvestReconcileMetrcOnly[] = [...inRange.values()]
    .filter((row) => !live.has(row.name) && metrcOnlyKept(row.name, filter.farm, filter.grow))
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((row) => {
      const metrc = metrcOf(row);
      return {
        name: row.name,
        harvestStart: String(row.harvest_start_date ?? ""),
        pounds: metrc.pounds,
        uom: metrc.uom,
      };
    });

  const hourBinds: unknown[] = [filter.from, filter.to];
  if (filter.farm) hourBinds.push(filter.farm);
  const hoursGot = await db
    .prepare(harvestReconcileHoursSql(Boolean(filter.farm)))
    .bind(...hourBinds)
    .first<{ hours: number }>();
  return {
    from: filter.from,
    to: filter.to,
    farm: filter.farm,
    grow: filter.grow,
    lots,
    metrcOnly,
    hours: Number(hoursGot?.hours ?? 0),
  };
}

function headingOf(model: HarvestReconcileModel, locale: Locale): string {
  const parts = [tFill(locale, "Harvested {from} to {to}", { from: model.from, to: model.to })];
  const method = DRY_STRAIN_GROW_METHODS.find((item) => item.code === model.grow);
  if (method) parts.push(t(locale, method.label));
  if (model.farm) parts.push(model.farm);
  return parts.join(" · ");
}

function ratioLine(locale: Locale): string {
  return tFill(locale, HARVEST_RECONCILE_RATIO, {
    standard: STANDARD_GRAMS_PER_LB_TEXT,
    pct: poundGapPercentText(),
  });
}

function hoursLine(model: HarvestReconcileModel, locale: Locale): string {
  const hours = format2(model.hours);
  if (model.grow) {
    return tFill(locale, HARVEST_RECONCILE_GROW_HOURS, { hours });
  }
  if (!(model.hours > 0)) return t(locale, HARVEST_RECONCILE_NO_HOURS);
  const wet = model.lots.reduce((sum, lot) => sum + lot.wetGrams, 0);
  return tFill(locale, HARVEST_RECONCILE_RATE, {
    at448: format2(poundsAt(wet, GRAMS_PER_LB) / model.hours),
    atStandard: format2(poundsAt(wet, STANDARD_GRAMS_PER_LB) / model.hours),
    standard: STANDARD_GRAMS_PER_LB_TEXT,
    hours,
  });
}

function metrcOnlyHtml(rows: readonly HarvestReconcileMetrcOnly[], locale: Locale): string {
  if (rows.length === 0) return "";
  const head = ["Name", "Harvest start", "METRC lb", "METRC UOM"]
    .map((label) => `<th>${esc(t(locale, label))}</th>`)
    .join("");
  const body = rows
    .map((row) => {
      const cells = [row.name, row.harvestStart, pageMetrc(row.pounds), row.uom].map((value) => `<td>${esc(value)}</td>`).join("");
      return `<tr>${cells}</tr>`;
    })
    .join("");
  return `<h2>${esc(t(locale, HARVEST_RECONCILE_METRC_ONLY))}</h2>
    <table class="data metrc-only"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}

function blankRow(): Record<string, string> {
  return {
    short_id: "",
    strain: "",
    market_strain: "",
    farm: "",
    wet_grams: "",
    wet_lb_448: "",
    wet_lb_standard: "",
    wet_diff: "",
    dry_grams: "",
    dry_lb_448: "",
    dry_lb_standard: "",
    dry_diff: "",
    metrc_lb: "",
    metrc_uom: "",
    flag: "",
  };
}

/** The page: lot lines, a wet total, a dry total, then the ratio, the hours, and METRC only. */
export function harvestReconcileView(model: HarvestReconcileModel, locale: Locale = "en"): ReportView {
  const rows: ReportView["rows"] = model.lots.map((lot) => {
    const row = blankRow();
    row.short_id = lot.hbn ? shortLotId(lot.hbn, null) : "";
    row.strain = lot.strain.trim();
    row.market_strain = marketShown(lot.strain, lot.marketStrain);
    row.farm = lot.farm;
    row.wet_grams = formatGrams(lot.wetGrams);
    row.wet_lb_448 = pagePounds(lot.wetGrams);
    row.wet_lb_standard = pageStandard(lot.wetGrams);
    row.wet_diff = pageDiff(lot.wetGrams);
    if (lot.dryGrams != null) {
      row.dry_grams = formatGrams(lot.dryGrams);
      row.dry_lb_448 = pagePounds(lot.dryGrams);
      row.dry_lb_standard = pageStandard(lot.dryGrams);
      row.dry_diff = pageDiff(lot.dryGrams);
    }
    row.metrc_lb = lot.metrcMatched ? pageMetrc(lot.metrcPounds) : "";
    row.metrc_uom = lot.metrcMatched ? lot.metrcUom : "";
    row.flag = lot.metrcMatched ? "" : t(locale, HARVEST_RECONCILE_NO_METRC);
    return row;
  });
  if (model.lots.length > 0) {
    const wet = model.lots.reduce((sum, lot) => sum + lot.wetGrams, 0);
    const wetRow = blankRow();
    wetRow.short_id = t(locale, HARVEST_RECONCILE_WET_TOTAL);
    wetRow.wet_grams = formatGrams(wet);
    wetRow.wet_lb_448 = pagePounds(wet);
    wetRow.wet_lb_standard = pageStandard(wet);
    wetRow.wet_diff = pageDiff(wet);
    wetRow._total = "1";
    const dryLots = model.lots.filter((lot) => lot.dryGrams != null);
    const dryRow = blankRow();
    dryRow.short_id = t(locale, HARVEST_RECONCILE_DRY_TOTAL);
    if (dryLots.length > 0) {
      const dry = dryLots.reduce((sum, lot) => sum + (lot.dryGrams ?? 0), 0);
      dryRow.dry_grams = formatGrams(dry);
      dryRow.dry_lb_448 = pagePounds(dry);
      dryRow.dry_lb_standard = pageStandard(dry);
      dryRow.dry_diff = pageDiff(dry);
    }
    dryRow._total = "1";
    rows.push(wetRow, dryRow);
  }
  const below = `<p class="report-ratio">${esc(ratioLine(locale))}</p>
    <p class="report-hours">${esc(hoursLine(model, locale))}</p>
    ${metrcOnlyHtml(model.metrcOnly, locale)}`;
  return {
    key: HARVEST_RECONCILE_KEY,
    title: "Harvest weight reconciliation",
    columns: HARVEST_RECONCILE_COLUMNS,
    rows,
    heading: headingOf(model, locale),
    empty: t(locale, HARVEST_RECONCILE_EMPTY),
    footnote: `${t(locale, HARVEST_RECONCILE_POUND_LAW)} ${t(locale, HARVEST_RECONCILE_DATE_COLUMN)}`,
    belowTable: below,
  };
}

export function harvestReconcileRefused(message: string, locale: Locale = "en"): ReportView {
  return {
    key: HARVEST_RECONCILE_KEY,
    title: "Harvest weight reconciliation",
    columns: HARVEST_RECONCILE_COLUMNS,
    rows: [],
    empty: t(locale, message),
    heading: t(locale, message),
  };
}

function csvCell(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replaceAll('"', '""')}"`;
  return value;
}

function csvLine(cells: readonly string[]): string {
  return cells.map(csvCell).join(",");
}

/** One row per lot. Grams are integers. Pounds have four decimals and no thousands commas. */
export function harvestReconcileCsv(model: HarvestReconcileModel): string {
  const lines = [headingOf(model, "en"), csvLine(HARVEST_RECONCILE_COLUMNS.map((column) => column.label))];
  for (const lot of model.lots) {
    const dry = lot.dryGrams;
    lines.push(
      csvLine([
        lot.hbn ? shortLotId(lot.hbn, null) : "",
        lot.strain.trim(),
        marketShown(lot.strain, lot.marketStrain),
        lot.farm,
        String(roundGrams(lot.wetGrams)),
        csvPounds(lot.wetGrams),
        csvStandard(lot.wetGrams),
        csvDiff(lot.wetGrams),
        dry == null ? "" : String(roundGrams(dry)),
        dry == null ? "" : csvPounds(dry),
        dry == null ? "" : csvStandard(dry),
        dry == null ? "" : csvDiff(dry),
        lot.metrcMatched ? csvMetrc(lot.metrcPounds) : "",
        lot.metrcMatched ? lot.metrcUom : "",
        lot.metrcMatched ? "" : HARVEST_RECONCILE_NO_METRC,
      ])
    );
  }
  if (model.lots.length > 0) {
    const wet = model.lots.reduce((sum, lot) => sum + lot.wetGrams, 0);
    lines.push(
      csvLine([
        HARVEST_RECONCILE_WET_TOTAL,
        "",
        "",
        "",
        String(roundGrams(wet)),
        csvPounds(wet),
        csvStandard(wet),
        csvDiff(wet),
        "",
        "",
        "",
        "",
        "",
        "",
        "",
      ])
    );
    const dryLots = model.lots.filter((lot) => lot.dryGrams != null);
    if (dryLots.length > 0) {
      const dry = dryLots.reduce((sum, lot) => sum + (lot.dryGrams ?? 0), 0);
      lines.push(
        csvLine([
          HARVEST_RECONCILE_DRY_TOTAL,
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          String(roundGrams(dry)),
          csvPounds(dry),
          csvStandard(dry),
          csvDiff(dry),
          "",
          "",
          "",
        ])
      );
    } else {
      lines.push(csvLine([HARVEST_RECONCILE_DRY_TOTAL, "", "", "", "", "", "", "", "", "", "", "", "", "", ""]));
    }
  }
  for (const row of model.metrcOnly) {
    lines.push(
      csvLine([
        row.name,
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        csvMetrc(row.pounds),
        row.uom,
        HARVEST_RECONCILE_METRC_ONLY,
      ])
    );
  }
  lines.push(csvCell(ratioLine("en")));
  lines.push(csvCell(hoursLine(model, "en")));
  return lines.join("\r\n") + "\r\n";
}

function filterHtmlOf(filter: { from: string; to: string; farm: string; grow: string }, locale: Locale): string {
  const opt = (value: string, label: string, picked: string) =>
    `<option value="${esc(value)}"${picked === value ? " selected" : ""}>${esc(label)}</option>`;
  const methodOpts = [opt("", t(locale, "All"), filter.grow), ...DRY_STRAIN_GROW_METHODS.map((item) => opt(item.code, t(locale, item.label), filter.grow))].join("");
  const farmOpts = [opt("", t(locale, "All"), filter.farm), ...DRY_STRAIN_FARMS.map((farm) => opt(farm, farm, filter.farm))].join("");
  return `<label class="field">${t(locale, "From")} <input type="date" name="from" value="${esc(filter.from)}"></label>
      <label class="field">${t(locale, "To")} <input type="date" name="to" value="${esc(filter.to)}"></label>
      <label class="field">${t(locale, "Farm")} <select name="farm">${farmOpts}</select></label>
      <label class="field">${t(locale, "Grow Method")} <select name="grow_method">${methodOpts}</select></label>
      <p class="muted">${esc(t(locale, HARVEST_RECONCILE_DATE_COLUMN))}</p>`;
}

export async function loadHarvestReconciliation(
  db: D1Database,
  params: URLSearchParams,
  today: string,
  locale: Locale = "en"
): Promise<HarvestReconcileLoaded> {
  const range = resolveHarvestReconcileRange(params.get("from"), params.get("to"), today);
  const farm = (params.get("farm") ?? "").trim().toUpperCase();
  const grow = (params.get("grow_method") ?? "").trim().toUpperCase();
  const from = range.ok ? range.from : (params.get("from") ?? "").trim();
  const to = range.ok ? range.to : (params.get("to") ?? "").trim();
  const filterHtml = filterHtmlOf({ from, to, farm, grow }, locale);
  if (!range.ok) {
    const view = harvestReconcileRefused(range.message, locale);
    return { view, filterHtml, from, to, ok: false, csv: `${t(locale, range.message)}\r\n` };
  }
  const model = await readModel(db, { from: range.from, to: range.to, farm, grow });
  return {
    view: harvestReconcileView(model, locale),
    filterHtml,
    from: range.from,
    to: range.to,
    ok: true,
    csv: harvestReconcileCsv(model),
  };
}
