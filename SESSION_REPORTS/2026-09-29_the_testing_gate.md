# 2026-09-29 The testing gate

V4 of THE BRANCH PLAN (canon 0.30.293), built in the worktree `branches/GFLiteOpsDashboard` under THE DISPATCH RULE (canon 0.30.155). Migration 0079. Not deployed. Nothing committed. No git was run.

## What changed

The Testing section on the Harvest Console is the inventory gate. Four panes left to right: Ready for Testing, Scheduled for Testing, In Testing, Passed Testing. Each carries its line-art icon (`consoleIconSvg` of `ready`, `scheduled`, `in-testing`, `passed`), the pounds large and the grams small (`weightPair`), and the package count under that. The icon is 7.5rem on a computer and 4.5rem at 600px and under. The panes are live. `day` and `dayPicked` no longer go into `testingSection`, and `?thc=` is ignored.

The gate set is live mirror packages (`gone_at` null) whose item's first token before ` - ` is in `app_config` `gate_type_codes` (default `BUD, WPR, PRE, MOB`) and whose license is one of the three farms. Grams: `uom` `g` is the quantity, whole grams; `uom` `ea` is the quantity times `gate_unit_grams` (default `PRE=28, MOB=70`). An each with no unit grams counts the package and adds no pounds, and the pane says "n packages without a unit weight".

- Ready: `NotSubmitted`, pasteurized, and no open desk order on the tag. A cryo output of a gate type that the live mirror does not have yet counts here at `cryo_weight_grams`, else `weight_grams`.
- Scheduled: desk orders in `TEST_CONSOLE_SCHEDULED`, one package once. A tag in the gate set uses the mirror grams, unless METRC already says Submitted, TestPassed, or RetestPassed. Otherwise `batch_grams`.
- In Testing: `SubmittedForTesting`.
- Passed: `TestPassed` or `RetestPassed`.
- `TestFailed` and `RetestFailed` sit in none of the four.

`isPasteurizedTag` is the one check: a live `wip_packages` row with `source = 'cryo'` whose `package_code` is the tag. `PASTEURIZED_CRYO_SQL` sits beside it. The comment names the Rad run (V9) as the second way.

Under the four, three stats as wide as the four: First Time Fails, First Time Tests, FTQ Rate. The season is the console's harvest year. A first-time row is `external_test_results` with `attempt = 1`, not deleted, a status the sheet parser reads as passed or failed (`outcomeOf`), and a year from the `hbn` prefix (the year's last two digits) or, when the hbn does not start with two digits, from `entered_testing`. FTQ is passed over all, one decimal, and `NA` when there are no tests. Each stat says "this season". The rate also says how many first-time tests it sits on. Empty: 0, 0, NA, and "No first-time tests on the sheet this season."

Failure Mode Analysis is one pane under those. Failed first-time tests group by `failure_mode` (blank reads "unnamed"), share by count, drawn as inline SVG paths in a 100 by 100 frame. One mode is a full ring. Eight hues, `.hc-pie-1` through `.hc-pie-8`, cycle. The legend lists mode, count, and percent. A click on a segment or its legend line translates that segment by 6 units along its bisector (`data-hc-pie-dx`, `data-hc-pie-dy`) and shows that mode's strains, hidden until the click. The sheet strain and the batch's market strain (the batch found by `hbn`) both show when they differ, written "A / B". A second click puts it back. One segment free at a time. The script only toggles. Grams ride as a sub on each strain. Empty: "No failed first-time tests on the sheet this season."

The old counts, by-lab and by-strain rates, COA list, and THC sort are gone from `testingSection`. `loadTestingSection` reads the panes, the stats, and the pie. `TestingFigures` is reshaped for them. The Testing Desk at `/compliance/testing` and `src/testing.ts` are untouched.

`migrations/0079_testing_gate.sql` inserts `gate_type_codes` and `gate_unit_grams` with `INSERT OR IGNORE`. Both keys are in `CONFIG_KEYS`. `parseGateTypeCodes` and `parseGateUnitGrams` carry the defaults. Both show in Admin, Lookups, app_config with the other config values. `src/consoleicons.ts`, `wrangler.toml`, and the sheet parser are untouched. Nothing under `public/`.

## Moved smoke asserts

`scripts/smoke.mjs` now pins `About to apply 79 migration(s)`. These asserts moved with the page:

