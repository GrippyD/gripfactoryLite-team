/**
 * SENSOR RETENTION (BRIEF SR1). The quarter-past cron rolls raw sensor readings
 * into one row per unit per hour, then deletes raw rows older than the retention
 * whose hour is already rolled. History reads sensor_hourly only.
 */

import { getConfigValue } from "./db";
import { doorRoomNames } from "./environment";
import { dayAfter, dayBefore, etInstant, etWallClock, isCalendarDate } from "./farmday";
import { t, type Locale } from "./i18n";
import type { ReportColumn, ReportView } from "./reports";
import { esc } from "./ui";

export const ENVIRONMENT_HISTORY_KEY = "environment_history" as const;
export const SENSOR_RETENTION_KEY = "sensor_retention_days";
export const SENSOR_WATERMARK_KEY = "sensor_rollup_through";
export const SENSOR_RETENTION_FALLBACK = 90;
export const ROLL_MAX_HOURS = 24;
export const PURGE_CHUNK = 500;
export const PURGE_MAX_CHUNKS = 20;
export const HISTORY_DEFAULT_DAYS = 7;
const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;
const ROOM_CHUNK = 40;

export const ENVIRONMENT_HISTORY_SQL = `SELECT room, sensor_id, role, source, sensor_key, source_key, hour_start,
  readings, temp_min, temp_max, temp_avg, hum_min, hum_max, hum_avg, first_read_at, last_read_at
  FROM sensor_hourly
  WHERE room = ? AND hour_start >= ? AND hour_start < ?
  ORDER BY hour_start, sensor_key, source_key`;

export const ENVIRONMENT_HISTORY_ROOMS_SQL = `SELECT DISTINCT room FROM sensor_hourly`;

const NOT_A_DATE = "That is not a date.";
const TO_BEFORE_FROM = "To is before From.";

export type SensorRollupResult = {
  hours: number;
  readings: number;
  through: string;
  purged: number;
};

/** A positive whole number of days. 0, blank, and junk fall back to 90. */
export function sensorRetentionDays(raw: string | null | undefined): number {
  const text = String(raw ?? "").trim();
  if (!/^[1-9]\d*$/.test(text)) return SENSOR_RETENTION_FALLBACK;
  const n = Number(text);
  if (!Number.isInteger(n) || n <= 0) return SENSOR_RETENTION_FALLBACK;
  return n;
}

export async function readSensorRetentionDays(db: D1Database): Promise<number> {
  return sensorRetentionDays(await getConfigValue(db, SENSOR_RETENTION_KEY));
}

/** The newest UTC hour that ended at least two hours before now. */
export function latestRolledHourStart(nowIso: string): string {
  const ms = Date.parse(nowIso);
  if (!Number.isFinite(ms)) return "";
  const held = new Date(ms - 2 * HOUR_MS).toISOString();
  const floored = floorUtcHour(held);
  if (!floored) return "";
  return addHours(floored, -1);
}

export function floorUtcHour(iso: string): string {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return "";
  return new Date(Math.floor(ms / HOUR_MS) * HOUR_MS).toISOString();
}

export function addHours(iso: string, n: number): string {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return "";
  return new Date(ms + n * HOUR_MS).toISOString();
}

async function readWatermark(db: D1Database): Promise<string> {
  return (await getConfigValue(db, SENSOR_WATERMARK_KEY) ?? "").trim();
}

async function writeWatermark(db: D1Database, hour: string, now: string): Promise<void> {
  const live = await db
    .prepare(`SELECT value FROM app_config WHERE key = ? AND deleted_at IS NULL`)
    .bind(SENSOR_WATERMARK_KEY)
    .first<{ value: string }>();
  if (live) {
    await db
      .prepare(`UPDATE app_config SET value = ?, updated_at = ? WHERE key = ? AND deleted_at IS NULL`)
      .bind(hour, now, SENSOR_WATERMARK_KEY)
      .run();
    return;
  }
  await db
    .prepare(
      `INSERT INTO app_config (key, value, created_at, created_by, updated_at, updated_by, deleted_at, deleted_by)
       VALUES (?, ?, ?, NULL, ?, NULL, NULL, NULL)`
    )
    .bind(SENSOR_WATERMARK_KEY, hour, now, now)
    .run();
}

