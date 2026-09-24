-- 0071: THE PREPACK (canon 0.30.188). A third scheduling stage and a
-- station. The carry is the app's accounting. The units, the item names,
-- and the room are values in data.

CREATE TABLE prepack_lines (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL,
  parent_package_id TEXT NOT NULL,
  unit_grams NUMERIC NOT NULL,
  bags INTEGER NOT NULL,
  grams INTEGER NOT NULL,
  tag TEXT NOT NULL,
  carried_grams INTEGER NOT NULL DEFAULT 0,
  carry_id TEXT,
  work_date TEXT NOT NULL,
  ledger_item_id TEXT,
  created_at TEXT NOT NULL,
  created_by TEXT,
  updated_at TEXT NOT NULL,
  updated_by TEXT,
  deleted_at TEXT,
  deleted_by TEXT,
  delete_reason TEXT
);

CREATE INDEX prepack_lines_job ON prepack_lines (job_id, created_at);
CREATE INDEX prepack_lines_tag ON prepack_lines (tag);

CREATE TABLE prepack_carries (
  id TEXT PRIMARY KEY,
  from_job_id TEXT NOT NULL,
  from_package_id TEXT NOT NULL,
  parent_tag TEXT NOT NULL,
  grams INTEGER NOT NULL,
  remaining INTEGER NOT NULL,
  status TEXT NOT NULL,
  finished_on TEXT NOT NULL,
  created_at TEXT NOT NULL,
  created_by TEXT,
  updated_at TEXT NOT NULL,
  updated_by TEXT,
  deleted_at TEXT,
  deleted_by TEXT
);

CREATE INDEX prepack_carries_status ON prepack_carries (status, created_at);

CREATE TABLE prepack_labor_hours (
  id TEXT PRIMARY KEY,
  work_date TEXT NOT NULL UNIQUE,
  hours NUMERIC NOT NULL,
  created_at TEXT NOT NULL,
  created_by TEXT,
  updated_at TEXT NOT NULL,
  updated_by TEXT
);

INSERT OR IGNORE INTO app_config (
  key, value, created_at, created_by, updated_at, updated_by, deleted_at, deleted_by
) VALUES
  ('prepack_units', '3.5,7,14,28', '2026-09-22T00:00:00.000Z', NULL, '2026-09-22T00:00:00.000Z', NULL, NULL, NULL),
  ('prepack_items', '3.5=PREPACK 3.5;7=PREPACK 7;14=PREPACK 14;28=PREPACK 28', '2026-09-22T00:00:00.000Z', NULL, '2026-09-22T00:00:00.000Z', NULL, NULL, NULL),
  ('prepack_location', 'Prepack Room', '2026-09-22T00:00:00.000Z', NULL, '2026-09-22T00:00:00.000Z', NULL, NULL, NULL);
