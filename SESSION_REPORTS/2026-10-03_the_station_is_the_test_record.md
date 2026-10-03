# 2026-10-03 The station is the test record

BRIEF V25, THE STATION IS THE TEST RECORD (canon 0.30.365), built in the worktree `branches/GFLiteOpsDashboard` under THE DISPATCH RULE (canon 0.30.155). No migration; the smoke pin stays 90. Not deployed. Nothing committed. Nothing pushed. No git was run.

## The tree as received

The brief pins `a6f59f0241277ece` (281 files, with the Scribe's untracked repair file) and `2d4801bd8c342a19` (280 files, without it). The disk hashed exactly both before the first edit. The hashed set was staged as a tarball in the session's scratchpad before any edit; every "changed" below is against it.

The repair file `app/scripts/repairs/2026-10-03_26087_typos_and_26050_lot.sql` was left alone: 17,357 bytes, `d06b032205260213`, byte-identical to the tree as received. It rides this slice's commit.

The app tree after this session hashes `4a0498c6188c7cd7` (281 files, with the repair file); `375086e205ea204e` without it (280 files).

## What changed, law by law

1. ONE RETEST RULE (`src/labvocab.ts`). `isRetestTest(requiredTest)` (begins with "Retest", case-blind, after trimming), `isLabRetest(status, requiredTest)` (a retest status OR a Retest required test) and `labAttempt(status, requiredTest)` now take the required test, a required parameter so no reader can forget it. `LAB_RETEST_TEST_SQL` is `LOWER(TRIM(COALESCE(required_test, ''))) LIKE 'retest%'` (LOWER carries the case blindness, since LIKE is case-blind in SQLite and not in Postgres) and `LAB_ATTEMPT_SQL` is `CASE WHEN status IN ('retest_passed', 'retest_failed') OR <that> THEN 2 ELSE 1 END`. Every first-test reader goes through it: the Harvest Console's First Time Tests, First Time Fails, FTQ and pie (`console.ts`, through `LAB_ATTEMPT_SQL`, unchanged code), the Compliance FTQ (`biz.ts`, the same), Post Harvest Puzzles' # Tests (law 3) and the External tab's Attempt column (`compliance.ts externalRowFromLab`). A retest is out of the FTQ entirely, numerator and denominator. The outcome stays by status (`LAB_OUTCOME_SQL` and `labOutcome` unchanged), so a retest's failure still reads on the pareto.
1a. THE STATUS AGREES WITH THE TEST (`src/labrules.ts`, `src/lab.ts`). `RETEST_TEST_STATUSES` is scheduled, not_submitted, in_testing, retest_passed and retest_failed. `validateComplianceSample` refuses a plain passed or failed on a Retest required test with the slug `status-retest`, on create and on PATCH. A stored row is never rewritten: PATCH hands the validator the stored status and required test, and a correction that leaves a stored disagreeing row's status as stored lands (the one retest rule still reads that row as a retest). `/api/lab/options` carries `retest_test_statuses`; the station page switches Passed and Failed off in the status select while the required test begins with Retest (off, not removed, so a stored one still shows and is sent back unchanged), on boot, on a reset, when a stored sample opens and when the required test changes. The refusal reads "a retest takes Retest passed or Retest failed; Passed and Failed are first tests" (ES "una reprueba lleva Reprueba aprobada o Reprueba fallida; Aprobado y Fallido son primeras pruebas"), and the Status field's hover help says the same in EN and ES.
2. LBS IN TESTING COUNTS A PACKAGE ONCE (`src/labvocab.ts labInTestingGrams`, `src/biz.ts`). Over the samples in_testing in the set, one batch weight per source tag (trimmed, upper-cased), the newest sample's by scheduled_at, then changed_at, then the id (the seed's duplicate pairs share both stamps, so the id is what names one); a sample with no source tag counts on its own. The Compliance tile is the only place the figure is drawn (the Harvest Console's In Testing pane reads the Metrc mirror, not the station; `compliance.ts lbsInTesting` has no caller in `src`).
3. POST HARVEST PUZZLES' LIVE YEARS READ THE STATION (`src/puzzles.ts liveTests`). `lab_compliance_samples` under the console set (compliance, not voided): strain, `harvest_batch` as the HBN, `thc_potency_pct` as the potency, the status as the station's outcome (`LAB_OUTCOME_SQL`), `fail_reason` as the failure mode, the attempt by the one retest rule (`LAB_ATTEMPT_SQL`); the year by `lotTokenYear(harvest_batch)`. The 2025 history, the TYM rule and the strain membership are untouched.
4. LABELS READ THE STATION (`src/db.ts`). `listLabelPackages`' test rows: tag `source_metrc_tag` (else `sample_tag`), item or strain `item_name` (else `strain`, else the sample tag; blanks read as missing), net weight `net_weight_g`, packaged date `entered_testing_on` (else `scheduled_at`), license, facility `testing_facility`, the console set (R&D and voided out). `latestFinalizedPotency(tag)`: the `thc_potency_pct` of the newest passed sample (passed or retest_passed) whose source or sample tag is the tag, newest by `finished_testing_on` (an unfinished one last, written `(finished_testing_on IS NULL) ASC` so Postgres sorts it the same), then `changed_at`, then the id; none, blank.
5. LEFT AS THEY ARE: the testing desk's join and Admin, Testing Override. After this slice `external_test_results` is still read by:
   - the testing desk (`src/testing.ts`, the `LEFT JOIN external_test_results e ON e.sheet_key = o.sheet_key` behind the HBN fallback on /testing);
   - the Testing Override drop itself (`src/intesting.ts`: it reads its own rows to match and update them as it lands the workbook);
   - the old External add route `POST /compliance/testing/external` (`src/biz.ts`, its `MAX(attempt)` read and its insert), registered with nothing posting to it since V24;
   - Admin's generic record pages (`src/db.ts` and `src/actions.ts` list the table for the reasoned edit and void, and `src/pipeline.ts` declares its fields); the External tab's pencil to them renders only for a non-station row, and the tab lists station rows only;
   - four `src/db.ts` helpers with no caller in `src` since V24: `listUnfinishedExternalTests`, `listExternalTests`, `listExternalTestsForFtq`, `listFailedFailureModes`.
   No console, Post Harvest Puzzles or Labels figure reads it any more.
6. WORDS: the two new lines above, each in EN and ES (`src/i18n.ts`). No other help line changed.

## Readings the brief left to the build (each named for the Scribe)

1. The brief's smoke line "a station sample Retest (...) moved to passed": law 1a refuses a plain passed on that sample, so the smoke asserts the refusal (`status-retest`), then moves it to retest_passed and asserts First Time Tests, First Time Fails, the console FTQ and the Compliance FTQ unchanged. The status-only V24 rule already read retest_passed as a retest, so the smoke also asserts the one check only the new rule passes: the open twin "Retest (Coliforms)" sample shows Attempt 2 on the External tab beside the Full Compliance sample's 1.
2. Law 1a on a PATCH that turns a passed or failed first test into a Retest test (the status untouched): refused with `status-retest`, since the write would make the pair disagree. A correction to a row that already disagreed lands when it leaves the status as stored.
3. Law 2 takes the newest sample's batch weight even when it is blank, so a tag whose newest in-testing sample has no weight adds 0 g though an older one has a weight (the brief's letter). The seed has no blank weight among its in-testing rows.
4. Law 3 maps the status through the station's outcome, so a retest_failed sample naming yeast is a TYM fail: V21's TYM rule counts any failed test naming yeast, any attempt (a sheet retest that failed read Failed). # Tests stays V21's: attempt 1, the open first tests included; the Retest rows are now out of it, as the Scribe recommended.
5. Law 4's potency keeps R&D and voided samples out too (the set the list uses), and takes the newest passed sample's potency even when it is blank (the letter; V24 skipped blank ones). A label's packaged date from `scheduled_at` is its UTC day, the same habit as the inventory rows' `created_at` on the same page.
6. The TypeScript trim strips every blank and SQL TRIM strips spaces; they agree on every stored row, since the station stores `required_test` trimmed and the seed's values are clean.

