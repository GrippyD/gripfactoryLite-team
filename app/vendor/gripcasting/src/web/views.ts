/* Tab views: each returns HTML for #main from the computed model and S. No data access here. */
import type { BuildItem, Submission, Vol, VolNumKey, VolToggleKey } from "../shared/types";
import {
  BASES, BUS, BU_BY_CODE, EXCLUDED, GLS, GROUPS, allLines, buCode, buLines, buMonthly, buTable, compute, glName,
  isExcluded, itemQty, itemRange, itemTotal, outsideWin, round2, type BLine, type Model, type ModelState,
} from "../shared/model";
import { big, dash, esc, fmtDate, fmtIn, fmtStamp, monthLbl, money, nf0, nf2, pct, usd2 } from "./format";
import { TX_NOBU, type TxCheck } from "./parse";
import { S } from "./state";

const COLORS = ["--bar-a", "--bar-b", "--bar-c", "--bar-d", "--bar-e", "--bar-f"];
export const STATUS: Record<string, string> = { notstarted: "Not started", inprogress: "In progress", fixed: "Fixed", closed: "Closed" };
const SRC: Record<string, [string, string]> = { driver: ["No items", "warn"], build: ["Build", "under"], closed: ["Closed", "neutral"] };
export const START_LBL: Record<string, string> = { unit: "Unit cost", runrate: "Run rate", budget: "Budget left", seasonal: "Prior year" };
const srcPill = (r: { src: string; basis: string }) => r.src === "driver" ? `<span class="pill warn" title="Nothing forecast until items are added">No items</span>` : `<span class="pill ${SRC[r.src][1]}">${SRC[r.src][0]}</span>`;
const sum = <T>(xs: T[], f: (x: T) => number) => xs.reduce((s, x) => s + f(x), 0);
const uid = (email: string | null | undefined) => `<span data-uid="${esc(email || "")}">someone</span>`;

/* ---------- Overview ---------- */
export function vOverview(M: Model): string {
  const varc = M.budget - M.cost;
  const groups = GROUPS.map(gr => { const ls = M.lines.filter(l => l.group === gr); return { gr, b: sum(ls, l => l.b), land: sum(ls, l => l.landing), a: sum(ls, l => l.a) }; });
  const mx = Math.max(...groups.map(g => Math.max(g.b, g.land)), 1);
  const revMix = M.streams.filter(s => s.rev > 0);
  return `
  <div class="kpis">
    <div class="kpi"><div class="eyebrow">Revenue · driver model</div><div class="v num">${big(M.revenue)}</div><div class="s">${nf0.format(M.vol.adjDry)} dry lbs · BTR ${pct(S.drivers.vol.btr)}</div></div>
    <div class="kpi"><div class="eyebrow">Cost landing</div><div class="v num">${big(M.cost)}</div><div class="s">${big(M.actual)} actual + ${big(M.cost - M.actual)} to go</div></div>
    <div class="kpi"><div class="eyebrow">vs cost budget</div><div class="v num" style="color:var(${varc < 0 ? "--bad" : "--good"})">${big(Math.abs(varc))}</div><div class="s">${varc < 0 ? "over" : "under"} the ${big(M.budget)} budget</div></div>
    <div class="kpi"><div class="eyebrow">EBITDA</div><div class="v num">${big(M.ebitda)}</div><div class="s">${M.revenue ? pct(M.ebitda / M.revenue) + " margin" : "–"}</div></div>
  </div>
  <div class="grid2">
    <div class="stack">
      <section class="panel">
        <div class="panel-h"><h2>Cost landing by category</h2>
          <div class="legend"><span><i class="sw outline"></i>Budget</span><span><i class="sw" style="background:var(--bar-a)"></i>Landing</span><span><i class="sw" style="background:var(--bad)"></i>Over budget portion</span></div></div>
        <div class="cmp">
          ${groups.map(g => `<div class="lbl">${g.gr}</div><div class="track"><div class="b" style="width:${g.b / mx * 100}%"></div><div class="l" style="width:${Math.min(g.land, g.b || g.land) / mx * 100}%"></div>${g.land > g.b ? `<div class="l over" style="left:${g.b / mx * 100}%;width:${(g.land - g.b) / mx * 100}%"></div>` : ""}</div><div class="num" style="text-align:right">${big(g.land)}</div>`).join("")}
        </div>
      </section>
      <section class="panel">
        <div class="panel-h"><h2>Harvest volume</h2><button class="btn ghost" data-go="revenue" type="button">Edit drivers</button></div>
        <div class="flow-wrap"><div class="flow">
          <div class="st"><div class="k">Plants</div><div class="v num">${nf0.format(S.drivers.vol.plants)}</div></div>
          <div class="st"><div class="k">Wet lbs</div><div class="v num">${nf0.format(M.vol.totalWet)}</div></div>
          <div class="st"><div class="k">Sellable dry lbs</div><div class="v num">${nf0.format(M.vol.adjDry)}</div></div>
          <div class="st"><div class="k">Bud lbs</div><div class="v num">${nf0.format(M.vol.bud)}</div></div>
          <div class="st"><div class="k">Trim &amp; biomass lbs</div><div class="v num">${nf0.format(M.vol.other)}</div></div>
        </div></div>
        <div class="eyebrow" style="margin-top:16px">Revenue mix</div>
        <div class="mixbar">${revMix.map((s, i) => `<div title="${esc(s.name)} ${big(s.rev)}" style="flex:${s.rev};background:var(${COLORS[i % 6]})"></div>`).join("")}</div>
        <div class="legend">${revMix.map((s, i) => `<span><i class="sw" style="background:var(${COLORS[i % 6]})"></i>${esc(s.name)} ${big(s.rev)}</span>`).join("")}</div>
      </section>
    </div>
    <div class="stack">${vBuildStatus(M)}</div>
  </div>
  <section class="panel" style="margin-top:20px"><div class="panel-h"><h2>Business units</h2></div>${vBU(M)}</section>`;
}
function vBuildStatus(M: Model): string {
  const rows = buTable(M).filter(r => r.b || r.a || r.rem);
  return `<section class="panel"><div class="panel-h"><h2>Forecast build by BU</h2><button class="btn ghost" data-go="build" type="button">Open builds</button></div>
    <div class="tbl-wrap" style="border:0"><table><thead><tr><th>Business unit</th><th>Built</th><th>Status</th></tr></thead><tbody>
    ${rows.map(r => {
      const code = buCode(r.bu), d = S.builds[code], p = r.rem > 0.5 ? Math.min(Math.max(r.built / r.rem, 0), 1) : (d ? 1 : 0);
      const st = d && d.submittedAt ? ["Submitted", "under"] : d && Object.keys(d.lines || {}).length ? ["In progress", "warn"] : ["Not started", "neutral"];
      return `<tr><td><button class="rr" style="font-family:var(--f-body);font-size:13px;color:var(--ink);text-decoration:none" type="button" data-gobu="${code}">${esc(r.bu)}</button></td>
      <td><div style="display:flex;align-items:center;gap:8px"><div style="width:80px;height:6px;background:var(--sunk);border-radius:3px;overflow:hidden"><div style="height:100%;width:${p * 100}%;background:var(--bar-a)"></div></div><span class="num muted" style="font-size:12px">${pct(p)}</span></div></td>
      <td><span class="pill ${st[1]}">${st[0]}</span></td></tr>`;
    }).join("")}
    </tbody></table></div><p class="hint" style="margin-top:8px">Built = share of remaining spend that comes from BU line items or closed lines instead of starting points.</p></section>`;
}

