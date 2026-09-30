# 2026-09-30 The gate on the two harvest nodes (canon 0.30.318): HELD as received, the fix gated

Scribe session. The gate on V15, THE TWO HARVEST NODES (BRIEF V15, canon 0.30.317, `BRIEFS/2026-09-30_the_two_harvest_nodes.md`, 17,529 bytes, `afb931e0a47e8196`), built on the worktree `branches/GFLiteOpsDashboard` by his Code session on V6.1 (main `483b34a`, the tree `24680a74c2c9b5d0`), its two reports `SESSION_REPORTS/2026-09-30_penn_north_harvest.md` (5,519 bytes, `4f1292e1d2ce7cc5`) and `SESSION_REPORTS/2026-09-30_penn_south_arlington_harvest.md` (7,645 bytes, `ad3eba80a1c15cdd`). His hand-back says "Nothing was committed, pushed, deployed, or touched with git. The repair files under `app/scripts/repairs` and the memo in `SESSION_REPORTS` were left as they were."; the disk agrees, the two repair files of 0.30.315 and the memo unchanged and riding. His hand-back, verbatim in part: "A Finish Load YES does not write an Internal Logistics pass. A finish today stays on the field entry select. The farm-day rule named in the brief hides an HBN only when its finished lot is from before today. The smoke asserts that."

VERDICT: HELD as received, on one law and three lines of the screen. Every mechanical check is green, migration 0082 rehearses clean on the newest snapshot, part one reads right line by line, and part two's records, warnings, PIN gates and Spanish are right; but a finished HBN stays on the field select the same day and "+" mints it a new lot (against the ruling and the warning's own promise), the [Finish Load] button is missing (the question and NO stand on the page at all times), the middle pane's table runs under the Loads sent pane with each tote row three lines tall, and the YES list runs together on one line. The Scribe's fix is written and gated in the sandbox (five files, the tree `05517224a9053b77`) and waits on his word to land in the worktree; then the merge. The brief's wording on the select carried both the ruling's sentence and the farm-day rule, and the build followed the rule; that is on the Scribe's brief, and the law below is the ruling's.

## What was gated (the tree as received)

1. THE TREE. Against V6.1's tree (`24680a74c2c9b5d0`): the seventeen files of the two seals (`migrations/0082_field_loads.sql` and `src/fieldharvest.ts` new, `test/fieldharvest.test.ts` new; `src/theme.ts`, `src/pages.ts`, `src/pipeline.ts`, `src/db.ts`, `src/actions.ts`, `src/index.ts`, `src/config.ts`, `src/i18n.ts`, `scripts/smoke.mjs`, `test/labsample.test.ts`, `test/truck.test.ts`, `test/surface.test.ts`, `test/ops.test.ts`, `test/i18n.test.ts` grown), every hash in the two reports verified on his disk and in the sandbox, plus the two repair files of 0.30.315, unchanged. Nothing else moved; the app tree hashes `fa0e4d22e5f5e83c` on both sides.
2. PART ONE, PENN NORTH HARVEST, read line by line: the station `wet_weight` titled "Penn North Harvest" ("Cosecha Penn North"), its pane, header pick and add-form HBN list PNN batches only with the farm-day rule of `NO_FINISHED_LOT_SQL` (the truck flow's, a PNN HBN finished today staying for its next truck, the brief's word); `finishLot` refactored into `singleLotFinishStmts` with the truck split (`splitTruckIfNeeded`) and the plant prompt as before; `pennNorthPassStmts` writing the Internal Logistics pass row (production_schedules, stage `internal_logistics`, status scheduled) for the lot's HBN when none is open, so the lot reads Scheduled on the Dry Queue and is not loaded; a later part of an HBN with an open pass writes nothing. No migration in part one.
3. PART TWO, PENN SOUTH/ARLINGTON HARVEST: migration 0082 (the table `field_loads`, the column `wet_weights.field_load_id`, the indexes `field_loads_status` and `wet_weights_field_load`), rehearsed on `db_backups/20260929-221242_post_dry_room_26029` (0001 to 0081 and the snapshot's 38,024 totes; 0082 adds the table, the column null on every tote, the two indexes; a second run refuses "table field_loads already exists"). The station `field_harvest` at `/station/field_harvest`: the left pane Start a new load and the open loads; the header Operator, Destination (the farms with a non-truck dry space: Penn North and Arlington; Penn South refused) and START; the entry Weight, HBN (ARL and PNS batches, blank on load, the last pick carrying after "+" by `carry=1`) and "+" landing the tote on the HBN's weighing lot, minted at the first tote by `ensureWeighingLotStmts` with the destination's holding space, spear, the operator as team lead; the two warnings in the page's locale ("Would you like to finish any HBNs on this load?" and the "Are you sure ..." sentence with the list filled; "Desea terminar algun HBN de esta carga?", "Esta seguro de terminar de agregar pesos a los HBN: ...? Una vez terminados, no podra agregar mas peso sin la aprobacion del administrador.", "Confirmar", "Volver"); NO sends the load in transit; YES with Confirm finishes the checked HBNs' lots by `singleLotFinishStmts` with the plant count skipped, sends the load and writes no pass (the smoke reads the HBN on the Dry Queue's available pane and not on the working pane); the content pane Number within the load, Weight, Lot from the HBN, the HBN select behind the Admin PIN (`requireAdminPin`, app_config `admin_pin`; a change moves the tote between lots and recomputes both totals with the change log rows), the pencil and the X returning to the load; the right pane Loads sent of today and yesterday with "<<" behind the PIN reopening the load alone (its finished HBNs stay finished).
4. THE RENDERS from a fixture on the three sheets, EN and ES, the carry state, the warn state, the empty station and the phone width: the pictures handed to his eye and read for the hold below.

