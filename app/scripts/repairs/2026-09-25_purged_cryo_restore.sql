-- METRC WINS: THE 79 PURGED CRYO OUTPUTS RESTORED (canon 0.30.240). Owner, 2026-09-25, verbatim: METRC wins.  That's the
-- thing.  Once we close a couple more loops, we're going to be working on the real thing.  At that time, the ledger is
-- something to compare against, but METRC will be king.
--
-- What the snapshot db_backups/20260925-112849_post_wpr_not_ffz (dumped 2026-09-25T15:28:51Z) shows. Three purges on the old
-- FFZ inventory page, under the owner's login, voided the ledger items of 83 cryo outputs made at AU-P-000694: 47 noted shipped
-- (9/21 00:51Z), 10 noted these are not FFZ (9/21 15:49Z) and 26 noted not real (9/22 12:26Z). METRC lists all 83 active at
-- AU-P-000694 (racks 23.x to 25.x in the morning's packages mount), each changed in METRC since its purge. The four WPR of the
-- not FFZ purge came back this morning (2026-09-25_wpr_not_ffz_restore.sql, canon 0.30.230). This file restores the other 79:
-- 30 WPR (10 passed, the ten the Prepack page misses; 15 in testing; 5 failed) and 49 BUD (22 passed, 23 in
-- testing, 4 failed). Their wip packages were never voided and stand as the mirror left them.
--
-- THE REPAIR: each ledger item un-voided (deleted_at, deleted_by and delete_reason cleared, updated at this repair's stamp
-- under the owner's login), guarded by the void it expects (the purge's stamp and note, the package, the tag) and by the
-- mirror still listing the tag active with grams, so a package METRC has since closed stays voided. Nothing else moves: the
-- grams and the location stay what the app recorded (the ledger is what the app compares against METRC; METRC reads less on
-- most, the lab's samples); the wip packages, the schedules and the mirror are untouched. Three log rows per restored item
-- (the three fields), written only when the item stands restored under this stamp. A second run changes nothing.
-- Run from app/ at the owner's keyboard, after a pre snapshot:
--   node scripts/db-snapshot.mjs pre_purged_cryo_restore
--   node scripts/repair-apply.mjs scripts/repairs/2026-09-25_purged_cryo_restore.sql
--   node scripts/db-snapshot.mjs post_purged_cryo_restore


-- The shipped purge of 9/21 00:51Z, items 1 to 20 of 47: 1037 BUD, 1036 BUD, 1035 BUD, 1034 BUD, 1023 WPR, 1044 BUD, 1043 BUD, 1032 BUD, 1031 BUD, 1030 BUD, 1029 BUD, 1028 BUD, 1027 BUD, 1026 BUD, 1025 BUD, 1024 BUD, 1033 BUD, 1022 WPR, 1011 WPR, 1010 WPR
UPDATE local_inventory_items SET deleted_at = NULL, deleted_by = NULL, delete_reason = NULL, updated_at = '2026-09-25T23:30:00.000Z', updated_by = '7b59cf6b-04b6-4742-bb1b-78a28b593fe8'
WHERE (id, wip_package_id, metrc_tag) IN (VALUES
  ('71954ee2-c6fe-46dd-9d6f-1161d967a1c3', '69d09228-78f5-42a2-a4f1-8ec89b0bee33', '1A4050300061761000001037'),
  ('bbca7fdc-ea39-4af9-95e4-4b6861c517d6', 'f3095346-24b0-48b8-8158-cc0e59f5ebd6', '1A4050300061761000001036'),
  ('dfab1fc2-4145-4470-bd3b-9b4fd2ca07d0', '8723ea88-792e-4d08-9a2a-7bc69af098f4', '1A4050300061761000001035'),
  ('026bbfa7-9624-4d27-965e-81109a3c097a', '34358738-b58e-41fc-a91e-744010084f68', '1A4050300061761000001034'),
  ('c0134e70-d6a8-4512-baa2-e4823cbea8b2', '6a7597c2-9926-48db-aa1e-36dfe4d1a1ce', '1A4050300061761000001023'),
  ('9eb3f374-faf0-42bf-bb50-84c2507e96bb', '7433fb09-2054-476d-a606-ab4fd6320130', '1A4050300061761000001044'),
  ('e9273cfb-6670-41ed-862d-008f8908de02', '9fa6420a-638f-448a-89e8-699cf2e254d8', '1A4050300061761000001043'),
  ('6f760e00-d749-4751-ad49-83d0947af1ab', '4587e601-cc2d-4c63-afc6-ef5d1af91521', '1A4050300061761000001032'),
  ('716efb5c-0c9e-4462-881b-42ad91032965', '1186b10d-6cf2-4516-82a2-619c96fb1031', '1A4050300061761000001031'),
  ('f027f583-bbc4-4dd5-81cb-e2aa2612baf6', '7a5fbbd7-cdb4-40d1-a51f-91ef11bb0392', '1A4050300061761000001030'),
  ('e4aff2fb-3abb-4789-b427-e62b7f97bc09', '0ecb55df-b153-44d3-b410-a7d63d433e1b', '1A4050300061761000001029'),
  ('252e28f9-21f0-48a4-899f-ddbd6466fb25', '11cf7dbf-7d78-4f6e-98f3-3833d900478f', '1A4050300061761000001028'),
  ('ef354318-18b8-493e-977e-54a19e5fbe17', 'd467a6c9-2305-4029-b72b-8ebd461679a7', '1A4050300061761000001027'),
  ('fd8394fd-fb96-44f7-b6ce-62ddfce3771e', '15a644de-6779-482a-ba21-02ffde157c4c', '1A4050300061761000001026'),
  ('e7aae695-ab64-401c-888f-5354e80e9153', 'a042ca8c-c894-4187-9cc9-5795cd08dbf7', '1A4050300061761000001025'),
  ('32265ffa-19e6-46ef-acb7-9e3aa7c33d73', '8b772809-2604-4fe8-826d-578c98e035d4', '1A4050300061761000001024'),
  ('7e295a56-25ac-47b0-9a92-2f9fa162b1bb', '1ecb1a7e-b05a-44be-ba5d-380b312299ec', '1A4050300061761000001033'),
  ('57f29aff-d2a3-422b-ba65-714f54b5c7da', 'ac443f26-3f1c-460b-bda1-918b22747de1', '1A4050300061761000001022'),
  ('15058bd5-2ee0-4183-aeb5-336c990e2f13', '201d46e5-2468-418a-b7f8-175249dcd36d', '1A4050300061761000001011'),
  ('1f4f1b65-078e-42f7-8fba-ddc07d8e68c8', 'a6498e07-aa75-4aa4-bc93-10e077f6cdc9', '1A4050300061761000001010'))
AND deleted_at = '2026-09-21T00:51:50.527Z' AND delete_reason = 'shipped' AND deleted_by = '7b59cf6b-04b6-4742-bb1b-78a28b593fe8'
AND EXISTS (SELECT 1 FROM metrc_packages m WHERE m.tag = local_inventory_items.metrc_tag AND m.gone_at IS NULL AND m.quantity > 0);
INSERT INTO record_change_log (id, record_table, record_id, field, old_value, new_value, actor_person_id, reason, changed_at)
SELECT v.column1, 'local_inventory_items', v.column2, 'deleted_at', '2026-09-21T00:51:50.527Z', NULL, '7b59cf6b-04b6-4742-bb1b-78a28b593fe8', 'repair 2026-09-25 (canon 0.30.240), METRC wins: a cryo output the shipped purge of 9/21 00:51Z voided restored to the ledger, METRC listing it active at AU-P-000694: tag ' || v.column3, '2026-09-25T23:30:00.000Z'
FROM (VALUES
  ('82666653-e896-5892-9cf3-b46bf65910b9', '71954ee2-c6fe-46dd-9d6f-1161d967a1c3', '1A4050300061761000001037'),
  ('1adcf6fa-de9e-51f9-addd-827a87132a3a', 'bbca7fdc-ea39-4af9-95e4-4b6861c517d6', '1A4050300061761000001036'),
  ('2822ee2a-fdf9-5ecf-bd06-cc4083af3fbc', 'dfab1fc2-4145-4470-bd3b-9b4fd2ca07d0', '1A4050300061761000001035'),
  ('513e1dad-e11d-5962-991e-ce29e488d967', '026bbfa7-9624-4d27-965e-81109a3c097a', '1A4050300061761000001034'),
  ('f7ad8721-d7cd-56ba-a916-1a1a66c4efb5', 'c0134e70-d6a8-4512-baa2-e4823cbea8b2', '1A4050300061761000001023'),
  ('a64dcf18-fce0-5fa9-a654-ccccd7c33c88', '9eb3f374-faf0-42bf-bb50-84c2507e96bb', '1A4050300061761000001044'),
  ('34b2c779-3aa3-529b-92e0-93fb3f0539a2', 'e9273cfb-6670-41ed-862d-008f8908de02', '1A4050300061761000001043'),
  ('a76cea39-ac03-5350-afb1-d1f7ac7a489a', '6f760e00-d749-4751-ad49-83d0947af1ab', '1A4050300061761000001032'),
  ('54bace5e-96e5-5d28-92ce-bf76fc25fac7', '716efb5c-0c9e-4462-881b-42ad91032965', '1A4050300061761000001031'),
  ('90e0318a-bbdd-52bd-aedd-80bfc4f160e3', 'f027f583-bbc4-4dd5-81cb-e2aa2612baf6', '1A4050300061761000001030'),
  ('8f627d90-7e79-59a9-8de6-c3ca36fb5d5d', 'e4aff2fb-3abb-4789-b427-e62b7f97bc09', '1A4050300061761000001029'),
  ('63216081-0279-5ce2-8152-82c41d5172c5', '252e28f9-21f0-48a4-899f-ddbd6466fb25', '1A4050300061761000001028'),
  ('a80aa526-a717-5d5c-9eca-be35c65643a0', 'ef354318-18b8-493e-977e-54a19e5fbe17', '1A4050300061761000001027'),
  ('947df327-0f52-5d7c-9e34-5682060c63cf', 'fd8394fd-fb96-44f7-b6ce-62ddfce3771e', '1A4050300061761000001026'),
  ('79fb8516-608b-5415-8f94-cd7992c3f05c', 'e7aae695-ab64-401c-888f-5354e80e9153', '1A4050300061761000001025'),
  ('c4bba753-95ac-5aa6-8485-9bd13270b21f', '32265ffa-19e6-46ef-acb7-9e3aa7c33d73', '1A4050300061761000001024'),
  ('14ecae2f-238a-5343-93c1-74b5a03a75e8', '7e295a56-25ac-47b0-9a92-2f9fa162b1bb', '1A4050300061761000001033'),
  ('0c7a4f8b-818b-5a65-b0e3-be7a28f96b0a', '57f29aff-d2a3-422b-ba65-714f54b5c7da', '1A4050300061761000001022'),
  ('b1f9daa2-0276-5496-a450-f2657e6f91b4', '15058bd5-2ee0-4183-aeb5-336c990e2f13', '1A4050300061761000001011'),
  ('02f6dbb2-e8a9-592e-8f0d-806e81bdacbe', '1f4f1b65-078e-42f7-8fba-ddc07d8e68c8', '1A4050300061761000001010')) AS v
WHERE EXISTS (SELECT 1 FROM local_inventory_items i WHERE i.id = v.column2 AND i.deleted_at IS NULL AND i.updated_at = '2026-09-25T23:30:00.000Z' AND i.updated_by = '7b59cf6b-04b6-4742-bb1b-78a28b593fe8')
AND NOT EXISTS (SELECT 1 FROM record_change_log r WHERE r.id = v.column1);
INSERT INTO record_change_log (id, record_table, record_id, field, old_value, new_value, actor_person_id, reason, changed_at)
SELECT v.column1, 'local_inventory_items', v.column2, 'deleted_by', '7b59cf6b-04b6-4742-bb1b-78a28b593fe8', NULL, '7b59cf6b-04b6-4742-bb1b-78a28b593fe8', 'repair 2026-09-25 (canon 0.30.240), METRC wins: a cryo output the shipped purge of 9/21 00:51Z voided restored to the ledger, METRC listing it active at AU-P-000694: tag ' || v.column3, '2026-09-25T23:30:00.000Z'
FROM (VALUES
  ('8ffeb4b5-fdc0-5142-87b5-4c1e9a6e29ab', '71954ee2-c6fe-46dd-9d6f-1161d967a1c3', '1A4050300061761000001037'),
  ('b6a4500e-accb-53a2-bc70-4f50fbf01aec', 'bbca7fdc-ea39-4af9-95e4-4b6861c517d6', '1A4050300061761000001036'),
  ('6d38a33d-4530-5645-a144-966c492b0925', 'dfab1fc2-4145-4470-bd3b-9b4fd2ca07d0', '1A4050300061761000001035'),
  ('f8658d3a-33fc-50dc-8c79-f592517ee8a9', '026bbfa7-9624-4d27-965e-81109a3c097a', '1A4050300061761000001034'),
  ('9b6f162a-8895-5164-ba32-a23ebec3e306', 'c0134e70-d6a8-4512-baa2-e4823cbea8b2', '1A4050300061761000001023'),
  ('4ef5f837-d506-5e4a-9443-1b9b55062739', '9eb3f374-faf0-42bf-bb50-84c2507e96bb', '1A4050300061761000001044'),
  ('196b9784-9242-55fe-bd81-6a2deddf03cf', 'e9273cfb-6670-41ed-862d-008f8908de02', '1A4050300061761000001043'),
  ('a60c58a4-8615-59a0-8677-2ddbc0e38815', '6f760e00-d749-4751-ad49-83d0947af1ab', '1A4050300061761000001032'),
  ('8eac1eaa-e6de-576a-9571-113891bbd5a1', '716efb5c-0c9e-4462-881b-42ad91032965', '1A4050300061761000001031'),
  ('ff7bbadd-15cd-56da-96ec-e927bb31074b', 'f027f583-bbc4-4dd5-81cb-e2aa2612baf6', '1A4050300061761000001030'),
  ('9abad629-e33f-562b-9de6-1d36e2449ef7', 'e4aff2fb-3abb-4789-b427-e62b7f97bc09', '1A4050300061761000001029'),
  ('5477bd92-e07b-5ad3-84ed-a28924ff5006', '252e28f9-21f0-48a4-899f-ddbd6466fb25', '1A4050300061761000001028'),
  ('0b11aa58-9004-5af4-9f10-114c5acc352b', 'ef354318-18b8-493e-977e-54a19e5fbe17', '1A4050300061761000001027'),
  ('f79ed3f9-62e7-5497-9638-051784fee05f', 'fd8394fd-fb96-44f7-b6ce-62ddfce3771e', '1A4050300061761000001026'),
  ('b548b734-2342-5e38-ac71-d0f9f35cdb35', 'e7aae695-ab64-401c-888f-5354e80e9153', '1A4050300061761000001025'),
  ('a1a63228-e362-5275-8729-7c6ab0d88ea2', '32265ffa-19e6-46ef-acb7-9e3aa7c33d73', '1A4050300061761000001024'),
  ('20817254-98a0-5901-93ff-a2e4e1ecc3a0', '7e295a56-25ac-47b0-9a92-2f9fa162b1bb', '1A4050300061761000001033'),
  ('108353e7-1b38-506f-86fc-0da7b4d8290f', '57f29aff-d2a3-422b-ba65-714f54b5c7da', '1A4050300061761000001022'),
  ('503aba7e-af8a-50ab-829d-be45fc0ca9f2', '15058bd5-2ee0-4183-aeb5-336c990e2f13', '1A4050300061761000001011'),
  ('2d397f08-b560-5d06-ab20-ffb27b319ae1', '1f4f1b65-078e-42f7-8fba-ddc07d8e68c8', '1A4050300061761000001010')) AS v
WHERE EXISTS (SELECT 1 FROM local_inventory_items i WHERE i.id = v.column2 AND i.deleted_at IS NULL AND i.updated_at = '2026-09-25T23:30:00.000Z' AND i.updated_by = '7b59cf6b-04b6-4742-bb1b-78a28b593fe8')
AND NOT EXISTS (SELECT 1 FROM record_change_log r WHERE r.id = v.column1);
INSERT INTO record_change_log (id, record_table, record_id, field, old_value, new_value, actor_person_id, reason, changed_at)
SELECT v.column1, 'local_inventory_items', v.column2, 'delete_reason', 'shipped', NULL, '7b59cf6b-04b6-4742-bb1b-78a28b593fe8', 'repair 2026-09-25 (canon 0.30.240), METRC wins: a cryo output the shipped purge of 9/21 00:51Z voided restored to the ledger, METRC listing it active at AU-P-000694: tag ' || v.column3, '2026-09-25T23:30:00.000Z'
FROM (VALUES
  ('2f70330e-74f4-5adc-a7ba-3c16df803eff', '71954ee2-c6fe-46dd-9d6f-1161d967a1c3', '1A4050300061761000001037'),
  ('233dbf90-9acb-501c-a6f0-f76d2d34512f', 'bbca7fdc-ea39-4af9-95e4-4b6861c517d6', '1A4050300061761000001036'),
  ('1658d43d-921b-54de-873e-650a45f03abb', 'dfab1fc2-4145-4470-bd3b-9b4fd2ca07d0', '1A4050300061761000001035'),
  ('415715f1-d062-59ff-845d-38a60988c063', '026bbfa7-9624-4d27-965e-81109a3c097a', '1A4050300061761000001034'),
  ('b039c909-8dc7-5c10-9c48-f08e0e7fdbf3', 'c0134e70-d6a8-4512-baa2-e4823cbea8b2', '1A4050300061761000001023'),
  ('0f05047b-75dd-5c2f-9b1a-938c00958ea2', '9eb3f374-faf0-42bf-bb50-84c2507e96bb', '1A4050300061761000001044'),
  ('4739a8dd-cbef-5f99-afe7-871ff756a31f', 'e9273cfb-6670-41ed-862d-008f8908de02', '1A4050300061761000001043'),
  ('c29a3796-5813-5475-a097-0b822e70de9d', '6f760e00-d749-4751-ad49-83d0947af1ab', '1A4050300061761000001032'),
  ('0aa6ba62-8cca-50ad-86ef-a1357ce98265', '716efb5c-0c9e-4462-881b-42ad91032965', '1A4050300061761000001031'),
  ('a858b4f3-e7cf-5b25-b1aa-8690b8a4a5c9', 'f027f583-bbc4-4dd5-81cb-e2aa2612baf6', '1A4050300061761000001030'),
  ('0d934d04-e75b-54fd-81f5-cf7ae80d7a63', 'e4aff2fb-3abb-4789-b427-e62b7f97bc09', '1A4050300061761000001029'),
  ('c3b74e28-9591-5f6a-aa11-d9f9b01d5aa3', '252e28f9-21f0-48a4-899f-ddbd6466fb25', '1A4050300061761000001028'),
  ('eb5ab36e-ae32-5e9d-8bf2-8d46d99f4dcf', 'ef354318-18b8-493e-977e-54a19e5fbe17', '1A4050300061761000001027'),
  ('98caba49-520d-576c-b23e-197f6a24ff14', 'fd8394fd-fb96-44f7-b6ce-62ddfce3771e', '1A4050300061761000001026'),
  ('0ceecd0e-6037-5d4e-be69-1ceb0a575948', 'e7aae695-ab64-401c-888f-5354e80e9153', '1A4050300061761000001025'),
  ('b732528c-a37d-5a79-8b00-5c703122d3b0', '32265ffa-19e6-46ef-acb7-9e3aa7c33d73', '1A4050300061761000001024'),
  ('0604067a-7e2e-57e6-b86f-ff258b53c97e', '7e295a56-25ac-47b0-9a92-2f9fa162b1bb', '1A4050300061761000001033'),
  ('01a3e80c-efca-567c-b79a-b952610a6959', '57f29aff-d2a3-422b-ba65-714f54b5c7da', '1A4050300061761000001022'),
  ('50c85555-1b6a-522a-8020-1efba9d54ebd', '15058bd5-2ee0-4183-aeb5-336c990e2f13', '1A4050300061761000001011'),
  ('ec92979e-44a9-5eb4-9d6e-33c85416c8ae', '1f4f1b65-078e-42f7-8fba-ddc07d8e68c8', '1A4050300061761000001010')) AS v
WHERE EXISTS (SELECT 1 FROM local_inventory_items i WHERE i.id = v.column2 AND i.deleted_at IS NULL AND i.updated_at = '2026-09-25T23:30:00.000Z' AND i.updated_by = '7b59cf6b-04b6-4742-bb1b-78a28b593fe8')
AND NOT EXISTS (SELECT 1 FROM record_change_log r WHERE r.id = v.column1);

-- The shipped purge of 9/21 00:51Z, items 21 to 40 of 47: 1009 WPR, 1007 WPR, 1008 WPR, 1021 WPR, 1020 WPR, 1019 WPR, 1018 WPR, 1017 WPR, 1016 WPR, 1015 WPR, 1014 WPR, 1006 WPR, 1005 WPR, 1004 WPR, 1003 WPR, 1002 WPR, 1013 WPR, 1012 WPR, 1001 BUD, 1993 BUD
UPDATE local_inventory_items SET deleted_at = NULL, deleted_by = NULL, delete_reason = NULL, updated_at = '2026-09-25T23:30:00.000Z', updated_by = '7b59cf6b-04b6-4742-bb1b-78a28b593fe8'
WHERE (id, wip_package_id, metrc_tag) IN (VALUES
  ('42eefdbc-abe2-4dbf-bee1-6296bb3f7b94', 'f1ed9403-7731-42bc-b97f-0fcbe99a203d', '1A4050300061761000001009'),
  ('aa8f36e6-da2f-4170-b362-89ba89a9f25d', 'b09b1f1c-3d7a-4883-9e42-281e5eae5f6c', '1A4050300061761000001007'),
  ('1bb6d144-e1d4-4153-a883-5307e81db2ad', '3160e368-a412-494f-be6a-e2d2f24c545d', '1A4050300061761000001008'),
  ('607c25e7-afad-47c0-a8e3-2bf3e2245dab', '91162c88-b2fb-4ec5-a9ce-c325f6040fb7', '1A4050300061761000001021'),
  ('73e15277-1469-4d54-a4ea-0c45054063d1', '3106dd6b-8d9c-461a-ac25-cf40e85088a1', '1A4050300061761000001020'),
  ('4cf301b9-53da-4dfe-be9d-0c101cb2556b', 'db2bad92-53d8-4dd6-9b81-7c8920646204', '1A4050300061761000001019'),
  ('cc97066a-3daa-4c59-aa06-03feabc046f4', 'ea9602f9-0f90-4fa2-acbd-1e4ab7818ba6', '1A4050300061761000001018'),
  ('e9685e9c-ee27-44bc-9243-088c9473d600', '09aab475-486c-40f1-83d1-cf110eef2290', '1A4050300061761000001017'),
  ('470f3ed1-2de9-48b6-82a7-9c7683fc1e4e', '20c02a76-58a8-437e-8d38-cecd5eb50902', '1A4050300061761000001016'),
  ('2c024495-8b0e-4374-827f-3ab6d4a9ea46', 'd21f7825-e28b-4418-a5bd-f418d7c79a53', '1A4050300061761000001015'),
  ('5d4917dd-6f39-417b-a87e-61f576393617', '38e398f9-b1c8-469a-a386-bba7c28ccc71', '1A4050300061761000001014'),
  ('cb8e603b-35c6-4b5c-bea4-2ef08ff842b4', '7ea3fd20-542f-4636-a19c-d00bb839cbbc', '1A4050300061761000001006'),
  ('e2bb763c-9359-4156-b34c-5938d50e8682', '5b3c6955-2809-45d4-a653-5c6cf14916c7', '1A4050300061761000001005'),
  ('dd39a755-a5cb-486b-b182-bb129ce1d761', 'a6664855-0797-48d3-830e-8c9b4291dad4', '1A4050300061761000001004'),
  ('0d32367c-9c9c-483c-a1ba-b7833cc08d02', '5e0e8a4d-6f25-47b5-96b7-5835ad2563d5', '1A4050300061761000001003'),
  ('6cf1c1e0-1076-4099-a060-6866a694e286', 'c75f8bd9-d850-4687-bbb6-fb75c07bcc17', '1A4050300061761000001002'),
  ('4d09daa3-fb59-4b8c-a2bf-3d0c98edca65', 'fd05638b-0cc4-4948-9b52-711c78c1e9f8', '1A4050300061761000001013'),
  ('4bf10a0c-b3d4-4b32-a92a-d95c64da6be5', 'f771c63e-f131-4756-bc8d-9597606b35e8', '1A4050300061761000001012'),
  ('4a976194-de1b-4928-ab48-b0f271c2bfcb', '57d50ca3-5417-4497-8309-3f8eabf62cb0', '1A4050300061761000001001'),
  ('46f90846-a8c3-4b55-b479-b489c617c361', '44270144-95c7-4200-9e13-93d9d5999d5b', '1A4050300061761000001993'))
AND deleted_at = '2026-09-21T00:51:50.527Z' AND delete_reason = 'shipped' AND deleted_by = '7b59cf6b-04b6-4742-bb1b-78a28b593fe8'
AND EXISTS (SELECT 1 FROM metrc_packages m WHERE m.tag = local_inventory_items.metrc_tag AND m.gone_at IS NULL AND m.quantity > 0);
INSERT INTO record_change_log (id, record_table, record_id, field, old_value, new_value, actor_person_id, reason, changed_at)
SELECT v.column1, 'local_inventory_items', v.column2, 'deleted_at', '2026-09-21T00:51:50.527Z', NULL, '7b59cf6b-04b6-4742-bb1b-78a28b593fe8', 'repair 2026-09-25 (canon 0.30.240), METRC wins: a cryo output the shipped purge of 9/21 00:51Z voided restored to the ledger, METRC listing it active at AU-P-000694: tag ' || v.column3, '2026-09-25T23:30:00.000Z'
FROM (VALUES
  ('dc414953-b202-52f7-be38-4c72416b78bc', '42eefdbc-abe2-4dbf-bee1-6296bb3f7b94', '1A4050300061761000001009'),
  ('4317b3be-a24b-5441-b20b-c338c11b6c1c', 'aa8f36e6-da2f-4170-b362-89ba89a9f25d', '1A4050300061761000001007'),
  ('18e159a7-fc0e-55f7-a6b6-5b8d179234c5', '1bb6d144-e1d4-4153-a883-5307e81db2ad', '1A4050300061761000001008'),
  ('2ab82ea1-1c68-528c-bb80-e5a68539f443', '607c25e7-afad-47c0-a8e3-2bf3e2245dab', '1A4050300061761000001021'),
  ('ff648b73-998f-558d-84d8-854ac3c7bc49', '73e15277-1469-4d54-a4ea-0c45054063d1', '1A4050300061761000001020'),
  ('83b44380-4591-5b43-aac8-796ac76fc3b9', '4cf301b9-53da-4dfe-be9d-0c101cb2556b', '1A4050300061761000001019'),
  ('d0b0995b-6695-5d29-bb7e-f73a52a04a25', 'cc97066a-3daa-4c59-aa06-03feabc046f4', '1A4050300061761000001018'),
  ('83cb438d-3a0b-50b6-9f01-ab9aa773c3ec', 'e9685e9c-ee27-44bc-9243-088c9473d600', '1A4050300061761000001017'),
  ('8ed1e238-78ed-5609-b9e9-d8a6894ef5f5', '470f3ed1-2de9-48b6-82a7-9c7683fc1e4e', '1A4050300061761000001016'),
  ('9fda04a5-2f0b-5625-a57a-951f7c418e6a', '2c024495-8b0e-4374-827f-3ab6d4a9ea46', '1A4050300061761000001015'),
  ('8def1a1f-f2d2-58f3-b1a9-f82cbeae0a1f', '5d4917dd-6f39-417b-a87e-61f576393617', '1A4050300061761000001014'),
  ('6101336b-82fb-5e99-a8bb-2aae6885445e', 'cb8e603b-35c6-4b5c-bea4-2ef08ff842b4', '1A4050300061761000001006'),
  ('75d17188-5204-5612-913f-80bd023525ee', 'e2bb763c-9359-4156-b34c-5938d50e8682', '1A4050300061761000001005'),
  ('8e7adbe0-1a86-5d36-90d2-e4905252254a', 'dd39a755-a5cb-486b-b182-bb129ce1d761', '1A4050300061761000001004'),
  ('f9968bed-fd40-5966-8903-a1c31a39b9ef', '0d32367c-9c9c-483c-a1ba-b7833cc08d02', '1A4050300061761000001003'),
  ('0ad6c0b4-dcb9-5eb0-9693-52df71fead1e', '6cf1c1e0-1076-4099-a060-6866a694e286', '1A4050300061761000001002'),
  ('52dcf8d8-7932-5921-bcc6-0d81da967a15', '4d09daa3-fb59-4b8c-a2bf-3d0c98edca65', '1A4050300061761000001013'),
  ('80a395a1-4c9c-528b-9624-adeaee5622d7', '4bf10a0c-b3d4-4b32-a92a-d95c64da6be5', '1A4050300061761000001012'),
  ('c6aae166-c1d7-511f-86c2-f178f4e7ac49', '4a976194-de1b-4928-ab48-b0f271c2bfcb', '1A4050300061761000001001'),
  ('8f1b0981-06cd-53cf-9fc0-fd60d36e9ed9', '46f90846-a8c3-4b55-b479-b489c617c361', '1A4050300061761000001993')) AS v
WHERE EXISTS (SELECT 1 FROM local_inventory_items i WHERE i.id = v.column2 AND i.deleted_at IS NULL AND i.updated_at = '2026-09-25T23:30:00.000Z' AND i.updated_by = '7b59cf6b-04b6-4742-bb1b-78a28b593fe8')
AND NOT EXISTS (SELECT 1 FROM record_change_log r WHERE r.id = v.column1);
INSERT INTO record_change_log (id, record_table, record_id, field, old_value, new_value, actor_person_id, reason, changed_at)
SELECT v.column1, 'local_inventory_items', v.column2, 'deleted_by', '7b59cf6b-04b6-4742-bb1b-78a28b593fe8', NULL, '7b59cf6b-04b6-4742-bb1b-78a28b593fe8', 'repair 2026-09-25 (canon 0.30.240), METRC wins: a cryo output the shipped purge of 9/21 00:51Z voided restored to the ledger, METRC listing it active at AU-P-000694: tag ' || v.column3, '2026-09-25T23:30:00.000Z'
FROM (VALUES
  ('bd8ff7b0-1fcd-5b53-b087-88e36726ed09', '42eefdbc-abe2-4dbf-bee1-6296bb3f7b94', '1A4050300061761000001009'),
  ('3b2cb446-ca01-5e1a-a161-003bf30cff39', 'aa8f36e6-da2f-4170-b362-89ba89a9f25d', '1A4050300061761000001007'),
  ('f06b8d85-aa45-5d9d-85b4-a051f1526fe7', '1bb6d144-e1d4-4153-a883-5307e81db2ad', '1A4050300061761000001008'),
  ('2414cc14-ff0d-5a67-9a91-e262d3a1a6bc', '607c25e7-afad-47c0-a8e3-2bf3e2245dab', '1A4050300061761000001021'),
  ('93188644-d4c8-5589-8769-fa0ac62696a4', '73e15277-1469-4d54-a4ea-0c45054063d1', '1A4050300061761000001020'),
  ('4a8ca473-3a5e-51e6-b890-e34cd4445bf8', '4cf301b9-53da-4dfe-be9d-0c101cb2556b', '1A4050300061761000001019'),
  ('ee24fe4b-b492-58e1-b9f2-a95c9fc481bf', 'cc97066a-3daa-4c59-aa06-03feabc046f4', '1A4050300061761000001018'),
  ('ad88a4e7-d724-59c3-af50-817ac0ef7877', 'e9685e9c-ee27-44bc-9243-088c9473d600', '1A4050300061761000001017'),
  ('5161bbe7-7480-5968-ae47-1d56d3c77922', '470f3ed1-2de9-48b6-82a7-9c7683fc1e4e', '1A4050300061761000001016'),
  ('a43c8053-e720-5940-88fd-1f8e82522c0d', '2c024495-8b0e-4374-827f-3ab6d4a9ea46', '1A4050300061761000001015'),
  ('0bfc8363-7828-5351-bc68-8d848c6ec177', '5d4917dd-6f39-417b-a87e-61f576393617', '1A4050300061761000001014'),
  ('d7339187-514c-5219-a8bb-8257e4f7b089', 'cb8e603b-35c6-4b5c-bea4-2ef08ff842b4', '1A4050300061761000001006'),
  ('ec6d959e-1974-5b19-b342-2798d00b7417', 'e2bb763c-9359-4156-b34c-5938d50e8682', '1A4050300061761000001005'),
  ('9aab5d6d-c949-51b5-be22-a5da39221b57', 'dd39a755-a5cb-486b-b182-bb129ce1d761', '1A4050300061761000001004'),
  ('0826ca87-72fc-5be5-8635-843b34a2383b', '0d32367c-9c9c-483c-a1ba-b7833cc08d02', '1A4050300061761000001003'),
  ('80859978-cd38-5f57-b1f6-cfa05f217bfc', '6cf1c1e0-1076-4099-a060-6866a694e286', '1A4050300061761000001002'),
  ('fac25adc-3d81-522d-9111-7f22b72cbf8f', '4d09daa3-fb59-4b8c-a2bf-3d0c98edca65', '1A4050300061761000001013'),
  ('9a6b47a1-3140-5779-920f-8125575d018e', '4bf10a0c-b3d4-4b32-a92a-d95c64da6be5', '1A4050300061761000001012'),
  ('e20767a4-3ac2-5df3-b5ad-626c0979ea03', '4a976194-de1b-4928-ab48-b0f271c2bfcb', '1A4050300061761000001001'),
  ('a92c3a5a-08db-57b9-a6b9-618c2959017d', '46f90846-a8c3-4b55-b479-b489c617c361', '1A4050300061761000001993')) AS v
WHERE EXISTS (SELECT 1 FROM local_inventory_items i WHERE i.id = v.column2 AND i.deleted_at IS NULL AND i.updated_at = '2026-09-25T23:30:00.000Z' AND i.updated_by = '7b59cf6b-04b6-4742-bb1b-78a28b593fe8')
AND NOT EXISTS (SELECT 1 FROM record_change_log r WHERE r.id = v.column1);
INSERT INTO record_change_log (id, record_table, record_id, field, old_value, new_value, actor_person_id, reason, changed_at)
SELECT v.column1, 'local_inventory_items', v.column2, 'delete_reason', 'shipped', NULL, '7b59cf6b-04b6-4742-bb1b-78a28b593fe8', 'repair 2026-09-25 (canon 0.30.240), METRC wins: a cryo output the shipped purge of 9/21 00:51Z voided restored to the ledger, METRC listing it active at AU-P-000694: tag ' || v.column3, '2026-09-25T23:30:00.000Z'
FROM (VALUES
  ('53db4cea-b540-59ba-aaa1-125748c22610', '42eefdbc-abe2-4dbf-bee1-6296bb3f7b94', '1A4050300061761000001009'),
  ('348577cb-f624-545e-97ca-67c2e827c491', 'aa8f36e6-da2f-4170-b362-89ba89a9f25d', '1A4050300061761000001007'),
  ('4c1f8dfd-e3ab-5253-b3d3-edbfea8d942d', '1bb6d144-e1d4-4153-a883-5307e81db2ad', '1A4050300061761000001008'),
  ('0b830832-2814-5aec-985c-0b758ca915c8', '607c25e7-afad-47c0-a8e3-2bf3e2245dab', '1A4050300061761000001021'),
  ('80f978fe-8d65-5bf7-b812-00cad040dead', '73e15277-1469-4d54-a4ea-0c45054063d1', '1A4050300061761000001020'),
  ('80ed5aa4-1202-514d-b6ae-0d2aa4576151', '4cf301b9-53da-4dfe-be9d-0c101cb2556b', '1A4050300061761000001019'),
  ('887a9839-537f-58e7-aca1-c225a07c1f3b', 'cc97066a-3daa-4c59-aa06-03feabc046f4', '1A4050300061761000001018'),
  ('99fad58c-0235-502f-b0cb-7a29223ac5fa', 'e9685e9c-ee27-44bc-9243-088c9473d600', '1A4050300061761000001017'),
  ('bbd4610b-ef03-54f3-b8e9-9e0ee3cb9458', '470f3ed1-2de9-48b6-82a7-9c7683fc1e4e', '1A4050300061761000001016'),
  ('899337e8-d54f-58e6-af6f-834bac766547', '2c024495-8b0e-4374-827f-3ab6d4a9ea46', '1A4050300061761000001015'),
  ('6fe8ddde-23e8-53f6-9fba-3c527b9149dd', '5d4917dd-6f39-417b-a87e-61f576393617', '1A4050300061761000001014'),
  ('6e362f00-edd9-53dc-b93a-1219136560d3', 'cb8e603b-35c6-4b5c-bea4-2ef08ff842b4', '1A4050300061761000001006'),
  ('c56dfcfb-0334-5e20-a570-1e52f844d41a', 'e2bb763c-9359-4156-b34c-5938d50e8682', '1A4050300061761000001005'),
  ('cf2b69a5-552c-56a9-bc8f-c970c7432f2c', 'dd39a755-a5cb-486b-b182-bb129ce1d761', '1A4050300061761000001004'),
  ('bdd7f702-bc24-5c9e-8350-ea7228366593', '0d32367c-9c9c-483c-a1ba-b7833cc08d02', '1A4050300061761000001003'),
  ('221c99cd-6522-54ac-a620-b868b945c725', '6cf1c1e0-1076-4099-a060-6866a694e286', '1A4050300061761000001002'),
  ('97e60b08-d1aa-5ff8-b0c0-0c98434aa508', '4d09daa3-fb59-4b8c-a2bf-3d0c98edca65', '1A4050300061761000001013'),
  ('e6d5a2f2-0073-5f3b-b927-ab82de0573bc', '4bf10a0c-b3d4-4b32-a92a-d95c64da6be5', '1A4050300061761000001012'),
  ('81a27d46-d767-5643-9d77-9bbeeb30c0dd', '4a976194-de1b-4928-ab48-b0f271c2bfcb', '1A4050300061761000001001'),
  ('a9881aea-a4ce-5c87-88dd-254a216d73bd', '46f90846-a8c3-4b55-b479-b489c617c361', '1A4050300061761000001993')) AS v
WHERE EXISTS (SELECT 1 FROM local_inventory_items i WHERE i.id = v.column2 AND i.deleted_at IS NULL AND i.updated_at = '2026-09-25T23:30:00.000Z' AND i.updated_by = '7b59cf6b-04b6-4742-bb1b-78a28b593fe8')
AND NOT EXISTS (SELECT 1 FROM record_change_log r WHERE r.id = v.column1);

-- The shipped purge of 9/21 00:51Z, items 41 to 47 of 47: 1992 BUD, 1991 BUD, 1990 BUD, 1989 BUD, 1988 BUD, 1987 BUD, 1986 BUD
UPDATE local_inventory_items SET deleted_at = NULL, deleted_by = NULL, delete_reason = NULL, updated_at = '2026-09-25T23:30:00.000Z', updated_by = '7b59cf6b-04b6-4742-bb1b-78a28b593fe8'
WHERE (id, wip_package_id, metrc_tag) IN (VALUES
  ('85b6c006-e962-4d11-8e71-04fd297e5e38', 'b1b8fdac-23a1-4451-9aff-3f9b36cea883', '1A4050300061761000001992'),
  ('74e58294-ec43-4f23-a610-de5bc977d11c', '7570c353-3603-4239-84bc-5ef8e2b8f398', '1A4050300061761000001991'),
  ('bd89484f-1c8e-4dc7-8f6b-907556c0c48d', '349eb8f0-3c00-4a59-a465-cf9ad5b50845', '1A4050300061761000001990'),
  ('20f533a3-7b8e-47d9-abdf-d00e024e43e6', '018b0c9f-4ad0-4ba5-a47c-4ee0adae0f37', '1A4050300061761000001989'),
  ('6d25f190-98b2-46be-b3e1-eebead7e6cc6', '78d37742-6cd1-44c0-913e-8fec2b29c33c', '1A4050300061761000001988'),
  ('f8b40f50-ecc7-45c4-af75-3913a1563c33', 'f351aa1a-783d-4462-b667-9f799af91e47', '1A4050300061761000001987'),
  ('72850f04-f723-471f-acc2-33b1933518a8', 'fa5e331d-476c-4d12-a20e-22c4becbf437', '1A4050300061761000001986'))
AND deleted_at = '2026-09-21T00:51:50.527Z' AND delete_reason = 'shipped' AND deleted_by = '7b59cf6b-04b6-4742-bb1b-78a28b593fe8'
AND EXISTS (SELECT 1 FROM metrc_packages m WHERE m.tag = local_inventory_items.metrc_tag AND m.gone_at IS NULL AND m.quantity > 0);
INSERT INTO record_change_log (id, record_table, record_id, field, old_value, new_value, actor_person_id, reason, changed_at)
SELECT v.column1, 'local_inventory_items', v.column2, 'deleted_at', '2026-09-21T00:51:50.527Z', NULL, '7b59cf6b-04b6-4742-bb1b-78a28b593fe8', 'repair 2026-09-25 (canon 0.30.240), METRC wins: a cryo output the shipped purge of 9/21 00:51Z voided restored to the ledger, METRC listing it active at AU-P-000694: tag ' || v.column3, '2026-09-25T23:30:00.000Z'
FROM (VALUES
  ('7b934165-4411-594e-82a3-79ce9ee8c825', '85b6c006-e962-4d11-8e71-04fd297e5e38', '1A4050300061761000001992'),
  ('8538be7b-9216-5afa-97e4-b4628c7536a0', '74e58294-ec43-4f23-a610-de5bc977d11c', '1A4050300061761000001991'),
  ('5e3fabc1-3f63-546e-b987-10a7d9cf4049', 'bd89484f-1c8e-4dc7-8f6b-907556c0c48d', '1A4050300061761000001990'),
  ('d55f8ad4-8070-5ead-87b0-9b42d093ac69', '20f533a3-7b8e-47d9-abdf-d00e024e43e6', '1A4050300061761000001989'),
  ('7178008c-e8c5-5290-8f3e-83851b706c2b', '6d25f190-98b2-46be-b3e1-eebead7e6cc6', '1A4050300061761000001988'),
  ('b9bbe40a-9869-5446-a4f0-7135127ad623', 'f8b40f50-ecc7-45c4-af75-3913a1563c33', '1A4050300061761000001987'),
  ('1729a55a-432f-5faa-b90c-36feee363da0', '72850f04-f723-471f-acc2-33b1933518a8', '1A4050300061761000001986')) AS v
WHERE EXISTS (SELECT 1 FROM local_inventory_items i WHERE i.id = v.column2 AND i.deleted_at IS NULL AND i.updated_at = '2026-09-25T23:30:00.000Z' AND i.updated_by = '7b59cf6b-04b6-4742-bb1b-78a28b593fe8')
AND NOT EXISTS (SELECT 1 FROM record_change_log r WHERE r.id = v.column1);
INSERT INTO record_change_log (id, record_table, record_id, field, old_value, new_value, actor_person_id, reason, changed_at)
SELECT v.column1, 'local_inventory_items', v.column2, 'deleted_by', '7b59cf6b-04b6-4742-bb1b-78a28b593fe8', NULL, '7b59cf6b-04b6-4742-bb1b-78a28b593fe8', 'repair 2026-09-25 (canon 0.30.240), METRC wins: a cryo output the shipped purge of 9/21 00:51Z voided restored to the ledger, METRC listing it active at AU-P-000694: tag ' || v.column3, '2026-09-25T23:30:00.000Z'
FROM (VALUES
  ('6d2c4e02-8e79-55f5-91ae-1d578e7a9f88', '85b6c006-e962-4d11-8e71-04fd297e5e38', '1A4050300061761000001992'),
  ('661f18e8-238a-5818-9e52-021557f214dd', '74e58294-ec43-4f23-a610-de5bc977d11c', '1A4050300061761000001991'),
  ('4381664f-6844-599a-abc5-8c936d68b53b', 'bd89484f-1c8e-4dc7-8f6b-907556c0c48d', '1A4050300061761000001990'),
  ('0d51b44c-63d2-517a-9278-da6be943d516', '20f533a3-7b8e-47d9-abdf-d00e024e43e6', '1A4050300061761000001989'),
  ('cae016b9-9c89-53bd-ac4f-f0119669d9c5', '6d25f190-98b2-46be-b3e1-eebead7e6cc6', '1A4050300061761000001988'),
  ('ef51409e-5e95-529d-8dd5-5d29ff3aeea3', 'f8b40f50-ecc7-45c4-af75-3913a1563c33', '1A4050300061761000001987'),
  ('1335d2ed-bb24-5a32-8808-fc90f24ece6f', '72850f04-f723-471f-acc2-33b1933518a8', '1A4050300061761000001986')) AS v
WHERE EXISTS (SELECT 1 FROM local_inventory_items i WHERE i.id = v.column2 AND i.deleted_at IS NULL AND i.updated_at = '2026-09-25T23:30:00.000Z' AND i.updated_by = '7b59cf6b-04b6-4742-bb1b-78a28b593fe8')
AND NOT EXISTS (SELECT 1 FROM record_change_log r WHERE r.id = v.column1);
INSERT INTO record_change_log (id, record_table, record_id, field, old_value, new_value, actor_person_id, reason, changed_at)
SELECT v.column1, 'local_inventory_items', v.column2, 'delete_reason', 'shipped', NULL, '7b59cf6b-04b6-4742-bb1b-78a28b593fe8', 'repair 2026-09-25 (canon 0.30.240), METRC wins: a cryo output the shipped purge of 9/21 00:51Z voided restored to the ledger, METRC listing it active at AU-P-000694: tag ' || v.column3, '2026-09-25T23:30:00.000Z'
FROM (VALUES
  ('150cd978-825e-5d07-a427-1d0f11cb50c7', '85b6c006-e962-4d11-8e71-04fd297e5e38', '1A4050300061761000001992'),
  ('6fbeaafe-df87-5d34-a0ab-751f51a89d90', '74e58294-ec43-4f23-a610-de5bc977d11c', '1A4050300061761000001991'),
  ('38b87ca2-8fc7-54be-876c-6318fb4ade05', 'bd89484f-1c8e-4dc7-8f6b-907556c0c48d', '1A4050300061761000001990'),
  ('f65b9d5d-2104-5cd7-bde9-294cac2e03e1', '20f533a3-7b8e-47d9-abdf-d00e024e43e6', '1A4050300061761000001989'),
  ('2d7d0086-2cef-5188-a395-d098e8627726', '6d25f190-98b2-46be-b3e1-eebead7e6cc6', '1A4050300061761000001988'),
  ('ce32ec2f-6cfc-51b3-9b66-31035b048a8c', 'f8b40f50-ecc7-45c4-af75-3913a1563c33', '1A4050300061761000001987'),
  ('65d78d40-eea8-5e3d-8f66-ba1cdd1f5ff8', '72850f04-f723-471f-acc2-33b1933518a8', '1A4050300061761000001986')) AS v
WHERE EXISTS (SELECT 1 FROM local_inventory_items i WHERE i.id = v.column2 AND i.deleted_at IS NULL AND i.updated_at = '2026-09-25T23:30:00.000Z' AND i.updated_by = '7b59cf6b-04b6-4742-bb1b-78a28b593fe8')
AND NOT EXISTS (SELECT 1 FROM record_change_log r WHERE r.id = v.column1);

-- The these are not FFZ purge of 9/21 15:49Z, items 1 to 6 of 6: 1050 BUD, 1042 BUD, 1041 BUD, 1040 BUD, 1039 BUD, 1038 BUD
UPDATE local_inventory_items SET deleted_at = NULL, deleted_by = NULL, delete_reason = NULL, updated_at = '2026-09-25T23:30:00.000Z', updated_by = '7b59cf6b-04b6-4742-bb1b-78a28b593fe8'
WHERE (id, wip_package_id, metrc_tag) IN (VALUES
  ('41bdca32-5b8a-477e-b332-732937622fc6', '6a16dce6-afdf-47da-84cc-d598db2ca7c7', '1A4050300061761000001050'),
  ('cdd6786b-3d25-4e18-850f-db64f921a7ee', '1ae07ee5-0131-4891-99b5-c59d44007f68', '1A4050300061761000001042'),
  ('2ff5d953-4edb-4750-92b9-528ef61cd83a', '08f09dd8-2bca-4cab-be20-2e970996b7c7', '1A4050300061761000001041'),
  ('bb85cf83-7cf9-4a8c-8f19-317e1ee6df22', '11df5fdb-47e5-4eaf-bfb1-c316859f724c', '1A4050300061761000001040'),
  ('2d817648-3a92-44e5-864e-447d780de932', '59b1076a-2ac2-45fe-b686-6a0136c801a3', '1A4050300061761000001039'),
  ('81522698-dd5a-4f41-8292-ebb58a01b653', '97e92f10-2df7-4a0f-abcb-f0a322e1f08e', '1A4050300061761000001038'))
AND deleted_at = '2026-09-21T15:49:31.314Z' AND delete_reason = 'these are not FFZ' AND deleted_by = '7b59cf6b-04b6-4742-bb1b-78a28b593fe8'
AND EXISTS (SELECT 1 FROM metrc_packages m WHERE m.tag = local_inventory_items.metrc_tag AND m.gone_at IS NULL AND m.quantity > 0);
INSERT INTO record_change_log (id, record_table, record_id, field, old_value, new_value, actor_person_id, reason, changed_at)
SELECT v.column1, 'local_inventory_items', v.column2, 'deleted_at', '2026-09-21T15:49:31.314Z', NULL, '7b59cf6b-04b6-4742-bb1b-78a28b593fe8', 'repair 2026-09-25 (canon 0.30.240), METRC wins: a cryo output the these are not FFZ purge of 9/21 15:49Z voided restored to the ledger, METRC listing it active at AU-P-000694: tag ' || v.column3, '2026-09-25T23:30:00.000Z'
FROM (VALUES
  ('a5a707e9-a8d4-5889-9fbe-4ce767f37152', '41bdca32-5b8a-477e-b332-732937622fc6', '1A4050300061761000001050'),
  ('b1716660-5dd7-5cc8-8243-316ad7d131ba', 'cdd6786b-3d25-4e18-850f-db64f921a7ee', '1A4050300061761000001042'),
  ('ea2a8e2f-24c2-5708-8881-03ef848b3008', '2ff5d953-4edb-4750-92b9-528ef61cd83a', '1A4050300061761000001041'),
  ('1bfa201f-a1e3-5875-bea1-b67a403ade20', 'bb85cf83-7cf9-4a8c-8f19-317e1ee6df22', '1A4050300061761000001040'),
  ('ce897ef6-4639-5704-9a67-736e0b0f5d65', '2d817648-3a92-44e5-864e-447d780de932', '1A4050300061761000001039'),
  ('038ae821-7b61-54c0-97d1-c678ab147ccf', '81522698-dd5a-4f41-8292-ebb58a01b653', '1A4050300061761000001038')) AS v
WHERE EXISTS (SELECT 1 FROM local_inventory_items i WHERE i.id = v.column2 AND i.deleted_at IS NULL AND i.updated_at = '2026-09-25T23:30:00.000Z' AND i.updated_by = '7b59cf6b-04b6-4742-bb1b-78a28b593fe8')
AND NOT EXISTS (SELECT 1 FROM record_change_log r WHERE r.id = v.column1);
INSERT INTO record_change_log (id, record_table, record_id, field, old_value, new_value, actor_person_id, reason, changed_at)
SELECT v.column1, 'local_inventory_items', v.column2, 'deleted_by', '7b59cf6b-04b6-4742-bb1b-78a28b593fe8', NULL, '7b59cf6b-04b6-4742-bb1b-78a28b593fe8', 'repair 2026-09-25 (canon 0.30.240), METRC wins: a cryo output the these are not FFZ purge of 9/21 15:49Z voided restored to the ledger, METRC listing it active at AU-P-000694: tag ' || v.column3, '2026-09-25T23:30:00.000Z'
FROM (VALUES
  ('7130bdca-f47b-5788-8870-66b650b26a01', '41bdca32-5b8a-477e-b332-732937622fc6', '1A4050300061761000001050'),
  ('45a83be3-2d29-5968-9ab5-ea622e2f9a44', 'cdd6786b-3d25-4e18-850f-db64f921a7ee', '1A4050300061761000001042'),
  ('ca706fce-c8ea-5eb5-a216-9f4a65dfb2cd', '2ff5d953-4edb-4750-92b9-528ef61cd83a', '1A4050300061761000001041'),
  ('f0a4c0f3-8748-562d-80af-3b1eec84219d', 'bb85cf83-7cf9-4a8c-8f19-317e1ee6df22', '1A4050300061761000001040'),
  ('95e040fb-395e-5fc1-a6e2-d0eaf600eba3', '2d817648-3a92-44e5-864e-447d780de932', '1A4050300061761000001039'),
  ('88155100-a353-53a4-89f9-619319ebaa39', '81522698-dd5a-4f41-8292-ebb58a01b653', '1A4050300061761000001038')) AS v
WHERE EXISTS (SELECT 1 FROM local_inventory_items i WHERE i.id = v.column2 AND i.deleted_at IS NULL AND i.updated_at = '2026-09-25T23:30:00.000Z' AND i.updated_by = '7b59cf6b-04b6-4742-bb1b-78a28b593fe8')
AND NOT EXISTS (SELECT 1 FROM record_change_log r WHERE r.id = v.column1);
INSERT INTO record_change_log (id, record_table, record_id, field, old_value, new_value, actor_person_id, reason, changed_at)
SELECT v.column1, 'local_inventory_items', v.column2, 'delete_reason', 'these are not FFZ', NULL, '7b59cf6b-04b6-4742-bb1b-78a28b593fe8', 'repair 2026-09-25 (canon 0.30.240), METRC wins: a cryo output the these are not FFZ purge of 9/21 15:49Z voided restored to the ledger, METRC listing it active at AU-P-000694: tag ' || v.column3, '2026-09-25T23:30:00.000Z'
FROM (VALUES
  ('6773e582-0a82-524a-9917-e2ebce6a1065', '41bdca32-5b8a-477e-b332-732937622fc6', '1A4050300061761000001050'),
  ('be172005-59a2-59ab-a3db-be0584f00629', 'cdd6786b-3d25-4e18-850f-db64f921a7ee', '1A4050300061761000001042'),
  ('f67c0b3e-b3f5-53c6-8fa3-c324862ae4d8', '2ff5d953-4edb-4750-92b9-528ef61cd83a', '1A4050300061761000001041'),
  ('d6337172-3b16-5242-80e5-7515325508ad', 'bb85cf83-7cf9-4a8c-8f19-317e1ee6df22', '1A4050300061761000001040'),
  ('b5cd0b91-05ef-57bc-9afc-c5867b7cbb8f', '2d817648-3a92-44e5-864e-447d780de932', '1A4050300061761000001039'),
  ('c8ba0e1b-8b1a-5a2c-92b7-363a0b892c5c', '81522698-dd5a-4f41-8292-ebb58a01b653', '1A4050300061761000001038')) AS v
WHERE EXISTS (SELECT 1 FROM local_inventory_items i WHERE i.id = v.column2 AND i.deleted_at IS NULL AND i.updated_at = '2026-09-25T23:30:00.000Z' AND i.updated_by = '7b59cf6b-04b6-4742-bb1b-78a28b593fe8')
AND NOT EXISTS (SELECT 1 FROM record_change_log r WHERE r.id = v.column1);

-- The not real purge of 9/22 12:26Z, items 1 to 20 of 26: 1074 BUD, 1073 BUD, 1075 WPR, 1072 BUD, 1071 BUD, 1070 BUD, 1069 BUD, 1068 BUD, 1067 BUD, 1066 BUD, 1065 BUD, 1064 WPR, 1063 WPR, 1062 WPR, 1061 WPR, 1060 WPR, 1059 BUD, 1058 BUD, 1057 BUD, 1056 BUD
UPDATE local_inventory_items SET deleted_at = NULL, deleted_by = NULL, delete_reason = NULL, updated_at = '2026-09-25T23:30:00.000Z', updated_by = '7b59cf6b-04b6-4742-bb1b-78a28b593fe8'
WHERE (id, wip_package_id, metrc_tag) IN (VALUES
  ('3b2fde14-e06c-4a70-b08b-98e8e36be618', '85000589-996f-4d06-b3f0-e69851030642', '1A4050300061761000001074'),
  ('e32a1972-6d69-4a28-8dd5-e407613256ed', '185d5a7f-7ef4-4b5c-97f1-df9d98995aed', '1A4050300061761000001073'),
  ('0ca4df9b-4f26-4b4c-81b4-972ff4e7520e', 'e654a4ab-8065-4c4d-96c6-290cb0dd83ad', '1A4050300061761000001075'),
  ('c684ace2-996a-41f8-9dae-0c77fe737e55', 'a85658d0-0de0-4c66-9edf-194ca1613d3f', '1A4050300061761000001072'),
  ('55cc3daf-bb9f-4999-bce3-58bc87fa820b', 'af5e0e6f-c7ee-4697-bb45-5247d3ac64b2', '1A4050300061761000001071'),
  ('563759ba-a154-4699-a294-0bb552de2adc', 'f1bffc16-cdb3-4bfb-82cf-8db96cb780d8', '1A4050300061761000001070'),
  ('81920718-67cd-419b-b433-e7f6442c7e71', '6e412149-5404-4a16-948a-ce943e12bfb4', '1A4050300061761000001069'),
  ('54b42c85-e392-4947-baaf-1855c0f72039', '0c56370f-8f63-41c4-985e-d64fe710747c', '1A4050300061761000001068'),
  ('6a84e2ef-9720-4cb4-96da-c559a4a5bf7b', 'a5738576-774c-4598-911a-aee7fa555177', '1A4050300061761000001067'),
  ('9a7b0bfc-497f-47ce-820a-4440da82e5a5', 'b64c6492-8166-4a28-804c-2d5360769462', '1A4050300061761000001066'),
  ('04ff40b7-d003-4fba-a9ff-fccf3099ed90', 'ad6fe707-0907-4949-8bed-0318f79a4e33', '1A4050300061761000001065'),
  ('ff79dab4-322f-4a88-8d8a-4668bbf1456f', '022acbc4-d91f-4865-a2c7-9b9d65b00efc', '1A4050300061761000001064'),
  ('5adae25c-974b-4457-8e93-a957bdd5326f', '89227415-e747-4b35-b26b-47e4be7102a1', '1A4050300061761000001063'),
  ('a9440348-6c0c-42e5-ad35-cab4c2293523', '5a5b40d9-592e-4e55-9100-2cc9082f1ea4', '1A4050300061761000001062'),
  ('bf7ddb89-04db-4f40-a6fc-1a626dcedde8', '919f0ef5-c6ab-40e1-a848-f133d7663a9b', '1A4050300061761000001061'),
  ('82ab8e77-fdc9-435e-aff4-672428ae5605', '09aa3982-8e83-4ccb-ac26-85740ad5b0a4', '1A4050300061761000001060'),
  ('1e0a3a09-3100-457e-86b0-1d4d9f35625a', 'cca09033-a4c6-493b-948e-f66e46758045', '1A4050300061761000001059'),
  ('a9762b03-b7c0-4d34-93f7-6b6695c43302', '1439f288-c978-40e4-ad93-6de141e269c0', '1A4050300061761000001058'),
  ('058cb1a9-ce41-4e4b-bb61-9556bc483aaf', '95cbfbf3-f110-44c1-9af1-fc50ef254a3b', '1A4050300061761000001057'),
  ('2ca079d1-7419-46d9-a29b-bd4c4244c9f0', 'e23c6846-b66f-4e7b-a872-543c163b9fe5', '1A4050300061761000001056'))
AND deleted_at = '2026-09-22T12:26:15.752Z' AND delete_reason = 'not real' AND deleted_by = '7b59cf6b-04b6-4742-bb1b-78a28b593fe8'
AND EXISTS (SELECT 1 FROM metrc_packages m WHERE m.tag = local_inventory_items.metrc_tag AND m.gone_at IS NULL AND m.quantity > 0);
INSERT INTO record_change_log (id, record_table, record_id, field, old_value, new_value, actor_person_id, reason, changed_at)
SELECT v.column1, 'local_inventory_items', v.column2, 'deleted_at', '2026-09-22T12:26:15.752Z', NULL, '7b59cf6b-04b6-4742-bb1b-78a28b593fe8', 'repair 2026-09-25 (canon 0.30.240), METRC wins: a cryo output the not real purge of 9/22 12:26Z voided restored to the ledger, METRC listing it active at AU-P-000694: tag ' || v.column3, '2026-09-25T23:30:00.000Z'
FROM (VALUES
  ('83eedd82-3f72-51d2-ab0f-b3e5e16836a7', '3b2fde14-e06c-4a70-b08b-98e8e36be618', '1A4050300061761000001074'),
  ('aba7f882-32a7-5968-83a1-c2f3503b98e3', 'e32a1972-6d69-4a28-8dd5-e407613256ed', '1A4050300061761000001073'),
  ('b7407b5e-4443-5816-88b1-b16b704cdcdd', '0ca4df9b-4f26-4b4c-81b4-972ff4e7520e', '1A4050300061761000001075'),
  ('aa41b97a-d686-57d1-b5cd-41f1c8237eb4', 'c684ace2-996a-41f8-9dae-0c77fe737e55', '1A4050300061761000001072'),
  ('d8e92ab7-7ebe-592f-9e77-7591153bf326', '55cc3daf-bb9f-4999-bce3-58bc87fa820b', '1A4050300061761000001071'),
  ('42efdf9e-12a0-5d41-8318-77ba52cf36dd', '563759ba-a154-4699-a294-0bb552de2adc', '1A4050300061761000001070'),
  ('ede2593c-c23c-5186-9e83-60404a6296d9', '81920718-67cd-419b-b433-e7f6442c7e71', '1A4050300061761000001069'),
  ('1be8f9f5-e3f8-58e5-8a66-ff7572f1f460', '54b42c85-e392-4947-baaf-1855c0f72039', '1A4050300061761000001068'),
  ('09182705-634a-5a73-adbf-e5b7d04432d2', '6a84e2ef-9720-4cb4-96da-c559a4a5bf7b', '1A4050300061761000001067'),
  ('db25a87c-eb6b-5b6f-9696-4d032001113e', '9a7b0bfc-497f-47ce-820a-4440da82e5a5', '1A4050300061761000001066'),
  ('ccf0d7ab-185e-588a-ae83-537f6c4af93d', '04ff40b7-d003-4fba-a9ff-fccf3099ed90', '1A4050300061761000001065'),
  ('4d1d83ac-18da-55e4-8f29-2f0808bcec77', 'ff79dab4-322f-4a88-8d8a-4668bbf1456f', '1A4050300061761000001064'),
  ('754051ee-b1d4-561b-a92b-7370d181be1d', '5adae25c-974b-4457-8e93-a957bdd5326f', '1A4050300061761000001063'),
  ('88ddac6d-45a1-507c-9d51-6819be1fef80', 'a9440348-6c0c-42e5-ad35-cab4c2293523', '1A4050300061761000001062'),
  ('24c61358-5719-5505-95a3-80f7c847befb', 'bf7ddb89-04db-4f40-a6fc-1a626dcedde8', '1A4050300061761000001061'),
  ('a7f4927a-6901-5d72-8b05-7cc24510fd4a', '82ab8e77-fdc9-435e-aff4-672428ae5605', '1A4050300061761000001060'),
  ('8272aff4-e2de-58bf-9782-cb6c85b8be73', '1e0a3a09-3100-457e-86b0-1d4d9f35625a', '1A4050300061761000001059'),
  ('74d61da9-401c-5128-9386-41cf559db92c', 'a9762b03-b7c0-4d34-93f7-6b6695c43302', '1A4050300061761000001058'),
  ('47643f81-f42a-54f0-8c5a-10620f757dfc', '058cb1a9-ce41-4e4b-bb61-9556bc483aaf', '1A4050300061761000001057'),
  ('f118a62f-b47f-57a4-b7da-777adb7a9a1f', '2ca079d1-7419-46d9-a29b-bd4c4244c9f0', '1A4050300061761000001056')) AS v
WHERE EXISTS (SELECT 1 FROM local_inventory_items i WHERE i.id = v.column2 AND i.deleted_at IS NULL AND i.updated_at = '2026-09-25T23:30:00.000Z' AND i.updated_by = '7b59cf6b-04b6-4742-bb1b-78a28b593fe8')
AND NOT EXISTS (SELECT 1 FROM record_change_log r WHERE r.id = v.column1);
INSERT INTO record_change_log (id, record_table, record_id, field, old_value, new_value, actor_person_id, reason, changed_at)
SELECT v.column1, 'local_inventory_items', v.column2, 'deleted_by', '7b59cf6b-04b6-4742-bb1b-78a28b593fe8', NULL, '7b59cf6b-04b6-4742-bb1b-78a28b593fe8', 'repair 2026-09-25 (canon 0.30.240), METRC wins: a cryo output the not real purge of 9/22 12:26Z voided restored to the ledger, METRC listing it active at AU-P-000694: tag ' || v.column3, '2026-09-25T23:30:00.000Z'
FROM (VALUES
  ('116f8104-5bf2-5551-bfce-3da3f8767b17', '3b2fde14-e06c-4a70-b08b-98e8e36be618', '1A4050300061761000001074'),
  ('a543ebda-68ce-59ce-8c5e-3e2e165dad75', 'e32a1972-6d69-4a28-8dd5-e407613256ed', '1A4050300061761000001073'),
  ('4947a4fb-73e4-5001-9424-bf903fa4dd1e', '0ca4df9b-4f26-4b4c-81b4-972ff4e7520e', '1A4050300061761000001075'),
  ('a7aa39af-4eb3-52df-87fd-e2a2327384ba', 'c684ace2-996a-41f8-9dae-0c77fe737e55', '1A4050300061761000001072'),
  ('937b1bab-d724-51ba-9b89-177918353cab', '55cc3daf-bb9f-4999-bce3-58bc87fa820b', '1A4050300061761000001071'),
  ('86ccd0b7-5408-5ce0-bb02-f1950e8691a6', '563759ba-a154-4699-a294-0bb552de2adc', '1A4050300061761000001070'),
  ('44c7151c-0dc5-538c-b189-09dfa685be29', '81920718-67cd-419b-b433-e7f6442c7e71', '1A4050300061761000001069'),
  ('ef3c5639-0302-5ac7-b820-b6474dc50cd3', '54b42c85-e392-4947-baaf-1855c0f72039', '1A4050300061761000001068'),
  ('ead983af-4d93-5a1c-9884-6fc9ec155554', '6a84e2ef-9720-4cb4-96da-c559a4a5bf7b', '1A4050300061761000001067'),
  ('f5d48a98-ab9e-5688-b774-977a9c4502f4', '9a7b0bfc-497f-47ce-820a-4440da82e5a5', '1A4050300061761000001066'),
  ('32210747-0ee6-50db-97d3-a8a461538d3d', '04ff40b7-d003-4fba-a9ff-fccf3099ed90', '1A4050300061761000001065'),
  ('02f13ef3-29dc-538d-a9d8-4da74e5501d0', 'ff79dab4-322f-4a88-8d8a-4668bbf1456f', '1A4050300061761000001064'),
  ('2ecd9536-cc05-5411-b760-cf78add6c453', '5adae25c-974b-4457-8e93-a957bdd5326f', '1A4050300061761000001063'),
  ('c87d9177-6e4d-5c83-ab22-88699840a616', 'a9440348-6c0c-42e5-ad35-cab4c2293523', '1A4050300061761000001062'),
  ('8e7e05da-32f1-551a-b1ec-c626110e94aa', 'bf7ddb89-04db-4f40-a6fc-1a626dcedde8', '1A4050300061761000001061'),
  ('05721217-22d5-520f-be82-2710ccc5c918', '82ab8e77-fdc9-435e-aff4-672428ae5605', '1A4050300061761000001060'),
  ('c6660660-20ac-595d-b79c-45e2f1a19eda', '1e0a3a09-3100-457e-86b0-1d4d9f35625a', '1A4050300061761000001059'),
  ('e7a13604-915e-5475-b7ba-748d82771df6', 'a9762b03-b7c0-4d34-93f7-6b6695c43302', '1A4050300061761000001058'),
  ('2f8e934d-78d6-58f9-ae40-b7a8cb5d1ce9', '058cb1a9-ce41-4e4b-bb61-9556bc483aaf', '1A4050300061761000001057'),
  ('a395c19f-734a-5b1a-8eba-c1f185e4ee68', '2ca079d1-7419-46d9-a29b-bd4c4244c9f0', '1A4050300061761000001056')) AS v
WHERE EXISTS (SELECT 1 FROM local_inventory_items i WHERE i.id = v.column2 AND i.deleted_at IS NULL AND i.updated_at = '2026-09-25T23:30:00.000Z' AND i.updated_by = '7b59cf6b-04b6-4742-bb1b-78a28b593fe8')
AND NOT EXISTS (SELECT 1 FROM record_change_log r WHERE r.id = v.column1);
INSERT INTO record_change_log (id, record_table, record_id, field, old_value, new_value, actor_person_id, reason, changed_at)
SELECT v.column1, 'local_inventory_items', v.column2, 'delete_reason', 'not real', NULL, '7b59cf6b-04b6-4742-bb1b-78a28b593fe8', 'repair 2026-09-25 (canon 0.30.240), METRC wins: a cryo output the not real purge of 9/22 12:26Z voided restored to the ledger, METRC listing it active at AU-P-000694: tag ' || v.column3, '2026-09-25T23:30:00.000Z'
FROM (VALUES
  ('32b2ab87-077c-5d27-8df8-f30eb98caf46', '3b2fde14-e06c-4a70-b08b-98e8e36be618', '1A4050300061761000001074'),
  ('96e6621e-3396-5064-be77-ce6604321735', 'e32a1972-6d69-4a28-8dd5-e407613256ed', '1A4050300061761000001073'),
  ('c0429b3c-a41b-5311-bb4c-cfe7bc3d48da', '0ca4df9b-4f26-4b4c-81b4-972ff4e7520e', '1A4050300061761000001075'),
  ('a5775e10-780b-56aa-82c7-98c3d99a42cc', 'c684ace2-996a-41f8-9dae-0c77fe737e55', '1A4050300061761000001072'),
  ('492832b5-9c13-58e6-a130-ac1d69238e7d', '55cc3daf-bb9f-4999-bce3-58bc87fa820b', '1A4050300061761000001071'),
  ('c63a8c38-6812-5a86-8ec0-084e2d834f4a', '563759ba-a154-4699-a294-0bb552de2adc', '1A4050300061761000001070'),
  ('3db70020-c1a2-5151-ad85-e7621c02e7c0', '81920718-67cd-419b-b433-e7f6442c7e71', '1A4050300061761000001069'),
  ('04eb051b-5178-5fac-aa6f-37599ab13f20', '54b42c85-e392-4947-baaf-1855c0f72039', '1A4050300061761000001068'),
  ('a3494c66-e829-5a6a-a4cd-aec7aaf051f1', '6a84e2ef-9720-4cb4-96da-c559a4a5bf7b', '1A4050300061761000001067'),
  ('67cf6e58-e1dd-5626-bc12-47736ba4ee74', '9a7b0bfc-497f-47ce-820a-4440da82e5a5', '1A4050300061761000001066'),
  ('96341eba-92fd-5a03-b795-f5bbab921e1a', '04ff40b7-d003-4fba-a9ff-fccf3099ed90', '1A4050300061761000001065'),
  ('4a89b93f-1800-5547-b2db-c08cf394ca81', 'ff79dab4-322f-4a88-8d8a-4668bbf1456f', '1A4050300061761000001064'),
  ('26d51db2-7485-54d1-b934-f8983775d38a', '5adae25c-974b-4457-8e93-a957bdd5326f', '1A4050300061761000001063'),
  ('e85df7a1-c26a-5fc5-815b-d53807df1bdf', 'a9440348-6c0c-42e5-ad35-cab4c2293523', '1A4050300061761000001062'),
  ('07cf545b-7fed-54b7-b5f8-55449ffb87a8', 'bf7ddb89-04db-4f40-a6fc-1a626dcedde8', '1A4050300061761000001061'),
  ('72794da3-038c-5cda-ad63-d479c2c49a74', '82ab8e77-fdc9-435e-aff4-672428ae5605', '1A4050300061761000001060'),
  ('5edb52c2-3e96-5159-8c21-af92d2eb846a', '1e0a3a09-3100-457e-86b0-1d4d9f35625a', '1A4050300061761000001059'),
  ('1acf6f5e-98be-57cb-bcbc-1a0b71ab938e', 'a9762b03-b7c0-4d34-93f7-6b6695c43302', '1A4050300061761000001058'),
  ('3f60e369-dcaf-57df-9190-f8ac24abeaf8', '058cb1a9-ce41-4e4b-bb61-9556bc483aaf', '1A4050300061761000001057'),
  ('76b0e38e-bb04-5253-bf91-5cdd8165436a', '2ca079d1-7419-46d9-a29b-bd4c4244c9f0', '1A4050300061761000001056')) AS v
WHERE EXISTS (SELECT 1 FROM local_inventory_items i WHERE i.id = v.column2 AND i.deleted_at IS NULL AND i.updated_at = '2026-09-25T23:30:00.000Z' AND i.updated_by = '7b59cf6b-04b6-4742-bb1b-78a28b593fe8')
AND NOT EXISTS (SELECT 1 FROM record_change_log r WHERE r.id = v.column1);

-- The not real purge of 9/22 12:26Z, items 21 to 26 of 26: 1055 BUD, 1054 BUD, 1053 BUD, 1052 BUD, 1051 WPR, 1049 WPR
UPDATE local_inventory_items SET deleted_at = NULL, deleted_by = NULL, delete_reason = NULL, updated_at = '2026-09-25T23:30:00.000Z', updated_by = '7b59cf6b-04b6-4742-bb1b-78a28b593fe8'
WHERE (id, wip_package_id, metrc_tag) IN (VALUES
  ('fa8a427c-f590-4fd3-916b-ce35cc3378bd', '4f0b9e86-0af7-4df8-a49a-b652dd4c32bd', '1A4050300061761000001055'),
  ('c22199aa-4b12-4361-8914-e81b6774d6b8', 'cbc17a0c-062c-4ee1-8217-eb8ff716aae3', '1A4050300061761000001054'),
  ('6d14ca0e-8c04-4f2a-a442-fd7cca456603', '09a4c351-1952-45d9-bd4b-7ce62df1cd3f', '1A4050300061761000001053'),
  ('9c4c87f7-54a8-4242-81eb-1e8ad0e4bfc9', 'e1a7240e-c691-436c-bb2c-269149fe58fc', '1A4050300061761000001052'),
  ('a31e40ef-e67e-4e5f-a279-85782ba2d9ad', 'fb0b9cc9-cf6e-4006-b0a0-e080ae470487', '1A4050300061761000001051'),
  ('3d000143-10f9-47f1-88b4-73efb8ea2e25', '6741f693-f42c-479d-be63-a6db76ecfb6c', '1A4050300061761000001049'))
AND deleted_at = '2026-09-22T12:26:15.752Z' AND delete_reason = 'not real' AND deleted_by = '7b59cf6b-04b6-4742-bb1b-78a28b593fe8'
AND EXISTS (SELECT 1 FROM metrc_packages m WHERE m.tag = local_inventory_items.metrc_tag AND m.gone_at IS NULL AND m.quantity > 0);
INSERT INTO record_change_log (id, record_table, record_id, field, old_value, new_value, actor_person_id, reason, changed_at)
SELECT v.column1, 'local_inventory_items', v.column2, 'deleted_at', '2026-09-22T12:26:15.752Z', NULL, '7b59cf6b-04b6-4742-bb1b-78a28b593fe8', 'repair 2026-09-25 (canon 0.30.240), METRC wins: a cryo output the not real purge of 9/22 12:26Z voided restored to the ledger, METRC listing it active at AU-P-000694: tag ' || v.column3, '2026-09-25T23:30:00.000Z'
FROM (VALUES
  ('4af36702-007b-5bf8-a05e-f2bd3da8318a', 'fa8a427c-f590-4fd3-916b-ce35cc3378bd', '1A4050300061761000001055'),
  ('54f672e3-6167-5b8f-a667-81ae5cdd9eea', 'c22199aa-4b12-4361-8914-e81b6774d6b8', '1A4050300061761000001054'),
  ('e944fbe5-cc75-52ae-ba3e-737f66687b8a', '6d14ca0e-8c04-4f2a-a442-fd7cca456603', '1A4050300061761000001053'),
  ('21fa9c76-12e3-5675-b6a7-c77a2a33cc31', '9c4c87f7-54a8-4242-81eb-1e8ad0e4bfc9', '1A4050300061761000001052'),
  ('c756f285-a7b3-59a6-917f-0f7ec2366fc3', 'a31e40ef-e67e-4e5f-a279-85782ba2d9ad', '1A4050300061761000001051'),
  ('3de5dd73-c25a-5113-9794-f4870c15f7b8', '3d000143-10f9-47f1-88b4-73efb8ea2e25', '1A4050300061761000001049')) AS v
WHERE EXISTS (SELECT 1 FROM local_inventory_items i WHERE i.id = v.column2 AND i.deleted_at IS NULL AND i.updated_at = '2026-09-25T23:30:00.000Z' AND i.updated_by = '7b59cf6b-04b6-4742-bb1b-78a28b593fe8')
AND NOT EXISTS (SELECT 1 FROM record_change_log r WHERE r.id = v.column1);
INSERT INTO record_change_log (id, record_table, record_id, field, old_value, new_value, actor_person_id, reason, changed_at)
SELECT v.column1, 'local_inventory_items', v.column2, 'deleted_by', '7b59cf6b-04b6-4742-bb1b-78a28b593fe8', NULL, '7b59cf6b-04b6-4742-bb1b-78a28b593fe8', 'repair 2026-09-25 (canon 0.30.240), METRC wins: a cryo output the not real purge of 9/22 12:26Z voided restored to the ledger, METRC listing it active at AU-P-000694: tag ' || v.column3, '2026-09-25T23:30:00.000Z'
FROM (VALUES
  ('ea952f56-e4e0-5dba-be86-fa68afe05912', 'fa8a427c-f590-4fd3-916b-ce35cc3378bd', '1A4050300061761000001055'),
  ('7da4dd91-c990-5696-9317-f7f4c8f9a222', 'c22199aa-4b12-4361-8914-e81b6774d6b8', '1A4050300061761000001054'),
  ('31722167-46db-501b-8135-9e2388ec09ba', '6d14ca0e-8c04-4f2a-a442-fd7cca456603', '1A4050300061761000001053'),
  ('3c148cd4-36bc-523c-a699-3f12a770f2b7', '9c4c87f7-54a8-4242-81eb-1e8ad0e4bfc9', '1A4050300061761000001052'),
  ('e9b0c847-0cec-5ad4-9888-e2056e661559', 'a31e40ef-e67e-4e5f-a279-85782ba2d9ad', '1A4050300061761000001051'),
  ('7185b59e-19b4-5476-9c3b-24e79309fe5a', '3d000143-10f9-47f1-88b4-73efb8ea2e25', '1A4050300061761000001049')) AS v
WHERE EXISTS (SELECT 1 FROM local_inventory_items i WHERE i.id = v.column2 AND i.deleted_at IS NULL AND i.updated_at = '2026-09-25T23:30:00.000Z' AND i.updated_by = '7b59cf6b-04b6-4742-bb1b-78a28b593fe8')
AND NOT EXISTS (SELECT 1 FROM record_change_log r WHERE r.id = v.column1);
INSERT INTO record_change_log (id, record_table, record_id, field, old_value, new_value, actor_person_id, reason, changed_at)
SELECT v.column1, 'local_inventory_items', v.column2, 'delete_reason', 'not real', NULL, '7b59cf6b-04b6-4742-bb1b-78a28b593fe8', 'repair 2026-09-25 (canon 0.30.240), METRC wins: a cryo output the not real purge of 9/22 12:26Z voided restored to the ledger, METRC listing it active at AU-P-000694: tag ' || v.column3, '2026-09-25T23:30:00.000Z'
FROM (VALUES
  ('817d7b7d-998a-59a5-a904-a8550ecb4569', 'fa8a427c-f590-4fd3-916b-ce35cc3378bd', '1A4050300061761000001055'),
  ('4e4d3d8c-443a-570b-af96-26bd0c715825', 'c22199aa-4b12-4361-8914-e81b6774d6b8', '1A4050300061761000001054'),
  ('2c2ca3c1-1635-555a-9278-11b49b21c655', '6d14ca0e-8c04-4f2a-a442-fd7cca456603', '1A4050300061761000001053'),
  ('88517f31-98cb-523f-bf2f-6a0126197269', '9c4c87f7-54a8-4242-81eb-1e8ad0e4bfc9', '1A4050300061761000001052'),
  ('b251f559-c6fa-55a4-9047-c23d4fa875b8', 'a31e40ef-e67e-4e5f-a279-85782ba2d9ad', '1A4050300061761000001051'),
  ('aefdb6ae-21c2-5d2e-adcb-be4e4bea71ae', '3d000143-10f9-47f1-88b4-73efb8ea2e25', '1A4050300061761000001049')) AS v
WHERE EXISTS (SELECT 1 FROM local_inventory_items i WHERE i.id = v.column2 AND i.deleted_at IS NULL AND i.updated_at = '2026-09-25T23:30:00.000Z' AND i.updated_by = '7b59cf6b-04b6-4742-bb1b-78a28b593fe8')
AND NOT EXISTS (SELECT 1 FROM record_change_log r WHERE r.id = v.column1);
