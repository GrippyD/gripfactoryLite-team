# MINI BRIEF R4: HARVEST HOURS TO DATE ON THE TOTAL PANE (canon 0.30.409)

For the build session that builds MINI BRIEF R3 (`BRIEFS/2026-10-05_trim_btr_to_date.md`), under THE DISPATCH RULE (canon 0.30.155): one more figure on the dashboard's Plants section, Total pane, built in the same session after R3 and gated and pushed with it. Same pin as R3 (the live tree `335dfa13121944d5`, canon's hash command as R3 names it). One build agent in the worktree at a time. No migration.

## The source (verbatim)

The owner, 2026-10-05: "Can we add a Total DLH per farm and a total by date?  So when I click on today, it should be Harvest-to-date total of harvest hours?" Asked how a farm should count the days typed as one ALL number (since 2026-09-29), his answer, verbatim: "nvm on the per farm, just add it to the totals pane".

What the code holds (the live tree, `src/console.ts`): `consoleBoxes` gives the Total pane "Harvest Hours" for the day under view (the day's ALL row of `harvest_labor_hours` when it stands, else the sum of the day's farm rows) and "Weight/DLH" (the day's wet grams over those hours); `loadHarvestConsole` reads only the day's rows (`SELECT farm_code, hours FROM harvest_labor_hours WHERE work_date = ?`). Clicking a day in the day control sets the day under view.

## The law

1. THE FIGURE. On the Total pane, right after "Harvest Hours", a metric "Harvest Hours to date" (ES "Horas de cosecha a la fecha"): the sum, over every work date of the harvest year up to and including the day under view, of that date's hours by the same rule the day uses (the ALL row when one stands for the date, else the sum of the date's farm rows). Clicking a day shows the total through that day; today shows the season so far. Under it, in small type, "since {first work date}" (EN and ES).
2. NO HOURS YET: "type hours", as "Harvest Hours" says today.
3. NOTHING ELSE MOVES: the farm panes stay as they are (no per farm figure, his word); "Harvest Hours" and "Weight/DLH" stay the day's.

On the snapshot `db_backups/20261004-205213_wip_template`, for the check: rows from 2026-07-20 to 2026-10-02; through 2026-10-02 the farm days sum to 25,631.84 and the ALL days (09-29, 09-30, 10-01, 10-02) to 6,535, so 32,166.84 hours; through 2026-09-28 it is 25,631.84.

## The tests and the smoke

- Unit: the sum through a day with farm rows only, ALL rows only, and both on different dates; an ALL row on a date beside farm rows takes the ALL (as the day does); a date after the day under view stays out; last year's rows stay out; no rows gives the words.
- Smoke: the dashboard on a smoke day holds `data-hc-metric="hours_to_date"` (or the pane's key) after `hours`, with the smoke's figure; a later day's hours do not count on an earlier day.
- Render check with R3's, the same three views.
- Gates with R3's.
