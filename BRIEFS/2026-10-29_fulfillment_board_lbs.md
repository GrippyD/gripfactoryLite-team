# BRIEF FB1: THE FULFILLMENT BOARD IN POUNDS, PREPACK BY BAG SIZE, AND THE GRIP OUTLINE ON THE TRUCK (canon 0.30.564)

Filed by the Scribe on 2026-10-29 from the owner's word, relayed by The Schmerblez King (t34u, t35u and the rulings below). Three changes on the fulfillment board's Shipping Today, Submitted and Accepted cards: Bulk Bud and Prepack read in lbs; Prepack is entered and counted by bag size; a permanent Grip logo outline sits on the Shipping Today trailer.

For the build session (a Cursor cloud agent, dispatched by The Schmerblez King). REPO: GrippyD/gripfactoryLite on GitHub. BASE: origin `main` at commit `08c2617426b407f6fdf6ca5f3455dbcc7fd2b930` (canon 0.30.563) or the canon 0.30.564 commit that carries this brief, which descends from it (the dispatch note names the exact SHA). WORK ON YOUR OWN BRANCH `fb1-fulfillment-lbs`, cut from that base, and open a pull request into `main`. Never push to or merge into `main` directly; never force-push; never touch `GFLiteOpsDashboard`. Each commit carries the trailer lines "Scribe: Gripfactory Lite" and "Built-By: cursor-agent" (G-1a). Nothing deployed, no `wrangler deploy`, no remote D1 command. Never edit `canon/` or an existing migration. No data is loaded or changed by this build: no existing `fulfillment_overrides` row is rewritten, split or deleted.

THE MIGRATION NUMBER. The migration head on main is `0123_field_more_trucks.sql`. Number `0124` is taken by LD1 (`0124_distillate_ledger.sql`, merged on `GFLiteOpsDashboard` at 4b4e926, not yet on main). This brief's one migration is therefore `0125_fulfillment_prepack_bags.sql`, so the two lines never collide when GFLiteOpsDashboard merges into main. OWNER RULING NEEDED R9: the deploy order (proposed: LD1 deploys first, then FB1, so migrations apply in number order).

HARD STOPS (check before touching anything; stop and say so in the PR or the session report if any fails): origin/main does not contain `08c2617426b407f6fdf6ca5f3455dbcc7fd2b930`; the migration head on main is not `0123_field_more_trucks.sql`; `app/migrations/0124_*` or `app/migrations/0125_*` exists on main; `fulfillment_overrides` in `0081_fulfillment_override.sql` lacks the columns listed below or already has `bag_grams`; `GRAMS_PER_LB` in `src/config.ts` is not 448; `PREPACK_UNITS_DEFAULT` in `src/config.ts` is not `["3.5", "7", "14", "28"]`; `app/public/brand/grip.svg` is missing or is not one `<path>` with `viewBox="0 0 1782 1798"`; any open OWNER RULING NEEDED line below that the dispatch note does not answer is one the build would have to guess (build the stated safe default and list it in the session report; never guess past it).

---

## Rulings and defaults

OWNER RULINGS 2026-10-29 (his own words, canon 0.30.564):
- R1: 448 g per lb.
- R2: option (c), Prepack is split by bag size (3.5, 7, 14, 28 g); one append-only migration and the bigger build.
- R5: lbs only, no original unit beside it.
- SCOPE: the Shipping Today, Submitted and Accepted cards everywhere they render, not only the Harvest Console view.

PROPOSED DEFAULTS STANDING, OWNER MAY OVERRULE (proposed by The Schmerblez King, not overruled, not his words):
- R3: two decimals, rounded half up, thousands grouped (`format2`).
- R4: the label is `lbs`.
- R6: the other eight rows keep their METRC units.
- R7: the logo is the existing `public/brand/grip.svg`, centered in the trailer panel at full panel height, in the icon's own stroke color and weight.
- R7d: the outline is always shown, empty days included.

OPEN (the build takes the safe default written in the law and says so): R8 (legacy Prepack rows), R9 (deploy order), R10 (the flat prepack=28 config), R11 (unsplit Prepack typed going forward).

