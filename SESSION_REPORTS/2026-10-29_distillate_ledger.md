# 2026-10-29 LD1: the distillate ledger: SEALED

BRIEF LD1 `BRIEFS/2026-10-12_distillate_ledger.md`, canon 0.30.561. Branch `ld1-distillate-ledger`, cut from `GFLiteOpsDashboard` at `23944d2ee62d33e0f0412d84a0caf1ed427d11e6`. That commit is `main` and `GFLiteOpsDashboard`. Received app tree `0dc10dd8baba39fa` (440 files, migration head `0123_field_more_trucks.sql`, 122 migration files). Left app tree `f0338535d33a5141` (443 files, 123 migration files, head `0124_distillate_ledger.sql`). Nothing deployed. `main` was not pushed. No remote D1 command was run.

## Hard stops

All five passed before the first edit: `GFLiteOpsDashboard` equals `main` at `23944d2`; the app tree hash was `0dc10dd8baba39fa`; the migration head was `0123`; no `0124` file existed; no `processors` table existed.

## The reading of the brief

Zoho liters are the on-hand figure. The report reads mounted `listings` rows (`source` zoho, not deleted, item name containing distillate). A UOM of L counts as liters. Any other UOM is listed and flagged "UOM is not L" and is not converted. A four-digit 20xx year in the item name is the harvest year. A name with no year is "Year unknown" and flagged. The as-of date filters movements and counts. It does not rewind the Zoho mount.

The same brief's unit list and smoke post a shipped movement and compute finished minus shipped plus adjust. This build keeps those three kinds. The check is finished grams greater than 0, shipped grams greater than 0, or adjust grams not 0. The report shows Zoho liters, then the ledger (finished minus shipped plus adjust) and the variance (count minus ledger as of the count date). A variance whose absolute value is greater than 1,000 g is flagged "Over 1 L". Exactly 1,000 g is not flagged.

Law 0 also says the movement table would keep only kind finished. That sentence and the tests in the same brief do not say the same thing. The tests and the smoke are what this build follows, and this paragraph is the record of that reading.

BowHouse yield is a blank cell (`data-bowhouse-yield=""`). `bowHouseYieldLitersPerPound` returns null. T1 records no returned liters, and no source was invented.

A METRC column is drawn only when a live package has distillate in the item or category and a UOM of L or g (grams divided by 1,000). An empty result leaves the column out. The mirror note that snapshot UOMs are g and ea still stands.

Opening balances are not loaded. No row was written beyond the six processor seeds.

## What was built

Migration `0124_distillate_ledger.sql` creates `processors` (unique index on `name`) and inserts six rows in one statement: BowHouse `proc-bowhouse`, Mitten `proc-mitten`, Sauce `proc-sauce`, Cannalicious `proc-cannalicious`, Oakcanna `proc-oakcanna`, Golden Lion `proc-golden-lion`. Each is active, with `created_at` and `updated_at` `2026-10-28T00:00:00.000Z`. Then `distillate_movements` and `distillate_counts`, with the two indexes from the brief. A count may name no processor (a house count). Grams are stored whole. Liters are grams over 1,000, shown to two decimals, round half up.

`/admin/lookups/processors` is on the Lookups landing. English and Spanish. The standing admin PIN gates it. Add, rename, mark inactive, and soft delete each take a reason and land in `record_change_log`. Nothing is hard deleted. A second name that matches an existing name ignoring case is refused, including a soft-deleted name.

`/ops/distillate` sits on Production Operations after Inventory. The PIN gates that page. The operations group page stays open, as the smoke already requires. The picker lists active processors that are not deleted. A movement or a count stores liters times 1,000, rounded to the gram. Zero liters, a non-numeric liter value, a future date, a bad year, and an adjust with no note are refused. A void sets `voided_at` and writes one log row. "From toll lot" stores the reference `toll lot` plus the lot's HBN. It does not write to T1's tables.