## The hold (as received) and the fix (gated in the sandbox)

1. THE FINISHED HBN STAYS ON THE SELECT. `listFieldHbns` carries `NO_FINISHED_LOT_SQL`, the farm-day rule, so an HBN finished today stays on the field entry select (the sandbox's check on a same-day finish: `stillListed: true`; the build's own smoke asserts it), and "+" on it runs `ensureWeighingLotStmts`, which finds no weighing lot and mints a new one, so the HBN takes weight again with no admin in the way. The ruling: "[Confirm] releases the load to In-transit and removes the HBN from the entry combobox"; the warning the crew just confirmed: "If finished, you will not be able to add any more weight without admin approval." THE FIX: `FIELD_OPEN_HBN_SQL` in `src/db.ts` lists an ARL or PNS batch only while a weighing lot is open or no lot exists yet (no farm-day bind); `addFieldLoadWeight` and `changeFieldToteHbn` already refuse an HBN off that list ("That HBN is not on this list."), so "+" and a tote change onto a finished HBN refuse until an admin demotes its lot on the Dry Queue (the Demote steps `drying` back to `weighing`, the HBN returns to the select); `ensureWeighingLotStmts` still mints the first lot of an HBN with none. Penn North keeps the farm-day rule (the truck flow). The unit test grows a same-day finished HBN (off the select; back on it after the Demote's step) and the reopen test a refused "+" on the finished HBN with no new lot minted; the smoke's assertion flips ("a finished HBN leaves the entry select at once") and adds the refused "+" and the refused change.
2. NO [Finish Load] BUTTON. The block renders the question with YES and NO standing on the page at all times, and NO sends the load; the dictionary's "Finish Load" / "Terminar carga" is not used on the page. THE FIX: the block is a `<details class="field-finish">` whose `<summary class="btn">` is the Finish Load button; opening it shows the question with YES and NO; YES reveals the checkbox list (the script, or the `?finish=ask` link without it, which renders the block open); the warn state renders it open. The smoke reads the closed block on an open load and the open block on the YES page.
3. THE PANES. The station's three panes are equal thirds by the shuttle law of 0.30.201 (`.station-triple > *` at the end of every sheet overrides `.working-pane`'s three shares), so at 1100 px the middle pane is 318 px: the content table runs under the Loads sent pane (the top row's pencil under it), each tote row stacks the HBN select, the PIN box and Change (118 px a row), and the header reads "CONTRO". THE FIX, in `src/theme.ts` and `src/fieldharvest.ts`: the field station's triple (`.field-triple`) weights the middle pane at three shares with the sides at 15rem, this station alone (the scheduler's equal thirds untouched); one line per tote, the PIN box and Change hidden until the row's select changes (the script marks the form `js` and `changed`; without the script they show); the HBN cell 11rem, the table's paddings and the number column tightened, the controls cell 7.5rem and never wrapped, the table in a scrolling wrapper as the floor; the reopen form's PIN as a placeholder box beside "<<"; the queue items wrap at spaces; the phone and the 480 px column keep their basis (a first cut of the fix put the overflow on the pane itself and the middle pane collapsed to nothing on the phone, a flex item with a zero basis; the wrapper carries the overflow instead, and the phone table scrolls with its select at 7rem). Read by script at 1100 px: the table's right edge 822 against the pane's left 841, every tote row 64 px, the X visible in every state, the PIN hidden until a change.
4. THE CHECKBOX LIST runs together on one line: the labels carry `queue-pane-item`, which has no display rule outside a queue pane. THE FIX: `field-finish-item`, a block per HBN.

## Observations for his word (no hold)

- The pane weighting departs from the equal thirds of 0.30.201 for this station alone; if he wants the thirds kept, the middle pane needs its table narrower instead (the Lot column folded into the HBN cell).
- At 1100 px the side panes are 240 px, so "Start a new load" wraps to two lines and a long operator and destination pair wraps at the slash; on his monitor the sides are wider. The phone stacks the three panes as before.
- The checkbox list's "In all" figure is the HBN's lot total, this load and the earlier ones; "On this load" is this load's. Both right on the fixture.
- The reopened load's finished HBN keeps its totes listed, each row's select carrying that HBN as its own option; a change of such a tote is refused ("Only a weighing lot's totes can change HBN").

## Gates on the tree as received (the Scribe's sandbox, the worktree's `app/`)

- `npm run typecheck` with the generated types file deleted first: exit 0.
- `npx vitest run`: 70 files, 989 tests passed; the same under `TZ=America/New_York`.
- `node --check scripts/smoke.mjs` and `node --check scripts/icon-proofs.mjs`: ok.
- `npm run proofs:icons`: the sheet 105,377 bytes, `85b22429de13e975`, unchanged.
- From-zero smoke (`SMOKE_PORT=9219`): `About to apply 82 migration(s)`, `SMOKE PASS`, no ` 500 ` line; the dev server ended by the timeout after the pass.
- Migration 0082 rehearsed on the 22:12 post snapshot: the table, the column null on 38,024 totes, the two indexes; the second run refused.
- Dash audit: 0 (em and en), and no CR byte, on the seventeen files, the two build reports, the brief, `wrangler.toml`, `tsconfig.json` and `package.json`. Secret grep (the six patterns and two key shapes): no value anywhere. No personnel data; the fixtures' operators are the smoke's.

## Gates on the fixed tree (the Scribe's sandbox copy)

- `npm run typecheck`: exit 0. `npx vitest run`: 70 files, 989 tests passed, UTC and `TZ=America/New_York`.
- `node --check` on both scripts: ok. The proofs sheet unchanged, `85b22429de13e975`.
- From-zero smoke (`SMOKE_PORT=9223`): `About to apply 82 migration(s)`, `SMOKE PASS`, no ` 500 ` line.
- The renders at 1100 px on the three sheets, EN and ES, the rest state, the changed-row state and the YES and warn states, and at 390 px: the pictures handed to his eye (`v15fix_field_en.png`, `v15fix_field_en_changed.png`, `v15fix_field_warn_es.png`, `v15fix_field_phone.png`).
- Five files changed against the tree as received, nothing else; dash 0, CR 0, no secret value, no personnel data in the change.

## Landing the fix (his word)

On his "do it", the Scribe writes the five files whole to the worktree on his disk (`app/src/db.ts`, `app/src/fieldharvest.ts`, `app/src/theme.ts`, `app/test/fieldharvest.test.ts`, `app/scripts/smoke.mjs`), verifies each hash below on the disk, re-hashes the app tree to `05517224a9053b77`, and this report's seal stands as the fixed tree's; then the merge below. If he wants his Code session to land it instead, the Scribe writes the brief for it (the four items and the fix, as above).

## The merge (his hands, after the fix lands; the snapshot first and the block stopping on its failure, the canon checkout before the merge)

```powershell
cd "C:\Users\DennisWallace\Documents\Claude\Projects\gripfactory Practical\app"
node scripts/db-snapshot.mjs pre_two_harvest_nodes
if ($LASTEXITCODE -ne 0) { throw "snapshot failed, stop here" }
cd "C:\Users\DennisWallace\Documents\Claude\Projects\gripfactory Practical\branches\GFLiteOpsDashboard"
git add -A
git commit -m "V15: the two harvest nodes" -m "Part one: Wet Weight Entry is Penn North Harvest, PNN batches only, a finish writing the Internal Logistics pass when none is open. Part two: migration 0082 (field_loads, wet_weights.field_load_id) and the station Penn South/Arlington Harvest at /station/field_harvest: loads with an operator and a destination, the entry with the last HBN carrying, Finish Load with the two warnings in the page locale (NO sends, YES finishes the checked HBNs and sends, no pass), the content pane with the PIN-gated HBN change, the pencil and the X, Loads sent with << behind the PIN. The gate's fix: a finished HBN leaves the field select at once and refuses weight until a Demote, the Finish Load button, the weighted panes with one line per tote, the checkbox list one per line. The repair files of 2026-09-30 and the intervention memo ride along. Canon 0.30.318, the brief and the gate report ride in canon/, BRIEFS/ and SESSION_REPORTS/.`n`nCo-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`nClaude-Session: https://claude.ai/code/session_01VDz7UdaTSkjq69GvDfDWd7"
cd "C:\Users\DennisWallace\Documents\Claude\Projects\gripfactory Practical"
git checkout -- canon
git merge --no-ff GFLiteOpsDashboard -m "Merge V15: the two harvest nodes"
git push
```

If the snapshot answers 7403 on its first query, run the snapshot line alone once more and then the rest. The push runs the workflow: typecheck, the tests, `apply migrations` (0082, the pin 82), the deploy. His paste back: the snapshot's last line, the push's output, the run's result and the Version ID from the deploy step's log; the Scribe reads main after the merge, folds LIVE, and V7 DRYING waits on his live walk of CSA and CSB (ruling 12) before its brief.

## Sealed final check

```
THE TREE AS RECEIVED (fa0e4d22e5f5e83c, the same on his disk)
rm worker-configuration.d.ts; npm run typecheck      exit 0
npx vitest run                        70 files, 989 tests passed
TZ=America/New_York npx vitest run    70 files, 989 tests passed
node --check scripts/smoke.mjs        ok
node --check scripts/icon-proofs.mjs  ok
npm run proofs:icons                  85b22429de13e975, 105377 bytes, unchanged
rm -rf .smoke-persist && CI=1 SMOKE_PORT=9219 WRANGLER_SEND_METRICS=false npm run smoke
                                      About to apply 82 migration(s); SMOKE PASS; " 500 " lines: 0
migration 0082 on the 22:12 post snapshot   table, column null on 38024 totes, 2 indexes; run 2 refused
the same-day finish on the field select      stillListed: true (the hold, item 1)
the seal (17 files) verified byte for byte, device and sandbox:
app/migrations/0082_field_loads.sql              727  e01042217df167bf
app/src/fieldharvest.ts                        12449  e01df968df2021cc
app/src/theme.ts                              174301  d33117d41afc1f11
app/src/pages.ts                               28634  4b3e49f11e771dfd
app/src/pipeline.ts                            51493  56a908b0905152fe
app/src/db.ts                                 194264  74b2511b88bfc29e
app/src/actions.ts                            368333  4a144dac9aef42ac
app/src/index.ts                              151748  dd8857882c7b63a8
app/src/config.ts                              74411  027b201698719d6a
app/src/i18n.ts                               189637  bfc132a8ee77ce84
app/scripts/smoke.mjs                         642135  1b0ea366bc541458
app/test/fieldharvest.test.ts                  15040  6f88c1c3233e381c
app/test/labsample.test.ts                     14802  2e36c60214403fd2
app/test/truck.test.ts                         17096  4bc2ece563f5e34c
app/test/surface.test.ts                       80610  0bfa68b20ae2e723
app/test/ops.test.ts                            9191  1ed8a005ef200ead
app/test/i18n.test.ts                          17644  18a41862ab1bc61a
riding unchanged: app/scripts/repairs/2026-09-30_dry_room_26029_split.sql 16134 0a9bdf949cb6c948
                  app/scripts/repairs/2026-09-30_dry_room_26029_into_26027.sql 18488 a2a1bc6f4526979d
changed against V6.1's tree, not in the seals: none
the build reports: 2026-09-30_penn_north_harvest.md 5519 4f1292e1d2ce7cc5; 2026-09-30_penn_south_arlington_harvest.md 7645 ad3eba80a1c15cdd
dash audit: 0; CR audit: 0; secret grep: no values; personnel data: none

THE FIXED TREE (05517224a9053b77, the Scribe's sandbox copy)
npm run typecheck                     exit 0
npx vitest run                        70 files, 989 tests passed
TZ=America/New_York npx vitest run    70 files, 989 tests passed
node --check (both scripts)           ok; proofs 85b22429de13e975 unchanged
CI=1 SMOKE_PORT=9223 ... npm run smoke   About to apply 82 migration(s); SMOKE PASS; " 500 " lines: 0
the geometry at 1100 px by script     table right 822 < pane left 841; rows 64 px; the X visible in every state; the PIN hidden until a change
the five files:
app/src/db.ts                                 194918  10b1e55c9518e995
app/src/fieldharvest.ts                        13327  0eceb266289caf05
app/src/theme.ts                              175820  2ab7c15b1f5f886c
app/test/fieldharvest.test.ts                  16495  983c762171ed88c5
app/scripts/smoke.mjs                         643400  de972f5672e6ca28
changed against the tree as received, not in the five: none
dash audit: 0; CR audit: 0; secret grep: no values; personnel data: none
```
