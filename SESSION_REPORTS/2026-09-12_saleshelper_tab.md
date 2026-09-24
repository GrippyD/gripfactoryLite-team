# Session report: THE SALESHELPER TAB (canon 0.30.45), Scribe-direct, 2026-09-12

**Scribe:** Gripfactory Lite Scribe (Cowork), Scribe-direct under G-2. One owner ruling, one small slice, worker only (no migration; the fast lane).

## The owner, verbatim

"New tab in marketplace: [Saleshelper]

Return sales helper to the resulting pane, and you and I will start to fix the issues"

## What shipped

**The tab.** The Marketplace's tab bar reads Listings, Zoho, Orders, **SalesHelper** (the fourth tab; `/marketplace?pane=saleshelper`). Its pane frames the vendored SalesHelper form exactly as the Fulfillment wrapper does: the same flush iframe on `/fulfillment/saleshelper/app`, the same PIN cookie (both `/marketplace*` and `/fulfillment*` sit behind the node PIN), the form's own `menu.json` still resolving beside it. The tab bar stays above the frame, so the pane's embed keeps a top margin where the Fulfillment wrapper runs flush under the chrome (`.saleshelper-embed-pane`, three themes). The Fulfillment menu's [SalesHelper] tile stands; the form has two doors now.

**The pane parser.** `parseMarketplacePane(raw)` names the four panes and falls back to Listings for anything else; `/marketplace` reads it.

**Not touched:** the vendored SalesHelper bytes (public/saleshelper/, the vendored-pair law), the Cerberus serve-time skin, menu.json, the Fulfillment wrapper and its routes. The issues the owner named are the next conversation, not this slice.

## Sealed final check

```
cd /home/claude/deploy/app
npx tsc --noEmit                      -> exit 0
npx vitest run                        -> Test Files 22 passed (22), Tests 545 passed (545)
Dash audit (5 authored files + this report) -> 0 each
SMOKE_PORT=9818 WRANGLER_SEND_METRICS=false timeout 285 npm run smoke
                                      -> SMOKE PASS, "About to apply 43 migration(s)" from zero
Smoke pins: the marketplace carries data-tab="saleshelper"; the pane answers
  200 with data-marketplace-saleshelper and the iframe on
  /fulfillment/saleshelper/app; the tab reads aria-current; the framed form
  answers 200 under the PIN.
Unit pins (test/business_ops.test.ts, marketplace and reports): the fourth
  tab after Orders with its href; the Listings pane carries no frame; the
  saleshelper pane carries the tab on, the embed with its pane class, the
  iframe with the title, and neither the listings table nor the New order
  form; the pane parser for all four names and the fallback.
Visual pass (chromium against wrangler dev on the smoke DB, Grip view):
  /marketplace?pane=saleshelper shows the four tabs with SalesHelper lit and
  the form beneath (GRIP CANNABIS Sales Order, "Menu built Aug 11, 2026,
  1:58 PM ET, SalesHelper canon v0.7.3", the badge "inventory as of 38 days
  ago", the Add products and Current order cards); no request failed.

src/marketplace.ts d2dabab08bc51e8a (27,891 bytes)   src/index.ts 910f9b8e18c5219d (102,782 bytes)
src/theme.ts dbea050a8615d59f (114,543 bytes)
test/business_ops.test.ts eb9cbb88fd67b63e (36,891 bytes)
scripts/smoke.mjs d567562197709f96 (309,617 bytes)
```

## What the frame shows today, for the fix session ahead

The form's menu is the 2026-08-11 static (menu.json under public/saleshelper/, "inventory as of 38 days ago" on its own badge); the form posts finished orders to `/api/send`, which this Worker does not route, so it falls back to the download plus mailto by design (canon 0.14.0); the alpha feedback of 0.13.1 named the netting relay; fork F8 (prepack splitting) stands. The owner names the first issue; the Scribe fixes in this order of homes: the Worker's routes and the mirror's data first, the vendored bytes only by the vendored-pair law (a new file from the SalesHelper repo, replaced by copy).

Worker only, no migration: the fast lane. Live underneath: worker d87f08a8, migrations 0001-0043 on the rolled database.
