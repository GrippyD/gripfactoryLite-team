# 2026-09-23 Harvest Details import

Brief I, canon 0.30.205. The ops dash Harvest Details tab is the book of reality. METRC's harvest name is the HBN string. Where they disagree, the string follows METRC and every other fact follows the sheet, and each change is logged. Migration 0074. Not deployed.

## What landed

`runSheetSync` reads a second tab from the same workbook bytes, named by `app_config.sheet_harvest_tab` (seeded `Harvest Details`). Columns are found by the header text of row 4, trimmed and case-insensitive, with a newline read as a space. Data rows run from row 7 through the last row whose Harvest Batch Name `parseHbn` can read as a lot token. The cached value is what is read. An Excel date serial in Date and Seq. Date becomes an ISO day. A text or error cell in a numeric column lands null. A blank or unreadable name is skipped and counted.

Every parsed row that is not refused lands in `harvest_sheet_rows`, keyed by `sheet_hbn` and `metrc_harvest_tag`, so two tags on one lot both land. An unchanged row is seen and not rewritten. A changed row is rewritten. Grams stay as the sheet holds them. Nothing here writes a wet weight, a lot, a plant tag, or a container.

`sheet_sync_runs` gains `harvest_rows_seen`, `harvest_rows_landed`, `harvest_rows_changed`, and `harvest_rows_skipped` beside the Labor counts. The Sheet Sync page shows both.

A lot the app does not have (no batch with that HBN string, and none with the same year and serial) is minted in the same run: the sheet's date, farm, grow method, strain by name, market strain through `inheritMarketStrain`, manicure, the first tag, serial and year from the seventh segment, `planned_dryspc` from the sixth (NA blank), the farm's grow license, status open, `born_from` `sheet`. The log reason is `harvest details (sync)`. Before the mint, METRC's harvest names are read from `metrc_packages.source_harvests` through `hbnFromMetrcName`. When a METRC name carries the same year and serial but a different text, the batch is minted with METRC's text and the sheet's text stays on the row. The run names the pair.

A row is skipped, named, and nothing is minted when the strain name matches no live strain, the seventh segment's year is not the Date's year, the farm or grow method is unknown or does not match the winning HBN's segment, or the serial is already held by a different batch. The mint never touches strains, grow methods, or farms.

An app batch found by string, or by year and serial when the strings differ, takes the sheet's market strain when the cell is not blank, the sheet's manicure when it is Yes or No, and a tag only when the app's tag is blank. Each change is one log row under `harvest details (sync)` with the old value. `entry_date`, `farm_code`, `grow_method_code`, and `strain_id` of an app-minted batch are not written. A disagreement there is named in the run's message.

When METRC's name for the same year and serial differs from the app's string, the app's `hbn` becomes METRC's text, logged under `HBN follows METRC (0.30.203)` with the old string in `old_value`. The sheet's differing string never renames anything. If a pending wet-weights file or a pending unload upload would be left under the old name, the rename is refused and the file is named. `internal_test_results.hbn` follows the rename, because that report joins the batch on the text.

`born_from` `sheet` counts as the farm's own harvest. Only `metrc` stays out of the HBN Queue, the wet weight pick, the recall list, the lot pencil, and the year's batches.

Import Data accepts a `.xlsm` up to `XLSB_MAX_BYTES` (8 MB) and lands both tabs on the spot as one run with trigger `upload`. The flash is `Harvest Details: {hseen} seen, {hlanded} landed, {hchanged} changed, {hskipped} skipped; Labor: {lseen} seen, {llanded} landed.` followed by the run's message when it has one. The bytes are not stored. A `.xlsx` still queues. The smoke fixture workbook gains a synthetic Harvest Details tab. The owner's workbook is not read.

## Tables that store the HBN text

- `harvest_batches.hbn`: the rename writes it. This is the string the app carries.
- `internal_test_results.hbn`: the rename writes it, one log row per result, same reason. The internal testing report joins `b.hbn = i.hbn`, so leaving the old text would drop the result off the batch.
- `harvest_sheet_rows.sheet_hbn`: not rewritten. It is the sheet's own text, the other book.
- `external_test_results.hbn`: not rewritten. It is the In Testing sheet's harvest name, landed by that import, not a copy of the app's HBN.
- `metrc_packages.source_harvests`: not rewritten. It is METRC's text, and it is the source of the new name.
- `record_change_log` `old_value` and `new_value`: not rewritten. A past log line stays the words that were true then. The rename adds a new line. It does not edit the old ones.

No other table has an `hbn` column. Labels, travelers, and the pending-file names are computed from `harvest_batches.hbn` when the page or the download is built, so they follow the batch once the rename is allowed. A pending wet-weights file is `{hbn}.csv`. A pending unload upload is named `packages_from_harvests_{hbn}.csv` in the refusal, including when the pending kind is a package adjustment. New packages, location changes, test samples, and manifests are built at download from the batch id, and a rename does not refuse them.

## Assumptions for your word

