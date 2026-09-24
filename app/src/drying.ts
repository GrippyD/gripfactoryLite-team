/**
 * Drying Operations: the Load Silo station and the silo strip (owner ruling
 * 2026-09-08, canon 0.30.6, verbatim: "Drying Operations add [load silo]  Left
 * Pane is Wet weights in barn at PNN - Last 6 METRC Tag/Origin Farm/Market
 * Strain  CSV is 832 Barn - 832 Silo n with all the important bits and pieces
 * Working Pane is: Above the working pane: 5 circles with clocks running (you
 * know the drill same as inventory report)  1.  lot selected from left Start
 * time  2. Start Button - greyed when started - Pause Button - Pencil Button
 * Selecting a lot from the left pane opens the wet lot entry on the working
 * pane, silos are persistent above all 'Drying Operations pages inccluding the
 * drying operations menu").
 *
 * The circles are the inventory report's gauge idiom (.inv-gauge), one per
 * silo, each load a line with its clock. Clocks compute in TypeScript from the
 * load's started_at, paused_at, and banked paused_seconds; a small inline
 * script keeps them ticking between renders.
 */

import { formatGrams, shortLotId, spaceHoldsOneLot } from "./config";
import type { BarnWetLotRow, SiloLoadRow, SiloRow } from "./db";
import { effectiveDateField } from "./effective";
import { FARM_DAY_START_HOUR_DEFAULT } from "./farmday";
import { esc, time24MaskScript } from "./html";
import { t, type Locale } from "./i18n";
import { lotStrainLine, siloLiveScript, siloTile, siloWaitingLines, spaceShapeOf, type SiloLive } from "./silo";

export type ClockState = "not_started" | "running" | "paused";

/** THE LOADED TIME IS THE CLOCK'S ZERO (owner ruling 2026-09-08, canon 0.30.9,
 * verbatim: "The "LOADED" time is when the clock should start"). */
export function clockZeroMs(load: { loaded_at: string; started_at?: string | null }): number | null {
  const zero = Date.parse(load.loaded_at);
  if (Number.isFinite(zero)) return zero;
  const fallback = load.started_at ? Date.parse(load.started_at) : NaN;
  return Number.isFinite(fallback) ? fallback : null;
}

/** Elapsed drying seconds for a load at nowIso: from the loaded time, minus
 * the banked pauses, frozen at paused_at while paused. Null only when the
 * load carries no readable time at all. */
export function siloClockSeconds(
  load: { loaded_at: string; started_at?: string | null; paused_at: string | null; paused_seconds: number },
  nowIso: string
): number | null {
  const start = clockZeroMs(load);
  if (start == null) return null;
  const end = load.paused_at ? Date.parse(load.paused_at) : Date.parse(nowIso);
  if (!Number.isFinite(end)) return null;
  const raw = Math.floor((end - start) / 1000) - Number(load.paused_seconds ?? 0);
  return Math.max(0, raw);
}

export function siloClockState(load: {
  loaded_at: string;
  started_at?: string | null;
  paused_at: string | null;
}): ClockState {
  if (clockZeroMs(load) == null) return "not_started";
  return load.paused_at ? "paused" : "running";
}

/** "1d 03:24:17": days then hh:mm:ss, the running-clock shape. */
export function formatClock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const days = Math.floor(s / 86400);
  const rem = s % 86400;
  const hh = String(Math.floor(rem / 3600)).padStart(2, "0");
  const mm = String(Math.floor((rem % 3600) / 60)).padStart(2, "0");
  const ss = String(rem % 60).padStart(2, "0");
  return `${days}d ${hh}:${mm}:${ss}`;
}

/** THE ROOM HOLDS MANY (canon 0.30.132): "holding 1 lot" / "holding 2 lots" on a room's or freezer's option. */
function countLots(n: number, locale: Locale): string {
  return n === 1 ? t(locale, "holding 1 lot") : t(locale, "holding {n} lots").replace("{n}", String(n));
}

/** "Last 6 METRC Tag/Origin Farm/Market Strain": the left pane row label.
 * THE FINISHED LOT IS ELIGIBLE (canon 0.30.130): a lot without a live package
 * (voided, or closed as gone in METRC) has no package code to fall back on; it
 * reads by its HBN serial, the number the floor calls it by. */
