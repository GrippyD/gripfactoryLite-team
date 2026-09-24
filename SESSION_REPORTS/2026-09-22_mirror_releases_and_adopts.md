# 2026-09-22 The mirror releases the queue and adopts the strangers

Brief F, canon 0.30.193. A packages mount releases Testing Queue packages whose live METRC lab status is in the release vocabulary, and Prepack scheduling can adopt a passed WPR the app does not already have. Migration `0072_metrc_release_states.sql` seeds that vocabulary and changes no table shape. Not deployed.

## What landed

- After every packages mount closes the ledger for gone tags, `releaseTestedFromMirror` releases each live Testing Queue package whose tag matches a live mirror row. The match is `UPPER(TRIM(package_code))`, and when the code is not the tag it also matches the package's live ledger `metrc_tag`. `TestPassed` and `RetestPassed` become `passed`. `TestFailed` and `RetestFailed` become `failed`. Status moves through the same `released` transition the hand Release uses. Two log rows (status, test_outcome) carry the mount's actor and the reason `metrc mirror: <the METRC state> (mount <first eight of the mount id>)`. A released row is not in the queue, so a second pass does not touch it. The hand Release stays.
- The packages flash says the count, including zero: `N released from the Testing Queue by METRC (n passed, n failed)`. A plants mount does not add that sentence.
- The Testing Queue gains `Lab status (METRC)`, the live mirror `lab_test_status` by the same tag match, or `not in METRC` when the mirror has no live row.
- Prepack scheduling, under Available, gains `From METRC` (`data-schedule-adopt`). A row is a live mirror package in grams, quantity still above zero after `roundGrams`, lab status mapping to `passed`, item kind WPR or a type `cryo_type_categories` maps to WPR, and no app row. The row shows the last six of the tag, the strain, the grams, the location, and the license, with an HBN select. Adopt posts the tag and the HBN and mints a released, passed package (`source` `metrc`) plus a WIP ledger item, reason `adopted from METRC`. It does not schedule. The package then stands in Available and schedules, packs, and finishes with the rest. A tag adopted once leaves From METRC.
- The prepack feed takes `source` `cryo` or `metrc`. Trim pictures, the cryo-free container query, and the edit and void branches that draw from a parent lot all treat `metrc` the same way they treat `cryo`: an adopted package is not a trim container and not a cryo input.
- The Part 3 sweep still writes only `test_samples` and `test_orders`. It does not write `metrc_packages.lab_test_status`, so it does not call the release. Its message adds one line: `No mirror package lab status was written, so nothing was released from the Testing Queue.`

The From METRC list and the HBN hop live in `metrc.ts` (`listMetrcAdoptions`, `resolveAdoptHbn`). `db.ts` is already imported by `metrc.ts`, so the query stays beside the mirror helpers.

## Assumptions for your word

- The vocabulary is the four seeded states: `TestPassed=passed`, `RetestPassed=passed`, `TestFailed=failed`, `RetestFailed=failed`. `NotSubmitted` and `SubmittedForTesting` are not in that list, so they stay in the Testing Queue and do not appear in From METRC. Any later METRC state that is not in the list does the same until the app_config value names it.
- The log rows use the mount's actor. A sweep has no person, so if a future sweep ever writes a mirror lab status the actor on those rows would be empty. Today's sweep does not write one, and the one-line note above is what it records.
- Adopt refuses with `Pick an HBN before adopting.` until an HBN is picked. The select is prefilled when `source_harvests` matches a live `harvest_batches.hbn`, or when one source package's own `source_harvests` matches. It does not follow that package's source packages. No match leaves the select empty.
- The new package's type code is the Item name's first segment (`WPR - Wild Mango Creamsicle - PNN - O` is `WPR`). A type the category list maps to WPR, SMALLS by default, is adoptable the same way, and that type code is what gets stored.
- Strain is `item_strain`, or the Item name's second segment when the strain is blank. The ledger `strain_id` is the strain row whose name matches, case insensitive. No match stores null.
- Grams are `roundGrams` of the mirror quantity. A quantity that rounds to zero is not listed. The ledger stores the mirror location as it arrived, and the harvest batch's farm code, because the ledger row requires one.
- A voided `wip_packages` row with that `package_code` still counts as an app row, so the tag is not offered again.
- Adopt does not schedule. The operator uses the same schedule action as any other available package.

