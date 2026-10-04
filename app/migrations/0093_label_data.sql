-- 0093: L2 CONNECTIONS AND CUSTOM LABEL DATA (canon 0.30.386).
-- A custom table is static (its first row fills every label) or keyed by one
-- catalog field. columns_json and rows_json hold the shape and the cells.
-- A delete is soft.

CREATE TABLE label_data_tables (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  mode TEXT NOT NULL,
  key_field TEXT,
  columns_json TEXT NOT NULL,
  rows_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  created_by TEXT,
  updated_at TEXT NOT NULL,
  updated_by TEXT,
  deleted_at TEXT,
  deleted_by TEXT,
  delete_reason TEXT
);

CREATE INDEX label_data_tables_name ON label_data_tables (name);
