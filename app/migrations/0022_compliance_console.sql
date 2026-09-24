-- Compliance Console: audits, ride-along notes, internal instrument results,
-- and the external workbook model (canon 0.20.0). Also seeds failure modes,
-- testing labs, and the L-4 internal audit interval.

CREATE TABLE audits (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  agency TEXT,
  agency_contact TEXT,
  grip_rep TEXT,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  created_at TEXT NOT NULL,
  created_by TEXT,
  updated_at TEXT NOT NULL,
  updated_by TEXT,
  deleted_at TEXT,
  deleted_by TEXT,
  delete_reason TEXT
);

CREATE INDEX audits_kind ON audits (kind, started_at);
CREATE INDEX audits_finished ON audits (finished_at, kind);

CREATE TABLE audit_notes (
  id TEXT PRIMARY KEY,
  audit_id TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL,
  created_by TEXT,
  updated_at TEXT NOT NULL,
  updated_by TEXT,
  deleted_at TEXT,
  deleted_by TEXT,
  delete_reason TEXT
);

CREATE INDEX audit_notes_audit ON audit_notes (audit_id, created_at);

CREATE TABLE internal_test_results (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL,
  package_tag TEXT,
  hbn TEXT,
  sample_id TEXT,
  tested_at TEXT NOT NULL,
  analyte TEXT NOT NULL,
  value NUMERIC NOT NULL,
  unit TEXT NOT NULL,
  import_id TEXT,
  created_at TEXT NOT NULL,
  created_by TEXT,
  updated_at TEXT NOT NULL,
  updated_by TEXT,
  deleted_at TEXT,
  deleted_by TEXT,
  delete_reason TEXT
);

CREATE INDEX internal_test_results_hbn ON internal_test_results (hbn, tested_at);
CREATE INDEX internal_test_results_source ON internal_test_results (source, tested_at);

CREATE TABLE external_test_results (
  id TEXT PRIMARY KEY,
  license_number TEXT,
  med_au TEXT,
  strain TEXT,
  item_name TEXT,
  source_metrc_tag TEXT,
  batch_weight_grams NUMERIC,
  hbn TEXT,
  sample_tag TEXT,
  required_test TEXT,
  net_weight_grams NUMERIC,
  testing_facility TEXT,
  entered_testing TEXT,
  finished_testing TEXT,
  attempt INTEGER NOT NULL DEFAULT 1,
  potency_result NUMERIC,
  finalized_potency NUMERIC,
  status TEXT,
  failure_mode TEXT,
  created_at TEXT NOT NULL,
  created_by TEXT,
  updated_at TEXT NOT NULL,
  updated_by TEXT,
  deleted_at TEXT,
  deleted_by TEXT,
  delete_reason TEXT
);

CREATE INDEX external_test_results_sample ON external_test_results (sample_tag, attempt);
CREATE INDEX external_test_results_status ON external_test_results (status, entered_testing);
CREATE INDEX external_test_results_finished ON external_test_results (finished_testing);

INSERT INTO app_config (
  key, value, created_at, created_by, updated_at, updated_by, deleted_at, deleted_by
) VALUES
  ('internal_audit_interval_days', '30', '2026-09-04T00:00:00.000Z', NULL, '2026-09-04T00:00:00.000Z', NULL, NULL, NULL);

INSERT INTO lookup_values (
  id, category, value, label, sort_order,
  created_at, created_by, updated_at, updated_by, deleted_at, deleted_by, delete_reason
) VALUES
  ('a2000022-0001-4000-8000-000000000001', 'failure_mode', 'Coliforms', 'Coliforms', 1, '2026-09-04T00:00:00.000Z', NULL, '2026-09-04T00:00:00.000Z', NULL, NULL, NULL, NULL),
  ('a2000022-0001-4000-8000-000000000002', 'failure_mode', 'Heavy Metals', 'Heavy Metals', 2, '2026-09-04T00:00:00.000Z', NULL, '2026-09-04T00:00:00.000Z', NULL, NULL, NULL, NULL),
  ('a2000022-0001-4000-8000-000000000003', 'failure_mode', 'Total Yeast and Mold', 'Total Yeast and Mold', 3, '2026-09-04T00:00:00.000Z', NULL, '2026-09-04T00:00:00.000Z', NULL, NULL, NULL, NULL),
  ('a2000022-0001-4000-8000-000000000004', 'failure_mode', 'Aspergillus', 'Aspergillus', 4, '2026-09-04T00:00:00.000Z', NULL, '2026-09-04T00:00:00.000Z', NULL, NULL, NULL, NULL),
  ('a2000022-0001-4000-8000-000000000005', 'failure_mode', 'Salmonella', 'Salmonella', 5, '2026-09-04T00:00:00.000Z', NULL, '2026-09-04T00:00:00.000Z', NULL, NULL, NULL, NULL),
  ('a2000022-0001-4000-8000-000000000006', 'failure_mode', 'STEC', 'STEC', 6, '2026-09-04T00:00:00.000Z', NULL, '2026-09-04T00:00:00.000Z', NULL, NULL, NULL, NULL),
  ('a2000022-0001-4000-8000-000000000007', 'failure_mode', 'Pesticides', 'Pesticides', 7, '2026-09-04T00:00:00.000Z', NULL, '2026-09-04T00:00:00.000Z', NULL, NULL, NULL, NULL),
  ('a2000022-0001-4000-8000-000000000008', 'failure_mode', 'Residual Solvents', 'Residual Solvents', 8, '2026-09-04T00:00:00.000Z', NULL, '2026-09-04T00:00:00.000Z', NULL, NULL, NULL, NULL),
  ('a2000022-0001-4000-8000-000000000009', 'failure_mode', 'Foreign Matter', 'Foreign Matter', 9, '2026-09-04T00:00:00.000Z', NULL, '2026-09-04T00:00:00.000Z', NULL, NULL, NULL, NULL),
  ('a2000022-0001-4000-8000-00000000000a', 'failure_mode', 'Water Activity', 'Water Activity', 10, '2026-09-04T00:00:00.000Z', NULL, '2026-09-04T00:00:00.000Z', NULL, NULL, NULL, NULL),
  ('a2000022-0001-4000-8000-00000000000b', 'failure_mode', 'Potency Fail', 'Potency Fail', 11, '2026-09-04T00:00:00.000Z', NULL, '2026-09-04T00:00:00.000Z', NULL, NULL, NULL, NULL),
  ('a2000022-0002-4000-8000-000000000001', 'testing_lab', 'SC Labs', 'SC Labs (SC-000035 / AU-SC-000129)', 1, '2026-09-04T00:00:00.000Z', NULL, '2026-09-04T00:00:00.000Z', NULL, NULL, NULL, NULL),
  ('a2000022-0002-4000-8000-000000000002', 'testing_lab', 'Lab Link', 'Lab Link', 2, '2026-09-04T00:00:00.000Z', NULL, '2026-09-04T00:00:00.000Z', NULL, NULL, NULL, NULL),
  ('a2000022-0002-4000-8000-000000000003', 'testing_lab', 'Viridis', 'Viridis', 3, '2026-09-04T00:00:00.000Z', NULL, '2026-09-04T00:00:00.000Z', NULL, NULL, NULL, NULL);
