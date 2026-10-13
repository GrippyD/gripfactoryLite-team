/**
 * SP1: Strain performance on the Harvest Console.
 * One row per strain and farm. The strain is the market strain when one is
 * typed, otherwise the real strain (the same rule as a blank market strain
 * inheriting the strain's own name). Harvested lots are Grip's own finished
 * lots of the year (status not weighing, tests out). Plants remaining are
 * live METRC plants. Field estimates are dry pounds per plant.
 */
import { format2, GRAMS_PER_LB, inheritMarketStrain, round2 } from "./config";
import { estimatesAsOf } from "./fieldestimates";
import { t, tFill, type Locale } from "./i18n";
import { esc } from "./ui";

/** The year's finished lots. One read, then the grain is pooled in code. */
export const STRAIN_PERFORMANCE_LOTS_SQL = `SELECT b.farm_code AS farm,
       COALESCE(s.name, '') AS strain_name,
       COALESCE(b.market_strain, '') AS market_strain,
       w.weight_grams AS wet_grams,
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
WHERE w.deleted_at IS NULL AND w.status <> 'weighing' AND b.harvest_year = ? AND b.is_test = 0`;

/** The one grouped read of live plants still in the ground. */
export const STRAIN_PERFORMANCE_PLANTS_SQL = `SELECT p.license_value AS license_value,
       p.strain AS strain,
       MIN(lv.farm_code) AS farm,
       COUNT(*) AS plants
FROM metrc_plants p
JOIN lookup_values lv
  ON lv.category = 'license' AND lv.value = p.license_value AND lv.deleted_at IS NULL
WHERE p.gone_at IS NULL AND p.harvested = 0
  AND lv.farm_code IS NOT NULL AND lv.farm_code <> ''
GROUP BY p.license_value, p.strain`;

export const STRAIN_PERFORMANCE_METHOD =
  "Drying lb forecast is the wet pounds of lots not yet unloaded times the dry-down of that strain and farm, pooled by weight, else that strain across farms, else the season.";

export type ForecastSource = "strain_farm" | "strain" | "season" | "none";

/** A finished lot of the harvest year, already past weighing, not a test. */
export type StrainPerformanceLot = {
  farm: string;
  /** The real strain name. */
  strain: string;
  /** The market strain as typed. Blank when none was typed. */
  marketStrain: string;
  wetGrams: number;
  /** Null when the lot has no dry weight. Zero is a stored zero. */
  dryGrams: number | null;
  /** Null when no plant count was typed. */
  plantCount: number | null;
  /** A finished unload session stands. */
  unloaded: boolean;
};

/** Live plants under one license, already grouped. */
export type StrainPerformancePlants = {
  farm: string;
  strain: string;
  plants: number;
};

/** A field estimate. A date after the console day is not in force. */
export type StrainPerformanceEstimate = {
  strainName: string;
  farm: string;
  effectiveDate: string;
  /** Dry pounds per plant, stored as typed. */
  dryLbPerPlant: number;
};

export type StrainPerformanceRow = {
  strain: string;
  farm: string;
  total: boolean;
  lots: number;
  plantsHarvested: number;
  wetLb: number;
  dryLb: number;
  /** Null when wet is still drying and no dry-down rate exists. */
  forecastLb: number | null;
  forecastGrams: number | null;
  forecastSource: ForecastSource;
  harvestedDryLb: number;
  /** Blank when no unloaded lot carries a plant count. Two decimals otherwise. */
  dryLbPerPlant: string;
  plantsRemaining: number;
  /** Blank when no estimate is in force. Two decimals otherwise. */
  estimatePerPlant: string;
  estimateDate: string;
  /** True when plants remain and no estimate is in force. */
  estimateMissing: boolean;
  /** Null when plants remain and no estimate is in force. */
  remainingLb: number | null;
  seasonLb: number;
};

export type StrainPerformanceModel = {
  rows: StrainPerformanceRow[];
  missingStrains: number;
  missingPlants: number;
};

type Pool = { wet: number; dry: number };

