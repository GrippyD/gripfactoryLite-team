-- Patrick's feedback relayed by the owner, 2026-09-11 (canon 0.30.37), verbatim:
-- "Shake is not an option in the drop-down menu in the trim room ." SHAKE joins
-- the standing package types beside BUD, SMALLS, TRIM, BIO and WASTE (MIX and
-- KIEF retired by 0014). Not bud, so it queues like SMALLS. It is NOT added to
-- the extraction pool (owner 2026-09-01: "Trim and BIO only."); the
-- extraction_type_codes value in Admin is one edit away if he wants it there.
-- INSERT OR IGNORE: a SHAKE row already added by hand in Admin lookups stands.

INSERT OR IGNORE INTO package_types (
  code, display_name, is_bud, created_at, created_by, updated_at, updated_by, deleted_at, deleted_by
) VALUES
  ('SHAKE', 'SHAKE', 0, '2026-09-11T00:00:00.000Z', NULL, '2026-09-11T00:00:00.000Z', NULL, NULL, NULL);
