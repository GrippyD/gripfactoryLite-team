# 2026-10-01 The Rad start time

BRIEF V9.2, THE RAD START TIME (canon 0.30.330), his addendum to V9 (BRIEF V9, canon 0.30.327; its gate 0.30.328; the gate's fix BRIEF V9.1, canon 0.30.329), built in the worktree `branches/GFLiteOpsDashboard` under THE DISPATCH RULE (canon 0.30.155), on the worktree as it stood after V9.1: V9 as received with V9.1's seven edits landed, the app tree `516bc3f2b239e24a`, not yet committed. V9.1 was finished first by its own brief (its report `SESSION_REPORTS/2026-10-01_the_rad_available_law.md`, amended once after its critics, 7,073 bytes `79555e90c585bf9f`). Ten files touched, listed in the seal; the app tree now hashes `64a357f2992d12bd`. No migration; the smoke pin stays 85. Not deployed. Nothing committed. No git was run.

## What changed

- `src/farmday.ts`: `wallClock24From12(hhmm, meridiem)`, pure: "HH:MM" with HH 01 to 12 and MM 00 to 59, AM or PM trimmed and case folded; 12 AM is 00, 12 PM is 12, 1 to 11 PM add twelve; the 24-hour "HH:MM" back, or "" when the shape is off. `etClock12(iso)`: the Eastern wall clock of an instant on the 12-hour clock (Intl, `America/New_York`, `hourCycle: "h12"`, two-digit hour and minute) with its AM or PM, for the prefill; a blank hhmm when the value is not an instant.
- `src/html.ts`: `time12MaskScript()` beside `time24MaskScript`, the same digits-and-colon shape on `[data-time12-mask]`.
- `src/config.ts`: the reason `rad_start_time_set` ("rad start time set") in `SYSTEM_REASON`.
- `src/actions.ts`: `setRadStartTime(db, runId, form)`, exported. An unknown run is a 404 ("Unknown run."); a run not running a 400 ("That run is not running."); a shape that is not HH:MM on the 12-hour clock with AM or PM a 400 ("Start time must be HH:MM."). The day is the farm day of the run's current `started_at` (`farmDay` with the start hour from `farmDayStartHour(db)`); the instant is `farmInstant(day, hhmm24, startHour)`, so a time before the start hour falls on the next calendar date of that farm day, the silo's own rule; no lower bound inside the farm day. An instant ahead of now beyond ten minutes is a 400 ("Start time is ahead of now."). An unchanged instant writes nothing and still answers the flash. The write: `UPDATE rad_runs SET started_at = ?, updated_at = ?, updated_by = ? WHERE id = ? AND deleted_at IS NULL` and one log row (`rad_runs`, field `started_at`, the old instant, the new instant, the actor, reason `rad start time set`); `started_by` stays the person who pressed Start. The redirect is `radOperationRedirect("start_time")`.
- `src/index.ts`: `POST /compliance/rad_operation/run/:id/start_time` beside `/start` and `/unstart`.
- `src/rad.ts`: on the Running in the Rad card, after the Scheduled and Started stamps, `<div class="rad-start-line" data-rad-start-line>` holds the existing `silo-clock` span and then the form `data-rad-start-time` posting to the route: the label "Start Time" (muted, for the box), the text box `name="start_time"` with `placeholder="HH:MM"`, `inputmode="numeric"`, `pattern="(0[1-9]|1[0-2]):[0-5][0-9]"`, `maxlength="5"`, `autocomplete="off"`, `data-time12-mask`, prefilled with the run's current start in farm time on the 12-hour clock; the select `name="meridiem"` with AM and PM, the current one selected; Save. Enter in the box submits the form. The scheduled and completed cards carry no box. The flash `start_time` reads "Start time saved."; `radOperationPage` emits `time12MaskScript()` once after `clockScript()`. The clock's zero on the next render is the new instant (`data-started`), the Started stamp reads it through `etWallClock`, the completed card's elapsed time and Reopen's return to running follow it.
- `src/theme.ts`: `.rad-start-line { display: flex; flex-wrap: wrap; align-items: baseline; gap: 0.5rem; }`; the form inside it a flex row of its own (label, box, select, button; the box 4.5rem wide, the brief's "about"). The sheets size every `select` to the full width and, on the phone, every button in `main` too, so the form gives its meridiem select and its Save button `width: auto`, else each would take a line of its own; on the phone the line wraps under the clock; the card's grid otherwise untouched. The box at 4.5rem leaves about 2.9rem for the five characters once the sheets' padding is taken; if his eye sees the last digit cut, 5.5rem (the PIN box's width) is one number.
- `src/i18n.ts`: "AM" and "PM" the same in both languages; "Start time saved." / "Hora de inicio guardada.". The key "Start Time" / "Hora de inicio" already stood in the dictionary with the brief's words, so the line reads it and no second key was added (a duplicate key would not compile); the silo's "Start time" key stays as it is. The refusals' words are the silo's, English on the error page as thrown. No zone word on the line.
- `test/rad.test.ts`: three cases. The two pure helpers (12:00 AM to 00:00, 12:30 PM to 12:30, 01:05 PM to 13:05, 11:59 PM to 23:59, a trimmed lowercase meridiem; "13:00", "7:05", "12:60" and a blank meridiem refused; `etClock12` of known instants, a non-instant blank). A running run's start set to an earlier wall clock on its farm day by a second person (the row's `started_at`, `started_by` unchanged, `updated_by` the second person, the one log row with the old and new instants under `rad start time set`); a time before the start hour on the next calendar date, twice; the same time again a no-op with the flash and no new log row; the four bad shapes refused; an unknown run 404; a scheduled run refused before Start; ahead of now beyond ten minutes refused on a run whose farm day is still to come, the row unchanged. The running card renders the line after the clock with the prefilled box, the pattern, the mask and the selected meridiem, EN and ES; the scheduled and completed cards without it; the mask script once; the flash.
- `scripts/smoke.mjs`: `etClock12Smoke` beside the farm-day helpers; after `radStart` puts run B in the Rad and the running pane carries the clock, the walk reads run B's `data-started`, posts `start_time` with the farm-time 12-hour clock thirty minutes before that instant (or the farm day's 06:01 AM when the run started within the first thirty minutes of the farm day) with its meridiem, expects 303 to `?ok=start_time`, then reads `data-started` equal to `Date.parse` of the resolved instant, the Started stamp moved, the flash "Start time saved." and the box prefilled with the saved start; posts a time one hour ahead of now and expects 400 with "Start time is ahead of now."; posts "13:00" PM and expects 400 with "Start time must be HH:MM."; posts the same time again and expects 303; then the `radUnstart` step as it stands. The smoke's later Rad steps are unchanged.

