/**
 * THE ENVIRONMENT FLAGS (canon 0.30.246). SensorPush Gateway Cloud, pulled on
 * the five-minute cron. The access token stays in sensorpush_auth. A refusal
 * records one line and waits for the next cron.
 */

import { nowIso } from "./audit";

export const SENSORPUSH_PUBLIC_BASE = "https://api.sensorpush.com/api/v1";
const DAY_MS = 24 * 60 * 60 * 1000;
const HALF_DAY_MS = 12 * 60 * 60 * 1000;
const RENEW_EARLY_MS = 30 * 60 * 1000;

declare global {
  interface Env {
    SENSORPUSH_EMAIL?: string;
    SENSORPUSH_PASSWORD?: string;
    SENSORPUSH_API_BASE?: string;
  }
}

export type SensorPushEnv = {
  DB: D1Database;
  SENSORPUSH_EMAIL?: string;
  SENSORPUSH_PASSWORD?: string;
  SENSORPUSH_API_BASE?: string;
};

type FetchLike = typeof fetch;

export function sensorPushConfigured(env: SensorPushEnv): boolean {
  return (env.SENSORPUSH_EMAIL ?? "").trim() !== "" && (env.SENSORPUSH_PASSWORD ?? "").trim() !== "";
}

function baseOf(env: SensorPushEnv): string {
  const raw = (env.SENSORPUSH_API_BASE ?? "").trim() || SENSORPUSH_PUBLIC_BASE;
  return raw.replace(/\/$/, "");
}

async function postJson(fetchImpl: FetchLike, url: string, body: unknown, token?: string): Promise<{ status: number; json: unknown }> {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (token) headers.authorization = token;
  const res = await fetchImpl(url, { method: "POST", headers, body: JSON.stringify(body) });
  let json: unknown = null;
  try {
    json = await res.json();
  } catch {
    json = null;
  }
  return { status: res.status, json };
}

type TokenRow = {
  authorization: string | null;
  authorization_until: string | null;
  access_token: string | null;
  access_until: string | null;
};

async function saveToken(db: D1Database, row: TokenRow, ts: string): Promise<void> {
  await db
    .prepare(
      `INSERT INTO sensorpush_auth (id, authorization, authorization_until, access_token, access_until, updated_at)
       VALUES ('current', ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         authorization = excluded.authorization,
         authorization_until = excluded.authorization_until,
         access_token = excluded.access_token,
         access_until = excluded.access_until,
         updated_at = excluded.updated_at`
    )
    .bind(row.authorization, row.authorization_until, row.access_token, row.access_until, ts)
    .run();
}