/* ---------- Revenue ---------- */
type VField = [VolNumKey, string, string, (1 | "")?, VolToggleKey?];
export const VFIELDS: [string, VField[]][] = [
  ["Harvest volume", [["plants", "Plants", "count"], ["wetPerPlant", "Wet weight per plant", "lbs"], ["dryDown", "Dry-down factor", "% of wet", 1], ["ffWet", "Fresh frozen (diverted wet)", "wet lbs"], ["btr", "BTR · bud-to-total ratio", "% of dry", 1], ["shrink", "Bud shrink to biomass", "% of bud lbs, to distillate", 1]]],
  ["Bud mix", [["prepackPct", "Prepack share of bud", "% of bud lbs", 1], ["prepackPrice", "Prepack price", "$ / lb"], ["bulkPrice", "Bulk flower price", "$ / lb"]]],
  ["Distillate & carts", [["lbsPerLiter", "Biomass per liter", "lbs / liter"], ["carts", "Carts sold", "units"], ["gPerCart", "Distillate per cart", "grams"], ["cartPrice", "Cart price", "$ / unit"], ["literPrice", "Wholesale distillate price", "$ / liter"]]],
  ["Live resin (fresh frozen)", [["resinYield", "Resin yield", "% of wet", 1], ["resinSplit", "Retained split", "%", 1], ["resinPrice", "Resin price", "$ / gram"]]],
  ["Other streams", [["premLbs", "Premium outdoor", "lbs", "", "premOn"], ["premPrice", "Premium outdoor price", "$ / lb"], ["ghLbs", "Greenhouse flower", "lbs", "", "ghOn"], ["ghPrice", "Greenhouse price", "$ / lb"], ["iprUnits", "Infused prerolls", "units", "", "iprOn"], ["iprPrice", "Infused preroll price", "$ / unit"], ["ibLbs", "Infused bud", "lbs", "", "ibOn"], ["ibPrice", "Infused bud price", "$ / lb"], ["tps", "Third-party services", "$ / year", "", "tpsOn"]]],
];
export function vRevenue(M: Model): string {
  const v: Vol = S.drivers.vol, dis = S.isAdmin ? "" : "disabled";
  return `<div class="grid-rev">
  <section class="panel"><div class="panel-h"><h2>Revenue drivers</h2>${S.isAdmin ? "" : `<span class="pill neutral">Set by finance</span>`}</div>
    ${VFIELDS.map(([h, fs]) => `<div class="fgroup"><h3>${h}</h3><div class="fields">
      ${fs.map(([k, l, u, p, tog]) => `<div class="field"><label for="v-${k}">${tog ? `<span class="toggle"><input type="checkbox" id="tg-${tog}" data-tog="${tog}" ${v[tog] ? "checked" : ""} ${dis}></span> ` : ""}${l}<span class="u">${u}</span></label><input class="in" id="v-${k}" data-vol="${k}" data-pct="${p ? 1 : ""}" value="${fmtIn(v[k], p)}" inputmode="decimal" ${dis}></div>`).join("")}
    </div></div>`).join("")}
  </section>
  <div class="stack" id="revOut">${vRevOut(M)}</div></div>`;
}
export function vRevOut(M: Model): string {
  const live = M.streams.filter(s => s.rev > 0);
  return `<section class="panel"><div class="panel-h"><h2>Revenue build</h2><span class="num" style="font-family:var(--f-display);font-weight:600;font-size:22px">${big(M.revenue)}</span></div>
    <div class="mixbar">${live.map((s, i) => `<div title="${esc(s.name)}" style="flex:${s.rev};background:var(${COLORS[i % 6]})"></div>`).join("")}</div>
    <div class="tbl-wrap" style="border:0"><table><thead><tr><th>Stream</th><th class="n">Volume</th><th>Unit</th><th class="n">Price</th><th class="n">Revenue</th><th class="n">Mix</th></tr></thead><tbody>
    ${M.streams.map(s => `<tr style="${s.on ? "" : "opacity:.45"}"><td><i class="sw" style="background:var(${COLORS[live.indexOf(s) % 6] || "--line"});margin-right:8px"></i>${esc(s.name)}</td><td class="n">${s.unit === "flat" ? "–" : nf0.format(s.qty)}</td><td class="muted">${s.unit}</td><td class="n">${s.unit === "flat" ? "–" : "$" + nf2.format(s.price)}</td><td class="n">${money(s.rev)}</td><td class="n">${M.revenue ? pct(s.rev / M.revenue) : "–"}</td></tr>`).join("")}
    <tr class="tot"><td>Total revenue</td><td></td><td></td><td></td><td class="n">${money(M.revenue)}</td><td class="n">100%</td></tr>
    <tr><td class="muted">Revenue booked to date</td><td></td><td></td><td></td><td class="n">${money(M.revA)}</td><td></td></tr>
    </tbody></table></div></section>
  <section class="panel"><div class="panel-h"><h2>Volume math</h2></div>
    <div class="tbl-wrap" style="border:0"><table class="kv"><tbody>
      <tr><td>Total wet lbs</td><td class="n">${nf0.format(M.vol.totalWet)}</td></tr>
      <tr><td>Total dry lbs</td><td class="n">${nf0.format(M.vol.totalDry)}</td></tr>
      <tr><td>Assumed dry weight per plant</td><td class="n">${nf2.format(M.vol.plants ? M.vol.totalDry / M.vol.plants : 0)} lbs</td></tr>
      <tr><td>Dry lbs net of fresh frozen</td><td class="n">${nf0.format(M.vol.netDry)}</td></tr>
      <tr class="tot"><td>Sellable dry lbs</td><td class="n">${nf0.format(M.vol.adjDry)}</td></tr>
      <tr><td>Bud lbs before shrink · BTR ${pct(S.drivers.vol.btr)}</td><td class="n">${nf0.format(M.vol.grossBud)}</td></tr>
      <tr><td>Bud shrink to biomass · ${pct(+S.drivers.vol.shrink || 0)}</td><td class="n">${M.vol.shrinkLbs ? "(" + nf0.format(M.vol.shrinkLbs) + ")" : "–"}</td></tr>
      <tr class="tot"><td>Bud lbs sold as flower · prepack / bulk</td><td class="n">${nf0.format(M.prepackLbs)} / ${nf0.format(M.bulkLbs)}</td></tr>
      <tr><td>Biomass lbs · trim ${nf0.format(M.vol.trim)} + bud shrink ${nf0.format(M.vol.shrinkLbs)}</td><td class="n">${nf0.format(M.vol.other)}</td></tr>
      <tr><td>Distillate liters · to carts / wholesale</td><td class="n">${nf0.format(M.cartL)} / ${nf0.format(M.wholesaleL)}</td></tr>
      ${M.cartL > M.liters ? `<tr><td colspan="2"><span class="pill over">Carts need ${nf0.format(M.cartL)} L but only ${nf0.format(M.liters)} L is produced</span></td></tr>` : ""}
      <tr><td>Live resin grams retained</td><td class="n">${nf0.format(M.resinG)}</td></tr>
      <tr class="tot"><td>Cost per dry lb · landing</td><td class="n">${usd2.format(M.vol.adjDry ? M.cost / M.vol.adjDry : 0)}</td></tr>
      <tr><td>Revenue per dry lb</td><td class="n">${usd2.format(M.vol.adjDry ? M.revenue / M.vol.adjDry : 0)}</td></tr>
    </tbody></table></div></section>`;
}

