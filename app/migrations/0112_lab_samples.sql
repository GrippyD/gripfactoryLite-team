-- TL1: the lab samples door. One row per lab sample, keyed by the lab code.
-- Nothing seeded. Guarded: a second apply changes nothing.

CREATE TABLE IF NOT EXISTS lab_samples (
  lab_code TEXT PRIMARY KEY,
  lab_name TEXT,
  intake_date TEXT NOT NULL,
  product_code TEXT,
  product TEXT,
  strain TEXT,
  farm TEXT,
  metrc_tag TEXT,
  test_type TEXT,
  status TEXT,
  result TEXT,
  failure_mode TEXT,
  coliforms_cfu INTEGER,
  yeast_mold_cfu INTEGER,
  other_failed_analyte TEXT,
  total_thc_pct REAL,
  coa_posted_at TEXT,
  tat_days REAL,
  batch_qty_g INTEGER,
  source TEXT NOT NULL CHECK (source IN ('upload', 'feed')),
  first_seen_at TEXT NOT NULL,
  changed_at TEXT NOT NULL,
  received_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS lab_samples_intake_date ON lab_samples (intake_date);

CREATE INDEX IF NOT EXISTS lab_samples_coa_posted_at ON lab_samples (coa_posted_at);
