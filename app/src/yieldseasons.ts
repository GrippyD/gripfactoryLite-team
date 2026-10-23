/**
 * DD L3: yield per plant, two prior seasons beside this year.
 * Past seasons are a sheet (season, strain, farm, plants, dry lb) uploaded
 * once under Admin, Director Dashboard, Past Seasons. This year is read live
 * from the strain performance builder: to date is its dryLbPerPlant, and the
 * projected figure adds the field estimate for lots still hanging or drying.
 */
import { HttpError, requireReason, textOrNull } from "./audit";
import { format2, GRAMS_PER_LB, round2 } from "./config";
import { insertLog, logsForInsert, requireActor } from "./db";
import { ESTIMATES_AS_OF_SQL } from "./fieldestimates";
import { farmDay, parseFarmDayStartHour } from "./farmday";
import { t, tFill, type Locale } from "./i18n";
import {
  buildStrainPerformance,
  estimateInForce,
  STRAIN_PERFORMANCE_LOTS_SQL,
  strainPerformanceName,
  type StrainPerformanceEstimate,
  type StrainPerformanceLot,
} from "./strainperformance";
import { esc } from "./ui";
import { readXlsxSheets, type XlsxGridRow } from "./xlsx";

export const YIELD_SEASONS_KPI = "harvest.dry_lb_per_plant_vs_plan_pct";
export const PAST_SEASONS_PATH = "/admin/director/past-seasons";
export const PAST_SEASONS_REASON = "past seasons upload";
export const PAST_SEASONS_SOURCE = "upload";
export const YIELD_SEASONS_VERSION = 2;
export const SHEET_SHAPE = "Season, Strain, Farm, Plants, Dry lb; one row per strain per season (per farm if you have it).";
export const PROJECTED_NOTE =
  "Projected: dried lots as weighed plus the field estimate for lots still hanging or drying. Final when the last lot is unloaded.";
export const YIELD_FOOT =
  "{n} {strains}; to date over {m} dried {lots} with plant counts; {k} {dryingLots} still drying; {l} {missingLots} with no plant count";
export const YIELD_NO_ESTIMATE = "{n} {lots} still drying with no field estimate, left out of projected.";

const SHEET_NEEDS = "The sheet needs columns Season, Strain, Plants, and Dry lb.";
const CHOOSE_FILE = "Choose a file.";

export type SeasonYieldInput = {
  season: number;
  strain: string;
  farm: string | null;
  plants: number;
  dryLb: number;
};

export type YieldCellState = "value" | "missing" | "new" | "projected" | "final";

export type YieldCell = {
  text: string;
  state: YieldCellState;
  plants: number | null;
  dryLb: number | null;
};

export type YieldColumnKind = "season" | "avg" | "todate" | "projected";

export type YieldColumn = {
  kind: YieldColumnKind;
  season: number | null;
};

export type YieldRow = {
  strain: string;
  farmWide: boolean;
  cells: YieldCell[];
  /** The projected rate, for sort. Null when this year has no plant count. */
  projected: number | null;
};

export type YieldSeasonsModel = {
  day: string;
  year: number;
  columns: YieldColumn[];
  rows: YieldRow[];
  strains: number;
  driedLots: number;
  dryingLots: number;
  missingLots: number;
  /** Lots still hanging or drying with a plant count and no field estimate in force: left out of projected. */
  noEstimateLots: number;
  /** Farm wide to date, two decimals, null when no dried lot has a plant count. */
  toDate: number | null;
  /** Farm wide projected, two decimals, null when no cut lot has a plant count. */
  projected: number | null;
};

type SqlRow = Record<string, unknown>;

type StrainHit = { id: string; name: string };

type ParsedRow = {
  row: number;
  season: number | null;
  strain: string;
  farm: string | null;
  plants: number | null;
  dryLb: number | null;
  strainId: string | null;
  matchedName: string | null;
  key: string;
  reason: string;
};

export type SeasonPreview = {
  rows: ParsedRow[];
  matched: string[];
  unmatched: string[];
  refused: string[];
  duplicates: string[];
  landing: number;
};

export type SeasonCommit = SeasonPreview & {
  added: number;
  updated: number;
  unchanged: number;
};

export type HeldRow = {
  id: string;
  season: number;
  strain: string;
  farm: string | null;
  plants: number;
  dryLb: number;
};

export type PastSeasonGroup = {
  season: number;
  rows: HeldRow[];
  plants: number;
  dryLb: number;
};

export type PastSeasonsPageModel = {
  groups: PastSeasonGroup[];
  preview: SeasonPreview | null;
  added: number | null;
  updated: number | null;
  unchanged: number | null;
  refused: number | null;
};

/** Case and spaces aside, so "Blue  Dream" and "bluedream" are one strain. */
export function seasonStrainKey(name: string): string {
  return String(name ?? "").trim().toLowerCase().replace(/\s+/g, "");
}

function farmKey(farm: string | null | undefined): string {
  return String(farm ?? "").trim().toUpperCase();
}

function countedLot(lot: StrainPerformanceLot): boolean {
  return Boolean(lot.unloaded) && lot.plantCount != null && lot.plantCount > 0;
}

function perPlantText(grams: number, plants: number): string {
  if (!(plants > 0)) return "";
  return format2(round2(grams / GRAMS_PER_LB / plants));
}

function rateText(dryLb: number, plants: number): string {
  if (!(plants > 0)) return "";
  return format2(round2(dryLb / plants));
}

function rateNum(dryLb: number, plants: number): number | null {
  if (!(plants > 0) || !Number.isFinite(dryLb)) return null;
  return round2(dryLb / plants);
}

function missingCell(): YieldCell {
  return { text: "", state: "missing", plants: null, dryLb: null };
}

function newCell(): YieldCell {
  return { text: "", state: "new", plants: null, dryLb: null };
}

function valueCell(text: string, plants: number, dryLb: number): YieldCell {
  return { text, state: "value", plants, dryLb };
}

