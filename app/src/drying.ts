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

import {
  DRY_SPACE_TYPE_LABELS,
  dryingStageOfType,
  dryingStagePath,
  formatGrams,
  LOT_STATUS,
  shortLotId,
  spaceHoldsOneLot,
  type DrySpaceType,
  type DryingStage,
} from "./config";
import { listMenuDryingLoads, listMenuEntries, listOpenLogisticsSchedules, type BarnWetLotRow, type MenuDryingLoad, type MenuEntryRow, type SiloLoadRow, type SiloRow } from "./db";
import { listEnvironmentFlags } from "./environment";
import { effectiveDateField } from "./effective";
import { FARM_DAY_START_HOUR_DEFAULT, etClock12, etDate, farmDay, farmDayBounds } from "./farmday";
import { esc, lockOnSubmitScript, time24MaskScript } from "./html";
import { t, tFill, type Locale } from "./i18n";
import { checkCountdownScript, loadCheckLines, tileCheckSummary } from "./labsample";
import { formatLbs } from "./compliance";
import { lotStrainLine, PROJECTED_DRY_YIELD_PCT_DEFAULT, siloLiveScript, siloTile, siloWaitingLines, spaceShapeOf, spaceTypeOf, type SiloLive } from "./silo";

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

/** THE RUN (canon 0.30.248): "1d 02:14", days then hours and minutes, a finished clock's shape. */
export function formatRunClock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const days = Math.floor(s / 86400);
  const rem = s % 86400;
  const hh = String(Math.floor(rem / 3600)).padStart(2, "0");
  const mm = String(Math.floor((rem % 3600) / 60)).padStart(2, "0");
  return `${days}d ${hh}:${mm}`;
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
  truck_number?: string | null;
}): string {
  const tag = (lot.metrc_harvest_tag ?? lot.package_code ?? (lot.hbn ? shortLotId(lot.hbn, null) : "")).trim();
  const last6 = tag.length > 6 ? tag.slice(-6) : tag;
  const base = [last6 || "?", lot.farm_code ?? "?", lot.strain_label ?? ""].join(" / ");
  const truck = String(lot.truck_number ?? "").trim();
  return truck && lot.hbn ? `Truck ${truck} - ${lot.hbn}` : base;
}

