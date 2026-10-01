/**
 * THE RAD SCHEDULE AND RAD OPERATION (canon 0.30.327). Two tiles on the
 * Compliance Console. The schedule builds runs of one to ten packages. The
 * operation starts one run, completes it, and reopens it behind the PIN.
 * Completion pasteurizes the tags for the Testing gate and puts each package
 * into the testing queue. Nothing on these pages is sent to METRC.
 */
import { HttpError, nowIso } from "./audit";
import { gateItemType, gatePackageGrams } from "./console";
import {
  CONFIG_KEYS,
  formatGrams,
  parseGateUnitGrams,
  RAD_RUN_STATUS,
  roundGrams,
} from "./config";
import {
  getConfigValue,
  listRadBatchGrows,
  listRadCompletedStates,
  listRadGrowMethods,
  listRadMirrorRows,
  listRadOpenTags,
  listRadPackageRecords,
  listRadRunRecords,
  type RadMirrorRow,
  type RadPackageRecord,
} from "./db";
import { clockScript, formatClock } from "./drying";
import { etClock12, etWallClock, parseFarmDayStartHour } from "./farmday";
import { time12MaskScript } from "./html";
import { t, tFill, type Locale } from "./i18n";
import { harvestTokens, inheritedHarvest, adoptGrowMethod } from "./metrc";
import { hbnFromMetrcName, parseHbn } from "./mint";
import { dryingCompleteSince } from "./scheduling";
import { esc } from "./ui";

export const RAD_SCHEDULE_PATH = "/compliance/rad_schedule";
export const RAD_OPERATION_PATH = "/compliance/rad_operation";
export const RAD_TYPES = ["BUD", "WPR", "SHA", "PRE", "MOB", "WBP"] as const;
export const RAD_STATES = ["NotSubmitted", "TestFailed", "RetestFailed"] as const;
export const RAD_RUN_LIMIT = 10;
export const RAD_GREYS: readonly number[] = Array.from({ length: 30 }, (_, i) => 100 + i * 100);
const GROW_ORDER = ["Indoor", "Outdoor", "Greenhouse"];

export function isRadGrey(value: number): boolean {
  return Number.isInteger(value) && value >= 100 && value <= 3000 && value % 100 === 0;
}

/** The last five of the tag as a number. A non-numeric tail sorts last. */
export function radTail(tag: string): number {
  const tail = String(tag ?? "").trim().toUpperCase().slice(-5);
  return /^\d+$/.test(tail) ? Number(tail) : Number.POSITIVE_INFINITY;
}

export function radLastFive(tag: string): string {
  const text = String(tag ?? "").trim().toUpperCase();
  return text.length <= 5 ? text : text.slice(-5);
}

/** The filter rides the tag's last five or the HBN. A scanned tag (longer
 * than five) also matches the whole tag. */
export function radFilterHit(q: string | null | undefined, hbn: string | null | undefined, tag: string | null | undefined): boolean {
  const typed = String(q ?? "").trim().toLowerCase();
  if (!typed) return true;
  if (String(hbn ?? "").toLowerCase().includes(typed)) return true;
  const full = String(tag ?? "").trim().toLowerCase();
  if (full.slice(-5).includes(typed)) return true;
  return typed.length > 5 && full.includes(typed);
}

export type RadAvailableRow = {
  tag: string;
  type: string;
  strain: string;
  quantityLabel: string;
  grams: number | null;
  lab: string;
  grow: string | null;
  harvest: string;
  hbnId: string | null;
  license: string;
  location: string | null;
  packagedDate: string | null;
  strainName: string;
};

export type RadRunPackageView = {
  id: string;
  tag: string;
  type: string;
  position: number;
  grams: number | null;
  lab: string | null;
  strain: string;
  quantityLabel: string;
};

export type RadRunView = {
  id: string;
  status: string;
  grey: number;
  scheduledAt: string;
  startedAt: string | null;
  completedAt: string | null;
  packages: RadRunPackageView[];
};

