-- 0059: THE CRYO CATEGORIES (canon 0.30.112). Owner ruling 2026-09-17, verbatim:
-- "in cryo weight entry, add the product categories:
--
-- 1. WPR
-- 2. BUD
-- 3. SHA"
--
-- The cryo line's product category, the category the new METRC package is
-- entered under, is a value in data (canon L-4): a comma list in his order,
-- editable in Admin, Lookups, app_config. The categories are not trim package
-- types (only is_bud types reach the Cryo Queue, so the pool is bud trim); every
-- line draws from the run's pool as a whole and the pool reads in by type, out
-- by category. INSERT OR IGNORE: a row already set by hand stands.
INSERT OR IGNORE INTO app_config (
  key, value, created_at, created_by, updated_at, updated_by, deleted_at, deleted_by
) VALUES
  ('cryo_product_categories', 'WPR,BUD,SHA', '2026-09-17T00:00:00.000Z', NULL, '2026-09-17T00:00:00.000Z', NULL, NULL, NULL);
