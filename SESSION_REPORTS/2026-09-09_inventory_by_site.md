# Session report: Inventory by Location heads by site (canon 0.30.23), Scribe-direct, 2026-09-09

**Scribe:** Gripfactory Lite Scribe (Cowork), Scribe-direct under G-2. The owner's report, with his live Inventory by Location screenshot (ARL / Silo 1 / WIP 2,000,000.00; ARL / Silo 2 / WIP 1,200,000.00; PNN / BARN / WIP 492,000.00), verbatim: "There is another problem: the origin farm is listed as farm in the report.  The current farm should be the header the list is sitting under.  I'm good with the farm of origin on the report, but I hope you understand the supply chain well enough to understand what's wrong with the picture". Worker only; no migration.

## What was wrong with the picture

The silos are Penn North's (the 832 side: Building 24, the silos, CSA). Material harvested at Arlington rides the truck to the PNN barn and is loaded into a PNN silo; it never stops being ARL material, but Silo 1 never becomes an ARL location. The report keyed its Farm column on the inventory item's `farm_code`, which is the batch's ORIGIN farm, so two tonnes of ARL bud sitting in PNN's Silo 1 read as "ARL, Silo 1": a silo that does not exist. The supply chain converges: three farms harvest, everything wet lands in the PNN barn, the silos dry it, CSA stages it, the processor takes it. A location's farm is the site it stands at; the origin travels with the material as provenance.

## What shipped

1. **Site is the header; origin farm is a column.** `InventoryByLocationRow` gains `site`. `siteForLocation` resolves it from the code's side convention first (BARN, CSA and the five silos are PNN; ARL BARN and PNS BARN their sites; CSB the processor), then the Admin inventory_location farm, then a dry space's farm scope (Arlington Dry Room reads ARL), then IN-TRANSIT for the road; a location nobody placed reads "(unassigned)" rather than borrowing the material's origin. The ledger query groups by origin farm, location, kind and unit; the WET fold keys on site and origin too. Rows sort site, location, origin farm, kind.
2. **The grouped report.** `ReportView.groupBy` (new, generic): the page and the PDF head each run of rows with the group value (`tr.report-group`, `data-report-group`) and drop that column from the row cells; the CSV and XLSX keep it as a plain first column, so a spreadsheet still sorts and filters on it. Inventory by Location groups by Site and reads Site, Location, Origin farm, Product type, Total, UOM. The owner's picture now reads PNN as the header with Silo 1 / ARL, Silo 2 / ARL and BARN / PNN beneath it. Footnote: "Site is where it sits now; origin farm is where it came from."

## Sealed final check

```
cd /home/claude/deploy/app
npx tsc --noEmit                      -> exit 0
npx vitest run                        -> Test Files 19 passed (19), Tests 484 passed (484)
Dash audit (6 touched text files)     -> 0
SMOKE_PORT=9592 WRANGLER_SEND_METRICS=false timeout 285 npm run smoke
                                      -> SMOKE PASS, "About to apply 38 migration(s)" from zero
Smoke pins changed: the CSV leads Site,Location,Origin farm,Product type,Total,UOM
  (the truck lot born ARL,ARL BARN,ARL,WIP; the med lot PNN,BARN,PNN,WIP; the
  loaded lot PNN,Silo 4,PNN,WIP; receives PNN,BARN,<origin>,SPR); the page
  heads PNS and PNN runs (data-report-group), rows read location, origin,
  kind; no silo reads as an ARL location; the WET double-fold guards stay.
Unit pins: strapin.test.ts (the view's columns and groupBy; page and PDF head
  each site once and keep it out of the cells while the CSV keeps the column;
  siteForLocation's order of resolution; the fold keyed on site and origin).
Visual pass (wrangler dev on the smoke database): ARL, IN-TRANSIT, PNN, PNS
  headers; Arlington Dry Room under ARL; ARL and PNN material under PNN with
  the origin beside each row.

src/db.ts f4eae38247d33dd5        src/reports.ts 8622e184831bd860
src/html.ts ebc1a893a8bd5805      src/theme.ts 0cac9ddff895f3e7
test/strapin.test.ts 5073dcfa3686ae3b   scripts/smoke.mjs 0c7a9b3f65cd4fbd
```

Worker only; rides the pending deploy (worker plus migration 0038). Never c10 deploy. Still open from 0.30.19: R2, the Load Silo barn pane ("these aren't in barn"); the Scribe needs that screen. Owed from the owner: that picture or word; his deploy id; a real Zoho export mounted live; the Athena logo; T1 Transport vs T1 Logistics; the METRC templates; the harvest purge counts or the narrowing word.
