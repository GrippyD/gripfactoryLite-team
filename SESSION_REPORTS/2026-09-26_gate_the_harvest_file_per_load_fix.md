# 2026-09-26 The gate on the fix to one harvest file per load (canon 0.30.256): PASSED

Scribe session. The re-gate of brief R, ONE HARVEST FILE PER LOAD (canon 0.30.249), on his Code session's `SESSION_REPORTS/2026-09-26_the_harvest_file_per_load_fix.md`, the fix the first gate held for (`SESSION_REPORTS/2026-09-26_gate_the_harvest_file_per_load.md`, canon 0.30.254). The report says "Not deployed. Nothing committed."; nothing was deployed before this gate. No Scribe change to `app/`. His hand-back, verbatim in part: "The five gate findings are fixed, and the report is `SESSION_REPORTS/2026-09-26_the_harvest_file_per_load_fix.md`. Nothing was committed or deployed."

VERDICT: PASSED. Every gate passes, each of the five findings reads as fixed, and the fixed 0076 rehearses cleanly on the floor's newest snapshot. The deploy is his: the three-step block with a pre snapshot, at the end.

## What was gated

1. The tree came over as one tarball. It hashed identical on both sides: 222 files, listing sha256 e1168563d2f37813. Against the gated tree (97f03347c8a70d1a) exactly the fix report's eight sealed files changed: `migrations/0076_harvest_file_per_load.sql`, `src/actions.ts`, `src/db.ts`, `src/html.ts`, `src/sheetsync.ts`, `test/harvestfile.test.ts`, `test/routing.test.ts`, `test/surface.test.ts`. Against the live tree (e227d152315a2368, worker 40c32af2) the same eighteen files as the build, no more. The package files, `wrangler.toml` (d8b173eed0cc9b72) and the 52 support files outside the listing (b870c910a420340b) did not move.
2. The eight files match the fix report's seal byte for byte (size, sha256 and tail). No dash and no CR byte in any of the 200 files under `src`, `test`, `migrations` and `scripts/smoke.mjs`, nor in the fix report.
3. Read against the five findings:
   - F3: `ALTER TABLE metrc_uploads ADD COLUMN file_wet_grams NUMERIC`, the one-word change in place; 0076 has still reached no database but a smoke's.
   - F1: `HARVEST_FILE_SEQ_SQL`, `COALESCE(w.harvest_file_seq, rank)` with the rank by `created_at` then `id`, voided loads counted, the same count `getHarvestLoad` takes for the download and the mark; it now feeds the pending list, Changed after upload, the three pending package queries, the pending location changes, the sheet's pending names and their order, the mark's number, the tag refusal and the location change, package and adjustment downloads. The sheet's `seq ?? 1` fallbacks are gone.
   - F2: saving a load's tags first reads the batch's unassigned rows; a pasted tag found there is claimed (the row takes the load, one log row), a second unassigned copy of the same tag is voided under the same reason, and no new row is written for it; a tag not pasted stays unassigned, so the batch's count falls by the claimed ones. A tag held by another live load is still refused by its file's name.
   - F4: the comment on `PENDING_WET_UPLOADS_SQL` states the per-load law (its own mark; a batch-level mark covers the loads created before it; an edit, an unload or a trim does not re-pend).
   - F5: the pending location change row carries `file_location` (the space's METRC location, else its name), the name the download serves; the Blast Freezer's row reads `Blast_Freezer`.
4. THE REHEARSAL of the fixed 0076 on the newest snapshot, `db_backups/20260926-194410_post_26054_void` (23:44:11Z; 66 tables; 61 loads, 31,849 tags, 33 marks), loaded into a database built by migrations 0001 to 0075: every load numbered (61 of 61), no batch with a repeated number, every batch numbered 1 to n (55 ones, 3 twos, 2 threes, 1 four), no live load numbered past its live rank; `file_wet_grams` NUMERIC and `file_plant_count` INTEGER; of 28,184 live tag rows 25,383 took their load, no tag points at another batch's load, and the unassigned rest sit on four batches: 26269-PNN-OD-091-0-NA-26062 (288 tags, two finished loads and one weighing, the two-or-more rule) and three voided batches (26054, 26040, 26035) no page shows. The old law pends 43 batches, the new one 32 loads (26062 as (1) and (2)); the 12 batches that drop off are all covered by their batch marks; none pends new. Changed after upload lists none. The pending package and location change queries run on the real rows with no null number (35 and 32 rows). The five PNS lots of 9/24 pend as (1) each, still unmarked; 26054 is gone.
5. THE SMOKE'S D1 after the walk: 76 migrations, the head 0076; five batches with two or more loads numbered 1 and 2 (four) and 1 to 3 (one), no repeated number, the one unnumbered load still weighing; nine per-load marks, seven carrying their grams (integers in the NUMERIC column) and two Clear all rows carrying none, the Changed after upload query reading only marks with grams; two acknowledgment baselines (100 then 120, 1,235 then 1,240); five tags pasted as new rows under "plant tags replaced". The walk leaves no unassigned tag to claim, so the claim itself rests on the new test.

## Observations for his word (no hold)

- A claimed tag's log row carries the save's reason, "plant tags replaced", not a word of its own.
- A Clear all row's name doubles the extension and trades the number's parentheses for underscores (`cleared_wet_weights_<HBN>_1_.csv.csv`); it is a history label, never a file, and the line that builds it is the live one.
- The F2 test covers the claimed tag and the tag left unassigned, not the second unassigned copy the code voids.
- Two `seq ?? 1` fallbacks in `src/db.ts` no longer fire, the rank filling every null upstream.
- On the floor after the deploy: 26062's two finished loads read 288 unassigned tags until a hand pastes them per load; the five 9/24 lots read as five pending (1) files until they are marked (METRC already holds all five, and under the append law an upload would add to them).

## Gates on the tree as received (the Scribe's sandbox)

- `npx tsc --noEmit`: exit 0.
- `npx vitest run`: 60 files, 928 tests passed; the same under `TZ=America/New_York`.
- `node --check scripts/smoke.mjs`: ok.
- From-zero smoke (`SMOKE_PORT=9177`): `About to apply 76 migration(s)`, `SMOKE PASS`, no ` 500 ` line; the dev server ended by the timeout after the pass; the two `Request was cancelled` lines are the dev server's `Request.cf` fetch at start, as on every run here.
- Dash audit: 0, and no CR byte, on the 200 files and the fix report.
- Secret grep (`METRC_INTEGRATOR_KEY = "`, `METRC_USER_KEY = "`, `MS_CLIENT_SECRET = "`, `SENSORPUSH_PASSWORD = "`, `cfas[t]_`): no matches under `src`, `test`, `scripts`, `migrations` or `wrangler.toml`.

## Deploy (his hands; migration 0076 rides, so the snapshot, the probe and the apply lead)

```powershell
cd "C:\Users\DennisWallace\Documents\Claude\Projects\gripfactory Practical\app"
node scripts/db-snapshot.mjs pre_harvest_file_per_load
npx wrangler d1 execute gripfactory-lite-grip-20260914 --env grip --remote --command "SELECT 1"
npx wrangler d1 migrations apply gripfactory-lite-grip-20260914 --env grip --remote
npm run deploy:grip
```

The apply asks once; answer y. One 7403 on the probe is the blip: run it again. His paste back: the apply's last lines and the Version ID. THE PROBE after: Pending Data Uploads lists one row per load, each `<HBN>(n).csv` with its Load and Plant count; 26062 reads (1) and (2) with its unassigned note.

## Sealed final check

```
npx tsc --noEmit                      exit 0
npx vitest run                        60 files, 928 tests passed
TZ=America/New_York npx vitest run    60 files, 928 tests passed
node --check scripts/smoke.mjs        ok
rm -rf .smoke-persist && CI=1 SMOKE_PORT=9177 WRANGLER_SEND_METRICS=false npm run smoke
                                      About to apply 76 migration(s); SMOKE PASS; " 500 " lines: 0
the fix report's seal (8 files) verified byte for byte, device and sandbox:
migrations/0076_harvest_file_per_load.sql       1245  862d8957d55ad4c6
src/actions.ts                                349638  a1c5c8ab4d6e0b43
src/db.ts                                     185038  c1328d4549bca912
src/html.ts                                   192400  ec8116fca8be247c
src/sheetsync.ts                               79826  7fe9a3f314975dcb
test/harvestfile.test.ts                       12893  b8ea0127798cb04e
test/routing.test.ts                           37203  14c0299589d7e28e
test/surface.test.ts                           80524  96e8b77ab8dbd7a3
changed against the gated tree, not in the seal: none
tree listing, device and sandbox: 222 files, sha256 e1168563d2f37813 (gated: 97f03347c8a70d1a; live: e227d152315a2368)
the fix report: SESSION_REPORTS/2026-09-26_the_harvest_file_per_load_fix.md  3192  01e0270e13774e2f
the rehearsal: db_backups/20260926-194410_post_26054_void through 0001-0075, then 0076: 61 of 61 loads numbered,
  0 repeats, 25,383 of 28,184 live tags given their load, 32 loads pending (43 batches under the old law),
  file_wet_grams NUMERIC
dash audit: 0; secret grep: no matches
```
