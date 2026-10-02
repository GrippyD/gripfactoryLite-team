# BRIEF V21: POST HARVEST PUZZLES (canon 0.30.351)

For the build session (Claude Code or Cursor) opened in the worktree `branches/GFLiteOpsDashboard` (its `app/` is the app), under THE DISPATCH RULE (canon 0.30.155): a report on the Reports page, Post Harvest Puzzles, one row per strain for a harvest year, the same columns and arithmetic as the owner's workbook's `results` sheet; the 2025 year imported once from that workbook, 2026 and later computed from the app's own lots. Built on the worktree exactly as it stands after BRIEF V20, THE LINE PACKAGES REPORT, is merged and pushed (the Scribe writes the tree hash into this line at the paste; if the hash on the disk differs, stop and say so). Migration 0089 (after V18's 0088); the smoke pin moves to 89.

## The sources (verbatim)

The owner, 2026-10-02, in chat, with the workbook `post harvest puzzles copy.xlsx` (19 sheets; the Scribe holds it, and the build session gets a copy at `app/test/fixtures/` only as a synthetic stand-in, see 7):

"see the attached.  I want a report [Post Harvest Puzzles] organized by Harvest year and then essentially identical to this spreadsheet's amalgamated output"

His picks, 2026-10-02:

- the 2025 data: "Import this workbook (Recommended)": a drop pane in the report takes the workbook once and lands its data and InTesting sheets as the 2025 history; 2026 and later compute live.
- the plan columns: "Typed per strain (Recommended)": editable cells on the report, saved per strain per year with a reason; for harvest year Y the column reads "Y+1 Allocation".
- the prices: "Admin lookups (Recommended)": Bud $/lb seeded at 150, Trim $/lb seeded at 30.

