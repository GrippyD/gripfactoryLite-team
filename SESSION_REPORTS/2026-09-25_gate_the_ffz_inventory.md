# 2026-09-25 The gate on the FFZ inventory (canon 0.30.227)

Scribe session. The gate on his Code session's `SESSION_REPORTS/2026-09-24_the_ffz_inventory.md` (brief L, THE FFZ INVENTORY LEAVES, THE BLAST FREEZER IS THE LEDGER, canon 0.30.225; no migration, the head stays 0074). The report says "Not deployed. Nothing committed."; nothing was deployed before this gate. No Scribe change to `app/`. The build landed on the disk between 23:45 and 23:57 UTC on the 24th, while the Scribe's link to the disk was down; the report was found at 00:17 UTC with the tree quiet for twenty minutes.

## What was gated

1. The tree was hashed on the device after the build went quiet and compared with the Scribe's sandbox, which held the tree of canon 0.30.222 (62db22f3fd63a879, 210 files) byte for byte. Fifteen files differed, exactly the fifteen of the report's seal, one of them new (`test/ffzland.test.ts`); they are exactly the files newer than the brief on the disk; every other file hashes identical. After the copy the two trees hash identical (f32b157ed79c3786, 206 files by the four-folder count). The migration head is 0074.
2. The fifteen were staged, verified against the seal (size and sha256, all fifteen), copied into the sandbox and verified again there.
3. Read against the brief's six laws. THE CUBE LEAVES: no `ffzTile`, `loadFfzVisual`, `ffzLiveEntry`, `paintFfz`, `data-ffz`, `listFfzGrams`, `FFZ_LEDGER_CLAUSE`, `isFfzInventory` or `ffz_capacity` remains in `src`, `test` or the smoke but as negative assertions; `CUBE_GEOMETRY`, the cube shape and the `ffz-` chrome stay for the freezer space tile; `ffzKindClause` and `ffzKindBinds` stay in `src/db.ts` for the landing; the module comments keep the 0.30.73 quote and say the cube left under 0.30.225; `/silos/live.json` carries no `ffz` key. THE READING LEAVES THE PICKER: `listReconcileLocations` offers the drying locations and freezers alone; a stale URL naming `FFZ inventory` reads as no pick by the route's `known` check; the picker's three FFZ inventory sentences and `FFZ inventory` are gone from `src/i18n.ts`. THE MIRROR LANDS FRESH FROZEN AT THE BLAST FREEZER: `landFfzFromMirror` (`src/metrc.ts`) reads the kinds from app_config each call, selects active mirror packages in grams with a quantity whose Item matches a kind and whose tag no ledger item bears (live or closed; `UPPER(TRIM(...))` both sides), and inserts one FG item per package (the tag as code and tag, `roundGrams` of the quantity, the license, `siteOfLicense` else PNN, `LOC_BLAST_FREEZER`, the strain when exactly one live strain matches by name) with `logsForInsert` under `fresh frozen from the mirror (mount <eight>)`, chunked; both mount lanes call it right after `closeLedgerForGoneTags` on a packages mount landed whole; `mountedRedirect` carries `landed`; the `/inventory/metrc` route reads it and `src/metrcpane.ts` says `{n} fresh frozen packages landed at the Blast Freezer.` (Spanish in the file) when n is above 0. NOTHING ELSE MOVES: `pipeline.ts`, `prepack.ts`, `sheetsync.ts`, `theme.ts`, `cryo.ts`, `scheduling.ts`, `actions.ts`, the migrations and the repair scripts did not move. THE TESTS: `test/ffzland.test.ts` (four cases: two packages landed and a WIP skipped, with whole grams, the site, the strain and the log; a live tag and a closed tag skipped and a second call landing nothing; a kind added to `ffz_item_kinds` landing on the next call while ounces and a blank quantity do not; the flash count and a later gone mount closing the item); the cube assertions gone from `test/silo.test.ts`, `test/console.test.ts`, `test/farmday.test.ts`; `test/ledgerloc.test.ts` keeping the Blast Freezer location; `test/freezer.test.ts` and `test/routing.test.ts` untouched and green; the smoke's FFZ pins replaced by the cube's absence on the console (English and Spanish), the Drying Operations strip and the Load Silo strip, the cure panes after the last space tile, and the FFZ_TAG mount pinned to `landed=1`, the Blast Freezer entry listing the tag at 1500 g, and `landed=0` on the second mount of the same file.
4. THE LANDING, READ IN THE DATABASE. The smoke's local D1 after the walk: one FG item `1A4050300000000000000E11` at Blast Freezer, 1500 g, license AU-P-000694, farm PNN, no strain (the mirror's `Donny Burger` matches none of the seed's 97 strains, so null is right), not deleted; thirteen `record_change_log` rows on that item, one per inserted field, all under `fresh frozen from the mirror (mount 9a681d23)`, the eight of the AU-P-000694 mount `9a681d23-c34e-4fac-bacc-81ca8a5d0d1f`; the second mount of the same file (`f51f59b3`) landed no second item; the three WIP packages at the Blast Freezer (26901 closed, 26902, 26903) stand as the freezer laws left them; `app_config` still holds `ffz_capacity_lbs` 4800 and `ffz_item_kinds` FFZ.

