/**
 * POST HARVEST PUZZLES (canon 0.30.351). One row per strain for a harvest year.
 * 2025 is history from the workbook. Later years are the app's lots.
 */

import { nowIso, refusal, requireReason, textOrNull } from "./audit";
import { outcomeOf } from "./compliance";
import {
  CONFIG_KEYS,
  format2,
  formatGrams,
  GRAMS_PER_LB,
  NON_TRIM_SOURCE_SQL,
  PHP_BUD_PRICE_DEFAULT,
  PHP_TRIM_PRICE_DEFAULT,
  parsePhpPrice,
  round2,
} from "./config";
import { getConfigValue, insertLog, requireActor } from "./db";
import { assignAttempts, rowsFromSheet } from "./intesting";
import { t, tFill, type Locale } from "./i18n";
import { LAB_ATTEMPT_SQL, LAB_CONSOLE_SET_SQL, LAB_OUTCOME_SQL } from "./labvocab";
import { esc } from "./ui";
import { excelSerialToIso } from "./xlsb";
import { readXlsxSheets, type XlsxGridRow } from "./xlsx";
import type { ReportView } from "./reports";

export type ProductBucket = "bud" | "mixed" | "smalls" | "trim" | "shake" | "bio" | "kief";

/** WPR is smalls, SHA is shake, WASTE and anything else stay out. */
export function productBucket(code: string | null | undefined): ProductBucket | null {
  const name = String(code ?? "").trim().toUpperCase();
  if (name === "BUD") return "bud";
  if (name === "MIX") return "mixed";
  if (name === "SMALLS" || name === "WPR") return "smalls";
  if (name === "SHAKE" || name === "SHA") return "shake";
  if (name === "TRIM") return "trim";
  if (name === "BIO") return "bio";
  if (name === "KIEF") return "kief";
  return null;
}

/** The lot token is the last five characters. Its first two digits are the harvest year. */
export function lotTokenYear(hbn: string | null | undefined): number | null {
  const text = String(hbn ?? "").trim();
  if (text.length < 5) return null;
  const yy = /^(\d{2})/.exec(text.slice(-5));
  return yy ? 2000 + Number(yy[1]) : null;
}

export type PuzzleLot = {
  strain: string;
  market: string;
  farm: string;
  hbn: string;
  plants: number;
  spear: number;
  bucked: number;
  bud: number;
  mixed: number;
  smalls: number;
  trim: number;
  shake: number;
  bio: number;
  kief: number;
  entryDate: string | null;
};

export type PuzzleTest = {
  strain: string | null;
  hbn: string | null;
  potency: number | null;
  status: string | null;
  failureMode: string | null;
  attempt: number | null;
};

export type PuzzlePlan = {
  strain: string;
  allocation: number | null;
  tcIh: string;
  note: string;
};

export type PuzzleNumbers = {
  strain: string;
  plants: number;
  wetLbs: number;
  dryLbs: number;
  dryPct: number | null;
  totalBud: number;
  totalTrimBio: number;
  wetPp: number | null;
  dryPp: number | null;
  btr: number | null;
  bpp: number | null;
  tpp: number | null;
  dollarPp: number | null;
  thc: number | null;
  tymFails: number;
  tests: number;
  tymPct: number | null;
  harvestDate: string | null;
  allocation: number | null;
  tcIh: string;
};

function zero(value: number | null | undefined): number {
  return value == null || !Number.isFinite(Number(value)) ? 0 : Number(value);
}

function quotient(top: number, bottom: number): number | null {
  if (bottom === 0) return null;
  return top / bottom;
}

/** A strain's tests: market-strain match, else the lots' HBNs. */
export function testsForStrain(lots: readonly Pick<PuzzleLot, "market" | "hbn">[], tests: readonly PuzzleTest[]): PuzzleTest[] {
  const markets = new Set(lots.map((lot) => lot.market.trim().toLowerCase()).filter((name) => name.length > 0));
  const byMarket = tests.filter((test) => markets.has((test.strain ?? "").trim().toLowerCase()));
  if (byMarket.length > 0) return byMarket;
  const hbns = new Set(lots.map((lot) => lot.hbn.trim().toLowerCase()).filter((name) => name.length > 0));
  return tests.filter((test) => hbns.has((test.hbn ?? "").trim().toLowerCase()));
}

function tymFail(test: PuzzleTest): boolean {
  if (outcomeOf(test.status) !== "failed") return false;
  return /yeast/i.test(test.failureMode ?? "");
}

