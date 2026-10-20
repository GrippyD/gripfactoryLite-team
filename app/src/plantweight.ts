/**
 * DD S3d: Plant Weight on the bizops wall. Computed on the wall read.
 * Dried lots follow the console dry per plant law. The projection is
 * buildStrainPerformance season pounds over harvested plus remaining plants.
 */
import { format2, GRAMS_PER_LB, round2 } from "./config";
import { dayOffset, etDate, isCalendarDate } from "./farmday";
import { t, tFill, type Locale } from "./i18n";
import { buildStrainPerformance, strainPerformanceName, type StrainPerformanceRow } from "./strainperformance";
import { ownLotSql } from "./toll";
import { esc } from "./ui";

export const PLANT_WEIGHT_KPI = "bizops.plant_weight";
export const PLANT_WEIGHT_FARMS = ["PNN", "PNS", "ARL"] as const;
export type PlantWeightFarm = (typeof PLANT_WEIGHT_FARMS)[number];
export type PlantWeightPeriod = "7" | "14" | "30" | "htd";

export type PlantWeightLot = {
  id: string;
  day: string;
  farm: string;
  strain: string;
  grow: string;
  plants: number;
  grams: number;
};

export type PlantWeightSlice = {
  strain: string;
  farm: string;
  grow: string;
  seasonLb: number;
  plantsHarvested: number;
  plantsRemaining: number;
  estimateMissing: boolean;
};

export type PlantWeightPick = {
  period: PlantWeightPeriod;
  strain: string;
  farm: string;
  grow: string;
};

export type PlantWeightBox = {
  lb: number | null;
  lots: number;
  plants: number;
  grams: number;
};

export type PlantWeightProjected = {
  lb: number | null;
  plantsHarvested: number;
  plantsRemaining: number;
  missing: number;
};

export type PlantWeightFigures = {
  period: PlantWeightBox;
  avg: PlantWeightBox;
  projected: PlantWeightProjected;
};

export type PlantWeightGrow = { code: string; label: string };

export type PlantWeightModel = {
  today: string;
  year: number;
  lots: PlantWeightLot[];
  slices: PlantWeightSlice[];
  strains: string[];
  grows: PlantWeightGrow[];
  /** Strain and farm pairs whose lots do not share one grow method. */
  mixed: string[];
};

type GrowLot = {
  strain: string;
  farm: string;
  grow: string;
  plantCount: number | null;
  dryGrams: number | null;
  wetGrams: number;
  unloaded: boolean;
};

type LiveGroup = { strain: string; farm: string; grow: string; plants: number };

const PERIOD_NOTE = "Dry grams of the dried lots unloaded in the period, over their plants, in pounds at 448 g. {lots}. {grams} g.";
const AVG_NOTE = "Dry grams of the dried lots this harvest year, over their plants, in pounds at 448 g. {lots}. {grams} g.";
const PROJECTED_NOTE =
  "Season pounds over plants harvested plus plants still standing. Cut lots use their dry weight and standing plants use the field estimate.";

export function emptyPlantWeight(today: string, year: number): PlantWeightModel {
  return { today, year, lots: [], slices: [], strains: [], grows: [], mixed: [] };
}

/** Pounds at 448 g from grams per plant, two decimals, half up. Null when there are no plants. */
export function plantWeightLb(grams: number, plants: number): number | null {
  if (!(plants > 0) || !Number.isFinite(grams)) return null;
  return round2(grams / plants / GRAMS_PER_LB);
}

function norm(value: string): string {
  return value.trim().toLowerCase();
}

function farmCode(value: string): string {
  return value.trim().toUpperCase();
}

function pairKey(strain: string, farm: string): string {
  return `${norm(strain)}\n${farmCode(farm)}`;
}

function inPeriod(day: string, period: PlantWeightPeriod, today: string): boolean {
  // Scribe gate fix (S3d): HTD is the whole harvest year, so a dried lot with no
  // unload day on record still counts there, and HTD equals AVG Lbs/Plant.
  if (period === "htd") return true;
  if (!isCalendarDate(day) || !isCalendarDate(today) || day > today) return false;
  const n = period === "7" ? 7 : period === "30" ? 30 : 14;
  return day >= dayOffset(today, 1 - n);
}

function picked(value: string, pick: string): boolean {
  return pick === "" || norm(value) === norm(pick);
}

function sumBox(rows: readonly PlantWeightLot[]): PlantWeightBox {
  let grams = 0;
  let plants = 0;
  for (const row of rows) {
    grams += row.grams;
    plants += row.plants;
  }
  return { lb: plantWeightLb(grams, plants), lots: rows.length, plants, grams };
}

