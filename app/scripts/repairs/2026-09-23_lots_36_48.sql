-- THE REPAIR OF LOTS 26036 TO 26048 (canon 0.30.213). Owner, 2026-09-23, verbatim, with Patrick Smith's two Teams
-- notes (his words run to the line that says so): Notes from Patrick. Similar to the problem yesterday.  Multiple lots
-- split over multiple trucks split over multiple silos led to inconsistencies that we can't fix easily.  Can you
-- repair this
-- (his words end there). Patrick's 6:00 AM table (Harvest Batch, Strain, Location, Plants, Wet Weight):
--   26265-ARL-OD-009-0-05-26041  Purple Punch   Hold    635   5179192
--   26265-ARL-OD-009-0-04-26039  Purple Punch   Silo 4  932   6998799
--   26265-ARL-OD-009-0-03-26038  Banana Zelato  Silo 3  862   6879738.67
--   26265-ARL-OD-009-0-01-26037  Banana Zelato  Silo 2  910   7116911.03
--   26265-ARL-OD-009-0-01-26036  Banana Zelato  Silo 1  1001  7081417.3
-- Patrick's 6:20 PM note: move weight from 24045 to 26048 / 26266-PNN-OD-070-0-04-26045 needs 3,594,528 grams /
-- 26266-PNN-OD-070-0-03-26048 needs 2,824,272 grams / both need to be in Silo 3 (24045 read as 26045).
-- His picks on the question tool (2026-09-23): Yes: void 26040, spread its weight; Move the 764 to 26039, leave the 635
-- duplicates on the voided 26040; Repair now and finish both lots so Load Dry Space lists them; One negative correction
-- tote. THE TWO BOOKS OF RECORD (0.30.203): the sheet and Patrick's figures are reality; the app follows them.
--
-- What the pre snapshot (db_backups/20260923-184431_pre_lots_36_48, dumped 2026-09-23T22:44:33Z) shows. The six ARL
-- lots 26036 to 26041 total 33,256,058 g; Patrick's five (no 26040) total the same to the gram, and 26040's 5,655,823 g
-- is exactly the four differences: 26036 +1,449,947, 26037 +1,275,016, 26038 +1,425,409, 26039 +1,505,451. 26040
-- (HBN 98acb943-3c55-4c51-b3e4-7bebabf615ac, minted 2026-09-22T20:22Z planned 4; lot e1fc7a59-105b-41f8-b302-c5b91ebc794d, 740 totes 20:33Z to 21:45Z, finished
-- 21:47Z drying) was moved by the owner at 00:24Z on the 23rd into the Blast Freezer(s) space (load df540fb7-a35b-4267-b5bb-e90cbd368452, still
-- running; an unfinished unload session c4bfa487-0f28-42dd-9e17-a17eae9b8b38 of 17:46Z); its ledger item 511fafb8-5544-45e4-a4de-4eae9ab7099b 5,655,823 g at Blast Freezer;
-- 764 plant tags assigned 21:50Z and voided 00:28Z; 635 live tags identical to 26041's 635. 26036, 26037 and 26038
-- have been through Silo 1, 2 and 3 (loads ended 18:19Z, 20:44Z and 19:23Z on the 23rd) with dry weights 1,528,130,
-- 1,439,400 and 1,568,350 g and their ledger items dry at BARN; 26039 is in Silo 4 (load since 00:15Z), item 5,493,348 g
-- at Silo 4; 26041 loaded into Silo 5 at 13:15Z (after Patrick's 6 AM Hold), untouched here. PNN: 26045 (HBN
-- 8291c448-04cf-478b-89a6-a070fc3f4a44, planned 3, string -04-; lot 107e85ff-43e8-4f80-87b3-480553bd2586, 956 totes 19:42Z to 21:45Z, 6,411,185 g, status weighing,
-- actual_dryspc Silo 4; item e3b8ed53-2e60-4f4f-9a7b-883c13280ca6 6,411,185 g at BARN); 26048 (HBN c800bafa-cee8-4494-baf0-2c8b71d540c3; lot f7e7e2b6-caec-413c-939d-a8a13c1b36e1 started 22:23Z, no
-- totes, weighing, Silo 3, no ledger item). Patrick's 3,594,528 + 2,824,272 = 6,418,800 g is 7,615 g more than the
-- totes weighed on 26045; the figures are reality and the difference is named here. No metrc_uploads rows exist for
-- serials 36 to 48. Grams are stored whole, rounded half up: 7081417, 7116911, 6879739, 6998799.
--
-- Every statement is guarded by the current value it expects, so a second run changes nothing; every change lands in
-- record_change_log under the owner's login with this repair's reason and the fixed stamp 2026-09-23T23:30:00.000Z. Run from
-- app/ at the owner's keyboard:
--   node scripts/repair-apply.mjs scripts/repairs/2026-09-23_lots_36_48.sql
-- Then: node scripts/db-snapshot.mjs post_lots_36_48


-- A1. Lot 26036 (26265-ARL-OD-009-0-01-26036): 5,631,470 g to 7,081,417 g, one correction tote of 1,449,947 g.
INSERT INTO wet_weights (id, wet_weight_entry_id, weight_grams, created_at, created_by, updated_at, updated_by, deleted_at, deleted_by)
SELECT '52949daf-9f49-5c7e-875d-4b1d611d4f4f', 'a2f565a4-ee98-449a-a8a1-f26db807966f', 1449947, '2026-09-23T23:30:00.000Z', '7b59cf6b-04b6-4742-bb1b-78a28b593fe8', '2026-09-23T23:30:00.000Z', '7b59cf6b-04b6-4742-bb1b-78a28b593fe8', NULL, NULL
WHERE EXISTS (SELECT 1 FROM wet_weight_entries WHERE id = 'a2f565a4-ee98-449a-a8a1-f26db807966f' AND weight_grams = 5631470 AND deleted_at IS NULL)
  AND NOT EXISTS (SELECT 1 FROM wet_weights WHERE id = '52949daf-9f49-5c7e-875d-4b1d611d4f4f');
