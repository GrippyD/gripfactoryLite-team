# 2026-09-15 THE LOCATION WITHOUT THE FARM (canon 0.30.82)

Scribe-direct under G-2. Owner ruling 2026-09-15, verbatim: "CSVs shouldn't contain the farm name in the locations.  "PNN\barn" is just my shorthand for "barn" at one of the PNN licenses.  Adding the farm prefix confuses METRC".

## The law

The app's barn names carry their site (BARN, ARL BARN, PNS BARN) so our screens and internal reports tell the sites apart. METRC knows the barn at each license as its own location, so every CSV that leaves for METRC drops a leading farm code: `metrcLocationName` strips a leading ARL, PNN or PNS (case-insensitive, one space or more) and returns the rest; "ARL BARN" and "PNS BARN" read BARN; "Silo 3", "Blast Freezer" and "Arlington Dry Room" pass through untouched. The internal Inventory by Location report keeps the prefixes, since it is ours.

Covered CSVs: the harvest wet weight CSV (DryingLocation, all three writers in `src/csv.ts`), the packages-from-harvests CSV (Location), the intercompany location change CSV (Location) and the plant location change CSV (Location).

## What changed

- `src/config.ts`: `metrcLocationName`, the ruling quoted above it.
- `src/csv.ts`, `src/interco.ts`, `src/locations.ts`: every METRC location cell goes through it.
- `test/routing.test.ts` (+1 describe): the helper's cases; the two location-change CSVs read BARN for a satellite barn.
- `test/csv.test.ts`: the wet CSV barn pins read BARN; passthrough pins for "Silo 3" and "Arlington Dry Room".
- `scripts/smoke.mjs`: the wet CSV pins read `,BARN,,`; no METRC file in the walk carries "ARL BARN", "PNS BARN" or "PNN BARN".

No migration; no route change.

## Open question for the owner

Our location names are uppercase (BARN); his METRC exports have shown the barn as "Barn". METRC location matching on import is the thing to watch on the first live upload; if it minds the case, the fix is one map in `metrcLocationName`, no schema change.

## Gates

- `npx tsc --noEmit`: 0 errors.
- `npx vitest run`: 26 files, 608 tests passed.
- From-zero smoke: "About to apply 50 migration(s)", SMOKE PASS.
- Dash audit: 0 on every changed file.

## Deploy (his hands, worker only)

From `app/`: `npm run deploy:grip`. Ships with THE LOADING SILO (0.30.81).

## Sealed final check

```
src/config.ts           37632  dd6d9da8c6fe7341
src/csv.ts              16860  f7c8468edc93db58
src/interco.ts          20253  20ea64e8444f2ce8
src/locations.ts        24277  2c561f99c7961db1
test/routing.test.ts    35325  c3a49e8ab201f59c
test/csv.test.ts        18050  e9efd4d43d0c0b89
scripts/smoke.mjs      359922  a65f5b0346cd5d1d
tsc: 0 errors; vitest: 26 files, 608 tests passed
smoke: About to apply 50 migration(s); SMOKE PASS
dash audit: 0 on every file above
```
