# DD S3a: Lbs Harvested (2026-10-19)

Worktree `branches/GFLiteMetrcAPI`. Tree received `130ef9e8bbf10220` (PS2 live). Tree left `38503ff1bcd775ae`, 394 files. No git. Nothing is committed, pushed, or deployed. `canon/` and `prompts/` were not edited. `harvest.wet_weight_lb` was not touched.

## What an operator sees

The bizops tile `bizops.lbs_processed` is titled Lbs Harvested (ES Libras cosechadas), badge v2, no question mark. The headline is the harvest year's wet pounds (grams over 448, HTD), and it does not follow the period pick. Under it: the first stored day through the farm today, a period select (7, 14, 30, HTD, default 14, remembered in localStorage), an inline SVG bar chart with a dashed trend line when at least three complete days are in the window, a tooltip with the farm split, and a link to `/harvest#strain-performance`. The Strain Performance section has that id and opens when the hash names it. Admin, Director Dashboard has Recompute Lbs Harvested behind the Admin PIN. The hourly cron (`15 * * * *`) refreshes the series. The wall only reads.

A tote change moves the farm row and that day's total, so the refresh supersedes two rows and inserts two. A day that drops to zero is restated as 0.

## Files

| file | bytes | sha256 |
| --- | ---: | --- |
| app/migrations/0106_dd_lbs_harvested.sql | 1074 | 5728016b94c4af6c |
| app/src/ddsnapshot.ts | 20354 | 19779c81454733d0 |
| app/src/directorregistry.ts | 105051 | 746553c3d06dedfc |
| app/src/director.ts | 93571 | a5aacb43e2c75f4c |
| app/src/index.ts | 196640 | d933075a1c3e9fee |
| app/src/strainperformance.ts | 21663 | 2db2f72c2967bacf |
| app/src/console.ts | 172420 | 6d9c9018c9701b9e |
| app/src/theme.ts | 231263 | b828c859e237bad5 |
| app/src/i18n.ts | 368926 | 2a522f8963a5b513 |
| app/test/ddsnapshot.test.ts | 14960 | 21924876b91fb47b |
| app/test/director.test.ts | 93470 | ef3b933119a86c2e |
| app/test/console.test.ts | 98865 | cc73d3af1639405f |
| app/test/strainperformance.test.ts | 28662 | d6f313fa2f22fbd6 |
| app/scripts/smoke.mjs | 899344 | 20577ed16e88aac7 |

Dash and CR scan of those fourteen files: U+2013 0, U+2014 0, CR 0. `dd_processed_lbs_buckets` stays in the config lists because the question row and the registry tests still read it.

## Gates

Typecheck: `npx tsc --noEmit` exit 0.

Vitest TZ=UTC:

```
Test Files  113 passed (113)
Tests  1629 passed | 6 skipped (1635)
```

Vitest TZ=America/New_York:

```
Test Files  113 passed (113)
Tests  1629 passed | 6 skipped (1635)
```

`node --check scripts/smoke.mjs` exit 0.

From-zero smoke: exit 0. `About to apply 105 migration(s)`. `SMOKE PASS`. Lines containing ` 500 `: 0. Lines containing ` 503 `: 1 (`POST /api/send`, the smoke's own step). The hourly passes logged `[lbs harvested] wrote 2 rows`, then `0`, then `4`, then `0`. The Recompute button logged `wrote 0 rows` because the cron had already stored the same values, and the wall tile showed the headline and bars.

Browser, on the smoke database: CO at 1920 (span 2, scroll width equal to client width), CO at 820 (full width, no sideways scroll), phone at 390 (full width, no sideways scroll). Periods 7, 14, 30, and HTD each drawn once. The headline stayed 302.56. A bar click showed `Monday, Oct 19. 302.56 lb. PNN 301.95, PNS 0.24, ARL 0.37. 30 totes. so far`. Lite bar color rgb(79, 107, 74), Cerberus rgb(241, 194, 50), both the theme tokens. Cerberus at 1920 spans two columns and at 820 is full width, no sideways scroll. `/harvest#strain-performance` opens that details section.

## Declined

The brief's smoke line says 106 migrations. This tree has no `0101`, so 0106 is the 105th file. Smoke expects 105, which is what wrangler printed.

There is no live-data bench in this worktree, so there is no floor timing and no check of the HTD headline against the live `/harvest` year wet figure.

## Close

Tree left `38503ff1bcd775ae`. Nothing is committed, pushed, or deployed. The Scribe gates. The owner merges. This slice carries migration 0106, so the merge block takes a snapshot first.
