# 2026-09-23 The gate on the prepack scheduler by package (canon 0.30.197)

Scribe session. The gate on his Code session's `SESSION_REPORTS/2026-09-23_prepack_scheduler_by_package.md` (brief G, THE PREPACK SCHEDULER BY PACKAGE, THE HBN INHERITED, canon 0.30.196; migration 0073). The report says "Not deployed from this session"; nothing was deployed before this gate. No Scribe change to `app/`.

## What was gated

1. The tree was hashed on the device after the build session went quiet (the last file under `app/` moved at 00:46Z, the report at 00:56Z; the gate began at 01:39Z) and compared with the Scribe's sandbox, which held the tree of canon 0.30.195 (brief F as deployed, d77f44c628019299) byte for byte. Twenty-one files differed, exactly the twenty-one of the report's seal, three of them new (`migrations/0073_package_hbn.sql`, `test/migrated.ts`, `test/import-meta.d.ts`); after the copy the two trees hash identical (1bf3d10d10ce6757, 205 files). Nothing else under `app/src`, `app/test`, `app/scripts`, `app/migrations`, `wrangler.toml`, `package.json`, `package-lock.json`, `tsconfig.json` or `vitest.config.ts` had moved. The migration head is 0073.
2. The twenty-one were staged, verified against the seal (size and sha256, all twenty-one), copied into the sandbox and verified again there.
3. Read against the brief's seven laws. THE PACKAGE CARRIES ITS HBN: 0073 rebuilds `wip_packages` as 0070 rebuilt `test_orders` (the 20 columns of 0001 and its six ALTERs kept in order, `wet_weight_entry_id` nullable, `harvest_batch_id` last, backfilled by a correlated select from each row's lot; the two indexes of 0001 recreated and a third on `harvest_batch_id`) and adds `harvest_batches.born_from TEXT NOT NULL DEFAULT 'app'`; the feed, the lists, the station and the files read `p.harvest_batch_id`. THE SCHEDULER BY PACKAGE: the three panes list packages (`data-schedule-tag`, `data-schedule-hbn`, the last six first); `>>` posts `wip_package_id` to `schedulePackage`, which refuses an already scheduled or vanished package in words and writes one schedule row under the package's HBN; `<<` unschedules; `>` opens the station; an HBN-wide post to the prepack schedule refuses; Trimming and Pasteurization untouched. THE FILTER: the box at the top, `?q=`, the server hiding non-matching rows with `hidden` so the page is right without the script, the script re-matching as typed and counting what shows, every post carrying `q` back. THE HBN IS INHERITED, NEVER PICKED: From METRC without a select, each row naming the harvest it will inherit with `known`, `new from METRC` or `no harvest in METRC's lineage` (no Adopt); `adoptFromMetrc` posts the tag alone; a known HBN is inherited with the trimmed lot when the batch has one; a new one is minted by `mintMetrcBatch` through `hbnFromMetrcName` on `parseHbn` (the name upper-cased exactly as METRC states it; farm, grow method matched to its code, strain code, manicure, the planned dry space from the sixth segment, the year and serial from the seventh; the entry date from the token only when the token's year is the serial's, else the packaged date, else the farm day; the strain by name else minted with the fourth segment as its code; the mirror's license; status `open`; `born_from` metrc; every row logged under `adopted from METRC`), refusing in words a name that is not seven segments, a seventh segment that is not a lot token, a name the app voided, and a serial another HBN holds, minting nothing on a refusal. THE METRC-BORN HBN STAYS OUT OF THE HARVEST: the report's law 5 list names eight surfaces that exclude or refuse it (the HBN pencil's options, the HBN Queue and its count and CSV, the Wet Weight pick, the recall list, the harvest by year count, Start lot, the pencil's save, the recall), twenty-three that read it on purpose (the prepack feed and lists, the station, the pending files, the next stranger of the same harvest, the serial and name collision checks, the raw table export, inventory and manifest displays that show a ledger item's HBN) and sixty-odd proven unaffected because they join lots, plant tags, wet weights, containers, runs or orders. THE WORDS: Spanish on the filter, the three markers, the refusals and the empty line; the error page now reads any refusal in Spanish when the dictionary has its line. NOTHING ELSE MOVES: the mirror release untouched; the console's Prepack section reads no HBN and `console.ts` did not move.
4. THE LANDING, READ IN THE DATABASE. The smoke's local D1 after the walk: `wip_packages` with 21 columns, `harvest_batch_id` last, three indexes; 20 rows, every one with an HBN, 19 with a lot, one without (the adopted stranger); no row whose HBN differs from its lot's; one METRC-born batch `46258-PNN-ID-062-0-NA-26007` (PNN, ID, manicure 0, no planned dry space, serial 7 of 2026, entry date 2026-09-15 the packaged date, `open`, license AU-P-000694, born_from metrc, strain Donny Burger minted with code 062 because the smoke's strain list did not carry the name); the adopted stranger `...000105` (WPR, 751 g, released, passed, source metrc) on that batch with no lot; the earlier adoption `...000D01` on the smoke's own lot; both ledger items without a lot and with the HBN; three prepack schedules each under its package's HBN; 53 log rows under `adopted from METRC` across the four tables; no 500.

## Gates on the tree as received (the Scribe's sandbox)

- `npx tsc --noEmit`: exit 0.
- `npx vitest run`: 49 files, 849 tests passed; the same under `TZ=America/New_York`. The new `test/migrated.ts` builds a memory database from the real migrations through `node:sqlite` (Node 22.5 or newer; the sandbox runs 22.22.2 and his machine passed the same tests), so five test files now prove the SQL itself, 0073's backfill included.
- `node --check scripts/smoke.mjs`: ok.
- From-zero smoke (`SMOKE_PORT=9084`, the DROPS copy of the In Testing workbook present): `About to apply 73 migration(s)`, `SMOKE PASS`, no 500; exit 0 once the dev server was ended by pid (the sandbox note of 0.30.189).
- Dash audit: 0 on `src`, `test`, `migrations/0073_package_hbn.sql`, `scripts/smoke.mjs` and the build report.
- Secret grep (`METRC_INTEGRATOR_KEY = "`, `METRC_USER_KEY = "`, `MS_CLIENT_SECRET = "`, `cfas[t]_`): no matches in the slice.

