-- Owner ruling 2026-08-28: add Hang in Place to the PNN Move To options.
-- farm_code scopes a dry space to one farm; NULL means shared across farms.
-- Silos and trucks stay NULL (shared); kind gating already restricts them.
ALTER TABLE dry_spaces ADD COLUMN farm_code TEXT;

UPDATE dry_spaces SET farm_code = 'ARL' WHERE name = 'Arlington Dry Room';

INSERT OR IGNORE INTO dry_spaces (
  id, name, kind, farm_code, created_at, created_by, updated_at, updated_by, deleted_at, deleted_by
) VALUES
  ('a1000001-0001-4000-8000-000000000007', 'Hang in Place', 'hang', 'PNN', '2026-08-28T00:00:00.000Z', NULL, '2026-08-28T00:00:00.000Z', NULL, NULL, NULL);