/** The market strain when one is typed, otherwise the real strain. */
export function strainPerformanceName(real: string | null | undefined, market: string | null | undefined): string {
  return inheritMarketStrain(market, real) ?? "";
}

function norm(value: string | null | undefined): string {
  return String(value ?? "").trim().toLowerCase();
}

function cmp(a: string, b: string): number {
  const left = a.toLowerCase();
  const right = b.toLowerCase();
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

/** Whole pounds at 448 g, round half up. */
export function wholePoundsFromGrams(grams: number): number {
  if (!Number.isFinite(grams)) return 0;
  const sign = grams < 0 ? -1 : 1;
  return sign * Math.round(Math.abs(grams) / GRAMS_PER_LB);
}

/** Whole pounds from a pound figure, round half up. */
export function wholePounds(pounds: number): number {
  if (!Number.isFinite(pounds)) return 0;
  const sign = pounds < 0 ? -1 : 1;
  return sign * Math.round(Math.abs(pounds));
}

/** Thousands commas, no decimals. */
export function formatWhole(value: number): string {
  const n = wholePounds(value);
  const text = String(Math.abs(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return n < 0 ? `-${text}` : text;
}

function rateOf(pool: Pool | undefined): number | null {
  if (!pool || !(pool.wet > 0)) return null;
  return pool.dry / pool.wet;
}

function addPool(map: Map<string, Pool>, key: string, wet: number, dry: number): void {
  const pool = map.get(key) ?? { wet: 0, dry: 0 };
  pool.wet += wet;
  pool.dry += dry;
  map.set(key, pool);
}

/** The estimate in force on the day: the latest effective date on or before it. A later date waits. */
export function estimateInForce(
  estimates: readonly StrainPerformanceEstimate[],
  strain: string,
  farm: string,
  day: string
): StrainPerformanceEstimate | null {
  const strainKey = norm(strain);
  const farmKey = norm(farm);
  let best: StrainPerformanceEstimate | null = null;
  for (const estimate of estimates) {
    if (norm(estimate.strainName) !== strainKey || norm(estimate.farm) !== farmKey) continue;
    if (estimate.effectiveDate > day) continue;
    if (!best || estimate.effectiveDate > best.effectiveDate) best = estimate;
  }
  return best;
}

type Acc = {
  strain: string;
  farm: string;
  fromLot: boolean;
  lots: StrainPerformanceLot[];
  plants: number;
};

/**
 * The grain, the forecast, and the totals.
 * Dry lb per plant uses the unloaded lots that carry a plant count: their dry
 * pounds over those plants. A lot unloaded with dry weight and no count stays
 * in Dry lb and out of the per-plant figure.
 */
export function buildStrainPerformance(input: {
  lots: readonly StrainPerformanceLot[];
  plants: readonly StrainPerformancePlants[];
  estimates: readonly StrainPerformanceEstimate[];
  day: string;
}): StrainPerformanceModel {
  const rows = new Map<string, Acc>();
  const touch = (name: string, farm: string, fromLot: boolean): Acc => {
    const farmCode = farm.trim().toUpperCase();
    const key = `${norm(name)}\n${norm(farmCode)}`;
    let row = rows.get(key);
    if (!row) {
      row = { strain: name.trim(), farm: farmCode, fromLot, lots: [], plants: 0 };
      rows.set(key, row);
    } else if (fromLot && !row.fromLot) {
      row.strain = name.trim();
      row.fromLot = true;
    }
    return row;
  };

  const farmPools = new Map<string, Pool>();
  const strainPools = new Map<string, Pool>();
  const season: Pool = { wet: 0, dry: 0 };
  for (const lot of input.lots) {
    const name = strainPerformanceName(lot.strain, lot.marketStrain);
    const row = touch(name, lot.farm, true);
    row.lots.push(lot);
    if (!lot.unloaded || lot.dryGrams == null || !(lot.wetGrams > 0)) continue;
    const farmKey = `${norm(name)}\n${norm(row.farm)}`;
    addPool(farmPools, farmKey, lot.wetGrams, lot.dryGrams);
    addPool(strainPools, norm(name), lot.wetGrams, lot.dryGrams);
    season.wet += lot.wetGrams;
    season.dry += lot.dryGrams;
  }
  for (const group of input.plants) {
    const strain = group.strain.trim();
    const farm = group.farm.trim();
    if (!strain || !farm || !(group.plants > 0)) continue;
    const row = touch(strain, farm, false);
    row.plants += group.plants;
  }

  let perPlantDry = 0;
  let perPlantCount = 0;
  for (const lot of input.lots) {
    if (!lot.unloaded || lot.plantCount == null || !(lot.plantCount > 0)) continue;
    perPlantDry += lot.dryGrams ?? 0;
    perPlantCount += lot.plantCount;
  }

  const built: StrainPerformanceRow[] = [...rows.values()]
    .sort((a, b) => cmp(a.strain, b.strain) || cmp(a.farm, b.farm))
    .map((row) => {
      let wetGrams = 0;
      let dryGrams = 0;
      let dryingWet = 0;
      let plantsHarvested = 0;
      let countedDry = 0;
      let countedPlants = 0;
      for (const lot of row.lots) {
        wetGrams += lot.wetGrams;
        if (lot.plantCount != null) plantsHarvested += lot.plantCount;
        if (lot.unloaded && lot.dryGrams != null) dryGrams += lot.dryGrams;
        if (!lot.unloaded) dryingWet += lot.wetGrams;
        if (lot.unloaded && lot.plantCount != null && lot.plantCount > 0) {
          countedDry += lot.dryGrams ?? 0;
          countedPlants += lot.plantCount;
        }
      }
      const farmKey = `${norm(row.strain)}\n${norm(row.farm)}`;
      const own = rateOf(farmPools.get(farmKey));
      const strainRate = rateOf(strainPools.get(norm(row.strain)));
      const seasonRate = rateOf(season);
      let source: ForecastSource = "none";
      let rate: number | null = null;
      if (own != null) {
        rate = own;
        source = "strain_farm";
      } else if (strainRate != null) {
        rate = strainRate;
        source = "strain";
      } else if (seasonRate != null) {
        rate = seasonRate;
        source = "season";
      }
      let forecastGrams: number | null = 0;
      if (dryingWet > 0) {
        forecastGrams = rate == null ? null : dryingWet * rate;
        if (rate == null) source = "none";
      } else {
        source = "none";
      }
      const estimate = estimateInForce(input.estimates, row.strain, row.farm, input.day);
      const estimateMissing = row.plants > 0 && estimate == null;
      const dryLb = wholePoundsFromGrams(dryGrams);
      const forecastLb = forecastGrams == null ? null : wholePoundsFromGrams(forecastGrams);
      const harvestedDryLb = dryLb + (forecastLb ?? 0);
      const remainingLb = estimateMissing ? null : wholePounds(row.plants * (estimate?.dryLbPerPlant ?? 0));
      return {
        strain: row.strain,
        farm: row.farm,
        total: false,
        lots: row.lots.length,
        plantsHarvested,
        wetLb: wholePoundsFromGrams(wetGrams),
        dryLb,
        forecastLb,
        forecastGrams,
        forecastSource: source,
        harvestedDryLb,
        dryLbPerPlant: countedPlants > 0 ? format2(round2(countedDry / GRAMS_PER_LB / countedPlants)) : "",
        plantsRemaining: row.plants,
        estimatePerPlant: estimate ? format2(round2(estimate.dryLbPerPlant)) : "",
        estimateDate: estimate?.effectiveDate ?? "",
        estimateMissing,
        remainingLb,
        seasonLb: harvestedDryLb + (remainingLb ?? 0),
      };
    });

  const missing = built.filter((row) => row.estimateMissing);
  if (built.length > 0) {
    const sum = (pick: (row: StrainPerformanceRow) => number) => built.reduce((n, row) => n + pick(row), 0);
    const forecasts = built.map((row) => row.forecastLb);
    const remainings = built.map((row) => row.remainingLb).filter((value): value is number => value != null);
    const forecastLb = forecasts.every((value) => value == null) ? null : sum((row) => row.forecastLb ?? 0);
    const remainingLb = remainings.length > 0 ? remainings.reduce((n, value) => n + value, 0) : built.some((row) => row.plantsRemaining > 0) ? null : 0;
    const harvestedDryLb = sum((row) => row.harvestedDryLb);
    built.push({
      strain: "Total",
      farm: "",
      total: true,
      lots: sum((row) => row.lots),
      plantsHarvested: sum((row) => row.plantsHarvested),
      wetLb: sum((row) => row.wetLb),
      dryLb: sum((row) => row.dryLb),
      forecastLb,
      forecastGrams: null,
      forecastSource: "none",
      harvestedDryLb,
      dryLbPerPlant: perPlantCount > 0 ? format2(round2(perPlantDry / GRAMS_PER_LB / perPlantCount)) : "",
      plantsRemaining: sum((row) => row.plantsRemaining),
      estimatePerPlant: "",
      estimateDate: "",
      estimateMissing: false,
      remainingLb,
      seasonLb: harvestedDryLb + (remainingLb ?? 0),
    });
  }

  return {
    rows: built,
    missingStrains: missing.length,
    missingPlants: missing.reduce((n, row) => n + row.plantsRemaining, 0),
  };
}

export function emptyStrainPerformance(): StrainPerformanceModel {
  return { rows: [], missingStrains: 0, missingPlants: 0 };
}

function missingLineKey(strains: number, plants: number): string {
  const strainWord = strains === 1 ? "strain" : "strains";
  const plantWord = plants === 1 ? "plant" : "plants";
  return `{n} ${strainWord} with plants and no estimate: {p} ${plantWord}`;
}

type LotSql = {
  farm: string | null;
  strain_name: string | null;
  market_strain: string | null;
  wet_grams: number | null;
  dry_grams: number | null;
  plant_count: number | null;
  unloaded: number | null;
};

type PlantSql = {
  license_value: string | null;
  strain: string | null;
  farm: string | null;
  plants: number | null;
};

/** The section's reads: the year's lots, one grouped plant count, the estimates in force, the strain names. */
export async function loadStrainPerformance(db: D1Database, year: number, day: string): Promise<StrainPerformanceModel> {
  const [lotRows, plantRows, estimates, strainRows] = await Promise.all([
    db.prepare(STRAIN_PERFORMANCE_LOTS_SQL).bind(year).all<LotSql>(),
    db.prepare(STRAIN_PERFORMANCE_PLANTS_SQL).all<PlantSql>(),
    estimatesAsOf(db, day),
    db.prepare(`SELECT id, name FROM strains`).all<{ id: string; name: string | null }>(),
  ]);
  const strainName = new Map<string, string>();
  for (const row of strainRows.results ?? []) strainName.set(String(row.id), String(row.name ?? "").trim());
  return buildStrainPerformance({
    day,
    lots: (lotRows.results ?? []).map((row) => ({
      farm: String(row.farm ?? ""),
      strain: String(row.strain_name ?? ""),
      marketStrain: String(row.market_strain ?? ""),
      wetGrams: Number(row.wet_grams ?? 0),
      dryGrams: row.dry_grams == null ? null : Number(row.dry_grams),
      plantCount: row.plant_count == null ? null : Number(row.plant_count),
      unloaded: Number(row.unloaded ?? 0) === 1,
    })),
    plants: (plantRows.results ?? []).map((row) => ({
      farm: String(row.farm ?? ""),
      strain: String(row.strain ?? ""),
      plants: Number(row.plants ?? 0),
    })),
    estimates: estimates
      .map((row) => ({
        strainName: strainName.get(row.strain_id) ?? "",
        farm: row.farm_code,
        effectiveDate: row.effective_date,
        dryLbPerPlant: row.est_dry_weight,
      }))
      .filter((row) => row.strainName !== ""),
  });
}

function cells(row: StrainPerformanceRow, locale: Locale): string {
  const estimate = row.total ? "" : row.estimateMissing ? t(locale, "no estimate") : row.estimatePerPlant;
  const values: Array<[string, string]> = [
    ["lots", formatWhole(row.lots)],
    ["plants_harvested", formatWhole(row.plantsHarvested)],
    ["wet", formatWhole(row.wetLb)],
    ["dry", formatWhole(row.dryLb)],
    ["forecast", row.forecastLb == null ? "" : formatWhole(row.forecastLb)],
    ["harvested_dry", formatWhole(row.harvestedDryLb)],
    ["dry_per_plant", row.dryLbPerPlant],
    ["plants_remaining", formatWhole(row.plantsRemaining)],
    ["estimate", estimate],
    ["estimate_date", row.estimateDate],
    ["remaining", row.remainingLb == null ? "" : formatWhole(row.remainingLb)],
    ["season", formatWhole(row.seasonLb)],
  ];
  return values.map(([name, text]) => `<td data-sp="${name}">${esc(text)}</td>`).join("");
}

/** The Harvest Console section. Closed by default. The table scrolls inside the section. */
export function strainPerformanceSection(model: StrainPerformanceModel, year: number, locale: Locale = "en"): string {
  const head = `<tr>
        <th rowspan="2">${esc(t(locale, "Strain"))}</th>
        <th rowspan="2">${esc(t(locale, "Farm"))}</th>
        <th colspan="7">${esc(t(locale, "Harvested"))}</th>
        <th colspan="4">${esc(t(locale, "Unharvested"))}</th>
        <th rowspan="2">${esc(t(locale, "Season dry lb"))}</th>
      </tr>
      <tr>
        <th>${esc(t(locale, "Lots"))}</th>
        <th>${esc(t(locale, "Plants harvested"))}</th>
        <th>${esc(t(locale, "Wet lb"))}</th>
        <th>${esc(t(locale, "Dry lb"))}</th>
        <th>${esc(t(locale, "Drying lb forecast"))}</th>
        <th>${esc(t(locale, "Harvested dry lb"))}</th>
        <th>${esc(t(locale, "Dry lb per plant"))}</th>
        <th>${esc(t(locale, "Plants remaining"))}</th>
        <th>${esc(t(locale, "Est. dry lb per plant"))}</th>
        <th>${esc(t(locale, "Est. date"))}</th>
        <th>${esc(t(locale, "Remaining dry lb"))}</th>
      </tr>`;
  const body =
    model.rows.length === 0
      ? `<tr data-sp-empty="1"><td colspan="14">${esc(t(locale, "No strains this harvest year."))}</td></tr>`
      : model.rows
          .map((row) => {
            const strain = row.total ? t(locale, "Total") : row.strain;
            return `<tr data-sp-strain="${esc(row.total ? "Total" : row.strain)}" data-sp-farm="${esc(row.farm)}"${row.total ? ' data-sp-total="1"' : ""}>
        <td>${esc(strain)}</td>
        <td>${esc(row.farm)}</td>
        ${cells(row, locale)}
      </tr>`;
          })
          .join("\n");
  const missing =
    model.missingStrains > 0
      ? `<p class="muted hc-note" data-sp-missing>${esc(
          tFill(locale, missingLineKey(model.missingStrains, model.missingPlants), {
            n: formatWhole(model.missingStrains),
            p: formatWhole(model.missingPlants),
          })
        )}</p>`
      : "";
  return `<details class="hc-section" data-hc-section="strain_performance">
      <summary>${esc(t(locale, "Strain performance"))} <span class="muted hc-year">${esc(t(locale, "Harvest year"))} ${esc(String(year))}</span></summary>
      <div class="report-scroll" data-sp-scroll>
        <table class="data" data-sp-table>
          <thead>${head}</thead>
          <tbody>
          ${body}
          </tbody>
        </table>
      </div>
      <p class="muted hc-note" data-sp-method>${esc(t(locale, STRAIN_PERFORMANCE_METHOD))}</p>
      ${missing}
    </details>`;
}
