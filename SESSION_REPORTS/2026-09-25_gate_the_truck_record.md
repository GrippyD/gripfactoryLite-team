# 2026-09-25 The gate on the truck record (canon 0.30.229)

Scribe session. The gate on his Code session's `SESSION_REPORTS/2026-09-25_the_truck_record.md` (brief M part one, THE TRUCK RECORD, canon 0.30.226; migration 0075, the head becomes 0075, the next free number 0076). The report says "Not deployed. Nothing committed."; nothing was deployed before this gate. No Scribe change to `app/`. The build landed on the disk between 01:34 and 01:57 UTC (his paste went straight to the Code session; the report was found by listing SESSION_REPORTS at 12:49 UTC with the tree quiet for eleven hours).

## What was gated

1. The tree was hashed on the device and compared with the Scribe's sandbox, which held the tree of canon 0.30.227 (f32b157ed79c3786, 206 files) byte for byte. Fifteen files differed, exactly the fifteen of the report's seal and exactly the files newer than the brief on the disk, two of them new (`migrations/0075_tote_hbn.sql`, `test/truck.test.ts`); every other file hashes identical. After the copy the two trees hash identical (1b995933b48d85ec, 208 files). The migration head is 0075: `ALTER TABLE wet_weights ADD COLUMN harvest_batch_id TEXT` and the index `wet_weights_harvest_batch`, nothing else, append-only.
2. The fifteen were staged, verified against the seal (size and sha256, all fifteen), copied into the sandbox and verified again there.
3. Read against the brief's six laws of part one. THE TRUCK ON THE HEADER: `truck_number` returns to the header form as free text, prefilled with one past the highest integer among the farm's lots of the same farm day, blank allowed; the truck sentinel and `truck-<n>` still refuse in `createWetWeight`; THE FOUR START TAPS keeps `COALESCE(truck_number, '')` in its match; the labels read `Truck <n> - <hbn>` where `truck_label` and `barnLotLabel` already branched. THE HBN LINE ON EVERY TOTE: the weights form carries `harvest_batch_id` beside the grams, the list the header farm's open app-born batches with the header's first, the newest live tote's HBN selected; `addLotWeight` refuses an id off the list, stores and logs it, the recompute unchanged; the row shows the serial when it differs; the panel sums per HBN; the tote pencil takes the same list with a reason and refuses once the lot has left weighing; the lot pencil moves the header and the totes that carry no explicit HBN or the old header HBN. THE PANE KEEPS TODAY'S HBN: `NO_FINISHED_LOT_SQL` gained a third clause, a finished lot whose `effective_date`, else its `updated_at` day, is today or later keeps the batch on the pane. THE FINISH SPLITS THE TRUCK: `splitTruckIfNeeded` groups the live totes by HBN (null reading as the header's), returns null on one HBN so the single finish runs as before, and otherwise, in one `db.batch`, inserts one lot per other HBN as a copy of the header (space, start time, truck, form, leads, notes, effective date), moves each tote with a log row under `truck split`, finishes every lot with the status log, mints one package per lot by `planFinishMint` with the code `shortLotId` plus `-T<n>` (`lotPackageCode` gained the truck), takes the plant count and the tag per HBN (`plant_count[<id>]`, `metrc_tag[<id>]`, the single-HBN lot keeping today's names), and flashes the truck with every part. THE WORDS: the new strings carry Spanish. NOTHING ELSE MOVES: `cryo.ts`, `scheduling.ts`, `sheetsync.ts`, `csv.ts`, `metrc.ts`, `silo.ts`, `console.ts`, `prepack.ts` and the 0001 to 0074 migrations did not move. THE TESTS: `test/truck.test.ts` (the next truck number per farm day; the default following the last selection; the list order; a foreign HBN refused; the split into lots with `-T<n>` codes, the totes moved with log rows, the counts and tags per HBN, the flash; a single-HBN lot finishing as before; the pane keeping today's batch and hiding yesterday's; the tote pencil refused after the finish), `test/start_taps.test.ts` and `test/hbn_pencil.test.ts` extended, `test/surface.test.ts` for the markup.
4. THE SPLIT, READ IN THE DATABASE. The smoke's local D1 after the walk: a truck 1 lot under HBN 26904 (500 g, two totes, plant count 12, bucked, drying in Silo 2) and a lot born of the split under HBN 26903 (80 g, its one tote moved with one `record_change_log` row under `truck split`, plant count 3, the same truck, team lead and form, drying in Silo 3); two WIP packages `26904-T1` (500 g at Silo 2) and `26903-T1` (80 g at Silo 3); one open silo load each; `wet_weights.harvest_batch_id` present with its index. The routes answered as the report says and no 500 was logged.

