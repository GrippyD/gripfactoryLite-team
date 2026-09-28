# BRIEF U: THE PROGRESSION BUD (canon 0.30.273)

For the build session (Claude Code or Cursor) in `app/`, under THE DISPATCH RULE (canon 0.30.155), in its own sitting on the live tree (worker b62af536, canon 0.30.272). Canon wins over this brief where they differ; read `canon/_NOW.md` first. No migration. Commit nothing, push nothing, deploy nothing.

## The ruling (owner, 2026-09-27, verbatim, with his drawing)

"because it's driving me insane, please change trim consumption graph to the attached shape/progression. Last one (promise) (each one represents a cumulative percent--so instead of "consumption" this reads more like progression, but either way, reverse the order for consumption"

His drawing is `RESEARCH/plume/2026-09-27_progression_bud.png` (git-ignored, beside this brief on his disk): one hundred green cells numbered 1 to 100 on a grid, a bud with two leaf pairs, two side sprigs, a four-cell stem, 1 at the heart of the body and 100 at the foot of the stem.

## What the Scribe read

1. THE PLUME (canon 0.30.207) as it stands in `src/console.ts`: `BUD_CELLS`, 100 cells on a 16 by 13 lattice in consumption order (the ROYGBIVWB bands, the teal core last), plus `BUD_STEM`, two permanent dark green cells never counted; `budWaffle(btr, locale, bogeyPct)` greys the first `round((1 - btr) * 100)` cells of the order as byproduct, draws a consumed cell among the last `bogeyPct` of the order as waste (THE PRODUCT LINE 0.30.243, THE TRIM BOGEY 0.30.249, the deep red 0.30.248, the throb 0.30.266), outlines every cell when nothing ran, and writes `data-hc-bud-order` (the consumption position), `data-hc-bud-consumed` and `data-hc-bud-product` on the svg. The legend reads bud, byproduct, waste. `test/console.test.ts` reads the order, the waste and the bogey by position; the throbbing waste test reads position 61 as waste at a BTR of 0.31.
2. THE SCRIBE'S TRANSCRIPTION of the drawing, checked twice: 100 cells, every number 1 to 100 once, 13 columns (0 to 12, the center 6) by 19 rows (0 at the top), and every cell has its mirror on the same row at column 12 minus its own, the drawing being symmetric. Rows: 0 has 99, 98, 97, 96 at columns 2, 5, 7, 10; 1 has 93, 94, 95, 92 at 1, 4, 8, 11; 2 has 90, 67, 66, 91 at 2, 5, 7, 10; 3 has 71, 57, 70 at 2, 6, 10; 4 has 68, 55, 47, 56, 69 at 3, 5, 6, 7, 9; 5 has 76, 60, 53, 40, 54, 61, 77 at 1, 4, 5, 6, 7, 8, 11; 6 has 78, 75, 58, 45, 29, 46, 59, 74, 79 at 0, 1, 4, 5, 6, 7, 8, 11, 12; 7 has 72, 64, 48, 38, 24, 39, 49, 65, 73 at 2 to 10; 8 has 62, 41, 25, 17, 26, 42, 63 at 3 to 9; 9 has 88, 43, 27, 18, 9, 19, 28, 44, 86 at 0, 3, 4, 5, 6, 7, 8, 9, 12; 10 has 84, 81, 36, 23, 10, 8, 11, 22, 37, 80, 85 at 1 to 11; 11 has 89, 35, 20, 7, 3, 6, 21, 34, 87 at 0, 3, 4, 5, 6, 7, 8, 9, 12; 12 has 32, 12, 4, 2, 5, 13, 33 at 3 to 9; 13 has 30, 14, 1, 15, 31 at 4 to 8; 14 has 51, 16, 52 at 5, 6, 7; 15 has 50, 16 has 82, 17 has 83 and 18 has 100, each at column 6.

## The law to build

