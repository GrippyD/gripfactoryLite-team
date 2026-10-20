# DD S3d: Plant Weight replaces Testing turnaround

Filed by the Scribe on 2026-10-19 (canon 0.30.518) from the owner's word: "Testing Turnaround: bump and replace with Plant Weight". His mock: four drop downs (Period, Strain, Farm, Grow Method) and three boxes, "[Lbs/Plant] based on selections", "[AVG Lbs/Plant] based on selections", "[Projected Lbs/Plant] based on selections". The mock's label line repeats "% Complete (By Plant Count)" from the last mock; the Scribe reads the title as his heading, Plant Weight. Colors: our themes.

His picks (2026-10-19), after the Scribe named the sources (the console's dry per plant, 4.39 lb HTD on the 10-17 snapshot, PNN 4.99, PNS 3.74, ARL 4.03; wet 18.72; the planned harvest.ppp_dry_lb with harvest.ppp_wet_lb as its companion; his 10-15 rulings ppp_basis dry and projected_basis estimates):
- Dry pounds per plant at 448 g, the console's dried lot law. Keep the planned PPP tiles on the list, untouched.
- The boxes: Lbs/Plant over the lots in the picked period; AVG Lbs/Plant harvest to date; Projected Lbs/Plant with cut lots at actual and standing plants at the field estimate for their strain and farm. Strain, Farm and Grow Method filter all three.
- Testing turnaround shows only on the bizops wall, so "bump" sets it inactive (active 0); its row stays.

For the build session (Cursor, one plain session, no sub-agents): open in `C:\Users\DennisWallace\Documents\Claude\Projects\gripfactory Practical\branches\GFLiteMetrcAPI` (its `app\` is the app). If your working folder is not under `branches\GFLiteMetrcAPI`, stop and say so. Under THE DISPATCH RULE (canon 0.30.155).

RUN AFTER S3c. Pin: the S3c gated tree `0a3bfd792351f997` (S3a to S3c, gated 2026-10-19). Verify with canon's hash command in `app/` (`(find src test scripts migrations -type f; echo wrangler.toml; echo tsconfig.json; echo package.json) | LC_ALL=C sort | xargs sha256sum | sha256sum | cut -c1-16`, `wrangler.toml` read as LF) and stop if it differs. No git; nothing committed, pushed or deployed. One migration, `0109`. LF only. Read big files by search and line range (`src/strainperformance.ts`, `src/console.ts`, `src/director.ts`, `src/directorregistry.ts`, `src/index.ts`).

## 1. The registry (migration 0109 and src/directorregistry.ts together)
- `bizops.lab_turnaround_days`: active 0.
- A new row `bizops.plant_weight` in its place: dept bizops, wall_keys bizops; title_en "Plant Weight", title_es "Peso por planta"; unit lb448; cadence daily; dims "farm,strain,grow_method"; goal_kind none; source_kind app; status live; def_version 1; no open question; compute_key: "dry grams over plants of own dried lots of the harvest year (consoleBoxes dryPerPlant: plant_count at least 1, dry grams above 0, status not weighing, ownLotSql), dated by the lot's unload day; projected = buildStrainPerformance seasonLb over plantsHarvested plus plantsRemaining for the rows in the selection".
- Guarded and idempotent; the registry test's counts and equality move with it.

## 2. The data (no stored series)
Unlike S3a to S3c, this tile is computed on the wall read, because the four selections combine too many ways to store. Keep it cheap:
- One read of the harvest year's own dried lots: lot id, unload day (the dry yesterday law: unload day), farm, strain (market strain as strain performance names it), grow method (`harvest_batches.grow_method_code`, the HBN's segment), plant_count, dry grams. A few hundred rows at most.
- The projection rows from `loadStrainPerformance` (it already runs for /harvest): per strain and farm, seasonLb, plantsHarvested, plantsRemaining. Grow method for those rows: a strain and farm whose lots all share one grow method takes it; standing plants split by mirror location (GH is greenhouse, else outdoor) as S3c does. If a strain and farm mixes grow methods, split its season pounds by its own lots' grow methods and its remaining plants by location, and say so in the report.
- The wall must stay under 0.5 s on the live-data bench with these reads. If loadStrainPerformance alone is slower than that, say so with timings and stop; do not cache it.

## 3. The tile
- Head: "Plant Weight", v1.
- Four selects in one row (wrapping on narrow screens): Period (7 days, 14 days, 30 days, HTD; default 14 days), Strain (All, then the strains with lots this year), Farm (All, PNN, PNS, ARL), Grow Method (All, then the grow methods with lots or plants this year). Client side, all data in the page; picks remembered per browser in try/catch.
- Three boxes side by side (stacked on the phone):
  - Lbs/Plant: summed dry grams over summed plants of the dried lots whose unload day is in the period, in lb at 448, two decimals; under it "N lots, P plants".
  - AVG Lbs/Plant: the same over the whole harvest year; it must equal the console's Total dry per plant box when every select is All (a test proves it), and each farm's box when that farm is picked.
  - Projected Lbs/Plant: summed seasonLb over summed plantsHarvested plus plantsRemaining for the rows in the selection, two decimals; under it "Field estimate missing for N strains" when any selected row has plants remaining and no estimate (strain performance's estimateMissing). The period does not apply to it.
- A selection with no dried lots reads "No data" in that box, not 0.
- Hover or tap on a box: the formula in a sentence and the counts behind it.
- Theme tokens only; fits at 1920, 820 and the phone with no sideways scroll.

## Tests
- AVG with every select All equals the console's Total dry per plant; a farm pick equals that farm's box.
- The period box counts lots by unload day; toll, test and undried lots stay out.
- Strain, farm and grow method filters each narrow all three boxes.
- Projected equals strain performance's season pounds over its plants for one strain and farm, and flags a missing estimate.
- "No data" for an empty selection.
- The registry: Testing turnaround inactive, the new row on bizops.
- No dash characters in any output.

## Smoke and gates
Smoke: `About to apply 108 migration(s)` (S3c's read 107). Seed two dried lots on two strains, a field estimate and a few live plants, load the wall, and check the three boxes read numbers and Testing turnaround is gone; keep every other check. Gates: typecheck 0; vitest under TZ=UTC and TZ=America/New_York with counts; `node --check scripts/smoke.mjs`; the from zero smoke (SMOKE PASS, no 500); renders of the bizops wall in Lite, CO and Cerberus at 1920, 820 and the phone, each select used once and a hover shown; dash, CR and name scans of every touched file. On a live-data bench: the wall's load time.

## Hand back
Report `SESSION_REPORTS/2026-10-19_dd_s3d_plant_weight.md`, short: the tree received and left, files touched, gate results, timings, anything declined and why. Close with the tree hash and that nothing is committed, pushed or deployed. The Scribe gates; the owner merges (it carries migration 0109, so the merge block takes a snapshot first).
