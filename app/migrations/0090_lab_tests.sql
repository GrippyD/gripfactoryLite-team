-- 0090: BRIEF V24, THE LAB STATION (canon 0.30.362).
-- Four tables from the lab package. lab_metrc_packages is not created: the
-- lookup reads metrc_packages. lab_writes is not created: writes land in
-- record_change_log. Column names, types, CHECKs and indexes match the package
-- so a later seed of these four tables applies unchanged.

CREATE TABLE lab_internal_tests (
  id                TEXT PRIMARY KEY,
  tested_at         TEXT,
  tested_at_source  TEXT NOT NULL DEFAULT 'auto'
                    CHECK (tested_at_source IN ('auto','typed','sheet','notes-time','missing')),
  location          TEXT NOT NULL,
  reason            TEXT NOT NULL,
  license           TEXT,
  metrc_tag         TEXT,
  metrc_tag_raw     TEXT,
  sample_type       TEXT NOT NULL,
  moisture_pct      REAL CHECK (moisture_pct IS NULL OR (moisture_pct >= 0.5 AND moisture_pct <= 95)),
  water_activity    REAL CHECK (water_activity IS NULL OR (water_activity >= 0.05 AND water_activity <= 1)),
  thc_pct           REAL CHECK (thc_pct IS NULL OR (thc_pct >= 0 AND thc_pct <= 100)),
  notes             TEXT NOT NULL DEFAULT '',
  operator          TEXT,
  source            TEXT NOT NULL DEFAULT 'station' CHECK (source IN ('station','workbook')),
  sheet_name        TEXT,
  sheet_row         INTEGER,
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL,
  changed_at        TEXT NOT NULL,
  voided_at         TEXT,
  void_reason       TEXT,
  CHECK ((tested_at IS NULL) = (tested_at_source = 'missing')),
  CHECK (moisture_pct IS NOT NULL OR water_activity IS NOT NULL OR thc_pct IS NOT NULL)
);
CREATE INDEX idx_lab_internal_tests_changed ON lab_internal_tests(changed_at);
CREATE INDEX idx_lab_internal_tests_tested ON lab_internal_tests(tested_at DESC);
CREATE INDEX idx_lab_internal_tests_tag ON lab_internal_tests(metrc_tag, tested_at DESC);
CREATE INDEX idx_lab_internal_tests_location ON lab_internal_tests(location, tested_at DESC);

CREATE TABLE lab_compliance_samples (
  id                   TEXT PRIMARY KEY,
  program              TEXT NOT NULL DEFAULT 'compliance' CHECK (program IN ('compliance','rnd')),
  license              TEXT NOT NULL,
  market               TEXT NOT NULL CHECK (market IN ('AU','Med')),
  strain               TEXT,
  item_name            TEXT,
  source_metrc_tag     TEXT NOT NULL,
  batch_weight_g       REAL,
  harvest_batch        TEXT,
  sample_tag           TEXT,
  required_test        TEXT NOT NULL,
  net_weight_g         REAL,
  testing_facility     TEXT,
  entered_testing_on   TEXT,
  finished_testing_on  TEXT,
  thc_potency_pct      REAL,
  status               TEXT NOT NULL DEFAULT 'scheduled'
                       CHECK (status IN ('scheduled','not_submitted','in_testing','passed','failed','retest_passed','retest_failed')),
  fail_reason          TEXT,
  notes                TEXT NOT NULL DEFAULT '',
  scheduled_at         TEXT NOT NULL,
  operator             TEXT,
  source               TEXT NOT NULL DEFAULT 'station' CHECK (source IN ('station','workbook')),
  sheet_name           TEXT,
  sheet_row            INTEGER,
  created_at           TEXT NOT NULL,
  updated_at           TEXT NOT NULL,
  changed_at           TEXT NOT NULL,
  voided_at            TEXT,
  void_reason          TEXT
);
CREATE INDEX idx_lab_compliance_changed ON lab_compliance_samples(changed_at);
CREATE INDEX idx_lab_compliance_status ON lab_compliance_samples(program, status, scheduled_at DESC);
CREATE INDEX idx_lab_compliance_source_tag ON lab_compliance_samples(source_metrc_tag);
CREATE INDEX idx_lab_compliance_sample_tag ON lab_compliance_samples(sample_tag);

CREATE TABLE lab_op_results (
  test_id             TEXT PRIMARY KEY,
  tested_at           TEXT NOT NULL,
  tested_at_offset    TEXT,
  serial_number       TEXT,
  sample_id           TEXT,
  operator            TEXT,
  cultivar            TEXT,
  sample_type         TEXT,
  material_class      TEXT,
  notes               TEXT NOT NULL DEFAULT '',
  weight_g            REAL,
  temperature_c       REAL,
  moisture_correction REAL,
  confidence          TEXT,
  thca REAL, d9_thc REAL, cbda REAL, cbd REAL, cbga REAL, cbg REAL, cbna REAL, cbn REAL,
  cbca REAL, cbc REAL, d8_thc REAL, d10_thc REAL, thcva REAL, thcv REAL,
  total_thc REAL, total_cbd REAL, total_cannabinoids REAL,
  terpenes_level      TEXT CHECK (terpenes_level IS NULL OR terpenes_level IN ('ND','Low','Medium','High')),
  nd_json             TEXT NOT NULL DEFAULT '[]',
  raw_json            TEXT NOT NULL DEFAULT '{}',
  source              TEXT NOT NULL DEFAULT 'station' CHECK (source IN ('station','workbook')),
  sheet_row           INTEGER,
  imported_at         TEXT NOT NULL,
  changed_at          TEXT NOT NULL,
  voided_at           TEXT,
  void_reason         TEXT
);
CREATE INDEX idx_lab_op_results_tested ON lab_op_results(tested_at DESC);
CREATE INDEX idx_lab_op_results_changed ON lab_op_results(changed_at);
CREATE INDEX idx_lab_op_results_class ON lab_op_results(material_class, tested_at DESC);

CREATE TABLE lab_sample_schedule (
  day        TEXT NOT NULL,
  hour       INTEGER NOT NULL CHECK (hour >= 0 AND hour <= 23),
  location   TEXT NOT NULL,
  operator   TEXT,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (day, hour, location)
);