export type RadBoard = {
  q: string;
  available: RadAvailableRow[];
  scheduled: RadRunView[];
  done: RadRunView[];
  running: RadRunView[];
};

function stateRank(lab: string): number {
  const i = RAD_STATES.indexOf(lab as (typeof RAD_STATES)[number]);
  return i < 0 ? RAD_STATES.length : i;
}

function typeRank(type: string): number {
  const i = RAD_TYPES.indexOf(type as (typeof RAD_TYPES)[number]);
  return i < 0 ? RAD_TYPES.length : i;
}

function growSortKey(label: string | null): string {
  if (!label) return "2";
  const fixed = GROW_ORDER.indexOf(label);
  if (fixed >= 0) return `0${String(fixed).padStart(2, "0")}`;
  return `1${label.toLowerCase()}`;
}

export function compareRadAvailable(a: RadAvailableRow, b: RadAvailableRow): number {
  const state = stateRank(a.lab) - stateRank(b.lab);
  if (state) return state;
  const type = typeRank(a.type) - typeRank(b.type);
  if (type) return type;
  const grow = growSortKey(a.grow).localeCompare(growSortKey(b.grow));
  if (grow) return grow;
  const tail = radTail(a.tag) - radTail(b.tag);
  if (tail) return tail;
  return a.tag.localeCompare(b.tag);
}

function chunks<T>(rows: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < rows.length; i += size) out.push(rows.slice(i, i + size));
  return out;
}

function strainOf(item: string | null, named: string | null): string {
  const strain = String(named ?? "").trim();
  if (strain) return strain;
  return (String(item ?? "").split(" - ")[1] ?? "").trim();
}

function quantityLabel(uom: string | null, quantity: number | null, type: string, units: Readonly<Record<string, number>>): string {
  const qty = Number(quantity);
  if (!Number.isFinite(qty)) return "";
  const unit = String(uom ?? "").trim().toLowerCase();
  if (unit === "g") return `${formatGrams(roundGrams(qty))} g`;
  if (unit === "ea") {
    const grams = gatePackageGrams(uom, quantity, type, units);
    return grams == null ? `${qty} ea` : `${qty} ea (${formatGrams(grams)} g)`;
  }
  return `${qty} ${String(uom ?? "").trim()}`;
}

function growLabel(
  row: { harvest: string | null; hbnId: string | null },
  batchMethod: ReadonlyMap<string, string | null>,
  methods: readonly { display_name: string; hbn_code: string }[]
): string | null {
  const named = adoptGrowMethod(row, batchMethod, methods);
  if (named) return named;
  if (!row.harvest) return null;
  const parts = parseHbn(row.harvest);
  const code = parts?.grow_code?.trim().toUpperCase() ?? "";
  return code || null;
}

function adoptable(harvest: string | null, hbnId: string | null): boolean {
  if (!harvest) return false;
  if (hbnId) return true;
  return hbnFromMetrcName(harvest, null, "2026-01-01").ok;
}

async function parentHarvests(db: D1Database, tags: string[]): Promise<Map<string, { sourceHarvests: string | null }>> {
  const byTag = new Map<string, { sourceHarvests: string | null }>();
  for (const chunk of chunks(tags, 80)) {
    const found = await db
      .prepare(`SELECT tag, source_harvests FROM metrc_packages WHERE tag IN (${chunk.map(() => "?").join(", ")})`)
      .bind(...chunk)
      .all<{ tag: string; source_harvests: string | null }>();
    for (const parent of found.results ?? []) byTag.set(parent.tag.toUpperCase(), { sourceHarvests: parent.source_harvests });
  }
  return byTag;
}

