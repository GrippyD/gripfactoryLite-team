# 2026-09-22 The testing desk, part 3 (canon 0.30.164)

Build session under THE DISPATCH RULE (canon 0.30.155), brief `BRIEFS/2026-09-21_testing_desk.md`, part 3 only. Migration 0069. From-zero smoke pin is 69. Not deployed. The Scribe gates this report.

## The law, as built

The Metrc mirror is read-only and dark until both keys exist.

1. THE CLIENT. `src/metrcapi.ts` calls Metrc with Basic auth. The integrator key and the user key are wrangler secrets (`METRC_INTEGRATOR_KEY`, `METRC_USER_KEY`). They are not vars, and they are not written into a file, a log row, or the Admin page. The base is the var `METRC_API_BASE`. The default env and env.grip both point at `https://sandbox-api-mi.metrc.com`. A blank or non-https value falls back to that sandbox. Production is the owner's edit of the grip var. Page size is 20. A 429 is counted, then retried once after Retry-After (seconds, capped at 10; a date waits 1 second). Every call lands in `metrc_api_calls` (started_at, path, status, ms).
2. THE SWEEP. The existing hourly cron runs the sheet sync and this sweep. With either key absent it records a skipped sweep and makes no call. With both keys it reads each house facility license (lookup licenses other than `SC-` and `AU-SC-`), `GET /packages/v2/labsamples` and `GET /packages/v2/active` for the last hour plus five minutes, then `GET /labtests/v2/results` for a changed package whose label is a sample tag this desk already holds. It fills mirror columns the desk left blank: lab testing state, state date, result id, COA file id, overall pass, and THC. A stored value stays. Each fill is a change-log row, actor null, reason `metrc mirror`. The COA file itself is not fetched.
3. THE WRITE SWITCH. `METRC_WRITE_ENABLED` is false. `testingPackagePayload` shapes `POST /packages/v2/testing` (Tag, Item, UseSameItem true, Quantity, Grams, ActualDate, Ingredients with the source tag and grams, RequiredLabTestBatches). `testingPostRequest` returns null. Nothing POSTs.
4. THE PAGE. Admin gains [Metrc API] at `/admin/metrc-api`, behind the Admin PIN. It shows each key as present or absent, the base host, the calls this month, the last sweep, and the off switch. Test connection calls `GET /facilities/v2` and answers in words. Absent keys answer in words and make no call.

## What changed

- `migrations/0069_metrc_mirror.sql`: `metrc_api_calls`, `metrc_sweeps`. The mirror columns already exist on `test_orders` and `test_samples` from 0068.
- `src/metrcapi.ts`, `src/index.ts` (the page, Test connection, the cron), `src/config.ts` (the path and the log reason), `src/html.ts` (the tile), `src/i18n.ts`, `wrangler.toml` (the sandbox base on the default env and env.grip).
- `test/metrcapi.test.ts`, `scripts/smoke.mjs` (pin 69; the tile; keys absent; sandbox host; skipped sweep; zero calls; Test connection says the key is absent).

On the smoke database the page read both keys absent, base sandbox-api-mi.metrc.com, 0 calls this month, a skipped sweep, and the write switch off. Test connection said the keys are absent and the call count stayed 0.

## The testing post, not sent

```
POST /packages/v2/testing?licenseNumber=<license>
[{
  Tag, Item, UseSameItem: true, Quantity, UnitOfMeasure: "Grams", ActualDate,
  Ingredients: [{ Package: <source tag>, Quantity, UnitOfMeasure: "Grams" }],
  RequiredLabTestBatches: ["Raw Plant Material"]
}]
```

The switch in `src/metrcapi.ts` is `METRC_WRITE_ENABLED = false`.

## Assumptions for the owner's word

- A skipped run is a `metrc_sweeps` row. It makes no API call, so the call table alone cannot show it.
- The sweep fills a column only when that column is blank. A later Metrc value does not replace a state, a THC, or a pass the desk or an earlier sweep already stored.
- Results are read only for a package label that matches a local sample tag. An active parent package updates the order's state columns and does not spend a results call.
- Facility licenses are the lookup licenses that do not start with `SC-` or `AU-SC-`.
- THC prefers a result type whose name contains both "thc" and "total". Otherwise the first THC level. A THC the desk already typed stays.
- Retry-After is read as seconds and capped at 10. One retry. An unparseable header waits 1 second.
- Each endpoint stops after 20 pages.
- The COA document endpoint stays for a later fork. This slice stores the file id only.
- env.grip's base is the sandbox until you replace that one var.

## Owner section (for the Scribe to hand)

Part 3 adds migration 0069 and no secret in the repo. The keys, when they exist, are:

```
cd "C:\Users\DennisWallace\Documents\Claude\Projects\gripfactory Practical\app"
npx wrangler secret put METRC_INTEGRATOR_KEY --env grip
npx wrangler secret put METRC_USER_KEY --env grip
```

The Metrc Connect gate still stands: the webinar, the test, the certificate, then those secrets, sandbox first. The CRA license check and the May 2026 guide still stand. 0068 is already on the grip database, so the deploy is the three-step block and 0069 rides. Not deployed from this session.

## Gates

- `npx tsc --noEmit`: exit 0.
- `npx vitest run`: 46 files, 809 tests passed. The same under `TZ=America/New_York`.
- `node --check scripts/smoke.mjs`: exit 0.
- From-zero smoke (`SMOKE_PORT=9136`, `WRANGLER_SEND_METRICS=false`): `About to apply 69 migration(s)`, `SMOKE PASS`, ` 500 ` lines: 0, exit 0.
- Dash audit: 0 on every file below (U+2014 and U+2013).
- `METRC_INTEGRATOR_KEY = "` and `METRC_USER_KEY = "` appear in no file under `src`, `test`, `scripts`, or `wrangler.toml`. `453.59` remains the one METRC comment in `src/config.ts`.

## Deploy

Not deployed from this session. The Scribe gates the report and hands the block.

## Sealed final check

```
npx tsc --noEmit                      exit 0
npx vitest run                        46 files, 809 tests passed
TZ=America/New_York npx vitest run    46 files, 809 tests passed
node --check scripts/smoke.mjs        exit 0
Remove-Item .smoke-persist; SMOKE_PORT=9136 WRANGLER_SEND_METRICS=false npm run smoke
                                      About to apply 69 migration(s); SMOKE PASS; " 500 " lines: 0; exit 0

app/migrations/0069_metrc_mirror.sql       876  28571968cc3b1fb5  tail: CREATE INDEX metrc_sweeps_started_at ON metrc_sweeps (started_at);
app/src/metrcapi.ts                      25366  ce55b905b181bd4e  tail: }
app/src/index.ts                        127313  2907ee82d8bd7b15  tail: export default worker;
app/src/config.ts                        60528  f17c565474496916  tail: }
app/src/html.ts                         177112  c67ef11f5436df0e  tail: }
app/src/i18n.ts                         150595  d305baf6d6ec7675  tail: }
app/test/metrcapi.test.ts                 5810  aede7c67ced5b53a  tail: });
app/scripts/smoke.mjs                   533995  98f22b63693b9b16  tail: });
app/wrangler.toml                         2715  d8b173eed0cc9b72  tail: migrations_dir = "migrations"
```
