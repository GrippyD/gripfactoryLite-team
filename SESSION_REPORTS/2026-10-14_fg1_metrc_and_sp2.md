# FG1 from METRC, and SP2 BTR (2026-10-14)

Worktree `branches/GFLiteMetrcAPI`. Pin before the first edit, canon's hash in `app/` (Linux two-space `sha256sum`, `wrangler.toml` already LF): `6e8ea44ae71f43ec`, 382 files. Final tree `cc402a06f6b7bd6f`, 382 files. No git. Nothing committed, pushed, or deployed. No migration. `canon/` was not edited.

## What landed

PART A. `FG_LEDGER_SQL` reads live `metrc_packages` (`gone_at` null, category `Shake/Trim`, quantity above 0), every license. Prefix `SHA` is SHAKE; every other prefix is TRIM. Grams: `g` as is, `kg` times 1000, `lb` times 453.59237. Any other unit is left out and counted. Strain is `item_strain` when set, else the item name's second ` - ` field. THC is the latest compliance sample on the tag, else the latest internal test. `buildFgInventory` is unchanged. The note under TRI and SHA names the newest packages mirror mount. Categories still render at 0.00.

PART B. A BTR column in the Harvested group, after Dry lb per plant, one decimal and a percent sign. The label is BTR in EN and ES (the key was already both). Each row pools `TRIM_SEASON_SQL` packages of its own lots through `weightedBtrToDate` and `parseBtrTypeCodes`. A row with no package is blank. The Total is that same function on the whole season read, so it matches Weighted BTR to date. `/harvest` reuses the rows the console already loaded.

## Files

| file | bytes | sha256 |
| --- | ---: | --- |
| `app/src/fginventory.ts` | 22849 | `69278b12c1200c14` |
| `app/src/i18n.ts` | 330053 | `3fae05711c5af020` |
| `app/src/strainperformance.ts` | 21639 | `b13c66ea2231a7ff` |
| `app/src/console.ts` | 171887 | `f1dd2e3184a6d47b` |
| `app/src/index.ts` | 189002 | `34f87f8aafb099dd` |
| `app/test/fginventory.test.ts` | 25267 | `c1fde525b9f52c79` |
| `app/test/strainperformance.test.ts` | 28638 | `7ef1b46ab225f0da` |
| `app/scripts/smoke.mjs` | 883937 | `3978d1d176763cc5` |

`npm run typecheck` rewrote `worker-configuration.d.ts`. It is outside the tree hash.

## Gates

`npm run typecheck`: exit 0.

Vitest, `TZ=UTC` and `TZ=America/New_York`: 110 files, 1559 passed, 6 skipped.

`node --check scripts/smoke.mjs`: exit 0.

From-zero smoke: `About to apply 102 migration(s)`, both `/harvest` reads 200, `SMOKE PASS`. No 500 in the log.

Dash and CR on the eight files: 0 em dash, 0 en dash, 0 CR.

Rendered `/harvest` with both sections open at 1920 and 820 in Lite, CO, and Cerberus. TRI 2.00 lb (Fg1 Gelato), SHA 1.27 lb (Donny Burger 0.27 and Fg1 Lemon 1.00), the METRC note under SHA, After Party BTR 75.0%. The page did not grow wider than the viewport. The strain table scrolls inside its section.

## For the gate

The Total includes a trim package on a lot the pane does not list (still weighing). That is what makes it equal Weighted BTR to date. A row only pools its own lots.

Only `g`, `kg`, and `lb` convert. Another spelling, including `Grams`, is counted in the other-units line. That line is shown even at 0.

The mount time is the newest `metrc_mounts` row with kind `packages`, not a plants mount.

The live-data bench was not run here. Smoke's `/harvest` was 198 ms and 225 ms on the smoke database.
