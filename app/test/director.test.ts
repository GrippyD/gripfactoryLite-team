import { describe, expect, it } from "vitest";
import {
  DD_CADENCE_WORDS,
  DD_SOURCE_WORDS,
  DD_STATUS_WORDS,
  DD_TILE_STATUSES,
  DD_UNIT_WORDS,
  DIRECTOR_PATH,
  ddFormatValue,
  ddGoalDelta,
  ddSparklineSvg,
  directorDetailPage,
  directorGridPage,
  directorHomePage,
  directorWallPage,
  ddAllowedDimKeys,
  loadDirectorDetail,
  loadDirectorGrid,
  loadDirectorHome,
  loadDirectorRegistry,
  loadDirectorWall,
  parsePhasing,
  phasedGoal,
  saveDirectorGrid,
  targetInForce,
  type DdTarget,
} from "../src/director";
import {
  commitDirectorImport,
  directorImportPage,
  directorQuestionsPage,
  inspectDdImport,
  loadDirectorImportContext,
  loadDirectorQuestions,
  ruleDirectorQuestion,
  saveDirectorTarget,
  voidDirectorTarget,
} from "../src/directors2b";
import { HttpError } from "../src/audit";
import { isoWeekOf, periodShift, periodStartFor } from "../src/farmday";
import { ADMIN_GROUPS, adminHomePage } from "../src/html";
import { DICT, t } from "../src/i18n";
import { backLinkFor } from "../src/nav";
import {
  DD_CADENCES,
  DD_CONFIG_DEFAULTS,
  DD_CONFIG_KEYS,
  DD_CONFIG_RULES,
  DD_DEPARTMENTS,
  DD_DEPT_KEYS,
  DD_GOAL_DIRECTIONS,
  DD_GOAL_KINDS,
  DD_KPIS,
  DD_QUESTIONS,
  DD_QUESTIONS_REASON,
  DD_SEED_AT,
  DD_SEED_ROWS_PER_INSERT,
  DD_SOURCE_KINDS,
  DD_SOURCE_PRECEDENCE,
  DD_STATUSES,
  DD_UNITS,
  ddConfigSeedSql,
  ddHistoryPeriods,
  ddInSeason,
  ddKpi,
  ddKpisForWall,
  ddLbGrams,
  ddPeriodKindOf,
  ddSeasonStartDate,
  ddSeedSql,
  type DdKpi,
} from "../src/directorregistry";
import { migratedDb } from "./migrated";

type Row = Record<string, unknown>;

const DASH = new RegExp("[" + String.fromCharCode(0x2013, 0x2014) + "]");

/** A dd_kpis row from the database in the registry's shape (the timestamps dropped). */
function kpiFromRow(row: Row): DdKpi {
  const text = (key: string) => (row[key] == null ? null : String(row[key]));
  const num = (key: string) => (row[key] == null ? null : Number(row[key]));
  return {
    kpi_key: String(row.kpi_key),
    dept_key: String(row.dept_key) as DdKpi["dept_key"],
    wall_keys: String(row.wall_keys),
    title_en: String(row.title_en),
    title_es: String(row.title_es),
    unit: String(row.unit) as DdKpi["unit"],
    cadence: String(row.cadence) as DdKpi["cadence"],
    season_start_md: text("season_start_md"),
    season_end_md: text("season_end_md"),
    dims: String(row.dims),
    goal_kind: String(row.goal_kind) as DdKpi["goal_kind"],
    goal_ref: text("goal_ref"),
    goal_direction: String(row.goal_direction) as DdKpi["goal_direction"],
    compute_key: text("compute_key"),
    source_kind: String(row.source_kind) as DdKpi["source_kind"],
    stale_after_hours: num("stale_after_hours"),
    status: String(row.status) as DdKpi["status"],
    def_version: Number(row.def_version),
    open_question_en: text("open_question_en"),
    open_question_es: text("open_question_es"),
    config_key: text("config_key"),
    companion_of: text("companion_of"),
    workbook_rows: text("workbook_rows"),
    sort: Number(row.sort),
    active: Number(row.active),
  };
}

async function migrationText(): Promise<string> {
  const fs = (await import("node:" + "fs")) as { readFileSync(path: URL, encoding: "utf8"): string };
  return fs.readFileSync(new URL("../migrations/0105_director_dashboard.sql", import.meta.url), "utf8");
}