## Files touched (against the tree as received)

Edited (15), no new file, none deleted: `app/src/labvocab.ts`, `app/src/biz.ts`, `app/src/compliance.ts`, `app/src/puzzles.ts`, `app/src/db.ts`, `app/src/labrules.ts`, `app/src/lab.ts`, `app/src/labpage.ts`, `app/src/labclient.ts`, `app/src/i18n.ts`, `app/test/labconsole.test.ts`, `app/test/lab.test.ts`, `app/test/labrules.test.ts`, `app/test/labpage.test.ts`, `app/scripts/smoke.mjs`. `migrations/`, `wrangler.toml`, `tsconfig.json`, `package.json` and the repair file are byte-identical to the tree as received.

## Tests

13 new cases (1,132 to 1,145):

- `labrules.test.ts` (2): a Retest (Coliforms) sample takes the five choices and refuses passed and failed (`status-retest`), case-blind and trimmed; a stored disagreeing row is kept by a correction that leaves its status, and a new plain status is refused.
- `lab.test.ts` (2): over the API, create and PATCH refuse passed and failed on a Retest sample with no row and no log landed, retest_passed and retest_failed land with their log rows, a passed first test turned into a Retest test is refused, the options carry the five choices; a stored "Retest (Coliforms)" row with a plain passed takes a notes correction (logging notes only) and keeps its status, refuses a plain failed, takes retest_passed.
- `labconsole.test.ts` (8): TypeScript and SQL agree on eight required-test spellings over four statuses, with SQLite's LIKE made case-sensitive so the SQL's LOWER is what carries the case blindness; a stored Retest row with passed or failed leaves the console's First Time Tests, Fails, FTQ and pie and the Compliance FTQ unchanged, its failure still on the pareto; the External tab's attempt; two in-testing samples on one source tag count one batch weight, the newest's, while a third on another tag adds and passed, R&D and voided rows on the tag do not; untagged samples each count, and the ties fall to changed_at, then the id; Post Harvest Puzzles' live year reads station samples (potency, TYM with a retest_failed, # Tests without the two retests, R&D, voided, another year's token and another strain out); Labels lists a station sample field by field (R&D and voided out) and takes the newest passed potency (a newer failed sample, R&D, voided and unfinished rows not taken, a finish-date tie to changed_at, the sample tag finding its own sample, a blank newest passed potency blank, none blank).
- `labpage.test.ts` (1): the client switches Passed and Failed off for a Retest test from the options' list, on change and in three other places, and the refusal and the help line read in EN and ES.

An adversarial review ran over the finished build: four reviewers (the brief's letter, correctness, test strength by mutation in a scratch copy, the house audits and words), each followed by a skeptic that tried to refute every finding. Two findings held, both test gaps: nothing pinned the blank newest potency (a return to V24's `IS NOT NULL` filter survived) and nothing pinned the station page's status lock. Both are pinned now; the review's other suggestions taken: the SQL LOWER pin, one smoke check only the new rule passes, a precise doc line in `labrules.ts`, the trim note in `labvocab.ts`. Rerun on the final tree, the three mutations that had survived (the `IS NOT NULL` filter, the status lock deleted, the LOWER dropped) each fail a test.

## The smoke

BRIEF V25 steps in the V24 block, after the station's samples: a "Retest (Coliforms)" sample on tag 56899 refuses a plain passed (400 `status-retest`) and takes retest_passed; the Harvest Console's First Time Tests 1, First Time Fails 1, FTQ 0.0% and the Compliance FTQ n=1 are unchanged; a second in-testing "Retest (Coliforms)" sample of 896 g on the open sample's tag 56901 (448 g) leaves Lbs in testing at 2.00 lbs (one batch weight, the newest's; a double count reads 3.00); the External tab shows that open Retest sample at Attempt 2 and the Full Compliance one at 1; Labels list the open sample by its source tag and leave the R&D sample out.

