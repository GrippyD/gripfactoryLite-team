# 2026-10-01 The gate on terp recipes and the pasteurization schedule (canon 0.30.325): PASSED

Scribe session. The gate on V8, TERP RECIPES AND THE PASTEURIZATION SCHEDULE (BRIEF V8, canon 0.30.321, `BRIEFS/2026-09-30_terp_recipes_and_the_pasteurization_schedule.md`, 15,148 bytes, `07651bf41e1e7b2d`), built on the worktree `branches/GFLiteOpsDashboard` by his Code session on V15 and V15.1 as merged (main `ee17a5a`, the app tree `d9876ff55742ed8d`), its report `SESSION_REPORTS/2026-09-30_terp_recipes_and_the_pasteurization_schedule.md` (6,728 bytes, `c2ca959fc644323c`). The report says "Nothing committed. No git was run."; the disk agrees. No Scribe change to the worktree's app. His hand-back, verbatim in part: "Terp Recipes is an Admin lookup. The builder adds whole-percent lines until they total 100, then Save writes the recipe in one batch. A short total or a duplicate active name is refused. Retire takes a reason. There is no edit. On Pasteurization, each working run can pick an active recipe and a dose. At `>>` a new run takes the newest active recipe of the same market strain, and the dose stays blank. Cryo Weight Entry shows that recipe and dose read-only. A completed run refuses a change."

VERDICT: PASSED. The tree is the brief's fifteen files and nothing else, every check is green, migration 0084 rehearses clean on the newest snapshot, the builder behaves as the doc draws it under the browser's own script and stands as plain rows without it, the server refuses what the brief says it refuses, the default by market strain reads the floor's runs the way the brief names, and the renders show the builder, the list with a retired recipe, and the schedule's rows with the pick. Ready to merge; the workflow applies 0084. Four observations for his word, none a hold.

## What was gated

