# FG1: FG inventory on the Harvest Console

Filed by the Scribe on 2026-10-13 (canon 0.30.463) from the owner's word: "I need a FG inventory collapsable after fulfillment on the dashboard as well" with these categories: BUD (448 lbs, collapses into weight by strain, strain collapses into weight by THC); TRI and SHA (the same, THC if available); PRE ("16 ounce (28 gram) lbs", the same); Distillate (liters, two decimals, collapses into who made it, "zoho trumps gflite for now"); Infused Bud (grams); Prerolls (each); Vapes (hardware type/flavor, each). His follow-up: "mix and nug are from last year, they need to stay but they need no provision of their own that's permanent. WBP, WIP, WPR aren't finished goods". And: "MOB is another 2025 item that's still floating around. It's a max out prepack bag".

For the build session (Claude Code or Cursor): open in `C:\Users\DennisWallace\Documents\Claude\Projects\gripfactory Practical\branches\GFLiteMetrcAPI` (its `app\` is the app). If your working folder is not under `branches\GFLiteMetrcAPI`, stop and say so. Under THE DISPATCH RULE (canon 0.30.155). This brief follows SP1 (Strain performance) in this worktree: pin to the tree SP1 leaves, which the Scribe names when SP1 is gated; until then do not start. Verify with canon's hash command in `app/`. No git; nothing committed, pushed or deployed. Never edit `canon/` or an existing migration. LF only. No migration.

## Read first
- `src/zohoinv.ts` and the `listings` table (migration 0039): the Zoho mount (`zoho_status`, `market_qty`, `market_uom`, `qty_grams`, `each_grams`, `thc_pct`, `item_name`, `category`, `zoho_mounted_at`).
- `src/fulfillmentboard.ts`: the console's Fulfillment section (`data-hc-section="fulfillment"`); the new section goes right after it.
- The GFLite ledger (`local_inventory_items`, `src/ledger.ts`, `package_types`): how a finished trim or shake package is known (item kind FG, package type TRIM or SHAKE as the ledger and the Inventory report name them), its strain, and any lab THC the package carries.

## The law
1. THE PLACE. A new section `<details class="hc-section" data-hc-section="fg_inventory">` right after Fulfillment, closed by default, summary "FG inventory" with the Zoho mount time beside it ("Zoho as of ..."). Each category is its own nested details, closed, its summary showing the category's total. EN and ES words in i18n.
2. THE SOURCE. Zoho listings that are live (`deleted_at IS NULL`, `zoho_status = 'Active'`, quantity above zero), sorted into categories by the item name's first segment (before the first " - ") and the Zoho category; the strain is the second segment. TRI and SHA come from the GFLite ledger (Zoho carries none today). Anything that matches no category below is left out, and the section ends with one muted line "Not shown: {n} Zoho items" so nothing vanishes silently.
3. THE CATEGORIES, in this order:
   - BUD: item names BUD, plus MIX and NUG folded in (last year's material; no line of their own, nothing permanent built for them: one list of prefixes in one constant). Weight = `qty_grams` over 448, two decimals. Collapses into strains (pounds), each strain into THC (`thc_pct`, two decimals, pounds at each value).
   - TRI and SHA: the ledger's finished trim and shake packages, pounds at 448, by strain, then by THC where a package has one (else "no THC").
   - PRE: item names PRE (prepack ounces of 28 g) plus MOB folded in (2025 max out prepack bags of 70 g; like MIX and NUG, no line of its own, in the same one constant of folded prefixes). Pounds = count times `each_grams` over 448 (fall back to 28 for PRE and 70 for MOB), by strain then THC.
   - Distillate: Zoho Concentrate items in liters whose name holds "distillate" (case blind), liters with two decimals; collapses into who made it (the name before "Distillate": Bow House, Mitten, HZ; spellings case blind, so "Mitten DIstillate" joins Mitten). Zoho is the source; the GFLite ledger's distillate is not read here until LD1 says otherwise.
   - Infused Bud: Zoho category Infused Flower, grams (count times `each_grams`), by product.
   - Prerolls: item names IPR (and Zoho category Infused Pre-Rolls), each, by flavor.
   - Vapes: Zoho category Vape/Cart, each; collapses into hardware type (the size segment, 1g, 2g) and then flavor.
4. NOT FINISHED GOODS: WBP, WIP, WPR, Biomass and FFZ are never shown (one constant).
5. NOTHING ELSE MOVES. Fulfillment and the other sections stay as they are; no migration, no cron, no new table, no Zoho call (read the mounted rows only).

## Performance
One read of the live listings (about a thousand rows), one grouped read of the ledger's finished trim and shake, pool in code; no per category query; at most 100 bound parameters a statement. The Scribe times /harvest on the live-data bench; the page stays under 1 s and the section adds no more than 0.15 s.

## Tests and the smoke
- Unit: prefix sorting (MIX and NUG into BUD, MOB into PRE at 70 g, WBP and FFZ out, the not shown count), PRE pounds from 28 g, distillate makers (case blind), vape size then flavor, THC buckets, the section's place after Fulfillment and closed, i18n parity.
- Smoke: /harvest answers 200 with the section; seeded Zoho rows land in their categories with the right totals.
- Render at 1920 and 820 in Lite, CO and Cerberus with the section and one category open; nothing runs together.
- Gates as always; report `SESSION_REPORTS/2026-10-13_fg_inventory.md` with canon's tree hash and every file touched.

## Scale (the Scribe's read of the 07:32 snapshot, Active Zoho rows)
PRE 329 items and MOB 54, BUD and MIX and NUG about 300, vapes 62, prerolls 9, infused flower 14, distillate 3 (Bow House 94.60 L, Mitten 250.25 L and 91.61 L).
