# 2026-09-21 The Hours Come by Hand, and the FFZ Third Reading Stands (canon 0.30.153)

Scribe sitting, Scribe-direct under G-2, on the LIVE floor of 0.30.150 (worker 234c4737, migrations 0001-0063; the 0064 block still at his hands). No code change and no migration in this report: one repair-lane file for his keyboard, and one floor ruling that builds nothing.

## The owner's words

On the FFZ cube after his purge (his screenshot: "10% FULL", "METRC 0.00 lb in 0 packages · ledger 473.27 lb", "FFZ 473.27 lb · 214,670.00 g"), verbatim: "Now I'm just confused". The Scribe's reading: the cube's FFZ figure is three shares (canon 0.30.75), the METRC mirror's active FFZ packages (0), the ledger's frozen material (the set THE FFZ INVENTORY LOCATION purge voided, so 0), and the cryo weights of cryo'd packages still in the Testing Queue that never had a ledger row (the packages from before the ledger followed the trim, or trim children cut on a lot whose harvest package had already left the ledger); a ledger purge cannot reach that third share because nothing in the ledger stands for it. Since his purge the 214,670.00 g is that third share alone. Three read-only commands were handed to him to see the set (count and grams, the list by lot, and the ledger share reading 0). On the question tool, his answer, verbatim: "Do nothing at this time". THE THIRD READING STANDS: no build; the cube keeps counting those packages until he says otherwise.

On the hours from the Labor tab, his pick on the question tool, verbatim: "Send it to me each time". THE HOURS COME BY HAND: he attaches the workbook when it changes; the Scribe computes the rows and hands him a repair-lane file; nothing is built in the worker.

## THE HOURS COME BY HAND, the first file

Source: his upload of "26H.Operations Dashboard .xlsm" (identical bytes both times, sha256 6b3548f9fcb10b03), OneDrive path "C:\Users\DennisWallace\OneDrive - OCG Companies, LLC\Grip Internal Site - Operations\xxxOperations\Harvest 2026\26H.Operations Dashboard .xlsm". His words: "You want the labor tab, column I for cutting and bucking hours., column c for the date" and "column d is the farm". The Labor tab: header on row 3 (B DAY, C DATE, D HARV FARM, E HARV WET WEIGHT LBS, F TOTAL # OF PLANTS, G # OF TOTES, H CUT/BCK # PPL, I CUT/BCK # HRS, J WEIGH/TRNS # PPL, K WEIGH/TRNS HRS, L TOT HARV HRS, M WET WGHT/HR, N PLANTS/HR), data from row 4, 173 dated rows from 2026-07-20 to 2027-02-28 with the future rows pre-filled and blank; farms ARL, PNN, PNS, matching the app's farm codes.

The generator (`hours_from_sheet.py`, Scribe's scratchpad; the same for every file to come) keeps a row when it has a real date, a farm in ARL/PNN/PNS and a numeric hours cell, and skips blank hours, blank farms and dates ahead of the run day. It writes `app/scripts/repairs/2026-09-21_labor_hours_from_sheet.sql`: per farm-day four guarded statements (a log of old and new where the console holds a different number, then the set; the birth where no row stands, then its log), ids deterministic (uuid from sha256 of `gripfactory-repair-hours-<run day>:<kind>:<farm>:<day>`), actor his login (7b59cf6b), one reason `hours from the sheet 2026-09-21 (canon 0.30.153), 26H.Operations Dashboard .xlsm, Labor tab, CUT/BCK # HRS by DATE and HARV FARM`, a fixed stamp 2026-09-21T15:30:00.000Z, no double quotes or percent signs (the repair lane's cmd.exe rule).

Landed (5): 2026-07-20 ARL 133.5; 2026-08-14 PNN 117.5; 2026-08-20 PNN 24.92; 2026-08-24 PNN 108.92; 2026-09-03 PNN 17.

Held out, pending his word (they read like season totals typed on a date, not days: 210 and 232 people, 48,709 and 67,671 lb wet): 2026-09-14 PNN 2,753; 2026-09-15 PNS 3,153. Skipped (hours blank): 2026-09-16 PNN; 2026-09-18 ARL.

Rehearsal on the local D1 under `.smoke-persist` (the last from-zero smoke's database, 64 migrations): an ARL 2026-07-20 row planted at 100 h first, to exercise the set path. Run 1: the planted row set to 133.5 with a log carrying old 100 and new 133.5; four rows born with their logs (old NULL); 5 rows, 401.84 h, 5 sheet logs. Run 2: 5 rows, 401.84 h, 5 sheet logs, nothing moved. The floor effect read on a dev server (port 9061, the Admin PIN cookie): `/harvest?day=2026-08-14` shows the PNN hours box at 117.5, `?day=2026-07-20` the ARL box at 133.5, `?day=2026-09-03` the PNN box at 17, `?day=2026-08-20` the PNN box at 24.92.

## His hands

```powershell
cd "C:\Users\DennisWallace\Documents\Claude\Projects\gripfactory Practical\app"
node scripts/repair-apply.mjs scripts/repairs/2026-09-21_labor_hours_from_sheet.sql
```

Expected: 20 statements ok; on a console holding none of these days, changes 5 on the row inserts and 5 on the logs (the remote meta carries counts); a second run changes nothing. Then the console on any of the five days reads the sheet's number in that farm's box.

## Scribe assumptions (his word owed if wrong)

- The sheet is the source: where the console already holds a different number for a farm-day, the sheet's number replaces it (logged with the old value). A blank on the sheet never clears a console-typed number.
- No pre or post snapshot for an hours file: every statement is additive and guarded, and the change-log rows carry the trail. The record-repair law (0.30.91) keeps its snapshots for corrections of the record.
- The hours boxes carry `step="0.25"`, so a sheet value like 24.92 stands in the box and shows on the console, but a browser will refuse to re-save that box untouched (a quarter-hour step) until the number is retyped. Noted, not changed.
- The two held-out rows land in a second file the moment he says they are days as typed.

## Sealed final check

```
node scripts/repair-apply.mjs scripts/repairs/2026-09-21_labor_hours_from_sheet.sql --dry-run
                                      20 statement(s), shell-safe
rehearsal (--local .smoke-persist)    run 1: 5 rows, 401.84 h, 5 sheet logs (one set from 100, four births)
                                      run 2: 5 rows, 401.84 h, 5 sheet logs (nothing moved)
dev server 9061                       /harvest?day=2026-08-14 PNN 117.5; 2026-07-20 ARL 133.5; 2026-09-03 PNN 17; 2026-08-20 PNN 24.92

scripts/repairs/2026-09-21_labor_hours_from_sheet.sql   11121  9ef43bcc46acb159
dash audit: 0
tail: -- End of file. Expected effect on a console holding none of these days: 5 rows added, 5 log rows; a second run: 0 and 0.
```
