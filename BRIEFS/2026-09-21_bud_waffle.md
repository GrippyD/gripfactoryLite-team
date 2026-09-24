# BRIEF: THE BUD WAFFLE (canon 0.30.157; built as 0.30.159)

> BUILT AND GATED (canon 0.30.159). SUPERSEDED IN ONE PART: the cell map below is his second drawing (seven bands and a center of thirty); his third drawing (canon 0.30.160, THE DEEPER BUD: ROYGBIV, then white, then black, the center of ten last) replaced it in `src/console.ts` by the Scribe's hand. The constants in the code are the law; do not paste this map again.

For a build session (Claude Code or Cursor) in `app/`, under THE DISPATCH RULE (canon 0.30.155). Read `CLAUDE.md`, then `canon/_NOW.md`, `canon/MEMORY.md`, `canon/CANON.md` (rows 0.30.88, 0.30.154, 0.30.157) before a line is written. Guardrails: no git remotes or pushes (G-1); no em or en dashes anywhere you write (G-8); ship-clean (G-9); a sealed session report (G-10). No migration is needed; the from-zero smoke pin stays 65. Never deploy; the Scribe hands the owner the block.

## The ruling (owner, 2026-09-21, verbatim, with his drawing of colored squares in a bud shape)

"I believe there are 100 squares in this picture.  The squares (similar to your grid pattern) are arranged in the shape of a bud.  The colors are in ROYGBIV order for consumption.  This is how I want the BTR displayed on the shift panes.  The dark green at the center is the color a lot starts at, the consumption goes in ROYGBIV order according to the chart (if we ever grind down to 20% flower I'll need to update my resume so the green can just be the color of "bud" and the center bud is basically going to be constant), however the consumed bud should be displayed as grey (like you had it before our latest update--I only put the ROYGBIV in there to show the order that I want them consumed (red squares becomes grey first, then orange, then yellow, and so on)."

