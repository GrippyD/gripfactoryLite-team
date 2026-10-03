-- THE 26087 AND 26050 REPAIR OF 2026-10-03 (canon 0.30.366). The owner, 2026-10-03, verbatim: "26087 - void both high
-- tote weights" and "50 contains bits of 87.  I'm not sure how the old HBNs are reopening. ... Somehow the current
-- weight in 50 needs to be added to 87, whatever was in 50 before it was returned to the list needs to come back too."
--
-- From db_backups/20261003-063702_pre_lab_station:
-- 1. 26087's lot fda40d60 (Hang in Place, finished 2026-10-02 17:25Z) carries two impossible totes on field load
--    ee673924: 112,032 g at 14:09:03Z and 64,668,712 g at 14:16:18Z. They are voided (deleted_at, the reason in the log),
--    and the lot and its SPR package 8c6711c0 go from 71,976,728 g to the remaining 876 totes' 7,195,984 g.
-- 2. 26050's second lot bc68392f (Silo 2, finished 2026-10-02 18:05Z; 622 totes, 4,962,444 g; 827 plant tags) was
--    weighed under the stale HBN 26050 and is 26087's material. The lot, its 622 totes, its 827 plant tags and its WIP
--    package 75f1b73f (code 26050 to 26087) move to HBN 26087 (31db9280). It stays a lot of its own in Silo 2: 26087's
--    first lot hangs in Hang in Place, this one is bucked in Silo 2. 26050's own lot of 2026-09-24 (b5614703, 741
--    totes, 6,628,358 g, trimmed) is untouched; with the stray lot gone 26050 leaves the field node's list.
--
-- Every change is guarded on the value it replaces and logged under the owner's login; a second run changes nothing.
-- Rehearsed twice on db_backups/20261003-063702_pre_lab_station: run 1 lands the values above and 1,456 log rows; run 2
-- changes nothing. Take a snapshot from the main folder's app/, then run it from the worktree's app/:
--   node scripts/db-snapshot.mjs pre_repair_26087_26050
--   node scripts/repair-apply.mjs scripts/repairs/2026-10-03_26087_typos_and_26050_lot.sql

-- 1a. Void the 112,032 g tote.
INSERT INTO record_change_log (id, record_table, record_id, field, old_value, new_value, actor_person_id, reason, changed_at)
SELECT 'rp-2026-10-03-t1', 'wet_weights', '40a9d4a0-f8a1-4972-b077-8ffbf58c9f65', 'deleted_at', NULL, '2026-10-03T13:00:00.000Z', '7b59cf6b-04b6-4742-bb1b-78a28b593fe8', 'repair 2026-10-03 (canon 0.30.366): the owner voids the impossible tote on 26087, 112032 g', '2026-10-03T13:00:00.000Z'
WHERE NOT EXISTS (SELECT 1 FROM record_change_log WHERE id = 'rp-2026-10-03-t1')
  AND EXISTS (SELECT 1 FROM wet_weights WHERE id = '40a9d4a0-f8a1-4972-b077-8ffbf58c9f65' AND deleted_at IS NULL AND weight_grams = 112032);
UPDATE wet_weights SET deleted_at = '2026-10-03T13:00:00.000Z', deleted_by = '7b59cf6b-04b6-4742-bb1b-78a28b593fe8', updated_at = '2026-10-03T13:00:00.000Z', updated_by = '7b59cf6b-04b6-4742-bb1b-78a28b593fe8'
WHERE id = '40a9d4a0-f8a1-4972-b077-8ffbf58c9f65' AND deleted_at IS NULL AND weight_grams = 112032;

