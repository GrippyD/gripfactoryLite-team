# DD S3e: Storage Capacity Utilization (2026-10-19)

Worktree `branches/GFLiteMetrcAPI`. Tree received `9278934a1262ba3f` (the S3d gated tree, 399 files). Tree left `cb86a3e5c90890e4`, 402 files. No git. Nothing is committed, pushed, or deployed. `canon/` and `prompts/` were not edited. `harvest.dry_space_utilization_pct` was not touched.

## What an operator sees

On the bizops wall, Harvest wet weight is gone. In its slot is `bizops.storage_capacity`, titled Storage Capacity Utilization (ES Uso de capacidad de almacenamiento), badge v1, no question mark. Farmops loses the wet weight tile and does not gain this one. The row `harvest.wet_weight_lb` stays, with active 0.

The tile is a live bar chart, read when the wall loads. One vertical bar per live dry space that has a capacity, except a freezer (by space_type) and hang or truck (by kind). Order: Silo 1, Silo 2, and the rest of the numbered silos, then other silos, then dry rooms (Arlington Dry Room), then CSA, then CSB, then any other cure space. A room added later with a capacity joins on its own. The smoke floor's Silo 6 did.

The percent for a silo or the Arlington Dry Room is the silo tile's own fill level (`assembleSiloVisuals`, whole percent, half up). Cure spaces use the cure page's lots in place over the space's ea cap (`cureFullnessPct`, the same number the cure tile prints). The percent sits above the bar. The short name sits under it (Silo 1 as S1, Arlington Dry Room as ARL). A room at or over 100 uses the warning token and draws to the top; over 100 also draws a marker and keeps its true percent. An empty room shows 0% on a stub.

Under the name, a room with a door reading shows temperature to one decimal and whole percent RH, in muted text, or the warning token when `environmentFlagLines` flags it. A read older than `environment_stale_minutes` prints its age instead ("no read for 2 h"). A room with no reading shows nothing there. Hover or tap names the room, the silo state word (Filling, Drying, Unloading, Empty), the amount ("10,800 of 15,000 wet lb" or "12 of 36 lots"), the lots, and, when a sensor joined the average, the sensors, the read time, and the typed range. Under the chart: "Live as of 9:33 PM" on the farm clock.

`stale_after_hours` is 30, the same window as the other daily app rows. The brief did not name one.

## Files

| file | bytes | sha256 |
| --- | ---: | --- |
| app/migrations/0110_dd_storage_capacity.sql | 1522 | fdc17c1d7eb95651 |
| app/src/storagecapacity.ts | 19838 | 81eb19f2eb3d3707 |
| app/src/directorregistry.ts | 109406 | 3ad6010276ad93b8 |
| app/src/director.ts | 97384 | 9796ae1c4ab53e56 |
| app/src/cure.ts | 28948 | 6fdb719c2c716551 |
| app/src/environment.ts | 31765 | 68828aede4f3f644 |
| app/src/db.ts | 233994 | 1aedd444f6ce69a5 |
| app/src/theme.ts | 236967 | 748fd5e334863f7a |
| app/src/i18n.ts | 374237 | e9fab80759e5f804 |
| app/test/storagecapacity.test.ts | 16569 | 25d6b5dadb789173 |
| app/test/director.test.ts | 107055 | 94dc34b5078352d6 |
| app/scripts/smoke.mjs | 913957 | bdddfb2716f3075d |

Dash and CR scan of those twelve files: U+2013 0, U+2014 0, CR 0. The new migration and the new tile code name nobody.

## Gates

Typecheck: `npx tsc --noEmit` exit 0.

Vitest TZ=UTC:

```
Test Files  115 passed (115)
Tests  1647 passed | 6 skipped (1653)
```

Vitest TZ=America/New_York:

```
Test Files  115 passed (115)
Tests  1647 passed | 6 skipped (1653)
```

`node --check scripts/smoke.mjs` exit 0.

From-zero smoke: exit 0. `About to apply 109 migration(s)`. `SMOKE PASS`. Lines containing ` 500 `: 0. Lines containing ` 503 `: 1 (`POST /api/send`, the smoke's own step). The bizops wall showed Storage Capacity Utilization, v1, Silo 1 at 72% (Filling, 10,800 of 15,000 wet lb), Silo 2 drying, Silo 3 at 0% empty, and CSA and CSB percents equal to the cure panes. Harvest wet weight was absent. Blast Freezer(s), Hang in Place, and the Truck drew no bar.

Browser, on the smoke database. Grip at about 1920: page scroll width equals the client width, the hover on Silo 1 read "Filling. 10,800 of 15,000 wet lb", and "Live as of 9:33 PM" sat under the chart. At 820 the same scroll holds and the tile is no wider than itself. On the phone (390, `device-phone`) the document, the app bar, and the tile each have scroll width equal to client width. Lite and Continuum use their own bar colors from the theme tokens. Continuum at 820 also has no sideways scroll.

## Declined

There is no live-data bench in this worktree, so there is no floor timing and no check of each room against the live silo and cure pages. A repeat fetch of the bizops wall on the local smoke server answered 200 in 95 ms. Door windows are a second batch, and only for bar rooms that already have a newest read, through the existing room and read_at index. Rooms with no reading add no sensor query.

## Close

Tree left `cb86a3e5c90890e4`. Nothing is committed, pushed, or deployed. The Scribe gates. The owner merges. This slice carries migration 0110, so the merge block takes a snapshot first.
