-- THE SILO 1 REPAIR (canon 0.30.118). Owner, 2026-09-17, verbatim: "Can you remove this lot
-- from the silo?  I think I stranded it by deleting its record in data queue" His picks:
-- void the whole trail; void the test HBN too.
--
-- What the pre snapshot (db_backups/20260917-180613_pre_silo1_26024) shows, Eastern:
-- 11:17 AM HBN 26260-PNN-OD-009-0-01-26024 minted at PNN with the tag TEST00000000000000000001 and the
-- market strain TEST; 11:18 its lot started and finished at 1 g (one tote, one plant), the born
-- package 26024 (1 g) at BARN; 11:23:45 Load Silo into Silo 1 moved the package to Silo 1; 11:24:06
-- the lot voided in Data Queues with the reason TEST, which under 0.30.115 voided the lot row alone,
-- leaving the open load holding Silo 1 and the package live on the ledger (the 0.30.116 fault, fixed
-- in code on the 7488c91d worker). Nothing else points at the lot or the HBN: no metrc_uploads row,
-- no unload session, no dry weight, no schedule, no wip package, no plant tag.
--
-- Every statement is guarded by the current value it expects, so a second run changes nothing;
-- every change lands in record_change_log under the owner's login with this repair's reason. The
-- lot's tote row (77197cfe, 1 g) stays attached to the voided lot for the record (the 0.30.91 law).
-- Run from app/ at the owner's keyboard:
--   npx wrangler d1 execute gripfactory-lite-grip-20260914 --env grip --remote --file scripts/repairs/2026-09-17_silo1_26024.sql
-- Then: node scripts/db-snapshot.mjs post_silo1_26024

-- A. The orphaned load dfc5e7c5 (Silo 1, loaded 2026-09-17T15:23:45Z, paused 21:40:04Z, never ended): voided with the reason.
UPDATE silo_loads SET deleted_at = '2026-09-18T13:00:00.000Z', deleted_by = '7b59cf6b-04b6-4742-bb1b-78a28b593fe8', delete_reason = 'repair 2026-09-17 (canon 0.30.118), the TEST HBN 26024 stranded in Silo 1: the open Silo 1 load of the voided lot is voided; the silo is free', updated_at = '2026-09-18T13:00:00.000Z', updated_by = '7b59cf6b-04b6-4742-bb1b-78a28b593fe8'
WHERE id = 'dfc5e7c5-000d-41cb-9961-0005dd92ae59' AND dry_space_id = 'a1000001-0001-4000-8000-000000000001' AND wet_weight_entry_id = 'dbad2002-2a80-4088-a3c7-5457735860dd' AND ended_at IS NULL AND deleted_at IS NULL;
INSERT INTO record_change_log (id, record_table, record_id, field, old_value, new_value, actor_person_id, reason, changed_at)
SELECT 'a8839962-99a5-b66b-b9fe-1f524d7fbf5d', 'silo_loads', 'dfc5e7c5-000d-41cb-9961-0005dd92ae59', 'deleted_at', NULL, '2026-09-18T13:00:00.000Z', '7b59cf6b-04b6-4742-bb1b-78a28b593fe8', 'repair 2026-09-17 (canon 0.30.118), the TEST HBN 26024 stranded in Silo 1: the open Silo 1 load of the voided lot is voided; the silo is free', '2026-09-18T13:00:00.000Z'
WHERE NOT EXISTS (SELECT 1 FROM record_change_log WHERE record_table = 'silo_loads' AND record_id = 'dfc5e7c5-000d-41cb-9961-0005dd92ae59' AND field = 'deleted_at' AND reason = 'repair 2026-09-17 (canon 0.30.118), the TEST HBN 26024 stranded in Silo 1: the open Silo 1 load of the voided lot is voided; the silo is free');

