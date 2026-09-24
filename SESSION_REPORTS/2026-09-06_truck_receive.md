# Session report: the wet truck receive (canon 0.28.4), Scribe-direct, 2026-09-06

**Scribe:** Gripfactory Lite Scribe (Cowork), Scribe-direct under G-2. Owner bug report, verbatim: "run a test for me,  When I just loaded a wet weight onto the truck and tried to receive it at PNN, it went back to the open record on the wet weight screen"

## Reproduced

Against the walked local DB: the Inbound trucks lines on /interco/arrivals/pnn were bare links to `/station/wet_weight?lot=<id>`, which serves the open Wet Weight Entry record. No receive action existed anywhere in the codebase for an in-transit truck lot (no in_transit exit transition, no route, no button). The link was the 0.22.0 stopgap ("truck line must link to the lot") and it survived both interco reworks. His test was exact: receiving sent him back to the open record because that WAS the whole flow.

## What shipped (the missing half of ratified law)

`receiveTruckLot` (actions.ts) plus `POST /interco/arrivals/:site/receive-truck` (index.ts) plus the inline receive form on every truck line (html.ts): a space select (the site's non-truck Move To spaces; the arrival conversion sentence rides the form title) and a [Receive] button, the lot link kept for inspection.

The receive, under the standing laws:

1. Guards: the lot must exist, be in transit, and be headed to this site (`wetTruckDestSite`); the space must be real, non-truck, and at this site. Wrong site refuses 400.
2. The lot lands: status in_transit to drying, `actual_dryspc` = the picked space (canon 0.23.1: THE LOCATION ASSIGNS AT RECEIPT), both changes reason-logged (`truck received`).
3. THE MINT FIRES AT RECEIPT under the ARRIVAL license (canon 0.22.0: everything on the truck becomes the arrival license): the standard finish-mint law by space kind (hang mints SPR, silo mints WIP) with `licenseValue = licenseForSiteArrival(site)`, never the batch's origin license. A truck finish still mints nothing; receipt is where the material becomes ledger.

After receive: the truck leaves the road strip and Arrivals; the minted item shows in the destination site's tree under the arrival license with its space as the location tag; the lot dries at its space and rides the normal unload path from here.

## Sealed final check

```
cd /home/claude/deploy/app
npx tsc --noEmit                      -> exit 0
npx vitest run                        -> Test Files 16 passed (16), Tests 426 passed (426)
node --check scripts/smoke.mjs        -> ok
Dash audit (6 touched files)          -> 0
rm -rf .smoke-persist && SMOKE_PORT=9131 WRANGLER_SEND_METRICS=false timeout 280 npm run smoke
                                      -> SMOKE PASS, "About to apply 30 migration(s)" from zero
Smoke walks added: the truck line carries the receive form; receive at the
  wrong site refuses 400; the receive answers 303; the received truck leaves
  Arrivals; the floor shows the material at its space (Silo 4); the location
  report carries the minted WIP row at that space.
Unit pin added: the receiving page renders the receive form (route, hidden
  lot id, space options, the button) beside the kept lot link.

src/actions.ts       54d097b461604f8c    src/config.ts     d1e8649c0bd58f10
src/index.ts         2177e29b9bc8be3d    src/html.ts       2566209b90374c93
test/routing.test.ts 70d7e62180cd2e2e    scripts/smoke.mjs c567663b1e0cb2a5
```

Worker only, no migration (0030 stays the head). Owner deploys by PS; the migrations step applies nothing and is safe. Never c10. TBD ids stay TBD.
