/**
 * DD S3e: Storage Capacity Utilization. A live read on the bizops wall.
 * Silos and dry rooms take assembleSiloVisuals' fill level, the silo tile's
 * own number. Cure spaces take the cure page's lots in place over the ea cap.
 * A room with a door average shows that average; the flag law colors it.
 */
import { capacityUomOf, CONFIG_KEYS, drySpaceTypeOf, projectedDryYieldPct, shortLotId } from "./config";
import { CURE_OCCUPANCY_SQL, cureCapFromSpace, cureFullnessPct, cureMembership } from "./cure";
import { SILO_EMPTY_SINCE_SQL, SILO_LOT_GRAMS_SQL, SILO_OPEN_LOADS_SQL, type SiloLoadRow, type SiloLotGramsRow, type SiloRow } from "./db";
import {
  averageDoorRows,
  doorReadingWhere,
  DOOR_UNIT_WINDOW_MS,
  DOOR_WINDOW_SQL,
  environmentFlagLines,
  staleMinutesOf,
  type DoorAverage,
  type DoorSample,
  type EnvRange,
} from "./environment";
import { etClock12 } from "./farmday";
import { t, tFill, type Locale } from "./i18n";
import { assembleSiloVisuals, LB_GRAMS, siloCapacityGrams, spaceCapacityGrams, type SiloLive, type SiloVisual } from "./silo";
import { esc } from "./ui";

export const STORAGE_CAPACITY_KPI = "bizops.storage_capacity";

const SLOT = 72;
const BAR_W = 28;
const PAD = 12;
const PLOT_TOP = 22;
const PLOT_BOTTOM = 108;
const NAME_Y = 124;
const ENV_Y = 138;
const SVG_H = 154;

type SpaceRow = SiloRow & { kind: string; door_read_at: string | null };

export type StorageEnv = {
  temperatureF: number;
  humidityPct: number | null;
  readAt: string;
  stale: boolean;
  ageMs: number;
  warn: boolean;
  sensorIds: string[];
  units: number;
  range: EnvRange | null;
};

export type StorageRoom = {
  id: string;
  name: string;
  shortName: string;
  pct: number;
  /** The silo tile's i18n key (filling, drying, unloading, empty). Blank on a cure room that holds lots. */
  stateKey: string;
  kind: "wet" | "lots";
  amount: number;
  cap: number;
  lots: string[];
  env: StorageEnv | null;
};

export type StorageModel = { nowIso: string; rooms: StorageRoom[] };

export function emptyStorage(nowIso: string): StorageModel {
  return { nowIso, rooms: [] };
}

/** A live dry space with a capacity, not a freezer (by type) and not hang or truck (by kind). */
export function isStorageSpace(space: { kind?: string | null; space_type?: string | null; capacity?: number | string | null; deleted_at?: string | null }): boolean {
  if (space.deleted_at) return false;
  const cap = Number(String(space.capacity ?? "").replace(/,/g, "").trim());
  if (!Number.isFinite(cap) || !(cap > 0)) return false;
  if (String(space.space_type ?? "silo").trim().toLowerCase() === "freezer") return false;
  const kind = String(space.kind ?? "").trim().toLowerCase();
  return kind !== "hang" && kind !== "truck";
}

/** Silo 1 to 5, then any later silo, then dry rooms, then CSA, CSB, then any other cure space. */
export function storageRank(space: { name: string; space_type?: string | null }): [number, number, string] {
  const name = space.name.trim();
  const type = String(space.space_type ?? "silo").trim().toLowerCase();
  const silo = /^silo\s+(\d+)$/i.exec(name);
  if (type === "silo") return [0, silo ? Number(silo[1]) : 10000, name.toLowerCase()];
  if (type === "dry_room") return [1, 0, name.toLowerCase()];
  if (type === "cure") {
    const upper = name.toUpperCase();
    return [2, upper === "CSA" ? 0 : upper === "CSB" ? 1 : 2, name.toLowerCase()];
  }
  return [3, 0, name.toLowerCase()];
}

