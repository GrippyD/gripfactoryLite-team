# 2026-10-02 The lab station

BRIEF V24, THE LAB STATION (canon 0.30.362), built in the worktree `branches/GFLiteOpsDashboard` under THE DISPATCH RULE (canon 0.30.155). Migration 0090. The smoke pin moves to 90. Not deployed. Nothing committed. Nothing pushed. No git was run.

## The tree as received

The brief pins `7c508a9687242287` (269 files). The disk hashed `f212635c13cdf0de` (279 files), so the session stopped and said so. A Cursor session had begun V24 in this worktree between 19:33 and 19:45 (after the brief, written at 19:20) and stopped partway: migration 0090, a first `lab.ts`, `labrules.ts`, `labclient.ts` and `labpage.ts`, the console rewire, and five generator scripts in `app/scripts/`; no lab tests and no smoke steps. The owner then said Cursor had stopped working and transferred the work here, so the build continued on that partial state.

The pinned tree was rebuilt in the session's scratchpad without touching the worktree: the received tree less Cursor's ten new files, with its nine edited files taken from the root `app/` (the live tree). That copy hashes `7c508a9687242287` with 269 files, exactly the pin, and every diff below is against it.

The app tree after this session hashes `2d4801bd8c342a19` (280 files).

## What changed