/** The three boxes for one pick. Period applies to the first box only. */
export function plantWeightFigures(model: Pick<PlantWeightModel, "today" | "lots" | "slices">, pick: PlantWeightPick): PlantWeightFigures {
  const lots = model.lots.filter((lot) => picked(lot.strain, pick.strain) && picked(lot.farm, pick.farm) && picked(lot.grow, pick.grow));
  const slices = model.slices.filter((row) => picked(row.strain, pick.strain) && picked(row.farm, pick.farm) && picked(row.grow, pick.grow));
  let season = 0;
  let harvested = 0;
  let remaining = 0;
  const missing = new Set<string>();
  for (const row of slices) {
    season += row.seasonLb;
    harvested += row.plantsHarvested;
    remaining += row.plantsRemaining;
    if (row.estimateMissing) missing.add(norm(row.strain));
  }
  const plants = harvested + remaining;
  return {
    period: sumBox(lots.filter((lot) => inPeriod(lot.day, pick.period, model.today))),
    avg: sumBox(lots),
    projected: {
      lb: plants > 0 ? round2(season / plants) : null,
      plantsHarvested: harvested,
      plantsRemaining: remaining,
      missing: missing.size,
    },
  };
}

function allocate(total: number, keys: readonly string[], weightOf: (key: string) => number): Map<string, number> {
  const out = new Map<string, number>();
  if (keys.length === 0 || !Number.isFinite(total)) return out;
  const whole = Math.round(total);
  const weights = keys.map((key) => Math.max(0, weightOf(key)));
  const sum = weights.reduce((n, weight) => n + weight, 0);
  const raw = keys.map(() => 0);
  if (sum > 0) {
    for (let i = 0; i < keys.length; i += 1) raw[i] = Math.floor((whole * (weights[i] ?? 0)) / sum);
  } else {
    const base = Math.floor(whole / keys.length);
    for (let i = 0; i < keys.length; i += 1) raw[i] = base;
  }
  let used = raw.reduce((n, value) => n + value, 0);
  const order = weights.map((weight, i) => ({ i, weight })).sort((a, b) => b.weight - a.weight || a.i - b.i);
  let step = 0;
  while (used < whole && order.length > 0) {
    const at = order[step % order.length]?.i ?? 0;
    raw[at] = (raw[at] ?? 0) + 1;
    used += 1;
    step += 1;
  }
  keys.forEach((key, i) => out.set(key, raw[i] ?? 0));
  return out;
}

type Bucket = {
  grow: string;
  seasonLb: number;
  plantsHarvested: number;
  plantsRemaining: number;
  estimateMissing: boolean;
};

/**
 * One slice per strain, farm, and grow method.
 * Lots that share one grow method keep their harvested pounds on that method.
 * Standing plants always split by location. Mixed lot methods split the
 * harvested pounds by plant count, and the caller lists those pairs.
 */
