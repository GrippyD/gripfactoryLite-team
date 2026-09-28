# 2026-09-28 Global and plants

V3 of THE BRANCH PLAN (canon 0.30.288), built in the worktree `branches/GFLiteOpsDashboard` under THE DISPATCH RULE (canon 0.30.155). Migration 0078. Not deployed. Nothing committed. No git was run. The snapshot `node scripts/db-snapshot.mjs pre_global_and_plants` was not run from this session.

## What changed

The fold is remembered in the browser. A script at the end of the console page, beside the hours script, keeps every `details.hc-section[data-hc-section]` in `localStorage` under `gf_hc_fold`: an object of section key to `"1"` (open) or `"0"` (closed). On load a stored key wins over the server attribute. On any toggle the script rewrites the object with every section's present state. Every read and write is in try/catch. Nothing stored means the server defaults. The server does not learn the state. No migration for this.

First visit, nothing stored: Drying closed; Plants, Trimming, Testing, and Prepack open; the Pasteurization stub closed.

Today so far. The day control shows a link "Today so far" to `?day=<today>` whenever the day under view is not today, beside "Back to yesterday" when that link is also up. When the picked day is today, the state text reads "today so far; the panes below read today up to now". `consoleDayOf(today, today)` is picked. `loadHarvestConsole` with today picked bounds the weighed totes from that farm day's start hour to its end.

Farm Plant Count. `migrations/0078_farm_plant_counts.sql` adds `farm_plant_counts` and the partial unique index `farm_plant_counts_farm_year` on `(farm_code, harvest_year)` where `deleted_at` is null. Admin, Lookups, under Harvest Operations: `/admin/lookups/plant_count`, title "Farm Plant Count", the button description the brief's sentence. The harvest year defaults to the farm day's year (`today.slice(0, 4)`), and a four-digit `?year=` overrides it. One whole-number box per live farm. Reason required. `saveFarmPlantCounts` updates a count that changed, writes nothing when the count is the same, and soft-deletes (with the reason) a farm left blank that had a live row. Every change is logged on `farm_plant_counts`, field `plant_count`. A bad year or a count that is not a whole number of zero or more is 400 in house words.

On the console a farm with a count uses that number as the denominator. Remaining stays METRC's live count. Percent is harvested over that total, and a stale count reads over 100% with no clamp. A farm with no count still reads remaining plus harvested. The Total column's remaining, harvested, and denominator are the sum of the three farms only (PNN, ARL, PNS), typed or fallback. Unassigned license plants no longer sit in Total, so the fixture reads 1,500 / 2,350 and 36.2% (`data-hc-pct` still rounds, so 36).

The two notes are out: the paragraph under the Plants boxes, and the long paragraph at the end of Trimming. Harvest year stays as a muted span in the Plants summary. The unassigned-operator notes in Trimming stay. Testing's note and Prepack's note stay.

Weight Harvested is a new line on the three farms and Total, before the hours row: pounds and grams of every tote weighed that farm day, finished or not. The date sits beside the label. Zero reads `0.00 lb` over `0 g`. With that line present, Weight/DLH with no hours typed reads "type hours" alone. The ratio's sub stays.

The four hour savers keep one row per date and operation, update in place, delete on blank, and log the change. Trim input lbs had been logging "input lbs typed". It now logs `SYSTEM_REASON.labor_hours` ("labor hours typed") with the other three, which is the reason the brief names. The config key `trim_input_lbs` is still there and the saver no longer writes it.

Reports gains a card "Labor hours" (`labor_hours`): "Every hour and input lb typed on the console, by date and operation." The view is newest date first, one row per saved value: Date, Operation, Value, Unit, Updated. Operations read "Cutting and bucking, <farm>", "Trim DLH, <shift>", "Trim input lbs, <shift>", and "Prepack hours". From and To default to the last 30 farm days ending today, inclusive. CSV, XLSX, and PDF come from the view. No PIN. No names (`updated_by` is not a column). Empty copy: "No hours in this window."

