-- DD S3b: Lbs/Labor Hour vs Goal takes the Lbs shipped slot.
-- The shipped row stays for its history and leaves every wall.
-- Guarded: a second apply changes nothing.

UPDATE dd_kpis
SET sort = sort + 10
WHERE sort >= 20
  AND NOT EXISTS (SELECT 1 FROM dd_kpis WHERE kpi_key = 'bizops.lbs_per_dlh');

UPDATE dd_kpis
SET active = 0,
    updated_at = '2026-10-19T00:00:00.000Z'
WHERE kpi_key = 'bizops.lbs_shipped'
  AND active = 1;

INSERT INTO dd_kpis (
  kpi_key, dept_key, wall_keys, title_en, title_es, unit, cadence,
  season_start_md, season_end_md, dims, goal_kind, goal_ref, goal_direction,
  compute_key, source_kind, stale_after_hours, status, def_version,
  open_question_en, open_question_es, config_key, companion_of, workbook_rows,
  sort, active, created_at, updated_at
)
SELECT
  'bizops.lbs_per_dlh', 'bizops', 'bizops',
  'Lbs/Labor Hour vs Goal', 'Libras por hora de mano de obra vs meta',
  'ratio', 'daily',
  NULL, NULL, '',
  'targets', 'dd_targets', 'at_least',
  'consoleBoxes perDlh law (src/console.ts, the Total box): the farm day''s wet grams over 448, every lot (the day SQL, no own lot filter), over the day''s harvest hours (the ALL row of harvest_labor_hours, else the sum of the farm rows); the period figure is the window''s wet lb over the window''s hours',
  'app', 30, 'live', 1,
  NULL, NULL, NULL, NULL, NULL,
  20, 1, '2026-10-19T00:00:00.000Z', '2026-10-19T00:00:00.000Z'
WHERE NOT EXISTS (SELECT 1 FROM dd_kpis WHERE kpi_key = 'bizops.lbs_per_dlh');

INSERT INTO dd_targets (
  id, kpi_key, dim_key, period_kind, effective_from, target, low, high, phasing, note,
  created_at, created_by, updated_at, updated_by, deleted_at, deleted_by
)
SELECT
  'ddt_bizops_lbs_per_dlh_20260901',
  'bizops.lbs_per_dlh',
  '',
  'day',
  '2026-09-01',
  26,
  NULL, NULL, NULL,
  'owner 2026-10-19',
  '2026-10-19T00:00:00.000Z',
  NULL,
  '2026-10-19T00:00:00.000Z',
  NULL,
  NULL,
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM dd_targets
  WHERE kpi_key = 'bizops.lbs_per_dlh'
    AND dim_key = ''
    AND period_kind = 'day'
    AND effective_from = '2026-09-01'
    AND deleted_at IS NULL
);
