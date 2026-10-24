-- DD S3g: Testing Throughput on the Business Operations wall, beside BTR.
-- harvest.btr_pct stays. The new row sorts directly after it.
-- Guarded: a second apply changes nothing.

UPDATE dd_kpis
SET sort = sort + 10
WHERE sort > (SELECT sort FROM dd_kpis WHERE kpi_key = 'harvest.btr_pct')
  AND NOT EXISTS (SELECT 1 FROM dd_kpis WHERE kpi_key = 'bizops.testing_throughput');

INSERT INTO dd_kpis (
  kpi_key, dept_key, wall_keys, title_en, title_es, unit, cadence,
  season_start_md, season_end_md, dims, goal_kind, goal_ref, goal_direction,
  compute_key, source_kind, stale_after_hours, status, def_version,
  open_question_en, open_question_es, config_key, companion_of, workbook_rows,
  sort, active, created_at, updated_at
)
SELECT
  'bizops.testing_throughput', 'bizops', 'bizops',
  'Testing Throughput', 'Rendimiento de pruebas',
  'ratio', 'daily',
  NULL, NULL, 'test_type',
  'none', NULL, 'at_least',
  'lab_samples grouped by day: Tests/Day is samples by intake date over intake dates with any sample; COAs/Day is completed samples by the farm day of coa_posted_at over days with any COA; TAT is the average stored tat_days of completed samples whose COA farm day is in the window, one decimal; HTD is the harvest year',
  'connector', NULL, 'live', 1,
  NULL, NULL, NULL, NULL, NULL,
  (SELECT sort FROM dd_kpis WHERE kpi_key = 'harvest.btr_pct') + 10,
  1, '2026-10-23T00:00:00.000Z', '2026-10-23T00:00:00.000Z'
WHERE NOT EXISTS (SELECT 1 FROM dd_kpis WHERE kpi_key = 'bizops.testing_throughput');
