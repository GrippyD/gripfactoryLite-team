-- DD S3e: Storage Capacity Utilization takes the Harvest wet weight place on bizops.
-- The wet weight row stays and leaves the bizops and farmops walls.
-- Guarded: a second apply changes nothing.

UPDATE dd_kpis
SET sort = sort + 10
WHERE sort >= 240
  AND NOT EXISTS (SELECT 1 FROM dd_kpis WHERE kpi_key = 'bizops.storage_capacity');

UPDATE dd_kpis
SET active = 0,
    updated_at = '2026-10-19T00:00:00.000Z'
WHERE kpi_key = 'harvest.wet_weight_lb'
  AND active = 1;

INSERT INTO dd_kpis (
  kpi_key, dept_key, wall_keys, title_en, title_es, unit, cadence,
  season_start_md, season_end_md, dims, goal_kind, goal_ref, goal_direction,
  compute_key, source_kind, stale_after_hours, status, def_version,
  open_question_en, open_question_es, config_key, companion_of, workbook_rows,
  sort, active, created_at, updated_at
)
SELECT
  'bizops.storage_capacity', 'bizops', 'bizops',
  'Storage Capacity Utilization', 'Uso de capacidad de almacenamiento',
  'pct', 'daily',
  NULL, NULL, 'space',
  'none', NULL, 'at_least',
  'silo.ts assembleSiloVisuals fill level per silo kind space (the silo tiles'' own number: loaded wet over the space''s capacityGrams, unloading scaled by dry out); cure spaces by the cure page''s lots in place over the space''s capacity in ea; spaces with a capacity only, the freezer out',
  'app', 30, 'live', 1,
  NULL, NULL, NULL, NULL, NULL,
  240, 1, '2026-10-19T00:00:00.000Z', '2026-10-19T00:00:00.000Z'
WHERE NOT EXISTS (SELECT 1 FROM dd_kpis WHERE kpi_key = 'bizops.storage_capacity');
