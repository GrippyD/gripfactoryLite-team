# 2026-09-26 One harvest file per load, the gate's fix

The fix sitting on the gate `SESSION_REPORTS/2026-09-26_gate_the_harvest_file_per_load.md` (canon 0.30.254). Migration `0076` is corrected in place. Not deployed. Nothing committed.

## What changed

F3. `file_wet_grams` is `NUMERIC`, the same type as every other weight. `0076` has reached no database but the smoke's throwaway one, so the column is corrected in that file.

F1. A load with no number reads as its rank by `created_at`, then `id`, voided loads included, in the pending list, the changed-after-upload row, the sheet's names, the location-change name, and the unload names. The download and the mark already read that rank.

F2. Saving a load's tags claims the same tags from that batch's unassigned rows: the row takes the load, and the reason is logged. A second unassigned copy of the same tag is voided under that reason, so the load holds the tag once. A tag the hand does not paste stays unassigned, and the count on the row falls by the ones that were claimed.

F4. The comment on `PENDING_WET_UPLOADS_SQL` states the per-load law: a load pends until its own mark, a batch-level mark covers loads created before it, and an edit does not re-pend the file.

F5. A Location change row's file name is the name the download serves. Where the space has a METRC location, that name is the one in the file. The Blast Freezer's row reads `Blast_Freezer`, not `Blast_Freezer_s`.

## Gates

- `npx tsc --noEmit`: exit 0.
- `npx vitest run`: 60 files, 928 tests passed. The same under `TZ=America/New_York`.
- `node --check scripts/smoke.mjs`: exit 0.
- From-zero smoke (`SMOKE_PORT=9176`, `WRANGLER_SEND_METRICS=false`): `About to apply 76 migration(s)`, `SMOKE PASS`, ` 500 ` lines: 0, exit 0.
- Dash audit: 0 on the files below (U+2014 and U+2013).
- `METRC_INTEGRATOR_KEY = "` and `METRC_USER_KEY = "` appear in no file under `src`, `test`, `scripts`, `migrations`, or `wrangler.toml`.

## Deploy

Not deployed from this session. Nothing committed. The migration is still `0076`.

## Sealed final check

```
npx tsc --noEmit                      exit 0
npx vitest run                        60 files, 928 tests passed
TZ=America/New_York npx vitest run    60 files, 928 tests passed
node --check scripts/smoke.mjs        exit 0
SMOKE_PORT=9176 WRANGLER_SEND_METRICS=false node scripts/smoke.mjs
                                      About to apply 76 migration(s); SMOKE PASS; " 500 " lines: 0; exit 0
```

```
migrations/0076_harvest_file_per_load.sql  1245  862d8957d55ad4c6
TAIL ALTER TABLE metrc_uploads ADD COLUMN file_plant_count INTEGER;
src/actions.ts                             349638  a1c5c8ab4d6e0b43
TAIL export { MANIFEST_COLUMNS, buckedPackageCode };
src/db.ts                                  185038  c1328d4549bca912
TAIL }
src/html.ts                                192400  ec8116fca8be247c
TAIL }
src/sheetsync.ts                           79826  7fe9a3f314975dcb
TAIL }
test/harvestfile.test.ts                   12893  b8ea0127798cb04e
TAIL });
test/routing.test.ts                       37203  14c0299589d7e28e
TAIL });
test/surface.test.ts                       80524  96e8b77ab8dbd7a3
TAIL });
```