describe("DD S1 migration 0105: the registry seed", () => {
  it("seeds the five departments in the walls' order", async () => {
    const m = await migratedDb();
    const rows = m.all(`SELECT dept_key, sort, active FROM dd_departments ORDER BY sort`);
    expect(rows.map((r) => r.dept_key)).toEqual(["bizops", "farmops", "culttech", "sales", "finance"]);
    expect(rows.map((r) => r.dept_key)).toEqual([...DD_DEPT_KEYS]);
    expect(rows.every((r) => r.active === 1)).toBe(true);
    expect(DD_DEPARTMENTS.map((d) => d.sort)).toEqual([10, 20, 30, 40, 50]);
    expect(m.all(`SELECT id FROM dd_department_people`)).toEqual([]);
  });

  it("seeds 73 dd_kpis rows with every field inside its list, no dash characters, and DD_KPIS equal to the rows", async () => {
    const m = await migratedDb();
    const rows = m.all(`SELECT * FROM dd_kpis ORDER BY sort`);
    expect(rows).toHaveLength(73);
    expect(DD_KPIS).toHaveLength(73);
    const keys = new Set(rows.map((r) => String(r.kpi_key)));
    expect(keys.size).toBe(73);
    const units = new Set<string>(DD_UNITS);
    const cadences = new Set<string>(DD_CADENCES);
    const statuses = new Set<string>(DD_STATUSES);
    const goalKinds = new Set<string>(DD_GOAL_KINDS);
    const sourceKinds = new Set<string>(DD_SOURCE_KINDS);
    const goalDirections = new Set<string>(DD_GOAL_DIRECTIONS);
    const depts = new Set<string>(DD_DEPT_KEYS);
    for (const row of rows) {
      const key = String(row.kpi_key);
      expect(depts.has(String(row.dept_key)), `${key} dept`).toBe(true);
      expect(units.has(String(row.unit)), `${key} unit`).toBe(true);
      expect(cadences.has(String(row.cadence)), `${key} cadence`).toBe(true);
      expect(statuses.has(String(row.status)), `${key} status`).toBe(true);
      expect(goalKinds.has(String(row.goal_kind)), `${key} goal kind`).toBe(true);
      expect(goalDirections.has(String(row.goal_direction)), `${key} goal direction`).toBe(true);
      // A row without a goal reads at least by default; at most is a choice a goal row makes.
      if (row.goal_kind === "none") expect(row.goal_direction, `${key} goal direction without a goal`).toBe("at_least");
      expect(sourceKinds.has(String(row.source_kind)), `${key} source kind`).toBe(true);
      expect(String(row.title_en).trim().length, `${key} title_en`).toBeGreaterThan(0);
      expect(String(row.title_es).trim().length, `${key} title_es`).toBeGreaterThan(0);
      expect(String(row.title_es) !== String(row.title_en), `${key} title_es is Spanish`).toBe(true);
      const walls = String(row.wall_keys).split(",");
      expect(walls.length, `${key} wall_keys`).toBeGreaterThan(0);
      for (const wall of walls) expect(depts.has(wall), `${key} wall ${wall}`).toBe(true);
      expect(walls.includes(String(row.dept_key)), `${key} shows on its own wall`).toBe(true);
      if (row.companion_of != null) expect(keys.has(String(row.companion_of)), `${key} companion_of`).toBe(true);
      if (row.config_key != null) expect((DD_CONFIG_KEYS as readonly string[]).includes(String(row.config_key)), `${key} config_key`).toBe(true);
      expect(Number(row.def_version)).toBe(1);
      expect(Number(row.active)).toBe(1);
      expect(row.created_at).toBe(DD_SEED_AT);
      expect(row.updated_at).toBe(DD_SEED_AT);
      // The season window is a pair of MM-DD or nothing.
      expect((row.season_start_md == null) === (row.season_end_md == null), `${key} season window`).toBe(true);
      if (row.season_start_md != null) expect(String(row.season_start_md)).toMatch(/^\d{2}-\d{2}$/);
      if (row.open_question_en != null) expect(String(row.open_question_es ?? "").length, `${key} open_question_es`).toBeGreaterThan(0);
      for (const [column, value] of Object.entries(row)) {
        if (typeof value === "string") expect(DASH.test(value), `${key} ${column} carries a dash`).toBe(false);
      }
    }
    // The amendments landed: the renames, the companions, the shared keys, the one parked row.
    expect(keys.has("harvest.ppp_dry_lb")).toBe(true);
    expect(keys.has("harvest.ppp_wet_lb")).toBe(true);
    expect(keys.has("harvest.ppp_lb")).toBe(false);
    expect(keys.has("bizops.batch_cycle_days")).toBe(true);
    expect(keys.has("bizops.lot_cycle_days")).toBe(false);
    expect(keys.has("finance.state_retail_sales_usd")).toBe(true);
    expect(keys.has("finance.retail_sell_through_usd")).toBe(false);
    expect(keys.has("bizops.moved_count")).toBe(true);
    expect(keys.has("bizops.harvest_wet_weight_lb")).toBe(false);
    const byKey = new Map(rows.map((r) => [String(r.kpi_key), r]));
    expect(byKey.get("harvest.wet_weight_lb")?.wall_keys).toBe("bizops,farmops");
    expect(byKey.get("harvest.ppp_wet_lb")?.companion_of).toBe("harvest.ppp_dry_lb");
    expect(byKey.get("bizops.moved_count")?.companion_of).toBe("bizops.shipments_count");
    expect(rows.filter((r) => r.status === "parked").map((r) => r.kpi_key)).toEqual(["culttech.contra_recompenses_usd"]);
    expect(rows.filter((r) => r.status === "needs_definition")).toHaveLength(0);
    // Lower is better on the days and cost per pound rows with a goal; every other row reads at least its goal.
    expect(rows.filter((r) => r.goal_direction === "at_most").map((r) => r.kpi_key)).toEqual([
      "bizops.lab_turnaround_days",
      "finance.close_days_late",
      "finance.all_in_cost_per_dry_lb",
      "finance.all_in_cost_per_bud_lb",
    ]);
    expect(m.get(`SELECT goal_direction AS d FROM dd_kpis WHERE kpi_key = 'harvest.wet_lb_per_dlh'`)?.d).toBe("at_least");
    expect(() =>
      m.run(
        `INSERT INTO dd_kpis (kpi_key, dept_key, wall_keys, title_en, title_es, unit, cadence, goal_kind, goal_direction, source_kind, status, sort, created_at, updated_at)
         VALUES ('x.z', 'bizops', 'bizops', 'X', 'X', 'days', 'daily', 'none', 'sideways', 'app', 'live', 1, ?, ?)`,
        DD_SEED_AT,
        DD_SEED_AT
      )
    ).toThrow();
    // The code fallback and the seed agree row for row, every field.
    expect(rows.map(kpiFromRow)).toEqual([...DD_KPIS]);
    // Every wall has tiles; the bizops wall has at least twenty.
    for (const dept of DD_DEPT_KEYS) expect(ddKpisForWall(DD_KPIS, dept).length, dept).toBeGreaterThan(0);
    expect(ddKpisForWall(DD_KPIS, "bizops").length).toBeGreaterThanOrEqual(20);
    expect(ddKpisForWall(DD_KPIS, "farmops").map((r) => r.kpi_key)).toContain("harvest.wet_weight_lb");
    expect(ddKpisForWall(DD_KPIS, "culttech").map((r) => r.kpi_key)).toContain("harvest.btr_pct");
    expect(ddKpisForWall(DD_KPIS, "sales").map((r) => r.kpi_key)).toContain("finance.ar_ap_aging_usd");
  });

  it("the migration carries ddSeedSql() and ddConfigSeedSql() verbatim, nine rows per INSERT at most", async () => {
    const sql = await migrationText();
    expect(sql.includes("\r")).toBe(false);
    expect(DASH.test(sql)).toBe(false);
    const seed = ddSeedSql();
    expect(sql).toContain(seed);
    expect(sql).toContain(ddConfigSeedSql());
    expect(DD_SEED_ROWS_PER_INSERT).toBe(9);
    const blocks = seed.split("INSERT OR IGNORE INTO ").filter((b) => b.trim().length > 0);
    expect(blocks).toHaveLength(Math.ceil(73 / 9) + Math.ceil(17 / 9));
    for (const block of blocks) {
      const tuples = block.split("\n").filter((line) => line.startsWith("  ("));
      expect(tuples.length).toBeGreaterThan(0);
      expect(tuples.length).toBeLessThanOrEqual(9);
    }
    // The seed is idempotent: applying it again changes nothing.
    const m = await migratedDb();
    for (const statement of seed.split(";\n").map((s) => s.trim()).filter((s) => s.length > 0)) m.run(statement);
    expect(m.get(`SELECT COUNT(*) AS n FROM dd_kpis`)?.n).toBe(73);
    expect(m.get(`SELECT COUNT(*) AS n FROM dd_kpi_questions`)?.n).toBe(17);
  });

  it("seeds the seventeen debates, sixteen ruled with the recommended value and one parked", async () => {
    const m = await migratedDb();
    const rows = m.all(`SELECT * FROM dd_kpi_questions ORDER BY created_at, id`);
    expect(rows).toHaveLength(17);
    expect(DD_QUESTIONS).toHaveLength(17);
    expect(rows.filter((r) => r.status === "ruled")).toHaveLength(16);
    expect(rows.filter((r) => r.status === "parked").map((r) => r.question_key)).toEqual(["contra_recompenses"]);
    const kpiKeys = new Set(m.all(`SELECT kpi_key FROM dd_kpis`).map((r) => String(r.kpi_key)));
    const byKey = new Map(rows.map((r) => [String(r.question_key), r]));
    for (const q of DD_QUESTIONS) {
      const row = byKey.get(q.question_key);
      expect(row, q.question_key).toBeTruthy();
      if (!row) continue;
      expect(row.id).toBe(q.id);
      expect(row.kpi_keys).toBe(q.kpi_keys);
      expect(row.config_key).toBe(q.config_key);
      expect(row.question_en).toBe(q.question_en);
      expect(row.question_es).toBe(q.question_es);
      expect(row.position_a).toBe(q.position_a);
      expect(row.position_b).toBe(q.position_b);
      expect(row.recommendation).toBe(q.recommendation);
      expect(row.default_value).toBe(q.default_value);
      expect(row.status).toBe(q.status);
      expect(String(row.question_es).length).toBeGreaterThan(0);
      expect(row.question_es).not.toBe(row.question_en);
      for (const key of String(row.kpi_keys).split(",")) expect(kpiKeys.has(key), `${q.question_key} names ${key}`).toBe(true);
      expect((DD_CONFIG_KEYS as readonly string[]).includes(String(row.config_key)), `${q.question_key} config_key`).toBe(true);
      expect(row.ruled_by).toBeNull();
      if (row.status === "ruled") {
        expect(row.ruling).toBe(q.default_value);
        expect(row.ruled_at).toBe(DD_SEED_AT);
        expect(row.reason).toBe(DD_QUESTIONS_REASON);
        // The ruling is the seeded config value.
        expect(DD_CONFIG_DEFAULTS[q.config_key as keyof typeof DD_CONFIG_DEFAULTS]).toBe(q.default_value);
      } else {
        expect(row.ruling).toBeNull();
        expect(row.ruled_at).toBeNull();
        expect(row.reason).toBeNull();
      }
      for (const value of Object.values(row)) if (typeof value === "string") expect(DASH.test(value)).toBe(false);
    }
    const keys = DD_QUESTIONS.map((q) => q.question_key);
    expect(keys).toEqual([
      "ppp_basis",
      "htd_start",
      "processed_lbs",
      "shipped_interco",
      "active_window",
      "order_vs_invoice_week",
      "all_in_cost_scope",
      "plan_source",
      "projected_basis",
      "moh",
      "product_life_cycle",
      "contra_recompenses",
      "retail_data_report",
      "market_penetration",
      "btr_formula",
      "week_definition",
      "lot_date_law",
    ]);
    // Every weekly row is under the week definition ruling.
    const weekly = DD_KPIS.filter((r) => r.cadence === "weekly").map((r) => r.kpi_key);
    expect(DD_QUESTIONS.find((q) => q.question_key === "week_definition")?.kpi_keys.split(",")).toEqual(weekly);
  });

  it("seeds the 25 app_config keys with the rulings as defaults, and DD_CONFIG_DEFAULTS equals them", async () => {
    const m = await migratedDb();
    expect(DD_CONFIG_KEYS).toHaveLength(25);
    const rows = m.all(`SELECT key, value, created_by, updated_by, deleted_at FROM app_config WHERE key LIKE 'dd_%' ORDER BY key`);
    expect(rows).toHaveLength(25);
    const seeded = Object.fromEntries(rows.map((r) => [String(r.key), String(r.value)]));
    expect(seeded).toEqual({ ...DD_CONFIG_DEFAULTS });
    expect(rows.every((r) => r.created_by === null && r.updated_by === null && r.deleted_at === null)).toBe(true);
    expect(seeded.dd_ppp_basis).toBe("dry");
    expect(seeded.dd_sales_htd_start_mmdd).toBe("04-01");
    expect(seeded.dd_processed_lbs_buckets).toBe("trim,cryo,prepack");
    expect(seeded.dd_shipped_includes_interco).toBe("0");
    expect(seeded.dd_sales_active_days).toBe("30");
    expect(seeded.dd_sales_week_basis).toBe("order");
    expect(seeded.dd_all_in_addback_gls).toBe("5570");
    expect(seeded.dd_plan_source).toBe("latest_final");
    expect(seeded.dd_projection_basis).toBe("estimates");
    expect(seeded.dd_moh_window_months).toBe("3");
    expect(seeded.dd_product_life_cycle_mode).toBe("batch_cycle");
    expect(seeded.dd_contra_recompenses_mode).toBe("parked");
    expect(seeded.dd_retail_report_source).toBe("state_cra_monthly");
    expect(seeded.dd_market_penetration_basis).toBe("doors");
    expect(seeded.dd_market_penetration_license_prefixes).toBe("");
    expect(seeded.dd_btr_formula).toBe("console_to_date");
    expect(seeded.dd_week_basis).toBe("iso");
    expect(seeded.dd_season_start_date).toBe("");
    expect(seeded.dd_lot_date_law).toBe("effective_date");
    expect(seeded.dd_close_target_business_days).toBe("10");
    expect(seeded.dd_plants_harvested_flag).toBe("finished");
    expect(seeded.dd_goal_wet_lb_per_dlh).toBe("");
    expect(seeded.dd_goal_trim_lb_per_dlh).toBe("");
    expect(seeded.dd_lb_grams).toBe("448");
    expect(seeded.dd_history_periods).toBe("8");
  });

  it("the parsers read the values the pages need and fall back on a missing or bad row", () => {
    expect(ddHistoryPeriods("8")).toBe(8);
    expect(ddHistoryPeriods("6")).toBe(6);
    expect(ddHistoryPeriods("52")).toBe(52);
    expect(ddHistoryPeriods("53")).toBe(8);
    expect(ddHistoryPeriods("0")).toBe(8);
    expect(ddHistoryPeriods("eight")).toBe(8);
    expect(ddHistoryPeriods(null)).toBe(8);
    expect(ddHistoryPeriods(undefined)).toBe(8);
    expect(ddLbGrams("448")).toBe(448);
    expect(ddLbGrams("453.6")).toBe(453.6);
    expect(ddLbGrams("0")).toBe(448);
    expect(ddLbGrams("-1")).toBe(448);
    expect(ddLbGrams("lb")).toBe(448);
    expect(ddLbGrams("")).toBe(448);
    expect(ddLbGrams(null)).toBe(448);
    expect(ddSeasonStartDate("2026-09-01")).toBe("2026-09-01");
    expect(ddSeasonStartDate(" 2026-09-01 ")).toBe("2026-09-01");
    expect(ddSeasonStartDate("")).toBeNull();
    expect(ddSeasonStartDate("2026-02-30")).toBeNull();
    expect(ddSeasonStartDate("09/01/2026")).toBeNull();
    expect(ddSeasonStartDate(null)).toBeNull();
    expect(ddPeriodKindOf("daily")).toBe("day");
    expect(ddPeriodKindOf("weekly")).toBe("week");
    expect(ddPeriodKindOf("monthly")).toBe("month");
    expect(ddPeriodKindOf("quarterly")).toBe("quarter");
    expect(ddPeriodKindOf("seasonal")).toBe("season");
  });

  it("a season window holds the farm day, wraps the year end, and is all year when unset", () => {
    const fall = { season_start_md: "10-01", season_end_md: "12-31" };
    expect(ddInSeason(fall, "2026-10-01")).toBe(true);
    expect(ddInSeason(fall, "2026-12-31")).toBe(true);
    expect(ddInSeason(fall, "2026-09-30")).toBe(false);
    expect(ddInSeason(fall, "2027-01-01")).toBe(false);
    const wrap = { season_start_md: "10-01", season_end_md: "01-31" };
    expect(ddInSeason(wrap, "2026-11-15")).toBe(true);
    expect(ddInSeason(wrap, "2027-01-31")).toBe(true);
    expect(ddInSeason(wrap, "2027-02-01")).toBe(false);
    expect(ddInSeason(wrap, "2026-06-15")).toBe(false);
    expect(ddInSeason({ season_start_md: null, season_end_md: null }, "2026-06-15")).toBe(true);
  });

  it("one live snapshot per key, period, dimension and source; a superseded row makes room for the restatement", async () => {
    const m = await migratedDb();
    const insert = (id: string, superseded: string | null) =>
      m.run(
        `INSERT INTO dd_kpi_values (id, kpi_key, period_kind, period_start, dim_key, value, source, computed_at, def_version, superseded_at, created_at)
         VALUES (?, 'harvest.wet_weight_lb', 'day', '2026-10-05', '', 1200, 'app', ?, 1, ?, ?)`,
        id,
        DD_SEED_AT,
        superseded,
        DD_SEED_AT
      );
    insert("v1", null);
    expect(() => insert("v2", null)).toThrow();
    m.run(`UPDATE dd_kpi_values SET superseded_at = ? WHERE id = 'v1'`, DD_SEED_AT);
    insert("v2", null);
    expect(m.get(`SELECT COUNT(*) AS n FROM dd_kpi_values WHERE superseded_at IS NULL`)?.n).toBe(1);
    // A target is unique per key, dimension, period kind and effective date while live.
    const target = (id: string, deleted: string | null) =>
      m.run(
        `INSERT INTO dd_targets (id, kpi_key, dim_key, period_kind, effective_from, target, created_at, updated_at, deleted_at)
         VALUES (?, 'harvest.wet_lb_per_dlh', '', 'day', '2026-09-01', 12.5, ?, ?, ?)`,
        id,
        DD_SEED_AT,
        DD_SEED_AT,
        deleted
      );
    target("t1", null);
    expect(() => target("t2", null)).toThrow();
    target("t3", DD_SEED_AT);
    // A bad unit, cadence or status is refused by the table itself.
    expect(() =>
      m.run(
        `INSERT INTO dd_kpis (kpi_key, dept_key, wall_keys, title_en, title_es, unit, cadence, goal_kind, source_kind, status, sort, created_at, updated_at)
         VALUES ('x.y', 'bizops', 'bizops', 'X', 'X', 'stone', 'daily', 'none', 'app', 'live', 1, ?, ?)`,
        DD_SEED_AT,
        DD_SEED_AT
      )
    ).toThrow();
    expect(() =>
      m.run(
        `INSERT INTO dd_phasing (id, scope_key, period_kind, period_index, share, created_at, updated_at) VALUES ('p1', 'revenue', 'day', 1, 0.1, ?, ?)`,
        DD_SEED_AT,
        DD_SEED_AT
      )
    ).toThrow();
  });
});

// The pages: one batch per GET, snapshots read as they are, the words in both locales.

const NOW = "2026-10-15T12:00:00.000Z";
const DAY = "2026-10-15";

type Counts = { batches: number; direct: number };

/** The test database behind a counter: batch() calls and every direct run(), first() or all() outside a batch. */
function countedDb(inner: D1Database): { db: D1Database; counts: Counts } {
  const counts: Counts = { batches: 0, direct: 0 };
  const targets = new WeakMap<object, object>();
  type Stmt = Record<string | symbol, unknown> & { bind: (...args: unknown[]) => Stmt };
  const wrap = (stmt: Stmt): Stmt => {
    const proxy = new Proxy(stmt, {
      get(target, prop) {
        if (prop === "bind") return (...args: unknown[]) => wrap(target.bind(...args));
        if (prop === "run" || prop === "first" || prop === "all") {
          return (...args: unknown[]) => {
            counts.direct += 1;
            return (target[prop] as (...a: unknown[]) => unknown)(...args);
          };
        }
        return target[prop];
      },
    });
    targets.set(proxy, stmt);
    return proxy;
  };
  const raw = inner as unknown as { prepare: (sql: string) => Stmt; batch: (stmts: object[]) => Promise<unknown[]> };
  const db = {
    prepare: (sql: string) => wrap(raw.prepare(sql)),
    batch: (stmts: object[]) => {
      counts.batches += 1;
      return raw.batch(stmts.map((stmt) => targets.get(stmt) ?? stmt));
    },
  };
  return { db: db as unknown as D1Database, counts };
}

type Fs = { readFileSync(path: URL, encoding: "utf8"): string };
async function source(name: string): Promise<string> {
  const fs = (await import("node:" + "fs")) as Fs;
  return fs.readFileSync(new URL(`../src/${name}`, import.meta.url), "utf8");
}

