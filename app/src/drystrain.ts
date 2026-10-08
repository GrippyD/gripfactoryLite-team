/**
 * DRY WEIGHT BY STRAIN (canon 0.30.427). The owner, 2026-10-08: "New Report:
 * Dry Weight by Strain: 1. Date Range field 2. Strain=(blank = all) 3. Grow
 * Method=(combobox(indoor,outdoor,greenhouse, blank (all))) 4. Farm=(bombox
 * (PNN,PNS,ARL,Blan(all))". His picks: the range is on the unload date; the
 * strain is both names, the real strain from Lookups and the market strain on
 * the lot. Read only.
 *
 * A lot counts on its unload date: the newest finished unload session's
 * Effective Date when one was typed, else the Eastern calendar date of that
 * session's finish. A lot never unloaded (a lot that froze, say) is not here.
 */

import { formatLbs } from "./compliance";
import { formatGrams, GRAMS_PER_LB } from "./config";
import { dayBefore, etDate, isCalendarDate } from "./farmday";
import { t, tFill, type Locale } from "./i18n";
import { formatLotToken } from "./mint";
import type { ReportColumn, ReportView } from "./reports";

export const DRY_STRAIN_KEY = "dry_weight_by_strain";
export const DRY_STRAIN_MAX_DAYS = 366;
export const DRY_STRAIN_DEFAULT_DAYS = 30;
export const DRY_STRAIN_NOT_A_DATE = "That is not a date.";
export const DRY_STRAIN_TO_BEFORE_FROM = "To is before From.";
export const DRY_STRAIN_TOO_LONG = "Pick 366 days or fewer.";
export const DRY_STRAIN_EMPTY = "No lot was unloaded in that range.";

/** The grow methods the form offers, by the code the batch stores. */
export const DRY_STRAIN_GROW_METHODS: readonly { code: string; label: string }[] = [
  { code: "ID", label: "Indoor" },
  { code: "OD", label: "Outdoor" },
  { code: "GH", label: "Greenhouse" },
];

export const DRY_STRAIN_FARMS: readonly string[] = ["PNN", "PNS", "ARL"];

export type DryStrainFilter = {
  from: string;
  to: string;
  strain: string;
  growMethod: string;
  farm: string;
};

export type DryStrainRange = { ok: true; from: string; to: string } | { ok: false; message: string };

/** From and To as typed; blank From is DRY_STRAIN_DEFAULT_DAYS before today, blank To is today. */
export function resolveDryStrainRange(from: string | null, to: string | null, today: string): DryStrainRange {
  let fromDay = (from ?? "").trim();
  let toDay = (to ?? "").trim();
  if (!toDay) toDay = today;
  if (!fromDay) {
    fromDay = toDay;
    for (let i = 0; i < DRY_STRAIN_DEFAULT_DAYS; i++) fromDay = dayBefore(fromDay);
  }
  if (!isCalendarDate(fromDay) || !isCalendarDate(toDay)) return { ok: false, message: DRY_STRAIN_NOT_A_DATE };
  if (toDay < fromDay) return { ok: false, message: DRY_STRAIN_TO_BEFORE_FROM };
  const days = Math.round((Date.parse(`${toDay}T00:00:00.000Z`) - Date.parse(`${fromDay}T00:00:00.000Z`)) / 86_400_000) + 1;
  if (days > DRY_STRAIN_MAX_DAYS) return { ok: false, message: DRY_STRAIN_TOO_LONG };
  return { ok: true, from: fromDay, to: toDay };
}

/** One live lot with a finished unload, as the query hands it. */
export type DryStrainLot = {
  lotId: string;
  harvestYear: number;
  lotSerial: number;
  farm: string;
  growMethod: string;
  strain: string;
  marketStrain: string;
  wetGrams: number;
  dryGrams: number;
  plantCount: number | null;
  /** The newest finished unload session's Effective Date, when typed. */
  effectiveDate: string | null;
  /** That session's finish instant. */
  finishedAt: string;
};

/** The day a lot counts on: the typed Effective Date, else the Eastern date of the finish. */
export function unloadDateOf(lot: Pick<DryStrainLot, "effectiveDate" | "finishedAt">): string {
  const typed = (lot.effectiveDate ?? "").trim();
  if (typed && isCalendarDate(typed)) return typed;
  return etDate(lot.finishedAt);
}

function norm(value: string | null | undefined): string {
  return String(value ?? "").trim().toLowerCase();
}

