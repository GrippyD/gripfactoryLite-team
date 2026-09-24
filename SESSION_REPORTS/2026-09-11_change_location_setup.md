# Session report: THE CHANGE LOCATION SETUP (canon 0.30.40), Scribe-direct, 2026-09-11

**Scribe:** Gripfactory Lite Scribe (Cowork), Scribe-direct under G-2. One owner ruling, one slice, worker plus migration 0043.

## The owner, verbatim

"Create the "Change Location" setup

Toggle plants/packages

Select a farm
Select a license
Select Package
 to/from:

Seed Locations

Field Locations (plants):

1. ARL
   1. List the rows and GHs that you see from the reports
   2. Barn
2. PNS
   1. Same
3. PNN
   1. Same

Inventory Locations (packages)

1. ARL
   1. Barn
2. PNS
   1. Barn
3. PNN (All licenses)
   1. Barn
   2. Blast Freezer
4. PNN (just the processor)
   1. CSB
   2. Trim Room 1
   3. Trim Room 2
   4. Trim Room 3 ... all the way to 12
   5. Cryo - 1 through 4
   6. All the rack locations listed (there 6 racks each with two sides (1-12).  There are 4 stanchions on each rack piece (1-4). There are 4 levels (a-d).  So 1.3.c is the first side of the first section of racking, the second stanchion (or space between uprights) and the third level.
   7. Concentrate Vault
   8. Prerolls 1-5
   9. Testing
   10. Fulfillment
   11. On Hold
   12. Trim Trailer 1-8
   13. Consumables

An Execute button
A warning

All movements are within the license itself, so the CSV is for a location change, not a transfer manifest."

## What shipped

**The page** (`/inventory/change-locations`, the Inventory node's first reserved tile, now built; behind the node's PIN): the Plants / Packages toggle, the farm, the license (every site line for packages; plants never under the processor), then the pick. Packages: type or scan a tag or code, or pick from the ledger's packages under that license; the pick resolves through the ledger's METRC tag, then its internal code, then the METRC mirror's tag. Plants: a plant tag, or every plant standing at a location (the mirror's locations with counts). The card shows what it is and **From** (where it stands now), offers **To** from the license's locations without its own spot, a move date defaulting to today, the warning, and **Execute** behind a confirm. Recent moves list beneath with their files.

**THE MOVE LAW:** a move never leaves its license. Execute records the move in `location_changes` (one group per Execute), writes the new location onto the ledger item and onto the METRC mirror row (the crew's move is the truth on the ground; the next METRC drop re-asserts the state's, so a file left unuploaded shows up as a difference), and pends the METRC Location Change file on Pending Data Uploads under Location changes, one export home, beside the silo loads. Packages print the METRC tag when the ledger holds one and the internal code otherwise (THE TAG LAW marks the row `no METRC tag yet`); plants print their tag; the Location column prints the location's label, METRC's own word (Barn, not BARN). Marking the file uploaded clears the row.

**The seeds (migration 0043):** `lookup_values` gains `license_value` (blank = every license at the farm). **Field locations** (plants), a new lookup category, per license exactly as METRC names them in his exports of 2026-09-11 ("List the rows and GHs that you see from the reports"), plus Barn at every license: AU-G-C-001509 136 (East 1 to 86, West 1 to 66, the four greenhouses) + Barn; GR-C-002600 West 1 to 21 + Barn; AU-G-C-001397 GH 1 to 8 + Barn; GR-C-001405 465 (1A to 199A, the lettered rows, GH 8 to 12) + Barn; AU-G-C-000832 Row 34A to 50A + Barn; GR-C-001132 703 (Row 1B to Row 96H and Barn). 1,368 rows. **Inventory locations** (packages) follow his list: the site barns stand (ARL BARN, PNS BARN, BARN at PNN for every license); Blast Freezer at PNN for every license; CSB scoped to the processor; and under AU-P-000694: Trim Room 1 to 12, Cryo 1 to 4, the rack grid, Concentrate Vault, Prerolls 1 to 5, Testing, Fulfillment, On Hold, Trim Trailer 1 to 8, Consumables. 227 rows. Every seed is a lookup row, editable in Admin, Data Lookups (Inventory Locations, and the new Field Locations beside it), where the add form now asks the license scope.

**The rack grid, the Scribe's reading (flagged):** 6 racks with two sides make sides 1 to 12; 4 stanchion bays 1 to 4; levels a to d; coded `side.bay.level`, 192 slots, 1.1.a to 12.4.d. His example "1.3.c is the first side of the first section of racking, the second stanchion (or space between uprights) and the third level" reads as side 1, bay 3, level c; the word "second" in it does not fit the number 3, so the grid is seeded whole and he can retire what the floor does not have.

