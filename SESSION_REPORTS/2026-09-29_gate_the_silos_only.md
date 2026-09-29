# 2026-09-29 The gate on the silos only (canon 0.30.300): PASSED

Scribe session. The gate on V12, THE SILOS ONLY (BRIEF V12, canon 0.30.299), on his Code session's `SESSION_REPORTS/2026-09-29_the_silos_only.md` in the worktree `branches/GFLiteOpsDashboard`. The report says "Not deployed. Nothing committed. No git was run."; the disk agrees. No Scribe change to the worktree's app. His hand-back, verbatim in part: "`/maintenance` draws silos only, and the aW and MC checks belong to those silos on every page. No migration, pin stays 80."

VERDICT: PASSED. The tree is the brief's four files and nothing else, every check is green, and the render from a fixture with a silo load, a dry room load and a freezer load shows the five silos alone on the landing, the room and freezer tiles on the console with their clocks and no check lines, and Lab Sample's Drying pane with the silo's checks only. V12 is ready to merge; the pre snapshot first, the block stopping on its failure, then the three acts.

## What was gated

1. THE TREE. Against V11's fixed tree (`3f793c8248f5200b`): four files changed (`src/labsample.ts`, `src/index.ts`, `scripts/smoke.mjs`, `test/labsample.test.ts`), nothing new, nothing outside the seal; no migration; `wrangler.toml`, `package.json`, `tsconfig.json`, `public/` and every other file untouched. The app tree hashes `5e2160baab072768`. The seal matches byte for byte (size, sha256, tail) on his disk and in the Scribe's sandbox, the build report included. The worktree's `canon/` and `BRIEFS/` carry the trio and the briefs the Scribe placed at 0.30.299, untouched by the build.
2. THE SCREEN (law 1), read line by line: `maintenanceSpaces` keeps a space when `spaceTypeOf` says silo; the landing route no longer calls `listCurePanes` and passes no extra tiles; the flags, the clock script, the check script and the live script ride as before. The render: Silo 1 through Silo 5, the Silo 3 load with its siren and countdown, the three buttons; no Arlington Dry Room, no Blast Freezer(s), no cure tile.
3. THE CHECKS ARE THE SILOS' (law 2): `attachLoadChecks` computes lines for silo spaces and gives a dry room or a freezer an empty list (so no countdown, no siren, and `checks: []` in `/silos/live.json`); `dryingLoads` joins `dry_spaces` and keeps silo rows; `scheduleLabSample` refuses a load outside a silo ("That load is not in a silo."). Rows already in `lab_sample_requests` for other spaces still show in the middle and right panes, as the brief allowed. The render: the console's Arlington Dry Room and Blast Freezer(s) tiles carry their loads and clocks with no check lines; Lab Sample's Drying pane lists the Silo 3 load's two checks and neither the room's nor the freezer's.
4. NOTHING ELSE MOVES (law 3): the console, `/ops/drying_ops`, Load Silo and the scheduling pages keep every space and the cure panes. The proofs (law 4) are in the smoke and the tests: `maintenanceSpaces` on a fixture of a silo, a dry room and a freezer; a freezer load with no line beside a silo load with one; a dry room load off the Drying pane while its stored request stays in the middle; the refusal with status 400.
5. THE FLOOR: the Arlington Dry Room's `space_type` is `dry_room` in data (the test reads it), so the filter answers by type, not by name, and a new silo added in Admin joins the screen.

## Observations for his word (no hold)

