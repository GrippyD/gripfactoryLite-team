# Session report: Mount Zoho Inventory onto the Marketplace (canon 0.30.36), Scribe-direct, 2026-09-09

**Scribe:** Gripfactory Lite Scribe (Cowork), Scribe-direct under G-2. One owner question, the Scribe's four forks, his four answers with the real export attached; one slice, worker plus migration 0039.

## The exchange, verbatim

Owner: "Is there a place in the app that I can drop current Zoho inventory and it will update the offerings on the marketplace?"

Scribe: no (listings were hand-entered and reconciled against our ledger; Zoho touched the app only through Mount SOs and the static FG picture on the Inventory node); offered the build with four forks.

Owner, with `Item 2.csv` (the Zoho Inventory Items export, 68 columns, 8,349 rows):

1. "attached"
2. "If zoho is using  each, it's weight, if it's oz or g, show that as "market-facing UOM" and actual weight in grams - Lbs = 448 grams"
3. "Zoho should show a SKU, that's usually the METRC package ID"
4. "Not sure what you mean, picking and shipping will remove it.  Dropping a new inventory should correct it"

## What shipped

- **The Zoho pane on the Marketplace** (a third tab beside Listings and Orders, behind the same PIN): the drop form (`Zoho Inventory Items export (csv)`, `Mount inventory`), the last mount's summary (file, rows, offered, inactive, without stock, placeholders skipped, added, updated, unlisted, and a category table with the market-facing totals), and the offerings grouped by Zoho's Product Sub, each row with Item, SKU, the market-facing quantity with the actual weight beside it, price as Zoho states it, Zoho location, THC, and how the row reads against our ledger. A `Gone from Zoho` fold lists rows the newer export dropped.
- **THE OFFERING LAW:** the export is the truth of what is offered. Every Active inventory item with stock on hand becomes a Zoho-sourced listing keyed by SKU (Item ID, then name, when a SKU is missing); two rows of one SKU (a package at two bins) fold into one offering. A newer export updates quantities in place, lists what has stock, and unlists what is gone or at zero; hand-entered listings are never touched. Nothing writes back to Zoho. His fourth answer read as: picking and shipping happen in Zoho, the next drop corrects the marketplace.
- **THE UOM LAW (his second answer):** the market-facing UOM is what Zoho sells the item in: lb, oz, g, each or L. Zoho's Unit column comes in every spelling (lb, LB, Lb, Pound, pound, Gram, g, grams, each, Each, Unit, Liters) and is blank on 7,497 of 8,349 rows, so a blank unit reads from the category: Prepack Ounces, Max Out Bags, Vape/Cart, Infused Pre-Rolls and Infused Flower are eaches; everything else blank is bulk in pounds (the export's Unit Name says Pounds wherever it says anything). Actual weight in grams: lb x 448 (his number), oz x 28, g as is, each x the size of one each (the item's name first: "1.2g", "15g", "2g", "1oz"; else the category's known size: a Prepack Ounce is 28 g, a Max Out Bag is 2.5 oz = 70 g, its price in the export being exactly 2.5 times the ounce prepack's); liters and eaches of unknown size read "weight unknown".
- **THE SKU LAW (his third answer):** a METRC-shaped SKU (1A plus 22 hex) becomes the listing's package tag, so our ledger's own matching applies: `Matching` when the ledger holds that package with enough grams, `Not matching` when it holds it short, and `Zoho only` when the ledger has never seen the tag (or the SKU is a branded text SKU, 100 of the 1,107). A row of unknown weight carries 0 g and can never match for free.
- **Scribe default, flagged:** a stock on hand of a billion or more is a placeholder, not inventory. His export carries eight such catch-all items at 1,000,000,000,000 units under one location; offering them would print a trillion pounds on the marketplace. They are counted in the summary as `placeholders skipped` and never offered. One word changes the line (`PLACEHOLDER_STOCK` in `zohoinv.ts`).
- **The order pick** offers the Zoho rows too, grouped by category under `Zoho: <category>`. The Listings pane shows a one-line count of Zoho offerings with a link to the pane and keeps its table to the hand-entered rows.
- **Migration 0039:** `listings` gains source (manual default, zoho), sku, zoho_item_id, market_uom, market_qty, each_grams, price, zoho_location, thc_pct, zoho_status, zoho_mount_id, zoho_mounted_at and an index on (source, sku); `zoho_inventory_mounts` records each drop. Every insert, quantity change and unlist lands in record_change_log with the reason `zoho inventory mounted`; statements batch in chunks of 400.

## Dry run against his export (outside the repo; the file itself is not vendored)

8,349 rows: 5,095 inactive, 2,138 without stock, 1 service, 8 placeholders, 1,107 offered with 1,107 distinct SKUs (no duplicates in this export). UOMs: 892 lb, 197 each, 6 g, 12 L. 12 rows of unknown weight, all distillate in liters. 100 branded text SKUs (vapes, pre-rolls, infused flower). Parse cost in Node: 238 ms to read the CSV, 74 ms to shape it.

WATCH: the live drop parses 3.5 MB in the Worker before the D1 writes (about 2,200 statements in six batches). If the live mount answers a 500 or times out, the account's Workers CPU limit is the first suspect; the fix is a paid-plan check or a client-side pre-filter, not a code fault.

## Forks left for the owner

- The FG picture on the Inventory node still reads the static 2026-08-11 SalesHelper `menu.json`; the same drop could refresh it. Not built; one word.
- Placeholder threshold (a billion) and the Max Out Bag size (70 g) are Scribe readings of his data.
- Fencing offerings by Zoho location (Head Office, PNN, Oxford N and the rest all offer today).

## Sealed final check

```
cd /home/claude/deploy/app
npx tsc --noEmit                      -> exit 0
npx vitest run                        -> Test Files 20 passed (20), Tests 504 passed (504)
Dash audit (9 authored files + this report) -> 0 each
SMOKE_PORT=9771 WRANGLER_SEND_METRICS=false timeout 285 npm run smoke
                                      -> SMOKE PASS, "About to apply 39 migration(s)" from zero
Smoke pins: the Zoho tab, form and empty state; a non-Items file 400; a
  synthetic export on the real 68-column header (bulk at a blank unit, a
  prepack ounce, a max out bag, a 1.2 g pre-roll with a text SKU, a 2 g vape,
  liters, an inactive row, a zero-stock row, a placeholder, the same SKU at a
  second bin) mounts 6 added / 0 updated / 0 unlisted; the summary counts (10
  rows, 6 offered, 1 inactive, 1 without stock, 1 placeholders skipped); the
  category table folds the two bins to 0.75 lb and counts eaches; the rows read
  0.75 lb = 336.00 g, 80 each = 2,240.00 g, 32 each = 2,240.00 g, 712 each =
  854.40 g, 94.601 L = weight unknown and data-match zoho; price, THC and
  location on the row; placeholder and inactive rows absent; the Listings pane
  counts 6 and keeps Gelato with no Zoho SKU in its table; the order pick
  groups Zoho rows by category with the SKU; a newer export mounts 0 / 4 / 2,
  moves the bulk row to 1 lb = 448.00 g, drops the zero-stock row, lists the
  two gone rows, and the Listings count reads 4 with Gelato intact.
Unit pins: zohoinv.test.ts (the file-kind test; 448 and 28; every unit
  spelling and the blank-unit category law; each size from name, category,
  else unknown; market labels; the offered filter with inactive, empty,
  service and placeholder rows; SKU/Item ID/name keys; the tri-state match with
  the zero-gram guard; the market quantity cell).
Visual pass (wrangler dev on the smoke DB, co view): the Zoho pane after the
  remount shows the form, the summary line, the category table, the grouped
  offerings with SKU, quantity and weight, price, location, THC and match state,
  and the Gone from Zoho fold.

src/zohoinv.ts e99887360e2c9de3           src/marketplace.ts da71baaeb01a6747
src/index.ts ddb362168d233c88             src/config.ts 547b129de8471ecd
src/theme.ts d11acadce6d414cd             src/i18n.ts ab675fc40e18bfb7
test/zohoinv.test.ts e6be81e120999621     scripts/smoke.mjs 009d7dc4385a7d54
migrations/0039_zoho_inventory.sql bc6ac6b25b37d3e2
```

Worker plus migration 0039: the apply step is live this time, so the probe must answer green first; the fast lane does not apply. Live underneath: worker 26ae0cb0, migrations 0001-0038. Owed from the owner: the grant fix (which token line printed, or the logout/login), then this deploy's version id; a first live drop of `Item 2.csv` with its counts read back; his word on the three forks above; everything on the standing list.
