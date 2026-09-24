-- THE HOURS COME BY HAND (canon 0.30.153). Owner's pick, 2026-09-21: Send it to me each time.
-- Source: 26H.Operations Dashboard .xlsm, Labor tab (header row 3: C DATE, D HARV FARM, I CUT/BCK # HRS).
-- Lands 5 farm-day hour(s) in harvest_labor_hours; each row is added where missing or set
-- where the console holds a different number; a row already at the sheet's number is left alone;
-- every change logs in record_change_log under the owner's login with this file's reason.
-- Every statement is guarded, so a second run changes nothing. Ids deterministic
-- (uuid from sha256 of gripfactory-repair-hours-<seed>). Fixed stamp 2026-09-21T15:30:00.000Z.
-- HELD OUT, pending the owner's word (they read like season totals typed on a date, not days):
--   2026-09-14 PNN 2753
--   2026-09-15 PNS 3153
-- SKIPPED (nothing typed on the sheet, or a date ahead of the run day):
--   2026-09-16 PNN None (hours blank)
--   2026-09-18 ARL None (hours blank)
-- Run from app/ at the owner's keyboard:
--   node scripts/repair-apply.mjs scripts/repairs/<this file>

-- 1. 2026-07-20 ARL 133.5 h
INSERT INTO record_change_log (id, record_table, record_id, field, old_value, new_value, actor_person_id, reason, changed_at)
SELECT '8633ca5a-d60c-6ab1-919d-f34cb95e17ba', 'harvest_labor_hours', h.id, 'hours', CAST(h.hours AS TEXT), '133.5', '7b59cf6b-04b6-4742-bb1b-78a28b593fe8', 'hours from the sheet 2026-09-21 (canon 0.30.153), 26H.Operations Dashboard .xlsm, Labor tab, CUT/BCK # HRS by DATE and HARV FARM', '2026-09-21T15:30:00.000Z'
FROM harvest_labor_hours h WHERE h.farm_code = 'ARL' AND h.work_date = '2026-07-20' AND h.hours <> 133.5
  AND NOT EXISTS (SELECT 1 FROM record_change_log l WHERE l.id = '8633ca5a-d60c-6ab1-919d-f34cb95e17ba');
UPDATE harvest_labor_hours SET hours = 133.5, updated_at = '2026-09-21T15:30:00.000Z', updated_by = '7b59cf6b-04b6-4742-bb1b-78a28b593fe8'
WHERE farm_code = 'ARL' AND work_date = '2026-07-20' AND hours <> 133.5;
INSERT INTO harvest_labor_hours (id, farm_code, work_date, hours, created_at, created_by, updated_at, updated_by)
SELECT '8cc06ee5-657c-6693-066a-aa2dd17c5b6e', 'ARL', '2026-07-20', 133.5, '2026-09-21T15:30:00.000Z', '7b59cf6b-04b6-4742-bb1b-78a28b593fe8', '2026-09-21T15:30:00.000Z', '7b59cf6b-04b6-4742-bb1b-78a28b593fe8'
WHERE NOT EXISTS (SELECT 1 FROM harvest_labor_hours WHERE farm_code = 'ARL' AND work_date = '2026-07-20');
INSERT INTO record_change_log (id, record_table, record_id, field, old_value, new_value, actor_person_id, reason, changed_at)
SELECT 'b1c768a0-7a43-86b5-020c-623c7964d268', 'harvest_labor_hours', '8cc06ee5-657c-6693-066a-aa2dd17c5b6e', 'hours', NULL, '133.5', '7b59cf6b-04b6-4742-bb1b-78a28b593fe8', 'hours from the sheet 2026-09-21 (canon 0.30.153), 26H.Operations Dashboard .xlsm, Labor tab, CUT/BCK # HRS by DATE and HARV FARM', '2026-09-21T15:30:00.000Z'
WHERE EXISTS (SELECT 1 FROM harvest_labor_hours WHERE id = '8cc06ee5-657c-6693-066a-aa2dd17c5b6e')
  AND NOT EXISTS (SELECT 1 FROM record_change_log l WHERE l.id = 'b1c768a0-7a43-86b5-020c-623c7964d268');

-- 2. 2026-08-14 PNN 117.5 h
INSERT INTO record_change_log (id, record_table, record_id, field, old_value, new_value, actor_person_id, reason, changed_at)
SELECT 'afd0e329-84da-8736-72aa-db72d82d7925', 'harvest_labor_hours', h.id, 'hours', CAST(h.hours AS TEXT), '117.5', '7b59cf6b-04b6-4742-bb1b-78a28b593fe8', 'hours from the sheet 2026-09-21 (canon 0.30.153), 26H.Operations Dashboard .xlsm, Labor tab, CUT/BCK # HRS by DATE and HARV FARM', '2026-09-21T15:30:00.000Z'
FROM harvest_labor_hours h WHERE h.farm_code = 'PNN' AND h.work_date = '2026-08-14' AND h.hours <> 117.5
  AND NOT EXISTS (SELECT 1 FROM record_change_log l WHERE l.id = 'afd0e329-84da-8736-72aa-db72d82d7925');
UPDATE harvest_labor_hours SET hours = 117.5, updated_at = '2026-09-21T15:30:00.000Z', updated_by = '7b59cf6b-04b6-4742-bb1b-78a28b593fe8'
WHERE farm_code = 'PNN' AND work_date = '2026-08-14' AND hours <> 117.5;
INSERT INTO harvest_labor_hours (id, farm_code, work_date, hours, created_at, created_by, updated_at, updated_by)
SELECT '2b9be691-7e24-d604-c79b-23f843d37d3f', 'PNN', '2026-08-14', 117.5, '2026-09-21T15:30:00.000Z', '7b59cf6b-04b6-4742-bb1b-78a28b593fe8', '2026-09-21T15:30:00.000Z', '7b59cf6b-04b6-4742-bb1b-78a28b593fe8'
WHERE NOT EXISTS (SELECT 1 FROM harvest_labor_hours WHERE farm_code = 'PNN' AND work_date = '2026-08-14');
INSERT INTO record_change_log (id, record_table, record_id, field, old_value, new_value, actor_person_id, reason, changed_at)
SELECT '343591ff-bec4-1091-deb5-5832c3f6888a', 'harvest_labor_hours', '2b9be691-7e24-d604-c79b-23f843d37d3f', 'hours', NULL, '117.5', '7b59cf6b-04b6-4742-bb1b-78a28b593fe8', 'hours from the sheet 2026-09-21 (canon 0.30.153), 26H.Operations Dashboard .xlsm, Labor tab, CUT/BCK # HRS by DATE and HARV FARM', '2026-09-21T15:30:00.000Z'
WHERE EXISTS (SELECT 1 FROM harvest_labor_hours WHERE id = '2b9be691-7e24-d604-c79b-23f843d37d3f')
  AND NOT EXISTS (SELECT 1 FROM record_change_log l WHERE l.id = '343591ff-bec4-1091-deb5-5832c3f6888a');

-- 3. 2026-08-20 PNN 24.92 h
INSERT INTO record_change_log (id, record_table, record_id, field, old_value, new_value, actor_person_id, reason, changed_at)
SELECT '7129af97-c9fb-cbdc-491f-85d1172b69cd', 'harvest_labor_hours', h.id, 'hours', CAST(h.hours AS TEXT), '24.92', '7b59cf6b-04b6-4742-bb1b-78a28b593fe8', 'hours from the sheet 2026-09-21 (canon 0.30.153), 26H.Operations Dashboard .xlsm, Labor tab, CUT/BCK # HRS by DATE and HARV FARM', '2026-09-21T15:30:00.000Z'
FROM harvest_labor_hours h WHERE h.farm_code = 'PNN' AND h.work_date = '2026-08-20' AND h.hours <> 24.92
  AND NOT EXISTS (SELECT 1 FROM record_change_log l WHERE l.id = '7129af97-c9fb-cbdc-491f-85d1172b69cd');
UPDATE harvest_labor_hours SET hours = 24.92, updated_at = '2026-09-21T15:30:00.000Z', updated_by = '7b59cf6b-04b6-4742-bb1b-78a28b593fe8'
WHERE farm_code = 'PNN' AND work_date = '2026-08-20' AND hours <> 24.92;
INSERT INTO harvest_labor_hours (id, farm_code, work_date, hours, created_at, created_by, updated_at, updated_by)
SELECT '4d74d1e4-388a-f114-5f31-e4be5e7af8f9', 'PNN', '2026-08-20', 24.92, '2026-09-21T15:30:00.000Z', '7b59cf6b-04b6-4742-bb1b-78a28b593fe8', '2026-09-21T15:30:00.000Z', '7b59cf6b-04b6-4742-bb1b-78a28b593fe8'
WHERE NOT EXISTS (SELECT 1 FROM harvest_labor_hours WHERE farm_code = 'PNN' AND work_date = '2026-08-20');
INSERT INTO record_change_log (id, record_table, record_id, field, old_value, new_value, actor_person_id, reason, changed_at)
SELECT 'b16fbc17-c707-a9a7-f32b-98203b73f281', 'harvest_labor_hours', '4d74d1e4-388a-f114-5f31-e4be5e7af8f9', 'hours', NULL, '24.92', '7b59cf6b-04b6-4742-bb1b-78a28b593fe8', 'hours from the sheet 2026-09-21 (canon 0.30.153), 26H.Operations Dashboard .xlsm, Labor tab, CUT/BCK # HRS by DATE and HARV FARM', '2026-09-21T15:30:00.000Z'
WHERE EXISTS (SELECT 1 FROM harvest_labor_hours WHERE id = '4d74d1e4-388a-f114-5f31-e4be5e7af8f9')
  AND NOT EXISTS (SELECT 1 FROM record_change_log l WHERE l.id = 'b16fbc17-c707-a9a7-f32b-98203b73f281');

-- 4. 2026-08-24 PNN 108.92 h
INSERT INTO record_change_log (id, record_table, record_id, field, old_value, new_value, actor_person_id, reason, changed_at)
SELECT '51a03007-fef9-65e6-1803-ab0d4ed22e02', 'harvest_labor_hours', h.id, 'hours', CAST(h.hours AS TEXT), '108.92', '7b59cf6b-04b6-4742-bb1b-78a28b593fe8', 'hours from the sheet 2026-09-21 (canon 0.30.153), 26H.Operations Dashboard .xlsm, Labor tab, CUT/BCK # HRS by DATE and HARV FARM', '2026-09-21T15:30:00.000Z'
FROM harvest_labor_hours h WHERE h.farm_code = 'PNN' AND h.work_date = '2026-08-24' AND h.hours <> 108.92
  AND NOT EXISTS (SELECT 1 FROM record_change_log l WHERE l.id = '51a03007-fef9-65e6-1803-ab0d4ed22e02');
UPDATE harvest_labor_hours SET hours = 108.92, updated_at = '2026-09-21T15:30:00.000Z', updated_by = '7b59cf6b-04b6-4742-bb1b-78a28b593fe8'
WHERE farm_code = 'PNN' AND work_date = '2026-08-24' AND hours <> 108.92;
INSERT INTO harvest_labor_hours (id, farm_code, work_date, hours, created_at, created_by, updated_at, updated_by)
SELECT '5f590dac-e5f1-ebac-90f8-2e235f31d881', 'PNN', '2026-08-24', 108.92, '2026-09-21T15:30:00.000Z', '7b59cf6b-04b6-4742-bb1b-78a28b593fe8', '2026-09-21T15:30:00.000Z', '7b59cf6b-04b6-4742-bb1b-78a28b593fe8'
WHERE NOT EXISTS (SELECT 1 FROM harvest_labor_hours WHERE farm_code = 'PNN' AND work_date = '2026-08-24');
INSERT INTO record_change_log (id, record_table, record_id, field, old_value, new_value, actor_person_id, reason, changed_at)
SELECT '21b2d0e6-a6ce-e115-ac93-f62dd8ac26a4', 'harvest_labor_hours', '5f590dac-e5f1-ebac-90f8-2e235f31d881', 'hours', NULL, '108.92', '7b59cf6b-04b6-4742-bb1b-78a28b593fe8', 'hours from the sheet 2026-09-21 (canon 0.30.153), 26H.Operations Dashboard .xlsm, Labor tab, CUT/BCK # HRS by DATE and HARV FARM', '2026-09-21T15:30:00.000Z'
WHERE EXISTS (SELECT 1 FROM harvest_labor_hours WHERE id = '5f590dac-e5f1-ebac-90f8-2e235f31d881')
  AND NOT EXISTS (SELECT 1 FROM record_change_log l WHERE l.id = '21b2d0e6-a6ce-e115-ac93-f62dd8ac26a4');

-- 5. 2026-09-03 PNN 17 h
INSERT INTO record_change_log (id, record_table, record_id, field, old_value, new_value, actor_person_id, reason, changed_at)
SELECT '940fd901-2e88-de41-4764-1ff96c8a11c3', 'harvest_labor_hours', h.id, 'hours', CAST(h.hours AS TEXT), '17', '7b59cf6b-04b6-4742-bb1b-78a28b593fe8', 'hours from the sheet 2026-09-21 (canon 0.30.153), 26H.Operations Dashboard .xlsm, Labor tab, CUT/BCK # HRS by DATE and HARV FARM', '2026-09-21T15:30:00.000Z'
FROM harvest_labor_hours h WHERE h.farm_code = 'PNN' AND h.work_date = '2026-09-03' AND h.hours <> 17
  AND NOT EXISTS (SELECT 1 FROM record_change_log l WHERE l.id = '940fd901-2e88-de41-4764-1ff96c8a11c3');
UPDATE harvest_labor_hours SET hours = 17, updated_at = '2026-09-21T15:30:00.000Z', updated_by = '7b59cf6b-04b6-4742-bb1b-78a28b593fe8'
WHERE farm_code = 'PNN' AND work_date = '2026-09-03' AND hours <> 17;
INSERT INTO harvest_labor_hours (id, farm_code, work_date, hours, created_at, created_by, updated_at, updated_by)
SELECT 'edf3f410-c679-31a8-71e8-868e948dea11', 'PNN', '2026-09-03', 17, '2026-09-21T15:30:00.000Z', '7b59cf6b-04b6-4742-bb1b-78a28b593fe8', '2026-09-21T15:30:00.000Z', '7b59cf6b-04b6-4742-bb1b-78a28b593fe8'
WHERE NOT EXISTS (SELECT 1 FROM harvest_labor_hours WHERE farm_code = 'PNN' AND work_date = '2026-09-03');
INSERT INTO record_change_log (id, record_table, record_id, field, old_value, new_value, actor_person_id, reason, changed_at)
SELECT 'e1e0a679-30e9-7d4f-0fed-996cd777d864', 'harvest_labor_hours', 'edf3f410-c679-31a8-71e8-868e948dea11', 'hours', NULL, '17', '7b59cf6b-04b6-4742-bb1b-78a28b593fe8', 'hours from the sheet 2026-09-21 (canon 0.30.153), 26H.Operations Dashboard .xlsm, Labor tab, CUT/BCK # HRS by DATE and HARV FARM', '2026-09-21T15:30:00.000Z'
WHERE EXISTS (SELECT 1 FROM harvest_labor_hours WHERE id = 'edf3f410-c679-31a8-71e8-868e948dea11')
  AND NOT EXISTS (SELECT 1 FROM record_change_log l WHERE l.id = 'e1e0a679-30e9-7d4f-0fed-996cd777d864');

-- End of file. Expected effect on a console holding none of these days: 5 rows added, 5 log rows; a second run: 0 and 0.
