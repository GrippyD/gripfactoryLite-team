-- 0044: THE FIRST LOT TOKEN (canon 0.30.55). Owner ruling 2026-09-14, verbatim:
-- "Set things up so that the first number added today ends in 26010 (we're on
-- the tenth lot this year, we just haven't inputted the historical data yet".
-- A value in data (canon L-4): the first YY### lot token the mint may issue for
-- that year. The mint takes the higher of the ledger's next serial and this
-- floor; other years are untouched; the historical lots enter through Admin's
-- Manual HBN with their own serials. Editable in Admin, Lookups, app_config.
INSERT OR IGNORE INTO app_config (
  key, value, created_at, created_by, updated_at, updated_by, deleted_at, deleted_by
) VALUES
  ('first_lot_token', '26010', '2026-09-14T00:00:00.000Z', NULL, '2026-09-14T00:00:00.000Z', NULL, NULL, NULL);
