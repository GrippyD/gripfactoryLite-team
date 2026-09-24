# Session report: strap-in mega slice (Reports, local inventory, Interco, unload sessions, Virtual Move), 2026-09-03

**Builder:** Cursor sitting at `Documents\Claude\Projects\gripfactory Practical`.
**Prompt:** `prompts/2026-09-03_reports_inventory_interco_slice.md` (canon 0.17.0) plus the dated ADDENDUM (canon 0.17.1) that landed mid-build.
**Canon:** read `_NOW.md`, `MEMORY.md`, `CANON.md` (0.17.1). This sitting did not edit `canon/` or `prompts/`. No remotes, no push, no GitHub, no deploy.

The addendum supersedes the original Part 5 manifest (T3+ Tools, not Scribe-provisional) and the TBD processor license seed. Licenses are real: `AU-G-C-000832` / AU-Grow and `AU-P-000694` / AU-Processor. `/reports` stays unPINned by the owner's word; that is not an open question.

## What shipped

Four append-only migrations (0001 through 0015 frozen; no 0020):

- `0016_local_inventory.sql`: `lookup_values` plus `local_inventory_items`. Seeds silo 1-5/NA, CSA/CSB/IN-TRANSIT, SPR/WIP/FG, both real licenses, uom g.
- `0017_dryspc_rename.sql`: `harvest_batches.silo_number` to `planned_dryspc`; `wet_weight_entries.dry_space_id` to `actual_dryspc`. Old audit rows keep the old field names; new writes use the new names. `createWetWeight` still accepts `actual_dryspc` with a `dry_space_id` fallback. Inventory sheet SQL aliases `w.actual_dryspc AS dry_space_id`.
- `0018_interco_movements.sql`: movements, items, receipts. Widened in place for T3 header fields: `planned_route`, `transfer_type`, `invoice_number`, `payment_term_days`, `gross_weight`, `gross_weight_uom`, `transporter_license`, `transporter_phone`, `driver_occupational_license`, `driver_license_number`, `vehicle_make`, `vehicle_model`, `vehicle_plate`. `driver` stays the name. `truck_number` stays. No single `vehicle` column.
- `0019_unload_sessions.sql`: `unload_sessions`; `dry_weights.session_id`; `metrc_uploads.ref_id`.

New modules: `src/xlsx.ts` (CRC32, store-method zip, `buildXlsx`), `src/interco.ts` (T3 emission), `src/lookups.ts` (landing and sections), `src/reports.ts` (five reports plus CSV/XLSX/PDF), `src/ledger.ts` (mint, unload, virtual, outbound helpers). Zero new npm dependencies.

### Local ledger

Finish lot mints one `local_inventory_items` row: hang destination -> SPR, silo -> WIP, truck -> nothing yet. qty is the wet total, package_code is the short lot id, license is AU-Grow, location is the dry space name. Re-finish after demote updates qty (`inv_minted`) instead of double-minting. `/inventory` lists "Local inventory" above the existing sheet (WIP, then SPR, then FG; newest first inside each kind). Item kinds are lookup data, never TypeScript enums that refuse unknown values.

SYSTEM_REASON keys: `inv_minted`, `inv_unload_adjust`, `inv_bucked_split`, `inv_moved_out`, `inv_received`, `inv_rejected`, `inv_unreceived`, `inv_virtual_move`. `GRAM_FIELDS` includes `qty`. Display grams go through `formatGrams`; CSV, form values, and logs stay RAW.

### Acquire, help, lookups

Silo # is the `silo_number` lookup into `planned_dryspc`. Start Time is 24h text (`TIME24_PATTERN` / `isTime24`); Acquire start time only. Zone and Rows labels say optional. Every `FieldDef` carries required `help` `{en,es}`; `renderField` prints it under the input. Lookup-backed help ends with `Admin\Data Lookups\<Category>\<LookupFieldName>`.

`/admin/lookups` is a gated landing (Harvest Operations, Production Operations, Logistics, People and System). Section pages keep the existing POST paths. Silo #, Inventory Locations, and Licenses share the generic `lookup_values` pane. Void of IN-TRANSIT is refused; void of a value still referenced by live rows is refused.

### Reports node

