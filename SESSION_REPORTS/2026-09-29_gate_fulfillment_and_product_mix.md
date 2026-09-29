# 2026-09-29 The gate on Fulfillment and on Product Mix totals and pounds (canon 0.30.308): PASSED

Scribe session. One gate on two slices built in sequence on the worktree `branches/GFLiteOpsDashboard` by his Code session and handed together: V5, FULFILLMENT (BRIEF V5, canon 0.30.306; `SESSION_REPORTS/2026-09-29_fulfillment.md`) and V14, PRODUCT MIX TOTALS AND POUNDS (BRIEF V14, canon 0.30.307; `SESSION_REPORTS/2026-09-29_product_mix_totals_and_pounds.md`). Both reports say "Not deployed. Nothing committed. No git was run."; the disk agrees. No Scribe change to the worktree's app. His hand-back for V14, verbatim in part: "Lbs sits between Grams and Percent. A gram figure shows as pounds at 448, two decimals with thousands separators. When the year has rows, the last row is Total"; V5's report, verbatim in part: "The console section Fulfillment, `data-hc-section="fulfillment"`, follows Prepack and starts open."

VERDICT: PASSED, both. The tree is the two briefs' files and nothing else, every check is green on the combined tree, migration 0081 rehearses clean on the newest snapshot, the bar's arithmetic and the report's figures come out right on fixtures the Scribe worked by hand, and the renders show the three panes, the grid and the report as the doc and his screenshot ask. Ready to merge as one commit carrying both slices, since they were built and gated on one tree; the pre snapshot first, the block stopping on its failure, the canon checkout, then the three acts; the workflow applies 0081.

## What was gated

1. THE TREE. Against V13's tree (`5fc1f2cacc973a8f`): sixteen files, the union of the two seals. V5's twelve (`0081_fulfillment_override.sql`, `src/fulfillmentboard.ts` and `test/fulfillmentboard.test.ts` new; config, index, console, lookups, i18n, theme, smoke, console.test and locations.test changed) and V14's six (`test/reports.test.ts` new; reports, xlsx, html, theme and smoke changed), theme and smoke in both. Every hash in both reports verified on his disk and in the sandbox (V5's theme and smoke hashes superseded by V14's, as the order of the two builds says). The app tree hashes `9f7d93462481765f`; nothing outside the two seals moved (`find -newer` on his disk names the sixteen alone; `wrangler.toml`, `package.json`, `public/` untouched).
2. FULFILLMENT (V5, laws 1 to 7), read line by line: the table and the two indexes; the ten rows with the doc's names and METRC's units; the Admin grid under Logistics with the farm's today and `?date=`, whole-number cells masked to the unit, one Save that inserts, updates with old and new logged, or soft-deletes with "cleared", nothing hard-deleted; the section after Prepack, open on a first visit, three panes reading the console's day, the series the day's non-null cells (a zero present, named, no width), the bar inside `TRAILER_CARGO` (the rects inserted after the cargo hook) and as a band beside the phone and the handshake, widths the grams shares with eaches times their unit grams, the ten hues in the three sheets, the legend in each series' own unit, the empty words; the loader reading the table and the config row only. THE BAR'S MATH on a fixture (Shipping today: Bulk Bud 12,000 g, Biomass/Trim 4,500 g, Prepack 40 ea, Prerolls 300 ea, Shake 900 g, MOBs 20 ea): 20,220 g in all, the shares 59.35, 22.26, 5.54, 1.48, 4.45 and 6.92 percent, the code's numbers equal to the hand's.
3. PRODUCT MIX (V14, laws 1 to 4): `ReportColumn.lbs`, `reportCellText` shared by the page, the CSV and the PDF, the XLSX's two-decimal number cell (`s="3"`, `#,##0.00`), the Lbs column between Grams and Percent, the Total row flagged `_total` and rendered `report-total` (bold, a top rule) on the page and the PDF, a plain last row in the CSV and the XLSX, no Total row for an empty year. THE FIGURES on his screenshot's six types: the Total row 37,202,174 g, 83,040.57 lb, 100.00; BUD 19,214.66 lb; TRIM 48,358.71 lb; the test pins them and the render shows them.
4. THE MIGRATION REHEARSED on the 9/29 snapshot's `app_config` (38 rows, no fulfillment key) over a database built from migrations 0001 to 0080: 0081 creates the table with its 13 columns, the partial unique index and the day index and seeds the config row (39 rows after); a duplicate live cell is refused, the same cell is accepted again after a soft delete, another column of the same row and day is accepted; the seed replayed leaves a typed value alone; a second run refuses (the table exists), as the workflow never re-applies.
5. THE RENDERS from fixtures (the CO sheet, Lite, Spanish, the phone width): the section with the trailer's stacked bar, the two bands, the legends and the empty words; the grid with the day and the thirteen typed cells; the report with the Lbs column and the bold Total row. The pictures handed to his eye.

## Observations for his word (no hold)

- On the grid the unit word "ea" wraps under its cell where "g" stays beside; a `white-space: nowrap` on the cells is a one-line tidy.
- The dictionary lacks "Percent" and "Package type" (report labels that predate this slice), so the Spanish report keeps those two heads in English. A later tidy.
- The Bulk Isolate (THCA) 0 g fixture shows the doc's law: a zero is present in the legend and draws no segment.

