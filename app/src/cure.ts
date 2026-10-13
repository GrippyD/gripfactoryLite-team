/**
 * THE CURE PANES (canon 0.30.164). Owner, 2026-09-21: CSA and CSB on the
 * drying screens and the dashboard, next to FFZ inventory. CSA holds a lot
 * that has left the dryer until it is scheduled for trim. CSB holds that lot
 * while its newest live trim row is still scheduled. CSB ENDS AT THE TRIM
 * FINISH (canon 0.30.303): the lot leaves CSB the moment that row completes
 * and sits on neither pane after. A trimmed lot is off both. A container
 * taken into a cryo run no longer moves it.
 * Current conditions come through a push door we own (POST /sensors/readings).
 */

import { HttpError } from "./audit";
import { CONFIG_KEYS, CSA_LOT_CAP_DEFAULT, CSB_LOT_CAP_DEFAULT, formatGrams, parseLotCap, SCHEDULE_STATUS, shortLotId } from "./config";
import { formatLbs } from "./compliance";
import { t, tFill, type Locale } from "./i18n";
import { listEnvironmentFlags, readDoorAverage, sensorConditionsText, sensorReadingTitle } from "./environment";
export { isTestSensorSource } from "./environment";
import { esc } from "./ui";

export const CURE_ROOMS_DEFAULT = ["CSA", "CSB"] as const;
export const SENSOR_PATH = "/sensors/readings";
const TEMP_MIN = -40;
const TEMP_MAX = 200;

export type CurePaneName = "CSA" | "CSB";

export type CureMoisture = {
  kind: "moisture" | "water_activity";
  text: string;
  testedAt: string;
};

export type CureLot = {
  id: string;
  shortId: string;
  dryGrams: number;
  liveGrams: number | null;
  inTime: string | null;
  moistureAt: CureMoisture | null;
  moistureLatest: CureMoisture | null;
};

export type CureReading = {
  temperatureF: number;
  humidityPct: number | null;
  readAt: string;
  source?: string;
  units?: number;
};

export type CurePanesData = {
  csa: CureLot[];
  csb: CureLot[];
  readings: { CSA: CureReading | null; CSB: CureReading | null };
  nowIso: string;
  flags?: Record<string, string[]>;
  caps: { CSA: number; CSB: number };
};

type LotSql = {
  id: string;
  status: string;
  dry_weight_grams: number | null;
  hbn: string | null;
  metrc_harvest_tag: string | null;
  unload_finished_at: string | null;
  unloaded_logged_at: string | null;
  trim_scheduled_at: string | null;
  trim_status: string | null;
  live_grams: number | null;
};

type TestSql = {
  hbn: string | null;
  package_tag: string | null;
  analyte: string;
  value: number;
  tested_at: string;
};

/** Which pane a lot belongs on. CSB is the trim queue: status unloaded, and the
 * newest live trim row still scheduled. A complete row, a trimmed lot, a frozen
 * lot, and a voided lot sit on neither. A deleted trim row (no live row) is CSA. */
export function cureMembership(input: {
  status: string;
  deleted: boolean;
  trimStatus: string | null;
}): CurePaneName | null {
  if (input.deleted || input.status === "frozen") return null;
  if (input.status !== "unloaded") return null;
  const trim = (input.trimStatus ?? "").trim();
  if (trim === SCHEDULE_STATUS.scheduled) return "CSB";
  if (!trim) return "CSA";
  return null;
}

/** CSA's in-time is the unload finish, else the change-log row that set unloaded. */
export function csaInTime(unloadFinishedAt: string | null, unloadedLoggedAt: string | null): string | null {
  const finish = (unloadFinishedAt ?? "").trim();
  if (finish) return finish;
  const logged = (unloadedLoggedAt ?? "").trim();
  return logged || null;
}

type ReadingPick = { analyte: string; value: number; tested_at: string };

/** Newest moisture reading, else newest water activity, from the rows offered. */
export function pickMoisture(rows: readonly ReadingPick[]): CureMoisture | null {
  const usable = rows.filter((r) => r.tested_at && Number.isFinite(Number(r.value)));
  const moisture = usable.filter((r) => r.analyte.toLowerCase() === "moisture");
  const water = usable.filter((r) => r.analyte.toLowerCase() === "water_activity");
  const pool = moisture.length > 0 ? moisture : water;
  if (pool.length === 0) return null;
  const newest = [...pool].sort((a, b) => (a.tested_at < b.tested_at ? 1 : a.tested_at > b.tested_at ? -1 : 0))[0];
  const kind = newest.analyte.toLowerCase() === "moisture" ? "moisture" : "water_activity";
  return { kind, text: moistureText(kind, Number(newest.value)), testedAt: newest.tested_at };
}

