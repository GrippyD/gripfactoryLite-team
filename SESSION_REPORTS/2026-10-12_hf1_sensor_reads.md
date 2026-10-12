# 2026-10-12 HF1: the environment reader stops scanning every sensor reading (canon 0.30.435), Scribe-direct (G-2): SEALED

The owner, 2026-10-12: "Server error on all my upload panes and metrc mirror. I can't update for some reason." The live tail (his hands, `npx wrangler tail --env grip`) showed, on `/`, `/silos/live.json`, `/ops/harvest_ops` and `/inventory/metrc`: `D1_ERROR: D1 DB exceeded its CPU time limit and was reset.` Migrations 0096 to 0098 were applied ("no migrations to apply"); MA1 is not the cause.

THE CAUSE: two queries in `src/environment.ts` read the whole of `sensor_readings` on every page that carries the drying panes or the environment flags. `listDoorAverages` found the door rooms with `SELECT room, MAX(read_at) ... WHERE role IS NULL AND lower(trim(coalesce(source, ''))) <> 'test' GROUP BY room`, a full scan with two functions per row; `listEnvironmentFlags` and `loadEnvironmentPage` found each sensor's newest reading with a correlated `read_at = (SELECT MAX(read_at) ... WHERE sensor_id = r.sensor_id)`, one subquery per row. Both were fine at twenty thousand rows (0.30.246). Silo Ops' door has added about 7,000 readings a day since the backfill of 2026-10-08; at about 175,000 rows D1 resets the query, and every page that calls the reader answers 500. The owner's question of 2026-10-09 ("looks like we're already over 150k records") was the warning.

THE FIX (`src/environment.ts` only, plus one test):

1. `doorRoomNames(db)`: the rooms a door reading can name come from the lookups the app keeps, in the lookups' own spelling (the door stores a room as the lookup spells it, `oneReading` in cure.ts): the cure rooms of `app_config` (CSA and CSB when blank), the dry spaces, every space with an environment range, every space with a sensor binding; deduped without case. `listDoorAverages` reads each of those rooms through the existing per-room MAX and window queries, which walk the `(room, read_at)` index backwards. A room with readings but none of those has nothing to flag and no pane, so it is not read.
2. `newestReadings(db, sensorIds)`: the newest row per named sensor, one `WHERE sensor_id = ? ORDER BY read_at DESC LIMIT 1` per sensor (the unique index `(sensor_id, read_at)` of 0077), batched 50 at a time, blanks and repeats dropped. `listEnvironmentFlags` reads the bound sensors only; `loadEnvironmentPage` reads the catalog's and the bindings' sensors. The unused `ReadRow` type is gone.

Nothing shown changes: the same rooms, the same units, the same newest readings, the same flags. No migration.

`src/environment.ts` 31,226 bytes `74f0b406fb0e9807` (was 29,103 `6a12f325e3c4b561` on main); `test/environment.test.ts` 14,239 bytes `facc2167717c23d5` (one test added: 6,000 readings across two units, the newest of each comes back and only theirs, blanks and an unknown id give nothing, the door rooms hold CSA and CSB, the CSA door average counts the two units). The tree `e441b88248582a6c` (355 files, 0001-0098) on main's `58fc5c6ddc2afb28`; copied into the idle worktree `branches/GFLiteMetrcAPI` (the Ops Dashboard worktree holds T1's build session), the disk the same.

## Sealed final check

```
THE TREE                              e441b88248582a6c (355 files, 0001-0098), on main abc8d15 = 58fc5c6ddc2afb28; disk (branches/GFLiteMetrcAPI) the same
npm run typecheck                     exit 0
TZ=UTC npx vitest run                 102 files, 1498 tests passed
TZ=America/New_York npx vitest run    102 files, 1498 tests passed
node --check scripts/smoke.mjs        exit 0
CI=1 SMOKE_PORT=9467 npm run smoke    About to apply 98 migration(s); SMOKE PASS; exit 0; " 500 " lines: 0 (a first run caught the freezer room missing from the room list; the ranged and bound spaces were added and the run repeated)
dash audit (by character): 0; CR audit: 0; personnel names: none
```

## After the merge

The pages come back with the deploy; no migration, no data change. SR1 (sensor retention, the owner's word on purge alone or purge with an hourly rollup, 90 days) stays next in the queue: the reader is now bounded, but the table still grows 7,000 rows a day and every snapshot dumps all of it.

## The merge (his hands; no migration)

```powershell
cd "C:\Users\DennisWallace\Documents\Claude\Projects\gripfactory Practical\app"
node scripts/db-snapshot.mjs pre_hf1
if ($LASTEXITCODE -ne 0) { throw "snapshot failed, stop here" }
cd "C:\Users\DennisWallace\Documents\Claude\Projects\gripfactory Practical\branches\GFLiteMetrcAPI"
git add -A
git commit -m "HF1: the environment reader stops scanning every sensor reading" -m "The door rooms come from the lookups and each sensor's newest reading is one index seek, in place of a GROUP BY over sensor_readings and a correlated MAX per row that D1 reset for CPU time past about 175,000 readings (every page with the drying panes answered 500). No migration. Canon 0.30.435 to 0.30.436.`n`nCo-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`nClaude-Session: https://claude.ai/code/session_01VDz7UdaTSkjq69GvDfDWd7"
cd "C:\Users\DennisWallace\Documents\Claude\Projects\gripfactory Practical"
git checkout -- canon
git merge --no-ff GFLiteMetrcAPI -m "Merge HF1"
git push
```

His paste back: the Version ID. If the snapshot itself fails for CPU time on `sensor_readings` (the dump reads the whole table), say so and run the block from `git add -A` on: the fix is what makes the database answer again, and `post_hf1` is taken after.
