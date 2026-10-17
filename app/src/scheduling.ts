/**
 * PRODUCTION SCHEDULING (canon 0.30.97). Two shuttle-style stations,
 * Trimming and Pasteurization, whose schedule is what exposes material to
 * Trim Packages Entry and Cryo Weight Entry. The renderer is pure (input in,
 * HTML out) so the tests pin it without a database.
 */
import {
  DRYING_COMPLETE_DAYS,
  DRYING_STAGE_SPACE_TYPE,
  DRYING_STAGES,
  dryingStagePath,
  formatGrams,
  INTERNAL_LOGISTICS_PATH,
  LOT_STATUS,
  PREPACK_STATION_PATH,
  PRODUCTION_SCHEDULING_PATH,
  SCHEDULE_STAGE_TITLES,
  SCHEDULE_STAGES,
  type DrySpaceType,
  type DryingStage,
  type LineStage,
  type ScheduleStage,
} from "./config";
import type { BarnWetLotRow, DryingCompleteRow, FinishedLogisticsRow, ScheduleHbnGroup, ScheduleItemRow, SiloLoadRow, SiloRow } from "./db";
import { barnLotLabel, clockMarkup, formatRunClock, loadLotLabel, shareOrder, siloClockSeconds, siloClockState, unloadTogetherForm } from "./drying";
import type { MetrcAdoptPane, MetrcAdoptRow } from "./metrc";
import { lastSix, packageIdentityMarkup } from "./prepack";
import { pasteurizationRunLabel } from "./cryo";
import { effectiveDateField } from "./effective";
import { FARM_DAY_START_HOUR_DEFAULT, dayBefore, farmDay, farmDayBounds } from "./farmday";
import { QUEUE_FOLD_SCRIPT, localTimeScript, queueFold } from "./html";
import { t, tFill, type Locale } from "./i18n";
import { terpCompleteLine, terpScheduleControls, type TerpRecipeOption } from "./terps";
import { spaceTypeOf } from "./silo";
import { esc } from "./ui";

export const SCHEDULE_REFUSAL = {
  nothingAvailable: "Nothing available to schedule on this HBN.",
  alreadyScheduled: "That item is already on the schedule.",
  demotePin: "Unfinishing a completed item needs the Admin PIN.",
  unscheduleComplete: "A completed item cannot be unscheduled; unfinish it first.",
  // THE SCHEDULER BY PACKAGE (canon 0.30.196).
  packageScheduled: "That package is already on the schedule.",
  packageGone: "That package is no longer available to schedule.",
  prepackByPackage: "Prepack schedules one package at a time, with the >> on its row.",
} as const;

/** The line stages only. THE DRYING SCHEDULE (canon 0.30.226): the three
 * drying surfaces are views, not lines, so the schedule, unschedule, complete
 * and unfinish routes never answer them; parseDryingStage does. */
export function parseScheduleStage(raw: string | undefined): LineStage | null {
  if (raw === SCHEDULE_STAGES.trim || raw === SCHEDULE_STAGES.cryo || raw === SCHEDULE_STAGES.prepack) return raw;
  return null;
}

export function parseDryingStage(raw: string | undefined): DryingStage | null {
  return DRYING_STAGES.find((stage) => stage === raw) ?? null;
}

/** Status word on the working pane. Trimming reads "In queue"; Pasteurization
 * reads "Pasteurizing". A later CASE can show "Pasteurizing" on a Trimming
 * lot whose packages have moved on to the cryo queue (owner fork 1). */
export function scheduleStatusWord(stage: ScheduleStage, _item?: ScheduleItemRow): "In queue" | "Pasteurizing" | "Scheduled" {
  void _item;
  if (stage === SCHEDULE_STAGES.cryo) return "Pasteurizing";
  if (stage === SCHEDULE_STAGES.prepack) return "Scheduled";
  return "In queue";
}

export type SchedulePanes = {
  available: ScheduleHbnGroup[];
  working: ScheduleHbnGroup[];
  complete: ScheduleHbnGroup[];
};

function emptyLine(locale: Locale): string {
  return `<p class="muted">${esc(t(locale, "- EMPTY -"))}</p>`;
}

function scheduleFormId(stage: ScheduleStage): string {
  return `schedule-${stage}`;
}

/** THE HBN ON THE SCHEDULING PANES (canon 0.30.102; owner, 2026-09-16,
 * verbatim: "Need the HBN listed on the left pane of the scheduling nodes.
 * The information in there isn't pointing us in the right place."; his
 * picks: the full HBN only, on all three panes): every group heads with the
 * HBN itself, the one name the floor looks for. */
function groupHeading(group: ScheduleHbnGroup): string {
  return esc(group.hbn);
}

/** PS2: the two-line pasteurization label. The full HBN is the hover title.
 * Line 1 is HTML. Scheduled and Complete keep the out line under it. */
function cryoLabel(item: ScheduleItemRow, locale: Locale): string {
  const label = pasteurizationRunLabel(
    {
      hbn: item.hbn,
      containers: item.containers ?? 0,
      in_grams: item.in_grams ?? 0,
      strain_name: item.strain_name,
    },
    item.package_codes ?? [],
    locale
  );
  const out =
    item.out_count == null
      ? ""
      : `<span class="muted pasteur-out">${esc(`${Number(item.out_count)} out, ${formatGrams(item.out_grams ?? 0)} g`)}</span>`;
  return `<span class="pasteur-lines" title="${esc(item.hbn)}"><span class="pasteur-line1">${label.line1}</span><span class="muted pasteur-line2">${esc(
    label.line2
  )}</span>${out}</span>`;
}

function availableGroup(stage: ScheduleStage, group: ScheduleHbnGroup, locale: Locale): string {
  const title = t(
    locale,
    stage === SCHEDULE_STAGES.trim ? "Schedule trim" : stage === SCHEDULE_STAGES.cryo ? "Schedule pasteurization" : "Schedule prepack"
  );
  const button = `<button type="submit" form="${esc(scheduleFormId(stage))}" name="hbn_id" value="${esc(
    group.harvest_batch_id
  )}" class="shuttle-btn" title="${esc(title)}" aria-label="${esc(title)}" onclick="event.stopPropagation()">&gt;&gt;</button>`;
  // THE CRYO RUN (canon 0.30.110; owner: "collapse the lines to their HBN, do
  // not expose individual containers on the scheduled surface"): the
  // Pasteurization pane reads the HBN and its pool on one line, nothing to
  // unfold; the count would only count the pool line.
  if (stage === SCHEDULE_STAGES.cryo) {
    const label = group.items.map((item) => cryoLabel(item, locale)).join("");
    return `<div class="pane-group schedule-run" data-schedule-hbn="${esc(group.harvest_batch_id)}">
      <div class="schedule-hbn-summary">
        <span class="schedule-hbn-line">${label}</span>
        ${button}
      </div>
    </div>`;
  }
  const items = group.items
    .map((item) => `<li class="schedule-item-readonly">${esc(item.identity)}</li>`)
    .join("");
  return `<details class="pane-group" data-schedule-hbn="${esc(group.harvest_batch_id)}">
      <summary class="schedule-hbn-summary">
        <span class="schedule-hbn-line">${groupHeading(group)} <span class="tile-count">${group.items.length}</span></span>
        ${button}
      </summary>
      <ul>${items}</ul>
    </details>`;
}

