# 2026-09-26 The menu lines, the gate's fix

The fix sitting on the gate `SESSION_REPORTS/2026-09-26_gate_the_menu_lines.md` (canon 0.30.250). No migration. The head stays 0075. Not deployed. Nothing committed.

## What changed

D1. A part rides the Logistics line only while its status is `in_transit`. An on-site lot that finished to `drying`, and an old row that reached `unloaded` or `trimmed` without a silo load, are off the line. A truck lot is on the line from the Finish load that set it `in_transit` until Load Silo turns it to `drying`.

D2. The clock starts at each part's latest change-log row that set it `in_transit`. `updated_at` is used only when that log row is missing, so a later edit of a part on the road does not move the clock. Parts of one Truck # still out share one line under the oldest of those clocks.

F3. At a viewport of 480 pixels and under, in Lite, Continuum, and Cerberus, the dots drop out and the name and the status each take the full width of the button. The status wraps whole instead of running past the edge at 390 pixels.

## Assumptions for your word

- A load with no Truck # is still its own line named `Truck`, and only while it is `in_transit`.
- Parts of one Truck # that are still in transit share one line. The clock is the earliest of their `in_transit` instants.
- Below 480 pixels the status sits on its own line, right aligned, so the whole status stays inside the button.

## Gates

- `npx tsc --noEmit`: exit 0.
- `npx vitest run`: 57 files, 912 tests passed. The same under `TZ=America/New_York`.
- `node --check scripts/smoke.mjs`: exit 0.
- From-zero smoke (`SMOKE_PORT=9160`, `WRANGLER_SEND_METRICS=false`): `About to apply 75 migration(s)`, `SMOKE PASS`, ` 500 ` lines: 0, exit 0. The map showed `Truck 9` and `in-transit` while that lot was on the road, and the on-site two-part lot was off the Logistics line.
- Dash audit: 0 on the files below (U+2014 and U+2013).
- `METRC_INTEGRATOR_KEY = "` and `METRC_USER_KEY = "` appear in no file under `src`, `test`, `scripts`, or `wrangler.toml`.

## Deploy

Not deployed from this session. Nothing committed. The head is 0075.

## Sealed final check

```
npx tsc --noEmit                      exit 0
npx vitest run                        57 files, 912 tests passed
TZ=America/New_York npx vitest run    57 files, 912 tests passed
node --check scripts/smoke.mjs        exit 0
SMOKE_PORT=9160 WRANGLER_SEND_METRICS=false node scripts/smoke.mjs
                                      About to apply 75 migration(s); SMOKE PASS; " 500 " lines: 0; exit 0

src/db.ts                        178216  24a04feffae5d372  tail: }
src/drying.ts                     34046  f5176e4ee922de2b  tail: }
src/theme.ts                     156845  05f265ae536f173e  tail: }
test/menulines.test.ts             6191  88e84dc7749f0e5a  tail: });
scripts/smoke.mjs                599044  e5e7c241fc19e9ca  tail: });
```
