/**
 * THE MAINTENANCE NODE (canon 0.30.293). The check clock runs from the load's
 * loaded_at and from each request's stamp. A paused drying clock does not
 * pause it. Past the end of an interval list, the last interval repeats.
 */

import { HttpError, nowIso, textOrNull } from "./audit";
import { internalCheckKind } from "./compliance";
import { shortLotId } from "./config";
import { consoleIconSvg } from "./consoleicons";
import { insertLog, requireActor } from "./db";
import { etDate, etWallClock } from "./farmday";
import { t, tFill, type Locale } from "./i18n";
import { spaceTypeOf, type SpaceLike } from "./silo";
import { esc } from "./ui";

export const MAINTENANCE_PATH = "/maintenance";
export const LAB_SAMPLE_PATH = "/maintenance/lab_sample";
export const TROUBLE_TICKETS_PATH = "/maintenance/trouble_tickets";
export const SILO_CHECK_INTERVALS_PATH = "/admin/lookups/silo_check_intervals";

export const CHECK_KINDS = ["aw", "mc"] as const;
export type CheckKind = (typeof CHECK_KINDS)[number];

export const INTERVAL_CATEGORY: Record<CheckKind, string> = {
  aw: "silo_check_interval_aw",
  mc: "silo_check_interval_mc",
};

export const CHECK_ANALYTE: Record<CheckKind, string> = {
  aw: "water activity",
  mc: "moisture content",
};

const KIND_LABEL: Record<CheckKind, string> = { aw: "aW", mc: "MC" };

export type NextCheck = { checkNumber: number; dueAt: string };

/** The next check. hours empty means this kind is not in use. n is how many
 * requests already have a stamp. Due is loaded_at plus the first interval
 * when n is 0, else the last stamp plus h[min(n, last index)]. pausedAt is
 * accepted and ignored: a paused drying clock does not move the schedule. */
export function nextCheckDue(input: {
  loadedAt: string;
  requestedAts: readonly string[];
  hours: readonly number[];
  pausedAt?: string | null;
}): NextCheck | null {
  void input.pausedAt;
  const hours = input.hours.filter((n) => Number.isFinite(n) && n >= 0);
  if (hours.length === 0) return null;
  const stamps = input.requestedAts.filter((stamp) => Number.isFinite(Date.parse(stamp)));
  const n = stamps.length;
  const lastIndex = hours.length - 1;
  const base = n === 0 ? input.loadedAt : stamps[stamps.length - 1];
  const step = n === 0 ? hours[0] : hours[Math.min(n, lastIndex)];
  const dueMs = Date.parse(base) + step * 3_600_000;
  if (!Number.isFinite(dueMs)) return null;
  return { checkNumber: n + 1, dueAt: new Date(dueMs).toISOString() };
}

export function earliestByDue<T extends { dueAt: string }>(rows: readonly T[]): T | null {
  if (rows.length === 0) return null;
  return rows.reduce((best, row) => (row.dueAt < best.dueAt ? row : best));
}

export type IntervalRow = { id: string; value: string; sort_order: number };

export function intervalHours(rows: readonly IntervalRow[]): number[] {
  return [...rows]
    .sort((a, b) => a.sort_order - b.sort_order || a.value.localeCompare(b.value))
    .map((row) => Number(String(row.value).trim()))
    .filter((n) => Number.isInteger(n) && n >= 0);
}

export type LoadCheckView = {
  loadId: string;
  kind: CheckKind;
  lot: string;
  checkNumber: number;
  dueAt: string;
};

