# MINI BRIEF R3: WEIGHTED BTR TO DATE ON THE TRIM TOTALS BAR (canon 0.30.407)

For the build session (Claude Code or Cursor) opened in the worktree `branches/GFLiteOpsDashboard` (its `app/` is the app), under THE DISPATCH RULE (canon 0.30.155). One more figure at the far right of the trim totals bar on the dashboard. Built on the worktree exactly as it stands LIVE after L5 and R2 (worker `79db4872`, main `2bd6f36`, the app tree `335dfa13121944d5`, 299 files, migrations 0001-0094). The tree hash is canon's command, run in `app/`: `(find src test scripts migrations -type f; echo wrangler.toml; echo tsconfig.json; echo package.json) | LC_ALL=C sort | xargs sha256sum | sha256sum | cut -c1-16`; if the disk differs, stop and say so. One build agent in this worktree at a time. No migration.

## The source (verbatim)

The owner, 2026-10-05, with a screenshot of the bar (TOTAL LBS 6,793.83 lb, TOTAL HOURS 232, LBS/DLH 29.28 lb/h, WEIGHTED BTR 38.4% "both shifts, Total Bud over the shift totals"): "Add a Weighted BTR to date on the far right of the totals bar under the shift panes of trim on the dashboard"

What the code holds (the live tree): `trimTotalsLine` in `src/console.ts` draws the four cells (`hc-trim-total`, keys `lbs`, `hours`, `per`, `btr`); the day's Weighted BTR (canon 0.30.335) is both shifts' Total Bud over both shifts' totals. The bud types are Admin's `btr_type_codes` (live: `BUD,SMALLS,SHAKE`). The season's pooled BTR that a farm with no trimmed lot borrows (`consoleYields`, canon 0.30.376) counts finished lots only.

## The law

1. THE CELL. A fifth cell, key `btr_to_date`, at the far right of the totals bar: label "Weighted BTR to date" (ES "BTR ponderado a la fecha"), the value as a percent to one decimal like the day's, and under it "{n} lots, {lb} lb trimmed this season" (EN and ES).
2. THE FIGURE. Every live trim package (`wip_packages`, source null, not deleted) of this season's lots (the lot's harvest year is the farm day's year) weighed up to now: the grams of the bud types in Admin's `btr_type_codes` over the grams of every type, weighted by weight (one pool, never an average of percents). Lots still being trimmed count with what they have weighed so far; the day's own packages count too. No package yet: "no trim this season" in its place.
3. NOTHING ELSE MOVES. The four cells and their figures stay as they are; the season BTR that farms borrow (0.30.376) stays its own figure. Lite, CO and Cerberus, computer and phone (on a phone the bar wraps as it does now).

On the snapshot `db_backups/20261004-205213_wip_template` the Scribe reads, for the check: 2,629 live trim packages of 2026 lots, 37 lots, 47,022,171 g; bud types 15,225,788 g (BUD 8,686,419, SMALLS 5,984,173, SHAKE 555,196); so about 32.4 percent.

## The tests and the smoke

- Unit: bud types over all types by weight; a code moved in or out of `btr_type_codes` moves the figure; last season's lots and deleted packages stay out; a lot in progress counts what it has weighed; no package gives the words; the cell sits after `btr`.
- Smoke: the dashboard holds `data-hc-trim-total="btr_to_date"` after `data-hc-trim-total="btr"`, with the smoke's own figure.
- Render check at 1920 wide in Lite, CO and Cerberus, and phone width in one view.
- Gates as always: typecheck 0; vitest under `TZ=UTC` and `TZ=America/New_York`; `node --check scripts/smoke.mjs`; the from-zero smoke (`About to apply 94 migration(s)`), SMOKE PASS, no ` 500 `. Dash and CR audits by character; no personnel name in a tracked file. No git; nothing committed, pushed or deployed. Report to `SESSION_REPORTS/` with canon's tree hash and every file touched.
