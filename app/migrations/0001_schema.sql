-- Slice 1.1 edited in place before first deploy (wrangler.toml still TBD ids).
-- After the first deploy, schema and seed changes ride new numbered migrations only.

CREATE TABLE farms (
  code TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  created_at TEXT NOT NULL,
  created_by TEXT,
  updated_at TEXT NOT NULL,
  updated_by TEXT,
  deleted_at TEXT,
  deleted_by TEXT
);

CREATE TABLE grow_methods (
  code TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  hbn_code TEXT NOT NULL,
  created_at TEXT NOT NULL,
  created_by TEXT,
  updated_at TEXT NOT NULL,
  updated_by TEXT,
  deleted_at TEXT,
  deleted_by TEXT
);

CREATE TABLE strains (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  abbr TEXT,
  hbn_code TEXT NOT NULL,
  created_at TEXT NOT NULL,
  created_by TEXT,
  updated_at TEXT NOT NULL,
  updated_by TEXT,
  deleted_at TEXT,
  deleted_by TEXT
);

CREATE TABLE dry_spaces (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  kind TEXT NOT NULL,
  created_at TEXT NOT NULL,
  created_by TEXT,
  updated_at TEXT NOT NULL,
  updated_by TEXT,
  deleted_at TEXT,
  deleted_by TEXT
);

CREATE TABLE package_types (
  code TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  is_bud INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  created_by TEXT,
  updated_at TEXT NOT NULL,
  updated_by TEXT,
  deleted_at TEXT,
  deleted_by TEXT
);

CREATE TABLE people (
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  is_active INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  created_by TEXT,
  updated_at TEXT NOT NULL,
  updated_by TEXT,
  deleted_at TEXT,
  deleted_by TEXT
);

CREATE TABLE harvest_batches (
  id TEXT PRIMARY KEY,
  entry_date TEXT NOT NULL,
  farm_code TEXT NOT NULL,
  grow_method_code TEXT NOT NULL,
  strain_id TEXT NOT NULL,
  manicure INTEGER NOT NULL,
  silo_number TEXT,
  start_time TEXT,
  zone TEXT,
  rows_text TEXT,
  metrc_harvest_tag TEXT,
  hbn TEXT NOT NULL UNIQUE,
  lot_serial INTEGER NOT NULL,
  harvest_year INTEGER NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  created_by TEXT,
  updated_at TEXT NOT NULL,
  updated_by TEXT,
  deleted_at TEXT,
  deleted_by TEXT,
  UNIQUE (harvest_year, lot_serial)
);

CREATE TABLE wet_weight_entries (
  id TEXT PRIMARY KEY,
  harvest_batch_id TEXT NOT NULL,
  weight_grams NUMERIC NOT NULL,
  dry_space_id TEXT NOT NULL,
  notes TEXT,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  created_by TEXT,
  updated_at TEXT NOT NULL,
  updated_by TEXT,
  deleted_at TEXT,
  deleted_by TEXT
);

CREATE TABLE wip_packages (
  id TEXT PRIMARY KEY,
  wet_weight_entry_id TEXT NOT NULL,
  package_code TEXT NOT NULL,
  package_type_code TEXT NOT NULL,
  weight_grams NUMERIC NOT NULL,
  cryo_weight_grams NUMERIC,
  status TEXT NOT NULL,
  test_outcome TEXT,
  created_at TEXT NOT NULL,
  created_by TEXT,
  updated_at TEXT NOT NULL,
  updated_by TEXT,
  deleted_at TEXT,
  deleted_by TEXT
);

CREATE TABLE record_change_log (
  id TEXT PRIMARY KEY,
  record_table TEXT NOT NULL,
  record_id TEXT NOT NULL,
  field TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  actor_person_id TEXT,
  reason TEXT NOT NULL,
  changed_at TEXT NOT NULL
);

CREATE INDEX harvest_batches_status ON harvest_batches (status);
CREATE INDEX harvest_batches_created_at ON harvest_batches (created_at);
CREATE INDEX wet_weight_entries_status ON wet_weight_entries (status);
CREATE INDEX wet_weight_entries_created_at ON wet_weight_entries (created_at);
CREATE INDEX wet_weight_entries_dry_space ON wet_weight_entries (dry_space_id);
CREATE INDEX wip_packages_status ON wip_packages (status);
CREATE INDEX wip_packages_created_at ON wip_packages (created_at);
CREATE INDEX record_change_log_changed_at ON record_change_log (changed_at);
CREATE INDEX record_change_log_record ON record_change_log (record_table, record_id);
