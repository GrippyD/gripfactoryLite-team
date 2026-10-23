/**
 * DD L2: budgeted labor tasks. Each week a percent is typed, and the bar
 * keeps that history. The tile's color follows the percent against the share
 * of time elapsed from the start to the expected date. The stored row is the
 * share of open tasks that are on track.
 */
import { nowIso, refusal, textOrNull } from "./audit";
import { insertLog, logsForInsert, requireActor } from "./db";
import { farmToday } from "./effective";
import { farmDay, isCalendarDate, parseFarmDayStartHour } from "./farmday";
import { monthDay } from "./harvestschedule";
import { t, tFill, type Locale } from "./i18n";
import { esc, fieldBlock } from "./ui";

export const LABOR_TASKS_PATH = "/admin/director/labor-tasks";
export const LABOR_TASKS_KPI = "farmops.labor_tasks_done_pct";
export const LABOR_TASKS_VERSION = 2;
export const LABOR_TASKS_REASON = "Weekly check-in";
export const LABOR_HISTORY_LINES = 5;
export const LABOR_TRACK_SLACK = 5;

export type LaborState = "overdue" | "behind" | "track";

export type LaborLog = { asOf: string; pct: number; at: string };

export type LaborTask = {
  id: string;
  task: string;
  farm: string | null;
  started: string;
  expected: string;
  pct: number;
  asOf: string | null;
  note: string | null;
  closedAt: string | null;
  history: LaborLog[];
};

export type LaborView = LaborTask & { state: LaborState; share: number };

export type LaborTasksModel = { today: string; tasks: LaborView[] };

export type LaborTasksPageModel = LaborTasksModel & {
  showClosed: boolean;
  farms: string[];
};

const RANK: Record<LaborState, number> = { overdue: 0, behind: 1, track: 2 };

function daySpan(from: string, to: string): number {
  if (!isCalendarDate(from) || !isCalendarDate(to)) return 0;
  return Math.round((Date.parse(`${to}T00:00:00.000Z`) - Date.parse(`${from}T00:00:00.000Z`)) / 86400000);
}

/** Today's place on the bar, 0 at the start date and 100 at the expected date. */
export function elapsedShare(started: string, expected: string, today: string): number {
  if (!isCalendarDate(started) || !isCalendarDate(expected) || !isCalendarDate(today)) return 0;
  const span = daySpan(started, expected);
  if (span <= 0) return today >= expected ? 100 : 0;
  const raw = (daySpan(started, today) / span) * 100;
  if (raw <= 0) return 0;
  if (raw >= 100) return 100;
  return raw;
}

/**
 * On track at or above the elapsed share less 5 points. Behind under that.
 * Overdue when today is past the expected date and the task is under 100.
 */
export function laborState(pct: number, started: string, expected: string, today: string): LaborState {
  if (isCalendarDate(today) && isCalendarDate(expected) && today > expected && pct < 100) return "overdue";
  const share = elapsedShare(started, expected, today);
  if (pct >= share - LABOR_TRACK_SLACK) return "track";
  return "behind";
}

export function compareLabor(a: Pick<LaborView, "state" | "expected" | "task">, b: Pick<LaborView, "state" | "expected" | "task">): number {
  return RANK[a.state] - RANK[b.state] || (a.expected < b.expected ? -1 : a.expected > b.expected ? 1 : 0) || (a.task < b.task ? -1 : a.task > b.task ? 1 : 0);
}

/** The stored percent: open tasks on track, over open tasks, one decimal. Null when nothing is open. */
export function onTrackShare(onTrack: number, open: number): number | null {
  if (open <= 0) return null;
  return Math.round((onTrack / open) * 1000) / 10;
}

export const LABOR_TASKS_SQL = `SELECT id, task, farm_code, started_on, expected_on, pct_complete, pct_as_of, note, closed_at
     FROM dd_labor_tasks
     WHERE deleted_at IS NULL
     ORDER BY expected_on, task, id`;

export const LABOR_LOG_SQL = `SELECT task_id, pct_complete, as_of, created_at
     FROM dd_labor_task_log
     ORDER BY created_at DESC, id DESC`;

export function laborTasksStatement(db: D1Database): D1PreparedStatement {
  return db.prepare(LABOR_TASKS_SQL);
}