1. THE CELLS. `BUD_CELLS` becomes the drawing: 100 cells on a 13 by 19 lattice, each carrying its drawn number, as the table below gives them (row, column, number). No permanent cell: `BUD_STEM` retires with its `data-hc-bud-stem` attribute; the stem is 50, 82, 83 and 100, counted like any cell. The cell geometry stays (a 7.6 square on a pitch of 10, rx 1.2, the 1.2 inset); the viewBox grows to 130 by 190; the drawn width of `.hc-bud` stays what it is so the card's width holds, and the picture is a little taller.

   1:(13,6) 2:(12,6) 3:(11,6) 4:(12,5) 5:(12,7) 6:(11,7) 7:(11,5) 8:(10,6) 9:(9,6) 10:(10,5) 11:(10,7) 12:(12,4) 13:(12,8) 14:(13,5) 15:(13,7) 16:(14,6) 17:(8,6) 18:(9,5) 19:(9,7) 20:(11,4) 21:(11,8) 22:(10,8) 23:(10,4) 24:(7,6) 25:(8,5) 26:(8,7) 27:(9,4) 28:(9,8) 29:(6,6) 30:(13,4) 31:(13,8) 32:(12,3) 33:(12,9) 34:(11,9) 35:(11,3) 36:(10,3) 37:(10,9) 38:(7,5) 39:(7,7) 40:(5,6) 41:(8,4) 42:(8,8) 43:(9,3) 44:(9,9) 45:(6,5) 46:(6,7) 47:(4,6) 48:(7,4) 49:(7,8) 50:(15,6) 51:(14,5) 52:(14,7) 53:(5,5) 54:(5,7) 55:(4,5) 56:(4,7) 57:(3,6) 58:(6,4) 59:(6,8) 60:(5,4) 61:(5,8) 62:(8,3) 63:(8,9) 64:(7,3) 65:(7,9) 66:(2,7) 67:(2,5) 68:(4,3) 69:(4,9) 70:(3,10) 71:(3,2) 72:(7,2) 73:(7,10) 74:(6,11) 75:(6,1) 76:(5,1) 77:(5,11) 78:(6,0) 79:(6,12) 80:(10,10) 81:(10,2) 82:(16,6) 83:(17,6) 84:(10,1) 85:(10,11) 86:(9,12) 87:(11,12) 88:(9,0) 89:(11,0) 90:(2,2) 91:(2,10) 92:(1,11) 93:(1,1) 94:(1,4) 95:(1,8) 96:(0,10) 97:(0,7) 98:(0,5) 99:(0,2) 100:(18,6)

2. THE PROGRESSION, AND THE ORDER REVERSED. Each cell is one cumulative percent: cell n draws as bud when n is at most `round(btr * 100)` and as consumed otherwise. Said the other way, his "reverse the order for consumption": the consumption order runs 100 down to 1, and the first `round((1 - btr) * 100)` cells of it are consumed. At a BTR of 63 percent, 1 to 63 are bud and 64 to 100 consumed; at 100 every cell is bud; at 0 every cell is consumed; with no reading every cell is an outline, as today.
3. THE PRODUCT AND THE WASTE. The Trim Bogey (Admin, Lookups; 40 when none is saved) names the product as the cells 1 to bogey, the last of the reversed order, the heart of the bud. A consumed cell among them is waste, deep red and throbbing as it is today (0.30.248, 0.30.266): waste is every n with `round(btr * 100) < n <= bogey`. At a BTR of 35 and a bogey of 40, cells 36 to 40 are red and 41 to 65 grey; above the bogey nothing is red; a bogey of 0 draws no red; a bogey of 100 draws every consumed cell red. The byproduct grey and the legend (bud, byproduct, waste) stand.
4. THE ATTRIBUTES. `data-hc-bud-order` keeps its meaning, the consumption position, now `101 - n`, so every reader of a position (the tests, the smoke, the throbbing waste test's position 61) keeps reading true; the cell also carries its drawn number as `data-hc-bud-n`. `data-hc-bud-consumed` and `data-hc-bud-product` on the svg stand.
5. NOTHING ELSE MOVES. The BTR itself and its read, the shift cards, the machine picture, the RUNNING flash, the colors of the three skins, the throb, the legend, Admin Lookups and the bogey's save, every migration, `wrangler.toml`.
6. THE TESTS. `test/console.test.ts`: the table holds 100 cells, every number once, every cell with its mirror at column 12 minus its own on its row; a BTR of 0.63 lights 1 to 63 and consumes 64 to 100; 0.31 with the bogey at 40 reads 32 to 40 as waste and 41 to 69 as byproduct, and position 61 (n 40) as waste as the throbbing waste test already has it; a bogey of 0 draws no waste and 100 draws every consumed cell as waste; null draws 100 outlines and no stem attribute; `data-hc-bud-n` equals `101 - data-hc-bud-order` on every cell; the viewBox reads 130 by 190. The existing plume, product line, bogey and throb cases are re-read against the new order where they name positions or counts. `scripts/smoke.mjs`: its plume assertions follow the new order.

## Assumptions for his word

- The four stem cells count like any other, so no permanent dark green remains (his drawing numbers them 50, 82, 83, 100).
- The product is the heart, 1 to bogey, so the red dig reads from the center outward as the BTR falls under the bogey.
- `data-hc-bud-order` keeps the consumption position and the drawn number rides beside it.
- The picture grows from 16 to 19 rows at the same cell size, the card a little taller.

## Files

`src/console.ts` (`BUD_CELLS`, `BUD_ROWS`, `BUD_STEM` retired, `budWaffle`), `src/theme.ts` only if the taller svg needs a rule, `test/console.test.ts`, `scripts/smoke.mjs` where it reads the plume.

## Gates and the hand-back

The usual: tsc 0; vitest both zones; node --check; the from-zero smoke at pin 77 with `SMOKE PASS` and no 500; dash audit 0; no key, secret or password in any file; no personnel data. Report `SESSION_REPORTS/<date>_the_progression_bud.md` with the sealed final check and the assumptions above. Do not deploy; the worker-only line is the Scribe's to hand after the gate.