/* ---------- BU table ---------- */
export function vBU(M: Model): string {
  const rows = buTable(M).filter(r => r.b || r.a || r.rem);
  const k = S.buSort; rows.sort((x, y) => k === "bu" ? x.bu.localeCompare(y.bu) : (x[k] - y[k]));
  const tot = rows.reduce((s, r) => ({ b: s.b + r.b, a: s.a + r.a, rem: s.rem + r.rem }), { b: 0, a: 0, rem: 0 });
  const sortBtn = (key: string, lbl: string, n?: 1) => `<th class="${n ? "n" : ""}"><button class="sortb" style="background:none;border:0;cursor:pointer;padding:0;font:inherit;font-weight:600;font-size:11px;letter-spacing:.04em;text-transform:uppercase;color:${S.buSort === key ? "var(--ink)" : "var(--muted)"}" data-busort="${key}" type="button">${lbl}</button></th>`;
  return `<div class="tbl-wrap"><table><thead><tr>${sortBtn("bu", "Business unit")}${sortBtn("b", "Budget", 1)}${sortBtn("a", "Actual HTD", 1)}<th>% spent</th>${sortBtn("rem", "Remaining", 1)}${sortBtn("landing", "Landing", 1)}${sortBtn("varc", "Var to budget", 1)}</tr></thead><tbody>
  ${rows.map(r => { const sp = r.b ? r.a / r.b : 0; return `<tr><td>${esc(r.bu)}</td><td class="n">${dash(r.b)}</td><td class="n">${dash(r.a)}</td>
    <td><div style="display:flex;align-items:center;gap:8px"><div style="width:90px;height:6px;background:var(--sunk);border-radius:3px;overflow:hidden"><div style="height:100%;width:${Math.min(sp, 1) * 100}%;background:var(${sp > 1 ? "--bad" : "--bar-a"})"></div></div><span class="num muted" style="font-size:12px">${r.b ? pct(sp) : "–"}</span></div></td>
    <td class="n">${dash(r.rem)}</td><td class="n">${dash(r.landing)}</td><td class="n ${r.varc < -0.5 ? "neg" : "pos"}">${money(r.varc)}</td></tr>`; }).join("")}
  <tr class="tot"><td>Total</td><td class="n">${money(tot.b)}</td><td class="n">${money(tot.a)}</td><td></td><td class="n">${money(tot.rem)}</td><td class="n">${money(tot.a + tot.rem)}</td><td class="n ${tot.b - tot.a - tot.rem < 0 ? "neg" : "pos"}">${money(tot.b - tot.a - tot.rem)}</td></tr>
  </tbody></table></div>
  <p class="hint" style="margin-top:10px">Starting points spread to BUs by budget mix (volume-linked lines) or by where actuals are booked (run-rate and prior-year lines). Licensing, wages and utilities are budgeted across BUs but booked to SG&amp;A and Indirect, so BU variances on those lines reflect coding, not spend.</p>`;
}

/* ---------- Build forecast ---------- */
const monthBars = (M: Model, rows: BLine[]) => {
  const mon = buMonthly(M, rows), mx = Math.max(...mon.map(m => m.v), 1);
  return `<div style="display:flex;gap:6px;align-items:flex-end;height:90px">${mon.map(m => `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;min-width:0"><div class="num" style="font-size:10px;color:var(--muted)">${big(m.v)}</div><div style="width:100%;max-width:38px;height:${Math.max(m.v / mx * 56, 1)}px;background:var(--bar-a);border-radius:2px 2px 0 0"></div><div style="font-size:11px;color:var(--muted)">${m.lbl}</div></div>`).join("")}</div>`;
};
const kpi5 = (b: number, a: number, rem: number, built: number, start: number, landing: number) => {
  const varc = b - landing;
  return `<div class="kpis k5">
    <div class="kpi"><div class="eyebrow">Budget</div><div class="v num" style="font-size:20px">${big(b)}</div></div>
    <div class="kpi"><div class="eyebrow">Actual HTD</div><div class="v num" style="font-size:20px">${big(a)}</div></div>
    <div class="kpi"><div class="eyebrow">Remaining</div><div class="v num" style="font-size:20px">${big(rem)}</div><div class="s">${big(built)} from items${start >= 0.5 ? ` · ${big(start)} of starting points not itemized` : ""}</div></div>
    <div class="kpi"><div class="eyebrow">Landing</div><div class="v num" style="font-size:20px">${big(landing)}</div></div>
    <div class="kpi"><div class="eyebrow">Var to budget</div><div class="v num" style="font-size:20px;color:var(${varc < 0 ? "--bad" : "--good"})">${big(Math.abs(varc))}</div><div class="s">${varc < 0 ? "over budget" : "under budget"}</div></div>
  </div>`;
};
export function vBuildSum(M: Model, bu: string, rows: BLine[]): string {
  const code = buCode(bu), doc = S.builds[code] || { lines: {} }, t = (k: "b" | "a" | "rem" | "landing") => sum(rows, r => r[k]);
  const built = sum(rows.filter(r => r.src === "build"), r => r.rem), drv = sum(rows.filter(r => r.src === "driver"), r => r.drv);
  const missing = rows.filter(r => r.needReason && !r.hasReason && r.status !== "closed").length;
  const lastEdit = Object.values(doc.lines || {}).reduce((m, l) => (l.updatedAt || "") > m ? l.updatedAt || "" : m, "");
  const edited = !!doc.submittedAt && lastEdit > doc.submittedAt;
  return `${kpi5(t("b"), t("a"), t("rem"), built, drv, t("landing"))}
  <div class="grid2" style="margin-bottom:16px">
    <section class="panel"><div class="panel-h"><h3>Remaining spend by month</h3></div>${monthBars(M, rows)}</section>
    <section class="panel"><div class="panel-h"><h3>Submit</h3>${doc.submittedAt ? `<span class="pill ${edited ? "warn" : "under"}">${edited ? "Edited after submit" : "Submitted"}</span>` : `<span class="pill neutral">Not submitted</span>`}</div>
      ${doc.submittedAt ? `<div class="muted" style="font-size:12px;margin-bottom:10px">Submitted by ${uid(doc.submittedBy)} · ${fmtStamp(doc.submittedAt)}</div>` : ""}
      ${missing ? `<div class="check" style="margin-bottom:10px"><i class="dot wn"></i><span>${missing} line${missing > 1 ? "s need" : " needs"} a variance reason (over 10% and $10K off budget)</span></div>` : `<div class="check" style="margin-bottom:10px"><i class="dot ok"></i><span>Every large variance has a reason</span></div>`}
      <button class="btn primary" id="submitBU" type="button" ${missing || !S.canWrite || S.submitting ? "disabled" : ""}>${doc.submittedAt ? "Resubmit" : "Submit"} ${esc(bu.slice(3))} forecast</button>
    </section>
  </div>`;
}
const BT_COLS = `<colgroup><col style="width:17%"><col style="width:10%"><col style="width:9%"><col style="width:9%"><col style="width:10%"><col style="width:9%"><col style="width:9%"><col style="width:8%"><col style="width:11%"><col style="width:118px"></colgroup>`;
const BT_HEAD = `<thead><tr><th>GL</th><th>Status</th><th class="n">Budget</th><th class="n">Actual HTD</th><th>Forecast from</th><th class="n">Remaining</th><th class="n">Landing</th><th class="n">Variance</th><th></th><th></th></tr></thead>`;
const stepOrder = () => ["all", ...BUS.map(buCode)];
function buSelect(code: string): string {
  const so = stepOrder(), i = so.indexOf(code);
  return `<label for="buSel" class="eyebrow">Business unit</label>
      <span class="step"><button class="btn ghost" type="button" data-step="${so[(i - 1 + so.length) % so.length]}" aria-label="Previous business unit">‹</button>
      <select class="sel" id="buSel" style="font-size:14px;padding:7px 8px;min-width:230px"><option value="all" ${code === "all" ? "selected" : ""}>All In</option>${BUS.map(b => `<option value="${buCode(b)}" ${buCode(b) === code ? "selected" : ""}>${esc(b)}</option>`).join("")}</select>
      <button class="btn ghost" type="button" data-step="${so[(i + 1) % so.length]}" aria-label="Next business unit">›</button></span>`;
}
/* Item editor for one BU's GL line, shared by the BU page and the All In drill-down.
   Every input and button carries data-bu, so edits made from All In save to the right BU. */
