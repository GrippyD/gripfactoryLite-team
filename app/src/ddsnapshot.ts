/**
 * DD S3a: the stored series for Lbs Harvested (bizops.lbs_processed).
 * Wet pounds are the console's yearWet law (own lots of the harvest year),
 * summed by the tote's farm day. The wall only reads. The hourly cron and
 * the Admin recompute button are the writers.
 *
 * DD S3b: Lbs/Labor Hour vs Goal (bizops.lbs_per_dlh) beside it. The day's
 * wet pounds are the console's day wet law, every lot, toll lots included.
 * The day's hours are the ALL row, else the sum of the farm rows.
 */
import { CONFIG_KEYS } from "./config";
import { getConfigValue } from "./db";
import { dayOffset, farmDay, farmDayBounds, isCalendarDate, parseFarmDayStartHour } from "./farmday";
import { t, tFill, type Locale } from "./i18n";
import { ownLotSql } from "./toll";
import { esc } from "./ui";

export const LBS_HARVESTED_KPI = "bizops.lbs_processed";
export const LBS_HARVESTED_VERSION = 2;
export const LBS_HARVESTED_GRAMS = 448;
export const LBS_HARVESTED_FARMS = ["PNN", "PNS", "ARL"] as const;
export type LbsHarvestedFarm = (typeof LBS_HARVESTED_FARMS)[number];

/** Grams over 448, rounded half up to 2 decimals. */
export function wetPounds(grams: number): number {
  if (!Number.isFinite(grams)) return 0;
  return Math.round((grams * 100) / LBS_HARVESTED_GRAMS) / 100;
}

export type WetHourRow = {
  hour_key: string;
  farm: string | null;
  grams: number;
  n: number;
  newest: string;
};

export type WetDayFarm = {
  day: string;
  farm: string;
  grams: number;
  n: number;
  newest: string;
};

/** Fold UTC hours into farm days. One UTC hour sits inside one Eastern hour, so the hour's start instant names the farm day. */
export function foldWetHours(rows: readonly WetHourRow[], startHour: number): WetDayFarm[] {
  const grouped = new Map<string, WetDayFarm>();
  for (const row of rows) {
    const hour = String(row.hour_key ?? "");
    if (hour.length < 13) continue;
    const day = farmDay(`${hour}:00:00.000Z`, startHour);
    const farm = String(row.farm ?? "");
    const key = `${day}|${farm}`;
    const grams = Number(row.grams ?? 0);
    const n = Number(row.n ?? 0);
    const newest = String(row.newest ?? "");
    const prev = grouped.get(key);
    if (!prev) {
      grouped.set(key, { day, farm, grams, n, newest });
      continue;
    }
    prev.grams += grams;
    prev.n += n;
    if (newest > prev.newest) prev.newest = newest;
  }
  return [...grouped.values()];
}

type Desired = { day: string; dim: string; grams: number; lb: number; n: number; newest: string };

/** One total row (dim '') and one row per PNN, PNS, ARL that has totes that day. The total keeps every farm's grams. */
export function desiredFromDays(rows: readonly WetDayFarm[]): Desired[] {
  const byDay = new Map<string, { grams: number; n: number; newest: string; farms: Map<string, { grams: number; n: number; newest: string }> }>();
  for (const row of rows) {
    let day = byDay.get(row.day);
    if (!day) {
      day = { grams: 0, n: 0, newest: "", farms: new Map() };
      byDay.set(row.day, day);
    }
    day.grams += row.grams;
    day.n += row.n;
    if (row.newest > day.newest) day.newest = row.newest;
    if ((LBS_HARVESTED_FARMS as readonly string[]).includes(row.farm)) {
      const farm = day.farms.get(row.farm) ?? { grams: 0, n: 0, newest: "" };
      farm.grams += row.grams;
      farm.n += row.n;
      if (row.newest > farm.newest) farm.newest = row.newest;
      day.farms.set(row.farm, farm);
    }
  }
  const out: Desired[] = [];
  for (const [day, total] of byDay) {
    out.push({ day, dim: "", grams: total.grams, lb: wetPounds(total.grams), n: total.n, newest: total.newest });
    for (const farm of LBS_HARVESTED_FARMS) {
      const row = total.farms.get(farm);
      if (!row) continue;
      out.push({ day, dim: farm, grams: row.grams, lb: wetPounds(row.grams), n: row.n, newest: row.newest });
    }
  }
  return out;
}

const HOURS_SQL = `SELECT substr(x.created_at, 1, 13) AS hour_key,
            b.farm_code AS farm,
            COALESCE(SUM(x.weight_grams), 0) AS grams,
            COUNT(*) AS n,
            MAX(x.created_at) AS newest
     FROM wet_weights x
     JOIN wet_weight_entries w ON w.id = x.wet_weight_entry_id AND w.deleted_at IS NULL
     JOIN harvest_batches b ON b.id = w.harvest_batch_id AND b.deleted_at IS NULL
     WHERE x.deleted_at IS NULL AND b.harvest_year = ? AND ${ownLotSql("b")}
     GROUP BY substr(x.created_at, 1, 13), b.farm_code`;

const LIVE_SQL = `SELECT id, period_start, dim_key, value, n, source_as_of
     FROM dd_kpi_values
     WHERE kpi_key = '${LBS_HARVESTED_KPI}' AND period_kind = 'day' AND source = 'app' AND superseded_at IS NULL`;

type LiveRow = { id: string; day: string; dim: string; value: number; n: number; source_as_of: string | null };

function cents(value: number): number {
  return Math.round(value * 100);
}

export type LbsHarvestedRefresh = { written: number; year: number; grams: number };

