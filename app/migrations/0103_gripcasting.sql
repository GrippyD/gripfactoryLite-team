-- GC1: GRIPCasting on GFLite's D1. Fifteen gc_ tables. No business row.
-- Money that was numeric(12,2) is INTEGER cents. Unit rates that were
-- numeric(12,4) (per_hour, unit_cost) and qty (numeric(14,4)) are INTEGER
-- ten thousandths. share (numeric(9,6)) is INTEGER millionths. The query
-- edge converts both ways so the model still sees dollars and the same rates.
-- Ids are TEXT uuid strings. Instants and dates are ISO TEXT. JSON is TEXT.
-- created_at, updated_at and created_by are on every table. updated_at is the
-- optimistic lock the API checks.

CREATE TABLE gc_app_users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'director')),
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT,
  created_by TEXT
);
CREATE UNIQUE INDEX gc_app_users_email_key ON gc_app_users (lower(email));
CREATE INDEX gc_app_users_active_name ON gc_app_users (is_active, name);

CREATE TABLE gc_harvests (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  starts_on TEXT NOT NULL,
  is_current INTEGER NOT NULL DEFAULT 0,
  wages_budget INTEGER,
  season TEXT NOT NULL DEFAULT '{}',
  vol_default TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT,
  created_by TEXT
);
CREATE UNIQUE INDEX gc_harvests_one_current ON gc_harvests (is_current) WHERE is_current = 1;

