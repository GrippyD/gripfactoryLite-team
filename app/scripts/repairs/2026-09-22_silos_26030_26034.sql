-- THE HARVEST SHEET AS THE RECORD, LOTS 26030 TO 26035 (canon 0.30.180). Owner, 2026-09-22, verbatim (his
-- words run to the line that says so): Employ another agent to help me do some Lot maintenance the picture
-- shows what's currently going on in the system. Some wires got crossed and the reality is what the
-- spreadsheet shows. Can you help me correct the ship? They can all be in a loading state at the end, I'll
-- check the time board and load them when the weights and lot numbers are correct
-- (his words end there). His spreadsheet, the record (HBN, grams, Silo):
--   26264-ARL-OD-009-0-NA-26030   6843405.52 g   Silo 1
--   26264-ARL-OD-009-0-02-26031   7140894.36 g   Silo 2
--   26264-ARL-OD-009-0-NA-26032   7062662.91 g   Silo 3
--   26264-ARL-OD-009-0-03-26033   7219875.21 g   Silo 4
--   26264-ARL-OD-009-0-04-26034   5308488.23 g   Silo 5
-- Lot 26035 is not on the sheet. His picks on the question tool (2026-09-22): Void it (26035 is the crossed
-- wire; its lot, born package and HBN are voided with the reason; serial 26035 stays used, like 26024 before
-- it; 26034 moves to Silo 5 at the sheet's 5,308,488 g). Header only (26034's weight_grams and born package go
-- to 5,308,488 g; the tote rows are left as weighed and no longer sum to the header; the change-log row
-- explains). Leave them on the voided 26035 (his 1,016 plant tags stay attached to the voided HBN). Grams are
-- stored whole, rounded half up (the app's law: one pound is 448 g, grams that enter through an action are
-- whole numbers): 6843406, 7140894, 7062663, 7219875, 5308488.
--
-- What the pre snapshot (db_backups/20260921-234510_pre_lots_27_35, dumped 2026-09-22T03:45:12Z) shows. Six
-- ARL HBNs minted 2026-09-21 (times UTC), each with one finished lot (status drying, bucked, live), a WIP born
-- package at BARN (license 832) and NO silo_loads row, so the silo strip shows each as loading on the silo its
-- actual_dryspc names. Silo ids: a1000001-0001-4000-8000-00000000000N is Silo N (PNN, kind silo, live).
--   26030  HBN 4905db39 (planned NA, minted 10:10Z); lot b79adf08 5,416,395 g on Silo 1, 732 totes 10:36Z to
--          11:42Z, finished 11:44Z; package 7fea6b0b 5,416,395 g; wet weights file uploaded 13:29Z (320d9a8f).
--   26031  HBN 37af7154 (planned 2, minted 11:45Z); lot 4bd56a7d 5,711,383 g on Silo 2, 731 totes 11:45Z to
--          15:19Z, finished 15:22Z; package 9242f605 5,711,383 g; uploaded 15:39Z (5663a89f); an unfinished
--          unload session 926fa4a9 (opened 15:45Z) points at the lot.
--   26032  HBN 2d7ace18 (planned empty, minted 11:47Z); lot 6375fee0 5,812,835 g on Silo 2 (the crossed wire:
--          two lots on Silo 2), 760 live totes 20:45Z to 22:37Z (one voided, 7,453 g), finished 22:38Z; package
--          ebf6ecd1 5,812,835 g; no upload row.
--   26033  HBN 20576a39 (planned 3, minted 15:23Z); lot 0cd2e062 5,697,785 g on Silo 3, 740 totes 15:24Z to
--          17:35Z, finished 17:37Z; package 9f32f7fd 5,697,785 g; uploaded 19:54Z (603fde28).
--   26034  HBN 820d81bc (planned 4, minted 17:39Z); lot 2f9a1075 5,628,440 g on Silo 4, 740 totes 17:51Z to
--          20:44Z, finished 20:44Z; package dc34b1d7 5,628,440 g; no upload row.
--   26035  HBN c455af1a (planned 5, minted 22:39Z); lot 152e4fdc 5,313,405 g on Silo 5, 748 totes 22:40Z to
--          2026-09-22T00:18Z, finished 00:20Z; package 7a527493 5,313,405 g at BARN; 1,016 live plant tags; no
--          upload row, no unload session, no silo load.
-- The sheet's grams against the app's: 26030 up 1,427,011; 26031 up 1,429,511; 26032 up 1,249,828; 26033 up
-- 1,522,090; 26034 down 319,952 (header only). Each upward lot takes one correction tote (a wet_weights row of
-- the difference) so its totes sum to its header again, the 0.30.91 pattern.
--
-- Every statement is guarded by the current value it expects, so a second run changes nothing; every change
-- lands in record_change_log under the owner's login with this repair's reason. Setting the lots' updated_at to
-- the stamp re-pends the METRC wet weights files of 26030, 26031 and 26033 in Pending Data Uploads by the app's
-- own pending law (their metrc_uploads rows are not touched); that is wanted, the files carry the corrected
-- grams. Run from app/ at the owner's keyboard:
--   node scripts/repair-apply.mjs scripts/repairs/2026-09-22_silos_26030_26034.sql
-- Then: node scripts/db-snapshot.mjs post_lots_27_35

-- A. Lot 26030 (26264-ARL-OD-009-0-NA-26030): 5,416,395 g to 6,843,406 g, one correction tote of 1,427,011 g;
--    stays on Silo 1; the HBN's planned silo NA to 1 so it agrees with the sheet.
INSERT INTO wet_weights (id, wet_weight_entry_id, weight_grams, created_at, created_by, updated_at, updated_by, deleted_at, deleted_by)
SELECT '3b997325-3a12-64d3-22b0-0c92dcf8bf62', 'b79adf08-6141-4ac0-bbbb-d483123dd7bf', 1427011, '2026-09-22T04:30:00.000Z', '7b59cf6b-04b6-4742-bb1b-78a28b593fe8', '2026-09-22T04:30:00.000Z', '7b59cf6b-04b6-4742-bb1b-78a28b593fe8', NULL, NULL
WHERE EXISTS (SELECT 1 FROM wet_weight_entries WHERE id = 'b79adf08-6141-4ac0-bbbb-d483123dd7bf' AND weight_grams = 5416395 AND deleted_at IS NULL)
  AND NOT EXISTS (SELECT 1 FROM wet_weights WHERE id = '3b997325-3a12-64d3-22b0-0c92dcf8bf62');