function workingItem(stage: ScheduleStage, item: ScheduleItemRow, locale: Locale, recipes: readonly TerpRecipeOption[]): string {
  const status = t(locale, scheduleStatusWord(stage, item));
  const done = item.workDone ? `<span class="muted">${esc(t(locale, item.workDone))}</span>` : "";
  const terp = stage === SCHEDULE_STAGES.cryo ? terpScheduleControls(item, recipes, locale) : "";
  const identity = stage === SCHEDULE_STAGES.cryo ? cryoLabel(item, locale) : `<span class="schedule-identity">${esc(item.identity)}</span>`;
  const base = `${PRODUCTION_SCHEDULING_PATH}/${stage}`;
  return `<li class="schedule-item" data-schedule-id="${esc(item.id)}">
      ${identity}
      ${terp}
      <span class="muted schedule-status">${esc(status)}</span>
      ${done}
      <form method="post" action="${esc(base)}/unschedule/${esc(item.id)}" class="shuttle-form">
        <button type="submit" class="shuttle-btn" title="${esc(t(locale, "Unschedule"))}" aria-label="${esc(
    t(locale, "Unschedule")
  )}">&lt;</button>
      </form>
      ${
        stage === SCHEDULE_STAGES.prepack
          ? `<a class="shuttle-btn" href="/station/prepack?pick=${esc(item.id)}" title="${esc(t(locale, "Prepack"))}" aria-label="${esc(t(locale, "Prepack"))}">&gt;</a>`
          : `<form method="post" action="${esc(base)}/complete/${esc(item.id)}" class="shuttle-form">
        <button type="submit" class="shuttle-btn" title="${esc(t(locale, "Complete"))}" aria-label="${esc(
              t(locale, "Complete")
            )}">&gt;</button>
      </form>`
      }
    </li>`;
}

function unfinishForm(stage: ScheduleStage, id: string, locale: Locale, q = ""): string {
  const base = `${PRODUCTION_SCHEDULING_PATH}/${stage}`;
  const title = t(locale, "Unfinish");
  return `<form method="post" action="${esc(base)}/unfinish/${esc(id)}" class="shuttle-form">
        ${q ? qField(q) : ""}
        <label class="field">${esc(t(locale, "Admin PIN"))} <input type="password" name="unfinish_pin" inputmode="numeric" autocomplete="off"></label>
        <button type="submit" class="shuttle-btn" title="${esc(title)}" aria-label="${esc(title)}">&lt;</button>
      </form>`;
}

function completeItem(stage: ScheduleStage, item: ScheduleItemRow, locale: Locale): string {
  const when = item.completed_at
    ? `<time datetime="${esc(item.completed_at)}" data-local>${esc(item.completed_at)}</time>`
    : "";
  const terp = stage === SCHEDULE_STAGES.cryo ? terpCompleteLine(item, locale) : "";
  const identity = stage === SCHEDULE_STAGES.cryo ? cryoLabel(item, locale) : `<span class="schedule-identity">${esc(item.identity)}</span>`;
  return `<li class="schedule-item" data-schedule-id="${esc(item.id)}">
      ${identity}
      ${terp}
      ${when}
      ${unfinishForm(stage, item.id, locale)}
    </li>`;
}

function workingGroup(stage: ScheduleStage, group: ScheduleHbnGroup, locale: Locale, recipes: readonly TerpRecipeOption[]): string {
  const items = group.items.map((item) => workingItem(stage, item, locale, recipes)).join("");
  const heading = stage === SCHEDULE_STAGES.cryo ? "" : `<h3 class="schedule-hbn-label">${groupHeading(group)}</h3>`;
  return `<section class="schedule-group" data-schedule-hbn="${esc(group.harvest_batch_id)}">
      ${heading}
      <ul>${items}</ul>
    </section>`;
}

function completeGroup(stage: ScheduleStage, group: ScheduleHbnGroup, locale: Locale): string {
  const items = group.items.map((item) => completeItem(stage, item, locale)).join("");
  const heading = stage === SCHEDULE_STAGES.cryo ? "" : `<h3 class="schedule-hbn-label">${groupHeading(group)}</h3>`;
  return `<section class="schedule-group" data-schedule-hbn="${esc(group.harvest_batch_id)}">
      ${heading}
      <ul>${items}</ul>
    </section>`;
}

export function schedulingLanding(locale: Locale): string {
  // THE BACK LINK (canon 0.30.109): the crumb under the app bar carries the
  // way back to Production Operations; the page repeats no link of its own.
  return `<h1>${esc(t(locale, "Production Scheduling"))}</h1>
    <div class="tiles">
      <a class="tile" href="${esc(PRODUCTION_SCHEDULING_PATH)}/trim" data-schedule-stage="${esc(SCHEDULE_STAGES.trim)}">
        <span class="tile-kind">${esc(t(locale, "Station"))}</span>
        <span class="tile-title">${esc(t(locale, "Trimming"))}</span>
      </a>
      <a class="tile" href="${esc(PRODUCTION_SCHEDULING_PATH)}/cryo" data-schedule-stage="${esc(SCHEDULE_STAGES.cryo)}">
        <span class="tile-kind">${esc(t(locale, "Station"))}</span>
        <span class="tile-title">${esc(t(locale, "Pasteurization"))}</span>
      </a>
      <a class="tile" href="${esc(PRODUCTION_SCHEDULING_PATH)}/prepack" data-schedule-stage="${esc(SCHEDULE_STAGES.prepack)}">
        <span class="tile-kind">${esc(t(locale, "Station"))}</span>
        <span class="tile-title">${esc(t(locale, "Prepack"))}</span>
      </a>
    </div>`;
}

/** THE FILTER (canon 0.30.196; owner: "A filter at the top of the list for HBN
 * or last 6 would be useful"): a row stays when the typed text, ignoring case,
 * is in its HBN or in the last six of its tag; text longer than six (a scanned
 * tag) also matches the whole tag. The filter only narrows what is shown. */
