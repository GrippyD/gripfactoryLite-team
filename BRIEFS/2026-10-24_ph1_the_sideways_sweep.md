# PH1: THE SIDEWAYS SWEEP, every page fits at 1920, 820 and the phone

Filed by the Scribe on 2026-10-24 (canon 0.30.540). Every brief carries the law "fits at 1920, 820 and the phone with no sideways scroll", and the gates have recorded pages that break it as "for a later slice":
- the equipment pages on the phone (L4 gate);
- Admin, METRC on the phone (the queue's gate).

The Scribe then crawled every page the app links to on the live-data bench, about 220 of them, and measured the page's sideways scroll (`document.documentElement.scrollWidth - innerWidth`). The crawl covered Lite, CO and Cerberus at 1920, at 820 (computer) and at 390 (phone). Below are all the pages that scroll, and the element that pushes each one. Every other page fits.

Part of THE QUEUE, TWO (`BRIEFS/2026-10-24_queue2_lb1_ph1_rg1.md`): read it first; its runner law and stop rules apply here. SECOND IN THE QUEUE. Pin: the tree LB1 left, as LB1's report states. No git; nothing committed, pushed or deployed. No migration. LF only. Read big files (`src/theme.ts`, `src/html.ts`, `src/index.ts`) by search and line range.

## The pages that scroll sideways (pixels past the screen)

| page | at the phone (Lite, CO, Cerberus) | at 820 (Lite, CO, Cerberus) | what pushes it | where |
| --- | --- | --- | --- | --- |
| `/equipment` | 100, 100, 100 | fits | `table.eq` | `src/equipment.ts` |
| `/equipment/:id` (all 49 assets) | 203 to 303 | fits | `table.eq` (the PM schedules) | `src/equipment.ts` |
| `/inventory/metrc` | 211, 64, 104 | 5, fits, fits | the Three pictures `dl.lot-meta`; the license lines `table.data.metrc-lines` at 820 | `src/metrcpane.ts`, the three `.lot-meta` rules in `src/theme.ts` |
| `/admin/lookups/harvest_dashboard` | 95, 78, 68 | fits | one long unbroken value (the type map, `BUD=BUD,SMALLS=WPR,SHAKE=SHA`) | `src/harvestdashboard.ts` |
| `/admin/lookups/fulfillment_override` | 190, 172, 163 | fits | `table.fulfill-grid` | `src/fulfillmentboard.ts` |
| `/admin/field_estimates` | 311, 294, 273 | fits | `table[data-field-estimates]` | `src/fieldestimates.ts` |
| `/admin/metrc-api` | 701, 663, 641 | 157, 119, 96 | the bare `table` of sweep runs (License, Endpoint, Last run...) | `src/metrcadmin.ts` |
| `/testing` | fits | 114, 84, 77 | `table.data` in `div.testing-desk` | `src/testing.ts` |
| `/log` | fits | 681, 645, 645 | `table.data.wide` | `src/pages.ts` |
| `/admin/queues` | fits | 635, 600, 476 | `table.data` in `details.queue-fold` | `src/html.ts` |
| `/admin/uploads` | fits | 307, 304, 283 | three `table.data` in `details.queue-fold` (the upload files, `[data-new-packages-table]`, `[data-reconcile-notes]`) | `src/html.ts`, `src/ledgerloc.ts` |
| `/reports/post_harvest_puzzles` | fits | 892, 873, 875 (and 40 at 1920 in Lite) | `table.data[data-php-table]` | `src/puzzles.ts` |
| `/reports/harvest_reconciliation` | fits | 808, 759, 766 | its `table.data` tables | `src/harvestreconciliation.ts` |
| `/compliance/testing` | fits | 96, 72, 73 | `table.data` | the module behind the route in `src/index.ts` |
| `/admin/lookups/app_config` | fits | 548, 503, 522 | `table.data` | `src/lookups.ts` |
| `/admin/lookups/people` | fits | 30, 2, 2 | `table.data` | `src/lookups.ts` |
| `/reports/environment_history` | fits | 25, fits, fits | `table.data` | `src/sensorhistory.ts` |

Pages that fit at the phone often do so because `body.device-phone table.data` already scrolls inside itself. At 820 the computer layout has no such rule, and the table pushes the page.

OUT OF SCOPE: `/harvest-console` scrolls 367 px at the phone. It is the vendored Harvest Console Lite. Under the vendored-pair law (canon 0.30.27, 0.30.33) its fix is built in the Harvest Console Lite folder and vendored again, never edited here.

## THE LAW
A wide thing scrolls inside its own box. The page never scrolls sideways. Nothing gets smaller, nothing is dropped, and nothing looks different where it already fits.
1. A table that can run wider than its column sits in the app's scroller, `<div class="report-scroll">` (the shared chrome in `src/theme.ts`, the FLOOR VS METRC pattern of canon 0.30.415). The table keeps all its columns, its own classes and its data attributes.
   - Where a wrapped table's parent is a flex or grid item, give that parent `min-width: 0` so the box can shrink.
   - The bare table on `/admin/metrc-api` and `table.fulfill-grid` take the same wrapper.
   - The equipment pages carry their own stylesheet in `src/equipment.ts`. Add the same scroller there under its own class, with the same rules (block, full width, `overflow-x: auto`, touch scrolling).
2. `dl.lot-meta`, in all three view stylesheets:
   - the first column becomes `minmax(0, max-content)` and the second `minmax(0, 1fr)`;
   - `dt` and `dd` take `overflow-wrap: break-word`.
   A lot panel that fits keeps its look; the METRC pane's long labels wrap at their spaces.
3. A long unbroken value (the harvest dashboard's type map, and any value of that page shown the same way) takes `overflow-wrap: anywhere`, so the phone breaks it.
4. Theme tokens only, and no new colors. Spanish needs nothing new.

## Tests
- For each page in the table, render its HTML through the module's own function (or the route, where the tests already do) and assert that the named table sits inside the scroller.
- The three `.lot-meta` rules carry the minmax columns.
- The harvest dashboard's long value carries its wrap class or rule.
- The equipment stylesheet carries its scroller.
- No dash characters in any output.

## Smoke and gates
- Smoke: `About to apply 118 migration(s)` (LB1's count; PH1 adds none). GET each page in the table and check that its wide table opens inside the scroller (or the equipment scroller). Keep every other check.
- Gates:
  - typecheck 0;
  - vitest under TZ=UTC and TZ=America/New_York, with counts;
  - `node --check scripts/smoke.mjs`;
  - the from zero smoke in the background by the runner law (SMOKE PASS, SMOKE_EXIT 0, no 500);
  - dash, CR and name scans of every touched file.
- No renders.

THE ACCEPTANCE (the Scribe at the gate): the same crawl and measure over every page on the live-data bench, in Lite, CO and Cerberus at 1920, 820 and the phone. Every page reads a sideways scroll of 2 px or less, except `/harvest-console`.

## Hand back
Report `SESSION_REPORTS/2026-10-24_ph1_the_sideways_sweep.md`, short. Give the tree received and left, the files touched with what each one wraps, the gate results, and anything decided or declined and why. Close with the tree hash and that nothing is committed, pushed or deployed. Then go straight on to RG1.
