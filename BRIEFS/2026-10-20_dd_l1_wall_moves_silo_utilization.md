# DD L1: Logan's wall, the moves and Silo Utilization

Filed by the Scribe on 2026-10-20 (canon 0.30.531) from the Farming Operations director's change list, sent by the owner ("Let's do this next"), with the owner's picks on its open questions. This slice makes the clear changes to the Farming Operations wall (`/admin/director/farmops`, the wall Logan reads; the Business Operations wall is the owner's) and builds the one tile whose definition he settled: Silo Utilization.

For the build session (Cursor, one plain session, no sub-agents): open in `C:\Users\DennisWallace\Documents\Claude\Projects\gripfactory Practical\branches\GFLiteMetrcAPI` (its `app\` is the app). If your working folder is not under `branches\GFLiteMetrcAPI`, stop and say so. Under THE DISPATCH RULE (canon 0.30.155).

Pin: the TL1 gated tree `1c1672f779290674` (408 files; S3a to S3f and TL1 are live from it). Verify with canon's hash command in `app/` (`(find src test scripts migrations -type f; echo wrangler.toml; echo tsconfig.json; echo package.json) | LC_ALL=C sort | xargs sha256sum | sha256sum | cut -c1-16`, `wrangler.toml` read as LF) and stop if it differs. No git; nothing committed, pushed or deployed. One migration, `0113`. LF only. Read big files by search and line range (`src/director.ts`, `src/directorregistry.ts`, `src/silo.ts` around `assembleSiloVisuals`, `src/storagecapacity.ts` and `src/trimthroughput.ts` as the patterns for a live tile).

## 1. The registry (migration 0113 and src/directorregistry.ts together; the registry test's counts and equality move with it)
The moves (his pick: they stay on the Business Operations wall, where Storage Capacity Utilization and Trim Throughput are live and BTR is a planned tile):
- `harvest.btr_pct`: wall_keys `bizops,culttech` (farmops dropped).
- `bizops.trim_throughput`: wall_keys `bizops`.
- `harvest.trim_lb_per_dlh`: wall_keys `bizops`.
- `harvest.dry_space_utilization_pct` becomes the Silo Utilization row: title_en "Silo Utilization", title_es "Uso de silos"; wall_keys `farmops`; unit count; cadence daily; dims "silo"; goal_kind none; source_kind app; status live; def_version 2; open question cleared; compute_key: "silos active per day (his pick, 2026-10-20): a silo (dry_spaces kind silo, space_type silo; Silo 1 to 5) counts on a farm day when a silo_loads row of it, not deleted, has loaded_at on or before the end of that day and ended_at null or after the start of it; the day's value is the count of such silos; per silo rows carry 1 or 0". The planned question text about end of day versus time weighted goes.
- `harvest.harvest_schedule`: title_en "Harvest Schedule", title_es "Calendario de cosecha" (the words "(plan rows)" go); nothing else changes here; L2 builds it.
- `farmops.task_units_per_dlh` (Field Task Productivity): sort to the last slot of the farmops wall (his pick: lower on the wall).
- `harvest.ppp_dry_lb` and `harvest.ppp_wet_lb`: untouched (Logan: keep as is).
- Guarded and idempotent.

## 2. The stored series (dd_kpi_values)
Add `refreshSiloUtilization(db, nowIso)` to `src/ddsnapshot.ts`, on the hourly cron and the Recompute button, for every farm day from the first silo load of the harvest year (the harvest year as /harvest reads it) to today:
- One row per day and silo, dim_key "silo|Silo 1" through "silo|Silo 5", value 1 when the silo was active that day under the compute law, else 0; and one row per day with dim_key "all" carrying the count.
- A silo's day is the farm day (src/farmday.ts), not UTC.
- Same write law as S3a: grouped reads, supersede on change, batched, at most 100 binds per statement. silo_loads is small (about a hundred rows this year); read it once.

## 3. The tile
- Head: "Silo Utilization", v2. A line under it: "Silos with material in them, each day of the harvest", and a link "Drying Operations" to `/ops/drying_ops` (the silo strip's page), so a director can step to the live silos.
- The chart, inline SVG: one bar per farm day of the harvest year, height the count of active silos on a 0 to 5 axis, the day's count printed above bars on hover or tap; the x axis labels every Monday; theme tokens only; fits at 1920, 820 and the phone with no sideways scroll (the bars narrow; the phone shows the last 30 days with a "whole harvest" toggle).
- Under the chart, "What ran": one row per silo, Silo 1 to Silo 5, listing its loads of the harvest year in date order: loaded date, unloaded date (or "still in"), the lot (HBN) and its market strain as the drying page names it, the wet lb loaded (448). Read live from silo_loads, wet_weight_entries and harvest_batches; collapsed by default on the phone.
- Hover or tap on a bar: the date, the count, and which silos were active.
- Values as text through `esc`; no raw HTML from data.

## 4. Field Task Productivity, its empty state
The tile stays as it is in size of type, but sits last on the wall (the registry sort) and, until the labor task form of L2 feeds it, shows one plain line in the muted color: "No task data yet. Harvest, trim, pasteurization and prepack rates read from the console once their hours are typed; other tasks arrive with the labor task form." No numbers are shown from an empty series. When any task row exists the tile renders as it did.

## Tests
- The registry: the three moved keys carry no farmops; the renamed row's title, wall, dims and compute; task_units_per_dlh sorts last on farmops; pct_complete and wet_weight_lb stay inactive; the migration text equals ddSeedSql().
- The compute law on a fixture of four loads over three silos: a load that ends at 10 AM counts that day and not the next; a load loaded at 11 PM counts that day; a deleted load counts for nothing; the Arlington Dry Room, the Blast Freezer and the Truck never count.
- The series: days with no load carry a 0 row for each silo; the "all" row equals the sum.
- The tile: the bars' heights and the "What ran" rows from the fixture; the Drying Operations link; the phone toggle.
- The Field Task Productivity empty line renders with no numbers when the series is empty, and the numbers return when one row exists.
- No dash characters in any output.

## Smoke and gates
Smoke: `About to apply 112 migration(s)` (TL1's read 111). Seed two silo loads on two silos across three days, press Recompute, check the counts per day and the What ran rows; check Trim Throughput and BTR are off the farmops wall and still on bizops; keep every other check. Gates: typecheck 0; vitest under TZ=UTC and TZ=America/New_York with counts; `node --check scripts/smoke.mjs`; the from zero smoke (SMOKE PASS, no 500); renders of the farmops wall in Lite, CO and Cerberus at 1920, 820 and the phone, a hover shown; dash, CR and name scans of every touched file. On a live-data bench: the refresh time and the counts for Oct 1 and Oct 15 against the silo pages' own history (the Scribe runs it).

## Hand back
Report `SESSION_REPORTS/2026-10-20_dd_l1_wall_moves_silo_utilization.md`, short: the tree received and left, files touched, gate results, timings, anything declined and why. Close with the tree hash and that nothing is committed, pushed or deployed. The Scribe gates; the owner merges (L1 to L4 go out in one push).
