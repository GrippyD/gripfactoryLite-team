# 2026-09-29 The gate on the testing gate (canon 0.30.294): PASSED

Scribe session. The gate on V4, THE TESTING GATE (BRIEF V4, canon 0.30.293), on his Code session's `SESSION_REPORTS/2026-09-29_the_testing_gate.md` in the worktree `branches/GFLiteOpsDashboard`. The report says "Not deployed. Nothing committed. No git was run."; the disk agrees. No Scribe change to the worktree. His hand-back, verbatim in part: "The Testing section is now the inventory gate: four live panes with the line-art icons, Quality Stats and the failure-mode pie from the In Testing sheet, and the old Testing block removed. Migration `0079` seeds `gate_type_codes` and `gate_unit_grams`."

VERDICT: PASSED. The tree is the brief's ten files and nothing else, every check is green, the migration rehearses clean against the 9/28 snapshot, and the figures come out right on a fixture the Scribe worked by hand. V4 is ready to merge; the pre snapshot first, the block stopping on its failure, then the three acts.

## What was gated

1. THE TREE. Against V3's fixed tree (`f91fefd5046c4b62`): one migration new (`0079_testing_gate.sql`, 595, 7d61321971c8bf57), one test new (`testinggate.test.ts`, 15127, 00985353e5250513), eight files changed (console, config, theme, i18n, index, smoke, console.test, testing.test), all ten in the seal and nothing outside it; V1's three files at their gated hashes; `wrangler.toml`, `package.json`, `src/consoleicons.ts`, `src/testing.ts`, `src/intesting.ts` and `public/` untouched. The app tree hashes `db2315fd48319e69`. The seal matches byte for byte (size, sha256, tail) on his disk and in the Scribe's sandbox.
2. THE FOUR PANES (law 1), read line by line in `buildTestingFigures` and `loadTestingSection`: the gate set is live mirror packages of the config types under the three farms' licenses; grams by uom with the unit grams for eaches; Ready is NotSubmitted, pasteurized (`isPasteurizedTag` on the live cryo outputs, the Rad named as V9's second way) and without an open desk order, plus cryo outputs the mirror has not pulled; Scheduled the desk's `TEST_CONSOLE_SCHEDULED` orders, one package once, at the mirror's grams unless METRC has moved it on; In Testing SubmittedForTesting; Passed TestPassed and RetestPassed; failed packages in none. The Scribe's fixture (seven mirror rows, three cryo outputs, one order): Ready 2,200 g in 2 packages (a cryo'd BUD at 1,500 plus a WPR output the mirror lacks at 700; the second BUD moved to Scheduled by its order), Scheduled 2,200 g in 1, In Testing 3,000 g in 1, Passed 2,720 g in 3 (40 PRE at 28, 10 MOB at 70, a BUD at 900), the WBP never counted.
3. THE STATS AND THE PIE (laws 2 and 3): six first-time sheet rows in the fixture, four failed: First Time Fails 4, First Time Tests 6, FTQ 33.3%; the pie Coliforms 50.0% (Apple 41, and "Papaya Cake / Papaya" where the sheet and the market strain differ), Potency 25.0%, Yeast and Mold 25.0%; the segment pulls free on the click and its strains show with their share and grams; the empties read the brief's words.
4. THE OLD SECTION GONE (law 4), the config rows and parsers (law 5) with their tests, the seam (law 6), the smoke's asserts moved and each named in the build report (law 7).
5. THE SHEET'S TABLE on the floor holds 0 rows (9/28 snapshot), so on the first deploy the stats read 0, 0 and NA with the empty words and the pie its empty words, until `MS_CLIENT_SECRET` or a file in `DROPS/` feeds it; the four panes read the mirror at once.

## Observations for his word (no hold)

- THE LOADER pulls every live mirror package on each console load (11,495 rows on the floor, 10,167 of them vape carts that never count); a SQL filter on the gate types (`item LIKE 'BUD - %'` and the rest, built from the config list) would cut that to about 1,300 rows. D1 carries it today; a tidy for a later slice as the mirror grows.
- THE LEGEND's lines sit centered in their pane; cosmetic.
- THE READY ICON's "Pretest checks" clips its last letter at the pane's 7.5 rem; an icon matter, his "fix as needed" (0.30.285).
- The pie's eight hues are fixed hex values in the three sheets, as the brief allowed; the icons' currentColor rule is untouched.

