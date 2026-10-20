# DD S3f: Trim Throughput takes Percent finished (plants)'s place

Filed by the Scribe on 2026-10-19 (canon 0.30.520) from the owner's word: "In Percent finished (plants) original place: Trim Throughput". His mock: Label Trim Throughput; drop downs Period, Strain, Dry Method; three boxes "[Trim TP Days]/[DLH]", "[Trim TP Nights]/[DLH]", "[Weighted TP]/DLH". Colors: our themes.

His picks (2026-10-19), after the Scribe named the source (the Harvest Console's Trimming section, Lbs/DLH per shift: the shift's weighed trim output over its typed hours, shifts day and second; and the planned harvest.trim_lb_per_dlh on that law):
- Use the console's per shift law. Keep the planned tile `harvest.trim_lb_per_dlh` on the list, untouched.
- Hours are typed per shift per day, not per strain or dry method. With a strain or dry method picked, a shift's hours are shared across the lots trimmed in it by their share of that shift's lbs, and the boxes say "hours shared by lbs". Note for the report: under this law a filtered box differs from All only through which shift days the selection ran on; it is not a per strain speed.
- The Scribe's reading of "original place": the planned `harvest.pct_complete` leaves the walls (active 0, its row stays; S3c's tile now carries percent finished) and Trim Throughput takes its slot.

For the build session (Cursor, one plain session, no sub-agents): open in `C:\Users\DennisWallace\Documents\Claude\Projects\gripfactory Practical\branches\GFLiteMetrcAPI` (its `app\` is the app). If your working folder is not under `branches\GFLiteMetrcAPI`, stop and say so. Under THE DISPATCH RULE (canon 0.30.155).

RUN AFTER S3e. Pin: the S3e gated tree `7cea680de7fb19e3` (S3a to S3e, gated 2026-10-20). Verify with canon's hash command in `app/` (`(find src test scripts migrations -type f; echo wrangler.toml; echo tsconfig.json; echo package.json) | LC_ALL=C sort | xargs sha256sum | sha256sum | cut -c1-16`, `wrangler.toml` read as LF) and stop if it differs. No git; nothing committed, pushed or deployed. One migration, `0111`. LF only. Read big files by search and line range (`src/console.ts` trimFigures and its day SQL, `src/director.ts`, `src/directorregistry.ts`).

## 1. The registry (migration 0111 and src/directorregistry.ts together)
- `harvest.pct_complete`: active 0.
- A new row `bizops.trim_throughput` in its sort slot: dept bizops, wall_keys bizops,farmops (where pct_complete sat); title_en "Trim Throughput", title_es "Rendimiento de recorte"; unit ratio (lb/DLH); cadence daily; dims "shift,strain,dry_method"; goal_kind none; source_kind app; status live; def_version 1; no open question; compute_key: "console trimFigures per shift (src/console.ts): the shift's weighed trim output grams over 448 over trim_labor_hours for that work_date and shift; weighted = both shifts' lbs over both shifts' hours; with a strain or dry method picked, each shift's hours are shared by the selection's share of that shift's lbs".
- Guarded and idempotent; the registry test's counts and equality move with it.

## 2. The stored series (dd_kpi_values)
Add `refreshTrimThroughput(db, nowIso)` to `src/ddsnapshot.ts`, on the hourly cron and the Recompute button, for every work date of the harvest year with trim output or trim hours:
- Rows per work date, shift (day, second), strain and dry method: lbs (the console's shift attribution of weighed packages, exactly as trimFigures assigns them, own and toll lots alike, as the console counts them), and per work date and shift the hours from trim_labor_hours. Store lbs rows with dim_key "shift|strain|dry_method" and hours rows with dim_key "hours|shift"; the ratio is computed on the wall from them, so any selection sums cleanly.
- Strain: the lot's market strain as strain performance names it. Dry method: the lot's dry space type at drying (`dry_spaces.space_type` through the lot's wet weight entry: silo, dry_room, hang), shown as Silo, Dry Room, Hang in Place.
- Same write law as S3a (grouped reads, supersede on change, batched, at most 100 binds per statement).
- THE CHECK: for any work date and shift with All picked, the stored lbs and hours give the console's shift Lbs/DLH for that day (a test drives both on one fixture).

## 3. The tile
- Head: "Trim Throughput", v1.
- Three selects: Period (7 days, 14 days, 30 days, HTD; default 14), Strain (All, then strains trimmed this year), Dry Method (All, Silo, Dry Room, Hang in Place, only those with output). Client side; remembered per browser in try/catch.
- Three boxes:
  - Days: the window's day shift lbs over its day shift hours, "lb/DLH", two decimals; under it the lbs and hours.
  - Nights: the same for the second shift.
  - Weighted: both shifts' lbs over both shifts' hours.
  - With a strain or dry method picked, the hours are the shared hours and each box says "hours shared by lbs".
  - A shift day with lbs and no hours: its lbs are left out of that box and the box says "N shift days without hours" (trim hours are per shift; counting lbs with no hours would inflate a speed).
  - No output in the selection: "No data".
- Hover or tap on a box: the formula in a sentence and the counts behind it.
- Theme tokens only; fits at 1920, 820 and the phone with no sideways scroll.

## Tests
- All with one day and shift equals the console's shift Lbs/DLH.
- Weighted is summed lbs over summed hours, not a mean of the two boxes.
- A strain pick shares hours by lbs; a dry method pick by its space type.
- A shift day without hours is left out and counted in the note.
- The registry: pct_complete inactive; the new row on bizops and farmops.
- No dash characters in any output.

## Smoke and gates
Smoke: `About to apply 110 migration(s)` (S3e's read 109). Seed two trim shifts with hours and packages on two strains in two dry spaces, press Recompute, check the three boxes and that Percent finished (plants) is gone; keep every other check. Gates: typecheck 0; vitest under TZ=UTC and TZ=America/New_York with counts; `node --check scripts/smoke.mjs`; the from zero smoke (SMOKE PASS, no 500); renders of the bizops wall in Lite, CO and Cerberus at 1920, 820 and the phone, each select used once and a hover shown; dash, CR and name scans of every touched file. On a live-data bench: the refresh time and two days' shift figures against /harvest's Trimming section.

## Hand back
Report `SESSION_REPORTS/2026-10-19_dd_s3f_trim_throughput.md`, short: the tree received and left, files touched, gate results, timings, anything declined and why. Close with the tree hash and that nothing is committed, pushed or deployed. The Scribe gates; the owner merges (all of S3a to S3f go out in one push, his word 2026-10-19).
