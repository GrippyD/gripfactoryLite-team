# 2026-10-04 The gate on L2, connections and custom label data (canon 0.30.389): PASSED WITH ONE FIX

Scribe session. BRIEF L2 (`BRIEFS/2026-10-04_labels_l2_connections_and_label_data.md`, 7,632 bytes, `872ba026640aaa15`), built by his Code session on the live tree `ea557ac9390d821e`. Its report `SESSION_REPORTS/2026-10-04_labels_l2.md` with six screenshots beside it. His hand-back, verbatim in part: "After this session it is `3902bad82f66d3b5` (292 files, migrations through 0093). Nothing was committed, pushed, or deployed." and "7,856 resolve a harvest date ... 250 resolve a THC percent ... 3,860 resolve neither."

VERDICT: PASSED WITH ONE FIX (Scribe-direct, G-2: `src/labeldata.ts` and its test). The worktree's tree is now `00811dcfb247ec3b`, 292 files.

## What was gated

1. THE MAIN FOLDER: `src`, `test`, `scripts` and `migrations` of the main folder's `app/` equal HEAD `4c6aef1`. Clean for the merge.
2. THE TREE. Staged as `gateL2.tar` (11,735,040 bytes, `e56fb184d78c8e8c`), unpacked; `3902bad82f66d3b5` both sides, 292 files; against the live tree 3 new (`migrations/0093_label_data.sql`, `src/labeldata.ts`, `test/labeldata.test.ts`) and 7 changed. 0093 creates `label_data_tables` only.
3. GATES as received: typecheck 0; 88 files, 1,181 tests UTC and New York; the from-zero smoke `About to apply 93 migration(s)`, SMOKE PASS, no ` 500 `.
4. THE PAGES, driven by the Scribe (Cerberus): a text box dropped, Connections opened from the tool column, the group checkboxes and a saved custom table listed, the field buttons shown (Package tag, Item, Strain, Net weight, Harvest name, Harvest date, HBN and the rest), Preview with package; Custom Label Data's form as the document lists it. No page error.
5. THE COVERAGE, recomputed by the Scribe independently on `db_backups/20261003-221923_pre_l1` (11,716 live mirror packages): 7,856 with a harvest date, the same total as the build.

## The defect (the Scribe's brief, law 2 (c)) and the fix

Reading what those 7,856 dates are showed the rule I wrote was wrong for half the names. METRC's harvest names here come in three shapes:
- 2026: `26267-PNS-OD-009-0-02-26050`: the first segment is two digits of year and three of day of year (2026-09-24), the last the lot token.
- 2024 and 2025: `45922-PNN-OD-071-0-02-25030`: the first segment is a spreadsheet day number (days from 1899-12-30: 45922 is 2025-09-22), the last the lot token (25030, lot 30 of 2025). 51,597 source-harvest entries carry a 2024 lot token and 29,847 a 2025 one.
- Bare lot tokens such as `24089` (lot 89 of 2024) inside a package's source harvest list.

The brief's rule read only the year-and-day shape, on any five digits: so a bare lot token `24089` became 2024-03-29, a `46024-...-26001` became 2046-01-24 (14 packages), and every 2024 and 2025 name was refused. 7,125 packages printed a 2024 date taken from lot numbers, not harvests.

FIXED, `codedHarvestDate` in `src/labeldata.ts` (36,588 bytes, `6be6cfa2c9046c70`): only a harvest name (with dashes) is read, never a bare token; the first segment is read as year and day of year when that falls in the lot token's year or the year before, else as a spreadsheet day number when that does; a year past 2039 is never read as year and day. The test (`test/labeldata.test.ts`, 10,681 bytes, `9423d85ec4953057`) pins 26267 to 2026-09-24, 45922 to 2025-09-22, 45951 to 2025-10-21, 46024 to 2026-01-02, a bare 24089 to nothing, and a name whose lot year disagrees to nothing.

After the fix, recomputed on the same snapshot: 10,521 of 11,716 packages resolve a harvest date (the app's harvest 559, a matched source harvest 156, the coded name 254, the earliest of several 9,552), 1,195 none; the dates fall in 2024 (5,929, now real 2024 harvests by their names), 2025 (3,861) and 2026 (731); none in 2046. Gates after: typecheck 0; 88 files, 1,182 tests UTC and New York; the from-zero smoke at 93 SMOKE PASS, no ` 500 `.

## For his word (no hold)

- POOLED PACKAGES: 9,552 packages draw from several harvests (some from dozens across 2024 and 2025), and law 2 prints the earliest. A shake or pre-roll package pooled from 2024 and 2025 harvests would read a 2024 harvest date. The earliest, the latest, or "Multiple" are all one line to change.
- THC PERCENT reaches 250 of 11,716 packages, because the lab station holds this season's samples (374) and the 2025 results live only in the Post Harvest Puzzles import and the Testing Override workbook. Reading those older results for THC is a next step if he wants older stock labelled with potency.
- Connections' checkboxes sit above their words (cosmetic).

## Sealed final check

```
THE MAIN FOLDER                       src, test, scripts, migrations = HEAD 4c6aef1
THE TREE AS RECEIVED (3902bad82f66d3b5, 292 files; the live tree ea557ac9390d821e)
THE FIX                               src/labeldata.ts 36588 6be6cfa2c9046c70; test/labeldata.test.ts 10681 9423d85ec4953057
THE TREE AFTER THE FIX                00811dcfb247ec3b, 292 files (the worktree, re-hashed on the disk)
npm run typecheck                     exit 0
TZ=UTC npx vitest run                 88 files, 1182 tests passed
TZ=America/New_York npx vitest run    88 files, 1182 tests passed
CI=1 SMOKE_PORT=9438 npm run smoke    About to apply 93 migration(s); SMOKE PASS; " 500 " lines: 0
coverage on 20261003-221923_pre_l1    11,716 live; harvest date 10,521 (was 7,856, 7,125 of them read from lot numbers); THC 250
dash audit (by character): 0; CR audit: 0; personnel data: none
```

## The merge (his hands; migration 0093 by the workflow)

```powershell
cd "C:\Users\DennisWallace\Documents\Claude\Projects\gripfactory Practical\app"
node scripts/db-snapshot.mjs pre_l2
if ($LASTEXITCODE -ne 0) { throw "snapshot failed, stop here" }
cd "C:\Users\DennisWallace\Documents\Claude\Projects\gripfactory Practical\branches\GFLiteOpsDashboard"
git add -A
git commit -m "L2: connections and custom label data" -m "A label's fields bind to the package a tag names: harvest date by the app's harvest, the matched METRC harvest, the date in the harvest name (2026 day of year, 2024 and 2025 spreadsheet day numbers) or the lineage; THC from the newest passed compliance potency. Custom Label Data tables, static or keyed. Migration 0093. Canon 0.30.388 to 0.30.389.`n`nCo-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`nClaude-Session: https://claude.ai/code/session_01VDz7UdaTSkjq69GvDfDWd7"
cd "C:\Users\DennisWallace\Documents\Claude\Projects\gripfactory Practical"
git checkout -- canon
git merge --no-ff GFLiteOpsDashboard -m "Merge L2: connections and custom label data"
git push
```

His paste back: the Version ID.