export function barnLotLabel(lot: {
  metrc_harvest_tag: string | null;
  package_code: string | null;
  farm_code: string | null;
  strain_label: string | null;
  hbn?: string | null;
}): string {
  const tag = (lot.metrc_harvest_tag ?? lot.package_code ?? (lot.hbn ? shortLotId(lot.hbn, null) : "")).trim();
  const last6 = tag.length > 6 ? tag.slice(-6) : tag;
  return [last6 || "?", lot.farm_code ?? "?", lot.strain_label ?? ""].join(" / ");
}

function clockMarkup(load: SiloLoadRow, nowIso: string, locale: Locale): string {
  const state = siloClockState(load);
  const seconds = siloClockSeconds(load, nowIso);
  const label =
    state === "not_started"
      ? t(locale, "Not started")
      : state === "paused"
        ? t(locale, "Paused")
        : t(locale, "Running");
  const startedMs = clockZeroMs(load) ?? "";
  const pausedAtMs = load.paused_at ? Date.parse(load.paused_at) : "";
  return `<span class="silo-clock" data-clock data-state="${esc(state)}" data-started="${esc(String(startedMs))}" data-paused-at="${esc(
    String(pausedAtMs)
  )}" data-paused-seconds="${esc(String(load.paused_seconds ?? 0))}">${esc(seconds == null ? "0d 00:00:00" : formatClock(seconds))}</span> <span class="muted silo-clock-state">${esc(label)}</span>`;
}

/** The five silos, persistent above every Drying Operations page. THE SILO SHAPE
 * AND THE LIVE WET WEIGHT (canon 0.30.69): each is a cone-topped cylinder
 * wireframe with the fill inside it (green and throbbing while the wet weight
 * screen fills it, red and throbbing once the clock runs), the state word under
 * the shape, the load's lot link and clock, and the wet weight at the bottom;
 * the live script keeps every tile current. */
export function siloStrip(live: SiloLive[], nowIso: string, locale: Locale = "en", extraTiles = ""): string {
  const tiles = live
    .map(({ silo, visual, loads, waiting }) => {
      // THE LOADING SILO (canon 0.30.81): the lots waiting in the barn for this silo ride under its word.
      const body =
        loads
          .map(
            (load) => `<div class="inv-lot" data-load="${esc(load.id)}">
            <div class="inv-lot-id"><a href="/station/load_silo?load=${esc(load.id)}">${esc(
              t(locale, "Lot")
            )} ${esc(shortLotId(load.hbn ?? "", load.metrc_harvest_tag))}</a></div>
            ${lotStrainLine(load.strain_label)}
            <div class="inv-lot-time">${clockMarkup(load, nowIso, locale)}</div>
          </div>`
          )
          .join("") + siloWaitingLines(waiting ?? [], locale);
      // THE HARVEST CONSOLE (canon 0.30.73): the silo's shape is data; the
      // Arlington Dry Room draws as the wire box beside the five cylinders.
      // THE DRY SPACE TYPE (canon 0.30.106): the type decides the shape.
      return siloTile({ id: silo.id, name: silo.name, visual, body, locale, shape: spaceShapeOf(silo) });
    })
    .join("");
  return `<section class="silo-strip" data-silo-strip>
    <div class="inv-gauges">${tiles}${extraTiles}</div>
  </section>${clockScript()}${siloLiveScript()}`;
}

/** Keeps every [data-clock] ticking once a second from its data attributes;
 * paused and not-started clocks hold still. */
export function clockScript(): string {
  return `<script>
(function () {
  function fmt(s) {
    s = Math.max(0, Math.floor(s));
    var d = Math.floor(s / 86400), r = s % 86400;
    var hh = String(Math.floor(r / 3600)).padStart(2, "0");
    var mm = String(Math.floor((r % 3600) / 60)).padStart(2, "0");
    var ss = String(r % 60).padStart(2, "0");
    return d + "d " + hh + ":" + mm + ":" + ss;
  }
  function tick() {
    var now = Date.now();
    document.querySelectorAll("[data-clock]").forEach(function (el) {
      if (el.getAttribute("data-state") !== "running") return;
      var started = Number(el.getAttribute("data-started"));
      var banked = Number(el.getAttribute("data-paused-seconds") || 0);
      if (!started) return;
      el.textContent = fmt((now - started) / 1000 - banked);
    });
  }
  function pad(n) { return String(n).padStart(2, "0"); }
  // The strip (and this script) render above the page, so the loaded times
  // below may not exist yet on the first pass: render them on every tick,
  // once each.
  function localTimes() {
    document.querySelectorAll("time[data-local]:not([data-local-done])").forEach(function (el) {
      var ms = Date.parse(el.getAttribute("datetime") || "");
      if (!isFinite(ms)) return;
      var d = new Date(ms);
      el.textContent = d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()) + " " + pad(d.getHours()) + ":" + pad(d.getMinutes());
      el.setAttribute("data-local-done", "1");
    });
  }
  function beat() { localTimes(); tick(); }
  beat();
  setInterval(beat, 1000);
})();
</script>`;
}

