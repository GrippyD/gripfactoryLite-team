# 2026-09-22 The gate on the In Testing seed (canon 0.30.189)

Scribe session. The gate on his Code session's `SESSION_REPORTS/2026-09-22_in_testing_seed.md` (brief D, THE IN TESTING SHEET SEEDS THE COMPLIANCE CONSOLE AND THE DESK, canon 0.30.187; migration 0070). The report says "Not deployed from this session"; nothing was deployed before this gate. No Scribe change to `app/`.

## What was gated

1. The tree was hashed on the device after the build session went quiet (the last file under `app/` moved at 19:21Z, the report at 19:26Z; the gate began at 19:28Z) and compared with the Scribe's sandbox, which held the tree of canon 0.30.186 byte for byte. Nineteen files differed, exactly the nineteen of the report's seal, five of them new (`migrations/0070_in_testing_seed.sql`, `src/xlsb.ts`, `src/intesting.ts`, `test/xlsb.test.ts`, `test/intesting.test.ts`); after the copy the two trees hash identical (caae3e47fff78548, 198 files). Nothing else under `app/src`, `app/test`, `app/scripts`, `app/migrations`, `wrangler.toml`, `package.json`, `package-lock.json`, `tsconfig.json` or `vitest.config.ts` had moved. The migration head is 0070.
2. The nineteen were staged, verified against the seal (size and sha256, all nineteen), copied into the sandbox and verified again there.
3. Read against the brief and the two laws it leans on. The .xlsb door parses in memory and stores no bytes (`queueImport` lands an .xlsb through `applyInTestingBytes` and never writes `import_queue`), so the Driver Info tab inside the zip is never persisted; the reader opens only the two named tabs (`readXlsbSheets(bytes, [tab, rnd])`) and a test proves a Driver Info sheet is not opened. The real workbook is not a fixture: the smoke's fixture is `inTestingFixtureWorkbook()` (two synthetic rows), and the DROPS upload runs only when `DROPS/In Testing (2026).xlsb` exists, printing its counts and asserting nothing about them. The sheet wins on its own rows by `sheet_key` (tab, Sample Tag, attempt; the tab and the row number when the tag is blank); manual rows (`source = 'manual'`) and desk rows (`source = 'desk'`) are never selected by the landing; a dropped row is marked `on_sheet` 0 with a log row; every write logs under `in testing sheet` with no actor. The status words: passed, pass, passed - retest and remediated read as passed; failed and fail as failed; anything else stays open (`sent`). An unknown lab keeps the compliance row and skips the desk in words; the desk check runs on every landing, so a lab alias added later seeds those rows at the next run without a schema change. Migration 0070 adds `source` to `sheet_sync_runs` (default `labor`), the four sheet columns and `notes` to `external_test_results`, the four sheet columns to `test_samples`, and rebuilds `test_orders` with `lot_id` nullable: the rebuilt table carries all 28 columns of the 0068 table plus the four, recreates `test_orders_lot` and adds the three unique `sheet_key` indexes. The six app_config seeds are `INSERT OR IGNORE` (the Graph drive and item ids of the workbook, the two tab names, the lab aliases, the fail types); none is personnel. The hourly cron runs the Labor sync, the Metrc sweep and the In Testing pull in turn, each catching its own failure; the pull records a `skipped` run and makes no call while the Entra ids read `TBD` or the secret is absent.
4. THE WORKBOOK, READ TWICE. The DROPS copy (1,065,562 bytes, sha256 19abfee32e5ef793) was staged into the sandbox's `DROPS/` (gitignored on the device; the sandbox is not a repository) and read two ways. The app's reader, through the from-zero smoke's Admin upload: `seen=392 landed=392 changed=0 skipped=361`, `unknown lab Reassure; blank Sample Tag`, the same line his run printed. An independent reader (`pyxlsb`, Python, the In Testing and R&D tabs only, Driver Info never opened) agrees on every figure: In Testing 376 rows and R&D 16 (392); 300 rows with a blank Sample Tag; Testing Facility on the tagged rows ACT 27, Reassure 61, LabLink 4; Testing Status across the sheet Passed 23, Failed 19, In Testing 293, blank 57; Required Test Full Compliance 76, Full Panel R&D 16, blank 300; one Batch Weight cell holding text. The 300 blank-tag rows carry no lab and no Required Test (243 read In Testing, 57 blank): the sheet's pre-filled rows below the season's entries.
5. THE LANDING, READ IN THE DATABASE. The smoke's local D1 after the DROPS upload: `external_test_results` 392 sheet rows on the sheet, the two fixture rows marked no longer on the sheet, one manual row (395 listed, as the report says); 31 desk orders from the workbook (ACT 27: 16 passed, 11 failed; LabLink 4 failed), panels 29 full compliance and 4 R&D from the sheet's rows including the fixture pair; 6 rows with attempt above 1 (retests keyed apart); 17 passed `other` result rows and 17 `microbials` failed parts (every Fail Reason on the sheet mapped through `in_testing_fail_types`); the one text Batch Weight row as an order at 0 grams; 5,001 change-log rows under the reason for the whole landing; seven `sheet_sync_runs` rows (labor and in_testing, cron and admin, the last `in_testing admin ok 392 392 0 361`). None of the 31 found a lot in the from-zero database, as expected there; on the floor the link is the sheet's Harvest Batch Name against the app's `hbn` text.