- THE SCHEMA (law 1). `0090_lab_tests.sql` creates `lab_internal_tests`, `lab_compliance_samples`, `lab_op_results` and `lab_sample_schedule` with the package's columns, types, CHECKs, defaults and indexes, statement for statement; only `IF NOT EXISTS` is dropped. `lab_metrc_packages` and `lab_writes` are not created. A review run applied the package seed's 3,569 statements for those four tables to an in-memory copy of 0090: 567, 374, 2,621 and 7 rows, no failure, so the seed applies unchanged. The seed itself was not applied, copied or committed (law 8).
- THE PORT (law 2). `src/labrules.ts` is the package's rules as typed TypeScript (no `any`), every rule and refusal slug kept; the package's own 13 rule tests pass against it, and a differential run over 183,025 calls found no difference from the package on ordinary inputs. `src/lab.ts` holds the handlers and the queries behind the export `handleLab(request, db, actor)`: every package path, method, status code, slug and JSON shape, the `x-lab-client: station` guard on every write (403 `client-header-required`), creates idempotent on the client id, PATCH with `if_updated_at` (409 `stale`), void, the 900-row import ceiling (413), the 90-id autofill ceiling. `src/labvocab.ts` holds the one outcome vocabulary. The station page is `src/labpage.ts` (rendered through `html()` and the three view sheets) and `src/labclient.ts` (the package's script, readable and hand-editable, its words from a JSON data block), EN and ES for every label, help line, refusal, status, pick list and report line.
- THE SURFACE (law 3). Compliance, Testing, the Internal tab is the station. The Orange Photonics and Aqualab drops and `POST /compliance/testing/internal` are gone; `internal_test_results` is untouched. `GET /station/lab_tests` answers 302 to `/compliance/testing?tab=internal` (registered above `/station/:key`, which had been answering 404).
- WHO WROTE IT (law 4). The operator is the actor's person id, as `record_change_log.actor_person_id` and the app's `created_by` columns store it; the lists carry an additive `operator_name` (the person's display name) so no id is shown. With no actor, the typed fallback stores `typed:<name>`. Every landed write adds `record_change_log` rows in the write's own `db.batch`, only when the write landed: a create logs each stored field from null, a PATCH each changed field from and to, a void `voided_at` and `void_reason` with the void's reason, a schedule cell its locations.
- THE METRC LOOKUP (law 5). `GET /api/lab/metrc/:tag` reads `metrc_packages` (the newest live row, else the newest) and answers tag, item, category, strain, item_strain, quantity, unit, quantity_g (whole grams only when the mirror counts the package in grams), source_harvest, source_package, location, lab_test_status and packaged_date. No Metrc import route.
- THE FEEDS (law 6). `/feeds/lab-internal-tests.json`, `/feeds/lab-compliance.json`, `/feeds/lab-op-results.json`: the package's envelope and paging law (since strictly after, oldest first, limit 1 to 2000, default 500, `next_since`, `more`, `run_completed`, `live=1`). Their Access rules (which service tokens may read them) are the owner's in the Cloudflare dashboard, not code.
- THE CONSOLES READ THE STATION (law 7). The Harvest Console's Testing section (stats, pie), the Compliance FTQ tile, the fail pareto, Lbs in testing and the External tab's list read `lab_compliance_samples` through `labvocab.ts`: the set `program = 'compliance' AND voided_at IS NULL`; passed and retest_passed pass, failed and retest_failed fail, the rest are open; a retest status is not a first test; an open first test stays out of the FTQ denominator; the season by the lot token (`sheetInSeason`, on the console and on the External tab's year filter); the pareto splits a comma-joined `fail_reason` as V19 did; Lbs in testing is the `batch_weight_g` of the samples `in_testing`. The External tab's status filter is a select of the seven station statuses, translated. The Testing Override's help line says the consoles read the lab station. The Testing section's empty lines now name the lab station.

## Files touched (against the pinned tree)

New (11): `app/migrations/0090_lab_tests.sql`, `app/src/lab.ts`, `app/src/labrules.ts`, `app/src/labclient.ts`, `app/src/labpage.ts`, `app/src/labvocab.ts`, `app/test/labrules.test.ts`, `app/test/lab.test.ts`, `app/test/labpage.test.ts`, `app/test/labconsole.test.ts`, `app/test/labsurface.test.ts`.

Edited (13): `app/src/biz.ts`, `app/src/compliance.ts`, `app/src/config.ts`, `app/src/console.ts`, `app/src/i18n.ts`, `app/src/index.ts`, `app/src/lookups.ts`, `app/src/pages.ts`, `app/test/business_ops.test.ts`, `app/test/console.test.ts`, `app/test/testinggate.test.ts`, `app/test/testingoverride.test.ts`, `app/scripts/smoke.mjs`.

Of these, Cursor's versions stand unchanged in three: `0090_lab_tests.sql`, `config.ts` (the `lab_station` reason) and `pages.ts` (the Override help line). Every other file was written or rewritten here.

Created by Cursor and deleted here (5): `app/scripts/_lab_check.js`, `_lab_client.mjs`, `_lab_find.mjs`, `_lab_i18n.mjs`, `_lab_scan.mjs`. They were throwaway generators inside the hashed set, nothing referenced them, and one carried the package's personnel names (G-9).

`wrangler.toml`, `tsconfig.json` and `package.json` are byte-identical to the pinned tree.

## The package's laws changed, and why

1. REASONS. The five personal request entries are one "Named request". Reason stays free text up to 300 characters, so a seeded row carrying a personal request reason stays valid and correctable; the page offers its stored value while that row is open. Why: G-9.
2. The operator is the person id, not the Access email; `GET /api/lab/me` answers `{ ok, operator, name, typed }` and the lists carry `operator_name`. Why: law 4 ("the way the app's other writes store it"), and no email or phone number goes out on the feeds.
3. `lab_writes` is replaced by `record_change_log`, per field, inside the write's own batch, guarded so only a landed write logs (the package logged in a separate statement after the write). The package's per-import counts row (rows, landed, already there, duplicates, refused) is not carried; the counts are only in the JSON answer. Why: law 4.
4. The op import: 900 rows go as ten batches of 90, each the rows' `INSERT OR IGNORE` plus one set-based log statement (`INSERT ... SELECT` over `json_each`), 910 statements in all, where the package sent 900 inserts and one log row. Why: per-field log rows without one statement per field per row.
5. Grams. `batch_weight_g` and `net_weight_g` entering through a create, or named in a PATCH, round half up to whole grams when they are inside the range; out-of-range values are still refused with the field's slug; a stored value a PATCH does not name is never rewritten. The page shows whole grams; its gram boxes take decimals and send them rounded. LightLab's sample mass (`weight_g`, e.g. 0.3 g) is instrument data and is not rounded. Why: the app's whole-gram law.
6. The Metrc lookup reads `metrc_packages` with the shape above, and a bad tag or a malformed escape answers 400 `tag`. The autofill fills batch weight only from `quantity_g` and names the unit when the package is counted in each. Why: law 5; an "ea" count copied in as grams fed a wrong Lbs in testing.
7. The feed default. The package's clamp read an absent `limit` as 0 and so as 1 row (its own `lab_tests.js` has the same bug); its README's law is default 500. Absent or blank now takes the default (500 on a feed, 100 on a list, 7 schedule days). Why: the README's law; the first smoke run caught it.
8. Lookups by own property only: a status or license word like `constructor` is unknown (the package answered 500). Text over a column's cap is refused, never thrown. A JSON body that is null or not an object answers 400 `bad-json` (the package answered 500). A repeated status filter binds each status once.
9. The page. A date input and a time input replace the single date-and-time box, which none of the three view sheets styles; both blank still means the device's now, sent as `observed_at`; a correction with a time and no date is refused rather than moved to today. The package's own stylesheet is replaced by the view sheets' classes (its sticky table header and its chip colors are not carried). No name prompt: a signed-in page shows the name; the name box (`data-keep-operator`, kept by the layout's script) appears only with no identity. The Ready chip's tooltip is built from the numbers in EN and ES, not the server's English sentence. A combined refusal slug reads as both halves. A lapsed Admin PIN keeps the save queued and says so. Required tests and fail reasons show translated (stored values stay English). The bench THC box's maximum is 100, the rule's own range (the package page had 60).

## What of the package could not be ported

- The package's own page at `/station/lab_tests`: the station is the Internal tab and the path redirects there (law 3).
- `POST /api/lab/metrc/import` and `lab_metrc_packages` (law 5). `validateMetrcPackage` and `METRC_HEADER` stay as rules with their test (law 2 keeps every rule).
- `lab_writes` and its per-import counts row (law 4).
- The package handler test "the seed is in" (seed counts): the seed is barred from tests (law 8), so it is ported as a schema check (the four tables exist, the two left out do not) and a synthetic workbook row.
- The README's step 5 ("add Lab tests to the station navigation"): the station is reached at Compliance, Testing, Internal.

## Tests

Every case of the package's two test files is ported to vitest: 13 rule cases and 14 handler cases, 27 in all (the package README's "28 tests" is wrong; its cover note's 27 is right). The handler cases run on the real migrations with synthetic rows and no personnel names; where a case leaned on the seed or the removed Metrc import route it is rebuilt synthetically or moved onto the `metrc_packages` lookup, and each adaptation is commented in the test.

New test files and cases: `labrules.test.ts` 17, `lab.test.ts` 23, `labpage.test.ts` 14, `labconsole.test.ts` 9, `labsurface.test.ts` 8 (71). Beyond the package's cases they cover: change-log rows with the actor's person id and a void's reason; no log rows for a retried create or a stale PATCH; the typed fallback; the Metrc lookup over `metrc_packages`; gram rounding and range refusals; the 900-row import's statement count and its log rows; the feed's run-completing page and its default limit; the console's stats, pie, FTQ and pareto from `lab_compliance_samples` (R&D out, retests not first tests, an open first test out of the denominator, the season by the lot token, voided rows out); the Internal tab, the redirect, the 403 without the header, the External tab's pointer, select and list. `testinggate.test.ts` and `testingoverride.test.ts` keep their 8 and 4 cases, now seeded from lab samples, each still proving its title.

The smoke's V24 steps: the Internal tab renders the station with no drop form; a bench reading through the API with `x-lab-client: station` (Silo 3, During Silo, the grower license, tag 56899, moisture 13.2) lands with `1A40503000311FB000056899` and shows in the list and in `/feeds/lab-internal-tests.json`; a write without the header answers 403; `/station/lab_tests` redirects to the tab; a compliance sample moved to failed with a fail reason shows on the Harvest Console's Testing section and on the Compliance FTQ; a feed read with no limit pages at 500. The older steps that fed the consoles through the removed drops or `external_test_results` now feed them through the station or assert the new truth.

The station was also opened in the built-in browser against a local copy of the smoke's database: the three view sheets, the phone device, EN and ES; a bench reading saved through the form landed with its full tag, the operator and the device's time; all six inner tabs load.

## For his word, or the Scribe's

1. The External tab's "Add external result" form is off (it wrote `external_test_results`, which the tab's list no longer reads); a line and a link point to the Internal tab. `POST /compliance/testing/external` and the record edit route stay registered with nothing posting to them.
2. Other readers of `external_test_results` stay, outside law 7's list: Post Harvest Puzzles' live year (V21 law 5 names that table), Labels (`listLabelPackages`, `latestFinalizedPotency`; `finalized_potency` is now fed only by the Testing Override drop) and the testing desk's join. So the brief's "which no surface reads now" is true of the consoles, not of every page. A word on whether Puzzles and Labels move to the station.
3. Lbs in testing counts retest copies twice. In the package seed, 11 source tags carry two `in_testing` "Retest (...)" samples with the same batch weight: 215,995 g, about 482 lb, of 3,084,227 g. The build follows the brief's letter (the sum of `in_testing` batch weights).
4. The seed records retests as `required_test` "Retest (...)" with first-test statuses (22 rows, all `in_testing`; no `retest_*` status). Under law 7's status-only rule, one closed as plain passed or failed counts as a first test. Either the rule extends to `required_test` "Retest%", or the station offers only the retest words for such a sample.
5. R&D samples leave the External tab (law 7's set), where V19 law 4 had kept them; they remain on the station's R&D tab.
6. `/api/lab/*` sits behind the Admin PIN gate. When the PIN cookie lapses, the API answers the HTML PIN page (401), not the package's JSON; the station keeps the save queued and tells the operator to enter the PIN again. A JSON 401 for the lab paths is a possible follow-up.
7. The typed fallback never fires behind Access: every request has an identity, and the service token is refused on `/api/lab/*`. It stays for the contract.
8. The Photonics list's Operator column is LightLab's own Operator column from the export (instrument data), shown as exported.
9. The Compliance FTQ counts the first row per sample tag across all seasons (V19 law 5); the Harvest Console counts every first-test sample of its season. Two samples sharing a sample tag count once on one and twice on the other.
10. Small, named: a write's log guard matches on the write's own millisecond stamp; an op import that fails partway leaves its earlier 90-row batches landed with their logs; `equipment.ts` still says water activity "runs from the Aqualab drop"; 28 i18n keys V24 orphaned are left in place, as the app's practice is.
11. The seed for the gate is the Scribe's (law 8): the package's seed less its 675 `lab_metrc_packages` statements, rehearsed on a copy of the newest snapshot at 0090.

## Gates

Run in the worktree's `app/`.

- `npm run typecheck`: exit 0.
- `npx vitest run`: 84 files, 1132 tests passed under `TZ=UTC`, and 84 files, 1132 tests passed under `TZ=America/New_York`.
- `node --check scripts/smoke.mjs`: exit 0.
- From-zero smoke (`SMOKE_PORT=9255`, `WRANGLER_SEND_METRICS=false`, `CI=1`, `TZ=UTC`): About to apply 90 migration(s), SMOKE PASS, no ` 500 ` line, exit 0 (18,479 lines of log; the one ` 503 ` line is `POST /api/send`, the smoke's own asserted step).
- Dash, CR and BOM audit by character on all 24 touched files: 0. No key, secret or password value. No personnel name: a word-bounded scan of the whole hashed set against the names the package carries finds 64 lines, every one already in the pinned tree unchanged, and none new. No seed, README or seed-report text in a tracked file.

## Deploy

Not deployed from this session. Nothing committed. Nothing pushed. No git was run.

## Sealed final check

```
the tree as received                  f212635c13cdf0de (279 files; Cursor's partial V24 on the pinned tree)
the pinned tree, rebuilt              7c508a9687242287 (269 files; matches the brief)
npm run typecheck                     exit 0
TZ=UTC npx vitest run                 84 files, 1132 tests passed
TZ=America/New_York npx vitest run    84 files, 1132 tests passed
node --check scripts/smoke.mjs        exit 0
SMOKE_PORT=9255 WRANGLER_SEND_METRICS=false CI=1 TZ=UTC npm run smoke
                                      About to apply 90 migration(s); SMOKE PASS; " 500 " lines: 0; " 503 " lines: 1 (POST /api/send); exit 0
dash audit: 0; CR audit: 0; BOM: 0; secret values: none; personnel data: none new
the app tree after the edits          2d4801bd8c342a19 (280 files)
```

```
app/migrations/0090_lab_tests.sql          5249  7eebd9b5681c2762
TAIL );
app/scripts/smoke.mjs                    749893  9c8653d8e78c55af
TAIL });
app/src/biz.ts                            33040  c5443cce5f3b5408
TAIL }
app/src/compliance.ts                     26811  aec2f01e346dd67b
TAIL }
app/src/config.ts                         82574  ea49723f8b12ecd8
TAIL }
app/src/console.ts                       163669  da88b29f7fb0d344
TAIL }
app/src/i18n.ts                          240521  88fe8c4a18496830
TAIL }
app/src/index.ts                         167244  95b9f50d7a626c17
TAIL export default worker;
app/src/lab.ts                            53813  bf95660602f27807
TAIL }
app/src/labclient.ts                      41963  5c8352db7f11c87b
TAIL }
app/src/labpage.ts                        23884  30498ded250ce9d6
TAIL }
app/src/labrules.ts                       42590  8c3028ea5bae21df
TAIL }
app/src/labvocab.ts                        2131  5c44d3f68d728d6b
TAIL export const LAB_ATTEMPT_SQL = `CASE WHEN status IN (${sqlList(LAB_RETEST_STATUSES)}) THEN 2 ELSE 1 END`;
app/src/lookups.ts                        11805  256e98e20baec3b3
TAIL };
app/src/pages.ts                          37186  2c78f9e41a54dce6
TAIL }
app/test/business_ops.test.ts             37703  dfdd2bb54c8d47b1
TAIL });
app/test/console.test.ts                  85419  63d914aadda3a2ce
TAIL });
app/test/lab.test.ts                      59786  10f7152a7516e221
TAIL });
app/test/labconsole.test.ts                9608  7d514038e9a69be4
TAIL });
app/test/labpage.test.ts                  11848  01ce3a4be687d85d
TAIL });
app/test/labrules.test.ts                 18121  f8cd5e58b7744220
TAIL });
app/test/labsurface.test.ts               13001  2053ac4b08ab7642
TAIL });
app/test/testinggate.test.ts              16696  1fbff14eb5405569
TAIL });
app/test/testingoverride.test.ts           5548  2610ab93baea9b63
TAIL });
```
