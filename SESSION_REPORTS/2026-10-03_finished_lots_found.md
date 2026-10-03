# 2026-10-03 Finished lots, found

BRIEF V26, FINISHED LOTS, FOUND (canon 0.30.373), built in the worktree `branches/GFLiteOpsDashboard` under THE DISPATCH RULE (canon 0.30.155). No migration; the smoke pin stays 90. Not deployed. Nothing committed. Nothing pushed. No git was run.

## The tree as received

The brief pins `f16eeacbfd987ca3` (281 files, migrations 0001 to 0090). The disk hashed exactly that before the first edit (the Git Bash marker fix of canon 0.30.330 applied). The hashed set was staged as a tarball in the session's scratchpad before any edit; every "changed" below is against it.

The app tree after this session hashes `b333d595286a8b10` (283 files: two new, none deleted).

## Why no migration

Nothing the law asks for needs a column. A voided tote already has `deleted_at` and `deleted_by` on `wet_weights` (migration 0006); its reason lives in `record_change_log`, which is where the existing tote void (`planVoidRecord`) and the 2026-10-03 repair of 26087 put it, and the lot's page reads it back from there (the newest `deleted_at` row of the tote). The window reads `finished_at` (migration 0087). Reopen is the Demote's code path.

## What changed, law by law

All new code is in one new module, `src/finishedlots.ts`; the routes are in `src/index.ts`, the field page's hooks in `src/fieldharvest.ts`, the words in `src/i18n.ts`.

