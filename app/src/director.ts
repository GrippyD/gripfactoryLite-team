/**
 * DD S1: the Director Dashboard. An Admin home of five department cards and
 * one wall per department, every tile a snapshot row in dd_kpi_values that the
 * crons write from S3 on. A GET reads in ONE db.batch and computes nothing:
 * the registry (dd_kpis, DD_KPIS when the table has no rows), the live values
 * for the periods on show, the question counts and the dd_* config the pages
 * read. KPI titles come from the registry rows (title_en, title_es); every
 * other word goes through t(). Raw values only through esc().
 */
import {
  DD_CADENCES,
  DD_CONFIG,
  DD_DEPARTMENTS,
  DD_DEPT_KEYS,
  DD_GOAL_DIRECTIONS,
  DD_HISTORY_PERIODS_MAX,
  DD_KPIS,
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
  type DdUnit,
} from "./directorregistry";
import { etWallClock, isCalendarDate, periodLabel, periodShift, periodStartFor } from "./farmday";
import { t, type Locale } from "./i18n";
import { esc, tabBar } from "./ui";

export const DIRECTOR_PATH = "/admin/director";

/** The questions page S2 builds; S1 links to it only. */
export const DIRECTOR_QUESTIONS_PATH = `${DIRECTOR_PATH}/questions`;

export function isDdDeptKey(value: string | null | undefined): value is DdDeptKey {
  return (DD_DEPT_KEYS as readonly string[]).includes(String(value ?? ""));
}

export function isDdCadence(value: string | null | undefined): value is DdCadence {
  return (DD_CADENCES as readonly string[]).includes(String(value ?? ""));
}

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
  const results = await db.batch([db.prepare(REGISTRY_SQL), db.prepare(WALL_VALUES_SQL).bind(`%,${dept},%`, ...bounds), configStatement(db)]);
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
        <span class="dd-companion-title">${esc(kpiTitle(tile.kpi, locale))}</span>
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
        <span class="dd-tile-title">${esc(kpiTitle(kpi, locale))}</span>
        <span class="dd-tile-flags">${question}<span class="dd-version" title="${esc(t(locale, "Definition version"))}" data-dd-version="${esc(kpi.def_version)}">v${esc(kpi.def_version)}</span></span>
      </span>
      ${valueHtml(tile, locale, lbGrams)}
      ${goalHtml(tile, locale)}
      <span class="dd-tile-meta">${badgeHtml(tile, locale)}${sourceHtml(tile, locale)}${period}</span>
      ${ddSparklineSvg(tile.history)}
      ${companions}
    </article>`;
}

function groupHtml(group: DirectorWallGroup, model: DirectorWallModel, locale: Locale): string {
  const prev = periodShift(group.periodKind, group.periodStart, -1);
  const next = periodShift(group.periodKind, group.periodStart, 1);
  const stepper = `<nav class="dd-stepper" aria-label="${esc(t(locale, "Period"))}">
        <a class="tab-link" href="${esc(directorWallPath(model.dept, group.cadence, prev))}" data-dd-step="prev">${esc(t(locale, "Previous period"))}</a>
        <a class="tab-link" href="${esc(directorWallPath(model.dept, group.cadence))}" data-dd-step="current">${esc(t(locale, "Current period"))}</a>
        <a class="tab-link" href="${esc(directorWallPath(model.dept, group.cadence, next))}" data-dd-step="next">${esc(t(locale, "Next period"))}</a>
      </nav>`;
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
        <span class="dd-card-tiles"><b>${esc(card.tiles)}</b> ${esc(t(locale, "tiles"))}</span>
        <span class="dd-card-counts">${counts}</span>
        <span class="dd-card-foot">${esc(t(locale, "Last computed"))}: <span data-dd-last="${esc(card.lastComputedAt ?? "")}">${esc(last)}</span></span>
      </a>`;
    })
    .join("");
  const q = model.questions;
  return `<h1>${esc(t(locale, "Director Dashboard"))}</h1>
    <p class="muted">${esc(t(locale, "Five walls, one per department. Each card counts the department's tiles by status and shows the last time a value was computed."))}</p>
    <div class="dd-cards" data-dd-home data-dd-day="${esc(model.farmToday)}" data-dd-tiles="${esc(model.totalTiles)}">${cards}</div>
    <p class="muted dd-questions" data-dd-questions-open="${esc(q.open)}" data-dd-questions-ruled="${esc(q.ruled)}" data-dd-questions-parked="${esc(q.parked)}">
      <a href="${DIRECTOR_QUESTIONS_PATH}">${esc(t(locale, "Questions"))}</a>:
      ${esc(t(locale, "Open questions"))} ${esc(q.open)}. ${esc(t(locale, "Ruled"))} ${esc(q.ruled)}. ${esc(t(locale, "Parked"))} ${esc(q.parked)}.
    </p>`;
}
