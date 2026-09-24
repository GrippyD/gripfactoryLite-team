-- Barn cutover (canon 0.19.0): BARN replaces CSA as the one 832-side location.
-- Owner delegated ("Do whatever is clever and we'll adapt"); Scribe ruling
-- 2026-09-04. Schema-era data move follows the 0009/0014 precedent.
-- Location side convention (zero schema): BARN is the ONLY 832-side location;
-- every other inventory_location row is processor-side.

ALTER TABLE lookup_values ADD COLUMN delete_reason TEXT;

INSERT INTO lookup_values (
  id, category, value, label, sort_order,
  created_at, created_by, updated_at, updated_by, deleted_at, deleted_by, delete_reason
) VALUES
  (
    'a2000002-0001-4000-8000-000000000004',
    'inventory_location',
    'BARN',
    'Barn',
    0,
    '2026-09-04T00:00:00.000Z',
    NULL,
    '2026-09-04T00:00:00.000Z',
    NULL,
    NULL,
    NULL,
    NULL
  );

-- Schema-era cutover: every CSA inventory row becomes BARN.
UPDATE local_inventory_items SET location = 'BARN' WHERE location = 'CSA';

UPDATE lookup_values
SET
  deleted_at = '2026-09-04T00:00:00.000Z',
  delete_reason = 'superseded by Barn, owner delegation 2026-09-04',
  updated_at = '2026-09-04T00:00:00.000Z'
WHERE category = 'inventory_location' AND value = 'CSA' AND deleted_at IS NULL;
