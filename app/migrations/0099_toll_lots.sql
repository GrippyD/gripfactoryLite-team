-- 0099: TOLL LOTS (canon 0.30.431). Another company's material on Grip's floor.
-- NULL means the lot is Grip's own. This migration writes no row.

ALTER TABLE harvest_batches ADD COLUMN customer TEXT;