## Gates on the tree as received (the Scribe's sandbox)

- `npx tsc --noEmit`: exit 0.
- `npx vitest run`: 48 files, 818 tests passed; the same under `TZ=America/New_York`.
- `node --check scripts/smoke.mjs`: ok.
- From-zero smoke (`SMOKE_PORT=9081`, the DROPS copy present): `About to apply 70 migration(s)`, `SMOKE PASS`, no 500, the DROPS line above; exit 0 once the dev server was ended by hand (in this sandbox `npm exec wrangler dev` does not pass the smoke's SIGTERM down to workerd, so the smoke sat on the four-second stop until the tree was killed by pid; the `runtime crashed` warning after `SMOKE PASS` is that kill, not the run).
- Dash audit: 0 on `src`, `test`, `migrations/0070_in_testing_seed.sql`, `scripts/smoke.mjs` and the build report.
- Secret grep (`METRC_INTEGRATOR_KEY = "`, `METRC_USER_KEY = "`, `MS_CLIENT_SECRET = "`, `cfast_`, `Bearer <token>`): only the two pre-existing test fixtures with made-up tokens (`test/sheetsync.test.ts`, `test/sendmail.test.ts`); no key value anywhere.
- Personnel grep on the slice: only the synthetic Driver Info test (`not-a-person`, `000-000-0000`) proving the tab is not opened.

## Deploy (his hands; the three-step block, 0070 rides)

```powershell
cd "C:\Users\DennisWallace\Documents\Claude\Projects\gripfactory Practical\app"
npx wrangler d1 execute gripfactory-lite-grip-20260914 --env grip --remote --command "SELECT 1"
npx wrangler d1 migrations apply gripfactory-lite-grip-20260914 --env grip --remote
npm run deploy:grip
```

Then the Admin upload of `In Testing (2026).xlsb` on Import Data seeds the floor (the counts come back in words). The Graph pull stays skipped until the Entra ids and `MS_CLIENT_SECRET` land.

## Owner section (the Scribe's, on top of the build session's six assumptions)

- REASSURE. 61 of the 92 tagged rows name the facility Reassure, which is not a testing lab the app knows, so they stay on the compliance table and skip the desk. To seed them: Admin, Lookups, Testing labs, add the lab; then app_config `in_testing_lab_aliases` gains `; Reassure=<that lab's id>`; then upload the workbook again on Import Data (or wait for the hourly pull once Graph is lit). No code moves.
- THE TEXT CELL. The first In Testing row's Batch Weight cell holds a strain name; it lands as no grams and the desk order reads 0 g (0.00 lb, still one package in the count). The fix is on the sheet.
- THE BLANK-TAG ROWS. 300 pre-filled rows land on the compliance table keyed by tab and row number; if a row is inserted above them on the sheet, those keys shift, the old rows read no longer on the sheet and new rows land. They never reach the desk. Your word whether a later slice should skip rows with no Sample Tag and no Source Metrc Tag.
- TWO RATES, ONE VOCABULARY TODAY. The Compliance Console's FTQ counts the exact status `Passed` on attempt 1 (canon 0.20.0); the desk's rate reads the vocabulary (passed, pass, passed - retest, remediated). The sheet uses Passed, Failed and In Testing today, so the two agree; a status typed `Pass` would part them.
- THE LOT LINK. A desk order finds its lot by the sheet's Harvest Batch Name matching the app's HBN text; early-season rows the app never minted stand without a lot, count in the rate, and skip the lot-bound panes, as the brief asked.
- THE FIRST LANDING'S WEIGHT. About five thousand change-log rows and four hundred rows across three tables, in batches of forty statements; the Admin upload answers when they are all in.
- The build session's six assumptions stand for your word: Turnaround Time not required; `sheet_key` by Sample Tag and attempt, row number when blank; a text Batch Weight lands as no grams; Excel serial 46244 is 2026-08-10; whole grams, THC keeps its decimals, status stored as typed; Driver Info never opened.

## Sealed final check

```
npx tsc --noEmit                      exit 0
npx vitest run                        48 files, 818 tests passed
TZ=America/New_York npx vitest run    48 files, 818 tests passed
node --check scripts/smoke.mjs        ok
rm -rf .smoke-persist && CI=1 SMOKE_PORT=9081 WRANGLER_SEND_METRICS=false npm run smoke
                                      About to apply 70 migration(s); SMOKE PASS; " 500 " lines: 0; exit 0
                                      DROPS In Testing upload 303 seen=392 landed=392 changed=0 skipped=361
the build session's seal (19 files) verified byte for byte on the device and in the sandbox:
migrations/0070_in_testing_seed.sql             4512  b4a0af3aa50ba6b8
src/xlsb.ts                                    14397  a61807330d8b7937
src/intesting.ts                               28316  0e5e981942459641
src/sheetsync.ts                               38788  2db96955462fb97f
src/imports.ts                                  4108  8a1474c26a866c89
src/actions.ts                                267865  e8c82d825489dd13
src/index.ts                                  128102  218c242721b1ce80
src/html.ts                                   177252  0f82845659a55f01
src/compliance.ts                              26009  5641395f2835fea7
src/i18n.ts                                   151095  44e550a13db5905b
src/console.ts                                 92257  015bbc763cc2470d
src/testing.ts                                 63843  b875c437ae68ddde
src/config.ts                                  61000  208f4ba59fdb8c1b
test/xlsb.test.ts                               1982  44248465233dc10e
test/intesting.test.ts                         12819  536cade4ff00a8a7
test/console.test.ts                           49278  c782f40afe6d7cf5
test/imports.test.ts                           11750  cb7fc10ddbdcbb41
test/surface.test.ts                           79364  cc2cad0e1bd75ff6
scripts/smoke.mjs                             536427  90098a2a12412f26
tree hash after the copy, device and sandbox: caae3e47fff78548 (198 files)
the workbook: DROPS/In Testing (2026).xlsb  1065562  19abfee32e5ef793 (never in the repo)
the build report: SESSION_REPORTS/2026-09-22_in_testing_seed.md  7267  ad13ff4d0c423b06
dash audit: 0 on every file above
secret grep: only the two made-up test tokens; personnel grep: only the synthetic Driver Info test
```
