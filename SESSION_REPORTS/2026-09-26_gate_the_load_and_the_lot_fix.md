# 2026-09-26 The gate on the load and the lot's fix, and the plume's product line (canon 0.30.243): PASSED

Scribe session. The gate on his Code session's `SESSION_REPORTS/2026-09-26_the_load_and_the_lot_fix.md` (the fix the held gate named, canon 0.30.242), together with one Scribe-direct change built under G-2 on the quiet tree: THE PRODUCT LINE on the dashboard's trim plumes. No migration; the head stays 0075. Nothing was deployed before this gate.

VERDICT: PASSED. Brief P part one, its fix and the product line deploy together, worker-only.

## What was gated

1. The fix sitting went quiet at 14:04Z (its report; no file under `app/` newer than it). Against the held gate's tree, it changed exactly the six files its seal names, each verified byte for byte on the device and in the sandbox.
2. THE PRODUCT LINE was built in the sandbox while the fix ran, held as `RESEARCH/scribe/pending/plume_product_line.patch` (6,371 bytes, 2e458fe672a8581e; gitignored), and applied on the device at 14:31Z after its three files were verified at their pre-edit hashes (`src/console.ts` 713625891cd05991, `src/theme.ts` fd3e6907b8b07b3b, `test/console.test.ts` 678a1caeedf2a48f); the three read identical to the sandbox after the patch, with no CR byte.
3. The trees hash identical on both sides: 217 files by the listing of `src`, `test`, `scripts` and `migrations` with `wrangler.toml`, `tsconfig.json` and `package.json`, listing sha256 b540c42a8d9d403a.
4. THE FIX, read against the held gate: D1 and D2, `syntheticLot` takes the harvest batch as its id, so the Load Silo list, the drying surfaces' `>>`, the Scheduled `>`, the selected row, the hidden `lot_id` and the parts lookup agree, and a lot of two or more parts renders one `plant_count[<entry id>]` box per part without a count and writes each; L1, `<<` no longer looks at the HBN's other loads (an open pass covers only waiting parts, and loading completes it); L2, an open pass whose parts all left stays on Scheduled with `<<` and no `>`; L3, the lot's plant count is the sum of its parts'; the two comments corrected; a route test and a smoke walk of a two-part lot. The seal names every changed file (L4 closed).
5. THE HELD GATE'S PROBE, run again on the fixed code (throwaway, not in the repo), verbatim:

```
pick=hb-a (the Scheduled > link): picked form true; lot_id hb-a; plant boxes [name="plant_count[part-a1]" name="plant_count[part-a2]"]
load with 700 and 300 typed in the two boxes: {"redirect":"/station/load_silo?load=be40cc97-1000-4413-8180-03ab9a9a8b23&ok=loaded"}; loads [{"wet_weight_entry_id":"part-a1"},{"wet_weight_entry_id":"part-a2"}]; plant counts [{"id":"part-a1","plant_count":700},{"id":"part-a2","plant_count":300}]
```

6. THE SMOKE'S D1 after the walk: the two-part lot 26269-PNN-GH-027-0-NA-26905 loaded whole into Silo 5 with its two typed counts (7 and 11) on its two parts; 13 live passes (11 complete, 2 scheduled), none voided.

## THE PRODUCT LINE (Scribe-direct under G-2)

His words, verbatim: "Can you make the 40% squares on the trim panes of the dashboard dark green when consumed?  I want to make 40% look like the "goal" if you catch my drift", then "40% and under", then, correcting the Scribe's first reading (the first forty consumed cells dark green): "So most of the flower needs to go, the actual outline is not desireable, so the grey is good until 40% is left, now you're digging into product.  That's not universal, it varies from fleurette-to-fleurette but it's safe.  So I want it to look like biproduct for the first 60% and waste thereafter".

