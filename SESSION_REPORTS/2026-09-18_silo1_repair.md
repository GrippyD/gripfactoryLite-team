# 2026-09-18 The Silo 1 Repair (canon 0.30.118)

Scribe sitting; a record repair under the 0.30.91 law, applied at his keyboard and verified on the post snapshot. Owner report 2026-09-17, verbatim, with the Silo 1 card (PAUSED, Lot 26024, 0d 06:16:19 Paused, Wet 0.00 lb 1.00 g):

"Can you remove this lot from the silo?  I think I stranded it by deleting its record in data queue"

His picks at the forks: void the whole trail; the law going forward is Take the load with it (built as THE VOIDED LOT LEAVES ITS SILO, 0.30.116, LIVE on worker 7488c91d as 0.30.117); void the test HBN too.

## The record

The pre snapshot `db_backups/20260917-180613_pre_silo1_26024` (51 tables, 228,847 rows, dumped 2026-09-17T22:06:15Z). What it shows, Eastern, all under his login: 11:17:36 AM HBN 26260-PNN-OD-009-0-01-26024 (id 7616f928) minted at PNN with the tag TEST00000000000000000001, market strain TEST, planned Silo 1, license 832; 11:18:03 lot dbad2002 started on it (team lead dennis, bucked, Move To Silo 1); 11:18:24 finished at 1 g (one tote 77197cfe, one plant), the born package 8906b6e0 (WIP, code 26024, 1 g) at BARN; 11:23:45 Load Silo into Silo 1 (load dfc5e7c5, the package moved BARN to Silo 1); 11:24:06 the lot voided in Data Queues with the reason TEST, which under 0.30.115 voided the lot row alone and left the open load holding Silo 1 and the package live on the ledger; 5:40:04 PM the orphan's clock paused. Nothing else points at the lot or the HBN: no metrc_uploads row, no unload session, no dry weight, no schedule, no wip package, no plant tag. The HBN stood open with no live lot.

## The repair

`app/scripts/repairs/2026-09-17_silo1_26024.sql` (6,368 bytes, sha256 6911b1efe8b003d7adff036ac4e43f9487fede49bf235740b18d1ffb8c13d4dc), generated from the snapshot with deterministic ids (uuid from sha256 of "gripfactory-repair-silo1-26024:" + seed), actor his login (7b59cf6b), one reason prefix "repair 2026-09-17 (canon 0.30.118), the TEST HBN 26024 stranded in Silo 1: ", a fixed stamp 2026-09-18T13:00:00.000Z (9:00 AM Eastern), every UPDATE guarded by the values it expects and every log insert by NOT EXISTS on record, field and reason. Three acts: A the load dfc5e7c5 voided (deleted_at, deleted_by, delete_reason); B the package 8906b6e0 voided; C the HBN 7616f928 voided (harvest_batches has no delete_reason column; the log row carries it), guarded on no live lot. Untouched on purpose: his void of the lot with its reason TEST, the 1 g tote and the create and finish log rows, kept for the record; every other HBN, lot, load and package.

Rehearsal in the sandbox: a local D1 built from zero with the 59 migrations, the pre snapshot's 49 tables (119,169 rows; the two METRC mirrors left out) loaded into the sqlite file, the repair applied (3 rows voided, 3 log rows, 102,738 total), applied a second time as a no-op (still 102,738), and a dev server on the repaired copy: Silo 1 empty on the strip and live.json, no 26024 in the wet pane, Data Queues, Load Silo, Unload Dry Space, the Inventory by Location CSV or Pending Data Uploads, the three repair rows on /log. The server was killed and the persist directory removed.

## The import wall and the new lane

