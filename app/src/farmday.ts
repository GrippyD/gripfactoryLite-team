/**
 * The farm's day (canon 0.30.73, 0.30.88, 0.30.92): both farms and the barn
 * keep Eastern time, so a "day" on any floor surface is the Eastern calendar
 * day and a typed wall clock resolves against the Eastern offset in force at
 * that instant. A leaf module: the console, the drying pages and the Effective
 * Date field all read it, and it imports nothing of theirs.
 */

export const FARM_TIME_ZONE = "America/New_York";

/** THE FARM DAY BEGINS AT SIX (canon 0.30.151). Owner, 2026-09-20, verbatim:
 * "Second shift ends the next day, how can I have the report date treat the
 * start of the shift a the date?"; his pick on the question tool: "6:00 AM".
 * The farm's day no longer rolls at midnight: it begins at a set Eastern hour
 * (app_config farm_day_start_hour, seeded 6 by migration 0064, a value in
 * data), and an instant before that hour belongs to the day before. Every
 * reader of "today" or "yesterday" (the Effective Date default on every
 * transactional form, the trim and wet weight dates through it, the Harvest
 * Console's day and its windows) reads the farm day, never the calendar day.
 * The code's fallback when the row is missing is the ruling itself. */
export const FARM_DAY_START_HOUR_DEFAULT = 6;

/** The start hour from app_config: a whole number 0 to 23; the ruling's 6 otherwise. */
export function parseFarmDayStartHour(raw: string | null | undefined): number {
  const text = String(raw ?? "").trim();
  if (!/^\d{1,2}$/.test(text)) return FARM_DAY_START_HOUR_DEFAULT;
  const n = Number(text);
  return n >= 0 && n <= 23 ? n : FARM_DAY_START_HOUR_DEFAULT;
}

/** The Eastern wall-clock hour (0 to 23) of an instant. */
export function etHour(iso: string): number {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return 0;
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: FARM_TIME_ZONE, hourCycle: "h23", hour: "2-digit" }).formatToParts(d);
  return Number(parts.find((p) => p.type === "hour")?.value ?? "0");
}

/** The Eastern wall clock of an instant in minutes since midnight (0..1439). */
export function etClockMinutes(iso: string): number {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return 0;
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: FARM_TIME_ZONE, hourCycle: "h23", hour: "2-digit", minute: "2-digit" }).formatToParts(d);
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  return hour * 60 + minute;
}

/** The farm's day for an instant: the Eastern calendar day, or the day before
 * when the Eastern clock has not yet reached the start hour. */
export function farmDay(iso: string, startHour: number = FARM_DAY_START_HOUR_DEFAULT): string {
  const date = etDate(iso);
  return startHour > 0 && etHour(iso) < startHour ? dayBefore(date) : date;
}

export type TrimLeadShift = "day" | "second";

export type TrimLeadLists = { day: readonly string[]; second: readonly string[] };

/** Case and every space ignored, so " Nia   Night " and "nianight" are one operator. */
export function trimOperatorKey(name: string | null | undefined): string {
  return String(name ?? "").toLowerCase().replace(/\s+/g, "");
}

/** The shift list that names this operator. Second wins when both lists do. Null on neither. */
export function trimLeadShift(operator: string | null | undefined, lists: TrimLeadLists): TrimLeadShift | null {
  const key = trimOperatorKey(operator);
  if (!key) return null;
  const listed = (names: readonly string[]) => names.some((name) => trimOperatorKey(name) === key);
  if (listed(lists.second)) return "second";
  if (listed(lists.day)) return "day";
  return null;
}

/** THE DAY FOLLOWS THE TEAM LEAD (canon 0.30.419). The date a trim package
 * counts to when the Effective Date was not overridden. A second shift
 * operator takes the Eastern calendar date of the entry less 12 hours (an
 * entry before noon belongs to the night before; noon itself stays on that
 * day). A day shift operator takes the Eastern calendar date of the entry.
 * An operator on neither list takes the farm day. */
export function trimCountedDate(
  iso: string,
  operator: string | null | undefined,
  lists: TrimLeadLists,
  startHour: number = FARM_DAY_START_HOUR_DEFAULT
): { date: string; shift: TrimLeadShift | null } {
  const shift = trimLeadShift(operator, lists);
  if (shift === "second") {
    const ms = Date.parse(iso);
    const back = Number.isFinite(ms) ? new Date(ms - 12 * 60 * 60 * 1000).toISOString() : iso;
    return { date: etDate(back), shift };
  }
  if (shift === "day") return { date: etDate(iso), shift };
  return { date: farmDay(iso, startHour), shift: null };
}

