/**
 * DD L4: the projects form and the Farming Operations Maintenance tab.
 * Projects are typed by a director. The tab reads those rows, the PM
 * schedules, the open tickets, GRIPCasting's maintenance lines, and the
 * assets marked for sale.
 */
import { nowIso, refusal, textOrNull } from "./audit";
import { insertLog, logsForInsert, requireActor } from "./db";
import { farmToday } from "./effective";
import { dayOffset, isCalendarDate, weekStartOf } from "./farmday";
import { buLines, compute, initReference, mergeDrivers, registerActualGLs, registerBuildGLs, round2 } from "./gripcasting/model";
import { actuals, builds, drivers, reference } from "./gripcasting/queries";
import { monthDay } from "./harvestschedule";
import { t, tFill, type Locale } from "./i18n";
import { elapsedShare } from "./labortasks";
import { countAssetsForSale, isOverdue, listAllSchedules, listEquipmentAssets, listOpenTickets, nextDueFrom, type EquipmentAssetRow } from "./equipment";
import { esc, fieldBlock, tabBar } from "./ui";

export const PROJECTS_PATH = "/admin/director/projects";
export const MAINTENANCE_PATH = "/admin/director/maintenance";
export const PROJECT_ADD_REASON = "project entered";
export const PROJECT_EDIT_REASON = "project updated";
export const FORECAST_WEEKS = 8;
export const MAINT_BU = "11 Indirect Grow / Maintenance";
export const MAINT_GL = ["5320", "5330", "5350", "5360", "5370", "5380"] as const;

export const PROJECT_STATUSES = ["planned", "active", "paused", "done"] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export type ProjectRow = {
  id: string;
  name: string;
  owner: string;
  farm: string | null;
  status: ProjectStatus;
  started: string;
  expected: string;
  cost: number | null;
  budget: number | null;
  note: string | null;
};

export type ProjectsPageModel = {
  today: string;
  showDone: boolean;
  farms: string[];
  projects: ProjectRow[];
};

export type PmDue = {
  asset: string;
  task: string;
  interval: number;
  due: string;
  overdue: boolean;
};

export type OpenWork = {
  asset: string;
  title: string;
  age: number;
};

export type ForecastBar = {
  week: string;
  count: number;
  overdue: boolean;
};

export type BudgetLine =
  | { kind: "none" }
  | { kind: "line"; spent: number; budget: number; pct: number };

export type SaleRow = {
  name: string;
  serial: string;
  farm: string;
  condition: string | null;
  price: number | null;
  status: string;
};

export type MaintenanceModel = {
  today: string;
  projects: ProjectRow[];
  dues: PmDue[];
  tickets: OpenWork[];
  bars: ForecastBar[];
  budget: BudgetLine;
  sales: SaleRow[];
  forSaleCount: number;
};

const DAY_MS = 86_400_000;

function daySpan(from: string, to: string): number {
  if (!isCalendarDate(from) || !isCalendarDate(to)) return 0;
  return Math.round((Date.parse(`${to}T00:00:00.000Z`) - Date.parse(`${from}T00:00:00.000Z`)) / DAY_MS);
}

/** The L2 bar: 0 at the start date and 100 at the expected date. */
export function projectElapsed(started: string, expected: string, today: string): number {
  return elapsedShare(started, expected, today);
}

export function ageDays(createdAt: string, today: string): number {
  const day = String(createdAt).slice(0, 10);
  const span = daySpan(day, today);
  return span > 0 ? span : 0;
}

export function usdText(n: number): string {
  const whole = Math.abs(n - Math.round(n)) < 0.001;
  const body = whole
    ? Math.round(n).toLocaleString("en-US")
    : n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `$${body}`;
}

export function costOfBudget(cost: number | null, budget: number | null): string | null {
  if (cost == null || budget == null) return null;
  return `${usdText(cost)} of ${usdText(budget)}`;
}

function widthOf(n: number): string {
  const clamped = Math.max(0, Math.min(100, n));
  return String(Math.round(clamped * 100) / 100);
}

function moneyOf(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
}

function statusOf(value: unknown): ProjectStatus | null {
  const text = String(value ?? "");
  return (PROJECT_STATUSES as readonly string[]).includes(text) ? (text as ProjectStatus) : null;
}