## Gates on the tree as received (the Scribe's sandbox, the worktree's `app/`)

- `npm run typecheck` with the generated types file deleted first: exit 0.
- `npx vitest run`: 69 files, 977 tests passed; the same under `TZ=America/New_York`.
- `node --check scripts/smoke.mjs` and `node --check scripts/icon-proofs.mjs`: ok.
- `npm run proofs:icons`: `85b22429de13e975`, unchanged.
- From-zero smoke (`SMOKE_PORT=9216`): `About to apply 81 migration(s)`, `SMOKE PASS`, no ` 500 ` line; the dev server ended by the timeout after the pass.
- Dash audit: 0 (em and en), and no CR byte, on the sixteen files, the two build reports, `wrangler.toml`, `tsconfig.json` and `package.json`. Secret grep (six patterns): no value anywhere. No personnel data; the fixture's person is the smoke's.

## The merge (his hands, one commit for the two slices, the snapshot first and the block stopping on its failure, the canon checkout before the merge)

```powershell
cd "C:\Users\DennisWallace\Documents\Claude\Projects\gripfactory Practical\app"
node scripts/db-snapshot.mjs pre_fulfillment
if ($LASTEXITCODE -ne 0) { throw "snapshot failed, stop here" }
cd "C:\Users\DennisWallace\Documents\Claude\Projects\gripfactory Practical\branches\GFLiteOpsDashboard"
git add -A
git commit -m "V5 and V14: fulfillment; product mix totals and pounds" -m "V5: migration 0081 (fulfillment_overrides and the unit grams config row), the Admin grid Fulfillment Override under Logistics, the console section Fulfillment after Prepack with the three panes and their stacked bars, the panel the sole source. V14: the Lbs column at 448 and the bold Total row on Product Mix by weight, on the page and in the CSV, the XLSX and the PDF. Canon 0.30.308 and the two briefs ride in canon/ and BRIEFS/.`n`nCo-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`nClaude-Session: https://claude.ai/code/session_01VDz7UdaTSkjq69GvDfDWd7"
cd "C:\Users\DennisWallace\Documents\Claude\Projects\gripfactory Practical"
git checkout -- canon
git merge --no-ff GFLiteOpsDashboard -m "Merge V5 and V14: fulfillment; product mix totals and pounds"
git push
```

If the snapshot answers 7403 on its first query, run the snapshot line alone once more and then the rest. The push runs the workflow: typecheck, the tests, `apply migrations` (0081, one to apply), the deploy. His paste back: the snapshot's last line, the push's output, the run's result and the Version ID from the deploy step's log; the Scribe reads main after the merge, folds LIVE and hands V6's paste.

## Sealed final check

```
rm worker-configuration.d.ts; npm run typecheck      exit 0
npx vitest run                        69 files, 977 tests passed
TZ=America/New_York npx vitest run    69 files, 977 tests passed
node --check scripts/smoke.mjs        ok
node --check scripts/icon-proofs.mjs  ok
npm run proofs:icons                  85b22429de13e975, unchanged
rm -rf .smoke-persist && CI=1 SMOKE_PORT=9216 WRANGLER_SEND_METRICS=false npm run smoke
                                      About to apply 81 migration(s); SMOKE PASS; " 500 " lines: 0
migration 0081 rehearsed              the table, both indexes, the seed; the partial unique proved; the seed idempotent; a second run refuses
the bar's math by hand               20,220 g, six shares, the code equal to the hand
the report's figures by hand         37,202,174 g, 83,040.57 lb, 100.00; BUD 19,214.66; TRIM 48,358.71
V5's seal (12 files) verified byte for byte, device and sandbox (theme and smoke at V14's hashes):
app/migrations/0081_fulfillment_override.sql    1152  4ea04aea96c30051
app/src/fulfillmentboard.ts                    14605  d2874c7580db006f
app/src/config.ts                              73831  0ae4caebeaac2025
app/src/index.ts                              148176  7e71c374a0b79cd0
app/src/console.ts                            101906  02bc2e608199d295
app/src/lookups.ts                              9713  c42b4f6cc6a39129
app/src/i18n.ts                               185690  02baacaa5cf46165
app/test/fulfillmentboard.test.ts               7618  da59cef54af20534
app/test/console.test.ts                       65273  44d86df2c0658470
app/test/locations.test.ts                     12070  2804205faa5380d2
V14's seal (6 files) verified byte for byte, device and sandbox:
app/src/reports.ts                             26826  ecde0c210a1009ee
app/src/xlsx.ts                                 9979  100bb3287d91d36f
app/src/html.ts                               192658  512557574ab60530
app/src/theme.ts                              170306  ccec1bb9f5bd3569
app/scripts/smoke.mjs                         628538  2e78c7ab3c16f27f
app/test/reports.test.ts                        2676  229a8514ac1b6393
changed against V13's tree, not in the two seals: none
the app tree: 9f7d93462481765f (V13's 5fc1f2cacc973a8f plus the sixteen), the same on his disk
the build reports: 2026-09-29_fulfillment.md 6126 6569b5bd39eab9f4; 2026-09-29_product_mix_totals_and_pounds.md 3738 2690a8ab06cb7076
dash audit: 0; CR audit: 0; secret grep: no values; personnel data: none
```
