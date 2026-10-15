/**
 * DD S1: the Director Dashboard. An Admin home of five department cards and
 * one wall per department, every tile a snapshot row in dd_kpi_values that the
 * crons write from S3 on. A GET reads in ONE db.batch and computes nothing:
 * the registry (dd_kpis, DD_KPIS when the table has no rows), the live values
 * for the periods on show, the question counts and the dd_* config the pages
 * read. KPI titles come from the registry rows (title_en, title_es); every
 * other word goes through t(). Raw values only through esc().
 */
import { HttpError, requireReason, textOrNull } from "./audit";
import { insertLog, requireActor } from "./db";
import {
  DD_CADENCES,
  DD_CONFIG,
  DD_CONFIG_KEYS,
  DD_DEPARTMENTS,
  DD_DEPT_KEYS,
  DD_GOAL_DIRECTIONS,
  DD_HISTORY_PERIODS_MAX,
  DD_KPIS,
  DD_PERIOD_KINDS,
  DD_SOURCE_PRECEDENCE,
  ddHistoryPeriods,
  ddInSeason,
  ddKpisForWall,
  ddLbGrams,
  ddPeriodKindOf,
  ddSeasonStartDate,
  type DdCadence,
  type DdDeptKey,
  type DdGoalDirection,
  type DdKpi,
  type DdPeriodKind,
  type DdSourceKind,
  type DdUnit,
} from "./directorregistry";
import { etWallClock, isCalendarDate, isoWeekOf, periodLabel, periodShift, periodStartFor, type PeriodKind } from "./farmday";
import { t, tFill, type Locale } from "./i18n";
import { esc, tabBar } from "./ui";

export const DIRECTOR_PATH = "/admin/director";

/** The questions page. S1 links here; S2b serves it. */
export const DIRECTOR_QUESTIONS_PATH = `${DIRECTOR_PATH}/questions`;

/** The CSV import page. */
export const DIRECTOR_IMPORT_PATH = `${DIRECTOR_PATH}/import`;

export function directorTargetPostPath(kpiKey: string): string {
  return `${DIRECTOR_PATH}/kpi/${encodeURIComponent(kpiKey)}/target`;
}

export function directorTargetVoidPath(id: string): string {
  return `${DIRECTOR_PATH}/target/${encodeURIComponent(id)}/void`;
}

export function directorQuestionRulePath(questionKey: string): string {
  return `${DIRECTOR_PATH}/questions/${encodeURIComponent(questionKey)}/rule`;
}

export function isDdDeptKey(value: string | null | undefined): value is DdDeptKey {
  return (DD_DEPT_KEYS as readonly string[]).includes(String(value ?? ""));
}

export function isDdCadence(value: string | null | undefined): value is DdCadence {
  return (DD_CADENCES as readonly string[]).includes(String(value ?? ""));
}

/** The entry grid S2a builds, one cadence of one wall. */
export function directorGridPath(dept: DdDeptKey, cadence?: DdCadence | null, period?: string | null): string {
  const query = new URLSearchParams();
  if (cadence) query.set("cadence", cadence);
  if (period) query.set("period", period);
  const qs = query.toString();
  return `${DIRECTOR_PATH}/${dept}/enter${qs ? `?${qs}` : ""}`;
}

/** One KPI's detail page (history, the change log, and the targets block). */
export function directorKpiPath(kpiKey: string): string {
  return `${DIRECTOR_PATH}/kpi/${encodeURIComponent(kpiKey)}`;
}

/** The three farm dimensions a hand row enters beside its total. Other dimensions wait. */
export const DD_FARM_DIMS = ["PNN", "ARL", "PNS"] as const;

/** A wall's URL; the cadence tab and the period day ride the query string. */
export function directorWallPath(dept: DdDeptKey, cadence?: DdCadence | null, period?: string | null): string {
  const query = new URLSearchParams();
  if (cadence) query.set("cadence", cadence);
  if (period) query.set("period", period);
  const qs = query.toString();
  return `${DIRECTOR_PATH}/${dept}${qs ? `?${qs}` : ""}`;
}

export const DD_TILE_STATUSES = ["parked", "needs_definition", "out_of_season", "no_data", "stale", "on_goal", "off_goal", "no_goal"] as const;
export type DdTileStatus = (typeof DD_TILE_STATUSES)[number];

/** The badge word per tile status: t() keys with ES rows. */
export const DD_STATUS_WORDS: Readonly<Record<DdTileStatus, string>> = {
  parked: "Parked",
  needs_definition: "Needs definition",
  out_of_season: "Out of season",
  no_data: "No data yet",
  stale: "Stale",
  on_goal: "On goal",
  off_goal: "Off goal",
  no_goal: "No goal",
};

/** The source badge word per dd_kpi_values.source (the registry's source kinds). "Mount" is a verb elsewhere in the dictionary, so its key is disambiguated. */
export const DD_SOURCE_WORDS: Readonly<Record<string, string>> = {
  app: "App",
  hand: "Hand",
  mount: "Source mount",
  gc: "GRIPCasting",
  connector: "Connector",
  mixed: "Mixed",
};

/** The unit word beside a value; usd and pct carry their symbol inside the value, text has none. */
export const DD_UNIT_WORDS: Readonly<Record<DdUnit, string>> = {
  lb448: "lb",
  g: "g",
  ea: "ea",
  L: "L",
  usd: "$",
  pct: "%",
  count: "count",
  h: "h",
  days: "days",
  score: "score",
  ratio: "ratio",
  text: "",
  mol_m2_day: "mol/m2/day",
};

export const DD_CADENCE_WORDS: Readonly<Record<DdCadence, string>> = {
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
  quarterly: "Quarterly",
  seasonal: "Seasonal",
};

/** One live dd_kpi_values row, the columns a page shows. */
export type DdSnapshot = {
  kpi_key: string;
  period_kind: DdPeriodKind;
  period_start: string;
  value: number | null;
  value_text: string | null;
  goal: number | null;
  n: number | null;
  source: string;
  source_as_of: string | null;
  computed_at: string;
  def_version: number;
};

export type DdHistoryPoint = { period_start: string; value: number | null };

/** One dd_targets row. deleted_at set means the row is voided and not in force. */
export type DdTarget = {
  id: string;
  kpi_key: string;
  dim_key: string;
  period_kind: string;
  effective_from: string;
  target: number;
  low: number | null;
  high: number | null;
  phasing: string | null;
  note: string | null;
  deleted_at: string | null;
};

export type DdPageConfig = { historyPeriods: number; lbGrams: number; seasonStartDate: string | null };

export type DirectorTile = {
  kpi: DdKpi;
  periodKind: DdPeriodKind;
  periodStart: string;
  inSeason: boolean;
  status: DdTileStatus;
  snapshot: DdSnapshot | null;
  /** The periods of the sparkline window that have a live row, oldest first, the shown period last. */
  history: DdHistoryPoint[];
  companions: DirectorTile[];
};

export type DirectorWallGroup = { cadence: DdCadence; periodKind: DdPeriodKind; periodStart: string; tiles: DirectorTile[] };

export type DirectorWallModel = {
  dept: DdDeptKey;
  title_en: string;
  farmToday: string;
  nowIso: string;
  /** The cadence tab in force, null for every cadence. */
  cadence: DdCadence | null;
  /** The day the stepper chose for that tab, null for the farm today. */
  periodDay: string | null;
  config: DdPageConfig;
  cadences: DdCadence[];
  groups: DirectorWallGroup[];
  tileCount: number;
};

export type DirectorDeptCard = {
  dept_key: DdDeptKey;
  title_en: string;
  tiles: number;
  counts: Record<DdTileStatus, number>;
  lastComputedAt: string | null;
};

export type DirectorHomeModel = {
  farmToday: string;
  nowIso: string;
  config: DdPageConfig;
  departments: DirectorDeptCard[];
  totalTiles: number;
  questions: { open: number; ruled: number; parked: number };
};

type Row = Record<string, unknown>;

const SNAPSHOT_COLUMNS = "kpi_key, period_kind, period_start, value, value_text, goal, n, source, source_as_of, computed_at, def_version";

const REGISTRY_SQL = `SELECT kpi_key, dept_key, wall_keys, title_en, title_es, unit, cadence, season_start_md, season_end_md, dims, goal_kind, goal_ref, goal_direction, compute_key,
  source_kind, stale_after_hours, status, def_version, open_question_en, open_question_es, config_key, companion_of, workbook_rows, sort, active
  FROM dd_kpis WHERE active = 1 ORDER BY sort`;

/** The rank of a live row's source when two sources hold one period: the first of DD_SOURCE_PRECEDENCE
 * wins, whatever was computed last. Both value statements order by this rank descending so the winning
 * row lands last and the loader's Map (last write wins) keeps it. */
function sourceRankSql(column: string): string {
  const cases = DD_SOURCE_PRECEDENCE.map((source, rank) => `WHEN '${source}' THEN ${rank}`).join(" ");
  return `CASE ${column} ${cases} ELSE ${DD_SOURCE_PRECEDENCE.length} END`;
}

const SNAPSHOT_COLUMNS_V = SNAPSHOT_COLUMNS.split(", ")
  .map((column) => `v.${column}`)
  .join(", ");

/** The newest live period per key and period kind (the '' dimension; dims come with the detail page): the
 * covering partial index dd_kpi_values_live walks (kpi_key, period_kind) to MAX(period_start) and the live
 * rows of that period join back, so the home's cost does not grow with the snapshot history. */
const LATEST_SQL = `SELECT ${SNAPSHOT_COLUMNS_V} FROM dd_kpi_values v
  JOIN (SELECT kpi_key, period_kind, MAX(period_start) AS period_start FROM dd_kpi_values
        WHERE superseded_at IS NULL AND dim_key = '' GROUP BY kpi_key, period_kind) m
    ON m.kpi_key = v.kpi_key AND m.period_kind = v.period_kind AND m.period_start = v.period_start
  WHERE v.superseded_at IS NULL AND v.dim_key = ''
  ORDER BY v.kpi_key, v.period_kind, ${sourceRankSql("v.source")} DESC, v.computed_at, v.id`;

/** A wall's live rows: the wall's keys by the registry's own wall_keys (no key list to bind, so the one
 * batch needs no registry read first), one period window per kind, the winning source of a period last. */
const WALL_VALUES_SQL = `SELECT ${SNAPSHOT_COLUMNS} FROM dd_kpi_values
  WHERE superseded_at IS NULL AND dim_key = ''
    AND kpi_key IN (SELECT kpi_key FROM dd_kpis WHERE active = 1 AND (',' || wall_keys || ',') LIKE ?)
    AND ((period_kind = 'day' AND period_start >= ? AND period_start <= ?)
      OR (period_kind = 'week' AND period_start >= ? AND period_start <= ?)
      OR (period_kind = 'month' AND period_start >= ? AND period_start <= ?)
      OR (period_kind = 'quarter' AND period_start >= ? AND period_start <= ?)
      OR (period_kind = 'season' AND period_start >= ? AND period_start <= ?))
  ORDER BY kpi_key, period_kind, period_start, ${sourceRankSql("source")} DESC, computed_at, id`;

