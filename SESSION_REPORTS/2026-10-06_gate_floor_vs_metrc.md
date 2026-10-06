# 2026-10-06 The gate on FM1, Floor vs METRC (canon 0.30.417): PASSED

Scribe session. BRIEF FM1 (`BRIEFS/2026-10-06_floor_vs_metrc_report.md`), built by his Code session in the worktree on the R3 tree `a3fc79a982c12ae8`, alone (PC1 was not built in it; the brief's order had PC1 first). Its report `SESSION_REPORTS/2026-10-06_floor_vs_metrc.md`. Its hand-back, verbatim in part: "The app tree is now `cba603e2aee6dc4b` (301 files). Nothing was committed, pushed, or deployed."

VERDICT: PASSED. No change by the Scribe.

## What was gated

1. THE MAIN FOLDER: `src`, `test`, `scripts` and `migrations` of the main folder's `app/` equal HEAD `94efece` (R3 merged; origin/main the same), whose app tree is `a3fc79a982c12ae8`. Clean for the merge. This time the build was in the worktree.
2. THE TREE. Staged as `gateFM1.tar`; canon's tree hash `cba603e2aee6dc4b`, 301 files, the report's figure. Against the R3 tree: two new files (`src/floormetrc.ts` 27,224 `c5865c1c50cfd154`, `test/floormetrc.test.ts` 12,219 `6ebd67e125d8b0be`) and six changed (`src/i18n.ts` 267,257 `f6bfb3cebec03e00`, `src/index.ts` 176,598 `e465c4ee1b1fa22f`, `src/reports.ts` 35,653 `cd1622b215131d55`, `src/theme.ts` 198,876 `23127cb30f32cadc`, `test/console.test.ts` 97,628 `85399f0778d9573c`, the report count now 13; `scripts/smoke.mjs` 802,353 `7062b05b70b07d75`). Every line read.
3. THE CODE. `loadFloorVsMetrc` only reads (seven SELECTs; no INSERT, UPDATE or DELETE). Section A takes live floor items with a 24 character tag, matched by the exact tag; unlike units are named, never subtracted; within 1 is Same. Section B pairs each lot's live SPR items with live mirror packages whose item starts `SPR - ` and whose source harvest is the HBN; a voided batch with a live METRC SPR reads "Lot voided on the floor". Open uploads are not cleared and not deleted.
4. GATES: typecheck 0; 92 files, 1,232 tests UTC and New York; `node --check scripts/smoke.mjs` 0; the from-zero smoke `About to apply 94 migration(s)`, SMOKE PASS, no ` 500 `.
5. RECOMPUTED by the Scribe on `20261005-203534_post_plants` before the brief was written, and the build's figures agree: Section A 671 rows (WIP 95 same, 308 weight differs, 1 not in METRC; FG 2 same, 225 units differ, 40 not in METRC; no license differs); Section B 26027, 26028, 26061, 26063 weight gaps and 26062 voided on the floor (METRC SPR 737,135 g).
6. RENDERED by the Scribe on the smoke data in Lite, CO and Cerberus at 1920 and 390: 200, the title, "METRC as of" in Eastern time, two tables (10 and 3 rows by default, 17 and 3 with all findings); the CSV answers 200. At 390 the tables scroll inside their box; the page's extra width there is the top bar, as on every page. No page error.

## For his word (no hold)

- Section A's 308 WIP weight gaps are mostly floor packages used up (0 g) that METRC still holds: the finishes and adjusts owed to METRC, read from one page now.

## Sealed final check

```
THE MAIN FOLDER                       src, test, scripts, migrations = HEAD 94efece (a3fc79a982c12ae8)
THE TREE (cba603e2aee6dc4b by canon's command, 301 files); two new, six changed
npm run typecheck                     exit 0
TZ=UTC npx vitest run                 92 files, 1232 tests passed
TZ=America/New_York npx vitest run    92 files, 1232 tests passed
CI=1 SMOKE_PORT=9454 npm run smoke    About to apply 94 migration(s); SMOKE PASS; " 500 " lines: 0
render 1920 and 390, three views      200; two tables; CSV 200; no error
dash audit (by character): 0; CR audit: 0; personnel data: none
```

## The merge (his hands; no migration)

```powershell
cd "C:\Users\DennisWallace\Documents\Claude\Projects\gripfactory Practical\app"
node scripts/db-snapshot.mjs pre_fm1
if ($LASTEXITCODE -ne 0) { throw "snapshot failed, stop here" }
cd "C:\Users\DennisWallace\Documents\Claude\Projects\gripfactory Practical\branches\GFLiteOpsDashboard"
git add -A
git commit -m "FM1: Floor vs METRC report" -m "Reports gains Floor vs METRC, read only: the floor's packages with a full tag beside the METRC mirror, each lot's SPR package beside METRC's, each difference naming the lot's open Pending Data Uploads. No migration. Canon 0.30.416 to 0.30.417.`n`nCo-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`nClaude-Session: https://claude.ai/code/session_01VDz7UdaTSkjq69GvDfDWd7"
cd "C:\Users\DennisWallace\Documents\Claude\Projects\gripfactory Practical"
git checkout -- canon
git merge --no-ff GFLiteOpsDashboard -m "Merge FM1: Floor vs METRC"
git push
```

His paste back: the Version ID.
