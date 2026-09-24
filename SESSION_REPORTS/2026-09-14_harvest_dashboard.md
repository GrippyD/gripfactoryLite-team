# Session report: THE HARVEST DASHBOARD (canon 0.30.63), Scribe-direct, 2026-09-14

**Scribe:** Gripfactory Lite Scribe (Cowork), Scribe-direct under G-2. A worker-only report slice, no migration (it reads the plant count of 0045). Six forks answered by the owner through AskUserQuestion before the build; one left open by his word.

## The owner, verbatim

"Create a new report.

Harvest Dashboard:

Select Date/Range

PNN:[Plants Remaining]/[Total Plants] - % harvested - Wet Wet/Plant AVG - Dry Weight/Plant AVG - BTR average
ARL:[Plants Remaining]/[Total Plants] - % harvested - Wet Wet/Plant AVG - Dry Weight/Plant AVG - BTR average
PNS:[Plants Remaining]/[Total Plants] - % harvested - Wet Wet/Plant AVG - Dry Weight/Plant AVG - BTR average

Wet Weight Harvested/DLH
Trimmed/DLH (input) - BTR
Cryo'd/Radded/DLH (output)

Lbs waiting for testing
Lbs in testing"

His picks: **BTR** = bud grams over trim grams from Trim Packages Entry, averaged per farm over the range; **DLH** typed on the dashboard, one box per farm for the range (no new table); **plants** = the METRC mirror's live plants under the farm's licenses for remaining, plus the plant counts on the farm's finished lots this season for the total; **testing pounds** by queue vs lab sample; **Radded**: "I'll specify later", so the line reads not tracked yet.

## The law

The report `harvest_dashboard` heads the Reports page. Its form carries From and To (inclusive; a blank To is today, a blank From is January 1 of To's year, From never after To) and three hours boxes `dlh_pnn`, `dlh_arl`, `dlh_pns`. The view is one grouped table, the farms and All as columns, the metrics as rows, three sections as group heads:

- **Harvest.** Plants remaining / total plants: remaining = live plants (`gone_at` NULL, flowering and vegetative) in `metrc_plants` joined to the license's `farm_code` in Admin's license lookups; total = remaining + SUM(`plant_count`) over finished lots of the harvest year (To's year); % harvested = that sum over the total. Wet weight / plant avg = wet grams over plant counts of the range's counted lots (the batch entry date in the range); dry weight / plant avg the same over the counted lots with a dry total. BTR average = SUM(bud grams, `is_bud = 1`) / SUM(TRIM grams) over trim packages whose trim date (else creation date) falls in the range; blank when no trim was cut.
- **Per labor hour.** DLH typed (All adds the farms); wet weight harvested (all finished lots in the range) and per DLH; trimmed (every trim package in the range) and per DLH; BTR; cryo'd (cryo weights set in the range, by cryo date else update date) and per DLH; Radded / DLH "not tracked yet". A farm without typed hours reads "type DLH".
- **Testing.** Lbs waiting for testing = WIP packages in the Testing Queue whose lot's HBN has no external test row; lbs in testing = those with one, until release; the package's cryo weight when set, else its weight; 453.59237 g per lb. All column only.

Every cell is display text (commas, two decimals, one-decimal percent, two-decimal ratio); CSV, XLSX and PDF ride the reports node's lanes unchanged; the footnote states the range, the harvest year and every definition above.

## What shipped

- `src/dashboard.ts` (new): the types, `parseDashboardRange`, `parseDlh`, `harvestDashboardView(input)` (pure), `loadHarvestDashboard(db, range, dlh)` (six Postgres-portable queries).
- `src/reports.ts`: `harvest_dashboard` first in REPORT_KEYS and REPORT_CARDS.
- `src/index.ts`: the filter form (From, To, the three DLH boxes) and the view builder branch.
- `src/i18n.ts`: the card title and blurb, DLH, hours (EN and ES).
- `test/dashboard.test.ts` (new, 9 cases): the matrix shape and card order; the plants line and percent (1,842 / 1,962 and 6.1% for PNN; All counts an unassigned license's plants); wet and dry per plant over counted lots alone (100.00, 25.00, All dry 22.11); BTR 3.00 and blank where no trim; the per-DLH lines (699.90, type DLH, 1,375.00, All 892.79 over 14 h); testing pounds 2.00 / 0.00; the footnote and the CSV header; the range and DLH parsers.
- `scripts/smoke.mjs`: the landing card; after the Load Silo count the dashboard renders its three group heads with the plants line, "not tracked yet", "type DLH", the kept DLH value and the range boxes; the CSV starts `Section,Metric,PNN,ARL,PNS,All` and carries the Radded line.

## Sealed final check

```
npx tsc --noEmit -> 0
npx vitest run -> 24 files, 577 tests passed (568 + 9)
rm -rf .smoke-persist && SMOKE_PORT=8835 WRANGLER_SEND_METRICS=false timeout 285 npm run smoke
  -> "About to apply 45 migration(s)", SMOKE PASS (exit 124 is the teardown hang)
Visual pass (static Grip render of reportPage(harvestDashboardView(fixture)), chromium full page):
  the form (From, To, DLH PNN/ARL/PNS, Apply filters, the three export buttons), the table with
  HARVEST / PER LABOR HOUR / TESTING heads, the farm columns and All, the footnote.
Dash audit (dashboard.ts, reports.ts, index.ts, i18n.ts, dashboard.test.ts, smoke.mjs, this report) -> 0 each
Committed, staged back, sha256 equal both sides:
  src/dashboard.ts        53fd3fbfe8fdf27d   15,905 bytes
  src/reports.ts          74c0438d4bbfc25e   24,465 bytes
  src/index.ts            2cd4b18c2beffcb4  105,406 bytes
  src/i18n.ts             b82c5e2b40fadbd7  103,172 bytes
  test/dashboard.test.ts  1a46dd5eb0ef1471    6,642 bytes
  scripts/smoke.mjs       c06c53e95ba19a80  320,602 bytes
Migrations 0001-0045 in the tree; smoke pin 45; next is 0046.
Deploy: rides the 0045 deploy at the owner's hands (his three commands), or one deploy:grip after it.
```

## Flags

The range filters lots by the batch entry date (the harvest date), trim by trim date and cryo by cryo date; a lot's plants count toward the season total only when a count was typed, so the % harvested reads low until the crew answers the prompt. Plants under a license with no farm assignment in Admin count in All alone. Radded and the dry-weights numbering wait on his word; the license-to-farm mapping is Admin's, so a new license needs its farm set there before the dashboard sees it.