export function laborLogStatement(db: D1Database): D1PreparedStatement {
  return db.prepare(LABOR_LOG_SQL);
}

function rowsOf(result: unknown): Record<string, unknown>[] {
  const rows = (result as { results?: unknown } | undefined)?.results;
  return Array.isArray(rows) ? (rows as Record<string, unknown>[]) : [];
}

function historyFrom(result: unknown): Map<string, LaborLog[]> {
  const map = new Map<string, LaborLog[]>();
  for (const row of rowsOf(result)) {
    const id = String(row.task_id ?? "");
    const list = map.get(id) ?? [];
    if (list.length < LABOR_HISTORY_LINES) {
      list.push({
        asOf: String(row.as_of ?? ""),
        pct: Number(row.pct_complete ?? 0),
        at: String(row.created_at ?? ""),
      });
      map.set(id, list);
    }
  }
  return map;
}

export function laborViewsFrom(taskResult: unknown, logResult: unknown, today: string): LaborView[] {
  const history = historyFrom(logResult);
  return rowsOf(taskResult).map((row) => {
    const task: LaborTask = {
      id: String(row.id ?? ""),
      task: String(row.task ?? ""),
      farm: row.farm_code == null || String(row.farm_code).trim() === "" ? null : String(row.farm_code),
      started: String(row.started_on ?? ""),
      expected: String(row.expected_on ?? ""),
      pct: Number(row.pct_complete ?? 0),
      asOf: row.pct_as_of == null || String(row.pct_as_of).trim() === "" ? null : String(row.pct_as_of),
      note: row.note == null || String(row.note).trim() === "" ? null : String(row.note),
      closedAt: row.closed_at == null || String(row.closed_at).trim() === "" ? null : String(row.closed_at),
      history: history.get(String(row.id ?? "")) ?? [],
    };
    const share = elapsedShare(task.started, task.expected, today);
    return { ...task, share, state: laborState(task.pct, task.started, task.expected, today) };
  });
}

export function emptyLaborTasks(today: string): LaborTasksModel {
  return { today, tasks: [] };
}

export function laborModelFromResults(taskResult: unknown, logResult: unknown, today: string): LaborTasksModel {
  const tasks = laborViewsFrom(taskResult, logResult, today).filter((task) => !task.closedAt);
  tasks.sort(compareLabor);
  return { today, tasks };
}

function widthOf(n: number): string {
  const clamped = Math.max(0, Math.min(100, n));
  return String(Math.round(clamped * 100) / 100);
}

function endLabel(task: LaborView, locale: Locale): string {
  if (!task.asOf || !isCalendarDate(task.asOf)) return `${task.pct}%`;
  return tFill(locale, "{pct}%, as of {date}", { pct: String(task.pct), date: monthDay(task.asOf, locale) });
}

export function laborBarHtml(task: LaborView, locale: Locale): string {
  const farm = task.farm ?? t(locale, "All farms");
  const history = task.history
    .filter((line) => isCalendarDate(line.asOf))
    .map((line) => `<li data-dd-task-log>${esc(`${monthDay(line.asOf, locale)}, ${line.pct}%`)}</li>`)
    .join("");
  const tip = history ? `<ul class="dd-task-tip" data-dd-task-history>${history}</ul>` : "";
  return `<div class="dd-labor-row" data-dd-task-id="${esc(task.id)}" data-dd-task-state="${esc(task.state)}" data-dd-task-pct="${esc(task.pct)}" data-dd-task-marker="${esc(widthOf(task.share))}">
      <span class="dd-task-name">${esc(task.task)}</span>
      <span class="dd-task-farm">${esc(farm)}</span>
      <span class="dd-task-due">${esc(tFill(locale, "due {date}", { date: monthDay(task.expected, locale) }))}</span>
      <div class="dd-task-bar" tabindex="0" data-dd-task-bar>
        <div class="dd-task-track">
          <span class="dd-task-fill dd-task-fill-${esc(task.state)}" style="width:${esc(widthOf(task.pct))}%"></span>
          <span class="dd-task-marker" style="left:${esc(widthOf(task.share))}%"></span>
        </div>
        ${tip}
      </div>
      <span class="dd-task-end">${esc(endLabel(task, locale))}</span>
    </div>`;
}

