# 2026-09-15 THE LOADING SILO (canon 0.30.81)

Scribe-direct under G-2. Owner ruling 2026-09-15 on the live 0.30.80 floor, verbatim: "when a satellite farm's material is received at PNN and it's in the barn with a wet weight, it should be set as "loading" in the correctly assigned silo.  See the only wet lot present in the system from PNS for example".

## What was found

A received truck lot keeps the truck sentinel as its dry space until the crew's Load Silo, so it never reached a silo tile: the PNS lot sat in the PNN barn with its wet weight and no silo read it. The barn-waiting state the tiles already had was named "filled", not his word.

## The law

1. A finished lot (status drying, no open silo load) whose dry space is not a silo is attributed to the silo the HBN planned: `harvest_batches.planned_dryspc` (the Silo # lookup value, "1" to "5") matched to the dry space named "Silo N", as long as the lot's born package sits in the PNN barn (BARN). A weighing lot still fills only the silo it weighs into. A finished lot whose own space is a silo counts there, as before.
2. The barn-waiting state is his word: `loading` (green, still). `filled` is gone from the state set, the stylesheet and the strings.
3. A loading tile names the lots it waits for, each a link into Load Silo with that lot picked (`/station/load_silo?pick=<lot>`), with "in the barn" or "in the barn, planned here" under the lot number.
4. Load Silo preselects the planned silo when the lot's own space is not a silo; a lot whose space is a silo keeps that pick.
5. `/silos/live.json` carries the `waiting` list per silo beside `loads`.

## What changed

- `src/db.ts`: `listSiloLotGrams` joins the planned silo by name and takes the barn-sitting finished lot; rows carry `lot_id`, `hbn`, `metrc_harvest_tag`, `planned`. `BARN_WET_LOT_SELECT` gains `planned_silo_id`.
- `src/silo.ts`: `SiloState` loading replaces filled; `SiloWaitingLot`, `SiloLive.waiting`, `siloWaitingLines`; `assembleSiloVisuals` builds the waiting list and sets loading on grams or lots.
- `src/drying.ts`: the strip tile body carries the waiting lines; Load Silo's silo select preselects the planned silo.
- `src/html.ts`: the Inventory drying gauges carry the waiting lines.
- `src/i18n.ts`: loading, in the barn, in the barn planned here (EN and ES); filled removed.
- `src/theme.ts` x3: `.silo-state-loading` colored with filling.
- Tests: `test/silo.test.ts` (loading pins, planned rows, waiting lines), `test/console.test.ts` (fixtures carry `waiting`), `test/drying.test.ts`.
- `scripts/smoke.mjs`: the 220 acquire plans Silo 5; after the receive at PNN, Silo 5 reads loading on the strip, the tile names the lot with its Load Silo link and "in the barn, planned here", live.json reads loading with 1500 wet grams, Load Silo preselects Silo 5, the console strip reads loading.

No migration; no route change.

## Lesson from the gate

The first from-zero smoke failed with a 500 on GET /inventory: the new SQL read `b.silo_number`, a column migration 0017 renamed to `planned_dryspc` (only the lookup category is still called silo_number). The wrangler error text was lost when the smoke killed the dev server; a dev server on the smoke's persisted database gave it in one request. Fixed to `planned_dryspc`; smoke green.

## Gates

- `npx tsc --noEmit`: 0 errors.
- `npx vitest run`: 26 files, 608 tests passed.
- From-zero smoke: "About to apply 50 migration(s)", SMOKE PASS.
- Dash audit: 0 on every changed file.
- Visual pass: the six-silo strip in all three views with Silo 5 loading (green still, two lots named, one "in the barn, planned here", one "in the barn"), Silo 1 filling, Silo 2 drying, the Arlington Dry Room unloading.

## Deploy (his hands, worker only)

From `app/`: `npm run deploy:grip`. Ships with THE LOCATION WITHOUT THE FARM (0.30.82).

## Sealed final check

```
src/db.ts              123197  ecc6b1245b3f2244
src/silo.ts             33369  b5072d3a477af1d4
src/drying.ts           16975  0cb8e5690d5b6696
src/html.ts            164741  20131abc23fd6717
src/i18n.ts            106760  344f09443da09992
src/theme.ts           130889  e12eaa59f7816588
test/silo.test.ts       28168  340643c4719a1199
test/console.test.ts    13930  f238ef81b50244a9
test/drying.test.ts     13491  0556a1ebadd4d2b2
scripts/smoke.mjs      359922  a65f5b0346cd5d1d
tsc: 0 errors; vitest: 26 files, 608 tests passed
smoke: About to apply 50 migration(s); SMOKE PASS
dash audit: 0 on every file above
```