export function moistureText(kind: "moisture" | "water_activity", value: number): string {
  if (kind === "water_activity") return `${value.toFixed(2)} aw`;
  const shown = Number.isInteger(value) ? String(value) : String(Math.round(value * 10) / 10);
  return `${shown} %`;
}

export function parseCureRooms(raw: string | null | undefined): string[] {
  const rooms = String(raw ?? "")
    .split(",")
    .map((part) => part.trim().toUpperCase())
    .filter((part) => part.length > 0);
  return rooms.length > 0 ? [...new Set(rooms)] : [...CURE_ROOMS_DEFAULT];
}

export function conditionsLine(reading: CureReading | null, nowIso: string, locale: Locale): { text: string; stale: boolean } {
  if (!reading) return { text: t(locale, "no sensor yet"), stale: false };
  return sensorConditionsText(reading, nowIso, locale);
}

/** Hover words: the reading's Eastern wall clock and its stored source. */
export function readingTitle(reading: CureReading): string {
  return sensorReadingTitle(reading);
}

export function formatCureClock(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(s / 86400);
  const r = s % 86400;
  const hh = String(Math.floor(r / 3600)).padStart(2, "0");
  const mm = String(Math.floor((r % 3600) / 60)).padStart(2, "0");
  const ss = String(r % 60).padStart(2, "0");
  return `${d}d ${hh}:${mm}:${ss}`;
}

const LOTS_SQL = `SELECT w.id, w.status, w.dry_weight_grams, b.hbn, b.metrc_harvest_tag,
            (SELECT s.finished_at FROM unload_sessions s
              WHERE s.wet_weight_entry_id = w.id AND s.deleted_at IS NULL AND s.finished_at IS NOT NULL
              ORDER BY s.finished_at DESC LIMIT 1) AS unload_finished_at,
            (SELECT l.changed_at FROM record_change_log l
              WHERE l.record_table = 'wet_weight_entries' AND l.record_id = w.id
                AND l.field = 'status' AND l.new_value = 'unloaded'
              ORDER BY l.changed_at DESC LIMIT 1) AS unloaded_logged_at,
            (SELECT ps.scheduled_at FROM production_schedules ps
              WHERE ps.wet_weight_entry_id = w.id AND ps.stage = 'trim' AND ps.deleted_at IS NULL
              ORDER BY ps.scheduled_at DESC, ps.id DESC LIMIT 1) AS trim_scheduled_at,
            (SELECT ps.status FROM production_schedules ps
              WHERE ps.wet_weight_entry_id = w.id AND ps.stage = 'trim' AND ps.deleted_at IS NULL
              ORDER BY ps.scheduled_at DESC, ps.id DESC LIMIT 1) AS trim_status,
            (SELECT li.qty FROM local_inventory_items li
              WHERE li.wet_weight_entry_id = w.id AND li.deleted_at IS NULL
              ORDER BY li.created_at ASC LIMIT 1) AS live_grams
     FROM wet_weight_entries w
     JOIN harvest_batches b ON b.id = w.harvest_batch_id AND b.deleted_at IS NULL
     WHERE w.deleted_at IS NULL AND w.status IN ('unloaded', 'trimmed')`;

/** THE CAP LIVES ON THE SPACE (canon 0.30.383): the pane reads the cure space's capacity (uom ea). */
export async function cureSpaceCap(db: D1Database, room: "CSA" | "CSB"): Promise<{ value: number; stored: boolean }> {
  const fallback = room === "CSA" ? CSA_LOT_CAP_DEFAULT : CSB_LOT_CAP_DEFAULT;
  const row = await db
    .prepare(`SELECT capacity, capacity_uom FROM dry_spaces WHERE name = ? AND kind = 'cure' AND deleted_at IS NULL`)
    .bind(room)
    .first<{ capacity: number | null; capacity_uom: string | null }>();
  const uom = String(row?.capacity_uom ?? "").trim().toLowerCase();
  if (!row || uom !== "ea" || row.capacity == null || String(row.capacity).trim() === "") return { value: fallback, stored: false };
  return { value: parseLotCap(String(row.capacity), fallback), stored: true };
}

