/**
 * DD L2: the harvest plan. A director types the rows after the morning
 * sit-down. A row is done when someone presses Done, or when a harvest batch
 * of that strain and farm is cut on or after the planned date. The farmops
 * tile reads the live rows. It does not keep a dd_kpi_values series.
 */
import { nowIso, refusal, textOrNull } from "./audit";
import { insertLog, logsForInsert, requireActor } from "./db";
import { dayOffset, farmDay, isCalendarDate, parseFarmDayStartHour } from "./farmday";
import { t, tFill, type Locale } from "./i18n";
import { parseHbn } from "./mint";
import { esc, fieldBlock } from "./ui";

export const HARVEST_PLAN_PATH = "/admin/director/harvest-plan";
export const HARVEST_SCHEDULE_KPI = "harvest.harvest_schedule";
export const HARVEST_PLAN_REASON = "Weekly check-in";
export const PLAN_HORIZON_DAYS = 21;
export const PLAN_DONE_KEEP_DAYS = 14;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const SHORT_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export type HarvestCut = {
  hbn: string;
  farm: string;
  strainName: string;
  marketStrain: string;
  date: string;
};

export type PlanSource = {
  id: string;
  strain: string;
  farm: string;
  planned: string;
  plants: number | null;
  note: string | null;
  doneAt: string | null;
};

export type PlanRow = PlanSource & {
  cut: { date: string; hbn: string } | null;
  doneOn: string | null;
};

export type HarvestScheduleModel = {
  today: string;
  rows: PlanRow[];
};

export type HarvestPlanPageModel = HarvestScheduleModel & {
  showDone: boolean;
  strains: string[];
  farms: Array<{ code: string; name: string }>;
};

/** The harvest day: entry_date when it is a calendar date, else the day parseHbn reads from the HBN. */
export function harvestCutDate(entryDate: string | null | undefined, hbn: string | null | undefined): string | null {
  const entry = String(entryDate ?? "").trim();
  if (isCalendarDate(entry)) return entry;
  const day = parseHbn(hbn)?.harvest_day ?? null;
  return day && isCalendarDate(day) ? day : null;
}

/** The earliest cut of this strain and farm on or after the planned date. A test batch
 * (harvest_batches.is_test = 1) is not a cut: HARVEST_CUTS_SQL leaves it out (owner, 2026-10-21). */
export function matchingCut(plan: { strain: string; farm: string; planned: string }, cuts: readonly HarvestCut[]): HarvestCut | null {
  const strain = plan.strain.trim();
  let best: HarvestCut | null = null;
  for (const cut of cuts) {
    if (cut.farm !== plan.farm || !isCalendarDate(cut.date) || cut.date < plan.planned) continue;
    const market = cut.marketStrain.trim();
    const name = cut.strainName.trim();
    if (market !== strain && name !== strain) continue;
    if (!best || cut.date < best.date || (cut.date === best.date && cut.hbn < best.hbn)) best = cut;
  }
  return best;
}

/** The day the row became done: the earlier of the Done stamp and the cut. */
export function planDoneOn(planned: string, doneAt: string | null, cutDate: string | null, startHour: number): string | null {
  const stamped = doneAt && String(doneAt).trim() !== "" ? farmDay(doneAt, startHour) : "";
  const button = isCalendarDate(stamped) ? stamped : null;
  const cut = cutDate && isCalendarDate(cutDate) && cutDate >= planned ? cutDate : null;
  if (button && cut) return button < cut ? button : cut;
  return button ?? cut;
}

/** A done row stays on the form for 14 days. Older done rows wait for show done. */
export function planOnForm(doneOn: string | null, today: string, showDone: boolean): boolean {
  if (!doneOn) return true;
  if (showDone) return true;
  return doneOn >= dayOffset(today, -PLAN_DONE_KEEP_DAYS);
}

/** The default tile keeps overdue rows and the next 21 days. Later rows wait for all. */
export function planOnDefault(planned: string, today: string): boolean {
  return isCalendarDate(planned) && planned <= dayOffset(today, PLAN_HORIZON_DAYS - 1);
}

/** The footer counts strains and plants whose planned date falls in the next 21 days. */
export function planInHorizon(planned: string, today: string): boolean {
  if (!isCalendarDate(planned) || !isCalendarDate(today)) return false;
  return planned >= today && planned <= dayOffset(today, PLAN_HORIZON_DAYS - 1);
}

