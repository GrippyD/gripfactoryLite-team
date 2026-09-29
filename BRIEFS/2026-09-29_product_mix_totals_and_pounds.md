# BRIEF V14: PRODUCT MIX TOTALS AND POUNDS (canon 0.30.307)

For the build session (Claude Code or Cursor) opened in the worktree `branches/GFLiteOpsDashboard` (its `app/` is the app), under THE DISPATCH RULE (canon 0.30.155), a small slice his ruling of 2026-09-29 adds to THE BRANCH PLAN (`BRIEFS/2026-09-28_the_branch_plan.md`), built after V5 and before V6. Canon wins over this brief where they differ; read `canon/_NOW.md` first. No migration; the smoke pin stays where V5 leaves it. Commit nothing, push nothing, deploy nothing, run no git.

## The ruling (owner, 2026-09-29, verbatim, with a screenshot of the report)

"Can you add a totals row to this report and a column for weight in lbs (448 grams)"

The report is Product Mix by weight, `/reports/product_mix`: Year, Apply filters, the three exports (CSV standard, XLSX pretty, PDF pretty), the table Package type, Grams, Percent, the footnote "Year 2026.". His screenshot: BIO 314,583 (0.85), BUD 8,608,166 (23.14), SHAKE 385,740 (1.04), SMALLS 3,765,001 (10.12), TRIM 21,664,700 (58.24), WPR 2,463,984 (6.62).

## What the Scribe read (main `8bf1986`)

1. THE VIEW. `productMixView(rows, year)` in `src/reports.ts` builds a `ReportView` of three columns (`package_type`; `grams`, flagged `grams: true`; `percent`, a string to two decimals of the share of the year's total) and one row per package type, with the footnote. The page, the CSV (`reportCsv`), the XLSX (`reportXlsx`) and the PDF (`reportPdfHtml`) all render the same view: a `grams` column is formatted with `formatGrams` (thousands separators) on the page, in the CSV and in the PDF, and written as a number cell with the grams format in the XLSX (`XlsxCell { number, grams }`); a column whose key starts with `_` is hidden; `groupedRowsHtml` renders the body rows for the page and the PDF.
2. THE POUND. One pound is 448 grams (canon, `GRAMS_PER_LB`); `gramsToLbs` and `formatLbs` in `src/compliance.ts` give the value to two decimals; `format2` in `src/config.ts` formats a two-decimal number.
3. THE ROUTE. `src/index.ts` builds the view for `product_mix` from the year's rows; the smoke's report walk asserts the landing link and the page.

## The law to build

1. THE POUNDS COLUMN. `ReportColumn` gains `lbs?: boolean`. A column flagged `lbs` holds grams in its row value and renders as pounds at 448 grams to the pound, two decimals with thousands separators ("19,214.66"), on the page, in the CSV and in the PDF; in the XLSX it is a number cell with a two-decimal format (a `lbs` flag on `XlsxCell` beside `grams`, or a number cell with the format the sheet builder already offers). The Product Mix view gains the column `lbs` with the label "Lbs" between Grams and Percent, its row value the row's grams.
2. THE TOTALS ROW. When the view has rows, one last row: Package type "Total", grams the sum of the rows' grams, lbs that sum at 448 (the total's own grams over 448, not the sum of the rounded pounds), percent "100.00". The row carries `_total: 1`; the page and the PDF render it bold with a top rule (a `report-total` class on the `tr`), the CSV and the XLSX carry it as a plain last row. No totals row when there are no rows. On his screenshot the totals row reads Total, 37,202,174, 83,040.57, 100.00; BUD reads 19,214.66 lb and TRIM 48,358.71 lb.
3. NOTHING ELSE MOVES. The other reports keep their columns; the year filter, the exports' names and the footnote unchanged; `formatLbs` and `gramsToLbs` untouched.
4. THE PROOFS. `test/reports.test.ts` (or the file that pins `productMixView`): the view from the screenshot's six rows carries the Lbs column and the Total row with the figures above; the CSV's last line is `Total,"37,202,174","83,040.57",100.00` in the CSV's own quoting; the XLSX's Lbs cells are numbers; the PDF's body carries the `report-total` row; an empty year has no Total row. `scripts/smoke.mjs`: the report page carries "Lbs" and a `report-total` row, and the CSV export's last line begins with Total.

## Assumptions for his word

- Lbs sits between Grams and Percent, two decimals, thousands separators.
- The totals row's pounds are the total grams over 448 (on his numbers the two ways agree at 83,040.57).
- The Percent of the totals row reads 100.00 (the shares are of the year's total).
- The `lbs` flag is a house column any report can take later; only Product Mix takes it in this slice.

## Files

`src/reports.ts` (the column flag, the renderers, `productMixView`); `src/xlsx.ts` (the two-decimal number cell); `src/i18n.ts` (only if "Lbs" or "Total" need an ES word: the house shows "lb" already; "Total" is in the dictionary); `scripts/smoke.mjs`; tests as named.

## Gates and the hand-back

`npm run typecheck` 0; vitest both zones; `node --check scripts/smoke.mjs`; the from-zero smoke at the pin V5 set with `SMOKE PASS` and no 500; dash audit 0 on every file touched; no personnel data; no key, secret or password. Report `SESSION_REPORTS/<date>_product_mix_totals_and_pounds.md` in the worktree with the sealed final check and the assumptions above. Commit nothing, push nothing, deploy nothing, run no git. His hands after the gate: the pre snapshot from the main folder's `app` with the block stopping on its failure, `git checkout -- canon` in the main folder before the merge, then the three acts; the workflow has nothing to apply.