function toAvailable(
  row: RadMirrorRow,
  lineage: { harvest: string; hbnId: string | null },
  grow: string | null,
  units: Readonly<Record<string, number>>
): RadAvailableRow {
  const type = gateItemType(row.item);
  const grams = gatePackageGrams(row.uom, row.quantity, type, units);
  return {
    tag: row.tag.toUpperCase(),
    type,
    strain: strainOf(row.item, row.item_strain),
    quantityLabel: quantityLabel(row.uom, row.quantity, type, units),
    grams,
    lab: String(row.lab_test_status ?? "").trim(),
    grow,
    harvest: lineage.harvest,
    hbnId: lineage.hbnId,
    license: row.license_value,
    location: row.location,
    packagedDate: row.packaged_date,
    strainName: strainOf(row.item, row.item_strain),
  };
}

/** Every live package of the six types in the three states that the adopt
 * precedent can mint, sorted as the doc asks. Open runs are not removed here. */
export async function listRadCatalog(db: D1Database): Promise<RadAvailableRow[]> {
  const [mirror, batches, methods, unitsRaw] = await Promise.all([
    listRadMirrorRows(db),
    listRadBatchGrows(db),
    listRadGrowMethods(db),
    getConfigValue(db, CONFIG_KEYS.gate_unit_grams),
  ]);
  const units = parseGateUnitGrams(unitsRaw);
  const types = new Set<string>(RAD_TYPES);
  const states = new Set<string>(RAD_STATES);
  const candidates = mirror.filter((row) => types.has(gateItemType(row.item)) && states.has(String(row.lab_test_status ?? "").trim()));
  const known = new Map(batches.map((row) => [row.hbn.trim().toUpperCase(), row.id]));
  const batchMethod = new Map(batches.map((row) => [row.id, row.grow_method]));
  const parentTags = [
    ...new Set(
      candidates
        .filter((row) => harvestTokens(row.source_harvests).length === 0)
        .flatMap((row) => harvestTokens(row.source_packages).map((tag) => tag.toUpperCase()))
    ),
  ];
  const byTag = await parentHarvests(db, parentTags);
  const rows: RadAvailableRow[] = [];
  for (const row of candidates) {
    const lineage = inheritedHarvest({ sourceHarvests: row.source_harvests, sourcePackages: row.source_packages }, byTag, known);
    if (!lineage || !adoptable(lineage.harvest, lineage.hbnId)) continue;
    rows.push(toAvailable(row, lineage, growLabel(lineage, batchMethod, methods), units));
  }
  rows.sort(compareRadAvailable);
  return rows;
}

/** The Available pane: the catalog minus tags on a scheduled or running run,
 * minus tags whose newest completed run recorded the lab state the mirror
 * still shows (the gate's fix, canon 0.30.328: a radded package is done until
 * METRC moves it; a changed state, a fail after a test say, lists it again). */
export async function listRadAvailable(db: D1Database): Promise<RadAvailableRow[]> {
  const [catalog, open, completed] = await Promise.all([listRadCatalog(db), listRadOpenTags(db), listRadCompletedStates(db)]);
  const held = new Set(open);
  return catalog.filter((row) => !held.has(row.tag) && completed.get(row.tag) !== row.lab);
}

export async function requireRadAvailable(db: D1Database, tag: string): Promise<RadAvailableRow> {
  const key = tag.trim().toUpperCase();
  const hit = (await listRadAvailable(db)).find((row) => row.tag === key);
  if (!hit) throw new HttpError(400, "That package is not available.");
  return hit;
}

/** The mirror row behind a tag already on a run, for completion's adopt.
 * Open-run membership does not exclude it. Null when the lineage cannot be minted. */
