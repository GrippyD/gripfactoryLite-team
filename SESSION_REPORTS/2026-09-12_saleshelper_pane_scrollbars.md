# Session report: THE SALESHELPER PANE SCROLLBARS (canon 0.30.49), Scribe-direct, 2026-09-12

**Scribe:** Gripfactory Lite Scribe (Cowork), Scribe-direct under G-2. The fix session's second issue; one small slice, worker only (no migration; the fast lane). The vendored pair untouched.

## The owner, verbatim

"move the right anchor in slightly and increase the size of the working pane's vertical scroll bar, it's getting hidden behind the primary scrollbar"

## What was happening

The SalesHelper pane on the Marketplace framed the form in a full-bleed embed (`width: 100vw`), so the frame's own scrollbar sat on the viewport's right edge, exactly where the page's scrollbar also sat: the page scrolled a little (the chrome and the tabs above the frame, the main's bottom padding that keeps room for the fixed Reports and Admin buttons below it), so its scrollbar covered the frame's. Two scrollbars in one column, the outer one on top.

## What shipped

**The right anchor moved in.** The embed stops 1.25rem (20px) short of the viewport's right edge in all three themes (`.saleshelper-embed { width: calc(100vw - 1.25rem) }`), on the Marketplace pane and on the Fulfillment wrapper alike.

**The framed form's scrollbar drawn wider.** The header style the Worker already splices into the served form (canon 0.30.47) now also draws the framed document's scrollbar at 16px with a plain green-grey thumb on a light track (`::-webkit-scrollbar` and the standard `scrollbar-width` and `scrollbar-color`), so it reads as the working pane's own bar.

**The frame fitted to the viewport, so the page's own scrollbar steps aside.** A small script (`salesHelperFitScript`, shared by the pane and the wrapper) sizes the frame to what the viewport has left under whatever sits above it, less what the page keeps below it (the main's bottom padding), floor 480px, on load and on resize. The page then has nothing to scroll and its scrollbar disappears; only the frame scrolls. A short window (under the floor) scrolls the page as before rather than crushing the form. Without the script the CSS height stands (pane `calc(100vh - 12rem)`, wrapper `calc(100vh - 5.5rem)`, both floored at 480px).

**Measured in the browser** (chromium with scrollbars shown, wrangler dev on the smoke DB, 1280 by 800): the Marketplace pane's page no longer scrolls (scroll height 800 of 800), the frame stands 491px tall under the tabs, the right gutter is 20px, the frame's own document scrolls with a classic scrollbar drawn inside the frame; the Fulfillment wrapper likewise (frame 629px, no page scroll); at 1600 by 950 the pane's frame stands 641px with no page scroll.

**Not touched:** `public/saleshelper/` (the vendored pair), the live menu, the header words, the Update link, the Cerberus skin.

## Sealed final check

```
cd /home/claude/deploy/app
npx tsc --noEmit                      -> exit 0
npx vitest run                        -> Test Files 23 passed (23), Tests 552 passed (552)
Dash audit (9 authored files + this report) -> 0 each
SMOKE_PORT=9825 WRANGLER_SEND_METRICS=false timeout 285 npm run smoke
                                      -> SMOKE PASS, "About to apply 43 migration(s)" from zero
Smoke pins: the SalesHelper pane carries the fit script (the selector and
  the 480px floor).
Unit pins: business_ops (the pane's fit script: selector, the below
  subtraction, the floor, the resize listener); saleshelper (the served
  style draws the framed scrollbar at 16px with scrollbar-width and
  scrollbar-color); surface (the wrapper carries data-saleshelper-wrapper
  and its own fit script, the iframe unchanged); view (every theme's embed
  stops at calc(100vw - 1.25rem); the pane and wrapper frame heights floored
  at 480px).
Visual pass (chromium with scrollbars shown): the pane and the wrapper at
  1280 by 800 and the pane at 1600 by 950, as measured above; the screenshot
  shows the form's own scrollbar inside the frame with the dark gutter to its
  right and no page scrollbar.

src/saleshelper.ts 22d099293c8c8bac (13,198 bytes)   src/marketplace.ts 0fffbccacb048365 (28,015 bytes)
src/html.ts 172ee36ce40af8b7 (157,519 bytes)          src/theme.ts 3b390f6951ca9840 (114,681 bytes)
test/business_ops.test.ts fc3d71dc0c1f7cc2 (37,461 bytes)
test/saleshelper.test.ts 0af4c29d4cfff5ad (10,144 bytes)
test/surface.test.ts b0c73474e8754efb (73,650 bytes)   test/view.test.ts a3878a3a47b93c23 (23,748 bytes)
scripts/smoke.mjs 1fecd926957670ee (315,358 bytes)
```

## Flags left standing

The 16px scrollbar is Chrome's to draw (`::-webkit-scrollbar`); Firefox keeps its own width and takes only the colors. The frame's floor of 480px means a window shorter than about 700px scrolls the page again; his word if the floor should move.

Standing from before: the Sales Order history lane (customers, salespeople, prices); the re-drops of the big plants files and which export the failed third was; the 1509 file's exactly-10,000 rows; WIP under the FG title, pounds beside grams, a per-license filter; the rack grid reading; the plants file header; CSA's place; F3, F6, F7, F8, F9; the Packages from Harvests Item pattern; the three Zoho forks.

Worker only, no migration: the fast lane. Live underneath: worker 293b16a0, migrations 0001-0043 on the rolled database.