function laborScript(): string {
  return `<script>
(function () {
  var bars = document.querySelectorAll("[data-dd-task-bar]");
  for (var i = 0; i < bars.length; i++) {
    bars[i].addEventListener("click", function () { this.classList.toggle("dd-task-open"); });
  }
})();
</script>`;
}

export function laborOnTrackLine(tasks: readonly LaborView[], locale: Locale): string {
  const open = tasks.filter((task) => !task.closedAt);
  const onTrack = open.filter((task) => task.state === "track").length;
  return tFill(locale, "{k} of {n} on track", { k: String(onTrack), n: String(open.length) });
}

/** The farmops tile: one bar per open task, overdue first. */
export function laborTasksBody(model: LaborTasksModel, locale: Locale): string {
  const open = model.tasks.filter((task) => !task.closedAt);
  const link = `<p class="dd-labor-link"><a href="${esc(LABOR_TASKS_PATH)}">${esc(t(locale, "Add or update"))}</a></p>`;
  if (open.length === 0) {
    return `<div class="dd-labor" data-dd-labor data-dd-labor-empty="1">
      <p class="dd-labor-empty" data-dd-labor-empty>${esc(t(locale, "No budgeted tasks entered"))}</p>
      ${link}
    </div>`;
  }
  return `<div class="dd-labor" data-dd-labor data-dd-labor-empty="0">
      ${open.map((task) => laborBarHtml(task, locale)).join("")}
      <p class="dd-labor-foot" data-dd-labor-foot>${esc(laborOnTrackLine(open, locale))}</p>
      ${link}
      ${laborScript()}
    </div>`;
}

function reasonField(locale: Locale): string {
  return `<input type="hidden" name="reason" value="${esc(t(locale, LABOR_TASKS_REASON))}">`;
}

function farmOptions(farms: readonly string[], selected: string): string {
  const blank = `<option value=""${selected === "" ? " selected" : ""}>${esc("")}</option>`;
  return [blank, ...farms.map((code) => `<option value="${esc(code)}"${code === selected ? " selected" : ""}>${esc(code)}</option>`)].join("");
}

function taskCard(task: LaborView, today: string, locale: Locale): string {
  const asOf = task.asOf && isCalendarDate(task.asOf) ? task.asOf : today;
  return `<article class="dd-labor-card" data-dd-labor-id="${esc(task.id)}" data-dd-labor-closed="${task.closedAt ? "1" : "0"}">
      ${laborBarHtml(task, locale)}
      <form method="post" action="${esc(`${LABOR_TASKS_PATH}/${task.id}/percent`)}">
        ${reasonField(locale)}
        <div class="dd-labor-fields">
          ${fieldBlock(locale, "Percent", `<input type="text" name="pct_complete" inputmode="numeric" required value="${esc(task.pct)}">`, "Percent complete, 0 to 100.")}
          ${fieldBlock(locale, "As of", `<input type="date" name="pct_as_of" required value="${esc(asOf)}">`, "The day this percent is as of.")}
        </div>
        <button type="submit">${esc(t(locale, "Save"))}</button>
      </form>
      <form method="post" action="${esc(`${LABOR_TASKS_PATH}/${task.id}/close`)}">
        ${reasonField(locale)}
        <button type="submit">${esc(t(locale, "Close"))}</button>
      </form>
      <form method="post" action="${esc(`${LABOR_TASKS_PATH}/${task.id}/delete`)}">
        <input type="text" name="reason" required aria-label="${esc(t(locale, "Reason"))}">
        <button type="submit">${esc(t(locale, "Delete"))}</button>
      </form>
    </article>`;
}