export function storageShortName(name: string): string {
  const text = name.trim();
  const silo = /^silo\s+(\d+)$/i.exec(text);
  if (silo) return `S${silo[1]}`;
  if (text.toLowerCase() === "arlington dry room") return "ARL";
  return text.length <= 10 ? text : text.slice(0, 10);
}

/** The percent the silo tile prints: the fill level, whole, half up, capped at 100 by the tile. */
export function siloTilePct(level: number): number {
  return Math.round(Math.min(1, Math.max(0, level)) * 100);
}

function rowsOf(result: unknown): Record<string, unknown>[] {
  const rows = (result as { results?: unknown } | undefined)?.results;
  return Array.isArray(rows) ? (rows as Record<string, unknown>[]) : [];
}

function textOf(result: unknown): string | null {
  const row = rowsOf(result)[0];
  if (!row || row.value == null) return null;
  return String(row.value);
}

function spaceFrom(row: Record<string, unknown>): SpaceRow {
  return {
    id: String(row.id ?? ""),
    name: String(row.name ?? ""),
    shape: row.shape == null ? null : String(row.shape),
    farm_code: row.farm_code == null ? null : String(row.farm_code),
    space_type: row.space_type == null ? null : String(row.space_type),
    capacity: row.capacity == null ? null : (row.capacity as number | string),
    capacity_uom: row.capacity_uom == null ? null : String(row.capacity_uom),
    location_name: row.location_name == null ? null : String(row.location_name),
    kind: String(row.kind ?? ""),
    door_read_at: row.door_read_at == null || String(row.door_read_at).trim() === "" ? null : String(row.door_read_at),
  };
}

const STORAGE_SPACES_SQL = `SELECT d.id, d.name, d.shape, d.farm_code, d.space_type, d.capacity, d.capacity_uom, d.location_name, d.kind,
            (SELECT MAX(r.read_at) FROM sensor_readings r
              WHERE r.room = d.name AND ${doorReadingWhere("r")}) AS door_read_at
     FROM dry_spaces d
     WHERE d.deleted_at IS NULL
       AND d.capacity IS NOT NULL
       AND d.capacity > 0
       AND lower(coalesce(d.space_type, 'silo')) <> 'freezer'
       AND lower(d.kind) NOT IN ('hang', 'truck')`;

/** The reads the bizops wall adds after Plant Weight, still inside the one batch. Door windows follow only for rooms that have a newest read. */
export function storageCapacityStatements(db: D1Database): D1PreparedStatement[] {
  return [
    db.prepare(STORAGE_SPACES_SQL),
    db.prepare(SILO_OPEN_LOADS_SQL),
    db.prepare(SILO_LOT_GRAMS_SQL),
    db.prepare(SILO_EMPTY_SINCE_SQL),
    db.prepare(`SELECT value FROM app_config WHERE key = ? AND deleted_at IS NULL`).bind(CONFIG_KEYS.silo_capacity_wet_lbs),
    db.prepare(`SELECT value FROM app_config WHERE key = ? AND deleted_at IS NULL`).bind(CONFIG_KEYS.projected_dry_yield_pct),
    db.prepare(CURE_OCCUPANCY_SQL),
    db.prepare(
      `SELECT space_name, temp_low, temp_high, humidity_low, humidity_high
       FROM environment_ranges WHERE deleted_at IS NULL AND lower(trim(role)) = 'room'`
    ),
    db.prepare(`SELECT value FROM app_config WHERE key = ? AND deleted_at IS NULL`).bind(CONFIG_KEYS.environment_stale_minutes),
  ];
}