`/reports` is a live node (no PIN). Five cards: Inventory, Sales Order Status, TATs, Harvests by year, Product Mix by weight. Each report has GET filters, a result table, and a format bar: CSV (standard, RAW), XLSX (pretty, hand-rolled zip), PDF (pretty, print-lane HTML with on-load print). The Reports FAB stays in the same bottom-right cluster as Admin; the orange barrel is off. All three view sheets style the new surfaces; phone device mode reflows them. CO `.field-help` uses `--muted`; Cerberus uses `--ink-mute`.

### Interco and T3 manifests

Outbound and Inbound at `/interco` (PIN). Outbound create form carries the T3 header fields. Planned departure and arrival are free text (T3 dates look like `9/3/2026`), not 24h-only. Building movements (unload spear + not bucked on site + truck number) list on outbound and open via `/interco?movement=`. Items already on a building movement do not appear as checkboxes. Lifecycle: complete sends items IN-TRANSIT; inbound receive/reject; receipts; PIN-gated VOID and Un-receive. Two-pane is law except outbound checkboxes (owner explicit bend).

`T3_MANIFEST_HEADER` is byte-identical to `prompts/2026-09-03_t3_manifest_template_blank.csv` (2361 bytes, CRLF). Those two T3 CSVs are vendored; never edit; dash-audit exempt. Emission is three header rows, then T3 block layout: first data row = dest + transporter + transporterDetail + first package; later rows fill only package columns (22 leading commas). RFC 4180 quoting. Virtual Move uses the same writer with `includeTransporter: false`. Mapping: `destination.RecipientId` = destination license; PlannedRoute / TransferType / Invoice / PaymentTermDays / estimated times / gross weight+UOM from the movement header; transporter + driver/vehicle split fields; `package.Id` = item `package_code` until a METRC tag exists (PROVISIONAL; see flags). package wholesale/gross empty. IsLayover, DriverId, DriverLayoverLeg, VehicleId, VehicleRegistrationNumber always empty.

### Unload sessions and Virtual Move

Unload gains a session header: Operator, TL (actor), Spear/Bucked (hidden on silo). Hang + bucked: mint WIP `shortId-B`, reduce parent (`inv_bucked_split`), pend `package_from_harvest`. Hang + spear: adjust parent qty to dry total (`inv_unload_adjust`), pend `package_adjust`; yes -> CSA; no -> require truck and create a building interco movement (destination left empty for Outbound). Silo: hide mode, no second item, qty -> dry total, location CSA. Pending package files: finished sessions with no matching `metrc_uploads` row for `ref_id`.

Virtual Move is live at `/virtual-move` (PIN, including `/virtual-move/*`). Confirm names the crossing: grow license <-> processor license; CSA on the grow side, CSB on the processor side; item count in the JS confirm. Reverse always lands in CSA. Building 23 law is owner fact (same address, separately regulated; anything touching Building 23 is processing). It is not extra schema.

PIN stays on `/admin*`, `/interco`, `/interco/*`, `/fulfillment*`, `/inventory*`, and now `/virtual-move` plus `/virtual-move/*`. `/reports` has no PIN.

## Files written or updated this sitting

Migrations 0016-0019. New: `src/xlsx.ts`, `src/interco.ts`, `src/lookups.ts`, `src/reports.ts`, `src/ledger.ts`, `test/strapin.test.ts`. Updated: `src/actions.ts`, `src/config.ts`, `src/csv.ts`, `src/db.ts`, `src/html.ts`, `src/i18n.ts`, `src/index.ts`, `src/inventory.ts`, `src/pages.ts`, `src/pipeline.ts`, `src/theme.ts`, `scripts/smoke.mjs`, and the existing tests that named the rename, help, live Virtual Move tile, Reports node, Interco tabs, and `GRAM_FIELDS`.

Not touched: vendored saleshelper pair, brand assets, boot scrawl, Admin/Reports FAB positions, Demote, Import Data queue, T3 template CSVs in `prompts/`, wrangler.toml TBD ids, c10.

## Verification