## His word: the ten assumptions

All ten stand as the brief asked, read one by one against the code and the database. Two carry a question, neither blocking:

- THE ENTRY DATE OF THE TEN. The early-season names begin 46248, 46254, 46258 and 46268. Read as YYDDD they fall in 2046, so the build takes the packaged date (2026-09-14 to 09-16 on the floor). The Code session noticed, and the Scribe confirms, that those four tokens are also spreadsheet day numbers: 46248 is 2026-08-14, 46254 is 2026-08-20, 46258 is 2026-08-24, 46268 is 2026-09-03, which fit a harvest before a 09-14 package. If that is how the sheet named them, a one-line rule (a token whose year is not the serial's, read as a spreadsheet day inside the harvest year) gives those ten batches their harvest day; your word, and a small follow-up.
- THE MINTED STRAIN'S CODE. A strain minted from METRC's name takes the HBN's fourth segment as its code even when another strain already carries it (`strains.hbn_code` is not unique); the name wins over the code. Your word whether that is right or a minted strain should refuse a taken code.

The rest, as built: the METRC-born batch is `open` and refused by Start lot, the pencil's save and the recall; the filter matches anywhere in the HBN or the last six and a scanned full tag, riding `?q=` through every post; `<<` on the prepack Scheduled pane where the other two stages show `<`; the first known Source Harvest wins, else the first named, the hop reading a source package's row even when gone; the adopted ledger item carries no lot (canon 0.30.26), brief F's lot on the ledger item corrected going forward with no floor rows to revisit; the error page in Spanish where the dictionary has the line; Adopt does not schedule; Complete rows read the parent's remaining grams.

## Deploy (his hands; the three-step block, 0073 rides)

```powershell
cd "C:\Users\DennisWallace\Documents\Claude\Projects\gripfactory Practical\app"
npx wrangler d1 execute gripfactory-lite-grip-20260914 --env grip --remote --command "SELECT 1"
npx wrangler d1 migrations apply gripfactory-lite-grip-20260914 --env grip --remote
npm run deploy:grip
```

0073 rebuilds `wip_packages` (the 708 live rows of the morning snapshot and their history), so the apply runs before the deploy as always; the worker deployed alone would read a column that is not there. THE CONSOLE IS THE PROBE AGAIN: `/harvest` reads `wip_packages` for the trim picture and the Prepack section, and the Prepack scheduling page reads `p.harvest_batch_id`, so either rendering proves the apply landed. After LIVE the strangers adopt with no pick: six onto the app's lots, ten onto batches minted from METRC's names.

## Sealed final check

```
npx tsc --noEmit                      exit 0
npx vitest run                        49 files, 849 tests passed
TZ=America/New_York npx vitest run    49 files, 849 tests passed
node --check scripts/smoke.mjs        ok
rm -rf .smoke-persist && CI=1 SMOKE_PORT=9084 WRANGLER_SEND_METRICS=false npm run smoke
                                      About to apply 73 migration(s); SMOKE PASS; " 500 " lines: 0; exit 0
the build session's seal (21 files) verified byte for byte on the device and in the sandbox:
migrations/0073_package_hbn.sql                 2174  25937922036b0b3b
src/config.ts                                  65591  bba526c3522d9a3e
src/mint.ts                                     8231  9a2e94e5f8ac26a8
src/audit.ts                                    2972  9082004090c78745
src/i18n.ts                                   157972  9ae41b3b0a72467b
src/metrc.ts                                   81949  daf75dfb1f73a3ec
src/actions.ts                                282196  48783fab3c80d436
src/db.ts                                     166711  1f0ceefd3a57fc7d
src/prepack.ts                                 30830  7b010cebec1a845f
src/scheduling.ts                              20696  7b1b8a82a6f48360
src/index.ts                                  131974  e457083dd4ea295e
src/theme.ts                                  153676  f3ebc12146733355
test/migrated.ts                                5874  f01d14375c0d7445
test/import-meta.d.ts                             49  056d68b2e064909c
test/scheduling.test.ts                        20531  2796cba3cdfe38aa
test/mint.test.ts                              10293  255f14deb3dd3476
test/metrc.test.ts                             57750  e63986ae12185eb6
test/prepack.test.ts                            8748  54c019e08a8001d0
test/cryo.test.ts                              29202  8a8dfc3c9b3755cf
test/console.test.ts                           53194  2215b8f3b4b7a8d7
scripts/smoke.mjs                             557958  e80ab3faddb7a464
tree hash after the copy, device and sandbox: 1bf3d10d10ce6757 (205 files)
the build report: SESSION_REPORTS/2026-09-23_prepack_scheduler_by_package.md  18100  48a973746b591a77
dash audit: 0 on every file above
secret grep: no matches
```
