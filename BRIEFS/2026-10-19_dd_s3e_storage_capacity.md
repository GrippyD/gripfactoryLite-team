# DD S3e: Storage Capacity Utilization replaces Harvest wet weight

Filed by the Scribe on 2026-10-19 (canon 0.30.519, environmental reads added 0.30.521) from the owner's word: "Harvest wet weight day and season to date: remove and replace with:" a tile labeled Storage Capacity Utilization, "[Live read of any room with a capacity percentage shown as a bar graph with the % above]". Colors: our themes.

His picks (2026-10-19), after the Scribe named the source (the silo pages' fill law: wet loaded over the room's capacity, an unloading room scaling down as it dries out; and the planned tile harvest.dry_space_utilization_pct on that law):
- Use the silo pages' law, live. Keep the planned tile `harvest.dry_space_utilization_pct` on the list, untouched.
- Rooms with a bar: Silos 1 to 5 (PNN, 15,000 wet lb each), the Arlington Dry Room (15,000), and the cure spaces CSA (36 lots) and CSB (8 lots). Not the Blast Freezer, Hang in Place or the Truck.
- Environmental reads (his add, 2026-10-19, after the Scribe named the source: SensorPush reads from the silo-ops feed for five sensors, four in CSA and one in CSB, about 63 F and 47 percent RH in CSA and 64 F and 45 percent in CSB at 1 PM Oct 17; no silo or Arlington sensor in data; no ranges typed under Admin, Environment): under each bar, a room with a sensor shows its live room average temperature and RH, the cure page's reading; warning color when outside a range typed in Admin; a room with no sensor shows nothing extra; new sensors join on their own.
- "Remove" `harvest.wet_weight_lb`: active 0 (it leaves the bizops and farmops walls; its row stays). This reverses his 10-19 keep for that row, which was made before this ask.