export function scheduleFilterHit(q: string | null | undefined, hbn: string | null | undefined, tag: string | null | undefined): boolean {
  const typed = String(q ?? "").trim().toLowerCase();
  if (!typed) return true;
  const fullTag = String(tag ?? "").trim().toLowerCase();
  if (String(hbn ?? "").toLowerCase().includes(typed)) return true;
  if (lastSix(fullTag).includes(typed)) return true;
  return typed.length > 6 && fullTag.includes(typed);
}

const FILTER_SCRIPT = `<script>
  (function () {
    var box = document.querySelector("[data-schedule-filter]");
    if (!box) return;
    function six(tag) { tag = String(tag || "").trim(); return tag.length <= 6 ? tag : tag.slice(-6); }
    function hit(q, hbn, tag) {
      if (!q) return true;
      var full = String(tag || "").trim().toLowerCase();
      if (String(hbn || "").toLowerCase().indexOf(q) >= 0) return true;
      if (six(full).indexOf(q) >= 0) return true;
      return q.length > 6 && full.indexOf(q) >= 0;
    }
    function apply() {
      var typed = box.value.trim();
      var q = typed.toLowerCase();
      document.querySelectorAll("[data-schedule-list]").forEach(function (list) {
        var shown = 0;
        list.querySelectorAll("[data-schedule-tag]").forEach(function (row) {
          if (hit(q, row.getAttribute("data-schedule-hbn"), row.getAttribute("data-schedule-tag"))) { row.removeAttribute("hidden"); shown += 1; }
          else row.setAttribute("hidden", "");
        });
        list.querySelectorAll("[data-schedule-heading]").forEach(function (heading) {
          var n = 0;
          heading.querySelectorAll("[data-schedule-tag]").forEach(function (row) {
            if (!row.hasAttribute("hidden")) n += 1;
          });
          var badge = heading.querySelector("[data-schedule-heading-count]");
          if (badge) badge.textContent = String(n);
          if (n === 0) heading.setAttribute("hidden", "");
          else heading.removeAttribute("hidden");
        });
        var empty = list.querySelector("[data-schedule-empty]");
        if (empty) { if (shown === 0) empty.removeAttribute("hidden"); else empty.setAttribute("hidden", ""); }
        var count = document.querySelector('[data-schedule-count="' + list.getAttribute("data-schedule-list") + '"]');
        if (count) count.textContent = String(shown);
      });
      document.querySelectorAll("[data-schedule-q]").forEach(function (input) { input.value = typed; });
      var url = new URL(window.location.href);
      if (typed) url.searchParams.set("q", typed); else url.searchParams.delete("q");
      url.searchParams.delete("ok");
      url.searchParams.delete("n");
      window.history.replaceState(null, "", url.toString());
    }
    box.addEventListener("input", apply);
  })();
</script>`;

function qField(q: string): string {
  return `<input type="hidden" name="q" value="${esc(q)}" data-schedule-q>`;
}

function emptyToggle(locale: Locale, anyShown: boolean): string {
  return `<p class="muted" data-schedule-empty${anyShown ? " hidden" : ""}>${esc(t(locale, "- EMPTY -"))}</p>`;
}

export type PrepackPanes = { available: ScheduleItemRow[]; working: ScheduleItemRow[]; complete: ScheduleItemRow[] };

/** THE PREPACK HEADINGS (canon 0.30.229). Seed display names, in the owner's order.
 * A stored name that is not one of these sorts after them. A blank name is Unknown. */
const GROW_METHOD_ORDER = ["Indoor", "Outdoor", "Greenhouse"];

function growMethodLabel(item: ScheduleItemRow): string | null {
  const name = String(item.grow_method ?? "").trim();
  return name || null;
}

function growHeadingRank(name: string | null): string {
  if (!name) return "2";
  const fixed = GROW_METHOD_ORDER.indexOf(name);
  if (fixed >= 0) return `0${String(fixed).padStart(2, "0")}`;
  return `1${name.toLowerCase()}`;
}

function strangerHeading(row: MetrcAdoptRow): string | null {
  const name = String(row.growMethod ?? "").trim();
  return name || null;
}

function availableByMethod(
  rows: ScheduleItemRow[],
  strangers: MetrcAdoptRow[],
  locale: Locale,
  query: string,
  controls: (item: ScheduleItemRow) => string,
  formId: string
): { html: string; shown: number } {
  const groups = new Map<string, { name: string | null; apps: ScheduleItemRow[]; strangers: MetrcAdoptRow[] }>();
  const bucket = (name: string | null) => {
    const key = name ?? "";
    const group = groups.get(key);
    if (group) return group;
    const made = { name, apps: [] as ScheduleItemRow[], strangers: [] as MetrcAdoptRow[] };
    groups.set(key, made);
    return made;
  };
  for (const item of rows) bucket(growMethodLabel(item)).apps.push(item);
  for (const row of [...strangers].sort((a, b) => a.tag.localeCompare(b.tag))) bucket(strangerHeading(row)).strangers.push(row);
  const ordered = [...groups.values()].sort((a, b) => growHeadingRank(a.name).localeCompare(growHeadingRank(b.name)));
  const adoptTitle = t(locale, "Adopt and schedule");
  const noHarvest = `<span class="muted schedule-inherit" data-adopt-hbn="">${esc(t(locale, "no harvest in METRC's lineage"))}</span>`;
  let shown = 0;
  const blocks = ordered
    .map((group) => {
      let visible = 0;
      const appItems = group.apps
        .map((item) => {
          const hit = scheduleFilterHit(query, item.hbn, item.tag);
          if (hit) visible += 1;
          return `<li class="schedule-item" data-schedule-id="${esc(item.id)}" data-schedule-tag="${esc(item.tag ?? "")}" data-schedule-hbn="${esc(item.hbn)}"${hit ? "" : " hidden"}>
          ${packageIdentityMarkup({ tag: item.tag ?? item.identity, strain: item.strain_name, grams: Number(item.grams ?? 0), hbn: item.hbn, location: item.location }, locale)}
          ${controls(item)}
        </li>`;
        })
        .join("");
      const strangerItems = group.strangers
        .map((row) => {
          const hit = scheduleFilterHit(query, row.harvest, row.tag);
          if (hit) visible += 1;
          const button = row.harvest
            ? `<button type="submit" form="${esc(formId)}" name="tag" value="${esc(row.tag)}" class="shuttle-btn" title="${esc(adoptTitle)}" aria-label="${esc(adoptTitle)}">&gt;&gt;</button>`
            : "";
          return `<li class="schedule-item" data-adopt-tag="${esc(row.tag)}" data-schedule-tag="${esc(row.tag)}" data-schedule-hbn="${esc(row.harvest ?? "")}"${hit ? "" : " hidden"}>
          ${packageIdentityMarkup({ tag: row.tag, strain: row.strain, grams: row.grams, hbn: row.harvest, location: row.location }, locale, row.harvest ? undefined : noHarvest)}
          ${button}
        </li>`;
        })
        .join("");
      shown += visible;
      const label = group.name ?? t(locale, "Unknown");
      const heading = `<h3>${esc(label)} <span class="tile-count" data-schedule-heading-count>${visible}</span></h3>`;
      const foldKey = group.name ? `grow:${group.name}` : "grow:unknown";
      const fold = queueFold(foldKey, heading, `<ul>${appItems}${strangerItems}</ul>`);
      const hidden = visible === 0 ? " hidden" : "";
      return fold.replace("<details ", `<details data-schedule-heading${hidden} `);
    })
    .join("");
  return {
    html: `<div data-schedule-list="available">
          ${blocks}
          ${emptyToggle(locale, shown > 0)}
        </div>`,
    shown,
  };
}

