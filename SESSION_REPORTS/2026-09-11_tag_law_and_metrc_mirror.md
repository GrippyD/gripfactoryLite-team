# Session report: THE TAG LAW and THE METRC MIRROR (canon 0.30.38), Scribe-direct, 2026-09-11

**Scribe:** Gripfactory Lite Scribe (Cowork), Scribe-direct under G-2. The internal inventory slice, built on the owner's four fork answers of the same afternoon. One slice, worker plus migrations 0041 and 0042; they ride with 0039 and 0040, so the apply will say 4 migrations.

## His four answers (the question tool's labels, verbatim)

- F4, THE TAG LAW: **"Optional tag everywhere (Recommended)"**
- F1, the record: **"Mirror + field registry (Recommended)"**
- F5, the trim room's code: **"The METRC package tag"**
- F2, the mount format: **"Both"**

## THE TAG LAW (migration 0041)

`local_inventory_items.metrc_tag`, optional on every package. The METRC package tag (1A plus 22 hex, `METRC_TAG_RE` now in config.ts) is captured wherever METRC assigns it, never required, never refused:

- **Finish lot** (wet): a `METRC package tag (optional)` box beside the Finish lot button; the born package carries it; a tag typed on a re-finish lands with a log.
- **The arrival receive**: the one-button truck receive and the per-item Confirm receive carry the box; a tagged item shows its tag instead. A pre-spine lot minting at receipt takes the tag at birth.
- **Cryo**: a box per package whose trim code is not a tag; a tagged package reads `Tagged`. Ruling 9 of 0.30.1 (cryo unchanged) stands: the weight per WIP package is what it was.
- **The trim room** (his F5): the code the crew types IS the tag. The column heads `Package tag`; a tag-shaped code lands as the ledger child's `metrc_tag` at the cut and follows the pencil; a code that is not tag-shaped is kept as typed and marked `?` with a hover note. The migration backfills existing children whose codes already read as tags.
- **The pencil** on any ledger package: `METRC package tag`, the universal capture point, with a reason.

THE FILES PRINT THE TAG: `metrcFacingTag` (tag when present, internal code otherwise) rules the manifest's package.Id (Patrick's #2), the receive manifest, Packages from Harvests (the -B child's tag via `getBuckedChildForLot`), Package Adjustments, the finish file, the location change, the split file, and the labels node's barcode. `/admin/uploads` marks every file that would still print an internal code with `no METRC tag yet` (`listTagGaps`: movements, batches, split parents). The Local inventory table gains a METRC tag column and says `no METRC tag yet` where it is missing.

## THE METRC MIRROR (migration 0042)

**The reader** (`src/metrc.ts`): METRC's xlsx as exported (a zip of XML: shared strings, one sheet, dates as serials under numFmt 14, booleans, blank cells) or the CSV of the same grid, told apart by the bytes. The zip is walked from its central directory; entries inflate through `DecompressionStream("deflate-raw")`; the worksheet streams row by row, so a 48,149-row plants file never sits in memory whole. No library. The file name gives the license and grid (`MetrcMichigan<AUGC|AUP|GRC><6 digits><Plants|Packages><grid>`), the header gives the kind, the form can name the license and the phase when the name does not.