/** Live targets for the wall's keys, read in the same batch as the snapshots. The goal line uses one only when the snapshot left goal blank. */
const WALL_TARGETS_SQL = `SELECT id, kpi_key, dim_key, period_kind, effective_from, target, low, high, phasing, note, deleted_at
  FROM dd_targets
  WHERE deleted_at IS NULL
    AND kpi_key IN (SELECT kpi_key FROM dd_kpis WHERE active = 1 AND (',' || wall_keys || ',') LIKE ?)`;

const QUESTION_COUNTS_SQL = `SELECT status, COUNT(*) AS n FROM dd_kpi_questions GROUP BY status`;

const PAGE_CONFIG_KEYS: readonly string[] = [DD_CONFIG.dd_history_periods, DD_CONFIG.dd_season_start_date, DD_CONFIG.dd_lb_grams];

/** The same read getConfigMap makes, as a statement the one batch can carry. */
function configStatement(db: D1Database): D1PreparedStatement {
  const marks = PAGE_CONFIG_KEYS.map(() => "?").join(", ");
  return db.prepare(`SELECT key, value FROM app_config WHERE deleted_at IS NULL AND key IN (${marks})`).bind(...PAGE_CONFIG_KEYS);
}

function pageConfigFrom(rows: readonly Row[] | undefined): DdPageConfig {
  const map = new Map<string, string>();
  for (const row of rows ?? []) map.set(String(row.key), String(row.value ?? ""));
  return {
    historyPeriods: ddHistoryPeriods(map.get(DD_CONFIG.dd_history_periods)),
    lbGrams: ddLbGrams(map.get(DD_CONFIG.dd_lb_grams)),
    seasonStartDate: ddSeasonStartDate(map.get(DD_CONFIG.dd_season_start_date)),
  };
}

/** A dd_kpis row in the registry's shape (the timestamps dropped). */
export function kpiFromRegistryRow(row: Row): DdKpi {
  const text = (key: string) => (row[key] == null ? null : String(row[key]));
  const num = (key: string) => (row[key] == null ? null : Number(row[key]));
  return {
    kpi_key: String(row.kpi_key),
    dept_key: String(row.dept_key) as DdKpi["dept_key"],
    wall_keys: String(row.wall_keys ?? ""),
    title_en: String(row.title_en ?? ""),
    title_es: String(row.title_es ?? ""),
    unit: String(row.unit) as DdKpi["unit"],
    cadence: String(row.cadence) as DdKpi["cadence"],
    season_start_md: text("season_start_md"),
    season_end_md: text("season_end_md"),
    dims: String(row.dims ?? ""),
    goal_kind: String(row.goal_kind) as DdKpi["goal_kind"],
    goal_ref: text("goal_ref"),
    goal_direction: ((DD_GOAL_DIRECTIONS as readonly string[]).includes(String(row.goal_direction)) ? String(row.goal_direction) : "at_least") as DdGoalDirection,
    compute_key: text("compute_key"),
    source_kind: String(row.source_kind) as DdKpi["source_kind"],
    stale_after_hours: num("stale_after_hours"),
    status: String(row.status) as DdKpi["status"],
    def_version: Number(row.def_version ?? 1),
    open_question_en: text("open_question_en"),
    open_question_es: text("open_question_es"),
    config_key: text("config_key"),
    companion_of: text("companion_of"),
    workbook_rows: text("workbook_rows"),
    sort: Number(row.sort ?? 0),
    active: Number(row.active ?? 1),
  };
}

/** The registry rows a page reads: the table's active rows by sort, DD_KPIS when the table has none. */
export function registryFromRows(rows: readonly Row[] | undefined): DdKpi[] {
  const list = (rows ?? [])
    .map(kpiFromRegistryRow)
    .filter((row) => row.active === 1)
    .sort((a, b) => a.sort - b.sort);
  return list.length > 0 ? list : DD_KPIS.filter((row) => row.active === 1);
}

export async function loadDirectorRegistry(db: D1Database): Promise<DdKpi[]> {
  const rows = await db.prepare(REGISTRY_SQL).all<Row>();
  return registryFromRows(rows.results);
}

function snapshotFromRow(row: Row): DdSnapshot {
  const num = (value: unknown) => {
    if (value == null) return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  };
  return {
    kpi_key: String(row.kpi_key),
    period_kind: String(row.period_kind) as DdPeriodKind,
    period_start: String(row.period_start),
    value: num(row.value),
    value_text: row.value_text == null ? null : String(row.value_text),
    goal: num(row.goal),
    n: num(row.n),
    source: String(row.source ?? ""),
    source_as_of: row.source_as_of == null ? null : String(row.source_as_of),
    computed_at: String(row.computed_at ?? ""),
    def_version: Number(row.def_version ?? 1),
  };
}

const HOUR_MS = 3_600_000;

/** Stale when the row was computed, or its source read, more than stale_after_hours before now; never when the row has no limit. */
export function ddIsStale(kpi: Pick<DdKpi, "stale_after_hours">, snapshot: Pick<DdSnapshot, "computed_at" | "source_as_of">, nowIso: string): boolean {
  const hours = kpi.stale_after_hours;
  if (hours == null || !(hours > 0)) return false;
  const now = Date.parse(nowIso);
  if (!Number.isFinite(now)) return false;
  const limit = now - hours * HOUR_MS;
  const computed = Date.parse(snapshot.computed_at);
  if (Number.isFinite(computed) && computed < limit) return true;
  const asOf = snapshot.source_as_of ? Date.parse(snapshot.source_as_of) : Number.NaN;
  return Number.isFinite(asOf) && asOf < limit;
}

/** The favourable distance from the goal: value minus goal when at least the goal is wanted, goal minus value
 * when at most it is (days, cost per pound); zero or above reads on goal, and the variance line prints it. */
export function ddGoalDelta(direction: DdGoalDirection, value: number, goal: number): number {
  return direction === "at_most" ? goal - value : value - goal;
}

/** The tile's one status, in precedence: the registry's parked and needs definition, then out of season, no row,
 * stale, and the verdict against the row's goal. A row without a goal (or a text value) has no verdict. On goal
 * reads the row's goal_direction (at least the goal, or at most it) in S1; the effective dated targets of S2
 * carry the low and high bounds. */
export function ddTileStatus(kpi: DdKpi, snapshot: DdSnapshot | null, inSeason: boolean, nowIso: string): DdTileStatus {
  if (kpi.status === "parked") return "parked";
  if (kpi.status === "needs_definition") return "needs_definition";
  if (!inSeason) return "out_of_season";
  if (!snapshot) return "no_data";
  if (ddIsStale(kpi, snapshot, nowIso)) return "stale";
  if (snapshot.goal == null || snapshot.value == null) return "no_goal";
  return ddGoalDelta(kpi.goal_direction, snapshot.value, snapshot.goal) >= 0 ? "on_goal" : "off_goal";
}

function emptyCounts(): Record<DdTileStatus, number> {
  const counts = {} as Record<DdTileStatus, number>;
  for (const status of DD_TILE_STATUSES) counts[status] = 0;
  return counts;
}

function resultsOf(result: unknown): Row[] {
  const rows = (result as { results?: unknown } | undefined)?.results;
  return Array.isArray(rows) ? (rows as Row[]) : [];
}

/** The home: one batch (registry, newest live period per key, question counts, config), counts per department. */
export async function loadDirectorHome(db: D1Database, farmToday: string, nowIso: string = new Date().toISOString()): Promise<DirectorHomeModel> {
  const results = await db.batch([db.prepare(REGISTRY_SQL), db.prepare(LATEST_SQL), db.prepare(QUESTION_COUNTS_SQL), configStatement(db)]);
  const registry = registryFromRows(resultsOf(results[0]));
  const latest = new Map<string, DdSnapshot>();
  // The statement orders the winning source of a period last (DD_SOURCE_PRECEDENCE), so the last write wins.
  for (const row of resultsOf(results[1])) {
    const snap = snapshotFromRow(row);
    latest.set(`${snap.kpi_key}|${snap.period_kind}`, snap);
  }
  const questions = { open: 0, ruled: 0, parked: 0 };
  for (const row of resultsOf(results[2])) {
    const status = String(row.status) as keyof typeof questions;
    if (status in questions) questions[status] = Number(row.n ?? 0);
  }
  const config = pageConfigFrom(resultsOf(results[3]));
  const cards = new Map<DdDeptKey, DirectorDeptCard>();
  for (const dept of DD_DEPARTMENTS) {
    cards.set(dept.dept_key, { dept_key: dept.dept_key, title_en: dept.title_en, tiles: 0, counts: emptyCounts(), lastComputedAt: null });
  }
  for (const kpi of registry) {
    const card = cards.get(kpi.dept_key);
    if (!card) continue;
    const snap = latest.get(`${kpi.kpi_key}|${ddPeriodKindOf(kpi.cadence)}`) ?? null;
    const status = ddTileStatus(kpi, snap, ddInSeason(kpi, farmToday), nowIso);
    card.tiles += 1;
    card.counts[status] += 1;
    if (snap && (card.lastComputedAt == null || snap.computed_at > card.lastComputedAt)) card.lastComputedAt = snap.computed_at;
  }
  const departments = DD_DEPARTMENTS.map((dept) => cards.get(dept.dept_key) as DirectorDeptCard);
  return { farmToday, nowIso, config, departments, totalTiles: registry.length, questions };
}

/** The period a cadence's tiles show: the stepper's day on that cadence's tab, the farm today otherwise. */
function dayForCadence(cadence: DdCadence, farmToday: string, tab: DdCadence | null, periodDay: string | null): string {
  return tab === cadence && periodDay ? periodDay : farmToday;
}

function buildTile(kpi: DdKpi, model: Pick<DirectorWallModel, "farmToday" | "nowIso" | "cadence" | "periodDay" | "config">, values: Map<string, DdSnapshot>): DirectorTile {
  const periodKind = ddPeriodKindOf(kpi.cadence);
  const day = dayForCadence(kpi.cadence, model.farmToday, model.cadence, model.periodDay);
  const periodStart = periodStartFor(periodKind, day, { seasonStartDate: model.config.seasonStartDate, seasonStartMd: kpi.season_start_md });
  const history: DdHistoryPoint[] = [];
  for (let back = model.config.historyPeriods - 1; back >= 0; back -= 1) {
    const start = periodShift(periodKind, periodStart, -back);
    const snap = values.get(`${kpi.kpi_key}|${periodKind}|${start}`);
    if (snap) history.push({ period_start: start, value: snap.value });
  }
  const snapshot = values.get(`${kpi.kpi_key}|${periodKind}|${periodStart}`) ?? null;
  const inSeason = ddInSeason(kpi, model.farmToday);
  return { kpi, periodKind, periodStart, inSeason, status: ddTileStatus(kpi, snapshot, inSeason, model.nowIso), snapshot, history, companions: [] };
}

