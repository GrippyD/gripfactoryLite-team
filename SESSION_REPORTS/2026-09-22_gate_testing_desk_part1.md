# 2026-09-22 The gate on the testing desk, part 1 (canon 0.30.175)

Scribe session. The gate on his Code session's `SESSION_REPORTS/2026-09-21_testing_desk_part1.md` (brief C Part 1, THE TESTING DESK, canon 0.30.164; migration 0068). Nothing deployed from here; no Scribe change to `app/`.

## What was gated

1. The tree was hashed on the device after the build session went quiet (the last file under `app/` moved at 01:39, the report at 01:41) and compared file by file with the Scribe's sandbox, which held the tree of canon 0.30.173 byte for byte. Eleven files differed, exactly the eleven of the report's seal, and nothing else under `app/src`, `app/test`, `app/scripts`, `app/migrations`, `wrangler.toml`, `tsconfig.json`, `package.json` or `CLAUDE.md` had moved. No stray `-1` file under `app/`.
2. The eleven were staged, verified against the seal (size and sha256, all eleven), copied into the sandbox and verified again there.
3. Read against the brief: `migrations/0068_testing_desk.sql` holds `testing_labs`, `test_orders`, `test_manifests`, `test_samples`, `test_results`, the indexes and the four lab seeds (SC Labs Michigan, ACT Laboratories, Lab Link, Viridis inactive); no driver, phone or person seeded (G-9 sweep clean); `/testing` behind the Admin PIN; `METRC_INTEGRATOR_KEY` and `METRC_USER_KEY` appear in no file under `src`, `test`, `scripts`, `wrangler.toml` or `migrations`; nothing in the slice calls Metrc.

## Gates on the tree as received (the Scribe's sandbox)

- `npx tsc --noEmit`: exit 0.
- `npx vitest run`: 45 files, 796 tests passed; the same under `TZ=America/New_York`.
- `node --check scripts/smoke.mjs`: ok.
- From-zero smoke (`SMOKE_PORT=9074`): `About to apply 68 migration(s)`, `SMOKE PASS`, no 500; the desk walk in the log: the PIN gate (401 then 200), schedule, a refused second order and a refused bad tag (400), sample, manifest, the worksheet download, the printable manifest, sent, the manifest number, results, retest, remediation, a second sample and manifest through to a pass, and the Testing labs editor under Admin, Lookups.
- Dash audit: 0 on all eleven.
- Secret grep (`cfast_`, `MS_CLIENT_SECRET = "`, the two Metrc key names): no matches. `grep -rn "453.59" src scripts test`: the one METRC comment.

## Deploy (his hands; the three-step block, migration 0068 rides)

```powershell
cd "C:\Users\DennisWallace\Documents\Claude\Projects\gripfactory Practical\app"
npx wrangler d1 execute gripfactory-lite-grip-20260914 --env grip --remote --command "SELECT 1"
npx wrangler d1 migrations apply gripfactory-lite-grip-20260914 --env grip --remote
npm run deploy:grip
```

## Owner section (the build session wrote it; the Scribe hands it)

Before the desk is treated as verified: the four labs' license numbers (SC-000035 and AU-SC-000129, SC-000048 and AU-SC-000152, SC-000037 and AU-SC-000133, SC-000009 and AU-SC-000113) checked against the CRA license verification tool, and the CRA Compliance Best Practice Guide (Updated May 2026) read; a wrong number is edited under Admin, Lookups, Testing labs without a deploy. The lab tech is named as a person and uses the Admin PIN for `/testing`. Metrc keys stay behind the Metrc Connect gate; Part 1 reads neither secret.

## Sealed final check

```
npx tsc --noEmit                      exit 0
npx vitest run                        45 files, 796 tests passed
TZ=America/New_York npx vitest run    45 files, 796 tests passed
node --check scripts/smoke.mjs        ok
rm -rf .smoke-persist && SMOKE_PORT=9074 WRANGLER_SEND_METRICS=false timeout 285 npm run smoke
                                      About to apply 68 migration(s); SMOKE PASS; " 500 " lines: 0 (exit 124, the timeout's, as always)
the build session's seal (11 files) verified byte for byte on the device and in the sandbox:
migrations/0068_testing_desk.sql        4962  248533389c6311e4
src/testing.ts                         64065  a0e8a1ba35893a1c
src/config.ts                          60031  d4377beb1eceaa0f
src/index.ts                          125758  215288b896111ecd
src/html.ts                           176926  e24c028f5ba2e945
src/actions.ts                        267202  529ef3079041a09b
src/i18n.ts                           147355  9fb08db3029091ea
src/theme.ts                          152243  d3e027e0b5063e6a
src/lookups.ts                          8180  cc5f3a665f7e689e
test/testing.test.ts                    5442  34ad950bc2e9a5cf
scripts/smoke.mjs                     526790  fbeb307bc1b82f62
dash audit: 0 on every file above
secret grep: no matches; grep 453.59: one hit, the METRC comment in src/config.ts
```
