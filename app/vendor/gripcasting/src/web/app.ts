/* App controller: start-up, render, saving (optimistic locking through the API), refresh, events. */
import type { BuildDoc, BuildLine, Drivers, StatePayload, Submission, VolNumKey, VolToggleKey } from "../shared/types";
import {
  BUDGET, BU_BY_CODE, DRIVER_TYPES, MONTHS, buLines, buTable, compute, defaults, glName, initReference, itemQty, itemRange,
  mergeDrivers, normGL, registerActualGLs, registerBuildGLs, registerGL, round2, type Model,
} from "../shared/model";
import { ApiError, SaveQueue, api } from "./api";
import { esc, fmtDate, fmtIn, fmtStamp, money, nf0, parseNum } from "./format";
import { parseFiles } from "./parse";
import { S, modelState, type Tab } from "./state";
import {
  START_LBL, VFIELDS, finalStatus, itemTotalCell, reasonPill, srcPill, txBUName, vActuals, vBuild, vBuildSum,
  vOverview, vRevOut, vRevenue, vSubs, vTxns,
} from "./views";

const $ = (id: string) => document.getElementById(id) as HTMLElement;
const main = $("main");
let M: Model;

/* ---------- Render ---------- */
function render(): void {
  M = compute(modelState()); renderHeader();
  const act = document.activeElement as HTMLInputElement | null, aid = act && act.id, sel = act && act.selectionStart;
  const views: Record<Tab, (m: Model) => string> = { overview: vOverview, revenue: vRevenue, build: vBuild, actuals: vActuals, txns: vTxns, subs: vSubs };
  if (S.tab === "txns") ensureDetail();
  main.innerHTML = (views[S.tab] || vOverview)(M);
  fillNames();
  if (aid) { const n = document.getElementById(aid) as HTMLInputElement | null; if (n && n !== document.body) { n.focus(); try { if (sel != null) n.setSelectionRange(sel, sel); } catch { /* not a text input */ } } }
}
function renderHeader(): void {
  const ck = M.ck;
  $("months").innerHTML = MONTHS.map((m, i) => `<i class="${i < ck.elapsed ? "on" : ""}" title="${m}"></i>`).join("");
  $("clockTxt").textContent = S.actuals ? `Actuals through ${fmtDate(S.actuals.closeDate)} · ${ck.remaining} months to forecast` : "No actuals loaded";
  document.querySelectorAll<HTMLElement>(".tab").forEach(t => t.setAttribute("aria-selected", t.dataset.tab === S.tab ? "true" : "false"));
  $("saveState").textContent = S.saving;
}
const renderHeaderOnly = () => { $("saveState").textContent = S.saving; };
function refreshLive(): void { M = compute(modelState()); renderHeader(); if (S.tab === "revenue") $("revOut").innerHTML = vRevOut(M); }
function refreshBuild(): void {
  if (S.buildBU === "all") { render(); return; }
  M = compute(modelState()); renderHeader();
  const bu = BU_BY_CODE[S.buildBU], rows = buLines(M, bu);
  const bs = document.getElementById("bSum"); if (bs) bs.innerHTML = vBuildSum(M, bu, rows);
  for (const r of rows) {
    const tr = document.querySelector(`tr[data-bline="${CSS.escape(r.g)}"]`); if (!tr) continue;
    (tr.querySelector('[data-bo="src"]') as HTMLElement).innerHTML = srcPill(r);
    (tr.querySelector('[data-bo="rem"]') as HTMLElement).textContent = r.rem && Math.abs(r.rem) >= 0.5 ? money(r.rem) : "–";
    (tr.querySelector('[data-bo="landing"]') as HTMLElement).textContent = Math.abs(r.landing) >= 0.5 ? money(r.landing) : "–";
    const v = tr.querySelector('[data-bo="varc"]') as HTMLElement; v.textContent = money(r.varc); v.className = "n " + (r.varc < -0.5 ? "neg" : r.varc > 0.5 ? "pos" : "");
    (tr.querySelector('[data-bo="reason"]') as HTMLElement).innerHTML = reasonPill(r);
    for (const it of (r.ln && r.ln.items) || []) {
      const c = document.querySelector(`[data-ittot="${it.id}"]`); if (c) c.innerHTML = itemTotalCell(M, it);
      const h = document.querySelector(`[data-ithrs="${it.id}"]`); if (h) h.textContent = nf0.format(itemQty(it, M.volNow));
    }
  }
  const tb = (k: "rem" | "landing" | "varc") => rows.reduce((s, r) => s + r[k], 0), set = (id: string, v: number) => { const e = document.getElementById(id); if (e) e.textContent = money(v); };
  set("btRem", tb("rem")); set("btLand", tb("landing")); set("btVar", tb("varc")); const bv = document.getElementById("btVar"); if (bv) bv.className = "n " + (tb("varc") < 0 ? "neg" : "pos");
  fillNames();
}
function fillNames(): void {
  document.querySelectorAll<HTMLElement>("[data-uid]").forEach(e => { const id = e.dataset.uid || ""; e.textContent = id === S.me?.email ? "you" : (S.users[id] || id || "someone"); });
}
let toastT: number | undefined;
function toast(msg: string): void {
  let t = document.querySelector<HTMLElement>(".toast");
  if (!t) { t = document.createElement("div"); t.className = "toast"; t.setAttribute("role", "status"); document.body.appendChild(t); }
  t.textContent = msg; clearTimeout(toastT); toastT = window.setTimeout(() => t!.remove(), 3200);
}

