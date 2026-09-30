# 2026-09-30 The intervention on lots 26027 and 26029 (canon 0.30.315): two repair files rehearsed, his pick pending

Scribe session, at his word "Need an intervention" on the crew's message of 2026-09-29 17:40, in its words: when inputting the dry weights from what was bucked, 26027 reads 302,510 g dry total and 7,977,878 g remaining; 26029 reads 1,244,555 g dry total and negative 819,001 g remaining; on the day the HBNs were created 26029 was created by mistake and should have been part of 26028, and it looks like 26028 got combined with 26027 instead of 26029 getting added to 26028.

## What the floor's data says (the 20:46 snapshot, `db_backups/20260929-204612_pre_trimming_tidies`, dumped 2026-09-30T00:46:15Z, after the crew's weighing)

1. THE THREE HBNs, all 2026-09-19 at ARL, Bermuda Triangle: 26027 (`26262-ARL-OD-009-0-NA-26027`, lot `505edf53`, OD under AU-G-C-001509), 26028 (`...-NA-26028`, lot `705c259f`, OD, the same license) and 26029 (`26262-ARL-ID-009-0-NA-26029`, lot `345bdebf`, minted ID under GR-C-002600), minted by the same hand at 10:44Z, 12:03Z and 17:18Z. Their own totes: 26027 351 live totes, 1,623,541 g, 11:36Z to 14:13Z; 26028 925 totes, 6,656,847 g, 14:13Z to 16:58Z; 26029 57 totes, 425,554 g, 18:00Z to 18:05Z. All three loaded into the Arlington Dry Room (kind silo, space type dry room) by his login on 2026-09-20 with the loads back-dated to the 19th.
2. THE REPAIR OF 0.30.180 (2026-09-22T04:30Z, his ruling then: "in METRC, there is no lot 26028. In reality, the sum of weights in 27 and 28 are stored under 27"): one correction tote of 6,656,847 g on lot 26027 (the lot header 1,623,541 to 8,280,388 g, the born package with it), 26028's 744 plant tags to 26027 (1,158), and 26028 voided whole (its 925 totes still attached). That repair is the "26028 got combined with 26027" the crew describes; the app did it because METRC had.
3. THE DRY WEIGHTS of 2026-09-29: the pile labeled 26027 dried to 302,510 g in 18 rows (21:23Z to 21:26Z), 18.6 percent of 26027's own 1,623,541 g; the unload finished 21:33Z (silo plan: the born package `35db349f` to the dry total at ARL BARN, the choice queue_adjust). The pile labeled 26029 dried to 1,244,555 g in 450 live rows (3 voided) over 9/28 and 9/29, which is 17.6 percent of 26028 and 26029 together (7,082,401 g) and 292 percent of 26029 alone; its unload finished 21:22Z over-issued by 819,001 g (the choice queue_adjust, the born package `4c3ef27e` to 1,244,555 g at ARL BARN), then the crew demoted the lot back to drying at 21:36Z, which flips the status and nothing else, and opened a second session `5ae27b1b`, unfinished. No trim schedule, no wip package, no upload row on any of the three.
4. THE READING: the crew's story and the arithmetic agree. The pile weighed as 26029 is 26028's plants and 26029's dried together; METRC holds 26028's plants under harvest 26027 (8,280,388 g wet). The app cannot move plants between METRC harvests, so the records follow the plants as METRC holds them, and the fix is a repair file for his keyboard in the lane of 0.30.180. Its shape turns on one fact only he can see: whether METRC has a harvest 26029 at all (under GR-C-002600, 425,554 g, its plants).

## The two files (the worktree's `app/scripts/repairs/`, tracked with the next commit)

