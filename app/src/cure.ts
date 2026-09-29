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
import { CONFIG_KEYS, formatGrams, SCHEDULE_STATUS, shortLotId } from "./config";
import { formatLbs } from "./compliance";
import { t, type Locale } from "./i18n";
import { listEnvironmentFlags } from "./environment";
import { esc } from "./ui";

export const CURE_ROOMS_DEFAULT = ["CSA", "CSB"] as const;
export const SENSOR_PATH = "/sensors/readings";
const HOUR_MS = 3_600_000;
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
};

export type CurePanesData = {
  csa: CureLot[];
  csb: CureLot[];
  readings: { CSA: CureReading | null; CSB: CureReading | null };
  nowIso: string;
  flags?: Record<string, string[]>;
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

function numWord(n: number): string {
  const rounded = Math.round(n * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : String(rounded);
}

export function conditionsLine(reading: CureReading | null, nowIso: string, locale: Locale): { text: string; stale: boolean } {
  if (!reading) return { text: t(locale, "no sensor yet"), stale: false };
  const age = Date.parse(nowIso) - Date.parse(reading.readAt);
  const stale = !Number.isFinite(age) || age > HOUR_MS;
  const min = Number.isFinite(age) ? Math.max(0, Math.round(age / 60_000)) : 0;
  const ago =
    min < 60
      ? t(locale, "{n} min ago").replace("{n}", String(min))
      : min < 120
        ? t(locale, "1 hour ago")
        : t(locale, "{n} hours ago").replace("{n}", String(Math.floor(min / 60)));
  const humid = reading.humidityPct == null ? "" : ` · ${numWord(reading.humidityPct)} %`;
  return { text: `${numWord(reading.temperatureF)} F${humid} · ${ago}`, stale };
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
  return { csa, csb, readings, nowIso, flags };
}

function matchesLot(row: TestSql, hbn: string | null, tag: string | null): boolean {
  const h = (hbn ?? "").trim().toLowerCase();
  const tg = (tag ?? "").trim().toLowerCase();
  if (h && (row.hbn ?? "").trim().toLowerCase() === h) return true;
  if (tg && (row.package_tag ?? "").trim().toLowerCase() === tg) return true;
  return false;
}

export async function latestReading(db: D1Database, room: string): Promise<CureReading | null> {
  const row = await db
    .prepare(
      `SELECT temperature_f, humidity_pct, read_at FROM sensor_readings
       WHERE room = ? ORDER BY read_at DESC LIMIT 1`
    )
    .bind(room)
    .first<{ temperature_f: number; humidity_pct: number | null; read_at: string }>();
  if (!row) return null;
  return {
    temperatureF: Number(row.temperature_f),
    humidityPct: row.humidity_pct == null ? null : Number(row.humidity_pct),
    readAt: row.read_at,
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

type SensorIn = { room: string; temperature_f: number; humidity_pct: number | null; read_at: string; source: string; raw: string };

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
  return {
    room,
    temperature_f: temperature,
    humidity_pct: humidity,
    read_at: new Date(readAt).toISOString(),
    source: source || "manual",
    raw: JSON.stringify(rec),
  };
}

/** Store one reading or an array of up to 100. Refuses the whole post in words when any row is bad. */
export async function storeSensorReadings(db: D1Database, body: unknown, nowIso: string): Promise<number> {
  if (body == null || (typeof body !== "object")) throw new HttpError(400, "The body must be a reading or a list of readings.");
  const list = Array.isArray(body) ? body : [body];
  if (list.length === 0) throw new HttpError(400, "No readings to store.");
  if (list.length > 100) throw new HttpError(400, "At most 100 readings at a time.");
  const rooms = await roomList(db);
  const rows = list.map((row, i) => oneReading(row, rooms, String(i + 1)));
  const stmts = rows.map((row) =>
    db
      .prepare(
        `INSERT INTO sensor_readings (id, room, temperature_f, humidity_pct, source, read_at, received_at, raw, sensor_id, role)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL)`
      )
      .bind(crypto.randomUUID(), row.room, row.temperature_f, row.humidity_pct, row.source, row.read_at, nowIso, row.raw)
  );
  if (stmts.length === 1) await stmts[0].run();
  else await db.batch(stmts);
  return rows.length;
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

function paneCard(name: CurePaneName, lots: CureLot[], reading: CureReading | null, nowIso: string, locale: Locale, flags: string[]): string {
  const cond = conditionsLine(reading, nowIso, locale);
  const alert = flags.length > 0;
  const text = alert ? `${cond.text} · ${flags.join(" ")}` : cond.text;
  const body = lots.length
    ? lots.map((lot) => lotRow(lot, nowIso, locale)).join("")
    : `<p class="muted" data-cure-empty>${esc(t(locale, "No lots."))}</p>`;
  return `<div class="inv-gauge cure-pane" data-cure-pane="${name}">
      <div class="inv-gauge-name">${name}</div>
      <p class="cure-conditions${cond.stale || alert ? " cure-stale" : ""}" data-cure-conditions>${esc(text)}</p>
      ${body}
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
})();
</script>`;
}

/** The two cards and the ticking script. THE PANES RIDE THE STRIP (owner,
 * 2026-09-22: "CSA and CSB should be in line with drying spaces, in the void
 * after FFZ Inventory set the same size"): no wrapper of their own; the caller
 * hands this string to siloStrip as extra tiles, so the two cards stand in the
 * drying row after the FFZ cube, the width of the tiles beside them. */
export function curePanes(data: CurePanesData, locale: Locale = "en"): string {
  const flags = data.flags ?? {};
  return `${paneCard("CSA", data.csa, data.readings.CSA, data.nowIso, locale, flags.CSA ?? [])}${paneCard(
    "CSB",
    data.csb,
    data.readings.CSB,
    data.nowIso,
    locale,
    flags.CSB ?? []
  )}${cureClockScript()}`;
}
