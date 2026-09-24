# Session report: walk slice (Interco menu, real licenses, exact icons, walk fixes), 2026-09-04

**Builder:** Cursor sitting at `Documents\Claude\Projects\gripfactory Practical`.
**Prompt:** `prompts/2026-09-04_interco_menu_walk_slice.md` (canon 0.18.0 walk of worker 45590869; `_NOW.md` is 0.19.0).
**Canon:** read `_NOW.md`, `MEMORY.md`, `CANON.md`. This sitting did not edit `canon/` or `prompts/`. No remotes, no push, no GitHub, no deploy.

The 09-04 prompt is the source of work. The older 09-03 walk draft in `prompts/` was not used. The gate-and-barn slice (`prompts/2026-09-04_unload_gate_virtual_move_slice.md`, migration 0021) is the next box and was not built here.

## What shipped

One append-only migration. 0001 through 0019 stayed frozen.

- `0020_license_map_and_walk.sql`: `lookup_values.tone`; relabel the two seeded licenses in place (ids kept) to PNN AU (blue, sort 1) and PNN Processor (green, sort 3); insert the five missing license rows (`a2000004-...000003` through `000007`); `interco_movements.metrc_manifest_number`; `interco_movement_items.received_qty`.

### Exact icons

The owner's zip at `prompts/2026-09-04_operations_icons.zip` (sha256 leading `830ccccc5b20ab04`) was extracted AS-IS into `app/public/icons/{white,dark}/` (12 SVG + 12 PNG). Bytes were not redrawn, re-exported, minified, or stripped. C2PA blocks stay on the SVGs. The 24-file tree is present; the Scribe-pinned tree hash `b654ad0dd0798614` was not reproduced from several join formats of the sorted per-file sha256 list (see flags).

The six map nodes and `/ops` group headers render `<img>` pairs through the assets binding (and an allowlisted `GET /icons/:variant/:file` lane like `/brand`): harvest-field, interco-truck, drying-silo, production-factory, marketplace, business-scale. Size is the 3.4rem / 54x54 box, `aria-hidden`, `loading="eager"` on home. Dark grounds show `/icons/white/`; light grounds show `/icons/dark/`; CO `prefers-color-scheme: dark` swaps to white. No JS.

`src/icons.ts` still compiles. The map no longer uses it. It is legacy for the map.

Lite's sheet is paper (`--bg: #f3efe6`, white tiles). The prompt called Lite a dark ground. Canon and the live Lite tokens win: Lite shows the dark icon set. Cerberus stays on the white set. See flags.

### Walk fixes

- Acquire start time carries `data-time24-mask`. A tiny inline script masks `0730` to `07:30` as the user types. Server TIME24 is unchanged. Smoke posts raw digits and still gets 400.
- Unload Spear/Bucked: unique ids `weigh_mode_spear` / `weigh_mode_bucked`, `label[for]` wired. All three sheets force `appearance: auto`, raise z-index, and restore pointer events so a sheen layer cannot eat the tap. Phone radios are a touch larger. A weightless hang session is not disabled. Rendered click: unchecked, then Spear checks and the on-site block appears.
- "Will these be bucked on site?" lives in `#bucked-on-site-block` and stays `hidden` until Spear is checked. A bucked session never sees the question. Server still only honors the answer on spear finishes.

### License map

Every license select option is `<value> - <label>` plus a live tone chip (chip text = the label). License text on movement lines, receipts, Virtual Move, and the lookup pane wears `.tone-blue` / `.tone-yellow` / `.tone-green`. Cerberus: tinted ink on steel. CO: tinted text on paper (dark variant swaps). Lite: tinted chunky border. The generic license lookup pane shows and edits `tone` (reasoned `/record` edit; tone is on `lookup_values` in the registry). Virtual Move still pins `AU-G-C-000832` and `AU-P-000694` by value.

### Interco menu, Outbound, Receiving

`/interco` is a Fulfillment-style menu: [Outbound] `/interco/outbound`, [Receiving] `/interco/receiving`. Old `?tab=outbound` / `?movement=` 302 to outbound; `?tab=inbound` 302 to receiving. PIN still covers `/interco` and `/interco/*`. The ops map node still points at `/interco`.

Outbound is three panes: dry spaces grouped by farm (resident SPR/WIP by space name; [Add] stages all shippable items; already-on-movement items muted; empty spaces muted with no control); header plus the seven colored licenses (picking a license may preselect PNN/PNS/ARL) plus added packages with [Remove] plus one action [Finish Outbound Shipment]; right pane building recall (Acquire idiom) and finished CSV links. Finish writes the T3 CSV (emission unchanged), stamps `exported_at` and `completed_at`, sets items IN-TRANSIT (`inv_moved_out`), lands on `/interco/outbound/:id/done`. Zero packages: 400. Manifest number is the movement id short (first 8) until `metrc_manifest_number` is typed.