export function puzzleNumbers(
  lots: readonly PuzzleLot[],
  tests: readonly PuzzleTest[],
  plans: readonly PuzzlePlan[],
  budPrice: number,
  trimPrice: number
): PuzzleNumbers[] {
  const byStrain = new Map<string, PuzzleLot[]>();
  for (const lot of lots) {
    const name = lot.strain.trim();
    if (!name || name.toLowerCase() === "r&d") continue;
    const list = byStrain.get(name) ?? [];
    list.push(lot);
    byStrain.set(name, list);
  }
  const planBy = new Map(plans.map((plan) => [plan.strain.trim().toLowerCase(), plan]));
  const rows: PuzzleNumbers[] = [];
  for (const [strain, group] of byStrain) {
    const plants = group.reduce((sum, lot) => sum + zero(lot.plants), 0);
    const wetG = group.reduce((sum, lot) => sum + zero(lot.spear) + zero(lot.bucked), 0);
    const budG = group.reduce((sum, lot) => sum + zero(lot.bud) + zero(lot.mixed) + zero(lot.smalls), 0);
    const otherG = group.reduce((sum, lot) => sum + zero(lot.trim) + zero(lot.shake) + zero(lot.bio) + zero(lot.kief), 0);
    const trimBioG = group.reduce((sum, lot) => sum + zero(lot.trim) + zero(lot.bio), 0);
    const shakeG = group.reduce((sum, lot) => sum + zero(lot.shake), 0);
    const wetLbs = wetG / GRAMS_PER_LB;
    const dryLbs = (budG + otherG) / GRAMS_PER_LB;
    const totalBud = (budG + shakeG) / GRAMS_PER_LB;
    const totalTrimBio = trimBioG / GRAMS_PER_LB;
    const dryPct = quotient(dryLbs, wetLbs);
    const wetPp = quotient(wetLbs, plants);
    const dryPp = quotient(dryLbs, plants);
    const btr = quotient(totalBud, totalBud + totalTrimBio);
    const bpp = dryPp == null || btr == null ? null : dryPp * btr;
    const tpp = dryPp == null || bpp == null ? null : dryPp - bpp;
    const dollarPp = bpp == null || tpp == null ? null : bpp * budPrice + tpp * trimPrice;
    const mine = testsForStrain(group, tests);
    const potencies = mine.map((test) => test.potency).filter((value): value is number => value != null && Number.isFinite(value));
    const thc = potencies.length === 0 ? null : potencies.reduce((sum, value) => sum + value, 0) / potencies.length;
    const tymFails = mine.filter(tymFail).length;
    const first = mine.filter((test) => test.attempt === 1).length;
    const tymPct = quotient(tymFails, first);
    const dates = group.map((lot) => lot.entryDate).filter((date): date is string => !!date).sort();
    const plan = planBy.get(strain.toLowerCase());
    rows.push({
      strain,
      plants,
      wetLbs,
      dryLbs,
      dryPct,
      totalBud,
      totalTrimBio,
      wetPp,
      dryPp,
      btr,
      bpp,
      tpp,
      dollarPp,
      thc,
      tymFails,
      tests: first,
      tymPct,
      harvestDate: dates[0] ?? null,
      allocation: plan?.allocation ?? null,
      tcIh: plan?.tcIh ?? "",
    });
  }
  rows.sort((a, b) => {
    if (a.dollarPp == null && b.dollarPp == null) return a.strain.localeCompare(b.strain);
    if (a.dollarPp == null) return 1;
    if (b.dollarPp == null) return -1;
    return b.dollarPp - a.dollarPp || a.strain.localeCompare(b.strain);
  });
  return rows;
}

export function topIndexes(values: readonly (number | null)[], count: number): Set<number> {
  const ranked = values
    .map((value, index) => ({ value, index }))
    .filter((item): item is { value: number; index: number } => item.value != null && Number.isFinite(item.value))
    .sort((a, b) => b.value - a.value || a.index - b.index);
  return new Set(ranked.slice(0, count).map((item) => item.index));
}

export type PuzzleTotals = {
  plants: number;
  wetLbs: number;
  dryLbs: number;
  wetPp: number | null;
  dryPp: number | null;
  allocation: number;
  withNew: number;
};

export function puzzleTotals(rows: readonly PuzzleNumbers[], newAllocation: number): PuzzleTotals {
  const plants = rows.reduce((sum, row) => sum + row.plants, 0);
  const wetLbs = rows.reduce((sum, row) => sum + row.wetLbs, 0);
  const dryLbs = rows.reduce((sum, row) => sum + row.dryLbs, 0);
  const allocation = rows.reduce((sum, row) => sum + zero(row.allocation), 0);
  return {
    plants,
    wetLbs,
    dryLbs,
    wetPp: quotient(wetLbs, plants),
    dryPp: quotient(dryLbs, plants),
    allocation,
    withNew: allocation + newAllocation,
  };
}

function lbs(value: number): string {
  return format2(round2(value));
}

function pct1(ratio: number): string {
  return `${(Math.round(ratio * 1000) / 10).toFixed(1)}%`;
}

function money(value: number): string {
  return `$${format2(round2(value))}`;
}

function dash(value: number | null, text: string): string {
  return value == null ? "-" : text;
}

export function allocationHeader(year: number): string {
  return `${String((year + 1) % 100).padStart(2, "0")} Allocation`;
}

const FARMS = ["PNN", "PNS", "ARL"] as const;

export function farmOf(raw: string | null | undefined): "All" | "PNN" | "PNS" | "ARL" {
  const name = String(raw ?? "").trim().toUpperCase();
  return (FARMS as readonly string[]).includes(name) ? (name as "PNN" | "PNS" | "ARL") : "All";
}

type LotSql = {
  id: string;
  plants: number | null;
  hbn: string | null;
  farm_code: string | null;
  entry_date: string | null;
  market_strain: string | null;
  strain: string | null;
  wet_grams: number | null;
};

type PackSql = { lot_id: string; package_type_code: string | null; weight_grams: number | null };

async function liveLots(db: D1Database, year: number): Promise<PuzzleLot[]> {
  const lots = await db
    .prepare(
      `SELECT w.id, COALESCE(w.plant_count, 0) AS plants, b.hbn, b.farm_code, b.entry_date, b.market_strain, s.name AS strain,
              COALESCE((SELECT SUM(ww.weight_grams) FROM wet_weights ww WHERE ww.wet_weight_entry_id = w.id AND ww.deleted_at IS NULL), 0) AS wet_grams
       FROM wet_weight_entries w
       JOIN harvest_batches b ON b.id = w.harvest_batch_id AND b.deleted_at IS NULL
       JOIN strains s ON s.id = b.strain_id
       WHERE w.deleted_at IS NULL AND b.harvest_year = ?`
    )
    .bind(year)
    .all<LotSql>();
  const packs = await db
    .prepare(
      `SELECT w.id AS lot_id, p.package_type_code, p.weight_grams
       FROM wip_packages p
       JOIN wet_weight_entries w ON w.id = p.wet_weight_entry_id AND w.deleted_at IS NULL
       JOIN harvest_batches b ON b.id = w.harvest_batch_id AND b.deleted_at IS NULL
       WHERE p.deleted_at IS NULL AND b.harvest_year = ? AND ${NON_TRIM_SOURCE_SQL}`
    )
    .bind(year)
    .all<PackSql>();
  const byLot = new Map<string, PackSql[]>();
  for (const pack of packs.results ?? []) {
    const list = byLot.get(pack.lot_id) ?? [];
    list.push(pack);
    byLot.set(pack.lot_id, list);
  }
  return (lots.results ?? []).map((lot) => {
    const strain = (lot.strain ?? "").trim();
    const bits = { bud: 0, mixed: 0, smalls: 0, trim: 0, shake: 0, bio: 0, kief: 0 };
    for (const pack of byLot.get(lot.id) ?? []) {
      const bucket = productBucket(pack.package_type_code);
      if (bucket) bits[bucket] += zero(pack.weight_grams);
    }
    return {
      strain,
      market: (lot.market_strain ?? "").trim() || strain,
      farm: (lot.farm_code ?? "").trim(),
      hbn: (lot.hbn ?? "").trim(),
      plants: zero(lot.plants),
      spear: zero(lot.wet_grams),
      bucked: 0,
      ...bits,
      entryDate: (lot.entry_date ?? "").slice(0, 10) || null,
    };
  });
}

