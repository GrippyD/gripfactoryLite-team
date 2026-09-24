# 2026-09-16 THE RECORD CORRECTED (canon 0.30.91)

Scribe-direct under G-2, applied at the owner's keyboard. Owner ruling 2026-09-16, verbatim:

> I need you to correct the records for me.  Here is where we stand: https://ocgcompanies.sharepoint.com/sites/GripInternalSite/Operations/xxxOperations/Harvest 2026/26. Operations Dashboard.xlsx (under harvest details) contains the hard record of the harvest so far.  I need lot 18 and 19 to have moved from south and be staged at silo 5 and 4 respectively (I will go in and run the "load silo" routine) and the weights need to be corrected to reflect the wet weights listed.  Lot 20 is fake and needs to be removed.  While you're in there, maybe you can assess what's happening

His picks on the two forks (AskUserQuestion): "Void the stray too" (the 246,344 g lot weighed onto 26011 on the 15th) and "Leave 26010 as it is" (5,821 g under the workbook in both wet and dry).

The record: the workbook `26H.Operations Dashboard .xlsm` (the Microsoft 365 connector refuses .xlsm, so he attached it), sheet Harvest Details, header row 4, columns METRC Harvest Tag, Harvest Batch Name, Plants, Bucked Wet Weight (grams), Silo #, Dry Weight. The database: his `node scripts/db-snapshot.mjs pre_repair_0916` (first run a 7403 blip, second run clean) at `db_backups\20260916-081647_pre_repair_0916`, 49 tables, 205,215 rows, dumped 2026-09-16T12:16:51Z (8:16 AM Eastern).

## What was found (Eastern clock, from record_change_log and the tote rows)

The wet pane bug of THE HBN THAT CAME BACK (0.30.84) hit the PNS tablet twice on the 15th before the fix reached the floor; the tap bug of THE FOUR START TAPS (0.30.89) hit once that evening.