/** Door rooms, plus any room already on the hourly table. */
export async function environmentHistoryRooms(db: D1Database): Promise<string[]> {
  const named = await doorRoomNames(db);
  const extra = await db.prepare(ENVIRONMENT_HISTORY_ROOMS_SQL).all<{ room: string }>();
  const seen = new Set(named.map((name) => name.toUpperCase()));
  const out = [...named];
  for (const row of extra.results ?? []) {
    const name = String(row.room ?? "").trim();
    if (!name || seen.has(name.toUpperCase())) continue;
    seen.add(name.toUpperCase());
    out.push(name);
  }
  return out;
}

async function oldestHour(db: D1Database, rooms: readonly string[]): Promise<string> {
  let oldest = "";
  const sql = `SELECT MIN(read_at) AS read_at FROM sensor_readings
    WHERE room = ? AND lower(trim(coalesce(source, ''))) <> 'test'`;
  for (const room of rooms) {
    const row = await db.prepare(sql).bind(room).first<{ read_at: string | null }>();
    const read = String(row?.read_at ?? "");
    if (!read) continue;
    if (!oldest || read < oldest) oldest = read;
  }
  return oldest ? floorUtcHour(oldest) : "";
}

function insertHourSql(roomCount: number): string {
  const marks = Array.from({ length: roomCount }, () => "?").join(", ");
  return `INSERT INTO sensor_hourly (
    id, room, sensor_id, role, source, sensor_key, source_key, hour_start,
    readings, temp_min, temp_max, temp_avg, hum_min, hum_max, hum_avg,
    first_read_at, last_read_at, rolled_at
  )
  SELECT
    g.room || '|' || g.sensor_key || '|' || g.source_key || '|' || ?,
    g.room,
    NULLIF(g.sensor_key, ''),
    g.role,
    NULLIF(g.source_key, ''),
    g.sensor_key,
    g.source_key,
    ?,
    g.readings,
    g.temp_min,
    g.temp_max,
    g.temp_avg,
    g.hum_min,
    g.hum_max,
    g.hum_avg,
    g.first_read_at,
    g.last_read_at,
    ?
  FROM (
    SELECT
      r.room AS room,
      COALESCE(r.sensor_id, '') AS sensor_key,
      COALESCE(r.source, '') AS source_key,
      MAX(r.role) AS role,
      COUNT(*) AS readings,
      MIN(r.temperature_f) AS temp_min,
      MAX(r.temperature_f) AS temp_max,
      AVG(r.temperature_f) AS temp_avg,
      MIN(r.humidity_pct) AS hum_min,
      MAX(r.humidity_pct) AS hum_max,
      AVG(r.humidity_pct) AS hum_avg,
      MIN(r.read_at) AS first_read_at,
      MAX(r.read_at) AS last_read_at
    FROM sensor_readings r
    WHERE r.read_at >= ? AND r.read_at < ?
      AND lower(trim(coalesce(r.source, ''))) <> 'test'
      AND r.room IN (${marks})
      AND NOT EXISTS (
        SELECT 1 FROM sensor_hourly h
        WHERE h.room = r.room
          AND h.sensor_key = COALESCE(r.sensor_id, '')
          AND h.source_key = COALESCE(r.source, '')
          AND h.hour_start = ?
      )
    GROUP BY r.room, COALESCE(r.sensor_id, ''), COALESCE(r.source, '')
  ) g`;
}

/** Readings already rolled for these rooms in one UTC hour, through the (room, hour_start) index. */
async function hourReadings(db: D1Database, rooms: readonly string[], hour: string): Promise<number> {
  let total = 0;
  for (let i = 0; i < rooms.length; i += ROOM_CHUNK) {
    const part = rooms.slice(i, i + ROOM_CHUNK);
    const marks = part.map(() => "?").join(", ");
    const row = await db
      .prepare(`SELECT COALESCE(SUM(readings), 0) AS n FROM sensor_hourly WHERE room IN (${marks}) AND hour_start = ?`)
      .bind(...part, hour)
      .first<{ n: number }>();
    total += Number(row?.n ?? 0);
  }
  return total;
}

