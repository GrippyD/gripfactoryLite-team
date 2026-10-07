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
