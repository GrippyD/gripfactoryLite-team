# 2026-09-21 The testing desk, part 1 (canon 0.30.164, brief C)

Build session under THE DISPATCH RULE (canon 0.30.155), brief `BRIEFS/2026-09-21_testing_desk.md`, part 1 only. Migration `0068`. From-zero smoke pin is 68. Not deployed. Lands after briefs A and B. The Scribe gates this report. Part 2 (the console Testing numbers) and part 3 (the Metrc mirror) wait.

Owner, 2026-09-21, the desk half of his ruling: the lab tech schedules, samples, manifests (a CSV on the admin screens), and records results. Metrc stays by hand. "Number of lots ready" means ready to schedule.

## The law, as built

1. THE LABS. `testing_labs` holds name, portal kind (`tagleaf`, `slingr`, `other`), portal URL, med license, adult-use license, turnaround days, pickup cutoff, sample increment grams, active, and stamps. Seeds: SC Labs Michigan (med SC-000035, adult-use AU-SC-000129, portal tagleaf), ACT Laboratories (med SC-000048, adult-use AU-SC-000152, portal slingr), Lab Link (med SC-000037, adult-use AU-SC-000133, portal other), Viridis (med SC-000009, adult-use AU-SC-000113, active 0). Admin, Lookups, Testing labs edits this table. Driver names, phones, and license numbers are columns on a manifest and are never seeded.
2. THE ORDER. `test_orders` hangs off a lot (`wet_weight_entries`). One open order per lot. Open is `scheduled`, `sampled`, `in_transit`, `at_lab`, `results_in`, or `retest_scheduled`. Passed, failed, remediated, and cancelled do not block a new order. `/testing` sits behind the Admin PIN. Ready to schedule is a lot in status `trimmed`, not deleted, with no open order. Each row shows the HBN serial, strain, farm, item, license, market, dry grams, and sample size. The sample is 0.5 percent of the batch, whole grams, 14 g floor, then up to the lab increment when that lab has one. A batch over 50 lb (22,400 g at 448 g/lb) refuses in words with R 420.304. 50 lb exactly is allowed. Schedule writes the order and logs it. The page says the pickup is still booked in the lab portal and links that portal.
3. THE SAMPLE. `test_samples` takes a tag-shaped unused tag (THE TAG LAW), net grams, gross grams, sampler, grower witness, chain of custody, sealed container, and the attempt. Save moves the order to `sampled` and logs it. Attempt is 1 plus the samples already on that lot.
4. THE MANIFEST. One or more sampled orders, same lab, same market, same pickup day. Two downloads, both recorded. (a) The METRC New Packages CSV, header `Tag Number,Location Name,Item Name,Use Same Item,Quantity,Unit Of Measure,Note,Actual Date,Expiration Date,Sell By Date,Use By Date,Is Donation,Template Ingredients Quantity,Template Ingredients Unit Of Measure,Package Number,Ingredient Quantity,Ingredient Unit Of Measure,Ingredient Finish Package,Ingredient Finish Date`. One row per sample: the sample tag, location `In Testing`, Use Same Item `true`, net grams as Quantity in `Grams` at METRC's two decimals (not the 448 pound), the sample date, the source package tag as Package Number, the same grams as Ingredient Quantity. (b) A worksheet CSV and a printable page: transfer type `Testing Transfer (to SCF)`, the lab license for the market, the sample tags and gross weights, the driver and vehicle fields the tech types, the route note. `test_manifests` ties the samples. Mark sent moves the orders to `in_transit`. The manifest number typed later moves them to `at_lab`. The CSV pends at Admin, Pending Data Uploads, kind `test_sample`, with mark uploaded and Clear all.
5. THE RESULTS. `test_results` is one row per test type (`potency`, `foreign_matter`, `microbials`, `heavy_metals`, `chemical_residue`, `water_activity`, `mycotoxins`, `terpenes`, `other`) with pass or fail and a value. The sample also keeps overall pass, THC, THCa, CBD, water activity, COA link, lab sample id, and a failure note. Save on an order at the lab marks the sample and the order passed or failed and logs it. Any failed type fails the order. A failed order offers Schedule retest (a new order, the next attempt, quoting R 420.306) and Mark remediated (reason, CRA approval reference, date). The failure mode is the set of failed test types.
6. THE MIRROR COLUMNS. `metrc_lab_testing_state`, `metrc_state_date`, `metrc_result_id`, and `coa_file_id` are on the tables and stay null. Part 1 sends no request to Metrc.

## What changed