- `npx tsc --noEmit`: exit 0.
- `npx vitest run`: 12 files, **342 tests** passed.
- `node --check scripts/smoke.mjs`: ok.
- Migrations 0001 through 0019 apply clean into a fresh local persist dir (`.mig-seal-persist`).
- `SMOKE_PORT=8788 WRANGLER_SEND_METRICS=false BROWSER=none CI=1 npm run smoke`: **SMOKE PASS**. Walks cover mint, lookups landing, report csv/xlsx/pdf, T3 manifest byte-identical repeat, complete/receive/VOID/un-receive, virtual both ways, spear-no truck 77, bucked `-B`, package files pending.
- T3 header versus blank template: 2361 bytes, equal true.
- Dash audit (UTF-8 E2 80 93 / E2 80 94) on every authored file this slice touched: **0** on each. Vendored T3 CSVs in `prompts/` are exempt.
- Visual pass on local wrangler (smoke persist, PIN 21319, identity `dev@local`, Grip/Cerberus): Reports landing (five cards, FABs gold-outlined not orange-barreled), Inventory report with CSV/XLSX/PDF format bar and ledger rows, Lookups landing (including Licenses copy naming AU-Grow and AU-Processor), Acquire HBN with help text and 24h Start Time, Interco Outbound (T3 header fields, building movement truck 77), Inbound receipts plus receipt view with Un-receive, Virtual Move (AU-Grow / AU-Processor panes and history), Unload session header (Operator, TL, Spear/Bucked, "Will these be bucked on site?"). One Phone device-mode shot of Unload. To show the session header after smoke had emptied the dry queue, the leftover weighing lot on 26004 was finished into Arlington Dry Room, then picked. A later smoke run wiped that persist.

No browser tools were needed after unlock; the screenshot wrangler on 8790 was stopped.

## OWNER-flag (needs a Dennis ruling or a Scribe fold, not resolved here)

- `package.Id` on T3 manifests maps to the item `package_code` until the owner's naming and tags doc. The T3 file shape itself is confirmed, not provisional.
- TAT metric definitions in `TAT_METRICS` remain provisional (Scribe-derived from the pipeline): field_to_wet, dry_dwell, unload_to_trim, trim_to_cryo, cryo_to_release.
- Sales Order Status is an honest empty state: "No sales order data lands here yet. The marketplace becomes the receiver for this data; nothing is wired in this slice."
- METRC sublocations: explorable later, not built. Locations stay LOCAL.
- `canon/MEMORY.md` is still pinned at 0.16.0 while `CANON.md` and `_NOW.md` are 0.17.1. Flag, do not edit canon.
- Building 23 law (owner): same address, separately regulated; anything touching Building 23 is processing. Recorded here; no extra table.
- Transfer type and the other T3 header extras are TL-typed. The filled example used "Wholesale Transfer".
- PIN now also covers `/virtual-move` and `/virtual-move/*`. House-law lists in older rows named Admin / Interco / Fulfillment / Inventory only.

Do not flag `/reports` PIN (ratified unPIN). Do not flag a TBD processor license (it is `AU-P-000694`). Do not flag the old Scribe-shaped 14-column manifest (replaced by T3).

## Sealed final check

