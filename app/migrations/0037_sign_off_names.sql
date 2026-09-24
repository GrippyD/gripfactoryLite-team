-- 0037: the sign-off names (owner ruling 2026-09-08, canon 0.30.12, verbatim:
-- "Replace all the hand sign offs with the names "Kieth", "Les", or "Austin".
-- Kieth will almost always be the one managing RTUs").
--
-- Every sign-off in the app (the trim and cryo operators of 0036, the unload
-- session operator, the Preventive Maintenance PM-done, ticket-open and
-- ticket-close signatures) now picks from this list instead of a typed name;
-- the 0.29.0 hand-sign law retires. The list lives in Admin, Data Lookups,
-- People and System, Sign-off names, so the owner edits it there. Spellings
-- are his, exactly.
INSERT INTO lookup_values (
  id, category, value, label, sort_order,
  created_at, created_by, updated_at, updated_by, deleted_at, deleted_by, delete_reason
) VALUES
  ('a2000037-0001-4000-8000-000000000001', 'sign_off_name', 'Kieth', 'Kieth', 1, '2026-09-08T00:00:00.000Z', NULL, '2026-09-08T00:00:00.000Z', NULL, NULL, NULL, NULL),
  ('a2000037-0001-4000-8000-000000000002', 'sign_off_name', 'Les', 'Les', 2, '2026-09-08T00:00:00.000Z', NULL, '2026-09-08T00:00:00.000Z', NULL, NULL, NULL, NULL),
  ('a2000037-0001-4000-8000-000000000003', 'sign_off_name', 'Austin', 'Austin', 3, '2026-09-08T00:00:00.000Z', NULL, '2026-09-08T00:00:00.000Z', NULL, NULL, NULL, NULL);
