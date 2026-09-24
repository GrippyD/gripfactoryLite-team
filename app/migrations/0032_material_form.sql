-- 0032: the material form rides the lot from wet weigh-in.
-- Owner ruling 2026-09-07 (canon 0.29.1, verbatim): "we're just going to move
-- the spear/buck toggle to the wet weight entry screen. Dry weight can keep
-- the 'on site' question only for Spears that aren't at North".
-- The wet weight entry screen sets it (spear the checked default, one tap);
-- the truck receive stops asking and reads the lot; the unload derives its
-- weigh mode from the lot and asks bucked-on-site only for spear material
-- away from Penn North.
ALTER TABLE wet_weight_entries ADD COLUMN material_form TEXT NOT NULL DEFAULT 'spear';

-- Backfill physics: a lot whose actual space is a silo is bucked material
-- (the silo law has always minted WIP). Everything else stays the spear
-- default, the common case on this floor.
UPDATE wet_weight_entries SET material_form = 'bucked'
 WHERE actual_dryspc IN (SELECT id FROM dry_spaces WHERE kind = 'silo');
