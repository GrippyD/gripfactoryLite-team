-- Owner ruling 2026-09-06 (canon 0.27.0): "Farms and locations within them
-- should have an admin field if they don't already." Locations gain a farm
-- assignment, Admin-editable like every lookup attribute; NULL means shared
-- (IN-TRANSIT rides the road, no farm). Farms were already Admin-editable.
-- This column is also the data rail for resolving a location's site from
-- Admin data instead of the code-side map, when the owner calls that fix.
ALTER TABLE lookup_values ADD COLUMN farm_code TEXT;

-- Seed the known geography (canon 0.23.x laws: the 832 side is Building 24,
-- the silos, and CSA; ARL BARN and PNS BARN are their sites; CSB is Building
-- 23 at Penn North; unknown spots stay processor by the standing fallback).
UPDATE lookup_values SET farm_code = 'PNN' WHERE category = 'inventory_location' AND value IN ('BARN', 'CSA', 'CSB');
UPDATE lookup_values SET farm_code = 'ARL' WHERE category = 'inventory_location' AND value = 'ARL BARN';
UPDATE lookup_values SET farm_code = 'PNS' WHERE category = 'inventory_location' AND value = 'PNS BARN';
