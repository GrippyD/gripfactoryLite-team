-- THE METRC MIRROR (canon 0.30.38). Owner, 2026-09-11: "Let's start the
-- internal inventory slice.  I think it would be smart to start with all the
-- inventory at all the sites.  I've dropped all the inventory here. ... Now, I
-- am going to want to add our own internal fields to these records that are
-- not METRC related so we might need to do some stretching as we move". His
-- picks on the forks: F1 "Mirror + field registry", F2 "Both" (METRC's xlsx or
-- CSV). The state's rows are mirrored by tag exactly as METRC states them, one
-- table for plants and one for packages, fed by a drop lane like the Zoho tab:
-- the export is the truth of METRC as of the drop for its license and kind; a
-- newer drop updates rows in place and marks the rows it no longer carries as
-- gone; history is never edited. Our own fields hang off the tag in
-- internal_field_values; the field list is a lookup (category internal_field:
-- value = key, label = the display name, tone = plants, packages, or blank for
-- both), so a new field is an Admin row, not a migration.

CREATE TABLE metrc_mounts (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  phase TEXT,
  license_value TEXT NOT NULL,
  filename TEXT NOT NULL,
  file_format TEXT NOT NULL,
  rows_total INTEGER NOT NULL,
  rows_added INTEGER NOT NULL,
  rows_updated INTEGER NOT NULL,
  rows_unchanged INTEGER NOT NULL,
  rows_gone INTEGER NOT NULL,
  summary TEXT NOT NULL,
  created_at TEXT NOT NULL,
  created_by TEXT,
  updated_at TEXT NOT NULL,
  updated_by TEXT,
  deleted_at TEXT,
  deleted_by TEXT,
  delete_reason TEXT
);

CREATE INDEX metrc_mounts_created ON metrc_mounts (created_at);

CREATE TABLE metrc_plants (
  tag TEXT PRIMARY KEY,
  license_value TEXT NOT NULL,
  phase TEXT NOT NULL,
  strain TEXT,
  location TEXT,
  sublocation TEXT,
  hold INTEGER NOT NULL DEFAULT 0,
  plant_batch TEXT,
  plant_batch_type TEXT,
  plant_batch_date TEXT,
  phase_date TEXT,
  harvested INTEGER NOT NULL DEFAULT 0,
  mount_id TEXT NOT NULL,
  first_seen_at TEXT NOT NULL,
  changed_at TEXT NOT NULL,
  gone_at TEXT,
  gone_mount_id TEXT
);

CREATE INDEX metrc_plants_license_phase ON metrc_plants (license_value, phase, gone_at);
CREATE INDEX metrc_plants_strain_location ON metrc_plants (license_value, strain, location);

CREATE TABLE metrc_packages (
  tag TEXT PRIMARY KEY,
  license_value TEXT NOT NULL,
  source_harvests TEXT,
  source_packages TEXT,
  original_source_label TEXT,
  source_processing_jobs TEXT,
  location TEXT,
  sublocation TEXT,
  item TEXT,
  category TEXT,
  item_strain TEXT,
  quantity NUMERIC,
  uom TEXT,
  production_batch TEXT,
  source_production_batch TEXT,
  lab_test_status TEXT,
  finished_goods INTEGER NOT NULL DEFAULT 0,
  admin_hold INTEGER NOT NULL DEFAULT 0,
  admin_recall INTEGER NOT NULL DEFAULT 0,
  packaged_date TEXT,
  received_date TEXT,
  expiration_date TEXT,
  lab_test_expiration TEXT,
  mount_id TEXT NOT NULL,
  first_seen_at TEXT NOT NULL,
  changed_at TEXT NOT NULL,
  gone_at TEXT,
  gone_mount_id TEXT
);

CREATE INDEX metrc_packages_license ON metrc_packages (license_value, gone_at);
CREATE INDEX metrc_packages_category ON metrc_packages (license_value, category);
CREATE INDEX metrc_packages_location ON metrc_packages (location);

CREATE TABLE internal_field_values (
  id TEXT PRIMARY KEY,
  tag TEXT NOT NULL,
  field_key TEXT NOT NULL,
  value TEXT,
  created_at TEXT NOT NULL,
  created_by TEXT,
  updated_at TEXT NOT NULL,
  updated_by TEXT,
  deleted_at TEXT,
  deleted_by TEXT,
  delete_reason TEXT
);

CREATE UNIQUE INDEX internal_field_values_tag_key ON internal_field_values (tag, field_key);

-- The first fields, the Scribe's reading of his data (fork F3 stays his to
-- amend in Admin): our location code, quality grade, market strain, the Zoho
-- SKU when it differs from the tag, the intended lane, and notes. All text.
INSERT OR IGNORE INTO lookup_values (
  id, category, value, label, tone, sort_order,
  created_at, created_by, updated_at, updated_by, deleted_at, deleted_by
) VALUES
  ('c4200001-0001-4000-8000-000000000001', 'internal_field', 'location_code', 'Location code', 'packages', 10, '2026-09-11T00:00:00.000Z', NULL, '2026-09-11T00:00:00.000Z', NULL, NULL, NULL),
  ('c4200001-0001-4000-8000-000000000002', 'internal_field', 'quality', 'Quality grade', 'packages', 20, '2026-09-11T00:00:00.000Z', NULL, '2026-09-11T00:00:00.000Z', NULL, NULL, NULL),
  ('c4200001-0001-4000-8000-000000000003', 'internal_field', 'market_strain', 'Market strain', NULL, 30, '2026-09-11T00:00:00.000Z', NULL, '2026-09-11T00:00:00.000Z', NULL, NULL, NULL),
  ('c4200001-0001-4000-8000-000000000004', 'internal_field', 'zoho_sku', 'Zoho SKU', 'packages', 40, '2026-09-11T00:00:00.000Z', NULL, '2026-09-11T00:00:00.000Z', NULL, NULL, NULL),
  ('c4200001-0001-4000-8000-000000000005', 'internal_field', 'lane', 'Intended lane', 'packages', 50, '2026-09-11T00:00:00.000Z', NULL, '2026-09-11T00:00:00.000Z', NULL, NULL, NULL),
  ('c4200001-0001-4000-8000-000000000006', 'internal_field', 'notes', 'Notes', NULL, 60, '2026-09-11T00:00:00.000Z', NULL, '2026-09-11T00:00:00.000Z', NULL, NULL, NULL);