INSERT INTO record_change_log (id, record_table, record_id, field, old_value, new_value, actor_person_id, reason, changed_at)
SELECT '285f16f3-f517-2b08-f73a-5fc5d1f43ef3', 'wet_weights', '3b997325-3a12-64d3-22b0-0c92dcf8bf62', 'weight_grams', NULL, '1427011', '7b59cf6b-04b6-4742-bb1b-78a28b593fe8', 'repair 2026-09-22 (canon 0.30.180), the harvest sheet as the record for lots 26030 to 26035: lot 26030 wet weight to 6,843,406 g (one correction tote of 1,427,011 g), Silo 1', '2026-09-22T04:30:00.000Z'
WHERE NOT EXISTS (SELECT 1 FROM record_change_log WHERE record_table = 'wet_weights' AND record_id = '3b997325-3a12-64d3-22b0-0c92dcf8bf62' AND field = 'weight_grams' AND reason = 'repair 2026-09-22 (canon 0.30.180), the harvest sheet as the record for lots 26030 to 26035: lot 26030 wet weight to 6,843,406 g (one correction tote of 1,427,011 g), Silo 1');
UPDATE wet_weight_entries SET weight_grams = 6843406, updated_at = '2026-09-22T04:30:00.000Z', updated_by = '7b59cf6b-04b6-4742-bb1b-78a28b593fe8'
WHERE id = 'b79adf08-6141-4ac0-bbbb-d483123dd7bf' AND weight_grams = 5416395 AND deleted_at IS NULL;
INSERT INTO record_change_log (id, record_table, record_id, field, old_value, new_value, actor_person_id, reason, changed_at)
SELECT '4aaf9ada-c566-1e3c-999e-42634e6476ef', 'wet_weight_entries', 'b79adf08-6141-4ac0-bbbb-d483123dd7bf', 'weight_grams', '5416395', '6843406', '7b59cf6b-04b6-4742-bb1b-78a28b593fe8', 'repair 2026-09-22 (canon 0.30.180), the harvest sheet as the record for lots 26030 to 26035: lot 26030 wet weight to 6,843,406 g (one correction tote of 1,427,011 g), Silo 1', '2026-09-22T04:30:00.000Z'
WHERE NOT EXISTS (SELECT 1 FROM record_change_log WHERE record_table = 'wet_weight_entries' AND record_id = 'b79adf08-6141-4ac0-bbbb-d483123dd7bf' AND field = 'weight_grams' AND reason = 'repair 2026-09-22 (canon 0.30.180), the harvest sheet as the record for lots 26030 to 26035: lot 26030 wet weight to 6,843,406 g (one correction tote of 1,427,011 g), Silo 1');
UPDATE local_inventory_items SET qty = 6843406, updated_at = '2026-09-22T04:30:00.000Z', updated_by = '7b59cf6b-04b6-4742-bb1b-78a28b593fe8'
WHERE id = '7fea6b0b-8ec0-41db-a04f-cf9bef9f7bd0' AND qty = 5416395 AND deleted_at IS NULL;
INSERT INTO record_change_log (id, record_table, record_id, field, old_value, new_value, actor_person_id, reason, changed_at)
SELECT '54e28bab-178e-3d1d-c423-57cf7f490c8c', 'local_inventory_items', '7fea6b0b-8ec0-41db-a04f-cf9bef9f7bd0', 'qty', '5416395', '6843406', '7b59cf6b-04b6-4742-bb1b-78a28b593fe8', 'repair 2026-09-22 (canon 0.30.180), the harvest sheet as the record for lots 26030 to 26035: lot 26030 wet weight to 6,843,406 g (one correction tote of 1,427,011 g), Silo 1', '2026-09-22T04:30:00.000Z'
WHERE NOT EXISTS (SELECT 1 FROM record_change_log WHERE record_table = 'local_inventory_items' AND record_id = '7fea6b0b-8ec0-41db-a04f-cf9bef9f7bd0' AND field = 'qty' AND reason = 'repair 2026-09-22 (canon 0.30.180), the harvest sheet as the record for lots 26030 to 26035: lot 26030 wet weight to 6,843,406 g (one correction tote of 1,427,011 g), Silo 1');
UPDATE harvest_batches SET planned_dryspc = '1', updated_at = '2026-09-22T04:30:00.000Z', updated_by = '7b59cf6b-04b6-4742-bb1b-78a28b593fe8'
WHERE id = '4905db39-60c8-4338-bd2f-26704897d759' AND planned_dryspc = 'NA' AND deleted_at IS NULL;
INSERT INTO record_change_log (id, record_table, record_id, field, old_value, new_value, actor_person_id, reason, changed_at)
SELECT 'efa21773-7d52-3b6f-dc1a-b54c11127ed8', 'harvest_batches', '4905db39-60c8-4338-bd2f-26704897d759', 'planned_dryspc', 'NA', '1', '7b59cf6b-04b6-4742-bb1b-78a28b593fe8', 'repair 2026-09-22 (canon 0.30.180), the harvest sheet as the record for lots 26030 to 26035: lot 26030 planned silo NA to 1, the sheet''s Silo 1', '2026-09-22T04:30:00.000Z'
WHERE NOT EXISTS (SELECT 1 FROM record_change_log WHERE record_table = 'harvest_batches' AND record_id = '4905db39-60c8-4338-bd2f-26704897d759' AND field = 'planned_dryspc' AND reason = 'repair 2026-09-22 (canon 0.30.180), the harvest sheet as the record for lots 26030 to 26035: lot 26030 planned silo NA to 1, the sheet''s Silo 1');

