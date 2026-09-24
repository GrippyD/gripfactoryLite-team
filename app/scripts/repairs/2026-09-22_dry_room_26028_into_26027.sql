-- THE DRY ROOM REPAIR (canon 0.30.180). Owner, 2026-09-22, verbatim: Arlington Dry Room has three lots in
-- it, but in METRC, there is no lot 26028. In reality, the sum of weights in 27 and 28 are stored under 27.
-- And 28 is defunct. Add an agent to wipe out the errant 28 and add its weight to 27.
-- His picks on the question tool, 2026-09-22: the 744 live plant tags of HBN 26028 move to HBN 26027 (his
-- words: Move them to 26027), so 26027 reads 1,158 plants at 8,280,388 g, the way METRC holds the harvest,
-- with one change-log row for the move. Wipe out is a void with a reason (the app's law): soft voids only,
-- never a hard delete.
--
-- What the pre snapshot (db_backups/20260921-234510_pre_lots_27_35, dumped 2026-09-22T03:45:12Z) shows:
-- HBN 26262-ARL-OD-009-0-NA-26027 (bdfa8533, open, planned dry space NA, minted 2026-09-19T10:44:04Z at ARL):
--   its lot 505edf53 (spear, drying, actual dry space the Arlington Dry Room a1000001-0001-4000-8000-000000000006)
--   reads 1,623,541 g from 351 live totes weighed 2026-09-19T11:36:58Z to 14:13:06Z (one voided tote of 4,132 g);
--   its open load 39a07773 (dry room clock started 2026-09-19T12:00:00Z, running); its born package 35db349f
--   (SPR 26027, 1,623,541 g, at the Arlington Dry Room); 414 live plant tags.
-- HBN 26262-ARL-OD-009-0-NA-26028 (9cbbfd71, open, minted 2026-09-19T12:03:19Z, right after 26027): its lot 705c259f
--   (spear, drying, in the dry room) reads 6,656,847 g from 925 live totes weighed 2026-09-19T14:13:33Z to
--   16:58:27Z, the minute 26027's totes ended; its open load ede97313 (dry room clock started 2026-09-19T15:00:00Z,
--   running); its born package 7e26c19a (SPR 26028, 6,656,847 g, at the Arlington Dry Room); 744 live plant tags,
--   none shared with 26027. Nothing else points at 26028: no metrc_uploads row, no unload session, no dry weight,
--   no schedule, no wip package. 1,623,541 + 6,656,847 = 8,280,388 g, the weight METRC holds under 26027.
-- HBN 26029 (lot 345bdebf at 425,554 g, load 5c295d49, package 4c3ef27e) is the room's third lot: untouched.
--
-- Every statement is guarded by the current value it expects, so a second run changes nothing; every change
-- lands in record_change_log under the owner's login with this repair's reason. The weight moves (A) and the
-- plant tags move (B) before the void (C). Postgres-portable SQL, no hard deletes, no created_at edited.
-- Run from app/ at the owner's keyboard:
--   node scripts/repair-apply.mjs scripts/repairs/2026-09-22_dry_room_26028_into_26027.sql
-- Then: node scripts/db-snapshot.mjs post_lots_27_35

-- A. 26027 takes 26028's weight. One correction tote of 6,656,847 g on lot 505edf53 (the ledger stays the sum of
--    its live totes: 351 totes at 1,623,541 g plus this row = 8,280,388 g), then the lot header, then the born package.
INSERT INTO wet_weights (id, wet_weight_entry_id, weight_grams, created_at, created_by, updated_at, updated_by, deleted_at, deleted_by)
SELECT '150d324e-3e82-4aba-ede0-04ffc958c1d3', '505edf53-4413-4836-9b14-047728c0c4a0', 6656847, '2026-09-22T04:30:00.000Z', '7b59cf6b-04b6-4742-bb1b-78a28b593fe8', '2026-09-22T04:30:00.000Z', '7b59cf6b-04b6-4742-bb1b-78a28b593fe8', NULL, NULL
WHERE EXISTS (SELECT 1 FROM wet_weight_entries WHERE id = '505edf53-4413-4836-9b14-047728c0c4a0' AND weight_grams = 1623541 AND deleted_at IS NULL)
  AND NOT EXISTS (SELECT 1 FROM wet_weights WHERE id = '150d324e-3e82-4aba-ede0-04ffc958c1d3');
