# Session report: the four-window interco floor and the HBN license (canon 0.28.0 + 0.28.1), 2026-09-06

**Builder:** Cursor, build hand. Dispatch `prompts/2026-09-06_four_window_floor_slice.md` plus the mid-build ADDENDUM (canon 0.28.1). Never edited `canon/` or `prompts/`. Never deployed.

## What shipped

The old three-panel floor, its Send buttons, and the Building 23 panel are gone. `/interco` is four windows left to right: Arlington, PNS, Penn North, then the working pane. Arrivals pages and the On the road strip stay. Retired `GET/POST /interco/send/:site`, `GET /interco/door`, door POSTs, `/virtual-move`, `GET /interco/ship-external`, and `tab=outbound` 302 to `/interco`. Ship-external save and zero-package finish POSTs stay for the empty-header walk.

Each site window is a details/summary tree, open by default. One collapsible license line per license the site carries, colored by class as text color (`.lic-au` yellow, `.lic-med` blue) on all three view sheets (cerberus, lite, co). Site licenses:

- Arlington: `AU-G-C-001509`, `MED-ARL-TBD`
- PNS: `AU-G-C-001397`, `MED-PNS-TBD`
- Penn North: `AU-G-C-000832`, `AU-P-000694`, `1132`

One material list per license line. Package rows lead with `package_code`; the dim-grey subline is Weight (g), Lot (YY###), Market Strain (`COALESCE(market_strain, strain name)`). Wet lots ride the same list, labeled Farm / Strain / Date, Truck prefix only when a number exists. Location tags ride the row when the spot is not a site barn. Empty license lines and empty sites read `- EMPTY -` (one i18n key).

THE MANIFEST LAW: one origin license/location pair. First add creates a building movement and locks the pair; a later mismatch refuses 400 in words (`One origin license and location per manifest.`). THE INBOX LAW: destination location is the destination site's barn, except origin 832 + CSA + dest 694 derives CSB. THE FOCUS LAW: the newest non-deleted building movement keeps only its origin license open; every other license line is collapsed and `.lic-dim`. Finish rides the existing lifecycle; the internal CSA to CSB case emits the virtual paper-door manifest. Externals still originate processor-side only; T3 header fields ride the pane when the dest is external. Finish lands the CSV at `/admin/uploads` only.

## Addendum 0.28.1 (0030 widened, no 0031)

From-zero pin stays **30**. Migration `0030_manifest_locations.sql` also adds `harvest_batches.license_value`, farms on the known AU licenses and the Med placeholder seeds, and backfills a NULL batch license to the farm's AU grow license (ARL to `AU-G-C-001509`, PNS to `AU-G-C-001397`, everything else to `AU-G-C-000832`). Placeholders are one-edit swaps: `MED-ARL-TBD`, `MED-PNS-TBD`, `1132`.

Admin Licenses gains the Farm column and the add-form farm select (same pattern as 0029 locations). Acquire HBN gains a required license select after Farm, options tagged `data-farm`, defaulted to the farm's AU grow license. `createHarvestBatch` validates the value against the license lookups (farm mismatch 400) and defaults the farm AU grow when the POST omits the field, so existing smoke POSTs still mint.

THE INHERITANCE LAW: a batch's lots sit under the batch's license everywhere a surface needs a license for pre-ledger material. Finish mint writes the batch license onto the item (fallback: farm AU grow). Arrival conversion is unchanged: everything landing a site becomes the arrival license on receipt.

THE CSV LAW held: no license column on any METRC CSV.

## Visual pass (smoke persist after SMOKE PASS)

Four windows in order. AU lines yellow text, Med lines blue text, both themes' grounds readable. Dim-grey Weight / Lot / Market Strain sublines. Focus law visible on the leftover spear building movement (origin 832, Truck 77): only that license line stays open; the others collapse and dim. Empty Med lines read `- EMPTY -`. The 1132 lot (`1,132.00 g`) sits under Penn North's blue line (collapsed while 832 is focused, still in the DOM under that summary). Arrivals PNN still lists inbound trucks, inbound movements, and receipts with reasoned VOID. Acquire shows the required License select after Farm. Licenses admin shows the Farm select on the add form.

## Proposed canon amendments (do not fold without the owner)

1. **Stored package license vs a location park.** Trees group packages by stored `license_value` when it is a known site license. Editing only the location (the old smoke shortcut of parking an ARL-minted item at PNS BARN) does not rewrite the license, so that row stays under Arlington AU with a location tag. Historical items minted to 832 will keep sitting under Penn North 832 until reminted or received.
2. **Leftover building movements.** A header-only save (`/interco/ship-external/save` with no items) stays `status=building`. After a later pane finish, that empty row can become the newest building movement again and steal focus until Admin logistics voids it. Add-to-new still creates a fresh movement.
3. **Spear unload staging still omits `origin_location`.** The pane origin line can read `AU-G-C-000832 / / Truck N`. One later bind on that INSERT would close it.
4. **0020 Med seeds still live next to the 0030 placeholders.** Acquire and the dest select still list `GR-C-001132` (PNN Med), `GR-C-001405` (PNS Med), and `GR-C-002600` (ARL Med) beside `1132`, `MED-PNS-TBD`, and `MED-ARL-TBD`. The trees use only the 0.28.0 values. Retire the 0020 Med numbers when the owner supplies the real ones.
5. **Theme sheets.** There are three view sheets, not four. `.lic-au` / `.lic-med` ride `walkSliceChrome` (dark yellow `#e6c35c` / blue `#7eb6ff`; lite yellow `#a16207` / blue `#1d4ed8`).

## Sealed final check

```
cd app
npx tsc --noEmit                      -> exit 0
npx vitest run                        -> Test Files 16 passed (16), Tests 425 passed (425)
node --check scripts/smoke.mjs        -> ok
Dash audit (17 touched files)         -> 0
  node count of UTF-8 em/en dash bytes in each file = 0
Remove-Item -Recurse -Force .smoke-persist
$env:SMOKE_PORT='9096'
$env:WRANGLER_SEND_METRICS='false'
npm run smoke
                                      -> SMOKE PASS, "? About to apply 30 migration(s)" from zero
                                      (this box has no timeout(1); smoke stops wrangler and exits 0)

Smoke walks added: four windows in order with AU/Med class colors; a package
  row carries the dim-grey subline; add-to-new locks the origin pair taken
  from the row and dims the other license lines; a mismatched-origin add
  refuses 400 in words; dest 694 from a CSA origin derives CSB; a barn
  destination derives the dest barn; finish lands the manifest CSV at
  /admin/uploads only; retired send/door/ship-external/outbound 302;
  - EMPTY - on an empty license line; Arrivals and the road strip still
  render; Acquire required license select; Licenses Farm column; a 1132
  batch lot renders under Penn North's blue line.

From-zero pin: 30 (0030 widened for the HBN license; no 0031).
```

Touched files (bytes, sha256 first-16):

```
  2908  f9a2bf169493f588  migrations/0030_manifest_locations.sql
 23942  bb342ffa4391a731  src/config.ts
107777  77233a3d85976e7c  src/theme.ts
 74507  7751996cb5ab2340  src/i18n.ts
 89303  e5ea74d806faa8cc  src/db.ts
  6480  80d81f7eb86cc93b  src/ledger.ts
 37967  76bc869e46cbf994  src/pipeline.ts
 17570  e9f5fd5c75ea36a1  src/pages.ts
 15194  ccea3346d3a46110  src/inventory.ts
 16124  5f1a044c31ef7f6e  src/interco.ts
138910  04f983f4a22cc8e8  src/html.ts
141266  45f5cb606bcbab56  src/actions.ts
 81105  b5d79389017c3298  src/index.ts
 18609  022691b8a62b2122  test/floor.test.ts
 17632  82e52632bf027ffc  test/i18n.test.ts
 41474  bb8493717ea35455  test/walk.test.ts
170858  eeb078320fafd5c9  scripts/smoke.mjs
```

This slice ships the worker plus migration 0030. Say **deploy** when you want it on the worker. Never c10. TBD ids stay TBD.