/** THE SCHEDULER BY PACKAGE (canon 0.30.196; owner: "the scheduler should only
 * really be scheduling by the package ID (or the last six digits of it).  Use
 * the ">>"/"<<" system we've precedented throughout the app."): packages, not
 * HBN groups, on all three panes. Each row reads the package in four lines
 * (canon 0.30.199: the whole tag, the strain and grams, the HBN, the location).
 * Available rows carry >>; Scheduled rows carry << and the > that opens the
 * station; Complete rows read the time. */
export function prepackSchedulingPage(panes: PrepackPanes, adopt: MetrcAdoptPane | null, locale: Locale, q = ""): string {
  const query = String(q ?? "").trim();
  const stage = SCHEDULE_STAGES.prepack;
  const base = `${PRODUCTION_SCHEDULING_PATH}/${stage}`;
  const formId = scheduleFormId(stage);
  const scheduleTitle = t(locale, "Schedule prepack");
  const unscheduleTitle = t(locale, "Unschedule");
  const prepackTitle = t(locale, "Prepack");
  const pane = (name: "available" | "working" | "complete", rows: ScheduleItemRow[], controls: (item: ScheduleItemRow) => string): { html: string; shown: number } => {
    let shown = 0;
    const items = rows
      .map((item) => {
        const visible = scheduleFilterHit(query, item.hbn, item.tag);
        if (visible) shown += 1;
        return `<li class="schedule-item" data-schedule-id="${esc(item.id)}" data-schedule-tag="${esc(item.tag ?? "")}" data-schedule-hbn="${esc(item.hbn)}"${visible ? "" : " hidden"}>
          ${packageIdentityMarkup({ tag: item.tag ?? item.identity, strain: item.strain_name, grams: Number(item.grams ?? 0), hbn: item.hbn, location: item.location }, locale)}
          ${controls(item)}
        </li>`;
      })
      .join("");
    return {
      html: `<div data-schedule-list="${name}">
          <ul>${items}</ul>
          ${emptyToggle(locale, shown > 0)}
        </div>`,
      shown,
    };
  };
  const available = availableByMethod(panes.available, adopt?.rows ?? [], locale, query, (item) =>
    `<button type="submit" form="${esc(formId)}" name="wip_package_id" value="${esc(item.id)}" class="shuttle-btn" title="${esc(scheduleTitle)}" aria-label="${esc(scheduleTitle)}">&gt;&gt;</button>`,
    formId
  );
  const working = pane(
    "working",
    panes.working,
    (item) => `<span class="muted schedule-status">${esc(t(locale, scheduleStatusWord(stage, item)))}</span>
          <form method="post" action="${esc(base)}/unschedule/${esc(item.id)}" class="shuttle-form">
            ${qField(query)}
            <button type="submit" class="shuttle-btn" title="${esc(unscheduleTitle)}" aria-label="${esc(unscheduleTitle)}">&lt;&lt;</button>
          </form>
          <a class="shuttle-btn" href="${esc(PREPACK_STATION_PATH)}?pick=${esc(item.id)}" title="${esc(prepackTitle)}" aria-label="${esc(prepackTitle)}">&gt;</a>`
  );
  const complete = pane("complete", panes.complete, (item) =>
    `${item.completed_at ? `<time datetime="${esc(item.completed_at)}" data-local>${esc(item.completed_at)}</time>` : ""}${unfinishForm(stage, item.id, locale, query)}`
  );
  return `<h1>${esc(t(locale, SCHEDULE_STAGE_TITLES[stage]))}</h1>
    <form method="get" action="${esc(base)}" class="schedule-filter" data-schedule-filter-form>
      <label class="field">${esc(t(locale, "Filter"))}
        <input type="search" name="q" value="${esc(query)}" placeholder="${esc(t(locale, "HBN or last six"))}" autocomplete="off" data-schedule-filter>
      </label>
    </form>
    <div class="station-triple">
      <aside class="queue-pane" data-schedule-pane="available">
        <h2>${esc(t(locale, "Available"))} <span class="tile-count" data-schedule-count="available">${available.shown}</span></h2>
        <form id="${esc(formId)}" method="post" action="${esc(base)}/schedule">
          ${effectiveDateField(null, locale, t(locale, "The day this schedule is effective."))}
          ${qField(query)}
        </form>
        ${available.html}
      </aside>
      <section class="queue-pane" data-schedule-pane="working">
        <h2>${esc(t(locale, "Scheduled"))} <span class="tile-count" data-schedule-count="working">${working.shown}</span></h2>
        ${working.html}
      </section>
      <aside class="queue-pane" data-schedule-pane="complete">
        <h2>${esc(t(locale, "Complete"))} <span class="tile-count" data-schedule-count="complete">${complete.shown}</span></h2>
        ${complete.html}
      </aside>
    </div>
    ${FILTER_SCRIPT}
    ${QUEUE_FOLD_SCRIPT}
    ${localTimeScript()}`;
}