/* ---------- Saving: one queue per document, each save carries the version the last one returned ---------- */
let driversQ: SaveQueue<Drivers>;
const buildQ: Record<string, SaveQueue<BuildDoc>> = {};
const timers: Record<string, number> = {}, pending: Record<string, () => Promise<void>> = {};
let driversDirty = false; const buildDirty: Record<string, boolean> = {};
const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x));

function saveFailed(e: unknown, what: "drivers" | string): void {
  const err = e instanceof ApiError ? e : new ApiError("failed", "Couldn't save.");
  if (err.code === "conflict") { S.saving = "Not saved"; toast(err.message); void reloadState(); }
  else if (err.code === "forbidden") { S.saving = "Read only"; if (what !== "drivers") S.canWrite = false; render(); toast(err.message); }
  else { S.saving = "Not saved"; toast(err.message || "Couldn't save. Check your connection."); }
}
function schedule(key: string, ms: number, run: () => Promise<void>): void {
  S.saving = "Saving…"; renderHeaderOnly(); clearTimeout(timers[key]);
  pending[key] = run; timers[key] = window.setTimeout(() => { delete pending[key]; void run(); }, ms);
}
/** send anything waiting on a debounce now, and wait for every queue (before a submission) */
async function flushSaves(): Promise<void> {
  for (const [k, run] of Object.entries(pending)) { clearTimeout(timers[k]); delete pending[k]; await run(); }
}
function scheduleSave(): void {
  if (S.view || !S.isAdmin) return;
  driversDirty = true;
  schedule("drivers", 900, async () => {
    try { await driversQ.save(clone(S.drivers)); S.saving = "Saved"; } catch (e) { saveFailed(e, "drivers"); }
    driversDirty = false; renderHeaderOnly();
  });
}
function scheduleBuildSave(code: string): void {
  if (S.view) return;
  buildDirty[code] = true;
  schedule("build:" + code, 800, async () => {
    try { await queueFor(code).save(clone(S.builds[code])); S.saving = "Saved"; } catch (e) { saveFailed(e, code); }
    buildDirty[code] = false; renderHeaderOnly();
  });
}
function queueFor(code: string): SaveQueue<BuildDoc> {
  return buildQ[code] = buildQ[code] || new SaveQueue<BuildDoc>(S.builds[code]?.version ?? null, async (doc, v) => {
    const { doc: fresh } = await api.saveBuild(code, doc, v);
    /* keep local edits; take the server's stamps (who edited each line, when) */
    const cur = S.builds[code];
    if (cur) { for (const [g, ln] of Object.entries(fresh.lines)) if (cur.lines[g]) { cur.lines[g].updatedAt = ln.updatedAt; cur.lines[g].updatedBy = ln.updatedBy; } cur.version = fresh.version; }
    return fresh.version ?? null;
  });
}

