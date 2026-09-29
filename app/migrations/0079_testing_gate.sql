-- THE TESTING GATE (canon 0.30.293). Two config rows: the package types
-- on the four panes, and the grams in one each for the types METRC counts
-- as eaches. INSERT OR IGNORE so a value already typed is left alone.

INSERT OR IGNORE INTO app_config (
  key, value, created_at, created_by, updated_at, updated_by, deleted_at, deleted_by
) VALUES
  ('gate_type_codes', 'BUD, WPR, PRE, MOB', '2026-09-29T00:00:00.000Z', NULL, '2026-09-29T00:00:00.000Z', NULL, NULL, NULL),
  ('gate_unit_grams', 'PRE=28, MOB=70', '2026-09-29T00:00:00.000Z', NULL, '2026-09-29T00:00:00.000Z', NULL, NULL, NULL);
