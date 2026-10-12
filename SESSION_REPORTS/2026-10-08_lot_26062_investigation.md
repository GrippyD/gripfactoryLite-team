# Investigation 26062: one HBN, two wet loads, a demotion

Report for the owner, written by the investigator's agent on branch `investigate-26062`, 2026-10-10. Read only: nothing in the app or the database was changed. The repair at the end is for the owner to read, not to run.

## The owner's words (2026-10-08, verbatim)

"we're missing the lot 26062. There was two loads for wet weights, a demotion was involved. There's a 062 in the unload queue that contains weight from two different lots, both declared 062."

The owner's picture: a wet weight entry on HBN `2bd1602a-9e9f-47a3-9c75-b1ba828c4fee`, Total wet weight 1,903,423 g, Dry space Hang in Place, Spear, Truck 2. Earlier canon holds 26062 as voided on the floor while live METRC carries an SPR of 737,135 g for it.

## Read this first

1. **26062 is not lost. It was deleted.** The HBN row `2bd1602a` was soft deleted by the owner's account on 2026-09-27 17:37:36Z with the reason "no weight recorded". Its two real wet loads were never deleted and still hold 2,649,664 g between them (746,241 g on truck 1 and 1,903,423 g on truck 2). The same act, 39 ms earlier, deleted 26066 (PMX), whose live load holds 1,921,292 g and is already unloaded (502,200 g dry). The rows the clean-up meant to remove were the two empty 0 g weighing loads (`0ac9c77d` on 26062, `ff0b0fdc` on 26066), and those were deleted a minute later. The batch deletes took the lots with them.
2. **The 1,903,423 g entry is one load, not two added together.** It is 307 totes weighed in one unbroken run on 2026-09-26 from 14:07:19Z to 15:07:08Z, started 3 minutes after truck 1's load (116 totes, 746,241 g, 13:28:34Z to 14:00:21Z) was finished. Every tote on both loads names 26062 as its HBN. The harvest workbook (26H Operations Dashboard, Harvest Details, row 79) carries 26062 at a wet spear weight of 2,649,664 g, which is exactly the two loads summed, and 370 plants.
3. **The unload queue row holds the whole of 26062's dry weight, both trucks, entered on truck 2's load.** The row is truck 2's load `e07c7d73`: one unload session, 177 packages, 436,527 g, all entered 2026-10-06 15:13Z to 19:19Z and finished 2026-10-08 21:03Z with "Queue an adjustment CSV". The investigator confirms (Answers, A2) that all of the lot's dry plants were dried, weighed and logged together, so these are the "weight from two different lots, both declared 062": truck 1's and truck 2's. Truck 1's load `701b9de1` was therefore never unloaded in the app and still reads `drying`, with an empty unload session. The workbook's 670,378 g is a different weighing (A3): the dry space crew's paper weight, taken before the stems came off. The app's 436,527 g is the reweigh after destemming. The 233,851 g between them is stems and handling loss, not missing flower. No other lot in the app is over the workbook by 233,851 g, which agrees.

There is no demotion on any 26062, 26065 or 26066 row in this snapshot (see Timeline). The snapshot was dumped 2026-10-08 22:45:38Z, so a demotion after that moment would not show here.

## Source and method

- Data: snapshot `20261008-184520_pre_r5` (dumped 2026-10-08T22:45:38Z), the newest of the 25 snapshots in the owner's zip of the repo. Read by scripts of the investigator's agent; no row was typed from a picture. Python and Node are not installed on the investigator's computer, so the scripts are PowerShell `ConvertFrom-Json` reads of the snapshot's JSON files.
- Schema: `app/migrations` 0001 to 0095. Columns that matter here beyond the brief's list: `wet_weights` (0006: the append-only tote ledger of each load; the load's `weight_grams` is the live total of its non-voided totes), `wet_weights.harvest_batch_id` (0075: a tote may name its own HBN), `harvest_plant_tags` (0012) and its `wet_weight_entry_id` (0076, the harvest file per load), `wet_weight_entries.harvest_file_seq`.
- Code read: `app/src/actions.ts`, the demote control at `control === "demote"`: it steps a record's `status` back one process and logs `reason = 'demoted'`; from drying back to weighing it also clears `finished_at` and the HBN's field close. It moves no tote and no package. The unload finish (`actions.ts` near the `queue_adjust` redirect) compares the lot's dry total with its METRC parent package and, on a difference, offers "Queue an adjustment CSV" or "Nothing, just finish".
- Second source: the owner's harvest workbook `26H.Operations Dashboard .xlsm`, sheet Harvest Details, read from a copy (columns Q Plants, U Wet Spear Weight, V Bucked Wet Weight, AB Dry Weight, AC Dry Down, E METRC Harvest Tag).
- Actors by person id only: `owner 7b59cf6b` is the owner id named in the brief; `lead 049e9cea` is the account that minted every HBN on 2026-09-26 and opened every load, read here as the day shift lead. Note that many totes and every dry weight package on these lots were entered under the owner's account, which suggests a station signed in as the owner; that is a question, not a finding.
- The investigator's repo is an unzipped copy of the owner's folder (GitHub access was not yet in place), branch `investigate-26062` made from `main` at `e98a138`. `canon/` was not touched.

## 1. Every row that says 062

### harvest_batches

Only one HBN ends in 062: `2bd1602a`. (Lots 26075 to 26079 carry strain code 062 in the middle of their HBN; they are a different strain and are not part of this.) Its two siblings in this story are shown with it: 26065, the other Pinyatti lot of the day, and 26066, deleted in the same act.

| id | hbn | farm | strain_id | market_strain | is_test | status | material_form | created_at | created_by | deleted_at | deleted_by |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 2bd1602a-9e9f-47a3-9c75-b1ba828c4fee | 26269-PNN-OD-091-0-NA-26062 | PNN | a4000001-0001-4000-8000-000000000015 | Pinyatti | 0 | open | bucked | 2026-09-26T13:03:25Z | lead 049e9cea | 2026-09-27T17:37:36Z | owner 7b59cf6b |
| 1081e964-d9be-4da7-99e4-c6524e04e50a | 26269-PNN-OD-091-0-04-26065 | PNN | a4000001-0001-4000-8000-000000000015 | Pinyatti | 0 | open | bucked | 2026-09-26T17:47:24Z | lead 049e9cea |  |  |
| fb49946f-e398-4fd7-a585-c5891e5652ad | 26269-PNN-OD-056-0-03-26066 | PNN | a018fdd8-9f91-4144-b4e3-e3a9190ffb46 | PMX | 0 | open | bucked | 2026-09-26T18:02:06Z | lead 049e9cea | 2026-09-27T17:37:36Z | owner 7b59cf6b |

### wet_weight_entries (the loads)

| id | on HBN | seq | truck | form | dry space | weight_grams | wet_spear | plant_count | dry_weight_grams | status | created_at | created_by | finished_at | updated_at | deleted_at |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 9397535d-ec43-44d2-9f48-1e4130e038c0 | 26065 | 1 |  | bucked | Silo 4 | 2,852,913 |  | 210 | 662,850 | unloaded | 2026-09-26T17:48:17Z | lead 049e9cea | 2026-09-26T20:36:55Z | 2026-10-06T12:00:00Z |  |
| 701b9de1-51cb-49f2-9916-4baadf086e86 | 26062 | 1 | 1 | spear | Hang in Place | 746,241 |  |  |  | drying | 2026-09-26T13:03:56Z | lead 049e9cea | 2026-09-26T14:03:19Z | 2026-09-26T14:03:19Z |  |
| e07c7d73-d7c1-4461-a62f-d5e99032070d | 26062 | 2 | 2 | spear | Hang in Place | 1,903,423 |  |  | 436,527 | unloaded | 2026-09-26T14:06:52Z | lead 049e9cea | 2026-09-26T16:30:41Z | 2026-10-08T21:03:08Z |  |
| 0ac9c77d-26fa-4be5-bb58-767234ab6779 | 26062 | 3 |  | bucked | Silo 4 | 0 |  |  |  | weighing | 2026-09-26T17:28:23Z | owner 7b59cf6b |  | 2026-09-27T17:38:48Z | 2026-09-27T17:38:48Z |
| 618b7738-4a49-4041-9972-c3c1cd48b337 | 26066 | 1 | 3 | bucked | Silo 3 | 1,921,292 |  |  | 502,200 | unloaded | 2026-09-26T18:22:46Z | lead 049e9cea | 2026-09-26T20:38:10Z | 2026-09-27T17:11:09Z |  |
| ff0b0fdc-077f-4e23-ac70-174348782bcb | 26066 | 2 | 4 | bucked | Silo 3 | 0 |  |  |  | weighing | 2026-09-27T01:45:07Z | owner 7b59cf6b |  | 2026-09-27T17:38:48Z | 2026-09-27T17:38:48Z |

### wet_weights (the totes on those loads)

Each load's live tote total equals its `weight_grams` exactly. Every tote names the same HBN as its load; none names another.

| wet load (entry) | tote HBN | live or voided | entered by | totes | grams | first tote | last tote | first tote id | last tote id |
|---|---|---|---|---|---|---|---|---|---|
| 0ac9c77d | 26062 | voided | owner 7b59cf6b | 69 | 493,630 | 2026-09-26T17:31:03Z | 2026-09-26T17:39:25Z | 29389a62-58b1-4c5e-9c10-94bbea6fea69 | fdef9e10-979a-41be-a1c7-fc6b5318148c |
| 618b7738 | 26066 | live | lead 049e9cea | 242 | 1,485,762 | 2026-09-26T18:26:06Z | 2026-09-26T20:31:59Z | b069e665-b5b0-4908-ad21-b4d0e20d1e49 | 53be8434-2d89-49a6-a664-89a52f3bad39 |
| 618b7738 | 26066 | live | owner 7b59cf6b | 73 | 435,530 | 2026-09-26T18:59:04Z | 2026-09-26T19:13:00Z | 8290d426-765d-41ad-b5bc-9cd265963e4f | 088dbfdd-9850-4c04-884b-f6450129bb83 |
| 701b9de1 | 26062 | live | owner 7b59cf6b | 116 | 746,241 | 2026-09-26T13:28:34Z | 2026-09-26T14:00:21Z | 8d737ec6-d3f3-47e1-82ec-05ef81dad279 | 0d884841-2343-4b9d-a3db-1a812d2b5595 |
| 9397535d | 26065 | live | lead 049e9cea | 223 | 2,097,632 | 2026-09-26T17:48:41Z | 2026-09-26T19:57:49Z | cfd68cf6-70af-4842-8ae5-31dc5f8a56ac | c9057c53-4455-4f19-84cf-00ca394813a8 |
| 9397535d | 26065 | live | owner 7b59cf6b | 96 | 755,281 | 2026-09-26T17:52:17Z | 2026-09-26T18:21:19Z | 061a99bf-d405-4046-92fe-735f3fcc981a | 403bf109-1e8a-4baf-b3ae-ab179a44de8f |
| e07c7d73 | 26062 | live | owner 7b59cf6b | 307 | 1,903,423 | 2026-09-26T14:07:19Z | 2026-09-26T15:07:08Z | 69b0fad0-4b8c-405a-a1d4-b4b85b2206ad | 7793d7f6-81de-4af8-bdb7-8e871f35bfb8 |

The third 26062 load `0ac9c77d` (seq 3, bucked, Silo 4) was opened under the owner's account at 17:28:23Z and took 69 totes, 493,630 g, from 17:31:03Z to 17:39:25Z. At 17:48:41Z, 24 seconds after the 26065 load was opened, the lead entered one tote of exactly 493,630 g on 26065:

