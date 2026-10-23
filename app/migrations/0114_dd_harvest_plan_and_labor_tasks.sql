-- DD L2: the harvest plan, the labor tasks, and the registry lines for both
-- tiles. Test batches drop out of the silo count. Nothing seeded.
-- Guarded: a second apply changes nothing.

CREATE TABLE IF NOT EXISTS dd_harvest_plan (
  id TEXT PRIMARY KEY,
  strain TEXT NOT NULL,
  farm_code TEXT NOT NULL,
  planned_date TEXT NOT NULL,
  plants INTEGER,
  note TEXT,
  done_at TEXT,
  created_at TEXT NOT NULL,
  created_by TEXT,
  updated_at TEXT NOT NULL,
  updated_by TEXT,
  deleted_at TEXT,
  deleted_by TEXT,
  delete_reason TEXT
);

CREATE INDEX IF NOT EXISTS dd_harvest_plan_planned_date ON dd_harvest_plan (planned_date);

CREATE TABLE IF NOT EXISTS dd_labor_tasks (
  id TEXT PRIMARY KEY,
  task TEXT NOT NULL,
  farm_code TEXT,
  started_on TEXT NOT NULL,
  expected_on TEXT NOT NULL,
  pct_complete INTEGER NOT NULL DEFAULT 0 CHECK (pct_complete >= 0 AND pct_complete <= 100),
  pct_as_of TEXT,
  note TEXT,
  closed_at TEXT,
  created_at TEXT NOT NULL,
  created_by TEXT,
  updated_at TEXT NOT NULL,
  updated_by TEXT,
  deleted_at TEXT,
  deleted_by TEXT,
  delete_reason TEXT
);

CREATE INDEX IF NOT EXISTS dd_labor_tasks_expected_on ON dd_labor_tasks (expected_on);

CREATE TABLE IF NOT EXISTS dd_labor_task_log (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  pct_complete INTEGER NOT NULL,
  as_of TEXT NOT NULL,
  note TEXT,
  created_at TEXT NOT NULL,
  created_by TEXT
);

CREATE INDEX IF NOT EXISTS dd_labor_task_log_task_id ON dd_labor_task_log (task_id);

UPDATE dd_kpis
SET compute_key = 'silos active per day (his pick, 2026-10-20): a silo (dry_spaces kind silo, space_type silo; Silo 1 to 5) counts on a farm day when a silo_loads row of it, not deleted, has loaded_at on or before the end of that day and ended_at null or after the start of it; the day''s value is the count of such silos; per silo rows carry 1 or 0; test batches (harvest_batches.is_test) out',
    updated_at = '2026-10-21T00:00:00.000Z'
WHERE kpi_key = 'harvest.dry_space_utilization_pct'
  AND compute_key <> 'silos active per day (his pick, 2026-10-20): a silo (dry_spaces kind silo, space_type silo; Silo 1 to 5) counts on a farm day when a silo_loads row of it, not deleted, has loaded_at on or before the end of that day and ended_at null or after the start of it; the day''s value is the count of such silos; per silo rows carry 1 or 0; test batches (harvest_batches.is_test) out';

UPDATE dd_kpis
SET compute_key = 'dd_harvest_plan rows by planned date; a row is done by its Done button or when a harvest batch of its strain and farm is cut on or after the date',
    status = 'live',
    def_version = 2,
    source_kind = 'hand',
    updated_at = '2026-10-21T00:00:00.000Z'
WHERE kpi_key = 'harvest.harvest_schedule'
  AND NOT (
    compute_key = 'dd_harvest_plan rows by planned date; a row is done by its Done button or when a harvest batch of its strain and farm is cut on or after the date'
    AND status = 'live'
    AND def_version = 2
    AND source_kind = 'hand'
  );

UPDATE dd_kpis
SET compute_key = 'dd_labor_tasks: percent complete typed per task against the time elapsed to its expected date; the row''s value is the share of open tasks on track',
    status = 'live',
    def_version = 2,
    source_kind = 'hand',
    updated_at = '2026-10-21T00:00:00.000Z'
WHERE kpi_key = 'farmops.labor_tasks_done_pct'
  AND NOT (
    compute_key = 'dd_labor_tasks: percent complete typed per task against the time elapsed to its expected date; the row''s value is the share of open tasks on track'
    AND status = 'live'
    AND def_version = 2
    AND source_kind = 'hand'
  );
