-- THE TAG LAW (canon 0.30.38). Owner, 2026-09-11, his pick on fork F4:
-- "Optional tag everywhere". Patrick's list showed the gap from three stations
-- ("Manifest CSV export uses HBN where package tag belongs."; the trim room's
-- "package code"; cryo's "new package tag and weight"): the ledger never held
-- the METRC package tag, so every METRC-facing file printed the internal code.
-- Every ledger package MAY now carry its METRC tag (1A plus 22 hex). Captured
-- at Finish lot, the arrival receive, cryo, the trim room (where the typed
-- code IS the tag, his pick on fork F5) and the reasoned pencil on any package.
-- Optional at every point; flag, never block. Files print the tag when present
-- and the internal code otherwise, and /admin/uploads marks the rows without one.
-- Backfill: trim room children whose code already reads as a tag (24
-- characters opening 1A) take it; portable SQL, so the hex check is the app's.

ALTER TABLE local_inventory_items ADD COLUMN metrc_tag TEXT;

CREATE INDEX local_inventory_items_metrc_tag ON local_inventory_items (metrc_tag);

UPDATE local_inventory_items
SET metrc_tag = UPPER(package_code)
WHERE metrc_tag IS NULL
  AND deleted_at IS NULL
  AND wip_package_id IS NOT NULL
  AND LENGTH(package_code) = 24
  AND UPPER(SUBSTR(package_code, 1, 2)) = '1A';
