-- THE FOUR WPR PACKAGES VOIDED AS NOT FFZ (canon 0.30.230). Owner, 2026-09-25, verbatim: Compliance console didn't update with
-- passed WPRs after I ran the METRC mirror this morning.  METRC should show more passed WPR than the scheduling screen shows
-- is available. His pick on the question tool: The 4 voided as 'these are not FFZ' (Recommended).
--
-- What the pre snapshot (db_backups/20260925-090857_pre_lots_49_53, dumped 2026-09-25T13:08:57Z) shows. This morning's
-- AU-P-000694 packages mount holds 19 passed WPR packages. Fourteen are cryo outputs the app knows, every one already
-- released as passed by the mirror; their ledger items were voided by hand (eight as shipped on 9/21 00:51Z, four as
-- these are not FFZ on 9/21 15:49Z during the purge of the FFZ inventory reading, two as not real on 9/22 12:26Z), and the
-- prepack Available pane lists only a released, passed package with a live ledger item carrying grams and a METRC tag.
-- The other five are strangers, waiting in the Adopt section of the prepack page. The four voided as not FFZ (tags
-- ...1045 to ...1048, 22,679 g each at Cryo Room under AU-P-000694, born of 26257-PNN-OD-070-0-03-26013) were swept into
-- the FFZ inventory reading by its cryo'd-package clause (canon 0.30.145), the clause brief L removed (0.30.225); METRC
-- shows them active and passed at 23.3.B and 23.4.B. The eight and the two stand as voided, his word.
--
-- THE REPAIR: the four ledger items un-voided (deleted_at, deleted_by and delete_reason cleared), each guarded by the
-- void it expects; nothing else moves (the wip packages stay released and passed; the grams stay the cryo weights the
-- app recorded, 22,679 g, where METRC reads 22,564.5 g, since no law moves ledger grams from the mirror). Every change
-- lands in record_change_log under the owner's login with this repair's reason and the fixed stamp 2026-09-25T13:45:00.000Z. A second run
-- changes nothing. Run from app/ at the owner's keyboard, after the five lots' repair:
--   node scripts/repair-apply.mjs scripts/repairs/2026-09-25_wpr_not_ffz_restore.sql
-- Then: node scripts/db-snapshot.mjs post_wpr_not_ffz


-- 1A4050300061761000001045
UPDATE local_inventory_items SET deleted_at = NULL, deleted_by = NULL, delete_reason = NULL, updated_at = '2026-09-25T13:45:00.000Z', updated_by = '7b59cf6b-04b6-4742-bb1b-78a28b593fe8'
WHERE id = 'baea1d1f-5b42-4062-b91e-0ae93493682a' AND wip_package_id = 'dd19f30c-95ec-4853-9784-dbe5ba004faa' AND metrc_tag = '1A4050300061761000001045' AND deleted_at = '2026-09-21T15:49:31.314Z' AND delete_reason = 'these are not FFZ';
INSERT INTO record_change_log (id, record_table, record_id, field, old_value, new_value, actor_person_id, reason, changed_at)
SELECT '86f5c226-9b97-5bb0-9388-6807242d269b', 'local_inventory_items', 'baea1d1f-5b42-4062-b91e-0ae93493682a', 'deleted_at', '2026-09-21T15:49:31.314Z', NULL, '7b59cf6b-04b6-4742-bb1b-78a28b593fe8', 'repair 2026-09-25 (canon 0.30.230), the four passed WPR packages voided as not FFZ on 9/21 restored to the ledger: tag 1A4050300061761000001045 un-voided; its wip package stays released and passed; METRC shows it active and passed', '2026-09-25T13:45:00.000Z'
WHERE NOT EXISTS (SELECT 1 FROM record_change_log WHERE record_table = 'local_inventory_items' AND record_id = 'baea1d1f-5b42-4062-b91e-0ae93493682a' AND field = 'deleted_at' AND reason = 'repair 2026-09-25 (canon 0.30.230), the four passed WPR packages voided as not FFZ on 9/21 restored to the ledger: tag 1A4050300061761000001045 un-voided; its wip package stays released and passed; METRC shows it active and passed');
INSERT INTO record_change_log (id, record_table, record_id, field, old_value, new_value, actor_person_id, reason, changed_at)
SELECT '6f19489f-403a-5b3c-abc8-3178bc64e0fd', 'local_inventory_items', 'baea1d1f-5b42-4062-b91e-0ae93493682a', 'delete_reason', 'these are not FFZ', NULL, '7b59cf6b-04b6-4742-bb1b-78a28b593fe8', 'repair 2026-09-25 (canon 0.30.230), the four passed WPR packages voided as not FFZ on 9/21 restored to the ledger: tag 1A4050300061761000001045 un-voided; its wip package stays released and passed; METRC shows it active and passed', '2026-09-25T13:45:00.000Z'
WHERE NOT EXISTS (SELECT 1 FROM record_change_log WHERE record_table = 'local_inventory_items' AND record_id = 'baea1d1f-5b42-4062-b91e-0ae93493682a' AND field = 'delete_reason' AND reason = 'repair 2026-09-25 (canon 0.30.230), the four passed WPR packages voided as not FFZ on 9/21 restored to the ledger: tag 1A4050300061761000001045 un-voided; its wip package stays released and passed; METRC shows it active and passed');

