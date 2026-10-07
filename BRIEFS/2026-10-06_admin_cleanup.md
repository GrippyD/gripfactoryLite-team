# BRIEF A1: ADMIN CLEANUP (canon 0.30.418)

For the build session (Claude Code or Cursor) opened in the worktree `C:\Users\DennisWallace\Documents\Claude\Projects\gripfactory Practical\branches\GFLiteOpsDashboard` (its `app\` is the app). NOT the main folder `gripfactory Practical\app`: if your working folder is not under `branches\GFLiteOpsDashboard`, stop and say so. Under THE DISPATCH RULE (canon 0.30.155). Built THIRD in the session, after BRIEF PC1 (`BRIEFS/2026-10-06_assign_plant_counts.md`) and BRIEF V29 (`BRIEFS/2026-10-06_dashboard_drying_as_it_was.md`), on the tree V29 leaves; PC1 starts from the LIVE tree after FM1 (`cba603e2aee6dc4b`, 301 files, migrations 0001-0094; main `9da73f4`, worker `06721559`), and all three are gated and pushed together. The tree hash is canon's command, run in `app/` with `wrangler.toml` read as LF: `(find src test scripts migrations -type f; echo wrangler.toml; echo tsconfig.json; echo package.json) | LC_ALL=C sort | xargs sha256sum | sha256sum | cut -c1-16`. One build agent in this worktree at a time. No migration.

## The source (verbatim)

The owner, 2026-10-06: "Admin cleanup 1. Remove: 1. Testing override 2. Environment 3. Sheet Sync 4. Testing Desk 2. Move: 1. Harvest Console to the left of [Maintenance] on the top bar 2. Models to the left of [Harvest Console] on the top bar 3. New Button: [Data Connections] 1. Data Queues 2. Pending Data Uploads 3. Import Data 4. METRC API 4. New Button: [Admin Settings] 1. Lookups 2. Change Log 3. Manual HBNs 5. New Button: [Continuum10] 1. All the continuum stuff - these are hosted at their current addresses and linked from Continuum's site, so those URLs can't change". His picks: the removals "Buttons only" (the pages and what runs behind them stay); Reconcile Ledger Location goes in "Admin Settings".

What the code holds (the live tree): `adminHomePage` in `src/html.ts` draws the Admin tiles (Data Queues, Pending Data Uploads, Import Data, Testing Override, Reconcile Ledger Location, Lookups, Change log, Harvest Console, Sheet sync, Environment, Testing desk, Metrc API, Models, Vendors & Equipment, ERP, Compliance Testing, Harvest Console Lite, Manual HBN). The app bar (`src/html.ts`, `.bar-actions`) carries Maintenance, Reports, Admin. `/harvest` and `/admin*` sit behind the Admin PIN (`pinGate`); `/models` behind its own PIN. `src/nav.ts` gives the back links.

## The law

1. ADMIN HOLDS THREE BUTTONS: [Data Connections], [Admin Settings], [Continuum10] (ES "Conexiones de datos", "Ajustes de administracion", "Continuum10"), in that order, each opening a page of its members' tiles:
   - Data Connections, `/admin/data-connections`: Data Queues, Pending Data Uploads, Import Data, METRC API.
   - Admin Settings, `/admin/settings`: Lookups, Change Log, Manual HBNs, Reconcile Ledger Location.
   - Continuum10, `/admin/continuum10`: Vendors & Equipment, ERP, Compliance Testing, Harvest Console Lite. Their URLs (`/vendors-equipment`, `/erp-software`, `/compliance-testing`, `/harvest-console`) do not change, nor do their pages: Continuum's site links to them.
   The three group pages sit behind the Admin PIN like every `/admin` page.
2. FOUR BUTTONS LEAVE: Testing Override, Environment, Sheet sync, Testing desk leave Admin. Buttons only: their routes still answer at their URLs, the hourly sheet sync and the five minute cron still run, the sensor readings still feed the cure panes, and nothing they write changes.
3. THE BAR: Harvest Console and Models leave the Admin tiles and ride the app bar, in the order Models, Harvest Console, Maintenance, Reports, Admin, on every page and in every view. Their gates stay (Harvest Console behind the Admin PIN, Models behind its own). On a phone the bar's buttons wrap onto a second line inside the screen instead of widening the page (today the bar already runs 432 px on a 390 px phone).
4. THE BACK LINKS: a member page's back link names its group (the Data Connections members back to Data Connections, the Admin Settings members back to Admin Settings); a group page backs to Admin; Harvest Console and Models back to Home. The Continuum pages keep theirs.
5. NOTHING ELSE MOVES. No route renamed or removed; every old Admin tile's URL still answers as it does today.

## The tests and the smoke

- Unit: Admin shows exactly the three buttons in order; each group page lists its members with today's URLs; the four removed titles appear on no Admin page; the bar's links read Models, Harvest Console, Maintenance, Reports, Admin; the back links as law 4.
- Smoke: `/admin` holds the three buttons and none of the old tiles; each group page answers 200 with its members; `/admin/testing-override`, `/admin/environment`, `/admin/sheet-sync`, `/testing` still answer 200 behind the PIN; `/vendors-equipment`, `/erp-software`, `/compliance-testing`, `/harvest-console` answer as before; the bar on `/` carries `/models` and `/harvest` before `/maintenance`.
- Render check at 1920 in Lite, CO and Cerberus (Admin, one group page, the bar), and phone width in one view with the bar inside the screen.
- Gates with PC1's and V29's: typecheck 0; vitest under `TZ=UTC` and `TZ=America/New_York`; `node --check scripts/smoke.mjs`; the from-zero smoke (`About to apply 94 migration(s)`), SMOKE PASS, no ` 500 `. Dash and CR audits by character; no personnel name in a tracked file. No git; nothing committed, pushed or deployed. One report per brief to the worktree's `SESSION_REPORTS/`, each with canon's tree hash and every file touched.