function projectFrom(row: Record<string, unknown>): ProjectRow | null {
  const status = statusOf(row.status);
  if (!status) return null;
  return {
    id: String(row.id ?? ""),
    name: String(row.name ?? ""),
    owner: String(row.owner_name ?? ""),
    farm: row.farm_code == null || String(row.farm_code).trim() === "" ? null : String(row.farm_code),
    status,
    started: String(row.started_on ?? ""),
    expected: String(row.expected_on ?? ""),
    cost: moneyOf(row.cost_to_date_usd),
    budget: moneyOf(row.budget_usd),
    note: row.note == null || String(row.note).trim() === "" ? null : String(row.note),
  };
}

export const PROJECTS_SQL = `SELECT id, name, owner_name, farm_code, status, started_on, expected_on, cost_to_date_usd, budget_usd, note
     FROM dd_projects
     WHERE deleted_at IS NULL
     ORDER BY expected_on, name, id`;

function rowsOf(result: unknown): Record<string, unknown>[] {
  const rows = (result as { results?: unknown } | undefined)?.results;
  return Array.isArray(rows) ? (rows as Record<string, unknown>[]) : [];
}

export function projectsFrom(result: unknown): ProjectRow[] {
  return rowsOf(result).flatMap((row) => {
    const project = projectFrom(row);
    return project ? [project] : [];
  });
}

export function activeProjects(projects: readonly ProjectRow[]): ProjectRow[] {
  return projects.filter((project) => project.status !== "done");
}

function horizonEnd(today: string): string {
  return dayOffset(weekStartOf(today), FORECAST_WEEKS * 7);
}

export function dueInWindow(due: string, overdue: boolean, today: string): boolean {
  if (overdue) return true;
  if (!isCalendarDate(due) || !isCalendarDate(today)) return false;
  return due >= today && due < horizonEnd(today);
}

export function forecastBars(dues: readonly PmDue[], today: string): ForecastBar[] {
  const start = weekStartOf(today);
  const bars: ForecastBar[] = [{ week: "overdue", count: dues.filter((due) => due.overdue).length, overdue: true }];
  for (let i = 0; i < FORECAST_WEEKS; i += 1) {
    const week = dayOffset(start, i * 7);
    const next = dayOffset(week, 7);
    const from = i === 0 && isCalendarDate(today) && today > week ? today : week;
    const count = dues.filter((due) => !due.overdue && due.due >= from && due.due < next).length;
    bars.push({ week, count, overdue: false });
  }
  return bars;
}

export function duesFrom(
  schedules: readonly { asset_id: string; task: string; interval_days: number; last_done: string | null }[],
  assets: readonly EquipmentAssetRow[],
  today: string
): PmDue[] {
  const names = new Map(assets.map((asset) => [asset.id, asset.name]));
  const dues: PmDue[] = [];
  for (const schedule of schedules) {
    const asset = names.get(schedule.asset_id);
    if (!asset) continue;
    const due = nextDueFrom(schedule.last_done, Number(schedule.interval_days));
    const overdue = isOverdue(due, today);
    if (!dueInWindow(due, overdue, today)) continue;
    dues.push({ asset, task: schedule.task, interval: Number(schedule.interval_days), due, overdue });
  }
  dues.sort((a, b) => {
    if (a.overdue !== b.overdue) return a.overdue ? -1 : 1;
    const ad = a.due === "now" ? "" : a.due;
    const bd = b.due === "now" ? "" : b.due;
    return (ad < bd ? -1 : ad > bd ? 1 : 0) || (a.asset < b.asset ? -1 : a.asset > b.asset ? 1 : 0) || (a.task < b.task ? -1 : a.task > b.task ? 1 : 0);
  });
  return dues;
}

function saleRows(assets: readonly EquipmentAssetRow[]): SaleRow[] {
  return assets
    .filter((asset) => asset.sale_status === "listed" || asset.sale_status === "under_offer")
    .map((asset) => ({
      name: asset.name,
      serial: asset.serial,
      farm: asset.farm_code,
      condition: asset.sale_condition ?? null,
      price: moneyOf(asset.asking_price_usd),
      status: String(asset.sale_status),
    }))
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0) || (a.serial < b.serial ? -1 : 1));
}

export function budgetSentence(line: BudgetLine, locale: Locale): string {
  if (line.kind === "none") return t(locale, "Maintenance budget: not in GRIPCasting yet");
  return tFill(locale, "Maintenance budget: {spent} spent of {budget} this year ({pct}%)", {
    spent: usdText(line.spent),
    budget: usdText(line.budget),
    pct: String(line.pct),
  });
}

