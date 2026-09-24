# 2026-09-22 The gate on the mirror release and the adoptions (canon 0.30.194)

Scribe session. The gate on his Code session's `SESSION_REPORTS/2026-09-22_mirror_releases_and_adopts.md` (brief F, THE MIRROR RELEASES THE QUEUE AND ADOPTS THE STRANGERS, canon 0.30.193; migration 0072). The report says "Not deployed from this session"; nothing was deployed before this gate. No Scribe change to `app/`.

## What was gated

1. The tree was hashed on the device after the build session went quiet (the last file under `app/` moved at 23:04Z, the report at 23:07Z; the gate began at 23:23Z) and compared with the Scribe's sandbox, which held the tree of canon 0.30.192 (brief E as deployed, 692e82e0affe0b87) byte for byte. Twenty-one files differed, exactly the twenty-one of the report's seal, one of them new (`migrations/0072_metrc_release_states.sql`); after the copy the two trees hash identical (d77f44c628019299, 202 files). Nothing else under `app/src`, `app/test`, `app/scripts`, `app/migrations`, `wrangler.toml`, `package.json`, `package-lock.json`, `tsconfig.json` or `vitest.config.ts` had moved. The migration head is 0072.
2. The twenty-one were staged, verified against the seal (size and sha256, all twenty-one), copied into the sandbox and verified again there.
3. Read against the brief's six laws. THE MIRROR RELEASES THE QUEUE: `releaseTestedFromMirror` (`metrc.ts`) runs after `closeLedgerForGoneTags` on a packages mount, on both mount paths (the whole export and the last window of a chunked round); it selects every live `wip_packages` row in `testing_queue`, reads the live mirror state by `UPPER(TRIM(package_code))` and, failing that, by the package's live ledger `metrc_tag`; the state is looked up in the vocabulary (app_config `metrc_release_states`, parsed case-insensitively, outcomes checked against TEST_OUTCOMES); a state outside the list leaves the row; the status moves through `applyTransition("released")` (testing_queue to released, the hand release's transition), `test_outcome` takes the vocabulary's word, two log rows carry the mount's actor and `metrc mirror: <state> (mount <eight>)`; the update is guarded by the old status so a row is never touched twice; the flash carries released, passed and failed counts, zero included. THE QUEUE SHOWS THE MIRROR: the Testing Queue's `lab_status_metrc` column is the same two-step tag match with `not in METRC` as the fallback, translated. ADOPT FROM METRC: `listMetrcAdoptions` lists live mirror rows in grams with whole grams above zero, a state mapping to passed, an item kind that is WPR or maps to WPR through `cryo_type_categories`, and a tag not on any `wip_packages` row (voided included) nor any live ledger item; the HBN is resolved from `source_harvests` against live `harvest_batches.hbn`, else through one source package's own `source_harvests` in the mirror; `adoptFromMetrc` (`actions.ts`) refuses without an HBN, refuses a tag not on the list, requires the HBN to have a lot (`lotByHbn`, the trimmed lot first), and mints in one batch a `wip_packages` row (the tag as code, the item kind as type, whole grams as weight and cryo weight, `released`, `passed`, `source metrc`) and a WIP ledger item (the tag, the grams in g, the HBN, the lot, the mirror's location and license, the batch's farm code, the strain row by case-insensitive name or null) with log rows under `adopted from METRC`; the redirect returns to the Prepack page. THE FEED KNOWS BOTH SOURCES: `PREPACK_PARENT_SQL` takes `p.source IN ('cryo', 'metrc')`; the trim clauses are now one predicate, `NON_TRIM_SOURCE_SQL` (`COALESCE(p.source, 'trim') NOT IN ('cryo', 'metrc')`), used by the console's trim picture (three queries), the trim feed (`feeds.ts`) and the cryo free-container query, and `drawsFromParentLot(source)` guards the two edit and void branches in `actions.ts`. THE WORDS: Spanish on the column, the flash, From METRC, Adopt and the refusals. NOTHING ELSE MOVES: the Part 3 sweep calls the release only when a change to `metrc_packages.lab_test_status` was written, which today's sweep never writes; it records the one-line note instead. Migration 0072 is one `INSERT OR IGNORE` of the vocabulary.
4. THE LANDING, READ IN THE DATABASE. The smoke's local D1 after the walk: the vocabulary seeded; one cryo output released by the mount (`...000C11`, log rows `status testing_queue to released` and `test_outcome null to passed` under `metrc mirror: TestPassed (mount 3430f170)` with an actor); `...000C12` still in the Testing Queue reading `NotSubmitted` from the mirror; the stranger `...000D01` adopted (`WPR`, 40 g, released, passed, `source metrc`, on a lot) with its WIP ledger item (40 g, Trim Room, the grower license, a strain, the HBN) and twelve log rows under `adopted from METRC`; four prepack schedules (one complete, three scheduled, the adopted one among them); no 500.

## Gates on the tree as received (the Scribe's sandbox)

- `npx tsc --noEmit`: exit 0.
- `npx vitest run`: 49 files, 832 tests passed; the same under `TZ=America/New_York`.
- `node --check scripts/smoke.mjs`: ok.
- From-zero smoke (`SMOKE_PORT=9083`, the DROPS copy of the In Testing workbook present): `About to apply 72 migration(s)`, `SMOKE PASS`, no 500; exit 0 once the dev server was ended by pid (the sandbox note of 0.30.189).
- Dash audit: 0 on `src`, `test`, `migrations/0072_metrc_release_states.sql`, `scripts/smoke.mjs` and the build report.
- Secret grep (`METRC_INTEGRATOR_KEY = "`, `METRC_USER_KEY = "`, `MS_CLIENT_SECRET = "`, `cfast_`): no matches in the slice.

## The floor, read against the morning snapshot (20260922-080023)

- The 83 cryo outputs in the Testing Queue read, in the morning mirror, `NotSubmitted` 33 and `SubmittedForTesting` 19 (52 of the 83 were in the mirror at all; the other 31 were minted after the last mount). Nothing releases until a mount carries a passed or failed state for them; the first mount of the newest Packages export after LIVE is the moment the queue moves.
- Of the 16 stranger WPRs, none reads a release state this morning (`NotSubmitted` 10, `SubmittedForTesting` 6), so From METRC lists none of them today. When METRC grades them: six resolve their HBN directly (`...000012`, `...000036`, `...000057`, `...000084`, `...000092`, `...000119`, whose source harvests are the app's 26011, 26013, 26014, 26015, 26018 and 26021 lots) and adopt with the select prefilled; the other ten descend from the early-season indoor harvests the app never minted (`46248-PNN-ID-062-1-NA-26002`, `46254-PNN-ID-005-1-NA-26004`, `46258-PNN-ID-062-0-NA-26007`, `46268-PNN-OD-078-0-NA-26009`), so their select will be empty and Adopt refuses until an HBN with a lot exists in the app for them. Your word whether a later slice mints an HBN and a lot from METRC's harvest at adoption, or those ten pack outside the app.

## Notes for the owner (not blocking)

- A sweep that one day writes a mirror lab state would release with no actor and a reason naming a random eight in place of a mount id (`metrc mirror: TestPassed (mount <random>)`); today's sweep writes no lab state, so the line does not run. When the sweep learns to write states, the reason should name the sweep.
- The release reads the mirror as mounted: a state METRC has already changed since the last export waits for the next mount (or the API sweep once it writes states).
- The build's eight assumptions stand as the brief asked: the four seeded states; the mount's actor on the log rows; Adopt refusing without an HBN and the select filled from the source harvest or one source package's harvest and no further; the type code as the Item name's first segment, a mapped type adoptable the same way; the strain by case-insensitive name; whole grams with a zero-rounding quantity not listed; a voided package code still an app row; Adopt not scheduling.

## Deploy (his hands; the three-step block, 0072 rides)

```powershell
cd "C:\Users\DennisWallace\Documents\Claude\Projects\gripfactory Practical\app"
npx wrangler d1 execute gripfactory-lite-grip-20260914 --env grip --remote --command "SELECT 1"
npx wrangler d1 migrations apply gripfactory-lite-grip-20260914 --env grip --remote
npm run deploy:grip
```

Then mount the newest Packages export of AU-P-000694 on the METRC Mirror page: the flash says how many left the Testing Queue and how many passed and failed; the Prepack Available pane fills from the passed ones; From METRC lists any stranger METRC has passed.

## Sealed final check

```
npx tsc --noEmit                      exit 0
npx vitest run                        49 files, 832 tests passed
TZ=America/New_York npx vitest run    49 files, 832 tests passed
node --check scripts/smoke.mjs        ok
rm -rf .smoke-persist && CI=1 SMOKE_PORT=9083 WRANGLER_SEND_METRICS=false npm run smoke
                                      About to apply 72 migration(s); SMOKE PASS; " 500 " lines: 0; exit 0
the build session's seal (21 files) verified byte for byte on the device and in the sandbox:
migrations/0072_metrc_release_states.sql             529  858f438d44dbdc0d
src/config.ts                                      65096  a8a0f81b626f5f56
src/metrc.ts                                       80556  423de87dcaeae656
src/metrcpane.ts                                   18596  37b676dd55bd7634
src/metrcapi.ts                                    25891  e2ad026ecad07ac9
src/db.ts                                         164788  8a7df9eca5626e8b
src/feeds.ts                                       14905  697ccd60f11413be
src/console.ts                                     98418  fe877430606687d8
src/actions.ts                                    273458  960d71a52b1151ca
src/scheduling.ts                                  12108  d854c3ca9b6de85c
src/pipeline.ts                                    49694  2289012de86cc6c6
src/index.ts                                      131382  2bd93d583df97ce1
src/html.ts                                       179035  4b74dff145d50bf1
src/lookups.ts                                      8306  d324b02ee5c52e16
src/i18n.ts                                       154115  794a082fb6cf9166
src/intesting.ts                                   28323  cb44402ed5e829b2
test/metrc.test.ts                                 51406  64cdcfd42be1e975
test/scheduling.test.ts                            12581  97486408b2add20c
test/feeds.test.ts                                 15087  c95a7409348171cf
test/cryo.test.ts                                  25501  99d4ba4128bbe4c6
scripts/smoke.mjs                                 549534  0b301cae76d2c1f3
tree hash after the copy, device and sandbox: d77f44c628019299 (202 files)
the build report: SESSION_REPORTS/2026-09-22_mirror_releases_and_adopts.md  8579  b3be1d73716ca1ca
dash audit: 0 on every file above
secret grep: no matches
```
