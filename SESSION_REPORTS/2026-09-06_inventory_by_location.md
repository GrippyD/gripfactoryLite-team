# Session report: Inventory by Location and the one-barn-block fix (canon 0.27.0), Scribe-direct, 2026-09-06

**Scribe:** Gripfactory Lite Scribe (Cowork), Scribe-direct under G-2. Two owner messages in one sitting: the report ruling ("Add a report: Inventory by location. Just make it totals be product type, grouped by location grouped by farm. Field locations, greenhouses, and barn should be visible only if there's material in them. Farms and locations within them should have an admin field if they don't already.") and the floor absurdity report with his screenshot ("ARL shows nothing in the barn, and then lists a lot immediately below").

## What shipped

1. **Migration 0029** (`0029_location_farms.sql`): `lookup_values` gains `farm_code`; the known geography seeds (BARN, CSA, CSB to PNN; ARL BARN to ARL; PNS BARN to PNS; IN-TRANSIT stays shared). Farms were already Admin-editable, so only locations needed the field. This column is also the data rail for the flagged origin-location seam fix, when the owner calls it.
2. **The Admin field**: the Inventory Locations lookup page shows a Farm column, its add form offers a farm select ((shared) allowed), addLookupValue carries it, and the reasoned Edit offers farm_code (EDITABLE_FIELDS). The location convention blurb moved to the page title per the hover law, along with four straggler admin blurbs (lookups landing, People, Farms, App config).
3. **The report**: Inventory by Location joins /reports (no PIN, per the standing word) in all three formats. Rows read farm, location, product type, total, uom, ordered farm then location then kind, so the grouping is the row order in every format. The farm is the location's Admin assignment when set, else the item's own farm (in-transit rides under its origin farm). THE VISIBILITY LAW is the query's HAVING: locations render only while material sits in them, so fields, greenhouses, barns, and any spot the owner adds appear exactly when occupied.
4. **The one-barn-block fix**: the floor's site panels rendered two stacked lists (ledger packages, wet lots) with independent empty lines, producing "No packages in this barn." directly above a listed lot. A barn is ONE block now: both kinds ride one list with continuous numbering, and exactly one empty line ("Nothing in this barn.") renders only when the barn holds nothing at all. The Send pane keeps its labeled sections.

## Sealed final check

```
cd /home/claude/deploy/app
npx tsc --noEmit                      -> exit 0
npx vitest run                        -> Test Files 15 passed (15), Tests 404 passed (404)
node --check scripts/smoke.mjs        -> ok
Dash audit (11 touched files)         -> 0
rm -rf .smoke-persist && SMOKE_PORT=9063 WRANGLER_SEND_METRICS=false timeout 280 npm run smoke
                                      -> SMOKE PASS, "About to apply 29 migration(s)" from zero
Smoke walks added: the report page, csv, and xlsx answer 200 with the Product
  type column; the locations admin carries the farm column and select; the
  floor carries no split-brain empty lines.

migrations/0029_location_farms.sql  afb0f8e5aa5abec0
src/actions.ts   276d44e191035be3    src/pages.ts    60ae6d3e3d1753e7
src/pipeline.ts  ed2a610a80d93dad    src/db.ts       deadbfe0a1a4d2af
src/reports.ts   759f648942d2c60f    src/index.ts    e0995e2909bd129b
src/i18n.ts      e867554bd7eb4a36    src/html.ts     b0e558516a9e037f
test/strapin.test.ts beb00dfc91e18f0a scripts/smoke.mjs 0d5fe439b3754fdc
```

Worker plus one append-only migration (0029). Owner deploys by PS. Never c10. TBD ids stay TBD.