INSERT INTO record_change_log (id, record_table, record_id, field, old_value, new_value, actor_person_id, reason, changed_at)
SELECT '4f28b509-b30e-5ecd-b4dd-85b242434674', 'wet_weights', '52949daf-9f49-5c7e-875d-4b1d611d4f4f', 'weight_grams', NULL, '1449947', '7b59cf6b-04b6-4742-bb1b-78a28b593fe8', 'repair 2026-09-23 (canon 0.30.213), Patrick''s notes of the 23rd: 26040 is the phantom, its 5,655,823 g are the four differences to Patrick''s grams: lot 26036 5,631,470 to 7,081,417 g by one correction tote of 1,449,947 g', '2026-09-23T23:30:00.000Z'
WHERE NOT EXISTS (SELECT 1 FROM record_change_log WHERE record_table = 'wet_weights' AND record_id = '52949daf-9f49-5c7e-875d-4b1d611d4f4f' AND field = 'weight_grams' AND reason = 'repair 2026-09-23 (canon 0.30.213), Patrick''s notes of the 23rd: 26040 is the phantom, its 5,655,823 g are the four differences to Patrick''s grams: lot 26036 5,631,470 to 7,081,417 g by one correction tote of 1,449,947 g');
UPDATE wet_weight_entries SET weight_grams = 7081417, updated_at = '2026-09-23T23:30:00.000Z', updated_by = '7b59cf6b-04b6-4742-bb1b-78a28b593fe8'
WHERE id = 'a2f565a4-ee98-449a-a8a1-f26db807966f' AND weight_grams = 5631470 AND deleted_at IS NULL;
INSERT INTO record_change_log (id, record_table, record_id, field, old_value, new_value, actor_person_id, reason, changed_at)
SELECT '82717147-0d46-5042-908d-e2b11609f5a2', 'wet_weight_entries', 'a2f565a4-ee98-449a-a8a1-f26db807966f', 'weight_grams', '5631470', '7081417', '7b59cf6b-04b6-4742-bb1b-78a28b593fe8', 'repair 2026-09-23 (canon 0.30.213), Patrick''s notes of the 23rd: 26040 is the phantom, its 5,655,823 g are the four differences to Patrick''s grams: lot 26036 5,631,470 to 7,081,417 g by one correction tote of 1,449,947 g', '2026-09-23T23:30:00.000Z'
WHERE NOT EXISTS (SELECT 1 FROM record_change_log WHERE record_table = 'wet_weight_entries' AND record_id = 'a2f565a4-ee98-449a-a8a1-f26db807966f' AND field = 'weight_grams' AND reason = 'repair 2026-09-23 (canon 0.30.213), Patrick''s notes of the 23rd: 26040 is the phantom, its 5,655,823 g are the four differences to Patrick''s grams: lot 26036 5,631,470 to 7,081,417 g by one correction tote of 1,449,947 g');

-- A2. Lot 26037 (26265-ARL-OD-009-0-01-26037): 5,841,895 g to 7,116,911 g, one correction tote of 1,275,016 g.
INSERT INTO wet_weights (id, wet_weight_entry_id, weight_grams, created_at, created_by, updated_at, updated_by, deleted_at, deleted_by)
SELECT 'ce2dbb90-c292-5c51-9831-2b25a0d59ef9', '753e1fef-aa33-4d18-ba2b-e0593b94d9a6', 1275016, '2026-09-23T23:30:00.000Z', '7b59cf6b-04b6-4742-bb1b-78a28b593fe8', '2026-09-23T23:30:00.000Z', '7b59cf6b-04b6-4742-bb1b-78a28b593fe8', NULL, NULL
WHERE EXISTS (SELECT 1 FROM wet_weight_entries WHERE id = '753e1fef-aa33-4d18-ba2b-e0593b94d9a6' AND weight_grams = 5841895 AND deleted_at IS NULL)
  AND NOT EXISTS (SELECT 1 FROM wet_weights WHERE id = 'ce2dbb90-c292-5c51-9831-2b25a0d59ef9');
INSERT INTO record_change_log (id, record_table, record_id, field, old_value, new_value, actor_person_id, reason, changed_at)
SELECT 'ca9851b8-8fb4-5a38-a9de-e0414faa021e', 'wet_weights', 'ce2dbb90-c292-5c51-9831-2b25a0d59ef9', 'weight_grams', NULL, '1275016', '7b59cf6b-04b6-4742-bb1b-78a28b593fe8', 'repair 2026-09-23 (canon 0.30.213), Patrick''s notes of the 23rd: 26040 is the phantom, its 5,655,823 g are the four differences to Patrick''s grams: lot 26037 5,841,895 to 7,116,911 g by one correction tote of 1,275,016 g', '2026-09-23T23:30:00.000Z'
WHERE NOT EXISTS (SELECT 1 FROM record_change_log WHERE record_table = 'wet_weights' AND record_id = 'ce2dbb90-c292-5c51-9831-2b25a0d59ef9' AND field = 'weight_grams' AND reason = 'repair 2026-09-23 (canon 0.30.213), Patrick''s notes of the 23rd: 26040 is the phantom, its 5,655,823 g are the four differences to Patrick''s grams: lot 26037 5,841,895 to 7,116,911 g by one correction tote of 1,275,016 g');
UPDATE wet_weight_entries SET weight_grams = 7116911, updated_at = '2026-09-23T23:30:00.000Z', updated_by = '7b59cf6b-04b6-4742-bb1b-78a28b593fe8'
WHERE id = '753e1fef-aa33-4d18-ba2b-e0593b94d9a6' AND weight_grams = 5841895 AND deleted_at IS NULL;
INSERT INTO record_change_log (id, record_table, record_id, field, old_value, new_value, actor_person_id, reason, changed_at)
SELECT 'ee9fa7d2-597f-52df-a215-b7fffdfa066a', 'wet_weight_entries', '753e1fef-aa33-4d18-ba2b-e0593b94d9a6', 'weight_grams', '5841895', '7116911', '7b59cf6b-04b6-4742-bb1b-78a28b593fe8', 'repair 2026-09-23 (canon 0.30.213), Patrick''s notes of the 23rd: 26040 is the phantom, its 5,655,823 g are the four differences to Patrick''s grams: lot 26037 5,841,895 to 7,116,911 g by one correction tote of 1,275,016 g', '2026-09-23T23:30:00.000Z'
WHERE NOT EXISTS (SELECT 1 FROM record_change_log WHERE record_table = 'wet_weight_entries' AND record_id = '753e1fef-aa33-4d18-ba2b-e0593b94d9a6' AND field = 'weight_grams' AND reason = 'repair 2026-09-23 (canon 0.30.213), Patrick''s notes of the 23rd: 26040 is the phantom, its 5,655,823 g are the four differences to Patrick''s grams: lot 26037 5,841,895 to 7,116,911 g by one correction tote of 1,275,016 g');