INSERT INTO record_change_log (id, record_table, record_id, field, old_value, new_value, actor_person_id, reason, changed_at)
SELECT '1ec7b8b1-0b58-a6ac-9f6f-aa7f7772fd6e', 'wet_weights', '150d324e-3e82-4aba-ede0-04ffc958c1d3', 'weight_grams', NULL, '6656847', '7b59cf6b-04b6-4742-bb1b-78a28b593fe8', 'repair 2026-09-22 (canon 0.30.180), the Arlington Dry Room: METRC has no lot 26028, its weight is under 26027: the 6,656,847 g weighed as 26028 joins lot 26027 as one correction tote; 26027 wet weight to 8,280,388 g', '2026-09-22T04:30:00.000Z'
WHERE NOT EXISTS (SELECT 1 FROM record_change_log WHERE record_table = 'wet_weights' AND record_id = '150d324e-3e82-4aba-ede0-04ffc958c1d3' AND field = 'weight_grams' AND reason = 'repair 2026-09-22 (canon 0.30.180), the Arlington Dry Room: METRC has no lot 26028, its weight is under 26027: the 6,656,847 g weighed as 26028 joins lot 26027 as one correction tote; 26027 wet weight to 8,280,388 g');
UPDATE wet_weight_entries SET weight_grams = 8280388, updated_at = '2026-09-22T04:30:00.000Z', updated_by = '7b59cf6b-04b6-4742-bb1b-78a28b593fe8'
WHERE id = '505edf53-4413-4836-9b14-047728c0c4a0' AND harvest_batch_id = 'bdfa8533-d7fe-46c2-b7e3-5df302e05874' AND weight_grams = 1623541 AND status = 'drying' AND deleted_at IS NULL;
INSERT INTO record_change_log (id, record_table, record_id, field, old_value, new_value, actor_person_id, reason, changed_at)
SELECT 'bc0aea2a-f52d-afac-5e2e-f567caf4c9b1', 'wet_weight_entries', '505edf53-4413-4836-9b14-047728c0c4a0', 'weight_grams', '1623541', '8280388', '7b59cf6b-04b6-4742-bb1b-78a28b593fe8', 'repair 2026-09-22 (canon 0.30.180), the Arlington Dry Room: METRC has no lot 26028, its weight is under 26027: lot 26027 wet weight 1,623,541 g to 8,280,388 g', '2026-09-22T04:30:00.000Z'
WHERE NOT EXISTS (SELECT 1 FROM record_change_log WHERE record_table = 'wet_weight_entries' AND record_id = '505edf53-4413-4836-9b14-047728c0c4a0' AND field = 'weight_grams' AND reason = 'repair 2026-09-22 (canon 0.30.180), the Arlington Dry Room: METRC has no lot 26028, its weight is under 26027: lot 26027 wet weight 1,623,541 g to 8,280,388 g');
UPDATE local_inventory_items SET qty = 8280388, updated_at = '2026-09-22T04:30:00.000Z', updated_by = '7b59cf6b-04b6-4742-bb1b-78a28b593fe8'
WHERE id = '35db349f-af3d-4aa4-a279-ea47792259fb' AND wet_weight_entry_id = '505edf53-4413-4836-9b14-047728c0c4a0' AND package_code = '26027' AND qty = 1623541 AND deleted_at IS NULL;
INSERT INTO record_change_log (id, record_table, record_id, field, old_value, new_value, actor_person_id, reason, changed_at)
SELECT 'a0450779-7664-ac87-6cfd-eca7fb776569', 'local_inventory_items', '35db349f-af3d-4aa4-a279-ea47792259fb', 'qty', '1623541', '8280388', '7b59cf6b-04b6-4742-bb1b-78a28b593fe8', 'repair 2026-09-22 (canon 0.30.180), the Arlington Dry Room: METRC has no lot 26028, its weight is under 26027: the born package 26027 (SPR, at the Arlington Dry Room) 1,623,541 g to 8,280,388 g', '2026-09-22T04:30:00.000Z'
WHERE NOT EXISTS (SELECT 1 FROM record_change_log WHERE record_table = 'local_inventory_items' AND record_id = '35db349f-af3d-4aa4-a279-ea47792259fb' AND field = 'qty' AND reason = 'repair 2026-09-22 (canon 0.30.180), the Arlington Dry Room: METRC has no lot 26028, its weight is under 26027: the born package 26027 (SPR, at the Arlington Dry Room) 1,623,541 g to 8,280,388 g');

