# 2026-09-23 The gate on the Harvest Details import (canon 0.30.210)

Scribe session. The gate on his Code session's `SESSION_REPORTS/2026-09-23_harvest_details_import.md` (brief I, THE HARVEST DETAILS IMPORT, THE TWO BOOKS OF RECORD, canon 0.30.205; migration 0074). The report says "Not deployed from this session"; nothing was deployed before this gate. No Scribe change to `app/`.

## What was gated

1. The tree was hashed on the device after the build session went quiet (the last file under `app/` moved at 20:47 device time, the report at 20:55) and compared with the Scribe's sandbox, which held the tree of canon 0.30.208 (the plume as deployed, e773eaf0cd15478a) byte for byte. Fourteen files differed, exactly the fourteen of the report's seal, one of them new (`migrations/0074_harvest_sheet_rows.sql`); the 192 others hash identical on both sides (the unchanged part of both lists at 41d10bd69db50b12). After the copy the two trees hash identical (3be643153fd23b53, 206 files). The migration head is 0074.
2. The fourteen were staged, verified against the seal (size and sha256, all fourteen), copied into the sandbox and verified again there.
3. Read against the brief's nine laws. THE TWO BOOKS: the string follows METRC, every other fact the sheet, each change logged. THE TAB RIDES THE SYNC: `runSheetSync` reads the tab named by `sheet_harvest_tab` from the same bytes, columns by row-4 header text, rows from 7, cached values, date serials to ISO, text or error cells null; rows land in `harvest_sheet_rows` keyed by `sheet_hbn` and tag; `sheet_sync_runs` carries four harvest counts. THE HISTORICAL LOTS: a lot the app lacks mints from the sheet (date, farm, grow method by word checked against the segment, strain by name, market strain through `inheritMarketStrain`, manicure, the first tag, serial and year from the seventh segment, `planned_dryspc` from the sixth, the farm's grow license, open, `born_from` sheet, logged under `harvest details (sync)`), METRC's text winning the string for the same year and serial; the refusals as briefed and one more the brief did not name (two METRC names for one serial, both different from the sheet: the row is skipped and both listed). THE RECONCILIATION: market strain (a filled cell), manicure (Yes or No), a blank tag filled, one log row each; the HBN follows METRC's text (logged `HBN follows METRC (0.30.203)`), refused when a pending wet-weights file or a pending unload upload would be left under the old name; the app-minted date, farm, grow method and strain never written, a disagreement named. THE ADOPTION finds the lot known and mints nothing. THE UPLOAD: `.xlsm` up to 8 MB lands both tabs as one run with trigger `upload` and the flash; `.xlsx` queues. THE FIXTURE gains a synthetic tab. THE WORDS in Spanish. NOTHING ELSE MOVES: `db.ts`, `console.ts`, `prepack.ts`, `scheduling.ts`, `metrc.ts`, `mint.ts`, `theme.ts` did not move. The report's HBN-text list names six tables and says which follow the rename (`harvest_batches.hbn`, `internal_test_results.hbn`) and which keep their own words (`harvest_sheet_rows.sheet_hbn`, `external_test_results.hbn`, `metrc_packages.source_harvests`, the change log).
4. THE LANDING, READ IN THE DATABASE. The smoke's local D1 after the walk: three `harvest_sheet_rows` (rows 7, 8 and 9 of the fixture tab; the fourth skipped for `No Such Herb`); two sheet-born batches, `45999-PNN-ID-027-1-NA-26080` (METRC's text, where the sheet wrote `46258-PNN-ID-027-0-NA-26080`, kept on the row; 2026-08-24, Fruity Pebbles, market strain Sheet Apple, manicure 0, tag ...E80, serial 80 of 2026, license AU-G-C-000832, open, born from sheet) and `46259-PNN-GH-001-0-NA-26081` (After Party, its own name as market strain, manicure 1); the app-minted `26244-ARL-GH-027-0-NA-26010` with its market strain Fruity Pebbles replaced by the sheet's Smoke Cream and the log row carrying the old value; 33 log rows under `harvest details (sync)`, all on `harvest_batches`; the upload run's message `46258-PNN-ID-027-0-NA-26080 is not 45999-PNN-ID-027-1-NA-26080; the HBN stays | 46260-PNN-OD-078-0-NA-26082 skipped: no live strain named No Such Herb` with the counts 4 seen, 0 landed, 0 changed, 1 skipped on the second pass; the stranger `...E80` adopted (released, source metrc) onto the sheet-born lot and scheduled; `sheet_harvest_tab` seeded `Harvest Details`; `smoke-harvest.xlsx` queued in Import Data; the two sheet-born batches standing open with no lot beside the app's own, the two METRC-born ones beside them (excluded by their own rule).