| tote id | load | grams | created_at | created_by | harvest_batch_id | deleted_at |
|---|---|---|---|---|---|---|
| cfd68cf6-70af-4842-8ae5-31dc5f8a56ac | 9397535d | 493,630 | 2026-09-26T17:48:41Z | lead 049e9cea | 1081e964-d9be-4da7-99e4-c6524e04e50a |  |

From 17:51:22Z to 18:14:04Z the lead voided the 69 totes one by one, each with the reason "wrong batch". Those 69 are the only voided totes on these loads. Their ids:

69 totes, 493,630 g, voided 2026-09-26T17:51:22Z to 2026-09-26T18:14:04Z by lead 049e9cea.
Ids: 29389a62-58b1-4c5e-9c10-94bbea6fea69, 51aeed8b-61db-4548-84e3-f006ff4a6989, f19f69fd-3395-4f81-8610-e5fbc5214808, 2a35301c-b789-4116-81a7-dffba0a1334e, f3390b57-fb3e-4e22-9324-87a44e21e741, 31ab874c-16f2-47c3-a694-a09146568599, f97cd172-1897-46f3-a85e-cb68437fc4c6, 64c9260d-b0bf-47b4-a0e8-4bfbccd461f4, 9ff82dbd-ca92-493d-b640-e792f3b5fc10, 8ba8efbf-ac3b-4d1e-b656-80afc6148cd1, 7eb65c04-86d7-4c86-89fe-f010dab353fa, 954901b6-d57d-420d-9116-a3026b21df07, 59c9489a-1efc-4ade-9e8e-53604758f8b8, 6c75bd4b-9894-4122-8263-c1f31f254e59, d0662f3d-68dd-4449-8c42-c245c46e2c2d, f8b9fbe5-693f-4dc8-a028-e90bb4bcd980, dace59a3-4d77-4767-b87a-9bb387ea9b09, 437c1805-50e0-4a21-8271-6c007f0d28e7, 5a01af3a-4015-47a1-b590-c10cb4941a9a, b68ceef9-05c8-4b6f-9303-9e6880779198, a19f4d5c-4b10-426c-9a81-b2868bacddaa, b900f748-56ac-496c-8aaf-7031f9a704a7, 7948208a-781c-4273-ac03-7ca05923c8a1, 71d83120-4e0c-460c-a6b2-3f8ccc6fe8c7, 1d9795d0-da2f-4df8-bce6-007a0fdea23f, 0abf486e-8509-44f0-8d57-879df49cd5a2, 0525e999-86f4-4ac6-814b-5e95a9d7bdb6, fc3e9879-99d7-4a6e-87b2-a72ad42454f2, 684cd010-97bb-44c3-b78f-3f91d92125ed, efe574bd-a47e-4b4b-b1e0-4594135c6718, efc34ed1-b72a-412b-98aa-527647203152, 96686cc4-ebce-4804-8ffd-b6d13ffb5057, b34a50f8-be78-4f92-8058-cadde088f6d4, 3e8a1dac-72fc-4c8c-9d5a-7de29d127271, 96dc55bc-4801-4c1f-b6ee-4c1208ed7feb, c2f088e7-dc53-41d9-b387-03474c792af6, cbadf9e5-47f0-4c83-b193-af7df94cba9d, 1209e586-6321-4497-802d-f62b5f555a01, 9e3abde9-6e69-43c3-a5b2-29c8b2af1756, d2c66577-8cfd-4657-9207-7592cbe7f40b, 63087a49-a26c-4689-856b-c54678d8356c, 96efaf59-44e3-4baa-8290-5f8a3608c4c4, 8bf226a6-f0a8-48a8-abe3-74009fcfe89e, 38b3ddb1-3369-46bb-b781-0533fa6b2881, d3100637-d8c1-40de-89da-f2cc2fed9814, 2380ef35-b615-4616-bd75-cd07b74256a0, 81565e11-1d94-400e-a601-ff81ae4ca867, edd8a6a4-33dc-4058-a181-36ac4084e738, b6c9e46e-4bc5-4fe6-bf19-c75fd7d6512d, 1f097a46-5164-4709-ae82-166933c71ee5, 5a0264b7-31ef-421e-ad9f-36d492dea8ce, 30d8a8f3-eee7-4e9d-8ffd-60a6c6027fd9, 5687e176-9a27-4dde-b8d5-216c2d4fff71, 94a23c2b-eb8f-451d-82d9-c5b436c73e74, 09831348-ee17-4435-9c13-dbfa046208f7, 75807b45-714d-4a7a-8fde-6e343ad6a780, fccd5c80-0693-4875-905b-44eea7db3a4f, be5442ce-44bb-43ab-a6e5-6ca026cb7688, 82d4f5a2-8ad3-4efe-9dba-12742e576eab, b274c097-0ed3-4bbe-b1a0-16387d7d637a, 74d86898-5886-45c9-a3e8-7e2095b133c5, ced39924-bd9e-4021-82cb-7a21b3b11398, 7bdb5e24-85c9-43d8-9a6b-e1f52d0ed14f, 67c1073f-d749-4f0d-a1ad-1df26c94719a, 2e952858-7873-488c-95c1-dec15f628936, 9133064d-3834-426e-a109-b8c88afb82c2, 9db1d921-396b-4472-aac6-35baf645c6f4, b4a13da5-e3dd-4d1a-a43c-a3a84276c5fa, fdef9e10-979a-41be-a1c7-fc6b5318148c

### unload_sessions

| id | wet load | weigh_mode | bucked_on_site | truck | created_at | created_by | finished_at | effective_date | deleted_at | live packages | grams |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 2d82a7d5-7682-44d3-9469-2ea571546f73 | 618b7738 | bucked |  |  | 2026-09-26T22:31:21Z | lead 049e9cea | 2026-09-27T17:11:09Z | 2026-09-26 |  | 20 | 502,200 |
| 1a7da118-fb0e-4edd-a1cd-ee876f65a60a | 9397535d | bucked |  |  | 2026-09-27T13:45:23Z | lead 049e9cea | 2026-09-27T14:23:40Z | 2026-09-27 |  | 21 | 662,850 |
| 9fae7028-7205-4e96-bf06-1a0bd3309186 | e07c7d73 | spear | 1 |  | 2026-10-06T14:44:08Z | lead 049e9cea | 2026-10-08T21:03:08Z | 2026-10-06 |  | 177 | 436,527 |
| abf83fe5-1dc0-4765-a894-ae1be1d4cc1e | 701b9de1 |  |  |  | 2026-10-06T14:44:11Z | lead 049e9cea |  | 2026-10-06 |  | 0 |  |

### dry_weights on truck 2's load `e07c7d73` (the unload queue row)

All 177 live, none deleted, all in session `9fae7028`. One was corrected (`7f7941c8`, 3,540 to 2,883 g, reason "peso mal", 2026-10-06T15:40:11Z). Runs are separated by gaps of more than 5 minutes:

| run | packages | grams | first package | last package |
|---|---|---|---|---|
| 1 | 44 | 109,244 | 2026-10-06T15:13:36Z | 2026-10-06T15:39:16Z |
| 2 | 21 | 53,087 | 2026-10-06T15:49:01Z | 2026-10-06T15:58:37Z |
| 3 | 13 | 32,866 | 2026-10-06T16:34:06Z | 2026-10-06T16:44:02Z |
| 4 | 4 | 9,533 | 2026-10-06T16:49:16Z | 2026-10-06T16:50:54Z |
| 5 | 58 | 138,016 | 2026-10-06T18:26:42Z | 2026-10-06T18:43:52Z |
| 6 | 37 | 93,781 | 2026-10-06T19:13:23Z | 2026-10-06T19:19:40Z |

The other two lots' packages, for comparison (`9397535d` is 26065, `618b7738` is 26066):

| load | packages | live grams | first | last |
|---|---|---|---|---|
| 9397535d | 21 | 662,850 | 2026-09-27T13:54:50Z | 2026-09-27T14:23:30Z |
| 618b7738 | 20 | 502,200 | 2026-09-27T16:52:39Z | 2026-09-27T17:10:26Z |

The full list of the 177 packages is in the Appendix.

### harvest_plant_tags on 26062

| tags | created_at | created_by | deleted_at | deleted_by | wet_weight_entry_id |
|---|---|---|---|---|---|
| 82 | 2026-09-26T14:05:54.016Z | lead 049e9cea | 2026-09-26T18:28:39.797Z | lead 049e9cea | (none) |
| 288 | 2026-09-26T18:28:39.797Z | lead 049e9cea | | | (none) |

The two sets share no tag, and neither shares a tag with 26065's 210 (entered 20:40:53Z, on load `9397535d`). The 82 were entered 2 minutes after truck 1's load finished and before truck 2's opened; at 18:28:39Z a save replaced them with the 288. 82 + 288 = 370, the workbook's plant count. The app has no `plant_count` on either 26062 load.

## 2. The timeline

Every non-create `record_change_log` row on the batches, loads and sessions above, with the create rows that name each load's HBN and truck, in time order. The 69 tote voids (17:51:22Z to 18:14:04Z, "wrong batch") and the 218 package creates are summarised above rather than repeated.

