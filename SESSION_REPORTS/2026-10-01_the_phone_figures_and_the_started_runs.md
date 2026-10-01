# 2026-10-01 The phone figures and the started runs (canon 0.30.338)

Scribe session, built Scribe-direct under G-2 at his word on the V10 gate (`SESSION_REPORTS/2026-10-01_gate_pasteurization_on_the_console.md`, canon 0.30.337), on the worktree `branches/GFLiteOpsDashboard` as his Code session handed it back: the app tree `4a1633f310b4d01d`, 256 files, with the four files below at their sealed hashes, checked on his disk before the landing. No migration beyond V10's 0086; the smoke pin stays 86. Landed in the worktree; not committed, not pushed, not deployed. The merge block below is his hands and replaces the gate report's.

## His word (owner, 2026-10-01, his picks verbatim)

1. "Do it, land the fix (Recommended)", to the gate's question "Should I land the phone fix (src/theme.ts) in the worktree before you push V10?"
2. "Started runs only (Recommended)", to the gate's question on the open runs' line, which also counted the runs not yet started.

## What changed

- `src/theme.ts`, the gate's fix as gated in 0.30.337, byte for byte. In each of its three stylesheets the five figures' panes take `flex: 1 1 5rem; min-width: 5rem`, so the row wraps (three and two on a phone), and the value takes `overflow-wrap: normal`, so a number breaks only at its space. Desk width still shows one row.
- `src/console.ts` (`livePasteurization`): the open runs' line counts a scheduled run only once an output is entered on it (its outputs' grams above zero); its inputs above its outputs then count as before. A run with no output yet is queued, not held, and is not on the line. The words do not move ("{n} open runs hold {lbs} lb not yet entered out"). The comments on the type, the figures, the function and the query state the law.
- `test/pasteurization.test.ts`:
  - The plural case's second run is now started (150 g in, 50 g out), keeping the same 300 g and "2 open runs hold 0.67 lb".
  - One new case: a queued run alone shows no line; a started run beside a queued run and an overrun reads "1 open run holds 0.45 lb".
- `scripts/smoke.mjs`: the feed run, scheduled with its pool and nothing entered, leaves the line absent while the Right now pane's cryo half is present. After its first line (20 g WPR), the line names the one started run holding the pool less 20 g, in pounds at the app's 448 g pound. The rest of the walk is as before.

## The floor, through the code itself (the 09:52 backup)

The sixteen scheduled cryo runs' inputs and outputs were read from `db_backups/20261001-095251_pre_floor_fixes` on his disk and run through `livePasteurization` in the sandbox:

- The line as received read "15 open runs hold 2,659.31 lb not yet entered out" (1,191,370 g).
- The line now reads "12 open runs hold 759.56 lb not yet entered out" (340,281 g).
- The 3 queued runs (851,089 g, 1,899.75 lb) are off it.

A CORRECTION: the gate report and the gate's question gave these pounds at the 453.59 g pound (2,626.52, 1,876.33, 750.19). The line reads the app's 448 g trade pound, so the figures above are the line's own. The gate report is corrected in place and its block is marked replaced. His pick does not change with the pound.

## Gates (the Scribe's sandbox, the tree `ad43429a2ee9b8a6`)

- `npm run typecheck`, with the generated types file deleted first: exit 0.
- `npx vitest run`: 73 files and 1025 tests passed under `TZ=UTC`, and the same under `TZ=America/New_York`. That is one more test than V10's 1024: the new case.
- `node --check scripts/smoke.mjs`: ok.
- From-zero smoke (`SMOKE_PORT=9283`): `About to apply 86 migration(s)`, `SMOKE PASS`, no ` 500 ` line. The two "Request was cancelled" lines are wrangler's own, the same as in V10's run.
- The phone fix's renders from 0.30.337 still hold: the theme file is the one gated there, byte for byte.
- Audits on the four files: dash 0, no CR byte, no BOM. No secret value. No personnel data added: the smoke's cryo operator is its own pre-existing fixture, and its count is unchanged.

## Landing (done, at his word)

