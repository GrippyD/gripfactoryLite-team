/* The forecast model. Pure: compute(state) depends only on the reference data loaded by initReference()
   and the state passed in, so a past submission recalculates by passing its snapshot. No DOM, no storage. */
import type { Actuals, Basis, BuildDoc, BuildItem, BuildLine, DriverType, Drivers, GLDriver, LineStatus, Reference, Vol, VolBase } from "./types";

export const round2 = (x: number) => Math.round(x * 100) / 100;
const sumOf = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

/* ---------- Reference data (from the API, never baked into the page) ---------- */
export let BUS: string[] = [];
export let GLS: string[] = [];
/** GL → BU → budget, after normalization and restatements */
export let BUDGET: Record<string, Record<string, number>> = {};
export let SEASON: Record<string, number[]> = {};
export let VOL_DEFAULT: Vol;
export let BU_BY_CODE: Record<string, string> = {};
let DEF_VOL: Volumes;

/* ---------- GL normalization ---------- */
const ALIAS: Record<string, string> = {
  "5370 · fuel for equipment": "5370 · Fuel For Equipment",
  "6120 · municipal license expense": "6110 · State License Fee",
  "5640 · payroll taxes": "5610 · Hourly Wages",
};
const DISPLAY: Record<string, string> = {
  "6110 · State License Fee": "6110 + 6120 · Licensing (State + Municipal)",
  "5610 · Hourly Wages": "5610 + 5640 · Hourly Wages & Payroll Tax",
};
const canonMap: Record<string, string> = {};
function canon(g: string): string { const k = g.toLowerCase(); if (!canonMap[k]) canonMap[k] = g; return canonMap[k]; }
export function normGL(g: string): string { g = String(g).trim(); return ALIAS[g.toLowerCase()] || canon(g); }
/** GLs left out of the forecast entirely: budget, actuals and remaining */
export const EXCLUDED = new Set(["5570 · Rent", "5420 · Affiliated Purchases"]);
export const isExcluded = (g: string) => EXCLUDED.has(normGL(g));
export const glName = (g: string) => DISPLAY[g] || g;
export const budTot = (g: string) => sumOf(Object.values(BUDGET[g] || {}));
export const buCode = (bu: string) => bu.slice(0, 2);

export function initReference(ref: Reference): void {
  BUS = ref.bus.slice();
  BU_BY_CODE = Object.fromEntries(BUS.map(b => [buCode(b), b]));
  ref.gls.forEach(canon);
  BUDGET = {};
  for (const [g, row] of Object.entries(ref.budget)) {
    const n = normGL(g); BUDGET[n] = BUDGET[n] || {};
    for (const [bu, v] of Object.entries(row)) BUDGET[n][bu] = (BUDGET[n][bu] || 0) + v;
  }
  /* budget restatements: wages + payroll tax = Total W2 in SG&A; rent out; licensing all in SG&A */
  const W = "5610 · Hourly Wages"; if (BUDGET[W] && ref.wagesBudget) BUDGET[W] = { "12 SG&A": ref.wagesBudget };
  for (const g of EXCLUDED) delete BUDGET[g];
  const L = "6110 · State License Fee", lt = budTot(L); if (lt) BUDGET[L] = { "12 SG&A": lt };
  SEASON = ref.season || {};
  GLS = [...new Set(ref.gls.map(normGL))].filter(g => !EXCLUDED.has(g)).sort();
  VOL_DEFAULT = { ...ref.volDefault };
  DEF_VOL = volumesFrom(VOL_DEFAULT);
  for (const k of Object.keys(GLDEF)) delete GLDEF[k];
}
export function registerGL(g: string): void { if (EXCLUDED.has(g)) return; if (!GLS.includes(g)) { GLS.push(g); GLS.sort(); } }
export const registerActualGLs = (a: Actuals) =>
  [...new Set((a.rows || []).map(r => normGL(r[2])).filter(g => +g.slice(0, 4) >= 5000))].forEach(registerGL);
export const registerBuildGLs = (builds: Record<string, BuildDoc>) =>
  Object.values(builds).forEach(b => Object.keys(b.lines || {}).forEach(g => registerGL(normGL(g))));

