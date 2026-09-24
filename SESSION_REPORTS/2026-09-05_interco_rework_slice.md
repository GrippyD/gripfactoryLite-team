# Session report: Interco Logistics rework, the map is the module (canon 0.23.0 through 0.25.0), 2026-09-05

**Builder:** Cursor sitting under the Scribe prompt. Interco only. Marketplace and trim left alone. Never deployed. No remotes.

## What shipped

Migration 0028 (`0028_interco_site_barns.sql`): lookup_values gains `ARL BARN` and `PNS BARN`; CSA is restored (0021 cutover note stands as history); items sitting in BARN whose harvest batch farm is ARL move to ARL BARN, PNS likewise; PNN and unlinked rows stay; IN-TRANSIT untouched.

Side convention v2 is data in code (`SITE_OF_LOCATION` in `src/config.ts`): BARN, CSA, and silos are PNN; ARL BARN and PNS BARN are their sites; CSB and every unknown location fall to PROCESSOR under 694. `isPickableProcessorDestination` keeps IN-TRANSIT off the pick list.

`/interco` is the floor: ARL, PNN (wide, 832 side plus Building 23), PNS; On the road; per-site Send material and Arrivals; Cross the door; Ship external from Building 23; one-export-home footer. Old tiles are gone.

`/interco/send/<site>` picks the site barn only (no dry spaces, no license picker). Lane cards state destination barn, arrival license, and purpose. Finish derives origin and destination licenses from the lane, flips items to IN-TRANSIT, pends the T3 manifest at `/admin/uploads`.

`/interco/arrivals/<site>` lists wet trucks and manifested movements to that site. Overridable receive weight and Finish Receipt land the site barn with `licenseForSiteArrival`.

`/interco/door` is the virtual move, reframed: 832 side (BARN and CSA) into Building 23 (CSB first, becomes 694); back out always lands BARN. `/virtual-move` GET 302s here; the old POSTs still work.

Ship external is the T3 builder scoped to Building 23 items. `/interco/outbound` and `/interco/receiving` 302 to ship-external and arrivals/pnn. PIN still gates every `/interco*` and `/virtual-move*` route.

## Out of scope (held)

Med paper-door manifest emission. Marketplace and trim. Dry space management itself. Vendored files, canon/, prompts/, wrangler TBD ids.

## Sealed final check

```
cd app
npx tsc --noEmit                      -> exit 0
npx vitest run                        -> Test Files 15 passed (15), Tests 401 passed (401)
node --check scripts/smoke.mjs        -> ok
Dash audit (16 touched files)         -> DASH_HITS=0
$env:SMOKE_PORT='9028'; $env:WRANGLER_SEND_METRICS='false'; npm run smoke
                                      -> SMOKE PASS, "About to apply 28 migration(s)" from zero
                                         (script stopped wrangler in finally; exit 0)

migrations/0028_interco_site_barns.sql             1731 bytes   sha256:f50f9912b5e84e5aed5dcba384591b25a9f6a656e7a4f868938a53b9cfeab609
src/config.ts                                     19958 bytes   sha256:318bedad33b53317c1af24b5ddb1d436f05b3db30706f0726d57d7a2b032c578
src/lookups.ts                                     6426 bytes   sha256:509a7e51fff372727049193476b63cb39116b0db5162ae03698cd6c594af09af
src/interco.ts                                    12546 bytes   sha256:1a824b8ba07a84b1d8746a0bb5cb31fcd5a2269f56ada99bd1a2fc1ba5dbe13e
src/actions.ts                                   122879 bytes   sha256:92206c6809513f59b9fbf32ed0932bbd7ad4fae7566cf3cd852eb4ef9e9e1d32
src/theme.ts                                     106959 bytes   sha256:538095b99c92a36dd7d46bb7cec1410a341ab6a166185c6a1aec281060ad434c
src/html.ts                                      129142 bytes   sha256:07f101920c91884dd12334d0e82d0b16523bfa451723074fa1acc2193abc71b1
src/index.ts                                      83394 bytes   sha256:3d1895dc894606c972e61891613fc9ff4e7d48c64f8aa6c34fd0af8198a0ffa7
src/i18n.ts                                       71876 bytes   sha256:19487455ce21516350b314e2a905fa24089d13e434d84c16c9925134d967f421
src/pages.ts                                      17198 bytes   sha256:d756ca0374a0894232c9c7a52829b88d1694549f8b51432ad84ae7c9cb212912
src/db.ts                                         80823 bytes   sha256:04624fbfd0e2aa0bb9d59175276ed2c70839c95ddb315531d91bea8098d15dc2
test/walk.test.ts                                 39104 bytes   sha256:8f3efe4abd335ef15264155b73f2bdc875c50ad9366fa4a4214203c44d347039
test/gate.test.ts                                 20647 bytes   sha256:d86e1e6fd1249e78b34633c51d7712783c3c6adb12820085cd1de80afce7be73
test/i18n.test.ts                                 17517 bytes   sha256:3a969842a7bf344711acf85e1d4c3f0fb9aa058a26b86ee7ab13db6831041e55
test/strapin.test.ts                              14966 bytes   sha256:151f006963754fd8a7bf5a24b1ef88dd0a0930cba2149e5fc1c184525337aa21
scripts/smoke.mjs                                157976 bytes   sha256:dc0c338d448749ce7c741e1b45a446a01a7d739d19d331c51569a4f582143978
```

From-zero smoke pin is now 28. Marketplace 0027 stays sealed on disk. Say deploy when you want this on the worker.