/** Farm specific rows win when a strain has them. A blank farm is the wide row. */
function pickedSeason(rows: readonly SeasonYieldInput[], season: number, key: string): SeasonYieldInput[] {
  const mine = rows.filter((row) => row.season === season && seasonStrainKey(row.strain) === key);
  const farms = mine.filter((row) => farmKey(row.farm) !== "");
  return farms.length > 0 ? farms : mine;
}

function sumSeason(rows: readonly SeasonYieldInput[]): { plants: number; dryLb: number } {
  let plants = 0;
  let dryLb = 0;
  for (const row of rows) {
    plants += row.plants;
    dryLb += row.dryLb;
  }
  return { plants, dryLb };
}

function lotName(lot: StrainPerformanceLot): string {
  return strainPerformanceName(lot.strain, lot.marketStrain).trim();
}

/**
 * THE GATE'S FIX (Scribe, 2026-10-22): a lot still hanging or drying counts in
 * projected only with a field estimate in force for its strain and farm, its
 * plants and its estimated pounds together. A lot with no estimate is left out
 * of projected and counted, so a projection never adds plants without pounds.
 */
function estimatedDrying(
  lots: readonly StrainPerformanceLot[],
  estimates: readonly StrainPerformanceEstimate[],
  day: string
): { pounds: number; plants: number; withoutEstimate: number } {
  let pounds = 0;
  let plants = 0;
  let withoutEstimate = 0;
  for (const lot of lots) {
    if (lot.unloaded || lot.plantCount == null || !(lot.plantCount > 0)) continue;
    const estimate = estimateInForce(estimates, lotName(lot), lot.farm, day);
    if (!estimate) {
      withoutEstimate += 1;
      continue;
    }
    pounds += estimate.dryLbPerPlant * lot.plantCount;
    plants += lot.plantCount;
  }
  return { pounds, plants, withoutEstimate };
}

function poolCounted(lots: readonly StrainPerformanceLot[]): { grams: number; plants: number; text: string } {
  let grams = 0;
  let plants = 0;
  for (const lot of lots) {
    if (!countedLot(lot)) continue;
    grams += lot.dryGrams ?? 0;
    plants += lot.plantCount ?? 0;
  }
  return { grams, plants, text: perPlantText(grams, plants) };
}

/**
 * One row per strain grown this year, then the farm wide sums.
 * To date is the strain performance number (its builder, same lots).
 * Projected adds the estimate in force for lots cut and not yet unloaded.
 * When every lot of that row is unloaded, projected reads final and equals to date.
 */
