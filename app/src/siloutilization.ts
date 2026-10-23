/**
 * DD L1: Silo Utilization. A silo counts on a farm day when a load of it,
 * not deleted, was loaded on or before the end of that day and had not ended
 * before the day started. The harvest year is the year of the farm today,
 * the same year /harvest reads. The chart reads the stored series. What ran
 * reads silo_loads live. A test batch (harvest_batches.is_test = 1) is
 * not a silo lot: it does not count a silo active and it does not list
 * under What ran.
 */
import { formatLbs } from "./compliance";
import { shortLotId } from "./config";
import { dayOffset, farmDay, farmDayBounds, isCalendarDate, parseFarmDayStartHour } from "./farmday";
import { t, type Locale } from "./i18n";
import { esc } from "./ui";

export const SILO_UTILIZATION_KPI = "harvest.dry_space_utilization_pct";
export const SILO_UTILIZATION_VERSION = 2;
export const SILO_NAMES = ["Silo 1", "Silo 2", "Silo 3", "Silo 4", "Silo 5"] as const;
export const SILO_AXIS = 5;
export const SILO_PLOT_H = 80;
export const SILO_PHONE_DAYS = 30;
export const DRYING_OPS_PATH = "/ops/drying_ops";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export type SiloSpace = { id: string; name: string; kind: string; spaceType: string };

export type SiloLoadFact = {
  spaceId: string;
  loadedAt: string;
  endedAt: string | null;
  deletedAt: string | null;
};

export type SiloDesired = { day: string; dim: string; value: number; n: number };

export type SiloDayPoint = { day: string; count: number; active: string[] };

export type SiloRanLoad = {
  loadedAt: string;
  loadedDay: string;
  endedDay: string | null;
  lot: string;
  strain: string;
  wetLb: string;
};

export type SiloRanRow = { silo: string; loads: SiloRanLoad[] };

export type SiloUtilizationModel = { today: string; days: SiloDayPoint[]; ran: SiloRanRow[] };

type DisplayLoad = SiloLoadFact & SiloSpace & { hbn: string; tag: string | null; strain: string; grams: number };

/** kind silo, space_type silo, and one of Silo 1 to Silo 5. A dry room, a freezer, and the Truck are not. */
export function isCountedSilo(space: { name?: string | null; kind?: string | null; spaceType?: string | null }): boolean {
  const name = String(space.name ?? "").trim();
  const kind = String(space.kind ?? "").trim().toLowerCase();
  const type = String(space.spaceType ?? "silo").trim().toLowerCase();
  return kind === "silo" && type === "silo" && (SILO_NAMES as readonly string[]).includes(name);
}

/**
 * The farm day is [start, end): loaded on or before the end means loaded
 * before the next day's start, and ended after the start means the end
 * instant is still inside the day. A load that ends at the start instant
 * has already left.
 */
export function siloLoadOverlapsDay(loadedAt: string, endedAt: string | null | undefined, day: string, startHour: number): boolean {
  const loaded = Date.parse(loadedAt);
  if (!Number.isFinite(loaded) || !isCalendarDate(day)) return false;
  const bounds = farmDayBounds(day, startHour);
  const start = Date.parse(bounds.startIso);
  const end = Date.parse(bounds.endIso);
  if (!Number.isFinite(start) || !Number.isFinite(end) || !(loaded < end)) return false;
  if (endedAt == null || String(endedAt).trim() === "") return true;
  const ended = Date.parse(endedAt);
  return Number.isFinite(ended) && ended > start;
}

function spaceById(spaces: readonly SiloSpace[]): Map<string, SiloSpace> {
  return new Map(spaces.map((space) => [space.id, space]));
}

function counted(load: SiloLoadFact, spaces: Map<string, SiloSpace>): SiloSpace | null {
  if (load.deletedAt != null && String(load.deletedAt).trim() !== "") return null;
  const space = spaces.get(load.spaceId);
  if (!space || !isCountedSilo(space)) return null;
  return space;
}