## Gates on the tree as received (the Scribe's sandbox, the worktree's `app/`)

- `npm run typecheck` with the generated types file deleted first: exit 0.
- `npx vitest run`: 66 files, 956 tests passed; the same under `TZ=America/New_York`.
- `node --check scripts/smoke.mjs`: ok.
- From-zero smoke (`SMOKE_PORT=9203`): `About to apply 79 migration(s)`, `SMOKE PASS`, no ` 500 ` line; the dev server ended by the timeout after the pass.
- THE MIGRATION REHEARSED on the 9/28 snapshot's `app_config` (36 rows, no `gate_` key): 0079 inserts 2 rows; a second run inserts 0; `INSERT OR IGNORE` leaves a typed value alone.
- THE RENDER: the section built from the fixture with the Cerberus sheet, screenshotted at 1100 px and 390 px and with a segment picked; the three pictures handed to his eye.
- Dash audit: 0 (em and en), and no CR byte, on the ten files, the build report, `wrangler.toml`, `tsconfig.json` and `package.json`.
- Secret grep (six patterns): no value anywhere; the build report names the patterns as patterns.
- No personnel data in the diff (the smoke's lab and COA fixtures are fixtures).

## The merge (his hands, four acts in order, the snapshot first and the block stopping on its failure)

```powershell
cd "C:\Users\DennisWallace\Documents\Claude\Projects\gripfactory Practical\app"
node scripts/db-snapshot.mjs pre_testing_gate
if ($LASTEXITCODE -ne 0) { throw "snapshot failed, stop here" }
cd "C:\Users\DennisWallace\Documents\Claude\Projects\gripfactory Practical\branches\GFLiteOpsDashboard"
git add -A
git commit -m "V4: the testing gate" -m "The Testing section as the inventory gate: four live panes from the METRC mirror with the line-art icons, Quality Stats and the failure-mode pie from the In Testing sheet, the old section retired, migration 0079 with the two config rows, the smoke pin at 79.`n`nCo-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`nClaude-Session: https://claude.ai/code/session_01VDz7UdaTSkjq69GvDfDWd7"
cd "C:\Users\DennisWallace\Documents\Claude\Projects\gripfactory Practical"
git merge --no-ff GFLiteOpsDashboard -m "Merge V4: the testing gate"
git push
```

The push runs the workflow: typecheck, the tests, `apply migrations` (0079, one to apply), the deploy. His paste back: the snapshot's last line, the push's output, the run's result and the Version ID from the deploy step's log; the Scribe reads main after the merge and folds LIVE.

## Sealed final check

```
rm worker-configuration.d.ts; npm run typecheck      exit 0
npx vitest run                        66 files, 956 tests passed
TZ=America/New_York npx vitest run    66 files, 956 tests passed
node --check scripts/smoke.mjs        ok
rm -rf .smoke-persist && CI=1 SMOKE_PORT=9203 WRANGLER_SEND_METRICS=false npm run smoke
                                      About to apply 79 migration(s); SMOKE PASS; " 500 " lines: 0
migration 0079 rehearsed              2 rows inserted into the snapshot's app_config; 0 on a second run
the build report's seal (10 files) verified byte for byte, device and sandbox:
app/migrations/0079_testing_gate.sql              595  7d61321971c8bf57
app/src/console.ts                             101639  a1ff5d35e1e830b8
app/src/config.ts                               72495  4f47b8ea843cf669
app/src/theme.ts                               164547  802bde353683926f
app/src/i18n.ts                                182799  55af55ce661a9939
app/src/index.ts                               144676  c6c3ebcac4095d44
app/scripts/smoke.mjs                          618267  b3209b96dda9493e
app/test/console.test.ts                        63278  d79486beb723bdc4
app/test/testinggate.test.ts                    15127  00985353e5250513
app/test/testing.test.ts                         5363  c4f1de0c26b3ffe2
changed against V3's fixed tree, not in the seal: none
the app tree: db2315fd48319e69 (V3's f91fefd5046c4b62 plus the ten)
the build report: SESSION_REPORTS/2026-09-29_the_testing_gate.md  9718  7dbf410df15024ce
dash audit: 0; CR audit: 0; secret grep: no values; personnel data: none
```
