# 2026-09-27 The gate on the progression bud (canon 0.30.274): PASSED

Scribe session. The gate on his Code session's `SESSION_REPORTS/2026-09-27_the_progression_bud.md` (brief U, THE PROGRESSION BUD, canon 0.30.273; no migration). The report says "Not deployed. Nothing committed."; nothing was deployed before this gate (the disk's last deploy build is the 21:31:18Z one of worker b62af536). No Scribe change to `app/`. His hand-back, verbatim in part: "The trim graph is now the drawing: 100 cells, 1 at the heart and 100 at the foot of the stem. Nothing was committed or deployed."

VERDICT: PASSED. Every gate passes, the built table is his drawing cell for cell, and the law reads as briefed on all six points. The deploy is his: the worker-only line at the end.

## What was gated

1. The tree came over as one tarball. It hashed identical on both sides: 227 files, listing sha256 591677e363bd75a2. Against the live tree (f3d4a1fd98b3aa2a, worker b62af536) exactly the report's three sealed files changed, none new; no migration (the head stays 0077); `src/theme.ts`, `wrangler.toml` and `package.json` did not move. The seal covers every changed file (G-10).
2. The three files match the seal byte for byte (size, sha256 and tail). No dash and no CR byte in any of the 205 files under `src`, `test`, `migrations` and `scripts/smoke.mjs`, nor in the build report.
3. THE TABLE IS THE DRAWING: the Scribe parsed `BUD_CELLS` out of the built `src/console.ts` and compared it to the brief's table (row, column, number), the transcription of his drawing checked twice at 0.30.273: 100 cells, every number 1 to 100 once, every one of the 100 at the brief's row and column, every cell mirrored on its row at column 12 minus its own, 1 at (13, 6), 100 at (18, 6), the stem 50, 82, 83, 100 down column 6; `BUD_ROWS` 19, `BUD_COLS` 13; `BUD_STEM` and `data-hc-bud-stem` gone from the file.
4. Read against brief U's six laws. THE CELLS: as item 3; the geometry unchanged (7.6 on a pitch of 10, rx 1.2, inset 1.2); the viewBox `0 0 130 190`; no theme rule, the svg sizing its height from the viewBox at the same width. THE PROGRESSION: `lit = round(btr * 100)`, cell n bud when `n <= lit`, consumed otherwise, `data-hc-bud-consumed` = 100 minus lit; at 0.63 cells 1 to 63 bud and 64 to 100 consumed; at 1 every cell bud; at 0 every cell consumed; null draws 100 outlines. THE PRODUCT AND THE WASTE: the bogey (40 when none is passed, clamped 0 to 100) names cells 1 to bogey; a consumed cell with `n <= bogey` carries `data-hc-bud-waste`, the deep red and the throb untouched in `theme.ts`; at 0.31 and 40, cells 32 to 40 are waste and 41 to 100 byproduct; 0 draws none; 100 draws every consumed cell. THE ATTRIBUTES: `data-hc-bud-order` = 101 minus n, `data-hc-bud-n` = n, `data-hc-bud-consumed` and `data-hc-bud-product` on the svg as before. NOTHING ELSE MOVES: the BTR read, the shift cards, the machine picture, the RUNNING flash, the colors, the throb, the legend, Admin Lookups, the migrations, `wrangler.toml`.
5. THE TESTS (`test/console.test.ts`): the table's 100 cells, every number once, the heart at (13, 6), the foot at (18, 6), the four stem cells down column 6, every cell's mirror; 0.63 lights 1 to 63 by number and order and consumes 64 to 100; 0.31 at bogey 40 reads 32 to 40 as waste, 41 to 69 as byproduct, and position 61 (n 40) as waste as the throbbing waste case has it; bogey 0 none, bogey 100 sixty-nine; null 100 outlines, no stem attribute; `data-hc-bud-n` equal to 101 minus the order on all 100; the viewBox; the 0.30.207, 0.30.243, 0.30.248 and 0.30.249 cases re-read against the new order (at 60 percent, consumed 40, the heart cell 1 bud and the foot cell 100 the first consumed; at a bogey of 35 and 0.31, the waste at positions 66 to 69, cell 35 at (11, 3)). The smoke reads both buds on the 13 by 19 lattice with 200 outlines and no stem when nothing ran, and at a Day BTR of 60 percent, consumed 40, cell 1 bud at order 100 and cell 100 consumed at order 1.

## His word: the report's four assumptions

They stand as the report states them, and as the brief set them: the four stem cells count like the rest; the product is the heart, so the red dig reads outward from the center; the consumption position stays on `data-hc-bud-order` with the drawn number beside it; the picture grows from 16 rows to 19 at the same cell size.

## Observations for his word (no hold)

- A BTR on a half percent (31.5, say) now rounds toward bud by one cell, where the old plume rounded that half toward consumed: `lit` is `round(btr * 100)` and the consumed count follows it, so the two never disagree with each other. One cell, on a half, only.
- The Cerberus, Continuum and Lite reds, the throb and the legend words are the same rules as before; only the cells under them moved.

## Gates on the tree as received (the Scribe's sandbox)

- `npx tsc --noEmit`: exit 0.
- `npx vitest run`: 62 files, 943 tests passed; the same under `TZ=America/New_York`.
- `node --check scripts/smoke.mjs`: ok.
- From-zero smoke (`SMOKE_PORT=9189`): `About to apply 77 migration(s)`, `SMOKE PASS`, no ` 500 ` line; the dev server ended by the timeout after the pass.
- Dash audit: 0, and no CR byte, on the 205 files under `src`, `test`, `migrations` and `scripts/smoke.mjs`, and on the build report.
- Secret grep (`METRC_INTEGRATOR_KEY = "`, `METRC_USER_KEY = "`, `MS_CLIENT_SECRET = "`, `SENSORPUSH_PASSWORD = "`, `cfas[t]_`): no matches under `src`, `test`, `scripts`, `migrations` or `wrangler.toml`.

## Deploy (his hands; worker-only, no migration rides)

```powershell
cd "C:\Users\DennisWallace\Documents\Claude\Projects\gripfactory Practical\app"
npm run deploy:grip
```

His paste back: the Version ID. THE PROBE: the Harvest Console's trim cards draw his bud, 1 at the heart and 100 at the foot of the stem, a little taller than before at the same width; with yesterday's BTR the cells above it are grey from the outside in, the heart green, and any consumed cell within the bogey deep red and pulsing.

## Sealed final check

```
npx tsc --noEmit                      exit 0
npx vitest run                        62 files, 943 tests passed
TZ=America/New_York npx vitest run    62 files, 943 tests passed
node --check scripts/smoke.mjs        ok
rm -rf .smoke-persist && CI=1 SMOKE_PORT=9189 WRANGLER_SEND_METRICS=false npm run smoke
                                      About to apply 77 migration(s); SMOKE PASS; " 500 " lines: 0
the build report's seal (3 files) verified byte for byte, device and sandbox:
scripts/smoke.mjs                             617271  b23860d38a231723
src/console.ts                                100390  d3b7deecdf3247e9
test/console.test.ts                           60125  17ec0838d07aeca7
BUD_CELLS against the brief's table: 100 of 100 at their row and column; symmetric; no stem constant
changed against the live tree, not in the seal: none
tree listing, device and sandbox: 227 files, sha256 591677e363bd75a2 (live: f3d4a1fd98b3aa2a)
the build report: SESSION_REPORTS/2026-09-27_the_progression_bud.md  2991  ae5e3790b4d963b0
dash audit: 0; CR audit: 0; secret grep: no matches
```
