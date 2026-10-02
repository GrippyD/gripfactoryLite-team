# 2026-10-02 Testing Override

BRIEF V19, TESTING OVERRIDE (canon 0.30.341), built in the worktree `branches/GFLiteOpsDashboard` under THE DISPATCH RULE (canon 0.30.155), on the app tree this session had just landed for V18 (`941892df1d14406f`, 263 files, migrations 0001 to 0088). The owner said to take 18, then 19, then 20, then 21 on this disk, so this slice did not wait for a merge. The app tree after these edits hashes `d80e0d2d5a477a2e` (264 files). No migration. The smoke pin stays 88. Not deployed. Nothing committed. Nothing pushed. No git was run.

## What changed

- Admin home (`src/html.ts`): a tile Testing Override immediately after Import Data, opening `/admin/testing-override`.
- `src/pages.ts`: the drop pane. One file input `accept=".xlsb"`, the button "Override testing from this sheet", the three lines (what it does, the last run, the two links), and a small script that accepts a drop onto the pane, sets the file, and submits. The last run reads `sheet_sync_runs` where `source` is `in_testing`: Eastern time, the trigger word, seen, landed, changed, skipped. Before any run the line is "Last run: never".
- `src/index.ts`: GET and POST `/admin/testing-override`. The POST result comes back to the pane with the counts line and, when the parser left skip reasons, those reasons in full under "Skipped:".
- `src/actions.ts`: `overrideTesting`. A file that is not `.xlsb` refuses "Drop the In Testing workbook, an .xlsb file." Over the cap refuses with the 8 MB words. Otherwise `applyInTestingBytes(db, buf, "override")`. Import Data still accepts `.xlsb` as it did.
- `src/sheetsync.ts`: `SheetSyncTrigger` gains `override`, so the Sheet sync page prints that word.
- The picture. The Harvest Console stats and pie (`src/console.ts`) and the Compliance FTQ and pareto (`src/biz.ts`) read `external_test_results` with `deleted_at IS NULL AND (source <> 'sheet' OR on_sheet = 1)`, and they leave R&D rows out. Lbs in testing uses the same on-sheet filter and still counts an R&D row that is unfinished. The External tab is unchanged and still lists every row, including "no longer on the sheet".
- R&D has no column on `external_test_results` (no migration in this brief). The parser writes `panel` `rnd` on `test_orders`, and the sheet key starts with the tab name. A quality row is left out when a live desk order on that sheet key has `panel` `rnd`, or when the sheet key starts with the R&D tab name (`in_testing_rnd_tab`, "R&D" until saved) and a bar.
- `sheetInSeason`: the HBN's seventh segment first (`26001` is 2026), else the first segment's two leading digits, else the Entered Testing year. None of the three, the row is out. `46223-ARL-GH-015-0-NA-26001` entered 2026-08-10 is in 2026. The Testing section's details element carries `id="testing"` so `/harvest#testing` lands on it.
- One vocabulary. `outcomeOf` lives in `src/compliance.ts` (passed, pass, passed - retest, remediated; failed, fail; anything else open) and `src/intesting.ts` re-exports it. `ftqRate` uses that list. An open first-time row is out of the denominator. The pareto uses the same list instead of the exact word Failed. The Compliance FTQ is still every season. The console's FTQ is still the harvest year.
- `src/imports.ts`: an `.xlsb` or `.xlsm` over the cap says "That file is over the 8 MB cap." A csv or xlsx over the cap still says 1 MB.
- `src/i18n.ts`: EN and ES for the tile, the pane, the refusals, the last-run lines, the links, the skip line, and the trigger word override.
- `scripts/smoke.mjs`: pin stays 88. GET `/admin` carries the tile beside Import Data. GET `/admin/testing-override` says "Last run: never" and carries the two links and the drop script. POST of a `.csv` refuses in the words above. An `.xlsm` and an `.xlsb` over 8,000,000 bytes refuse with the 8 MB words. When `DROPS/In Testing (2026).xlsb` is on the disk, the smoke posts it to the override and checks the counts line, any skip reasons, `first_tests` above zero, the pie or the empty fail words, and the Compliance FTQ tile. On this disk the workbook was absent, so the smoke said so and skipped, as it does today. Import Data's own fixture `.xlsb` is unchanged.
- `test/testingoverride.test.ts` (new): the pane; a csv refusal; `ftqRate` on "Passed - Retest", "fail", and an open row; `sheetInSeason` by the lot token, the first segment, and the date; the picture keeps a manual row and a sheet row that is on the sheet, and leaves out an `on_sheet` 0 row, an `R&D|` sheet key, and a desk order whose panel is `rnd`.
- `test/testinggate.test.ts`: the season case now leads with the seventh segment. `test/imports.test.ts`: the over-cap words are 8 MB. `test/console.test.ts`: the Testing section tag includes `id="testing"`.

