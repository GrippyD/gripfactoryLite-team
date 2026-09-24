# 2026-09-20 The Farm Day Begins at Six and The Console Day (canon 0.30.151, 0.30.152)

Scribe sitting, built Scribe-direct under G-2, on the LIVE floor of 0.30.150 (worker 234c4737, migrations 0001-0063). Migration 0064 rides (a seed row, no table); from-zero pin becomes 64; next free migration 0065. Owner ruling 2026-09-20, verbatim: "Second shift ends the next day, how can I have the report date treat the start of the shift a the date?  Also, on the dashboard, can we do a universal date override?  It defaults to "yesterday" and I can change it to any other day?" His picks on the question tool: the hour, "6:00 AM"; the console's scope, "Hours can be pulled from a spreadsheet that I'll share" (the hours import is a request in waiting for his file; the console day built at the recommended scope meanwhile, the hours boxes standing).

## The law, as built

### THE FARM DAY BEGINS AT SIX (0.30.151)

1. THE HOUR: app_config `farm_day_start_hour`, seeded 6 by migration 0064, a value in data (canon L-4) editable in Admin, Lookups, app_config; a whole number 0 to 23, 0 being the old midnight law. The code's fallback when the row is missing or off is the ruling's 6.
2. THE DAY: the farm's day for an instant is the Eastern calendar day, or the day before while the Eastern clock is short of the start hour. A second-shift entry at 1:30 AM on the 21st dates to the 20th. Its window runs from the start hour on that date to the start hour on the next (6:00 AM to 6:00 AM).
3. WHO READS IT: the Effective Date on every transactional form (the server resolves a blank or matching date to the farm day, so the 20th at 1:30 AM posts without a PIN and the calendar's 21st is refused as ahead of today; the field renders the farm day where it has the instant, and the client fills it from the browser's clock and the start hour every page now carries on its body, `data-farm-day-start`); the trim date, the cryo date and the wet weight date through it; the unload session's date; the Harvest Console's today and yesterday and the windows they draw (wet grams weighed, trim packages by date or instant, the hours by work date).
4. THE CLOCK ON THE DAY: a Start time on Load Silo under a backdated Effective Date resolves on the farm day, so a time before the start hour falls on the next calendar date (the 20th at 01:00 is the 21st at 05:00Z), and the instant must fall on that farm day or the load refuses in words as before. The browser's resolver follows the same rule.

### THE CONSOLE DAY (0.30.152)

1. THE CONTROL: one date box under the Harvest Console's title (`?day=YYYY-MM-DD`): yesterday (the farm day before today) by default, any real day up to today when picked; a future, malformed or yesterday value reads yesterday. The control says which it is ("yesterday, the default" or "picked; the panes below read this day"), offers Back to yesterday when picked, and tells the truth about the hours: they land on the day shown.
2. WHAT FOLLOWS: the Cutting and Bucking hours boxes, Weight/DLH, the whole Trimming section and its DLH boxes read the day; the date under those lines is the day; the hours forms carry it home (`work_date`, `day_picked`) and a save returns to the same day. The Plants figures stay the season's and the drying strip stays live.
3. THE HOURS FROM A SPREADSHEET are his next ask, waiting on the file he will share; nothing of it is built here.

## What changed