async function rollOneHour(db: D1Database, rooms: readonly string[], hour: string, rolledAt: string): Promise<number> {
  if (rooms.length === 0) return 0;
  const before = await hourReadings(db, rooms, hour);
  const end = addHours(hour, 1);
  for (let i = 0; i < rooms.length; i += ROOM_CHUNK) {
    const part = rooms.slice(i, i + ROOM_CHUNK);
    await db
      .prepare(insertHourSql(part.length))
      .bind(hour, hour, rolledAt, hour, end, ...part, hour)
      .run();
  }
  const after = await hourReadings(db, rooms, hour);
  return Math.max(0, after - before);
}

const PURGE_IDS_SQL = `SELECT r.id FROM sensor_readings r
  WHERE r.read_at < ?
    AND (
      lower(trim(coalesce(r.source, ''))) = 'test'
      OR (
        ? <> ''
        AND substr(r.read_at, 1, 13) || ':00:00.000Z' <= ?
        AND lower(trim(coalesce(r.source, ''))) <> 'test'
        AND NOT (
          r.sensor_id IS NOT NULL
          AND r.read_at = (
            SELECT MAX(s2.read_at) FROM sensor_readings s2
            WHERE s2.sensor_id = r.sensor_id
              AND lower(trim(coalesce(s2.source, ''))) <> 'test'
          )
        )
        AND NOT (
          r.role IS NULL
          AND r.read_at = (
            SELECT MAX(d.read_at) FROM sensor_readings d
            WHERE d.room = r.room
              AND d.role IS NULL
              AND lower(trim(coalesce(d.source, ''))) <> 'test'
          )
        )
      )
    )
  ORDER BY r.room, r.read_at
  LIMIT ${PURGE_CHUNK}`;

async function purgeRaw(db: D1Database, nowIso: string, watermark: string): Promise<number> {
  const days = await readSensorRetentionDays(db);
  const cutoff = new Date(Date.parse(nowIso) - days * DAY_MS).toISOString();
  let purged = 0;
  for (let chunk = 0; chunk < PURGE_MAX_CHUNKS; chunk++) {
    const picked = await db.prepare(PURGE_IDS_SQL).bind(cutoff, watermark, watermark).all<{ id: string }>();
    const ids = (picked.results ?? []).map((row) => String(row.id)).filter((id) => id.length > 0);
    if (ids.length === 0) break;
    let removed = 0;
    for (let i = 0; i < ids.length; i += 80) {
      const part = ids.slice(i, i + 80);
      const marks = part.map(() => "?").join(", ");
      const out = await db.prepare(`DELETE FROM sensor_readings WHERE id IN (${marks})`).bind(...part).run();
      removed += Number(out.meta?.changes ?? part.length);
    }
    purged += removed;
    if (ids.length < PURGE_CHUNK) break;
  }
  return purged;
}

/** Roll at most 24 hours up through the two-hour hold, then purge. */
export async function rollupSensorHours(db: D1Database, nowIso: string): Promise<SensorRollupResult> {
  const latest = latestRolledHourStart(nowIso);
  const watermark = await readWatermark(db);
  const rooms = await environmentHistoryRooms(db);
  let start = watermark ? addHours(watermark, 1) : await oldestHour(db, rooms);
  let hours = 0;
  let readings = 0;
  let through = watermark;
  if (start && latest && start <= latest) {
    let cursor = start;
    while (cursor && cursor <= latest && hours < ROLL_MAX_HOURS) {
      readings += await rollOneHour(db, rooms, cursor, nowIso);
      hours += 1;
      through = cursor;
      cursor = addHours(cursor, 1);
    }
    if (hours > 0 && through) await writeWatermark(db, through, nowIso);
  }
  const purged = await purgeRaw(db, nowIso, through);
  return { hours, readings, through, purged };
}

export type HistoryRange = { ok: true; from: string; to: string } | { ok: false; message: string };

/** Blank From is six days before To. Blank To is the farm's today. */
export function resolveHistoryRange(from: string | null, to: string | null, today: string): HistoryRange {
  let fromDay = (from ?? "").trim();
  let toDay = (to ?? "").trim();
  if (!toDay) toDay = today;
  if (!fromDay) {
    fromDay = toDay;
    for (let i = 1; i < HISTORY_DEFAULT_DAYS; i++) fromDay = dayBefore(fromDay);
  }
  if (!isCalendarDate(fromDay) || !isCalendarDate(toDay)) return { ok: false, message: NOT_A_DATE };
  if (toDay < fromDay) return { ok: false, message: TO_BEFORE_FROM };
  return { ok: true, from: fromDay, to: toDay };
}