/** The load's clock as the tiles read it (exported for the drying schedule's Working pane, canon 0.30.226). */
export function clockMarkup(load: SiloLoadRow, nowIso: string, locale: Locale): string {
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

/** THE SILO START TIME (canon 0.30.445). Owner, 2026-10-09: "still need the
 * start time of the silo shown under the silos in AM/PM on all drying
 * screens". The clock's zero (the loaded time, else the typed start) as the
 * farm's wall clock on the 12-hour dial with its day: "Started 2:35 PM, Oct 12".
 * Blank when the load has no readable start, so the line never invents one. */
export function startedLine(load: { loaded_at: string; started_at?: string | null }, locale: Locale): string {
  const zero = clockZeroMs(load);
  if (zero == null) return "";
  const iso = new Date(zero).toISOString();
  const { hhmm, meridiem } = etClock12(iso);
  if (!hhmm) return "";
  const clock = `${hhmm.replace(/^0/, "")} ${meridiem}`;
  // The day as "Oct 8" (es "8 oct") so the line holds on one row of the tile; the ISO day rides in the attribute.
  const day = new Intl.DateTimeFormat(locale === "es" ? "es" : "en-US", { timeZone: "America/New_York", month: "short", day: "numeric" }).format(new Date(zero)).replace(".", "");
  return `<div class="muted inv-lot-started" data-lot-started="${esc(iso)}" data-lot-started-day="${esc(etDate(iso))}">${esc(t(locale, "Started"))} ${esc(clock)}, ${esc(day)}</div>`;
}

/** THE ROWS (canon 0.30.383): figures the strip's panels read. */
export type DryingStripFigures = {
  hangGrams?: number;
  hangLots?: number;
  cureGrams?: number;
  cureLots?: number;
  dryYieldPct?: number;
};

export type DryingRowKey = "silo" | "freezer" | "cure" | "dry_room";

/** Wet of the open loads on one space type, plus the hang lots on the dry room row. */
export function dryingRowTotals(live: readonly SiloLive[], figures: DryingStripFigures = {}): {
  siloGrams: number;
  siloLots: number;
  estimateGrams: number;
  dryYieldPct: number;
  roomGrams: number;
  roomLots: number;
  hangGrams: number;
  hangLots: number;
  hangTotalGrams: number;
  hangTotalLots: number;
  cureGrams: number;
  cureLots: number;
} {
  let siloGrams = 0;
  let siloLots = 0;
  let roomGrams = 0;
  let roomLots = 0;
  for (const row of live) {
    const type = spaceTypeOf(row.silo);
    if (type !== "silo" && type !== "dry_room") continue;
    for (const load of row.loads) {
      const grams = Number(load.weight_grams ?? 0);
      if (type === "silo") {
        siloGrams += grams;
        siloLots += 1;
      } else {
        roomGrams += grams;
        roomLots += 1;
      }
    }
  }
  const pct = Number.isFinite(figures.dryYieldPct) && (figures.dryYieldPct ?? 0) >= 0 ? Number(figures.dryYieldPct) : PROJECTED_DRY_YIELD_PCT_DEFAULT;
  const hangGrams = Number(figures.hangGrams ?? 0);
  const hangLots = Number(figures.hangLots ?? 0);
  return {
    siloGrams,
    siloLots,
    estimateGrams: Math.round((siloGrams * pct) / 100),
    dryYieldPct: pct,
    roomGrams,
    roomLots,
    hangGrams,
    hangLots,
    hangTotalGrams: roomGrams + hangGrams,
    hangTotalLots: roomLots + hangLots,
    cureGrams: Number(figures.cureGrams ?? 0),
    cureLots: Number(figures.cureLots ?? 0),
  };
}

const ROW_LABEL: Record<DryingRowKey, string> = {
  silo: "Drying in Silos",
  freezer: "Fresh Frozen",
  cure: "Curing",
  dry_room: "Hang Drying",
};

function rowTotalPanel(key: DryingRowKey, grams: number, lots: number | null, estimate: string, locale: Locale, hangGrams: number | null): string {
  const figure = `<strong>${esc(formatLbs(grams))}</strong> lb · <strong>${esc(formatGrams(Math.round(grams)))}</strong> g`;
  const lotLine = lots == null ? "" : `<div class="dry-row-total-sub muted">${esc(t(locale, lots === 1 ? "{n} lot" : "{n} lots").replace("{n}", formatGrams(lots)))}${estimate ? ` · ${esc(estimate)}` : ""}</div>`;
  const hangAttr = hangGrams == null ? "" : ` data-dry-hang-grams="${esc(String(Math.round(hangGrams)))}"`;
  return `<aside class="dry-row-total" data-dry-total="${key}" data-dry-total-grams="${esc(String(Math.round(grams)))}"${lots == null ? "" : ` data-dry-total-lots="${lots}"`}${hangAttr}>
      <div class="dry-row-total-label">${esc(t(locale, ROW_LABEL[key]))}</div>
      <div class="dry-row-total-value">${figure}</div>
      ${lotLine}
    </aside>`;
}

function rowMarkup(key: DryingRowKey, tiles: string, count: number, panel: string, locale: Locale): string {
  if (!tiles.trim()) return "";
  const prev = count > 5 ? `<button type="button" class="dry-row-arrow" data-dry-arrow="prev" hidden aria-label="${esc(t(locale, "Scroll back"))}">‹</button>` : "";
  const next = count > 5 ? `<button type="button" class="dry-row-arrow" data-dry-arrow="next" aria-label="${esc(t(locale, "Scroll forward"))}">›</button>` : "";
  return `<div class="dry-row" data-dry-row="${key}" data-dry-count="${count}">
      ${panel}
      <div class="dry-row-scroller">${prev}<div class="dry-row-tiles inv-gauges" data-dry-tiles>${tiles}</div>${next}</div>
    </div>`;
}

/** The five silos, persistent above every Drying Operations page. THE ROWS
 * (canon 0.30.383): one row per kind, Silo, Freezer, Cure Space, Dry Room.
 * Each row's total sits at its left. Past five tiles the row scrolls. */
export function siloStrip(
  live: SiloLive[],
  nowIso: string,
  locale: Locale = "en",
  extraTiles = "",
  flags: Readonly<Record<string, string[]>> = {},
  figures: DryingStripFigures = {},
  layout: "rows" | "open" = "rows"
): string {
  const tileOf = (row: SiloLive, open: boolean) => {
    const { silo, visual, loads, waiting, emptySince, loadChecks } = row;
    const checks = loadChecks ?? [];
    const body =
      tileCheckSummary(checks, nowIso, locale) +
      loads
        .map(
          (load) => `<div class="inv-lot" data-load="${esc(load.id)}">
            <div class="inv-lot-id"><a href="/station/load_silo?load=${esc(load.id)}">${esc(
            t(locale, "Lot")
          )} ${esc(shortLotId(load.hbn ?? "", load.metrc_harvest_tag))}</a></div>
            ${lotStrainLine(load.strain_label)}
            <div class="inv-lot-time">${clockMarkup(load, nowIso, locale)}</div>
            ${startedLine(load, locale)}
            ${loadCheckLines(checks, load.id, nowIso, locale)}
          </div>`
        )
        .join("") + siloWaitingLines(waiting ?? [], locale);
    return siloTile({
      id: silo.id,
      name: silo.name,
      visual,
      body,
      locale,
      shape: spaceShapeOf(silo),
      flags: flags[silo.name] ?? [],
      emptySince: emptySince ?? null,
      nowIso,
      open,
    });
  };
  if (layout === "open") {
    const tiles = live.map((row) => tileOf(row, true)).join("");
    return `<section class="silo-strip" data-silo-strip>
    <div class="inv-gauges">${tiles}${extraTiles}</div>
  </section>${clockScript()}${checkCountdownScript()}${siloLiveScript()}`;
  }
  const drawn = live.map((entry) => {
    const type = spaceTypeOf(entry.silo);
    const row: DryingRowKey = type === "freezer" ? "freezer" : type === "dry_room" ? "dry_room" : "silo";
    return { row, html: tileOf(entry, false) };
  });
  const of = (key: DryingRowKey) => drawn.filter((tile) => tile.row === key).map((tile) => tile.html);
  const totals = dryingRowTotals(live, figures);
  const estimate = t(locale, "est. dry {lb} lb at {pct}%").replace("{lb}", formatLbs(totals.estimateGrams)).replace("{pct}", formatGrams(totals.dryYieldPct));
  const siloTiles = of("silo");
  const freezerTiles = of("freezer");
  const cureCount = (extraTiles.match(/data-cure-pane=/g) || []).length;
  const roomTiles = of("dry_room");
  const rows = [
    rowMarkup("silo", siloTiles.join(""), siloTiles.length, rowTotalPanel("silo", totals.siloGrams, totals.siloLots, estimate, locale, null), locale),
    rowMarkup("freezer", freezerTiles.join(""), freezerTiles.length, "", locale),
    rowMarkup("cure", extraTiles, cureCount, rowTotalPanel("cure", totals.cureGrams, totals.cureLots, "", locale, null), locale),
    rowMarkup(
      "dry_room",
      roomTiles.join(""),
      roomTiles.length,
      rowTotalPanel("dry_room", totals.hangTotalGrams, totals.hangTotalLots, "", locale, totals.hangGrams),
      locale
    ),
  ].join("");
  return `<section class="silo-strip" data-silo-strip>${rows}</section>${clockScript()}${checkCountdownScript()}${siloLiveScript()}${dryingRowScript()}`;
}

/** Collapsed by default on each load. An arrow shows only when that side has more to see. */
export function dryingRowScript(): string {
  return `<script>
(function () {
  document.querySelectorAll("[data-dry-head]:not([data-dry-bound])").forEach(function (btn) {
    btn.setAttribute("data-dry-bound", "1");
    btn.addEventListener("click", function () {
      var tile = btn.closest("[data-dry-tile]");
      var body = tile ? tile.querySelector(":scope > .dry-tile-body") : null;
      if (!body) return;
      var open = btn.getAttribute("aria-expanded") === "true";
      btn.setAttribute("aria-expanded", open ? "false" : "true");
      body.hidden = open;
    });
  });
  document.querySelectorAll("[data-dry-row]:not([data-dry-bound])").forEach(function (row) {
    row.setAttribute("data-dry-bound", "1");
    var scroller = row.querySelector("[data-dry-tiles]");
    var prev = row.querySelector("[data-dry-arrow='prev']");
    var next = row.querySelector("[data-dry-arrow='next']");
    if (!scroller || !prev || !next) return;
    function sync() {
      var more = scroller.scrollWidth > scroller.clientWidth + 2;
      prev.hidden = !more || scroller.scrollLeft <= 2;
      next.hidden = !more || scroller.scrollLeft + scroller.clientWidth >= scroller.scrollWidth - 2;
    }
    prev.addEventListener("click", function () { scroller.scrollBy({ left: -Math.max(120, scroller.clientWidth * 0.8), behavior: "smooth" }); });
    next.addEventListener("click", function () { scroller.scrollBy({ left: Math.max(120, scroller.clientWidth * 0.8), behavior: "smooth" }); });
    scroller.addEventListener("scroll", sync);
    sync();
  });
})();
</script>`;
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
function plantCountPrompt(lot: BarnWetLotRow, locale: Locale, parts: BarnWetLotRow[] = []): string {
  const missing = (parts.length > 0 ? parts : [lot]).filter((part) => part.plant_count == null);
  if (missing.length === 0) return "";
  const fields =
    missing.length === 1 && parts.length <= 1
      ? `<label class="field">${esc(t(locale, "Number of plants"))} <input type="text" name="plant_count" inputmode="numeric" pattern="[0-9,]*" placeholder="${esc(t(locale, "skipped at Finish load"))}" data-plant-count-input></label>`
      : missing
          .map(
            (part) =>
              `<label class="field">${esc(t(locale, "Number of plants"))} ${esc(shortLotId(part.hbn ?? "", part.metrc_harvest_tag))} <input type="text" name="plant_count[${esc(part.id)}]" inputmode="numeric" pattern="[0-9,]*" placeholder="${esc(t(locale, "skipped at Finish load"))}" data-plant-count-input></label>`
          )
          .join("");
  return `<div class="plant-prompt" data-plant-prompt>
        ${fields}
        <p class="muted">${esc(t(locale, "How many plants made this load. Leave it blank to skip again; the pencil on the lot record can set it later."))}</p>
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
  /** Parts of the picked lot that still need a plant count, one field each. */
  parts?: BarnWetLotRow[];
  /** THE DRYING SCHEDULE (canon 0.30.226): the >> of a drying surface opens
   * the picked form with the select limited to that surface's space type, the
   * planned space preselected when it is of that type, and a return to the
   * surface once loaded. Absent, the form is today's. */
  kind?: DrySpaceType | null;
  space?: string | null;
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
    const kind = input.kind ?? null;
    const siteSilos = kind ? input.silos.filter((s) => spaceTypeOf(s) === kind) : input.silos;
    const freeSilos = siteSilos.filter((s) => !occupantOf(s));
    const preselect = kind && input.space && freeSilos.some((s) => s.id === input.space) ? input.space : null;
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
        const planned = preselect
          ? s.id === preselect
          : lot.actual_dryspc === s.id || (lot.planned_space_kind !== "silo" && lot.planned_silo_id === s.id);
        return `<option value="${esc(s.id)}"${planned ? " selected" : ""}${holding > 0 ? ` data-holding="${holding}"` : ""}>${esc(s.name)}${heldWord}</option>`;
      })
      .join("");
    const noneFree = freeSilos.length === 0;
    const noSpaceOfKind = Boolean(kind) && siteSilos.length === 0;
    const selectLabel = kind ? t(locale, DRY_SPACE_TYPE_LABELS[kind]) : t(locale, "Silo");
    const nextField = kind ? `<input type="hidden" name="next" value="${esc(dryingStagePath(dryingStageOfType(kind)))}">` : "";
    // Canon 0.30.9: the HH:MM colon mask (the Acquire idiom) on the Start time,
    // which IS the loaded time and the clock's zero; blank loads now.
    // THE EFFECTIVE DATE (canon 0.30.92; owner: "a date override in the load
    // silo screen - PIN gated: 21319"): the collapsed field under the Start
    // time; another day needs the Admin PIN and the typed time falls on it.
    working = `${lotEntryCard(lot, locale)}
      <form class="stack" method="post" action="/station/load_silo/load" data-load-silo>
        <input type="hidden" name="lot_id" value="${esc(lot.id)}">
        <input type="hidden" name="loaded_at_iso" value="">
        ${nextField}
        <label class="field">${esc(selectLabel)} <select name="dry_space_id" required${kind ? ` data-space-kind="${esc(kind)}"` : ""}>${siloOptions}</select></label>
        ${
          noSpaceOfKind
            ? `<p class="banner warn" data-no-space-of-kind>${esc(t(locale, "There is no space of this kind in Dry Spaces."))}</p>`
            : noneFree
              ? `<p class="banner warn" data-silos-full>${esc(t(locale, "Every silo is occupied. Unload one first."))}</p>`
              : ""
        }
        <label class="field">${esc(t(locale, "Start time (24h, blank = now)"))} <input type="text" name="start_time" pattern="([01][0-9]|2[0-3]):[0-5][0-9]" inputmode="numeric" placeholder="HH:MM" data-time24-mask id="start_time"></label>
        <p class="muted">${esc(t(locale, "The clock runs from this loaded time."))}</p>
        ${effectiveDateField(input.nowIso, locale, t(locale, "Here the Start time falls on that day and is required with it."), undefined, input.farmDayStart ?? FARM_DAY_START_HOUR_DEFAULT)}
        ${plantCountPrompt(lot, locale, input.parts ?? [])}
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
        <h2>${esc(t(locale, "Scheduled lots"))} <span class="tile-count">${esc(String(input.barnLots.length))}</span></h2>
        ${rows}
      </aside>
      <div class="working-pane">${working}</div>
    </div>`;
}

/** THE DRYING SCHEDULE (canon 0.30.226): an open load's label, the one Load
 * Silo reads for its lot (Truck n - HBN when the lot rode a truck). */
export function loadLotLabel(load: SiloLoadRow): string {
  return barnLotLabel({
    metrc_harvest_tag: load.metrc_harvest_tag,
    package_code: null,
    farm_code: load.farm_code,
    strain_label: load.strain_label,
    hbn: load.hbn,
    truck_number: load.truck_number ?? null,
  });
}

/** The joint unload's share order: first loaded first, the id breaking a tie
 * (the order listOpenSiloLoadsInSpace reads), so the last share, the one that
 * takes the remainder, is the last lot loaded. */
export function shareOrder(a: SiloLoadRow, b: SiloLoadRow): number {
  if (a.loaded_at !== b.loaded_at) return a.loaded_at < b.loaded_at ? -1 : 1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/** One load per lot, in share order: a lot holding two open loads in one space
 * (a repeated Load Silo tap) is one lot with one share; its finish ends every
 * one of its loads. */
export function oneLoadPerLot(loads: readonly SiloLoadRow[]): SiloLoadRow[] {
  const kept: SiloLoadRow[] = [];
  for (const load of [...loads].sort(shareOrder)) {
    if (!kept.some((other) => other.wet_weight_entry_id === load.wet_weight_entry_id)) kept.push(load);
  }
  return kept;
}

/** THE JOINT UNLOAD, DRY PRO RATA (canon 0.30.226; his pick "Every entry, dry
 * pro rata"): a space holding several open loads, unloaded as a whole. One
 * form asks the total dry grams and the unload's questions once: the
 * operator, the effective day, and the reconcile choice the gate offers
 * (every dry total falls short of the wet-born package). Every loadable space
 * is kind silo, which forces bucked, so the material reads as a line the way
 * Unload Dry Space reads it and no on-site question is asked. The load ids
 * ride along so a group that changed before the post is refused, and the
 * first tap locks the button (THE FOUR START TAPS, canon 0.30.89). */
export function unloadTogetherForm(input: {
  stage: DryingStage;
  space: SiloRow;
  loads: SiloLoadRow[];
  nowIso: string;
  farmDayStart?: number;
  locale?: Locale;
}): string {
  const locale = input.locale ?? "en";
  const loads = [...input.loads].sort(shareOrder);
  const perLot = oneLoadPerLot(loads);
  const groupWet = perLot.reduce((sum, load) => sum + Number(load.weight_grams ?? 0), 0);
  const path = dryingStagePath(input.stage);
  const lots = perLot
    .map(
      (load) => `<li data-share-lot="${esc(load.wet_weight_entry_id)}" data-wet="${esc(String(Number(load.weight_grams ?? 0)))}">
          <span class="schedule-identity">${esc(loadLotLabel(load))}</span>
          <span class="muted">${esc(t(locale, "Wet"))} ${esc(formatGrams(Number(load.weight_grams ?? 0)))} g</span>
        </li>`
    )
    .join("");
  return `<form class="stack unload-together" method="post" action="${esc(`${path}/unload_together/${input.space.id}`)}" data-unload-together="${esc(input.space.id)}" data-lock-on-submit>
      <input type="hidden" name="load_ids" value="${esc(loads.map((load) => load.id).join(","))}">
      <p class="muted">${esc(
        tFill(
          locale,
          "Each lot's share is the total dry grams times its wet grams over {g} g, the wet grams of every load here, in whole grams; the last lot takes the remainder.",
          { g: formatGrams(groupWet) }
        )
      )}</p>
      <ol class="unload-together-lots">${lots}</ol>
      <label class="field">${esc(t(locale, "Total dry grams"))} <input type="number" name="total_dry_grams" min="1" step="1" inputmode="numeric" required data-total-dry></label>
      <label class="field">${esc(t(locale, "Operator"))} <input type="text" name="operator_name" required autocomplete="off" data-keep-operator></label>
      <p class="muted" data-material-form>${esc(t(locale, "Material"))}: ${esc(t(locale, "Bucked"))}</p>
      ${effectiveDateField(
        input.nowIso,
        locale,
        t(locale, "The unload's transaction date. Today by default; the Admin PIN sets another day."),
        undefined,
        input.farmDayStart ?? FARM_DAY_START_HOUR_DEFAULT
      )}
      <fieldset class="choice-row" data-reconcile-choice>
        <legend>${esc(t(locale, "If the dry total differs from the packages"))}</legend>
        <label><input type="radio" name="gate_choice" value="queue_adjust" required> ${esc(t(locale, "Queue an adjustment CSV"))}</label>
        <label><input type="radio" name="gate_choice" value="nothing"> ${esc(t(locale, "Nothing, just finish"))}</label>
      </fieldset>
      <div class="row-actions">
        <button type="submit">${esc(t(locale, "Unload together"))}</button>
        <a class="btn secondary" href="${esc(path)}">${esc(t(locale, "Cancel"))}</a>
      </div>
    </form>${lockOnSubmitScript()}`;
}

/** THE MENU LINES (canon 0.30.241). Name at the left, status at the right, dots in the gap. */
export type OpsMenuLine = {
  name: string;
  status: string;
  clock: { state: "running" | "paused"; started: number; pausedSeconds: number; text: string } | null;
  flag?: string;
};

export function menuLineMarkup(line: OpsMenuLine, locale: Locale): string {
  const status = line.clock
    ? `<span class="ops-menu-state">${esc(t(locale, line.status))}</span> <span class="silo-clock" data-clock data-state="${esc(line.clock.state)}" data-started="${esc(String(line.clock.started))}" data-paused-at="" data-paused-seconds="${esc(String(line.clock.pausedSeconds))}">${esc(line.clock.text)}</span>${
        line.clock.state === "paused" ? ` <span class="muted silo-clock-state">${esc(t(locale, "Paused"))}</span>` : ""
      }`
    : esc(t(locale, line.status));
  return `<span class="ops-menu-line" data-menu-line>
      <span class="ops-menu-name">${esc(line.name)}</span>
      <span class="ops-menu-dots" aria-hidden="true"></span>
      <span class="ops-menu-status">${status}${line.flag ? ` <span class="silo-flags" data-menu-flag>${esc(line.flag)}</span>` : ""}</span>
    </span>`;
}

/** Lots whose first load began on this farm day, numbered by that first load. A lot that has left the scale and the Dry Queue is off the line. */
export function harvestMenuLines(entries: MenuEntryRow[], scheduled: ReadonlySet<string>, nowIso: string, startHour: number, locale: Locale = "en"): OpsMenuLine[] {
  const bounds = farmDayBounds(farmDay(nowIso, startHour), startHour);
  const byBatch = new Map<string, MenuEntryRow[]>();
  for (const entry of entries) {
    const group = byBatch.get(entry.harvest_batch_id);
    if (group) group.push(entry);
    else byBatch.set(entry.harvest_batch_id, [entry]);
  }
  const lots: Array<{ first: string; rows: MenuEntryRow[] }> = [];
  for (const rows of byBatch.values()) {
    const first = rows.map((row) => row.created_at).sort()[0];
    if (!first || first < bounds.startIso || first >= bounds.endIso) continue;
    lots.push({ first, rows });
  }
  lots.sort((a, b) => (a.first < b.first ? -1 : a.first > b.first ? 1 : 0));
  const lines: OpsMenuLine[] = [];
  lots.forEach((lot, index) => {
    const weighing = lot.rows.some((row) => row.status === LOT_STATUS.weighing);
    const waiting = lot.rows.some((row) => row.status !== LOT_STATUS.weighing && !Number(row.loaded));
    if (!weighing && !waiting) return;
    const passed = scheduled.has(lot.rows[0].harvest_batch_id);
    lines.push({
      name: tFill(locale, "Lot {n}", { n: String(index + 1) }),
      status: !weighing && passed ? "ready to be moved" : "in progress",
      clock: null,
    });
  });
  return lines;
}

/** A part is on the Logistics line only while its status is in_transit. The clock is the earliest Finish load still out: each part's latest in_transit log row, or updated_at when the log has none. */
export function truckMenuLines(entries: MenuEntryRow[], nowIso: string, locale: Locale = "en"): OpsMenuLine[] {
  const groups = new Map<string, MenuEntryRow[]>();
  for (const entry of entries) {
    if (entry.status !== LOT_STATUS.in_transit) continue;
    const number = String(entry.truck_number ?? "").trim();
    const key = number ? `n:${number}` : `id:${entry.id}`;
    const group = groups.get(key);
    if (group) group.push(entry);
    else groups.set(key, [entry]);
  }
  const lines: OpsMenuLine[] = [];
  for (const [key, rows] of groups) {
    const instants = rows
      .map((row) => row.transit_at || row.updated_at)
      .filter(Boolean)
      .sort();
    const started = Date.parse(instants[0] ?? "");
    const seconds = Number.isFinite(started) ? Math.max(0, Math.floor((Date.parse(nowIso) - started) / 1000)) : 0;
    const number = key.startsWith("n:") ? key.slice(2) : "";
    lines.push({
      name: number ? tFill(locale, "Truck {n}", { n: number }) : t(locale, "Truck"),
      status: "in-transit",
      clock: { state: "running", started: Number.isFinite(started) ? started : Date.parse(nowIso), pausedSeconds: 0, text: formatClock(seconds) },
    });
  }
  lines.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  return lines;
}

/** One line per silo or dry room with an open load. Freezers are off the line. Two loads show the longest clock. */
export function dryingMenuLines(
  loads: MenuDryingLoad[],
  nowIso: string,
  locale: Locale = "en",
  flags: Readonly<Record<string, string[]>> = {}
): OpsMenuLine[] {
  void locale;
  const bySpace = new Map<string, MenuDryingLoad[]>();
  for (const load of loads) {
    if ((load.space_type ?? "silo") === "freezer") continue;
    const group = bySpace.get(load.space_id);
    if (group) group.push(load);
    else bySpace.set(load.space_id, [load]);
  }
  const lines: OpsMenuLine[] = [];
  for (const group of bySpace.values()) {
    const ranked = group
      .map((load) => ({ load, seconds: siloClockSeconds(load, nowIso) ?? 0 }))
      .sort((a, b) => b.seconds - a.seconds);
    const load = ranked[0].load;
    const state = siloClockState(load);
    const clockState = state === "paused" ? "paused" : "running";
    lines.push({
      name: load.space_name,
      status: "drying",
      clock: {
        state: clockState,
        started: clockZeroMs(load) ?? Date.parse(nowIso),
        pausedSeconds: Number(load.paused_seconds ?? 0),
        text: formatClock(ranked[0].seconds),
      },
      flag: (flags[load.space_name] ?? []).join(" "),
    });
  }
  lines.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  return lines;
}

export function opsMenuHtml(lines: OpsMenuLine[], locale: Locale): string {
  return lines.map((line) => menuLineMarkup(line, locale)).join("");
}

export async function homeMenuBlocks(db: D1Database, nowIso: string, startHour: number, locale: Locale): Promise<Record<string, string>> {
  const bounds = farmDayBounds(farmDay(nowIso, startHour), startHour);
  const [entries, open, drying, flags] = await Promise.all([
    listMenuEntries(db, bounds.startIso, bounds.endIso),
    listOpenLogisticsSchedules(db),
    listMenuDryingLoads(db),
    listEnvironmentFlags(db, nowIso, locale),
  ]);
  const scheduled = new Set(open.map((row) => row.harvest_batch_id));
  return {
    harvest_ops: opsMenuHtml(harvestMenuLines(entries, scheduled, nowIso, startHour, locale), locale),
    interco_logistics: opsMenuHtml(truckMenuLines(entries, nowIso, locale), locale),
    drying_ops: opsMenuHtml(dryingMenuLines(drying, nowIso, locale, flags), locale),
  };
}
