# 2026-09-22 The two repairs of lots 26027 to 26035, written and rehearsed (canon 0.30.180)

Scribe session, two Agent subagents under the Scribe's gate, THE REPAIR LANE (canon 0.30.91 as amended by 0.30.118). Two production data repairs written for the owner's hands, rehearsed twice on a local D1 built from the pre snapshot, NOT YET APPLIED. No code change to the worker; LIVE stands at 472c43ee (0.30.179), migrations 0001-0068. The tree under `app/` was quiet the whole time (nothing moved since the Part 2 gate report of 02:42; Part 2b had not started); the only files this session adds under `app/` are the two repair files.

## The owner's words (2026-09-22, verbatim)

"Two fixes, two new agents: 1. Arlington Dry Room has three lots in it, but in METRC, there is no lot 26028. In reality, the sum of weights in 27 and 28 are stored under 27. And 28 is defunct. Add an agent to wipe out the errant 28 and add its weight to 27. 2. Employ another agent to help me do some Lot maintenance the picture shows what's currently going on in the system. Some wires got crossed and the reality is what the spreadsheet shows. Can you help me correct the ship? They can all be in a loading state at the end, I'll check the time board and load them when the weights and lot numbers are correct"

His spreadsheet, the record (HBN, grams, Silo): `26264-ARL-OD-009-0-NA-26030` 6843405.52 Silo 1; `26264-ARL-OD-009-0-02-26031` 7140894.36 Silo 2; `26264-ARL-OD-009-0-NA-26032` 7062662.91 Silo 3; `26264-ARL-OD-009-0-03-26033` 7219875.21 Silo 4; `26264-ARL-OD-009-0-04-26034` 5308488.23 Silo 5. Lot 26035 is not on the sheet.

His picks on the question tool: lot 26035 "Void it" (the crossed wire; lot, born package and HBN voided with the reason, serial 26035 stays used); the downward fix on 26034 "Header only" (weight_grams and the born package to 5,308,488 g, the tote rows left as weighed); 26028's 744 plant tags "Move them to 26027"; 26035's 1,016 plant tags "Leave them on the voided 26035".

## The pre snapshot

`db_backups/20260921-234510_pre_lots_27_35` (his hands, `node scripts/db-snapshot.mjs pre_lots_27_35`, dumped 2026-09-22T03:45:12Z; the first run died on a 7403 at the first query and left an empty `20260921-233857_pre_lots_27_35` folder; the re-run went through): 60 tables, 355,632 rows, no errors. The 58 non-mirror tables (245,745 rows) were staged, copied into the sandbox and loaded into a local D1 built from zero with the 68 migrations (the two METRC mirrors left out).

What it shows for serials 27 to 35 (all HBNs `open`, market strain Bermuda Triangle, farm ARL, minted by the same crew login):

| serial | HBN | lot (weight, space) | born package | loads / tags |
|---|---|---|---|---|
| 26027 | bdfa8533 `26262-ARL-OD-009-0-NA-26027` | 505edf53, 1,623,541 g (351 live totes, one voided 4,132 g), Arlington Dry Room | 35db349f SPR 1,623,541 g | load 39a07773 running since 2026-09-19T12:00Z; 414 tags |
| 26028 | 9cbbfd71 `26262-ARL-OD-009-0-NA-26028` | 705c259f, 6,656,847 g (925 totes, weighed 14:13Z to 16:58Z on the 19th, the minute 26027's ended), dry room | 7e26c19a SPR 6,656,847 g | load ede97313 running since 15:00Z; 744 tags, none shared with 26027 |
| 26029 | d036793f `26262-ARL-ID-009-0-NA-26029` | 345bdebf, 425,554 g, dry room | 4c3ef27e | load 5c295d49; untouched |
| 26030 | 4905db39, planned NA | b79adf08, 5,416,395 g, Silo 1 (actual_dryspc) | 7fea6b0b WIP at BARN | no load; wet weights file uploaded 13:29Z |
| 26031 | 37af7154, planned 2 | 4bd56a7d, 5,711,383 g, Silo 2 | 9242f605 | no load; uploaded 15:39Z; an unfinished unload session 926fa4a9 |
| 26032 | 2d7ace18, planned empty | 6375fee0, 5,812,835 g, Silo 2 (the crossed wire) | ebf6ecd1 | no load |
| 26033 | 20576a39, planned 3 | 0cd2e062, 5,697,785 g, Silo 3 | 9f32f7fd | no load; uploaded 19:54Z |
| 26034 | 820d81bc, planned 4 | 2f9a1075, 5,628,440 g, Silo 4 | dc34b1d7 | no load |
| 26035 | c455af1a `26264-ARL-OD-009-0-05-26035`, planned 5 | 152e4fdc, 5,313,405 g, Silo 5 (748 totes) | 7a527493 | no load; 1,016 tags |

The dry room's Wet total 1,623,541 + 6,656,847 + 425,554 = 8,705,942 g, the screen's figure. The silo lots wait to load because each lot's `actual_dryspc` IS the silo (the strip's `listSiloLotGrams` puts a finished lot with no open load on the silo its own space names).