-- B. Lot 26031 (26264-ARL-OD-009-0-02-26031): 5,711,383 g to 7,140,894 g, one correction tote of 1,429,511 g;
--    stays on Silo 2; the HBN's planned silo 2 already agrees with the sheet, no change.
INSERT INTO wet_weights (id, wet_weight_entry_id, weight_grams, created_at, created_by, updated_at, updated_by, deleted_at, deleted_by)
SELECT '32e18836-2af8-65f8-c5d8-194cd06ac5b5', '4bd56a7d-df23-4bc6-9ffe-c0cb9f977a53', 1429511, '2026-09-22T04:30:00.000Z', '7b59cf6b-04b6-4742-bb1b-78a28b593fe8', '2026-09-22T04:30:00.000Z', '7b59cf6b-04b6-4742-bb1b-78a28b593fe8', NULL, NULL
WHERE EXISTS (SELECT 1 FROM wet_weight_entries WHERE id = '4bd56a7d-df23-4bc6-9ffe-c0cb9f977a53' AND weight_grams = 5711383 AND deleted_at IS NULL)
  AND NOT EXISTS (SELECT 1 FROM wet_weights WHERE id = '32e18836-2af8-65f8-c5d8-194cd06ac5b5');
INSERT INTO record_change_log (id, record_table, record_id, field, old_value, new_value, actor_person_id, reason, changed_at)
SELECT 'ce2f10b1-285e-754b-0051-8741634517d0', 'wet_weights', '32e18836-2af8-65f8-c5d8-194cd06ac5b5', 'weight_grams', NULL, '1429511', '7b59cf6b-04b6-4742-bb1b-78a28b593fe8', 'repair 2026-09-22 (canon 0.30.180), the harvest sheet as the record for lots 26030 to 26035: lot 26031 wet weight to 7,140,894 g (one correction tote of 1,429,511 g), Silo 2', '2026-09-22T04:30:00.000Z'
WHERE NOT EXISTS (SELECT 1 FROM record_change_log WHERE record_table = 'wet_weights' AND record_id = '32e18836-2af8-65f8-c5d8-194cd06ac5b5' AND field = 'weight_grams' AND reason = 'repair 2026-09-22 (canon 0.30.180), the harvest sheet as the record for lots 26030 to 26035: lot 26031 wet weight to 7,140,894 g (one correction tote of 1,429,511 g), Silo 2');
UPDATE wet_weight_entries SET weight_grams = 7140894, updated_at = '2026-09-22T04:30:00.000Z', updated_by = '7b59cf6b-04b6-4742-bb1b-78a28b593fe8'
WHERE id = '4bd56a7d-df23-4bc6-9ffe-c0cb9f977a53' AND weight_grams = 5711383 AND deleted_at IS NULL;
INSERT INTO record_change_log (id, record_table, record_id, field, old_value, new_value, actor_person_id, reason, changed_at)
SELECT '7fdffa6d-a29a-02c0-11f5-c3f15eef82a6', 'wet_weight_entries', '4bd56a7d-df23-4bc6-9ffe-c0cb9f977a53', 'weight_grams', '5711383', '7140894', '7b59cf6b-04b6-4742-bb1b-78a28b593fe8', 'repair 2026-09-22 (canon 0.30.180), the harvest sheet as the record for lots 26030 to 26035: lot 26031 wet weight to 7,140,894 g (one correction tote of 1,429,511 g), Silo 2', '2026-09-22T04:30:00.000Z'
WHERE NOT EXISTS (SELECT 1 FROM record_change_log WHERE record_table = 'wet_weight_entries' AND record_id = '4bd56a7d-df23-4bc6-9ffe-c0cb9f977a53' AND field = 'weight_grams' AND reason = 'repair 2026-09-22 (canon 0.30.180), the harvest sheet as the record for lots 26030 to 26035: lot 26031 wet weight to 7,140,894 g (one correction tote of 1,429,511 g), Silo 2');
UPDATE local_inventory_items SET qty = 7140894, updated_at = '2026-09-22T04:30:00.000Z', updated_by = '7b59cf6b-04b6-4742-bb1b-78a28b593fe8'
WHERE id = '9242f605-7a1a-4767-878a-69a487426929' AND qty = 5711383 AND deleted_at IS NULL;
INSERT INTO record_change_log (id, record_table, record_id, field, old_value, new_value, actor_person_id, reason, changed_at)
SELECT '3221ba2c-9919-3477-e1af-01469699bbcb', 'local_inventory_items', '9242f605-7a1a-4767-878a-69a487426929', 'qty', '5711383', '7140894', '7b59cf6b-04b6-4742-bb1b-78a28b593fe8', 'repair 2026-09-22 (canon 0.30.180), the harvest sheet as the record for lots 26030 to 26035: lot 26031 wet weight to 7,140,894 g (one correction tote of 1,429,511 g), Silo 2', '2026-09-22T04:30:00.000Z'
WHERE NOT EXISTS (SELECT 1 FROM record_change_log WHERE record_table = 'local_inventory_items' AND record_id = '9242f605-7a1a-4767-878a-69a487426929' AND field = 'qty' AND reason = 'repair 2026-09-22 (canon 0.30.180), the harvest sheet as the record for lots 26030 to 26035: lot 26031 wet weight to 7,140,894 g (one correction tote of 1,429,511 g), Silo 2');

-- C. Lot 26032 (26264-ARL-OD-009-0-NA-26032): 5,812,835 g to 7,062,663 g, one correction tote of 1,249,828 g;
--    Silo 2 to Silo 3 (the crossed wire, two lots stood on Silo 2); the HBN's planned silo empty to 3.
INSERT INTO wet_weights (id, wet_weight_entry_id, weight_grams, created_at, created_by, updated_at, updated_by, deleted_at, deleted_by)
SELECT '11f68c08-beeb-ba0c-bce8-b34026783d12', '6375fee0-3386-4975-a1ee-8654c30eed1c', 1249828, '2026-09-22T04:30:00.000Z', '7b59cf6b-04b6-4742-bb1b-78a28b593fe8', '2026-09-22T04:30:00.000Z', '7b59cf6b-04b6-4742-bb1b-78a28b593fe8', NULL, NULL
WHERE EXISTS (SELECT 1 FROM wet_weight_entries WHERE id = '6375fee0-3386-4975-a1ee-8654c30eed1c' AND weight_grams = 5812835 AND deleted_at IS NULL)
  AND NOT EXISTS (SELECT 1 FROM wet_weights WHERE id = '11f68c08-beeb-ba0c-bce8-b34026783d12');
