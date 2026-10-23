# DD L1: Logan's wall, the moves and Silo Utilization (2026-10-20)

Worktree `branches/GFLiteMetrcAPI`. Tree received `1c1672f779290674` (408 files, the TL1 gated tree). Tree left `d0ace1b4f1fb0994`, 411 files. No git. Nothing is committed, pushed, or deployed. `canon/` and `prompts/` were not edited.

## What a director sees

On the Farming Operations wall, BTR, Trim Throughput, and Trim throughput and lbs per DLH are gone. They stay on Business Operations (BTR also stays on Cultivation and Technology). The old capacity row is Silo Utilization, v2, farmops only. Harvest Schedule no longer says "(plan rows)". PPP dry and PPP wet are unchanged. Field Task Productivity is the last daily tile on the farmops wall.

Silo Utilization says "Silos with material in them, each day of the harvest" and links Drying Operations to `/ops/drying_ops`. The chart is one bar per farm day, height the count of active silos on a 0 to 5 axis. A hover or tap prints the date, the count, and which silos were active. What ran lists Silo 1 to Silo 5 with loaded date, unloaded date or "still in", the lot, the market strain, and wet lb at 448. On the phone the chart is the last 30 days until "whole harvest" is checked, and What ran starts collapsed. Until a task row exists, Field Task Productivity is one muted line and shows no series number.

## Files

| file | bytes | sha256 |
| --- | ---: | --- |
| app/migrations/0113_dd_silo_utilization.sql | 2126 | 9c2e51884efae99e |
| app/src/siloutilization.ts | 17387 | 7a1165bcffddf331 |
| app/src/ddsnapshot.ts | 62574 | 4549b5ccb4527a75 |
| app/src/director.ts | 100126 | 8bf75f6e76cae81d |
| app/src/directorregistry.ts | 112292 | 08c07ab8c3c3829a |
| app/src/index.ts | 200263 | 789bd5473ddf7aa2 |
| app/src/i18n.ts | 379760 | ab4297835936908c |
| app/src/theme.ts | 241470 | 77021e187ffd84ba |
| app/test/director.test.ts | 114609 | c5c2468b84789bcf |
| app/test/trimthroughput.test.ts | 11806 | 605e63ce56fb0f79 |
| app/test/siloutilization.test.ts | 13136 | 93f57ff2062ee935 |
| app/scripts/smoke.mjs | 930963 | 138c0e72833192e3 |

Dash and CR scan of those twelve files: U+2013 0, U+2014 0, CR 0. The new migration and the new tile code name nobody.

## Gates

Typecheck: `npx tsc --noEmit` exit 0.

Vitest TZ=UTC:

```
Test Files  118 passed (118)
Tests  1661 passed | 6 skipped (1667)
Duration  37.45s
```

Vitest TZ=America/New_York:

```
Test Files  118 passed (118)
Tests  1661 passed | 6 skipped (1667)
Duration  36.69s
```

`node --check scripts/smoke.mjs` exit 0.

From-zero smoke: exit 0, about 320 s. `About to apply 112 migration(s)`. `SMOKE PASS`. The recompute log includes `[silo utilization] wrote 13 rows`. The farmops wall showed Silo Utilization v2, counts 1, 2, and 1 across the three seeded days, the two What ran rows (26041 Silo Alpha 10.00 lb, 26042 Silo Beta 20.00 lb still in), the Drying Operations link, and the Field Task Productivity empty line. Trim Throughput, BTR, and Trim throughput and lbs per DLH were absent from farmops and present on bizops.

Browser, on the smoke database, after the smoke had also closed and added later silo loads. Layout measured in the page (document scroll width equals client width, tile scroll width equals client width). Hover on a bar set the tip to "Sunday, Oct 18. 2026-10-18. 1. Silo 1".

| view | width | scroll | chart |
| --- | ---: | --- | --- |
| Grip (Cerberus), computer | 1920 | 1905 = 1905 | whole harvest |
| Grip, computer | 820 | 805 = 805 | whole harvest |
| Grip, phone | 390 | 390 = 390 | last 30, What ran collapsed; whole harvest checked still 390 = 390 |
| Lite, computer | 1920 | 1905 = 1905 | whole harvest, same hover tip |
| Lite, computer | 820 | 805 = 805 | whole harvest |
| Lite, phone | 390 | 390 = 390 | last 30, What ran collapsed |
| CO, computer | 1920 | 1905 = 1905 | whole harvest, same hover tip |
| CO, computer | 820 | 805 = 805 | whole harvest |
| CO, phone | 390 | 390 = 390 | last 30, What ran collapsed, same hover tip |

The screenshot call timed out, so there are no image files. The phone series in this database is 3 days, so the last-30 chart and the whole-harvest chart hold the same three bars. The unit test covers a 40 day model (30 bars and 40 bars).

## Declined

There is no live-data bench in this worktree. The refresh time and the Oct 1 and Oct 15 counts against the silo pages are the Scribe's.

## Close

Tree left `d0ace1b4f1fb0994`. Nothing is committed, pushed, or deployed. The Scribe gates. The owner merges. This slice carries migration 0113, so the merge block takes a snapshot first. L1 to L4 go out in one push.