type HistLot = {
  strain: string | null;
  market_strain: string | null;
  farm: string | null;
  harvest_batch_name: string | null;
  plants: number | null;
  wet_spear_grams: number | null;
  bucked_wet_grams: number | null;
  bud_grams: number | null;
  mixed_grams: number | null;
  smalls_grams: number | null;
  trim_grams: number | null;
  shake_grams: number | null;
  bio_grams: number | null;
  kief_grams: number | null;
  entry_date: string | null;
};

async function historyLots(db: D1Database, year: number): Promise<PuzzleLot[]> {
  const rows = await db
    .prepare(
      `SELECT strain, market_strain, farm, harvest_batch_name, plants, wet_spear_grams, bucked_wet_grams,
              bud_grams, mixed_grams, smalls_grams, trim_grams, shake_grams, bio_grams, kief_grams, entry_date
       FROM post_harvest_lots WHERE harvest_year = ? AND deleted_at IS NULL`
    )
    .bind(year)
    .all<HistLot>();
  return (rows.results ?? []).map((lot) => {
    const strain = (lot.strain ?? "").trim();
    return {
      strain,
      market: (lot.market_strain ?? "").trim() || strain,
      farm: (lot.farm ?? "").trim(),
      hbn: (lot.harvest_batch_name ?? "").trim(),
      plants: zero(lot.plants),
      spear: zero(lot.wet_spear_grams),
      bucked: zero(lot.bucked_wet_grams),
      bud: zero(lot.bud_grams),
      mixed: zero(lot.mixed_grams),
      smalls: zero(lot.smalls_grams),
      trim: zero(lot.trim_grams),
      shake: zero(lot.shake_grams),
      bio: zero(lot.bio_grams),
      kief: zero(lot.kief_grams),
      entryDate: (lot.entry_date ?? "").slice(0, 10) || null,
    };
  });
}

async function yearHasHistory(db: D1Database, year: number): Promise<boolean> {
  const row = await db
    .prepare(`SELECT COUNT(*) AS n FROM post_harvest_lots WHERE harvest_year = ? AND deleted_at IS NULL`)
    .bind(year)
    .first<{ n: number }>();
  return Number(row?.n ?? 0) > 0;
}

async function historyTests(db: D1Database, year: number): Promise<PuzzleTest[]> {
  const rows = await db
    .prepare(
      `SELECT strain, hbn, potency, status, failure_mode, attempt
       FROM post_harvest_tests WHERE harvest_year = ? AND deleted_at IS NULL`
    )
    .bind(year)
    .all<{ strain: string | null; hbn: string | null; potency: number | null; status: string | null; failure_mode: string | null; attempt: number | null }>();
  return (rows.results ?? []).map((row) => ({
    strain: row.strain,
    hbn: row.hbn,
    potency: row.potency == null ? null : Number(row.potency),
    status: row.status,
    failureMode: row.failure_mode,
    attempt: row.attempt == null ? null : Number(row.attempt),
  }));
}

/** THE STATION IS THE TEST RECORD (canon 0.30.365, BRIEF V25 law 3). A live
 * year's tests are the lab station's compliance samples (labvocab's set: R&D
 * out, voided out), the year by the lot token of harvest_batch. The status is
 * the station's outcome (passed, failed or open: a retest_failed is failed for
 * the TYM rule) and the attempt is 2 for a retest by the one retest rule. */
async function liveTests(db: D1Database, year: number): Promise<PuzzleTest[]> {
  const rows = await db
    .prepare(
      `SELECT strain, harvest_batch AS hbn, thc_potency_pct AS potency, ${LAB_OUTCOME_SQL} AS status,
              fail_reason AS failure_mode, ${LAB_ATTEMPT_SQL} AS attempt
       FROM lab_compliance_samples
       WHERE ${LAB_CONSOLE_SET_SQL}`
    )
    .all<{ strain: string | null; hbn: string | null; potency: number | null; status: string | null; failure_mode: string | null; attempt: number | null }>();
  return (rows.results ?? [])
    .filter((row) => lotTokenYear(row.hbn) === year)
    .map((row) => ({
      strain: row.strain,
      hbn: row.hbn,
      potency: row.potency == null ? null : Number(row.potency),
      status: row.status,
      failureMode: row.failure_mode,
      attempt: row.attempt == null ? null : Number(row.attempt),
    }));
}

async function plansFor(db: D1Database, year: number): Promise<PuzzlePlan[]> {
  const rows = await db
    .prepare(
      `SELECT strain_name, allocation_plants, tc_ih, note
       FROM post_harvest_plan WHERE harvest_year = ? AND deleted_at IS NULL`
    )
    .bind(year)
    .all<{ strain_name: string; allocation_plants: number | null; tc_ih: string | null; note: string | null }>();
  return (rows.results ?? []).map((row) => ({
    strain: row.strain_name,
    allocation: row.allocation_plants == null ? null : Number(row.allocation_plants),
    tcIh: row.tc_ih ?? "",
    note: row.note ?? "",
  }));
}

export async function puzzleYears(db: D1Database): Promise<number[]> {
  const hist = await db
    .prepare(`SELECT DISTINCT harvest_year AS year FROM post_harvest_lots WHERE deleted_at IS NULL`)
    .all<{ year: number }>();
  const live = await db
    .prepare(
      `SELECT DISTINCT b.harvest_year AS year
       FROM harvest_batches b
       JOIN wet_weight_entries w ON w.harvest_batch_id = b.id AND w.deleted_at IS NULL
       WHERE b.deleted_at IS NULL AND b.harvest_year IS NOT NULL`
    )
    .all<{ year: number }>();
  const years = new Set<number>();
  for (const row of hist.results ?? []) years.add(Number(row.year));
  for (const row of live.results ?? []) years.add(Number(row.year));
  return [...years].filter((year) => Number.isFinite(year)).sort((a, b) => b - a);
}

