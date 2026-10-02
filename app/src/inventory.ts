/**
 * Inventory node sheet + Acquire HBN recall helpers (builder prompt 2026-09-01).
 * Pure functions: fixture-driven tests live here. Database queries stay in db.ts.
 */
import {
  FG_TYPE_CODES,
  formatGrams,
  isFgTypeCode,
  projectedDryYieldPct,
  type FgTypeCode,
} from "./config";
import { toCsv } from "./csv";
import type { MetrcFgInventory } from "./metrc";

export type InventoryLotLine = {
  short_id: string;
  strain_name: string;
  space_name: string;
  grams: number;
};

export type InventoryPkgLine = {
  package_code: string;
  short_id: string;
  strain_name: string;
  grams: number;
};

export type DryingLotView = {
  short_id: string;
  strain_name: string;
  elapsed: string;
  wet_grams: number;
  projected_grams: number;
};

export type DryingSpaceView = {
  id: string;
  name: string;
  kind: string;
  lots: DryingLotView[];
};

export type CollapsibleGrams = {
  key: string;
  grams: number;
  lotLines: InventoryLotLine[];
  pkgLines: InventoryPkgLine[];
  /** Muted note on the row (awaiting stage, empty). */
  note?: string;
  /** True when the pipeline has no stage; do not invent numbers. */
  awaiting?: boolean;
};

export type ParetoBar = {
  label: string;
  outcome: string;
  count: number;
  pct: number;
};

export type FgItem = { name: string; stock: number };

export type FgTypeView = {
  type: FgTypeCode;
  stock: number;
  items: FgItem[];
};

export type FgMenuView = {
  dataAsOf: string;
  builtAt: string;
  types: FgTypeView[];
};

export type InventorySheet = {
  yieldPct: number;
  dryingSpaces: DryingSpaceView[];
  wetDrying: CollapsibleGrams;
  projectedDrying: CollapsibleGrams;
  waitingTrim: CollapsibleGrams;
  waitingPasteurize: CollapsibleGrams;
  waitingExtraction: CollapsibleGrams;
  totalDry: CollapsibleGrams;
  scheduledTesting: CollapsibleGrams;
  inTesting: CollapsibleGrams;
  pareto: ParetoBar[];
  failRatePct: number | null;
  /** FG INVENTORY IN METRC (canon 0.30.43): the mirror's active packages by
   * item kind; null when no packages export has been mounted. */
  fg: MetrcFgInventory | null;
};

export type DrySpaceRow = { id: string; name: string; kind: string };

export type DryingLotRow = {
  dry_space_id: string;
  short_id: string;
  strain_name: string;
  weight_grams: number;
  updated_at: string;
};

export type UnloadedLotRow = {
  short_id: string;
  strain_name: string;
  space_name: string;
  dry_weight_grams: number;
};

export type SheetPkgRow = {
  package_code: string;
  short_id: string;
  strain_name: string;
  weight_grams: number;
};

export type OutcomeRow = { test_outcome: string };

export type RecallableBatch = {
  id: string;
  hbn: string;
  entry_date: string;
  farm_code: string;
  grow_method_code: string;
  strain_id: string;
  manicure: number;
  planned_dryspc: string | null;
  /** THE HBN ENTRY (canon 0.30.341): the HBN's form, spear or bucked. */
  material_form?: string | null;
  start_time: string | null;
  zone: string | null;
  rows_text: string | null;
  metrc_harvest_tag: string | null;
  license_value?: string | null;
};

/** Acquire HBN form fields that recall restores. */
export const RECALL_PREFILL_FIELDS = [
  "entry_date",
  "farm_code",
  "grow_method_code",
  "strain_id",
  "manicure",
  "planned_dryspc",
  "material_form",
  "start_time",
  "zone",
  "rows_text",
  "metrc_harvest_tag",
  "license_value",
] as const;

export type RecallPrefill = Partial<Record<(typeof RECALL_PREFILL_FIELDS)[number], string>>;

export const NO_LAB_RECORDED = "(no lab recorded)";

/** Wet grams times the yield percent, cent-exact. */
export function projectedDryGrams(wetGrams: number, yieldPct: number): number {
  const wetCents = Math.round(Number(wetGrams) * 100);
  const pct = Number(yieldPct);
  if (!Number.isFinite(wetCents) || !Number.isFinite(pct) || pct < 0) return 0;
  return Math.round((wetCents * pct) / 100) / 100;
}

