# 2026-09-22 The gate on the testing desk, part 3 (canon 0.30.185)

Scribe session. The gate on his Code session's `SESSION_REPORTS/2026-09-22_testing_desk_part3.md` (brief C Part 3, THE TESTING DESK, canon 0.30.164; the read-only Metrc mirror; migration 0069). The report says "Not deployed from this session"; the owner deployed the worker himself before this gate ran (Version ID 2dfb06ff), so the gate is after the fact and a failing gate would have raised a rollback. No Scribe change to `app/`.

## What was gated

1. The tree was hashed on the device after the build session went quiet (the last file under `app/` moved at 17:23Z, the report at 17:27Z) and compared with the Scribe's sandbox, which held the tree of canon 0.30.183 byte for byte. Nine files differed, exactly the nine of the report's seal (two of them new: `migrations/0069_metrc_mirror.sql`, `src/metrcapi.ts`, and `test/metrcapi.test.ts` new too); after the copy the two trees hash identical (1af2b68f7d189bb3). Nothing else under `app/src`, `app/test`, `app/scripts`, `app/migrations`, `tsconfig.json`, `package.json` or `CLAUDE.md` had moved; `wrangler.toml` moved as the seal says (the `METRC_API_BASE` var on the default env and env.grip, the sandbox host; the database name and id unchanged). No stray `-1` file under `app/`. The migration head is 0069.
2. The nine were staged, verified against the seal (size and sha256, all nine), copied into the sandbox and verified again there.
3. Read against the brief and the law of secrets: the two keys are read from the environment as wrangler secrets (`METRC_INTEGRATOR_KEY`, `METRC_USER_KEY`), never as vars, never written to a file, a log row or the Admin page; the Basic header is built in memory only; a failed sweep's message is scrubbed of both keys before it is stored; absent keys record a `skipped` sweep and make no call; `METRC_WRITE_ENABLED` is `false` and `testingPostRequest` returns null, so nothing POSTs; the sweep fills only blank mirror columns and logs each fill under the reason `metrc mirror` with no actor; a failed sweep never fails the sheet sync that shares the cron (a double catch); the Admin page `/admin/metrc-api` sits behind the Admin PIN. Migration 0069 creates `metrc_api_calls` and `metrc_sweeps` and stores no key. No key value appears in any file (`METRC_INTEGRATOR_KEY = "` and `METRC_USER_KEY = "` absent from `src`, `test`, `scripts`, `wrangler.toml`, `migrations`); `453.59` the one METRC comment.

## Gates on the tree as received (the Scribe's sandbox)

- `npx tsc --noEmit`: exit 0.
- `npx vitest run`: 46 files, 809 tests passed; the same under `TZ=America/New_York`.
- `node --check scripts/smoke.mjs`: ok.
- From-zero smoke (`SMOKE_PORT=9080`): `About to apply 69 migration(s)`, `SMOKE PASS`, no 500; the Admin [Metrc API] page walked (keys absent, the sandbox host, zero calls, a skipped sweep, Test connection answering in words).
- Dash audit: 0 on all nine.
- Secret grep (`cfast_`, `MS_CLIENT_SECRET = "`, the two Metrc key values): no matches.

## Deploy

The owner deployed the worker before the gate (2dfb06ff). Migration 0069 must be on the grip database for `/admin/metrc-api` and the hourly sweep to write their rows; if the deploy went alone, the one line that lands it, from `app/` (no redeploy needed):

```powershell
cd "C:\Users\DennisWallace\Documents\Claude\Projects\gripfactory Practical\app"
npx wrangler d1 execute gripfactory-lite-grip-20260914 --env grip --remote --command "SELECT 1"
npx wrangler d1 migrations apply gripfactory-lite-grip-20260914 --env grip --remote
```

## Owner section (the build session's, handed on)

The keys, when the Metrc Connect gate opens (sandbox first): `npx wrangler secret put METRC_INTEGRATOR_KEY --env grip` and `npx wrangler secret put METRC_USER_KEY --env grip` from `app/`; never in chat, the repo or canon. env.grip's `METRC_API_BASE` stays the sandbox until he edits that one var to production. Its nine assumptions for his word: a skipped run is a `metrc_sweeps` row and makes no call; the sweep fills a column only when blank, a stored state, THC or pass stays; results are read only for a package label matching a local sample tag, an active parent package updates the order's state columns without a results call; facility licenses are the lookup licenses not starting `SC-` or `AU-SC-`; THC prefers a result type naming both "thc" and "total", else the first THC level, a typed THC stays; Retry-After read as seconds capped at 10, one retry, an unparseable header waits one second; each endpoint stops after 20 pages; the COA document endpoint waits for a later fork (the file id is stored); the CRA license check and the May 2026 guide still stand.

## Sealed final check

```
npx tsc --noEmit                      exit 0
npx vitest run                        46 files, 809 tests passed
TZ=America/New_York npx vitest run    46 files, 809 tests passed
node --check scripts/smoke.mjs        ok
rm -rf .smoke-persist && SMOKE_PORT=9080 WRANGLER_SEND_METRICS=false timeout 285 npm run smoke
                                      About to apply 69 migration(s); SMOKE PASS; " 500 " lines: 0
the build session's seal (9 files) verified byte for byte on the device and in the sandbox:
migrations/0069_metrc_mirror.sql         876  28571968cc3b1fb5
src/metrcapi.ts                        25366  ce55b905b181bd4e
src/index.ts                          127313  2907ee82d8bd7b15
src/config.ts                          60528  f17c565474496916
src/html.ts                           177112  c67ef11f5436df0e
src/i18n.ts                           150595  d305baf6d6ec7675
test/metrcapi.test.ts                   5810  aede7c67ced5b53a
scripts/smoke.mjs                     533995  98f22b63693b9b16
wrangler.toml                           2715  d8b173eed0cc9b72
tree hash after the copy, device and sandbox: 1af2b68f7d189bb3
dash audit: 0 on every file above
secret grep: no matches; grep 453.59: one hit, the METRC comment in src/config.ts
```