## Gates on the tree as received (the Scribe's sandbox)

- `npx tsc --noEmit`: exit 0.
- `npx vitest run`: 52 files, 868 tests passed; the same under `TZ=America/New_York`.
- `node --check scripts/smoke.mjs`: ok.
- From-zero smoke (`SMOKE_PORT=9161`): `About to apply 74 migration(s)`, `SMOKE PASS`, no 500; exit 0 once the dev server was ended by pid.
- Dash audit: 0 on the fifteen files and the build report.
- Secret grep (`METRC_INTEGRATOR_KEY = "`, `METRC_USER_KEY = "`, `MS_CLIENT_SECRET = "`, `cfas[t]_`): no matches under `src`, `test`, `scripts` or `wrangler.toml`.

## His word: the report's eight assumptions and two the Scribe adds

The eight stand as the report states them (FG as the landed kind; whole grams while the mirror keeps its precision; a closed item's tag never landing again; the landed grams not following a later quantity change in METRC; the strain match by exact name only; `ffz_capacity_lbs` standing unread; ounces and a blank quantity skipped; an unknown license landing at PNN). Two more, read in the code:

- The strain lookup runs one query per landed package; on a first mount with many fresh frozen packages that is many small reads inside one request, which the Worker allows and which happens once.
- `test/freezer.test.ts` and `test/routing.test.ts`, named in the brief as holding cube assertions, needed no change: their FFZ mentions are the freezer tile's chrome, which stays.

## Deploy (his hands; worker-only, no migration rides)

```powershell
cd "C:\Users\DennisWallace\Documents\Claude\Projects\gripfactory Practical\app"
npm run deploy:grip
```

THE PROBE: the console's Drying row without the FFZ Inventory cube, the cure panes after the Blast Freezer(s) tile; Reconcile Ledger Location's picker without `FFZ inventory`. THE ONCE, his hands after LIVE: mount the active packages export of each license that holds fresh frozen on the Inventory page's METRC Mirror; the flash counts what landed; the Blast Freezer entry on Reconcile Ledger Location lists them.

## Sealed final check

```
npx tsc --noEmit                      exit 0
npx vitest run                        52 files, 868 tests passed
TZ=America/New_York npx vitest run    52 files, 868 tests passed
node --check scripts/smoke.mjs        ok
rm -rf .smoke-persist && CI=1 SMOKE_PORT=9161 WRANGLER_SEND_METRICS=false npm run smoke
                                      About to apply 74 migration(s); SMOKE PASS; " 500 " lines: 0; exit 0
the build session's seal (15 files) verified byte for byte on the device and in the sandbox:
src/silo.ts                                    37070  8caed650cee93036
src/console.ts                                100101  713625891cd05991
src/index.ts                                  135456  aa8dcf947181b27a
src/db.ts                                     162809  9d6fb24ed37257c8
src/ledgerloc.ts                               24845  669d1293acb2e35c
src/metrc.ts                                   85766  1d79d9e6cab8a25c
src/config.ts                                  66804  c9bcb3ed13ac48ca
src/i18n.ts                                   164943  3285a71cfcb09a1d
src/metrcpane.ts                               18906  83c94fce05e2a986
test/silo.test.ts                              29234  4cfcf0c22741454c
test/console.test.ts                           55498  678a1caeedf2a48f
test/farmday.test.ts                           17326  997316ebb7b3d9c4
test/ledgerloc.test.ts                         14773  d7340a2deb3782d4
test/ffzland.test.ts                            7397  dd2f9d9da36dbf97
scripts/smoke.mjs                             573535  490e27cb277245dd
tree hash after the copy, device and sandbox: f32b157ed79c3786 (206 files)
the build report: SESSION_REPORTS/2026-09-24_the_ffz_inventory.md  5036  7fa5f5b534b4d14b
dash audit: 0 on every file above
secret grep: no matches
```