## Gates

- `npx tsc --noEmit`: exit 0.
- `npx vitest run`: 49 files, 832 tests passed. The same under `TZ=America/New_York`.
- `node --check scripts/smoke.mjs`: exit 0.
- From-zero smoke (`SMOKE_PORT=9147`, `WRANGLER_SEND_METRICS=false`): `About to apply 72 migration(s)`, `SMOKE PASS`, ` 500 ` lines: 0, exit 0. The walk mounted a packages export that released one TestPassed cryo output, left a NotSubmitted package in the Testing Queue with that lab status, listed a stranger WPR with the smoke HBN prefilled, refused Adopt with no HBN, adopted it, scheduled it, and opened it on the station.
- Dash audit: 0 on `src`, `test`, `migrations/0072_metrc_release_states.sql`, and `scripts/smoke.mjs` (U+2014 and U+2013).
- `METRC_INTEGRATOR_KEY = "` and `METRC_USER_KEY = "` appear in no file under `src`, `test`, `scripts`, or `wrangler.toml`. `453.59` remains the one METRC comment in `src/config.ts`.

## Browser

On the smoked local database: Production Scheduling, Prepack, showed Available empty, Scheduled `000C11 / Fruity Pebbles / 15 g` (the mirror release), `000D01 / Fruity Pebbles / 40 g` (the adopted stranger), and `000A02`. From METRC no longer listed `000D01`. The station for `000D01` read 40 g remaining and Finish Pack. Data Queues, Testing Queue, had one row, tag `...000C12`, column Lab status (METRC) reading `NotSubmitted`, with the hand Release still on the row. `000C11` was not in the queue. Spanish on the scheduling page read Desde METRC, Elija un HBN, and Adoptar.

## Deploy

Not deployed from this session. The Scribe gates the report and hands the three-step block. 0072 rides. After LIVE, mount the newest Packages export and the queue releases. Strangers are adopted from the Prepack scheduling page with their HBN.

## Sealed final check

```
npx tsc --noEmit                      exit 0
npx vitest run                        49 files, 832 tests passed
TZ=America/New_York npx vitest run    49 files, 832 tests passed
node --check scripts/smoke.mjs        exit 0
Remove-Item .smoke-persist; SMOKE_PORT=9147 WRANGLER_SEND_METRICS=false npm run smoke
                                      About to apply 72 migration(s); SMOKE PASS; " 500 " lines: 0; exit 0

app/migrations/0072_metrc_release_states.sql    529  858f438d44dbdc0d  tail:   );
app/src/config.ts                             65096  a8a0f81b626f5f56  tail: }
app/src/metrc.ts                              80556  423de87dcaeae656  tail: }
app/src/metrcpane.ts                          18596  37b676dd55bd7634  tail: }
app/src/metrcapi.ts                           25891  e2ad026ecad07ac9  tail: }
app/src/db.ts                                164788  8a7df9eca5626e8b  tail: }
app/src/feeds.ts                              14905  697ccd60f11413be  tail: }
app/src/console.ts                            98418  fe877430606687d8  tail: }
app/src/actions.ts                           273458  960d71a52b1151ca  tail: export { MANIFEST_COLUMNS, buckedPackageCode };
app/src/scheduling.ts                         12108  d854c3ca9b6de85c  tail: }
app/src/pipeline.ts                           49694  2289012de86cc6c6  tail: }
app/src/index.ts                             131382  2bd93d583df97ce1  tail: export default worker;
app/src/html.ts                              179035  4b74dff145d50bf1  tail: }
app/src/lookups.ts                             8306  d324b02ee5c52e16  tail: };
app/src/i18n.ts                              154115  794a082fb6cf9166  tail: }
app/src/intesting.ts                          28323  cb44402ed5e829b2  tail: }
app/test/metrc.test.ts                        51406  64cdcfd42be1e975  tail: }
app/test/scheduling.test.ts                   12581  97486408b2add20c  tail: });
app/test/feeds.test.ts                        15087  c95a7409348171cf  tail: });
app/test/cryo.test.ts                         25501  99d4ba4128bbe4c6  tail: });
app/scripts/smoke.mjs                        549534  0b301cae76d2c1f3  tail: });
```
