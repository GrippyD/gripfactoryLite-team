/**
 * DD S1: the Director Dashboard registry in code (the fallback when dd_kpis
 * has no rows) and the one source migration 0105's seed is generated from.
 * ddSeedSql() prints the dd_kpis and dd_kpi_questions INSERT blocks that the
 * migration carries verbatim; a test compares the file text to this output so
 * the two never drift. A leaf module: it imports nothing.
 *
 * The registry is the S0 report's six department tables as amended by the
 * debates (SESSION_REPORTS/2026-10-15_dd_s0.md, "Registry amendments from the
 * debates"), 73 rows: every headline key of the tables with the renames
 * applied (harvest.ppp_lb to harvest.ppp_dry_lb, bizops.lot_cycle_days to
 * bizops.batch_cycle_days, finance.retail_sell_through_usd to
 * finance.state_retail_sales_usd), the two companion rows the amendments name
 * (harvest.ppp_wet_lb, bizops.moved_count), and three cross wall duplicates
 * folded into one key shown on two walls as the harvest family is (the sales
 * AR tile reads finance.ar_ap_aging_usd, the bizops remaining forecast reads
 * finance.forecast_landing_usd, the culttech strain BTR reads harvest.btr_pct).
 * The bizops copy of the wet weight tile is not a row: harvest.wet_weight_lb
 * carries wall_keys bizops,farmops.
 *
 * Registry amendment pending the owner's confirmation (recorded in the S1
 * report): the S0 tables name 74 distinct keys plus the two companion rows
 * above, and 73 is the count the S0 pins, so the three folds are the
 * builder's reading of it. The S0 text backs the first two (its lines 63 and
 * 98); the third changes the culttech strain BTR tile from a weekly strain
 * and farm row to the daily shift row of harvest.btr_pct. The companions the
 * S0 names inside a title (harvest.ppp_bud_lb, harvest.trim_output_lb,
 * sales.reorder_rate_pct and the rest of its fifteen) are views of their
 * headline row's compute in S1, not rows of their own. A ruling that wants
 * culttech.strain_btr_pct or a companion as a row appends it here and in a
 * later migration, with the btr_formula and week_definition question rows
 * reviewed with it.
 */

export const DD_SEED_AT = "2026-10-15T00:00:00.000Z";

/** The five department codes in the walls' order. title_en is the t() key the pages render. */
export const DD_DEPARTMENTS = [
  { dept_key: "bizops", sort: 10, title_en: "Business Operations" },
  { dept_key: "farmops", sort: 20, title_en: "Farming Operations" },
  { dept_key: "culttech", sort: 30, title_en: "Cultivation and Technology" },
  { dept_key: "sales", sort: 40, title_en: "Sales and Marketing" },
  { dept_key: "finance", sort: 50, title_en: "Accounting and Finance" },
] as const;

export type DdDeptKey = (typeof DD_DEPARTMENTS)[number]["dept_key"];

export const DD_DEPT_KEYS: readonly DdDeptKey[] = DD_DEPARTMENTS.map((d) => d.dept_key);

export const DD_UNITS = ["lb448", "g", "ea", "L", "usd", "pct", "count", "h", "days", "score", "ratio", "text", "mol_m2_day"] as const;
export type DdUnit = (typeof DD_UNITS)[number];

export const DD_CADENCES = ["daily", "weekly", "monthly", "quarterly", "seasonal"] as const;
export type DdCadence = (typeof DD_CADENCES)[number];

export const DD_STATUSES = ["live", "needs_definition", "parked"] as const;
export type DdStatus = (typeof DD_STATUSES)[number];

export const DD_GOAL_KINDS = ["none", "app_config", "field_estimates", "gc_budget_lines", "gc_drivers", "gc_submission", "targets", "manual"] as const;
export type DdGoalKind = (typeof DD_GOAL_KINDS)[number];

export const DD_SOURCE_KINDS = ["app", "hand", "connector", "mount", "gc", "mixed"] as const;
export type DdSourceKind = (typeof DD_SOURCE_KINDS)[number];

/**
 * The precedence between live dd_kpi_values rows of different sources on one
 * period (the unique index allows one live row per source): the first source
 * here wins the tile, whatever was computed last. Computed rows (app, mount,
 * gc, connector) come before a typed hand row, because S2's entry grid locks
 * the live computed value and a hand row is the fallback when nothing computes.
 * A source outside this list ranks last. Both page loaders order by this rank.
 */
export const DD_SOURCE_PRECEDENCE: readonly string[] = ["app", "mount", "gc", "connector", "hand", "mixed"];

/** Which side of the goal reads on goal: at least the goal (the default) or at most it (days, cost). */
export const DD_GOAL_DIRECTIONS = ["at_least", "at_most"] as const;
export type DdGoalDirection = (typeof DD_GOAL_DIRECTIONS)[number];

export const DD_PERIOD_KINDS = ["day", "week", "month", "quarter", "season"] as const;
export type DdPeriodKind = (typeof DD_PERIOD_KINDS)[number];

/** The period kind a cadence snapshots on. */
export function ddPeriodKindOf(cadence: DdCadence): DdPeriodKind {
  switch (cadence) {
    case "daily":
      return "day";
    case "weekly":
      return "week";
    case "monthly":
      return "month";
    case "quarterly":
      return "quarter";
    default:
      return "season";
  }
}

/** One dd_kpis row, the table's columns minus the timestamps. */
export type DdKpi = {
  kpi_key: string;
  dept_key: DdDeptKey;
  wall_keys: string;
  title_en: string;
  title_es: string;
  unit: DdUnit;
  cadence: DdCadence;
  season_start_md: string | null;
  season_end_md: string | null;
  dims: string;
  goal_kind: DdGoalKind;
  goal_ref: string | null;
  goal_direction: DdGoalDirection;
  compute_key: string | null;
  source_kind: DdSourceKind;
  stale_after_hours: number | null;
  status: DdStatus;
  def_version: number;
  open_question_en: string | null;
  open_question_es: string | null;
  config_key: string | null;
  companion_of: string | null;
  workbook_rows: string | null;
  sort: number;
  active: number;
};

/** The app_config keys the dashboard reads, one per ruling plus the base keys. */
export const DD_CONFIG = {
  dd_ppp_basis: "dd_ppp_basis",
  dd_sales_htd_start_mmdd: "dd_sales_htd_start_mmdd",
  dd_processed_lbs_buckets: "dd_processed_lbs_buckets",
  dd_shipped_includes_interco: "dd_shipped_includes_interco",
  dd_sales_active_days: "dd_sales_active_days",
  dd_sales_week_basis: "dd_sales_week_basis",
  dd_all_in_addback_gls: "dd_all_in_addback_gls",
  dd_plan_source: "dd_plan_source",
  dd_projection_basis: "dd_projection_basis",
  dd_moh_window_months: "dd_moh_window_months",
  dd_product_life_cycle_mode: "dd_product_life_cycle_mode",
  dd_contra_recompenses_mode: "dd_contra_recompenses_mode",
  dd_retail_report_source: "dd_retail_report_source",
  dd_market_penetration_basis: "dd_market_penetration_basis",
  dd_market_penetration_license_prefixes: "dd_market_penetration_license_prefixes",
  dd_btr_formula: "dd_btr_formula",
  dd_week_basis: "dd_week_basis",
  dd_season_start_date: "dd_season_start_date",
  dd_lot_date_law: "dd_lot_date_law",
  dd_close_target_business_days: "dd_close_target_business_days",
  dd_plants_harvested_flag: "dd_plants_harvested_flag",
  dd_goal_wet_lb_per_dlh: "dd_goal_wet_lb_per_dlh",
  dd_goal_trim_lb_per_dlh: "dd_goal_trim_lb_per_dlh",
  dd_lb_grams: "dd_lb_grams",
  dd_history_periods: "dd_history_periods",
} as const;

export type DdConfigKey = keyof typeof DD_CONFIG;

export const DD_CONFIG_KEYS: readonly DdConfigKey[] = Object.keys(DD_CONFIG) as DdConfigKey[];

/** The seeded value of every key: the S0 rulings the owner accepted on 2026-10-15. Code falls back to these. */
export const DD_CONFIG_DEFAULTS: Readonly<Record<DdConfigKey, string>> = {
  dd_ppp_basis: "dry",
  dd_sales_htd_start_mmdd: "04-01",
  dd_processed_lbs_buckets: "trim,cryo,prepack",
  dd_shipped_includes_interco: "0",
  dd_sales_active_days: "30",
  dd_sales_week_basis: "order",
  dd_all_in_addback_gls: "5570",
  dd_plan_source: "latest_final",
  dd_projection_basis: "estimates",
  dd_moh_window_months: "3",
  dd_product_life_cycle_mode: "batch_cycle",
  dd_contra_recompenses_mode: "parked",
  dd_retail_report_source: "state_cra_monthly",
  dd_market_penetration_basis: "doors",
  dd_market_penetration_license_prefixes: "",
  dd_btr_formula: "console_to_date",
  dd_week_basis: "iso",
  dd_season_start_date: "",
  dd_lot_date_law: "effective_date",
  dd_close_target_business_days: "10",
  dd_plants_harvested_flag: "finished",
  dd_goal_wet_lb_per_dlh: "",
  dd_goal_trim_lb_per_dlh: "",
  dd_lb_grams: "448",
  dd_history_periods: "8",
};

export const DD_HISTORY_PERIODS_DEFAULT = 8;
export const DD_HISTORY_PERIODS_MAX = 52;
export const DD_LB_GRAMS_DEFAULT = 448;

/** Periods of history a wall tile's sparkline reads: a whole number 1 to 52; 8 otherwise. */
export function ddHistoryPeriods(raw: string | null | undefined): number {
  const text = String(raw ?? "").trim();
  if (!/^\d{1,2}$/.test(text)) return DD_HISTORY_PERIODS_DEFAULT;
  const n = Number(text);
  return n >= 1 && n <= DD_HISTORY_PERIODS_MAX ? n : DD_HISTORY_PERIODS_DEFAULT;
}

/** Grams in the dashboard's pound (read only, shown beside standard pounds): a number above 0; 448 otherwise. */
export function ddLbGrams(raw: string | null | undefined): number {
  const n = Number(String(raw ?? "").trim());
  return Number.isFinite(n) && n > 0 ? n : DD_LB_GRAMS_DEFAULT;
}