/** The UTC instants that bound a farm day: [the start hour on that date, the
 * start hour on the next date), Eastern. */
export function farmDayBounds(date: string, startHour: number = FARM_DAY_START_HOUR_DEFAULT): { startIso: string; endIso: string } {
  const hh = `${String(Math.max(0, Math.min(23, startHour))).padStart(2, "0")}:00`;
  const next = dayAfter(date);
  return { startIso: etInstant(date, hh), endIso: etInstant(next, hh) };
}

/** The UTC instant of an Eastern wall clock on a FARM day: a time before the
 * start hour falls on the next calendar date (the farm day runs past midnight).
 * Blank when the shape is off, like etInstant. */
export function farmInstant(date: string, hhmm: string, startHour: number = FARM_DAY_START_HOUR_DEFAULT): string {
  const m = /^([01][0-9]|2[0-3]):([0-5][0-9])$/.exec(hhmm.trim());
  if (!m || !isCalendarDate(date)) return "";
  const onDate = Number(m[1]) < startHour ? dayAfter(date) : date;
  return etInstant(onDate, `${m[1]}:${m[2]}`);
}

/** The calendar day after a YYYY-MM-DD. */
export function dayAfter(date: string): string {
  const ms = Date.parse(`${date}T00:00:00.000Z`);
  if (!Number.isFinite(ms)) return date;
  return new Date(ms + 86_400_000).toISOString().slice(0, 10);
}

/** The farm's calendar day (Eastern) for an instant, as YYYY-MM-DD. */
export function etDate(iso: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return iso.slice(0, 10);
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: FARM_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(d);
  const pick = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${pick("year")}-${pick("month")}-${pick("day")}`;
}

/** The calendar day before a YYYY-MM-DD. */
export function dayBefore(date: string): string {
  const ms = Date.parse(`${date}T00:00:00.000Z`);
  if (!Number.isFinite(ms)) return date;
  return new Date(ms - 86_400_000).toISOString().slice(0, 10);
}

/** True for a well-formed YYYY-MM-DD that names a real calendar day. */
export function isCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const ms = Date.parse(`${value}T00:00:00.000Z`);
  return Number.isFinite(ms) && new Date(ms).toISOString().slice(0, 10) === value;
}

/** Minutes the Eastern clock runs behind UTC at an instant (240 in daylight time, 300 in standard). */
function etOffsetMinutes(at: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: FARM_TIME_ZONE,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(at);
  const pick = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? "0");
  const asUtc = Date.UTC(pick("year"), pick("month") - 1, pick("day"), pick("hour"), pick("minute"), pick("second"));
  return Math.round((at.getTime() - asUtc) / 60_000);
}

/** The UTC instant of an Eastern wall clock (YYYY-MM-DD and HH:MM), as ISO. A
 * second pass settles the offset on a daylight-saving edge. */
export function etInstant(date: string, hhmm: string): string {
  const m = /^([01][0-9]|2[0-3]):([0-5][0-9])$/.exec(hhmm.trim());
  if (!m || !isCalendarDate(date)) return "";
  const wallAsUtc = Date.UTC(Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 1, Number(date.slice(8, 10)), Number(m[1]), Number(m[2]));
  let instant = wallAsUtc + etOffsetMinutes(new Date(wallAsUtc)) * 60_000;
  instant = wallAsUtc + etOffsetMinutes(new Date(instant)) * 60_000;
  return new Date(instant).toISOString();
}

/** The Eastern wall clock of an instant, as "YYYY-MM-DD HH:MM" (blank when the
 * value is not an instant). THE ZONELESS ZERO (canon 0.30.102/104): a stored
 * time shows in farm time wherever it is typed back. */
export function etWallClock(iso: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: FARM_TIME_ZONE,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(d);
  const pick = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${pick("year")}-${pick("month")}-${pick("day")} ${pick("hour")}:${pick("minute")}`;
}

