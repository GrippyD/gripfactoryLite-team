# MINI BRIEF R1: LINE PACKAGES, A DATE RANGE (canon 0.30.398)

For the build session that builds BRIEF L4 (Claude Code or Cursor, the worktree `branches/GFLiteOpsDashboard`), under THE DISPATCH RULE (canon 0.30.155): a small change to Reports, Line packages, built in the same session after L4 and gated and pushed with it (as V27a rode V27). If L4 is already handed back, build it on the worktree as L4 left it and say so. No migration.

## The source (verbatim)

The owner, 2026-10-04: "Line packages Report / Make it a date range where a date-to-that-same-date is just from the start date of that single day to the start date of the next day"

What the code holds (the live tree): the report (canon 0.30.344) takes one `date` and a `start` time (HH:MM, default Admin's farm day start hour); its window is `[etInstant(date, start), etInstant(dayAfter(date), start))`, Eastern (`src/index.ts`, the `line_packages` arms; `listLinePackages` in `src/db.ts`; the filter form in `src/html.ts`; the view in `src/reports.ts`). The smoke reads it with `?date=` at `scripts/smoke.mjs` near line 9045.

## The law

1. FROM AND TO. The filter's single Date becomes two dates, From and To (`from`, `to`), beside the unchanged Date start time, Line and Operator. The window is `[etInstant(from, start), etInstant(dayAfter(to), start))`: From's day at the start time up to the day after To at the same start time. So From equal to To is exactly today's one day: that date's start time to the next day's start time.
2. DEFAULTS. Both default to the farm's today, as Date does now. An old link with `date=` and no `from`/`to` reads as From = To = that date, so saved links and the smoke's `?date=` still work.
3. REFUSALS IN WORDS. To before From: the report swaps them and says so in the footnote. A range longer than 92 days: refused in words ("Pick 92 days or fewer."), no query run. A date that is not a date: refused in words.
4. THE PAGE. The heading line under the title states the window in words, for instance "2026-10-01 06:00 to 2026-10-05 06:00, Eastern". The rows keep their Entered date and time; the per line totals in the footnote cover the whole range. The CSV, XLSX and PDF carry the same rows, totals and window line. The help line under the form says "From the From date's start time to the day after To at the same time, Eastern. The default is Admin's farm day start hour." (EN and ES).
5. Nothing else in the report changes (the lines, the Rad run's started_at, the lot rule, the bud percent).

## The tests and the smoke

- Unit: From = To gives exactly the one day window (the same instants as today's code for that date and start); a three day range gives From's start to the day after To's start; a daylight saving edge inside the range (2026-11-01) keeps both ends at the wall clock start time; `date=` alone reads as From = To; To before From swaps with the note; 93 days refused; a non date refused.
- Smoke: keep the existing `?date=` reads passing; add `?from=<lineDate>&to=<lineDate>` (the same rows as `?date=`) and a two day range holding a package from each day.
- Gates as L4's, together with it.