export function planOverdue(planned: string, today: string, doneOn: string | null): boolean {
  return !doneOn && isCalendarDate(planned) && isCalendarDate(today) && planned < today;
}

export function planFoot(rows: readonly PlanRow[], today: string): { strains: number; plants: number } {
  const open = rows.filter((row) => !row.doneOn && planInHorizon(row.planned, today));
  const strains = new Set(open.map((row) => row.strain));
  const plants = open.reduce((sum, row) => sum + (row.plants ?? 0), 0);
  return { strains: strains.size, plants };
}

export function spokenDate(day: string, locale: Locale): string {
  const dow = new Date(`${day}T00:00:00.000Z`).getUTCDay();
  const month = MONTHS[Number(day.slice(5, 7)) - 1] ?? "Jan";
  const n = String(Number(day.slice(8, 10)));
  return `${t(locale, SHORT_DAYS[dow] ?? "Sun")}, ${t(locale, month)} ${n}`;
}

export function monthDay(day: string, locale: Locale): string {
  const month = MONTHS[Number(day.slice(5, 7)) - 1] ?? "Jan";
  return `${t(locale, month)} ${String(Number(day.slice(8, 10)))}`;
}

export function planFootLine(strains: number, plants: number, locale: Locale): string {
  return tFill(locale, "{n} {strains}, {m} {plants} planned in the next 21 days", {
    n: String(strains),
    m: String(plants),
    strains: t(locale, strains === 1 ? "strain" : "strains"),
    plants: t(locale, plants === 1 ? "plant" : "plants"),
  });
}

export const HARVEST_PLAN_SQL = `SELECT id, strain, farm_code, planned_date, plants, note, done_at
     FROM dd_harvest_plan
     WHERE deleted_at IS NULL
     ORDER BY planned_date, strain, farm_code, id`;

export const HARVEST_CUTS_SQL = `SELECT b.hbn AS hbn, b.entry_date AS entry_date, b.farm_code AS farm_code,
            COALESCE(b.market_strain, '') AS market_strain,
            COALESCE(s.name, '') AS strain_name
     FROM harvest_batches b
     LEFT JOIN strains s ON s.id = b.strain_id
     WHERE b.deleted_at IS NULL AND COALESCE(b.is_test, 0) = 0`;

export function harvestPlanStatement(db: D1Database): D1PreparedStatement {
  return db.prepare(HARVEST_PLAN_SQL);
}

export function harvestCutsStatement(db: D1Database): D1PreparedStatement {
  return db.prepare(HARVEST_CUTS_SQL);
}

function rowsOf(result: unknown): Record<string, unknown>[] {
  const rows = (result as { results?: unknown } | undefined)?.results;
  return Array.isArray(rows) ? (rows as Record<string, unknown>[]) : [];
}

