-- THE TWO HARVEST NODES (canon 0.30.317). A field load is one Penn South
-- or Arlington harvest load. A tote may name the load it rode. Null on
-- every tote already stored.

CREATE TABLE field_loads (
  id TEXT PRIMARY KEY,
  operator_name TEXT,
  destination_farm_code TEXT NOT NULL,
  status TEXT NOT NULL,
  started_at TEXT NOT NULL,
  sent_at TEXT,
  effective_date TEXT NOT NULL,
  created_at TEXT NOT NULL,
  created_by TEXT,
  updated_at TEXT NOT NULL,
  updated_by TEXT,
  deleted_at TEXT,
  deleted_by TEXT,
  delete_reason TEXT
);

CREATE INDEX field_loads_status ON field_loads (status);

ALTER TABLE wet_weights ADD COLUMN field_load_id TEXT;

CREATE INDEX wet_weights_field_load ON wet_weights (field_load_id);
