# BRIEF V12: THE SILOS ONLY (canon 0.30.299)

For the build session (Claude Code or Cursor) opened in the worktree `branches/GFLiteOpsDashboard` (its `app/` is the app), under THE DISPATCH RULE (canon 0.30.155), the slice his ruling of 2026-09-29 adds to THE BRANCH PLAN (`BRIEFS/2026-09-28_the_branch_plan.md`) on V11, THE MAINTENANCE NODE (live at 0.30.298), built before V5 unless he says otherwise. Canon wins over this brief where they differ; read `canon/_NOW.md` first. No migration; the smoke pin stays at 80. Commit nothing, push nothing, deploy nothing, run no git.

## The ruling (owner, 2026-09-29, verbatim)

"Let's remove the dry room, blast freezer, and sold storage rooms from the maintenance screen."

The Scribe reads "sold storage rooms" as the cold storage rooms, CSA and CSB, the cure panes (canon 0.30.164: Cold Storage A and B). The maintenance screen is `/maintenance`, the landing V11 built. What stays on it is the silos.

## What the Scribe read (main `4fd9a12`, the tree `3f793c8248f5200b`)

1. THE LANDING. `src/index.ts`, the `MAINTENANCE_PATH` route: `loadSiloVisuals` gives every dry space (the five silos, the Arlington Dry Room, the Blast Freezer(s)), `listCurePanes` gives CSA and CSB, and `siloStrip(await attachLoadChecks(db, live, now), now, locale, curePanes(cure, locale), flags)` draws them all, the same strip the console draws.
2. THE SPACE'S KIND. `spaceTypeOf(space)` in `src/silo.ts` (canon 0.30.106) answers `silo`, `dry_room` or `freezer` from `space_type`, else from the stored shape; a silo is the cone-topped cylinder. A sixth silo added in Admin is a silo by the same answer.
3. THE CHECKS. `attachLoadChecks` in `src/labsample.ts` computes the aW and MC lines for every open load of every space it is handed; `dryingLoads` lists every open load for Lab Sample's Drying pane; `scheduleLabSample` accepts any open load. On the floor `lab_sample_requests` holds 0 rows and both interval lists are empty, so nothing is in flight.
4. THE LIVE PAINT. `/silos/live.json` carries every space; the live script paints by tile id and skips an entry whose tile is not on the page (`siloLiveScript`, the `[data-silo]` lookup), so a page that draws fewer tiles is safe.

## The law to build

1. THE SCREEN. `/maintenance` draws the spaces whose `spaceTypeOf` is `silo` and nothing else: no Arlington Dry Room, no Blast Freezer(s), no cure tiles (`extraTiles` is the empty string; `listCurePanes` is not called on this route). The flags map, the clock script, the check script and the live script ride as before. A pure `maintenanceSpaces(live)` in `src/labsample.ts` does the filtering and is tested.
2. THE CHECKS ARE THE SILOS'. `attachLoadChecks` computes lines only for loads in silo spaces; a dry room's or a freezer's load takes no countdown and no siren on any page, and its space's `checks` in `/silos/live.json` is empty. Lab Sample's Drying pane lists silo loads only (`dryingLoads` joins `dry_spaces` and keeps the silos by the same answer). `scheduleLabSample` refuses a load that is not in a silo with "That load is not in a silo." Rows already in `lab_sample_requests` for other spaces, none today, are left as they are and still show in the middle and right panes.
3. NOTHING ELSE MOVES. The console's Drying section, `/ops/drying_ops`, Load Silo and the scheduling pages keep every space and the cure panes as they were; the dry room and freezer tiles there lose only the check lines V11 gave them. The interval lists, the button order, the stub, the icons, the migration count: untouched.
4. THE PROOFS. `scripts/smoke.mjs`: on `/maintenance` the body carries `Silo 1` and no `Arlington Dry Room`, no `Blast Freezer`, no `data-cure-pane`; `/silos/live.json` still carries every space and the freezer's entry has `checks: []`. Tests: `maintenanceSpaces` on a fixture of a silo, a dry room and a freezer; `attachLoadChecks` giving a freezer load no line while the silo's load beside it has one; Lab Sample's Drying pane skipping a dry room load; `scheduleLabSample` refusing it with status 400.

## Assumptions for his word

- "Sold storage rooms" are the cold storage rooms, CSA and CSB.
- The checks follow the screen: aW and MC are the silos' checks, so the dry room and the freezer take no lines anywhere, not only on the maintenance screen. If he wants the Arlington Dry Room to keep its checks on the console, only law 1 builds and law 2 waits.
- A space is a silo by `spaceTypeOf`, not by name, so a new silo joins the screen without a code change.

## Files

`src/index.ts` (the landing route); `src/labsample.ts` (`maintenanceSpaces`, the silo filter in `attachLoadChecks`, `dryingLoads` and `scheduleLabSample`); `src/i18n.ts` only if a new display string is added (the refusal is an error, thrown in English as the house does); `scripts/smoke.mjs`; tests: `test/labsample.test.ts`, and `test/silo.test.ts` or `test/console.test.ts` if a helper moves.

## Gates and the hand-back

`npm run typecheck` 0; vitest both zones; `node --check scripts/smoke.mjs`; the from-zero smoke at pin 80 with `SMOKE PASS` and no 500; dash audit 0 on every file touched; no personnel data; no key, secret or password. Report `SESSION_REPORTS/<date>_the_silos_only.md` in the worktree with the sealed final check and the assumptions above. Commit nothing, push nothing, deploy nothing, run no git. His hands after the gate: the pre snapshot from the main folder's `app` with the block stopping on its failure (no migration this slice, the snapshot still first), then the three acts.