## Gates on the tree as received (the Scribe's sandbox)

- `npx tsc --noEmit`: exit 0.
- `npx vitest run`: 53 files, 875 tests passed; the same under `TZ=America/New_York`.
- `node --check scripts/smoke.mjs`: ok.
- From-zero smoke (`SMOKE_PORT=9163`): `About to apply 75 migration(s)`, `SMOKE PASS`, no 500; exit 0 once the dev server was ended by pid.
- Dash audit: 0 on the fifteen files and the build report.
- Secret grep (`METRC_INTEGRATOR_KEY = "`, `METRC_USER_KEY = "`, `MS_CLIENT_SECRET = "`, `cfas[t]_`): no matches under `src`, `test`, `scripts`, `migrations` or `wrangler.toml`.

## His word: the report's seven assumptions and three the Scribe adds

The seven stand as the report states them (the header farm's open batches only; the split at Finish lot; `-T<n>` on every lot with a Truck #, a single-HBN truck included; the farm-day pane rule; the tote pencil refused after weighing; the next Truck # counting only this farm's lots of this farm day; the count and the tag per HBN with a skip leaving the count empty). Three more, read in the code and the database:

- A lot born of the split carries no `create` log rows for its fields (the house convention logs one row per non-null field at a lot's birth); its status row (old null, new drying) and its totes' move rows are the record. A later slice can add `logsForInsert` on the copy if he wants the full birth logged.
- A lot born of the split takes its plant count in the same UPDATE as its status but writes no `plant_count` log row, where the single-HBN finish writes one under `finish lot`.
- The smoke's truck rides two PNN HBNs (26903, 26904), where the report's words say a truck at ARL; the law walked is the same.

## Deploy (his hands; the three-step block, 0075 rides)

```powershell
cd "C:\Users\DennisWallace\Documents\Claude\Projects\gripfactory Practical\app"
npx wrangler d1 execute gripfactory-lite-grip-20260914 --env grip --remote --command "SELECT 1"
npx wrangler d1 migrations apply gripfactory-lite-grip-20260914 --env grip --remote
npm run deploy:grip
```

One 7403 on the probe is a blip (re-run); two spaced minutes apart is a stale grant. The apply should say one migration, 0075. THE PROBE: the wet weight header with its Truck # box prefilled, and a tote row's HBN select with the header's HBN first.

## Sealed final check

```
npx tsc --noEmit                      exit 0
npx vitest run                        53 files, 875 tests passed
TZ=America/New_York npx vitest run    53 files, 875 tests passed
node --check scripts/smoke.mjs        ok
rm -rf .smoke-persist && CI=1 SMOKE_PORT=9163 WRANGLER_SEND_METRICS=false npm run smoke
                                      About to apply 75 migration(s); SMOKE PASS; " 500 " lines: 0; exit 0
the build session's seal (15 files) verified byte for byte on the device and in the sandbox:
migrations/0075_tote_hbn.sql                     293  9b2fa0f69d0ccada
src/config.ts                                  66934  92418ed9a05e9c36
src/ledger.ts                                   8880  fd046e193321eb7e
src/db.ts                                     166366  4559d2d2d32787cc
src/drying.ts                                  20659  4984d71c72d6c26b
src/actions.ts                                321688  9066a96cf97142c3
src/pipeline.ts                                50230  e52d2d092230bc32
src/html.ts                                   189980  d8d21abdd4ad0ba0
src/index.ts                                  136544  a72e1d14fed959b2
src/i18n.ts                                   166327  77f9ed7a89968ac8
test/start_taps.test.ts                         9350  8f7d74482d79bddb
test/hbn_pencil.test.ts                         7877  52ed9218bbfb0964
test/truck.test.ts                             14287  de1879daf028f39c
test/surface.test.ts                           80249  eb9b61e4a00632da
scripts/smoke.mjs                             578637  79c75f3be9c55a20
tree hash after the copy, device and sandbox: 1b995933b48d85ec (208 files)
the build report: SESSION_REPORTS/2026-09-25_the_truck_record.md  6140  c947cd611449849c
dash audit: 0 on every file above
secret grep: no matches
```