export function countdownText(dueAt: string, nowIsoText: string): string {
  const ms = Date.parse(dueAt) - Date.parse(nowIsoText);
  const seconds = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(seconds / 86400);
  const rem = seconds % 86400;
  const hh = String(Math.floor(rem / 3600)).padStart(2, "0");
  const mm = String(Math.floor((rem % 3600) / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");
  return `${days}d ${hh}:${mm}:${ss}`;
}

function kindOf(raw: string | null | undefined): CheckKind | null {
  return raw === "aw" || raw === "mc" ? raw : null;
}

/** One check line: the countdown, and the siren hidden until the due instant. */
export function checkLineMarkup(check: LoadCheckView, nowIsoText: string, locale: Locale = "en", summary = false): string {
  const dueMs = Date.parse(check.dueAt);
  const nowMs = Date.parse(nowIsoText);
  const alarm = Number.isFinite(dueMs) && Number.isFinite(nowMs) && dueMs <= nowMs;
  const dueWord = check.kind === "aw" ? "aW check due" : "MC check due";
  const nextWord = check.kind === "aw" ? "Next aW check in" : "Next MC check in";
  const lot = summary ? ` &middot; <span data-check-lot>${esc(t(locale, "Lot"))} ${esc(check.lot)}</span>` : "";
  // The words in order: the countdown, then which check, then the lot when the space holds several.
  const which = `<span data-check-which>${esc(tFill(locale, "Check {n}", { n: "{n}" })).replace(
    "{n}",
    `<span data-check-n>${esc(String(check.checkNumber))}</span>`
  )}</span>`;
  return `<div class="check-line" data-check-line data-kind="${esc(check.kind)}" data-load="${esc(check.loadId)}" data-due="${esc(
    String(dueMs)
  )}"${summary ? ` data-check-summary="1"` : ""}>
      <span data-countdown${alarm ? " hidden" : ""}>${esc(t(locale, nextWord))} <span data-countdown-read>${esc(
        countdownText(check.dueAt, nowIsoText)
      )}</span> &middot; ${which}${lot}</span>
      <span class="hc-siren" data-check-siren${alarm ? "" : " hidden"}>${consoleIconSvg("siren", { label: t(locale, dueWord) })} ${esc(
        t(locale, dueWord)
      )} &middot; ${which}${lot}</span>
    </div>`;
}

/** The tile's line: the earliest due of that kind, naming the lot when several loads share the space. */
export function tileCheckSummary(checks: readonly LoadCheckView[], nowIsoText: string, locale: Locale = "en"): string {
  const lines: string[] = [];
  for (const kind of CHECK_KINDS) {
    const mine = checks.filter((row) => row.kind === kind);
    const loads = new Set(mine.map((row) => row.loadId));
    if (loads.size < 2) continue;
    const earliest = earliestByDue(mine);
    if (earliest) lines.push(checkLineMarkup(earliest, nowIsoText, locale, true));
  }
  return lines.join("");
}

export function loadCheckLines(checks: readonly LoadCheckView[], loadId: string, nowIsoText: string, locale: Locale = "en"): string {
  return checks
    .filter((row) => row.loadId === loadId)
    .map((row) => checkLineMarkup(row, nowIsoText, locale, false))
    .join("");
}

/** Swaps a check line to its siren the moment the countdown reaches zero. */
export function checkCountdownScript(): string {
  return `<script>
(function () {
  function read(ms) {
    var seconds = Math.max(0, Math.floor(ms / 1000));
    var days = Math.floor(seconds / 86400);
    var rem = seconds % 86400;
    var pad = function (n) { return String(n).padStart(2, "0"); };
    return days + "d " + pad(Math.floor(rem / 3600)) + ":" + pad(Math.floor((rem % 3600) / 60)) + ":" + pad(seconds % 60);
  }
  function tick() {
    var now = Date.now();
    document.querySelectorAll("[data-check-line]").forEach(function (line) {
      var due = Number(line.getAttribute("data-due"));
      var count = line.querySelector("[data-countdown]");
      var siren = line.querySelector("[data-check-siren]");
      var readEl = line.querySelector("[data-countdown-read]");
      if (!count || !siren) return;
      if (!isFinite(due) || due <= now) {
        count.hidden = true;
        siren.hidden = false;
      } else {
        count.hidden = false;
        siren.hidden = true;
        if (readEl) readEl.textContent = read(due - now);
      }
    });
  }
  tick();
  setInterval(tick, 1000);
})();
</script>`;
}

type RequestStamp = { silo_load_id: string; kind: string; requested_at: string };
async function intervalLists(db: D1Database): Promise<Record<CheckKind, number[]>> {
  const rows = await db
    .prepare(
      `SELECT category, value, sort_order FROM lookup_values
       WHERE deleted_at IS NULL AND category IN (?, ?)
       ORDER BY sort_order, value`
    )
    .bind(INTERVAL_CATEGORY.aw, INTERVAL_CATEGORY.mc)
    .all<{ category: string; value: string; sort_order: number }>();
  const grouped: Record<CheckKind, IntervalRow[]> = { aw: [], mc: [] };
  for (const row of rows.results ?? []) {
    const kind = row.category === INTERVAL_CATEGORY.mc ? "mc" : row.category === INTERVAL_CATEGORY.aw ? "aw" : null;
    if (!kind) continue;
    grouped[kind].push({ id: "", value: row.value, sort_order: Number(row.sort_order) });
  }
  return { aw: intervalHours(grouped.aw), mc: intervalHours(grouped.mc) };
}

async function stampsByLoad(db: D1Database): Promise<Map<string, string[]>> {
  const rows = await db
    .prepare(
      `SELECT silo_load_id, kind, requested_at FROM lab_sample_requests
       WHERE deleted_at IS NULL AND requested_at IS NOT NULL
       ORDER BY requested_at, id`
    )
    .all<RequestStamp>();
  const map = new Map<string, string[]>();
  for (const row of rows.results ?? []) {
    const key = `${row.silo_load_id}|${row.kind}`;
    const list = map.get(key) ?? [];
    list.push(row.requested_at);
    map.set(key, list);
  }
  return map;
}

/** The day an instrument row was tested, for the after-the-request test: the farm's calendar day of a
 * zoned instant, the date as the file wrote it when it carries no zone, null when it carries no date
 * (the imports store "unknown" then). A string compare against an ISO stamp is not a date compare. */
export function testedDayOf(raw: string | null | undefined): string | null {
  const text = (raw ?? "").trim();
  const lead = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (lead) {
    const zoned = /[T ]\d{2}:\d{2}/.test(text) && /(Z|[+-]\d{2}:?\d{2})$/i.test(text);
    if (zoned) {
      const ms = Date.parse(text.replace(" ", "T"));
      if (Number.isFinite(ms)) return etDate(new Date(ms).toISOString());
    }
    return `${lead[1]}-${lead[2]}-${lead[3]}`;
  }
  const ms = Date.parse(text);
  if (!Number.isFinite(ms)) return null;
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** True when an instrument row can answer a request: its day is the request's farm day or later. */
export function testedAfterRequest(testedAt: string | null | undefined, requestedAt: string): boolean {
  const day = testedDayOf(testedAt);
  return day != null && day >= etDate(requestedAt);
}

export async function fulfillFromInstruments(db: D1Database, atIso: string): Promise<number> {
  const waiting = await db
    .prepare(
      `SELECT req.id, req.kind, req.requested_at, b.hbn
       FROM lab_sample_requests req
       JOIN wet_weight_entries w ON w.id = req.wet_weight_entry_id
       JOIN harvest_batches b ON b.id = w.harvest_batch_id
       WHERE req.deleted_at IS NULL AND req.status = 'requested' AND req.requested_at IS NOT NULL`
    )
    .all<{ id: string; kind: string; requested_at: string; hbn: string | null }>();
  const pending = waiting.results ?? [];
  if (pending.length === 0) return 0;
  const results = await db
    .prepare(
      `SELECT id, hbn, analyte, value, unit, tested_at FROM internal_test_results
       WHERE deleted_at IS NULL AND tested_at IS NOT NULL
       ORDER BY tested_at, id`
    )
    .all<{ id: string; hbn: string | null; analyte: string; value: number; unit: string; tested_at: string }>();
  const found = results.results ?? [];
  const linked = await db
    .prepare(`SELECT internal_test_result_id AS id FROM lab_sample_requests WHERE internal_test_result_id IS NOT NULL`)
    .all<{ id: string }>();
  const used = new Set((linked.results ?? []).map((row) => row.id));
  const stmts = [];
  let n = 0;
  for (const req of pending) {
    const kind = kindOf(req.kind);
    if (!kind || !req.hbn) continue;
    const hit = found.find(
      (row) => !used.has(row.id) && row.hbn === req.hbn && internalCheckKind(row.analyte) === kind && testedAfterRequest(row.tested_at, req.requested_at)
    );
    if (!hit) continue;
    used.add(hit.id);
    stmts.push(
      db
        .prepare(
          `UPDATE lab_sample_requests
           SET status = 'fulfilled', fulfilled_at = ?, result_value = ?, result_unit = ?, internal_test_result_id = ?, updated_at = ?
           WHERE id = ? AND deleted_at IS NULL AND status = 'requested'`
        )
        .bind(atIso, hit.value, hit.unit, hit.id, atIso, req.id),
      insertLog(db, {
        record_table: "lab_sample_requests",
        record_id: req.id,
        field: "status",
        old_value: "requested",
        new_value: "fulfilled",
        actor_person_id: null,
        reason: "instrument result",
        changed_at: atIso,
      })
    );
    n += 1;
  }
  if (stmts.length) await db.batch(stmts);
  return n;
}

export type LoadForCheck = {
  id: string;
  loaded_at: string;
  hbn: string | null;
  paused_at?: string | null;
};

export async function checksForLoads(db: D1Database, loads: readonly LoadForCheck[]): Promise<Map<string, LoadCheckView[]>> {
  const [hours, stamps] = await Promise.all([intervalLists(db), stampsByLoad(db)]);
  const out = new Map<string, LoadCheckView[]>();
  for (const load of loads) {
    const lines: LoadCheckView[] = [];
    for (const kind of CHECK_KINDS) {
      if (hours[kind].length === 0) continue;
      const due = nextCheckDue({
        loadedAt: load.loaded_at,
        requestedAts: stamps.get(`${load.id}|${kind}`) ?? [],
        hours: hours[kind],
        pausedAt: load.paused_at ?? null,
      });
      if (!due) continue;
      lines.push({
        loadId: load.id,
        kind,
        lot: shortLotId(load.hbn ?? "", null),
        checkNumber: due.checkNumber,
        dueAt: due.dueAt,
      });
    }
    out.set(load.id, lines);
  }
  return out;
}

type SiloLike = { loads: LoadForCheck[]; silo?: SpaceLike };

/** THE SILOS ONLY (canon 0.30.299). The maintenance screen draws the spaces
 * whose spaceTypeOf is silo. A dry room and a freezer stay off it. A new
 * silo joins by that answer, not by its name. */
export function maintenanceSpaces<T extends { silo: SpaceLike }>(live: readonly T[]): T[] {
  return live.filter((row) => spaceTypeOf(row.silo) === "silo");
}

function spaceIsSilo(space: SpaceLike | undefined): boolean {
  return spaceTypeOf(space ?? {}) === "silo";
}

/** Lines for silo loads only. A dry room or a freezer takes an empty list:
 * no countdown and no siren on any page, and an empty checks array in live.json. */
export async function attachLoadChecks<T extends SiloLike>(db: D1Database, live: readonly T[], atIso: string): Promise<(T & { loadChecks: LoadCheckView[] })[]> {
  await fulfillFromInstruments(db, atIso);
  const loads = live.filter((space) => spaceIsSilo(space.silo)).flatMap((space) => space.loads);
  const byLoad = await checksForLoads(db, loads);
  return live.map((space) => ({
    ...space,
    loadChecks: spaceIsSilo(space.silo) ? space.loads.flatMap((load) => byLoad.get(load.id) ?? []) : [],
  }));
}

export type LiveCheck = { kind: CheckKind; lot: string; checkNumber: number; dueAt: string; loadId: string };

export function liveChecksOf(checks: readonly LoadCheckView[]): LiveCheck[] {
  return checks.map((row) => ({
    kind: row.kind,
    lot: row.lot,
    checkNumber: row.checkNumber,
    dueAt: row.dueAt,
    loadId: row.loadId,
  }));
}

type LabRow = {
  id: string;
  silo_load_id: string;
  dry_space_id: string;
  wet_weight_entry_id: string;
  kind: string;
  check_number: number;
  status: string;
  requested_at: string | null;
  fulfilled_at: string | null;
  result_value: number | null;
  result_unit: string | null;
  internal_test_result_id: string | null;
  space_name: string | null;
  hbn: string | null;
  strain_label: string | null;
  loaded_at: string;
  paused_at: string | null;
};

async function labRows(db: D1Database): Promise<LabRow[]> {
  const rows = await db
    .prepare(
      `SELECT req.id, req.silo_load_id, req.dry_space_id, req.wet_weight_entry_id, req.kind, req.check_number, req.status,
              req.requested_at, req.fulfilled_at, req.result_value, req.result_unit, req.internal_test_result_id,
              d.name AS space_name, b.hbn, COALESCE(b.market_strain, s.name) AS strain_label, l.loaded_at, l.paused_at
       FROM lab_sample_requests req
       JOIN silo_loads l ON l.id = req.silo_load_id AND l.deleted_at IS NULL
       LEFT JOIN dry_spaces d ON d.id = req.dry_space_id
       LEFT JOIN wet_weight_entries w ON w.id = req.wet_weight_entry_id
       LEFT JOIN harvest_batches b ON b.id = w.harvest_batch_id
       LEFT JOIN strains s ON s.id = b.strain_id
       WHERE req.deleted_at IS NULL
       ORDER BY req.created_at, req.id`
    )
    .all<LabRow>();
  return rows.results ?? [];
}

async function dryingLoads(db: D1Database): Promise<Array<LoadForCheck & { space_name: string | null; strain_label: string | null; dry_space_id: string; wet_weight_entry_id: string }>> {
  const rows = await db
    .prepare(
      `SELECT l.id, l.loaded_at, l.paused_at, l.dry_space_id, l.wet_weight_entry_id, d.name AS space_name, d.space_type, d.shape, b.hbn,
              COALESCE(b.market_strain, s.name) AS strain_label
       FROM silo_loads l
       JOIN dry_spaces d ON d.id = l.dry_space_id AND d.deleted_at IS NULL
       JOIN wet_weight_entries w ON w.id = l.wet_weight_entry_id AND w.deleted_at IS NULL
       LEFT JOIN harvest_batches b ON b.id = w.harvest_batch_id
       LEFT JOIN strains s ON s.id = b.strain_id
       WHERE l.deleted_at IS NULL AND l.ended_at IS NULL
       ORDER BY d.name, l.loaded_at`
    )
    .all<LoadForCheck & { space_name: string | null; strain_label: string | null; dry_space_id: string; wet_weight_entry_id: string; space_type: string | null; shape: string | null }>();
  return (rows.results ?? []).filter((row) => spaceTypeOf(row) === "silo");
}

function rowTitle(space: string | null, hbn: string | null, locale: Locale): string {
  return `${space || t(locale, "Silo")} / ${t(locale, "Lot")} ${shortLotId(hbn ?? "", null)}`;
}

export async function labSamplePage(db: D1Database, atIso: string, locale: Locale = "en"): Promise<string> {
  await fulfillFromInstruments(db, atIso);
  const [loads, requests] = await Promise.all([dryingLoads(db), labRows(db)]);
  const byLoad = await checksForLoads(db, loads);
  const inflight = new Set(requests.filter((row) => row.status === "scheduled" || row.status === "requested").map((row) => `${row.silo_load_id}|${row.kind}`));
  const left = loads
    .flatMap((load) =>
      (byLoad.get(load.id) ?? [])
        .filter((line) => !inflight.has(`${load.id}|${line.kind}`))
        .map((line) => ({ load, line }))
    )
    .map(({ load, line }) => {
      return `<li data-lab-row="drying" data-load="${esc(load.id)}" data-kind="${esc(line.kind)}">
        <p>${esc(rowTitle(load.space_name, load.hbn, locale))} <span class="muted">${esc(load.strain_label ?? "")}</span> ${esc(KIND_LABEL[line.kind])} <span data-check-n>${esc(
          String(line.checkNumber)
        )}</span></p>
        ${checkLineMarkup(line, atIso, locale)}
        <form method="post" action="${LAB_SAMPLE_PATH}/schedule">
          <input type="hidden" name="silo_load_id" value="${esc(load.id)}">
          <input type="hidden" name="kind" value="${esc(line.kind)}">
          <button type="submit" class="shuttle-btn" data-lab-schedule>&gt;&gt;</button>
        </form>
      </li>`;
    })
    .join("");
  const middle = requests
    .filter((row) => row.status === "scheduled" || row.status === "requested")
    .map((row) => {
      const kind = kindOf(row.kind) ?? "aw";
      const title = `${rowTitle(row.space_name, row.hbn, locale)} ${KIND_LABEL[kind]} ${row.check_number}`;
      if (row.status === "scheduled") {
        return `<li data-lab-row="scheduled" data-request="${esc(row.id)}">
          <p>${esc(title)}</p>
          <form method="post" action="${LAB_SAMPLE_PATH}/request"><input type="hidden" name="id" value="${esc(row.id)}"><button type="submit">${esc(
            t(locale, "Sample requested")
          )}</button></form>
          <form method="post" action="${LAB_SAMPLE_PATH}/unschedule"><input type="hidden" name="id" value="${esc(row.id)}"><button type="submit" class="shuttle-btn">&lt;&lt;</button></form>
        </li>`;
      }
      const when = row.requested_at ? etWallClock(row.requested_at) : "";
      return `<li data-lab-row="requested" data-request="${esc(row.id)}">
        <p>${esc(title)}</p>
        <p class="muted">${esc(tFill(locale, "requested at {time}", { time: when }))}</p>
        <form method="post" action="${LAB_SAMPLE_PATH}/fulfill">
          <input type="hidden" name="id" value="${esc(row.id)}">
          <label class="field">${esc(t(locale, kind === "aw" ? "aW" : "MC"))}
            <input type="number" name="result_value" step="any" data-lab-result>
          </label>
          <button type="submit" class="shuttle-btn">&gt;&gt;</button>
        </form>
      </li>`;
    })
    .join("");
  const right = [...requests]
    .filter((row) => row.status === "fulfilled")
    .sort((a, b) => String(b.fulfilled_at ?? "").localeCompare(String(a.fulfilled_at ?? "")))
    .map((row) => {
      const kind = kindOf(row.kind) ?? "aw";
      const value = row.result_value == null ? "" : `${row.result_value}${row.result_unit ? ` ${row.result_unit}` : ""}`;
      const when = row.fulfilled_at ? etWallClock(row.fulfilled_at) : "";
      return `<li data-lab-row="completed" data-request="${esc(row.id)}">
        <p>${esc(rowTitle(row.space_name, row.hbn, locale))} ${esc(KIND_LABEL[kind])} ${esc(String(row.check_number))} ${esc(value)}</p>
        <p class="muted">${esc(when)}</p>
        <form method="post" action="${LAB_SAMPLE_PATH}/return"><input type="hidden" name="id" value="${esc(row.id)}"><button type="submit" class="shuttle-btn">&lt;&lt;</button></form>
      </li>`;
    })
    .join("");
  const pane = (key: string, title: string, body: string) =>
    `<section data-lab-pane="${esc(key)}"><h2>${esc(t(locale, title))}</h2>${
      body ? `<ul>${body}</ul>` : `<p class="muted">${esc(t(locale, "No rows."))}</p>`
    }</section>`;
  return `<div class="station-split station-split-3" data-lab-sample>
    ${pane("drying", "Drying", left)}
    ${pane("schedule", "Schedule Silo/Lot Check #", middle)}
    ${pane("completed", "Completed", right)}
  </div>${checkCountdownScript()}`;
}

function maintenanceButtons(locale: Locale): string {
  return `<p class="maintenance-actions">
    <a class="maintenance-btn" href="/station/load_silo">${esc(t(locale, "Load Silo"))}</a>
    <a class="maintenance-btn" href="${LAB_SAMPLE_PATH}">${esc(t(locale, "Lab Sample"))}</a>
    <a class="maintenance-btn" href="${TROUBLE_TICKETS_PATH}">${esc(t(locale, "Trouble Tickets"))}</a>
  </p>`;
}

export function maintenanceLanding(strip: string, locale: Locale = "en"): string {
  return `<h1>${esc(t(locale, "Maintenance"))}</h1>
    ${strip}
    ${maintenanceButtons(locale)}`;
}

export function troubleTicketsPage(locale: Locale = "en"): string {
  return `<h1>${esc(t(locale, "Trouble Tickets"))}</h1>
    <p class="muted" data-hc-stub>${esc(t(locale, "Stub: this section waits on the owner's definition."))}</p>`;
}

export async function intervalPage(db: D1Database, locale: Locale = "en"): Promise<string> {
  const rows = await db
    .prepare(
      `SELECT id, category, value, sort_order FROM lookup_values
       WHERE deleted_at IS NULL AND category IN (?, ?)
       ORDER BY sort_order, value`
    )
    .bind(INTERVAL_CATEGORY.aw, INTERVAL_CATEGORY.mc)
    .all<{ id: string; category: string; value: string; sort_order: number }>();
  const list = (kind: CheckKind) => {
    const mine = (rows.results ?? []).filter((row) => row.category === INTERVAL_CATEGORY[kind]);
    const items = mine
      .map((row, index) => {
        const from = index === 0 ? t(locale, "from the start of the silo") : t(locale, "from the last check");
        return `<li data-interval="${esc(row.id)}" data-kind="${kind}">
          <span>${esc(tFill(locale, "Check {n}", { n: String(index + 1) }))}</span>
          <span data-interval-hours>${esc(String(row.value))}</span> h
          <span class="muted">${esc(from)}</span>
          <form method="post" action="${SILO_CHECK_INTERVALS_PATH}">
            <input type="hidden" name="action" value="remove">
            <input type="hidden" name="id" value="${esc(row.id)}">
            <button type="submit">${esc(t(locale, "Remove"))}</button>
          </form>
        </li>`;
      })
      .join("");
    return `<section data-interval-list="${kind}">
      <h2>${esc(KIND_LABEL[kind])}</h2>
      <form method="post" action="${SILO_CHECK_INTERVALS_PATH}" class="stack">
        <input type="hidden" name="action" value="add">
        <input type="hidden" name="kind" value="${kind}">
        <label class="field">${esc(t(locale, "Add a Time"))} &middot; ${esc(t(locale, "Hours from last check"))}
          <input type="number" name="hours" min="0" step="1" required data-interval-hours-input>
        </label>
        <button type="submit">+</button>
      </form>
      <ul>${items}</ul>
    </section>`;
  };
  return `<h1>${esc(t(locale, "Internal Silo Testing Interval"))}</h1>
    <div class="interval-pair">${list("aw")}${list("mc")}</div>`;
}

async function loadRow(db: D1Database, id: string): Promise<LabRow | null> {
  return db
    .prepare(
      `SELECT req.id, req.silo_load_id, req.dry_space_id, req.wet_weight_entry_id, req.kind, req.check_number, req.status,
              req.requested_at, req.fulfilled_at, req.result_value, req.result_unit, req.internal_test_result_id,
              d.name AS space_name, b.hbn, COALESCE(b.market_strain, s.name) AS strain_label, l.loaded_at, l.paused_at
       FROM lab_sample_requests req
       JOIN silo_loads l ON l.id = req.silo_load_id
       LEFT JOIN dry_spaces d ON d.id = req.dry_space_id
       LEFT JOIN wet_weight_entries w ON w.id = req.wet_weight_entry_id
       LEFT JOIN harvest_batches b ON b.id = w.harvest_batch_id
       LEFT JOIN strains s ON s.id = b.strain_id
       WHERE req.id = ? AND req.deleted_at IS NULL`
    )
    .bind(id)
    .first<LabRow>();
}

export async function scheduleLabSample(db: D1Database, form: FormData): Promise<{ redirect: string }> {
  const actor = await requireActor(db, textOrNull(form.get("person_id")));
  const loadId = textOrNull(form.get("silo_load_id"));
  const kind = kindOf(textOrNull(form.get("kind")));
  if (!loadId || !kind) throw new HttpError(400, "Pick a load and a check.");
  const load = await db
    .prepare(
      `SELECT l.id, l.dry_space_id, l.wet_weight_entry_id, l.loaded_at, l.ended_at,
              d.id AS space_id, d.space_type, d.shape
       FROM silo_loads l
       JOIN wet_weight_entries w ON w.id = l.wet_weight_entry_id AND w.deleted_at IS NULL
       LEFT JOIN dry_spaces d ON d.id = l.dry_space_id AND d.deleted_at IS NULL
       WHERE l.id = ? AND l.deleted_at IS NULL`
    )
    .bind(loadId)
    .first<{
      id: string;
      dry_space_id: string;
      wet_weight_entry_id: string;
      loaded_at: string;
      ended_at: string | null;
      space_id: string | null;
      space_type: string | null;
      shape: string | null;
    }>();
  if (!load || load.ended_at) throw new HttpError(400, "That load is not drying.");
  if (!load.space_id || spaceTypeOf(load) !== "silo") throw new HttpError(400, "That load is not in a silo.");
  const hours = (await intervalLists(db))[kind];
  if (hours.length === 0) throw new HttpError(400, "That check has no interval.");
  const open = await db
    .prepare(
      `SELECT id FROM lab_sample_requests
       WHERE deleted_at IS NULL AND silo_load_id = ? AND kind = ? AND status IN ('scheduled', 'requested')`
    )
    .bind(loadId, kind)
    .first<{ id: string }>();
  if (open) throw new HttpError(400, "That check is already on the schedule.");
  const counted = await db
    .prepare(
      `SELECT COUNT(*) AS n FROM lab_sample_requests
       WHERE deleted_at IS NULL AND silo_load_id = ? AND kind = ? AND requested_at IS NOT NULL`
    )
    .bind(loadId, kind)
    .first<{ n: number }>();
  const checkNumber = Number(counted?.n ?? 0) + 1;
  const ts = nowIso();
  const id = crypto.randomUUID();
  await db.batch([
    db
      .prepare(
        `INSERT INTO lab_sample_requests (
          id, silo_load_id, dry_space_id, wet_weight_entry_id, kind, check_number, status,
          scheduled_at, scheduled_by, created_at, created_by, updated_at, updated_by
        ) VALUES (?, ?, ?, ?, ?, ?, 'scheduled', ?, ?, ?, ?, ?, ?)`
      )
      .bind(id, load.id, load.dry_space_id, load.wet_weight_entry_id, kind, checkNumber, ts, actor.id, ts, actor.id, ts, actor.id),
    insertLog(db, {
      record_table: "lab_sample_requests",
      record_id: id,
      field: "status",
      old_value: null,
      new_value: "scheduled",
      actor_person_id: actor.id,
      reason: "scheduled",
      changed_at: ts,
    }),
  ]);
  return { redirect: `${LAB_SAMPLE_PATH}?ok=scheduled` };
}

export async function requestLabSample(db: D1Database, form: FormData): Promise<{ redirect: string }> {
  const actor = await requireActor(db, textOrNull(form.get("person_id")));
  const id = textOrNull(form.get("id"));
  if (!id) throw new HttpError(400, "Pick a check.");
  const row = await loadRow(db, id);
  if (!row || row.status !== "scheduled") throw new HttpError(400, "That check is not scheduled.");
  const ts = nowIso();
  await db.batch([
    db
      .prepare(
        `UPDATE lab_sample_requests
         SET status = 'requested', requested_at = ?, requested_by = ?, updated_at = ?, updated_by = ?
         WHERE id = ? AND deleted_at IS NULL`
      )
      .bind(ts, actor.id, ts, actor.id, id),
    insertLog(db, {
      record_table: "lab_sample_requests",
      record_id: id,
      field: "status",
      old_value: "scheduled",
      new_value: "requested",
      actor_person_id: actor.id,
      reason: "sample requested",
      changed_at: ts,
    }),
  ]);
  return { redirect: `${LAB_SAMPLE_PATH}?ok=requested` };
}

export async function unscheduleLabSample(db: D1Database, form: FormData): Promise<{ redirect: string }> {
  const actor = await requireActor(db, textOrNull(form.get("person_id")));
  const id = textOrNull(form.get("id"));
  if (!id) throw new HttpError(400, "Pick a check.");
  const row = await loadRow(db, id);
  if (!row || row.status !== "scheduled") throw new HttpError(400, "That check is not scheduled.");
  const ts = nowIso();
  await db.batch([
    db
      .prepare(
        `UPDATE lab_sample_requests
         SET deleted_at = ?, deleted_by = ?, delete_reason = ?, updated_at = ?, updated_by = ?
         WHERE id = ? AND deleted_at IS NULL`
      )
      .bind(ts, actor.id, "unscheduled", ts, actor.id, id),
    insertLog(db, {
      record_table: "lab_sample_requests",
      record_id: id,
      field: "status",
      old_value: "scheduled",
      new_value: null,
      actor_person_id: actor.id,
      reason: "unscheduled",
      changed_at: ts,
    }),
  ]);
  return { redirect: `${LAB_SAMPLE_PATH}?ok=unscheduled` };
}

function resultOf(kind: CheckKind, raw: string | null): { value: number; unit: string } | null {
  if (raw == null || raw.trim() === "") return null;
  const n = Number(raw);
  if (!Number.isFinite(n)) throw new HttpError(400, "The result must be a number.");
  if (kind === "aw" && (n < 0 || n > 1)) throw new HttpError(400, "aW must be from 0 to 1.");
  if (kind === "mc" && (n < 0 || n > 100)) throw new HttpError(400, "MC must be a percent from 0 to 100.");
  return { value: n, unit: kind === "aw" ? "aw" : "%" };
}

export async function fulfillLabSample(db: D1Database, form: FormData): Promise<{ redirect: string }> {
  const actor = await requireActor(db, textOrNull(form.get("person_id")));
  const id = textOrNull(form.get("id"));
  if (!id) throw new HttpError(400, "Pick a check.");
  const row = await loadRow(db, id);
  const kind = row ? kindOf(row.kind) : null;
  if (!row || !kind || row.status !== "requested") throw new HttpError(400, "That check is not requested.");
  const result = resultOf(kind, textOrNull(form.get("result_value")));
  const ts = nowIso();
  const stmts = [];
  let resultId: string | null = null;
  if (result && row.hbn) {
    resultId = crypto.randomUUID();
    stmts.push(
      db
        .prepare(
          `INSERT INTO internal_test_results (
            id, source, hbn, tested_at, analyte, value, unit, created_at, created_by, updated_at, updated_by
          ) VALUES (?, 'lab_sample', ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(resultId, row.hbn, ts, CHECK_ANALYTE[kind], result.value, result.unit, ts, actor.id, ts, actor.id)
    );
  }
  stmts.push(
    db
      .prepare(
        `UPDATE lab_sample_requests
         SET status = 'fulfilled', fulfilled_at = ?, fulfilled_by = ?, result_value = ?, result_unit = ?,
             internal_test_result_id = ?, updated_at = ?, updated_by = ?
         WHERE id = ? AND deleted_at IS NULL`
      )
      .bind(ts, actor.id, result ? result.value : null, result ? result.unit : null, resultId, ts, actor.id, id),
    insertLog(db, {
      record_table: "lab_sample_requests",
      record_id: id,
      field: "status",
      old_value: "requested",
      new_value: "fulfilled",
      actor_person_id: actor.id,
      reason: "fulfilled",
      changed_at: ts,
    })
  );
  await db.batch(stmts);
  return { redirect: `${LAB_SAMPLE_PATH}?ok=fulfilled` };
}

export async function returnLabSample(db: D1Database, form: FormData): Promise<{ redirect: string }> {
  const actor = await requireActor(db, textOrNull(form.get("person_id")));
  const id = textOrNull(form.get("id"));
  if (!id) throw new HttpError(400, "Pick a check.");
  const row = await loadRow(db, id);
  if (!row || row.status !== "fulfilled") throw new HttpError(400, "That check is not completed.");
  const ts = nowIso();
  const stmts = [
    db
      .prepare(
        `UPDATE lab_sample_requests
         SET status = 'requested', fulfilled_at = NULL, fulfilled_by = NULL, result_value = NULL, result_unit = NULL,
             updated_at = ?, updated_by = ?
         WHERE id = ? AND deleted_at IS NULL`
      )
      .bind(ts, actor.id, id),
    insertLog(db, {
      record_table: "lab_sample_requests",
      record_id: id,
      field: "status",
      old_value: "fulfilled",
      new_value: "requested",
      actor_person_id: actor.id,
      reason: "returned to requested",
      changed_at: ts,
    }),
  ];
  if (row.internal_test_result_id) {
    // The hand's own row leaves the lab's table with the return; an instrument's row is the lab's and stays.
    stmts.push(
      db
        .prepare(
          `UPDATE internal_test_results
           SET deleted_at = ?, deleted_by = ?, delete_reason = 'returned', updated_at = ?, updated_by = ?
           WHERE id = ? AND source = 'lab_sample' AND deleted_at IS NULL`
        )
        .bind(ts, actor.id, ts, actor.id, row.internal_test_result_id)
    );
  }
  await db.batch(stmts);
  return { redirect: `${LAB_SAMPLE_PATH}?ok=returned` };
}

export async function saveSiloCheckInterval(db: D1Database, form: FormData): Promise<{ redirect: string }> {
  const actor = await requireActor(db, textOrNull(form.get("person_id")));
  const action = textOrNull(form.get("action")) ?? "add";
  const ts = nowIso();
  if (action === "remove") {
    const id = textOrNull(form.get("id"));
    if (!id) throw new HttpError(400, "Pick a row.");
    const row = await db
      .prepare(`SELECT id, category FROM lookup_values WHERE id = ? AND deleted_at IS NULL`)
      .bind(id)
      .first<{ id: string; category: string }>();
    if (!row || (row.category !== INTERVAL_CATEGORY.aw && row.category !== INTERVAL_CATEGORY.mc)) {
      throw new HttpError(400, "That interval is not on the list.");
    }
    await db.batch([
      db
        .prepare(
          `UPDATE lookup_values SET deleted_at = ?, deleted_by = ?, delete_reason = ?, updated_at = ?, updated_by = ? WHERE id = ?`
        )
        .bind(ts, actor.id, "removed", ts, actor.id, id),
      insertLog(db, {
        record_table: "lookup_values",
        record_id: id,
        field: "deleted_at",
        old_value: null,
        new_value: ts,
        actor_person_id: actor.id,
        reason: "removed",
        changed_at: ts,
      }),
    ]);
    return { redirect: `${SILO_CHECK_INTERVALS_PATH}?ok=removed` };
  }
  const kind = kindOf(textOrNull(form.get("kind")));
  if (!kind) throw new HttpError(400, "Pick a check.");
  const raw = String(form.get("hours") ?? "").trim();
  if (!/^\d+$/.test(raw)) throw new HttpError(400, "Hours must be a whole number, zero or more.");
  const hours = Number(raw);
  const category = INTERVAL_CATEGORY[kind];
  const existing = await db
    .prepare(`SELECT COALESCE(MAX(sort_order), 0) AS n, COUNT(*) AS c FROM lookup_values WHERE category = ? AND deleted_at IS NULL`)
    .bind(category)
    .first<{ n: number; c: number }>();
  const sort = Number(existing?.n ?? 0) + 1;
  const label = `Check ${Number(existing?.c ?? 0) + 1}`;
  const id = crypto.randomUUID();
  await db.batch([
    db
      .prepare(
        `INSERT INTO lookup_values (
          id, category, value, label, tone, farm_code, license_value, sort_order,
          created_at, created_by, updated_at, updated_by, deleted_at, deleted_by
        ) VALUES (?, ?, ?, ?, NULL, NULL, NULL, ?, ?, ?, ?, ?, NULL, NULL)`
      )
      .bind(id, category, String(hours), label, sort, ts, actor.id, ts, actor.id),
    insertLog(db, {
      record_table: "lookup_values",
      record_id: id,
      field: "value",
      old_value: null,
      new_value: String(hours),
      actor_person_id: actor.id,
      reason: "added",
      changed_at: ts,
    }),
  ]);
  return { redirect: `${SILO_CHECK_INTERVALS_PATH}?ok=added` };
}