export function buildYieldSeasons(input: {
  seasons: readonly SeasonYieldInput[];
  lots: readonly StrainPerformanceLot[];
  estimates: readonly StrainPerformanceEstimate[];
  day: string;
  year: number;
}): YieldSeasonsModel {
  const perf = buildStrainPerformance({
    lots: input.lots,
    plants: [],
    estimates: input.estimates,
    day: input.day,
    year: input.year,
  });
  const held = [...new Set(input.seasons.map((row) => row.season))]
    .filter((season) => Number.isInteger(season))
    .sort((a, b) => b - a)
    .slice(0, 2)
    .sort((a, b) => a - b);
  const columns: YieldColumn[] = [
    ...held.map((season) => ({ kind: "season" as const, season })),
    { kind: "avg", season: null },
    { kind: "todate", season: null },
    { kind: "projected", season: null },
  ];

  const groups = new Map<string, { name: string; lots: StrainPerformanceLot[] }>();
  for (const lot of input.lots) {
    const name = lotName(lot);
    if (!name) continue;
    const key = seasonStrainKey(name);
    const group = groups.get(key) ?? { name, lots: [] };
    group.lots.push(lot);
    groups.set(key, group);
  }

  const strainRows: YieldRow[] = [];
  for (const [key, group] of groups) {
    const seasonCells: YieldCell[] = [];
    const rates: number[] = [];
    for (const season of held) {
      const picked = pickedSeason(input.seasons, season, key);
      const sum = sumSeason(picked);
      if (!(sum.plants > 0)) {
        seasonCells.push(missingCell());
        continue;
      }
      seasonCells.push(valueCell(rateText(sum.dryLb, sum.plants), sum.plants, sum.dryLb));
      const rate = sum.dryLb / sum.plants;
      if (Number.isFinite(rate)) rates.push(rate);
    }
    const only = rates.length === 1 ? seasonCells.find((cell) => cell.state === "value") : undefined;
    const avgCell: YieldCell =
      rates.length === 0
        ? newCell()
        : rates.length === 1
          ? { text: only?.text ?? "", state: "value", plants: only?.plants ?? null, dryLb: only?.dryLb ?? null }
          : { text: format2(round2(rates.reduce((n, rate) => n + rate, 0) / rates.length)), state: "value", plants: null, dryLb: null };

    const perfRows = perf.rows.filter((row) => !row.total && seasonStrainKey(row.strain) === key);
    const pooled = poolCounted(group.lots);
    const toDateText = perfRows.length === 1 ? perfRows[0]?.dryLbPerPlant ?? "" : pooled.text;
    const toDateCell: YieldCell = toDateText
      ? valueCell(toDateText, pooled.plants, pooled.grams / GRAMS_PER_LB)
      : { text: "", state: "value", plants: pooled.plants > 0 ? pooled.plants : null, dryLb: null };

    const open = group.lots.some((lot) => !lot.unloaded);
    const drying = estimatedDrying(group.lots, input.estimates, input.day);
    const allPlants = pooled.plants + drying.plants;
    const allLb = pooled.grams / GRAMS_PER_LB + drying.pounds;
    const projectedNum = allPlants > 0 ? round2(allLb / allPlants) : null;
    const final = !open;
    const projectedText = final ? toDateText : allPlants > 0 ? format2(projectedNum ?? 0) : "";
    const projectedCell: YieldCell = {
      text: projectedText,
      state: projectedText ? (final ? "final" : "projected") : "value",
      plants: allPlants > 0 ? allPlants : null,
      dryLb: allPlants > 0 ? (final ? pooled.grams / GRAMS_PER_LB : allLb) : null,
    };
    strainRows.push({
      strain: group.name,
      farmWide: false,
      cells: [...seasonCells, avgCell, toDateCell, projectedCell],
      projected: projectedText ? (final ? rateNum(pooled.grams / GRAMS_PER_LB, pooled.plants) : projectedNum) : null,
    });
  }
  strainRows.sort((a, b) => {
    const av = a.projected ?? Number.NEGATIVE_INFINITY;
    const bv = b.projected ?? Number.NEGATIVE_INFINITY;
    if (av !== bv) return bv - av;
    return a.strain < b.strain ? -1 : a.strain > b.strain ? 1 : 0;
  });

  const rows = [...strainRows];
  let toDate: number | null = null;
  let projected: number | null = null;
  if (strainRows.length > 0) {
    const seasonCells: YieldCell[] = [];
    const rates: number[] = [];
    for (const season of held) {
      // THE GATE'S FIX (Scribe, 2026-10-22): farm wide is the whole season as held,
      // the strains not grown this year included, as Past Seasons totals it.
      let plants = 0;
      let dryLb = 0;
      const keys = new Set(input.seasons.filter((row) => row.season === season).map((row) => seasonStrainKey(row.strain)));
      for (const key of keys) {
        const sum = sumSeason(pickedSeason(input.seasons, season, key));
        plants += sum.plants;
        dryLb += sum.dryLb;
      }
      if (!(plants > 0)) {
        seasonCells.push(missingCell());
        continue;
      }
      seasonCells.push(valueCell(rateText(dryLb, plants), plants, dryLb));
      rates.push(dryLb / plants);
    }
    const only = rates.length === 1 ? seasonCells.find((cell) => cell.state === "value") : undefined;
    const avgCell: YieldCell =
      rates.length === 0
        ? newCell()
        : rates.length === 1
          ? { text: only?.text ?? "", state: "value", plants: only?.plants ?? null, dryLb: only?.dryLb ?? null }
          : { text: format2(round2(rates.reduce((n, rate) => n + rate, 0) / rates.length)), state: "value", plants: null, dryLb: null };
    const total = perf.rows.find((row) => row.total);
    const pooled = poolCounted(input.lots);
    const toDateText = total?.dryLbPerPlant ?? pooled.text;
    toDate = pooled.plants > 0 ? round2(pooled.grams / GRAMS_PER_LB / pooled.plants) : null;
    const toDateCell: YieldCell = toDateText
      ? valueCell(toDateText, pooled.plants, pooled.grams / GRAMS_PER_LB)
      : { text: "", state: "value", plants: null, dryLb: null };
    const open = input.lots.some((lot) => !lot.unloaded);
    const drying = estimatedDrying(input.lots, input.estimates, input.day);
    const allPlants = pooled.plants + drying.plants;
    const allLb = pooled.grams / GRAMS_PER_LB + drying.pounds;
    projected = allPlants > 0 ? round2(allLb / allPlants) : null;
    const final = !open;
    const projectedText = final ? toDateText : allPlants > 0 ? format2(projected ?? 0) : "";
    if (final) projected = toDate;
    rows.push({
      strain: "",
      farmWide: true,
      cells: [
        ...seasonCells,
        avgCell,
        toDateCell,
        {
          text: projectedText,
          state: projectedText ? (final ? "final" : "projected") : "value",
          plants: allPlants > 0 ? allPlants : null,
          dryLb: allPlants > 0 ? (final ? pooled.grams / GRAMS_PER_LB : allLb) : null,
        },
      ],
      projected,
    });
  }

  return {
    day: input.day,
    year: input.year,
    columns,
    rows,
    strains: strainRows.length,
    driedLots: input.lots.filter((lot) => countedLot(lot)).length,
    dryingLots: input.lots.filter((lot) => !lot.unloaded).length,
    missingLots: input.lots.filter((lot) => lot.plantCount == null || !(lot.plantCount > 0)).length,
    noEstimateLots: estimatedDrying(input.lots, input.estimates, input.day).withoutEstimate,
    toDate,
    projected,
  };
}

export function emptyYieldSeasons(day: string, year: number): YieldSeasonsModel {
  return buildYieldSeasons({ seasons: [], lots: [], estimates: [], day, year });
}

function lotWord(n: number, locale: Locale): string {
  return t(locale, n === 1 ? "lot" : "lots");
}

export function yieldNoEstimateLine(n: number, locale: Locale): string {
  return n > 0 ? tFill(locale, YIELD_NO_ESTIMATE, { n: String(n), lots: lotWord(n, locale) }) : "";
}

export function yieldFootLine(model: Pick<YieldSeasonsModel, "strains" | "driedLots" | "dryingLots" | "missingLots">, locale: Locale): string {
  return tFill(locale, YIELD_FOOT, {
    n: String(model.strains),
    strains: t(locale, model.strains === 1 ? "strain" : "strains"),
    m: String(model.driedLots),
    lots: lotWord(model.driedLots, locale),
    k: String(model.dryingLots),
    dryingLots: lotWord(model.dryingLots, locale),
    l: String(model.missingLots),
    missingLots: lotWord(model.missingLots, locale),
  });
}

function columnLabel(column: YieldColumn, model: YieldSeasonsModel, locale: Locale): string {
  if (column.kind === "season") return String(column.season ?? "");
  if (column.kind === "avg") return t(locale, model.columns.filter((col) => col.kind === "season").length >= 2 ? "Avg (2 seasons)" : "Avg");
  if (column.kind === "todate") return `${model.year} ${t(locale, "to date")}`;
  return `${model.year} ${t(locale, "projected")}`;
}

function cellShown(cell: YieldCell, locale: Locale): string {
  if (cell.state === "missing") return t(locale, "not grown");
  if (cell.state === "new") return t(locale, "new");
  return cell.text;
}

function poundsText(pounds: number): string {
  return format2(round2(pounds));
}

function backing(cell: YieldCell, label: string, locale: Locale): string {
  if (cell.plants == null || cell.dryLb == null || cell.state === "missing" || cell.state === "new") return "";
  return `${label}: ${cell.plants} ${t(locale, "plants")}, ${poundsText(cell.dryLb)} ${t(locale, "lb")}`;
}