```
cd app
npx tsc --noEmit                      -> exit 0
npx vitest run                        -> Test Files 12 passed (12), Tests 342 passed (342)
node --check scripts/smoke.mjs        -> ok
npx wrangler d1 migrations apply gripfactory-lite-local --local --persist-to .mig-seal-persist
                                      -> 0001 through 0019 applied clean
node dash-audit (UTF-8 E2 80 93 / E2 80 94) on every authored file this slice touched
                                      -> 0 on each
T3_MANIFEST_HEADER vs prompts/2026-09-03_t3_manifest_template_blank.csv
                                      -> 2361 bytes, equal true
SMOKE_PORT=8788 WRANGLER_SEND_METRICS=false BROWSER=none CI=1 npm run smoke
                                      -> SMOKE PASS

migrations/0016_local_inventory.sql     3875  sha256:e3e8be00b258aba5dd9373fdeb25390fa979e81f28b33c301051c9843affb50e
migrations/0017_dryspc_rename.sql        371  sha256:05c4dc45aa3b415cf6c934402c66f18123f2a34a2acb1c7a8f090c6a56851bc0
migrations/0018_interco_movements.sql   2191  sha256:372a3283b822a428c191a37e55172f3574ef62fa401baa935ac8058d4c69305c
migrations/0019_unload_sessions.sql      678  sha256:5f2a8f47edd53971a3db10e0ace7b611dd0fef5b06d31e5e399eb018f1d1d415
src/actions.ts                         90238  sha256:75c46bf3d72c0307a03903d498a3bced92917575ad2c35ce107bcb71c024e346
src/config.ts                          17274  sha256:42dbaa869467a2f8cdeb8820f69ac54eee89e57e603547b236f866365fce9613
src/csv.ts                             12234  sha256:239f2f2570339cb2ef6f2e2da07b08289e9f1423477bd46813c1831223c89074
src/db.ts                              54124  sha256:bf4e5275e1d2da622ac91cb4ec0e07bbc13a5953ac3185f17996356ef099413b
src/html.ts                            88823  sha256:49671ae831b0b7db8d70fd0ac92c81b081f6dca8fd0d43664456a919abadba11
src/i18n.ts                            35432  sha256:78d34ce769b4c8b9dbf8309d0ff9a8a96b56ebe6981e36f04b6e30715849546f
src/index.ts                           53186  sha256:e13755de552d98e5de368293f65983d8b9bf9897a0f4bdaf644830eedf2db8ae
src/interco.ts                          6946  sha256:0aca58ae4bdc258a3b82055529e345f4c2ab8216382f9eca76d34b11994bfdd6
src/inventory.ts                       15070  sha256:40a5033f664a7f5428b66de35dcfb12d9fe416c2807524f1a060b0add36e6949
src/ledger.ts                           5758  sha256:d528195ea221f1c31dcfb30cc6bba6663d21be0648c2f4459a31a49d3259214c
src/lookups.ts                          4594  sha256:4767d9fe6ab627f2eaed68c5e2ce8751ec7806aa92837c0696f8034a017649cd
src/pages.ts                           15877  sha256:e43e0aa21e213505c8762fbb401b3ccb5a6911d81225016e0650eb2a5d7c49ca
src/pipeline.ts                        31076  sha256:82c06c5c92e1cacd0b345b580249fe2b59d064ff96224195c98cf256abe06f2a
src/reports.ts                         15668  sha256:8658b5b61d2fe230be2c62d3e858a4597a38ab80ded88ea8601a7c895d79d1fc
src/theme.ts                           96437  sha256:fc12b407a39eab5f0adb063a0a8055a75b1efe49ac92fed5e48f8a7607fbe05e
src/xlsx.ts                             8929  sha256:52f5dffeca67250f731e83570c94b0fe6ea011f16f29d35ac9755a4e258ab21a
scripts/smoke.mjs                     119823  sha256:e218b475c0de268541abc2ae2eb95676354f1c9be60de0fd70c780adaaf5a8d2
test/strapin.test.ts                   12774  sha256:f6bc2c0835fe886a532736d6c946729f9a3a3d58bb3789a2e5cee9965916ca21
test/surface.test.ts                   67845  sha256:5b6ce50d950011b76a966308abcfa510d0d41c9bb0c5664981d2f7d5948b29fc
test/ops.test.ts                        5418  sha256:24dc027ad2ce7d0f83868ac0f939a429660479fed8419d8ba11114e1fcecee83
test/inventory.test.ts                 16048  sha256:83670da40af3f0ad39892ee66db7003af86cedfd03d2115cf3a6a979f2a2db38
test/imports.test.ts                   11600  sha256:092999b272fc5ad3d36f891aa37f48c0d85daa3240e494d0cc79638efaeebace
test/i18n.test.ts                      15513  sha256:602d03833579465c22204a7b508327ea8153f65f6b71e3de26797c4a17b0eb2e
test/routing.test.ts                   18694  sha256:a734b5d0f01ad734de472dcaac08394c366f5f10b2387f723b02383c02e8f8a8
test/audit.test.ts                      2491  sha256:b30371060a597d5d51a3793d8c5d9081943bfd0ff6f57152576c54bcf158e68f
test/csv.test.ts                       12054  sha256:61713a6e155fe0fdaac076ce4c25d0cdd92d2a2a36dafc27c7af43acd6e73609
test/view.test.ts                      20714  sha256:b43842dde136635040a1dd7f71fb71f101df63297e73aa20472dc4611f363d9d

tails
0016:  ('a2000004-0001-4000-8000-000000000002', 'license', 'AU-P-000694', 'AU-Processor', 2, '2026-09-03T00:00:00.000Z', NULL, '2026-09-03T00:00:00.000Z', NULL, NULL, NULL),
      ('a2000005-0001-4000-8000-000000000001', 'uom', 'g', 'Grams', 1, '2026-09-03T00:00:00.000Z', NULL, '2026-09-03T00:00:00.000Z', NULL, NULL, NULL);
0017: ALTER TABLE harvest_batches RENAME COLUMN silo_number TO planned_dryspc;
      ALTER TABLE wet_weight_entries RENAME COLUMN dry_space_id TO actual_dryspc;
0018: CREATE INDEX interco_receipts_movement ON interco_receipts (movement_id, created_at);
0019: ALTER TABLE dry_weights ADD COLUMN session_id TEXT;
      ALTER TABLE metrc_uploads ADD COLUMN ref_id TEXT;
```

