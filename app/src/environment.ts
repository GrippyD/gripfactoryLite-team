/**
 * THE ENVIRONMENT FLAGS (canon 0.30.246). A bound sensor is out when its newest
 * reading breaks a set bound, stale when that reading is older than the window
 * or none has arrived since it was bound, and in otherwise. A door reading with
 * a temperature and no humidity is a room reading for that space.
 */

import { HttpError, nowIso, requireReason, textOrNull } from "./audit";
import { CONFIG_KEYS, ENVIRONMENT_PATH, ENV_ROLES, type EnvRole } from "./config";
import { getConfigValue, insertLog, requireActor } from "./db";
import { t, type Locale } from "./i18n";
import { esc } from "./ui";

const MINUTE_MS = 60_000;

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
type ReadRow = { sensor_id: string | null; room: string; role: string | null; temperature_f: number; humidity_pct: number | null; read_at: string };

export async function staleMinutes(db: D1Database): Promise<number> {
  const raw = await getConfigValue(db, CONFIG_KEYS.environment_stale_minutes);
  const n = Number(String(raw ?? "").trim());
  return Number.isFinite(n) && n > 0 ? n : 60;
}

export async function listEnvironmentFlags(db: D1Database, now: string, locale: Locale = "en"): Promise<Record<string, string[]>> {
  const [bindings, ranges, sensorReads, doorReads, minutes] = await Promise.all([
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
    db
      .prepare(
        `SELECT r.sensor_id, r.room, r.role, r.temperature_f, r.humidity_pct, r.read_at
         FROM sensor_readings r
         WHERE r.sensor_id IS NOT NULL
           AND r.read_at = (SELECT MAX(r2.read_at) FROM sensor_readings r2 WHERE r2.sensor_id = r.sensor_id)`
      )
      .all<ReadRow>(),
    db
      .prepare(
        `SELECT r.sensor_id, r.room, r.role, r.temperature_f, r.humidity_pct, r.read_at
         FROM sensor_readings r
         WHERE r.sensor_id IS NULL
           AND r.read_at = (
             SELECT MAX(r2.read_at) FROM sensor_readings r2 WHERE r2.sensor_id IS NULL AND r2.room = r.room
           )`
      )
      .all<ReadRow>(),
    staleMinutes(db),
  ]);
  const rangeOf = new Map((ranges.results ?? []).map((row) => [`${row.space_name}\n${row.role}`, row]));
  const bySensor = new Map((sensorReads.results ?? []).map((row) => [String(row.sensor_id), row]));
  const doorOf = new Map((doorReads.results ?? []).map((row) => [row.room.trim().toUpperCase(), row]));
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
        if (sensor && sensor.read_at >= read.read_at) continue;
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
        { temperatureF: Number(read.temperature_f), humidityPct: read.humidity_pct == null ? null : Number(read.humidity_pct), readAt: read.read_at },
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
};

export async function loadEnvironmentPage(db: D1Database): Promise<EnvironmentPage> {
  const [catalog, bindings, ranges, spaces, rooms, pull, minutes] = await Promise.all([
    db.prepare(`SELECT sensor_id, name, battery_voltage FROM sensor_catalog ORDER BY name, sensor_id`).all<{ sensor_id: string; name: string | null; battery_voltage: number | null }>(),
    db.prepare(`SELECT sensor_id, space_name, role FROM sensor_bindings WHERE deleted_at IS NULL`).all<{ sensor_id: string; space_name: string | null; role: string | null }>(),
    db.prepare(`SELECT space_name, role, temp_low, temp_high, humidity_low, humidity_high FROM environment_ranges WHERE deleted_at IS NULL ORDER BY space_name, role`).all<RangeRow>(),
    db.prepare(`SELECT name FROM dry_spaces WHERE deleted_at IS NULL ORDER BY name`).all<{ name: string }>(),
    db.prepare(`SELECT value FROM app_config WHERE key = ? AND deleted_at IS NULL`).bind(CONFIG_KEYS.cure_rooms).first<{ value: string }>(),
    db.prepare(`SELECT pulled_at, sample_count, error FROM environment_pulls ORDER BY pulled_at DESC LIMIT 1`).first<{ pulled_at: string; sample_count: number; error: string | null }>(),
    staleMinutes(db),
  ]);
  const bound = new Map((bindings.results ?? []).map((row) => [row.sensor_id, row]));
  const reads = await db
    .prepare(
      `SELECT sensor_id, temperature_f, humidity_pct, read_at FROM sensor_readings
       WHERE sensor_id IS NOT NULL
         AND read_at = (SELECT MAX(r2.read_at) FROM sensor_readings r2 WHERE r2.sensor_id = sensor_readings.sensor_id)`
    )
    .all<{ sensor_id: string; temperature_f: number; humidity_pct: number | null; read_at: string }>();
  const newest = new Map((reads.results ?? []).map((row) => [row.sensor_id, row]));
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
  return `<h1>${esc(t(locale, "Environment"))}</h1>
    ${flash}
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
