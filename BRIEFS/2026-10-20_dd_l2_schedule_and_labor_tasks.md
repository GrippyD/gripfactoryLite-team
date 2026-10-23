# DD L2: the Harvest Schedule and Labor Task Completion, with their forms

Filed by the Scribe on 2026-10-20 (canon 0.30.531) from the Farming Operations director's change list, sent by the owner, with the owner's picks: the upcoming harvest schedule is typed in a small form in the app after the morning sit-down; the budgeted tasks come from a new form where Logan types percent complete each week.

For the build session (Cursor, one plain session, no sub-agents): open in `C:\Users\DennisWallace\Documents\Claude\Projects\gripfactory Practical\branches\GFLiteMetrcAPI` (its `app\` is the app). If your working folder is not under `branches\GFLiteMetrcAPI`, stop and say so. Under THE DISPATCH RULE (canon 0.30.155).

RUN AFTER L1. Pin: the L1 gated tree `d0ace1b4f1fb0994` (411 files, gated 2026-10-21). Verify with canon's hash command in `app/` and stop if it differs. No git; nothing committed, pushed or deployed. One migration, `0114`. LF only. Read big files by search and line range (`src/director.ts` from `DIRECTOR_PATH` and the `:dept/enter` routes in `src/index.ts` around line 1689; `src/fieldestimates.ts` is the pattern for a small Admin list form with add and delete; `src/farmday.ts` for the farm day).

## 1. Two tables (migration 0114; guarded and idempotent; nothing seeded)
- `dd_harvest_plan`: id, strain (the market strain as the strain table names it, a select), farm_code (PNN, PNS, ARL), planned_date (YYYY-MM-DD), plants INTEGER null, note, done_at null, created_at, created_by, updated_at, updated_by, deleted_at, deleted_by, delete_reason. Index on planned_date.
- `dd_labor_tasks`: id, task TEXT, farm_code null (blank means all farms), started_on (YYYY-MM-DD), expected_on (YYYY-MM-DD), pct_complete INTEGER 0 to 100, pct_as_of (YYYY-MM-DD), note, closed_at null, the same audit columns. And `dd_labor_task_log`: id, task_id, pct_complete, as_of, note, created_at, created_by: every percent typed, so the bar's history is kept. Indexes on expected_on and task_id.

## 2. The forms (Admin, Director Dashboard, behind the Admin PIN, the owner's and the directors' hands)
- `/admin/director/harvest-plan`: the rows to come, sorted by planned date; add a row (strain select, farm, date, plants, note); edit in place; delete with a reason (the app's delete law); a Done button that stamps done_at. THE AUTOMATIC DONE: a row also reads done when a harvest batch of that strain and farm is cut on or after its planned date (harvest_batches: strain_id or market_strain, farm_code, and entry_date as the harvest date; src/mint.ts parseHbn reads the same day from the HBN), so the floor's own entry clears the plan without a click; a row cleared this way says "cut Oct 22, HBN ...". Rows done more than 14 days ago fall off the form's default view (a "show done" link).
- `/admin/director/labor-tasks`: the open tasks with their bars (section 4's law), add a task (task, farm, started on, expected on), and on each task a percent box and an as-of date (default today) whose save writes the task and a log row; close a task at 100 or with a Close button. Closed tasks under a "show closed" link.
- Both forms are listed on the Director Dashboard home beside the check-in links, and the two tiles link to their forms with "Add or update".
- Every write goes through the actions law with an actor and a reason where the app asks one (the S2c default reason stands for the current period).

## 3. The Harvest Schedule tile (`harvest.harvest_schedule`, farmops wall)
- A plain list, sorted by planned date: the date in words ("Thu, Oct 22"), the strain, the farm, the plants when typed; a strain with several dates shows once per date (Logan: "strain name and harvest date(s), sorted by date"). The next 21 days by default, "all" on tap. Rows done (by click or by the cut) leave the list; a row past its date and not done reads "overdue" in the warning color.
- Under it: "N strains, M plants planned in the next 21 days"; nothing typed shows "No upcoming harvests entered" with the link to the form.
- This tile reads live from dd_harvest_plan; no dd_kpi_values series.

## 4. The Labor Task Completion tile (`farmops.labor_tasks_done_pct`, farmops wall)
- One row per open task: the task name, the farm, "due Oct 31", and a horizontal bar: the filled part is pct_complete; a thin marker on the bar at the share of time elapsed between started_on and expected_on (today's position); the bar's color: on track when pct_complete is at or above the elapsed share less 5 points, behind (warning token) when under it, overdue (the danger token) when today is past expected_on and the task is under 100. The percent and the as-of date print at the bar's end ("60%, as of Oct 19"). Sorted: overdue first, then behind, then on track, then by expected date.
- Under the rows: "K of N on track". No tasks: "No budgeted tasks entered" with the link to the form.
- Hover or tap on a bar: the percent history from the log (date and percent), newest first, five lines.
- The stored value for the registry row (dd_kpi_values, daily, dim "all"): the share of open tasks on track, so the row keeps a number the walls and the check-in can read; write it on the cron and Recompute like S3a.
- The registry (in the 0114 migration and src/directorregistry.ts together): `farmops.labor_tasks_done_pct` compute_key: "dd_labor_tasks: percent complete typed per task against the time elapsed to its expected date; the row's value is the share of open tasks on track"; status live; def_version 2; `harvest.harvest_schedule` compute_key: "dd_harvest_plan rows by planned date; a row is done by its Done button or when a harvest batch of its strain and farm is cut on or after the date"; status live; def_version 2. Both source_kind hand. The registry test moves with it.

## Tests
- The plan form: add, edit, delete with reason, Done; the automatic done from a harvest batch on the date and after it, not before; the 14 day fall off; the tile order and the overdue mark.
- The task form: add, the percent save writes the log, close at 100; the bar law at four points (ahead, exactly on the marker, 5 under, 6 under, past the date); the sort; the stored share.
- Both tiles' empty states and their links.
- No dash characters in any output.

## Smoke and gates
Smoke: `About to apply 113 migration(s)` (L1's read 112). Add two plan rows and two tasks through the forms, type a percent, cut a harvest batch matching one plan row, load the farmops wall, check the list and the bars; keep every other check. Gates: typecheck 0; vitest under both time zones with counts; `node --check scripts/smoke.mjs`; the from zero smoke (SMOKE PASS, no 500); renders of the two forms and the farmops wall in Lite, CO and Cerberus at 1920, 820 and the phone; dash, CR and name scans of every touched file.

## Hand back
Report `SESSION_REPORTS/2026-10-20_dd_l2_schedule_and_labor_tasks.md`, short: the tree received and left, files touched, gate results, anything declined and why. Close with the tree hash and that nothing is committed, pushed or deployed.