-- B. 26028's 744 live plant tags move to 26027 in one statement (its own WHERE is the guard: a second run finds
--    no row); one log row records the move on the HBN they leave. 26027 then carries 414 + 744 = 1,158 live tags,
--    and its METRC wet weights file splits 8,280,388 g over 1,158 rows.
UPDATE harvest_plant_tags SET harvest_batch_id = 'bdfa8533-d7fe-46c2-b7e3-5df302e05874', updated_at = '2026-09-22T04:30:00.000Z', updated_by = '7b59cf6b-04b6-4742-bb1b-78a28b593fe8'
WHERE harvest_batch_id = '9cbbfd71-96a7-451d-a590-85f9b09f715e' AND deleted_at IS NULL
  AND EXISTS (SELECT 1 FROM harvest_batches WHERE id = 'bdfa8533-d7fe-46c2-b7e3-5df302e05874' AND hbn = '26262-ARL-OD-009-0-NA-26027' AND deleted_at IS NULL);
INSERT INTO record_change_log (id, record_table, record_id, field, old_value, new_value, actor_person_id, reason, changed_at)
SELECT '4b006645-75b4-cbeb-8b32-911990aaf457', 'harvest_plant_tags', '9cbbfd71-96a7-451d-a590-85f9b09f715e', 'harvest_batch_id', '9cbbfd71-96a7-451d-a590-85f9b09f715e', 'bdfa8533-d7fe-46c2-b7e3-5df302e05874', '7b59cf6b-04b6-4742-bb1b-78a28b593fe8', 'repair 2026-09-22 (canon 0.30.180), the Arlington Dry Room: METRC has no lot 26028, its weight is under 26027: 744 live plant tags of HBN 26028 move to HBN 26027; 26027 reads 1,158 plants at 8,280,388 g', '2026-09-22T04:30:00.000Z'
WHERE NOT EXISTS (SELECT 1 FROM record_change_log WHERE record_table = 'harvest_plant_tags' AND record_id = '9cbbfd71-96a7-451d-a590-85f9b09f715e' AND field = 'harvest_batch_id' AND reason = 'repair 2026-09-22 (canon 0.30.180), the Arlington Dry Room: METRC has no lot 26028, its weight is under 26027: 744 live plant tags of HBN 26028 move to HBN 26027; 26027 reads 1,158 plants at 8,280,388 g');

