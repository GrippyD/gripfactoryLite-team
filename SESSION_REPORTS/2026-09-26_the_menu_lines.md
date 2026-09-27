# 2026-09-26 The menu lines

Brief P, canon 0.30.241, part two only. The menu lines. No migration. The head stays 0075. Part one is already live. Not deployed. Nothing committed.

## What landed

Under the label of Harvest Operations, Logistics Operations, and Drying Operations, each live fact is a line at half the label's height. The name sits at the left, the status at the right, and dots fill the gap to the width of the button. Production, Business, and Marketplace carry no lines.

Harvest lists one line per lot whose first load began on this farm day, the day starting at the Admin setting `farm_day_start_hour`. `Lot n` is that lot's place by its first load (1, 2, 3), and the number stays when an earlier lot leaves the line. It reads `in progress` while a load is on the scale or in the Dry Queue, and `ready to be moved` once the lot is Scheduled and nothing is still on the scale. A lot that is loaded leaves the line. A lot whose first load began before this farm day is not on it.

Logistics lists one line per truck from its Finish load until every part it carried is in a dry space. The name is `Truck n`. The status is `in-transit` and the time since that Finish load, and the time ticks. A load with no Truck # is its own line, named `Truck`.

Drying lists one line per silo or dry room that holds an open load. The name is the space. The status is `drying` and the clock the silo strip reads, including `Paused` when that clock is paused. Two or more loads show the longest clock. Freezers are not on the line.

The new words have Spanish. The clocks use the same ticking script as the silo strip.

## Assumptions for your word

- Production, Business, and Marketplace stay blank until you name what they say.
- A lot begun before this farm day's start is not on the Harvest line, even if it is still in the Dry Queue.
- `Lot n` is the place by the first load of the farm day. A lot that has already been loaded does not take a number from the ones still showing.
- `in progress` wins while anything is still on the scale. `ready to be moved` is a Scheduled lot with nothing left on the scale.
- A load with no Truck # is its own line, named `Truck`.
- The truck clock starts at the earliest Finish load of the parts that are still not in a dry space.
- Freezers are off the Drying line. The Arlington Dry Room is on it.
- With two loads in one space, the line shows the longer clock, and that clock reads paused when the longer load is paused.
- The dots are clipped to the button's width, so the count follows the width.

## Gates

- `npx tsc --noEmit`: exit 0.
- `npx vitest run`: 57 files, 911 tests passed. The same under `TZ=America/New_York`.
- `node --check scripts/smoke.mjs`: exit 0.
- From-zero smoke (`SMOKE_PORT=9160`, `WRANGLER_SEND_METRICS=false`): `About to apply 75 migration(s)`, `SMOKE PASS`, ` 500 ` lines: 0, exit 0. The map showed today's lot in progress, a truck with no number in transit, and a drying space with its clock. Marketplace had no line.
- Dash audit: 0 on the files below (U+2014 and U+2013).
- `METRC_INTEGRATOR_KEY = "` and `METRC_USER_KEY = "` appear in no file under `src`, `test`, `scripts`, or `wrangler.toml`.

## Deploy

Not deployed from this session. Nothing committed. The head is 0075.

## Sealed final check

```
npx tsc --noEmit                      exit 0
npx vitest run                        57 files, 911 tests passed
TZ=America/New_York npx vitest run    57 files, 911 tests passed
node --check scripts/smoke.mjs        exit 0
SMOKE_PORT=9160 WRANGLER_SEND_METRICS=false node scripts/smoke.mjs
                                      About to apply 75 migration(s); SMOKE PASS; " 500 " lines: 0; exit 0

src/db.ts                        177973  314ba5e347720350  tail: }
src/html.ts                      190241  3fe4fa1d2e41c626  tail: }
src/drying.ts                     33962  3ea878a3c727758d  tail: }
src/index.ts                     139218  1fee6cdfc33a603f  tail: export default worker;
src/i18n.ts                      176125  b3da31c46f43b530  tail: }
src/theme.ts                     155796  a0a9ee13e1f0e9c9  tail: }
test/menulines.test.ts             5406  af68ee12b6df9b17  tail: });
scripts/smoke.mjs                597532  6953ec2d8713ab01  tail: });
```
