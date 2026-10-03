# 2026-10-03 The gate on V24, the lab station (canon 0.30.363): PASSED

Scribe session. BRIEF V24, THE LAB STATION (`BRIEFS/2026-10-02_the_lab_station.md`, 8,858 bytes, `79cf3c2727745149`), built in the worktree on the live tree `7c508a9687242287` (worker `c25de367`, main `411a0c2`): a Cursor session began it and stopped partway, his Code session continued on that partial state and finished it. Its report `SESSION_REPORTS/2026-10-02_the_lab_station.md` (19,668 bytes). His hand-back, verbatim in part: "Final app tree: `2d4801bd8c342a19`, 280 files"; "84 test files, 1132 tests passing under both UTC and New York"; "Nothing was committed, pushed or deployed, and no git was run."

VERDICT: PASSED. Nothing held, nothing changed by the Scribe. The seed is prepared and rehearsed for his hands.

## What was gated

1. THE MAIN FOLDER FIRST. The report says Cursor's nine edited files were taken from "the root `app/`". The main folder's app tree was read against main's HEAD (`git archive`, read-only): `src`, `test`, `scripts` and `migrations` are HEAD's to the byte; only `wrangler.toml` and `seed/strains.csv` differ, and only by CRLF line ends (identical with CR removed; `.gitattributes` normalizes them; every merge so far passed with them). Clean for the merge.
2. THE WORKTREE outside `app/`: nothing new or changed since the last fold but the 24 touched files, the report and the git-ignored `worker-configuration.d.ts`. No Cursor leftover for `git add -A` to sweep up.
3. THE TREE. Staged as `gateV24.tar` (13,864,960 bytes, `cb1e26e64a7affe7`, no node_modules, no persist folders), unpacked; `2d4801bd8c342a19` both sides, 280 files; against the live tree exactly the report's 11 new and 13 changed files.
4. GATES: typecheck 0; 84 files, 1132 tests under `TZ=UTC` and `TZ=America/New_York`; `node --check` ok; the from-zero smoke at pin 90 SMOKE PASS, no ` 500 `.
5. THE SEED, prepared: the package's `seed/0001_lab_tests_seed.sql` split on statements (comment- and quote-aware; 4,244 statements), its 675 `lab_metrc_packages` statements dropped (his Metrc pick), the rest kept byte for byte: `db_backups/lab_seed_0090.sql` in the main folder (git-ignored; 6,771,130 bytes, `edc37898835f860b`; 3,569 statements; it carries personnel names, so it is never a tracked file).
6. THE SEED, rehearsed on the owner's data: a local database loaded with `db_backups/20261002-171419_pre_cure_bar` (every table but record_change_log) at 0089, migrated to 0090 by the gated tree, then the seed through `wrangler d1 execute --local --file` twice: run 1 `lab_internal_tests` 567, `lab_compliance_samples` 374, `lab_op_results` 2,621, `lab_sample_schedule` 7 (the package README's counts); run 2 the same, no change.
7. THE PAGES on a local worker of the gated tree over that seeded database: `/harvest`, `/compliance`, `/compliance/testing?tab=internal` (the station) and `?tab=external` answer 200; `/station/lab_tests` 302 to the tab; a write to `/api/lab/internal-tests` without `x-lab-client` answers 403; `/feeds/lab-internal-tests.json` with no limit pages at 500 with `more` set (567 readings).
8. THE CONSOLES' FIGURES, recomputed by the Scribe from the seeded `lab_compliance_samples` by law 7 (compliance program, not voided, the season by the lot token; 326 samples in 2026: 81 passed, 48 failed, 149 in testing, 48 scheduled): first tests 129, first-time fails 48, FTQ 62.8%. The page: Harvest Console Testing section "First Time Fails 48", "First Time Tests 129", "FTQ Rate 62.8%", the pie 46 Coliforms and 2 Coliforms, Total Yeast and Mold; the Compliance tile "FTQ rate 62.8% n=129"; Lbs in testing 6,884.44 lb (the brief's law: the batch weights of the samples in testing). All equal.

## For his word (no hold; the build report's own list, with the Scribe's read)

