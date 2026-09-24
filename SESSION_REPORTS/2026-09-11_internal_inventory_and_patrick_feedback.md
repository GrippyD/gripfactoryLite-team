# Session report: the internal inventory slice opens (research) and Patrick's second list (canon 0.30.37), 2026-09-11

**Scribe:** Gripfactory Lite Scribe (Cowork), Scribe-direct under G-2. Two owner messages in one turn: the box opens with eight METRC exports attached, then Patrick's list arrives mid-turn with "we can add the fixes to this slice". Research first: the exports are profiled outside the repo (never vendored), Patrick's eight items are triaged against the code, the two items that are plain fixes ship sealed here, the rest stand as forks below. Nothing structural builds until his word lands.

## The owner, verbatim

"Let's start the internal inventory slice.  I think it would be smart to start with all the inventory at all the sites.  I've dropped all the inventory here.  There isn't anything in the processing license right now.

Now, I am going to want to add our own internal fields to these records that are not METRC related so we might need to do some stretching as we move"

Then: "More feedback from Patrick, let's go through it, we can add the fixes to this slice." followed by the eight items, quoted one by one in the triage below.

## What the eight exports say (profiled in the sandbox; the files stay out of the repo)

Eight METRC Michigan exports, one per license and phase, all with 1A4050 tags. Seven are plants, one is packages.

| License | Site | File | Rows | Read |
| --- | --- | --- | --- | --- |
| GR-C-001132 | PNN Med | PlantsFlowering | 48,149 | 24 strains, 702 locations named Row 86A style (lettered rows C to H), 670 plant batches, Seed 35,149 / Clone 13,000, planted 2026-05-26 to 06-09, flowering 07-30 and 08-03 |
| GR-C-001132 | PNN Med | PlantsVegetative | 204 | clones in Barn, 17 strains, 16 batches, phase 08-27 |
| AU-G-C-000832 | PNN AU | PlantsFlowering | 1,638 | 7 strains, Rows 44A to 49B, 27 seed batches of 04-28, flowering 07-30 |
| GR-C-001405 | PNS Med | PlantsFlowering | 34,445 | 8 strains, 465 locations (GH 9 to 12 plus numbered rows 186A style), 377 batches, flowering 08-03 |
| AU-G-C-001397 | PNS AU | PlantsFlowering | 2,000 | Sherbcake and Double White Dawg, GH 1 to 8, 30 batches |
| AU-G-C-001509 | ARL AU | PlantsFlowering | 10,000 | Bermuda Triangle only, four greenhouses plus East and West rows, 153 batches |
| GR-C-002600 | ARL Med | PlantsFlowering | 1,500 | Bermuda Triangle only, West 1 to 12, 15 seed batches |
| AU-G-C-000832 | PNN AU | PackagesActive | 11,742 | see below |

Plants total 97,936. Ten columns each: Tag, Strain, Location, Sublocation, Hold, Plant Batch, Plant Batch Type, Plant Batch Date, Phase Date, Harvested. No holds, no sublocations, Harvested 0 on every row. The plant batch names carry the strain and a date; the locations are the rows and houses the crew already types into an HBN's Zone and Rows fields.

The 832 packages: 22 columns (Tag, Source Harvest(s), Source Package(s), Original Source Package Label, Source Processing Job(s), Location, Sublocation, Item, Category, Item Strain, Quantity, Unit Of Measure, Production Batch Number, Source Production Batch, Lab Test Status, Finished Goods, Administrative Hold, Administrative Recall, Packaged Date, Received, Expiration Date, Lab Test Expiration). By category: Vape Cart 10,595 rows (528,439 ea), Buds (prepackaged) 511 (9,986 ea), Inhalable Compound Concentrate (each) 382 (16,850 ea), Buds 239 (2,669,054 g), Concentrate 10 (869,337 g), Shake/Trim 5 (129,150 g). Lab: TestPassed 11,566, RetestPassed 163, NotSubmitted 13. Locations: Barn 11,188, Cold Storage B 176, the warehouse slots (23.4.A, 21.2.A and 45 more of the shape building.row.side), Fulfillment 28, West Wall 23, Trim Room 8, Vault 8, Blast Freezer 4. By weight the heavy spots are Vault (1,607 lb), Fulfillment (697 lb), Trim Room (547 lb), Blast Freezer (289 lb). Nothing on hold, nothing recalled, nothing finished. 11,474 rows carry Received (the vapes and eaches came in from a processor); 268 were born here.

