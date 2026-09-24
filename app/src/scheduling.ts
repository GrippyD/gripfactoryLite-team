/**
 * PRODUCTION SCHEDULING (canon 0.30.97). Two shuttle-style stations,
 * Trimming and Pasteurization, whose schedule is what exposes material to
 * Trim Packages Entry and Cryo Weight Entry. The renderer is pure (input in,
 * HTML out) so the tests pin it without a database.
 */
import {
  PREPACK_STATION_PATH,
  PRODUCTION_SCHEDULING_PATH,
  SCHEDULE_STAGE_TITLES,
  SCHEDULE_STAGES,
  type ScheduleStage,
} from "./config";
import type { ScheduleHbnGroup, ScheduleItemRow } from "./db";
import type { MetrcAdoptPane } from "./metrc";
import { lastSix, packageIdentityMarkup } from "./prepack";
import { effectiveDateField } from "./effective";
import { localTimeScript } from "./html";
import { t, type Locale } from "./i18n";
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

export function parseScheduleStage(raw: string | undefined): ScheduleStage | null {
  if (raw === SCHEDULE_STAGES.trim || raw === SCHEDULE_STAGES.cryo || raw === SCHEDULE_STAGES.prepack) return raw;
  return null;
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
    const pool = group.items.map((item) => esc(item.identity)).join("; ");
    return `<div class="pane-group schedule-run" data-schedule-hbn="${esc(group.harvest_batch_id)}">
      <div class="schedule-hbn-summary">
        <span class="schedule-hbn-line">${groupHeading(group)} <span class="muted schedule-pool">${pool}</span></span>
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

function workingItem(stage: ScheduleStage, item: ScheduleItemRow, locale: Locale): string {
  const status = t(locale, scheduleStatusWord(stage, item));
  const done = item.workDone ? `<span class="muted">${esc(t(locale, item.workDone))}</span>` : "";
  const base = `${PRODUCTION_SCHEDULING_PATH}/${stage}`;
  return `<li class="schedule-item" data-schedule-id="${esc(item.id)}">
      <span class="schedule-identity">${esc(item.identity)}</span>
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
  return `<li class="schedule-item" data-schedule-id="${esc(item.id)}">
      <span class="schedule-identity">${esc(item.identity)}</span>
      ${when}
      ${unfinishForm(stage, item.id, locale)}
    </li>`;
}

function workingGroup(stage: ScheduleStage, group: ScheduleHbnGroup, locale: Locale): string {
  const items = group.items.map((item) => workingItem(stage, item, locale)).join("");
  return `<section class="schedule-group" data-schedule-hbn="${esc(group.harvest_batch_id)}">
      <h3 class="schedule-hbn-label">${groupHeading(group)}</h3>
      <ul>${items}</ul>
    </section>`;
}

function completeGroup(stage: ScheduleStage, group: ScheduleHbnGroup, locale: Locale): string {
  const items = group.items.map((item) => completeItem(stage, item, locale)).join("");
  return `<section class="schedule-group" data-schedule-hbn="${esc(group.harvest_batch_id)}">
      <h3 class="schedule-hbn-label">${groupHeading(group)}</h3>
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

function adoptSection(adopt: MetrcAdoptPane, locale: Locale, q: string, formId: string): string {
  if (adopt.rows.length === 0) {
    return `<section data-schedule-adopt>
      <h3>${esc(t(locale, "From METRC"))}</h3>
      <p class="muted">${esc(t(locale, "Nothing to adopt."))}</p>
    </section>`;
  }
  let anyShown = false;
  const adoptTitle = t(locale, "Adopt and schedule");
  const rows = adopt.rows
    .map((row) => {
      const shown = scheduleFilterHit(q, row.harvest, row.tag);
      if (shown) anyShown = true;
      // THE HBN INHERITED (canon 0.30.196): the HBN line names the harvest the
      // package will inherit, known or new from METRC. A row whose lineage
      // names no harvest carries no >>.
      const inherit = row.harvest
        ? `<span class="schedule-inherit" data-adopt-hbn="${esc(row.harvest)}" data-adopt-known="${row.hbnId ? "1" : "0"}">${esc(row.harvest)} <strong>${esc(
            t(locale, row.hbnId ? "known" : "new from METRC")
          )}</strong></span>`
        : `<span class="muted schedule-inherit" data-adopt-hbn="">${esc(t(locale, "no harvest in METRC's lineage"))}</span>`;
      // >> ADOPTS AND SCHEDULES (canon 0.30.200): the control is the Available
      // pane's shared schedule form, so the effective date and the filter ride
      // with the tag.
      const button = row.harvest
        ? `<button type="submit" form="${esc(formId)}" name="tag" value="${esc(row.tag)}" class="shuttle-btn" title="${esc(adoptTitle)}" aria-label="${esc(adoptTitle)}">&gt;&gt;</button>`
        : "";
      // THE PACKAGE READS IN FOUR LINES (canon 0.30.199): the whole tag, the
      // strain and grams, the HBN it will inherit, the location METRC states.
      return `<li class="schedule-item" data-adopt-tag="${esc(row.tag)}" data-schedule-tag="${esc(row.tag)}" data-schedule-hbn="${esc(row.harvest ?? "")}"${shown ? "" : " hidden"}>
        ${packageIdentityMarkup({ tag: row.tag, strain: row.strain, grams: row.grams, hbn: row.harvest, location: row.location }, locale, inherit)}
        ${button}
      </li>`;
    })
    .join("");
  return `<section data-schedule-adopt>
      <h3>${esc(t(locale, "From METRC"))}</h3>
      <div data-schedule-list="adopt">
        <ul>${rows}</ul>
        ${emptyToggle(locale, anyShown)}
      </div>
    </section>`;
}

export type PrepackPanes = { available: ScheduleItemRow[]; working: ScheduleItemRow[]; complete: ScheduleItemRow[] };

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
  const available = pane(
    "available",
    panes.available,
    (item) =>
      `<button type="submit" form="${esc(formId)}" name="wip_package_id" value="${esc(item.id)}" class="shuttle-btn" title="${esc(scheduleTitle)}" aria-label="${esc(scheduleTitle)}">&gt;&gt;</button>`
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
        ${adopt ? adoptSection(adopt, locale, query, formId) : ""}
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
    ${localTimeScript()}`;
}

export function schedulingPage(
  stage: ScheduleStage,
  panes: SchedulePanes,
  locale: Locale,
  nowIso: string,
  ok?: string,
  adopt?: MetrcAdoptPane | null
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
      : panes.working.map((g) => workingGroup(stage, g, locale)).join("");
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