The four files were written whole to the worktree on his disk, after checking that it read `4a1633f310b4d01d` with the four at their sealed hashes, and verified by hash afterward. The worktree's app tree reads `ad43429a2ee9b8a6` (256 files).

## The merge (his hands; the snapshot first and the block stopping on its failure, the canon checkout before the merge)

```powershell
cd "C:\Users\DennisWallace\Documents\Claude\Projects\gripfactory Practical\app"
node scripts/db-snapshot.mjs pre_pasteurization
if ($LASTEXITCODE -ne 0) { throw "snapshot failed, stop here" }
cd "C:\Users\DennisWallace\Documents\Claude\Projects\gripfactory Practical\branches\GFLiteOpsDashboard"
git add -A
git commit -m "V10: pasteurization on the console" -m "Migration 0086: pasteurization_labor_hours and the pasteurization shifts' own operators and windows in app_config. The Harvest Console's Pasteurization section replaces the stub: Right now with the Rad half (the run in the Rad, its lots, grey and clock, the cube throbbing green) and the Cryo half (his CRYO, AMAPS and UV picture, the list since the day began, RUNNING or DOWN, the open runs' line counting the started runs); two shift panes for the day picked with Bulk Bud, Prepack, Shake, Waste and Total, Total Hours with Save and Lbs/DLH; the waste inputs less outputs at Finish run. The gate's fixes at his word: the figures wrap on a phone and a number never breaks; a run with no output yet is queued, not on the open runs' line. Canon 0.30.337 and 0.30.338; the brief and the reports ride in canon/, BRIEFS/ and SESSION_REPORTS/.`n`nCo-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`nClaude-Session: https://claude.ai/code/session_01VDz7UdaTSkjq69GvDfDWd7"
cd "C:\Users\DennisWallace\Documents\Claude\Projects\gripfactory Practical"
git checkout -- canon
git merge --no-ff GFLiteOpsDashboard -m "Merge V10: pasteurization on the console"
git push
```

If the snapshot answers 7403 on its first query, run the snapshot line alone once more and then the rest. The push runs the workflow: typecheck, the tests, `apply migrations` (0086, the pin 86), the deploy. His paste back is the snapshot's last line and the Version ID. The Scribe then reads main and folds LIVE. After that come the two operator lists, named in Admin, Lookups, app_config (`pasteurization_shift_day_operators`, `pasteurization_shift_second_operators`), and V7 DRYING after his live walk of CSA and CSB.

## Sealed final check

```
THE TREE BEFORE (as received, 4a1633f310b4d01d, on his disk before the landing)
app/src/theme.ts                                 186520  2c724b2dac512493
app/src/console.ts                               153417  380728452effcc92
app/test/pasteurization.test.ts                   35390  4a6f2d27ae3bb971
app/scripts/smoke.mjs                            697398  a799eca7d1e8839f

THE FIXED TREE (ad43429a2ee9b8a6, 256 files, the sandbox and his disk)
rm worker-configuration.d.ts; npm run typecheck      exit 0
TZ=UTC npx vitest run                 73 files, 1025 tests passed
TZ=America/New_York npx vitest run    73 files, 1025 tests passed
node --check scripts/smoke.mjs        ok
rm -rf .smoke-persist && CI=1 SMOKE_PORT=9283 WRANGLER_SEND_METRICS=false TZ=UTC npm run smoke
                                      About to apply 86 migration(s); SMOKE PASS; " 500 " lines: 0
the floor through livePasteurization  as received 15 runs 1,191,370 g 2,659.31 lb; now 12 runs 340,281 g 759.56 lb; queued 3 runs 851,089 g 1,899.75 lb
app/src/theme.ts                                 186841  49c680eb6161d7ff
TAIL }
app/src/console.ts                               153838  3b023ae322bf1c1c
TAIL }
app/test/pasteurization.test.ts                   36652  b11277e8164b89d7
TAIL });
app/scripts/smoke.mjs                            697928  29475c320dddf6f6
TAIL });
changed against the tree as received, not in the four: none
dash audit: 0; CR audit: 0; BOM: none; secret grep: no values; personnel data: none added
```
