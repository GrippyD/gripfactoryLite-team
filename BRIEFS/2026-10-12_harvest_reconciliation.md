# BRIEF HR1: HARVEST WEIGHT RECONCILIATION REPORT (canon 0.30.449)

Filed by the Scribe on 2026-10-12 from the owner's word ("do it", answering the numbered next steps after his meeting review of 10/1 to 10/12). QUEUED in the worktree `C:\Users\DennisWallace\Documents\Claude\Projects\gripfactory Practical\branches\GFLiteMetrcAPI`, to be dispatched only after SR1 (sensor retention, in build there now) hands back and merges, because one agent works one worktree. Pinned to the live tree `d6ecd7050716a753` (355 files, migrations 0001-0098, main be52e28, worker 92d5fe5b); the Scribe re-pins this line at dispatch if main has moved. NO migration in this brief.

For the build session (Claude Code or Cursor): open in `branches\GFLiteMetrcAPI` (its `app\` is the app), NOT the main folder `gripfactory Practical\app` and not `branches\GFLiteOpsDashboard`; if your working folder is not under `branches\GFLiteMetrcAPI`, stop and say so. Under THE DISPATCH RULE (canon 0.30.155). Verify the pinned tree with canon's hash command before touching anything (run in `app/`, `wrangler.toml` read as LF): `(find src test scripts migrations -type f; echo wrangler.toml; echo tsconfig.json; echo package.json) | LC_ALL=C sort | xargs sha256sum | sha256sum | cut -c1-16`. If the hash differs, stop and say so. No git; nothing committed, pushed or deployed. Never edit `canon/` or an existing migration.

---

## Why

In the 10/9 meeting two harvest totals disagreed: the app said 70,673 lb and the other count was about 1,000 lb lower, and the pounds per hour differed (35.4 against 34.87). The cause is a unit: the app's pound is 448 g by canon law (0.30.164, `GRAMS_PER_LB` in `src/config.ts`), while the sheets and processors use the standard pound, 453.59237 g. Re-expressed at the standard pound, 70,673 lb is about 69,802 lb, roughly 870 lb lower, which explains most of the gap by itself, not all of the rate difference. Nothing in the system shows the two side by side, so the answer took a meeting. This report is that view, so the question never needs a meeting again.

## What the code holds (read these first)

- `src/config.ts` `GRAMS_PER_LB` (448), `formatGrams`; `src/compliance.ts` `formatLbs` (pounds at 448, two decimals).
- `src/drystrain.ts` (canon 0.30.427, Dry Weight by Strain): the newest report. Follow its shape for the page, the From and To dates (`resolveDryStrainRange`, 366 day cap, 30 day default), the filter form, the footnote and the CSV control. Its route and form sit near `src/index.ts` line 1020; its menu entry in the Reports menu.
- `src/reports.ts`: `ReportColumn`, `ReportView`, the grams cell renderer (line 143 and 209).
- `migrations/0001_schema.sql` `harvest_batches`, `wet_weight_entries`; `migrations/0010_unload_dry_space.sql` `dry_weights`; `migrations/0097_metrc_harvests.sql` (the METRC mirror's harvests). Read all four before writing a line.
- `src/feeds.ts` `HARVEST_CHANGED_AT_SQL` and the harvest feed show which joins already read one wet lot per `wet_weight_entries.id`; reuse the lot grain.

## The law

1. THE REPORT. A new report `harvest_reconciliation` on the standing report pattern (`/reports/harvest_reconciliation`, the Reports menu, EN and ES words in `src/i18n.ts`). Filters: From and To dates (default last 30 days, cap 366), Farm (blank all, PNN, PNS, ARL), Grow Method (blank all). The range is on the lot's harvest date: use the existing harvest date column the lots already carry and say in the footnote which column it is. Read only; no write route.
2. ONE LINE PER WET LOT (the grain of the harvest feed). Columns: HBN short id, strain (real strain and market strain, as Dry Weight by Strain shows them), farm, wet grams, wet pounds at 448 (the app's pound), wet pounds at 453.59237 (the standard pound), the difference in pounds, dry grams (the lot's dry weight, blank when never unloaded), dry pounds at both, and the METRC mirror's harvest weight for the same harvest in pounds when the mirror holds one (convert from the mirror's own UOM; show the UOM it carried). A lot with no matching METRC harvest shows the cell blank and the row is flagged "No METRC harvest"; a METRC harvest in range with no lot is listed beneath the table as "METRC only", one line each.
3. THE TOTALS ROW, TWO POUNDS. Beneath the lot lines: total wet grams, total pounds at 448, total pounds at 453.59237, their difference, and the ratio line "448 g against 453.59237 g, 1.2494 percent" (compute it, do not hard code), so the pound gap is stated in the report and not found in a meeting. The same for dry.
4. NO LABOR HOURS HERE. The pounds per hour gap (35.4 against 34.87) is not in this tree's data unless the labor hours already live in it. If they do, add one line under the totals, wet pounds per hour at both pounds, from that existing source; if they do not, add nothing and say in the report where the hours were looked for. Do not invent an hours source.
5. THE FOOTNOTE. "The app's pound is 448 g. The standard pound is 453.59237 g. Both are shown. METRC and the sheets use the standard pound." EN and ES.
6. CSV on the standing CSV control, one row per lot with every column above (grams as integers, pounds with four decimals, no thousands commas in the CSV).
7. NOTHING ELSE MOVES. The 448 law, every other report, the feeds, the lot pages and the cron blocks stay as they are. No migration, no config change, no theme change.

## Performance (a standing law, 0.30.438)

D1 resets the database on one heavy query. The report's reads go through existing indexes with bound dates; no scan of `sensor_readings`, no function on the big side of a join, at most 100 bound parameters per statement (chunk the METRC lookup by 90 harvest ids). The Scribe times the report on the live-data bench; anything over one second is a defect.

## The tests and the smoke

- Unit (`test/harvestreconciliation.test.ts`): a lot at 448,000 g reads 1,000.00 lb at 448 and 987.67 lb at 453.59237 (check the rounding) and the difference line; the totals row and the ratio line compute from the numbers; a lot with no dry weight leaves dry blank and still lists; a lot with no METRC harvest is flagged; a METRC harvest with no lot is listed under "METRC only"; the date range filter, the farm filter and the grow filter; the empty range message; the CSV; the Spanish words; the report reads nothing from `sensor_readings` and binds its dates.
- Smoke (`scripts/smoke.mjs`): `/reports/harvest_reconciliation` answers 200 on the seeded data and carries both totals and the ratio line; the CSV answers 200. The `About to apply` line stays at 98 migrations on this tree.
- Gates as standing: typecheck 0; vitest under `TZ=UTC` and `TZ=America/New_York`; `node --check scripts/smoke.mjs`; the from-zero smoke, SMOKE PASS, no ` 500 `; dash and CR audit by character; no personnel names anywhere in what you write.

## Build shape

`src/harvestreconciliation.ts` (reads, view, markup, CSV); `src/index.ts` (route, menu entry); `src/i18n.ts`; `test/harvestreconciliation.test.ts`; `scripts/smoke.mjs`. Session report `SESSION_REPORTS/2026-10-12_harvest_reconciliation.md` with the sealed final check (tree hash, file sizes and hashes, tsc, both vitest runs, node --check, the smoke line, the audits).

## Owed after deploy

Nothing to anyone outside. The owner reads the two totals against the 10/9 figures; the Scribe notes the lbs-per-hour finding in the canon.
