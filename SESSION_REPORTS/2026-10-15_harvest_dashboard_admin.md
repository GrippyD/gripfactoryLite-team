# AD1 Harvest Dashboard settings (2026-10-15)

Worktree branches/GFLiteMetrcAPI. Pin before the first edit, canon's hash in app/ (Linux two-space sha256sum, wrangler.toml already LF): 538a482d575b322f, 382 files. Final tree 59b132a8a7496a1b, 385 files. No git. Nothing committed, pushed, or deployed. One migration, 0104. canon/ was not edited. The three Fulfillment icons already in src/consoleicons.ts were not redrawn.

## What landed

Admin, Lookups, Harvest Operations now has Harvest Dashboard at /admin/lookups/harvest_dashboard, behind the Admin PIN. It lists every value in data that changes what /harvest shows, grouped by pane, with the label, the current value, the unit, and one line on what it does.

Migration 0104 seeds eleven app_config rows with INSERT OR IGNORE:

| key | seed |
| --- | --- |
| fg_cap_tri_lb | 40000 |
| fg_cap_sha_lb | 5000 |
| fg_cap_distillate_l | 2000 |
| fg_cap_isolate_g | 68000 |
| fg_cap_infused_g | 20000 |
| fg_truck_lb | 8000 |
| fg_bud_thc_bands | 20,25,30 |
| fg_not_finished | WBP,WIP,WPR,BIOMASS,FFZ |
| fg_metrc_not_finished | WBP,WIP,WPR,FFZ |
| fg_folded_prefixes | MIX=BUD,NUG=BUD,MOB=PRE:70 |
| fg_pre_each_grams | 28 |

Those eleven are edited on the page. A number must be a plain number above 0. A list is comma separated codes, trimmed and uppercased. Folded prefixes read MIX=BUD or MOB=PRE:70. The three band edges must stay increasing and above 0. A bad value is refused in words and is not stored. A save writes record_change_log on app_config the same way the App config editor does. The App config page still edits the same rows.

Code keeps the same numbers as fallbacks. A missing or unreadable row does not blank /harvest. The eleven keys ride the app_config read loadHarvestConsole already made for the farm day start hour (one IN query in place of that single-key read). loadFgInventory does not query app_config. No new D1 round trip.

With the seeded edges, bud bands stay 19.99% or less, 20 to 25%, 25 to 30%, 30% and up, and no THC. Trim/Bio still turns red at the cap and names round(pounds / truck) trucks. The other caps still turn red only above the cap.

## Surveyed keys already in data

These stay where they are. The page shows the value the console uses and links to the existing editor.

Console day: farm_day_start_hour (hour).

Plants: farm_plant_counts (latest saved year); lookup_values category license.

Strain performance: btr_type_codes; field_estimates (live row count).

Drying: silo_capacity_wet_lbs; projected_dry_yield_pct; environment_stale_minutes; cure_rooms; CSA and CSB lot caps (the cure space capacity, not the unread app_config copies); lookup_values silo_check_interval_aw and silo_check_interval_mc; sensor_bindings (the environment page, because the drying flags read bindings and ranges).

Trimming: btr_type_codes; trim_shift_day_operators; trim_shift_second_operators; cryo_type_categories; trim_bogey_pct.

Pasteurization: pasteurization_shift_day_operators; pasteurization_shift_second_operators; pasteurization_shift_day_hours; pasteurization_shift_second_hours.

Testing: gate_type_codes; gate_unit_grams; lookup_values category license.

Prepack: prepack_units.

Fulfillment: fulfillment_unit_grams; fulfillment_overrides (live cell count). The pane reads one day's cells from that grid.

FG inventory: the eleven new keys, edited in place.

Surveyed and not listed, because the /harvest handler and its panes do not read them: extraction_type_codes (the inventory sheet), trim_shift_day_hours and trim_shift_second_hours (trim no longer reads the shift windows), prepack_items, prepack_location, ffz_item_kinds.

## Files

| file | bytes | sha256 |
| --- | ---: | --- |
| app/migrations/0104_harvest_dashboard.sql | 1701 | a4a3fe5fb4ebe74e |
| app/src/config.ts | 92051 | e38de55be09cbb74 |
| app/src/db.ts | 225211 | 0057b4dc2820024d |
| app/src/fginventory.ts | 40824 | 13f9a7d4ab00b561 |
| app/src/harvestdashboard.ts | 21983 | 153ea3051c03b65e |
| app/src/console.ts | 172223 | b18722e903449b50 |
| app/src/index.ts | 189769 | e355aaae0a00b084 |
| app/src/lookups.ts | 12127 | 25af1a6e3e30c160 |
| app/src/actions.ts | 422022 | 0caff665ef44a6d9 |
| app/src/i18n.ts | 344914 | d31a0c5c669494cf |
| app/test/farmday.test.ts | 18512 | daaa1f40d0d4038e |
| app/test/harvestdashboard.test.ts | 5676 | 1e3ea0d6905081b3 |
| app/scripts/smoke.mjs | 886179 | efd4ca28ea647e87 |

## Gates

npx tsc --noEmit: exit 0.

Vitest, TZ=UTC and TZ=America/New_York: 111 files, 1572 passed, 6 skipped. BOTH_TZ_PASS.

node --check scripts/smoke.mjs: exit 0.

From-zero smoke: exit 0. About to apply 103 migration(s). GET /admin/lookups 200, GET /admin/lookups/harvest_dashboard 200, POST that path 303, GET /harvest 200. Icon checks stayed green (nine fg icons 200 svg, stray 404). SMOKE PASS. No response status 500. Assert count is 3372, one more than the pin's 3371.

Dash and CR on the thirteen files: 0 em dash, 0 en dash, 0 CR.

Rendered /harvest with Fulfillment and FG inventory open, and the Harvest Dashboard page, in Lite, CO, and Cerberus at desktop (clientWidth 1905) and at 820. documentElement scrollWidth matched clientWidth in each of those views (overflow 0). The trailer, the phone, and the handshake draw in the theme color. Trim/Bio over the cap is the theme danger fill and names the trucks. At 820 the FG bar sits under its label and the fulfillment cards stack. The Admin page lists the panes and the eleven editors, and the license line wraps inside 820.