## Gates on the tree as received (the Scribe's sandbox)

- `npx tsc --noEmit`: exit 0.
- `npx vitest run`: 49 files, 857 tests passed; the same under `TZ=America/New_York`.
- `node --check scripts/smoke.mjs`: ok.
- From-zero smoke (`SMOKE_PORT=9094`, the DROPS copy of the In Testing workbook present): `About to apply 74 migration(s)`, `SMOKE PASS`, no 500; exit 0 once the dev server was ended by pid.
- Dash audit: 0 on the fourteen files and the build report.
- Secret grep (`METRC_INTEGRATOR_KEY = "`, `METRC_USER_KEY = "`, `MS_CLIENT_SECRET = "`, `cfas[t]_`): no matches in the slice.
- Migration 0074 read: a new table with its key and index, four ALTER TABLE ADD COLUMN on `sheet_sync_runs`, one `INSERT OR IGNORE` seed; nothing before it touched.

## His word: the eleven assumptions

All eleven stand as the brief asked, read against the code and the database. Three to look at when the workbook lands on the floor:

- A sheet-born batch stands open with no lot in the HBN Queue and on the wet weight pick. The nine historical lots will stand there until their weights come or he closes them; the brief chose that over hiding them.
- The sheet's market strain replaces the app's whenever the cell is filled, including one a person typed in the app. The ten batches named in 0.30.203 will take the sheet's names on the first landing; a typed name the sheet does not hold is left alone.
- Two Harvest Details rows on one lot (26007 has two tags) land both, and the batch takes the first row's tag.

## Deploy (his hands; the three-step block, 0074 rides)

```powershell
cd "C:\Users\DennisWallace\Documents\Claude\Projects\gripfactory Practical\app"
npx wrangler d1 execute gripfactory-lite-grip-20260914 --env grip --remote --command "SELECT 1"
npx wrangler d1 migrations apply gripfactory-lite-grip-20260914 --env grip --remote
npm run deploy:grip
```

0074 creates `harvest_sheet_rows` and adds four columns the sync writes, so the apply runs before the deploy as always. THE PROBE: the Sheet Sync page (`/admin/sheet-sync`) rendering its harvest columns proves the apply landed; an error there means the deploy went alone and the idempotent apply line is the whole repair. After LIVE, his hands: upload `26H.Operations Dashboard .xlsm` on Import Data and read the count line; then the four held strangers take their `>>` as known lots.

## Sealed final check

```
npx tsc --noEmit                      exit 0
npx vitest run                        49 files, 857 tests passed
TZ=America/New_York npx vitest run    49 files, 857 tests passed
node --check scripts/smoke.mjs        ok
rm -rf .smoke-persist && CI=1 SMOKE_PORT=9094 WRANGLER_SEND_METRICS=false npm run smoke
                                      About to apply 74 migration(s); SMOKE PASS; " 500 " lines: 0; exit 0
the build session's seal (14 files) verified byte for byte on the device and in the sandbox:
migrations/0074_harvest_sheet_rows.sql          1855  ddff0240560cec93
src/config.ts                                  66042  5e819837d427e31f
src/sheetsync.ts                               79460  fd2b9cf20caa214f
src/imports.ts                                  4309  e7fccbb01f7580f5
src/actions.ts                                283331  9365fcbda6853dbc
src/index.ts                                  133150  4d977634195e4e9e
src/i18n.ts                                   161351  d4771dbdf23e88bf
src/html.ts                                   179250  617cf4a5c632726c
test/sheetsync.test.ts                         31689  7d4a0afab5cab016
test/imports.test.ts                           14137  5c144caf40cff56e
test/metrc.test.ts                             63936  3ceffc3bfa64bbd6
test/console.test.ts                           56624  f96c5d7ba15f6763
test/surface.test.ts                           79387  b9adf7d2a90c1c75
scripts/smoke.mjs                             570943  003d9600f30dbd53
tree hash after the copy, device and sandbox: 3be643153fd23b53 (206 files)
the build report: SESSION_REPORTS/2026-09-23_harvest_details_import.md  11007  4539940bcbda1081
dash audit: 0 on every file above
secret grep: no matches
```