-- A3. Lot 26038 (26265-ARL-OD-009-0-03-26038): 5,454,330 g to 6,879,739 g, one correction tote of 1,425,409 g.
INSERT INTO wet_weights (id, wet_weight_entry_id, weight_grams, created_at, created_by, updated_at, updated_by, deleted_at, deleted_by)
SELECT 'b6fb6900-8f51-57cf-abfc-3b8523de36d4', 'e1f51f4e-b4ca-41c0-a884-9433ed48489a', 1425409, '2026-09-23T23:30:00.000Z', '7b59cf6b-04b6-4742-bb1b-78a28b593fe8', '2026-09-23T23:30:00.000Z', '7b59cf6b-04b6-4742-bb1b-78a28b593fe8', NULL, NULL
WHERE EXISTS (SELECT 1 FROM wet_weight_entries WHERE id = 'e1f51f4e-b4ca-41c0-a884-9433ed48489a' AND weight_grams = 5454330 AND deleted_at IS NULL)
  AND NOT EXISTS (SELECT 1 FROM wet_weights WHERE id = 'b6fb6900-8f51-57cf-abfc-3b8523de36d4');
INSERT INTO record_change_log (id, record_table, record_id, field, old_value, new_value, actor_person_id, reason, changed_at)
SELECT '2998b5a1-e68e-507b-b7cb-7771feeab430', 'wet_weights', 'b6fb6900-8f51-57cf-abfc-3b8523de36d4', 'weight_grams', NULL, '1425409', '7b59cf6b-04b6-4742-bb1b-78a28b593fe8', 'repair 2026-09-23 (canon 0.30.213), Patrick''s notes of the 23rd: 26040 is the phantom, its 5,655,823 g are the four differences to Patrick''s grams: lot 26038 5,454,330 to 6,879,739 g by one correction tote of 1,425,409 g', '2026-09-23T23:30:00.000Z'
WHERE NOT EXISTS (SELECT 1 FROM record_change_log WHERE record_table = 'wet_weights' AND record_id = 'b6fb6900-8f51-57cf-abfc-3b8523de36d4' AND field = 'weight_grams' AND reason = 'repair 2026-09-23 (canon 0.30.213), Patrick''s notes of the 23rd: 26040 is the phantom, its 5,655,823 g are the four differences to Patrick''s grams: lot 26038 5,454,330 to 6,879,739 g by one correction tote of 1,425,409 g');
UPDATE wet_weight_entries SET weight_grams = 6879739, updated_at = '2026-09-23T23:30:00.000Z', updated_by = '7b59cf6b-04b6-4742-bb1b-78a28b593fe8'
WHERE id = 'e1f51f4e-b4ca-41c0-a884-9433ed48489a' AND weight_grams = 5454330 AND deleted_at IS NULL;
INSERT INTO record_change_log (id, record_table, record_id, field, old_value, new_value, actor_person_id, reason, changed_at)
SELECT 'da5d032d-8c6a-5c39-a013-be5f2795cf2a', 'wet_weight_entries', 'e1f51f4e-b4ca-41c0-a884-9433ed48489a', 'weight_grams', '5454330', '6879739', '7b59cf6b-04b6-4742-bb1b-78a28b593fe8', 'repair 2026-09-23 (canon 0.30.213), Patrick''s notes of the 23rd: 26040 is the phantom, its 5,655,823 g are the four differences to Patrick''s grams: lot 26038 5,454,330 to 6,879,739 g by one correction tote of 1,425,409 g', '2026-09-23T23:30:00.000Z'
WHERE NOT EXISTS (SELECT 1 FROM record_change_log WHERE record_table = 'wet_weight_entries' AND record_id = 'e1f51f4e-b4ca-41c0-a884-9433ed48489a' AND field = 'weight_grams' AND reason = 'repair 2026-09-23 (canon 0.30.213), Patrick''s notes of the 23rd: 26040 is the phantom, its 5,655,823 g are the four differences to Patrick''s grams: lot 26038 5,454,330 to 6,879,739 g by one correction tote of 1,425,409 g');

-- A4. Lot 26039 (26265-ARL-OD-009-0-04-26039): 5,493,348 g to 6,998,799 g, one correction tote of 1,505,451 g.
INSERT INTO wet_weights (id, wet_weight_entry_id, weight_grams, created_at, created_by, updated_at, updated_by, deleted_at, deleted_by)
SELECT 'ea69d9ec-3cf0-5e88-9f50-d17f95544e66', 'ec39dd78-1a98-429c-8fcf-35b7bf98fedd', 1505451, '2026-09-23T23:30:00.000Z', '7b59cf6b-04b6-4742-bb1b-78a28b593fe8', '2026-09-23T23:30:00.000Z', '7b59cf6b-04b6-4742-bb1b-78a28b593fe8', NULL, NULL
WHERE EXISTS (SELECT 1 FROM wet_weight_entries WHERE id = 'ec39dd78-1a98-429c-8fcf-35b7bf98fedd' AND weight_grams = 5493348 AND deleted_at IS NULL)
  AND NOT EXISTS (SELECT 1 FROM wet_weights WHERE id = 'ea69d9ec-3cf0-5e88-9f50-d17f95544e66');
