# 2026-10-02 Assumed Dry and Estimated Bud

BRIEF V22, ASSUMED DRY AND ESTIMATED BUD (canon 0.30.356), built in the worktree `branches/GFLiteOpsDashboard` under THE DISPATCH RULE (canon 0.30.155). The app tree on disk before the first edit hashed `4047f0ef84ba0ae2` (269 files). The app tree after these edits hashes `44d5aa43a1903380` (269 files). No migration. The smoke pin stays 89. Not deployed. Nothing committed. Nothing pushed. No git was run.

## What changed

- Under Harvest Year Total on each farm box, and under it on Total: Assumed Dry and Estimated Bud. Each is `hc-metric`, keys `assumed_dry` and `estimated_bud`, pounds at 448 g with two decimals and thousands commas. No grams line on these two.
- The line under a farm's Assumed Dry is "at {pct}% dry-down" (one decimal) or "no dry-down yet". Under Estimated Bud, "at {pct}% BTR" or "no BTR yet". Under both on Total, "the three farms".
- The figures are the harvest year's. `?day=` does not change them.
- EN and ES for the two labels, the four lines, and "the three farms".

The set is the year's lots (`wet_weight_entries` and `harvest_batches`, both `deleted_at IS NULL`) whose `farm_code` is PNN, ARL, or PNS. A lot with status `frozen`, or sitting in a freezer space, is out of both figures. Total adds the three farms' grams. It does not take a new ratio over the pooled lots.

Dry-down is the dry grams over the wet grams of the farm's unloaded and trimmed lots whose dry weight is above zero. Wet is `wet_weight_entries.weight_grams`, the lot total, including what a weighing lot has so far. Assumed Dry adds that dry weight to the dry-down times the wet weight of lots still in `weighing`, `in_transit`, or `drying`. With no dry-down, that projection is left out.

BTR is the bud-type trim grams over all trim grams on the farm's trimmed lots. Bud types are `parseBtrTypeCodes` (seeded BUD, SMALLS, SHAKE). Trim packages are `wip_packages` under `NON_TRIM_SOURCE_SQL`, `deleted_at IS NULL`. Estimated Bud adds those bud grams, for every lot still in the set, to the BTR times two projections: the projected dry of the lots not yet unloaded, and each unloaded lot's dry weight less the grams of all its trim packages so far, never below zero. With no BTR, that projection is left out and the packages already weighed stay in the figure.

A comment at that sum says flower is counted once at the trim room (BUD, SMALLS, SHAKE as WBP, WPR, SHA). When pasteurization's conversion comes into the app, a finished package replaces its WIP parent in the sum.

## The floor, db_backups/20261002-171419_pre_cure_bar

Harvest year 2026. `btr_type_codes` is `BUD,SMALLS,SHAKE`. 86 lot rows: 15 deleted, 3 whose batch is deleted, 68 on a live 2026 batch. Three of those sit in Blast Freezer(s) (`space_type` freezer) and are out: two PNN lots also status frozen (339,754 g and 230,864 g wet) and one PNN lot still drying (338,480 g wet). The 65 lots below are the set.

| Farm | Lots | Dry-down lots | Not yet unloaded | Unloaded | Trimmed | Dry-down | Assumed Dry | BTR | Estimated Bud |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| PNN | 26 | 24 | 2 drying | 21 | 3 | 24.1% | 26,027,052.16 g, 58,096.10 lb | 26.0% | 6,983,658.12 g, 15,588.52 lb |
| ARL | 13 | 13 | none | 13 | 0 | 21.8% | 18,545,475 g, 41,396.15 lb | none | 5,274,425 g, 11,773.27 lb |
| PNS | 26 | 18 | 1 weighing, 7 drying | 16 | 2 | 22.7% | 48,655,389.00 g, 108,605.78 lb | 36.1% | 17,227,906.17 g, 38,455.15 lb |
| Total | 65 | | | | | the three farms | 93,227,916.16 g, 208,098.03 lb | the three farms | 29,485,989.30 g, 65,816.94 lb |

ARL has unloaded lots and bud packages, and no trimmed lot, so Estimated Bud is those packages and the line is "no BTR yet". The pounds are what the page renders (`formatLbs` at 448).

## Assumptions for his word

- The brief names `dry_spaces.kind = 'freezer'`. The freezer flag on this schema is `space_type` (canon 0.30.106). Blast Freezer(s) has `kind` silo and `space_type` freezer. The query treats a row as a freezer when either column reads freezer, so the three lots in that space are out.
- A lot's wet total is `wet_weight_entries.weight_grams`.
- Trimmed lots join unloaded lots in the dry-down. A farm with neither has no dry-down. A trimmed lot with no unloaded lot still has one.
- The BTR denominator is the trim package grams on trimmed lots. An unloaded lot's unrecorded dry (dry less packages, never below zero) is projected inside Estimated Bud. A trimmed lot does not project a remainder.
- With no BTR, the projection is left out and the bud packages already weighed remain in Estimated Bud.
- Total's line is "the three farms" on both figures.
- Spanish: Seco asumido, Cogollo estimado, "al {pct}% de seco", "sin porcentaje de seco aun", "al {pct}% BTR", "sin BTR aun", "las tres granjas".

## Gates

Run in the worktree's `app/`.

- `npm run typecheck`: exit 0.
- `npx vitest run`: 79 files, 1060 tests passed under `TZ=UTC`, and 79 files, 1060 tests passed under `TZ=America/New_York`.
- `node --check scripts/smoke.mjs`: exit 0.
- From-zero smoke (`SMOKE_PORT=9366`, `WRANGLER_SEND_METRICS=false`, `CI=1`, `TZ=UTC`): About to apply 89 migration(s), SMOKE PASS, no ` 500 ` line, exit 0 (18070 lines of log; the one ` 503 ` line is `POST /api/send`).
- Dash audit: 0 on the four files (U+2014 and U+2013). No CR byte on them. No key, secret, or password value. No personnel name.

## Deploy

Not deployed from this session. Nothing committed. Nothing pushed. No git was run.

## Sealed final check

```
the tree as received                 4047f0ef84ba0ae2 (269 files; checked before the first edit)
npm run typecheck                     exit 0
TZ=UTC npx vitest run                 79 files, 1060 tests passed
TZ=America/New_York npx vitest run    79 files, 1060 tests passed
node --check scripts/smoke.mjs        exit 0
SMOKE_PORT=9366 WRANGLER_SEND_METRICS=false CI=1 TZ=UTC node scripts/smoke.mjs
                                      About to apply 89 migration(s); SMOKE PASS; " 500 " lines: 0; " 503 " lines: 1 (POST /api/send); exit 0
dash audit: 0; CR audit: 0; secret values: none; personnel data: none
the app tree after the edits             44d5aa43a1903380 (269 files)
```

```
app/src/console.ts                        160979  44ef24886597f7f9
TAIL }
app/src/i18n.ts                           210063  78bd7ed5d06c99a0
TAIL }
app/test/console.test.ts                   80643  d4047de13dc98e4d
TAIL });
app/scripts/smoke.mjs                     733148  7caf2e4ae5d9adff
TAIL });
```