| changed_at (UTC) | table | record_id | field | old | new | actor | reason |
|---|---|---|---|---|---|---|---|
| 2026-09-26T13:03:25.892Z | harvest_batches | 2bd1602a-9e9f-47a3-9c75-b1ba828c4fee | hbn |  | 26269-PNN-OD-091-0-NA-26062 | lead 049e9cea | create |
| 2026-09-26T13:03:56.295Z | wet_weight_entries | 701b9de1-51cb-49f2-9916-4baadf086e86 | harvest_batch_id |  | 2bd1602a-9e9f-47a3-9c75-b1ba828c4fee | lead 049e9cea | create |
| 2026-09-26T13:03:56.295Z | wet_weight_entries | 701b9de1-51cb-49f2-9916-4baadf086e86 | material_form |  | spear | lead 049e9cea | create |
| 2026-09-26T13:03:56.295Z | wet_weight_entries | 701b9de1-51cb-49f2-9916-4baadf086e86 | truck_number |  | 1 | lead 049e9cea | create |
| 2026-09-26T14:03:19.825Z | wet_weight_entries | 701b9de1-51cb-49f2-9916-4baadf086e86 | status | weighing | drying | lead 049e9cea | finish lot |
| 2026-09-26T14:06:52.707Z | wet_weight_entries | e07c7d73-d7c1-4461-a62f-d5e99032070d | harvest_batch_id |  | 2bd1602a-9e9f-47a3-9c75-b1ba828c4fee | lead 049e9cea | create |
| 2026-09-26T14:06:52.707Z | wet_weight_entries | e07c7d73-d7c1-4461-a62f-d5e99032070d | material_form |  | spear | lead 049e9cea | create |
| 2026-09-26T14:06:52.707Z | wet_weight_entries | e07c7d73-d7c1-4461-a62f-d5e99032070d | truck_number |  | 2 | lead 049e9cea | create |
| 2026-09-26T16:30:41.349Z | wet_weight_entries | e07c7d73-d7c1-4461-a62f-d5e99032070d | status | weighing | drying | lead 049e9cea | finish lot |
| 2026-09-26T17:28:23.919Z | wet_weight_entries | 0ac9c77d-26fa-4be5-bb58-767234ab6779 | harvest_batch_id |  | 2bd1602a-9e9f-47a3-9c75-b1ba828c4fee | owner 7b59cf6b | create |
| 2026-09-26T17:28:23.919Z | wet_weight_entries | 0ac9c77d-26fa-4be5-bb58-767234ab6779 | material_form |  | bucked | owner 7b59cf6b | create |
| 2026-09-26T17:47:24.407Z | harvest_batches | 1081e964-d9be-4da7-99e4-c6524e04e50a | hbn |  | 26269-PNN-OD-091-0-04-26065 | lead 049e9cea | create |
| 2026-09-26T17:48:17.677Z | wet_weight_entries | 9397535d-ec43-44d2-9f48-1e4130e038c0 | harvest_batch_id |  | 1081e964-d9be-4da7-99e4-c6524e04e50a | lead 049e9cea | create |
| 2026-09-26T17:48:17.677Z | wet_weight_entries | 9397535d-ec43-44d2-9f48-1e4130e038c0 | material_form |  | bucked | lead 049e9cea | create |
| 2026-09-26T18:02:06.846Z | harvest_batches | fb49946f-e398-4fd7-a585-c5891e5652ad | hbn |  | 26269-PNN-OD-056-0-03-26066 | lead 049e9cea | create |
| 2026-09-26T18:22:46.145Z | wet_weight_entries | 618b7738-4a49-4041-9972-c3c1cd48b337 | harvest_batch_id |  | fb49946f-e398-4fd7-a585-c5891e5652ad | lead 049e9cea | create |
| 2026-09-26T18:22:46.145Z | wet_weight_entries | 618b7738-4a49-4041-9972-c3c1cd48b337 | material_form |  | bucked | lead 049e9cea | create |
| 2026-09-26T18:22:46.145Z | wet_weight_entries | 618b7738-4a49-4041-9972-c3c1cd48b337 | truck_number |  | 3 | lead 049e9cea | create |
| 2026-09-26T20:36:55.093Z | wet_weight_entries | 9397535d-ec43-44d2-9f48-1e4130e038c0 | status | weighing | drying | lead 049e9cea | finish lot |
| 2026-09-26T20:38:10.872Z | wet_weight_entries | 618b7738-4a49-4041-9972-c3c1cd48b337 | status | weighing | drying | lead 049e9cea | finish lot |
| 2026-09-26T22:31:21.220Z | unload_sessions | 2d82a7d5-7682-44d3-9469-2ea571546f73 | wet_weight_entry_id |  | 618b7738-4a49-4041-9972-c3c1cd48b337 | lead 049e9cea | create |
| 2026-09-27T01:45:07.630Z | wet_weight_entries | ff0b0fdc-077f-4e23-ac70-174348782bcb | harvest_batch_id |  | fb49946f-e398-4fd7-a585-c5891e5652ad | owner 7b59cf6b | create |
| 2026-09-27T01:45:07.630Z | wet_weight_entries | ff0b0fdc-077f-4e23-ac70-174348782bcb | material_form |  | bucked | owner 7b59cf6b | create |
| 2026-09-27T01:45:07.630Z | wet_weight_entries | ff0b0fdc-077f-4e23-ac70-174348782bcb | truck_number |  | 4 | owner 7b59cf6b | create |
| 2026-09-27T13:45:23.126Z | unload_sessions | 1a7da118-fb0e-4edd-a1cd-ee876f65a60a | wet_weight_entry_id |  | 9397535d-ec43-44d2-9f48-1e4130e038c0 | lead 049e9cea | create |
| 2026-09-27T14:23:40.092Z | unload_sessions | 1a7da118-fb0e-4edd-a1cd-ee876f65a60a | reconcile_choice |  | nothing | lead 049e9cea | finish unload |
| 2026-09-27T14:23:40.092Z | wet_weight_entries | 9397535d-ec43-44d2-9f48-1e4130e038c0 | status | drying | unloaded | lead 049e9cea | finish unload |
| 2026-09-27T17:11:09.270Z | unload_sessions | 2d82a7d5-7682-44d3-9469-2ea571546f73 | reconcile_choice |  | nothing | lead 049e9cea | finish unload |
| 2026-09-27T17:11:09.270Z | wet_weight_entries | 618b7738-4a49-4041-9972-c3c1cd48b337 | status | drying | unloaded | lead 049e9cea | finish unload |
| 2026-09-27T17:37:36.451Z | harvest_batches | fb49946f-e398-4fd7-a585-c5891e5652ad | deleted_at |  | 2026-09-27T17:37:36.451Z | owner 7b59cf6b | no weight recorded |
| 2026-09-27T17:37:36.490Z | harvest_batches | 2bd1602a-9e9f-47a3-9c75-b1ba828c4fee | deleted_at |  | 2026-09-27T17:37:36.490Z | owner 7b59cf6b | no weight recorded |
| 2026-09-27T17:38:48.752Z | wet_weight_entries | ff0b0fdc-077f-4e23-ac70-174348782bcb | deleted_at |  | 2026-09-27T17:38:48.752Z | owner 7b59cf6b | no weight recorded |
| 2026-09-27T17:38:48.820Z | wet_weight_entries | 0ac9c77d-26fa-4be5-bb58-767234ab6779 | deleted_at |  | 2026-09-27T17:38:48.820Z | owner 7b59cf6b | no weight recorded |
| 2026-10-02T17:00:00.000Z | wet_weight_entries | 618b7738-4a49-4041-9972-c3c1cd48b337 | finished_at | 2026-09-27T17:11:09.270Z | 2026-09-26T20:38:10.872Z | owner 7b59cf6b | repair 2026-10-02 (canon 0.30.346): the finish stamp is the first move off weighing, not the newest status move (0087's backfill) |
| 2026-10-02T17:00:00.000Z | wet_weight_entries | 9397535d-ec43-44d2-9f48-1e4130e038c0 | finished_at | 2026-09-27T14:23:40.092Z | 2026-09-26T20:36:55.093Z | owner 7b59cf6b | repair 2026-10-02 (canon 0.30.346): the finish stamp is the first move off weighing, not the newest status move (0087's backfill) |
| 2026-10-06T12:00:00.000Z | wet_weight_entries | 9397535d-ec43-44d2-9f48-1e4130e038c0 | plant_count |  | 210 | owner 7b59cf6b | repair 2026-10-06 (canon 0.30.412), plant counts from the harvest workbook (26H Operations Dashboard, Harvest Details, Plants), where the app had none |
| 2026-10-06T14:44:08.205Z | unload_sessions | 9fae7028-7205-4e96-bf06-1a0bd3309186 | wet_weight_entry_id |  | e07c7d73-d7c1-4461-a62f-d5e99032070d | lead 049e9cea | create |
| 2026-10-06T14:44:11.847Z | unload_sessions | abf83fe5-1dc0-4765-a894-ae1be1d4cc1e | wet_weight_entry_id |  | 701b9de1-51cb-49f2-9916-4baadf086e86 | lead 049e9cea | create |
| 2026-10-06T15:40:11.310Z | dry_weights | 7f7941c8-f637-4315-9dda-1c1ec8d58c2e | weight_grams | 3540 | 2883 | owner 7b59cf6b | peso mal |
| 2026-10-08T21:03:08.400Z | unload_sessions | 9fae7028-7205-4e96-bf06-1a0bd3309186 | reconcile_choice |  | queue_adjust | lead 049e9cea | finish unload |
| 2026-10-08T21:03:08.400Z | wet_weight_entries | e07c7d73-d7c1-4461-a62f-d5e99032070d | status | drying | unloaded | lead 049e9cea | finish unload |

**The demotion.** No `reason = 'demoted'` row exists on any of these records. Across the whole log there are 14 demotion rows on wet loads; the nearest in time is load `a173bafd` on 26056 (PNS), unloaded to drying at 2026-09-26T15:22:42Z, which is another lot. So in this snapshot nothing about 26062 was demoted. If the owner saw a demotion, it was either after 2026-10-08 22:45:38Z, or it was another act (the 18:28:39Z plant tag replace, or the 2026-09-27 batch delete, are the two that undid something on 26062).

## 3. The two loads

| | truck 1 | truck 2 |
|---|---|---|
| load | `701b9de1` (seq 1) | `e07c7d73` (seq 2) |
| HBN it sits on now | `2bd1602a` (26062, deleted) | `2bd1602a` (26062, deleted) |
| totes | 116 | 307 |
| wet | 746,241 g | 1,903,423 g |
| weighed | 2026-09-26 13:28:34Z to 14:00:21Z | 2026-09-26 14:07:19Z to 15:07:08Z |
| dry space | Hang in Place | Hang in Place |
| status | drying | unloaded |
| dry in app | none | 436,527 g (177 packages) |

The 1,903,423 g entry is one load: one tote stream, opened after truck 1 was finished, and its total is the sum of its own 307 totes. No log row or second entry shows an earlier pair of weights adding to it. The two loads together, 2,649,664 g, are what the workbook carries.

The third 062 load (493,630 g on Silo 4) was 26065's weight declared 062 by mistake; it is already carried on 26065 and voided on 26062. 26065 reads 2,852,913 g wet, 210 plants, 662,850 g dry in the app, the workbook and METRC alike. It needs nothing.

## 4. The unload queue row

The 062 in the unload queue is truck 2's load `e07c7d73`. Its 177 packages (436,527 g) all hang off session `9fae7028`, entered under the owner's account on 2026-10-06 in six runs between 15:13Z and 19:19Z. The packages carry no HBN or truck of their own (`dry_weights` has only the load and the session), so **no stamp or log row ties any of them to truck 1 or to another lot**. Sessions for all four Hang in Place loads of 2026-09-26 were opened together at 14:44Z (26062 truck 2, 26062 truck 1, 26063, 26061); 26061's packages start at 20:23Z and 26063's on 2026-10-07, so the 062 package times do not overlap another lot's.

What the numbers allow, and only that:

- If the 177 packages are truck 2 alone, its dry down is 22.9 g of each 100 g wet, and truck 1 (746,241 g) has not been unloaded in the app. The workbook's 670,378 g would then put truck 1 at 233,851 g dry.
- If the 177 packages are both trucks (the owner's "weight from two different lots, both declared 062"), 26062's whole dry is 436,527 g against 2,649,664 g wet, and the workbook's 670,378 g is wrong by 233,851 g.
- Runs 5 and 6 (95 packages, 231,797 g, 18:26Z to 19:19Z) come within 2,054 g of 233,851 g. That is a coincidence of sums, not evidence; it is the first thing to put to the person who unloaded.

**Settled by the investigator (A2, A3):** the second reading is the true one. All 177 packages are both trucks, weighed together after destemming. 26062's dry is 436,527 g on 2,649,664 g wet (16.5 g of each 100 g). The workbook's 670,378 g is the dry space crew's paper weight with stems. Runs 5 and 6 are not a separate hang; the near match with 233,851 g is the coincidence it looked like.

Dry down for comparison, from the app: other spear lots run from 13.2 to 24.6 of each 100 g wet (26061 13.2, 26087 16.9, 26086 18.1, 26028 18.5, 26027 22.9, 26063 22.6, 26017 24.6); 26065 (bucked, same strain, same day) is 23.2. Both readings of 26062 sit inside that range, so the ratio cannot decide it.

Also seen and outside this question: the other two Hang in Place lots of the day disagree with the workbook by nearly equal and opposite amounts. 26061 is 151,476 g under the workbook (450,488 against 601,964) and 26063 is 152,370 g over (339,650 against 187,280). That looks like about 152 kg of packages entered on the wrong one of those two lots, and it is worth its own look.

## 5. METRC

`metrc_uploads` holds no row for 26062 or 26065. `metrc_packages` (the mirror) holds for 26062:

| tag | item | quantity | packaged | source package | location | changed_at |
|---|---|---|---|---|---|---|
| 1A40503000311FB000058021 | SPR - Pinyatti - PNN - O | 620,295 g | 2026-10-03 | 1A405030004F652000001839 | Cold Storage A | 2026-10-08T10:07:04Z |
| 1A40503000311FB000058023 | BIO - Biomass - PNN | 20,500 g | 2026-10-07 | 1A40503000311FB000058021 | Barn | 2026-10-08T00:09:24Z |
| 1A40503000311FB000058024 | BIO - Biomass - PNN | 47,630 g | 2026-10-07 | 1A40503000311FB000058021 | Barn | 2026-10-08T00:09:24Z |
| 1A40503000311FB000058025 | BIO - Biomass - PNN | 48,710 g | 2026-10-07 | 1A40503000311FB000058021 | Barn | 2026-10-08T00:09:24Z |

The three BIO packages total 116,840 g, and 620,295 + 116,840 = 737,135 g: the SPR the earlier canon saw, before the biomass was split from it on 2026-10-07. The SPR's tag is the one the workbook carries as 26062's METRC harvest tag. So METRC has 26062 as one harvest of 737,135 g, which matches neither the app's 436,527 g (destemmed, A3) nor the workbook's 670,378 g (paper, with stems, A3). The SPR was packaged on 2026-10-03, three days before the app's unload, so it was not made from the app's packages.

For 26065: `1A40503000311FB000056842`, WIP - Pinyatti - PNN - O, 662,850 g, source harvest 26065, which matches the app and the workbook. The two package tags ending 026062 and 026065 in the mirror are 2025 vape carts whose tag numbers happen to end that way; they are not these lots.

No METRC row names a second HBN for any 26062 weight, so there is no sibling lot the second load truly belongs to: both loads are 26062.

## 6. The reconstruction

What the floor should hold:

- **26062** (`2bd1602a`, PNN, Pinyatti): one batch, live, not deleted. Two loads: truck 1 `701b9de1`, 746,241 g wet, 82 plants; truck 2 `e07c7d73`, 1,903,423 g wet, 288 plants (A1). Both spear, both Hang in Place. Wet 2,649,664 g, plants 370. Dry 436,527 g, destemmed, both trucks together, all on truck 2's unload (session `9fae7028`, 177 packages). Truck 1's load has no dry of its own and should leave the drying queue as unloaded with no packages, its empty session `abf83fe5` closed (Part E). The dry space crew's paper weight with stems was 670,378 g (the workbook). METRC carries 737,135 g in all: 620,295 g SPR plus 116,840 g biomass.
- **26065** (`1081e964`): as it is. Its third-load weight (493,630 g) is already on it.
- **26066** (`fb49946f`): the same wrong delete as 26062. Its live load (1,921,292 g wet, 502,200 g dry, the workbook's figures too) sits on a deleted HBN.

## The questions and their answers (the investigator, 2026-10-10)

- **Q1:** were the 82 plant tags (14:05:54Z) truck 1's plants and the 288 (18:28:39Z) truck 2's? **A1:** "82 plants on truck one and 288 on truck 2. one batch". Parts B and C below follow from it.
- **Q2:** did the 177 packages come off truck 2's hang only, or both trucks'? **A2:** "all dry plants from this lot were dried together, weighed together, and entered into the same log." So the 436,527 g is the whole lot, and truck 1's load needs closing with no dry of its own (Part E).
- **Q3:** where does the workbook's 670,378 g come from? **A3:** "the crew working in the dry space did not have access to enter into the system, the weights were written manually on paper, the weight recorded into the system was after the product came back and the stems were removed and all was reweighed." So the 670,378 g is the paper weight with stems and the 436,527 g the destemmed reweigh. No dry weight is missing.
- **Q4:** were stations signed in under the owner's account on 2026-09-26 and 2026-10-06? **A4:** yes. The log cannot say which person entered those totes and packages; it only says which station account did.
- **Q5 (a note, not a question):** when the lead finished the unload on 2026-10-08 21:03Z, the app found that the lot's dry total (436,527 g) differs from its METRC package and, at the lead's choice, queued an adjustment file at the export home (Admin, Uploads) to make METRC match the app. The SPR now holds 620,295 g, so the file would take it down by 183,768 g to 436,527 g. With A2 and A3, 436,527 g is the right destemmed figure, so the data no longer argues against the file. Whether stem loss goes to METRC as an adjustment or as waste is the owner's compliance call.

Still open, for the owner: the demotion in the owner's words. None is logged on 26062, 26065 or 26066 up to 2026-10-08 22:45:38Z. If it happened later, a fresh snapshot will show it; if the word meant the 2026-09-27 delete or the 18:28:39Z tag replace, nothing more is needed.

## PROPOSED REPAIR (for the owner to read, NOT to run)

Every UPDATE carries its precondition in its WHERE; every log INSERT comes first, carries a fixed id, and guards on the same precondition, so a second run changes nothing. Part A stands on the data alone. Parts B and C stand on A1. Part E stands on A2. Part D is the same error on 26066, for the owner's word. No dry weight is moved or added: per A2 and A3, the 436,527 g on truck 2's load is the whole lot. All rows log under the owner id with a reason naming this report.

### Part A: bring 26062 back

```sql
-- A1. Log the undelete of HBN 26062, only while it still stands deleted by the 2026-09-27 act.
INSERT INTO record_change_log (id, record_table, record_id, field, old_value, new_value, actor_person_id, reason, changed_at)
SELECT 'a2606200-1010-4a00-8000-000000000001', 'harvest_batches', '2bd1602a-9e9f-47a3-9c75-b1ba828c4fee', 'deleted_at', '2026-09-27T17:37:36.490Z', NULL, '7b59cf6b-04b6-4742-bb1b-78a28b593fe8', 'repair (SESSION_REPORTS/2026-10-08_lot_26062_investigation.md): 26062 was deleted with no weight recorded while its two loads hold 2,649,664 g; undeleted', '2026-10-10T12:00:00.000Z'
WHERE EXISTS (SELECT 1 FROM harvest_batches WHERE id = '2bd1602a-9e9f-47a3-9c75-b1ba828c4fee' AND deleted_at = '2026-09-27T17:37:36.490Z')
  AND NOT EXISTS (SELECT 1 FROM record_change_log WHERE id = 'a2606200-1010-4a00-8000-000000000001');
-- A2. Undelete it.
UPDATE harvest_batches
SET deleted_at = NULL, deleted_by = NULL, updated_at = '2026-10-10T12:00:00.000Z', updated_by = '7b59cf6b-04b6-4742-bb1b-78a28b593fe8'
WHERE id = '2bd1602a-9e9f-47a3-9c75-b1ba828c4fee' AND deleted_at = '2026-09-27T17:37:36.490Z';
```

### Part B (on A1): put back the 82 plant tags and give each set its load

The investigator confirms (A1) the 82 were truck 1's plants and the 288 truck 2's.

```sql
-- B1. Log the 82 tags restored, while all 82 still stand deleted by the 18:28:39Z replace and none of their tags stands live elsewhere.
INSERT INTO record_change_log (id, record_table, record_id, field, old_value, new_value, actor_person_id, reason, changed_at)
SELECT 'a2606200-1010-4a00-8000-000000000002', 'harvest_plant_tags', '2bd1602a-9e9f-47a3-9c75-b1ba828c4fee', 'deleted_at', '2026-09-26T18:28:39.797Z', CAST(c.n AS TEXT) || ' tags restored to load 701b9de1', '7b59cf6b-04b6-4742-bb1b-78a28b593fe8', 'repair (SESSION_REPORTS/2026-10-08_lot_26062_investigation.md): truck 1 plant tags replaced by truck 2 tags at 18:28:39Z; restored on the weigher word', '2026-10-10T12:00:00.000Z'
FROM (SELECT COUNT(*) AS n FROM harvest_plant_tags t
      WHERE t.harvest_batch_id = '2bd1602a-9e9f-47a3-9c75-b1ba828c4fee' AND t.created_at = '2026-09-26T14:05:54.016Z' AND t.deleted_at = '2026-09-26T18:28:39.797Z'
        AND NOT EXISTS (SELECT 1 FROM harvest_plant_tags k WHERE k.tag = t.tag AND k.deleted_at IS NULL)) c
WHERE c.n = 82 AND NOT EXISTS (SELECT 1 FROM record_change_log WHERE id = 'a2606200-1010-4a00-8000-000000000002');
-- B2. Restore them onto truck 1's load.
UPDATE harvest_plant_tags
SET deleted_at = NULL, deleted_by = NULL, wet_weight_entry_id = '701b9de1-51cb-49f2-9916-4baadf086e86', updated_at = '2026-10-10T12:00:00.000Z', updated_by = '7b59cf6b-04b6-4742-bb1b-78a28b593fe8'
WHERE harvest_batch_id = '2bd1602a-9e9f-47a3-9c75-b1ba828c4fee' AND created_at = '2026-09-26T14:05:54.016Z' AND deleted_at = '2026-09-26T18:28:39.797Z'
  AND NOT EXISTS (SELECT 1 FROM harvest_plant_tags k WHERE k.tag = harvest_plant_tags.tag AND k.deleted_at IS NULL);
-- B3. Log the 288 live tags given truck 2's load, while they still have none.
INSERT INTO record_change_log (id, record_table, record_id, field, old_value, new_value, actor_person_id, reason, changed_at)
SELECT 'a2606200-1010-4a00-8000-000000000003', 'harvest_plant_tags', '2bd1602a-9e9f-47a3-9c75-b1ba828c4fee', 'wet_weight_entry_id', NULL, CAST(c.n AS TEXT) || ' tags to load e07c7d73', '7b59cf6b-04b6-4742-bb1b-78a28b593fe8', 'repair (SESSION_REPORTS/2026-10-08_lot_26062_investigation.md): truck 2 plant tags given their load on the weigher word', '2026-10-10T12:00:00.000Z'
FROM (SELECT COUNT(*) AS n FROM harvest_plant_tags WHERE harvest_batch_id = '2bd1602a-9e9f-47a3-9c75-b1ba828c4fee' AND created_at = '2026-09-26T18:28:39.797Z' AND deleted_at IS NULL AND wet_weight_entry_id IS NULL) c
WHERE c.n = 288 AND NOT EXISTS (SELECT 1 FROM record_change_log WHERE id = 'a2606200-1010-4a00-8000-000000000003');
-- B4. Give them the load.
UPDATE harvest_plant_tags
SET wet_weight_entry_id = 'e07c7d73-d7c1-4461-a62f-d5e99032070d', updated_at = '2026-10-10T12:00:00.000Z', updated_by = '7b59cf6b-04b6-4742-bb1b-78a28b593fe8'
WHERE harvest_batch_id = '2bd1602a-9e9f-47a3-9c75-b1ba828c4fee' AND created_at = '2026-09-26T18:28:39.797Z' AND deleted_at IS NULL AND wet_weight_entry_id IS NULL;
```

### Part C (on A1): plant counts on the two loads

```sql
-- C1. Log truck 1's plant count, while it has none.
INSERT INTO record_change_log (id, record_table, record_id, field, old_value, new_value, actor_person_id, reason, changed_at)
SELECT 'a2606200-1010-4a00-8000-000000000004', 'wet_weight_entries', '701b9de1-51cb-49f2-9916-4baadf086e86', 'plant_count', NULL, '82', '7b59cf6b-04b6-4742-bb1b-78a28b593fe8', 'repair (SESSION_REPORTS/2026-10-08_lot_26062_investigation.md): truck 1 plants, 82 of the workbook 370', '2026-10-10T12:00:00.000Z'
WHERE EXISTS (SELECT 1 FROM wet_weight_entries WHERE id = '701b9de1-51cb-49f2-9916-4baadf086e86' AND deleted_at IS NULL AND plant_count IS NULL)
  AND NOT EXISTS (SELECT 1 FROM record_change_log WHERE id = 'a2606200-1010-4a00-8000-000000000004');
-- C2.
UPDATE wet_weight_entries
SET plant_count = 82, updated_at = '2026-10-10T12:00:00.000Z', updated_by = '7b59cf6b-04b6-4742-bb1b-78a28b593fe8'
WHERE id = '701b9de1-51cb-49f2-9916-4baadf086e86' AND deleted_at IS NULL AND plant_count IS NULL;
-- C3. Log truck 2's plant count, while it has none.
INSERT INTO record_change_log (id, record_table, record_id, field, old_value, new_value, actor_person_id, reason, changed_at)
SELECT 'a2606200-1010-4a00-8000-000000000005', 'wet_weight_entries', 'e07c7d73-d7c1-4461-a62f-d5e99032070d', 'plant_count', NULL, '288', '7b59cf6b-04b6-4742-bb1b-78a28b593fe8', 'repair (SESSION_REPORTS/2026-10-08_lot_26062_investigation.md): truck 2 plants, 288 of the workbook 370', '2026-10-10T12:00:00.000Z'
WHERE EXISTS (SELECT 1 FROM wet_weight_entries WHERE id = 'e07c7d73-d7c1-4461-a62f-d5e99032070d' AND deleted_at IS NULL AND plant_count IS NULL)
  AND NOT EXISTS (SELECT 1 FROM record_change_log WHERE id = 'a2606200-1010-4a00-8000-000000000005');
-- C4.
UPDATE wet_weight_entries
SET plant_count = 288, updated_at = '2026-10-10T12:00:00.000Z', updated_by = '7b59cf6b-04b6-4742-bb1b-78a28b593fe8'
WHERE id = 'e07c7d73-d7c1-4461-a62f-d5e99032070d' AND deleted_at IS NULL AND plant_count IS NULL;
```

### Part D (the owner's word): bring 26066 back

```sql
-- D1. Log the undelete of HBN 26066, only while it still stands deleted by the same 2026-09-27 act.
INSERT INTO record_change_log (id, record_table, record_id, field, old_value, new_value, actor_person_id, reason, changed_at)
SELECT 'a2606200-1010-4a00-8000-000000000006', 'harvest_batches', 'fb49946f-e398-4fd7-a585-c5891e5652ad', 'deleted_at', '2026-09-27T17:37:36.451Z', NULL, '7b59cf6b-04b6-4742-bb1b-78a28b593fe8', 'repair (SESSION_REPORTS/2026-10-08_lot_26062_investigation.md): 26066 was deleted with no weight recorded while its load holds 1,921,292 g wet and 502,200 g dry; undeleted', '2026-10-10T12:00:00.000Z'
WHERE EXISTS (SELECT 1 FROM harvest_batches WHERE id = 'fb49946f-e398-4fd7-a585-c5891e5652ad' AND deleted_at = '2026-09-27T17:37:36.451Z')
  AND NOT EXISTS (SELECT 1 FROM record_change_log WHERE id = 'a2606200-1010-4a00-8000-000000000006');
-- D2.
UPDATE harvest_batches
SET deleted_at = NULL, deleted_by = NULL, updated_at = '2026-10-10T12:00:00.000Z', updated_by = '7b59cf6b-04b6-4742-bb1b-78a28b593fe8'
WHERE id = 'fb49946f-e398-4fd7-a585-c5891e5652ad' AND deleted_at = '2026-09-27T17:37:36.451Z';
```

### Part E (on A2): close truck 1's load, its dry is inside truck 2's

Truck 1's load leaves the drying queue as unloaded with no packages and no dry total of its own; its empty unload session is closed. Both steps hold only while that session still has no live package.

```sql
-- E1. Log truck 1's load to unloaded, while it is still drying and its session has no live package.
INSERT INTO record_change_log (id, record_table, record_id, field, old_value, new_value, actor_person_id, reason, changed_at)
SELECT 'a2606200-1010-4a00-8000-000000000007', 'wet_weight_entries', '701b9de1-51cb-49f2-9916-4baadf086e86', 'status', 'drying', 'unloaded', '7b59cf6b-04b6-4742-bb1b-78a28b593fe8', 'repair (SESSION_REPORTS/2026-10-08_lot_26062_investigation.md): truck 1 dried, weighed and logged together with truck 2; its dry is in the 436,527 g on load e07c7d73', '2026-10-10T12:00:00.000Z'
WHERE EXISTS (SELECT 1 FROM wet_weight_entries WHERE id = '701b9de1-51cb-49f2-9916-4baadf086e86' AND deleted_at IS NULL AND status = 'drying')
  AND NOT EXISTS (SELECT 1 FROM dry_weights WHERE wet_weight_entry_id = '701b9de1-51cb-49f2-9916-4baadf086e86' AND deleted_at IS NULL)
  AND NOT EXISTS (SELECT 1 FROM record_change_log WHERE id = 'a2606200-1010-4a00-8000-000000000007');
-- E2.
UPDATE wet_weight_entries
SET status = 'unloaded', updated_at = '2026-10-10T12:00:00.000Z', updated_by = '7b59cf6b-04b6-4742-bb1b-78a28b593fe8'
WHERE id = '701b9de1-51cb-49f2-9916-4baadf086e86' AND deleted_at IS NULL AND status = 'drying'
  AND NOT EXISTS (SELECT 1 FROM dry_weights WHERE wet_weight_entry_id = '701b9de1-51cb-49f2-9916-4baadf086e86' AND deleted_at IS NULL);
-- E3. Log the empty session closed, while it is open, unfinished and empty.
INSERT INTO record_change_log (id, record_table, record_id, field, old_value, new_value, actor_person_id, reason, changed_at)
SELECT 'a2606200-1010-4a00-8000-000000000008', 'unload_sessions', 'abf83fe5-1dc0-4765-a894-ae1be1d4cc1e', 'deleted_at', NULL, '2026-10-10T12:00:00.000Z', '7b59cf6b-04b6-4742-bb1b-78a28b593fe8', 'repair (SESSION_REPORTS/2026-10-08_lot_26062_investigation.md): empty unload session of truck 1; the lot was unloaded in session 9fae7028', '2026-10-10T12:00:00.000Z'
WHERE EXISTS (SELECT 1 FROM unload_sessions WHERE id = 'abf83fe5-1dc0-4765-a894-ae1be1d4cc1e' AND deleted_at IS NULL AND finished_at IS NULL)
  AND NOT EXISTS (SELECT 1 FROM dry_weights WHERE session_id = 'abf83fe5-1dc0-4765-a894-ae1be1d4cc1e' AND deleted_at IS NULL)
  AND NOT EXISTS (SELECT 1 FROM record_change_log WHERE id = 'a2606200-1010-4a00-8000-000000000008');
-- E4.
UPDATE unload_sessions
SET deleted_at = '2026-10-10T12:00:00.000Z', deleted_by = '7b59cf6b-04b6-4742-bb1b-78a28b593fe8', updated_at = '2026-10-10T12:00:00.000Z', updated_by = '7b59cf6b-04b6-4742-bb1b-78a28b593fe8'
WHERE id = 'abf83fe5-1dc0-4765-a894-ae1be1d4cc1e' AND deleted_at IS NULL AND finished_at IS NULL
  AND NOT EXISTS (SELECT 1 FROM dry_weights WHERE session_id = 'abf83fe5-1dc0-4765-a894-ae1be1d4cc1e' AND deleted_at IS NULL);
```

Not in this repair: the 26061 and 26063 package swap (section 4), which needs its own look.

The SQL was checked by hand and by character audit only: SQLite is not installed on the investigator computer, so it was not rehearsed on a snapshot. Rehearse it twice on a fresh snapshot before any run.

Before any of it: take a fresh snapshot, and check that nothing on these rows changed after 2026-10-08 22:45:38Z (the preconditions will make a changed row a no-op, which is the point, but the owner should know which ones did nothing).

## Appendix: the 177 packages on load `e07c7d73`

| # | id | weight_grams | created_at | created_by | updated_at | deleted_at | run |
|---|---|---|---|---|---|---|---|
| 1 | f0f95c84-c780-4caa-bf82-d3d60afe0fd6 | 2,248 | 2026-10-06T15:13:36Z | owner 7b59cf6b | 2026-10-06T15:13:36Z |  | 1 |
| 2 | edea7fc9-5033-45d1-ad9c-3f445d9f6ad2 | 2,371 | 2026-10-06T15:15:20Z | owner 7b59cf6b | 2026-10-06T15:15:20Z |  | 1 |
| 3 | 38a9b134-e849-4dd6-bb2e-f360cbfc915b | 2,652 | 2026-10-06T15:16:01Z | owner 7b59cf6b | 2026-10-06T15:16:01Z |  | 1 |
| 4 | 5b91fd3b-e562-4fd3-90fe-c1b97aea50e0 | 2,842 | 2026-10-06T15:16:28Z | owner 7b59cf6b | 2026-10-06T15:16:28Z |  | 1 |
| 5 | 1f4fb575-6686-42f5-893c-5ecda4a9e95f | 2,131 | 2026-10-06T15:16:47Z | owner 7b59cf6b | 2026-10-06T15:16:47Z |  | 1 |
| 6 | e48b851e-6c06-4c30-9e70-d40ddae2e493 | 2,115 | 2026-10-06T15:17:22Z | owner 7b59cf6b | 2026-10-06T15:17:22Z |  | 1 |
| 7 | 5adf0006-c2a7-43cd-aa71-3d2f13fb1f03 | 2,448 | 2026-10-06T15:17:51Z | owner 7b59cf6b | 2026-10-06T15:17:51Z |  | 1 |
| 8 | 656c29bd-7c99-4ba1-a312-359ac1045656 | 2,468 | 2026-10-06T15:18:32Z | owner 7b59cf6b | 2026-10-06T15:18:32Z |  | 1 |
| 9 | a4c38a49-9fa9-4b1a-bedd-d368a8e2c9ca | 2,540 | 2026-10-06T15:18:54Z | owner 7b59cf6b | 2026-10-06T15:18:54Z |  | 1 |
| 10 | fd670253-3505-4527-968a-bd93c9663b1b | 2,304 | 2026-10-06T15:20:29Z | owner 7b59cf6b | 2026-10-06T15:20:29Z |  | 1 |
| 11 | a1a61885-ad07-471c-aadc-4d55b2783cf4 | 2,266 | 2026-10-06T15:21:10Z | owner 7b59cf6b | 2026-10-06T15:21:10Z |  | 1 |
| 12 | bd35f3e8-9df3-4671-8665-579805f31fe5 | 2,467 | 2026-10-06T15:21:35Z | owner 7b59cf6b | 2026-10-06T15:21:35Z |  | 1 |
| 13 | afb3e773-b9c3-4213-8836-fd5fe133c392 | 2,272 | 2026-10-06T15:22:18Z | owner 7b59cf6b | 2026-10-06T15:22:18Z |  | 1 |
| 14 | 1df1fed7-b839-40ea-b576-34ee691d4c37 | 2,042 | 2026-10-06T15:22:42Z | owner 7b59cf6b | 2026-10-06T15:22:42Z |  | 1 |
| 15 | 89dc9ee6-8b8d-467d-9347-583d5509098d | 2,748 | 2026-10-06T15:23:11Z | owner 7b59cf6b | 2026-10-06T15:23:11Z |  | 1 |
| 16 | 3c6193e3-550b-446c-8f7c-64e974b44003 | 2,155 | 2026-10-06T15:23:33Z | owner 7b59cf6b | 2026-10-06T15:23:33Z |  | 1 |
| 17 | ca1d2cbf-9b73-4185-9564-d5c1ded408c4 | 2,395 | 2026-10-06T15:23:57Z | owner 7b59cf6b | 2026-10-06T15:23:57Z |  | 1 |
| 18 | 6ee56b86-50e0-42e1-b2a4-eed1a4785da4 | 2,452 | 2026-10-06T15:24:27Z | owner 7b59cf6b | 2026-10-06T15:24:27Z |  | 1 |
| 19 | 87af54b1-a580-4fe4-a834-1f060e59cd3a | 2,044 | 2026-10-06T15:24:47Z | owner 7b59cf6b | 2026-10-06T15:24:47Z |  | 1 |
| 20 | 03345257-c5d8-4ef6-b5bd-cb39f7b8ba1d | 2,375 | 2026-10-06T15:25:18Z | owner 7b59cf6b | 2026-10-06T15:25:18Z |  | 1 |
| 21 | 067419c6-54b6-467d-8094-411c7eef7638 | 2,924 | 2026-10-06T15:26:01Z | owner 7b59cf6b | 2026-10-06T15:26:01Z |  | 1 |
| 22 | f2a84cd2-a07a-4faa-9cc3-9e6841efec5d | 2,300 | 2026-10-06T15:26:39Z | owner 7b59cf6b | 2026-10-06T15:26:39Z |  | 1 |
| 23 | eed83880-e96a-47ad-a9f6-3efa15289e79 | 2,215 | 2026-10-06T15:27:02Z | owner 7b59cf6b | 2026-10-06T15:27:02Z |  | 1 |
| 24 | dc609a15-5a8e-4560-ab59-8178cfbff1e2 | 3,121 | 2026-10-06T15:27:24Z | owner 7b59cf6b | 2026-10-06T15:27:24Z |  | 1 |
| 25 | f64656fd-b5b3-4972-8527-028f14d492f4 | 2,629 | 2026-10-06T15:27:50Z | owner 7b59cf6b | 2026-10-06T15:27:50Z |  | 1 |
| 26 | 05b4cd38-43dc-4806-a8cb-fe986d6a80a9 | 2,602 | 2026-10-06T15:28:17Z | owner 7b59cf6b | 2026-10-06T15:28:17Z |  | 1 |
| 27 | dc5dcb85-9db5-44ac-abbc-25a7bac3c794 | 2,290 | 2026-10-06T15:28:43Z | owner 7b59cf6b | 2026-10-06T15:28:43Z |  | 1 |
| 28 | 64f31aa0-b9a0-4fe3-9c14-c545d123dc56 | 2,411 | 2026-10-06T15:29:10Z | owner 7b59cf6b | 2026-10-06T15:29:10Z |  | 1 |
| 29 | f2264275-5aaf-467e-86bc-de74cf04d1a8 | 2,391 | 2026-10-06T15:33:05Z | owner 7b59cf6b | 2026-10-06T15:33:05Z |  | 1 |
| 30 | b7b865c1-122f-4c0c-892a-4b80f8af1bd6 | 2,311 | 2026-10-06T15:33:26Z | owner 7b59cf6b | 2026-10-06T15:33:26Z |  | 1 |
| 31 | 35c9e64b-f587-4b13-ba49-25a34ff8de5b | 2,619 | 2026-10-06T15:33:54Z | owner 7b59cf6b | 2026-10-06T15:33:54Z |  | 1 |
| 32 | 30e00a64-813e-43cd-96d4-43ab44880c30 | 2,255 | 2026-10-06T15:34:25Z | owner 7b59cf6b | 2026-10-06T15:34:25Z |  | 1 |
| 33 | 7c319483-ab89-4188-81d6-639a8c859e26 | 3,154 | 2026-10-06T15:34:58Z | owner 7b59cf6b | 2026-10-06T15:34:58Z |  | 1 |
| 34 | 55f7b1bf-fa48-4207-bd05-24208d798908 | 2,197 | 2026-10-06T15:35:16Z | owner 7b59cf6b | 2026-10-06T15:35:16Z |  | 1 |
| 35 | 63129508-d400-4e40-8c20-1cde3fbd3357 | 2,572 | 2026-10-06T15:35:34Z | owner 7b59cf6b | 2026-10-06T15:35:34Z |  | 1 |
| 36 | cfc6d503-b243-496f-81c0-cfac8aa484dc | 2,600 | 2026-10-06T15:35:52Z | owner 7b59cf6b | 2026-10-06T15:35:52Z |  | 1 |
| 37 | 44a3200c-0098-431f-840e-831138c2cd77 | 2,811 | 2026-10-06T15:36:13Z | owner 7b59cf6b | 2026-10-06T15:36:13Z |  | 1 |
| 38 | de373654-4b11-422f-ba8e-cdc97d19aa05 | 2,286 | 2026-10-06T15:36:32Z | owner 7b59cf6b | 2026-10-06T15:36:32Z |  | 1 |
| 39 | 77b967c9-6b36-4185-b215-dfbadcb6a04a | 2,020 | 2026-10-06T15:36:49Z | owner 7b59cf6b | 2026-10-06T15:36:49Z |  | 1 |
| 40 | 59a9d3b6-5593-4fc5-a3dd-b3062b21cc09 | 2,388 | 2026-10-06T15:37:07Z | owner 7b59cf6b | 2026-10-06T15:37:07Z |  | 1 |
| 41 | 37cbf05b-dd09-4aee-9243-c5adc6015e5d | 2,540 | 2026-10-06T15:37:41Z | owner 7b59cf6b | 2026-10-06T15:37:41Z |  | 1 |
| 42 | 7d85c9aa-e09c-4afd-99a6-ebc257d75c7a | 2,850 | 2026-10-06T15:38:00Z | owner 7b59cf6b | 2026-10-06T15:38:00Z |  | 1 |
| 43 | aa474cc4-c11f-44d5-a108-948101290b91 | 3,540 | 2026-10-06T15:38:41Z | owner 7b59cf6b | 2026-10-06T15:38:41Z |  | 1 |
| 44 | 7f7941c8-f637-4315-9dda-1c1ec8d58c2e | 2,883 | 2026-10-06T15:39:16Z | owner 7b59cf6b | 2026-10-06T15:40:11Z |  | 1 |
| 45 | 68ee7590-b8d8-4aee-9e95-783bbe598f50 | 2,362 | 2026-10-06T15:49:01Z | owner 7b59cf6b | 2026-10-06T15:49:01Z |  | 2 |
| 46 | a26ca3de-99a8-4851-abdf-0dba529afcf3 | 2,317 | 2026-10-06T15:49:25Z | owner 7b59cf6b | 2026-10-06T15:49:25Z |  | 2 |
| 47 | d8c134ba-26b0-49c4-934e-4041e0abd619 | 2,248 | 2026-10-06T15:50:03Z | owner 7b59cf6b | 2026-10-06T15:50:03Z |  | 2 |
| 48 | 8a02a4ce-e610-409a-a4c2-454318eebe82 | 2,010 | 2026-10-06T15:50:34Z | owner 7b59cf6b | 2026-10-06T15:50:34Z |  | 2 |
| 49 | 674c25dd-bffc-472d-9346-3b17ecece2a3 | 2,646 | 2026-10-06T15:50:50Z | owner 7b59cf6b | 2026-10-06T15:50:50Z |  | 2 |
| 50 | c63aa584-0aaf-4d7b-b853-94dd79fc5b8b | 2,799 | 2026-10-06T15:51:23Z | owner 7b59cf6b | 2026-10-06T15:51:23Z |  | 2 |
| 51 | f1749640-1edf-4222-8d4f-db6d650d46cb | 2,610 | 2026-10-06T15:51:47Z | owner 7b59cf6b | 2026-10-06T15:51:47Z |  | 2 |
| 52 | 7ec1dfd2-ac10-4574-8f3c-86c4d4c102d9 | 2,607 | 2026-10-06T15:52:16Z | owner 7b59cf6b | 2026-10-06T15:52:16Z |  | 2 |
| 53 | b7197c25-0629-4da8-b48a-e839fd8a256d | 2,761 | 2026-10-06T15:52:37Z | owner 7b59cf6b | 2026-10-06T15:52:37Z |  | 2 |
| 54 | f612eac7-c62a-4a9a-bb80-bb2affd94141 | 2,077 | 2026-10-06T15:54:50Z | owner 7b59cf6b | 2026-10-06T15:54:50Z |  | 2 |
| 55 | b14f8832-f446-4910-aa58-dbeceeec9037 | 2,872 | 2026-10-06T15:55:09Z | owner 7b59cf6b | 2026-10-06T15:55:09Z |  | 2 |
| 56 | 5df22654-ca0a-4801-bbfa-168eabfa6661 | 2,441 | 2026-10-06T15:55:31Z | owner 7b59cf6b | 2026-10-06T15:55:31Z |  | 2 |
| 57 | 14c77139-4d0c-416a-baed-f791ba0c6b10 | 2,516 | 2026-10-06T15:55:55Z | owner 7b59cf6b | 2026-10-06T15:55:55Z |  | 2 |
| 58 | 4e0235a4-5444-4cbf-ae4b-b69452cb97a3 | 2,426 | 2026-10-06T15:56:23Z | owner 7b59cf6b | 2026-10-06T15:56:23Z |  | 2 |
| 59 | 2addaeb5-8986-4007-b39c-954427ed418b | 2,444 | 2026-10-06T15:56:42Z | owner 7b59cf6b | 2026-10-06T15:56:42Z |  | 2 |
| 60 | bde3b675-27fc-4b02-a6fb-40a1c709902d | 2,570 | 2026-10-06T15:57:04Z | owner 7b59cf6b | 2026-10-06T15:57:04Z |  | 2 |
| 61 | ec8308f4-00f3-4b36-b9c4-b138693d96d3 | 3,078 | 2026-10-06T15:57:19Z | owner 7b59cf6b | 2026-10-06T15:57:19Z |  | 2 |
| 62 | 451af6da-775f-413f-887c-158bfb9b6243 | 2,703 | 2026-10-06T15:57:40Z | owner 7b59cf6b | 2026-10-06T15:57:40Z |  | 2 |
| 63 | 4ed094d4-136e-4c10-95d8-e214c0a6ba4c | 2,472 | 2026-10-06T15:57:58Z | owner 7b59cf6b | 2026-10-06T15:57:58Z |  | 2 |
| 64 | 78a8b3f5-f38c-4b52-a07f-4ce5f2a5e485 | 2,535 | 2026-10-06T15:58:16Z | owner 7b59cf6b | 2026-10-06T15:58:16Z |  | 2 |
| 65 | 8a028d46-551e-4d63-aac4-ee2a97d37024 | 2,593 | 2026-10-06T15:58:37Z | owner 7b59cf6b | 2026-10-06T15:58:37Z |  | 2 |
| 66 | add72999-a60c-4703-a9cf-4d6abc7392fc | 2,977 | 2026-10-06T16:34:06Z | owner 7b59cf6b | 2026-10-06T16:34:06Z |  | 3 |
| 67 | fffd6096-5d3b-4777-83ce-e1b17a39c488 | 2,842 | 2026-10-06T16:34:26Z | owner 7b59cf6b | 2026-10-06T16:34:26Z |  | 3 |
| 68 | e77436a7-b6ce-491e-ab0a-857c38b72ab9 | 2,517 | 2026-10-06T16:34:49Z | owner 7b59cf6b | 2026-10-06T16:34:49Z |  | 3 |
| 69 | 929dca44-7c0f-4f6e-aebf-aeff75cf2b0c | 2,440 | 2026-10-06T16:35:12Z | owner 7b59cf6b | 2026-10-06T16:35:12Z |  | 3 |
| 70 | c791f8f3-33c4-4dec-bd5b-72fe2ddc623f | 2,663 | 2026-10-06T16:35:31Z | owner 7b59cf6b | 2026-10-06T16:35:31Z |  | 3 |
| 71 | 590c0760-c871-46e3-9e3a-0e6b26a7e068 | 2,524 | 2026-10-06T16:36:26Z | owner 7b59cf6b | 2026-10-06T16:36:26Z |  | 3 |
| 72 | d9d9e1ac-37d7-48ae-9672-8bd37bb73196 | 2,597 | 2026-10-06T16:37:18Z | owner 7b59cf6b | 2026-10-06T16:37:18Z |  | 3 |
| 73 | bfb3653a-813c-4c6c-aeeb-61e40e5afd42 | 3,012 | 2026-10-06T16:38:15Z | owner 7b59cf6b | 2026-10-06T16:38:15Z |  | 3 |
| 74 | f03f1555-84b3-4c4e-bb24-66aaaf0b3693 | 2,840 | 2026-10-06T16:38:44Z | owner 7b59cf6b | 2026-10-06T16:38:44Z |  | 3 |
| 75 | 67fe3180-f655-4ad8-aea3-afd23b6068e0 | 2,234 | 2026-10-06T16:39:06Z | owner 7b59cf6b | 2026-10-06T16:39:06Z |  | 3 |
| 76 | 9840a519-cc6a-4296-83cf-c8bda1d29def | 2,138 | 2026-10-06T16:39:22Z | owner 7b59cf6b | 2026-10-06T16:39:22Z |  | 3 |
| 77 | e39e60ce-e5d2-48e1-87f3-aa1ad09cd8f9 | 2,057 | 2026-10-06T16:39:43Z | owner 7b59cf6b | 2026-10-06T16:39:43Z |  | 3 |
| 78 | d59e60c9-e922-48ca-a47f-c664499bf683 | 2,025 | 2026-10-06T16:44:02Z | owner 7b59cf6b | 2026-10-06T16:44:02Z |  | 3 |
| 79 | 92fc1e69-6f33-4825-90a0-14009b5d607e | 2,139 | 2026-10-06T16:49:16Z | owner 7b59cf6b | 2026-10-06T16:49:16Z |  | 4 |
| 80 | 40d9e35d-29db-457b-91ab-42e14a020a03 | 2,523 | 2026-10-06T16:49:37Z | owner 7b59cf6b | 2026-10-06T16:49:37Z |  | 4 |
| 81 | f4df2191-9439-4cba-b674-b7017fd09d81 | 2,722 | 2026-10-06T16:50:11Z | owner 7b59cf6b | 2026-10-06T16:50:11Z |  | 4 |
| 82 | 6ff4f433-8f14-4a92-9ea4-1dc77c8f9dbf | 2,149 | 2026-10-06T16:50:54Z | owner 7b59cf6b | 2026-10-06T16:50:54Z |  | 4 |
| 83 | 5ecc2306-3062-4f2d-afa2-b64be6ef60bd | 2,376 | 2026-10-06T18:26:42Z | owner 7b59cf6b | 2026-10-06T18:26:42Z |  | 5 |
| 84 | fd0278ec-667a-4202-981e-609b84625554 | 2,132 | 2026-10-06T18:27:42Z | owner 7b59cf6b | 2026-10-06T18:27:42Z |  | 5 |
| 85 | 73e4c486-777e-4c58-97a6-30833fc9d346 | 2,341 | 2026-10-06T18:28:08Z | owner 7b59cf6b | 2026-10-06T18:28:08Z |  | 5 |
| 86 | 339f33ad-e0a1-4c03-a2a7-92425176a745 | 2,380 | 2026-10-06T18:28:30Z | owner 7b59cf6b | 2026-10-06T18:28:30Z |  | 5 |
| 87 | d53ecbf6-b6a9-4621-8248-bd1a235ea735 | 2,265 | 2026-10-06T18:28:43Z | owner 7b59cf6b | 2026-10-06T18:28:43Z |  | 5 |
| 88 | fdfa2f3d-b546-4ef8-b063-2fc4c35e09ab | 2,283 | 2026-10-06T18:29:01Z | owner 7b59cf6b | 2026-10-06T18:29:01Z |  | 5 |
| 89 | f7199701-c4c1-4fac-9d11-34b186695267 | 2,303 | 2026-10-06T18:29:19Z | owner 7b59cf6b | 2026-10-06T18:29:19Z |  | 5 |
| 90 | a000dcb7-f527-49f7-8790-8f8dce8b09f4 | 2,940 | 2026-10-06T18:29:40Z | owner 7b59cf6b | 2026-10-06T18:29:40Z |  | 5 |
| 91 | be44b648-a8b0-4e94-85ba-938b57799732 | 2,541 | 2026-10-06T18:29:57Z | owner 7b59cf6b | 2026-10-06T18:29:57Z |  | 5 |
| 92 | 48828c06-4a49-4f1b-999a-94aa61a6a753 | 2,436 | 2026-10-06T18:30:18Z | owner 7b59cf6b | 2026-10-06T18:30:18Z |  | 5 |
| 93 | 071d8e6b-c8c6-465b-b58b-0cab6b4ae1c6 | 2,476 | 2026-10-06T18:30:34Z | owner 7b59cf6b | 2026-10-06T18:30:34Z |  | 5 |
| 94 | 1358e6f9-efa6-4052-91cd-62450410b9e9 | 2,722 | 2026-10-06T18:30:47Z | owner 7b59cf6b | 2026-10-06T18:30:47Z |  | 5 |
| 95 | 3434c0a9-3924-4046-915d-ac91d41fd9c1 | 2,243 | 2026-10-06T18:30:58Z | owner 7b59cf6b | 2026-10-06T18:30:58Z |  | 5 |
| 96 | 5c38e3a4-e26c-42a9-a2d1-3b6442dca662 | 2,215 | 2026-10-06T18:31:27Z | owner 7b59cf6b | 2026-10-06T18:31:27Z |  | 5 |
| 97 | f4fcf6d6-8abf-4961-9ce7-91765c152e93 | 3,521 | 2026-10-06T18:31:42Z | owner 7b59cf6b | 2026-10-06T18:31:42Z |  | 5 |
| 98 | 4262d32e-55ff-4f4e-907e-f91e2d7e1275 | 1,962 | 2026-10-06T18:32:02Z | owner 7b59cf6b | 2026-10-06T18:32:02Z |  | 5 |
| 99 | 49866b53-8641-4570-a673-2041a6b1d8d6 | 2,281 | 2026-10-06T18:32:15Z | owner 7b59cf6b | 2026-10-06T18:32:15Z |  | 5 |
| 100 | b1fd1992-2c71-4196-b8a3-8829243c7d99 | 2,311 | 2026-10-06T18:32:29Z | owner 7b59cf6b | 2026-10-06T18:32:29Z |  | 5 |
| 101 | f7be0c8a-f2c1-4f87-96d9-a6898e2c134e | 2,156 | 2026-10-06T18:32:48Z | owner 7b59cf6b | 2026-10-06T18:32:48Z |  | 5 |
| 102 | 2384cc1f-1781-4183-ae6b-8b68da00fbc9 | 2,681 | 2026-10-06T18:33:06Z | owner 7b59cf6b | 2026-10-06T18:33:06Z |  | 5 |
| 103 | f056b7d2-e3f2-44f2-8a96-fefaacbf25ed | 2,651 | 2026-10-06T18:33:25Z | owner 7b59cf6b | 2026-10-06T18:33:25Z |  | 5 |
| 104 | 76df96da-71fb-413e-8d94-55e6e69b0ccf | 2,258 | 2026-10-06T18:33:38Z | owner 7b59cf6b | 2026-10-06T18:33:38Z |  | 5 |
| 105 | ace5fa90-aa03-4dbc-93c3-a0663f1a85d4 | 2,137 | 2026-10-06T18:33:51Z | owner 7b59cf6b | 2026-10-06T18:33:51Z |  | 5 |
| 106 | dbb1933f-3293-462b-9ab4-37e60ee1b909 | 2,349 | 2026-10-06T18:34:03Z | owner 7b59cf6b | 2026-10-06T18:34:03Z |  | 5 |
| 107 | 11ccd139-100b-45a1-b97b-533d4b83060d | 2,312 | 2026-10-06T18:34:20Z | owner 7b59cf6b | 2026-10-06T18:34:20Z |  | 5 |
| 108 | 41aec4f6-d1f3-43a0-b99e-ddcb3e82c8fd | 2,021 | 2026-10-06T18:34:58Z | owner 7b59cf6b | 2026-10-06T18:34:58Z |  | 5 |
| 109 | 8098903b-30e2-4926-b824-ed3e64d66d54 | 2,655 | 2026-10-06T18:35:36Z | owner 7b59cf6b | 2026-10-06T18:35:36Z |  | 5 |
| 110 | bb4ad34c-d872-462c-b4aa-dfa6bd53733d | 2,717 | 2026-10-06T18:35:49Z | owner 7b59cf6b | 2026-10-06T18:35:49Z |  | 5 |
| 111 | f65e5f15-6957-4ff7-b1f8-45b8d05185b3 | 2,192 | 2026-10-06T18:36:05Z | owner 7b59cf6b | 2026-10-06T18:36:05Z |  | 5 |
| 112 | 519d7854-2d14-4b8a-84dc-1c985c1757e6 | 2,927 | 2026-10-06T18:36:21Z | owner 7b59cf6b | 2026-10-06T18:36:21Z |  | 5 |
| 113 | a299efdf-f2fd-440e-87e4-f74a18667851 | 2,311 | 2026-10-06T18:36:40Z | owner 7b59cf6b | 2026-10-06T18:36:40Z |  | 5 |
| 114 | c4e4cb5d-1947-47cb-80c4-c340463ab383 | 2,553 | 2026-10-06T18:37:05Z | owner 7b59cf6b | 2026-10-06T18:37:05Z |  | 5 |
| 115 | 6b5a94ec-a338-44d9-a810-9ecfe21e4b77 | 2,760 | 2026-10-06T18:37:22Z | owner 7b59cf6b | 2026-10-06T18:37:22Z |  | 5 |
| 116 | 7123b883-3098-47a0-9767-39de9837cf5f | 2,615 | 2026-10-06T18:37:58Z | owner 7b59cf6b | 2026-10-06T18:37:58Z |  | 5 |
| 117 | 0b58f2d4-62c3-451e-9c56-ed761950d574 | 2,666 | 2026-10-06T18:38:17Z | owner 7b59cf6b | 2026-10-06T18:38:17Z |  | 5 |
| 118 | 302b1cc1-86b9-47ed-9735-ea1917e3cce7 | 2,467 | 2026-10-06T18:38:33Z | owner 7b59cf6b | 2026-10-06T18:38:33Z |  | 5 |
| 119 | 20e04cc3-1db3-474d-bc3b-2ed64de8773f | 1,452 | 2026-10-06T18:38:45Z | owner 7b59cf6b | 2026-10-06T18:38:45Z |  | 5 |
| 120 | bc3cfe33-519c-40fd-bcca-6f8b86a5227e | 2,547 | 2026-10-06T18:38:54Z | owner 7b59cf6b | 2026-10-06T18:38:54Z |  | 5 |
| 121 | b97bff17-7710-4421-a1ae-9f5428d5d28b | 2,256 | 2026-10-06T18:39:02Z | owner 7b59cf6b | 2026-10-06T18:39:02Z |  | 5 |
| 122 | 630153e4-8c23-41dd-87b5-afdb494eb607 | 2,522 | 2026-10-06T18:39:12Z | owner 7b59cf6b | 2026-10-06T18:39:12Z |  | 5 |
| 123 | 1344ed20-e5f5-464f-b9cd-d7ed052b6ca1 | 2,375 | 2026-10-06T18:39:23Z | owner 7b59cf6b | 2026-10-06T18:39:23Z |  | 5 |
| 124 | 189025a5-e79c-4e67-ba3d-2a9f6f60cacc | 2,057 | 2026-10-06T18:39:33Z | owner 7b59cf6b | 2026-10-06T18:39:33Z |  | 5 |
| 125 | b1842e64-8798-4404-8b34-54c73a56557f | 3,857 | 2026-10-06T18:39:44Z | owner 7b59cf6b | 2026-10-06T18:39:44Z |  | 5 |
| 126 | d92507c5-af8f-40da-a894-45551cecea42 | 2,383 | 2026-10-06T18:39:55Z | owner 7b59cf6b | 2026-10-06T18:39:55Z |  | 5 |
| 127 | 88a95099-06a1-4018-a43c-ac5280a3bf04 | 1,953 | 2026-10-06T18:40:06Z | owner 7b59cf6b | 2026-10-06T18:40:06Z |  | 5 |
| 128 | c5302c06-1571-4c9a-be87-441b36f77d5c | 2,210 | 2026-10-06T18:40:18Z | owner 7b59cf6b | 2026-10-06T18:40:18Z |  | 5 |
| 129 | 4ed2234e-66f1-47f0-8c52-61fcedbf0abe | 2,230 | 2026-10-06T18:40:28Z | owner 7b59cf6b | 2026-10-06T18:40:28Z |  | 5 |
| 130 | e488f918-5cc8-4de3-88d0-9d4929d1c88a | 2,280 | 2026-10-06T18:40:38Z | owner 7b59cf6b | 2026-10-06T18:40:38Z |  | 5 |
| 131 | 1421f3ec-a816-4cde-ae26-4213215e7117 | 2,090 | 2026-10-06T18:40:47Z | owner 7b59cf6b | 2026-10-06T18:40:47Z |  | 5 |
| 132 | fa3fab46-8972-4b74-8447-10fd91dbaf82 | 1,926 | 2026-10-06T18:40:59Z | owner 7b59cf6b | 2026-10-06T18:40:59Z |  | 5 |
| 133 | b6c91537-764b-448e-aa35-b09fcad01cfc | 1,862 | 2026-10-06T18:41:52Z | owner 7b59cf6b | 2026-10-06T18:41:52Z |  | 5 |
| 134 | eea1c266-6df5-4e16-a30c-37d563438a4a | 2,216 | 2026-10-06T18:42:00Z | owner 7b59cf6b | 2026-10-06T18:42:00Z |  | 5 |
| 135 | a246e4ef-5462-4994-bebd-9247f905fd54 | 2,212 | 2026-10-06T18:42:11Z | owner 7b59cf6b | 2026-10-06T18:42:11Z |  | 5 |
| 136 | 001f3862-c30c-48bc-bef6-c8c4c23907b5 | 2,366 | 2026-10-06T18:42:19Z | owner 7b59cf6b | 2026-10-06T18:42:19Z |  | 5 |
| 137 | 4c0c3dfb-083a-4cca-a9cc-9990474e482d | 1,956 | 2026-10-06T18:42:30Z | owner 7b59cf6b | 2026-10-06T18:42:30Z |  | 5 |
| 138 | f47c4be6-476a-45ef-8129-d1e4f65e7dcb | 2,332 | 2026-10-06T18:42:39Z | owner 7b59cf6b | 2026-10-06T18:42:39Z |  | 5 |
| 139 | aed7247c-771e-4606-a7a8-61970935e594 | 2,936 | 2026-10-06T18:42:50Z | owner 7b59cf6b | 2026-10-06T18:42:50Z |  | 5 |
| 140 | b356582b-a33e-4bb0-bdc1-039c49ebb47e | 1,842 | 2026-10-06T18:43:52Z | owner 7b59cf6b | 2026-10-06T18:43:52Z |  | 5 |
| 141 | a6cb9fcc-a956-4cff-837c-fc62c9e53fe9 | 2,514 | 2026-10-06T19:13:23Z | owner 7b59cf6b | 2026-10-06T19:13:23Z |  | 6 |
| 142 | bfe642bd-9edd-4875-abfc-5edb0c815788 | 2,653 | 2026-10-06T19:13:31Z | owner 7b59cf6b | 2026-10-06T19:13:31Z |  | 6 |
| 143 | 136e0b56-1ab4-4a59-9741-b36e493fa2c9 | 2,645 | 2026-10-06T19:13:44Z | owner 7b59cf6b | 2026-10-06T19:13:44Z |  | 6 |
| 144 | 26a59b9a-ad60-4e18-8a00-5a9ef770dd6d | 2,753 | 2026-10-06T19:13:53Z | owner 7b59cf6b | 2026-10-06T19:13:53Z |  | 6 |
| 145 | 7d5cd958-8356-425d-8e52-2494c7349053 | 2,133 | 2026-10-06T19:14:02Z | owner 7b59cf6b | 2026-10-06T19:14:02Z |  | 6 |
| 146 | 868cc665-82d0-4608-b3a6-5fe7b8b012d6 | 3,081 | 2026-10-06T19:14:12Z | owner 7b59cf6b | 2026-10-06T19:14:12Z |  | 6 |
| 147 | f673b140-7a4b-4db2-8c06-832258bde2e4 | 2,546 | 2026-10-06T19:14:22Z | owner 7b59cf6b | 2026-10-06T19:14:22Z |  | 6 |
| 148 | 5224dac4-32c5-40e0-a4ab-a076c9e09bed | 2,991 | 2026-10-06T19:14:31Z | owner 7b59cf6b | 2026-10-06T19:14:31Z |  | 6 |
| 149 | 0e92492f-c392-46da-9246-cb5d3edffd27 | 2,231 | 2026-10-06T19:14:40Z | owner 7b59cf6b | 2026-10-06T19:14:40Z |  | 6 |
| 150 | 9bc92319-52d8-4f5b-944f-918988e0f866 | 2,164 | 2026-10-06T19:14:57Z | owner 7b59cf6b | 2026-10-06T19:14:57Z |  | 6 |
| 151 | 1b023017-f10b-4491-a592-f8e2ba78484a | 2,921 | 2026-10-06T19:15:08Z | owner 7b59cf6b | 2026-10-06T19:15:08Z |  | 6 |
| 152 | fa047f30-6350-405c-bec1-92873779ffce | 2,983 | 2026-10-06T19:15:17Z | owner 7b59cf6b | 2026-10-06T19:15:17Z |  | 6 |
| 153 | 74fbf383-4654-4408-a46e-fa5b2cfb6ee4 | 3,241 | 2026-10-06T19:15:24Z | owner 7b59cf6b | 2026-10-06T19:15:24Z |  | 6 |
| 154 | d4c3dbfa-9c05-4ce3-899e-dbb970a06a4a | 2,891 | 2026-10-06T19:15:31Z | owner 7b59cf6b | 2026-10-06T19:15:31Z |  | 6 |
| 155 | 2acd525f-3b19-4122-a9f4-ab7369129991 | 3,652 | 2026-10-06T19:15:40Z | owner 7b59cf6b | 2026-10-06T19:15:40Z |  | 6 |
| 156 | 0ac3999d-12e5-4a12-a88a-409d08345b93 | 2,647 | 2026-10-06T19:15:49Z | owner 7b59cf6b | 2026-10-06T19:15:49Z |  | 6 |
| 157 | 93fc8ddf-a0d8-4e7e-82cd-b6f0ef24ea2f | 234 | 2026-10-06T19:15:57Z | owner 7b59cf6b | 2026-10-06T19:15:57Z |  | 6 |
| 158 | 6b768981-82a3-43c3-a1d4-859f79c25bda | 1,962 | 2026-10-06T19:16:19Z | owner 7b59cf6b | 2026-10-06T19:16:19Z |  | 6 |
| 159 | 85ebb458-48f2-4275-b848-e2c97fe74802 | 3,045 | 2026-10-06T19:16:28Z | owner 7b59cf6b | 2026-10-06T19:16:28Z |  | 6 |
| 160 | 4325e176-ea5b-4772-b77e-8a72535f3b51 | 2,814 | 2026-10-06T19:16:39Z | owner 7b59cf6b | 2026-10-06T19:16:39Z |  | 6 |
| 161 | f5f4e6f1-be56-4401-bff7-9f713fb75e95 | 1,953 | 2026-10-06T19:16:50Z | owner 7b59cf6b | 2026-10-06T19:16:50Z |  | 6 |
| 162 | a9285f5d-43da-413b-9220-35c1b1964c1a | 2,950 | 2026-10-06T19:16:59Z | owner 7b59cf6b | 2026-10-06T19:16:59Z |  | 6 |
| 163 | dbee5c27-d48e-4f5c-aee4-4672c896e942 | 2,221 | 2026-10-06T19:17:06Z | owner 7b59cf6b | 2026-10-06T19:17:06Z |  | 6 |
| 164 | 4282ef43-2b9c-419e-a166-b4df62769638 | 3,063 | 2026-10-06T19:17:14Z | owner 7b59cf6b | 2026-10-06T19:17:14Z |  | 6 |
| 165 | f0aedfe1-d27f-4e4d-8bee-434fccbe62c4 | 2,831 | 2026-10-06T19:17:23Z | owner 7b59cf6b | 2026-10-06T19:17:23Z |  | 6 |
| 166 | 4f4ba819-5cd8-44cc-ab51-3e7d8aea42b9 | 2,861 | 2026-10-06T19:17:42Z | owner 7b59cf6b | 2026-10-06T19:17:42Z |  | 6 |
| 167 | 64aaaf6e-6196-4d32-a27a-374afdd1d1b2 | 2,133 | 2026-10-06T19:17:49Z | owner 7b59cf6b | 2026-10-06T19:17:49Z |  | 6 |
| 168 | 957a7a6a-0c02-4924-adee-4edb3da43541 | 1,460 | 2026-10-06T19:17:58Z | owner 7b59cf6b | 2026-10-06T19:17:58Z |  | 6 |
| 169 | e1fe47b2-e706-4e02-9518-284965fd8781 | 2,708 | 2026-10-06T19:18:25Z | owner 7b59cf6b | 2026-10-06T19:18:25Z |  | 6 |
| 170 | 311da38b-641f-4d57-b843-c88ffef8be41 | 2,833 | 2026-10-06T19:18:32Z | owner 7b59cf6b | 2026-10-06T19:18:32Z |  | 6 |
| 171 | 36f310d9-6ab4-4a5b-ada5-7b6de51cc3da | 2,304 | 2026-10-06T19:18:41Z | owner 7b59cf6b | 2026-10-06T19:18:41Z |  | 6 |
| 172 | 692963cd-534c-4e6f-83e6-95d419ff6ab6 | 2,149 | 2026-10-06T19:18:51Z | owner 7b59cf6b | 2026-10-06T19:18:51Z |  | 6 |
| 173 | 8da5a4ab-c166-4347-ac8a-455f9bca357f | 2,671 | 2026-10-06T19:19:00Z | owner 7b59cf6b | 2026-10-06T19:19:00Z |  | 6 |
| 174 | 087094b2-314b-4d40-8e1e-eac9eebffea6 | 2,648 | 2026-10-06T19:19:08Z | owner 7b59cf6b | 2026-10-06T19:19:08Z |  | 6 |
| 175 | 6d72edd5-64b4-43b7-9f4c-261b99bc93ab | 2,720 | 2026-10-06T19:19:17Z | owner 7b59cf6b | 2026-10-06T19:19:17Z |  | 6 |
| 176 | ac1e94c8-827d-4447-8e00-6dcdaad9fd79 | 1,973 | 2026-10-06T19:19:28Z | owner 7b59cf6b | 2026-10-06T19:19:28Z |  | 6 |
| 177 | f11f1ae3-70fd-4ced-9f0c-da41d63306b5 | 2,202 | 2026-10-06T19:19:40Z | owner 7b59cf6b | 2026-10-06T19:19:40Z |  | 6 |