export async function listCurePanes(db: D1Database, nowIso: string, locale: Locale = "en"): Promise<CurePanesData> {
  const lots = await db.prepare(LOTS_SQL).all<LotSql>();
  const tests = await db
    .prepare(
      `SELECT hbn, package_tag, analyte, value, tested_at
       FROM internal_test_results
       WHERE deleted_at IS NULL AND lower(analyte) IN ('moisture', 'water_activity')`
    )
    .all<TestSql>();
  const flags = await listEnvironmentFlags(db, nowIso, locale);
  const readings = {
    CSA: await latestReading(db, "CSA"),
    CSB: await latestReading(db, "CSB"),
  };
  const testRows = tests.results ?? [];
  const csa: CureLot[] = [];
  const csb: CureLot[] = [];
  for (const row of lots.results ?? []) {
    const pane = cureMembership({
      status: row.status,
      deleted: false,
      trimStatus: row.trim_status,
    });
    if (!pane) continue;
    const inTime = pane === "CSA" ? csaInTime(row.unload_finished_at, row.unloaded_logged_at) : (row.trim_scheduled_at ?? "").trim() || null;
    const mine = testRows.filter((t) => matchesLot(t, row.hbn, row.metrc_harvest_tag));
    const at = inTime ? mine.filter((t) => t.tested_at <= inTime) : [];
    const lot: CureLot = {
      id: row.id,
      shortId: shortLotId(row.hbn ?? "", row.metrc_harvest_tag),
      dryGrams: Number(row.dry_weight_grams ?? 0),
      liveGrams: row.live_grams == null ? null : Number(row.live_grams),
      inTime,
      moistureAt: pickMoisture(at),
      moistureLatest: pickMoisture(mine),
    };
    (pane === "CSA" ? csa : csb).push(lot);
  }
  const byId = (a: CureLot, b: CureLot) => a.shortId.localeCompare(b.shortId) || a.id.localeCompare(b.id);
  csa.sort(byId);
  csb.sort(byId);
  const caps = {
    CSA: (await cureSpaceCap(db, "CSA")).value,
    CSB: (await cureSpaceCap(db, "CSB")).value,
  };
  return { csa, csb, readings, nowIso, flags, caps };
}

function matchesLot(row: TestSql, hbn: string | null, tag: string | null): boolean {
  const h = (hbn ?? "").trim().toLowerCase();
  const tg = (tag ?? "").trim().toLowerCase();
  if (h && (row.hbn ?? "").trim().toLowerCase() === h) return true;
  if (tg && (row.package_tag ?? "").trim().toLowerCase() === tg) return true;
  return false;
}

export async function latestReading(db: D1Database, room: string): Promise<CureReading | null> {
  const avg = await readDoorAverage(db, room);
  if (!avg) return null;
  return {
    temperatureF: avg.temperatureF,
    humidityPct: avg.humidityPct,
    readAt: avg.readAt,
    source: avg.source,
    units: avg.units,
  };
}

async function roomList(db: D1Database): Promise<string[]> {
  const row = await db
    .prepare(`SELECT value FROM app_config WHERE key = ? AND deleted_at IS NULL`)
    .bind(CONFIG_KEYS.cure_rooms)
    .first<{ value: string }>();
  const names = parseCureRooms(row?.value);
  const spaces = await db.prepare(`SELECT name FROM dry_spaces WHERE deleted_at IS NULL`).all<{ name: string }>();
  for (const space of spaces.results ?? []) {
    if (!names.some((name) => name.toUpperCase() === space.name.toUpperCase())) names.push(space.name);
  }
  return names;
}

type SensorIn = {
  room: string;
  temperature_f: number;
  humidity_pct: number | null;
  read_at: string;
  source: string;
  raw: string;
  sensor_id: string | null;
};

