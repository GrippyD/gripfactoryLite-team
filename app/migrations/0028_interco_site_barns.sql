-- Interco rework, per-site barns and CSA restored (canon 0.23.0 through 0.25.0).
-- Barns are the universal inbox and outbox at every site. ARL BARN and PNS BARN
-- join BARN (PNN / Building 24). The 0.24.2 silo law restores CSA as the 832-side
-- post-dry staging; the 0021 cutover note stands as history.
-- Side convention v2 is data in code (SITE_OF_LOCATION), not schema.
-- Cutover: items sitting in BARN whose harvest batch farm is ARL move to ARL BARN;
-- PNS likewise. PNN stays BARN. Items with no batch stay put. IN-TRANSIT untouched.

INSERT INTO lookup_values (
  id, category, value, label, sort_order,
  created_at, created_by, updated_at, updated_by, deleted_at, deleted_by, delete_reason
) VALUES
  ('a2000002-0001-4000-8000-000000000005', 'inventory_location', 'ARL BARN', 'ARL Barn', 4, '2026-09-05T00:00:00.000Z', NULL, '2026-09-05T00:00:00.000Z', NULL, NULL, NULL, NULL),
  ('a2000002-0001-4000-8000-000000000006', 'inventory_location', 'PNS BARN', 'PNS Barn', 5, '2026-09-05T00:00:00.000Z', NULL, '2026-09-05T00:00:00.000Z', NULL, NULL, NULL, NULL);

-- 0.24.2 silo law restores CSA as the 832-side post-dry staging.
UPDATE lookup_values
   SET deleted_at = NULL,
       deleted_by = NULL,
       delete_reason = NULL,
       updated_at = '2026-09-05T00:00:00.000Z'
 WHERE category = 'inventory_location' AND value = 'CSA';

UPDATE local_inventory_items
   SET location = 'ARL BARN'
 WHERE location = 'BARN'
   AND harvest_batch_id IN (SELECT id FROM harvest_batches WHERE farm_code = 'ARL' AND deleted_at IS NULL);

UPDATE local_inventory_items
   SET location = 'PNS BARN'
 WHERE location = 'BARN'
   AND harvest_batch_id IN (SELECT id FROM harvest_batches WHERE farm_code = 'PNS' AND deleted_at IS NULL);