export function plantWeightSlices(
  rows: readonly StrainPerformanceRow[],
  lots: readonly GrowLot[],
  live: readonly LiveGroup[]
): { slices: PlantWeightSlice[]; mixed: string[] } {
  const lotsByPair = new Map<string, GrowLot[]>();
  for (const lot of lots) {
    const key = pairKey(lot.strain, lot.farm);
    const list = lotsByPair.get(key) ?? [];
    list.push(lot);
    lotsByPair.set(key, list);
  }
  const liveByPair = new Map<string, LiveGroup[]>();
  for (const group of live) {
    if (!group.strain.trim() || !(group.plants > 0)) continue;
    const key = pairKey(group.strain, group.farm);
    const list = liveByPair.get(key) ?? [];
    list.push(group);
    liveByPair.set(key, list);
  }
  const slices: PlantWeightSlice[] = [];
  const mixed: string[] = [];
  for (const row of rows) {
    if (row.total) continue;
    const key = pairKey(row.strain, row.farm);
    const mine = lotsByPair.get(key) ?? [];
    const standing = liveByPair.get(key) ?? [];
    const distinct = [...new Set(mine.map((lot) => lot.grow.trim()))];
    const shared = distinct.length === 1 ? (distinct[0] ?? "") : "";
    const mixes = distinct.length > 1;
    if (mixes) mixed.push(`${row.strain} at ${row.farm}`);
    const harvestedKeys = mixes ? distinct : mine.length > 0 ? [shared] : [];
    const plantWeight = new Map<string, number>();
    const poundWeight = new Map<string, number>();
    for (const lot of mine) {
      const grow = mixes ? lot.grow.trim() : shared;
      plantWeight.set(grow, (plantWeight.get(grow) ?? 0) + (lot.plantCount != null && lot.plantCount > 0 ? lot.plantCount : 0));
      const mass = lot.unloaded && lot.dryGrams != null ? lot.dryGrams : !lot.unloaded ? lot.wetGrams : 0;
      poundWeight.set(grow, (poundWeight.get(grow) ?? 0) + (mass > 0 ? mass : 0));
    }
    const harvestedPlants = allocate(row.plantsHarvested, harvestedKeys, (grow) => plantWeight.get(grow) ?? 0);
    const harvestedLb = allocate(row.harvestedDryLb, harvestedKeys, (grow) => {
      const mass = poundWeight.get(grow) ?? 0;
      return mass > 0 ? mass : (plantWeight.get(grow) ?? 0);
    });
    const liveWeight = new Map<string, number>();
    for (const group of standing) {
      const grow = group.grow.trim() || "OD";
      liveWeight.set(grow, (liveWeight.get(grow) ?? 0) + group.plants);
    }
    const liveKeys = [...liveWeight.keys()];
    const remainingKeys = row.plantsRemaining > 0 && liveKeys.length === 0 ? ["OD"] : liveKeys;
    const remainingPlants = allocate(row.plantsRemaining, remainingKeys, (grow) => liveWeight.get(grow) ?? 0);
    const remainingLb = allocate(row.remainingLb ?? 0, remainingKeys, (grow) => liveWeight.get(grow) ?? 0);
    const buckets = new Map<string, Bucket>();
    const bucket = (grow: string): Bucket => {
      const found = buckets.get(grow);
      if (found) return found;
      const made: Bucket = { grow, seasonLb: 0, plantsHarvested: 0, plantsRemaining: 0, estimateMissing: false };
      buckets.set(grow, made);
      return made;
    };
    for (const grow of harvestedKeys) {
      const item = bucket(grow);
      item.plantsHarvested += harvestedPlants.get(grow) ?? 0;
      item.seasonLb += harvestedLb.get(grow) ?? 0;
    }
    for (const grow of remainingKeys) {
      const item = bucket(grow);
      const plants = remainingPlants.get(grow) ?? 0;
      item.plantsRemaining += plants;
      item.seasonLb += remainingLb.get(grow) ?? 0;
      if (row.estimateMissing && plants > 0) item.estimateMissing = true;
    }
    for (const item of buckets.values()) {
      if (item.plantsHarvested === 0 && item.plantsRemaining === 0 && item.seasonLb === 0) continue;
      slices.push({
        strain: row.strain,
        farm: row.farm,
        grow: item.grow,
        seasonLb: item.seasonLb,
        plantsHarvested: item.plantsHarvested,
        plantsRemaining: item.plantsRemaining,
        estimateMissing: item.estimateMissing,
      });
    }
  }
  slices.sort((a, b) => (norm(a.strain) < norm(b.strain) ? -1 : norm(a.strain) > norm(b.strain) ? 1 : a.farm < b.farm ? -1 : a.farm > b.farm ? 1 : a.grow < b.grow ? -1 : a.grow > b.grow ? 1 : 0));
  return { slices, mixed };
}

const DRIED_LOTS_SQL = `SELECT w.id AS lot_id, b.farm_code AS farm,
       COALESCE(s.name, '') AS strain_name, COALESCE(b.market_strain, '') AS market_strain,
       COALESCE(b.grow_method_code, '') AS grow, w.plant_count AS plant_count,
       w.dry_weight_grams AS dry_grams, u.effective_date AS effective_date, u.finished_at AS finished_at
FROM wet_weight_entries w
JOIN harvest_batches b ON b.id = w.harvest_batch_id AND b.deleted_at IS NULL
LEFT JOIN strains s ON s.id = b.strain_id
LEFT JOIN unload_sessions u ON u.id = (
  SELECT u2.id FROM unload_sessions u2
  WHERE u2.wet_weight_entry_id = w.id AND u2.deleted_at IS NULL AND u2.finished_at IS NOT NULL
  ORDER BY u2.finished_at DESC, u2.id DESC LIMIT 1)
WHERE w.deleted_at IS NULL AND w.status <> 'weighing' AND w.plant_count >= 1 AND w.dry_weight_grams > 0
  AND b.harvest_year = ? AND ${ownLotSql("b")}`;