INSERT INTO record_change_log (id, record_table, record_id, field, old_value, new_value, actor_person_id, reason, changed_at)
SELECT '8e35a1b6-a8a6-e724-6754-cb2e607991f3', 'wet_weights', '11f68c08-beeb-ba0c-bce8-b34026783d12', 'weight_grams', NULL, '1249828', '7b59cf6b-04b6-4742-bb1b-78a28b593fe8', 'repair 2026-09-22 (canon 0.30.180), the harvest sheet as the record for lots 26030 to 26035: lot 26032 wet weight to 7,062,663 g (one correction tote of 1,249,828 g)', '2026-09-22T04:30:00.000Z'
WHERE NOT EXISTS (SELECT 1 FROM record_change_log WHERE record_table = 'wet_weights' AND record_id = '11f68c08-beeb-ba0c-bce8-b34026783d12' AND field = 'weight_grams' AND reason = 'repair 2026-09-22 (canon 0.30.180), the harvest sheet as the record for lots 26030 to 26035: lot 26032 wet weight to 7,062,663 g (one correction tote of 1,249,828 g)');
UPDATE wet_weight_entries SET weight_grams = 7062663, updated_at = '2026-09-22T04:30:00.000Z', updated_by = '7b59cf6b-04b6-4742-bb1b-78a28b593fe8'
WHERE id = '6375fee0-3386-4975-a1ee-8654c30eed1c' AND weight_grams = 5812835 AND deleted_at IS NULL;
INSERT INTO record_change_log (id, record_table, record_id, field, old_value, new_value, actor_person_id, reason, changed_at)
SELECT '45812360-a20f-6a05-f4a5-05dfe622b1e6', 'wet_weight_entries', '6375fee0-3386-4975-a1ee-8654c30eed1c', 'weight_grams', '5812835', '7062663', '7b59cf6b-04b6-4742-bb1b-78a28b593fe8', 'repair 2026-09-22 (canon 0.30.180), the harvest sheet as the record for lots 26030 to 26035: lot 26032 wet weight to 7,062,663 g (one correction tote of 1,249,828 g)', '2026-09-22T04:30:00.000Z'
WHERE NOT EXISTS (SELECT 1 FROM record_change_log WHERE record_table = 'wet_weight_entries' AND record_id = '6375fee0-3386-4975-a1ee-8654c30eed1c' AND field = 'weight_grams' AND reason = 'repair 2026-09-22 (canon 0.30.180), the harvest sheet as the record for lots 26030 to 26035: lot 26032 wet weight to 7,062,663 g (one correction tote of 1,249,828 g)');
UPDATE local_inventory_items SET qty = 7062663, updated_at = '2026-09-22T04:30:00.000Z', updated_by = '7b59cf6b-04b6-4742-bb1b-78a28b593fe8'
WHERE id = 'ebf6ecd1-c1cc-4f25-af33-74d4d97e58bf' AND qty = 5812835 AND deleted_at IS NULL;
INSERT INTO record_change_log (id, record_table, record_id, field, old_value, new_value, actor_person_id, reason, changed_at)
SELECT '07422f52-55e1-24b0-4993-556b6aacd256', 'local_inventory_items', 'ebf6ecd1-c1cc-4f25-af33-74d4d97e58bf', 'qty', '5812835', '7062663', '7b59cf6b-04b6-4742-bb1b-78a28b593fe8', 'repair 2026-09-22 (canon 0.30.180), the harvest sheet as the record for lots 26030 to 26035: lot 26032 wet weight to 7,062,663 g (one correction tote of 1,249,828 g)', '2026-09-22T04:30:00.000Z'
WHERE NOT EXISTS (SELECT 1 FROM record_change_log WHERE record_table = 'local_inventory_items' AND record_id = 'ebf6ecd1-c1cc-4f25-af33-74d4d97e58bf' AND field = 'qty' AND reason = 'repair 2026-09-22 (canon 0.30.180), the harvest sheet as the record for lots 26030 to 26035: lot 26032 wet weight to 7,062,663 g (one correction tote of 1,249,828 g)');
UPDATE wet_weight_entries SET actual_dryspc = 'a1000001-0001-4000-8000-000000000003', updated_at = '2026-09-22T04:30:00.000Z', updated_by = '7b59cf6b-04b6-4742-bb1b-78a28b593fe8'
WHERE id = '6375fee0-3386-4975-a1ee-8654c30eed1c' AND actual_dryspc = 'a1000001-0001-4000-8000-000000000002' AND deleted_at IS NULL;
INSERT INTO record_change_log (id, record_table, record_id, field, old_value, new_value, actor_person_id, reason, changed_at)
SELECT '70a0cc62-d70a-ad52-5f9d-3a001011b866', 'wet_weight_entries', '6375fee0-3386-4975-a1ee-8654c30eed1c', 'actual_dryspc', 'a1000001-0001-4000-8000-000000000002', 'a1000001-0001-4000-8000-000000000003', '7b59cf6b-04b6-4742-bb1b-78a28b593fe8', 'repair 2026-09-22 (canon 0.30.180), the harvest sheet as the record for lots 26030 to 26035: lot 26032 moves from Silo 2 to Silo 3, the sheet''s silo (the crossed wire: two lots stood on Silo 2)', '2026-09-22T04:30:00.000Z'
WHERE NOT EXISTS (SELECT 1 FROM record_change_log WHERE record_table = 'wet_weight_entries' AND record_id = '6375fee0-3386-4975-a1ee-8654c30eed1c' AND field = 'actual_dryspc' AND reason = 'repair 2026-09-22 (canon 0.30.180), the harvest sheet as the record for lots 26030 to 26035: lot 26032 moves from Silo 2 to Silo 3, the sheet''s silo (the crossed wire: two lots stood on Silo 2)');
UPDATE harvest_batches SET planned_dryspc = '3', updated_at = '2026-09-22T04:30:00.000Z', updated_by = '7b59cf6b-04b6-4742-bb1b-78a28b593fe8'
WHERE id = '2d7ace18-1e97-4d87-985a-1e4cf9aacd81' AND planned_dryspc IS NULL AND deleted_at IS NULL;
INSERT INTO record_change_log (id, record_table, record_id, field, old_value, new_value, actor_person_id, reason, changed_at)
SELECT '5e9a6738-8f84-ff76-cfd1-c4929e6bcb6b', 'harvest_batches', '2d7ace18-1e97-4d87-985a-1e4cf9aacd81', 'planned_dryspc', NULL, '3', '7b59cf6b-04b6-4742-bb1b-78a28b593fe8', 'repair 2026-09-22 (canon 0.30.180), the harvest sheet as the record for lots 26030 to 26035: lot 26032 planned silo empty to 3, the sheet''s Silo 3', '2026-09-22T04:30:00.000Z'
WHERE NOT EXISTS (SELECT 1 FROM record_change_log WHERE record_table = 'harvest_batches' AND record_id = '2d7ace18-1e97-4d87-985a-1e4cf9aacd81' AND field = 'planned_dryspc' AND reason = 'repair 2026-09-22 (canon 0.30.180), the harvest sheet as the record for lots 26030 to 26035: lot 26032 planned silo empty to 3, the sheet''s Silo 3');