His picks on the question tool: the bud stands "Beside the machine picture, the BTR under it"; within a band the squares grey "Top to bottom, left to right". On the count (the Scribe's sampling of his first drawing read 90 squares: ten each of red, orange, yellow, light green, blue, indigo, violet and a dark green center of twenty) his word was "I'll fix it", and his corrected drawing followed: 100 squares, the center widened to thirty. The cell map below is read from that drawing by the Scribe's extractor and is the law of the shape. Do not redraw it.

## The law to build

1. THE BUD: an SVG pictograph of the cells in `BUD_CELLS` (below), one rounded square per cell on a `BUD_ROWS` by `BUD_COLS` lattice (viewBox `0 0 BUD_COLS*10 BUD_ROWS*10`, each cell 7.6 wide at a 1.2 pad, rx 1.2, like the retired waffle's cells). Every cell is one percent of the shift total. A cell is "bud" (the silo green the retired waffle used per theme: Lite and Continuum `#2e9e4f`, Cerberus `#3ecf6b`) or "consumed" (the retired waffle's quiet grey per theme: Lite `#b5bab3`, Continuum `#7a8088`, Cerberus `#6f7680`); when nothing ran (BTR null) every cell is an outline in the line color. The consumed count is `round((1 - btr) * 100)` clamped to `0..BUD_CELLS.length`; the first `consumed` cells of `BUD_CELLS` grey, in the array's order, which is the consumption order: red, orange, yellow, light green, blue, indigo, violet, then the dark green center last; within a band top to bottom, left to right. The colors of his drawing never render; they only fix the order.
2. THE PLACE: in each shift card of the Harvest Console's Trimming section (`trimShiftCard` in `src/console.ts`) the visual row becomes two: the machine picture (`trimLinePicture`, canon 0.30.154) on the left, the bud on the right, in a `div.hc-visuals` (flex, wrap on phones; the picture `flex: 3 1 26rem`, the bud column `flex: 0 0 9.5rem` like the retired `.hc-pictograph`). Under the bud: the BTR read (`<strong>56.3%</strong> BTR`, or "no packages yesterday" when null) and a legend with two swatches, "bud" and "consumed". His lines follow below as now.
3. THE MARKUP FOR THE PINS: `<svg class="hc-bud" viewBox="..." role="img" aria-label="BTR 56.3%" data-hc-bud data-hc-bud-consumed="44">`; each cell `<rect class="hc-bud-cell hc-bud-bud|hc-bud-consumed|hc-bud-empty" data-hc-bud-order="k" .../>` where k is 1-based position in `BUD_CELLS`; the read `<div class="hc-btr-read" data-hc-btr-read>`; the legend `<div class="hc-legend"><span class="hc-swatch hc-swatch-bud"></span>bud <span class="hc-swatch hc-swatch-consumed"></span>consumed</div>`. The aria-label when nothing ran is the translated "no packages yesterday".

## Files

- `src/console.ts`: `BUD_ROWS`, `BUD_COLS`, `BUD_CELLS` (paste from below, verbatim); `export function budWaffle(btr: number | null, locale: Locale = "en"): string`; `trimShiftCard` gains the visual row. Nothing else in the card changes; `trimLinePicture` is untouched.
- `src/theme.ts`: in each of the three stylesheets (Lite from line 297, Continuum from 837, Cerberus from 1464; the console block sits after `.hc-shift-stack`), add `.hc-visuals`, `.hc-bud-col`, `.hc-bud`, `.hc-bud-bud`, `.hc-bud-consumed`, `.hc-bud-empty`, `.hc-btr-read`, `.hc-legend`, `.hc-swatch`, `.hc-swatch-bud`, `.hc-swatch-consumed`, with the per-theme greens and greys above; `body.device-phone .hc-visuals { flex-wrap: wrap; }`.
- `src/i18n.ts`: "bud" and "consumed" (ES: "flor", "consumido"); "no packages yesterday" and "BTR" already exist.
- `test/console.test.ts`: `BUD_CELLS` has the count the map states, every band its count, no duplicate cell, every cell inside the lattice; the order runs red first and center last; `budWaffle(0.6)` greys exactly 40 cells and they are the first 40 of `BUD_CELLS` (assert `data-hc-bud-order="1"` through `"40"` carry `hc-bud-consumed` and `"41"` carries `hc-bud-bud`); `budWaffle(null)` renders every cell `hc-bud-empty` with `data-hc-bud-consumed="0"` and the "no packages yesterday" label; `budWaffle(1.004)` greys 0 and `budWaffle(0)` greys them all; the section test: the bud stands after the picture and before the lines in each card, the read and the legend render, Spanish speaks ("flor", "consumido").
- `scripts/smoke.mjs`: at the console walk (search `data-hc-trimline-total="50"`), pin the Day card `data-hc-bud-consumed="40"` (BTR 60.0%) and the Second card `data-hc-bud-consumed="69"` (BTR 31.0%); before any package (search `data-hc-trimline-total="0"`), both cards `data-hc-bud-consumed="0"` with every cell `hc-bud-empty`; the Spanish pass includes "consumido".

## Gates and the hand-back

`npx tsc --noEmit` (0); `npx vitest run` and `TZ=America/New_York npx vitest run` (all green); `node --check scripts/smoke.mjs`; the from-zero smoke (`rm -rf .smoke-persist && SMOKE_PORT=<fresh 90xx> WRANGLER_SEND_METRICS=false timeout 285 npm run smoke`, exit 124 is normal, expect `About to apply 65 migration(s)`, `SMOKE PASS`, zero ` 500 ` lines); the dash audit `LC_ALL=C grep -c $'\xe2\x80\x94\|\xe2\x80\x93' <file> || true` reading 0 on every file you touched. Write `SESSION_REPORTS/<date>_bud_waffle.md` with the law as built, the files, your assumptions for the owner's word, and the sealed final check (each file's byte size and the first 16 of its sha256, the gate lines verbatim). Do not deploy. Tell the owner the report is written; the Scribe gates it, folds canon and hands the deploy block.

## The cell map (the law of the shape)

Read by the Scribe's extractor from his corrected drawing (2026-09-21, the second picture: 18 rows by 7 columns on a 28 px grid): 100 cells, ten each of red, orange, yellow, light green, blue, indigo and violet, and a dark green center of thirty. The grid as read (row 0 at the top; `.` is empty):

