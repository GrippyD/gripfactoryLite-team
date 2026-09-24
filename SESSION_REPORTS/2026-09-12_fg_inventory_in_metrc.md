# Session report: FG INVENTORY IN METRC (canon 0.30.43), Scribe-direct, 2026-09-12

**Scribe:** Gripfactory Lite Scribe (Cowork), Scribe-direct under G-2. One owner ruling, one slice, worker only (no migration; the fast lane).

## The owner, verbatim

With a screenshot of the `/inventory` node's FG INVENTORY pane (the Zoho-fed bars: "Data as of 2026-08-06T00:00:00.000Z. Built at 2026-08-11T17:58:11.229Z. This file is the 2026-08-11 static until the refresh lane exists. A graphical representation of the inventory in Zoho (aka ready to be sold)." PRE 24647, BUD 2088.82, MIX 5929.58, SHA 2101.55, MOB 5512, NUG 5, TRI 0, WBP 49.85, VAPE 557850, IPR ...):

"Change this pane to "FG INVENTORY IN METRC"

It should reflect the inventories correctly here"

His pick on the Scribe's fork (grouping): **"By item kind (Recommended)"**.

## What shipped

**The pane.** `/inventory`'s FG section is now titled **FG Inventory in METRC** and reads the METRC mirror's active packages (gone rows excluded), every license together. The bars group by the first word of METRC's Item name, the kind: MIX, BUD, MOB, PRE, WBP, TRI, WIP, FFZ, BIO, GRIP Vape, Infused Pre-Rolls, GRIP THCA Infused Flower, Mitten Extracts, and so on, exactly as the state names them. Grams and eaches never share a scale: **By weight** bars scale against the largest grams kind, **By count** bars against the largest eaches kind, and any other unit stands under **Other units** as METRC states it. Each bar opens to its items (Item, Category, Packages, Quantity), largest first; the kind's line notes its package count, its METRC categories, and how many of its packages are not test-passed (Lab Test Status other than TestPassed or RetestPassed). The head line says where the numbers come from: "From the METRC mirror: 11,743 active packages. Newest packages mount 2026-09-12T16:10:03.613Z. AU-G-C-000832 11,742 packages, mounted ...; GR-C-001405 1 package, mounted ...". Before any packages export is mounted the pane says so and links the mirror's drop form; after a mount that left nothing active it says the mirror holds no active packages.

**What left the pane.** The 2026-08-11 Zoho static (menu.json) no longer feeds `/inventory`; it still feeds the marketplace's item names, untouched. The inventory CSV export (`/export/inventory.csv`) now carries the METRC kinds: grams kinds under section `fg` with their grams, eaches kinds under `fg_each` with the count in the number column, other units under `fg_other`; the flat CSV keeps its three columns.

**Read on his own export** (the real AU-G-C-000832 Packages Active file of 2026-09-11, 11,742 packages, mounted through the page in 3 rounds): MIX 1,686,041.76 g (126 packages), BUD 707,533.64 g (103), Mitten Extracts 540,257.11 g, Grip 304,079.40 g, FFZ 129,259.00 g, WIP 123,886.00 g, TRI 63,550.00 g, BIO 57,600.00 g, THCA 25,000.00 g, WBP 22,334.00 g, Biomass 8,000.00 g; GRIP Vape 528,439 ea (10,595 packages), Infused Pre-Rolls 15,955 ea, GRIP THCA Infused Flower 6,360 ea, MOB 3,287 ea, THCA Infused Flower 895 ea, PRE 339 ea. Every package in that file reads Finished Goods False and Administrative Hold False; 13 read NotSubmitted, the rest TestPassed or RetestPassed.