-- 1b. Void the 64,668,712 g tote.
INSERT INTO record_change_log (id, record_table, record_id, field, old_value, new_value, actor_person_id, reason, changed_at)
SELECT 'rp-2026-10-03-t2', 'wet_weights', '3f407ce4-078a-4b71-b565-a0b2047c4944', 'deleted_at', NULL, '2026-10-03T13:00:00.000Z', '7b59cf6b-04b6-4742-bb1b-78a28b593fe8', 'repair 2026-10-03 (canon 0.30.366): the owner voids the impossible tote on 26087, 64668712 g', '2026-10-03T13:00:00.000Z'
WHERE NOT EXISTS (SELECT 1 FROM record_change_log WHERE id = 'rp-2026-10-03-t2')
  AND EXISTS (SELECT 1 FROM wet_weights WHERE id = '3f407ce4-078a-4b71-b565-a0b2047c4944' AND deleted_at IS NULL AND weight_grams = 64668712);
UPDATE wet_weights SET deleted_at = '2026-10-03T13:00:00.000Z', deleted_by = '7b59cf6b-04b6-4742-bb1b-78a28b593fe8', updated_at = '2026-10-03T13:00:00.000Z', updated_by = '7b59cf6b-04b6-4742-bb1b-78a28b593fe8'
WHERE id = '3f407ce4-078a-4b71-b565-a0b2047c4944' AND deleted_at IS NULL AND weight_grams = 64668712;

-- 1c. The lot's weight to its remaining totes.
INSERT INTO record_change_log (id, record_table, record_id, field, old_value, new_value, actor_person_id, reason, changed_at)
SELECT 'rp-2026-10-03-l1', 'wet_weight_entries', 'fda40d60-fd78-4440-bdfc-8ed270db80c5', 'weight_grams', '71976728', '7195984', '7b59cf6b-04b6-4742-bb1b-78a28b593fe8', 'repair 2026-10-03 (canon 0.30.366): 26087 without its two voided totes', '2026-10-03T13:00:00.000Z'
WHERE NOT EXISTS (SELECT 1 FROM record_change_log WHERE id = 'rp-2026-10-03-l1')
  AND EXISTS (SELECT 1 FROM wet_weight_entries WHERE id = 'fda40d60-fd78-4440-bdfc-8ed270db80c5' AND deleted_at IS NULL AND weight_grams = 71976728);
UPDATE wet_weight_entries SET weight_grams = 7195984, updated_at = '2026-10-03T13:00:00.000Z', updated_by = '7b59cf6b-04b6-4742-bb1b-78a28b593fe8'
WHERE id = 'fda40d60-fd78-4440-bdfc-8ed270db80c5' AND deleted_at IS NULL AND weight_grams = 71976728;

-- 1d. Its SPR package the same.
INSERT INTO record_change_log (id, record_table, record_id, field, old_value, new_value, actor_person_id, reason, changed_at)
SELECT 'rp-2026-10-03-p1', 'local_inventory_items', '8c6711c0-247d-45ff-bb8d-5974d5dc9441', 'qty', '71976728', '7195984', '7b59cf6b-04b6-4742-bb1b-78a28b593fe8', 'repair 2026-10-03 (canon 0.30.366): 26087 without its two voided totes', '2026-10-03T13:00:00.000Z'
WHERE NOT EXISTS (SELECT 1 FROM record_change_log WHERE id = 'rp-2026-10-03-p1')
  AND EXISTS (SELECT 1 FROM local_inventory_items WHERE id = '8c6711c0-247d-45ff-bb8d-5974d5dc9441' AND deleted_at IS NULL AND qty = 71976728);
UPDATE local_inventory_items SET qty = 7195984, updated_at = '2026-10-03T13:00:00.000Z', updated_by = '7b59cf6b-04b6-4742-bb1b-78a28b593fe8'
WHERE id = '8c6711c0-247d-45ff-bb8d-5974d5dc9441' AND deleted_at IS NULL AND qty = 71976728;

