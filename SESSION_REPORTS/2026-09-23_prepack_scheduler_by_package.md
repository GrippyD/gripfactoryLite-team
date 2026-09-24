# 2026-09-23 The prepack scheduler by package, the HBN inherited

Brief G, canon 0.30.196. The Prepack scheduling page lists packages and schedules one package per `>>`. Every package carries its HBN. Adopt picks nothing: a stranger inherits the harvest METRC's lineage names, and a harvest the app never minted is minted from METRC's name, born from METRC, with no lot. Migration `0073_package_hbn.sql`. Not deployed.

## What landed

- The package carries its HBN. 0073 rebuilds `wip_packages` with `harvest_batch_id` (the last column, filled from each row's lot, indexed) and a nullable `wet_weight_entry_id`; every other column and index is kept. `harvest_batches` gains `born_from TEXT NOT NULL DEFAULT 'app'`. Trim Packages Entry sets the HBN from the lot, a cryo output from its run, an adoption from METRC's lineage. The prepack feed, the Scheduled and Complete lists, the station's job and parent, and the pending prepack files read the HBN from the package, with the lot optional; a package whose lot was voided stays out as before. The console's Prepack section reads no HBN, so `console.ts` is untouched. The other stages keep reading their lots.
- The scheduler by package. All three panes list one row per package: `data-schedule-tag` the tag, `data-schedule-hbn` the HBN, the last six first, then strain and grams, the HBN muted. Available rows carry `>>`, which posts `wip_package_id` to `schedulePackage`: one schedule row for that package under its HBN, refused in words when the package is already scheduled or no longer available. Scheduled rows carry `<<` (unschedule, still refused while lines stand) and the `>` that opens the station. Complete rows add the time. The Available count is packages. An HBN-wide post to the prepack schedule refuses in words. Trimming and Pasteurization keep their HBN groups and their `>>` per HBN.
- The filter. A text box at the top (`data-schedule-filter`) narrows all three panes and From METRC as the operator types, counts what shows, and reads `- EMPTY -` on a pane with no match. The value rides `?q=`. The server hides non-matching rows with the `hidden` attribute when `q` is present, so the page is right without the script and the script can widen it again. Every `>>`, `<<` and Adopt post carries `q` back to the page. The filter never changes what is scheduled.
- The HBN is inherited, never picked. From METRC has no select. Each row reads the last six, strain, grams, location, license and the HBN it will inherit, marked `known` or `new from METRC`; a row whose lineage names no harvest reads `no harvest in METRC's lineage` and has no Adopt. Adopt posts the tag alone. A known HBN is inherited as it stands (the trimmed lot when the batch has lots, none when it has none). A new one is minted in the same batch from METRC's name (`hbnFromMetrcName` on `parseHbn`): farm, grow method, strain code, manicure, planned dry space, the year and serial from the seventh segment, the entry date, the strain by name or minted, the mirror's license, status open, `born_from` metrc, every row logged under `adopted from METRC`. A refusal mints nothing.
- The METRC-born HBN stays out of the harvest (the list below).
- Spanish on every new string: the filter label and placeholder, `known`, `new from METRC`, `no harvest in METRC's lineage`, the refusals, the empty line.

## Law 5 list

Excluded, or refused, for a METRC-born batch:

- `db.ts` `listLookup("harvest_batches")`, the HBN pencil's options on a lot: leaves it out.
- `db.ts` `listHarvestQueueRows`, the HBN Queue, its CSV export, and the Wet Weight HBN pick and pane: leaves it out.
- `db.ts` `countQueue`, the HBN Queue count on Home and in Data Queues: leaves it out.
- `db.ts` `listRecallableBatches`, the Acquire HBN recall list on the mint page: leaves it out.
- `db.ts` `listHarvestsByYear`, the harvest by year report's batch count: leaves it out.
- `actions.ts` `createWetWeight`, Start lot: refuses it (`That batch is not in the HBN Queue.`).
- `actions.ts` `editRecord`, the HBN pencil's save on a lot: refuses it (`That HBN was minted from METRC and takes no lot.`).
- `actions.ts` `recallHarvestBatch`, the Acquire recall: refuses it (`That batch is not in the HBN Queue.`).

Read on purpose:

- `db.ts` `PREPACK_PARENT_SQL`, the prepack feed: an adopted package on a METRC-born batch stands in Available.
- `db.ts` `listPrepackScheduled`, Scheduled and Complete: the same package, under its HBN.
- `prepack.ts` `loadJob`: the station reads the job's HBN from the package.
- `prepack.ts` `loadPrepackPane`: the station's job list, the same.
- `prepack.ts` `listPendingPrepackFiles`: the adopted package's Finish and New Packages files pend under its HBN, as any prepack job's do.
- `metrc.ts` `listMetrcAdoptions`: a METRC-born batch is known to the next stranger of that harvest, so it is minted once.
- `intesting.ts` `lotByHbn`: joins lots; a METRC-born batch has none, which is the adoption's no-lot path.
- `actions.ts` `createHarvestBatch` (`MAX(lot_serial)`): the mint's next serial counts every batch, so no serial is reused.
- `actions.ts` `manualHbn` (serial taken): the same.
- `db.ts` `getHarvestByHbn`: the mint's HBN collision check sees every batch.
- `actions.ts` `mintMetrcBatch` (the name and the serial): sees every batch, voided included.
- `actions.ts` `adoptFromMetrc`: the known batch by id.
- `db.ts` `lookupValueReferenced` (silo number): a batch that names a value keeps it from being voided in Lookups.
- `db.ts` `lookupValueReferenced` (license): the same.
- `db.ts` `listTable` via `/export/harvest_batches.csv`: the raw table export, every row with its `born_from`.
- `db.ts` `listInternalTestingReport`: a test row's HBN name borrows its batch's date and strain for display.
- `db.ts` `listLocalInventory`: a ledger item shows its batch's strain and HBN; inventory, not harvest.
- `db.ts` `listOutboundInventory`: the same.
- `db.ts` `listDrySpaceInventory`: the same.
- `db.ts` `listMovementItems`: the same, for manifest lines.
- `db.ts` `listListings`: the same.
- `db.ts` `listLabelPackages`: the same.
- `locations.ts` `listLedgerPackagesForLicense`: the same.
- `locations.ts` `resolvePackagePick`: the same.

Unaffected, because each joins lots, plant tags, wet weights, trim containers, runs or orders that a METRC-born batch never has:

- `db.ts` `listLotQueueRows`: lots.
- `db.ts` `listPackageQueueRows`: packages through lots; an adopted package is released and in no queue.
- `db.ts` `listTrimAvailable`, the trim feed on Trimming: unloaded lots.
- `db.ts` `listCryoAvailable`, the cryo pool: lots and trim containers.
- `db.ts` `CRYO_RUN_SELECT`, Pasteurization runs: a run needs trim containers.
- `db.ts` `listPendingNewPackagesUploads`, cryo New Packages by HBN: finished runs with outputs.
- `db.ts` `listTrimScheduled`: lots.
- `db.ts` `getLot`: one lot.
- `db.ts` `PENDING_WET_UPLOADS_SQL`, the wet weights upload by HBN: finished lots.
- `db.ts` `listWetWeightUploadReads`: one batch's finished lots.
- `db.ts` `listWetWeightUploadEntries`: the same.
- `db.ts` `listDryingLotsForSheet`: lots.
- `db.ts` `listUnloadedLotsForSheet`: lots.
- `db.ts` `WIP_SHEET_SELECT`: trim and cryo packages; released and packed rows are outside its reads.
- `db.ts` `listWetLotMaterial`: lots.
- `db.ts` `listInboundTruckLots`: lots.
- `db.ts` `listSiteWetLots`: lots.
- `db.ts` `listWeighingLots`: lots.
- `db.ts` `listPendingPackageUploads` (unload sessions): lots.
- `db.ts` `listPendingPackageUploads` (queue adjust on unload): lots.
- `db.ts` `listPendingPackageUploads` (queue adjust on trim): lots.
- `db.ts` `listProductMix`: packages joined to lots.
- `db.ts` `listTatStatusLogs` (lots): lots.
- `db.ts` `listTatStatusLogs` (packages): packages through lots.
- `db.ts` `BARN_WET_LOT_SELECT`, Load Silo and its planned silo: lots.
- `db.ts` `SILO_LOAD_SELECT`: loads of lots.
- `db.ts` `listSiloLotGrams`, the silo tiles and the planned dry space: lots; a METRC-born batch's planned dry space places nothing.
- `db.ts` `listPendingLocationChangeUploads`: silo loads.
- `actions.ts` `finishLot`: one lot.
- `actions.ts` `ARRIVAL_LOT_SQL`: one lot.
- `actions.ts` `finishUnload`: one lot.
- `actions.ts` `addToManifest`: one lot.
- `actions.ts` `locationChangeUploadCsv`: a silo load's lot.
- `actions.ts` `packageUploadCsv`: an unload's lot.
- `actions.ts` `packageUploadCsvForLot`: one lot.
- `actions.ts` `addCryoOutput`: the run's batch.
- `actions.ts` `runQueueControl` (Mark complete): a row of the HBN Queue, which no longer lists it.
- `actions.ts` `markUploaded`: a batch from the wet weights pending list, which needs finished lots.
- `actions.ts` `savePlantTags`: the same.
- `console.ts` `loadTestingSection` (lots ready): trimmed lots.
- `console.ts` `loadTestingSection` (lots scheduled): orders on lots.
- `console.ts` `loadTestingSection` (lots to retest): orders on lots.
- `console.ts` `loadTestingSection` (orders, the by lab and by strain then farm groups): orders on lots.
- `console.ts` `loadTestingSection` (failure types): orders on lots.
- `console.ts` `loadTestingSection` (COA and THC lists): orders on lots.
- `console.ts` `loadHarvestConsole` (plants harvested): lots; plants remaining read the METRC plants mirror.
- `console.ts` `loadHarvestConsole` (the season's lots): lots.
- `console.ts` `loadHarvestConsole` (yesterday's wet weight): wet weights on lots.
- `testing.ts` `listReadyLots`, the Compliance Console lot list: trimmed lots.
- `testing.ts` `loadTestingDesk`: orders on lots.
- `testing.ts` `listPendingTestSamples`: test manifests built from lots.
- `testing.ts` `scheduleTestOrder`: one lot.
- `cure.ts` `LOTS_SQL`, the cure panes: lots.
- `feeds.ts` `ROW_SELECT`, the trim weighs feed: packages through lots, and the `metrc` source is outside it.
- `index.ts` `GET /admin/uploads/wet_weights/:file`: one batch's finished lots.
- `index.ts` `GET /record/:table/:id/edit`: the lot pencil's options, excluded above.

## Assumptions for your word

- The mint's first status. A METRC-born batch is minted `open`, the mint's own first status. It stays out of every harvest surface by `born_from`, and Start lot, the pencil's save and recall refuse it, so it never gains a lot.
- The strain. Matched by name, ignoring case (the item's strain, else the Item name's second segment). When none matches, one is minted with METRC's name and the HBN's fourth segment as its code, even if another strain already carries that code. The name wins over the code: in the browser check, `46254-PNN-ID-005-1-NA-26004` matched Wild Mango Creamsicle, whose own code is 094, and the HBN keeps METRC's 005. A blank name takes the strain that carries the fourth segment's code, else refuses. A strain voided in Lookups refuses rather than minting a second one by that name. The market strain is the strain's name, as the mint's is (0.30.9).
- The entry date. The first segment's day only when it reads as a day of the seventh segment's year, else the packaged date, else the adoption's farm day. The early-season names begin 46248, 46254, 46258 and 46268. Read as YYDDD those are days in 2046, so they fall to the packaged date. As spreadsheet day numbers they are 2026-08-14, 2026-08-20, 2026-08-24 and 2026-09-03; if that is how they were named, say so and the reader can take them that way instead.
- What the filter matches. The typed text, ignoring case, anywhere in the HBN or in the last six of the tag. Text longer than six (a scanned tag) also matches the whole tag. It narrows the three panes and From METRC and counts what shows. It rides `?q=` on a reload, a shared link, and every post back to the page.
- The `<<` glyph. Prepack's Scheduled pane shows `<<` to unschedule, where Trimming and Pasteurization show `<`. The `>` still opens the station.
- Several Source Harvests. The first one the app knows wins, else the first one named. The hop to a source package is used only when the package names no Source Harvest, and it reads that package's row even when METRC has since marked it gone.
- The rest of the name. Farm is the second segment as written; grow method is the third, matched to its code; the planned dry space is the sixth segment's number without the leading zero (02 reads 2), NA blank. Besides the two named refusals, adoption also refuses a seventh segment that is not a YY### lot token, a name voided in the app, and the strain cases above; each names the harvest or strain and mints nothing.
- The adopted ledger item carries no lot; the package carries the trimmed lot when its batch has one (canon 0.30.26: children carry none). Brief F put the lot on the ledger item; this corrects that going forward. The floor has no adoptions to revisit.
- The error page reads a refusal in Spanish when the dictionary has its line; English stays exactly as thrown. That is how the brief's Spanish refusals show, and it also applies to older refusals that already had a line.
- Adopt does not schedule. Complete rows keep the other panes' reading with the time; their grams are what remains on the parent, 0 after a full pack.

## Gates

- `npx tsc --noEmit`: exit 0.
- `npx vitest run`: 49 files, 849 tests passed. The same under `TZ=America/New_York`. The new database tests build a memory database from the real migrations (`test/migrated.ts`): 0073's backfill on a pre-0073 row, a cryo output's HBN from its run, the adoption minting a METRC-born batch and its strain and the next stranger inheriting it, a known HBN's trimmed lot, the serial collision and six-part refusals minting nothing, the per-package schedule, `<<`, the station and the pending files for a lot-less package, and the harvest surfaces leaving the METRC-born batch out.
- `node --check scripts/smoke.mjs`: exit 0.
- From-zero smoke (`SMOKE_PORT=9151`, `WRANGLER_SEND_METRICS=false`): `About to apply 73 migration(s)`, `SMOKE PASS`, ` 500 ` lines: 0, exit 0. The walk lists packages with `>>` each; narrows by last six and by HBN with `?q=`; schedules one package while its HBN sibling stays Available; returns the sibling with `<<`; refuses a second `>>` and an HBN-wide post; adopts the known stranger with the tag alone and schedules it; adopts a stranger from the unminted `46258-PNN-ID-062-0-NA-26007` read `new from METRC`; finds the batch born from METRC in the table export, absent from the HBN Queue and the Wet Weight pick; and reads the Harvest Console's harvest figures unchanged.
- Dash audit: 0 on `src`, `test`, `migrations/0073_package_hbn.sql`, `scripts/smoke.mjs` and this report (U+2014 and U+2013).
- `METRC_INTEGRATOR_KEY = "` and `METRC_USER_KEY = "` appear in no file under `src`, `test`, `scripts`, or `wrangler.toml`. `453.59` remains the one METRC comment in `src/config.ts`.

## Browser

On the smoked local database, the Prepack page listed Available `000105 / Donny Burger / 751 g` under `46258-PNN-ID-062-0-NA-26007` and `000C11 / Fruity Pebbles / 15 g` under the smoke HBN, each with `>>`; Scheduled `000D01` and `000A02` with `<<` and `>`; Complete `000A01` with its time. Typing `46258` in the filter left Available 1 and both other panes `- EMPTY -`, set `?q=46258`, and carried the value into every form. Three stranger rows added to that local database read `known`, `new from METRC`, and `no harvest in METRC's lineage` (no Adopt). Adopt on the new one moved it to Available under a minted `46254-PNN-ID-005-1-NA-26004` (born from METRC, open, 2026 serial 4, entry date the packaged 2026-09-16, no lots). In Spanish the page read Filtrar, HBN o ultimos seis, conocido, nuevo desde METRC and Adoptar, and a refused adopt read `No hay cosecha en el linaje de METRC, asi que ese paquete no se puede adoptar.`

## Deploy

Not deployed from this session. The Scribe gates the report and hands the three-step block. 0073 rides; it rebuilds `wip_packages` the way 0070 rebuilt `test_orders`, so the apply runs before the deploy as always. After LIVE, the strangers are adopted with no pick: six onto the app's lots, ten onto batches minted from METRC's names.

## Sealed final check

```
npx tsc --noEmit                      exit 0
npx vitest run                        49 files, 849 tests passed
TZ=America/New_York npx vitest run    49 files, 849 tests passed
node --check scripts/smoke.mjs        exit 0
Remove-Item .smoke-persist; SMOKE_PORT=9151 WRANGLER_SEND_METRICS=false npm run smoke
                                      About to apply 73 migration(s); SMOKE PASS; " 500 " lines: 0; exit 0

app/migrations/0073_package_hbn.sql     2174  25937922036b0b3b  tail: ALTER TABLE harvest_batches ADD COLUMN born_from TEXT NOT NULL DEFAULT 'app';
app/src/config.ts                      65591  bba526c3522d9a3e  tail: }
app/src/mint.ts                         8231  9a2e94e5f8ac26a8  tail: }
app/src/audit.ts                        2972  9082004090c78745  tail: }
app/src/i18n.ts                       157972  9ae41b3b0a72467b  tail: }
app/src/metrc.ts                       81949  daf75dfb1f73a3ec  tail: }
app/src/actions.ts                    282196  48783fab3c80d436  tail: export { MANIFEST_COLUMNS, buckedPackageCode };
app/src/db.ts                         166711  1f0ceefd3a57fc7d  tail: }
app/src/prepack.ts                     30830  7b010cebec1a845f  tail: }
app/src/scheduling.ts                  20696  7b1b8a82a6f48360  tail: }
app/src/index.ts                      131974  e457083dd4ea295e  tail: export default worker;
app/src/theme.ts                      153676  f3ebc12146733355  tail: }
app/test/migrated.ts                    5874  f01d14375c0d7445  tail: }
app/test/import-meta.d.ts                 49  056d68b2e064909c  tail: }
app/test/scheduling.test.ts            20531  2796cba3cdfe38aa  tail: });
app/test/mint.test.ts                  10293  255f14deb3dd3476  tail: });
app/test/metrc.test.ts                 57750  e63986ae12185eb6  tail: }
app/test/prepack.test.ts                8748  54c019e08a8001d0  tail: });
app/test/cryo.test.ts                  29202  8a8dfc3c9b3755cf  tail: });
app/test/console.test.ts               53194  2215b8f3b4b7a8d7  tail: });
app/scripts/smoke.mjs                 557958  e80ab3faddb7a464  tail: });
```