/** The pinned season start (dd_season_start_date): a real YYYY-MM-DD, else null (blank until the first cut lands). */
export function ddSeasonStartDate(raw: string | null | undefined): string | null {
  const text = String(raw ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
  const ms = Date.parse(`${text}T00:00:00.000Z`);
  return Number.isFinite(ms) && new Date(ms).toISOString().slice(0, 10) === text ? text : null;
}

type KpiInput = Omit<
  DdKpi,
  "sort" | "active" | "def_version" | "status" | "season_start_md" | "season_end_md" | "dims" | "goal_kind" | "goal_ref" | "goal_direction" | "config_key" | "companion_of" | "open_question_es"
> & {
  season?: string;
  dims?: string;
  goal_kind?: DdGoalKind;
  goal_ref?: string | null;
  goal_direction?: DdGoalDirection;
  config_key?: string | null;
  companion_of?: string | null;
  status?: DdStatus;
  open_question_es: string | null;
};

const K = (row: KpiInput): Omit<DdKpi, "sort"> => {
  const season = row.season ?? "";
  const m = /^(\d{2}-\d{2}) to (\d{2}-\d{2})$/.exec(season);
  return {
    kpi_key: row.kpi_key,
    dept_key: row.dept_key,
    wall_keys: row.wall_keys,
    title_en: row.title_en,
    title_es: row.title_es,
    unit: row.unit,
    cadence: row.cadence,
    season_start_md: m ? m[1] : null,
    season_end_md: m ? m[2] : null,
    dims: row.dims ?? "",
    goal_kind: row.goal_kind ?? "none",
    goal_ref: row.goal_ref ?? null,
    goal_direction: row.goal_direction ?? "at_least",
    compute_key: row.compute_key,
    source_kind: row.source_kind,
    stale_after_hours: row.stale_after_hours,
    status: row.status ?? "live",
    def_version: 1,
    open_question_en: row.open_question_en,
    open_question_es: row.open_question_es,
    config_key: row.config_key ?? null,
    companion_of: row.companion_of ?? null,
    workbook_rows: row.workbook_rows,
    active: 1,
  };
};

const ROWS: ReadonlyArray<Omit<DdKpi, "sort">> = [
  // bizops (Business Operations)
  K({
    kpi_key: "bizops.lbs_processed",
    dept_key: "bizops",
    wall_keys: "bizops",
    title_en: "Lbs processed",
    title_es: "Libras procesadas",
    unit: "lb448",
    cadence: "daily",
    season: "10-01 to 12-31",
    dims: "bucket",
    compute_key:
      "console.trimFigures over the trim day SQL (src/console.ts:2884-2892, :465-559) for the trim bucket; pasteurizationFigures for cryo; loadPrepackSection for prepack; buckets side by side, never summed; rad is not a bucket",
    source_kind: "app",
    stale_after_hours: 30,
    open_question_en: "Trim line only, or every line (debate processed_lbs)",
    open_question_es: "Solo la línea de recorte, o todas las líneas (debate processed_lbs)",
    config_key: "dd_processed_lbs_buckets",
    workbook_rows: "14",
  }),
  K({
    kpi_key: "bizops.lbs_shipped",
    dept_key: "bizops",
    wall_keys: "bizops",
    title_en: "Lbs shipped",
    title_es: "Libras enviadas",
    unit: "lb448",
    cadence: "daily",
    season: "10-01 to 12-31",
    dims: "product,destination",
    compute_key:
      "the Shipped set: Zoho mount lines gated on internal_status = shipped and dated by farmDay of the flip instant (fulfillment.pipelineCounts, src/fulfillment.ts:293-324, quantity_invoiced :315) plus marketplace sales_orders at the fulfilled step (src/biz.ts:805-830), external destinations only (isExternalLicense after a trim and uppercase normalizer); METRC outgoing transfers after S13",
    source_kind: "mount",
    stale_after_hours: 30,
    open_question_en: "Interco in or out (debate shipped_interco); the mount has no shipped date",
    open_question_es: "Interco dentro o fuera (debate shipped_interco); el montaje no tiene fecha de envío",
    config_key: "dd_shipped_includes_interco",
    workbook_rows: "14,62",
  }),
  K({
    kpi_key: "bizops.shipments_count",
    dept_key: "bizops",
    wall_keys: "bizops,sales",
    title_en: "Shipments",
    title_es: "Envíos",
    unit: "count",
    cadence: "daily",
    dims: "product,destination",
    compute_key: "as bizops.lbs_shipped: COUNT(DISTINCT so_number) over the Shipped set; the sales list's row 4 shipments reads the same set",
    source_kind: "mount",
    stale_after_hours: 30,
    open_question_en: "Interco in or out (debate shipped_interco); the mount has no shipped date",
    open_question_es: "Interco dentro o fuera (debate shipped_interco); el montaje no tiene fecha de envío",
    config_key: "dd_shipped_includes_interco",
    workbook_rows: "62,4",
  }),
  K({
    kpi_key: "bizops.moved_count",
    dept_key: "bizops",
    wall_keys: "bizops",
    title_en: "Moved by destination site",
    title_es: "Movidos por sitio de destino",
    unit: "count",
    cadence: "daily",
    dims: "destination_site",
    compute_key:
      "own licence moves from the same Shipped compute (siteOfLicense(destination_license) on interco_movements), printed beside Shipped and never added to it; dd_shipped_includes_interco folds it into Shipped without a code change",
    source_kind: "mount",
    stale_after_hours: 30,
    open_question_en: "A destination the normalizer does not recognise is badged, not counted",
    open_question_es: "Un destino que el normalizador no reconoce se marca, no se cuenta",
    config_key: "dd_shipped_includes_interco",
    companion_of: "bizops.shipments_count",
    workbook_rows: "62",
  }),
  K({
    kpi_key: "bizops.biomass_shipped_lb",
    dept_key: "bizops",
    wall_keys: "bizops",
    title_en: "Biomass shipped vs scheduled",
    title_es: "Biomasa enviada vs programada",
    unit: "lb448",
    cadence: "weekly",
    dims: "customer",
    goal_kind: "targets",
    goal_ref: "dd_targets",
    compute_key:
      "TRIM and BIO shipped lines from the Shipped compute; on hand from fginventory FG_LEDGER_SQL Trim/Bio (src/fginventory.ts:303-391); schedule typed in dd_targets until METRC transfers",
    source_kind: "mixed",
    stale_after_hours: 192,
    open_question_en: "Where the schedule lives; BIO prefixed items counted with TRIM or not",
    open_question_es: "Dónde vive el programa; si los artículos con prefijo BIO cuentan con TRIM o no",
    config_key: "dd_shipped_includes_interco",
    workbook_rows: "59",
  }),
  K({
    kpi_key: "bizops.inventory_by_stage_lb",
    dept_key: "bizops",
    wall_keys: "bizops",
    title_en: "Inventory by stage",
    title_es: "Inventario por etapa",
    unit: "lb448",
    cadence: "weekly",
    season: "10-01 to 01-31",
    dims: "bucket,unit",
    compute_key:
      "inventory.buildInventorySheet rows (src/inventory.ts:219-352, src/db.ts:1706-1745) plus metrc.metrcFgInventory per license (src/metrc.ts:2322-2341) and silo.dryingTotals (src/silo.ts:794-820); week end snapshot; toll lots shown apart (ownLotSql); ea and L as companion units",
    source_kind: "app",
    stale_after_hours: 192,
    open_question_en: "Unit = unit of measure or farm; which stage list (the /inventory sheet's seven rows or the /harvest panes)",
    open_question_es: "Unidad = unidad de medida o granja; qué lista de etapas (las siete filas de la hoja /inventory o los paneles de /harvest)",
    workbook_rows: "16",
  }),
  K({
    kpi_key: "bizops.metrc_harvest_variance_lb",
    dept_key: "bizops",
    wall_keys: "bizops",
    title_en: "METRC reconciliation, floor vs METRC",
    title_es: "Conciliación METRC, piso vs METRC",
    unit: "lb448",
    cadence: "weekly",
    season: "09-01 to 11-30",
    dims: "farm",
    compute_key:
      "harvestreconciliation.loadHarvestReconciliation (src/harvestreconciliation.ts:672-697, both pounds :84-100) summed per week of harvest_batches.entry_date; missing mirror count",
    source_kind: "app",
    stale_after_hours: 192,
    open_question_en: null,
    open_question_es: null,
    workbook_rows: "17",
  }),
  K({
    kpi_key: "bizops.harvest_goal_pct",
    dept_key: "bizops",
    wall_keys: "bizops",
    title_en: "Harvest to date vs goal",
    title_es: "Cosecha a la fecha vs meta",
    unit: "pct",
    cadence: "weekly",
    season: "09-01 to 11-30",
    dims: "farm",
    goal_kind: "field_estimates",
    goal_ref: "estimateInForce",
    compute_key:
      "strainperformance.buildStrainPerformance seasonLb and harvestedDryLb (src/strainperformance.ts:311-339) over the field_estimates goal in force (yield goals stay on field_estimates per the plan_source ruling)",
    source_kind: "app",
    stale_after_hours: 192,
    open_question_en: "Which goal (debate plan_source); wet or dry",
    open_question_es: "Qué meta (debate plan_source); húmedo o seco",
    config_key: "dd_plan_source",
    workbook_rows: "17",
  }),
  K({
    kpi_key: "bizops.compliance_issues_opened_count",
    dept_key: "bizops",
    wall_keys: "bizops",
    title_en: "Compliance issues opened",
    title_es: "Incidencias de cumplimiento abiertas",
    unit: "count",
    cadence: "weekly",
    season: "08-01 to 10-31",
    dims: "farm,bucket,severity",
    compute_key:
      "dd_issues log (kind compliance, S8); companions open at week end and average days open; optional auto counts from lab_compliance_samples failed rows (src/biz.ts:44-51) and METRC holds (metrc_plants.hold, metrc_packages.admin_hold) once ruled; monthly roll up for row 63",
    source_kind: "hand",
    stale_after_hours: 192,
    open_question_en: "What counts as an issue and which signals auto feed",
    open_question_es: "Qué cuenta como incidencia y qué señales alimentan automáticamente",
    workbook_rows: "18,63",
  }),
  K({
    kpi_key: "bizops.lab_samples_submitted_count",
    dept_key: "bizops",
    wall_keys: "bizops",
    title_en: "Lab samples submitted",
    title_es: "Muestras de laboratorio enviadas",
    unit: "count",
    cadence: "weekly",
    season: "10-01 to 12-31",
    compute_key:
      "lab_compliance_samples under labvocab LAB_CONSOLE_SET_SQL, LAB_OUTCOME_SQL, LAB_ATTEMPT_SQL (src/labvocab.ts:13, :51, :60), entered and finished dates; returned, passed, failed, pass rate and mean THC as companions; farm and strain as drill; the daily cadence reads the same key",
    source_kind: "app",
    stale_after_hours: 192,
    open_question_en: "Which date keys the week; a completed row may have no finished_testing_on (src/labrules.ts:548-552)",
    open_question_es: "Qué fecha define la semana; una fila completada puede no tener finished_testing_on (src/labrules.ts:548-552)",
    config_key: "dd_week_basis",
    workbook_rows: "19,55",
  }),
  K({
    kpi_key: "bizops.lab_turnaround_days",
    dept_key: "bizops",
    wall_keys: "bizops",
    title_en: "Testing turnaround",
    title_es: "Tiempo de respuesta de pruebas",
    unit: "days",
    cadence: "daily",
    goal_kind: "targets",
    goal_ref: "testing_labs.turnaround_days",
    goal_direction: "at_most",
    compute_key:
      "labrules.turnaroundDays per sample (src/labrules.ts:612-618) averaged over rows finished on the day; goal = testing_labs.turnaround_days (promised, src/testing.ts:55); parity reference src/lab.ts:1095 without julianday and with the program clause",
    source_kind: "app",
    stale_after_hours: 30,
    open_question_en: "Compliance lab only, or also the bench and Orange Photonics counts",
    open_question_es: "Solo el laboratorio de cumplimiento, o también los conteos de mesa y de Orange Photonics",
    workbook_rows: "55",
  }),
  K({
    kpi_key: "bizops.ftq_pct",
    dept_key: "bizops",
    wall_keys: "bizops",
    title_en: "FTQ by harvest week",
    title_es: "FTQ por semana de cosecha",
    unit: "pct",
    cadence: "weekly",
    compute_key:
      "console.buildTestingFigures first time filter (src/console.ts:2287-2294, rate :2343) with a week bucket in place of sheetInSeason; parity with the /harvest season tile and the /compliance tile; farm, strain and product as drill",
    source_kind: "app",
    stale_after_hours: 192,
    open_question_en: "The week date key (harvest date per canon, else entered or finished) and rows versus dedupe by sample_tag",
    open_question_es: "La fecha que define la semana (fecha de cosecha según el canon, si no la de ingreso o la de término) y filas versus deduplicación por sample_tag",
    config_key: "dd_week_basis",
    workbook_rows: "56",
  }),
  K({
    kpi_key: "bizops.test_failures_by_mode_count",
    dept_key: "bizops",
    wall_keys: "bizops",
    title_en: "Failure modes (Pareto)",
    title_es: "Modos de falla (Pareto)",
    unit: "count",
    cadence: "weekly",
    dims: "bucket,strain,farm",
    compute_key: "console.buildTestingFigures modes map (src/console.ts:2295-2337) by week; parity with the /harvest donut",
    source_kind: "app",
    stale_after_hours: 192,
    open_question_en: "Combined fail reasons as one mode (/harvest) or one count per analyte (/compliance); first time only or retests too",
    open_question_es: "Motivos de falla combinados como un solo modo (/harvest) o un conteo por analito (/compliance); solo primera vez o también repeticiones",
    workbook_rows: "57",
  }),
  K({
    kpi_key: "bizops.env_in_range_pct_by_space",
    dept_key: "bizops",
    wall_keys: "bizops,culttech",
    title_en: "Environmentals, percent of hours in range",
    title_es: "Ambientales, porcentaje de horas en rango",
    unit: "pct",
    cadence: "weekly",
    dims: "space,role",
    goal_kind: "targets",
    goal_ref: "environment_ranges",
    compute_key:
      "SQL over sensor_hourly joined to environment_ranges with sensorhistory.weighted and extreme for the room mean (src/sensorhistory.ts:361-382), Eastern week edges, capped at sensor_rollup_through, never sensor_readings; the daily cadence reads the same key for culttech",
    source_kind: "app",
    stale_after_hours: 192,
    open_question_en: "Out of range by hourly average or by min and max; past weeks judged by today's ranges",
    open_question_es: "Fuera de rango por promedio horario o por mínimo y máximo; semanas pasadas juzgadas con los rangos de hoy",
    workbook_rows: "54,78",
  }),
  K({
    kpi_key: "bizops.prepack_months_on_hand",
    dept_key: "bizops",
    wall_keys: "bizops",
    title_en: "MOH prepack by strain",
    title_es: "MOH de preempaque por variedad",
    unit: "ratio",
    cadence: "weekly",
    dims: "strain",
    compute_key:
      "fginventory.buildFgInventory pre bag per strain (src/fginventory.ts:658-662, :719-721) over the trailing dd_moh_window_months PREPACK velocity from mounted_sales_order_lines (internal_status = shipped, quantity_invoiced, strain by itemStrain, orders by order_date); the stock column always shown; the zero case prints no shipped prepack in window",
    source_kind: "mount",
    stale_after_hours: 192,
    open_question_en: "Months on hand or material on hand (debate moh)",
    open_question_es: "Meses de existencias o material en existencia (debate moh)",
    config_key: "dd_moh_window_months",
    workbook_rows: "61",
  }),
  K({
    kpi_key: "bizops.product_mix_pct",
    dept_key: "bizops",
    wall_keys: "bizops",
    title_en: "Product mix",
    title_es: "Mezcla de productos",
    unit: "pct",
    cadence: "monthly",
    dims: "bucket",
    goal_kind: "gc_submission",
    goal_ref: "drivers.vol.btr,drivers.vol.prepackPct",
    compute_key:
      "TRIM_SEASON_SQL pool (src/console.ts:2674-2680) bucketed by puzzles.productBucket, not listProductMix (no source, own lot or deleted filters, src/db.ts:3684-3693); month window on trim_date; a notes box per month",
    source_kind: "app",
    stale_after_hours: 960,
    open_question_en: "Month slice or season to date; cryo sourced and toll packages in or out; notes box per month",
    open_question_es: "Corte mensual o temporada a la fecha; paquetes de origen cryo y de maquila dentro o fuera; caja de notas por mes",
    workbook_rows: "60",
  }),
  K({
    kpi_key: "bizops.batch_cycle_days",
    dept_key: "bizops",
    wall_keys: "bizops",
    title_en: "Batch cycle days",
    title_es: "Días de ciclo por lote",
    unit: "days",
    cadence: "monthly",
    dims: "strain",
    compute_key:
      "harvest_batches.entry_date to the kept testing release row per harvest batch (listTatStatusLogs, src/db.ts:3715-3743), the sixth TAT metric entry_to_release shared with /reports/tats; the open batch count beside it",
    source_kind: "app",
    stale_after_hours: 960,
    open_question_en: "Lot cycle time or SKU lifecycle stage (debate product_life_cycle)",
    open_question_es: "Tiempo de ciclo del lote o etapa del ciclo de vida del SKU (debate product_life_cycle)",
    config_key: "dd_product_life_cycle_mode",
    workbook_rows: "58",
  }),
  K({
    kpi_key: "bizops.po_unplanned_pct",
    dept_key: "bizops",
    wall_keys: "bizops",
    title_en: "Planned vs unplanned POs",
    title_es: "Órdenes de compra planificadas vs no planificadas",
    unit: "pct",
    cadence: "monthly",
    compute_key:
      "purchase_orders with lines total (src/db.ts:4005-4024) matched to the PO numbers inside the gc_submissions kind bu snapshot JSON created by Mar 31 (migrations/0103:218), not live gc_build_items; count and usd as companions",
    source_kind: "mixed",
    stale_after_hours: 960,
    open_question_en: "The match key (app PO number, QuickBooks PO, Tradogram) and what submissions by March 31 means",
    open_question_es: "La clave de cruce (número de OC de la app, OC de QuickBooks, Tradogram) y qué significa entregas al 31 de marzo",
    config_key: "dd_plan_source",
    workbook_rows: "65",
  }),
  K({
    kpi_key: "bizops.labor_forecast_hours",
    dept_key: "bizops",
    wall_keys: "bizops,farmops",
    title_en: "Labor forecasting",
    title_es: "Pronóstico de mano de obra",
    unit: "h",
    cadence: "weekly",
    dims: "bucket",
    goal_kind: "targets",
    goal_ref: "dd_targets",
    compute_key:
      "gripcasting.volumesFrom and volNow over remaining plants and the console's wet per plant, dry down and BTR (src/gripcasting/model.ts:109-115, :236) with gc_build_items share and per_hour (itemQty, :152)",
    source_kind: "mixed",
    stale_after_hours: 192,
    open_question_en: "Which remaining volume drives the week and where the share comes from",
    open_question_es: "Qué volumen restante mueve la semana y de dónde sale la proporción",
    workbook_rows: "66,77",
  }),
  K({
    kpi_key: "bizops.post_harvest_labor_hours",
    dept_key: "bizops",
    wall_keys: "bizops",
    title_en: "Post harvest labor hours",
    title_es: "Horas de mano de obra poscosecha",
    unit: "h",
    cadence: "weekly",
    season: "10-01 to 12-31",
    dims: "bucket",
    goal_kind: "gc_budget_lines",
    goal_ref: "gl 5610",
    compute_key:
      "the four hours tables with the console ALL row rule (src/console.ts:3178-3213); listLaborHours lacks pasteurization (src/db.ts:5184-5212); cost companion = hours x dd_labor_rates; monthly tie to GL 5610 by differencing closes or gc_transactions by txn_date and bu_code",
    source_kind: "mixed",
    stale_after_hours: 192,
    open_question_en: "Whether cutting and bucking count as post harvest; loaded rates per operation",
    open_question_es: "Si el corte y el desgrane cuentan como poscosecha; tarifas cargadas por operación",
    workbook_rows: "20",
  }),
  // harvest (shared tiles, parity with /harvest): one key set shown on bizops and farmops
  K({
    kpi_key: "harvest.wet_weight_lb",
    dept_key: "bizops",
    wall_keys: "bizops,farmops",
    title_en: "Harvest wet weight, day and season to date",
    title_es: "Peso húmedo de cosecha, día y temporada a la fecha",
    unit: "lb448",
    cadence: "daily",
    dims: "farm",
    compute_key:
      "loadHarvestConsole dayWet and yearWet SQL (src/console.ts:2850-2869) and consoleBoxes wetDay, wetYear (:1013-1014); the day SQL gains ownLotSql and status <> weighing in S3 and the console's day pane changes with it; formatLbs at 448",
    source_kind: "app",
    stale_after_hours: 30,
    open_question_en: "The day pane carries no toll gate (ownLotSql) while the year pane does; the lot date law for the day figure (debate lot_date_law)",
    open_question_es: "El panel del día no tiene filtro de maquila (ownLotSql) y el del año sí; la ley de fecha del lote para la cifra del día (debate lot_date_law)",
    config_key: "dd_lot_date_law",
    workbook_rows: "47",
  }),
  K({
    kpi_key: "harvest.pct_complete",
    dept_key: "bizops",
    wall_keys: "bizops,farmops",
    title_en: "Percent finished (plants)",
    title_es: "Porcentaje terminado (plantas)",
    unit: "pct",
    cadence: "daily",
    dims: "farm",
    compute_key: "consoleBoxes farmTotal, farmHarvestedNow, pct (src/console.ts:990-1005) over the remaining SQL (:2822-2827) and farm_plant_counts (:2944-2946)",
    source_kind: "app",
    stale_after_hours: 30,
    open_question_en: "A plant flagged harvested but not yet gone (harvested = 1, gone_at NULL): remaining as the console says, or finished as strain performance says",
    open_question_es: "Una planta marcada cosechada pero aún no retirada (harvested = 1, gone_at NULL): restante como dice la consola, o terminada como dice el rendimiento por variedad",
    config_key: "dd_plants_harvested_flag",
    workbook_rows: "49",
  }),
  K({
    kpi_key: "harvest.ppp_dry_lb",
    dept_key: "bizops",
    wall_keys: "bizops,farmops",
    title_en: "PPP dry: yesterday, average HTD, projected",
    title_es: "PPP seco: ayer, promedio HTD, proyectado",
    unit: "lb448",
    cadence: "daily",
    season: "09-01 to 10-31",
    dims: "farm,strain",
    goal_kind: "field_estimates",
    goal_ref: "estimateInForce",
    compute_key:
      "consoleBoxes dryPerPlant for HTD by farm (src/console.ts:1006-1012, the dried filter :1010-1012); buildStrainPerformance dryLbPerPlant per strain (src/strainperformance.ts:284-287, :332) once it adopts the same filter; yesterday = lots whose unload day is D-1 (src/drystrain.ts:86-89, 289-292); projected at farm and Total grain only, per dd_projection_basis; the harvest year as /harvest shows it",
    source_kind: "app",
    stale_after_hours: 30,
    open_question_en: "Wet, dry or bud (debate ppp_basis); HTD start (debate htd_start); projection basis (debate projected_basis); lot date law",
    open_question_es: "Húmedo, seco o flor (debate ppp_basis); inicio de HTD (debate htd_start); base de la proyección (debate projected_basis); ley de fecha del lote",
    config_key: "dd_ppp_basis",
    workbook_rows: "50,69",
  }),
  K({
    kpi_key: "harvest.ppp_wet_lb",
    dept_key: "bizops",
    wall_keys: "bizops,farmops",
    title_en: "PPP wet: yesterday, average HTD",
    title_es: "PPP húmedo: ayer, promedio HTD",
    unit: "lb448",
    cadence: "daily",
    season: "09-01 to 10-31",
    dims: "farm,strain",
    compute_key:
      "consoleBoxes wetPerPlant over every counted lot (src/console.ts:1006-1009); yesterday = lots whose cut day is D-1 under dd_lot_date_law, gated by ownLotSql and status <> weighing; no projected cell",
    source_kind: "app",
    stale_after_hours: 30,
    open_question_en: "The lot date law for the yesterday cell (debate lot_date_law); a lot with no plant count is in neither row until the Assign Plant Counts station writes one",
    open_question_es: "La ley de fecha del lote para la celda de ayer (debate lot_date_law); un lote sin conteo de plantas no está en ninguna fila hasta que la estación de asignar conteos escribe uno",
    config_key: "dd_ppp_basis",
    companion_of: "harvest.ppp_dry_lb",
    workbook_rows: "50,69",
  }),
  K({
    kpi_key: "harvest.btr_pct",
    dept_key: "bizops",
    wall_keys: "bizops,farmops,culttech",
    title_en: "BTR: yesterday, weighted average to date, projected",
    title_es: "BTR: ayer, promedio ponderado a la fecha, proyectado",
    unit: "pct",
    cadence: "daily",
    season: "10-01 to 12-31",
    dims: "shift,farm,strain",
    goal_kind: "app_config",
    goal_ref: "trim_bogey_pct",
    compute_key:
      "trimFigures btr per shift (src/console.ts:465-559, :537), trimTotalsLine day weighted BTR (:1324-1328), weightedBtrToDate over TRIM_SEASON_SQL (:1293-1310, :2674-2682), parseBtrTypeCodes (src/config.ts:1641-1644); the console law: WASTE in, no WIP term to date, btr_type_codes folded into the definition version; strain grain from buildStrainPerformance (src/strainperformance.ts:314-315, :333) for the culttech wall; projected = the season weighted rate to date with the trim bogey beside it",
    source_kind: "app",
    stale_after_hours: 30,
    open_question_en: "Which BTR formula is canon (debate btr_formula); projected basis; WIP left in the denominator per shift but not to date; WASTE out when strains are compared",
    open_question_es: "Qué fórmula de BTR es canon (debate btr_formula); base de la proyección; WIP queda en el denominador por turno pero no a la fecha; WASTE fuera al comparar variedades",
    config_key: "dd_btr_formula",
    workbook_rows: "53,25",
  }),
  K({
    kpi_key: "harvest.trim_lb_per_dlh",
    dept_key: "bizops",
    wall_keys: "bizops,farmops",
    title_en: "Trim throughput and lbs per DLH",
    title_es: "Rendimiento de recorte y libras por hora directa",
    unit: "ratio",
    cadence: "daily",
    dims: "shift",
    goal_kind: "app_config",
    goal_ref: "dd_goal_trim_lb_per_dlh",
    compute_key:
      "trimFigures grams, gramsPerDlh (src/console.ts:523-539), trimTotalsLine (:1312-1341), trim_labor_hours by work_date; trim output is the trim bucket of bizops.lbs_processed (one compute, two keys; it counts toll and prior year lots the BTR denominator excludes)",
    source_kind: "app",
    stale_after_hours: 30,
    open_question_en: "The goal number per shift",
    open_question_es: "La meta por turno",
    config_key: "dd_goal_trim_lb_per_dlh",
    workbook_rows: "52,48",
  }),
  K({
    kpi_key: "harvest.wet_lb_per_dlh",
    dept_key: "bizops",
    wall_keys: "bizops,farmops",
    title_en: "Harvest lbs per labor hour vs goal",
    title_es: "Libras de cosecha por hora de mano de obra vs meta",
    unit: "ratio",
    cadence: "daily",
    goal_kind: "app_config",
    goal_ref: "dd_goal_wet_lb_per_dlh",
    compute_key:
      "consoleBoxes perDlh (src/console.ts:1047-1061): day wet grams over the ALL row else the farm rows of harvest_labor_hours (sheet sync also writes those rows, src/sheetsync.ts:386-430); the Total box only",
    source_kind: "app",
    stale_after_hours: 30,
    open_question_en: "The goal lb per DLH for harvest and trim, one number or per farm and shift",
    open_question_es: "La meta de libras por hora directa para cosecha y recorte, un solo número o por granja y turno",
    config_key: "dd_goal_wet_lb_per_dlh",
    workbook_rows: "48",
  }),
  K({
    kpi_key: "harvest.dry_space_utilization_pct",
    dept_key: "bizops",
    wall_keys: "bizops,farmops",
    title_en: "Capacity utilization (silo and dry space)",
    title_es: "Utilización de capacidad (silo y espacio de secado)",
    unit: "pct",
    cadence: "daily",
    dims: "space",
    compute_key:
      "silo.siloVisual level over assembleSiloVisuals (src/silo.ts:195-231, :706-767); facility = loaded over capacity for silo kind spaces; hang rooms from dryingRowFigures (src/db.ts:4598-4611); unloading state scales by dry out",
    source_kind: "app",
    stale_after_hours: 30,
    open_question_en: "End of day snapshot or time weighted average; the freezer (800 lb on the space, 4,800 lb in the unread key) and the cure lot caps in or out",
    open_question_es: "Foto de fin de día o promedio ponderado por tiempo; el congelador (800 lb en el espacio, 4,800 lb en la clave no leída) y los topes de lotes de curado dentro o fuera",
    workbook_rows: "51",
  }),
  K({
    kpi_key: "harvest.dry_lb_per_plant_vs_plan_pct",
    dept_key: "bizops",
    wall_keys: "bizops,farmops",
    title_en: "Yield per plant vs plan",
    title_es: "Rendimiento por planta vs plan",
    unit: "pct",
    cadence: "daily",
    season: "09-01 to 10-31",
    dims: "strain,farm",
    goal_kind: "field_estimates",
    goal_ref: "estimateInForce",
    compute_key:
      "buildStrainPerformance dryLbPerPlant and estimatePerPlant (src/strainperformance.ts:264-268, :284-287, :312, :332); variance and percent are new columns; unloaded lots with no dry grams excluded; farm grain = HTD dry PPP over dried lots against the estimate in force weighted by those lots' plant counts per strain",
    source_kind: "app",
    stale_after_hours: 30,
    open_question_en: "Plan source (debate plan_source); wet or dry",
    open_question_es: "Fuente del plan (debate plan_source); húmedo o seco",
    config_key: "dd_plan_source",
    workbook_rows: "15",
  }),
  K({
    kpi_key: "harvest.plants_harvested_count",
    dept_key: "farmops",
    wall_keys: "bizops,farmops",
    title_en: "Plants harvested per day vs plan",
    title_es: "Plantas cosechadas por día vs plan",
    unit: "count",
    cadence: "daily",
    season: "09-01 to 10-31",
    dims: "farm,strain",
    goal_kind: "targets",
    goal_ref: "dd_field_plans",
    compute_key:
      "harvested(D) less harvested(D-1) from the console law (typed farm total in force on D from the change log less live metrc_plants at the end of D), or metrc_harvests.plant_count by harvest_start_date (populated by the sweep, src/metrcmap.ts:212, :289); a lot's day = effective_date else the farm day of its created_at (dd_lot_date_law); vs plan percent as the companion view",
    source_kind: "mixed",
    stale_after_hours: 30,
    open_question_en: "The per day source (mirror drop lags the sweep; metrc_harvests plant_count; lot plant_count by date)",
    open_question_es: "La fuente por día (la baja del espejo va detrás del barrido; plant_count de metrc_harvests; plant_count del lote por fecha)",
    config_key: "dd_lot_date_law",
    workbook_rows: "21,68",
  }),
  K({
    kpi_key: "harvest.harvest_schedule",
    dept_key: "farmops",
    wall_keys: "bizops,farmops",
    title_en: "Harvest schedule (plan rows)",
    title_es: "Calendario de cosecha (filas del plan)",
    unit: "text",
    cadence: "daily",
    season: "09-01 to 10-31",
    dims: "farm,strain,field_location",
    goal_kind: "targets",
    goal_ref: "dd_field_plans",
    compute_key:
      "dd_field_plans (kind harvest, S9) beside locations.listPlantLocationsForLicense remaining plants per block (src/locations.ts:209-219) and field_loads per day",
    source_kind: "hand",
    stale_after_hours: 30,
    open_question_en: "The plan grain (strain per farm per day, or block and row) and who types it each evening",
    open_question_es: "El grano del plan (variedad por granja por día, o bloque y fila) y quién lo escribe cada tarde",
    workbook_rows: "68",
  }),
  // sales (Sales and Marketing)
  K({
    kpi_key: "sales.orders_count",
    dept_key: "sales",
    wall_keys: "sales",
    title_en: "Orders received",
    title_es: "Pedidos recibidos",
    unit: "count",
    cadence: "daily",
    dims: "product",
    compute_key: "COUNT(DISTINCT so_number) by order_date over mounted_sales_orders (parse src/fulfillment.ts:170-229); marketplace sales_orders excluded or named",
    source_kind: "mount",
    stale_after_hours: 30,
    open_question_en: "Interco and sample orders in or out",
    open_question_es: "Pedidos interco y de muestra dentro o fuera",
    workbook_rows: "4",
  }),
  K({
    kpi_key: "sales.units_sold",
    dept_key: "sales",
    wall_keys: "sales",
    title_en: "Units sold per product",
    title_es: "Unidades vendidas por producto",
    unit: "lb448",
    cadence: "weekly",
    dims: "product",
    goal_kind: "gc_submission",
    goal_ref: "drivers.streams.qty",
    compute_key:
      "shipped lines per ISO week of order_date (dd_sales_week_basis): quantity_invoiced when internal_status = shipped (src/fulfillment.ts:267-272, :315), unit converted per dd_product_map, ea and L by category; the trailing eight weeks recomputed each run; parity with pipelineCounts totals; volume vs goal as the companion view once dd_phasing is ruled (G1)",
    source_kind: "mount",
    stale_after_hours: 192,
    open_question_en: "Order week or invoice week (debate order_vs_invoice_week); unit basis per category; stream map for TRIM, BIO, SHAKE, THCA",
    open_question_es: "Semana del pedido o de la factura (debate order_vs_invoice_week); base de unidad por categoría; mapa de corrientes para TRIM, BIO, SHAKE, THCA",
    config_key: "dd_sales_week_basis",
    workbook_rows: "5,29",
  }),
  K({
    kpi_key: "sales.avg_unit_price_usd",
    dept_key: "sales",
    wall_keys: "sales",
    title_en: "Average realized price per unit",
    title_es: "Precio promedio realizado por unidad",
    unit: "usd",
    cadence: "weekly",
    dims: "product",
    goal_kind: "gc_submission",
    goal_ref: "drivers.streams.price",
    compute_key:
      "SUM(quantity_invoiced x item_price) over SUM(quantity_invoiced), item_price above 0 only (a blank or bad price lands as 0, src/fulfillment.ts:222 with numberOf :109-112), shipped gate internal_status = shipped; price vs goal as the companion view",
    source_kind: "mount",
    stale_after_hours: 192,
    open_question_en: "The goal price law per product; gram lines at 448 g",
    open_question_es: "La ley del precio meta por producto; líneas en gramos a 448 g",
    config_key: "dd_sales_week_basis",
    workbook_rows: "5,30",
  }),
  K({
    kpi_key: "sales.revenue_weekly_usd",
    dept_key: "sales",
    wall_keys: "sales",
    title_en: "Weekly invoiced revenue",
    title_es: "Ingresos facturados semanales",
    unit: "usd",
    cadence: "weekly",
    compute_key:
      "SUM(quantity_invoiced x item_price) per ISO week of order_date from the mount, shipped gate internal_status = shipped; labelled as the Zoho figure, separate from the QB month; no goal column until G1 rules dd_phasing",
    source_kind: "mount",
    stale_after_hours: 192,
    open_question_en: "Plan source and phasing (debate plan_source, G1); week law",
    open_question_es: "Fuente del plan y fraseo (debate plan_source, G1); ley de la semana",
    config_key: "dd_sales_week_basis",
    workbook_rows: "32",
  }),
  K({
    kpi_key: "sales.active_accounts_count",
    dept_key: "sales",
    wall_keys: "sales",
    title_en: "Active accounts and reorders",
    title_es: "Cuentas activas y recompras",
    unit: "count",
    cadence: "monthly",
    compute_key:
      "one scan over live mounted_sales_orders keyed COALESCE(customer_id, customer_license, customer_name): MIN and MAX order_date, order count; active = an order inside dd_sales_active_days; the reorder rate bounded at 100 percent as the companion view",
    source_kind: "mount",
    stale_after_hours: 960,
    open_question_en: "The active window and the customer key (debate active_window)",
    open_question_es: "La ventana de actividad y la clave de cliente (debate active_window)",
    config_key: "dd_sales_active_days",
    workbook_rows: "7",
  }),
  K({
    kpi_key: "sales.lapsed_customers_count",
    dept_key: "sales",
    wall_keys: "sales",
    title_en: "Customers not reordered",
    title_es: "Clientes sin recompra",
    unit: "count",
    cadence: "weekly",
    dims: "customer",
    compute_key:
      "the same customer scan, MAX(order_date) older than dd_sales_active_days; repeat buyers and one order never returned as two named counts; days since and last order value as drill",
    source_kind: "mount",
    stale_after_hours: 192,
    open_question_en: "One time buyers in or out (debate active_window)",
    open_question_es: "Compradores de una sola vez dentro o fuera (debate active_window)",
    config_key: "dd_sales_active_days",
    workbook_rows: "31",
  }),
  K({
    kpi_key: "sales.new_customers_count",
    dept_key: "sales",
    wall_keys: "sales",
    title_en: "New customers in 30, 90 and 365 days",
    title_es: "Clientes nuevos en 30, 90 y 365 días",
    unit: "count",
    cadence: "weekly",
    dims: "bucket",
    compute_key: "the same scan, MIN(order_date) within each window; the history floor (MIN order_date, MIN so_mounts.created_at) shown on the tile",
    source_kind: "mount",
    stale_after_hours: 192,
    open_question_en: "How far back exports must be mounted for a first order to be first",
    open_question_es: "Hasta qué fecha hay que montar exportaciones para que un primer pedido sea el primero",
    config_key: "dd_sales_active_days",
    workbook_rows: "33",
  }),
  K({
    kpi_key: "sales.market_penetration_pct",
    dept_key: "sales",
    wall_keys: "sales",
    title_en: "Market penetration",
    title_es: "Penetración de mercado",
    unit: "pct",
    cadence: "monthly",
    compute_key:
      "COUNT(DISTINCT external destination else customer licence) on orders bought (internal_status = shipped OR pick_status = fulfilled) in the 90 days to month end, site licences excluded, over the dd_manual_values row mi_retail_licenses_active typed once a month",
    source_kind: "mixed",
    stale_after_hours: 960,
    open_question_en: "Door count or share of sales (debate market_penetration); who supplies the denominator",
    open_question_es: "Conteo de puertas o participación en ventas (debate market_penetration); quién provee el denominador",
    config_key: "dd_market_penetration_basis",
    workbook_rows: "34",
  }),
  K({
    kpi_key: "sales.returns_count",
    dept_key: "sales",
    wall_keys: "sales",
    title_en: "Returns per week and HTD",
    title_es: "Devoluciones por semana y HTD",
    unit: "count",
    cadence: "weekly",
    compute_key:
      "dd_issues kind return (hand, S8) until METRC rejected transfers and Zoho credit notes arrive (S13, S14); HTD from the latest dd_sales_htd_start_mmdd on or before the farm today, both bounds printed; qty and usd as companions",
    source_kind: "hand",
    stale_after_hours: 192,
    open_question_en: "HTD start (debate htd_start); a METRC rejected transfer as a return",
    open_question_es: "Inicio de HTD (debate htd_start); una transferencia rechazada en METRC como devolución",
    config_key: "dd_sales_htd_start_mmdd",
    workbook_rows: "36",
  }),
  K({
    kpi_key: "sales.feedback_count",
    dept_key: "sales",
    wall_keys: "sales",
    title_en: "End user feedback",
    title_es: "Comentarios de usuarios finales",
    unit: "count",
    cadence: "weekly",
    dims: "product",
    compute_key: "dd_issues kind feedback (hand, S8); average rating as companion",
    source_kind: "hand",
    stale_after_hours: 192,
    open_question_en: "Which feedback (budtender, consumer, social) and who records it",
    open_question_es: "Qué comentarios (budtender, consumidor, redes) y quién los registra",
    workbook_rows: "37",
  }),
  // finance (Accounting and Finance)
  K({
    kpi_key: "finance.cash_received_usd",
    dept_key: "finance",
    wall_keys: "finance",
    title_en: "Cash received",
    title_es: "Efectivo recibido",
    unit: "usd",
    cadence: "daily",
    dims: "customer",
    compute_key: "fin_receipts (hand, S10) until a QuickBooks Online or Zoho Books payments connector; nothing in gc_* carries payments",
    source_kind: "hand",
    stale_after_hours: 30,
    open_question_en: "Which system records customer payments; a figure on days with no banking",
    open_question_es: "Qué sistema registra los pagos de clientes; una cifra en días sin banca",
    workbook_rows: "8,39",
  }),
  K({
    kpi_key: "finance.cash_position_usd",
    dept_key: "finance",
    wall_keys: "finance",
    title_en: "Cash position",
    title_es: "Posición de efectivo",
    unit: "usd",
    cadence: "weekly",
    dims: "account",
    compute_key: "fin_balances (hand, S10) until a connector",
    source_kind: "hand",
    stale_after_hours: 192,
    open_question_en: null,
    open_question_es: null,
    workbook_rows: "9,40",
  }),
  K({
    kpi_key: "finance.ar_ap_aging_usd",
    dept_key: "finance",
    wall_keys: "finance,sales",
    title_en: "AR and AP aging by bucket",
    title_es: "Antigüedad de cuentas por cobrar y por pagar por tramo",
    unit: "usd",
    cadence: "weekly",
    dims: "side,bucket,party",
    compute_key:
      "fin_aging (hand or CSV, S10) until a connector; the Sales wall reads the same rows per customer (side ar) with rep = latest mounted_sales_orders.sales_person per customer (free text)",
    source_kind: "hand",
    stale_after_hours: 192,
    open_question_en: "Days past due or since invoice; the rep for a customer with several sales persons",
    open_question_es: "Días de vencimiento o desde la factura; el representante de un cliente con varios vendedores",
    workbook_rows: "9,40,35",
  }),
  K({
    kpi_key: "finance.labor_hours",
    dept_key: "finance",
    wall_keys: "finance",
    title_en: "Labor hours by BU",
    title_es: "Horas de mano de obra por unidad de negocio",
    unit: "h",
    cadence: "weekly",
    season: "04-01 to 10-31",
    dims: "bu",
    goal_kind: "gc_submission",
    goal_ref: "labor",
    compute_key:
      "the four hours tables with the console ALL row rule mapped to BU through dd_bu_map (farm for harvest hours); cost companion = hours x dd_labor_rates (estimated); monthly tie to normalized GL 5610 by differencing closes or gc_transactions by txn_date and bu_code",
    source_kind: "mixed",
    stale_after_hours: 192,
    open_question_en: "The department to BU map; loaded rates per BU; the payroll vendor",
    open_question_es: "El mapa de departamento a unidad de negocio; tarifas cargadas por unidad; el proveedor de nómina",
    config_key: "dd_plan_source",
    workbook_rows: "10,41,23",
  }),
  K({
    kpi_key: "finance.distillate_biomass_lb",
    dept_key: "finance",
    wall_keys: "finance",
    title_en: "Distillate: biomass by facility, in process, yield",
    title_es: "Destilado: biomasa por instalación, en proceso, rendimiento",
    unit: "lb448",
    cadence: "weekly",
    dims: "farm",
    goal_kind: "gc_submission",
    goal_ref: "drivers.vol.lbsPerLiter",
    compute_key:
      "metrc.metrcFgInventory SQL per license (src/metrc.ts:2330-2337) under the Trim/Bio category law (src/fginventory.ts:282, :349); floor pool listExtractionBoundPackages (src/db.ts:2206-2215); in process and yield from dd_extraction_batches (hand, S10); in process lb and yield pct as companions",
    source_kind: "mixed",
    stale_after_hours: 192,
    open_question_en: "Which packages are biomass (every Shake/Trim package the pane keeps, or BIO prefixed only); yield stated per liter or per gram",
    open_question_es: "Qué paquetes son biomasa (todo paquete Shake/Trim que el panel conserva, o solo con prefijo BIO); rendimiento por litro o por gramo",
    workbook_rows: "11,42",
  }),
  K({
    kpi_key: "finance.close_days_late",
    dept_key: "finance",
    wall_keys: "finance",
    title_en: "Close on time",
    title_es: "Cierre a tiempo",
    unit: "days",
    cadence: "monthly",
    goal_kind: "app_config",
    goal_ref: "dd_close_target_business_days",
    goal_direction: "at_most",
    compute_key: "business days from month end to MIN(gc_upload_log.created_at) for the close (migrations/0103:142-153), or a typed close complete date",
    source_kind: "gc",
    stale_after_hours: 960,
    open_question_en: "The close target in business days; upload instant or a typed close date",
    open_question_es: "La meta de cierre en días hábiles; instante de carga o fecha de cierre escrita",
    config_key: "dd_close_target_business_days",
    workbook_rows: "12,43",
  }),
  K({
    kpi_key: "finance.pl_vs_budget_pct",
    dept_key: "finance",
    wall_keys: "finance",
    title_en: "P&L vs budget by GL group",
    title_es: "Resultados vs presupuesto por grupo contable",
    unit: "pct",
    cadence: "monthly",
    dims: "bucket,bu",
    goal_kind: "gc_budget_lines",
    goal_ref: "groupOf",
    compute_key:
      "compute() lines b, a, landing summed by groupOf (src/gripcasting/model.ts:63-74, :251, :291) as vOverview does; harvest year to date, monthly only after dd_phasing; usd as companion",
    source_kind: "gc",
    stale_after_hours: 960,
    open_question_en: "Monthly phasing of an annual budget",
    open_question_es: "Fraseo mensual de un presupuesto anual",
    workbook_rows: "12,43",
  }),
  K({
    kpi_key: "finance.all_in_cost_per_dry_lb",
    dept_key: "finance",
    wall_keys: "finance",
    title_en: "All in cost per dry lb",
    title_es: "Costo total por libra seca",
    unit: "usd",
    cadence: "monthly",
    goal_kind: "gc_budget_lines",
    goal_ref: "M.cost",
    goal_direction: "at_most",
    compute_key:
      "M.actual plus the GLs in dd_all_in_addback_gls over own lot weighed dry grams at 448 g (STRAIN_PERFORMANCE_LOTS_SQL with ownLotSql); beside it the GRIPCasting landing scope figure (compute() M.cost over M.vol.adjDry, parity with app.js:853) over the dd_plan_source submission's snapshot with the current close's actuals, and a bridge row of the add back dollars",
    source_kind: "mixed",
    stale_after_hours: 960,
    open_question_en: "Scope (debate all_in_cost_scope); forecast sellable dry lbs or weighed dry lbs",
    open_question_es: "Alcance (debate all_in_cost_scope); libras secas vendibles pronosticadas o libras secas pesadas",
    config_key: "dd_all_in_addback_gls",
    workbook_rows: "13",
  }),
  K({
    kpi_key: "finance.all_in_cost_per_bud_lb",
    dept_key: "finance",
    wall_keys: "finance",
    title_en: "All in cost per bud lb",
    title_es: "Costo total por libra de flor",
    unit: "usd",
    cadence: "monthly",
    goal_kind: "gc_budget_lines",
    goal_ref: "M.cost",
    goal_direction: "at_most",
    compute_key: "as finance.all_in_cost_per_dry_lb over bud grams from TRIM_SEASON_SQL rows in btr_type_codes; landing scope = compute() M.cost over M.vol.bud",
    source_kind: "mixed",
    stale_after_hours: 960,
    open_question_en: "Show both or one; bud forecast or weighed",
    open_question_es: "Mostrar ambos o uno; flor pronosticada o pesada",
    config_key: "dd_all_in_addback_gls",
    workbook_rows: "44",
  }),
  K({
    kpi_key: "finance.forecast_landing_usd",
    dept_key: "finance",
    wall_keys: "finance,bizops",
    title_en: "Forecasting by BU: budget, actual to date, remaining, landing, variance",
    title_es: "Pronóstico por unidad de negocio: presupuesto, real a la fecha, restante, aterrizaje, variación",
    unit: "usd",
    cadence: "monthly",
    dims: "bu",
    goal_kind: "gc_budget_lines",
    goal_ref: "buTable",
    compute_key:
      "latest kind bu gc_submissions per bu_code on the current close (migrations/0103:204-224; routes.ts:98-107), or buTable(compute()) live; the final submission's bu_subs map names the folded BU submissions; the bizops remaining forecast spend tile reads the same rows (remaining, landing, variance in cents, migrations/0103:210-214)",
    source_kind: "gc",
    stale_after_hours: 960,
    open_question_en: "The latest submission or the live forecast (edited after submit); remaining = GRIPCasting remaining spend or budget minus actual",
    open_question_es: "La última entrega o el pronóstico vivo (editado después de entregar); restante = gasto restante de GRIPCasting o presupuesto menos real",
    config_key: "dd_plan_source",
    workbook_rows: "45,64",
  }),
  K({
    kpi_key: "finance.cash_closing_forecast_usd",
    dept_key: "finance",
    wall_keys: "finance",
    title_en: "CF forecast",
    title_es: "Pronóstico de flujo de caja",
    unit: "usd",
    cadence: "monthly",
    compute_key:
      "fin_cashflow_lines (hand, S10: opening cash, collections, capex, debt, tax) plus buMonthly over allLines(M).flat for accrual spend (src/gripcasting/model.ts:333-355, the All In view app.js:985); add back rent and affiliated purchases",
    source_kind: "mixed",
    stale_after_hours: 960,
    open_question_en: "DSO and DPO or the collection and disbursement timing; who types the hand lines monthly",
    open_question_es: "DSO y DPO o los plazos de cobro y desembolso; quién escribe las líneas manuales cada mes",
    workbook_rows: "46",
  }),
  K({
    kpi_key: "finance.revenue_vs_plan_usd",
    dept_key: "finance",
    wall_keys: "finance",
    title_en: "Revenue vs plan (monthly)",
    title_es: "Ingresos vs plan (mensual)",
    unit: "usd",
    cadence: "monthly",
    goal_kind: "gc_submission",
    goal_ref: "revenue",
    compute_key:
      "gc_actual_monthly rows with gl under 5000 for the month on the current close (parseQB keeps any 4 digit account) and revenueActual harvest to date (src/gripcasting/model.ts:204); plan from the dd_plan_source submission, phased by dd_phasing",
    source_kind: "gc",
    stale_after_hours: 960,
    open_question_en: "Plan source and phasing (debate plan_source)",
    open_question_es: "Fuente del plan y fraseo (debate plan_source)",
    config_key: "dd_plan_source",
    workbook_rows: "6",
  }),
  K({
    kpi_key: "finance.state_retail_sales_usd",
    dept_key: "finance",
    wall_keys: "finance",
    title_en: "Monthly retail data report",
    title_es: "Informe mensual de datos minoristas",
    unit: "usd",
    cadence: "monthly",
    compute_key:
      "three typed dd_manual_values rows per month: state_retail_sales_usd, state_flower_avg_price_per_lb (typed per ounce, stored per 448 g pound with the conversion shown), mi_retail_licenses_active; the last doubles as the market penetration denominator",
    source_kind: "hand",
    stale_after_hours: 960,
    open_question_en: "What the report is and who produces it (debate retail_data_report)",
    open_question_es: "Qué es el informe y quién lo produce (debate retail_data_report)",
    config_key: "dd_retail_report_source",
    workbook_rows: "38",
  }),
  // farmops (Farming Operations)
  K({
    kpi_key: "farmops.equipment_downtime_h",
    dept_key: "farmops",
    wall_keys: "farmops",
    title_en: "Equipment downtime hours",
    title_es: "Horas de paro de equipos",
    unit: "h",
    cadence: "weekly",
    season: "03-01 to 05-31",
    dims: "farm,asset",
    compute_key:
      "equipment_tickets open spans per week (src/equipment.ts:233-294 status law) once a machine_down flag with down_start and down_end lands on tickets (S8); until then ticket open hours labelled as a proxy",
    source_kind: "mixed",
    stale_after_hours: 192,
    open_question_en: "Open ticket time as downtime, or a machine_down flag per ticket",
    open_question_es: "Tiempo de ticket abierto como paro, o una marca machine_down por ticket",
    workbook_rows: "22",
  }),
  K({
    kpi_key: "farmops.safety_incidents_count",
    dept_key: "farmops",
    wall_keys: "farmops",
    title_en: "Safety incidents by severity",
    title_es: "Incidentes de seguridad por gravedad",
    unit: "count",
    cadence: "weekly",
    season: "03-01 to 05-31",
    dims: "farm,severity",
    compute_key: "dd_issues kind safety (hand, S8); recordable rate only when total labor hours exist",
    source_kind: "hand",
    stale_after_hours: 192,
    open_question_en: "The severity list; the window (March to May looks odd for an operations figure)",
    open_question_es: "La lista de gravedad; la ventana (marzo a mayo se ve raro para una cifra de operaciones)",
    workbook_rows: "22",
  }),
  K({
    kpi_key: "farmops.labor_tasks_done_pct",
    dept_key: "farmops",
    wall_keys: "farmops",
    title_en: "Labor tasks completion",
    title_es: "Cumplimiento de tareas de mano de obra",
    unit: "pct",
    cadence: "daily",
    dims: "farm",
    compute_key: "dd_labor_tasks (hand, S9): done over planned per day per farm",
    source_kind: "hand",
    stale_after_hours: 30,
    open_question_en: "The task lookup codes; whether a task row carries actual hours so it feeds hours and productivity",
    open_question_es: "Los códigos de catálogo de tareas; si una fila de tarea lleva horas reales para alimentar horas y productividad",
    workbook_rows: "67",
  }),
  K({
    kpi_key: "farmops.task_units_per_dlh",
    dept_key: "farmops",
    wall_keys: "farmops",
    title_en: "Field task productivity",
    title_es: "Productividad de tareas de campo",
    unit: "ratio",
    cadence: "daily",
    dims: "bucket",
    goal_kind: "targets",
    goal_ref: "dd_task_standards",
    compute_key:
      "harvest perDlh (src/console.ts:1061), trim gramsPerDlh (:539), pasteurization gramsPerDlh (:1649), prepack (:2521) as is; other tasks units_done over actual_hours from dd_labor_tasks (S9)",
    source_kind: "mixed",
    stale_after_hours: 30,
    open_question_en: "Which unit counts per field task and the standard units per hour",
    open_question_es: "Qué unidad cuenta por tarea de campo y las unidades estándar por hora",
    workbook_rows: "70",
  }),
  K({
    kpi_key: "farmops.pm_overdue_count",
    dept_key: "farmops",
    wall_keys: "farmops",
    title_en: "Equipment upkeep: PMs due, done, overdue",
    title_es: "Mantenimiento de equipos: PM pendientes, hechos, vencidos",
    unit: "count",
    cadence: "weekly",
    dims: "farm",
    compute_key:
      "equipment.nextDueFrom and isOverdue (src/equipment.ts:62-71) over listAllSchedules and listEquipmentAssets; completed from equipment_pm_logs with the prior last_done from the previous log row; PM compliance percent and ticket age as companion views",
    source_kind: "app",
    stale_after_hours: 192,
    open_question_en: "Overdue count, completion rate or ticket age as the headline; a schedule_id on the PM log",
    open_question_es: "Conteo de vencidos, tasa de cumplimiento o antigüedad de tickets como titular; un schedule_id en el registro de PM",
    workbook_rows: "71",
  }),
  K({
    kpi_key: "farmops.applications_count",
    dept_key: "farmops",
    wall_keys: "farmops",
    title_en: "Fertilizer and pesticide usage",
    title_es: "Uso de fertilizantes y pesticidas",
    unit: "count",
    cadence: "weekly",
    dims: "farm,product",
    compute_key:
      "dd_applications log (hand, S11); PHI flag against dd_field_plans; METRC plant additives only if the company logs them in METRC (S13); amount by product as companions",
    source_kind: "mixed",
    stale_after_hours: 192,
    open_question_en: "Whether additives are logged in METRC; the roll up unit (lb, gal, oz per acre)",
    open_question_es: "Si los aditivos se registran en METRC; la unidad de agregación (lb, gal, oz por acre)",
    workbook_rows: "72",
  }),
  K({
    kpi_key: "farmops.plants_planted_count",
    dept_key: "farmops",
    wall_keys: "farmops",
    title_en: "Plant schedule: planned vs planted",
    title_es: "Calendario de siembra: planificadas vs sembradas",
    unit: "count",
    cadence: "weekly",
    dims: "farm,strain",
    goal_kind: "targets",
    goal_ref: "dd_field_plans",
    compute_key:
      "metrc_plants.plant_batch_date per strain and license (migrations/0042:50, from PlantedDate, mapping marked UNRESOLVED at src/metrcmap.ts:110-111) for the actual; cumulative vs farm_plant_counts; plan from dd_field_plans kind planting (S9)",
    source_kind: "mixed",
    stale_after_hours: 192,
    open_question_en: "Planting plan or whole crop calendar; PlantedDate as the planting date or the tag date",
    open_question_es: "Plan de siembra o calendario completo del cultivo; PlantedDate como fecha de siembra o de etiquetado",
    workbook_rows: "73",
  }),
  K({
    kpi_key: "farmops.labor_scheduled_hours",
    dept_key: "farmops",
    wall_keys: "farmops",
    title_en: "Labor schedule",
    title_es: "Programación de mano de obra",
    unit: "h",
    cadence: "weekly",
    dims: "farm,shift",
    compute_key: "dd_labor_schedule (hand, S9) with the app's shift keys (TRIM_SHIFTS, PASTEURIZATION_SHIFTS); actual vs scheduled from the hours tables",
    source_kind: "hand",
    stale_after_hours: 192,
    open_question_en: "By named person or by crew count and role; the farm shifts",
    open_question_es: "Por persona con nombre o por cantidad de cuadrilla y rol; los turnos de granja",
    workbook_rows: "74",
  }),
  K({
    kpi_key: "farmops.maintenance_spend_vs_budget_pct",
    dept_key: "farmops",
    wall_keys: "farmops",
    title_en: "Maintenance budget",
    title_es: "Presupuesto de mantenimiento",
    unit: "pct",
    cadence: "monthly",
    dims: "bu",
    goal_kind: "gc_budget_lines",
    goal_ref: "maintenance gl set",
    compute_key:
      "buLines filtered to the maintenance GL set (5320, 5330, 5350, 5360, 5370, 5380 in the reference chart, vendor/gripcasting/src/const.example.json:18-66) and BU 11 Indirect Grow / Maintenance; usd as companion",
    source_kind: "gc",
    stale_after_hours: 960,
    open_question_en: "The GL set versus the BU grain",
    open_question_es: "El conjunto de cuentas contables frente al grano por unidad de negocio",
    workbook_rows: "75",
  }),
  K({
    kpi_key: "farmops.assets_for_sale_count",
    dept_key: "farmops",
    wall_keys: "farmops",
    title_en: "Asset list and for sale list",
    title_es: "Lista de activos y lista en venta",
    unit: "count",
    cadence: "quarterly",
    dims: "farm",
    compute_key: "equipment_assets (frozen seed data; no create or edit route and absent from ALLOWED_TABLES) plus status and value columns (S8)",
    source_kind: "mixed",
    stale_after_hours: 2200,
    open_question_en: "The asset register of record (the app table or the accounting register) and which fields the app holds",
    open_question_es: "El registro oficial de activos (la tabla de la app o el registro contable) y qué campos guarda la app",
    workbook_rows: "76",
  }),
  // culttech (Cultivation and Technology)
  K({
    kpi_key: "culttech.plant_health_incidence_pct",
    dept_key: "culttech",
    wall_keys: "culttech",
    title_en: "Plant health and pest issues",
    title_es: "Salud de plantas y plagas",
    unit: "pct",
    cadence: "daily",
    season: "06-01 to 09-30",
    dims: "farm,strain",
    compute_key: "dd_scouting log (hand, S11): plants affected over plants inspected; strain and farm grain from STRAIN_PERFORMANCE_PLANTS_SQL; open issues as companion",
    source_kind: "hand",
    stale_after_hours: 30,
    open_question_en: "Plants inspected as the scouted sample or the live plant count; the severity scale",
    open_question_es: "Plantas inspeccionadas como muestra de monitoreo o el conteo de plantas vivas; la escala de gravedad",
    workbook_rows: "24",
  }),
  K({
    kpi_key: "culttech.plant_health_score",
    dept_key: "culttech",
    wall_keys: "culttech",
    title_en: "Plant health score by strain",
    title_es: "Puntaje de salud de plantas por variedad",
    unit: "score",
    cadence: "daily",
    season: "06-01 to 09-30",
    dims: "farm,strain",
    compute_key: "the same scouting log with a score column, weighted by plants inspected, 7 day trend",
    source_kind: "hand",
    stale_after_hours: 30,
    open_question_en: "The rubric and whether it is scored per plant, block or strain visit",
    open_question_es: "La rúbrica y si se califica por planta, bloque o visita por variedad",
    workbook_rows: "79",
  }),
  K({
    kpi_key: "culttech.rollouts_on_time_pct",
    dept_key: "culttech",
    wall_keys: "culttech",
    title_en: "Technology rollouts vs plan",
    title_es: "Despliegues de tecnología vs plan",
    unit: "pct",
    cadence: "weekly",
    season: "01-01 to 03-31",
    compute_key: "dd_projects (hand, S12, type tech_rollout); spent from purchase_orders.project when the label matches; slip days as companion",
    source_kind: "hand",
    stale_after_hours: 192,
    open_question_en: "A project tool to mirror; due when planned_go_live falls in the week or has passed",
    open_question_es: "Una herramienta de proyectos que reflejar; vence cuando planned_go_live cae en la semana o ya pasó",
    workbook_rows: "26",
  }),
  K({
    kpi_key: "culttech.dli_by_space",
    dept_key: "culttech",
    wall_keys: "culttech",
    title_en: "DLI by farm and grow space",
    title_es: "DLI por granja y espacio de cultivo",
    unit: "mol_m2_day",
    cadence: "daily",
    dims: "space",
    compute_key:
      "Open-Meteo shortwave per farm converted to DLI (S11), else a hand PPFD x photoperiod row; VPD from sensor_hourly temp and RH; the environmentals half reads bizops.env_in_range_pct_by_space at daily cadence",
    source_kind: "mixed",
    stale_after_hours: 30,
    open_question_en: "The DLI source; which grow spaces exist for sensors (today a sensor binds only to a dry space or cure room; field_location rows exist per farm and license)",
    open_question_es: "La fuente del DLI; qué espacios de cultivo existen para sensores (hoy un sensor solo se liga a un espacio de secado o sala de curado; hay filas field_location por granja y licencia)",
    workbook_rows: "78",
  }),
  K({
    kpi_key: "culttech.projected_yield_lb",
    dept_key: "culttech",
    wall_keys: "culttech",
    title_en: "Projected yield by strain",
    title_es: "Rendimiento proyectado por variedad",
    unit: "lb448",
    cadence: "weekly",
    dims: "strain,farm",
    goal_kind: "field_estimates",
    goal_ref: "estimateInForce",
    compute_key:
      "buildStrainPerformance seasonLb, harvestedDryLb, remainingLb, forecastSource (src/strainperformance.ts:289-339); the yield confidence companion = weighed share plus the rate tier plus estimateMissing",
    source_kind: "app",
    stale_after_hours: 192,
    open_question_en: "What the confidence index is (weighed share, source tier, a typed 1 to 5, or a blend)",
    open_question_es: "Qué es el índice de confianza (proporción pesada, nivel de fuente, un 1 a 5 escrito, o una mezcla)",
    config_key: "dd_projection_basis",
    workbook_rows: "80",
  }),
  K({
    kpi_key: "culttech.strain_value_index",
    dept_key: "culttech",
    wall_keys: "culttech",
    title_en: "Total value strain index",
    title_es: "Índice de valor total por variedad",
    unit: "score",
    cadence: "monthly",
    dims: "strain,farm",
    compute_key:
      "the BPP, TPP and $PP chain seeded from harvest.ppp_dry_lb and the dashboard BTR (never puzzles' dryPp), prices php_bud_price_per_lb and php_trim_price_per_lb (defaults 150 and 30, src/puzzles.ts:163-165), normalized to the farm average, or a weighted composite of the scorecard with weights in app_config",
    source_kind: "app",
    stale_after_hours: 960,
    open_question_en: "$PP normalized or a weighted composite; which prices feed it",
    open_question_es: "$PP normalizado o un compuesto ponderado; qué precios lo alimentan",
    config_key: "dd_btr_formula",
    workbook_rows: "81",
  }),
  K({
    kpi_key: "culttech.strain_scorecard",
    dept_key: "culttech",
    wall_keys: "culttech",
    title_en: "Strain scorecard",
    title_es: "Tarjeta de puntaje por variedad",
    unit: "score",
    cadence: "seasonal",
    dims: "strain",
    compute_key:
      "derived columns from puzzleNumbers and buildStrainPerformance (BTR, PPP, bag appeal, terps, durability, silo durability, hang dry, cryo durability, finishing window, finish timing), dry down from the strain and farm pools, aW first check from lab_sample_requests kind aw, cryo yield from runs; hand scores in dd_strain_scores (S12)",
    source_kind: "mixed",
    stale_after_hours: null,
    open_question_en: "The rubric for bag appeal, durability and finish timing; whether the 1 to 6 scale applies only to finish timing; the aW pass threshold",
    open_question_es: "La rúbrica de apariencia, durabilidad y momento de terminado; si la escala 1 a 6 aplica solo al momento de terminado; el umbral de aprobación de aW",
    config_key: "dd_btr_formula",
    workbook_rows: "82",
  }),
  K({
    kpi_key: "culttech.projects_in_progress_count",
    dept_key: "culttech",
    wall_keys: "culttech",
    title_en: "Projects in progress and project leads",
    title_es: "Proyectos en curso y responsables de proyecto",
    unit: "count",
    cadence: "weekly",
    compute_key: "dd_projects (hand, S12) with milestones; weekly change in percent complete from the change log; leads are a column of the log, projects per lead as companion",
    source_kind: "hand",
    stale_after_hours: 192,
    open_question_en: "A project tool to mirror",
    open_question_es: "Una herramienta de proyectos que reflejar",
    workbook_rows: "83,84",
  }),
  K({
    kpi_key: "culttech.contra_recompenses_usd",
    dept_key: "culttech",
    wall_keys: "culttech",
    title_en: "Continuum contra recompenses",
    title_es: "Contrarrecompensas de Continuum",
    unit: "usd",
    cadence: "weekly",
    compute_key:
      "none until the owner rules (debate contra_recompenses); the recorded log shape: partner key from the four PARTNERS, signed amount, direction, optional project label, shown gross each way, feeding no finance row",
    source_kind: "hand",
    stale_after_hours: null,
    status: "parked",
    open_question_en: "What the term means and who holds the ledger today",
    open_question_es: "Qué significa el término y quién lleva el registro hoy",
    config_key: "dd_contra_recompenses_mode",
    workbook_rows: "85",
  }),
];

/** The 73 registry rows, sort 10, 20, ... in the order above (bizops, the harvest family, sales, finance, farmops, culttech). */
export const DD_KPIS: readonly DdKpi[] = ROWS.map((row, i) => ({ ...row, sort: (i + 1) * 10 }));

export function ddKpi(key: string): DdKpi | undefined {
  return DD_KPIS.find((row) => row.kpi_key === key);
}

/** The registry rows a wall shows, headline rows and their companions, in sort order. */
export function ddKpisForWall(rows: readonly DdKpi[], wall: string): DdKpi[] {
  return rows.filter((row) => row.active === 1 && row.wall_keys.split(",").includes(wall)).sort((a, b) => a.sort - b.sort);
}

/** True when the farm day sits inside the row's season window (MM-DD bounds, a window may wrap the year end). All year when unset. */
export function ddInSeason(row: Pick<DdKpi, "season_start_md" | "season_end_md">, dayIso: string): boolean {
  const start = row.season_start_md;
  const end = row.season_end_md;
  if (!start || !end) return true;
  const md = dayIso.slice(5, 10);
  return start <= end ? md >= start && md <= end : md >= start || md <= end;
}

/** One dd_kpi_questions row, the table's columns minus the timestamps and the ruling columns the seed sets. */
export type DdQuestion = {
  id: string;
  question_key: string;
  kpi_keys: string;
  config_key: DdConfigKey | null;
  question_en: string;
  question_es: string;
  position_a: string;
  position_b: string;
  recommendation: string;
  default_value: string;
  status: "open" | "ruled" | "parked";
};

type QuestionInput = Omit<DdQuestion, "id" | "status"> & { status?: DdQuestion["status"] };

const Q = (row: QuestionInput): DdQuestion => ({ ...row, id: `ddq_${row.question_key}`, status: row.status ?? "ruled" });

const WEEKLY_KEYS = DD_KPIS.filter((row) => row.cadence === "weekly")
  .map((row) => row.kpi_key)
  .join(",");

/** The seventeen debates, each with the owner's question, the two positions, the recommendation and the value the ruling writes. */
export const DD_QUESTIONS: readonly DdQuestion[] = [
  Q({
    question_key: "ppp_basis",
    kpi_keys: "harvest.ppp_dry_lb,harvest.ppp_wet_lb,harvest.dry_lb_per_plant_vs_plan_pct,culttech.projected_yield_lb,culttech.strain_scorecard",
    config_key: "dd_ppp_basis",
    question_en:
      "On the daily PPP tile, should the bold headline be dry pounds per plant at 448 g (the unloaded silo weight, wet per plant as the second row), or wet with dry second?",
    question_es:
      "En la tarjeta diaria de PPP, ¿el titular en negrita debe ser libras secas por planta a 448 g (el peso descargado del silo, con húmedo por planta como segunda fila), o húmedo con seco en segunda fila?",
    position_a: "Dry pounds per plant at 448 g is the headline: it is the only basis with a yield plan, a projection and parity with the strain pages.",
    position_b: "Wet pounds per plant is the headline: it exists the day after the cut, covers the same lots in numerator and denominator, and never drops frozen lots.",
    recommendation:
      "Dry is the headline and wet is the second row on the same tile, each yesterday cell dated on its own day (unload day for dry, cut day for wet), with projected and vs plan in dry only.",
    default_value: "dry",
  }),
  Q({
    question_key: "htd_start",
    kpi_keys: "sales.returns_count,harvest.ppp_dry_lb,harvest.ppp_wet_lb",
    config_key: "dd_sales_htd_start_mmdd",
    question_en:
      "Do you accept that average HTD PPP and projected PPP count the lots of the farm today's minted harvest year exactly as /harvest does, while returns HTD on the sales list counts from April 1 beside revenue vs plan, each tile printing its start and end?",
    question_es:
      "¿Acepta que el PPP promedio HTD y el PPP proyectado cuenten los lotes del año de cosecha acuñado del día de granja actual exactamente como lo hace /harvest, mientras que las devoluciones HTD de la lista de ventas cuentan desde el 1 de abril junto a ingresos vs plan, con cada tarjeta imprimiendo su inicio y su fin?",
    position_a: "HTD follows the farm today's harvest year as the console does, so the dashboard and /harvest agree on every PPP figure.",
    position_b: "HTD follows the fiscal April 1 clock on every row, so a first quarter farm day does not show a near empty PPP tile.",
    recommendation:
      "Yes: PPP follows the lot's minted harvest year as /harvest shows it, returns follow the finance April clock from app_config dd_sales_htd_start_mmdd, and every HTD tile prints its start and end.",
    default_value: "04-01",
  }),
  Q({
    question_key: "processed_lbs",
    kpi_keys: "bizops.lbs_processed,harvest.trim_lb_per_dlh",
    config_key: "dd_processed_lbs_buckets",
    question_en: 'Does "Lbs processed" mean the trim room\'s weighed pounds alone, or trim, cryo and prepack side by side with trim as the headline and never summed?',
    question_es:
      '¿"Libras procesadas" significa solo las libras pesadas de la sala de recorte, o recorte, cryo y preempaque lado a lado con recorte como titular y nunca sumados?',
    position_a: "Trim line only: the trim room's weighed pounds are the one processed figure /harvest already proves, and summing lines counts a gram up to three times.",
    position_b: "Every line: trim, cryo and prepack each by its own pane's law, shown side by side so no bucket is ever added to another.",
    recommendation:
      "Show the three lines side by side with trim as the headline, each by its /harvest pane's own law and never summed; a one item list behind the Admin PIN narrows it to trim alone.",
    default_value: "trim,cryo,prepack",
  }),
  Q({
    question_key: "shipped_interco",
    kpi_keys: "bizops.lbs_shipped,bizops.shipments_count,bizops.moved_count,bizops.biomass_shipped_lb",
    config_key: "dd_shipped_includes_interco",
    question_en:
      "When a truck leaves a farm for the company's own processing plant, does Shipments count it, or does Shipped mean left the company, with own licence moves shown beside it as Moved by destination site?",
    question_es:
      "Cuando un camión sale de una granja hacia la planta de proceso de la propia empresa, ¿Envíos lo cuenta, o Enviado significa que salió de la empresa, con los movimientos entre licencias propias mostrados al lado como Movidos por sitio de destino?",
    position_a: "Every truck that leaves a farm is a shipment, own plant or customer alike, as the mount page's Shipped row counts today.",
    position_b: "Shipped means left the company to a customer or partner; own licence moves are a separate Moved figure by destination site, computed once from the same set.",
    recommendation:
      "Shipped means left the company; own licence moves print beside it as Moved by destination site on the same card, pounds never add across the two, and dd_shipped_includes_interco can fold Moved into the count later without a code change.",
    default_value: "0",
  }),
  Q({
    question_key: "active_window",
    kpi_keys: "sales.active_accounts_count,sales.lapsed_customers_count,sales.new_customers_count",
    config_key: "dd_sales_active_days",
    question_en: 'Does "active account" mean an order in the trailing 30 days (the same clock as the Not Reordered list) or a longer window such as 90 days?',
    question_es: '¿"Cuenta activa" significa un pedido en los últimos 30 días (el mismo reloj que la lista de Sin recompra) o una ventana más larga como 90 días?',
    position_a: "A 90 day window: the 31 to 90 day band is the at risk set the reorder conversation exists for, and 30 days alone hides it.",
    position_b: "Thirty days on one shared key, so active plus not reordered equals the customer total and the two tiles never disagree.",
    recommendation:
      "Thirty days on one shared key, so active plus not reordered equals the customer total and the tile prints its window; raise the key later if a longer view is wanted and both tiles will follow it.",
    default_value: "30",
  }),
  Q({
    question_key: "order_vs_invoice_week",
    kpi_keys: "sales.units_sold,sales.avg_unit_price_usd,sales.revenue_weekly_usd,bizops.prepack_months_on_hand",
    config_key: "dd_sales_week_basis",
    question_en:
      "Does a sale belong to the week of its Zoho Order Date or to the week it shipped (today only the mount day of the status flip, later the Zoho invoice date)?",
    question_es:
      "¿Una venta pertenece a la semana de su fecha de pedido en Zoho o a la semana en que se envió (hoy solo el día de montaje del cambio de estado, después la fecha de factura de Zoho)?",
    position_a: "The order week: order_date is a real date on every mounted row today and it is the basis the sales team plans against.",
    position_b:
      "The shipped week: revenue is earned at shipment and a shipped keyed week closes its membership at the first mount after it, the only basis that can approach the QB month.",
    recommendation:
      "Order week now, badged by order week with shipped as of the mount, with the basis switchable to shipped week in app_config once the Zoho API supplies a real invoice or shipment date.",
    default_value: "order",
  }),
  Q({
    question_key: "all_in_cost_scope",
    kpi_keys: "finance.all_in_cost_per_dry_lb,finance.all_in_cost_per_bud_lb",
    config_key: "dd_all_in_addback_gls",
    question_en:
      "Is 5420 Affiliated Purchases spend with a sister entity among PNN, PNS and SMI (adding it back would double count those pounds) or with an affiliate outside the three?",
    question_es:
      "¿5420 Compras afiliadas es gasto con una entidad hermana entre PNN, PNS y SMI (sumarlo de vuelta contaría esas libras dos veces) o con una afiliada fuera de las tres?",
    position_a: "All in means the GRIPCasting landing scope as it stands: rent and affiliated purchases stay out and the figure is defined at every close.",
    position_b: "All in adds rent (5570) and affiliated purchases (5420) back over weighed own lot grams, so the per pound cost carries every dollar the pounds consumed.",
    recommendation:
      "Ship with rent (5570) added back and 5420 kept out (dd_all_in_addback_gls = 5570), adding 5420 only if finance confirms the affiliate is outside PNN, PNS and SMI.",
    default_value: "5570",
  }),
  Q({
    question_key: "plan_source",
    kpi_keys:
      "bizops.harvest_goal_pct,harvest.dry_lb_per_plant_vs_plan_pct,sales.units_sold,sales.avg_unit_price_usd,sales.revenue_weekly_usd,finance.revenue_vs_plan_usd,finance.forecast_landing_usd,finance.labor_hours,bizops.po_unplanned_pct",
    config_key: "dd_plan_source",
    question_en:
      "When finance resubmits the final GRIPCasting forecast, should revenue, volume, price and labor goals move to that submission, or stay frozen on one pinned submission?",
    question_es:
      "Cuando finanzas vuelve a entregar el pronóstico final de GRIPCasting, ¿las metas de ingresos, volumen, precio y mano de obra deben moverse a esa entrega, o quedar congeladas en una entrega fijada?",
    position_a: "One pinned submission: a goal that moves with every resubmit measures week 10 and week 30 against different plans with no stated reason.",
    position_b: "The latest final submission: the board should read the plan finance stands behind today, with its close date on every tile.",
    recommendation:
      "Move with the latest final submission (dd_plan_source = latest_final), badge each tile with the submission's close date, and pin a submission id only if you want a frozen annual baseline for a vs plan row.",
    default_value: "latest_final",
  }),
  Q({
    question_key: "projected_basis",
    kpi_keys: "harvest.ppp_dry_lb,harvest.btr_pct,culttech.projected_yield_lb",
    config_key: "dd_projection_basis",
    question_en:
      "For plants still standing, should projected PPP use the field estimate typed for that strain and farm, falling to the season's own dry rate where none is typed, every cut lot at actual, the typed farm total under the line?",
    question_es:
      "Para las plantas aún en pie, ¿el PPP proyectado debe usar la estimación de campo escrita para esa variedad y granja, cayendo a la tasa seca de la propia temporada donde no hay ninguna, con cada lote cortado a real y el total de granja escrito bajo la línea?",
    position_a: "Actual to date applied to what remains: the console's own projection, one law for every pane.",
    position_b: "The plan values: the field estimate typed per strain and farm is the only yield plan in data and the projection should honour it where it exists.",
    recommendation: "Yes, and projected BTR stays the season weighted rate to date with the trim bogey shown beside it as the target, not inside it.",
    default_value: "estimates",
  }),
  Q({
    question_key: "moh",
    kpi_keys: "bizops.prepack_months_on_hand",
    config_key: "dd_moh_window_months",
    question_en: "Months on hand (prepack stock per strain over trailing shipped velocity) or only the stock per strain already on /harvest?",
    question_es: "¿Meses de existencias (stock de preempaque por variedad sobre la velocidad de envío reciente) o solo el stock por variedad que ya está en /harvest?",
    position_a: "Months on hand: stock over the trailing shipped velocity per strain is the bagging decision's number.",
    position_b: "Material on hand only: no bag count exists and sales run November to March, so a trailing window in October holds no selling month and the ratio misleads.",
    recommendation:
      "Months on hand over a trailing three month window of shipped orders by order_date, with the stock column shown beside it so the row stands when the window holds no sales.",
    default_value: "3",
  }),
  Q({
    question_key: "product_life_cycle",
    kpi_keys: "bizops.batch_cycle_days",
    config_key: "dd_product_life_cycle_mode",
    question_en: "Days a harvest batch takes from entry to testing release (computable now), or a hand kept stage per sellable SKU (which first needs a SKU family list)?",
    question_es: "¿Días que tarda un lote de cosecha desde el ingreso hasta la liberación de pruebas (calculable hoy), o una etapa llevada a mano por SKU vendible (que primero necesita una lista de familias de SKU)?",
    position_a: "Batch cycle days from harvest entry to testing release: computable today from the TAT status logs, no hand entry.",
    position_b: "A hand kept lifecycle stage per sellable SKU: product means the sellable item everywhere the workbook uses the word, and the stage discipline is what the app lacks.",
    recommendation:
      "Batch cycle days from harvest entry to testing release, per strain with the open batch count, badged as definition v1 until a packed end is wired, with the SKU stage log deferred until a SKU family key exists.",
    default_value: "batch_cycle",
  }),
  Q({
    question_key: "contra_recompenses",
    kpi_keys: "culttech.contra_recompenses_usd",
    config_key: "dd_contra_recompenses_mode",
    question_en:
      "Is it the credits, discounts and in kind value exchanged with the four Continuum partners under the partner program, logged weekly by culttech per partner, or money owed to and by those partners, which finance already carries in the close upload?",
    question_es:
      "¿Son los créditos, descuentos y valor en especie intercambiados con los cuatro socios de Continuum bajo el programa de socios, registrados semanalmente por culttech por socio, o dinero que se debe a y por esos socios, que finanzas ya lleva en la carga de cierre?",
    position_a: "The partner program's recompense log: credits, discounts, service and in kind value per partner, typed by culttech as dated signed entries.",
    position_b: "Money owed to and by the partners, which the close upload already carries on ordinary GLs, so nothing new is typed.",
    recommendation:
      "Treat it as the partner program's recompense log: credits, discounts, service and in kind value received from (and, when it happens, given to) each of the four Continuum partners, typed by culttech as dated entries with a partner key, a signed amount and an optional project label, shown gross each way by week and never netted into any finance figure.",
    default_value: "parked",
    status: "parked",
  }),
  Q({
    question_key: "retail_data_report",
    kpi_keys: "finance.state_retail_sales_usd,sales.market_penetration_pct",
    config_key: "dd_retail_report_source",
    question_en: "The state's CRA monthly figures read once a month for market context, or a report of the company's own sell through at retail that someone compiles or pays for?",
    question_es: "¿Las cifras mensuales de la CRA del estado leídas una vez al mes como contexto de mercado, o un informe de la venta al detalle de los propios productos de la empresa que alguien compila o paga?",
    position_a: "The state's CRA monthly figures, typed once a month by finance, doubling as Market Penetration's inputs.",
    position_b: "A sell through report of the company's own products at retail, which first needs a source nobody has named.",
    recommendation:
      "The CRA monthly figures, typed once a month by finance, with the licensee count and state dollars doubling as Market Penetration's inputs; no sell through source exists to build on, and if one is ever named it becomes a separate sales row.",
    default_value: "state_cra_monthly",
  }),
  Q({
    question_key: "market_penetration",
    kpi_keys: "sales.market_penetration_pct",
    config_key: "dd_market_penetration_basis",
    question_en:
      "Which licence classes count as a door, for the numerator's prefix list and the typed denominator: adult use retailers only, or retailers plus medical provisioning centers?",
    question_es:
      "¿Qué clases de licencia cuentan como puerta, para la lista de prefijos del numerador y el denominador escrito: solo minoristas de uso adulto, o minoristas más centros de provisión médica?",
    position_a: "Door count share: distinct destination licences bought from in the trailing 90 days over the state's active retailer count.",
    position_b: "Share of state sales: doors do not measure depth, a door share can rise while volume falls.",
    recommendation:
      "Adult use retailer licences only, one per licensed location, taken from the CRA licensee list as of month end with the source and as of date typed beside the count, so a store holding both an adult use and a medical licence counts once.",
    default_value: "doors",
  }),
  Q({
    question_key: "btr_formula",
    kpi_keys: "harvest.btr_pct,culttech.strain_value_index,culttech.strain_scorecard",
    config_key: "dd_btr_formula",
    question_en:
      "Keep the trim room law exactly as /harvest shows it (BUD, SMALLS and SHAKE over all weight ran, WASTE in the denominator), or take WASTE out when strains are compared?",
    question_es:
      "¿Mantener la ley de la sala de recorte exactamente como la muestra /harvest (BUD, SMALLS y SHAKE sobre todo el peso procesado, con WASTE en el denominador), o sacar WASTE al comparar variedades?",
    position_a: "The console pool: bud codes over all live trim grams with WASTE in, exactly as /harvest and the line packages footnote show it.",
    position_b: "The puzzles ratio with WASTE out: a strain whose lots weighed more waste should not rank lower for a trim room fact.",
    recommendation:
      "Keep the trim room law with WASTE in, as /harvest and the line packages footnote already show it, and revisit only if WASTE grams on trim lots ever become material.",
    default_value: "console_to_date",
  }),
  Q({
    question_key: "week_definition",
    kpi_keys: WEEKLY_KEYS,
    config_key: "dd_week_basis",
    question_en:
      "Is the weekly bucket the ISO week of the farm day (Monday at the farm day start hour to the next Monday), with harvest week n shown as a label counted from a season start date pinned in app_config once the first cut lands?",
    question_es:
      "¿El balde semanal es la semana ISO del día de granja (lunes a la hora de inicio del día de granja hasta el lunes siguiente), con la semana de cosecha n mostrada como etiqueta contada desde una fecha de inicio de temporada fijada en app_config cuando cae el primer corte?",
    position_a: "The ISO week of the farm day: a stable key every year, Monday at the farm day start hour to the next Monday.",
    position_b: "The harvest week counted from the season's first cut: directors say harvest week 3, and a goal keyed on week n is the same slot every plan year.",
    recommendation:
      "Yes: bucket and snapshot on the ISO week start date of the farm day, show harvest week n as a derived label inside the harvest year, and pin dd_season_start_date to the first live cut's entry_date within the first harvest week rather than leaving the MIN(entry_date) bootstrap in place.",
    default_value: "iso",
  }),
  Q({
    question_key: "lot_date_law",
    kpi_keys: "harvest.ppp_wet_lb,harvest.plants_harvested_count,harvest.wet_weight_lb",
    config_key: "dd_lot_date_law",
    question_en:
      "For yesterday's PPP and plants harvested, does a lot belong to its Effective Date (the day its weighing started, PIN correctable, the date METRC carries as harvest start) or to the farm day it finished at the scale?",
    question_es:
      "Para el PPP de ayer y las plantas cosechadas, ¿un lote pertenece a su fecha efectiva (el día en que empezó su pesaje, corregible con PIN, la fecha que METRC lleva como inicio de cosecha) o al día de granja en que terminó en la báscula?",
    position_a: "The farm day the lot finished at the scale: a farm day is final at 06:00 the next morning, and the floor calls a lot finished after six today's first batch.",
    position_b: "The lot's Effective Date: the day its weighing started, PIN correctable, the date METRC carries as harvest start.",
    recommendation:
      "Its Effective Date, with the farm day of the lot's own created_at standing in for lots older than migration 0053, while wet weight by day keeps the /harvest console's scale day law.",
    default_value: "effective_date",
  }),
];

export const DD_QUESTIONS_REASON = "S0 ruling accepted by the owner 2026-10-15";

export function ddQuestion(key: string): DdQuestion | undefined {
  return DD_QUESTIONS.find((row) => row.question_key === key);
}

function sqlText(value: string | null): string {
  return value == null ? "NULL" : `'${value.replace(/'/g, "''")}'`;
}

function sqlNum(value: number | null): string {
  return value == null ? "NULL" : String(value);
}

function chunk<T>(rows: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < rows.length; i += size) out.push(rows.slice(i, i + size));
  return out;
}