const SP_LOTS_SQL = `SELECT w.id AS lot_id, b.farm_code AS farm,
       COALESCE(s.name, '') AS strain_name, COALESCE(b.market_strain, '') AS market_strain,
       COALESCE(b.grow_method_code, '') AS grow, w.weight_grams AS wet_grams,
       CASE WHEN w.dry_weight_grams IS NOT NULL THEN w.dry_weight_grams
            ELSE (SELECT SUM(d.weight_grams) FROM dry_weights d
                  WHERE d.wet_weight_entry_id = w.id AND d.deleted_at IS NULL)
       END AS dry_grams,
       w.plant_count AS plant_count,
       CASE WHEN EXISTS (
         SELECT 1 FROM unload_sessions u
         WHERE u.wet_weight_entry_id = w.id AND u.deleted_at IS NULL AND u.finished_at IS NOT NULL
       ) THEN 1 ELSE 0 END AS unloaded
FROM wet_weight_entries w
JOIN harvest_batches b ON b.id = w.harvest_batch_id AND b.deleted_at IS NULL
LEFT JOIN strains s ON s.id = b.strain_id
WHERE w.deleted_at IS NULL AND w.status <> 'weighing' AND b.harvest_year = ? AND ${ownLotSql("b")}`;

const LIVE_SQL = `SELECT p.strain AS strain, MIN(lv.farm_code) AS farm,
       CASE WHEN TRIM(COALESCE(p.location, '')) LIKE 'GH%' THEN 'GH' ELSE 'OD' END AS grow,
       COUNT(*) AS plants
FROM metrc_plants p
JOIN lookup_values lv ON lv.category = 'license' AND lv.value = p.license_value AND lv.deleted_at IS NULL
WHERE p.gone_at IS NULL AND p.harvested = 0
  AND lv.farm_code IS NOT NULL AND lv.farm_code <> ''
GROUP BY p.license_value, p.strain, CASE WHEN TRIM(COALESCE(p.location, '')) LIKE 'GH%' THEN 'GH' ELSE 'OD' END`;

const ESTIMATE_SQL = `SELECT e.farm_code AS farm_code, e.effective_date AS effective_date,
       e.est_dry_weight AS est_dry_weight, COALESCE(s.name, '') AS strain_name
FROM field_estimates e
LEFT JOIN strains s ON s.id = e.strain_id
WHERE e.deleted_at IS NULL
  AND e.effective_date <= ?
  AND e.effective_date = (
    SELECT MAX(n.effective_date) FROM field_estimates n
    WHERE n.deleted_at IS NULL AND n.strain_id = e.strain_id AND n.farm_code = e.farm_code AND n.effective_date <= ?
  )`;

const GROW_SQL = `SELECT code, display_name FROM grow_methods WHERE deleted_at IS NULL ORDER BY code`;

/** The five reads the bizops wall adds to its one batch. */
export function plantWeightStatements(db: D1Database, year: number, day: string): D1PreparedStatement[] {
  return [
    db.prepare(DRIED_LOTS_SQL).bind(year),
    db.prepare(SP_LOTS_SQL).bind(year),
    db.prepare(LIVE_SQL),
    db.prepare(ESTIMATE_SQL).bind(day, day),
    db.prepare(GROW_SQL),
  ];
}

function resultRows(result: unknown): Record<string, unknown>[] {
  const rows = (result as { results?: unknown } | undefined)?.results;
  return Array.isArray(rows) ? (rows as Record<string, unknown>[]) : [];
}

function cell(row: Record<string, unknown>, key: string): string {
  return row[key] == null ? "" : String(row[key]);
}

function unloadDay(effective: string, finished: string): string {
  const typed = effective.trim();
  if (isCalendarDate(typed)) return typed;
  if (!finished.trim()) return "";
  const day = etDate(finished);
  return isCalendarDate(day) ? day : "";
}

function growRank(code: string): number {
  if (code === "OD") return 0;
  if (code === "GH") return 1;
  if (code === "ID") return 2;
  return 9;
}

