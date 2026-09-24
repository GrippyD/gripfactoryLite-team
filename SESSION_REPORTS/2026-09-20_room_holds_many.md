# 2026-09-20 The Room Holds Many (canon 0.30.132)

Scribe sitting, built Scribe-direct under G-2, on the LIVE floor of 0.30.131 (worker fc6d3371, migrations 0001-0062). One owner ruling 2026-09-20, verbatim: "Dry rooms and freezers must be able to contain multiple lots"

Worker-only; no migration. From-zero pin stays 62; next free migration 0063.

## What held

THE OCCUPIED SILO (canon 0.30.19, his words "occupied silos should not accept more product") bound every silo-kind space alike: the five silos, the Arlington Dry Room (type dry_room since 0.30.106) and the Blast Freezer(s) (type freezer). A room or freezer with one lot inside greyed in the Load Silo select with its occupant and refused a second load in words. The strip already drew several loads in one space (their grams summed against the space's capacity, the running clock winning, a line per lot under the word), so only the gate stood in the way.

## The law, as built

### THE ROOM HOLDS MANY (0.30.132)

1. THE ONE-LOAD LAW BINDS A SILO ALONE: a space of type silo keeps 0.30.19 exactly (greyed with its occupant in the select; a stale or hand-built post refuses "Silo N is occupied by lot X. Unload it first."). A dry room or a freezer takes lot after lot: each load is its own row with its own clock, the location change pends per lot, and the unload (Finish unload for a room, Remove the line for a freezer) ends that lot's load alone.
2. THE SELECT SAYS WHAT A ROOM HOLDS: a dry room or freezer with lots inside stays open and reads "(holding 1 lot)" / "(holding N lots)" with data-holding="N" on the option; the lot's own space still preselects; the "Every silo is occupied" banner appears only when no space is open.
3. THE TILE SUMS: the room's or freezer's fill is the sum of its open loads against its own capacity (the Blast Freezer(s) at 800 lb; two lots of 200 and 80 lb read Chilling Out at 35% full), a line per lot with its clock; removing one line leaves the others chilling.

## What changed

- `src/config.ts`: spaceHoldsOneLot(space_type) (true for silo and for a blank type; false for dry_room and freezer).
- `src/actions.ts`: loadSilo reads space_type and asks the occupant question only when spaceHoldsOneLot.
- `src/drying.ts`: the select greys a loaded silo alone; a loaded room or freezer stays open with its holding count; countLots.
- `src/i18n.ts`: "holding 1 lot", "holding {n} lots" (EN, ES).
- Tests: `test/rooms.test.ts` (new): the helper; the select with a greyed silo beside an open room holding 2 and a freezer holding 1 (an ended load holds nothing; EN, ES; the all-full banner only with silos alone); the load into a freezer and a room holding a lot lands, the load into a held silo refuses in words and writes nothing.
- `scripts/smoke.mjs`: the freezer walk gains a second PNN lot of 80 lb finished while the first chills: the pick offers the freezer open "(holding 1 lot)" preselected, never greyed, the load lands as its own row, the tile chills at 35% with both lot lines and 280.00 lb, live.json follows, the FFZ cube's ledger side counts both; removing the first line leaves the second chilling at 10% with its line alone; removing the second empties the freezer; the never-twice cube pin reads the two-lot figure. Also fixed on the way: the Zoho fixture's SO-00902 expected date was the fixed 2026-09-20 and met today's calendar (the shipping-today row counted it); it now reads ten days out, so the from-zero smoke holds on every day it runs.

## Rehearsal

Headless on the smoke's state, /station/load_silo: the ARL lot's select offers Silo 1 and Silo 4 greyed with their occupants, the free silos, the Arlington Dry Room and the Blast Freezer(s) open; loading the lot into the Arlington Dry Room lands, and the strip's wire box reads drying with the lot's line under it.

## Scribe assumptions (his word owed if wrong)

- No capacity ceiling is enforced on a room or freezer: a load that overfills the space still lands and the tile's fill and percent stop at 100% (the level clamps). Say the word and the load refuses past capacity.
- The Unload Dry Space station keeps one lot per act: a room with several lots unloads them one at a time, each with its own dry weights.
- The dry room's projected dry yield and cap change (0.30.77) read the sum of its loads; with several lots unloading at once the fill falls by their combined dry out.

## Gates

- `npx tsc --noEmit`: exit 0.
- `npx vitest run`: 38 files, 731 tests passed; the same under TZ=America/New_York.
- `node --check scripts/smoke.mjs`: ok.
- From-zero smoke (SMOKE_PORT=9046): `About to apply 62 migration(s)`, `SMOKE PASS`, no 500 in the log.
- Visual pass: /station/load_silo select and the Drying Operations strip with the Arlington Dry Room holding a lot.
- Dash audit: 0 on every file below.

## Deploy (his hands; worker only)

```powershell
cd "C:\Users\DennisWallace\Documents\Claude\Projects\gripfactory Practical\app"
npm run deploy:grip
```

## Sealed final check

```
npx tsc --noEmit                      exit 0
npx vitest run                        38 files, 731 tests passed
TZ=America/New_York npx vitest run    38 files, 731 tests passed
node --check scripts/smoke.mjs        ok
rm -rf .smoke-persist && SMOKE_PORT=9046 WRANGLER_SEND_METRICS=false timeout 285 npm run smoke
                                      About to apply 62 migration(s); SMOKE PASS

src/config.ts               52583  5cdf1e9049f9d280
src/actions.ts             266576  a99f96fe4bf13019
src/drying.ts               19795  184decfcf559d842
src/i18n.ts                123531  c08ce785325bd098
test/rooms.test.ts           7456  8864fce4ba1d44b8
scripts/smoke.mjs          466225  28ebdaa74454491b
dash audit: 0 on every file above
```
