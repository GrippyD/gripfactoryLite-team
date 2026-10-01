# 2026-10-01 The gate on the Rad Available law and the Rad start time (canon 0.30.332): PASSED

Scribe session. The gate on V9.1, THE RAD AVAILABLE LAW (BRIEF V9.1, canon 0.30.329, `BRIEFS/2026-10-01_the_rad_available_law.md`, 12,580 bytes, `3c7062f1edf46c60`; its report `SESSION_REPORTS/2026-10-01_the_rad_available_law.md`, 7,073 bytes, `79555e90c585bf9f`) and V9.2, THE RAD START TIME (BRIEF V9.2, canon 0.30.330, `BRIEFS/2026-10-01_the_rad_start_time.md`, 11,334 bytes, `096309888ff4dab7`; its report `SESSION_REPORTS/2026-10-01_the_rad_start_time.md`, 13,617 bytes, `e517b50c9b563c34`), both built on the worktree `branches/GFLiteOpsDashboard` by his Code session on V9 as received (the tree `188c24fb60d59ea9`, the V9 gate `SESSION_REPORTS/2026-10-01_gate_the_rad_schedule_and_rad_operation.md`, canon 0.30.328). His hand-back, verbatim in part: "the seven edits applied once each by a script that parsed the brief's own fences and wrote only after all four results matched in memory"; "the app tree `516bc3f2b239e24a`, the brief's gated tree"; "Built in the same worktree on the tree after V9.1 (`516bc3f2b239e24a`, checked before the edits), no migration, the pin 85. Ten files"; "The tree now reads `64a357f2992d12bd`; src/db.ts stands at V9.1's hash"; "Nothing committed, no git run." The disk agrees on every number.

VERDICT: PASSED, both slices. V9.1 is the gated tree of the V9 gate byte for byte (the four files at the hashes of 0.30.328, the tree `516bc3f2b239e24a` on his disk before V9.2 began; his Code session's own replay of the seven edits on the stage tarball's bytes said the same), so its seal stands and no second pass was needed. V9.2 passes every gate on the hand-back tree `64a357f2992d12bd`: the ten files of its seal and nothing else against the V9.1 tree; typecheck 0; 72 files and 1007 tests under UTC and New York; node --check; the from-zero smoke at pin 85 with SMOKE PASS and no 500 (run on the tree as first staged, `dc85b6947ea7de3c`, and again on the hand-back tree after his critics' three amendments); the helpers and the action read; the line driven in the browser (the mask, the pattern, the clock, the saved start moving the stamp and the clock's zero, the flash EN and ES); the pages rendered at 1920, 1366, 1100 and 390 for his eye; dash 0, CR 0, no BOM, no secret value, no personnel data in the change. The merge block below carries V9, V9.1 and V9.2 in one commit.

## What was gated

