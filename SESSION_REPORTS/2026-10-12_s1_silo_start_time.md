# 2026-10-12 S1: the silo start time under the lots (canon 0.30.445), Scribe-direct (G-2): SEALED

The owner, 2026-10-09: "Also, still need the start time of the silo shown under the silos in AM/PM on all drying screens."

THE BUILD, `src/drying.ts` and its test only: `startedLine(load, locale)` reads the load's clock zero (the loaded time, else the typed start, the same zero the ticking clock runs from) and writes it under the lot as the farm's wall clock on the 12-hour dial with its day: "Started 6:15 PM, Oct 8" ("Iniciada 6:15 PM, 8 oct" in Spanish). Eastern throughout (11:15Z on a UTC-4 day reads 7:15 AM; 02:30Z reads 10:30 PM of the day before). A load with no readable start writes nothing. The line rides in the silo strip's tile body under every open load's clock, so it is on every Drying Operations page and the dashboard strip (rows and open layouts alike), on silos, dry rooms and freezers. The ISO instant and the Eastern day ride in `data-lot-started` and `data-lot-started-day` for scripts. No migration, no route, no theme change (the line takes the tile's muted style).

One test added (`test/drying.test.ts`): the AM and PM readings, the Eastern day across midnight, the typed start standing in for an unreadable loaded time, nothing invented when both are unreadable, the strip carrying the line, and the Spanish word.

THE LIVE-DATA BENCH (the pre_hf2 copy): `/ops/drying_ops` 0.36 s, `/station/load_silo` 0.13 s, `/silos/live.json` 0.07 s, `/` 0.08 s; the open loads read Started 6:15 PM, Oct 8 (26092), 10:00 AM, Oct 4 (26091), 10:00 AM, Oct 3 and 1:00 PM, Sep 30; rendered in Chromium, one line each under the running clock.

`src/drying.ts` 43,086 bytes `2de9ceafff26e2da` (main 41,813 `8c6d5aecdb11490a`); `test/drying.test.ts` 16,364 `4198229b830e4819` (main 15,000 `6b505e477d238361`). The tree `d6ecd7050716a753` (355 files, 0001-0098) on main's HB1 tree `07e25225df06a03f`; in `branches/GFLiteMetrcAPI`, the disk the same.

## Sealed final check

```
THE TREE                              d6ecd7050716a753 (355 files, 0001-0098), on main 12c53b8 = 07e25225df06a03f; disk (branches/GFLiteMetrcAPI) the same
npm run typecheck                     exit 0
TZ=UTC npx vitest run                 102 files, 1504 tests passed
TZ=America/New_York npx vitest run    102 files, 1504 tests passed
node --check scripts/smoke.mjs        exit 0
CI=1 SMOKE_PORT=9478 npm run smoke    About to apply 98 migration(s); SMOKE PASS; exit 0; " 500 " lines: 0
live-data bench                       /ops/drying_ops 0.36 s; the Started lines read on the open loads; Chromium render one line each
dash audit (by character): 0; CR audit: 0; personnel names: none
```

## The merge (his hands; no migration)

```powershell
cd "C:\Users\DennisWallace\Documents\Claude\Projects\gripfactory Practical\app"
node scripts/db-snapshot.mjs pre_s1
if ($LASTEXITCODE -ne 0) { throw "snapshot failed, stop here" }
cd "C:\Users\DennisWallace\Documents\Claude\Projects\gripfactory Practical\branches\GFLiteMetrcAPI"
git add -A
git commit -m "S1: the silo start time under the lots" -m "Each open load's start reads under its clock as the farm's 12-hour wall clock with its day, on every drying screen. No migration. Canon 0.30.444 to 0.30.445.`n`nCo-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`nClaude-Session: https://claude.ai/code/session_01VDz7UdaTSkjq69GvDfDWd7"
cd "C:\Users\DennisWallace\Documents\Claude\Projects\gripfactory Practical"
git checkout -- canon
git merge --no-ff GFLiteMetrcAPI -m "Merge S1"
git push
```

His paste back: the Version ID.
