# 2026-09-26 The load and the lot

Brief P, canon 0.30.241, part one only. The load and the lot. No migration. The head stays 0075. Part two, the menu lines, was not started. Not deployed. Nothing committed.

## What landed

Finish load is the wet weight button (Spanish Terminar carga). The plant prompt on that page asks how many plants the load holds. What Finish load writes is unchanged: the truck split, the born packages, drying, the plant count, and the pending wet weights file. It no longer puts anything on Load Silo.

A lot is the HBN. Its parts are the finished entries that carried it (status drying, or a truck-era in_transit) that no open silo load holds. Internal Logistics is at `/logistics/internal`, behind the same PIN as the old Interco page, in the station-triple shape:

- Dry Queue: every lot with at least one part that no open pass covers. The row reads the label Load Silo uses, the part count, the trucks, the wet grams, the planned silo, and how long the oldest part has waited.
- Scheduled: the lots passed, oldest pass first. `<<` returns a lot while none of it is loaded. `>` opens Load Silo with the lot picked.
- Finished: lots whose pass was completed in the last seven farm days, with the space and the moment.

`>>` is the only way onto Load Silo. Nothing tests whether every load of the lot has finished. A part finished after the pass rides with it until the lot is loaded. A part finished after the load puts the lot back on the Dry Queue with that part alone. Storage is one `production_schedules` row per pass, stage `internal_logistics`, harvest batch set, entry and package null. The load completes the row. `<<` voids it with the unschedule reason. Every write logs. Nothing is written for the lots already waiting: they appear in the Dry Queue, and the scheduler passes them.

Load Silo lists those Scheduled lots. One press loads every part into one space: one `silo_loads` row per part, each package moved as before, the pass completed in the same batch. The planned silo preselects when it is free. `kind` and `next` stay. A part with no plant count is asked again: one `plant_count` box when the lot is a single part, and `plant_count[<entry id>]` when more than one part skipped. The drying surfaces' Available lists those same Scheduled lots, and `>>` opens Load Silo with the lot picked. Clocks, unload, and the freezer branch are unchanged.

The map node reads Logistics Operations (the group key stays `interco_logistics`) and opens `/ops/interco_logistics` with Internal Logistics and Processing Partners. Processing Partners is its title and `- EMPTY -`. The manifest renderers stay in `manifest.ts`. No route reaches them. GET under `/interco` answers 302, and a POST answers 303, both to the group page, acting on nothing.

## Assumptions for your word

- Processing Partners stays a title and `- EMPTY -` until you describe it.
- Lots already waiting at Load Silo appear in the Dry Queue with nothing written. The scheduler passes them with `>>`.
- A part finished after the pass rides with the open pass. A part finished after the load returns the lot to the Dry Queue with that part alone.
- The plant count at Finish load is per load. A truck that splits still asks once per HBN, because each of those is a lot. Load Silo asks again for each part that has no count.
- Finished is the last seven farm days, the same window as the drying Complete pane, from the moment the pass was completed.
- The pane is named Dry Queue. The console's Total Dry Queued is the other end and was not changed.
- Waited time is from the part's `updated_at`, which Finish load sets.
- A part is a drying entry, or a truck-era in_transit entry, with no open load, so today's waiting lots show up.
- The group key stays `interco_logistics`. The words are Logistics Operations.
- Virtual-move still redirects to `/interco` on the first hop. `/interco` then goes to the group page.

## Gates

- `npx tsc --noEmit`: exit 0.
- `npx vitest run`: 56 files, 904 tests passed. The same under `TZ=America/New_York`.
- `node --check scripts/smoke.mjs`: exit 0.
- From-zero smoke (`SMOKE_PORT=9160`, `WRANGLER_SEND_METRICS=false`): `About to apply 75 migration(s)`, `SMOKE PASS`, ` 500 ` lines: 0, exit 0. A two-HBN truck finished into the Dry Queue, stayed off Load Silo until both lots were passed, then each loaded whole and read Finished.
- Dash audit: 0 on the files below (U+2014 and U+2013).
- `METRC_INTEGRATOR_KEY = "` and `METRC_USER_KEY = "` appear in no file under `src`, `test`, `scripts`, or `wrangler.toml`.

## Deploy

Not deployed from this session. Nothing committed. The head is 0075. Part two waits until the Scribe says part one is gated.

## Sealed final check

```
npx tsc --noEmit                      exit 0
npx vitest run                        56 files, 904 tests passed
TZ=America/New_York npx vitest run    56 files, 904 tests passed
node --check scripts/smoke.mjs        exit 0
SMOKE_PORT=9160 WRANGLER_SEND_METRICS=false node scripts/smoke.mjs
                                      About to apply 75 migration(s); SMOKE PASS; " 500 " lines: 0; exit 0

src/actions.ts                   339678  b3d35cca056445b4  tail: export { MANIFEST_COLUMNS, buckedPackageCode };
src/db.ts                        174982  9f18df2014a7e445  tail: }
src/html.ts                      189996  7395bcb0c1c6434e  tail: }
src/pipeline.ts                   50920  17eb4f9b1f3d7885  tail: }
src/nav.ts                         5394  f1673a82d60be181  tail: }
src/scheduling.ts                 44766  c417e93dddc783d1  tail: }
src/drying.ts                     27612  144a5c3ebcd43659  tail: }
src/index.ts                     138563  de1e629b3435e212  tail: export default worker;
src/i18n.ts                      175692  f089873bacdc92b7  tail: }
src/config.ts                     69260  045e4543284a7f96  tail: }
test/logistics.test.ts             4673  bd44bea2d4c262cc  tail: });
scripts/smoke.mjs                591265  825dd58322b3479e  tail: });
```
