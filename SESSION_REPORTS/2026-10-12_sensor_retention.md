# 2026-10-12 SR1: sensor retention, the hourly rollup and the 90-day purge (BRIEF SR1): SEALED

BRIEF SR1 `BRIEFS/2026-10-12_sensor_retention.md`, built in `branches/GFLiteMetrcAPI`. The pin was checked before any edit, with canon's hash command run in `app/` (Git Bash `sha256sum` binary marker read as two spaces, `wrangler.toml` already LF): `d6ecd7050716a753`, 355 files, migrations 0001-0098. The brief header names the dispatch at canon 0.30.448. This worktree's `canon/CANON.md` last row is 0.30.429. The brief was built as written.

One migration, `0100_sensor_hourly.sql`. T1's 0099 is not in this worktree. No git, nothing committed, pushed, or deployed.

## What was built

`sensor_hourly` keeps one row per room, unit, and source for each UTC hour: count, min, avg, and max temperature and humidity, and the first and last read. `sensor_key` and `source_key` store the coalesced text so the unique key is a plain index. The migration seeds `sensor_retention_days` at 90 and `sensor_rollup_through` blank, each only when the key is absent.

The quarter-past cron, after In Testing and in its own try, calls `rollupSensorHours`. It walks at most 24 hours from the watermark (or from the oldest reading that is not a test row) through the hour that ended at least two hours earlier, one insert per hour through `(room, read_at)`, and a rerun inserts nothing. It then deletes raw rows older than the retention whose hour is at or before the watermark, 500 at a time and at most 20 chunks, and it never deletes a unit's newest row or a room's newest door row. A `source` of `test` is never rolled and is purged by age. The log line is `[sensors] rolled N hours, R readings, through H, purged P`. A failure there does not fail the sheet, the sweep, or In Testing.

`/reports/environment_history` is on the Reports menu in English and Spanish. The room list is `doorRoomNames` plus any room already on `sensor_hourly`. From and To are the farm's days, Eastern midnight to midnight, default the last seven. One line per unit per hour, and the room average under an hour with more than one unit. The read is `sensor_hourly` through `(room, hour_start)` with the room and the two dates bound. CSV is the report's standing CSV control. The Environment page is unchanged.

`scripts/db-snapshot.mjs` dumps every user table named in `sqlite_master` (`d1lib.mjs` `listTables`), so `sensor_hourly` rides with no change to the script. The smoke does not take a snapshot.

## Files (all under `app/`, plus this report)

| file | bytes | sha256 (16) | what |
|---|---|---|---|
| `migrations/0100_sensor_hourly.sql` | 1,403 | `9a971bd80a9b1fe9` | the hourly table, its two indexes, the two app_config seeds |
| `src/sensorhistory.ts` | 19,087 | `3b3d43a78bf42c9f` | the rollup, the purge, the report |
| `src/index.ts` | 187,023 | `f53ac54d795be5c6` | the quarter-past step, the report route |
| `src/i18n.ts` | 320,309 | `8f2b42fa6df76ffe` | the report's words, EN and ES |
| `src/reports.ts` | 36,082 | `c92ee7c88c2db6cd` | the report key and the menu card |
| `test/sensorhistory.test.ts` | 17,014 | `7be17a65ed36133d` | the roll, the hold, the rerun, the purge, the report SQL |
| `test/console.test.ts` | 97,679 | `b7f42e1528f18014` | the report list length, 14 to 15 |
| `scripts/smoke.mjs` | 853,131 | `51866b6e50a7aa5e` | 99 migrations, the four hours, the 100-day row, the report |

`npm run typecheck` also rewrote the generated `worker-configuration.d.ts`. It is not part of this slice and it is not in the tree hash.

## Sealed final check

```
THE TREE                              fe92928657dad8ba (358 files, 0001-0098 plus 0100), on the pin d6ecd7050716a753; disk the same
npm run typecheck                     exit 0
TZ=UTC npx vitest run                 103 files, 1511 tests passed
TZ=America/New_York npx vitest run    103 files, 1511 tests passed
node --check scripts/smoke.mjs        exit 0
CI=1 SMOKE_PORT=9485 npm run smoke    About to apply 99 migration(s); SMOKE PASS; exit 0; " 500 " lines: 0
dash audit (by character): 0; CR audit: 0; personnel names: none
```

The passing smoke's sensor lines: `[sensors] rolled 24 hours, 16 readings, through 2026-10-10T20:00:00.000Z, purged 0` and `[sensors] rolled 24 hours, 0 readings, through 2026-10-11T20:00:00.000Z, purged 1`.

## After the deploy (owed to no one outside)

Nothing to anyone outside. The first day's quarter-past runs clear the backlog on their own. The Scribe reads the log line and the next snapshot's row count. This session did not deploy.