/**
 * Rewrite the harvest year's live rows. An unchanged value and n is left alone.
 * A day that drops to zero is restated as 0, not deleted. Days with no totes
 * are not created. At most 8 binds on an insert and 2 on a supersede.
 */
export async function refreshLbsHarvested(db: D1Database, nowIso: string): Promise<LbsHarvestedRefresh> {
  const startHour = parseFarmDayStartHour(await getConfigValue(db, CONFIG_KEYS.farm_day_start_hour));
  const today = farmDay(nowIso, startHour);
  const year = Number(today.slice(0, 4));
  if (!Number.isFinite(year)) return { written: 0, year: 0, grams: 0 };
  const hours = await db.prepare(HOURS_SQL).bind(year).all<WetHourRow>();
  const desired = desiredFromDays(foldWetHours(hours.results ?? [], startHour));
  const wanted = new Map<string, Desired>();
  const daysWithTotes = new Set<string>();
  let grams = 0;
  for (const row of desired) {
    wanted.set(`${row.day}|${row.dim}`, row);
    daysWithTotes.add(row.day);
    if (row.dim === "") grams += row.grams;
  }
  const liveRows = await db.prepare(LIVE_SQL).all<Record<string, unknown>>();
  const live: LiveRow[] = (liveRows.results ?? []).map((row) => ({
    id: String(row.id),
    day: String(row.period_start),
    dim: String(row.dim_key ?? ""),
    value: Number(row.value ?? 0),
    n: Number(row.n ?? 0),
    source_as_of: row.source_as_of == null ? null : String(row.source_as_of),
  }));
  const yearPrefix = `${year}-`;
  type Write = { supersede: string | null; day: string; dim: string; lb: number; n: number; newest: string };
  const writes: Write[] = [];
  for (const row of live) {
    const next = wanted.get(`${row.day}|${row.dim}`);
    if (next) {
      wanted.delete(`${row.day}|${row.dim}`);
      if (cents(row.value) === cents(next.lb) && row.n === next.n) continue;
      writes.push({ supersede: row.id, day: next.day, dim: next.dim, lb: next.lb, n: next.n, newest: next.newest || nowIso });
      continue;
    }
    const inYear = row.day.startsWith(yearPrefix) || daysWithTotes.has(row.day);
    if (!inYear) continue;
    if (cents(row.value) === 0 && row.n === 0) continue;
    writes.push({ supersede: row.id, day: row.day, dim: row.dim, lb: 0, n: 0, newest: row.source_as_of || nowIso });
  }
  for (const next of wanted.values()) {
    writes.push({ supersede: null, day: next.day, dim: next.dim, lb: next.lb, n: next.n, newest: next.newest || nowIso });
  }
  const stmts: D1PreparedStatement[] = [];
  for (const write of writes) {
    if (write.supersede) {
      stmts.push(db.prepare(`UPDATE dd_kpi_values SET superseded_at = ? WHERE id = ? AND superseded_at IS NULL`).bind(nowIso, write.supersede));
    }
    stmts.push(
      db
        .prepare(
          `INSERT INTO dd_kpi_values (
             id, kpi_key, period_kind, period_start, dim_key, value, n, source, source_as_of, computed_at, def_version, created_at
           ) VALUES (?, '${LBS_HARVESTED_KPI}', 'day', ?, ?, ?, ?, 'app', ?, ?, ${LBS_HARVESTED_VERSION}, ?)`
        )
        .bind(crypto.randomUUID(), write.day, write.dim, write.lb, write.n, write.newest, nowIso, nowIso)
    );
  }
  for (let i = 0; i < stmts.length; i += 40) {
    await db.batch(stmts.slice(i, i + 40));
  }
  return { written: writes.length, year, grams };
}

export type HarvestDay = {
  day: string;
  lb: number;
  n: number;
  farms: Record<LbsHarvestedFarm, number>;
};

export type LbsHarvestedSeries = { today: string; days: HarvestDay[] };

export function seriesFromRows(
  rows: readonly { period_start?: unknown; dim_key?: unknown; value?: unknown; n?: unknown }[],
  today: string
): LbsHarvestedSeries {
  const byDay = new Map<string, HarvestDay & { hasTotal: boolean }>();
  const blank = (): HarvestDay & { hasTotal: boolean } => ({
    day: "",
    lb: 0,
    n: 0,
    farms: { PNN: 0, PNS: 0, ARL: 0 },
    hasTotal: false,
  });
  for (const row of rows) {
    const day = String(row.period_start ?? "");
    if (!isCalendarDate(day)) continue;
    const item = byDay.get(day) ?? blank();
    item.day = day;
    const lb = Number(row.value ?? 0);
    const n = Number(row.n ?? 0);
    const dim = String(row.dim_key ?? "");
    if (dim === "") {
      item.lb = Number.isFinite(lb) ? lb : 0;
      item.n = Number.isFinite(n) ? n : 0;
      item.hasTotal = true;
    } else if (dim === "PNN" || dim === "PNS" || dim === "ARL") {
      item.farms[dim] = Number.isFinite(lb) ? lb : 0;
    }
    byDay.set(day, item);
  }
  const days = [...byDay.values()]
    .map((item) => {
      if (!item.hasTotal) item.lb = Math.round((item.farms.PNN + item.farms.PNS + item.farms.ARL) * 100) / 100;
      return { day: item.day, lb: item.lb, n: item.n, farms: item.farms };
    })
    .sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : 0));
  return { today, days };
}

export type HarvestPeriod = "7" | "14" | "30" | "htd";

