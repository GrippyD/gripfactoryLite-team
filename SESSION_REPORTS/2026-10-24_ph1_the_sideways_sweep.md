# PH1: the sideways sweep

Worktree `branches/GFLiteMetrcAPI`. One plain session. No git. Nothing is committed, pushed, or deployed. No migration.

## Tree

- Received: `e0bc9cca7aa64bd2` (428 files, 118 migrations). That is the tree LB1 left.
- Left: `e4c036fb7fa68c63` (429 files, 118 migrations).

## What each file wraps

- `src/theme.ts`: the shared `.report-scroll` gains `min-width: 0`, so a scroller that is a flex item can shrink. `.hd-break` is `overflow-wrap: anywhere`. The three `.lot-meta` rules use `minmax(0, max-content)` and `minmax(0, 1fr)`, and `dt` and `dd` use `overflow-wrap: break-word`.
- `src/equipment.ts`: `.eq-scroll` (block, full width, `overflow-x: auto`, touch scrolling). The list table and the asset page's PM, ticket, and history tables sit in it.
- `src/metrcpane.ts`: `table.data.metrc-lines`.
- `src/harvestdashboard.ts`: every value shown as that page's span takes `hd-break`, including the type map.
- `src/fulfillmentboard.ts`: `table.fulfill-grid`.
- `src/fieldestimates.ts`: `table[data-field-estimates]`.
- `src/metrcapi.ts`: the bare sweep-run table. The wrapper carries that section's title.
- `src/testing.ts`: the desk's ready table and its results table.
- `src/pages.ts`: the change log, and the people and app config tables.
- `src/html.ts`: every data-queue table, the logistics-moves table, the wet-weights upload table, the new-packages table, and the environment history and harvest reconciliation report tables.
- `src/ledgerloc.ts`: `table[data-reconcile-notes]`.
- `src/puzzles.ts`: `table[data-php-table]`.
- `src/harvestreconciliation.ts`: the toll-lot table and the METRC-only table.
- `src/compliance.ts`: the external testing table.
- `test/sideways.test.ts` and the asserts added beside the pages that already render.
- `scripts/smoke.mjs`: GET each named page and check the wide table opens inside the scroller. Migration count stays 118.

## Decided

- People and app config are drawn by `adminTable` in `src/pages.ts`. `src/lookups.ts` has no table markup.
- Environment history and the harvest reconciliation main table are drawn by `reportPage` in `src/html.ts`. `src/sensorhistory.ts` returns the view, not the table.
- "The upload files" is the Wet Weights file table, the pending list whose columns include File. New packages and reconciliation notes are the other two.
- A lookup table that already fits (farms, and the rest) stays unwrapped.
- `/harvest-console` is untouched. It is the vendored Harvest Console Lite.

## Gates

- `npx tsc --noEmit`: exit 0.
- vitest `TZ=UTC`: Test Files 124 passed (124). Tests 1704 passed, 6 skipped (1710). VITEST_EXIT 0.
- vitest `TZ=America/New_York`: Test Files 124 passed (124). Tests 1704 passed, 6 skipped (1710). VITEST_EXIT 0.
- `node --check scripts/smoke.mjs`: exit 0.
- From zero smoke, background: `About to apply 118 migration(s)`. `SMOKE PASS`. `SMOKE_EXIT 0`. No 500 in the log.
- Dash and CR scan of the touched files: U+2013 0, U+2014 0, CR 0.

Left tree `e4c036fb7fa68c63`. Nothing is committed, pushed, or deployed.