/** A wall: one batch (registry, the wall's live rows over the widest history window, config); tiles grouped by
 * cadence in the registry's order, companions inside their headline tile. */
export async function loadDirectorWall(
  db: D1Database,
  dept: DdDeptKey,
  farmToday: string,
  cadence?: string | null,
  period?: string | null,
  nowIso: string = new Date().toISOString()
): Promise<DirectorWallModel> {
  const tab = isDdCadence(cadence) ? cadence : null;
  const periodDay = period && isCalendarDate(period) ? period : null;
  const bounds: Array<string | null> = [];
  for (const kind of DD_CADENCES) {
    const periodKind = ddPeriodKindOf(kind);
    const day = dayForCadence(kind, farmToday, tab, periodDay);
    // The widest window the config allows; the configured history is cut in code once the config row is read in the same batch.
    const newest = periodStartFor(periodKind, day, {});
    bounds.push(periodShift(periodKind, newest, -(DD_HISTORY_PERIODS_MAX - 1)), day);
  }
  const results = await db.batch([
    db.prepare(REGISTRY_SQL),
    db.prepare(WALL_VALUES_SQL).bind(`%,${dept},%`, ...bounds),
    configStatement(db),
    db.prepare(WALL_TARGETS_SQL).bind(`%,${dept},%`),
  ]);
  const registry = registryFromRows(resultsOf(results[0]));
  const values = new Map<string, DdSnapshot>();
  // The statement orders the winning source of a period last (DD_SOURCE_PRECEDENCE), so the last write wins.
  for (const row of resultsOf(results[1])) {
    const snap = snapshotFromRow(row);
    values.set(`${snap.kpi_key}|${snap.period_kind}|${snap.period_start}`, snap);
  }
  const config = pageConfigFrom(resultsOf(results[2]));
  const title = DD_DEPARTMENTS.find((row) => row.dept_key === dept)?.title_en ?? dept;
  const base = { farmToday, nowIso, cadence: tab, periodDay, config };
  const rows = ddKpisForWall(registry, dept);
  const onWall = new Set(rows.map((row) => row.kpi_key));
  const tiles = new Map<string, DirectorTile>();
  const headlines: DirectorTile[] = [];
  for (const kpi of rows) {
    const tile = buildTile(kpi, base, values);
    tiles.set(kpi.kpi_key, tile);
    if (!(kpi.companion_of && onWall.has(kpi.companion_of))) headlines.push(tile);
  }
  for (const kpi of rows) {
    if (!kpi.companion_of || !onWall.has(kpi.companion_of)) continue;
    const headline = tiles.get(kpi.companion_of);
    const tile = tiles.get(kpi.kpi_key);
    if (headline && tile) headline.companions.push(tile);
  }
  const targets = resultsOf(results[3]).map(targetFromRow);
  for (const tile of tiles.values()) fillWallGoal(tile, targets, nowIso);
  const groups: DirectorWallGroup[] = [];
  for (const kind of DD_CADENCES) {
    const members = headlines.filter((tile) => tile.kpi.cadence === kind);
    if (members.length === 0) continue;
    const periodKind = ddPeriodKindOf(kind);
    const day = dayForCadence(kind, farmToday, tab, periodDay);
    groups.push({ cadence: kind, periodKind, periodStart: periodStartFor(periodKind, day, { seasonStartDate: config.seasonStartDate }), tiles: members });
  }
  return { dept, title_en: title, farmToday, nowIso, cadence: tab, periodDay, config, cadences: groups.map((group) => group.cadence), groups, tileCount: rows.length };
}

