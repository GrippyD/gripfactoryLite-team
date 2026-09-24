# 2026-09-17 The Blank Slate (canon 0.30.108)

Scribe sitting, built Scribe-direct under G-2 (no "Cursor Slice" heading; his pick "Scribe builds it here"). Owner ruling 2026-09-17, verbatim:

"We need to completely wipe the slate clean on the interco logistics tab.  Right now, it exists to build a csv.  Make the entire menu surface blank.  Does its state constitute a dependency on another node?  If so, what is it?

Wet Weights: assume everything that get's entered into wet weights is landing in PNN's barn location.  We'll handle real life logistics in METRC for now--hopefully the only loss here is the METRC/T3 manifest CSV.  indicate if I'm wrong"

Then, mid-turn: "Am I deploying something to Cursor?  Or was that slice prompt for you?" (the lane law answered: a ruling with no "Cursor Slice" heading is built here; nothing goes to Cursor for this one).

His picks at the forks: the Scribe builds it here; every wet lot's package is born under PNN's 832 at birth; the internal door (832 CSA to 694 CSB) is dropped, METRC handles it; the Arlington Dry Room is left standing on the strip.

This slice ships WITHOUT a migration. Worker-only deploy. From-zero pin stays 57; next free migration 0058.

## The dependency answer (as delivered before the build)

Interco's state is interco_movements, interco_movement_items, interco_receipts and the in_transit lot status. Five nodes touched it: Wet Weights wrote it at Finish lot (the med equivalent-transfer virtual manifest; the truck manifest; a truck lot's package stayed in the origin barn until Interco's Receive, so Load Silo depended on it); Unload Dry Space's spear "bucked on site: no" wrote a truck movement; Pending Data Uploads read its Manifests and Receipts lists; Data Queues' Inbound Queue (in_transit) and the Inventory by Location IN-TRANSIT rows read it; Admin, Data Queues, Logistics Moves is its record table. Nothing in Harvest Console, Production Scheduling, Drying Ops, Fulfillment, SalesHelper or the FG pane read it. He was right about the T3 manifest CSV; the further losses are listed under What was lost.

## The law, as built

1. THE BLANK SLATE. The Interco Logistics tile stays on the ops map. Its page is the title and the empty word (- EMPTY -, ES - VACIO -), nothing else. Every path that stood under it (outbound, receiving, arrivals, receive-truck, the door, manifest add, dest and finish, create, send, ship-external, movement remove, manifest, complete, receive, reject, receipt finish and void, item unreceive) lands on the blank page: a GET redirects 302, a stale POST 303, acting on nothing. /virtual-move and its posts land there too; /virtual-move/:id/manifest still opens Pending Data Uploads.
2. Nothing writes a movement any more. The movement tables stay as the record: Admin, Data Queues, Logistics Moves stands and reads none from here on; Pending Data Uploads keeps its Manifests and Receipts lists for what already pends. The reasoned void on a movement (Admin, Data Queues) stands for the record.
3. THE LANDING LAW. Every lot entered at Wet Weights lands in PNN's barn: Finish lot births the package at BARN under PNN's grow license AU-G-C-000832 for every HBN (LANDING_FARM = PNN in planFinishMint), the HBN's own farm kept as the item's farm_code and the report's Origin farm column. No manifest is cut, no equivalent transfer hops a med birth, nothing rides the road. A hang room at the landing site still takes its lot at once; a silo lot waits in BARN for Load Silo (canon 0.30.6) and its silo reads loading (canon 0.30.81).
4. Move To offers every HBN the landing site's spaces (kind silo and hang, farm PNN or shared: the five silos, the hang rooms, the Blast Freezer(s)); ARL's and PNS's own rooms are not landing spaces. The trucks left the list: the Add a truck control is gone from the header, and a truck pick, staged or hand-built, refuses in words: "Trucks left the Move To list; every lot lands in PNN's barn. Pick a silo or a room." The truck sentinel and truckNumberFromPick stay for lots that already ride a truck; the lot pencil keeps its Truck # field for older rows (owner ruling 2026-08-28).
5. The Move To help reads the landing law: "Actual dry space at PNN, where every lot lands. A hang room mints SPR; a silo or the freezer mints WIP, born in PNN's barn under its grow license." (ES alongside.)
6. Unload Dry Space's spear "bucked on site: no" question no longer writes a movement; the retired branches (equivalentTransferStmts, truckManifestStmts) are deleted from actions.ts.

## What was lost (beyond the T3 manifest CSV he named)

- The Receive step and its receive-manifest CSV (a truck lot's package no longer waits in an origin barn; it is born at PNN's BARN).
- Trucks on the Move To list; the Inbound Queue and the IN-TRANSIT rows go idle (no lot enters in_transit any more).
- The internal door 832 CSA to 694 CSB (his pick: METRC handles it).
- The med line's equivalent-transfer hop: a GR-C-001132 HBN's package is born under 832 at BARN; METRC shows the origin license until his real manifest.
- The Arlington Dry Room stands on the strip but takes no new lot (his pick: leave it standing).

