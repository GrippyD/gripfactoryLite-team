# 2026-10-02 The Line Packages Report

BRIEF V20, THE LINE PACKAGES REPORT (canon 0.30.344), built in the worktree `branches/GFLiteOpsDashboard` under THE DISPATCH RULE (canon 0.30.155), on the app tree this session had just landed for V19 (`d80e0d2d5a477a2e`, 264 files, migrations 0001 to 0088). The owner said to take 18, then 19, then 20, then 21 on this disk. The app tree after these edits hashes `104299a21bfc1d06` (265 files). No migration. The smoke pin stays 88. Not deployed. Nothing committed. Nothing pushed. No git was run.

## What changed

- Reports key `line_packages`, title "Line packages", card blurb "Every package a line put out on a day: Trim, Prepack, Cryo/Rad; the day read from its start time."
- Filters: Line (All, Trim, Prepack, Cryo/Rad; default All), Date (the farm's today), Date start (the Admin farm day start hour as HH:00, default 06:00), Operator (case-blind contains). A start that is not HH:MM falls back to that default and the footnote says so. The help under Date start is the brief's sentence.
- The window is `[etInstant(date, start), etInstant(the next calendar day, start))`. Trim and Cryo use the package's `created_at`. Prepack uses the line's `created_at`. Rad uses the run's `started_at`. A Rad run that has not started is absent. The typed Effective Date is a column (`trim_date`, `cryo_date`, `work_date`, and the farm day of the Rad start).
- Columns, in order: Line (the group), Entered (Eastern wall clock), Lot (Trim's short id, Prepack's parent HBN, Cryo's run HBN, Rad through `radLotNumber`), Package tag, Type (Prepack is "{unit} g x {bags}"; Rad is "{item}, {grey} Gy"), Weight (g), Weight (lb) at 448, Effective date, Operator (Trim and Cryo the typed name; Prepack and Rad the person's display name, blank when that person is gone). Rows sort Trim, Prepack, Cryo, Rad, then Entered.
- Totals in the footnote, and a `_total` row per line in the CSV, the XLSX, and the PDF. The page hides those rows and keeps the footnote. Trim adds the type grams and the bud percent from `parseBtrTypeCodes` (SMALLS counts as bud with BUD and SHAKE). The operator filter counts only the rows it kept.
- Empty words: "No packages on this line in this window." EN and ES for the new labels, the help, the empty line, the bad-start line, and the totals.
- `src/db.ts`: `listLinePackages`. `src/rad.ts`: `radLotByTag`. `src/index.ts`: the defaults, the filter form, the view. `src/html.ts`: the line packages page drops the `_total` rows. `scripts/smoke.mjs`: the card on `/reports`; after the Rad run starts, the default page shows 06:00, the date, the Trim package from this run with its typed Effective date, the Cryo, Prepack, and Rad groups, the unit-by-bags type, the trim operator filter, a 23:00 start judged against the smoke's own Eastern clock, the CSV total, and the PDF total.

## Assumptions for his word

- Line is Trim, Prepack, and Cryo/Rad. Cryo and Rad share one filter value and show as two groups.
- The day is the entry instant from the start time he sets through the same time next calendar day, Eastern. The farm day start hour is only the default. The Effective Date is shown, not filtered.
- Prepack and Rad have no typed operator. The person on the entry stands as the operator.
- Totals are per line shown. Trim's bud percent uses the console's type list. The report does not restate the shift cards.
- The page shows the footnote and not the total rows. The CSV, the XLSX, and the PDF keep the total row at the end of each group.

## Gates

Run in the worktree's `app/`.

- `npm run typecheck`: exit 0.
- `npx vitest run`: 78 files, 1053 tests passed under `TZ=UTC`, and 78 files, 1053 tests passed under `TZ=America/New_York`.
- `node --check scripts/smoke.mjs`: exit 0.
- From-zero smoke (`SMOKE_PORT=9320`, `WRANGLER_SEND_METRICS=false`, `CI=1`, `TZ=UTC`): About to apply 88 migration(s), SMOKE PASS, no ` 500 ` line, exit 0 (17701 lines of log; the one ` 503 ` line is `POST /api/send`).
- Dash audit: 0 on the ten files (U+2014 and U+2013). No CR byte. No BOM.
- No key, secret, or password value added. No new personnel name in the test or this report.

## Deploy

Not deployed from this session. Nothing committed. Nothing pushed. No git was run.

## Sealed final check

```
the tree this slice opened on        d80e0d2d5a477a2e (264 files; V19, migrations 0001-0088)
npm run typecheck                     exit 0
TZ=UTC npx vitest run                 78 files, 1053 tests passed
TZ=America/New_York npx vitest run    78 files, 1053 tests passed
node --check scripts/smoke.mjs        exit 0
SMOKE_PORT=9320 WRANGLER_SEND_METRICS=false CI=1 TZ=UTC node scripts/smoke.mjs
                                      About to apply 88 migration(s); SMOKE PASS; " 500 " lines: 0; " 503 " lines: 1 (POST /api/send); exit 0
dash audit: 0; CR audit: 0; BOM: none; secret values: none; personnel data: none
the app tree after the edits             104299a21bfc1d06 (265 files)
```

```
app/src/reports.ts                         30435  34ea6fb3e722a076
TAIL }
app/src/db.ts                             219377  8b5fa76892b0f765
TAIL }
app/src/index.ts                          163701  414fe5069725300f
TAIL export default worker;
app/src/html.ts                           197402  d7ad873e3a50412a
TAIL }
app/src/rad.ts                             30696  b56fc579641d7f77
TAIL }
app/src/i18n.ts                           203457  50b92beb2537208a
TAIL }
app/scripts/smoke.mjs                     727696  96454fd730c65468
TAIL });
app/test/reports.test.ts                    5967  b12f8d1140ac9d71
TAIL });
app/test/linepackages.test.ts               3580  c4bf315933377043
TAIL });
app/test/console.test.ts                   70950  0c8cf415f281a536
TAIL });
```
