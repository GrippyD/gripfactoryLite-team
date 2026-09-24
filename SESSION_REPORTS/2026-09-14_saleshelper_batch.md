# 2026-09-14 THE SALESHELPER BATCH (canon 0.30.65; SalesHelper canon 0.8.0)

Scribe-direct under G-2. Four owner rulings of 2026-09-14, logged verbatim in both canons, built in the SalesHelper repo under its own canon and re-vendored into Gripfactory by the vendored-pair law, with the Worker's side of the bargain built here.

## The rulings (owner, verbatim)

1. "we need a toggle on the netting logic in saleshelper: Even buckets/hand entered netting/whole packages

   Allow search for aproximate package sizes to what the user enters hand entered or display all if nothing is entered, whole packages means the number of strains/lbs but the lowest possible whole packages, not netting at all."
   His fork answers: whole packages reach at least the total ("At least the total"); the approximate search is "Within 10 percent".
2. "enter price on full menu

   The date and time for when inventory was updated should be on the last user deployment of a Zoho csv/xlsx, not when it last autoran"
   Asked typed vs Zoho: "to answer your question, it needs both.  It should load what's loaded in Zoho and allow someone making a SO or invoice to change it". Asked about the update time: "3 - it looks like it pulled the latest inventory in my downloads or something, it needs to fire on orders, not on schedule".
3. "The email that sends the csv doesn't automatically mount the csv file to the email.  You have to download it and add it manually."
   His fork answer on the mail service: "Resend, your account".

## What was built in the SalesHelper repo (Projects\SalesHelper, canon 0.7.3 to 0.8.0)

**The netting toggle (SalesHelper canon 4c).** A segmented control **3b · Netting** under the total quantity: Even buckets (the default; the existing engine, unchanged), Hand entered netting, Whole packages. Hand entered opens a package picker: the type's in-stock packages, narrowed by the preferred strains and potency when given and by a **package size** box (within 10 percent of the typed size in the chosen UOM; blank shows every package, capped at 250 rows with a narrowing hint); checked packages add as whole packages, one line per strain, the quantity their stock, a typed total only compared (over or short, flagged). Whole packages selects strains as even buckets does (pinned, ranked, capacity pass), then takes the fewest whole packages whose total reaches at least the quantity with every picked strain in, spilling to the next-ranked strains only when the picked ones cannot reach it; a bounded depth-first search (`bestWholeSet`, 250,000 nodes, the 12 largest packages per strain) seeded with the greedy largest-first set finds fewer packages or less overage at the same count. The proposal table gained a Price column and the package sizes under the package count; the overage or shortfall is a flag before Accept. Named packages ride the order line (`Entry.pkgs`, "N pkgs named" in the panel) and `allocate` drains them first in FIFO order, then the line's other packages, so a trimmed quantity comes off the last named package.

**The Zoho price (SalesHelper canon 6).** `readItemsCsv` reads the export's Selling Price ("USD 175.00") into `RawItem.rate`; packages carry `rate`; every line carries `price` (the FIFO-first package's rate, else the first package with one). The full menu prefills each line's price box with it, editable, with a title naming it as the Zoho price; the deal builder's typed price still rules the whole add and a blank price now means each line's own Zoho price (shown per line; a line without one cannot be accepted unpriced); the price hint names the type's Zoho range.

**The inventory time (SalesHelper canon 9).** The header reads `Inventory updated <ET>` off `dataAsOf` inside `<span data-inventory-time>`, the build time demoted to the span's title. `dataAsOf` is the export's drop time (its mtime in data/incoming), keeping the v0.7.2 conservative read (the named date at 00:00Z) when the filename carries an older date. The form rolls the words when it adopts a live menu (`renderInventoryTime`). The re-fetch already fires when an order starts and when a tab returns (v0.6.2); the schedulers are retired as refresh sources in the canon.

**The items reader.** `readItemsCsv` accepts the lean pull CSV and the full Zoho UI export (Item ID, Item Name, Status, Selling Price, 8,349 rows, inactive items included), Status Active only, the same rule as the Gripfactory mount. Built from `Items_manual_2026-09-14.csv` (his Item 3.csv, sha d25dc500b3f252db): 184 lines from 356 packages, 26 exceptions, the counts Gripfactory's live mount of the same file reads (0.30.57's beta drops).