1. THE TREE. Against the live tree (`d9876ff55742ed8d`): the fifteen files of the seal (`migrations/0084_terp_recipes.sql`, `src/terps.ts`, `test/terps.test.ts` new; `src/db.ts`, `src/actions.ts`, `src/scheduling.ts`, `src/cryo.ts`, `src/lookups.ts`, `src/index.ts`, `src/config.ts`, `src/i18n.ts`, `src/theme.ts`, `scripts/smoke.mjs`, `test/scheduling.test.ts` grown), every hash in the report verified on his disk and in the sandbox; the two repair files of 0.30.315 unchanged. Nothing else moved; the app tree hashes `7c2cbf6bae72a5d9` on both sides.
2. THE MIGRATION, 0084: `terp_recipes` (name, status, the retire columns, the audit columns), `terp_recipe_lines` (recipe, position, name, whole percent), `production_schedules.terp_recipe_id` and `terp_dose_pct`, the three indexes; rehearsed on `db_backups/20260930-190116_pre_two_harvest_nodes` after 0001 to 0083: the two tables, the two columns null on all 138 schedule rows, the second run refused ("table terp_recipes already exists"). Postgres-portable.
3. THE LOOKUP, read line by line and driven in the browser: the tile in Production Operations beside Trim Bogey; the page `terpRecipesPage` with the builder the doc draws (Recipe Name; Terp Name, the percent box at 100 with no line and 100 minus the sum after, "+", Start Over; each line below with a minus; the running total; the prompt "This Mix is complete, would you like to save?" with Save and Start Over at exactly 100). Under Playwright: a first line of 60 leaves the box at 40 and the prompt hidden; a 50 on top warns "That percent would pass 100." and adds nothing; an empty name warns "Type a terp name and a percent." and adds nothing; a 40 brings the total to 100, the prompt up, two hidden `terp_name` and two hidden `percent` inputs in position order, the plain rows hidden and disabled; with scripts off the eight plain rows stand with their Save. THE SERVER (`saveTerpRecipe`): the name required and unique among active recipes ignoring case, at least one line, each name at most 60 characters, each percent a whole number 1 to 100, the sum exactly 100, one batch logged under `create` for the recipe and each line; `retireTerpRecipe` requires a reason, flips the status with `retired_at`, `retired_by`, `retire_reason` and three log rows under that reason, refuses a second retire; no edit route exists; a retired name may be used again, the runs keeping the id. The list: active recipes newest first with their lines and the farm-time stamp, Retire with its reason box; the retired under Show retired, open with `?retired=1`.
4. THE PICK AND THE DEFAULT: `terpScheduleControls` on each cryo working row (the active recipes with No recipe, the dose box, Save; a retired recipe already on the run named and not an option), `pickTerpRecipe` refusing a completed run ("Unfinish the run first to change its recipe.") and a retired or unknown id ("That recipe is not on the list."), the dose a number 0 to 100 with at most two decimals, the two log reasons; `terpCompleteLine` read-only on the Complete pane; `defaultTerpRecipeForBatch` at `>>` reading the newest cryo run (any status, HBN-level rows alone) whose market strain key equals this HBN's (`LOWER(TRIM(COALESCE(NULLIF(TRIM(market_strain), ''), the strain's name, '')))`) and whose recipe is active, written on the run in the schedule's own batch, the dose null; `terpRunHeader` on Cryo Weight Entry with the recipe's lines. On the Scribe's fixture: run A picked Citrus Lift at 2.50; run B of the same market strain took Citrus Lift at `>>` with no dose; run C completed at 1.75 reads read-only.
5. THE PICK-LIST CHECK against the floor (the rule of 0.30.322): the floor's 28 cryo runs (16 scheduled, 12 complete) fall under 7 market strain keys, none empty, the busiest Bermuda Triangle with 11; no recipe exists yet, so every default is none until the scheduler's first pick, after which the next run of that market strain takes it.
6. THE RENDERS from the fixture: the empty lookup, the builder with two lines and the prompt, the list with an active and a retired recipe (EN and ES), the no-script form, the Pasteurization schedule with two working rows and a completed one (EN and ES). The pictures handed to his eye.

## Observations for his word (no hold)

- The Retire reason box is a bare box before the Retire button (its name is the screen reader's alone); a placeholder "Reason" / "Motivo" is a one-line tidy.
- On the Complete pane the dose and the completion time run together on one line ("Dose: 1.75 % 2026-09-30 16:00"); a line break is a one-line tidy.
- "R&D" is a market strain on 6 of the floor's runs, so a recipe picked on one R&D run becomes the default for the next R&D run whatever its real strain; the default follows the market strain by his ruling, worth knowing on that one.
- After the total reaches 100 the percent box reads 0; a further "+" warns, as it should. No hold.

## Gates on the tree as received (the Scribe's sandbox, the worktree's `app/`)

- `npm run typecheck` with the generated types file deleted first: exit 0.
- `npx vitest run`: 71 files, 998 tests passed; the same under `TZ=America/New_York`.
- `node --check scripts/smoke.mjs` and `node --check scripts/icon-proofs.mjs`: ok.
- `npm run proofs:icons`: the sheet 105,377 bytes, `85b22429de13e975`, unchanged.
- From-zero smoke (`SMOKE_PORT=9233`): `About to apply 84 migration(s)`, `SMOKE PASS`, no ` 500 ` line; the dev server ended by the timeout after the pass.
- Migration 0084 rehearsed on the 19:01 pre snapshot: the two tables, the two columns null on 138 rows, three indexes, the second run refused.
- Dash audit: 0 (em and en), and no CR byte, on the fifteen files and the build report. Secret grep (the patterns and key shapes): no value anywhere. No personnel data.

## The merge (his hands, the snapshot first and the block stopping on its failure, the canon checkout before the merge)

```powershell
cd "C:\Users\DennisWallace\Documents\Claude\Projects\gripfactory Practical\app"
node scripts/db-snapshot.mjs pre_terp_recipes
if ($LASTEXITCODE -ne 0) { throw "snapshot failed, stop here" }
cd "C:\Users\DennisWallace\Documents\Claude\Projects\gripfactory Practical\branches\GFLiteOpsDashboard"
git add -A
git commit -m "V8: terp recipes and the pasteurization schedule" -m "Migration 0084: terp_recipes, terp_recipe_lines, production_schedules.terp_recipe_id and terp_dose_pct. The Admin lookup Terp Recipes with the builder of the Major Move doc (whole-percent lines to exactly 100, Save and Start Over), saved whole, retired with a reason, never edited. Each scheduled pasteurization run picks an active recipe and a dose; at >> a new run takes the newest active recipe of the same market strain, the dose never carried; a completed run holds its pick; Cryo Weight Entry shows the recipe and dose read-only. Canon 0.30.325, the brief and the gate report ride in canon/, BRIEFS/ and SESSION_REPORTS/.`n`nCo-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`nClaude-Session: https://claude.ai/code/session_01VDz7UdaTSkjq69GvDfDWd7"
cd "C:\Users\DennisWallace\Documents\Claude\Projects\gripfactory Practical"
git checkout -- canon
git merge --no-ff GFLiteOpsDashboard -m "Merge V8: terp recipes and the pasteurization schedule"
git push
```

If the snapshot answers 7403 on its first query, run the snapshot line alone once more and then the rest. The push runs the workflow: typecheck, the tests, `apply migrations` (0084, the pin 84), the deploy. His paste back: the snapshot's last line, the push's output, the run's result and the Version ID from the deploy step's log; the Scribe reads main after the merge, folds LIVE, and the next brief is V7 DRYING after his live walk of CSA and CSB (ruling 12), else V9.

## Sealed final check

```
rm worker-configuration.d.ts; npm run typecheck      exit 0
npx vitest run                        71 files, 998 tests passed
TZ=America/New_York npx vitest run    71 files, 998 tests passed
node --check scripts/smoke.mjs        ok
node --check scripts/icon-proofs.mjs  ok
npm run proofs:icons                  85b22429de13e975, 105377 bytes, unchanged
rm -rf .smoke-persist && CI=1 SMOKE_PORT=9233 WRANGLER_SEND_METRICS=false npm run smoke
                                      About to apply 84 migration(s); SMOKE PASS; " 500 " lines: 0
