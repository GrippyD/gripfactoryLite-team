# 2026-10-01 The gate on the Rad schedule and Rad operation (canon 0.30.328): HELD as received on one law, the fix gated

Scribe session. The gate on V9, THE RAD SCHEDULE AND RAD OPERATION (BRIEF V9, canon 0.30.327, `BRIEFS/2026-10-01_the_rad_schedule_and_rad_operation.md`, 17,405 bytes, `7bc664ebc132a028`), built on the worktree `branches/GFLiteOpsDashboard` by his Code session on V8 as merged (main `3746d0c`, the app tree `7c2cbf6bae72a5d9`), its report `SESSION_REPORTS/2026-10-01_the_rad_schedule_and_rad_operation.md` (7,742 bytes, `d758549bc6159433`). The report says "Nothing committed. No git was run."; the disk agrees. His hand-back, verbatim in part: "Rad Schedule lists the six package types in NotSubmitted, TestFailed, and RetestFailed, sorted by state, type, grow type, then the tag's last five, with the filter on `?q=`. A run holds one to ten packages. The grey runs from 100 to 3000 by 100, starting at 100 and then taking the newest run's value. Rad Operation starts one run at a time, shows the clock, and completes it. Complete pasteurizes those tags for the Testing gate, returns a released or pasteurized app row to the testing queue, and adopts a METRC-only package into that queue."

VERDICT: HELD as received on one law, the Available pane's, and the hold is the Scribe's brief's doing: the brief kept a package off Available only while it stood on a scheduled or running run, so a package whose run has completed comes straight back to the top of the left pane (its METRC state is unchanged until the Testing Desk moves it), where a second `>>` would irradiate it twice and the pane never shrinks as runs complete. Everything else passes: the thirteen sealed files and nothing else on the live tree, every mechanical gate green, migration 0085 clean on the newest snapshot, the Available law counted against the floor's mirror, the sort, the filter and the clock driven in the browser, the run of ten and the eleventh refused, Start and its two refusals, Complete's three effects on a released row, a queued row and a stranger, Reopen behind the PIN lifting the mark. The Scribe's fix is gated in the sandbox (four files, the tree `516bc3f2b239e24a`): a package stays off Available while its newest completed run recorded the lab state the mirror still shows, and returns when METRC moves it (a fail after a test, say); the smoke's walk grows the case. It waits on his word to land in the worktree; then the merge.

## What was gated (the tree as received, `188c24fb60d59ea9`)

