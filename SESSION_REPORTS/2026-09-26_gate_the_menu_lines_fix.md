# 2026-09-26 The gate on the menu lines' fix (canon 0.30.251): PASSED

Scribe session. The gate on his Code session's `SESSION_REPORTS/2026-09-26_the_menu_lines_fix.md`, the fix to the held gate of canon 0.30.250 (`SESSION_REPORTS/2026-09-26_gate_the_menu_lines.md`). No migration; the head stays 0075. The report says "Not deployed. Nothing committed."; nothing was deployed before this gate. No Scribe change to `app/`. His hand-back, verbatim in part: "The gate's fix is in ... Nothing was deployed, committed, or pushed. No migration; the head stays 0075."

VERDICT: PASSED. The Logistics line is one line per truck, its clock starts at the Finish load and holds through an edit, and every line keeps its status whole at phone width. Brief P part two, THE MENU LINES, with its fix, is ready for the floor. The deploy line waits for the Scribe-direct slice of 0.30.248 and 0.30.249, which builds on this tree and rides the same worker-only deploy.

## What was gated

1. The tree came over as one tarball, as before. It hashed identical on both sides: 218 files, listing sha256 78a7cf36416cd4d0. Against the held tree (e35c0044bd4d2738) exactly the report's five files changed; against the live tree (a688b16f08bcdaee) the same eight files as part two, one new (`test/menulines.test.ts`); the package files did not move.
2. The five sealed files match the seal byte for byte (size, sha256 and tail). No dash and no CR byte in any of the 121 files under `src`, `test` and `scripts/smoke.mjs`, nor in the fix report.
3. D1: `listMenuEntries` reads today's lots and every part whose status is `in_transit`, no longer every finished part without a silo load, and `truckMenuLines` lines only a part in `in_transit`. D2: each part carries `transit_at`, the latest change-log row setting its status `in_transit`, and a truck's clock starts at the earliest of its parts' `transit_at`, `updated_at` only when the log has none. F3: the line wraps (`flex-wrap`), and at 480 pixels and under in all three skins the dots drop out and the name and the status each take the button's width, the status right aligned.
4. The tests: an on-site `drying` part and an `unloaded` row off the line; a part `in_transit` with a later edit keeps its Finish load clock; a loaded part leaves; the 480 pixel rule in every skin. The smoke: a third load of the two-part HBN with Truck # 9, pointed at the truck sentinel by an edit with a reason and finished, read on the map as `Truck 9` and `in-transit` while on the road, with no bare `Truck` line for the on-site parts.
5. The smoke's D1 after the walk: the road load's status log reads `weighing`, `in_transit` (finish lot), `drying` (silo load); the two on-site parts read `weighing`, `drying` (finish lot), never `in_transit`.
6. A render on a copy of the tree (a throwaway test with the same five seeded lots as the held gate, deleted after): the Logistics line now reads only `Truck 4 ... in-transit 1d 01:00:01`, its clock from its `in_transit` log row 25 hours back and not from its edit two hours back; the on-site lot and the old unloaded row are off it; at 390 pixels every status sits whole inside its button. Kept at `RESEARCH/scribe/pending/menu_lines_fix_map.png` and `RESEARCH/scribe/pending/menu_lines_fix_phone.png`.

## One observation (no hold)

At 390 pixels the status may break inside itself, between the clock's day and its time (`in-transit 1d` over `01:00:02`). Everything stays visible and inside the button; a `nowrap` on the clock would keep `1d 01:00:02` together. Left for his word.

## His word: the fix report's three assumptions

They stand as the report states them: a load with no Truck # its own line named `Truck` while it is `in_transit`; parts of one Truck # still in transit sharing one line under the earliest of their `in_transit` instants; under 480 pixels the status on its own line, right aligned.

## Gates on the tree as received (the Scribe's sandbox)

- `npx tsc --noEmit`: exit 0.
- `npx vitest run`: 57 files, 912 tests passed; the same under `TZ=America/New_York`.
- `node --check scripts/smoke.mjs`: ok.
- From-zero smoke (`SMOKE_PORT=9172`): `About to apply 75 migration(s)`, `SMOKE PASS`, no ` 500 ` line; the dev server lingered after the pass and was ended by the timeout.
- Dash audit: 0, and no CR byte, on the 121 files under `src`, `test` and `scripts/smoke.mjs`, and on the fix report.
- Secret grep (`METRC_INTEGRATOR_KEY = "`, `METRC_USER_KEY = "`, `MS_CLIENT_SECRET = "`, `SENSORPUSH_PASSWORD = "`, `cfas[t]_`): no matches under `src`, `test`, `scripts`, `migrations` or `wrangler.toml`.

## Sealed final check

```
npx tsc --noEmit                      exit 0
npx vitest run                        57 files, 912 tests passed
TZ=America/New_York npx vitest run    57 files, 912 tests passed
node --check scripts/smoke.mjs        ok
rm -rf .smoke-persist && CI=1 SMOKE_PORT=9172 WRANGLER_SEND_METRICS=false npm run smoke
                                      About to apply 75 migration(s); SMOKE PASS; " 500 " lines: 0
the fix session's seal (5 files) verified byte for byte, device and sandbox:
src/db.ts                                     178216  24a04feffae5d372  tail: }
src/drying.ts                                  34046  f5176e4ee922de2b  tail: }
src/theme.ts                                  156845  05f265ae536f173e  tail: }
test/menulines.test.ts                          6191  88e84dc7749f0e5a  tail: });
scripts/smoke.mjs                             599044  e5e7c241fc19e9ca  tail: });
changed, not in the seal: none
tree listing, device and sandbox: 218 files, sha256 78a7cf36416cd4d0
the fix report: SESSION_REPORTS/2026-09-26_the_menu_lines_fix.md  2903  82c43c1228453d5f
dash audit: 0; secret grep: no matches
```
