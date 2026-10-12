/**
 * THE ENVIRONMENT FLAGS (canon 0.30.246). A bound sensor is out when its newest
 * reading breaks a set bound, stale when that reading is older than the window
 * or none has arrived since it was bound, and in otherwise. A door reading with
 * a temperature and no humidity is a room reading for that space.
 */

import { HttpError, nowIso, requireReason, textOrNull } from "./audit";
import { CONFIG_KEYS, ENVIRONMENT_PATH, ENV_ROLES, type EnvRole } from "./config";
import { getConfigValue, insertLog, requireActor } from "./db";
import { etWallClock } from "./farmday";
import { t, tFill, type Locale } from "./i18n";
import { esc } from "./ui";

const MINUTE_MS = 60_000;
const HOUR_MS = 3_600_000;
/** Each unit's newest reading within this long of the room's newest reading joins the mean. */
export const DOOR_UNIT_WINDOW_MS = 15 * MINUTE_MS;

export type EnvRange = {
  tempLow: number | null;
  tempHigh: number | null;
  humidityLow: number | null;
  humidityHigh: number | null;
};

export type EnvSample = {
  temperatureF: number;
  humidityPct: number | null;
  readAt: string;
};

export function roleWord(role: string): string {
  const key = role.trim().toLowerCase();
  if (key === "room") return "Room";
  if (key === "bed") return "Bed";
  if (key === "plenum") return "Plenum";
  if (key === "exhaust") return "Exhaust";
  return role.trim() || "Room";
}

