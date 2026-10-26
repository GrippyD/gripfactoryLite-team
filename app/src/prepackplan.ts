/**
 * PC1: the prepack plan. The planner is pure. Zoho is read in two functions
 * only, zohoPrepackStock and zohoPrepackOrders. When the book of record
 * changes, those two are what change.
 */
import { nowIso, refusal, requireReason, textOrNull } from "./audit";
import { format2, GRAMS_PER_LB, PRODUCTION_SCHEDULING_PATH, round2 } from "./config";
import { getConfigMap, insertLog, listPrepackPanes, logsForInsert, requireActor, type MountedOrderRow } from "./db";
import { DD_CONFIG, DD_CONFIG_DEFAULTS, DD_CONFIG_RULES } from "./directorregistry";
import { farmToday } from "./effective";
import { effectiveStatus } from "./fulfillment";
import {
  FG_LISTINGS_SQL,
  FG_SETTING_KEYS,
  classifyListing,
  fgMountedLabel,
  fgSettingsFrom,
  itemPrefix,
  itemStrain,
  prepackEach,
  type FgListing,
  type FgSettings,
} from "./fginventory";
import { t, tFill, type Locale } from "./i18n";
import { esc, fieldBlock } from "./ui";
import { buildXlsx, type XlsxCell } from "./xlsx";

export const PREPACK_TARGETS_PATH = "/admin/prepack-targets";
export const PREPACK_PLAN_XLSX_PATH = `${PRODUCTION_SCHEDULING_PATH}/prepack/plan.xlsx`;

const WINDOW_KEY = DD_CONFIG.dd_moh_window_months;
const WINDOW_RULE = DD_CONFIG_RULES[WINDOW_KEY];

/** The name a person sees: edges trimmed, inner spaces collapsed to one, casing kept. */
export function strainShown(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}

/** The join key: the shown name, lowercased. */
export function strainKey(name: string): string {
  return strainShown(name).toLowerCase();
}

/** Two decimal pounds become grams at 448, from the typed cents so 1.25 is 560. */
export function poundsToGrams(pounds: number): number {
  const cents = Math.round(pounds * 100);
  return (cents * GRAMS_PER_LB) / 100;
}

/** Calendar months back from a YYYY-MM-DD, clamped to the month's last day. */
export function trailingWindowStart(today: string, months: number): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(today);
  if (!match || months < 1) return today;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const anchor = new Date(Date.UTC(year, month - 1 - months, 1));
  const last = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() + 1, 0)).getUTCDate();
  const out = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth(), Math.min(day, last)));
  return out.toISOString().slice(0, 10);
}

export type StrainGrams = { strain: string; grams: number };

export type PlanPackage = {
  id: string;
  strain: string;
  grams: number;
  entryDate: string;
  createdAt: string;
};

export type PlanInput = {
  ordersMounted: boolean;
  windowMonths: number;
  targets: StrainGrams[];
  onHand: StrainGrams[];
  open: StrainGrams[];
  shipped: StrainGrams[];
  scheduled: StrainGrams[];
  ready: StrainGrams[];
  packages: PlanPackage[];
};

export type PlanRow = {
  key: string;
  strain: string;
  targetGrams: number | null;
  onHandGrams: number;
  openGrams: number | null;
  freeGrams: number;
  scheduledGrams: number;
  /** Target minus free. The schedule is left out. May go below zero. */
  grossNeedGrams: number;
  /** Net Need: Target minus free minus scheduled, never below zero. */
  needGrams: number;
  readyGrams: number;
  /** Need minus ready, never below zero. */
  grossShortGrams: number;
  /** Net Short: Net Need minus ready, never below zero. */
  shortGrams: number;
  paceGrams: number | null;
  months: number | null;
};

export type PlanTotals = {
  targetGrams: number | null;
  onHandGrams: number;
  openGrams: number | null;
  freeGrams: number;
  scheduledGrams: number;
  grossNeedGrams: number;
  needGrams: number;
  readyGrams: number;
  grossShortGrams: number;
  shortGrams: number;
  paceGrams: number | null;
  months: number | null;
};

export type PlanModel = {
  rows: PlanRow[];
  totals: PlanTotals;
  picks: string[];
};

export type PrepackPlanView = PlanModel & {
  ordersMounted: boolean;
  stockAsOf: string | null;
  ordersAsOf: string | null;
};

type Acc = {
  strain: string;
  rank: number;
  hasTarget: boolean;
  target: number;
  onHand: number;
  open: number;
  scheduled: number;
  ready: number;
  shipped: number;
};

