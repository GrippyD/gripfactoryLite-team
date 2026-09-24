# 2026-09-23 The bar carries Reports and Admin; the panes anchor to the sides (canon 0.30.201, built 0.30.204)

Scribe session, Scribe-direct under G-2 on a quiet tree (the device tree at adfdea689ba17e70, brief H gated as 0.30.203 and its block in the owner's hands; nothing queued for a build). Owner, 2026-09-23, verbatim, with a full-page screenshot of the Prepack scheduling page LIVE: "I think the "Admin" and "Reports" buttons are creating a kind of gutter.  You've rightly always sized our three panes equally, but I'd like them to be anchored to the sides of the screen and still be equal to each other.  I think the solution might be just to make "reports" and "admin" always on top of the screen.  That way the third column can extend eternally if need by and the report and admin button don't need their own spaces." No migration. Not deployed.

## What changed

- THE BAR CARRIES REPORTS AND ADMIN (`src/html.ts`): the two links ride at the end of `header.app-bar` on every page, in every view, as `<div class="bar-actions">` holding `<a class="reports-link" href="/reports">` then `<a class="admin-link" href="/admin">`. The fixed `fab-cluster` at the bottom right (the owner ruling of 2026-09-02, "Lock the Admin button to the bottom right of the screen", which this ruling reverses) is gone, and so is the comment that quoted it; the PIN gate on `/admin*` and the nav (Home, Log) are untouched.
- The three skins (`src/theme.ts`): each sheet's `main { padding-bottom: 6.5rem; }`, `.fab-cluster { position: fixed ... }`, `.admin-fab` and `.reports-fab` rules are replaced by `.bar-actions { display: flex; align-items: center; gap: 0.55rem; margin-left: auto; }` and one shared rule for `.admin-link, .reports-link` in the skin's own idiom (Lite: the accent button, flat, 2.5rem tall; Continuum: the amber pill with her shadow and lift; Cerberus: steel plate, gold ink, letterspaced caps). The Lite identity law and the Continuum reduced-motion lines now name the new classes. No selector or word containing `fab` remains.
- THE PANES ANCHOR TO THE SIDES (`walkSliceChrome`, shared by the three sheets): `.station-triple > * { flex: 1 1 0; min-width: 16rem; }` (equal thirds from a zero basis) and `main:has(.station-triple) { max-width: none; }`, so the two scheduling pages and the prepack station leave the 76rem reading column and take the screen behind the page gutter; every other page keeps `main { max-width: 76rem; margin: 0 auto; }`. The phone form (the panes stacked under `body.device-phone` and at the 480px floor) is unchanged; the Ship external split (`.station-split-3`) is not touched.
- Tests (`test/view.test.ts`, `test/imports.test.ts`) pin the new law: the links inside the header in every view, Reports left of Admin, nothing fixed at the bottom and no bottom clearance on main, `.bar-actions` in every sheet, the zero-basis pane rule and the `:has` release beside the reading column's rule. The smoke (`scripts/smoke.mjs`) asserts the same on the home page and that the old cluster is gone.

## Checks

- `npx tsc --noEmit`: exit 0.
- `npx vitest run`: 49 files, 851 tests passed; the same under `TZ=America/New_York`.
- `node --check scripts/smoke.mjs`: ok.
- From-zero smoke (`SMOKE_PORT=9087`): `About to apply 73 migration(s)`, `SMOKE PASS`, no 500, exit 0.
- Rendered and measured on the smoke's database (`wrangler dev --persist-to .smoke-persist`, Chromium at 1900 by 950): `main` spans 0 to 1900; the three panes are 608px each at 19, 646 and 1273 (the right edge at 1881, the page gutter alone on each side); the `bar-actions` cluster sits in the header at the right edge (top 14); no `.fab-cluster` in the document; the home page's `main` stays 1216px wide (76rem) and centered; the same figures under the Cerberus view; at 420px in the phone form the bar wraps with Reports and Admin at its right and the panes stack.
- Dash audit: 0 on the five files.

## Assumptions for the owner's word

- Reports and Admin sit at the far right of the bar, after the Grip/Lite view pill, Reports left of Admin as before; they keep each skin's button look at bar height (2.5rem) and lose the floating shadow.
- `main:has(.station-triple)` needs a browser with `:has()` (every current Chrome, Edge, Safari and Firefox has it); a browser without it keeps the 76rem column on those pages and loses nothing else.
- The release to the sides covers the two scheduling pages and the prepack station (the pages built as the three panes); the Ship external three-way split and every reading page keep the 76rem column.
- The panes stay equal thirds down to 3 by 16rem plus the gaps (about 54rem); below that they wrap, and on the phone they stack as before.
- The gutter that remains is the page's own 1.2rem padding on each side.

## Deploy

Worker only, no migration. Brief H is on the same tree, gated and not yet deployed, so one block carries both:

```powershell
cd "C:\Users\DennisWallace\Documents\Claude\Projects\gripfactory Practical\app"
npm run deploy:grip
```

## Sealed final check

```
npx tsc --noEmit                      exit 0
npx vitest run                        49 files, 851 tests passed
TZ=America/New_York npx vitest run    49 files, 851 tests passed
node --check scripts/smoke.mjs        ok
rm -rf .smoke-persist && CI=1 SMOKE_PORT=9087 WRANGLER_SEND_METRICS=false npm run smoke
                                      About to apply 73 migration(s); SMOKE PASS; " 500 " lines: 0; exit 0

src/html.ts                 179244  c389d300ff2ec2d7
src/theme.ts                153224  2ffcc03373f2988b
test/view.test.ts            25473  79f5f979530fb9c8
test/imports.test.ts         11751  bc9563234f85e55d
scripts/smoke.mjs           563615  1a119bab57b388b0
tree hash after the commit, sandbox: 4cab54ce345be65c (205 files); the device is verified to match after the copy
dash audit: 0 on every file above
```
