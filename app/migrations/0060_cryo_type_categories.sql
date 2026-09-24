-- 0060: THE CRYO POOL BY TYPE (canon 0.30.119). Owner ruling 2026-09-18, verbatim:
-- "in Cryo weight entry, the total shows "BUD" which is technically true, but
-- this is where the trim packages matter a tiny bit.  I need the totals on the
-- top of the page to be reflective of the package types therein.
--
-- So lot ending 011 contains x amount of bud, y amount of wpr, and z amount of
-- shake.  I need those totals broken down on screen as well and the "bud" total
-- changed to just "total"."
--
-- His picks: the existing SMALLS and SHAKE containers move to the Cryo Queue
-- only (the HBN shows on Available again for a >>); the In side names the
-- category with the trim type beside it.
--
-- 1. The trim package types that go to cryo and the product category each
--    reads as at Cryo Weight Entry, a value in data (canon L-4) editable in
--    Admin, Lookups, app_config: type=category pairs, comma separated, in his
--    order. His words: "WPR means SMALLS" (0.30.88) and SHA is SHAKE. TRIM and
--    BIO stay the extraction pool (extraction_type_codes, "Trim and BIO only");
--    WASTE stays out. This list replaces the is_bud flag as the routing law; the
--    flag stays a lookup column. INSERT OR IGNORE: a row set by hand stands.
INSERT OR IGNORE INTO app_config (
  key, value, created_at, created_by, updated_at, updated_by, deleted_at, deleted_by
) VALUES
  ('cryo_type_categories', 'BUD=BUD,SMALLS=WPR,SHAKE=SHA', '2026-09-18T00:00:00.000Z', NULL, '2026-09-18T00:00:00.000Z', NULL, NULL, NULL);

-- 2. The SMALLS and SHAKE trim containers already entered sit in status
--    created, in no queue (the extraction pool is TRIM and BIO alone). They move
--    to the Cryo Queue as free containers; a live run's inputs are untouched
--    (his pick), so an HBN with a scheduled run shows on Available again with
--    them for another >>. Only trim containers (source NULL or 'trim') move.
UPDATE wip_packages
SET status = 'cryo_queue', updated_at = '2026-09-18T00:00:00.000Z'
WHERE deleted_at IS NULL
  AND status = 'created'
  AND package_type_code IN ('SMALLS', 'SHAKE')
  AND (source IS NULL OR source = 'trim');
