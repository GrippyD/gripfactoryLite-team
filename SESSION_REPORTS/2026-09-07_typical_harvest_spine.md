# Session report: the typical-harvest spine and the punch list (canon 0.30.1), Scribe-direct, 2026-09-07

**Scribe:** Gripfactory Lite Scribe (Cowork), Scribe-direct under G-2. The ten fork answers to the 0.30.0 reconciliation, built as one slice. Two migrations (0033, 0034), no surface redesign, per the owner's constraint ("I don't want to change the surfaces unless necessary").

## THE SPINE (forks 1 to 3): the harvest package is born at Finish lot

`planFinishMint` (ledger.ts) retires the space-kind map: every Move To kind, trucks included, mints at Finish lot in the farm's BARN under the batch (plant-tag) license, kind from the lot's material form (spear SPR, bucked WIP). `finishLot` (actions.ts) then, in the same db.batch, walks the spine each step leaving its paperwork:

- **Fork 1 (verbatim "Yes, that's correct."):** the birth in Barn at the plant-tag license.
- **Fork 2 (verbatim "Do both in one step, but just make sure that the METRC side isn't skipped."):** a med birth fires `equivalentTransferStmts`: a COMPLETED virtual movement (med origin, farm-AU destination) that pends its manifest at the export home like every finished movement, and the item's license flips to AU in the same batch, logged. The METRC side can never be skipped because the movement is the paperwork.
- **Fork 3 (verbatim "I like it"):** a truck lot fires `truckManifestStmts`: a COMPLETED interco movement to the destination barn (via the standing `wetTruckDestSite` law, PNN origin to ARL else to 832), pending its manifest. The item stays at the origin barn; the arrival's one-button receive closes the manifest (a receipt lands, the item moves to the destination barn under the arrival license). A lot born before the spine still mints at receipt (the fallback).
- **Step 7:** a non-truck lot born in Barn moves to its actual space immediately, the move logged.
- **Harvest CSV (spine step 3):** `wetWeightsCsv` / `wetWeightsCsvWithTags` take a barn-location argument; the route passes the batch farm's barn, so DryingLocation reads BARN, never the silo or truck.

## The punch list (forks 4 to 10)

- **Fork 4 (verbatim "Don't care, auto-resolve..."):** migration 0033 seeds Patrick's 95-strain table (vendored at prompts/2026-09-07_patrick_strain_codes.md). The one collision (071 twice): standing law keeps Gelato 41 at 071 and Blue Andeez at 078; Banana Berry Wine takes 096 (next free); "Elecetric Grape Diesel" renamed Electric; codes stay editable in Admin lookups (already exposed).
- **Fork 5 (verbatim "do it"):** migration 0034 makes the GR-C trio the farm Med lines (PNN GR-C-001132, PNS GR-C-001405, ARL GR-C-002600), retires the MED-*-TBD and 1132 placeholders, and moves any batch off a placeholder. config.ts constants swapped.
- **Fork 6 (verbatim "...bury it in Admin somewhere for now. I don't want that to be the default."):** `/admin/manual-hbn`, an Admin-buried form that hand-types the whole HBN under the same farm-assigned license law, parses and guards the YY### serial, demands a reason, change-logs. Acquire stays the default. A "Fallback" Admin tile.
- **Fork 7 (verbatim "Remove from the app for now, we'll rethink this one..."):** the Finish-package-in-METRC gate choice removed from every gate (unload and trim). The adjustment CSV is the corrective and completing lane on both sides of the delta.
- **Fork 8 (verbatim "Yeah, that's smart"):** a queued adjustment (unload and trim) lands on /admin/uploads where its file pends, instead of flashing back to the station.
- **Fork 9 (verbatim "Leave that the way we have it..."):** cryo untouched.
- **Fork 10 (verbatim "...remove feedback."):** the log-pencil item dropped, no change.

## Sealed final check

```
cd /home/claude/deploy/app
npx tsc --noEmit                      -> exit 0
npx vitest run                        -> Test Files 16 passed (16), Tests 433 passed (433)
Dash audit (17 touched files)         -> 0
SMOKE_PORT=9479 WRANGLER_SEND_METRICS=false timeout 285 npm run smoke
                                      -> SMOKE PASS, "About to apply 34 migration(s)" from zero
Smoke walks added/reworked: the truck lot's package born in its origin barn at
  finish with its manifest pending; the spear truck born before the receive and
  the one-button receive closing the manifest with a receipt; the med lot's
  barn birth, GR-C-001132 equivalent-transfer manifest, and silo move; the
  harvest CSV addressing BARN not the silo/truck; the WET fold covering only
  pre-ledger lots; strains (Electric, Banana Berry Wine 096, Zuava) exposed in
  Admin lookups with codes; the manual HBN mint, its 409 on a taken serial, and
  its Admin tile; the GR-C trio as the Med lines with the placeholders retired;
  the gates offering the adjustment CSV, no METRC finish, landing at uploads.

migrations/0033_strain_table.sql 956b226932e46c73  migrations/0034_grc_licenses.sql 69eb38845098cd6b
src/actions.ts a4f3d11f2f2e08ad  src/config.ts e5e97201ed764010  src/csv.ts 76849bf8e22ef7e7
src/html.ts 053ebf84d02d9050  src/i18n.ts aea6cddf535625d9  src/index.ts 86db6873fcbb5a9b
src/ledger.ts f7f46543fda79987  src/pages.ts 4fa1b3e7f34c81a5  src/reconcile.ts d415a0f3da1f4853
test/csv.test.ts 4585a5f3a15c8d99  test/floor.test.ts 2ac4ae22794b9a5c  test/gate.test.ts d5f0569531ca2738
test/strapin.test.ts 412c08538867abf7  test/surface.test.ts 73a520c97faaee45  scripts/smoke.mjs 7d1e3cacb38ab2a0
```

Worker plus two append-only migrations (0033, 0034). Never c10 deploy. The remaining owner-owed items (T3 receive/finish templates so the METRC receive side closes on paper; the naming-conventions doc; instrument sample CSVs) stand where they were.
