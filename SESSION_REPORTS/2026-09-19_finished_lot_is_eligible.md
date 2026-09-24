# 2026-09-19 The Finished Lot Is Eligible (canon 0.30.130)

Scribe sitting, built Scribe-direct under G-2, on the LIVE floor of 0.30.123 (worker d469fd3d, migrations 0001-0060) with THE MANIFEST BUILDER (0061), THE PHONE LOGIN (0062), THE MIRROR CLOSES THE LEDGER and THE LEDGER FOLDS pending at his hands. Two owner rulings 2026-09-19, mid-turn, verbatim.

The first: "how do i get lots 27, 28, and 29 when the load dry space page doesn't show them?  I'm assuming this is leftover interco logistics keep that logistics page live, but sever its hold on where ledger inventory lands.  It's a stub with extra steps until I can figure out how to crack this nut"

The second, right after: "and regardless of what farm the HBN indicates, assume it's elligible for dry space loading as soon as the "finish lot" routine runs in wet weight entry"

Worker-only; no migration. From-zero pin stays 62; next free migration 0063. The Interco Logistics page is untouched (the manifest builder of 0.30.125 stands there once deployed).

## Why the page could lose a finished lot

The Load Silo pane (his "load dry space page") read, since THE HARVEST CONSOLE (0.30.73), only a drying lot whose born package was LIVE in one of the three barns (BARN, ARL BARN, PNS BARN). That was the ledger's hold on the pane: the lot itself had finished, but the pane asked where its package sat. Anything that moved or closed the package made the lot vanish, with no word said. The paths that do that on the LIVE floor: the Move To pencil on the lot record (canon 0.28.6 carries the live package to the new space's name, out of the barn, at any status); a location change on the package from Inventory; a hand void of the package; and, once 0.30.128 deploys, the mirror closing a package METRC marks gone. The farm never gated the pane directly, but the silo select was narrowed to the site of the barn the package waited in, and the load refused a space at another site.

The snapshot on his machine (db_backups/20260918-084110_post_silo1_26024) ends at lot serial 24; lots 27, 28 and 29 were born after it, so the Scribe could not read which path took them. The law below lists them whatever the path, names the one case that still cannot load, and the diagnostic in the hand-off tells him which it was.

## The law, as built

### THE FINISHED LOT IS ELIGIBLE (0.30.130)

