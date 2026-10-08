# MINI BRIEF R5: REPORTS, DRY WEIGHT BY STRAIN (canon 0.30.427)

For the build session (Claude Code or Cursor) opened in the worktree `C:\Users\DennisWallace\Documents\Claude\Projects\gripfactory Practical\branches\GFLiteOpsDashboard` (its `app\` is the app). NOT the main folder `gripfactory Practical\app`: if your working folder is not under `branches\GFLiteOpsDashboard`, stop and say so. Under THE DISPATCH RULE (canon 0.30.155). Built on the worktree as it stands LIVE after the bar hover fix (the app tree `5250906e8547b9f9`, 307 files, migrations 0001-0095); if the disk differs, stop and say so. The tree hash is canon's command, run in `app/` with `wrangler.toml` read as LF: `(find src test scripts migrations -type f; echo wrangler.toml; echo tsconfig.json; echo package.json) | LC_ALL=C sort | xargs sha256sum | sha256sum | cut -c1-16`. One build agent in this worktree at a time. No migration.

## The source (verbatim)

The owner, 2026-10-08: "New Report: Dry Weight by Strain: 1. Date Range field 2. Strain=(blank = all) 3. Grow Method=(combobox(indoor,outdoor,greenhouse, blank (all))) 4. Farm=(bombox(PNN,PNS,ARL,Blan(all))". His picks: the range is on the "Unload date"; the strain, "Both please" (the real strain from Lookups and the market strain on the lot).

What the data holds (the live tree): a lot is a `wet_weight_entries` row of a `harvest_batches` row (farm_code, grow_method_code GH, ID, OD for Greenhouse, Indoor, Outdoor; strain_id to `strains.name`; market_strain; is_test). A lot is unloaded by an `unload_sessions` row with `finished_at` (and `effective_date` when the station's Effective Date was used); its dry weight is `wet_weight_entries.dry_weight_grams`, else the sum of its live `dry_weights`; wet is `weight_grams`; plants `plant_count` (optional). Lots that froze without an unload have no unload date.

## The law

1. THE PAGE. Reports gains "Dry Weight by Strain" (ES "Peso seco por cepa"), key `dry_weight_by_strain`, its filters in one row: From and To (calendar dates, Eastern; From defaults to 30 days before today, To to today; To before From refused in words; at most 366 days), Strain (a pick list of every name that appears as a lot's real strain or market strain, blank for all; a pick matches a lot whose real strain OR market strain is that name), Grow Method (blank, Indoor, Outdoor, Greenhouse), Farm (blank, PNN, PNS, ARL).
2. WHICH LOTS. Every live lot (entry and batch not deleted, not a test HBN) with a finished unload whose unload date falls in the range: the unload date is the newest finished session's `effective_date` when set, else the Eastern calendar date of its `finished_at`. A lot never unloaded is not in the report.
3. THE ROWS. One row per pair of real strain and market strain (the market strain shown blank when it equals the real strain), sorted by dry weight, largest first: Strain, Market strain, Lots, Wet lb, Dry lb, Dry/Wet percent (one decimal), Plants (lots with a count), Dry lb per plant (dry of the counted lots over their plants, two decimals; blank when none counted), and the lot numbers (last five) folded under the row. Pounds at 448 g, two decimals, grams beside in the hover. A Total row under them by the same rules. When nothing matches: "No lot was unloaded in that range." (EN and ES).
4. EXPORTS. CSV, XLSX and PDF of the rows shown, as the other reports do, the filters written in the file's head.
5. NOTHING ELSE MOVES. Read only.

On `db_backups/20261008-135926_post_dedupe`, for the check (no filter but the range): From 2026-09-01 To 2026-10-08 holds 76 lots in 20 strain pairs, 89,801,068 g dry; the largest row Bermuda Triangle, 18 lots, 23,601,105 g dry over 104,707,657 g wet, 14,116 plants. Two frozen lots have no unload and are out.

## The tests and the smoke

- Unit: the unload date from effective_date, else finished_at in Eastern (a 01:30 Eastern unload is that day); the newest session wins; a lot without a finished session out; tests and deleted lots out; the strain pick matching either name; grow method and farm filters; the per plant figure over counted lots only; the total row; To before From refused; the CSV holds the rows shown.
- Smoke: two smoke lots of one strain unloaded, one with a plant count: the report lists one row with both, the per plant over the counted one; a farm filter that excludes them gives the words; the CSV answers 200.
- Render check at 1920 in Lite, CO and Cerberus, and phone width in one view (the table scrolls in its box).
- Gates as always: typecheck 0; vitest under `TZ=UTC` and `TZ=America/New_York`; `node --check scripts/smoke.mjs`; the from-zero smoke (`About to apply 95 migration(s)`), SMOKE PASS, no ` 500 `. Dash and CR audits by character; no personnel name in a tracked file. No git; nothing committed, pushed or deployed. Report to the worktree's `SESSION_REPORTS/` with canon's tree hash and every file touched.
