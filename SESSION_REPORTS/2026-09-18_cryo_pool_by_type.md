# 2026-09-18 The Cryo Pool By Type (canon 0.30.119)

Scribe sitting, built Scribe-direct under G-2, on the LIVE floor of 0.30.117 (worker 7488c91d, migrations 0001-0059, the Silo 1 repair applied). Owner ruling 2026-09-18, verbatim:

"in Cryo weight entry, the total shows "BUD" which is technically true, but this is where the trim packages matter a tiny bit.  I need the totals on the top of the page to be reflective of the package types therein.

So lot ending 011 contains x amount of bud, y amount of wpr, and z amount of shake.  I need those totals broken down on screen as well and the "bud" total changed to just "total"."

His picks at the two forks: the SMALLS and SHAKE containers already trimmed move to the Cryo Queue only (the HBN shows on Available again for a >>; a live run's inputs are untouched); the In side names the category with the trim type beside it.

This slice ships WITH migration 0060. From-zero pin 60; next free migration 0061.

## What was found

The pool's In side read one row, BUD, because only BUD-typed trim containers reached the Cryo Queue: the routing law since the first floor was the package type's Is bud? flag (initialWipStatus(is_bud)), and only BUD carries it. On the live snapshot of the 17th, 26011 had 36 BUD containers (194,385 g) in the Cryo Queue and its run, while 19 SMALLS (140,772 g) and 1 SHAKE (8,055 g) sat in status created, in no queue at all (the extraction pool is TRIM and BIO alone, 0.30.1). The same held for 26014, 26015 and 26018: 59 SMALLS and 3 SHAKE containers across the floor waited nowhere. His BTR law (0.30.88) already named these three as the bud side of trim: BUD, SMALLS as WPR, SHAKE as SHA.

## The law, as built

1. THE CRYO-BOUND TYPES ARE A LIST. The trim package types that go to cryo and the product category each reads as are a value in data (canon L-4): app_config `cryo_type_categories`, seeded `BUD=BUD,SMALLS=WPR,SHAKE=SHA` by migration 0060 in his order, editable in Admin, Lookups, app_config; a blank value falls back to the same three; a pair with no category reads as itself. This list is the routing law for a trim container: a type on it enters the Cryo Queue, every other type stays created (TRIM and BIO for the extraction pool, WASTE as waste). The Is bud? flag stays a lookup column and routes nothing.
2. THE POOL BY TYPE. The pool table at the top of Cryo Weight Entry breaks the In side down by trim type, one row per type in his list order (BUD, then WPR, then SHA), each row naming the category the type reads as with the trim type muted beside it where the two differ (BUD; WPR SMALLS; SHA SHAKE); a type off the list reads as itself. The Total row closes each side, the Remaining row stays last. The Out side is unchanged (by category, as entered).
3. THE EXISTING CONTAINERS. Migration 0060 moves every live trim container of type SMALLS or SHAKE in status created to the Cryo Queue. A live run's inputs are untouched, so an HBN with a scheduled run shows on Available again with its SMALLS and SHAKE for another >> (his pick); on his floor 26011 reads 20 containers / 148,827.00 g in on Available beside its scheduled BUD run of 36 containers / 194,385.00 g.

## What changed

- `migrations/0060_cryo_type_categories.sql` (new): app_config cryo_type_categories; the created SMALLS and SHAKE trim containers to cryo_queue.
- `src/config.ts`: CONFIG_KEYS.cryo_type_categories; CRYO_TYPE_CATEGORIES_DEFAULT; parseCryoTypeCategories; initialWipStatus(typeCode, cryoTypes) replaces initialWipStatus(isBud).
- `src/db.ts`: getCryoTypeCategories; CryoPoolLine gains category_code; listCryoRunPool labels and orders the In lines by the list.
- `src/actions.ts`: createTrimPackages routes by the list (read once per post).
- `src/cryo.ts`: poolTable renders the category with the muted type note (data-pool-category on the cell); the header records the ruling.
- `src/theme.ts`: `.cryo-pool .pool-type-note`.
- Tests: `test/routing.test.ts` (the parser and its default, the routing of BUD, SMALLS, SHAKE to the queue and TRIM, BIO, WASTE to created); `test/cryo.test.ts` (the three In rows with their labels and attributes); `test/metrc.test.ts`, `test/trim.test.ts` (the fixture shape).
- `scripts/smoke.mjs`: pin 60; the SMALLS container lands in the Cryo Queue and WASTE does not; Available reads 2 containers / 55.00 g in; a >> takes both (n=2); the pool reads BUD 50.00 and WPR (SMALLS) 5.00 with Total 55.00 and 55 remaining; the run is unscheduled and the containers return to Available; Admin app_config lists cryo_type_categories.

## Rehearsal on his floor

A local D1 built with the first 59 migrations (a rehearsal toml pointing at a copy of them), the 17th's snapshot loaded (119,169 rows, the METRC mirrors left out) and brought to this morning's floor (the Silo 1 repair's three voids), then migration 0060 applied alone: 59 SMALLS and 3 SHAKE containers moved to cryo_queue (BUD 122 / 634,900 g, SMALLS 59 / 425,312 g, SHAKE 3 / 14,161 g in the queue), TRIM 33 and BIO 10 stayed created. A dev server on the copy: Pasteurization Available read 26018 13 containers / 93,064.00 g in, 26015 38 containers / 227,236.00 g in, 26014 54 containers / 305,235.00 g in, 26011 20 containers / 148,827.00 g in; Scheduled kept the two BUD runs (26011 36 containers / 194,385.00 g in, 26015 23 containers / 105,630.00 g in); a >> on 26011 made a second run (n=20) whose pool read WPR SMALLS 140,772.00 and SHA SHAKE 8,055.00, Total 148,827.00, Remaining 148,827.00; a >> on 26018 read BUD 47,606.00, WPR SMALLS 43,309.00, SHA SHAKE 2,149.00, Total 93,064.00; the pane listed the two 26011 runs apart by their counts; both rehearsal runs were unscheduled. Admin app_config listed the key. The server was killed and the persist directory removed.

## Scribe assumptions (his word owed if wrong)

- The In rows follow the list order (BUD, WPR, SHA) rather than the order the containers were trimmed.
- The category label with the type beside it prints on the In side only; the Out side, the entered list and the New Packages file keep the category alone.
- TRIM and BIO stay the extraction pool and WASTE stays out; no other type is cryo-bound until the list says so.
- On the live floor, the moved SMALLS and SHAKE containers of 26011 and 26015 wait on Available as a second run per HBN (or a < on the BUD run and one >> for the whole HBN), by his pick.

## Gates

- `npx tsc --noEmit`: exit 0.
- `npx vitest run`: 34 files, 697 tests passed; the same under TZ=America/New_York.
- `node --check scripts/smoke.mjs`: ok.
- From-zero smoke (SMOKE_PORT=9023): `About to apply 60 migration(s)`, `SMOKE PASS`, no 500 in the log.
- Visual pass: the 26011 type-pool page from the rehearsal copy in lite and cerberus (WPR SMALLS, SHA SHAKE, Total, Remaining), the Pasteurization station in cerberus; no horizontal scroll at 1280.
- Dash audit: 0 on every file below.

## Deploy (his hands, WITH migration 0060)

```powershell
cd "C:\Users\DennisWallace\Documents\Claude\Projects\gripfactory Practical\app"
npx wrangler d1 execute gripfactory-lite-grip-20260914 --env grip --remote --command "SELECT 1"
npx wrangler d1 migrations apply gripfactory-lite-grip-20260914 --env grip --remote
npm run deploy:grip
```

## Sealed final check

```
npx tsc --noEmit                      exit 0
npx vitest run                        34 files, 697 tests passed
TZ=America/New_York npx vitest run    34 files, 697 tests passed
node --check scripts/smoke.mjs        ok
rm -rf .smoke-persist && SMOKE_PORT=9023 WRANGLER_SEND_METRICS=false timeout 285 npm run smoke
                                      About to apply 60 migration(s); SMOKE PASS

migrations/0060_cryo_type_categories.sql        2142  1d39a3c582434b26
src/config.ts                                  50914  11bfa6ec70074f7d
src/db.ts                                     151721  b797b3cc6173302c
src/actions.ts                                256880  11189332ad6258ab
src/cryo.ts                                    22795  bd5dd3e37761275b
src/theme.ts                                  141080  de17c79153df0199
test/cryo.test.ts                              23363  1e9960f0ab04eb6d
test/routing.test.ts                           37681  54b8b32fa1a0aec2
test/metrc.test.ts                             38834  8f87537cc631dea1
test/trim.test.ts                              14014  63d82b43c3b5c190
scripts/smoke.mjs                             423528  bbf43d1c196ee2ba
dash audit: 0 on every file above
```