-- C. 26028 is voided, the whole trail: the open load, the born package, the lot, the HBN. Soft voids with the
--    reason (silo_loads and local_inventory_items carry delete_reason; wet_weight_entries and harvest_batches do
--    not, their log rows carry it). The 925 tote rows of lot 705c259f stay attached to the voided lot for the
--    record (the 0.30.91 law); they are not moved and not voided.
UPDATE silo_loads SET deleted_at = '2026-09-22T04:30:00.000Z', deleted_by = '7b59cf6b-04b6-4742-bb1b-78a28b593fe8', delete_reason = 'repair 2026-09-22 (canon 0.30.180), the Arlington Dry Room: METRC has no lot 26028, its weight is under 26027: the open dry room load of the defunct lot 26028 is voided; the room keeps 26027 and 26029', updated_at = '2026-09-22T04:30:00.000Z', updated_by = '7b59cf6b-04b6-4742-bb1b-78a28b593fe8'
WHERE id = 'ede97313-df1f-4cfd-8e84-fe56079d8046' AND dry_space_id = 'a1000001-0001-4000-8000-000000000006' AND wet_weight_entry_id = '705c259f-60ef-4f58-b2a1-9cde7e455ca4' AND ended_at IS NULL AND deleted_at IS NULL;
INSERT INTO record_change_log (id, record_table, record_id, field, old_value, new_value, actor_person_id, reason, changed_at)
SELECT '40e583a7-f9be-65c1-7010-856934b5b3bf', 'silo_loads', 'ede97313-df1f-4cfd-8e84-fe56079d8046', 'deleted_at', NULL, '2026-09-22T04:30:00.000Z', '7b59cf6b-04b6-4742-bb1b-78a28b593fe8', 'repair 2026-09-22 (canon 0.30.180), the Arlington Dry Room: METRC has no lot 26028, its weight is under 26027: the open dry room load of the defunct lot 26028 is voided; the room keeps 26027 and 26029', '2026-09-22T04:30:00.000Z'
WHERE NOT EXISTS (SELECT 1 FROM record_change_log WHERE record_table = 'silo_loads' AND record_id = 'ede97313-df1f-4cfd-8e84-fe56079d8046' AND field = 'deleted_at' AND reason = 'repair 2026-09-22 (canon 0.30.180), the Arlington Dry Room: METRC has no lot 26028, its weight is under 26027: the open dry room load of the defunct lot 26028 is voided; the room keeps 26027 and 26029');
UPDATE local_inventory_items SET deleted_at = '2026-09-22T04:30:00.000Z', deleted_by = '7b59cf6b-04b6-4742-bb1b-78a28b593fe8', delete_reason = 'repair 2026-09-22 (canon 0.30.180), the Arlington Dry Room: METRC has no lot 26028, its weight is under 26027: the 6,656,847 g born package 26028 leaves the ledger; its weight rides under 26027', updated_at = '2026-09-22T04:30:00.000Z', updated_by = '7b59cf6b-04b6-4742-bb1b-78a28b593fe8'
WHERE id = '7e26c19a-798a-4c43-9775-80c912d6eb74' AND wet_weight_entry_id = '705c259f-60ef-4f58-b2a1-9cde7e455ca4' AND package_code = '26028' AND qty = 6656847 AND deleted_at IS NULL;
INSERT INTO record_change_log (id, record_table, record_id, field, old_value, new_value, actor_person_id, reason, changed_at)
SELECT '472d1f94-1c56-bcb3-6163-e895485f1c2a', 'local_inventory_items', '7e26c19a-798a-4c43-9775-80c912d6eb74', 'deleted_at', NULL, '2026-09-22T04:30:00.000Z', '7b59cf6b-04b6-4742-bb1b-78a28b593fe8', 'repair 2026-09-22 (canon 0.30.180), the Arlington Dry Room: METRC has no lot 26028, its weight is under 26027: the 6,656,847 g born package 26028 leaves the ledger; its weight rides under 26027', '2026-09-22T04:30:00.000Z'
WHERE NOT EXISTS (SELECT 1 FROM record_change_log WHERE record_table = 'local_inventory_items' AND record_id = '7e26c19a-798a-4c43-9775-80c912d6eb74' AND field = 'deleted_at' AND reason = 'repair 2026-09-22 (canon 0.30.180), the Arlington Dry Room: METRC has no lot 26028, its weight is under 26027: the 6,656,847 g born package 26028 leaves the ledger; its weight rides under 26027');
UPDATE wet_weight_entries SET deleted_at = '2026-09-22T04:30:00.000Z', deleted_by = '7b59cf6b-04b6-4742-bb1b-78a28b593fe8', updated_at = '2026-09-22T04:30:00.000Z', updated_by = '7b59cf6b-04b6-4742-bb1b-78a28b593fe8'
WHERE id = '705c259f-60ef-4f58-b2a1-9cde7e455ca4' AND harvest_batch_id = '9cbbfd71-96a7-451d-a590-85f9b09f715e' AND weight_grams = 6656847 AND status = 'drying' AND deleted_at IS NULL;
INSERT INTO record_change_log (id, record_table, record_id, field, old_value, new_value, actor_person_id, reason, changed_at)
SELECT '1546836a-72da-1cba-b6f1-61d56f357d82', 'wet_weight_entries', '705c259f-60ef-4f58-b2a1-9cde7e455ca4', 'deleted_at', NULL, '2026-09-22T04:30:00.000Z', '7b59cf6b-04b6-4742-bb1b-78a28b593fe8', 'repair 2026-09-22 (canon 0.30.180), the Arlington Dry Room: METRC has no lot 26028, its weight is under 26027: the defunct lot 26028 is voided; its 925 tote rows stay attached for the record', '2026-09-22T04:30:00.000Z'
WHERE NOT EXISTS (SELECT 1 FROM record_change_log WHERE record_table = 'wet_weight_entries' AND record_id = '705c259f-60ef-4f58-b2a1-9cde7e455ca4' AND field = 'deleted_at' AND reason = 'repair 2026-09-22 (canon 0.30.180), the Arlington Dry Room: METRC has no lot 26028, its weight is under 26027: the defunct lot 26028 is voided; its 925 tote rows stay attached for the record');
UPDATE harvest_batches SET deleted_at = '2026-09-22T04:30:00.000Z', deleted_by = '7b59cf6b-04b6-4742-bb1b-78a28b593fe8', updated_at = '2026-09-22T04:30:00.000Z', updated_by = '7b59cf6b-04b6-4742-bb1b-78a28b593fe8'
WHERE id = '9cbbfd71-96a7-451d-a590-85f9b09f715e' AND hbn = '26262-ARL-OD-009-0-NA-26028' AND status = 'open' AND deleted_at IS NULL;
INSERT INTO record_change_log (id, record_table, record_id, field, old_value, new_value, actor_person_id, reason, changed_at)
SELECT '96cee9c4-4803-5a0d-dcd0-06cd4541c34d', 'harvest_batches', '9cbbfd71-96a7-451d-a590-85f9b09f715e', 'deleted_at', NULL, '2026-09-22T04:30:00.000Z', '7b59cf6b-04b6-4742-bb1b-78a28b593fe8', 'repair 2026-09-22 (canon 0.30.180), the Arlington Dry Room: METRC has no lot 26028, its weight is under 26027: the defunct HBN 26028 is voided; serial 26028 stays used', '2026-09-22T04:30:00.000Z'
WHERE NOT EXISTS (SELECT 1 FROM record_change_log WHERE record_table = 'harvest_batches' AND record_id = '9cbbfd71-96a7-451d-a590-85f9b09f715e' AND field = 'deleted_at' AND reason = 'repair 2026-09-22 (canon 0.30.180), the Arlington Dry Room: METRC has no lot 26028, its weight is under 26027: the defunct HBN 26028 is voided; serial 26028 stays used');

-- D. Untouched on purpose: 26027's load 39a07773 and its clock (started 2026-09-19T12:00:00Z, still running);
--    HBN 26029 entirely (lot 345bdebf, load 5c295d49, package 4c3ef27e); the tote rows of both lots (351 live and
--    one voided on 26027, 925 on the voided 26028); the create, finish and silo load log rows of both HBNs; every
--    other HBN, lot, load and package on the floor. The room's Wet total stays 8,705,942 g (8,280,388 + 425,554);
--    only its lot count drops from three to two.
-- End of repair. Expected effect: 751 rows updated/inserted (1 tote inserted, 750 rows updated, 744 of them the
-- plant tags of one statement), 8 log rows inserted; a second run: 0 and 0.