- `migrations/0068_testing_desk.sql`: the five tables, the indexes, the four lab seeds. No driver rows.
- `src/testing.ts`: sample size, the 50 lb check, the desk loaders, the actions, the pages, both CSVs.
- `src/index.ts`: `/testing` behind the Admin PIN; the lookups editor; the pending-upload download and mark-uploaded lane.
- `src/html.ts`: the Admin tile and the Test samples block on Pending Data Uploads.
- `src/actions.ts`: Clear all includes a pending test-sample file. Mark uploaded names the file.
- `src/config.ts`: `TESTING_PATH`, panels, test types, open statuses, `METRC_UPLOAD_KINDS.test_sample`, the `SYSTEM_REASON` lines.
- `src/lookups.ts`: the Testing labs button describes the desk's labs. The old `lookup_values` category `testing_lab` is still the external compliance form's list.
- `src/i18n.ts`, `src/theme.ts`.
- `test/testing.test.ts`.
- `scripts/smoke.mjs`: pin 68. After the lot is trimmed, the smoke walks schedule, a refused second order, a refused bad tag, sample, both downloads, the pending file, mark uploaded, sent, the manifest number, a fail, a retest, a remediation, and a pass.

## Assumptions for the owner's word

- Ready means status `trimmed`. A cryo'd lot stays `trimmed`, so it is ready. An unloaded lot is not. A frozen lot is not.
- The item name stored on the order is the lot's strain. There is no METRC item catalog on the desk yet.
- The required lab test batch is always `Raw Plant Material`.
- Sample increment is a nullable column, empty on every seed. Until a lab's increment is typed in Lookups, the size is the 0.5 percent figure with the 14 g floor.
- 50 lb is 50 times 448 g, which is 22,400 g. Over that refuses. Equal is the maximum allowed.
- The METRC header separates columns with a comma and no space, the same way the other METRC headers in this app are written. Use Same Item is the word `true`. Quantity is two decimals. The house pound is not applied.
- When the lot package has no tag-shaped METRC tag, the CSV prints the package code and Pending Data Uploads says no METRC tag yet. The manifest is still recorded.
- A manifest that covers more than one harvest batch stores the first order's batch on `metrc_uploads`. The file itself lists every sample.
- A retest is a new order in status `retest_scheduled`. The failed order stays failed until Mark remediated. The attempt number lives on the sample.
- Recording results requires at least one test type. A full-compliance panel does not force every Michigan type onto the form. Mycotoxins and terpenes stay optional.
- `results_in` and `cancelled` are statuses the tables allow. The desk does not set them.
- The old lookup value "SC Labs (SC-000035 / AU-SC-000129)" remains for the external compliance form. The desk does not read that list.

## Owner section (for the Scribe to hand)

The Metrc Connect gate is still in front of any key: the TPI webinar, the test, the certificate, then `npx wrangler secret put METRC_INTEGRATOR_KEY --env grip` and `npx wrangler secret put METRC_USER_KEY --env grip`. Sandbox first. Part 1 does not read either secret.

The CRA Compliance Best Practice Guide, Updated May 2026, is still to be read before this part is signed off.

The lab license numbers in the seed are the ones in the brief and the workbook. They have not been checked against the CRA verification tool in this session. That check is still his before he treats the numbers as verified.

The lab tech is named as a person, with the desk's PIN (the Admin PIN).

The block is three-step because migration 0068 rides: probe, migrations apply, deploy.

## Gates

- `npx tsc --noEmit`: exit 0.
- `npx vitest run`: 45 files, 796 tests passed. The same under `TZ=America/New_York`.
- `node --check scripts/smoke.mjs`: exit 0.
- From-zero smoke (`SMOKE_PORT=9125`, `WRANGLER_SEND_METRICS=false`): `About to apply 68 migration(s)`, `SMOKE PASS`, ` 500 ` lines: 0, exit 0.
- Dash audit: 0 on every file below (U+2014 and U+2013).
- `METRC_INTEGRATOR_KEY` and `METRC_USER_KEY` appear in no file under `src`, `test`, `scripts`, or `wrangler.toml`.

## Deploy

Not deployed from this session. The Scribe gates the report, folds the row, and hands the three-step block. Part 2 waits for another continue.

## Sealed final check

```
npx tsc --noEmit                      exit 0
npx vitest run                        45 files, 796 tests passed
TZ=America/New_York npx vitest run    45 files, 796 tests passed
node --check scripts/smoke.mjs        exit 0
rm -rf .smoke-persist && SMOKE_PORT=9125 WRANGLER_SEND_METRICS=false npm run smoke
                                      About to apply 68 migration(s); SMOKE PASS; " 500 " lines: 0; exit 0

app/migrations/0068_testing_desk.sql      4962  248533389c6311e4
app/src/testing.ts                       64065  a0e8a1ba35893a1c
app/src/config.ts                        60031  d4377beb1eceaa0f
app/src/index.ts                        125758  215288b896111ecd
app/src/html.ts                         176926  e24c028f5ba2e945
app/src/actions.ts                      267202  529ef3079041a09b
app/src/i18n.ts                         147355  9fb08db3029091ea
app/src/theme.ts                        152243  d3e027e0b5063e6a
app/src/lookups.ts                        8180  cc5f3a665f7e689e
app/test/testing.test.ts                  5442  34ad950bc2e9a5cf
app/scripts/smoke.mjs                   526790  fbeb307bc1b82f62
```