/** Time since start as Nd Nh. updated_at is the status-flip approximation. */
export function formatElapsedNdNh(startedAt: string, nowIso: string): string {
  const start = Date.parse(startedAt);
  const now = Date.parse(nowIso);
  if (!Number.isFinite(start) || !Number.isFinite(now) || now < start) return "0d 0h";
  const hours = Math.floor((now - start) / 3_600_000);
  return `${Math.floor(hours / 24)}d ${hours % 24}h`;
}

function num(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function sumLineGrams(lines: ReadonlyArray<{ grams: number }>): number {
  let cents = 0;
  for (const line of lines) cents += Math.round(num(line.grams) * 100);
  return cents / 100;
}

export function emptyInventorySheet(yieldPct = 22): InventorySheet {
  const awaiting: CollapsibleGrams = {
    key: "waiting-pasteurize",
    grams: 0,
    lotLines: [],
    pkgLines: [],
    note: "OWNER MAPPING NEEDED",
    awaiting: true,
  };
  return {
    yieldPct,
    dryingSpaces: [],
    wetDrying: { key: "wet-drying", grams: 0, lotLines: [], pkgLines: [] },
    projectedDrying: { key: "projected-drying", grams: 0, lotLines: [], pkgLines: [] },
    waitingTrim: { key: "waiting-trim", grams: 0, lotLines: [], pkgLines: [] },
    waitingPasteurize: awaiting,
    // Owner ruling 2026-09-01: "Trim and BIO only." The extraction mapping is
    // ruled now, so the row carries no PROVISIONAL note.
    waitingExtraction: {
      key: "waiting-extraction",
      grams: 0,
      lotLines: [],
      pkgLines: [],
    },
    totalDry: { key: "total-dry", grams: 0, lotLines: [], pkgLines: [] },
    scheduledTesting: { key: "rep-scheduled", grams: 0, lotLines: [], pkgLines: [] },
    inTesting: { key: "rep-testing", grams: 0, lotLines: [], pkgLines: [] },
    pareto: [],
    failRatePct: null,
    fg: null,
  };
}

export function buildInventorySheet(input: {
  yieldPct: number;
  nowIso: string;
  spaces: readonly DrySpaceRow[];
  dryingLots: readonly DryingLotRow[];
  unloadedLots: readonly UnloadedLotRow[];
  extractionPackages: readonly SheetPkgRow[];
  livePackages: readonly SheetPkgRow[];
  cryoPackages: readonly SheetPkgRow[];
  testingPackages: readonly SheetPkgRow[];
  outcomes: readonly OutcomeRow[];
  fg: MetrcFgInventory | null;
}): InventorySheet {
  const yieldPct = projectedDryYieldPct(String(input.yieldPct));
  const lotsBySpace = new Map<string, DryingLotRow[]>();
  for (const lot of input.dryingLots) {
    const list = lotsBySpace.get(lot.dry_space_id) ?? [];
    list.push(lot);
    lotsBySpace.set(lot.dry_space_id, list);
  }
  const dryingSpaces: DryingSpaceView[] = input.spaces.map((space) => ({
    id: space.id,
    name: space.name,
    kind: space.kind,
    lots: (lotsBySpace.get(space.id) ?? []).map((lot) => ({
      short_id: lot.short_id,
      strain_name: lot.strain_name,
      elapsed: formatElapsedNdNh(lot.updated_at, input.nowIso),
      wet_grams: num(lot.weight_grams),
      projected_grams: projectedDryGrams(num(lot.weight_grams), yieldPct),
    })),
  }));

  const wetLines: InventoryLotLine[] = input.dryingLots.map((lot) => ({
    short_id: lot.short_id,
    strain_name: lot.strain_name,
    space_name: input.spaces.find((s) => s.id === lot.dry_space_id)?.name ?? "",
    grams: num(lot.weight_grams),
  }));
  const projectedLines: InventoryLotLine[] = wetLines.map((line) => ({
    ...line,
    grams: projectedDryGrams(line.grams, yieldPct),
  }));

  const trimLines: InventoryLotLine[] = input.unloadedLots.map((lot) => ({
    short_id: lot.short_id,
    strain_name: lot.strain_name,
    space_name: lot.space_name,
    grams: num(lot.dry_weight_grams),
  }));

  const extractionLines: InventoryPkgLine[] = input.extractionPackages.map(pkgLine);
  const livePkgLines: InventoryPkgLine[] = input.livePackages.map(pkgLine);
  const cryoLines: InventoryPkgLine[] = input.cryoPackages.map(pkgLine);
  const testingLines: InventoryPkgLine[] = input.testingPackages.map(pkgLine);

  const unloadedDry = sumLineGrams(trimLines);
  const livePkgGrams = sumLineGrams(livePkgLines);

  const pareto = paretoFromOutcomes(input.outcomes);
  const failRatePct = firstTimeFailRatePct(input.outcomes);

  return {
    yieldPct,
    dryingSpaces,
    wetDrying: {
      key: "wet-drying",
      grams: sumLineGrams(wetLines),
      lotLines: wetLines,
      pkgLines: [],
    },
    projectedDrying: {
      key: "projected-drying",
      grams: sumLineGrams(projectedLines),
      lotLines: projectedLines,
      pkgLines: [],
    },
    waitingTrim: {
      key: "waiting-trim",
      grams: unloadedDry,
      lotLines: trimLines,
      pkgLines: [],
    },
    waitingPasteurize: {
      key: "waiting-pasteurize",
      grams: 0,
      lotLines: [],
      pkgLines: [],
      note: "OWNER MAPPING NEEDED",
      awaiting: true,
    },
    // Owner ruling 2026-09-01: "Trim and BIO only." The extraction mapping is
    // ruled (created packages whose type is in app_config extraction_type_codes,
    // filtered by the caller's query), so the row carries no PROVISIONAL note.
    waitingExtraction: {
      key: "waiting-extraction",
      grams: sumLineGrams(extractionLines),
      lotLines: [],
      pkgLines: extractionLines,
    },
    totalDry: {
      key: "total-dry",
      grams: unloadedDry + livePkgGrams,
      lotLines: trimLines,
      pkgLines: livePkgLines,
    },
    scheduledTesting: {
      key: "rep-scheduled",
      grams: sumLineGrams(cryoLines),
      lotLines: [],
      pkgLines: cryoLines,
    },
    inTesting: {
      key: "rep-testing",
      grams: sumLineGrams(testingLines),
      lotLines: [],
      pkgLines: testingLines,
    },
    pareto,
    failRatePct,
    fg: input.fg,
  };
}

function pkgLine(row: SheetPkgRow): InventoryPkgLine {
  return {
    package_code: row.package_code,
    short_id: row.short_id,
    strain_name: row.strain_name,
    grams: num(row.weight_grams),
  };
}

/** Outcome bars descending by count, each grouped as (no lab recorded). */
export function paretoFromOutcomes(outcomes: readonly OutcomeRow[]): ParetoBar[] {
  const counts = new Map<string, number>();
  for (const row of outcomes) {
    const outcome = String(row.test_outcome ?? "").trim();
    if (!outcome) continue;
    counts.set(outcome, (counts.get(outcome) ?? 0) + 1);
  }
  const total = [...counts.values()].reduce((a, b) => a + b, 0);
  if (total === 0) return [];
  return [...counts.entries()]
    .map(([outcome, count]) => ({
      outcome,
      label: `${outcome} ${NO_LAB_RECORDED}`,
      count,
      pct: Math.round((count * 10000) / total) / 100,
    }))
    .sort((a, b) => b.count - a.count || a.outcome.localeCompare(b.outcome));
}

/** Failed over all persisted outcomes; null when nothing has been released. */
export function firstTimeFailRatePct(outcomes: readonly OutcomeRow[]): number | null {
  let total = 0;
  let failed = 0;
  for (const row of outcomes) {
    const outcome = String(row.test_outcome ?? "").trim();
    if (!outcome) continue;
    total += 1;
    if (outcome === "failed") failed += 1;
  }
  if (total === 0) return null;
  return Math.round((failed * 10000) / total) / 100;
}

export function parseFgMenu(raw: string): FgMenuView | null {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (data == null || typeof data !== "object" || Array.isArray(data)) return null;
  const obj = data as Record<string, unknown>;
  const dataAsOf = typeof obj.dataAsOf === "string" ? obj.dataAsOf : "";
  const builtAt = typeof obj.builtAt === "string" ? obj.builtAt : "";
  const buckets = new Map<FgTypeCode, FgItem[]>();
  for (const code of FG_TYPE_CODES) buckets.set(code, []);

  const lines = Array.isArray(obj.lines) ? obj.lines : [];
  for (const line of lines) {
    if (line == null || typeof line !== "object") continue;
    const rec = line as Record<string, unknown>;
    const typeRaw = String(rec.type ?? "");
    if (!isFgTypeCode(typeRaw)) continue;
    const pkgs = Array.isArray(rec.pkgs) ? rec.pkgs : [];
    if (pkgs.length > 0) {
      for (const pkg of pkgs) {
        if (pkg == null || typeof pkg !== "object") continue;
        const p = pkg as Record<string, unknown>;
        const name = String(p.name ?? rec.label ?? rec.key ?? "");
        buckets.get(typeRaw)!.push({ name, stock: num(p.stock) });
      }
    } else {
      const name = String(rec.label ?? rec.key ?? "");
      buckets.get(typeRaw)!.push({ name, stock: num(rec.available) });
    }
  }

  const types: FgTypeView[] = FG_TYPE_CODES.map((type) => {
    const items = buckets.get(type) ?? [];
    let cents = 0;
    for (const item of items) cents += Math.round(num(item.stock) * 100);
    return { type, stock: cents / 100, items };
  });
  return { dataAsOf, builtAt, types };
}

export type InventoryCsvRow = { section: string; row: string; grams: string };

/** Flat numbers of the sheet: section, row, grams. Machine CSV, raw 2-decimal. */
export function inventorySheetRows(sheet: InventorySheet): InventoryCsvRow[] {
  const rows: InventoryCsvRow[] = [
    csvGrams("drying", "Total Wet Weight drying", sheet.wetDrying.grams),
    csvGrams("drying", "Total Projected Dry Weight", sheet.projectedDrying.grams),
    csvGrams("production", "Waiting to be Trimmed total weight", sheet.waitingTrim.grams),
    { section: "production", row: "Waiting to be pasteurized total weight", grams: "" },
    csvGrams(
      "production",
      "Waiting to be shipped for extraction total weight",
      sheet.waitingExtraction.grams
    ),
    csvGrams("production", "Total Dry weight in inventory", sheet.totalDry.grams),
    csvGrams(
      "testing",
      "Total representative weight scheduled for testing",
      sheet.scheduledTesting.grams
    ),
    csvGrams("testing", "Total representative weight in testing", sheet.inTesting.grams),
  ];
  // FG INVENTORY IN METRC (canon 0.30.43): grams kinds under fg with their
  // grams; eaches and other units under fg_each and fg_other, the count in the
  // number column (the flat CSV keeps its three columns).
  if (sheet.fg) {
    for (const kind of sheet.fg.grams) {
      rows.push({ section: "fg", row: kind.kind, grams: formatGrams(kind.quantity) });
    }
    for (const kind of sheet.fg.eaches) {
      rows.push({ section: "fg_each", row: kind.kind, grams: String(Math.round(kind.quantity)) });
    }
    for (const kind of sheet.fg.other) {
      rows.push({ section: "fg_other", row: `${kind.kind} (${kind.uom})`, grams: kind.quantity.toFixed(2) });
    }
  }
  return rows;
}

function csvGrams(section: string, row: string, grams: number): InventoryCsvRow {
  return { section, row, grams: formatGrams(grams) };
}

export function inventorySheetCsv(sheet: InventorySheet): string {
  return toCsv(inventorySheetRows(sheet));
}

export function recallPrefillFromBatch(batch: RecallableBatch): RecallPrefill {
  const prefill: RecallPrefill = {
    entry_date: batch.entry_date,
    farm_code: batch.farm_code,
    grow_method_code: batch.grow_method_code,
    strain_id: batch.strain_id,
    manicure: batch.manicure ? "1" : "0",
  };
  if (batch.planned_dryspc) prefill.planned_dryspc = batch.planned_dryspc;
  if (batch.material_form) prefill.material_form = batch.material_form;
  if (batch.start_time) prefill.start_time = batch.start_time;
  if (batch.zone) prefill.zone = batch.zone;
  if (batch.rows_text) prefill.rows_text = batch.rows_text;
  if (batch.metrc_harvest_tag) prefill.metrc_harvest_tag = batch.metrc_harvest_tag;
  if (batch.license_value) prefill.license_value = batch.license_value;
  return prefill;
}

export function recallPrefillFromQuery(params: URLSearchParams): RecallPrefill {
  const prefill: RecallPrefill = {};
  for (const name of RECALL_PREFILL_FIELDS) {
    const value = params.get(name);
    if (value != null && value !== "") prefill[name] = value;
  }
  return prefill;
}

export function recallRedirectPath(prefill: RecallPrefill): string {
  const params = new URLSearchParams();
  params.set("ok", "recalled");
  for (const name of RECALL_PREFILL_FIELDS) {
    const value = prefill[name];
    if (value != null && value !== "") params.set(name, value);
  }
  return `/station/acquire_hbn?${params.toString()}`;
}