/** Every tile and companion row on a wall page: key, status, cadence. */
function tileMarkers(html: string): Array<{ key: string; status: string; cadence: string }> {
  return [...html.matchAll(/data-dd-kpi="([^"]+)" data-dd-status="([^"]+)" data-dd-cadence="([^"]+)"/g)].map((m) => ({
    key: m[1] as string,
    status: m[2] as string,
    cadence: m[3] as string,
  }));
}

/** 73 keys times 52 periods of the row's own kind, newest at the farm day, nine rows per INSERT. */
function seedFixture(m: Awaited<ReturnType<typeof migratedDb>>, computedAt: string): number {
  const rows: Array<Array<string | number | null>> = [];
  DD_KPIS.forEach((kpi, index) => {
    const kind = ddPeriodKindOf(kpi.cadence);
    const current = periodStartFor(kind, DAY, { seasonStartMd: kpi.season_start_md });
    for (let back = 0; back < 52; back += 1) {
      const start = periodShift(kind, current, -back);
      const text = kpi.unit === "text";
      // Every third key carries a goal it meets on even periods; the next has none; the third misses its goal.
      const goal = text ? null : index % 3 === 0 ? 120 : index % 3 === 2 ? 200 : null;
      const value = text ? null : 120 + (back % 2 === 0 ? 15 : -15) + (back % 5);
      rows.push([`fx_${kpi.kpi_key}_${start}`, kpi.kpi_key, kind, start, value, text ? `note ${back}` : null, goal, computedAt, computedAt]);
    }
  });
  let statements = 0;
  for (let at = 0; at < rows.length; at += 9) {
    const chunk = rows.slice(at, at + 9);
    const sql =
      `INSERT INTO dd_kpi_values (id, kpi_key, period_kind, period_start, dim_key, value, value_text, goal, source, source_as_of, computed_at, def_version, created_at) VALUES ` +
      chunk.map(() => `(?, ?, ?, ?, '', ?, ?, ?, 'app', NULL, ?, 1, ?)`).join(", ");
    m.run(sql, ...chunk.flat());
    statements += 1;
  }
  expect(rows).toHaveLength(3796);
  return statements;
}