/** The first farm day of the harvest year that a counted silo load covers, through today. */
export function siloWindowStart(loads: readonly SiloLoadFact[], spaces: readonly SiloSpace[], startHour: number, today: string): string | null {
  if (!isCalendarDate(today)) return null;
  const year = today.slice(0, 4);
  const yearStart = `${year}-01-01`;
  const byId = spaceById(spaces);
  let first: string | null = null;
  for (const load of loads) {
    if (!counted(load, byId)) continue;
    const loadedDay = farmDay(load.loadedAt, startHour);
    let startDay = loadedDay;
    if (!isCalendarDate(loadedDay)) continue;
    if (loadedDay < yearStart) {
      if (!siloLoadOverlapsDay(load.loadedAt, load.endedAt, yearStart, startHour)) continue;
      startDay = yearStart;
    } else if (!loadedDay.startsWith(`${year}-`)) {
      continue;
    }
    if (startDay > today) continue;
    if (!first || startDay < first) first = startDay;
  }
  return first;
}

function daysInclusive(start: string, end: string): string[] {
  if (!isCalendarDate(start) || !isCalendarDate(end) || start > end) return [];
  const out: string[] = [];
  let day = start;
  for (let i = 0; i < 400 && day <= end; i += 1) {
    out.push(day);
    const next = dayOffset(day, 1);
    if (next === day) break;
    day = next;
  }
  return out;
}

export function siloActiveNames(loads: readonly SiloLoadFact[], spaces: readonly SiloSpace[], day: string, startHour: number): string[] {
  const byId = spaceById(spaces);
  const names = new Set<string>();
  for (const load of loads) {
    const space = counted(load, byId);
    if (!space) continue;
    if (siloLoadOverlapsDay(load.loadedAt, load.endedAt, day, startHour)) names.add(space.name.trim());
  }
  return SILO_NAMES.filter((name) => names.has(name));
}

/** One row per silo (1 or 0) and one "all" row with the count, for every farm day from the first load through today. */
export function planSiloRows(loads: readonly SiloLoadFact[], spaces: readonly SiloSpace[], startHour: number, today: string): SiloDesired[] {
  const first = siloWindowStart(loads, spaces, startHour, today);
  if (!first) return [];
  const out: SiloDesired[] = [];
  for (const day of daysInclusive(first, today)) {
    const active = siloActiveNames(loads, spaces, day, startHour);
    let sum = 0;
    for (const name of SILO_NAMES) {
      const on = active.includes(name) ? 1 : 0;
      sum += on;
      out.push({ day, dim: `silo|${name}`, value: on, n: on });
    }
    out.push({ day, dim: "all", value: sum, n: sum });
  }
  return out;
}

export function siloBarHeight(count: number): number {
  const n = Math.max(0, Math.min(SILO_AXIS, Math.round(count)));
  return Math.round((n / SILO_AXIS) * SILO_PLOT_H * 100) / 100;
}

export function siloPhoneDays<T>(days: readonly T[]): T[] {
  if (days.length <= SILO_PHONE_DAYS) return [...days];
  return days.slice(days.length - SILO_PHONE_DAYS);
}

export const SILO_SERIES_SQL = `SELECT period_start, dim_key, value
     FROM dd_kpi_values
     WHERE kpi_key = '${SILO_UTILIZATION_KPI}' AND period_kind = 'day' AND source = 'app' AND superseded_at IS NULL
       AND period_start >= ? AND period_start <= ?`;

export function siloSeriesStatement(db: D1Database, yearStart: string, yearEnd: string): D1PreparedStatement {
  return db.prepare(SILO_SERIES_SQL).bind(yearStart, yearEnd);
}