1. 1:52 PM: a spear lot was started on 26011 (PNN, planned Silo 2), truck 3; 35 totes in five minutes, 246,344 g; finished 1:58 PM with 530 plants (the HBN's count). Its SPR package sat at the PNN barn with a manifest PNN to ARL on the road. The stray.
2. 3:47 PM: the day's real PNS lot was started on 26010 (PNN, planned Silo 1), truck 4, bucked; 748 totes from 3:47 to 5:51 PM, 5,561,556 g. The HBN pencil moved it to 26018 at 5:28 PM ("corrected HBN"); it finished at 5:57 PM. Lot 18.
3. 5:59 PM: lot 19 started properly on 26019, truck 5; 753 totes from 6:19 to 8:09 PM, 5,414,572 g; finished 8:10 PM.
4. 8:11 PM: HBN 26020 was minted (PNS, OD, Gelonade, silo NA, serial 20). At 8:12 PM Start lot was tapped four times in six seconds and four lots were born. The crew weighed on: 59 totes on one lot from 8:14 to 8:22 PM (422,094 g, left weighing) and 362 on another from 8:25 to 9:23 PM (2,927,160 g, finished, truck 6). Two lots stayed empty.
5. 7:46 AM on the 16th: three receipts landed at the PNN barn within three seconds (the 26020 lot, lot 19, lot 18), so all three read drying in the barn. Lot 19's receipt landed on its virtual movement and left its truck 5 manifest open on the road.

The arithmetic: the workbook has 18 at 7,203,633 g and 19 at 6,874,575 g, together 3,102,080 g above the app's totes; 26020 carried 3,349,254 g in 421 totes. The 26020 material is the missing part of 18 and 19, weighed onto a fresh HBN because the real ones had been finished. Nothing from 18, 19 or 20 was marked uploaded to METRC (metrc_uploads holds two package_adjust marks), so the correction leaves no state file behind. 26011, 26013, 26014, 26015, 26016 and 26017 equal the workbook to the gram; 26010 reads 6,092,589.01 wet on exactly 1,000 totes and 1,456,290 dry against 6,098,410 and 1,462,111 (his word: leave it).

## The repair

One reviewed SQL file, `app/scripts/repairs/2026-09-16_lots_18_19_20.sql` (37,611 bytes, sha256 18f2e3c5022e47adee1f2e997b021108215ebbe1c8c3fc95cb61b6a242daf168), written from `repair_ids.json` by a generator against the pre snapshot, ids deterministic (uuid from sha256 of "gripfactory-repair-0916:" + seed), every UPDATE guarded by the value it expects, every log insert guarded by NOT EXISTS on record, field and reason, so a second run changes nothing. Actor: his login (7b59cf6b). Reason prefix: "repair 2026-09-16 (canon 0.30.91), the Operations Dashboard Harvest Details as the record: ...". Fixed stamp 2026-09-16T13:30:00.000Z (9:30 AM Eastern), chosen when the file was written; it landed at 8:57 AM, so the log reads the stamp, not the wall clock (idempotence wanted one value).

- A. Lot 18 (8f3d1325): one correction tote of 1,642,077 g (wet_weights 0d863bed) so the lot reads 7,203,633 g on 749 totes; plant_count NULL to 1,090; its barn package (52cf1094) qty 5,561,556 to 7,203,633.
- B. Lot 19 (20c5c775): one correction tote of 1,460,003 g (4d793a3a), the lot 6,874,575 g on 754 totes; plant_count NULL to 497; package (04456957) qty to 6,874,575; HBN 26019 planned_dryspc 5 to 4 (the Silo # column; the HBN's 05 stands); the truck 5 manifest (0ad21a5f) closed as received: receipt 6306a874, its item received_at, received_by, received_qty 5,414,572, receipt_id.
- C. 26020 (91f512f8): the HBN, its four lots (9312c3f4, ceb4a910, 7f223167, bcc63624), the born package (67384641), the virtual movement (96f04543) and the truck 6 manifest (4d5c0159) with delete_reason, their items, and the receipt (f8551d42) voided. The 421 tote rows stay attached to the voided lots for the record.
- D. The stray (5d71d223): the lot, its package (1a35dc37), the virtual movement (f16df2b5) and the truck 3 manifest (8eee1b2c) with delete_reason, and their items voided.
- E. Untouched on purpose: 26010, 26011, 26013, 26014, 26015, 26016, 26017.

Rehearsal in the sandbox: a local D1 built from zero with the 52 migrations, the pre snapshot's tables loaded into the sqlite file, the repair applied with `wrangler d1 execute --local --file`, verified (the totals, plants, packages, planned 4, the voids, the receipt, 30 log rows), applied a second time as a no-op (still 30 rows, one receipt). A dev server on the repaired copy showed the Load Silo pane listing Lot 26019 and Lot 26018, the strip drying, drying, drying, loading (Silo 4, 6,874,575), loading (Silo 5, 7,203,633), empty, both "in the barn, planned here", and no 26020 in any queue, upload or interco pane. The server was killed and .smoke-persist removed.

## Applied (his hands, 8:57 AM Eastern)

```
npx wrangler d1 execute gripfactory-lite-grip-20260914 --env grip --remote --file scripts/repairs/2026-09-16_lots_18_19_20.sql
Executed 58 queries in 52.45ms (351 rows read, 156 rows written)
Database is currently at bookmark 00000077-00000020-000050e8-7ba7ab3a06b043e8fc9c92dbf806bc41.
Total queries executed 58 | Rows read 351 | Rows written 156 | Database size (MB) 83.26
node scripts/db-snapshot.mjs post_repair_0916
db_backups\20260916-085721_post_repair_0916: 49 tables, 205254 rows, 0 failed
```

Wrangler printed "Warning: leftover buffer from sql.ingest" quoting section E, the closing comment block: a file that ends in comments leaves the splitter a remainder with no statement in it. Harmless; the 58 statements ran.

## Verified against the post snapshot

Row deltas pre to post: wet_weights 7,828 to 7,830 (+2, the correction totes); interco_receipts 7 to 8 (+1); record_change_log 81,768 to 81,802 (+34: the 30 repair rows and 4 rows of his own trim hours typed at 8:49 AM, Day and Second Shift 110 then 140); trim_labor_hours 0 to 2 (his typing). No other table moved; no pre row missing.

The 30 repair rows are exactly the rehearsed set, all under 7b59cf6b at the fixed stamp. End state: lot 18 drying, 7,203,633 g, 749 totes, 1,090 plants, truck 4; lot 19 drying, 6,874,575 g, 754 totes, 497 plants, truck 5; 26019 planned 4; packages 52cf1094 at 7,203,633 and 04456957 at 6,874,575, both BARN; the truck 5 item received 5,414,572 on receipt 6306a874; 26020 and its four lots, its package, both movements and their items and its receipt deleted with the reason; the stray lot, package and two movements deleted; 26010 at 6,092,589.01 on 1,000 totes, 1,058 plants, unloaded; 26011 5,444,253; 26013 5,454,119; 26014 4,825,197; 26015 5,347,180; 26016 5,315,136; 26017 5,576,276, all unchanged.

Still his: Load Silo for 26018 into Silo 5 and 26019 into Silo 4 (the pane preselects the planned silo). silo_loads stood at 7 rows in both snapshots.

## Noticed for a later row

`/silos/live.json` entries omit the per-silo `waiting` list that THE LOADING SILO (0.30.81) described; the strip HTML names the waiting lots, the JSON does not.

## Sealed final check

```
scripts/repairs/2026-09-16_lots_18_19_20.sql   37611  18f2e3c5022e47adee1f2e997b021108215ebbe1c8c3fc95cb61b6a242daf168
  (sha256 identical on the device and in the sandbox; dash audit 0)
pre snapshot  20260916-081647_pre_repair_0916   49 tables  205215 rows  dumped 2026-09-16T12:16:51Z
post snapshot 20260916-085721_post_repair_0916  49 tables  205254 rows  dumped 2026-09-16T12:57:23Z
D1 execute: 58 queries, 351 rows read, 156 rows written, bookmark 00000077-00000020-000050e8-7ba7ab3a06b043e8fc9c92dbf806bc41
repair log rows: 30 (rehearsal 30); other new log rows: 4 (his trim hours)
No code change; the app stands at the 0.30.90 hashes (worker d6b24f47).
```