## The two files (agent A the dry room, agent B the silos; the Scribe read every line)

### `app/scripts/repairs/2026-09-22_dry_room_26028_into_26027.sql` (15,331 bytes, sha256 b411e8949fcf3273e601c228fe984d7df2b4236afd5a56419e9be3c5a421444c, 16 statements)

- A. 26027 takes 26028's weight: one correction tote (wet_weights 150d324e, 6,656,847 g) on lot 505edf53; the lot header 1,623,541 to 8,280,388; the born package 35db349f 1,623,541 to 8,280,388.
- B. 26028's 744 live plant tags move to HBN 26027 in one statement (guarded on the destination HBN being live and named); one log row records the move on the HBN they leave. 26027 reads 1,158 plants at 8,280,388 g.
- C. 26028 voided, the whole trail: the open load ede97313 (with delete_reason), the born package 7e26c19a (with delete_reason), the lot 705c259f, the HBN 9cbbfd71 (serial 26028 stays used). The 925 tote rows stay attached to the voided lot for the record.
- Expected remote effect: 751 rows updated or inserted (1 tote inserted, 750 updated, 744 of them the plant tags in one statement), 8 log rows; a second run 0 and 0. The room's Wet total stays 8,705,942 g; its lot count drops from three to two.

### `app/scripts/repairs/2026-09-22_silos_26030_26034.sql` (36,575 bytes, sha256 b2295d1cb78240096205a7e0c95f2aab3cf7cdc3c91db018441b1caf06040a90, 48 statements)