/** Maintenance GL lines on BU 11. None when GRIPCasting has no current harvest or those lines are empty. */
export async function maintenanceBudget(db: D1Database): Promise<BudgetLine> {
  const harvest = await db.prepare(`SELECT id FROM gc_harvests WHERE is_current = 1`).first<{ id: string }>();
  if (!harvest) return { kind: "none" };
  const [ref, driverRow, actual, buildRows] = await Promise.all([
    reference(db, harvest.id),
    drivers(db, harvest.id),
    actuals(db, harvest.id),
    builds(db, harvest.id),
  ]);
  initReference(ref);
  if (actual) registerActualGLs(actual);
  registerBuildGLs(buildRows);
  const model = compute({
    drivers: mergeDrivers(driverRow ? { vol: driverRow.vol, gl: driverRow.gl } : null),
    actuals: actual,
    builds: buildRows,
  });
  const lines = buLines(model, MAINT_BU).filter((line) => (MAINT_GL as readonly string[]).includes(line.g.slice(0, 4)));
  const spent = round2(lines.reduce((sum, line) => sum + line.a, 0));
  const budget = round2(lines.reduce((sum, line) => sum + line.b, 0));
  if (!Number.isFinite(spent) || !Number.isFinite(budget) || (spent === 0 && budget === 0)) return { kind: "none" };
  const pct = budget > 0 ? Math.round((spent / budget) * 100) : 0;
  return { kind: "line", spent, budget, pct };
}

export function farmopsHeadTabs(locale: Locale, active: "wall" | "maintenance"): string {
  return `<div data-dd-wall-tabs="farmops">${tabBar(
    locale,
    [
      { href: "/admin/director/farmops", key: "wall", label: "Farming Operations" },
      { href: MAINTENANCE_PATH, key: "maintenance", label: "Maintenance" },
    ],
    active
  )}</div>`;
}

function ageLabel(age: number, locale: Locale): string {
  if (age === 1) return t(locale, "1 day");
  return tFill(locale, "{n} days", { n: String(age) });
}

function dueLabel(due: PmDue, locale: Locale): string {
  if (due.overdue || due.due === "now" || !isCalendarDate(due.due)) return t(locale, "Overdue");
  return monthDay(due.due, locale);
}

export function projectBarHtml(project: ProjectRow, today: string, locale: Locale): string {
  const share = projectElapsed(project.started, project.expected, today);
  const cost = costOfBudget(project.cost, project.budget);
  const farm = project.farm ?? t(locale, "All farms");
  const note = project.note ? `<p class="dd-maint-note" data-dd-project-note>${esc(project.note)}</p>` : "";
  const spend = cost ? `<span data-dd-project-cost>${esc(cost)}</span>` : "";
  return `<article class="dd-labor-card" data-dd-project-id="${esc(project.id)}" data-dd-project-status="${esc(project.status)}" data-dd-project-share="${esc(widthOf(share))}">
      <div class="dd-labor-row">
        <span class="dd-task-name">${esc(project.name)}</span>
        <span data-dd-project-owner>${esc(project.owner)}</span>
        <span data-dd-project-farm>${esc(farm)}</span>
        <span>${esc(tFill(locale, "started {date}", { date: isCalendarDate(project.started) ? monthDay(project.started, locale) : project.started }))}</span>
        <span>${esc(tFill(locale, "expected {date}", { date: isCalendarDate(project.expected) ? monthDay(project.expected, locale) : project.expected }))}</span>
        <div class="dd-task-bar" data-dd-project-bar>
          <div class="dd-task-track">
            <span class="dd-task-fill dd-task-fill-track" style="width:${esc(widthOf(share))}%"></span>
          </div>
        </div>
        ${spend}
      </div>
      ${note}
    </article>`;
}

function projectsSection(projects: readonly ProjectRow[], today: string, locale: Locale): string {
  const open = activeProjects(projects);
  const body =
    open.length === 0
      ? `<p data-dd-projects-empty>${esc(t(locale, "No projects entered"))} <a href="${esc(PROJECTS_PATH)}">${esc(t(locale, "Projects"))}</a></p>`
      : `${open.map((project) => projectBarHtml(project, today, locale)).join("")}
         <p class="dd-labor-link"><a href="${esc(PROJECTS_PATH)}">${esc(t(locale, "Projects"))}</a></p>`;
  return `<section data-dd-maint-projects>
      <h2>${esc(t(locale, "Active projects"))}</h2>
      ${body}
    </section>`;
}

