# 2026-09-15 THE HARVEST CONSOLE (canon 0.30.73)

Scribe-direct under G-2. Owner ruling 2026-09-15, verbatim:

> Let's strike the dashboard.  Remove it from the report list.  In Admin, add a new button: [Harvest Console]
>
> Collapsible Sections:
>
> Plants: four small boxes naming the farms and a total box.  Shading reflects percent complete.
>
> 1. Plants Remaining/Total Plants
> 2. Plants Harvested
> 3. % Complete
> 4. Wet Weight/plant AVG
> 5. Dry Weight/plant AVG
> 6. Cutting and Bucking Hours Yesterday [open numbox]
> 7. Weight/DLH Yesterday
>
> Drying: our silos animation, a 3d wire rectangular one called "Arlington dry room" go ahead and add this as another "silo" as well (cap is 15000 wet lbs, same as silos), we're going to need to cross this bridge soon anyways, and add our FFZ inventory in a blue wire cube, capacity in there is 4800 lbs (deeper blue slower throbbing to white for "fullness") (no timer).  Keep the shapes proportional to what we have for the silos, those are perfect.
>
> Trimming: stub
>
> Pasteurization: stub
>
> Testing: stub

His picks (AskUserQuestion, 2026-09-15): the new page is [Harvest Console] at /harvest and the vendored planting app's tile is renamed Harvest Console Lite ("New page, old tile renamed"); the boxes are PNN, ARL, PNS and Total, four in all ("Three farms + Total"); the FFZ cube reads "Any FFZ"; the Arlington Dry Room becomes a real silo now ("Make it a real silo now").

## What changed

### The dashboard struck
- `src/reports.ts`: `harvest_dashboard` gone from REPORT_KEYS and REPORT_CARDS (Inventory heads the cards again); `/reports/harvest_dashboard` answers 404.
- `src/index.ts`: the dashboard's filter form and view branches removed; `src/dashboard.ts` and `test/dashboard.test.ts` deleted. The Plants laws it carried live on in `src/console.ts`.
- `src/i18n.ts`: the dashboard strings replaced by the console's (EN/ES).

### The console at /harvest
- `src/console.ts` (new): `CONSOLE_FARMS` PNN, ARL, PNS; `etDate`, `dayBefore`, `etDayBounds` (the farm's day is Eastern; yesterday's bounds in UTC hold across both DST edges); `loadHarvestConsole` (five Postgres-portable queries: METRC live plants by license farm, plant counts on the year's finished lots, the year's finished lots for the per-plant averages, the wet grams weighed yesterday from `wet_weights`, yesterday's hours); `consoleBoxes` (the seven metrics per farm and Total, pounds first with grams under; Total adds every farm plus plants under a license with no farm; Weight/DLH reads "type hours" until hours land); `harvestConsolePage` (five `<details>` sections, Plants and Drying open; the four boxes each with a `.hc-shade` overlay whose opacity is 55% of its % complete; the hours numbox per farm posting to `/harvest/hours`, saving on change, Total showing the sum; Trimming, Pasteurization and Testing as stubs); `parseHours`; `saveHarvestHours` (insert, update or clear one farm's hours for one day, every change in record_change_log as `labor hours typed`).
- `src/index.ts`: `GET /harvest` and `POST /harvest/hours`, both behind the Admin PIN (`/harvest-console`, the vendored Harvest Console Lite, stays open as before); `/silos/live.json` carries `shape` per silo and an `ffz` entry.
- `src/html.ts` adminHomePage: `{ href: "/harvest", kind: "Harvest", title: "Harvest Console" }` after Change log; the vendored tile reads Harvest Console Lite.
- `src/config.ts`: `HARVEST_PATH`, `HARVEST_HOURS_PATH`, `CONFIG_KEYS.ffz_capacity_lbs`, `LOC_BLAST_FREEZER`, `SYSTEM_REASON.labor_hours`, `siloSiteOf`.

