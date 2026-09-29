# 2026-09-29 Product Mix totals and pounds

V14 (canon 0.30.307), built in the worktree `branches/GFLiteOpsDashboard` under THE DISPATCH RULE (canon 0.30.155), after V5 and before V6. No migration. The smoke pin stays at 81. Not deployed. Nothing committed. No git was run.

## What changed

Product Mix by weight (`/reports/product_mix`) gains a Lbs column between Grams and Percent. The column's row value is the row's grams. The page, the CSV, and the PDF show it as pounds at 448 grams to the pound, two decimals with thousands separators. The XLSX writes a number cell with the two-decimal format (`XlsxCell.lbs`, style `s="3"`, `#,##0.00`).

When the year has rows, the last row is Total: Package type "Total", grams the sum, pounds that sum over 448 (not the sum of the rounded pounds), percent 100.00. The row carries `_total: 1`. The page and the PDF render it with `report-total` (bold, a top rule). The CSV and the XLSX carry it as a plain last row. An empty year has no Total row. On the screenshot's six types the totals row is Total, 37,202,174, 83,040.57, 100.00. BUD is 19,214.66 lb and TRIM is 48,358.71 lb.

`formatLbs` and `gramsToLbs` are unchanged. The other reports keep their columns. The year filter, the export names, and the footnote are unchanged. "Lbs" and "Total" were already in the dictionary, so `src/i18n.ts` was not edited. The page cell render lives in `src/html.ts`, which now uses the same `reportCellText` as the CSV and the PDF.

## Assumptions for his word

- Lbs sits between Grams and Percent, two decimals, thousands separators. This build followed that reading.
- The totals row's pounds are the total grams over 448 (on his numbers the two ways agree at 83,040.57). This build followed that reading.
- The Percent of the totals row reads 100.00 (the shares are of the year's total). This build followed that reading.
- The `lbs` flag is a house column any report can take later; only Product Mix takes it in this slice.

## Gates

Run in the worktree's `app/`.

- `npm run typecheck`: exit 0.
- `npx vitest run`: 69 files, 977 tests passed under `TZ=UTC`, and the same under `TZ=America/New_York`.
- `node --check scripts/smoke.mjs`: exit 0.
- From-zero smoke (`SMOKE_PORT=9215`, `WRANGLER_SEND_METRICS=false`): `About to apply 81 migration(s)`, `SMOKE PASS`, ` 500 ` lines: 0, exit 0. The Product Mix page carries Lbs and a `report-total` row. The CSV export's last line begins with Total.
- Dash audit: 0 on every file below (U+2014 and U+2013). No CR byte in those files.
- `METRC_INTEGRATOR_KEY = "`, `METRC_USER_KEY = "`, `MS_CLIENT_SECRET = "`, `SENSORPUSH_PASSWORD = "`, `CLOUDFLARE_API_TOKEN=`, and `CLOUDFLARE_API_TOKEN: "` do not appear in those files. No personnel data.

## Deploy

Not deployed from this session. Nothing committed. No git was run.

## Sealed final check

```
npm run typecheck                     exit 0
npx vitest run (TZ=UTC)               69 files, 977 tests passed
TZ=America/New_York npx vitest run    69 files, 977 tests passed
node --check scripts/smoke.mjs        exit 0
SMOKE_PORT=9215 WRANGLER_SEND_METRICS=false node scripts/smoke.mjs
                                      About to apply 81 migration(s); SMOKE PASS; " 500 " lines: 0; exit 0
dash audit: 0; CR audit: 0; secret grep: no values; personnel data: none
```

```
app/src/reports.ts                     26826  ecde0c210a1009ee
TAIL }
app/src/xlsx.ts                         9979  100bb3287d91d36f
TAIL }
app/src/html.ts                       192658  512557574ab60530
TAIL }
app/src/theme.ts                      170306  ccec1bb9f5bd3569
TAIL }
app/scripts/smoke.mjs                 628538  2e78c7ab3c16f27f
TAIL });
app/test/reports.test.ts                2676  229a8514ac1b6393
TAIL });
```