-- D. Lot 26033 (26264-ARL-OD-009-0-03-26033): 5,697,785 g to 7,219,875 g, one correction tote of 1,522,090 g;
--    Silo 3 to Silo 4; the HBN's planned silo 3 to 4.
INSERT INTO wet_weights (id, wet_weight_entry_id, weight_grams, created_at, created_by, updated_at, updated_by, deleted_at, deleted_by)
SELECT '425f1766-a74b-6074-396a-9083ba9e432e', '0cd2e062-ee8e-4ce1-8eb1-0b80318857ac', 1522090, '2026-09-22T04:30:00.000Z', '7b59cf6b-04b6-4742-bb1b-78a28b593fe8', '2026-09-22T04:30:00.000Z', '7b59cf6b-04b6-4742-bb1b-78a28b593fe8', NULL, NULL
WHERE EXISTS (SELECT 1 FROM wet_weight_entries WHERE id = '0cd2e062-ee8e-4ce1-8eb1-0b80318857ac' AND weight_grams = 5697785 AND deleted_at IS NULL)
  AND NOT EXISTS (SELECT 1 FROM wet_weights WHERE id = '425f1766-a74b-6074-396a-9083ba9e432e');
INSERT INTO record_change_log (id, record_table, record_id, field, old_value, new_value, actor_person_id, reason, changed_at)
SELECT 'a58b1515-7912-d11c-4169-3ce1d35df3ed', 'wet_weights', '425f1766-a74b-6074-396a-9083ba9e432e', 'weight_grams', NULL, '1522090', '7b59cf6b-04b6-4742-bb1b-78a28b593fe8', 'repair 2026-09-22 (canon 0.30.180), the harvest sheet as the record for lots 26030 to 26035: lot 26033 wet weight to 7,219,875 g (one correction tote of 1,522,090 g)', '2026-09-22T04:30:00.000Z'
WHERE NOT EXISTS (SELECT 1 FROM record_change_log WHERE record_table = 'wet_weights' AND record_id = '425f1766-a74b-6074-396a-9083ba9e432e' AND field = 'weight_grams' AND reason = 'repair 2026-09-22 (canon 0.30.180), the harvest sheet as the record for lots 26030 to 26035: lot 26033 wet weight to 7,219,875 g (one correction tote of 1,522,090 g)');
UPDATE wet_weight_entries SET weight_grams = 7219875, updated_at = '2026-09-22T04:30:00.000Z', updated_by = '7b59cf6b-04b6-4742-bb1b-78a28b593fe8'
WHERE id = '0cd2e062-ee8e-4ce1-8eb1-0b80318857ac' AND weight_grams = 5697785 AND deleted_at IS NULL;
INSERT INTO record_change_log (id, record_table, record_id, field, old_value, new_value, actor_person_id, reason, changed_at)
SELECT '42aed0a0-8263-130a-6035-1ed305e16229', 'wet_weight_entries', '0cd2e062-ee8e-4ce1-8eb1-0b80318857ac', 'weight_grams', '5697785', '7219875', '7b59cf6b-04b6-4742-bb1b-78a28b593fe8', 'repair 2026-09-22 (canon 0.30.180), the harvest sheet as the record for lots 26030 to 26035: lot 26033 wet weight to 7,219,875 g (one correction tote of 1,522,090 g)', '2026-09-22T04:30:00.000Z'
WHERE NOT EXISTS (SELECT 1 FROM record_change_log WHERE record_table = 'wet_weight_entries' AND record_id = '0cd2e062-ee8e-4ce1-8eb1-0b80318857ac' AND field = 'weight_grams' AND reason = 'repair 2026-09-22 (canon 0.30.180), the harvest sheet as the record for lots 26030 to 26035: lot 26033 wet weight to 7,219,875 g (one correction tote of 1,522,090 g)');
UPDATE local_inventory_items SET qty = 7219875, updated_at = '2026-09-22T04:30:00.000Z', updated_by = '7b59cf6b-04b6-4742-bb1b-78a28b593fe8'
WHERE id = '9f32f7fd-77a5-4fca-9d56-a58757f66915' AND qty = 5697785 AND deleted_at IS NULL;
INSERT INTO record_change_log (id, record_table, record_id, field, old_value, new_value, actor_person_id, reason, changed_at)
SELECT '9f2f3932-bcdc-ee58-b171-55cd31b1bfbd', 'local_inventory_items', '9f32f7fd-77a5-4fca-9d56-a58757f66915', 'qty', '5697785', '7219875', '7b59cf6b-04b6-4742-bb1b-78a28b593fe8', 'repair 2026-09-22 (canon 0.30.180), the harvest sheet as the record for lots 26030 to 26035: lot 26033 wet weight to 7,219,875 g (one correction tote of 1,522,090 g)', '2026-09-22T04:30:00.000Z'
WHERE NOT EXISTS (SELECT 1 FROM record_change_log WHERE record_table = 'local_inventory_items' AND record_id = '9f32f7fd-77a5-4fca-9d56-a58757f66915' AND field = 'qty' AND reason = 'repair 2026-09-22 (canon 0.30.180), the harvest sheet as the record for lots 26030 to 26035: lot 26033 wet weight to 7,219,875 g (one correction tote of 1,522,090 g)');
UPDATE wet_weight_entries SET actual_dryspc = 'a1000001-0001-4000-8000-000000000004', updated_at = '2026-09-22T04:30:00.000Z', updated_by = '7b59cf6b-04b6-4742-bb1b-78a28b593fe8'
WHERE id = '0cd2e062-ee8e-4ce1-8eb1-0b80318857ac' AND actual_dryspc = 'a1000001-0001-4000-8000-000000000003' AND deleted_at IS NULL;
INSERT INTO record_change_log (id, record_table, record_id, field, old_value, new_value, actor_person_id, reason, changed_at)
SELECT '5bc3a8d0-cc7b-7f10-d7bc-f66fd37a5431', 'wet_weight_entries', '0cd2e062-ee8e-4ce1-8eb1-0b80318857ac', 'actual_dryspc', 'a1000001-0001-4000-8000-000000000003', 'a1000001-0001-4000-8000-000000000004', '7b59cf6b-04b6-4742-bb1b-78a28b593fe8', 'repair 2026-09-22 (canon 0.30.180), the harvest sheet as the record for lots 26030 to 26035: lot 26033 moves from Silo 3 to Silo 4, the sheet''s silo', '2026-09-22T04:30:00.000Z'
WHERE NOT EXISTS (SELECT 1 FROM record_change_log WHERE record_table = 'wet_weight_entries' AND record_id = '0cd2e062-ee8e-4ce1-8eb1-0b80318857ac' AND field = 'actual_dryspc' AND reason = 'repair 2026-09-22 (canon 0.30.180), the harvest sheet as the record for lots 26030 to 26035: lot 26033 moves from Silo 3 to Silo 4, the sheet''s silo');
UPDATE harvest_batches SET planned_dryspc = '4', updated_at = '2026-09-22T04:30:00.000Z', updated_by = '7b59cf6b-04b6-4742-bb1b-78a28b593fe8'
WHERE id = '20576a39-ff3e-423d-9912-c75aa8d3a062' AND planned_dryspc = '3' AND deleted_at IS NULL;
INSERT INTO record_change_log (id, record_table, record_id, field, old_value, new_value, actor_person_id, reason, changed_at)
SELECT 'f431bee3-d33d-d6e3-3c33-e683b0693616', 'harvest_batches', '20576a39-ff3e-423d-9912-c75aa8d3a062', 'planned_dryspc', '3', '4', '7b59cf6b-04b6-4742-bb1b-78a28b593fe8', 'repair 2026-09-22 (canon 0.30.180), the harvest sheet as the record for lots 26030 to 26035: lot 26033 planned silo 3 to 4, the sheet''s Silo 4', '2026-09-22T04:30:00.000Z'
WHERE NOT EXISTS (SELECT 1 FROM record_change_log WHERE record_table = 'harvest_batches' AND record_id = '20576a39-ff3e-423d-9912-c75aa8d3a062' AND field = 'planned_dryspc' AND reason = 'repair 2026-09-22 (canon 0.30.180), the harvest sheet as the record for lots 26030 to 26035: lot 26033 planned silo 3 to 4, the sheet''s Silo 4');

