# 2026-10-03 The gate on V25, the station is the test record (canon 0.30.371): PASSED WITH ONE FIX

Scribe session. BRIEF V25, THE STATION IS THE TEST RECORD (`BRIEFS/2026-10-03_the_station_is_the_test_record.md`, 6,252 bytes, `fb6bb470a3699671`), built by his Code session in the worktree on `a6f59f0241277ece` (281 files, the live tree plus the Scribe's repair file). Its report `SESSION_REPORTS/2026-10-03_the_station_is_the_test_record.md` (18,078 bytes). His hand-back, verbatim in part: "it arrived exactly as the brief pinned it (a6f59f0241277ece, 281 files) and now hashes 4a0498c6188c7cd7"; "84 files and 1,145 tests passed under both UTC and New York (13 new tests)"; "It isn't committed, pushed or deployed, and no git was run."

VERDICT: PASSED WITH ONE FIX (Scribe-direct, G-2). The worktree's tree is now `f16eeacbfd987ca3`, 281 files.

## What was gated

1. THE MAIN FOLDER: `src`, `test`, `scripts` and `migrations` of the main folder's `app/` equal HEAD `2078a67` (read-only `git archive`); `origin/main` the same. Clean for the merge.
2. THE TREE. Staged as `gateV25.tar` (10,956,800 bytes, `cca376bdc94ff58b`, no node_modules, no persist folders), unpacked; `4a0498c6188c7cd7` both sides, 281 files; against the live tree exactly the report's 15 changed files, none added; the repair file `d06b032205260213`, untouched.
3. GATES: typecheck 0; 84 files, 1,145 tests under `TZ=UTC` and `TZ=America/New_York`; `node --check` ok; the from-zero smoke `About to apply 90 migration(s)`, SMOKE PASS, no ` 500 ` (the run printed SMOKE PASS and then held its port until the gate's timeout stopped it; the pass line is the smoke's last check).
4. THE FIGURES, recomputed by the Scribe from the seeded `lab_compliance_samples` (the 17:14 snapshot plus the seed at 0090, the gate of V24): 2026 has 326 samples; first tests by the one retest rule 129, first-time fails 48, FTQ 62.8% (unchanged: all 22 "Retest (...)" samples are still in testing); Lbs in testing, one batch weight per source tag (the newest by scheduled_at, changed_at, id), 6,402.30 lb at the app's 448 g pound (was 6,884.44). Equal to the report's.
5. THE READINGS (report items 1 to 6), the Scribe's read: the smoke asserting the refusal and then `retest_passed`, right; a retest failing on yeast counting as a TYM fail in Puzzles (a failure mode, not a first-test figure; V21's count), right; the rest as the report reads them.

## The fix (Scribe-direct)

Labels took the newest passed sample's potency even when that sample carried none, so a retest that re-ran only the failed analyte (the usual microbial retest, no THC) would blank a label the first passed test had filled. The brief's wording was the Scribe's miss. `latestFinalizedPotency` (`src/db.ts`) now takes the newest passed sample that carries a potency; none, blank. The unit test that pinned the blank now pins the older figure standing, plus a tag with only potency-less passes reading blank. On the seeded data the figure is unchanged today (81 of 304 tags carry a potency either way); it guards the first retest that passes.

## Sealed final check

```
THE MAIN FOLDER                       src, test, scripts, migrations = HEAD 2078a67
THE TREE AS RECEIVED (4a0498c6188c7cd7, 281 files; arrived a6f59f0241277ece)
npm run typecheck                     exit 0
TZ=UTC npx vitest run                 84 files, 1145 tests passed
TZ=America/New_York npx vitest run    84 files, 1145 tests passed
node --check scripts/smoke.mjs        ok
CI=1 SMOKE_PORT=9425 npm run smoke    About to apply 90 migration(s); SMOKE PASS; " 500 " lines: 0
the figures, independent              2026: 326 samples; 129 / 48 / 62.8%; Lbs in testing 6,402.30 lb (was 6,884.44)
THE FIX                               typecheck 0; 84 files, 1145 tests, UTC and New York
app/src/db.ts                             220313  e7eee29e48d8ccdc
app/test/labconsole.test.ts                23365  5b8da5e68c5a76e2
THE TREE AFTER THE FIX                f16eeacbfd987ca3, 281 files (the worktree, re-hashed on the disk)
dash audit (by character): 0; CR audit: 0; personnel data: none new in a tracked file
```

## The merge (his hands; no migration), then the repair

```powershell
cd "C:\Users\DennisWallace\Documents\Claude\Projects\gripfactory Practical\app"
node scripts/db-snapshot.mjs pre_v25
if ($LASTEXITCODE -ne 0) { throw "snapshot failed, stop here" }
cd "C:\Users\DennisWallace\Documents\Claude\Projects\gripfactory Practical\branches\GFLiteOpsDashboard"
git add -A
git commit -m "V25: the station is the test record" -m "One retest rule (a retest status or a Retest required test) for every first-test count; a Retest sample refuses plain passed or failed; Lbs in testing counts a package once; Post Harvest Puzzles' live years and Labels read the station, Labels taking the newest passed potency. Carries the Scribe's repair file for 26087, 26050 and 26068. No migration. Canon 0.30.365 to 0.30.371.`n`nCo-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`nClaude-Session: https://claude.ai/code/session_01VDz7UdaTSkjq69GvDfDWd7"
cd "C:\Users\DennisWallace\Documents\Claude\Projects\gripfactory Practical"
git checkout -- canon
git merge --no-ff GFLiteOpsDashboard -m "Merge V25: the station is the test record"
git push
```

His paste back: the Version ID. Then the repair, if not run yet (a snapshot first, from the main folder's `app/`, then the repair from the same folder, which now carries the file):

```powershell
cd "C:\Users\DennisWallace\Documents\Claude\Projects\gripfactory Practical\app"
node scripts/db-snapshot.mjs pre_repair_26087_26050
if ($LASTEXITCODE -ne 0) { throw "snapshot failed, stop here" }
node scripts/repair-apply.mjs scripts/repairs/2026-10-03_26087_typos_and_26050_lot.sql
```

The last line must read `done: 27 statement(s)`.
