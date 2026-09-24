# Build slice: the four-window interco floor and the manifest working pane (canon 0.28.0)

You are a build hand in the Gripfactory Lite repo. Read `canon/_NOW.md`, then `canon/MEMORY.md`, then `canon/CANON.md` before touching anything. Canon wins over this prompt where they disagree. Guardrails bind: no remotes (G-1), no em or en dashes in anything you write (G-8), migrations append-only, ship-clean (G-9), sealed session report (G-10). Never deploy; the owner deploys by PS. Never edit `canon/` or `prompts/`.

This slice REBUILDS the interco floor (/interco) as the owner's ratified four-window workspace and adds the manifest working pane. Migrations start at 0030. The tree you are building on already carries the Weighing Queue (0.27.5) and the EMPTY law (0.27.6).

## The ratified design (owner's words are in canon 0.27.6, 0.27.7, and 0.28.0; these are the laws)

1. **Four windows, left to right: Arlington, PNS, PNN, then the WORKING PANE.** Note the site order: ARL, PNS, PNN. The old three-panel floor, its Send buttons, and the separate Building 23 panel go.
2. **Each site window is a collapsible tree.** Site header collapses the whole site (details/summary, open by default). Inside, one collapsible line per LICENSE the site carries, colored by class as TEXT COLOR: Adult Use licenses YELLOW, Medical licenses BLUE (theme classes, both themes; pick readable shades against each theme's ground).
   - Arlington: ARL AU (AU-G-C-001509) and the ARL Med placeholder.
   - PNS: PNS AU (AU-G-C-001397) and the PNS Med placeholder.
   - Penn North: 832 (AU-G-C-000832), 694 (AU-P-000694, the processor; the owner's word: "it's just another collapsable line under Penn North"), and 1132 (Medical, the collapsed Med stack).
3. **Inside a license line: the material list.** Package rows lead with the package ID (package_code); beneath each, a smaller, dim grey line: Weight (g), Lot, Market Strain (the market strain display law: COALESCE(market_strain, strain name); Lot is the YY### token). Wet lots ride THE SAME list under their license (owner's fork answer: "the first one"), labeled by the standing simple lot row (Farm / Strain / Date, Truck prefix only when a number exists), with the same dim-grey line beneath (weight, lot token, market strain). A weighing or in-transit lot sits under its site's AU grow license until the Med intake flow exists. Location tags ride each row where material is not in the barn (CSA, silo names, CSB and friends), since the manifest law needs the location. Empty license lines and empty sites read "- EMPTY -" (the 0.27.6 law, one i18n key).
4. **The working pane (window four) is where the manifest builds.** THE MANIFEST LAW: one origin license/location to one destination license/location per manifest. THE INBOX LAW: the destination location is always the destination site's barn, EXCEPT the internal CSA to CSB transfer, which lands CSB (origin 832/CSA to destination 694 forces CSB).
   - Every material row in the trees carries the add controls the owner asked for: an "Add to new manifest" button (always), and an "Add to existing manifest" button when a building manifest is active. Adding the first item creates the movement (status building) and locks the manifest's origin license/location to that item's pair; every later add must match the pair or refuse 400 in words ("One origin license and location per manifest.").
   - The ACTIVE manifest renders in the working pane: its origin line (locked), the destination selects in the PANE HEADER (destination license; location auto-derives: barn of the destination site, or CSB for the internal case; show the derived location, never a free pick), the item list with reasoned remove, running totals, and the finish action riding the existing movement lifecycle (finish emits the manifest CSV to the one export home exactly as today; the internal CSA to CSB case emits the virtual paper-door manifest the door emitted).
   - THE FOCUS LAW (owner verbatim): "Once a manifest is active in the far right, only the origin license is fully exposed on the left." With a building manifest active, every other license line renders collapsed and dimmed; the origin license line stays open. The active manifest is the newest non-deleted building movement.
5. **What retires and what stays.** /interco/send/:site and /interco/door retire and 302 to /interco (the pane absorbs them; the CSA to CSB internal case IS the door now). Ship external: the pane absorbs item picking; when the destination is an external license the pane carries the existing T3 header fields before finish (reuse the outbound header form machinery; externals still originate processor-side only, the standing law). ARRIVALS PAGES AND THE ON THE ROAD STRIP STAY AS THEY ARE (Scribe assumption folded in canon 0.28.0; receiving is unchanged, the road strip renders below the four windows). The manifest recall list and receipts stay reachable from Arrivals as today.

## Migration 0030 (append-only, one file)

`0030_manifest_locations.sql`: `ALTER TABLE interco_movements ADD COLUMN origin_location TEXT;` and `ADD COLUMN destination_location TEXT;` plus INSERT OR IGNORE license lookup seeds for the Med placeholders: value `MED-ARL-TBD` label `ARL Med (placeholder)`, value `MED-PNS-TBD` label `PNS Med (placeholder)`, and value `1132` label `PNN Med (1132 stack)` if no 1132 license row exists. Placeholders are one-edit swaps when the owner supplies real numbers; never invent real-looking license numbers.

## Code shape

- config.ts: a `LICENSE_CLASS` map (data in code, like SITE_OF_LOCATION): known AU values to "au", 1132 and the two placeholders to "med"; unknown licenses default "au". A `SITE_LICENSES` map: ARL, PNS, PNN to their license lists in render order. Helpers stay pure and unit-testable.
- theme.ts: `.lic-au` and `.lic-med` heading colors in all four sheets (yellow and blue text, readable on each ground), plus the dimmed collapsed state for the focus law.
- html.ts: the floor page rebuilds; the tree renderer is one function shared by all three site windows; the working pane renderer takes the active movement. Hover help stays title-borne (0.26.0 law), no on-screen help text.
- actions.ts: add-to-manifest (create building movement or append item; the origin pair guard; wet lots add by lot id, packages by item id, riding the existing movement item machinery), destination set (license select; location derived), finish (existing lifecycle + the internal virtual case), reasoned item remove. Overissue stays FLAG NEVER BLOCK where it applies.
- Old routes: 302s tested. Old floor pins in tests and smoke updated to the new structure (the one-barn-block law generalizes: ONE list per license line, exactly one "- EMPTY -" when a container is empty; no split-brain lines anywhere).

## Gate (all green before you write the report)

```
npx tsc --noEmit
npx vitest run
node --check scripts/smoke.mjs
Dash audit on every touched file: LC_ALL=C grep -c $'\xe2\x80\x94\|\xe2\x80\x93' <file> = 0
rm -rf .smoke-persist && SMOKE_PORT=<fresh> WRANGLER_SEND_METRICS=false timeout 280 npm run smoke
  (exit 124 expected; require SMOKE PASS and "About to apply 30 migration(s)" from zero)
```

Smoke walks to add: the four windows render in order with the license lines colored by class; a package row carries the dim-grey subline; add-to-new locks the origin and dims the other license lines; a mismatched-origin add refuses 400 in words; destination 694 from a CSA origin derives CSB; a barn-destination manifest derives the destination barn; finish lands the manifest CSV at /admin/uploads only; the retired routes 302; "- EMPTY -" renders for an empty license line; Arrivals and the road strip still render.

Write `SESSION_REPORTS/2026-09-06_four_window_floor.md` with the sealed final check (G-10): commands verbatim, test counts, dash audit, from-zero pin, and sha256 first-16 for every touched file. Propose any canon amendments there; never edit canon yourself. Tell the owner to say deploy when he wants it on the worker; this slice ships worker plus migration 0030.

---

## ADDENDUM 2026-09-06 (canon 0.28.1): the license lives on the HBN

Owner, verbatim, mid-build: "I think I know the missing link.  HBNs don't currently carry the license.  They're created in it right now and that's why it hasn't come up.  Cursor is looking at the tree and trying to figure out where the license is inherited.  It's not until too late in the process.  The license list should be in Admin lookups with their farms, and they should be selected during HBN minting.  The license doesn't need to be on the CSVs, the CSVs are deployed to the licenses"

What this changes in the slice:

1. **Widen 0030** (it is unshipped; if you already sealed 0030 on your bench, cut 0031 instead, append-only as ever): `ALTER TABLE harvest_batches ADD COLUMN license_value TEXT;` plus farm assignments on the license lookups: 832, 694, and 1132 carry farm_code PNN; AU-G-C-001509 and MED-ARL-TBD carry ARL; AU-G-C-001397 and MED-PNS-TBD carry PNS (give the Med placeholder INSERTs their farm at insert). Backfill: any existing batch with a NULL license_value takes its farm's AU grow license (ARL to AU-G-C-001509, PNS to AU-G-C-001397, everything else to AU-G-C-000832).
2. **Admin:** the Licenses lookup page grows the Farm column and the add-form farm select, exactly the 0029 locations pattern (lookup_values.farm_code already exists; this is surface wiring plus seeds).
3. **Acquire HBN:** a license select rides the minting form, required, options filtered or grouped by the picked farm, defaulted to the farm's AU grow license so the common case is one tap. The batch stores it; createHarvestBatch validates the value against the license lookups.
4. **THE INHERITANCE LAW:** a batch's lots sit under the batch's license everywhere a surface needs a license for pre-ledger material; the four-window trees place wet lots by it. The finish mint writes the batch's license onto the minted item (falling back to the AU grow license when NULL). Arrival conversion laws stand unchanged: everything landing a site still becomes the arrival license on receipt.
5. **THE CSV LAW, verbatim scope:** no license column is added to any METRC CSV. The files are deployed INTO licenses; content stays as is.
6. **Pins:** acquire carries the required license select and a minted batch stores it; the licenses admin page carries the Farm column; a 1132-license batch's lot renders under Penn North's blue line; the from-zero pin stays 30 if you widened 0030, or becomes 31 if you cut 0031. State which in your report.
