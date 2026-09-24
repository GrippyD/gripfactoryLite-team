# Builder prompt: the walk slice (Interco menu, real licenses, exact icons, walk fixes)

**Issued by the Scribe, 2026-09-04, from the owner's live walk of worker 45590869 (canon 0.18.0). Read this whole file before writing code.**

## Read first, obey always

1. Read `canon/_NOW.md`, then `canon/MEMORY.md`, then `canon/CANON.md`. Canon wins over this prompt; flag disagreements in your session report, never resolve them silently.
2. Guardrails: no git remotes, no pushes, no GitHub (G-1). NO em dashes or en dashes in anything you write (G-8; byte audit must read 0; the vendored icon files and T3 CSVs are exempt). **Migrations 0001 through 0019 are now FROZEN (0016-0019 deployed 2026-09-03); this slice adds exactly one new file, 0020.** Ship-clean (G-9). Session report with the sealed final check pasted verbatim (G-10).
3. House laws: t() with es values for every display string; registry is data; reasoned audit on every state change; display grams comma-grouped, machine surfaces RAW; all three view sheets style every new surface; phone reflows; PIN gate unchanged (/admin*, /interco, /interco/*, /fulfillment*, /inventory*, /virtual-move, /virtual-move/*); /reports stays unPINned; vendored files are never edited (saleshelper pair, the T3 CSV pair, and NOW the icon set); never deploy c10; TBD wrangler ids stay TBD.
4. Live surfaces you must not disturb beyond what this prompt orders: the operations map layout and flow, the Reports node, the ledger and its mint laws, Virtual Move, the lookups landing, help text.

## Part 1: the exact icon files (the owner's words: "use these exact icon files for the main menu, for some reason you and cursor want to redraw them from the references instead of just using the exact copies")

The owner's icon set is vendored as the original zip at `prompts/2026-09-04_operations_icons.zip` (sha256 leading 830ccccc5b20ab04). Extract its `icons/` tree into `app/public/icons/` so the repo carries `app/public/icons/white/{harvest-field,interco-truck,drying-silo,production-factory,marketplace,business-scale}.{svg,png}` and the same twelve under `app/public/icons/dark/`. THE LAW: these bytes serve AS-IS. Never redraw, re-export, minify, strip metadata (the SVGs carry C2PA provenance blocks; they stay), or edit them. The extracted tree must hash to b654ad0dd0798614 (sha256 of the sorted per-file sha256 list; the Scribe re-checks).

- The six map nodes stop rendering src/icons.ts inline SVGs and instead render `<img>` tags pointing at the vendored files, served through the existing assets binding: harvest_ops = harvest-field, interco_logistics = interco-truck, drying_ops = drying-silo, production_ops = production-factory, marketplace = marketplace, business_ops = business-scale.
- Variant law: a dark ground gets the white set, a light ground gets the dark set. Cerberus and Lite (dark grounds) use /icons/white/. CO light uses /icons/dark/ and CO's prefers-color-scheme dark variant swaps to /icons/white/: render both imgs with classes and let each sheet show exactly one (display toggles; no JS). Use the SVG files; the PNGs stay vendored as the owner's exact copies and as the fallback set.
- Size the imgs to the existing softkey icon box (the 3.4rem law) with width/height attributes plus CSS; aria-hidden beside the visible labels; loading eager on home.
- src/icons.ts keeps compiling (tests may import it) but the map stops using it; note in the session report that it is now legacy for the map. /ops subpage headers, if they render icons, use the same img lane.
- Update the map tests: nodes assert the img src per group and variant classes instead of inline svg markup.

## Part 2: walk fixes

**2a. HBN start time input mask (owner: "Start time, '####' entry should write to an input mask that adds the colon").** The Acquire start time input gains a tiny inline script (no framework, the boot-scrawl idiom): typing four digits masks to HH:MM live (0730 becomes 07:30 as the user types; the colon inserts itself after the second digit when more digits follow; backspace behaves sanely; pasted #### also masks). The stored value and the server-side TIME24 refusal law stay exactly as they are; the mask is a convenience layer over the same text input. i18n untouched. A smoke assertion posts 0730-style raw digits and confirms the server still refuses non-HH:MM (the mask is client-side only; the server contract does not loosen).

**2b. Unload spear/bucked radios do not click (owner bug, his walk).** Reproduce on a hang lot's session header, find the real cause, and fix it. Prime suspects, in order: a theme sheet styling `input[type="radio"]` with appearance:none and no drawn replacement (clicks register but nothing visibly changes), a label/for id mismatch so the tap target misses, an overlay (panel ::before, the sheen layer) eating pointer events, or the mode-lock rendering disabled when it should not. The fix must land in ALL THREE view sheets and phone mode. Add a markup regression test (unique ids, label[for] wired, no disabled attribute on a weightless session) and prove the click visually in your rendered pass.

**2c. Bucked-on-site only under Spear (owner: "Bucked on site should only appear if 'Spear' is selected").** The "Will these be bucked on site?" block renders hidden and shows only while the Spear radio is checked (tiny inline script toggling the hidden attribute; server side already only honors it on spear finishes, keep that). A bucked session never sees the question. Test the markup carries the conditional hook; smoke walks a spear finish with the answer and a bucked finish without one.

## Part 3: the license map becomes real (migration 0020, the slice's only migration)

`0020_license_map_and_walk.sql`, Postgres-portable, append-only:

1. `ALTER TABLE lookup_values ADD COLUMN tone TEXT;` (nullable; only license rows use it today).
2. Relabel the two existing license rows and add the five missing ones so the category `license` reads EXACTLY (value, label, tone, sort):
   - AU-G-C-000832, "PNN AU", blue, 1
   - GR-C-001132, "PNN Med", yellow, 2
   - AU-P-000694, "PNN Processor", green, 3
   - AU-G-C-001397, "PNS AU", blue, 4
   - GR-C-001405, "PNS Med", yellow, 5
   - AU-G-C-001509, "ARL AU", blue, 6
   - GR-C-002600, "ARL Med", yellow, 7
   UPDATE the two seeded rows in place (keep their ids; new labels PNN AU and PNN Processor, tones blue and green) and INSERT the five new rows with fresh a2-prefix uuids in the seed style. Blue = adult-use grow, yellow = medical grow, green = processor.
3. `ALTER TABLE interco_movements ADD COLUMN metrc_manifest_number TEXT;` (nullable; see Part 4).
4. `ALTER TABLE interco_movement_items ADD COLUMN received_qty NUMERIC;` (nullable; see Part 5).

**Selector render law (owner: "the record selector should also say '- PNN AU' - make it blue"):** every license select option renders `<value> - <label>` (example: "AU-G-C-000832 - PNN AU") and wears its tone. Options themselves cannot reliably color cross-browser, so the picker is a select paired with a tone chip that recolors live to the chosen option (tiny inline script; chip text = the label), and anywhere a license renders as text (movement lines, receipts, Virtual Move panes, the lookup pane) it carries a `.tone-blue/.tone-yellow/.tone-green` class each view sheet styles in its own idiom (Cerberus: tinted ink on steel; CO: tinted text on paper; Lite: tinted chunky border). The generic lookup pane shows and edits the tone column for license rows (reasoned edit law).
Virtual Move keeps working against the relabeled rows (its two fixed licenses are AU-G-C-000832 and AU-P-000694 by value, not by label; add a pinning test).

## Part 4: Interco opens to a menu; [Outbound] rebuilt

/interco becomes a MENU page in the Fulfillment-menu idiom: two buttons, **[Outbound]** to /interco/outbound and **[Receiving]** to /interco/receiving (both inside the existing PIN gate; the old ?tab= urls 302 to the new pages so nothing bookmarked breaks). The ops map node keeps pointing at /interco.

**/interco/outbound, three panes (the owner's layout):**

- **LEFT pane: dry spaces.** Every dry space (all farms, grouped by farm) with its resident local inventory items (SPR and WIP whose location is that space's name), each space showing name, item count, and total grams. An [Add] control per space stages ALL its resident items onto the working manifest (items already on a building movement are excluded and shown muted). Spaces with nothing to ship render muted without the control.
- **MIDDLE pane: the header, then the added packages.** Header fields as they exist today PLUS the license law: origin license and destination license selects render the seven colored options per Part 3 (farm selects stay; picking a license may preselect its farm by label prefix, PNN/PNS/ARL). Under the header: the added packages list (package code, kind, strain, qty, source space) each with [Remove]. Then ONE action: **[Finish Outbound Shipment]** (replacing the separate Export and Complete buttons, the owner's merge): it generates the T3 manifest CSV (same T3_MANIFEST_HEADER emission, unchanged), stamps exported_at and completed_at, sets every item's location to IN-TRANSIT (reason inv_moved_out), and lands on a confirmation that offers the CSV download plus a link back. The manifest stays re-downloadable from its movement afterward (Receiving's view and the outbound recall list below). Guard: finishing with zero packages refuses 400.
- **RIGHT pane: outbound manifest numbers with recall buttons.** Building (unfinished) movements list newest first by MANIFEST NUMBER with a recall control (the Acquire-recall idiom): recall opens that movement back into the middle pane for more packages or header edits. Finished movements list beneath, muted, with their CSV re-download links. **Manifest number law (Scribe provisional, owner corrects):** the number is the movement id short (first 8) until a real one exists; the header carries an optional `metrc_manifest_number` field (0020) the TL can type when METRC or T3 assigns one, and every surface (this pane, Receiving lines, receipts) prefers it when set.

## Part 5: [Receiving] rebuilt

**/interco/receiving, two panes:**

- **LEFT pane, one line per inbound movement (completed, unreceived items remain), the owner's line format:** `Origin Farm - Manifest number - Truck # - Weight`. Weight = the header gross weight when set, else the comma-grouped sum of item quantities. Clicking a manifest exposes its items on the working pane.
- **MIDDLE (working) pane, the picked manifest:** its item lines (package code, kind, strain, manifest qty), each with **[Receive]** and **[Reject]**. Receive opens the weight-to-receive input (the owner: "brings up the left pane window with the weight to receive in a text box - default is whatever is on the manifest but you can type over it"): an inline reveal on the line (no browser dialogs) with the manifest qty prefilled, overridable, confirm stores received_qty (0020) and stamps the item received. Reject stays the reasoned refusal (location back to origin farm). **[Receive all]** at the bottom receives every unhandled item at manifest weights. **[Finish Receipt]** at the bottom: creates the receipt row over the received items, sets each received item's farm_code to PNN and location to CSA (the owner: "moves the material to PNN in CSA in the local inventory"), adjusts each item's qty to its received_qty where it differs (reason inv_received; RAW audit values), and **pends the receiving CSV** (below). A manifest with nothing received refuses Finish Receipt 400. The receipts log, view receipt, PIN-side VOID and per-item Un-receive stay as they are (un-receive also clears received_qty).
- **The receiving CSV (owner: "Finish Receipt creates the necessary CSV for receiving a manifest into METRC"; SHAPE PROVISIONAL, Scribe-ruled, flagged):** no T3 receive template exists in the vendored set yet. Centralize in ONE constant `RECEIVE_CSV_HEADER` in src/interco.ts: ManifestNumber, PackageTag, ReceivedQuantity, UnitOfWeight, ReceivedDate, ReceivingLicense. One row per received item, RAW values, RFC 4180. Pend it through metrc_uploads (kind receive_manifest, ref_id = the receipt id) so it lists on /admin/uploads with download and mark-uploaded like the other kinds. When the owner supplies the real T3 receive template, it lands as a one-constant edit.

## Verification you owe (the Scribe re-verifies everything)

- tsc clean; vitest green with new tests: icon img srcs and variant classes per view; the mask hook markup; radio wiring regression; conditional bucked-on-site hook; the seven license options with labels and tones (and the Virtual Move value pinning); the menu page and 302s from the old tabs; dry-space add staging all resident items and excluding on-movement items; Finish Outbound Shipment single-action semantics (CSV bytes stable, items IN-TRANSIT, zero-package refusal); recall reopening a building movement; the Receiving line format; per-item receive with an overridden weight writing received_qty; Finish Receipt landing PNN CSA, adjusting qty, pending kind receive_manifest; un-receive clearing received_qty.
- Migrations 0001-0020 from zero; full smoke PASS with the new walks (an outbound built from a dry space, finished, received at an overridden weight, receipt finished, the receiving CSV downloaded and asserted; the old ?tab= redirects; the icon img urls answering 200).
- Dash audit 0 on every file you write (vendored icons and CSVs exempt).
- Rendered pass read back: home with the exact icons in Cerberus, CO light, CO dark, and Lite; the Interco menu; Outbound with a staged package and the colored license chips; Receiving with the weight reveal open; the unload radios clicking (before/after proof); phone home.
- SESSION_REPORTS/2026-09-04_interco_menu_walk_slice.md with the sealed check verbatim and OWNER flags: the receiving CSV shape, the manifest number provisional, the Receiving Weight source, the dry-space add unit.

## Do not

Do not touch canon/ or prompts/ (extracting the vendored zip into app/public/icons/ is the one sanctioned copy OUT of prompts/). Do not edit migrations 0001-0019. Do not add npm dependencies. Do not redraw, minify, or strip the icon files. Do not alter the T3 manifest emission or its vendored pair. Do not rename /interco (the menu lives there) or break the station URLs. Do not deploy; the owner deploys by PS after the Scribe's gate.