/** The farmops tile. Phone hides the two season columns until the toggle. */
export function yieldSeasonsBody(model: YieldSeasonsModel, locale: Locale = "en"): string {
  const seasonCount = model.columns.filter((column) => column.kind === "season").length;
  const toggle =
    seasonCount > 0
      ? `<label class="dd-yield-toggle"><input type="checkbox" data-dd-yield-seasons> ${esc(t(locale, "Prior seasons"))}</label>`
      : "";
  const link = `<p class="dd-yield-link"><a href="${esc(PAST_SEASONS_PATH)}">${esc(t(locale, "Past Seasons"))}</a></p>`;
  const note = `<p class="dd-yield-note" data-dd-yield-note>${esc(t(locale, PROJECTED_NOTE))}</p>`;
  const noEstimate = yieldNoEstimateLine(model.noEstimateLots, locale);
  const foot = `<p class="dd-yield-foot" data-dd-yield-foot>${esc(yieldFootLine(model, locale))}</p>${
    noEstimate ? `<p class="dd-yield-foot" data-dd-yield-no-estimate="${model.noEstimateLots}">${esc(noEstimate)}</p>` : ""
  }`;
  if (model.rows.length === 0) {
    return `<div class="dd-yield" data-dd-yield data-dd-yield-empty="1">${link}${note}${foot}</div>`;
  }
  let seasonSlot = 0;
  const heads = model.columns
    .map((column) => {
      const label = columnLabel(column, model, locale);
      const seasonClass = column.kind === "season" ? " dd-yield-season" : "";
      const title = column.kind === "projected" ? ` title="${esc(t(locale, PROJECTED_NOTE))}"` : "";
      return `<th class="${seasonClass.trim()}"${title} scope="col">${esc(label)}</th>`;
    })
    .join("");
  const body = model.rows
    .map((row) => {
      seasonSlot = 0;
      const attrs: string[] = [];
      const cells = row.cells
        .map((cell, index) => {
          const column = model.columns[index];
          const shown = cellShown(cell, locale);
          const seasonClass = column?.kind === "season" ? " dd-yield-season" : "";
          const projectedClass = column?.kind === "projected" ? " dd-yield-projected" : "";
          const tip = backing(cell, column ? columnLabel(column, model, locale) : "", locale);
          const title = tip ? ` title="${esc(tip)}"` : "";
          if (column?.kind === "season") {
            attrs.push(`data-dd-yield-s${seasonSlot}="${esc(shown)}"`);
            seasonSlot += 1;
          } else if (column?.kind === "avg") attrs.push(`data-dd-yield-avg="${esc(shown)}"`);
          else if (column?.kind === "todate") attrs.push(`data-dd-yield-todate="${esc(shown)}"`);
          else if (column?.kind === "projected") {
            attrs.push(`data-dd-yield-projected="${esc(shown)}"`);
            attrs.push(`data-dd-yield-state="${esc(cell.state)}"`);
          }
          const word =
            cell.state === "projected" || cell.state === "final"
              ? `<span class="dd-yield-word">${esc(t(locale, cell.state === "final" ? "final" : "projected"))}</span>`
              : "";
          const plants = cell.plants == null ? "" : ` data-dd-yield-plants="${esc(cell.plants)}"`;
          const lb = cell.dryLb == null ? "" : ` data-dd-yield-lb="${esc(poundsText(cell.dryLb))}"`;
          return `<td class="${(seasonClass + projectedClass).trim()}"${title}${plants}${lb} data-dd-yield-col="${esc(column?.kind ?? "")}">${word ? `<span class="dd-yield-num">${esc(shown)}</span>${word}` : esc(shown)}</td>`;
        })
        .join("");
      const who = row.farmWide
        ? `<th scope="row">${esc(t(locale, "Farm wide"))}</th>`
        : `<th scope="row">${esc(row.strain)}</th>`;
      const mark = row.farmWide ? ` data-dd-yield-farm="1"` : ` data-dd-yield-strain="${esc(row.strain)}"`;
      const lines = row.cells
        .map((cell, index) => backing(cell, model.columns[index] ? columnLabel(model.columns[index] as YieldColumn, model, locale) : "", locale))
        .filter((line) => line !== "");
      const detail = `<tr class="dd-yield-back"><td colspan="${model.columns.length + 1}">${esc(lines.join(". "))}</td></tr>`;
      return `<tr class="dd-yield-row${row.farmWide ? " dd-yield-farm" : ""}" tabindex="0"${mark} ${attrs.join(" ")}>${who}${cells}</tr>${detail}`;
    })
    .join("");
  return `<div class="dd-yield" data-dd-yield data-dd-yield-empty="0">
      ${link}
      ${toggle}
      <table class="dd-yield-table">
        <thead><tr><th scope="col">${esc(t(locale, "Strain"))}</th>${heads}</tr></thead>
        <tbody>${body}</tbody>
      </table>
      ${note}
      ${foot}
    </div>`;
}

function lotFromRow(row: SqlRow): StrainPerformanceLot {
  return {
    id: String(row.lot_id ?? ""),
    farm: String(row.farm ?? ""),
    strain: String(row.strain_name ?? ""),
    marketStrain: String(row.market_strain ?? ""),
    wetGrams: Number(row.wet_grams ?? 0),
    dryGrams: row.dry_grams == null ? null : Number(row.dry_grams),
    plantCount: row.plant_count == null ? null : Number(row.plant_count),
    unloaded: Number(row.unloaded ?? 0) === 1,
  };
}

export function yieldSeasonStatements(db: D1Database, year: number, day: string): D1PreparedStatement[] {
  return [
    db.prepare(
      `SELECT season, strain, farm_code, plants, dry_lb FROM dd_season_yields WHERE deleted_at IS NULL`
    ),
    db.prepare(STRAIN_PERFORMANCE_LOTS_SQL).bind(year),
    db.prepare(ESTIMATES_AS_OF_SQL).bind(day, day),
    db.prepare(`SELECT id, name FROM strains WHERE deleted_at IS NULL`),
  ];
}