migration 0084 on the 19:01 pre snapshot   2 tables, 2 columns null on 138 rows, 3 indexes; run 2 refused
the pick list on that snapshot        28 cryo runs under 7 market strain keys, none empty; 0 recipes, every default none
the builder in the browser            60 then 50 refused then empty refused then 40: total 100%, the prompt up, the hidden inputs in order; no script: 8 plain rows
the fixture by hand                   run A picked 2.50; run B of the same market strain defaulted, dose null; run C complete read-only at 1.75
the seal (15 files) verified byte for byte, device and sandbox:
app/migrations/0084_terp_recipes.sql            1089  58f37c86a4b56421
app/src/terps.ts                               11141  9ae95c9df383a266
app/src/db.ts                                 202200  64c680877fe60d59
app/src/actions.ts                            384645  29075bf54cda46c6
app/src/scheduling.ts                          47240  74038987dba02120
app/src/cryo.ts                                25382  14f5f0164a5bfe31
app/src/lookups.ts                             10123  8c954ca82d6c30f5
app/src/index.ts                              153853  814a96f75b54f5a7
app/src/config.ts                              74998  84b3a7620cffb46f
app/src/i18n.ts                               192781  a7386cb1013f498f
app/src/theme.ts                              176586  965037ac552fc560
app/scripts/smoke.mjs                         656199  e6756971f5a75649
app/test/terps.test.ts                         10220  e74b62a4d718bdb9
app/test/scheduling.test.ts                    22413  09f9342339954422
changed against the live tree, not in the seal: none
the app tree: 7c2cbf6bae72a5d9 (d9876ff55742ed8d plus the fifteen), the same on his disk
the build report: 2026-09-30_terp_recipes_and_the_pasteurization_schedule.md 6728 c2ca959fc644323c
dash audit: 0; CR audit: 0; secret grep: no values; personnel data: none
```
