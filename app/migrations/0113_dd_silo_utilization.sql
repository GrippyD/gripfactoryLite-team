-- DD L1: Farming Operations wall moves, and Silo Utilization on the old
-- capacity row. Guarded: a second apply changes nothing.

UPDATE dd_kpis
SET wall_keys = 'bizops,culttech',
    updated_at = '2026-10-20T00:00:00.000Z'
WHERE kpi_key = 'harvest.btr_pct'
  AND wall_keys <> 'bizops,culttech';

UPDATE dd_kpis
SET wall_keys = 'bizops',
    updated_at = '2026-10-20T00:00:00.000Z'
WHERE kpi_key = 'bizops.trim_throughput'
  AND wall_keys <> 'bizops';

UPDATE dd_kpis
SET wall_keys = 'bizops',
    updated_at = '2026-10-20T00:00:00.000Z'
WHERE kpi_key = 'harvest.trim_lb_per_dlh'
  AND wall_keys <> 'bizops';

UPDATE dd_kpis
SET title_en = 'Silo Utilization',
    title_es = 'Uso de silos',
    wall_keys = 'farmops',
    unit = 'count',
    cadence = 'daily',
    dims = 'silo',
    goal_kind = 'none',
    goal_ref = NULL,
    compute_key = 'silos active per day (his pick, 2026-10-20): a silo (dry_spaces kind silo, space_type silo; Silo 1 to 5) counts on a farm day when a silo_loads row of it, not deleted, has loaded_at on or before the end of that day and ended_at null or after the start of it; the day''s value is the count of such silos; per silo rows carry 1 or 0',
    source_kind = 'app',
    status = 'live',
    def_version = 2,
    open_question_en = NULL,
    open_question_es = NULL,
    updated_at = '2026-10-20T00:00:00.000Z'
WHERE kpi_key = 'harvest.dry_space_utilization_pct'
  AND NOT (
    title_en = 'Silo Utilization'
    AND title_es = 'Uso de silos'
    AND wall_keys = 'farmops'
    AND unit = 'count'
    AND dims = 'silo'
    AND def_version = 2
    AND open_question_en IS NULL
  );

UPDATE dd_kpis
SET title_en = 'Harvest Schedule',
    title_es = 'Calendario de cosecha',
    updated_at = '2026-10-20T00:00:00.000Z'
WHERE kpi_key = 'harvest.harvest_schedule'
  AND title_en <> 'Harvest Schedule';

UPDATE dd_kpis
SET sort = (SELECT MAX(sort) + 10 FROM dd_kpis WHERE kpi_key <> 'farmops.task_units_per_dlh'),
    updated_at = '2026-10-20T00:00:00.000Z'
WHERE kpi_key = 'farmops.task_units_per_dlh'
  AND sort <= (SELECT MAX(sort) FROM dd_kpis WHERE kpi_key <> 'farmops.task_units_per_dlh');