INSERT INTO record_change_log (id, record_table, record_id, field, old_value, new_value, actor_person_id, reason, changed_at)
SELECT '675afbef-0ce1-5de6-b68b-bf27fca26d79', 'wet_weights', 'ea69d9ec-3cf0-5e88-9f50-d17f95544e66', 'weight_grams', NULL, '1505451', '7b59cf6b-04b6-4742-bb1b-78a28b593fe8', 'repair 2026-09-23 (canon 0.30.213), Patrick''s notes of the 23rd: 26040 is the phantom, its 5,655,823 g are the four differences to Patrick''s grams: lot 26039 5,493,348 to 6,998,799 g by one correction tote of 1,505,451 g', '2026-09-23T23:30:00.000Z'
WHERE NOT EXISTS (SELECT 1 FROM record_change_log WHERE record_table = 'wet_weights' AND record_id = 'ea69d9ec-3cf0-5e88-9f50-d17f95544e66' AND field = 'weight_grams' AND reason = 'repair 2026-09-23 (canon 0.30.213), Patrick''s notes of the 23rd: 26040 is the phantom, its 5,655,823 g are the four differences to Patrick''s grams: lot 26039 5,493,348 to 6,998,799 g by one correction tote of 1,505,451 g');
UPDATE wet_weight_entries SET weight_grams = 6998799, updated_at = '2026-09-23T23:30:00.000Z', updated_by = '7b59cf6b-04b6-4742-bb1b-78a28b593fe8'
WHERE id = 'ec39dd78-1a98-429c-8fcf-35b7bf98fedd' AND weight_grams = 5493348 AND deleted_at IS NULL;
INSERT INTO record_change_log (id, record_table, record_id, field, old_value, new_value, actor_person_id, reason, changed_at)
SELECT '66df3a59-d285-565f-a916-59261ad397c7', 'wet_weight_entries', 'ec39dd78-1a98-429c-8fcf-35b7bf98fedd', 'weight_grams', '5493348', '6998799', '7b59cf6b-04b6-4742-bb1b-78a28b593fe8', 'repair 2026-09-23 (canon 0.30.213), Patrick''s notes of the 23rd: 26040 is the phantom, its 5,655,823 g are the four differences to Patrick''s grams: lot 26039 5,493,348 to 6,998,799 g by one correction tote of 1,505,451 g', '2026-09-23T23:30:00.000Z'
WHERE NOT EXISTS (SELECT 1 FROM record_change_log WHERE record_table = 'wet_weight_entries' AND record_id = 'ec39dd78-1a98-429c-8fcf-35b7bf98fedd' AND field = 'weight_grams' AND reason = 'repair 2026-09-23 (canon 0.30.213), Patrick''s notes of the 23rd: 26040 is the phantom, its 5,655,823 g are the four differences to Patrick''s grams: lot 26039 5,493,348 to 6,998,799 g by one correction tote of 1,505,451 g');
-- 26039 is still in Silo 4, so its ledger item carries the wet grams and follows the header; 26036, 26037 and
-- 26038 have been unloaded and their items carry dry grams, untouched.
UPDATE local_inventory_items SET qty = 6998799, updated_at = '2026-09-23T23:30:00.000Z', updated_by = '7b59cf6b-04b6-4742-bb1b-78a28b593fe8'
WHERE id = 'd712f149-d5e5-44e0-885b-c24168d2af95' AND wet_weight_entry_id = 'ec39dd78-1a98-429c-8fcf-35b7bf98fedd' AND qty = 5493348 AND deleted_at IS NULL;
INSERT INTO record_change_log (id, record_table, record_id, field, old_value, new_value, actor_person_id, reason, changed_at)
SELECT '889247f7-5818-5c96-812d-bf35d4df1433', 'local_inventory_items', 'd712f149-d5e5-44e0-885b-c24168d2af95', 'qty', '5493348', '6998799', '7b59cf6b-04b6-4742-bb1b-78a28b593fe8', 'repair 2026-09-23 (canon 0.30.213), Patrick''s notes of the 23rd: 26040 is the phantom, its 5,655,823 g are the four differences to Patrick''s grams: lot 26039 5,493,348 to 6,998,799 g by one correction tote of 1,505,451 g', '2026-09-23T23:30:00.000Z'
WHERE NOT EXISTS (SELECT 1 FROM record_change_log WHERE record_table = 'local_inventory_items' AND record_id = 'd712f149-d5e5-44e0-885b-c24168d2af95' AND field = 'qty' AND reason = 'repair 2026-09-23 (canon 0.30.213), Patrick''s notes of the 23rd: 26040 is the phantom, its 5,655,823 g are the four differences to Patrick''s grams: lot 26039 5,493,348 to 6,998,799 g by one correction tote of 1,505,451 g');

-- B. 26040's 764 voided plant tags move to 26039 as live tags in one statement (its own WHERE is the guard: a second
--    run finds no row); the 635 live tags 26040 shares with 26041 stay where they are (26041 keeps them live).
UPDATE harvest_plant_tags SET harvest_batch_id = 'e9d9136f-391b-4535-9987-85f2000579b5', deleted_at = NULL, deleted_by = NULL, updated_at = '2026-09-23T23:30:00.000Z', updated_by = '7b59cf6b-04b6-4742-bb1b-78a28b593fe8'
WHERE harvest_batch_id = '98acb943-3c55-4c51-b3e4-7bebabf615ac' AND deleted_at IS NOT NULL
  AND EXISTS (SELECT 1 FROM harvest_batches WHERE id = 'e9d9136f-391b-4535-9987-85f2000579b5' AND hbn = '26265-ARL-OD-009-0-04-26039' AND deleted_at IS NULL);
INSERT INTO record_change_log (id, record_table, record_id, field, old_value, new_value, actor_person_id, reason, changed_at)
SELECT '828e9439-dab8-5ad6-aaec-999c16ae440b', 'harvest_plant_tags', '98acb943-3c55-4c51-b3e4-7bebabf615ac', 'harvest_batch_id', '98acb943-3c55-4c51-b3e4-7bebabf615ac', 'e9d9136f-391b-4535-9987-85f2000579b5', '7b59cf6b-04b6-4742-bb1b-78a28b593fe8', 'repair 2026-09-23 (canon 0.30.213), Patrick''s notes of the 23rd: the 764 plant tags assigned to the phantom 26040 at 21:50Z on the 22nd and voided at 00:28Z move to HBN 26039, which had none (the sheet reads 932 plants); the 635 tags 26040 shares with 26041 stay attached to the voided 26040', '2026-09-23T23:30:00.000Z'
WHERE NOT EXISTS (SELECT 1 FROM record_change_log WHERE record_table = 'harvest_plant_tags' AND record_id = '98acb943-3c55-4c51-b3e4-7bebabf615ac' AND field = 'harvest_batch_id' AND reason = 'repair 2026-09-23 (canon 0.30.213), Patrick''s notes of the 23rd: the 764 plant tags assigned to the phantom 26040 at 21:50Z on the 22nd and voided at 00:28Z move to HBN 26039, which had none (the sheet reads 932 plants); the 635 tags 26040 shares with 26041 stay attached to the voided 26040');

