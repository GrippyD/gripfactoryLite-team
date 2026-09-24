# Session report: wet lots on the Inventory by Location report (canon 0.27.2), Scribe-direct, 2026-09-06

**Scribe:** Gripfactory Lite Scribe (Cowork), Scribe-direct under G-2. Owner report, verbatim, over two screenshots: "confusion illustrated:" [Scribe transcription of the screenshots: the Inventory by Location report renders its empty state, "No material anywhere. The floor is clean.", while the Interco floor simultaneously shows ARL barn "1. ARL / Chem 51 / 2026-07-20 1,000,000.00 g", PNN 832 side "1. PNN / BCC x Jealousy / 2026-11-01 0.00 g", and ON THE ROAD "Truck 1 - ARL / Bermuda Triangle - 1,000,000.00 g Receive at PNN".]

## The blind spot

The report read only the local inventory ledger. A ledger item mints at lot FINISH (hang mints SPR, silo mints WIP), and a truck finish mints NOTHING until receipt. So the two lot states the floor deliberately renders, weighing lots in barns and in-transit lots on the road, were invisible to the report, and after his from-scratch purge the floor held a million grams the report called clean. My own shipped footnote ("Locations show only while material sits in them.") was being violated by the report itself.

## What shipped

1. **WET rows** (`ITEM_KIND_WET` in config.ts): a report-only pseudo-kind beside SPR/WIP/FG, never stored in local_inventory_items, never in ITEM_KIND_ORDER.
2. **`listWetLotMaterial`** (db.ts): weighing and in-transit lots, batch farm joined, with a NOT EXISTS guard on live ledger items so a minted lot can never count twice, whatever the lifecycle does later.
3. **`foldWetLotsIntoLocationRows`** (db.ts, pure, unit-pinned): a weighing lot counts in its site barn (barnLocationForSite; an unknown batch farm lands BARN, the universal inbox); an in-transit lot rides IN-TRANSIT under its origin farm; farm resolves by the same law as the ledger arm (the location's Admin assignment when set, else the material's own farm); totals sum raw and round once to 2 decimals; **the visibility law holds unchanged: zero totals drop**, so the owner's 0.00 g lot shows on the floor (a lot is a thing) but not in the totals (zero is not material). Merged rows re-sort farm, location, kind.
4. **`listInventoryByLocation`** now returns ledger rows + the fold. The view, the three formats, and the routes are untouched; WET rows ride them automatically.

## Flag standing for the owner (no action taken)

A lot with no weights yet totals zero and stays off the report under the ratified visibility law, while the floor still lists it. If presence should count (a row at 0.00), say the word and the fold drops its zero filter for WET rows only.

## Sealed final check

```
cd /home/claude/deploy/app
npx tsc --noEmit                      -> exit 0
npx vitest run                        -> Test Files 15 passed (15), Tests 410 passed (410)
node --check scripts/smoke.mjs        -> ok
Dash audit (4 touched files)          -> 0
rm -rf .smoke-persist && SMOKE_PORT=9071 WRANGLER_SEND_METRICS=false timeout 280 npm run smoke
                                      -> SMOKE PASS, "About to apply 29 migration(s)" from zero
Smoke walks added (the agreement walk): the rolling 0.22.0 truck counts as
  <td>IN-TRANSIT</td><td>WET</td>; a fresh PNS lot with no weights keeps PNS BARN
  off the report; its first weight (777.25) puts
  <td>PNS</td><td>PNS BARN</td><td>WET</td><td>777.25</td><td>g</td> on the report
  and the same 777.25 on the interco floor; the csv carries the WET rows.
Unit pins added (6): the fold's barn law, road law, zero drop, 2-decimal
  rounding with the universal-inbox default, merge sort order, and the
  IN-TRANSIT farm fallback.

src/config.ts        5e79d0b3a00e6429    src/db.ts        a5d25977ad7ea073
test/strapin.test.ts c1a5df4051ddd70a    scripts/smoke.mjs 14b7f338882c50fb
```

Worker only, no migration (0029 stays the head). Owner deploys by PS; the migrations step applies nothing and is safe. Never c10. TBD ids stay TBD.