export type PuzzlePage = {
  year: number;
  farm: "All" | "PNN" | "PNS" | "ARL";
  years: number[];
  source: "history" | "live";
  rows: PuzzleNumbers[];
  totals: PuzzleTotals;
  newStrains: PuzzlePlan[];
  budPrice: number;
  trimPrice: number;
  best: { dryPp: Set<number>; btr: Set<number>; dollarPp: Set<number>; thc: Set<number> };
  worstTym: Set<number>;
};

export async function loadPuzzlePage(db: D1Database, askedYear: string | null, askedFarm: string | null): Promise<PuzzlePage> {
  const years = await puzzleYears(db);
  const parsed = /^\d{4}$/.test(String(askedYear ?? "").trim()) ? Number(askedYear) : null;
  const year = parsed ?? years[0] ?? new Date().getUTCFullYear();
  const farm = farmOf(askedFarm);
  const history = await yearHasHistory(db, year);
  const allLots = history ? await historyLots(db, year) : await liveLots(db, year);
  const tests = history ? await historyTests(db, year) : await liveTests(db, year);
  const plans = await plansFor(db, year);
  const names = new Set(allLots.map((lot) => lot.strain.trim().toLowerCase()));
  const lots = farm === "All" ? allLots : allLots.filter((lot) => lot.farm.toUpperCase() === farm);
  const budPrice = parsePhpPrice(await getConfigValue(db, CONFIG_KEYS.php_bud_price_per_lb), PHP_BUD_PRICE_DEFAULT);
  const trimPrice = parsePhpPrice(await getConfigValue(db, CONFIG_KEYS.php_trim_price_per_lb), PHP_TRIM_PRICE_DEFAULT);
  const rows = puzzleNumbers(lots, tests, plans, budPrice, trimPrice);
  const newStrains = plans.filter((plan) => !names.has(plan.strain.trim().toLowerCase()) && plan.strain.trim().toLowerCase() !== "r&d");
  const totals = puzzleTotals(rows, newStrains.reduce((sum, plan) => sum + zero(plan.allocation), 0));
  return {
    year,
    farm,
    years: years.includes(year) ? years : [year, ...years],
    source: history ? "history" : "live",
    rows,
    totals,
    newStrains,
    budPrice,
    trimPrice,
    best: {
      dryPp: topIndexes(rows.map((row) => row.dryPp), 10),
      btr: topIndexes(rows.map((row) => row.btr), 10),
      dollarPp: topIndexes(rows.map((row) => row.dollarPp), 10),
      thc: topIndexes(rows.map((row) => row.thc), 10),
    },
    worstTym: topIndexes(rows.map((row) => row.tymPct), 10),
  };
}

function cell(text: string, mark: string): string {
  const cls = mark ? ` class="${mark}"` : "";
  return `<td${cls}>${esc(text)}</td>`;
}