const BASIS_HOW: Record<string, string> = {
  unit: "budget rate × harvest volume, this BU's share by budget mix",
  runrate: "trailing 3 closed months × months remaining, spread by where actuals are booked",
  budget: "this BU's budget left (budget − actual)",
  seasonal: "last year's monthly pattern scaled to this year's pace",
};
export function itemsEditor(M: Model, r: BLine, code: string, dis: string, extra = ""): string {
  const items = (r.ln && r.ln.items) || [], gq = esc(r.g);
  return `<div class="tbl-wrap" style="background:var(--surface)"><table>
        <thead><tr><th>Item</th><th>PO #</th><th>Driven by</th><th class="n">Qty</th><th>Unit</th><th class="n">Unit cost</th><th>Start</th><th>End</th><th class="n">Total</th><th></th></tr></thead><tbody>
        ${items.map(it => {
          const f = (k: string, ex: string, val: string | number, w: string, al?: 1) => `<input class="in" style="width:${w};${al ? "text-align:left" : ""}" id="it-${it.id}-${k}" data-item="${it.id}" data-g="${gq}" data-bu="${code}" data-f="${k}" value="${val}" ${ex || ""} ${dis}>`;
          const [rs, re] = itemRange(it, M.win);
          return `<tr>
          <td style="min-width:230px">${f("desc", 'placeholder="What is it?"', esc(it.desc || ""), "100%", 1)}</td>
          <td>${f("po", 'placeholder="PO-0000" autocomplete="off"', esc(it.po || ""), "110px", 1)}</td>
          <td style="min-width:250px"><select class="sel" id="it-${it.id}-drv" data-item="${it.id}" data-g="${gq}" data-bu="${code}" data-f="drv" ${dis}><option value="">Manual qty</option>${Object.entries(BASES).map(([k, v]) => `<option value="${k}" ${it.drv === k ? "selected" : ""}>${v[0].toUpperCase() + v.slice(1)}</option>`).join("")}</select>
            ${it.drv ? `<div class="hint" style="margin-top:4px;display:flex;gap:4px;align-items:center;flex-wrap:wrap">${f("share", 'inputmode="decimal" title="Share of volume"', fmtIn(it.share == null ? 1 : +it.share, 1), "64px")} of ${nf0.format(M.volNow[it.drv] || 0)} ÷ ${f("per", 'inputmode="decimal" title="Per labor hour"', it.per ?? "", "60px")} per hr</div>` : ""}</td>
          <td class="n">${it.drv ? `<span class="num" data-ithrs="${it.id}">${nf0.format(itemQty(it, M.volNow))}</span>` : f("qty", 'inputmode="decimal"', it.qty ?? "", "90px")}</td>
          <td>${it.drv ? `<span class="muted">hours</span>` : f("unit", 'placeholder="loads"', esc(it.unit || ""), "90px", 1)}</td>
          <td>${f("cost", 'inputmode="decimal"', it.cost ?? "", "90px")}</td>
          <td>${f("start", `type="date" min="${M.win.start}" max="${M.win.end}"`, rs, "140px", 1)}</td>
          <td>${f("end", `type="date" min="${M.win.start}" max="${M.win.end}"`, re, "140px", 1)}</td>
          <td class="n" data-ittot="${it.id}">${itemTotalCell(M, it)}</td>
          <td><button class="btn ghost" type="button" data-delitem="${it.id}" data-g="${gq}" data-bu="${code}" aria-label="Remove item" ${dis}>Remove</button></td></tr>`;
        }).join("")}
        ${items.length ? `<tr class="tot"><td colspan="8">${items.length} item${items.length > 1 ? "s" : ""}</td><td class="n">${money(sum(items, it => itemTotal(it, M.volNow)))}</td><td></td></tr>`
          : `<tr><td colspan="10" class="muted">No items, so nothing more is forecast on this line.${Math.abs(r.drv) >= 0.5 ? ` Its ${(START_LBL[r.basis] || "run rate").toLowerCase()} starting point would be ${money(r.drv)} (${BASIS_HOW[r.basis] || BASIS_HOW.runrate}).` : ""}</td></tr>`}
        </tbody></table></div>
      <div class="row" style="margin-top:10px">
        <button class="btn" type="button" data-additem="${gq}" data-bu="${code}" ${dis}>Add item</button>
        <button class="btn" type="button" data-additem="${gq}" data-bu="${code}" data-labor="1" ${dis}>Add labor assumption</button>
        ${!items.length && Math.abs(r.drv) >= 0.5 ? `<button class="btn" type="button" data-usesp="${gq}" data-bu="${code}" data-amt="${round2(r.drv)}" data-basis="${esc(START_LBL[r.basis] || "Run rate")}" ${dis}>Use starting point as an item (${money(r.drv)})</button>` : ""}
        ${items.length ? `<button class="btn ghost" type="button" data-clear="${gq}" data-bu="${code}" ${dis}>Clear items</button>` : ""}
        ${extra}
      </div>`;
}
export function reasonField(r: BLine, code: string, dis: string): string {
  const id = `rs-${code}-${r.i}`;
  return `<div class="field" style="grid-template-columns:140px minmax(0,1fr);margin-top:10px"><label for="${id}">Variance reason${r.needReason ? ` <span class="u" style="color:var(--warn)">required</span>` : `<span class="u">optional</span>`}</label>
        <input class="in" style="text-align:left;font-family:var(--f-body)" id="${id}" data-reason="${esc(r.g)}" data-bu="${code}" value="${esc((r.ln && r.ln.reason) || "")}" placeholder="Why this line lands where it does" ${dis}></div>`;
}
/* All In drill-down: under each BU row, that BU's items, editable in place */
function components(M: Model, x: BLine): string {
  const code = buCode(x.bu || ""), dis = S.canWrite ? "" : "disabled";
  const body = x.status === "closed" ? `<div class="muted">Closed: stops at actual. Set it back to In progress from the BU's page to forecast more.</div>`
    : itemsEditor(M, x, code, dis) + reasonField(x, code, dis);
  return `<tr class="comp"><td colspan="9">${body}</td></tr>`;
}
function vBuildAll(M: Model): string {
  const { rows, flat } = allLines(M), t = (k: "b" | "a" | "rem" | "landing") => sum(rows, r => r[k]);
  const built = sum(flat.filter(r => r.src === "build"), r => r.rem), start = sum(flat.filter(r => r.src === "driver"), r => r.drv);
  const varc = t("b") - t("landing");
  const active = buTable(M).filter(r => r.b || r.a || r.rem).map(r => r.bu);
  const sub = active.filter(b => S.builds[buCode(b)] && S.builds[buCode(b)].submittedAt);
  const needBU = active.map(b => ({ b, n: flat.filter(r => r.bu === b && r.needReason && !r.hasReason && r.status !== "closed").length })).filter(x => x.n);
  const body = rows.map(r => {
    const open = !!S.open["all|" + r.g];
    const srcTxt = r.built || r.closed ? `<span class="pill under">${r.built ? `Built in ${r.built} BU${r.built > 1 ? "s" : ""}` : ""}${r.built && r.closed ? " · " : ""}${r.closed ? `${r.closed} closed` : ""}</span>` : `<span class="pill warn" title="Nothing forecast until items are added">No items</span>`;
    const sts = [...new Set(r.bus.map(x => x.status))], stTxt = sts.length === 1 ? STATUS[sts[0]] : `<span class="muted">Mixed</span>`;
    return `<tr data-allg="${esc(r.g)}" class="${S.focusG === r.g ? "focus" : ""}"><td><div class="gl-name" title="${esc(glName(r.g))}">${esc(glName(r.g))}</div></td>
      <td>${stTxt}</td><td class="n">${dash(r.b)}</td><td class="n">${dash(r.a)}</td><td>${srcTxt}</td>
      <td class="n">${dash(r.rem)}</td><td class="n">${dash(r.landing)}</td><td class="n ${r.varc < -0.5 ? "neg" : r.varc > 0.5 ? "pos" : ""}">${money(r.varc)}</td>
      <td>${r.needs ? `<span class="pill warn">${r.needs} need reason</span>` : ""}</td>
      <td><button class="btn ${open ? "" : "ghost"}" type="button" data-toggle="${esc(r.g)}">${open ? "Hide" : `By BU (${r.bus.length})`}</button></td></tr>
      ${open ? `<tr class="ed"><td colspan="10" style="background:var(--sunk);white-space:normal;padding:12px 14px"><div class="tbl-wrap" style="background:var(--surface)"><table class="bus">
        <colgroup><col style="width:19%"><col style="width:11%"><col style="width:11%"><col style="width:10%"><col style="width:10%"><col style="width:10%"><col style="width:10%"><col style="width:9%"><col style="width:10%"></colgroup>
        <thead><tr><th>Business unit</th><th>Status</th><th>Forecast from</th><th class="n">Budget</th><th class="n">Actual HTD</th><th class="n">Remaining</th><th class="n">Landing</th><th class="n">Var</th><th></th></tr></thead><tbody>
        ${r.bus.map(x => `<tr><td>${esc(x.bu)}</td><td>${STATUS[x.status]}</td><td>${srcPill(x)}</td><td class="n">${dash(x.b)}</td><td class="n">${dash(x.a)}</td><td class="n">${dash(x.rem)}</td><td class="n">${dash(x.landing)}</td><td class="n ${x.varc < -0.5 ? "neg" : x.varc > 0.5 ? "pos" : ""}">${money(x.varc)}</td><td><button class="btn ghost" type="button" data-gobu="${buCode(x.bu || "")}" data-focus="${esc(r.g)}">Open</button></td></tr>${components(M, x)}`).join("")}
      </tbody></table></div></td></tr>` : ""}`;
  }).join("");
  return `<div class="toolbar">${buSelect("all")}<div class="spacer"></div><span class="hint">Edit any BU's items here, or open the BU for its full line editor.</span></div>
  ${kpi5(t("b"), t("a"), t("rem"), built, start, t("landing"))}
  <div class="grid2" style="margin-bottom:16px">
    <section class="panel"><div class="panel-h"><h3>Remaining spend by month</h3></div>${monthBars(M, flat)}</section>
    <section class="panel"><div class="panel-h"><h3>Submissions</h3><span class="pill ${sub.length === active.length ? "under" : "neutral"}">${sub.length} of ${active.length} BUs</span></div>
      ${needBU.length ? `<div class="checks" style="margin:0">${needBU.map(x => `<div class="check"><i class="dot wn"></i><button class="rr" style="font-family:var(--f-body);font-size:13px;color:var(--ink)" type="button" data-gobu="${buCode(x.b)}">${esc(x.b)}</button><span class="muted">${x.n} line${x.n > 1 ? "s need" : " needs"} a reason</span></div>`).join("")}</div>` : `<div class="check"><i class="dot ok"></i><span>Every large variance has a reason</span></div>`}
    </section>
  </div>
  <div class="tbl-wrap bt-wrap"><table class="bt">${BT_COLS}${BT_HEAD}
    <tbody>${body}
    <tr class="tot"><td>Total</td><td></td><td class="n">${money(t("b"))}</td><td class="n">${money(t("a"))}</td><td></td><td class="n">${money(t("rem"))}</td><td class="n">${money(t("landing"))}</td><td class="n ${varc < 0 ? "neg" : "pos"}">${money(varc)}</td><td></td><td></td></tr>
    </tbody></table></div>`;
}
export const itemTotalCell = (M: Model, it: BuildItem) => money(itemTotal(it, M.volNow)) + (outsideWin(it, M.win) ? `<div><span class="pill warn">Outside forecast window</span></div>` : "");
export function vBuild(M: Model): string {
  if (S.buildBU === "all") return vBuildAll(M);
  const bu = BU_BY_CODE[S.buildBU] || BUS[4], code = buCode(bu), rows = buLines(M, bu), dis = S.canWrite ? "" : "disabled";
  const tb = (k: "b" | "a" | "rem" | "landing" | "varc") => sum(rows, r => r[k]);
  const inRows = new Set(rows.map(r => r.g));
  const addCtl = !S.canWrite ? "" : S.addGL === null ? `<button class="btn" id="addGLBtn" type="button">Add GL line</button>` :
    `<div class="row"><select class="sel" id="addSel"><option value="">Pick a GL…</option>${GLS.filter(g => !inRows.has(g)).map(g => `<option value="${esc(g)}" ${S.addGL!.sel === g ? "selected" : ""}>${esc(glName(g))}</option>`).join("")}<option value="__new" ${S.addGL.sel === "__new" ? "selected" : ""}>New GL not in the list…</option></select>
      ${S.addGL.sel === "__new" ? `<input class="in" id="addCode" placeholder="5585" maxlength="4" inputmode="numeric" style="width:80px;text-align:left" value="${esc(S.addGL.code || "")}"><input class="in" id="addName" placeholder="Irrigation Supplies" style="width:220px;text-align:left" value="${esc(S.addGL.name || "")}">` : ""}
      <button class="btn primary" id="addGo" type="button">Add</button><button class="btn ghost" id="addCancel" type="button">Cancel</button></div>`;
  const body = rows.map(r => {
    const id = `${code}-${r.i}`, open = !!S.open[code + "|" + r.g], items = (r.ln && r.ln.items) || [];
    const rmLabel = Math.abs(r.a) > 0.004 ? "Close line" : r.b ? "Remove from forecast" : "Delete line";
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
      ${itemsEditor(M, r, code, dis, `<button class="btn ghost" type="button" data-txgo="${esc(r.g)}">Transactions</button>
        <div class="spacer"></div>
        ${del ? `<span class="confirm">Delete this line? <button class="btn" type="button" data-delyes="${esc(r.g)}">Delete</button><button class="btn ghost" type="button" id="delNo">Keep</button></span>` :
          r.status === "closed" ? "" : `<button class="btn ghost" type="button" data-remove="${esc(r.g)}" ${dis}>${rmLabel}</button>`}`)}
      ${reasonField(r, code, dis)}
      ${r.ln && r.ln.updatedBy && r.ln.updatedAt ? `<div class="hint" style="margin-top:6px">Last edited by ${uid(r.ln.updatedBy)} · ${new Date(r.ln.updatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</div>` : ""}
    </td></tr>` : ""}`;
  }).join("");
  return `<div class="toolbar">${buSelect(code)}<div class="spacer"></div>${addCtl}</div>
    <div id="bSum">${vBuildSum(M, bu, rows)}</div>
    <div class="tbl-wrap bt-wrap"><table class="bt">${BT_COLS}${BT_HEAD}
      <tbody>${body || `<tr><td colspan="10" class="empty">No budget or actuals for this BU yet. Add a GL line to start its forecast.</td></tr>`}
      ${body ? `<tr class="tot"><td>Total</td><td></td><td class="n">${money(tb("b"))}</td><td class="n">${money(tb("a"))}</td><td></td><td class="n" id="btRem">${money(tb("rem"))}</td><td class="n" id="btLand">${money(tb("landing"))}</td><td class="n ${tb("varc") < 0 ? "neg" : "pos"}" id="btVar">${money(tb("varc"))}</td><td></td><td></td></tr>` : ""}</tbody></table></div>
    <p class="hint" style="margin-top:10px">Remaining comes only from items. A line without items forecasts nothing more and lands at its actual; its starting point (budget rate × volume, run rate, budget left or prior-year pattern) is shown so you can add it as an item in one click. Closed lines stop at actual. A line with actuals can be closed but not deleted.</p>`;
}
export const reasonPill = (r: BLine) => r.needReason && r.status !== "closed" ? `<span class="pill ${r.hasReason ? "neutral" : "warn"}">${r.hasReason ? "Explained" : "Needs reason"}</span>` : "";
export { srcPill };

