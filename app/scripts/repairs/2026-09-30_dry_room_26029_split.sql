-- THE INTERVENTION ON LOTS 26027 AND 26029 (canon 0.30.315). The crew, 2026-09-29 17:40, on typing the dry
-- weights: 26027 reads 302,510 g dry on 8,280,388 g wet; 26029 reads 1,244,555 g dry on 425,554 g wet, 819,001 g
-- over; on the day the HBNs were minted 26029 was minted by mistake and should have been part of 26028, and 26028
-- got combined with 26027 instead of 26029 being added to 26028. The 20:46 snapshot
-- (db_backups/20260929-204612_pre_trimming_tidies, dumped 2026-09-30T00:46:15Z) shows: 26027 (lot 505edf53) at
-- 8,280,388 g wet, its own 351 totes 1,623,541 g plus the correction tote of 6,656,847 g the repair of canon
-- 0.30.180 added on 2026-09-22 when METRC held 26028 under 26027; unloaded 2026-09-29T21:33Z with 18 dry rows,
-- 302,510 g (18.6 percent of its own wet); 26028 (lot 705c259f) voided by that repair, its 925 totes attached,
-- its 744 plant tags on 26027. 26029 (lot 345bdebf, minted ID under GR-C-002600) at 425,554 g wet from 57 totes,
-- its unload finished 2026-09-29T21:22Z with 450 dry rows, 1,244,555 g (17.6 percent of 28 and 29 together,
-- 7,082,401 g), the gate over-issued by 819,001 g, the choice queue_adjust, the born package 4c3ef27e set to
-- 1,244,555 g at ARL BARN, then demoted to drying at 21:36 with a second session 5ae27b1b opened and unfinished.
-- The Arlington Dry Room is kind silo, so the unload plan is the silo plan: the born package takes the dry total
-- and the package_adjustments file reads the newest inv_unload_adjust row on it (new less old).
--
-- Every statement is guarded by the value it expects, so a second run changes nothing; every change lands in
-- record_change_log under the owner's login with this repair's reason. Soft voids only, no created_at edited.
-- Run from app/ at the owner's keyboard:
--   node scripts/repair-apply.mjs scripts/repairs/2026-09-30_dry_room_26029_split.sql
-- Then: node scripts/db-snapshot.mjs post_dry_room_26029
--
-- SHAPE A, METRC HAS A HARVEST 26029: the pile's 1,244,555 g split pro rata by wet weight, 26028's share
-- 1,169,775 g (6,656,847 over 7,082,401) to lot 26027 and 26029's share 74,780 g staying on 26029, both
-- lots unloaded with the figures METRC can take: 26027 1,472,285 g dry on 8,280,388 g wet (17.8 percent),
-- 26029 74,780 g dry on 425,554 g wet (17.6 percent).
-- A. 419 of 26029's 450 live dry rows (an exact subset summing to 26028's share) move to lot 26027 and its finished
--    session; the 31 rows that stay sum to 26029's share. One log row on each lot records the move.
UPDATE dry_weights SET wet_weight_entry_id = '505edf53-4413-4836-9b14-047728c0c4a0', session_id = 'b96f5a50-2cf7-4f5b-9da9-875b9fc27907', updated_at = '2026-09-30T02:30:00.000Z', updated_by = '7b59cf6b-04b6-4742-bb1b-78a28b593fe8'
WHERE wet_weight_entry_id = '345bdebf-e29b-4ed2-ae77-162a128fd4d9' AND deleted_at IS NULL
  AND id NOT IN ('6c0453dd-90f1-45e7-9cf1-a77c5e05b8b9', 'e451a714-bec4-4c85-8e1b-90414b448f52', '48a7a9c0-0b5b-4f56-a554-f3704908eec6', '660c4f38-2f97-4f01-a449-4e19d546e0e7', '77f42f58-2fd7-4c8e-914c-8c1257aa4ee9', '70aadab1-ec10-4af8-ada4-256e46da6d37', '1504100e-2007-49f7-8515-775a26515c9f', '34f04bbc-8ede-4905-b7f0-7b6b9fe1e5e0', '5d4473fe-4ddf-4b9c-9c8b-ed360187425a', '762351d3-e30c-486e-91b3-5f41e69d860b', '1be90363-17c2-4c3a-bb92-0ae573c37893', '56fe9551-c9d2-4f5f-a5af-895eaf366602', 'c24da74c-15c8-4f6c-b669-e090209fc451', '6c4a3875-7b64-4710-bc86-3dffbb8fe50f', '338d1c90-8f6e-4c1c-9cb4-26a1bef6cc1d', 'f64fb333-ec41-4abb-bc56-cf153075e97e', '9ebbc94d-ac76-4004-83c0-1e23db4bf3d4', 'cc0eedb5-293d-4e3d-ba88-2d0a6d217b77', '6c25e956-5c3a-44cc-b9a8-0e4076037ea5', '051489cd-f583-4c56-8cbe-d065a38d676f', 'a3de9c37-476b-4260-aa6f-f1be4201f0a4', '5d3fe540-c209-4ee9-be62-f7d5f3c95640', '490ff23c-9be6-41fc-a56e-601f36a00285', '066a1a45-1d49-4490-b479-8a27ec6c0b44', 'ef2ea26f-af45-4804-b429-2d01808b630a', '5b967568-3c42-40f9-b304-97eedd44547d', '083e7fac-a2b8-432e-a1fa-61bd96e40d0e', '7ad6b481-d577-4d9d-9fec-49ac5f45679f', 'f262c5fc-8a32-4388-b9a1-59f6ab7867b6', 'd161bf48-eed7-40b8-854c-ba3eab71a427', 'cf9cbaa1-ba9a-4a54-9517-5287f2fbfa9c')
  AND EXISTS (SELECT 1 FROM wet_weight_entries WHERE id = '505edf53-4413-4836-9b14-047728c0c4a0' AND status = 'unloaded' AND deleted_at IS NULL);