Receiving is two panes. Left line: `Origin Farm - Manifest number - Truck # - Weight` (gross when set, else comma-grouped item sum). Receive opens an inline weight box (manifest qty prefilled, overridable; no dialogs) and stores `received_qty`. Reject stays reasoned. [Receive all] takes manifest weights. [Finish Receipt] builds the receipt, sets farm_code PNN and location CSA, adjusts qty to `received_qty` when it differs (`inv_received`, RAW), and pends `receive_manifest` on `metrc_uploads` (`ref_id` = receipt id). Nothing received: 400. Un-receive and VOID clear `received_qty`.

`RECEIVE_CSV_HEADER` in `src/interco.ts`: ManifestNumber, PackageTag, ReceivedQuantity, UnitOfWeight, ReceivedDate, ReceivingLicense. One row per received item, RAW, RFC 4180.

## Files written or updated this sitting

New: `app/migrations/0020_license_map_and_walk.sql`, `app/test/walk.test.ts`, `app/public/icons/` (24 vendored files). Updated: `src/actions.ts`, `src/config.ts`, `src/db.ts`, `src/html.ts`, `src/i18n.ts`, `src/index.ts`, `src/interco.ts`, `src/pages.ts`, `src/pipeline.ts`, `src/theme.ts`, `scripts/smoke.mjs`, `test/ops.test.ts`, `test/i18n.test.ts`, `test/imports.test.ts`, `test/surface.test.ts`. `src/icons.ts` kept compiling, unused by the map.

Not touched: vendored saleshelper pair, T3 CSV pair, wrangler.toml TBD ids, c10, migrations 0001-0019, canon/, prompts/.

## Verification