-- 2a. The stray lot to HBN 26087.
INSERT INTO record_change_log (id, record_table, record_id, field, old_value, new_value, actor_person_id, reason, changed_at)
SELECT 'rp-2026-10-03-l2', 'wet_weight_entries', 'bc68392f-7edb-4a44-b2f4-5597af182a30', 'harvest_batch_id', '8c3a7df9-e4c0-4976-a757-80d5d49df9fd', '31db9280-64fe-4b38-ae95-7aa37cb60ea2', '7b59cf6b-04b6-4742-bb1b-78a28b593fe8', 'repair 2026-10-03 (canon 0.30.366): the lot weighed under the stale HBN 26050 is 26087 material', '2026-10-03T13:00:00.000Z'
WHERE NOT EXISTS (SELECT 1 FROM record_change_log WHERE id = 'rp-2026-10-03-l2')
  AND EXISTS (SELECT 1 FROM wet_weight_entries WHERE id = 'bc68392f-7edb-4a44-b2f4-5597af182a30' AND deleted_at IS NULL AND harvest_batch_id = '8c3a7df9-e4c0-4976-a757-80d5d49df9fd');
UPDATE wet_weight_entries SET harvest_batch_id = '31db9280-64fe-4b38-ae95-7aa37cb60ea2', updated_at = '2026-10-03T13:00:00.000Z', updated_by = '7b59cf6b-04b6-4742-bb1b-78a28b593fe8'
WHERE id = 'bc68392f-7edb-4a44-b2f4-5597af182a30' AND deleted_at IS NULL AND harvest_batch_id = '8c3a7df9-e4c0-4976-a757-80d5d49df9fd';

-- 2b. Its 622 totes.
INSERT INTO record_change_log (id, record_table, record_id, field, old_value, new_value, actor_person_id, reason, changed_at)
SELECT 'rp-2026-10-03-ww-' || x.id, 'wet_weights', x.id, 'harvest_batch_id', x.harvest_batch_id, '31db9280-64fe-4b38-ae95-7aa37cb60ea2', '7b59cf6b-04b6-4742-bb1b-78a28b593fe8', 'repair 2026-10-03 (canon 0.30.366): the tote weighed under the stale HBN 26050 is 26087 material', '2026-10-03T13:00:00.000Z'
FROM wet_weights x
WHERE x.wet_weight_entry_id = 'bc68392f-7edb-4a44-b2f4-5597af182a30' AND x.deleted_at IS NULL AND x.harvest_batch_id = '8c3a7df9-e4c0-4976-a757-80d5d49df9fd'
  AND NOT EXISTS (SELECT 1 FROM record_change_log l WHERE l.id = 'rp-2026-10-03-ww-' || x.id);
UPDATE wet_weights SET harvest_batch_id = '31db9280-64fe-4b38-ae95-7aa37cb60ea2', updated_at = '2026-10-03T13:00:00.000Z', updated_by = '7b59cf6b-04b6-4742-bb1b-78a28b593fe8'
WHERE wet_weight_entry_id = 'bc68392f-7edb-4a44-b2f4-5597af182a30' AND deleted_at IS NULL AND harvest_batch_id = '8c3a7df9-e4c0-4976-a757-80d5d49df9fd';

-- 2c. Its 827 plant tags.
INSERT INTO record_change_log (id, record_table, record_id, field, old_value, new_value, actor_person_id, reason, changed_at)
SELECT 'rp-2026-10-03-pt-' || t.id, 'harvest_plant_tags', t.id, 'harvest_batch_id', t.harvest_batch_id, '31db9280-64fe-4b38-ae95-7aa37cb60ea2', '7b59cf6b-04b6-4742-bb1b-78a28b593fe8', 'repair 2026-10-03 (canon 0.30.366): the plant tag harvested under the stale HBN 26050 is 26087 material', '2026-10-03T13:00:00.000Z'
FROM harvest_plant_tags t
WHERE t.wet_weight_entry_id = 'bc68392f-7edb-4a44-b2f4-5597af182a30' AND t.deleted_at IS NULL AND t.harvest_batch_id = '8c3a7df9-e4c0-4976-a757-80d5d49df9fd'
  AND NOT EXISTS (SELECT 1 FROM record_change_log l WHERE l.id = 'rp-2026-10-03-pt-' || t.id);
UPDATE harvest_plant_tags SET harvest_batch_id = '31db9280-64fe-4b38-ae95-7aa37cb60ea2', updated_at = '2026-10-03T13:00:00.000Z', updated_by = '7b59cf6b-04b6-4742-bb1b-78a28b593fe8'
WHERE wet_weight_entry_id = 'bc68392f-7edb-4a44-b2f4-5597af182a30' AND deleted_at IS NULL AND harvest_batch_id = '8c3a7df9-e4c0-4976-a757-80d5d49df9fd';

