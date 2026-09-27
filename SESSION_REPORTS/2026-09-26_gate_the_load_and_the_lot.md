# 2026-09-26 The gate on the load and the lot (canon 0.30.242): HELD for two fixes

Scribe session. The gate on his Code session's `SESSION_REPORTS/2026-09-26_the_load_and_the_lot.md` (brief P part one, THE LOAD AND THE LOT, canon 0.30.241; no migration, the head stays 0075). The report says "Not deployed. Nothing committed."; nothing was deployed before this gate. No Scribe change to `app/`. His hand-back, verbatim in part: "Part one is in ... Nothing was deployed, committed, or pushed. Part two was not started."

VERDICT: HELD. Every gate passes and the law reads as briefed, but two defects on Load Silo's picked form stand between this tree and the floor: the Scheduled pane's `>` opens Load Silo with nothing picked, and a lot of two or more parts drops a plant count typed on Load Silo. Both come from one line. The fix goes back to his Code session (the paste at the end); the gate re-runs on the fix alone.

## What was gated

1. THE SANDBOX WAS RECLAIMED overnight (its mirrors, the scratch tools and the Scribe's rulings log went with it). The Scribe rebuilt it from the device: one tarball of `app/` (no `node_modules`, `.wrangler`, persist folders or `db_backups`), `canon/`, `BRIEFS/`, `SESSION_REPORTS/` and `CLAUDE.md`, and one `git archive` of `HEAD` (60cace2, the tree the floor runs) as the baseline, both packed under `_to_delete/scribe_tmp/` (gitignored) and staged. The rulings log now lives on the device, `RESEARCH/scribe/rulings_log.txt` (gitignored).
2. The tree hashed identical on both sides after the unpack: 217 files by the listing of `src`, `test`, `scripts` and `migrations` with `wrangler.toml`, `tsconfig.json` and `package.json`, listing sha256 cf9c5e4fbf98cd68. Against the baseline, 22 files changed: the report's twelve sealed files, and ten test files the seal leaves out (`test/drying`, `dryingschedule`, `eligible`, `i18n`, `metrc`, `nav`, `ops`, `rooms`, `surface` and `walk`, each `.test.ts`, updated for Finish load, the struck page and the new names). The only other new file is the Scribe's own `scripts/repairs/2026-09-25_purged_cryo_restore.sql`. `wrangler.toml` reads different from the baseline by line endings alone (the disk keeps CRLF, git keeps LF; the disk's sha d8b173eed0cc9b72 is the one canon pins). Brief O has not been built: `src/theme.ts` and `src/metrc.ts` are as the baseline has them.
3. The twelve sealed files match the seal byte for byte (size and sha256). No dash and no CR byte in any file under `src`, `test` or `scripts/smoke.mjs`.
4. Read against part one's law. FINISH LOAD: the button and the plant prompt say load; `finishLot` writes what it wrote (the change log still reads `finish lot`, a storage reason). THE GATE ONTO LOAD SILO: `listScheduledLotsForLoad` lists only HBNs with an open `internal_logistics` pass; `loadSilo` refuses a lot with no open pass ("Pass it from the Dry Queue first."). INTERNAL LOGISTICS at `/logistics/internal` behind the PIN: the Dry Queue (lots with a part no open pass covers), Scheduled (oldest pass first, `<<` and `>`), Finished (seven farm days). `>>` writes one `production_schedules` row (stage `internal_logistics`, the batch, entry and package null) with its log rows; `<<` voids it with the unschedule reason. THE WHOLE-LOT LOAD: one press writes one `silo_loads` row per waiting part into one space, moves each package, and completes the pass in the same batch. The drying surfaces' Available reads the same Scheduled lots. LOGISTICS OPERATIONS: the node's words, the group page with Internal Logistics and a blank Processing Partners, every `/interco` path 302 (GET) or 303 (POST) to `/ops/interco_logistics`, the manifest renderers left in `manifest.ts` with no route. The smoke dropped the manifest builder's walk (161 lines out, 78 in) and walks the new flow instead.
5. THE SMOKE'S D1 after the walk: 11 `internal_logistics` rows (10 complete, one still scheduled), every completed lot with its loads in its space (26259-PNN-GH-027-0-NA-26903 passed twice, its late part loaded on its own pass: the late-part law as briefed); the pass rows logged under `schedule` and their completions under `silo load`.

## The two defects (reproduced on the built code by a throwaway probe in the sandbox, not in the repo)

The probe: one HBN with two finished parts (1,000 g and 500 g, no plant count), passed with `>>`, then Load Silo read through `app.request`, then a load posted as the page's form posts it. Its readings, verbatim:

```
pick=hb-a (the Scheduled > link): picked form false; plant boxes []
pick=part-a1 (the Load Silo list link): picked form true; lot_id part-a1; plant boxes [name="plant_count"]
load with 700 typed in the page's box: {"redirect":"/station/load_silo?load=e0bc1b70-b183-432e-974b-3a448be14ed7&ok=loaded"}; loads [{"wet_weight_entry_id":"part-a1"},{"wet_weight_entry_id":"part-a2"}]; plant counts [{"id":"part-a1","plant_count":null},{"id":"part-a2","plant_count":null}]
```

- D1, THE SCHEDULED `>` PICKS NOTHING (medium): the Scheduled pane links `/station/load_silo?pick=<harvest batch id>`, but Load Silo matches `pick` against its rows' ids, and those are the first part's entry id. The page opens with no lot picked.
- D2, A TYPED PLANT COUNT IS DROPPED (medium): Load Silo gathers the picked lot's parts by `part.harvest_batch_id === picked.id`, which never holds, so the per-part boxes (`plant_count[<entry id>]`) never render; one `plant_count` box renders, and `loadSilo` reads that box only for a single-part lot. The lot loads whole and the count typed for it is lost without a word.
- THE ONE CAUSE: `syntheticLot` in `src/db.ts` spreads the first part (`...first`), so the lot's `id` is an entry id, while its own comment ("The row id is the harvest batch, so a pick loads every part") and the Load Silo route both expect the batch. Giving the synthetic lot the batch as its id makes the list links, the drying surfaces' `>>`, the Scheduled `>`, the selected highlight, the hidden `lot_id` and the parts lookup agree; `loadSilo` already accepts a batch id.

## The lesser findings (for the same fix sitting)

- L1: `<<` refuses a pass while any load of the same HBN is open, so a second pass (a late part after the first load) cannot go back while the first load is still drying. An open pass can hold no loaded part (loading completes it), so the guard should test only what that pass covers.
- L2: an open pass whose parts all leave the queue (an entry voided) stays open and unseen; the next part of that HBN rides it straight onto Load Silo without a fresh `>>`. Scheduled should show an open pass with no parts (so `<<` can clear it), or the pass should close when its last part leaves.
- L3: the synthetic lot's plant count is the first part's count when every part has one; the lot's is their sum.
- L4 (G-10): the seal leaves out ten changed test files; every file the build changes belongs in the seal.
- Two stale comments: the one on `listScheduledLotsForLoad` (fixed by D1's fix) and `src/scheduling.ts` line 580 ("Every lot Load Silo lists (listBarnWetLots ...)").

## His word: the report's ten assumptions

They stand as the report states them: Processing Partners blank; the waiting lots in the Dry Queue with nothing written; the late part law; the plant count per load (a split truck asks once per HBN); Finished over seven farm days; the pane named Dry Queue beside the console's Total Dry Queued; the waited time from the part's `updated_at` (any later edit of the entry restarts that clock); a truck-era `in_transit` entry counting as a part; the group key staying `interco_logistics`; `/virtual-move` taking two hops.

## Gates on the tree as received (the Scribe's sandbox)

- `npx tsc --noEmit`: exit 0.
- `npx vitest run`: 56 files, 904 tests passed; the same under `TZ=America/New_York`.
- `node --check scripts/smoke.mjs`: ok.
- From-zero smoke (`SMOKE_PORT=9167`): `About to apply 75 migration(s)`, `SMOKE PASS`, no ` 500 ` line; exit 0 once the dev server was ended by pid.
- Dash audit: 0, and no CR byte, on every file under `src`, `test` and `scripts/smoke.mjs`, and on the build report.
- Secret grep (`METRC_INTEGRATOR_KEY = "`, `METRC_USER_KEY = "`, `MS_CLIENT_SECRET = "`, `cfas[t]_`): no matches under `src`, `test`, `scripts`, `migrations` or `wrangler.toml`.

## The fix, for his Code session

```
Read canon/_NOW.md, then SESSION_REPORTS/2026-09-26_gate_the_load_and_the_lot.md, and fix what it names in app/ under THE DISPATCH RULE (canon 0.30.155): D1 and D2 (the synthetic lot's id is the harvest batch, and Load Silo renders and writes one plant count box per part that lacks one), L1, L2, L3 and the stale comment. Add a route-level test that opens Load Silo from the Scheduled > and loads a two-part lot with typed counts, and walk the same in scripts/smoke.mjs. No migration. Do not deploy, commit or push. Seal every file you change in SESSION_REPORTS/2026-09-26_the_load_and_the_lot_fix.md, then hand back.
```

## Sealed final check

```
npx tsc --noEmit                      exit 0
npx vitest run                        56 files, 904 tests passed
TZ=America/New_York npx vitest run    56 files, 904 tests passed
node --check scripts/smoke.mjs        ok
rm -rf .smoke-persist && CI=1 SMOKE_PORT=9167 WRANGLER_SEND_METRICS=false npm run smoke
                                      About to apply 75 migration(s); SMOKE PASS; " 500 " lines: 0; exit 0
the build session's seal (12 files) verified byte for byte, device and sandbox:
src/actions.ts                                339678  b3d35cca056445b4
src/db.ts                                     174982  9f18df2014a7e445
src/html.ts                                   189996  7395bcb0c1c6434e
src/pipeline.ts                                50920  17eb4f9b1f3d7885
src/nav.ts                                      5394  f1673a82d60be181
src/scheduling.ts                              44766  c417e93dddc783d1
src/drying.ts                                  27612  144a5c3ebcd43659
src/index.ts                                  138563  de1e629b3435e212
src/i18n.ts                                   175692  f089873bacdc92b7
src/config.ts                                  69260  045e4543284a7f96
test/logistics.test.ts                          4673  bd44bea2d4c262cc
scripts/smoke.mjs                             591265  825dd58322b3479e
changed, not in the seal (read in the sandbox):
test/drying.test.ts                            14988  7eb1600869d1aa11
test/dryingschedule.test.ts                    43163  c164a5bee02a5c37
test/eligible.test.ts                          10993  2a3421eb9b9a5fef
test/i18n.test.ts                              17649  4ef25ae6191cf6f2
test/metrc.test.ts                             63937  48988bcfdd478f99
test/nav.test.ts                                8343  bffdfd24a5f68d82
test/ops.test.ts                                9168  b5ce7cc48a405b16
test/rooms.test.ts                              7762  52bf81231edfffe1
test/surface.test.ts                           80319  8b31cdb946a77e09
test/walk.test.ts                              43818  b9c4672f111b6a4f
tree listing, device and sandbox: 217 files, sha256 cf9c5e4fbf98cd68
the build report: SESSION_REPORTS/2026-09-26_the_load_and_the_lot.md  5992  ec29320eabad3a9f
dash audit: 0; secret grep: no matches
```