/* ---------- Loading and refresh ---------- */
function applyState(st: StatePayload, first: boolean): boolean {
  let changed = false;
  S.users = Object.fromEntries(st.users.map(u => [u.email, u.name]));
  const target = S.view ? S.view.live : S;
  if (st.actuals && (first || st.actuals.uploadedAt !== target.actuals?.uploadedAt || st.actuals.closeDate !== target.actuals?.closeDate)) { registerActualGLs(st.actuals); target.actuals = st.actuals; changed = true; }
  if (!st.actuals && target.actuals) { target.actuals = null; changed = true; }
  if (st.drivers && !driversDirty && (first || st.drivers.version !== S.driversVersion)) {
    target.drivers = mergeDrivers(st.drivers); S.driversVersion = st.drivers.version;
    if (driversQ) driversQ.version = st.drivers.version; changed = true;
  }
  if (first && !st.drivers) target.drivers = defaults();
  registerBuildGLs(st.builds);
  for (const [code, doc] of Object.entries(st.builds)) {
    if (buildDirty[code] || pending["build:" + code]) continue;
    if (first || doc.version !== target.builds[code]?.version || doc.submittedAt !== target.builds[code]?.submittedAt) {
      target.builds[code] = doc; if (buildQ[code]) buildQ[code].version = doc.version ?? null; changed = true;
    }
  }
  S.uploads = st.uploads;
  if (JSON.stringify(st.submissions.map(s => s.id)) !== JSON.stringify(S.subs.map(s => s.id))) { S.subs = st.submissions; changed = true; renderViewSel(); }
  return changed;
}
async function reloadState(): Promise<void> {
  try { for (const code of Object.keys(buildDirty)) buildDirty[code] = false; const st = await api.state(); applyState(st, true); render(); } catch { /* next poll retries */ }
}
async function poll(): Promise<void> {
  if (document.hidden) return;
  try {
    const changed = applyState(await api.state(), false);
    if (!changed || S.view) return;
    const a = document.activeElement as HTMLElement | null;
    if (a && a.tagName === "INPUT" && main.contains(a)) { if (S.tab === "build") refreshBuild(); else if (S.tab === "revenue") refreshLive(); }
    else render();
  } catch { /* offline: try again next time */ }
}
function ensureDetail(): void {
  if (S.detail || S.detailLoading) return;
  S.detailLoading = true;
  api.transactions().then(d => { S.detail = d; }).catch(() => { S.detail = { meta: null, rows: [], error: true }; })
    .finally(() => { S.detailLoading = false; if (S.tab === "txns") render(); });
}

/* ---------- Actuals upload ---------- */
async function handleFiles(files: FileList | File[] | null): Promise<void> {
  if (!files || !files.length || !S.isAdmin) return;
  S.tab = "actuals";
  try { S.preview = await parseFiles([...files]); }
  catch { S.preview = { fileName: [...files].map(f => f.name).join(", "), error: "This file couldn't be read. Check that it's an .xlsx workbook." }; }
  render();
}
async function loadActuals(): Promise<void> {
  const p = S.preview; if (!p || p.error !== undefined || !p.closeDate) return;
  S.loadingActuals = true; render();
  try {
    const r = await api.uploadActuals({ closeDate: p.closeDate, fileName: p.fileName, rows: p.rows, monthly: p.monthly, transactions: p.tx });
    S.actuals = r.actuals; registerActualGLs(r.actuals); p.newGLs.forEach(registerGL);
    S.uploads = [r.upload, ...S.uploads].slice(0, 12);
    if (p.tx.length) S.detail = { meta: { closeDate: p.closeDate, fileName: p.fileName, from: p.txCheck?.from || null, to: p.txCheck?.to || null }, rows: p.tx.slice().sort((a, b) => b.r[0].localeCompare(a.r[0])) };
    S.preview = null; toast("Actuals loaded");
  } catch (e) { toast(e instanceof ApiError ? e.message : "Couldn't load actuals."); }
  S.loadingActuals = false; render();
}