-- C. 26040 is voided, the whole trail: the Blast Freezer load, the unfinished unload session, the ledger item, the lot,
--    the HBN. Soft voids with the reason where the table carries delete_reason (silo_loads, local_inventory_items); the
--    log rows carry it elsewhere. The 740 tote rows and the 635 shared tags stay attached to the voided lot and HBN.
UPDATE silo_loads SET deleted_at = '2026-09-23T23:30:00.000Z', deleted_by = '7b59cf6b-04b6-4742-bb1b-78a28b593fe8', delete_reason = 'repair 2026-09-23 (canon 0.30.213), Patrick''s notes of the 23rd: the phantom lot 26040 leaves the Blast Freezer(s) space; its running load is voided', updated_at = '2026-09-23T23:30:00.000Z', updated_by = '7b59cf6b-04b6-4742-bb1b-78a28b593fe8'
WHERE id = 'df540fb7-a35b-4267-b5bb-e90cbd368452' AND dry_space_id = 'a1000001-0000-4000-8000-0000000000bf' AND wet_weight_entry_id = 'e1fc7a59-105b-41f8-b302-c5b91ebc794d' AND ended_at IS NULL AND deleted_at IS NULL;
INSERT INTO record_change_log (id, record_table, record_id, field, old_value, new_value, actor_person_id, reason, changed_at)
SELECT 'c2e9d7e3-6d01-5dd6-a746-809cc612648a', 'silo_loads', 'df540fb7-a35b-4267-b5bb-e90cbd368452', 'deleted_at', NULL, '2026-09-23T23:30:00.000Z', '7b59cf6b-04b6-4742-bb1b-78a28b593fe8', 'repair 2026-09-23 (canon 0.30.213), Patrick''s notes of the 23rd: the phantom lot 26040 leaves the Blast Freezer(s) space; its running load is voided', '2026-09-23T23:30:00.000Z'
WHERE NOT EXISTS (SELECT 1 FROM record_change_log WHERE record_table = 'silo_loads' AND record_id = 'df540fb7-a35b-4267-b5bb-e90cbd368452' AND field = 'deleted_at' AND reason = 'repair 2026-09-23 (canon 0.30.213), Patrick''s notes of the 23rd: the phantom lot 26040 leaves the Blast Freezer(s) space; its running load is voided');
UPDATE unload_sessions SET deleted_at = '2026-09-23T23:30:00.000Z', deleted_by = '7b59cf6b-04b6-4742-bb1b-78a28b593fe8', updated_at = '2026-09-23T23:30:00.000Z', updated_by = '7b59cf6b-04b6-4742-bb1b-78a28b593fe8'
WHERE id = 'c4bfa487-0f28-42dd-9e17-a17eae9b8b38' AND wet_weight_entry_id = 'e1fc7a59-105b-41f8-b302-c5b91ebc794d' AND finished_at IS NULL AND deleted_at IS NULL;
INSERT INTO record_change_log (id, record_table, record_id, field, old_value, new_value, actor_person_id, reason, changed_at)
SELECT '4d38d185-818e-5d9c-8f1d-cf2cc3abea22', 'unload_sessions', 'c4bfa487-0f28-42dd-9e17-a17eae9b8b38', 'deleted_at', NULL, '2026-09-23T23:30:00.000Z', '7b59cf6b-04b6-4742-bb1b-78a28b593fe8', 'repair 2026-09-23 (canon 0.30.213), Patrick''s notes of the 23rd: the unfinished unload session opened on the phantom lot 26040 is voided', '2026-09-23T23:30:00.000Z'
WHERE NOT EXISTS (SELECT 1 FROM record_change_log WHERE record_table = 'unload_sessions' AND record_id = 'c4bfa487-0f28-42dd-9e17-a17eae9b8b38' AND field = 'deleted_at' AND reason = 'repair 2026-09-23 (canon 0.30.213), Patrick''s notes of the 23rd: the unfinished unload session opened on the phantom lot 26040 is voided');
UPDATE local_inventory_items SET deleted_at = '2026-09-23T23:30:00.000Z', deleted_by = '7b59cf6b-04b6-4742-bb1b-78a28b593fe8', delete_reason = 'repair 2026-09-23 (canon 0.30.213), Patrick''s notes of the 23rd: the 5,655,823 g born package 26040 leaves the ledger; its grams ride under 26036 to 26039', updated_at = '2026-09-23T23:30:00.000Z', updated_by = '7b59cf6b-04b6-4742-bb1b-78a28b593fe8'
WHERE id = '511fafb8-5544-45e4-a4de-4eae9ab7099b' AND wet_weight_entry_id = 'e1fc7a59-105b-41f8-b302-c5b91ebc794d' AND package_code = '26040' AND qty = 5655823 AND deleted_at IS NULL;
INSERT INTO record_change_log (id, record_table, record_id, field, old_value, new_value, actor_person_id, reason, changed_at)
SELECT 'e86591b6-942f-55db-b653-3e0d259e2e38', 'local_inventory_items', '511fafb8-5544-45e4-a4de-4eae9ab7099b', 'deleted_at', NULL, '2026-09-23T23:30:00.000Z', '7b59cf6b-04b6-4742-bb1b-78a28b593fe8', 'repair 2026-09-23 (canon 0.30.213), Patrick''s notes of the 23rd: the 5,655,823 g born package 26040 leaves the ledger; its grams ride under 26036 to 26039', '2026-09-23T23:30:00.000Z'
WHERE NOT EXISTS (SELECT 1 FROM record_change_log WHERE record_table = 'local_inventory_items' AND record_id = '511fafb8-5544-45e4-a4de-4eae9ab7099b' AND field = 'deleted_at' AND reason = 'repair 2026-09-23 (canon 0.30.213), Patrick''s notes of the 23rd: the 5,655,823 g born package 26040 leaves the ledger; its grams ride under 26036 to 26039');
UPDATE wet_weight_entries SET deleted_at = '2026-09-23T23:30:00.000Z', deleted_by = '7b59cf6b-04b6-4742-bb1b-78a28b593fe8', updated_at = '2026-09-23T23:30:00.000Z', updated_by = '7b59cf6b-04b6-4742-bb1b-78a28b593fe8'
WHERE id = 'e1fc7a59-105b-41f8-b302-c5b91ebc794d' AND harvest_batch_id = '98acb943-3c55-4c51-b3e4-7bebabf615ac' AND weight_grams = 5655823 AND status = 'drying' AND deleted_at IS NULL;
INSERT INTO record_change_log (id, record_table, record_id, field, old_value, new_value, actor_person_id, reason, changed_at)
SELECT '8cbcb07f-aeca-5747-9b2b-4ddc254870e3', 'wet_weight_entries', 'e1fc7a59-105b-41f8-b302-c5b91ebc794d', 'deleted_at', NULL, '2026-09-23T23:30:00.000Z', '7b59cf6b-04b6-4742-bb1b-78a28b593fe8', 'repair 2026-09-23 (canon 0.30.213), Patrick''s notes of the 23rd: the phantom lot 26040 is voided; its 740 tote rows stay attached for the record', '2026-09-23T23:30:00.000Z'
WHERE NOT EXISTS (SELECT 1 FROM record_change_log WHERE record_table = 'wet_weight_entries' AND record_id = 'e1fc7a59-105b-41f8-b302-c5b91ebc794d' AND field = 'deleted_at' AND reason = 'repair 2026-09-23 (canon 0.30.213), Patrick''s notes of the 23rd: the phantom lot 26040 is voided; its 740 tote rows stay attached for the record');
UPDATE harvest_batches SET deleted_at = '2026-09-23T23:30:00.000Z', deleted_by = '7b59cf6b-04b6-4742-bb1b-78a28b593fe8', updated_at = '2026-09-23T23:30:00.000Z', updated_by = '7b59cf6b-04b6-4742-bb1b-78a28b593fe8'
WHERE id = '98acb943-3c55-4c51-b3e4-7bebabf615ac' AND hbn = '26265-ARL-OD-009-0-04-26040' AND status = 'open' AND deleted_at IS NULL;
INSERT INTO record_change_log (id, record_table, record_id, field, old_value, new_value, actor_person_id, reason, changed_at)
SELECT 'f031483e-3308-5601-8141-10d923bd2833', 'harvest_batches', '98acb943-3c55-4c51-b3e4-7bebabf615ac', 'deleted_at', NULL, '2026-09-23T23:30:00.000Z', '7b59cf6b-04b6-4742-bb1b-78a28b593fe8', 'repair 2026-09-23 (canon 0.30.213), Patrick''s notes of the 23rd: the phantom HBN 26040 is voided; serial 26040 stays used', '2026-09-23T23:30:00.000Z'
WHERE NOT EXISTS (SELECT 1 FROM record_change_log WHERE record_table = 'harvest_batches' AND record_id = '98acb943-3c55-4c51-b3e4-7bebabf615ac' AND field = 'deleted_at' AND reason = 'repair 2026-09-23 (canon 0.30.213), Patrick''s notes of the 23rd: the phantom HBN 26040 is voided; serial 26040 stays used');

