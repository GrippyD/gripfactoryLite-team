# 2026-09-29 The gate on CSB ends at the trim finish (canon 0.30.304): PASSED

Scribe session. The gate on V13, CSB ENDS AT THE TRIM FINISH (BRIEF V13, canon 0.30.303), on his Code session's `SESSION_REPORTS/2026-09-29_csb_ends_at_the_trim_finish.md` in the worktree `branches/GFLiteOpsDashboard`. The report says "Not deployed. Nothing committed. No git was run."; the disk agrees. No Scribe change to the worktree's app. His hand-back, verbatim in part: "CSB now holds a lot only while its newest live trim row is still scheduled, and the lot leaves both panes the moment that row completes. No migration, pin stays 80."

VERDICT: PASSED. The tree is the brief's three files and nothing else, every check is green, and the built query run against the 9/29 snapshot puts exactly his four lots on CSB and the seven finished ones on neither pane. V13 is ready to merge; the pre snapshot first, the block stopping on its failure, `git checkout -- canon` in the main folder, then the three acts.

## What was gated

1. THE TREE. Against V12's tree (`5e2160baab072768`): three files changed (`src/cure.ts`, `test/cure.test.ts`, `scripts/smoke.mjs`), nothing new, nothing outside the seal; no migration; every other file untouched (`find -newer` on his disk names the three alone). The worktree's app tree hashes `5fc1f2cacc973a8f` on his disk, and the Scribe's sandbox (V12's gated tree with the three staged files) hashes the same, so the sandbox is the worktree byte for byte. The seal matches (size, sha256, tail) on his disk and in the sandbox, the build report included. The worktree's `canon/` (0.30.303) and the brief as the Scribe placed them.
2. THE LAW (laws 1 and 2), read line by line: `cureMembership({ status, deleted, trimStatus })` answers CSB for an unloaded lot whose newest live trim row is `scheduled`, CSA for an unloaded lot with no live row, and neither for a complete row, a `trimmed`, frozen or voided lot; `LOTS_SQL` reads the newest live trim row's `scheduled_at` and `status` by one order (`scheduled_at` descending, then `id`, so the in-time and the status are the same row) and no longer reads `in_cryo`. The header comment carries the ruling and the canon number.
3. THE FLOOR (the brief's count), the built `LOTS_SQL` run against the 9/29 snapshot's `wet_weight_entries`, `harvest_batches` and `production_schedules` on a database built from the eighty migrations, then the built membership: CSA 13 (26049, 26050, 26051, 26052, 26053, 26055, 26056, 26057, 26058, 26059, 26064, 26065, 26067, unchanged), CSB 4 (26042, 26043, 26045, 26048), the seven finished between 9/23 and 9/28 (26016, 26034, 26037, 26038, 26039, 26041, 26047) on neither pane. His count exactly; no data repair.
4. THE IN-TIMES, THE READINGS, THE MARKS (law 3) untouched in the diff; THE TOTALS (law 4) follow because `cureLots` on the console is `[...csa, ...csb]`, unchanged code reading the changed panes.
5. THE PROOFS (law 6): `test/cure.test.ts` pins the ten cases of the membership (scheduled on CSB; complete, trimmed, frozen, voided on neither; no row and a blank row on CSA) and the fixture of `listCurePanes` carries a complete-row lot that must not be listed; the smoke's scheduling walk sees the lot on CSB, completes the trim row and sees it gone from CSB and not on CSA, then unfinishes the row with the Models PIN so the later cryo walk finds the lot still on CSB with the cryo exit retired.

## Observations for his word (no hold)

- `LOTS_SQL` still selects `trimmed` lots (the WHERE keeps `status IN ('unloaded', 'trimmed')`) and the membership drops them; a few rows read for nothing. A later tidy.
- The observations of 0.30.296 and 0.30.300 stand.

## Gates on the tree as received (the Scribe's sandbox, the worktree's `app/`)

- `npm run typecheck` with the generated types file deleted first: exit 0.
- `npx vitest run`: 67 files, 968 tests passed; the same under `TZ=America/New_York`.
- `node --check scripts/smoke.mjs` and `node --check scripts/icon-proofs.mjs`: ok.
- From-zero smoke (`SMOKE_PORT=9214`): `About to apply 80 migration(s)`, `SMOKE PASS`, no ` 500 ` line; the dev server ended by the timeout after the pass.
- The floor read: the built query and membership against the 9/29 snapshot, CSB 4, the seven on neither.
- Dash audit: 0 (em and en), and no CR byte, on the three files, the build report, `wrangler.toml`, `tsconfig.json` and `package.json`. Secret grep (six patterns): no value anywhere. No personnel data.

## The merge (his hands, the snapshot first and the block stopping on its failure; the canon checkout before the merge, the rule of 0.30.301)

```powershell
cd "C:\Users\DennisWallace\Documents\Claude\Projects\gripfactory Practical\app"
node scripts/db-snapshot.mjs pre_csb_trim_finish
if ($LASTEXITCODE -ne 0) { throw "snapshot failed, stop here" }
cd "C:\Users\DennisWallace\Documents\Claude\Projects\gripfactory Practical\branches\GFLiteOpsDashboard"
git add -A
git commit -m "V13: CSB ends at the trim finish" -m "CSB is the trim queue: a lot is on it while its newest live trim row is scheduled and leaves both panes the moment that row completes; the cryo exit of 9/21 retires; the console's cure totals follow; no migration. Canon 0.30.304 and the V13 brief ride in canon/ and BRIEFS/.`n`nCo-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`nClaude-Session: https://claude.ai/code/session_01VDz7UdaTSkjq69GvDfDWd7"
cd "C:\Users\DennisWallace\Documents\Claude\Projects\gripfactory Practical"
git checkout -- canon
git merge --no-ff GFLiteOpsDashboard -m "Merge V13: CSB ends at the trim finish"
git push
```

`git checkout -- canon` discards the main folder's working copy of the three canon files, which is the branch's own bytes (the Scribe writes every fold to both places and verifies the hashes), and the merge puts the same bytes back. If the snapshot answers 7403 on its first query, run the snapshot line alone once more and then the rest. The workflow has nothing to apply and deploys. His paste back: the snapshot's last line, the push's output, the run's result and the Version ID from the deploy step's log; the Scribe reads main after the merge and folds LIVE.

## Sealed final check

```
rm worker-configuration.d.ts; npm run typecheck      exit 0
npx vitest run                        67 files, 968 tests passed
TZ=America/New_York npx vitest run    67 files, 968 tests passed
node --check scripts/smoke.mjs        ok
node --check scripts/icon-proofs.mjs  ok
rm -rf .smoke-persist && CI=1 SMOKE_PORT=9214 WRANGLER_SEND_METRICS=false npm run smoke
                                      About to apply 80 migration(s); SMOKE PASS; " 500 " lines: 0
the floor read (9/29 snapshot)        CSA 13; CSB 4 (26042, 26043, 26045, 26048); the seven finished on neither
the build report's seal (3 files) verified byte for byte, device and sandbox:
app/src/cure.ts                      17813  368f409635aec29f
app/test/cure.test.ts                11119  7f8cee438c64b5c4
app/scripts/smoke.mjs               624827  540820cb3383fe13
changed against V12's tree, not in the seal: none
the app tree: 5fc1f2cacc973a8f (V12's 5e2160baab072768 plus the three), the same on his disk
the build report: SESSION_REPORTS/2026-09-29_csb_ends_at_the_trim_finish.md  3709  292f5cbf1f3dd755
dash audit: 0; CR audit: 0; secret grep: no values; personnel data: none
```
