-- Local inventory ledger plus the generic simple-list lookup home (canon 0.17.0).
-- Locations stay LOCAL; METRC is left alone. Item kinds are lookup-backed data,
-- never DDL checks, so a naming-doc rename is an Admin edit.

CREATE TABLE lookup_values (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL,
  value TEXT NOT NULL,
  label TEXT NOT NULL,
  sort_order INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  created_by TEXT,
  updated_at TEXT NOT NULL,
  updated_by TEXT,
  deleted_at TEXT,
  deleted_by TEXT
);

CREATE INDEX lookup_values_category ON lookup_values (category, sort_order);

CREATE TABLE local_inventory_items (
  id TEXT PRIMARY KEY,
  item_kind TEXT NOT NULL,
  package_code TEXT NOT NULL,
  harvest_batch_id TEXT,
  wet_weight_entry_id TEXT,
  wip_package_id TEXT,
  strain_id TEXT,
  qty NUMERIC NOT NULL,
  uom TEXT NOT NULL DEFAULT 'g',
  farm_code TEXT NOT NULL,
  license_value TEXT NOT NULL,
  location TEXT NOT NULL,
  created_at TEXT NOT NULL,
  created_by TEXT,
  updated_at TEXT NOT NULL,
  updated_by TEXT,
  deleted_at TEXT,
  deleted_by TEXT,
  delete_reason TEXT
);

CREATE INDEX local_inventory_items_kind ON local_inventory_items (item_kind, created_at);
CREATE INDEX local_inventory_items_lot ON local_inventory_items (wet_weight_entry_id);
CREATE INDEX local_inventory_items_location ON local_inventory_items (location);

INSERT INTO lookup_values (
  id, category, value, label, sort_order,
  created_at, created_by, updated_at, updated_by, deleted_at, deleted_by
) VALUES
  ('a2000001-0001-4000-8000-000000000001', 'silo_number', '1', '1', 1, '2026-09-03T00:00:00.000Z', NULL, '2026-09-03T00:00:00.000Z', NULL, NULL, NULL),
  ('a2000001-0001-4000-8000-000000000002', 'silo_number', '2', '2', 2, '2026-09-03T00:00:00.000Z', NULL, '2026-09-03T00:00:00.000Z', NULL, NULL, NULL),
  ('a2000001-0001-4000-8000-000000000003', 'silo_number', '3', '3', 3, '2026-09-03T00:00:00.000Z', NULL, '2026-09-03T00:00:00.000Z', NULL, NULL, NULL),
  ('a2000001-0001-4000-8000-000000000004', 'silo_number', '4', '4', 4, '2026-09-03T00:00:00.000Z', NULL, '2026-09-03T00:00:00.000Z', NULL, NULL, NULL),
  ('a2000001-0001-4000-8000-000000000005', 'silo_number', '5', '5', 5, '2026-09-03T00:00:00.000Z', NULL, '2026-09-03T00:00:00.000Z', NULL, NULL, NULL),
  ('a2000001-0001-4000-8000-000000000006', 'silo_number', 'NA', 'NA', 6, '2026-09-03T00:00:00.000Z', NULL, '2026-09-03T00:00:00.000Z', NULL, NULL, NULL),
  ('a2000002-0001-4000-8000-000000000001', 'inventory_location', 'CSA', 'CSA', 1, '2026-09-03T00:00:00.000Z', NULL, '2026-09-03T00:00:00.000Z', NULL, NULL, NULL),
  ('a2000002-0001-4000-8000-000000000002', 'inventory_location', 'CSB', 'CSB', 2, '2026-09-03T00:00:00.000Z', NULL, '2026-09-03T00:00:00.000Z', NULL, NULL, NULL),
  ('a2000002-0001-4000-8000-000000000003', 'inventory_location', 'IN-TRANSIT', 'In transit', 3, '2026-09-03T00:00:00.000Z', NULL, '2026-09-03T00:00:00.000Z', NULL, NULL, NULL),
  ('a2000003-0001-4000-8000-000000000001', 'item_kind', 'SPR', 'SPR', 1, '2026-09-03T00:00:00.000Z', NULL, '2026-09-03T00:00:00.000Z', NULL, NULL, NULL),
  ('a2000003-0001-4000-8000-000000000002', 'item_kind', 'WIP', 'WIP', 2, '2026-09-03T00:00:00.000Z', NULL, '2026-09-03T00:00:00.000Z', NULL, NULL, NULL),
  ('a2000003-0001-4000-8000-000000000003', 'item_kind', 'FG', 'FG', 3, '2026-09-03T00:00:00.000Z', NULL, '2026-09-03T00:00:00.000Z', NULL, NULL, NULL),
  ('a2000004-0001-4000-8000-000000000001', 'license', 'AU-G-C-000832', 'AU-Grow', 1, '2026-09-03T00:00:00.000Z', NULL, '2026-09-03T00:00:00.000Z', NULL, NULL, NULL),
  ('a2000004-0001-4000-8000-000000000002', 'license', 'AU-P-000694', 'AU-Processor', 2, '2026-09-03T00:00:00.000Z', NULL, '2026-09-03T00:00:00.000Z', NULL, NULL, NULL),
  ('a2000005-0001-4000-8000-000000000001', 'uom', 'g', 'Grams', 1, '2026-09-03T00:00:00.000Z', NULL, '2026-09-03T00:00:00.000Z', NULL, NULL, NULL);