/* ---------- Submissions and viewing a past one ---------- */
async function submitForecast(kind: "bu" | "final"): Promise<void> {
  if (S.view || !S.canWrite || S.submitting) return;
  S.submitting = true; render();
  try {
    await flushSaves();
    const code = kind === "bu" ? S.buildBU : null;
    const sub = await api.submit({ kind, code });
    S.subs = [sub, ...S.subs.filter(s => s.id !== sub.id)];
    if (kind === "bu" && code) { const d = curDoc(); d.submittedAt = sub.submittedAt; d.submittedBy = sub.submittedBy; }
    S.confirmFinal = false; renderViewSel(); toast(kind === "final" ? "Final forecast submitted" : "Forecast submitted");
  } catch (e) { toast(e instanceof ApiError ? e.message : "Submission didn't go through. Try again."); }
  S.submitting = false; render();
}
const snaps: Record<string, Awaited<ReturnType<typeof api.snapshot>>> = {};
async function subState(id: string) {
  const s = S.subs.find(x => x.id === id); if (!s) return null;
  try {
    const snap = snaps[id] = snaps[id] || await api.snapshot(id);
    const live = S.view ? S.view.live.actuals : S.actuals;
    let a = s.closeDate && live && live.closeDate === s.closeDate ? live : null;
    if (!a && s.closeDate) a = await api.actuals(s.closeDate);
    if (s.closeDate && !a) return null;
    if (a) registerActualGLs(a); registerBuildGLs(snap.builds);
    return { sub: s, drivers: mergeDrivers(snap.drivers), actuals: a, builds: clone(snap.builds) };
  } catch { return null; }
}
async function enterView(id: string): Promise<void> {
  if (!id) { exitView(); return; }
  const st = await subState(id); if (!st) { toast("That submission's actuals or snapshot aren't available."); renderViewSel(); return; }
  await flushSaves();
  const live = S.view ? S.view.live : { drivers: S.drivers, actuals: S.actuals, builds: S.builds, canWrite: S.canWrite, isAdmin: S.isAdmin };
  S.view = { sub: st.sub, live };
  Object.assign(S, { drivers: st.drivers, actuals: st.actuals, builds: st.builds, canWrite: false, isAdmin: false, preview: null, addGL: null, confirmDel: null });
  if (S.tab === "subs" || S.tab === "actuals" || S.tab === "txns") S.tab = st.sub.kind === "bu" ? "build" : "overview";
  if (st.sub.kind === "bu" && st.sub.code) S.buildBU = st.sub.code;
  renderViewSel(); render(); window.scrollTo(0, 0);
}
function exitView(): void {
  if (!S.view) return; const l = S.view.live; S.view = null;
  Object.assign(S, { drivers: l.drivers, actuals: l.actuals, builds: l.builds, canWrite: l.canWrite, isAdmin: l.isAdmin });
  renderViewSel(); render();
}
const monthOf = (close: string) => new Date(close + "T00:00:00").toLocaleDateString("en-US", { month: "short" });
/** Forecast dropdown in the header: each close month's latest final (oldest first), then Live.
    BU submissions open from the Submissions tab; while one is on screen it shows as an extra entry. */
function renderViewSel(): void {
  const sel = $("monthSel") as HTMLSelectElement, bar = $("viewBar"), cur = S.view ? S.view.sub.id : "";
  const finals = new Map<string, Submission>();
  for (const s of S.subs) if (s.kind === "final" && s.closeDate && !finals.has(s.closeDate)) finals.set(s.closeDate, s);   // S.subs is newest first
  const opt = (id: string, label: string, title: string) => `<option value="${esc(id)}" title="${esc(title)}">${esc(label)}</option>`;
  const months = [...finals.entries()].sort(([a], [b]) => a.localeCompare(b));
  const other = S.view && !months.some(([, s]) => s.id === cur) ? opt(cur, S.view.sub.kind === "final" ? `${monthOf(S.view.sub.closeDate || "")} (earlier final)` : `${S.view.sub.bu.slice(3)} submission`, "") : "";
  sel.innerHTML = months.map(([close, s]) => opt(s.id, monthOf(close), `${monthOf(close)} final forecast · ${fmtDate(close)} close · submitted ${fmtStamp(s.submittedAt)}`)).join("")
    + other + opt("", "Live", "The working forecast");
  sel.value = cur;
  if (!S.view) { bar.hidden = true; bar.innerHTML = ""; return; }
  const s = S.view.sub; bar.hidden = false;
  bar.innerHTML = `<b>${s.kind === "final" ? (s.closeDate ? monthOf(s.closeDate) + " final forecast" : "Final forecast") : esc(s.bu) + " forecast"}</b><span>submitted ${fmtStamp(s.submittedAt)} by <span data-uid="${esc(s.submittedBy || "")}">someone</span>${s.closeDate ? ` on ${fmtDate(s.closeDate)} actuals` : ""}. Read only.</span><div class="spacer"></div><button class="btn" type="button" id="backLive">Back to live</button>`;
  fillNames();
}

