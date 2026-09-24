# 2026-09-24 Location moves, and the two accents (canon 0.30.218)

Scribe-direct slice under G-2 on a quiet tree (his Code session made no paste since brief J; the device tree read c8ac969b74aa61cb before the copy). Owner, 2026-09-24, on the question tool, asked what changes on the two words the gate of 0.30.216 raised, verbatim: "Rename and accent (Recommended)". Not deployed; the Scribe hands the worker-only line.

## What moved

- `src/html.ts`: the Pending Data Uploads fold for the Change Location setup's moves (`data-fold="location_moves"`) reads `Location moves`; the fold for the Load Silo location changes (`data-fold="location_change"`) keeps `Location changes`. The two folds no longer share one name.
- `src/i18n.ts`: `Location moves` with its Spanish (`Movimientos de ubicacion`, in the file's dominant unaccented form beside `Cambios de ubicacion`); the two batch refusals take their accents: `{row} no se anuló: {why}` and `{row} no se marcó como cargado: {why}`.
- `test/locations.test.ts`: the pending-uploads render with move rows only expects `Location moves` and the open `location_moves` fold.

Nothing else moved: no route, no action, no theme rule, no migration (head 0074). The smoke's own read of `Location changes` on the uploads page after a Load Silo change still holds, since that fold keeps its name.

## For the owner's word

- The Spanish file is mostly unaccented (`ubicacion` in eleven strings) with a few accented strings; the two refusals now carry their accents as ruled, and the new `Movimientos de ubicacion` follows its neighbor. A sweep of the file's accents is a separate word if he wants one.

## Sealed final check

```
npx tsc --noEmit                      exit 0
npx vitest run                        50 files, 859 tests passed
TZ=America/New_York npx vitest run    50 files, 859 tests passed
node --check scripts/smoke.mjs        ok
rm -rf .smoke-persist && CI=1 SMOKE_PORT=9097 WRANGLER_SEND_METRICS=false npm run smoke
                                      About to apply 74 migration(s); SMOKE PASS; " 500 " lines: 0; exit 0
src/html.ts                                   186582  33cc2d0e6c99d268  tail: }
src/i18n.ts                                   162112  3921cb240e86946a  tail: }
test/locations.test.ts                         12046  0d6467bb486fa7f6  tail: });
scripts/repairs/2026-09-24_26039_plant_count.sql   2190  1d3e08d384cf2847  (the repair file of the same fold, rides in the tree)
tree hash after the commit, device and sandbox: 45b21f74675c2f47 (209 files)
dash audit: 0 on every file above and on this report
secret grep: no matches
```
