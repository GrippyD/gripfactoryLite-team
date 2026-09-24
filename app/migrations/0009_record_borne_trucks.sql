-- Owner ruling 2026-08-31: trucks must never persist in the Move To catalog.
-- Trucks live on the lot record itself: wet_weight_entries.truck_number holds the
-- per-HBN number, the truck list starts at zero for every HBN, and Add a truck
-- stages the next number for that HBN only. A single standing sentinel row backs
-- the NOT NULL dry_space_id for truck lots; the break-in Truck N catalog rows
-- retire here by soft delete. LIKE 'Truck %' cannot match the sentinel name
-- 'Truck' (no trailing space), so the order is safe either way; retire first anyway.

UPDATE dry_spaces SET deleted_at = '2026-08-31T00:00:00.000Z' WHERE name LIKE 'Truck %' AND deleted_at IS NULL;

INSERT OR IGNORE INTO dry_spaces (
  id, name, kind, farm_code, created_at, created_by, updated_at, updated_by, deleted_at, deleted_by
) VALUES
  ('a1000001-0000-4000-8000-000000000009', 'Truck', 'truck', NULL, '2026-08-31T00:00:00.000Z', NULL, '2026-08-31T00:00:00.000Z', NULL, NULL, NULL);