export function postHarvestHtml(page: PuzzlePage, locale: Locale, flash?: string): string {
  const header = allocationHeader(page.year);
  const yearOpts = page.years
    .map((year) => `<option value="${year}"${year === page.year ? " selected" : ""}>${year}</option>`)
    .join("");
  const farmOpt = (value: string, label: string) =>
    `<option value="${value}"${page.farm === value ? " selected" : ""}>${esc(t(locale, label))}</option>`;
  const heads = [
    "Strain",
    "Plants",
    "Wet lbs",
    "Dry lbs",
    "Dry %",
    "Total Bud",
    "Total Trim/Bio",
    "Wet #s PP",
    "Dry #s PP",
    "BTR",
    "BPP",
    "TPP",
    "$PP",
    "Average THC",
    "TYM Fails",
    "# Tests",
    "TYM% Failed",
    "Harvest Date",
    header,
    "TC or IH",
  ];
  const head = heads.map((label) => `<th data-php-col="${esc(label)}">${esc(label === header ? header : t(locale, label))}</th>`).join("");
  const body = page.rows
    .map((row, index) => {
      const mark = (kind: string, on: boolean) => (on ? kind : "");
      const plan = `<form method="post" action="/reports/post_harvest_puzzles/plan" class="php-plan">
        <input type="hidden" name="harvest_year" value="${page.year}">
        <input type="hidden" name="farm" value="${esc(page.farm)}">
        <input type="hidden" name="strain_name" value="${esc(row.strain)}">
        <input type="text" name="allocation" inputmode="numeric" value="${row.allocation == null ? "" : esc(String(row.allocation))}" data-php-allocation>
        <input type="text" name="tc_ih" value="${esc(row.tcIh)}" maxlength="40" data-php-tc>
        <input type="text" name="reason" required placeholder="${esc(t(locale, "Reason"))}">
        <button type="submit">${esc(t(locale, "Save"))}</button>
      </form>`;
      return `<tr data-php-strain="${esc(row.strain)}">
        ${cell(row.strain, "")}
        ${cell(formatGrams(row.plants), "")}
        ${cell(lbs(row.wetLbs), "")}
        ${cell(lbs(row.dryLbs), "")}
        ${cell(dash(row.dryPct, pct1(row.dryPct ?? 0)), "")}
        ${cell(lbs(row.totalBud), "")}
        ${cell(lbs(row.totalTrimBio), "")}
        ${cell(dash(row.wetPp, lbs(row.wetPp ?? 0)), "")}
        ${cell(dash(row.dryPp, lbs(row.dryPp ?? 0)), mark("php-best", page.best.dryPp.has(index)))}
        ${cell(dash(row.btr, pct1(row.btr ?? 0)), mark("php-best", page.best.btr.has(index)))}
        ${cell(dash(row.bpp, lbs(row.bpp ?? 0)), "")}
        ${cell(dash(row.tpp, lbs(row.tpp ?? 0)), "")}
        ${cell(dash(row.dollarPp, money(row.dollarPp ?? 0)), mark("php-best", page.best.dollarPp.has(index)))}
        ${cell(dash(row.thc, format2(round2(row.thc ?? 0))), mark("php-best", page.best.thc.has(index)))}
        ${cell(formatGrams(row.tymFails), "")}
        ${cell(formatGrams(row.tests), "")}
        ${cell(dash(row.tymPct, pct1(row.tymPct ?? 0)), mark("php-worst", page.worstTym.has(index)))}
        ${cell(row.harvestDate ?? "-", "")}
        <td>${plan}</td>
        <td>${esc(row.tcIh)}</td>
      </tr>`;
    })
    .join("");
  const empty =
    page.rows.length === 0
      ? `<tr><td colspan="${heads.length}">${esc(t(locale, "No strains for this year."))}</td></tr>`
      : body;
  const next = String((page.year + 1) % 100).padStart(2, "0");
  const newcomers = page.newStrains
    .map(
      (plan) =>
        `<li data-php-new="${esc(plan.strain)}">${esc(formatGrams(plan.allocation ?? 0))} ${esc(plan.strain)} ${esc(plan.note || plan.tcIh)}</li>`
    )
    .join("");
  const banner = flash ? `<p class="banner ok" data-php-flash>${esc(flash)}</p>` : "";
  return `<h1>${esc(t(locale, "Post Harvest Puzzles"))}</h1>
    ${banner}
    <form class="stack report-filters" method="get" action="/reports/post_harvest_puzzles">
      <label class="field">${esc(t(locale, "Harvest year"))} <select name="year" data-php-year>${yearOpts || `<option value="${page.year}">${page.year}</option>`}</select></label>
      <label class="field">${esc(t(locale, "Farm"))} <select name="farm">${farmOpt("All", "All")}${farmOpt("PNN", "PNN")}${farmOpt("PNS", "PNS")}${farmOpt("ARL", "ARL")}</select></label>
      <button type="submit">${esc(t(locale, "Apply filters"))}</button>
    </form>
    <p class="format-bar">
      <a class="btn secondary" href="/reports/post_harvest_puzzles?year=${page.year}&farm=${esc(page.farm)}&format=csv">${esc(t(locale, "CSV (standard)"))}</a>
      <a class="btn secondary" href="/reports/post_harvest_puzzles?year=${page.year}&farm=${esc(page.farm)}&format=xlsx">${esc(t(locale, "XLSX (pretty)"))}</a>
      <a class="btn secondary" href="/reports/post_harvest_puzzles?year=${page.year}&farm=${esc(page.farm)}&format=pdf">${esc(t(locale, "PDF (pretty)"))}</a>
    </p>
    <p class="muted">${esc(page.source === "history" ? t(locale, "This year is the imported history.") : t(locale, "This year is computed from the lots."))}</p>
    <form class="stack" method="post" action="/reports/post_harvest_puzzles/import" enctype="multipart/form-data" data-php-import>
      <p class="muted">${esc(t(locale, "Drop the Post Harvest workbook (.xlsx). It lands as history for the year its lots carry. A second drop of that year replaces the history."))}</p>
      <label class="field">${esc(t(locale, "Workbook (.xlsx)"))} <input type="file" name="file" accept=".xlsx" required></label>
      <label class="field"><input type="checkbox" name="replace_typed" value="1"> ${esc(t(locale, "Replace typed plan rows for that year."))}</label>
      <input type="hidden" name="back_year" value="${page.year}">
      <input type="hidden" name="farm" value="${esc(page.farm)}">
      <label class="field">${esc(t(locale, "Reason"))} <input type="text" name="reason" required></label>
      <button type="submit">${esc(t(locale, "Import workbook"))}</button>
    </form>
    <div class="report-scroll"><table class="data" data-php-table>
      <thead><tr>${head}</tr></thead>
      <tbody>${empty}</tbody>
      <tfoot>
        <tr data-php-totals>
          <td>${esc(t(locale, "Totals"))}</td>
          <td>${esc(formatGrams(page.totals.plants))}</td>
          <td>${esc(lbs(page.totals.wetLbs))}</td>
          <td>${esc(lbs(page.totals.dryLbs))}</td>
          <td colspan="14"></td>
          <td data-php-allocation-total>${esc(formatGrams(page.totals.allocation))}</td>
          <td></td>
        </tr>
        <tr data-php-per-plant>
          <td></td>
          <td></td>
          <td>${esc(dash(page.totals.wetPp, lbs(page.totals.wetPp ?? 0)))}</td>
          <td>${esc(dash(page.totals.dryPp, lbs(page.totals.dryPp ?? 0)))}</td>
          <td colspan="14"></td>
          <td data-php-allocation-with-new>${esc(formatGrams(page.totals.withNew))}</td>
          <td></td>
        </tr>
      </tfoot>
    </table></div>
    <p class="php-key"><span class="php-best">${esc(t(locale, "10 best"))}</span> <span class="php-worst">${esc(t(locale, "10 worst"))}</span> ${esc(t(locale, "PP = per plant"))}</p>
    <h2>${esc(tFill(locale, "New strains for {yy}", { yy: next }))}</h2>
    ${newcomers ? `<ul>${newcomers}</ul>` : `<p class="muted">${esc(t(locale, "No new strains."))}</p>`}
    <form class="stack" method="post" action="/reports/post_harvest_puzzles/plan" data-php-add>
      <input type="hidden" name="harvest_year" value="${page.year}">
      <input type="hidden" name="farm" value="${esc(page.farm)}">
      <input type="hidden" name="is_new" value="1">
      <label class="field">${esc(t(locale, "Strain"))} <input type="text" name="strain_name" required></label>
      <label class="field">${esc(header)} <input type="text" name="allocation" inputmode="numeric"></label>
      <label class="field">${esc(t(locale, "TC or IH"))} <input type="text" name="tc_ih" maxlength="40"></label>
      <label class="field">${esc(t(locale, "Note"))} <input type="text" name="note" maxlength="40"></label>
      <label class="field">${esc(t(locale, "Reason"))} <input type="text" name="reason" required></label>
      <button type="submit">${esc(t(locale, "Add"))}</button>
    </form>`;
}