/** The lots the filter keeps: the unload date in the range, the strain by either name, the grow method and the farm. */
export function filterDryStrainLots(lots: readonly DryStrainLot[], filter: DryStrainFilter): DryStrainLot[] {
  const strain = norm(filter.strain);
  const method = norm(filter.growMethod);
  const farm = norm(filter.farm);
  return lots.filter((lot) => {
    const day = unloadDateOf(lot);
    if (day < filter.from || day > filter.to) return false;
    if (strain && norm(lot.strain) !== strain && norm(lot.marketStrain) !== strain) return false;
    if (method && norm(lot.growMethod) !== method) return false;
    if (farm && norm(lot.farm) !== farm) return false;
    return true;
  });
}

export const DRY_STRAIN_COLUMNS: ReportColumn[] = [
  { key: "strain", label: "Strain" },
  { key: "market_strain", label: "Market strain" },
  { key: "lots", label: "Lots" },
  { key: "wet_lbs", label: "Wet lb", lbs: true },
  { key: "dry_lbs", label: "Dry lb", lbs: true },
  { key: "dry_pct", label: "Dry/Wet %" },
  { key: "plants", label: "Plants" },
  { key: "dry_per_plant", label: "Dry lb/plant" },
  { key: "lot_ids", label: "Lot numbers" },
];

type Group = {
  strain: string;
  market: string;
  lots: DryStrainLot[];
};

function pct(dry: number, wet: number): string {
  if (!(wet > 0)) return "";
  return ((dry / wet) * 100).toFixed(1);
}

function perPlant(lots: readonly DryStrainLot[]): { plants: number; text: string } {
  let plants = 0;
  let dry = 0;
  for (const lot of lots) {
    if (lot.plantCount != null && lot.plantCount > 0) {
      plants += lot.plantCount;
      dry += lot.dryGrams;
    }
  }
  if (plants === 0) return { plants: 0, text: "" };
  return { plants, text: (dry / GRAMS_PER_LB / plants).toFixed(2) };
}

function lotToken(lot: DryStrainLot): string {
  try {
    return formatLotToken(lot.harvestYear, lot.lotSerial);
  } catch {
    return "";
  }
}

/** The rows: one per real strain and market strain pair, dry weight first, then a Total row. */
export function dryStrainView(lots: readonly DryStrainLot[], filter: DryStrainFilter, locale: Locale = "en"): ReportView {
  const kept = filterDryStrainLots(lots, filter);
  const groups = new Map<string, Group>();
  for (const lot of kept) {
    const strain = lot.strain.trim();
    const marketRaw = lot.marketStrain.trim();
    const market = marketRaw && norm(marketRaw) !== norm(strain) ? marketRaw : "";
    const key = `${norm(strain)}\n${norm(market)}`;
    const group = groups.get(key) ?? { strain, market, lots: [] };
    group.lots.push(lot);
    groups.set(key, group);
  }
  const sum = (list: readonly DryStrainLot[], pick: (lot: DryStrainLot) => number) => list.reduce((acc, lot) => acc + pick(lot), 0);
  const rowOf = (strain: string, market: string, list: readonly DryStrainLot[], total: boolean): ReportView["rows"][number] => {
    const wet = sum(list, (lot) => lot.wetGrams);
    const dry = sum(list, (lot) => lot.dryGrams);
    const plants = perPlant(list);
    const ids = [...list]
      .map(lotToken)
      .filter(Boolean)
      .sort()
      .join(" ");
    const row: ReportView["rows"][number] = {
      strain,
      market_strain: market,
      lots: list.length,
      wet_lbs: wet,
      dry_lbs: dry,
      dry_pct: pct(dry, wet),
      plants: plants.plants === 0 ? "" : plants.plants,
      dry_per_plant: plants.text,
      lot_ids: total ? "" : ids,
    };
    // The lot numbers fold under each strain row; the Total row carries none
    // (every lot is already under its strain).
    if (total) row._total = "1";
    else row._fold = tFill(locale, list.length === 1 ? "{n} lot, {g} g dry" : "{n} lots, {g} g dry", { n: String(list.length), g: formatGrams(Math.round(dry)) });
    return row;
  };
  const rows: ReportView["rows"] = [...groups.values()]
    .sort((a, b) => sum(b.lots, (lot) => lot.dryGrams) - sum(a.lots, (lot) => lot.dryGrams) || a.strain.localeCompare(b.strain))
    .map((group) => rowOf(group.strain, group.market, group.lots, false));
  if (kept.length > 0) rows.push(rowOf(t(locale, "Total"), "", kept, true));
  const parts = [tFill(locale, "Unloaded {from} to {to}", { from: filter.from, to: filter.to })];
  if (filter.strain.trim()) parts.push(tFill(locale, "strain {name}", { name: filter.strain.trim() }));
  const method = DRY_STRAIN_GROW_METHODS.find((m) => norm(m.code) === norm(filter.growMethod));
  if (method) parts.push(t(locale, method.label));
  if (filter.farm.trim()) parts.push(filter.farm.trim().toUpperCase());
  return {
    key: DRY_STRAIN_KEY,
    title: "Dry Weight by Strain",
    columns: DRY_STRAIN_COLUMNS,
    rows,
    heading: parts.join(" · "),
    empty: t(locale, DRY_STRAIN_EMPTY),
    footnote: t(locale, "Pounds at 448 g. Dry lb/plant counts only the lots with a plant count. A lot never unloaded is not here."),
  };
}

