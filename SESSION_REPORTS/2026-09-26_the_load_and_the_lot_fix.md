# 2026-09-26 The load and the lot, the gate's fixes

The fix sitting on the gate `SESSION_REPORTS/2026-09-26_gate_the_load_and_the_lot.md` (canon 0.30.242). No migration. The head stays 0075. Not deployed. Nothing committed. Part two was not started.

## What changed

D1 and D2. `syntheticLot` sets the row id to the harvest batch. The Load Silo list, the drying Available `>>`, the Scheduled `>`, the selected row, the hidden `lot_id`, and the parts lookup all use that id. A lot of two or more parts renders one `plant_count[<entry id>]` box for each part that has no count, and the load writes each typed count onto that part.

L1. `<<` no longer looks at every open load of the HBN. An open pass covers only parts still waiting, and loading completes the pass, so an earlier load that is still drying does not block a later pass from returning to the Dry Queue.

L2. An open pass whose parts have all left the queue stays on Scheduled, with `<<` and no `>`, so it can be cleared instead of catching the next part.

L3. When every part has a plant count, the lot's count is their sum.

The drying surface comment that still named `listBarnWetLots` now names `listScheduledLotsForLoad`. The comment on that function matches the batch id.

A route test opens Load Silo from the Scheduled `>` and loads a two-part lot with typed counts. Smoke walks the same: two finishes of one HBN, the `>` on the batch, both boxes, both counts stored.

## Gates

- `npx tsc --noEmit`: exit 0.
- `npx vitest run`: 56 files, 906 tests passed. The same under `TZ=America/New_York`.
- `node --check scripts/smoke.mjs`: exit 0.
- From-zero smoke (`SMOKE_PORT=9160`, `WRANGLER_SEND_METRICS=false`): `About to apply 75 migration(s)`, `SMOKE PASS`, ` 500 ` lines: 0, exit 0.
- Dash audit: 0 on the files below (U+2014 and U+2013).
- `METRC_INTEGRATOR_KEY = "` and `METRC_USER_KEY = "` appear in no file under `src`, `test`, `scripts`, or `wrangler.toml`.

## Deploy

Not deployed from this session. Nothing committed. The head is 0075.

## Sealed final check

```
npx tsc --noEmit                      exit 0
npx vitest run                        56 files, 906 tests passed
TZ=America/New_York npx vitest run    56 files, 906 tests passed
node --check scripts/smoke.mjs        exit 0
SMOKE_PORT=9160 WRANGLER_SEND_METRICS=false node scripts/smoke.mjs
                                      About to apply 75 migration(s); SMOKE PASS; " 500 " lines: 0; exit 0

src/actions.ts                   339435  2892e3e67780b203  tail: export { MANIFEST_COLUMNS, buckedPackageCode };
src/db.ts                        175713  243ebe4b8e25b7ec  tail: }
src/scheduling.ts                 44887  9895a9151f950613  tail: }
src/index.ts                     139063  dafc113b8ab9b9b0  tail: export default worker;
test/logistics.test.ts             9471  68cb8c55502cdf62  tail: });
scripts/smoke.mjs                595958  a3f750aa321d9388  tail: });
```