```
. . . R . . .
. R R R R R .
. R O Y O R .
R O Y Y Y O R
O Y g B g Y O
O B B B B B O
O B B N B B O
Y N V G V N Y
Y V G G G V Y
g G G G G G g
g G G G G G g
g G G G G G g
g G G G G G g
. G G G G G .
. V V G V V .
. N V N V N .
. . N N N . .
. . . N . . .
```

Paste these constants into `src/console.ts` verbatim (the array is already in consumption order; `data-hc-bud-order` is the 1-based index):

```ts
// THE BUD WAFFLE: the owner's drawing as cells in consumption order (band by band, top to bottom, left to right).
// 18 rows by 7 columns; 100 cells.
export const BUD_ROWS = 18;
export const BUD_COLS = 7;
export const BUD_CELLS: ReadonlyArray<readonly [number, number, string]> = [
  [0, 3, "red"], [1, 1, "red"], [1, 2, "red"], [1, 3, "red"], [1, 4, "red"], [1, 5, "red"], [2, 1, "red"],
  [2, 5, "red"], [3, 0, "red"], [3, 6, "red"], [2, 2, "orange"], [2, 4, "orange"], [3, 1, "orange"], [3, 5, "orange"],
  [4, 0, "orange"], [4, 6, "orange"], [5, 0, "orange"], [5, 6, "orange"], [6, 0, "orange"], [6, 6, "orange"],
  [2, 3, "yellow"], [3, 2, "yellow"], [3, 3, "yellow"], [3, 4, "yellow"], [4, 1, "yellow"], [4, 5, "yellow"],
  [7, 0, "yellow"], [7, 6, "yellow"], [8, 0, "yellow"], [8, 6, "yellow"], [4, 2, "green"], [4, 4, "green"],
  [9, 0, "green"], [9, 6, "green"], [10, 0, "green"], [10, 6, "green"], [11, 0, "green"], [11, 6, "green"],
  [12, 0, "green"], [12, 6, "green"], [4, 3, "blue"], [5, 1, "blue"], [5, 2, "blue"], [5, 3, "blue"], [5, 4, "blue"],
  [5, 5, "blue"], [6, 1, "blue"], [6, 2, "blue"], [6, 4, "blue"], [6, 5, "blue"], [6, 3, "indigo"], [7, 1, "indigo"],
  [7, 5, "indigo"], [15, 1, "indigo"], [15, 3, "indigo"], [15, 5, "indigo"], [16, 2, "indigo"], [16, 3, "indigo"],
  [16, 4, "indigo"], [17, 3, "indigo"], [7, 2, "violet"], [7, 4, "violet"], [8, 1, "violet"], [8, 5, "violet"],
  [14, 1, "violet"], [14, 2, "violet"], [14, 4, "violet"], [14, 5, "violet"], [15, 2, "violet"], [15, 4, "violet"],
  [7, 3, "center"], [8, 2, "center"], [8, 3, "center"], [8, 4, "center"], [9, 1, "center"], [9, 2, "center"],
  [9, 3, "center"], [9, 4, "center"], [9, 5, "center"], [10, 1, "center"], [10, 2, "center"], [10, 3, "center"],
  [10, 4, "center"], [10, 5, "center"], [11, 1, "center"], [11, 2, "center"], [11, 3, "center"], [11, 4, "center"],
  [11, 5, "center"], [12, 1, "center"], [12, 2, "center"], [12, 3, "center"], [12, 4, "center"], [12, 5, "center"],
  [13, 1, "center"], [13, 2, "center"], [13, 3, "center"], [13, 4, "center"], [13, 5, "center"], [14, 3, "center"],
];
```

Test the map as data: 100 entries, the eight band counts above (10, 10, 10, 10, 10, 10, 10, 30), no duplicate `[row, col]`, every row in `0..17` and every column in `0..6`, the bands in the order red, orange, yellow, green, blue, indigo, violet, center, and each band's cells in reading order (row ascending, then column).