function upcomingSection(dues: readonly PmDue[], tickets: readonly OpenWork[], locale: Locale): string {
  const pm =
    dues.length === 0
      ? `<p data-dd-pm-empty>${esc(t(locale, "No PM due in the next eight weeks"))}</p>`
      : dues
          .map(
            (due) => `<p class="dd-maint-row${due.overdue ? " dd-maint-overdue" : ""}" data-dd-pm data-dd-pm-due="${esc(due.due)}" data-dd-pm-overdue="${due.overdue ? "1" : "0"}">
              <span data-dd-pm-asset>${esc(due.asset)}</span>
              <span data-dd-pm-task>${esc(due.task)}</span>
              <span data-dd-pm-interval>${esc(tFill(locale, "every {n} days", { n: String(due.interval) }))}</span>
              <span data-dd-pm-when>${esc(dueLabel(due, locale))}</span>
            </p>`
          )
          .join("");
  const work =
    tickets.length === 0
      ? `<p data-dd-ticket-empty>${esc(t(locale, "No open tickets"))}</p>`
      : tickets
          .map(
            (ticket) => `<p class="dd-maint-row" data-dd-ticket data-dd-ticket-age="${esc(ticket.age)}">
              <span data-dd-ticket-asset>${esc(ticket.asset)}</span>
              <span data-dd-ticket-title>${esc(ticket.title)}</span>
              <span data-dd-ticket-age-label>${esc(ageLabel(ticket.age, locale))}</span>
            </p>`
          )
          .join("");
  return `<section data-dd-maint-upcoming>
      <h2>${esc(t(locale, "Upcoming work"))}</h2>
      <div data-dd-pm-list>${pm}</div>
      <div data-dd-ticket-list>${work}</div>
    </section>`;
}

function forecastSection(bars: readonly ForecastBar[], budget: BudgetLine, locale: Locale): string {
  const max = bars.reduce((top, bar) => (bar.count > top ? bar.count : top), 0);
  const rows = bars
    .map((bar) => {
      const width = max > 0 ? widthOf((bar.count / max) * 100) : "0";
      const label = bar.overdue ? t(locale, "Overdue") : isCalendarDate(bar.week) ? monthDay(bar.week, locale) : bar.week;
      return `<div class="dd-forecast-row${bar.overdue ? " dd-maint-overdue" : ""}" data-dd-forecast-bar data-dd-forecast-week="${esc(bar.week)}" data-dd-forecast-count="${esc(bar.count)}">
          <span class="dd-forecast-label">${esc(label)}</span>
          <span class="dd-forecast-track"><span class="dd-forecast-fill${bar.overdue ? " dd-forecast-fill-overdue" : ""}" style="width:${esc(width)}%"></span></span>
          <span class="dd-forecast-n">${esc(bar.count)}</span>
        </div>`;
    })
    .join("");
  return `<section data-dd-maint-forecast>
      <h2>${esc(t(locale, "Forecast"))}</h2>
      ${rows}
      <p data-dd-maint-budget data-dd-maint-budget-kind="${esc(budget.kind)}">${esc(budgetSentence(budget, locale))}</p>
    </section>`;
}

function saleStatusWord(status: string, locale: Locale): string {
  if (status === "under_offer") return t(locale, "under offer");
  if (status === "sold") return t(locale, "sold");
  return t(locale, "listed");
}

function saleSection(sales: readonly SaleRow[], locale: Locale): string {
  const body =
    sales.length === 0
      ? `<p data-dd-sale-empty>${esc(t(locale, "Nothing listed for sale"))}</p>`
      : sales
          .map(
            (sale) => `<p class="dd-maint-row" data-dd-sale data-dd-sale-status="${esc(sale.status)}">
              <span data-dd-sale-name>${esc(sale.name)}</span>
              <span data-dd-sale-serial>${esc(sale.serial)}</span>
              <span data-dd-sale-farm>${esc(sale.farm)}</span>
              <span data-dd-sale-condition>${esc(sale.condition ?? "")}</span>
              <span data-dd-sale-price>${esc(sale.price == null ? "" : usdText(sale.price))}</span>
              <span data-dd-sale-word>${esc(saleStatusWord(sale.status, locale))}</span>
            </p>`
          )
          .join("");
  return `<section data-dd-maint-sale>
      <h2>${esc(t(locale, "Equipment for sale"))}</h2>
      ${body}
    </section>`;
}