/** THE RAD START TIME (canon 0.30.330): a wall clock typed on the 12-hour
 * clock with its AM or PM, as the 24-hour "HH:MM" the farm resolves. 12 AM is
 * 00, 12 PM is 12, 1 to 11 PM add twelve; the meridiem is trimmed and case
 * folded; "" when the shape is off. */
export function wallClock24From12(hhmm: string, meridiem: string): string {
  const m = /^(0[1-9]|1[0-2]):([0-5][0-9])$/.exec(String(hhmm ?? "").trim());
  const half = String(meridiem ?? "").trim().toUpperCase();
  if (!m || (half !== "AM" && half !== "PM")) return "";
  const hour = (Number(m[1]) % 12) + (half === "PM" ? 12 : 0);
  return `${String(hour).padStart(2, "0")}:${m[2]}`;
}

/** The Eastern wall clock of an instant on the 12-hour clock, for the Start
 * Time box's prefill: "02:35" with its AM or PM; a blank hhmm (and AM) when
 * the value is not an instant. */
export function etClock12(iso: string): { hhmm: string; meridiem: "AM" | "PM" } {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return { hhmm: "", meridiem: "AM" };
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: FARM_TIME_ZONE, hourCycle: "h12", hour: "2-digit", minute: "2-digit" }).formatToParts(d);
  const pick = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const meridiem = pick("dayPeriod").trim().toUpperCase() === "PM" ? "PM" : "AM";
  return { hhmm: `${pick("hour").padStart(2, "0")}:${pick("minute").padStart(2, "0")}`, meridiem };
}

/** A typed time as a UTC instant (ISO), or null when the shape is not one the
 * farm accepts. THE ZONELESS ZERO (canon 0.30.102/104; the owner's Silo 4
 * clock ran four hours long because a pencil stored "2026-09-15 01:00" as
 * typed, local in the browser and UTC in the Worker): a wall clock without a
 * zone is FARM TIME (YYYY-MM-DD HH:MM, a T or a space between, seconds
 * ignored) and resolves through etInstant; an instant that carries its zone
 * (Z or an offset) is taken as it stands. Nothing zoneless is ever stored. */
export function farmInstantFromInput(raw: string | null | undefined): string | null {
  const text = (raw ?? "").trim();
  if (!text) return null;
  const wall = /^(\d{4}-\d{2}-\d{2})[ T]([01][0-9]|2[0-3]):([0-5][0-9])(?::[0-5][0-9](?:\.\d{1,3})?)?$/.exec(text);
  if (wall) {
    const iso = etInstant(wall[1], `${wall[2]}:${wall[3]}`);
    return iso || null;
  }
  const zoned = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:?\d{2})$/.exec(text);
  if (zoned) {
    const ms = Date.parse(text);
    return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
  }
  return null;
}

/** The UTC instants that bound an Eastern calendar day: [startIso, endIso). */
export function etDayBounds(date: string): { startIso: string; endIso: string } {
  const midnightAsUtc = Date.parse(`${date}T00:00:00.000Z`);
  const guess = new Date(midnightAsUtc);
  // The offset in force at that midnight (a second pass settles a DST edge).
  let start = midnightAsUtc + etOffsetMinutes(guess) * 60_000;
  start = midnightAsUtc + etOffsetMinutes(new Date(start)) * 60_000;
  const nextMidnightAsUtc = midnightAsUtc + 86_400_000;
  let end = nextMidnightAsUtc + etOffsetMinutes(new Date(nextMidnightAsUtc)) * 60_000;
  end = nextMidnightAsUtc + etOffsetMinutes(new Date(end)) * 60_000;
  return { startIso: new Date(start).toISOString(), endIso: new Date(end).toISOString() };
}

/** THE PERIODS (DD S1, the week_definition ruling: dd_week_basis = iso). A
 * weekly tile buckets on the ISO week of the farm day of its key date, Monday
 * at the farm day start hour to the next Monday; a month, quarter and season
 * start on a calendar day; harvest week n is a label counted from the season
 * start pinned in app_config. Every helper here is pure and reads only the
 * YYYY-MM-DD it is given (UTC arithmetic on the date, never the process
 * zone), so it answers the same under any TZ. */
export type PeriodKind = "day" | "week" | "month" | "quarter" | "season";

export const PERIOD_KINDS: readonly PeriodKind[] = ["day", "week", "month", "quarter", "season"];

const DAY_MS = 86_400_000;

