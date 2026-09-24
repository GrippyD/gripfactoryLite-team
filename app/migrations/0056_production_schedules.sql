-- 0056: PRODUCTION SCHEDULING (canon 0.30.97). Owner ruling 2026-09-16,
-- verbatim in the Cursor Slice: a Production Scheduling module under
-- Production Operations, two shuttle stations (Trimming and Pasteurization)
-- whose schedule is what exposes material to Trim Packages Entry and Cryo
-- Weight Entry.
--
-- One row per scheduled item per stage. Trimming schedules the unloaded lot
-- (wet_weight_entry_id); Pasteurization schedules the cryo-queue package
-- (wip_package_id). Exactly one of those two columns is set, enforced in the
-- action, not a CHECK (Postgres-portable). At most one non-deleted row per
-- (stage, item), also enforced in the action. Postgres-portable, append-only.
CREATE TABLE production_schedules (
  id TEXT PRIMARY KEY,
  stage TEXT NOT NULL,
  wet_weight_entry_id TEXT,
  wip_package_id TEXT,
  harvest_batch_id TEXT NOT NULL,
  status TEXT NOT NULL,
  effective_date TEXT,
  scheduled_at TEXT NOT NULL,
  scheduled_by TEXT,
  completed_at TEXT,
  completed_by TEXT,
  created_at TEXT NOT NULL,
  created_by TEXT,
  updated_at TEXT NOT NULL,
  updated_by TEXT,
  deleted_at TEXT,
  deleted_by TEXT,
  delete_reason TEXT
);

CREATE INDEX production_schedules_stage_status ON production_schedules (stage, status);
CREATE INDEX production_schedules_wet_weight ON production_schedules (wet_weight_entry_id);
CREATE INDEX production_schedules_wip_package ON production_schedules (wip_package_id);