-- 1A4050300061761000001046
UPDATE local_inventory_items SET deleted_at = NULL, deleted_by = NULL, delete_reason = NULL, updated_at = '2026-09-25T13:45:00.000Z', updated_by = '7b59cf6b-04b6-4742-bb1b-78a28b593fe8'
WHERE id = '6e459450-2240-4725-878a-26be5be62bba' AND wip_package_id = '5c2aabb0-c998-4435-81ef-e38e906fa9c9' AND metrc_tag = '1A4050300061761000001046' AND deleted_at = '2026-09-21T15:49:31.314Z' AND delete_reason = 'these are not FFZ';
INSERT INTO record_change_log (id, record_table, record_id, field, old_value, new_value, actor_person_id, reason, changed_at)
SELECT '0affe14a-66e7-58ae-8f5c-6fe5a522331f', 'local_inventory_items', '6e459450-2240-4725-878a-26be5be62bba', 'deleted_at', '2026-09-21T15:49:31.314Z', NULL, '7b59cf6b-04b6-4742-bb1b-78a28b593fe8', 'repair 2026-09-25 (canon 0.30.230), the four passed WPR packages voided as not FFZ on 9/21 restored to the ledger: tag 1A4050300061761000001046 un-voided; its wip package stays released and passed; METRC shows it active and passed', '2026-09-25T13:45:00.000Z'
WHERE NOT EXISTS (SELECT 1 FROM record_change_log WHERE record_table = 'local_inventory_items' AND record_id = '6e459450-2240-4725-878a-26be5be62bba' AND field = 'deleted_at' AND reason = 'repair 2026-09-25 (canon 0.30.230), the four passed WPR packages voided as not FFZ on 9/21 restored to the ledger: tag 1A4050300061761000001046 un-voided; its wip package stays released and passed; METRC shows it active and passed');
INSERT INTO record_change_log (id, record_table, record_id, field, old_value, new_value, actor_person_id, reason, changed_at)
SELECT '838802ba-3ecc-518e-9efe-21805effe8ea', 'local_inventory_items', '6e459450-2240-4725-878a-26be5be62bba', 'delete_reason', 'these are not FFZ', NULL, '7b59cf6b-04b6-4742-bb1b-78a28b593fe8', 'repair 2026-09-25 (canon 0.30.230), the four passed WPR packages voided as not FFZ on 9/21 restored to the ledger: tag 1A4050300061761000001046 un-voided; its wip package stays released and passed; METRC shows it active and passed', '2026-09-25T13:45:00.000Z'
WHERE NOT EXISTS (SELECT 1 FROM record_change_log WHERE record_table = 'local_inventory_items' AND record_id = '6e459450-2240-4725-878a-26be5be62bba' AND field = 'delete_reason' AND reason = 'repair 2026-09-25 (canon 0.30.230), the four passed WPR packages voided as not FFZ on 9/21 restored to the ledger: tag 1A4050300061761000001046 un-voided; its wip package stays released and passed; METRC shows it active and passed');

