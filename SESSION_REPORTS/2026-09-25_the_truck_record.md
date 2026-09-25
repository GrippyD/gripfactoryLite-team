# 2026-09-25 The truck record

Brief M, canon 0.30.226, part one only. The truck record. Migration 0075 is the new head. The next free number is 0076. Part two, the drying schedule, was not started. Not deployed. Nothing committed.

## What landed

`wet_weights.harvest_batch_id` is nullable. Null still means the lot's own HBN. No backfill. The index is `wet_weights_harvest_batch`.

Truck # is free text on the wet-weight header (`name="truck_number"`), optional. The box is filled with one past the highest positive integer already on this farm's lots of the same farm day (`effective_date`, else the created day in farm time). The crew may overtype it or blank it. A blank lot goes straight to its space. Move To stays a silo or a hang room. The truck sentinel and `truck-<n>` still refuse. THE FOUR START TAPS matches the Truck # with the rest of the header. Lots in progress, the lot panel, Load Silo, and the Dry Space Queue read `Truck <n> - <hbn>` when the lot has a truck number. A lot without one still reads by its space.

Every tote has an HBN select beside the grams. The list is the header farm's open app-born batches: recalled, complete, and METRC-born stay off it. The header HBN is first and selected until another tote names a different one. The newest live tote's HBN stays selected. A posted id that is not on that list refuses. The lot total is still every tote. A tote whose HBN is not the header shows its serial after the grams, with the whole HBN in the title. When more than one HBN rides the lot, the panel reads `HBNs on this lot: 26041 12 totes 1,234 g · 26042 3 totes 310 g`. The tote pencil can change `harvest_batch_id` on the same list, with a reason, and refuses once the lot is not weighing. The lot pencil's HBN move still moves the header, and it also moves every tote that carries no explicit HBN or the old header HBN.

The wet pane hides a batch only when it has no weighing lot and every finished lot finished before the farm's today. An HBN finished today stays for its next truck.

Finish lot, when the live totes name more than one HBN, keeps the header HBN and its totes (including totes with no explicit HBN) and writes one new lot per other HBN. Each new lot copies the header's space, farm day, truck number, form, start time, leads, and notes, takes its totes (one log row each under `truck split`), and finishes to drying with its own package. The finish form asks plant count and METRC tag per HBN (`plant_count[<id>]`, `metrc_tag[<id>]`). One HBN keeps today's single boxes. The package code is the short lot id, plus `-T<n>` when the lot has a truck number. The flash is `Finished Truck 3: 26041 2 totes 1,234 g; 26042 1 totes 310 g.` in English and Spanish. A truck whose totes all carry the header HBN finishes as one lot, with the `-T` suffix when it has a truck number. Harvest CSV, unload, trim, cryo, testing, and reports still read ordinary lots.

## Assumptions for your word

- The tote HBN list is the header farm's open batches only. Another farm's open HBN is refused.
- The split happens at Finish lot. Until then the totes share one weighing lot.
- `-T<n>` is on the package code whenever the lot's Truck # is not blank, including a single-HBN truck. A lot with no Truck # keeps today's code.
- The pane uses the farm day. A batch finished yesterday stays hidden unless a weighing lot is still on it. A batch finished today stays, including after unload.
- The tote pencil refuses once the lot has left weighing.
- The next Truck # ignores a non-integer and counts only this farm's lots of this farm day.
- Plant count and tag on a split are per HBN. Skip, or a blank box, still leaves the count empty and Load Silo asks again.

## Gates

- `npx tsc --noEmit`: exit 0.
- `npx vitest run`: 53 files, 875 tests passed. The same under `TZ=America/New_York`.
- `node --check scripts/smoke.mjs`: exit 0.
- From-zero smoke (`SMOKE_PORT=9160`, `WRANGLER_SEND_METRICS=false`): `About to apply 75 migration(s)`, `SMOKE PASS`, ` 500 ` lines: 0, exit 0. A truck at ARL with two HBNs' totes finished into two lots labeled `Truck 1 - <hbn>` on Load Silo, and each loaded into a different silo.
- Dash audit: 0 on the files below (U+2014 and U+2013).
- `METRC_INTEGRATOR_KEY = "` and `METRC_USER_KEY = "` appear in no file under `src`, `test`, `scripts`, or `wrangler.toml`.

## Deploy

Not deployed from this session. Nothing committed. The head is 0075. Part two waits until the Scribe says part one is gated.

## Sealed final check

```
npx tsc --noEmit                      exit 0
npx vitest run                        53 files, 875 tests passed
TZ=America/New_York npx vitest run    53 files, 875 tests passed
node --check scripts/smoke.mjs        exit 0
SMOKE_PORT=9160 WRANGLER_SEND_METRICS=false node scripts/smoke.mjs
                                      About to apply 75 migration(s); SMOKE PASS; " 500 " lines: 0; exit 0

migrations/0075_tote_hbn.sql        293  9b2fa0f69d0ccada  tail: CREATE INDEX wet_weights_harvest_batch ON wet_weights (harvest_batch_id);
src/config.ts                     66934  92418ed9a05e9c36  tail: }
src/ledger.ts                      8880  fd046e193321eb7e  tail: export { ITEM_KIND_SPR, ITEM_KIND_WIP, LICENSE_AU_GROW, LOC_BARN, LOC_CSB, LOC_IN_TRANSIT };
src/db.ts                        166366  4559d2d2d32787cc  tail: }
src/drying.ts                     20659  4984d71c72d6c26b  tail: }
src/actions.ts                   321688  9066a96cf97142c3  tail: export { MANIFEST_COLUMNS, buckedPackageCode };
src/pipeline.ts                   50230  e52d2d092230bc32  tail: }
src/html.ts                      189980  d8d21abdd4ad0ba0  tail: }
src/index.ts                     136544  a72e1d14fed959b2  tail: export default worker;
src/i18n.ts                      166327  77f9ed7a89968ac8  tail: }
test/start_taps.test.ts            9350  8f7d74482d79bddb  tail: });
test/hbn_pencil.test.ts            7877  52ed9218bbfb0964  tail: });
test/truck.test.ts                14287  de1879daf028f39c  tail: });
test/surface.test.ts              80249  eb9b61e4a00632da  tail: });
scripts/smoke.mjs                578637  79c75f3be9c55a20  tail: });
```
