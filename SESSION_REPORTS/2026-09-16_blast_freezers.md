# 2026-09-16 The Blast Freezer(s) and the dry space type (canon 0.30.106)

Scribe sitting, built Scribe-direct under G-2. Two owner rulings 2026-09-16, verbatim.

First, with a picture of the Blast Freezer tile (DRYING, Lot 26023, 0d 00:13:35 Running, Wet 749.03 lb) beside the FFZ inventory cube (22% FULL, METRC 284.97 lb in 4 packages, ledger 749.03 lb):

"Change "Blast Freezer" to "Blast Freezer(s)".  Merge the blast freezer formatting to the FFZ inventory one.  Expose FFZ inventory on the dry ops pages.  Unload Dry Space/Blast Freezer just removes the line, since the packages are already denoted as "FFZ" in METRC, the inventory lines are identical and moving the BF inventory to the FFZ inventory would just duplicate it.  Change blast freezer capacity to 800lbs.  Change status "Drying" to "Chilling Out""

Then:

"Admin lookups:

Dry spaces:

1. Name
2. Capacity
3. Capacity UOM (ea, lb, g, sqft)
4. Freezer, Dry Room, or Silo? <<<<<<Toggle that decides the formatting and the shape (freezers = blue with white fade to at slower intervals and cubic, rectangular cuboid with silo coloring and animations, silo is obviously the silos shapes and colors)"

His picks at the forks: the status and the percent on one line (CHILLING OUT · 94% FULL, the lot and its clock muted beneath, the wet line at the bottom, the fill in the FFZ blue); a freezer lot whose line is removed closes as frozen, out of every queue; the tile alone is renamed, the METRC location keeps the word Blast Freezer.

This slice ships WITH migration 0057. From-zero pin 57.

## The law, as built

1. THE DRY SPACE TYPE. A dry space carries its type (dry_spaces.space_type: silo, dry_room, freezer), its capacity with the capacity's unit (capacity, capacity_uom: ea, lb, g, sqft), and the METRC location its loads sit at when that differs from its name (location_name), all values in data (migration 0057). The type decides the shape and the formatting: the silo is the cone-topped cylinder in the silo colors; the dry room the wire cuboid in the silo colors and animations; the freezer the cube in the FFZ blue with the slow fade to white. The stored shape column speaks only for a row with no type.
2. A space's own capacity scales its fill when the unit is a weight (lb or g); ea and sqft read on the lookup alone and the fill falls back to silo_capacity_wet_lbs. The five silos and the Arlington Dry Room are written at 15,000 lb; the Blast Freezer(s) at 800 lb.
3. THE BLAST FREEZER(S). The seeded row (a1000001-0000-4000-8000-0000000000bf) is renamed Blast Freezer(s), typed freezer, drawn as the cube, 800 lb, standing over the METRC location Blast Freezer. Load Silo moves the born package to the space's location_name (the name itself when a space has none) and the load's location-change file prints that word, so METRC never sees the tile's word. The FFZ cube keeps counting the ledger items at Blast Freezer as before.
4. The freezer tile (FFZ chrome): the name; the cube; one state line, the status word and the percent full of its own capacity (CHILLING OUT · 94% FULL); the lot link and its clock muted beneath like the FFZ source line; Wet lb · g at the bottom. A freezer's running clock reads Chilling Out (i18n key chilling out; ES Enfriando); every other state keeps its word (EMPTY · 0% FULL when empty). The live script repaints a freezer from the server's fill classes and fullness word and never rewrites its state line's classes.
5. The FFZ inventory cube rides the strip on every Drying Operations page and on Load Silo, as it does on the console.
6. THE FREEZER'S UNLOAD. Unload Dry Space on a freezer lot shows no dry weights and one control, Remove the line, with the words "This lot stands in a freezer. Its packages already read FFZ in METRC, so unloading only removes the line: nothing moves and no dry weight is taken." The finish ends the open loads (the line leaves the tile), moves the lot drying to frozen (LOT_STATUS.frozen, transition lot_frozen, reason "freezer line removed; the packages stand as FFZ in METRC"), voids the session the page had opened (a finished session would pend the package file), moves no inventory, pends no file, and flashes "Line removed. The packages stand as FFZ in METRC; nothing moved." No queue reads frozen: the lot never reaches the Unloaded Queue or the Trimming station; its package stays FFZ inventory in the ledger at Blast Freezer and the cube counts it once.
7. Admin, Lookups, Dry spaces: the table reads name, capacity, capacity_uom, space_type (in his words: Silo, Dry Room, Freezer), kind, farm_code; the add form takes Name, Capacity, Capacity UOM, Freezer, Dry Room, or Silo?, Kind, Farm (a capacity and its UOM go together; the type sets the drawn shape); the pencil carries the same six, the type and the UOM as selects (EditFieldDef.options, refused in words when off the list), the capacity as a number above zero or blank.

## What changed

