-- Owner ruling 2026-09-01 (extraction pool), verbatim: "Trim and BIO only."
-- Extraction-bound = wip_packages in status created whose package_type_code is
-- in this configured list (canon L-4: values live in data), replacing the old
-- is_bud = 0 mapping that wrongly swept SMALLS and WASTE in. Code falls back to
-- TRIM,BIO when the key is missing or blank.
INSERT INTO app_config (
  key, value, created_at, created_by, updated_at, updated_by, deleted_at, deleted_by
) VALUES
  ('extraction_type_codes', 'TRIM,BIO', '2026-09-01T00:00:00.000Z', NULL, '2026-09-01T00:00:00.000Z', NULL, NULL, NULL);

-- Owner ruling 2026-09-01 (retire Kief and Mix), verbatim: "Kief and Mix are no
-- longer menu items, might as well remove them from everything." Soft-delete
-- keeps history intact; lookup-driven surfaces already filter deleted rows.
UPDATE package_types SET deleted_at = '2026-09-01T00:00:00.000Z'
WHERE code IN ('MIX', 'KIEF') AND deleted_at IS NULL;
