# 2026-09-22 The gate on the Prepack (canon 0.30.191)

Scribe session. The gate on his Code session's `SESSION_REPORTS/2026-09-22_prepack.md` (brief E, THE PREPACK, canon 0.30.188; migration 0071). The report says "Not deployed from this session"; nothing was deployed before this gate. No Scribe change to `app/`.

## What was gated

1. The tree was hashed on the device after the build session went quiet (the last file under `app/` moved at 21:09Z, the report at 21:14Z; the gate began at 21:33Z) and compared with the Scribe's sandbox, which held the tree of canon 0.30.189 (brief D as deployed, caae3e47fff78548) byte for byte. Eighteen files differed, exactly the eighteen of the report's seal, three of them new (`migrations/0071_prepack.sql`, `src/prepack.ts`, `test/prepack.test.ts`); after the copy the two trees hash identical (692e82e0affe0b87, 201 files). Nothing else under `app/src`, `app/test`, `app/scripts`, `app/migrations`, `wrangler.toml`, `package.json`, `package-lock.json`, `tsconfig.json` or `vitest.config.ts` had moved. The migration head is 0071.
2. The eighteen were staged, verified against the seal (size and sha256, all eighteen), copied into the sandbox and verified again there.
3. Read against the brief's eight laws. THE THIRD STAGE: `SCHEDULE_STAGES.prepack`, the tile, the three panes; the feed (`PREPACK_PARENT_SQL` in `db.ts`) is a `wip_packages` row with `source = 'cryo'`, `status = 'released'`, `test_outcome = 'passed'`, a live ledger item with grams above zero, filtered to the WPR category through `cryo_type_categories` (a type coded WPR or mapped to it) and to a METRC-shaped tag, and no prepack schedule row for the package; grouped by HBN; each item the last six of the tag, the strain and the grams; `>>` writes one `production_schedules` row per package with `stage = 'prepack'` and the `wip_package_id`; a cryo output always carries its lot (the run refuses without one), so the feed's join to `wet_weight_entries` holds on the floor. THE STATION: `/station/prepack` in `production_ops` after Cryo Weight Entry (the registry entry in `pipeline.ts`); the left pane the scheduled jobs by the parent's last six with the strain and grams remaining; the line form with the unit from `prepack_units` and THE LAST USED default (the newest non-voided line, any job, 3.5 when none), a whole positive bag count, a tag that must be METRC-shaped and not on the ledger or another line; Add line writes `prepack_lines`, debits the parent's ledger item by the line's grams less any carried grams with a log row under `prepack line`, births an FG ledger item for the tag in grams at `prepack_location`, and refuses when the parent has fewer grams than the debit; a void with a reason returns the grams to the parent, voids the FG item and re-opens the carry it drew on; the right pane the lbs by bag type at 448, the total, the parent's grams remaining. FINISH PACK: refused with no line; the remainder R is the parent's live ledger grams; with R above zero and no answer the page asks Yes or No; Yes writes an open `prepack_carries` row; either answer zeros the parent with the reason (`prepack finish, R g carried` or `prepack finish, R g left`, or `prepack finish` at zero), moves the package `released` to `packed` through `applyTransition('prepack_packed')` (a new terminal `WIP_STATUS`), completes the schedule with its log row, and the two files pend under the HBN in Pending Data Uploads (`listPendingPrepackFiles`: `new_packages` and `package_finish`, each until marked uploaded; the mark route accepts both for a prepack job). A unit with no Item name refuses the finish in words. THE CARRY: the oldest open carry is offered on every picked job's line form; Use it posts its id and the next saved line takes the smaller of the carry's remaining and the line's grams, the parent debited only the rest, the carry `used` at zero; Not now leaves it open; the ingredient names this job's parent alone at the line's full grams. THE METRC FILES: one New Packages row per line through the cryo run's T3 writer (Tag, Location `prepack_location`, Item from `prepack_items`, Use Same Item no, Quantity the bags, Unit Each, Actual Date the line's day, the ingredient the parent tag in Grams); the Finish file `Label,ActualDate` with the parent tag and the farm day of the finish. THE CONSOLE: `data-hc-section="prepack"` after Testing, last on the page; bags by unit and lbs from the day's non-voided lines by `work_date`, Jobs finished by `completed_at` inside the farm day, one DLH box posting to `/harvest/prepack-hours` into `prepack_labor_hours` by work date, Lbs/DLH blank as `type the hours` (`escriba las horas`) until typed; the footnote says the sheet does not fill the box. WHOLE GRAMS: `lineGrams = roundGrams(bags * unit)`; pounds at 448 two decimals. SPANISH on every new string.
4. Migration 0071: `prepack_lines`, `prepack_carries`, `prepack_labor_hours` (work_date UNIQUE), three indexes, the three `INSERT OR IGNORE` app_config seeds; nothing else changes shape.
5. THE LANDING, READ IN THE DATABASE. The smoke's local D1 after the walk: two prepack schedules (one complete, one scheduled); three lines (3.5 x 2 = 7 g, 7 x 1 = 7 g on the first job; 3.5 x 1 = 4 g on the second with 4 g carried); one carry of 6 g with 2 g remaining, open; the first parent `1A40...0A01` at 0 g and `packed` with `test_outcome` passed; three FG items in the Prepack Room at 7, 7 and 4 g; the New Packages file marked uploaded, the Finish file still pending; hours 4 on 2026-09-21; log rows `prepack line` 32, `prepack finish, 6 g carried` 2, `schedule complete` on the job; the three seeds present.