export function laborTasksPage(model: LaborTasksPageModel, locale: Locale = "en"): string {
  const open = model.tasks.filter((task) => !task.closedAt).sort(compareLabor);
  const closed = model.tasks.filter((task) => task.closedAt).sort((a, b) => (a.expected < b.expected ? -1 : 1));
  const toggle = model.showClosed
    ? `<a href="${esc(LABOR_TASKS_PATH)}" data-dd-labor-open>${esc(t(locale, "Open tasks"))}</a>`
    : `<a href="${esc(`${LABOR_TASKS_PATH}?closed=1`)}" data-dd-labor-show-closed>${esc(t(locale, "show closed"))}</a>`;
  const add = `<form class="dd-labor-add" method="post" action="${esc(LABOR_TASKS_PATH)}" data-dd-labor-add>
      ${reasonField(locale)}
      <div class="dd-labor-fields">
        ${fieldBlock(locale, "Task", `<input type="text" name="task" required>`, "The task.")}
        ${fieldBlock(locale, "Farm", `<select name="farm_code">${farmOptions(model.farms, "")}</select>`, "The farm, or all farms.")}
        ${fieldBlock(locale, "Started on", `<input type="date" name="started_on" required value="${esc(model.today)}">`, "The day the task started.")}
        ${fieldBlock(locale, "Expected on", `<input type="date" name="expected_on" required value="${esc(model.today)}">`, "The day the task should be done.")}
      </div>
      <button type="submit">${esc(t(locale, "Add"))}</button>
    </form>`;
  const closedHtml = model.showClosed
    ? `<h2>${esc(t(locale, "Closed"))}</h2>${closed.map((task) => taskCard(task, model.today, locale)).join("")}`
    : "";
  return `<div class="dd-labor-page" data-dd-labor-tasks data-dd-labor-show-closed="${model.showClosed ? "1" : "0"}">
      <h1>${esc(t(locale, "Labor tasks"))}</h1>
      <p class="dd-labor-nav"><a href="/admin/director">${esc(t(locale, "Director Dashboard"))}</a> ${toggle}</p>
      ${add}
      ${open.map((task) => taskCard(task, model.today, locale)).join("")}
      ${closedHtml}
      ${laborScript()}
    </div>`;
}

async function loadFarms(db: D1Database): Promise<string[]> {
  const listed = await db.prepare(`SELECT code FROM farms WHERE deleted_at IS NULL ORDER BY code`).all<{ code: string }>();
  return (listed.results ?? []).map((row) => String(row.code));
}

export async function loadLaborTasksPage(db: D1Database, now: string, showClosed: boolean): Promise<LaborTasksPageModel> {
  const today = await farmToday(db, now);
  const [tasks, logs, farms] = await Promise.all([
    db.prepare(LABOR_TASKS_SQL).all(),
    db.prepare(LABOR_LOG_SQL).all(),
    loadFarms(db),
  ]);
  return { today, showClosed, farms, tasks: laborViewsFrom(tasks, logs, today) };
}

function dateOf(raw: unknown, key: string): string {
  const text = textOrNull(raw);
  if (!text || !isCalendarDate(text)) throw refusal(400, { key, vars: {} });
  return text;
}

function pctField(raw: unknown): number {
  const text = textOrNull(raw);
  if (text == null || !/^\d+$/.test(text)) throw refusal(400, { key: "Percent must be a whole number from 0 to 100.", vars: {} });
  const n = Number(text);
  if (n > 100) throw refusal(400, { key: "Percent must be a whole number from 0 to 100.", vars: {} });
  return n;
}

function reasonOf(form: FormData): string {
  const reason = textOrNull(form.get("reason"));
  if (!reason) throw refusal(400, { key: "Reason is required.", vars: {} });
  return reason;
}

async function farmOrAll(db: D1Database, raw: unknown): Promise<string | null> {
  const code = textOrNull(raw);
  if (!code) return null;
  const row = await db.prepare(`SELECT code FROM farms WHERE code = ? AND deleted_at IS NULL`).bind(code).first<{ code: string }>();
  if (!row) throw refusal(400, { key: "Pick a farm.", vars: {} });
  return String(row.code);
}

type TaskStored = {
  id: string;
  task: string;
  farm_code: string | null;
  started_on: string;
  expected_on: string;
  pct_complete: number;
  pct_as_of: string | null;
  note: string | null;
  closed_at: string | null;
};

async function liveTask(db: D1Database, id: string): Promise<TaskStored> {
  const row = await db
    .prepare(
      `SELECT id, task, farm_code, started_on, expected_on, pct_complete, pct_as_of, note, closed_at
       FROM dd_labor_tasks WHERE id = ? AND deleted_at IS NULL`
    )
    .bind(id)
    .first<TaskStored>();
  if (!row) throw refusal(404, { key: "That task is not on the list.", vars: {} });
  return {
    id: String(row.id),
    task: String(row.task),
    farm_code: row.farm_code == null || String(row.farm_code) === "" ? null : String(row.farm_code),
    started_on: String(row.started_on),
    expected_on: String(row.expected_on),
    pct_complete: Number(row.pct_complete ?? 0),
    pct_as_of: row.pct_as_of == null || String(row.pct_as_of) === "" ? null : String(row.pct_as_of),
    note: row.note == null || String(row.note) === "" ? null : String(row.note),
    closed_at: row.closed_at == null || String(row.closed_at) === "" ? null : String(row.closed_at),
  };
}