CREATE TABLE gc_business_units (
  id TEXT PRIMARY KEY,
  harvest_id TEXT NOT NULL REFERENCES gc_harvests(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  sort INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT,
  created_by TEXT,
  UNIQUE (harvest_id, code)
);
CREATE INDEX gc_business_units_harvest_sort ON gc_business_units (harvest_id, sort, code);

CREATE TABLE gc_gl_accounts (
  id TEXT PRIMARY KEY,
  harvest_id TEXT NOT NULL REFERENCES gc_harvests(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT,
  created_by TEXT,
  UNIQUE (harvest_id, name)
);

CREATE TABLE gc_budget_lines (
  id TEXT PRIMARY KEY,
  harvest_id TEXT NOT NULL REFERENCES gc_harvests(id) ON DELETE CASCADE,
  gl TEXT NOT NULL,
  bu TEXT NOT NULL,
  amount INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT,
  created_by TEXT,
  UNIQUE (harvest_id, gl, bu)
);

CREATE TABLE gc_drivers (
  id TEXT PRIMARY KEY,
  harvest_id TEXT NOT NULL UNIQUE REFERENCES gc_harvests(id) ON DELETE CASCADE,
  vol TEXT NOT NULL,
  gl TEXT NOT NULL DEFAULT '{}',
  updated_by TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT,
  created_by TEXT
);

CREATE TABLE gc_actual_closes (
  id TEXT PRIMARY KEY,
  harvest_id TEXT NOT NULL REFERENCES gc_harvests(id) ON DELETE CASCADE,
  close_date TEXT NOT NULL,
  file_name TEXT NOT NULL,
  uploaded_at TEXT NOT NULL,
  is_current INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT,
  created_by TEXT,
  UNIQUE (harvest_id, close_date)
);
CREATE UNIQUE INDEX gc_actual_closes_one_current ON gc_actual_closes (harvest_id) WHERE is_current = 1;
CREATE INDEX gc_actual_closes_harvest_date ON gc_actual_closes (harvest_id, close_date);

CREATE TABLE gc_actual_lines (
  id TEXT PRIMARY KEY,
  close_id TEXT NOT NULL REFERENCES gc_actual_closes(id) ON DELETE CASCADE,
  entity TEXT NOT NULL,
  bu TEXT NOT NULL,
  gl TEXT NOT NULL,
  amount INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT,
  created_by TEXT
);
CREATE INDEX gc_actual_lines_close ON gc_actual_lines (close_id, entity, gl, bu);

CREATE TABLE gc_actual_monthly (
  id TEXT PRIMARY KEY,
  close_id TEXT NOT NULL REFERENCES gc_actual_closes(id) ON DELETE CASCADE,
  gl TEXT NOT NULL,
  month TEXT NOT NULL,
  amount INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT,
  created_by TEXT,
  UNIQUE (close_id, gl, month)
);

CREATE TABLE gc_transactions (
  id TEXT PRIMARY KEY,
  close_id TEXT NOT NULL REFERENCES gc_actual_closes(id) ON DELETE CASCADE,
  txn_date TEXT NOT NULL,
  txn_type TEXT NOT NULL DEFAULT '',
  num TEXT NOT NULL DEFAULT '',
  vendor TEXT NOT NULL DEFAULT '',
  memo TEXT NOT NULL DEFAULT '',
  gl TEXT NOT NULL,
  bu_code TEXT,
  entity TEXT NOT NULL DEFAULT '',
  amount INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT,
  created_by TEXT
);
CREATE INDEX gc_transactions_close_date ON gc_transactions (close_id, txn_date, num);
CREATE INDEX gc_transactions_close_bu_gl ON gc_transactions (close_id, bu_code, gl);

CREATE TABLE gc_upload_log (
  id TEXT PRIMARY KEY,
  harvest_id TEXT NOT NULL REFERENCES gc_harvests(id) ON DELETE CASCADE,
  close_date TEXT NOT NULL,
  file_name TEXT NOT NULL,
  total INTEGER NOT NULL,
  transactions INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT,
  created_by TEXT
);
CREATE INDEX gc_upload_log_harvest_created ON gc_upload_log (harvest_id, created_at);

CREATE TABLE gc_builds (
  id TEXT PRIMARY KEY,
  harvest_id TEXT NOT NULL REFERENCES gc_harvests(id) ON DELETE CASCADE,
  bu_code TEXT NOT NULL,
  submitted_at TEXT,
  submitted_by TEXT,
  updated_by TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT,
  created_by TEXT,
  UNIQUE (harvest_id, bu_code)
);

CREATE TABLE gc_build_lines (
  id TEXT PRIMARY KEY,
  build_id TEXT NOT NULL REFERENCES gc_builds(id) ON DELETE CASCADE,
  gl TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('notstarted', 'inprogress', 'fixed', 'closed')),
  reason TEXT NOT NULL DEFAULT '',
  is_custom INTEGER NOT NULL DEFAULT 0,
  edited_at TEXT,
  edited_by TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT,
  created_by TEXT,
  UNIQUE (build_id, gl)
);

CREATE TABLE gc_build_items (
  id TEXT PRIMARY KEY,
  line_id TEXT NOT NULL REFERENCES gc_build_lines(id) ON DELETE CASCADE,
  client_id TEXT NOT NULL,
  sort INTEGER NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  po TEXT NOT NULL DEFAULT '',
  driver TEXT CHECK (driver IS NULL OR driver IN ('wet', 'dry', 'bud', 'trim', 'prepack', 'plants')),
  share INTEGER,
  per_hour INTEGER,
  qty INTEGER,
  unit TEXT NOT NULL DEFAULT '',
  unit_cost INTEGER,
  start_on TEXT,
  end_on TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT,
  created_by TEXT
);
CREATE INDEX gc_build_items_line ON gc_build_items (line_id, sort);

CREATE TABLE gc_submissions (
  id TEXT PRIMARY KEY,
  harvest_id TEXT NOT NULL REFERENCES gc_harvests(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('bu', 'final')),
  bu_code TEXT,
  close_date TEXT,
  budget INTEGER NOT NULL,
  actual INTEGER NOT NULL,
  remaining INTEGER NOT NULL,
  landing INTEGER NOT NULL,
  variance INTEGER NOT NULL,
  revenue INTEGER,
  ebitda INTEGER,
  bu_subs TEXT,
  snapshot TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT,
  created_by TEXT NOT NULL,
  CHECK ((kind = 'bu') = (bu_code IS NOT NULL))
);
CREATE INDEX gc_submissions_harvest_created ON gc_submissions (harvest_id, created_at);