**Three findings that shape the slice:**

1. **METRC already speaks our HBN.** Every Source Harvest on the 832 packages is an HBN (10,334 rows hold at least one, 11,386 list several): 45951-PNN-OD-051-0-02-25162 and its kin. Thirteen packages descend from THIS season's HBNs (26001 to 26008: 46258-PNN-ID-062-0-NA-26007 and so on), packaged 2026-06-26 to 09-01, and they show the real naming the crew uses for a package's METRC Item: `WIP - Heir Heads - PNN - I` (29,220 g, Trim Room), `FFZ - Super Boof - PNN - I` (Blast Freezer), `BUD - Chem 51 - ARL - G` (22,494.92 g at 23.1.A), `TRI - Chem 51 - ARL - G` and `BIO - Biomass - PNN` (Shake/Trim, Trim Room). Their Source Package tags sit in a different tag series (1A405010...) than their own (1A405030...): the med birth and the hop to 832 that canon 0.30.1 ruled, visible in the state's own data. Our Packages from Harvests CSV writes the bare strain name in the Item column; the crew's METRC Items are `<KIND> - <Strain> - <Farm> - <Grow letter>`.

2. **The tag is the key, and we never capture it.** Our ledger (`local_inventory_items`) keys packages by the internal code (the lot serial, `-B` for the bucked child, whatever the trim room types); no column holds a METRC package tag. Every METRC-facing file therefore prints the internal code where the state wants the 24-character tag: the manifest's package.Id, the Packages from Harvests Tag, the adjustment Label, the finish Label, the labels node's barcode. Patrick's second and sixth items, and half of his third, are this one gap seen from three stations.