- A sheet-born batch stands open with no lot. It is in the HBN Queue and on the wet weight pick, with the app's own harvests. A METRC-born batch stays out of both.
- On a lot with two Harvest Details rows, the first row's tag is the one stored on the batch. The second row lands beside it and does not replace a tag that is already set. A later row can fill a tag that is still blank.
- A blank Market Strain cell on the sheet changes nothing on a batch the app already has. A filled cell replaces the app's market strain, including one the app inherited from the strain name. The smoke fixture sets `Smoke Cream` on `26244-ARL-GH-027-0-NA-26010`, the first lot that walk mints. The prepack packages in that walk hang on the next serial, `26011`, and were not the row.
- A blank Manicure? cell changes nothing. Yes and No replace the app's manicure.
- The sheet's HBN string never renames the app. If METRC's name for that year and serial is the app's string, the run says `{sheet} is not {app}; the HBN stays`.
- If METRC names two different harvests for the same year and serial, both different from the sheet, the row is skipped and both names are listed. Nothing is minted.
- `entry_date`, farm, grow method, and strain of an app-minted batch are named when the sheet disagrees and are not written. A sheet-born batch and a METRC-born batch do not get those four lines.
- The strain match is the live strain's name, ignoring case, not the HBN code. Banana Berry Wine would mint by the name on the sheet even where the code in the name is the sheet's old code.
- A pending wet-weights file or a pending unload upload blocks the rename and names the file. The unload refusal always says `packages_from_harvests_{hbn}.csv`. New packages, location changes, test samples, and manifests are not treated as a stored file the rename would break.
- A `.xlsx` copy of the workbook still queues. Only `.xlsm` lands on the spot, and only up to 8 MB. Over that cap the words are `That file is over the cap.`
- The Graph pull is unchanged. Once the Entra ids are set, the same cron reads both tabs from the bytes it already fetches.

## Gates

- `npx tsc --noEmit`: exit 0.
- `npx vitest run`: 49 files, 857 tests passed. The same under `TZ=America/New_York`.
- `node --check scripts/smoke.mjs`: exit 0.
- From-zero smoke (`SMOKE_PORT=9152`, `WRANGLER_SEND_METRICS=false`): `About to apply 74 migration(s)`, `SMOKE PASS`, ` 500 ` lines: 0, exit 0. The cron landed Harvest Details 4 seen, 3 landed, 1 skipped, named `No Such Herb`, and minted serial 80 under `45999-PNN-ID-027-1-NA-26080`. `26244-ARL-GH-027-0-NA-26010` took market strain `Smoke Cream` and stayed app-born, logged under `harvest details (sync)`. The sheet-born batch stood in the HBN Queue and on the wet weight pick. The `.xlsm` upload of the fixture landed on the spot with the flash, the `.xlsx` queued, and the file over the cap was refused. `>>` on `1A4050300000000000000E80` inherited the known lot, minted nothing, and the scheduled line read `Sheet Apple - 33 g`.
- Dash audit: 0 on the files below (U+2014 and U+2013).
- `METRC_INTEGRATOR_KEY = "` and `METRC_USER_KEY = "` appear in no file under `src`, `test`, `scripts`, or `wrangler.toml`. `453.59` remains the one METRC comment in `src/config.ts`.

## Browser

On the smoked local database, Sheet Sync showed the four harvest columns. The upload run read 4 seen, 0 landed, 0 changed, 1 skipped, and the message named the skipped strain and that the sheet's string is not METRC's. Import Data accepts `.csv,.xlsx,.xlsb,.xlsm`. The queue held `smoke-harvest.xlsx` and no `.xlsm`. Prepack Scheduled held `1A4050300000000000000E80` as `Sheet Apple - 33 g` under `45999-PNN-ID-027-1-NA-26080`. From METRC read nothing to adopt.

## Deploy

Not deployed from this session. The Scribe gates the report and hands the three-step block. 0074 rides with it.

## Sealed final check

```
npx tsc --noEmit                      exit 0
npx vitest run                        49 files, 857 tests passed
TZ=America/New_York npx vitest run    49 files, 857 tests passed
node --check scripts/smoke.mjs        exit 0
SMOKE_PORT=9152 WRANGLER_SEND_METRICS=false node scripts/smoke.mjs
                                      About to apply 74 migration(s); SMOKE PASS; " 500 " lines: 0; exit 0

app/migrations/0074_harvest_sheet_rows.sql    1855  ddff0240560cec93  tail: ('sheet_harvest_tab', 'Harvest Details', '2026-09-23T00:00:00.000Z', NULL, '2026-09-23T00:00:00.000Z', NULL, NULL, NULL);
app/src/config.ts                            66042  5e819837d427e31f  tail: }
app/src/sheetsync.ts                         79460  fd2b9cf20caa214f  tail: }
app/src/imports.ts                            4309  e7fccbb01f7580f5  tail: }
app/src/actions.ts                          283331  9365fcbda6853dbc  tail: export { MANIFEST_COLUMNS, buckedPackageCode };
app/src/index.ts                            133150  4d977634195e4e9e  tail: export default worker;
app/src/i18n.ts                             161351  d4771dbdf23e88bf  tail: }
app/src/html.ts                             179250  617cf4a5c632726c  tail: }
app/test/sheetsync.test.ts                   31689  7d4a0afab5cab016  tail: });
app/test/imports.test.ts                     14137  5c144caf40cff56e  tail: });
app/test/metrc.test.ts                       63936  3ceffc3bfa64bbd6  tail: });
app/test/console.test.ts                     56624  f96c5d7ba15f6763  tail: });
app/test/surface.test.ts                     79387  b9adf7d2a90c1c75  tail: });
app/scripts/smoke.mjs                       570943  003d9600f30dbd53  tail: });
```