**Code.** `src/metrc.ts`: `metrcItemKind` (the Item's first segment), `metrcUomKey` (g and ea folded, others as they came), `shapeMetrcFg(rows, mounts)` (pure, tested) and `metrcFgInventory(db)` (one GROUP BY over `metrc_packages` by license, item, category, uom, plus the newest packages mount per license; null until a packages export has been mounted). `src/inventory.ts`: the sheet's `fg` is now `MetrcFgInventory | null`; `inventorySheetRows` emits the kinds. `src/db.ts`: `loadInventorySheet` takes the picture. `src/html.ts`: `fgKindBars` and `fgSection` rewritten; the section summary reads FG Inventory in METRC. `src/index.ts`: `/inventory` and the CSV export read `metrcFgInventory`; `loadFgMenu` stays for the marketplace. `src/theme.ts` (three themes): the kind label column is a fixed `clamp(3.4rem, 28vw, 11rem)` so long kind names keep the bars aligned, and under 600px the label wraps above its bar. i18n keys EN and ES.

## Sealed final check

```
cd /home/claude/deploy/app
npx tsc --noEmit                      -> exit 0
npx vitest run                        -> Test Files 22 passed (22), Tests 545 passed (545)
Dash audit (10 authored files + this report) -> 0 each
SMOKE_PORT=9817 WRANGLER_SEND_METRICS=false timeout 285 npm run smoke
                                      -> SMOKE PASS, "About to apply 43 migration(s)" from zero
                                         (the process idles after the pass line until the timeout;
                                          the orphan sweep follows, with bracketed patterns)
Smoke pins: before any packages export, the pane is titled FG Inventory in
  METRC, says no packages export is mounted yet, links the mirror's drop
  form, and carries nothing of the Zoho static; after the mirror walk (the
  832 re-drop left the truck package WIP 480 g NotSubmitted and the bulk SKU
  BUD 336 g, the vape row gone, the hop package WIP 100 g under 1405) the
  pane counts 3 active packages with the newest mount, lists 832 with 2
  packages and 1405 with 1, carries WIP and BUD in grams and no GRIP Vape,
  totals WIP 580.00 g across both licenses and BUD 336.00 g, notes the WIP
  kind's 2 not test-passed, opens to METRC's item names, scales BUD at 58%
  of WIP, shows no By count block, and the inventory CSV carries fg,WIP,580.00
  and fg,BUD,336.00. The Finish Receipt pin that used to read PNN off the
  Zoho static's item names now reads Penn North off the received ledger row.
Unit pins: test/inventory.test.ts (28): the fixture is a shaped METRC
  picture; the CSV carries MIX 1000.00 and BUD 12.50 under fg and PRE 160
  under fg_each; the page carries the title, data-fg-type with data-fg-uom,
  the head line with 6 active packages and the newest mount, the license
  lines with and without a mount, By weight and By count and no Other units,
  MIX at 100% and BUD at the 2% floor, the stock spans with their unit, the
  kind notes, no Zoho words; the missing state with its link; the empty
  state after a mount. test/metrc.test.ts (26): metrcItemKind and
  metrcUomKey in every spelling; shapeMetrcFg on the real 832 shape (kinds
  by unit largest first, items under each, categories, not-passed counts,
  every license with packages or a mount alphabetical, the newest mount,
  the bare picture).
Visual pass (chromium against wrangler dev on the smoke DB, the real 832
  export mounted through the page in 3 rounds, 3.4 s): desktop 1280px, the
  pane with the head line, By weight (MIX full bar, BUD 42%, Mitten
  Extracts 32%, Grip 18%, ...) and By count (GRIP Vape full bar, Infused
  Pre-Rolls 3%, ...), MIX opened to its 30 items; phone 400px, each kind's
  name above its bar and number.

src/metrc.ts e34c424d7ec38a2c (66,209 bytes)      src/inventory.ts 792eb9dbdc6906b3 (15,920 bytes)
src/db.ts 325cbcc7e3d653ee (111,880 bytes)        src/html.ts 976caab0d70f1eaf (157,227 bytes)
src/index.ts 3541f24777fdd914 (102,832 bytes)     src/i18n.ts 054b076a79858f91 (100,924 bytes)
src/theme.ts 0d3e7f4c68dbe190 (114,159 bytes)
test/inventory.test.ts ad97a40efb01de96 (18,629 bytes)
test/metrc.test.ts e38f0a1aed189682 (38,174 bytes)
scripts/smoke.mjs ebc53e37fce833af (308,702 bytes)
```

## Flags and forks left standing

**WIP under an FG title.** The state holds WIP packages (the bucked flower awaiting processing, "WIP - Placeholder - PNN - I") and the pane shows them as their own kind so the inventories read whole; if the owner wants the pane to hide WIP (or any kind), that is one filter, his word.

**Pounds beside grams.** The Zoho pane's numbers read like pounds (BUD 2088.82); the app's law is grams and the pane speaks grams with the unit shown. A pounds reading beside the grams is one display line if he wants it.

**Per license.** The fork offered a per-license split; he chose kinds across every license, and the head line names each license's package count and newest mount. A license filter can come later.

**Standing from before:** the re-drops of the big plants files and which export the failed third was; the 1509 flowering export's exactly-10,000 rows; the rack grid reading; the plants file header (templates owed); CSA's place; F3, F6, F7, F8, F9; the Packages from Harvests Item pattern; the three Zoho forks.

Worker only, no migration: the fast lane, riding with 0.30.42 (both undeployed; one `npm run deploy:grip` carries both). Live underneath: worker c50fc8b5, migrations 0001-0043 on the rolled database.
