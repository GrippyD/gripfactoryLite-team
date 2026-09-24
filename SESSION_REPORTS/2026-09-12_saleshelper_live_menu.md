# Session report: THE SALESHELPER LIVE MENU AND HEADER (canon 0.30.47), Scribe-direct, 2026-09-12

**Scribe:** Gripfactory Lite Scribe (Cowork), Scribe-direct under G-2. The first issue of the SalesHelper fix session; one slice, worker only (no migration; the fast lane). The vendored pair is untouched.

## The owner, verbatim

With a screenshot of the framed form's header bar ("GRIP CANNABIS · Sales Order   Menu built Aug 11, 2026, 1:58 PM ET · SalesHelper canon v0.7.3 · OCG Companies   inventory as of 38 days ago" and the desktop/phone pill at the right):

"Remove cell/monitor pill add button next to the last update date [update] that redirects to the zoho upload screen.  We just updated so the inventory should be on screen and the date should roll.  Check and see what's happening"

## What was happening

The vendored form fetches `menu.json` beside itself on load (and again when a tab comes back into view with an empty cart), and swaps it in when its `builtAt` is newer than the snapshot embedded in the HTML. This Worker answered `/fulfillment/saleshelper/menu.json` with the vendored static, the SalesHelper's own 2026-08-11 build of the 2026-08-06 export, so the Zoho mount on the Marketplace (canon 0.30.36) never reached the form: the mount writes `listings`, the form read a file. The date in the header ("Menu built Aug 11, 2026, 1:58 PM ET") is not data at all; the SalesHelper bakes it into the HTML when it builds the app. The badge ("inventory as of 38 days ago") reads the static's `dataAsOf`. So the inventory could not be on screen and the date could not roll, whatever was dropped.

## What shipped

**menu.json is built from the newest Zoho mount.** `GET /fulfillment/saleshelper/menu.json` (and the old `/fulfillment/menu.json`) now reads the vendored static as the base and, when a Zoho mount exists, re-lines it from the mounted, listed items (`listings` where source is zoho, listed, stock above zero): the items run through the SalesHelper's own classify and collapse rules, ported into `src/saleshelper.ts` from its `src/lib` (SalesHelper canon 3 to 5: the five-segment name `TYPE - Strain - FARM - GROW - THC%`, GRIP Vape and IPR by their first word, the line key `TYPE|strain|GROW|floor(THC)`, farms merged, FIFO by METRC tag then item id, sections PRE BUD MIX SHA MOB NUG TRI WBP VAPE IPR, eaches for PRE MOB VAPE IPR and weight for the rest). `builtAt` and `dataAsOf` are the mount's time (the form takes a menu whose `builtAt` is newer than its snapshot; its badge reads the data age from `dataAsOf`), `sourceFile` names the mount, `baseBuiltAt` remembers the static it was built on, `types` and `stats` follow the lines, and the static's `customers`, `salespeople`, `lastPrice`, `lastTypePrice`, `casePacks`, `originLicenses` and `canonVersion` carry over unchanged (they come from sales history, which has no lane here yet). `builtAt` stays the first key, the SalesHelper's own serving law. No mount, or a base that is not a canonical menu: the static serves as it came. The response carries `x-gf-menu: zoho-mount` when it was built.

**The header, at serve time.** The vendored page is decorated as it is served (the Cerberus skin's precedent, now in every view): a style block hides the desktop/phone pill (`#mode-pill`; its buttons stay in the DOM because the form's own script wires them, so nothing breaks); when a mount exists the words "Menu built <build time>" become "Inventory updated <the mount's time, Eastern>"; and an **Update** link sits beside the date, `target="_top"`, so from inside the Marketplace's SalesHelper tab (or the Fulfillment wrapper) it sends the whole window to `/marketplace?pane=zoho`, where the Items export is dropped. Without a mount the build date stays and the link still offers the way.

**Seen in the browser** (wrangler dev on the smoke DB, whose last Zoho mount was minutes old): the header read "Inventory updated Sep 12, 2026, 2:13 PM ET · SalesHelper canon v0.7.3 · OCG Companies", the pill was gone, the Update button stood beside the date, the badge read "inventory as of 5 min ago" in its green state, the Product type list carried only the mounted kinds, and clicking Update landed the top window on the Zoho pane with its tab lit.

**Not touched:** `public/saleshelper/index.html` (651,831 bytes, sha256 f666e4eebde5efd1, mtime 2026-08-31) and `public/saleshelper/menu.json` (607,296 bytes, sha256 7f43fd9a7732ebb7), the vendored pair as vendored; the Cerberus skin; the Zoho mount itself; the Fulfillment wrapper.