INSERT INTO record_change_log (id, record_table, record_id, field, old_value, new_value, actor_person_id, reason, changed_at)
SELECT '76995ef3-7aea-5ed9-b9f7-ddad5abb30fb', 'wet_weight_entries', '345bdebf-e29b-4ed2-ae77-162a128fd4d9', 'dry_weights', '450 rows, 1244555 g', '31 rows, 74780 g', '7b59cf6b-04b6-4742-bb1b-78a28b593fe8', 'repair 2026-09-30 (canon 0.30.315), the Arlington Dry Room: the pile weighed as 26029 is 26028 and 26029 dried together and METRC holds 26028 under 26027: 419 dry rows, 1,169,775 g, the pro rata share of 26028, leave lot 26029 for lot 26027; 31 rows, 74,780 g, stay', '2026-09-30T02:30:00.000Z'
WHERE NOT EXISTS (SELECT 1 FROM record_change_log WHERE record_table = 'wet_weight_entries' AND record_id = '345bdebf-e29b-4ed2-ae77-162a128fd4d9' AND field = 'dry_weights' AND reason = 'repair 2026-09-30 (canon 0.30.315), the Arlington Dry Room: the pile weighed as 26029 is 26028 and 26029 dried together and METRC holds 26028 under 26027: 419 dry rows, 1,169,775 g, the pro rata share of 26028, leave lot 26029 for lot 26027; 31 rows, 74,780 g, stay');
INSERT INTO record_change_log (id, record_table, record_id, field, old_value, new_value, actor_person_id, reason, changed_at)
SELECT '03a92be6-6310-5c8a-830a-f890b64d7a00', 'wet_weight_entries', '505edf53-4413-4836-9b14-047728c0c4a0', 'dry_weights', '18 rows, 302510 g', '437 rows, 1472285 g', '7b59cf6b-04b6-4742-bb1b-78a28b593fe8', 'repair 2026-09-30 (canon 0.30.315), the Arlington Dry Room: the pile weighed as 26029 is 26028 and 26029 dried together and METRC holds 26028 under 26027: lot 26027 takes 419 dry rows, 1,169,775 g, weighed as 26029; 437 rows, 1,472,285 g', '2026-09-30T02:30:00.000Z'
WHERE NOT EXISTS (SELECT 1 FROM record_change_log WHERE record_table = 'wet_weight_entries' AND record_id = '505edf53-4413-4836-9b14-047728c0c4a0' AND field = 'dry_weights' AND reason = 'repair 2026-09-30 (canon 0.30.315), the Arlington Dry Room: the pile weighed as 26029 is 26028 and 26029 dried together and METRC holds 26028 under 26027: lot 26027 takes 419 dry rows, 1,169,775 g, weighed as 26029; 437 rows, 1,472,285 g');

