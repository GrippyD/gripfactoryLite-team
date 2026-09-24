# 2026-09-22 The Panes Ride the Strip (canon 0.30.171)

Scribe-direct under G-2 (a placement change on a live surface, small, no migration), on the LIVE floor of 0.30.170 (worker 08c596f1, migrations 0001-0067), with the tree quiet and the owner asked to hold "continue" to his Code session until the block is handed (one hand in app/, canon 0.30.165). Worker-only deploy; from-zero pin stays 67. Owner, 2026-09-22, verbatim, with a screenshot of the console's Drying section (the five silos, then Arlington Dry Room, Blast Freezer and FFZ Inventory, then CSA and CSB as two wide cards below): "While I work on that, CSA and CSB should be in line with drying spaces, in the void after FFZ Inventory set the same size".

## The law, as built

1. THE PANES RIDE THE STRIP: CSA and CSB are tiles of the drying row. `curePanes` returns the two `inv-gauge cure-pane` cards and the clock script with no wrapper of their own, and both surfaces hand that string to `siloStrip` as extra tiles after the FFZ cube: the console (`harvestConsolePage`, the field `cureTiles`, rendered inside the strip) and every Drying Operations page (`siloStripFor`). Nothing of the panes stands outside the strip any more.
2. THE SAME SIZE: a pane's children are the silo drawing's width (11.2rem), so the tile computes the same width as the silo and FFZ tiles beside it (the `inv-gauge` padding and border are shared). The pane's text is 0.8rem; a lot row reads left-aligned and wraps long words inside the tile. Heights follow content, as the silo tiles' do.

## What changed

- `src/cure.ts`: `curePanes` without the wrapper; the doc comment carries his words.
- `src/index.ts`: the console route passes `cureTiles`; `siloStripFor` appends the cards to the FFZ tile inside the strip.
- `src/console.ts`: `HarvestConsolePage.cureTiles` replaces `cureHtml`; the Drying section renders the strip alone, the panes inside it.
- `src/theme.ts` (shared chrome): `.cure-panes` gone; `.cure-pane` is a fixed tile (`flex: 0 0 auto; width: auto; min-width: 0; font-size: 0.8rem`), `.cure-pane > *` 11.2rem wide, `.cure-row` left-aligned with `overflow-wrap: anywhere`.
- `test/cure.test.ts`: no wrapper, the CSA card first, CSB before the script.
- `test/console.test.ts`: the panes inside the strip's `inv-gauges` row after `data-ffz`, in order, none outside; without tiles the strip renders as before.
- `scripts/smoke.mjs`: on the console and on a drying page, both panes inside the strip after the FFZ cube, in order, none outside, the old wrapper gone.

## Scribe assumptions (his word owed if wrong)

- "The same size" is the tiles' width; heights follow content as the silo tiles' do (a pane with many lots grows taller, as a silo with many waiting lots does).
- The panes follow the FFZ cube (the "void after FFZ Inventory"), on the drying pages as on the console.
- The lot rows read left-aligned inside a centered tile, at 0.8rem, so the short id, pounds, clock and the two moisture lines fit the tile's width.

## Gates

- `npx tsc --noEmit`: exit 0.
- `npx vitest run`: 44 files, 790 tests passed; the same under `TZ=America/New_York`.
- `node --check scripts/smoke.mjs`: ok.
- From-zero smoke (`SMOKE_PORT=9072`): `About to apply 67 migration(s)`, `SMOKE PASS`, no 500.
- Dash audit: 0 on every file below.

## Deploy (his hands; worker only)

```powershell
cd "C:\Users\DennisWallace\Documents\Claude\Projects\gripfactory Practical\app"
npm run deploy:grip
```

## Sealed final check

```
npx tsc --noEmit                      exit 0
npx vitest run                        44 files, 790 tests passed
TZ=America/New_York npx vitest run    44 files, 790 tests passed
node --check scripts/smoke.mjs        ok
rm -rf .smoke-persist && SMOKE_PORT=9072 WRANGLER_SEND_METRICS=false timeout 285 npm run smoke
                                      About to apply 67 migration(s); SMOKE PASS; " 500 " lines: 0 (exit 124, the timeout's, as always)
src/cure.ts                 16032  dfb3b631eccb8a20
src/index.ts               120859  a03191c7306e28cb
src/console.ts              69751  4e4250a68e256f5f
src/theme.ts               151374  5cdf2b4373e2b83b
test/cure.test.ts            9865  87a8705028af23eb
test/console.test.ts        46866  e2c25fad43b4aa7e
scripts/smoke.mjs          514596  8809e775a11a4060
dash audit: 0 on every file above
```
