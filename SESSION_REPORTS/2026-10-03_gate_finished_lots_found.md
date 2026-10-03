# 2026-10-03 The gate on V26, finished lots, found (canon 0.30.374): PASSED

Scribe session. BRIEF V26, FINISHED LOTS, FOUND (`BRIEFS/2026-10-03_finished_lots_found.md`, 5,797 bytes, `23345ec7274c7359`), built by his Code session in the worktree on the live tree `f16eeacbfd987ca3` (281 files). Its report `SESSION_REPORTS/2026-10-03_finished_lots_found.md` (15,320 bytes). His hand-back, verbatim in part: "The tree arrived exactly as pinned (`f16eeacbfd987ca3`, 281 files) and now hashes `b333d595286a8b10` (283 files)"; "85 files and 1153 tests pass under both `TZ=UTC` and `TZ=America/New_York`"; "Nothing is committed, pushed or deployed, and no git was run."

VERDICT: PASSED. Nothing held, nothing changed by the Scribe.

## What was gated

1. THE MAIN FOLDER: `src`, `test`, `scripts` and `migrations` of the main folder's `app/` equal HEAD `ba9c00a` (read-only `git archive`). Clean for the merge.
2. THE TREE. Staged as `gateV26.tar` (11,018,240 bytes, `9926fa7b49c7b6b8`, no node_modules, no persist folders), unpacked; `b333d595286a8b10` both sides, 283 files; against the live tree exactly the report's 2 new files (`src/finishedlots.ts`, `test/finishedlots.test.ts`) and 4 changed (`src/index.ts`, `src/fieldharvest.ts`, `src/i18n.ts`, `scripts/smoke.mjs`); no migration.
3. GATES: typecheck 0; 85 files, 1,153 tests under `TZ=UTC` and `TZ=America/New_York`; `node --check` ok; the from-zero smoke `About to apply 90 migration(s)`, SMOKE PASS, no ` 500 `; dash, CR and BOM audits 0 on the six files, by character.
4. THE CODE, read: Void is one batch (the tote soft-deleted with `deleted_by`, the log row with the reason, the lot total recomputed by the wet ledger and logged, the package `qty` lowered and logged), refused off weighing, in transit and drying, on a package not SPR or WIP, with children, outside its space, or holding fewer grams than the tote, and on a lot with two live packages; Reopen is the queue's Demote through `runQueueControl`, only on drying or in transit. Both behind the Admin PIN at save.

## The readings (report items), the Scribe's read

1. The PIN at save on Void and Reopen (the weigh screens are open to the floor; the queue's Demote is gated by its page): right.
2. "Has left its space" as the birth barn, the lot's space or its METRC location: right.
3. The two extra refusals (two live packages; a package lighter than the tote): right, both protect the package from going wrong silently.
4. The field node's all-totes list also on a lot carried across loads by a NO send: right, it is the same picture.
5. Not fixed: the existing tote pencil and the x still change a finished lot's totes without the status check and without moving the package. For his word: a later slice puts them behind Void's own law.
6. A note of the Scribe's: a tote weighed after a Reopen is not yet in the package's `qty` (the Demote leaves the package as it was; the next finish sets it to the lot's total), so voiding that tote before the next finish lowers the package by grams it never held. The next finish puts it right, and the package-lighter-than-the-tote refusal bounds it; worth closing in the same later slice.

## Sealed final check

```
THE MAIN FOLDER                       src, test, scripts, migrations = HEAD ba9c00a
THE TREE AS RECEIVED AND GATED (b333d595286a8b10, 283 files; the live tree f16eeacbfd987ca3)
npm run typecheck                     exit 0
TZ=UTC npx vitest run                 85 files, 1153 tests passed
TZ=America/New_York npx vitest run    85 files, 1153 tests passed
node --check scripts/smoke.mjs        ok
CI=1 SMOKE_PORT=9426 npm run smoke    About to apply 90 migration(s); SMOKE PASS; " 500 " lines: 0
new (2): app/src/finishedlots.ts, app/test/finishedlots.test.ts
changed (4): app/src/index.ts, app/src/fieldharvest.ts, app/src/i18n.ts, app/scripts/smoke.mjs
dash audit (by character): 0; CR audit: 0; BOM: 0; personnel data: none
```

## The merge (his hands; no migration)

```powershell
cd "C:\Users\DennisWallace\Documents\Claude\Projects\gripfactory Practical\app"
node scripts/db-snapshot.mjs pre_v26
if ($LASTEXITCODE -ne 0) { throw "snapshot failed, stop here" }
cd "C:\Users\DennisWallace\Documents\Claude\Projects\gripfactory Practical\branches\GFLiteOpsDashboard"
git add -A
git commit -m "V26: finished lots, found" -m "Penn North Harvest and the field node list the screen's lots finished in the last 8 farm days; each lot's page shows every tote, voided ones struck with their reason; Void a tote (soft, logged, the lot and its wet package lower in one batch) and Reopen (the queue's Demote) behind the Admin PIN; a reopened lot weighs with all its earlier totes on screen. No migration. Canon 0.30.372 to 0.30.374.`n`nCo-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`nClaude-Session: https://claude.ai/code/session_01VDz7UdaTSkjq69GvDfDWd7"
cd "C:\Users\DennisWallace\Documents\Claude\Projects\gripfactory Practical"
git checkout -- canon
git merge --no-ff GFLiteOpsDashboard -m "Merge V26: finished lots, found"
git push
```

His paste back: the Version ID.
