-- THE MAINTENANCE NODE (canon 0.30.293). A lab sample request is one
-- check of one open load: scheduled, then requested, then fulfilled.
-- The interval lists are lookup_values, not tables.

CREATE TABLE lab_sample_requests (
  id TEXT PRIMARY KEY,
  silo_load_id TEXT NOT NULL,
  dry_space_id TEXT NOT NULL,
  wet_weight_entry_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  check_number INTEGER NOT NULL,
  status TEXT NOT NULL,
  scheduled_at TEXT,
  scheduled_by TEXT,
  requested_at TEXT,
  requested_by TEXT,
  fulfilled_at TEXT,
  fulfilled_by TEXT,
  result_value NUMERIC,
  result_unit TEXT,
  internal_test_result_id TEXT,
  notes TEXT,
  created_at TEXT NOT NULL,
  created_by TEXT,
  updated_at TEXT NOT NULL,
  updated_by TEXT,
  deleted_at TEXT,
  deleted_by TEXT,
  delete_reason TEXT
);

CREATE INDEX lab_sample_requests_load_kind ON lab_sample_requests (silo_load_id, kind, requested_at);
CREATE UNIQUE INDEX lab_sample_requests_check ON lab_sample_requests (silo_load_id, kind, check_number) WHERE deleted_at IS NULL;