/* ---------- Export ---------- */
async function exportXlsx(): Promise<void> {
  const XLSX = await import("xlsx");
  const Mx = compute(modelState()), wb = XLSX.utils.book_new(), add = (rows: unknown[][], name: string) => XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), name);
  add([["2026H Forecast"], ["Close date", S.actuals?.closeDate || ""], [], ["", "Amount"], ["Revenue", round2(Mx.revenue)], ["Cost budget", round2(Mx.budget)], ["Cost actual HTD", round2(Mx.actual)], ["Cost remaining", round2(Mx.cost - Mx.actual)], ["Cost landing", round2(Mx.cost)], ["Variance to budget", round2(Mx.budget - Mx.cost)], ["EBITDA", round2(Mx.ebitda)]], "Summary");
  add([["GL", "Category", "Starting point", "Driver", "Rate", "Budget", "Actual HTD", "Remaining", "Landing", "Variance"], ...Mx.lines.map(l => [glName(l.g), l.group, START_LBL[l.basis], l.basis === "unit" ? DRIVER_TYPES[l.d.type].label : "", l.basis === "unit" ? +l.d.rate || 0 : "", round2(l.b), round2(l.a), round2(l.rem), round2(l.landing), round2(l.varc)])], "GL Lines");
  const rv: unknown[][] = [["Stream", "Volume", "Unit", "Price", "Revenue"], ...Mx.streams.filter(s => s.on).map(s => [s.name, round2(s.qty), s.unit, s.price, round2(s.rev)])];
  rv.push([], ["Driver", "Value"]); VFIELDS.forEach(([, fs]) => fs.forEach(([k, l]) => rv.push([l, S.drivers.vol[k]]))); add(rv, "Revenue");
  add([["Business unit", "Budget", "Actual HTD", "Remaining", "Landing", "Variance"], ...buTable(Mx).map(r => [r.bu, round2(r.b), round2(r.a), round2(r.rem), round2(r.landing), round2(r.varc)])], "Business Units");
  const bl: unknown[][] = [["Business unit", "GL", "Status", "Source", "Budget", "Actual HTD", "Remaining", "Landing", "Variance", "Reason"]];
  const bi: unknown[][] = [["Business unit", "GL", "Item", "PO #", "Driven by", "Share", "Per hour", "Qty", "Unit", "Unit cost", "Start", "End", "Total"]];
  for (const b of Object.values(BU_BY_CODE)) for (const r of buLines(Mx, b)) {
    bl.push([b, glName(r.g), STATUS_LBL[r.status], SRC_LBL[r.src], round2(r.b), round2(r.a), round2(r.rem), round2(r.landing), round2(r.varc), (r.ln && r.ln.reason) || ""]);
    for (const it of (r.ln && r.ln.items) || []) { const [a, e] = itemRange(it, Mx.win); bi.push([b, glName(r.g), it.desc || "", it.po || "", it.drv ? BASES_LBL[it.drv] : "Manual", it.drv ? (it.share == null ? 1 : +it.share) : "", it.drv ? +(it.per || 0) : "", round2(itemQty(it, Mx.volNow)), it.drv ? "hours" : (it.unit || ""), +(it.cost || 0), a, e, round2(itemQty(it, Mx.volNow) * (+(it.cost || 0)))]); }
  }
  add(bl, "BU Lines"); add(bi, "BU Build Items");
  if (!S.detail) { try { S.detail = await api.transactions(); } catch { /* export without transactions */ } }
  if (S.detail && S.detail.rows.length) add([["Date", "Business unit", "GL", "Type", "Num", "Vendor", "Memo", "Entity", "Amount"], ...S.detail.rows.map(t => [t.r[0], txBUName(t.bu), glName(t.r[5]), t.r[1], t.r[2], t.r[3], t.r[4], t.r[6], t.r[7]])], "Transactions");
  const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
  const stamp = S.actuals?.closeDate ? S.actuals.closeDate.slice(5).replace("-", ".") + "." + S.actuals.closeDate.slice(2, 4) : "";
  const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
  a.download = `2026H Forecast ${stamp}.xlsx`.replace("  ", " "); document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
const STATUS_LBL: Record<string, string> = { notstarted: "Not started", inprogress: "In progress", fixed: "Fixed", closed: "Closed" };
const SRC_LBL: Record<string, string> = { driver: "No items", build: "Build", closed: "Closed" };
const BASES_LBL: Record<string, string> = { wet: "wet lbs", dry: "sellable dry lbs", bud: "bud lbs", trim: "trim / biomass lbs", prepack: "prepack lbs", plants: "plants" };

/* ---------- Build editing helpers ---------- */
function curDoc(code = S.buildBU): BuildDoc { return S.builds[code] = S.builds[code] || { bu: BU_BY_CODE[code], lines: {}, version: null }; }
/* a saved line can come back without an items list (claude.ai's store dropped empty lists, so closed and cleared
   lines lost theirs); give it one, or Add item / Remove / Clear throw */
