-- Walk slice: license tones and the seven real licenses, plus the optional
-- METRC manifest number and per-item received quantity.
-- Migrations 0001 through 0019 stay frozen.

ALTER TABLE lookup_values ADD COLUMN tone TEXT;

UPDATE lookup_values
SET label = 'PNN AU', tone = 'blue', sort_order = 1, updated_at = '2026-09-04T00:00:00.000Z'
WHERE id = 'a2000004-0001-4000-8000-000000000001';

UPDATE lookup_values
SET label = 'PNN Processor', tone = 'green', sort_order = 3, updated_at = '2026-09-04T00:00:00.000Z'
WHERE id = 'a2000004-0001-4000-8000-000000000002';

INSERT INTO lookup_values (
  id, category, value, label, sort_order, tone,
  created_at, created_by, updated_at, updated_by, deleted_at, deleted_by
) VALUES
  ('a2000004-0001-4000-8000-000000000003', 'license', 'GR-C-001132', 'PNN Med', 2, 'yellow', '2026-09-04T00:00:00.000Z', NULL, '2026-09-04T00:00:00.000Z', NULL, NULL, NULL),
  ('a2000004-0001-4000-8000-000000000004', 'license', 'AU-G-C-001397', 'PNS AU', 4, 'blue', '2026-09-04T00:00:00.000Z', NULL, '2026-09-04T00:00:00.000Z', NULL, NULL, NULL),
  ('a2000004-0001-4000-8000-000000000005', 'license', 'GR-C-001405', 'PNS Med', 5, 'yellow', '2026-09-04T00:00:00.000Z', NULL, '2026-09-04T00:00:00.000Z', NULL, NULL, NULL),
  ('a2000004-0001-4000-8000-000000000006', 'license', 'AU-G-C-001509', 'ARL AU', 6, 'blue', '2026-09-04T00:00:00.000Z', NULL, '2026-09-04T00:00:00.000Z', NULL, NULL, NULL),
  ('a2000004-0001-4000-8000-000000000007', 'license', 'GR-C-002600', 'ARL Med', 7, 'yellow', '2026-09-04T00:00:00.000Z', NULL, '2026-09-04T00:00:00.000Z', NULL, NULL, NULL);

ALTER TABLE interco_movements ADD COLUMN metrc_manifest_number TEXT;

ALTER TABLE interco_movement_items ADD COLUMN received_qty NUMERIC;
