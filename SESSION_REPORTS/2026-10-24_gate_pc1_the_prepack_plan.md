# Gate: PC1, the prepack plan

Gated by the Scribe on 2026-10-24 (canon 0.30.548). PASS WITH TWO SMALL SCRIBE FIXES. Nothing is committed, pushed or deployed.

## Trees
- Received: `a6503a5065c2c329` (435 files, 120 migrations), read on the disk and rebuilt here. Cursor started it on the pin `663ed56674078d88`, main after THE QUEUE, TWO.
- Against the pin:
  - new: `migrations/0121_prepack_targets.sql`, `src/prepackplan.ts` (862 lines) and `test/prepackplan.test.ts`;
  - small edits to `src/db.ts`, `src/fginventory.ts` (`prepackEach` exported), `src/scheduling.ts`, `src/index.ts`, `src/html.ts`, `src/nav.ts`, `src/theme.ts`, `src/i18n.ts`, `scripts/smoke.mjs` and `test/admincleanup.test.ts`.
- Fixed: `761c04653a9b4851` (435 files), written into the worktree and read back:
  - `src/prepackplan.ts` `dfb5b0daa2bd81ee`;
  - `src/i18n.ts` `dc6dd0b1442c0d62`;
  - `test/prepackplan.test.ts` `2c774e1a04d82899`.

## The hand-back, as received
typecheck 0. vitest 1719 passed and 6 skipped in both zones; the sensor history timeout Cursor met did not recur here. The from zero smoke: `About to apply 120 migration(s)`, SMOKE PASS, no 500.

## THE SWAP SEAM
Every read of a Zoho table in the slice sits in the two named functions:
- `zohoPrepackStock`: FG Inventory's own listing query and rules;
- `zohoPrepackOrders`: `so_mounts`, `mounted_sales_orders`, `mounted_sales_order_lines`, and `listings` for each grams.

Nothing else in the slice names a Zoho table, and `planRows` is pure.

## The acceptance on the live-data bench (0121 applied)
- **The plan's numbers:** every row equals an independent count made straight from the bench's tables, using the panes' own SQL and FG's listing rules. There are 14 strains: 10 with Zoho stock, 3 scheduled, 4 ready.
- **No orders:** with no sales order mount, the header reads "No sales orders mounted yet", and Open, Pace and Months are blank.
- **Targets, all behind the Admin PIN:**
  - the page answers 401 without the PIN;
  - a save with no reason, or with three decimals, is refused (400);
  - 425.21 lb stores 190,494.08 g, which is exactly 425.21 times 448;
  - the same strain in other casing updates the one live row, and every change lands in the change log;
  - clearing needs a reason, and it soft deletes the row (the row stays, the plan's Target goes blank).
- **The picks:** a Need of 323.96 lb against 11 ready packages picks exactly the 7 the brief's rule gives. That rule is oldest lot first, whole packages only, stopping at the first package that covers the Need. Seven Plan badges show on the Available pane, and the plan schedules nothing itself.
- **Layout:** the scheduler page and the targets page scroll sideways by 0 px in all nine views (Lite, Continuum and Grip at 390, 820 and 1920). The plan's table scrolls inside its box at the phone.

## The fixes
1. **Months read as pounds.** The Months cell went through the pounds formatter, so 2 months would have shown as 0.00 lb. It shows nothing today because no orders are mounted, but would have been wrong once Zoho sales orders are mounted. Months now reads as a plain number (2.00), and Pace stays in pounds per month. A new test fails on the hand-back and passes on the fix.
2. **Spanish accents.** Four Spanish lines lacked their accents (Aún, más, máximo, está). They are corrected, and the test's line follows.

## Gates on the fixed tree
- typecheck 0.
- vitest TZ=UTC: Test Files 125 passed (125); Tests 1720 passed, 6 skipped (1726).
- vitest TZ=America/New_York: the same.
- `node --check scripts/smoke.mjs`: 0.
- The from zero smoke: `About to apply 120 migration(s)`, SMOKE PASS, exit 0, no 500.
- Dash and CR scan of the 13 touched files: none.

## Decided, and noted for the owner
- A target typed in other casing renames the strain as shown, because the typed name wins (Cursor's reading).
- The plan reads every mounted order on each view. That is fine at today's volume (no orders yet), and a later slice can narrow it to open orders plus the trailing window.

## The merge
One migration rides (0121), so the snapshot comes first. A merge block stops only when a table other than `record_change_log` fails. Then:
- the worktree commit on `761c04653a9b4851`;
- canon committed on main;
- `git merge --no-ff GFLiteMetrcAPI`, with the message on the command line;
- the push.
