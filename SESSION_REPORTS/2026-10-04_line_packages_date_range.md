# 2026-10-04 Line packages, a date range

MINI BRIEF R1, LINE PACKAGES, A DATE RANGE (canon 0.30.398). No migration. The smoke pin stays 94. Not deployed. Nothing committed. Nothing pushed. No git was run.

This session opened while BRIEF L4 was still on the worktree and had no session report. The window was built on that tree. L4's report, `SESSION_REPORTS/2026-10-04_labels_l4.md`, was written afterward and its seal is the same bytes for every shared file (`src/index.ts` `9f46d071ff36b169`, `src/i18n.ts` `8b155d49c51d0046`, `scripts/smoke.mjs` `473d7066ca1c7dd0`, and the four files below). L4's tree hash `24b7982823f39aed` (297 files, migrations 0001 to 0094) includes this window.

## The window

Reports, Line packages, takes From and To (`from`, `to`) beside the same Date start, Line, and Operator. The window is `[etInstant(from, start), etInstant(dayAfter(to), start))`, Eastern. From equal to To is that one day: the date's start time to the next day's start time, the same instants the single Date used.

Both default to the farm's today. An old link with `date=` and no `from` or `to` reads as From = To = that date.

To before From: the report swaps them and the footnote says "To was before From, so the report swapped them." A range longer than 92 inclusive days is refused in words ("Pick 92 days or fewer.") and the query is not run. A value that is not a date is refused in words ("That is not a date.").

The line under the title states the window, for instance "2026-10-04 06:00 to 2026-10-05 06:00, Eastern". Rows keep Entered. The per line totals in the footnote cover the whole range. CSV, XLSX, and PDF carry the same rows, totals, and window line. The help line under the form is "From the From date's start time to the day after To at the same time, Eastern. The default is Admin's farm day start hour." in EN and ES.

The lines, the Rad run's `started_at`, the lot rule, and the bud percent are unchanged.

## The page

On the smoke database, From and To both default to 2026-10-04, Date start is 06:00, and the heading is "2026-10-04 06:00 to 2026-10-05 06:00, Eastern". Trim, Prepack, Cryo, and Rad rows are on the page, including BUD-SMOKE-1. Submitting To 2026-10-01 against From 2026-10-04 swaps the window to "2026-10-01 06:00 to 2026-10-05 06:00, Eastern" and the footnote says the dates were swapped. `?from=2026-01-01&to=2026-06-01` says "Pick 92 days or fewer." and lists no packages. `?date=2026-10-04` fills From and To with that date and shows the one day window.

## Gates

- `npx tsc --noEmit`: exit 0.
- `npx vitest run`: 90 files, 1211 tests passed under `TZ=UTC`, and 90 files, 1211 tests passed under `TZ=America/New_York`.
- `node --check scripts/smoke.mjs`: exit 0.
- From-zero smoke (`SMOKE_PORT=9406`, `WRANGLER_SEND_METRICS=false`, `CI=1`, `TZ=UTC`): About to apply 94 migration(s), SMOKE PASS, no ` 500 ` line, exit 0. The one ` 503 ` line is `POST /api/send`, the smoke's own asserted step. L4's later smoke on port 9412 passed the same tree.
- Dash (U+2013, U+2014), CR and BOM audits by character on the touched files: 0.

## Deploy

Not deployed from this session. Nothing committed. Nothing pushed. No git was run. Say deploy when you want it on the grip worker.

## Sealed final check

```
npx tsc --noEmit                      exit 0
TZ=UTC npx vitest run                 90 files, 1211 tests passed
TZ=America/New_York npx vitest run    90 files, 1211 tests passed
node --check scripts/smoke.mjs        exit 0
SMOKE_PORT=9406 WRANGLER_SEND_METRICS=false CI=1 TZ=UTC npm run smoke
                                      About to apply 94 migration(s); SMOKE PASS; " 500 " lines: 0; " 503 " lines: 1 (POST /api/send); exit 0
dash audit: 0; CR audit: 0; BOM: 0
L4's sealed tree, which includes this window
                                      24b7982823f39aed (297 files, migrations 0001-0094)
```

```
app/src/reports.ts                           34950  e4b3db25482f892d
TAIL footnote: `Year ${year}.`,\n  };\n}\n
app/src/html.ts                             197508  2c715682475853fa
TAIL ;b.addEventListener("input",save);});}catch(e){}})();</script>`;\n}\n
app/src/xlsx.ts                              20066  b7fdc01844fc86d0
TAIL (new TextDecoder().decode(xml), strings));\n  }\n  return out;\n}\n
app/src/index.ts                            175098  9f46d071ff36b169
TAIL cheduled };\nexport { app };\nexport default worker;\n
app/src/i18n.ts                             263925  8b155d49c51d0046
TAIL rds.vars) : t(locale, err.message);\n}\n
app/scripts/smoke.mjs                       790596  473d7066ca1c7dd0
TAIL h((err) => {\n  console.error(err);\n  process.exit(1);\n});\n
app/test/reports.test.ts                     12481  c9c7c627d179ac4e
TAIL ")).toContain(\n      "dia siguiente a Hasta"\n    );\n  });\n});\n
```