/** Build the tile model from the five batch results, in statement order. */
export function plantWeightFromResults(results: readonly unknown[], today: string, year: number): PlantWeightModel {
  const day = isCalendarDate(today) ? today : "";
  const dried: PlantWeightLot[] = [];
  for (const row of resultRows(results[0])) {
    const plants = Number(row.plant_count ?? 0);
    const grams = Number(row.dry_grams ?? 0);
    if (!(plants >= 1) || !(grams > 0)) continue;
    const strain = strainPerformanceName(cell(row, "strain_name"), cell(row, "market_strain")) ?? "";
    if (!strain) continue;
    dried.push({
      id: cell(row, "lot_id"),
      day: unloadDay(cell(row, "effective_date"), cell(row, "finished_at")),
      farm: farmCode(cell(row, "farm")),
      strain,
      grow: cell(row, "grow").trim(),
      plants,
      grams,
    });
  }
  const growLots: GrowLot[] = [];
  const spLots = resultRows(results[1]).map((row) => {
    const strain = strainPerformanceName(cell(row, "strain_name"), cell(row, "market_strain")) ?? "";
    const farm = farmCode(cell(row, "farm"));
    const grow = cell(row, "grow").trim();
    const plantCount = row.plant_count == null ? null : Number(row.plant_count);
    const dryGrams = row.dry_grams == null ? null : Number(row.dry_grams);
    const wetGrams = Number(row.wet_grams ?? 0);
    const unloaded = Number(row.unloaded ?? 0) === 1;
    growLots.push({ strain, farm, grow, plantCount, dryGrams, wetGrams, unloaded });
    return {
      id: cell(row, "lot_id"),
      farm,
      strain: cell(row, "strain_name"),
      marketStrain: cell(row, "market_strain"),
      wetGrams,
      dryGrams,
      plantCount,
      unloaded,
    };
  });
  const live: LiveGroup[] = [];
  for (const row of resultRows(results[2])) {
    const plants = Number(row.plants ?? 0);
    const strain = cell(row, "strain").trim();
    const farm = farmCode(cell(row, "farm"));
    if (!strain || !farm || !(plants > 0)) continue;
    live.push({ strain, farm, grow: cell(row, "grow").trim() || "OD", plants });
  }
  const estimates = resultRows(results[3])
    .map((row) => ({
      strainName: cell(row, "strain_name").trim(),
      farm: farmCode(cell(row, "farm_code")),
      effectiveDate: cell(row, "effective_date"),
      dryLbPerPlant: Number(row.est_dry_weight ?? 0),
    }))
    .filter((row) => row.strainName !== "" && row.farm !== "");
  const labels = new Map<string, string>();
  for (const row of resultRows(results[4])) {
    const code = cell(row, "code").trim();
    if (code) labels.set(code, cell(row, "display_name").trim() || code);
  }
  const built = buildStrainPerformance({ day: day || "1970-01-01", year, lots: spLots, plants: live, estimates });
  const projected = plantWeightSlices(built.rows, growLots, live);
  const strains = new Set<string>();
  for (const lot of dried) strains.add(lot.strain);
  for (const slice of projected.slices) if (slice.plantsHarvested > 0) strains.add(slice.strain);
  const growCodes = new Set<string>();
  for (const lot of dried) if (lot.grow) growCodes.add(lot.grow);
  for (const slice of projected.slices) {
    if (slice.grow && (slice.plantsHarvested > 0 || slice.plantsRemaining > 0)) growCodes.add(slice.grow);
  }
  const grows = [...growCodes]
    .map((code) => ({ code, label: labels.get(code) || code }))
    .sort((a, b) => growRank(a.code) - growRank(b.code) || (a.label < b.label ? -1 : a.label > b.label ? 1 : 0));
  return {
    today: day,
    year,
    lots: dried,
    slices: projected.slices,
    strains: [...strains].sort((a, b) => (norm(a) < norm(b) ? -1 : norm(a) > norm(b) ? 1 : 0)),
    grows,
    mixed: projected.mixed,
  };
}

function groupInt(value: number): string {
  return Math.round(value).toLocaleString("en-US");
}

function lotsLine(lots: number, plants: number, locale: Locale): string {
  const n = groupInt(lots);
  const p = groupInt(plants);
  if (lots === 1 && plants === 1) return t(locale, "1 lot, 1 plant");
  if (lots === 1) return tFill(locale, "1 lot, {p} plants", { p });
  if (plants === 1) return tFill(locale, "{n} lots, 1 plant", { n });
  return tFill(locale, "{n} lots, {p} plants", { n, p });
}

function missingLine(n: number, locale: Locale): string {
  if (n === 1) return t(locale, "Field estimate missing for 1 strain");
  return tFill(locale, "Field estimate missing for {n} strains", { n: groupInt(n) });
}

function countPhrase(n: number, one: string, many: string, locale: Locale): string {
  return n === 1 ? t(locale, one) : tFill(locale, many, { n: groupInt(n) });
}

function fillNote(template: string, locale: Locale, vars: Record<string, string>): string {
  return tFill(locale, template, vars);
}

function shownLb(lb: number | null, locale: Locale): string {
  return lb == null ? t(locale, "No data") : format2(lb);
}