-- E. Lot 26034 (26264-ARL-OD-009-0-04-26034): header only, his pick. 5,628,440 g to 5,308,488 g on the lot header
--    and the born package; the 740 tote rows are left as weighed (they still sum 5,628,440 g and no longer match
--    the header); Silo 4 to Silo 5; the HBN's planned silo 4 to 5. No wet_weights row.
UPDATE wet_weight_entries SET weight_grams = 5308488, updated_at = '2026-09-22T04:30:00.000Z', updated_by = '7b59cf6b-04b6-4742-bb1b-78a28b593fe8'
WHERE id = '2f9a1075-4e90-4d67-9621-767338ea38b3' AND weight_grams = 5628440 AND deleted_at IS NULL;
INSERT INTO record_change_log (id, record_table, record_id, field, old_value, new_value, actor_person_id, reason, changed_at)
SELECT '382828de-2612-09f6-3bdf-95cff1062ee0', 'wet_weight_entries', '2f9a1075-4e90-4d67-9621-767338ea38b3', 'weight_grams', '5628440', '5308488', '7b59cf6b-04b6-4742-bb1b-78a28b593fe8', 'repair 2026-09-22 (canon 0.30.180), the harvest sheet as the record for lots 26030 to 26035: lot 26034 wet weight 5,628,440 g down to 5,308,488 g on the header and the born package only, the owner''s pick; the 740 tote rows are left as weighed and no longer sum to the header', '2026-09-22T04:30:00.000Z'
WHERE NOT EXISTS (SELECT 1 FROM record_change_log WHERE record_table = 'wet_weight_entries' AND record_id = '2f9a1075-4e90-4d67-9621-767338ea38b3' AND field = 'weight_grams' AND reason = 'repair 2026-09-22 (canon 0.30.180), the harvest sheet as the record for lots 26030 to 26035: lot 26034 wet weight 5,628,440 g down to 5,308,488 g on the header and the born package only, the owner''s pick; the 740 tote rows are left as weighed and no longer sum to the header');
UPDATE local_inventory_items SET qty = 5308488, updated_at = '2026-09-22T04:30:00.000Z', updated_by = '7b59cf6b-04b6-4742-bb1b-78a28b593fe8'
WHERE id = 'dc34b1d7-9baa-4245-b1a4-d548a7812267' AND qty = 5628440 AND deleted_at IS NULL;
INSERT INTO record_change_log (id, record_table, record_id, field, old_value, new_value, actor_person_id, reason, changed_at)
SELECT 'dd3853c2-ac34-feeb-bddb-b9b1f9a2b13f', 'local_inventory_items', 'dc34b1d7-9baa-4245-b1a4-d548a7812267', 'qty', '5628440', '5308488', '7b59cf6b-04b6-4742-bb1b-78a28b593fe8', 'repair 2026-09-22 (canon 0.30.180), the harvest sheet as the record for lots 26030 to 26035: lot 26034 wet weight 5,628,440 g down to 5,308,488 g on the header and the born package only, the owner''s pick; the 740 tote rows are left as weighed and no longer sum to the header', '2026-09-22T04:30:00.000Z'
WHERE NOT EXISTS (SELECT 1 FROM record_change_log WHERE record_table = 'local_inventory_items' AND record_id = 'dc34b1d7-9baa-4245-b1a4-d548a7812267' AND field = 'qty' AND reason = 'repair 2026-09-22 (canon 0.30.180), the harvest sheet as the record for lots 26030 to 26035: lot 26034 wet weight 5,628,440 g down to 5,308,488 g on the header and the born package only, the owner''s pick; the 740 tote rows are left as weighed and no longer sum to the header');
UPDATE wet_weight_entries SET actual_dryspc = 'a1000001-0001-4000-8000-000000000005', updated_at = '2026-09-22T04:30:00.000Z', updated_by = '7b59cf6b-04b6-4742-bb1b-78a28b593fe8'
WHERE id = '2f9a1075-4e90-4d67-9621-767338ea38b3' AND actual_dryspc = 'a1000001-0001-4000-8000-000000000004' AND deleted_at IS NULL;
INSERT INTO record_change_log (id, record_table, record_id, field, old_value, new_value, actor_person_id, reason, changed_at)
SELECT 'dcb24375-602d-fb92-509f-c74f37e827b6', 'wet_weight_entries', '2f9a1075-4e90-4d67-9621-767338ea38b3', 'actual_dryspc', 'a1000001-0001-4000-8000-000000000004', 'a1000001-0001-4000-8000-000000000005', '7b59cf6b-04b6-4742-bb1b-78a28b593fe8', 'repair 2026-09-22 (canon 0.30.180), the harvest sheet as the record for lots 26030 to 26035: lot 26034 moves from Silo 4 to Silo 5, the sheet''s silo', '2026-09-22T04:30:00.000Z'
WHERE NOT EXISTS (SELECT 1 FROM record_change_log WHERE record_table = 'wet_weight_entries' AND record_id = '2f9a1075-4e90-4d67-9621-767338ea38b3' AND field = 'actual_dryspc' AND reason = 'repair 2026-09-22 (canon 0.30.180), the harvest sheet as the record for lots 26030 to 26035: lot 26034 moves from Silo 4 to Silo 5, the sheet''s silo');
UPDATE harvest_batches SET planned_dryspc = '5', updated_at = '2026-09-22T04:30:00.000Z', updated_by = '7b59cf6b-04b6-4742-bb1b-78a28b593fe8'
WHERE id = '820d81bc-8f56-4fe1-9eae-fd471b4badd3' AND planned_dryspc = '4' AND deleted_at IS NULL;
INSERT INTO record_change_log (id, record_table, record_id, field, old_value, new_value, actor_person_id, reason, changed_at)
SELECT 'aa237a3e-b33a-75b9-d708-140322eeb48c', 'harvest_batches', '820d81bc-8f56-4fe1-9eae-fd471b4badd3', 'planned_dryspc', '4', '5', '7b59cf6b-04b6-4742-bb1b-78a28b593fe8', 'repair 2026-09-22 (canon 0.30.180), the harvest sheet as the record for lots 26030 to 26035: lot 26034 planned silo 4 to 5, the sheet''s Silo 5', '2026-09-22T04:30:00.000Z'
WHERE NOT EXISTS (SELECT 1 FROM record_change_log WHERE record_table = 'harvest_batches' AND record_id = '820d81bc-8f56-4fe1-9eae-fd471b4badd3' AND field = 'planned_dryspc' AND reason = 'repair 2026-09-22 (canon 0.30.180), the harvest sheet as the record for lots 26030 to 26035: lot 26034 planned silo 4 to 5, the sheet''s Silo 5');

