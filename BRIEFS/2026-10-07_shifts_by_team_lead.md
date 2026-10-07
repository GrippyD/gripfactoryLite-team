# BRIEF S1: TRIM SHIFTS BY TEAM LEAD, NOT BY THE CLOCK (canon 0.30.419)

For the build session (Claude Code or Cursor) opened in the worktree `C:\Users\DennisWallace\Documents\Claude\Projects\gripfactory Practical\branches\GFLiteOpsDashboard` (its `app\` is the app). NOT the main folder `gripfactory Practical\app`: if your working folder is not under `branches\GFLiteOpsDashboard`, stop and say so. Under THE DISPATCH RULE (canon 0.30.155). Built on the worktree as it stands LIVE after PC1, V29 and A1 (the Scribe pins the tree hash in the dispatch prompt once those are gated and live; if the disk differs from that pin, stop and say so). The tree hash is canon's command, run in `app/` with `wrangler.toml` read as LF: `(find src test scripts migrations -type f; echo wrangler.toml; echo tsconfig.json; echo package.json) | LC_ALL=C sort | xargs sha256sum | sha256sum | cut -c1-16`. One build agent in this worktree at a time. No migration.

## The source (verbatim)

The owner, 2026-10-07: "shifts need to be based on TL and not on time I think." On the Scribe's reading, verbatim: "Yes, that's the problem I'm seeing.  As an example, last night it seemed like [the second shift lead] had entered a bunch of trim packages and nothing else.  He doesn't enter his numbers until the end of his shift, but [the day shift lead] stayed behind and entered some of hers late." (names held back under G-9; they live in app_config only)

## What the data holds (read by the Scribe on `db_backups/20261007-155538_read_shifts`)

- A trim package's shift is already its operator (`trim_operator`, app_config `trim_shift_day_operators` the day lead, `trim_shift_second_operators` the second shift lead, matched without case). The clock enters twice:
  1. THE DAY. `trim_date` is the station's Effective Date, by default the farm day of the entry time (`farmDay`, start hour 6). The second shift lead types the whole night at the end of it, mostly between 00:00 and 06:00 (those land on the night's day, right), but sometimes after 06:00: on 2026-10-06 two entries at 06:xx (140,250 g, the 10-05 night) landed on 10-06. So last night the 10-06 Second Shift showed packages before anything was typed for that night. Over the season, 212 of the second lead's 1,502 packages sit a day late (most 2026-09-16 to 09-20, then 10 on 09-28, 2 on 10-06); none of the day lead's 1,317.
  2. ON DUTY AND RUNNING. `trimDuty` and the on duty flags read `trim_shift_*_hours` windows (code defaults 6-6) from the Eastern clock; "THE LINE RUNS ON THE CLOCK" lights the shift on duty while the queue holds a lot. With the second lead typing at the end and the day lead typing late, the clock and the entries disagree.

## The law

1. THE DAY FOLLOWS THE TEAM LEAD. When a trim package is weighed under the default Effective Date (not overridden), its `trim_date` is:
   - for an operator on the second shift list: the Eastern calendar date of the entry time less 12 hours (an entry before noon belongs to the night before; 10-07 05:40 and 10-07 06:30 both land on 10-06);
   - for an operator on the day shift list: the Eastern calendar date of the entry (the day lead typing at 19:00 stays on her day);
   - for an operator on neither list: the farm day, as today.
   An Effective Date typed with the Admin PIN still wins. The station's confirmation names the shift and the day the packages counted to ("Second Shift, 2026-10-06").
2. NO CLOCK ON THE TRIM SHIFTS. The trim section stops reading `trim_shift_day_hours` and `trim_shift_second_hours`: no on duty flag from the clock, no "line runs on the clock" rule. A shift reads Running while its own team lead entered a package in the last `TRIM_RUNNING_MINUTES`, else Down with the time since its lead's last entry, as today. An operator on neither list keeps the "Unassigned" line.
3. NOTHING ELSE MOVES. The shift figures, DLH typing, Weighted BTR and BTR to date, pasteurization (its lists are empty; it stays on its windows), the Effective Date control, and Line packages (it reads entry times) stay as they are. No stored date is rewritten by this brief: the 212 old packages get a separate repair after it is live, with his word.

## The tests and the smoke

- Unit: a second shift operator at 23:10, 03:00, 05:59 and 06:30 lands on the evening's date; at 12:30 on that day's date; a day shift operator at 19:00 on that day; neither list on the farm day; an overridden Effective Date wins; case and spaces in the name ignored; the trim section has no on duty flag and no clock rule; Running follows the lead's own last entry.
- Smoke: a smoke second shift operator posting at a 06:30 Eastern fixture time lands on the day before, and the dashboard's Second Shift of that day counts it; a day shift operator's late post stays on its day.
- Render check of the Trimming section at 1920 in Lite, CO and Cerberus.
- Gates as always: typecheck 0; vitest under `TZ=UTC` and `TZ=America/New_York`; `node --check scripts/smoke.mjs`; the from-zero smoke (`About to apply 94 migration(s)`), SMOKE PASS, no ` 500 `. Dash and CR audits by character; no personnel name in a tracked file (the names live in app_config only; tests use made-up names). No git; nothing committed, pushed or deployed. Report to the worktree's `SESSION_REPORTS/` with canon's tree hash and every file touched.