export function groupOf(g: string): string {
  const n = +g.slice(0, 4);
  if (n < 5000) return "Revenue";
  if (n < 5200) return "Direct plant costs";
  if (n < 5300) return "Indirect plant costs";
  if (n < 5400) return "Equipment & facilities";
  if (n < 5500) return "Logistics";
  if (n < 5600) return "Utilities & rent";
  if (n < 5700) return "Labor";
  if (n < 5800) return "Benefits";
  return "SG&A";
}
export const GROUPS = ["Direct plant costs", "Indirect plant costs", "Equipment & facilities", "Logistics", "Utilities & rent", "Labor", "Benefits", "SG&A"];

/* ---------- Driver defaults ---------- */
export const DRIVER_TYPES: Record<DriverType, { label: string; unit: string }> = {
  plant: { label: "$ / plant", unit: "plant" },
  drylb: { label: "$ / dry lb", unit: "dry lb" },
  budlb: { label: "$ / bud lb", unit: "bud lb" },
  cart: { label: "$ / cart", unit: "cart" },
  none: { label: "Not linked", unit: "" },
};
const VOLT: DriverType[] = ["plant", "drylb", "budlb", "cart"];
const isLinked = (d: GLDriver) => VOLT.includes(d.type);
const BASIS: Record<Basis, string> = { runrate: "Run rate", budget: "Budget left", seasonal: "Prior-year pattern" };
const DEFAULT_BASIS: Record<string, Basis> = { "6110": "budget", "5610": "seasonal", "5220": "budget" };
/** single BU lines that start from budget left instead of the GL's own basis */
const BU_BASIS: Record<string, Basis> = { "5430 · Secured Transport|05 Post Harvest": "budget" };
const DEFAULT_TYPE: Record<string, DriverType> = {
  "5120": "plant", "5130": "plant", "5140": "plant", "5150": "plant", "5160": "plant", "5170": "plant", "5210": "plant", "5240": "plant", "5630": "plant", "5670": "plant",
  "5230": "drylb", "5430": "drylb", "5250": "budlb",
};

export interface Volumes {
  totalWet: number; totalDry: number; netDry: number;
  /** bud before shrink (dry × BTR), trim from the plant, bud shrunk to biomass */
  grossBud: number; trim: number; shrinkLbs: number;
  /** sellable dry lbs: all of the dry net of fresh frozen (shrink moves lbs from bud to biomass, it doesn't lose them) */
  adjDry: number;
  /** bud sold as flower, after shrink */
  bud: number;
  /** trim + shrunk bud: the biomass that goes to distillate */
  other: number;
  plants: number; carts: number;
}
/* Shrink = share of bud downgraded to biomass. It leaves bud (flower revenue) and joins trim in the distillate pool. */
export function volumesFrom(v: Vol): Volumes {
  const totalWet = v.plants * v.wetPerPlant, totalDry = totalWet * v.dryDown, ffDry = v.ffWet * v.dryDown;
  const netDry = Math.max(totalDry - ffDry, 0), grossBud = netDry * v.btr, trim = netDry - grossBud;
  const shrinkLbs = grossBud * Math.min(Math.max(+v.shrink || 0, 0), 1), bud = grossBud - shrinkLbs, other = trim + shrinkLbs;
  return { totalWet, totalDry, netDry, grossBud, trim, shrinkLbs, adjDry: netDry, bud, other, plants: v.plants, carts: v.carts };
}
function budgetRate(g: string, t: DriverType, vol: Volumes, carts: number): number {
  const base = ({ plant: vol.plants, drylb: vol.adjDry, budlb: vol.bud, cart: carts } as Record<string, number>)[t]; const b = budTot(g);
  return base && b ? round2(b / base) : 0;
}
export function defaultGL(g: string): GLDriver {
  const t: DriverType = budTot(g) ? (DEFAULT_TYPE[g.slice(0, 4)] || "none") : "none";
  return { type: t, rate: t === "none" ? 0 : budgetRate(g, t, DEF_VOL, VOL_DEFAULT.carts), basis: DEFAULT_BASIS[g.slice(0, 4)] || "runrate" };
}
/** starting point per GL (the saved drivers.gl is kept for the record; the model uses these defaults) */
const GLDEF: Record<string, GLDriver> = {};
export function defaults(): Drivers { const gl: Record<string, GLDriver> = {}; GLS.forEach(g => gl[g] = defaultGL(g)); return { vol: { ...VOL_DEFAULT }, gl }; }
export function mergeDrivers(d: Partial<Drivers> | null | undefined): Drivers {
  const def = defaults(); return { vol: { ...def.vol, ...(d && d.vol) }, gl: { ...def.gl, ...(d && d.gl) } };
}

