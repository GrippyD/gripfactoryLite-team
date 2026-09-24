-- Unload Dry Space sessions (operator, spear versus bucked) and the METRC
-- pending-row reference for Package Adjustments and Packages from Harvests.

CREATE TABLE unload_sessions (
  id TEXT PRIMARY KEY,
  wet_weight_entry_id TEXT NOT NULL,
  operator_name TEXT,
  weigh_mode TEXT,
  bucked_on_site INTEGER,
  truck_number TEXT,
  finished_at TEXT,
  created_at TEXT NOT NULL,
  created_by TEXT,
  updated_at TEXT NOT NULL,
  updated_by TEXT,
  deleted_at TEXT,
  deleted_by TEXT
);

CREATE INDEX unload_sessions_lot ON unload_sessions (wet_weight_entry_id, created_at);

ALTER TABLE dry_weights ADD COLUMN session_id TEXT;

ALTER TABLE metrc_uploads ADD COLUMN ref_id TEXT;