/** Eastern midnight of From through the midnight after To, as UTC instants. */
export function historyWindow(from: string, to: string): { startIso: string; endIso: string } {
  return { startIso: etInstant(from, "00:00"), endIso: etInstant(dayAfter(to), "00:00") };
}

type HistoryRow = {
  room: string;
  sensor_key: string;
  source_key: string;
  hour_start: string;
  readings: number;
  temp_min: number;
  temp_max: number;
  temp_avg: number;
  hum_min: number | null;
  hum_max: number | null;
  hum_avg: number | null;
};

export const ENVIRONMENT_HISTORY_COLUMNS: ReportColumn[] = [
  { key: "room", label: "Room" },
  { key: "hour", label: "Hour" },
  { key: "unit", label: "Unit" },
  { key: "readings", label: "Readings" },
  { key: "temp_min", label: "Temp min" },
  { key: "temp_avg", label: "Temp avg" },
  { key: "temp_max", label: "Temp max" },
  { key: "hum_min", label: "Humidity min" },
  { key: "hum_avg", label: "Humidity avg" },
  { key: "hum_max", label: "Humidity max" },
];

function measureText(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(Number(value))) return "";
  const rounded = Math.round(Number(value) * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

function numOrNull(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function unitLabel(row: HistoryRow, locale: Locale, collide: boolean): string {
  const sensor = row.sensor_key.trim();
  const source = row.source_key.trim();
  if (sensor && source && collide) return `${sensor} (${source})`;
  if (sensor) return sensor;
  if (source) return source;
  return t(locale, "Door");
}

function weighted(rows: readonly HistoryRow[], pick: (row: HistoryRow) => number | null): number | null {
  let sum = 0;
  let weight = 0;
  for (const row of rows) {
    const value = pick(row);
    if (value == null) continue;
    sum += value * row.readings;
    weight += row.readings;
  }
  if (weight === 0) return null;
  return sum / weight;
}

function extreme(rows: readonly HistoryRow[], pick: (row: HistoryRow) => number | null, which: "min" | "max"): number | null {
  let found: number | null = null;
  for (const row of rows) {
    const value = pick(row);
    if (value == null) continue;
    if (found == null || (which === "min" ? value < found : value > found)) found = value;
  }
  return found;
}

export function environmentHistoryView(rows: readonly HistoryRow[], room: string, from: string, to: string, locale: Locale): ReportView {
  const groups = new Map<string, HistoryRow[]>();
  for (const row of rows) {
    const key = `${row.room}\n${row.hour_start}`;
    const list = groups.get(key);
    if (list) list.push(row);
    else groups.set(key, [row]);
  }
  const out: ReportView["rows"] = [];
  const keys = [...groups.keys()].sort();
  for (const key of keys) {
    const list = groups.get(key) ?? [];
    list.sort((a, b) => a.sensor_key.localeCompare(b.sensor_key) || a.source_key.localeCompare(b.source_key));
    const seen = new Set<string>();
    const collide = new Set<string>();
    for (const row of list) {
      if (!row.sensor_key) continue;
      if (seen.has(row.sensor_key)) collide.add(row.sensor_key);
      seen.add(row.sensor_key);
    }
    for (const row of list) {
      out.push({
        room: row.room,
        hour: etWallClock(row.hour_start) || row.hour_start,
        unit: unitLabel(row, locale, collide.has(row.sensor_key)),
        readings: row.readings,
        temp_min: measureText(row.temp_min),
        temp_avg: measureText(row.temp_avg),
        temp_max: measureText(row.temp_max),
        hum_min: measureText(row.hum_min),
        hum_avg: measureText(row.hum_avg),
        hum_max: measureText(row.hum_max),
      });
    }
    if (list.length > 1) {
      const roomName = list[0]?.room ?? "";
      const hour = list[0]?.hour_start ?? "";
      out.push({
        room: roomName,
        hour: etWallClock(hour) || hour,
        unit: t(locale, "Average"),
        readings: list.reduce((sum, row) => sum + row.readings, 0),
        temp_min: measureText(extreme(list, (row) => row.temp_min, "min")),
        temp_avg: measureText(weighted(list, (row) => row.temp_avg)),
        temp_max: measureText(extreme(list, (row) => row.temp_max, "max")),
        hum_min: measureText(extreme(list, (row) => row.hum_min, "min")),
        hum_avg: measureText(weighted(list, (row) => row.hum_avg)),
        hum_max: measureText(extreme(list, (row) => row.hum_max, "max")),
      });
    }
  }
  const who = room ? room : t(locale, "All rooms");
  return {
    key: ENVIRONMENT_HISTORY_KEY,
    title: "Environment history",
    columns: ENVIRONMENT_HISTORY_COLUMNS,
    rows: out,
    heading: `${who} · ${from} to ${to}`,
    empty: t(locale, "No readings in that range."),
    footnote: t(locale, "The room average sits under an hour with more than one unit. History reads the hourly table."),
  };
}

function refusedHistory(message: string, locale: Locale): ReportView {
  return {
    key: ENVIRONMENT_HISTORY_KEY,
    title: "Environment history",
    columns: ENVIRONMENT_HISTORY_COLUMNS,
    rows: [],
    empty: t(locale, message),
    heading: t(locale, message),
  };
}

export function environmentHistoryFilterHtml(
  rooms: readonly string[],
  filter: { from: string; to: string; room: string },
  locale: Locale
): string {
  const opt = (value: string, label: string) =>
    `<option value="${esc(value)}"${filter.room === value ? " selected" : ""}>${esc(label)}</option>`;
  const names = [...rooms];
  if (filter.room && !names.some((name) => name === filter.room)) names.push(filter.room);
  const roomOpts = [opt("", t(locale, "All rooms")), ...names.map((name) => opt(name, name))].join("");
  return `<label class="field">${t(locale, "Room")} <select name="room">${roomOpts}</select></label>
      <label class="field">${t(locale, "From")} <input type="date" name="from" value="${esc(filter.from)}"></label>
      <label class="field">${t(locale, "To")} <input type="date" name="to" value="${esc(filter.to)}"></label>
      <p class="muted">${esc(t(locale, "Dates are the farm's days, Eastern. One line per unit per hour."))}</p>`;
}

async function readHistoryRoom(db: D1Database, room: string, startIso: string, endIso: string): Promise<HistoryRow[]> {
  const got = await db.prepare(ENVIRONMENT_HISTORY_SQL).bind(room, startIso, endIso).all<HistoryRow>();
  return (got.results ?? []).map((row) => ({
    room: String(row.room ?? ""),
    sensor_key: String(row.sensor_key ?? ""),
    source_key: String(row.source_key ?? ""),
    hour_start: String(row.hour_start ?? ""),
    readings: Number(row.readings ?? 0),
    temp_min: Number(row.temp_min ?? 0),
    temp_max: Number(row.temp_max ?? 0),
    temp_avg: Number(row.temp_avg ?? 0),
    hum_min: numOrNull(row.hum_min),
    hum_max: numOrNull(row.hum_max),
    hum_avg: numOrNull(row.hum_avg),
  }));
}

export async function loadEnvironmentHistory(
  db: D1Database,
  params: URLSearchParams,
  today: string,
  locale: Locale
): Promise<{ view: ReportView; filterHtml: string; from: string; to: string; ok: boolean }> {
  const range = resolveHistoryRange(params.get("from"), params.get("to"), today);
  const rooms = await environmentHistoryRooms(db);
  const room = (params.get("room") ?? "").trim();
  const from = range.ok ? range.from : (params.get("from") ?? "").trim();
  const to = range.ok ? range.to : (params.get("to") ?? "").trim();
  const filterHtml = environmentHistoryFilterHtml(rooms, { from, to, room }, locale);
  if (!range.ok) {
    return { view: refusedHistory(range.message, locale), filterHtml, from, to, ok: false };
  }
  const window = historyWindow(range.from, range.to);
  const picked = room ? [room] : rooms;
  const rows: HistoryRow[] = [];
  for (const name of picked) rows.push(...(await readHistoryRoom(db, name, window.startIso, window.endIso)));
  return {
    view: environmentHistoryView(rows, room, range.from, range.to, locale),
    filterHtml,
    from: range.from,
    to: range.to,
    ok: true,
  };
}
