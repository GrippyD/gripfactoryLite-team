# 2026-10-01 The Rad schedule and Rad operation

BRIEF V9, THE RAD SCHEDULE AND RAD OPERATION (canon 0.30.327), built in the worktree `branches/GFLiteOpsDashboard` under THE DISPATCH RULE (canon 0.30.155), on V8 as merged (main `3746d0c`, the app tree `7c2cbf6bae72a5d9`). One migration, `0085`. The smoke pin is 85. Not deployed. Nothing committed. No git was run.

## What changed

Migration `0085_rad_runs.sql` adds `rad_runs` (status `scheduled`, `running`, or `complete`; the grey; scheduled, started, and completed stamps with their actors; the audit columns) and `rad_run_packages` (run, tag, item type, grams, the lab state at scheduling, position, and the void columns).

The Compliance Console gains two tiles after Compliance Testing. Rad Schedule at `/compliance/rad_schedule` has three panes. Available lists live mirror packages of BUD, WPR, SHA, PRE, MOB, and WBP in NotSubmitted, TestFailed, or RetestFailed, on no open run, whose lineage the adopt precedent can mint. The sort is testing state, then product type in that order, then grow type (the batch's method through the lineage, else the HBN code's segment, Unknown last; Indoor, Outdoor, Greenhouse, then any other name), then the tag's last five as a number. Each row shows the last five, the type, the strain, the quantity, the state, the grow type, and `>>`. The filter `?q=` rides every post (the last five or the HBN). Scheduled lists the runs newest first: Grey (Gy) from 100 to 3000 by 100 with Save, the packages with `<`, and n of 10. `>>` lands on the newest scheduled run with room. When no scheduled run exists, a new run is born at the newest run's grey, or 100 the first time. When every scheduled run is full, the next package is refused. New run births an empty run. The last package off a run voids the run. An empty card has Remove run. Done lists completed runs of today and the six farm days before, with the words ready for testing.

Rad Operation at `/compliance/rad_operation` has Scheduled (`>>` Start), Running in the Rad (the clock from `started_at`, `<<` unstart, `>>` Complete), and Completed (`<<` Reopen behind the Admin PIN). An empty run refuses Start. A second Start refuses while one run is running. Every stamp is shown in farm time and written to the log.