/* ---------- Harvest clock ---------- */
export interface Clock { elapsed: number; remaining: number; startYear?: number; close?: Date }
export function clock(closeISO: string | null | undefined): Clock {
  if (!closeISO) return { elapsed: 0, remaining: 12 };
  const d = new Date(closeISO + "T00:00:00"); const y = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1;
  const elapsed = (d.getFullYear() - y) * 12 + d.getMonth() - 3 + 1, e = Math.min(Math.max(elapsed, 0), 12);
  return { elapsed: e, remaining: 12 - e, startYear: y, close: d };
}
export const MONTHS = ["Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar"];
export interface RemMonth { k: string; lbl: string; idx: number }
export function remMonths(ck: Clock): RemMonth[] {
  const out: RemMonth[] = [];
  for (let i = ck.elapsed; i < 12; i++) { const y = ck.startYear != null ? ck.startYear + (i >= 9 ? 1 : 0) : null; const m = (i + 3) % 12 + 1; out.push({ k: y ? `${y}-${String(m).padStart(2, "0")}` : "m" + i, lbl: MONTHS[i], idx: i }); }
  return out;
}

/* ---------- Items ---------- */
export const BASES: Record<VolBase, string> = { wet: "wet lbs", dry: "sellable dry lbs", bud: "bud lbs", trim: "trim / biomass lbs", prepack: "prepack lbs", plants: "plants" };
export type VolNow = Record<VolBase, number>;
export interface Window { start: string; end: string }
export const iso = (d: Date) => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
const pd = (x: string) => { const [y, m, d] = String(x).split("-").map(Number); return new Date(y, (m || 1) - 1, d || 1); };
export const itemQty = (it: BuildItem, vn: VolNow) => it.drv ? (vn[it.drv] || 0) * (it.share == null ? 1 : +it.share) / ((+(it.per || 0)) || 1) : (+(it.qty || 0) || 0);
export const itemTotal = (it: BuildItem, vn: VolNow) => itemQty(it, vn) * (+(it.cost || 0) || 0);
function windowFor(ck: Clock): Window {
  if (ck.close && ck.startYear != null) { const s0 = new Date(ck.close.getFullYear(), ck.close.getMonth() + 1, 1); return { start: iso(s0), end: iso(new Date(ck.startYear + 1, 2, 31)) }; }
  const now = new Date(), y = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  return { start: iso(new Date(y, 3, 1)), end: iso(new Date(y + 1, 2, 31)) };
}
export function itemRange(it: BuildItem, win: Window): [string, string] {
  if (it.start && it.end) { let a = it.start, b = it.end; if (b < a) [a, b] = [b, a]; return [a, b]; }
  if (it.month && /^\d{4}-\d{2}$/.test(it.month)) { const [y, m] = it.month.split("-").map(Number); return [iso(new Date(y, m - 1, 1)), iso(new Date(y, m, 0))]; }
  return [win.start, win.end];
}
/** spread an item's total across months by days of its date range that fall in the forecast window */
export function allocItem(it: BuildItem, ms: RemMonth[], M: Model): Record<string, number> {
  const t = itemTotal(it, M.volNow), out: Record<string, number> = Object.fromEntries(ms.map(m => [m.k, 0])); if (!ms.length) return out;
  const [a, b] = itemRange(it, M.win), A = pd(a), B = pd(b); let tot = 0; const days: Record<string, number> = {};
  for (const m of ms) {
    const [y, mo] = m.k.split("-").map(Number); if (!y) continue; const s0 = new Date(y, mo - 1, 1), e0 = new Date(y, mo, 0);
    const s1 = A > s0 ? A : s0, e1 = B < e0 ? B : e0; const d = e1 >= s1 ? Math.round((+e1 - +s1) / 864e5) + 1 : 0; days[m.k] = d; tot += d;
  }
  if (tot) ms.forEach(m => out[m.k] = t * (days[m.k] || 0) / tot); else ms.forEach(m => out[m.k] = t / ms.length);
  return out;
}
export const outsideWin = (it: BuildItem, win: Window) => { const [a, b] = itemRange(it, win); return b < win.start || a > win.end; };