export function maintenancePage(model: MaintenanceModel, locale: Locale = "en"): string {
  return `<div class="dd-maint" data-dd-maintenance data-dd-day="${esc(model.today)}" data-dd-for-sale-count="${esc(model.forSaleCount)}">
      ${farmopsHeadTabs(locale, "maintenance")}
      <h1>${esc(t(locale, "Maintenance"))}</h1>
      <p class="dd-labor-nav"><a href="/admin/director">${esc(t(locale, "Director Dashboard"))}</a> <a href="${esc(PROJECTS_PATH)}">${esc(t(locale, "Projects"))}</a></p>
      ${projectsSection(model.projects, model.today, locale)}
      ${upcomingSection(model.dues, model.tickets, locale)}
      ${forecastSection(model.bars, model.budget, locale)}
      ${saleSection(model.sales, locale)}
    </div>`;
}

export async function loadMaintenancePage(db: D1Database, now: string): Promise<MaintenanceModel> {
  const today = await farmToday(db, now);
  const [projectResult, assets, schedules, tickets, budget, forSaleCount] = await Promise.all([
    db.prepare(PROJECTS_SQL).all(),
    listEquipmentAssets(db),
    listAllSchedules(db),
    listOpenTickets(db),
    maintenanceBudget(db),
    countAssetsForSale(db),
  ]);
  const projects = activeProjects(projectsFrom(projectResult));
  const dues = duesFrom(schedules, assets, today);
  const work = tickets
    .map((ticket) => ({ asset: ticket.asset_name, title: ticket.title, age: ageDays(ticket.created_at, today) }))
    .sort((a, b) => b.age - a.age || (a.asset < b.asset ? -1 : a.asset > b.asset ? 1 : 0) || (a.title < b.title ? -1 : 1));
  const sales = saleRows(assets);
  return {
    today,
    projects,
    dues,
    tickets: work,
    bars: forecastBars(dues, today),
    budget,
    sales,
    forSaleCount,
  };
}

function reasonOf(form: FormData): string {
  const reason = textOrNull(form.get("reason"));
  if (!reason) throw refusal(400, { key: "Reason is required.", vars: {} });
  return reason;
}

function dateOf(raw: unknown, key: string): string {
  const text = textOrNull(raw);
  if (!text || !isCalendarDate(text)) throw refusal(400, { key, vars: {} });
  return text;
}

function moneyField(raw: unknown, key: string): number | null {
  const text = textOrNull(raw);
  if (text == null) return null;
  if (!/^\d+(\.\d{1,2})?$/.test(text)) throw refusal(400, { key, vars: {} });
  return Math.round(Number(text) * 100) / 100;
}

function statusField(raw: unknown): ProjectStatus {
  const status = statusOf(textOrNull(raw));
  if (!status) throw refusal(400, { key: "Status must be planned, active, paused, or done.", vars: {} });
  return status;
}

async function farmOrBlank(db: D1Database, raw: unknown): Promise<string | null> {
  const code = textOrNull(raw);
  if (!code) return null;
  const row = await db.prepare(`SELECT code FROM farms WHERE code = ? AND deleted_at IS NULL`).bind(code).first<{ code: string }>();
  if (!row) throw refusal(400, { key: "Pick a farm.", vars: {} });
  return String(row.code);
}

async function loadFarms(db: D1Database): Promise<string[]> {
  const listed = await db.prepare(`SELECT code FROM farms WHERE deleted_at IS NULL ORDER BY code`).all<{ code: string }>();
  return (listed.results ?? []).map((row) => String(row.code));
}

export async function loadProjectsPage(db: D1Database, now: string, showDone: boolean): Promise<ProjectsPageModel> {
  const today = await farmToday(db, now);
  const [listed, farms] = await Promise.all([db.prepare(PROJECTS_SQL).all(), loadFarms(db)]);
  return { today, showDone, farms, projects: projectsFrom(listed) };
}

function statusOptions(selected: string, locale: Locale): string {
  return PROJECT_STATUSES.map(
    (status) => `<option value="${esc(status)}"${status === selected ? " selected" : ""}>${esc(t(locale, status))}</option>`
  ).join("");
}