## The live figures, before and after

A local D1 in the session's scratchpad, migrated from zero to 0090 by the worktree's migrations, loaded with the snapshot `db_backups/20261003-063702_pre_lab_station` (all 82 tables but `record_change_log`, 221,326 rows, each table's count equal to its manifest; DELETE then INSERT, the roll's carry), then the seed `db_backups/lab_seed_0090.sql` read in place from the main folder (6,771,130 bytes, `edc37898835f860b`) through `wrangler d1 execute --local --file`: 567, 374, 2,621 and 7 rows. The seed was not copied into the worktree. Two identical copies of that database: a worker of the tree as received (`a6f59f0241277ece`) read the "before" pages, a worker of this build read the "after" pages, signed in with the smoke's identity and the smoke's seeded PIN. Each figure was also recomputed independently from the rows in Python and agrees with the pages (the tile converts its rounded grams to pounds). The "after" pages were read again on the final tree, `4a0498c6188c7cd7`, with the same figures.

| 2026 | before (V24) | after (V25) |
|---|---|---|
| First Time Tests (Harvest Console) | 129 | 129 |
| First Time Fails | 48 | 48 |
| FTQ (Harvest Console) | 62.8% | 62.8% |
| FTQ rate (Compliance Console) | 62.8%, n=129 | 62.8%, n=129 |
| Lbs in testing (Compliance Console) | 6,884.44 lbs (3,084,227 g) | 6,402.30 lbs (2,868,231 g) |

