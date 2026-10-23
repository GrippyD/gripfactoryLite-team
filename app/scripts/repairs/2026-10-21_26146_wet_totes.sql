-- THE 26146 WET TOTES REPAIR OF 2026-10-21 (canon 0.30.533). Lot 26146 (26289-PNN-OD-051-0-03-26146, Papaya Cake,
-- PNN, Oct 16) reads 0 g wet in the app while its sister lot 26145 (26289-PNN-OD-051-0-05-26145) carries all 1,274
-- totes of that morning, 9,407,612 g. The opsdash (26H.Operations Dashboard, Harvest Details rows 184 and 185) says
-- 26145 wet 4,570,404 g and 26146 wet 4,837,208 g: the two together are the app's 9,407,612 to the gram. The dry
-- weights are already right per lot. The owner's pick (2026-10-21): move the last 656 totes by time to 26146 (the cut
-- after the 618th tote, 2026-10-16T14:01:59.152Z), so 26145 reads 4,573,008 g and 26146 reads 4,834,604 g, within
-- 6 lb of the sheet with every tote kept; 26146's one 0 g tote is voided.
--
-- Every change is guarded on the value it replaces and logged under the owner's login; a second run changes nothing.
-- Rehearsed twice on the live-data bench (the 10-17 snapshot): run 1 moves 656 totes, voids 1, updates 2 entries,
-- writes 4 log rows; run 2 changes nothing. Take a snapshot from the main folder's app/, then run it from the same app/:
--   node scripts/db-snapshot.mjs pre_repair_26146
--   node scripts/repair-apply.mjs scripts/repairs/2026-10-21_26146_wet_totes.sql

-- 1. The log row for the move, written only while the totes still sit on 26145.
INSERT INTO record_change_log (id, record_table, record_id, field, old_value, new_value, actor_person_id, reason, changed_at)
SELECT 'rp-2026-10-21-w1', 'wet_weights', '89af2df1-5ee5-420d-b31b-4ec616e0dd3d', 'wet_weight_entry_id', '4c5fc62b-9deb-4f31-a893-e76b8c3b3e73', '89af2df1-5ee5-420d-b31b-4ec616e0dd3d', '7b59cf6b-04b6-4742-bb1b-78a28b593fe8', 'repair 2026-10-21 (canon 0.30.533): the 656 totes weighed after 2026-10-16T14:01:59.152Z move from 26145 to 26146 per the opsdash', '2026-10-21T21:00:00.000Z'
WHERE NOT EXISTS (SELECT 1 FROM record_change_log WHERE id = 'rp-2026-10-21-w1')
  AND (SELECT COUNT(*) FROM wet_weights WHERE wet_weight_entry_id = '4c5fc62b-9deb-4f31-a893-e76b8c3b3e73' AND deleted_at IS NULL AND created_at > '2026-10-16T14:01:59.152Z') = 656;

-- 2. The move: the totes of 26145 weighed after the cut become 26146's.
UPDATE wet_weights SET wet_weight_entry_id = '89af2df1-5ee5-420d-b31b-4ec616e0dd3d', updated_at = '2026-10-21T21:00:00.000Z', updated_by = '7b59cf6b-04b6-4742-bb1b-78a28b593fe8'
WHERE wet_weight_entry_id = '4c5fc62b-9deb-4f31-a893-e76b8c3b3e73' AND deleted_at IS NULL AND created_at > '2026-10-16T14:01:59.152Z';

-- 3. The 0 g tote on 26146 (created at its finish) is voided.
INSERT INTO record_change_log (id, record_table, record_id, field, old_value, new_value, actor_person_id, reason, changed_at)
SELECT 'rp-2026-10-21-w2', 'wet_weights', id, 'deleted_at', NULL, '2026-10-21T21:00:00.000Z', '7b59cf6b-04b6-4742-bb1b-78a28b593fe8', 'repair 2026-10-21 (canon 0.30.533): the 0 g tote on 26146 voided', '2026-10-21T21:00:00.000Z'
FROM wet_weights
WHERE wet_weight_entry_id = '89af2df1-5ee5-420d-b31b-4ec616e0dd3d' AND deleted_at IS NULL AND weight_grams = 0
  AND NOT EXISTS (SELECT 1 FROM record_change_log WHERE id = 'rp-2026-10-21-w2');
UPDATE wet_weights SET deleted_at = '2026-10-21T21:00:00.000Z', deleted_by = '7b59cf6b-04b6-4742-bb1b-78a28b593fe8'
WHERE wet_weight_entry_id = '89af2df1-5ee5-420d-b31b-4ec616e0dd3d' AND deleted_at IS NULL AND weight_grams = 0;

-- 4. The lots' wet totals follow their live totes.
INSERT INTO record_change_log (id, record_table, record_id, field, old_value, new_value, actor_person_id, reason, changed_at)
SELECT 'rp-2026-10-21-w3', 'wet_weight_entries', '4c5fc62b-9deb-4f31-a893-e76b8c3b3e73', 'weight_grams', '9407612', '4573008', '7b59cf6b-04b6-4742-bb1b-78a28b593fe8', 'repair 2026-10-21 (canon 0.30.533): 26145 wet after its 656 totes moved to 26146', '2026-10-21T21:00:00.000Z'
WHERE NOT EXISTS (SELECT 1 FROM record_change_log WHERE id = 'rp-2026-10-21-w3')
  AND EXISTS (SELECT 1 FROM wet_weight_entries WHERE id = '4c5fc62b-9deb-4f31-a893-e76b8c3b3e73' AND weight_grams = 9407612);
UPDATE wet_weight_entries SET weight_grams = 4573008, updated_at = '2026-10-21T21:00:00.000Z', updated_by = '7b59cf6b-04b6-4742-bb1b-78a28b593fe8'
WHERE id = '4c5fc62b-9deb-4f31-a893-e76b8c3b3e73' AND weight_grams = 9407612
  AND (SELECT COALESCE(SUM(weight_grams), 0) FROM wet_weights WHERE wet_weight_entry_id = '4c5fc62b-9deb-4f31-a893-e76b8c3b3e73' AND deleted_at IS NULL) = 4573008;

INSERT INTO record_change_log (id, record_table, record_id, field, old_value, new_value, actor_person_id, reason, changed_at)
SELECT 'rp-2026-10-21-w4', 'wet_weight_entries', '89af2df1-5ee5-420d-b31b-4ec616e0dd3d', 'weight_grams', '0', '4834604', '7b59cf6b-04b6-4742-bb1b-78a28b593fe8', 'repair 2026-10-21 (canon 0.30.533): 26146 wet from its 656 totes per the opsdash', '2026-10-21T21:00:00.000Z'
WHERE NOT EXISTS (SELECT 1 FROM record_change_log WHERE id = 'rp-2026-10-21-w4')
  AND EXISTS (SELECT 1 FROM wet_weight_entries WHERE id = '89af2df1-5ee5-420d-b31b-4ec616e0dd3d' AND weight_grams = 0);
UPDATE wet_weight_entries SET weight_grams = 4834604, updated_at = '2026-10-21T21:00:00.000Z', updated_by = '7b59cf6b-04b6-4742-bb1b-78a28b593fe8'
WHERE id = '89af2df1-5ee5-420d-b31b-4ec616e0dd3d' AND weight_grams = 0
  AND (SELECT COALESCE(SUM(weight_grams), 0) FROM wet_weights WHERE wet_weight_entry_id = '89af2df1-5ee5-420d-b31b-4ec616e0dd3d' AND deleted_at IS NULL) = 4834604;