## Sealed final check

```
cd /home/claude/deploy/app
npx tsc --noEmit                      -> exit 0
npx vitest run                        -> Test Files 23 passed (23), Tests 552 passed (552)
Dash audit (5 authored files + this report) -> 0 each
SMOKE_PORT=9819 WRANGLER_SEND_METRICS=false timeout 285 npm run smoke
                                      -> SMOKE PASS, "About to apply 43 migration(s)" from zero
Smoke pins: before any Zoho mount, both menu.json paths serve the static
  (builtAt 2026-08-11T17:58:11.229Z first, sourceFile Items_api_2026-08-06.csv,
  no live marker) and the served form hides the pill, keeps its buttons,
  carries exactly one Update link to /marketplace?pane=zoho with target _top,
  and keeps "Menu built Aug 11, 2026, 1:58 PM ET"; after the mount, menu.json
  answers x-gf-menu zoho-mount with builtAt first and the mount's time,
  dataAsOf equal to it, sourceFile "zoho mount Item.csv (gripfactory lite)",
  baseBuiltAt the static's, types PRE BUD MOB VAPE IPR, the five collapsed
  lines in canon order, the BUD line at 0.75 under its tag (the two bins
  folded by the mount) labeled "Donny Burger · Outdoor" by weight, the PRE
  line 80 eaches at 20.77, stats 5 packages 5 lines 1 excluded (the
  distillate's two-segment name), the base's customers, prices, salespeople
  and canon version carried; the served form's header reads "Inventory
  updated <Mon D, YYYY, H:MM AM/PM ET> · SalesHelper canon v0.7.3 · OCG
  Companies", the baked date gone, the Update link standing.
Unit pins (test/saleshelper.test.ts, 7): classify in every shape (the
  convention key, vape, IPR, the four exclusion reasons); the FIFO order;
  the collapse (keys in canon order, farms merged, THC min and max, unit by
  type, FIFO packages); the live build (builtAt first, the mount's time,
  sourceFile, baseBuiltAt, types, stats, the base's fields carried, the old
  lines gone; null for a non-canonical base); Eastern time formatting; the
  header decoration with and without a mount (pill hidden, buttons kept,
  date rolled, one Update link before the badge, the embedded snapshot
  untouched).
Visual pass (chromium against wrangler dev on the smoke DB): the header as
  described above; Update clicked from inside the frame landed the top
  window on /marketplace?pane=zoho; no request failed.

src/saleshelper.ts 86432e69488fbb09 (11,275 bytes)   src/zohoinv.ts 821e4a810f20315c (19,409 bytes)
src/index.ts 1586fc5fca86d218 (103,650 bytes)        test/saleshelper.test.ts 985df9a0ab4a6985 (9,912 bytes)
scripts/smoke.mjs d78429ceeecb3231 (314,989 bytes)
```

## Flags and forks left standing

**What still comes from the 2026-08-11 static:** customers and their licenses, salespeople, the last-price prefills, case packs and origin licenses. They are built from the Zoho Sales Order history export in the SalesHelper's own pipeline; a mount lane for that export here (like the Zoho Items mount) would let them roll too. The SalesHelper's own refresh worker made the same split (lines live, the rest from the base).

**Two bins, one package.** The Zoho mount folds two export rows with one SKU into one listing with the summed stock (canon 0.30.36); the SalesHelper's static build listed each Zoho item as its own package. The live menu therefore carries one package under that tag with the summed stock and the first row's item id. When the two rows are one Zoho item at two bins that is exact; when they are two Zoho items sharing a SKU the order's allocation names one item id for both. The owner's word if that case exists in Zoho.

**The mount's time is the data's time.** The export was pulled from Zoho some minutes before it was dropped; the badge understates the age by that gap. The SalesHelper's own worker does the same.

**/api/send** stays unrouted here: finished orders still download the CSV and the order file and open the email, by the SalesHelper's design.

**Standing from before:** the re-drops of the big plants files and which export the failed third was; the 1509 file's exactly-10,000 rows; WIP under the FG title, pounds beside grams, a per-license filter; the rack grid reading; the plants file header; CSA's place; F3, F6, F7, F8, F9; the Packages from Harvests Item pattern; the three Zoho forks.

Worker only, no migration: the fast lane. Live underneath: worker fdd49106, migrations 0001-0043 on the rolled database.
