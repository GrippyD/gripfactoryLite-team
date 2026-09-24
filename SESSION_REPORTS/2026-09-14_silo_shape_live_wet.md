# 2026-09-14 THE SILO SHAPE AND THE LIVE WET WEIGHT (canon 0.30.69)

Scribe-direct under G-2. Owner ruling 2026-09-14, verbatim:

> "under silos in the reports and on the inventory and drying screen, add the wet weights on the bottom.
>
> change all silo shapes from circles to cone-topped cylinders.  If it's being filled in the wet weight screen, indicate underneath that it's "filling" While the wet weights are being put in a silo, add a green filling color to the inside of the silo wireframe.  Each silo holds 15k lbs wet for scaling.  When it's filling, make it throb green, once the clock is started, change it to throbbing red, and replace the "filling" with "drying""

Asked which report gets the wet weights he picked "Inventory by Location (Recommended)" and added, verbatim: "Live inventory on all screens, including the Inventory by Location report".

## The law

- **One truth for every silo surface** (`src/silo.ts`): `loadSiloVisuals` reads the silos, their open loads (the clock), the lots still weighing into them (the wet weight screen filling them) and the finished lots planned for them that wait in the barn for Load Silo; `siloVisual` turns that into a state. A load wins: clock running = **drying**, red and throbbing; paused = paused, red still; not started = loaded, red still. No load but a lot weighing in = **filling**, green and throbbing (a lot with no weight yet still fills at level zero). No load, no filling, a finished lot waiting = filled, green still. Nothing = empty, the wireframe alone.
- **The shape.** Every silo is a cone-topped cylinder wireframe (an SVG: the cone roof, the rim ellipse, the body with its elliptical bottom, three strokes in the theme's accent) with the fill clipped inside the body, rising from the bottom. **The fill scales against the capacity**, app_config `silo_capacity_wet_lbs` = 15000 (migration 0048; canon L-4, editable in Admin, Lookups; 6,803,885.55 g), so 7,500 lb reads half full and anything over the cap reads full. The state word sits under the shape; the lots and clocks under that; **the wet weight at the bottom** ("Wet 7,500.00 lb · 3,401,942.78 g"). The circle is gone: `.inv-gauge` is a rounded card in all three themes; hang rooms keep their rounded card and gain the same wet line under their lots.
- **Live on all screens.** `GET /silos/live.json` answers the visuals (state, word, grams, pounds, level, colors, capacity, no-store); `siloLiveScript` refetches every thirty seconds while the page is in view and repaints each tile's fill, word and wet line in place. The drying strip (every Drying Operations page), the inventory screen's Drying tiles and the Load Silo page all carry it.
- **The Inventory by Location report.** A lot weighing INTO a silo reads under that silo as it fills (WET, its origin farm the column), no longer at its site barn (the 0.27.2 barn law stands for lots bound elsewhere); every silo location with material closes with a **Wet total** row (blank farm) at the bottom of its rows, so the CSV, XLSX and PDF lanes carry the silo's wet weight too. The footnote says so.

## Files

- `src/silo.ts` (new): capacity, `siloVisual`, `siloSvg` (geometry 100 by 150: roof to y 8, body 42 to 134), `siloFillBox`, `siloFillClass`, `siloWetLine`, `siloTile`, `siloLiveEntry`, `siloLiveScript`, `siloClockOf`, `assembleSiloVisuals`, `loadSiloVisuals`.
- `src/db.ts`: `listSiloLotGrams` (weighing lots per silo; finished lots per silo with no open load), `WetLotMaterialRow` carries the Move To space, `listWetLotMaterial` joins it, `foldWetLotsIntoLocationRows(ledger, lots, locationFarms, drySpaceFarms, siloNames)` places filling lots under their silo and closes each silo with the Wet total row, `listInventoryByLocation` passes the silo names.
- `src/drying.ts`: `siloStrip(live, nowIso, locale)` draws `siloTile`s and carries the live script.
- `src/html.ts`: `dryingGauges(spaces, locale, siloLive)` draws silos as tiles and hang rooms with the wet line; `inventoryPage` takes the live visuals.
- `src/index.ts`: `/inventory` and the drying routes read `loadSiloVisuals`; `GET /silos/live.json`.
- `src/config.ts`: `CONFIG_KEYS.silo_capacity_wet_lbs`, `ITEM_KIND_WET_TOTAL`. `src/reports.ts`: the Wet total row keeps a blank farm; the footnote. `src/i18n.ts`: filling, filled, loaded, drying, paused, Wet, Wet total (EN and ES). `src/theme.ts`: the silo styles in all three themes (`.silo-shape`, `.silo-wire`, `.silo-fill`, green and red, `@keyframes silo-throb`, reduced motion honored, `.silo-state`, `.silo-wet`, the card radius).
- `migrations/0048_silo_capacity.sql`.
- Tests: `test/silo.test.ts` (6 cases: the capacity, the law, the SVG, the tile order, the assembly, the live entry), `test/drying.test.ts` (the strip: five shapes, filling green throb, drying red throb, paused, empty, the wet lines, the live fetch), `test/strapin.test.ts` (the fold: a filling lot under its silo, the Wet total rows, the older callers unchanged). Suite 26 files, **592 tests**.
- Smoke (pin **48**): while the first lot weighs into Silo 1 the inventory screen draws five shapes with no circle, Silo 1 reads filling with the green throb and "Wet 2.72 lb · 1,234.56 g", the strip agrees, `/silos/live.json` answers filling with the running total and the 15,000 lb capacity, the location report places the WET row under Silo 1 and closes it with "PNN,Silo 1,,Wet total,1234.56,g"; the 0.27.2 walk's PNS lot weighing into Silo 3 now reads under Silo 3 at PNN with its Wet total; after Load Silo, Silo 4 reads drying with the red throb on the strip, the live endpoint agrees, the report closes Silo 4 with its Wet total while Silo 3 still fills green.

## Gates

- `npx tsc --noEmit`: 0 errors.
- `npx vitest run`: 26 files, 592 tests passed.
- From-zero smoke: "About to apply 48 migration(s)", SMOKE PASS.
- Dash audit: 0 on every changed file.
- Visual pass: the strip rendered in Grip, Continuum and Cerberus (five cone-topped cylinders; Silo 1 filling green at 31%, Silo 2 drying red at 50%, Silo 3 empty, Silo 4 paused red, Silo 5 filled green; the state word under each; the wet weight at the bottom).

## Deploy (his hands, with a migration)

From `app/`: probe, `npx wrangler d1 migrations apply gripfactory-lite-grip-20260914 --env grip --remote` (applies 0048), `npm run deploy:grip`.

## Sealed final check

```
src/silo.ts                             13479  5475dbf2fd9ec263
src/drying.ts                           15917  0fcd9a9f9f10499d
src/html.ts                            163979  a3e46bc8beedcabd
src/db.ts                              116211  eb7b75fadc50bd39
src/index.ts                           108149  2482481d614651b1
src/config.ts                           34386  5b762500150294e5
src/reports.ts                          24735  76c07351c6945928
src/theme.ts                           120345  46d50a33efa324a6
src/i18n.ts                            104171  c0dc89e0060334e4
migrations/0048_silo_capacity.sql         540  7ce9edb0fd48bb26
scripts/smoke.mjs                      332870  361dfe8d9ac23130
test/silo.test.ts                        7366  29aaabbaab734dd1
test/drying.test.ts                     13433  00386834dfbc6b49
test/strapin.test.ts                    26453  246f412d404cb483
tsc: 0 errors; vitest: 26 files, 592 tests passed
smoke: About to apply 48 migration(s); SMOKE PASS
dash audit: 0 on every file above
```