1. THE LIST. `listFinishedLots(db, screen, now)`: lots off weighing, not voided, whose HBN's farm is the screen's (Penn North Harvest: PNN; the field node: ARL and PNS) and is not METRC-born (`farmHarvestSql`, as every floor list), with `finished_at` in `[farmDayBounds(today minus 7).startIso, farmDayBounds(today).endIso)`, the farm's today by `farmDay` and the start hour in data; ordered by `finished_at` descending. `finishedLotsSection` renders it as a folded `details` ("Finished lots" with the count) under the weighing area: on Penn North Harvest after the station page in all three of its views (the pane, the pick, the lot), on the field node after the three panes. Each row: the HBN's last five (a link to the lot's page), the strain, the space, the finish time (Eastern, `etWallClock`), the live tote count, the wet total as "x.xx lb (n g)" at 448 g, the status in words. The whole HBN is never printed, so the pane law of canon 0.22.0 stands.
2. THE LOT. `GET /station/:key/finished/:lotId` (`key` is `wet_weight` or `field_harvest`; a lot of another screen's farms is a 404). At the top the HBN's last five, strain, space, status, finish time, and the live count and live total, both computed from the live totes the table lists. Then every tote, newest first: time (Eastern), grams, lb, its field load where it has one (the load's operator, destination and start), and who weighed it (the login that saved it). A voided tote stays in the list, every cell struck through (`<s>`), with "Voided <when> by <who>: <reason>".
3. VOID A TOTE. `POST /station/:key/finished/totes/:toteId/void` with a required reason and the Admin PIN; the actor is the app's (`actorForm`). One `db.batch`: the tote's `deleted_at` and `deleted_by` (soft), its `record_change_log` row with the reason, the lot's `weight_grams` recomputed from its live totes (`lotTotalRecomputeStmt`, the same as every tote add, edit and void, so it drops by the tote's grams) with a log row of the old and new figure, and the lot's wet package (`local_inventory_items` of the lot, SPR or WIP) `qty` lowered by the tote's grams with its log row; all three log rows carry the typed reason. Allowed while the lot is weighing, in transit or drying. Refused, in words that say the wet weight is closed and to ask the Scribe for a repair: an unloaded, trimmed or frozen lot; a package with live children (`parent_item_id`); a package that has left its space; and, beyond the letter (see the readings), a lot with more than one live package and a package holding fewer grams than the tote. A lot with no package yet (a weighing lot never finished) lowers the lot alone.
4. REOPEN. `POST /station/:key/finished/:lotId/reopen` with the Admin PIN, offered on a drying or in-transit lot only (refused otherwise in words). It calls `runQueueControl(db, "demote", ..., "wet_weight_entries")`, the queue's Demote itself: the status back to weighing with its `demoted` status log, `finished_at` cleared, the field close (`field_closed_at`, `field_closed_by`) cleared with its two log rows. The button then lands the lot where the floor weighs: Penn North Harvest on `/station/wet_weight?lot=<id>`, whose panel already lists every live tote of the lot (`listLotWeights`) and whose + adds to the same lot; the field node on `/station/field_harvest?lot=<id>`, which now shows the lot's every live tote, counted and totaled, above the START form. Once a load is picked, any weighing lot the load touches whose totes are not all on that load (the reopened lot, or a lot carried over from an earlier load) shows the same block under the load's own table: all live totes, the ones on this load marked "This load", the count and total including the new tote. The field + already lands on that HBN's newest weighing lot (`ensureWeighingLotStmts`), so a new tote adds to the reopened lot. The open-load links carry `?lot=` while a reopened lot is in view, and the HBN select takes that lot's HBN as its pick.

   The package, as the Demote handles it today: the Demote does not touch `local_inventory_items`. The minted SPR or WIP stays live at its old `qty` and wherever it stands; nothing is voided or moved. A Void while the lot is weighing again still lowers it (law 3). At the next finish `singleLotFinishStmts` finds the existing package (`getInventoryItemForLot`) and `planFinishMint` sets its `qty` to the lot's new total (log reason `inv_minted`); its location is not changed by that re-finish. The Demote also leaves the Penn North pass (`production_schedules`), any `silo_loads` row and `harvest_file_seq` as they are. One edge from before this slice: if a reopened Penn North lot takes totes of more than one HBN, `splitTruckIfNeeded` plans every group with no existing package (`src/actions.ts:958`), so the header lot would get a second package at the re-finish.
5. THE GATE. Void and Reopen take the Admin PIN, typed on the form or held by the device's `gf_pin` cookie (the cookie a correct PIN entry sets, the same one that opens `/admin/queues`, where Demote lives). The list and the lot page take no PIN.
6. THE HBN LISTS: untouched. The list and the lot page only read. An HBN comes back onto the HBN Queue pane and the field select only through Reopen, by the existing clauses (`NO_FINISHED_LOT_SQL`'s weighing lot and the cleared field close).
7. WORDS: 38 new dictionary lines, each in EN and ES: the status words, the labels, the help lines, the confirm, the two flashes ("Tote voided. ..." and "Lot reopened. ...") and every refusal. "Reason is required." had no Spanish line until now; it reads "El motivo es obligatorio." on every reasoned form. "the Scribe" stays "el Scribe" in Spanish, as the dictionary already writes it.

## Readings the brief left to the build (each named for the Scribe)

1. The gate. The queue's Demote has no PIN check on its POST; the PIN fronts the Data Queues page that carries the button. The weigh screens are open to the floor, so Void and Reopen check the Admin PIN on the server: typed, or held by the device's PIN cookie, the cookie that page sets.
2. "Has left its space" reads: the package's location is none of the PNN barn location it is born in (`barnLocationForSite(LANDING_FARM)`), the lot's space by name (a Hang in Place or Arlington Dry Room package is moved there at finish) and the space's METRC location (`location_name`, where a silo load moves it). Any other location refuses.
3. Two refusals beyond the letter, each with the same "ask the Scribe" ending: a lot with more than one live package (which one would drop is not the floor's call), and a package holding fewer grams than the tote (a negative package is never written). A package of a kind other than SPR or WIP is refused with the wet-closed words.
4. The lot's `weight_grams` is recomputed from its live totes, as every tote write does, rather than decremented; when the two agree, as they should, that is the drop by the tote's grams. The lot's weight change is logged with the reason, beside the tote's and the package's rows.
5. The field node's block shows every weighing lot the picked load touches whose totes are not all on that load. A reopened lot is the case the brief names; a lot carried across loads by a NO send is the same lot in the same state, so it shows too. The block is a `details` open by default, inside the area the + refreshes.
6. A weighing lot's page (after a Reopen) still opens; it offers Void (law 3 allows weighing) and a link to the weigh screen instead of Reopen.
7. "Who weighed it" is the login that saved the tote (`created_by`, by display name, else email). A field tote also shows its load's operator in the Field load column.
8. Penn North Harvest's lot view (`?lot=`) already listed every live tote of a lot and counted it, so nothing there changed; the reopen lands on it.

## Not in this slice, for the Scribe

The existing tote pencil and × (`/record/wet_weights/:id/edit` and `/void`, on both weigh screens) still change a tote of a finished lot without the status check and without moving the package's `qty`, as before this slice. Law 3's rules could be applied to them in a later slice.

## Files touched (against the tree as received)

New (2): `app/src/finishedlots.ts`, `app/test/finishedlots.test.ts`.
Edited (4): `app/src/index.ts`, `app/src/fieldharvest.ts`, `app/src/i18n.ts`, `app/scripts/smoke.mjs`.
None deleted. `migrations/`, `wrangler.toml`, `tsconfig.json`, `package.json` are byte-identical to the tree as received. A throwaway render probe (`test/zz_render.test.ts`, used to look at the list and the lot page in the built-in browser) was deleted before the tree was hashed.

## Tests

8 new cases in `test/finishedlots.test.ts` (1,145 to 1,153; 84 to 85 files):

- the list (3): the window is today and the 7 farm days before it by `farmDayBounds` (06:00 Eastern edges); only the screen's farms, only lots off weighing, METRC-born out, the edge instant in and one minute earlier out, tomorrow's farm day out, newest finish first, the live count and total, the folded `details`, the last five without the whole HBN, EN and ES; a lot finished by YES is listed, its page rendered, and the field select is the same before and after, and the other screen does not see the lot.
- the lot's page (1): live and voided totes newest first, the voided one struck through with when, who and the reason, the live count and total equal to the live sum, Void only on live totes, Reopen on a drying lot, ES; a trimmed lot shows its totes with neither Void nor Reopen and the wet-closed words.
- Void (2): a field lot finished by YES with three totes and its minted SPR: the wrong PIN 403, no reason refused, the other screen refused; then soft, the actor as `deleted_by`, the lot and the package both down by 20,000 g in the same batch, three log rows with the reason, a second void refused, the page reading the load; refused on unloaded, trimmed and frozen, on a package with a live child and on a package moved to CSA, with nothing written; a weighing lot with no package lowers the lot alone.
- Reopen (2): on the field node the wrong PIN 403, then the Demote's effect (weighing, `finished_at` null, the field close cleared, the `demoted` status log), the HBN back on the select, the landing block with all three earlier totes, no block while all totes ride the load in hand, a new load's tote landing on the same lot and counting with the three, ES; on Penn North Harvest an in-transit lot reopened, its package left at its qty, both earlier totes on `listLotWeights`, a + landing on the same lot, and Reopen refused on weighing, unloaded, trimmed and frozen.

## The smoke

A new block at the end of the walk, before SMOKE PASS. On the field node: a fresh PNS Spear HBN, a load to Penn North with totes of 31, 47 and 59 g, Finish Load YES; the field node carries Finished lots folded, listing the lot's last five; the lot's page counts 3 totes, 137 g; Void with the wrong PIN 403, without a reason 400 in words, with both 303 back to the page; the lot reads 2 totes, 78 g, the voided tote listed with its reason, `/log` carries the reason; Reopen with the wrong PIN 403, with it 303, the landing says "Lot reopened." and lists both live totes, 78 g; a new load offers the HBN again, a 13 g tote lands on the same lot and the block counts 3 totes, 91 g; YES again, and the lot's page reads 3 totes, 91 g. On Penn North Harvest: a fresh PNN Spear HBN, Start lot, 200 and 300 g, Finish load; the station carries Finished lots folded, listing the last five and never the whole HBN; the page counts 2 totes, 500 g; Void with the PIN drops it to 200 g and `/log` carries the reason; Reopen lands on `/station/wet_weight?lot=<id>&ok=lot_reopened` with "Lot reopened.", "Finish load" and the live tote's row; a 150 g tote counts on the same lot (2 totes, 350 g); the lot's page sends the floor to the weigh screen; Finish load again.

## Gates

Run in the worktree's `app/`.

- `npm run typecheck`: exit 0.
- `npx vitest run`: 85 files, 1153 tests passed under `TZ=UTC`, and 85 files, 1153 tests passed under `TZ=America/New_York`.
- `node --check scripts/smoke.mjs`: exit 0.
- From-zero smoke (`SMOKE_PORT=9255`, `WRANGLER_SEND_METRICS=false`, `CI=1`, `TZ=UTC`) on the final tree: About to apply 90 migration(s), SMOKE PASS, no ` 500 ` line, exit 0 (18,528 lines of log; the one ` 503 ` line is `POST /api/send`, the smoke's own asserted step). A first run, before a test-only type fix in `test/finishedlots.test.ts` (no `src` or `scripts` change), passed the same way.
- Dash (U+2013, U+2014), CR and BOM audits by character on all 6 touched files and this report: 0. No personnel name in an added line (the test and smoke names are the house's placeholders: Field Hand, Smoke Lead, Smoke Hand).

## Deploy

Not deployed from this session. Nothing committed. Nothing pushed. No git was run.

## Sealed final check

```
the tree as received                  f16eeacbfd987ca3 (281 files, migrations 0001-0090)
npm run typecheck                     exit 0
TZ=UTC npx vitest run                 85 files, 1153 tests passed
TZ=America/New_York npx vitest run    85 files, 1153 tests passed
node --check scripts/smoke.mjs        exit 0
SMOKE_PORT=9255 WRANGLER_SEND_METRICS=false CI=1 TZ=UTC npm run smoke
                                      About to apply 90 migration(s); SMOKE PASS; " 500 " lines: 0; " 503 " lines: 1 (POST /api/send); exit 0
dash audit: 0; CR audit: 0; BOM: 0; personnel data: none new
the app tree after the edits          b333d595286a8b10 (283 files)
```

```
app/scripts/smoke.mjs                765584  2523c940a5cd266d
TAIL });
app/src/fieldharvest.ts               21754  db0a7a6d7e16b6f0
TAIL }
app/src/finishedlots.ts               25024  5853edebc10c9397
TAIL }
app/src/i18n.ts                      247232  861f53cea7538fc0
TAIL }
app/src/index.ts                     170917  5fb40d5f612c47bb
TAIL export default worker;
app/test/finishedlots.test.ts         22640  77e19cfaa8cea4d8
TAIL });
```
