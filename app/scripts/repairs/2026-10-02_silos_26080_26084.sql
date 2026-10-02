-- THE SILO REPAIR OF 2026-10-02 (canon 0.30.345). The floor lead's table of 2026-10-01 (Teams): 26080 Silo 3,
-- 26081 Silo 5, 26082 Silo 1, 26083 Silo 2, 26084 Silo 4, 26085 no silo. In data (db_backups/20261002-092842_pre_hbn_entry)
-- the six PNS field lots were spear lots in Hang in Place by the field node's defaults (canon 0.30.341); by hand since,
-- 26080's lot moved to Silo 3 (a silo load on Silo 3, the lot since unloaded) and 26082's lot was marked bucked in Silo 1
-- while its silo load still sits on Silo 5. No HBN of the six carries a planned silo. 0087 (V16) gives every HBN
-- material_form bucked already.
--
-- This file: the five planned silos on the HBNs; the five lots bucked; 26081, 26083 and 26084 moved from Hang in Place
-- into their silos with a silo load each (loaded and started at the lot's finish instant); 26082's silo load moved from
-- Silo 5 to Silo 1; the five lots' packages re-kinded SPR to WIP, the three moved lots' packages located at their silo;
-- 26085 untouched. Every statement is guarded by the value it expects, so a second run changes nothing; every change
-- lands in record_change_log under the owner's login with this repair's reason. Nothing deleted, no created_at edited.
-- Run from app/ at the owner's keyboard:
--   node scripts/repair-apply.mjs scripts/repairs/2026-10-02_silos_26080_26084.sql
-- Then: node scripts/db-snapshot.mjs post_silos_26080_26084

-- 26080: planned Silo 3; the lot bucked; the package WIP.
UPDATE harvest_batches SET planned_dryspc = '3', updated_at = '2026-10-02T14:00:00.000Z', updated_by = '7b59cf6b-04b6-4742-bb1b-78a28b593fe8'
WHERE id = '80b4eeb4-69cb-46ae-ae6a-057ed718cf4f' AND deleted_at IS NULL AND (planned_dryspc IS NULL OR planned_dryspc = 'NA');
INSERT INTO record_change_log (id, record_table, record_id, field, old_value, new_value, actor_person_id, reason, changed_at)
SELECT '3f8914dd-735d-5943-afee-3f1784d35f9d', 'harvest_batches', '80b4eeb4-69cb-46ae-ae6a-057ed718cf4f', 'planned_dryspc', '(blank)', '3', '7b59cf6b-04b6-4742-bb1b-78a28b593fe8', 'repair 2026-10-02 (canon 0.30.345), the floor lead''s silo table of 2026-10-01: the six PNS field lots were spear in Hang in Place by the field node''s defaults while the floor bucked them into silos: 26080 planned silo', '2026-10-02T14:00:00.000Z'
WHERE NOT EXISTS (SELECT 1 FROM record_change_log WHERE id = '3f8914dd-735d-5943-afee-3f1784d35f9d');

UPDATE wet_weight_entries SET material_form = 'bucked', updated_at = '2026-10-02T14:00:00.000Z', updated_by = '7b59cf6b-04b6-4742-bb1b-78a28b593fe8'
WHERE id = 'df6b3e33-e598-450e-bd80-bddc33cfaa60' AND deleted_at IS NULL AND material_form = 'spear';
INSERT INTO record_change_log (id, record_table, record_id, field, old_value, new_value, actor_person_id, reason, changed_at)
SELECT '9d972b86-e670-54f0-b83b-b78c0ba146c1', 'wet_weight_entries', 'df6b3e33-e598-450e-bd80-bddc33cfaa60', 'material_form', 'spear', 'bucked', '7b59cf6b-04b6-4742-bb1b-78a28b593fe8', 'repair 2026-10-02 (canon 0.30.345), the floor lead''s silo table of 2026-10-01: the six PNS field lots were spear in Hang in Place by the field node''s defaults while the floor bucked them into silos: 26080 lot form', '2026-10-02T14:00:00.000Z'
WHERE NOT EXISTS (SELECT 1 FROM record_change_log WHERE id = '9d972b86-e670-54f0-b83b-b78c0ba146c1');

UPDATE local_inventory_items SET item_kind = 'WIP', updated_at = '2026-10-02T14:00:00.000Z', updated_by = '7b59cf6b-04b6-4742-bb1b-78a28b593fe8'
WHERE id = 'f8479760-ba58-4651-baef-70a886056d51' AND deleted_at IS NULL AND item_kind = 'SPR';
INSERT INTO record_change_log (id, record_table, record_id, field, old_value, new_value, actor_person_id, reason, changed_at)
SELECT '2fdec6e1-bf8a-5ffa-bda2-aecbd4f09372', 'local_inventory_items', 'f8479760-ba58-4651-baef-70a886056d51', 'item_kind', 'SPR', 'WIP', '7b59cf6b-04b6-4742-bb1b-78a28b593fe8', 'repair 2026-10-02 (canon 0.30.345), the floor lead''s silo table of 2026-10-01: the six PNS field lots were spear in Hang in Place by the field node''s defaults while the floor bucked them into silos: 26080 package kind', '2026-10-02T14:00:00.000Z'
WHERE NOT EXISTS (SELECT 1 FROM record_change_log WHERE id = '2fdec6e1-bf8a-5ffa-bda2-aecbd4f09372');


-- 26081: planned Silo 5; the lot bucked, into Silo 5; the package WIP.
UPDATE harvest_batches SET planned_dryspc = '5', updated_at = '2026-10-02T14:00:00.000Z', updated_by = '7b59cf6b-04b6-4742-bb1b-78a28b593fe8'
WHERE id = '5ca81483-411d-4dd3-ac3d-4666dd563a5f' AND deleted_at IS NULL AND (planned_dryspc IS NULL OR planned_dryspc = 'NA');
INSERT INTO record_change_log (id, record_table, record_id, field, old_value, new_value, actor_person_id, reason, changed_at)
SELECT 'b5fee7f1-eee3-5e88-aea1-8dd08657874c', 'harvest_batches', '5ca81483-411d-4dd3-ac3d-4666dd563a5f', 'planned_dryspc', '(blank)', '5', '7b59cf6b-04b6-4742-bb1b-78a28b593fe8', 'repair 2026-10-02 (canon 0.30.345), the floor lead''s silo table of 2026-10-01: the six PNS field lots were spear in Hang in Place by the field node''s defaults while the floor bucked them into silos: 26081 planned silo', '2026-10-02T14:00:00.000Z'
WHERE NOT EXISTS (SELECT 1 FROM record_change_log WHERE id = 'b5fee7f1-eee3-5e88-aea1-8dd08657874c');

UPDATE wet_weight_entries SET material_form = 'bucked', updated_at = '2026-10-02T14:00:00.000Z', updated_by = '7b59cf6b-04b6-4742-bb1b-78a28b593fe8'
WHERE id = 'a444e4ac-be8e-47cc-b3a4-cc9d336b1058' AND deleted_at IS NULL AND material_form = 'spear';
INSERT INTO record_change_log (id, record_table, record_id, field, old_value, new_value, actor_person_id, reason, changed_at)
SELECT '47751c99-d758-516f-ae6f-452e41f50b8c', 'wet_weight_entries', 'a444e4ac-be8e-47cc-b3a4-cc9d336b1058', 'material_form', 'spear', 'bucked', '7b59cf6b-04b6-4742-bb1b-78a28b593fe8', 'repair 2026-10-02 (canon 0.30.345), the floor lead''s silo table of 2026-10-01: the six PNS field lots were spear in Hang in Place by the field node''s defaults while the floor bucked them into silos: 26081 lot form', '2026-10-02T14:00:00.000Z'
WHERE NOT EXISTS (SELECT 1 FROM record_change_log WHERE id = '47751c99-d758-516f-ae6f-452e41f50b8c');

UPDATE wet_weight_entries SET actual_dryspc = 'a1000001-0001-4000-8000-000000000005', updated_at = '2026-10-02T14:00:00.000Z', updated_by = '7b59cf6b-04b6-4742-bb1b-78a28b593fe8'
WHERE id = 'a444e4ac-be8e-47cc-b3a4-cc9d336b1058' AND deleted_at IS NULL AND actual_dryspc = 'a1000001-0001-4000-8000-000000000007';
INSERT INTO record_change_log (id, record_table, record_id, field, old_value, new_value, actor_person_id, reason, changed_at)
SELECT 'a538dc87-6c1b-5dcc-8a10-8d9b195491fb', 'wet_weight_entries', 'a444e4ac-be8e-47cc-b3a4-cc9d336b1058', 'actual_dryspc', 'Hang in Place', 'Silo 5', '7b59cf6b-04b6-4742-bb1b-78a28b593fe8', 'repair 2026-10-02 (canon 0.30.345), the floor lead''s silo table of 2026-10-01: the six PNS field lots were spear in Hang in Place by the field node''s defaults while the floor bucked them into silos: 26081 lot space', '2026-10-02T14:00:00.000Z'
WHERE NOT EXISTS (SELECT 1 FROM record_change_log WHERE id = 'a538dc87-6c1b-5dcc-8a10-8d9b195491fb');

INSERT INTO silo_loads (id, dry_space_id, wet_weight_entry_id, loaded_at, started_at, paused_at, paused_seconds, ended_at, notes, created_at, created_by, updated_at, updated_by, deleted_at, deleted_by)
SELECT 'caccede8-e1da-5603-8a0b-f7e08f5e3865', 'a1000001-0001-4000-8000-000000000005', 'a444e4ac-be8e-47cc-b3a4-cc9d336b1058', '2026-10-01T15:48:13.625Z', '2026-10-01T15:48:13.625Z', NULL, 0, NULL, 'repair 2026-10-02: loaded by the floor on 2026-10-01, recorded after', '2026-10-02T14:00:00.000Z', '7b59cf6b-04b6-4742-bb1b-78a28b593fe8', '2026-10-02T14:00:00.000Z', '7b59cf6b-04b6-4742-bb1b-78a28b593fe8', NULL, NULL
WHERE NOT EXISTS (SELECT 1 FROM silo_loads WHERE wet_weight_entry_id = 'a444e4ac-be8e-47cc-b3a4-cc9d336b1058' AND deleted_at IS NULL);
INSERT INTO record_change_log (id, record_table, record_id, field, old_value, new_value, actor_person_id, reason, changed_at)
SELECT 'caccede8-e1da-5603-8a0b-f7e08f5e3865', 'silo_loads', 'caccede8-e1da-5603-8a0b-f7e08f5e3865', 'loaded', '(none)', 'Silo 5 at 2026-10-01T15:48:13.625Z', '7b59cf6b-04b6-4742-bb1b-78a28b593fe8', 'repair 2026-10-02 (canon 0.30.345), the floor lead''s silo table of 2026-10-01: the six PNS field lots were spear in Hang in Place by the field node''s defaults while the floor bucked them into silos: 26081 silo load', '2026-10-02T14:00:00.000Z'
WHERE NOT EXISTS (SELECT 1 FROM record_change_log WHERE id = 'caccede8-e1da-5603-8a0b-f7e08f5e3865');

UPDATE local_inventory_items SET location = 'Silo 5', updated_at = '2026-10-02T14:00:00.000Z', updated_by = '7b59cf6b-04b6-4742-bb1b-78a28b593fe8'
WHERE id = 'f59ffa47-45a8-4ead-a3ef-37e8694fdd05' AND deleted_at IS NULL AND location = 'Hang in Place';
INSERT INTO record_change_log (id, record_table, record_id, field, old_value, new_value, actor_person_id, reason, changed_at)
SELECT 'a0f4f6c9-4edf-5d23-8d4f-68f9b22808df', 'local_inventory_items', 'f59ffa47-45a8-4ead-a3ef-37e8694fdd05', 'location', 'Hang in Place', 'Silo 5', '7b59cf6b-04b6-4742-bb1b-78a28b593fe8', 'repair 2026-10-02 (canon 0.30.345), the floor lead''s silo table of 2026-10-01: the six PNS field lots were spear in Hang in Place by the field node''s defaults while the floor bucked them into silos: 26081 package location', '2026-10-02T14:00:00.000Z'
WHERE NOT EXISTS (SELECT 1 FROM record_change_log WHERE id = 'a0f4f6c9-4edf-5d23-8d4f-68f9b22808df');

UPDATE local_inventory_items SET item_kind = 'WIP', updated_at = '2026-10-02T14:00:00.000Z', updated_by = '7b59cf6b-04b6-4742-bb1b-78a28b593fe8'
WHERE id = 'f59ffa47-45a8-4ead-a3ef-37e8694fdd05' AND deleted_at IS NULL AND item_kind = 'SPR';
INSERT INTO record_change_log (id, record_table, record_id, field, old_value, new_value, actor_person_id, reason, changed_at)
SELECT 'c0819a66-5dd7-577d-94be-d9dc808bad74', 'local_inventory_items', 'f59ffa47-45a8-4ead-a3ef-37e8694fdd05', 'item_kind', 'SPR', 'WIP', '7b59cf6b-04b6-4742-bb1b-78a28b593fe8', 'repair 2026-10-02 (canon 0.30.345), the floor lead''s silo table of 2026-10-01: the six PNS field lots were spear in Hang in Place by the field node''s defaults while the floor bucked them into silos: 26081 package kind', '2026-10-02T14:00:00.000Z'
WHERE NOT EXISTS (SELECT 1 FROM record_change_log WHERE id = 'c0819a66-5dd7-577d-94be-d9dc808bad74');


-- 26082: planned Silo 1; the lot bucked; the package WIP.
UPDATE harvest_batches SET planned_dryspc = '1', updated_at = '2026-10-02T14:00:00.000Z', updated_by = '7b59cf6b-04b6-4742-bb1b-78a28b593fe8'
WHERE id = '91c3b09a-89ed-4546-9e5f-d410c4b62562' AND deleted_at IS NULL AND (planned_dryspc IS NULL OR planned_dryspc = 'NA');
INSERT INTO record_change_log (id, record_table, record_id, field, old_value, new_value, actor_person_id, reason, changed_at)
SELECT '1b458a00-05fe-58e2-a589-f2212a8411e4', 'harvest_batches', '91c3b09a-89ed-4546-9e5f-d410c4b62562', 'planned_dryspc', '(blank)', '1', '7b59cf6b-04b6-4742-bb1b-78a28b593fe8', 'repair 2026-10-02 (canon 0.30.345), the floor lead''s silo table of 2026-10-01: the six PNS field lots were spear in Hang in Place by the field node''s defaults while the floor bucked them into silos: 26082 planned silo', '2026-10-02T14:00:00.000Z'
WHERE NOT EXISTS (SELECT 1 FROM record_change_log WHERE id = '1b458a00-05fe-58e2-a589-f2212a8411e4');

UPDATE wet_weight_entries SET material_form = 'bucked', updated_at = '2026-10-02T14:00:00.000Z', updated_by = '7b59cf6b-04b6-4742-bb1b-78a28b593fe8'
WHERE id = '7ffefd69-1409-4466-a4cd-1171b0f38a7e' AND deleted_at IS NULL AND material_form = 'spear';
INSERT INTO record_change_log (id, record_table, record_id, field, old_value, new_value, actor_person_id, reason, changed_at)
SELECT '488334e1-4142-533d-95b1-80d701754056', 'wet_weight_entries', '7ffefd69-1409-4466-a4cd-1171b0f38a7e', 'material_form', 'spear', 'bucked', '7b59cf6b-04b6-4742-bb1b-78a28b593fe8', 'repair 2026-10-02 (canon 0.30.345), the floor lead''s silo table of 2026-10-01: the six PNS field lots were spear in Hang in Place by the field node''s defaults while the floor bucked them into silos: 26082 lot form', '2026-10-02T14:00:00.000Z'
WHERE NOT EXISTS (SELECT 1 FROM record_change_log WHERE id = '488334e1-4142-533d-95b1-80d701754056');

UPDATE local_inventory_items SET item_kind = 'WIP', updated_at = '2026-10-02T14:00:00.000Z', updated_by = '7b59cf6b-04b6-4742-bb1b-78a28b593fe8'
WHERE id = '8c4f6076-9024-4b20-b143-61679b692ab6' AND deleted_at IS NULL AND item_kind = 'SPR';
INSERT INTO record_change_log (id, record_table, record_id, field, old_value, new_value, actor_person_id, reason, changed_at)
SELECT '7550a1bf-6664-5fde-a795-3310a70005d3', 'local_inventory_items', '8c4f6076-9024-4b20-b143-61679b692ab6', 'item_kind', 'SPR', 'WIP', '7b59cf6b-04b6-4742-bb1b-78a28b593fe8', 'repair 2026-10-02 (canon 0.30.345), the floor lead''s silo table of 2026-10-01: the six PNS field lots were spear in Hang in Place by the field node''s defaults while the floor bucked them into silos: 26082 package kind', '2026-10-02T14:00:00.000Z'
WHERE NOT EXISTS (SELECT 1 FROM record_change_log WHERE id = '7550a1bf-6664-5fde-a795-3310a70005d3');


-- 26083: planned Silo 2; the lot bucked, into Silo 2; the package WIP.
UPDATE harvest_batches SET planned_dryspc = '2', updated_at = '2026-10-02T14:00:00.000Z', updated_by = '7b59cf6b-04b6-4742-bb1b-78a28b593fe8'
WHERE id = '84a88021-fe44-4bbf-830e-e8e0824471ef' AND deleted_at IS NULL AND (planned_dryspc IS NULL OR planned_dryspc = 'NA');
INSERT INTO record_change_log (id, record_table, record_id, field, old_value, new_value, actor_person_id, reason, changed_at)
SELECT '71005f23-ef01-591b-83b5-5e4f74eaf617', 'harvest_batches', '84a88021-fe44-4bbf-830e-e8e0824471ef', 'planned_dryspc', '(blank)', '2', '7b59cf6b-04b6-4742-bb1b-78a28b593fe8', 'repair 2026-10-02 (canon 0.30.345), the floor lead''s silo table of 2026-10-01: the six PNS field lots were spear in Hang in Place by the field node''s defaults while the floor bucked them into silos: 26083 planned silo', '2026-10-02T14:00:00.000Z'
WHERE NOT EXISTS (SELECT 1 FROM record_change_log WHERE id = '71005f23-ef01-591b-83b5-5e4f74eaf617');

UPDATE wet_weight_entries SET material_form = 'bucked', updated_at = '2026-10-02T14:00:00.000Z', updated_by = '7b59cf6b-04b6-4742-bb1b-78a28b593fe8'
WHERE id = '8d831184-15f1-47ec-8a99-18927200ec35' AND deleted_at IS NULL AND material_form = 'spear';
INSERT INTO record_change_log (id, record_table, record_id, field, old_value, new_value, actor_person_id, reason, changed_at)
SELECT '98bc4535-e14a-5aa3-99ba-aa155545c674', 'wet_weight_entries', '8d831184-15f1-47ec-8a99-18927200ec35', 'material_form', 'spear', 'bucked', '7b59cf6b-04b6-4742-bb1b-78a28b593fe8', 'repair 2026-10-02 (canon 0.30.345), the floor lead''s silo table of 2026-10-01: the six PNS field lots were spear in Hang in Place by the field node''s defaults while the floor bucked them into silos: 26083 lot form', '2026-10-02T14:00:00.000Z'
WHERE NOT EXISTS (SELECT 1 FROM record_change_log WHERE id = '98bc4535-e14a-5aa3-99ba-aa155545c674');

UPDATE wet_weight_entries SET actual_dryspc = 'a1000001-0001-4000-8000-000000000002', updated_at = '2026-10-02T14:00:00.000Z', updated_by = '7b59cf6b-04b6-4742-bb1b-78a28b593fe8'
WHERE id = '8d831184-15f1-47ec-8a99-18927200ec35' AND deleted_at IS NULL AND actual_dryspc = 'a1000001-0001-4000-8000-000000000007';
INSERT INTO record_change_log (id, record_table, record_id, field, old_value, new_value, actor_person_id, reason, changed_at)
SELECT '9f5e4686-02ed-5db7-bde3-6c214f38dc5a', 'wet_weight_entries', '8d831184-15f1-47ec-8a99-18927200ec35', 'actual_dryspc', 'Hang in Place', 'Silo 2', '7b59cf6b-04b6-4742-bb1b-78a28b593fe8', 'repair 2026-10-02 (canon 0.30.345), the floor lead''s silo table of 2026-10-01: the six PNS field lots were spear in Hang in Place by the field node''s defaults while the floor bucked them into silos: 26083 lot space', '2026-10-02T14:00:00.000Z'
WHERE NOT EXISTS (SELECT 1 FROM record_change_log WHERE id = '9f5e4686-02ed-5db7-bde3-6c214f38dc5a');

INSERT INTO silo_loads (id, dry_space_id, wet_weight_entry_id, loaded_at, started_at, paused_at, paused_seconds, ended_at, notes, created_at, created_by, updated_at, updated_by, deleted_at, deleted_by)
SELECT '8963b66a-46c2-5606-8360-6df30a45d7fd', 'a1000001-0001-4000-8000-000000000002', '8d831184-15f1-47ec-8a99-18927200ec35', '2026-10-01T20:40:07.038Z', '2026-10-01T20:40:07.038Z', NULL, 0, NULL, 'repair 2026-10-02: loaded by the floor on 2026-10-01, recorded after', '2026-10-02T14:00:00.000Z', '7b59cf6b-04b6-4742-bb1b-78a28b593fe8', '2026-10-02T14:00:00.000Z', '7b59cf6b-04b6-4742-bb1b-78a28b593fe8', NULL, NULL
WHERE NOT EXISTS (SELECT 1 FROM silo_loads WHERE wet_weight_entry_id = '8d831184-15f1-47ec-8a99-18927200ec35' AND deleted_at IS NULL);
INSERT INTO record_change_log (id, record_table, record_id, field, old_value, new_value, actor_person_id, reason, changed_at)
SELECT '8963b66a-46c2-5606-8360-6df30a45d7fd', 'silo_loads', '8963b66a-46c2-5606-8360-6df30a45d7fd', 'loaded', '(none)', 'Silo 2 at 2026-10-01T20:40:07.038Z', '7b59cf6b-04b6-4742-bb1b-78a28b593fe8', 'repair 2026-10-02 (canon 0.30.345), the floor lead''s silo table of 2026-10-01: the six PNS field lots were spear in Hang in Place by the field node''s defaults while the floor bucked them into silos: 26083 silo load', '2026-10-02T14:00:00.000Z'
WHERE NOT EXISTS (SELECT 1 FROM record_change_log WHERE id = '8963b66a-46c2-5606-8360-6df30a45d7fd');

UPDATE local_inventory_items SET location = 'Silo 2', updated_at = '2026-10-02T14:00:00.000Z', updated_by = '7b59cf6b-04b6-4742-bb1b-78a28b593fe8'
WHERE id = '1436a6fe-4231-4556-aa78-b1616b8f91d7' AND deleted_at IS NULL AND location = 'Hang in Place';
INSERT INTO record_change_log (id, record_table, record_id, field, old_value, new_value, actor_person_id, reason, changed_at)
SELECT 'b5eca31d-8bfa-58b5-a064-b911e0ec75c8', 'local_inventory_items', '1436a6fe-4231-4556-aa78-b1616b8f91d7', 'location', 'Hang in Place', 'Silo 2', '7b59cf6b-04b6-4742-bb1b-78a28b593fe8', 'repair 2026-10-02 (canon 0.30.345), the floor lead''s silo table of 2026-10-01: the six PNS field lots were spear in Hang in Place by the field node''s defaults while the floor bucked them into silos: 26083 package location', '2026-10-02T14:00:00.000Z'
WHERE NOT EXISTS (SELECT 1 FROM record_change_log WHERE id = 'b5eca31d-8bfa-58b5-a064-b911e0ec75c8');

UPDATE local_inventory_items SET item_kind = 'WIP', updated_at = '2026-10-02T14:00:00.000Z', updated_by = '7b59cf6b-04b6-4742-bb1b-78a28b593fe8'
WHERE id = '1436a6fe-4231-4556-aa78-b1616b8f91d7' AND deleted_at IS NULL AND item_kind = 'SPR';
INSERT INTO record_change_log (id, record_table, record_id, field, old_value, new_value, actor_person_id, reason, changed_at)
SELECT '40764df6-5d2c-56fc-bbf7-928709a472b3', 'local_inventory_items', '1436a6fe-4231-4556-aa78-b1616b8f91d7', 'item_kind', 'SPR', 'WIP', '7b59cf6b-04b6-4742-bb1b-78a28b593fe8', 'repair 2026-10-02 (canon 0.30.345), the floor lead''s silo table of 2026-10-01: the six PNS field lots were spear in Hang in Place by the field node''s defaults while the floor bucked them into silos: 26083 package kind', '2026-10-02T14:00:00.000Z'
WHERE NOT EXISTS (SELECT 1 FROM record_change_log WHERE id = '40764df6-5d2c-56fc-bbf7-928709a472b3');


-- 26084: planned Silo 4; the lot bucked, into Silo 4; the package WIP.
UPDATE harvest_batches SET planned_dryspc = '4', updated_at = '2026-10-02T14:00:00.000Z', updated_by = '7b59cf6b-04b6-4742-bb1b-78a28b593fe8'
WHERE id = 'c46f500a-b7dd-4775-af92-5cf5a8e56f0d' AND deleted_at IS NULL AND (planned_dryspc IS NULL OR planned_dryspc = 'NA');
INSERT INTO record_change_log (id, record_table, record_id, field, old_value, new_value, actor_person_id, reason, changed_at)
SELECT 'ccb4edd6-048f-54ff-8753-bd58996404e5', 'harvest_batches', 'c46f500a-b7dd-4775-af92-5cf5a8e56f0d', 'planned_dryspc', '(blank)', '4', '7b59cf6b-04b6-4742-bb1b-78a28b593fe8', 'repair 2026-10-02 (canon 0.30.345), the floor lead''s silo table of 2026-10-01: the six PNS field lots were spear in Hang in Place by the field node''s defaults while the floor bucked them into silos: 26084 planned silo', '2026-10-02T14:00:00.000Z'
WHERE NOT EXISTS (SELECT 1 FROM record_change_log WHERE id = 'ccb4edd6-048f-54ff-8753-bd58996404e5');

UPDATE wet_weight_entries SET material_form = 'bucked', updated_at = '2026-10-02T14:00:00.000Z', updated_by = '7b59cf6b-04b6-4742-bb1b-78a28b593fe8'
WHERE id = '5174f918-e235-4d14-bf0b-c55b7ad85ec5' AND deleted_at IS NULL AND material_form = 'spear';
INSERT INTO record_change_log (id, record_table, record_id, field, old_value, new_value, actor_person_id, reason, changed_at)
SELECT '2989683f-872a-5ffa-9392-b7a6781699a8', 'wet_weight_entries', '5174f918-e235-4d14-bf0b-c55b7ad85ec5', 'material_form', 'spear', 'bucked', '7b59cf6b-04b6-4742-bb1b-78a28b593fe8', 'repair 2026-10-02 (canon 0.30.345), the floor lead''s silo table of 2026-10-01: the six PNS field lots were spear in Hang in Place by the field node''s defaults while the floor bucked them into silos: 26084 lot form', '2026-10-02T14:00:00.000Z'
WHERE NOT EXISTS (SELECT 1 FROM record_change_log WHERE id = '2989683f-872a-5ffa-9392-b7a6781699a8');

UPDATE wet_weight_entries SET actual_dryspc = 'a1000001-0001-4000-8000-000000000004', updated_at = '2026-10-02T14:00:00.000Z', updated_by = '7b59cf6b-04b6-4742-bb1b-78a28b593fe8'
WHERE id = '5174f918-e235-4d14-bf0b-c55b7ad85ec5' AND deleted_at IS NULL AND actual_dryspc = 'a1000001-0001-4000-8000-000000000007';
INSERT INTO record_change_log (id, record_table, record_id, field, old_value, new_value, actor_person_id, reason, changed_at)
SELECT '6b7cbb9f-2547-5e2e-bbf1-3bfb1cf426ed', 'wet_weight_entries', '5174f918-e235-4d14-bf0b-c55b7ad85ec5', 'actual_dryspc', 'Hang in Place', 'Silo 4', '7b59cf6b-04b6-4742-bb1b-78a28b593fe8', 'repair 2026-10-02 (canon 0.30.345), the floor lead''s silo table of 2026-10-01: the six PNS field lots were spear in Hang in Place by the field node''s defaults while the floor bucked them into silos: 26084 lot space', '2026-10-02T14:00:00.000Z'
WHERE NOT EXISTS (SELECT 1 FROM record_change_log WHERE id = '6b7cbb9f-2547-5e2e-bbf1-3bfb1cf426ed');

INSERT INTO silo_loads (id, dry_space_id, wet_weight_entry_id, loaded_at, started_at, paused_at, paused_seconds, ended_at, notes, created_at, created_by, updated_at, updated_by, deleted_at, deleted_by)
SELECT '849d50e8-2218-58a0-b92a-59feb5321677', 'a1000001-0001-4000-8000-000000000004', '5174f918-e235-4d14-bf0b-c55b7ad85ec5', '2026-10-01T22:32:42.082Z', '2026-10-01T22:32:42.082Z', NULL, 0, NULL, 'repair 2026-10-02: loaded by the floor on 2026-10-01, recorded after', '2026-10-02T14:00:00.000Z', '7b59cf6b-04b6-4742-bb1b-78a28b593fe8', '2026-10-02T14:00:00.000Z', '7b59cf6b-04b6-4742-bb1b-78a28b593fe8', NULL, NULL
WHERE NOT EXISTS (SELECT 1 FROM silo_loads WHERE wet_weight_entry_id = '5174f918-e235-4d14-bf0b-c55b7ad85ec5' AND deleted_at IS NULL);
INSERT INTO record_change_log (id, record_table, record_id, field, old_value, new_value, actor_person_id, reason, changed_at)
SELECT '849d50e8-2218-58a0-b92a-59feb5321677', 'silo_loads', '849d50e8-2218-58a0-b92a-59feb5321677', 'loaded', '(none)', 'Silo 4 at 2026-10-01T22:32:42.082Z', '7b59cf6b-04b6-4742-bb1b-78a28b593fe8', 'repair 2026-10-02 (canon 0.30.345), the floor lead''s silo table of 2026-10-01: the six PNS field lots were spear in Hang in Place by the field node''s defaults while the floor bucked them into silos: 26084 silo load', '2026-10-02T14:00:00.000Z'
WHERE NOT EXISTS (SELECT 1 FROM record_change_log WHERE id = '849d50e8-2218-58a0-b92a-59feb5321677');

UPDATE local_inventory_items SET location = 'Silo 4', updated_at = '2026-10-02T14:00:00.000Z', updated_by = '7b59cf6b-04b6-4742-bb1b-78a28b593fe8'
WHERE id = 'ff2b37b7-6a1d-43a8-bf07-69926029864a' AND deleted_at IS NULL AND location = 'Hang in Place';
INSERT INTO record_change_log (id, record_table, record_id, field, old_value, new_value, actor_person_id, reason, changed_at)
SELECT '4889029b-e791-5677-bf7b-f284eb58cd77', 'local_inventory_items', 'ff2b37b7-6a1d-43a8-bf07-69926029864a', 'location', 'Hang in Place', 'Silo 4', '7b59cf6b-04b6-4742-bb1b-78a28b593fe8', 'repair 2026-10-02 (canon 0.30.345), the floor lead''s silo table of 2026-10-01: the six PNS field lots were spear in Hang in Place by the field node''s defaults while the floor bucked them into silos: 26084 package location', '2026-10-02T14:00:00.000Z'
WHERE NOT EXISTS (SELECT 1 FROM record_change_log WHERE id = '4889029b-e791-5677-bf7b-f284eb58cd77');

UPDATE local_inventory_items SET item_kind = 'WIP', updated_at = '2026-10-02T14:00:00.000Z', updated_by = '7b59cf6b-04b6-4742-bb1b-78a28b593fe8'
WHERE id = 'ff2b37b7-6a1d-43a8-bf07-69926029864a' AND deleted_at IS NULL AND item_kind = 'SPR';
INSERT INTO record_change_log (id, record_table, record_id, field, old_value, new_value, actor_person_id, reason, changed_at)
SELECT '834a1f63-59ce-5257-b84a-95eeefcf75cf', 'local_inventory_items', 'ff2b37b7-6a1d-43a8-bf07-69926029864a', 'item_kind', 'SPR', 'WIP', '7b59cf6b-04b6-4742-bb1b-78a28b593fe8', 'repair 2026-10-02 (canon 0.30.345), the floor lead''s silo table of 2026-10-01: the six PNS field lots were spear in Hang in Place by the field node''s defaults while the floor bucked them into silos: 26084 package kind', '2026-10-02T14:00:00.000Z'
WHERE NOT EXISTS (SELECT 1 FROM record_change_log WHERE id = '834a1f63-59ce-5257-b84a-95eeefcf75cf');


-- 26082's silo load from Silo 5 to Silo 1 (the lot and its package already read Silo 1).
UPDATE silo_loads SET dry_space_id = 'a1000001-0001-4000-8000-000000000001', updated_at = '2026-10-02T14:00:00.000Z', updated_by = '7b59cf6b-04b6-4742-bb1b-78a28b593fe8'
WHERE id = '1a8d0a92-613c-41e0-8a5c-53ca75539caa' AND deleted_at IS NULL AND dry_space_id = 'a1000001-0001-4000-8000-000000000005';
INSERT INTO record_change_log (id, record_table, record_id, field, old_value, new_value, actor_person_id, reason, changed_at)
SELECT '9197c286-3963-5b4e-8506-db048bcdfed5', 'silo_loads', '1a8d0a92-613c-41e0-8a5c-53ca75539caa', 'dry_space_id', 'Silo 5', 'Silo 1', '7b59cf6b-04b6-4742-bb1b-78a28b593fe8', 'repair 2026-10-02 (canon 0.30.345), the floor lead''s silo table of 2026-10-01: the six PNS field lots were spear in Hang in Place by the field node''s defaults while the floor bucked them into silos: 26082 silo load space', '2026-10-02T14:00:00.000Z'
WHERE NOT EXISTS (SELECT 1 FROM record_change_log WHERE id = '9197c286-3963-5b4e-8506-db048bcdfed5');

