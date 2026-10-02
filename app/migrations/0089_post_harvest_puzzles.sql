-- 0089: BRIEF V21, POST HARVEST PUZZLES (canon 0.30.351).
-- The 2025 year is history from the workbook. Later years are computed from the lots.
-- The plan is typed on the report, or landed from the workbook's results sheet.

CREATE TABLE post_harvest_lots (
  id TEXT PRIMARY KEY,
  harvest_year INTEGER NOT NULL,
  import_id TEXT NOT NULL,
  entry_date TEXT,
  metrc_harvest_tag TEXT,
  harvest_batch_name TEXT NOT NULL,
  farm TEXT,
  grow_method TEXT,
  strain TEXT,
  market_strain TEXT,
  associated_batch TEXT,
  is_bio_ffz TEXT,
  plants INTEGER,
  wet_spear_grams NUMERIC,
  bucked_wet_grams NUMERIC,
  dry_weight_grams NUMERIC,
  bud_grams NUMERIC,
  mixed_grams NUMERIC,
  smalls_grams NUMERIC,
  trim_grams NUMERIC,
  shake_grams NUMERIC,
  bio_grams NUMERIC,
  kief_grams NUMERIC,
  created_at TEXT NOT NULL,
  created_by TEXT,
  updated_at TEXT NOT NULL,
  updated_by TEXT,
  deleted_at TEXT,
  deleted_by TEXT
);

CREATE INDEX post_harvest_lots_year ON post_harvest_lots (harvest_year);

CREATE TABLE post_harvest_tests (
  id TEXT PRIMARY KEY,
  harvest_year INTEGER NOT NULL,
  import_id TEXT NOT NULL,
  strain TEXT,
  hbn TEXT,
  potency NUMERIC,
  status TEXT,
  failure_mode TEXT,
  attempt INTEGER,
  required_test TEXT,
  created_at TEXT NOT NULL,
  created_by TEXT,
  updated_at TEXT NOT NULL,
  updated_by TEXT,
  deleted_at TEXT,
  deleted_by TEXT
);

CREATE INDEX post_harvest_tests_year ON post_harvest_tests (harvest_year);

CREATE TABLE post_harvest_plan (
  id TEXT PRIMARY KEY,
  harvest_year INTEGER NOT NULL,
  strain_name TEXT NOT NULL,
  allocation_plants INTEGER,
  tc_ih TEXT,
  note TEXT,
  is_new_strain INTEGER NOT NULL DEFAULT 0,
  source TEXT NOT NULL,
  created_at TEXT NOT NULL,
  created_by TEXT,
  updated_at TEXT NOT NULL,
  updated_by TEXT,
  deleted_at TEXT,
  deleted_by TEXT,
  UNIQUE (harvest_year, strain_name)
);

CREATE INDEX post_harvest_plan_year ON post_harvest_plan (harvest_year);
