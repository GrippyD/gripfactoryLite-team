-- THE PLANT COUNT OF 26039 (canon 0.30.218). Owner, 2026-09-24, on the question tool, verbatim: 932, the sheet's (Recommended)
-- The lot 26265-ARL-OD-009-0-04-26039 carried plant_count 686 from Finish lot, 764 live plant tags after the repair of
-- 0.30.213 (the phantom 26040's tags moved to it), and the Harvest Details sheet reads 932 plants. THE TWO BOOKS OF
-- RECORD (0.30.203): the sheet is the book of record for reality, so the count follows the sheet. The 764 tags stay as
-- they are and the 168 plants without a tag in the app stay a known gap.
--
-- One UPDATE guarded by the value it expects and one log row guarded by NOT EXISTS, so a second run changes nothing;
-- the change lands in record_change_log under the owner's login with this repair's reason and the fixed stamp 2026-09-24T14:40:00.000Z.
-- Run from app/ at the owner's keyboard:
--   node scripts/repair-apply.mjs scripts/repairs/2026-09-24_26039_plant_count.sql
-- Then: node scripts/db-snapshot.mjs post_26039_plants

UPDATE wet_weight_entries SET plant_count = 932, updated_at = '2026-09-24T14:40:00.000Z', updated_by = '7b59cf6b-04b6-4742-bb1b-78a28b593fe8'
WHERE id = 'ec39dd78-1a98-429c-8fcf-35b7bf98fedd' AND plant_count = 686 AND deleted_at IS NULL;
INSERT INTO record_change_log (id, record_table, record_id, field, old_value, new_value, actor_person_id, reason, changed_at)
SELECT 'b1ba1c34-cdce-5eb6-9609-6ca4a08ada6d', 'wet_weight_entries', 'ec39dd78-1a98-429c-8fcf-35b7bf98fedd', 'plant_count', '686', '932', '7b59cf6b-04b6-4742-bb1b-78a28b593fe8', 'repair 2026-09-24 (canon 0.30.218), the owner''s pick on the question tool: 26039 plant_count 686 (typed at Finish lot) to 932, the Harvest Details sheet''s count; 764 tags stand in the app, 168 plants have no tag', '2026-09-24T14:40:00.000Z'
WHERE NOT EXISTS (SELECT 1 FROM record_change_log WHERE record_table = 'wet_weight_entries' AND record_id = 'ec39dd78-1a98-429c-8fcf-35b7bf98fedd' AND field = 'plant_count' AND reason = 'repair 2026-09-24 (canon 0.30.218), the owner''s pick on the question tool: 26039 plant_count 686 (typed at Finish lot) to 932, the Harvest Details sheet''s count; 764 tags stand in the app, 168 plants have no tag');