export const SILO_LOADS_SQL = `SELECT l.dry_space_id, l.loaded_at, l.ended_at, l.deleted_at,
            d.name AS name, d.kind AS kind, COALESCE(d.space_type, 'silo') AS space_type,
            b.hbn AS hbn, b.metrc_harvest_tag AS tag, b.is_test AS is_test,
            COALESCE(b.market_strain, s.name) AS strain_label,
            w.weight_grams AS grams
     FROM silo_loads l
     LEFT JOIN dry_spaces d ON d.id = l.dry_space_id
     LEFT JOIN wet_weight_entries w ON w.id = l.wet_weight_entry_id
     LEFT JOIN harvest_batches b ON b.id = w.harvest_batch_id
     LEFT JOIN strains s ON s.id = b.strain_id
     WHERE COALESCE(b.is_test, 0) = 0`;

export function siloLoadsStatement(db: D1Database): D1PreparedStatement {
  return db.prepare(SILO_LOADS_SQL);
}

export function siloStartHourStatement(db: D1Database): D1PreparedStatement {
  return db.prepare(`SELECT value FROM app_config WHERE key = 'farm_day_start_hour' AND deleted_at IS NULL`);
}

export const SILO_LIVE_SQL = `SELECT id, period_start, dim_key, value, n, source_as_of
     FROM dd_kpi_values
     WHERE kpi_key = '${SILO_UTILIZATION_KPI}' AND period_kind = 'day' AND source = 'app' AND superseded_at IS NULL
       AND period_start >= ? AND period_start <= ?`;

function isTestBatch(row: Record<string, unknown>): boolean {
  return Number(row.is_test ?? 0) === 1;
}

function rowsOf(result: unknown): Record<string, unknown>[] {
  const rows = (result as { results?: unknown } | undefined)?.results;
  return Array.isArray(rows) ? (rows as Record<string, unknown>[]) : [];
}

function displayFrom(row: Record<string, unknown>): DisplayLoad {
  return {
    spaceId: String(row.dry_space_id ?? ""),
    loadedAt: String(row.loaded_at ?? ""),
    endedAt: row.ended_at == null || String(row.ended_at).trim() === "" ? null : String(row.ended_at),
    deletedAt: row.deleted_at == null || String(row.deleted_at).trim() === "" ? null : String(row.deleted_at),
    id: String(row.dry_space_id ?? ""),
    name: String(row.name ?? ""),
    kind: String(row.kind ?? ""),
    spaceType: String(row.space_type ?? "silo"),
    hbn: String(row.hbn ?? ""),
    tag: row.tag == null ? null : String(row.tag),
    strain: String(row.strain_label ?? "").trim(),
    grams: Number(row.grams ?? 0),
  };
}

function loadInHarvestYear(load: DisplayLoad, today: string, startHour: number): boolean {
  if (!isCalendarDate(today)) return false;
  const year = today.slice(0, 4);
  const yearStart = `${year}-01-01`;
  const loadedDay = farmDay(load.loadedAt, startHour);
  if (!isCalendarDate(loadedDay)) return false;
  if (loadedDay >= yearStart && loadedDay.startsWith(`${year}-`) && loadedDay <= today) return true;
  return loadedDay < yearStart && siloLoadOverlapsDay(load.loadedAt, load.endedAt, yearStart, startHour);
}

export function emptySiloUtilization(today: string): SiloUtilizationModel {
  return { today, days: [], ran: SILO_NAMES.map((silo) => ({ silo, loads: [] })) };
}

