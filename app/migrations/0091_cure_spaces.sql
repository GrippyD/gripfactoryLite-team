-- 0091: BRIEF V7, DRYING (canon 0.30.383).
-- Cure joins the dry space types. CSA and CSB become dry_spaces of kind cure,
-- so a query that reads kind silo does not pick them up. Capacity is the
-- current app_config cap (36 and 8 when the keys are absent). Idempotent on
-- the UNIQUE name: a second run inserts nothing. No lot, package, reading
-- or log row is touched.
INSERT INTO dry_spaces (
  id, name, kind, farm_code, shape, space_type, capacity, capacity_uom, location_name,
  created_at, created_by, updated_at, updated_by, deleted_at, deleted_by
)
SELECT
  'c1000001-0000-4000-8000-0000000000c1',
  'CSA',
  'cure',
  'PNN',
  'bar',
  'cure',
  CAST(COALESCE((SELECT value FROM app_config WHERE key = 'csa_lot_cap' AND deleted_at IS NULL), '36') AS NUMERIC),
  'ea',
  'Cold Storage A',
  '2026-10-03T00:00:00.000Z',
  NULL,
  '2026-10-03T00:00:00.000Z',
  NULL,
  NULL,
  NULL
WHERE NOT EXISTS (SELECT 1 FROM dry_spaces WHERE name = 'CSA');

INSERT INTO dry_spaces (
  id, name, kind, farm_code, shape, space_type, capacity, capacity_uom, location_name,
  created_at, created_by, updated_at, updated_by, deleted_at, deleted_by
)
SELECT
  'c1000001-0000-4000-8000-0000000000c2',
  'CSB',
  'cure',
  'PNN',
  'bar',
  'cure',
  CAST(COALESCE((SELECT value FROM app_config WHERE key = 'csb_lot_cap' AND deleted_at IS NULL), '8') AS NUMERIC),
  'ea',
  'Cold Storage B',
  '2026-10-03T00:00:00.000Z',
  NULL,
  '2026-10-03T00:00:00.000Z',
  NULL,
  NULL,
  NULL
WHERE NOT EXISTS (SELECT 1 FROM dry_spaces WHERE name = 'CSB');
