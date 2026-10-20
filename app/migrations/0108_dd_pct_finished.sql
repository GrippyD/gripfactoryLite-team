-- DD S3c: % Complete (By Plant Count) takes Shipments' place on bizops.
-- Shipments stays on the sales wall. Guarded: a second apply changes nothing.

UPDATE dd_kpis
SET sort = sort + 10
WHERE sort >= 40
  AND NOT EXISTS (SELECT 1 FROM dd_kpis WHERE kpi_key = 'bizops.pct_finished_plants');

UPDATE dd_kpis
SET wall_keys = 'sales'
WHERE kpi_key = 'bizops.shipments_count'
  AND wall_keys = 'bizops,sales';

INSERT OR IGNORE INTO dd_kpis (
  kpi_key, dept_key, wall_keys, title_en, title_es, unit, cadence,
  season_start_md, season_end_md, dims, goal_kind, goal_ref, goal_direction,
  compute_key, source_kind, stale_after_hours, status, def_version,
  open_question_en, open_question_es, config_key, companion_of, workbook_rows,
  sort, active, created_at, updated_at
) VALUES (
  'bizops.pct_finished_plants', 'bizops', 'bizops',
  '% Complete (By Plant Count)', '% Completo (por conteo de plantas)',
  'pct', 'daily',
  NULL, NULL, 'grow_method',
  'none', NULL, 'at_least',
  'All grow methods: consoleBoxes pct (src/console.ts, the Total box), the Admin plant total less the mirror''s live plants over the Admin total, a farm with no total using its lots plus its live plants. One grow method: plants on own lots of the year with that grow_method_code (the console''s season lots, status not weighing) over those plus the live mirror plants of that grow method (location starting GH is GH, else OD)',
  'app', 30, 'live', 1,
  NULL, NULL, NULL, NULL, NULL,
  40, 1, '2026-10-19T00:00:00.000Z', '2026-10-19T00:00:00.000Z'
);
