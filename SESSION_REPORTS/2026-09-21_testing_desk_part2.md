# 2026-09-21 The testing desk, part 2 (canon 0.30.164, brief C)

Build session under THE DISPATCH RULE (canon 0.30.155), brief `BRIEFS/2026-09-21_testing_desk.md`, part 2 only. No new migration. From-zero smoke pin stays 68. Not deployed. Lands on part 1. The Scribe gates this report. Part 3 (the Metrc mirror) waits.

## The law, as built

The Harvest Console's Testing section is no longer a stub. It reads the harvest year. The day control above it does not change these numbers.

1. LOTS READY. Trimmed lots of this harvest year with no open test order. The same ready rule as the desk.
2. LOTS SCHEDULED. Distinct lots with an order in `scheduled`, `sampled`, `in_transit`, or `at_lab`.
3. FIRST TIME PASS RATE. Attempt 1 samples that have a result: passed over all, one decimal, with the counts under the percent (`0 of 1`). By lab, and under each lab the failed test types of those first attempts. By strain, and under each strain by the HBN's farm. A later attempt does not enter this rate.
4. LOTS WAITING FOR RETEST. Distinct lots with a `failed` or `remediated` order that has no later order on that lot.
5. COAS BY PARENT TAG. Every sample in the season that has results, newest first: the source package tag (or the package code, with "no METRC tag yet"), the lot serial, the lab, the date, the COA link. A row with no link says no COA.
6. THC BY PARENT TAG. The same rows, with `thc_total_pct`. The THC heading sorts the table ascending or descending. A blank THC stays last. The COA list stays newest first.

Pasteurization is the remaining stub.

## What changed

- `src/console.ts`: `testingFigures`, `testingSection`, `loadTestingSection`. The section replaces the Testing stub.
- `src/index.ts`: `/harvest` loads the section for the console's harvest year and reads `?thc=asc` or `?thc=desc`.
- `src/config.ts`: `TEST_CONSOLE_SCHEDULED`.
- `src/i18n.ts`, `src/theme.ts`.
- `test/console.test.ts`, `test/testing.test.ts`.
- `scripts/smoke.mjs`: after the desk walk, the console shows 1 lot ready, 0 scheduled, 0 waiting, first-time rate 0.0% (0 of 1) under SC Labs Michigan as microbials and under Fruity Pebbles / ARL, the COA link, THC 20.1. A picked day leaves those numbers. THC sort sets `asc` and `desc`.

## Assumptions for the owner's word

- "Lots" in the three counts are distinct lots, not orders.
- A retest order in status `retest_scheduled` is not one of the four scheduled statuses. Once that later order exists, the failed or remediated order is not waiting.
- Waiting compares `created_at`. A later order is one created after this one on the same lot.
- The first-time rate uses `overall_passed` on attempt 1. A sample with no result yet is not in the rate. An empty season reads "no results", not 0%.
- A first attempt that fails two test types counts once in the rate and once under each failed type.
- The COA list and the THC list include every resulted sample in the season, including later attempts. The pass rate does not.
- Percentages are one decimal (`50.0%`). THC is shown to the hundredth, trailing zeros dropped by ordinary rounding (`20.1`).
- The parent tag is the order's source package tag when it is tag-shaped. Otherwise the row shows the package code and "no METRC tag yet".

## Owner section (for the Scribe to hand)

Part 2 adds no secret, no migration, and no Metrc call. The part 1 hand still stands: the CRA license check, the May 2026 guide, the lab tech on the Admin PIN, and the Metrc Connect gate before any key. If migration 0068 is not on the grip database yet, the deploy is still the three-step block from part 1, and this code rides with it. If 0068 is already applied, this part is a code deploy.

## Gates

- `npx tsc --noEmit`: exit 0.
- `npx vitest run`: 45 files, 798 tests passed. The same under `TZ=America/New_York`.
- `node --check scripts/smoke.mjs`: exit 0.
- From-zero smoke (`SMOKE_PORT=9126`, `WRANGLER_SEND_METRICS=false`): `About to apply 68 migration(s)`, `SMOKE PASS`, ` 500 ` lines: 0, exit 0.
- Dash audit: 0 on every file below (U+2014 and U+2013).

## Deploy

Not deployed from this session. The Scribe gates the report. Part 3 waits for another continue.

## Sealed final check

```
npx tsc --noEmit                      exit 0
npx vitest run                        45 files, 798 tests passed
TZ=America/New_York npx vitest run    45 files, 798 tests passed
node --check scripts/smoke.mjs        exit 0
rm -rf .smoke-persist && SMOKE_PORT=9126 WRANGLER_SEND_METRICS=false npm run smoke
                                      About to apply 68 migration(s); SMOKE PASS; " 500 " lines: 0; exit 0

app/src/console.ts                       85867  cd29cb67c31b1b52
app/src/config.ts                        60315  1bfd8e9473ab35a7
app/src/index.ts                        126032  6b5f7210206ce55a
app/src/i18n.ts                         148854  c169df01c7dcfab1
app/src/theme.ts                        152654  77843703a1eb51ad
app/test/console.test.ts                 46975  a46ff76bcdefac2d
app/test/testing.test.ts                  8765  4b4374f20e8dcaa9
app/scripts/smoke.mjs                   528724  b2e866e8ad840b63
```
