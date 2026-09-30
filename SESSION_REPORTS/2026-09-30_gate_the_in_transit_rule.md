# 2026-09-30 The gate on the in-transit rule (canon 0.30.322): HELD as received on one law, the fix gated

Scribe session. The gate on V15.1, THE IN-TRANSIT RULE (BRIEF V15.1, canon 0.30.320, `BRIEFS/2026-09-30_the_in_transit_rule.md`, 11,408 bytes, `f6fc7f97933b114b`), built by his Code session on the worktree `branches/GFLiteOpsDashboard` as it stood after V15's fix landed (the app tree `05517224a9053b77`), its report `SESSION_REPORTS/2026-09-30_the_in_transit_rule.md` (7,520 bytes, `18f86e2a3027cfed`). The report says "Nothing committed. No git was run."; the disk agrees, the two repair files of 0.30.315 and the memo unchanged and riding. His hand-back, verbatim in part: "A sent ARL or PNS load puts each HBN on the Dry Queue as its own in-transit line. A later load for an HBN that still has a weighing lot adds to that lot. `>>` finishes the weighing lot the way YES does, then writes the pass, and the load leaves Loads sent once every HBN on it has been passed. YES closes the HBN. Demote back to weighing opens it again. Load Silo still lists only finished lots. Penn North is unchanged."

VERDICT: HELD as received on one law, the field select's, and the hold is the Scribe's brief's doing: the brief made the select `field_closed_at IS NULL` alone, the build followed it exactly, and on the floor's own snapshot that law lists twenty-eight ARL and PNS HBNs finished and unloaded days and weeks ago (every open batch of the two farms since 9/15), a mis-pick waiting for the crew on day one. Everything else passes: the exposure at send, the merge under the weighing lot, the pass finishing the lot and receiving the loads, YES closing and the Demote reopening, Penn North untouched, migration 0083 clean on the newest snapshot, every mechanical gate green. The Scribe's fix is gated in the sandbox (four files, the tree `d9876ff55742ed8d`): the crew's close AND the farm-day rule, so a finished HBN stays for the rest of its day's loads and leaves the next morning, and last week's HBNs never show. It waits on his word to land in the worktree; then tonight's merge block below carries V15, its fix, V15.1 and this fix in one commit.

## What was gated (the tree as received, `9ae43075acd76392`)