export function schedulingPage(
  stage: ScheduleStage,
  panes: SchedulePanes,
  locale: Locale,
  nowIso: string,
  ok?: string,
  adopt?: MetrcAdoptPane | null,
  terpRecipes: readonly TerpRecipeOption[] = []
): string {
  void nowIso;
  void ok;
  if (stage === SCHEDULE_STAGES.prepack) {
    const flat = (groups: ScheduleHbnGroup[]) => groups.flatMap((group) => group.items);
    return prepackSchedulingPage({ available: flat(panes.available), working: flat(panes.working), complete: flat(panes.complete) }, adopt ?? null, locale);
  }
  const title = t(locale, SCHEDULE_STAGE_TITLES[stage]);
  const hint = t(locale, "The day this schedule is effective.");
  const formId = scheduleFormId(stage);
  const availableBody =
    panes.available.length === 0
      ? emptyLine(locale)
      : panes.available.map((g) => availableGroup(stage, g, locale)).join("");
  const workingBody =
    panes.working.length === 0
      ? emptyLine(locale)
      : panes.working.map((g) => workingGroup(stage, g, locale, terpRecipes)).join("");
  const completeBody =
    panes.complete.length === 0
      ? emptyLine(locale)
      : panes.complete.map((g) => completeGroup(stage, g, locale)).join("");
  const availCount = panes.available.reduce((n, g) => n + g.items.length, 0);
  const workCount = panes.working.reduce((n, g) => n + g.items.length, 0);
  const doneCount = panes.complete.reduce((n, g) => n + g.items.length, 0);
  return `<h1>${esc(title)}</h1>
    <div class="station-triple">
      <aside class="queue-pane" data-schedule-pane="available">
        <h2>${esc(t(locale, "Available"))} <span class="tile-count">${availCount}</span></h2>
        <form id="${esc(formId)}" method="post" action="${esc(
    PRODUCTION_SCHEDULING_PATH
  )}/${esc(stage)}/schedule">
          ${effectiveDateField(null, locale, hint)}
        </form>
        ${availableBody}
      </aside>
      <section class="queue-pane" data-schedule-pane="working">
        <h2>${esc(t(locale, "Scheduled"))} <span class="tile-count">${workCount}</span></h2>
        ${workingBody}
      </section>
      <aside class="queue-pane" data-schedule-pane="complete">
        <h2>${esc(t(locale, "Complete"))} <span class="tile-count">${doneCount}</span></h2>
        ${completeBody}
      </aside>
    </div>
    ${localTimeScript()}`;
}

/* ------------------------------------------------ THE DRYING SCHEDULE (canon 0.30.226) */

/** The space a waiting lot is planned for, the rule Load Silo's preselect
 * reads: the lot's own space when Move To named a loadable space, else the
 * HBN's planned silo. */
export function plannedSpaceIdOf(lot: BarnWetLotRow): string | null {
  return lot.planned_space_kind === "silo" ? (lot.actual_dryspc ?? null) : (lot.planned_silo_id ?? null);
}

/** The >> on an Available lot: Load Silo's picked form, the select limited to
 * this surface's space type, the planned space preselected when it is of that
 * type. Any lot may go to any space of any kind (his "Shares to any space"). */
export function dryingLoadHref(lot: BarnWetLotRow, type: DrySpaceType, spaces: readonly SiloRow[]): string {
  const planned = plannedSpaceIdOf(lot);
  const plannedHere = planned != null && spaces.some((space) => space.id === planned && spaceTypeOf(space) === type);
  const params = new URLSearchParams({ pick: lot.id, kind: type });
  if (plannedHere && planned) params.set("space", planned);
  return `/station/load_silo?${params.toString()}`;
}

/** THE JOINT UNLOAD (canon 0.30.226): a space carries Unload together when
 * its open loads hold two or more lots. A freezer's unload removes the line
 * with nothing weighed, so it has no joint form. */
export function canUnloadTogether(space: SiloRow, loadedLots: number): boolean {
  return loadedLots >= 2 && spaceTypeOf(space) !== "freezer";
}

/** Yield, dry over wet, one decimal (round half up). Null without both. */
export function dryingYieldPct(wetGrams: number | null | undefined, dryGrams: number | null | undefined): string | null {
  const wet = Number(wetGrams ?? 0);
  const dry = Number(dryGrams ?? 0);
  if (!(wet > 0) || !(dry > 0)) return null;
  return `${(Math.round((dry / wet) * 1000) / 10).toFixed(1)}%`;
}

/** The Complete window's first instant: the start of the farm day six days
 * before today, so the pane covers today and the six farm days before it. */
export function dryingCompleteSince(nowIso: string, startHour: number = FARM_DAY_START_HOUR_DEFAULT): string {
  let day = farmDay(nowIso, startHour);
  for (let i = 1; i < DRYING_COMPLETE_DAYS; i++) day = dayBefore(day);
  return farmDayBounds(day, startHour).startIso;
}

/** The unload's instant: the later of the finished session and the ended load. */
export function unloadInstantOf(row: DryingCompleteRow): string | null {
  const finished = row.finished_at ?? null;
  const ended = row.ended_at ?? null;
  if (finished && ended) return finished >= ended ? finished : ended;
  return finished ?? ended;
}

/** The unload's day: the finished session's effective day (the day the crew
 * set, the Admin PIN for any other), else the farm day of the instant. */
export function unloadDayOf(row: DryingCompleteRow, startHour: number = FARM_DAY_START_HOUR_DEFAULT): string {
  const instant = unloadInstantOf(row);
  if (row.finished_at && instant === row.finished_at && row.effective_date) return row.effective_date;
  return instant ? farmDay(instant, startHour) : "";
}

export type DryingSurfaceInput = {
  stage: DryingStage;
  /** Scheduled lots Load Silo lists (listScheduledLotsForLoad: one row per HBN, id is the harvest batch). */
  lots: BarnWetLotRow[];
  /** Every loadable space with its open loads, the rows the tiles read (loadSiloVisuals). */
  live: ReadonlyArray<{ silo: SiloRow; loads: SiloLoadRow[] }>;
  /** Lots unloaded inside the window (listDryingComplete). */
  complete: DryingCompleteRow[];
  nowIso: string;
  farmDayStart?: number;
  /** The space whose joint form is open (?together=). */
  together?: string | null;
  locale?: Locale;
};

function dryingEmpty(locale: Locale): string {
  return `<p class="muted">${esc(t(locale, "- EMPTY -"))}</p>`;
}