export function yieldModelFromRows(seasonRows: readonly SqlRow[], lotRows: readonly SqlRow[], estimateRows: readonly SqlRow[], strainRows: readonly SqlRow[], day: string, year: number): YieldSeasonsModel {
  const names = new Map<string, string>();
  for (const row of strainRows) names.set(String(row.id ?? ""), String(row.name ?? "").trim());
  const estimates: StrainPerformanceEstimate[] = [];
  for (const row of estimateRows) {
    const strainName = names.get(String(row.strain_id ?? "")) ?? "";
    if (!strainName) continue;
    estimates.push({
      strainName,
      farm: String(row.farm_code ?? ""),
      effectiveDate: String(row.effective_date ?? ""),
      dryLbPerPlant: Number(row.est_dry_weight ?? 0),
    });
  }
  return buildYieldSeasons({
    day,
    year,
    seasons: seasonRows.map((row) => ({
      season: Number(row.season ?? 0),
      strain: String(row.strain ?? ""),
      farm: row.farm_code == null || String(row.farm_code).trim() === "" ? null : String(row.farm_code),
      plants: Number(row.plants ?? 0),
      dryLb: Number(row.dry_lb ?? 0),
    })),
    lots: lotRows.map(lotFromRow),
    estimates,
  });
}

async function farmDayOf(db: D1Database, now: string): Promise<string> {
  const hourRow = await db.prepare(`SELECT value FROM app_config WHERE key = 'farm_day_start_hour' AND deleted_at IS NULL`).first<{ value: string }>();
  return farmDay(now, parseFarmDayStartHour(hourRow?.value ?? null));
}

export async function loadYieldSeasons(db: D1Database, day: string, year: number): Promise<YieldSeasonsModel> {
  const results = await db.batch(yieldSeasonStatements(db, year, day));
  const rows = (result: unknown) => {
    const list = (result as { results?: SqlRow[] } | null)?.results;
    return list ?? [];
  };
  return yieldModelFromRows(rows(results[0]), rows(results[1]), rows(results[2]), rows(results[3]), day, year);
}

export type YieldRefresh = { written: number; toDate: number | null; projected: number | null };

/** Daily farm wide to date and projected, dims "" , todate, and projected. An unchanged value is left alone. */
export async function refreshYieldSeasons(db: D1Database, now: string): Promise<YieldRefresh> {
  const today = await farmDayOf(db, now);
  const year = Number(today.slice(0, 4));
  if (!Number.isInteger(year) || year <= 0) return { written: 0, toDate: null, projected: null };
  const model = await loadYieldSeasons(db, today, year);
  const live = await db
    .prepare(
      `SELECT id, dim_key, value, n FROM dd_kpi_values
       WHERE kpi_key = ? AND period_kind = 'day' AND period_start = ? AND source = 'app' AND superseded_at IS NULL
         AND dim_key IN ('', 'todate', 'projected')`
    )
    .bind(YIELD_SEASONS_KPI, today)
    .all<{ id: string; dim_key: string; value: number | null; n: number | null }>();
  const have = new Map((live.results ?? []).map((row) => [String(row.dim_key), row]));
  const writes: Array<{ dim: string; value: number | null; n: number }> = [
    { dim: "", value: model.toDate, n: model.driedLots },
    { dim: "todate", value: model.toDate, n: model.driedLots },
    { dim: "projected", value: model.projected, n: model.driedLots + model.dryingLots },
  ];
  const stmts: D1PreparedStatement[] = [];
  let written = 0;
  for (const write of writes) {
    const row = have.get(write.dim);
    const same =
      row &&
      write.value != null &&
      row.value != null &&
      Math.round(Number(row.value) * 100) === Math.round(write.value * 100) &&
      Number(row.n ?? 0) === write.n;
    if (same) continue;
    if (row) stmts.push(db.prepare(`UPDATE dd_kpi_values SET superseded_at = ? WHERE id = ? AND superseded_at IS NULL`).bind(now, row.id));
    if (write.value == null) continue;
    written += 1;
    stmts.push(
      db
        .prepare(
          `INSERT INTO dd_kpi_values (
             id, kpi_key, period_kind, period_start, dim_key, value, n, source, source_as_of, computed_at, def_version, created_at
           ) VALUES (?, ?, 'day', ?, ?, ?, ?, 'app', ?, ?, ?, ?)`
        )
        .bind(crypto.randomUUID(), YIELD_SEASONS_KPI, today, write.dim, write.value, write.n, now, now, YIELD_SEASONS_VERSION, now)
    );
  }
  if (stmts.length > 0) await db.batch(stmts);
  return { written, toDate: model.toDate, projected: model.projected };
}

function headerKey(name: string): string {
  return String(name ?? "").trim().toLowerCase().replace(/[\s_]+/g, "");
}

function csvRows(text: string): Array<{ row: number; cells: string[] }> {
  const src = text.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const out: Array<{ row: number; cells: string[] }> = [];
  let row = 1;
  let cell = "";
  let cells: string[] = [];
  let quote = false;
  const push = () => {
    cells.push(cell);
    cell = "";
  };
  const finish = () => {
    push();
    if (cells.some((value) => value.trim() !== "")) out.push({ row, cells });
    cells = [];
    row += 1;
  };
  for (let i = 0; i < src.length; i += 1) {
    const ch = src[i] ?? "";
    if (quote) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else quote = false;
      } else cell += ch;
      continue;
    }
    if (ch === '"') {
      quote = true;
      continue;
    }
    if (ch === ",") {
      push();
      continue;
    }
    if (ch === "\n") {
      finish();
      continue;
    }
    cell += ch;
  }
  if (cell !== "" || cells.length > 0) finish();
  return out;
}

function gridRows(grid: readonly XlsxGridRow[]): Array<{ row: number; cells: Array<string | number | null> }> {
  return grid.map((line) => ({
    row: line.row + 1,
    cells: line.cells.map((cell) => (cell == null || cell === "" ? null : typeof cell === "boolean" ? (cell ? "true" : "false") : cell)),
  }));
}