THE AMALGAMATED OUTPUT is the `results` sheet: every farm together (the per-farm sheets `PNNresults`, `PNSresults`, `ARLresults` are the same arithmetic over one farm's rows). Its rows are strains; its source is the `data` sheet (one row per lot, 189 lots, every one a 2025 lot) and, for the test columns, the `InTesting` sheet (2,592 rows). The Scribe recomputed all 29 strain rows from `data` with the law below: every computed cell matches the sheet to the cent.

## The law

1. THE PAGE. Reports key `post_harvest_puzzles`, titled "Post Harvest Puzzles". Filters: Harvest year (a select of the years that have history rows or app lots, newest first, the newest by default) and Farm (All, PNN, PNS, ARL; All by default, the amalgamated output). CSV, XLSX and PDF through the reports module, as the other reports.
2. THE ROWS. One row per strain for the year (the strain of the lot: `strains.name` through `harvest_batches.strain_id` live, the `Strain` column in history). The strain "R&D" is left out (the sheet leaves it out). Rows ordered by $PP, highest first.
3. THE COLUMNS, in this order, with these headers (the sheet's two typos corrected), every pound the app's 448 g (`GRAMS_PER_LB`):
   - Strain.
   - Plants: the sum of the lots' plant counts.
   - Wet lbs: (spear wet g + bucked wet g) / 448.
   - Dry lbs: (Total Bud Wt + Total Other Weight) / 448, where the per-lot Total Bud Wt = bud + mixed + smalls and Total Other Weight = trim + shake + bio + kief (the sheet's `data` X and Y; `results` D adds them). This is the sum of every product type, not the lot's scale dry weight.
   - Dry %: Dry lbs / Wet lbs.
   - Total Bud: (bud + mixed + smalls + shake) / 448. Shake counts as bud here, as the sheet does.
   - Total Trim/Bio: (trim + bio) / 448. Kief is in Dry lbs and in neither of these two, as in the sheet.
   - Wet #s PP: Wet lbs / Plants.
   - Dry #s PP: Dry lbs / Plants.
   - BTR: Total Bud / (Total Bud + Total Trim/Bio).
   - BPP: Dry #s PP x BTR.
   - TPP: Dry #s PP - BPP.
   - $PP: BPP x Bud $/lb + TPP x Trim $/lb (the two Admin lookups).
   - Average THC: the mean THC Potency % of the year's tests that belong to the strain (5).
   - TYM Fails: the strain's tests whose status is Failed and whose fail reason names yeast ("Total Yeast & Mold", case-blind on "yeast").
   - # Tests: the strain's first-attempt tests (attempt 1).
   - TYM% Failed: TYM Fails / # Tests.
   - Harvest Date: the earliest entry date among the strain's lots that year.
   - "{Y+1 two digits} Allocation" (for 2025: "26 Allocation"): typed (6).
   - TC or IH: typed (6).
   A division by zero shows a dash, never NaN. Formats: pounds two decimals with thousands commas; percentages one decimal; $PP as dollars with two decimals; THC two decimals; the date as YYYY-MM-DD.
4. THE TOTALS, under the table, as the sheet's rows 31 and 32: Plants, Wet lbs and Dry lbs summed; under Wet lbs and Dry lbs the per-plant figure over all rows (Wet lbs total / Plants total, Dry lbs total / Plants total); the Allocation summed, and beside it the Allocation plus the new strains' allocations (6).
5. WHICH TESTS ARE THE STRAIN'S. A test belongs to harvest year Y when its HBN's lot token is year Y (the last five characters' first two digits, the V19 season law). Within the year, a strain's tests are the tests whose tested strain is one of the market strains of the strain's lots that year (the sheet's own formula for Average THC: it matches InTesting's Strain against the set of `data` Market Strain values of the strain's rows). When that finds none, the tests whose HBN is one of the strain's lots. Live: the market strain is `harvest_batches.market_strain` (null reads as the strain's own name); the tests are `external_test_results` read as V19 reads them (`deleted_at IS NULL AND (source <> 'sheet' OR on_sheet = 1)`), potency `potency_result`, fail reason `failure_mode`, `attempt`.
6. THE PLAN, typed. A new table holds per harvest year and strain name: the next season's allocation (whole plants) and TC or IH (free text, short). The two cells are editable on the report for the year (a small form per row, a reason required, logged like the Admin lookups under the actor). Below the table, "New strains for {Y+1}": plan rows whose strain has no lot in year Y, each with its allocation and its note (the sheet's T33 to V42 block: allocation, strain, "conception" or "in house"), with an Add row form. Farm filter does not filter the plan.
7. THE 2025 HISTORY (the drop pane). On the report, an Import pane that takes an .xlsx and lands it as history for the year its lots carry:
   - The `data` sheet by header name (Date, METRC Harvest Tag, Harvest Batch Name, Farm, Grow Method, Strain, Market Strain, Associated Batch, Is Bio/FFZ?, Plants, Wet Spear Weight (grams), Bucked Wet Weight (grams), Dry Weight (grams), Bud Weight (grams), Mixed Weight (grams), Smalls Weight (grams), Trim Weight (grams), shake, Bio Weight (grams), Kief Weight (grams)), one history row per lot, keyed by Harvest Batch Name; the headers carry a line break in the workbook ("Wet Spear Weight\n(grams)"), so match on whitespace-collapsed text. Blank cells are zero for the sums and null for the store.
   - The `InTesting` sheet through the existing parser (`rowsFromSheet` and `assignAttempts`, `src/intesting.ts` 143-235), landed as history tests, never into `external_test_results` (the V19 picture of the live year must not change).
   - The `results` sheet's typed plan: its Allocation and TC or IH columns per strain and the T33 to V42 block, into the plan table for the year.
   - The year is the lots' token year; a second import of the same year replaces that year's history and its imported plan rows (typed edits made in the app after the import are overwritten only with a confirm checkbox on the pane). The pane reports counts: lots, tests, plan rows.
   - The app reads .xlsb today (`src/xlsb.ts`) and only writes .xlsx (`src/xlsx.ts`). Add a small .xlsx reader (the zip's central directory, `DecompressionStream("deflate-raw")` for deflated parts, `xl/sharedStrings.xml`, `xl/workbook.xml` for sheet names, the sheet XML's cells, cached values only) that yields the same grid type `readXlsbSheets` yields, so the parser runs unchanged. Dates come as serials (1900 system).
   - Read the history when the year has history rows; otherwise compute live. A year never mixes the two.
8. THE LIVE YEARS (2026 on). Lots: `wet_weight_entries` with their `harvest_batches` for `harvest_year = Y`, both `deleted_at IS NULL`, every lot (a lot still weighing adds its plants and wet weight and no product, as a sheet row with blank product does). Plants: `wet_weight_entries.plant_count` (null is zero). Wet: the lot's `wet_weights` sum, as the console's ledger reads it (spear and bucked are both in it). Products: the lot's trim packages (`wip_packages` with `NON_TRIM_SOURCE_SQL`, `src/config.ts`), `deleted_at IS NULL`, by `package_type_code`: BUD bud, MIX mixed, SMALLS and WPR smalls, SHAKE and SHA shake (canon 0.30.88: "WPR means SMALLS", SHA is SHAKE), TRIM trim, BIO bio, KIEF kief; WASTE and any other code left out. Harvest Date: the lot's `harvest_batches.entry_date`. Farm: `harvest_batches.farm_code`.
9. THE PRICES. Admin, Lookups: two buttons after Max Tote Weight, "Bud $/lb" (`app_config` key `php_bud_price_per_lb`, default 150) and "Trim $/lb" (`php_trim_price_per_lb`, default 30), each 0 to 10,000 with two decimals and a reason, on `saveConfigNumber` (`src/actions.ts`, the Max Tote Weight's pattern). No migration for these.
10. THE HIGHLIGHTS, as the sheet's conditional formats: the ten highest Dry #s PP, BTR, $PP and Average THC shaded green (`#C6EFCE`, text `#006100`); the ten highest TYM% Failed shaded red (`#FFC7CE`, text `#9C0006`); in dark mode the theme's success and danger tints. A key under the table: "10 best" in green, "10 worst" in red, "PP = per plant". (The sheet's key says "per pound"; every PP column divides by plants, so the key says plant. The Scribe flags it to the owner.)
11. MIGRATION 0089: the history lots table (the 20 `data` fields plus `harvest_year`, `import_id`, the audit columns), the history tests table (the `InTestingRow` fields the report reads: strain, hbn, potency, status, failure_mode, attempt, required_test, plus `harvest_year`, `import_id`, audit), the plan table (`harvest_year`, `strain_name`, `allocation_plants`, `tc_ih`, `note`, `is_new_strain`, `source` 'import' or 'typed', audit; unique on year and strain name); indexes on `harvest_year`.
12. WORDS: EN and ES for every new label, header, refusal and help line.

## The check figures (2025, Farm All, from the workbook; the gate re-imports the real workbook in the sandbox)

- Totals: Plants 95,092; Wet lbs 2,206,779.11; Dry lbs 443,944.33; per plant 23.21 wet, 4.67 dry; Allocation 95,600, with the new strains 102,320 (6,720 new, ten strains).
- Cereal Milk: Plants 1,066; Wet 30,495.04; Dry 8,712.96; Dry % 28.6%; Total Bud 2,732.79; Total Trim/Bio 5,980.17; Wet PP 28.61; Dry PP 8.17; BTR 31.4%; BPP 2.56; TPP 5.61; $PP $552.84; THC 22.94; TYM 7; Tests 52; TYM% 13.5%; 2025-10-10; 5,600; TC.
- Every computed column of all 29 strains equals the sheet's. The sheet typed its TYM Fails, # Tests and three THC cells by hand; the report counts them, so these differ from the sheet and are expected (strain: report against sheet): THC Bermuda Triangle 25.28 / 25, Jealousy 25.64 / 26, BCC x Jealousy 22.77 / 22.55; TYM Augustus Gloop 5 / 4, Strawberry Pie 0 / 2, Sherbcake 3 / 5, Jelly Donut 16 / 11, Gush Mintz 1 / 0; Tests: 15 of 29 match, the rest differ (Bermuda Triangle 451 / 590, Gelonade 331 / 563 the largest). The test counts depend on `assignAttempts` numbering the attempts; the Scribe's figures read the sheet's own Retest Attempt Number. Say in the report what the parser gives.

## The tests and the smoke

- Unit: the arithmetic on a synthetic year (three strains, five lots, one with no product, one with zero plants for the dash); the test membership (market strain match, the HBN fallback, the year token); the type mapping (WPR to smalls, SHA to shake, WASTE out); the .xlsx reader on a fixture the test builds with `buildXlsx` plus a deflated part; the import replacing a year; the plan save refusing without a reason. No personnel names in any fixture (G-9); the workbook's notes column is not stored.
- Smoke: Admin's two price lookups read 150 and 30; the report renders for the smoke's 2026 lots with the columns in order; an import of a small synthetic workbook lands its lots and the year appears in the select; a typed allocation saves and reads back.
- Gates as always: typecheck 0; vitest under `TZ=UTC` and `TZ=America/New_York`; `node --check scripts/smoke.mjs`; the from-zero smoke (`About to apply 89 migration(s)`, SMOKE PASS, no ` 500 `). No git; nothing committed, pushed or deployed. Report to `SESSION_REPORTS/` with the tree hash, the files touched and the figures your import of a synthetic workbook gave.