His first apply, `npx wrangler d1 execute ... --remote --file`, answered "A request to the Cloudflare API (.../d1/database/29c59313.../import) failed. Authentication error [code: 10000]". Wrangler's `--file` with `--remote` always runs through the D1 import service (init, upload to R2, poll); the OAuth login reaches /query but not that endpoint today (as `d1 export` already did not, MEMORY 2026-09-06; on 2026-09-16 the same lane happened to let the 0.30.91 repair through). Wrangler's own note held: nothing was applied, and his 08:32 snapshot (`20260918-083238_post_silo1_26024`, a second pre snapshot in fact) showed the three rows standing as the guards expect and no repair rows in the log.

`app/scripts/repair-apply.mjs` (5,860 bytes, sha256 918659668b194413) is the lane that skips the import API: it reads a repair file, drops the comment lines, splits on the semicolons outside single-quoted strings, refuses a double quote or a percent sign (cmd.exe carries each statement as one double-quoted argument), and runs the statements one at a time through `--command`, the /query lane the snapshots ride, printing each statement's changes and rows_written from the remote meta (the local miniflare meta carries only a duration and reads n/a). `--dry-run` prints the statements; `--local <persist-dir>` runs them against a local D1 for rehearsal. The rehearsal was repeated through this exact script (both runs, verified) before he ran it.

## Applied and verified

Applied 8:40 AM Eastern by `node scripts/repair-apply.mjs scripts/repairs/2026-09-17_silo1_26024.sql`: six statements ok, changes=1 each, rows_written 1 on each UPDATE and 4 on each log insert (the row and its indexes), total changes 6, rows_written 15.

Post snapshot `db_backups/20260918-084110_post_silo1_26024` (51 tables, 230,590 rows, dumped 2026-09-18T12:41:12Z). Against the 08:32 snapshot (230,587 rows) the only differences in the database are the repair's: harvest_batches one row changed (7616f928), local_inventory_items one row changed (8906b6e0), silo_loads one row changed (dfc5e7c5), record_change_log three rows added (the three repair rows, ids a8839962, 7379344a, f0782c35, all under 7b59cf6b at the fixed stamp). End state: the load, the package and the HBN carry deleted_at 2026-09-18T13:00:00.000Z and his login, the load and the package the reason; the lot stands voided as he left it (drying, 1 g, deleted 2026-09-17T15:24:06Z) with its tote; Silo 1 has no open load and no live package; the only open load on the floor is the freezer's (lot 5c0a1657); 11 live HBNs; MAX(lot_serial) for 2026 is 24, so the next HBN mints as 26025.

Between the pre snapshot of the 17th and the 08:32 snapshot the crew's own day moved the floor (dry_weights 417 to 422, local_inventory_items 250 to 308, production_schedules 35 to 36, wip_packages 236 to 294, record_change_log 102,735 to 104,353; Silo 2's lot 01ded397 unloaded): none of it touched the three rows, and the guards held.

## Sealed final check

```
pre snapshot   20260917-180613_pre_silo1_26024    51 tables  228847 rows  dumped 2026-09-17T22:06:15Z
pre snapshot 2 20260918-083238_post_silo1_26024   51 tables  230587 rows  dumped 2026-09-18T12:32:40Z  (the failed --file apply changed nothing)
post snapshot  20260918-084110_post_silo1_26024   51 tables  230590 rows  dumped 2026-09-18T12:41:12Z

scripts/repairs/2026-09-17_silo1_26024.sql   6368  6911b1efe8b003d7adff036ac4e43f9487fede49bf235740b18d1ffb8c13d4dc
scripts/repair-apply.mjs                     5860  918659668b194413
node --check scripts/repair-apply.mjs        ok
rehearsal (local D1 from the pre snapshot)   run 1: 3 rows voided, 3 log rows; run 2: no change; VERIFY OK, both through repair-apply.mjs
remote apply                                 6 statements, changes=6, rows_written=15
post vs 08:32                                harvest_batches 1 changed, local_inventory_items 1 changed, silo_loads 1 changed, record_change_log +3; nothing else
repair log rows                              3 (rehearsal 3)
dash audit: 0 on both files above
```
