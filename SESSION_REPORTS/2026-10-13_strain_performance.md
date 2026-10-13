# 2026-10-13 SP1: Strain performance on the Harvest Console

BRIEF SP1 `BRIEFS/2026-10-13_strain_performance.md`, built in `branches/GFLiteMetrcAPI`. The pin was checked before the first edit. Canon's hash command in `app/` (files under `src`, `test`, `scripts`, `migrations`, plus `wrangler.toml` read as LF, `tsconfig.json`, and `package.json`; Linux two-space `sha256sum` form) read `e57aea288fdafeda`, 363 files. No git. Nothing committed, pushed, or deployed. No migration. `canon/` was not edited.

## What was built

The Harvest Console has a new section between Plants and Drying: `<details class="hc-section" data-hc-section="strain_performance">`, closed on a first visit, summary "Strain performance" with the harvest year beside it the way Plants shows it. It reads the console's harvest year and the console's day.

One row per strain and farm, sorted by strain then farm, then a Total row. The strain is the market strain when one is typed, otherwise the real strain. A row appears when that pair has a finished lot this harvest year or live plants in METRC.

Harvested lots are Grip's own lots of the year whose status is not weighing, with tests left out (`b.is_test = 0`, the same cut the console uses today). Columns: Lots, Plants harvested (the counts typed on the lots), Wet lb, Dry lb (a finished unload and a dry weight; `w.dry_weight_grams`, otherwise the sum of live `dry_weights`), Drying lb forecast, Harvested dry lb (dry plus the forecast), Dry lb per plant (dry pounds of the unloaded lots that carry a plant count, over those plants; blank when none).

The drying forecast is the wet pounds of lots not yet unloaded times a dry-down pooled by weight: that strain and farm's unloaded lots, else that strain across farms, else the season. One muted line under the table names that method. A lot still drying with no rate anywhere leaves the forecast blank. Nothing is invented in its place.

Unharvested: Plants remaining are live METRC plants (`gone_at IS NULL AND harvested = 0`) under the farm's licenses, grouped once by license and strain. Names match trimmed and case blind. Est. dry lb per plant is the field estimate in force on the console's day for that strain and farm. Est. date is its effective date. Remaining dry lb is plants times that estimate. An older estimate stands. A later one waits.

A row with plants remaining and no estimate in force shows "no estimate" and a blank Remaining dry lb. It is left out of the Remaining total. A line under the table counts those strains and their plants.

Season dry lb is Harvested dry lb plus Remaining dry lb, on each row and on the Total. Pounds are the app pound (448 g). Per plant figures use two decimals. Other pound figures are whole pounds, round half up, with thousands commas.

Field estimates are labeled "dry lb per plant (448 g)" in both languages. The help line is "Hand entered dry pounds per plant at 448 g. The number is stored as typed." Stored values are unchanged.

Plants and Drying are unchanged. The year's lots are one read. Live plants are one grouped read. Estimates come from `estimatesAsOf`. No per-strain query, no scan of `sensor_readings`. The table sits in the report scroll box, so a narrow page scrolls inside the section.

## Files

| file | bytes | sha256 (16) | what |
|---|---|---|---|
| `app/src/strainperformance.ts` | 19,026 | `1f3d7e2f951e7b2e` | the reads, the grain, the section |
| `app/src/console.ts` | 171,538 | `0d2019c5387a589a` | the section between Plants and Drying |
| `app/src/index.ts` | 188,572 | `ae69a3bbc444e8b9` | the load on `/harvest` |
| `app/src/i18n.ts` | 328,634 | `1d0752ce1c6ce717` | EN and ES, and the new estimate label |
| `app/src/fieldestimates.ts` | 14,488 | `610834d5f2c1b068` | the label and the help line |
| `app/test/strainperformance.test.ts` | 19,489 | `019d6f616d2c9b5e` | the grain, the forecast, the estimate, the loader |
| `app/test/console.test.ts` | 98,058 | `1cd55acecb1b0425` | the section's place and the closed default |
| `app/test/fieldestimates.test.ts` | 18,330 | `62e273f1c58c5bb9` | the new label |
| `app/scripts/smoke.mjs` | 859,582 | `af7eed162a0fb3f2` | the section, and plants times the estimate |

`npm run typecheck` rewrote `worker-configuration.d.ts`. That file is outside the tree hash and is not part of this slice.

## Sealed final check

```
THE TREE                              4e7574065f1b96cf (365 files), on the pin e57aea288fdafeda (363 files)
npm run typecheck                     exit 0
TZ=UTC npx vitest run                 106 files, 1530 tests passed
TZ=America/New_York npx vitest run --fileParallelism=false
                                      106 files, 1530 tests passed
node --check scripts/smoke.mjs        exit 0
CI=1 SMOKE_PORT=9498 npm run smoke    About to apply 100 migration(s); SMOKE PASS; exit 0; " 500 " lines: 0
dash audit (by character): 0; CR audit: 0; personnel names: none
```

The UTC vitest line:

```
 Test Files  106 passed (106)
      Tests  1530 passed (1530)
```

The Eastern vitest line, one file at a time:

```
 Test Files  106 passed (106)
      Tests  1530 passed (1530)
```

Two earlier Eastern runs with the default parallel workers hit the 5 second cap on unrelated tests (`migratedDb` under load: sensor history, lab import, Metrc eval, the sweep, then unfinish). Those files are not in this slice. The same suite under UTC passed all 1530, and the Eastern run above passed all 1530.

The passing smoke's apply line and pass line: `About to apply 100 migration(s)` and `SMOKE PASS`. `GET /harvest` answered 200 with the section. Four live After Party plants on PNN's license, with the seeded 2.50 lb per plant estimate in force, gave Remaining dry lb 10. A harvested plant and a gone plant stayed out of the count.

Rendered with the section open, Lite, CO, and Cerberus. Cells are `nowrap`. No cell overlapped the next. The page itself did not scroll. The table scrolled inside the section:

| view | width | section client | table scroll |
|---|---|---|---|
| Lite | 1920 | 1386 | 1753 |
| Lite | 820 | 782 | 1753 |
| CO | 1920 | 1386 | 1716 |
| CO | 820 | 782 | 1716 |
| Cerberus | 1920 | 1386 | 1897 |
| Cerberus | 820 | 782 | 1897 |

## After the deploy (owed to no one outside)

Nothing to anyone outside. No field estimate is entered yet, so on the live floor every remaining row reads "no estimate" until the owner enters dry pounds per plant. This session did not deploy.