1. THE TREES. V9.1: the four files on his disk at the gated hashes (`src/db.ts` 206,843 `771231ada4912288`; `src/rad.ts` 26,492 `3027824f158d6c1f`; `test/rad.test.ts` 13,123 `21a080e88e7e0f0a`; `scripts/smoke.mjs` 674,156 `233af51816708362`), the tree `516bc3f2b239e24a`, read from the disk before the hand-back reached chat (0.30.330). V9.2: the worktree staged as a tarball (`gateV92.tar`, 10,168,320 bytes, `20dfdc302e2247d8`) and unpacked in the sandbox, the tree `dc85b6947ea7de3c` on both sides; exactly ten files differ from the V9.1 tree (`src/farmday.ts`, `src/html.ts`, `src/config.ts`, `src/actions.ts`, `src/index.ts`, `src/rad.ts`, `src/theme.ts`, `src/i18n.ts`, `test/rad.test.ts`, `scripts/smoke.mjs`), `src/db.ts` at V9.1's hash, the two repair files untouched. His critics then amended three of the ten (`src/theme.ts`: the meridiem select and the phone's Save button at `width: auto`; `test/rad.test.ts`: the Spanish label asserted inside the line; `scripts/smoke.mjs`: the comment and the skip line's words, no logic), restaged one by one and verified; the hand-back tree `64a357f2992d12bd` on his disk and in the sandbox; nothing else newer than the V9.2 brief under `src`, `test`, `scripts` and `migrations`.
2. THE HELPERS, read and tried. `wallClock24From12` takes "HH:MM" with HH 01 to 12 and MM 00 to 59 and AM or PM (trimmed, case folded): 12 AM is 00, 12 PM is 12, 1 to 11 PM add twelve, "" when the shape is off ("13:00", "7:05", "12:60", a blank meridiem). `etClock12` reads an instant on the farm's 12-hour clock through Intl (`America/New_York`, `hourCycle: "h12"`): 06:35Z is 02:35 AM, 16:00Z is 12:00 PM, 04:05Z is 12:05 AM, 03:59Z on the next date is 11:59 PM; a non-instant is blank. The unit test holds the fourteen cases.
3. THE ACTION. `setRadStartTime` refuses a run that is not running (400 "That run is not running."), a shape that is not the 12-hour HH:MM with AM or PM (400 "Start time must be HH:MM."), an instant ahead of now beyond ten minutes (400 "Start time is ahead of now."), an unknown run (404); the day is the farm day of the run's current `started_at` with the start hour from app_config, the instant `farmInstant` on it (a time before the start hour on the next calendar date of that farm day: on the Scribe's fixture a run started at 00:15 farm time, whose farm day is the date before, took "11:15 PM" as 23:15 of that date before, the rule holding across midnight); the write is one `UPDATE` of `started_at`, `updated_at` and `updated_by` with one log row (field `started_at`, the old and new instants, reason `rad start time set`); `started_by` stays the hand that pressed Start; an unchanged instant writes nothing and still answers the flash. The unit test walks a scheduled run refused, the set on a running run with the log row and `started_by` kept, the next-date rule, 12:00 AM, the no-op, the four bad shapes, the unknown run, and a run on a future farm day refused as ahead of now.
4. THE LINE. The running card renders `rad-start-line` holding the `silo-clock` span and the form `data-rad-start-time` (the label "Start Time" tied to the box by id, the box `start_time` with `placeholder="HH:MM"`, `inputmode="numeric"`, the 12-hour pattern, `maxlength="5"`, `autocomplete="off"`, `data-time12-mask`, prefilled with the start in farm time; the select `meridiem` with the current half selected; Save); `time12MaskScript` once after the clock script; the flash "Start time saved." / "Hora de inicio guardada."; the scheduled and completed cards without the box. The dictionary already held "Start Time" / "Hora de inicio", so AM, PM and the flash are the new keys.
5. THE SMOKE's walk after `radStart`: the running card's line checked, the start set thirty minutes back (or the farm day's 06:01 AM when the run began within its first thirty minutes) and read back in `data-started` and the Started stamp with the flash and the prefill, a time ahead of now refused (one hour on, or the farm day's last minute; the walk says so instead of asserting only when neither can be named ahead of now, which did not happen on either run here), "13:00" PM refused, the same time again 303; then unstart as before. `About to apply 85 migration(s)`, `SMOKE PASS`, no ` 500 ` line, on both runs.
6. THE BROWSER. From a fixture (a running run of three at 1500 Gy started at 00:15 farm time, a done run of two, a scheduled run of one): typing "023599" into the box leaves "02:35" (the mask: four digits, the colon after two); "13:00" fails the pattern, "02:35" passes; the clock reads 0d 01:00:42 then 0d 01:00:43 a second later; after the set the Started stamp reads 2026-09-30 23:15, the clock's `data-started` is that instant, the box reads 11:15 with PM selected, the flash shows, EN and ES. The line: at 1920 the clock and the form share one line ("0d 01:00:45 Start Time [11:15] [PM] Save"); at 1366 the form is one row under the clock; at 1100 and on the phone the Save takes a row of its own under the label, the box and the select. The pictures handed to his eye.

## Observations for his word (no hold)

- The ruling's line is the line at desktop width (1920); in a laptop's middle pane (1366, 1100) the form drops under the clock as the brief allowed, and at 1100 the Save sits on its own row. A compact styling (the label unbroken, the box, the select and the button at 1rem with slimmer paddings) puts the whole form on one row at 1100 and on the phone; the Scribe tried it in the sandbox (one CSS block in `src/theme.ts`, nothing else) and it is one line if he wants it, not carried.
- The label reads "Start Time" without the colon of his words, as the page's other labels read ("Grey (Gy)", "Scheduled", "Started"); one character if he wants the colon.
- A Save on the untouched prefill within the run's first minute moves the stored start from its seconds to the minute and logs one row (the instant differs by the seconds dropped); after that the same time is a no-op. Honest in the log, and the brief's no-op holds from the first typed minute on.
- In the Scribe's harness the console header's three buttons overflow a 390-px phone on every console page, V9.1's tree included; not this slice's, for his eye on a real phone.

## Gates on the hand-back tree (`64a357f2992d12bd`, the Scribe's sandbox)

- `npm run typecheck` with the generated types file deleted first: exit 0.
- `npx vitest run`: 72 files, 1007 tests passed; the same under `TZ=America/New_York`.
- `node --check scripts/smoke.mjs` and `node --check scripts/icon-proofs.mjs`: ok; `npm run proofs:icons`: the sheet 105,377 bytes, `85b22429de13e975`, unchanged.
- From-zero smoke (`SMOKE_PORT=9249`): `About to apply 85 migration(s)`, `SMOKE PASS`, no ` 500 ` line; the same on the tree as first staged (`SMOKE_PORT=9245`).
- Dash audit: 0 (em and en), no CR byte, no BOM, on the ten files and the two build reports. Secret grep: no value anywhere (the reports name the keys they checked, no values). No personnel data in the change.

## The merge (his hands; the snapshot first and the block stopping on its failure, the canon checkout before the merge)

