# 2026-09-21 The gate on brief B, the cure panes and the sensor door (canon 0.30.169)

Scribe session. The gate on his Code session's `SESSION_REPORTS/2026-09-21_cure_panes.md` (brief B, THE CURE PANES AND THE SENSOR DOOR, canon 0.30.164; migration 0067). Nothing deployed from here; no Scribe change to `app/`.

## What was gated

1. The tree was hashed on the device after the build session went quiet (the last file under `app/` moved at 23:35, the report at 23:38) and compared file by file with the Scribe's sandbox, which held the gated brief-A tree (canon 0.30.166) byte for byte. Eleven files differed, exactly the eleven of the report's seal, and nothing else under `app/src`, `app/test`, `app/scripts`, `app/migrations`, `wrangler.toml`, `tsconfig.json`, `package.json` or `CLAUDE.md` had moved. No stray `-1` file anywhere under `app/`.
2. The eleven were staged, verified against the seal (size and sha256, all eleven), copied into the sandbox and verified again there.
3. Read against the brief: `migrations/0067_cure_panes.sql` is `sensor_readings` with its `(room, read_at)` index and the `cure_rooms` seed `CSA,CSB`; `src/service.ts` has `SERVICE_ROUTES.post = ["/sensors/readings"]` and its refusal names that door; the panes read `internal_test_results` by HBN or package tag; nothing pulls from another app. Spanish speaks on the labels; CSA and CSB stay as his names.

## Gates on the tree as received (the Scribe's sandbox)

- `npx tsc --noEmit`: exit 0.
- `npx vitest run`: 44 files, 789 tests passed; the same under `TZ=America/New_York`.
- `node --check scripts/smoke.mjs`: ok.
- From-zero smoke (`SMOKE_PORT=9071`): `About to apply 67 migration(s)`, `SMOKE PASS`, no 500; in the log the good reading answers 200 and the bad room 400, and the sheet sync's two `/__scheduled` walks still run.
- Dash audit: 0 on all eleven.
- Secret grep (`cfast_`, `MS_CLIENT_SECRET = "`, `CF_ACCESS_CLIENT_SECRET = "`, a `sensor-bridge` value): no matches under `src`, `wrangler.toml`, `test`, `scripts`, `migrations`. `grep -rn "453.59" src scripts test`: the one METRC comment.

## Deploy (his hands; the three-step block, migration 0067 rides)

```powershell
cd "C:\Users\DennisWallace\Documents\Claude\Projects\gripfactory Practical\app"
npx wrangler d1 execute gripfactory-lite-grip-20260914 --env grip --remote --command "SELECT 1"
npx wrangler d1 migrations apply gripfactory-lite-grip-20260914 --env grip --remote
npm run deploy:grip
```

## Owner section (the Scribe hands it; the build session wrote it)

The Access service token `sensor-bridge`, the same runbook as canon 0.30.136 and 0.30.139: Zero Trust, Access, Service Auth, Service Tokens, Create (name `sensor-bridge`, duration one year, a rotation date); copy the Client ID and the Client Secret at once (the secret shows once). Then Access, Applications, "gripfactory-lite-grip - Cloudflare Workers", Policies, the reusable Service Auth policy `corey-portal`: add `sensor-bridge` to its Include rule beside `silo-ops-cron` and `trimatron-puller`. Hand Corey the URL `https://gripfactory-lite-grip.gflite.workers.dev/sensors/readings`, the header names `CF-Access-Client-Id` and `CF-Access-Client-Secret`, the two values by a channel fit for a password, and the JSON shape `{ "room": "CSA", "temperature_f": 68.2, "humidity_pct": 58, "read_at": "2026-09-21T15:00:00Z", "source": "silo-ops" }` (one object or an array of up to 100). Neither value ever enters the repo, the canon or chat.

## Sealed final check

```
npx tsc --noEmit                      exit 0
npx vitest run                        44 files, 789 tests passed
TZ=America/New_York npx vitest run    44 files, 789 tests passed
node --check scripts/smoke.mjs        ok
rm -rf .smoke-persist && SMOKE_PORT=9071 WRANGLER_SEND_METRICS=false timeout 285 npm run smoke
                                      About to apply 67 migration(s); SMOKE PASS; " 500 " lines: 0 (exit 124, the timeout's, as always)
the build session's seal (11 files) verified byte for byte on the device and in the sandbox:
migrations/0067_cure_panes.sql          1087  384554a578643966
src/cure.ts                            15710  5001f74f69b9a931
src/service.ts                          3236  724db8c72e9b2aff
src/index.ts                          120789  7f425a8ccf120fd6
src/console.ts                         69622  4a685d7763237c2a
src/config.ts                          58069  84f6a04232ae2834
src/theme.ts                          151096  201beb578d761047
src/i18n.ts                           140142  eed938b630600cd9
test/cure.test.ts                       9411  5f0ecaca7ea03143
test/service.test.ts                    8794  64f1bee33221ca22
scripts/smoke.mjs                     513553  09b15689bb9e20bc
dash audit: 0 on every file above
secret grep: no matches; grep 453.59: one hit, the METRC comment in src/config.ts
```