-- B. The lot headers: 26027 dry 302,510 to 1,472,285 g; 26029 dry 1,244,555 to 74,780 g and back to unloaded, the
--    unload of 21:22 standing with the corrected figures (the demote of 21:36 was the crew's alarm, not a return
--    of the material to the room).
UPDATE wet_weight_entries SET dry_weight_grams = 1472285, updated_at = '2026-09-30T02:30:00.000Z', updated_by = '7b59cf6b-04b6-4742-bb1b-78a28b593fe8'
WHERE id = '505edf53-4413-4836-9b14-047728c0c4a0' AND harvest_batch_id = 'bdfa8533-d7fe-46c2-b7e3-5df302e05874' AND dry_weight_grams = 302510 AND status = 'unloaded' AND deleted_at IS NULL;
INSERT INTO record_change_log (id, record_table, record_id, field, old_value, new_value, actor_person_id, reason, changed_at)
SELECT '77d8158a-ec42-57f0-8567-d6f2a1fb8e74', 'wet_weight_entries', '505edf53-4413-4836-9b14-047728c0c4a0', 'dry_weight_grams', '302510', '1472285', '7b59cf6b-04b6-4742-bb1b-78a28b593fe8', 'repair 2026-09-30 (canon 0.30.315), the Arlington Dry Room: the pile weighed as 26029 is 26028 and 26029 dried together and METRC holds 26028 under 26027: lot 26027 dry weight 302,510 g to 1,472,285 g', '2026-09-30T02:30:00.000Z'
WHERE NOT EXISTS (SELECT 1 FROM record_change_log WHERE record_table = 'wet_weight_entries' AND record_id = '505edf53-4413-4836-9b14-047728c0c4a0' AND field = 'dry_weight_grams' AND reason = 'repair 2026-09-30 (canon 0.30.315), the Arlington Dry Room: the pile weighed as 26029 is 26028 and 26029 dried together and METRC holds 26028 under 26027: lot 26027 dry weight 302,510 g to 1,472,285 g');
UPDATE wet_weight_entries SET dry_weight_grams = 74780, status = 'unloaded', updated_at = '2026-09-30T02:30:00.000Z', updated_by = '7b59cf6b-04b6-4742-bb1b-78a28b593fe8'
WHERE id = '345bdebf-e29b-4ed2-ae77-162a128fd4d9' AND harvest_batch_id = 'd036793f-dbae-42b4-a63b-d99e8d9d8b3e' AND dry_weight_grams = 1244555 AND status = 'drying' AND deleted_at IS NULL;
INSERT INTO record_change_log (id, record_table, record_id, field, old_value, new_value, actor_person_id, reason, changed_at)
SELECT 'c671366c-10e7-58df-ac6f-117808faec38', 'wet_weight_entries', '345bdebf-e29b-4ed2-ae77-162a128fd4d9', 'dry_weight_grams', '1244555', '74780', '7b59cf6b-04b6-4742-bb1b-78a28b593fe8', 'repair 2026-09-30 (canon 0.30.315), the Arlington Dry Room: the pile weighed as 26029 is 26028 and 26029 dried together and METRC holds 26028 under 26027: lot 26029 dry weight 1,244,555 g to 74,780 g, its own share', '2026-09-30T02:30:00.000Z'
WHERE NOT EXISTS (SELECT 1 FROM record_change_log WHERE record_table = 'wet_weight_entries' AND record_id = '345bdebf-e29b-4ed2-ae77-162a128fd4d9' AND field = 'dry_weight_grams' AND reason = 'repair 2026-09-30 (canon 0.30.315), the Arlington Dry Room: the pile weighed as 26029 is 26028 and 26029 dried together and METRC holds 26028 under 26027: lot 26029 dry weight 1,244,555 g to 74,780 g, its own share');
INSERT INTO record_change_log (id, record_table, record_id, field, old_value, new_value, actor_person_id, reason, changed_at)
SELECT 'e0622e02-ef1e-509e-80fc-c6f620947066', 'wet_weight_entries', '345bdebf-e29b-4ed2-ae77-162a128fd4d9', 'status', 'drying', 'unloaded', '7b59cf6b-04b6-4742-bb1b-78a28b593fe8', 'repair 2026-09-30 (canon 0.30.315), the Arlington Dry Room: the pile weighed as 26029 is 26028 and 26029 dried together and METRC holds 26028 under 26027: lot 26029 back to unloaded, the finish of 2026-09-29T21:22Z standing with the corrected figures', '2026-09-30T02:30:00.000Z'
WHERE NOT EXISTS (SELECT 1 FROM record_change_log WHERE record_table = 'wet_weight_entries' AND record_id = '345bdebf-e29b-4ed2-ae77-162a128fd4d9' AND field = 'status' AND reason = 'repair 2026-09-30 (canon 0.30.315), the Arlington Dry Room: the pile weighed as 26029 is 26028 and 26029 dried together and METRC holds 26028 under 26027: lot 26029 back to unloaded, the finish of 2026-09-29T21:22Z standing with the corrected figures');