export const DD_SEED_ROWS_PER_INSERT = 9;

const DD_KPIS_COLUMNS =
  "kpi_key, dept_key, wall_keys, title_en, title_es, unit, cadence, season_start_md, season_end_md, dims, goal_kind, goal_ref, goal_direction, compute_key, source_kind, stale_after_hours, status, def_version, open_question_en, open_question_es, config_key, companion_of, workbook_rows, sort, active, created_at, updated_at";

const DD_QUESTIONS_COLUMNS =
  "id, question_key, kpi_keys, config_key, question_en, question_es, position_a, position_b, recommendation, default_value, status, ruling, ruled_by, ruled_at, reason, created_at, updated_at";

function kpiValues(row: DdKpi): string {
  return [
    sqlText(row.kpi_key),
    sqlText(row.dept_key),
    sqlText(row.wall_keys),
    sqlText(row.title_en),
    sqlText(row.title_es),
    sqlText(row.unit),
    sqlText(row.cadence),
    sqlText(row.season_start_md),
    sqlText(row.season_end_md),
    sqlText(row.dims),
    sqlText(row.goal_kind),
    sqlText(row.goal_ref),
    sqlText(row.goal_direction),
    sqlText(row.compute_key),
    sqlText(row.source_kind),
    sqlNum(row.stale_after_hours),
    sqlText(row.status),
    sqlNum(row.def_version),
    sqlText(row.open_question_en),
    sqlText(row.open_question_es),
    sqlText(row.config_key),
    sqlText(row.companion_of),
    sqlText(row.workbook_rows),
    sqlNum(row.sort),
    sqlNum(row.active),
    sqlText(DD_SEED_AT),
    sqlText(DD_SEED_AT),
  ].join(", ");
}

