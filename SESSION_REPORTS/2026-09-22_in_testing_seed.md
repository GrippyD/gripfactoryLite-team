# 2026-09-22 In Testing sheet seed

Brief D, canon 0.30.187. The app reads the In Testing workbook, lands both tabs in `external_test_results` and the desk's tables, and takes the file through Admin Imports and the hourly cron. Migration `0070_in_testing_seed.sql`. Not deployed.

## What landed

- `src/xlsb.ts` reads an MS-XLSB workbook (zip, bundle records, shared strings, the cell kinds named in the brief, RK flags, formula cached values, 1900 date serials). A test-side writer proves those kinds. The real workbook is never a fixture.
- `src/intesting.ts` is the one parser. Admin Imports accepts `.xlsb` and runs the landing without storing the bytes (Driver Info is inside the zip). The hourly cron runs the Labor sheet, the Metrc sweep, and this pull. Each run is a `sheet_sync_runs` row with `source` `labor` or `in_testing`. Admin Sheet sync shows the last run of each source. The Harvest Console's hours line keeps reading the Labor run.
- A sheet row upserts by `sheet_key`. The sheet wins on its columns. A manual row and a desk row are never touched. A row the next run does not find stays, with `on_sheet` 0, and the compliance page says "no longer on the sheet". The change log has no actor and the reason `in testing sheet`.
- The desk gets one order, one sample, and results from the status, the fail reason, and the THC. `test_orders.lot_id` is nullable. An unknown HBN stands without a lot. Lots ready, lots scheduled, and retest waiting still count only orders that have a lot. The rate, the by-lab and by-strain groups, and the COA and THC lists read every order. Strain is the row's Strain. Farm is the HBN's farm-code segment.
- While `MS_TENANT_ID` or `MS_CLIENT_ID` is blank or `TBD`, or `MS_CLIENT_SECRET` is absent, the pull records a skipped run and does not call Graph. The default env still uses the fixture URL.

## The DROPS copy, landed locally

`DROPS/In Testing (2026).xlsb` is 1,065,562 bytes. The same landing the Admin upload runs produced:

- rows seen 392, rows landed 392, rows changed 0, rows skipped 361
- message: `unknown lab Reassure; blank Sample Tag`
- In Testing 376 rows, R&D 16 rows
- 300 rows had a blank Sample Tag
- 61 rows named the facility Reassure, which is not in the lab alias list, so they stay on the compliance table and skip the desk
- no row had an unknown Required Test
- 31 rows became desk orders (392 minus 361)
- the from-zero smoke uploaded the same file at the end and printed `seen=392&landed=392&changed=0&skipped=361&message=unknown+lab+Reassure;+blank+Sample+Tag`

## Assumptions

- `Turnaround Time (Days)` is not a required header. The R&D tab does not have that column, and the value is not stored. A missing stored header still fails the run and changes nothing.
- `sheet_key` is the tab, the Sample Tag, and the attempt, so a retest does not overwrite the earlier row. A blank Sample Tag uses the tab and the row number. That follows the owner's pick: upsert by Sample Tag and attempt.
- A Batch Weight cell that is text (the real file's first In Testing row has the strain name in that cell) lands as no grams. The desk order stores 0. The console then shows 0.00 lb for that package and still counts the package.
- Excel serial 46244, the first In Testing Entered Testing value, is the calendar date 2026-08-10.
- Whole grams, round half up. THC keeps its decimals. Testing Status is stored as typed. The first-time rate still looks for the exact status `Passed`.
- Driver Info is never opened. The reader loads only the In Testing and R&D tabs.

## Gates

- `npx tsc --noEmit`: exit 0.
- `npx vitest run`: 48 files, 818 tests passed. The same under `TZ=America/New_York`.
- `node --check scripts/smoke.mjs`: exit 0.
- From-zero smoke (`SMOKE_PORT=9142`, `WRANGLER_SEND_METRICS=false`): `About to apply 70 migration(s)`, `SMOKE PASS`, ` 500 ` lines: 0, exit 0.
- Dash audit: 0 on `src`, `test`, `migrations/0070_in_testing_seed.sql`, and `scripts/smoke.mjs` (U+2014 and U+2013).
- `METRC_INTEGRATOR_KEY = "` and `METRC_USER_KEY = "` appear in no file under `src`, `test`, `scripts`, or `wrangler.toml`. `453.59` remains the one METRC comment in `src/config.ts`.

## Browser

On the smoked local database: Import Data's file input accepts `.csv,.xlsx,.xlsb`. The external compliance table listed 395 rows, including `BUD Seed` and `1A40503000311FB0000000A2`, and two fixture rows read "no longer on the sheet" after the real workbook replaced them. The Harvest Console Testing section read ACT Laboratories and SC Labs Michigan, and by strain then farm (Seed Pass 10.00 of 10.00 lb, 1 of 1 packages; the season's strains from the sheet the same way).

## Deploy

Not deployed from this session. The Scribe gates the report and hands the three-step block. 0070 rides. The Graph pull stays skipped on the grip worker until the Entra ids and the secret land. The Admin upload seeds the floor before that.

## Sealed final check

```
npx tsc --noEmit                      exit 0
npx vitest run                        48 files, 818 tests passed
TZ=America/New_York npx vitest run    48 files, 818 tests passed
node --check scripts/smoke.mjs        exit 0
Remove-Item .smoke-persist; SMOKE_PORT=9142 WRANGLER_SEND_METRICS=false npm run smoke
                                      About to apply 70 migration(s); SMOKE PASS; " 500 " lines: 0; exit 0

app/migrations/0070_in_testing_seed.sql     4512  b4a0af3aa50ba6b8  tail:   ('in_testing_fail_types', 'Coliforms=microbials; Total Yeast & Mold=microbials; Total Yeast and Mold=microbials; Yeast & Mold=microbials; Heavy Metals=heavy_metals; Foreign Matter=foreign_matter; Water Activity=water_activity; Pesticides=chemical_residue; Chemical Residue=chemical_residue; Mycotoxins=mycotoxins; Potency=potency', '2026-09-22T00:00:00.000Z', NULL, '2026-09-22T00:00:00.000Z', NULL, NULL, NULL);
app/src/xlsb.ts                            14397  a61807330d8b7937  tail: }
app/src/intesting.ts                       28316  0e5e981942459641  tail: }
app/src/sheetsync.ts                       38788  2db96955462fb97f  tail: }
app/src/imports.ts                          4108  8a1474c26a866c89  tail: }
app/src/actions.ts                        267865  e8c82d825489dd13  tail: export { MANIFEST_COLUMNS, buckedPackageCode };
app/src/index.ts                          128102  218c242721b1ce80  tail: export default worker;
app/src/html.ts                           177252  0f82845659a55f01  tail: }
app/src/compliance.ts                      26009  5641395f2835fea7  tail: }
app/src/i18n.ts                           151095  44e550a13db5905b  tail: }
app/src/console.ts                         92257  015bbc763cc2470d  tail: }
app/src/testing.ts                         63843  b875c437ae68ddde  tail: }
app/src/config.ts                          61000  208f4ba59fdb8c1b  tail: }
app/test/xlsb.test.ts                       1982  44248465233dc10e  tail: });
app/test/intesting.test.ts                 12819  536cade4ff00a8a7  tail: }
app/test/console.test.ts                   49278  c782f40afe6d7cf5  tail: });
app/test/imports.test.ts                   11750  cb7fc10ddbdcbb41  tail: });
app/test/surface.test.ts                   79364  cc2cad0e1bd75ff6  tail: });
app/scripts/smoke.mjs                     536427  90098a2a12412f26  tail: });
```