-- C. The born packages: 26027 (SPR at ARL BARN) 302,510 to 1,472,285 g; 26029 1,244,555 to 74,780 g. Each takes the
--    repair's log row and one more inv_unload_adjust row a second later, the whole corrected adjustment from the wet
--    package, because the package_adjustments file reads the newest such row: 26027 8,280,388 to 1,472,285
--    (minus 6,808,103 g); 26029 425,554 to 74,780 (minus 350,774 g).
UPDATE local_inventory_items SET qty = 1472285, updated_at = '2026-09-30T02:30:00.000Z', updated_by = '7b59cf6b-04b6-4742-bb1b-78a28b593fe8'
WHERE id = '35db349f-af3d-4aa4-a279-ea47792259fb' AND wet_weight_entry_id = '505edf53-4413-4836-9b14-047728c0c4a0' AND package_code = '26027' AND qty = 302510 AND location = 'ARL BARN' AND deleted_at IS NULL;
INSERT INTO record_change_log (id, record_table, record_id, field, old_value, new_value, actor_person_id, reason, changed_at)
SELECT '79337151-7199-5445-b679-33e2134910c3', 'local_inventory_items', '35db349f-af3d-4aa4-a279-ea47792259fb', 'qty', '302510', '1472285', '7b59cf6b-04b6-4742-bb1b-78a28b593fe8', 'repair 2026-09-30 (canon 0.30.315), the Arlington Dry Room: the pile weighed as 26029 is 26028 and 26029 dried together and METRC holds 26028 under 26027: the born package 26027 (SPR, at ARL BARN) 302,510 g to 1,472,285 g', '2026-09-30T02:30:00.000Z'
WHERE NOT EXISTS (SELECT 1 FROM record_change_log WHERE record_table = 'local_inventory_items' AND record_id = '35db349f-af3d-4aa4-a279-ea47792259fb' AND field = 'qty' AND reason = 'repair 2026-09-30 (canon 0.30.315), the Arlington Dry Room: the pile weighed as 26029 is 26028 and 26029 dried together and METRC holds 26028 under 26027: the born package 26027 (SPR, at ARL BARN) 302,510 g to 1,472,285 g');
INSERT INTO record_change_log (id, record_table, record_id, field, old_value, new_value, actor_person_id, reason, changed_at)
SELECT 'b1a3dbed-b471-5ac1-b0c6-9b3045315449', 'local_inventory_items', '35db349f-af3d-4aa4-a279-ea47792259fb', 'qty', '8280388', '1472285', '7b59cf6b-04b6-4742-bb1b-78a28b593fe8', 'inv_unload_adjust', '2026-09-30T02:30:01.000Z'
WHERE NOT EXISTS (SELECT 1 FROM record_change_log WHERE record_table = 'local_inventory_items' AND record_id = '35db349f-af3d-4aa4-a279-ea47792259fb' AND field = 'qty' AND reason = 'inv_unload_adjust' AND old_value = '8280388' AND new_value = '1472285');
UPDATE local_inventory_items SET qty = 74780, updated_at = '2026-09-30T02:30:00.000Z', updated_by = '7b59cf6b-04b6-4742-bb1b-78a28b593fe8'
WHERE id = '4c3ef27e-deea-437c-b6fa-ef0fadc69e41' AND wet_weight_entry_id = '345bdebf-e29b-4ed2-ae77-162a128fd4d9' AND package_code = '26029' AND qty = 1244555 AND location = 'ARL BARN' AND deleted_at IS NULL;
INSERT INTO record_change_log (id, record_table, record_id, field, old_value, new_value, actor_person_id, reason, changed_at)
SELECT '8161827b-795a-532c-a0dd-1ac803342a6d', 'local_inventory_items', '4c3ef27e-deea-437c-b6fa-ef0fadc69e41', 'qty', '1244555', '74780', '7b59cf6b-04b6-4742-bb1b-78a28b593fe8', 'repair 2026-09-30 (canon 0.30.315), the Arlington Dry Room: the pile weighed as 26029 is 26028 and 26029 dried together and METRC holds 26028 under 26027: the born package 26029 (SPR, at ARL BARN) 1,244,555 g to 74,780 g', '2026-09-30T02:30:00.000Z'
WHERE NOT EXISTS (SELECT 1 FROM record_change_log WHERE record_table = 'local_inventory_items' AND record_id = '4c3ef27e-deea-437c-b6fa-ef0fadc69e41' AND field = 'qty' AND reason = 'repair 2026-09-30 (canon 0.30.315), the Arlington Dry Room: the pile weighed as 26029 is 26028 and 26029 dried together and METRC holds 26028 under 26027: the born package 26029 (SPR, at ARL BARN) 1,244,555 g to 74,780 g');
INSERT INTO record_change_log (id, record_table, record_id, field, old_value, new_value, actor_person_id, reason, changed_at)
SELECT '3baab7ce-177b-52c6-aaed-819813604b8d', 'local_inventory_items', '4c3ef27e-deea-437c-b6fa-ef0fadc69e41', 'qty', '425554', '74780', '7b59cf6b-04b6-4742-bb1b-78a28b593fe8', 'inv_unload_adjust', '2026-09-30T02:30:01.000Z'
WHERE NOT EXISTS (SELECT 1 FROM record_change_log WHERE record_table = 'local_inventory_items' AND record_id = '4c3ef27e-deea-437c-b6fa-ef0fadc69e41' AND field = 'qty' AND reason = 'inv_unload_adjust' AND old_value = '425554' AND new_value = '74780');