## What the code holds (read these first; line numbers on main 08c2617)

- `src/fulfillmentboard.ts`: `FULFILLMENT_ROWS` (line 17 onward; `bulk_bud` unit "g", `prepack` unit "ea"); `fulfillmentSeries` (line 79 onward; an each becomes grams through `eachGrams` for the bar only); `stackedBar` (line 113 onward); `legend` (line 131 onward; the text `${name} ${formatGrams(value)} ${unit}`); `withCargo` (line 142 onward; splices the bar rects after the trailer's cargo rect); `paneMarkup` (line 150 onward); `fulfillmentSection` (line 173); `listFulfillmentCells` (SELECT at line 194); `loadFulfillmentSection` (line 209); `fulfillmentOverridePage` (grid at line 224); `saveFulfillmentOverride` (line 262 onward, insert, update with log, clear by soft delete).
- The figures are typed by hand on `/admin/lookups/fulfillment_override` (canon 0.30.306: "The Admin panel is the sole source of the figures"); they are not Zoho lines and not item UOM. All three columns (Accepted, Submitted, Shipping Today) come from the same table, `fulfillment_overrides`, keyed by `col`.
- `migrations/0081_fulfillment_override.sql`: `fulfillment_overrides (id, entry_date, row_key, col, value NUMERIC, unit, created_at, created_by, updated_at, updated_by, deleted_at, deleted_by, delete_reason)`; the partial unique index `fulfillment_overrides_day_row_col (entry_date, row_key, col) WHERE deleted_at IS NULL`; the app_config row `fulfillment_unit_grams` = `prepack=28, mobs=70, prerolls=1, vapes=1`.
- `src/config.ts`: `GRAMS_PER_LB = 448` (line 895, THE 448 POUND, canon 0.30.164); `format2` (line 913); `PREPACK_UNITS_DEFAULT = ["3.5", "7", "14", "28"]` (line 1596) and the app_config key `prepack_units` (line 547), the bag sizes the Prepack line already uses; `FULFILLMENT_UNIT_GRAMS_DEFAULT` (line 1686).
- Render sites: the board renders only through `fulfillmentSection`, called in `src/console.ts` (line 2649) and loaded in `src/index.ts` (line 2055); the computer and phone layouts both come from that one markup. The vendored `public/harvest-console/harvest-console-lite.html` uses the word fulfill for marketplace footprints, not this board; it is a vendored file and is not edited. If the build finds any other render of these three cards, it applies the same law there and lists it.
- `src/consoleicons.ts`: `TRAILER_CARGO = { x: 41.46, y: 2.15, width: 116.14, height: 22.83 }` (line 50); the wide shipping icon's `viewBox="0 0 160 37"` (line 71); `SHIPPING_TRUCK_PATH` (line 230); `shipping()` (line 232) with the empty `<rect data-icon-trailer-cargo>` (line 236). SVG, not CSS.
- `app/public/brand/grip.svg` (6,889 bytes): the real GRIP mark (canon 0.14.0, the brand slice), one `<path fill="currentColor" fill-rule="evenodd">`, `viewBox="0 0 1782 1798"`.

## The law

1. THE MIGRATION, `0125_fulfillment_prepack_bags.sql`, one statement, additive: `ALTER TABLE fulfillment_overrides ADD COLUMN bag_grams NUMERIC;` (nullable, no default). Postgres-portable (plain ADD COLUMN), append-only, no existing row touched, no index dropped or replaced, no seed. The existing audit columns, soft delete and `record_change_log` path (G-5) carry the new cells unchanged.
2. THE PREPACK CELLS BY BAG SIZE. A Prepack cell for one bag size is a `fulfillment_overrides` row with `row_key` = `prepack@<size>` (for example `prepack@3.5`, `prepack@7`, `prepack@14`, `prepack@28`), `unit` = `ea`, `value` = the bag count (a whole number, as today), and `bag_grams` = the size in grams written at save time (3.5, 7, 14, 28). The existing partial unique index then holds one live cell per day, size and column with no index change. The sizes listed come from `prepack_units` (app_config, default `PREPACK_UNITS_DEFAULT`), read the way the Prepack line reads them, never a new literal list (L-4). A size later removed from `prepack_units` stays readable on its old rows through their `bag_grams`.
3. THE ADMIN ENTRY. On `/admin/lookups/fulfillment_override`, the single Prepack row is replaced in the grid by one row per bag size, labelled "Prepack 3.5 g", "Prepack 7 g", "Prepack 14 g", "Prepack 28 g" (EN and ES), each with the three columns, whole-number counts in ea, the same masked inputs. Save inserts, updates (old and new value logged with reason "typed") or clears (soft delete, reason "cleared") exactly as the other cells; nothing is hard deleted. The other nine rows are unchanged.
4. THE LEGACY PREPACK ROWS (OWNER RULING NEEDED R8; the safe default below is what the build does). A live row with `row_key` = `prepack` (no bag size, `bag_grams` NULL) is legacy: it is never split, converted, rewritten or deleted by the build or by any script. On the Admin grid a day that holds one shows it as a read-only "Prepack (unsplit, legacy)" line per column with its count, visibly flagged, which a hand may clear (soft delete, logged) but not edit or retype. On the board it shows in the legend as "Prepack (unsplit) N ea" with a visible flag mark (`data-fulfill-legacy`), is NOT converted to lbs and is NOT added to any lbs figure; in the bar it keeps today's measure (count times the `fulfillment_unit_grams` prepack figure) so a past day's picture does not change. New typing of an unsplit Prepack count is not offered (R11).
5. THE POUND. lbs = grams / `GRAMS_PER_LB` (448, imported, never a literal) (R1).
   a. Bulk Bud: lbs = the typed grams / 448.
   b. Prepack: lbs = sum over the day's bag-size cells in that column of (count x `bag_grams`) / 448. One legend line "Prepack N lbs" per column (the sizes summed; the per-size counts are not shown on the card, R5).
6. THE DISPLAY (R5, R3, R4). On all three cards everywhere they render, Bulk Bud and Prepack read in lbs only, no original unit beside them: `format2` of the pounds (two decimals, half up, thousands grouped) followed by `lbs`. For example 3,617 g reads `8.07 lbs`; 30 g reads `0.07 lbs`; 160 bags of 3.5 g read `1.25 lbs`. A figure that rounds to 0.00 from a non-zero amount still reads `0.00 lbs` (R3 as standing; see question Q4). The other eight rows (Biomass/Trim, Prerolls, Shake, Bulk Distillate, Vapes, MOBs, Bulk Isolate, Bulk Infused) keep their g or ea text (R6). The Admin grid keeps entry units (g for Bulk Bud, ea per bag size).
7. THE BAR (real grams). Segment proportions use grams: Bulk Bud its grams; Prepack sum(count x `bag_grams`); a legacy unsplit Prepack row as in law 4; the other rows as today. `segmentWidths` and `stackedBar` are unchanged in behavior; for a day with no Prepack, the output is byte-identical to today.
8. THE GRIP OUTLINE (R7, R7d), Shipping Today only.
   a. The source is `public/brand/grip.svg`: its path `d` copied byte for byte into a constant (for example `GRIP_MARK_PATH` and `GRIP_MARK_VIEWBOX` in `src/consoleicons.ts`), never retraced, simplified, redrawn or invented. If the file cannot be used as is, STOP and say so; no substitute shape.
   b. Outline only: `fill="none"`, `stroke="currentColor"` at the icon's own stroke weight (`CONSOLE_ICON_STROKE`), `vector-effect="non-scaling-stroke"`; no fill, mask, opacity block or background, so every bar segment stays visible through it.
   c. Placement: scaled uniformly (aspect kept) to the full height of `TRAILER_CARGO` (22.83) and centered horizontally and vertically in it; inside the shipping icon's svg, after the bar rects so it paints on top; `pointer-events="none"`, `aria-hidden="true"`, `data-fulfill-grip-outline`.
   d. Always shown, empty days included (R7d): the outline is drawn on the Shipping Today trailer whether or not the day has figures.
   e. It changes nothing in the series, the segment rects (count, x, width) or the Submitted and Accepted bands.
9. NOTHING ELSE MOVES. No route added, no config key added or changed (`fulfillment_unit_grams` stays as it is, R10), no Zoho, METRC, feed or cron change, no vendored file edited. New words go into `src/i18n.ts` EN and ES.

## Performance (a standing law, 0.30.438)

The loader still reads one day by `entry_date` with bound values and the config rows; no extra query per cell. Anything over one second on the live-data bench is a defect.

## The tests and the smoke

- Unit (`test/fulfillmentboard.test.ts`):
  - Bulk Bud 3,617 g reads `8.07 lbs`, 30 g `0.07 lbs`, on each of the three cards; no `g` text on the Bulk Bud line.
  - Prepack: 560 bags at 28 g read `35.00 lbs`; 160 at 3.5 g plus 10 at 28 g read `1.88 lbs` (560 + 280 = 840 g / 448 = 1.875, half up); 2,720 at 28 g read `170.00 lbs`; no `ea` text on the split Prepack line.
  - The pound uses the imported `GRAMS_PER_LB`; a size added to `prepack_units` (for example 1) appears on the grid and computes.
  - Bar: segment grams for split Prepack are sum(count x bag_grams); for a day without Prepack the `stackedBar` output is identical to the pre-change output.
  - Legacy: a seeded `row_key = 'prepack'` row is listed as "Prepack (unsplit)" with `data-fulfill-legacy`, in ea, excluded from lbs, its bar grams at the config figure; the Admin grid shows it read-only and a clear soft-deletes it with reason "cleared" in `record_change_log`; no code path writes `bag_grams` to it or splits it.
  - Save: a bag-size cell inserts with `bag_grams` set, updates with old and new logged, clears by soft delete; the unique index refuses a second live cell for the same day, size and column.
  - The migration applies on a from-zero database and on a database holding legacy rows, which keep `bag_grams` NULL.
  - Outline: the Shipping Today pane holds exactly one `data-fulfill-grip-outline` element after the last `data-fulfill-segment` rect, `fill="none"`, a stroke, non-scaling; its `d` equals the path in `public/brand/grip.svg` (the test reads the file); its transform keeps it inside `TRAILER_CARGO` (x 41.46 to 157.60, y 2.15 to 24.98) and centered; present on an empty day too; absent on Submitted and Accepted; rect count, x and width identical with and without it.
  - The other eight rows keep their text; the Spanish words.
- Smoke (`scripts/smoke.mjs`): apply from zero (the `About to apply` line reads 123 migrations on this base, 0001 to 0123 with one gap plus 0125); type Bulk Bud and two Prepack sizes on the Admin grid for a day; the console shows `lbs` on all three cards and one `data-fulfill-grip-outline` on Shipping Today; a day with no figures still shows the outline; the change log carries the bag-size cells; no ` 500 `.
- Gates as standing: typecheck 0; vitest under `TZ=UTC` and `TZ=America/New_York`; `node --check scripts/smoke.mjs`; the from-zero smoke, SMOKE PASS; dash and CR audit by character (no em or en dashes in any file touched); no personnel names; no credential or login string in any file.

## Build shape

`migrations/0125_fulfillment_prepack_bags.sql`; `src/fulfillmentboard.ts` (rows by bag size, the pound helper, legend, legacy flag, the outline in the cargo splice, the loader reading `bag_grams` and `prepack_units`); `src/consoleicons.ts` (the copied mark constant); `src/i18n.ts`; `test/fulfillmentboard.test.ts`; `scripts/smoke.mjs`. Session report `SESSION_REPORTS/<build date>_fulfillment_board_lbs.md` with the sealed final check, committed on `fb1-fulfillment-lbs` and linked in the PR.

## Owed after the build (the Scribe and the owner)

The Scribe gates the PR against this brief. Merge and deploy wait for the owner's yes, in the order R9 sets. Any handling of legacy Prepack rows beyond law 4 is a Scribe repair the owner runs at his keyboard, only after R8 is ruled.