- `npx tsc --noEmit`: exit 0.
- `npx vitest run`: 13 files, **354 tests** passed.
- `node --check scripts/smoke.mjs`: ok.
- Migrations 0001 through 0020 apply clean into `.mig-seal-walk-persist` and `.render-walk-persist`.
- `SMOKE_PORT=8789 WRANGLER_SEND_METRICS=false BROWSER=none CI=1 npm run smoke`: **SMOKE PASS** (after the Lite icon display fix). Walks cover the start-time mask refusal, seven licenses, Interco menu and old `?tab=` 302s, dry-space add, Finish Outbound Shipment, IN-TRANSIT, receive override, Finish Receipt to PNN CSA, receive CSV download, icon URLs 200, spear radios plus the on-site hook, Virtual Move value pins.
- T3 header versus `prompts/2026-09-03_t3_manifest_template_blank.csv`: 2361 bytes, emission unchanged (strap-in and smoke still assert the T3 shape).
- Dash audit (UTF-8 E2 80 93 / E2 80 94) on every authored file this slice touched: **0** on each. Vendored icons and T3 CSVs are exempt.
- Rendered pass on local wrangler (`.render-walk-persist`, port 8791, PIN 21319, identity `dev@local`):
  - Home icons: Cerberus white-on-steel; CO light dark-on-paper; CO dark (emulated `prefers-color-scheme: dark`) white-on-dark; Lite dark-on-paper after the variant-law fix (white-on-Lite washed out on the first Lite shot).
  - Interco menu: Outbound and Receiving tiles.
  - Outbound: staged Silo 2 WIP, blue PNN AU chip, green PNN Processor chip, building recall `522cc649`.
  - Receiving: line `PNN - 522cc649 - - 30`, reveal open at weight 80, Confirm receive visible.
  - Unload radios: before (neither checked, on-site hidden); after Spear (checked, on-site Yes/No plus Truck #). Bucked then hid the block again (`hidden` + `display:none`).
  - Phone home: stacked map, white icons on dark, Reports and Admin at the foot.

## OWNER-flag (needs a Dennis ruling or a Scribe fold, not resolved here)

- **Receiving CSV shape (provisional):** `RECEIVE_CSV_HEADER` is Scribe-ruled. No T3 receive template exists in the vendored set. A real template lands as a one-constant edit.
- **Manifest number (provisional):** movement id short (first 8) until `metrc_manifest_number` is typed. Every surface prefers the typed value when set.
- **Receiving Weight source:** header `gross_weight` when set, else the comma-grouped sum of item quantities. Empty truck renders as a blank slot (`PNN - 522cc649 - - 30`).
- **Dry-space add unit:** [Add] stages every resident SPR/WIP whose location is that space's name and is not already on a building movement. CSA inventory does not appear on the dry-space pane.
- **Icon tree hash:** extracted 24 files AS-IS from the 09-04 zip (zip sha256 starts `830ccccc5b20ab04`). Sorted per-file sha256 list hashed under several join formats never produced `b654ad0dd0798614`. Scribe re-check needed.
- **Lite icon ground:** the prompt said Lite is a dark ground and should use `/icons/white/`. Live Lite tokens are paper. White icons on Lite tiles were unreadable in the first rendered shot. This sitting followed the variant law (light ground = dark set) and canon's Lite sheet. Flag the prompt wording.
- **`src/icons.ts` is legacy** for the operations map. Tests still import it so it keeps compiling.
- **`canon/MEMORY.md` is still pinned at 0.17.3** while `_NOW.md` is 0.19.0. Flag, do not edit canon.
- **Next slice (not built):** `_NOW.md` says 0021 cuts receipts to PNN BARN. This slice still lands Finish Receipt on PNN CSA as the walk prompt ordered.

Do not flag `/reports` PIN (ratified unPIN). Do not flag T3 outbound emission (unchanged). Do not flag Virtual Move values (still 832 and 694).

## Sealed final check

```
cd app
npx tsc --noEmit                      -> exit 0
npx vitest run                        -> Test Files 13 passed (13), Tests 354 passed (354)
node --check scripts/smoke.mjs        -> ok
npx wrangler d1 migrations apply gripfactory-lite-local --local --persist-to .mig-seal-walk-persist
                                      -> 0001 through 0020 applied clean
node dash-audit (UTF-8 E2 80 93 / E2 80 94) on every authored file this slice touched
                                      -> 0 on each
T3 blank prompts/2026-09-03_t3_manifest_template_blank.csv
                                      -> 2361 bytes, sha256:186e4469611aaeeb9d324708f6b259dbf768e43679d8968f1addb2f7ce146ef3
prompts/2026-09-04_operations_icons.zip
                                      -> 321727 bytes, sha256 leading 830ccccc5b20ab04
SMOKE_PORT=8789 WRANGLER_SEND_METRICS=false BROWSER=none CI=1 npm run smoke
                                      -> SMOKE PASS

migrations/0020_license_map_and_walk.sql     1733  sha256:6f68d7ef0ca2ee7ca54fe4cf034cdc99f8cb98ee37a3e41d93189afeb9b11095
src/actions.ts                             103708  sha256:1dd7d6e7511ee7a4bf845f391131c3de7adb93475afe89b5b88bca7e0f293d38
src/config.ts                               17323  sha256:84200b646514a841b282c1e74bf4e2f0f29cc7d2dc749dc00ce31c5023cfcc6b
src/db.ts                                   58493  sha256:262728dce3c8547a802e229860007579afa8433465573798e36997a9c276e1f5
src/html.ts                                101387  sha256:09b2077b5372d12170ca0f6a06bec872461664366b85a46ce3035a50c9c1ec0e
src/i18n.ts                                 37093  sha256:3bf10aa47939edc8e6d1423774d03c67091a734737dffb9e014cb71aa6eaf1d4
src/index.ts                                57625  sha256:8dcb8fbf3e3fe70fc6b69ba2601ca2c31dad087b30bbaa6cf0471cc93740c46d
src/interco.ts                               9022  sha256:7eec696fcad9dbdabefa7b1eb7ba1608fdb91324598ec0746d780944d410b358
src/pages.ts                                16929  sha256:a0b59b92f3534ac52a20faf49a9fda455a49f2c1e3b4bcc03b695056e4e4f84d
src/pipeline.ts                             31520  sha256:c140fa0c23d7dafe9058f860e549717dcaf8871d8730ea554c8a0eabeeadfd9c
src/theme.ts                                99952  sha256:8ae1c6e52428051e6f720f08efad3c74c51b13d789e4c6a07f0c0ab92496f348
src/icons.ts                                 3186  sha256:8a44dd72e1b63a4db2a7400bddf51eaa0af3454b862c08ac10f29d660f7d6b03
scripts/smoke.mjs                          129117  sha256:a62b5e8ffa053d63a7364779c3514f18bde0cca3c4518fe705f4f509065a8a3a
test/walk.test.ts                           35308  sha256:af433ec77e2c36b7d06f61737362dbd0eced37506a9b2ded6d4a4cac7f9d876b
test/ops.test.ts                             6676  sha256:3f4679a7f5fdc5528814b6b7c5ca47818f4f3ee0c84b4276864d58c6febe8860
test/i18n.test.ts                           15509  sha256:1961e005c5d55f66e63e39504a3e393553f321cca57810ae82faf3b3f1059f64
test/imports.test.ts                        11596  sha256:df40870a0197caf00d1af163174ecb2f3e63aa6348edbc76d162e15157839b2e
test/surface.test.ts                        67841  sha256:4340da74deec5b1aec1fcfd826fc1dbbafead614e8183a5c6ea150fa9732901f

tails
0020: ALTER TABLE interco_movement_items ADD COLUMN received_qty NUMERIC;
actions.ts: export { MANIFEST_COLUMNS, buckedPackageCode };
index.ts: export default app;
smoke.mjs / walk.test.ts: });
```

Worker plus one append-only migration (0020). Owner deploys by PS after the Scribe's gate. Never c10. TBD ids in wrangler.toml stay TBD.