function shown(row: PuzzleNumbers, header: string): Record<string, string | number> {
  return {
    strain: row.strain,
    plants: formatGrams(row.plants),
    wet: lbs(row.wetLbs),
    dry: lbs(row.dryLbs),
    dry_pct: dash(row.dryPct, pct1(row.dryPct ?? 0)),
    bud: lbs(row.totalBud),
    trim: lbs(row.totalTrimBio),
    wet_pp: dash(row.wetPp, lbs(row.wetPp ?? 0)),
    dry_pp: dash(row.dryPp, lbs(row.dryPp ?? 0)),
    btr: dash(row.btr, pct1(row.btr ?? 0)),
    bpp: dash(row.bpp, lbs(row.bpp ?? 0)),
    tpp: dash(row.tpp, lbs(row.tpp ?? 0)),
    dollar: dash(row.dollarPp, money(row.dollarPp ?? 0)),
    thc: dash(row.thc, format2(round2(row.thc ?? 0))),
    tym: formatGrams(row.tymFails),
    tests: formatGrams(row.tests),
    tym_pct: dash(row.tymPct, pct1(row.tymPct ?? 0)),
    date: row.harvestDate ?? "-",
    allocation: row.allocation == null ? "" : formatGrams(row.allocation),
    tc: row.tcIh,
    [header]: "",
  };
}

export function postHarvestView(page: PuzzlePage): ReportView {
  const header = allocationHeader(page.year);
  const columns = [
    { key: "strain", label: "Strain" },
    { key: "plants", label: "Plants" },
    { key: "wet", label: "Wet lbs" },
    { key: "dry", label: "Dry lbs" },
    { key: "dry_pct", label: "Dry %" },
    { key: "bud", label: "Total Bud" },
    { key: "trim", label: "Total Trim/Bio" },
    { key: "wet_pp", label: "Wet #s PP" },
    { key: "dry_pp", label: "Dry #s PP" },
    { key: "btr", label: "BTR" },
    { key: "bpp", label: "BPP" },
    { key: "tpp", label: "TPP" },
    { key: "dollar", label: "$PP" },
    { key: "thc", label: "Average THC" },
    { key: "tym", label: "TYM Fails" },
    { key: "tests", label: "# Tests" },
    { key: "tym_pct", label: "TYM% Failed" },
    { key: "date", label: "Harvest Date" },
    { key: "allocation", label: header },
    { key: "tc", label: "TC or IH" },
  ];
  const rows = page.rows.map((row) => shown(row, header));
  rows.push({
    ...shown(page.rows[0] ?? ({} as PuzzleNumbers), header),
    strain: "Totals",
    plants: formatGrams(page.totals.plants),
    wet: lbs(page.totals.wetLbs),
    dry: lbs(page.totals.dryLbs),
    allocation: formatGrams(page.totals.allocation),
    dry_pct: "",
    bud: "",
    trim: "",
    wet_pp: dash(page.totals.wetPp, lbs(page.totals.wetPp ?? 0)),
    dry_pp: dash(page.totals.dryPp, lbs(page.totals.dryPp ?? 0)),
    btr: "",
    bpp: "",
    tpp: "",
    dollar: "",
    thc: "",
    tym: "",
    tests: "",
    tym_pct: "",
    date: "",
    tc: formatGrams(page.totals.withNew),
  });
  return {
    key: "post_harvest_puzzles",
    title: "Post Harvest Puzzles",
    columns,
    rows,
    empty: "No strains for this year.",
  };
}

function collapsed(value: string): string {
  return value.replace(/\s+/g, " ").trim().toLowerCase();
}

function headerIndex(cells: (string | number | boolean | null)[], name: string): number {
  const want = collapsed(name);
  return cells.findIndex((cell) => collapsed(String(cell ?? "")) === want);
}

function cellText(value: string | number | boolean | null | undefined): string | null {
  if (value == null || value === "") return null;
  const text = String(value).trim();
  return text || null;
}