1. THE TREE. Against V15's fixed tree (`05517224a9053b77`): the eleven files of the seal (`migrations/0083_field_in_transit.sql` and `test/logistics.test.ts` new; `src/db.ts`, `src/actions.ts`, `src/scheduling.ts`, `src/fieldharvest.ts`, `src/index.ts`, `src/config.ts`, `src/i18n.ts`, `scripts/smoke.mjs`, `test/fieldharvest.test.ts` grown), every hash in the report verified on his disk and in the sandbox; `src/theme.ts` (`2ab7c15b1f5f886c`) and the two repair files unchanged. Nothing else moved; the app tree hashes `9ae43075acd76392` on both sides.
2. THE EXPOSURE AND THE MERGE, read line by line: `listDryQueueLots` (`WEIGHING_IN_TRANSIT_SELECT`: a weighing lot of an ARL or PNS HBN with a live tote on an in-transit load; `truck_number` null; `finished_at` the earliest `sent_at` of its loads; `in_transit_loads` the distinct in-transit loads) beside `listBarnWetLots`, which Load Silo keeps; Internal Logistics and `listLotParts` read the union; the page groups a weighing part as its own line (`data-logistics-in-transit`, "in transit, {n} loads" where the trucks read; ES "en transito, {n} cargas"); a later load adds to the same lot through `ensureWeighingLotStmts`. On the Scribe's fixture (two loads with one ARL HBN, one PNS HBN, a third HBN finished by YES): the ARL line one line, 12,776 g over two loads, the PNS line 2,781 g over one load, the finished HBN a finished line with no truck; Load Silo lists neither weighing lot.
3. THE PASS. `scheduleLogisticsLot` finishes each weighing part first (`singleLotFinishStmts` with the plant prompt skipped: drying, `harvest_file_seq`, the born package), writes the pass, then `receivePassedFieldLoadStmts` receives every in-transit load carrying the HBN whose live totes sit on no weighing lot outside this pass and whose every HBN has a live pass at or after its `sent_at` (status `received`, `received_at`, `received_by`, three log rows, reason `field load received`). On the fixture, the pass on the ARL HBN: its lot drying at 12,776 g with `harvest_file_seq` 1, the row Scheduled; the second load (ARL alone) received and off the pane; the first load (ARL and PNS) still in transit; the PNS line still on the Dry Queue. `>>` while a pass is open still refuses, so a new weighing line for an HBN with an open pass waits for Load Silo to complete it (his report says so).
4. YES AND THE DEMOTE. `sendFieldLoad` with checked HBNs writes `field_closed_at` and `field_closed_by` on each batch (two log rows, reason `field hbn closed`); "+" and the tote change refuse a closed HBN; the Demote of a lot back to weighing (`runQueueControl`, entity `wet_weight_entries`, target weighing) clears both columns with two log rows under `demoted`; a `>>` on a Penn North HBN sets nothing. The Loads sent pane is `listInTransitFieldLoads`, status `in_transit` alone, however old; a received load has no `<<`.
5. MIGRATION 0083, rehearsed on `db_backups/20260929-221242_post_dry_room_26029` after 0001 to 0082: `field_closed_at` and `field_closed_by` on `harvest_batches` (null on 66), `received_at` and `received_by` on `field_loads` (no rows yet), the batch indexes kept, the second run refused ("duplicate column name: field_closed_at").
6. THE RENDERS from the fixture: the Dry Queue with the two in-transit lines beside a finished one (EN and ES), the Dry Queue after the pass (the ARL line Scheduled, the PNS line waiting), the Loads sent pane with three loads. The pictures handed to his eye.

## The hold (as received) and the fix (gated in the sandbox)