-- F. Lot 26035 (26264-ARL-OD-009-0-05-26035), the crossed wire, not on the sheet: voided, the whole trail, born
--    package then lot then HBN. Its 748 tote rows (5,313,405 g) and its 1,016 plant tags stay attached to the
--    voided lot and HBN for the record (the 0.30.91 law; his pick). harvest_batches and wet_weight_entries carry
--    no delete_reason column, the log rows carry the reason. The HBN's void also asks that no live lot remain
--    on it, so it cannot outrun the lot's void.
UPDATE local_inventory_items SET deleted_at = '2026-09-22T04:30:00.000Z', deleted_by = '7b59cf6b-04b6-4742-bb1b-78a28b593fe8', delete_reason = 'repair 2026-09-22 (canon 0.30.180), the harvest sheet as the record for lots 26030 to 26035: lot 26035 is the crossed wire and is not on the sheet: its 5,313,405 g born package leaves the ledger', updated_at = '2026-09-22T04:30:00.000Z', updated_by = '7b59cf6b-04b6-4742-bb1b-78a28b593fe8'
WHERE id = '7a527493-d3ba-4de9-960c-4b4e439447f4' AND wet_weight_entry_id = '152e4fdc-a2c5-482d-8121-181c48ee4205' AND package_code = '26035' AND qty = 5313405 AND deleted_at IS NULL;
INSERT INTO record_change_log (id, record_table, record_id, field, old_value, new_value, actor_person_id, reason, changed_at)
SELECT '66632fd3-3888-aa22-56ec-21ae7576d5c6', 'local_inventory_items', '7a527493-d3ba-4de9-960c-4b4e439447f4', 'deleted_at', NULL, '2026-09-22T04:30:00.000Z', '7b59cf6b-04b6-4742-bb1b-78a28b593fe8', 'repair 2026-09-22 (canon 0.30.180), the harvest sheet as the record for lots 26030 to 26035: lot 26035 is the crossed wire and is not on the sheet: its 5,313,405 g born package leaves the ledger', '2026-09-22T04:30:00.000Z'
WHERE NOT EXISTS (SELECT 1 FROM record_change_log WHERE record_table = 'local_inventory_items' AND record_id = '7a527493-d3ba-4de9-960c-4b4e439447f4' AND field = 'deleted_at' AND reason = 'repair 2026-09-22 (canon 0.30.180), the harvest sheet as the record for lots 26030 to 26035: lot 26035 is the crossed wire and is not on the sheet: its 5,313,405 g born package leaves the ledger');
UPDATE wet_weight_entries SET deleted_at = '2026-09-22T04:30:00.000Z', deleted_by = '7b59cf6b-04b6-4742-bb1b-78a28b593fe8', updated_at = '2026-09-22T04:30:00.000Z', updated_by = '7b59cf6b-04b6-4742-bb1b-78a28b593fe8'
WHERE id = '152e4fdc-a2c5-482d-8121-181c48ee4205' AND harvest_batch_id = 'c455af1a-16e6-4f25-aad1-fe42bb8311bc' AND weight_grams = 5313405 AND status = 'drying' AND deleted_at IS NULL
  AND NOT EXISTS (SELECT 1 FROM silo_loads WHERE wet_weight_entry_id = '152e4fdc-a2c5-482d-8121-181c48ee4205' AND deleted_at IS NULL AND ended_at IS NULL);