/** A refused range: the words, no rows. */
export function dryStrainRefused(message: string, locale: Locale = "en"): ReportView {
  return {
    key: DRY_STRAIN_KEY,
    title: "Dry Weight by Strain",
    columns: DRY_STRAIN_COLUMNS,
    rows: [],
    empty: t(locale, message),
    heading: t(locale, message),
  };
}

/** A pound figure for a hover: the grams beside it. */
export function dryStrainHover(grams: number): string {
  return `${formatLbs(grams)} lb · ${formatGrams(Math.round(grams))} g`;
}

type LotSql = {
  lot_id: string;
  harvest_year: number;
  lot_serial: number;
  farm_code: string;
  grow_method_code: string | null;
  strain_name: string | null;
  market_strain: string | null;
  wet_grams: number | null;
  dry_grams: number | null;
  plant_count: number | null;
  effective_date: string | null;
  finished_at: string;
};

/** Every live lot (entry and batch live, not a test HBN) with a finished unload, with that unload's dates. */
export async function listDryStrainLots(db: D1Database): Promise<DryStrainLot[]> {
  const got = await db
    .prepare(
      `SELECT w.id AS lot_id, b.harvest_year, b.lot_serial, b.farm_code, b.grow_method_code,
              s.name AS strain_name, b.market_strain,
              w.weight_grams AS wet_grams,
              COALESCE(w.dry_weight_grams,
                (SELECT SUM(d.weight_grams) FROM dry_weights d WHERE d.wet_weight_entry_id = w.id AND d.deleted_at IS NULL), 0) AS dry_grams,
              w.plant_count,
              u.effective_date, u.finished_at
       FROM wet_weight_entries w
       JOIN harvest_batches b ON b.id = w.harvest_batch_id AND b.deleted_at IS NULL AND COALESCE(b.is_test, 0) = 0
       LEFT JOIN strains s ON s.id = b.strain_id
       JOIN unload_sessions u ON u.id = (
         SELECT u2.id FROM unload_sessions u2
         WHERE u2.wet_weight_entry_id = w.id AND u2.deleted_at IS NULL AND u2.finished_at IS NOT NULL
         ORDER BY u2.finished_at DESC, u2.id DESC LIMIT 1)
       WHERE w.deleted_at IS NULL`
    )
    .all<LotSql>();
  return (got.results ?? []).map((row) => ({
    lotId: row.lot_id,
    harvestYear: Number(row.harvest_year),
    lotSerial: Number(row.lot_serial),
    farm: String(row.farm_code ?? ""),
    growMethod: String(row.grow_method_code ?? ""),
    strain: String(row.strain_name ?? ""),
    marketStrain: String(row.market_strain ?? ""),
    wetGrams: Number(row.wet_grams ?? 0),
    dryGrams: Number(row.dry_grams ?? 0),
    plantCount: row.plant_count == null ? null : Number(row.plant_count),
    effectiveDate: row.effective_date,
    finishedAt: String(row.finished_at),
  }));
}

/** Every name a lot wears as its real strain or its market strain, for the pick list. */
export function dryStrainNames(lots: readonly DryStrainLot[]): string[] {
  const seen = new Map<string, string>();
  for (const lot of lots) {
    for (const name of [lot.strain, lot.marketStrain]) {
      const trimmed = name.trim();
      if (trimmed && !seen.has(norm(trimmed))) seen.set(norm(trimmed), trimmed);
    }
  }
  return [...seen.values()].sort((a, b) => a.localeCompare(b));
}