/** The loaded-time resolver for the load form (canon 0.30.9): the typed HH:MM
 * is a wall clock on the crew's day, so the browser writes the instant into
 * loaded_at_iso at submit; blank stays blank (the server loads now). THE
 * EFFECTIVE DATE (canon 0.30.92): the day is the Effective Date when one is
 * picked, today otherwise. */
export function loadedAtScript(): string {
  return `<script>
(function () {
  var form = document.querySelector("form[data-load-silo]");
  if (!form) return;
  form.addEventListener("submit", function () {
    var typed = (form.querySelector("[name=start_time]") || {}).value || "";
    var hidden = form.querySelector("[name=loaded_at_iso]");
    if (!hidden) return;
    var m = /^([01][0-9]|2[0-3]):([0-5][0-9])$/.exec(typed.trim());
    if (!m) { hidden.value = ""; return; }
    var d = new Date();
    var day = ((form.querySelector("[name=effective_date]") || {}).value || "").trim();
    var dm = /^(\\d{4})-(\\d{2})-(\\d{2})$/.exec(day);
    if (dm) d = new Date(Number(dm[1]), Number(dm[2]) - 1, Number(dm[3]));
    // THE FARM DAY BEGINS AT SIX (canon 0.30.151): a time before the start hour
    // the page's body carries is on the next calendar date of that farm day.
    var startHour = parseInt((document.body && document.body.getAttribute("data-farm-day-start")) || "${FARM_DAY_START_HOUR_DEFAULT}", 10);
    if (dm && !isNaN(startHour) && Number(m[1]) < startHour) d.setDate(d.getDate() + 1);
    d.setHours(Number(m[1]), Number(m[2]), 0, 0);
    hidden.value = d.toISOString();
  });
})();
</script>`;
}

/** The wet lot entry, as saved (his words: "Selecting a lot from the left pane
 * opens the wet lot entry on the working pane"). */
function lotEntryCard(lot: BarnWetLotRow, locale: Locale): string {
  return `<h2 class="working-pick">${esc([lot.farm_code, lot.strain_label, lot.entry_date].filter(Boolean).join(" / "))}</h2>
    <p class="muted">${esc(lot.hbn ?? "")}</p>
    <dl class="lot-meta">
      <dt>${esc(t(locale, "Package"))}</dt><dd>${esc(lot.package_code ?? shortLotId(lot.hbn ?? "", lot.metrc_harvest_tag))}</dd>
      <dt>${esc(t(locale, "Total"))}</dt><dd>${esc(formatGrams(Number(lot.weight_grams)))} g</dd>
      <dt>${esc(t(locale, "Material"))}</dt><dd>${esc(t(locale, lot.material_form === "bucked" ? "Bucked" : "Spear"))}</dd>
      <dt>${esc(t(locale, "Move To"))}</dt><dd>${esc(lot.planned_space_name ?? "")}</dd>
      <dt>${esc(t(locale, "Supervisor"))}</dt><dd data-supervisor>${esc(lot.supervisor_name ?? "")}</dd>
      <dt>${esc(t(locale, "Team Lead"))}</dt><dd data-team-lead>${esc(lot.lead_name ?? "")}</dd>
      <dt>${esc(t(locale, "Notes"))}</dt><dd>${esc(lot.notes ?? "")}</dd>
      ${lot.plant_count != null ? `<dt>${esc(t(locale, "Plants"))}</dt><dd data-plant-count>${esc(String(lot.plant_count))}</dd>` : ""}
    </dl>`;
}

/** THE PLANT COUNT (owner ruling 2026-09-14, canon 0.30.62, verbatim: "If the
 * user skips, you're prompted again when you load a silo or a dry room in the
 * load silo page"): the load form asks again for a lot without a count; blank
 * skips again, and the reasoned pencil stays open on the lot record. */
function plantCountPrompt(lot: BarnWetLotRow, locale: Locale): string {
  if (lot.plant_count != null) return "";
  return `<div class="plant-prompt" data-plant-prompt>
        <label class="field">${esc(t(locale, "Number of plants"))} <input type="text" name="plant_count" inputmode="numeric" pattern="[0-9,]*" placeholder="${esc(t(locale, "skipped at Finish lot"))}" data-plant-count-input></label>
        <p class="muted">${esc(t(locale, "How many plants made this lot. Leave it blank to skip again; the pencil on the lot record can set it later."))}</p>
      </div>`;
}