describe("DD S1 pages: the home and the walls", () => {
  it("the home loads in one batch with no direct reads and spreads the 73 tiles over the five departments", async () => {
    const m = await migratedDb();
    const { db, counts } = countedDb(m.db);
    const model = await loadDirectorHome(db, DAY, NOW);
    expect(counts).toEqual({ batches: 1, direct: 0 });
    expect(model.departments.map((d) => d.dept_key)).toEqual([...DD_DEPT_KEYS]);
    expect(model.totalTiles).toBe(73);
    expect(model.departments.reduce((n, d) => n + d.tiles, 0)).toBe(73);
    for (const d of model.departments) {
      expect(d.tiles, d.dept_key).toBe(DD_KPIS.filter((row) => row.dept_key === d.dept_key).length);
      expect(DD_TILE_STATUSES.reduce((n, s) => n + d.counts[s], 0)).toBe(d.tiles);
      expect(d.counts.on_goal + d.counts.off_goal + d.counts.no_goal + d.counts.stale).toBe(0);
      expect(d.lastComputedAt).toBeNull();
    }
    expect(model.departments.find((d) => d.dept_key === "culttech")?.counts.parked).toBe(1);
    expect(model.departments.find((d) => d.dept_key === "bizops")?.counts.no_data).toBeGreaterThan(0);
    expect(model.questions).toEqual({ open: 0, ruled: 16, parked: 1 });
    expect(model.config).toEqual({ historyPeriods: 8, lbGrams: 448, seasonStartDate: null });
    // The registry read falls back to the code rows when the table has none.
    expect((await loadDirectorRegistry(m.db)).map((row) => row.kpi_key)).toEqual(DD_KPIS.map((row) => row.kpi_key));
    m.run(`UPDATE dd_kpis SET active = 0`);
    expect(await loadDirectorRegistry(m.db)).toEqual([...DD_KPIS]);
  });

  it("the home page carries five department cards in EN and ES, the ES page without an English status word", async () => {
    const m = await migratedDb();
    const model = await loadDirectorHome(m.db, DAY, NOW);
    const en = directorHomePage(model, "en");
    expect(en.match(/data-dd-dept="/g)).toHaveLength(5);
    expect(en).toContain(">Director Dashboard<");
    for (const dept of DD_DEPARTMENTS) {
      expect(en).toContain(`data-dd-dept="${dept.dept_key}"`);
      expect(en).toContain(`href="${DIRECTOR_PATH}/${dept.dept_key}"`);
      expect(en).toContain(`>${dept.title_en}<`);
    }
    for (const word of Object.values(DD_STATUS_WORDS)) expect(en).toContain(` ${word}<`);
    expect(en).toContain(">Never<");
    expect(en).toContain('data-dd-questions-ruled="16"');
    const es = directorHomePage(model, "es");
    expect(es.match(/data-dd-dept="/g)).toHaveLength(5);
    expect(es).toContain(">Tablero del director<");
    expect(es).toContain(">Operaciones de negocio<");
    for (const dept of DD_DEPARTMENTS) {
      expect(t("es", dept.title_en)).not.toBe(dept.title_en);
      expect(es).toContain(`>${t("es", dept.title_en)}<`);
    }
    for (const word of Object.values(DD_STATUS_WORDS)) expect(es, word).not.toContain(word);
    expect(es).not.toContain(">Never<");
    expect(es).toContain(">Nunca<");
  });

  it("the Admin home shows the Director Dashboard tile and a wall's crumb climbs to the dashboard home", () => {
    expect(adminHomePage("en")).toContain('data-admin-group="director"');
    expect(adminHomePage("es")).toContain("Tablero del director");
    const group = ADMIN_GROUPS.find((g) => g.key === "director");
    expect(group?.href).toBe(DIRECTOR_PATH);
    expect(group?.members.map((member) => member.href)).toEqual(DD_DEPT_KEYS.map((key) => `${DIRECTOR_PATH}/${key}`));
    expect(group?.members.map((member) => member.title)).toEqual(DD_DEPARTMENTS.map((dept) => dept.title_en));
    expect(backLinkFor("/admin/director/bizops")).toEqual({ href: "/admin/director", label: "Director Dashboard" });
    expect(backLinkFor("/admin/director")).toEqual({ href: "/admin", label: "Admin" });
  });

  it("a wall over empty snapshots renders every tile with a status: no data yet in season, out of season otherwise", async () => {
    const m = await migratedDb();
    const { db, counts } = countedDb(m.db);
    const model = await loadDirectorWall(db, "bizops", DAY, null, null, NOW);
    expect(counts).toEqual({ batches: 1, direct: 0 });
    const wallRows = ddKpisForWall(DD_KPIS, "bizops");
    expect(model.tileCount).toBe(wallRows.length);
    expect(model.tileCount).toBeGreaterThanOrEqual(20);
    const html = directorWallPage(model, "en");
    const markers = tileMarkers(html);
    expect(markers).toHaveLength(wallRows.length);
    expect(new Set(markers.map((x) => x.key)).size).toBe(wallRows.length);
    for (const marker of markers) {
      const row = ddKpi(marker.key);
      expect(row, marker.key).toBeTruthy();
      if (!row) continue;
      expect(marker.cadence).toBe(row.cadence);
      expect(marker.status, marker.key).toBe(ddInSeason(row, DAY) ? "no_data" : "out_of_season");
    }
    expect(markers.some((x) => x.status === "no_data")).toBe(true);
    const headlines = model.groups.reduce((n, group) => n + group.tiles.length, 0);
    expect(html.match(/data-dd-spark-points="0"/g)).toHaveLength(headlines);
    expect(html).toContain(">No data yet<");
    expect(html).not.toContain("data-dd-value=");
    // The cadence tabs: All plus every cadence on the wall, in the registry's order.
    expect(html).toContain('data-tab="all"');
    expect(model.cadences).toEqual(DD_CADENCES.filter((c) => wallRows.some((row) => row.cadence === c)));
    for (const cadence of model.cadences) expect(html).toContain(`data-tab="${cadence}"`);
    // The companion sits inside its headline tile.
    const headlineAt = html.indexOf('data-dd-kpi="bizops.shipments_count"');
    const companionAt = html.indexOf('data-dd-kpi="bizops.moved_count"');
    expect(headlineAt).toBeGreaterThan(-1);
    expect(companionAt).toBeGreaterThan(headlineAt);
    expect(html.slice(headlineAt, companionAt)).toContain('<ul class="dd-companions">');
    expect(html.slice(headlineAt, companionAt)).not.toContain("</article>");
    // The open question marker links to the questions page; the definition version reads v1.
    expect(html).toContain(`href="${DIRECTOR_PATH}/questions?kpi=`);
    expect(html).toContain('data-dd-version="1">v1<');
    // Spanish: the row's title_es, the status word, and no English status word.
    const es = directorWallPage(model, "es");
    const first = wallRows[0] as DdKpi;
    expect(es).toContain(`>${first.title_es}<`);
    expect(es).toContain(">Sin datos aun<");
    expect(es).toContain(">Operaciones de negocio<");
    expect(es).not.toContain("No data yet");
    expect(es).not.toContain("Out of season");
  });

  it("73 keys times 52 periods: one batch, values with goals and sparklines, under a second", async () => {
    const m = await migratedDb();
    const statements = seedFixture(m, NOW);
    expect(statements).toBe(Math.ceil(3796 / 9));
    expect(m.get(`SELECT COUNT(*) AS n FROM dd_kpi_values WHERE superseded_at IS NULL`)?.n).toBe(3796);
    const { db, counts } = countedDb(m.db);
    const started = performance.now();
    const model = await loadDirectorWall(db, "bizops", DAY, null, null, NOW);
    const html = directorWallPage(model, "en");
    const elapsed = performance.now() - started;
    expect(counts).toEqual({ batches: 1, direct: 0 });
    expect(elapsed).toBeLessThan(1000);
    const markers = tileMarkers(html);
    expect(markers).toHaveLength(model.tileCount);
    const statuses = new Set(markers.map((x) => x.status));
    expect(statuses.has("on_goal")).toBe(true);
    expect(statuses.has("off_goal")).toBe(true);
    expect(statuses.has("no_goal")).toBe(true);
    expect(statuses.has("no_data")).toBe(false);
    expect(statuses.has("stale")).toBe(false);
    for (const marker of markers) {
      const row = ddKpi(marker.key) as DdKpi;
      if (!ddInSeason(row, DAY)) expect(marker.status).toBe("out_of_season");
    }
    // Every headline tile shows the configured eight periods (a text row has no numbers to draw, so its box is
    // empty); six when dd_history_periods says six.
    const headlineTiles = model.groups.flatMap((group) => group.tiles);
    const headlines = headlineTiles.length;
    const textHeadlines = headlineTiles.filter((tile) => tile.kpi.unit === "text").length;
    const eight = [...html.matchAll(/data-dd-spark-points="(\d+)"/g)].map((x) => Number(x[1]));
    expect(eight).toHaveLength(headlines);
    expect(eight.filter((n) => n === 8)).toHaveLength(headlines - textHeadlines);
    expect(eight.filter((n) => n === 0)).toHaveLength(textHeadlines);
    for (const tile of headlineTiles) expect(tile.history, tile.kpi.kpi_key).toHaveLength(8);
    m.run(`UPDATE app_config SET value = '6' WHERE key = 'dd_history_periods'`);
    const sixModel = await loadDirectorWall(m.db, "bizops", DAY, null, null, NOW);
    expect(sixModel.config.historyPeriods).toBe(6);
    const six = [...directorWallPage(sixModel, "en").matchAll(/data-dd-spark-points="(\d+)"/g)].map((x) => Number(x[1]));
    expect(six).toHaveLength(headlines);
    expect(six.filter((n) => n === 6)).toHaveLength(headlines - textHeadlines);
    for (const tile of sixModel.groups.flatMap((group) => group.tiles)) {
      expect(tile.history).toHaveLength(6);
      expect(tile.history[5]?.period_start).toBe(tile.periodStart);
      expect(tile.history.map((p) => p.period_start)).toEqual([...tile.history].map((p) => p.period_start).sort());
    }
    // Values in their units: pounds carry the lb word and the 448 g badge, dollars are whole with separators, percents one decimal.
    expect(html).toContain('data-dd-lb-grams="448"');
    expect(html).toContain(">448 g<");
    expect(html).toContain('<span class="dd-tile-unit">lb</span>');
    expect(html).toContain("Goal 120.0 lb");
    expect(html).toContain("Variance +");
    expect(html).toContain("Variance -");
    expect(html).toContain('data-dd-source="app"');
    expect(html).toContain(">App<");
    expect(html).toContain("as of 2026-10-15 08:00");
    expect(html).toContain('class="dd-badge dd-badge-status dd-badge-on_goal">On goal<');
    expect(html).toContain('class="dd-badge dd-badge-status dd-badge-off_goal">Off goal<');
    expect(html).toContain("<polyline points=");
    // The cadence tab narrows the wall to one group; the stepper links carry the previous and next period.
    const weekly = await loadDirectorWall(m.db, "bizops", DAY, "weekly", null, NOW);
    const weeklyHtml = directorWallPage(weekly, "en");
    expect([...weeklyHtml.matchAll(/data-dd-group="([^"]+)"/g)].map((x) => x[1])).toEqual(["weekly"]);
    expect(weekly.groups.find((group) => group.cadence === "weekly")?.periodStart).toBe("2026-10-12");
    expect(weeklyHtml).toContain('href="/admin/director/bizops?cadence=weekly&amp;period=2026-10-05" data-dd-step="prev"');
    expect(weeklyHtml).toContain('href="/admin/director/bizops?cadence=weekly&amp;period=2026-10-19" data-dd-step="next"');
    expect(weeklyHtml).toContain('href="/admin/director/bizops?cadence=weekly" data-dd-step="current"');
    expect(weeklyHtml).toContain(">W42, Oct 12 to 18<");
    const back = await loadDirectorWall(m.db, "bizops", DAY, "weekly", "2026-10-05", NOW);
    const backWeekly = back.groups.find((group) => group.cadence === "weekly");
    expect(backWeekly?.periodStart).toBe("2026-10-05");
    for (const tile of backWeekly?.tiles ?? []) expect(tile.snapshot?.period_start, tile.kpi.kpi_key).toBe("2026-10-05");
    // The other cadences stay on the farm day while one tab steps.
    for (const group of back.groups) if (group.cadence !== "weekly") expect(group.periodStart).toBe(periodStartFor(group.periodKind, DAY, {}));
    expect(directorWallPage(back, "es")).toContain(">S41, 5 a 11 oct<");
    // A bad cadence or period reads as none.
    const loose = await loadDirectorWall(m.db, "bizops", DAY, "hourly", "yesterday", NOW);
    expect(loose.cadence).toBeNull();
    expect(loose.periodDay).toBeNull();
    // The home sees the same rows: every department has values and a last computed time.
    const home = await loadDirectorHome(m.db, DAY, NOW);
    for (const d of home.departments) {
      expect(d.lastComputedAt).toBe(NOW);
      expect(d.counts.no_data).toBe(0);
    }
    expect(home.departments.find((d) => d.dept_key === "bizops")?.counts.on_goal).toBeGreaterThan(0);
    expect(directorHomePage(home, "en")).toContain("2026-10-15 08:00");
  }, 30_000);

  it("a snapshot older than stale_after_hours renders stale with the stripe; a fresh one without a goal has no verdict", async () => {
    const m = await migratedDb();
    const wallRows = ddKpisForWall(DD_KPIS, "bizops");
    const kpi = wallRows.find((row) => row.stale_after_hours != null && row.companion_of == null && ddInSeason(row, DAY) && row.status === "live") as DdKpi;
    expect(kpi).toBeTruthy();
    const other = wallRows.find((row) => row.kpi_key !== kpi.kpi_key && row.companion_of == null && ddInSeason(row, DAY) && row.status === "live") as DdKpi;
    const kind = ddPeriodKindOf(kpi.cadence);
    const start = periodStartFor(kind, DAY, { seasonStartMd: kpi.season_start_md });
    const old = new Date(Date.parse(NOW) - ((kpi.stale_after_hours as number) + 1) * 3_600_000).toISOString();
    m.run(
      `INSERT INTO dd_kpi_values (id, kpi_key, period_kind, period_start, dim_key, value, goal, source, computed_at, def_version, created_at)
       VALUES ('stale-1', ?, ?, ?, '', 50, 40, 'app', ?, 1, ?)`,
      kpi.kpi_key,
      kind,
      start,
      old,
      old
    );
    const otherKind = ddPeriodKindOf(other.cadence);
    m.run(
      `INSERT INTO dd_kpi_values (id, kpi_key, period_kind, period_start, dim_key, value, source, computed_at, def_version, created_at)
       VALUES ('fresh-1', ?, ?, ?, '', 7, 'hand', ?, 1, ?)`,
      other.kpi_key,
      otherKind,
      periodStartFor(otherKind, DAY, { seasonStartMd: other.season_start_md }),
      NOW,
      NOW
    );
    const model = await loadDirectorWall(m.db, "bizops", DAY, null, null, NOW);
    const html = directorWallPage(model, "en");
    expect(html).toContain(`data-dd-kpi="${kpi.kpi_key}" data-dd-status="stale"`);
    expect(html).toContain('<span class="dd-stale-stripe" aria-hidden="true"></span>');
    expect(html).toContain(">Stale<");
    expect(html).toContain(`data-dd-kpi="${other.kpi_key}" data-dd-status="no_goal"`);
    expect(html).toContain(">Hand<");
    // A fresh row whose source read is old is stale too.
    m.run(`UPDATE dd_kpi_values SET computed_at = ?, source_as_of = ? WHERE id = 'stale-1'`, NOW, old);
    const again = directorWallPage(await loadDirectorWall(m.db, "bizops", DAY, null, null, NOW), "en");
    expect(again).toContain(`data-dd-kpi="${kpi.kpi_key}" data-dd-status="stale"`);
    m.run(`UPDATE dd_kpi_values SET source_as_of = NULL WHERE id = 'stale-1'`);
    const freshModel = await loadDirectorWall(m.db, "bizops", DAY, null, null, NOW);
    const fresh = directorWallPage(freshModel, "en");
    expect(fresh).toContain(`data-dd-kpi="${kpi.kpi_key}" data-dd-status="on_goal"`);
    expect(directorWallPage(freshModel, "es")).toContain(">Manual<");
    expect(directorWallPage(freshModel, "es")).toContain(">En meta<");
    const home = await loadDirectorHome(m.db, DAY, NOW);
    expect(home.departments.find((d) => d.dept_key === kpi.dept_key)?.counts.on_goal).toBeGreaterThan(0);
    expect(home.departments.find((d) => d.dept_key === other.dept_key)?.counts.no_goal).toBeGreaterThan(0);
  });

  it("a lower is better goal reads on goal at or under its target and off goal above it, the variance favourable when under", async () => {
    expect(ddGoalDelta("at_least", 130, 120)).toBe(10);
    expect(ddGoalDelta("at_least", 110, 120)).toBe(-10);
    expect(ddGoalDelta("at_most", 2, 3)).toBe(1);
    expect(ddGoalDelta("at_most", 5, 3)).toBe(-2);
    expect(ddGoalDelta("at_most", 3, 3)).toBe(0);
    const m = await migratedDb();
    const kpi = ddKpi("bizops.lab_turnaround_days") as DdKpi;
    expect(kpi.goal_direction).toBe("at_most");
    expect(kpi.unit).toBe("days");
    expect(ddInSeason(kpi, DAY)).toBe(true);
    m.run(
      `INSERT INTO dd_kpi_values (id, kpi_key, period_kind, period_start, dim_key, value, goal, source, computed_at, def_version, created_at)
       VALUES ('days-1', ?, 'day', ?, '', 5, 3, 'app', ?, 1, ?)`,
      kpi.kpi_key,
      DAY,
      NOW,
      NOW
    );
    const slow = directorWallPage(await loadDirectorWall(m.db, "bizops", DAY, null, null, NOW), "en");
    expect(slow).toContain(`data-dd-kpi="${kpi.kpi_key}" data-dd-status="off_goal"`);
    expect(slow).toContain('data-dd-goal="3" data-dd-goal-direction="at_most"');
    expect(slow).toContain("Goal at most 3.0 days");
    expect(slow).toContain("Variance -2.0 (-66.7%)");
    m.run(`UPDATE dd_kpi_values SET value = 2 WHERE id = 'days-1'`);
    const quick = await loadDirectorWall(m.db, "bizops", DAY, null, null, NOW);
    const quickHtml = directorWallPage(quick, "en");
    expect(quickHtml).toContain(`data-dd-kpi="${kpi.kpi_key}" data-dd-status="on_goal"`);
    expect(quickHtml).toContain("Variance +1.0 (+33.3%)");
    expect(directorWallPage(quick, "es")).toContain("Meta como maximo 3.0 dias");
    m.run(`UPDATE dd_kpi_values SET value = 3 WHERE id = 'days-1'`);
    expect(directorWallPage(await loadDirectorWall(m.db, "bizops", DAY, null, null, NOW), "en")).toContain(`data-dd-kpi="${kpi.kpi_key}" data-dd-status="on_goal"`);
    // An at least row keeps the plain goal line and the arithmetic sign.
    const up = ddKpi("harvest.wet_lb_per_dlh") as DdKpi;
    expect(up.goal_direction).toBe("at_least");
    m.run(
      `INSERT INTO dd_kpi_values (id, kpi_key, period_kind, period_start, dim_key, value, goal, source, computed_at, def_version, created_at)
       VALUES ('ratio-1', ?, 'day', ?, '', 10, 12, 'app', ?, 1, ?)`,
      up.kpi_key,
      DAY,
      NOW,
      NOW
    );
    const html = directorWallPage(await loadDirectorWall(m.db, "bizops", DAY, null, null, NOW), "en");
    expect(html).toContain(`data-dd-kpi="${up.kpi_key}" data-dd-status="off_goal"`);
    expect(html).toContain('data-dd-goal="12" data-dd-goal-direction="at_least"');
    expect(html).toContain("Goal 12.00 ratio");
    expect(html).toContain("Variance -2.00 (-16.7%)");
    expect(html).not.toContain("Goal at most 12.00");
    // The home counts the same verdicts.
    const home = await loadDirectorHome(m.db, DAY, NOW);
    expect(home.departments.find((d) => d.dept_key === "bizops")?.counts.on_goal).toBe(1);
    expect(home.departments.find((d) => d.dept_key === "bizops")?.counts.off_goal).toBe(1);
  });

  it("two live sources on one period: the computed row wins the tile and the home, whatever was computed last", async () => {
    expect(DD_SOURCE_PRECEDENCE.indexOf("app")).toBeLessThan(DD_SOURCE_PRECEDENCE.indexOf("hand"));
    const m = await migratedDb();
    const kpi = ddKpi("harvest.wet_weight_lb") as DdKpi;
    expect(ddInSeason(kpi, DAY)).toBe(true);
    const earlier = "2026-10-15T06:30:00.000Z";
    const insert = (id: string, source: string, value: number, goal: number | null, computedAt: string) =>
      m.run(
        `INSERT INTO dd_kpi_values (id, kpi_key, period_kind, period_start, dim_key, value, goal, source, computed_at, def_version, created_at)
         VALUES (?, ?, 'day', ?, '', ?, ?, ?, ?, 1, ?)`,
        id,
        kpi.kpi_key,
        DAY,
        value,
        goal,
        source,
        computedAt,
        computedAt
      );
    // The hand row is the newer computation; the app row still wins.
    insert("src-app", "app", 1500, 1200, earlier);
    insert("src-hand", "hand", 900, null, NOW);
    const wall = await loadDirectorWall(m.db, "bizops", DAY, null, null, NOW);
    const tile = wall.groups.flatMap((group) => group.tiles).find((row) => row.kpi.kpi_key === kpi.kpi_key);
    expect(tile?.snapshot?.source).toBe("app");
    expect(tile?.snapshot?.value).toBe(1500);
    expect(tile?.status).toBe("on_goal");
    const html = directorWallPage(wall, "en");
    expect(html).toContain(`data-dd-kpi="${kpi.kpi_key}" data-dd-status="on_goal"`);
    expect(html).toContain('data-dd-source="app">App<');
    expect(html).not.toContain('data-dd-source="hand"');
    // The home counts a tile once, under its own department (the harvest family is bizops on two walls).
    expect(kpi.dept_key).toBe("bizops");
    const home = await loadDirectorHome(m.db, DAY, NOW);
    const bizops = home.departments.find((d) => d.dept_key === "bizops");
    expect(bizops?.counts.on_goal).toBe(1);
    expect(bizops?.counts.no_goal).toBe(0);
    expect(home.departments.find((d) => d.dept_key === "farmops")?.counts.on_goal).toBe(0);
    // The same with the app row computed last.
    m.run(`UPDATE dd_kpi_values SET computed_at = ? WHERE id = 'src-app'`, "2026-10-15T11:00:00.000Z");
    m.run(`UPDATE dd_kpi_values SET computed_at = ? WHERE id = 'src-hand'`, earlier);
    const again = await loadDirectorWall(m.db, "bizops", DAY, null, null, NOW);
    expect(again.groups.flatMap((group) => group.tiles).find((row) => row.kpi.kpi_key === kpi.kpi_key)?.snapshot?.source).toBe("app");
    // Once the app row is superseded, the hand row is the live value and is badged as typed.
    m.run(`UPDATE dd_kpi_values SET superseded_at = ? WHERE id = 'src-app'`, NOW);
    const typed = await loadDirectorWall(m.db, "bizops", DAY, null, null, NOW);
    const typedTile = typed.groups.flatMap((group) => group.tiles).find((row) => row.kpi.kpi_key === kpi.kpi_key);
    expect(typedTile?.snapshot?.source).toBe("hand");
    expect(typedTile?.snapshot?.value).toBe(900);
    expect(typedTile?.status).toBe("no_goal");
    expect(directorWallPage(typed, "en")).toContain('data-dd-source="hand">Hand<');
    expect((await loadDirectorHome(m.db, DAY, NOW)).departments.find((d) => d.dept_key === "bizops")?.counts.no_goal).toBe(1);
    // A source outside the precedence list ranks last.
    insert("src-odd", "odd", 1, null, NOW);
    expect(
      (await loadDirectorWall(m.db, "bizops", DAY, null, null, NOW)).groups
        .flatMap((group) => group.tiles)
        .find((row) => row.kpi.kpi_key === kpi.kpi_key)?.snapshot?.source
    ).toBe("hand");
  });

  it("the home reads each key's newest period, not its newest computation, and an old latest period reads stale", async () => {
    const m = await migratedDb();
    const kpi = ddKpi("bizops.lab_turnaround_days") as DdKpi;
    const weekly = ddKpi("farmops.labor_scheduled_hours") as DdKpi;
    expect(weekly.cadence).toBe("weekly");
    expect(ddInSeason(weekly, DAY)).toBe(true);
    const insert = (id: string, key: string, kind: string, start: string, value: number, goal: number | null, computedAt: string) =>
      m.run(
        `INSERT INTO dd_kpi_values (id, kpi_key, period_kind, period_start, dim_key, value, goal, source, computed_at, def_version, created_at)
         VALUES (?, ?, ?, ?, '', ?, ?, 'app', ?, 1, ?)`,
        id,
        key,
        kind,
        start,
        value,
        goal,
        computedAt,
        computedAt
      );
    // Yesterday's row was computed after today's; today's row is the latest period and it misses its goal.
    insert("p-today", kpi.kpi_key, "day", DAY, 5, 3, "2026-10-15T07:00:00.000Z");
    insert("p-yesterday", kpi.kpi_key, "day", "2026-10-14", 2, 3, NOW);
    // The weekly row's only period is two weeks back, computed then: the latest period, and stale by now.
    const old = "2026-09-28T12:00:00.000Z";
    insert("p-old", weekly.kpi_key, "week", "2026-09-28", 40, null, old);
    const home = await loadDirectorHome(m.db, DAY, NOW);
    const bizops = home.departments.find((d) => d.dept_key === "bizops");
    expect(bizops?.counts.off_goal).toBe(1);
    expect(bizops?.counts.on_goal).toBe(0);
    // The card's last computed time is the latest period's row, not the later computation of an older period.
    expect(bizops?.lastComputedAt).toBe("2026-10-15T07:00:00.000Z");
    const farmops = home.departments.find((d) => d.dept_key === "farmops");
    expect(farmops?.counts.stale).toBe(1);
    expect(farmops?.counts.no_data).toBe(farmops ? farmops.tiles - 1 - farmops.counts.out_of_season : -1);
    expect(farmops?.lastComputedAt).toBe(old);
    // A superseded newer period makes room for the one before it.
    m.run(`UPDATE dd_kpi_values SET superseded_at = ? WHERE id = 'p-today'`, NOW);
    expect((await loadDirectorHome(m.db, DAY, NOW)).departments.find((d) => d.dept_key === "bizops")?.counts.on_goal).toBe(1);
  });

  it("out of season rows render dimmed with the label, in both locales", async () => {
    const m = await migratedDb();
    const winter = "2026-02-15";
    const model = await loadDirectorWall(m.db, "bizops", winter, null, null, "2026-02-15T12:00:00.000Z");
    const html = directorWallPage(model, "en");
    const out = ddKpisForWall(DD_KPIS, "bizops").filter((row) => !ddInSeason(row, winter));
    expect(out.length).toBeGreaterThan(0);
    for (const row of out) {
      expect(html, row.kpi_key).toContain(`data-dd-kpi="${row.kpi_key}" data-dd-status="out_of_season"`);
      if (row.companion_of == null) expect(html).toContain(`<article class="dd-tile dd-tile-out_of_season dd-out" data-dd-kpi="${row.kpi_key}"`);
    }
    expect(html.match(/>Out of season</g)).toHaveLength(out.length);
    const es = directorWallPage(model, "es");
    expect(es.match(/>Fuera de temporada</g)).toHaveLength(out.length);
    expect(es).not.toContain("Out of season");
  });

  it("formats values by unit and draws the sparkline from the numbers it has", () => {
    expect(ddFormatValue("usd", 1234567.8)).toBe("$1,234,568");
    expect(ddFormatValue("usd", -5.4)).toBe("-$5");
    expect(ddFormatValue("pct", 12.345)).toBe("12.3%");
    expect(ddFormatValue("count", 12.6)).toBe("13");
    expect(ddFormatValue("ea", 1200)).toBe("1,200");
    expect(ddFormatValue("lb448", 12.345)).toBe("12.3");
    expect(ddFormatValue("score", 0.5)).toBe("0.50");
    expect(ddFormatValue("ratio", 2)).toBe("2.00");
    expect(ddFormatValue("days", 3)).toBe("3.0");
    expect(ddFormatValue("text", null, "two silos")).toBe("two silos");
    expect(ddFormatValue("lb448", null)).toBe("");
    expect(ddSparklineSvg([])).toContain('data-dd-spark-points="0"');
    expect(ddSparklineSvg([{ period_start: "2026-10-05", value: null }])).toContain('data-dd-spark-points="0"');
    const one = ddSparklineSvg([{ period_start: "2026-10-05", value: 3 }]);
    expect(one).toContain('data-dd-spark-points="1"');
    expect(one).toContain('<polyline points="60.0,16.0"/>');
    const three = ddSparklineSvg([
      { period_start: "2026-09-28", value: 1 },
      { period_start: "2026-10-05", value: 3 },
      { period_start: "2026-10-12", value: 2 },
    ]);
    expect(three).toContain('data-dd-spark-points="3"');
    expect(three).toContain('<polyline points="0.0,28.0 60.0,4.0 120.0,16.0"/>');
    expect(three).not.toContain("#");
    expect(three).not.toContain("stroke=");
  });

  it("every t() key of the page module and the Admin entry has a Spanish row without a dash", async () => {
    const page = `${await source("director.ts")}\n${await source("directors2b.ts")}`;
    const pageKeys = [...page.matchAll(/\bt\(locale, "([^"]*)"\)/g)].map((m) => m[1] as string);
    expect(pageKeys.length).toBeGreaterThan(12);
    const group = ADMIN_GROUPS.find((g) => g.key === "director");
    const all = new Set<string>([
      ...pageKeys,
      ...Object.values(DD_STATUS_WORDS),
      ...Object.values(DD_SOURCE_WORDS),
      ...Object.values(DD_CADENCE_WORDS),
      ...Object.values(DD_UNIT_WORDS).filter((word) => word !== ""),
      ...DD_DEPARTMENTS.map((dept) => dept.title_en),
      "All",
      "Period",
      "Director Dashboard",
      "Unknown department.",
      ...(group ? [group.title, ...group.members.map((member) => member.title)] : []),
    ]);
    const missing = [...all].filter((k) => !DICT[k] || typeof DICT[k]?.es !== "string" || DICT[k]?.es.trim() === "");
    expect(missing).toEqual([]);
    for (const k of all) {
      expect(DASH.test(DICT[k]?.en ?? ""), k).toBe(false);
      expect(DASH.test(DICT[k]?.es ?? ""), k).toBe(false);
    }
    expect(t("es", DD_SOURCE_WORDS.mount as string)).toBe("Montaje");
    expect(t("en", DD_SOURCE_WORDS.mount as string)).toBe("Mount");
    expect(page.includes("\r")).toBe(false);
    expect(DASH.test(page)).toBe(false);
  });
});

describe("DD S2a: the entry grid and the KPI detail", () => {
  function person(m: Awaited<ReturnType<typeof migratedDb>>): void {
    m.run(`INSERT INTO people (id, display_name, is_active, created_at, updated_at) VALUES ('dd-actor', 'actor', 1, ?, ?)`, NOW, NOW);
  }

  function entryForm(fields: Record<string, string>): FormData {
    const form = new FormData();
    form.set("person_id", "dd-actor");
    for (const [key, value] of Object.entries(fields)) form.set(key, value);
    return form;
  }

  /** Records the bind count of every prepared statement, and still lets batch run. */
  function bindDb(inner: D1Database): { db: D1Database; binds: number[] } {
    const binds: number[] = [];
    const targets = new WeakMap<object, object>();
    type Stmt = Record<string | symbol, unknown> & { bind: (...args: unknown[]) => Stmt };
    const wrap = (stmt: Stmt): Stmt => {
      const proxy = new Proxy(stmt, {
        get(target, prop) {
          if (prop === "bind") {
            return (...args: unknown[]) => {
              binds.push(args.length);
              return wrap(target.bind(...args));
            };
          }
          return target[prop];
        },
      });
      targets.set(proxy, stmt);
      return proxy;
    };
    const raw = inner as unknown as { prepare: (sql: string) => Stmt; batch: (stmts: object[]) => Promise<unknown[]> };
    const db = {
      prepare: (sql: string) => wrap(raw.prepare(sql)),
      batch: (stmts: object[]) => raw.batch(stmts.map((stmt) => targets.get(stmt) ?? stmt)),
    };
    return { db: db as unknown as D1Database, binds };
  }

  function addHandKpi(m: Awaited<ReturnType<typeof migratedDb>>, key: string, sort: number): void {
    m.run(
      `INSERT INTO dd_kpis (
        kpi_key, dept_key, wall_keys, title_en, title_es, unit, cadence, dims, goal_kind, goal_direction, source_kind, status, def_version, sort, active, created_at, updated_at
      ) VALUES (?, 'bizops', 'bizops', ?, ?, 'count', 'weekly', '', 'none', 'at_least', 'hand', 'live', 1, ?, 1, ?, ?)`,
      key,
      key,
      key,
      sort,
      NOW,
      NOW
    );
  }

  it("the grid and the detail each load in one batch", async () => {
    const m = await migratedDb();
    const grid = countedDb(m.db);
    const model = await loadDirectorGrid(grid.db, "bizops", DAY, "weekly", null);
    expect(grid.counts).toEqual({ batches: 1, direct: 0 });
    expect(model.cadence).toBe("weekly");
    expect(model.periodStart).toBe("2026-10-12");
    expect(model.rows.some((row) => row.entry && row.kpi.kpi_key === "bizops.compliance_issues_opened_count")).toBe(true);
    const page = directorGridPage(model, "en", "actor@local");
    expect(page).toContain('data-dd-grid="bizops"');
    expect(page).toContain('data-dd-card="bizops.compliance_issues_opened_count"');
    expect(page).toContain('data-dd-cell="bizops.compliance_issues_opened_count|"');
    expect(page).toContain('data-dd-cell="bizops.compliance_issues_opened_count|PNN"');
    expect(page).not.toContain("Not entered here");
    expect(page).toContain('data-supervisor>Supervisor: actor@local');
    expect(page).toContain('value="Weekly check-in"');
    expect(page).toContain("data-dd-progress");
    const locked = model.rows.find((row) => !row.entry);
    expect(locked).toBeTruthy();
    expect(page).not.toContain(`data-dd-card="${locked?.kpi.kpi_key}"`);
    expect(page).toContain("Filled in automatically:");
    expect(directorGridPage(model, "es")).toContain('value="Chequeo semanal"');
    expect(directorGridPage(model, "es")).not.toContain("Weekly check-in");
    const detail = countedDb(m.db);
    const one = await loadDirectorDetail(detail.db, "bizops.lbs_processed", DAY);
    expect(detail.counts).toEqual({ batches: 1, direct: 0 });
    expect(directorDetailPage(one, "en")).toContain('data-dd-detail="bizops.lbs_processed"');
    await expect(loadDirectorDetail(m.db, "no.such.kpi", DAY)).rejects.toMatchObject({ status: 404, message: "Unknown KPI." });
  });

  it("a save of 120 changed cells stays at or under 100 binds, skips an unchanged cell, and a second save writes nothing", async () => {
    const m = await migratedDb();
    person(m);
    for (let i = 0; i < 120; i += 1) addHandKpi(m, `t.k${i}`, 9000 + i);
    addHandKpi(m, "t.same", 9120);
    m.run(
      `INSERT INTO dd_kpi_values (id, kpi_key, period_kind, period_start, dim_key, value, source, computed_at, def_version, created_at)
       VALUES ('same-1', 't.same', 'week', '2026-10-12', '', 5, 'hand', ?, 1, ?)`,
      NOW,
      NOW
    );
    const fields: Record<string, string> = { reason: "Weekly entry", "cell:t.same|": "5" };
    for (let i = 0; i < 120; i += 1) fields[`cell:t.k${i}|`] = String(i + 1);
    const { db, binds } = bindDb(m.db);
    const saved = await saveDirectorGrid(db, "bizops", "weekly", DAY, DAY, entryForm(fields), NOW);
    expect(saved.redirect).toContain("?cadence=weekly&period=2026-10-12&ok=saved&n=120");
    expect(binds.length).toBeGreaterThan(0);
    expect(Math.max(...binds)).toBeLessThanOrEqual(100);
    expect(m.get(`SELECT COUNT(*) AS n FROM record_change_log WHERE record_table = 'dd_kpi_values'`)?.n).toBe(120);
    expect(m.get(`SELECT COUNT(*) AS n FROM record_change_log WHERE record_id = 'same-1'`)?.n).toBe(0);
    const values = m.get(`SELECT COUNT(*) AS n FROM dd_kpi_values WHERE superseded_at IS NULL AND kpi_key LIKE 't.%'`)?.n;
    const logs = m.get(`SELECT COUNT(*) AS n FROM record_change_log WHERE record_table = 'dd_kpi_values'`)?.n;
    const again = await saveDirectorGrid(m.db, "bizops", "weekly", DAY, DAY, entryForm(fields), NOW);
    expect(again.redirect).toContain("?cadence=weekly&period=2026-10-12&ok=nochange");
    expect(m.get(`SELECT COUNT(*) AS n FROM dd_kpi_values WHERE superseded_at IS NULL AND kpi_key LIKE 't.%'`)?.n).toBe(values);
    expect(m.get(`SELECT COUNT(*) AS n FROM record_change_log WHERE record_table = 'dd_kpi_values'`)?.n).toBe(logs);
  });

  it("refuses a missing reason and a bad number, ignores a locked cell, clears a blank, and saves the three farms", async () => {
    const m = await migratedDb();
    person(m);
    const weekly = entryForm({ "cell:bizops.compliance_issues_opened_count|": "4" });
    await expect(saveDirectorGrid(m.db, "bizops", "weekly", DAY, DAY, weekly, NOW)).rejects.toBeInstanceOf(HttpError);
    await expect(saveDirectorGrid(m.db, "bizops", "weekly", DAY, DAY, weekly, NOW)).rejects.toMatchObject({ status: 400, message: "Reason is required." });
    const bad = entryForm({ reason: "Weekly entry", "cell:bizops.compliance_issues_opened_count|": "abc" });
    await expect(saveDirectorGrid(m.db, "bizops", "weekly", DAY, DAY, bad, NOW)).rejects.toMatchObject({
      status: 400,
      message: "Compliance issues opened must be a plain number.",
    });
    const fraction = entryForm({ reason: "Weekly entry", "cell:bizops.compliance_issues_opened_count|": "1.5" });
    await expect(saveDirectorGrid(m.db, "bizops", "weekly", DAY, DAY, fraction, NOW)).rejects.toMatchObject({
      status: 400,
      message: "Compliance issues opened must be a whole number.",
    });
    const pct = entryForm({ reason: "Weekly entry", "cell:farmops.labor_tasks_done_pct|": "140" });
    await expect(saveDirectorGrid(m.db, "farmops", "daily", DAY, DAY, pct, NOW)).rejects.toMatchObject({
      status: 400,
      message: "Labor tasks completion must be a percent from 0 to 100.",
    });
    expect(m.get(`SELECT COUNT(*) AS n FROM dd_kpi_values`)?.n).toBe(0);
    const locked = DD_KPIS.find((row) => row.wall_keys.split(",").includes("bizops") && row.cadence === "weekly" && row.source_kind === "app");
    expect(locked).toBeTruthy();
    const mixed = entryForm({
      reason: "Weekly entry",
      [`cell:${locked?.kpi_key}|`]: "nope",
      "cell:bizops.compliance_issues_opened_count|PNN": "1",
      "cell:bizops.compliance_issues_opened_count|ARL": "2",
      "cell:bizops.compliance_issues_opened_count|PNS": "3",
    });
    const saved = await saveDirectorGrid(m.db, "bizops", "weekly", DAY, DAY, mixed, NOW);
    expect(saved.redirect).toContain("&ok=saved&n=3");
    const farms = m.all(
      `SELECT dim_key, value FROM dd_kpi_values WHERE kpi_key = 'bizops.compliance_issues_opened_count' AND superseded_at IS NULL ORDER BY dim_key`
    );
    expect(farms.map((row) => `${row.dim_key}:${row.value}`)).toEqual(["ARL:2", "PNN:1", "PNS:3"]);
    expect(m.get(`SELECT COUNT(*) AS n FROM dd_kpi_values WHERE kpi_key = ?`, locked?.kpi_key ?? "")?.n).toBe(0);
    const clear = entryForm({
      reason: "Weekly entry",
      "cell:bizops.compliance_issues_opened_count|PNN": "",
      "cell:bizops.compliance_issues_opened_count|ARL": "2",
      "cell:bizops.compliance_issues_opened_count|PNS": "3",
    });
    const cleared = await saveDirectorGrid(m.db, "bizops", "weekly", DAY, DAY, clear, NOW);
    expect(cleared.redirect).toContain("&ok=saved&n=1");
    const pnn = m.get(`SELECT id, superseded_at FROM dd_kpi_values WHERE kpi_key = 'bizops.compliance_issues_opened_count' AND dim_key = 'PNN'`);
    expect(pnn?.superseded_at).toBe(NOW);
    expect(m.get(`SELECT COUNT(*) AS n FROM dd_kpi_values WHERE kpi_key = 'bizops.compliance_issues_opened_count' AND dim_key = 'PNN' AND superseded_at IS NULL`)?.n).toBe(0);
    const log = m.get(
      `SELECT record_id, old_value, new_value FROM record_change_log WHERE record_id = ? AND new_value IS NULL`,
      String(pnn?.id)
    );
    expect(log?.old_value).toBe("1");
    expect(log?.new_value).toBeNull();
    const detail = await loadDirectorDetail(m.db, "bizops.compliance_issues_opened_count", DAY);
    const html = directorDetailPage(detail, "en");
    expect(html).toContain('data-dd-history-row="2026-10-12"');
    expect(html).toContain("<s>");
    expect(html).toContain('data-dd-log-row');
    expect(html).toContain(">1<");
  });

  it("the enter link follows hand and mixed rows, and the home card says own KPIs", async () => {
    const m = await migratedDb();
    const wall = await loadDirectorWall(m.db, "bizops", DAY, null, null, NOW);
    const html = directorWallPage(wall, "en");
    const enters = [...html.matchAll(/data-dd-enter="([^"]+)"/g)].map((hit) => hit[1]);
    const expected = wall.cadences.filter((cadence) =>
      ddKpisForWall(DD_KPIS, "bizops").some((row) => row.cadence === cadence && (row.source_kind === "hand" || row.source_kind === "mixed"))
    );
    expect(enters).toEqual(expected);
    expect(expected.length).toBeGreaterThan(0);
    const quiet = wall.cadences.filter((cadence) => !expected.includes(cadence));
    for (const cadence of quiet) expect(html).not.toContain(`data-dd-enter="${cadence}"`);
    expect(html).toContain('href="/admin/director/kpi/bizops.lbs_processed"');
    const home = directorHomePage(await loadDirectorHome(m.db, DAY, NOW), "en");
    const farmops = DD_KPIS.filter((row) => row.dept_key === "farmops").length;
    expect(home).toContain(`>${farmops}</b> own KPIs`);
    expect(home).not.toContain(">tiles<");
    const es = directorHomePage(await loadDirectorHome(m.db, DAY, NOW), "es");
    expect(es).toContain("KPIs propios");
    expect(es).not.toContain("own KPIs");
  });
});

describe("DD S2b: targets, questions, and CSV import", () => {
  function person(m: Awaited<ReturnType<typeof migratedDb>>): void {
    m.run(`INSERT INTO people (id, display_name, is_active, created_at, updated_at) VALUES ('dd-actor', 'actor', 1, ?, ?)`, NOW, NOW);
  }

  function form(fields: Record<string, string>): FormData {
    const data = new FormData();
    data.set("person_id", "dd-actor");
    for (const [key, value] of Object.entries(fields)) data.set(key, value);
    return data;
  }

  function bindDb(inner: D1Database): { db: D1Database; binds: number[] } {
    const binds: number[] = [];
    const targets = new WeakMap<object, object>();
    type Stmt = Record<string | symbol, unknown> & { bind: (...args: unknown[]) => Stmt };
    const wrap = (stmt: Stmt): Stmt => {
      const proxy = new Proxy(stmt, {
        get(target, prop) {
          if (prop === "bind") {
            return (...args: unknown[]) => {
              binds.push(args.length);
              return wrap(target.bind(...args));
            };
          }
          return target[prop];
        },
      });
      targets.set(proxy, stmt);
      return proxy;
    };
    const raw = inner as unknown as { prepare: (sql: string) => Stmt; batch: (stmts: object[]) => Promise<unknown[]> };
    const db = {
      prepare: (sql: string) => wrap(raw.prepare(sql)),
      batch: (stmts: object[]) => raw.batch(stmts.map((stmt) => targets.get(stmt) ?? stmt)),
    };
    return { db: db as unknown as D1Database, binds };
  }

  function asTarget(row: Row): DdTarget {
    return {
      id: String(row.id),
      kpi_key: String(row.kpi_key),
      dim_key: String(row.dim_key ?? ""),
      period_kind: String(row.period_kind),
      effective_from: String(row.effective_from),
      target: Number(row.target),
      low: row.low == null ? null : Number(row.low),
      high: row.high == null ? null : Number(row.high),
      phasing: row.phasing == null || row.phasing === "" ? null : String(row.phasing),
      note: row.note == null || row.note === "" ? null : String(row.note),
      deleted_at: row.deleted_at == null ? null : String(row.deleted_at),
    };
  }

  it("parsePhasing, targetInForce, and phasedGoal", () => {
    expect(parsePhasing("", "week")).toBeNull();
    expect(parsePhasing("  ", "month")).toBeNull();
    expect(parsePhasing("flat", "month")).toBe("flat");
    expect(parsePhasing("flat", "week")).toBe("flat");
    expect(() => parsePhasing("flat", "day")).toThrow(/refused on a day, quarter, or season/);
    expect(() => parsePhasing("flat", "quarter")).toThrow(/refused on a day, quarter, or season/);
    expect(() => parsePhasing("flat", "season")).toThrow(/refused on a day, quarter, or season/);
    const monthWeights = ["8", "8", "8", "8", "8", "8", "8", "8", "8", "8", "5", "15"];
    expect(monthWeights.reduce((n, part) => n + Number(part), 0)).toBe(100);
    const monthStored = parsePhasing(monthWeights.join(","), "month");
    expect(monthStored?.split(",")).toHaveLength(12);
    expect(phasedGoal(100, null, "month", "2026-10-01")).toBe(100);
    expect(phasedGoal(120, "flat", "month", "2026-03-01")).toBe(10);
    expect(phasedGoal(520, "flat", "week", "2026-10-12")).toBe(10);
    expect(phasedGoal(100, monthStored, "month", "2026-10-01")).toBeCloseTo(8, 5);
    expect(phasedGoal(100, monthStored, "month", "2026-12-01")).toBeCloseTo(15, 5);
    const weekWeights = [...Array.from({ length: 51 }, () => "1"), "49"];
    expect(weekWeights.reduce((n, part) => n + Number(part), 0)).toBe(100);
    const weekStored = parsePhasing(weekWeights.join(","), "week");
    expect(weekStored?.split(",")).toHaveLength(52);
    expect(isoWeekOf("2024-01-01").week).toBe(1);
    expect(isoWeekOf("2020-12-28").week).toBe(53);
    expect(phasedGoal(100, weekStored, "week", "2024-01-01")).toBeCloseTo(1, 5);
    expect(phasedGoal(100, weekStored, "week", "2020-12-28")).toBeCloseTo(49, 5);
    expect(() => parsePhasing(Array.from({ length: 52 }, () => "1").join(","), "month")).toThrow(/12 weights/);
    expect(() => parsePhasing(Array.from({ length: 12 }, () => "4").join(","), "month")).toThrow(/sum to 1 or to 100/);
    expect(() => parsePhasing("nope", "week")).toThrow(/52 weights/);
    const rows: DdTarget[] = [
      { id: "a", kpi_key: "k", dim_key: "", period_kind: "week", effective_from: "2026-01-01", target: 1, low: null, high: null, phasing: null, note: null, deleted_at: null },
      { id: "b", kpi_key: "k", dim_key: "", period_kind: "week", effective_from: "2026-06-01", target: 2, low: null, high: null, phasing: null, note: null, deleted_at: null },
      { id: "c", kpi_key: "k", dim_key: "", period_kind: "week", effective_from: "2026-12-01", target: 3, low: null, high: null, phasing: null, note: null, deleted_at: null },
      { id: "d", kpi_key: "k", dim_key: "PNN", period_kind: "week", effective_from: "2026-01-01", target: 9, low: null, high: null, phasing: null, note: null, deleted_at: null },
      { id: "e", kpi_key: "k", dim_key: "", period_kind: "week", effective_from: "2026-07-01", target: 8, low: null, high: null, phasing: null, note: null, deleted_at: NOW },
    ];
    expect(targetInForce(rows, "k", "", "week", "2026-10-12")?.id).toBe("b");
    expect(targetInForce(rows, "k", "", "week", "2026-01-01")?.id).toBe("a");
    expect(targetInForce(rows, "k", "PNN", "week", "2026-10-12")?.id).toBe("d");
    expect(targetInForce(rows, "k", "", "month", "2026-10-01")).toBeNull();
    expect(ddAllowedDimKeys({ dims: "farm,strain" })).toEqual(["", "PNN", "ARL", "PNS"]);
    expect(ddAllowedDimKeys({ dims: "bucket" })).toEqual([""]);
  });

  it("a target saves one log row per non blank field, refuses a duplicate, a bad range, a cadence word, and a dim outside the list, and a void logs one row", async () => {
    const m = await migratedDb();
    person(m);
    const saved = await saveDirectorTarget(
      m.db,
      "bizops.compliance_issues_opened_count",
      form({
        dim_key: "PNN",
        period_kind: "week",
        effective_from: "2026-10-12",
        target: "10",
        low: "1",
        high: "20",
        phasing: "",
        note: "lane",
        reason: "set the lane",
      }),
      NOW
    );
    expect(saved.redirect).toContain("/admin/director/kpi/bizops.compliance_issues_opened_count?ok=target");
    const row = m.get(`SELECT id FROM dd_targets WHERE kpi_key = 'bizops.compliance_issues_opened_count' AND deleted_at IS NULL`);
    const logs = m.all(`SELECT field FROM record_change_log WHERE record_table = 'dd_targets' AND record_id = ? ORDER BY field`, String(row?.id));
    expect(logs.map((item) => item.field).sort()).toEqual(
      ["created_at", "created_by", "dim_key", "effective_from", "high", "kpi_key", "low", "note", "period_kind", "target", "updated_at", "updated_by"].sort()
    );
    await expect(
      saveDirectorTarget(
        m.db,
        "bizops.compliance_issues_opened_count",
        form({ dim_key: "PNN", period_kind: "week", effective_from: "2026-10-12", target: "11", reason: "again" }),
        NOW
      )
    ).rejects.toMatchObject({ status: 400, message: "A goal for that week already starts on that date." });
    expect(m.get(`SELECT COUNT(*) AS n FROM dd_targets WHERE deleted_at IS NULL`)?.n).toBe(1);
    await expect(
      saveDirectorTarget(
        m.db,
        "bizops.compliance_issues_opened_count",
        form({ dim_key: "", period_kind: "week", effective_from: "2026-10-05", target: "4", low: "9", high: "2", reason: "range" }),
        NOW
      )
    ).rejects.toMatchObject({ status: 400, message: "The low number must be at most the high number." });
    await expect(
      saveDirectorTarget(
        m.db,
        "bizops.compliance_issues_opened_count",
        form({ dim_key: "", period_kind: "weekly", effective_from: "2026-10-05", target: "4", reason: "cadence" }),
        NOW
      )
    ).rejects.toMatchObject({ status: 400, message: "Pick a day, a week, a month, a quarter, or a season." });
    await expect(
      saveDirectorTarget(
        m.db,
        "bizops.compliance_issues_opened_count",
        form({ dim_key: "strain", period_kind: "week", effective_from: "2026-10-05", target: "4", reason: "dim" }),
        NOW
      )
    ).rejects.toMatchObject({ status: 400, message: "That farm is not one this number uses." });
    const voided = await voidDirectorTarget(m.db, String(row?.id), form({ reason: "retire it" }), NOW);
    expect(voided.redirect).toContain("ok=voided");
    expect(m.get(`SELECT deleted_at FROM dd_targets WHERE id = ?`, String(row?.id))?.deleted_at).toBe(NOW);
    const voidLogs = m.all(`SELECT field, new_value FROM record_change_log WHERE record_table = 'dd_targets' AND record_id = ? AND field = 'deleted_at'`, String(row?.id));
    expect(voidLogs).toEqual([{ field: "deleted_at", new_value: NOW }]);
    await expect(voidDirectorTarget(m.db, String(row?.id), form({ reason: "again" }), NOW)).rejects.toMatchObject({
      status: 400,
      message: "That goal is already removed.",
    });
  });

  it("the detail names the dim and the person, and the wall fills a blank goal from the target in force", async () => {
    const m = await migratedDb();
    person(m);
    await saveDirectorGrid(
      m.db,
      "bizops",
      "weekly",
      DAY,
      DAY,
      form({ reason: "Weekly entry", "cell:bizops.compliance_issues_opened_count|PNN": "4" }),
      NOW
    );
    const detail = await loadDirectorDetail(m.db, "bizops.compliance_issues_opened_count", DAY);
    const html = directorDetailPage(detail, "en");
    expect(html).toContain(">actor<");
    expect(html).toContain(">PNN<");
    expect(html).toContain("W42, Oct 12 to 18");
    expect(html).toContain('data-dd-target-form');
    m.run(
      `INSERT INTO dd_kpi_values (id, kpi_key, period_kind, period_start, dim_key, value, goal, source, computed_at, def_version, created_at)
       VALUES ('g1', 'bizops.lbs_processed', 'day', ?, '', 10, NULL, 'app', ?, 1, ?)`,
      DAY,
      NOW,
      NOW
    );
    m.run(
      `INSERT INTO dd_targets (id, kpi_key, dim_key, period_kind, effective_from, target, created_at, updated_at)
       VALUES ('tg1', 'bizops.lbs_processed', '', 'day', '2026-01-01', 40, ?, ?)`,
      NOW,
      NOW
    );
    const wall = await loadDirectorWall(m.db, "bizops", DAY, null, null, NOW);
    const tile = wall.groups.flatMap((group) => group.tiles.concat(group.tiles.flatMap((item) => item.companions))).find((item) => item.kpi.kpi_key === "bizops.lbs_processed");
    expect(tile?.snapshot?.goal).toBe(40);
    expect(directorWallPage(wall, "en")).toContain('data-dd-goal="40"');
    const home = directorHomePage(await loadDirectorHome(m.db, DAY, NOW), "en");
    expect(home).toContain('data-dd-import');
    expect(home).toContain('href="/admin/director/import"');
    expect(home).toContain('href="/admin/director/questions"');
  });

  it("a ruling writes config, bumps every named KPI, restates open app rows, and leaves an unchanged value and a bad value alone", async () => {
    const m = await migratedDb();
    person(m);
    for (const question of DD_QUESTIONS) {
      expect(question.config_key, question.question_key).toBeTruthy();
      expect(DD_CONFIG_RULES[String(question.config_key)], String(question.config_key)).toBeTruthy();
    }
    const before = m.get(`SELECT COUNT(*) AS n FROM record_change_log`)?.n;
    const same = await ruleDirectorQuestion(m.db, "active_window", form({ value: "30", reason: "same window" }), DAY, NOW);
    expect(same.redirect).toContain("ok=nochange");
    expect(m.get(`SELECT COUNT(*) AS n FROM record_change_log`)?.n).toBe(before);
    expect(m.get(`SELECT def_version FROM dd_kpis WHERE kpi_key = 'sales.active_accounts_count'`)?.def_version).toBe(1);
    await expect(ruleDirectorQuestion(m.db, "ppp_basis", form({ value: "nope", reason: "bad" }), DAY, NOW)).rejects.toMatchObject({ status: 400 });
    expect(m.get(`SELECT COUNT(*) AS n FROM record_change_log`)?.n).toBe(before);
    const ruled = await ruleDirectorQuestion(m.db, "active_window", form({ value: "45", reason: "wider window" }), DAY, NOW);
    expect(ruled.redirect).toContain("ok=ruled");
    expect(m.get(`SELECT value FROM app_config WHERE key = 'dd_sales_active_days' AND deleted_at IS NULL`)?.value).toBe("45");
    expect(m.get(`SELECT COUNT(*) AS n FROM record_change_log WHERE record_table = 'app_config' AND record_id = 'dd_sales_active_days' AND field = 'value' AND new_value = '45'`)?.n).toBe(1);
    const questions = await loadDirectorQuestions(m.db);
    const page = directorQuestionsPage(questions, "en", "ruled");
    expect(page.match(/data-dd-question="/g)).toHaveLength(17);
    expect(page).toContain('data-dd-question="active_window"');
    expect(page).toContain('data-dd-current="45"');
    expect(page).toContain("Status: Ruled");
    const counted = countedDb(m.db);
    await loadDirectorQuestions(counted.db);
    expect(counted.counts).toEqual({ batches: 1, direct: 0 });
  });

  it("week_definition bumps every weekly KPI, and htd_start bumps harvest.ppp_dry_lb and restates open app rows only", async () => {
    const weekDb = await migratedDb();
    person(weekDb);
    expect(DD_KPIS.filter((row) => row.cadence === "weekly")).toHaveLength(33);
    await ruleDirectorQuestion(weekDb.db, "week_definition", form({ value: "harvest", reason: "label" }), DAY, NOW);
    expect(weekDb.get(`SELECT COUNT(*) AS n FROM dd_kpis WHERE def_version = 2`)?.n).toBe(33);
    expect(weekDb.get(`SELECT COUNT(*) AS n FROM record_change_log WHERE record_table = 'dd_kpis' AND field = 'def_version' AND new_value = '2'`)?.n).toBe(33);
    const m = await migratedDb();
    person(m);
    m.run(
      `INSERT INTO dd_kpi_values (id, kpi_key, period_kind, period_start, dim_key, value, source, computed_at, def_version, created_at) VALUES
        ('open-today', 'harvest.ppp_dry_lb', 'day', '2026-10-15', '', 1, 'app', ?, 1, ?),
        ('open-yday', 'harvest.ppp_dry_lb', 'day', '2026-10-14', '', 2, 'app', ?, 1, ?),
        ('closed', 'harvest.ppp_dry_lb', 'day', '2026-10-13', '', 3, 'app', ?, 1, ?),
        ('hand-today', 'harvest.ppp_dry_lb', 'day', '2026-10-15', 'PNN', 4, 'hand', ?, 1, ?)`,
      NOW,
      NOW,
      NOW,
      NOW,
      NOW,
      NOW,
      NOW,
      NOW
    );
    const dry = m.get(`SELECT config_key, def_version FROM dd_kpis WHERE kpi_key = 'harvest.ppp_dry_lb'`);
    expect(dry?.config_key).not.toBe("dd_sales_htd_start_mmdd");
    expect(dry?.def_version).toBe(1);
    await ruleDirectorQuestion(m.db, "htd_start", form({ value: "05-01", reason: "april moves" }), DAY, NOW);
    expect(m.get(`SELECT def_version FROM dd_kpis WHERE kpi_key = 'harvest.ppp_dry_lb'`)?.def_version).toBe(2);
    expect(m.get(`SELECT def_version FROM dd_kpis WHERE kpi_key = 'harvest.ppp_wet_lb'`)?.def_version).toBe(2);
    expect(m.get(`SELECT def_version FROM dd_kpis WHERE kpi_key = 'sales.returns_count'`)?.def_version).toBe(2);
    expect(m.get(`SELECT superseded_at FROM dd_kpi_values WHERE id = 'open-today'`)?.superseded_at).toBe(NOW);
    expect(m.get(`SELECT superseded_at FROM dd_kpi_values WHERE id = 'open-yday'`)?.superseded_at).toBe(NOW);
    expect(m.get(`SELECT superseded_at FROM dd_kpi_values WHERE id = 'closed'`)?.superseded_at).toBeNull();
    expect(m.get(`SELECT superseded_at FROM dd_kpi_values WHERE id = 'hand-today'`)?.superseded_at).toBeNull();
    expect(m.get(`SELECT COUNT(*) AS n FROM record_change_log WHERE record_id IN ('open-today', 'open-yday') AND field = 'superseded_at'`)?.n).toBe(2);
    expect(m.get(`SELECT COUNT(*) AS n FROM record_change_log WHERE record_id = 'hand-today'`)?.n).toBe(0);
  });

  it("CSV import commits 500 value rows under 100 binds, refuses bad and duplicate rows, and reads a phased target back", async () => {
    const m = await migratedDb();
    person(m);
    const ctx = await loadDirectorImportContext(m.db);
    let start = "2026-10-12";
    const lines = ["kpi_key,period_kind,period_start,dim_key,value"];
    for (let i = 0; i < 500; i += 1) {
      lines.push(`bizops.compliance_issues_opened_count,week,${start},,${i + 1}`);
      start = periodShift("week", start, -1);
    }
    const csv = lines.join("\n");
    const { db, binds } = bindDb(m.db);
    const committed = await commitDirectorImport(db, "values", form({ csv, reason: "bulk" }), NOW);
    expect(committed.redirect).toContain("ok=imported&n=500&skipped=0");
    expect(binds.length).toBeGreaterThan(0);
    expect(Math.max(...binds)).toBeLessThanOrEqual(100);
    expect(m.get(`SELECT COUNT(*) AS n FROM dd_kpi_values WHERE source = 'hand' AND kpi_key = 'bizops.compliance_issues_opened_count'`)?.n).toBe(500);
    expect(m.get(`SELECT COUNT(*) AS n FROM record_change_log WHERE record_table = 'dd_kpi_values' AND field = 'value'`)?.n).toBe(500);
    const bad = ["kpi_key,period_kind,period_start,dim_key,value", "no.such,week,2026-10-12,,1", "bizops.compliance_issues_opened_count,week,2026-10-12,,abc"].join("\n");
    const preview = inspectDdImport("values", bad, ctx);
    expect(preview.errors).toBe(2);
    expect(preview.rows.every((row) => row.error)).toBe(true);
    const before = m.get(`SELECT COUNT(*) AS n FROM dd_kpi_values`)?.n;
    await expect(commitDirectorImport(m.db, "values", form({ csv: bad, reason: "bad" }), NOW)).rejects.toMatchObject({ status: 400 });
    expect(m.get(`SELECT COUNT(*) AS n FROM dd_kpi_values`)?.n).toBe(before);
    const dash = `kpi_key,period_kind,period_start,dim_key,value\nbizops.compliance_issues_opened_count,week,2026-10-12,,1${String.fromCharCode(0x2013)}2`;
    expect(inspectDdImport("values", dash, ctx).rows[0]?.error?.key).toBe("A dash character is not allowed.");
    const dupValues = ["kpi_key,period_kind,period_start,dim_key,value", "bizops.compliance_issues_opened_count,week,2026-09-28,,1", "bizops.compliance_issues_opened_count,week,2026-09-28,,2"].join("\n");
    expect(inspectDdImport("values", dupValues, ctx).errors).toBe(1);
    const noted = ["kpi_key,period_kind,period_start,dim_key,value,note", "bizops.compliance_issues_opened_count,week,2026-09-28,,1,hello"].join("\n");
    expect(inspectDdImport("values", noted, ctx).fileError?.key).toBe("A values CSV cannot carry a note column.");
    const targets = ["kpi_key,dim_key,period_kind,effective_from,target,low,high,phasing,note", "bizops.compliance_issues_opened_count,,week,2026-01-01,520,,,flat,"].join("\n");
    const targetCommit = await commitDirectorImport(m.db, "targets", form({ csv: targets, reason: "phase it" }), NOW);
    expect(targetCommit.redirect).toContain("ok=imported&n=1");
    const stored = m.all(`SELECT * FROM dd_targets WHERE kpi_key = 'bizops.compliance_issues_opened_count' AND deleted_at IS NULL AND phasing = 'flat'`);
    expect(stored).toHaveLength(1);
    expect(targetInForce(stored.map(asTarget), "bizops.compliance_issues_opened_count", "", "week", "2026-10-12")?.phasing).toBe("flat");
    expect(phasedGoal(520, "flat", "week", "2026-10-12")).toBe(10);
    const dupTargets = ["kpi_key,dim_key,period_kind,effective_from,target,low,high,phasing,note", "bizops.biomass_shipped_lb,,week,2026-02-01,10,,,,,", "bizops.biomass_shipped_lb,,week,2026-02-01,11,,,,,"].join("\n");
    expect(inspectDdImport("targets", dupTargets, ctx).errors).toBe(1);
    const liveDup = ["kpi_key,dim_key,period_kind,effective_from,target,low,high,phasing,note", "bizops.compliance_issues_opened_count,,week,2026-01-01,100,,,flat,again"].join("\n");
    const again = await loadDirectorImportContext(m.db);
    expect(inspectDdImport("targets", liveDup, again).errors).toBe(1);
    expect(directorImportPage("en")).toContain('data-dd-import-form="values"');
    expect(directorImportPage("en")).toContain('data-dd-import-form="targets"');
    const index = await source("index.ts");
    const deptAt = index.indexOf("DIRECTOR_PATH}/:dept");
    expect(index.indexOf("DIRECTOR_PATH}/questions")).toBeLessThan(deptAt);
    expect(index.indexOf("DIRECTOR_PATH}/import")).toBeLessThan(deptAt);
  });
});

describe("DD S2c: the weekly check-in", () => {
  function cardTag(page: string, key: string): string {
    return page.match(new RegExp(`<details data-dd-card="${key}"[^>]*>`))?.[0] ?? "";
  }

  it("counts progress, collapses a filled card, and speaks in plain words", async () => {
    const m = await migratedDb();
    const empty = await loadDirectorGrid(m.db, "bizops", DAY, "weekly", null);
    const emptyPage = directorGridPage(empty, "en", "actor@local");
    expect(emptyPage).not.toContain("data-dd-reason");
    expect(emptyPage).toContain('value="Weekly check-in"');
    expect(emptyPage).not.toContain("Not entered here");
    const past = directorGridPage(await loadDirectorGrid(m.db, "bizops", DAY, "weekly", "2026-10-05"), "en");
    expect(past).toContain("data-dd-reason");
    expect(past).toContain("You are changing a saved number. Say why.");
    // S2c gate fix: a saved number on the current week does not make the why box required; it opens only when a saved card is opened.
    m.run(
      `INSERT INTO dd_kpi_values (id, kpi_key, period_kind, period_start, dim_key, value, source, computed_at, def_version, created_at)
       VALUES ('s2c-gate-why', 'bizops.labor_forecast_hours', 'week', '2026-10-12', '', 140, 'hand', ?, 1, ?)`,
      NOW,
      NOW
    );
    const halfDone = directorGridPage(await loadDirectorGrid(m.db, "bizops", DAY, "weekly", null), "en");
    expect(halfDone).not.toContain("data-dd-reason");
    expect(halfDone).toContain('name="reason" value="Weekly check-in" data-dd-why-default');
    expect(halfDone).toMatch(/data-dd-why-wrap hidden style="display:none"/);
    expect(halfDone).not.toMatch(/<input[^>]*data-dd-why[^>]*required/);
    m.run(`DELETE FROM dd_kpi_values WHERE id = 's2c-gate-why'`);
    m.run(
      `INSERT INTO dd_kpi_values (id, kpi_key, period_kind, period_start, dim_key, value, source, computed_at, def_version, created_at)
       VALUES ('s2c-hand', 'bizops.compliance_issues_opened_count', 'week', '2026-10-12', '', 4, 'hand', ?, 1, ?)`,
      NOW,
      NOW
    );
    m.run(
      `INSERT INTO dd_targets (id, kpi_key, dim_key, period_kind, effective_from, target, created_at, updated_at)
       VALUES ('s2c-atleast', 'bizops.compliance_issues_opened_count', '', 'week', '2026-01-01', 140, ?, ?),
              ('s2c-atmost', 'finance.all_in_cost_per_dry_lb', '', 'month', '2026-01-01', 10, ?, ?)`,
      NOW,
      NOW,
      NOW,
      NOW
    );
    const model = await loadDirectorGrid(m.db, "bizops", DAY, "weekly", null);
    const page = directorGridPage(model, "en");
    const cards = model.rows.filter((row) => row.entry);
    const done = cards.filter((row) => row.cells.some((cell) => cell.dim === "" && cell.hand != null && cell.hand.value != null)).length;
    expect(page).toContain(`data-dd-progress="${done}/${cards.length}"`);
    expect(page).toContain(`${done} of ${cards.length} done`);
    const filled = cardTag(page, "bizops.compliance_issues_opened_count");
    expect(filled).toContain('data-dd-filled="1"');
    expect(filled).not.toContain(" open");
    expect(page).toContain('data-dd-shown="4"');
    expect(page).toContain(">Edit<");
    expect(page).toContain("Goal: at least 140");
    expect(page).toContain('data-dd-farms="bizops.compliance_issues_opened_count"');
    expect(page).toContain("hours");
    expect(page).toContain("pounds");
    const quiet = cards.find((row) => !row.kpi.dims.split(",").map((part) => part.trim()).includes("farm"));
    expect(quiet).toBeTruthy();
    const at = page.indexOf(`data-dd-card="${quiet?.kpi.kpi_key}"`);
    const next = page.indexOf("data-dd-card=", at + 12);
    expect(page.slice(at, next < 0 ? undefined : next)).not.toContain("data-dd-farms");
    const locked = model.rows.find((row) => !row.entry);
    expect(locked).toBeTruthy();
    expect(page).not.toContain(`data-dd-card="${locked?.kpi.kpi_key}"`);
    expect(page).toContain(`data-dd-auto-kpi="${locked?.kpi.kpi_key}"`);
    expect(page).toContain("not yet");
    const farmops = directorGridPage(await loadDirectorGrid(m.db, "farmops", DAY, "weekly", null), "en");
    expect(farmops).toContain("Farming Operations, week of Oct 12 to 18");
    const month = directorGridPage(await loadDirectorGrid(m.db, "finance", DAY, "monthly", null), "en");
    expect(month).toContain("Accounting and Finance, October 2026");
    expect(month).toContain("Goal: under $10");
    const day = directorGridPage(await loadDirectorGrid(m.db, "farmops", DAY, "daily", null), "en");
    expect(day).toContain("Farming Operations, Thursday, Oct 15");
    const quarter = directorGridPage(await loadDirectorGrid(m.db, "farmops", DAY, "quarterly", null), "en");
    expect(quarter).toContain("Farming Operations, Q4 2026");
    const sample = model.rows.find((row) => row.entry);
    expect(sample).toBeTruthy();
    const total = sample?.cells.find((cell) => cell.dim === "") ?? sample?.cells[0];
    const unitPage = (unit: string) =>
      directorGridPage(
        {
          ...model,
          rows: [
            {
              ...sample!,
              kpi: { ...sample!.kpi, unit: unit as "g" | "ea" | "L" | "days" | "usd" | "pct" | "count", dims: "", kpi_key: "t.unit", title_en: "Sample", source_kind: "hand" },
              entry: true,
              otherDims: [],
              cells: [{ ...total!, dim: "" }],
              goal: null,
            },
          ],
        },
        "en"
      );
    expect(unitPage("g")).toContain("grams");
    expect(unitPage("ea")).toContain("each");
    expect(unitPage("L")).toContain("liters");
    expect(unitPage("days")).toContain("days");
    expect(unitPage("usd")).toContain('data-dd-unit="usd"');
    expect(unitPage("pct")).toContain('data-dd-unit="pct"');
    const countHtml = unitPage("count");
    const countAt = countHtml.indexOf('data-dd-card="t.unit"');
    expect(countHtml.slice(countAt, countHtml.indexOf("</details>", countAt))).not.toContain("dd-unit-word");
  });

  it("keeps the definition inside its closed section and hides a yearly spread on a quarter", async () => {
    const m = await migratedDb();
    const html = directorDetailPage(await loadDirectorDetail(m.db, "bizops.compliance_issues_opened_count", DAY), "en");
    const at = html.indexOf("data-dd-definition");
    expect(at).toBeGreaterThan(0);
    const before = html.slice(0, at);
    for (const label of ["Goal kind", "Goal ref", "Compute key", "Definition version", "Dimensions"]) {
      expect(before, label).not.toContain(label);
    }
    const block = html.slice(at, html.indexOf("</details>", at));
    expect(block).toContain("Goal kind");
    expect(block).toContain("Goal ref");
    expect(block).toContain("Compute key");
    expect(block).toContain("Definition version");
    expect(block).toContain("Dimensions");
    expect(html).toContain("You type it");
    expect(html).toContain("Aug 1 to Oct 31");
    expect(html).toContain("Weekly");
    const quarter = directorDetailPage(await loadDirectorDetail(m.db, "farmops.assets_for_sale_count", DAY), "en");
    expect(quarter).not.toContain("data-dd-spread");
    expect(html).toContain("data-dd-spread");
    expect(html).toContain("Set a goal");
    expect(html).toContain("Goal for each");
    expect(html).toContain("Which farm (optional)");
    expect(html).toContain('value="2026-10-12"');
  });

  it("puts open questions ahead of ruled ones and leaves every card closed", async () => {
    const m = await migratedDb();
    m.run(`INSERT INTO people (id, display_name, is_active, created_at, updated_at) VALUES ('dd-actor', 'actor', 1, ?, ?)`, NOW, NOW);
    const form = new FormData();
    form.set("person_id", "dd-actor");
    form.set("value", "45");
    form.set("reason", "wider window");
    await ruleDirectorQuestion(m.db, "active_window", form, DAY, NOW);
    const questions = await loadDirectorQuestions(m.db);
    const page = directorQuestionsPage(questions, "en");
    const open = questions.questions.filter((row) => row.status !== "ruled");
    const ruled = questions.questions.filter((row) => row.status === "ruled");
    expect(ruled.map((row) => row.question_key)).toContain("active_window");
    const lastOpen = page.lastIndexOf(`data-dd-question="${open[open.length - 1]?.question_key}"`);
    const firstRuled = page.indexOf(`data-dd-question="${ruled[0]?.question_key}"`);
    expect(lastOpen).toBeGreaterThan(-1);
    expect(firstRuled).toBeGreaterThan(lastOpen);
    expect(page).not.toMatch(/<details[^>]*\sopen/);
    expect(page).toContain("Change");
    expect(page).toContain("Status: Ruled");
  });
});