- The smoke's landing proof reads the page with the `<style>` block removed, because the theme names the Arlington Dry Room in a CSS comment on every page. Cosmetic; the drawn page carries no room.
- The Blast Freezer(s) tile in the render says "UNLOADING · 0% FULL" with a load in it; that is the freezer's own words from an earlier slice, untouched here.
- The observations of 0.30.296 stand (the shared-space summary line until a reload, an ended load's open check in the middle pane, the CO hover rules, the consoleicons header comment).

## Gates on the tree as received (the Scribe's sandbox, the worktree's `app/`)

- `npm run typecheck` with the generated types file deleted first: exit 0.
- `npx vitest run`: 67 files, 968 tests passed; the same under `TZ=America/New_York`.
- `node --check scripts/smoke.mjs` and `node --check scripts/icon-proofs.mjs`: ok.
- `npm run proofs:icons`: `85b22429de13e975`, unchanged (the icon module is untouched).
- From-zero smoke (`SMOKE_PORT=9213`): `About to apply 80 migration(s)`, `SMOKE PASS`, no ` 500 ` line; the dev server ended by the timeout after the pass.
- The render from a fixture (a Silo 3 load 30 hours in with an aW check overdue, an Arlington Dry Room load, a Blast Freezer(s) load; aW [24] and MC [72]): the landing, the console's strip and Lab Sample, screenshotted at 1100 px; the landing handed to his eye.
- Dash audit: 0 (em and en), and no CR byte, on the four files, the build report, `wrangler.toml`, `tsconfig.json` and `package.json`. Secret grep (six patterns): no value anywhere. No personnel data.

## The merge (his hands, four acts in order, the snapshot first and the block stopping on its failure)

```powershell
cd "C:\Users\DennisWallace\Documents\Claude\Projects\gripfactory Practical\app"
node scripts/db-snapshot.mjs pre_silos_only
if ($LASTEXITCODE -ne 0) { throw "snapshot failed, stop here" }
cd "C:\Users\DennisWallace\Documents\Claude\Projects\gripfactory Practical\branches\GFLiteOpsDashboard"
git add -A
git commit -m "V12: the silos only" -m "The maintenance screen draws the silos alone (no dry room, no freezer, no cold storage tiles) and the aW and MC checks are the silos' on every page; Lab Sample lists silo loads only and refuses a load outside a silo; no migration. Canon 0.30.300 and the briefs since the branch plan ride in canon/ and BRIEFS/.`n`nCo-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`nClaude-Session: https://claude.ai/code/session_01VDz7UdaTSkjq69GvDfDWd7"
cd "C:\Users\DennisWallace\Documents\Claude\Projects\gripfactory Practical"
git merge --no-ff GFLiteOpsDashboard -m "Merge V12: the silos only"
git push
```

If the snapshot answers 7403 on its first query, the block stops before the commit; run the snapshot line alone once more and then the three acts. The push runs the workflow: typecheck, the tests, `apply migrations` (none to apply), the deploy. His paste back: the snapshot's last line, the push's output, the run's result and the Version ID from the deploy step's log; the Scribe reads main after the merge and folds LIVE. This snapshot is the first after 0080: `lab_sample_requests: 0 rows` in its table list confirms the migration.

## Sealed final check

```
rm worker-configuration.d.ts; npm run typecheck      exit 0
npx vitest run                        67 files, 968 tests passed
TZ=America/New_York npx vitest run    67 files, 968 tests passed
node --check scripts/smoke.mjs        ok
node --check scripts/icon-proofs.mjs  ok
npm run proofs:icons                  85b22429de13e975, unchanged
rm -rf .smoke-persist && CI=1 SMOKE_PORT=9213 WRANGLER_SEND_METRICS=false npm run smoke
                                      About to apply 80 migration(s); SMOKE PASS; " 500 " lines: 0
the build report's seal (4 files) verified byte for byte, device and sandbox:
app/src/labsample.ts                 37629  fc43ebe0410154a6
app/src/index.ts                    147480  7817e19ec6cf56b6
app/scripts/smoke.mjs               623817  fa7880248fe4d45b
app/test/labsample.test.ts           14818  148fe1d897ac171f
changed against V11's fixed tree, not in the seal: none
the app tree: 5e2160baab072768 (V11's 3f793c8248f5200b plus the four)
the build report: SESSION_REPORTS/2026-09-29_the_silos_only.md  4237  a173b55d4043e662
dash audit: 0; CR audit: 0; secret grep: no values; personnel data: none
```