function dayMs(date: string): number {
  return Date.parse(`${date}T00:00:00.000Z`);
}

function dateFromMs(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** The calendar day `days` after (or before, when negative) a YYYY-MM-DD; the input when it is not a date. */
export function dayOffset(date: string, days: number): string {
  if (!isCalendarDate(date)) return date;
  return dateFromMs(dayMs(date) + days * DAY_MS);
}

/** The Monday of the ISO week holding the day, YYYY-MM-DD (the input when it is not a date). */
export function weekStartOf(dayIso: string): string {
  if (!isCalendarDate(dayIso)) return dayIso;
  const ms = dayMs(dayIso);
  const mondayFirst = (new Date(ms).getUTCDay() + 6) % 7;
  return dateFromMs(ms - mondayFirst * DAY_MS);
}

/** The ISO week year and number of the day: the year of the week's Thursday, weeks counted from the one holding Jan 4. */
export function isoWeekOf(dayIso: string): { year: number; week: number } {
  if (!isCalendarDate(dayIso)) return { year: 0, week: 0 };
  const ms = dayMs(dayIso);
  const mondayFirst = (new Date(ms).getUTCDay() + 6) % 7;
  const thursday = ms + (3 - mondayFirst) * DAY_MS;
  const year = new Date(thursday).getUTCFullYear();
  const week = Math.floor((thursday - Date.UTC(year, 0, 1)) / DAY_MS / 7) + 1;
  return { year, week };
}

/** The ISO week key of the day, "2026-W41" ("" when it is not a date). */
export function isoWeekKey(dayIso: string): string {
  const { year, week } = isoWeekOf(dayIso);
  return year ? `${year}-W${String(week).padStart(2, "0")}` : "";
}

/** The UTC instants that bound the farm week holding the day: the start hour
 * on its Monday and the start hour on the next Monday, Eastern, each through
 * farmDayBounds so a daylight edge inside the week keeps the wall clock. */
export function weekBoundsOf(dayIso: string, startHour: number = FARM_DAY_START_HOUR_DEFAULT): { startIso: string; endIso: string } {
  const monday = weekStartOf(dayIso);
  return { startIso: farmDayBounds(monday, startHour).startIso, endIso: farmDayBounds(dayOffset(monday, 7), startHour).startIso };
}

/** The first day of the month holding the day. */
export function monthStartOf(dayIso: string): string {
  return isCalendarDate(dayIso) ? `${dayIso.slice(0, 7)}-01` : dayIso;
}

/** The first day of the calendar quarter holding the day (Jan 1, Apr 1, Jul 1, Oct 1). */
export function quarterStartOf(dayIso: string): string {
  if (!isCalendarDate(dayIso)) return dayIso;
  const month = Number(dayIso.slice(5, 7));
  const first = Math.floor((month - 1) / 3) * 3 + 1;
  return `${dayIso.slice(0, 4)}-${String(first).padStart(2, "0")}-01`;
}

/** The latest occurrence of an MM-DD on or before the day (this year's when
 * it has passed or is today, else last year's); null when either shape is off. */
export function seasonStartOf(dayIso: string, mmdd: string | null | undefined): string | null {
  const md = String(mmdd ?? "").trim();
  if (!isCalendarDate(dayIso) || !/^\d{2}-\d{2}$/.test(md)) return null;
  const year = Number(dayIso.slice(0, 4));
  const thisYear = `${year}-${md}`;
  const candidate = thisYear <= dayIso ? thisYear : `${year - 1}-${md}`;
  return isCalendarDate(candidate) ? candidate : null;
}

export type PeriodOptions = {
  /** The pinned season start (app_config dd_season_start_date), used when it is a date on or before the day. */
  seasonStartDate?: string | null;
  /** The row's season start MM-DD, the fallback for the season kind. */
  seasonStartMd?: string | null;
};

/** The period start a day falls in, per kind. A season with no pinned date
 * and no MM-DD is the calendar year (the harvest year the console reads). */
export function periodStartFor(kind: PeriodKind, dayIso: string, opts: PeriodOptions = {}): string {
  switch (kind) {
    case "day":
      return dayIso;
    case "week":
      return weekStartOf(dayIso);
    case "month":
      return monthStartOf(dayIso);
    case "quarter":
      return quarterStartOf(dayIso);
    default: {
      const pinned = String(opts.seasonStartDate ?? "").trim();
      if (isCalendarDate(pinned) && pinned <= dayIso) return pinned;
      return seasonStartOf(dayIso, opts.seasonStartMd) ?? (isCalendarDate(dayIso) ? `${dayIso.slice(0, 4)}-01-01` : dayIso);
    }
  }
}

/** The period start `steps` periods after a period start (negative steps go
 * back): days, weeks of seven days, whole months, quarters of three months,
 * seasons of one year on the same month and day. */
export function periodShift(kind: PeriodKind, periodStart: string, steps: number): string {
  if (!isCalendarDate(periodStart) || !Number.isFinite(steps)) return periodStart;
  const n = Math.trunc(steps);
  switch (kind) {
    case "day":
      return dayOffset(periodStart, n);
    case "week":
      return dayOffset(periodStart, 7 * n);
    case "month":
    case "quarter": {
      const months = kind === "month" ? n : 3 * n;
      const year = Number(periodStart.slice(0, 4));
      const month = Number(periodStart.slice(5, 7)) - 1 + months;
      return dateFromMs(Date.UTC(year + Math.floor(month / 12), ((month % 12) + 12) % 12, 1));
    }
    default: {
      const year = Number(periodStart.slice(0, 4)) + n;
      return dateFromMs(Date.UTC(year, Number(periodStart.slice(5, 7)) - 1, Number(periodStart.slice(8, 10))));
    }
  }
}

/** The exclusive end of a period: the next period's start. */
export function periodEndOf(kind: PeriodKind, periodStart: string): string {
  return periodShift(kind, periodStart, 1);
}

const MONTHS_EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_ES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

function monthWord(date: string, es: boolean): string {
  const index = Number(date.slice(5, 7)) - 1;
  return (es ? MONTHS_ES : MONTHS_EN)[index] ?? "";
}

function dayNumber(date: string): string {
  return String(Number(date.slice(8, 10)));
}

/** A period's label for a tile or a stepper, in the locale ("es" is Spanish,
 * anything else English): "Oct 5, 2026", "W41, Oct 5 to 11" (or "W53, Dec 28
 * to Jan 3" across a month edge), "Oct 2026", "Q4 2026", "Season from Sep 1,
 * 2026". The input when it is not a date. */
export function periodLabel(kind: PeriodKind, periodStart: string, locale: string): string {
  if (!isCalendarDate(periodStart)) return periodStart;
  const es = locale === "es";
  const year = periodStart.slice(0, 4);
  const month = monthWord(periodStart, es);
  const day = dayNumber(periodStart);
  switch (kind) {
    case "day":
      return es ? `${day} ${month} ${year}` : `${month} ${day}, ${year}`;
    case "week": {
      const { week } = isoWeekOf(periodStart);
      const last = dayOffset(periodStart, 6);
      const lastMonth = monthWord(last, es);
      const lastDay = dayNumber(last);
      const w = `${es ? "S" : "W"}${String(week).padStart(2, "0")}`;
      if (lastMonth === month) return es ? `${w}, ${day} a ${lastDay} ${month}` : `${w}, ${month} ${day} to ${lastDay}`;
      return es ? `${w}, ${day} ${month} a ${lastDay} ${lastMonth}` : `${w}, ${month} ${day} to ${lastMonth} ${lastDay}`;
    }
    case "month":
      return `${month} ${year}`;
    case "quarter":
      return `${es ? "T" : "Q"}${Math.floor((Number(periodStart.slice(5, 7)) - 1) / 3) + 1} ${year}`;
    default:
      return es ? `Temporada desde ${day} ${month} ${year}` : `Season from ${month} ${day}, ${year}`;
  }
}

/** Harvest week n, 1 based from the ISO week holding the season start (the
 * pinned dd_season_start_date); null with no season start, a bad date, or a
 * day before that week. */
export function harvestWeekNumber(dayIso: string, seasonStartIso: string | null | undefined): number | null {
  const start = String(seasonStartIso ?? "").trim();
  if (!isCalendarDate(dayIso) || !isCalendarDate(start)) return null;
  const weeks = Math.round((dayMs(weekStartOf(dayIso)) - dayMs(weekStartOf(start))) / DAY_MS / 7);
  return weeks >= 0 ? weeks + 1 : null;
}
