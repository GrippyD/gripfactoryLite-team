# Session report: marketplace rework and trim reconciliation gate (canon 0.22.0 rulings, cut at 0.24.0), 2026-09-05

**Builder:** Cursor sitting under the Scribe prompt. Marketplace and trim only. Interco untouched. Never deployed. No remotes.

## What shipped

Migration 0027 (`0027_marketplace_rework_splits.sql`): `listings` gains `package_label`, `package_item_id`, `category` (label backfilled from `package_tag`; the old column stays and is no longer written); `local_inventory_items` gains `parent_item_id`; `lookup_values` seeds `listing_category` (Flower, Smalls, Trim, Fresh Frozen, Concentrate, Other). Admin Data Lookups gains a Marketplace section for Listing Categories.

Marketplace listings take a sales-facing Label (optional), an Internal package pick of live FG/WIP (optional unless the listing is from a split child), a Category select, and Quantity grams. Lbs are calculated from the shared `GRAMS_PER_LB` (453.59237) in `compliance.ts`. Matching prefers the item link when set (linked row exists, not deleted, qty covers the listing); otherwise it falls back to tag matching against live inventory by package code.

Package splits live on the Marketplace page: pick an FG or WIP parent, rapid-add children (`<parent>-S1` via `splitChildCode`, PROVISIONAL), parent decrements, over-split is flagged never blocked, `SYSTEM_REASON.inv_split` logs parent and each child. A split pends `package_split` at `/admin/uploads` under Splits (download plus mark uploaded). CSV header `ParentLabel,ChildLabel,Quantity,UnitOfWeight,Date` is PROVISIONAL.

Trim Save (not the plus) with nonzero remaining opens the existing `reconcileGate` interstitial. Queue adjust and queue finish pend at `/admin/uploads` only. Queue finish runs `lot_trimmed_unloaded` so the lot leaves the trim pane. Zero remaining Save skips the gate.

## Out of scope (held)

Interco and virtual move. Finish Parent / TRI NUG SHA. Marketplace order-fulfillment inventory consequence. Vendored files, canon/, prompts/, wrangler TBD ids.

## Sealed final check

```
cd app
npx tsc --noEmit                      -> exit 0
npx vitest run                        -> Test Files 15 passed (15), Tests 398 passed (398)
node --check scripts/smoke.mjs        -> ok
Dash audit (17 touched files)         -> DASH_HITS=0
$env:SMOKE_PORT='9027'; $env:WRANGLER_SEND_METRICS='false'; npm run smoke
                                      -> SMOKE PASS, "About to apply 27 migration(s)" from zero
                                         (script stopped wrangler in finally; exit 0)

migrations/0027_marketplace_rework_splits.sql     2012 bytes   sha256:7a5e2822a569345f6c4ea8b914454e2e13abdcc9959df029c6dafe0608099b82
src/marketplace.ts                            16974 bytes   sha256:a24754759f1343b782933cd82ed3379a113219c912ba5af080aab02d578c245b
src/config.ts                                 18334 bytes   sha256:c58e901c500c2bb7f8866ff06917ed07739134d452c744b367efc4e4b7148297
src/lookups.ts                                 6390 bytes   sha256:94feb31daba6d64a3d737349e21a5204412ec5feaa8d00188b8b5c4d0694075d
src/db.ts                                     80378 bytes   sha256:92359a077b7a8636358db664b15bcbca89aa2c21f556b0daba196b77180abfca
src/biz.ts                                    32420 bytes   sha256:73b6e3c527e9e3e00e232d2f2115e3c9dfe1d935266331d01a23e1246d5db1e0
src/actions.ts                               115562 bytes   sha256:39f060dec5b5a262af2219eb88ab0a21818ad5514d3c2921a7cae185dd60edfe
src/html.ts                                  117959 bytes   sha256:b9783c8cfc9b8b4a2aee3bca43291e0b1cdcefe715d02fffe683953923a0ed49
src/index.ts                                  77767 bytes   sha256:f4f51366f2aabbbd21a664d053e7855ad3f217db58864cede5a424d03277f3be
src/i18n.ts                                   67338 bytes   sha256:f6d4cab48e437d5af294c2914eb70726a21ccb050f8e77863b11515765de0ae7
src/pipeline.ts                               36466 bytes   sha256:878758a6f10bebcd2e933e71f2b9ace9df8b8407016d2b706e601c9114343467
test/business_ops.test.ts                     34637 bytes   sha256:f18174433ab4e0b428a2bbbb53612925bb5d66c5079eb24ccc1deb2cadc5281a
test/strapin.test.ts                          14930 bytes   sha256:223e403511b4ac6f283a2b9ab2e4e5df04b5c93ce0448492d4e8e1ecf158d3d5
test/i18n.test.ts                             17206 bytes   sha256:303f6b91b2c4e197f538947c975fc84c08858c731d753db37339c8ca25b61c8f
test/surface.test.ts                          70796 bytes   sha256:cef8f4b450142f97fe0b2bdc70c796626b1b53b8c635a1628183b1558806fc7c
test/gate.test.ts                             18408 bytes   sha256:f8d87f5824ff877446446733425e0003f1caafce1e58fa45b31386e30cb7cc68
scripts/smoke.mjs                            155615 bytes   sha256:c2acf71c44f00f55805d1018f8dcb5b6fb1e3c9e4b32d003a8ff0a6d2ab372ec
```

From-zero smoke pin is now 27. Interco starts at 0028.
