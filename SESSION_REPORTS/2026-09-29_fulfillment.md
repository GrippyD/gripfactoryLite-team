# 2026-09-29 Fulfillment

V5 of THE BRANCH PLAN (canon 0.30.306), built in the worktree `branches/GFLiteOpsDashboard` under THE DISPATCH RULE (canon 0.30.155), on V13. Migration 0081. The smoke pin moves to 81. Not deployed. Nothing committed. No git was run.

## What changed

`migrations/0081_fulfillment_override.sql` creates `fulfillment_overrides` and a partial unique index on `(entry_date, row_key, col)` where `deleted_at` is null, plus an index on `entry_date`. It seeds `app_config.fulfillment_unit_grams` with `INSERT OR IGNORE` as `prepack=28, mobs=70, prerolls=1, vapes=1`.

The ten rows live in `src/fulfillmentboard.ts`, in the doc's order, each with its key, its name, and its METRC unit: Bulk Bud, Biomass/Trim, Prepack, Prerolls, Shake, Bulk Distillate, Vapes, MOBs, Bulk Isolate (THCA), Bulk Infused. Grams for the bulk rows, eaches for Prepack, Prerolls, Vapes, and MOBs. The columns are Accepted, Submitted, Shipping Today.

`/admin/lookups/fulfillment_override` sits under Logistics. The date loads the farm's today and reloads any day with `?date=`. The grid is ten rows by three columns. Each cell is a whole number of zero or more, masked to its unit, marked `data-fulfill-cell`. One Save inserts a typed cell, updates a changed value and logs old and new on `fulfillment_overrides` field `value`, or soft-deletes a blanked cell with reason "cleared". An untouched cell writes nothing. Nothing is hard-deleted, so a past day reloads what was typed. A fraction or a negative refuses with "Each figure must be a whole number of zero or more."

The console section Fulfillment, `data-hc-section="fulfillment"`, follows Prepack and starts open. Its three panes are Shipping today, Submitted, and Accepted, and they read the console's day. A series is a cell whose value is not null. Zero is present, named in the legend, and draws a segment of no width. Shipping today draws the stacked bar inside `TRAILER_CARGO`. Submitted and Accepted draw the same bar as a band to the right of the icon. Widths are shares of the pane's grams: a gram row is its value, an each is its value times `fulfillment_unit_grams` (a missing each falls back to the seeded number). Ten hues, `.hc-fill-1` through `.hc-fill-10`, sit in the three sheets, the pie's eight and two more, one per row. The legend names each series in its own unit. A pane with no cell reads "No figures typed for this day." `loadFulfillmentSection` reads the day's rows and the config row, and nothing else. `src/fulfillment.ts` is untouched.

## Assumptions for his word

- The units per row follow METRC's own: grams for Bulk Bud, Biomass/Trim, Shake, Bulk Distillate, Bulk Isolate (THCA) and Bulk Infused; eaches for Prepack, Prerolls, Vapes and MOBs. The Zoho lane's display units (lb, L) are that lane's, not this panel's. This build followed that reading.
- A stacked bar across mixed units needs one measure: grams, with `fulfillment_unit_grams` giving the grams in one each (Prepack 28 and MOBs 70 from ruling 22; Prerolls 1 and Vapes 1 as placeholders for his numbers, editable in Admin's app_config like the gate's). This build followed that reading.
- The section stands after Prepack, the last on the console. This build followed that reading.
- "Follows the day picked": the panes read the console's day; yesterday on load, today when today is picked, any day the control allows.
- The legend shows each series in its typed unit; no total is drawn across grams and eaches.

## Gates

Run in the worktree's `app/`.

- `npm run typecheck`: exit 0.
- `npx vitest run`: 68 files, 974 tests passed under `TZ=UTC`, and the same under `TZ=America/New_York`.
- `node --check scripts/smoke.mjs`: exit 0.
- From-zero smoke (`SMOKE_PORT=9214`, `WRANGLER_SEND_METRICS=false`): `About to apply 81 migration(s)`, `SMOKE PASS`, ` 500 ` lines: 0, exit 0. The walk loads the grid on the farm's today, posts Bulk Bud 1000 g and Prepack 40 ea in Shipping Today with Vapes blank, sees those two segments on Shipping today and the empty words on Submitted and Accepted, then posts Prepack 50, reads old 40 and new 50 in the change log, and reloads the grid at 50.
- Dash audit: 0 on every file below (U+2014 and U+2013). No CR byte in those files.
- `METRC_INTEGRATOR_KEY = "`, `METRC_USER_KEY = "`, `MS_CLIENT_SECRET = "`, `SENSORPUSH_PASSWORD = "`, `CLOUDFLARE_API_TOKEN=`, and `CLOUDFLARE_API_TOKEN: "` do not appear in those files. No personnel data.

## Deploy

Not deployed from this session. Nothing committed. No git was run.

## Sealed final check

```
npm run typecheck                     exit 0
npx vitest run (TZ=UTC)               68 files, 974 tests passed
TZ=America/New_York npx vitest run    68 files, 974 tests passed
node --check scripts/smoke.mjs        exit 0
SMOKE_PORT=9214 WRANGLER_SEND_METRICS=false node scripts/smoke.mjs
                                      About to apply 81 migration(s); SMOKE PASS; " 500 " lines: 0; exit 0
dash audit: 0; CR audit: 0; secret grep: no values; personnel data: none
```

```
app/migrations/0081_fulfillment_override.sql    1152  4ea04aea96c30051
TAIL   ('fulfillment_unit_grams', 'prepack=28, mobs=70, prerolls=1, vapes=1', '2026-09-29T00:00:00.000Z', NULL, '2026-09-29T00:00:00.000Z', NULL, NULL, NULL);
app/src/fulfillmentboard.ts                    14605  d2874c7580db006f
TAIL }
app/src/config.ts                              73831  0ae4caebeaac2025
TAIL }
app/src/index.ts                              148176  7e71c374a0b79cd0
TAIL export default worker;
app/src/console.ts                            101906  02bc2e608199d295
TAIL }
app/src/lookups.ts                              9713  c42b4f6cc6a39129
TAIL };
app/src/theme.ts                              170198  6984e600333c0a54
TAIL }
app/src/i18n.ts                               185690  02baacaa5cf46165
TAIL }
app/scripts/smoke.mjs                         627889  2065c6ffea5977d1
TAIL });
app/test/fulfillmentboard.test.ts               7618  da59cef54af20534
TAIL });
app/test/console.test.ts                       65273  44d86df2c0658470
TAIL });
app/test/locations.test.ts                     12070  2804205faa5380d2
TAIL });
```