- `migrations/0057_dry_space_types.sql`: the four columns; the boxes and hang rooms typed dry_room; the silos at 15,000 lb; the Blast Freezer(s) row.
- `src/config.ts`: DRY_SPACE_TYPES, DRY_SPACE_TYPE_LABELS, drySpaceTypeOf, CAPACITY_UOMS, capacityUomOf; LOT_STATUS.frozen; transition lot_frozen; SYSTEM_REASON.freezer_unload.
- `src/db.ts`: SiloRow widened; listSilos orders silos, dry rooms, freezers and selects the new columns; the dry spaces admin rows carry them; LotRow and getLot carry dry_space_type.
- `src/silo.ts`: SiloShape gains cube; spaceShapeOf, spaceTypeOf, spaceCapacityGrams, spaceCapacityLabel; siloVisual takes freezer (Chilling Out); siloFillClass gives a holding freezer the FFZ classes; siloSvg draws the cube; siloTile's freezer format; siloPctLabel; SiloLiveEntry gains fillClass, pctLabel, spaceType; the live script honours them; assembleSiloVisuals scales each space against its own capacity.
- `src/drying.ts`, `src/index.ts`, `src/html.ts`: every tile and live entry takes the type-derived shape; the FFZ cube joins the Drying Operations and Load Silo strips; the flash for ok=frozen; the freezer unload panel.
- `src/actions.ts`: Load Silo moves the package to location_name; the load's file prints it; finishUnload's freezer branch; addDrySpace takes the type, the capacity and its UOM (parseDrySpaceType, parseCapacity, parseCapacityUom); editRecord's options fields and the capacity number, the type setting the shape.
- `src/pipeline.ts`: EditFieldDef.options; EDITABLE_FIELDS.dry_spaces in his order.
- `src/pages.ts`: the lookup table and add form; the options select on the pencil.
- `src/i18n.ts`: chilling out, Remove the line, the panel sentence, the flash (EN and ES).
- `src/theme.ts`: the freezer tile's state line and lot lines in the shared block.
- Tests: `test/freezer.test.ts` (12 tests: the type and shape, the capacity, the freezer visual and fill, the tile in EN and ES, the live entry and script, assembleSiloVisuals, the sheets, the frozen status and transition, the unload panel, the pencil fields and page, the lookup table and form, the parsers); `test/silo.test.ts` pins widened for the new visual and live fields.
- `scripts/smoke.mjs`: from-zero pin 57; the census reads one box and one cube, the Blast Freezer(s) named and the old word gone, the FFZ cube on the Drying Operations and Load Silo strips, the freezer cube after the box; drySpaceIdByName escapes the name; the freezer walk at the tail (the lookup columns and pencil, the refusals, a 200 lb PNN lot weighed into the freezer reading filling and 25% full, loaded reading Chilling Out and 25% full in the FFZ chrome, the package at the METRC location Blast Freezer, the cube's ledger share up by the lot, the load's file printing Blast Freezer, the freezer unload panel, Remove the line, the frozen lot out of the Dry Space Queue, the Unloaded Queue and the Trimming station, the log under the freezer reason, nothing moved, the cube unchanged, no new file pending).

## Scribe assumptions (his word owed if wrong)

- The Arlington Dry Room and the hang rooms are dry rooms; the silos keep 15,000 lb written on each row.
- ea and sqft capacities read on the lookup and do not scale a fill.
- The freezer's other states (filling, loading, paused, loaded) keep their standing words; only the running clock reads Chilling Out.
- Kind (silo, hang, truck) stays beside the new type: kind says which surfaces a space rides, the type how it draws and behaves.

## Gates

- `npx tsc --noEmit`: exit 0.
- `npx vitest run`: 32 files, 677 tests passed; the same under TZ=America/New_York.
- `node --check scripts/smoke.mjs`: ok.
- From-zero smoke (SMOKE_PORT=8993): `About to apply 57 migration(s)`, `SMOKE PASS`, the freezer walk inside it.
- Visual pass: the strip with Silo 4 drying, the Arlington Dry Room filling, the Blast Freezer(s) chilling at 94% and empty, and the FFZ cube, in lite, cerberus and co; the freezer unload panel in cerberus; the Dry Spaces lookup in lite.
- Dash audit: 0 on every file below.

## Deploy (his hands, WITH migration 0057)

From `app/`:

```
npx wrangler d1 execute gripfactory-lite-grip-20260914 --env grip --remote --command "SELECT 1"
npx wrangler d1 migrations apply gripfactory-lite-grip-20260914 --env grip --remote
npm run deploy:grip
```

## Sealed final check

```
npx tsc --noEmit                      exit 0
npx vitest run                        32 files, 677 tests passed
TZ=America/New_York npx vitest run    32 files, 677 tests passed
node --check scripts/smoke.mjs        ok
rm -rf .smoke-persist && SMOKE_PORT=8993 WRANGLER_SEND_METRICS=false timeout 285 npm run smoke
                                      About to apply 57 migration(s); SMOKE PASS

migrations/0057_dry_space_types.sql       2671  fb6de0be328ba36a
src/config.ts                            45409  e3ad05ca6fe83652
src/db.ts                               140357  67718ae27e284fc7
src/silo.ts                              38809  e2e3f8f8bf2bcf9d
src/drying.ts                            17809  9d2bfe00cdf4c9eb
src/index.ts                            117057  a24c53375ba0570a
src/html.ts                             171367  f005586e0528ad08
src/actions.ts                          251994  770fcfd1364ed011
src/pipeline.ts                          48532  62096a90a38c21b4
src/pages.ts                             24320  2adbdd961a6ee674
src/i18n.ts                             115100  8d468a3c58844908
src/theme.ts                            139774  2907811178bb7497
test/silo.test.ts                        28402  6ff618c027736544
test/freezer.test.ts                     15032  42ff395524987614
scripts/smoke.mjs                       427646  766db6e6dcaa1f40
dash audit: 0 on every file above
```