async function sheetRows(bytes: Uint8Array): Promise<Array<{ row: number; cells: Array<string | number | null> }>> {
  const zip = bytes.length >= 2 && bytes[0] === 0x50 && bytes[1] === 0x4b;
  if (!zip) return csvRows(new TextDecoder().decode(bytes));
  let sheets: Map<string, XlsxGridRow[]>;
  try {
    sheets = await readXlsxSheets(bytes);
  } catch {
    throw new HttpError(400, SHEET_NEEDS);
  }
  const first = sheets.values().next().value as XlsxGridRow[] | undefined;
  if (!first) throw new HttpError(400, SHEET_NEEDS);
  return gridRows(first);
}

function cellText(value: string | number | null): string {
  if (value == null) return "";
  return String(value).trim();
}

function wholeNumber(value: string | number | null): number | null {
  if (value == null || value === "") return null;
  if (typeof value === "number") return Number.isInteger(value) ? value : null;
  const text = String(value).trim().replace(/,/g, "");
  if (!/^-?\d+$/.test(text)) return null;
  return Number(text);
}

function pounds(value: string | number | null): number | null {
  if (value == null || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const text = String(value).trim().replace(/,/g, "");
  if (!/^\d+(\.\d+)?$/.test(text)) return null;
  const n = Number(text);
  return Number.isFinite(n) ? n : null;
}

function named(row: number, strain: string, reason: string): string {
  const who = strain.trim();
  return who ? `row ${row} ${who}: ${reason}` : `row ${row}: ${reason}`;
}

async function strainCatalog(db: D1Database): Promise<StrainHit[]> {
  const listed = await db.prepare(`SELECT id, name FROM strains WHERE deleted_at IS NULL AND TRIM(name) <> '' ORDER BY name`).all<{ id: string; name: string }>();
  return (listed.results ?? []).map((row) => ({ id: String(row.id), name: String(row.name ?? "") }));
}

function matchStrain(catalog: readonly StrainHit[], typed: string): StrainHit | null {
  const key = seasonStrainKey(typed);
  if (!key) return null;
  return catalog.find((row) => seasonStrainKey(row.name) === key) ?? null;
}

export async function previewSeasonYields(db: D1Database, bytes: Uint8Array): Promise<SeasonPreview> {
  const lines = await sheetRows(bytes);
  const header = lines.find((line) => line.cells.some((cell) => headerKey(cellText(cell)) === "season"));
  if (!header) throw new HttpError(400, SHEET_NEEDS);
  const names = header.cells.map((cell) => headerKey(cellText(cell)));
  const at = (want: string) => names.indexOf(want);
  const seasonAt = at("season");
  const strainAt = at("strain");
  const plantsAt = at("plants");
  const dryAt = at("drylb");
  const farmAt = at("farm");
  if (seasonAt < 0 || strainAt < 0 || plantsAt < 0 || dryAt < 0) throw new HttpError(400, SHEET_NEEDS);
  const catalog = await strainCatalog(db);
  const parsed: ParsedRow[] = [];
  for (const line of lines) {
    if (line.row <= header.row) continue;
    const take = (index: number) => (index < 0 ? null : (line.cells[index] ?? null));
    const strain = cellText(take(strainAt));
    const farmText = farmAt < 0 ? "" : cellText(take(farmAt));
    const season = wholeNumber(take(seasonAt));
    const plants = wholeNumber(take(plantsAt));
    const dryLb = pounds(take(dryAt));
    const any = strain !== "" || farmText !== "" || season != null || plants != null || dryLb != null;
    if (!any) continue;
    let reason = "";
    if (season == null || season < 1900 || season > 2100) reason = "no season";
    else if (!strain) reason = "no strain";
    else if (plants == null || plants <= 0) reason = "no plants";
    else if (dryLb == null || dryLb < 0) reason = "no dry lb";
    const hit = matchStrain(catalog, strain);
    const farm = farmText ? farmText.toUpperCase() : null;
    parsed.push({
      row: line.row,
      season: reason === "no season" ? null : season,
      strain,
      farm,
      plants: reason === "no plants" ? null : plants,
      dryLb: reason === "no dry lb" ? null : dryLb,
      strainId: hit?.id ?? null,
      matchedName: hit?.name ?? null,
      key: reason ? "" : `${season}|${seasonStrainKey(strain)}|${farmKey(farm)}`,
      reason,
    });
  }
  const seen = new Map<string, number>();
  for (const row of parsed) {
    if (row.reason || !row.key) continue;
    const prev = seen.get(row.key);
    if (prev != null) row.reason = "duplicate";
    else seen.set(row.key, row.row);
  }
  const matched = [...new Set(parsed.filter((row) => row.matchedName).map((row) => row.matchedName as string))].sort();
  const unmatched = [...new Set(parsed.filter((row) => row.strain && !row.matchedName).map((row) => row.strain))].sort();
  const refused = parsed.filter((row) => row.reason && row.reason !== "duplicate").map((row) => named(row.row, row.strain, row.reason));
  const duplicates = parsed.filter((row) => row.reason === "duplicate").map((row) => named(row.row, row.strain, "duplicate"));
  return {
    rows: parsed,
    matched,
    unmatched,
    refused,
    duplicates,
    landing: parsed.filter((row) => !row.reason).length,
  };
}

type LiveYield = {
  id: string;
  season: number;
  strain: string;
  strain_id: string | null;
  farm_code: string | null;
  plants: number;
  dry_lb: number;
};

function sameNumber(a: number, b: number): boolean {
  return Math.round(a * 1e6) === Math.round(b * 1e6);
}

export async function commitSeasonYields(db: D1Database, bytes: Uint8Array, actorId: string, now: string): Promise<SeasonCommit> {
  const preview = await previewSeasonYields(db, bytes);
  const live = await db
    .prepare(
      `SELECT id, season, strain, strain_id, farm_code, plants, dry_lb
       FROM dd_season_yields WHERE deleted_at IS NULL`
    )
    .all<LiveYield>();
  const have = new Map<string, LiveYield>();
  for (const row of live.results ?? []) {
    have.set(`${row.season}|${seasonStrainKey(String(row.strain))}|${farmKey(row.farm_code)}`, row);
  }
  const stmts: D1PreparedStatement[] = [];
  let added = 0;
  let updated = 0;
  let unchanged = 0;
  for (const row of preview.rows) {
    if (row.reason || row.season == null || row.plants == null || row.dryLb == null) continue;
    const prev = have.get(row.key);
    if (!prev) {
      const id = crypto.randomUUID();
      added += 1;
      stmts.push(
        db
          .prepare(
            `INSERT INTO dd_season_yields (
               id, season, strain, strain_id, farm_code, plants, dry_lb, source, note,
               created_at, created_by, updated_at, updated_by
             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?)`
          )
          .bind(id, row.season, row.strain, row.strainId, row.farm, row.plants, row.dryLb, PAST_SEASONS_SOURCE, now, actorId, now, actorId)
      );
      stmts.push(
        ...logsForInsert(
          db,
          "dd_season_yields",
          id,
          { season: row.season, strain: row.strain, farm_code: row.farm, plants: row.plants, dry_lb: row.dryLb },
          actorId,
          PAST_SEASONS_REASON,
          now
        )
      );
      have.set(row.key, {
        id,
        season: row.season,
        strain: row.strain,
        strain_id: row.strainId,
        farm_code: row.farm,
        plants: row.plants,
        dry_lb: row.dryLb,
      });
      continue;
    }
    const changes: Array<{ field: string; old: string | null; next: string | null }> = [];
    if (prev.strain !== row.strain) changes.push({ field: "strain", old: prev.strain, next: row.strain });
    if ((prev.strain_id ?? null) !== row.strainId) changes.push({ field: "strain_id", old: prev.strain_id, next: row.strainId });
    if (farmKey(prev.farm_code) !== farmKey(row.farm)) changes.push({ field: "farm_code", old: prev.farm_code, next: row.farm });
    if (Number(prev.plants) !== row.plants) changes.push({ field: "plants", old: String(prev.plants), next: String(row.plants) });
    if (!sameNumber(Number(prev.dry_lb), row.dryLb)) changes.push({ field: "dry_lb", old: String(prev.dry_lb), next: String(row.dryLb) });
    if (changes.length === 0) {
      unchanged += 1;
      continue;
    }
    updated += 1;
    stmts.push(
      db
        .prepare(
          `UPDATE dd_season_yields
           SET strain = ?, strain_id = ?, farm_code = ?, plants = ?, dry_lb = ?, updated_at = ?, updated_by = ?
           WHERE id = ? AND deleted_at IS NULL`
        )
        .bind(row.strain, row.strainId, row.farm, row.plants, row.dryLb, now, actorId, prev.id)
    );
    for (const change of changes) {
      stmts.push(
        insertLog(db, {
          record_table: "dd_season_yields",
          record_id: prev.id,
          field: change.field,
          old_value: change.old,
          new_value: change.next,
          actor_person_id: actorId,
          reason: PAST_SEASONS_REASON,
          changed_at: now,
        })
      );
    }
  }
  if (stmts.length > 0) await db.batch(stmts);
  return { ...preview, added, updated, unchanged };
}

export async function fileBytes(form: FormData): Promise<Uint8Array> {
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) throw new HttpError(400, CHOOSE_FILE);
  return new Uint8Array(await file.arrayBuffer());
}

