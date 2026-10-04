-- 0092: L1 THE LABEL EDITOR (canon 0.30.386).
-- The objects and their properties live in layout_json (versioned, v: 1).
-- Length is across and width is down, in inches. width_mm and height_mm
-- stay, written from the inches, so a reader of the old columns still runs.
-- Existing rows gain the three columns empty.

ALTER TABLE label_templates ADD COLUMN layout_json TEXT;
ALTER TABLE label_templates ADD COLUMN length_in NUMERIC;
ALTER TABLE label_templates ADD COLUMN width_in NUMERIC;
