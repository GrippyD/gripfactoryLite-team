# BRIEF V25: THE STATION IS THE TEST RECORD (canon 0.30.365)

For the build session (Claude Code or Cursor) opened in the worktree `branches/GFLiteOpsDashboard` (its `app/` is the app), under THE DISPATCH RULE (canon 0.30.155): three corrections that finish V24, THE LAB STATION. Built on the worktree exactly as it stands LIVE (worker `5313905d`, main `2078a67`, the app tree `2d4801bd8c342a19`, 280 files; the worktree also holds the Scribe's untracked repair file `scripts/repairs/2026-10-03_26087_typos_and_26050_lot.sql`, with which the tree hashes `a6f59f0241277ece`, 281 files; leave that file alone, it rides this slice's commit; if the hash on the disk differs, stop and say so). No migration; the smoke pin stays 90.

## The sources (verbatim)

The Scribe's three questions from the V24 gate and the owner's answers, 2026-10-03:

"Should Post Harvest Puzzles and Labels read the station?" "Yes"

"Should Lbs in testing count each retested package once? It currently double-counts about 482 lb." "Yes"

"Should a "Retest (...)" required test always count as a retest?" "Yes"

And, on the FTQ: "They don't count towards the FTQ calculation.  A "testpassed" automatically indicates it was a first time success.  A retestpassed for example indicates it failed at least once."

The facts behind them (the V24 build report, `SESSION_REPORTS/2026-10-02_the_lab_station.md`, items 2 to 4; the gate, `SESSION_REPORTS/2026-10-03_gate_the_lab_station.md`): Post Harvest Puzzles' live years (`liveTests`, `src/puzzles.ts` near 403) and Labels (`listLabelPackages` near `src/db.ts` 4164 and `latestFinalizedPotency` near 4178) still read `external_test_results`, now fed only by the Testing Override drop; in the seed, 11 source tags carry two `in_testing` "Retest (...)" samples with the same batch weight (215,995 g, about 482 lb of 3,084,227 g); the seed marks a retest by `required_test` "Retest (...)" (22 rows) and never by a `retest_*` status.

## The law

1. ONE RETEST RULE (`src/labvocab.ts`, used by every reader): a sample is a retest when its status is `retest_passed` or `retest_failed`, OR its `required_test` begins with "Retest" (case-blind, after trimming). `LAB_ATTEMPT_SQL` and the TS predicate both say so; a retest is never a first test (the console's First Time Tests and FTQ, the Compliance FTQ, every first-test count). Its outcome stays by status (passed or retest_passed pass; failed or retest_failed fail; the rest open). A retest is out of the FTQ entirely, numerator and denominator (his words above).
1a. THE STATUS AGREES WITH THE TEST: a plain `passed` or `failed` means a first test. On a sample whose `required_test` begins with "Retest", the station's status choices are `scheduled`, `not_submitted`, `in_testing`, `retest_passed` and `retest_failed`; a create or PATCH that sets `passed` or `failed` on such a sample is refused with the slug `status-retest` (EN and ES words). A stored row is never rewritten by this rule; rule 1 still reads any such row as a retest.
2. LBS IN TESTING COUNTS A PACKAGE ONCE: over the samples `in_testing` in the set, one batch weight per `source_metrc_tag` (the newest sample's by `scheduled_at`, then `changed_at`), on the Compliance tile and wherever else the figure is drawn. A sample with no source tag counts on its own.
3. POST HARVEST PUZZLES' LIVE YEARS READ THE STATION: `liveTests` reads `lab_compliance_samples` (`program = 'compliance'`, `voided_at IS NULL`), mapping `strain`, `harvest_batch` as the HBN, `thc_potency_pct` as the potency, `status`, `fail_reason` as the failure mode, and the attempt as 1 for a first test and 2 for a retest by rule 1. The year by the lot token of `harvest_batch` (V21's `lotTokenYear`). The 2025 history (imported) is untouched. The TYM rule (failed, the fail reason naming yeast) and the strain membership (the market strains, else the HBN) stand as V21 wrote them.
4. LABELS READ THE STATION: the package list's test rows come from `lab_compliance_samples` (the set of 3, R&D out): the tag `source_metrc_tag` (else `sample_tag`), the item or strain `item_name` (else `strain`, else the sample tag), the net weight `net_weight_g`, the packaged date `entered_testing_on` (else `scheduled_at`), the license, the facility `testing_facility`. `latestFinalizedPotency(tag)` returns `thc_potency_pct` of the newest PASSED sample (passed or retest_passed) whose source or sample tag is the tag, newest by `finished_testing_on`, then `changed_at`; none, blank.
5. LEFT AS THEY ARE: the testing desk's join to `external_test_results` (not in the question); Admin, Testing Override (an archive drop). Say in the report which surfaces still read `external_test_results` after this slice.
6. WORDS: any new or changed help line in EN and ES.

## The tests and the smoke

- Unit: a "Retest (Coliforms)" sample refuses `passed` and `failed` (`status-retest`) and takes `retest_passed`; a stored "Retest (Coliforms)" row with status `passed` is not a first test (console, Compliance FTQ, Puzzles); two `in_testing` samples on one source tag count one batch weight; a sample with no source tag counts; Puzzles' live year reads a station sample (potency, TYM, attempt by rule 1); Labels lists a station sample and takes the newest passed potency, a failed newer sample not taken.
- Smoke: a station sample "Retest (...)" moved to passed leaves First Time Tests unchanged; Lbs in testing with two in-testing samples on one tag counts one batch weight.
- Gates as always: typecheck 0; vitest under `TZ=UTC` and `TZ=America/New_York`; `node --check scripts/smoke.mjs`; the from-zero smoke (`About to apply 90 migration(s)`, SMOKE PASS, no ` 500 `). Dash and CR audits by character; no personnel name in a tracked file. No git; nothing committed, pushed or deployed. Report to `SESSION_REPORTS/` with the tree hash, the files touched, and the live figures recomputed on a local database at 0090 holding the station's rows: the snapshot `db_backups/20261003-063702_pre_lab_station` (taken before the seed) plus the seed, both in the MAIN folder's `db_backups/` (`lab_seed_0090.sql`, git-ignored; read it from there, never copy it into the worktree) (the Scribe re-checks them at the gate): Lbs in testing, First Time Tests and FTQ for 2026 before and after.