export async function radAdoptSource(db: D1Database, tag: string): Promise<RadAvailableRow | null> {
  const key = tag.trim().toUpperCase();
  const row = await db
    .prepare(
      `SELECT tag, license_value, source_harvests, source_packages, location, item, item_strain,
              quantity, uom, lab_test_status, packaged_date
       FROM metrc_packages WHERE UPPER(tag) = ? AND gone_at IS NULL`
    )
    .bind(key)
    .first<RadMirrorRow>();
  if (!row) return null;
  const [batches, methods, unitsRaw] = await Promise.all([
    listRadBatchGrows(db),
    listRadGrowMethods(db),
    getConfigValue(db, CONFIG_KEYS.gate_unit_grams),
  ]);
  const known = new Map(batches.map((batch) => [batch.hbn.trim().toUpperCase(), batch.id]));
  const batchMethod = new Map(batches.map((batch) => [batch.id, batch.grow_method]));
  const parents = harvestTokens(row.source_harvests).length === 0 ? harvestTokens(row.source_packages).map((item) => item.toUpperCase()) : [];
  const byTag = await parentHarvests(db, parents);
  const lineage = inheritedHarvest({ sourceHarvests: row.source_harvests, sourcePackages: row.source_packages }, byTag, known);
  if (!lineage || !adoptable(lineage.harvest, lineage.hbnId)) return null;
  return toAvailable(row, lineage, growLabel(lineage, batchMethod, methods), parseGateUnitGrams(unitsRaw));
}

function mirrorLabel(tag: string, stored: RadPackageRecord, catalog: Map<string, RadAvailableRow>): { strain: string; quantityLabel: string } {
  const live = catalog.get(tag);
  if (live) return { strain: live.strain, quantityLabel: live.quantityLabel };
  const grams = stored.grams == null ? "" : `${formatGrams(stored.grams)} g`;
  return { strain: "", quantityLabel: grams };
}

async function runViews(db: D1Database, now: string): Promise<{ scheduled: RadRunView[]; done: RadRunView[]; running: RadRunView[] }> {
  const [runs, packages, catalog, startRaw] = await Promise.all([
    listRadRunRecords(db),
    listRadPackageRecords(db),
    listRadCatalog(db),
    getConfigValue(db, CONFIG_KEYS.farm_day_start_hour),
  ]);
  const byTag = new Map(catalog.map((row) => [row.tag, row]));
  const byRun = new Map<string, RadRunPackageView[]>();
  for (const pkg of packages) {
    const tag = pkg.tag.toUpperCase();
    const label = mirrorLabel(tag, pkg, byTag);
    const view: RadRunPackageView = {
      id: pkg.id,
      tag,
      type: String(pkg.item_type ?? "").toUpperCase(),
      position: Number(pkg.position),
      grams: pkg.grams == null ? null : Number(pkg.grams),
      lab: pkg.lab_test_status,
      strain: label.strain,
      quantityLabel: label.quantityLabel,
    };
    const list = byRun.get(pkg.run_id) ?? [];
    list.push(view);
    byRun.set(pkg.run_id, list);
  }
  const since = dryingCompleteSince(now, parseFarmDayStartHour(startRaw));
  const scheduled: RadRunView[] = [];
  const done: RadRunView[] = [];
  const running: RadRunView[] = [];
  for (const run of runs) {
    const view: RadRunView = {
      id: run.id,
      status: run.status,
      grey: Number(run.grey),
      scheduledAt: run.scheduled_at,
      startedAt: run.started_at,
      completedAt: run.completed_at,
      packages: (byRun.get(run.id) ?? []).sort((a, b) => a.position - b.position || a.tag.localeCompare(b.tag)),
    };
    if (run.status === RAD_RUN_STATUS.scheduled) scheduled.push(view);
    else if (run.status === RAD_RUN_STATUS.running) running.push(view);
    else if (run.status === RAD_RUN_STATUS.complete && run.completed_at && run.completed_at >= since) done.push(view);
  }
  return { scheduled, done, running };
}

export async function loadRadBoard(db: D1Database, q = ""): Promise<RadBoard> {
  const [available, views] = await Promise.all([listRadAvailable(db), runViews(db, nowIso())]);
  return { q: String(q ?? ""), available, ...views };
}