`/reports/distillate_on_hand` is a report card with CSV. Filters are harvest year (blank is all years) and as of (default farm today). House counts compare to the Zoho year total. Processor variance uses the ledger as of the count date. The ledger column itself is movements on or before the report as-of date. The page lists the latest 20 movements and the latest 20 counts.

## Files

| file | bytes | sha256 (16) |
|---|---|---|
| `app/migrations/0124_distillate_ledger.sql` | 2314 | `fe390d27b1ccdf1e` |
| `app/src/distillate.ts` | 47585 | `458e82728136d3f9` |
| `app/src/lookups.ts` | 12414 | `39b8619eda378cb2` |
| `app/src/index.ts` | 210957 | `aa2c56ca407356d1` |
| `app/src/reports.ts` | 37365 | `ec19b90e4c5410af` |
| `app/src/pipeline.ts` | 52847 | `aae3ad218f37df84` |
| `app/src/html.ts` | 200225 | `6d8e6e41944bbba8` |
| `app/src/i18n.ts` | 408019 | `5ddff7389ce6f417` |
| `app/scripts/smoke.mjs` | 987919 | `5ea7ae6c22812d61` |
| `app/test/distillateledger.test.ts` | 16320 | `d00772f7319a5a51` |
| `app/test/surface.test.ts` | 81967 | `195a506afb6b735d` |
| `app/test/console.test.ts` | 98972 | `1fc856ab563bfd4d` |
| `app/test/fieldestimates.test.ts` | 18477 | `26611aaef7731f98` |

`worker-configuration.d.ts` was generated for typecheck. It is gitignored and not part of this slice.

## Sealed final check

```
./node_modules/.bin/tsc --noEmit
(no output)
TSC_EXIT:0

TZ=UTC ./node_modules/.bin/vitest run
 Test Files  128 passed (128)
      Tests  1759 passed | 6 skipped (1765)
   Start at  01:50:12
   Duration  42.90s (transform 7.81s, setup 0ms, import 38.55s, tests 71.84s, environment 22ms)
exit 0

TZ=America/New_York ./node_modules/.bin/vitest run
 Test Files  128 passed (128)
      Tests  1759 passed | 6 skipped (1765)
   Start at  21:50:12
   Duration  43.03s (transform 7.83s, setup 0ms, import 37.75s, tests 73.18s, environment 24ms)
exit 0

node --check scripts/smoke.mjs
CHECK_EXIT:0

CI=1 SMOKE_PORT=8799 WRANGLER_SEND_METRICS=false node scripts/smoke.mjs
? About to apply 123 migration(s)
[wrangler:info] GET /admin/lookups/processors 200 OK (12ms)
[wrangler:info] GET /admin/lookups/processors 200 OK (10ms)
SMOKE PASS
EXIT:0
" 500 " lines: 0

dash audit (U+2014 and U+2013) on the thirteen files: none
CR audit on the thirteen files: none
```

```
app/migrations/0124_distillate_ledger.sql  2314  fe390d27b1ccdf1e
TAIL   ON distillate_counts (harvest_year, counted_on);
app/src/distillate.ts  47585  458e82728136d3f9
TAIL export { rowsAsOf };
app/src/lookups.ts  12414  39b8619eda378cb2
TAIL };
app/src/index.ts  210957  aa2c56ca407356d1
TAIL export default worker;
app/src/reports.ts  37365  ec19b90e4c5410af
TAIL }
app/src/pipeline.ts  52847  aae3ad218f37df84
TAIL }
app/src/html.ts  200225  6d8e6e41944bbba8
TAIL }
app/src/i18n.ts  408019  5ddff7389ce6f417
TAIL }
app/scripts/smoke.mjs  987919  5ea7ae6c22812d61
TAIL });
app/test/distillateledger.test.ts  16320  d00772f7319a5a51
TAIL });
app/test/surface.test.ts  81967  195a506afb6b735d
TAIL });
app/test/console.test.ts  98972  1fc856ab563bfd4d
TAIL });
app/test/fieldestimates.test.ts  18477  26611aaef7731f98
TAIL });
```

## After this slice

Opening balances stay a later repair. This session did not deploy.
