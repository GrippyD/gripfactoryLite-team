-- 0057: THE BLAST FREEZER(S) AND THE DRY SPACE TYPE (canon 0.30.106). Owner
-- rulings 2026-09-16, verbatim:
--   "Change "Blast Freezer" to "Blast Freezer(s)".  Merge the blast freezer
--   formatting to the FFZ inventory one.  Expose FFZ inventory on the dry ops
--   pages.  Unload Dry Space/Blast Freezer just removes the line, since the
--   packages are already denoted as "FFZ" in METRC, the inventory lines are
--   identical and moving the BF inventory to the FFZ inventory would just
--   duplicate it.  Change blast freezer capacity to 800lbs.  Change status
--   "Drying" to "Chilling Out""
-- and
--   "Admin lookups: Dry spaces: 1. Name 2. Capacity 3. Capacity UOM (ea, lb,
--   g, sqft) 4. Freezer, Dry Room, or Silo? <<<<<<Toggle that decides the
--   formatting and the shape (freezers = blue with white fade to at slower
--   intervals and cubic, rectangular cuboid with silo coloring and animations,
--   silo is obviously the silos shapes and colors)"
--
-- Values in data (canon L-4): a dry space carries its type (silo, dry_room or
-- freezer; the type decides the shape and the formatting), its capacity with
-- the capacity's unit (ea, lb, g or sqft; a weight unit scales the fill, blank
-- falls back to silo_capacity_wet_lbs), and the METRC location its loads sit at
-- when that differs from its name (the Blast Freezer(s) tile over the METRC
-- location Blast Freezer, which the FFZ cube counts). His picks: the tile alone
-- is renamed, the location keeps METRC's word. Postgres-portable; append-only
-- after 0056.
ALTER TABLE dry_spaces ADD COLUMN space_type TEXT NOT NULL DEFAULT 'silo';
ALTER TABLE dry_spaces ADD COLUMN capacity NUMERIC;
ALTER TABLE dry_spaces ADD COLUMN capacity_uom TEXT;
ALTER TABLE dry_spaces ADD COLUMN location_name TEXT;

-- The wire boxes drawn since 0049 are dry rooms; so are the hang rooms.
UPDATE dry_spaces SET space_type = 'dry_room', updated_at = '2026-09-16T00:00:00.000Z'
 WHERE (shape = 'box' OR kind = 'hang') AND deleted_at IS NULL;

-- The five silos and the Arlington Dry Room hold 15,000 lb wet (canon 0.30.69,
-- 0.30.73), now written on each space.
UPDATE dry_spaces SET capacity = 15000, capacity_uom = 'lb', updated_at = '2026-09-16T00:00:00.000Z'
 WHERE kind = 'silo' AND capacity IS NULL AND deleted_at IS NULL;

-- The Blast Freezer(s): a freezer of 800 lb, drawn as the cube, standing over
-- the METRC location Blast Freezer.
UPDATE dry_spaces
   SET name = 'Blast Freezer(s)', space_type = 'freezer', shape = 'cube', capacity = 800, capacity_uom = 'lb',
       location_name = 'Blast Freezer', updated_at = '2026-09-16T00:00:00.000Z'
 WHERE id = 'a1000001-0000-4000-8000-0000000000bf';