function stamp(label: string, iso: string | null, locale: Locale): string {
  if (!iso) return "";
  return `<div data-rad-stamp="${esc(label)}"><span class="muted">${esc(t(locale, label))}</span> <time datetime="${esc(iso)}">${esc(etWallClock(iso))}</time></div>`;
}

function elapsed(run: RadRunView): string {
  if (!run.startedAt || !run.completedAt) return "";
  const seconds = (Date.parse(run.completedAt) - Date.parse(run.startedAt)) / 1000;
  if (!Number.isFinite(seconds)) return "";
  return formatClock(seconds);
}

function greySelect(run: RadRunView, q: string, locale: Locale): string {
  const options = RAD_GREYS.map((n) => `<option value="${n}"${n === run.grey ? " selected" : ""}>${n}</option>`).join("");
  return `<form method="post" action="${RAD_SCHEDULE_PATH}/run/${esc(run.id)}/grey" class="rad-grey" data-rad-grey>
      <input type="hidden" name="q" value="${esc(q)}">
      <label class="field">${esc(t(locale, "Grey (Gy)"))} <select name="grey">${options}</select></label>
      <button type="submit">${esc(t(locale, "Save"))}</button>
    </form>`;
}

function packageLine(run: RadRunView, pkg: RadRunPackageView, q: string, locale: Locale, removable: boolean): string {
  const back = removable
    ? `<form method="post" action="${RAD_SCHEDULE_PATH}/run/${esc(run.id)}/package/${esc(pkg.id)}/unschedule" class="shuttle-form">
        <input type="hidden" name="q" value="${esc(q)}">
        <button type="submit" class="shuttle-btn" title="${esc(t(locale, "Unschedule"))}" aria-label="${esc(t(locale, "Unschedule"))}">&lt;</button>
      </form>`
    : "";
  return `<li data-rad-package="${esc(pkg.id)}" data-rad-tag="${esc(pkg.tag)}">
      <span class="muted">${esc(String(pkg.position))}</span>
      <span title="${esc(pkg.tag)}">${esc(radLastFive(pkg.tag))}</span>
      <span>${esc(pkg.type)}</span>
      <span>${esc(pkg.strain)}</span>
      <span>${esc(pkg.quantityLabel)}</span>
      ${back}
    </li>`;
}

function countLine(n: number, locale: Locale): string {
  return `<p data-rad-count>${esc(tFill(locale, "{n} of {limit}", { n: String(n), limit: String(RAD_RUN_LIMIT) }))}</p>`;
}

function scheduleCard(run: RadRunView, q: string, locale: Locale): string {
  const packages = run.packages.map((pkg) => packageLine(run, pkg, q, locale, true)).join("");
  const remove =
    run.packages.length === 0
      ? `<form method="post" action="${RAD_SCHEDULE_PATH}/run/${esc(run.id)}/remove">
          <input type="hidden" name="q" value="${esc(q)}">
          <button type="submit">${esc(t(locale, "Remove run"))}</button>
        </form>`
      : "";
  return `<article class="rad-card" data-rad-run="${esc(run.id)}" data-rad-status="scheduled">
      ${stamp("Scheduled", run.scheduledAt, locale)}
      ${greySelect(run, q, locale)}
      ${countLine(run.packages.length, locale)}
      <ol class="rad-packages">${packages}</ol>
      ${remove}
    </article>`;
}

function doneCard(run: RadRunView, locale: Locale): string {
  const packages = run.packages.map((pkg) => packageLine(run, pkg, "", locale, false)).join("");
  return `<article class="rad-card" data-rad-run="${esc(run.id)}" data-rad-status="complete">
      <p data-rad-grey-read>${esc(t(locale, "Grey (Gy)"))} ${esc(String(run.grey))}</p>
      ${stamp("Started", run.startedAt, locale)}
      ${stamp("Completed", run.completedAt, locale)}
      <ol class="rad-packages">${packages}</ol>
      <p data-rad-ready>${esc(t(locale, "ready for testing"))}</p>
    </article>`;
}

