# 2026-09-15 THE UNLOADING SILO (canon 0.30.77)

Scribe-direct under G-2. Owner ruling 2026-09-15, verbatim: "All silos: if there is weight in the lot's unload dry space fields, "unloading", throb blue, show cap changes".

## The law

Every silo (the five cylinders and the Arlington Dry Room box) whose loaded lot has dry weight recorded at Unload Dry Space (`wet_weight_entries.dry_weight_grams`, the live total of its non-voided `dry_weights` rows) reads **unloading** over its clock's state, throbs **blue**, and its fill **falls** with the dry out: the dry grams so far over the expected dry (the loaded wet times the projected dry yield, `app_config projected_dry_yield_pct`, 22 by default), so 50 g out of a 1,132 g lot (249.04 g expected) drops the fill to 80% of the loaded level; all the expected dry out draws the silo empty while it still reads unloading until Finish unload ends the load. The word under the silo is "unloading" and a line under it reads the cap change in words: "Dry out 0.11 lb · 20% of expected". The wet line keeps the loaded wet weight. Voiding the dry row (with its reason) recomputes the total and the silo reads drying again. `/silos/live.json` carries `unloadedDryGrams`, `unloadLb`, `unloadPct` and blue as a fill and throb color; the live script repaints the fill, the word and the line.

## What changed

- `src/silo.ts`: `SiloState` gains `unloading`; `SiloFillColor` (green, red, blue); `PROJECTED_DRY_YIELD_PCT_DEFAULT` 22; `SiloVisualInput.unloadedDryGrams` and `dryYieldPct`; `SiloVisual.unloadedDryGrams`, `unloadedShare`, `expectedDryGrams`; `unloadingLevel`; `siloVisual` reads unloading first when a load has dry out; `siloFillClass` blue; `siloUnloadLine` (hidden outside unloading, kept for the repaint); `siloTile` prints it under the state word; `SiloLiveEntry` and `siloLiveEntry` widened; the live script paints blue and the line; `assembleSiloVisuals(silos, loads, lotGrams, capacity, dryYieldPct)` sums the loads' `dry_weight_grams`; `loadSiloVisuals` reads `projected_dry_yield_pct` and returns it.
- `src/db.ts`: `SiloLoadRow.dry_weight_grams`; `SILO_LOAD_SELECT` selects `w.dry_weight_grams`.
- `src/i18n.ts`: unloading, Dry out, of expected (EN/ES). `src/theme.ts` x3: `.silo-fill-blue`, `.silo-state-unloading`, `.silo-unload`.
- `test/silo.test.ts` (+3, two pins widened): the law, the drawing in cylinder and box, the assembly from the loads and the yield.
- `scripts/smoke.mjs`: on the loaded Silo 4 lot (1,132 g wet), one 50 g dry weight turns the strip and live.json to unloading in blue with "Dry out 0.11 lb · 20% of expected" and the level at 80% of the loaded level, only Silo 4 reads it, and voiding the dry row returns the silo to drying at the loaded level.

No migration; no route change.

## Gates

- `npx tsc --noEmit`: 0 errors.
- `npx vitest run`: 26 files, 603 tests passed.
- From-zero smoke: "About to apply 50 migration(s)", SMOKE PASS.
- Dash audit: 0 on every changed file.
- Visual pass: the strip in Lite, Continuum and Cerberus with Silo 2 unloading at 53% out and the Arlington box at 22% out, blue over the red, green and empty neighbors.

## Deploy (his hands, worker only)

From `app/`: `npm run deploy:grip`.

## Sealed final check

```
src/silo.ts                 31370  2f2aba43876ce786
src/db.ts                  121122  34d36104df48328e
src/i18n.ts                106587  eda5f936d3aeda57
src/theme.ts               128837  335dd762fbfc8392
test/silo.test.ts           23137  49833031b76a504a
scripts/smoke.mjs          356884  26405f410536bf5d
tsc: 0 errors; vitest: 26 files, 603 tests passed
smoke: About to apply 50 migration(s); SMOKE PASS
dash audit: 0 on every file above
```