-- 1A4050300061761000001047
UPDATE local_inventory_items SET deleted_at = NULL, deleted_by = NULL, delete_reason = NULL, updated_at = '2026-09-25T13:45:00.000Z', updated_by = '7b59cf6b-04b6-4742-bb1b-78a28b593fe8'
WHERE id = 'b25682f7-7dda-4a0d-8d71-c33f2ba59574' AND wip_package_id = '66e7a322-8d9c-42f5-b4b8-130dae547e7c' AND metrc_tag = '1A4050300061761000001047' AND deleted_at = '2026-09-21T15:49:31.314Z' AND delete_reason = 'these are not FFZ';
INSERT INTO record_change_log (id, record_table, record_id, field, old_value, new_value, actor_person_id, reason, changed_at)
SELECT '86f94979-0468-5d77-8099-1bbd4d44e10a', 'local_inventory_items', 'b25682f7-7dda-4a0d-8d71-c33f2ba59574', 'deleted_at', '2026-09-21T15:49:31.314Z', NULL, '7b59cf6b-04b6-4742-bb1b-78a28b593fe8', 'repair 2026-09-25 (canon 0.30.230), the four passed WPR packages voided as not FFZ on 9/21 restored to the ledger: tag 1A4050300061761000001047 un-voided; its wip package stays released and passed; METRC shows it active and passed', '2026-09-25T13:45:00.000Z'
WHERE NOT EXISTS (SELECT 1 FROM record_change_log WHERE record_table = 'local_inventory_items' AND record_id = 'b25682f7-7dda-4a0d-8d71-c33f2ba59574' AND field = 'deleted_at' AND reason = 'repair 2026-09-25 (canon 0.30.230), the four passed WPR packages voided as not FFZ on 9/21 restored to the ledger: tag 1A4050300061761000001047 un-voided; its wip package stays released and passed; METRC shows it active and passed');
INSERT INTO record_change_log (id, record_table, record_id, field, old_value, new_value, actor_person_id, reason, changed_at)
SELECT 'd373979b-bb7a-51c2-89da-1f250b6e8d53', 'local_inventory_items', 'b25682f7-7dda-4a0d-8d71-c33f2ba59574', 'delete_reason', 'these are not FFZ', NULL, '7b59cf6b-04b6-4742-bb1b-78a28b593fe8', 'repair 2026-09-25 (canon 0.30.230), the four passed WPR packages voided as not FFZ on 9/21 restored to the ledger: tag 1A4050300061761000001047 un-voided; its wip package stays released and passed; METRC shows it active and passed', '2026-09-25T13:45:00.000Z'
WHERE NOT EXISTS (SELECT 1 FROM record_change_log WHERE record_table = 'local_inventory_items' AND record_id = 'b25682f7-7dda-4a0d-8d71-c33f2ba59574' AND field = 'delete_reason' AND reason = 'repair 2026-09-25 (canon 0.30.230), the four passed WPR packages voided as not FFZ on 9/21 restored to the ledger: tag 1A4050300061761000001047 un-voided; its wip package stays released and passed; METRC shows it active and passed');

-- 1A4050300061761000001048
UPDATE local_inventory_items SET deleted_at = NULL, deleted_by = NULL, delete_reason = NULL, updated_at = '2026-09-25T13:45:00.000Z', updated_by = '7b59cf6b-04b6-4742-bb1b-78a28b593fe8'
WHERE id = '442d3dc3-d140-45af-8977-abc51322697c' AND wip_package_id = '3d065d3d-d349-4181-b750-3e75bdf1eb19' AND metrc_tag = '1A4050300061761000001048' AND deleted_at = '2026-09-21T15:49:31.314Z' AND delete_reason = 'these are not FFZ';
INSERT INTO record_change_log (id, record_table, record_id, field, old_value, new_value, actor_person_id, reason, changed_at)
SELECT '3c440fd2-a1a3-5a2f-95b6-7ebc91d89f1f', 'local_inventory_items', '442d3dc3-d140-45af-8977-abc51322697c', 'deleted_at', '2026-09-21T15:49:31.314Z', NULL, '7b59cf6b-04b6-4742-bb1b-78a28b593fe8', 'repair 2026-09-25 (canon 0.30.230), the four passed WPR packages voided as not FFZ on 9/21 restored to the ledger: tag 1A4050300061761000001048 un-voided; its wip package stays released and passed; METRC shows it active and passed', '2026-09-25T13:45:00.000Z'
WHERE NOT EXISTS (SELECT 1 FROM record_change_log WHERE record_table = 'local_inventory_items' AND record_id = '442d3dc3-d140-45af-8977-abc51322697c' AND field = 'deleted_at' AND reason = 'repair 2026-09-25 (canon 0.30.230), the four passed WPR packages voided as not FFZ on 9/21 restored to the ledger: tag 1A4050300061761000001048 un-voided; its wip package stays released and passed; METRC shows it active and passed');
INSERT INTO record_change_log (id, record_table, record_id, field, old_value, new_value, actor_person_id, reason, changed_at)
SELECT 'ec6fd1cb-9da8-5158-83da-60e390520f65', 'local_inventory_items', '442d3dc3-d140-45af-8977-abc51322697c', 'delete_reason', 'these are not FFZ', NULL, '7b59cf6b-04b6-4742-bb1b-78a28b593fe8', 'repair 2026-09-25 (canon 0.30.230), the four passed WPR packages voided as not FFZ on 9/21 restored to the ledger: tag 1A4050300061761000001048 un-voided; its wip package stays released and passed; METRC shows it active and passed', '2026-09-25T13:45:00.000Z'
WHERE NOT EXISTS (SELECT 1 FROM record_change_log WHERE record_table = 'local_inventory_items' AND record_id = '442d3dc3-d140-45af-8977-abc51322697c' AND field = 'delete_reason' AND reason = 'repair 2026-09-25 (canon 0.30.230), the four passed WPR packages voided as not FFZ on 9/21 restored to the ledger: tag 1A4050300061761000001048 un-voided; its wip package stays released and passed; METRC shows it active and passed');