Complete, in one batch, marks the tags pasteurized for the Testing gate (a completed run's tags join the cryo outputs in `isPasteurizedTag`). A live app row in `released` or `pasteurized` returns to `testing_queue` by the transition `rad_complete` (reason `rad run complete`). A row already in `testing_queue` is left as it is. A package the app never minted is adopted the way a prepack stranger is (the batch from the lineage, the row with source `metrc`, no prepack schedule) and born in the testing queue. Nothing is sent to METRC. Reopen returns the run to running and clears the completed stamp, so the pasteurized mark lifts. The package rows the effect moved stay where they are. Demote on the Testing Queue still steps back to the cryo queue.

## Assumptions for his word

- The order: V9 after V8, before V7 unless his walk of CSA and CSB lands first; V10 after.
- The first run ever takes a grey of 100, the lowest step, until the scheduler picks; every later run takes the newest run's grey, his "default to the last value".
- `>>` fills the newest scheduled run with room; New run starts another; a run holds one to ten packages.
- One run in the Rad at a time; a second Start is refused while one runs.
- Completion's effect: an app row returns to the testing queue; a package the app never minted is adopted from the mirror as the prepack adopt does and enters the queue for the first time; a lineage with no harvest keeps a package off the pane.
- The Ready pane of the Testing gate counts a package as pasteurized once a run with it completes (the cryo outputs' rule extended); a TestFailed or RetestFailed package after the Rad waits on the Testing Desk's retest and is not in Ready until METRC says NotSubmitted again, V4's law unchanged; if he wants failed-and-radded packages in Ready, that is one line.
- Reopen behind the PIN returns a run to running and lifts its pasteurized mark; the package rows the effect moved stand where they are.
- The Done and Completed panes show today and the six farm days before, the rest in the record and the log.
- The grow type for the sort comes from the app's batch through the lineage, else the HBN code's segment, else Unknown last; the product types sort in the doc's order with the two riders after (BUD, WPR, SHA, PRE, MOB, WBP).
- The grey is a whole number of Gray from 100 to 3000 by 100; nothing is written to METRC by any act on these pages.

## Gates

Run in the worktree's `app/`.

- `npm run typecheck`: exit 0.
- `npx vitest run`: 72 files, 1003 tests passed under `TZ=UTC`, and the same under `TZ=America/New_York`.
- `node --check scripts/smoke.mjs`: exit 0.
- From-zero smoke (`SMOKE_PORT=9255`, `WRANGLER_SEND_METRICS=false`, `TZ=UTC`): `About to apply 85 migration(s)`, `SMOKE PASS`, ` 500 ` lines: 0, exit 0. The Available pane orders state, type, grow type, and the last five, and the filter hides the rest. `>>` fills a run to ten and the eleventh is refused. The grey saves at 1500 and the next run takes it. `<` takes a package off. New run, then `>>`, lands on the newest open run. An empty Start is refused, a second Start is refused while one runs, the clock markup is on the running pane, and unstart returns the run to Scheduled. Complete puts a released row back in the testing queue, leaves a queued row's id as it was, and adopts a stranger into the queue. Done says ready for testing. The Ready pane gains the NotSubmitted packages. Reopen refuses a wrong PIN, leaves the moved row in the queue, and lifts that run's pasteurized mark.
- Dash audit: 0 on every file below (U+2014 and U+2013). No CR byte in those files.
- `METRC_INTEGRATOR_KEY = "`, `METRC_USER_KEY = "`, `MS_CLIENT_SECRET = "`, `SENSORPUSH_PASSWORD = "`, `CLOUDFLARE_API_TOKEN=`, and `CLOUDFLARE_API_TOKEN: "` do not appear in those files. No personnel data.

## Deploy

Not deployed from this session. Nothing committed. No git was run.

## Sealed final check

```
npm run typecheck                     exit 0
npx vitest run (TZ=UTC)               72 files, 1003 tests passed
TZ=America/New_York npx vitest run    72 files, 1003 tests passed
node --check scripts/smoke.mjs        exit 0
SMOKE_PORT=9255 WRANGLER_SEND_METRICS=false node scripts/smoke.mjs
                                      About to apply 85 migration(s); SMOKE PASS; " 500 " lines: 0; exit 0
dash audit: 0; CR audit: 0; secret grep: no values; personnel data: none
```

```
app/migrations/0085_rad_runs.sql          1060  eb11677b247b2a75
TAIL CREATE INDEX rad_run_packages_tag ON rad_run_packages (tag);
app/src/rad.ts                           26157  b2c9426486df1ff1
TAIL }
app/src/db.ts                           205901  6d8ccc429e6787bb
TAIL }
app/src/actions.ts                      405955  537eafb81fc75c41
TAIL export { MANIFEST_COLUMNS, buckedPackageCode };
app/src/config.ts                        76216  89c79de8eed18391
TAIL }
app/src/console.ts                      113057  89efc907f4998b54
TAIL }
app/src/compliance.ts                    26992  14846a3349fdb830
TAIL }
app/src/theme.ts                        177119  cf2f28b2ff8f8d9f
TAIL }
app/src/i18n.ts                         195649  351caa8d53a26591
TAIL }
app/src/index.ts                        156500  cb102b43123561fa
TAIL export default worker;
app/scripts/smoke.mjs                   672274  ead0d7ba67a1d146
TAIL });
app/test/rad.test.ts                     11476  828a18bcc3a9452d
TAIL });
app/test/console.test.ts                 69550  ad323ea16a25a63d
TAIL });
```