Nothing else moves: the Rad Schedule page, the Available law of V9.1, Start, Unstart, Complete, Reopen, the effect on the testing queue and the gate, the log's other reasons, the silo's Start time and `resolveLoadedAt` are untouched. Nothing to METRC. No migration.

One note on the build itself: the first application of the edits was truncated by a fault in the applier's parser (every replacement cut to its first line); the typecheck caught it at once, the ten files were restored from the V9 stage tar and the verified V9.1 reproductions to their exact V9.1 hashes (the tree read `516bc3f2b239e24a` again, every file checked), and the edits were applied once more, whole. The files' modification times show the two writes; the bytes are the second.

## Assumptions for his word

- The box sets the running run's `started_at`, the actual start, in farm time on the farm day the run was started on; the person who pressed Start stays `started_by`; the log carries the old and new instants under `rad start time set`.
- The clock, the Started stamp, the elapsed time on the completed card and the record all follow the edited start; the Scheduled stamp is not touched by it.
- The box is on the running card alone; a completed run's start is corrected by Reopen (behind the PIN), the box, and Complete again. If he wants the box on the completed card too, that is one more form.
- The 12-hour clock needs AM or PM beside the box; the select carries them. The Rad's box is the first 12-hour entry in the app; the silo's Start time stays 24h (canon 0.30.9) unless he says the word.
- A time ahead of now beyond ten minutes is refused, the silo's grace; a time before the farm's start hour falls on the next calendar date of the run's farm day (the farm day runs past midnight), and a Start pressed after six for a run that began before six on the prior farm day is the one case the box cannot reach (a date would be one more field).
- Saving the same time again is a no-op that still says "Start time saved." One edge of that: Start stores the instant with its seconds, and the box resolves to the whole minute, so a Save on the untouched prefill in the first minute after Start moves `started_at` back by up to fifty-nine seconds and logs one row; from then on the same time again is the no-op the brief names. If he wants the Start press itself on the minute, that is one line, his word.
- No zone word on the line.
- Three of the build's own. The smoke's ahead-of-now step posts a time one hour ahead of now when that hour is still on the run's farm day, else the farm day's last minute (05:59 AM on the next date); when neither can be named ahead of now (the farm day's last thirteen minutes or so, and the fall-back day's repeated hour, where a wall clock lands on its first instance) the walk says so on one line and moves on instead of asserting; a second reviewer swept every minute of ten Eastern days, the farm-day boundary and both 2026 daylight-saving edges included, and the smoke's target resolved to the server's instant in every one. The unit test's ahead-of-now case moves a running run's `started_at` to a farm day in 2030 so the refusal does not depend on the hour the suite runs. The one case the box cannot reach (a Start pressed after six for a run that began before six on the prior farm day) meets the refusal "Start time is ahead of now.", since the earlier wall clock resolves on the next calendar date of the run's farm day.