export async function commitSeasonUpload(db: D1Database, form: FormData, now: string): Promise<{ redirect: string }> {
  const actor = await requireActor(db, textOrNull(form.get("person_id")));
  const result = await commitSeasonYields(db, await fileBytes(form), actor.id, now);
  const q = new URLSearchParams({
    ok: "saved",
    added: String(result.added),
    updated: String(result.updated),
    unchanged: String(result.unchanged),
    refused: String(result.refused.length + result.duplicates.length),
  });
  return { redirect: `${PAST_SEASONS_PATH}?${q.toString()}` };
}

export async function deleteSeasonYield(db: D1Database, id: string, form: FormData, now: string): Promise<{ redirect: string }> {
  const actor = await requireActor(db, textOrNull(form.get("person_id")));
  const reason = requireReason(textOrNull(form.get("reason")));
  const current = await db.prepare(`SELECT id FROM dd_season_yields WHERE id = ? AND deleted_at IS NULL`).bind(id).first<{ id: string }>();
  if (!current) return { redirect: PAST_SEASONS_PATH };
  await db.batch([
    db
      .prepare(
        `UPDATE dd_season_yields
         SET deleted_at = ?, deleted_by = ?, delete_reason = ?, updated_at = ?, updated_by = ?
         WHERE id = ? AND deleted_at IS NULL`
      )
      .bind(now, actor.id, reason, now, actor.id, current.id),
    insertLog(db, {
      record_table: "dd_season_yields",
      record_id: current.id,
      field: "deleted_at",
      old_value: null,
      new_value: now,
      actor_person_id: actor.id,
      reason,
      changed_at: now,
    }),
  ]);
  return { redirect: `${PAST_SEASONS_PATH}?ok=saved` };
}

export async function loadPastSeasonsPage(db: D1Database): Promise<PastSeasonsPageModel> {
  const listed = await db
    .prepare(
      `SELECT id, season, strain, farm_code, plants, dry_lb
       FROM dd_season_yields WHERE deleted_at IS NULL
       ORDER BY season DESC, strain, farm_code`
    )
    .all<{ id: string; season: number; strain: string; farm_code: string | null; plants: number; dry_lb: number }>();
  const groups = new Map<number, PastSeasonGroup>();
  for (const row of listed.results ?? []) {
    const season = Number(row.season);
    const group = groups.get(season) ?? { season, rows: [], plants: 0, dryLb: 0 };
    const plants = Number(row.plants ?? 0);
    const dryLb = Number(row.dry_lb ?? 0);
    group.rows.push({
      id: String(row.id),
      season,
      strain: String(row.strain ?? ""),
      farm: row.farm_code == null || String(row.farm_code).trim() === "" ? null : String(row.farm_code),
      plants,
      dryLb,
    });
    group.plants += plants;
    group.dryLb += dryLb;
    groups.set(season, group);
  }
  return {
    groups: [...groups.values()].sort((a, b) => b.season - a.season),
    preview: null,
    added: null,
    updated: null,
    unchanged: null,
    refused: null,
  };
}

