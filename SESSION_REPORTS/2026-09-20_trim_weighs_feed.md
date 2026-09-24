# 2026-09-20 The Trim Weighs Feed (canon 0.30.137)

Scribe sitting, built Scribe-direct under G-2, on the LIVE floor of 0.30.133 (worker b3f4d3e6, migrations 0001-0062) with THE RECONCILE LEDGER LOCATION (0.30.135, migration 0063) pending at his hands. A request from Corey's agent, relayed by the owner 2026-09-20, verbatim:

"Another Corey request:

I want the trim room scale weights flowing into TRIMATRON automatically instead of through the workbook. Two things from GripFactory Lite:

1. A machine route for the station data behind /station/trim_packages: the JSON the page reads (per package: tag, stream, weight in grams, timestamp, operator), or a read of the table it writes.
2. A Cloudflare Access service token for that route so a Field Ops poller can read it without a login, or an Access bypass on just that route.

The poller reads every few minutes, stores each weigh by its row id, and the phones fill their package totals from it. Nothing writes back to your side."

His pick on the question tool: "Second token" (a service token trimatron-poller with its own Service Auth policy on the gripfactory-lite application, like silo-ops-cron; no bypass). Worker-only; no migration; rides the pending three-step block with 0063. From-zero pin stays 63; next free migration 0064.

## The law, as built

### THE TRIM WEIGHS FEED (0.30.137)

1. THE ROUTE: GET /feeds/trim-weighs.json, read-only JSON, no-store, outside the Admin PIN (the /api tree sits behind the PIN for the SalesHelper's send, and a poller carries no cookie; Cloudflare Access alone fronts it). A bad query answers 400 in words as JSON.
2. THE ROWS: one per trim package (the wip_packages the Trim Packages Entry station writes; cryo outputs are not trim weighs), in the order they changed, each with id (the poller's key), package_code (the internal code), metrc_tag (a METRC tag when the ledger holds a tag-shaped one, else null; an off-shape code kept as typed stays in package_code), stream (the package type code), weight_grams (two decimals), trim_date, operator (the typed trim operator), status, lot {id, hbn, short_id, strain, farm (the HBN's farm)}, created_at, updated_at, changed_at (the void when it came after the last edit, else the last edit) and voided_at (null while live).
3. THE POLL: ?since=<ISO instant> returns the rows whose change instant is after it (a new weigh, a reasoned edit, a void all move a row forward); ?limit= 1 to 2000, 500 by default; ?live=1 leaves voided rows out. The envelope carries feed, generated_at, since, count, next_since (the last row's change instant, or the since given when nothing came back) and more (true when the limit cut the page).
4. THE DOOR: a second service token, trimatron-poller, with its own Service Auth policy on the gripfactory-lite application; the poller sends CF-Access-Client-Id and CF-Access-Client-Secret on every request. No bypass: the weighs, tags and operator names never stand on the open internet. The token's value never enters the repo or the canon.

## What changed

- `src/feeds.ts` (new): TRIM_WEIGHS_PATH, parseTrimWeighsQuery, listTrimWeighs, feedTagOf, trimWeighOf, trimWeighsFeed.
- `src/index.ts`: the GET route with its JSON refusals.
- Tests: `test/feeds.test.ts` (new): the query parsing and its refusals; the SQL (trim source alone, the change-instant clause, the live clause, the ledger-tag join, the order and the cap, the binds); the envelope and row shape (the off-shape code as no tag, the void's change instant, next_since and more, the empty page).
- `scripts/smoke.mjs`: after the trim entry: the three smoke packages on the feed keyed by the station's row ids with stream, grams, operator, date and lot; the voided plus row with its voided_at as its change instant; live=1 leaving it out; since= narrowing by the change instant; limit=1 cutting with more and next_since; a bad since and a bad limit answering 400 in words as JSON; the content type and no-store.

## Scribe assumptions (his word owed if wrong)

- The operator (the typed trim operator name) rides the feed; the requester asked for it and Corey's system is internal. Say the word and it leaves the feed.
- The feed reads /feeds, not /api, so the poller needs no PIN; the /api tree stays behind the PIN as before.
- A request under the poller's token acts as dev@local in the worker (his standing pick, 0.30.136); the feed is read-only, so nothing turns on it, but the same token opens every other route of the application until a read-only service actor is ruled.
- Cryo outputs never ride this feed; a cryo feed, if wanted, is its own route.

## Gates

- `npx tsc --noEmit`: exit 0.
- `npx vitest run`: 40 files, 741 tests passed; the same under TZ=America/New_York.
- `node --check scripts/smoke.mjs`: ok.
- From-zero smoke (SMOKE_PORT=9054): `About to apply 63 migration(s)`, `SMOKE PASS`, no 500 in the log.
- Dash audit: 0 on every file below.

## Deploy (his hands; the pending 0063 rides, so the three-step block)

```powershell
cd "C:\Users\DennisWallace\Documents\Claude\Projects\gripfactory Practical\app"
npx wrangler d1 execute gripfactory-lite-grip-20260914 --env grip --remote --command "SELECT 1"
npx wrangler d1 migrations apply gripfactory-lite-grip-20260914 --env grip --remote
npm run deploy:grip
```

## Sealed final check

```
npx tsc --noEmit                      exit 0
npx vitest run                        40 files, 741 tests passed
TZ=America/New_York npx vitest run    40 files, 741 tests passed
node --check scripts/smoke.mjs        ok
rm -rf .smoke-persist && SMOKE_PORT=9054 WRANGLER_SEND_METRICS=false timeout 285 npm run smoke
                                      About to apply 63 migration(s); SMOKE PASS

src/feeds.ts                 7536  f6f74987ec879873
src/index.ts               116636  dda81d9b60b42cd4
test/feeds.test.ts           6174  0d9d919fcc56fe41
scripts/smoke.mjs          482657  c64a9f91f2c88ffc
dash audit: 0 on every file above
```