function availableDryingRow(lot: BarnWetLotRow, type: DrySpaceType, spaces: readonly SiloRow[], locale: Locale): string {
  const planned = plannedSpaceIdOf(lot);
  const plannedSpace = planned ? spaces.find((space) => space.id === planned) ?? null : null;
  const plannedHere = plannedSpace != null && spaceTypeOf(plannedSpace) === type;
  const plannedName = plannedSpace?.name ?? (planned ? lot.planned_space_name : null);
  const plannedLine = plannedHere
    ? `<span class="schedule-planned" data-planned-here><strong>${esc(t(locale, "planned here"))}</strong>: ${esc(plannedName ?? "")}</span>`
    : plannedName
      ? `<span class="muted schedule-planned">${esc(t(locale, "Planned"))}: ${esc(plannedName)}</span>`
      : `<span class="muted schedule-planned">${esc(t(locale, "no planned space"))}</span>`;
  const wet = Number(lot.weight_grams ?? 0);
  const title = t(locale, "Load");
  const noPackage = lot.item_id ? "" : ` <span class="muted" data-no-package>(${esc(t(locale, "no live package"))})</span>`;
  return `<li class="schedule-item" data-drying-lot="${esc(lot.id)}" data-planned-space="${esc(planned ?? "")}">
          <span class="schedule-identity">${esc(barnLotLabel(lot))}</span>
          <span class="muted" data-wet-grams="${esc(String(wet))}">${esc(t(locale, "Wet"))} ${esc(formatGrams(wet))} g</span>
          ${plannedLine}${noPackage}
          <a class="shuttle-btn" href="${esc(dryingLoadHref(lot, type, spaces))}" title="${esc(title)}" aria-label="${esc(title)}">&gt;&gt;</a>
        </li>`;
}

function workingDryingRow(load: SiloLoadRow, path: string, nowIso: string, locale: Locale): string {
  const state = siloClockState(load);
  const pauseLabel = state === "paused" ? t(locale, "Resume") : t(locale, "Pause");
  const next = `<input type="hidden" name="next" value="${esc(path)}">`;
  const wet = Number(load.weight_grams ?? 0);
  const unload = t(locale, "Unload");
  return `<li class="schedule-item" data-drying-load="${esc(load.id)}" data-drying-lot="${esc(load.wet_weight_entry_id)}">
          <span class="schedule-identity">${esc(loadLotLabel(load))}</span>
          <span class="muted" data-wet-grams="${esc(String(wet))}">${esc(t(locale, "Wet"))} ${esc(formatGrams(wet))} g</span>
          <span class="schedule-clock">${clockMarkup(load, nowIso, locale)}</span>
          <form method="post" action="/station/load_silo/${esc(load.id)}/start" class="shuttle-form">
            ${next}
            <button type="submit"${state !== "not_started" ? " disabled" : ""} title="${esc(t(locale, "The clock started at the loaded time."))}">${esc(t(locale, "Start"))}</button>
          </form>
          <form method="post" action="/station/load_silo/${esc(load.id)}/pause" class="shuttle-form">
            ${next}
            <button type="submit" class="secondary"${state === "not_started" ? " disabled" : ""}>${esc(pauseLabel)}</button>
          </form>
          <a class="shuttle-btn" href="/station/unload_dry_space?pick=${esc(encodeURIComponent(load.wet_weight_entry_id))}" title="${esc(unload)}" aria-label="${esc(unload)}">&gt;</a>
        </li>`;
}

/** THE RUN (canon 0.30.248; owner, 2026-09-26: "is it possible to see on the
 * "complete" pane in the silos screen to see how long they ran according to
 * timestamps?", his picks "Unload finished (Recommended)" and "Yes, add the
 * average"): the lot's latest ended load's clock read at its end, the loaded
 * time to the unload's finish less the banked pauses (frozen at paused_at when
 * it ended paused), what the tile showed when it cleared; null without a
 * readable time. */
export function dryingRunSeconds(row: DryingCompleteRow): number | null {
  if (!row.run_ended_at) return null;
  return siloClockSeconds(
    {
      loaded_at: row.run_loaded_at ?? "",
      started_at: row.run_started_at ?? null,
      paused_at: row.run_paused_at ?? null,
      paused_seconds: Number(row.run_paused_seconds ?? 0),
    },
    row.run_ended_at
  );
}

/** THE AVERAGE (canon 0.30.248): the mean run of the rows that have one, whole seconds; null when none has. */
export function dryingRunAverage(rows: readonly DryingCompleteRow[]): number | null {
  const runs = rows.map(dryingRunSeconds).filter((n): n is number => n != null);
  return runs.length === 0 ? null : Math.round(runs.reduce((sum, n) => sum + n, 0) / runs.length);
}

function completeDryingRow(row: DryingCompleteRow, startHour: number, locale: Locale): string {
  const label = barnLotLabel({
    metrc_harvest_tag: row.metrc_harvest_tag,
    package_code: row.package_code,
    farm_code: row.farm_code,
    strain_label: row.strain_label,
    hbn: row.hbn,
    truck_number: row.truck_number,
  });
  const day = unloadDayOf(row, startHour);
  const dry = row.dry_weight_grams == null ? null : Number(row.dry_weight_grams);
  const pct = dryingYieldPct(row.weight_grams, dry);
  const weighed =
    row.status === LOT_STATUS.frozen
      ? `<span class="muted" data-line-removed>${esc(t(locale, "Line removed"))}</span>`
      : `<span class="muted">${esc(t(locale, "Dry"))} ${esc(formatGrams(dry ?? 0))} g</span>${
          pct ? ` <span class="muted" data-yield>${esc(t(locale, "Yield"))} ${esc(pct)}</span>` : ""
        }`;
  const run = dryingRunSeconds(row);
  const ran =
    run == null
      ? ""
      : `<span class="muted" data-run-seconds="${esc(String(run))}">${esc(tFill(locale, "Ran {t}", { t: formatRunClock(run) }))}</span>`;
  return `<li class="schedule-item" data-drying-lot="${esc(row.lot_id)}"${dry == null ? "" : ` data-dry-grams="${esc(String(dry))}"`}>
          <span class="schedule-identity">${esc(label)}</span>
          ${weighed}
          ${ran}
          <span class="muted" data-unload-day="${esc(day)}">${esc(day)}</span>
        </li>`;
}

/** THE DRYING SCHEDULE (canon 0.30.226; his pick "Three surfaces by space
 * kind"): Silos, Dry Rooms and Freezers, each the station-triple of the lines.
 * AVAILABLE: every lot Load Silo lists, grouped by HBN, with its label (the
 * truck when it rode one), its wet grams and its planned space, "planned
 * here" when that space is of this kind, and >> into Load Silo's picked form
 * limited to this kind. WORKING: the open loads of this kind's spaces under
 * each space, with the clock as the tiles read it, Start and Pause as Load
 * Silo's (returning here), and > into Unload Dry Space on the lot; a space
 * holding two or more loads carries Unload together. COMPLETE: this kind's
 * lots unloaded in the last seven days, with the dry grams, the yield, the run
 * (canon 0.30.248) and the unload's day, each space's average run in its
 * heading. Pure: the route prepends the silo strip, whose script keeps
 * the clocks ticking. */
