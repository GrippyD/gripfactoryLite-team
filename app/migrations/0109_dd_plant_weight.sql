-- DD S3d: Plant Weight takes Testing turnaround's place on bizops.
-- The turnaround row stays and leaves the wall. Guarded: a second apply changes nothing.

UPDATE dd_kpis
SET sort = sort + 10
WHERE sort >= 130
  AND NOT EXISTS (SELECT 1 FROM dd_kpis WHERE kpi_key = 'bizops.plant_weight');

UPDATE dd_kpis
SET active = 0,
    updated_at = '2026-10-19T00:00:00.000Z'
WHERE kpi_key = 'bizops.lab_turnaround_days'
  AND active = 1;

INSERT INTO dd_kpis (
  kpi_key, dept_key, wall_keys, title_en, title_es, unit, cadence,
  season_start_md, season_end_md, dims, goal_kind, goal_ref, goal_direction,
  compute_key, source_kind, stale_after_hours, status, def_version,
  open_question_en, open_question_es, config_key, companion_of, workbook_rows,
  sort, active, created_at, updated_at
)
SELECT
  'bizops.plant_weight', 'bizops', 'bizops',
  'Plant Weight', 'Peso por planta',
  'lb448', 'daily',
  NULL, NULL, 'farm,strain,grow_method',
  'none', NULL, 'at_least',
  'dry grams over plants of own dried lots of the harvest year (consoleBoxes dryPerPlant: plant_count at least 1, dry grams above 0, status not weighing, ownLotSql), dated by the lot''s unload day; projected = buildStrainPerformance seasonLb over plantsHarvested plus plantsRemaining for the rows in the selection',
  'app', 30, 'live', 1,
  NULL, NULL, NULL, NULL, NULL,
  130, 1, '2026-10-19T00:00:00.000Z', '2026-10-19T00:00:00.000Z'
WHERE NOT EXISTS (SELECT 1 FROM dd_kpis WHERE kpi_key = 'bizops.plant_weight');
