# PC1: the prepack plan

Worktree `branches/GFLiteMetrcAPI`. One plain session. No git. Nothing is committed, pushed, or deployed.

## Tree

- Received: `663ed56674078d88` (432 files, 119 migrations). Canon hash in `app/`, `wrangler.toml` read as LF. That is the pin, main after THE QUEUE, TWO.
- Left: `a6503a5065c2c329` (435 files, 120 migrations).

## Files

- `app/migrations/0121_prepack_targets.sql`: `prepack_targets`, guarded, one live row per `strain_key`.
- `app/src/prepackplan.ts`: `planRows`, the two Zoho readers, the Plan fold, and `/admin/prepack-targets`.
- `app/src/fginventory.ts`: `prepackEach` is exported.
- `app/src/db.ts`: the Available feed also carries `created_at`. The pane order is unchanged.
- `app/src/scheduling.ts`: the Plan fold above the panes, and `data-plan-pick` plus a Plan badge on the picked Available rows.
- `app/src/index.ts`: the prepack route loads the plan, and the targets routes sit behind the Admin PIN.
- `app/src/html.ts`: Admin Settings lists Prepack targets after Field estimates.
- `app/src/nav.ts`: the targets page goes back to Admin Settings.
- `app/src/theme.ts`: Short above zero uses the warn tone.
- `app/src/i18n.ts`: the new words, each with a Spanish line.
- `app/scripts/smoke.mjs`: from zero applies 120 migrations, checks the Plan fold, and saves a target.
- `app/test/prepackplan.test.ts`: the plan, the picks, the Zoho seam, and the targets.
- `app/test/admincleanup.test.ts`: the settings list includes the new page.

## Decided

- The shown strain is the typed or source name with the edges trimmed and the inner spaces collapsed to one. Casing stays. The key is that name in lowercase.
- A package with no entry date sorts after every dated lot. The same for a missing `created_at`.
- With no `so_mounts` row, Open and Pace are blank and Need leaves Open out. Once orders are mounted, a strain with no open quantity shows zero.
- Pace is the shipped grams in the window divided by `dd_moh_window_months`. Months is Free divided by that pace. Both are blank when the strain shipped nothing in the window. The window is the farm's today back that many calendar months, inclusive, by `order_date`. A missing or unreadable setting uses 3.
- The totals row adds the row figures. Need and Short there are the sums of the floored rows.
- A stored zero shows as 0.00 lb. Blank means there is no live target. Clearing is its own post, a soft delete with a reason.
- Order lines take each grams from a listing found by SKU, then by item name, then from the prefix rule. An inactive listing can still supply that each grams. On hand uses FG Inventory's listing query, so inactive, gone, and deleted listings stay out. The strain on an order line is `itemStrain` of the line's item name.
- `data-plan-pick` sits in front of `data-schedule-id`, so the tag and HBN markup on a row stays as it was. The page function draws the fold only when a plan is passed. The route always passes one.

## Gates

- `npx tsc --noEmit`: exit 0.
- vitest `TZ=UTC`: Test Files 125 passed (125). Tests 1719 passed, 6 skipped (1725). VITEST_EXIT 0.
- vitest `TZ=America/New_York`: Test Files 125 passed (125). Tests 1719 passed, 6 skipped (1725). VITEST_EXIT 0.
- Two earlier full UTC runs timed out `test/sensorhistory.test.ts` at 5 seconds (`uses the configured days, and 0 or junk leave an 11-day row`). That file passes alone under `TZ=UTC` (7 tests). The UTC line above is the run that finished.
- `node --check scripts/smoke.mjs`: exit 0.
- From zero smoke, background: `About to apply 120 migration(s)`. `SMOKE PASS`. `SMOKE_EXIT 0`. No 500 in the log.
- Dash and CR scan of every touched file: U+2013 0, U+2014 0, CR 0. The new files name nobody.

Left tree `a6503a5065c2c329`. Nothing is committed, pushed, or deployed.