function oneReading(value: unknown, rooms: readonly string[], index: string): SensorIn {
  if (value == null || typeof value !== "object" || Array.isArray(value)) {
    throw new HttpError(400, `Reading ${index} must be an object.`);
  }
  const rec = value as Record<string, unknown>;
  const roomRaw = String(rec.room ?? "").trim();
  const room = rooms.find((name) => name.toUpperCase() === roomRaw.toUpperCase());
  if (!room) {
    throw new HttpError(400, `Reading ${index} names a room that is not a dry space or a cure room.`);
  }
  const temperature = Number(rec.temperature_f);
  const humidityRaw = rec.humidity_pct;
  let humidity: number | null = null;
  if (humidityRaw != null && String(humidityRaw).trim() !== "") {
    humidity = Number(humidityRaw);
    if (!Number.isFinite(humidity) || humidity < 0 || humidity > 100) {
      throw new HttpError(400, `Reading ${index} needs a humidity between 0 and 100 percent.`);
    }
  }
  if (!Number.isFinite(temperature) || temperature < TEMP_MIN || temperature > TEMP_MAX) {
    throw new HttpError(400, `Reading ${index} needs a temperature between ${TEMP_MIN} and ${TEMP_MAX} F.`);
  }
  const readAt = Date.parse(String(rec.read_at ?? ""));
  if (!Number.isFinite(readAt)) throw new HttpError(400, `Reading ${index} needs a readable read_at.`);
  const source = String(rec.source ?? "").trim();
  if (source.length > 80) throw new HttpError(400, `Reading ${index} source is too long.`);
  let sensorId: string | null = null;
  if (rec.sensor_id != null && !(typeof rec.sensor_id === "string" && rec.sensor_id.trim() === "")) {
    if (typeof rec.sensor_id !== "string") throw new HttpError(400, `Reading ${index} sensor_id must be text.`);
    const trimmed = rec.sensor_id.trim();
    if (trimmed.length > 80) throw new HttpError(400, `Reading ${index} sensor_id is too long.`);
    sensorId = trimmed;
  }
  return {
    room,
    temperature_f: temperature,
    humidity_pct: humidity,
    read_at: new Date(readAt).toISOString(),
    source: source || "manual",
    raw: JSON.stringify(rec),
    sensor_id: sensorId,
  };
}

function pairKey(parts: readonly string[]): string {
  return parts.join("\n");
}

/** D1 binds at most 100 parameters to one statement, so the held-key look-up runs in chunks. */
const D1_MAX_BINDS = 100;

async function heldKeys(db: D1Database, sql: string, columns: readonly string[], pairs: readonly (readonly string[])[]): Promise<Set<string>> {
  const held = new Set<string>();
  if (pairs.length === 0) return held;
  const per = Math.max(1, Math.floor(D1_MAX_BINDS / columns.length));
  for (let start = 0; start < pairs.length; start += per) {
    const part = pairs.slice(start, start + per);
    const marks = part.map(() => `(${columns.map(() => "?").join(", ")})`).join(", ");
    const found = await db
      .prepare(sql.replace("/*pairs*/", marks))
      .bind(...part.flat())
      .all<Record<string, unknown>>();
    for (const row of found.results ?? []) held.add(pairKey(columns.map((column) => String(row[column] ?? ""))));
  }
  return held;
}

/** Store one reading or an array of up to 100. Refuses the whole post in words when any row is bad,
 * and writes nothing until every row has been checked. A sensor_id is kept. A row already held
 * (same sensor id and read_at, or, with no sensor id, the same room, read_at and source) is skipped.
 * Silo Ops posts its Storage readings for CSA and CSB here with source "silo-ops", read_at the unit's own sample time in UTC. */
