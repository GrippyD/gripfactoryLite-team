-- 0070: THE IN TESTING SHEET (canon 0.30.187). The workbook seeds the
-- compliance table and the desk. Driver Info is never read. Old sheet
-- sync rows are the Labor tab. Old external rows are manual. Old desk
-- rows are desk. lot_id may be null when the season's HBN predates the app.

ALTER TABLE sheet_sync_runs ADD COLUMN source TEXT NOT NULL DEFAULT 'labor';

ALTER TABLE external_test_results ADD COLUMN source TEXT NOT NULL DEFAULT 'manual';
ALTER TABLE external_test_results ADD COLUMN sheet_key TEXT;
ALTER TABLE external_test_results ADD COLUMN sheet_seen_at TEXT;
ALTER TABLE external_test_results ADD COLUMN on_sheet INTEGER NOT NULL DEFAULT 0;
ALTER TABLE external_test_results ADD COLUMN notes TEXT;

CREATE UNIQUE INDEX external_test_results_sheet_key ON external_test_results (sheet_key);

ALTER TABLE test_samples ADD COLUMN source TEXT NOT NULL DEFAULT 'desk';
ALTER TABLE test_samples ADD COLUMN sheet_key TEXT;
ALTER TABLE test_samples ADD COLUMN sheet_seen_at TEXT;
ALTER TABLE test_samples ADD COLUMN on_sheet INTEGER NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX test_samples_sheet_key ON test_samples (sheet_key);

CREATE TABLE test_orders__0070 (
  id TEXT PRIMARY KEY,
  lot_id TEXT,
  source_package_tag TEXT,
  source_package_code TEXT,
  item_name TEXT,
  license_value TEXT,
  market TEXT NOT NULL,
  lab_id TEXT NOT NULL,
  panel TEXT NOT NULL,
  required_lab_test_batch TEXT NOT NULL,
  batch_grams NUMERIC NOT NULL,
  sample_grams INTEGER NOT NULL,
  status TEXT NOT NULL,
  pickup_date TEXT,
  notes TEXT,
  failure_note TEXT,
  metrc_lab_testing_state TEXT,
  metrc_state_date TEXT,
  remediated_reason TEXT,
  cra_approval_ref TEXT,
  remediated_date TEXT,
  created_at TEXT NOT NULL,
  created_by TEXT,
  updated_at TEXT NOT NULL,
  updated_by TEXT,
  deleted_at TEXT,
  deleted_by TEXT,
  delete_reason TEXT,
  source TEXT NOT NULL DEFAULT 'desk',
  sheet_key TEXT,
  sheet_seen_at TEXT,
  on_sheet INTEGER NOT NULL DEFAULT 0
);

INSERT INTO test_orders__0070 (
  id, lot_id, source_package_tag, source_package_code, item_name, license_value, market,
  lab_id, panel, required_lab_test_batch, batch_grams, sample_grams, status, pickup_date, notes,
  failure_note, metrc_lab_testing_state, metrc_state_date, remediated_reason, cra_approval_ref,
  remediated_date, created_at, created_by, updated_at, updated_by, deleted_at, deleted_by, delete_reason,
  source, sheet_key, sheet_seen_at, on_sheet
)
SELECT
  id, lot_id, source_package_tag, source_package_code, item_name, license_value, market,
  lab_id, panel, required_lab_test_batch, batch_grams, sample_grams, status, pickup_date, notes,
  failure_note, metrc_lab_testing_state, metrc_state_date, remediated_reason, cra_approval_ref,
  remediated_date, created_at, created_by, updated_at, updated_by, deleted_at, deleted_by, delete_reason,
  'desk', NULL, NULL, 0
FROM test_orders;

DROP TABLE test_orders;

ALTER TABLE test_orders__0070 RENAME TO test_orders;

CREATE INDEX test_orders_lot ON test_orders (lot_id, status);
CREATE UNIQUE INDEX test_orders_sheet_key ON test_orders (sheet_key);

INSERT OR IGNORE INTO app_config (
  key, value, created_at, created_by, updated_at, updated_by, deleted_at, deleted_by
) VALUES
  ('in_testing_drive_id', 'b!hLLp1cDWXkeCQTO5rv3K44ZzPy9mrjZFgUOar8SCPqxXhso9CN3pSqsCANdLw8Oi', '2026-09-22T00:00:00.000Z', NULL, '2026-09-22T00:00:00.000Z', NULL, NULL, NULL),
  ('in_testing_item_id', '01C7EIU74K7VJA3Z347JAID22RNDPMYR5R', '2026-09-22T00:00:00.000Z', NULL, '2026-09-22T00:00:00.000Z', NULL, NULL, NULL),
  ('in_testing_tab', 'In Testing', '2026-09-22T00:00:00.000Z', NULL, '2026-09-22T00:00:00.000Z', NULL, NULL, NULL),
  ('in_testing_rnd_tab', 'R&D', '2026-09-22T00:00:00.000Z', NULL, '2026-09-22T00:00:00.000Z', NULL, NULL, NULL),
  ('in_testing_lab_aliases', 'ACTLab=act-laboratories; ACT Laboratories=act-laboratories; ACT=act-laboratories; SC Labs=sc-labs-michigan; SC Labs Michigan=sc-labs-michigan; SCLabs=sc-labs-michigan; Lab Link=lab-link; LabLink=lab-link; Viridis=viridis', '2026-09-22T00:00:00.000Z', NULL, '2026-09-22T00:00:00.000Z', NULL, NULL, NULL),
  ('in_testing_fail_types', 'Coliforms=microbials; Total Yeast & Mold=microbials; Total Yeast and Mold=microbials; Yeast & Mold=microbials; Heavy Metals=heavy_metals; Foreign Matter=foreign_matter; Water Activity=water_activity; Pesticides=chemical_residue; Chemical Residue=chemical_residue; Mycotoxins=mycotoxins; Potency=potency', '2026-09-22T00:00:00.000Z', NULL, '2026-09-22T00:00:00.000Z', NULL, NULL, NULL);
