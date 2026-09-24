# Session report: Mount SOs and Pick Orders built (canon 0.30.18), Scribe-direct, 2026-09-08

**Scribe:** Gripfactory Lite Scribe (Cowork), Scribe-direct under G-2. The owner's order, verbatim: "Look in the original gripfactory repo for how pic prders and Mount SOs should behave" ... "check gripfactory lite as well--technically we're working in gripfactory "practical" which is just lite wearing a slightly more marketable appearance" ... "here is the iteration that should contain it" (Code\gripfactorish connected) ... then, on seeing research instead of a build: "did you build this?  I don't see a cursor slice or a npm run block". The 0.30.17 report (2026-09-08_fulfillment_research.md) was the reading; this slice is the build. Worker plus one append-only migration (0038).

## What shipped

1. **The two orange barrels come off.** `/fulfillment/mount-sos` and `/fulfillment/pick-orders` were reserved stubs since 2026-09-01; both are real pages now, under the same /fulfillment/* PIN gate. The fulfillment menu's tiles lose `tile-stub`; `fulfillmentReservedPage` and its kind retire (the inventory and purchasing reserved stubs are untouched).
2. **[Mount SOs]** (`src/fulfillment.ts`, `mountSalesOrders` in actions.ts, tables in 0038). The Zoho Inventory Sales Order export (csv) drops in through a multipart form. The file is known the way gripfactorish knew it: a Product Sub or Status (Internal) column, or a filename saying sales order; anything else refuses in words (400). Every row buckets by Item.CF.Product Sub through gripfactorish's ZOHO_SUB_MAP in its verbatim order (thca first, then bulk flower, prepack ounces / max out bags, vape / cart, infused pre-rolls, infused flower, concentrate, shake, trim); CRIF and processing lines are ignored and counted as such; a sub that buckets nowhere still mounts as a line to pick (readout category null). One order per SalesOrder Number (Zoho's own number is the key; the SH- number dies at Zoho import), lines in file order with a seq. The mount is durable and idempotent: an order upserts by so_number (Zoho's fields refresh, our pick fields stay); lines match by seq inside their order (picked_qty, short_flag and pick_note survive; a line the newer export dropped soft-deletes with "dropped by re-mount"; a revived line comes back); a voided order the export still carries revives with a log line; an order absent from a later export keeps its last state and the open list marks it "not in last mount". Every mount lands a `so_mounts` row (filename, line, order and ignored counts) and the page's summary line reads it. Statements batch in chunks of 50. Nothing writes back to Zoho.
3. **The readouts ride into Mount SOs.** The Sales Pipeline table (rows Shipping Today, Accepted, Submitted, Picking, Fulfilled, Shipped; the ten readout categories with their units, BUD TRIM BIO PREPACK PREROLLS SHAKE DISTILLATE INFUSED BUD VAPES THCA; distinct orders per category, TOTAL distinct across categories so a multi-category SO counts once; quantity per category unit, Shipped reading QuantityInvoiced, the TOTAL quantity lb-only), the SO Status Detail (category by status), and the open orders list with Pick links. An order's effective status is our pick_status (picking, fulfilled) over Zoho's CF.Status (Internal) lowercased (submitted, approved, shipped): gripfactorish's two grayed rows now fill. Shipping Today is Expected Shipment Date equals today, where today is the browser's calendar day: the page carries `data-today`, and when the device's date differs and the URL has not said otherwise it reloads once with `?today=YYYY-MM-DD` (`isIsoDate` guards the query; the worker's UTC day is the fallback).
4. **[Pick Orders]** (two panes, the station law). Left: the orders to pick (every live order not shipped) with SO, customer, ship date, line count and status chip. Right: the picked order's header (ships, sales person, origin to destination license, Zoho's two statuses, our pick record with the browser-rendered times), [Print pick sheet], and the lines in walking order: rack addresses first by prefix, row, bay, shelf (P1.2.A before P1.10.B before P2.3.A), then named spots alphabetically (North Wall, Oxford N), blanks last, grouped under a location row. Unstarted: read-only lines plus [Start pick] with a Picked by select over the sign-off names (canon 0.30.12; a name off the list refuses; a second start refuses). Picking: a picked quantity, a short checkbox and a note per line, [Save progress] (the absent-field law of 0.30.10: a line whose picked_ field is not in the post is unchanged; the checkbox's witness is the picked_ field), and [Complete pick] with a Fulfilled by select. Completing marks the order fulfilled HERE with the fulfiller and the time; a line picked under its ordered quantity is flagged short, never blocked; a line never marked stays as the paper shows it. Fulfilled: read-only with the marks. Every start, save and complete logs to record_change_log (reasons so_mount, pick_start, pick_save, pick_complete).
5. **The pick sheet** (`/fulfillment/pick-orders/:id/print`): a standalone letter print document, one order: customer, ship date, sales person, licenses, delivery; lines grouped by location with a checkbox, tag, ordered, unit, picked (short in bold); Picked by and Fulfilled by sign lines; a Print button that hides in print. The paper that replaces the picklist hand written on the invoice.

## The eight forks of the 0.30.17 reading, resolved by Scribe default (the owner overrules by a word)

1. Zoho status round trip: stays internal. pick_status never overwrites Zoho's column; nothing writes back to Zoho.
2. Pick location: Zoho's Item.CF.Location Code, as exported.
3. Completing a pick: status and paper only; no manifest is cut (finished goods are not in this ledger yet).
4. Shortages: flag, never block (short_flag), the overissue law's mirror.
5. Who signs: the sign-off names (Kieth, Les, Austin), picker at start, fulfiller at complete.
6. Paper: the letter pick sheet above; no label print.
7. Marketplace node sales orders (sales_orders, sales_order_lines): untouched; the mount lives in its own tables.
8. The readouts (Sales Pipeline, SO Status Detail): on the Mount SOs page.

Two more, decided here and named for the owner: a re-mount matches lines by seq (the export carries no line id; Zoho keeps line order stable); and the three new tables are not on the record routes (no reasoned pencil or x on a mounted order yet), so voiding a stale order is a fork left open.

## Sealed final check

```
cd /home/claude/deploy/app
npx tsc --noEmit                      -> exit 0
npx vitest run                        -> Test Files 19 passed (19), Tests 481 passed (481)
Dash audit (12 touched text files)    -> 0
SMOKE_PORT=9583 WRANGLER_SEND_METRICS=false timeout 285 npm run smoke
                                      -> SMOKE PASS, "About to apply 38 migration(s)" from zero
Smoke walk added (replacing the reserved-page pins): both pages 200 before any
  mount and say so; a non-Zoho csv 400s in words; a Zoho export with the real
  column names mounts (4 lines, 3 orders, 1 ignored CRIF); the pipeline rows
  count Accepted 1 (BUD and TRIM, TOTAL 1), Shipping Today 1, Submitted 1
  (PREROLLS), Shipped 1 (THCA, invoiced), Picking empty; the shipped order
  leaves the open list; a re-mount duplicates nothing; a signer off the list
  400s; start, a second start 400s, save (9 short with a note; the untouched
  line stays blank), the pipeline moves the order to Picking, the print sheet
  200 with the short mark, complete (6 of 10 flags short by law), Fulfilled by
  Austin, the pipeline counts Fulfilled 1; a later mount keeps every mark;
  an unknown sheet 404s; the es page.
Unit pins: test/fulfillment.test.ts (22: the sub map in order, CRIF ignore,
  detection and dates, the parser incl. header drift and the unbucketed line,
  rack order, effective status, pipeline counts and Shipping Today, the mount
  page incl. the stale chip and the empty state, the pick page in each state,
  the print sheet); surface.test.ts (the menu's plain tiles; the reserved-page
  test retired with the stub).
Visual pass (wrangler dev on the smoke database, 1280x900 @1.5): the Mount SOs
  page with the summary line, the pipeline table, the SO status detail and the
  open orders; the Pick Orders page on a fulfilled order (marks read-only, the
  chips) and on an unstarted order (location row, Start pick with the signer
  select); the pick sheet; the fulfillment menu without barrels.

src/fulfillment.ts 647dc217ce680898 (new)   src/actions.ts a0f7e3cdd32f19ef
src/db.ts bf9622c65093f226                  src/config.ts 5a9316bca72907fe
src/index.ts 5c99a066f1ce90dd               src/html.ts 65bee72b7da9fb45
src/i18n.ts d263ee9a16b57370                src/theme.ts 2b2c3205ea8b1c35
migrations/0038_mounted_sales_orders.sql d7eb8fd50b4b3191 (new)
test/fulfillment.test.ts a4d80420a18c59a4 (new)   test/surface.test.ts 45dd9e5980c82038
scripts/smoke.mjs 9943a32e57e2e00e
```

Worker plus migration 0038 (one to apply). Never c10 deploy. Owed from the owner: a real Zoho export to mount against live (the parser is tolerant of header drift, but the first real file is the proof); the word on the two open forks above; the Athena and T1 Logistics logo files; the harvest purge after-counts paste (or the word to narrow it); the METRC location-change and T3 templates.
