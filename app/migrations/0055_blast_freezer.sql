-- 0055: THE BLAST FREEZER (canon 0.30.98). Owner ruling 2026-09-16, verbatim:
-- "add the Blast Freezer to the dry operations page and allow us to use it like
-- a "silo"".
--
-- A silo is data (canon 0.30.73: a shape is data and a bridge is a law): a
-- dry_spaces row of kind silo appears on the drying strip, in Load Silo's select
-- for lots waiting in its site's barn, in that site's wet weight Move To and at
-- Unload, and runs the silo clock, with no code change. The Blast Freezer is
-- seeded at Penn North beside the five silos (Scribe assumption, his word owed
-- if it stands elsewhere), drawn as the 3D wire box like the Arlington Dry Room
-- (0049). Its fill scales to silo_capacity_wet_lbs like every silo; a per-space
-- capacity is a later row if he wants one. Idempotent on the UNIQUE name.
INSERT OR IGNORE INTO dry_spaces (
  id, name, kind, farm_code, shape, created_at, created_by, updated_at, updated_by, deleted_at, deleted_by
) VALUES (
  'a1000001-0000-4000-8000-0000000000bf', 'Blast Freezer', 'silo', 'PNN', 'box',
  '2026-09-16T00:00:00.000Z', NULL, '2026-09-16T00:00:00.000Z', NULL, NULL, NULL
);