function questionValues(row: DdQuestion): string {
  const ruled = row.status === "ruled";
  return [
    sqlText(row.id),
    sqlText(row.question_key),
    sqlText(row.kpi_keys),
    sqlText(row.config_key),
    sqlText(row.question_en),
    sqlText(row.question_es),
    sqlText(row.position_a),
    sqlText(row.position_b),
    sqlText(row.recommendation),
    sqlText(row.default_value),
    sqlText(row.status),
    sqlText(ruled ? row.default_value : null),
    "NULL",
    sqlText(ruled ? DD_SEED_AT : null),
    sqlText(ruled ? DD_QUESTIONS_REASON : null),
    sqlText(DD_SEED_AT),
    sqlText(DD_SEED_AT),
  ].join(", ");
}

function insertBlocks<T>(table: string, columns: string, rows: readonly T[], values: (row: T) => string): string {
  return chunk(rows, DD_SEED_ROWS_PER_INSERT)
    .map((group) => `INSERT OR IGNORE INTO ${table} (\n  ${columns}\n) VALUES\n${group.map((row) => `  (${values(row)})`).join(",\n")};\n`)
    .join("\n");
}

/** The dd_kpis and dd_kpi_questions INSERT blocks migration 0105 carries verbatim (nine rows per statement). */
export function ddSeedSql(): string {
  return `${insertBlocks("dd_kpis", DD_KPIS_COLUMNS, DD_KPIS, kpiValues)}\n${insertBlocks("dd_kpi_questions", DD_QUESTIONS_COLUMNS, DD_QUESTIONS, questionValues)}`;
}

/** The app_config INSERT block migration 0105 carries verbatim (NULL actors, as 0104 seeds). */
export function ddConfigSeedSql(): string {
  const rows = DD_CONFIG_KEYS.map(
    (key) => `  (${sqlText(key)}, ${sqlText(DD_CONFIG_DEFAULTS[key])}, ${sqlText(DD_SEED_AT)}, NULL, ${sqlText(DD_SEED_AT)}, NULL, NULL, NULL)`
  );
  return `INSERT OR IGNORE INTO app_config (\n  key, value, created_at, created_by, updated_at, updated_by, deleted_at, deleted_by\n) VALUES\n${rows.join(",\n")};\n`;
}
