-- 0049: THE HARVEST CONSOLE (canon 0.30.73). Owner ruling 2026-09-15, verbatim
-- (the Drying section): "our silos animation, a 3d wire rectangular one called
-- "Arlington dry room" go ahead and add this as another "silo" as well (cap is
-- 15000 wet lbs, same as silos), we're going to need to cross this bridge soon
-- anyways, and add our FFZ inventory in a blue wire cube, capacity in there is
-- 4800 lbs (deeper blue slower throbbing to white for "fullness") (no timer)."
-- His pick (AskUserQuestion, 2026-09-15): "Make it a real silo now".
--
-- 1. Every silo carries its drawn shape (a value in data, canon L-4): the five
--    cylinders keep the cone-topped cylinder; the Arlington Dry Room becomes a
--    silo drawn as the 3D wire box. The five PNN silos take the farm they sit
--    at (SITE_OF_LOCATION already says PNN), so ARL's Move To, which gains kind
--    silo in code, offers ARL its own room and never PNN's silos.
ALTER TABLE dry_spaces ADD COLUMN shape TEXT;

UPDATE dry_spaces SET shape = 'cylinder' WHERE kind = 'silo' AND shape IS NULL;

UPDATE dry_spaces SET farm_code = 'PNN', updated_at = '2026-09-15T00:00:00.000Z'
 WHERE kind = 'silo' AND farm_code IS NULL AND name LIKE 'Silo %';

UPDATE dry_spaces SET kind = 'silo', shape = 'box', updated_at = '2026-09-15T00:00:00.000Z'
 WHERE name = 'Arlington Dry Room' AND deleted_at IS NULL;

-- 2. The FFZ (fresh frozen) cube's capacity, pounds, a value in data (canon
--    L-4), editable in Admin, Lookups, app_config. The silos' own capacity stays
--    silo_capacity_wet_lbs (0048): "cap is 15000 wet lbs, same as silos".
INSERT OR IGNORE INTO app_config (
  key, value, created_at, created_by, updated_at, updated_by, deleted_at, deleted_by
) VALUES
  ('ffz_capacity_lbs', '4800', '2026-09-15T00:00:00.000Z', NULL, '2026-09-15T00:00:00.000Z', NULL, NULL, NULL);

-- 3. "Cutting and Bucking Hours Yesterday [open numbox]": the hours typed on the
--    console, one number per farm per work day, so Weight/DLH Yesterday divides
--    by a number everyone sees. A retype overwrites the day's number and the
--    change lands in record_change_log (record_table harvest_labor_hours).
CREATE TABLE harvest_labor_hours (
  id TEXT PRIMARY KEY,
  farm_code TEXT NOT NULL,
  work_date TEXT NOT NULL,
  hours NUMERIC NOT NULL,
  created_at TEXT NOT NULL,
  created_by TEXT,
  updated_at TEXT NOT NULL,
  updated_by TEXT,
  UNIQUE (farm_code, work_date)
);

CREATE INDEX harvest_labor_hours_date ON harvest_labor_hours (work_date);