-- 2d. Its WIP package: the HBN, and the code to 26087.
INSERT INTO record_change_log (id, record_table, record_id, field, old_value, new_value, actor_person_id, reason, changed_at)
SELECT 'rp-2026-10-03-p2', 'local_inventory_items', '75f1b73f-6a38-4c3e-86ec-3b588de77592', 'harvest_batch_id', '8c3a7df9-e4c0-4976-a757-80d5d49df9fd', '31db9280-64fe-4b38-ae95-7aa37cb60ea2', '7b59cf6b-04b6-4742-bb1b-78a28b593fe8', 'repair 2026-10-03 (canon 0.30.366): the package of the lot weighed under the stale HBN 26050 is 26087 material', '2026-10-03T13:00:00.000Z'
WHERE NOT EXISTS (SELECT 1 FROM record_change_log WHERE id = 'rp-2026-10-03-p2')
  AND EXISTS (SELECT 1 FROM local_inventory_items WHERE id = '75f1b73f-6a38-4c3e-86ec-3b588de77592' AND deleted_at IS NULL AND harvest_batch_id = '8c3a7df9-e4c0-4976-a757-80d5d49df9fd');
INSERT INTO record_change_log (id, record_table, record_id, field, old_value, new_value, actor_person_id, reason, changed_at)
SELECT 'rp-2026-10-03-p3', 'local_inventory_items', '75f1b73f-6a38-4c3e-86ec-3b588de77592', 'package_code', '26050', '26087', '7b59cf6b-04b6-4742-bb1b-78a28b593fe8', 'repair 2026-10-03 (canon 0.30.366): the package of the lot weighed under the stale HBN 26050 is 26087 material', '2026-10-03T13:00:00.000Z'
WHERE NOT EXISTS (SELECT 1 FROM record_change_log WHERE id = 'rp-2026-10-03-p3')
  AND EXISTS (SELECT 1 FROM local_inventory_items WHERE id = '75f1b73f-6a38-4c3e-86ec-3b588de77592' AND deleted_at IS NULL AND package_code = '26050');
UPDATE local_inventory_items SET harvest_batch_id = '31db9280-64fe-4b38-ae95-7aa37cb60ea2', package_code = '26087', updated_at = '2026-10-03T13:00:00.000Z', updated_by = '7b59cf6b-04b6-4742-bb1b-78a28b593fe8'
WHERE id = '75f1b73f-6a38-4c3e-86ec-3b588de77592' AND deleted_at IS NULL AND harvest_batch_id = '8c3a7df9-e4c0-4976-a757-80d5d49df9fd' AND package_code = '26050';

-- 3. 26068 TO MATCH METRC (canon 0.30.368). The owner, 2026-10-03, verbatim: "METRC is the book of record" and "Make 26068
--    match METRC beat-for-beat." METRC holds three Headband WIP packages packaged 2026-09-28: 26067 tag ...056844
--    1,071,130 g; 26068 tag ...056845 1,158,230 g; 26070 tag ...056847 827,970 g. The app weighed 26068's plants under
--    26067: lot 23cbbbb3 (Silo 2, 26068's planned silo; 697 totes, 4,771,434 g wet; dry 1,158,230 g; 1,032 plant tags;
--    WIP package e00de1d8 coded 26067) is 26068 to the gram. The lot, its totes, its plant tags and its package move to
--    HBN 26068 (1861e241); the package takes the code 26068 and METRC's tag. 26067 keeps lot cad4fabc (dry 1,071,130 g,
--    METRC's 26067). The dry weights, the unload session and the silo load hang on the lot and need no change.