function safeJson(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

const PW_SCRIPT = `<script>
(function () {
  var root = document.currentScript && document.currentScript.parentElement;
  if (!root) return;
  var raw = root.querySelector("[data-dd-pw-json]");
  if (!raw) return;
  var data;
  try { data = JSON.parse(raw.textContent || ""); } catch (e) { return; }
  var period = root.querySelector("[data-dd-pw-period]");
  var strain = root.querySelector("[data-dd-pw-strain]");
  var farm = root.querySelector("[data-dd-pw-farm]");
  var grow = root.querySelector("[data-dd-pw-grow]");
  if (!period || !strain || !farm || !grow) return;
  var keys = {
    period: "dd.plant_weight.period",
    strain: "dd.plant_weight.strain",
    farm: "dd.plant_weight.farm",
    grow: "dd.plant_weight.grow"
  };
  function hasOption(select, value) {
    for (var i = 0; i < select.options.length; i++) if (select.options[i].value === value) return true;
    return false;
  }
  function group(n) {
    return String(Math.round(n)).replace(/\\B(?=(\\d{3})+(?!\\d))/g, ",");
  }
  function round2(n) {
    if (!isFinite(n)) return 0;
    var sign = n < 0 ? -1 : 1;
    return sign * Math.round(Math.abs(n) * 100) / 100;
  }
  function money(n) {
    var sign = n < 0 ? "-" : "";
    var fixed = Math.abs(round2(n)).toFixed(2);
    var parts = fixed.split(".");
    parts[0] = parts[0].replace(/\\B(?=(\\d{3})+(?!\\d))/g, ",");
    return sign + parts[0] + "." + parts[1];
  }
  function same(value, pick) {
    if (!pick) return true;
    return String(value || "").trim().toLowerCase() === String(pick).trim().toLowerCase();
  }
  function offset(day, n) {
    return new Date(Date.parse(day + "T00:00:00.000Z") + n * 86400000).toISOString().slice(0, 10);
  }
  function inPeriod(day, which, today) {
    if (!day || day > today) return false;
    if (which === "htd") return true;
    var span = which === "7" ? 7 : which === "30" ? 30 : 14;
    return day >= offset(today, 1 - span);
  }
  function lotsLine(lots, plants) {
    var copy = data.copy || {};
    var n = group(lots);
    var p = group(plants);
    var text = lots === 1 && plants === 1 ? copy.oneEach : lots === 1 ? copy.oneLot : plants === 1 ? copy.onePlant : copy.lotsPlants;
    return String(text || "").replace("{n}", n).replace("{p}", p);
  }
  function fill(template, vars) {
    var text = String(template || "");
    Object.keys(vars).forEach(function (key) { text = text.split("{" + key + "}").join(vars[key]); });
    return text;
  }
  function figures() {
    var today = data.today || "";
    var lots = [];
    var slices = [];
    (data.lots || []).forEach(function (lot) {
      if (!same(lot.strain, strain.value) || !same(lot.farm, farm.value) || !same(lot.grow, grow.value)) return;
      lots.push(lot);
    });
    (data.slices || []).forEach(function (row) {
      if (!same(row.strain, strain.value) || !same(row.farm, farm.value) || !same(row.grow, grow.value)) return;
      slices.push(row);
    });
    function box(rows) {
      var grams = 0;
      var plants = 0;
      rows.forEach(function (row) { grams += Number(row.grams) || 0; plants += Number(row.plants) || 0; });
      return { lb: plants > 0 ? round2((grams / plants) / 448) : null, lots: rows.length, plants: plants, grams: grams };
    }
    var periodRows = lots.filter(function (lot) { return inPeriod(lot.day, period.value, today); });
    var season = 0;
    var harvested = 0;
    var remaining = 0;
    var missing = {};
    var missingN = 0;
    slices.forEach(function (row) {
      season += Number(row.seasonLb) || 0;
      harvested += Number(row.plantsHarvested) || 0;
      remaining += Number(row.plantsRemaining) || 0;
      if (row.estimateMissing) {
        var name = String(row.strain || "").trim().toLowerCase();
        if (name && !missing[name]) { missing[name] = 1; missingN += 1; }
      }
    });
    var plants = harvested + remaining;
    return {
      period: box(periodRows),
      avg: box(lots),
      projected: { lb: plants > 0 ? round2(season / plants) : null, plantsHarvested: harvested, plantsRemaining: remaining, missing: missingN }
    };
  }
  function paint() {
    var fig = figures();
    var copy = data.copy || {};
    var none = copy.noData || "No data";
    function put(name, lb, sub, note) {
      var button = root.querySelector('[data-dd-pw-value="' + name + '"]');
      var line = root.querySelector('[data-dd-pw-sub="' + name + '"]');
      var tip = root.querySelector('[data-dd-pw-note="' + name + '"]');
      if (button) {
        button.textContent = lb == null ? none : money(lb);
        button.setAttribute("data-dd-pw-lb", lb == null ? "" : money(lb));
        button.setAttribute("title", note);
      }
      if (line) {
        line.textContent = sub;
        if (sub) line.removeAttribute("hidden");
        else line.setAttribute("hidden", "");
      }
      if (tip) tip.textContent = note;
    }
    var periodLots = lotsLine(fig.period.lots, fig.period.plants);
    var avgLots = lotsLine(fig.avg.lots, fig.avg.plants);
    put("period", fig.period.lb, fig.period.lb == null ? "" : periodLots, fill(copy.period, { lots: periodLots, grams: group(fig.period.grams) }));
    put("avg", fig.avg.lb, fig.avg.lb == null ? "" : avgLots, fill(copy.avg, { lots: avgLots, grams: group(fig.avg.grams) }));
    var harvestedWord = fig.projected.plantsHarvested === 1 ? copy.harvestedOne : fill(copy.harvested, { n: group(fig.projected.plantsHarvested) });
    var remainingWord = fig.projected.plantsRemaining === 1 ? copy.remainingOne : fill(copy.remaining, { n: group(fig.projected.plantsRemaining) });
    var projectedNote = String(copy.projected || "") + " " + harvestedWord + ", " + remainingWord + ".";
    put("projected", fig.projected.lb, "", projectedNote);
    var miss = root.querySelector("[data-dd-pw-miss]");
    if (miss) {
      if (fig.projected.missing > 0) {
        var word = fig.projected.missing === 1 ? copy.missingOne : copy.missing;
        miss.textContent = fill(word, { n: group(fig.projected.missing) });
        miss.removeAttribute("hidden");
      } else {
        miss.textContent = "";
        miss.setAttribute("hidden", "");
      }
    }
  }
  try {
    var savedPeriod = localStorage.getItem(keys.period);
    var savedStrain = localStorage.getItem(keys.strain);
    var savedFarm = localStorage.getItem(keys.farm);
    var savedGrow = localStorage.getItem(keys.grow);
    if (savedPeriod && hasOption(period, savedPeriod)) period.value = savedPeriod;
    if (savedStrain != null && hasOption(strain, savedStrain)) strain.value = savedStrain;
    if (savedFarm != null && hasOption(farm, savedFarm)) farm.value = savedFarm;
    if (savedGrow != null && hasOption(grow, savedGrow)) grow.value = savedGrow;
  } catch (e) {}
  function remember(select, key) {
    select.addEventListener("change", function () {
      try { localStorage.setItem(key, select.value); } catch (e) {}
      paint();
    });
  }
  remember(period, keys.period);
  remember(strain, keys.strain);
  remember(farm, keys.farm);
  remember(grow, keys.grow);
  var buttons = root.querySelectorAll("[data-dd-pw-value]");
  for (var i = 0; i < buttons.length; i++) {
    buttons[i].addEventListener("click", function () {
      var name = this.getAttribute("data-dd-pw-value");
      var note = root.querySelector('[data-dd-pw-note="' + name + '"]');
      if (!note) return;
      if (note.hasAttribute("hidden")) note.removeAttribute("hidden");
      else note.setAttribute("hidden", "");
    });
  }
  paint();
})();
</script>`;

function option(value: string, label: string, selected: boolean): string {
  return `<option value="${esc(value)}"${selected ? " selected" : ""}>${esc(label)}</option>`;
}

/** The four selects and three boxes. The default pick is 14 days and All, and the script applies the rest. */
export function plantWeightBody(model: PlantWeightModel, locale: Locale = "en"): string {
  const pick: PlantWeightPick = { period: "14", strain: "", farm: "", grow: "" };
  const fig = plantWeightFigures(model, pick);
  const noData = t(locale, "No data");
  const periodLots = lotsLine(fig.period.lots, fig.period.plants, locale);
  const avgLots = lotsLine(fig.avg.lots, fig.avg.plants, locale);
  const periodNote = fillNote(PERIOD_NOTE, locale, { lots: periodLots, grams: groupInt(fig.period.grams) });
  const avgNote = fillNote(AVG_NOTE, locale, { lots: avgLots, grams: groupInt(fig.avg.grams) });
  const projectedNote = `${fillNote(PROJECTED_NOTE, locale, {})} ${countPhrase(fig.projected.plantsHarvested, "1 plant harvested", "{n} plants harvested", locale)}, ${countPhrase(fig.projected.plantsRemaining, "1 plant remaining", "{n} plants remaining", locale)}.`;
  const periodOptions = (["7", "14", "30", "htd"] as const)
    .map((period) => option(period, t(locale, period === "htd" ? "HTD" : `${period} days`), period === "14"))
    .join("");
  const strainOptions = [option("", t(locale, "All"), true)]
    .concat(model.strains.map((name) => option(name, name, false)))
    .join("");
  const farmOptions = [option("", t(locale, "All"), true)]
    .concat(PLANT_WEIGHT_FARMS.map((farm) => option(farm, farm, false)))
    .join("");
  const growOptions = [option("", t(locale, "All"), true)]
    .concat(model.grows.map((grow) => option(grow.code, grow.label, false)))
    .join("");
  const box = (name: string, label: string, lb: number | null, sub: string, note: string, extra = ""): string => {
    const text = shownLb(lb, locale);
    const hidden = lb == null ? " hidden" : "";
    return `<div class="dd-pw-box">
        <span class="dd-pw-label">${esc(label)}</span>
        <button type="button" class="dd-pw-value" data-dd-pw-value="${name}" data-dd-pw-lb="${esc(lb == null ? "" : text)}" title="${esc(note)}">${esc(text)}</button>
        <p class="dd-pw-sub" data-dd-pw-sub="${name}"${hidden}>${esc(lb == null ? "" : sub)}</p>
        <p class="dd-pw-note" data-dd-pw-note="${name}" hidden>${esc(note)}</p>
        ${extra}
      </div>`;
  };
  const miss = fig.projected.missing > 0 ? missingLine(fig.projected.missing, locale) : "";
  const missHtml = `<p class="dd-pw-sub" data-dd-pw-miss${miss ? "" : " hidden"}>${esc(miss)}</p>`;
  const payload = {
    today: model.today,
    lots: model.lots.map((lot) => ({ day: lot.day, farm: lot.farm, strain: lot.strain, grow: lot.grow, plants: lot.plants, grams: lot.grams })),
    slices: model.slices.map((row) => ({
      strain: row.strain,
      farm: row.farm,
      grow: row.grow,
      seasonLb: row.seasonLb,
      plantsHarvested: row.plantsHarvested,
      plantsRemaining: row.plantsRemaining,
      estimateMissing: row.estimateMissing,
    })),
    copy: {
      noData,
      oneEach: t(locale, "1 lot, 1 plant"),
      oneLot: t(locale, "1 lot, {p} plants"),
      onePlant: t(locale, "{n} lots, 1 plant"),
      lotsPlants: t(locale, "{n} lots, {p} plants"),
      missingOne: t(locale, "Field estimate missing for 1 strain"),
      missing: t(locale, "Field estimate missing for {n} strains"),
      period: t(locale, PERIOD_NOTE),
      avg: t(locale, AVG_NOTE),
      projected: t(locale, PROJECTED_NOTE),
      harvestedOne: t(locale, "1 plant harvested"),
      harvested: t(locale, "{n} plants harvested"),
      remainingOne: t(locale, "1 plant remaining"),
      remaining: t(locale, "{n} plants remaining"),
    },
  };
  return `<div class="dd-pw" data-dd-pw data-dd-pw-today="${esc(model.today)}">
      <div class="dd-pw-picks">
        <label>${esc(t(locale, "Period"))}
          <select data-dd-pw-period aria-label="${esc(t(locale, "Period"))}">${periodOptions}</select>
        </label>
        <label>${esc(t(locale, "Strain"))}
          <select data-dd-pw-strain aria-label="${esc(t(locale, "Strain"))}">${strainOptions}</select>
        </label>
        <label>${esc(t(locale, "Farm"))}
          <select data-dd-pw-farm aria-label="${esc(t(locale, "Farm"))}">${farmOptions}</select>
        </label>
        <label>${esc(t(locale, "Grow Method"))}
          <select data-dd-pw-grow aria-label="${esc(t(locale, "Grow Method"))}">${growOptions}</select>
        </label>
      </div>
      <div class="dd-pw-boxes">
        ${box("period", t(locale, "Lbs/Plant"), fig.period.lb, periodLots, periodNote)}
        ${box("avg", t(locale, "AVG Lbs/Plant"), fig.avg.lb, avgLots, avgNote)}
        ${box("projected", t(locale, "Projected Lbs/Plant"), fig.projected.lb, "", projectedNote, missHtml)}
      </div>
      <script type="application/json" data-dd-pw-json>${safeJson(payload)}</script>
      ${PW_SCRIPT}
    </div>`;
}