-- D. Lot 26045 (26266-PNN-OD-070-0-04-26045): 6,411,185 g to 3,594,528 g by one negative correction tote of -2,816,657 g
--    (the totes still sum to the header); the lot moves from Silo 4 to Silo 3 and finishes (weighing to drying, the
--    app's own finish transition for a silo lot) so Load Dry Space lists it; its ledger item follows the header. The
--    HBN's planned silo is already 3; the string's -04- is METRC's to name (0.30.203) and is not touched.
INSERT INTO wet_weights (id, wet_weight_entry_id, weight_grams, created_at, created_by, updated_at, updated_by, deleted_at, deleted_by)
SELECT '15f1419a-3229-593d-bf3f-081637760beb', '107e85ff-43e8-4f80-87b3-480553bd2586', -2816657, '2026-09-23T23:30:00.000Z', '7b59cf6b-04b6-4742-bb1b-78a28b593fe8', '2026-09-23T23:30:00.000Z', '7b59cf6b-04b6-4742-bb1b-78a28b593fe8', NULL, NULL
WHERE EXISTS (SELECT 1 FROM wet_weight_entries WHERE id = '107e85ff-43e8-4f80-87b3-480553bd2586' AND weight_grams = 6411185 AND deleted_at IS NULL)
  AND NOT EXISTS (SELECT 1 FROM wet_weights WHERE id = '15f1419a-3229-593d-bf3f-081637760beb');
INSERT INTO record_change_log (id, record_table, record_id, field, old_value, new_value, actor_person_id, reason, changed_at)
SELECT 'd2958061-40f0-5f78-8b76-e3ecc3e9591a', 'wet_weights', '15f1419a-3229-593d-bf3f-081637760beb', 'weight_grams', NULL, '-2816657', '7b59cf6b-04b6-4742-bb1b-78a28b593fe8', 'repair 2026-09-23 (canon 0.30.213), Patrick''s notes of the 23rd: 26045 needs 3,594,528 g and Silo 3; one negative correction tote of -2,816,657 g, the header 6,411,185 to 3,594,528 g, the lot from Silo 4 to Silo 3 and finished (drying) so Load Dry Space lists it', '2026-09-23T23:30:00.000Z'
WHERE NOT EXISTS (SELECT 1 FROM record_change_log WHERE record_table = 'wet_weights' AND record_id = '15f1419a-3229-593d-bf3f-081637760beb' AND field = 'weight_grams' AND reason = 'repair 2026-09-23 (canon 0.30.213), Patrick''s notes of the 23rd: 26045 needs 3,594,528 g and Silo 3; one negative correction tote of -2,816,657 g, the header 6,411,185 to 3,594,528 g, the lot from Silo 4 to Silo 3 and finished (drying) so Load Dry Space lists it');
UPDATE wet_weight_entries SET weight_grams = 3594528, actual_dryspc = 'a1000001-0001-4000-8000-000000000003', status = 'drying', updated_at = '2026-09-23T23:30:00.000Z', updated_by = '7b59cf6b-04b6-4742-bb1b-78a28b593fe8'
WHERE id = '107e85ff-43e8-4f80-87b3-480553bd2586' AND weight_grams = 6411185 AND actual_dryspc = 'a1000001-0001-4000-8000-000000000004' AND status = 'weighing' AND deleted_at IS NULL;
INSERT INTO record_change_log (id, record_table, record_id, field, old_value, new_value, actor_person_id, reason, changed_at)
SELECT 'aa3f3405-4991-5c2b-9630-fc640c0b086a', 'wet_weight_entries', '107e85ff-43e8-4f80-87b3-480553bd2586', 'weight_grams', '6411185', '3594528', '7b59cf6b-04b6-4742-bb1b-78a28b593fe8', 'repair 2026-09-23 (canon 0.30.213), Patrick''s notes of the 23rd: 26045 needs 3,594,528 g and Silo 3; one negative correction tote of -2,816,657 g, the header 6,411,185 to 3,594,528 g, the lot from Silo 4 to Silo 3 and finished (drying) so Load Dry Space lists it', '2026-09-23T23:30:00.000Z'
WHERE NOT EXISTS (SELECT 1 FROM record_change_log WHERE record_table = 'wet_weight_entries' AND record_id = '107e85ff-43e8-4f80-87b3-480553bd2586' AND field = 'weight_grams' AND reason = 'repair 2026-09-23 (canon 0.30.213), Patrick''s notes of the 23rd: 26045 needs 3,594,528 g and Silo 3; one negative correction tote of -2,816,657 g, the header 6,411,185 to 3,594,528 g, the lot from Silo 4 to Silo 3 and finished (drying) so Load Dry Space lists it');
INSERT INTO record_change_log (id, record_table, record_id, field, old_value, new_value, actor_person_id, reason, changed_at)
SELECT '7d82095a-a114-5999-b052-053a6468c120', 'wet_weight_entries', '107e85ff-43e8-4f80-87b3-480553bd2586', 'actual_dryspc', 'a1000001-0001-4000-8000-000000000004', 'a1000001-0001-4000-8000-000000000003', '7b59cf6b-04b6-4742-bb1b-78a28b593fe8', 'repair 2026-09-23 (canon 0.30.213), Patrick''s notes of the 23rd: 26045 needs 3,594,528 g and Silo 3; one negative correction tote of -2,816,657 g, the header 6,411,185 to 3,594,528 g, the lot from Silo 4 to Silo 3 and finished (drying) so Load Dry Space lists it', '2026-09-23T23:30:00.000Z'
WHERE NOT EXISTS (SELECT 1 FROM record_change_log WHERE record_table = 'wet_weight_entries' AND record_id = '107e85ff-43e8-4f80-87b3-480553bd2586' AND field = 'actual_dryspc' AND reason = 'repair 2026-09-23 (canon 0.30.213), Patrick''s notes of the 23rd: 26045 needs 3,594,528 g and Silo 3; one negative correction tote of -2,816,657 g, the header 6,411,185 to 3,594,528 g, the lot from Silo 4 to Silo 3 and finished (drying) so Load Dry Space lists it');
INSERT INTO record_change_log (id, record_table, record_id, field, old_value, new_value, actor_person_id, reason, changed_at)
SELECT 'a366f468-9fbf-5f72-a696-80e904859cf9', 'wet_weight_entries', '107e85ff-43e8-4f80-87b3-480553bd2586', 'status', 'weighing', 'drying', '7b59cf6b-04b6-4742-bb1b-78a28b593fe8', 'repair 2026-09-23 (canon 0.30.213), Patrick''s notes of the 23rd: 26045 needs 3,594,528 g and Silo 3; one negative correction tote of -2,816,657 g, the header 6,411,185 to 3,594,528 g, the lot from Silo 4 to Silo 3 and finished (drying) so Load Dry Space lists it', '2026-09-23T23:30:00.000Z'
WHERE NOT EXISTS (SELECT 1 FROM record_change_log WHERE record_table = 'wet_weight_entries' AND record_id = '107e85ff-43e8-4f80-87b3-480553bd2586' AND field = 'status' AND reason = 'repair 2026-09-23 (canon 0.30.213), Patrick''s notes of the 23rd: 26045 needs 3,594,528 g and Silo 3; one negative correction tote of -2,816,657 g, the header 6,411,185 to 3,594,528 g, the lot from Silo 4 to Silo 3 and finished (drying) so Load Dry Space lists it');
UPDATE local_inventory_items SET qty = 3594528, updated_at = '2026-09-23T23:30:00.000Z', updated_by = '7b59cf6b-04b6-4742-bb1b-78a28b593fe8'
WHERE id = 'e3b8ed53-2e60-4f4f-9a7b-883c13280ca6' AND wet_weight_entry_id = '107e85ff-43e8-4f80-87b3-480553bd2586' AND qty = 6411185 AND deleted_at IS NULL;
INSERT INTO record_change_log (id, record_table, record_id, field, old_value, new_value, actor_person_id, reason, changed_at)
SELECT '2971c628-cbaa-5cbe-8b5a-a1930f8f5742', 'local_inventory_items', 'e3b8ed53-2e60-4f4f-9a7b-883c13280ca6', 'qty', '6411185', '3594528', '7b59cf6b-04b6-4742-bb1b-78a28b593fe8', 'repair 2026-09-23 (canon 0.30.213), Patrick''s notes of the 23rd: 26045 needs 3,594,528 g and Silo 3; one negative correction tote of -2,816,657 g, the header 6,411,185 to 3,594,528 g, the lot from Silo 4 to Silo 3 and finished (drying) so Load Dry Space lists it', '2026-09-23T23:30:00.000Z'
WHERE NOT EXISTS (SELECT 1 FROM record_change_log WHERE record_table = 'local_inventory_items' AND record_id = 'e3b8ed53-2e60-4f4f-9a7b-883c13280ca6' AND field = 'qty' AND reason = 'repair 2026-09-23 (canon 0.30.213), Patrick''s notes of the 23rd: 26045 needs 3,594,528 g and Silo 3; one negative correction tote of -2,816,657 g, the header 6,411,185 to 3,594,528 g, the lot from Silo 4 to Silo 3 and finished (drying) so Load Dry Space lists it');

-- E. Lot 26048 (26266-PNN-OD-070-0-03-26048): 0 g to 2,824,272 g by one correction tote; the lot finishes (weighing to
--    drying) on Silo 3, where it already stands; its born package (a WIP ledger item at BARN under the PNN grow license,
--    the shape Finish lot gives every silo lot) is inserted because Finish lot never ran on it.
INSERT INTO wet_weights (id, wet_weight_entry_id, weight_grams, created_at, created_by, updated_at, updated_by, deleted_at, deleted_by)
SELECT 'b6fe928f-4f19-5c43-8bac-cc91f231a7ed', 'f7e7e2b6-caec-413c-939d-a8a13c1b36e1', 2824272, '2026-09-23T23:30:00.000Z', '7b59cf6b-04b6-4742-bb1b-78a28b593fe8', '2026-09-23T23:30:00.000Z', '7b59cf6b-04b6-4742-bb1b-78a28b593fe8', NULL, NULL
WHERE EXISTS (SELECT 1 FROM wet_weight_entries WHERE id = 'f7e7e2b6-caec-413c-939d-a8a13c1b36e1' AND weight_grams = 0 AND status = 'weighing' AND deleted_at IS NULL)
  AND NOT EXISTS (SELECT 1 FROM wet_weights WHERE id = 'b6fe928f-4f19-5c43-8bac-cc91f231a7ed');
INSERT INTO record_change_log (id, record_table, record_id, field, old_value, new_value, actor_person_id, reason, changed_at)
SELECT '02d3b631-ce4f-5a2e-9b46-388210487140', 'wet_weights', 'b6fe928f-4f19-5c43-8bac-cc91f231a7ed', 'weight_grams', NULL, '2824272', '7b59cf6b-04b6-4742-bb1b-78a28b593fe8', 'repair 2026-09-23 (canon 0.30.213), Patrick''s notes of the 23rd: 26048 needs 2,824,272 g in Silo 3; one correction tote of 2,824,272 g, the header 0 to 2,824,272 g, the lot finished (drying) so Load Dry Space lists it, and its born package 26048 at BARN as Finish lot would have made it', '2026-09-23T23:30:00.000Z'
WHERE NOT EXISTS (SELECT 1 FROM record_change_log WHERE record_table = 'wet_weights' AND record_id = 'b6fe928f-4f19-5c43-8bac-cc91f231a7ed' AND field = 'weight_grams' AND reason = 'repair 2026-09-23 (canon 0.30.213), Patrick''s notes of the 23rd: 26048 needs 2,824,272 g in Silo 3; one correction tote of 2,824,272 g, the header 0 to 2,824,272 g, the lot finished (drying) so Load Dry Space lists it, and its born package 26048 at BARN as Finish lot would have made it');
UPDATE wet_weight_entries SET weight_grams = 2824272, status = 'drying', updated_at = '2026-09-23T23:30:00.000Z', updated_by = '7b59cf6b-04b6-4742-bb1b-78a28b593fe8'
WHERE id = 'f7e7e2b6-caec-413c-939d-a8a13c1b36e1' AND weight_grams = 0 AND actual_dryspc = 'a1000001-0001-4000-8000-000000000003' AND status = 'weighing' AND deleted_at IS NULL;
INSERT INTO record_change_log (id, record_table, record_id, field, old_value, new_value, actor_person_id, reason, changed_at)
SELECT '5cbf7b83-dff9-5b63-a4c2-37b037b5cdf4', 'wet_weight_entries', 'f7e7e2b6-caec-413c-939d-a8a13c1b36e1', 'weight_grams', '0', '2824272', '7b59cf6b-04b6-4742-bb1b-78a28b593fe8', 'repair 2026-09-23 (canon 0.30.213), Patrick''s notes of the 23rd: 26048 needs 2,824,272 g in Silo 3; one correction tote of 2,824,272 g, the header 0 to 2,824,272 g, the lot finished (drying) so Load Dry Space lists it, and its born package 26048 at BARN as Finish lot would have made it', '2026-09-23T23:30:00.000Z'
WHERE NOT EXISTS (SELECT 1 FROM record_change_log WHERE record_table = 'wet_weight_entries' AND record_id = 'f7e7e2b6-caec-413c-939d-a8a13c1b36e1' AND field = 'weight_grams' AND reason = 'repair 2026-09-23 (canon 0.30.213), Patrick''s notes of the 23rd: 26048 needs 2,824,272 g in Silo 3; one correction tote of 2,824,272 g, the header 0 to 2,824,272 g, the lot finished (drying) so Load Dry Space lists it, and its born package 26048 at BARN as Finish lot would have made it');
INSERT INTO record_change_log (id, record_table, record_id, field, old_value, new_value, actor_person_id, reason, changed_at)
SELECT 'bad935ee-3fb2-5007-9887-8fd896c52428', 'wet_weight_entries', 'f7e7e2b6-caec-413c-939d-a8a13c1b36e1', 'status', 'weighing', 'drying', '7b59cf6b-04b6-4742-bb1b-78a28b593fe8', 'repair 2026-09-23 (canon 0.30.213), Patrick''s notes of the 23rd: 26048 needs 2,824,272 g in Silo 3; one correction tote of 2,824,272 g, the header 0 to 2,824,272 g, the lot finished (drying) so Load Dry Space lists it, and its born package 26048 at BARN as Finish lot would have made it', '2026-09-23T23:30:00.000Z'
WHERE NOT EXISTS (SELECT 1 FROM record_change_log WHERE record_table = 'wet_weight_entries' AND record_id = 'f7e7e2b6-caec-413c-939d-a8a13c1b36e1' AND field = 'status' AND reason = 'repair 2026-09-23 (canon 0.30.213), Patrick''s notes of the 23rd: 26048 needs 2,824,272 g in Silo 3; one correction tote of 2,824,272 g, the header 0 to 2,824,272 g, the lot finished (drying) so Load Dry Space lists it, and its born package 26048 at BARN as Finish lot would have made it');
INSERT INTO local_inventory_items (id, item_kind, package_code, harvest_batch_id, wet_weight_entry_id, wip_package_id, strain_id, qty, uom, farm_code, license_value, location, created_at, created_by, updated_at, updated_by, deleted_at, deleted_by, delete_reason, parent_item_id, metrc_tag)
SELECT '19900c67-6e5b-530a-b1f3-9bd2f4b4e815', 'WIP', '26048', 'c800bafa-cee8-4494-baf0-2c8b71d540c3', 'f7e7e2b6-caec-413c-939d-a8a13c1b36e1', NULL, '4c040bf9-0a62-4809-9520-2edbfcbc1f64', 2824272, 'g', 'PNN', 'AU-G-C-000832', 'BARN', '2026-09-23T23:30:00.000Z', '7b59cf6b-04b6-4742-bb1b-78a28b593fe8', '2026-09-23T23:30:00.000Z', '7b59cf6b-04b6-4742-bb1b-78a28b593fe8', NULL, NULL, NULL, NULL, NULL
WHERE EXISTS (SELECT 1 FROM wet_weight_entries WHERE id = 'f7e7e2b6-caec-413c-939d-a8a13c1b36e1' AND harvest_batch_id = 'c800bafa-cee8-4494-baf0-2c8b71d540c3' AND deleted_at IS NULL)
  AND NOT EXISTS (SELECT 1 FROM local_inventory_items WHERE id = '19900c67-6e5b-530a-b1f3-9bd2f4b4e815')
  AND NOT EXISTS (SELECT 1 FROM local_inventory_items WHERE wet_weight_entry_id = 'f7e7e2b6-caec-413c-939d-a8a13c1b36e1' AND deleted_at IS NULL);
INSERT INTO record_change_log (id, record_table, record_id, field, old_value, new_value, actor_person_id, reason, changed_at)
SELECT 'f9259619-0254-5417-985f-8aaf10ae24f7', 'local_inventory_items', '19900c67-6e5b-530a-b1f3-9bd2f4b4e815', 'qty', NULL, '2824272', '7b59cf6b-04b6-4742-bb1b-78a28b593fe8', 'repair 2026-09-23 (canon 0.30.213), Patrick''s notes of the 23rd: 26048 needs 2,824,272 g in Silo 3; one correction tote of 2,824,272 g, the header 0 to 2,824,272 g, the lot finished (drying) so Load Dry Space lists it, and its born package 26048 at BARN as Finish lot would have made it', '2026-09-23T23:30:00.000Z'
WHERE NOT EXISTS (SELECT 1 FROM record_change_log WHERE record_table = 'local_inventory_items' AND record_id = '19900c67-6e5b-530a-b1f3-9bd2f4b4e815' AND field = 'qty' AND reason = 'repair 2026-09-23 (canon 0.30.213), Patrick''s notes of the 23rd: 26048 needs 2,824,272 g in Silo 3; one correction tote of 2,824,272 g, the header 0 to 2,824,272 g, the lot finished (drying) so Load Dry Space lists it, and its born package 26048 at BARN as Finish lot would have made it');

-- F. Untouched on purpose: 26041 (loaded into Silo 5 at 13:15Z after Patrick's 6 AM Hold, 635 tags, 5,179,192 g as
--    his table reads); the dry weights and the dry ledger items of 26036, 26037 and 26038; 26039's running Silo 4 load
--    and its open unload session; 26042 and 26043 (today's ARL lots, not on Patrick's table); 26044 (165,387 g weighing
--    in the Blast Freezer space) and 26047 (224,725 g unloaded on Hang in Place); the voided 26046; the 740 tote rows and
--    the 635 shared tags of 26040; the HBN strings (METRC's to name, 0.30.203); every other row on the floor.
-- End of repair. Expected effect on a clean pre snapshot (45 statements): 6 tote rows inserted, 1 ledger item inserted,
-- 764 plant tags moved by one statement, 13 other rows updated, 24 log rows; a second run changes nothing.
