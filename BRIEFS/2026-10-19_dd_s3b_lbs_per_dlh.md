# DD S3b: Lbs/Labor Hour vs Goal replaces Lbs shipped

Filed by the Scribe on 2026-10-19 (canon 0.30.515) from the owner's word: "Lbs Shipped: Remove and replace with: Lbs/Labor Hour vs. Goal." His mock: Label "Lbs/Labor Hour Vs. Goal"; the headline "[Total Weighted AVG Wet Lbs/DLH]"; a Period drop down; an area chart, Lbs/DLH up the side, "Days (defined by period selector)" along the bottom. Colors: our themes, not his (his standing word from S3a).

His picks (2026-10-19):
- Source: the Harvest Console's Lbs/DLH law. Keep the planned tile `harvest.wet_lb_per_dlh` on the list, untouched.
- Goal: 26 lb per DLH, in an Admin lookup. The lookup exists: the Director Dashboard targets form (S2b, dd_targets, effective dated, under Admin with the Admin PIN). Seed 26 there; no new lookup.
- Gaps: count all wet lbs. A day with wet lbs but no hours typed still adds its wet lbs to the weighted average; it simply has no point of its own on the chart.

For the build session (Cursor, one plain session, no sub-agents): open in `C:\Users\DennisWallace\Documents\Claude\Projects\gripfactory Practical\branches\GFLiteMetrcAPI` (its `app\` is the app). If your working folder is not under `branches\GFLiteMetrcAPI`, stop and say so. Under THE DISPATCH RULE (canon 0.30.155).

RUN AFTER S3a. This builds on S3a's `src/ddsnapshot.ts`, its refresh hook on the hourly cron, its Recompute button and its tile chart pieces (period select, hover, theme tokens). Pin: the S3a gated tree `220f0d5ad06292cd` (S3a with the Scribe's trend fix; on main once merged). Verify with canon's hash command in `app/` (`(find src test scripts migrations -type f; echo wrangler.toml; echo tsconfig.json; echo package.json) | LC_ALL=C sort | xargs sha256sum | sha256sum | cut -c1-16`, `wrangler.toml` read as LF) and stop if it differs. No git; nothing committed, pushed or deployed. One migration, `0107`. LF only. Read big files by search and line range.

## 1. The registry (migration 0107 and src/directorregistry.ts together)
- `bizops.lbs_shipped`: active 0. The row stays for its history; it leaves every wall. Its open question and config key stay as they are.
- A new row `bizops.lbs_per_dlh` in lbs_shipped's sort slot:
  - dept bizops, wall_keys bizops; title_en "Lbs/Labor Hour vs Goal", title_es "Libras por hora de mano de obra vs meta";
  - unit ratio (shown as lb/DLH), cadence daily, dims empty;
  - goal_kind targets, goal_ref dd_targets, goal_direction at_least;
  - source_kind app, status live, def_version 1, no open question;
  - compute_key: "consoleBoxes perDlh law (src/console.ts, the Total box): the farm day's wet grams over 448, every lot (the day SQL, no own lot filter), over the day's harvest hours (the ALL row of harvest_labor_hours, else the sum of the farm rows); the period figure is the window's wet lb over the window's hours".
- The goal: one dd_targets row for `bizops.lbs_per_dlh`, dim '', period_kind day, effective_from 2026-09-01, target 26, note "owner 2026-10-19". Guarded (insert only if no live row for that key, dim, kind and date).
- The registry test's row count and its code to rows equality move with it.
- Guarded and idempotent, no double quotes, no percent signs.

## 2. The stored series (dd_kpi_values, beside S3a's)
Add `refreshLbsPerDlh(db, nowIso)` to `src/ddsnapshot.ts`, run beside `refreshLbsHarvested` on the same cron and the same Recompute button (rename the button "Recompute dashboard series" if it now runs both).
- For every farm day of the harvest year from its first weighed tote to the farm today, three rows, period_kind day:
  - dim_key `wet_lb`: the console's day wet law: every tote of the farm day (start hour from app_config), any lot, not deleted, grams over 448, 2 decimals; n the tote count.
  - dim_key `hours`: the day's harvest hours: the ALL row if one stands, else the sum of the farm rows, else no row.
  - dim_key '': wet_lb over hours, 2 decimals, only when hours is above 0.
- This wet figure counts toll lots (the crew's hours cover them); S3a's Lbs Harvested does not. Say so in the tile's help line, not on the face.
- Hour rows dated before the first weighed tote of the harvest year (July and August rows) are not stored.
- The same write law as S3a: grouped reads (one for totes, one for hours), supersede only on change, batched writes, at most 100 binds per statement, never per tote rows into the worker.
- THE CHECK: for any day, the stored wet_lb, hours and ratio equal the console's Total Lbs/DLH box for that day (a test drives both on one fixture).

## 3. The tile
On the bizops wall, in Lbs shipped's place:
- Head: "Lbs/Labor Hour vs Goal", the v1 badge.
- A period select: 7 days, 14 days, 30 days, HTD; default 14 days; client side, remembered per browser in try/catch, like S3a.
- The headline follows the period: the weighted average, the window's summed wet_lb over its summed hours, as "25.2 lb/DLH". Under it: "Goal 26" and the gap ("0.8 under" or "1.4 over", EN and ES), on goal read with the theme's good token, under with its warning token. The goal is the dd_targets row in force on the farm today.
  - Days in the window with wet lbs and no hours still add their wet lbs (his word). Under the headline, small: "2 days without hours" when any are in the window, so the lift is visible.
  - A window with no hours at all shows "No hours typed".
- The chart, inline SVG area chart: one point per farm day with a ratio, oldest left; the area filled with a theme token at low opacity and the line on top; the y axis labeled Lbs/DLH with a few gridlines; the x axis a few date labels. A day without hours breaks the line (a gap, not a zero). Today's point (the day so far) drawn hollow and named "so far" on hover.
- The goal as a horizontal dashed line across the chart, labeled "Goal 26".
- Hover and tap: the date with weekday, lb/DLH, the wet lb and the hours behind it, or "no hours typed" for a gap day.
- Theme tokens only, all three themes; no new hex colors. Fits like S3a: may span two columns wide, full width at 820 and on the phone, no sideways scroll.

## Tests
- The series:
  - the ALL row wins over farm rows;
  - a day without hours stores wet_lb and no ratio;
  - pre-season hour rows are skipped;
  - a toll lot's wet counts here;
  - the stored day equals the console's Total box;
  - a second refresh writes nothing.
- The weighted average:
  - over a window it is summed wet over summed hours, not a mean of daily ratios;
  - wet from a day without hours counts and the "days without hours" note shows.
- The goal: the seeded target reads 26; a newer target from the targets form takes over on its date.
- The registry: lbs_shipped is off every wall; the new row is on bizops.
- The tile:
  - the four periods;
  - a gap on a day without hours;
  - the goal line;
  - the hover text;
  - no dash characters in any output.

## Smoke and gates
Smoke: `About to apply 106 migration(s)` (this tree has no 0101, so 0107 is the 106th file). Seed hours and totes, press Recompute, and check the wall shows the tile with a headline, the goal and a chart; check Lbs shipped is gone; keep every other check. Gates: typecheck 0; vitest under TZ=UTC and TZ=America/New_York with counts; `node --check scripts/smoke.mjs`; the from zero smoke (SMOKE PASS, no 500); renders of the bizops wall in Lite, CO and Cerberus at 1920 and 820 and the phone, each period picked once, a hover shown; dash, CR and name scans of every touched file. On the live-data bench: the refresh time and rows written, and three days' ratios against /harvest's Lbs/DLH box for those days.

## Hand back
Report `SESSION_REPORTS/2026-10-19_dd_s3b_lbs_per_dlh.md`, short: the tree received and left, files touched, gate results, timings, anything declined and why. Close with the tree hash and that nothing is committed, pushed or deployed. The Scribe gates; the owner merges (it carries migration 0107, so the merge block takes a snapshot first).
