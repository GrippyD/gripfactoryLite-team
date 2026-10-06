# 2026-10-06 The gate on R3, Weighted BTR to date (canon 0.30.414): PASSED, MOVED TO THE WORKTREE

Scribe session. MINI BRIEF R3 (`BRIEFS/2026-10-05_trim_btr_to_date.md`, re-pinned 0.30.411 to `d5c56d6a8251056e`), built by his Code session. Its report `SESSION_REPORTS/2026-10-05_trim_btr_to_date.md`. Its hand-back, verbatim in part: "The fifth cell is on the trim totals bar. The tree after the edit is `a3fc79a982c12ae8`".

VERDICT: PASSED. The build itself needed no change.

## The build was in the main folder

The session built R3 in the main folder's `app/` (`gripfactory Practical\app`), not in the worktree. The worktree still hashed `d5c56d6a8251056e`, with no R3 report, and the main folder's `app/` differed from HEAD `cc69686` in four files, with the report and four screenshots untracked in the main folder's `SESSION_REPORTS/`. Left as it was, the merge would have refused on the dirty main folder.

What the Scribe did, all plain file copies, no git:
1. Copied the four changed files from the main folder into the worktree (byte for byte, checked with cmp).
2. Moved the report and its four screenshots into the worktree's `SESSION_REPORTS/`.
3. Put the main folder's four files back to HEAD from `git archive HEAD`. The main folder's `src`, `test`, `scripts` and `migrations` again equal HEAD `cc69686`, and nothing of R3 is left untracked there.

The worktree now hashes `a3fc79a982c12ae8` by canon's command (299 files), the report's own figure.

## What was gated

1. THE TREE. Staged as `gateR3.tar`; `a3fc79a982c12ae8`, 299 files, on the disk and in the sandbox. Against the live tree only four files differ, every line read: `src/console.ts` 172,729 `2b578c72a7cbd3e2`, `src/i18n.ts` 265,002 `dd642f0afb2b15f1`, `test/console.test.ts` 97,575 `dee54b2561b67a1a`, `scripts/smoke.mjs` 799,990 `5a0060aaf88425bc`.
2. THE CODE. `TRIM_SEASON_SQL` sums `wip_packages` with source null, not deleted, on live lots of live batches of the year, by lot and type; `weightedBtrToDate` pools the bud types (Admin's `btr_type_codes`) over every type by grams, one ratio; no package gives "no trim this season". The four cells and `consoleYields` (the season rate farms borrow, finished lots only) are untouched.
3. GATES: typecheck 0; 91 files, 1,226 tests UTC and New York; `node --check scripts/smoke.mjs` 0; the from-zero smoke `About to apply 94 migration(s)`, SMOKE PASS, no ` 500 `, exit 0. (The Scribe's first smoke failed on a missing `/brand/factory-plate.png` because the Scribe's own tar left out PNG files; with the public images restored from the live tree the run passed.)
4. RECOMPUTED by the Scribe on `20261005-194819_pre_r4`: 2,715 packages, 39 lots, 48,021,086 g, bud 15,596,703 g, 32.5 percent; no package on a deleted lot. The build reports the same.
5. RENDERED by the Scribe on the smoke data in Lite, CO and Cerberus at 1920, 1366 and 390 wide: the cells read `lbs, hours, per, btr, btr_to_date`; "Weighted BTR to date 18.3%, 2 lots, 2.36 lb trimmed this season"; at 390 the cell wraps to the next line and stays inside the screen. No page error.

## For his word (no hold)

- One lot reads "1 lots"; a singular is a one line touch.
- At phone width the dashboard page is wider than the screen (432 against 390), from the top bar and the dry tiles, not this cell. Already so before R3.

## Sealed final check

```
THE MAIN FOLDER                       src, test, scripts, migrations = HEAD cc69686 (restored by copy)
THE TREE (a3fc79a982c12ae8 by canon's command, 299 files); four files changed
npm run typecheck                     exit 0
TZ=UTC npx vitest run                 91 files, 1226 tests passed
TZ=America/New_York npx vitest run    91 files, 1226 tests passed
CI=1 SMOKE_PORT=9453 npm run smoke    About to apply 94 migration(s); SMOKE PASS; " 500 " lines: 0; exit 0
recompute (pre_r4)                    15,596,703 of 48,021,086 g; 32.5 percent; 39 lots
render 1920, 1366, 390; three views   after btr; wraps on a phone; no error
dash audit (by character): 0; CR audit: 0; personnel data: none
```

## The merge (his hands; no migration)

```powershell
cd "C:\Users\DennisWallace\Documents\Claude\Projects\gripfactory Practical\app"
node scripts/db-snapshot.mjs pre_r3
if ($LASTEXITCODE -ne 0) { throw "snapshot failed, stop here" }
cd "C:\Users\DennisWallace\Documents\Claude\Projects\gripfactory Practical\branches\GFLiteOpsDashboard"
git add -A
git commit -m "R3: Weighted BTR to date on the trim totals bar" -m "A fifth cell after the day's Weighted BTR: this season's live trim packages in one pool, the bud types in btr_type_codes over every type by weight, with the lots and pounds under it. The day's four cells and the season rate farms borrow unchanged. No migration. Canon 0.30.413 to 0.30.414.`n`nCo-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`nClaude-Session: https://claude.ai/code/session_01VDz7UdaTSkjq69GvDfDWd7"
cd "C:\Users\DennisWallace\Documents\Claude\Projects\gripfactory Practical"
git checkout -- canon
git merge --no-ff GFLiteOpsDashboard -m "Merge R3: Weighted BTR to date"
git push
```

His paste back: the Version ID.