1. The External tab's "Add external result" form is off (it wrote a table the tab no longer reads); a link to the station replaces it. The Scribe's read: right.
2. Post Harvest Puzzles' live years, Labels (`latestFinalizedPotency`) and the testing desk's join still read `external_test_results`, now fed only by the Testing Override drop. Move them to the station, or leave them?
3. Lbs in testing counts a retest copy twice: 11 source tags carry two in-testing "Retest (...)" samples with the same batch weight, about 482 lb of the 6,884 lb. Count each source tag once?
4. The seed marks a retest by `required_test` "Retest (...)" (22 rows, none with a retest status). Under law 7's status rule, one closed as plain passed or failed counts as a first test. Treat `required_test` "Retest%" as a retest too?
5. R&D samples leave the External tab (law 7's set); they stay on the station's R&D tab.
6. `/api/lab/*` sits behind the Admin PIN: when the cookie lapses the API answers the HTML PIN page, the station keeps the save queued and says to enter the PIN again. A JSON 401 there is a possible follow-up.
7. The seed is the workbook as downloaded the morning of 2026-09-29; anything the lab typed into the workbook since is not in it (the package README's open item 5: type those into the station, or ask the package's author for a delta file).

## The merge, then the seed (his hands)

```powershell
cd "C:\Users\DennisWallace\Documents\Claude\Projects\gripfactory Practical\app"
node scripts/db-snapshot.mjs pre_lab_station
if ($LASTEXITCODE -ne 0) { throw "snapshot failed, stop here" }
cd "C:\Users\DennisWallace\Documents\Claude\Projects\gripfactory Practical\branches\GFLiteOpsDashboard"
git add -A
git commit -m "V24: the lab station" -m "Migration 0090: the lab's record (bench readings, compliance and R&D samples, Orange Photonics results, the sampling schedule), ported into the app. Compliance, Testing, Internal is the station; its old drops are gone. Every write logs under the signed-in person; the Metrc lookup reads the app's mirror; three read-only feeds. The Harvest Console's Testing section, the Compliance FTQ and pareto, Lbs in testing and the External list read the station. Canon 0.30.361 to 0.30.363.`n`nCo-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`nClaude-Session: https://claude.ai/code/session_01VDz7UdaTSkjq69GvDfDWd7"
cd "C:\Users\DennisWallace\Documents\Claude\Projects\gripfactory Practical"
git checkout -- canon
git merge --no-ff GFLiteOpsDashboard -m "Merge V24: the lab station"
git push
```

The push runs the workflow: the tests, `apply migrations` (0090, the pin 90), the deploy. His paste back: the Version ID. THEN the seed, once (it is `INSERT OR IGNORE`, so a second run changes nothing), from the main folder's `app/`, answering `y` if wrangler asks:

```powershell
cd "C:\Users\DennisWallace\Documents\Claude\Projects\gripfactory Practical\app"
npx wrangler d1 execute gripfactory-lite-grip-20260914 --env grip --remote --file ..\db_backups\lab_seed_0090.sql
npx wrangler d1 execute gripfactory-lite-grip-20260914 --env grip --remote --command "SELECT (SELECT COUNT(*) FROM lab_internal_tests) AS internal, (SELECT COUNT(*) FROM lab_compliance_samples) AS compliance, (SELECT COUNT(*) FROM lab_op_results) AS op, (SELECT COUNT(*) FROM lab_sample_schedule) AS schedule"
```

The counts must read 567, 374, 2,621 and 7. If the first line answers "Authentication error [code: 10000]" (the import lane refused the OAuth login once, 2026-09-18), stop there and paste it; the seed's raw instrument rows carry double quotes and percent signs, so `repair-apply.mjs` cannot carry it, and the Scribe will hand another lane.

## Sealed final check

```
THE MAIN FOLDER                       src, test, scripts, migrations = HEAD 411a0c2; wrangler.toml and seed/strains.csv CRLF-only
THE TREE AS RECEIVED AND GATED (2d4801bd8c342a19, 280 files; the live tree 7c508a9687242287)
npm run typecheck                     exit 0
TZ=UTC npx vitest run                 84 files, 1132 tests passed
TZ=America/New_York npx vitest run    84 files, 1132 tests passed
node --check scripts/smoke.mjs        ok
CI=1 SMOKE_PORT=9381 ... npm run smoke   About to apply 90 migration(s); SMOKE PASS; " 500 " lines: 0
the seed for the gate                 db_backups/lab_seed_0090.sql, 6,771,130 bytes, edc37898835f860b, 3,569 statements
the seed on the 17:14 snapshot at 0090   run 1: 567 / 374 / 2,621 / 7; run 2: no change
the pages over the seeded data        the station 200; the redirect 302; no header 403; the feed pages at 500
the consoles, independent             2026: 326 samples; first tests 129, fails 48, FTQ 62.8%; Lbs in testing 6,884.44 lb; the page the same
the report's seal                     24 files, as the build report lists them
dash audit (by character): 0; CR audit: 0; personnel data: none new in a tracked file (the seed git-ignored)
```