/* ---------- Actuals ---------- */
export function vActuals(M: Model): string {
  const a = S.actuals, p = S.preview;
  const ent = a ? ["PNN", "PNS", "SMI"].map(e => ({ e, t: a.rows.filter(r => r[0] === e && !isExcluded(r[2])).reduce((s, r) => s + (+r[2].slice(0, 4) < 5000 ? -r[3] : r[3]), 0) })) : [];
  const excl = a ? a.rows.filter(r => isExcluded(r[2])).reduce((s, r) => s + r[3], 0) : 0;
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
        <tr><td>Months elapsed / remaining</td><td class="n">${M.ck.elapsed} / ${M.ck.remaining}</td></tr>
        ${ent.map(x => `<tr><td>${x.e} cost HTD</td><td class="n">${money(x.t)}</td></tr>`).join("")}
        <tr class="tot"><td>Total cost HTD</td><td class="n">${money(M.actual)}</td></tr>
        ${excl ? `<tr><td>Excluded from forecast (${[...EXCLUDED].map(g => esc(g.slice(7))).join(", ")})</td><td class="n">${money(excl)}</td></tr>` : ""}
        <tr><td>GL × BU lines</td><td class="n">${a.rows.length}</td></tr>
        <tr><td>GLs with monthly QB detail</td><td class="n">${Object.keys(a.monthly || {}).length}</td></tr>
        <tr><td>Loaded</td><td class="n">${new Date(a.uploadedAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}</td></tr>
      </tbody></table></div>` : `<div class="empty">Nothing loaded yet. Upload the BU Summary to start.</div>`}
      ${S.uploads.length ? `<div class="eyebrow" style="margin:16px 0 6px">Upload history</div><div class="tbl-wrap" style="border:0"><table><thead><tr><th>Close</th><th>File</th><th class="n">Cost HTD</th></tr></thead><tbody>
        ${S.uploads.map(u => `<tr><td>${fmtDate(u.closeDate)}</td><td><div class="gl-name">${esc(u.fileName || "")}</div></td><td class="n">${money(u.total || 0)}</td></tr>`).join("")}</tbody></table></div>` : ""}
    </section></div>`;
}
function vPreview(p: NonNullable<typeof S.preview>): string {
  if (p.error !== undefined) return `<section class="panel"><div class="check"><i class="dot no"></i><b>${esc(p.error)}</b></div></section>`;
  const tot = p.rows.reduce((s, r) => s + (+r[2].slice(0, 4) < 5000 ? 0 : r[3]), 0);
  return `<section class="panel"><div class="panel-h"><h2>Check before loading</h2><span class="pill neutral">${esc(p.fileName)}</span></div>
    <div class="checks">
      ${p.ent.map(e => `<div class="check"><i class="dot ${e.tie === null ? "wn" : Math.abs(e.tie) < 1 ? "ok" : "no"}"></i><b>${e.e}</b><span class="num">${money(e.cost)}</span><span class="muted">${e.tie === null ? "no Net Income row to tie to" : Math.abs(e.tie) < 1 ? "ties to Net Income" : "off from Net Income by " + money(e.tie)}</span></div>`).join("")}
      ${["PNN", "PNS", "SMI"].filter(e => !p.ent.find(x => x.e === e)).map(e => `<div class="check"><i class="dot wn"></i><b>${e}</b><span class="muted">not found in this file</span></div>`).join("")}
      <div class="check"><i class="dot ${p.monthlyCount ? "ok" : "wn"}"></i><span>${p.monthlyCount ? `QB Back Up found: ${p.monthlyCount} GLs with monthly detail` : "No QB Back Up tab: run rates fall back to actual ÷ months"}</span></div>
      ${p.newGLs.length ? `<div class="check"><i class="dot wn"></i><span>New GLs added as run-rate lines: ${p.newGLs.map(esc).join(", ")}</span></div>` : ""}
      ${vTxCheck(p.txCheck)}
      ${p.txCheck && p.closeDate && p.txCheck.to.slice(0, 7) < p.closeDate.slice(0, 7) ? `<div class="check"><i class="dot no"></i><span>Transactions end ${fmtDate(p.txCheck.to)}, before the ${fmtDate(p.closeDate)} close date. If this workbook is an earlier month's, set the close date to match, or the forecast counts the wrong number of months.</span></div>` : ""}
    </div>
    <div class="row" style="margin-top:6px"><label for="closeIn">Close date</label><input class="in" type="date" id="closeIn" value="${p.closeDate || ""}" style="width:170px;text-align:left">
      <div class="spacer"></div><span class="num">${money(tot)} cost HTD</span>
      <button class="btn ghost" id="cancelPrev" type="button">Cancel</button><button class="btn primary" id="loadBtn" type="button" ${p.ent.length && !S.loadingActuals ? "" : "disabled"}>${S.loadingActuals ? "Loading…" : "Load actuals"}</button></div>
  </section>`;
}
function vTxCheck(c: TxCheck | null): string {
  if (!c) return `<div class="check"><i class="dot wn"></i><span>No QB Back Up transactions in this file: the Transactions tab keeps the last ones loaded</span></div>`;
  const top = c.diff.slice(0, 4).map(x => `${esc(glName(x.g))} ${money(x.d)}`).join(" · ");
  return `<div class="check"><i class="dot ok"></i><span>${nf0.format(c.count)} transactions, ${fmtDate(c.from)} to ${fmtDate(c.to)} · ${money(c.total)} cost</span></div>
    ${c.noBU ? `<div class="check"><i class="dot wn"></i><span>${c.noBU} transaction${c.noBU > 1 ? "s have" : " has"} no BU in the Name column: shown under No BU</span></div>` : ""}
    ${c.diff.length ? `<div class="check"><i class="dot wn"></i><span>${c.diff.length} GL${c.diff.length > 1 ? "s differ" : " differs"} from the BU tabs (BU tab − transactions): ${top}${c.diff.length > 4 ? " …" : ""}</span></div>` : ""}
    ${c.missing.length ? `<div class="check"><i class="dot wn"></i><span>${c.missing.length} GL${c.missing.length > 1 ? "s have" : " has"} no transaction detail (e.g. payroll and benefits): ${c.missing.slice(0, 4).map(g => esc(g.slice(0, 4))).join(", ")}${c.missing.length > 4 ? " …" : ""}</span></div>` : ""}`;
}

/* ---------- Transactions ---------- */
const txBUName = (c: string) => c === TX_NOBU ? "No BU" : (BU_BY_CODE[c] || c);
export { txBUName };
const TX_SHOW = 500;
export function vTxns(M: Model): string {
  if (!S.detail) return `<section class="panel"><div class="empty">Loading transactions…</div></section>`;
  const all = S.detail.rows;
  if (!all.length) return `<section class="panel"><div class="empty">${S.detail.error ? "Transactions couldn't be loaded. Reload to try again." : "No transactions loaded yet. Finance uploads the BU Summary workbook (with its QB Back Up tab) on the Actuals tab."}</div></section>`;
  const f = S.tx, q = f.q.trim().toLowerCase();
  const byBG = all.filter(t => (f.bu === "all" || t.bu === f.bu) && (!f.gl || t.r[5] === f.gl));
  const rows = byBG.filter(t => (!f.month || t.r[0].startsWith(f.month)) && (!q || [t.r[1], t.r[2], t.r[3], t.r[4], t.r[6]].join(" ").toLowerCase().includes(q)));
  const total = sum(rows, t => t.r[7]);
  const gls = [...new Set(all.map(t => t.r[5]))].sort(), months = [...new Set(all.map(t => t.r[0].slice(0, 7)))].sort().reverse();
  const meta = S.detail.meta, close = S.actuals && S.actuals.closeDate;
  /* tie to the BU tabs: actual HTD vs what the transactions add up to, for the BU and GL picked */
  let rec = "";
  if (!f.month && !q && f.bu !== TX_NOBU && !(f.gl && isExcluded(f.gl))) {
    const bn = f.bu === "all" ? null : BU_BY_CODE[f.bu]; let act = 0;
    for (const [g, row] of Object.entries(M.actBU)) if (!f.gl || g === f.gl) for (const [bu, v] of Object.entries(row)) if (!bn || bu === bn) act += v;
    const det = sum(byBG.filter(t => +t.r[5].slice(0, 4) >= 5000 && !isExcluded(t.r[5])), t => t.r[7]);
    rec = `<div class="kpis" style="margin-bottom:12px">
      <div class="kpi"><div class="eyebrow">Actual HTD · BU tabs</div><div class="v num" style="font-size:20px">${money(act)}</div><div class="s">${close ? "through " + fmtDate(close) : ""}</div></div>
      <div class="kpi"><div class="eyebrow">In transactions</div><div class="v num" style="font-size:20px">${money(det)}</div><div class="s">${meta && meta.to ? "through " + fmtDate(meta.to) : ""}</div></div>
      <div class="kpi"><div class="eyebrow">Not in transaction detail</div><div class="v num" style="font-size:20px">${dash(act - det)}</div><div class="s">payroll, journal entries${meta && meta.to && close && meta.to < close ? ", later months" : ""}</div></div>
      <div class="kpi"><div class="eyebrow">Transactions</div><div class="v num" style="font-size:20px">${nf0.format(byBG.length)}</div><div class="s">${f.gl ? esc(glName(f.gl)) : "all GLs"}</div></div></div>`;
  }
  const any = f.bu !== "all" || f.gl || f.month || q, showBU = f.bu === "all", showGL = !f.gl, nc = 7 + (showBU ? 1 : 0) + (showGL ? 1 : 0);
  return `<div class="toolbar">
      <select class="sel" id="txBU" aria-label="Business unit"><option value="all">All BUs</option>${BUS.map(b => `<option value="${buCode(b)}" ${f.bu === buCode(b) ? "selected" : ""}>${esc(b)}</option>`).join("")}<option value="${TX_NOBU}" ${f.bu === TX_NOBU ? "selected" : ""}>No BU</option></select>
      <select class="sel" id="txGL" aria-label="GL"><option value="">All GLs</option>${gls.map(g => `<option value="${esc(g)}" ${f.gl === g ? "selected" : ""}>${esc(glName(g))}</option>`).join("")}</select>
      <select class="sel" id="txMonth" aria-label="Month"><option value="">All months</option>${months.map(k => `<option value="${k}" ${f.month === k ? "selected" : ""}>${monthLbl(k)}</option>`).join("")}</select>
      <input class="search" id="txQ" type="search" placeholder="Search vendor, memo, number" value="${esc(f.q)}" autocomplete="off">
      ${any ? `<button class="btn ghost" type="button" id="txClear">Clear filters</button>` : ""}
      <div class="spacer"></div><span class="hint">${meta && meta.fileName ? esc(meta.fileName) + " · " : ""}harvest to date</span>
    </div>
    ${rec}
    <div class="tbl-wrap tx-wrap"><table>
      <thead><tr><th>Date</th>${showBU ? "<th>Business unit</th>" : ""}${showGL ? "<th>GL</th>" : ""}<th>Type</th><th>Num</th><th>Vendor</th><th>Memo</th><th>Entity</th><th class="n">Amount</th></tr></thead>
      <tbody>${rows.slice(0, TX_SHOW).map(t => `<tr><td class="num">${fmtDate(t.r[0])}</td>${showBU ? `<td>${esc(txBUName(t.bu))}</td>` : ""}${showGL ? `<td><div class="gl-name" title="${esc(glName(t.r[5]))}">${esc(glName(t.r[5]))}</div></td>` : ""}<td>${esc(t.r[1])}</td><td>${esc(t.r[2])}</td><td>${esc(t.r[3])}</td><td class="memo">${esc(t.r[4])}</td><td>${esc(t.r[6])}</td><td class="n ${t.r[7] < 0 ? "neg" : ""}">${money(t.r[7])}</td></tr>`).join("") || `<tr><td colspan="${nc}" class="empty">No transactions match these filters.</td></tr>`}
      <tr class="tot"><td colspan="${nc - 1}">${nf0.format(rows.length)} transaction${rows.length === 1 ? "" : "s"}${rows.length > TX_SHOW ? ` · showing the latest ${TX_SHOW}, narrow the filters to see the rest` : ""}</td><td class="n">${money(total)}</td></tr>
      </tbody></table></div>`;
}

/* ---------- Submissions ---------- */
export const subLabel = (s: Submission) => `${s.kind === "final" ? "Final" : s.bu} · ${s.closeDate ? fmtDate(s.closeDate).replace(/, \d{4}$/, "") + " close" : "no actuals"} · ${new Date(s.submittedAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}`;
export function finalStatus(M: Model) {
  const close = S.actuals ? S.actuals.closeDate : null, active = buTable(M).filter(r => r.b || r.a || r.rem).map(r => r.bu);
  const done = active.filter(b => S.subs.some(s => s.kind === "bu" && s.code === buCode(b) && s.closeDate === close));
  return { close, active, done, missing: active.filter(b => !done.includes(b)), final: S.subs.find(s => s.kind === "final" && s.closeDate === close) };
}
const liveState = (): ModelState => S.view ? S.view.live : { drivers: S.drivers, actuals: S.actuals, builds: S.builds };
function vCompare(): string {
  const s = S.subs.find(x => x.id === S.cmp), st = S.cmpState; if (!s || !st || st.sub.id !== s.id) return "";
  const A = compute(st), B = compute(liveState());
  type CRow = { k: string; s: number; l: number; why: string };
  const by: Record<string, CRow> = {};
  if (s.kind === "final") {
    for (const r of buTable(A)) (by[r.bu] = by[r.bu] || { k: r.bu, s: 0, l: 0, why: "" }).s = r.landing;
    for (const r of buTable(B)) (by[r.bu] = by[r.bu] || { k: r.bu, s: 0, l: 0, why: "" }).l = r.landing;
  } else {
    const bu = BU_BY_CODE[s.code || ""];
    for (const r of buLines(A, bu)) by[r.g] = { k: glName(r.g), s: r.landing, l: 0, why: (r.ln && r.ln.reason) || "" };
    for (const r of buLines(B, bu)) (by[r.g] = by[r.g] || { k: glName(r.g), s: 0, l: 0, why: "" }).l = r.landing;
  }
  const rows = Object.values(by).sort((x, y) => x.k.localeCompare(y.k)).filter(r => Math.abs(r.s) >= 0.5 || Math.abs(r.l) >= 0.5);
  const ts = sum(rows, r => r.s), tl = sum(rows, r => r.l), why = s.kind === "bu";
  return `<section class="panel" style="margin-bottom:16px"><div class="panel-h"><h2>Submitted vs live · ${esc(subLabel(s))}</h2><button class="btn ghost" type="button" id="cmpClose">Close</button></div>
    <div class="tbl-wrap" style="border:0"><table><thead><tr><th>${s.kind === "final" ? "Business unit" : "GL"}</th><th class="n">Submitted landing</th><th class="n">Live landing</th><th class="n">Change</th>${why ? "<th>Reason as submitted</th>" : ""}</tr></thead><tbody>
    ${rows.map(r => { const c = r.l - r.s; return `<tr><td><div class="gl-name" title="${esc(r.k)}">${esc(r.k)}</div></td><td class="n">${dash(r.s)}</td><td class="n">${dash(r.l)}</td><td class="n ${c > 0.5 ? "neg" : c < -0.5 ? "pos" : ""}">${Math.abs(c) < 0.5 ? "–" : money(c)}</td>${why ? `<td style="white-space:normal;min-width:200px">${esc(r.why)}</td>` : ""}</tr>`; }).join("")}
    <tr class="tot"><td>Total</td><td class="n">${money(ts)}</td><td class="n">${money(tl)}</td><td class="n ${tl - ts > 0.5 ? "neg" : tl - ts < -0.5 ? "pos" : ""}">${money(tl - ts)}</td>${why ? "<td></td>" : ""}</tr>
    </tbody></table></div><p class="hint" style="margin-top:8px">Change = live minus submitted. Positive means the forecast went up since it was submitted.</p></section>`;
}
export function vSubs(M: Model): string {
  const fs = finalStatus(M), f = S.subF, closes = [...new Set(S.subs.map(s => s.closeDate || ""))].sort().reverse();
  const canFinal = S.isAdmin && S.canWrite && !S.view;
  const latestKey: Record<string, string> = {}; for (const s of S.subs) { const k = s.kind + "|" + (s.code || "") + "|" + (s.closeDate || ""); if (!latestKey[k]) latestKey[k] = s.id; }
  const inFinal = new Set(S.subs.filter(s => s.kind === "final").flatMap(s => Object.values(s.buSubs || {})));
  const list = S.subs.filter(s => (!f.close || (s.closeDate || "") === f.close) && (f.kind === "all" || s.kind === f.kind) && (f.bu === "all" || s.code === f.bu));
  const finalPanel = `<section class="panel"><div class="panel-h"><h2>Final submission${fs.close ? " · " + fmtDate(fs.close) + " close" : ""}</h2>
      ${fs.final ? `<span class="pill under">Final submitted</span>` : `<span class="pill neutral">Not final yet</span>`}</div>
    ${!fs.close ? `<div class="muted">Load actuals first. Submissions are tied to the close they were made on.</div>` : `
    <div class="check" style="margin-bottom:8px"><i class="dot ${fs.missing.length ? "wn" : "ok"}"></i><span>${fs.done.length} of ${fs.active.length} BUs submitted on this close</span></div>
    ${fs.missing.length ? `<div class="hint" style="margin-bottom:10px">Not submitted: ${fs.missing.map(b => `<button class="rr" style="font-family:var(--f-body);font-size:12px" type="button" data-gobu="${buCode(b)}">${esc(b)}</button>`).join(", ")}</div>` : ""}
    ${fs.final ? `<div class="muted" style="font-size:12px;margin-bottom:10px">Final by ${uid(fs.final.submittedBy)} · ${fmtStamp(fs.final.submittedAt)} · landing ${money(fs.final.totals.landing)}</div>` : ""}
    ${canFinal ? (S.confirmFinal ? `<span class="confirm">${fs.missing.length} BU${fs.missing.length > 1 ? "s haven't" : " hasn't"} submitted. Submit final anyway? <button class="btn primary" type="button" id="finalBtn" ${S.submitting ? "disabled" : ""}>Submit final</button><button class="btn ghost" type="button" id="finalNo">Not yet</button></span>`
      : `<button class="btn primary" type="button" id="finalBtn" ${S.submitting ? "disabled" : ""}>${fs.final ? "Resubmit final forecast" : "Submit final forecast"}</button>`)
      : `<div class="hint">${S.view ? "Go back to live to submit." : "Directors submit their BUs; finance makes the final submission."}</div>`}`}
  </section>`;
  return `${vCompare()}
    <div class="grid2" style="margin-bottom:16px">${finalPanel}
      <section class="panel"><div class="panel-h"><h2>How this works</h2></div><div class="hint" style="font-size:13px">Each director submits their BU from Build forecast. That saves the BU's lines, items and reasons as they stand, on this close's actuals. Finance's final submission saves the whole company forecast. Pick any submission to view it read only on every tab, or compare it with the live forecast.</div></section>
    </div>
    <div class="toolbar">
      <select class="sel" id="subClose" aria-label="Close"><option value="">All closes</option>${closes.map(c => `<option value="${esc(c)}" ${f.close === c ? "selected" : ""}>${c ? fmtDate(c) + " close" : "No actuals"}</option>`).join("")}</select>
      <select class="sel" id="subBU" aria-label="Business unit"><option value="all">All BUs</option>${BUS.map(b => `<option value="${buCode(b)}" ${f.bu === buCode(b) ? "selected" : ""}>${esc(b)}</option>`).join("")}</select>
      <select class="sel" id="subKind" aria-label="Type"><option value="all">Final and BU</option><option value="final" ${f.kind === "final" ? "selected" : ""}>Final only</option><option value="bu" ${f.kind === "bu" ? "selected" : ""}>BU only</option></select>
      <div class="spacer"></div><span class="hint">${list.length} of ${S.subs.length}</span>
    </div>
    <div class="tbl-wrap"><table><thead><tr><th>Submitted</th><th>Forecast</th><th>Close</th><th>By</th><th class="n">Landing</th><th class="n">Var to budget</th><th></th><th></th></tr></thead><tbody>
    ${list.map(s => {
      const latest = latestKey[s.kind + "|" + (s.code || "") + "|" + (s.closeDate || "")] === s.id, v = s.totals.varc;
      return `<tr class="${S.view && S.view.sub.id === s.id ? "focus" : ""}"><td class="num">${new Date(s.submittedAt).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}</td>
      <td>${s.kind === "final" ? `<span class="pill under">Final</span>` : esc(s.bu)} ${latest ? `<span class="pill neutral">Latest</span>` : ""}${inFinal.has(s.id) ? ` <span class="pill neutral">In final</span>` : ""}</td>
      <td>${s.closeDate ? fmtDate(s.closeDate) : "–"}</td><td>${uid(s.submittedBy)}</td>
      <td class="n">${money(s.totals.landing)}</td><td class="n ${v < -0.5 ? "neg" : v > 0.5 ? "pos" : ""}">${money(v)}</td>
      <td><button class="btn ghost" type="button" data-subview="${esc(s.id)}">View</button></td><td><button class="btn ghost" type="button" data-subcmp="${esc(s.id)}" title="Compare with the live forecast">Compare</button></td></tr>`;
    }).join("") || `<tr><td colspan="8" class="empty">${S.subs.length ? "No submissions match these filters." : "No submissions yet. Directors submit from Build forecast."}</td></tr>`}
    </tbody></table></div>`;
}