export function siloModelFromResults(seriesResult: unknown, loadsResult: unknown, startHourResult: unknown, today: string): SiloUtilizationModel {
  const startHour = parseFarmDayStartHour(rowsOf(startHourResult)[0]?.value == null ? null : String(rowsOf(startHourResult)[0]?.value));
  const byDay = new Map<string, SiloDayPoint>();
  for (const row of rowsOf(seriesResult)) {
    const day = String(row.period_start ?? "");
    if (!isCalendarDate(day)) continue;
    const dim = String(row.dim_key ?? "");
    const value = Math.round(Number(row.value ?? 0));
    const point = byDay.get(day) ?? { day, count: 0, active: [] };
    if (dim === "all") point.count = value;
    else if (dim.startsWith("silo|") && value >= 1) {
      const name = dim.slice("silo|".length);
      if ((SILO_NAMES as readonly string[]).includes(name) && !point.active.includes(name)) point.active.push(name);
    }
    byDay.set(day, point);
  }
  const days = [...byDay.values()]
    .map((point) => {
      const active = SILO_NAMES.filter((name) => point.active.includes(name));
      const count = point.count > 0 || active.length === 0 ? point.count : active.length;
      return { day: point.day, count, active: [...active] };
    })
    .sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : 0));
  const loads = rowsOf(loadsResult)
    .filter((row) => !isTestBatch(row))
    .map(displayFrom)
    .filter((load) => load.deletedAt == null && isCountedSilo(load) && loadInHarvestYear(load, today, startHour))
    .sort((a, b) => (a.loadedAt < b.loadedAt ? -1 : a.loadedAt > b.loadedAt ? 1 : 0));
  const ran = SILO_NAMES.map((silo) => ({
    silo,
    loads: loads
      .filter((load) => load.name.trim() === silo)
      .map((load) => ({
        loadedAt: load.loadedAt,
        loadedDay: farmDay(load.loadedAt, startHour),
        endedDay: load.endedAt ? farmDay(load.endedAt, startHour) : null,
        lot: shortLotId(load.hbn, load.tag),
        strain: load.strain,
        wetLb: formatLbs(Number.isFinite(load.grams) ? load.grams : 0),
      })),
  }));
  return { today, days, ran };
}

function shortDay(day: string, locale: Locale): string {
  const month = t(locale, MONTHS[Number(day.slice(5, 7)) - 1] ?? "Jan");
  const n = String(Number(day.slice(8, 10)));
  return locale === "es" ? `${n} ${month}` : `${month} ${n}`;
}

function weekdayOf(day: string, locale: Locale): string {
  const dow = new Date(`${day}T00:00:00.000Z`).getUTCDay();
  return t(locale, WEEKDAYS[dow] ?? "Sunday");
}

export function siloDetail(point: SiloDayPoint, locale: Locale): string {
  const who = point.active.length > 0 ? point.active.join(", ") : t(locale, "none");
  return `${weekdayOf(point.day, locale)}, ${shortDay(point.day, locale)}. ${point.day}. ${point.count}. ${who}`;
}

function isMonday(day: string): boolean {
  return new Date(`${day}T00:00:00.000Z`).getUTCDay() === 1;
}

function chartSvg(days: readonly SiloDayPoint[], locale: Locale): string {
  const n = Math.max(days.length, 1);
  const slot = 14;
  const padL = 28;
  const padR = 8;
  const padT = 18;
  const padB = 22;
  const width = padL + padR + n * slot;
  const height = padT + SILO_PLOT_H + padB;
  const base = padT + SILO_PLOT_H;
  const axis = [0, 1, 2, 3, 4, 5]
    .map((mark) => {
      const y = base - (mark / SILO_AXIS) * SILO_PLOT_H;
      return `<line class="dd-silo-line" x1="${padL}" y1="${y}" x2="${width - padR}" y2="${y}"></line>
        <text class="dd-silo-label" data-dd-silo-axis="${mark}" x="${padL - 4}" y="${y + 3}" text-anchor="end">${mark}</text>`;
    })
    .join("");
  const bars = days
    .map((point, index) => {
      const x = padL + index * slot;
      const barH = siloBarHeight(point.count);
      const y = base - barH;
      const label = isMonday(point.day)
        ? `<text class="dd-silo-label" data-dd-silo-monday="${esc(point.day)}" x="${x + slot / 2}" y="${height - 6}" text-anchor="middle">${esc(shortDay(point.day, locale))}</text>`
        : "";
      const detail = siloDetail(point, locale);
      return `<g data-dd-silo-bar="1" data-dd-silo-day="${esc(point.day)}" data-dd-silo-count="${point.count}" data-dd-silo-height="${barH}" data-dd-silo-active="${esc(point.active.join(","))}" data-dd-silo-detail="${esc(detail)}" tabindex="0" role="img">
          <title>${esc(detail)}</title>
          <rect class="dd-silo-hit" x="${x}" y="${padT}" width="${slot}" height="${SILO_PLOT_H}"></rect>
          <rect class="dd-silo-fill" data-dd-silo-fill="1" x="${x + 2}" y="${y}" width="${slot - 4}" height="${barH}"></rect>
          <text class="dd-silo-count" x="${x + slot / 2}" y="${Math.max(10, y - 2)}" text-anchor="middle">${esc(String(point.count))}</text>
          ${label}
        </g>`;
    })
    .join("");
  return `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${esc(t(locale, "Silo Utilization"))}">${axis}${bars}</svg>`;
}