export async function addLaborTask(db: D1Database, form: FormData, now: string = nowIso()): Promise<{ redirect: string }> {
  const actor = await requireActor(db, textOrNull(form.get("person_id")));
  const task = textOrNull(form.get("task"));
  if (!task) throw refusal(400, { key: "Task is required.", vars: {} });
  const farm = await farmOrAll(db, form.get("farm_code"));
  const started = dateOf(form.get("started_on"), "Started on must be YYYY-MM-DD.");
  const expected = dateOf(form.get("expected_on"), "Expected on must be YYYY-MM-DD.");
  const reason = reasonOf(form);
  const id = crypto.randomUUID();
  const record = { task, farm_code: farm, started_on: started, expected_on: expected, pct_complete: 0, created_by: actor.id, created_at: now };
  await db.batch([
    db
      .prepare(
        `INSERT INTO dd_labor_tasks (
           id, task, farm_code, started_on, expected_on, pct_complete, pct_as_of, note, closed_at,
           created_at, created_by, updated_at, updated_by, deleted_at, deleted_by, delete_reason
         ) VALUES (?, ?, ?, ?, ?, 0, NULL, NULL, NULL, ?, ?, ?, NULL, NULL, NULL, NULL)`
      )
      .bind(id, task, farm, started, expected, now, actor.id, now),
    ...logsForInsert(db, "dd_labor_tasks", id, record, actor.id, reason, now),
  ]);
  return { redirect: `${LABOR_TASKS_PATH}?ok=saved` };
}

export async function saveLaborPercent(db: D1Database, id: string, form: FormData, now: string = nowIso()): Promise<{ redirect: string }> {
  const actor = await requireActor(db, textOrNull(form.get("person_id")));
  const current = await liveTask(db, id);
  const pct = pctField(form.get("pct_complete"));
  const asOf = dateOf(form.get("pct_as_of"), "As of date must be YYYY-MM-DD.");
  const reason = reasonOf(form);
  const closing = pct === 100 && !current.closed_at ? now : null;
  const logs: D1PreparedStatement[] = [];
  if (current.pct_complete !== pct) {
    logs.push(
      insertLog(db, {
        record_table: "dd_labor_tasks",
        record_id: current.id,
        field: "pct_complete",
        old_value: String(current.pct_complete),
        new_value: String(pct),
        actor_person_id: actor.id,
        reason,
        changed_at: now,
      })
    );
  }
  if (current.pct_as_of !== asOf) {
    logs.push(
      insertLog(db, {
        record_table: "dd_labor_tasks",
        record_id: current.id,
        field: "pct_as_of",
        old_value: current.pct_as_of,
        new_value: asOf,
        actor_person_id: actor.id,
        reason,
        changed_at: now,
      })
    );
  }
  if (closing) {
    logs.push(
      insertLog(db, {
        record_table: "dd_labor_tasks",
        record_id: current.id,
        field: "closed_at",
        old_value: null,
        new_value: closing,
        actor_person_id: actor.id,
        reason,
        changed_at: now,
      })
    );
  }
  await db.batch([
    db
      .prepare(
        `UPDATE dd_labor_tasks
         SET pct_complete = ?, pct_as_of = ?, closed_at = COALESCE(closed_at, ?), updated_at = ?, updated_by = ?
         WHERE id = ? AND deleted_at IS NULL`
      )
      .bind(pct, asOf, closing, now, actor.id, current.id),
    db
      .prepare(
        `INSERT INTO dd_labor_task_log (id, task_id, pct_complete, as_of, note, created_at, created_by)
         VALUES (?, ?, ?, ?, NULL, ?, ?)`
      )
      .bind(crypto.randomUUID(), current.id, pct, asOf, now, actor.id),
    ...logs,
  ]);
  return { redirect: `${LABOR_TASKS_PATH}?ok=saved` };
}

