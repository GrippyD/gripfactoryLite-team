# 2026-09-21 The Bud Waffle (canon 0.30.157; build 0.30.158)

Build session under THE DISPATCH RULE (canon 0.30.155), brief `BRIEFS/2026-09-21_bud_waffle.md`. No migration; from-zero smoke pin stays 65. Not deployed; the Scribe gates this report, folds canon and hands the owner the worker-only block.

Owner, 2026-09-21, with his drawing of colored squares in a bud, verbatim: "I believe there are 100 squares in this picture.  The squares (similar to your grid pattern) are arranged in the shape of a bud.  The colors are in ROYGBIV order for consumption.  This is how I want the BTR displayed on the shift panes.  The dark green at the center is the color a lot starts at, the consumption goes in ROYGBIV order according to the chart (if we ever grind down to 20% flower I'll need to update my resume so the green can just be the color of "bud" and the center bud is basically going to be constant), however the consumed bud should be displayed as grey (like you had it before our latest update--I only put the ROYGBIV in there to show the order that I want them consumed (red squares becomes grey first, then orange, then yellow, and so on)."

His picks on the question tool: the bud stands "Beside the machine picture, the BTR under it"; within a band the squares grey "Top to bottom, left to right". On the first drawing's count he said "I'll fix it"; the corrected drawing is 100 squares, the center widened to thirty. The cell map in the brief (read by the Scribe's extractor) is the law of the shape and was pasted verbatim. It was not redrawn.

## The law, as built

1. THE BUD: an SVG pictograph of `BUD_CELLS`, one rounded square per cell on an 18 by 7 lattice (viewBox `0 0 70 180`, each cell 7.6 wide at a 1.2 pad, rx 1.2). Every cell is one percent of the shift total. A cell is "bud" (Lite and Continuum `#2e9e4f`, Cerberus `#3ecf6b`) or "consumed" (Lite `#b5bab3`, Continuum `#7a8088`, Cerberus `#6f7680`); when BTR is null every cell is an outline in the line color. The consumed count is `round((1 - btr) * 100)` clamped to `0..100`. The first `consumed` cells of `BUD_CELLS` grey, in the array's order: red, orange, yellow, light green, blue, indigo, violet, then the dark green center last; within a band top to bottom, left to right. The drawing's colors never render.
2. THE PLACE: each Trimming shift card (`trimShiftCard`) carries a `div.hc-visuals` row: the machine picture (`trimLinePicture`, untouched) on the left, the bud column on the right (picture `flex: 3 1 26rem`, bud column `flex: 0 0 9.5rem`). Under the bud: the BTR read (`<strong>56.3%</strong> BTR`, or "no packages yesterday" when null) and a legend with two swatches, "bud" and "consumed". His lines follow below as they did. Phones wrap the visuals row.
3. THE MARKUP: `<svg class="hc-bud" viewBox="0 0 70 180" role="img" aria-label="BTR 56.3%" data-hc-bud data-hc-bud-consumed="44">`; each cell `<rect class="hc-bud-cell hc-bud-bud|hc-bud-consumed|hc-bud-empty" data-hc-bud-order="k" .../>` (k is 1-based). The read is `<div class="hc-btr-read" data-hc-btr-read>`; the legend is `<div class="hc-legend"><span class="hc-swatch hc-swatch-bud"></span>bud <span class="hc-swatch hc-swatch-consumed"></span>consumed</div>`. The aria-label when nothing ran is the translated "no packages yesterday".

## What changed

- `src/console.ts`: `BUD_ROWS` 18, `BUD_COLS` 7, `BUD_CELLS` (the map, verbatim); `export function budWaffle(btr, locale)`; `trimShiftCard` gains the visual row. `trimLinePicture` is untouched.
- `src/theme.ts`: in each of the three stylesheets, after `.hc-shift-stack`, `.hc-visuals`, `.hc-bud-col`, `.hc-bud`, `.hc-bud-bud`, `.hc-bud-consumed`, `.hc-bud-empty`, `.hc-btr-read`, `.hc-legend`, `.hc-swatch`, `.hc-swatch-bud`, `.hc-swatch-consumed`, with the per-theme greens and greys; `body.device-phone .hc-visuals { flex-wrap: wrap; }`.
- `src/i18n.ts`: "bud" and "consumed" (ES: "flor", "consumido"). "no packages yesterday" and "BTR" already existed.
- `test/console.test.ts`: the map as data (100 cells, the eight band counts, no duplicate, inside the lattice, bands in order, each band in reading order); `budWaffle(0.6)` greys the first 40 and leaves 41 as bud; `budWaffle(null)` outlines every cell with consumed 0 and the empty label; `budWaffle(1.004)` greys 0; `budWaffle(0)` greys them all; each card's bud stands after the picture and before the lines, the read and the legend render, Spanish speaks ("flor", "consumido").
- `scripts/smoke.mjs`: before any package both cards `data-hc-bud-consumed="0"` with every cell `hc-bud-empty`; Day `data-hc-bud-consumed="40"` (BTR 60.0%); Second `data-hc-bud-consumed="69"` (BTR 31.0%); Spanish includes "consumido".

## Assumptions for the owner's word

- The drawing's ROYGBIV colors never paint a cell; they only fix the consumption order.
- One cell is one percent of the shift total; consumed is `round((1 - BTR) * 100)`, so Day 60.0% greys 40 and Second 31.0% greys 69.
- When nothing ran (BTR null) every cell is an outline and the read and aria-label say "no packages yesterday".
- The bud stands beside the picture (picture left, bud right) with the BTR and the legend under the bud; his lines stay under the visual row.
- The legend words are "bud" and "consumed" (ES "flor", "consumido"), not BUD/OTHER.
- The center band greys last, after the seven outer bands (the first 70 cells).
- `trimLinePicture` is untouched; no migration; the from-zero pin stays 65.

## Gates

- `npx tsc --noEmit`: exit 0.
- `npx vitest run`: 42 files, 771 tests passed; the same under `TZ=America/New_York`.
- `node --check scripts/smoke.mjs`: ok.
- From-zero smoke (`SMOKE_PORT=9076`): `About to apply 65 migration(s)`, `SMOKE PASS`, no ` 500 ` in the log.
- A rendered look (Lite greens, 60.0%, 31.0%, and the empty outline): the shape is his bud; the outer bands grey first and the center last; the empty bud is outlines only.
- Dash audit: 0 on every file below.

## Deploy

Not deployed from this session. The Scribe gates the report, folds the 0.30.158 row and hands the owner the worker-only block (`npm run deploy:grip` from `app/`; no migration).

## Sealed final check

```
npx tsc --noEmit                      exit 0
npx vitest run                        42 files, 771 tests passed
TZ=America/New_York npx vitest run    42 files, 771 tests passed
node --check scripts/smoke.mjs        ok
rm -rf .smoke-persist && SMOKE_PORT=9076 WRANGLER_SEND_METRICS=false npm run smoke
                                      About to apply 65 migration(s); SMOKE PASS; " 500 " lines: 0

src/console.ts                          65187  cdda4c4a062508c1
src/theme.ts                           150518  46df38dd109177dc
src/i18n.ts                            133208  d6c07742c7bd6905
test/console.test.ts                    39318  af0bcf3ddefa5ac3
scripts/smoke.mjs                      504111  1163ad24e266efde
dash audit: 0 on every file above
```