function farmOptions(farms: readonly string[], selected: string, locale: Locale): string {
  const blank = `<option value=""${selected === "" ? " selected" : ""}>${esc(t(locale, "All farms"))}</option>`;
  return [blank, ...farms.map((code) => `<option value="${esc(code)}"${code === selected ? " selected" : ""}>${esc(code)}</option>`)].join("");
}

function projectCard(project: ProjectRow, today: string, locale: Locale): string {
  return `${projectBarHtml(project, today, locale)}
    <form method="post" action="${esc(`${PROJECTS_PATH}/${project.id}`)}" data-dd-project-edit="${esc(project.id)}">
      <input type="hidden" name="reason" value="${esc(PROJECT_EDIT_REASON)}">
      <div class="dd-labor-fields">
        ${fieldBlock(locale, "Status", `<select name="status">${statusOptions(project.status, locale)}</select>`, "Where the project stands.")}
        ${fieldBlock(locale, "Expected on", `<input type="date" name="expected_on" required value="${esc(project.expected)}">`, "The day the project should be done.")}
        ${fieldBlock(locale, "Cost to date", `<input type="text" name="cost_to_date_usd" inputmode="decimal" value="${esc(project.cost == null ? "" : String(project.cost))}">`, "Dollars spent so far.")}
        ${fieldBlock(locale, "Note", `<input type="text" name="note" value="${esc(project.note ?? "")}">`, "A short note.")}
      </div>
      <button type="submit">${esc(t(locale, "Save"))}</button>
    </form>`;
}

export function projectsPage(model: ProjectsPageModel, locale: Locale = "en"): string {
  const open = model.projects.filter((project) => project.status !== "done");
  const done = model.projects.filter((project) => project.status === "done");
  const toggle = model.showDone
    ? `<a href="${esc(PROJECTS_PATH)}" data-dd-projects-open>${esc(t(locale, "Open projects"))}</a>`
    : `<a href="${esc(`${PROJECTS_PATH}?done=1`)}" data-dd-projects-show-done>${esc(t(locale, "show done"))}</a>`;
  const add = `<form class="dd-labor-add" method="post" action="${esc(PROJECTS_PATH)}" data-dd-project-add>
      <input type="hidden" name="reason" value="${esc(PROJECT_ADD_REASON)}">
      <div class="dd-labor-fields">
        ${fieldBlock(locale, "Name", `<input type="text" name="name" required>`, "The project.")}
        ${fieldBlock(locale, "Owner", `<input type="text" name="owner_name" required>`, "The person running it.")}
        ${fieldBlock(locale, "Farm", `<select name="farm_code">${farmOptions(model.farms, "", locale)}</select>`, "The farm, or all farms.")}
        ${fieldBlock(locale, "Status", `<select name="status">${statusOptions("planned", locale)}</select>`, "Where the project stands.")}
        ${fieldBlock(locale, "Started on", `<input type="date" name="started_on" required value="${esc(model.today)}">`, "The day the project started.")}
        ${fieldBlock(locale, "Expected on", `<input type="date" name="expected_on" required value="${esc(model.today)}">`, "The day the project should be done.")}
        ${fieldBlock(locale, "Budget", `<input type="text" name="budget_usd" inputmode="decimal">`, "The budget in dollars.")}
      </div>
      <button type="submit">${esc(t(locale, "Add"))}</button>
    </form>`;
  const doneHtml = model.showDone
    ? `<h2>${esc(t(locale, "Done"))}</h2>${done.map((project) => projectCard(project, model.today, locale)).join("")}`
    : "";
  return `<div class="dd-labor-page" data-dd-projects data-dd-projects-show-done="${model.showDone ? "1" : "0"}">
      <h1>${esc(t(locale, "Projects"))}</h1>
      <p class="dd-labor-nav"><a href="/admin/director">${esc(t(locale, "Director Dashboard"))}</a> <a href="${esc(MAINTENANCE_PATH)}">${esc(t(locale, "Maintenance"))}</a> ${toggle}</p>
      ${add}
      ${open.map((project) => projectCard(project, model.today, locale)).join("")}
      ${doneHtml}
    </div>`;
}