1. THE TREE. Against the live tree (`7c2cbf6bae72a5d9`): the thirteen files of the seal (`migrations/0085_rad_runs.sql`, `src/rad.ts`, `test/rad.test.ts` new; `src/db.ts`, `src/actions.ts`, `src/config.ts`, `src/console.ts`, `src/compliance.ts`, `src/theme.ts`, `src/i18n.ts`, `src/index.ts`, `scripts/smoke.mjs`, `test/console.test.ts` grown), every hash in the report verified on his disk and in the sandbox; the two repair files of 0.30.315 unchanged. Nothing else moved; the app tree hashes `188c24fb60d59ea9` on both sides.
2. THE MIGRATION, 0085: `rad_runs` (status scheduled, running, complete; the grey; the three stamps with their actors; the audit columns) and `rad_run_packages` (run, tag, item type, grams, the lab state at scheduling, position, the void columns), three indexes; rehearsed on `db_backups/20260930-205758_pre_terp_recipes` after 0001 to 0084 (the two tables empty, the gate's pasteurized-by-Rad query reading none, the second run refused). Postgres-portable.
3. THE AVAILABLE LAW, read and counted: `listRadCatalog` takes the mirror's live rows of the six types (`gateItemType`) in the three states, keeps those whose lineage the adopt precedent can mint (`inheritedHarvest`, `hbnFromMetrcName`), sorts by state, type in the doc's order with MOB and WBP after, grow type (the batch's method through the lineage, else the HBN code's segment; Indoor, Outdoor, Greenhouse, then any other name, Unknown last) and the tag's last five as a number; `listRadAvailable` removes the tags on a scheduled or running run. On the newest snapshot: 164 candidates (BUD 45 NotSubmitted and 8 TestFailed; WPR 48 and 11; SHA 23; WBP 29), every one with a harvest in its lineage; their app rows today are 88 none (adopted at completion), 18 released, 58 in the testing queue, none in a status that would refuse Complete. The filter `?q=` rides every post and the page's script hides rows as the box is typed (driven: four rows to one on "00019", the hidden `q` inputs carrying it).
4. THE RUNS: `scheduleRadPackage` lands on the newest scheduled run with room, births one at the newest run's grey (100 the first time; the unit test and the smoke read 100 then 1500), refuses the eleventh ("That run is full; start a new run."); `newRadRun`, `removeRadRun` on an empty card, `unscheduleRadPackage` voiding the run when its last package leaves, `setRadRunGrey` refusing a value off the hundreds; `startRadRun` refusing an empty run and a second run while one runs; `unstartRadRun`; `completeRadRun` in one batch: the run complete with its stamp, each package's app row in `released` or `pasteurized` to `testing_queue` by the transition `rad_complete` (Demote ignores that edge, so the Testing Queue still steps back to the cryo queue), a row already queued untouched, a METRC-only package adopted as the prepack adopt does (the batch minted from the lineage, source `metrc`, no prepack schedule row) and born in the queue, nothing to METRC; `PASTEURIZED_RAD_SQL` joins the completed runs' tags to the cryo outputs in `isPasteurizedTag`, so the Ready pane counts them; `reopenRadRun` behind the PIN returns the run to running, the mark lifting with the status, the moved rows standing. Every stamp in the log under its reason.
5. THE RENDERS from a fixture (ten mirror packages; a running run of three at 1500 Gy, a done run of two, a scheduled run of one): the Rad Schedule's three panes and the Rad Operation's three, EN and ES, the clock ticking from `started_at` in the browser (0d 00:00:18 to 0d 00:00:19 a second later). The pictures handed to his eye.

## The hold (as received) and the fix (gated in the sandbox)

1. A COMPLETED PACKAGE COMES BACK TO AVAILABLE. `listRadAvailable` as received removes only the tags on a scheduled or running run, the brief's own words, so once a run completes its packages stand on the left pane again (NotSubmitted sorts first, so at the top) until METRC changes their state, which the Testing Desk's order does hours or days later; a second `>>` would schedule a second dose, and the 164-row pane never shrinks as the Rad works through it. On the Scribe's fixture the two packages of the done run were back on Available with the four never scheduled. THE FIX (`src/db.ts`, `src/rad.ts`): `listRadCompletedStates` reads, for each tag, the lab state its newest completed run recorded (`rad_run_packages.lab_test_status`); `listRadAvailable` drops a tag while the mirror still shows that state, and lists it again when the state moves (a TestFailed after the test, a RetestFailed after the retest: the package needs the Rad again); a reopened run is not complete, so its tags leave the map (and sit on the running run). The unit test grows the case (off after Complete; `>>` refused; on again when the mirror reads TestFailed; off when it reads NotSubmitted again; the same through Reopen and a second Complete); the smoke grows it (after the two solo runs the two packages are off Available; a second mirror drop with them as TestFailed lists them again, and the gate's Ready count moves by two with them). The pane on the fixture after the fix: the four never scheduled, the done run's two gone.

## Observations for his word (no hold)