function cellNumber(value: string | number | boolean | null | undefined): number | null {
  if (value == null || value === "") return null;
  const n = typeof value === "number" ? value : Number(String(value).replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

function gridRow(grid: XlsxGridRow[], index: number): (string | number | boolean | null)[] {
  return grid.find((line) => line.row === index)?.cells ?? [];
}

const DATA_HEADERS = [
  "Date",
  "METRC Harvest Tag",
  "Harvest Batch Name",
  "Farm",
  "Grow Method",
  "Strain",
  "Market Strain",
  "Associated Batch",
  "Is Bio/FFZ?",
  "Plants",
  "Wet Spear Weight (grams)",
  "Bucked Wet Weight (grams)",
  "Dry Weight (grams)",
  "Bud Weight (grams)",
  "Mixed Weight (grams)",
  "Smalls Weight (grams)",
  "Trim Weight (grams)",
  "shake",
  "Bio Weight (grams)",
  "Kief Weight (grams)",
] as const;

function sheetDateText(value: string | number | boolean | null | undefined): string | null {
  if (typeof value === "number" && value > 20000 && value < 80000) return excelSerialToIso(value);
  const text = cellText(value);
  if (!text) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10);
  return text;
}

export type ImportCounts = { year: number; lots: number; tests: number; planRows: number };

export async function importPostHarvest(db: D1Database, form: FormData): Promise<{ redirect: string }> {
  const actor = await requireActor(db, textOrNull(form.get("person_id")));
  const reason = requireReason(textOrNull(form.get("reason")));
  const file = form.get("file");
  if (!(file instanceof File) || !file.name.toLowerCase().endsWith(".xlsx")) {
    throw refusal(400, { key: "Drop the Post Harvest workbook, an .xlsx file.", vars: {} });
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  const sheets = await readXlsxSheets(bytes);
  const data = sheets.get("data");
  const testing = sheets.get("InTesting");
  if (!data) throw refusal(400, { key: "The workbook needs a data sheet.", vars: {} });
  if (!testing) throw refusal(400, { key: "The workbook needs an InTesting sheet.", vars: {} });
  const header = gridRow(data, 0);
  const missing = DATA_HEADERS.find((name) => headerIndex(header, name) < 0);
  if (missing) throw refusal(400, { key: "The data sheet is missing {header}.", vars: { header: missing } });
  const at = (cells: (string | number | boolean | null)[], name: string) => cells[headerIndex(header, name)] ?? null;
  const lots: Record<string, string | number | null>[] = [];
  for (const line of data) {
    if (line.row === 0) continue;
    const hbn = cellText(at(line.cells, "Harvest Batch Name"));
    if (!hbn) continue;
    const year = lotTokenYear(hbn);
    if (year == null) throw refusal(400, { key: "A lot has no harvest year in its batch name.", vars: {} });
    lots.push({
      hbn,
      year,
      entry_date: sheetDateText(at(line.cells, "Date")),
      metrc_harvest_tag: cellText(at(line.cells, "METRC Harvest Tag")),
      farm: cellText(at(line.cells, "Farm")),
      grow_method: cellText(at(line.cells, "Grow Method")),
      strain: cellText(at(line.cells, "Strain")),
      market_strain: cellText(at(line.cells, "Market Strain")),
      associated_batch: cellText(at(line.cells, "Associated Batch")),
      is_bio_ffz: cellText(at(line.cells, "Is Bio/FFZ?")),
      plants: cellNumber(at(line.cells, "Plants")),
      wet_spear_grams: cellNumber(at(line.cells, "Wet Spear Weight (grams)")),
      bucked_wet_grams: cellNumber(at(line.cells, "Bucked Wet Weight (grams)")),
      dry_weight_grams: cellNumber(at(line.cells, "Dry Weight (grams)")),
      bud_grams: cellNumber(at(line.cells, "Bud Weight (grams)")),
      mixed_grams: cellNumber(at(line.cells, "Mixed Weight (grams)")),
      smalls_grams: cellNumber(at(line.cells, "Smalls Weight (grams)")),
      trim_grams: cellNumber(at(line.cells, "Trim Weight (grams)")),
      shake_grams: cellNumber(at(line.cells, "shake")),
      bio_grams: cellNumber(at(line.cells, "Bio Weight (grams)")),
      kief_grams: cellNumber(at(line.cells, "Kief Weight (grams)")),
    });
  }
  if (lots.length === 0) throw refusal(400, { key: "The data sheet has no lots.", vars: {} });
  const year = Number(lots[0].year);
  if (lots.some((lot) => lot.year !== year)) throw refusal(400, { key: "The workbook's lots do not share one harvest year.", vars: {} });
  // One batch name can span several METRC harvest tags, one sheet row each, the plants typed on the first
  // (2025: 26201, 26202 and 26203 of Fruity Pebbles); every row lands, never one per batch name (gate 0.30.352).
  const parsed = rowsFromSheet("InTesting", testing, "R&D");
  if (parsed.missing) throw refusal(400, { key: "The InTesting sheet is missing {header}.", vars: { header: parsed.missing } });
  assignAttempts(parsed.rows);
  const tests = parsed.rows.filter((row) => lotTokenYear(row.hbn) === year);
  const results = sheets.get("results") ?? [];
  const plans = planRowsFromResults(results);
  const confirm = String(form.get("replace_typed") ?? "") === "1";
  const ts = nowIso();
  const importId = crypto.randomUUID();
  const stmts: D1PreparedStatement[] = [
    db.prepare(`DELETE FROM post_harvest_lots WHERE harvest_year = ?`).bind(year),
    db.prepare(`DELETE FROM post_harvest_tests WHERE harvest_year = ?`).bind(year),
    db.prepare(`DELETE FROM post_harvest_plan WHERE harvest_year = ? AND (source = 'import' OR ? = 1)`).bind(year, confirm ? 1 : 0),
  ];
  for (const lot of lots) {
    stmts.push(
      db
        .prepare(
          `INSERT INTO post_harvest_lots (
            id, harvest_year, import_id, entry_date, metrc_harvest_tag, harvest_batch_name, farm, grow_method, strain,
            market_strain, associated_batch, is_bio_ffz, plants, wet_spear_grams, bucked_wet_grams, dry_weight_grams,
            bud_grams, mixed_grams, smalls_grams, trim_grams, shake_grams, bio_grams, kief_grams,
            created_at, created_by, updated_at, updated_by, deleted_at, deleted_by
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL)`
        )
        .bind(
          crypto.randomUUID(),
          year,
          importId,
          lot.entry_date,
          lot.metrc_harvest_tag,
          lot.hbn,
          lot.farm,
          lot.grow_method,
          lot.strain,
          lot.market_strain,
          lot.associated_batch,
          lot.is_bio_ffz,
          lot.plants,
          lot.wet_spear_grams,
          lot.bucked_wet_grams,
          lot.dry_weight_grams,
          lot.bud_grams,
          lot.mixed_grams,
          lot.smalls_grams,
          lot.trim_grams,
          lot.shake_grams,
          lot.bio_grams,
          lot.kief_grams,
          ts,
          actor.id,
          ts,
          actor.id
        )
    );
  }
  for (const test of tests) {
    stmts.push(
      db
        .prepare(
          `INSERT INTO post_harvest_tests (
            id, harvest_year, import_id, strain, hbn, potency, status, failure_mode, attempt, required_test,
            created_at, created_by, updated_at, updated_by, deleted_at, deleted_by
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL)`
        )
        .bind(
          crypto.randomUUID(),
          year,
          importId,
          test.strain,
          test.hbn,
          test.potency,
          test.status,
          test.failure_mode,
          test.attempt,
          test.required_test,
          ts,
          actor.id,
          ts,
          actor.id
        )
    );
  }
  const kept = confirm
    ? new Set<string>()
    : new Set(
        (
          (
            await db
              .prepare(`SELECT strain_name FROM post_harvest_plan WHERE harvest_year = ? AND source = 'typed' AND deleted_at IS NULL`)
              .bind(year)
              .all<{ strain_name: string }>()
          ).results ?? []
        ).map((row) => row.strain_name.trim().toLowerCase())
      );
  stmts.push(
    insertLog(db, {
      record_table: "post_harvest_lots",
      record_id: importId,
      field: "import",
      old_value: null,
      new_value: String(lots.length),
      actor_person_id: actor.id,
      reason,
      changed_at: ts,
    })
  );
  let planRows = 0;
  for (const plan of plans) {
    if (kept.has(plan.strain.trim().toLowerCase())) continue;
    planRows += 1;
    stmts.push(
      db
        .prepare(
          `INSERT INTO post_harvest_plan (
            id, harvest_year, strain_name, allocation_plants, tc_ih, note, is_new_strain, source,
            created_at, created_by, updated_at, updated_by, deleted_at, deleted_by
          ) VALUES (?, ?, ?, ?, ?, ?, ?, 'import', ?, ?, ?, ?, NULL, NULL)`
        )
        .bind(crypto.randomUUID(), year, plan.strain, plan.allocation, plan.tcIh, plan.note, plan.isNew ? 1 : 0, ts, actor.id, ts, actor.id)
    );
  }
  for (let i = 0; i < stmts.length; i += 40) {
    const chunk = stmts.slice(i, i + 40);
    if (chunk.length) await db.batch(chunk);
  }
  const back = /^\d{4}$/.test(String(form.get("back_year") ?? "")) ? String(form.get("back_year")) : String(year);
  const farm = farmOf(String(form.get("farm") ?? ""));
  const q = new URLSearchParams({
    year: back,
    farm,
    ok: "imported",
    lots: String(lots.length),
    tests: String(tests.length),
    plan: String(planRows),
    imported_year: String(year),
  });
  return { redirect: `/reports/post_harvest_puzzles?${q.toString()}` };
}

function planRowsFromResults(grid: XlsxGridRow[]): Array<{ strain: string; allocation: number | null; tcIh: string; note: string; isNew: boolean }> {
  const headerLine = grid.find((line) => headerIndex(line.cells, "Strain") >= 0);
  const out: Array<{ strain: string; allocation: number | null; tcIh: string; note: string; isNew: boolean }> = [];
  if (headerLine) {
    const strainCol = headerIndex(headerLine.cells, "Strain");
    const allocCol = headerLine.cells.findIndex((value) => collapsed(String(value ?? "")).endsWith("allocation"));
    const tcCol = headerLine.cells.findIndex((value) => collapsed(String(value ?? "")) === "tc or ih");
    for (const line of grid) {
      if (line.row <= headerLine.row) continue;
      if (line.row >= 32 && line.row <= 41) continue;
      const strain = cellText(line.cells[strainCol]);
      if (!strain) continue;
      out.push({
        strain,
        allocation: allocCol < 0 ? null : cellNumber(line.cells[allocCol]),
        tcIh: tcCol < 0 ? "" : cellText(line.cells[tcCol]) ?? "",
        note: "",
        isNew: false,
      });
    }
  }
  for (let row = 32; row <= 41; row++) {
    const cells = gridRow(grid, row);
    const allocation = cellNumber(cells[19]);
    const strain = cellText(cells[20]);
    const note = cellText(cells[21]) ?? "";
    if (!strain) continue;
    out.push({ strain, allocation, tcIh: note, note, isNew: true });
  }
  return out;
}

function wholePlants(raw: unknown): number | null {
  const text = String(raw ?? "").trim();
  if (!text) return null;
  if (!/^\d+$/.test(text)) return null;
  return Number(text);
}

export async function savePostHarvestPlan(db: D1Database, form: FormData): Promise<{ redirect: string }> {
  const actor = await requireActor(db, textOrNull(form.get("person_id")));
  const reason = requireReason(textOrNull(form.get("reason")));
  const yearText = String(form.get("harvest_year") ?? "").trim();
  if (!/^\d{4}$/.test(yearText)) throw refusal(400, { key: "Harvest year must be a four-digit year.", vars: {} });
  const year = Number(yearText);
  const strain = String(form.get("strain_name") ?? "").trim();
  if (!strain) throw refusal(400, { key: "Strain is required.", vars: {} });
  const allocationText = String(form.get("allocation") ?? "").trim();
  const allocation = wholePlants(form.get("allocation"));
  if (allocationText && allocation == null) throw refusal(400, { key: "Allocation is a whole number of plants, zero or more.", vars: {} });
  const tc = String(form.get("tc_ih") ?? "").trim();
  if (tc.length > 40) throw refusal(400, { key: "TC or IH is too long.", vars: {} });
  const note = String(form.get("note") ?? "").trim();
  if (note.length > 40) throw refusal(400, { key: "Note is too long.", vars: {} });
  const isNew = String(form.get("is_new") ?? "") === "1" ? 1 : 0;
  const ts = nowIso();
  const existing = await db
    .prepare(`SELECT id, allocation_plants, tc_ih, note, source FROM post_harvest_plan WHERE harvest_year = ? AND strain_name = ? AND deleted_at IS NULL`)
    .bind(year, strain)
    .first<{ id: string; allocation_plants: number | null; tc_ih: string | null; note: string | null; source: string }>();
  if (existing) {
    await db.batch([
      db
        .prepare(
          `UPDATE post_harvest_plan
           SET allocation_plants = ?, tc_ih = ?, note = ?, is_new_strain = CASE WHEN ? = 1 THEN 1 ELSE is_new_strain END,
               source = 'typed', updated_at = ?, updated_by = ?
           WHERE id = ?`
        )
        .bind(allocation, tc, note || existing.note, isNew, ts, actor.id, existing.id),
      insertLog(db, {
        record_table: "post_harvest_plan",
        record_id: existing.id,
        field: "allocation_plants",
        old_value: existing.allocation_plants == null ? null : String(existing.allocation_plants),
        new_value: allocation == null ? null : String(allocation),
        actor_person_id: actor.id,
        reason,
        changed_at: ts,
      }),
      insertLog(db, {
        record_table: "post_harvest_plan",
        record_id: existing.id,
        field: "tc_ih",
        old_value: existing.tc_ih,
        new_value: tc,
        actor_person_id: actor.id,
        reason,
        changed_at: ts,
      }),
    ]);
  } else {
    const id = crypto.randomUUID();
    await db.batch([
      db
        .prepare(
          `INSERT INTO post_harvest_plan (
            id, harvest_year, strain_name, allocation_plants, tc_ih, note, is_new_strain, source,
            created_at, created_by, updated_at, updated_by, deleted_at, deleted_by
          ) VALUES (?, ?, ?, ?, ?, ?, ?, 'typed', ?, ?, ?, ?, NULL, NULL)`
        )
        .bind(id, year, strain, allocation, tc, note || null, isNew, ts, actor.id, ts, actor.id),
      insertLog(db, {
        record_table: "post_harvest_plan",
        record_id: id,
        field: "allocation_plants",
        old_value: null,
        new_value: allocation == null ? null : String(allocation),
        actor_person_id: actor.id,
        reason,
        changed_at: ts,
      }),
    ]);
  }
  const farm = farmOf(String(form.get("farm") ?? ""));
  return { redirect: `/reports/post_harvest_puzzles?year=${year}&farm=${farm}&ok=saved` };
}