const FILTER_SCRIPT = `<script>
(function () {
  var box = document.querySelector("[data-rad-filter]");
  if (!box) return;
  function hit(q, hbn, tag) {
    if (!q) return true;
    var full = String(tag || "").trim().toLowerCase();
    if (String(hbn || "").toLowerCase().indexOf(q) >= 0) return true;
    if (full.slice(-5).indexOf(q) >= 0) return true;
    return q.length > 5 && full.indexOf(q) >= 0;
  }
  function apply() {
    var q = box.value.trim().toLowerCase();
    document.querySelectorAll("[data-rad-pane=available] [data-rad-tag]").forEach(function (row) {
      if (hit(q, row.getAttribute("data-rad-hbn"), row.getAttribute("data-rad-tag"))) row.removeAttribute("hidden");
      else row.setAttribute("hidden", "");
    });
    document.querySelectorAll("input[data-rad-q]").forEach(function (input) { input.value = box.value.trim(); });
    var url = new URL(window.location.href);
    if (box.value.trim()) url.searchParams.set("q", box.value.trim()); else url.searchParams.delete("q");
    url.searchParams.delete("ok");
    window.history.replaceState(null, "", url.toString());
  }
  box.addEventListener("input", apply);
})();
</script>`;

function flashLine(ok: string, locale: Locale): string {
  const key =
    ok === "scheduled"
      ? "Package scheduled."
      : ok === "grey"
        ? "Grey saved."
        : ok === "started"
          ? "Run started."
          : ok === "unstarted"
            ? "Run unstarted."
            : ok === "completed"
              ? "Run completed."
              : ok === "reopened"
                ? "Run reopened."
                : ok === "start_time"
                  ? "Start time saved."
                  : "";
  if (!key) return "";
  return `<p class="flash ok" data-rad-flash>${esc(t(locale, key))}</p>`;
}

function qHidden(q: string): string {
  return `<input type="hidden" name="q" value="${esc(q)}" data-rad-q>`;
}

export function radSchedulePage(board: RadBoard, locale: Locale, ok = ""): string {
  const rows = board.available
    .map((row) => {
      const hit = radFilterHit(board.q, row.harvest, row.tag);
      const grow = row.grow ?? t(locale, "Unknown");
      return `<li class="schedule-item" data-rad-tag="${esc(row.tag)}" data-rad-hbn="${esc(row.harvest)}" data-rad-state="${esc(row.lab)}" data-rad-type="${esc(row.type)}" data-rad-grow="${esc(row.grow ?? "")}"${hit ? "" : " hidden"}>
        <span title="${esc(row.tag)}">${esc(radLastFive(row.tag))}</span>
        <span>${esc(row.type)}</span>
        <span>${esc(row.strain)}</span>
        <span>${esc(row.quantityLabel)}</span>
        <span>${esc(row.lab)}</span>
        <span>${esc(grow)}</span>
        <form method="post" action="${RAD_SCHEDULE_PATH}/schedule" class="shuttle-form">
          ${qHidden(board.q)}
          <input type="hidden" name="tag" value="${esc(row.tag)}">
          <button type="submit" class="shuttle-btn" title="${esc(t(locale, "Schedule"))}" aria-label="${esc(t(locale, "Schedule"))}">&gt;&gt;</button>
        </form>
      </li>`;
    })
    .join("");
  const available = rows || `<p class="muted">${esc(t(locale, "- EMPTY -"))}</p>`;
  const scheduled = board.scheduled.map((run) => scheduleCard(run, board.q, locale)).join("") || `<p class="muted">${esc(t(locale, "- EMPTY -"))}</p>`;
  const done = board.done.map((run) => doneCard(run, locale)).join("") || `<p class="muted">${esc(t(locale, "- EMPTY -"))}</p>`;
  return `<h1>${esc(t(locale, "Rad Schedule"))}</h1>
    ${flashLine(ok, locale)}
    <form method="get" action="${RAD_SCHEDULE_PATH}" class="schedule-filter">
      <label class="field">${esc(t(locale, "Filter"))}
        <input type="search" name="q" value="${esc(board.q)}" data-rad-filter autocomplete="off">
      </label>
    </form>
    <div class="station-triple" data-rad-schedule>
      <aside class="queue-pane" data-rad-pane="available">
        <h2>${esc(t(locale, "Rad Schedule available"))}</h2>
        <ul>${available}</ul>
      </aside>
      <section class="queue-pane" data-rad-pane="scheduled">
        <h2>${esc(t(locale, "Rad Schedule scheduled"))}</h2>
        <form method="post" action="${RAD_SCHEDULE_PATH}/run">
          ${qHidden(board.q)}
          <button type="submit">${esc(t(locale, "New run"))}</button>
        </form>
        ${scheduled}
      </section>
      <aside class="queue-pane" data-rad-pane="done">
        <h2>${esc(t(locale, "Rad Schedule done"))}</h2>
        ${done}
      </aside>
    </div>
    ${FILTER_SCRIPT}`;
}