INSERT INTO record_change_log (id, record_table, record_id, field, old_value, new_value, actor_person_id, reason, changed_at)
SELECT '39c5efbd-7ff1-8ea8-8790-dad160cfb617', 'wet_weight_entries', '152e4fdc-a2c5-482d-8121-181c48ee4205', 'deleted_at', NULL, '2026-09-22T04:30:00.000Z', '7b59cf6b-04b6-4742-bb1b-78a28b593fe8', 'repair 2026-09-22 (canon 0.30.180), the harvest sheet as the record for lots 26030 to 26035: lot 26035 is the crossed wire and is not on the sheet: the lot is voided; its 748 tote rows stay attached for the record', '2026-09-22T04:30:00.000Z'
WHERE NOT EXISTS (SELECT 1 FROM record_change_log WHERE record_table = 'wet_weight_entries' AND record_id = '152e4fdc-a2c5-482d-8121-181c48ee4205' AND field = 'deleted_at' AND reason = 'repair 2026-09-22 (canon 0.30.180), the harvest sheet as the record for lots 26030 to 26035: lot 26035 is the crossed wire and is not on the sheet: the lot is voided; its 748 tote rows stay attached for the record');
UPDATE harvest_batches SET deleted_at = '2026-09-22T04:30:00.000Z', deleted_by = '7b59cf6b-04b6-4742-bb1b-78a28b593fe8', updated_at = '2026-09-22T04:30:00.000Z', updated_by = '7b59cf6b-04b6-4742-bb1b-78a28b593fe8'
WHERE id = 'c455af1a-16e6-4f25-aad1-fe42bb8311bc' AND hbn = '26264-ARL-OD-009-0-05-26035' AND status = 'open' AND deleted_at IS NULL
  AND NOT EXISTS (SELECT 1 FROM wet_weight_entries WHERE harvest_batch_id = 'c455af1a-16e6-4f25-aad1-fe42bb8311bc' AND deleted_at IS NULL);
INSERT INTO record_change_log (id, record_table, record_id, field, old_value, new_value, actor_person_id, reason, changed_at)
SELECT 'bdf00c3a-931f-cb3d-d349-27e39ba91c8d', 'harvest_batches', 'c455af1a-16e6-4f25-aad1-fe42bb8311bc', 'deleted_at', NULL, '2026-09-22T04:30:00.000Z', '7b59cf6b-04b6-4742-bb1b-78a28b593fe8', 'repair 2026-09-22 (canon 0.30.180), the harvest sheet as the record for lots 26030 to 26035: lot 26035 is the crossed wire and is not on the sheet: the HBN is voided, its 1,016 plant tags stay attached for the record; serial 26035 stays used', '2026-09-22T04:30:00.000Z'
WHERE NOT EXISTS (SELECT 1 FROM record_change_log WHERE record_table = 'harvest_batches' AND record_id = 'c455af1a-16e6-4f25-aad1-fe42bb8311bc' AND field = 'deleted_at' AND reason = 'repair 2026-09-22 (canon 0.30.180), the harvest sheet as the record for lots 26030 to 26035: lot 26035 is the crossed wire and is not on the sheet: the HBN is voided, its 1,016 plant tags stay attached for the record; serial 26035 stays used');

-- G. Untouched on purpose: the tote rows of every lot (26034's 740 rows keep their weighed grams; 26035's 748 stay
--    on the voided lot); the three metrc_uploads rows 320d9a8f, 5663a89f, 603fde28 (the re-pend comes from the
--    lots' updated_at, not from them); the unfinished unload session 926fa4a9 on 26031; the plant tags of every
--    HBN; lots 26027 to 26029 and the Arlington Dry Room with their loads; every other HBN, lot, load and package
--    on the floor.
-- End of repair. Expected effect: 24 rows updated/inserted (4 correction tote rows inserted, 20 updates),
-- 24 log rows inserted; a second run: 0 and 0.