function finite(value: number | null | undefined): number | null {
  if (value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function windowMonthsOf(raw: string | undefined): number {
  const text = String(raw ?? "").trim();
  if (!/^\d+$/.test(text)) return Number(DD_CONFIG_DEFAULTS[WINDOW_KEY]);
  const n = Number(text);
  const min = WINDOW_RULE?.kind === "integer" ? WINDOW_RULE.min : 1;
  const max = WINDOW_RULE?.kind === "integer" ? WINDOW_RULE.max : 36;
  if (n < min || n > max) return Number(DD_CONFIG_DEFAULTS[WINDOW_KEY]);
  return n;
}

function ensure(map: Map<string, Acc>, strain: string, rank: number): Acc | null {
  const shown = strainShown(strain);
  const key = strainKey(shown);
  if (!key) return null;
  const have = map.get(key);
  if (!have) {
    const made: Acc = {
      strain: shown,
      rank,
      hasTarget: false,
      target: 0,
      onHand: 0,
      open: 0,
      scheduled: 0,
      ready: 0,
      shipped: 0,
    };
    map.set(key, made);
    return made;
  }
  if (rank < have.rank) {
    have.strain = shown;
    have.rank = rank;
  }
  return have;
}

function addIncluded(map: Map<string, Acc>, rows: StrainGrams[], rank: number, field: "onHand" | "open" | "scheduled" | "ready", always: boolean): void {
  for (const row of rows) {
    const grams = finite(row.grams) ?? 0;
    if (!always && !(grams > 0)) continue;
    const acc = ensure(map, row.strain, rank);
    if (acc) acc[field] += grams;
  }
}

function blankTotals(): PlanTotals {
  return {
    targetGrams: null,
    onHandGrams: 0,
    openGrams: null,
    freeGrams: 0,
    scheduledGrams: 0,
    grossNeedGrams: 0,
    needGrams: 0,
    readyGrams: 0,
    grossShortGrams: 0,
    shortGrams: 0,
    paceGrams: 0,
    months: null,
  };
}

/** Oldest lot first. A missing entry date sorts after every dated lot. */
function packageOrder(a: PlanPackage, b: PlanPackage): number {
  const ae = a.entryDate || "9999-99-99";
  const be = b.entryDate || "9999-99-99";
  if (ae !== be) return ae < be ? -1 : 1;
  const ac = a.createdAt || "9999-99-99T99";
  const bc = b.createdAt || "9999-99-99T99";
  if (ac !== bc) return ac < bc ? -1 : 1;
  if (a.id !== b.id) return a.id < b.id ? -1 : 1;
  return 0;
}

export function planPicks(rows: readonly PlanRow[], packages: readonly PlanPackage[]): string[] {
  const byKey = new Map<string, PlanPackage[]>();
  for (const pkg of packages) {
    const key = strainKey(pkg.strain);
    if (!key) continue;
    const list = byKey.get(key);
    if (list) list.push(pkg);
    else byKey.set(key, [pkg]);
  }
  const ids: string[] = [];
  for (const row of rows) {
    if (!(row.needGrams > 0)) continue;
    const list = [...(byKey.get(row.key) ?? [])].sort(packageOrder);
    let covered = 0;
    for (const pkg of list) {
      const grams = finite(pkg.grams) ?? 0;
      if (!(grams > 0)) continue;
      ids.push(pkg.id);
      covered += grams;
      if (covered + 1e-6 >= row.needGrams) break;
    }
  }
  return ids;
}

/** Net Need is Target minus free minus scheduled, never below zero.
 * Need leaves the schedule out and may go below zero. A blank target counts as zero in both.
 * Pure. Picks follow Net Need.
 */
export function planRows(input: PlanInput): PlanModel {
  const map = new Map<string, Acc>();
  for (const row of input.targets) {
    const grams = finite(row.grams) ?? 0;
    const acc = ensure(map, row.strain, 0);
    if (!acc) continue;
    acc.hasTarget = true;
    acc.target += grams;
  }
  addIncluded(map, input.onHand, 2, "onHand", false);
  if (input.ordersMounted) addIncluded(map, input.open, 2, "open", false);
  addIncluded(map, input.scheduled, 1, "scheduled", true);
  addIncluded(map, input.ready, 1, "ready", true);
  if (input.ordersMounted) {
    for (const row of input.shipped) {
      const acc = map.get(strainKey(row.strain));
      if (acc) acc.shipped += finite(row.grams) ?? 0;
    }
  }

  const monthsN = input.windowMonths >= 1 ? input.windowMonths : 0;
  const rows: PlanRow[] = [];
  for (const [key, acc] of map) {
    const openGrams = input.ordersMounted ? acc.open : null;
    const free = acc.onHand - (openGrams ?? 0);
    const grossNeed = (acc.hasTarget ? acc.target : 0) - free;
    const need = Math.max(0, grossNeed - acc.scheduled);
    const grossShort = Math.max(0, grossNeed - acc.ready);
    const short = Math.max(0, need - acc.ready);
    const pace = input.ordersMounted && acc.shipped > 0 && monthsN >= 1 ? acc.shipped / monthsN : null;
    const months = pace != null && pace > 0 ? free / pace : null;
    rows.push({
      key,
      strain: acc.strain,
      targetGrams: acc.hasTarget ? acc.target : null,
      onHandGrams: acc.onHand,
      openGrams,
      freeGrams: free,
      scheduledGrams: acc.scheduled,
      grossNeedGrams: grossNeed,
      needGrams: need,
      readyGrams: acc.ready,
      grossShortGrams: grossShort,
      shortGrams: short,
      paceGrams: pace,
      months,
    });
  }
  rows.sort((a, b) => {
    if (a.shortGrams !== b.shortGrams) return b.shortGrams - a.shortGrams;
    if (a.needGrams !== b.needGrams) return b.needGrams - a.needGrams;
    const an = a.strain.toLowerCase();
    const bn = b.strain.toLowerCase();
    if (an !== bn) return an < bn ? -1 : 1;
    if (a.strain !== b.strain) return a.strain < b.strain ? -1 : 1;
    return 0;
  });

  const totals = blankTotals();
  let shipped = 0;
  let anyTarget = false;
  for (const row of rows) {
    if (row.targetGrams != null) {
      anyTarget = true;
      totals.targetGrams = (totals.targetGrams ?? 0) + row.targetGrams;
    }
    totals.onHandGrams += row.onHandGrams;
    if (input.ordersMounted) totals.openGrams = (totals.openGrams ?? 0) + (row.openGrams ?? 0);
    totals.freeGrams += row.freeGrams;
    totals.scheduledGrams += row.scheduledGrams;
    totals.grossNeedGrams += row.grossNeedGrams;
    totals.needGrams += row.needGrams;
    totals.readyGrams += row.readyGrams;
    totals.grossShortGrams += row.grossShortGrams;
    totals.shortGrams += row.shortGrams;
    if (row.paceGrams != null && monthsN >= 1) shipped += row.paceGrams * monthsN;
  }
  if (!anyTarget) totals.targetGrams = null;
  totals.paceGrams = input.ordersMounted && shipped > 0 && monthsN >= 1 ? shipped / monthsN : null;
  totals.months = totals.paceGrams != null && totals.paceGrams > 0 ? totals.freeGrams / totals.paceGrams : null;
  return { rows, totals, picks: planPicks(rows, input.packages) };
}

type ListingSql = {
  item_name: string;
  category: string | null;
  market_uom: string | null;
  market_qty: number | null;
  qty_grams: number | null;
  each_grams: number | null;
  thc_pct: number | null;
  zoho_mounted_at: string | null;
};

export type ZohoPrepackStock = { mountedAt: string | null; onHand: StrainGrams[] };

/** PRE and MOB listings, FG's own rules, bags times each grams. */
export async function zohoPrepackStock(db: D1Database): Promise<ZohoPrepackStock> {
  const settings = fgSettingsFrom(await getConfigMap(db, FG_SETTING_KEYS));
  const listed = await db.prepare(FG_LISTINGS_SQL).all<ListingSql>();
  let mountedAt: string | null = null;
  const bag = new Map<string, { strain: string; grams: number }>();
  for (const row of listed.results ?? []) {
    const item: FgListing = {
      itemName: String(row.item_name ?? ""),
      category: String(row.category ?? ""),
      marketUom: row.market_uom == null ? null : String(row.market_uom),
      marketQty: finite(row.market_qty),
      qtyGrams: finite(row.qty_grams),
      eachGrams: finite(row.each_grams),
      thcPct: finite(row.thc_pct),
      mountedAt: row.zoho_mounted_at == null ? null : String(row.zoho_mounted_at),
    };
    if (classifyListing(item, settings) !== "pre") continue;
    if (item.mountedAt && (!mountedAt || item.mountedAt > mountedAt)) mountedAt = item.mountedAt;
    const count = item.marketQty != null && item.marketQty > 0 ? item.marketQty : 0;
    const grams = count * prepackEach(itemPrefix(item.itemName).toUpperCase(), item.eachGrams, settings);
    if (!(grams > 0)) continue;
    const shown = strainShown(itemStrain(item.itemName));
    const key = strainKey(shown);
    if (!key) continue;
    const have = bag.get(key);
    if (!have) bag.set(key, { strain: shown, grams });
    else have.grams += grams;
  }
  return { mountedAt, onHand: [...bag.values()].sort((a, b) => (a.strain < b.strain ? -1 : 1)) };
}

type OrderSql = {
  id: string;
  order_date: string | null;
  internal_status: string | null;
  pick_status: string | null;
};

type LineSql = {
  sales_order_id: string;
  item_name: string | null;
  sku: string | null;
  quantity_ordered: number | null;
  quantity_invoiced: number | null;
};

type EachSql = {
  sku: string | null;
  item_name: string | null;
  each_grams: number | null;
  zoho_status: string | null;
};

type EachRow = { itemName: string; each: number | null; active: boolean };

export type ZohoPrepackOrders = {
  mounted: boolean;
  mountedAt: string | null;
  open: StrainGrams[];
  shipped: StrainGrams[];
};

function putEach(map: Map<string, EachRow>, key: string, row: EachRow): void {
  if (!key) return;
  const have = map.get(key);
  if (!have) {
    map.set(key, row);
    return;
  }
  const haveEach = have.each != null && have.each > 0;
  const rowEach = row.each != null && row.each > 0;
  if (!haveEach && rowEach) map.set(key, row);
  else if (haveEach === rowEach && !have.active && row.active) map.set(key, row);
}

function eachOf(itemName: string, sku: string | null, bySku: Map<string, EachRow>, byName: Map<string, EachRow>, settings: FgSettings): number {
  const found = ((sku ?? "").trim() ? bySku.get((sku ?? "").trim()) : undefined) ?? byName.get(itemName.trim());
  const prefix = itemPrefix(found?.itemName || itemName).toUpperCase();
  const stored = found && found.each != null && found.each > 0 ? found.each : null;
  return prepackEach(prefix, stored, settings);
}

function inWindow(orderDate: string | null, today: string, start: string): boolean {
  const day = String(orderDate ?? "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return false;
  return day >= start && day <= today;
}

function pushGrams(map: Map<string, { strain: string; grams: number }>, strain: string, grams: number): void {
  if (!(grams > 0)) return;
  const shown = strainShown(strain);
  const key = strainKey(shown);
  if (!key) return;
  const have = map.get(key);
  if (!have) map.set(key, { strain: shown, grams });
  else have.grams += grams;
}

/** Open bags on orders that are not shipped, and invoiced bags shipped inside the window. */
export async function zohoPrepackOrders(db: D1Database, today: string, windowMonths: number): Promise<ZohoPrepackOrders> {
  const mount = await db
    .prepare(`SELECT created_at FROM so_mounts WHERE deleted_at IS NULL ORDER BY created_at DESC LIMIT 1`)
    .first<{ created_at: string }>();
  if (!mount) return { mounted: false, mountedAt: null, open: [], shipped: [] };
  const settings = fgSettingsFrom(await getConfigMap(db, FG_SETTING_KEYS));
  const [orders, lines, listings] = await Promise.all([
    db
      .prepare(
        `SELECT id, order_date, internal_status, pick_status
         FROM mounted_sales_orders
         WHERE deleted_at IS NULL`
      )
      .all<OrderSql>(),
    db
      .prepare(
        `SELECT sales_order_id, item_name, sku, quantity_ordered, quantity_invoiced
         FROM mounted_sales_order_lines
         WHERE deleted_at IS NULL AND readout_category = 'PREPACK'`
      )
      .all<LineSql>(),
    db
      .prepare(
        `SELECT sku, item_name, each_grams, zoho_status
         FROM listings
         WHERE deleted_at IS NULL`
      )
      .all<EachSql>(),
  ]);
  const bySku = new Map<string, EachRow>();
  const byName = new Map<string, EachRow>();
  for (const row of listings.results ?? []) {
    const itemName = String(row.item_name ?? "");
    const each = finite(row.each_grams);
    const packed: EachRow = { itemName, each, active: String(row.zoho_status ?? "") === "Active" };
    putEach(bySku, String(row.sku ?? "").trim(), packed);
    putEach(byName, itemName.trim(), packed);
  }
  const byId = new Map<string, OrderSql>();
  for (const order of orders.results ?? []) byId.set(String(order.id), order);
  const start = trailingWindowStart(today, windowMonths);
  const open = new Map<string, { strain: string; grams: number }>();
  const shipped = new Map<string, { strain: string; grams: number }>();
  for (const line of lines.results ?? []) {
    const order = byId.get(String(line.sales_order_id));
    if (!order) continue;
    const status = effectiveStatus({
      pick_status: order.pick_status,
      internal_status: order.internal_status,
    } as MountedOrderRow);
    const itemName = String(line.item_name ?? "");
    const each = eachOf(itemName, line.sku == null ? null : String(line.sku), bySku, byName, settings);
    const strain = itemStrain(itemName);
    if (status === "shipped") {
      if (!inWindow(order.order_date, today, start)) continue;
      const qty = Math.max(0, finite(line.quantity_invoiced) ?? 0);
      pushGrams(shipped, strain, qty * each);
      continue;
    }
    const qty = Math.max(0, (finite(line.quantity_ordered) ?? 0) - (finite(line.quantity_invoiced) ?? 0));
    pushGrams(open, strain, qty * each);
  }
  const list = (bag: Map<string, { strain: string; grams: number }>) => [...bag.values()].sort((a, b) => (a.strain < b.strain ? -1 : 1));
  return { mounted: true, mountedAt: String(mount.created_at), open: list(open), shipped: list(shipped) };
}

type TargetSql = {
  id: string;
  strain: string;
  strain_key: string;
  target_grams: number;
  note: string | null;
};

async function listLiveTargets(db: D1Database): Promise<TargetSql[]> {
  const listed = await db
    .prepare(
      `SELECT id, strain, strain_key, target_grams, note
       FROM prepack_targets
       WHERE deleted_at IS NULL`
    )
    .all<TargetSql>();
  return listed.results ?? [];
}

export async function loadPrepackSurface(db: D1Database, now: string): Promise<{ panes: Awaited<ReturnType<typeof listPrepackPanes>>; plan: PrepackPlanView }> {
  const [panes, stock, targets, today] = await Promise.all([
    listPrepackPanes(db),
    zohoPrepackStock(db),
    listLiveTargets(db),
    farmToday(db, now),
  ]);
  const windowRaw = await getConfigMap(db, [WINDOW_KEY]);
  const windowMonths = windowMonthsOf(windowRaw.get(WINDOW_KEY));
  const orders = await zohoPrepackOrders(db, today, windowMonths);
  const planned = planRows({
    ordersMounted: orders.mounted,
    windowMonths,
    targets: targets.map((row) => ({ strain: String(row.strain), grams: Number(row.target_grams) })),
    onHand: stock.onHand,
    open: orders.open,
    shipped: orders.shipped,
    scheduled: panes.working.map((row) => ({ strain: row.strain_name, grams: Number(row.grams ?? 0) })),
    ready: panes.available.map((row) => ({ strain: row.strain_name, grams: Number(row.grams ?? 0) })),
    packages: panes.available.map((row) => ({
      id: row.id,
      strain: row.strain_name,
      grams: Number(row.grams ?? 0),
      entryDate: String(row.entry_date ?? ""),
      createdAt: String(row.created_at ?? ""),
    })),
  });
  return {
    panes,
    plan: {
      ...planned,
      ordersMounted: orders.mounted,
      stockAsOf: stock.mountedAt,
      ordersAsOf: orders.mountedAt,
    },
  };
}

function asOfLabel(iso: string | null): string {
  if (!iso) return "";
  return fgMountedLabel(iso) || iso;
}

function poundsLabel(grams: number, locale: Locale): string {
  return `${format2(round2(grams / GRAMS_PER_LB))} ${t(locale, "lb")}`;
}

function gramCell(attr: string, grams: number | null, locale: Locale, warn: boolean): string {
  if (grams == null) return `<td ${attr}></td>`;
  const cls = warn ? ` class="plan-short"` : "";
  return `<td ${attr}${cls} data-grams="${esc(String(grams))}">${esc(poundsLabel(grams, locale))}</td>`;
}

const PLAN_NOTE = "Net Need and Net Short count what is already on the pack schedule. The Plan picks follow Net Need.";

function planRow(row: PlanRow, locale: Locale): string {
  return `<tr data-plan-key="${esc(row.key)}">
        <th scope="row">${esc(row.strain)}</th>
        ${gramCell("data-plan-target", row.targetGrams, locale, false)}
        ${gramCell("data-plan-free", row.freeGrams, locale, false)}
        ${gramCell("data-plan-scheduled", row.scheduledGrams, locale, false)}
        ${gramCell("data-plan-gross-need", row.grossNeedGrams, locale, false)}
        ${gramCell("data-plan-need", row.needGrams, locale, false)}
        ${gramCell("data-plan-ready", row.readyGrams, locale, false)}
        ${gramCell("data-plan-gross-short", row.grossShortGrams, locale, row.grossShortGrams > 0)}
        ${gramCell("data-plan-short", row.shortGrams, locale, row.shortGrams > 0)}
      </tr>`;
}

function planTotalRow(totals: PlanTotals, locale: Locale): string {
  return `<tr data-plan-total>
      <th scope="row">${esc(t(locale, "Totals"))}</th>
      ${gramCell("data-plan-target", totals.targetGrams, locale, false)}
      ${gramCell("data-plan-free", totals.freeGrams, locale, false)}
      ${gramCell("data-plan-scheduled", totals.scheduledGrams, locale, false)}
      ${gramCell("data-plan-gross-need", totals.grossNeedGrams, locale, false)}
      ${gramCell("data-plan-need", totals.needGrams, locale, false)}
      ${gramCell("data-plan-ready", totals.readyGrams, locale, false)}
      ${gramCell("data-plan-gross-short", totals.grossShortGrams, locale, totals.grossShortGrams > 0)}
      ${gramCell("data-plan-short", totals.shortGrams, locale, totals.shortGrams > 0)}
    </tr>`;
}

/** The Plan fold. Pounds at 448 g. Short Product and Net Short above zero use the warn tone. */
export function prepackPlanSection(plan: PrepackPlanView, locale: Locale): string {
  const stock = plan.stockAsOf
    ? `<p data-plan-stock>${esc(tFill(locale, "Zoho stock as of {time}", { time: asOfLabel(plan.stockAsOf) }))}</p>`
    : "";
  const orders = plan.ordersMounted
    ? `<p data-plan-orders>${esc(tFill(locale, "Orders as of {time}", { time: asOfLabel(plan.ordersAsOf) }))}</p>`
    : `<p data-plan-orders>${esc(t(locale, "No sales orders mounted yet"))}</p>`;
  const link = `<p><a href="${PREPACK_TARGETS_PATH}">${esc(t(locale, "Targets"))}</a> <a class="btn secondary" href="${PREPACK_PLAN_XLSX_PATH}">${esc(t(locale, "Export"))}</a></p>`;
  const head = `<tr>
      <th>${esc(t(locale, "Strain"))}</th>
      <th>${esc(t(locale, "Target"))}</th>
      <th>${esc(t(locale, "Packed (not ordered)"))}</th>
      <th>${esc(t(locale, "On Pack Schedule"))}</th>
      <th>${esc(t(locale, "Need"))}</th>
      <th>${esc(t(locale, "Net Need"))}</th>
      <th>${esc(t(locale, "Ready to pack"))}</th>
      <th>${esc(t(locale, "Short Product"))}</th>
      <th>${esc(t(locale, "Net Short"))}</th>
    </tr>`;
  const table =
    plan.rows.length === 0
      ? `<p class="muted" data-plan-empty>${esc(t(locale, "No strains on the plan."))}</p>`
      : `<div class="report-scroll"><table class="data" data-prepack-plan><thead>${head}</thead><tbody>${plan.rows.map((row) => planRow(row, locale)).join("")}${planTotalRow(plan.totals, locale)}</tbody></table></div>`;
  const note = `<p data-plan-note>${esc(t(locale, PLAN_NOTE))}</p>`;
  return `<details class="queue-fold" data-fold="prepack-plan" open><summary><h2>${esc(t(locale, "Plan"))}</h2></summary>
    ${stock}
    ${orders}
    ${link}
    ${table}
    ${note}
  </details>`;
}

const PLAN_XLSX_HEADINGS = [
  "Strain",
  "Target",
  "Packed (not ordered)",
  "On Pack Schedule",
  "Need",
  "Net Need",
  "Ready to pack",
  "Short Product",
  "Net Short",
  "On hand",
  "Open",
  "Pace (lb per month)",
  "Months",
] as const;

function planPounds(grams: number): number {
  return round2(grams / GRAMS_PER_LB);
}

/** A weight in pounds at 448, or a blank when the figure was never set. */
function lbsCell(grams: number | null): XlsxCell {
  if (grams == null) return {};
  return { number: planPounds(grams), lbs: true };
}

/** Months of cover: a plain number, never the pounds format. */
function monthsXlsxCell(months: number | null): XlsxCell {
  if (months == null) return {};
  return { number: round2(months) };
}

function planXlsxCells(row: PlanRow | PlanTotals, label: string): XlsxCell[] {
  return [
    { text: label },
    lbsCell(row.targetGrams),
    lbsCell(row.freeGrams),
    lbsCell(row.scheduledGrams),
    lbsCell(row.grossNeedGrams),
    lbsCell(row.needGrams),
    lbsCell(row.readyGrams),
    lbsCell(row.grossShortGrams),
    lbsCell(row.shortGrams),
    lbsCell(row.onHandGrams),
    lbsCell(row.openGrams),
    lbsCell(row.paceGrams),
    monthsXlsxCell(row.months),
  ];
}

function blankXlsxRow(): XlsxCell[] {
  return PLAN_XLSX_HEADINGS.map(() => ({}));
}

/** The same lines the fold header shows, in English, as the house exports are. */
function planAsOfRows(plan: PrepackPlanView): XlsxCell[][] {
  const lines: string[] = [];
  if (plan.stockAsOf) lines.push(`Zoho stock as of ${asOfLabel(plan.stockAsOf)}`);
  lines.push(plan.ordersMounted ? `Orders as of ${asOfLabel(plan.ordersAsOf)}` : "No sales orders mounted yet");
  return lines.map((text) => {
    const row = blankXlsxRow();
    row[0] = { text };
    return row;
  });
}

/** One sheet, Prepack plan. The autofilter stops at the last strain row. */
export function prepackPlanXlsx(plan: PrepackPlanView): Uint8Array {
  const strainRows = plan.rows.map((row) => planXlsxCells(row, row.strain));
  return buildXlsx({
    sheetName: "Prepack plan",
    headers: [...PLAN_XLSX_HEADINGS],
    autoFilter: 1 + strainRows.length,
    rows: [...strainRows, blankXlsxRow(), planXlsxCells(plan.totals, "Totals"), blankXlsxRow(), ...planAsOfRows(plan)],
  });
}

export function poundsInput(grams: number): string {
  return round2(grams / GRAMS_PER_LB).toFixed(2);
}

export type PrepackTargetFormRow = {
  strain: string;
  key: string;
  targetId: string | null;
  pounds: string;
  note: string;
};

export type PrepackTargetsPageModel = { rows: PrepackTargetFormRow[] };

export async function loadPrepackTargetsPage(db: D1Database, now: string): Promise<PrepackTargetsPageModel> {
  const [surface, targets] = await Promise.all([loadPrepackSurface(db, now), listLiveTargets(db)]);
  const byKey = new Map(targets.map((row) => [String(row.strain_key), row]));
  return {
    rows: surface.plan.rows.map((row) => {
      const live = byKey.get(row.key);
      return {
        strain: row.strain,
        key: row.key,
        targetId: live ? String(live.id) : null,
        pounds: row.targetGrams == null ? "" : poundsInput(row.targetGrams),
        note: live?.note == null ? "" : String(live.note),
      };
    }),
  };
}

function parseTargetPounds(raw: unknown): number {
  const text = textOrNull(raw);
  if (text == null || !/^\d+(\.\d{1,2})?$/.test(text)) {
    throw refusal(400, { key: "Target must be pounds, zero or more, with at most two decimals.", vars: {} });
  }
  const [whole, frac = ""] = text.split(".");
  const cents = Number(whole) * 100 + Number((frac + "00").slice(0, 2));
  return cents / 100;
}

export async function savePrepackTarget(db: D1Database, form: FormData): Promise<{ redirect: string }> {
  const actor = await requireActor(db, textOrNull(form.get("person_id")));
  const reason = requireReason(textOrNull(form.get("reason")));
  const shown = strainShown(String(form.get("strain") ?? ""));
  const key = strainKey(shown);
  if (!key) throw refusal(400, { key: "Name a strain.", vars: {} });
  const pounds = parseTargetPounds(form.get("pounds"));
  const grams = poundsToGrams(pounds);
  const note = textOrNull(form.get("note"));
  const ts = nowIso();
  const existing = await db
    .prepare(
      `SELECT id, strain, target_grams, note FROM prepack_targets
       WHERE strain_key = ? AND deleted_at IS NULL`
    )
    .bind(key)
    .first<{ id: string; strain: string; target_grams: number; note: string | null }>();
  if (existing) {
    const sameStrain = String(existing.strain) === shown;
    const sameGrams = Math.abs(Number(existing.target_grams) - grams) < 1e-6;
    const sameNote = (existing.note ?? null) === note;
    if (sameStrain && sameGrams && sameNote) return { redirect: `${PREPACK_TARGETS_PATH}?ok=saved` };
    const logs = [];
    if (!sameStrain) {
      logs.push(
        insertLog(db, {
          record_table: "prepack_targets",
          record_id: String(existing.id),
          field: "strain",
          old_value: String(existing.strain),
          new_value: shown,
          actor_person_id: actor.id,
          reason,
          changed_at: ts,
        })
      );
    }
    if (!sameGrams) {
      logs.push(
        insertLog(db, {
          record_table: "prepack_targets",
          record_id: String(existing.id),
          field: "target_grams",
          old_value: String(existing.target_grams),
          new_value: String(grams),
          actor_person_id: actor.id,
          reason,
          changed_at: ts,
        })
      );
    }
    if (!sameNote) {
      logs.push(
        insertLog(db, {
          record_table: "prepack_targets",
          record_id: String(existing.id),
          field: "note",
          old_value: existing.note,
          new_value: note,
          actor_person_id: actor.id,
          reason,
          changed_at: ts,
        })
      );
    }
    await db.batch([
      db
        .prepare(
          `UPDATE prepack_targets
           SET strain = ?, target_grams = ?, note = ?, updated_at = ?, updated_by = ?
           WHERE id = ? AND deleted_at IS NULL`
        )
        .bind(shown, grams, note, ts, actor.id, existing.id),
      ...logs,
    ]);
    return { redirect: `${PREPACK_TARGETS_PATH}?ok=saved` };
  }
  const id = crypto.randomUUID();
  const record = {
    strain: shown,
    strain_key: key,
    target_grams: grams,
    note,
    created_at: ts,
    created_by: actor.id,
    updated_at: ts,
    updated_by: actor.id,
  };
  await db.batch([
    db
      .prepare(
        `INSERT INTO prepack_targets (
           id, strain, strain_key, target_grams, note, created_at, created_by, updated_at, updated_by, deleted_at, deleted_by, delete_reason
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL)`
      )
      .bind(id, shown, key, grams, note, ts, actor.id, ts, actor.id),
    ...logsForInsert(db, "prepack_targets", id, record, actor.id, reason, ts),
  ]);
  return { redirect: `${PREPACK_TARGETS_PATH}?ok=saved` };
}

export async function deletePrepackTarget(db: D1Database, id: string, form: FormData): Promise<{ redirect: string }> {
  const actor = await requireActor(db, textOrNull(form.get("person_id")));
  const reason = requireReason(textOrNull(form.get("reason")));
  const row = await db
    .prepare(`SELECT id, target_grams FROM prepack_targets WHERE id = ? AND deleted_at IS NULL`)
    .bind(id)
    .first<{ id: string; target_grams: number }>();
  if (!row) throw refusal(404, { key: "That target is not on the list.", vars: {} });
  const ts = nowIso();
  await db.batch([
    db
      .prepare(
        `UPDATE prepack_targets
         SET deleted_at = ?, deleted_by = ?, delete_reason = ?, updated_at = ?, updated_by = ?
         WHERE id = ? AND deleted_at IS NULL`
      )
      .bind(ts, actor.id, reason, ts, actor.id, row.id),
    insertLog(db, {
      record_table: "prepack_targets",
      record_id: String(row.id),
      field: "target_grams",
      old_value: String(row.target_grams),
      new_value: null,
      actor_person_id: actor.id,
      reason,
      changed_at: ts,
    }),
  ]);
  return { redirect: `${PREPACK_TARGETS_PATH}?ok=saved` };
}

/** One row per strain the plan knows, plus a box to add a strain by name. */
export function prepackTargetsPage(model: PrepackTargetsPageModel, locale: Locale = "en"): string {
  const add = `<form class="stack" method="post" action="${PREPACK_TARGETS_PATH}" data-prepack-target-add>
      ${fieldBlock(locale, "Add a strain", `<input type="text" name="strain" required data-prepack-target-strain>`, "A strain the plan does not list yet.")}
      ${fieldBlock(
        locale,
        "Pounds",
        `<input type="text" name="pounds" inputmode="decimal" required data-prepack-target-pounds>`,
        "The target for this strain, in pounds. One pound is 448 g."
      )}
      ${fieldBlock(locale, "Note", `<input type="text" name="note" data-prepack-target-note>`, "Optional note")}
      ${fieldBlock(locale, "Reason", `<input type="text" name="reason" required data-prepack-target-reason>`, "Reason is required.")}
      <button type="submit">${esc(t(locale, "Save"))}</button>
    </form>`;
  const table =
    model.rows.length === 0
      ? `<p class="muted" data-prepack-targets-empty>${esc(t(locale, "No strains on the plan."))}</p>`
      : `<div class="report-scroll"><table class="data" data-prepack-targets>
      <thead><tr>
        <th>${esc(t(locale, "Strain"))}</th>
        <th>${esc(t(locale, "Pounds"))}</th>
        <th>${esc(t(locale, "Note"))}</th>
        <th>${esc(t(locale, "Reason"))}</th>
        <th></th>
        <th></th>
      </tr></thead>
      <tbody>
      ${model.rows
        .map((row, index) => {
          const formId = `prepack-target-${index}`;
          return `<tr data-prepack-target-key="${esc(row.key)}"${row.targetId ? ` data-prepack-target="${esc(row.targetId)}"` : ""}>
        <td>${esc(row.strain)}</td>
        <td><input form="${esc(formId)}" type="text" name="pounds" inputmode="decimal" value="${esc(row.pounds)}" data-prepack-target-pounds></td>
        <td><input form="${esc(formId)}" type="text" name="note" value="${esc(row.note)}" aria-label="${esc(t(locale, "Note"))}"></td>
        <td><input form="${esc(formId)}" type="text" name="reason" required aria-label="${esc(t(locale, "Reason"))}"></td>
        <td>
          <form id="${esc(formId)}" method="post" action="${PREPACK_TARGETS_PATH}">
            <input type="hidden" name="strain" value="${esc(row.strain)}">
            <button type="submit">${esc(t(locale, "Save"))}</button>
          </form>
        </td>
        <td>${
          row.targetId
            ? `<form method="post" action="${PREPACK_TARGETS_PATH}/${esc(row.targetId)}/delete">
            <input type="text" name="reason" required aria-label="${esc(t(locale, "Reason"))}">
            <button type="submit">${esc(t(locale, "Clear"))}</button>
          </form>`
            : ""
        }</td>
      </tr>`;
        })
        .join("")}
      </tbody>
    </table></div>`;
  return `<h1>${esc(t(locale, "Prepack targets"))}</h1>
    <p class="muted">${esc(t(locale, "The target for this strain, in pounds. One pound is 448 g."))}</p>
    ${add}
    ${table}`;
}