function getLine(g: string, code = S.buildBU): BuildLine {
  const d = curDoc(code), ln = d.lines[g] = d.lines[g] || { status: "notstarted", items: [] };
  if (!Array.isArray(ln.items)) ln.items = [];
  return ln;
}
/** mark a line edited (display only: the server stamps the real who/when) and queue the save */
function touch(g: string, code = S.buildBU): void { const ln = getLine(g, code); ln.updatedAt = new Date().toISOString(); if (S.me) ln.updatedBy = S.me.email; scheduleBuildSave(code); }
/** the BU an editor control belongs to: its data-bu (All In edits any BU), else the open BU */
const buOf = (el: HTMLElement) => el.dataset.bu || S.buildBU;
const newId = () => Math.random().toString(36).slice(2, 10);
function switchBU(code: string, focusG?: string | null, toTop?: boolean): void {
  S.buildBU = code; S.addGL = null; S.confirmDel = null;
  try { localStorage.setItem("gripfc.bu", code); } catch { /* ignore */ }
  if (focusG) { S.focusG = focusG; if (code !== "all") S.open[code + "|" + focusG] = true; }
  else if (S.focusG && code === "all") S.open["all|" + S.focusG] = true;
  const y = window.scrollY; render();
  main.classList.remove("fade"); void main.offsetWidth; main.classList.add("fade");
  const sel = S.focusG && document.querySelector(code === "all" ? `tr[data-allg="${CSS.escape(S.focusG)}"]` : `tr[data-bline="${CSS.escape(S.focusG)}"]`);
  if (focusG && sel) sel.scrollIntoView({ block: "center", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  else if (toTop) window.scrollTo(0, 0); else window.scrollTo(0, y);
}

/* ---------- Events ---------- */
$("tabs").addEventListener("click", e => {
  const b = (e.target as HTMLElement).closest<HTMLElement>(".tab"); if (!b) return;
  S.tab = b.dataset.tab as Tab; try { localStorage.setItem("gripfc.tab", S.tab); } catch { /* ignore */ }
  render(); window.scrollTo(0, 0);
});
$("exportBtn").addEventListener("click", () => { exportXlsx().catch(() => toast("Export didn't go through. Try again.")); });
$("monthSel").addEventListener("change", e => { const id = (e.target as HTMLSelectElement).value; if (id) void enterView(id); else exitView(); });
$("viewBar").addEventListener("click", e => { if ((e.target as HTMLElement).closest("#backLive")) exitView(); });
$("fileIn").addEventListener("change", e => { const t = e.target as HTMLInputElement; void handleFiles(t.files); t.value = ""; });
["dragenter", "dragover"].forEach(ev => document.addEventListener(ev, e => { e.preventDefault(); document.getElementById("drop")?.classList.add("hot"); }));
["dragleave", "drop"].forEach(ev => document.addEventListener(ev, e => { e.preventDefault(); document.getElementById("drop")?.classList.remove("hot"); }));
document.addEventListener("drop", e => { if (!S.isAdmin || S.tab !== "actuals") return; void handleFiles((e as DragEvent).dataTransfer?.files || null); });

main.addEventListener("input", e => {
  const t = e.target as HTMLInputElement;
  if (t.id === "txQ") { S.tx.q = t.value; render(); return; }
  if (t.dataset.item && t.tagName === "INPUT") {
    const it = getLine(t.dataset.g!, buOf(t)).items.find(x => x.id === t.dataset.item); if (!it) return; const k = t.dataset.f!;
    if (k === "qty" || k === "cost" || k === "per") it[k] = parseNum(t.value);
    else if (k === "share") it.share = parseNum(t.value) / (String(t.value).includes("%") ? 1 : 100);
    else if (k === "start" || k === "end") { if (!t.value) return; if (!it.start || !it.end) { const [a, b] = itemRange(it, M.win); it.start = a; it.end = b; } it[k] = t.value; delete it.month; }
    else if (k === "desc" || k === "po" || k === "unit") it[k] = t.value;
    touch(t.dataset.g!, buOf(t)); refreshBuild(); return;
  }
  if (t.dataset.reason) { getLine(t.dataset.reason, buOf(t)).reason = t.value; touch(t.dataset.reason, buOf(t)); refreshBuild(); return; }
  if (t.id === "addCode" && S.addGL) { S.addGL.code = t.value.replace(/\D/g, ""); return; }
  if (t.id === "addName" && S.addGL) { S.addGL.name = t.value; return; }
  if (t.dataset.vol) { S.drivers.vol[t.dataset.vol as VolNumKey] = parseNum(t.value) / (t.dataset.pct && !String(t.value).includes("%") ? 100 : 1); scheduleSave(); refreshLive(); }
});
main.addEventListener("change", e => {
  const t = e.target as HTMLInputElement;
  if (t.id === "buSel") { switchBU(t.value); return; }
  const txf = ({ txBU: "bu", txGL: "gl", txMonth: "month" } as Record<string, "bu" | "gl" | "month">)[t.id]; if (txf) { S.tx[txf] = t.value; render(); return; }
  const sf = ({ subClose: "close", subBU: "bu", subKind: "kind" } as Record<string, "close" | "bu" | "kind">)[t.id]; if (sf) { S.subF[sf] = t.value; render(); return; }
  if (t.dataset.status) { const ln = getLine(t.dataset.status); ln.status = t.value as BuildLine["status"]; touch(t.dataset.status); render(); return; }
  if (t.dataset.item && t.tagName === "SELECT") {
    const it = getLine(t.dataset.g!, buOf(t)).items.find(x => x.id === t.dataset.item);
    if (it) { const hrs = itemQty(it, M.volNow); it.drv = (t.value || undefined) as typeof it.drv; if (it.drv) { if (it.share == null) it.share = 1; if (!it.per) it.per = 25; it.unit = "hours"; } else { it.qty = Math.round(hrs) || it.qty || 1; it.unit = it.unit || "hours"; } touch(t.dataset.g!, buOf(t)); render(); }
    return;
  }
  if (t.dataset.item && (t.dataset.f === "start" || t.dataset.f === "end")) { render(); return; }
  if (t.id === "addSel" && S.addGL) { S.addGL.sel = t.value; render(); return; }
  if (t.dataset.tog) { S.drivers.vol[t.dataset.tog as VolToggleKey] = t.checked; scheduleSave(); refreshLive(); }
});
main.addEventListener("focusout", e => {
  const t = e.target as HTMLInputElement; if (!t.dataset) return;
  if (t.dataset.item && t.dataset.f === "share") { const it = getLine(t.dataset.g!, buOf(t)).items.find(x => x.id === t.dataset.item); if (it) t.value = fmtIn(it.share == null ? 1 : +it.share, 1); }
  if (t.dataset.vol) t.value = fmtIn(S.drivers.vol[t.dataset.vol as VolNumKey], t.dataset.pct);
});
main.addEventListener("click", e => {
  const t = (e.target as HTMLElement).closest<HTMLElement>("button,[data-go],#drop"); if (!t) return;
  const d = t.dataset;
  if (d.go) { S.tab = d.go as Tab; render(); return; }
  if (d.busort) { S.buSort = d.busort as typeof S.buSort; render(); return; }
  if (d.step) { switchBU(d.step); return; }
  if (d.gobu) { const fromTab = S.tab; S.tab = "build"; switchBU(d.gobu, d.focus || null, fromTab !== "build"); return; }
  if (d.txgo !== undefined) { S.tx = { bu: S.buildBU, gl: d.txgo, month: "", q: "" }; S.tab = "txns"; render(); window.scrollTo(0, 0); return; }
  if (d.subview) { void enterView(d.subview); return; }
  if (d.subcmp) { const id = d.subcmp; void subState(id).then(st => { if (!st) { toast("That submission's actuals or snapshot aren't available."); return; } S.cmpState = st; S.cmp = id; render(); }); return; }
  if (d.toggle) { const k = S.buildBU + "|" + d.toggle; S.open[k] = !S.open[k]; S.focusG = S.open[k] ? d.toggle : null; render(); return; }
  if (d.additem) {
    const g = d.additem, code = buOf(t), ln = getLine(g, code), id = newId();
    ln.items.push(d.labor ? { id, desc: "Labor", drv: "wet", share: 1, per: 25, cost: 20, start: M.win.start, end: M.win.end } : { id, desc: "", qty: 1, unit: "", cost: 0, start: M.win.start, end: M.win.end });
    if (ln.status === "notstarted" || ln.status === "fixed") ln.status = "inprogress";
    if (S.buildBU !== "all") S.open[code + "|" + g] = true; touch(g, code); render(); document.getElementById(`it-${id}-desc`)?.focus(); return;
  }
  if (d.usesp) {   /* the line's starting point, as one item it can then edit */
    const g = d.usesp, code = buOf(t), ln = getLine(g, code), id = newId();
    ln.items.push({ id, desc: `${d.basis || "Starting point"} starting point`, qty: 1, unit: "lump sum", cost: +(d.amt || 0), start: M.win.start, end: M.win.end });
    if (ln.status === "notstarted" || ln.status === "fixed") ln.status = "inprogress";
    touch(g, code); render(); return;
  }
  if (d.delitem) { const code = buOf(t), ln = getLine(d.g!, code); ln.items = ln.items.filter(x => x.id !== d.delitem); touch(d.g!, code); render(); return; }
  if (d.clear) { const code = buOf(t), ln = getLine(d.clear, code); ln.items = []; ln.status = "notstarted"; touch(d.clear, code); render(); return; }
  if (d.remove) {
    const g = d.remove, r = buLines(M, BU_BY_CODE[S.buildBU]).find(x => x.g === g);
    if (r && (Math.abs(r.a) > 0.004 || r.b)) { const ln = getLine(g); ln.status = "closed"; touch(g); render(); toast(Math.abs(r.a) > 0.004 ? "Line closed at actual" : "Line removed from forecast"); }
    else { S.confirmDel = S.buildBU + "|" + g; render(); }
    return;
  }
  if (d.delyes) { const doc = curDoc(); delete doc.lines[d.delyes]; S.confirmDel = null; scheduleBuildSave(S.buildBU); render(); toast("Line deleted"); return; }
  switch (t.id) {
    case "delNo": S.confirmDel = null; render(); break;
    case "addGLBtn": S.addGL = { sel: "" }; render(); break;
    case "addCancel": S.addGL = null; render(); break;
    case "addGo": {
      if (!S.addGL) break; let g = S.addGL.sel;
      if (g === "__new") { const c = (S.addGL.code || "").trim(), nm = (S.addGL.name || "").trim(); if (!/^\d{4}$/.test(c) || !nm) { toast("Enter a 4-digit GL number and a name."); break; } g = normGL(`${c} · ${nm}`); }
      if (!g) { toast("Pick a GL to add."); break; }
      registerGL(g); const ln = getLine(g); ln.status = "inprogress"; ln.custom = !((BUDGET[g] || {})[BU_BY_CODE[S.buildBU]]);
      S.open[S.buildBU + "|" + g] = true; S.addGL = null; touch(g); render(); toast("GL line added"); break;
    }
    case "submitBU": void submitForecast("bu"); break;
    case "finalBtn": { const n = finalStatus(M).missing.length; if (n && !S.confirmFinal) { S.confirmFinal = true; render(); break; } void submitForecast("final"); break; }
    case "finalNo": S.confirmFinal = false; render(); break;
    case "cmpClose": S.cmp = null; S.cmpState = null; render(); break;
    case "txClear": S.tx = { bu: "all", gl: "", month: "", q: "" }; render(); break;
    case "pickBtn": case "drop": if (S.isAdmin) ($("fileIn") as HTMLInputElement).click(); break;
    case "cancelPrev": S.preview = null; render(); break;
    case "loadBtn": {
      const ci = document.getElementById("closeIn") as HTMLInputElement | null, p = S.preview;
      if (p && p.error === undefined) { if (ci && ci.value) p.closeDate = ci.value; if (!p.closeDate) { toast("Pick the close date first."); break; } void loadActuals(); }
      break;
    }
  }
});
main.addEventListener("keydown", e => { if ((e.target as HTMLElement).id === "drop" && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); ($("fileIn") as HTMLInputElement).click(); } });
/* height of the sticky top bar, so table headers can stick just below it */
const topBar = document.querySelector<HTMLElement>("header.top");
if (topBar) new ResizeObserver(() => document.documentElement.style.setProperty("--hdr", topBar.offsetHeight + "px")).observe(topBar);
window.addEventListener("beforeunload", e => { if (Object.keys(pending).length) e.preventDefault(); });

/* ---------- Start ---------- */
async function boot(): Promise<void> {
  try {
    S.me = await api.me();
    const [ref, st] = await Promise.all([api.reference(), api.state()]);
    initReference(ref);
    S.isAdmin = S.me.role === "admin"; S.canWrite = true;
    applyState(st, true);
    driversQ = new SaveQueue<Drivers>(S.driversVersion, async (d, v) => (await api.saveDrivers(d, v)).version);
    if (S.buildBU !== "all" && !BU_BY_CODE[S.buildBU]) S.buildBU = "all";
    renderViewSel(); render();
    window.setInterval(() => { void poll(); }, 45000);
    document.addEventListener("visibilitychange", () => { if (!document.hidden) void poll(); });
  } catch (e) {
    const msg = e instanceof ApiError ? e.message : "Couldn't start the app.";
    main.innerHTML = `<section class="panel"><div class="empty">${esc(msg)}</div></section>`;
  }
}
void boot();