function numOrNull(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function capPounds(space: SpaceRow, fallbackGrams: number): number {
  const uom = capacityUomOf(space.capacity_uom);
  const n = Number(String(space.capacity ?? "").replace(/,/g, "").trim());
  if (uom === "lb" && Number.isFinite(n) && n > 0) return Math.round(n);
  return Math.round(spaceCapacityGrams(space, fallbackGrams) / LB_GRAMS);
}

/** Scribe gate fix (S3e): the silo tile's drawing clamps its level at 100, but the
 * dashboard prints the true percent (the brief: over 100 draws to the top with its
 * true percent). Same grams the hover prints, over the space's own capacity; at or
 * under 100 it equals the tile's own percent. */
export function trueSiloPct(visual: SiloVisual, capacityGrams: number): number {
  if (!(capacityGrams > 0)) return siloTilePct(visual.level);
  return Math.max(0, Math.round((gramsShown(visual) / capacityGrams) * 100));
}

function gramsShown(visual: SiloVisual): number {
  if (visual.state === "unloading") return visual.wetGrams * (1 - visual.unloadedShare);
  return visual.wetGrams;
}

function lotLabels(live: SiloLive, grams: readonly SiloLotGramsRow[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const add = (hbn: string | null | undefined, tag: string | null | undefined) => {
    const label = shortLotId(String(hbn ?? ""), tag ?? null);
    if (!label || seen.has(label)) return;
    seen.add(label);
    out.push(label);
  };
  for (const load of live.loads) add(load.hbn, load.metrc_harvest_tag);
  for (const row of grams) if (row.dry_space_id === live.silo.id) add(row.hbn, row.metrc_harvest_tag);
  for (const waiting of live.waiting) add(waiting.hbn, waiting.metrc_harvest_tag);
  return out;
}

function rangeFor(ranges: readonly Record<string, unknown>[], name: string): EnvRange | null {
  const key = name.trim().toUpperCase();
  const row = ranges.find((item) => String(item.space_name ?? "").trim().toUpperCase() === key);
  if (!row) return null;
  return {
    tempLow: numOrNull(row.temp_low),
    tempHigh: numOrNull(row.temp_high),
    humidityLow: numOrNull(row.humidity_low),
    humidityHigh: numOrNull(row.humidity_high),
  };
}

function envOf(avg: DoorAverage, range: EnvRange | null, nowIso: string, staleMinutes: number): StorageEnv {
  const readMs = Date.parse(avg.readAt);
  const nowMs = Date.parse(nowIso);
  const ageMs = Number.isFinite(readMs) && Number.isFinite(nowMs) ? Math.max(0, nowMs - readMs) : 0;
  const sample = { temperatureF: avg.temperatureF, humidityPct: avg.humidityPct, readAt: avg.readAt };
  const warn = environmentFlagLines("room", sample, range, nowIso, staleMinutes, null).length > 0;
  const stale = !Number.isFinite(readMs) || !Number.isFinite(nowMs) || ageMs > staleMinutes * 60_000;
  return {
    temperatureF: avg.temperatureF,
    humidityPct: avg.humidityPct,
    readAt: avg.readAt,
    stale,
    ageMs,
    warn,
    sensorIds: avg.sensorIds,
    units: avg.units,
    range,
  };
}

export type StorageBuildInput = {
  spaces: SpaceRow[];
  loads: readonly SiloLoadRow[];
  grams: readonly SiloLotGramsRow[];
  departures: readonly { dry_space_id: string; left_at: string | null }[];
  capacityRaw: string | null;
  yieldRaw: string | null;
  cureRows: readonly Record<string, unknown>[];
  ranges: readonly Record<string, unknown>[];
  averages: ReadonlyMap<string, DoorAverage>;
  staleMinutes: number;
  nowIso: string;
};

export function buildStorageModel(input: StorageBuildInput): StorageModel {
  const spaces = input.spaces.filter(isStorageSpace).slice().sort((a, b) => {
    const ra = storageRank(a);
    const rb = storageRank(b);
    return ra[0] - rb[0] || ra[1] - rb[1] || (ra[2] < rb[2] ? -1 : ra[2] > rb[2] ? 1 : 0);
  });
  const fallbackGrams = siloCapacityGrams(input.capacityRaw);
  const yieldPct = projectedDryYieldPct(input.yieldRaw);
  const wetSpaces = spaces.filter((space) => drySpaceTypeOf(space.space_type) !== "cure");
  const live = assembleSiloVisuals(wetSpaces, input.loads, input.grams, fallbackGrams, yieldPct, input.departures);
  const liveById = new Map(live.map((row) => [row.silo.id, row]));
  const panes: Record<"CSA" | "CSB", string[]> = { CSA: [], CSB: [] };
  for (const row of input.cureRows) {
    const pane = cureMembership({
      status: String(row.status ?? ""),
      deleted: false,
      trimStatus: row.trim_status == null ? null : String(row.trim_status),
    });
    if (!pane) continue;
    const label = shortLotId(String(row.hbn ?? ""), row.metrc_harvest_tag == null ? null : String(row.metrc_harvest_tag));
    if (label) panes[pane].push(label);
  }
  panes.CSA.sort();
  panes.CSB.sort();
  const rooms: StorageRoom[] = spaces.map((space) => {
    const avg = input.averages.get(space.name) ?? null;
    const env = avg ? envOf(avg, rangeFor(input.ranges, space.name), input.nowIso, input.staleMinutes) : null;
    if (drySpaceTypeOf(space.space_type) === "cure") {
      const pane = space.name.trim().toUpperCase();
      const lots = pane === "CSA" || pane === "CSB" ? panes[pane] : [];
      const cap = pane === "CSA" || pane === "CSB" ? cureCapFromSpace(pane, space.capacity, space.capacity_uom) : Math.round(Number(space.capacity) || 0);
      return {
        id: space.id,
        name: space.name,
        shortName: storageShortName(space.name),
        pct: cureFullnessPct(lots.length, cap),
        stateKey: lots.length === 0 ? "empty" : "",
        kind: "lots",
        amount: lots.length,
        cap,
        lots,
        env,
      };
    }
    const row = liveById.get(space.id);
    const visual = row?.visual;
    return {
      id: space.id,
      name: space.name,
      shortName: storageShortName(space.name),
      pct: visual ? trueSiloPct(visual, spaceCapacityGrams(space, fallbackGrams)) : 0,
      stateKey: visual?.label ?? "empty",
      kind: "wet",
      amount: visual ? Math.round(gramsShown(visual) / LB_GRAMS) : 0,
      cap: capPounds(space, fallbackGrams),
      lots: row ? lotLabels(row, input.grams) : [],
      env,
    };
  });
  return { nowIso: input.nowIso, rooms };
}

export async function loadStorageModel(db: D1Database, results: readonly unknown[], nowIso: string): Promise<StorageModel> {
  const spaces = rowsOf(results[0]).map(spaceFrom).filter(isStorageSpace);
  const pending = spaces
    .filter((space) => space.door_read_at)
    .map((space) => {
      const ms = Date.parse(String(space.door_read_at));
      if (!Number.isFinite(ms)) return null;
      return { room: space.name, cutoff: new Date(ms - DOOR_UNIT_WINDOW_MS).toISOString() };
    })
    .filter((row): row is { room: string; cutoff: string } => row != null);
  const averages = new Map<string, DoorAverage>();
  if (pending.length > 0) {
    const got = await db.batch<DoorSample>(pending.map((row) => db.prepare(DOOR_WINDOW_SQL).bind(row.room, row.cutoff)));
    pending.forEach((row, index) => {
      const avg = averageDoorRows(rowsOf(got[index]) as DoorSample[]);
      if (avg) averages.set(row.room, { room: row.room, ...avg });
    });
  }
  return buildStorageModel({
    spaces,
    loads: rowsOf(results[1]) as unknown as SiloLoadRow[],
    grams: rowsOf(results[2]) as unknown as SiloLotGramsRow[],
    departures: rowsOf(results[3]).map((row) => ({ dry_space_id: String(row.dry_space_id ?? ""), left_at: row.left_at == null ? null : String(row.left_at) })),
    capacityRaw: textOf(results[4]),
    yieldRaw: textOf(results[5]),
    cureRows: rowsOf(results[6]),
    ranges: rowsOf(results[7]),
    averages,
    staleMinutes: staleMinutesOf(textOf(results[8])),
    nowIso,
  });
}

function grouped(n: number): string {
  return Math.round(n).toLocaleString("en-US");
}

function titled(word: string): string {
  if (!word) return "";
  return word.charAt(0).toUpperCase() + word.slice(1);
}

export function farmClockLabel(iso: string): string {
  const clock = etClock12(iso);
  if (!clock.hhmm) return "";
  const [hh, mm] = clock.hhmm.split(":");
  return `${Number(hh)}:${mm} ${clock.meridiem}`;
}

export function readAgeLabel(ms: number): string {
  const min = Math.max(0, Math.round(ms / 60_000));
  if (min < 60) return `${min} m`;
  const hours = Math.floor(min / 60);
  const rem = min % 60;
  return rem === 0 ? `${hours} h` : `${hours} h ${rem} m`;
}

function climateLine(env: StorageEnv, locale: Locale): string {
  if (env.stale) return tFill(locale, "no read for {age}", { age: readAgeLabel(env.ageMs) });
  const temp = env.temperatureF.toFixed(1);
  if (env.humidityPct == null || !Number.isFinite(env.humidityPct)) return tFill(locale, "{temp} F", { temp });
  return tFill(locale, "{temp} F, {rh}% RH", { temp, rh: String(Math.round(env.humidityPct)) });
}

function boundText(low: number | null, high: number | null, unit: string, locale: Locale, whole: boolean): string {
  const show = (n: number) => (whole ? String(Math.round(n)) : n.toFixed(1));
  if (low != null && high != null) return tFill(locale, "{low} to {high} {unit}", { low: show(low), high: show(high), unit });
  if (high != null) return tFill(locale, "at most {n} {unit}", { n: show(high), unit });
  if (low != null) return tFill(locale, "at least {n} {unit}", { n: show(low), unit });
  return "";
}

function rangeLine(range: EnvRange | null, locale: Locale): string {
  if (!range) return "";
  const parts = [boundText(range.tempLow, range.tempHigh, "F", locale, false), boundText(range.humidityLow, range.humidityHigh, "% RH", locale, true)].filter((part) => part !== "");
  return parts.join(", ");
}

export function storageDetail(room: StorageRoom, locale: Locale): string {
  const parts = [room.name];
  if (room.stateKey) parts.push(titled(t(locale, room.stateKey)));
  const amountKey = room.kind === "lots" ? "{amount} of {cap} lots" : "{amount} of {cap} wet lb";
  parts.push(tFill(locale, amountKey, { amount: grouped(room.amount), cap: grouped(room.cap) }));
  if (room.lots.length > 0) parts.push(tFill(locale, "Lots {lots}", { lots: room.lots.join(", ") }));
  if (room.env) {
    parts.push(climateLine(room.env, locale));
    if (room.env.sensorIds.length > 0) parts.push(tFill(locale, "Sensors {sensors}", { sensors: room.env.sensorIds.join(", ") }));
    else if (room.env.units > 0) parts.push(tFill(locale, "{n} sensors", { n: String(room.env.units) }));
    const read = farmClockLabel(room.env.readAt);
    if (read) parts.push(tFill(locale, "Read {time}", { time: read }));
    const range = rangeLine(room.env.range, locale);
    if (range) parts.push(tFill(locale, "Range {range}", { range }));
  }
  return parts.join(". ");
}

function storageScript(): string {
  return `<script>
(function () {
  var root = document.querySelector("[data-dd-cap]");
  if (!root) return;
  var tip = root.querySelector("[data-dd-cap-tip]");
  function show(bar) {
    if (!tip) return;
    tip.textContent = bar.getAttribute("data-dd-cap-detail") || "";
    tip.hidden = false;
  }
  var bars = root.querySelectorAll("[data-dd-cap-bar]");
  for (var i = 0; i < bars.length; i++) {
    bars[i].addEventListener("mouseenter", function () { show(this); });
    bars[i].addEventListener("click", function () { show(this); });
    bars[i].addEventListener("focus", function () { show(this); });
    bars[i].addEventListener("keydown", function (event) {
      if (event.key === "Enter" || event.key === " ") show(this);
    });
  }
})();
</script>`;
}

export function storageBody(model: StorageModel, locale: Locale): string {
  const n = model.rooms.length;
  const width = Math.max(PAD * 2 + n * SLOT, 160);
  const span = PLOT_BOTTOM - PLOT_TOP;
  const bars = model.rooms
    .map((room, index) => {
      const x = PAD + index * SLOT + (SLOT - BAR_W) / 2;
      const cx = x + BAR_W / 2;
      const full = room.pct >= 100;
      const over = room.pct > 100;
      const height = room.pct <= 0 ? 3 : (Math.min(room.pct, 100) / 100) * span;
      const y = Math.round((PLOT_BOTTOM - height) * 100) / 100;
      const h = Math.round(height * 100) / 100;
      const detail = storageDetail(room, locale);
      const fill = full ? "dd-cap-fill dd-cap-warn" : "dd-cap-fill";
      const marker = over
        ? `<line data-dd-cap-marker="1" x1="${x - 4}" y1="${PLOT_TOP}" x2="${x + BAR_W + 4}" y2="${PLOT_TOP}" class="dd-cap-warn"/>`
        : "";
      const env = room.env
        ? `<text class="dd-cap-env${room.env.warn ? " dd-cap-env-warn" : ""}" data-dd-cap-env="${esc(room.id)}" x="${cx}" y="${ENV_Y}" text-anchor="middle">${esc(climateLine(room.env, locale))}</text>`
        : "";
      return `<g data-dd-cap-bar="${esc(room.id)}" data-dd-cap-room="${esc(room.name)}" data-dd-cap-pct="${room.pct}" data-dd-cap-detail="${esc(detail)}" tabindex="0" role="img">
        <title>${esc(detail)}</title>
        <text class="dd-cap-pct" x="${cx}" y="14" text-anchor="middle">${esc(`${room.pct}%`)}</text>
        ${marker}
        <rect class="${fill}" data-dd-cap-fill="${room.pct <= 0 ? "stub" : "bar"}" x="${x}" y="${y}" width="${BAR_W}" height="${h}"/>
        <text class="dd-cap-name" x="${cx}" y="${NAME_Y}" text-anchor="middle">${esc(room.shortName)}</text>
        ${env}
      </g>`;
    })
    .join("");
  const axis = n > 0 ? `<line class="dd-cap-axis" x1="${PAD}" y1="${PLOT_BOTTOM}" x2="${width - PAD}" y2="${PLOT_BOTTOM}"/>` : "";
  const clock = farmClockLabel(model.nowIso);
  return `<div class="dd-cap" data-dd-cap>
    <svg viewBox="0 0 ${width} ${SVG_H}" role="img" aria-label="${esc(t(locale, "Storage Capacity Utilization"))}">
      ${axis}
      ${bars}
    </svg>
    <p class="dd-cap-tip" data-dd-cap-tip hidden></p>
    <p class="dd-cap-asof" data-dd-cap-asof>${esc(tFill(locale, "Live as of {time}", { time: clock }))}</p>
    ${storageScript()}
  </div>`;
}