function operationScheduled(run: RadRunView, locale: Locale): string {
  const packages = run.packages.map((pkg) => packageLine(run, pkg, "", locale, false)).join("");
  return `<article class="rad-card" data-rad-run="${esc(run.id)}" data-rad-status="scheduled">
      <p data-rad-grey-read>${esc(t(locale, "Grey (Gy)"))} ${esc(String(run.grey))}</p>
      ${stamp("Scheduled", run.scheduledAt, locale)}
      ${countLine(run.packages.length, locale)}
      <ol class="rad-packages">${packages}</ol>
      <form method="post" action="${RAD_OPERATION_PATH}/run/${esc(run.id)}/start" class="shuttle-form">
        <button type="submit" class="shuttle-btn" title="${esc(t(locale, "Start"))}" aria-label="${esc(t(locale, "Start"))}">&gt;&gt;</button>
      </form>
    </article>`;
}

function operationRunning(run: RadRunView, locale: Locale): string {
  const packages = run.packages.map((pkg) => packageLine(run, pkg, "", locale, false)).join("");
  const startedMs = run.startedAt ? Date.parse(run.startedAt) : 0;
  const text = formatClock(startedMs ? Math.max(0, (Date.now() - startedMs) / 1000) : 0);
  // THE RAD START TIME (canon 0.30.330): the clock and the Start Time box share
  // one line; the box is prefilled with the start in farm time on the 12-hour
  // clock, and the server resolves what is typed on the run's farm day.
  const clock12 = etClock12(run.startedAt ?? "");
  const boxId = `rad-start-time-${run.id}`;
  return `<article class="rad-card" data-rad-run="${esc(run.id)}" data-rad-status="running">
      <p data-rad-grey-read>${esc(t(locale, "Grey (Gy)"))} ${esc(String(run.grey))}</p>
      ${stamp("Scheduled", run.scheduledAt, locale)}
      ${stamp("Started", run.startedAt, locale)}
      <div class="rad-start-line" data-rad-start-line>
        <span class="silo-clock" data-clock data-state="running" data-started="${esc(String(startedMs))}" data-paused-at="" data-paused-seconds="0">${esc(text)}</span>
        <form method="post" action="${RAD_OPERATION_PATH}/run/${esc(run.id)}/start_time" class="rad-start-form" data-rad-start-time>
          <label class="muted" for="${esc(boxId)}">${esc(t(locale, "Start Time"))}</label>
          <input type="text" id="${esc(boxId)}" name="start_time" value="${esc(clock12.hhmm)}" placeholder="HH:MM" inputmode="numeric" pattern="(0[1-9]|1[0-2]):[0-5][0-9]" maxlength="5" autocomplete="off" data-time12-mask>
          <select name="meridiem" aria-label="${esc(t(locale, "Start Time"))}">
            <option value="AM"${clock12.meridiem === "AM" ? " selected" : ""}>${esc(t(locale, "AM"))}</option>
            <option value="PM"${clock12.meridiem === "PM" ? " selected" : ""}>${esc(t(locale, "PM"))}</option>
          </select>
          <button type="submit">${esc(t(locale, "Save"))}</button>
        </form>
      </div>
      ${countLine(run.packages.length, locale)}
      <ol class="rad-packages">${packages}</ol>
      <form method="post" action="${RAD_OPERATION_PATH}/run/${esc(run.id)}/unstart" class="shuttle-form">
        <button type="submit" class="shuttle-btn" title="${esc(t(locale, "Unstart"))}" aria-label="${esc(t(locale, "Unstart"))}">&lt;&lt;</button>
      </form>
      <form method="post" action="${RAD_OPERATION_PATH}/run/${esc(run.id)}/complete" class="shuttle-form">
        <button type="submit" class="shuttle-btn" title="${esc(t(locale, "Rad complete"))}" aria-label="${esc(t(locale, "Rad complete"))}">&gt;&gt;</button>
      </form>
    </article>`;
}