async function recordPull(db: D1Database, count: number, error: string | null, ts: string): Promise<void> {
  await db
    .prepare(`INSERT INTO environment_pulls (id, pulled_at, sample_count, error) VALUES (?, ?, ?, ?)`)
    .bind(crypto.randomUUID(), ts, count, error)
    .run();
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

export type SensorPushSensor = { id: string; name: string; battery: number | null };

export function parseSensorList(json: unknown): SensorPushSensor[] {
  const list = Array.isArray(json) ? json : asRecord(json)?.sensors;
  if (!Array.isArray(list)) return [];
  const out: SensorPushSensor[] = [];
  for (const item of list) {
    const row = asRecord(item);
    const id = String(row?.id ?? "").trim();
    if (!id) continue;
    const battery = Number(row?.battery_voltage);
    out.push({ id, name: String(row?.name ?? "").trim(), battery: Number.isFinite(battery) ? battery : null });
  }
  return out;
}

export type SensorSample = { observed: string; temperature: number; humidity: number | null };

export function newestSamples(json: unknown): Map<string, SensorSample> {
  const sensors = asRecord(asRecord(json)?.sensors);
  const out = new Map<string, SensorSample>();
  if (!sensors) return out;
  for (const [id, rows] of Object.entries(sensors)) {
    if (!Array.isArray(rows)) continue;
    let best: SensorSample | null = null;
    for (const item of rows) {
      const row = asRecord(item);
      const observed = String(row?.observed ?? "").trim();
      const temperature = Number(row?.temperature);
      if (!observed || !Number.isFinite(Date.parse(observed)) || !Number.isFinite(temperature)) continue;
      const humidity = Number(row?.humidity);
      const sample = { observed: new Date(Date.parse(observed)).toISOString(), temperature, humidity: Number.isFinite(humidity) ? humidity : null };
      if (!best || sample.observed > best.observed) best = sample;
    }
    if (best) out.set(id, best);
  }
  return out;
}

async function accessToken(env: SensorPushEnv, fetchImpl: FetchLike, ts: string): Promise<string> {
  const current = await env.DB
    .prepare(`SELECT authorization, authorization_until, access_token, access_until FROM sensorpush_auth WHERE id = 'current'`)
    .first<TokenRow>();
  const now = Date.parse(ts);
  let authorization = current?.authorization ?? "";
  let authorizationUntil = current?.authorization_until ?? "";
  if (!authorization || !authorizationUntil || Date.parse(authorizationUntil) <= now) {
    const auth = await postJson(fetchImpl, `${baseOf(env)}/oauth/authorize`, {
      email: (env.SENSORPUSH_EMAIL ?? "").trim(),
      password: (env.SENSORPUSH_PASSWORD ?? "").trim(),
    });
    if (auth.status === 429 || auth.status === 401 || auth.status >= 400) throw new Error(`HTTP ${auth.status}`);
    authorization = String(asRecord(auth.json)?.authorization ?? "").trim();
    if (!authorization) throw new Error("HTTP 401");
    authorizationUntil = new Date(now + DAY_MS).toISOString();
  }
  let token = current?.access_token ?? "";
  let accessUntil = current?.access_until ?? "";
  if (!token || !accessUntil || Date.parse(accessUntil) - RENEW_EARLY_MS <= now) {
    const access = await postJson(fetchImpl, `${baseOf(env)}/oauth/accesstoken`, { authorization });
    if (access.status === 429 || access.status === 401 || access.status >= 400) throw new Error(`HTTP ${access.status}`);
    token = String(asRecord(access.json)?.accesstoken ?? "").trim();
    if (!token) throw new Error("HTTP 401");
    accessUntil = new Date(now + HALF_DAY_MS).toISOString();
  }
  await saveToken(env.DB, { authorization, authorization_until: authorizationUntil, access_token: token, access_until: accessUntil }, ts);
  return token;
}

export async function refreshSensorCatalog(env: SensorPushEnv, fetchImpl: FetchLike = fetch): Promise<{ error: string | null }> {
  if (!sensorPushConfigured(env)) return { error: null };
  const ts = nowIso();
  try {
    const token = await accessToken(env, fetchImpl, ts);
    const listed = await postJson(fetchImpl, `${baseOf(env)}/devices/sensors`, {}, token);
    if (listed.status === 429 || listed.status === 401 || listed.status >= 400) throw new Error(`HTTP ${listed.status}`);
    const sensors = parseSensorList(listed.json);
    for (const sensor of sensors) {
      await env.DB
        .prepare(
          `INSERT INTO sensor_catalog (sensor_id, name, battery_voltage, seen_at) VALUES (?, ?, ?, ?)
           ON CONFLICT(sensor_id) DO UPDATE SET name = excluded.name, battery_voltage = excluded.battery_voltage, seen_at = excluded.seen_at`
        )
        .bind(sensor.id, sensor.name, sensor.battery, ts)
        .run();
    }
    return { error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : "HTTP 0";
    const safe = message.startsWith("HTTP ") ? message : "HTTP 0";
    return { error: safe };
  }
}

export async function pullSensorPush(env: SensorPushEnv, fetchImpl: FetchLike = fetch): Promise<{ skipped: boolean; count: number; error: string | null }> {
  if (!sensorPushConfigured(env)) return { skipped: true, count: 0, error: null };
  const ts = nowIso();
  try {
    const token = await accessToken(env, fetchImpl, ts);
    const bound = await env.DB
      .prepare(
        `SELECT sensor_id, space_name, role, bound_at FROM sensor_bindings
         WHERE deleted_at IS NULL AND space_name IS NOT NULL AND trim(space_name) <> '' AND role IS NOT NULL`
      )
      .all<{ sensor_id: string; space_name: string; role: string; bound_at: string | null }>();
    const rows = bound.results ?? [];
    if (rows.length === 0) {
      await recordPull(env.DB, 0, null, ts);
      return { skipped: false, count: 0, error: null };
    }
    let start = "2020-01-01T00:00:00.000Z";
    for (const row of rows) {
      const newest = await env.DB
        .prepare(`SELECT MAX(read_at) AS read_at FROM sensor_readings WHERE sensor_id = ?`)
        .bind(row.sensor_id)
        .first<{ read_at: string | null }>();
      if (newest?.read_at && newest.read_at > start) start = newest.read_at;
    }
    const samples = await postJson(
      fetchImpl,
      `${baseOf(env)}/samples`,
      { limit: 20, sensors: rows.map((row) => row.sensor_id), startTime: start, measures: ["temperature", "humidity"] },
      token
    );
    if (samples.status === 429 || samples.status === 401 || samples.status >= 400) throw new Error(`HTTP ${samples.status}`);
    const newest = newestSamples(samples.json);
    let count = 0;
    for (const row of rows) {
      const sample = newest.get(row.sensor_id);
      if (!sample) continue;
      const held = await env.DB
        .prepare(`SELECT 1 AS n FROM sensor_readings WHERE sensor_id = ? AND read_at = ?`)
        .bind(row.sensor_id, sample.observed)
        .first<{ n: number }>();
      if (held) continue;
      await env.DB
        .prepare(
          `INSERT INTO sensor_readings (id, room, temperature_f, humidity_pct, source, read_at, received_at, raw, sensor_id, role)
           VALUES (?, ?, ?, ?, 'sensorpush', ?, ?, NULL, ?, ?)`
        )
        .bind(crypto.randomUUID(), row.space_name, sample.temperature, sample.humidity, sample.observed, ts, row.sensor_id, row.role)
        .run();
      count += 1;
    }
    await recordPull(env.DB, count, null, ts);
    return { skipped: false, count, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : "HTTP 0";
    const safe = message.startsWith("HTTP ") ? message : "HTTP 0";
    await recordPull(env.DB, 0, safe, ts);
    return { skipped: false, count: 0, error: safe };
  }
}