export function dryingSchedulingPage(input: DryingSurfaceInput): string {
  const locale = input.locale ?? "en";
  const stage = input.stage;
  const type = DRYING_STAGE_SPACE_TYPE[stage];
  const path = dryingStagePath(stage);
  const startHour = input.farmDayStart ?? FARM_DAY_START_HOUR_DEFAULT;
  const spaces = input.live.map((entry) => entry.silo);

  const byHbn = new Map<string, BarnWetLotRow[]>();
  for (const lot of input.lots) {
    const key = lot.hbn ?? "";
    const group = byHbn.get(key);
    if (group) group.push(lot);
    else byHbn.set(key, [lot]);
  }
  const available = [...byHbn.entries()]
    .map(
      ([hbn, lots]) => `<section class="schedule-group" data-schedule-hbn="${esc(hbn)}">
        <h3 class="schedule-hbn-label">${esc(hbn)} <span class="tile-count">${lots.length}</span></h3>
        <ul>${lots.map((lot) => availableDryingRow(lot, type, spaces, locale)).join("")}</ul>
      </section>`
    )
    .join("");

  const holding = input.live.filter((entry) => spaceTypeOf(entry.silo) === type && entry.loads.length > 0);
  const workingCount = holding.reduce((n, entry) => n + entry.loads.length, 0);
  const working = holding
    .map((entry) => {
      const loads = [...entry.loads].sort(shareOrder);
      const joint = canUnloadTogether(entry.silo, new Set(loads.map((load) => load.wet_weight_entry_id)).size);
      const link = joint
        ? `<a class="btn secondary" href="${esc(`${path}?together=${encodeURIComponent(entry.silo.id)}`)}" data-unload-together-link="${esc(entry.silo.id)}">${esc(
            t(locale, "Unload together")
          )}</a>`
        : "";
      const form =
        joint && input.together === entry.silo.id
          ? unloadTogetherForm({ stage, space: entry.silo, loads, nowIso: input.nowIso, farmDayStart: startHour, locale })
          : "";
      return `<section class="schedule-group" data-drying-space="${esc(entry.silo.id)}">
        <div class="schedule-hbn-summary">
          <h3 class="schedule-hbn-label">${esc(entry.silo.name)} <span class="tile-count">${loads.length}</span></h3>
          ${link}
        </div>
        ${form}
        <ul>${loads.map((load) => workingDryingRow(load, path, input.nowIso, locale)).join("")}</ul>
      </section>`;
    })
    .join("");

  const done = input.complete
    .filter((row) => spaceTypeOf({ space_type: row.space_type, shape: row.shape }) === type)
    .map((row) => ({ row, instant: unloadInstantOf(row) ?? "" }))
    .sort((a, b) => (a.instant === b.instant ? 0 : a.instant > b.instant ? -1 : 1));
  const seenLots = new Set<string>();
  const bySpace = new Map<string, { name: string; rows: DryingCompleteRow[] }>();
  for (const { row } of done) {
    if (seenLots.has(row.lot_id)) continue;
    seenLots.add(row.lot_id);
    const group = bySpace.get(row.space_id);
    if (group) group.rows.push(row);
    else bySpace.set(row.space_id, { name: row.space_name ?? "", rows: [row] });
  }
  const complete = [...bySpace.entries()]
    .map(
      ([spaceId, group]) => {
        const average = dryingRunAverage(group.rows);
        const averageMark =
          average == null
            ? ""
            : ` <span class="muted" data-run-average="${esc(String(average))}">${esc(tFill(locale, "average {t}", { t: formatRunClock(average) }))}</span>`;
        return `<section class="schedule-group" data-drying-space="${esc(spaceId)}">
        <h3 class="schedule-hbn-label">${esc(group.name)} <span class="tile-count">${group.rows.length}</span>${averageMark}</h3>
        <ul>${group.rows.map((row) => completeDryingRow(row, startHour, locale)).join("")}</ul>
      </section>`;
      }
    )
    .join("");

  return `<h1>${esc(t(locale, SCHEDULE_STAGE_TITLES[stage]))}</h1>
    <div class="station-triple" data-drying-surface="${esc(stage)}">
      <aside class="queue-pane" data-schedule-pane="available">
        <h2>${esc(t(locale, "Available"))} <span class="tile-count" data-schedule-count="available">${input.lots.length}</span></h2>
        ${available || dryingEmpty(locale)}
      </aside>
      <section class="queue-pane" data-schedule-pane="working">
        <h2>${esc(t(locale, "Working"))} <span class="tile-count" data-schedule-count="working">${workingCount}</span></h2>
        ${working || dryingEmpty(locale)}
      </section>
      <aside class="queue-pane" data-schedule-pane="complete">
        <h2>${esc(t(locale, "Complete"))} <span class="tile-count" data-schedule-count="complete">${seenLots.size}</span></h2>
        <p class="muted">${esc(t(locale, "Unloaded in the last seven days."))}</p>
        ${complete || dryingEmpty(locale)}
      </aside>
    </div>`;
}

/** THE LOAD AND THE LOT (canon 0.30.241). A lot is an HBN. Its parts are the
 * finished loads still waiting for a space. */
export type LogisticsLotView = {
  harvest_batch_id: string;
  hbn: string | null;
  farm_code: string | null;
  strain_label: string | null;
  metrc_harvest_tag: string | null;
  package_code: string | null;
  trucks: string[];
  partIds: string[];
  weight_grams: number;
  planned_silo_name: string | null;
  oldest_finished_at: string | null;
  schedule_id?: string | null;
  /** THE IN-TRANSIT RULE (canon 0.30.320): a weighing lot a sent load exposed. */
  in_transit?: boolean;
  in_transit_loads?: number;
};

export function logisticsLotView(parts: BarnWetLotRow[], scheduleId: string | null = null): LogisticsLotView | null {
  if (parts.length === 0) return null;
  const first = parts[0];
  const trucks = [
    ...new Set(
      parts
        .filter((part) => part.status !== LOT_STATUS.weighing)
        .map((part) => String(part.truck_number ?? "").trim())
        .filter(Boolean)
    ),
  ];
  const oldest = parts
    .map((part) => part.finished_at ?? "")
    .filter(Boolean)
    .sort()[0] ?? null;
  const inTransitLoads = parts.reduce((sum, part) => sum + Number(part.in_transit_loads ?? 0), 0);
  const inTransit = parts.some((part) => part.status === LOT_STATUS.weighing) && inTransitLoads > 0;
  return {
    harvest_batch_id: first.harvest_batch_id || first.id,
    hbn: first.hbn,
    farm_code: first.farm_code,
    strain_label: first.strain_label,
    metrc_harvest_tag: first.metrc_harvest_tag,
    package_code: first.package_code,
    trucks,
    partIds: parts.map((part) => part.id),
    weight_grams: parts.reduce((sum, part) => sum + Number(part.weight_grams ?? 0), 0),
    planned_silo_name: first.planned_silo_name ?? (first.planned_dryspc ? `Silo ${first.planned_dryspc}` : null),
    oldest_finished_at: oldest,
    schedule_id: scheduleId,
    in_transit: inTransit,
    in_transit_loads: inTransitLoads,
  };
}

