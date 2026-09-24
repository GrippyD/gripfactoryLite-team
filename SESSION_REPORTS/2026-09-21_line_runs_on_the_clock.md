# 2026-09-21 The Line Runs on the Clock (canon 0.30.163)

Scribe-direct under G-2 (a rule change on a live surface, small, no migration), on the LIVE floor of 0.30.161 (worker 4da7640c, migrations 0001-0065). Worker-only deploy; from-zero pin stays 65. Owner, 2026-09-21, verbatim: "Switch trimming to "running" if it's currently the correct time and any lot is present in the queue.  It's not currently showing \". His hours on the question tool: "6-6 and 6-6".

## The law, as built

1. THE SHIFT ON DUTY: the Day shift's hours are 6:00 AM to 6:00 PM Eastern, the Second shift's 6:00 PM to 6:00 AM (a window may wrap midnight; its start is inside, its end is not). The hours are values in data when the rows exist (app_config `trim_shift_day_hours`, `trim_shift_second_hours`, HH:MM-HH:MM), the code's 6-6 and 6-6 otherwise; no migration seeded them.
2. RUNNING: a shift card runs when the Eastern clock is inside its hours and at least one lot stands in the Unloaded Queue for trim (a lot in status unloaded with a live trim schedule row, the pane Trim Packages Entry picks from), or when one of its operators weighed a package in the last 30 minutes (the earlier pick, kept). The word RUNNING pulses in the card head and the picture's stripes move, as before. The section footnote names the rule and the hours.
3. THE FIGURES carry `onDuty` and `hours_window` per shift beside `running`; the loader counts the queue and reads the two hours rows with the rest.

## What changed

- `src/farmday.ts`: `etClockMinutes(iso)`, the Eastern wall clock in minutes since midnight.
- `src/config.ts`: `CONFIG_KEYS.trim_shift_day_hours`, `trim_shift_second_hours`; `TRIM_SHIFT_HOURS_DEFAULT`; `parseShiftWindow`, `shiftWindowHolds`.
- `src/console.ts`: `TrimInput` gains `queueLots`, `nowIso`, `shiftHours`; the figures gain `onDuty`, `hours_window` and the clock rule in `running`; the loader's queue count (`TRIM_SCHEDULED_SQL`) and hours reads; the footnote.
- `src/i18n.ts`: the footnote, EN and ES.
- `test/console.test.ts`: the windows (defaults, wrap, the start in and the end out, a whole-day window, malformed and spaced values), the Eastern clock, on duty and running by the queue at 10:30 AM and 11:15 PM Eastern, an empty queue, hours from data, no instant; `test/farmday.test.ts`: the loader's new reads.
- `scripts/smoke.mjs`: the Unloaded Queue is read at the same moment as the console; with the queue empty both cards stand still, with a lot in it the shift on duty by the clock runs (the on-duty key computed from the wall clock at run time); after the extra lot is scheduled the on-duty card runs.

## Scribe assumptions (his word owed if wrong)

- The 30-minute rule stays as a second trigger (he did not answer the second question; with 6-6 and 6-6 one shift is always on duty, so it matters only for an operator weighing on the other shift's card).
- The queue is the Unloaded Queue for trim (status unloaded with a scheduled trim row), not the production schedule at large.
- The window's end is exclusive: 6:00 PM belongs to the Second shift, 6:00 AM to the Day shift.

## Gates

- `npx tsc --noEmit`: exit 0.
- `npx vitest run`: 42 files, 772 tests passed; the same under TZ=America/New_York.
- `node --check scripts/smoke.mjs`: ok.
- From-zero smoke (SMOKE_PORT=9067): `About to apply 65 migration(s)`, `SMOKE PASS`, no 500.
- Dash audit: 0 on every file below.

## Deploy (his hands; worker only)

```powershell
cd "C:\Users\DennisWallace\Documents\Claude\Projects\gripfactory Practical\app"
npm run deploy:grip
```

## Sealed final check

```
npx tsc --noEmit                      exit 0
npx vitest run                        42 files, 772 tests passed
TZ=America/New_York npx vitest run    42 files, 772 tests passed
node --check scripts/smoke.mjs        ok
rm -rf .smoke-persist && SMOKE_PORT=9067 WRANGLER_SEND_METRICS=false timeout 285 npm run smoke
                                      About to apply 65 migration(s); SMOKE PASS; " 500 " lines: 0
src/config.ts               55976  ffadcbf02122890f
src/console.ts              68458  2bc6fa3c4eb19d2e
src/farmday.ts               9217  ff86e8e744393a55
src/i18n.ts                133730  894c21da01257622
test/console.test.ts        42774  3af40c9334a0b39d
test/farmday.test.ts        17449  2d81e61adbf94dd3
scripts/smoke.mjs          505781  6fc6bccc242a1b04
dash audit: 0 on every file above
```