export async function storeSensorReadings(db: D1Database, body: unknown, nowIso: string): Promise<{ stored: number; skipped: number }> {
  if (body == null || (typeof body !== "object")) throw new HttpError(400, "The body must be a reading or a list of readings.");
  const list = Array.isArray(body) ? body : [body];
  if (list.length === 0) throw new HttpError(400, "No readings to store.");
  if (list.length > 100) throw new HttpError(400, "At most 100 readings at a time.");
  const rooms = await roomList(db);
  const rows = list.map((row, i) => oneReading(row, rooms, String(i + 1)));
  const sensorPairs: string[][] = [];
  const doorPairs: string[][] = [];
  const seenPair = new Set<string>();
  for (const row of rows) {
    if (row.sensor_id) {
      const key = pairKey([row.sensor_id, row.read_at]);
      if (seenPair.has(`s:${key}`)) continue;
      seenPair.add(`s:${key}`);
      sensorPairs.push([row.sensor_id, row.read_at]);
    } else {
      const key = pairKey([row.room, row.read_at, row.source]);
      if (seenPair.has(`d:${key}`)) continue;
      seenPair.add(`d:${key}`);
      doorPairs.push([row.room, row.read_at, row.source]);
    }
  }
  const [heldSensors, heldDoors] = await Promise.all([
    heldKeys(db, `SELECT sensor_id, read_at FROM sensor_readings WHERE (sensor_id, read_at) IN (/*pairs*/)`, ["sensor_id", "read_at"], sensorPairs),
    heldKeys(
      db,
      `SELECT room, read_at, source FROM sensor_readings WHERE sensor_id IS NULL AND (room, read_at, source) IN (/*pairs*/)`,
      ["room", "read_at", "source"],
      doorPairs
    ),
  ]);
  const fresh: SensorIn[] = [];
  let skipped = 0;
  for (const row of rows) {
    if (row.sensor_id) {
      const key = pairKey([row.sensor_id, row.read_at]);
      if (heldSensors.has(key)) {
        skipped += 1;
        continue;
      }
      heldSensors.add(key);
    } else {
      const key = pairKey([row.room, row.read_at, row.source]);
      if (heldDoors.has(key)) {
        skipped += 1;
        continue;
      }
      heldDoors.add(key);
    }
    fresh.push(row);
  }
  const stmts = fresh.map((row) =>
    db
      .prepare(
        `INSERT INTO sensor_readings (id, room, temperature_f, humidity_pct, source, read_at, received_at, raw, sensor_id, role)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`
      )
      .bind(crypto.randomUUID(), row.room, row.temperature_f, row.humidity_pct, row.source, row.read_at, nowIso, row.raw, row.sensor_id)
  );
  if (stmts.length === 1) await stmts[0].run();
  else if (stmts.length > 1) await db.batch(stmts);
  return { stored: fresh.length, skipped };
}

function moistureCell(m: CureMoisture | null, locale: Locale): string {
  if (!m) return esc(t(locale, "no reading"));
  const kind = t(locale, m.kind === "moisture" ? "moisture" : "water activity");
  return `${esc(kind)} ${esc(m.text)}`;
}

/** THE ROW FOLDS ON THE LOT NUMBER (owner, 2026-09-22: "on sca and csb, make the time
 * appear after the lot number on the same line, collapsable on lot numbers"): the row is a
 * details element whose summary is the lot number with the ticking time in beside it; the
 * weight, the two moisture lines and the link to the lot record open under it. Folded by
 * default, so a pane reads one line per lot until a lot number is pressed. */
function lotRow(lot: CureLot, nowIso: string, locale: Locale): string {
  const started = lot.inTime ? Date.parse(lot.inTime) : NaN;
  const clock = Number.isFinite(started) ? formatCureClock(Date.parse(nowIso) - started) : t(locale, "no time");
  const live =
    lot.liveGrams == null ? "" : ` <span class="cure-live muted">${esc(formatGrams(lot.liveGrams))} g</span>`;
  const latestWhen = lot.moistureLatest ? ` <span class="muted">${esc(lot.moistureLatest.testedAt.replace("T", " ").slice(0, 16))}</span>` : "";
  return `<details class="cure-row" data-cure-lot="${esc(lot.id)}">
      <summary class="cure-head" data-cure-head><span class="cure-id">${esc(lot.shortId)}</span> <span class="cure-clock" data-cure-clock data-started="${esc(
        Number.isFinite(started) ? String(started) : ""
      )}">${esc(clock)}</span></summary>
      <div class="cure-body">
        <span class="cure-weight">${esc(formatLbs(lot.dryGrams))} lb${live}</span>
        <span class="cure-moisture">${esc(t(locale, "Moisture at in-time"))}: ${moistureCell(lot.moistureAt, locale)}</span>
        <span class="cure-moisture">${esc(t(locale, "Latest moisture"))}: ${moistureCell(lot.moistureLatest, locale)}${latestWhen}</span>
        <a class="cure-link" href="/record/wet_weight_entries/${esc(lot.id)}/edit">${esc(t(locale, "Lot record"))}</a>
      </div>
    </details>`;
}

/** THE PANE IS A BAR (owner, 2026-10-02: "if it's 50% full, saturate with green from the bottom to 50% of the
 * way up--in other words make the whole pane into a bar on a graph"): the shade's height is the percent full,
 * lots over the cap, from the bottom of the tile; past the cap it fills the tile. */
