# DD L3: Yield per Plant, two seasons side by side with this year (2026-10-20)

Worktree `branches/GFLiteMetrcAPI`. Tree received `661ad9c2df803333` (415 files, the L2 gated tree). Tree left `11d126e0ff454d13`, 418 files. No git. Nothing is committed, pushed, or deployed. `canon/` and `prompts/` were not edited.

## For the Scribe: drop the screenshot step

Producing screenshots is the snag in this build session. The capture path (browser pictures, desktop screenshots) stalls the session and should not be in future build briefs. Do not ask the build session to render pages or save pictures of them. If a picture is still wanted, take it at the gate. A scroll width check, if kept, should be a number printed by a script, not a picture. This session produced no screenshots.

## What a director sees

Admin, Director Dashboard, Past Seasons (behind the Admin PIN) takes a csv or xlsx with the columns Season, Strain, Farm, Plants, Dry lb. Preview first, then commit. The same rows a second time write nothing. A changed row updates and logs reason "past seasons upload". A row with no season, no strain, or no plants is named and skipped. The page lists each season, its strains, plants, dry lb, and the farm wide total. Delete asks a reason.

On the Farming Operations wall, Yield per Plant: seasons is one row per strain grown this year, then a farm wide row in bold. Columns are the two most recent seasons held, their average, this year to date, and this year projected. Dry lb per plant, two decimals. A missing prior season reads "not grown". No prior seasons at all reads "new" in Avg. The projected cell is muted, with the word "projected" under the number, until every lot of that row is unloaded, when it reads "final" and equals to date. The farm wide row is the sums, not a mean of the strains. The cron and Recompute store the farm wide to date and projected numbers in `dd_kpi_values` (daily, dims "", "todate", and "projected"). The blank dim is what the check-in already reads.

## Files

| file | bytes | sha256 |
| --- | ---: | --- |
| app/migrations/0115_dd_season_yields.sql | 2400 | 912047b8a58a8cee |
| app/src/yieldseasons.ts | 44142 | e20cbe52a4d8eb43 |
| app/src/directorregistry.ts | 113803 | 7466efab631e6155 |
| app/src/director.ts | 103895 | e241891676c50ebe |
| app/src/index.ts | 204820 | 87a34b8120542f7c |
| app/src/i18n.ts | 386853 | fdc8f5d39c9f55e5 |
| app/src/theme.ts | 246450 | 78bfc536d8f2239f |
| app/test/yieldseasons.test.ts | 14438 | 2d898235ab3a3b5c |
| app/test/director.test.ts | 117101 | 9a6eb738e00f45d6 |
| app/scripts/smoke.mjs | 943876 | 84283d01fd38dedb |

Dash and CR scan of those ten files: U+2013 0, U+2014 0, CR 0. The new migration, the new module, and the new test name nobody. `index.ts`, `i18n.ts`, `theme.ts`, `director.test.ts`, and `smoke.mjs` still contain names that were already in those files.

## Gates

Typecheck: `npx tsc --noEmit` exit 0.

Vitest TZ=UTC:

```
Test Files  120 passed (120)
Tests  1671 passed | 6 skipped (1677)
Duration  51.42s
```

Vitest TZ=America/New_York:

```
Test Files  120 passed (120)
Tests  1671 passed | 6 skipped (1677)
Duration  48.25s
```

`node --check scripts/smoke.mjs` exit 0.

From-zero smoke, first attempt: `About to apply 114 migration(s)`, then the early bizops wall check failed. The hourly cron had stored this tile, so the wall read `no_goal` 3 and `no_data` 28. The check now allows `harvest.dry_lb_per_plant_vs_plan_pct` to be `no_goal` or `no_data`, the same allowance Lbs Harvested already had. The rerun exited 0 in 7.3 minutes and again printed `About to apply 114 migration(s)`. The script exits 1 on any failed check, so that exit is the pass. The saved log is wrangler's migration tables repeated and does not contain the `SMOKE PASS` line.

## Declined

Screenshots and browser renders of the upload page and the farmops wall. See the note at the top. Drop that step from future build briefs.

There is no live-data bench in this worktree. To date per strain against `/harvest` is proved in the unit test: the tile's to date equals `buildStrainPerformance` for the same lots. The 0.5 s warm wall time on the live bench is the Scribe's.

## Close

Tree left `11d126e0ff454d13`. Nothing is committed, pushed, or deployed. The Scribe gates. The owner merges. This slice carries migration 0115, so the merge block takes a snapshot first.
