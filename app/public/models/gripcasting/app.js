var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res, err) => function __init() {
  if (err) throw err[0];
  try {
    return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
  } catch (e) {
    throw err = [e], e;
  }
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// sheetjs-cdn:xlsx
var xlsx_exports = {};
__export(xlsx_exports, {
  read: () => read,
  utils: () => utils,
  write: () => write
});
function loadSheetJs() {
  const host = globalThis;
  if (host.XLSX) return Promise.resolve(host.XLSX);
  if (!ready) {
    ready = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
      script.onload = () => host.XLSX ? resolve(host.XLSX) : reject(new Error("SheetJS did not load."));
      script.onerror = () => reject(new Error("SheetJS did not load."));
      document.head.appendChild(script);
    });
  }
  return ready;
}
var ready, XLSX, read, write, utils;
var init_xlsx = __esm({
  async "sheetjs-cdn:xlsx"() {
    XLSX = await loadSheetJs();
    read = XLSX.read.bind(XLSX);
    write = XLSX.write.bind(XLSX);
    utils = XLSX.utils;
  }
});

// src/gripcasting/model.ts
var round2 = (x) => Math.round(x * 100) / 100;
var sumOf = (xs) => xs.reduce((a, b) => a + b, 0);
var BUS = [];
var GLS = [];
var BUDGET = {};
var SEASON = {};
var VOL_DEFAULT;
var BU_BY_CODE = {};
var DEF_VOL;
var ALIAS = {
  "5370 \xB7 fuel for equipment": "5370 \xB7 Fuel For Equipment",
  "6120 \xB7 municipal license expense": "6110 \xB7 State License Fee",
  "5640 \xB7 payroll taxes": "5610 \xB7 Hourly Wages"
};
var DISPLAY = {
  "6110 \xB7 State License Fee": "6110 + 6120 \xB7 Licensing (State + Municipal)",
  "5610 \xB7 Hourly Wages": "5610 + 5640 \xB7 Hourly Wages & Payroll Tax"
};
var canonMap = {};
function canon(g) {
  const k = g.toLowerCase();
  if (!canonMap[k]) canonMap[k] = g;
  return canonMap[k];
}
function normGL(g) {
  g = String(g).trim();
  return ALIAS[g.toLowerCase()] || canon(g);
}
var EXCLUDED = /* @__PURE__ */ new Set(["5570 \xB7 Rent", "5420 \xB7 Affiliated Purchases"]);
var isExcluded = (g) => EXCLUDED.has(normGL(g));
var glName = (g) => DISPLAY[g] || g;
var budTot = (g) => sumOf(Object.values(BUDGET[g] || {}));
var buCode = (bu) => bu.slice(0, 2);
function initReference(ref) {
  BUS = ref.bus.slice();
  BU_BY_CODE = Object.fromEntries(BUS.map((b) => [buCode(b), b]));
  ref.gls.forEach(canon);
  BUDGET = {};
  for (const [g, row] of Object.entries(ref.budget)) {
    const n = normGL(g);
    BUDGET[n] = BUDGET[n] || {};
    for (const [bu, v] of Object.entries(row)) BUDGET[n][bu] = (BUDGET[n][bu] || 0) + v;
  }
  const W = "5610 \xB7 Hourly Wages";
  if (BUDGET[W] && ref.wagesBudget) BUDGET[W] = { "12 SG&A": ref.wagesBudget };
  for (const g of EXCLUDED) delete BUDGET[g];
  const L = "6110 \xB7 State License Fee", lt = budTot(L);
  if (lt) BUDGET[L] = { "12 SG&A": lt };
  SEASON = ref.season || {};
  GLS = [...new Set(ref.gls.map(normGL))].filter((g) => !EXCLUDED.has(g)).sort();
  VOL_DEFAULT = { ...ref.volDefault };
  DEF_VOL = volumesFrom(VOL_DEFAULT);
  for (const k of Object.keys(GLDEF)) delete GLDEF[k];
}
function registerGL(g) {
  if (EXCLUDED.has(g)) return;
  if (!GLS.includes(g)) {
    GLS.push(g);
    GLS.sort();
  }
}
var registerActualGLs = (a) => [...new Set((a.rows || []).map((r) => normGL(r[2])).filter((g) => +g.slice(0, 4) >= 5e3))].forEach(registerGL);
var registerBuildGLs = (builds) => Object.values(builds).forEach((b) => Object.keys(b.lines || {}).forEach((g) => registerGL(normGL(g))));
function groupOf(g) {
  const n = +g.slice(0, 4);
  if (n < 5e3) return "Revenue";
  if (n < 5200) return "Direct plant costs";
  if (n < 5300) return "Indirect plant costs";
  if (n < 5400) return "Equipment & facilities";
  if (n < 5500) return "Logistics";
  if (n < 5600) return "Utilities & rent";
  if (n < 5700) return "Labor";
  if (n < 5800) return "Benefits";
  return "SG&A";
}
var GROUPS = ["Direct plant costs", "Indirect plant costs", "Equipment & facilities", "Logistics", "Utilities & rent", "Labor", "Benefits", "SG&A"];
var DRIVER_TYPES = {
  plant: { label: "$ / plant", unit: "plant" },
  drylb: { label: "$ / dry lb", unit: "dry lb" },
  budlb: { label: "$ / bud lb", unit: "bud lb" },
  cart: { label: "$ / cart", unit: "cart" },
  none: { label: "Not linked", unit: "" }
};
var VOLT = ["plant", "drylb", "budlb", "cart"];
var isLinked = (d) => VOLT.includes(d.type);
var BASIS = { runrate: "Run rate", budget: "Budget left", seasonal: "Prior-year pattern" };
var DEFAULT_BASIS = { "6110": "budget", "5610": "seasonal", "5220": "budget" };
var BU_BASIS = { "5430 \xB7 Secured Transport|05 Post Harvest": "budget" };
var DEFAULT_TYPE = {
  "5120": "plant",
  "5130": "plant",
  "5140": "plant",
  "5150": "plant",
  "5160": "plant",
  "5170": "plant",
  "5210": "plant",
  "5240": "plant",
  "5630": "plant",
  "5670": "plant",
  "5230": "drylb",
  "5430": "drylb",
  "5250": "budlb"
};
function volumesFrom(v) {
  const totalWet = v.plants * v.wetPerPlant, totalDry = totalWet * v.dryDown, ffDry = v.ffWet * v.dryDown;
  const netDry = Math.max(totalDry - ffDry, 0), grossBud = netDry * v.btr, trim = netDry - grossBud;
  const shrinkLbs = grossBud * Math.min(Math.max(+v.shrink || 0, 0), 1), bud = grossBud - shrinkLbs, other = trim + shrinkLbs;
  return { totalWet, totalDry, netDry, grossBud, trim, shrinkLbs, adjDry: netDry, bud, other, plants: v.plants, carts: v.carts };
}
function budgetRate(g, t, vol, carts) {
  const base = { plant: vol.plants, drylb: vol.adjDry, budlb: vol.bud, cart: carts }[t];
  const b = budTot(g);
  return base && b ? round2(b / base) : 0;
}
function defaultGL(g) {
  const t = budTot(g) ? DEFAULT_TYPE[g.slice(0, 4)] || "none" : "none";
  return { type: t, rate: t === "none" ? 0 : budgetRate(g, t, DEF_VOL, VOL_DEFAULT.carts), basis: DEFAULT_BASIS[g.slice(0, 4)] || "runrate" };
}
var GLDEF = {};
function defaults() {
  const gl = {};
  GLS.forEach((g) => gl[g] = defaultGL(g));
  return { vol: { ...VOL_DEFAULT }, gl };
}
function mergeDrivers(d) {
  const def = defaults();
  return { vol: { ...def.vol, ...d && d.vol }, gl: { ...def.gl, ...d && d.gl } };
}
function clock(closeISO) {
  if (!closeISO) return { elapsed: 0, remaining: 12 };
  const d = /* @__PURE__ */ new Date(closeISO + "T00:00:00");
  const y = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1;
  const elapsed = (d.getFullYear() - y) * 12 + d.getMonth() - 3 + 1, e = Math.min(Math.max(elapsed, 0), 12);
  return { elapsed: e, remaining: 12 - e, startYear: y, close: d };
}
var MONTHS = ["Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar"];
function remMonths(ck) {
  const out = [];
  for (let i = ck.elapsed; i < 12; i++) {
    const y = ck.startYear != null ? ck.startYear + (i >= 9 ? 1 : 0) : null;
    const m = (i + 3) % 12 + 1;
    out.push({ k: y ? `${y}-${String(m).padStart(2, "0")}` : "m" + i, lbl: MONTHS[i], idx: i });
  }
  return out;
}
var BASES = { wet: "wet lbs", dry: "sellable dry lbs", bud: "bud lbs", trim: "trim / biomass lbs", prepack: "prepack lbs", plants: "plants" };
var iso = (d) => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
var pd = (x) => {
  const [y, m, d] = String(x).split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
};
var itemQty = (it, vn) => it.drv ? (vn[it.drv] || 0) * (it.share == null ? 1 : +it.share) / (+(it.per || 0) || 1) : +(it.qty || 0) || 0;
var itemTotal = (it, vn) => itemQty(it, vn) * (+(it.cost || 0) || 0);
function windowFor(ck) {
  if (ck.close && ck.startYear != null) {
    const s0 = new Date(ck.close.getFullYear(), ck.close.getMonth() + 1, 1);
    return { start: iso(s0), end: iso(new Date(ck.startYear + 1, 2, 31)) };
  }
  const now = /* @__PURE__ */ new Date(), y = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  return { start: iso(new Date(y, 3, 1)), end: iso(new Date(y + 1, 2, 31)) };
}
function itemRange(it, win) {
  if (it.start && it.end) {
    let a = it.start, b = it.end;
    if (b < a) [a, b] = [b, a];
    return [a, b];
  }
  if (it.month && /^\d{4}-\d{2}$/.test(it.month)) {
    const [y, m] = it.month.split("-").map(Number);
    return [iso(new Date(y, m - 1, 1)), iso(new Date(y, m, 0))];
  }
  return [win.start, win.end];
}
function allocItem(it, ms, M2) {
  const t = itemTotal(it, M2.volNow), out = Object.fromEntries(ms.map((m) => [m.k, 0]));
  if (!ms.length) return out;
  const [a, b] = itemRange(it, M2.win), A = pd(a), B = pd(b);
  let tot = 0;
  const days = {};
  for (const m of ms) {
    const [y, mo] = m.k.split("-").map(Number);
    if (!y) continue;
    const s0 = new Date(y, mo - 1, 1), e0 = new Date(y, mo, 0);
    const s1 = A > s0 ? A : s0, e1 = B < e0 ? B : e0;
    const d = e1 >= s1 ? Math.round((+e1 - +s1) / 864e5) + 1 : 0;
    days[m.k] = d;
    tot += d;
  }
  if (tot) ms.forEach((m) => out[m.k] = t * (days[m.k] || 0) / tot);
  else ms.forEach((m) => out[m.k] = t / ms.length);
  return out;
}
var outsideWin = (it, win) => {
  const [a, b] = itemRange(it, win);
  return b < win.start || a > win.end;
};
function actualsByGL(a) {
  const o = {};
  if (!a) return o;
  for (const [, , g, amt] of a.rows) {
    if (+g.slice(0, 4) < 5e3 || isExcluded(g)) continue;
    const n = normGL(g);
    o[n] = (o[n] || 0) + amt;
  }
  return o;
}
function actualsByGLBU(a) {
  const o = {};
  if (!a) return o;
  for (const [, bu, g, amt] of a.rows) {
    if (+g.slice(0, 4) < 5e3 || isExcluded(g)) continue;
    const n = normGL(g);
    o[n] = o[n] || {};
    o[n][bu] = (o[n][bu] || 0) + amt;
  }
  return o;
}
function revenueActual(a) {
  let t = 0;
  if (!a) return 0;
  for (const r of a.rows) if (+r[2].slice(0, 4) < 5e3) t += r[3];
  return t;
}
function runRates(a, ck) {
  const o = {};
  if (!a || !ck.close) return o;
  const A = actualsByGL(a), mon = {};
  for (const [g, m] of Object.entries(a.monthly || {})) {
    const n = normGL(g);
    mon[n] = mon[n] || {};
    for (const [k, v] of Object.entries(m)) mon[n][k] = (mon[n][k] || 0) + v;
  }
  const last = [];
  for (let i = 0; i < 3; i++) {
    const d = new Date(ck.close.getFullYear(), ck.close.getMonth() - i, 1);
    last.push(d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0"));
  }
  for (const g of GLS) {
    if (mon[g]) o[g] = Math.max(last.reduce((s, k) => s + (mon[g][k] || 0), 0) / 3, 0);
    else o[g] = ck.elapsed ? Math.max((A[g] || 0) / ck.elapsed, 0) : 0;
  }
  return o;
}
function compute(st) {
  const v = st.drivers.vol, vol = volumesFrom(v);
  const prepackLbs = vol.bud * v.prepackPct, bulkLbs = vol.bud - prepackLbs;
  const liters = v.lbsPerLiter ? vol.other / v.lbsPerLiter : 0, cartL = v.carts * v.gPerCart / 1e3, wholesaleL = Math.max(liters - cartL, 0);
  const resinG = v.ffWet * v.resinYield * 453.592 * v.resinSplit;
  const streams = [
    { k: "bulk", name: "Bulk flower", qty: bulkLbs, unit: "lbs", price: v.bulkPrice, on: true },
    { k: "prepack", name: "Prepack flower", qty: prepackLbs, unit: "lbs", price: v.prepackPrice, on: true },
    { k: "carts", name: "Vape carts", qty: v.carts, unit: "units", price: v.cartPrice, on: true },
    { k: "disti", name: "Wholesale distillate", qty: wholesaleL, unit: "liters", price: v.literPrice, on: true },
    { k: "resin", name: "Live resin", qty: resinG, unit: "grams", price: v.resinPrice, on: true },
    { k: "prem", name: "Premium outdoor", qty: v.premLbs, unit: "lbs", price: v.premPrice, on: v.premOn },
    { k: "gh", name: "Greenhouse flower", qty: v.ghLbs, unit: "lbs", price: v.ghPrice, on: v.ghOn },
    { k: "ipr", name: "Infused prerolls", qty: v.iprUnits, unit: "units", price: v.iprPrice, on: v.iprOn },
    { k: "ib", name: "Infused bud", qty: v.ibLbs, unit: "lbs", price: v.ibPrice, on: v.ibOn },
    { k: "tps", name: "Third-party services", qty: 1, unit: "flat", price: v.tps, on: v.tpsOn }
  ].map((s) => ({ ...s, rev: s.on ? s.qty * s.price : 0 }));
  const revenue = sumOf(streams.map((s) => s.rev));
  const ck = clock(st.actuals?.closeDate), win = windowFor(ck);
  const volNow = { wet: vol.totalWet, dry: vol.adjDry, bud: vol.bud, trim: vol.other, prepack: prepackLbs, plants: vol.plants };
  const A = actualsByGL(st.actuals), RR = runRates(st.actuals, ck);
  const vols = { plant: vol.plants, drylb: vol.adjDry, budlb: vol.bud, cart: v.carts };
  const lines = [];
  for (const g of GLS) {
    if (EXCLUDED.has(g)) continue;
    const d = GLDEF[g] || (GLDEF[g] = defaultGL(g));
    const a = A[g] || 0, b = budTot(g), rr = RR[g] || 0;
    let driverAmt = 0, landing, basis;
    if (isLinked(d)) {
      basis = "unit";
      driverAmt = (+d.rate || 0) * vols[d.type];
      landing = Math.max(a, driverAmt);
    } else {
      basis = BASIS[d.basis] ? d.basis : DEFAULT_BASIS[g.slice(0, 4)] || "runrate";
      if (basis === "seasonal" && SEASON[g] && ck.close) {
        const p = SEASON[g], e = ck.elapsed, ph = sumOf(p.slice(0, e)), pr = sumOf(p.slice(e));
        landing = a + (ph ? pr * a / ph : 0);
      } else {
        if (basis === "seasonal") basis = "runrate";
        landing = basis === "budget" ? Math.max(a, b) : a + rr * ck.remaining;
      }
    }
    lines.push({ g, group: groupOf(g), d, a, b, rr, driverAmt, basis, vol: isLinked(d) ? vols[d.type] : 0, driverRem: landing - a, rem: 0, landing: 0, varc: 0, built: false, flags: [] });
  }
  const L = applyBuilds(lines, st, volNow);
  const cost = sumOf(lines.map((l) => l.landing)), budget = sumOf(lines.map((l) => l.b)), actual = sumOf(lines.map((l) => l.a));
  return { vol, prepackLbs, bulkLbs, liters, cartL, wholesaleL, resinG, streams, revenue, lines, cost, budget, actual, ck, revA: revenueActual(st.actuals), ebitda: revenue - cost, buRem: L.buRem, actBU: L.actBU, st, volNow, win };
}
function applyBuilds(lines, st, volNow) {
  const l0basis = (g) => {
    const l = lines.find((x) => x.g === g);
    return l ? l.basis : "runrate";
  };
  const actBU = actualsByGLBU(st.actuals), buRem = {};
  for (const l of lines) {
    const bmix = BUDGET[l.g] || {}, amix = actBU[l.g] || {};
    const hasA = Object.values(amix).some((v) => Math.abs(v) > 4e-3), hasB = Object.keys(bmix).length > 0;
    const mix = l.basis === "runrate" || l.basis === "seasonal" ? hasA ? amix : bmix : hasB ? bmix : amix, tot = sumOf(Object.values(mix));
    const r = buRem[l.g] = {};
    if (tot) for (const [bu, v] of Object.entries(mix)) r[bu] = { rem: l.driverRem * v / tot, drv: l.driverRem * v / tot, src: "driver", basis: l.basis };
    else if (Math.abs(l.driverRem) > 4e-3) r["12 SG&A"] = { rem: l.driverRem, drv: l.driverRem, src: "driver", basis: l.basis };
    if (l.basis === "budget") {
      for (const k in r) delete r[k];
      for (const bu of /* @__PURE__ */ new Set([...Object.keys(bmix), ...Object.keys(amix)])) {
        const x = Math.max((bmix[bu] || 0) - (amix[bu] || 0), 0);
        if (x > 4e-3) r[bu] = { rem: x, drv: x, src: "driver", basis: "budget" };
      }
    }
  }
  for (const [key, bs] of Object.entries(BU_BASIS)) {
    const [g, bu] = key.split("|");
    if (bs !== "budget") continue;
    const x = Math.max(((BUDGET[g] || {})[bu] || 0) - ((actBU[g] || {})[bu] || 0), 0);
    (buRem[g] = buRem[g] || {})[bu] = { rem: x, drv: x, src: "driver", basis: "budget" };
  }
  for (const [code, doc] of Object.entries(st.builds)) {
    const bu = BU_BY_CODE[code];
    if (!bu || !doc || !doc.lines) continue;
    for (const [g0, ln] of Object.entries(doc.lines)) {
      if (isExcluded(g0)) continue;
      const g = normGL(g0);
      const r = buRem[g] = buRem[g] || {};
      const e = r[bu] = r[bu] || { rem: 0, drv: 0, src: "driver", basis: l0basis(g) };
      if (ln.status === "closed") {
        e.rem = 0;
        e.src = "closed";
      } else if (ln.items && ln.items.length) {
        e.rem = sumOf(ln.items.map((it) => itemTotal(it, volNow)));
        e.src = "build";
      }
    }
  }
  for (const r of Object.values(buRem)) for (const e of Object.values(r)) if (e.src === "driver") e.rem = 0;
  for (const l of lines) {
    const r = buRem[l.g] || {};
    l.rem = sumOf(Object.values(r).map((e) => e.rem));
    l.landing = l.a + l.rem;
    l.varc = l.b - l.landing;
    l.built = Object.values(r).filter((e) => e.src !== "driver").length > 0;
    const f = [];
    if (!l.b && l.landing > 0) f.push(["Unbudgeted", "warn"]);
    if (l.b && l.a > l.b) f.push(["Spent > budget", "over"]);
    if (l.basis === "unit" && l.a > l.driverAmt && l.driverAmt > 0) f.push(["Actual > unit cost", "over"]);
    if (l.rr > 1e3 && l.rem < 1 && !l.built) f.push(["Active, no forecast", "warn"]);
    if (l.built) f.push(["Built by BU", "neutral"]);
    l.flags = f;
  }
  return { buRem, actBU };
}
function buTable(M2) {
  const rows = {};
  BUS.forEach((b) => rows[b] = { bu: b, b: 0, a: 0, rem: 0, built: 0 });
  const row = (bu) => rows[bu] = rows[bu] || { bu, b: 0, a: 0, rem: 0, built: 0 };
  for (const r of Object.values(BUDGET)) for (const [bu, v] of Object.entries(r)) if (rows[bu]) rows[bu].b += v;
  for (const r of Object.values(M2.actBU)) for (const [bu, v] of Object.entries(r)) row(bu).a += v;
  for (const r of Object.values(M2.buRem)) for (const [bu, e] of Object.entries(r)) {
    const x = row(bu);
    x.rem += e.rem;
    if (e.src !== "driver") x.built += e.rem;
  }
  return Object.values(rows).map((r) => ({ ...r, landing: r.a + r.rem, varc: r.b - r.a - r.rem }));
}
function buLines(M2, bu) {
  const code = buCode(bu), doc = M2.st.builds[code] || { lines: {} }, set = /* @__PURE__ */ new Set();
  for (const [g, row] of Object.entries(BUDGET)) if (row[bu]) set.add(g);
  for (const [g, row] of Object.entries(M2.actBU)) if (Math.abs(row[bu] || 0) > 4e-3) set.add(g);
  for (const [g, row] of Object.entries(M2.buRem)) if (row[bu] && (Math.abs(row[bu].rem) > 0.5 || Math.abs(row[bu].drv) > 0.5)) set.add(g);
  for (const g of Object.keys(doc.lines || {})) if (!isExcluded(g)) set.add(normGL(g));
  const l0 = (g) => {
    const l = M2.lines.find((x) => x.g === g);
    return l ? l.basis : "runrate";
  };
  return [...set].sort().map((g, i) => {
    const ln = (doc.lines || {})[g] || null, e = (M2.buRem[g] || {})[bu] || { rem: 0, drv: 0, src: "driver", basis: void 0 };
    const b = (BUDGET[g] || {})[bu] || 0, a = (M2.actBU[g] || {})[bu] || 0, landing = a + e.rem, varc = b - landing;
    const needReason = Math.abs(varc) > 1e4 && (!b || Math.abs(varc) / b > 0.1);
    const status = ln && ln.status ? ln.status : ln && ln.items && ln.items.length ? "inprogress" : "notstarted";
    return { g, i, ln, b, a, rem: e.rem, drv: e.drv || 0, src: e.src, basis: e.basis || l0(g), landing, varc, needReason, status, hasReason: !!(ln && ln.reason && ln.reason.trim()) };
  });
}
function buMonthly(M2, rows) {
  const ms = remMonths(M2.ck), o = Object.fromEntries(ms.map((m) => [m.k, 0])), n = ms.length || 1;
  for (const r of rows) {
    if (r.src === "closed") continue;
    if (r.src === "build" && r.ln) {
      for (const it of r.ln.items) {
        const a = allocItem(it, ms, M2);
        for (const k in a) o[k] += a[k];
      }
    } else if (r.basis === "seasonal" && SEASON[r.g]) {
      const w = ms.map((m) => SEASON[r.g][m.idx] || 0), tw = sumOf(w) || 1;
      ms.forEach((m, j) => o[m.k] += r.rem * w[j] / tw);
    } else ms.forEach((m) => o[m.k] += r.rem / n);
  }
  return ms.map((m) => ({ ...m, v: o[m.k] }));
}
function allLines(M2) {
  const by = {}, flat = [];
  for (const bu of BUS) {
    for (const r of buLines(M2, bu)) {
      const rb = { ...r, bu };
      flat.push(rb);
      const x = by[r.g] = by[r.g] || { g: r.g, b: 0, a: 0, rem: 0, landing: 0, varc: 0, bus: [], built: 0, closed: 0, needs: 0 };
      x.b += r.b;
      x.a += r.a;
      x.rem += r.rem;
      x.landing += r.landing;
      x.varc += r.varc;
      x.bus.push(rb);
      if (r.src === "build") x.built++;
      if (r.src === "closed") x.closed++;
      if (r.needReason && !r.hasReason && r.status !== "closed") x.needs++;
    }
  }
  return { rows: Object.values(by).sort((a, b) => a.g.localeCompare(b.g)), flat };
}

// vendor/gripcasting/src/web/api.ts
var ApiError = class extends Error {
  constructor(code, message, status = 0) {
    super(message);
    this.code = code;
    this.status = status;
  }
  code;
  status;
};
var CODES = { 400: "invalid", 401: "unauthenticated", 403: "forbidden", 404: "not_found", 409: "conflict", 422: "invalid" };
async function call(method, path, body) {
  let res;
  try {
    res = await fetch("/models/gripcasting/api/" + path, {
      method,
      credentials: "same-origin",
      headers: body === void 0 ? {} : { "content-type": "application/json" },
      body: body === void 0 ? void 0 : JSON.stringify(body)
    });
  } catch (e) {
    throw new ApiError("failed", "Couldn't reach the server.");
  }
  if (!res.ok) {
    let msg = res.statusText;
    try {
      const j = await res.json();
      if (j.error) msg = j.error;
    } catch {
    }
    throw new ApiError(CODES[res.status] || "failed", msg, res.status);
  }
  return res.status === 204 ? void 0 : await res.json();
}
var api = {
  me: () => call("GET", "me"),
  reference: () => call("GET", "reference"),
  state: () => call("GET", "state"),
  /** optimistic lock: version = updated_at as loaded; 409 conflict when someone saved in between */
  saveDrivers: (drivers, version) => call("PUT", "drivers", { drivers, version }),
  saveBuild: (code, doc, version) => call("PUT", "builds/" + encodeURIComponent(code), { doc, version }),
  uploadActuals: (body) => call("POST", "actuals", body),
  actuals: (closeDate) => call("GET", "actuals/" + encodeURIComponent(closeDate)),
  transactions: () => call("GET", "transactions"),
  submit: (body) => call("POST", "submissions", body),
  snapshot: (id) => call("GET", "submissions/" + encodeURIComponent(id) + "/snapshot")
};
var SaveQueue = class {
  constructor(version, send) {
    this.version = version;
    this.send = send;
  }
  version;
  send;
  chain = Promise.resolve();
  save(value) {
    const run = this.chain.then(async () => {
      this.version = await this.send(value, this.version);
    });
    this.chain = run.catch(() => void 0);
    return run;
  }
};

// vendor/gripcasting/src/web/format.ts
var nf0 = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
var nf2 = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });
var usd2 = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });
var money = (x) => (x < 0 ? "(" : "") + nf0.format(Math.abs(Math.round(x))) + (x < 0 ? ")" : "");
var dash = (x) => Math.abs(x) < 0.5 ? "\u2013" : money(x);
function big(x) {
  const a = Math.abs(x), s = x < 0 ? "\u2212" : "";
  if (a >= 1e6) return s + "$" + (a / 1e6).toFixed(a >= 1e7 ? 1 : 2) + "M";
  if (a >= 1e3) return s + "$" + Math.round(a / 1e3) + "K";
  return s + "$" + Math.round(a);
}
var pct = (x) => Math.abs(x) < 5e-4 ? "0%" : (x * 100).toFixed(Math.abs(x) < 0.1 ? 1 : 0) + "%";
function esc(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
}
function parseNum(s) {
  s = String(s).replace(/[$,\s]/g, "");
  if (s.endsWith("%")) return parseFloat(s) / 100;
  const n = parseFloat(s);
  return isFinite(n) ? n : 0;
}
function fmtDate(iso2) {
  if (!iso2) return "";
  const d = /* @__PURE__ */ new Date(iso2.slice(0, 10) + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
var fmtStamp = (iso2) => new Date(iso2).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
var monthLbl = (k) => (/* @__PURE__ */ new Date(k + "-01T00:00:00")).toLocaleDateString("en-US", { month: "short", year: "numeric" });
function fmtIn(v, isPct) {
  return isPct ? (v * 100).toFixed(2).replace(/\.?0+$/, "") + "%" : nf2.format(v);
}

// vendor/gripcasting/src/web/parse.ts
var GLRX = /^\d{4} · /;
var TX_NOBU = "none";
function entityOf(name) {
  const m = String(name).toUpperCase().match(/\b(PNN|PNS|SMI)\b/) || String(name).toUpperCase().match(/(PNN|PNS|SMI)/);
  return m ? m[1] : null;
}
async function parseFiles(files) {
  const XLSX2 = await init_xlsx().then(() => xlsx_exports);
  const out = { fileName: files.map((f) => f.name).join(", "), rows: [], ent: [], monthly: {}, monthlyCount: 0, closeDate: null, newGLs: [], tx: [], txCheck: null };
  let maxDate = null;
  for (const f of files) {
    const m = f.name.match(/(\d{2})[.\-_](\d{2})[.\-_](\d{2,4})/);
    if (m && !out.closeDate) {
      const y = m[3].length === 2 ? "20" + m[3] : m[3];
      out.closeDate = `${y}-${m[1]}-${m[2]}`;
    }
    const wb = XLSX2.read(await f.arrayBuffer(), { cellDates: true });
    for (const sn of wb.SheetNames) {
      const rows = XLSX2.utils.sheet_to_json(wb.Sheets[sn], { header: 1, raw: true, defval: null });
      if (/qb\s*back\s*up/i.test(sn)) {
        maxDate = parseQB(rows, out, maxDate);
        continue;
      }
      const e = entityOf(sn) || (wb.SheetNames.length === 1 ? entityOf(f.name) : null);
      if (!e) continue;
      const r = parseBU(rows, e);
      if (r) {
        out.rows.push(...r.rows);
        out.ent.push({ e, cost: r.cost, tie: r.tie });
      }
    }
  }
  if (!out.closeDate && maxDate) out.closeDate = maxDate.toISOString().slice(0, 10);
  out.monthlyCount = Object.keys(out.monthly).length;
  out.txCheck = txCheck(out);
  const known = new Set(GLS);
  out.newGLs = [...new Set(out.rows.map((r) => normGL(r[2])).filter((g) => +g.slice(0, 4) >= 5e3 && !known.has(g) && !isExcluded(g)))];
  if (!out.ent.length) return { fileName: out.fileName, error: "No PNN, PNS or SMI P&L by Business Unit tabs were found in this file." };
  return out;
}
function parseBU(rows, e) {
  let hi = -1, cols = [];
  for (let i = 0; i < Math.min(rows.length, 15); i++) {
    const c = [];
    (rows[i] || []).forEach((v, j) => {
      if (typeof v === "string" && /^\d{2} \S/.test(v.trim())) c.push([j, v.trim()]);
    });
    if (c.length) {
      hi = i;
      cols = c;
      break;
    }
  }
  if (hi < 0) return null;
  const hdr = rows[hi];
  const keyCol = hdr.findIndex((v) => typeof v === "string" && /concat/i.test(v));
  const totCol = hdr.findIndex((v) => typeof v === "string" && /^total$/i.test(v.trim()));
  const outRows = [];
  let cost = 0, rev = 0, ni = null;
  for (let i = hi + 1; i < rows.length; i++) {
    const r = rows[i] || [];
    let key = null;
    const kc = keyCol >= 0 ? r[keyCol] : null;
    if (typeof kc === "string") key = kc.trim();
    if (!key) {
      for (let j = 0; j < (cols[0]?.[0] ?? r.length); j++) {
        const v = r[j];
        if (typeof v === "string" && v.trim()) {
          key = v.trim();
          break;
        }
      }
    }
    if (!key) continue;
    if (/^net income$/i.test(key)) {
      const t = totCol >= 0 ? r[totCol] : null;
      ni = typeof t === "number" ? t : cols.reduce((s, [j]) => s + (+r[j] || 0), 0);
      continue;
    }
    if (!GLRX.test(key)) continue;
    for (const [j, bu] of cols) {
      const v = r[j];
      if (typeof v === "number" && Math.abs(v) > 4e-3) {
        outRows.push([e, bu, key, round2(v)]);
        if (+key.slice(0, 4) < 5e3) rev += v;
        else cost += v;
      }
    }
  }
  return { rows: outRows, cost, tie: ni === null ? null : round2(ni - (rev - cost)) };
}
function parseQB(rows, out, maxDate) {
  const monthly = out.monthly;
  const hi = rows.findIndex((r) => r && r.includes("Account") && (r.includes("Debit") || r.includes("Amount")));
  if (hi < 0) return maxDate;
  const h = rows[hi], ia = h.indexOf("Account"), idt = h.indexOf("Date"), idb = h.indexOf("Debit"), icr = h.indexOf("Credit"), iam = h.indexOf("Amount");
  const col = (n) => h.findIndex((v) => typeof v === "string" && v.trim().toLowerCase() === n);
  const ity = col("type"), inum = col("num"), inm = col("name"), isrc = col("source name"), imemo = col("memo"), ifarm = col("farm");
  const str = (r, j) => j >= 0 && r[j] != null ? String(r[j]).trim() : "";
  for (let i = hi + 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r) continue;
    const d = r[idt];
    if (!(d instanceof Date)) continue;
    const g = r[ia];
    if (typeof g !== "string" || !GLRX.test(g.trim())) continue;
    const amt = iam >= 0 && typeof r[iam] === "number" ? r[iam] : (+r[idb] || 0) - (+r[icr] || 0);
    const k = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
    const gg = g.trim();
    monthly[gg] = monthly[gg] || {};
    monthly[gg][k] = round2((monthly[gg][k] || 0) + amt);
    const nm = str(r, inm), bu = BUS.find((b) => b.toLowerCase() === nm.toLowerCase());
    out.tx.push({ bu: bu ? buCode(bu) : TX_NOBU, r: [iso(d), str(r, ity), str(r, inum), str(r, isrc) || (bu ? "" : nm), str(r, imemo), normGL(gg), str(r, ifarm), round2(amt)] });
    if (!maxDate || d > maxDate) maxDate = d;
  }
  return maxDate;
}
function txCheck(p) {
  if (!p.tx.length) return null;
  const ds = p.tx.map((t) => t.r[0]).sort(), det = {}, tab = {};
  for (const t of p.tx) {
    const g = t.r[5];
    if (+g.slice(0, 4) >= 5e3 && !isExcluded(g)) det[g] = (det[g] || 0) + t.r[7];
  }
  for (const [, , g, a] of p.rows) {
    if (+g.slice(0, 4) < 5e3 || isExcluded(g)) continue;
    const n = normGL(g);
    tab[n] = (tab[n] || 0) + a;
  }
  const diff = Object.keys(det).filter((g) => Math.abs((tab[g] || 0) - det[g]) >= 1).map((g) => ({ g, d: round2((tab[g] || 0) - det[g]) })).sort((a, b) => Math.abs(b.d) - Math.abs(a.d));
  return {
    count: p.tx.length,
    from: ds[0],
    to: ds[ds.length - 1],
    noBU: p.tx.filter((t) => t.bu === TX_NOBU).length,
    total: round2(Object.values(det).reduce((s, v) => s + v, 0)),
    diff,
    missing: Object.keys(tab).filter((g) => !(g in det) && Math.abs(tab[g]) >= 1).sort()
  };
}

// vendor/gripcasting/src/web/state.ts
var S = {
  tab: "overview",
  me: null,
  users: {},
  drivers: null,
  driversVersion: null,
  actuals: null,
  builds: {},
  uploads: [],
  preview: null,
  loadingActuals: false,
  canWrite: true,
  isAdmin: false,
  saving: "",
  buSort: "bu",
  buildBU: "all",
  focusG: null,
  open: {},
  addGL: null,
  confirmDel: null,
  /* transactions (QB Back Up) */
  detail: null,
  detailLoading: false,
  tx: { bu: "all", gl: "", month: "", q: "" },
  /* submissions */
  subs: [],
  subF: { close: "", bu: "all", kind: "all" },
  cmp: null,
  cmpState: null,
  confirmFinal: false,
  submitting: false,
  view: null
};
var modelState = () => ({ drivers: S.drivers, actuals: S.actuals, builds: S.builds });
try {
  const t = localStorage.getItem("gripfc.tab");
  if (t) S.tab = t === "costs" || t === "bu" ? "overview" : t;
  const b = localStorage.getItem("gripfc.bu");
  if (b) S.buildBU = b;
} catch {
}

// vendor/gripcasting/src/web/views.ts
var COLORS = ["--bar-a", "--bar-b", "--bar-c", "--bar-d", "--bar-e", "--bar-f"];
var STATUS = { notstarted: "Not started", inprogress: "In progress", fixed: "Fixed", closed: "Closed" };
var SRC = { driver: ["No items", "warn"], build: ["Build", "under"], closed: ["Closed", "neutral"] };
var START_LBL = { unit: "Unit cost", runrate: "Run rate", budget: "Budget left", seasonal: "Prior year" };
var srcPill = (r) => r.src === "driver" ? `<span class="pill warn" title="Nothing forecast until items are added">No items</span>` : `<span class="pill ${SRC[r.src][1]}">${SRC[r.src][0]}</span>`;
var sum = (xs, f) => xs.reduce((s, x) => s + f(x), 0);
var uid = (email) => `<span data-uid="${esc(email || "")}">someone</span>`;
function vOverview(M2) {
  const varc = M2.budget - M2.cost;
  const groups = GROUPS.map((gr) => {
    const ls = M2.lines.filter((l) => l.group === gr);
    return { gr, b: sum(ls, (l) => l.b), land: sum(ls, (l) => l.landing), a: sum(ls, (l) => l.a) };
  });
  const mx = Math.max(...groups.map((g) => Math.max(g.b, g.land)), 1);
  const revMix = M2.streams.filter((s) => s.rev > 0);
  return `
  <div class="kpis">
    <div class="kpi"><div class="eyebrow">Revenue \xB7 driver model</div><div class="v num">${big(M2.revenue)}</div><div class="s">${nf0.format(M2.vol.adjDry)} dry lbs \xB7 BTR ${pct(S.drivers.vol.btr)}</div></div>
    <div class="kpi"><div class="eyebrow">Cost landing</div><div class="v num">${big(M2.cost)}</div><div class="s">${big(M2.actual)} actual + ${big(M2.cost - M2.actual)} to go</div></div>
    <div class="kpi"><div class="eyebrow">vs cost budget</div><div class="v num" style="color:var(${varc < 0 ? "--bad" : "--good"})">${big(Math.abs(varc))}</div><div class="s">${varc < 0 ? "over" : "under"} the ${big(M2.budget)} budget</div></div>
    <div class="kpi"><div class="eyebrow">EBITDA</div><div class="v num">${big(M2.ebitda)}</div><div class="s">${M2.revenue ? pct(M2.ebitda / M2.revenue) + " margin" : "\u2013"}</div></div>
  </div>
  <div class="grid2">
    <div class="stack">
      <section class="panel">
        <div class="panel-h"><h2>Cost landing by category</h2>
          <div class="legend"><span><i class="sw outline"></i>Budget</span><span><i class="sw" style="background:var(--bar-a)"></i>Landing</span><span><i class="sw" style="background:var(--bad)"></i>Over budget portion</span></div></div>
        <div class="cmp">
          ${groups.map((g) => `<div class="lbl">${g.gr}</div><div class="track"><div class="b" style="width:${g.b / mx * 100}%"></div><div class="l" style="width:${Math.min(g.land, g.b || g.land) / mx * 100}%"></div>${g.land > g.b ? `<div class="l over" style="left:${g.b / mx * 100}%;width:${(g.land - g.b) / mx * 100}%"></div>` : ""}</div><div class="num" style="text-align:right">${big(g.land)}</div>`).join("")}
        </div>
      </section>
      <section class="panel">
        <div class="panel-h"><h2>Harvest volume</h2><button class="btn ghost" data-go="revenue" type="button">Edit drivers</button></div>
        <div class="flow-wrap"><div class="flow">
          <div class="st"><div class="k">Plants</div><div class="v num">${nf0.format(S.drivers.vol.plants)}</div></div>
          <div class="st"><div class="k">Wet lbs</div><div class="v num">${nf0.format(M2.vol.totalWet)}</div></div>
          <div class="st"><div class="k">Sellable dry lbs</div><div class="v num">${nf0.format(M2.vol.adjDry)}</div></div>
          <div class="st"><div class="k">Bud lbs</div><div class="v num">${nf0.format(M2.vol.bud)}</div></div>
          <div class="st"><div class="k">Trim &amp; biomass lbs</div><div class="v num">${nf0.format(M2.vol.other)}</div></div>
        </div></div>
        <div class="eyebrow" style="margin-top:16px">Revenue mix</div>
        <div class="mixbar">${revMix.map((s, i) => `<div title="${esc(s.name)} ${big(s.rev)}" style="flex:${s.rev};background:var(${COLORS[i % 6]})"></div>`).join("")}</div>
        <div class="legend">${revMix.map((s, i) => `<span><i class="sw" style="background:var(${COLORS[i % 6]})"></i>${esc(s.name)} ${big(s.rev)}</span>`).join("")}</div>
      </section>
    </div>
    <div class="stack">${vBuildStatus(M2)}</div>
  </div>
  <section class="panel" style="margin-top:20px"><div class="panel-h"><h2>Business units</h2></div>${vBU(M2)}</section>`;
}
function vBuildStatus(M2) {
  const rows = buTable(M2).filter((r) => r.b || r.a || r.rem);
  return `<section class="panel"><div class="panel-h"><h2>Forecast build by BU</h2><button class="btn ghost" data-go="build" type="button">Open builds</button></div>
    <div class="tbl-wrap" style="border:0"><table><thead><tr><th>Business unit</th><th>Built</th><th>Status</th></tr></thead><tbody>
    ${rows.map((r) => {
    const code = buCode(r.bu), d = S.builds[code], p = r.rem > 0.5 ? Math.min(Math.max(r.built / r.rem, 0), 1) : d ? 1 : 0;
    const st = d && d.submittedAt ? ["Submitted", "under"] : d && Object.keys(d.lines || {}).length ? ["In progress", "warn"] : ["Not started", "neutral"];
    return `<tr><td><button class="rr" style="font-family:var(--f-body);font-size:13px;color:var(--ink);text-decoration:none" type="button" data-gobu="${code}">${esc(r.bu)}</button></td>
      <td><div style="display:flex;align-items:center;gap:8px"><div style="width:80px;height:6px;background:var(--sunk);border-radius:3px;overflow:hidden"><div style="height:100%;width:${p * 100}%;background:var(--bar-a)"></div></div><span class="num muted" style="font-size:12px">${pct(p)}</span></div></td>
      <td><span class="pill ${st[1]}">${st[0]}</span></td></tr>`;
  }).join("")}
    </tbody></table></div><p class="hint" style="margin-top:8px">Built = share of remaining spend that comes from BU line items or closed lines instead of starting points.</p></section>`;
}
var VFIELDS = [
  ["Harvest volume", [["plants", "Plants", "count"], ["wetPerPlant", "Wet weight per plant", "lbs"], ["dryDown", "Dry-down factor", "% of wet", 1], ["ffWet", "Fresh frozen (diverted wet)", "wet lbs"], ["btr", "BTR \xB7 bud-to-total ratio", "% of dry", 1], ["shrink", "Bud shrink to biomass", "% of bud lbs, to distillate", 1]]],
  ["Bud mix", [["prepackPct", "Prepack share of bud", "% of bud lbs", 1], ["prepackPrice", "Prepack price", "$ / lb"], ["bulkPrice", "Bulk flower price", "$ / lb"]]],
  ["Distillate & carts", [["lbsPerLiter", "Biomass per liter", "lbs / liter"], ["carts", "Carts sold", "units"], ["gPerCart", "Distillate per cart", "grams"], ["cartPrice", "Cart price", "$ / unit"], ["literPrice", "Wholesale distillate price", "$ / liter"]]],
  ["Live resin (fresh frozen)", [["resinYield", "Resin yield", "% of wet", 1], ["resinSplit", "Retained split", "%", 1], ["resinPrice", "Resin price", "$ / gram"]]],
  ["Other streams", [["premLbs", "Premium outdoor", "lbs", "", "premOn"], ["premPrice", "Premium outdoor price", "$ / lb"], ["ghLbs", "Greenhouse flower", "lbs", "", "ghOn"], ["ghPrice", "Greenhouse price", "$ / lb"], ["iprUnits", "Infused prerolls", "units", "", "iprOn"], ["iprPrice", "Infused preroll price", "$ / unit"], ["ibLbs", "Infused bud", "lbs", "", "ibOn"], ["ibPrice", "Infused bud price", "$ / lb"], ["tps", "Third-party services", "$ / year", "", "tpsOn"]]]
];
function vRevenue(M2) {
  const v = S.drivers.vol, dis = S.isAdmin ? "" : "disabled";
  return `<div class="grid-rev">
  <section class="panel"><div class="panel-h"><h2>Revenue drivers</h2>${S.isAdmin ? "" : `<span class="pill neutral">Set by finance</span>`}</div>
    ${VFIELDS.map(([h, fs]) => `<div class="fgroup"><h3>${h}</h3><div class="fields">
      ${fs.map(([k, l, u, p, tog]) => `<div class="field"><label for="v-${k}">${tog ? `<span class="toggle"><input type="checkbox" id="tg-${tog}" data-tog="${tog}" ${v[tog] ? "checked" : ""} ${dis}></span> ` : ""}${l}<span class="u">${u}</span></label><input class="in" id="v-${k}" data-vol="${k}" data-pct="${p ? 1 : ""}" value="${fmtIn(v[k], p)}" inputmode="decimal" ${dis}></div>`).join("")}
    </div></div>`).join("")}
  </section>
  <div class="stack" id="revOut">${vRevOut(M2)}</div></div>`;
}
function vRevOut(M2) {
  const live = M2.streams.filter((s) => s.rev > 0);
  return `<section class="panel"><div class="panel-h"><h2>Revenue build</h2><span class="num" style="font-family:var(--f-display);font-weight:600;font-size:22px">${big(M2.revenue)}</span></div>
    <div class="mixbar">${live.map((s, i) => `<div title="${esc(s.name)}" style="flex:${s.rev};background:var(${COLORS[i % 6]})"></div>`).join("")}</div>
    <div class="tbl-wrap" style="border:0"><table><thead><tr><th>Stream</th><th class="n">Volume</th><th>Unit</th><th class="n">Price</th><th class="n">Revenue</th><th class="n">Mix</th></tr></thead><tbody>
    ${M2.streams.map((s) => `<tr style="${s.on ? "" : "opacity:.45"}"><td><i class="sw" style="background:var(${COLORS[live.indexOf(s) % 6] || "--line"});margin-right:8px"></i>${esc(s.name)}</td><td class="n">${s.unit === "flat" ? "\u2013" : nf0.format(s.qty)}</td><td class="muted">${s.unit}</td><td class="n">${s.unit === "flat" ? "\u2013" : "$" + nf2.format(s.price)}</td><td class="n">${money(s.rev)}</td><td class="n">${M2.revenue ? pct(s.rev / M2.revenue) : "\u2013"}</td></tr>`).join("")}
    <tr class="tot"><td>Total revenue</td><td></td><td></td><td></td><td class="n">${money(M2.revenue)}</td><td class="n">100%</td></tr>
    <tr><td class="muted">Revenue booked to date</td><td></td><td></td><td></td><td class="n">${money(M2.revA)}</td><td></td></tr>
    </tbody></table></div></section>
  <section class="panel"><div class="panel-h"><h2>Volume math</h2></div>
    <div class="tbl-wrap" style="border:0"><table class="kv"><tbody>
      <tr><td>Total wet lbs</td><td class="n">${nf0.format(M2.vol.totalWet)}</td></tr>
      <tr><td>Total dry lbs</td><td class="n">${nf0.format(M2.vol.totalDry)}</td></tr>
      <tr><td>Assumed dry weight per plant</td><td class="n">${nf2.format(M2.vol.plants ? M2.vol.totalDry / M2.vol.plants : 0)} lbs</td></tr>
      <tr><td>Dry lbs net of fresh frozen</td><td class="n">${nf0.format(M2.vol.netDry)}</td></tr>
      <tr class="tot"><td>Sellable dry lbs</td><td class="n">${nf0.format(M2.vol.adjDry)}</td></tr>
      <tr><td>Bud lbs before shrink \xB7 BTR ${pct(S.drivers.vol.btr)}</td><td class="n">${nf0.format(M2.vol.grossBud)}</td></tr>
      <tr><td>Bud shrink to biomass \xB7 ${pct(+S.drivers.vol.shrink || 0)}</td><td class="n">${M2.vol.shrinkLbs ? "(" + nf0.format(M2.vol.shrinkLbs) + ")" : "\u2013"}</td></tr>
      <tr class="tot"><td>Bud lbs sold as flower \xB7 prepack / bulk</td><td class="n">${nf0.format(M2.prepackLbs)} / ${nf0.format(M2.bulkLbs)}</td></tr>
      <tr><td>Biomass lbs \xB7 trim ${nf0.format(M2.vol.trim)} + bud shrink ${nf0.format(M2.vol.shrinkLbs)}</td><td class="n">${nf0.format(M2.vol.other)}</td></tr>
      <tr><td>Distillate liters \xB7 to carts / wholesale</td><td class="n">${nf0.format(M2.cartL)} / ${nf0.format(M2.wholesaleL)}</td></tr>
      ${M2.cartL > M2.liters ? `<tr><td colspan="2"><span class="pill over">Carts need ${nf0.format(M2.cartL)} L but only ${nf0.format(M2.liters)} L is produced</span></td></tr>` : ""}
      <tr><td>Live resin grams retained</td><td class="n">${nf0.format(M2.resinG)}</td></tr>
      <tr class="tot"><td>Cost per dry lb \xB7 landing</td><td class="n">${usd2.format(M2.vol.adjDry ? M2.cost / M2.vol.adjDry : 0)}</td></tr>
      <tr><td>Revenue per dry lb</td><td class="n">${usd2.format(M2.vol.adjDry ? M2.revenue / M2.vol.adjDry : 0)}</td></tr>
    </tbody></table></div></section>`;
}
function vBU(M2) {
  const rows = buTable(M2).filter((r) => r.b || r.a || r.rem);
  const k = S.buSort;
  rows.sort((x, y) => k === "bu" ? x.bu.localeCompare(y.bu) : x[k] - y[k]);
  const tot = rows.reduce((s, r) => ({ b: s.b + r.b, a: s.a + r.a, rem: s.rem + r.rem }), { b: 0, a: 0, rem: 0 });
  const sortBtn = (key, lbl, n) => `<th class="${n ? "n" : ""}"><button class="sortb" style="background:none;border:0;cursor:pointer;padding:0;font:inherit;font-weight:600;font-size:11px;letter-spacing:.04em;text-transform:uppercase;color:${S.buSort === key ? "var(--ink)" : "var(--muted)"}" data-busort="${key}" type="button">${lbl}</button></th>`;
  return `<div class="tbl-wrap"><table><thead><tr>${sortBtn("bu", "Business unit")}${sortBtn("b", "Budget", 1)}${sortBtn("a", "Actual HTD", 1)}<th>% spent</th>${sortBtn("rem", "Remaining", 1)}${sortBtn("landing", "Landing", 1)}${sortBtn("varc", "Var to budget", 1)}</tr></thead><tbody>
  ${rows.map((r) => {
    const sp = r.b ? r.a / r.b : 0;
    return `<tr><td>${esc(r.bu)}</td><td class="n">${dash(r.b)}</td><td class="n">${dash(r.a)}</td>
    <td><div style="display:flex;align-items:center;gap:8px"><div style="width:90px;height:6px;background:var(--sunk);border-radius:3px;overflow:hidden"><div style="height:100%;width:${Math.min(sp, 1) * 100}%;background:var(${sp > 1 ? "--bad" : "--bar-a"})"></div></div><span class="num muted" style="font-size:12px">${r.b ? pct(sp) : "\u2013"}</span></div></td>
    <td class="n">${dash(r.rem)}</td><td class="n">${dash(r.landing)}</td><td class="n ${r.varc < -0.5 ? "neg" : "pos"}">${money(r.varc)}</td></tr>`;
  }).join("")}
  <tr class="tot"><td>Total</td><td class="n">${money(tot.b)}</td><td class="n">${money(tot.a)}</td><td></td><td class="n">${money(tot.rem)}</td><td class="n">${money(tot.a + tot.rem)}</td><td class="n ${tot.b - tot.a - tot.rem < 0 ? "neg" : "pos"}">${money(tot.b - tot.a - tot.rem)}</td></tr>
  </tbody></table></div>
  <p class="hint" style="margin-top:10px">Starting points spread to BUs by budget mix (volume-linked lines) or by where actuals are booked (run-rate and prior-year lines). Licensing, wages and utilities are budgeted across BUs but booked to SG&amp;A and Indirect, so BU variances on those lines reflect coding, not spend.</p>`;
}
var monthBars = (M2, rows) => {
  const mon = buMonthly(M2, rows), mx = Math.max(...mon.map((m) => m.v), 1);
  return `<div style="display:flex;gap:6px;align-items:flex-end;height:90px">${mon.map((m) => `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;min-width:0"><div class="num" style="font-size:10px;color:var(--muted)">${big(m.v)}</div><div style="width:100%;max-width:38px;height:${Math.max(m.v / mx * 56, 1)}px;background:var(--bar-a);border-radius:2px 2px 0 0"></div><div style="font-size:11px;color:var(--muted)">${m.lbl}</div></div>`).join("")}</div>`;
};
var kpi5 = (b, a, rem, built, start, landing) => {
  const varc = b - landing;
  return `<div class="kpis k5">
    <div class="kpi"><div class="eyebrow">Budget</div><div class="v num" style="font-size:20px">${big(b)}</div></div>
    <div class="kpi"><div class="eyebrow">Actual HTD</div><div class="v num" style="font-size:20px">${big(a)}</div></div>
    <div class="kpi"><div class="eyebrow">Remaining</div><div class="v num" style="font-size:20px">${big(rem)}</div><div class="s">${big(built)} from items${start >= 0.5 ? ` \xB7 ${big(start)} of starting points not itemized` : ""}</div></div>
    <div class="kpi"><div class="eyebrow">Landing</div><div class="v num" style="font-size:20px">${big(landing)}</div></div>
    <div class="kpi"><div class="eyebrow">Var to budget</div><div class="v num" style="font-size:20px;color:var(${varc < 0 ? "--bad" : "--good"})">${big(Math.abs(varc))}</div><div class="s">${varc < 0 ? "over budget" : "under budget"}</div></div>
  </div>`;
};
function vBuildSum(M2, bu, rows) {
  const code = buCode(bu), doc = S.builds[code] || { lines: {} }, t = (k) => sum(rows, (r) => r[k]);
  const built = sum(rows.filter((r) => r.src === "build"), (r) => r.rem), drv = sum(rows.filter((r) => r.src === "driver"), (r) => r.drv);
  const missing = rows.filter((r) => r.needReason && !r.hasReason && r.status !== "closed").length;
  const lastEdit = Object.values(doc.lines || {}).reduce((m, l) => (l.updatedAt || "") > m ? l.updatedAt || "" : m, "");
  const edited = !!doc.submittedAt && lastEdit > doc.submittedAt;
  return `${kpi5(t("b"), t("a"), t("rem"), built, drv, t("landing"))}
  <div class="grid2" style="margin-bottom:16px">
    <section class="panel"><div class="panel-h"><h3>Remaining spend by month</h3></div>${monthBars(M2, rows)}</section>
    <section class="panel"><div class="panel-h"><h3>Submit</h3>${doc.submittedAt ? `<span class="pill ${edited ? "warn" : "under"}">${edited ? "Edited after submit" : "Submitted"}</span>` : `<span class="pill neutral">Not submitted</span>`}</div>
      ${doc.submittedAt ? `<div class="muted" style="font-size:12px;margin-bottom:10px">Submitted by ${uid(doc.submittedBy)} \xB7 ${fmtStamp(doc.submittedAt)}</div>` : ""}
      ${missing ? `<div class="check" style="margin-bottom:10px"><i class="dot wn"></i><span>${missing} line${missing > 1 ? "s need" : " needs"} a variance reason (over 10% and $10K off budget)</span></div>` : `<div class="check" style="margin-bottom:10px"><i class="dot ok"></i><span>Every large variance has a reason</span></div>`}
      <button class="btn primary" id="submitBU" type="button" ${missing || !S.canWrite || S.submitting ? "disabled" : ""}>${doc.submittedAt ? "Resubmit" : "Submit"} ${esc(bu.slice(3))} forecast</button>
    </section>
  </div>`;
}
var BT_COLS = `<colgroup><col style="width:17%"><col style="width:10%"><col style="width:9%"><col style="width:9%"><col style="width:10%"><col style="width:9%"><col style="width:9%"><col style="width:8%"><col style="width:11%"><col style="width:118px"></colgroup>`;
var BT_HEAD = `<thead><tr><th>GL</th><th>Status</th><th class="n">Budget</th><th class="n">Actual HTD</th><th>Forecast from</th><th class="n">Remaining</th><th class="n">Landing</th><th class="n">Variance</th><th></th><th></th></tr></thead>`;
var stepOrder = () => ["all", ...BUS.map(buCode)];
function buSelect(code) {
  const so = stepOrder(), i = so.indexOf(code);
  return `<label for="buSel" class="eyebrow">Business unit</label>
      <span class="step"><button class="btn ghost" type="button" data-step="${so[(i - 1 + so.length) % so.length]}" aria-label="Previous business unit">\u2039</button>
      <select class="sel" id="buSel" style="font-size:14px;padding:7px 8px;min-width:230px"><option value="all" ${code === "all" ? "selected" : ""}>All In</option>${BUS.map((b) => `<option value="${buCode(b)}" ${buCode(b) === code ? "selected" : ""}>${esc(b)}</option>`).join("")}</select>
      <button class="btn ghost" type="button" data-step="${so[(i + 1) % so.length]}" aria-label="Next business unit">\u203A</button></span>`;
}
var BASIS_HOW = {
  unit: "budget rate \xD7 harvest volume, this BU's share by budget mix",
  runrate: "trailing 3 closed months \xD7 months remaining, spread by where actuals are booked",
  budget: "this BU's budget left (budget \u2212 actual)",
  seasonal: "last year's monthly pattern scaled to this year's pace"
};
function itemsEditor(M2, r, code, dis, extra = "") {
  const items = r.ln && r.ln.items || [], gq = esc(r.g);
  return `<div class="tbl-wrap" style="background:var(--surface)"><table>
        <thead><tr><th>Item</th><th>PO #</th><th>Driven by</th><th class="n">Qty</th><th>Unit</th><th class="n">Unit cost</th><th>Start</th><th>End</th><th class="n">Total</th><th></th></tr></thead><tbody>
        ${items.map((it) => {
    const f = (k, ex, val, w, al) => `<input class="in" style="width:${w};${al ? "text-align:left" : ""}" id="it-${it.id}-${k}" data-item="${it.id}" data-g="${gq}" data-bu="${code}" data-f="${k}" value="${val}" ${ex || ""} ${dis}>`;
    const [rs, re] = itemRange(it, M2.win);
    return `<tr>
          <td style="min-width:230px">${f("desc", 'placeholder="What is it?"', esc(it.desc || ""), "100%", 1)}</td>
          <td>${f("po", 'placeholder="PO-0000" autocomplete="off"', esc(it.po || ""), "110px", 1)}</td>
          <td style="min-width:250px"><select class="sel" id="it-${it.id}-drv" data-item="${it.id}" data-g="${gq}" data-bu="${code}" data-f="drv" ${dis}><option value="">Manual qty</option>${Object.entries(BASES).map(([k, v]) => `<option value="${k}" ${it.drv === k ? "selected" : ""}>${v[0].toUpperCase() + v.slice(1)}</option>`).join("")}</select>
            ${it.drv ? `<div class="hint" style="margin-top:4px;display:flex;gap:4px;align-items:center;flex-wrap:wrap">${f("share", 'inputmode="decimal" title="Share of volume"', fmtIn(it.share == null ? 1 : +it.share, 1), "64px")} of ${nf0.format(M2.volNow[it.drv] || 0)} \xF7 ${f("per", 'inputmode="decimal" title="Per labor hour"', it.per ?? "", "60px")} per hr</div>` : ""}</td>
          <td class="n">${it.drv ? `<span class="num" data-ithrs="${it.id}">${nf0.format(itemQty(it, M2.volNow))}</span>` : f("qty", 'inputmode="decimal"', it.qty ?? "", "90px")}</td>
          <td>${it.drv ? `<span class="muted">hours</span>` : f("unit", 'placeholder="loads"', esc(it.unit || ""), "90px", 1)}</td>
          <td>${f("cost", 'inputmode="decimal"', it.cost ?? "", "90px")}</td>
          <td>${f("start", `type="date" min="${M2.win.start}" max="${M2.win.end}"`, rs, "140px", 1)}</td>
          <td>${f("end", `type="date" min="${M2.win.start}" max="${M2.win.end}"`, re, "140px", 1)}</td>
          <td class="n" data-ittot="${it.id}">${itemTotalCell(M2, it)}</td>
          <td><button class="btn ghost" type="button" data-delitem="${it.id}" data-g="${gq}" data-bu="${code}" aria-label="Remove item" ${dis}>Remove</button></td></tr>`;
  }).join("")}
        ${items.length ? `<tr class="tot"><td colspan="8">${items.length} item${items.length > 1 ? "s" : ""}</td><td class="n">${money(sum(items, (it) => itemTotal(it, M2.volNow)))}</td><td></td></tr>` : `<tr><td colspan="10" class="muted">No items, so nothing more is forecast on this line.${Math.abs(r.drv) >= 0.5 ? ` Its ${(START_LBL[r.basis] || "run rate").toLowerCase()} starting point would be ${money(r.drv)} (${BASIS_HOW[r.basis] || BASIS_HOW.runrate}).` : ""}</td></tr>`}
        </tbody></table></div>
      <div class="row" style="margin-top:10px">
        <button class="btn" type="button" data-additem="${gq}" data-bu="${code}" ${dis}>Add item</button>
        <button class="btn" type="button" data-additem="${gq}" data-bu="${code}" data-labor="1" ${dis}>Add labor assumption</button>
        ${!items.length && Math.abs(r.drv) >= 0.5 ? `<button class="btn" type="button" data-usesp="${gq}" data-bu="${code}" data-amt="${round2(r.drv)}" data-basis="${esc(START_LBL[r.basis] || "Run rate")}" ${dis}>Use starting point as an item (${money(r.drv)})</button>` : ""}
        ${items.length ? `<button class="btn ghost" type="button" data-clear="${gq}" data-bu="${code}" ${dis}>Clear items</button>` : ""}
        ${extra}
      </div>`;
}
function reasonField(r, code, dis) {
  const id = `rs-${code}-${r.i}`;
  return `<div class="field" style="grid-template-columns:140px minmax(0,1fr);margin-top:10px"><label for="${id}">Variance reason${r.needReason ? ` <span class="u" style="color:var(--warn)">required</span>` : `<span class="u">optional</span>`}</label>
        <input class="in" style="text-align:left;font-family:var(--f-body)" id="${id}" data-reason="${esc(r.g)}" data-bu="${code}" value="${esc(r.ln && r.ln.reason || "")}" placeholder="Why this line lands where it does" ${dis}></div>`;
}
function components(M2, x) {
  const code = buCode(x.bu || ""), dis = S.canWrite ? "" : "disabled";
  const body = x.status === "closed" ? `<div class="muted">Closed: stops at actual. Set it back to In progress from the BU's page to forecast more.</div>` : itemsEditor(M2, x, code, dis) + reasonField(x, code, dis);
  return `<tr class="comp"><td colspan="9">${body}</td></tr>`;
}
function vBuildAll(M2) {
  const { rows, flat } = allLines(M2), t = (k) => sum(rows, (r) => r[k]);
  const built = sum(flat.filter((r) => r.src === "build"), (r) => r.rem), start = sum(flat.filter((r) => r.src === "driver"), (r) => r.drv);
  const varc = t("b") - t("landing");
  const active = buTable(M2).filter((r) => r.b || r.a || r.rem).map((r) => r.bu);
  const sub = active.filter((b) => S.builds[buCode(b)] && S.builds[buCode(b)].submittedAt);
  const needBU = active.map((b) => ({ b, n: flat.filter((r) => r.bu === b && r.needReason && !r.hasReason && r.status !== "closed").length })).filter((x) => x.n);
  const body = rows.map((r) => {
    const open = !!S.open["all|" + r.g];
    const srcTxt = r.built || r.closed ? `<span class="pill under">${r.built ? `Built in ${r.built} BU${r.built > 1 ? "s" : ""}` : ""}${r.built && r.closed ? " \xB7 " : ""}${r.closed ? `${r.closed} closed` : ""}</span>` : `<span class="pill warn" title="Nothing forecast until items are added">No items</span>`;
    const sts = [...new Set(r.bus.map((x) => x.status))], stTxt = sts.length === 1 ? STATUS[sts[0]] : `<span class="muted">Mixed</span>`;
    return `<tr data-allg="${esc(r.g)}" class="${S.focusG === r.g ? "focus" : ""}"><td><div class="gl-name" title="${esc(glName(r.g))}">${esc(glName(r.g))}</div></td>
      <td>${stTxt}</td><td class="n">${dash(r.b)}</td><td class="n">${dash(r.a)}</td><td>${srcTxt}</td>
      <td class="n">${dash(r.rem)}</td><td class="n">${dash(r.landing)}</td><td class="n ${r.varc < -0.5 ? "neg" : r.varc > 0.5 ? "pos" : ""}">${money(r.varc)}</td>
      <td>${r.needs ? `<span class="pill warn">${r.needs} need reason</span>` : ""}</td>
      <td><button class="btn ${open ? "" : "ghost"}" type="button" data-toggle="${esc(r.g)}">${open ? "Hide" : `By BU (${r.bus.length})`}</button></td></tr>
      ${open ? `<tr class="ed"><td colspan="10" style="background:var(--sunk);white-space:normal;padding:12px 14px"><div class="tbl-wrap" style="background:var(--surface)"><table class="bus">
        <colgroup><col style="width:19%"><col style="width:11%"><col style="width:11%"><col style="width:10%"><col style="width:10%"><col style="width:10%"><col style="width:10%"><col style="width:9%"><col style="width:10%"></colgroup>
        <thead><tr><th>Business unit</th><th>Status</th><th>Forecast from</th><th class="n">Budget</th><th class="n">Actual HTD</th><th class="n">Remaining</th><th class="n">Landing</th><th class="n">Var</th><th></th></tr></thead><tbody>
        ${r.bus.map((x) => `<tr><td>${esc(x.bu)}</td><td>${STATUS[x.status]}</td><td>${srcPill(x)}</td><td class="n">${dash(x.b)}</td><td class="n">${dash(x.a)}</td><td class="n">${dash(x.rem)}</td><td class="n">${dash(x.landing)}</td><td class="n ${x.varc < -0.5 ? "neg" : x.varc > 0.5 ? "pos" : ""}">${money(x.varc)}</td><td><button class="btn ghost" type="button" data-gobu="${buCode(x.bu || "")}" data-focus="${esc(r.g)}">Open</button></td></tr>${components(M2, x)}`).join("")}
      </tbody></table></div></td></tr>` : ""}`;
  }).join("");
  return `<div class="toolbar">${buSelect("all")}<div class="spacer"></div><span class="hint">Edit any BU's items here, or open the BU for its full line editor.</span></div>
  ${kpi5(t("b"), t("a"), t("rem"), built, start, t("landing"))}
  <div class="grid2" style="margin-bottom:16px">
    <section class="panel"><div class="panel-h"><h3>Remaining spend by month</h3></div>${monthBars(M2, flat)}</section>
    <section class="panel"><div class="panel-h"><h3>Submissions</h3><span class="pill ${sub.length === active.length ? "under" : "neutral"}">${sub.length} of ${active.length} BUs</span></div>
      ${needBU.length ? `<div class="checks" style="margin:0">${needBU.map((x) => `<div class="check"><i class="dot wn"></i><button class="rr" style="font-family:var(--f-body);font-size:13px;color:var(--ink)" type="button" data-gobu="${buCode(x.b)}">${esc(x.b)}</button><span class="muted">${x.n} line${x.n > 1 ? "s need" : " needs"} a reason</span></div>`).join("")}</div>` : `<div class="check"><i class="dot ok"></i><span>Every large variance has a reason</span></div>`}
    </section>
  </div>
  <div class="tbl-wrap bt-wrap"><table class="bt">${BT_COLS}${BT_HEAD}
    <tbody>${body}
    <tr class="tot"><td>Total</td><td></td><td class="n">${money(t("b"))}</td><td class="n">${money(t("a"))}</td><td></td><td class="n">${money(t("rem"))}</td><td class="n">${money(t("landing"))}</td><td class="n ${varc < 0 ? "neg" : "pos"}">${money(varc)}</td><td></td><td></td></tr>
    </tbody></table></div>`;
}
var itemTotalCell = (M2, it) => money(itemTotal(it, M2.volNow)) + (outsideWin(it, M2.win) ? `<div><span class="pill warn">Outside forecast window</span></div>` : "");
function vBuild(M2) {
  if (S.buildBU === "all") return vBuildAll(M2);
  const bu = BU_BY_CODE[S.buildBU] || BUS[4], code = buCode(bu), rows = buLines(M2, bu), dis = S.canWrite ? "" : "disabled";
  const tb = (k) => sum(rows, (r) => r[k]);
  const inRows = new Set(rows.map((r) => r.g));
  const addCtl = !S.canWrite ? "" : S.addGL === null ? `<button class="btn" id="addGLBtn" type="button">Add GL line</button>` : `<div class="row"><select class="sel" id="addSel"><option value="">Pick a GL\u2026</option>${GLS.filter((g) => !inRows.has(g)).map((g) => `<option value="${esc(g)}" ${S.addGL.sel === g ? "selected" : ""}>${esc(glName(g))}</option>`).join("")}<option value="__new" ${S.addGL.sel === "__new" ? "selected" : ""}>New GL not in the list\u2026</option></select>
      ${S.addGL.sel === "__new" ? `<input class="in" id="addCode" placeholder="5585" maxlength="4" inputmode="numeric" style="width:80px;text-align:left" value="${esc(S.addGL.code || "")}"><input class="in" id="addName" placeholder="Irrigation Supplies" style="width:220px;text-align:left" value="${esc(S.addGL.name || "")}">` : ""}
      <button class="btn primary" id="addGo" type="button">Add</button><button class="btn ghost" id="addCancel" type="button">Cancel</button></div>`;
  const body = rows.map((r) => {
    const id = `${code}-${r.i}`, open = !!S.open[code + "|" + r.g], items = r.ln && r.ln.items || [];
    const rmLabel = Math.abs(r.a) > 4e-3 ? "Close line" : r.b ? "Remove from forecast" : "Delete line";
    const del = S.confirmDel === code + "|" + r.g;
    return `<tr data-bline="${esc(r.g)}" class="${S.focusG === r.g ? "focus" : ""}" style="${r.status === "closed" ? "opacity:.6" : ""}">
      <td><div class="gl-name" title="${esc(glName(r.g))}">${esc(glName(r.g))}</div>${r.ln && r.ln.custom ? `<span class="pill warn">Added</span>` : ""}</td>
      <td><select class="sel" id="st-${id}" data-status="${esc(r.g)}" ${dis}>${Object.entries(STATUS).map(([k, v]) => `<option value="${k}" ${r.status === k ? "selected" : ""}>${v}</option>`).join("")}</select></td>
      <td class="n">${dash(r.b)}</td><td class="n">${dash(r.a)}</td>
      <td data-bo="src">${srcPill(r)}</td>
      <td class="n" data-bo="rem">${dash(r.rem)}</td><td class="n" data-bo="landing">${dash(r.landing)}</td>
      <td class="n ${r.varc < -0.5 ? "neg" : r.varc > 0.5 ? "pos" : ""}" data-bo="varc">${money(r.varc)}</td>
      <td data-bo="reason">${reasonPill(r)}</td>
      <td><button class="btn ${open ? "" : "ghost"}" type="button" data-toggle="${esc(r.g)}" id="tg-${id}">${open ? "Hide" : items.length ? `Items (${items.length})` : "Build"}</button></td></tr>
    ${open ? `<tr class="ed"><td colspan="10" style="background:var(--sunk);white-space:normal;padding:12px 14px">
      ${itemsEditor(M2, r, code, dis, `<button class="btn ghost" type="button" data-txgo="${esc(r.g)}">Transactions</button>
        <div class="spacer"></div>
        ${del ? `<span class="confirm">Delete this line? <button class="btn" type="button" data-delyes="${esc(r.g)}">Delete</button><button class="btn ghost" type="button" id="delNo">Keep</button></span>` : r.status === "closed" ? "" : `<button class="btn ghost" type="button" data-remove="${esc(r.g)}" ${dis}>${rmLabel}</button>`}`)}
      ${reasonField(r, code, dis)}
      ${r.ln && r.ln.updatedBy && r.ln.updatedAt ? `<div class="hint" style="margin-top:6px">Last edited by ${uid(r.ln.updatedBy)} \xB7 ${new Date(r.ln.updatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</div>` : ""}
    </td></tr>` : ""}`;
  }).join("");
  return `<div class="toolbar">${buSelect(code)}<div class="spacer"></div>${addCtl}</div>
    <div id="bSum">${vBuildSum(M2, bu, rows)}</div>
    <div class="tbl-wrap bt-wrap"><table class="bt">${BT_COLS}${BT_HEAD}
      <tbody>${body || `<tr><td colspan="10" class="empty">No budget or actuals for this BU yet. Add a GL line to start its forecast.</td></tr>`}
      ${body ? `<tr class="tot"><td>Total</td><td></td><td class="n">${money(tb("b"))}</td><td class="n">${money(tb("a"))}</td><td></td><td class="n" id="btRem">${money(tb("rem"))}</td><td class="n" id="btLand">${money(tb("landing"))}</td><td class="n ${tb("varc") < 0 ? "neg" : "pos"}" id="btVar">${money(tb("varc"))}</td><td></td><td></td></tr>` : ""}</tbody></table></div>
    <p class="hint" style="margin-top:10px">Remaining comes only from items. A line without items forecasts nothing more and lands at its actual; its starting point (budget rate \xD7 volume, run rate, budget left or prior-year pattern) is shown so you can add it as an item in one click. Closed lines stop at actual. A line with actuals can be closed but not deleted.</p>`;
}
var reasonPill = (r) => r.needReason && r.status !== "closed" ? `<span class="pill ${r.hasReason ? "neutral" : "warn"}">${r.hasReason ? "Explained" : "Needs reason"}</span>` : "";
function vActuals(M2) {
  const a = S.actuals, p = S.preview;
  const ent = a ? ["PNN", "PNS", "SMI"].map((e) => ({ e, t: a.rows.filter((r) => r[0] === e && !isExcluded(r[2])).reduce((s, r) => s + (+r[2].slice(0, 4) < 5e3 ? -r[3] : r[3]), 0) })) : [];
  const excl = a ? a.rows.filter((r) => isExcluded(r[2])).reduce((s, r) => s + r[3], 0) : 0;
  return `<div class="grid2">
    <div class="stack">
      <div class="drop" id="drop" tabindex="0" role="button" aria-label="Upload BU Summary workbook">
        <h3>Drop the BU Summary workbook here</h3>
        <div class="muted">Reads the PNN BU, PNS BU and SMI BU tabs, plus QB Back Up for monthly run rates and transactions. The three QuickBooks P&amp;L by Business Unit exports work too.</div>
        <div style="margin-top:14px"><button class="btn primary" type="button" id="pickBtn" ${S.isAdmin ? "" : "disabled"}>Choose file</button></div>
        ${S.isAdmin ? "" : `<div class="hint" style="margin-top:8px">Finance loads actuals.</div>`}
      </div>
      ${p ? vPreview(p) : ""}
    </div>
    <section class="panel">
      <div class="panel-h"><h2>Loaded actuals</h2>${a ? `<span class="pill neutral">${esc(a.fileName || "")}</span>` : ""}</div>
      ${a ? `<div class="tbl-wrap" style="border:0"><table class="kv"><tbody>
        <tr><td>Close date</td><td class="n">${fmtDate(a.closeDate)}</td></tr>
        <tr><td>Months elapsed / remaining</td><td class="n">${M2.ck.elapsed} / ${M2.ck.remaining}</td></tr>
        ${ent.map((x) => `<tr><td>${x.e} cost HTD</td><td class="n">${money(x.t)}</td></tr>`).join("")}
        <tr class="tot"><td>Total cost HTD</td><td class="n">${money(M2.actual)}</td></tr>
        ${excl ? `<tr><td>Excluded from forecast (${[...EXCLUDED].map((g) => esc(g.slice(7))).join(", ")})</td><td class="n">${money(excl)}</td></tr>` : ""}
        <tr><td>GL \xD7 BU lines</td><td class="n">${a.rows.length}</td></tr>
        <tr><td>GLs with monthly QB detail</td><td class="n">${Object.keys(a.monthly || {}).length}</td></tr>
        <tr><td>Loaded</td><td class="n">${new Date(a.uploadedAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}</td></tr>
      </tbody></table></div>` : `<div class="empty">Nothing loaded yet. Upload the BU Summary to start.</div>`}
      ${S.uploads.length ? `<div class="eyebrow" style="margin:16px 0 6px">Upload history</div><div class="tbl-wrap" style="border:0"><table><thead><tr><th>Close</th><th>File</th><th class="n">Cost HTD</th></tr></thead><tbody>
        ${S.uploads.map((u) => `<tr><td>${fmtDate(u.closeDate)}</td><td><div class="gl-name">${esc(u.fileName || "")}</div></td><td class="n">${money(u.total || 0)}</td></tr>`).join("")}</tbody></table></div>` : ""}
    </section></div>`;
}
function vPreview(p) {
  if (p.error !== void 0) return `<section class="panel"><div class="check"><i class="dot no"></i><b>${esc(p.error)}</b></div></section>`;
  const tot = p.rows.reduce((s, r) => s + (+r[2].slice(0, 4) < 5e3 ? 0 : r[3]), 0);
  return `<section class="panel"><div class="panel-h"><h2>Check before loading</h2><span class="pill neutral">${esc(p.fileName)}</span></div>
    <div class="checks">
      ${p.ent.map((e) => `<div class="check"><i class="dot ${e.tie === null ? "wn" : Math.abs(e.tie) < 1 ? "ok" : "no"}"></i><b>${e.e}</b><span class="num">${money(e.cost)}</span><span class="muted">${e.tie === null ? "no Net Income row to tie to" : Math.abs(e.tie) < 1 ? "ties to Net Income" : "off from Net Income by " + money(e.tie)}</span></div>`).join("")}
      ${["PNN", "PNS", "SMI"].filter((e) => !p.ent.find((x) => x.e === e)).map((e) => `<div class="check"><i class="dot wn"></i><b>${e}</b><span class="muted">not found in this file</span></div>`).join("")}
      <div class="check"><i class="dot ${p.monthlyCount ? "ok" : "wn"}"></i><span>${p.monthlyCount ? `QB Back Up found: ${p.monthlyCount} GLs with monthly detail` : "No QB Back Up tab: run rates fall back to actual \xF7 months"}</span></div>
      ${p.newGLs.length ? `<div class="check"><i class="dot wn"></i><span>New GLs added as run-rate lines: ${p.newGLs.map(esc).join(", ")}</span></div>` : ""}
      ${vTxCheck(p.txCheck)}
      ${p.txCheck && p.closeDate && p.txCheck.to.slice(0, 7) < p.closeDate.slice(0, 7) ? `<div class="check"><i class="dot no"></i><span>Transactions end ${fmtDate(p.txCheck.to)}, before the ${fmtDate(p.closeDate)} close date. If this workbook is an earlier month's, set the close date to match, or the forecast counts the wrong number of months.</span></div>` : ""}
    </div>
    <div class="row" style="margin-top:6px"><label for="closeIn">Close date</label><input class="in" type="date" id="closeIn" value="${p.closeDate || ""}" style="width:170px;text-align:left">
      <div class="spacer"></div><span class="num">${money(tot)} cost HTD</span>
      <button class="btn ghost" id="cancelPrev" type="button">Cancel</button><button class="btn primary" id="loadBtn" type="button" ${p.ent.length && !S.loadingActuals ? "" : "disabled"}>${S.loadingActuals ? "Loading\u2026" : "Load actuals"}</button></div>
  </section>`;
}
function vTxCheck(c) {
  if (!c) return `<div class="check"><i class="dot wn"></i><span>No QB Back Up transactions in this file: the Transactions tab keeps the last ones loaded</span></div>`;
  const top = c.diff.slice(0, 4).map((x) => `${esc(glName(x.g))} ${money(x.d)}`).join(" \xB7 ");
  return `<div class="check"><i class="dot ok"></i><span>${nf0.format(c.count)} transactions, ${fmtDate(c.from)} to ${fmtDate(c.to)} \xB7 ${money(c.total)} cost</span></div>
    ${c.noBU ? `<div class="check"><i class="dot wn"></i><span>${c.noBU} transaction${c.noBU > 1 ? "s have" : " has"} no BU in the Name column: shown under No BU</span></div>` : ""}
    ${c.diff.length ? `<div class="check"><i class="dot wn"></i><span>${c.diff.length} GL${c.diff.length > 1 ? "s differ" : " differs"} from the BU tabs (BU tab \u2212 transactions): ${top}${c.diff.length > 4 ? " \u2026" : ""}</span></div>` : ""}
    ${c.missing.length ? `<div class="check"><i class="dot wn"></i><span>${c.missing.length} GL${c.missing.length > 1 ? "s have" : " has"} no transaction detail (e.g. payroll and benefits): ${c.missing.slice(0, 4).map((g) => esc(g.slice(0, 4))).join(", ")}${c.missing.length > 4 ? " \u2026" : ""}</span></div>` : ""}`;
}
var txBUName = (c) => c === TX_NOBU ? "No BU" : BU_BY_CODE[c] || c;
var TX_SHOW = 500;
function vTxns(M2) {
  if (!S.detail) return `<section class="panel"><div class="empty">Loading transactions\u2026</div></section>`;
  const all = S.detail.rows;
  if (!all.length) return `<section class="panel"><div class="empty">${S.detail.error ? "Transactions couldn't be loaded. Reload to try again." : "No transactions loaded yet. Finance uploads the BU Summary workbook (with its QB Back Up tab) on the Actuals tab."}</div></section>`;
  const f = S.tx, q = f.q.trim().toLowerCase();
  const byBG = all.filter((t) => (f.bu === "all" || t.bu === f.bu) && (!f.gl || t.r[5] === f.gl));
  const rows = byBG.filter((t) => (!f.month || t.r[0].startsWith(f.month)) && (!q || [t.r[1], t.r[2], t.r[3], t.r[4], t.r[6]].join(" ").toLowerCase().includes(q)));
  const total = sum(rows, (t) => t.r[7]);
  const gls = [...new Set(all.map((t) => t.r[5]))].sort(), months = [...new Set(all.map((t) => t.r[0].slice(0, 7)))].sort().reverse();
  const meta = S.detail.meta, close = S.actuals && S.actuals.closeDate;
  let rec = "";
  if (!f.month && !q && f.bu !== TX_NOBU && !(f.gl && isExcluded(f.gl))) {
    const bn = f.bu === "all" ? null : BU_BY_CODE[f.bu];
    let act = 0;
    for (const [g, row] of Object.entries(M2.actBU)) if (!f.gl || g === f.gl) {
      for (const [bu, v] of Object.entries(row)) if (!bn || bu === bn) act += v;
    }
    const det = sum(byBG.filter((t) => +t.r[5].slice(0, 4) >= 5e3 && !isExcluded(t.r[5])), (t) => t.r[7]);
    rec = `<div class="kpis" style="margin-bottom:12px">
      <div class="kpi"><div class="eyebrow">Actual HTD \xB7 BU tabs</div><div class="v num" style="font-size:20px">${money(act)}</div><div class="s">${close ? "through " + fmtDate(close) : ""}</div></div>
      <div class="kpi"><div class="eyebrow">In transactions</div><div class="v num" style="font-size:20px">${money(det)}</div><div class="s">${meta && meta.to ? "through " + fmtDate(meta.to) : ""}</div></div>
      <div class="kpi"><div class="eyebrow">Not in transaction detail</div><div class="v num" style="font-size:20px">${dash(act - det)}</div><div class="s">payroll, journal entries${meta && meta.to && close && meta.to < close ? ", later months" : ""}</div></div>
      <div class="kpi"><div class="eyebrow">Transactions</div><div class="v num" style="font-size:20px">${nf0.format(byBG.length)}</div><div class="s">${f.gl ? esc(glName(f.gl)) : "all GLs"}</div></div></div>`;
  }
  const any = f.bu !== "all" || f.gl || f.month || q, showBU = f.bu === "all", showGL = !f.gl, nc = 7 + (showBU ? 1 : 0) + (showGL ? 1 : 0);
  return `<div class="toolbar">
      <select class="sel" id="txBU" aria-label="Business unit"><option value="all">All BUs</option>${BUS.map((b) => `<option value="${buCode(b)}" ${f.bu === buCode(b) ? "selected" : ""}>${esc(b)}</option>`).join("")}<option value="${TX_NOBU}" ${f.bu === TX_NOBU ? "selected" : ""}>No BU</option></select>
      <select class="sel" id="txGL" aria-label="GL"><option value="">All GLs</option>${gls.map((g) => `<option value="${esc(g)}" ${f.gl === g ? "selected" : ""}>${esc(glName(g))}</option>`).join("")}</select>
      <select class="sel" id="txMonth" aria-label="Month"><option value="">All months</option>${months.map((k) => `<option value="${k}" ${f.month === k ? "selected" : ""}>${monthLbl(k)}</option>`).join("")}</select>
      <input class="search" id="txQ" type="search" placeholder="Search vendor, memo, number" value="${esc(f.q)}" autocomplete="off">
      ${any ? `<button class="btn ghost" type="button" id="txClear">Clear filters</button>` : ""}
      <div class="spacer"></div><span class="hint">${meta && meta.fileName ? esc(meta.fileName) + " \xB7 " : ""}harvest to date</span>
    </div>
    ${rec}
    <div class="tbl-wrap tx-wrap"><table>
      <thead><tr><th>Date</th>${showBU ? "<th>Business unit</th>" : ""}${showGL ? "<th>GL</th>" : ""}<th>Type</th><th>Num</th><th>Vendor</th><th>Memo</th><th>Entity</th><th class="n">Amount</th></tr></thead>
      <tbody>${rows.slice(0, TX_SHOW).map((t) => `<tr><td class="num">${fmtDate(t.r[0])}</td>${showBU ? `<td>${esc(txBUName(t.bu))}</td>` : ""}${showGL ? `<td><div class="gl-name" title="${esc(glName(t.r[5]))}">${esc(glName(t.r[5]))}</div></td>` : ""}<td>${esc(t.r[1])}</td><td>${esc(t.r[2])}</td><td>${esc(t.r[3])}</td><td class="memo">${esc(t.r[4])}</td><td>${esc(t.r[6])}</td><td class="n ${t.r[7] < 0 ? "neg" : ""}">${money(t.r[7])}</td></tr>`).join("") || `<tr><td colspan="${nc}" class="empty">No transactions match these filters.</td></tr>`}
      <tr class="tot"><td colspan="${nc - 1}">${nf0.format(rows.length)} transaction${rows.length === 1 ? "" : "s"}${rows.length > TX_SHOW ? ` \xB7 showing the latest ${TX_SHOW}, narrow the filters to see the rest` : ""}</td><td class="n">${money(total)}</td></tr>
      </tbody></table></div>`;
}
var subLabel = (s) => `${s.kind === "final" ? "Final" : s.bu} \xB7 ${s.closeDate ? fmtDate(s.closeDate).replace(/, \d{4}$/, "") + " close" : "no actuals"} \xB7 ${new Date(s.submittedAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}`;
function finalStatus(M2) {
  const close = S.actuals ? S.actuals.closeDate : null, active = buTable(M2).filter((r) => r.b || r.a || r.rem).map((r) => r.bu);
  const done = active.filter((b) => S.subs.some((s) => s.kind === "bu" && s.code === buCode(b) && s.closeDate === close));
  return { close, active, done, missing: active.filter((b) => !done.includes(b)), final: S.subs.find((s) => s.kind === "final" && s.closeDate === close) };
}
var liveState = () => S.view ? S.view.live : { drivers: S.drivers, actuals: S.actuals, builds: S.builds };
function vCompare() {
  const s = S.subs.find((x) => x.id === S.cmp), st = S.cmpState;
  if (!s || !st || st.sub.id !== s.id) return "";
  const A = compute(st), B = compute(liveState());
  const by = {};
  if (s.kind === "final") {
    for (const r of buTable(A)) (by[r.bu] = by[r.bu] || { k: r.bu, s: 0, l: 0, why: "" }).s = r.landing;
    for (const r of buTable(B)) (by[r.bu] = by[r.bu] || { k: r.bu, s: 0, l: 0, why: "" }).l = r.landing;
  } else {
    const bu = BU_BY_CODE[s.code || ""];
    for (const r of buLines(A, bu)) by[r.g] = { k: glName(r.g), s: r.landing, l: 0, why: r.ln && r.ln.reason || "" };
    for (const r of buLines(B, bu)) (by[r.g] = by[r.g] || { k: glName(r.g), s: 0, l: 0, why: "" }).l = r.landing;
  }
  const rows = Object.values(by).sort((x, y) => x.k.localeCompare(y.k)).filter((r) => Math.abs(r.s) >= 0.5 || Math.abs(r.l) >= 0.5);
  const ts = sum(rows, (r) => r.s), tl = sum(rows, (r) => r.l), why = s.kind === "bu";
  return `<section class="panel" style="margin-bottom:16px"><div class="panel-h"><h2>Submitted vs live \xB7 ${esc(subLabel(s))}</h2><button class="btn ghost" type="button" id="cmpClose">Close</button></div>
    <div class="tbl-wrap" style="border:0"><table><thead><tr><th>${s.kind === "final" ? "Business unit" : "GL"}</th><th class="n">Submitted landing</th><th class="n">Live landing</th><th class="n">Change</th>${why ? "<th>Reason as submitted</th>" : ""}</tr></thead><tbody>
    ${rows.map((r) => {
    const c = r.l - r.s;
    return `<tr><td><div class="gl-name" title="${esc(r.k)}">${esc(r.k)}</div></td><td class="n">${dash(r.s)}</td><td class="n">${dash(r.l)}</td><td class="n ${c > 0.5 ? "neg" : c < -0.5 ? "pos" : ""}">${Math.abs(c) < 0.5 ? "\u2013" : money(c)}</td>${why ? `<td style="white-space:normal;min-width:200px">${esc(r.why)}</td>` : ""}</tr>`;
  }).join("")}
    <tr class="tot"><td>Total</td><td class="n">${money(ts)}</td><td class="n">${money(tl)}</td><td class="n ${tl - ts > 0.5 ? "neg" : tl - ts < -0.5 ? "pos" : ""}">${money(tl - ts)}</td>${why ? "<td></td>" : ""}</tr>
    </tbody></table></div><p class="hint" style="margin-top:8px">Change = live minus submitted. Positive means the forecast went up since it was submitted.</p></section>`;
}
function vSubs(M2) {
  const fs = finalStatus(M2), f = S.subF, closes = [...new Set(S.subs.map((s) => s.closeDate || ""))].sort().reverse();
  const canFinal = S.isAdmin && S.canWrite && !S.view;
  const latestKey = {};
  for (const s of S.subs) {
    const k = s.kind + "|" + (s.code || "") + "|" + (s.closeDate || "");
    if (!latestKey[k]) latestKey[k] = s.id;
  }
  const inFinal = new Set(S.subs.filter((s) => s.kind === "final").flatMap((s) => Object.values(s.buSubs || {})));
  const list = S.subs.filter((s) => (!f.close || (s.closeDate || "") === f.close) && (f.kind === "all" || s.kind === f.kind) && (f.bu === "all" || s.code === f.bu));
  const finalPanel = `<section class="panel"><div class="panel-h"><h2>Final submission${fs.close ? " \xB7 " + fmtDate(fs.close) + " close" : ""}</h2>
      ${fs.final ? `<span class="pill under">Final submitted</span>` : `<span class="pill neutral">Not final yet</span>`}</div>
    ${!fs.close ? `<div class="muted">Load actuals first. Submissions are tied to the close they were made on.</div>` : `
    <div class="check" style="margin-bottom:8px"><i class="dot ${fs.missing.length ? "wn" : "ok"}"></i><span>${fs.done.length} of ${fs.active.length} BUs submitted on this close</span></div>
    ${fs.missing.length ? `<div class="hint" style="margin-bottom:10px">Not submitted: ${fs.missing.map((b) => `<button class="rr" style="font-family:var(--f-body);font-size:12px" type="button" data-gobu="${buCode(b)}">${esc(b)}</button>`).join(", ")}</div>` : ""}
    ${fs.final ? `<div class="muted" style="font-size:12px;margin-bottom:10px">Final by ${uid(fs.final.submittedBy)} \xB7 ${fmtStamp(fs.final.submittedAt)} \xB7 landing ${money(fs.final.totals.landing)}</div>` : ""}
    ${canFinal ? S.confirmFinal ? `<span class="confirm">${fs.missing.length} BU${fs.missing.length > 1 ? "s haven't" : " hasn't"} submitted. Submit final anyway? <button class="btn primary" type="button" id="finalBtn" ${S.submitting ? "disabled" : ""}>Submit final</button><button class="btn ghost" type="button" id="finalNo">Not yet</button></span>` : `<button class="btn primary" type="button" id="finalBtn" ${S.submitting ? "disabled" : ""}>${fs.final ? "Resubmit final forecast" : "Submit final forecast"}</button>` : `<div class="hint">${S.view ? "Go back to live to submit." : "Directors submit their BUs; finance makes the final submission."}</div>`}`}
  </section>`;
  return `${vCompare()}
    <div class="grid2" style="margin-bottom:16px">${finalPanel}
      <section class="panel"><div class="panel-h"><h2>How this works</h2></div><div class="hint" style="font-size:13px">Each director submits their BU from Build forecast. That saves the BU's lines, items and reasons as they stand, on this close's actuals. Finance's final submission saves the whole company forecast. Pick any submission to view it read only on every tab, or compare it with the live forecast.</div></section>
    </div>
    <div class="toolbar">
      <select class="sel" id="subClose" aria-label="Close"><option value="">All closes</option>${closes.map((c) => `<option value="${esc(c)}" ${f.close === c ? "selected" : ""}>${c ? fmtDate(c) + " close" : "No actuals"}</option>`).join("")}</select>
      <select class="sel" id="subBU" aria-label="Business unit"><option value="all">All BUs</option>${BUS.map((b) => `<option value="${buCode(b)}" ${f.bu === buCode(b) ? "selected" : ""}>${esc(b)}</option>`).join("")}</select>
      <select class="sel" id="subKind" aria-label="Type"><option value="all">Final and BU</option><option value="final" ${f.kind === "final" ? "selected" : ""}>Final only</option><option value="bu" ${f.kind === "bu" ? "selected" : ""}>BU only</option></select>
      <div class="spacer"></div><span class="hint">${list.length} of ${S.subs.length}</span>
    </div>
    <div class="tbl-wrap"><table><thead><tr><th>Submitted</th><th>Forecast</th><th>Close</th><th>By</th><th class="n">Landing</th><th class="n">Var to budget</th><th></th><th></th></tr></thead><tbody>
    ${list.map((s) => {
    const latest = latestKey[s.kind + "|" + (s.code || "") + "|" + (s.closeDate || "")] === s.id, v = s.totals.varc;
    return `<tr class="${S.view && S.view.sub.id === s.id ? "focus" : ""}"><td class="num">${new Date(s.submittedAt).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}</td>
      <td>${s.kind === "final" ? `<span class="pill under">Final</span>` : esc(s.bu)} ${latest ? `<span class="pill neutral">Latest</span>` : ""}${inFinal.has(s.id) ? ` <span class="pill neutral">In final</span>` : ""}</td>
      <td>${s.closeDate ? fmtDate(s.closeDate) : "\u2013"}</td><td>${uid(s.submittedBy)}</td>
      <td class="n">${money(s.totals.landing)}</td><td class="n ${v < -0.5 ? "neg" : v > 0.5 ? "pos" : ""}">${money(v)}</td>
      <td><button class="btn ghost" type="button" data-subview="${esc(s.id)}">View</button></td><td><button class="btn ghost" type="button" data-subcmp="${esc(s.id)}" title="Compare with the live forecast">Compare</button></td></tr>`;
  }).join("") || `<tr><td colspan="8" class="empty">${S.subs.length ? "No submissions match these filters." : "No submissions yet. Directors submit from Build forecast."}</td></tr>`}
    </tbody></table></div>`;
}

// vendor/gripcasting/src/web/app.ts
var $ = (id) => document.getElementById(id);
var main = $("main");
var M;
function render() {
  M = compute(modelState());
  renderHeader();
  const act = document.activeElement, aid = act && act.id, sel = act && act.selectionStart;
  const views = { overview: vOverview, revenue: vRevenue, build: vBuild, actuals: vActuals, txns: vTxns, subs: vSubs };
  if (S.tab === "txns") ensureDetail();
  main.innerHTML = (views[S.tab] || vOverview)(M);
  fillNames();
  if (aid) {
    const n = document.getElementById(aid);
    if (n && n !== document.body) {
      n.focus();
      try {
        if (sel != null) n.setSelectionRange(sel, sel);
      } catch {
      }
    }
  }
}
function renderHeader() {
  const ck = M.ck;
  $("months").innerHTML = MONTHS.map((m, i) => `<i class="${i < ck.elapsed ? "on" : ""}" title="${m}"></i>`).join("");
  $("clockTxt").textContent = S.actuals ? `Actuals through ${fmtDate(S.actuals.closeDate)} \xB7 ${ck.remaining} months to forecast` : "No actuals loaded";
  document.querySelectorAll(".tab").forEach((t) => t.setAttribute("aria-selected", t.dataset.tab === S.tab ? "true" : "false"));
  $("saveState").textContent = S.saving;
}
var renderHeaderOnly = () => {
  $("saveState").textContent = S.saving;
};
function refreshLive() {
  M = compute(modelState());
  renderHeader();
  if (S.tab === "revenue") $("revOut").innerHTML = vRevOut(M);
}
function refreshBuild() {
  if (S.buildBU === "all") {
    render();
    return;
  }
  M = compute(modelState());
  renderHeader();
  const bu = BU_BY_CODE[S.buildBU], rows = buLines(M, bu);
  const bs = document.getElementById("bSum");
  if (bs) bs.innerHTML = vBuildSum(M, bu, rows);
  for (const r of rows) {
    const tr = document.querySelector(`tr[data-bline="${CSS.escape(r.g)}"]`);
    if (!tr) continue;
    tr.querySelector('[data-bo="src"]').innerHTML = srcPill(r);
    tr.querySelector('[data-bo="rem"]').textContent = r.rem && Math.abs(r.rem) >= 0.5 ? money(r.rem) : "\u2013";
    tr.querySelector('[data-bo="landing"]').textContent = Math.abs(r.landing) >= 0.5 ? money(r.landing) : "\u2013";
    const v = tr.querySelector('[data-bo="varc"]');
    v.textContent = money(r.varc);
    v.className = "n " + (r.varc < -0.5 ? "neg" : r.varc > 0.5 ? "pos" : "");
    tr.querySelector('[data-bo="reason"]').innerHTML = reasonPill(r);
    for (const it of r.ln && r.ln.items || []) {
      const c = document.querySelector(`[data-ittot="${it.id}"]`);
      if (c) c.innerHTML = itemTotalCell(M, it);
      const h = document.querySelector(`[data-ithrs="${it.id}"]`);
      if (h) h.textContent = nf0.format(itemQty(it, M.volNow));
    }
  }
  const tb = (k) => rows.reduce((s, r) => s + r[k], 0), set = (id, v) => {
    const e = document.getElementById(id);
    if (e) e.textContent = money(v);
  };
  set("btRem", tb("rem"));
  set("btLand", tb("landing"));
  set("btVar", tb("varc"));
  const bv = document.getElementById("btVar");
  if (bv) bv.className = "n " + (tb("varc") < 0 ? "neg" : "pos");
  fillNames();
}
function fillNames() {
  document.querySelectorAll("[data-uid]").forEach((e) => {
    const id = e.dataset.uid || "";
    e.textContent = id === S.me?.email ? "you" : S.users[id] || id || "someone";
  });
}
var toastT;
function toast(msg) {
  let t = document.querySelector(".toast");
  if (!t) {
    t = document.createElement("div");
    t.className = "toast";
    t.setAttribute("role", "status");
    document.body.appendChild(t);
  }
  t.textContent = msg;
  clearTimeout(toastT);
  toastT = window.setTimeout(() => t.remove(), 3200);
}
var driversQ;
var buildQ = {};
var timers = {};
var pending = {};
var driversDirty = false;
var buildDirty = {};
var clone = (x) => JSON.parse(JSON.stringify(x));
function saveFailed(e, what) {
  const err = e instanceof ApiError ? e : new ApiError("failed", "Couldn't save.");
  if (err.code === "conflict") {
    S.saving = "Not saved";
    toast(err.message);
    void reloadState();
  } else if (err.code === "forbidden") {
    S.saving = "Read only";
    if (what !== "drivers") S.canWrite = false;
    render();
    toast(err.message);
  } else {
    S.saving = "Not saved";
    toast(err.message || "Couldn't save. Check your connection.");
  }
}
function schedule(key, ms, run) {
  S.saving = "Saving\u2026";
  renderHeaderOnly();
  clearTimeout(timers[key]);
  pending[key] = run;
  timers[key] = window.setTimeout(() => {
    delete pending[key];
    void run();
  }, ms);
}
async function flushSaves() {
  for (const [k, run] of Object.entries(pending)) {
    clearTimeout(timers[k]);
    delete pending[k];
    await run();
  }
}
function scheduleSave() {
  if (S.view || !S.isAdmin) return;
  driversDirty = true;
  schedule("drivers", 900, async () => {
    try {
      await driversQ.save(clone(S.drivers));
      S.saving = "Saved";
    } catch (e) {
      saveFailed(e, "drivers");
    }
    driversDirty = false;
    renderHeaderOnly();
  });
}
function scheduleBuildSave(code) {
  if (S.view) return;
  buildDirty[code] = true;
  schedule("build:" + code, 800, async () => {
    try {
      await queueFor(code).save(clone(S.builds[code]));
      S.saving = "Saved";
    } catch (e) {
      saveFailed(e, code);
    }
    buildDirty[code] = false;
    renderHeaderOnly();
  });
}
function queueFor(code) {
  return buildQ[code] = buildQ[code] || new SaveQueue(S.builds[code]?.version ?? null, async (doc, v) => {
    const { doc: fresh } = await api.saveBuild(code, doc, v);
    const cur = S.builds[code];
    if (cur) {
      for (const [g, ln] of Object.entries(fresh.lines)) if (cur.lines[g]) {
        cur.lines[g].updatedAt = ln.updatedAt;
        cur.lines[g].updatedBy = ln.updatedBy;
      }
      cur.version = fresh.version;
    }
    return fresh.version ?? null;
  });
}
function applyState(st, first) {
  let changed = false;
  S.users = Object.fromEntries(st.users.map((u) => [u.email, u.name]));
  const target = S.view ? S.view.live : S;
  if (st.actuals && (first || st.actuals.uploadedAt !== target.actuals?.uploadedAt || st.actuals.closeDate !== target.actuals?.closeDate)) {
    registerActualGLs(st.actuals);
    target.actuals = st.actuals;
    changed = true;
  }
  if (!st.actuals && target.actuals) {
    target.actuals = null;
    changed = true;
  }
  if (st.drivers && !driversDirty && (first || st.drivers.version !== S.driversVersion)) {
    target.drivers = mergeDrivers(st.drivers);
    S.driversVersion = st.drivers.version;
    if (driversQ) driversQ.version = st.drivers.version;
    changed = true;
  }
  if (first && !st.drivers) target.drivers = defaults();
  registerBuildGLs(st.builds);
  for (const [code, doc] of Object.entries(st.builds)) {
    if (buildDirty[code] || pending["build:" + code]) continue;
    if (first || doc.version !== target.builds[code]?.version || doc.submittedAt !== target.builds[code]?.submittedAt) {
      target.builds[code] = doc;
      if (buildQ[code]) buildQ[code].version = doc.version ?? null;
      changed = true;
    }
  }
  S.uploads = st.uploads;
  if (JSON.stringify(st.submissions.map((s) => s.id)) !== JSON.stringify(S.subs.map((s) => s.id))) {
    S.subs = st.submissions;
    changed = true;
    renderViewSel();
  }
  return changed;
}
async function reloadState() {
  try {
    for (const code of Object.keys(buildDirty)) buildDirty[code] = false;
    const st = await api.state();
    applyState(st, true);
    render();
  } catch {
  }
}
async function poll() {
  if (document.hidden) return;
  try {
    const changed = applyState(await api.state(), false);
    if (!changed || S.view) return;
    const a = document.activeElement;
    if (a && a.tagName === "INPUT" && main.contains(a)) {
      if (S.tab === "build") refreshBuild();
      else if (S.tab === "revenue") refreshLive();
    } else render();
  } catch {
  }
}
function ensureDetail() {
  if (S.detail || S.detailLoading) return;
  S.detailLoading = true;
  api.transactions().then((d) => {
    S.detail = d;
  }).catch(() => {
    S.detail = { meta: null, rows: [], error: true };
  }).finally(() => {
    S.detailLoading = false;
    if (S.tab === "txns") render();
  });
}
async function handleFiles(files) {
  if (!files || !files.length || !S.isAdmin) return;
  S.tab = "actuals";
  try {
    S.preview = await parseFiles([...files]);
  } catch {
    S.preview = { fileName: [...files].map((f) => f.name).join(", "), error: "This file couldn't be read. Check that it's an .xlsx workbook." };
  }
  render();
}
async function loadActuals() {
  const p = S.preview;
  if (!p || p.error !== void 0 || !p.closeDate) return;
  S.loadingActuals = true;
  render();
  try {
    const r = await api.uploadActuals({ closeDate: p.closeDate, fileName: p.fileName, rows: p.rows, monthly: p.monthly, transactions: p.tx });
    S.actuals = r.actuals;
    registerActualGLs(r.actuals);
    p.newGLs.forEach(registerGL);
    S.uploads = [r.upload, ...S.uploads].slice(0, 12);
    if (p.tx.length) S.detail = { meta: { closeDate: p.closeDate, fileName: p.fileName, from: p.txCheck?.from || null, to: p.txCheck?.to || null }, rows: p.tx.slice().sort((a, b) => b.r[0].localeCompare(a.r[0])) };
    S.preview = null;
    toast("Actuals loaded");
  } catch (e) {
    toast(e instanceof ApiError ? e.message : "Couldn't load actuals.");
  }
  S.loadingActuals = false;
  render();
}
async function submitForecast(kind) {
  if (S.view || !S.canWrite || S.submitting) return;
  S.submitting = true;
  render();
  try {
    await flushSaves();
    const code = kind === "bu" ? S.buildBU : null;
    const sub = await api.submit({ kind, code });
    S.subs = [sub, ...S.subs.filter((s) => s.id !== sub.id)];
    if (kind === "bu" && code) {
      const d = curDoc();
      d.submittedAt = sub.submittedAt;
      d.submittedBy = sub.submittedBy;
    }
    S.confirmFinal = false;
    renderViewSel();
    toast(kind === "final" ? "Final forecast submitted" : "Forecast submitted");
  } catch (e) {
    toast(e instanceof ApiError ? e.message : "Submission didn't go through. Try again.");
  }
  S.submitting = false;
  render();
}
var snaps = {};
async function subState(id) {
  const s = S.subs.find((x) => x.id === id);
  if (!s) return null;
  try {
    const snap = snaps[id] = snaps[id] || await api.snapshot(id);
    const live = S.view ? S.view.live.actuals : S.actuals;
    let a = s.closeDate && live && live.closeDate === s.closeDate ? live : null;
    if (!a && s.closeDate) a = await api.actuals(s.closeDate);
    if (s.closeDate && !a) return null;
    if (a) registerActualGLs(a);
    registerBuildGLs(snap.builds);
    return { sub: s, drivers: mergeDrivers(snap.drivers), actuals: a, builds: clone(snap.builds) };
  } catch {
    return null;
  }
}
async function enterView(id) {
  if (!id) {
    exitView();
    return;
  }
  const st = await subState(id);
  if (!st) {
    toast("That submission's actuals or snapshot aren't available.");
    renderViewSel();
    return;
  }
  await flushSaves();
  const live = S.view ? S.view.live : { drivers: S.drivers, actuals: S.actuals, builds: S.builds, canWrite: S.canWrite, isAdmin: S.isAdmin };
  S.view = { sub: st.sub, live };
  Object.assign(S, { drivers: st.drivers, actuals: st.actuals, builds: st.builds, canWrite: false, isAdmin: false, preview: null, addGL: null, confirmDel: null });
  if (S.tab === "subs" || S.tab === "actuals" || S.tab === "txns") S.tab = st.sub.kind === "bu" ? "build" : "overview";
  if (st.sub.kind === "bu" && st.sub.code) S.buildBU = st.sub.code;
  renderViewSel();
  render();
  window.scrollTo(0, 0);
}
function exitView() {
  if (!S.view) return;
  const l = S.view.live;
  S.view = null;
  Object.assign(S, { drivers: l.drivers, actuals: l.actuals, builds: l.builds, canWrite: l.canWrite, isAdmin: l.isAdmin });
  renderViewSel();
  render();
}
var monthOf = (close) => (/* @__PURE__ */ new Date(close + "T00:00:00")).toLocaleDateString("en-US", { month: "short" });
function renderViewSel() {
  const sel = $("monthSel"), bar = $("viewBar"), cur = S.view ? S.view.sub.id : "";
  const finals = /* @__PURE__ */ new Map();
  for (const s2 of S.subs) if (s2.kind === "final" && s2.closeDate && !finals.has(s2.closeDate)) finals.set(s2.closeDate, s2);
  const opt = (id, label, title) => `<option value="${esc(id)}" title="${esc(title)}">${esc(label)}</option>`;
  const months = [...finals.entries()].sort(([a], [b]) => a.localeCompare(b));
  const other = S.view && !months.some(([, s2]) => s2.id === cur) ? opt(cur, S.view.sub.kind === "final" ? `${monthOf(S.view.sub.closeDate || "")} (earlier final)` : `${S.view.sub.bu.slice(3)} submission`, "") : "";
  sel.innerHTML = months.map(([close, s2]) => opt(s2.id, monthOf(close), `${monthOf(close)} final forecast \xB7 ${fmtDate(close)} close \xB7 submitted ${fmtStamp(s2.submittedAt)}`)).join("") + other + opt("", "Live", "The working forecast");
  sel.value = cur;
  if (!S.view) {
    bar.hidden = true;
    bar.innerHTML = "";
    return;
  }
  const s = S.view.sub;
  bar.hidden = false;
  bar.innerHTML = `<b>${s.kind === "final" ? s.closeDate ? monthOf(s.closeDate) + " final forecast" : "Final forecast" : esc(s.bu) + " forecast"}</b><span>submitted ${fmtStamp(s.submittedAt)} by <span data-uid="${esc(s.submittedBy || "")}">someone</span>${s.closeDate ? ` on ${fmtDate(s.closeDate)} actuals` : ""}. Read only.</span><div class="spacer"></div><button class="btn" type="button" id="backLive">Back to live</button>`;
  fillNames();
}
async function exportXlsx() {
  const XLSX2 = await init_xlsx().then(() => xlsx_exports);
  const Mx = compute(modelState()), wb = XLSX2.utils.book_new(), add = (rows, name) => XLSX2.utils.book_append_sheet(wb, XLSX2.utils.aoa_to_sheet(rows), name);
  add([["2026H Forecast"], ["Close date", S.actuals?.closeDate || ""], [], ["", "Amount"], ["Revenue", round2(Mx.revenue)], ["Cost budget", round2(Mx.budget)], ["Cost actual HTD", round2(Mx.actual)], ["Cost remaining", round2(Mx.cost - Mx.actual)], ["Cost landing", round2(Mx.cost)], ["Variance to budget", round2(Mx.budget - Mx.cost)], ["EBITDA", round2(Mx.ebitda)]], "Summary");
  add([["GL", "Category", "Starting point", "Driver", "Rate", "Budget", "Actual HTD", "Remaining", "Landing", "Variance"], ...Mx.lines.map((l) => [glName(l.g), l.group, START_LBL[l.basis], l.basis === "unit" ? DRIVER_TYPES[l.d.type].label : "", l.basis === "unit" ? +l.d.rate || 0 : "", round2(l.b), round2(l.a), round2(l.rem), round2(l.landing), round2(l.varc)])], "GL Lines");
  const rv = [["Stream", "Volume", "Unit", "Price", "Revenue"], ...Mx.streams.filter((s) => s.on).map((s) => [s.name, round2(s.qty), s.unit, s.price, round2(s.rev)])];
  rv.push([], ["Driver", "Value"]);
  VFIELDS.forEach(([, fs]) => fs.forEach(([k, l]) => rv.push([l, S.drivers.vol[k]])));
  add(rv, "Revenue");
  add([["Business unit", "Budget", "Actual HTD", "Remaining", "Landing", "Variance"], ...buTable(Mx).map((r) => [r.bu, round2(r.b), round2(r.a), round2(r.rem), round2(r.landing), round2(r.varc)])], "Business Units");
  const bl = [["Business unit", "GL", "Status", "Source", "Budget", "Actual HTD", "Remaining", "Landing", "Variance", "Reason"]];
  const bi = [["Business unit", "GL", "Item", "PO #", "Driven by", "Share", "Per hour", "Qty", "Unit", "Unit cost", "Start", "End", "Total"]];
  for (const b of Object.values(BU_BY_CODE)) for (const r of buLines(Mx, b)) {
    bl.push([b, glName(r.g), STATUS_LBL[r.status], SRC_LBL[r.src], round2(r.b), round2(r.a), round2(r.rem), round2(r.landing), round2(r.varc), r.ln && r.ln.reason || ""]);
    for (const it of r.ln && r.ln.items || []) {
      const [a2, e] = itemRange(it, Mx.win);
      bi.push([b, glName(r.g), it.desc || "", it.po || "", it.drv ? BASES_LBL[it.drv] : "Manual", it.drv ? it.share == null ? 1 : +it.share : "", it.drv ? +(it.per || 0) : "", round2(itemQty(it, Mx.volNow)), it.drv ? "hours" : it.unit || "", +(it.cost || 0), a2, e, round2(itemQty(it, Mx.volNow) * +(it.cost || 0))]);
    }
  }
  add(bl, "BU Lines");
  add(bi, "BU Build Items");
  if (!S.detail) {
    try {
      S.detail = await api.transactions();
    } catch {
    }
  }
  if (S.detail && S.detail.rows.length) add([["Date", "Business unit", "GL", "Type", "Num", "Vendor", "Memo", "Entity", "Amount"], ...S.detail.rows.map((t) => [t.r[0], txBUName(t.bu), glName(t.r[5]), t.r[1], t.r[2], t.r[3], t.r[4], t.r[6], t.r[7]])], "Transactions");
  const buf = XLSX2.write(wb, { type: "array", bookType: "xlsx" });
  const stamp = S.actuals?.closeDate ? S.actuals.closeDate.slice(5).replace("-", ".") + "." + S.actuals.closeDate.slice(2, 4) : "";
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
  a.download = `2026H Forecast ${stamp}.xlsx`.replace("  ", " ");
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1e3);
}
var STATUS_LBL = { notstarted: "Not started", inprogress: "In progress", fixed: "Fixed", closed: "Closed" };
var SRC_LBL = { driver: "No items", build: "Build", closed: "Closed" };
var BASES_LBL = { wet: "wet lbs", dry: "sellable dry lbs", bud: "bud lbs", trim: "trim / biomass lbs", prepack: "prepack lbs", plants: "plants" };
function curDoc(code = S.buildBU) {
  return S.builds[code] = S.builds[code] || { bu: BU_BY_CODE[code], lines: {}, version: null };
}
function getLine(g, code = S.buildBU) {
  const d = curDoc(code), ln = d.lines[g] = d.lines[g] || { status: "notstarted", items: [] };
  if (!Array.isArray(ln.items)) ln.items = [];
  return ln;
}
function touch(g, code = S.buildBU) {
  const ln = getLine(g, code);
  ln.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
  if (S.me) ln.updatedBy = S.me.email;
  scheduleBuildSave(code);
}
var buOf = (el) => el.dataset.bu || S.buildBU;
var newId = () => Math.random().toString(36).slice(2, 10);
function switchBU(code, focusG, toTop) {
  S.buildBU = code;
  S.addGL = null;
  S.confirmDel = null;
  try {
    localStorage.setItem("gripfc.bu", code);
  } catch {
  }
  if (focusG) {
    S.focusG = focusG;
    if (code !== "all") S.open[code + "|" + focusG] = true;
  } else if (S.focusG && code === "all") S.open["all|" + S.focusG] = true;
  const y = window.scrollY;
  render();
  main.classList.remove("fade");
  void main.offsetWidth;
  main.classList.add("fade");
  const sel = S.focusG && document.querySelector(code === "all" ? `tr[data-allg="${CSS.escape(S.focusG)}"]` : `tr[data-bline="${CSS.escape(S.focusG)}"]`);
  if (focusG && sel) sel.scrollIntoView({ block: "center", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  else if (toTop) window.scrollTo(0, 0);
  else window.scrollTo(0, y);
}
$("tabs").addEventListener("click", (e) => {
  const b = e.target.closest(".tab");
  if (!b) return;
  S.tab = b.dataset.tab;
  try {
    localStorage.setItem("gripfc.tab", S.tab);
  } catch {
  }
  render();
  window.scrollTo(0, 0);
});
$("exportBtn").addEventListener("click", () => {
  exportXlsx().catch(() => toast("Export didn't go through. Try again."));
});
$("monthSel").addEventListener("change", (e) => {
  const id = e.target.value;
  if (id) void enterView(id);
  else exitView();
});
$("viewBar").addEventListener("click", (e) => {
  if (e.target.closest("#backLive")) exitView();
});
$("fileIn").addEventListener("change", (e) => {
  const t = e.target;
  void handleFiles(t.files);
  t.value = "";
});
["dragenter", "dragover"].forEach((ev) => document.addEventListener(ev, (e) => {
  e.preventDefault();
  document.getElementById("drop")?.classList.add("hot");
}));
["dragleave", "drop"].forEach((ev) => document.addEventListener(ev, (e) => {
  e.preventDefault();
  document.getElementById("drop")?.classList.remove("hot");
}));
document.addEventListener("drop", (e) => {
  if (!S.isAdmin || S.tab !== "actuals") return;
  void handleFiles(e.dataTransfer?.files || null);
});
main.addEventListener("input", (e) => {
  const t = e.target;
  if (t.id === "txQ") {
    S.tx.q = t.value;
    render();
    return;
  }
  if (t.dataset.item && t.tagName === "INPUT") {
    const it = getLine(t.dataset.g, buOf(t)).items.find((x) => x.id === t.dataset.item);
    if (!it) return;
    const k = t.dataset.f;
    if (k === "qty" || k === "cost" || k === "per") it[k] = parseNum(t.value);
    else if (k === "share") it.share = parseNum(t.value) / (String(t.value).includes("%") ? 1 : 100);
    else if (k === "start" || k === "end") {
      if (!t.value) return;
      if (!it.start || !it.end) {
        const [a, b] = itemRange(it, M.win);
        it.start = a;
        it.end = b;
      }
      it[k] = t.value;
      delete it.month;
    } else if (k === "desc" || k === "po" || k === "unit") it[k] = t.value;
    touch(t.dataset.g, buOf(t));
    refreshBuild();
    return;
  }
  if (t.dataset.reason) {
    getLine(t.dataset.reason, buOf(t)).reason = t.value;
    touch(t.dataset.reason, buOf(t));
    refreshBuild();
    return;
  }
  if (t.id === "addCode" && S.addGL) {
    S.addGL.code = t.value.replace(/\D/g, "");
    return;
  }
  if (t.id === "addName" && S.addGL) {
    S.addGL.name = t.value;
    return;
  }
  if (t.dataset.vol) {
    S.drivers.vol[t.dataset.vol] = parseNum(t.value) / (t.dataset.pct && !String(t.value).includes("%") ? 100 : 1);
    scheduleSave();
    refreshLive();
  }
});
main.addEventListener("change", (e) => {
  const t = e.target;
  if (t.id === "buSel") {
    switchBU(t.value);
    return;
  }
  const txf = { txBU: "bu", txGL: "gl", txMonth: "month" }[t.id];
  if (txf) {
    S.tx[txf] = t.value;
    render();
    return;
  }
  const sf = { subClose: "close", subBU: "bu", subKind: "kind" }[t.id];
  if (sf) {
    S.subF[sf] = t.value;
    render();
    return;
  }
  if (t.dataset.status) {
    const ln = getLine(t.dataset.status);
    ln.status = t.value;
    touch(t.dataset.status);
    render();
    return;
  }
  if (t.dataset.item && t.tagName === "SELECT") {
    const it = getLine(t.dataset.g, buOf(t)).items.find((x) => x.id === t.dataset.item);
    if (it) {
      const hrs = itemQty(it, M.volNow);
      it.drv = t.value || void 0;
      if (it.drv) {
        if (it.share == null) it.share = 1;
        if (!it.per) it.per = 25;
        it.unit = "hours";
      } else {
        it.qty = Math.round(hrs) || it.qty || 1;
        it.unit = it.unit || "hours";
      }
      touch(t.dataset.g, buOf(t));
      render();
    }
    return;
  }
  if (t.dataset.item && (t.dataset.f === "start" || t.dataset.f === "end")) {
    render();
    return;
  }
  if (t.id === "addSel" && S.addGL) {
    S.addGL.sel = t.value;
    render();
    return;
  }
  if (t.dataset.tog) {
    S.drivers.vol[t.dataset.tog] = t.checked;
    scheduleSave();
    refreshLive();
  }
});
main.addEventListener("focusout", (e) => {
  const t = e.target;
  if (!t.dataset) return;
  if (t.dataset.item && t.dataset.f === "share") {
    const it = getLine(t.dataset.g, buOf(t)).items.find((x) => x.id === t.dataset.item);
    if (it) t.value = fmtIn(it.share == null ? 1 : +it.share, 1);
  }
  if (t.dataset.vol) t.value = fmtIn(S.drivers.vol[t.dataset.vol], t.dataset.pct);
});
main.addEventListener("click", (e) => {
  const t = e.target.closest("button,[data-go],#drop");
  if (!t) return;
  const d = t.dataset;
  if (d.go) {
    S.tab = d.go;
    render();
    return;
  }
  if (d.busort) {
    S.buSort = d.busort;
    render();
    return;
  }
  if (d.step) {
    switchBU(d.step);
    return;
  }
  if (d.gobu) {
    const fromTab = S.tab;
    S.tab = "build";
    switchBU(d.gobu, d.focus || null, fromTab !== "build");
    return;
  }
  if (d.txgo !== void 0) {
    S.tx = { bu: S.buildBU, gl: d.txgo, month: "", q: "" };
    S.tab = "txns";
    render();
    window.scrollTo(0, 0);
    return;
  }
  if (d.subview) {
    void enterView(d.subview);
    return;
  }
  if (d.subcmp) {
    const id = d.subcmp;
    void subState(id).then((st) => {
      if (!st) {
        toast("That submission's actuals or snapshot aren't available.");
        return;
      }
      S.cmpState = st;
      S.cmp = id;
      render();
    });
    return;
  }
  if (d.toggle) {
    const k = S.buildBU + "|" + d.toggle;
    S.open[k] = !S.open[k];
    S.focusG = S.open[k] ? d.toggle : null;
    render();
    return;
  }
  if (d.additem) {
    const g = d.additem, code = buOf(t), ln = getLine(g, code), id = newId();
    ln.items.push(d.labor ? { id, desc: "Labor", drv: "wet", share: 1, per: 25, cost: 20, start: M.win.start, end: M.win.end } : { id, desc: "", qty: 1, unit: "", cost: 0, start: M.win.start, end: M.win.end });
    if (ln.status === "notstarted" || ln.status === "fixed") ln.status = "inprogress";
    if (S.buildBU !== "all") S.open[code + "|" + g] = true;
    touch(g, code);
    render();
    document.getElementById(`it-${id}-desc`)?.focus();
    return;
  }
  if (d.usesp) {
    const g = d.usesp, code = buOf(t), ln = getLine(g, code), id = newId();
    ln.items.push({ id, desc: `${d.basis || "Starting point"} starting point`, qty: 1, unit: "lump sum", cost: +(d.amt || 0), start: M.win.start, end: M.win.end });
    if (ln.status === "notstarted" || ln.status === "fixed") ln.status = "inprogress";
    touch(g, code);
    render();
    return;
  }
  if (d.delitem) {
    const code = buOf(t), ln = getLine(d.g, code);
    ln.items = ln.items.filter((x) => x.id !== d.delitem);
    touch(d.g, code);
    render();
    return;
  }
  if (d.clear) {
    const code = buOf(t), ln = getLine(d.clear, code);
    ln.items = [];
    ln.status = "notstarted";
    touch(d.clear, code);
    render();
    return;
  }
  if (d.remove) {
    const g = d.remove, r = buLines(M, BU_BY_CODE[S.buildBU]).find((x) => x.g === g);
    if (r && (Math.abs(r.a) > 4e-3 || r.b)) {
      const ln = getLine(g);
      ln.status = "closed";
      touch(g);
      render();
      toast(Math.abs(r.a) > 4e-3 ? "Line closed at actual" : "Line removed from forecast");
    } else {
      S.confirmDel = S.buildBU + "|" + g;
      render();
    }
    return;
  }
  if (d.delyes) {
    const doc = curDoc();
    delete doc.lines[d.delyes];
    S.confirmDel = null;
    scheduleBuildSave(S.buildBU);
    render();
    toast("Line deleted");
    return;
  }
  switch (t.id) {
    case "delNo":
      S.confirmDel = null;
      render();
      break;
    case "addGLBtn":
      S.addGL = { sel: "" };
      render();
      break;
    case "addCancel":
      S.addGL = null;
      render();
      break;
    case "addGo": {
      if (!S.addGL) break;
      let g = S.addGL.sel;
      if (g === "__new") {
        const c = (S.addGL.code || "").trim(), nm = (S.addGL.name || "").trim();
        if (!/^\d{4}$/.test(c) || !nm) {
          toast("Enter a 4-digit GL number and a name.");
          break;
        }
        g = normGL(`${c} \xB7 ${nm}`);
      }
      if (!g) {
        toast("Pick a GL to add.");
        break;
      }
      registerGL(g);
      const ln = getLine(g);
      ln.status = "inprogress";
      ln.custom = !(BUDGET[g] || {})[BU_BY_CODE[S.buildBU]];
      S.open[S.buildBU + "|" + g] = true;
      S.addGL = null;
      touch(g);
      render();
      toast("GL line added");
      break;
    }
    case "submitBU":
      void submitForecast("bu");
      break;
    case "finalBtn": {
      const n = finalStatus(M).missing.length;
      if (n && !S.confirmFinal) {
        S.confirmFinal = true;
        render();
        break;
      }
      void submitForecast("final");
      break;
    }
    case "finalNo":
      S.confirmFinal = false;
      render();
      break;
    case "cmpClose":
      S.cmp = null;
      S.cmpState = null;
      render();
      break;
    case "txClear":
      S.tx = { bu: "all", gl: "", month: "", q: "" };
      render();
      break;
    case "pickBtn":
    case "drop":
      if (S.isAdmin) $("fileIn").click();
      break;
    case "cancelPrev":
      S.preview = null;
      render();
      break;
    case "loadBtn": {
      const ci = document.getElementById("closeIn"), p = S.preview;
      if (p && p.error === void 0) {
        if (ci && ci.value) p.closeDate = ci.value;
        if (!p.closeDate) {
          toast("Pick the close date first.");
          break;
        }
        void loadActuals();
      }
      break;
    }
  }
});
main.addEventListener("keydown", (e) => {
  if (e.target.id === "drop" && (e.key === "Enter" || e.key === " ")) {
    e.preventDefault();
    $("fileIn").click();
  }
});
var topBar = document.querySelector("header.top");
if (topBar) new ResizeObserver(() => document.documentElement.style.setProperty("--hdr", topBar.offsetHeight + "px")).observe(topBar);
window.addEventListener("beforeunload", (e) => {
  if (Object.keys(pending).length) e.preventDefault();
});
async function boot() {
  try {
    S.me = await api.me();
    const [ref, st] = await Promise.all([api.reference(), api.state()]);
    initReference(ref);
    S.isAdmin = S.me.role === "admin";
    S.canWrite = true;
    applyState(st, true);
    driversQ = new SaveQueue(S.driversVersion, async (d, v) => (await api.saveDrivers(d, v)).version);
    if (S.buildBU !== "all" && !BU_BY_CODE[S.buildBU]) S.buildBU = "all";
    renderViewSel();
    render();
    window.setInterval(() => {
      void poll();
    }, 45e3);
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) void poll();
    });
  } catch (e) {
    const msg = e instanceof ApiError ? e.message : "Couldn't start the app.";
    main.innerHTML = `<section class="panel"><div class="empty">${esc(msg)}</div></section>`;
  }
}
void boot();