For the build session (Cursor, one plain session, no sub-agents): open in `C:\Users\DennisWallace\Documents\Claude\Projects\gripfactory Practical\branches\GFLiteMetrcAPI` (its `app\` is the app). If your working folder is not under `branches\GFLiteMetrcAPI`, stop and say so. Under THE DISPATCH RULE (canon 0.30.155).

RUN AFTER S3d. Pin: the S3d gated tree `9278934a1262ba3f` (S3a to S3d, gated 2026-10-20). Verify with canon's hash command in `app/` (`(find src test scripts migrations -type f; echo wrangler.toml; echo tsconfig.json; echo package.json) | LC_ALL=C sort | xargs sha256sum | sha256sum | cut -c1-16`, `wrangler.toml` read as LF) and stop if it differs. No git; nothing committed, pushed or deployed. One migration, `0110`. LF only. Read big files by search and line range (`src/silo.ts`, `src/cure.ts`, `src/director.ts`, `src/directorregistry.ts`).

## 1. The registry (migration 0110 and src/directorregistry.ts together)
- `harvest.wet_weight_lb`: active 0.
- A new row `bizops.storage_capacity` in its bizops place: dept bizops, wall_keys bizops; title_en "Storage Capacity Utilization", title_es "Uso de capacidad de almacenamiento"; unit pct; cadence daily; dims "space"; goal_kind none; source_kind app; status live; def_version 1; no open question; compute_key: "silo.ts assembleSiloVisuals fill level per silo kind space (the silo tiles' own number: loaded wet over the space's capacityGrams, unloading scaled by dry out); cure spaces by the cure page's lots in place over the space's capacity in ea; spaces with a capacity only, the freezer out".
- Guarded and idempotent; the registry test's counts and equality move with it.

## 2. The data: live, no stored series
The wall reads it on load. Reuse, do not rewrite:
- Silos and the Arlington Dry Room: the same function the silo tiles draw from (`assembleSiloVisuals` and the fill level it returns), so the dashboard's percent for a silo always equals the silo tile's.
- CSA and CSB: the cure page's own count of lots in place against the space's capacity (ea). If the cure page has no reusable count, add one small exported helper in `src/cure.ts` that the cure page also uses, so they cannot drift.
- Environmental reads: the room average the cure page and the silo tiles already show (`src/environment.ts`, `listDoorAverages` or `readDoorAverage` by room name, the same staleness from `environment_stale_minutes`), matched to the bar by the room's name. Out of range is the existing environment flag law (`environmentFlagLines` over `environment_ranges` for that space). Reuse that function as is: it reads sensor_readings by room through the (room, read_at) index, so it is not a scan; call it only for rooms that have a bar; never bring per reading rows into the worker and never add an unindexed sensor_readings query.
- Which rooms: every live dry_space with a capacity whose space_type is not freezer, and not hang or truck. A room added later with a capacity joins on its own. Exclude the freezer by its space_type, not its name.
- The wall must stay under 0.5 s on the live-data bench; report the time.

## 3. The tile
- Head: "Storage Capacity Utilization", v1.
- A bar chart, inline SVG: one vertical bar per room in this order: Silo 1 to 5, Arlington Dry Room, CSA, CSB. The height is the fill percent on a 0 to 100 axis (a bar over 100 draws to the top with a marker and its true percent). The percent is printed above each bar ("72%"); the room's short name under it.
- Bar color from the theme tokens; a room at or over 100 uses the theme's warning token; an empty room shows 0% with a stub.
- Under each bar's name, for a room with a sensor: "63.0 F, 47% RH" (one decimal on the temperature, whole percent RH), in the theme's muted text, or its warning token when the flag law flags it; a stale read (older than environment_stale_minutes) prints its age instead ("no read for 2 h"). A room without a sensor shows nothing there.
- Hover or tap: the room, its state as the silo tile names it (Filling, Drying, Unloading, Empty), the amount in and the capacity ("10,800 of 15,000 wet lb", or "12 of 36 lots"), and the lots in it; for a room with a sensor, the sensors averaged, the read time, and the range when one is typed.
- Under the chart, small: "Live as of 2:14 PM" (the farm clock).
- Theme tokens only; fits at 1920, 820 and the phone with no sideways scroll (the bars narrow; labels may abbreviate, Silo 1 to S1).

## Tests
- A silo's percent equals the silo tile's level for the same data (loading, drying, unloading, empty).
- Arlington Dry Room reads by the same law.
- CSA and CSB read lots over capacity.
- CSA's temperature and RH equal the cure page's room average for the same data; a flagged room uses the warning token; a stale room prints its age; a silo with no sensor prints nothing extra.
- The freezer, Hang in Place and the Truck draw no bar; a new space with a capacity does.
- Over 100 draws to the top with its true percent; the hover text; "Live as of".
- The registry: Harvest wet weight inactive; the new row on bizops.
- No dash characters in any output.

## Smoke and gates
Smoke: `About to apply 109 migration(s)` (S3d's read 108). Seed a filling silo, a drying silo, an empty silo, a cure lot and two sensor reads on the cure room, load the wall, check the bars and percents and that Harvest wet weight is gone; keep every other check. Gates: typecheck 0; vitest under TZ=UTC and TZ=America/New_York with counts; `node --check scripts/smoke.mjs`; the from zero smoke (SMOKE PASS, no 500); renders of the bizops wall in Lite, CO and Cerberus at 1920, 820 and the phone, a hover shown; dash, CR and name scans of every touched file. On a live-data bench: the wall's load time and each room's percent against its silo or cure tile, and CSA and CSB temperature and RH against the cure page.

## Hand back
Report `SESSION_REPORTS/2026-10-19_dd_s3e_storage_capacity.md`, short: the tree received and left, files touched, gate results, timings, anything declined and why. Close with the tree hash and that nothing is committed, pushed or deployed. The Scribe gates; the owner merges (it carries migration 0110, so the merge block takes a snapshot first).