/* ---------- Model ---------- */
export interface ModelState { drivers: Drivers; actuals: Actuals | null; builds: Record<string, BuildDoc> }
export interface Stream { k: string; name: string; qty: number; unit: string; price: number; on: boolean; rev: number }
export type Src = "driver" | "build" | "closed";
export interface BuRem { rem: number; drv: number; src: Src; basis: Basis | "unit" }
export interface Line {
  g: string; group: string; d: GLDriver; a: number; b: number; rr: number; driverAmt: number; basis: Basis | "unit"; vol: number; driverRem: number;
  rem: number; landing: number; varc: number; built: boolean; flags: [string, string][];
}
export interface Model {
  vol: Volumes; prepackLbs: number; bulkLbs: number; liters: number; cartL: number; wholesaleL: number; resinG: number;
  streams: Stream[]; revenue: number; lines: Line[]; cost: number; budget: number; actual: number; ck: Clock; revA: number; ebitda: number;
  buRem: Record<string, Record<string, BuRem>>; actBU: Record<string, Record<string, number>>;
  /** state this model was computed from */
  st: ModelState; volNow: VolNow; win: Window;
}

function actualsByGL(a: Actuals | null): Record<string, number> {
  const o: Record<string, number> = {}; if (!a) return o;
  for (const [, , g, amt] of a.rows) { if (+g.slice(0, 4) < 5000 || isExcluded(g)) continue; const n = normGL(g); o[n] = (o[n] || 0) + amt; }
  return o;
}
function actualsByGLBU(a: Actuals | null): Record<string, Record<string, number>> {
  const o: Record<string, Record<string, number>> = {}; if (!a) return o;
  for (const [, bu, g, amt] of a.rows) { if (+g.slice(0, 4) < 5000 || isExcluded(g)) continue; const n = normGL(g); (o[n] = o[n] || {}); o[n][bu] = (o[n][bu] || 0) + amt; }
  return o;
}
function revenueActual(a: Actuals | null): number { let t = 0; if (!a) return 0; for (const r of a.rows) if (+r[2].slice(0, 4) < 5000) t += r[3]; return t; }
function runRates(a: Actuals | null, ck: Clock): Record<string, number> {
  const o: Record<string, number> = {}; if (!a || !ck.close) return o;
  const A = actualsByGL(a), mon: Record<string, Record<string, number>> = {};
  for (const [g, m] of Object.entries(a.monthly || {})) { const n = normGL(g); mon[n] = mon[n] || {}; for (const [k, v] of Object.entries(m)) mon[n][k] = (mon[n][k] || 0) + v; }
  const last: string[] = []; for (let i = 0; i < 3; i++) { const d = new Date(ck.close.getFullYear(), ck.close.getMonth() - i, 1); last.push(d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0")); }
  for (const g of GLS) {
    if (mon[g]) o[g] = Math.max(last.reduce((s, k) => s + (mon[g][k] || 0), 0) / 3, 0);
    else o[g] = ck.elapsed ? Math.max((A[g] || 0) / ck.elapsed, 0) : 0;
  }
  return o;
}

export function compute(st: ModelState): Model {
  const v = st.drivers.vol, vol = volumesFrom(v);
  const prepackLbs = vol.bud * v.prepackPct, bulkLbs = vol.bud - prepackLbs;
  const liters = v.lbsPerLiter ? vol.other / v.lbsPerLiter : 0, cartL = v.carts * v.gPerCart / 1000, wholesaleL = Math.max(liters - cartL, 0);
  const resinG = v.ffWet * v.resinYield * 453.592 * v.resinSplit;
  const streams: Stream[] = ([
    { k: "bulk", name: "Bulk flower", qty: bulkLbs, unit: "lbs", price: v.bulkPrice, on: true },
    { k: "prepack", name: "Prepack flower", qty: prepackLbs, unit: "lbs", price: v.prepackPrice, on: true },
    { k: "carts", name: "Vape carts", qty: v.carts, unit: "units", price: v.cartPrice, on: true },
    { k: "disti", name: "Wholesale distillate", qty: wholesaleL, unit: "liters", price: v.literPrice, on: true },
    { k: "resin", name: "Live resin", qty: resinG, unit: "grams", price: v.resinPrice, on: true },
    { k: "prem", name: "Premium outdoor", qty: v.premLbs, unit: "lbs", price: v.premPrice, on: v.premOn },
    { k: "gh", name: "Greenhouse flower", qty: v.ghLbs, unit: "lbs", price: v.ghPrice, on: v.ghOn },
    { k: "ipr", name: "Infused prerolls", qty: v.iprUnits, unit: "units", price: v.iprPrice, on: v.iprOn },
    { k: "ib", name: "Infused bud", qty: v.ibLbs, unit: "lbs", price: v.ibPrice, on: v.ibOn },
    { k: "tps", name: "Third-party services", qty: 1, unit: "flat", price: v.tps, on: v.tpsOn },
  ] as Omit<Stream, "rev">[]).map(s => ({ ...s, rev: s.on ? s.qty * s.price : 0 }));
  const revenue = sumOf(streams.map(s => s.rev));
  const ck = clock(st.actuals?.closeDate), win = windowFor(ck);
  const volNow: VolNow = { wet: vol.totalWet, dry: vol.adjDry, bud: vol.bud, trim: vol.other, prepack: prepackLbs, plants: vol.plants };
  const A = actualsByGL(st.actuals), RR = runRates(st.actuals, ck);
  const vols: Record<string, number> = { plant: vol.plants, drylb: vol.adjDry, budlb: vol.bud, cart: v.carts };
  const lines: Line[] = [];
  for (const g of GLS) {
    if (EXCLUDED.has(g)) continue;
    const d = GLDEF[g] || (GLDEF[g] = defaultGL(g));
    const a = A[g] || 0, b = budTot(g), rr = RR[g] || 0;
    let driverAmt = 0, landing: number, basis: Basis | "unit";
    if (isLinked(d)) { basis = "unit"; driverAmt = (+d.rate || 0) * vols[d.type]; landing = Math.max(a, driverAmt); }
    else {
      basis = BASIS[d.basis] ? d.basis : (DEFAULT_BASIS[g.slice(0, 4)] || "runrate");
      if (basis === "seasonal" && SEASON[g] && ck.close) { const p = SEASON[g], e = ck.elapsed, ph = sumOf(p.slice(0, e)), pr = sumOf(p.slice(e)); landing = a + (ph ? pr * a / ph : 0); }
      else { if (basis === "seasonal") basis = "runrate"; landing = basis === "budget" ? Math.max(a, b) : a + rr * ck.remaining; }
    }
    lines.push({ g, group: groupOf(g), d, a, b, rr, driverAmt, basis, vol: isLinked(d) ? vols[d.type] : 0, driverRem: landing - a, rem: 0, landing: 0, varc: 0, built: false, flags: [] });
  }
  const L = applyBuilds(lines, st, volNow);
  const cost = sumOf(lines.map(l => l.landing)), budget = sumOf(lines.map(l => l.b)), actual = sumOf(lines.map(l => l.a));
  return { vol, prepackLbs, bulkLbs, liters, cartL, wholesaleL, resinG, streams, revenue, lines, cost, budget, actual, ck, revA: revenueActual(st.actuals), ebitda: revenue - cost, buRem: L.buRem, actBU: L.actBU, st, volNow, win };
}

function applyBuilds(lines: Line[], st: ModelState, volNow: VolNow) {
  const l0basis = (g: string) => { const l = lines.find(x => x.g === g); return l ? l.basis : "runrate"; };
  const actBU = actualsByGLBU(st.actuals), buRem: Record<string, Record<string, BuRem>> = {};
  for (const l of lines) {
    const bmix = BUDGET[l.g] || {}, amix = actBU[l.g] || {};
    const hasA = Object.values(amix).some(v => Math.abs(v) > 0.004), hasB = Object.keys(bmix).length > 0;
    const mix = (l.basis === "runrate" || l.basis === "seasonal") ? (hasA ? amix : bmix) : (hasB ? bmix : amix), tot = sumOf(Object.values(mix));
    const r: Record<string, BuRem> = buRem[l.g] = {};
    if (tot) for (const [bu, v] of Object.entries(mix)) r[bu] = { rem: l.driverRem * v / tot, drv: l.driverRem * v / tot, src: "driver", basis: l.basis };
    else if (Math.abs(l.driverRem) > 0.004) r["12 SG&A"] = { rem: l.driverRem, drv: l.driverRem, src: "driver", basis: l.basis };
    /* budget left works BU by BU: each BU spends what is left of its own budget */
    if (l.basis === "budget") {
      for (const k in r) delete r[k];
      for (const bu of new Set([...Object.keys(bmix), ...Object.keys(amix)])) { const x = Math.max((bmix[bu] || 0) - (amix[bu] || 0), 0); if (x > 0.004) r[bu] = { rem: x, drv: x, src: "driver", basis: "budget" }; }
    }
  }
  for (const [key, bs] of Object.entries(BU_BASIS)) {
    const [g, bu] = key.split("|"); if (bs !== "budget") continue;
    const x = Math.max(((BUDGET[g] || {})[bu] || 0) - ((actBU[g] || {})[bu] || 0), 0); (buRem[g] = buRem[g] || {})[bu] = { rem: x, drv: x, src: "driver", basis: "budget" };
  }
  for (const [code, doc] of Object.entries(st.builds)) {
    const bu = BU_BY_CODE[code]; if (!bu || !doc || !doc.lines) continue;
    for (const [g0, ln] of Object.entries(doc.lines)) {
      if (isExcluded(g0)) continue;
      const g = normGL(g0); const r = buRem[g] = buRem[g] || {}; const e = r[bu] = r[bu] || { rem: 0, drv: 0, src: "driver", basis: l0basis(g) };
      if (ln.status === "closed") { e.rem = 0; e.src = "closed"; }
      else if (ln.items && ln.items.length) { e.rem = sumOf(ln.items.map(it => itemTotal(it, volNow))); e.src = "build"; }
    }
  }
  /* Every dollar of remaining comes from an item: a BU line without items forecasts nothing more (lands at actual).
     Its starting point is still computed (drv) so the screen can offer it as an item. */
  for (const r of Object.values(buRem)) for (const e of Object.values(r)) if (e.src === "driver") e.rem = 0;
  for (const l of lines) {
    const r = buRem[l.g] || {}; l.rem = sumOf(Object.values(r).map(e => e.rem)); l.landing = l.a + l.rem; l.varc = l.b - l.landing;
    l.built = Object.values(r).filter(e => e.src !== "driver").length > 0;
    const f: [string, string][] = [];
    if (!l.b && l.landing > 0) f.push(["Unbudgeted", "warn"]);
    if (l.b && l.a > l.b) f.push(["Spent > budget", "over"]);
    if (l.basis === "unit" && l.a > l.driverAmt && l.driverAmt > 0) f.push(["Actual > unit cost", "over"]);
    if (l.rr > 1000 && l.rem < 1 && !l.built) f.push(["Active, no forecast", "warn"]);
    if (l.built) f.push(["Built by BU", "neutral"]);
    l.flags = f;
  }
  return { buRem, actBU };
}

export interface BuRow { bu: string; b: number; a: number; rem: number; built: number; landing: number; varc: number }
export function buTable(M: Model): BuRow[] {
  const rows: Record<string, Omit<BuRow, "landing" | "varc">> = {}; BUS.forEach(b => rows[b] = { bu: b, b: 0, a: 0, rem: 0, built: 0 });
  const row = (bu: string) => rows[bu] = rows[bu] || { bu, b: 0, a: 0, rem: 0, built: 0 };
  for (const r of Object.values(BUDGET)) for (const [bu, v] of Object.entries(r)) if (rows[bu]) rows[bu].b += v;
  for (const r of Object.values(M.actBU)) for (const [bu, v] of Object.entries(r)) row(bu).a += v;
  for (const r of Object.values(M.buRem)) for (const [bu, e] of Object.entries(r)) { const x = row(bu); x.rem += e.rem; if (e.src !== "driver") x.built += e.rem; }
  return Object.values(rows).map(r => ({ ...r, landing: r.a + r.rem, varc: r.b - r.a - r.rem }));
}

export interface BLine {
  g: string; i: number; ln: BuildLine | null; b: number; a: number; rem: number; drv: number; src: Src; basis: Basis | "unit";
  landing: number; varc: number; needReason: boolean; status: LineStatus; hasReason: boolean; bu?: string;
}
export function buLines(M: Model, bu: string): BLine[] {
  const code = buCode(bu), doc = M.st.builds[code] || { lines: {} }, set = new Set<string>();
  for (const [g, row] of Object.entries(BUDGET)) if (row[bu]) set.add(g);
  for (const [g, row] of Object.entries(M.actBU)) if (Math.abs(row[bu] || 0) > 0.004) set.add(g);
  for (const [g, row] of Object.entries(M.buRem)) if (row[bu] && (Math.abs(row[bu].rem) > 0.5 || Math.abs(row[bu].drv) > 0.5)) set.add(g);
  for (const g of Object.keys(doc.lines || {})) if (!isExcluded(g)) set.add(normGL(g));
  const l0 = (g: string) => { const l = M.lines.find(x => x.g === g); return l ? l.basis : "runrate"; };
  return [...set].sort().map((g, i) => {
    const ln = (doc.lines || {})[g] || null, e = (M.buRem[g] || {})[bu] || { rem: 0, drv: 0, src: "driver" as Src, basis: undefined };
    const b = (BUDGET[g] || {})[bu] || 0, a = (M.actBU[g] || {})[bu] || 0, landing = a + e.rem, varc = b - landing;
    const needReason = Math.abs(varc) > 10000 && (!b || Math.abs(varc) / b > 0.10);
    const status: LineStatus = ln && ln.status ? ln.status : (ln && ln.items && ln.items.length ? "inprogress" : "notstarted");
    return { g, i, ln, b, a, rem: e.rem, drv: e.drv || 0, src: e.src, basis: e.basis || l0(g), landing, varc, needReason, status, hasReason: !!(ln && ln.reason && ln.reason.trim()) };
  });
}
export function buMonthly(M: Model, rows: BLine[]): (RemMonth & { v: number })[] {
  const ms = remMonths(M.ck), o: Record<string, number> = Object.fromEntries(ms.map(m => [m.k, 0])), n = ms.length || 1;
  for (const r of rows) {
    if (r.src === "closed") continue;
    if (r.src === "build" && r.ln) { for (const it of r.ln.items) { const a = allocItem(it, ms, M); for (const k in a) o[k] += a[k]; } }
    else if (r.basis === "seasonal" && SEASON[r.g]) { const w = ms.map(m => SEASON[r.g][m.idx] || 0), tw = sumOf(w) || 1; ms.forEach((m, j) => o[m.k] += r.rem * w[j] / tw); }
    else ms.forEach(m => o[m.k] += r.rem / n);
  }
  return ms.map(m => ({ ...m, v: o[m.k] }));
}
export interface AllRow { g: string; b: number; a: number; rem: number; landing: number; varc: number; bus: BLine[]; built: number; closed: number; needs: number }
export function allLines(M: Model): { rows: AllRow[]; flat: BLine[] } {
  const by: Record<string, AllRow> = {}, flat: BLine[] = [];
  for (const bu of BUS) {
    for (const r of buLines(M, bu)) {
      const rb = { ...r, bu }; flat.push(rb);
      const x = by[r.g] = by[r.g] || { g: r.g, b: 0, a: 0, rem: 0, landing: 0, varc: 0, bus: [], built: 0, closed: 0, needs: 0 };
      x.b += r.b; x.a += r.a; x.rem += r.rem; x.landing += r.landing; x.varc += r.varc; x.bus.push(rb);
      if (r.src === "build") x.built++; if (r.src === "closed") x.closed++; if (r.needReason && !r.hasReason && r.status !== "closed") x.needs++;
    }
  }
  return { rows: Object.values(by).sort((a, b) => a.g.localeCompare(b.g)), flat };
}