- "the season must count the trimmed lot as ready" (`data-hc="lots_ready">1<`). At that point in the walk the cryo output has already been voided and the mirror has not been mounted, so the four panes are empty (0 packages, ready `0.00 lb`).
- "no order is still on the way to the lab" and "the failed order was remediated and already has a later attempt" (`lots_scheduled`, `lots_retest`). Folded into that empty-pane check.
- "the first full panel failed, so the rate is that parent package's weight over itself" (`first_pass` 0.0%, `0.00 of 1.68 lb`, `0 of 1 packages`). The season at that moment is the one manual external row (Failed, Coliforms, entered 2026-09-04): First Time Fails 1, First Time Tests 1, FTQ `0.0%`.
- "the first failure must sit under its lab with the package weight" (SC Labs Michigan, microbials). Gone. The failure on the page is Coliforms, strain `unnamed`.
- "the first-time rate must break out by strain and farm" (Fruity Pebbles, ARL). Gone with the by-strain block.
- "the COA list must link the sample's COA", "THC by parent tag must show the recorded percent", and "the COA and THC lists show the attempt beside the date". Gone. The section must not contain "COAs by parent tag", "Lots ready", `data-hc-thc`, or the COA url.
- "the sample tag never shows in the Testing section". Kept.
- "a picked day must not change the Testing season" (`lots_ready` and `first_pass`). Now ready stays 0 and FTQ stays `0.0%`.
- "THC by parent tag must sort ascending" and "THC sort must keep the picked day and the season counts". `?thc=` returns 200, does not render `data-hc-thc-sort`, leaves the gate counts, and keeps the picked day.
- "the console Testing section must read the seeded sheet history" (Seed Pass and `1A40503000311FB0000000A1`). Now Seed Fail, Coliforms, First Time Tests 3, First Time Fails 2, FTQ `33.3%`: the manual row plus the fixture's pass and fail.
- The harvest-figures fingerprint that required `lots_ready` (`lots_ready`, `lots_scheduled`, `lots_retest`) now reads `ready_packages`, `scheduled_packages`, `in_testing_packages`, `passed_packages`, `first_fails`, `first_tests`, and `ftq`.

`test/testing.test.ts` no longer tests the retired parent-key, first-panel rate, THC sort, or COA render. The desk tests in that file stay. The new pins are in `test/testinggate.test.ts`.

## Assumptions for his word

- The gate types default to BUD, WPR, PRE, and MOB. He changes the list in Admin without a slice.
- A cryo output the mirror has not pulled yet reads as Ready at its cryo weight (else its weight).
- A package with an open desk order leaves Ready. It sits in Scheduled while the order is in `TEST_CONSOLE_SCHEDULED` (`scheduled`, `sampled`, `in_transit`, `at_lab`). `results_in` and `retest_scheduled` leave Ready and do not sit in that pane.
- Once METRC says Submitted, TestPassed, or RetestPassed, a still-open scheduled order does not also sit in Scheduled.
- Failed packages sit in no pane. The desk carries them.
- The season is the console's harvest year. The sheet's `hbn` prefix names it. The entered date is the fallback when the hbn does not start with two digits.
- The pie's share is by count of failed first-time tests. Grams ride as a sub.
- Until the sheet lands, the stats and the pie show their empty words, except where a manual external row is already in `external_test_results`. The four panes read the mirror from the first deploy.
- An each whose type has no unit grams counts as a package and adds no pounds.

## Gates

Run in the worktree's `app/`.

- `npm run typecheck`: exit 0.
- `npx vitest run`: 66 files, 956 tests passed under `TZ=UTC`, and the same under `TZ=America/New_York`.
- `node --check scripts/smoke.mjs`: exit 0.
- From-zero smoke (`SMOKE_PORT=9202`, `WRANGLER_SEND_METRICS=false`): `About to apply 79 migration(s)`, `SMOKE PASS`, ` 500 ` lines: 0, exit 0.
- Dash audit: 0 on every file below (U+2014 and U+2013). No CR byte in those files.
- `METRC_INTEGRATOR_KEY = "`, `METRC_USER_KEY = "`, `MS_CLIENT_SECRET = "`, `SENSORPUSH_PASSWORD = "`, `CLOUDFLARE_API_TOKEN=`, and `CLOUDFLARE_API_TOKEN: "` do not appear in those files.

## Deploy

Not deployed from this session. Nothing committed. No git was run.

## Sealed final check

```
npm run typecheck                     exit 0
npx vitest run (TZ=UTC)               66 files, 956 tests passed
TZ=America/New_York npx vitest run    66 files, 956 tests passed
node --check scripts/smoke.mjs        exit 0
SMOKE_PORT=9202 WRANGLER_SEND_METRICS=false node scripts/smoke.mjs
                                      About to apply 79 migration(s); SMOKE PASS; " 500 " lines: 0; exit 0
```

```
app/migrations/0079_testing_gate.sql         595  7d61321971c8bf57
TAIL   ('gate_unit_grams', 'PRE=28, MOB=70', '2026-09-29T00:00:00.000Z', NULL, '2026-09-29T00:00:00.000Z', NULL, NULL, NULL);
app/src/console.ts                        101639  a1ff5d35e1e830b8
TAIL }
app/src/config.ts                          72495  4f47b8ea843cf669
TAIL }
app/src/theme.ts                          164547  802bde353683926f
TAIL }
app/src/i18n.ts                           182799  55af55ce661a9939
TAIL }
app/src/index.ts                          144676  c6c3ebcac4095d44
TAIL export default worker;
app/scripts/smoke.mjs                     618267  b3209b96dda9493e
TAIL });
app/test/console.test.ts                   63278  d79486beb723bdc4
TAIL });
app/test/testinggate.test.ts               15127  00985353e5250513
TAIL });
app/test/testing.test.ts                    5363  c4f1de0c26b3ffe2
TAIL });
```
