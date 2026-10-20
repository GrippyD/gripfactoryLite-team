-- DD S3f: Trim Throughput takes the Percent finished (plants) place.
-- The percent finished row stays and leaves the bizops and farmops walls.
-- Guarded: a second apply changes nothing.

UPDATE dd_kpis
SET sort = sort + 10
WHERE sort >= 260
  AND NOT EXISTS (SELECT 1 FROM dd_kpis WHERE kpi_key = 'bizops.trim_throughput');

UPDATE dd_kpis
SET active = 0,
    updated_at = '2026-10-19T00:00:00.000Z'
WHERE kpi_key = 'harvest.pct_complete'
  AND active = 1;

INSERT INTO dd_kpis (
  kpi_key, dept_key, wall_keys, title_en, title_es, unit, cadence,
  season_start_md, season_end_md, dims, goal_kind, goal_ref, goal_direction,
  compute_key, source_kind, stale_after_hours, status, def_version,
  open_question_en, open_question_es, config_key, companion_of, workbook_rows,
  sort, active, created_at, updated_at
)
SELECT
  'bizops.trim_throughput', 'bizops', 'bizops,farmops',
  'Trim Throughput', 'Rendimiento de recorte',
  'ratio', 'daily',
  NULL, NULL, 'shift,strain,dry_method',
  'none', NULL, 'at_least',
  'console trimFigures per shift (src/console.ts): the shift''s weighed trim output grams over 448 over trim_labor_hours for that work_date and shift; weighted = both shifts'' lbs over both shifts'' hours; with a strain or dry method picked, each shift''s hours are shared by the selection''s share of that shift''s lbs',
  'app', 30, 'live', 1,
  NULL, NULL, NULL, NULL, NULL,
  260, 1, '2026-10-19T00:00:00.000Z', '2026-10-19T00:00:00.000Z'
WHERE NOT EXISTS (SELECT 1 FROM dd_kpis WHERE kpi_key = 'bizops.trim_throughput');