-- 3a. The lot.
INSERT INTO record_change_log (id, record_table, record_id, field, old_value, new_value, actor_person_id, reason, changed_at)
SELECT 'rp-2026-10-03-l3', 'wet_weight_entries', '23cbbbb3-02b7-4b43-a7f9-62263a1d65be', 'harvest_batch_id', '2b7bcce7-81ca-44f7-aa7d-12c21db980bb', '1861e241-df07-4552-8032-7a61e71872cb', '7b59cf6b-04b6-4742-bb1b-78a28b593fe8', 'repair 2026-10-03 (canon 0.30.368): METRC is the book of record; this lot is 26068 (METRC package 1A40503000311FB000056845, 1158230 g)', '2026-10-03T13:00:00.000Z'
WHERE NOT EXISTS (SELECT 1 FROM record_change_log WHERE id = 'rp-2026-10-03-l3')
  AND EXISTS (SELECT 1 FROM wet_weight_entries WHERE id = '23cbbbb3-02b7-4b43-a7f9-62263a1d65be' AND deleted_at IS NULL AND harvest_batch_id = '2b7bcce7-81ca-44f7-aa7d-12c21db980bb');
UPDATE wet_weight_entries SET harvest_batch_id = '1861e241-df07-4552-8032-7a61e71872cb', updated_at = '2026-10-03T13:00:00.000Z', updated_by = '7b59cf6b-04b6-4742-bb1b-78a28b593fe8'
WHERE id = '23cbbbb3-02b7-4b43-a7f9-62263a1d65be' AND deleted_at IS NULL AND harvest_batch_id = '2b7bcce7-81ca-44f7-aa7d-12c21db980bb';

-- 3b. Its 697 totes.
INSERT INTO record_change_log (id, record_table, record_id, field, old_value, new_value, actor_person_id, reason, changed_at)
SELECT 'rp-2026-10-03-ww-' || x.id, 'wet_weights', x.id, 'harvest_batch_id', x.harvest_batch_id, '1861e241-df07-4552-8032-7a61e71872cb', '7b59cf6b-04b6-4742-bb1b-78a28b593fe8', 'repair 2026-10-03 (canon 0.30.368): METRC is the book of record; this tote is 26068', '2026-10-03T13:00:00.000Z'
FROM wet_weights x
WHERE x.wet_weight_entry_id = '23cbbbb3-02b7-4b43-a7f9-62263a1d65be' AND x.deleted_at IS NULL AND x.harvest_batch_id = '2b7bcce7-81ca-44f7-aa7d-12c21db980bb'
  AND NOT EXISTS (SELECT 1 FROM record_change_log l WHERE l.id = 'rp-2026-10-03-ww-' || x.id);
UPDATE wet_weights SET harvest_batch_id = '1861e241-df07-4552-8032-7a61e71872cb', updated_at = '2026-10-03T13:00:00.000Z', updated_by = '7b59cf6b-04b6-4742-bb1b-78a28b593fe8'
WHERE wet_weight_entry_id = '23cbbbb3-02b7-4b43-a7f9-62263a1d65be' AND deleted_at IS NULL AND harvest_batch_id = '2b7bcce7-81ca-44f7-aa7d-12c21db980bb';

-- 3c. Its 1,032 plant tags.
INSERT INTO record_change_log (id, record_table, record_id, field, old_value, new_value, actor_person_id, reason, changed_at)
SELECT 'rp-2026-10-03-pt-' || t.id, 'harvest_plant_tags', t.id, 'harvest_batch_id', t.harvest_batch_id, '1861e241-df07-4552-8032-7a61e71872cb', '7b59cf6b-04b6-4742-bb1b-78a28b593fe8', 'repair 2026-10-03 (canon 0.30.368): METRC is the book of record; this plant tag is 26068', '2026-10-03T13:00:00.000Z'
FROM harvest_plant_tags t
WHERE t.wet_weight_entry_id = '23cbbbb3-02b7-4b43-a7f9-62263a1d65be' AND t.deleted_at IS NULL AND t.harvest_batch_id = '2b7bcce7-81ca-44f7-aa7d-12c21db980bb'
  AND NOT EXISTS (SELECT 1 FROM record_change_log l WHERE l.id = 'rp-2026-10-03-pt-' || t.id);
