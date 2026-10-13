-- FE1: field estimates, effective dated. The key is strain plus farm.
-- A live row is unique on (strain_id, farm_code, effective_date).
-- field_estimates_lookup is (strain_id, farm_code, effective_date) for the
-- resolution read: the live row with the greatest effective_date on or before
-- the date asked. A later date does not change an earlier row.

CREATE TABLE field_estimates (
  id TEXT PRIMARY KEY,
  strain_id TEXT NOT NULL,
  farm_code TEXT NOT NULL REFERENCES farms(code),
  effective_date TEXT NOT NULL,
  est_dry_weight REAL NOT NULL,
  reason TEXT,
  created_by TEXT,
  created_at TEXT,
  deleted_at TEXT
);

CREATE UNIQUE INDEX field_estimates_live
  ON field_estimates (strain_id, farm_code, effective_date)
  WHERE deleted_at IS NULL;

CREATE INDEX field_estimates_lookup
  ON field_estimates (strain_id, farm_code, effective_date);