SHAPE A, `2026-09-30_dry_room_26029_split.sql` (16,134 bytes, `0a9bdf949cb6c948`, 16 statements), METRC has a harvest 26029: the pile's 1,244,555 g split pro rata by wet weight, 26028's share 1,169,775 g (6,656,847 over 7,082,401) to lot 26027 as 419 of the 450 dry rows (an exact subset, moved with their session to 26027's finished session), 26029's share 74,780 g staying as the 31 rows; lot 26027 dry 302,510 to 1,472,285 g (17.8 percent of 8,280,388) and its born package with it; lot 26029 dry 1,244,555 to 74,780 g (17.6 percent of 425,554), back to unloaded (the finish of 21:22Z standing with the corrected figures) and its born package to 74,780 g; the session opened after the demote voided so the session of 21:22Z (queue_adjust) pends the file. Each born package takes the repair's log row and one more `inv_unload_adjust` row a second later carrying the whole corrected adjustment from the wet package (26027: 8,280,388 to 1,472,285, minus 6,808,103 g; 26029: 425,554 to 74,780, minus 350,774 g), because the package_adjustments file reads the newest such row. The physical pile labeled 26029 is then trimmed as lot 26027 except 74,780 g set aside as 26029.

SHAPE B, `2026-09-30_dry_room_26029_into_26027.sql` (18,488 bytes, `a2a1bc6f4526979d`, 20 statements), METRC has no harvest 26029: 26029 voided the way 26028 was (the born package, the ended load, both unload sessions, the lot, the HBN, soft voids with the reason; the 57 totes and the 3 voided dry rows attached; serial 26029 stays used); all 450 dry rows to lot 26027 and its session; lot 26027 dry 302,510 to 1,547,065 g (18.7 percent of 8,280,388) and its born package with it, the corrected adjust row 8,280,388 to 1,547,065 (minus 6,733,323 g). 26027's wet stays METRC's figure; the 425,554 g weighed as 26029 has no METRC home, which is his call outside the app. The whole pile is trimmed as lot 26027.

Both: actor his login, the fixed stamp 2026-09-30T02:30:00.000Z (the adjust rows at 02:30:01), every statement guarded on the value it expects, every log row NOT EXISTS guarded, deterministic ids, soft voids only, no created_at edited, ASCII only, no double quote, percent sign or dash; the apply script's own splitter read 16 and 20 statements on his machine in a dry run.

## The rehearsal

A database built from zero with the 81 migrations of main's tree (`24680a74c2c9b5d0`) and the snapshot's 17 tables of the harvest side (38,024 totes, 1,973 dry rows, 70 lots, 2,274 inventory items, 37,145 plant tags), the change log seeded with the two finishes' `inv_unload_adjust` and `reconcile_choice` rows the pending list reads. Each file twice on a pristine copy, with the apply script's splitting rules ported:

- Shape A, run 1: 16 statements, changes 419 then 1 fifteen times (434); verify 20 checks all pass (lot 26027 dry 1,472,285 over 437 rows on one session, the package 1,472,285 at ARL BARN, the newest adjust row 8,280,388 to 1,472,285; lot 26029 dry 74,780 over 31 rows, unloaded, live, the package 74,780, the adjust row 425,554 to 74,780; the session of 21:22Z standing, the later one voided; the HBN and the load standing; the 57 totes at 425,554 g); the pending package_adjustments files read minus 6,808,103 g for 26027 and minus 350,774 g for 26029. Run 2: 16 statements, 0 changes, the state hash unchanged (`874838a1cf8098b6`).
- Shape B, run 1: 20 statements, changes 450 then 1 nineteen times (469); verify 16 checks all pass (lot 26027 dry 1,547,065 over 468 rows, the package 1,547,065, the adjust row 8,280,388 to 1,547,065; 26029's lot, HBN, package, load and both sessions voided; no live dry row on 26029; the 57 totes attached); the pending file reads minus 6,733,323 g for 26027 alone. Run 2: 20 statements, 0 changes, the state hash unchanged (`20536863a9ef4e32`).

Expected on the remote: the first statement changes=419 (A) or 450 (B), every other statement changes=1 on a first run; a changes=0 on a first run means a live row moved since the snapshot, stop and tell the Scribe.

## His hands (one shape, on his METRC answer)

The pre snapshot from the main folder's app with the guard; the repair from the worktree's app (the file lives there and rides with the next commit; the apply script reads the same wrangler.toml); the post snapshot from the main folder's app.

Shape A (METRC has a harvest 26029):

```powershell
cd "C:\Users\DennisWallace\Documents\Claude\Projects\gripfactory Practical\app"
node scripts/db-snapshot.mjs pre_dry_room_26029
if ($LASTEXITCODE -ne 0) { throw "snapshot failed, stop here" }
cd "C:\Users\DennisWallace\Documents\Claude\Projects\gripfactory Practical\branches\GFLiteOpsDashboard\app"
node scripts/repair-apply.mjs scripts/repairs/2026-09-30_dry_room_26029_split.sql
cd "C:\Users\DennisWallace\Documents\Claude\Projects\gripfactory Practical\app"
node scripts/db-snapshot.mjs post_dry_room_26029
```

Shape B (METRC has no harvest 26029):

```powershell
cd "C:\Users\DennisWallace\Documents\Claude\Projects\gripfactory Practical\app"
node scripts/db-snapshot.mjs pre_dry_room_26029
if ($LASTEXITCODE -ne 0) { throw "snapshot failed, stop here" }
cd "C:\Users\DennisWallace\Documents\Claude\Projects\gripfactory Practical\branches\GFLiteOpsDashboard\app"
node scripts/repair-apply.mjs scripts/repairs/2026-09-30_dry_room_26029_into_26027.sql
cd "C:\Users\DennisWallace\Documents\Claude\Projects\gripfactory Practical\app"
node scripts/db-snapshot.mjs post_dry_room_26029
```

If the snapshot answers 7403 on its first query, run the snapshot line alone once more and then the rest. His paste back: the snapshot's last line and the apply's lines (one per statement with its changes). The crew then: nothing to redo on the unloads (both lots stand unloaded); the pile labeled 26029 trims as lot 26027 (Shape A: 74,780 g of it set aside as 26029); the Pending Data Uploads offer the package_adjustments files with the corrected figures. METRC beyond the files is his hands: under Shape B the plants weighed as 26029 have no harvest there.

If instead he wants METRC restructured the way the crew intended (26028 restored, 26029 folded into it), that is a state-side correction outside the app, and the app repair would be a different file written after it lands; the two files above are not run in that case.

## Observations for a later slice (no part of the repair)

- A demote of an unloaded lot flips the status alone: the born package keeps the dry total, the finished session keeps its choice, the load stays ended. The crew's demote of 21:36Z left 26029 half unloaded; a lot demote that also voids the finished session and returns the package to the dry room would make Demote the undo it reads as.
- The package_adjustments file reads only the newest `inv_unload_adjust` row on the born package, so a second finish, or any later qty change, changes what METRC is told; the repair works with that by writing the corrected whole row last. A file that reads the wet package against the current qty would not depend on the row order.
- The `-819,001 g remaining` the crew saw is the station's Remaining (wet less the dry rows) doing its job; the gate's "METRC needs this addressed now" was the right word.