### The Arlington Dry Room, a real silo drawn as the wire box
- `migrations/0049_harvest_console.sql`: `dry_spaces.shape` (cylinder for the five, box for the room); the room's kind flips to silo; the five PNN silos take `farm_code = 'PNN'`; `app_config ffz_capacity_lbs` seeded 4800; `harvest_labor_hours` (farm_code, work_date, hours; UNIQUE per farm and day).
- `src/config.ts`: ARL's Move To kinds gain silo (`["silo", "hang", "truck"]`); with the five silos scoped to PNN, ARL is offered its room alone.
- `src/db.ts`: `SiloRow` carries `shape` and `farm_code`; `listSilos` orders the cylinders first, then the boxes; `listBarnWetLots` reads every farm's barn (BARN, ARL BARN, PNS BARN) with a `barn_location` column, narrowing to one barn when asked; `listFfzGrams`.
- `src/actions.ts`: `loadSilo` finds the lot in whichever barn it waits and refuses a silo at another site in words ("Pick a silo at its own site."); `finishUnload` returns the material to the barn of the dry space's site (`homeBarn`: ARL BARN for the room, BARN for the five and the PNN rooms, BARN for truck lots).
- `src/drying.ts`: the Load Silo select offers the silos at the picked lot's barn site; `siloStrip` passes each silo's shape and takes extra tiles (the console appends the FFZ cube).
- `src/silo.ts`: `SiloShape`, `siloShapeOf`, `BOX_GEOMETRY` (front 34 to 146, 42 to 134, depth 32 by 18 in the same 200 by 150 frame), `CUBE_GEOMETRY` (a 92 square front), `boxSkewDegrees` (29.3578, tan = 18/32), `boxTopPoints`, `boxSvg` (front fill, the side face as the same rectangle skewed onto the depth, the liquid's top face, wire over them with the hidden back edges dashed), `siloSvg` by shape, `siloTile` with `shape` (`data-silo-shape-kind`), `siloLiveEntry` with shape; the live script repaints the side and top faces and the FFZ cube.

### The FFZ cube
- `src/silo.ts`: `FFZ_CAPACITY_LBS_DEFAULT` 4800, `ffzCapacityGrams`, `ffzVisual` (grams, level, pct, holding), `ffzCubeSvg`, `ffzTile` ("FFZ inventory", the cube, "NN% full", "FFZ x lb · y g"), `ffzLiveEntry`, `loadFfzVisual`. No clock.
- `src/db.ts` `listFfzGrams` ("Any FFZ"): the ledger grams at the Blast Freezer plus every cryo'd package's ledger grams wherever it sits (each item once), plus the cryo weight of a cryo'd package still in the Testing Queue with no live ledger item.
- `src/theme.ts` (all three themes): `.silo-wire-hidden` dashed, `.silo-fill-side` darker, `.silo-fill-top` lighter; `.ffz-gauge .silo-wire` blue, `.ffz-fill` deep blue, `.ffz-throb` 4.2 s ease to near white and back (the silos throb at 1.6 s), `.ffz-state`; the console's `.hc-*` rules (sections, the four boxes, the shade, the metrics, the hours form, phone stacking).

### Tests and smoke
- `test/console.test.ts` (new, 10): the strike, the paths, the Eastern day and its DST bounds, the seven metrics (PNN 1,200 / 2,000 and 40.0%; 500.00 g wet per plant as 1.10 lb; 90,718.474 g over 8 h as 25.00 lb/h and 11,339.81 g/h; Total 1,509 / 2,359 and 36.0%), the sections, the four shaded boxes, the numbox, the Drying strip with the box and the cube, `parseHours`, Spanish.
- `test/silo.test.ts` (+5): shape law, geometry pins, the box markup, the cube, the live script.
- `test/routing.test.ts`: ARL kinds; the Move To fixture mirrors the 0049 seed; the Admin tiles.
- `test/drying.test.ts`: `barn_location` on the fixtures.
- `scripts/smoke.mjs`: 49 migrations; the dashboard struck (card gone, route 404); the PIN on /harvest and /harvest/hours with /harvest-console open; six silos on the strip and in live.json (five cylinders, one box); the ARL room lot weighs in bucked (silo law), the Load Silo pane offers it the room alone, a PNN silo refuses in words, the load reads drying as the box, the Inventory by Location report places it under the room with its Wet total row, the unload returns 80 g to the ARL barn and ends the load; the guard lot's silo unload adjusts the package itself (no -B child); the console walk (Admin button, sections, four boxes, the seven lines, hours saved, retyped, logged and cleared, Weight/DLH dividing, the cube empty then holding after the Blast Freezer move, Spanish).

## Gates

- `npx tsc --noEmit`: 0 errors.
- `npx vitest run`: 26 files, 598 tests passed.
- From-zero smoke: "About to apply 49 migration(s)", SMOKE PASS.
- Dash audit: 0 on every changed file.
- Visual pass: the console rendered in Lite, Continuum and Cerberus at 1280px: the four shaded boxes, five cylinders with the wire box and the blue cube on the strip.

## Deploy (his hands, with the migration)

From `app/`:

```
npx wrangler d1 execute gripfactory-lite-grip-20260914 --env grip --remote --command "SELECT 1"
npx wrangler d1 migrations apply gripfactory-lite-grip-20260914 --env grip --remote
npm run deploy:grip
```

## Sealed final check

```
migrations/0049_harvest_console.sql        2504  4286e67232d1dc33
src/config.ts                             35864  8f593e48a5298439
src/db.ts                                118820  2a3ca55480f035dd
src/silo.ts                               24178  27b48b5be945d02c
src/console.ts                            21072  c2500f927248f788
src/drying.ts                             16563  7512d98f08eb588f
src/html.ts                              164479  61bee80bc5d5c152
src/index.ts                             108960  a606dc907d747db5
src/reports.ts                            24647  405456b794c82259
src/i18n.ts                              106223  ebf3dddee769dc32
src/theme.ts                             127622  c8f4165d6e259eef
src/actions.ts                           225414  a396119a7e78e9de
test/console.test.ts                      13904  68c3f50a24cb65e9
test/silo.test.ts                         15094  0dbdae9940eb12aa
test/routing.test.ts                      33030  9131a32aa4efdb02
test/drying.test.ts                       13491  0556a1ebadd4d2b2
scripts/smoke.mjs                        350155  a348f34371d442c4
deleted: src/dashboard.ts, test/dashboard.test.ts
tsc: 0 errors; vitest: 26 files, 598 tests passed
smoke: About to apply 49 migration(s); SMOKE PASS
dash audit: 0 on every file above
```
