-- THE FINISH STAMP REPAIR OF 2026-10-02 (canon 0.30.346). The owner, 2026-10-02, verbatim: "there are two stale
-- HBNs that suddenly became available today, I'm not sure if the operator is doing it or not." It was not the
-- operator. Migration 0087 (V16) backfilled wet_weight_entries.finished_at from the NEWEST status move off weighing;
-- a lot finished weeks ago whose newest move (unloaded, trimmed) happened after 06:00 today took today as its
-- finish, and the HBN Queue and the field node's HBN select keep an HBN whose lot finished since the farm day
-- began. On the 09:28 snapshot that was 26048 (PNN), 26049 and 26050 (PNS), all trimmed this morning, finished
-- 2026-09-23 and 2026-09-24. The law the brief meant: the FIRST move off weighing is the finish.
--
-- This file sets finished_at to the lot's first logged move from weighing to any other status wherever the stored
-- stamp is later than that move, logs every change under the owner's login with this reason, and touches nothing
-- else. A second run changes nothing (the guard is the inequality). Run from the worktree's app/:
--   node scripts/repair-apply.mjs scripts/repairs/2026-10-02_finished_at_first_finish.sql
-- Then: node scripts/db-snapshot.mjs post_finished_at

INSERT INTO record_change_log (id, record_table, record_id, field, old_value, new_value, actor_person_id, reason, changed_at)
SELECT 'fa-2026-10-02-' || w.id, 'wet_weight_entries', w.id, 'finished_at', w.finished_at,
       (SELECT MIN(l.changed_at) FROM record_change_log l
         WHERE l.record_table = 'wet_weight_entries' AND l.record_id = w.id AND l.field = 'status'
           AND l.old_value = 'weighing' AND l.new_value IS NOT NULL AND l.new_value <> 'weighing'),
       '7b59cf6b-04b6-4742-bb1b-78a28b593fe8',
       'repair 2026-10-02 (canon 0.30.346): the finish stamp is the first move off weighing, not the newest status move (0087''s backfill)',
       '2026-10-02T17:00:00.000Z'
  FROM wet_weight_entries w
 WHERE w.deleted_at IS NULL AND w.status <> 'weighing' AND w.finished_at IS NOT NULL
   AND w.finished_at > (SELECT MIN(l.changed_at) FROM record_change_log l
         WHERE l.record_table = 'wet_weight_entries' AND l.record_id = w.id AND l.field = 'status'
           AND l.old_value = 'weighing' AND l.new_value IS NOT NULL AND l.new_value <> 'weighing')
   AND NOT EXISTS (SELECT 1 FROM record_change_log x WHERE x.id = 'fa-2026-10-02-' || w.id);

UPDATE wet_weight_entries
   SET finished_at = (SELECT MIN(l.changed_at) FROM record_change_log l
         WHERE l.record_table = 'wet_weight_entries' AND l.record_id = wet_weight_entries.id AND l.field = 'status'
           AND l.old_value = 'weighing' AND l.new_value IS NOT NULL AND l.new_value <> 'weighing')
 WHERE deleted_at IS NULL AND status <> 'weighing' AND finished_at IS NOT NULL
   AND finished_at > (SELECT MIN(l.changed_at) FROM record_change_log l
         WHERE l.record_table = 'wet_weight_entries' AND l.record_id = wet_weight_entries.id AND l.field = 'status'
           AND l.old_value = 'weighing' AND l.new_value IS NOT NULL AND l.new_value <> 'weighing');