1. THE PANE READS FINISH LOT, NOT THE LEDGER: the Load Silo pane ("Finished wet lots") lists every undeleted lot whose status is drying (Finish lot ran) or in_transit (a truck-era lot that finished) and that no open silo load holds. The HBN's farm is not asked. Where the born package sits is not asked; the package rides along as the lot's earliest live ledger item, from wherever it is.
2. EVERY SPACE ON THE STRIP IS OFFERED: the pick's select carries the five silos, the Arlington Dry Room and the Blast Freezer(s), occupied ones greyed with their occupant as before; the lot's own space (or the HBN's planned silo for a truck-era lot) preselects. The 0.30.73 site refusal ("Pick a silo at its own site.") is repealed.
3. THE LOAD MOVES THE PACKAGE FROM WHERE IT IS: the load writes the package's location from its current place to the space's location (the log's old value is that place, not a barn); a package already sitting at that very location moves nowhere and writes no line; the load row, the clock and the lot's actual space are written as before. A truck-era lot still in transit arrives by the load: its status goes drying under the load's reason.
4. THE LOT WITHOUT A PACKAGE IS NAMED, NOT HIDDEN: a finished lot whose package is gone from the ledger (voided by a hand, or closed as gone in METRC under 0.30.128) stays on the pane, marked "(no live package)" and read by its HBN serial when no tag or code remains; its pick shows the words where the load form would stand ("This lot has no live package in the ledger (voided, or closed as gone in METRC). Restore the package or repair the lot before loading it."); a hand-built load refuses in words naming the lot's serial. Nothing is loaded with no package behind it, since the load would move nothing and pend no paper.
5. THE TILE NAMES NO BARN: the loading tile's lines read "waiting to load" (and "waiting to load, planned here" for a planned silo) instead of "in the barn"; the strip's count of a planned-silo lot no longer asks that its package sit in the PNN barn.

## What changed

- `src/db.ts`: BARN_WET_LOT_SELECT reads status IN (drying, in_transit), LEFT JOINs the lot's earliest live item, requires no open load, no barn list; the row carries status and a nullable barn_location (now the package's current place); listSiloLotGrams drops the barn clause on the planned-silo count.
- `src/actions.ts`: loadSilo drops the barn and site gates, moves the package from its current location (skipping a no-op move), turns in_transit to drying on load, refuses a package-less lot in words naming the serial, and refuses a lot the pane does not hold in words.
- `src/drying.ts`: the pane heading "Finished wet lots"; every strip space in the select; the "(no live package)" mark on the row; the words instead of the form for a package-less pick; barnLotLabel falls back to the HBN serial.
- `src/silo.ts`: the tile lines "waiting to load" / "waiting to load, planned here".
- `src/i18n.ts`: the new words (EN, ES).
- Tests: `test/eligible.test.ts` (new): the pane SQL (no barn list, both statuses, the no-open-load clause), the select with the Arlington Dry Room, the marked row and the words for a package-less lot (EN, ES), the load moving from "Trim Room 1", the ARL room load with no site refusal, the no-op move, the in_transit arrival, both refusals. `test/drying.test.ts` and `test/silo.test.ts` follow the words.
- `scripts/smoke.mjs`: the ARL HBN's lot is offered the Arlington Dry Room (the wrong-site refusal walk is gone); the pencil walk on the med lot (Move To pencil to Silo 3 carries the package out of the barn, the pane keeps the lot, Silo 3 preselects, the load into Silo 4 moves it from Silo 3 with the log line under "silo load"); the tile words; at the tail, the truck lot whose package the mirror closed stands marked, its pick shows the words and no form, a hand-built load refuses in words.

## Rehearsal

Headless on the smoke's state, /station/load_silo in lite and cerberus: the pane reads "Finished wet lots 2" and lists the gone-package truck lot as "26901 / PNN / Fruity Pebbles 500.00 g (no live package)" beside the ARL lot; the truck lot's pick shows the lot card and the warn banner, no load form; the ARL lot's pick offers Silo 1 to 6 (occupied ones greyed), the Arlington Dry Room and the Blast Freezer(s), Silo 5 preselected.

## Scribe assumptions (his word owed if wrong)

- The Arlington Dry Room (and any space on the strip) is offered to every finished lot; nothing about a site stands between a lot and a space any more.
- A finished lot whose package is gone stays listed and marked rather than hidden; the crew restores the package (or he names a repair) before it loads. If he would rather it not appear at all, one clause hides it.
- A hang-room lot (Hang in Place) that finished is also listed, since Finish lot ran on it; loading it into a silo moves its package from the room to the silo. If a placed hang lot should stay off the pane, one clause excludes the hang kind.
- A truck-era lot in transit arrives by its load (status drying); nothing else touches the in_transit records.
- The Interco Logistics page is left exactly as 0.30.125 built it.

## Gates

- `npx tsc --noEmit`: exit 0.
- `npx vitest run`: 37 files, 728 tests passed; the same under TZ=America/New_York.
- `node --check scripts/smoke.mjs`: ok.
- From-zero smoke (SMOKE_PORT=9043): `About to apply 62 migration(s)`, `SMOKE PASS`, no 500 in the log.
- Visual pass: /station/load_silo pane and picks in lite and cerberus.
- Dash audit: 0 on every file below.

## Deploy (his hands; the pending 0061 and 0062 and the worker-only slices ride the same block)

```powershell
cd "C:\Users\DennisWallace\Documents\Claude\Projects\gripfactory Practical\app"
npx wrangler d1 execute gripfactory-lite-grip-20260914 --env grip --remote --command "SELECT 1"
npx wrangler d1 migrations apply gripfactory-lite-grip-20260914 --env grip --remote
npm run deploy:grip
```

## Sealed final check

```
npx tsc --noEmit                      exit 0
npx vitest run                        37 files, 728 tests passed
TZ=America/New_York npx vitest run    37 files, 728 tests passed
node --check scripts/smoke.mjs        ok
rm -rf .smoke-persist && SMOKE_PORT=9043 WRANGLER_SEND_METRICS=false timeout 285 npm run smoke
                                      About to apply 62 migration(s); SMOKE PASS

src/db.ts                  157892  9d439eb26faa52dc
src/actions.ts             266225  f38c88bd0afe3a0f
src/drying.ts               18898  9f76bd604e1ffb5d
src/silo.ts                 38979  4d63b15dd90547a6
src/i18n.ts                123300  8897f38d0b714d19
test/eligible.test.ts       10641  20dda9e544c59d18
test/drying.test.ts         14433  1bab4b114be2e650
test/silo.test.ts           28460  2656734ac06769cb
scripts/smoke.mjs          459492  e8bb20cadefda4e2
dash audit: 0 on every file above
```
