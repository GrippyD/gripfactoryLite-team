# DD S3a: the Lbs Harvested tile (the first stored app series)

Filed by the Scribe on 2026-10-19 (canon 0.30.514) from the owner's word:

> Ignore my colors and stick with our themes. Lbs Processed: 1. Calculate the total lbs processed through cutting and bucking (wet lbs harvested) and store the period by period data in a table. 2. Change this pane to: Label: Lbs Harvested; [Total Wet Lbs]; Drop Down Menu: Period; a bar graph. b. Pounds Harvested means wet weight in grams divided by 448, always HTD. c. Drop down menu: 7 days, 14 days, 30 days, HTD. d. Bar graph by date. e. Add a trendline. 3. Hover values appropriately. 4. Add a link to strain performance report.

His pick on the source (2026-10-19): use the Harvest Console's wet weight law, and keep the planned tile `harvest.wet_weight_lb` on the list for later (do not touch it). This replaces the processed_lbs ruling (trim, cryo, prepack side by side): the tile now means wet lbs harvested.

For the build session (Cursor, one plain session, no sub-agents): open in `C:\Users\DennisWallace\Documents\Claude\Projects\gripfactory Practical\branches\GFLiteMetrcAPI` (its `app\` is the app). If your working folder is not under `branches\GFLiteMetrcAPI`, stop and say so. Under THE DISPATCH RULE (canon 0.30.155).

Pinned to the live tree `130ef9e8bbf10220` (PS2 live, worker f6435a59). Verify with canon's hash command in `app/` (`(find src test scripts migrations -type f; echo wrangler.toml; echo tsconfig.json; echo package.json) | LC_ALL=C sort | xargs sha256sum | sha256sum | cut -c1-16`, `wrangler.toml` read as LF) and stop if it differs. No git; nothing committed, pushed or deployed. One migration, `0106`. LF only. Read big files by search and line range (`src/director.ts`, `src/directorregistry.ts`, `src/console.ts`, `src/index.ts` are large).

## 1. The definition (migration 0106 and the registry together)
The row stays `bizops.lbs_processed` (the key is internal). Change it in `migrations/0106_dd_lbs_harvested.sql` and in `src/directorregistry.ts` so the registry test still finds the code and the rows equal:
- title_en "Lbs Harvested", title_es "Libras cosechadas"; unit lb448; cadence daily; dims "farm"; source_kind app; status live; def_version 2.
- compute_key: "wet_weights of own lots of the harvest year (the console yearWet law, src/console.ts yearWet) summed by the tote's farm day; grams over 448; HTD is the harvest year's sum".
- open_question_en and open_question_es NULL, config_key NULL, so the tile shows no "?".
- The debate row `processed_lbs` in dd_kpi_questions: status ruled, ruling "wet_harvested", ruled_at 2026-10-19, the note "owner 2026-10-19: Lbs processed means wet lbs harvested". Drop `dd_processed_lbs_buckets` from the registry's config lists only if nothing else reads it; else leave it.
- Guarded and idempotent (UPDATE ... WHERE the old value), no double quotes, no percent signs.

## 2. The stored series (dd_kpi_values, the table that exists)
A new module `src/ddsnapshot.ts`, `refreshLbsHarvested(db, nowIso)`:
- The harvest year is the farm today's, as /harvest picks it. Its totes: `wet_weights x` joined to `wet_weight_entries w` (not deleted) and `harvest_batches b` (not deleted), `x.deleted_at IS NULL`, `b.harvest_year = year`, `ownLotSql("b")`. Exactly the console's yearWet WHERE clause.
- One row per farm day (the tote's `created_at` read through `farmDay` with the app_config start hour) and per farm (`dim_key` PNN, PNS, ARL) plus a total row (`dim_key` ''). `period_kind` day, `period_start` the day, `value` grams over 448 rounded to 2 decimals, `n` the tote count, `source` app, `source_as_of` the newest tote's created_at, `def_version` 2, `computed_at` now.
- Read it in one pass: a grouped query by farm day and farm. If grouping by farm day in SQL is awkward, group by the hour in SQL (`substr(x.created_at, 1, 13)`) and fold the hours into farm days in TypeScript. Never one query per day, never per tote rows into the worker. At most 100 binds per statement.
- Write only what changed: when a live row's value or n differs, set its `superseded_at` and insert the new one; an unchanged row is left alone; a day that drops to zero writes 0 (do not delete). Batch the writes.
- Days with no totes inside the season are not stored; the chart fills them as 0.
- THE CHECK THAT HOLDS IT: the sum of the total rows for the year equals the console's yearWet sum to the gram (a test proves it on a fixture with a toll lot, a test lot, a deleted tote and a tote before the farm day start hour).

When it runs:
- The hourly cron (`15 * * * *`, in `scheduled` in src/index.ts) calls it for the whole harvest year each hour. Log one line with the rows written.
- Under Admin, Director Dashboard, a button "Recompute Lbs Harvested" (Admin PIN) runs it now, for the backfill and for after a repair.
- The wall never computes it; the wall only reads.

If the hourly pass reads too many rows on the live-data bench (say over 2 s), stop and say so with the timing rather than adding an index or a cache.

## 3. The tile
Replace the generic tile body for this one KPI only (other tiles unchanged), on every wall it shows on:
- Head: "Lbs Harvested" as the title link, the v2 badge, no "?".
- The headline: HTD wet lb, the year's total rows summed, formatted like the other lb448 tiles. Under it, small and muted: "HTD, Sep 14 to Oct 19" (first stored day to the farm today), EN and ES. The headline never changes with the period pick.
- A period select (7 days, 14 days, 30 days, HTD; default 14 days). Switching is client side over data in the page (no reload, no request). The pick is remembered per browser (localStorage in try/catch; it must work without it).
- The bar chart, inline SVG: one bar per farm day in the window, oldest left, the farm today at right (today's bar is the day so far: draw it lighter or outlined and say "so far" in its hover). Days with no harvest show as an empty slot. The y axis gets a few gridlines labeled in lb; the x axis a few date labels (not every day on HTD).
- The trendline: least squares over the bars in the window, excluding today's partial bar, drawn as a thin dashed line. With fewer than 3 bars, no line.
- Hover (and tap on the phone): the date with weekday, the total lb, the farm split (PNN, PNS, ARL lb), and the tote count. One small tooltip, readable in all three themes; also a `<title>` on each bar for screen readers.
- Colors: the theme's own tokens only (Lite, CO, Cerberus). No new hex colors. Bars one color; today's bar the same color, lighter or outlined; the trendline a contrasting theme token.
- A link under the chart: "Strain performance" to `/harvest#strain-performance`. Give the console's Strain Performance section that id, and have the console open that details section when the hash names it.
- No data at all: keep today's "No data yet" look.
- Fit: the tile may span two grid columns on a wide screen; at 820 and on the phone it is full width with no sideways scroll.

## Tests
- The series:
  - farm day bucketing across the start hour;
  - toll and test lots out; deleted totes and entries out;
  - the year sum equals the console's yearWet;
  - a second refresh writes nothing;
  - a changed tote supersedes one row and inserts one;
  - a day that drops to zero.
- The migration: the registry test passes with the new row; the question reads ruled.
- The tile:
  - the headline is HTD whatever the period;
  - the select lists the four periods;
  - bars for the window, with the gap days empty;
  - the trendline omitted under 3 bars;
  - the hover text carries the farm split;
  - the strain performance link;
  - no dash characters in any output.
- Cron: the scheduled handler calls the refresh on the hourly cron string only.

## Smoke and gates
Smoke: the migration count moves to 106 (`About to apply 106 migration(s)`). After seeding, POST the Recompute button and check the wall tile shows a headline and bars; keep every other check. Gates: typecheck 0; vitest under TZ=UTC and TZ=America/New_York with counts; `node --check scripts/smoke.mjs`; the from zero smoke (SMOKE PASS, no 500); renders of the bizops wall in Lite, CO and Cerberus at 1920 and 820 and the phone, with each period picked once and a hover shown; dash, CR and name scans of every touched file. On the live-data bench if you have one: the refresh's time and rows written, and the HTD headline against /harvest's year wet figure (they must match).

## Hand back
Report `SESSION_REPORTS/2026-10-19_dd_s3a_lbs_harvested.md`, short: the tree received and left, files touched, gate results, timings, anything declined and why. Close with the tree hash and that nothing is committed, pushed or deployed. The Scribe gates; the owner merges (this one carries migration 0106, so the merge block takes a snapshot first).
