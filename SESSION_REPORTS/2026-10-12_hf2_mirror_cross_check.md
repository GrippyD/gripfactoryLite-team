# 2026-10-12 HF2: the mirror page's cross-check stops comparing every package to every ledger item (canon 0.30.437), Scribe-direct (G-2): SEALED

After HF1 (worker b0bad91b) the owner's tail ran clean for twenty minutes, then: `GET /silos/live.json ... (error) Error: D1_ERROR: D1 DB exceeded its CPU time limit and was reset.` at 12:57:24, and the METRC mirror page answered "Could not save. Server error." ("That's where it ends").

THE METHOD: the `20261012-115351_pre_hf1` snapshot (every table, 1,694,892 rows) was loaded into a local D1 under `wrangler dev` on the HF1 tree and every static GET route (62), every report (14), the ops pages, the silo poll and the feeds were timed with the Admin PIN. One page stood out: `/inventory/metrc` took 12.9 s on a laptop's SQLite; nothing else took more than 0.47 s (`/harvest`). D1 cuts a query off long before that and resets the database, and whatever else is in flight fails with it (the silo poll in the tail).

THE CAUSE: `metrcCrossCheck` in `src/metrc.ts` counted the active packages the ledger claims with `SELECT COUNT(*) FROM metrc_packages p WHERE p.gone_at IS NULL AND EXISTS (SELECT 1 FROM local_inventory_items i WHERE i.deleted_at IS NULL AND UPPER(TRIM(i.metrc_tag)) = p.tag)`. The function on the ledger side means no index can serve the match, so it is 11,632 active packages by 4,715 live ledger items, 55 million comparisons; 14.5 s of the 12.9 s page was that one statement.

THE FIX (`src/metrc.ts`, one statement gone): the claimed count is the live mirror tags the page's first query had already joined (the ledger rows with their `mirror_tag` and `gone_at`), counted once each in memory. On the owner's data the old statement and the new count both give 897; `metrc_unclaimed` (11,632 less 897) is unchanged. The mirror page then answers in 0.08 s on the same copy. One test added (`test/metrc.test.ts`): three mirror packages (two live, one gone) and five ledger items (two claiming the same live tag in different case and spacing, one claiming the gone one, one unknown, one untagged) give active 2, unclaimed 1, tagged 4, in METRC 2, gone 1, unknown 1, untagged 1.

`src/metrc.ts` 103,540 bytes `f44b9cf6990d3bc5` (main 103,230 `e1a162748d094617`); `test/metrc.test.ts` 65,507 `967d8ecb6ad93973`. The tree `9946b785e98d1be9` (355 files, 0001-0098) on main's HF1 tree `e441b88248582a6c`; in `branches/GFLiteMetrcAPI`, the disk the same. No migration.

THE SWEEP, for the record (the HF1 tree plus HF2, the live data, local SQLite, seconds): `/inventory/metrc` 0.08 (was 12.9); `/harvest` 0.47; `/compliance/rad_operation` 0.35; `/inventory` 0.32; `/compliance/rad_schedule` 0.31; `/admin/uploads` 0.26; `/marketplace` 0.25; `/reports/inventory` 0.19; `/station/load_silo` 0.14; `/reports/tats` 0.13; `/admin/queues` 0.13; `/ops/drying_ops` 0.12; `/` 0.11; `/reports/floor_vs_metrc` 0.10; `/silos/live.json` 0.06; every other route and report under 0.08. The local copy (`.live-persist`, 697 MB, git-ignored, never committed) stays in the Scribe's workspace as the timing bench for every slice from here on.

## Sealed final check

```
THE TREE                              9946b785e98d1be9 (355 files, 0001-0098), on main 227e47f = e441b88248582a6c; disk (branches/GFLiteMetrcAPI) the same
npm run typecheck                     exit 0
TZ=UTC npx vitest run                 102 files, 1499 tests passed
TZ=America/New_York npx vitest run    102 files, 1499 tests passed
node --check scripts/smoke.mjs        exit 0
CI=1 SMOKE_PORT=9472 npm run smoke    About to apply 98 migration(s); SMOKE PASS; exit 0; " 500 " lines: 0
live-data bench                       /inventory/metrc 12.9 s before, 0.08 s after; the claimed count 897 both ways
dash audit (by character): 0; CR audit: 0; personnel names: none
```

## The merge (his hands; no migration)

```powershell
cd "C:\Users\DennisWallace\Documents\Claude\Projects\gripfactory Practical\app"
node scripts/db-snapshot.mjs pre_hf2
if ($LASTEXITCODE -ne 0) { throw "snapshot failed, stop here" }
cd "C:\Users\DennisWallace\Documents\Claude\Projects\gripfactory Practical\branches\GFLiteMetrcAPI"
git add -A
git commit -m "HF2: the mirror cross-check counts claimed packages from the ledger join" -m "The claimed count comes from the ledger rows the page already joined, in place of an EXISTS that compared UPPER(TRIM(metrc_tag)) of every ledger item to every active package (55 million comparisons; D1 reset the database and the mirror page answered 500). Same figures. No migration. Canon 0.30.437 to 0.30.438.`n`nCo-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`nClaude-Session: https://claude.ai/code/session_01VDz7UdaTSkjq69GvDfDWd7"
cd "C:\Users\DennisWallace\Documents\Claude\Projects\gripfactory Practical"
git checkout -- canon
git merge --no-ff GFLiteMetrcAPI -m "Merge HF2"
git push
```

His paste back: the Version ID.