**The plants file shape (flagged):** METRC's plants location change is written `Plant,Location,Sublocation,ChangeDate`, provisional like the package header of canon 0.30.6 (`Label,Location,Sublocation,MoveDate`); the real templates are on his owed list and swap in one edit each.

## Sealed final check

```
cd /home/claude/deploy/app
npx tsc --noEmit                      -> exit 0
npx vitest run                        -> Test Files 22 passed (22), Tests 537 passed (537)
Dash audit (17 authored files + this report) -> 0 each
SMOKE_PORT=9800 WRANGLER_SEND_METRICS=false timeout 285 npm run smoke
                                      -> SMOKE PASS, "About to apply 43 migration(s)" from zero
Smoke pins added: the page answers with the toggle and the scope form and no
  reserved line; Inventory Locations seed the Blast Freezer, Trim Room 1 and
  12, Cryo 4, 1.1.a, 1.3.c, 12.4.d, the Concentrate Vault, Prerolls 5,
  Testing, Fulfillment, On Hold, Trim Trailer 8, Consumables, the grid at 192
  slots, the processor's license on its rows, the license scope on the add
  form; Field Locations seed West 1 and 21, GH 1 and 12, Row 34A and 96H,
  199A, SW Greenhouse, East 86, a Barn per license; Data Lookups links Field
  Locations; the tagged truck package under 832 lists in the ledger pick,
  resolves from the ledger, reads From BARN, is offered the Blast Freezer and
  not the processor's rooms or its own spot; a destination outside the
  license 400, its own spot 400, an unknown package 404; the move flashes
  Moved 1 package to Blast Freezer, the ledger and the mirror both read Blast
  Freezer, the export home lists the Execute as a Package location change,
  the file carries Label,Location,Sublocation,MoveDate with the tag, the
  METRC word and the date, named by kind, license and date; the two plants at
  West 3 under GR-C-002600 read as one act of 2 with West 4 and Barn offered
  and West 3 not, move together, West 4 holds 3 and West 3 empties, the file
  carries Plant,Location,Sublocation,ChangeDate with both tags; an empty row
  404; one plant by tag moves to Barn and its mirror card reads Barn; plants
  under the processor 400; the mark clears the package Execute and keeps the
  plants one; Recent moves lists the plants Execute.
Unit pins: test/locations.test.ts (10: the toggle and farm parsing, plants
  off the processor, the license-scope filter, the Admin registration, dates
  and the plants file shape and the file name, the page before a pick, the
  found package with From and the To pick without its own spot and the
  warning and Execute, the untagged and unresolved states, the plants bulk
  card with the count and the from-METRC destinations and the toggle dropping
  the processor for plants, the flash and recent list, the export home rows).
Visual pass (wrangler dev on the smoke DB, co view): the Packages card for
  the truck package with From, To, Move date, the warning banner and the
  Execute button, Recent moves beneath; the Plants scope for GR-C-002600.

src/locations.ts fb8ccf93359959bf           src/locationpane.ts b63cb50066bb3029
src/config.ts bff7599650277346              src/html.ts dee1813ecdbb0f0a
src/actions.ts 11426d240a20ae18             src/db.ts c3b3ad6ffd19d6d1
src/csv.ts 1ea33f01c7534ad7                 src/pipeline.ts ea0d97fa0f4b272d
src/index.ts 5362fdbff547419a               src/i18n.ts 36d496bf911a1082
src/lookups.ts cd003b82fd1e3af4             src/pages.ts 9e0a2bc27821e5b7
migrations/0043_change_location.sql da91a0d49dea4c08 (326,597 bytes)
test/locations.test.ts 16a7b17dd7dd375a     test/inventory.test.ts 74de6d6d82f6a918
test/surface.test.ts df8aa1906f94aafd       scripts/smoke.mjs e1471b8719fd32c2
```

## Forks left standing

The rack grid reading above; the plants file header (the templates owed); whether CSA keeps a place (his list does not name it; the row stands in Admin untouched and is offered to nothing new); the three 0.30.36 Zoho forks and the 0.30.38 forks (F3 fields, F6 plant count at Finish lot, F7 cryo, F8 SalesHelper, F9 hop hint, the Packages from Harvests Item pattern).

Worker plus migration 0043: the probe must answer green first; no fast lane. Live underneath: worker 0828ef29, migrations 0001-0042. Owed from the owner: the deploy id (the apply will say 1 migration), his first live moves and the first live METRC and Zoho drops with their counts, his word on the standing forks.