**THE MIRROR LAW:** the export is the truth of METRC as of the drop for its license (and phase, for plants). A tag the mirror has never seen is added; a row whose columns moved, or that had been marked gone, or whose phase changed, updates in place; a row the file no longer carries is marked gone (only rows in the drop's own phase can go missing from it). Multi-row inserts stay under D1's 100 bound parameters (6 plants or 3 packages per statement), statements batch in chunks of 400, and the mount row leads the batch so a failed chunk still leaves the drop on record. One log row per mount, never one per plant: the mirror is the state's data, not ours.

**The record:** `metrc_plants` (ten columns as METRC states them plus license, phase, mount, first seen, changed, gone) and `metrc_packages` (twenty-two plus the same), keyed by tag. **Our fields** hang off the tag in `internal_field_values`; the registry is the lookup category `internal_field` (Value the key, Label the name, Tone what it applies to: plants, packages, or blank for both), in Admin, Data Lookups, Inventory, Internal fields, so a new field is a row, not a migration. Seeded (his F3 to amend): Location code, Quality grade, Market strain, Zoho SKU, Intended lane, Notes.

**The pane** (`/inventory/metrc`, the METRC Mirror tile on the Inventory node, behind the node's PIN): what the mirror holds per license (plants flowering and vegetative, packages, grams, eaches, newest mount); **Three pictures** (ledger packages with a tag against the mirror: in METRC, gone, unknown; ledger packages without a tag; METRC active packages and how many the ledger has not claimed; Zoho offerings with a METRC SKU against the mirror: in METRC or not, the reconciliation this morning's research did by hand); a tag lookup that shows the record in METRC's own column names with our fields beneath, each set with a reason and logged; the drop form; the mounts.

## The owner's eight exports through the reader (sandbox only, never vendored)

| File | Rows read | Shaped | Read | Shape |
| --- | --- | --- | --- | --- |
| GRC002600 PlantsFlowering | 1,500 | 1,500 | 275 ms | 16 ms |
| AUGC000832 PackagesActive_12 | 11,742 | 11,742 | 756 ms | 153 ms |
| AUGC000832 PlantsFlowering | 1,638 | 1,638 | 79 ms | 3 ms |
| GRC001405 PlantsFlowering_2 | 34,445 | 34,445 | 1,140 ms | 189 ms |
| GRC001132 PlantsVegetative_6 | 204 | 204 | 9 ms | 14 ms |
| GRC001132 PlantsFlowering_2 | 48,149 | 48,149 | 1,133 ms | 203 ms |
| AUGC001509 PlantsFlowering_3 | 10,000 | 10,000 | 188 ms | 44 ms |
| AUGC001397 PlantsFlowering_2 | 2,000 | 2,000 | 43 ms | 4 ms |

Every count equals the morning's profile; the dates decode (2026-05-27, 2026-08-03); the packages' categories total exactly as before (Buds 239 rows, 2,669,054.4 g). Node timings; the Worker is the same engine. WATCH on the first live drop of the big plants files: 48,149 plants are 8,025 insert statements in 21 batches; if the drop answers a 500 or times out, the account's Workers CPU limit is the first suspect (the D1 writes, not the parse), and CSV is the lighter format.

## Sealed final check

```
cd /home/claude/deploy/app
npx tsc --noEmit                      -> exit 0
npx vitest run                        -> Test Files 21 passed (21), Tests 527 passed (527)
Dash audit (24 authored files + this report) -> 0 each
SMOKE_PORT=9797 WRANGLER_SEND_METRICS=false timeout 285 npm run smoke
                                      -> SMOKE PASS, "About to apply 42 migration(s)" from zero
Smoke pins added: the wet lot page's tag box and the born package carrying
  the typed tag; the adjustment file's Label printing it; the export home's
  "no METRC tag yet" mark; the trim room's Package tag heading and the
  shape note on non-tag codes; the truck receive box, the received package
  showing its upper-cased tag, the receive manifest printing it; the METRC
  Mirror tile; the empty pane, the seven licenses on the form, the six seeded
  fields and the Applies-to box in Admin; a plants xlsx built with real
  deflate (3 rows, one hold, dates as serials) mounting 3 added; a packages
  CSV mounting 3 added with 836.00 g and 1,234 eaches; the ledger's tagged
  package and the Zoho bulk SKU reading in METRC; the re-drop reading 0
  added / 1 updated / 1 gone, the gone row keeping its card with a gone date,
  the moved row at 480.00 g; a field set refused without a reason, saved
  with one, refused for an unregistered field and an unknown tag; the plant
  card reading the hold, the batch date and only plant-scoped fields; a Zoho
  export refused, a nameless drop refused, a plants CSV refused without a
  phase and mounted once the phase is picked.
Unit pins: test/metrc.test.ts (19: the file names; the zip walk, shared
  strings, booleans, built-in and custom date styles, blanks, inline strings,
  stored and deflated; the CSV path; kinds; shaping with US dates, quoted
  lists, thousands, case-folded duplicates; the mirror diff with phase scope;
  the 100-parameter law; field scoping; the pane's empty state, lines,
  mounts, flash, package and plant cards; the tag law's shape, normalizing,
  printing, the finish mint, the wet lot box, the trim heading and shape
  note, the cryo boxes, the export home marks); strapin.test (the Inventory
  landing category and the internal_fields section).
Visual pass (wrangler dev on the smoke DB, co view): the METRC Mirror pane
  with three license lines, the three pictures, the lookup, the drop form and
  four mounts; the tag card in METRC's column names with Quality grade A;
  the cryo pane's METRC package tag column; the Inventory tiles; the export
  home marks; the Internal fields registry.

src/metrc.ts 473dc603799cd135           src/metrcpane.ts 0222be16a6688769
src/config.ts b55cd106e3189989          src/html.ts c610263e6420ccdf
src/actions.ts 352ee6b67d001c34         src/db.ts ad42d6882e51d390
src/ledger.ts 23c4d144606692e8          src/pipeline.ts 6a1e8f40efcabac8
src/index.ts 35297a66399d7a6e           src/i18n.ts a3a9349b57ffcef1
src/lookups.ts 023a870e4f1b190b         src/pages.ts 8c39583770b9479e
src/theme.ts cdea2f7e697381ff           src/zohoinv.ts 642bee5342ed0dfa
migrations/0041_metrc_tag.sql b2c1da3c6d99ad88
migrations/0042_metrc_mirror.sql 20866e418ccf371c
test/metrc.test.ts 23a0860061001e49     test/strapin.test.ts eec28b5e0d45d709
scripts/smoke.mjs b25d87dc9e2d5598
```

## Forks left standing

F3 the first fields (six seeded, his to amend in Admin); F6 the plant count at Finish lot picking tags from the mounted plants (build on his word, the plants are now mountable); F7 cryo final packages (0.30.1 ruling 9 stands); F8 SalesHelper prepack splitting (its own canon, §4 and §5); F9 the hop hint; the three 0.30.36 Zoho forks. New from this build: the Packages from Harvests Item column still writes the bare strain name where the crew's METRC Items read `KIND - Strain - Farm - Grow letter`; one word makes it the pattern.

Worker plus migrations 0039, 0040, 0041, 0042: the probe must answer green first; no fast lane. Live underneath: worker 26ae0cb0, migrations 0001-0038. Owed from the owner: the grant fix result, the deploy id (the apply will say 4 migrations), the first live METRC drops (packages 832 first, then the plants files, CSV if the xlsx drop strains), the first live Zoho drop, his word on the standing forks.