- A package whose app row sits in `created` or `cryo_queue` (a trim package not yet through cryo) would refuse Complete with a 409, since `rad_complete` runs from `released` or `pasteurized` only, the brief's own words; none of the floor's 164 candidates has such a row today. If the crew will send cryo-queue packages to the Rad instead of cryo, that is one more edge in the transition, his call.
- A second pass on a completed package needs its lab state to move first; if he wants a re-run before METRC moves, a control is a later line.
- The grow types sort Indoor, Outdoor, Greenhouse, then any other name; the doc fixed no order, the build picked one.
- A package line reads its list number and its position side by side ("1. 1 00017 ..."); one of the two is a tidy.
- The smoke on the fixed tree answered a 500 on `/ops/drying_ops` once, early and far from the Rad's walk, with no server error logged; the rerun passed clean, as the tree as received had, and the Scribe reads it as the sandbox's wrangler, not the tree.

## Gates on the tree as received (the Scribe's sandbox, the worktree's `app/`)

- `npm run typecheck` with the generated types file deleted first: exit 0.
- `npx vitest run`: 72 files, 1003 tests passed; the same under `TZ=America/New_York`.
- `node --check scripts/smoke.mjs` and `node --check scripts/icon-proofs.mjs`: ok.
- `npm run proofs:icons`: the sheet 105,377 bytes, `85b22429de13e975`, unchanged.
- From-zero smoke (`SMOKE_PORT=9235`): `About to apply 85 migration(s)`, `SMOKE PASS`, no ` 500 ` line.
- Migration 0085 rehearsed on the 20:57 pre snapshot: the two tables, three indexes, the second run refused.
- Dash audit: 0 (em and en), and no CR byte, on the thirteen files and the build report. Secret grep: no value anywhere. No personnel data.

## Gates on the fixed tree (the Scribe's sandbox copy)

- `npm run typecheck`: exit 0. `npx vitest run`: 72 files, 1004 tests passed, UTC and `TZ=America/New_York`.
- `node --check scripts/smoke.mjs`: ok. From-zero smoke (`SMOKE_PORT=9241`): `About to apply 85 migration(s)`, `SMOKE PASS`, no ` 500 ` line.
- The pages driven in the browser: the filter, the clock, the Available pane without the done run's packages.
- Four files changed against the tree as received, nothing else; dash 0, CR 0, no secret value, no personnel data in the change.

## Landing the fix (his word)

On his "do it", the Scribe writes the four files whole to the worktree on his disk (`app/src/db.ts`, `app/src/rad.ts`, `app/test/rad.test.ts`, `app/scripts/smoke.mjs`), verifies each hash below, re-hashes the app tree to `516bc3f2b239e24a`, and this report's seal stands as the fixed tree's; then the merge below.

## The merge (his hands, after the fix lands; the snapshot first and the block stopping on its failure, the canon checkout before the merge)

```powershell
cd "C:\Users\DennisWallace\Documents\Claude\Projects\gripfactory Practical\app"
node scripts/db-snapshot.mjs pre_rad
if ($LASTEXITCODE -ne 0) { throw "snapshot failed, stop here" }
cd "C:\Users\DennisWallace\Documents\Claude\Projects\gripfactory Practical\branches\GFLiteOpsDashboard"
git add -A
git commit -m "V9: the Rad schedule and Rad operation" -m "Migration 0085: rad_runs and rad_run_packages. Two tiles on the Compliance Console. Rad Schedule: the mirror's live BUD, WPR, SHA, PRE, MOB and WBP packages in NotSubmitted, TestFailed or RetestFailed, sorted by state, type, grow type and the tag's last five, with the filter; runs of one to ten packages with the grey per run (100 to 3000 by 100, the newest run's value the default); Done with the completed runs. Rad Operation: Start one run at a time, the clock, Complete, Reopen behind the Admin PIN, every stamp logged. Complete marks the tags pasteurized for the Testing gate, returns a released or pasteurized app row to the testing queue, adopts a METRC-only package into it, and sends nothing to METRC. The gate's fix: a completed package stays off Available until METRC moves its lab state. Canon 0.30.328, the brief and the gate report ride in canon/, BRIEFS/ and SESSION_REPORTS/.`n`nCo-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`nClaude-Session: https://claude.ai/code/session_01VDz7UdaTSkjq69GvDfDWd7"
cd "C:\Users\DennisWallace\Documents\Claude\Projects\gripfactory Practical"
git checkout -- canon
git merge --no-ff GFLiteOpsDashboard -m "Merge V9: the Rad schedule and Rad operation"
git push
```

If the snapshot answers 7403 on its first query, run the snapshot line alone once more and then the rest. The push runs the workflow: typecheck, the tests, `apply migrations` (0085, the pin 85), the deploy. His paste back: the snapshot's last line, the push's output, the run's result and the Version ID from the deploy step's log; the Scribe reads main after the merge, folds LIVE, and the next brief is V7 DRYING after his live walk of CSA and CSB (ruling 12), else V10, pasteurization on the console.

## Sealed final check

```
THE TREE AS RECEIVED (188c24fb60d59ea9, the same on his disk)
rm worker-configuration.d.ts; npm run typecheck      exit 0
npx vitest run                        72 files, 1003 tests passed
TZ=America/New_York npx vitest run    72 files, 1003 tests passed
node --check scripts/smoke.mjs        ok
node --check scripts/icon-proofs.mjs  ok
npm run proofs:icons                  85b22429de13e975, 105377 bytes, unchanged
rm -rf .smoke-persist && CI=1 SMOKE_PORT=9235 WRANGLER_SEND_METRICS=false npm run smoke
                                      About to apply 85 migration(s); SMOKE PASS; " 500 " lines: 0