- `migrations/0064_farm_day_start.sql`: the `farm_day_start_hour` seed, 6.
- `src/farmday.ts`: FARM_DAY_START_HOUR_DEFAULT, parseFarmDayStartHour, etHour, farmDay, farmDayBounds, farmInstant, dayAfter.
- `src/config.ts`: CONFIG_KEYS.farm_day_start_hour.
- `src/effective.ts`: farmDayStartHour, farmToday; resolveEffectiveDate on the farm day; effectiveDateField takes the start hour; the client script reads the body's start hour.
- `src/actions.ts`: resolveLoadedAt takes the start hour, resolves the Start time through farmInstant and checks the farm day; loadSilo passes the hour; the unload session's date is the farm day.
- `src/drying.ts`: the Load Silo page carries the start hour to the field; the loaded-time resolver in the browser rolls a small-hours time onto the next date.
- `src/html.ts`: the layout carries `data-farm-day-start` on the body; defaultTodayScript reads it.
- `src/console.ts`: consoleDayOf, consoleDayControl, consoleDayQuery; loadHarvestConsole reads the farm day and takes the picked day; the hours forms carry `day_picked`; the saves return to the day.
- `src/index.ts`: the shell reads the start hour once per request and hands it to the layout and Load Silo; the console route passes `?day`.
- `src/i18n.ts`: the six console-day strings, EN and ES.
- Tests: `test/farmday.test.ts` (new, 12 tests: the hour in data, the farm day and its bounds, the wall clock on a farm day, the Effective Date at 1:30 AM and 9:30 AM, the field and the scripts, the loaded time, the console day's pick, loader, control, page and redirects); `test/console.test.ts` and `test/view.test.ts` follow the new fields and the body attribute.
- `scripts/smoke.mjs`: pin 64; farmDaySmoke; the scheduling backdate and the Load Silo Effective Date read the farm day; the console walk: yesterday is the farm day before today, the body carries the hour, the control on yesterday capped at today, a picked day three days back driving every hours form and the date lines, hours saved on it returning to it and staying off yesterday, the clear, a future day reading yesterday.

## Scribe assumptions (his word owed if wrong)

- Six is the hour for every farm and every station; a per-farm hour is not built.
- The client fills the farm day from the device's own clock (the crew's devices keep Eastern time, as the wall-clock law already assumes).
- The old etDate stays for calendar readings that are not "today" (the HBN's YYDDD, wall clocks shown back); only the readers named above moved to the farm day.
- Reports that bucket by a stored date (trim_date, effective_date, work_date) follow automatically, since the stored dates are farm days from this deploy on; rows dated before the deploy keep the calendar dates they were given.
- The console's picked day is not remembered between visits (the default is yesterday every time the page opens without `?day`).
- The hours import from his spreadsheet is a request in waiting, not an assumption.

## Gates

- `npx tsc --noEmit`: exit 0.
- `npx vitest run`: 42 files, 765 tests passed; the same under TZ=America/New_York.
- `node --check scripts/smoke.mjs`: ok.
- From-zero smoke (SMOKE_PORT=9060): `About to apply 64 migration(s)`, `SMOKE PASS`, no 500 in the log.
- Dash audit: 0 on every file below.

## Deploy (his hands; migration 0064 rides, so the three-step block)

```powershell
cd "C:\Users\DennisWallace\Documents\Claude\Projects\gripfactory Practical\app"
npx wrangler d1 execute gripfactory-lite-grip-20260914 --env grip --remote --command "SELECT 1"
npx wrangler d1 migrations apply gripfactory-lite-grip-20260914 --env grip --remote
npm run deploy:grip
```

## Sealed final check

```
npx tsc --noEmit                      exit 0
npx vitest run                        42 files, 765 tests passed
TZ=America/New_York npx vitest run    42 files, 765 tests passed
node --check scripts/smoke.mjs        ok
rm -rf .smoke-persist && SMOKE_PORT=9060 WRANGLER_SEND_METRICS=false timeout 285 npm run smoke
                                      About to apply 64 migration(s); SMOKE PASS; " 500 " lines: 0

migrations/0064_farm_day_start.sql       1040  0ee83fa715722140
src/farmday.ts                           8671  ce1f9f2ab3180863
src/effective.ts                         8503  e205bc3b493626f9
src/config.ts                           53489  25756b673c391cdd
src/actions.ts                         266917  3b8cbba971c6cbd4
src/drying.ts                           20437  f4288f566e791685
src/html.ts                            174994  3fec1485050408da
src/console.ts                          38575  56f7d1e52865ab35
src/index.ts                           117968  735d8303b7453549
src/i18n.ts                            129949  9f9b4a37266cf6e4
test/farmday.test.ts                    15041  84ec35a6a56977a7
test/console.test.ts                    23533  7c8046ba41d4eea4
test/view.test.ts                       24502  349c5f786bdec6da
scripts/smoke.mjs                      495439  35802f750b0ce377
dash audit: 0 on every file above
```