1. THE STALE HBNS ON THE FIELD SELECT. `FIELD_OPEN_HBN_SQL` as received is `AND b.field_closed_at IS NULL`, the brief's own words, so every open ARL or PNS batch not closed by YES is on the field entry select whatever its lots. Every `harvest_batches` row stays `open` forever (the floor's 53 batches are all open), so on the newest snapshot the select would list twenty-eight HBNs, 26015 through 26059, each finished and unloaded between 9/16 and 9/25, none of them a harvest in progress; a crew member picking one would mint it a new weighing lot. THE FIX (`src/db.ts`): `FIELD_OPEN_HBN_SQL` is `AND b.field_closed_at IS NULL` followed by `NO_FINISHED_LOT_SQL`, the farm-day rule V15 was built with, bound to the farm's today in `listFieldHbns`: an HBN is on the select while YES has not closed it AND it has no lot yet, or a weighing lot open, or a lot finished within the farm's today (a pass earlier today keeps the HBN for the day's later loads; a finish before today, the truck flow's or the pass's, leaves it). On the snapshot that lists none today; on the day of a finish it lists that day's HBNs. The unit test grows the six cases (no lot; a finish today; an old part beside a weighing lot; a stale finish; closed by YES; Penn North). The smoke walks as before (the third load's "+" on the ARL HBN after the same-day pass still mints the new lot; YES closes; the Demote reopens).
2. A TIDY seen in the render, riding with the fix: the Loads sent card read "1 totes"; "tote" joins the dictionary (EN and ES) and the card reads "1 tote" (`src/i18n.ts`, `src/fieldharvest.ts`).

## Observations for his word (no hold)

- `/export/harvest_batches.csv` follows the table, so its lines end with two new empty cells after `born_from` (`field_closed_at`, `field_closed_by`); anything of his reading that export by column position sees two more trailing columns, as `wet_weights.csv` gained `field_load_id` at 0082.
- An HBN with an open pass and a new weighing line (a load sent after its pass) shows both, the first Scheduled and the new line waiting; `>>` on it refuses until Load Silo completes the pass. If he wants the second line passable at once, the pass would need to be per lot rather than per HBN, a later slice.
- A received load leaves the pane for good; its record and log stay. If the crew needs to see received loads, a Received pane behind the PIN is a later line.

## Gates on the tree as received (the Scribe's sandbox, the worktree's `app/`)

- `npm run typecheck` with the generated types file deleted first: exit 0.
- `npx vitest run`: 70 files, 994 tests passed; the same under `TZ=America/New_York`.
- `node --check scripts/smoke.mjs` and `node --check scripts/icon-proofs.mjs`: ok.
- `npm run proofs:icons`: the sheet 105,377 bytes, `85b22429de13e975`, unchanged.
- From-zero smoke (`SMOKE_PORT=9225`): `About to apply 83 migration(s)`, `SMOKE PASS`, no ` 500 ` line; the dev server ended by the timeout after the pass.
- Migration 0083 rehearsed on the 22:12 post snapshot: the four columns null everywhere, the second run refused.
- Dash audit: 0 (em and en), and no CR byte, on the eleven files and the build report. Secret grep: no value anywhere. No personnel data.

## Gates on the fixed tree (the Scribe's sandbox copy)

- `npm run typecheck`: exit 0. `npx vitest run`: 70 files, 994 tests passed, UTC and `TZ=America/New_York`.
- `node --check scripts/smoke.mjs`: ok. From-zero smoke (`SMOKE_PORT=9231`): `About to apply 83 migration(s)`, `SMOKE PASS`, no ` 500 ` line.
- The select's law against the newest snapshot: 0 HBNs listed for the farm's today (28 as received).
- Four files changed against the tree as received, nothing else; dash 0, CR 0, no secret value, no personnel data in the change.

## Landing the fix (his word)

On his "do it", the Scribe writes the four files whole to the worktree on his disk (`app/src/db.ts`, `app/src/i18n.ts`, `app/src/fieldharvest.ts`, `app/test/fieldharvest.test.ts`), verifies each hash below, re-hashes the app tree to `d9876ff55742ed8d`, and this report's seal stands as the fixed tree's; then the merge below.

## The merge (his hands, after the harvests and after the fix lands; the snapshot first and the block stopping on its failure, the canon checkout before the merge)

```powershell
cd "C:\Users\DennisWallace\Documents\Claude\Projects\gripfactory Practical\app"
node scripts/db-snapshot.mjs pre_two_harvest_nodes
if ($LASTEXITCODE -ne 0) { throw "snapshot failed, stop here" }
cd "C:\Users\DennisWallace\Documents\Claude\Projects\gripfactory Practical\branches\GFLiteOpsDashboard"
git add -A
git commit -m "V15 and V15.1: the two harvest nodes and the in-transit rule" -m "Part one: Wet Weight Entry is Penn North Harvest, PNN batches only, a finish writing the Internal Logistics pass when none is open. Part two: migration 0082 (field_loads, wet_weights.field_load_id) and the station Penn South/Arlington Harvest at /station/field_harvest: loads with an operator and a destination, the entry with the last HBN carrying, Finish Load with the two warnings in the page locale (NO sends, YES finishes the checked HBNs and sends, no pass), the content pane with the PIN-gated HBN change, the pencil and the X, Loads sent with << behind the PIN. The gate's fix: the Finish Load button, the weighted panes with one line per tote, the checkbox list one per line. V15.1, the in-transit rule (migration 0083): a sent load exposes each HBN's weighing lot as a Dry Queue line that merges across loads until the >> pass finishes and schedules it, the load received at the pass of its last HBN, YES closing an HBN until a Demote, the field select under the crew's close and the farm-day rule. The repair files of 2026-09-30 and the intervention memo ride along. Canon 0.30.322, the briefs and the gate reports ride in canon/, BRIEFS/ and SESSION_REPORTS/.`n`nCo-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`nClaude-Session: https://claude.ai/code/session_01VDz7UdaTSkjq69GvDfDWd7"
cd "C:\Users\DennisWallace\Documents\Claude\Projects\gripfactory Practical"
git checkout -- canon
git merge --no-ff GFLiteOpsDashboard -m "Merge V15 and V15.1: the two harvest nodes and the in-transit rule"
git push
```

If the snapshot answers 7403 on its first query, run the snapshot line alone once more and then the rest. The push runs the workflow: typecheck, the tests, `apply migrations` (0082 and 0083, the pin 83), the deploy. His paste back: the snapshot's last line, the push's output, the run's result and the Version ID from the deploy step's log; the Scribe reads main after the merge, folds LIVE, and hands V8's paste (BRIEF V8, migration 0084); V7 DRYING waits on his live walk of CSA and CSB (ruling 12) before its brief.

## Sealed final check

```
THE TREE AS RECEIVED (9ae43075acd76392, the same on his disk)
rm worker-configuration.d.ts; npm run typecheck      exit 0
npx vitest run                        70 files, 994 tests passed
TZ=America/New_York npx vitest run    70 files, 994 tests passed
node --check scripts/smoke.mjs        ok
node --check scripts/icon-proofs.mjs  ok
npm run proofs:icons                  85b22429de13e975, 105377 bytes, unchanged
rm -rf .smoke-persist && CI=1 SMOKE_PORT=9225 WRANGLER_SEND_METRICS=false npm run smoke
                                      About to apply 83 migration(s); SMOKE PASS; " 500 " lines: 0
migration 0083 on the 22:12 post snapshot   4 columns, null on 66 batches, no field_loads rows; run 2 refused
the field select on that snapshot     28 HBNs listed as received (the hold); 0 with the fix
the fixture by hand                   ARL 4,893 + 4,763 + 3,120 = 12,776 g over 2 loads; PNS 2,781 g over 1; after the pass load 2 received, load 1 in transit
the seal (11 files) verified byte for byte, device and sandbox:
app/migrations/0083_field_in_transit.sql         432  354dc89a1fd26666
app/src/db.ts                                 197317  2bb793a46f2247ae
app/src/actions.ts                            375975  7ca39536d98656ca
app/src/scheduling.ts                          46793  f7792a8daf53796b
app/src/fieldharvest.ts                        13456  a52b591b0b35131d
app/src/index.ts                              152223  9955ff02c7ef4835
app/src/config.ts                              74657  d02a66f555c93205
app/src/i18n.ts                               189875  fa93379997823269
app/scripts/smoke.mjs                         650279  3dc5f9a4503b71e9
app/test/fieldharvest.test.ts                  29118  4f2331717d367ac3
app/test/logistics.test.ts                     11296  fa72010767590268
riding unchanged: app/src/theme.ts 175820 2ab7c15b1f5f886c; the two repair files 0a9bdf949cb6c948, a2a1bc6f4526979d
changed against V15's fixed tree, not in the seal: none
the build report: 2026-09-30_the_in_transit_rule.md 7520 18f86e2a3027cfed
dash audit: 0; CR audit: 0; secret grep: no values; personnel data: none

THE FIXED TREE (d9876ff55742ed8d, the Scribe's sandbox copy)
npm run typecheck                     exit 0
npx vitest run                        70 files, 994 tests passed
TZ=America/New_York npx vitest run    70 files, 994 tests passed
node --check scripts/smoke.mjs        ok
CI=1 SMOKE_PORT=9231 ... npm run smoke   About to apply 83 migration(s); SMOKE PASS; " 500 " lines: 0
the four files:
app/src/db.ts                                 197864  3436d4fd327ad16b
app/src/i18n.ts                               189911  f2c6efc8b799314d
app/src/fieldharvest.ts                        13497  d7cb473cd925ea49
app/test/fieldharvest.test.ts                  30803  f1bca4d09c53444f
changed against the tree as received, not in the four: none
dash audit: 0; CR audit: 0; secret grep: no values; personnel data: none
```