3. **Zoho and METRC disagree, and the slice can say by how much.** Reading his `Item 2.csv` (the 0.30.36 export) against the 832 packages: 1,015 of the 1,107 offerings carry a METRC-shaped SKU (92 are branded text SKUs; the 0.30.36 report's 100 was a rounder count). Of the 1,015, only 257 are active 832 packages today (239 with quantities that agree, 18 that do not); 758 are not (about 545 lb of Zoho stock, 555 of the rows sitting at Head Office in Zoho, mostly 2025 outdoor MIX and BUD created in Zoho November to February). Either those live under a license whose packages were not dropped, or Zoho still shows stock METRC has closed. From the other side, 10,595 vape carts, 399 prepacks and 382 concentrate eaches in 832 have no tag-level Zoho row at all: Zoho carries finished goods by branded SKU, not by tag. The first live METRC drop settles which.

## The Scribe's reading of the record (for his ruling, not built)

The METRC row is the spine and the tag is its key: one table for plants (the ten columns as METRC states them, plus the license and the mount that last saw the row) and one for packages (the twenty-two columns, plus the same), both fed by a drop lane like the Zoho tab (the export is the truth of METRC as of the drop; a newer drop updates in place, marks gone rows, never edits history). Our own fields hang off the tag in a third table (`field_key`, `value`, keyed by tag), with the field list itself a lookup in Admin (name, kind, applies to plants or packages): that is the "stretching" he named, done without a migration per field and under L-4, values live in data. The ledger meets the mirror through one new column, `metrc_tag` on `local_inventory_items`, once the tag law below gives the crew a place to type it; then every ledger row can say what METRC calls it, and the floor can flag ours-not-in-METRC and METRC-not-in-ours.

## Patrick's eight, triaged against the code

1. **"If you export the harvest CSV for harvest, it assumes that each wet weight entered = 1 plant. It would be better if it asked how many plants were harvested after the you finish entering wet weights."** Read: true as he sees it. With no plant tags saved on the batch the wet weights file is one row per scale read with the Plant column blank (owner ruling 2026-08-31, pending the fill rule); with tags pasted on /admin/uploads the file becomes one row per tag with the weights split by the seeded jitter law. So the count IS the number of tags, and the paste lives two screens from the crew. A count alone cannot make a valid file, because METRC wants a plant tag on every row. The plants exports change this: with the plants mounted, Finish lot can ask "how many plants were harvested" and pick that many tags from the mounted plants at the batch's license and strain (and rows, when typed), writing them to `harvest_plant_tags` so the file is right without a paste. FORK F6.

2. **"Manifest CSV export uses HBN where package tag belongs."** Read: confirmed at the root. The harvest package's `package_code` is the lot serial (`lotPackageCode` = `shortLotId`, the last five of the HBN) and `buildManifestCsv` writes `item.package_code` into package.Id. There is no METRC tag to print. THE TAG LAW, FORK F4.

3. **"In the trim room, if package code means tag #, please use tag number instead of package code, that will confuse the team. If package code does not mean tag #, what does it mean?"** Read: it is whatever the crew types. The field is free text (`wip_packages.package_code`); it becomes the ledger child's code (canon 0.30.26) and the labels node prints and barcodes it under the heading "Package tag"; nothing checks it against METRC. In the state's data the trim room's outputs are METRC packages (`WIP - Heir Heads - PNN - I`, 29,220 g), one package per big lot, while Patrick's crew types one row per tote. Whether the trim row is a tote with an internal code or a METRC package with a tag is his to name. FORK F5, tied to F4. Not relabeled here.

4. **"Shake is not an option in the drop-down menu in the trim room ."** FIXED: migration 0040 seeds SHAKE (not bud, so it queues like SMALLS; outside the extraction pool, which stays TRIM,BIO per his 2026-09-01 word and is one Admin edit away).

5. **"In the trim room, if you enter all your entries = all the source package weight (if the wip package = 1,000 pounds and all the trim weights = 1,000 pounds) you get a pop up warning that you have entered more weight than is in wip."** FIXED: THE OVERISSUE LINE IS STRICT. Three guards asked at "greater or equal": the trim [+], the marketplace split [+], and the weights pane (its standing banner read "Over issued by 0.00 g" at an exact match). All three now fire only past the parent, beyond half a cent of float noise (`isOverIssued`, `OVERISSUE_TOLERANCE_GRAMS` in config.ts). Flag, never block, as before. The Remaining 0 prompt with Remove from queue (canon 0.30.9) is untouched.

6. **"For wet weights, dry weights, and trim, you enter 1 tote weight at a time. In Cryo you enter one weight per bud wip. I think there should be two entries for cryo, new package tag and weight, so that you are entering each packages tag # and 22679g (or whatever the weight is) for each final package. Then you could generate a csv and makes those packages and assigns those tags."** Read: a re-raise of the cryo question he answered on 2026-09-07 (canon 0.30.1, ruling 9: "Leave that the way we have it.  He doesn't know that cryo was creating its own packages last year."), now with a concrete shape: tag plus weight per final package, a Packages CSV that creates them. It converges with the tag law. FORK F7; the ruling stands until he moves it.

7. **"Saleshelper is still splitting prepack packages."** Read: SalesHelper is a vendored app here (its `menu.json` and pages are never edited in place); the behavior lives in its own folder. Owed to that repo; logged, not built.

8. **"When you generate an HBN using ARL's med license, when you go to interco logistics, that harvest is listed under ARL's AU license."** Read: by design, his own. Canon 0.30.1 ruling 2 ("Do both in one step, but just make sure that the METRC side isn't skipped."): a med-born harvest package hops to the farm's AU license at Finish lot with a completed virtual movement and its pended paperwork. While the lot is still weighing it lists under GR-C-002600; the moment it finishes it lists under AU-G-C-001509 with the equivalent transfer recorded. The code paths agree (`inheritedLotLicense` for lots, `equivalentTransferStmts` at finish). A one-line hint on the package row ("born GR-C-002600, hopped by equivalent transfer") would tell the crew what happened; offered as F9, not built.

## The fork sheet

- **F1 The record.** METRC mirror tables (plants, packages) keyed by tag as the spine; internal fields as an Admin-registered list with values keyed by tag (stretch without migrations), versus a typed column per field (a migration each). Scribe default: the registry.
- **F2 The mount lane.** A METRC exports drop on the Inventory node, like the Zoho tab: PackagesActive per license, PlantsFlowering and PlantsVegetative per license; the file name carries the license and kind (MetrcMichigan<license><kind>), so a drop knows its own license. His exports are xlsx; the Worker would need a small xlsx reader, or METRC's CSV export of the same grid would spare the CPU. Ask: can the crew export CSV? Scribe default: accept both, prefer CSV.
- **F3 The first internal fields.** From the data: our location code (the warehouse slots versus METRC's one word), quality grade (Zoho's CF.Product Quality), market strain, the Zoho SKU link, THC (Zoho's CF.THC %), intended lane (bulk, prepack, extraction), notes and holds. Which first is his.
- **F4 THE TAG LAW.** `metrc_tag` on `local_inventory_items`, optional everywhere, flag never block, shape checked softly (1A plus 22 hex); captured where METRC assigns it: at Finish lot when the crew has the tag, at the virtual receipt where the 832 tag mints (canon 0.23.1), at cryo for final packages, in the trim room if F5 says the row is a package. The manifest, Packages from Harvests, adjustment and finish files print the tag when present and otherwise print the internal code and mark the row "no METRC tag yet" on /admin/uploads. The Packages from Harvests Item column takes the crew's `<KIND> - <Strain> - <Farm> - <Grow letter>` pattern.
- **F5 The trim row's name.** Tote with an internal code, or METRC package with a tag. The labels node already calls the field the tag and barcodes it.
- **F6 Plants count at finish.** After F2: Finish lot asks how many plants were harvested and picks the tags from the mounted plants at the batch's license and strain (rows when typed) into `harvest_plant_tags`; the wet weights file is one row per plant with no paste.
- **F7 Cryo final packages.** His 2026-09-07 ruling stands unless he reverses it; Patrick's shape (tag plus weight per final package, a Packages CSV) is ready to build under F4 if he does.
- **F8 SalesHelper prepack splitting.** Owed to the SalesHelper folder.
- **F9 The hop hint.** One line on a hopped package's floor row naming the birth license and the equivalent transfer.
- Standing from 0.30.36: the FG picture refresh from the Zoho drop, the placeholder threshold and the 70 g Max Out Bag, the Zoho location fence.

## Sealed final check

```
cd /home/claude/deploy/app
npx tsc --noEmit                      -> exit 0
npx vitest run                        -> Test Files 20 passed (20), Tests 508 passed (508)
Dash audit (8 authored files + this report) -> 0 each
SMOKE_PORT=9793 WRANGLER_SEND_METRICS=false timeout 285 npm run smoke
                                      -> SMOKE PASS, "About to apply 40 migration(s)" from zero
Smoke pins added: the trim type list offers SHAKE and Admin lookups list it;
  the trim [+] guard reads strictly greater and the old form is gone; the
  unload guard lot's dry weights 40 + 50 land exactly on its 90 g parent with
  no standing banner and the strict ask on the form, then 60 more raises it.
Unit pins added: gate.test (exact total, no banner; one cent over, banner
  "0.01 g"; the ask strictly greater), trim.test (the [+] guard string,
  isOverIssued at equal / +0.004 / +0.01, SHAKE in the type options),
  business_ops.test (the split [+] guard string).
Visual pass (wrangler dev on the smoke DB, co view): Admin lookups Package
  Types lists BIO, BUD, SHAKE, SMALLS, TRIM, WASTE; the trim room's type
  options read BIO, BUD, SHAKE, SMALLS, TRIM, WASTE; the picked unload pane
  carries the strict ask and no banner.

src/html.ts 23013883c27c4607               src/marketplace.ts 3e0b8b4d62317b64
src/config.ts 96aa72dc817177be             migrations/0040_shake_package_type.sql b89b6d28e61a9bab
test/gate.test.ts 4ce2d0f514137f38         test/trim.test.ts b973869b7401a062
test/business_ops.test.ts d39f71acdcc45a18 scripts/smoke.mjs 0a21ee8957b47bdf
```

Worker plus migrations 0039 and 0040: the apply step is live, so the probe must answer green first; the fast lane does not apply. Live underneath: worker 26ae0cb0, migrations 0001-0038. Owed from the owner: the grant fix result, then this deploy's version id (the apply will say 2 migrations); his word on F1 to F9; the first live Zoho drop and its counts; everything on the standing list.