function fixed(n: number, decimals: number): string {
  return n.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

/** A value in its unit's shape: whole dollars with separators, one decimal percent, whole counts, two decimal scores and ratios, one decimal otherwise. */
export function ddFormatValue(unit: DdUnit, value: number | null, valueText: string | null = null): string {
  if (unit === "text") return valueText ?? "";
  if (value == null || !Number.isFinite(value)) return valueText ?? "";
  switch (unit) {
    case "usd":
      return `${value < 0 ? "-" : ""}$${fixed(Math.abs(Math.round(value)), 0)}`;
    case "pct":
      return `${fixed(value, 1)}%`;
    case "count":
    case "ea":
    case "g":
      return fixed(Math.round(value), 0);
    case "score":
    case "ratio":
      return fixed(value, 2);
    default:
      return fixed(value, 1);
  }
}

function signed(unit: DdUnit, delta: number): string {
  const text = ddFormatValue(unit, Math.abs(delta));
  return `${delta < 0 ? "-" : "+"}${text}`;
}

/** The sparkline: one polyline over the history points that carry a number, the newest ringed; an empty box when none. */
export function ddSparklineSvg(history: readonly DdHistoryPoint[]): string {
  const points = history.filter((point) => point.value != null && Number.isFinite(point.value));
  const n = points.length;
  if (n === 0) return `<svg class="dd-spark dd-spark-empty" viewBox="0 0 120 32" preserveAspectRatio="none" aria-hidden="true" data-dd-spark-points="0"></svg>`;
  const values = points.map((point) => point.value as number);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min;
  const x = (i: number) => (n === 1 ? 60 : (i * 120) / (n - 1));
  const y = (value: number) => (span === 0 ? 16 : 28 - ((value - min) / span) * 24);
  const line = points.map((point, i) => `${x(i).toFixed(1)},${y(point.value as number).toFixed(1)}`).join(" ");
  const last = points[n - 1] as DdHistoryPoint;
  return `<svg class="dd-spark" viewBox="0 0 120 32" preserveAspectRatio="none" aria-hidden="true" data-dd-spark-points="${n}"><polyline points="${line}"/><circle cx="${x(n - 1).toFixed(1)}" cy="${y(last.value as number).toFixed(1)}" r="2"/></svg>`;
}

function kpiTitle(kpi: DdKpi, locale: Locale): string {
  return locale === "es" && kpi.title_es.trim() !== "" ? kpi.title_es : kpi.title_en;
}

function unitWord(unit: DdUnit, locale: Locale): string {
  if (unit === "usd" || unit === "pct" || unit === "text") return "";
  const word = DD_UNIT_WORDS[unit];
  return word ? t(locale, word) : "";
}

function hasValue(snapshot: DdSnapshot | null): snapshot is DdSnapshot {
  return snapshot != null && (snapshot.value != null || (snapshot.value_text != null && snapshot.value_text !== ""));
}

function valueHtml(tile: DirectorTile, locale: Locale, lbGrams: number): string {
  const snap = tile.snapshot;
  if (!hasValue(snap)) return "";
  const unit = tile.kpi.unit;
  const word = unitWord(unit, locale);
  const grams =
    unit === "lb448"
      ? ` <span class="dd-badge dd-badge-grams" title="${esc(t(locale, "Grams in one dashboard pound."))}" data-dd-lb-grams="${esc(lbGrams)}">${esc(lbGrams)} ${esc(t(locale, "g"))}</span>`
      : "";
  const shown = ddFormatValue(unit, snap.value, snap.value_text);
  return `<span class="dd-tile-value" data-dd-value="${esc(snap.value ?? snap.value_text ?? "")}">${esc(shown)}${word ? `<span class="dd-tile-unit">${esc(word)}</span>` : ""}${grams}</span>`;
}

function goalHtml(tile: DirectorTile, locale: Locale): string {
  const snap = tile.snapshot;
  if (!snap || snap.goal == null || snap.value == null) return "";
  const unit = tile.kpi.unit;
  const word = unitWord(unit, locale);
  const direction = tile.kpi.goal_direction;
  const delta = ddGoalDelta(direction, snap.value, snap.goal);
  const pct = snap.goal !== 0 ? ` (${delta < 0 ? "-" : "+"}${fixed(Math.abs((delta / Math.abs(snap.goal)) * 100), 1)}%)` : "";
  const bound = direction === "at_most" ? ` ${esc(t(locale, "at most"))}` : "";
  return `<span class="dd-tile-goal" data-dd-goal="${esc(snap.goal)}" data-dd-goal-direction="${esc(direction)}">
      <span>${esc(t(locale, "Goal"))}${bound} ${esc(ddFormatValue(unit, snap.goal))}${word ? ` ${esc(word)}` : ""}</span>
      <span>${esc(t(locale, "Variance"))} ${esc(signed(unit, delta))}${esc(pct)}</span>
    </span>`;
}

function badgeHtml(tile: DirectorTile, locale: Locale): string {
  return `<span class="dd-badge dd-badge-status dd-badge-${esc(tile.status)}">${esc(t(locale, DD_STATUS_WORDS[tile.status]))}</span>`;
}

function sourceHtml(tile: DirectorTile, locale: Locale): string {
  const snap = tile.snapshot;
  if (!snap) return "";
  const key = DD_SOURCE_WORDS[snap.source] ?? DD_SOURCE_WORDS[tile.kpi.source_kind] ?? "";
  const word = key ? t(locale, key) : snap.source;
  const asOf = etWallClock(snap.source_as_of ?? snap.computed_at);
  return `<span class="dd-badge dd-badge-source" data-dd-source="${esc(snap.source)}">${esc(word)}</span>
      <span class="dd-asof" data-dd-asof="${esc(snap.source_as_of ?? snap.computed_at)}">${esc(t(locale, "as of"))} ${esc(asOf)}</span>`;
}

function companionHtml(tile: DirectorTile, locale: Locale): string {
  const snap = tile.snapshot;
  const unit = tile.kpi.unit;
  const word = unitWord(unit, locale);
  const shown = hasValue(snap) ? `${ddFormatValue(unit, snap.value, snap.value_text)}${word ? ` ${word}` : ""}` : t(locale, DD_STATUS_WORDS[tile.status]);
  return `<li class="dd-companion${tile.inSeason ? "" : " dd-out"}" data-dd-kpi="${esc(tile.kpi.kpi_key)}" data-dd-status="${esc(tile.status)}" data-dd-cadence="${esc(tile.kpi.cadence)}" data-dd-period="${esc(tile.periodStart)}">
        <a class="dd-companion-title" href="${esc(directorKpiPath(tile.kpi.kpi_key))}">${esc(kpiTitle(tile.kpi, locale))}</a>
        <span class="dd-companion-value">${esc(shown)}</span>
      </li>`;
}

function tileHtml(tile: DirectorTile, group: DirectorWallGroup, locale: Locale, lbGrams: number): string {
  const kpi = tile.kpi;
  const stale = tile.status === "stale" ? `<span class="dd-stale-stripe" aria-hidden="true"></span>` : "";
  const question = kpi.open_question_en
    ? `<a class="dd-question" href="${esc(`${DIRECTOR_QUESTIONS_PATH}?kpi=${encodeURIComponent(kpi.kpi_key)}`)}" title="${esc(locale === "es" && kpi.open_question_es ? kpi.open_question_es : kpi.open_question_en)}" aria-label="${esc(t(locale, "Open question"))}" data-dd-question="${esc(kpi.kpi_key)}">?</a>`
    : "";
  const period = tile.periodStart !== group.periodStart ? `<span class="dd-tile-period">${esc(periodLabel(tile.periodKind, tile.periodStart, locale))}</span>` : "";
  const companions = tile.companions.length > 0 ? `<ul class="dd-companions">${tile.companions.map((row) => companionHtml(row, locale)).join("")}</ul>` : "";
  return `<article class="dd-tile dd-tile-${esc(tile.status)}${tile.inSeason ? "" : " dd-out"}${stale ? " dd-stale" : ""}" data-dd-kpi="${esc(kpi.kpi_key)}" data-dd-status="${esc(tile.status)}" data-dd-cadence="${esc(kpi.cadence)}" data-dd-period="${esc(tile.periodStart)}" data-dd-unit="${esc(kpi.unit)}">
      ${stale}
      <span class="dd-tile-head">
        <a class="dd-tile-title" href="${esc(directorKpiPath(kpi.kpi_key))}">${esc(kpiTitle(kpi, locale))}</a>
        <span class="dd-tile-flags">${question}<span class="dd-version" title="${esc(t(locale, "Definition version"))}" data-dd-version="${esc(kpi.def_version)}">v${esc(kpi.def_version)}</span></span>
      </span>
      ${valueHtml(tile, locale, lbGrams)}
      ${goalHtml(tile, locale)}
      <span class="dd-tile-meta">${badgeHtml(tile, locale)}${sourceHtml(tile, locale)}${period}</span>
      ${ddSparklineSvg(tile.history)}
      ${companions}
    </article>`;
}

/** A cadence tab offers entry when the wall has a hand or mixed row on it, companion rows included. */
function groupHasEntry(group: DirectorWallGroup): boolean {
  const rows = group.tiles.flatMap((tile) => [tile, ...tile.companions]);
  return rows.some((tile) => tile.kpi.source_kind === "hand" || tile.kpi.source_kind === "mixed");
}

function groupHtml(group: DirectorWallGroup, model: DirectorWallModel, locale: Locale): string {
  const prev = periodShift(group.periodKind, group.periodStart, -1);
  const next = periodShift(group.periodKind, group.periodStart, 1);
  const stepper = `<nav class="dd-stepper" aria-label="${esc(t(locale, "Period"))}">
        <a class="tab-link" href="${esc(directorWallPath(model.dept, group.cadence, prev))}" data-dd-step="prev">${esc(t(locale, "Previous period"))}</a>
        <a class="tab-link" href="${esc(directorWallPath(model.dept, group.cadence))}" data-dd-step="current">${esc(t(locale, "Current period"))}</a>
        <a class="tab-link" href="${esc(directorWallPath(model.dept, group.cadence, next))}" data-dd-step="next">${esc(t(locale, "Next period"))}</a>
      </nav>
      ${groupHasEntry(group) ? `<a class="tab-link dd-enter" href="${esc(directorGridPath(model.dept, group.cadence, group.periodStart))}" data-dd-enter="${esc(group.cadence)}">${esc(t(locale, "Enter this period"))}</a>` : ""}`;
  const tiles = group.tiles.map((tile) => tileHtml(tile, group, locale, model.config.lbGrams)).join("");
  return `<section class="dd-group" data-dd-group="${esc(group.cadence)}" data-dd-period="${esc(group.periodStart)}">
      <div class="dd-group-head">
        <h2>${esc(t(locale, DD_CADENCE_WORDS[group.cadence]))}</h2>
        <span class="dd-period" data-dd-period-label>${esc(periodLabel(group.periodKind, group.periodStart, locale))}</span>
        ${stepper}
      </div>
      <div class="dd-tiles">${tiles}</div>
    </section>`;
}

/** A department wall: the cadence tabs, one section per cadence (the chosen one alone on a tab) with its period stepper and tiles. */
export function directorWallPage(model: DirectorWallModel, locale: Locale = "en", cadenceTab?: DdCadence | null): string {
  const tab = cadenceTab === undefined ? model.cadence : cadenceTab;
  const tabs = [
    { href: directorWallPath(model.dept), key: "all", label: "All" },
    ...model.cadences.map((cadence) => ({ href: directorWallPath(model.dept, cadence), key: cadence, label: DD_CADENCE_WORDS[cadence] })),
  ];
  const shown = model.groups.filter((group) => !tab || group.cadence === tab);
  const groups = shown.map((group) => groupHtml(group, model, locale)).join("");
  return `<div class="dd-wall" data-dd-wall="${esc(model.dept)}" data-dd-day="${esc(model.farmToday)}" data-dd-tiles="${esc(model.tileCount)}">
    <h1>${esc(t(locale, model.title_en))}</h1>
    <p class="muted">${esc(t(locale, "Each tile reads its latest snapshot. Nothing is computed when the page loads."))}</p>
    ${tabBar(locale, tabs, tab ?? "all")}
    ${groups || `<p class="muted" data-dd-empty>${esc(t(locale, "No tiles on this wall."))}</p>`}
  </div>`;
}

/** The home: five department cards in the walls' order, each a link to its wall with the counts by status and the last computed time. */
export function directorHomePage(model: DirectorHomeModel, locale: Locale = "en"): string {
  const cards = model.departments
    .map((card) => {
      const counts = DD_TILE_STATUSES.map(
        (status) => `<span class="dd-count dd-count-${esc(status)}" data-dd-count="${esc(status)}"><b>${esc(card.counts[status])}</b> ${esc(t(locale, DD_STATUS_WORDS[status]))}</span>`
      ).join("");
      const last = card.lastComputedAt ? etWallClock(card.lastComputedAt) : t(locale, "Never");
      return `<a class="dd-card" href="${esc(`${DIRECTOR_PATH}/${card.dept_key}`)}" data-dd-dept="${esc(card.dept_key)}" data-dd-tiles="${esc(card.tiles)}">
        <span class="dd-card-title">${esc(t(locale, card.title_en))}</span>
        <span class="dd-card-tiles"><b>${esc(card.tiles)}</b> ${esc(t(locale, "own KPIs"))}</span>
        <span class="dd-card-counts">${counts}</span>
        <span class="dd-card-foot">${esc(t(locale, "Last computed"))}: <span data-dd-last="${esc(card.lastComputedAt ?? "")}">${esc(last)}</span></span>
      </a>`;
    })
    .join("");
  const q = model.questions;
  return `<h1>${esc(t(locale, "Director Dashboard"))}</h1>
    <p class="muted">${esc(t(locale, "Five walls, one per department. Each card counts the department's own KPIs by status and shows the last time a value was computed."))}</p>
    <div class="dd-cards" data-dd-home data-dd-day="${esc(model.farmToday)}" data-dd-tiles="${esc(model.totalTiles)}">${cards}</div>
    <p class="muted dd-questions" data-dd-questions-open="${esc(q.open)}" data-dd-questions-ruled="${esc(q.ruled)}" data-dd-questions-parked="${esc(q.parked)}">
      <a href="${DIRECTOR_QUESTIONS_PATH}">${esc(t(locale, "Questions"))}</a>
      <a href="${DIRECTOR_IMPORT_PATH}" data-dd-import>${esc(t(locale, "Import"))}</a>:
      ${esc(t(locale, "Open questions"))} ${esc(q.open)}. ${esc(t(locale, "Ruled"))} ${esc(q.ruled)}. ${esc(t(locale, "Parked"))} ${esc(q.parked)}.
    </p>`;
}

/* ----------------------------------------------------- DD S2a: hand entry */

/** The stations' person_id: actorForm sets it from the login, and the form is never trusted for anyone else. */
function personIdFrom(form: FormData): string | null {
  return textOrNull(form.get("person_id"));
}

/** Every dd_* app_config row, one statement, for the grid and the detail page. */
function ddConfigStatement(db: D1Database): D1PreparedStatement {
  const marks = DD_CONFIG_KEYS.map(() => "?").join(", ");
  return db.prepare(`SELECT key, value FROM app_config WHERE deleted_at IS NULL AND key IN (${marks})`).bind(...DD_CONFIG_KEYS);
}

function configMapFrom(rows: readonly Row[] | undefined): Map<string, string> {
  const map = new Map<string, string>();
  for (const row of rows ?? []) map.set(String(row.key), String(row.value ?? ""));
  return map;
}

function isHandEntry(source: DdSourceKind): boolean {
  return source === "hand" || source === "mixed";
}

/** '' always, plus the three farm codes when dims list farm. Every other kind stays the total in S2. */
export function ddAllowedDimKeys(kpi: Pick<DdKpi, "dims">): string[] {
  const parts = kpi.dims.split(",").map((part) => part.trim()).filter((part) => part !== "");
  const cells = [""];
  if (parts.includes("farm")) cells.push(...DD_FARM_DIMS);
  return cells;
}

/** The cells a hand or mixed row accepts. The grid, the target form, and the import all use ddAllowedDimKeys. */
export function ddEntryDims(dims: string): string[] {
  return ddAllowedDimKeys({ dims });
}

/** Dimensions S2a does not enter (strain, bucket, and the rest). Farm is entered as the three farms. */
export function ddOtherDims(dims: string): string[] {
  return dims.split(",").map((part) => part.trim()).filter((part) => part !== "" && part !== "farm");
}

function sourceRank(source: string): number {
  const at = DD_SOURCE_PRECEDENCE.indexOf(source);
  return at < 0 ? DD_SOURCE_PRECEDENCE.length : at;
}

export type DdStoredValue = {
  id: string;
  kpi_key: string;
  period_kind: string;
  period_start: string;
  dim_key: string;
  value: number | null;
  value_text: string | null;
  source: string;
  computed_at: string;
  def_version: number;
  superseded_at: string | null;
  reason: string | null;
};

function storedFromRow(row: Row): DdStoredValue {
  const num = (value: unknown) => {
    if (value == null) return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  };
  return {
    id: String(row.id ?? ""),
    kpi_key: String(row.kpi_key ?? ""),
    period_kind: String(row.period_kind ?? ""),
    period_start: String(row.period_start ?? ""),
    dim_key: String(row.dim_key ?? ""),
    value: num(row.value),
    value_text: row.value_text == null ? null : String(row.value_text),
    source: String(row.source ?? ""),
    computed_at: String(row.computed_at ?? ""),
    def_version: Number(row.def_version ?? 1),
    superseded_at: row.superseded_at == null ? null : String(row.superseded_at),
    reason: row.reason == null ? null : String(row.reason),
  };
}

/** The lower bound of a grid read: three periods behind the unconfigured start, and six seasons behind the year for a season. */
function gridLower(kind: PeriodKind, day: string): string {
  const rough = periodStartFor(kind, day, {});
  let lower = periodShift(kind, rough, -3);
  if (kind === "season") {
    const wide = periodShift("season", `${day.slice(0, 4)}-01-01`, -6);
    if (wide < lower) lower = wide;
  }
  return lower;
}

const GRID_VALUES_SQL = `SELECT id, kpi_key, period_kind, period_start, dim_key, value, value_text, source, computed_at, def_version
  FROM dd_kpi_values
  WHERE superseded_at IS NULL
    AND dim_key IN ('', 'PNN', 'ARL', 'PNS')
    AND kpi_key IN (SELECT kpi_key FROM dd_kpis WHERE active = 1 AND (',' || wall_keys || ',') LIKE ?)
    AND ((period_kind = 'day' AND period_start >= ? AND period_start <= ?)
      OR (period_kind = 'week' AND period_start >= ? AND period_start <= ?)
      OR (period_kind = 'month' AND period_start >= ? AND period_start <= ?)
      OR (period_kind = 'quarter' AND period_start >= ? AND period_start <= ?)
      OR (period_kind = 'season' AND period_start >= ? AND period_start <= ?))`;

export type DdGridHand = { id: string; value: number | null; value_text: string | null };

export type DdGridCell = {
  dim: string;
  locked: boolean;
  hand: DdGridHand | null;
  /** The previous period's winning live value, the input's placeholder. */
  previous: { value: number | null; value_text: string | null } | null;
  /** The winning live value of this period, shown on a locked cell. */
  live: { value: number | null; value_text: string | null; source: string } | null;
};

export type DdGridRow = { kpi: DdKpi; entry: boolean; otherDims: string[]; cells: DdGridCell[] };

export type DirectorGridModel = {
  dept: DdDeptKey;
  title_en: string;
  cadence: DdCadence;
  cadences: DdCadence[];
  periodDay: string;
  periodStart: string;
  prevStart: string;
  nextStart: string;
  farmToday: string;
  rows: DdGridRow[];
};

function winning(rows: readonly DdStoredValue[]): DdStoredValue | null {
  let best: DdStoredValue | null = null;
  for (const row of rows) {
    if (!best) {
      best = row;
      continue;
    }
    const rank = sourceRank(row.source) - sourceRank(best.source);
    if (rank < 0 || (rank === 0 && (row.computed_at > best.computed_at || (row.computed_at === best.computed_at && row.id > best.id)))) best = row;
  }
  return best;
}

function buildGridRows(kpis: readonly DdKpi[], values: readonly DdStoredValue[], periodKind: DdPeriodKind, periodStart: string, prevStart: string): DdGridRow[] {
  return kpis.map((kpi) => {
    const entry = isHandEntry(kpi.source_kind);
    const shown = ddAllowedDimKeys(kpi);
    const cells = shown.map((dim) => {
      const here = values.filter((row) => row.kpi_key === kpi.kpi_key && row.dim_key === dim && row.period_kind === periodKind && row.period_start === periodStart);
      const prior = values.filter((row) => row.kpi_key === kpi.kpi_key && row.dim_key === dim && row.period_kind === periodKind && row.period_start === prevStart);
      const handRow = here.find((row) => row.source === "hand") ?? null;
      const liveRow = winning(here);
      const prevRow = winning(prior);
      return {
        dim,
        locked: !entry,
        hand: handRow ? { id: handRow.id, value: handRow.value, value_text: handRow.value_text } : null,
        previous: prevRow ? { value: prevRow.value, value_text: prevRow.value_text } : null,
        live: liveRow ? { value: liveRow.value, value_text: liveRow.value_text, source: liveRow.source } : null,
      };
    });
    return { kpi, entry, otherDims: ddOtherDims(kpi.dims), cells };
  });
}

/** The entry grid: one batch (registry, live values for this period and the previous one, the dd_* config). */
export async function loadDirectorGrid(
  db: D1Database,
  dept: DdDeptKey,
  farmToday: string,
  cadenceRaw?: string | null,
  periodRaw?: string | null
): Promise<DirectorGridModel> {
  const requested = isDdCadence(cadenceRaw) ? cadenceRaw : null;
  const periodDay = periodRaw && isCalendarDate(periodRaw) ? periodRaw : null;
  const bounds: string[] = [];
  for (const cadence of DD_CADENCES) {
    // A period in the query applies to the named cadence, or to every cadence when the page is choosing the default.
    const day = periodDay && (requested === null || requested === cadence) ? periodDay : farmToday;
    const kind = ddPeriodKindOf(cadence);
    bounds.push(gridLower(kind, day), day);
  }
  const results = await db.batch([
    db.prepare(REGISTRY_SQL),
    db.prepare(GRID_VALUES_SQL).bind(`%,${dept},%`, ...bounds),
    ddConfigStatement(db),
  ]);
  const registry = registryFromRows(resultsOf(results[0]));
  const wall = ddKpisForWall(registry, dept);
  const cadences = DD_CADENCES.filter((cadence) => wall.some((row) => row.cadence === cadence));
  const cadence: DdCadence = requested ?? cadences[0] ?? "weekly";
  const config = pageConfigFrom(resultsOf(results[2]));
  const viewDay = periodDay && (requested === null || requested === cadence) ? periodDay : farmToday;
  const periodKind = ddPeriodKindOf(cadence);
  const periodStart = periodStartFor(periodKind, viewDay, { seasonStartDate: config.seasonStartDate });
  const prevStart = periodShift(periodKind, periodStart, -1);
  const nextStart = periodShift(periodKind, periodStart, 1);
  const values = resultsOf(results[1]).map(storedFromRow);
  const rows = buildGridRows(
    wall.filter((row) => row.cadence === cadence),
    values,
    periodKind,
    periodStart,
    prevStart
  );
  const title = DD_DEPARTMENTS.find((row) => row.dept_key === dept)?.title_en ?? dept;
  return { dept, title_en: title, cadence, cadences, periodDay: viewDay, periodStart, prevStart, nextStart, farmToday, rows };
}

function plainValue(unit: DdUnit, value: number | null, valueText: string | null): string {
  if (unit === "text") return valueText ?? "";
  if (value == null || !Number.isFinite(value)) return "";
  return String(value);
}

function shownValue(unit: DdUnit, value: number | null, valueText: string | null): string {
  if (unit === "text") return valueText ?? "";
  return ddFormatValue(unit, value, valueText);
}

function dimWord(dim: string, locale: Locale): string {
  return dim === "" ? t(locale, "Total") : dim;
}

function cellField(kpiKey: string, dim: string): string {
  return `cell:${kpiKey}|${dim}`;
}

function gridCellHtml(row: DdGridRow, cell: DdGridCell, locale: Locale): string {
  const kpi = row.kpi;
  const marker = `${kpi.kpi_key}|${cell.dim}`;
  const label = dimWord(cell.dim, locale);
  if (cell.locked) {
    const live = cell.live;
    const text = live ? shownValue(kpi.unit, live.value, live.value_text) : "";
    const sourceKey = live ? (DD_SOURCE_WORDS[live.source] ?? "") : "";
    const badge = live && sourceKey ? `<span class="dd-badge dd-badge-source" data-dd-source="${esc(live.source)}">${esc(t(locale, sourceKey))}</span>` : "";
    const empty = text === "" ? `<span class="muted">${esc(t(locale, "No snapshot yet"))}</span>` : esc(text);
    return `<td data-label="${esc(label)}"><span data-dd-cell="${esc(marker)}" data-dd-locked>${empty}${badge ? ` ${badge}` : ""}</span></td>`;
  }
  const value = cell.hand ? plainValue(kpi.unit, cell.hand.value, cell.hand.value_text) : "";
  const placeholder = cell.previous ? plainValue(kpi.unit, cell.previous.value, cell.previous.value_text) : "";
  const text = kpi.unit === "text";
  return `<td data-label="${esc(label)}"><input type="text" name="${esc(cellField(kpi.kpi_key, cell.dim))}" value="${esc(value)}" placeholder="${esc(placeholder)}" ${text ? `maxlength="80"` : `inputmode="decimal"`} autocomplete="off" data-dd-cell="${esc(marker)}"${text ? ` data-dd-text="1"` : ""}></td>`;
}

function gridRowHtml(row: DdGridRow, farmCols: boolean, locale: Locale): string {
  const kpi = row.kpi;
  const question = kpi.open_question_en
    ? `<a class="dd-question" href="${esc(`${DIRECTOR_QUESTIONS_PATH}?kpi=${encodeURIComponent(kpi.kpi_key)}`)}" title="${esc(locale === "es" && kpi.open_question_es ? kpi.open_question_es : kpi.open_question_en)}" data-dd-question="${esc(kpi.kpi_key)}">?</a>`
    : "";
  const byDim = new Map(row.cells.map((cell) => [cell.dim, cell]));
  const dims = [""].concat(farmCols ? [...DD_FARM_DIMS] : []);
  const cells = dims
    .map((dim) => {
      const cell = byDim.get(dim);
      if (!cell) return `<td class="dd-cell-na" data-label="${esc(dimWord(dim, locale))}"></td>`;
      return gridCellHtml(row, cell, locale);
    })
    .join("");
  const note =
    row.otherDims.length > 0
      ? `<td class="dd-note" data-label="${esc(t(locale, "Dimensions"))}">${esc(tFill(locale, "Not entered here: {dims}.", { dims: row.otherDims.join(", ") }))}</td>`
      : `<td class="dd-note" data-label="${esc(t(locale, "Dimensions"))}"></td>`;
  const unit = DD_UNIT_WORDS[kpi.unit];
  return `<tr data-dd-kpi="${esc(kpi.kpi_key)}" data-dd-entry="${row.entry ? "1" : "0"}">
      <th scope="row"><a href="${esc(directorKpiPath(kpi.kpi_key))}">${esc(kpiTitle(kpi, locale))}</a>${question}</th>
      <td data-label="${esc(t(locale, "Unit"))}">${unit ? esc(t(locale, unit)) : ""}</td>
      ${cells}
      ${note}
    </tr>`;
}

/** The entry grid: one row per KPI, inputs on hand and mixed rows, locked values on the rest. */
export function directorGridPage(model: DirectorGridModel, locale: Locale = "en", supervisor = "", ok: string | null = null, savedN: string | null = null): string {
  const tabs = model.cadences.map((cadence) => ({ href: directorGridPath(model.dept, cadence), key: cadence, label: DD_CADENCE_WORDS[cadence] }));
  if (!model.cadences.includes(model.cadence)) tabs.push({ href: directorGridPath(model.dept, model.cadence), key: model.cadence, label: DD_CADENCE_WORDS[model.cadence] });
  const farmCols = model.rows.some((row) => row.cells.some((cell) => cell.dim !== ""));
  const heads = [t(locale, "Total")].concat(farmCols ? [...DD_FARM_DIMS] : []);
  const banner =
    ok === "nochange"
      ? `<p class="banner ok" data-dd-notice="nochange">${esc(t(locale, "Nothing changed, nothing written."))}</p>`
      : ok === "saved"
        ? `<p class="banner ok" data-dd-notice="saved">${esc(tFill(locale, "Saved {n} values.", { n: savedN && /^\d+$/.test(savedN) ? savedN : "0" }))}</p>`
        : "";
  const body = model.rows.map((row) => gridRowHtml(row, farmCols, locale)).join("");
  const kind = ddPeriodKindOf(model.cadence);
  return `<div class="dd-grid-page">
    ${banner}
    <h1>${esc(t(locale, model.title_en))}</h1>
    <p class="muted">${esc(t(locale, "Type the hand figures for this period. A locked row fills from its source later."))}</p>
    ${tabs.length > 0 ? tabBar(locale, tabs, model.cadence) : ""}
    <form class="dd-grid" method="post" action="${esc(directorGridPath(model.dept, model.cadence, model.periodStart))}" data-dd-grid="${esc(model.dept)}" data-dd-cadence="${esc(model.cadence)}" data-dd-period="${esc(model.periodStart)}">
      <div class="dd-group-head">
        <h2>${esc(t(locale, DD_CADENCE_WORDS[model.cadence]))}</h2>
        <span class="dd-period">${esc(periodLabel(kind, model.periodStart, locale))}</span>
        <nav class="dd-stepper" aria-label="${esc(t(locale, "Period"))}">
          <a class="tab-link" href="${esc(directorGridPath(model.dept, model.cadence, model.prevStart))}" data-dd-step="prev">${esc(t(locale, "Previous period"))}</a>
          <a class="tab-link" href="${esc(directorGridPath(model.dept, model.cadence))}" data-dd-step="current">${esc(t(locale, "Current period"))}</a>
          <a class="tab-link" href="${esc(directorGridPath(model.dept, model.cadence, model.nextStart))}" data-dd-step="next">${esc(t(locale, "Next period"))}</a>
        </nav>
      </div>
      <table class="dd-grid-table">
        <thead><tr>
          <th>${esc(t(locale, "KPI"))}</th>
          <th>${esc(t(locale, "Unit"))}</th>
          ${heads.map((head) => `<th>${esc(head)}</th>`).join("")}
          <th>${esc(t(locale, "Dimensions"))}</th>
        </tr></thead>
        <tbody>${body || `<tr><td colspan="${3 + heads.length}">${esc(t(locale, "No tiles on this wall."))}</td></tr>`}</tbody>
      </table>
      <label class="field">${esc(t(locale, "Reason"))}
        <input type="text" name="reason" required value="${esc(t(locale, "Weekly entry"))}" autocomplete="off" data-dd-reason>
      </label>
      <p class="muted supervisor-line" data-supervisor>${esc(t(locale, "Supervisor"))}: ${esc(supervisor)}</p>
      <button type="submit">${esc(t(locale, "Save"))}</button>
    </form>
  </div>`;
}

const PLAIN_NUMBER = /^-?\d+(\.\d+)?$/;

function entryRefusal(title: string, key: string): HttpError {
  return new HttpError(400, key.split("{title}").join(title), { key, vars: { title } });
}

function parseEntry(kpi: DdKpi, raw: string): { value: number | null; value_text: string | null } {
  if (kpi.unit === "text") return { value: null, value_text: raw };
  if (!PLAIN_NUMBER.test(raw)) throw entryRefusal(kpi.title_en, "{title} must be a plain number.");
  const n = Number(raw);
  if (!Number.isFinite(n)) throw entryRefusal(kpi.title_en, "{title} must be a plain number.");
  if (kpi.unit === "pct" && (n < 0 || n > 100)) throw entryRefusal(kpi.title_en, "{title} must be a percent from 0 to 100.");
  if (kpi.unit === "count" && !Number.isInteger(n)) throw entryRefusal(kpi.title_en, "{title} must be a whole number.");
  return { value: n, value_text: null };
}

function loggedValue(value: number | null, valueText: string | null): string | null {
  if (valueText != null && valueText !== "") return valueText;
  if (value == null || !Number.isFinite(value)) return null;
  return String(value);
}

function handIsBlank(hand: DdGridHand | null): boolean {
  return hand == null || (hand.value == null && (hand.value_text == null || hand.value_text === ""));
}

type PostedCell = { kpi_key: string; dim_key: string; raw: string };

function postedCells(form: FormData): PostedCell[] {
  const out: PostedCell[] = [];
  for (const [name, value] of form.entries()) {
    if (typeof value !== "string" || !name.startsWith("cell:")) continue;
    const body = name.slice("cell:".length);
    const pipe = body.indexOf("|");
    if (pipe < 0) continue;
    out.push({ kpi_key: body.slice(0, pipe), dim_key: body.slice(pipe + 1), raw: value.trim() });
  }
  return out;
}

type GridChange = {
  kpi: DdKpi;
  dim: string;
  clear: boolean;
  hand: DdGridHand | null;
  value: number | null;
  value_text: string | null;
};

/** POST the grid. A posted locked cell is ignored. Nothing changed writes nothing. */
export async function saveDirectorGrid(
  db: D1Database,
  dept: DdDeptKey,
  cadenceRaw: string | null,
  periodRaw: string | null,
  farmToday: string,
  form: FormData,
  now: string = new Date().toISOString()
): Promise<{ redirect: string }> {
  const actor = await requireActor(db, personIdFrom(form));
  const reason = requireReason(textOrNull(form.get("reason")));
  const model = await loadDirectorGrid(db, dept, farmToday, cadenceRaw, periodRaw);
  const byKey = new Map(model.rows.map((row) => [row.kpi.kpi_key, row]));
  const changes: GridChange[] = [];
  for (const posted of postedCells(form)) {
    const row = byKey.get(posted.kpi_key);
    if (!row || !row.entry) continue;
    const cell = row.cells.find((item) => item.dim === posted.dim_key && !item.locked);
    if (!cell) continue;
    if (posted.raw === "") {
      if (handIsBlank(cell.hand)) continue;
      changes.push({ kpi: row.kpi, dim: cell.dim, clear: true, hand: cell.hand, value: null, value_text: null });
      continue;
    }
    const parsed = parseEntry(row.kpi, posted.raw);
    if (row.kpi.unit === "text") {
      if ((cell.hand?.value_text ?? "") === posted.raw && cell.hand) continue;
      if (!cell.hand && posted.raw === "") continue;
    } else if (cell.hand && cell.hand.value != null && parsed.value != null && Math.abs(cell.hand.value - parsed.value) < 1e-9) {
      continue;
    }
    changes.push({ kpi: row.kpi, dim: cell.dim, clear: false, hand: cell.hand, value: parsed.value, value_text: parsed.value_text });
  }
  const back = directorGridPath(model.dept, model.cadence, model.periodStart);
  const join = back.includes("?") ? "&" : "?";
  if (changes.length === 0) return { redirect: `${back}${join}ok=nochange` };
  const kind = ddPeriodKindOf(model.cadence);
  const stmts: D1PreparedStatement[] = [];
  for (const change of changes) {
    const recordId = change.clear ? (change.hand?.id as string) : crypto.randomUUID();
    if (change.hand) {
      stmts.push(
        db.prepare(`UPDATE dd_kpi_values SET superseded_at = ? WHERE id = ? AND source = 'hand' AND superseded_at IS NULL`).bind(now, change.hand.id)
      );
    }
    if (!change.clear) {
      stmts.push(
        db
          .prepare(
            `INSERT INTO dd_kpi_values (
              id, kpi_key, period_kind, period_start, dim_key, value, value_text, goal, n, source, source_as_of, computed_at, def_version, superseded_at, entered_by, reason, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, NULL, 'hand', NULL, ?, ?, NULL, ?, ?, ?)`
          )
          .bind(
            recordId,
            change.kpi.kpi_key,
            kind,
            model.periodStart,
            change.dim,
            change.value,
            change.value_text,
            now,
            change.kpi.def_version,
            actor.id,
            reason,
            now
          )
      );
    }
    stmts.push(
      insertLog(db, {
        record_table: "dd_kpi_values",
        record_id: recordId,
        field: "value",
        old_value: change.hand ? loggedValue(change.hand.value, change.hand.value_text) : null,
        new_value: change.clear ? null : loggedValue(change.value, change.value_text),
        actor_person_id: actor.id,
        reason,
        changed_at: now,
      })
    );
  }
  await db.batch(stmts);
  return { redirect: `${back}${join}ok=saved&n=${changes.length}` };
}

export type DdDetailQuestion = { status: string; ruling: string | null; question_en: string; question_es: string };

export type DdDetailLog = {
  id: string;
  old_value: string | null;
  new_value: string | null;
  reason: string;
  changed_at: string;
  period_kind: string;
  period_start: string;
  dim_key: string;
  actor_name: string;
};

export type DirectorDetailModel = {
  kpi: DdKpi;
  configValue: string | null;
  question: DdDetailQuestion | null;
  periodKind: DdPeriodKind;
  periods: string[];
  rows: DdStoredValue[];
  logs: DdDetailLog[];
  targets: DdTarget[];
  farmToday: string;
};

const DETAIL_KPI_SQL = `SELECT k.kpi_key, k.dept_key, k.wall_keys, k.title_en, k.title_es, k.unit, k.cadence, k.season_start_md, k.season_end_md, k.dims,
    k.goal_kind, k.goal_ref, k.goal_direction, k.compute_key, k.source_kind, k.stale_after_hours, k.status, k.def_version, k.open_question_en, k.open_question_es,
    k.config_key, k.companion_of, k.workbook_rows, k.sort, k.active,
    q.ruling AS question_ruling, q.status AS question_status, q.question_en AS question_en_row, q.question_es AS question_es_row, c.value AS config_value
  FROM dd_kpis k
  LEFT JOIN dd_kpi_questions q ON k.config_key IS NOT NULL AND k.config_key != '' AND q.config_key = k.config_key
  LEFT JOIN app_config c ON c.deleted_at IS NULL AND k.config_key IS NOT NULL AND k.config_key != '' AND c.key = k.config_key
  WHERE k.kpi_key = ? AND k.active = 1`;

const DETAIL_COUNT_SQL = `SELECT COUNT(*) AS n FROM dd_kpis WHERE active = 1`;

const DETAIL_VALUES_SQL = `SELECT id, kpi_key, period_kind, period_start, dim_key, value, value_text, source, computed_at, def_version, superseded_at, reason
  FROM dd_kpi_values
  WHERE kpi_key = ? AND period_start >= ? AND period_start <= ?
  ORDER BY period_start, dim_key, source, computed_at, id`;

const DETAIL_LOG_SQL = `SELECT l.id, l.old_value, l.new_value, l.reason, l.changed_at,
    v.period_kind AS period_kind, v.period_start AS period_start, v.dim_key AS dim_key, p.display_name AS actor_name
  FROM record_change_log l
  LEFT JOIN dd_kpi_values v ON v.id = l.record_id
  LEFT JOIN people p ON p.id = l.actor_person_id
  WHERE l.record_table = 'dd_kpi_values'
    AND l.record_id IN (SELECT id FROM dd_kpi_values WHERE kpi_key = ?)
  ORDER BY l.changed_at DESC, l.id DESC
  LIMIT 100`;

const DETAIL_TARGETS_SQL = `SELECT id, kpi_key, dim_key, period_kind, effective_from, target, low, high, phasing, note, deleted_at
  FROM dd_targets
  WHERE kpi_key = ? AND deleted_at IS NULL
  ORDER BY effective_from, dim_key, period_kind, id`;

function questionFrom(row: Row | undefined): { question: DdDetailQuestion | null; configValue: string | null } {
  if (!row) return { question: null, configValue: null };
  const configValue = row.config_value == null ? null : String(row.config_value);
  if (row.question_status == null && row.question_ruling == null && row.question_en_row == null) return { question: null, configValue };
  return {
    question: {
      status: String(row.question_status ?? ""),
      ruling: row.question_ruling == null ? null : String(row.question_ruling),
      question_en: String(row.question_en_row ?? ""),
      question_es: String(row.question_es_row ?? ""),
    },
    configValue,
  };
}

/** The KPI detail: one batch (the registry row and its question, the dd_* config, the value history, the change log, the live targets). */
export async function loadDirectorDetail(db: D1Database, kpiKey: string, farmToday: string): Promise<DirectorDetailModel> {
  const lower = periodShift("season", `${farmToday.slice(0, 4)}-01-01`, -(DD_HISTORY_PERIODS_MAX - 1));
  const results = await db.batch([
    db.prepare(DETAIL_KPI_SQL).bind(kpiKey),
    db.prepare(DETAIL_COUNT_SQL),
    ddConfigStatement(db),
    db.prepare(DETAIL_VALUES_SQL).bind(kpiKey, lower, farmToday),
    db.prepare(DETAIL_LOG_SQL).bind(kpiKey),
    db.prepare(DETAIL_TARGETS_SQL).bind(kpiKey),
  ]);
  const kpiRows = resultsOf(results[0]);
  const active = Number(resultsOf(results[1])[0]?.n ?? 0);
  let kpi: DdKpi | null = kpiRows[0] ? kpiFromRegistryRow(kpiRows[0]) : null;
  let question = questionFrom(kpiRows[0]);
  if (!kpi && active === 0) {
    kpi = DD_KPIS.find((row) => row.kpi_key === kpiKey && row.active === 1) ?? null;
    question = { question: null, configValue: null };
  }
  if (!kpi) throw new HttpError(404, "Unknown KPI.");
  const config = pageConfigFrom(resultsOf(results[2]));
  if (question.configValue == null && kpi.config_key) {
    const fromMap = configMapFrom(resultsOf(results[2])).get(kpi.config_key);
    if (fromMap != null) question = { question: question.question, configValue: fromMap };
  }
  const periodKind = ddPeriodKindOf(kpi.cadence);
  const current = periodStartFor(periodKind, farmToday, { seasonStartDate: config.seasonStartDate, seasonStartMd: kpi.season_start_md });
  const periods: string[] = [];
  for (let back = 0; back < config.historyPeriods; back += 1) periods.push(periodShift(periodKind, current, -back));
  const keep = new Set(periods);
  const rows = resultsOf(results[3]).map(storedFromRow).filter((row) => row.period_kind === periodKind && keep.has(row.period_start));
  const logs = resultsOf(results[4]).map((row) => ({
    id: String(row.id ?? ""),
    old_value: row.old_value == null ? null : String(row.old_value),
    new_value: row.new_value == null ? null : String(row.new_value),
    reason: String(row.reason ?? ""),
    changed_at: String(row.changed_at ?? ""),
    period_kind: String(row.period_kind ?? ""),
    period_start: String(row.period_start ?? ""),
    dim_key: String(row.dim_key ?? ""),
    actor_name: String(row.actor_name ?? ""),
  }));
  const targets = resultsOf(results[5]).map(targetFromRow);
  return { kpi, configValue: question.configValue, question: question.question, periodKind, periods, rows, logs, targets, farmToday };
}

function defRow(label: string, value: string, locale: Locale): string {
  return `<dt>${esc(t(locale, label))}</dt><dd>${esc(value)}</dd>`;
}

function historyCell(rows: readonly DdStoredValue[], source: string, unit: DdUnit, locale: Locale): string {
  const live = rows.filter((row) => row.source === source && row.superseded_at == null);
  if (live.length === 0) return "";
  return live
    .map((row) => {
      const dim = row.dim_key === "" ? t(locale, "Total") : row.dim_key;
      return `<span class="dd-hist-val"><span class="dd-hist-dim">${esc(dim)}</span> <span>${esc(shownValue(unit, row.value, row.value_text))}</span></span>`;
    })
    .join(" ");
}

function goalShown(unit: DdUnit, goal: number): string {
  if (unit === "text") return String(goal);
  return ddFormatValue(unit, goal);
}

/** The target in force for each dim that has one this period, and the variance where a live number exists too. */
function periodGoalCells(model: DirectorDetailModel, start: string, locale: Locale): { target: string; variance: string } {
  const kpi = model.kpi;
  const live = model.rows.filter((row) => row.period_start === start && row.superseded_at == null);
  const dims = new Set<string>();
  for (const row of live) dims.add(row.dim_key);
  for (const target of model.targets) {
    if (target.period_kind === model.periodKind && target.effective_from <= start) dims.add(target.dim_key);
  }
  const targets: string[] = [];
  const variances: string[] = [];
  for (const dim of [...dims].sort()) {
    const hit = targetInForce(model.targets, kpi.kpi_key, dim, model.periodKind, start);
    if (!hit) continue;
    const goal = phasedGoal(hit.target, hit.phasing, model.periodKind, start);
    const label = dim === "" ? t(locale, "Total") : dim;
    targets.push(`${label} ${goalShown(kpi.unit, goal)}`);
    const win = winning(live.filter((row) => row.dim_key === dim));
    if (win && win.value != null) variances.push(`${label} ${signed(kpi.unit, ddGoalDelta(kpi.goal_direction, win.value, goal))}`);
  }
  return { target: targets.join(" "), variance: variances.join(" ") };
}

function targetsBlock(model: DirectorDetailModel, locale: Locale): string {
  const kpi = model.kpi;
  const dims = ddAllowedDimKeys(kpi);
  const dimOptions = dims
    .map((dim) => `<option value="${esc(dim)}">${esc(dim === "" ? t(locale, "Total") : dim)}</option>`)
    .join("");
  const kindOptions = DD_PERIOD_KINDS.map(
    (kind) => `<option value="${esc(kind)}"${kind === model.periodKind ? " selected" : ""}>${esc(t(locale, kind))}</option>`
  ).join("");
  const rows =
    model.targets.length === 0
      ? `<tr><td colspan="9">${esc(t(locale, "No targets yet"))}</td></tr>`
      : model.targets
          .map((row) => {
            const label = row.dim_key === "" ? t(locale, "Total") : row.dim_key;
            return `<tr data-dd-target-row="${esc(row.id)}" data-dd-target-value="${esc(row.target)}">
              <td data-label="${esc(t(locale, "Dimension"))}">${esc(label)}</td>
              <td data-label="${esc(t(locale, "Period kind"))}">${esc(t(locale, row.period_kind))}</td>
              <td data-label="${esc(t(locale, "Effective from"))}">${esc(row.effective_from)}</td>
              <td data-label="${esc(t(locale, "Target"))}">${esc(goalShown(kpi.unit, row.target))}</td>
              <td data-label="${esc(t(locale, "Low"))}">${esc(row.low == null ? "" : goalShown(kpi.unit, row.low))}</td>
              <td data-label="${esc(t(locale, "High"))}">${esc(row.high == null ? "" : goalShown(kpi.unit, row.high))}</td>
              <td data-label="${esc(t(locale, "Phasing"))}">${esc(row.phasing ?? "")}</td>
              <td data-label="${esc(t(locale, "Note"))}">${esc(row.note ?? "")}</td>
              <td data-label="${esc(t(locale, "Void"))}">
                <form method="post" action="${esc(directorTargetVoidPath(row.id))}">
                  <input type="text" name="reason" required autocomplete="off" aria-label="${esc(t(locale, "Reason"))}">
                  <button type="submit">${esc(t(locale, "Void"))}</button>
                </form>
              </td>
            </tr>`;
          })
          .join("");
  return `<section data-dd-target>
    <h2>${esc(t(locale, "Targets"))}</h2>
    <table class="dd-detail-table">
      <thead><tr>
        <th>${esc(t(locale, "Dimension"))}</th>
        <th>${esc(t(locale, "Period kind"))}</th>
        <th>${esc(t(locale, "Effective from"))}</th>
        <th>${esc(t(locale, "Target"))}</th>
        <th>${esc(t(locale, "Low"))}</th>
        <th>${esc(t(locale, "High"))}</th>
        <th>${esc(t(locale, "Phasing"))}</th>
        <th>${esc(t(locale, "Note"))}</th>
        <th>${esc(t(locale, "Void"))}</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <form class="dd-target-form" method="post" action="${esc(directorTargetPostPath(kpi.kpi_key))}" data-dd-target-form>
      <h3>${esc(t(locale, "Add a target"))}</h3>
      <label class="field">${esc(t(locale, "Dimension"))}
        <select name="dim_key">${dimOptions}</select>
      </label>
      <label class="field">${esc(t(locale, "Period kind"))}
        <select name="period_kind">${kindOptions}</select>
      </label>
      <label class="field">${esc(t(locale, "Effective from"))}
        <input type="date" name="effective_from" required autocomplete="off">
      </label>
      <label class="field">${esc(t(locale, "Target"))}
        <input type="text" name="target" required inputmode="decimal" autocomplete="off">
      </label>
      <label class="field">${esc(t(locale, "Low"))}
        <input type="text" name="low" inputmode="decimal" autocomplete="off">
      </label>
      <label class="field">${esc(t(locale, "High"))}
        <input type="text" name="high" inputmode="decimal" autocomplete="off">
      </label>
      <label class="field">${esc(t(locale, "Phasing"))}
        <input type="text" name="phasing" autocomplete="off" placeholder="${esc(t(locale, "blank, flat, or weights"))}">
      </label>
      <label class="field">${esc(t(locale, "Note"))}
        <input type="text" name="note" autocomplete="off">
      </label>
      <label class="field">${esc(t(locale, "Reason"))}
        <input type="text" name="reason" required autocomplete="off">
      </label>
      <button type="submit">${esc(t(locale, "Save"))}</button>
    </form>
  </section>`;
}

/** The definition, the history with the target in force, the change log, and the targets block. */
export function directorDetailPage(model: DirectorDetailModel, locale: Locale = "en", ok: string | null = null): string {
  const kpi = model.kpi;
  const found = new Set(model.rows.map((row) => row.source));
  const sources = [...DD_SOURCE_PRECEDENCE.filter((source) => found.has(source)), ...[...found].filter((source) => !DD_SOURCE_PRECEDENCE.includes(source))];
  const season = kpi.season_start_md && kpi.season_end_md ? `${kpi.season_start_md} to ${kpi.season_end_md}` : t(locale, "All year");
  const statusWord = kpi.status === "live" ? t(locale, "Live") : t(locale, kpi.status === "needs_definition" ? "Needs definition" : "Parked");
  const sourceWord = DD_SOURCE_WORDS[kpi.source_kind] ? t(locale, DD_SOURCE_WORDS[kpi.source_kind]) : kpi.source_kind;
  const ruling = model.question?.ruling ?? "";
  const configLine = kpi.config_key ? `${kpi.config_key}${model.configValue != null ? ` = ${model.configValue}` : ""}` : "";
  const history = model.periods
    .map((start) => {
      const inPeriod = model.rows.filter((row) => row.period_start === start);
      const old = inPeriod.filter((row) => row.superseded_at != null);
      const earlier = old
        .map((row) => {
          const dim = row.dim_key === "" ? t(locale, "Total") : row.dim_key;
          const word = DD_SOURCE_WORDS[row.source] ? t(locale, DD_SOURCE_WORDS[row.source]) : row.source;
          return `<span><s>${esc(shownValue(kpi.unit, row.value, row.value_text))}</s> ${esc(word)} ${esc(dim)}</span>`;
        })
        .join(" ");
      const fold = old.length > 0 ? `<details><summary>${esc(t(locale, "Earlier values"))}</summary>${earlier}</details>` : "";
      const cells = sources
        .map((source) => {
          const word = DD_SOURCE_WORDS[source] ? t(locale, DD_SOURCE_WORDS[source]) : source;
          return `<td data-label="${esc(word)}">${historyCell(inPeriod, source, kpi.unit, locale)}</td>`;
        })
        .join("");
      const goal = periodGoalCells(model, start, locale);
      return `<tr data-dd-history-row="${esc(start)}">
          <th scope="row">${esc(periodLabel(model.periodKind, start, locale))}</th>
          ${cells}
          <td data-label="${esc(t(locale, "Target"))}">${esc(goal.target)}</td>
          <td data-label="${esc(t(locale, "Variance"))}">${esc(goal.variance)}</td>
          <td data-label="${esc(t(locale, "Earlier values"))}">${fold}</td>
        </tr>`;
    })
    .join("");
  const logs =
    model.logs.length === 0
      ? `<tr><td colspan="7">${esc(t(locale, "No changes yet"))}</td></tr>`
      : model.logs
          .map((row) => {
            const period = row.period_start ? periodLabel((row.period_kind || model.periodKind) as PeriodKind, row.period_start, locale) : "";
            const dim = row.period_start ? (row.dim_key === "" ? t(locale, "Total") : row.dim_key) : "";
            return `<tr data-dd-log-row>
              <td data-label="${esc(t(locale, "When"))}">${esc(etWallClock(row.changed_at))}</td>
              <td data-label="${esc(t(locale, "Period"))}">${esc(period)}</td>
              <td data-label="${esc(t(locale, "Dimension"))}">${esc(dim)}</td>
              <td data-label="${esc(t(locale, "Who"))}">${esc(row.actor_name)}</td>
              <td data-label="${esc(t(locale, "Old value"))}">${esc(row.old_value ?? "")}</td>
              <td data-label="${esc(t(locale, "New value"))}">${esc(row.new_value ?? "")}</td>
              <td data-label="${esc(t(locale, "Reason"))}">${esc(row.reason)}</td>
            </tr>`;
          })
          .join("");
  const banner =
    ok === "target"
      ? `<p class="banner ok" data-dd-notice="target">${esc(t(locale, "Target saved."))}</p>`
      : ok === "voided"
        ? `<p class="banner ok" data-dd-notice="voided">${esc(t(locale, "Target voided."))}</p>`
        : "";
  const sourceHeads = sources
    .map((source) => `<th>${esc(DD_SOURCE_WORDS[source] ? t(locale, DD_SOURCE_WORDS[source]) : source)}</th>`)
    .join("");
  return `<div class="dd-detail" data-dd-detail="${esc(kpi.kpi_key)}">
    ${banner}
    <h1>${esc(kpiTitle(kpi, locale))}</h1>
    <dl class="dd-def">
      ${defRow("Unit", DD_UNIT_WORDS[kpi.unit] ? t(locale, DD_UNIT_WORDS[kpi.unit]) : kpi.unit, locale)}
      ${defRow("Cadence", t(locale, DD_CADENCE_WORDS[kpi.cadence]), locale)}
      ${defRow("Season window", season, locale)}
      ${defRow("Dimensions", kpi.dims === "" ? t(locale, "Total") : kpi.dims, locale)}
      ${defRow("Goal kind", kpi.goal_kind, locale)}
      ${defRow("Goal ref", kpi.goal_ref ?? "", locale)}
      ${defRow("Source", sourceWord, locale)}
      ${defRow("Status", statusWord, locale)}
      ${defRow("Definition version", String(kpi.def_version), locale)}
      ${kpi.config_key ? defRow("Config key", configLine, locale) : ""}
      ${ruling ? defRow("Ruling", ruling, locale) : ""}
    </dl>
    <h2>${esc(t(locale, "History"))}</h2>
    <table class="dd-detail-table">
      <thead><tr><th>${esc(t(locale, "Period"))}</th>${sourceHeads}<th>${esc(t(locale, "Target"))}</th><th>${esc(t(locale, "Variance"))}</th><th>${esc(t(locale, "Earlier values"))}</th></tr></thead>
      <tbody>${history || `<tr><td>${esc(t(locale, "No history yet"))}</td></tr>`}</tbody>
    </table>
    ${targetsBlock(model, locale)}
    <h2>${esc(t(locale, "Change log"))}</h2>
    <table class="dd-detail-table">
      <thead><tr><th>${esc(t(locale, "When"))}</th><th>${esc(t(locale, "Period"))}</th><th>${esc(t(locale, "Dimension"))}</th><th>${esc(t(locale, "Who"))}</th><th>${esc(t(locale, "Old value"))}</th><th>${esc(t(locale, "New value"))}</th><th>${esc(t(locale, "Reason"))}</th></tr></thead>
      <tbody>${logs}</tbody>
    </table>
  </div>`;
}

function numOrNull(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function targetFromRow(row: Row): DdTarget {
  return {
    id: String(row.id ?? ""),
    kpi_key: String(row.kpi_key ?? ""),
    dim_key: String(row.dim_key ?? ""),
    period_kind: String(row.period_kind ?? ""),
    effective_from: String(row.effective_from ?? ""),
    target: Number(row.target ?? 0),
    low: numOrNull(row.low),
    high: numOrNull(row.high),
    phasing: row.phasing == null || String(row.phasing) === "" ? null : String(row.phasing),
    note: row.note == null || String(row.note) === "" ? null : String(row.note),
    deleted_at: row.deleted_at == null ? null : String(row.deleted_at),
  };
}

/** Where S1 left the snapshot goal blank, the total's target in force fills the goal line. goal_ref and goal_direction stay as they are. */
function fillWallGoal(tile: DirectorTile, targets: readonly DdTarget[], nowIso: string): void {
  const snap = tile.snapshot;
  if (!snap || snap.goal != null) return;
  const row = targetInForce(targets, tile.kpi.kpi_key, "", tile.periodKind, tile.periodStart);
  if (!row) return;
  snap.goal = phasedGoal(row.target, row.phasing, tile.periodKind, tile.periodStart);
  tile.status = ddTileStatus(tile.kpi, snap, tile.inSeason, nowIso);
}

function shareText(n: number): string {
  const rounded = Math.round(n * 1e8) / 1e8;
  const text = rounded.toFixed(8).replace(/0+$/, "").replace(/\.$/, "");
  return text === "" || text === "-0" ? "0" : text;
}

function normalizeShares(weights: number[]): string {
  const sum = weights.reduce((total, weight) => total + weight, 0);
  const shares = weights.map((weight) => weight / sum);
  const head = shares.slice(0, -1);
  const last = 1 - head.reduce((total, share) => total + share, 0);
  return [...head, last].map(shareText).join(",");
}

/**
 * Blank phasing means the target is already the period's number.
 * flat, or a weight list, means an annual number. flat is stored as the word.
 * Weights are stored as comma separated shares that sum to 1.
 * A day, quarter, or season target refuses any phasing. A month takes 12 weights, a week 52.
 */
export function parsePhasing(raw: string | null | undefined, periodKind: string): string | null {
  const text = String(raw ?? "").trim();
  if (text === "") return null;
  if (periodKind !== "week" && periodKind !== "month") throw new HttpError(400, "Phasing is refused on a day, quarter, or season target.");
  if (text === "flat") return "flat";
  const parts = text.split(",").map((part) => part.trim());
  const count = periodKind === "month" ? 12 : 52;
  if (parts.length !== count) {
    throw new HttpError(400, periodKind === "month" ? "A month target takes flat or 12 weights." : "A week target takes flat or 52 weights.");
  }
  if (parts.some((part) => !/^\d+(\.\d+)?$/.test(part))) throw new HttpError(400, "Phasing weights must be plain numbers, zero or more.");
  const weights = parts.map(Number);
  const sum = weights.reduce((total, weight) => total + weight, 0);
  const nearOne = Math.abs(sum - 1) <= 0.001;
  const nearHundred = Math.abs(sum - 100) <= 0.1;
  if (!nearOne && !nearHundred) throw new HttpError(400, "Phasing weights must sum to 1 or to 100.");
  return normalizeShares(weights);
}

/** The live row for this KPI, dim, and period kind whose effective_from is the latest on or before the period start. */
export function targetInForce(
  rows: readonly DdTarget[],
  kpiKey: string,
  dimKey: string,
  periodKind: string,
  periodStart: string
): DdTarget | null {
  let best: DdTarget | null = null;
  for (const row of rows) {
    if (row.deleted_at) continue;
    if (row.kpi_key !== kpiKey || row.dim_key !== dimKey || row.period_kind !== periodKind) continue;
    if (row.effective_from > periodStart) continue;
    if (!best || row.effective_from > best.effective_from || (row.effective_from === best.effective_from && row.id > best.id)) best = row;
  }
  return best;
}

/** Blank phasing returns the target. Otherwise the annual target times that period's share. Week 53 uses the 52nd share. */
export function phasedGoal(target: number, phasing: string | null | undefined, periodKind: string, periodStart: string): number {
  const text = String(phasing ?? "").trim();
  if (text === "") return target;
  if (text === "flat") {
    if (periodKind === "month") return target / 12;
    if (periodKind === "week") return target / 52;
    return target;
  }
  const shares = text.split(",").map((part) => Number(part.trim()));
  let index = 1;
  if (periodKind === "month") index = Number(periodStart.slice(5, 7));
  else if (periodKind === "week") {
    const week = isoWeekOf(periodStart).week;
    index = week >= 53 ? 52 : week;
  } else return target;
  const share = shares[index - 1];
  return share == null || !Number.isFinite(share) ? target : target * share;
}
