-- THE RAD SCHEDULE AND RAD OPERATION (canon 0.30.327).
-- A run is scheduled, running, or complete. Its grey is a whole Gray.
-- A package row leaves by soft delete. Nothing before this file is edited.

CREATE TABLE rad_runs (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL,
  grey INTEGER NOT NULL,
  scheduled_at TEXT NOT NULL,
  scheduled_by TEXT,
  started_at TEXT,
  started_by TEXT,
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

CREATE INDEX rad_runs_status ON rad_runs (status);

CREATE TABLE rad_run_packages (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL,
  tag TEXT NOT NULL,
  item_type TEXT,
  grams REAL,
  lab_test_status TEXT,
  position INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  created_by TEXT,
  deleted_at TEXT,
  deleted_by TEXT,
  delete_reason TEXT
);

CREATE INDEX rad_run_packages_run ON rad_run_packages (run_id);
CREATE INDEX rad_run_packages_tag ON rad_run_packages (tag);