export function loadSiloPage(input: {
  barnLots: BarnWetLotRow[];
  silos: SiloRow[];
  loads: SiloLoadRow[];
  picked: BarnWetLotRow | null;
  pickedLoad: SiloLoadRow | null;
  nowIso: string;
  /** THE FARM DAY BEGINS AT SIX (canon 0.30.151): the start hour in data, for the Effective Date's today. */
  farmDayStart?: number;
  locale?: Locale;
  ok?: string;
}): string {
  const locale = input.locale ?? "en";
  const rows =
    input.barnLots.length === 0
      ? `<p class="muted">${esc(t(locale, "- EMPTY -"))}</p>`
      : `<ul class="ledger-list">${input.barnLots
          .map(
            (lot) => `<li><a class="queue-pane-item${input.picked?.id === lot.id ? " selected" : ""}" href="/station/load_silo?pick=${esc(
              lot.id
            )}"><strong>${esc(barnLotLabel(lot))}</strong> <span class="muted">${esc(formatGrams(Number(lot.weight_grams)))} g</span>${
              lot.item_id ? "" : ` <span class="muted" data-no-package>(${esc(t(locale, "no live package"))})</span>`
            }</a></li>`
          )
          .join("")}</ul>`;
  let working: string;
  if (input.pickedLoad) {
    const load = input.pickedLoad;
    const state = siloClockState(load);
    const startDisabled = state !== "not_started";
    const pauseLabel = state === "paused" ? t(locale, "Resume") : t(locale, "Pause");
    working = `<h2 class="working-pick">${esc(load.silo_name ?? "")}</h2>
      <p class="muted">${esc(load.hbn ?? "")}</p>
      <dl class="lot-meta">
        <dt>${esc(t(locale, "Lot"))}</dt><dd>${esc(shortLotId(load.hbn ?? "", load.metrc_harvest_tag))} ${esc(load.strain_label ?? "")}</dd>
        <dt>${esc(t(locale, "Total"))}</dt><dd>${esc(formatGrams(Number(load.weight_grams ?? 0)))} g</dd>
        <dt>${esc(t(locale, "Loaded"))}</dt><dd><time datetime="${esc(load.loaded_at)}" data-local>${esc(load.loaded_at)}</time> <span class="muted">${esc(t(locale, "the clock's zero"))}</span></dd>
        <dt>${esc(t(locale, "Clock"))}</dt><dd>${clockMarkup(load, input.nowIso, locale)}</dd>
      </dl>
      <div class="row-actions silo-controls">
        <form method="post" action="/station/load_silo/${esc(load.id)}/start">
          <button type="submit"${startDisabled ? " disabled" : ""} title="${esc(t(locale, "The clock started at the loaded time."))}">${esc(t(locale, "Start"))}</button>
        </form>
        <form method="post" action="/station/load_silo/${esc(load.id)}/pause">
          <button type="submit" class="secondary"${state === "not_started" ? " disabled" : ""}>${esc(pauseLabel)}</button>
        </form>
        <a class="btn secondary pencil" href="/record/silo_loads/${esc(load.id)}/edit" title="${esc(t(locale, "Edit with reason"))}">&#9998;</a>
      </div>`;
  } else if (input.picked && !input.picked.item_id) {
    // THE FINISHED LOT IS ELIGIBLE (canon 0.30.130): the lot stands on the pane
    // (Finish lot ran on it) but its package is gone from the ledger, voided by
    // a hand or closed as gone in METRC; a load would move nothing and pend no
    // paper, so the words stand where the form would.
    working = `${lotEntryCard(input.picked, locale)}
      <p class="banner warn" data-no-package>${esc(
        t(locale, "This lot has no live package in the ledger (voided, or closed as gone in METRC). Restore the package or repair the lot before loading it.")
      )}</p>`;
  } else if (input.picked) {
    const lot = input.picked;
    // Owner ruling 2026-09-08 (canon 0.30.19, verbatim: "occupied silos should
    // not accept more product"): a silo with an open load is listed, greyed,
    // with its occupant, and cannot be picked; the planned silo preselects only
    // when it is empty. Every silo full: the load button waits.
    // THE ROOM HOLDS MANY (canon 0.30.132; owner, 2026-09-20: "Dry rooms and
    // freezers must be able to contain multiple lots"): the occupant law binds a
    // silo alone; a dry room or a freezer with lots inside stays open and reads
    // how many it holds.
    const openLoadsIn = (siloId: string) => input.loads.filter((l) => l.dry_space_id === siloId && !l.ended_at);
    const occupantOf = (s: SiloRow) => (spaceHoldsOneLot(s.space_type) ? (openLoadsIn(s.id)[0] ?? null) : null);
    // THE FINISHED LOT IS ELIGIBLE (canon 0.30.130; owner: "sever its hold on
    // where ledger inventory lands"): the select offers every space on the
    // strip (the five silos, the Arlington Dry Room, the Blast Freezer(s)),
    // whatever the HBN's farm and wherever the package sits; the 0.30.73 site
    // narrowing (the silos at the barn the package waited in) is repealed.
    const siteSilos = input.silos;
    const freeSilos = siteSilos.filter((s) => !occupantOf(s));
    const siloOptions = siteSilos
      .map((s) => {
        const occupant = occupantOf(s);
        if (occupant) {
          return `<option value="${esc(s.id)}" disabled data-occupied>${esc(s.name)} (${esc(t(locale, "occupied"))}: ${esc(
            shortLotId(occupant.hbn ?? "", occupant.metrc_harvest_tag)
          )})</option>`;
        }
        const holding = spaceHoldsOneLot(s.space_type) ? 0 : openLoadsIn(s.id).length;
        const heldWord = holding > 0 ? ` (${esc(countLots(holding, locale))})` : "";
        // THE LOADING SILO (canon 0.30.81): a truck lot's HBN planned silo preselects like a lot's own space does.
        const planned = lot.actual_dryspc === s.id || (lot.planned_space_kind !== "silo" && lot.planned_silo_id === s.id);
        return `<option value="${esc(s.id)}"${planned ? " selected" : ""}${holding > 0 ? ` data-holding="${holding}"` : ""}>${esc(s.name)}${heldWord}</option>`;
      })
      .join("");
    const noneFree = freeSilos.length === 0;
    // Canon 0.30.9: the HH:MM colon mask (the Acquire idiom) on the Start time,
    // which IS the loaded time and the clock's zero; blank loads now.
    // THE EFFECTIVE DATE (canon 0.30.92; owner: "a date override in the load
    // silo screen - PIN gated: 21319"): the collapsed field under the Start
    // time; another day needs the Admin PIN and the typed time falls on it.
    working = `${lotEntryCard(lot, locale)}
      <form class="stack" method="post" action="/station/load_silo/load" data-load-silo>
        <input type="hidden" name="lot_id" value="${esc(lot.id)}">
        <input type="hidden" name="loaded_at_iso" value="">
        <label class="field">${esc(t(locale, "Silo"))} <select name="dry_space_id" required>${siloOptions}</select></label>
        ${noneFree ? `<p class="banner warn" data-silos-full>${esc(t(locale, "Every silo is occupied. Unload one first."))}</p>` : ""}
        <label class="field">${esc(t(locale, "Start time (24h, blank = now)"))} <input type="text" name="start_time" pattern="([01][0-9]|2[0-3]):[0-5][0-9]" inputmode="numeric" placeholder="HH:MM" data-time24-mask id="start_time"></label>
        <p class="muted">${esc(t(locale, "The clock runs from this loaded time."))}</p>
        ${effectiveDateField(input.nowIso, locale, t(locale, "Here the Start time falls on that day and is required with it."), undefined, input.farmDayStart ?? FARM_DAY_START_HOUR_DEFAULT)}
        ${plantCountPrompt(lot, locale)}
        <button type="submit"${noneFree ? " disabled" : ""}>${esc(t(locale, "Load silo"))}</button>
      </form>${time24MaskScript()}${loadedAtScript()}`;
  } else {
    working = `<p class="muted">${esc(t(locale, "Pick a lot from the pane."))}</p>`;
  }
  const flash = input.ok === "loaded" ? `<p class="banner ok">${esc(t(locale, "Loaded. The location change pends at the export home."))}</p>` : "";
  // THE BACK LINK (canon 0.30.109): the crumb under the app bar carries the
  // way back to Drying Operations; the page repeats no link of its own.
  return `<h1>${esc(t(locale, "Load Silo"))}</h1>
    ${flash}
    <div class="station-split">
      <aside class="queue-pane">
        <h2>${esc(t(locale, "Finished wet lots"))} <span class="tile-count">${esc(String(input.barnLots.length))}</span></h2>
        ${rows}
      </aside>
      <div class="working-pane">${working}</div>
    </div>`;
}