UPDATE harvest_plant_tags SET harvest_batch_id = '1861e241-df07-4552-8032-7a61e71872cb', updated_at = '2026-10-03T13:00:00.000Z', updated_by = '7b59cf6b-04b6-4742-bb1b-78a28b593fe8'
WHERE wet_weight_entry_id = '23cbbbb3-02b7-4b43-a7f9-62263a1d65be' AND deleted_at IS NULL AND harvest_batch_id = '2b7bcce7-81ca-44f7-aa7d-12c21db980bb';

-- 3d. Its WIP package: the HBN, the code 26068, METRC's tag.
INSERT INTO record_change_log (id, record_table, record_id, field, old_value, new_value, actor_person_id, reason, changed_at)
SELECT 'rp-2026-10-03-p4', 'local_inventory_items', 'e00de1d8-5633-4f21-88ec-34a0c64c35c6', 'harvest_batch_id', '2b7bcce7-81ca-44f7-aa7d-12c21db980bb', '1861e241-df07-4552-8032-7a61e71872cb', '7b59cf6b-04b6-4742-bb1b-78a28b593fe8', 'repair 2026-10-03 (canon 0.30.368): METRC is the book of record; this package is 26068', '2026-10-03T13:00:00.000Z'
WHERE NOT EXISTS (SELECT 1 FROM record_change_log WHERE id = 'rp-2026-10-03-p4')
  AND EXISTS (SELECT 1 FROM local_inventory_items WHERE id = 'e00de1d8-5633-4f21-88ec-34a0c64c35c6' AND deleted_at IS NULL AND harvest_batch_id = '2b7bcce7-81ca-44f7-aa7d-12c21db980bb');
INSERT INTO record_change_log (id, record_table, record_id, field, old_value, new_value, actor_person_id, reason, changed_at)
SELECT 'rp-2026-10-03-p5', 'local_inventory_items', 'e00de1d8-5633-4f21-88ec-34a0c64c35c6', 'package_code', '26067', '26068', '7b59cf6b-04b6-4742-bb1b-78a28b593fe8', 'repair 2026-10-03 (canon 0.30.368): METRC is the book of record; this package is 26068', '2026-10-03T13:00:00.000Z'
WHERE NOT EXISTS (SELECT 1 FROM record_change_log WHERE id = 'rp-2026-10-03-p5')
  AND EXISTS (SELECT 1 FROM local_inventory_items WHERE id = 'e00de1d8-5633-4f21-88ec-34a0c64c35c6' AND deleted_at IS NULL AND package_code = '26067');
INSERT INTO record_change_log (id, record_table, record_id, field, old_value, new_value, actor_person_id, reason, changed_at)
SELECT 'rp-2026-10-03-p6', 'local_inventory_items', 'e00de1d8-5633-4f21-88ec-34a0c64c35c6', 'metrc_tag', NULL, '1A40503000311FB000056845', '7b59cf6b-04b6-4742-bb1b-78a28b593fe8', 'repair 2026-10-03 (canon 0.30.368): METRC is the book of record; METRC package 1A40503000311FB000056845, 1158230 g, packaged 2026-09-28', '2026-10-03T13:00:00.000Z'
WHERE NOT EXISTS (SELECT 1 FROM record_change_log WHERE id = 'rp-2026-10-03-p6')
  AND EXISTS (SELECT 1 FROM local_inventory_items WHERE id = 'e00de1d8-5633-4f21-88ec-34a0c64c35c6' AND deleted_at IS NULL AND metrc_tag IS NULL);
UPDATE local_inventory_items SET harvest_batch_id = '1861e241-df07-4552-8032-7a61e71872cb', package_code = '26068', metrc_tag = '1A40503000311FB000056845', updated_at = '2026-10-03T13:00:00.000Z', updated_by = '7b59cf6b-04b6-4742-bb1b-78a28b593fe8'
WHERE id = 'e00de1d8-5633-4f21-88ec-34a0c64c35c6' AND deleted_at IS NULL AND harvest_batch_id = '2b7bcce7-81ca-44f7-aa7d-12c21db980bb' AND package_code = '26067' AND metrc_tag IS NULL;
