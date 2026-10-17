-- THE 56801 BACKTICK REPAIR OF 2026-10-17 (canon 0.30.508). The owner, 2026-10-17: everything that says no tag likely
-- inherited its tag from trim, and trim likely only put 5 digits in. The Scribe's look: 43 of 45 trim container codes
-- on the pasteurization runs are the last 5 of their harvest's METRC WIP package. One of the two that are not is a
-- keying slip: container e611499d on 26010 (BUD, 9,276 g, in the Cryo Queue) carries 56801 with a stray backtick, and
-- its ledger item d09271f5 carries the same. Both become 56801, the code of 26010's METRC package
-- 1A40503000311FB000056801. The other (a 26055 container keyed 56833) waits on the floor's answer.
--
-- Every change is guarded on the value it replaces and logged under the owner's login; a second run changes nothing.
-- Rehearsed twice on the live-data bench: run 1 changes 2 rows and writes 2 log rows; run 2 changes nothing.
-- Take a snapshot from the main folder's app/, then run it from the worktree's app/:
--   node scripts/db-snapshot.mjs pre_repair_56801
--   node scripts/repair-apply.mjs scripts/repairs/2026-10-17_56801_backtick.sql

-- 1. The container.
INSERT INTO record_change_log (id, record_table, record_id, field, old_value, new_value, actor_person_id, reason, changed_at)
SELECT 'rp-2026-10-17-bt1', 'wip_packages', 'e611499d-8c71-4211-a44b-4277c97d63b0', 'package_code', '56801`', '56801', '7b59cf6b-04b6-4742-bb1b-78a28b593fe8', 'repair 2026-10-17 (canon 0.30.508): a stray backtick keyed at trim', '2026-10-17T22:00:00.000Z'
WHERE NOT EXISTS (SELECT 1 FROM record_change_log WHERE id = 'rp-2026-10-17-bt1')
  AND EXISTS (SELECT 1 FROM wip_packages WHERE id = 'e611499d-8c71-4211-a44b-4277c97d63b0' AND package_code = '56801`');
UPDATE wip_packages SET package_code = '56801', updated_at = '2026-10-17T22:00:00.000Z', updated_by = '7b59cf6b-04b6-4742-bb1b-78a28b593fe8'
WHERE id = 'e611499d-8c71-4211-a44b-4277c97d63b0' AND package_code = '56801`';

-- 2. Its ledger item.
INSERT INTO record_change_log (id, record_table, record_id, field, old_value, new_value, actor_person_id, reason, changed_at)
SELECT 'rp-2026-10-17-bt2', 'local_inventory_items', 'd09271f5-57a2-42dd-be74-f063d12eea4d', 'package_code', '56801`', '56801', '7b59cf6b-04b6-4742-bb1b-78a28b593fe8', 'repair 2026-10-17 (canon 0.30.508): a stray backtick keyed at trim', '2026-10-17T22:00:00.000Z'
WHERE NOT EXISTS (SELECT 1 FROM record_change_log WHERE id = 'rp-2026-10-17-bt2')
  AND EXISTS (SELECT 1 FROM local_inventory_items WHERE id = 'd09271f5-57a2-42dd-be74-f063d12eea4d' AND package_code = '56801`');
UPDATE local_inventory_items SET package_code = '56801', updated_at = '2026-10-17T22:00:00.000Z', updated_by = '7b59cf6b-04b6-4742-bb1b-78a28b593fe8'
WHERE id = 'd09271f5-57a2-42dd-be74-f063d12eea4d' AND package_code = '56801`';
