-- Owner ruling 2026-08-27: the wet weight pair. Bucked wet weight stays required
-- (existing weight_grams column, unchanged). Wet spear weight is captured when it
-- exists, so the column is optional and NULL when there was no spearing.
ALTER TABLE wet_weight_entries ADD COLUMN wet_spear_weight_grams NUMERIC;
