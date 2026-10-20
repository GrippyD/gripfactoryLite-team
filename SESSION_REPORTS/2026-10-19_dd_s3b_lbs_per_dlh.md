# DD S3b: Lbs/Labor Hour vs Goal (2026-10-19)

Worktree `branches/GFLiteMetrcAPI`. Tree received `38503ff1bcd775ae` (the S3a hand-back, 394 files). Tree left `14b04627b5cc68e6`, 395 files. No git. Nothing is committed, pushed, or deployed. `canon/` and `prompts/` were not edited. `harvest.wet_lb_per_dlh` was not touched.

`src/ddsnapshot.ts` and `test/ddsnapshot.test.ts` also carry the S3a trend fix that skips empty days (leastSquaresAt). That fix was in those files while this slice was built. It is left in place.

## What an operator sees

On the bizops wall, Lbs shipped is gone. In its slot is `bizops.lbs_per_dlh`, titled Lbs/Labor Hour vs Goal (ES Libras por hora de mano de obra vs meta), badge v1, no question mark. A period select (7, 14, 30, HTD, default 14, remembered in localStorage) drives the headline: the window's summed wet pounds over its summed hours, as `39.3 lb/DLH` on the smoke floor. Under it: Goal 26 and the gap (`13.3 over` in the theme's good color when the figure meets the goal, the warning color when it is under). A day with wet pounds and no hours still adds its wet pounds, and the tile says how many such days are in the window. A window with no hours says No hours typed. The chart is an inline SVG area chart, one point per day that has a ratio, a gap where hours are missing, today's point hollow and named so far on hover. The goal is a dashed line labeled Goal 26. A help line under the chart says the wet pounds include toll lots. Admin, Director Dashboard has Recompute dashboard series behind the Admin PIN. The hourly cron (`15 * * * *`) refreshes this series beside Lbs Harvested. The wall only reads.

The goal is the `dd_targets` row in force on the farm today. Migration 0107 seeds 26 from 2026-09-01. A later row from the targets form takes over on its date.

## Files

| file | bytes | sha256 |
| --- | ---: | --- |
| app/migrations/0107_dd_lbs_per_dlh.sql | 2123 | 30fec3105f7f71e4 |
| app/src/ddsnapshot.ts | 41688 | 5aba4843d5784311 |
| app/src/directorregistry.ts | 106372 | e5788138c12a0115 |
| app/src/director.ts | 94670 | b0665fe8d98cec29 |
| app/src/index.ts | 197008 | 156fac149256be14 |
| app/src/theme.ts | 232846 | a04d08b559910193 |
| app/src/i18n.ts | 369878 | e86ba598c52f9c37 |
| app/test/ddsnapshot.test.ts | 26992 | cee013b8ae2746a4 |
| app/test/director.test.ts | 97347 | c56b7bfdb798a9c4 |
| app/scripts/smoke.mjs | 901616 | 2fe96714eea3c395 |

Dash and CR scan of those ten files: U+2013 0, U+2014 0, CR 0. The new migration, `ddsnapshot.ts`, and `ddsnapshot.test.ts` name nobody. Name hits in `index.ts`, `theme.ts`, `i18n.ts`, `director.test.ts`, and `smoke.mjs` are text those files already carried.

`bizops.lbs_per_dlh` uses `stale_after_hours` 30, the same window as the other daily app rows. The brief did not name a season, so the tile is in season all year.

## Gates

Typecheck: `npx tsc --noEmit` exit 0.

Vitest TZ=UTC:

```
Test Files  113 passed (113)
Tests  1633 passed | 6 skipped (1639)
```

Vitest TZ=America/New_York:

```
Test Files  113 passed (113)
Tests  1633 passed | 6 skipped (1639)
```

`node --check scripts/smoke.mjs` exit 0.

From-zero smoke: exit 0, about 205 s. `About to apply 106 migration(s)`. `SMOKE PASS`. Lines containing ` 500 `: 0. Lines containing ` 503 `: 1 (`POST /api/send`, the smoke's own step). The hourly passes logged `[lbs per dlh] wrote 1 rows`, then `0`, then `1`, then `0`. The Recompute button logged `wrote 3 rows`. The wall showed Lbs/Labor Hour vs Goal, v1, a headline, Goal 26, and the chart. Lbs shipped was absent.

Browser, on the smoke database, Cerberus, Lite, and CO. At 1920 the tile spans two columns and the page scroll width equals the client width. At 820 and on the phone (390, `device-phone`) the tile is full width and the page does not scroll sideways. Each theme had 7, 14, 30, and HTD drawn. A hover read `Monday, Oct 19. 39.33 lb/DLH. 314.68 lb. 8 h. so far`. The gap `13.3 over` used the theme good token: Lite rgb(47, 93, 58), CO rgb(127, 180, 148), Cerberus rgb(84, 183, 116). The chart stroke used the theme accent: Lite rgb(79, 107, 74), CO rgb(200, 138, 60). The smoke floor has one ratio day, so that chart is the hollow today point and the goal line. The unit test covers a multi-day area and a gap.

## Declined

The brief's smoke line says 107 migrations. This tree has no `0101`, so 0107 is the 106th file. Smoke expects 106, which is what wrangler printed.

There is no live-data bench in this worktree, so there is no floor timing and no check of three days against the live `/harvest` Lbs/DLH box.

## Close

Tree left `14b04627b5cc68e6`. Nothing is committed, pushed, or deployed. The Scribe gates. The owner merges. This slice carries migration 0107, so the merge block takes a snapshot first.