## Gates on the tree as received (the Scribe's sandbox)

- `npx tsc --noEmit`: exit 0.
- `npx vitest run`: 49 files, 826 tests passed; the same under `TZ=America/New_York`.
- `node --check scripts/smoke.mjs`: ok.
- From-zero smoke (`SMOKE_PORT=9082`, the DROPS copy of the In Testing workbook present): `About to apply 71 migration(s)`, `SMOKE PASS`, no 500; exit 0 once the dev server was ended by pid (the sandbox note of 0.30.189). The two `Request was cancelled` lines are wrangler's `Request.cf` lookups against workers.cloudflare.com, refused by the egress policy, not the app.
- Dash audit: 0 on `src`, `test`, `migrations/0071_prepack.sql`, `scripts/smoke.mjs` and the build report.
- Secret grep (`METRC_INTEGRATOR_KEY = "`, `METRC_USER_KEY = "`, `MS_CLIENT_SECRET = "`, `cfast_`): no matches in the slice.

## His word at the gate

The build's four calls were put to the owner. THE INGREDIENT QUANTITY was the fork: three bags of 3.5 g are 10.5 g; the build rounds the line to 11 g and sends METRC 11 g as the ingredient, where canon 0.30.164 law 4 had METRC-facing quantities keep two decimals. His pick on the question tool: "Whole gram everywhere". The build ships as built; canon 0.30.164 law 4 gains the prepack exception (the New Packages ingredient of a prepack line is the line's whole gram, the same number the ledger debits); the half-gram drift between METRC's parent and the physical take on odd-count 3.5 lines is the owner's to carry. His other three calls stand as built: the FG package stored in grams with the bags to METRC in Each; the Item names and the room as placeholders in Admin, Lookups, app_config; the scheduling arrow opens the station and Finish Pack completes the job.

## Notes for the owner (not blocking)

- THE FIRST FLOOR ITEMS: the four Item names are `PREPACK 3.5`, `PREPACK 7`, `PREPACK 14`, `PREPACK 28` until you set the real METRC item names in Admin, Lookups, app_config (`prepack_items`); a unit without a name refuses Finish Pack in words. The room `Prepack Room` must exist in METRC under that name for the New Packages file to land there, or the config value is edited to the room METRC knows.
- A voided line after Finish Pack: the station no longer shows a completed job's lines, so the void form is not reachable from the page; the route itself does not refuse a completed job. Not a floor case today.
- The carry prompt is the oldest open carry, one at a time; a second carry waits until the first is used.
- The build's remaining assumptions (the carry consumed by the lines that post its id; jobs finished by the finish instant's farm day, bags and pounds by the line's Effective Date; a finished pack not demoted; unscheduling refused while lines stand) are as the brief asked.

## Deploy (his hands; the three-step block, 0071 rides)

```powershell
cd "C:\Users\DennisWallace\Documents\Claude\Projects\gripfactory Practical\app"
npx wrangler d1 execute gripfactory-lite-grip-20260914 --env grip --remote --command "SELECT 1"
npx wrangler d1 migrations apply gripfactory-lite-grip-20260914 --env grip --remote
npm run deploy:grip
```

The console is the probe again: `/harvest` now reads `prepack_lines` and `prepack_labor_hours` (0071's tables), so a rendering Harvest Console proves the apply landed; an error there means the deploy went alone and the apply line is the whole repair.

## Sealed final check

```
npx tsc --noEmit                      exit 0
npx vitest run                        49 files, 826 tests passed
TZ=America/New_York npx vitest run    49 files, 826 tests passed
node --check scripts/smoke.mjs        ok
rm -rf .smoke-persist && CI=1 SMOKE_PORT=9082 WRANGLER_SEND_METRICS=false npm run smoke
                                      About to apply 71 migration(s); SMOKE PASS; " 500 " lines: 0; exit 0
the build session's seal (18 files) verified byte for byte on the device and in the sandbox:
migrations/0071_prepack.sql                     1995  f77fdb058dfd2c53
src/prepack.ts                                 30711  8a5828154a1cd561
src/config.ts                                  63722  d8256f9eb2102e78
src/scheduling.ts                              10569  a52c4aa8c2f73833
src/db.ts                                     164119  2258311fa3b1b1ac
src/actions.ts                                270260  bca5914a223d3ff3
src/cryo.ts                                    23565  f8572cc69af0156d
src/pipeline.ts                                49548  1492dbf8059f4255
src/lookups.ts                                  8280  5b2a4177aa75d9c4
src/i18n.ts                                   153503  bba77ab7a84ff618
src/console.ts                                 98389  ac543143fe0e1f69
src/index.ts                                  130803  52a21760c12cd5f9
src/html.ts                                   178726  5180baab9d0b67ff
test/prepack.test.ts                            5008  a47e8e1481fa78ac
test/console.test.ts                           50965  b7bdccb33f0c37a7
test/scheduling.test.ts                         9858  5c2510cc2ca2b9f7
test/surface.test.ts                           79381  8d20a13fb609e6b1
scripts/smoke.mjs                             544407  7579e4bc8ef4aa2b
tree hash after the copy, device and sandbox: 692e82e0affe0b87 (201 files)
the build report: SESSION_REPORTS/2026-09-22_prepack.md  6653  6c0ebd93cc48e581
dash audit: 0 on every file above
secret grep: no matches
```