-- B. The born package 8906b6e0 (WIP, code 26024, 1 g, at Silo 1, license 832): voided with the reason.
UPDATE local_inventory_items SET deleted_at = '2026-09-18T13:00:00.000Z', deleted_by = '7b59cf6b-04b6-4742-bb1b-78a28b593fe8', delete_reason = 'repair 2026-09-17 (canon 0.30.118), the TEST HBN 26024 stranded in Silo 1: the 1 g born package of the voided lot leaves the ledger', updated_at = '2026-09-18T13:00:00.000Z', updated_by = '7b59cf6b-04b6-4742-bb1b-78a28b593fe8'
WHERE id = '8906b6e0-2cba-4842-91a6-e464a57838e4' AND wet_weight_entry_id = 'dbad2002-2a80-4088-a3c7-5457735860dd' AND package_code = '26024' AND qty = 1 AND location = 'Silo 1' AND deleted_at IS NULL;
INSERT INTO record_change_log (id, record_table, record_id, field, old_value, new_value, actor_person_id, reason, changed_at)
SELECT '7379344a-f0c8-2e93-9b7f-ea1d1ecaa6b4', 'local_inventory_items', '8906b6e0-2cba-4842-91a6-e464a57838e4', 'deleted_at', NULL, '2026-09-18T13:00:00.000Z', '7b59cf6b-04b6-4742-bb1b-78a28b593fe8', 'repair 2026-09-17 (canon 0.30.118), the TEST HBN 26024 stranded in Silo 1: the 1 g born package of the voided lot leaves the ledger', '2026-09-18T13:00:00.000Z'
WHERE NOT EXISTS (SELECT 1 FROM record_change_log WHERE record_table = 'local_inventory_items' AND record_id = '8906b6e0-2cba-4842-91a6-e464a57838e4' AND field = 'deleted_at' AND reason = 'repair 2026-09-17 (canon 0.30.118), the TEST HBN 26024 stranded in Silo 1: the 1 g born package of the voided lot leaves the ledger');

-- C. The test HBN 7616f928 (26260-PNN-OD-009-0-01-26024, open, no live lot): voided; harvest_batches carries no delete_reason column, the log row carries it.
UPDATE harvest_batches SET deleted_at = '2026-09-18T13:00:00.000Z', deleted_by = '7b59cf6b-04b6-4742-bb1b-78a28b593fe8', updated_at = '2026-09-18T13:00:00.000Z', updated_by = '7b59cf6b-04b6-4742-bb1b-78a28b593fe8'
WHERE id = '7616f928-7f00-4bfc-8595-a28eb119dd11' AND hbn = '26260-PNN-OD-009-0-01-26024' AND metrc_harvest_tag = 'TEST00000000000000000001' AND status = 'open' AND deleted_at IS NULL
  AND NOT EXISTS (SELECT 1 FROM wet_weight_entries WHERE harvest_batch_id = '7616f928-7f00-4bfc-8595-a28eb119dd11' AND deleted_at IS NULL);
INSERT INTO record_change_log (id, record_table, record_id, field, old_value, new_value, actor_person_id, reason, changed_at)
SELECT 'f0782c35-49fe-6b69-b6bc-8c7b4bd095a0', 'harvest_batches', '7616f928-7f00-4bfc-8595-a28eb119dd11', 'deleted_at', NULL, '2026-09-18T13:00:00.000Z', '7b59cf6b-04b6-4742-bb1b-78a28b593fe8', 'repair 2026-09-17 (canon 0.30.118), the TEST HBN 26024 stranded in Silo 1: the test HBN is voided; serial 26024 stays used', '2026-09-18T13:00:00.000Z'
WHERE NOT EXISTS (SELECT 1 FROM record_change_log WHERE record_table = 'harvest_batches' AND record_id = '7616f928-7f00-4bfc-8595-a28eb119dd11' AND field = 'deleted_at' AND reason = 'repair 2026-09-17 (canon 0.30.118), the TEST HBN 26024 stranded in Silo 1: the test HBN is voided; serial 26024 stays used');

-- D. Untouched on purpose: the voided lot dbad2002 (his void of 11:24:06 stands with its reason TEST); its tote 77197cfe (1 g)
--    and the create and finish log rows, kept for the record; every other HBN, lot, load and package on the floor.
-- End of repair. Expected effect: 3 rows updated, 3 log rows inserted; a second run: 0 and 0.