`scripts/smoke.mjs` pins "About to apply 78 migration(s)". Three asserts that named the old page had to move with the slice, and nothing else in the walk did: Drying closed on a first visit, the Spanish Plants summary carrying the harvest year, and the Trimming section keeping the sheet-hours line after the long footnote left. `src/consoleicons.ts` is not imported. `wrangler.toml` is untouched. Nothing under `public/`.

## Assumptions for his word

- First-visit defaults: Drying closed; Plants, Trimming, Testing, and Prepack open; Pasteurization stub closed. One line in the page flips a default.
- The fold store is per browser and per device. A cleared browser forgets and starts at those defaults.
- A stale Farm Plant Count reads over 100% complete rather than clamping.
- Total's denominator is the sum of the three farms' totals, typed or fallback, so a farm without a count does not zero the total. Unassigned license plants are off Total.
- The Labor hours report defaults to 30 farm days. His word if he wants the season.
- The word "Yesterday" stays on the hours and Weight/DLH labels this slice.

## Gates

Run in the worktree's `app/`.

- `npm run typecheck`: exit 0.
- `npx vitest run`: 65 files, 953 tests passed under `TZ=UTC`, and the same under `TZ=America/New_York`.
- `node --check scripts/smoke.mjs`: exit 0.
- From-zero smoke (`SMOKE_PORT=9197`, `WRANGLER_SEND_METRICS=false`): `About to apply 78 migration(s)`, `SMOKE PASS`, ` 500 ` lines: 0, exit 0.
- Dash audit: 0 on every file below (U+2014 and U+2013). No CR byte in those files.
- `METRC_INTEGRATOR_KEY = "`, `METRC_USER_KEY = "`, `MS_CLIENT_SECRET = "`, `SENSORPUSH_PASSWORD = "`, `CLOUDFLARE_API_TOKEN=`, and `CLOUDFLARE_API_TOKEN: "` do not appear in those files.

## Deploy

Not deployed from this session. Nothing committed. No git was run.

## Sealed final check

```
npm run typecheck                     exit 0
npx vitest run (TZ=UTC)               65 files, 953 tests passed
TZ=America/New_York npx vitest run    65 files, 953 tests passed
node --check scripts/smoke.mjs        exit 0
SMOKE_PORT=9197 WRANGLER_SEND_METRICS=false node scripts/smoke.mjs
                                      About to apply 78 migration(s); SMOKE PASS; " 500 " lines: 0; exit 0
```

```
app/migrations/0078_farm_plant_counts.sql      639  8df6ebacb13e51b7
TAIL CREATE UNIQUE INDEX farm_plant_counts_farm_year ON farm_plant_counts (farm_code, harvest_year) WHERE deleted_at IS NULL;
app/src/console.ts                          101838  3e21a9f11956ec36
TAIL }
app/src/lookups.ts                            9022  669683dcde836d90
TAIL };
app/src/pages.ts                             28466  20a3ab4a1c757bbf
TAIL }
app/src/actions.ts                          352929  8503715593069f94
TAIL export { MANIFEST_COLUMNS, buckedPackageCode };
app/src/db.ts                               187417  1ad909b0a6ad1842
TAIL }
app/src/index.ts                            144691  375af4b41c946ae2
TAIL export default worker;
app/src/reports.ts                           25783  ec469e8bc79bde79
TAIL }
app/src/i18n.ts                             181322  79d0b7685fdf4f6c
TAIL }
app/src/theme.ts                            158697  4996e8d16a88c32d
TAIL }
app/scripts/smoke.mjs                       617402  bd50b65bf2f78f6b
TAIL });
app/test/console.test.ts                     63636  94df3f900eaa8c91
TAIL });
app/test/farmday.test.ts                     17378  8613c9a1837e98df
TAIL });
app/test/plantcount.test.ts                   4833  29ff4fa4c6a51a40
TAIL });
app/test/laborhours.test.ts                   5625  44f81ac3ee9c0ef5
TAIL });
```