const PERIODS: readonly HarvestPeriod[] = ["7", "14", "30", "htd"];

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function daysInclusive(start: string, end: string): string[] {
  if (!isCalendarDate(start) || !isCalendarDate(end) || start > end) return isCalendarDate(end) ? [end] : [];
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

export function harvestWindow(period: HarvestPeriod, today: string, firstDay: string | null): string[] {
  if (!isCalendarDate(today)) return [];
  if (period === "htd") {
    const start = firstDay && firstDay <= today ? firstDay : today;
    return daysInclusive(start, today);
  }
  const n = period === "7" ? 7 : period === "30" ? 30 : 14;
  return daysInclusive(dayOffset(today, 1 - n), today);
}

/** Least squares y = a + b x over x = 0, 1, 2 and so on. Fewer than 3 points draws no line. */
export function leastSquares(ys: readonly number[]): { a: number; b: number } | null {
  return leastSquaresAt(ys.map((y, i) => ({ x: i, y })));
}

/** Least squares over (x, y) points. Fewer than 3 points draws no line. */
export function leastSquaresAt(points: readonly { x: number; y: number }[]): { a: number; b: number } | null {
  const n = points.length;
  if (n < 3) return null;
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;
  for (const point of points) {
    const x = point.x;
    const y = point.y;
    sumX += x;
    sumY += y;
    sumXY += x * y;
    sumXX += x * x;
  }
  const den = n * sumXX - sumX * sumX;
  if (den === 0) return null;
  const b = (n * sumXY - sumX * sumY) / den;
  const a = (sumY - b * sumX) / n;
  return { a, b };
}

function formatLb448(value: number): string {
  return value.toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

function formatLb2(value: number): string {
  return value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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

function sumLb(days: readonly HarvestDay[]): number {
  const total = days.reduce((n, day) => n + Math.round(day.lb * 100), 0);
  return total / 100;
}

function pointFor(days: readonly HarvestDay[], day: string): HarvestDay {
  return days.find((row) => row.day === day) ?? { day, lb: 0, n: 0, farms: { PNN: 0, PNS: 0, ARL: 0 } };
}

function tipText(point: HarvestDay, today: string, locale: Locale): string {
  const farms = LBS_HARVESTED_FARMS.map((farm) => `${farm} ${formatLb2(point.farms[farm])}`).join(", ");
  const soFar = point.day === today ? ` ${t(locale, "so far")}` : "";
  return `${weekdayOf(point.day, locale)}, ${shortDay(point.day, locale)}. ${formatLb2(point.lb)} ${t(locale, "lb")}. ${farms}. ${tFill(locale, "{n} totes", { n: String(point.n) })}.${soFar}`;
}

function px(n: number): string {
  return String(Math.round(n * 100) / 100);
}

function axisLb(value: number): string {
  const digits = Math.abs(value) >= 10 ? 0 : 1;
  return value.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

function labelIndexes(n: number): number[] {
  if (n <= 1) return [0];
  const want = n <= 8 ? Math.min(n, 4) : 5;
  const out: number[] = [];
  for (let i = 0; i < want; i += 1) {
    const idx = Math.round((i * (n - 1)) / (want - 1));
    if (!out.includes(idx)) out.push(idx);
  }
  return out;
}

function chartSvg(series: LbsHarvestedSeries, period: HarvestPeriod, locale: Locale): string {
  const first = series.days.length > 0 ? series.days[0].day : null;
  const windowDays = harvestWindow(period, series.today, first);
  const n = windowDays.length;
  if (n === 0) return `<svg class="dd-harvest-svg" viewBox="0 0 640 200" role="img"></svg>`;
  const points = windowDays.map((day) => pointFor(series.days, day));
  const stored = new Set(series.days.map((day) => day.day));
  const W = 640;
  const H = 200;
  const padL = 46;
  const padR = 8;
  const padT = 12;
  const padB = 28;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const maxLb = Math.max(1, ...points.map((point) => point.lb));
  const base = padT + plotH;
  const yOf = (lb: number) => base - (Math.max(0, lb) / maxLb) * plotH;
  const grids = [0, 1, 2, 3].map((step) => {
    const lb = (maxLb * step) / 3;
    const y = yOf(lb);
    return `<line class="dd-harvest-grid" x1="${padL}" y1="${px(y)}" x2="${W - padR}" y2="${px(y)}"></line>
      <text class="dd-harvest-label" x="${padL - 4}" y="${px(y + 3)}" text-anchor="end">${esc(axisLb(lb))}</text>`;
  });
  const labels = labelIndexes(n).map((index) => {
    const day = windowDays[index] ?? "";
    const x = padL + ((index + 0.5) * plotW) / Math.max(1, n);
    return `<text class="dd-harvest-label" x="${px(x)}" y="${H - 8}" text-anchor="middle">${esc(shortDay(day, locale))}</text>`;
  });
  const slot = n > 0 ? plotW / n : plotW;
  const bars = points.map((point, index) => {
    const x = padL + index * slot;
    const bw = Math.max(1, slot * 0.72);
    const bx = x + (slot - bw) / 2;
    const y = yOf(point.lb);
    const h = Math.max(0, base - y);
    const today = point.day === series.today;
    const empty = !stored.has(point.day) || point.lb === 0;
    const tip = tipText(point, series.today, locale);
    const visible =
      h > 0
        ? `<rect class="${today ? "dd-harvest-bar-today" : "dd-harvest-bar"}" x="${px(bx)}" y="${px(y)}" width="${px(bw)}" height="${px(h)}"></rect>`
        : "";
    return `<g data-dd-bar="${esc(point.day)}" data-dd-empty="${empty ? "1" : "0"}" data-dd-so-far="${today ? "1" : "0"}" data-dd-tip="${esc(tip)}">
        <rect x="${px(x)}" y="${padT}" width="${px(slot)}" height="${px(plotH)}" fill="transparent"></rect>
        ${visible}
        <title>${esc(tip)}</title>
      </g>`;
  });
  // Scribe gate fix (S3a): the trend fits the harvest days only. A day with no
  // totes (a Sunday, a rain day) is an empty slot, not a zero, and today's
  // partial day is left out, so a window ending on a weekend does not read as a fall.
  const fit = points
    .map((point, index) => ({ x: index, y: point.lb, day: point.day }))
    .filter((point) => point.day !== series.today && stored.has(point.day) && point.y > 0);
  const line = leastSquaresAt(fit);
  let trend = "";
  if (line && n > 1 && fit.length > 0) {
    const xAt = (index: number) => padL + ((index + 0.5) * plotW) / n;
    const yAt = (index: number) => {
      const y = yOf(line.a + line.b * index);
      return Math.min(base, Math.max(padT, y));
    };
    const firstX = fit[0].x;
    const lastX = fit[fit.length - 1].x;
    trend = `<line class="dd-harvest-trend" data-dd-trend="1" x1="${px(xAt(firstX))}" y1="${px(yAt(firstX))}" x2="${px(xAt(lastX))}" y2="${px(yAt(lastX))}"></line>`;
  }
  return `<svg class="dd-harvest-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(t(locale, "Lbs Harvested"))}">
      ${grids.join("")}
      ${bars.join("")}
      ${trend}
      ${labels.join("")}
    </svg>`;
}

const HARVEST_SCRIPT = `<script>
(function () {
  var root = document.currentScript && document.currentScript.parentElement;
  if (!root) return;
  var select = root.querySelector("[data-dd-harvest-period]");
  var tip = root.querySelector("[data-dd-harvest-tip]");
  if (!select) return;
  var key = "dd.lbs_harvested.period";
  function show(period) {
    var charts = root.querySelectorAll("[data-dd-harvest-chart]");
    var found = false;
    for (var i = 0; i < charts.length; i++) {
      var on = charts[i].getAttribute("data-dd-harvest-chart") === period;
      if (on) found = true;
      if (on) charts[i].removeAttribute("hidden");
      else charts[i].setAttribute("hidden", "");
    }
    if (!found && period !== "14") show("14");
  }
  var saved = "14";
  try { saved = localStorage.getItem(key) || "14"; } catch (e) { saved = "14"; }
  if (saved !== "7" && saved !== "14" && saved !== "30" && saved !== "htd") saved = "14";
  select.value = saved;
  show(saved);
  select.addEventListener("change", function () {
    try { localStorage.setItem(key, select.value); } catch (e) {}
    show(select.value);
    if (tip) tip.hidden = true;
  });
  function from(node) {
    return node ? node.getAttribute("data-dd-tip") || "" : "";
  }
  root.addEventListener("pointerover", function (ev) {
    var bar = ev.target && ev.target.closest ? ev.target.closest("[data-dd-tip]") : null;
    if (!tip || !bar) return;
    tip.textContent = from(bar);
    tip.hidden = false;
  });
  root.addEventListener("pointerout", function (ev) {
    var bar = ev.target && ev.target.closest ? ev.target.closest("[data-dd-tip]") : null;
    if (!tip || !bar) return;
    tip.hidden = true;
  });
  root.addEventListener("click", function (ev) {
    var bar = ev.target && ev.target.closest ? ev.target.closest("[data-dd-tip]") : null;
    if (!tip) return;
    if (!bar) { tip.hidden = true; return; }
    tip.textContent = from(bar);
    tip.hidden = false;
  });
})();
</script>`;

const PERIOD_LABEL: Record<HarvestPeriod, string> = {
  "7": "7 days",
  "14": "14 days",
  "30": "30 days",
  htd: "HTD",
};

/** The tile body: the HTD headline, the period select, four charts, the strain link. The headline does not follow the period. */
export function lbsHarvestedBody(series: LbsHarvestedSeries, locale: Locale, lbGrams: number): string {
  if (series.days.length === 0) return "";
  const sum = sumLb(series.days);
  const first = series.days[0].day;
  const word = t(locale, "lb");
  const caption = tFill(locale, "HTD, {start} to {end}", {
    start: shortDay(first, locale),
    end: shortDay(series.today, locale),
  });
  const options = PERIODS.map((period) => {
    const selected = period === "14" ? " selected" : "";
    return `<option value="${period}"${selected}>${esc(t(locale, PERIOD_LABEL[period]))}</option>`;
  }).join("");
  const charts = PERIODS.map((period) => {
    const hidden = period === "14" ? "" : " hidden";
    return `<div data-dd-harvest-chart="${period}"${hidden}>${chartSvg(series, period, locale)}</div>`;
  }).join("");
  return `<div class="dd-harvest" data-dd-harvest>
      <span class="dd-tile-value" data-dd-harvest-headline="${esc(String(sum))}" data-dd-value="${esc(String(sum))}">${esc(formatLb448(sum))}<span class="dd-tile-unit">${esc(word)}</span> <span class="dd-badge dd-badge-grams" title="${esc(t(locale, "Grams in one dashboard pound."))}" data-dd-lb-grams="${esc(lbGrams)}">${esc(lbGrams)} ${esc(t(locale, "g"))}</span></span>
      <p class="muted dd-harvest-range" data-dd-harvest-range>${esc(caption)}</p>
      <label class="dd-harvest-period">${esc(t(locale, "Period"))}
        <select data-dd-harvest-period aria-label="${esc(t(locale, "Period"))}">${options}</select>
      </label>
      ${charts}
      <p class="dd-harvest-tip" data-dd-harvest-tip hidden></p>
      <a class="dd-harvest-link" href="/harvest#strain-performance">${esc(t(locale, "Strain performance"))}</a>
      ${HARVEST_SCRIPT}
    </div>`;
}

/* ------------------------------------------------- DD S3b: lbs per DLH */

export const LBS_PER_DLH_KPI = "bizops.lbs_per_dlh";
export const LBS_PER_DLH_VERSION = 1;

/** The console Total box's three farms. An ALL row wins over these. */
const DLH_FARMS = ["PNN", "ARL", "PNS"] as const;

const DLH_HELP = "Wet pounds include toll lots, because crew hours cover them. Lbs Harvested counts own lots only.";

export type DlhDay = {
  day: string;
  wetLb: number | null;
  hours: number | null;
  ratio: number | null;
  n: number;
};

export type LbsPerDlhSeries = { today: string; days: DlhDay[] };

export type DlhWindow = { wet: number; hours: number; ratio: number | null; missing: number };

type ToteHour = { hour_key: string; grams: number; n: number; newest: string };
type LaborRow = { work_date: string; farm_code: string; hours: number };

const DLH_TOTE_SQL = `SELECT substr(x.created_at, 1, 13) AS hour_key,
            COALESCE(SUM(x.weight_grams), 0) AS grams,
            COUNT(*) AS n,
            MAX(x.created_at) AS newest
     FROM wet_weights x
     JOIN wet_weight_entries w ON w.id = x.wet_weight_entry_id AND w.deleted_at IS NULL
     JOIN harvest_batches b ON b.id = w.harvest_batch_id AND b.deleted_at IS NULL
     WHERE x.deleted_at IS NULL AND x.created_at >= ? AND x.created_at < ?
     GROUP BY substr(x.created_at, 1, 13)`;

const DLH_HOURS_SQL = `SELECT work_date, farm_code, hours
     FROM harvest_labor_hours
     WHERE work_date >= ? AND work_date <= ?`;

const DLH_LIVE_SQL = `SELECT id, period_start, dim_key, value, n, source_as_of
     FROM dd_kpi_values
     WHERE kpi_key = '${LBS_PER_DLH_KPI}' AND period_kind = 'day' AND source = 'app' AND superseded_at IS NULL`;

function roundHours(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Fold hourly tote sums into farm days. One UTC hour sits in one Eastern hour. */
function foldToteDays(rows: readonly ToteHour[], startHour: number): Map<string, { grams: number; n: number; newest: string }> {
  const grouped = new Map<string, { grams: number; n: number; newest: string }>();
  for (const row of rows) {
    const hour = String(row.hour_key ?? "");
    if (hour.length < 13) continue;
    const day = farmDay(`${hour}:00:00.000Z`, startHour);
    const grams = Number(row.grams ?? 0);
    const n = Number(row.n ?? 0);
    const newest = String(row.newest ?? "");
    const prev = grouped.get(day);
    if (!prev) {
      grouped.set(day, { grams, n, newest });
      continue;
    }
    prev.grams += grams;
    prev.n += n;
    if (newest > prev.newest) prev.newest = newest;
  }
  return grouped;
}

/** The ALL row when one stands, else the sum of PNN, ARL and PNS. Other codes are ignored. */
function hoursOf(rows: readonly LaborRow[]): Map<string, { hours: number; n: number }> {
  const buckets = new Map<string, { all: number | null; farms: number; farmN: number }>();
  for (const row of rows) {
    const day = String(row.work_date ?? "");
    if (!isCalendarDate(day)) continue;
    const hours = Number(row.hours);
    if (!Number.isFinite(hours)) continue;
    const bucket = buckets.get(day) ?? { all: null, farms: 0, farmN: 0 };
    if (row.farm_code === "ALL") bucket.all = hours;
    else if ((DLH_FARMS as readonly string[]).includes(String(row.farm_code))) {
      bucket.farms += hours;
      bucket.farmN += 1;
    }
    buckets.set(day, bucket);
  }
  const out = new Map<string, { hours: number; n: number }>();
  for (const [day, bucket] of buckets) {
    if (bucket.all != null) out.set(day, { hours: roundHours(bucket.all), n: 1 });
    else if (bucket.farmN > 0) out.set(day, { hours: roundHours(bucket.farms), n: bucket.farmN });
  }
  return out;
}

type DlhWrite = { supersede: string | null; day: string; dim: string; value: number; n: number; newest: string } | { supersede: string; drop: true };

export type LbsPerDlhRefresh = { written: number; year: number };

/**
 * Store the harvest year's day rows from the first weighed tote through the farm today.
 * wet_lb is every tote that day (toll lots included). hours is the ALL row, else the farm sum.
 * The blank dim is wet pounds over hours, and only when hours is above 0.
 * Hour rows before the first tote are not stored. An unchanged value is left alone.
 */
export async function refreshLbsPerDlh(db: D1Database, nowIso: string): Promise<LbsPerDlhRefresh> {
  const startHour = parseFarmDayStartHour(await getConfigValue(db, CONFIG_KEYS.farm_day_start_hour));
  const today = farmDay(nowIso, startHour);
  const year = Number(today.slice(0, 4));
  if (!isCalendarDate(today) || !Number.isFinite(year)) return { written: 0, year: 0 };
  const yearStart = `${year}-01-01`;
  const bounds = farmDayBounds(yearStart, startHour);
  const end = farmDayBounds(today, startHour);
  const [toteRows, hourRows] = await Promise.all([
    db.prepare(DLH_TOTE_SQL).bind(bounds.startIso, end.endIso).all<ToteHour>(),
    db.prepare(DLH_HOURS_SQL).bind(yearStart, today).all<LaborRow>(),
  ]);
  const wetByDay = foldToteDays(toteRows.results ?? [], startHour);
  const hoursByDay = hoursOf(hourRows.results ?? []);
  let first: string | null = null;
  for (const [day, wet] of wetByDay) {
    if (wet.n <= 0 || day < yearStart || day > today) continue;
    if (first == null || day < first) first = day;
  }
  const wanted = new Map<string, { day: string; dim: string; value: number; n: number; newest: string }>();
  if (first) {
    const days = new Set<string>([...wetByDay.keys(), ...hoursByDay.keys()]);
    for (const day of days) {
      if (day < first || day > today) continue;
      const wet = wetByDay.get(day);
      const hours = hoursByDay.get(day);
      const grams = wet?.grams ?? 0;
      const n = wet?.n ?? 0;
      const newest = wet?.newest || nowIso;
      if (n > 0) wanted.set(`${day}|wet_lb`, { day, dim: "wet_lb", value: wetPounds(grams), n, newest });
      if (hours) {
        wanted.set(`${day}|hours`, { day, dim: "hours", value: hours.hours, n: hours.n, newest });
        if (hours.hours > 0) {
          wanted.set(`${day}|`, { day, dim: "", value: wetPounds(grams / hours.hours), n, newest });
        }
      }
    }
  }
  const liveRows = await db.prepare(DLH_LIVE_SQL).all<Record<string, unknown>>();
  const yearPrefix = `${year}-`;
  const writes: DlhWrite[] = [];
  for (const raw of liveRows.results ?? []) {
    const id = String(raw.id);
    const day = String(raw.period_start);
    const dim = String(raw.dim_key ?? "");
    if (!day.startsWith(yearPrefix)) continue;
    const next = wanted.get(`${day}|${dim}`);
    if (next) {
      wanted.delete(`${day}|${dim}`);
      const value = Number(raw.value ?? 0);
      const n = Number(raw.n ?? 0);
      if (cents(value) === cents(next.value) && n === next.n) continue;
      writes.push({ supersede: id, day: next.day, dim: next.dim, value: next.value, n: next.n, newest: next.newest || nowIso });
      continue;
    }
    writes.push({ supersede: id, drop: true });
  }
  for (const next of wanted.values()) {
    writes.push({ supersede: null, day: next.day, dim: next.dim, value: next.value, n: next.n, newest: next.newest || nowIso });
  }
  const stmts: D1PreparedStatement[] = [];
  for (const write of writes) {
    if (write.supersede) {
      stmts.push(db.prepare(`UPDATE dd_kpi_values SET superseded_at = ? WHERE id = ? AND superseded_at IS NULL`).bind(nowIso, write.supersede));
    }
    if ("drop" in write) continue;
    stmts.push(
      db
        .prepare(
          `INSERT INTO dd_kpi_values (
             id, kpi_key, period_kind, period_start, dim_key, value, n, source, source_as_of, computed_at, def_version, created_at
           ) VALUES (?, '${LBS_PER_DLH_KPI}', 'day', ?, ?, ?, ?, 'app', ?, ?, ${LBS_PER_DLH_VERSION}, ?)`
        )
        .bind(crypto.randomUUID(), write.day, write.dim, write.value, write.n, write.newest, nowIso, nowIso)
    );
  }
  for (let i = 0; i < stmts.length; i += 40) {
    await db.batch(stmts.slice(i, i + 40));
  }
  return { written: writes.length, year };
}

export function dlhSeriesFromRows(
  rows: readonly { period_start?: unknown; dim_key?: unknown; value?: unknown; n?: unknown }[],
  today: string
): LbsPerDlhSeries {
  const byDay = new Map<string, DlhDay>();
  for (const row of rows) {
    const day = String(row.period_start ?? "");
    if (!isCalendarDate(day)) continue;
    const item = byDay.get(day) ?? { day, wetLb: null, hours: null, ratio: null, n: 0 };
    const value = Number(row.value ?? 0);
    const n = Number(row.n ?? 0);
    const dim = String(row.dim_key ?? "");
    if (dim === "wet_lb") {
      item.wetLb = Number.isFinite(value) ? value : 0;
      item.n = Number.isFinite(n) ? n : 0;
    } else if (dim === "hours") {
      item.hours = Number.isFinite(value) ? value : 0;
    } else if (dim === "") {
      item.ratio = Number.isFinite(value) ? value : null;
    }
    byDay.set(day, item);
  }
  const days = [...byDay.values()].sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : 0));
  return { today, days };
}

/** The window figure: summed wet pounds over summed hours. Wet from a day with no hours still counts. */
export function dlhWeighted(days: readonly DlhDay[], windowDays: readonly string[]): DlhWindow {
  const byDay = new Map(days.map((day) => [day.day, day]));
  let wetCents = 0;
  let hours = 0;
  let missing = 0;
  for (const day of windowDays) {
    const row = byDay.get(day);
    if (!row) continue;
    if (row.wetLb != null && Number.isFinite(row.wetLb)) wetCents += Math.round(row.wetLb * 100);
    const hasHours = row.hours != null && Number.isFinite(row.hours) && row.hours > 0;
    if (hasHours) hours += row.hours as number;
    if (row.wetLb != null && row.wetLb > 0 && !hasHours) missing += 1;
  }
  const wet = wetCents / 100;
  return { wet, hours, ratio: hours > 0 ? wet / hours : null, missing };
}

function tenths(value: number): number {
  return Math.round(value * 10) / 10;
}

function format1(value: number): string {
  return tenths(value).toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

function formatPlain(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  return Object.is(rounded, -0) ? "0" : String(rounded);
}

function formatHours(value: number): string {
  return formatPlain(value);
}

function attrNum(value: number): string {
  return formatPlain(value);
}

function dlhTip(day: string, point: DlhDay | undefined, today: string, locale: Locale): string {
  const when = `${weekdayOf(day, locale)}, ${shortDay(day, locale)}`;
  if (!point || point.ratio == null) return `${when}. ${t(locale, "no hours typed")}`;
  const soFar = day === today ? ` ${t(locale, "so far")}` : "";
  return `${when}. ${formatLb2(point.ratio)} ${t(locale, "lb/DLH")}. ${formatLb2(point.wetLb ?? 0)} ${t(locale, "lb")}. ${formatHours(point.hours ?? 0)} ${t(locale, "h")}.${soFar}`;
}

function dlhGap(ratio: number, goal: number, locale: Locale): { text: string; tone: "good" | "warn" } {
  const delta = tenths(tenths(ratio) - tenths(goal));
  if (delta === 0) return { text: t(locale, "On goal"), tone: "good" };
  const n = format1(Math.abs(delta));
  if (delta > 0) return { text: tFill(locale, "{n} over", { n }), tone: "good" };
  return { text: tFill(locale, "{n} under", { n }), tone: "warn" };
}

function dlhChart(series: LbsPerDlhSeries, period: HarvestPeriod, goal: number | null, locale: Locale): { svg: string; segments: number } {
  const first = series.days.length > 0 ? series.days[0].day : null;
  const windowDays = harvestWindow(period, series.today, first);
  const n = windowDays.length;
  const W = 640;
  const H = 220;
  const padL = 46;
  const padR = 8;
  const padT = 22;
  const padB = 28;
  if (n === 0) return { svg: `<svg class="dd-dlh-svg" viewBox="0 0 ${W} ${H}" role="img"></svg>`, segments: 0 };
  const byDay = new Map(series.days.map((day) => [day.day, day]));
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const ratios = windowDays.map((day) => byDay.get(day)?.ratio).filter((value): value is number => value != null && Number.isFinite(value));
  const peak = Math.max(1, goal != null && Number.isFinite(goal) ? goal : 0, ...ratios);
  const maxY = peak * 1.12;
  const base = padT + plotH;
  const yOf = (value: number) => base - (Math.max(0, value) / maxY) * plotH;
  const xOf = (index: number) => padL + ((index + 0.5) * plotW) / n;
  const grids = [0, 1, 2, 3].map((step) => {
    const value = (maxY * step) / 3;
    const y = yOf(value);
    return `<line class="dd-dlh-grid" x1="${padL}" y1="${px(y)}" x2="${W - padR}" y2="${px(y)}"></line>
      <text class="dd-dlh-label" x="${padL - 4}" y="${px(y + 3)}" text-anchor="end">${esc(axisLb(value))}</text>`;
  });
  const labels = labelIndexes(n).map((index) => {
    const day = windowDays[index] ?? "";
    return `<text class="dd-dlh-label" x="${px(xOf(index))}" y="${H - 8}" text-anchor="middle">${esc(shortDay(day, locale))}</text>`;
  });
  type Plot = { index: number; x: number; y: number };
  const runs: Plot[][] = [];
  let run: Plot[] = [];
  const flush = () => {
    if (run.length > 0) runs.push(run);
    run = [];
  };
  windowDays.forEach((day, index) => {
    const point = byDay.get(day);
    if (point?.ratio == null) {
      flush();
      return;
    }
    run.push({ index, x: xOf(index), y: yOf(point.ratio) });
  });
  flush();
  const areas = runs
    .filter((segment) => segment.length >= 2)
    .map((segment) => {
      const line = segment.map((point, i) => `${i === 0 ? "M" : "L"}${px(point.x)} ${px(point.y)}`).join(" ");
      const area = `M${px(segment[0].x)} ${px(base)} ` + segment.map((point) => `L${px(point.x)} ${px(point.y)}`).join(" ") + ` L${px(segment[segment.length - 1].x)} ${px(base)} Z`;
      return `<path class="dd-dlh-area" d="${area}"></path><path class="dd-dlh-line" d="${line}"></path>`;
    })
    .join("");
  const hits = windowDays.map((day, index) => {
    const point = byDay.get(day);
    const gap = point?.ratio == null;
    const today = day === series.today && !gap;
    const tip = dlhTip(day, point, series.today, locale);
    const slot = plotW / n;
    const x = padL + index * slot;
    const circle =
      point?.ratio == null
        ? ""
        : `<circle class="${today ? "dd-dlh-point-today" : "dd-dlh-point"}" cx="${px(xOf(index))}" cy="${px(yOf(point.ratio))}" r="3.5"></circle>`;
    return `<g data-dd-dlh-day="${esc(day)}" data-dd-dlh-tip="${esc(tip)}"${gap ? ' data-dd-dlh-gap="1"' : ' data-dd-dlh-point="1"'}${today ? ' data-dd-dlh-today="1"' : ""}>
        <rect x="${px(x)}" y="${padT}" width="${px(slot)}" height="${px(plotH)}" fill="transparent"></rect>
        ${circle}
        <title>${esc(tip)}</title>
      </g>`;
  });
  let goal = "";
  if (goal != null && Number.isFinite(goal)) {
    const y = yOf(goal);
    const labelY = y < padT + 14 ? y + 12 : y - 4;
    const label = `${t(locale, "Goal")} ${formatPlain(goal)}`;
    goal = `<g data-dd-dlh-goal="${esc(formatPlain(goal))}">
        <line class="dd-dlh-goal" x1="${padL}" y1="${px(y)}" x2="${W - padR}" y2="${px(y)}"></line>
        <text class="dd-dlh-label" x="${padL + 6}" y="${px(labelY)}">${esc(label)}</text>
      </g>`;
  }
  const svg = `<svg class="dd-dlh-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(t(locale, "Lbs/DLH"))}" data-dd-dlh-segments="${runs.length}">
      <text class="dd-dlh-label" data-dd-dlh-axis="y" x="4" y="12">${esc(t(locale, "Lbs/DLH"))}</text>
      ${grids.join("")}
      ${areas}
      ${goal}
      ${hits.join("")}
      ${labels.join("")}
    </svg>`;
  return { svg, segments: runs.length };
}

const DLH_SCRIPT = `<script>
(function () {
  var root = document.currentScript && document.currentScript.parentElement;
  if (!root) return;
  var select = root.querySelector("[data-dd-dlh-period]");
  var tip = root.querySelector("[data-dd-dlh-tip]");
  if (!select) return;
  var key = "dd.lbs_per_dlh.period";
  function show(period) {
    var charts = root.querySelectorAll("[data-dd-dlh-chart]");
    var found = false;
    for (var i = 0; i < charts.length; i++) {
      var on = charts[i].getAttribute("data-dd-dlh-chart") === period;
      if (on) found = true;
      if (on) charts[i].removeAttribute("hidden");
      else charts[i].setAttribute("hidden", "");
    }
    if (!found && period !== "14") show("14");
  }
  var saved = "14";
  try { saved = localStorage.getItem(key) || "14"; } catch (e) { saved = "14"; }
  if (saved !== "7" && saved !== "14" && saved !== "30" && saved !== "htd") saved = "14";
  select.value = saved;
  show(saved);
  select.addEventListener("change", function () {
    try { localStorage.setItem(key, select.value); } catch (e) {}
    show(select.value);
    if (tip) tip.hidden = true;
  });
  function from(node) {
    return node ? node.getAttribute("data-dd-dlh-tip") || "" : "";
  }
  root.addEventListener("pointerover", function (ev) {
    var bar = ev.target && ev.target.closest ? ev.target.closest("[data-dd-dlh-tip]") : null;
    if (!tip || !bar) return;
    tip.textContent = from(bar);
    tip.hidden = false;
  });
  root.addEventListener("pointerout", function (ev) {
    var bar = ev.target && ev.target.closest ? ev.target.closest("[data-dd-dlh-tip]") : null;
    if (!tip || !bar) return;
    tip.hidden = true;
  });
  root.addEventListener("click", function (ev) {
    var bar = ev.target && ev.target.closest ? ev.target.closest("[data-dd-dlh-tip]") : null;
    if (!tip) return;
    if (!bar) { tip.hidden = true; return; }
    tip.textContent = from(bar);
    tip.hidden = false;
  });
})();
</script>`;

/** The tile body: a period select, the weighted headline, the goal, and an area chart. The headline follows the period. */
export function lbsPerDlhBody(series: LbsPerDlhSeries, goal: number | null, locale: Locale): string {
  const days = [...series.days].sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : 0));
  if (days.length === 0 || !isCalendarDate(series.today)) return "";
  const ordered: LbsPerDlhSeries = { today: series.today, days };
  const first = days[0].day;
  const known = goal != null && Number.isFinite(goal);
  const options = PERIODS.map((period) => {
    const selected = period === "14" ? " selected" : "";
    return `<option value="${period}"${selected}>${esc(t(locale, PERIOD_LABEL[period]))}</option>`;
  }).join("");
  const panels = PERIODS.map((period) => {
    const windowDays = harvestWindow(period, ordered.today, first);
    const figure = dlhWeighted(days, windowDays);
    const hidden = period === "14" ? "" : " hidden";
    const headline =
      figure.ratio == null
        ? `<span class="dd-tile-value" data-dd-dlh-headline="">${esc(t(locale, "No hours typed"))}</span>`
        : `<span class="dd-tile-value" data-dd-dlh-headline="${esc(format1(figure.ratio))}">${esc(format1(figure.ratio))}<span class="dd-tile-unit">${esc(t(locale, "lb/DLH"))}</span></span>`;
    let goalLine = "";
    if (known) {
      const gap = figure.ratio == null ? null : dlhGap(figure.ratio, goal as number, locale);
      const gapHtml = gap ? ` <span class="dd-dlh-${gap.tone}" data-dd-dlh-tone="${gap.tone}">${esc(gap.text)}</span>` : "";
      goalLine = `<p class="dd-dlh-goal-line"><span data-dd-dlh-goal-text="1">${esc(t(locale, "Goal"))} ${esc(formatPlain(goal as number))}</span>${gapHtml}</p>`;
    }
    const note =
      figure.missing > 0
        ? `<p class="muted dd-dlh-note" data-dd-dlh-missing="${figure.missing}">${esc(
            tFill(locale, figure.missing === 1 ? "{n} day without hours" : "{n} days without hours", { n: String(figure.missing) })
          )}</p>`
        : "";
    const chart = dlhChart(ordered, period, known ? (goal as number) : null, locale);
    return `<div data-dd-dlh-chart="${period}" data-dd-dlh-wet="${esc(attrNum(figure.wet))}" data-dd-dlh-hours="${esc(attrNum(figure.hours))}"${hidden}>
        ${headline}
        ${goalLine}
        ${note}
        ${chart.svg}
      </div>`;
  }).join("");
  return `<div class="dd-dlh" data-dd-dlh>
      <label class="dd-dlh-period">${esc(t(locale, "Period"))}
        <select data-dd-dlh-period aria-label="${esc(t(locale, "Period"))}">${options}</select>
      </label>
      ${panels}
      <p class="dd-dlh-tip" data-dd-dlh-tip hidden></p>
      <p class="muted dd-dlh-help">${esc(t(locale, DLH_HELP))}</p>
      ${DLH_SCRIPT}
    </div>`;
}