## Assumptions for his word

- "Override" is the sheet as the picture. A sheet row the latest drop no longer carries leaves the stats, the pie, the Compliance FTQ, the pareto, and the pounds in testing, and stays in the table, marked. A manual row keeps counting. Say if the override should wipe manual rows, or if a dropped row should keep counting.
- R&D rows leave the quality figures (console stats and pie, Compliance FTQ and pareto). They can still add to pounds in testing when unfinished. Say if they should count in the quality figures, or leave the pounds too.
- The drop pane accepts only `.xlsb`. The Operations workbook (`.xlsm`) still goes through Import Data.
- The hourly Graph pull is untouched.
- The four panes are not the sheet's. The drop changes the stats and the pie, not the panes.
- There is no `panel` column on `external_test_results`, and this brief has no migration, so the quality queries read the desk order's `panel` and the sheet key's tab prefix. A skipped R&D row with no desk order is still left out when its sheet key starts with the configured R&D tab name.

## Gates

Run in the worktree's `app/`.

- `npm run typecheck`: exit 0.
- `npx vitest run`: 77 files, 1051 tests passed under `TZ=UTC`, and 77 files, 1051 tests passed under `TZ=America/New_York`.
- `node --check scripts/smoke.mjs`: exit 0.
- From-zero smoke (`SMOKE_PORT=9319`, `WRANGLER_SEND_METRICS=false`, `CI=1`, `TZ=UTC`): About to apply 88 migration(s), SMOKE PASS, no ` 500 ` line, exit 0 (17696 lines of log; the one ` 503 ` line is `POST /api/send`). The DROPS workbook was not on this disk, so that upload was skipped.
- Dash audit: 0 on the sixteen files (U+2014 and U+2013). No CR byte. No BOM.
- No key, secret, or password value added. No personnel name in the new test or this report.

## Deploy

Not deployed from this session. Nothing committed. Nothing pushed. No git was run.

## Sealed final check

```
the tree this slice opened on        941892df1d14406f (263 files; V18, migrations 0001-0088)
npm run typecheck                     exit 0
TZ=UTC npx vitest run                 77 files, 1051 tests passed
TZ=America/New_York npx vitest run    77 files, 1051 tests passed
node --check scripts/smoke.mjs        exit 0
SMOKE_PORT=9319 WRANGLER_SEND_METRICS=false CI=1 TZ=UTC node scripts/smoke.mjs
                                      About to apply 88 migration(s); SMOKE PASS; " 500 " lines: 0; " 503 " lines: 1 (POST /api/send); exit 0
dash audit: 0; CR audit: 0; BOM: none; secret values: none; personnel data: none
the app tree after the edits             d80e0d2d5a477a2e (264 files)
```

```
app/src/sheetsync.ts                       79839  d85ee62493b52d95
TAIL }
app/src/imports.ts                          4380  c5686e4d05ac1ed4
TAIL }
app/src/console.ts                        152649  66418021edb8a2ea
TAIL }
app/src/html.ts                           197227  75dbbcb587fcc89a
TAIL }
app/src/compliance.ts                      27563  78ed59af4a3cc01d
TAIL }
app/src/intesting.ts                       28028  2cff0a3d85a9fc29
TAIL }
app/src/biz.ts                             33241  1537ff99b412b812
TAIL }
app/src/actions.ts                        414437  15ce797d9cf1fdfa
TAIL export { MANIFEST_COLUMNS, buckedPackageCode };
app/src/index.ts                          161107  1a800815e908a8b5
TAIL export default worker;
app/src/pages.ts                           36051  fef06a631dc37cd5
TAIL }
app/src/i18n.ts                           201519  992da20999fe1e95
TAIL }
app/scripts/smoke.mjs                     724894  53d77254898ea569
TAIL });
app/test/testinggate.test.ts               15463  fe6b01e00f6605f7
TAIL });
app/test/imports.test.ts                   14160  a4df12403fcb218c
TAIL });
app/test/console.test.ts                   70898  817fa52f26399bcd
TAIL });
app/test/testingoverride.test.ts            5356  4a561c54c29651c6
TAIL });
```
