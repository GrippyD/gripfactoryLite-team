# 2026-09-27 The progression bud

Brief U, THE PROGRESSION BUD (canon 0.30.273). No migration. Not deployed. Nothing committed.

## What changed

The trim graph is his drawing: 100 cells on a 13 by 19 lattice, 1 at the heart and 100 at the foot of the stem. The stem cells 50, 82, 83 and 100 count like any other cell. There is no permanent stem and no `data-hc-bud-stem`.

Cell n is bud when n is at most `round(btr * 100)` and consumed otherwise. That is the consumption order run from 100 down to 1. At 63 percent, cells 1 to 63 are bud and 64 to 100 are consumed. At 100 every cell is bud. At 0 every cell is consumed. With no reading every cell is an outline.

The Trim Bogey names the product as cells 1 to the bogey, the heart. A consumed cell among them is waste, deep red and throbbing as before. At a BTR of 31 percent and a bogey of 40, cells 32 to 40 are waste and 41 to 100 are byproduct. A bogey of 0 draws no waste. A bogey of 100 draws every consumed cell as waste.

`data-hc-bud-order` is the consumption position, `101 - n`. `data-hc-bud-n` is the drawn number. The viewBox is 130 by 190. The card's width is unchanged; the picture is a little taller because the svg already sizes its height from the viewBox. No theme rule was added.

## Assumptions for his word

- The four stem cells count like any other, so no permanent dark green remains (his drawing numbers them 50, 82, 83, 100).
- The product is the heart, 1 to bogey, so the red dig reads from the center outward as the BTR falls under the bogey.
- `data-hc-bud-order` keeps the consumption position and the drawn number rides beside it.
- The picture grows from 16 to 19 rows at the same cell size, the card a little taller.

## Gates

- `npx tsc --noEmit`: exit 0.
- `npx vitest run`: 62 files, 943 tests passed. The same under `TZ=America/New_York`.
- `node --check scripts/smoke.mjs`: exit 0.
- From-zero smoke (`SMOKE_PORT=9192`, `WRANGLER_SEND_METRICS=false`): `About to apply 77 migration(s)`, `SMOKE PASS`, ` 500 ` lines: 0, exit 0.
- Dash audit: 0 on the files below (U+2014 and U+2013). No CR byte in those files.
- `METRC_INTEGRATOR_KEY = "`, `METRC_USER_KEY = "`, `MS_CLIENT_SECRET = "`, and `SENSORPUSH_PASSWORD = "` appear in no file under `src`, `test`, `scripts`, `migrations`, or `wrangler.toml`.

## Deploy

Not deployed from this session. Nothing committed. No migration.

## Sealed final check

```
npx tsc --noEmit                      exit 0
npx vitest run                        62 files, 943 tests passed
TZ=America/New_York npx vitest run    62 files, 943 tests passed
node --check scripts/smoke.mjs        exit 0
SMOKE_PORT=9192 WRANGLER_SEND_METRICS=false node scripts/smoke.mjs
                                      About to apply 77 migration(s); SMOKE PASS; " 500 " lines: 0; exit 0
```

```
scripts/smoke.mjs            617271  b23860d38a231723
TAIL });
src/console.ts               100390  d3b7deecdf3247e9
TAIL }
test/console.test.ts          60125  17ec0838d07aeca7
TAIL });
```