Worker plus four append-only migrations (0016-0019). Owner deploys by PS after the Scribe's gate. Never c10. TBD ids in wrangler.toml stay TBD.

## Scribe gate addendum, 2026-09-03 (independent re-verification, canon 0.17.2)

The Scribe pulled the builder's tree into the cloud workspace and re-ran the whole gate from scratch. One staging hazard was caught on the Scribe's own bench and fixed there (a bulk copy briefly regressed src/icons.ts and test/audit.test.ts from stale upload copies; both re-staged; the final tree was then proven byte-identical to the repo, all 56 gate files hash-matched). One false alarm closed at the same bench: a text-mode capture made the T3 header look LF-only; the binary compare proves it byte-equal.

```
Tree: 56 files sha256-matched to the repo   -> TREE MATCHES DEVICE EXACTLY
npx tsc --noEmit                            -> exit 0
npx vitest run                              -> Test Files 12 passed (12), Tests 342 passed (342)
node --check scripts/smoke.mjs              -> ok
Dash audit (every touched file)             -> 0
T3_MANIFEST_HEADER vs vendored blank        -> BYTE-EQUAL, 2361 bytes, CRLF (binary compare)
License seeds in 0016                       -> AU-G-C-000832 / AU-Grow, AU-P-000694 / AU-Processor, no TBD
0018 widened in place                       -> T3 header columns present; no 0020 exists
package.json / wrangler.toml               -> untouched (no new deps; TBD ids stay TBD)
rm -rf .smoke-persist && SMOKE_PORT=8987 WRANGLER_SEND_METRICS=false timeout 280 npm run smoke
                                            -> SMOKE PASS, 19 migrations applied from zero (exit 124 is the dev-server timeout kill)
/reports with no PIN cookie                 -> 200, no PIN page; /virtual-move with no cookie -> Enter PIN
Visual pass (Scribe-rendered, seeded dev on 8877, read back): lookups landing (categories and
descriptions), Acquire (help text with Admin\Data Lookups paths, 24h start, optional labels,
recall pane), Reports node title, Inventory report (filters, format bar, WIP then SPR then FG,
honest FG footnote), Outbound (checkbox pane, full T3 header fields, building movements list),
Inbound (receipts latest first, View receipt, reasoned VOID), Virtual Move (both license panes,
moves log with per-move manifest export, real license numbers), Unload picked (session header:
Operator free text, TL from identity, Spear/Bucked radios, "Will these be bucked on site?" with
Truck # required-if-no, comma-grouped balances), phone reflow.
```

Accepted deviation, folded to canon: planned departure and arrival are free text to match the
vendored T3 example's date style (9/3/2026), not 24h-gated; the 24-hour law governs time-of-day
fields (Acquire start time), not T3 date fields. Polish note, not a block: the Outbound left
pane renders its checkbox items as flowing labels; a one-per-row grid would read better on the
computer layout. Standing provisionals as the builder flagged: package.Id maps to package_code
until the naming and tags doc; TAT metric definitions; Sales Order Status honest empty state;
METRC sublocations explorable later.

GATE GREEN. Deploy pending: migrations 0016-0019 plus the worker in one PS run.