export async function addProject(db: D1Database, form: FormData, now: string = nowIso()): Promise<{ redirect: string }> {
  const actor = await requireActor(db, textOrNull(form.get("person_id")));
  const name = textOrNull(form.get("name"));
  if (!name) throw refusal(400, { key: "Name is required.", vars: {} });
  const owner = textOrNull(form.get("owner_name"));
  if (!owner) throw refusal(400, { key: "Owner is required.", vars: {} });
  const farm = await farmOrBlank(db, form.get("farm_code"));
  const status = statusField(form.get("status"));
  const started = dateOf(form.get("started_on"), "Started on must be YYYY-MM-DD.");
  const expected = dateOf(form.get("expected_on"), "Expected on must be YYYY-MM-DD.");
  const budget = moneyField(form.get("budget_usd"), "Budget must be a number of dollars.");
  const reason = reasonOf(form);
  const id = crypto.randomUUID();
  const record = {
    name,
    owner_name: owner,
    farm_code: farm,
    status,
    started_on: started,
    expected_on: expected,
    budget_usd: budget,
    created_by: actor.id,
    created_at: now,
  };
  await db.batch([
    db
      .prepare(
        `INSERT INTO dd_projects (
           id, name, owner_name, farm_code, status, started_on, expected_on, cost_to_date_usd, budget_usd, note,
           created_at, created_by, updated_at, updated_by, deleted_at, deleted_by, delete_reason
         ) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?, NULL, ?, ?, ?, NULL, NULL, NULL, NULL)`
      )
      .bind(id, name, owner, farm, status, started, expected, budget, now, actor.id, now),
    ...logsForInsert(db, "dd_projects", id, record, actor.id, reason, now),
  ]);
  return { redirect: `${PROJECTS_PATH}?ok=saved` };
}

type StoredProject = ProjectRow & { farm_code: string | null };

async function liveProject(db: D1Database, id: string): Promise<StoredProject> {
  const row = await db
    .prepare(
      `SELECT id, name, owner_name, farm_code, status, started_on, expected_on, cost_to_date_usd, budget_usd, note
       FROM dd_projects WHERE id = ? AND deleted_at IS NULL`
    )
    .bind(id)
    .first<Record<string, unknown>>();
  const project = row ? projectFrom(row) : null;
  if (!project) throw refusal(404, { key: "That project is not on the list.", vars: {} });
  return { ...project, farm_code: project.farm };
}

function sameMoney(a: number | null, b: number | null): boolean {
  if (a == null && b == null) return true;
  if (a == null || b == null) return false;
  return Math.round(a * 100) === Math.round(b * 100);
}

export async function updateProject(db: D1Database, id: string, form: FormData, now: string = nowIso()): Promise<{ redirect: string }> {
  const actor = await requireActor(db, textOrNull(form.get("person_id")));
  const current = await liveProject(db, id);
  const status = statusField(form.get("status"));
  const expected = dateOf(form.get("expected_on"), "Expected on must be YYYY-MM-DD.");
  const cost = moneyField(form.get("cost_to_date_usd"), "Cost to date must be a number of dollars.");
  const note = textOrNull(form.get("note"));
  const reason = reasonOf(form);
  const logs: D1PreparedStatement[] = [];
  const change = (field: string, oldValue: string | null, newValue: string | null) => {
    if (oldValue === newValue) return;
    logs.push(
      insertLog(db, {
        record_table: "dd_projects",
        record_id: current.id,
        field,
        old_value: oldValue,
        new_value: newValue,
        actor_person_id: actor.id,
        reason,
        changed_at: now,
      })
    );
  };
  change("status", current.status, status);
  change("expected_on", current.expected, expected);
  if (!sameMoney(current.cost, cost)) change("cost_to_date_usd", current.cost == null ? null : String(current.cost), cost == null ? null : String(cost));
  change("note", current.note, note);
  if (logs.length === 0) return { redirect: `${PROJECTS_PATH}?ok=saved` };
  await db.batch([
    db
      .prepare(
        `UPDATE dd_projects
         SET status = ?, expected_on = ?, cost_to_date_usd = ?, note = ?, updated_at = ?, updated_by = ?
         WHERE id = ? AND deleted_at IS NULL`
      )
      .bind(status, expected, cost, note, now, actor.id, current.id),
    ...logs,
  ]);
  return { redirect: status === "done" ? `${PROJECTS_PATH}?done=1&ok=saved` : `${PROJECTS_PATH}?ok=saved` };
}
