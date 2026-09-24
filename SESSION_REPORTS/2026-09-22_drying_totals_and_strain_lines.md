# 2026-09-22 The Drying Totals and the Strain on the Lot Line (canon 0.30.183)

Scribe-direct under G-2 (a presentation change on a live surface, small, no migration), on the LIVE floor of 0.30.182 (worker 5a7d87bd, migrations 0001-0068), with the tree quiet (Part 2b gated and deployed; Part 3 waits for his continue), one hand in `app/` (canon 0.30.165). Worker-only deploy; from-zero pin stays 68.

## The owner's words (2026-09-22, verbatim)

"Some small things: Under the dry spaces on the harvest console (harvest), Total in Dry Spaces, Total in Cure Spaces, Total Dry Queued. Under the lots in the dry spaces, show the market strain (or the actual strain if the market strain is null--should already be the rule)". On the question tool, free text: "Loaded in dry rooms and silos only - also add a dry weight estimate based on an Admin lookup (default to 21%)".

## The law, as built

1. THE DRYING TOTALS: one line under the dry space tiles in the console's Drying section (`/harvest`), three figures, each the pounds at 448 and the whole grams with the lot count under. Total in Dry Spaces is the wet weight of the open loads in the silos and the dry rooms only: the freezer's chilling material and the lots still waiting to load stay out. Under it the dry estimate, `est. dry X lb at P%`, the loaded grams times the Admin percent (app_config `projected_dry_yield_pct`, the same number the tiles' "of expected" reads; 22 by default and 22 on his floor since 0.30.77). Total in Cure Spaces is the dry weight of the lots on CSA and CSB. Total Dry Queued is the Unloaded Queue for trim (unloaded lots with a live trim schedule, the queue the trimming clocks read), its dry grams.
2. THE STRAIN ON THE LOT LINE: every lot line on a dry space tile (a loaded lot with its clock, a lot waiting to load) carries the strain under the lot number, the market strain when the HBN names one, else the strain's name (THE FEED NAMES THE REAL STRAIN, 0.30.149, the same `COALESCE(b.market_strain, s.name)` the load rows already carried); a lot whose HBN names neither carries no line. On every surface that draws the strip (the console, the drying pages, Load Silo, the unload station).
3. Spanish speaks: `Total en espacios de secado`, `Total en espacios de curado`, `Total seco en cola`, `seco est. X lb al P%`, `N lotes` / `1 lote`.

## What changed

- `src/db.ts`: `listSiloLotGrams` selects `COALESCE(b.market_strain, s.name) AS strain_label` (a LEFT JOIN on strains); `SiloLotGramsRow.strain_label`.
- `src/silo.ts`: `SiloWaitingLot.strain_label` (carried only when the HBN names one, so the row's shape is unchanged otherwise); `lotStrainLine`; `dryingTotals` (pure) and `DryingTotals`; `dryingTotalsMarkup`; `siloWaitingLines` draws the strain line between the lot number and the waiting word.
- `src/drying.ts`: the loaded lot's line draws the strain between the lot number and its clock.
- `src/console.ts`: `HarvestConsolePageInput.dryingTotals`; the Drying section draws the totals under the strip; the Unloaded Queue query also sums `dry_weight_grams` (`TrimInput.queueGrams`).
- `src/index.ts`: `/harvest` computes the totals from the silo visuals, the cure panes and the queue, at the Admin percent `loadSiloVisuals` already reads.
- `src/i18n.ts`: the six strings, EN and ES.
- `src/theme.ts` (shared chrome): `.drying-totals`, `.drying-total*`, `.inv-lot-strain`.
- `test/silo.test.ts`, `test/drying.test.ts`, `test/console.test.ts`: the math (the freezer and the waiting lots out, the estimate at 22 and at 21, a bad percent falling to the default, an empty floor at zeros), the markup EN and ES, the strain line on waiting and loaded lines and its order, the console section carrying the totals or not.
- `scripts/smoke.mjs`: the console reads the totals line under the strip with the three labels, the estimate at 22 percent and pounds-and-grams on each; the Spanish console reads them; the waiting line on Silo 5 carries `Rainbow Candies` (the market strain over Fruity Pebbles) between the lot number and the waiting word; a loaded lot's line carries its strain before the clock.

## On the repaired local floor (a dev server on the 0.30.180 copy, port 9079, no 500)

Silo 1 `Lot 26030 Bermuda Triangle waiting to load Wet 15,275.46 lb · 6,843,406 g` through Silo 5 `Lot 26034 Bermuda Triangle ...`; Arlington Dry Room `Lot 26029 Bermuda Triangle 3d 02:48:30 Running Lot 26027 Bermuda Triangle 3d 04:48:30 Running`. The totals line: `Total in Dry Spaces 19,432.91 lb · 8,705,942 g, 2 lots · est. dry 4,275.24 lb at 22%; Total in Cure Spaces 16,250.58 lb · 7,280,260 g, 6 lots; Total Dry Queued 4,891.14 lb · 2,191,230 g, 2 lots` (the two lots of CSA and the four of CSB in the cure total; two of CSB's four stand in the Unloaded Queue for trim).

## Scribe assumptions (his word owed if wrong)

1. Total in Dry Spaces counts the open loads whose space is a silo or a dry room; the Blast Freezer(s) (type freezer) is out even when it holds a load, and so are the lots waiting to load (they read on their tiles as loading but are not inside a space yet).
2. The estimate's percent is the standing `projected_dry_yield_pct` in Admin, Lookups, app_config, not a second number: 22 on his floor. His "default to 21%" is read as the number to set there; the code default stays 22 so the tiles' "of expected" and the estimate never disagree. Setting 21 in Admin moves both at once.
3. Total Dry Queued is the Unloaded Queue for trim (status unloaded with a scheduled trim row), the same set that lights the trimming clocks; unloaded lots not yet scheduled (CSA) count in the cure total only. If he meant the lots waiting to load into a silo, that is a one-line change.
4. The totals draw only on the console (`/harvest`), not on the drying pages that carry the strip.
5. The lot count under each total counts lots, not packages; a total of one reads `1 lot`.
6. The estimate rounds to whole grams before the pounds; the pounds read two decimals at 448 like every figure on the tiles.

## Gates

- `npx tsc --noEmit`: exit 0.
- `npx vitest run`: 45 files, 804 tests passed; the same under `TZ=America/New_York`.
- `node --check scripts/smoke.mjs`: ok.
- From-zero smoke (`SMOKE_PORT=9078`): `About to apply 68 migration(s)`, `SMOKE PASS`, no 500.
- Dash audit: 0 on every file below.
- Secret grep: no matches; `453.59` the one METRC comment.

## Deploy (his hands; worker only)

```powershell
cd "C:\Users\DennisWallace\Documents\Claude\Projects\gripfactory Practical\app"
npm run deploy:grip
```

## Sealed final check

```
npx tsc --noEmit                      exit 0
npx vitest run                        45 files, 804 tests passed
TZ=America/New_York npx vitest run    45 files, 804 tests passed
node --check scripts/smoke.mjs        ok
rm -rf .smoke-persist && SMOKE_PORT=9078 WRANGLER_SEND_METRICS=false timeout 285 npm run smoke
                                      About to apply 68 migration(s); SMOKE PASS; " 500 " lines: 0 (exit 0)
src/db.ts                  158896  5ea9cc89e1f005f9
src/silo.ts                 43808  3b69a52000d50920
src/drying.ts               20500  2599f478b57b4ba1
src/console.ts              91559  3dcf7a0ac6d6fce2
src/index.ts               126480  2647150eb94a999e
src/i18n.ts                149288  6a15a797b8cb6302
src/theme.ts               153208  fdd122bbde4afbc3
test/silo.test.ts           34279  1aeaed60f61b7e81
test/drying.test.ts         14991  8d34839df1482e9d
test/console.test.ts        48481  409e4ee7236f0245
scripts/smoke.mjs          532173  79d0936ac6bfdd8b
dash audit: 0 on every file above
```
