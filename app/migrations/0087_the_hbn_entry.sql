-- 0087: BRIEF V16, THE HBN ENTRY (canon 0.30.341). The owner, 2026-10-02,
-- verbatim: "new wet weights are classing everything as spears and hang in
-- place.  Add the bucked/spears toggle to the HBN entry, remove "move-to"
-- altogether.  The HBN being made defaults to the next silo in sequence for
-- scheduling purposes, it can be changed by drop down before the HBN is
-- minted (Arlington dry room and the blast freezer will count as silo 6 and 7
-- for our sequence)". Under THE DISPATCH RULE (canon 0.30.155) the HBN decides
-- a lot's form and its space.
--
-- 1. The HBN's form, spear or bucked. Existing HBNs read bucked (the floor's
--    54 of 63 lots are bucked; the field node's spear default is the
--    complaint); the owner's repair file sets any that should read spear.
ALTER TABLE harvest_batches ADD COLUMN material_form TEXT NOT NULL DEFAULT 'bucked';

-- 2. The instant Finish lot moved the lot off weighing, so the HBN Queue keeps
--    an HBN finished this farm day whatever day its lot started. Backfill: for
--    every live lot whose status is not weighing, the newest record_change_log
--    row for that lot whose field is status and whose new value is not
--    weighing, else the lot's updated_at.
ALTER TABLE wet_weight_entries ADD COLUMN finished_at TEXT;

UPDATE wet_weight_entries
   SET finished_at = COALESCE(
     (SELECT MAX(l.changed_at) FROM record_change_log l
       WHERE l.record_table = 'wet_weight_entries' AND l.record_id = wet_weight_entries.id
         AND l.field = 'status' AND l.new_value IS NOT NULL AND l.new_value <> 'weighing'),
     updated_at)
 WHERE deleted_at IS NULL AND status <> 'weighing';

-- 3. The sequence's sixth and seventh numbers on the Silo pick list (the
--    Arlington Dry Room and the Blast Freezer(s) by their place in the drying
--    strip's order); NA retires from the pick list and stays in data (existing
--    HBNs keep their NA).
INSERT OR IGNORE INTO lookup_values (
  id, category, value, label, sort_order,
  created_at, created_by, updated_at, updated_by, deleted_at, deleted_by
) VALUES
  ('a2000001-0001-4000-8000-000000000007', 'silo_number', '6', '6 Arlington Dry Room', 6, '2026-10-02T00:00:00.000Z', NULL, '2026-10-02T00:00:00.000Z', NULL, NULL, NULL),
  ('a2000001-0001-4000-8000-000000000008', 'silo_number', '7', '7 Blast Freezer(s)', 7, '2026-10-02T00:00:00.000Z', NULL, '2026-10-02T00:00:00.000Z', NULL, NULL, NULL);

UPDATE lookup_values SET deleted_at = '2026-10-02T00:00:00.000Z', updated_at = '2026-10-02T00:00:00.000Z'
 WHERE id = 'a2000001-0001-4000-8000-000000000006' AND category = 'silo_number' AND deleted_at IS NULL;