function operationCompleted(run: RadRunView, locale: Locale): string {
  const packages = run.packages.map((pkg) => packageLine(run, pkg, "", locale, false)).join("");
  const ran = elapsed(run);
  return `<article class="rad-card" data-rad-run="${esc(run.id)}" data-rad-status="complete">
      <p data-rad-grey-read>${esc(t(locale, "Grey (Gy)"))} ${esc(String(run.grey))}</p>
      ${stamp("Scheduled", run.scheduledAt, locale)}
      ${stamp("Started", run.startedAt, locale)}
      ${stamp("Completed", run.completedAt, locale)}
      ${ran ? `<p data-rad-elapsed>${esc(ran)}</p>` : ""}
      <ol class="rad-packages">${packages}</ol>
      <form method="post" action="${RAD_OPERATION_PATH}/run/${esc(run.id)}/reopen" class="shuttle-form">
        <label class="field">${esc(t(locale, "Admin PIN"))} <input type="password" name="unfinish_pin" inputmode="numeric" autocomplete="off"></label>
        <button type="submit" class="shuttle-btn" title="${esc(t(locale, "Reopen"))}" aria-label="${esc(t(locale, "Reopen"))}">&lt;&lt;</button>
      </form>
    </article>`;
}

export function radOperationPage(board: RadBoard, locale: Locale, ok = ""): string {
  const scheduled = board.scheduled.filter((run) => run.packages.length > 0).map((run) => operationScheduled(run, locale)).join("") || `<p class="muted">${esc(t(locale, "- EMPTY -"))}</p>`;
  const running = board.running.map((run) => operationRunning(run, locale)).join("") || `<p class="muted">${esc(t(locale, "- EMPTY -"))}</p>`;
  const completed = board.done.map((run) => operationCompleted(run, locale)).join("") || `<p class="muted">${esc(t(locale, "- EMPTY -"))}</p>`;
  return `<h1>${esc(t(locale, "Rad Operation"))}</h1>
    ${flashLine(ok, locale)}
    <div class="station-triple" data-rad-operation>
      <aside class="queue-pane" data-rad-pane="scheduled">
        <h2>${esc(t(locale, "Rad Schedule scheduled"))}</h2>
        ${scheduled}
      </aside>
      <section class="queue-pane" data-rad-pane="running">
        <h2>${esc(t(locale, "Running in the Rad"))}</h2>
        ${running}
      </section>
      <aside class="queue-pane" data-rad-pane="completed">
        <h2>${esc(t(locale, "Rad Schedule completed"))}</h2>
        ${completed}
      </aside>
    </div>
    ${clockScript()}${time12MaskScript()}`;
}