- A to D, 26030 to 26033: one correction tote each (1,427,011; 1,429,511; 1,249,828; 1,522,090 g) so the totes sum to the header; the header and the born package to the sheet's whole grams (6,843,406; 7,140,894; 7,062,663; 7,219,875); 26032 moves Silo 2 to Silo 3 and 26033 Silo 3 to Silo 4 (`actual_dryspc`); the HBN's `planned_dryspc` follows the sheet where it disagreed (26030 NA to 1, 26032 empty to 3, 26033 3 to 4; 26031's 2 already agreed).
- E, 26034: header only, his pick: the header and the born package 5,628,440 to 5,308,488 (the 740 totes left as weighed); Silo 4 to Silo 5; planned 4 to 5.
- F, 26035 voided, the whole trail: the born package 7a527493 (with delete_reason), the lot 152e4fdc (guarded on no open load), the HBN c455af1a (guarded on no live lot; serial 26035 stays used). Its 748 totes and 1,016 plant tags stay attached for the record.
- Expected remote effect: 24 rows updated or inserted (4 totes inserted, 20 updates across 17 rows), 24 log rows; a second run 0 and 0.

Both files: actor 7b59cf6b (the owner's login), stamp 2026-09-22T04:30:00.000Z, every change guarded on the value it expects, every log row guarded by NOT EXISTS, deterministic ids, no hard delete, no created_at edited, no double quote, no percent sign, no dash, ASCII only; `node scripts/repair-apply.mjs <file> --dry-run` prints 16 and 48 statements, the longest 1,084 characters.

## The rehearsal (the Scribe's own, on the pristine local D1 with both files, after each agent's own two runs on its own copy)

- Pre state verified against the snapshot (the six silo lots at their grams, 26027 and 26028 live, 0 repair log rows).
- Run 1: the dry room file then the silos file, 16 and 48 statements ok. The Scribe's `verify_combined.py`: 78 checks ok, VERIFY OK; state hash 5f8054c504d7e8aa over nine tables; wet_weights 15,430 to 15,435, record_change_log 214,183 to 214,215 (32 repair rows), harvest_plant_tags and local_inventory_items counts unchanged.
- Run 2: both files again, 64 statements ok; 78 checks ok; the same state hash 5f8054c504d7e8aa and the same counts: a second run changes nothing.
- A dev server on the repaired copy (`wrangler dev --persist-to .repair-persist --port 9076`, no 500): the Harvest Console's drying row reads Silo 1 loading `Lot 26030 waiting to load Wet 15,275.46 lb · 6,843,406 g`; Silo 2 `Lot 26031 ... 15,939.50 lb · 7,140,894 g`; Silo 3 `Lot 26032 ... 15,764.87 lb · 7,062,663 g`; Silo 4 `Lot 26033 ... 16,115.79 lb · 7,219,875 g`; Silo 5 `Lot 26034 ... 11,849.30 lb · 5,308,488 g`; Arlington Dry Room drying `Lot 26029 ... Running Lot 26027 ... Running Wet 19,432.91 lb · 8,705,942 g`; no 26035 and no 26028 anywhere on the page. Load Silo lists the five lots with the corrected grams. The lot record of 26027 reads weight 8,280,388 and 1,158 plants. Pending Data Uploads lists the wet weights files of 26030 to 26034 (re-pended with the corrected grams), 26027 and 26029; 26028's file is gone.

## Apply (his hands, from `app/`; either order, the files share no row; then the post snapshot)

```powershell
cd "C:\Users\DennisWallace\Documents\Claude\Projects\gripfactory Practical\app"
node scripts/repair-apply.mjs scripts/repairs/2026-09-22_dry_room_26028_into_26027.sql
node scripts/repair-apply.mjs scripts/repairs/2026-09-22_silos_26030_26034.sql
node scripts/db-snapshot.mjs post_lots_27_35
```

Expected on the remote meta: the dry room file reports changes=1 on every statement but the tag move (changes=744), 759 in all; the silos file changes=1 on all 48. A statement reporting changes=0 on the first run means the live row moved after the 03:45Z snapshot (a tote, a load, an edit): stop and tell the Scribe before anything else. A 7403 is the blip first (re-run the same command; every statement is guarded), the grant lane second.

## Owner section (assumptions and things to hear; his word owed if wrong)

1. 26034 header only is fragile by the app's own rule: any tote add, edit or void on lot 26034 in the app re-sums the header from its live totes (back to 5,628,440 g) and the born package would not follow. Do not touch 26034's tote rows after the repair; if a tote must change, the header needs a second correction.
2. The METRC wet weights file writes the lot's `updated_at` date as its ActualDate, so the re-pended files of 26030 to 26034 (and 26027's, if regenerated) will carry 2026-09-22, not the weigh day 2026-09-21 (the lots' `effective_date` still reads 2026-09-21). The 0.30.91 repair had the same effect. A small code slice (the CSV reads `effective_date`) would fix it for good; it is not this lane's to make.
3. 26030, 26031 and 26033 were already marked uploaded to METRC (13:29Z, 15:39Z, 19:54Z on the 21st) at the old grams; the repair re-pends their files with the sheet's grams by the app's pending law. What METRC already holds for them is his side to reconcile.
4. Agent B's observation, not acted on: the voided 26035's material (748 totes, 5,313,405 g, 1,016 tags) sits 4,917 g from the sheet's 26034 in Silo 5 (5,308,488 g), while the app's 26034 (740 totes, 5,628,440 g, 657 tags) is 319,952 g over the sheet. The physical Silo 5 material may be what the app weighed as 26035 under the wrong label. His picks stand (void 26035, header only on 26034); the voided trail is fully recoverable (nothing deleted; the log carries old and new) if he later wants 26035's totes to be Silo 5's record instead.
5. The correction totes carry the stamp as created_at, so they sort last in each lot's ledger; 26027's tote ledger reads 351 weighings plus one 6,656,847 g row.
6. 26027's `plant_count` stays NULL; the 1,158 tags carry the plant count (the CSV splits the header over the tags). He can set 1,158 with a reason in the app if the card should show Plants.
7. `planned_dryspc` follows the sheet's silo on 26030, 26032, 26033 and 26034 for the record; the tile itself follows `actual_dryspc`.
8. The unfinished unload session 926fa4a9 on 26031 (opened 2026-09-21T15:45Z at his login) is left alone; it may read as an open unload on 26031 until finished or voided.
9. Serials 26028 and 26035 stay used; the next HBN mints as 26036. 26030's HBN carries 1,286 tag rows of which 643 are live (a re-paste), not judged.
10. Lot 26029 (grow method ID, license GR-C-002600) is untouched though it sits beside the two in the dry room.

## Sealed final check

```
scripts/repairs/2026-09-22_dry_room_26028_into_26027.sql   15331  b411e8949fcf3273e601c228fe984d7df2b4236afd5a56419e9be3c5a421444c
scripts/repairs/2026-09-22_silos_26030_26034.sql            36575  b2295d1cb78240096205a7e0c95f2aab3cf7cdc3c91db018441b1caf06040a90
node scripts/repair-apply.mjs <file> --dry-run       16 statements; 48 statements; exit 0 both
dash audit (LC_ALL=C grep -c em/en dash)             0 and 0
double quotes / percent signs / non-ASCII bytes      0 / 0 / 0 on both
local D1 from zero, 68 migrations, + snapshot 20260921-234510_pre_lots_27_35 (58 tables, 245,745 rows; mirrors out)
run 1 (dry room then silos)                          16 + 48 statements ok; verify_combined 78 ok, VERIFY OK; state 5f8054c504d7e8aa
run 2 (both again)                                   16 + 48 statements ok; verify_combined 78 ok, VERIFY OK; state 5f8054c504d7e8aa (unchanged)
wrangler dev on the repaired copy (port 9076)        /harvest drying row as quoted above; /station/load_silo five lots; " 500 " lines: 0
no code change; tsc / vitest / smoke not re-run (nothing under src, test, scripts/*.mjs or migrations changed)
```

## Applied and verified (2026-09-22, his hands; canon 0.30.181)

- First apply, about 07:47 Eastern: the dry room file took the 7403 flake on its first statement and the script stopped at zero (nothing applied); the silos file ran clean, 48 of 48, changes=1 on every statement, changes=48, rows_written=135. Post snapshot `db_backups/20260922-074934_post_lots_27_35` (11:49:36Z; 60 tables, 362,514 rows, no errors).
- The Scribe read the dry room rows in that snapshot before the re-run: 26027, 26028 and 26029 stood exactly as the pre snapshot had them (headers, packages, the three open loads, updated_at from the 20th), so every guard held. Re-run about 08:00 Eastern: 16 of 16, changes=1 on every statement but the tag move (changes=744, rows_written=1488), changes=759, rows_written=1530. Post snapshot `db_backups/20260922-080023_post_dry_room_26028` (12:00:28Z; 60 tables, 363,280 rows, no errors).
- Verification, pre (03:45Z) against the first post (11:49Z), row by row over the thirteen tables that matter: the silos file's rows and nothing else of the repair's kind moved. harvest_batches: exactly its five (26030, 26032, 26033, 26034 planned_dryspc; 26035 voided) plus the crew's two new HBNs 26036 and 26037 (minted 06:05 and 06:08 Eastern). wet_weight_entries: exactly its six (four headers, the two silo moves inside them, 26035 voided), plus the crew's 26036 lot and one lot of theirs going unloaded to trimmed. wet_weights: its four correction totes plus 678 crew totes on 26036. local_inventory_items: its six plus the crew's trim cuts and pasteurizations (63 changed, 45 added, all stamped by their logins in the morning). record_change_log: its 24 rows, every one by his login at the stamp, plus 6,074 crew rows. silo_loads, harvest_plant_tags, metrc_uploads, unload_sessions, dry_weights: untouched.
- Verification, first post against the second (12:00Z): the dry room file's rows and nothing else of its kind. harvest_batches: 26028 voided (1 row). harvest_plant_tags: exactly 744 rows re-pointed from 26028 to 26027, all at the stamp, no other change; 26027 now carries 1,158 live tags, 26028 none. local_inventory_items: 26027's package 1,623,541 to 8,280,388 and 26028's voided with the reason, plus the crew's born package for 26036. silo_loads: ede97313 voided with the reason; the room's open loads are 26027 and 26029. wet_weight_entries: 26027 header 8,280,388 (352 live totes summing 8,280,388) and 26028 voided, plus the crew finishing 26036 (5,631,470 g, drying, Silo 1). wet_weights: the one 6,656,847 g correction tote plus 76 crew totes. record_change_log: its 8 rows plus 678 crew rows.
- End state on the grip database: the five PNN silos read 26030 on Silo 1 at 6,843,406 g, 26031 on Silo 2 at 7,140,894, 26032 on Silo 3 at 7,062,663, 26033 on Silo 4 at 7,219,875, 26034 on Silo 5 at 5,308,488, every one waiting to load; the crew's 26036 (5,631,470 g) also waits on Silo 1 beside 26030; the Arlington Dry Room holds 26027 at 8,280,388 g and 26029 at 425,554 g, both running, 8,705,942 g in all; 26028 and 26035 are voided whole, serials used; MAX(lot_serial) 2026 is 37, so the next HBN mints as 26038; 22 live HBNs.
- The owner section above stands as the list of his word owed; nothing in the two applies changed it.
