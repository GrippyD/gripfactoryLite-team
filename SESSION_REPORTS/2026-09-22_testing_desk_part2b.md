# 2026-09-22 The testing desk, part 2b (canon 0.30.178 and 0.30.179)

Build session under THE DISPATCH RULE (canon 0.30.155), brief `BRIEFS/2026-09-22_first_time_rate_by_weight.md`. No new migration. From-zero smoke pin stays 68. Not deployed. Lands on part 2. The Scribe gates this report. Part 3 waits.

## The law, as built

The Harvest Console Testing section still reads the harvest year. The day control above it does not change these numbers. Lots ready, lots scheduled, and lots waiting for retest are the same counts as part 2.

1. THE UNIT IS THE PARENT PACKAGE. The package is named by `source_package_tag` when that value is tag-shaped, otherwise by `source_package_code`, otherwise by the lot id. Every full compliance order on that key is one history, in `created_at` order. The sample tag is not shown in this section.
2. THE FIRST FULL PANEL. A parent enters the rate when its earliest `full_compliance` order has a sample with `overall_passed` set. Passed means that panel passed. Failed means it did not, and a later retest or remediation leaves it failed. A potency or R&D order is not a panel. A parent whose earliest full panel has no result yet stays out, including when a later full panel already has a result.
3. THE WEIGHT. The weight is that first order's `batch_grams`. The percent is passed grams over all grams, one decimal.
4. THE FIGURE. Under the percent: pounds at 448 g, two decimals (`66.96 of 89.29 lb`), then the package counts (`1 of 2 packages`). An empty season reads `no results`.
5. BY LAB, THEN FAILURE TYPE. The lab is the first full panel's lab. Under it, each failed `test_results.test_type` on that panel, with the pounds and the package count. A package that fails two types appears under both. Types sort by grams, largest first, then by name.
6. BY STRAIN, THEN FARM. The strain and the farm are the HBN's on that first panel. The same weighted rate.
7. THE LISTS. COAs by parent tag and THC by parent tag stay keyed on the parent tag. Each row shows the attempt beside the date (`attempt 2`). The THC table has a Date column so the attempt has a date to sit beside.
8. THE FIFTY POUNDS IS NOT A GATE. `batchOverLimit`, `batchLimitGrams`, `BATCH_LIMIT_WORDS`, and `BATCH_MAX_POUNDS` are gone. The Schedule action accepts any dry weight above zero and the row shows that weight. The sample size is still 0.5 percent, with the 14 g floor and the lab increment. A 22,534 g batch (50.3 lb) schedules and reads 22,534 g, sample 113 g.

Pasteurization is the remaining stub.

## What changed

- `src/console.ts`: `testingParents` and `testingParentKey`; `testingFigures` takes parent packages; `TestingRate` carries `passedGrams` and `allGrams`; `rateText` renders the percent, the pounds line, and the packages line; `failuresOf` carries grams and count; `loadTestingSection` reads the earliest full compliance order per parent with its `batch_grams`, the sample's `overall_passed`, and that sample's failed types; the tag lists carry `attempt`.
- `src/testing.ts`: the Schedule action and the ready row no longer refuse on weight.
- `src/config.ts`: `BATCH_MAX_POUNDS` removed. It existed only to feed that refusal.
- `src/i18n.ts`: the over-50-lb refusal string is gone (EN and ES). Added `{passed} of {all} lb`, `{passed} of {all} packages`, and `attempt {n}` (EN and ES).
- `test/testing.test.ts`, `scripts/smoke.mjs`.

On the smoke database the Testing section read 0.0%, 0.00 of 1.68 lb, 0 of 1 packages, under SC Labs Michigan as Microbials 1.68 lb, under Fruity Pebbles at ARL. The lists showed attempt 1 and attempt 2 beside 2026-09-22, on parent package 26011, with the COA link and THC 20.1. The sample tags were absent. The desk offered Schedule on that 752 g lot and did not mention a 50 lb limit.

## Assumptions for the owner's word

- Two orders that share a parent key are one package, including when they sit on different lots.
- Earliest means `created_at`, then the order id when the times match.
- When the first full compliance order has more than one sample, the earliest sample that has `overall_passed` is the result. The desk writes one sample per order.
- Pounds are each gram sum converted at 448 and rounded on its own. 30,000 g passed and 10,000 g failed reads 75.0%, 66.96 of 89.29 lb, 1 of 2 packages.
- Failure types of equal weight sort by the stored type name (microbials before pesticides).
- The COA and THC lists still include every resulted sample of the season, including later attempts and potency or R&D orders. The rate does not. The attempt is the sample's attempt number.
- The three lot counts are unchanged from part 2.

## Owner section (for the Scribe to hand)

Part 2b adds no secret, no migration, and no Metrc call. Migration 0068 is already on the grip database, so the deploy is worker only when the Scribe hands the block. The part 1 hand still stands: the CRA license check, the May 2026 guide, the lab tech on the Admin PIN, and the Metrc Connect gate before any key. Say deploy when you want this on the grip worker. Part 3 waits for another continue.

## Gates

- `npx tsc --noEmit`: exit 0.
- `npx vitest run`: 45 files, 800 tests passed. The same under `TZ=America/New_York`.
- `node --check scripts/smoke.mjs`: exit 0.
- From-zero smoke (`SMOKE_PORT=9132`, `WRANGLER_SEND_METRICS=false`): `About to apply 68 migration(s)`, `SMOKE PASS`, ` 500 ` lines: 0, exit 0.
- Dash audit: 0 on every file below (U+2014 and U+2013).
- `METRC_INTEGRATOR_KEY` and `METRC_USER_KEY` appear in no file under `src`, `test`, `scripts`, or `wrangler.toml`. `453.59` remains the one METRC comment in `src/config.ts`.

## Deploy

Not deployed from this session. The Scribe gates the report. Part 3 waits for another continue.

## Sealed final check

```
npx tsc --noEmit                      exit 0
npx vitest run                        45 files, 800 tests passed
TZ=America/New_York npx vitest run    45 files, 800 tests passed
node --check scripts/smoke.mjs        exit 0
Remove-Item .smoke-persist; SMOKE_PORT=9132 WRANGLER_SEND_METRICS=false npm run smoke
                                      About to apply 68 migration(s); SMOKE PASS; " 500 " lines: 0; exit 0

app/src/console.ts                       90998  b57d67cbf0243038  tail: }
app/src/config.ts                        60279  b5887192947dbf55  tail: }
app/src/testing.ts                       63396  160c8cfa2f2f2bd6  tail: }
app/src/i18n.ts                         148752  a2093ae49b02dab6  tail: }
app/test/testing.test.ts                 12937  b979b15d32eec2ae  tail: });
app/scripts/smoke.mjs                   529634  dc0e34fd6cf08870  tail: });
```