```powershell
cd "C:\Users\DennisWallace\Documents\Claude\Projects\gripfactory Practical\app"
node scripts/db-snapshot.mjs pre_rad
if ($LASTEXITCODE -ne 0) { throw "snapshot failed, stop here" }
cd "C:\Users\DennisWallace\Documents\Claude\Projects\gripfactory Practical\branches\GFLiteOpsDashboard"
git add -A
git commit -m "V9: the Rad schedule and Rad operation, with the Available law and the start time" -m "Migration 0085: rad_runs and rad_run_packages. Two tiles on the Compliance Console. Rad Schedule: the mirror's live BUD, WPR, SHA, PRE, MOB and WBP packages in NotSubmitted, TestFailed or RetestFailed, sorted by state, type, grow type and the tag's last five, with the filter; runs of one to ten packages with the grey per run (100 to 3000 by 100, the newest run's value the default); Done with the completed runs. Rad Operation: Start one run at a time, the clock, Complete, Reopen behind the Admin PIN, every stamp logged. Complete marks the tags pasteurized for the Testing gate, returns a released or pasteurized app row to the testing queue, adopts a METRC-only package into it, and sends nothing to METRC. V9.1, the gate's fix: a completed package stays off Available until METRC moves its lab state. V9.2, the owner's addendum: the Start Time box after the running card's clock, HH:MM on the 12-hour clock with AM or PM in farm time, resolved on the server on the run's farm day, the start rewritten with one log row. Canon 0.30.332; the briefs and the reports ride in canon/, BRIEFS/ and SESSION_REPORTS/.`n`nCo-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`nClaude-Session: https://claude.ai/code/session_01VDz7UdaTSkjq69GvDfDWd7"
cd "C:\Users\DennisWallace\Documents\Claude\Projects\gripfactory Practical"
git checkout -- canon
git merge --no-ff GFLiteOpsDashboard -m "Merge V9: the Rad schedule and Rad operation, with the Available law and the start time"
git push
```

If the snapshot answers 7403 on its first query, run the snapshot line alone once more and then the rest. The push runs the workflow: typecheck, the tests, `apply migrations` (0085, the pin 85), the deploy. His paste back: the snapshot's last line, the push's output, the run's result and the Version ID from the deploy step's log; the Scribe reads main after the merge, folds LIVE, and the next brief is V7 DRYING after his live walk of CSA and CSB (ruling 12), else V10, pasteurization on the console. The stage tarballs `gateV9.tar` and `gateV92.tar` in the main folder root can go with the other two once this is merged.

## Sealed final check

```
V9.1 ON THE DISK (the gated tree of 0.30.328, 516bc3f2b239e24a, before V9.2 began)
app/src/db.ts                                 206843  771231ada4912288
app/src/rad.ts                                 26492  3027824f158d6c1f
app/test/rad.test.ts                           13123  21a080e88e7e0f0a
app/scripts/smoke.mjs                         674156  233af51816708362
the build report  2026-10-01_the_rad_available_law.md     7073  79555e90c585bf9f

V9.2, THE HAND-BACK TREE (64a357f2992d12bd, the same on his disk and in the sandbox)
rm worker-configuration.d.ts; npm run typecheck      exit 0
npx vitest run                        72 files, 1007 tests passed
TZ=America/New_York npx vitest run    72 files, 1007 tests passed
node --check scripts/smoke.mjs        ok
node --check scripts/icon-proofs.mjs  ok
npm run proofs:icons                  85b22429de13e975, 105377 bytes, unchanged
rm -rf .smoke-persist && CI=1 SMOKE_PORT=9249 WRANGLER_SEND_METRICS=false npm run smoke
                                      About to apply 85 migration(s); SMOKE PASS; " 500 " lines: 0
the same smoke on the tree as first staged (dc85b6947ea7de3c, SMOKE_PORT=9245)   SMOKE PASS; " 500 " lines: 0
the browser                           the mask "023599" to "02:35"; "13:00" fails the pattern; the clock 0d 01:00:42 then 0d 01:00:43;
                                      the set start 2026-09-30 23:15 on the stamp and in data-started; the flash EN and ES;
                                      one line with the clock at 1920, one row under it at 1366, the Save on its own row at 1100 and 390
the ten files (the seal of his report, verified byte for byte, device and sandbox):
app/src/farmday.ts                             10667  c47da16771edbec5
app/src/html.ts                               193298  5d99d84a7454bcf6
app/src/config.ts                              76341  178ff937de361fd4
app/src/actions.ts                            408178  1b672134f77a00ae
app/src/index.ts                              156746  ca6a7ebda2fd1b32
app/src/rad.ts                                 27896  9d0a013fe91feb82
app/src/theme.ts                              177757  f5db725a2ad82d6e
app/src/i18n.ts                               195891  c2cb2f3e24c8e838
app/test/rad.test.ts                           20595  822eaef7a5d63a1a
app/scripts/smoke.mjs                         679481  91c973387cb7a823
app/src/db.ts (V9.1's, untouched)             206843  771231ada4912288
changed against the V9.1 tree, not in the ten: none
the build report  2026-10-01_the_rad_start_time.md       13617  e517b50c9b563c34
dash audit: 0; CR audit: 0; BOM: none; secret grep: no values; personnel data: none
```