## Live-data caveat for his eye

Any lot already in status in_transit on the live floor has no Receive path left. If one exists, it needs a one-time repair by his hands (the lot pencil: status drying, Move To its silo or room, with a reason; the pencil carries the item along). None was created by this build; the smoke runs from zero.

## What changed

- `src/index.ts`: the /interco block (blank page, catch-all 302 GET and 303 POST); the retired interco routes and imports removed; /virtual-move lands on the blank page; the wet weight pick's Move To reads PNN's spaces (listDrySpacesByKinds with LANDING_FARM).
- `src/html.ts`: intercoBlankPage (the floor renderers stay in the file, unrouted).
- `src/config.ts`: LANDING_FARM, LANDING_MOVE_TO_KINDS; moveToKindsForFarm returns the landing kinds for every farm.
- `src/ledger.ts`: planFinishMint births at barnLocationForSite(LANDING_FARM) under growLicenseForFarm(LANDING_FARM).
- `src/actions.ts`: Start lot refuses a truck pick in words; Finish lot keeps the hang-room move alone (the med hop and the truck manifest gone; equivalentTransferStmts and truckManifestStmts deleted).
- `src/pipeline.ts`, `src/i18n.ts`: the Move To help text (EN, ES).
- Tests: `test/walk.test.ts` (the blank page and the redirects), `test/floor.test.ts` (birth at 832 and BARN), `test/routing.test.ts` (Move To kinds for every farm), `test/strapin.test.ts` (the BIRTH LAW pins), `test/start_taps.test.ts` (the four taps' header points at a silo; a truck header refuses in words and mints nothing).
- `scripts/smoke.mjs`: the blank page and its redirects; the ARL HBN's Move To (PNN's silos and rooms, no Arlington Dry Room, no trucks, the refusal in words); the ARL lots weigh into PNN's Silo 2 and Silo 5 and are born in PNN's barn (the barn's ARL-origin WIP read before and after); the Load Silo refusal "Pick a silo at its own site." for the ARL room; the manifest, arrivals, receipt and door walks removed; the Logistics Moves record table reads none; the med lot's package under 832 at BARN and not under GR-C-001132 (the Change Locations ledger scope); the tagged birth (a PNN lot finished with a lower-cased tag reads it upper-cased on the ledger under 832 at BARN, with no receive file); the wet weights file totals without the truck lot (1,234.56; tags cent-exact; 1,234.81 after the reweigh).

## Scribe assumptions (his word owed if wrong)

- Every HBN's package is born under AU-G-C-000832 regardless of the HBN's license (his pick "PNN's 832 at birth"); the HBN keeps its own license for METRC's paperwork.
- The Logistics Moves record table and the Pending Data Uploads manifest and receipt lists stay as the record rather than being removed.
- The lot pencil keeps its Truck # field (the 2026-08-28 ruling for older rows).
- A lot that once had "planned here" on the loading tile (a truck lot whose HBN planned a silo) cannot arise any more; the tile reads "in the barn" for a lot weighed into its own silo.

## Gates

- `npx tsc --noEmit`: exit 0.
- `npx vitest run`: 32 files, 675 tests passed; the same under TZ=America/New_York.
- `node --check scripts/smoke.mjs`: ok.
- From-zero smoke (SMOKE_PORT=9006): `About to apply 57 migration(s)`, `SMOKE PASS`. (One earlier run met a transient 500 on the Twister logo asset from wrangler's dev server; the re-run passed clean with no 500 in the log.)
- Visual pass: the blank page in lite, cerberus and co, and in Spanish at phone width (no horizontal scroll).
- Dash audit: 0 on every file below.

## Deploy (his hands, worker only)

From `app/`:

```
npm run deploy:grip
```

## Sealed final check

```
npx tsc --noEmit                      exit 0
npx vitest run                        32 files, 675 tests passed
TZ=America/New_York npx vitest run    32 files, 675 tests passed
node --check scripts/smoke.mjs        ok
rm -rf .smoke-persist && SMOKE_PORT=9006 WRANGLER_SEND_METRICS=false timeout 285 npm run smoke
                                      About to apply 57 migration(s); SMOKE PASS

scripts/smoke.mjs            397301  4dc09e7fa9eacb9d
src/actions.ts               245806  49112cb376a3c391
src/config.ts                 46240  357589399af29348
src/html.ts                  171856  de8b5b8bc9bb8d1b
src/i18n.ts                  115274  4a91c30eb1301f47
src/index.ts                 106986  48ee82f591030321
src/ledger.ts                  8597  f7376144db00aa9f
src/pipeline.ts               48654  55e758e4f1224e2c
test/floor.test.ts            23017  8e44782f613871c0
test/routing.test.ts          36215  e7f81cbc042720c4
test/start_taps.test.ts        8459  55aa2fee2a97085c
test/strapin.test.ts          26840  04715bfb2e7e6842
test/walk.test.ts             43496  8ba8e968e708964d
dash audit: 0 on every file above
```
