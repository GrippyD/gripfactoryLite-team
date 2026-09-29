# 2026-09-29 The silos only

V12 of THE BRANCH PLAN (canon 0.30.299), built in the worktree `branches/GFLiteOpsDashboard` under THE DISPATCH RULE (canon 0.30.155), on V11 THE MAINTENANCE NODE. No migration. The smoke pin stays at 80. Not deployed. Nothing committed. No git was run.

## What changed

`/maintenance` draws the spaces whose `spaceTypeOf` is `silo` and nothing else. A pure `maintenanceSpaces(live)` in `src/labsample.ts` does the filter. The route does not call `listCurePanes`. `extraTiles` is the empty string, so there is no Arlington Dry Room, no Blast Freezer(s), and no cure tile. The flags map, the clock script, the check script, and the live script still ride with the strip.

The aW and MC lines are the silos' on every page. `attachLoadChecks` computes lines only for loads in silo spaces. A dry room or a freezer takes `loadChecks: []`, so it has no countdown and no siren, and its `checks` in `/silos/live.json` is `[]`. Lab Sample's Drying pane lists silo loads only: `dryingLoads` joins `dry_spaces` and keeps a row when `spaceTypeOf` says silo. `scheduleLabSample` refuses a load that is not in a silo with "That load is not in a silo." (status 400). A request already stored for another space is left as it is and still shows in the middle and right panes.

The console's Drying section, `/ops/drying_ops`, Load Silo, and the scheduling pages still draw every space and the cure panes. Those dry room and freezer tiles lose only the check lines V11 gave them. The interval lists, the button order, the stub, the icons, and the migration count are untouched.

The two existing Lab Sample tests now load Silo 1 by name. The first dry space by name is the Arlington Dry Room, which this slice will not schedule.

## Assumptions for his word

- "Sold storage rooms" are the cold storage rooms, CSA and CSB.
- The checks follow the screen: aW and MC are the silos' checks, so the dry room and the freezer take no lines anywhere, not only on the maintenance screen. This build followed that law (law 2 as well as law 1). If he wants the Arlington Dry Room to keep its checks on the console, law 2 comes back out and only the screen filter stays.
- A space is a silo by `spaceTypeOf`, not by name, so a new silo joins the screen without a code change.

## Gates

Run in the worktree's `app/`.

- `npm run typecheck`: exit 0.
- `npx vitest run`: 67 files, 968 tests passed under `TZ=UTC`, and the same under `TZ=America/New_York`.
- `node --check scripts/smoke.mjs`: exit 0.
- From-zero smoke (`SMOKE_PORT=9212`, `WRANGLER_SEND_METRICS=false`): `About to apply 80 migration(s)`, `SMOKE PASS`, ` 500 ` lines: 0, exit 0.
- The landing proof ignores the stylesheet. The theme names the Arlington Dry Room in a CSS comment on every page (the Move To walk already notes this). The assertion reads the page with that style block removed. `Blast Freezer` and `data-cure-pane` are absent from the full body. `Silo 1` is on it. `/silos/live.json` still carries Silo 1, the Arlington Dry Room, and the Blast Freezer(s), and the freezer's `checks` is `[]`.
- Dash audit: 0 on every file below (U+2014 and U+2013). No CR byte in those files.
- `METRC_INTEGRATOR_KEY = "`, `METRC_USER_KEY = "`, `MS_CLIENT_SECRET = "`, `SENSORPUSH_PASSWORD = "`, `CLOUDFLARE_API_TOKEN=`, and `CLOUDFLARE_API_TOKEN: "` do not appear in those files. No personnel data.

## Deploy

Not deployed from this session. Nothing committed. No git was run.

## Sealed final check

```
npm run typecheck                     exit 0
npx vitest run (TZ=UTC)               67 files, 968 tests passed
TZ=America/New_York npx vitest run    67 files, 968 tests passed
node --check scripts/smoke.mjs        exit 0
SMOKE_PORT=9212 WRANGLER_SEND_METRICS=false node scripts/smoke.mjs
                                      About to apply 80 migration(s); SMOKE PASS; " 500 " lines: 0; exit 0
dash audit: 0; CR audit: 0; secret grep: no values; personnel data: none
```

```
app/src/labsample.ts               37629  fc43ebe0410154a6
TAIL }
app/src/index.ts                  147480  7817e19ec6cf56b6
TAIL export default worker;
app/scripts/smoke.mjs             623817  fa7880248fe4d45b
TAIL });
app/test/labsample.test.ts         14818  148fe1d897ac171f
TAIL });
```
