// THE LAB STATION (canon 0.30.362): the station page's browser script, the package's
// own client (station/lab_tests.html) in the app's client script shape. labpage.ts
// emits the words block (<script type="application/json" id="lab-words">) first and
// this script after it. The text below is plain browser JavaScript inside a template
// literal: a backslash, a backtick and a dollar-brace are written escaped.
//
// RENDERING RULE: every dynamic value and every translated word that reaches
// innerHTML passes through esc() first. Nothing from the API, the operator or the
// dictionary is interpolated raw. Every word the station shows is tr("<English key>")
// or trf("<English key with {holes}>", vars) with the key written as a literal, so
// labpage.ts and its test can list the keys this script uses.

export const LAB_CLIENT_JS = `(() => {
  "use strict";
  // The words: the page's JSON block, built server side in the page's locale.
  const W = (() => { try { const el = document.getElementById("lab-words"); return el ? JSON.parse(el.textContent || "{}") : {}; } catch { return {}; } })();
  const TR = W.tr || {}, FRIENDLY = W.friendly || {}, FIELDS = W.fields || {};
  const LOCALE = W.locale === "es" ? "es-US" : "en-US";
  const tr = (k) => (Object.prototype.hasOwnProperty.call(TR, k) ? TR[k] : k);
  // A dictionary line with its {holes} filled, the client side of tFill.
  const trf = (k, vars) => tr(k).replace(/[{]([a-z_]+)[}]/g, (_, n) => (vars && vars[n] != null ? String(vars[n]) : ""));
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const store = { get: (k) => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch {} } };
  // The typed name rides only the page's name box (kept by the layout's
  // data-keep-operator script); a signed in page has no box and sends none.
  const operatorHeader = () => { const box = $("#lab-operator"); return encodeURIComponent(box ? box.value.trim() : ""); };
  const baseHeaders = () => ({ "content-type": "application/json", "x-lab-operator": operatorHeader(), "x-lab-client": "station" });
  // A 2xx that is not JSON is an expired Access login page, not a success: it
  // reads as a network failure so a queued save is kept, never dropped. A 401
  // that is not JSON is the Admin PIN page (the PIN cookie lapsed; /api/* is PIN
  // gated): kept the same way, and the station says so.
  let pinLapsed = false;
  const pinLine = () => tr("The Admin PIN has run out on this device. Reload the page and enter the Admin PIN again; the save is kept on this device and sends after.");
  const api = (path, opts) => fetch("/api/lab/" + path, Object.assign({ headers: baseHeaders() }, opts || {})).then(async (r) => { let b = null; try { b = await r.json(); } catch {} if (b === null) { if (r.status === 401) pinLapsed = true; return { status: 0, ok: false, body: null, nonJson: true, httpStatus: r.status }; } pinLapsed = false; return { status: r.status, ok: r.ok, body: b }; });
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const fmtAt = (iso) => { if (!iso) return ""; const d = new Date(iso); return isNaN(d) ? "" : d.toLocaleString(LOCALE, { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }); };
  const fmtNum = (v, d) => (v == null ? "" : Number(v).toFixed(d));
  // Whole grams shown, round half up, thousands grouped (config.ts formatGrams).
  const fmtGrams = (v) => { if (v == null || String(v).trim() === "") return ""; const n = Number(v); if (!isFinite(n)) return String(v); return (n < 0 ? "-" : "") + String(Math.round(Math.abs(n))).replace(/(?!^)(?=(?:[0-9]{3})+$)/g, ","); };
  // Whole grams in, round half up (config.ts roundGrams), the way the server
  // rounds: only a figure inside the grams range (labrules.ts GRAMS_RANGE) is
  // rounded; anything else goes as typed so the server's refusal names the field.
  const gramsIn = (s) => { if (!s) return null; const n = Number(s); return isFinite(n) && n >= 0 && n <= 1000000 ? String(Math.round(n)) : s; };
  const serial = (tag) => (tag && tag.length === 24 ? tag.slice(-5) : tag || "");
  const mintId = (p) => p + "_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
  const z2 = (n) => String(n).padStart(2, "0");
  const localDay = (d) => \`\${d.getFullYear()}-\${z2(d.getMonth() + 1)}-\${z2(d.getDate())}\`;
  // The tested time is a date box and a time box (the view sheets style both),
  // read together as this device's local time. Both blank means now; a time
  // with no date is today on a new reading only (a correction with a time and
  // no date is refused, so a stored reading never moves to today); a date with
  // no time is refused before sending.
  const toLocalParts = (iso) => { if (!iso) return { day: "", time: "" }; const d = new Date(iso); if (isNaN(d)) return { day: "", time: "" }; return { day: localDay(d), time: \`\${z2(d.getHours())}:\${z2(d.getMinutes())}\` }; };
  const testedLocal = (f) => { const d = f.tested_on.value.trim(), tm = f.tested_time.value.trim(); if (!d && !tm) return ""; if (!tm) return null; return (d || localDay(new Date())) + "T" + tm; };
  const fromLocalInput = (s) => (s ? new Date(s).toISOString() : "");
  let OPT = null;

  function say(el, kind, text) { el.className = "banner " + kind; el.textContent = text; el.hidden = false; }
  function clear(el) { el.className = "banner"; el.textContent = ""; el.hidden = true; }
  function setHtml(el, html) { el.innerHTML = html; } // html built only from esc()'d values
  const loadFail = (r) => (r.nonJson && r.httpStatus === 401 ? pinLine() : tr("Could not load") + (r.body && r.body.error ? ": " + friendly(r.body.error) : ""));

  // ------------------------------------------------- the unloseable outbox
  // A save that cannot reach the worker stays on this device with its minted
  // id and is retried; a retry that lands twice is a no-op server side.
  const OUTBOX_KEY = "lab.outbox.v1", REFUSED_KEY = "lab.refused.v1";
  const listOf = (k) => { try { return JSON.parse(store.get(k) || "[]"); } catch { return []; } };
  const outbox = { list: () => listOf(OUTBOX_KEY), save: (l) => store.set(OUTBOX_KEY, JSON.stringify(l)) };
  const refusedBox = { list: () => listOf(REFUSED_KEY), save: (l) => store.set(REFUSED_KEY, JSON.stringify(l)) };
  function queue(method, path, body) { const l = outbox.list(); l.push({ key: mintId("ob"), method, path, body, at: Date.now() }); outbox.save(l); renderOutbox(); }
  function renderOutbox() {
    const l = outbox.list(), rf = refusedBox.list(), el = $("#outbox");
    el.hidden = !l.length && !rf.length;
    el.textContent = "";
    if (l.length) el.appendChild(document.createTextNode(trf("{n} saved on this device, not yet sent. Retrying.", { n: l.length }) + " "));
    if (l.length && pinLapsed) { const p = document.createElement("div"); p.textContent = pinLine(); el.appendChild(p); }
    for (const item of rf) {
      // A refused item is a reading the server will never take as sent; it
      // stays here, with the reason, until the operator discards it.
      const line = document.createElement("div");
      const what = [item.body && item.body.location ? tr(item.body.location) : "", item.body && item.body.metrc_tag ? tr("tag") + " " + item.body.metrc_tag : ""].filter(Boolean).concat(item.method + " " + item.path).join(", ");
      line.textContent = tr("Not accepted by the server") + " (" + friendly(item.error) + "): " + what + ". ";
      const b = document.createElement("button"); b.className = "secondary"; b.type = "button"; b.textContent = tr("Discard");
      b.addEventListener("click", () => { refusedBox.save(refusedBox.list().filter((x) => x.key !== item.key)); renderOutbox(); });
      line.appendChild(b); el.appendChild(line);
    }
  }
  // One drain at a time (a second tick during a slow send must not race the
  // first), a 15 s ceiling on each send, and only the SENT items are removed
  // from the list as it stands at the end, so a save queued mid drain survives.
  let draining = false;
  async function drain() {
    if (draining) return;
    const l = outbox.list();
    if (!l.length) return;
    draining = true;
    const sent = new Set(), refused = [];
    try {
      for (const item of l) {
        const ac = new AbortController(); const t = setTimeout(() => ac.abort(), 15000);
        try {
          const r = await api(item.path, { method: item.method, body: JSON.stringify(item.body), signal: ac.signal });
          if (r.status === 0 || r.status >= 500) continue;
          if (!r.ok) { refused.push({ ...item, error: r.body && r.body.error }); sent.add(item.key); continue; }
          sent.add(item.key);
        } catch { /* keep it */ } finally { clearTimeout(t); }
      }
    } finally {
      outbox.save(outbox.list().filter((x) => !sent.has(x.key)));
      if (refused.length) refusedBox.save(refusedBox.list().concat(refused));
      draining = false;
      renderOutbox();
    }
    if (sent.size) { loadBench(); loadCompliance(); loadRnd(); }
  }
  setInterval(drain, 20000);
  window.addEventListener("online", drain);

  async function send(method, path, body) {
    try {
      const r = await api(path, { method, body: JSON.stringify(body) });
      if (r.status === 0 || r.status >= 500) { queue(method, path, body); return { queued: true }; }
      return r;
    } catch { queue(method, path, body); return { queued: true }; }
  }

  // ---------------------------------------------------------------- tabs
  const loaders = { bench: () => loadBench(), compliance: () => loadCompliance(), rnd: () => loadRnd(), op: () => loadOp(), schedule: () => loadSchedule(), summary: () => loadSummary() };
  $$("#tabs button").forEach((b) => b.addEventListener("click", () => {
    $$("#tabs button").forEach((x) => { const on = x === b; x.setAttribute("aria-selected", on ? "true" : "false"); x.className = on ? "tab-link tab-on" : "tab-link secondary"; });
    $$('#lab-station section[role="tabpanel"]').forEach((s) => { s.hidden = s.id !== "tab-" + b.dataset.tab; });
    store.set("lab.tab", b.dataset.tab);
    loaders[b.dataset.tab]();
  }));

  function fill(sel, items, labelOf, valueOf, blank) {
    setHtml(sel, (blank ? \`<option value="">\${esc(blank)}</option>\` : "") + items.map((i) => \`<option value="\${esc(valueOf ? valueOf(i) : i)}">\${esc(tr(labelOf ? labelOf(i) : i))}</option>\`).join(""));
  }
  // A stored value off the pick list is offered while its row is open, marked,
  // and taken off again when the form resets or opens another row.
  function offerStored(sel, v) { const o = new Option(v, v, true, true); o.dataset.stored = "1"; sel.add(o); }
  function dropStored(form) { $$("option[data-stored]", form).forEach((o) => o.remove()); }

  async function boot() {
    const me = await api("me");
    const box = $("#lab-operator");
    if (box) {
      const sync = () => { const name = box.value.trim(); $("#who").textContent = name ? tr("Typed") + ": " + name : tr("No operator name"); };
      box.addEventListener("input", sync);
      box.addEventListener("change", sync);
      sync();
    } else if (me.body && me.body.name && !me.body.typed) $("#who").textContent = tr("Signed in") + ": " + me.body.name;
    const o = await api("options");
    if (!o.ok) { $("#who").textContent = o.nonJson && o.httpStatus === 401 ? pinLine() : tr("Could not load the pick lists"); return; }
    OPT = o.body;
    const bf = $("#bench-form");
    fill(bf.location, OPT.locations); fill(bf.reason, OPT.reasons); fill(bf.sample_type, OPT.sample_types);
    fill(bf.license, OPT.licenses, (l) => l.label, (l) => l.license, tr("No license (full tag only)"));
    fill($("#bench-f-location"), OPT.locations, null, null, tr("All locations"));
    const cf = $("#cs-form");
    fill(cf.license, OPT.licenses, (l) => l.label, (l) => l.license);
    fill(cf.required_test, OPT.required_tests); fill(cf.testing_facility, OPT.facilities, null, null, tr("Not sent yet"));
    fill(cf.status, OPT.statuses, (s) => s.label, (s) => s.value); fill(cf.fail_reason, OPT.fail_reasons, null, null, tr("None"));
    const last = store.get("lab.license"); if (last) { bf.license.value = last; cf.license.value = last; }
    bf.license.addEventListener("change", () => { store.set("lab.license", bf.license.value); previewTag(); });
    const tab = store.get("lab.tab") || "bench";
    ($$("#tabs button").find((b) => b.dataset.tab === tab) || $$("#tabs button")[0]).click();
    renderOutbox(); drain();
    setInterval(() => { $("#clock").textContent = new Date().toLocaleTimeString(LOCALE, { hour: "2-digit", minute: "2-digit" }); }, 1000);
  }

  // The same expansion the worker does, so the operator sees the full tag
  // before saving. The worker's answer is the one stored.
  function expandTag(raw, license) {
    const s = String(raw || "").replace(/\\s+/g, "").toUpperCase();
    if (!s) return { tag: "", note: "" };
    if (/^[0-9A-Z]{24}$/.test(s)) return { tag: s, note: "" };
    if (/^[0-9]{5}$/.test(s)) { const p = OPT && OPT.tag_prefix_by_license[license]; return p ? { tag: p + s, note: "" } : { tag: "", note: tr("pick a license to expand a 5 digit serial") }; }
    return { tag: "", note: tr("a tag is 5 digits or the full 24 characters") };
  }
  function previewTag() { const bf = $("#bench-form"); const r = expandTag(bf.metrc_tag.value, bf.license.value); $("#tag-preview").textContent = r.tag || r.note; }
  $("#bench-form").metrc_tag.addEventListener("input", previewTag);

  // A refusal slug in words. A combined slug (field:slug, or field:value)
  // reads as both halves: the field's words, then the slug's line or the value.
  function friendly(err) {
    if (!err) return tr("unknown error");
    const s = String(err);
    if (FRIENDLY[s]) return FRIENDLY[s];
    const i = s.indexOf(":");
    if (i > 0) { const head = s.slice(0, i), tail = s.slice(i + 1); return (FIELDS[head] || FRIENDLY[head] || head) + ": " + (FRIENDLY[tail] || tail); }
    return s;
  }
  async function voidRow(path, reload) {
    const reason = (prompt(tr("Why is this row void? (kept on the record)")) || "").trim();
    if (!reason) return;
    const r = await send("POST", path, { reason });
    if (r.queued) { alert(pinLapsed ? pinLine() : tr("Saved on this device; sends when the connection is back.")); return; }
    if (!r.ok) alert(tr("Not voided: ") + friendly(r.body && r.body.error));
    reload();
  }

  // ---------------------------------------------------------------- bench
  let benchEditing = null, benchLoaded = null;
  function benchFormToBody(local) {
    const f = $("#bench-form");
    const g = (n) => f[n].value.trim();
    const body = { location: g("location"), reason: g("reason"), license: g("license") || null, metrc_tag: g("metrc_tag") || null, sample_type: g("sample_type"), moisture_pct: g("moisture_pct") || null, water_activity: g("water_activity") || null, thc_pct: g("thc_pct") || null, notes: g("notes") };
    // The time is sent only when the operator typed or changed it. A new
    // reading with a blank time carries the device clock at save instead, so
    // one queued through an outage lands with the time it was made.
    if (benchEditing) { if (local !== benchLoaded.tested_at_local) body.tested_at = fromLocalInput(local) || ""; body.if_updated_at = benchLoaded.updated_at; }
    else { if (local) body.tested_at = fromLocalInput(local); body.observed_at = new Date().toISOString(); }
    return body;
  }
  function benchReset() {
    benchEditing = null; $("#bench-title").textContent = tr("New bench reading"); $("#bench-save").textContent = tr("Save reading");
    const f = $("#bench-form");
    const hadStored = !!$("option[data-stored]:checked", f); dropStored(f); if (hadStored) f.reason.selectedIndex = 0;
    ["metrc_tag", "moisture_pct", "water_activity", "thc_pct", "tested_on", "tested_time", "notes"].forEach((n) => { f[n].value = ""; }); previewTag(); clear($("#bench-status")); f.metrc_tag.focus();
  }
  $("#bench-reset").addEventListener("click", benchReset);
  $("#bench-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const st = $("#bench-status"); clear(st);
    const bfNow = $("#bench-form");
    if (benchEditing && !bfNow.tested_on.value.trim() && bfNow.tested_time.value.trim()) { say(st, "err", tr("Type the date tested too; a correction never moves a reading to today.")); return; }
    const local = testedLocal(bfNow);
    if (local === null) { say(st, "err", tr("Type the time tested too, or leave the date blank.")); return; }
    const body = benchFormToBody(local);
    if (body.moisture_pct == null && body.water_activity == null && body.thc_pct == null) { say(st, "err", tr("Type at least one instrument result.")); return; }
    $("#bench-save").disabled = true;
    let r;
    if (benchEditing) r = await send("PATCH", "internal-tests/" + benchEditing, body);
    else { body.id = mintId("lt"); r = await send("POST", "internal-tests", body); }
    $("#bench-save").disabled = false;
    if (r.queued) { benchReset(); say(st, "warn", pinLapsed ? pinLine() : tr("Saved on this device. The connection is down; it sends itself when it is back.")); return; }
    if (!r.ok) { say(st, "err", tr("Not saved: ") + friendly(r.body && r.body.error)); if (r.body && r.body.error === "stale" && r.body.row) benchEdit(r.body.row); return; }
    const row = r.body.row, wasEdit = !!benchEditing;
    benchReset(); loadBench();
    const what = [tr(row.location), tr(row.sample_type), row.metrc_tag ? tr("tag") + " " + serial(row.metrc_tag) : ""].filter(Boolean).join(", ");
    const results = [row.moisture_pct != null ? "MC " + row.moisture_pct + "%" : "", row.water_activity != null ? "aw " + row.water_activity : "", row.thc_pct != null ? "THC " + row.thc_pct + "%" : ""].filter(Boolean).join(", ");
    say(st, "ok", (wasEdit ? tr("Corrected. ") : tr("Saved. ")) + what + ": " + results + " " + trf("at {time}", { time: fmtAt(row.tested_at) }));
  });
  async function loadBench() {
    const q = new URLSearchParams({ limit: "80" });
    if ($("#bench-f-location").value) q.set("location", $("#bench-f-location").value);
    if ($("#bench-f-tag").value.trim()) q.set("tag", $("#bench-f-tag").value.trim());
    if ($("#bench-f-attn").checked) q.set("needs_attention", "1");
    const r = await api("internal-tests?" + q);
    const tb = $("#bench-table tbody");
    if (!r.ok) { setHtml(tb, \`<tr><td colspan="11">\${esc(loadFail(r))}</td></tr>\`); return; }
    const voidWord = esc(tr("Void"));
    setHtml(tb, r.body.rows.map((x) => \`<tr data-id="\${esc(x.id)}">
      <td>\${x.tested_at ? esc(fmtAt(x.tested_at)) : '<span class="chip warn">' + esc(tr("no date")) + '</span>'}\${x.tested_at_source === "notes-time" ? ' <span class="chip">' + esc(tr("from notes")) + '</span>' : ""}</td>
      <td>\${x.location ? esc(tr(x.location)) : '<span class="chip warn">' + esc(tr("blank")) + '</span>'}</td><td>\${x.reason ? esc(tr(x.reason)) : '<span class="chip warn">' + esc(tr("blank")) + '</span>'}</td>
      <td title="\${esc(x.metrc_tag || x.metrc_tag_raw || "")}">\${x.metrc_tag ? esc(serial(x.metrc_tag)) : x.metrc_tag_raw ? \`<span class="chip warn">\${esc(x.metrc_tag_raw)}</span>\` : ""}</td>
      <td>\${esc(tr(x.sample_type))}</td><td class="num">\${fmtNum(x.moisture_pct, 2)}</td><td class="num">\${fmtNum(x.water_activity, 4)}</td><td class="num">\${fmtNum(x.thc_pct, 2)}</td>
      <td title="\${esc(x.notes)}">\${esc(String(x.notes || "").slice(0, 40))}</td><td>\${esc(x.operator_name || (x.operator || "").replace(/^typed:/, ""))}\${x.source === "workbook" ? ' <span class="chip">' + esc(tr("sheet")) + '</span>' : ""}</td>
      <td><button type="button" class="secondary" data-void="\${esc(x.id)}" title="\${voidWord}" aria-label="\${voidWord}">&times;</button></td></tr>\`).join("") || \`<tr><td colspan="11">\${esc(tr("Nothing yet."))}</td></tr>\`);
    tb.querySelectorAll("tr[data-id]").forEach((tr) => tr.addEventListener("click", (ev) => { if (ev.target.dataset.void) return; benchEdit(r.body.rows.find((x) => x.id === tr.dataset.id)); }));
    tb.querySelectorAll("[data-void]").forEach((b) => b.addEventListener("click", () => voidRow("internal-tests/" + b.dataset.void + "/void", loadBench)));
  }
  function benchEdit(x) {
    benchEditing = x.id; $("#bench-title").textContent = tr("Correcting a reading"); $("#bench-save").textContent = tr("Save correction");
    const f = $("#bench-form");
    dropStored(f);
    f.location.value = x.location; f.reason.value = x.reason; if (!f.reason.value && x.reason) offerStored(f.reason, x.reason);
    f.license.value = x.license || ""; f.metrc_tag.value = x.metrc_tag || x.metrc_tag_raw || ""; f.sample_type.value = x.sample_type;
    f.moisture_pct.value = x.moisture_pct == null ? "" : x.moisture_pct; f.water_activity.value = x.water_activity == null ? "" : x.water_activity; f.thc_pct.value = x.thc_pct == null ? "" : x.thc_pct;
    const at = toLocalParts(x.tested_at); f.tested_on.value = at.day; f.tested_time.value = at.time; f.notes.value = x.notes || ""; previewTag();
    benchLoaded = { tested_at_local: testedLocal(f), updated_at: x.updated_at };
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  ["bench-f-location", "bench-f-tag", "bench-f-attn"].forEach((id) => $("#" + id).addEventListener("change", loadBench));
  $("#bench-refresh").addEventListener("click", loadBench);

  // ----------------------------------------------------------- compliance
  let csEditing = null, csLoadedUpdatedAt = null, csLoadedGrams = {};
  const cf = $("#cs-form");
  function csPreview() { const lic = cf.license.value; $("#cs-src-preview").textContent = expandTag(cf.source_metrc_tag.value, lic).tag; $("#cs-smp-preview").textContent = expandTag(cf.sample_tag.value, lic).tag; }
  cf.source_metrc_tag.addEventListener("input", csPreview); cf.sample_tag.addEventListener("input", csPreview); cf.license.addEventListener("change", csPreview);
  // The Metrc mirror fills batch weight only from a package counted in grams
  // (quantity_g); a package counted in another unit shows its count instead.
  cf.source_metrc_tag.addEventListener("change", async () => {
    const t = expandTag(cf.source_metrc_tag.value, cf.license.value).tag; if (!t) return;
    const r = await api("metrc/" + t);
    if (r.ok && r.body.found) {
      const p = r.body.row; if (!cf.strain.value) cf.strain.value = p.strain || ""; if (!cf.item_name.value) cf.item_name.value = p.item || "";
      if (!cf.batch_weight_g.value && p.quantity_g != null) cf.batch_weight_g.value = gramsIn(String(p.quantity_g));
      $("#cs-batch-unit").textContent = p.quantity_g == null && p.quantity != null ? trf("Metrc counts this package as {qty} {unit}; type the batch weight in grams.", { qty: p.quantity, unit: p.unit || "" }) : "";
      if (!cf.harvest_batch.value) cf.harvest_batch.value = p.source_harvest || "";
    }
  });
  function csReset(program) { csEditing = null; csLoadedGrams = {}; dropStored(cf); cf.reset(); cf.program.value = program || "compliance"; $("#cs-title").textContent = program === "rnd" ? tr("New R&D sample") : tr("New compliance sample"); $("#cs-save").textContent = tr("Save sample"); const last = store.get("lab.license"); if (last) cf.license.value = last; cf.status.value = "scheduled"; $("#cs-batch-unit").textContent = ""; csPreview(); clear($("#cs-status")); }
  $("#cs-reset").addEventListener("click", () => csReset(cf.program.value));
  cf.addEventListener("submit", async (e) => {
    e.preventDefault();
    const st = $("#cs-status"); clear(st);
    const g = (n) => cf[n].value.trim();
    const body = { program: g("program"), license: g("license"), market: g("market") || null, source_metrc_tag: g("source_metrc_tag"), strain: g("strain"), item_name: g("item_name"), batch_weight_g: gramsIn(g("batch_weight_g")), harvest_batch: g("harvest_batch"), sample_tag: g("sample_tag") || null, required_test: g("required_test"), net_weight_g: gramsIn(g("net_weight_g")), testing_facility: g("testing_facility") || null, entered_testing_on: g("entered_testing_on") || null, finished_testing_on: g("finished_testing_on") || null, thc_potency_pct: g("thc_potency_pct") || null, status: g("status"), fail_reason: g("fail_reason") || null, notes: g("notes") };
    $("#cs-save").disabled = true;
    let r;
    if (csEditing) {
      // A stored gram figure left as shown (whole) is not sent, so an update
      // never rewrites a stored weight nobody touched.
      for (const k of ["batch_weight_g", "net_weight_g"]) if (Object.prototype.hasOwnProperty.call(csLoadedGrams, k) && g(k) === csLoadedGrams[k]) delete body[k];
      body.if_updated_at = csLoadedUpdatedAt; r = await send("PATCH", "compliance/" + csEditing, body);
    }
    else { body.id = mintId("cs"); r = await send("POST", "compliance", body); }
    $("#cs-save").disabled = false;
    if (r.queued) { const prog = body.program; csReset(prog); say(st, "warn", pinLapsed ? pinLine() : tr("Saved on this device. Sends when the connection is back.")); return; }
    if (!r.ok) { say(st, "err", tr("Not saved: ") + friendly(r.body && r.body.error)); if (r.body && r.body.error === "stale" && r.body.row) csEdit(r.body.row); return; }
    const row = r.body.row, wasEdit = !!csEditing;
    csReset(row.program); loadCompliance(); loadRnd();
    const vars = { program: row.program === "rnd" ? tr("R&D") : tr("compliance"), tag: serial(row.source_metrc_tag), status: statusWord(row.status).toLowerCase() };
    say(st, "ok", wasEdit ? trf("Updated {program} sample, source {tag}, {status}.", vars) : trf("Saved {program} sample, source {tag}, {status}.", vars));
  });
  function csEdit(x) {
    csEditing = x.id; csLoadedUpdatedAt = x.updated_at; csLoadedGrams = {}; $("#cs-title").textContent = tr("Updating a sample"); $("#cs-save").textContent = tr("Save update");
    dropStored(cf); $("#cs-batch-unit").textContent = "";
    for (const k of ["program", "license", "market", "source_metrc_tag", "strain", "item_name", "batch_weight_g", "harvest_batch", "sample_tag", "required_test", "net_weight_g", "testing_facility", "entered_testing_on", "finished_testing_on", "thc_potency_pct", "status", "fail_reason", "notes"]) {
      if (!cf[k]) continue; const v = x[k] == null ? "" : x[k];
      if (k === "batch_weight_g" || k === "net_weight_g") { const shown = v === "" ? "" : gramsIn(String(v)); cf[k].value = shown; csLoadedGrams[k] = shown; continue; }
      cf[k].value = v;
      if (cf[k].tagName === "SELECT" && cf[k].value !== String(v) && v !== "") offerStored(cf[k], v);
    }
    csPreview(); $$("#tabs button").find((b) => b.dataset.tab === "compliance").click(); window.scrollTo({ top: 0, behavior: "smooth" });
  }
  // The Ready chip's tooltip, built from the readiness numbers in the page's
  // words (the server's why stays English for the JSON contract only).
  function readyTitle(r) {
    if (r.water_activity == null) return tr("No After Cryo water activity on the source package yet.");
    const vars = { aw: Number(r.water_activity).toFixed(4), at: r.tested_at ? fmtAt(r.tested_at) : tr("no date"), limit: Number(OPT && OPT.ready_aw_limit != null ? OPT.ready_aw_limit : 0.6).toFixed(2) };
    return r.ready ? trf("After Cryo water activity {aw} ({at}) is at or under {limit}.", vars) : trf("After Cryo water activity {aw} ({at}) is over {limit}.", vars);
  }
  function readyChip(x) {
    if (x.status !== "scheduled") return "";
    const r = x.readiness; if (!r) return "";
    return \`<span class="chip \${r.ready ? "status-Passed" : "warn"}" title="\${esc(readyTitle(r))}">\${esc(r.ready ? tr("Ready") : tr("Not ready"))}</span>\`;
  }
  const statusWord = (s) => tr(((OPT && OPT.statuses.find((o) => o.value === s)) || { label: s }).label);
  const statusChip = (s) => { const cls = /passed/.test(s) ? "status-Passed" : /failed/.test(s) ? "status-Failed" : ""; return \`<span class="chip \${cls}">\${esc(statusWord(s))}</span>\`; };
  const sampleRow = (x, withSelect, withNotes) => \`<tr data-id="\${esc(x.id)}">
      \${withSelect ? \`<td><input type="checkbox" data-sel="\${esc(x.id)}" aria-label="\${esc(tr("Sample") + " " + serial(x.sample_tag || x.source_metrc_tag))}" \${x.status === "scheduled" && x.sample_tag && x.net_weight_g != null ? "" : "disabled"}></td>\` : ""}
      <td title="\${esc(x.source_metrc_tag)}">\${esc(serial(x.source_metrc_tag))}</td><td>\${esc(x.strain)}</td><td>\${esc(x.item_name)}</td><td>\${esc(x.harvest_batch)}</td>
      <td title="\${esc(x.sample_tag || "")}">\${esc(serial(x.sample_tag))}</td><td>\${esc(tr(x.required_test))}</td><td class="num">\${esc(fmtGrams(x.net_weight_g))}</td><td>\${esc(x.testing_facility)}</td>
      <td>\${esc(x.entered_testing_on)}</td><td>\${esc(x.finished_testing_on)}</td><td class="num">\${x.turnaround_days == null ? "" : esc(x.turnaround_days)}</td><td class="num">\${fmtNum(x.thc_potency_pct, 2)}</td>
      <td>\${statusChip(x.status)}\${x.fail_reason ? ' <span class="muted">' + esc(tr(x.fail_reason)) + "</span>" : ""}</td>
      \${withNotes ? \`<td title="\${esc(x.notes)}">\${esc(String(x.notes || "").slice(0, 40))}</td>\` : \`<td>\${readyChip(x)}</td>\`}
      <td><button type="button" class="secondary" data-void="\${esc(x.id)}" title="\${esc(tr("Void"))}" aria-label="\${esc(tr("Void"))}">&times;</button></td></tr>\`;
  async function loadCompliance() {
    const q = new URLSearchParams({ program: "compliance", limit: "200" });
    if ($("#cs-f-status").value) q.set("status", $("#cs-f-status").value);
    if ($("#cs-f-tag").value.trim()) q.set("tag", $("#cs-f-tag").value.trim());
    const r = await api("compliance?" + q);
    const tb = $("#cs-table tbody");
    if (!r.ok) { setHtml(tb, \`<tr><td colspan="16">\${esc(loadFail(r))}</td></tr>\`); return; }
    setHtml(tb, r.body.rows.map((x) => sampleRow(x, true, false)).join("") || \`<tr><td colspan="16">\${esc(tr("Nothing yet."))}</td></tr>\`);
    tb.querySelectorAll("tr[data-id]").forEach((tr) => tr.addEventListener("click", (ev) => { if (ev.target.dataset.void || ev.target.dataset.sel) return; csEdit(r.body.rows.find((x) => x.id === tr.dataset.id)); }));
    tb.querySelectorAll("[data-void]").forEach((b) => b.addEventListener("click", () => voidRow("compliance/" + b.dataset.void + "/void", loadCompliance)));
  }
  ["cs-f-status", "cs-f-tag"].forEach((id) => $("#" + id).addEventListener("change", loadCompliance));
  $("#cs-refresh").addEventListener("click", loadCompliance);
  $("#cs-autofill").addEventListener("click", () => {
    const ids = $$("#cs-table [data-sel]:checked").map((c) => c.dataset.sel);
    if (!ids.length) { alert(tr("Tick the scheduled samples that have a sample tag and a net weight.")); return; }
    if (ids.length > 90) { alert(trf("Pick at most 90 samples at a time; {n} are ticked.", { n: ids.length })); return; }
    window.location.href = "/api/lab/compliance/metrc-autofill.csv?ids=" + encodeURIComponent(ids.join(","));
  });

  // ------------------------------------------------------------------ R&D
  async function loadRnd() {
    const q = new URLSearchParams({ program: "rnd", limit: "200" });
    if ($("#rnd-f-status").value) q.set("status", $("#rnd-f-status").value);
    const r = await api("compliance?" + q);
    const tb = $("#rnd-table tbody");
    if (!r.ok) { setHtml(tb, \`<tr><td colspan="15">\${esc(loadFail(r))}</td></tr>\`); return; }
    setHtml(tb, r.body.rows.map((x) => sampleRow(x, false, true)).join("") || \`<tr><td colspan="15">\${esc(tr("Nothing yet."))}</td></tr>\`);
    tb.querySelectorAll("tr[data-id]").forEach((tr) => tr.addEventListener("click", (ev) => { if (ev.target.dataset.void) return; csEdit(r.body.rows.find((x) => x.id === tr.dataset.id)); }));
    tb.querySelectorAll("[data-void]").forEach((b) => b.addEventListener("click", () => voidRow("compliance/" + b.dataset.void + "/void", loadRnd)));
  }
  $("#rnd-f-status").addEventListener("change", loadRnd);
  $("#rnd-refresh").addEventListener("click", loadRnd);
  $("#rnd-new").addEventListener("click", () => { csReset("rnd"); $$("#tabs button").find((b) => b.dataset.tab === "compliance").click(); });

  // ------------------------------------------------------------ photonics
  let opText = null;
  $("#op-file").addEventListener("change", async (e) => { const f = e.target.files[0]; opText = f ? await f.text() : null; $("#op-import").disabled = !opText; });
  // CSV records, quote aware: a newline inside a quoted field does not end a record.
  function csvRecords(text) {
    const out = []; let cur = "", q = false;
    const t = String(text).replace(/^\\uFEFF/, "");
    for (let i = 0; i < t.length; i++) {
      const c = t[i];
      if (c === '"') { q = !q; cur += c; }
      else if ((c === "\\n" || c === "\\r") && !q) { if (c === "\\r" && t[i + 1] === "\\n") i++; if (cur.trim()) out.push(cur); cur = ""; }
      else cur += c;
    }
    if (cur.trim()) out.push(cur);
    return out;
  }
  const IMPORT_SLICE = 900;
  const sliceWord = (n) => (n === 1 ? tr("slice") : tr("slices"));
  $("#op-import").addEventListener("click", async () => {
    const st = $("#op-status"); clear(st); $("#op-import").disabled = true;
    const recs = csvRecords(opText);
    if (recs.length < 2) { say(st, "err", tr("That file has no rows.")); $("#op-import").disabled = false; return; }
    const header = recs[0], body = recs.slice(1);
    const totals = { rows: 0, landed: 0, already_there: 0, duplicate_in_file: 0, refused_count: 0, refused: [] };
    let slices = 0;
    try {
      for (let i = 0; i < body.length; i += IMPORT_SLICE) {
        const chunk = [header].concat(body.slice(i, i + IMPORT_SLICE)).join("\\n") + "\\n";
        const r = await fetch("/api/lab/op/import", { method: "POST", headers: { "content-type": "text/csv", "x-lab-operator": operatorHeader(), "x-lab-client": "station" }, body: chunk });
        let b = null; try { b = await r.json(); } catch {}
        if (!r.ok || !b) {
          const why = !b && r.status === 401 ? pinLine() : b && b.error === "header" ? trf("the file is not a LightLab export (missing {cols})", { cols: (b.missing || []).join(", ") }) : friendly(b && b.error);
          say(st, "err", trf("Slice {n} was not imported: {why}. {landed} rows from earlier slices did land; importing the same file again adds only what is missing.", { n: slices + 1, why, landed: totals.landed }));
          $("#op-import").disabled = false; return;
        }
        slices++;
        for (const k of ["rows", "landed", "already_there", "duplicate_in_file", "refused_count"]) totals[k] += b[k] || 0;
        totals.refused = totals.refused.concat(b.refused || []).slice(0, 10);
      }
      const lines = totals.refused_count ? " (" + totals.refused.slice(0, 5).map((x) => trf("line {line}: {why}", { line: x.line, why: friendly(x.error) })).join("; ") + ")" : "";
      say(st, totals.refused_count ? "warn" : "ok", trf("{rows} rows in the file ({slices} {slice_word}): {landed} new, {already} already here, {dup} repeated in the file, {refused} refused", { rows: totals.rows, slices, slice_word: sliceWord(slices), landed: totals.landed, already: totals.already_there, dup: totals.duplicate_in_file, refused: totals.refused_count }) + lines + ".");
      loadOp();
    } catch { say(st, "err", trf("The upload stopped reaching the server after {slices} {slice_word} ({landed} rows landed). Keep the file and import it again; it adds only what is missing.", { slices, slice_word: sliceWord(slices), landed: totals.landed })); }
    $("#op-import").disabled = false;
  });
  async function loadOp() {
    const q = new URLSearchParams({ limit: "100" });
    if ($("#op-f-class").value) q.set("class", $("#op-f-class").value);
    const r = await api("op?" + q);
    const tb = $("#op-table tbody");
    if (!r.ok) { setHtml(tb, \`<tr><td colspan="12">\${esc(loadFail(r))}</td></tr>\`); return; }
    setHtml(tb, r.body.rows.map((x) => \`<tr><td>\${esc(fmtAt(x.tested_at))}</td><td>\${esc(x.sample_id)}</td><td>\${esc(x.material_class ? tr(x.material_class) : x.notes)}</td><td>\${esc(x.cultivar)}</td>
      <td class="num">\${fmtNum(x.thca, 1)}</td><td class="num">\${fmtNum(x.d9_thc, 1)}</td><td class="num">\${fmtNum(x.total_thc, 1)}</td><td class="num">\${fmtNum(x.total_cbd, 1)}</td><td class="num">\${fmtNum(x.total_cannabinoids, 1)}</td>
      <td>\${esc(x.terpenes_level)}</td><td>\${esc(x.confidence)}</td><td>\${esc(x.operator_name || (x.operator || "").replace(/^typed:/, ""))}</td></tr>\`).join("") || \`<tr><td colspan="12">\${esc(tr("Nothing yet."))}</td></tr>\`);
  }
  $("#op-f-class").addEventListener("change", loadOp); $("#op-refresh").addEventListener("click", loadOp);

  // ------------------------------------------------------------- schedule
  const HOURS = [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 0, 1, 2, 3, 4, 5];
  async function loadSchedule() {
    if (!$("#sch-from").value) $("#sch-from").value = localDay(new Date(Date.now() - 86400e3));
    const r = await api("schedule?from=" + $("#sch-from").value + "&days=7");
    if (!r.ok) { setHtml($("#sch-table thead"), ""); setHtml($("#sch-table tbody"), \`<tr><td colspan="25">\${esc(loadFail(r))}</td></tr>\`); return; }
    const by = {};
    for (const x of r.body.rows) (by[x.day + "|" + x.hour] = by[x.day + "|" + x.hour] || []).push(x.location);
    const nowH = new Date().getHours(), today = localDay(new Date());
    setHtml($("#sch-table thead"), "<tr><th>" + esc(tr("Day")) + "</th>" + HOURS.map((h) => \`<th>\${String(h).padStart(2, "0")}00</th>\`).join("") + "</tr>");
    const days = []; for (let i = 0; i < 7; i++) days.push(new Date(Date.parse(r.body.from + "T00:00:00Z") + i * 86400e3).toISOString().slice(0, 10));
    setHtml($("#sch-table tbody"), days.map((d) => \`<tr><th>\${esc(d.slice(5))}</th>\` + HOURS.map((h) => \`<td data-day="\${esc(d)}" data-hour="\${h}" class="\${d === today && h === nowH ? "now" : ""}">\${esc((by[d + "|" + h] || []).join("/").replace(/Silo /g, "S"))}</td>\`).join("") + "</tr>").join(""));
    $$("#sch-table td").forEach((td) => td.addEventListener("click", () => editCell(td, by)));
  }
  function editCell(td, by) {
    if (td.querySelector("input")) return;
    const cur = (by[td.dataset.day + "|" + td.dataset.hour] || []).join("/");
    const inp = document.createElement("input"); inp.type = "text"; inp.value = cur; inp.placeholder = tr("Silo 3/Silo 5");
    inp.setAttribute("aria-label", td.dataset.day + " " + String(td.dataset.hour).padStart(2, "0") + "00");
    td.textContent = ""; td.appendChild(inp); inp.focus();
    let finished = false;
    const done = async (save) => {
      if (finished) return; finished = true;
      if (!save || inp.value.trim() === cur) { loadSchedule(); return; }
      const r = await send("PUT", "schedule", { day: td.dataset.day, hour: Number(td.dataset.hour), locations: inp.value });
      if (r.queued) alert(pinLapsed ? pinLine() : tr("Saved on this device; sends when the connection is back."));
      else if (!r.ok) alert(tr("Not saved: ") + friendly(r.body && r.body.error));
      loadSchedule();
    };
    inp.addEventListener("keydown", (e) => { if (e.key === "Enter") done(true); if (e.key === "Escape") done(false); });
    inp.addEventListener("blur", () => done(true));
  }
  $("#sch-refresh").addEventListener("click", loadSchedule); $("#sch-from").addEventListener("change", loadSchedule);

  // -------------------------------------------------------------- summary
  async function loadSummary() {
    const r = await api("summary");
    if (!r.ok) { setHtml($("#sum-tiles"), \`<div class="tile"><div class="tile-kind">\${esc(loadFail(r))}</div></div>\`); return; }
    const s = r.body;
    const n = (st) => s.compliance.by_status.filter((x) => x.program === "compliance" && x.status === st).reduce((a, x) => a + x.n, 0);
    const ta = s.compliance.turnaround_30d || {};
    const tiles = [
      [tr("Scheduled"), s.compliance.scheduled, \`\${s.compliance.scheduled_ready} \${tr("ready to send")}\`],
      [tr("Out at the lab"), n("in_testing") + n("not_submitted"), tr("compliance")],
      [tr("Passed"), n("passed") + n("retest_passed"), tr("all time")],
      [tr("Failed"), n("failed") + n("retest_failed"), tr("all time")],
      [tr("Turnaround"), ta.avg_days != null ? trf("{n} d", { n: ta.avg_days }) : "", trf("{n} finished in 30 days", { n: ta.n || 0 })],
      [tr("Bench, 7 days"), s.bench.last_7_days_by_location.reduce((a, x) => a + x.n, 0), trf("last {at}", { at: s.bench.last_reading_at ? fmtAt(s.bench.last_reading_at) : tr("never") })],
      [tr("Needs attention"), s.bench.needs_attention, tr("bench rows missing a field")],
    ];
    setHtml($("#sum-tiles"), tiles.map(([l, v, sub]) => \`<div class="tile"><div class="tile-kind">\${esc(l)}</div><div class="tile-count">\${esc(v)}</div><div class="muted">\${esc(sub)}</div></div>\`).join(""));
    const none = (cols) => \`<tr><td colspan="\${cols}">\${esc(tr("None"))}</td></tr>\`;
    setHtml($("#sum-bench tbody"), s.bench.last_7_days_by_location.map((x) => \`<tr><td>\${esc(x.location ? tr(x.location) : tr("(blank)"))}</td><td class="num">\${esc(x.n)}</td><td class="num">\${esc(x.mc)}</td><td class="num">\${esc(x.aw)}</td><td class="num">\${esc(x.thc)}</td></tr>\`).join("") || none(5));
    setHtml($("#sum-op tbody"), s.orange_photonics.last_7_days_by_class.map((x) => \`<tr><td>\${esc(x.material_class ? tr(x.material_class) : tr("(unclassified)"))}</td><td class="num">\${esc(x.n)}</td><td class="num">\${fmtNum(x.avg_total_thc, 2)}</td><td class="num">\${fmtNum(x.max_total_thc, 2)}</td></tr>\`).join("") || none(4));
  }

  boot();
})();`;

/** The station's client, as a script element (the app's client script pattern). */
export function labClientScript(): string {
  return `<script>${LAB_CLIENT_JS}</script>`;
}
