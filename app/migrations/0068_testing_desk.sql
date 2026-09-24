-- 0068: THE TESTING DESK, part 1 (canon 0.30.164). The lab tech schedules,
-- samples, manifests, and records results. Nothing here calls Metrc.
-- Driver names, phones, and license numbers are typed per manifest and are
-- never seeded. Lab license numbers are the workbook's; the CRA check is
-- still the owner's before he treats them as verified.
--
-- sample_increment_grams is null until a lab's increment is known. The
-- sample size is then 0.5 percent of the batch, with a 14 g floor.
-- Mirror columns stay NULL until the API slice.

CREATE TABLE testing_labs (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  portal_kind TEXT NOT NULL,
  portal_url TEXT,
  med_license TEXT,
  au_license TEXT,
  turnaround_days INTEGER,
  pickup_cutoff TEXT,
  sample_increment_grams INTEGER,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  created_by TEXT,
  updated_at TEXT NOT NULL,
  updated_by TEXT,
  deleted_at TEXT,
  deleted_by TEXT,
  delete_reason TEXT
);

CREATE TABLE test_orders (
  id TEXT PRIMARY KEY,
  lot_id TEXT NOT NULL,
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
  delete_reason TEXT
);

CREATE INDEX test_orders_lot ON test_orders (lot_id, status);

CREATE TABLE test_manifests (
  id TEXT PRIMARY KEY,
  lab_id TEXT NOT NULL,
  license_value TEXT NOT NULL,
  manifest_date TEXT NOT NULL,
  metrc_manifest_number TEXT,
  driver_name TEXT,
  driver_license TEXT,
  driver_phone TEXT,
  vehicle_make TEXT,
  vehicle_model TEXT,
  vehicle_plate TEXT,
  route_note TEXT,
  harvest_batch_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  created_by TEXT,
  updated_at TEXT NOT NULL,
  updated_by TEXT,
  deleted_at TEXT,
  deleted_by TEXT,
  delete_reason TEXT
);

CREATE INDEX test_manifests_lab ON test_manifests (lab_id, manifest_date);

CREATE TABLE test_samples (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL,
  manifest_id TEXT,
  sample_tag TEXT NOT NULL,
  net_grams INTEGER NOT NULL,
  gross_grams INTEGER,
  sampled_at TEXT NOT NULL,
  sampler_name TEXT,
  grower_witness TEXT,
  chain_of_custody_ref TEXT,
  sealed_container_ref TEXT,
  attempt INTEGER NOT NULL,
  overall_passed INTEGER,
  thc_total_pct NUMERIC,
  thca_pct NUMERIC,
  cbd_total_pct NUMERIC,
  water_activity_aw NUMERIC,
  coa_url TEXT,
  coa_file_id TEXT,
  lab_sample_id TEXT,
  results_at TEXT,
  failure_note TEXT,
  metrc_lab_testing_state TEXT,
  metrc_state_date TEXT,
  metrc_result_id TEXT,
  created_at TEXT NOT NULL,
  created_by TEXT,
  updated_at TEXT NOT NULL,
  updated_by TEXT,
  deleted_at TEXT,
  deleted_by TEXT,
  delete_reason TEXT
);

CREATE INDEX test_samples_order ON test_samples (order_id);
CREATE INDEX test_samples_tag ON test_samples (sample_tag);
CREATE INDEX test_samples_manifest ON test_samples (manifest_id);

CREATE TABLE test_results (
  id TEXT PRIMARY KEY,
  sample_id TEXT NOT NULL,
  test_type TEXT NOT NULL,
  passed INTEGER NOT NULL,
  value NUMERIC,
  unit TEXT,
  qualifier TEXT,
  notes TEXT,
  result_date TEXT,
  metrc_result_id TEXT,
  created_at TEXT NOT NULL,
  created_by TEXT,
  updated_at TEXT NOT NULL,
  updated_by TEXT,
  deleted_at TEXT,
  deleted_by TEXT,
  delete_reason TEXT
);

CREATE INDEX test_results_sample ON test_results (sample_id, test_type);

INSERT INTO testing_labs (
  id, name, portal_kind, portal_url, med_license, au_license,
  turnaround_days, pickup_cutoff, sample_increment_grams, active,
  created_at, created_by, updated_at, updated_by, deleted_at, deleted_by
) VALUES
  (
    'sc-labs-michigan', 'SC Labs Michigan', 'tagleaf',
    'https://lims.tagleaf.com/login?affiliate=can-lab-llc',
    'SC-000035', 'AU-SC-000129',
    NULL, NULL, NULL, 1,
    '2026-09-21T00:00:00.000Z', NULL, '2026-09-21T00:00:00.000Z', NULL, NULL, NULL
  ),
  (
    'act-laboratories', 'ACT Laboratories', 'slingr',
    'https://actcustomerportal.slingrs.io/prod/runtime/login.html',
    'SC-000048', 'AU-SC-000152',
    NULL, NULL, NULL, 1,
    '2026-09-21T00:00:00.000Z', NULL, '2026-09-21T00:00:00.000Z', NULL, NULL, NULL
  ),
  (
    'lab-link', 'Lab Link', 'other',
    NULL,
    'SC-000037', 'AU-SC-000133',
    NULL, NULL, NULL, 1,
    '2026-09-21T00:00:00.000Z', NULL, '2026-09-21T00:00:00.000Z', NULL, NULL, NULL
  ),
  (
    'viridis', 'Viridis', 'other',
    NULL,
    'SC-000009', 'AU-SC-000113',
    NULL, NULL, NULL, 0,
    '2026-09-21T00:00:00.000Z', NULL, '2026-09-21T00:00:00.000Z', NULL, NULL, NULL
  );