The law as built: the plume keeps its hundred cells in the consumption order and its two permanent stem cells. The first sixty cells grey when consumed, as byproduct, as they always have. A consumed cell among the last forty (`BUD_PRODUCT_CELLS = 40`, the product the goal leaves) carries `data-hc-bud-waste` at the end of its rect and draws dark green: `#1f6b35` in Lite and Continuum, `#2a9a52` in Cerberus (the deeper greens the stem wore before canon 0.30.207). A bud cell, a stem cell and an outline never carry it; the counts, the labels and every other cell's markup do not change. So a shift at 40% BTR or better reads green and grey only, and every dark green cell is product trimmed away. Read on the smoke's served dashboard: the Day plume consumed 40 (no waste), the Second consumed 69 (nine waste cells), the stylesheet carrying the rule. Preview: `RESEARCH/scribe/pending/plume_product_line_preview.png`. The forty is a constant; an Admin setting for it is a later slice if he wants one.

## Gates on the combined tree (the Scribe's sandbox)

- `npx tsc --noEmit`: exit 0.
- `npx vitest run`: 56 files, 907 tests passed (the fix's 906 and the product line's one); the same under `TZ=America/New_York`.
- `node --check scripts/smoke.mjs`: ok.
- From-zero smoke (`SMOKE_PORT=9168`): `About to apply 75 migration(s)`, `SMOKE PASS`, no ` 500 ` line; exit 0 once the dev server was ended by pid.
- Dash audit: 0, and no CR byte, on every file under `src`, `test` and `scripts/smoke.mjs`, and on the fix report.
- Secret grep (`METRC_INTEGRATOR_KEY = "`, `METRC_USER_KEY = "`, `MS_CLIENT_SECRET = "`, `cfas[t]_`): no matches under `src`, `test`, `scripts`, `migrations` or `wrangler.toml`.

## Deploy (his hands; worker-only, no migration rides)

```powershell
cd "C:\Users\DennisWallace\Documents\Claude\Projects\gripfactory Practical\app"
npm run deploy:grip
```

His paste: the Version ID. THE PROBE: Logistics Operations on the map opens Internal Logistics and a blank Processing Partners; the lots waiting at Load Silo before the deploy stand in the Dry Queue (nothing was written for them), and each needs its `>>` before Load Silo lists it; a `>` on Scheduled opens Load Silo with the lot picked and a plant box per part without a count; the dashboard's trim plumes read grey for byproduct and dark green once a shift digs past 60%.

## Sealed final check

```
npx tsc --noEmit                      exit 0
npx vitest run                        56 files, 907 tests passed
TZ=America/New_York npx vitest run    56 files, 907 tests passed
node --check scripts/smoke.mjs        ok
rm -rf .smoke-persist && CI=1 SMOKE_PORT=9168 WRANGLER_SEND_METRICS=false npm run smoke
                                      About to apply 75 migration(s); SMOKE PASS; " 500 " lines: 0; exit 0
the fix session's seal (6 files) verified byte for byte, device and sandbox:
src/actions.ts                                339435  2892e3e67780b203
src/db.ts                                     175713  243ebe4b8e25b7ec
src/scheduling.ts                              44887  9895a9151f950613
src/index.ts                                  139063  dafc113b8ab9b9b0
test/logistics.test.ts                          9471  68cb8c55502cdf62
scripts/smoke.mjs                             595958  a3f750aa321d9388
the product line (Scribe-direct), device and sandbox:
src/console.ts                                100817  63c2c2077c386d74
src/theme.ts                                  154124  5c7ee4839ea3cf2d
test/console.test.ts                           57307  f8253097ae695d58
tree listing, device and sandbox: 217 files, sha256 b540c42a8d9d403a
the fix report: SESSION_REPORTS/2026-09-26_the_load_and_the_lot_fix.md  2915  e5c15b4706cd590c
the held gate: SESSION_REPORTS/2026-09-26_gate_the_load_and_the_lot.md  11263  03c9812641d9a338
dash audit: 0; secret grep: no matches
```
