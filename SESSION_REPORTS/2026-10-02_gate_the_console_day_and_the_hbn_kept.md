# 2026-10-02 The gate on the console day, its two missing laws, and the HBN kept (canon 0.30.346)

Scribe session. Three things in one landing, built Scribe-direct under G-2 (the floor's HBN pick is urgent) on BRIEF V17 as his Code session handed it back.

1. THE V17 GATE. BRIEF V17, THE CONSOLE DAY IS TODAY (`BRIEFS/2026-10-02_the_console_day_is_today.md`, amended 0.30.345, 22,626 bytes, `307f4337ccc10684`), built by his Code session on `c58c00ba506b1906`; its report `SESSION_REPORTS/2026-10-02_the_console_day_is_today.md` (7,855 bytes). His hand-back, verbatim in part: "Nine files in its `app/`"; "The app tree excluding the untracked repair file hashes `33835444f99e43d1` (258 files)"; "Nothing committed, nothing pushed, nothing deployed, no git run." The stage (`gateV17.tar`, 13,168,640 bytes, `d2b46b7a4c12fb18`) agrees: exactly the nine files differ from the live tree (plus the untracked silo repair, untouched). The build's report names canon 0.30.341: it was built from the brief as first written, before the 0.30.345 amendment carried his three Plants notes. HELD on two laws of the amendment, both missing: (4) Plants Harvested from Admin's total less the remaining, driving % Complete; (5, the placement) the Harvest Year Total as its own inset pane, on Total beneath Weight/DLH (the build put it under Weight Harvested on every box, Total included, as a plain line; `src/theme.ts` untouched). Everything else in V17 read and gated as briefed.
2. THE FIX FOR THE TWO LAWS (Scribe-direct). `src/console.ts` `consoleBoxes`: a farm with a typed Admin total reads harvested = the total less the mirror's remaining, never below zero, and the percent over the typed total; a farm with none keeps the lots' counts; the year pane on the farms after Weight Harvested and on Total after Weight/DLH; `farmBox` renders it `class="hc-metric hc-year-pane"`. `src/theme.ts`: `.hc-year-pane` (a border, padding, a faint panel, neutral gray so it reads in all three sheets). `test/console.test.ts`: the typed-total case (5,000 typed, 1,200 remaining: 3,800 and 76.0%; a total below the remaining reads 0); the two old-law asserts moved to the new law (1,000 typed, 800 remaining: 200 and 20.0%; 100 typed, 10 remaining: 90.0%, no more 250%); the Total order. `scripts/smoke.mjs`: the four year panes and Total's order.
3. THE FLOOR'S OWN WORDS OF THE AFTERNOON (owner, 2026-10-02, verbatim): "I've noticed a couple odd things, there are two stale HBNs that suddenly became available today, I'm not sure if the operator is doing it or not."; "Make all free text operator fields in weight entry nodes to mandatory.  They don't nullify on refresh or onLoad but they can be changed."; "The HBN selected on wet weight entry is nullifying on refresh and onLoad (specifically and detrimentally it's happening on "+").  We need to fix this, the operators are selecting outdated HBNs.  They shouldn't need to select it at all, it should be retained on the header entry form from "+", to "+"".
   - THE STALE HBNs: not the operator. V16's migration 0087 backfilled `finished_at` from the NEWEST status move off weighing (the Scribe's gate passed it; the miss is the Scribe's). Lots finished weeks ago and trimmed this morning took today as their finish, so the HBN Queue and the field node's select (which keep an HBN whose lot finished since the farm day began) listed them again: on the 09:28 snapshot 26048 (PNN), 26049 and 26050 (PNS), finished 2026-09-23 and 24. THE REPAIR `scripts/repairs/2026-10-02_finished_at_first_finish.sql` (3,107 bytes, `e5a3ca140c7c3d57`): every finished lot's stamp set to its FIRST logged move from weighing where the stored stamp is later, one log row each under the owner's login; rehearsed twice on the local database at 0087 loaded from the 09:28 snapshot: run 1 corrects 57 lots and leaves one lot finished today (26086, its real finish), run 2 changes nothing. Data only; safe to run now. And the cause in code: a split child lot is now born with `finished_at` (`src/actions.ts`, the multi-HBN finish).
   - THE HBN KEPT (the field node, Penn South/Arlington Harvest, the only weigh screen with "+" and a per-weight HBN): the select's pick lived only in a `?carry=1` URL flag, lost on every other link, every refresh and every load of the page, so the blank came back and the operator re-picked from the whole list. Now `src/index.ts` carries the load's newest tote's HBN on every load of the page; `src/fieldharvest.ts` drops the blank once there is a pick, keeps the tablet's own pick through "+" (the server's list replaces the options, never the pick while it is on the list) and through a reload (localStorage per load, `gf_field_hbn:`), and saves it on change.
   - THE OPERATOR KEPT: every free-text operator box on the weigh nodes is required and keeps this tablet's last name (localStorage per box name, `gf_operator:`, filled into an empty box on every load, saved as it changes, still editable): the field node's load Operator (and required on the server: "Operator is required."), Penn North's Team Lead, Trim Packages Entry's Operator, Cryo Weight Entry's Operator (it already carried the run's last), the Unload Dry Space and Unload Together Operator (required in the browser; the server path is shared with internal calls and stays as it was). Tests and the smoke follow.

## Gates (the landed tree)

- `npm run typecheck`: exit 0. `npx vitest run`: 74 files, 1041 tests under `TZ=UTC` and under `TZ=America/New_York`. `node --check scripts/smoke.mjs`: ok. From-zero smoke (`SMOKE_PORT=9299`): `About to apply 87 migration(s)`, `SMOKE PASS`, no ` 500 ` line.
- Dash 0, CR 0 on every file touched; no secret; no personnel data (the fixtures' "Field Hand" and the smoke's own names).

## Landing (done; the HBN pick is the floor's urgent)

Fifteen files written to the worktree on his disk after checking it read V17's `33835444f99e43d1`, each verified by hash; the worktree's app tree reads `f0df89f5a38a59a3` without the two dated repair files and `f59f86b3b0f48348` with them (260 files).

## His hands, in this order

1. Now, the stale HBNs off the lists (data only, from the worktree's app/):

```powershell
cd "C:\Users\DennisWallace\Documents\Claude\Projects\gripfactory Practical\branches\GFLiteOpsDashboard\app"
node scripts/repair-apply.mjs scripts/repairs/2026-10-02_finished_at_first_finish.sql
```

2. The silo repair if not yet run: `node scripts/repair-apply.mjs scripts/repairs/2026-10-02_silos_26080_26084.sql`, then `node scripts/db-snapshot.mjs post_repairs_10_02`.

3. The merge (the snapshot first and the block stopping on its failure, the canon checkout before the merge):

```powershell
cd "C:\Users\DennisWallace\Documents\Claude\Projects\gripfactory Practical\app"
node scripts/db-snapshot.mjs pre_console_day
if ($LASTEXITCODE -ne 0) { throw "snapshot failed, stop here" }
cd "C:\Users\DennisWallace\Documents\Claude\Projects\gripfactory Practical\branches\GFLiteOpsDashboard"
git add -A
git commit -m "V17: the console day is today; the HBN and the operator kept" -m "The Harvest Console opens on the farm's today, the look-back kept, no Yesterday on the page; Plants Harvested is Admin's total less the remaining and drives % Complete; the harvest year's wet total in its own pane under Weight Harvested and beneath Weight/DLH on Total; trim input lbs and the sheet read line gone; the pasteurization cards count an unlisted operator by the clock. The field node keeps the HBN picked from + to + and across a reload; every operator box on the weigh nodes is required and kept on the tablet; a split lot is born with its finish stamp. Two repair files ride: the silos of 26080 to 26084 and the first-finish stamps. Canon 0.30.341 to 0.30.346.`n`nCo-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`nClaude-Session: https://claude.ai/code/session_01VDz7UdaTSkjq69GvDfDWd7"
cd "C:\Users\DennisWallace\Documents\Claude\Projects\gripfactory Practical"
git checkout -- canon
git merge --no-ff GFLiteOpsDashboard -m "Merge V17: the console day is today; the HBN and the operator kept"
git push
```

If the snapshot answers 7403 on its first query, run that line alone once more, then the rest. No migration in this push. His paste back: the Version ID.

## Sealed final check

```
V17 AS RECEIVED (33835444f99e43d1 without the silo repair; nine files against c58c00ba506b1906)
app/scripts/smoke.mjs        714140  b536ddad08ecd860      app/test/console.test.ts      69616  93cf19e306e3bce6
app/src/config.ts             79417  1673625c230eb691      app/test/farmday.test.ts      16201  c743be528aa988d3
app/src/console.ts           150827  545dbf156c089570      app/test/laborhours.test.ts    5376  c1452057b3c7e74c
app/src/i18n.ts              195741  94786bbc06f9c8fb      app/test/pasteurization.test.ts 40295 3218a3bc4e3dc706
app/src/index.ts             157968  953e2f8be3924d3d
HELD: law 4 (harvested from Admin's total) and the year pane's placement and style absent

THE LANDED TREE (f0df89f5a38a59a3 without the dated repairs; f59f86b3b0f48348 with them, 260 files; sandbox and disk)
npm run typecheck                     exit 0
TZ=UTC npx vitest run                 74 files, 1041 tests passed
TZ=America/New_York npx vitest run    74 files, 1041 tests passed
node --check scripts/smoke.mjs        ok
CI=1 SMOKE_PORT=9299 ... npm run smoke   About to apply 87 migration(s); SMOKE PASS; " 500 " lines: 0
the finish stamp repair on the 09:28 snapshot   run 1: 57 lots, 57 log rows, today-finished 5 to 1 (26086); run 2: no change
changed against V17 as received (15):
app/scripts/smoke.mjs                     715659  90fe830cbe9c2377
app/src/actions.ts                        410974  11ddd3574689335d
app/src/console.ts                        151773  0fd47aaa30f40513
app/src/cryo.ts                            25401  52c9cb38286240a5
app/src/drying.ts                          35362  437e7ee6661dc612
app/src/fieldharvest.ts                    21336  d93ca322e9eeec04
app/src/html.ts                           197039  2782d20b09231b49
app/src/index.ts                          158121  cf78295ea1f1b6d9
app/src/theme.ts                          187660  a3652d748a6d82ea
app/test/console.test.ts                   70885  dd0313623e917452
app/test/cryo.test.ts                      29216  b1735ea7e143895a
app/test/fieldharvest.test.ts              35695  6e883d1332106fd7
app/test/identity.test.ts                   7702  d730dff0769b13d5
app/test/surface.test.ts                   81883  ff97633f3c8aa663
app/scripts/repairs/2026-10-02_finished_at_first_finish.sql  3107  e5a3ca140c7c3d57
dash audit: 0; CR audit: 0; secret grep: no values; personnel data: none added
```