**Verified headless** (scratch/sh_e2e.mjs, Playwright on the built file): the header; whole packages on BUD, 60 lbs over 2 strains at $180: 2 packages, Cherry Pop 40.3656 + Gelato 41 19.853 = 60.2186 lbs, 0.2186 over (the first swap heuristic had stalled at 70.7337; the search found it); the order panel's "1 pkg named"; hand entered on MIX: 112 packages, 45 within 10 percent of 50 lbs, blank restores 112, two checked add at the Zoho price $175/lb; even buckets on MOB: 40 units (= 1 cs + 8) across 2 strains at $9.00/unit; browse prices prefilled 184 of 184, an edited $99.50 lands on the order line; the CSV's rows name the chosen tags (1A40503000311FB000036419 for 40.3656, 1A40503000311FB000036252 for 19.853). Screenshots sh_whole_proposal.png, sh_hand_proposal.png, sh_review.png reviewed.

**SalesHelper canon 0.8.0**: version line; §4b send amendment; new §4c; §5 and §6 amendments; §9 hosting and inventory time amendment; §11 (Resend setup owed; the host question closed); the 0.8.0 change log entry with the rulings verbatim; _NOW, MEMORY, README (the litmus line reads canon v0.8.0).

## What was built here (the Worker)

- **`src/saleshelper.ts`:** `ShRawItem.rate`, `ShPkg.rate`, `ShMenuLine.price` (FIFO-first rate, else the first), `zohoPriceNumber` ("USD 1,250.00" to 1250); `buildLiveSalesHelperMenu` sets `builtAt` to the later of the static's build and the mount (the form adopts a live menu only when `builtAt` is not older than its snapshot, so a re-vendor after a drop must not hide the drop) and `dataAsOf` to the mount, the drop; `decorateSalesHelperPage` accepts both header shapes (0.7.3 "Menu built <ET> ·" and 0.8.0 "Inventory updated <span data-inventory-time>...</span> ·") and lands the Update link after the whole meta span.
- **`src/zohoinv.ts`:** `listZohoMenuItems` selects `price` and carries it as `rate`.
- **`src/sendmail.ts` (new) and `POST /api/send`:** the SalesHelper contract answered: `X-Grip-Key` (`grip-c4aba3e1d0320e1acb5d5716`, the form's constant, visible by design) else 403; the body validated in words (400); Resend (`https://api.resend.com/emails`, Bearer `RESEND_API_KEY`) with both attachments base64 (`ZohoSO_<orderNo>.csv`, `order_<orderNo>.json`, each under the 2MB size law, 413 over), subject `GRIP Sales Order <orderNo> - <customer>`, a plain-text body; recipient `saleshelper_mail_to` (default logistics@gripcannabis.com, commas separate several) and sender `saleshelper_mail_from` from app_config; 503 naming what is missing while unconfigured (the form then falls back to its email client as before), 502 with the provider's words when it refuses; 200 `{ok, id, to, orderNo}` when it accepts. `/api/*` sits behind the PIN gate (the framed form's fetch carries the cookie; a bare call gets the PIN page, 401).
- **`src/config.ts`:** `CONFIG_KEYS.saleshelper_mail_to`, `saleshelper_mail_from`. **Migration 0046** seeds them (`logistics@gripcannabis.com`, blank sender on purpose). Editable in Admin, Lookups, app_config.
- **Re-vendored pair:** `public/saleshelper/index.html` (276,535 bytes, sha 919132a508b9bb4f) and `menu.json` (221,509 bytes, sha afa6a4d303113db8), byte-identical copies of the SalesHelper build (`app/GripOrderForm.html`, `app/menu.json`). The prior pair (651,831 / 607,296 bytes, f666e4eebde5efd1 / 7f43fd9a7732ebb7, the 2026-08-11 build) retires.
- **Tests:** test/saleshelper.test.ts (price on lines and packages; a newer static keeps its builtAt while dataAsOf is the mount; the 0.8.0 header rolled and the link placed; zohoPriceNumber), test/sendmail.test.ts (5 cases: the pins, the body parser's refusals, the subject and text, the payload with both attachments and the size law, 503 / 502 / accepted through an injected fetch). Suite: 25 files, 584 tests.
- **Smoke (pin 46):** reads the vendored pair's own facts from disk (builtAt, sourceFile, canonVersion 0.8.0, dataAsOf before builtAt, a price on all 184 lines, the baked header time); the served form carries the netting control; `/api/send` 403 / 400 / 503 (naming RESEND_API_KEY) / 401 without the cookie; after the smoke's Zoho mount the live lines carry `price` 175 and 12.5, `dataAsOf` equals the mount and is newer than the static, `baseBuiltAt` is the static's, the header's rolled time is the mount's (one of the last eight minutes, Eastern).

## Gates

- `npx tsc --noEmit`: 0 errors (both repos; SalesHelper `npm run typecheck` 0).
- `npx vitest run`: 25 files, 584 tests passed.
- Dash audit (`LC_ALL=C grep -c $'\xe2\x80\x94\|\xe2\x80\x93'`): 0 on every changed file in both repos, the vendored pair and the built outputs included.
- From-zero smoke: "About to apply 46 migration(s)", SMOKE PASS (exit 124 is the timeout wrapper, normal).
- Visual pass: the SalesHelper form's three proposals and the review screen (Playwright screenshots), the Worker's decoration pinned by tests and smoke.

## Deploy (his hands, with a migration)

From `app/`: probe (`npx wrangler d1 execute gripfactory-lite-grip-20260914 --env grip --remote --command "SELECT 1"`), `npx wrangler d1 migrations apply gripfactory-lite-grip-20260914 --env grip --remote` (answer y; applies 0046), `npm run deploy:grip`. Then, for the email: `npx wrangler secret put RESEND_API_KEY --env grip` (his Resend account, a gripcannabis.com sender verified there) and `saleshelper_mail_from` in Admin, Lookups, app_config. Until both are set the form keeps its email-client fallback.

## Owed

His Version ID; the Resend account, the sender and the secret; his word on Radded; numbering the dry weights; the first live lot (26010); the historical 26001 to 26009 via Manual HBN; the parseMetrcFilename word; the deletions (three idle databases, DROPS); the standing list in _NOW. In the SalesHelper folder: orders/incoming still holds SH-20260831-PQAS and its R1, un-ingested until he says which stands.

## Sealed final check

```
== gripfactory app ==
src/saleshelper.ts                           16146  1312af777c9fedd0
src/sendmail.ts                               9085  e960cad5523a5020
src/zohoinv.ts                               19716  fa452bc7ff04dac8
src/config.ts                                33917  123e43c09e5a2232
src/index.ts                                107387  5094e9cd8cab1c67
migrations/0046_saleshelper_mail.sql          1163  7cfbadf1fc7f56c3
scripts/smoke.mjs                           325848  1785a9bfa45dbf3a
test/saleshelper.test.ts                     13444  d36cf22faa618d03
test/sendmail.test.ts                         7606  6a6d824abfe78b24
public/saleshelper/index.html               276535  919132a508b9bb4f
public/saleshelper/menu.json                221509  afa6a4d303113db8
== saleshelper ==
CANON.md                                         41069  61ea93be728475c3
_NOW.md                                           5868  cf8a4baee4e7f2dc
MEMORY.md                                        19716  69e51c12b0404df0
README.md                                         2679  dfac80b5fc48a007
src/lib/model.ts                                  3671  e77f086c3f6e7c5c
src/lib/parse.ts                                  3312  126a9a202a0443c7
src/lib/collapse.ts                               2355  afc71cff198688c9
src/lib/menu.ts                                   5934  91ae8c2582a4d494
src/build.ts                                      3984  2e2e82b7d257e176
src/app/main.ts                                  63352  fb0e33fedb6ceb7f
src/app/template.html                            20748  c908b71d2429b0bb
app/GripOrderForm.html                          276535  919132a508b9bb4f
app/menu.json                                   221509  afa6a4d303113db8
data/incoming/Items_manual_2026-09-14.csv      3580124  d25dc500b3f252db
data/exceptions_report.csv                        4237  d49baf1eb83aa572
db/saleshelper.pgdata.tgz                      9997509  88a2eebdaa3c0464
db/schema.sql                                     1564  a39fbd19825d953f
tsc: 0 errors (app); SalesHelper typecheck: 0 errors
vitest: 25 files, 584 tests passed
smoke: About to apply 46 migration(s); SMOKE PASS
SalesHelper e2e: E2E PASS (21 checks)
dash audit: 0 on every file above
```
