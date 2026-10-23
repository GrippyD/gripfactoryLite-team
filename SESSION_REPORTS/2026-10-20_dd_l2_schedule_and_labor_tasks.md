# DD L2: the Harvest Schedule and Labor Task Completion (2026-10-20)

Worktree `branches/GFLiteMetrcAPI`. Tree received `d0ace1b4f1fb0994` (411 files, the L1 gated tree). Tree left `8238c2f80573117e`, 415 files. No git. Nothing is committed, pushed, or deployed. `canon/` and `prompts/` were not edited.

## What a director sees

On the Director Dashboard home, each department's check-in sits beside Harvest Schedule and Labor tasks. The harvest plan form (`/admin/director/harvest-plan`) adds, edits, and deletes a row (delete asks a reason) and stamps Done. A harvest batch of that strain and farm cut on or after the planned date clears the row on its own and the form says "cut Oct 22, HBN ...". Rows done more than 14 days ago wait behind "show done".

The labor form (`/admin/director/labor-tasks`) adds a task and, on each open task, saves a percent and an as-of date into the task and a log row. Saving 100, or Close, closes the task. Closed tasks wait behind "show closed".

On the Farming Operations wall, Harvest Schedule lists the date in words, the strain, the farm, and the plants, sorted by planned date. The default list is overdue rows plus the next 21 days. "all" shows every open row. Done rows leave the list. A past date that is not done reads "overdue". Under the list: "N strains, M plants planned in the next 21 days". Nothing typed says "No upcoming harvests entered" and links to the form.

Labor Task Completion draws one bar per open task. The fill is the percent. A marker sits at the share of time elapsed from the start to the expected date. The bar is on track at or above that share less 5 points, behind under that, and overdue when today is past the expected date and the task is under 100. Sort is overdue, then behind, then on track, then by expected date. Under the rows: "K of N on track". Hover or tap shows the last five log lines, newest first. The cron and Recompute write the share of open tasks on track to `dd_kpi_values` (daily, dim "all").

A test batch (`harvest_batches.is_test = 1`) does not count a silo active and does not list under What ran. A real load beside it still counts.

## Files

| file | bytes | sha256 |
| --- | ---: | --- |
| app/migrations/0114_dd_harvest_plan_and_labor_tasks.sql | 3595 | 2c354614b57b348d |
| app/src/harvestschedule.ts | 24328 | 880c0a5de893db4c |
| app/src/labortasks.ts | 23292 | 28b075389528e630 |
| app/src/siloutilization.ts | 17730 | d9bed9b545e22f61 |
| app/src/ddsnapshot.ts | 62624 | 5f287cbf72d76095 |
| app/src/directorregistry.ts | 112842 | c821d1c9666425d6 |
| app/src/director.ts | 102756 | 77ee59eeff6dab66 |
| app/src/index.ts | 203063 | e6b28f1bc6ac5f68 |
| app/src/i18n.ts | 384146 | e516686a937b294b |
| app/src/theme.ts | 244531 | 02beb6fe7b964a52 |
| app/test/director.test.ts | 115826 | c959c93097390b26 |
| app/test/siloutilization.test.ts | 14573 | c575d46766cff0c6 |
| app/test/ddschedule.test.ts | 17741 | b798f0215285d209 |
| app/scripts/smoke.mjs | 937686 | 0c5f7e38a6376523 |

Dash and CR scan of those fourteen files: U+2013 0, U+2014 0, CR 0. The new migration, the new modules, and the new tests name nobody. `index.ts`, `theme.ts`, and `smoke.mjs` still contain names that were already in those files.

## Gates

Typecheck: `npx tsc --noEmit` exit 0.

Vitest TZ=UTC:

```
Test Files  119 passed (119)
Tests  1667 passed | 6 skipped (1673)
Duration  60.87s
```

Vitest TZ=America/New_York:

```
Test Files  119 passed (119)
Tests  1667 passed | 6 skipped (1673)
Duration  58.92s
```

`node --check scripts/smoke.mjs` exit 0.

From-zero smoke: exit 0. `About to apply 113 migration(s)`. `SMOKE PASS`. No response status 500. The recompute log includes `[labor tasks] wrote 1 rows`. The forms added two plan rows and two tasks, saved a percent, and a matching harvest batch cleared one plan row. The farmops wall showed the remaining plan row and the two bars.

Browser, on the smoke database. Layout measured in the page (document scroll width equals client width, tile scroll width equals client width). The overdue bar used the danger token (Continuum `rgb(239, 138, 111)`, Lite `rgb(139, 46, 46)`, Grip `rgb(224, 87, 87)`). The on-track bar used the ok token.

| view | width | page | scroll |
| --- | ---: | --- | --- |
| CO, computer | 1920 | farmops | 1905 = 1905 |
| CO, computer | 1920 | harvest plan | 1905 = 1905 |
| CO, computer | 1920 | labor tasks | 1905 = 1905 |
| CO, computer | 820 | labor tasks | 805 = 805 |
| CO, phone | 390 | labor tasks | 390 = 390 |
| CO, phone | 390 | farmops | 390 = 390 |
| Lite, computer | 1920 | farmops | 1905 = 1905 |
| Grip, computer | 1920 | farmops | 1905 = 1905 |
| Grip, computer | 820 | farmops | 805 = 805 |

The harvest plan form showed the cut line "cut Oct 22, HBN SMOKEPLANHBN", Save, Done, and Delete with a reason. The labor form showed the overdue task first at 20% and the other at 80%, with "show closed".

## Declined

There is no live-data bench in this worktree. The test-batch omission is proved on the unit floor (a test load alone makes no count and no What ran line; a real load beside it still counts), not against the live silo history.

## Close

Tree left `8238c2f80573117e`. Nothing is committed, pushed, or deployed. The Scribe gates. The owner merges. This slice carries migration 0114, so the merge block takes a snapshot first. L1 to L4 go out in one push.
