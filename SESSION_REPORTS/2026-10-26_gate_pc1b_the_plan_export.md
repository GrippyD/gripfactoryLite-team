# Gate: PC1b, the plan's export and his headings

Gated by the Scribe on 2026-10-26 (canon 0.30.552). PASS AS RECEIVED. Nothing is committed, pushed or deployed.

## Trees
- Received: `7b0ec6a5152a86e6` (435 files, 120 migrations), read on the disk in `branches/GFLiteMetrcAPI/app` and rebuilt here. Cursor started it on the pin `761c04653a9b4851`, the live tree after PC1.
- Against the pin, six files are touched:
  - `src/prepackplan.ts`, `src/xlsx.ts`, `src/index.ts`, `src/i18n.ts`;
  - `test/prepackplan.test.ts`, `scripts/smoke.mjs`.
- `public/` and `vendor/` are untouched, and so are `package.json`, `package-lock.json`, `wrangler.toml`, `tsconfig.json` and `vitest.config.ts`. No migration.
- No Scribe fix: the tree to merge is the tree received.

## Read in the diff
- `planRows`: Need is Target minus Packed (not ordered), a blank target counting as zero. Net Need is that minus On Pack Schedule, never below zero, which is the old formula unchanged. Short Product and Net Short floor at zero.
- The picks still read Net Need (`needGrams`); that code is untouched.
- THE SWAP SEAM holds: the export reads `loadPrepackSurface` like the page and adds no Zoho read.
- `xlsx.ts`: `autoFilter` is optional, and unset the writer emits the same bytes (a test pins a small sheet's XML). The element sits right after `</sheetData>`, the order OOXML wants.
  - Noted: the ref starts at A1, so a future caller with a banner row would need it to start at the heading row. The plan has no banner.
- The route sits on the scheduler path behind the identity middleware, with no PIN: the page's own gate.
- `i18n.ts`: the words that left (On hand, Free, Pace, Months, per month) have no other caller.

## The acceptance on the live-data bench
The bench:
- the newest snapshot, `20261026-095457_pre_pc1`, with the plan's tables loaded at the tree's schema (0121);
- a bench-only Admin PIN;
- 200 lb targets typed through `/admin/prepack-targets` for the plan's 17 strains, as his sheet has them.

What it showed:
- **The table:** the nine headings in his order, the note under the table, and Export beside Targets. On hand, Open, Pace and Months are gone from the page.
- **The math:** on all 17 rows, Need, Net Need, Short Product and Net Short equal the formulas worked from the row's own Target, Packed (not ordered), On Pack Schedule and Ready to pack. The warn tone sits on each Short above zero, and a Need below zero shows its minus sign in the plain tone (Bermuda Triangle, -274.56 lb).
- **Against his sheet:**
  - Short Product totals 734.61 lb, as his sheet does. Need totals 2,414.94 (his 2,414.93), Net Need 2,300.24 and Net Short 613.39.
  - Pine State Funk OG reads Short Product 121.22 and Net Short 0, with 175.89 lb on the schedule.
  - The cent differences are rounding: the page rounds each cell from grams, half up, where his sheet subtracts rounded cells (Purple Punch 141.38 against 141.37).
- **The picks:** 37 Plan badges on the Available pane, exactly the set the brief's rule gives on Net Need (oldest lot first, whole packages, stop at the first that covers), worked independently from the bench.
- **The export:**
  - 200, the xlsx type, `prepack_plan_20261026.xlsx`; one sheet, Prepack plan; the thirteen headings in bold.
  - 17 strain rows equal to the page's shown numbers, cell for cell. Then a blank row, the Totals row (equal to the page's), a blank row, "Zoho stock as of 2026-10-26 07:02" and "No sales orders mounted yet".
  - The filter covers A1:M18, the headings and the strain rows. Pounds carry `#,##0.00`. Open, Pace and Months are blank with no orders mounted.
  - LibreOffice opens it and reads the same.
- **Spanish:** the nine headings, the note and Exportar read in Spanish on the page. The file stays English, as the house exports are.
- **Layout:** the scheduler page and the targets page scroll sideways by 0 px in all nine views (Lite, Continuum and Grip at the phone, 820 and 1920). The plan's table scrolls inside its box at the phone and at 820, and fits at 1920.

## Gates on the tree
- typecheck 0.
- vitest TZ=UTC: Test Files 125 passed (125); Tests 1724 passed, 6 skipped (1730).
- vitest TZ=America/New_York: the same.
- `node --check scripts/smoke.mjs`: 0.
- The from zero smoke: `About to apply 120 migration(s)`, SMOKE PASS, exit 0, no 500.
- Dash and CR scan of the six touched files: none, and no person's name in them.

## Rides with the merge
- THE STRAYS IN PLACE (canon 0.30.551): three lines in `.gitignore`, written by the Scribe once Cursor's session had ended: `/gateV*.tar`, `/Patrick Slices.zip`, `SESSION_REPORTS/*.xlsx`.
- The brief, Cursor's report and this gate report.

## The merge
No migration rides, so no snapshot. THE RE-RUN CHECK comes first: the block stops with "Already merged" when the worktree shows no change and its branch holds no commit main lacks. Then:
- the worktree commit on `7b0ec6a5152a86e6`;
- canon committed on main;
- `git merge --no-ff GFLiteMetrcAPI`, with the message on the command line;
- the push, and the worktree fast-forwarded to main.