function waitedLabel(iso: string | null, nowIso: string): string {
  const ms = Date.parse(nowIso) - Date.parse(iso ?? "");
  if (!Number.isFinite(ms) || ms < 0) return "0d 00:00:00";
  const s = Math.floor(ms / 1000);
  const days = Math.floor(s / 86400);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${days}d ${pad(Math.floor((s % 86400) / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
}

function logisticsRow(lot: LogisticsLotView, locale: Locale, nowIso: string, control: string): string {
  const label = barnLotLabel({
    metrc_harvest_tag: lot.metrc_harvest_tag,
    package_code: lot.package_code,
    farm_code: lot.farm_code,
    strain_label: lot.strain_label,
    hbn: lot.hbn,
    truck_number: lot.trucks.length === 1 ? lot.trucks[0] : null,
  });
  const partsWord = lot.partIds.length === 1 ? t(locale, "1 part") : tFill(locale, "{n} parts", { n: String(lot.partIds.length) });
  const inTransit = lot.in_transit === true;
  const loadCount = lot.in_transit_loads ?? 0;
  const loadWord = loadCount === 1 ? t(locale, "1 load") : tFill(locale, "{n} loads", { n: String(loadCount) });
  const trucks = inTransit
    ? `${t(locale, "in transit")}, ${loadWord}`
    : `${t(locale, "Trucks")} ${lot.trucks.length > 0 ? lot.trucks.join(", ") : t(locale, "no truck")}`;
  const planned = lot.planned_silo_name ?? t(locale, "no planned silo");
  return `<li class="schedule-item"${inTransit ? " data-logistics-in-transit" : ""} data-logistics-lot="${esc(lot.harvest_batch_id)}" data-logistics-parts="${esc(lot.partIds.join(" "))}" data-logistics-hbn="${esc(lot.hbn ?? "")}">
          <span class="schedule-identity">${esc(label)}</span>
          <span class="muted" data-logistics-part-count>${esc(partsWord)}</span>
          <span class="muted" data-logistics-trucks>${esc(trucks)}</span>
          <span class="muted" data-wet-grams="${esc(String(lot.weight_grams))}">${esc(formatGrams(lot.weight_grams))} g</span>
          <span class="muted" data-planned-silo>${esc(t(locale, "Planned silo"))}: ${esc(planned)}</span>
          <span class="muted" data-waited="${esc(lot.oldest_finished_at ?? "")}">${esc(t(locale, "Waited"))} ${esc(waitedLabel(lot.oldest_finished_at, nowIso))}</span>
          ${control}
        </li>`;
}

export function internalLogisticsPage(input: {
  queue: LogisticsLotView[];
  scheduled: LogisticsLotView[];
  finished: FinishedLogisticsRow[];
  nowIso: string;
  locale?: Locale;
}): string {
  const locale = input.locale ?? "en";
  const pass = t(locale, "Pass lot");
  const back = t(locale, "Return lot");
  const open = t(locale, "Open Load Silo");
  const queue = input.queue
    .map((lot) =>
      logisticsRow(
        lot,
        locale,
        input.nowIso,
        `<form method="post" action="${esc(INTERNAL_LOGISTICS_PATH)}/schedule" class="shuttle-form">
            <input type="hidden" name="harvest_batch_id" value="${esc(lot.harvest_batch_id)}">
            <button type="submit" class="shuttle-btn" title="${esc(pass)}" aria-label="${esc(pass)}">&gt;&gt;</button>
          </form>`
      )
    )
    .join("");
  const scheduled = input.scheduled
    .map((lot) =>
      logisticsRow(
        lot,
        locale,
        input.nowIso,
        `<form method="post" action="${esc(INTERNAL_LOGISTICS_PATH)}/unschedule/${esc(lot.schedule_id ?? "")}" class="shuttle-form">
            <button type="submit" class="shuttle-btn" title="${esc(back)}" aria-label="${esc(back)}">&lt;&lt;</button>
          </form>
          ${
            lot.partIds.length > 0
              ? `<a class="shuttle-btn" href="/station/load_silo?pick=${esc(lot.harvest_batch_id)}" title="${esc(open)}" aria-label="${esc(open)}">&gt;</a>`
              : ""
          }`
      )
    )
    .join("");
  const finished = input.finished
    .map((row) => {
      const label = barnLotLabel({
        metrc_harvest_tag: row.metrc_harvest_tag,
        package_code: null,
        farm_code: row.farm_code,
        strain_label: row.strain_label,
        hbn: row.hbn,
      });
      return `<li class="schedule-item" data-logistics-finished="${esc(row.harvest_batch_id)}" data-logistics-hbn="${esc(row.hbn ?? "")}">
          <span class="schedule-identity">${esc(label)}</span>
          <span class="muted" data-logistics-space>${esc(row.space_name ?? "")}</span>
          ${row.completed_at ? `<time datetime="${esc(row.completed_at)}" data-local>${esc(row.completed_at)}</time>` : ""}
        </li>`;
    })
    .join("");
  const pane = (name: string, title: string, body: string, count: number) =>
    `<${name === "working" ? "section" : "aside"} class="queue-pane" data-schedule-pane="${name}">
        <h2>${esc(t(locale, title))} <span class="tile-count" data-schedule-count="${name}">${count}</span></h2>
        ${body ? `<ul>${body}</ul>` : `<p class="muted">${esc(t(locale, "- EMPTY -"))}</p>`}
      </${name === "working" ? "section" : "aside"}>`;
  return `<h1>${esc(t(locale, "Internal Logistics"))}</h1>
    <div class="station-triple">
      ${pane("available", "Dry Queue", queue, input.queue.length)}
      ${pane("working", "Scheduled", scheduled, input.scheduled.length)}
      ${pane("complete", "Finished", finished, input.finished.length)}
    </div>
    ${localTimeScript()}`;
}

export function processingPartnersPage(locale: Locale = "en"): string {
  return `<h1>${esc(t(locale, "Processing Partners"))}</h1>
    <p class="muted">${esc(t(locale, "- EMPTY -"))}</p>`;
}