-- D. The session 26029 opened after the demote is voided, never finished, so the session of 21:22 (queue_adjust)
--    stays the one that pends the package_adjustments file.
UPDATE unload_sessions SET deleted_at = '2026-09-30T02:30:00.000Z', deleted_by = '7b59cf6b-04b6-4742-bb1b-78a28b593fe8', updated_at = '2026-09-30T02:30:00.000Z', updated_by = '7b59cf6b-04b6-4742-bb1b-78a28b593fe8'
WHERE id = '5ae27b1b-1c58-4378-8e1c-67fd1561e451' AND wet_weight_entry_id = '345bdebf-e29b-4ed2-ae77-162a128fd4d9' AND finished_at IS NULL AND deleted_at IS NULL;
INSERT INTO record_change_log (id, record_table, record_id, field, old_value, new_value, actor_person_id, reason, changed_at)
SELECT '287e4c6f-5eaa-5c50-ae6d-c880d4bee591', 'unload_sessions', '5ae27b1b-1c58-4378-8e1c-67fd1561e451', 'deleted_at', NULL, '2026-09-30T02:30:00.000Z', '7b59cf6b-04b6-4742-bb1b-78a28b593fe8', 'repair 2026-09-30 (canon 0.30.315), the Arlington Dry Room: the pile weighed as 26029 is 26028 and 26029 dried together and METRC holds 26028 under 26027: the unload session opened after the demote of 2026-09-29T21:36Z is voided; the session of 21:22Z stands', '2026-09-30T02:30:00.000Z'
WHERE NOT EXISTS (SELECT 1 FROM record_change_log WHERE record_table = 'unload_sessions' AND record_id = '5ae27b1b-1c58-4378-8e1c-67fd1561e451' AND field = 'deleted_at' AND reason = 'repair 2026-09-30 (canon 0.30.315), the Arlington Dry Room: the pile weighed as 26029 is 26028 and 26029 dried together and METRC holds 26028 under 26027: the unload session opened after the demote of 2026-09-29T21:36Z is voided; the session of 21:22Z stands');