export function cureShadeFill(n: number, cap: number): string {
  if (n <= 0) return (0).toFixed(1);
  const pct = cap > 0 ? n / cap : 1;
  return (Math.min(pct, 1) * 100).toFixed(1);
}

function paneCard(
  name: CurePaneName,
  lots: CureLot[],
  cap: number,
  reading: CureReading | null,
  nowIso: string,
  locale: Locale,
  flags: string[],
  layout: "row" | "bar"
): string {
  const cond = conditionsLine(reading, nowIso, locale);
  const alert = flags.length > 0;
  const text = alert ? `${cond.text} · ${flags.join(" ")}` : cond.text;
  const n = lots.length;
  const pct = cap > 0 ? n / cap : 0;
  const pctShown = Math.round(pct * 100);
  const over = n > cap;
  const fill = cureShadeFill(n, cap);
  // THE FULLNESS LINE FOLDS THE LOTS (owner, 2026-10-02: "Collapse all the lots into the text containing the
  // fullness" "% full - n Lots"): one summary line; open, the lots as they were, each still folding on its number.
  // THE COUNT SITS ON THE BAR (canon 0.30.378): the details live inside the shade, the summary its first child.
  const count = tFill(locale, n === 1 ? "{pct}% full - 1 Lot" : "{pct}% full - {n} Lots", { n: String(n), pct: String(pctShown) });
  const capLine = tFill(locale, "{n} of {cap} lots, {pct}% full", { n: String(n), cap: String(cap), pct: String(pctShown) });
  const body = lots.length
    ? lots.map((lot) => lotRow(lot, nowIso, locale)).join("")
    : `<p class="muted" data-cure-empty>${esc(t(locale, "No lots."))}</p>`;
  const hover = reading ? ` title="${esc(readingTitle(reading))}"` : "";
  if (layout === "bar") {
    return `<div class="inv-gauge cure-pane" data-cure-pane="${name}"${hover}>
      <div class="inv-gauge-name">${name}</div>
      <p class="cure-conditions${cond.stale || alert ? " cure-stale" : ""}" data-cure-conditions>${esc(text)}</p>
      <div class="cure-shade" style="height:${fill}%" data-cure-shade data-cure-fill="${fill}">
      <details class="cure-lots" data-cure-lots>
        <summary class="cure-count${over ? " cure-over" : ""}" data-cure-count="${n}" data-cure-cap="${cap}" data-cure-pct="${pctShown}" title="${esc(capLine)}">${esc(count)}</summary>
        ${body}
      </details>
      </div>
    </div>`;
  }
  const dry = lots.reduce((sum, lot) => sum + Number(lot.dryGrams ?? 0), 0);
  const bodyId = `dry-body-${name}`;
  const weight = `${esc(t(locale, "Dry"))} <strong>${esc(formatLbs(dry))}</strong> lb · <strong>${esc(formatGrams(Math.round(dry)))}</strong> g`;
  const icon = `<span class="dry-tile-icon dry-icon-cure" data-dry-icon aria-hidden="true"><span class="dry-cure-icon-fill" style="height:${fill}%"></span></span>`;
  const head = `<button type="button" class="dry-tile-head" data-dry-head aria-expanded="false" aria-controls="${bodyId}">${icon}<span class="dry-tile-name">${name}</span><span class="dry-tile-status${over ? " cure-over" : ""}" data-dry-status>${esc(count)}</span><span class="dry-tile-weight" data-dry-weight>${weight}</span></button>`;
  return `<div class="inv-gauge cure-pane dry-tile" data-cure-pane="${name}"${hover} data-dry-tile>
      ${head}
      <div class="dry-tile-body" id="${bodyId}" hidden>
      <div class="inv-gauge-name">${name}</div>
      <p class="cure-conditions${cond.stale || alert ? " cure-stale" : ""}" data-cure-conditions>${esc(text)}</p>
      <div class="cure-shade" style="height:${fill}%" data-cure-shade data-cure-fill="${fill}">
      <details class="cure-lots" data-cure-lots>
        <summary class="cure-count${over ? " cure-over" : ""}" data-cure-count="${n}" data-cure-cap="${cap}" data-cure-pct="${pctShown}" title="${esc(capLine)}">${esc(count)}</summary>
        ${body}
      </details>
      </div>
      </div>
    </div>`;
}

