-- 0095: MANUAL HBNS IN PHANTOM ORDER, AND TEST HBNS (canon 0.30.420).
-- A test HBN holds no place in the year's line. The two rows the repair parked
-- at harvest year 2000 come back to 2026 as tests, serials 90001 and 90002
-- by created_at. A row already marked is left. Logged under the owner's id.

ALTER TABLE harvest_batches ADD COLUMN is_test INTEGER NOT NULL DEFAULT 0;

INSERT INTO record_change_log (id, record_table, record_id, field, old_value, new_value, actor_person_id, reason, changed_at)
SELECT '0095-is_test-' || id, 'harvest_batches', id, 'is_test', '0', '1',
       '7b59cf6b-04b6-4742-bb1b-78a28b593fe8',
       'migration 0095 (canon 0.30.420): a parked test returns to harvest year 2026 and holds no slot',
       '2026-10-08T02:00:00.000Z'
FROM harvest_batches
WHERE harvest_year = 2000 AND is_test = 0
  AND NOT EXISTS (SELECT 1 FROM record_change_log WHERE id = '0095-is_test-' || harvest_batches.id);

INSERT INTO record_change_log (id, record_table, record_id, field, old_value, new_value, actor_person_id, reason, changed_at)
SELECT '0095-harvest_year-' || id, 'harvest_batches', id, 'harvest_year', '2000', '2026',
       '7b59cf6b-04b6-4742-bb1b-78a28b593fe8',
       'migration 0095 (canon 0.30.420): a parked test returns to harvest year 2026 and holds no slot',
       '2026-10-08T02:00:00.000Z'
FROM harvest_batches
WHERE harvest_year = 2000 AND is_test = 0
  AND NOT EXISTS (SELECT 1 FROM record_change_log WHERE id = '0095-harvest_year-' || harvest_batches.id);

INSERT INTO record_change_log (id, record_table, record_id, field, old_value, new_value, actor_person_id, reason, changed_at)
SELECT '0095-lot_serial-' || id, 'harvest_batches', id, 'lot_serial', CAST(lot_serial AS TEXT),
       CAST(90000 + ROW_NUMBER() OVER (ORDER BY created_at, id) AS TEXT),
       '7b59cf6b-04b6-4742-bb1b-78a28b593fe8',
       'migration 0095 (canon 0.30.420): a parked test returns to harvest year 2026 and holds no slot',
       '2026-10-08T02:00:00.000Z'
FROM harvest_batches
WHERE harvest_year = 2000 AND is_test = 0
  AND NOT EXISTS (SELECT 1 FROM record_change_log WHERE id = '0095-lot_serial-' || harvest_batches.id);

UPDATE harvest_batches
SET is_test = 1,
    harvest_year = 2026,
    lot_serial = marked.new_serial,
    updated_at = '2026-10-08T02:00:00.000Z',
    updated_by = '7b59cf6b-04b6-4742-bb1b-78a28b593fe8'
FROM (
  SELECT id, 90000 + ROW_NUMBER() OVER (ORDER BY created_at, id) AS new_serial
  FROM harvest_batches
  WHERE harvest_year = 2000 AND is_test = 0
) AS marked
WHERE harvest_batches.id = marked.id;