migration 0085 on the 20:57 pre snapshot   2 tables, 3 indexes, no rows; run 2 refused
the Available law on that snapshot    164 of 11,746 live mirror packages (BUD 53, WPR 59, SHA 23, WBP 29); app rows: 88 none, 18 released, 58 queued, 0 that would refuse Complete
the fixture by hand                   a run of three at 1500 Gy running, a done run of two, a scheduled run of one; the done run's two back on Available (the hold)
the seal (13 files) verified byte for byte, device and sandbox:
app/migrations/0085_rad_runs.sql                1060  eb11677b247b2a75
app/src/rad.ts                                 26157  b2c9426486df1ff1
app/src/db.ts                                 205901  6d8ccc429e6787bb
app/src/actions.ts                            405955  537eafb81fc75c41
app/src/config.ts                              76216  89c79de8eed18391
app/src/console.ts                            113057  89efc907f4998b54
app/src/compliance.ts                          26992  14846a3349fdb830
app/src/theme.ts                              177119  cf2f28b2ff8f8d9f
app/src/i18n.ts                               195649  351caa8d53a26591
app/src/index.ts                              156500  cb102b43123561fa
app/scripts/smoke.mjs                         672274  ead0d7ba67a1d146
app/test/rad.test.ts                           11476  828a18bcc3a9452d
app/test/console.test.ts                       69550  ad323ea16a25a63d
changed against the live tree, not in the seal: none
the build report: 2026-10-01_the_rad_schedule_and_rad_operation.md 7742 d758549bc6159433
dash audit: 0; CR audit: 0; secret grep: no values; personnel data: none

THE FIXED TREE (516bc3f2b239e24a, the Scribe's sandbox copy)
npm run typecheck                     exit 0
npx vitest run                        72 files, 1004 tests passed
TZ=America/New_York npx vitest run    72 files, 1004 tests passed
node --check scripts/smoke.mjs        ok
CI=1 SMOKE_PORT=9241 ... npm run smoke   About to apply 85 migration(s); SMOKE PASS; " 500 " lines: 0
the pages in the browser              the filter four rows to one; the clock 0d 00:00:18 then 0d 00:00:19; the done run's packages off Available
the four files:
app/src/db.ts                                 206843  771231ada4912288
app/src/rad.ts                                 26492  3027824f158d6c1f
app/test/rad.test.ts                           13123  21a080e88e7e0f0a
app/scripts/smoke.mjs                         674156  233af51816708362
changed against the tree as received, not in the four: none
dash audit: 0; CR audit: 0; secret grep: no values; personnel data: none
```