Lbs in testing falls by 482.14 lb: the 11 source tags with two in-testing "Retest (...)" samples of the same weight now count once (215,995.4 g as stored). The FTQs and First Time Tests do not move on today's rows: all 22 Retest samples in the seed are in_testing, so they were already out of every FTQ as open tests; the one retest rule keeps them out when they close.

The other two surfaces this slice moved, read off the same pages: Post Harvest Puzzles 2026 had no tests before (the archive table is empty in the snapshot) and now reads the station: 204 first tests over its 13 strains, 1 TYM fail, an Average THC on 5 strains (326 station samples carry a 2026 lot token: 304 first tests, 22 retests; 204 belong to a 2026 strain). Labels' package list goes from 3,035 to 3,361 entries: the 326 compliance samples in the set, R&D out.

## For his word, or the Scribe's

1. The readings above, items 1 to 6.
2. Words outside the slice that are now stale or were already: the Testing Override's button still says "Override testing from this sheet" though the drop now feeds no console, Puzzles or Labels figure (its help line is true; law 5 leaves the pane as it is); `src/equipment.ts` still describes the External tab's per-row pencil and the instrument drop lanes (V24 report item 10), and its Owner lines carry the owner's first name, all from before this slice; two V24 smoke comments still say `external_test_results` is a table "which no surface reads" (the testing desk and Admin's record pages read it).
3. The four dead `db.ts` helpers above and `compliance.ts lbsInTesting` (only a test calls it) can go in a cleanup slice.

## Gates

Run in the worktree's `app/`.

- `npm run typecheck`: exit 0.
- `npx vitest run`: 84 files, 1145 tests passed under `TZ=UTC`, and 84 files, 1145 tests passed under `TZ=America/New_York`.
- `node --check scripts/smoke.mjs`: exit 0.
- From-zero smoke (`SMOKE_PORT=9255`, `WRANGLER_SEND_METRICS=false`, `CI=1`, `TZ=UTC`): About to apply 90 migration(s), SMOKE PASS, no ` 500 ` line, exit 0 (18,487 lines of log; the one ` 503 ` line is `POST /api/send`, the smoke's own asserted step). The first run, before the review's additions, passed the same way.
- Dash (U+2013, U+2014) and CR audits by character, and BOM, on all 15 touched files and this report: 0. No personnel name in an added line; the seed and the snapshot stayed in the main folder's `db_backups/`, outside the worktree.

## Deploy

Not deployed from this session. Nothing committed. Nothing pushed. No git was run.

## Sealed final check

```
the tree as received                  a6f59f0241277ece (281 files; 2d4801bd8c342a19 without the repair file, 280)
npm run typecheck                     exit 0
TZ=UTC npx vitest run                 84 files, 1145 tests passed
TZ=America/New_York npx vitest run    84 files, 1145 tests passed
node --check scripts/smoke.mjs        exit 0
SMOKE_PORT=9255 WRANGLER_SEND_METRICS=false CI=1 TZ=UTC npm run smoke
                                      About to apply 90 migration(s); SMOKE PASS; " 500 " lines: 0; " 503 " lines: 1 (POST /api/send); exit 0
dash audit: 0; CR audit: 0; BOM: 0; personnel data: none new
the repair file                       17357  d06b032205260213 (untouched)
the app tree after the edits          4a0498c6188c7cd7 (281 files; 375086e205ea204e without the repair file, 280)
```

```
app/scripts/smoke.mjs                     754626  346b8afdc3ed6b4a
TAIL });
app/src/biz.ts                             33105  70474683b5e768c7
TAIL }
app/src/compliance.ts                      26884  724425eafb181d15
TAIL }
app/src/db.ts                             220057  6fe892cd1b5c953c
TAIL }
app/src/i18n.ts                           241263  7c7859a863788c70
TAIL }
app/src/lab.ts                             53981  39daa3d74a768c45
TAIL }
app/src/labclient.ts                       42785  4215cf92e8725cb7
TAIL }
app/src/labpage.ts                         24107  4c0850fb39cbe05a
TAIL }
app/src/labrules.ts                        44030  5a6c3b77dfdaf774
TAIL }
app/src/labvocab.ts                         5069  2f23e1b92c3c5389
TAIL }
app/src/puzzles.ts                         44841  8604fbc5e7e8e49f
TAIL }
app/test/lab.test.ts                       65320  637b842ed6e84fc3
TAIL });
app/test/labconsole.test.ts                23070  29f58f41e4fd8e32
TAIL });
app/test/labpage.test.ts                   12952  a5ea9ef0f85178f5
TAIL });
app/test/labrules.test.ts                  20588  68207c7c928d70cf
TAIL });
```