export function cureClockScript(): string {
  return `<script>
(function () {
  function fmt(s) {
    s = Math.max(0, Math.floor(s));
    var d = Math.floor(s / 86400), r = s % 86400;
    var hh = String(Math.floor(r / 3600)).padStart(2, "0");
    var mm = String(Math.floor((r % 3600) / 60)).padStart(2, "0");
    var ss = String(r % 60).padStart(2, "0");
    return d + "d " + hh + ":" + mm + ":" + ss;
  }
  function tick() {
    var now = Date.now();
    document.querySelectorAll("[data-cure-clock]").forEach(function (el) {
      var started = Number(el.getAttribute("data-started"));
      if (!started) return;
      el.textContent = fmt((now - started) / 1000);
    });
  }
  tick();
  setInterval(tick, 1000);
  function fillVar() {
    document.querySelectorAll("[data-cure-shade]").forEach(function (s) {
      s.style.setProperty("--cure-fill", s.getAttribute("data-cure-fill") + "%");
    });
  }
  function padShade(pane) {
    var shade = pane.querySelector("[data-cure-shade]");
    var lots = pane.querySelector("[data-cure-lots]");
    if (!shade) return;
    if (lots && lots.open) {
      shade.style.paddingTop = "";
      return;
    }
    // CF1 (canon 0.30.459): the header ends where the conditions line ends, margins and the
    // tile's own padding included; a sum of heights fell short and the count rode over the line.
    var head = 0;
    var top = pane.getBoundingClientRect().top;
    pane.querySelectorAll(".inv-gauge-name, .cure-conditions").forEach(function (el) {
      if (el.closest("[data-cure-shade]")) return;
      var r = el.getBoundingClientRect();
      if (r.height === 0) return;
      var mb = parseFloat(getComputedStyle(el).marginBottom) || 0;
      head = Math.max(head, r.bottom - top + mb);
    });
    var tile = pane.clientHeight;
    var fill = Number(shade.getAttribute("data-cure-fill")) / 100;
    if (!isFinite(fill)) fill = 0;
    var gap = tile * (1 - Math.min(fill, 1));
    var pad = Math.max(0, head - gap);
    shade.style.paddingTop = pad ? pad + "px" : "";
  }
  function padAll() {
    document.querySelectorAll("[data-cure-pane]").forEach(padShade);
  }
  fillVar();
  // A pane's fold stays as this tablet left it, across a reload (localStorage per pane, gf_cure_open:).
  document.querySelectorAll("[data-cure-lots]").forEach(function (d) {
    var pane = d.closest("[data-cure-pane]");
    var key = "gf_cure_open:" + (pane ? pane.getAttribute("data-cure-pane") : "");
    try { if (localStorage.getItem(key) === "1") d.open = true; } catch (e) {}
    d.addEventListener("toggle", function () {
      try { localStorage.setItem(key, d.open ? "1" : "0"); } catch (e) {}
      var p = d.closest("[data-cure-pane]");
      if (p) padShade(p);
    });
  });
  padAll();
  // Measure again once the page has settled, and whenever a pane changes size.
  window.addEventListener("load", padAll);
  window.addEventListener("resize", padAll);
  // A folded section (the console's Drying) can open after load: measure again on any fold.
  document.addEventListener("toggle", padAll, true);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(padAll);
  if (typeof ResizeObserver === "function") {
    var ro = new ResizeObserver(function (entries) {
      entries.forEach(function (e) { padShade(e.target); });
    });
    document.querySelectorAll("[data-cure-pane]").forEach(function (pane) { ro.observe(pane); });
  }
})();
</script>`;
}

/** The two cards and the ticking script. THE PANES RIDE THE STRIP: no wrapper of
 * their own; the caller hands this string to siloStrip as extra tiles, so the
 * two cards stand with the space tiles, the width of the tiles beside them. */
export function curePanes(data: CurePanesData, locale: Locale = "en", layout: "row" | "bar" = "row"): string {
  const flags = data.flags ?? {};
  return `${paneCard("CSA", data.csa, data.caps.CSA, data.readings.CSA, data.nowIso, locale, flags.CSA ?? [], layout)}${paneCard(
    "CSB",
    data.csb,
    data.caps.CSB,
    data.readings.CSB,
    data.nowIso,
    locale,
    flags.CSB ?? [],
    layout
  )}${cureClockScript()}`;
}