function countQuery(raw: string | null): number | null {
  if (raw == null || !/^\d+$/.test(raw)) return null;
  return Number(raw);
}

export function pastSeasonsNotice(model: PastSeasonsPageModel, locale: Locale): string {
  if (model.added == null) return "";
  return tFill(locale, "Added {added}, updated {updated}, unchanged {unchanged}, refused {refused}.", {
    added: String(model.added),
    updated: String(model.updated ?? 0),
    unchanged: String(model.unchanged ?? 0),
    refused: String(model.refused ?? 0),
  });
}

export function withPastSeasonsQuery(model: PastSeasonsPageModel, query: { ok?: string | null; added?: string | null; updated?: string | null; unchanged?: string | null; refused?: string | null }): PastSeasonsPageModel {
  if (query.ok !== "saved") return model;
  return {
    ...model,
    added: countQuery(query.added ?? null),
    updated: countQuery(query.updated ?? null),
    unchanged: countQuery(query.unchanged ?? null),
    refused: countQuery(query.refused ?? null),
  };
}

function previewBlock(preview: SeasonPreview, locale: Locale): string {
  const line = (label: string, values: readonly string[]) =>
    `<p data-dd-preview="${esc(label)}">${esc(t(locale, label))}: ${esc(values.length === 0 ? t(locale, "none") : values.join(", "))}</p>`;
  const rows = preview.rows
    .map((row) => {
      const state = row.reason ? row.reason : "ok";
      return `<tr data-dd-preview-row="${esc(row.row)}" data-dd-preview-state="${esc(state)}">
          <td>${esc(row.row)}</td>
          <td>${esc(row.season ?? "")}</td>
          <td>${esc(row.strain)}</td>
          <td>${esc(row.farm ?? "")}</td>
          <td>${esc(row.plants ?? "")}</td>
          <td>${esc(row.dryLb ?? "")}</td>
          <td>${esc(row.matchedName ?? "")}</td>
          <td>${esc(row.reason ? t(locale, row.reason) : "")}</td>
        </tr>`;
    })
    .join("");
  return `<section class="dd-season-preview" data-dd-season-preview data-dd-preview-rows="${esc(preview.rows.length)}" data-dd-preview-landing="${esc(preview.landing)}">
      <h2>${esc(t(locale, "Preview"))}</h2>
      ${line("matched", preview.matched)}
      ${line("not matched", preview.unmatched)}
      ${line("refused", preview.refused)}
      ${line("duplicate", preview.duplicates)}
      <table>
        <thead><tr><th>${esc(t(locale, "Row"))}</th><th>${esc(t(locale, "Season"))}</th><th>${esc(t(locale, "Strain"))}</th><th>${esc(t(locale, "Farm"))}</th><th>${esc(t(locale, "Plants"))}</th><th>${esc(t(locale, "Dry lb"))}</th><th>${esc(t(locale, "matched"))}</th><th></th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </section>`;
}

export function pastSeasonsPage(model: PastSeasonsPageModel, locale: Locale = "en"): string {
  const notice = pastSeasonsNotice(model, locale);
  const banner = notice ? `<p class="banner ok" data-dd-notice="saved">${esc(notice)}</p>` : "";
  const groups = model.groups
    .map((group) => {
      const rows = group.rows
        .map((row) => {
          return `<tr data-dd-season-row="${esc(row.id)}">
              <td>${esc(row.strain)}</td>
              <td>${esc(row.farm ?? t(locale, "Farm wide"))}</td>
              <td>${esc(row.plants)}</td>
              <td>${esc(poundsText(row.dryLb))}</td>
              <td>
                <form method="post" action="${esc(`${PAST_SEASONS_PATH}/${row.id}/delete`)}">
                  <input type="text" name="reason" required autocomplete="off" aria-label="${esc(t(locale, "Reason"))}">
                  <button type="submit">${esc(t(locale, "Delete"))}</button>
                </form>
              </td>
            </tr>`;
        })
        .join("");
      return `<section data-dd-season="${esc(group.season)}">
          <h2>${esc(group.season)}</h2>
          <table>
            <thead><tr><th>${esc(t(locale, "Strain"))}</th><th>${esc(t(locale, "Farm"))}</th><th>${esc(t(locale, "Plants"))}</th><th>${esc(t(locale, "Dry lb"))}</th><th></th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
          <p data-dd-season-total="${esc(group.season)}">${esc(t(locale, "Farm wide"))}: ${esc(group.plants)} ${esc(t(locale, "plants"))}, ${esc(poundsText(group.dryLb))} ${esc(t(locale, "lb"))}</p>
        </section>`;
    })
    .join("");
  return `<div class="dd-seasons-page" data-dd-past-seasons>
      <h1>${esc(t(locale, "Past Seasons"))}</h1>
      <p class="dd-season-nav"><a href="/admin/director">${esc(t(locale, "Director Dashboard"))}</a></p>
      ${banner}
      <p class="dd-season-shape" data-dd-season-shape>${esc(t(locale, SHEET_SHAPE))}</p>
      <form method="post" action="${esc(`${PAST_SEASONS_PATH}/preview`)}" enctype="multipart/form-data" data-dd-season-upload>
        <label class="field">${esc(t(locale, "File"))}
          <input type="file" name="file" accept=".csv,.xlsx" required>
        </label>
        <button type="submit" formaction="${esc(`${PAST_SEASONS_PATH}/preview`)}">${esc(t(locale, "Preview"))}</button>
        <button type="submit" formaction="${esc(`${PAST_SEASONS_PATH}/commit`)}">${esc(t(locale, "Commit"))}</button>
      </form>
      ${model.preview ? previewBlock(model.preview, locale) : ""}
      ${groups}
    </div>`;
}
