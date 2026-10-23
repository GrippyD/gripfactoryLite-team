# DD L3: Yield per Plant, two seasons side by side with this year

Filed by the Scribe on 2026-10-20 (canon 0.30.531) from the Farming Operations director's change list, sent by the owner. Logan: replace Yield per plant vs plan with a side by side: yield per plant for each of the previous two seasons, their average, and this year's final; per strain if the data supports it. The owner's picks (2026-10-20): the past seasons come from a spreadsheet he or Logan supplies (season, strain, farm, plants, dry lb), uploaded once; this year shows a projection until drying ends, "but make the distinction obvious"; the Scribe's reading: this year shows two numbers, to date and projected, each labeled, never one unlabeled figure.

For the build session (Cursor, one plain session, no sub-agents): open in `C:\Users\DennisWallace\Documents\Claude\Projects\gripfactory Practical\branches\GFLiteMetrcAPI` (its `app\` is the app). If your working folder is not under `branches\GFLiteMetrcAPI`, stop and say so. Under THE DISPATCH RULE (canon 0.30.155).

RUN AFTER L2. Pin: the L2 gated tree `661ad9c2df803333` (415 files, gated 2026-10-21 with the Scribe's test batch fix). Verify with canon's hash command in `app/` and stop if it differs. No git; nothing committed, pushed or deployed. One migration, `0115`. LF only. Read big files by search and line range (`src/strainperformance.ts` from `buildStrainPerformance`, the dried filter and `dryLbPerPlant`; `src/fieldestimates.ts` `estimateFor` and `estimatesAsOf`; `src/plantweight.ts` as the live tile pattern; `src/labsamples.ts` as the upload pattern that reads a sheet by header names).

## 1. The table (migration 0115)
`dd_season_yields`: id, season INTEGER (2024, 2025), strain TEXT (as typed in the sheet), strain_id null (matched to the strain table by name when one matches, case and spaces aside), farm_code null (blank is farm wide), plants INTEGER, dry_lb NUMERIC (448 g pounds), source TEXT (upload), note, created_at, created_by, updated_at, updated_by, deleted_at, deleted_by, delete_reason. Unique on (season, strain, farm_code) among live rows, enforced in the action. Nothing seeded. Guarded and idempotent.

## 2. The upload (Admin, Director Dashboard, Past Seasons, behind the Admin PIN)
- Takes an xlsx or csv with the columns Season, Strain, Farm (optional), Plants, Dry lb, read by header name (readXlsxSheets, the first sheet). A preview first (rows, the strains matched to the strain table and the ones not matched, duplicates), then commit; a second upload of the same rows writes nothing; a changed row updates and logs to record_change_log with reason "past seasons upload". A row with no season, no strain or no plants is refused and named; the rest land.
- The page lists what is held: per season, the strains, plants and dry lb, and the farm wide totals; delete a row with a reason.
- The sheet's shape in words on the page, so Logan knows what to send: "Season, Strain, Farm, Plants, Dry lb; one row per strain per season (per farm if you have it)."

## 3. The tile (`harvest.dry_lb_per_plant_vs_plan_pct`, farmops wall; the registry row renamed)
- Registry (in the 0115 migration and src/directorregistry.ts together): title_en "Yield per Plant: seasons", title_es "Rendimiento por planta: temporadas"; unit lb448; cadence daily; dims "strain,farm"; goal_kind none (the plan column goes; the field estimate stays as the projection's basis, named in the compute); status live; def_version 2; compute_key: "per strain and farm wide: dry lb per plant for the two prior seasons from dd_season_yields (dry_lb over plants), their average over the seasons the strain was grown, this year to date (strainperformance dryLbPerPlant over dried lots with plant counts, the console's dried filter), and this year projected (dried dry lb plus the field estimate in force per plant times the plants of lots cut but not yet dried, over all plants cut)". The registry test moves with it.
- A table, one row per strain grown this year (the market strain as strain performance names it), then a farm wide row in bold, with the columns: 2024, 2025, Avg (2 seasons), 2026 to date, 2026 projected. Dry lb per plant, two decimals. A strain not grown in a prior season shows "not grown" in that cell and its average is the one season it has; a strain with no prior seasons at all shows "new" in Avg. The season labels come from the data (the two most recent seasons held, not fixed years).
- THE DISTINCTION, his word: the two 2026 columns carry different heads ("2026 to date" and "2026 projected"), the projected cell is set in the muted color with a small "projected" word under the number, and the head of the column says in a tooltip or a line under the table: "Projected: dried lots as weighed plus the field estimate for lots still hanging or drying. Final when the last lot is unloaded." When every lot of the year is dried, the projected column reads "final" and equals to date.
- Under the table: "N strains; to date over M dried lots with plant counts; K lots still drying". Lots without a plant count are left out of both 2026 numbers and counted in the note.
- Sort by this year's projected, highest first; the farm wide row last. Fits at 1920, 820 and the phone (the phone shows strain, Avg, to date, projected; the two season columns under a toggle).
- Hover or tap on a strain row: the plants and dry lb behind each number.
- Read live (the strain performance figures are already computed for /harvest; reuse their builder, do not rewrite the dried filter). The wall must stay under 0.5 s warm on the live-data bench; report the time. Store the farm wide to date and projected numbers in dd_kpi_values daily (dim "todate" and "projected") on the cron and Recompute, so the check-in and the detail page carry a number.

## Tests
- The upload: preview and commit, duplicates refused, a changed row updates with its log, a refused row named, strain matching by name.
- The tile math on a fixture: two seasons, one strain grown both years, one grown in one, one new this year; to date equals strain performance's number for the same lots; projected with two lots still drying at the estimate in force; "final" once all are dried.
- The farm wide row equals the sums, not a mean of the strains.
- The registry row's new title and compute; the migration text equals ddSeedSql().
- No dash characters in any output.

## Smoke and gates
Smoke: `About to apply 114 migration(s)` (L2's read 113). Upload a six row past seasons sheet, seed two dried lots and one drying lot with plant counts and a field estimate, load the farmops wall, check the five columns for one strain and the farm wide row; keep every other check. Gates: typecheck 0; vitest under both time zones with counts; `node --check scripts/smoke.mjs`; the from zero smoke (SMOKE PASS, no 500); renders of the upload page and the farmops wall in Lite, CO and Cerberus at 1920, 820 and the phone; dash, CR and name scans of every touched file. On a live-data bench (the Scribe): this year's to date per strain against /harvest's strain performance.

## Hand back
Report `SESSION_REPORTS/2026-10-20_dd_l3_yield_per_plant_seasons.md`, short: the tree received and left, files touched, gate results, timings, anything declined and why. Close with the tree hash and that nothing is committed, pushed or deployed.