function ranHtml(model: SiloUtilizationModel, locale: Locale): string {
  const blocks = model.ran
    .map((row) => {
      const items = row.loads
        .map((load) => {
          const ended = load.endedDay ?? t(locale, "still in");
          const parts = [`${load.loadedDay} ${t(locale, "to")} ${ended}`, load.lot, load.strain, `${load.wetLb} ${t(locale, "lb")}`].filter((part) => part.trim() !== "");
          return `<li data-dd-silo-load data-dd-silo-loaded="${esc(load.loadedDay)}" data-dd-silo-unloaded="${esc(load.endedDay ?? "still in")}">${esc(parts.join(", "))}</li>`;
        })
        .join("");
      const list = items ? `<ul>${items}</ul>` : `<p class="dd-silo-none">${esc(t(locale, "none"))}</p>`;
      return `<section data-dd-silo-silo="${esc(row.silo)}"><h3>${esc(row.silo)}</h3>${list}</section>`;
    })
    .join("");
  return `<details class="dd-silo-ran" data-dd-silo-ran open><summary>${esc(t(locale, "What ran"))}</summary>${blocks}</details>`;
}

function siloScript(): string {
  return `<script>
(function () {
  var root = document.querySelector("[data-dd-silo]");
  if (!root) return;
  if (document.body.classList.contains("device-phone")) {
    var ran = root.querySelector("[data-dd-silo-ran]");
    if (ran) ran.removeAttribute("open");
  }
  var tip = root.querySelector("[data-dd-silo-tip]");
  function show(bar) {
    if (!tip) return;
    tip.textContent = bar.getAttribute("data-dd-silo-detail") || "";
    tip.hidden = false;
  }
  var bars = root.querySelectorAll("[data-dd-silo-bar]");
  for (var i = 0; i < bars.length; i++) {
    bars[i].addEventListener("mouseenter", function () { show(this); });
    bars[i].addEventListener("click", function () { show(this); });
    bars[i].addEventListener("focus", function () { show(this); });
  }
})();
</script>`;
}

export function siloUtilizationBody(model: SiloUtilizationModel, locale: Locale): string {
  const recent = siloPhoneDays(model.days);
  return `<div class="dd-silo" data-dd-silo>
      <p class="dd-silo-lead">${esc(t(locale, "Silos with material in them, each day of the harvest"))}</p>
      <p class="dd-silo-link"><a href="${esc(DRYING_OPS_PATH)}">${esc(t(locale, "Drying Operations"))}</a></p>
      <label class="dd-silo-toggle"><input type="checkbox" data-dd-silo-whole> ${esc(t(locale, "whole harvest"))}</label>
      <div class="dd-silo-span-30" data-dd-silo-span="30">${chartSvg(recent, locale)}</div>
      <div class="dd-silo-span-all" data-dd-silo-span="all">${chartSvg(model.days, locale)}</div>
      <p class="dd-silo-tip" data-dd-silo-tip hidden></p>
      ${ranHtml(model, locale)}
      ${siloScript()}
    </div>`;
}