function plantsOfRow(value: unknown): number | null {
  if (value == null || String(value).trim() === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

export function planRowsFrom(planResult: unknown, cutsResult: unknown, startHour: number): PlanRow[] {
  const cuts: HarvestCut[] = [];
  for (const row of rowsOf(cutsResult)) {
    const date = harvestCutDate(row.entry_date == null ? null : String(row.entry_date), row.hbn == null ? null : String(row.hbn));
    if (!date) continue;
    cuts.push({
      hbn: String(row.hbn ?? ""),
      farm: String(row.farm_code ?? ""),
      strainName: String(row.strain_name ?? ""),
      marketStrain: String(row.market_strain ?? ""),
      date,
    });
  }
  return rowsOf(planResult).map((row) => {
    const source: PlanSource = {
      id: String(row.id ?? ""),
      strain: String(row.strain ?? "").trim(),
      farm: String(row.farm_code ?? "").trim(),
      planned: String(row.planned_date ?? ""),
      plants: plantsOfRow(row.plants),
      note: row.note == null || String(row.note).trim() === "" ? null : String(row.note),
      doneAt: row.done_at == null || String(row.done_at).trim() === "" ? null : String(row.done_at),
    };
    const cut = matchingCut({ strain: source.strain, farm: source.farm, planned: source.planned }, cuts);
    return {
      ...source,
      cut: cut ? { date: cut.date, hbn: cut.hbn } : null,
      doneOn: planDoneOn(source.planned, source.doneAt, cut?.date ?? null, startHour),
    };
  });
}

export function emptyHarvestSchedule(today: string): HarvestScheduleModel {
  return { today, rows: [] };
}

export function planModelFromResults(planResult: unknown, cutsResult: unknown, startHourResult: unknown, today: string): HarvestScheduleModel {
  const hourRow = rowsOf(startHourResult)[0];
  const startHour = parseFarmDayStartHour(hourRow?.value == null ? null : String(hourRow.value));
  const rows = planRowsFrom(planResult, cutsResult, startHour).filter((row) => !row.doneOn && isCalendarDate(row.planned));
  rows.sort((a, b) => (a.planned < b.planned ? -1 : a.planned > b.planned ? 1 : a.strain < b.strain ? -1 : a.strain > b.strain ? 1 : 0));
  return { today, rows };
}

function plantsLabel(plants: number | null, locale: Locale): string {
  if (plants == null) return "";
  return `${plants} ${t(locale, plants === 1 ? "plant" : "plants")}`;
}

function planItem(row: PlanRow, today: string, locale: Locale): string {
  const overdue = planOverdue(row.planned, today, row.doneOn);
  const plants = plantsLabel(row.plants, locale);
  return `<li class="dd-plan-item" data-dd-plan-date="${esc(row.planned)}" data-dd-plan-strain="${esc(row.strain)}" data-dd-plan-farm="${esc(row.farm)}" data-dd-plan-plants="${esc(row.plants ?? "")}" data-dd-plan-overdue="${overdue ? "1" : "0"}">
      <span class="dd-plan-date">${esc(spokenDate(row.planned, locale))}</span>
      <span class="dd-plan-strain">${esc(row.strain)}</span>
      <span class="dd-plan-farm">${esc(row.farm)}</span>
      ${plants ? `<span class="dd-plan-plants">${esc(plants)}</span>` : ""}
      ${overdue ? `<span class="dd-plan-overdue">${esc(t(locale, "overdue"))}</span>` : ""}
    </li>`;
}

/** The farmops tile: the next 21 days, overdue rows included, and all on tap. */
export function harvestScheduleBody(model: HarvestScheduleModel, locale: Locale): string {
  const open = model.rows.filter((row) => !row.doneOn);
  const link = `<p class="dd-plan-link"><a href="${esc(HARVEST_PLAN_PATH)}">${esc(t(locale, "Add or update"))}</a></p>`;
  if (open.length === 0) {
    return `<div class="dd-plan" data-dd-plan data-dd-plan-empty="1">
      <p class="dd-plan-empty" data-dd-plan-empty>${esc(t(locale, "No upcoming harvests entered"))}</p>
      ${link}
    </div>`;
  }
  const near = open.filter((row) => planOnDefault(row.planned, model.today));
  const foot = planFoot(open, model.today);
  const list = (rows: readonly PlanRow[], span: string) =>
    `<ul class="dd-plan-list" data-dd-plan-span="${esc(span)}">${rows.map((row) => planItem(row, model.today, locale)).join("")}</ul>`;
  return `<div class="dd-plan" data-dd-plan data-dd-plan-empty="0">
      <label class="dd-plan-all"><input type="checkbox" data-dd-plan-all> ${esc(t(locale, "all"))}</label>
      <div class="dd-plan-span-21">${list(near, "21")}</div>
      <div class="dd-plan-span-all">${list(open, "all")}</div>
      <p class="dd-plan-foot" data-dd-plan-foot>${esc(planFootLine(foot.strains, foot.plants, locale))}</p>
      ${link}
    </div>`;
}

function options(values: readonly string[], selected: string): string {
  return [`<option value=""></option>`, ...values.map((value) => `<option value="${esc(value)}"${value === selected ? " selected" : ""}>${esc(value)}</option>`)].join("");
}

function reasonField(locale: Locale): string {
  return `<input type="hidden" name="reason" value="${esc(t(locale, HARVEST_PLAN_REASON))}">`;
}

function planCard(row: PlanRow, model: HarvestPlanPageModel, locale: Locale): string {
  const strains = model.strains.includes(row.strain) ? model.strains : [...model.strains, row.strain];
  const farms = model.farms.some((farm) => farm.code === row.farm) ? model.farms : [...model.farms, { code: row.farm, name: row.farm }];
  const cut = row.cut
    ? `<p class="dd-plan-cut" data-dd-plan-cut>${esc(tFill(locale, "cut {date}, HBN {hbn}", { date: monthDay(row.cut.date, locale), hbn: row.cut.hbn }))}</p>`
    : "";
  const stamped = row.doneAt && !row.cut ? `<p class="dd-plan-stamped" data-dd-plan-stamped>${esc(t(locale, "Done"))}</p>` : "";
  return `<article class="dd-plan-card" data-dd-plan-id="${esc(row.id)}" data-dd-plan-done="${row.doneOn ? "1" : "0"}">
      <form method="post" action="${esc(`${HARVEST_PLAN_PATH}/${row.id}`)}">
        ${reasonField(locale)}
        <div class="dd-plan-fields">
          ${fieldBlock(locale, "Strain", `<select name="strain" required>${options(strains, row.strain)}</select>`, "The strain this harvest is.")}
          ${fieldBlock(locale, "Farm", `<select name="farm_code" required>${options(farms.map((farm) => farm.code), row.farm)}</select>`, "The farm this harvest is.")}
          ${fieldBlock(locale, "Planned date", `<input type="date" name="planned_date" required value="${esc(row.planned)}">`, "The date the harvest is planned.")}
          ${fieldBlock(locale, "Plants", `<input type="text" name="plants" inputmode="numeric" value="${esc(row.plants ?? "")}">`, "How many plants, if known.")}
          ${fieldBlock(locale, "Note", `<input type="text" name="note" value="${esc(row.note ?? "")}">`, "A note, optional.")}
        </div>
        <button type="submit">${esc(t(locale, "Save"))}</button>
      </form>
      ${cut}${stamped}
      <form method="post" action="${esc(`${HARVEST_PLAN_PATH}/${row.id}/done`)}">
        ${reasonField(locale)}
        <button type="submit">${esc(t(locale, "Done"))}</button>
      </form>
      <form method="post" action="${esc(`${HARVEST_PLAN_PATH}/${row.id}/delete`)}">
        <input type="text" name="reason" required aria-label="${esc(t(locale, "Reason"))}">
        <button type="submit">${esc(t(locale, "Delete"))}</button>
      </form>
    </article>`;
}

export function harvestPlanPage(model: HarvestPlanPageModel, locale: Locale = "en"): string {
  const shown = model.rows.filter((row) => planOnForm(row.doneOn, model.today, model.showDone));
  const toggle = model.showDone
    ? `<a href="${esc(HARVEST_PLAN_PATH)}" data-dd-plan-upcoming>${esc(t(locale, "Upcoming"))}</a>`
    : `<a href="${esc(`${HARVEST_PLAN_PATH}?done=1`)}" data-dd-plan-show-done>${esc(t(locale, "show done"))}</a>`;
  const add = `<form class="dd-plan-add" method="post" action="${esc(HARVEST_PLAN_PATH)}" data-dd-plan-add>
      ${reasonField(locale)}
      <div class="dd-plan-fields">
        ${fieldBlock(locale, "Strain", `<select name="strain" required>${options(model.strains, "")}</select>`, "The strain this harvest is.")}
        ${fieldBlock(locale, "Farm", `<select name="farm_code" required>${options(model.farms.map((farm) => farm.code), "")}</select>`, "The farm this harvest is.")}
        ${fieldBlock(locale, "Planned date", `<input type="date" name="planned_date" required value="${esc(model.today)}">`, "The date the harvest is planned.")}
        ${fieldBlock(locale, "Plants", `<input type="text" name="plants" inputmode="numeric">`, "How many plants, if known.")}
        ${fieldBlock(locale, "Note", `<input type="text" name="note">`, "A note, optional.")}
      </div>
      <button type="submit">${esc(t(locale, "Add"))}</button>
    </form>`;
  return `<div class="dd-plan-page" data-dd-harvest-plan data-dd-plan-show-done="${model.showDone ? "1" : "0"}">
      <h1>${esc(t(locale, "Harvest Schedule"))}</h1>
      <p class="dd-plan-nav"><a href="/admin/director">${esc(t(locale, "Director Dashboard"))}</a> ${toggle}</p>
      ${add}
      ${shown.map((row) => planCard(row, model, locale)).join("")}
    </div>`;
}

async function startHour(db: D1Database): Promise<number> {
  const row = await db.prepare(`SELECT value FROM app_config WHERE key = 'farm_day_start_hour' AND deleted_at IS NULL`).first<{ value: string }>();
  return parseFarmDayStartHour(row?.value ?? null);
}

async function pageReads(db: D1Database): Promise<[unknown, unknown, unknown, unknown]> {
  const [strains, farms, plans, cuts] = await db.batch([
    db.prepare(`SELECT DISTINCT name FROM strains WHERE deleted_at IS NULL AND TRIM(name) <> '' ORDER BY name`),
    db.prepare(`SELECT code, display_name AS name FROM farms WHERE deleted_at IS NULL ORDER BY code`),
    harvestPlanStatement(db),
    harvestCutsStatement(db),
  ]);
  return [strains, farms, plans, cuts];
}

export async function loadHarvestPlanPage(db: D1Database, now: string, showDone: boolean): Promise<HarvestPlanPageModel> {
  const hour = await startHour(db);
  const today = farmDay(now, hour);
  const [strains, farms, plans, cuts] = await pageReads(db);
  const rows = planRowsFrom(plans, cuts, hour).filter((row) => isCalendarDate(row.planned));
  rows.sort((a, b) => (a.planned < b.planned ? -1 : a.planned > b.planned ? 1 : a.strain < b.strain ? -1 : 0));
  return {
    today,
    showDone,
    rows,
    strains: rowsOf(strains).map((row) => String(row.name ?? "")).filter((name) => name !== ""),
    farms: rowsOf(farms).map((row) => ({ code: String(row.code ?? ""), name: String(row.name ?? row.code ?? "") })),
  };
}

function dateOf(raw: unknown, key: string): string {
  const text = textOrNull(raw);
  if (!text || !isCalendarDate(text)) throw refusal(400, { key, vars: {} });
  return text;
}

function plantsField(raw: unknown): number | null {
  const text = textOrNull(raw);
  if (text == null) return null;
  if (!/^\d+$/.test(text)) throw refusal(400, { key: "Plants must be a whole number.", vars: {} });
  return Number(text);
}

async function liveStrain(db: D1Database, raw: unknown): Promise<string> {
  const name = textOrNull(raw);
  if (!name) throw refusal(400, { key: "Pick a strain.", vars: {} });
  const row = await db.prepare(`SELECT name FROM strains WHERE name = ? AND deleted_at IS NULL`).bind(name).first<{ name: string }>();
  if (!row) throw refusal(400, { key: "Pick a strain.", vars: {} });
  return String(row.name);
}

async function liveFarm(db: D1Database, raw: unknown): Promise<string> {
  const code = textOrNull(raw);
  if (!code) throw refusal(400, { key: "Pick a farm.", vars: {} });
  const row = await db.prepare(`SELECT code FROM farms WHERE code = ? AND deleted_at IS NULL`).bind(code).first<{ code: string }>();
  if (!row) throw refusal(400, { key: "Pick a farm.", vars: {} });
  return String(row.code);
}

function reasonOf(form: FormData): string {
  const reason = textOrNull(form.get("reason"));
  if (!reason) throw refusal(400, { key: "Reason is required.", vars: {} });
  return reason;
}

type PlanStored = {
  id: string;
  strain: string;
  farm_code: string;
  planned_date: string;
  plants: number | null;
  note: string | null;
  done_at: string | null;
};

async function livePlan(db: D1Database, id: string): Promise<PlanStored> {
  const row = await db
    .prepare(
      `SELECT id, strain, farm_code, planned_date, plants, note, done_at
       FROM dd_harvest_plan WHERE id = ? AND deleted_at IS NULL`
    )
    .bind(id)
    .first<PlanStored>();
  if (!row) throw refusal(404, { key: "That plan row is not on the list.", vars: {} });
  return {
    id: String(row.id),
    strain: String(row.strain),
    farm_code: String(row.farm_code),
    planned_date: String(row.planned_date),
    plants: plantsOfRow(row.plants),
    note: row.note == null || String(row.note) === "" ? null : String(row.note),
    done_at: row.done_at == null || String(row.done_at) === "" ? null : String(row.done_at),
  };
}

export async function addHarvestPlan(db: D1Database, form: FormData, now: string = nowIso()): Promise<{ redirect: string }> {
  const actor = await requireActor(db, textOrNull(form.get("person_id")));
  const strain = await liveStrain(db, form.get("strain"));
  const farm = await liveFarm(db, form.get("farm_code"));
  const planned = dateOf(form.get("planned_date"), "Planned date must be YYYY-MM-DD.");
  const plants = plantsField(form.get("plants"));
  const note = textOrNull(form.get("note"));
  const reason = reasonOf(form);
  const id = crypto.randomUUID();
  const record = {
    strain,
    farm_code: farm,
    planned_date: planned,
    plants,
    note,
    created_by: actor.id,
    created_at: now,
  };
  await db.batch([
    db
      .prepare(
        `INSERT INTO dd_harvest_plan (
           id, strain, farm_code, planned_date, plants, note, done_at,
           created_at, created_by, updated_at, updated_by, deleted_at, deleted_by, delete_reason
         ) VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, NULL, NULL, NULL, NULL)`
      )
      .bind(id, strain, farm, planned, plants, note, now, actor.id, now),
    ...logsForInsert(db, "dd_harvest_plan", id, record, actor.id, reason, now),
  ]);
  return { redirect: `${HARVEST_PLAN_PATH}?ok=saved` };
}

export async function updateHarvestPlan(db: D1Database, id: string, form: FormData, now: string = nowIso()): Promise<{ redirect: string }> {
  const actor = await requireActor(db, textOrNull(form.get("person_id")));
  const current = await livePlan(db, id);
  const strain = await liveStrain(db, form.get("strain"));
  const farm = await liveFarm(db, form.get("farm_code"));
  const planned = dateOf(form.get("planned_date"), "Planned date must be YYYY-MM-DD.");
  const plants = plantsField(form.get("plants"));
  const note = textOrNull(form.get("note"));
  const reason = reasonOf(form);
  const next = { strain, farm_code: farm, planned_date: planned, plants, note };
  const logs: D1PreparedStatement[] = [];
  const changed = (field: string, oldValue: string | null, newValue: string | null) => {
    if (oldValue === newValue) return;
    logs.push(
      insertLog(db, {
        record_table: "dd_harvest_plan",
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
  changed("strain", current.strain, next.strain);
  changed("farm_code", current.farm_code, next.farm_code);
  changed("planned_date", current.planned_date, next.planned_date);
  changed("plants", current.plants == null ? null : String(current.plants), next.plants == null ? null : String(next.plants));
  changed("note", current.note, next.note);
  if (logs.length === 0) return { redirect: `${HARVEST_PLAN_PATH}?ok=saved` };
  await db.batch([
    db
      .prepare(
        `UPDATE dd_harvest_plan
         SET strain = ?, farm_code = ?, planned_date = ?, plants = ?, note = ?, updated_at = ?, updated_by = ?
         WHERE id = ? AND deleted_at IS NULL`
      )
      .bind(strain, farm, planned, plants, note, now, actor.id, current.id),
    ...logs,
  ]);
  return { redirect: `${HARVEST_PLAN_PATH}?ok=saved` };
}

export async function doneHarvestPlan(db: D1Database, id: string, form: FormData, now: string = nowIso()): Promise<{ redirect: string }> {
  const actor = await requireActor(db, textOrNull(form.get("person_id")));
  const current = await livePlan(db, id);
  const reason = reasonOf(form);
  if (current.done_at) return { redirect: `${HARVEST_PLAN_PATH}?ok=saved` };
  await db.batch([
    db.prepare(`UPDATE dd_harvest_plan SET done_at = ?, updated_at = ?, updated_by = ? WHERE id = ? AND deleted_at IS NULL`).bind(now, now, actor.id, current.id),
    insertLog(db, {
      record_table: "dd_harvest_plan",
      record_id: current.id,
      field: "done_at",
      old_value: null,
      new_value: now,
      actor_person_id: actor.id,
      reason,
      changed_at: now,
    }),
  ]);
  return { redirect: `${HARVEST_PLAN_PATH}?ok=saved` };
}

export async function deleteHarvestPlan(db: D1Database, id: string, form: FormData, now: string = nowIso()): Promise<{ redirect: string }> {
  const actor = await requireActor(db, textOrNull(form.get("person_id")));
  const current = await livePlan(db, id);
  const reason = reasonOf(form);
  await db.batch([
    db
      .prepare(
        `UPDATE dd_harvest_plan
         SET deleted_at = ?, deleted_by = ?, delete_reason = ?, updated_at = ?, updated_by = ?
         WHERE id = ? AND deleted_at IS NULL`
      )
      .bind(now, actor.id, reason, now, actor.id, current.id),
    insertLog(db, {
      record_table: "dd_harvest_plan",
      record_id: current.id,
      field: "deleted_at",
      old_value: null,
      new_value: now,
      actor_person_id: actor.id,
      reason,
      changed_at: now,
    }),
  ]);
  return { redirect: `${HARVEST_PLAN_PATH}?ok=saved` };
}
