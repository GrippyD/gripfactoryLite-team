-- Marketplace rework and package splits (canon 0.22.0 rulings, cut at 0.24.0).
-- Label, not tag: package_label is the sales-facing free-text name; package_item_id
-- is the internal link to a local_inventory_items row. package_tag stays on the
-- table and is no longer written (backfill copies it into package_label).
-- Category is lookup-backed (listing_category), never a DDL enum.
-- parent_item_id on local_inventory_items is the split-child pointer.

ALTER TABLE listings ADD COLUMN package_label TEXT;
ALTER TABLE listings ADD COLUMN package_item_id TEXT;
ALTER TABLE listings ADD COLUMN category TEXT;

UPDATE listings
   SET package_label = package_tag
 WHERE package_label IS NULL AND package_tag IS NOT NULL;

ALTER TABLE local_inventory_items ADD COLUMN parent_item_id TEXT;

INSERT INTO lookup_values (
  id, category, value, label, sort_order,
  created_at, created_by, updated_at, updated_by, deleted_at, deleted_by, delete_reason
) VALUES
  ('a2000006-0001-4000-8000-000000000001', 'listing_category', 'Flower', 'Flower', 1, '2026-09-05T00:00:00.000Z', NULL, '2026-09-05T00:00:00.000Z', NULL, NULL, NULL, NULL),
  ('a2000006-0001-4000-8000-000000000002', 'listing_category', 'Smalls', 'Smalls', 2, '2026-09-05T00:00:00.000Z', NULL, '2026-09-05T00:00:00.000Z', NULL, NULL, NULL, NULL),
  ('a2000006-0001-4000-8000-000000000003', 'listing_category', 'Trim', 'Trim', 3, '2026-09-05T00:00:00.000Z', NULL, '2026-09-05T00:00:00.000Z', NULL, NULL, NULL, NULL),
  ('a2000006-0001-4000-8000-000000000004', 'listing_category', 'Fresh Frozen', 'Fresh Frozen', 4, '2026-09-05T00:00:00.000Z', NULL, '2026-09-05T00:00:00.000Z', NULL, NULL, NULL, NULL),
  ('a2000006-0001-4000-8000-000000000005', 'listing_category', 'Concentrate', 'Concentrate', 5, '2026-09-05T00:00:00.000Z', NULL, '2026-09-05T00:00:00.000Z', NULL, NULL, NULL, NULL),
  ('a2000006-0001-4000-8000-000000000006', 'listing_category', 'Other', 'Other', 6, '2026-09-05T00:00:00.000Z', NULL, '2026-09-05T00:00:00.000Z', NULL, NULL, NULL, NULL);