export async function closeLaborTask(db: D1Database, id: string, form: FormData, now: string = nowIso()): Promise<{ redirect: string }> {
  const actor = await requireActor(db, textOrNull(form.get("person_id")));
  const current = await liveTask(db, id);
  const reason = reasonOf(form);
  if (current.closed_at) return { redirect: `${LABOR_TASKS_PATH}?ok=saved` };
  await db.batch([
    db.prepare(`UPDATE dd_labor_tasks SET closed_at = ?, updated_at = ?, updated_by = ? WHERE id = ? AND deleted_at IS NULL`).bind(now, now, actor.id, current.id),
    insertLog(db, {
      record_table: "dd_labor_tasks",
      record_id: current.id,
      field: "closed_at",
      old_value: null,
      new_value: now,
      actor_person_id: actor.id,
      reason,
      changed_at: now,
    }),
  ]);
  return { redirect: `${LABOR_TASKS_PATH}?ok=saved` };
}

export async function deleteLaborTask(db: D1Database, id: string, form: FormData, now: string = nowIso()): Promise<{ redirect: string }> {
  const actor = await requireActor(db, textOrNull(form.get("person_id")));
  const current = await liveTask(db, id);
  const reason = reasonOf(form);
  await db.batch([
    db
      .prepare(
        `UPDATE dd_labor_tasks
         SET deleted_at = ?, deleted_by = ?, delete_reason = ?, updated_at = ?, updated_by = ?
         WHERE id = ? AND deleted_at IS NULL`
      )
      .bind(now, actor.id, reason, now, actor.id, current.id),
    insertLog(db, {
      record_table: "dd_labor_tasks",
      record_id: current.id,
      field: "deleted_at",
      old_value: null,
      new_value: now,
      actor_person_id: actor.id,
      reason,
      changed_at: now,
    }),
  ]);
  return { redirect: `${LABOR_TASKS_PATH}?ok=saved` };
}

export type LaborShareRefresh = { written: number; value: number | null };

/** One daily row, dim all: the share of open tasks on track. An unchanged value is left alone. */
export async function refreshLaborShare(db: D1Database, now: string): Promise<LaborShareRefresh> {
  const hourRow = await db.prepare(`SELECT value FROM app_config WHERE key = 'farm_day_start_hour' AND deleted_at IS NULL`).first<{ value: string }>();
  const today = farmDay(now, parseFarmDayStartHour(hourRow?.value ?? null));
  if (!isCalendarDate(today)) return { written: 0, value: null };
  const [tasks, logs] = await Promise.all([db.prepare(LABOR_TASKS_SQL).all(), db.prepare(LABOR_LOG_SQL).all()]);
  const open = laborViewsFrom(tasks, logs, today).filter((task) => !task.closedAt);
  const share = onTrackShare(open.filter((task) => task.state === "track").length, open.length);
  const live = await db
    .prepare(
      `SELECT id, value, n FROM dd_kpi_values
       WHERE kpi_key = ? AND period_kind = 'day' AND period_start = ? AND dim_key = 'all'
         AND source = 'app' AND superseded_at IS NULL`
    )
    .bind(LABOR_TASKS_KPI, today)
    .first<{ id: string; value: number | null; n: number | null }>();
  const same = live && share != null && Math.round(Number(live.value) * 10) === Math.round(share * 10) && Number(live.n ?? 0) === open.length;
  if (same) return { written: 0, value: share };
  const stmts: D1PreparedStatement[] = [];
  if (live) stmts.push(db.prepare(`UPDATE dd_kpi_values SET superseded_at = ? WHERE id = ? AND superseded_at IS NULL`).bind(now, live.id));
  if (share != null) {
    stmts.push(
      db
        .prepare(
          `INSERT INTO dd_kpi_values (
             id, kpi_key, period_kind, period_start, dim_key, value, n, source, source_as_of, computed_at, def_version, created_at
           ) VALUES (?, ?, 'day', ?, 'all', ?, ?, 'app', ?, ?, ?, ?)`
        )
        .bind(crypto.randomUUID(), LABOR_TASKS_KPI, today, share, open.length, now, now, LABOR_TASKS_VERSION, now)
    );
  }
  if (stmts.length === 0) return { written: 0, value: null };
  await db.batch(stmts);
  return { written: 1, value: share };
}