## Gates

Run in the worktree's `app/`.

- `npm run typecheck`: exit 0 (it regenerates the git-ignored `worker-configuration.d.ts` first).
- `npx vitest run`: 72 files, 1007 tests passed under `TZ=UTC`, and 72 files, 1007 tests passed under `TZ=America/New_York` (V9.1's 1004 plus the three new cases).
- `node --check scripts/smoke.mjs`: exit 0.
- From-zero smoke (`SMOKE_PORT=9255`, `WRANGLER_SEND_METRICS=false`, `TZ=UTC`): About to apply 85 migration(s), SMOKE PASS, no ` 500 ` line, exit 0 (16594 lines of log, an empty stderr; the Start Time posts answered 303, 400, 400, 303: the save, the hour ahead refused, "13:00" PM refused, the same time again; the ahead-of-now refusal was reached; the one ` 503 ` line is the smoke's own asserted no-key step on `/api/send`, 1 such line).
- Dash audit: 0 on the ten files (U+2014 and U+2013). No CR byte in them. No BOM.
- `METRC_INTEGRATOR_KEY = "`, `METRC_USER_KEY = "`, `MS_CLIENT_SECRET = "`, `SENSORPUSH_PASSWORD = "`, `CLOUDFLARE_API_TOKEN=`, and `CLOUDFLARE_API_TOKEN: "` do not appear in the ten files. No personnel data: the edits carry only the test fixtures' tags, strain and person ids.
- Changed against the V9.1 tree, not in the ten: none (`find -newer` the brief lists exactly the ten under `src`, `test`, `scripts` and `migrations`, plus the generated `worker-configuration.d.ts` outside the tree). `src/db.ts` stands at V9.1's 206,843 `771231ada4912288`; `src/rad.ts`, `test/rad.test.ts` and `scripts/smoke.mjs` are V9.1's bytes plus these edits.

## Deploy

Not deployed from this session. Nothing committed. Nothing pushed. No git was run. This slice rides with V9 and V9.1 in one commit after its gate; the merge block stands in the gate report for his hands.

## Sealed final check

```
the tree as it stood after V9.1      516bc3f2b239e24a (checked before the edits; restored and checked again after the applier's first, truncated pass)
the brief                                 11334  096309888ff4dab7

npm run typecheck                     exit 0
TZ=UTC npx vitest run                 72 files, 1007 tests passed
TZ=America/New_York npx vitest run    72 files, 1007 tests passed
node --check scripts/smoke.mjs        exit 0
SMOKE_PORT=9255 WRANGLER_SEND_METRICS=false TZ=UTC node scripts/smoke.mjs
                                      About to apply 85 migration(s); SMOKE PASS; " 500 " lines: 0; exit 0
dash audit: 0; CR audit: 0; BOM: none; secret grep: no values; personnel data: none
changed against the V9.1 tree, not in the ten: none
app/src/db.ts (V9.1's, untouched)            206843  771231ada4912288
the app tree after the edits             64a357f2992d12bd
```

```
app/src/farmday.ts                        10667  c47da16771edbec5
TAIL }
app/src/html.ts                          193298  5d99d84a7454bcf6
TAIL }
app/src/config.ts                         76341  178ff937de361fd4
TAIL }
app/src/actions.ts                       408178  1b672134f77a00ae
TAIL export { MANIFEST_COLUMNS, buckedPackageCode };
app/src/index.ts                         156746  ca6a7ebda2fd1b32
TAIL export default worker;
app/src/rad.ts                            27896  9d0a013fe91feb82
TAIL }
app/src/theme.ts                         177757  f5db725a2ad82d6e
TAIL }
app/src/i18n.ts                          195891  c2cb2f3e24c8e838
TAIL }
app/test/rad.test.ts                      20595  822eaef7a5d63a1a
TAIL });
app/scripts/smoke.mjs                    679481  91c973387cb7a823
TAIL });
```