export function readingNumber(n: number): string {
  const rounded = Math.round(n * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : String(rounded);
}

/** A stored test row never shows on the panes (case-blind, trimmed). */
export function isTestSensorSource(source: string | null | undefined): boolean {
  return String(source ?? "").trim().toLowerCase() === "test";
}

export type DoorSample = {
  sensor_id: string | null;
  temperature_f: number;
  humidity_pct: number | null;
  read_at: string;
  source: string | null;
};

export type DoorAverage = {
  room: string;
  temperatureF: number;
  humidityPct: number | null;
  readAt: string;
  source: string;
  units: number;
};

/** One unit per sensor id. Rows with no sensor id are one unit for the room.
 * The mean is the newest row of each unit that still sits within 15 minutes of the newest. */
export function averageDoorRows(rows: readonly DoorSample[]): Omit<DoorAverage, "room"> | null {
  const live = rows.filter((row) => row.read_at && !isTestSensorSource(row.source));
  if (live.length === 0) return null;
  let newestAt = live[0].read_at;
  for (const row of live) if (row.read_at > newestAt) newestAt = row.read_at;
  const newestMs = Date.parse(newestAt);
  const windowed = live.filter((row) => {
    const at = Date.parse(row.read_at);
    return Number.isFinite(newestMs) && Number.isFinite(at) && newestMs - at <= DOOR_UNIT_WINDOW_MS;
  });
  const byUnit = new Map<string, DoorSample>();
  for (const row of windowed) {
    const id = String(row.sensor_id ?? "").trim();
    const key = id ? `id:${id}` : "door";
    const held = byUnit.get(key);
    if (!held || row.read_at > held.read_at) byUnit.set(key, row);
  }
  const units = [...byUnit.values()];
  if (units.length === 0) return null;
  let newest = units[0];
  for (const row of units) if (row.read_at > newest.read_at) newest = row;
  const temperatureF = units.reduce((sum, row) => sum + Number(row.temperature_f), 0) / units.length;
  const humids = units
    .map((row) => (row.humidity_pct == null ? null : Number(row.humidity_pct)))
    .filter((n): n is number => n != null && Number.isFinite(n));
  const humidityPct = humids.length === 0 ? null : humids.reduce((sum, n) => sum + n, 0) / humids.length;
  return {
    temperatureF,
    humidityPct,
    readAt: newest.read_at,
    source: String(newest.source ?? "").trim(),
    units: units.length,
  };
}

const DOOR_MAX_SQL = `SELECT MAX(read_at) AS read_at FROM sensor_readings
  WHERE room = ? AND role IS NULL AND lower(trim(coalesce(source, ''))) <> 'test'`;
const DOOR_WINDOW_SQL = `SELECT sensor_id, temperature_f, humidity_pct, read_at, source
  FROM sensor_readings
  WHERE room = ? AND role IS NULL AND lower(trim(coalesce(source, ''))) <> 'test' AND read_at >= ?`;

/** The room's door readings (role empty: the push door, not a SensorPush pull row), averaged. */
export async function readDoorAverage(db: D1Database, room: string): Promise<DoorAverage | null> {
  const max = await db.prepare(DOOR_MAX_SQL).bind(room).first<{ read_at: string | null }>();
  if (!max?.read_at) return null;
  const newestMs = Date.parse(max.read_at);
  if (!Number.isFinite(newestMs)) return null;
  const cutoff = new Date(newestMs - DOOR_UNIT_WINDOW_MS).toISOString();
  const got = await db.prepare(DOOR_WINDOW_SQL).bind(room, cutoff).all<DoorSample>();
  const avg = averageDoorRows(got.results ?? []);
  if (!avg) return null;
  return { room, ...avg };
}

/** HF1 (2026-10-12): the rooms a door reading can name, from the lookups the
 * app already keeps (the cure rooms of app_config, the dry spaces, every space
 * with an environment range or a sensor binding), never from a GROUP BY over
 * sensor_readings, which scanned every reading on every page (D1 reset the
 * database for CPU time past about 175,000 rows). A room with readings but no
 * range, binding, cure seat or dry space has nothing to flag and no pane. */
export async function doorRoomNames(db: D1Database): Promise<string[]> {
  const [rooms, spaces, ranges, bindings] = await Promise.all([
    db.prepare(`SELECT value FROM app_config WHERE key = ? AND deleted_at IS NULL`).bind(CONFIG_KEYS.cure_rooms).first<{ value: string }>(),
    db.prepare(`SELECT name FROM dry_spaces WHERE deleted_at IS NULL`).all<{ name: string }>(),
    db.prepare(`SELECT DISTINCT space_name AS name FROM environment_ranges WHERE deleted_at IS NULL`).all<{ name: string }>(),
    db.prepare(`SELECT DISTINCT space_name AS name FROM sensor_bindings WHERE deleted_at IS NULL AND space_name IS NOT NULL`).all<{ name: string }>(),
  ]);
  // The door stores a room in the lookup's own spelling (oneReading in cure.ts
  // matches the name case-insensitively and keeps the lookup's), so the names
  // are kept as the lookups spell them and deduped without case.
  const out = new Map<string, string>();
  const add = (raw: unknown) => {
    const name = String(raw ?? "").trim();
    if (name && !out.has(name.toUpperCase())) out.set(name.toUpperCase(), name);
  };
  const configured = String(rooms?.value ?? "")
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
  for (const room of configured.length > 0 ? configured : ["CSA", "CSB"]) add(room);
  for (const list of [spaces, ranges, bindings]) for (const row of list.results ?? []) add(row.name);
  return [...out.values()];
}

export async function listDoorAverages(db: D1Database): Promise<DoorAverage[]> {
  const out: DoorAverage[] = [];
  for (const room of await doorRoomNames(db)) {
    const one = await readDoorAverage(db, room);
    if (one) out.push(one);
  }
  return out;
}

export type NewestRead = { sensor_id: string; room: string | null; role: string | null; temperature_f: number; humidity_pct: number | null; read_at: string };

/** HF1 (2026-10-12): the newest reading of each named sensor, one index seek
 * per sensor (the unique index on sensor_id, read_at), in place of the
 * correlated MAX over the whole table that ran once per reading. */
export async function newestReadings(db: D1Database, sensorIds: readonly string[]): Promise<Map<string, NewestRead>> {
  const ids = [...new Set(sensorIds.map((id) => String(id ?? "").trim()).filter((id) => id.length > 0))];
  const out = new Map<string, NewestRead>();
  if (ids.length === 0) return out;
  const sql = `SELECT sensor_id, room, role, temperature_f, humidity_pct, read_at FROM sensor_readings
    WHERE sensor_id = ? ORDER BY read_at DESC LIMIT 1`;
  for (let i = 0; i < ids.length; i += 50) {
    const chunk = ids.slice(i, i + 50);
    const results = await db.batch<NewestRead>(chunk.map((id) => db.prepare(sql).bind(id)));
    for (const r of results) for (const row of r.results ?? []) out.set(String(row.sensor_id), row);
  }
  return out;
}

/** Hover words: the reading's Eastern wall clock and its stored source. */
export function sensorReadingTitle(reading: { readAt: string; source?: string }): string {
  const when = etWallClock(reading.readAt);
  const source = (reading.source ?? "").trim();
  if (when && source) return `${when} ET · ${source}`;
  if (when) return `${when} ET`;
  return source;
}

/** The pane line: mean temperature, mean humidity, "{n} units" when more than one, then age and source. */
export function sensorConditionsText(
  reading: { temperatureF: number; humidityPct: number | null; readAt: string; source?: string; units?: number },
  nowIso: string,
  locale: Locale
): { text: string; stale: boolean } {
  const age = Date.parse(nowIso) - Date.parse(reading.readAt);
  const stale = !Number.isFinite(age) || age > HOUR_MS;
  const min = Number.isFinite(age) ? Math.max(0, Math.round(age / MINUTE_MS)) : 0;
  const ago =
    min < 60
      ? t(locale, "{n} min ago").replace("{n}", String(min))
      : min < 120
        ? t(locale, "1 hour ago")
        : t(locale, "{n} hours ago").replace("{n}", String(Math.floor(min / 60)));
  const humid = reading.humidityPct == null ? "" : ` · ${readingNumber(reading.humidityPct)} %`;
  const count = reading.units != null && reading.units > 1 ? ` · ${tFill(locale, "{n} units", { n: String(reading.units) })}` : "";
  const source = (reading.source ?? "").trim();
  const tagged = source.toLowerCase() === "silo-ops" ? ` · ${t(locale, "Silo Ops")}` : "";
  return { text: `${readingNumber(reading.temperatureF)} F${humid}${count} · ${ago}${tagged}`, stale };
}

export function ageWords(ms: number): string {
  const min = Math.max(0, Math.round(ms / MINUTE_MS));
  const hours = Math.floor(min / 60);
  const minutes = min % 60;
  if (hours <= 0) return `${minutes} m`;
  return `${hours} h ${minutes} m`;
}

function numOrNull(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/** The words a tile and a menu line show. Empty when the sensor is in range and fresh. */
export function environmentFlagLines(
  role: string,
  reading: EnvSample | null,
  range: EnvRange | null,
  nowIso: string,
  staleMinutes: number,
  sinceIso: string | null,
  locale: Locale = "en"
): string[] {
  const name = t(locale, roleWord(role));
  const now = Date.parse(nowIso);
  const windowMs = Math.max(1, staleMinutes) * MINUTE_MS;
  const readAt = reading ? Date.parse(reading.readAt) : NaN;
  const since = sinceIso ? Date.parse(sinceIso) : NaN;
  const fresh = Number.isFinite(readAt) && (!Number.isFinite(since) || readAt >= since) && Number.isFinite(now) && now - readAt <= windowMs;
  if (!fresh) {
    const from = Number.isFinite(readAt) ? readAt : Number.isFinite(since) ? since : now;
    const age = Number.isFinite(now) && Number.isFinite(from) ? now - from : 0;
    return [t(locale, "{role} no reading for {age}").replace("{role}", name).replace("{age}", ageWords(age))];
  }
  if (!reading || !range) return [];
  const lines: string[] = [];
  if (range.tempHigh != null && reading.temperatureF > range.tempHigh) {
    lines.push(
      t(locale, "{role} {n} F, above {bound} F")
        .replace("{role}", name)
        .replace("{n}", readingNumber(reading.temperatureF))
        .replace("{bound}", readingNumber(range.tempHigh))
    );
  }
  if (range.tempLow != null && reading.temperatureF < range.tempLow) {
    lines.push(
      t(locale, "{role} {n} F, below {bound} F")
        .replace("{role}", name)
        .replace("{n}", readingNumber(reading.temperatureF))
        .replace("{bound}", readingNumber(range.tempLow))
    );
  }
  if (reading.humidityPct != null && range.humidityHigh != null && reading.humidityPct > range.humidityHigh) {
    lines.push(
      t(locale, "{role} humidity {n} %, above {bound} %")
        .replace("{role}", name)
        .replace("{n}", readingNumber(reading.humidityPct))
        .replace("{bound}", readingNumber(range.humidityHigh))
    );
  }
  if (reading.humidityPct != null && range.humidityLow != null && reading.humidityPct < range.humidityLow) {
    lines.push(
      t(locale, "{role} humidity {n} %, below {bound} %")
        .replace("{role}", name)
        .replace("{n}", readingNumber(reading.humidityPct))
        .replace("{bound}", readingNumber(range.humidityLow))
    );
  }
  return lines;
}

type BindingRow = { sensor_id: string; space_name: string; role: string; bound_at: string | null };
type RangeRow = {
  space_name: string;
  role: string;
  temp_low: number | null;
  temp_high: number | null;
  humidity_low: number | null;
  humidity_high: number | null;
};

export async function staleMinutes(db: D1Database): Promise<number> {
  const raw = await getConfigValue(db, CONFIG_KEYS.environment_stale_minutes);
  const n = Number(String(raw ?? "").trim());
  return Number.isFinite(n) && n > 0 ? n : 60;
}

export async function listEnvironmentFlags(db: D1Database, now: string, locale: Locale = "en"): Promise<Record<string, string[]>> {
  const [bindings, ranges, doorAverages, minutes] = await Promise.all([
    db
      .prepare(
        `SELECT sensor_id, space_name, role, bound_at FROM sensor_bindings
         WHERE deleted_at IS NULL AND space_name IS NOT NULL AND trim(space_name) <> '' AND role IS NOT NULL`
      )
      .all<BindingRow>(),
    db
      .prepare(
        `SELECT space_name, role, temp_low, temp_high, humidity_low, humidity_high
         FROM environment_ranges WHERE deleted_at IS NULL`
      )
      .all<RangeRow>(),
    listDoorAverages(db),
    staleMinutes(db),
  ]);
  // HF1: only the bound sensors are read, one seek each.
  const bySensor = await newestReadings(
    db,
    (bindings.results ?? []).map((row) => row.sensor_id)
  );
  const rangeOf = new Map((ranges.results ?? []).map((row) => [`${row.space_name}\n${row.role}`, row]));
  const doorOf = new Map(doorAverages.map((row) => [row.room.trim().toUpperCase(), row]));
  const out = new Map<string, string[]>();
  const push = (space: string, lines: string[]) => {
    if (lines.length === 0) return;
    const cur = out.get(space) ?? [];
    cur.push(...lines);
    out.set(space, cur);
  };
  const seenRoom = new Set<string>();
  for (const binding of bindings.results ?? []) {
    const space = binding.space_name.trim();
    const role = binding.role.trim().toLowerCase();
    const key = `${space}\n${role}`;
    const range = rangeOf.get(key);
    const read = bySensor.get(binding.sensor_id);
    if (role === "room") seenRoom.add(space.toUpperCase());
    push(
      space,
      environmentFlagLines(
        role,
        read
          ? { temperatureF: Number(read.temperature_f), humidityPct: read.humidity_pct == null ? null : Number(read.humidity_pct), readAt: read.read_at }
          : null,
        range
          ? { tempLow: numOrNull(range.temp_low), tempHigh: numOrNull(range.temp_high), humidityLow: numOrNull(range.humidity_low), humidityHigh: numOrNull(range.humidity_high) }
          : null,
        now,
        minutes,
        binding.bound_at,
        locale
      )
    );
  }
  for (const [spaceKey, read] of doorOf) {
    if (seenRoom.has(spaceKey)) {
      const bound = (bindings.results ?? []).find((row) => row.space_name.trim().toUpperCase() === spaceKey && row.role.trim().toLowerCase() === "room");
      if (bound) {
        const sensor = bySensor.get(bound.sensor_id);
        if (sensor && sensor.read_at >= read.readAt) continue;
      }
    }
    const space = read.room;
    const range = rangeOf.get(`${space}\nroom`);
    if (!range && seenRoom.has(spaceKey)) continue;
    if (!range) continue;
    push(
      space,
      environmentFlagLines(
        "room",
        { temperatureF: read.temperatureF, humidityPct: read.humidityPct, readAt: read.readAt },
        { tempLow: numOrNull(range.temp_low), tempHigh: numOrNull(range.temp_high), humidityLow: numOrNull(range.humidity_low), humidityHigh: numOrNull(range.humidity_high) },
        now,
        minutes,
        null,
        locale
      )
    );
  }
  return Object.fromEntries(out);
}

export type EnvironmentSensor = {
  sensor_id: string;
  name: string;
  battery: number | null;
  space_name: string;
  role: string;
  newest: string;
};

export type EnvironmentPage = {
  sensors: EnvironmentSensor[];
  spaces: string[];
  ranges: RangeRow[];
  staleMinutes: number;
  pull: { pulled_at: string; sample_count: number; error: string | null } | null;
  asOf: string;
  doorRooms: DoorAverage[];
};

export async function loadEnvironmentPage(db: D1Database): Promise<EnvironmentPage> {
  const [catalog, bindings, ranges, spaces, rooms, pull, minutes, doorRooms] = await Promise.all([
    db.prepare(`SELECT sensor_id, name, battery_voltage FROM sensor_catalog ORDER BY name, sensor_id`).all<{ sensor_id: string; name: string | null; battery_voltage: number | null }>(),
    db.prepare(`SELECT sensor_id, space_name, role FROM sensor_bindings WHERE deleted_at IS NULL`).all<{ sensor_id: string; space_name: string | null; role: string | null }>(),
    db.prepare(`SELECT space_name, role, temp_low, temp_high, humidity_low, humidity_high FROM environment_ranges WHERE deleted_at IS NULL ORDER BY space_name, role`).all<RangeRow>(),
    db.prepare(`SELECT name FROM dry_spaces WHERE deleted_at IS NULL ORDER BY name`).all<{ name: string }>(),
    db.prepare(`SELECT value FROM app_config WHERE key = ? AND deleted_at IS NULL`).bind(CONFIG_KEYS.cure_rooms).first<{ value: string }>(),
    db.prepare(`SELECT pulled_at, sample_count, error FROM environment_pulls ORDER BY pulled_at DESC LIMIT 1`).first<{ pulled_at: string; sample_count: number; error: string | null }>(),
    staleMinutes(db),
    listDoorAverages(db),
  ]);
  const bound = new Map((bindings.results ?? []).map((row) => [row.sensor_id, row]));
  // HF1: the catalog's and the bindings' sensors, one seek each.
  const newest = await newestReadings(db, [
    ...(catalog.results ?? []).map((row) => row.sensor_id),
    ...(bindings.results ?? []).map((row) => row.sensor_id),
  ]);
  const spaceNames = [...(spaces.results ?? []).map((row) => row.name)];
  const roomNames = String(rooms?.value ?? "")
    .split(",")
    .map((part) => part.trim().toUpperCase())
    .filter((part) => part.length > 0);
  const cureNames = roomNames.length > 0 ? [...new Set(roomNames)] : ["CSA", "CSB"];
  for (const room of cureNames) {
    if (!spaceNames.some((name) => name.toUpperCase() === room.toUpperCase())) spaceNames.push(room);
  }
  return {
    sensors: (catalog.results ?? []).map((row) => {
      const link = bound.get(row.sensor_id);
      const read = newest.get(row.sensor_id);
      const bits = read ? [`${readingNumber(Number(read.temperature_f))} F`] : [];
      if (read && read.humidity_pct != null) bits.push(`${readingNumber(Number(read.humidity_pct))} %`);
      if (read) bits.push(read.read_at);
      return {
        sensor_id: row.sensor_id,
        name: row.name ?? "",
        battery: row.battery_voltage == null ? null : Number(row.battery_voltage),
        space_name: link?.space_name ?? "",
        role: link?.role ?? "",
        newest: bits.join(" · "),
      };
    }),
    spaces: spaceNames,
    ranges: ranges.results ?? [],
    staleMinutes: minutes,
    pull: pull ? { pulled_at: pull.pulled_at, sample_count: Number(pull.sample_count), error: pull.error } : null,
    asOf: nowIso(),
    doorRooms,
  };
}

function option(value: string, label: string, selected: string): string {
  return `<option value="${esc(value)}"${value === selected ? " selected" : ""}>${esc(label)}</option>`;
}

export function environmentPage(page: EnvironmentPage, locale: Locale = "en", ok?: string | null, code?: string | null): string {
  const flash =
    ok === "saved"
      ? `<p class="banner ok" data-env-flash>${esc(t(locale, "Saved."))}</p>`
      : ok === "refused"
        ? `<p class="banner warn" data-env-refused>${esc(t(locale, "Re-read refused: HTTP {n}").replace("{n}", code || "0"))}</p>`
        : "";
  const pull = page.pull
    ? `<p data-env-pull>${esc(t(locale, "Last pull"))}: ${esc(page.pull.pulled_at)} · ${esc(String(page.pull.sample_count))}${page.pull.error ? ` · ${esc(page.pull.error)}` : ""}</p>`
    : `<p class="muted" data-env-pull>${esc(t(locale, "No pull yet."))}</p>`;
  const sensors = page.sensors
    .map((row) => {
      const spaces = [`<option value="">${esc(t(locale, "Unbound"))}</option>`, ...page.spaces.map((name) => option(name, name, row.space_name))].join("");
      const roles = [`<option value="">${esc(t(locale, "Unbound"))}</option>`, ...ENV_ROLES.map((role) => option(role, t(locale, roleWord(role)), row.role))].join("");
      return `<tr data-env-sensor="${esc(row.sensor_id)}">
        <td>${esc(row.name || row.sensor_id)}</td>
        <td class="mono">${esc(row.sensor_id)}</td>
        <td>${esc(row.battery == null ? "" : readingNumber(row.battery))}</td>
        <td>${esc(row.newest)}</td>
        <td>
          <form method="post" action="${ENVIRONMENT_PATH}/bind" class="stack">
            <input type="hidden" name="sensor_id" value="${esc(row.sensor_id)}">
            <select name="space_name">${spaces}</select>
            <select name="role">${roles}</select>
            <input type="text" name="reason" required placeholder="${esc(t(locale, "Reason"))}">
            <button type="submit">${esc(t(locale, "Save"))}</button>
          </form>
        </td>
      </tr>`;
    })
    .join("");
  const rangeRows = page.ranges
    .map(
      (row) => `<tr data-env-range="${esc(row.space_name)}" data-env-role="${esc(row.role)}">
        <td>${esc(row.space_name)}</td>
        <td>${esc(t(locale, roleWord(row.role)))}</td>
        <td>${esc(row.temp_low ?? "")}</td>
        <td>${esc(row.temp_high ?? "")}</td>
        <td>${esc(row.humidity_low ?? "")}</td>
        <td>${esc(row.humidity_high ?? "")}</td>
      </tr>`
    )
    .join("");
  const spaceOptions = page.spaces.map((name) => option(name, name, "")).join("");
  const roleOptions = ENV_ROLES.map((role) => option(role, t(locale, roleWord(role)), "room")).join("");
  const doorRooms = (page.doorRooms ?? [])
    .map((row) => {
      const cond = sensorConditionsText(row, page.asOf, locale);
      return `<p data-env-room="${esc(row.room)}" title="${esc(sensorReadingTitle(row))}">${esc(row.room)}: ${esc(cond.text)}</p>`;
    })
    .join("");
  return `<h1>${esc(t(locale, "Environment"))}</h1>
    ${flash}
    <p class="muted" data-env-silo-ops>${esc(t(locale, "Silo Ops posts its Storage readings for CSA and CSB here with source \"silo-ops\", at most once a minute per room, read_at the unit's own sample time in UTC."))}</p>
    ${doorRooms}
    ${pull}
    <form method="post" action="${ENVIRONMENT_PATH}/stale" class="stack">
      <label class="field">${esc(t(locale, "Stale after minutes"))}
        <input type="number" name="minutes" min="1" value="${esc(String(page.staleMinutes))}" required>
      </label>
      <label class="field">${esc(t(locale, "Reason"))} <input type="text" name="reason" required></label>
      <button type="submit">${esc(t(locale, "Save"))}</button>
    </form>
    <form method="post" action="${ENVIRONMENT_PATH}/refresh"><button type="submit">${esc(t(locale, "Re-read sensors"))}</button></form>
    <h2>${esc(t(locale, "Sensors"))}</h2>
    <table class="data" data-env-sensors><thead><tr>
      <th>${esc(t(locale, "Name"))}</th><th>${esc(t(locale, "Sensor"))}</th><th>${esc(t(locale, "Battery"))}</th>
      <th>${esc(t(locale, "Newest reading"))}</th><th>${esc(t(locale, "Space"))}</th>
    </tr></thead><tbody>${sensors}</tbody></table>
    <h2>${esc(t(locale, "Ranges"))}</h2>
    <table class="data"><thead><tr>
      <th>${esc(t(locale, "Space"))}</th><th>${esc(t(locale, "Role"))}</th>
      <th>${esc(t(locale, "Temperature low"))}</th><th>${esc(t(locale, "Temperature high"))}</th>
      <th>${esc(t(locale, "Humidity low"))}</th><th>${esc(t(locale, "Humidity high"))}</th>
    </tr></thead><tbody>${rangeRows}</tbody></table>
    <form method="post" action="${ENVIRONMENT_PATH}/range" class="stack" data-env-range-form>
      <label class="field">${esc(t(locale, "Space"))} <select name="space_name" required>${spaceOptions}</select></label>
      <label class="field">${esc(t(locale, "Role"))} <select name="role" required>${roleOptions}</select></label>
      <label class="field">${esc(t(locale, "Temperature low"))} <input type="text" name="temp_low"></label>
      <label class="field">${esc(t(locale, "Temperature high"))} <input type="text" name="temp_high"></label>
      <label class="field">${esc(t(locale, "Humidity low"))} <input type="text" name="humidity_low"></label>
      <label class="field">${esc(t(locale, "Humidity high"))} <input type="text" name="humidity_high"></label>
      <label class="field">${esc(t(locale, "Reason"))} <input type="text" name="reason" required></label>
      <button type="submit">${esc(t(locale, "Save"))}</button>
    </form>`;
}

function personId(form: FormData): string | null {
  return textOrNull(form.get("person_id"));
}

export async function saveSensorBinding(db: D1Database, form: FormData): Promise<void> {
  const actor = await requireActor(db, personId(form));
  const reason = requireReason(textOrNull(form.get("reason")));
  const sensorId = textOrNull(form.get("sensor_id"));
  if (!sensorId) throw new HttpError(400, "Pick a sensor.");
  const space = textOrNull(form.get("space_name"));
  const roleRaw = textOrNull(form.get("role"));
  const role = roleRaw && (ENV_ROLES as readonly string[]).includes(roleRaw) ? (roleRaw as EnvRole) : null;
  if (space && !role) throw new HttpError(400, "Pick a role.");
  if (!space && role) throw new HttpError(400, "Pick a space.");
  const ts = nowIso();
  const existing = await db
    .prepare(`SELECT id, space_name, role FROM sensor_bindings WHERE sensor_id = ? AND deleted_at IS NULL`)
    .bind(sensorId)
    .first<{ id: string; space_name: string | null; role: string | null }>();
  const id = existing?.id ?? crypto.randomUUID();
  const boundAt = space ? ts : null;
  const stmts = [
    existing
      ? db
          .prepare(`UPDATE sensor_bindings SET space_name = ?, role = ?, bound_at = ?, updated_at = ?, updated_by = ? WHERE id = ?`)
          .bind(space, role, boundAt, ts, actor.id, id)
      : db
          .prepare(
            `INSERT INTO sensor_bindings (id, sensor_id, space_name, role, bound_at, created_at, created_by, updated_at, updated_by, deleted_at, deleted_by)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL)`
          )
          .bind(id, sensorId, space, role, boundAt, ts, actor.id, ts, actor.id),
    insertLog(db, {
      record_table: "sensor_bindings",
      record_id: id,
      field: "space_name",
      old_value: existing?.space_name ?? null,
      new_value: space,
      actor_person_id: actor.id,
      reason,
      changed_at: ts,
    }),
    insertLog(db, {
      record_table: "sensor_bindings",
      record_id: id,
      field: "role",
      old_value: existing?.role ?? null,
      new_value: role,
      actor_person_id: actor.id,
      reason,
      changed_at: ts,
    }),
  ];
  await db.batch(stmts);
}

function boundNumber(raw: unknown, label: string): number | null {
  const text = textOrNull(raw);
  if (text == null) return null;
  const n = Number(text);
  if (!Number.isFinite(n)) throw new HttpError(400, `${label} must be a number.`);
  return n;
}

export async function saveEnvironmentRange(db: D1Database, form: FormData): Promise<void> {
  const actor = await requireActor(db, personId(form));
  const reason = requireReason(textOrNull(form.get("reason")));
  const space = textOrNull(form.get("space_name"));
  const role = textOrNull(form.get("role"));
  if (!space) throw new HttpError(400, "Pick a space.");
  if (!role || !(ENV_ROLES as readonly string[]).includes(role)) throw new HttpError(400, "Pick a role.");
  const tempLow = boundNumber(form.get("temp_low"), "Temperature low");
  const tempHigh = boundNumber(form.get("temp_high"), "Temperature high");
  const humidityLow = boundNumber(form.get("humidity_low"), "Humidity low");
  const humidityHigh = boundNumber(form.get("humidity_high"), "Humidity high");
  const ts = nowIso();
  const existing = await db
    .prepare(
      `SELECT id, temp_low, temp_high, humidity_low, humidity_high FROM environment_ranges
       WHERE space_name = ? AND role = ? AND deleted_at IS NULL`
    )
    .bind(space, role)
    .first<{ id: string; temp_low: number | null; temp_high: number | null; humidity_low: number | null; humidity_high: number | null }>();
  const id = existing?.id ?? crypto.randomUUID();
  const next = { temp_low: tempLow, temp_high: tempHigh, humidity_low: humidityLow, humidity_high: humidityHigh };
  const textOf = (value: number | null | undefined) => (value == null ? null : String(value));
  const fields = ["temp_low", "temp_high", "humidity_low", "humidity_high"] as const;
  await db.batch([
    existing
      ? db
          .prepare(
            `UPDATE environment_ranges SET temp_low = ?, temp_high = ?, humidity_low = ?, humidity_high = ?, updated_at = ?, updated_by = ? WHERE id = ?`
          )
          .bind(tempLow, tempHigh, humidityLow, humidityHigh, ts, actor.id, id)
      : db
          .prepare(
            `INSERT INTO environment_ranges (
               id, space_name, role, temp_low, temp_high, humidity_low, humidity_high,
               created_at, created_by, updated_at, updated_by, deleted_at, deleted_by
             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL)`
          )
          .bind(id, space, role, tempLow, tempHigh, humidityLow, humidityHigh, ts, actor.id, ts, actor.id),
    ...fields.map((field) =>
      insertLog(db, {
        record_table: "environment_ranges",
        record_id: id,
        field,
        old_value: textOf(existing?.[field]),
        new_value: textOf(next[field]),
        actor_person_id: actor.id,
        reason,
        changed_at: ts,
      })
    ),
  ]);
}

export async function saveStaleMinutes(db: D1Database, form: FormData): Promise<void> {
  const actor = await requireActor(db, personId(form));
  const reason = requireReason(textOrNull(form.get("reason")));
  const minutes = Number(textOrNull(form.get("minutes")));
  if (!Number.isInteger(minutes) || minutes < 1) throw new HttpError(400, "Stale after minutes must be a whole number of one or more.");
  const ts = nowIso();
  const old = await getConfigValue(db, CONFIG_KEYS.environment_stale_minutes);
  await db.batch([
    db.prepare(`UPDATE app_config SET value = ?, updated_at = ?, updated_by = ? WHERE key = ? AND deleted_at IS NULL`).bind(String(minutes), ts, actor.id, CONFIG_KEYS.environment_stale_minutes),
    insertLog(db, {
      record_table: "app_config",
      record_id: CONFIG_KEYS.environment_stale_minutes,
      field: "value",
      old_value: old,
      new_value: String(minutes),
      actor_person_id: actor.id,
      reason,
      changed_at: ts,
    }),
  ]);
}
