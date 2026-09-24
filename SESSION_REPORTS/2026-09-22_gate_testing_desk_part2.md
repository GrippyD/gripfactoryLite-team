# 2026-09-22 The gate on the testing desk, part 2 (canon 0.30.177)

Scribe session. The gate on his Code session's `SESSION_REPORTS/2026-09-21_testing_desk_part2.md` (brief C Part 2, the console's Testing section, canon 0.30.164; no migration). Nothing deployed from here; no Scribe change to `app/`.

## What was gated

1. The tree was hashed on the device after the build session went quiet (the last file under `app/` moved at 02:23, the report at 02:25) and compared file by file with the Scribe's sandbox, which held the tree of canon 0.30.176 byte for byte. Eight files differed, exactly the eight of the report's seal, and nothing else under `app/src`, `app/test`, `app/scripts`, `app/migrations`, `wrangler.toml`, `tsconfig.json`, `package.json` or `CLAUDE.md` had moved. No stray `-1` file under `app/`. The migration head is still 0068, as the report says.
2. The eight were staged, verified against the seal (size and sha256, all eight), copied into the sandbox and verified again there.
3. Read against the brief: the Testing section reads the harvest year and ignores the console's day control; lots ready uses the desk's ready rule; the first-time rate is attempt 1 with results, by lab then failure type and by strain then farm; COAs and THC by parent tag with the THC heading sorting; Pasteurization is the remaining stub. No Metrc key name in any file; nothing calls Metrc.

## Gates on the tree as received (the Scribe's sandbox)

- `npx tsc --noEmit`: exit 0.
- `npx vitest run`: 45 files, 798 tests passed; the same under `TZ=America/New_York`.
- `node --check scripts/smoke.mjs`: ok.
- From-zero smoke (`SMOKE_PORT=9075`): `About to apply 68 migration(s)`, `SMOKE PASS`, no 500; the console read after the desk walk and the THC sort both in the log.
- Dash audit: 0 on all eight.
- Secret grep (`cfast_`, `MS_CLIENT_SECRET = "`, the two Metrc key names): no matches. `grep -rn "453.59" src scripts test`: the one METRC comment.

## Deploy (his hands; worker only, since 0068 is already on the grip database as of worker 0ad1911f)

```powershell
cd "C:\Users\DennisWallace\Documents\Claude\Projects\gripfactory Practical\app"
npm run deploy:grip
```

## Sealed final check

```
npx tsc --noEmit                      exit 0
npx vitest run                        45 files, 798 tests passed
TZ=America/New_York npx vitest run    45 files, 798 tests passed
node --check scripts/smoke.mjs        ok
rm -rf .smoke-persist && SMOKE_PORT=9075 WRANGLER_SEND_METRICS=false timeout 285 npm run smoke
                                      About to apply 68 migration(s); SMOKE PASS; " 500 " lines: 0 (exit 124, the timeout's, as always)
the build session's seal (8 files) verified byte for byte on the device and in the sandbox:
src/console.ts                         85867  cd29cb67c31b1b52
src/config.ts                          60315  1bfd8e9473ab35a7
src/index.ts                          126032  6b5f7210206ce55a
src/i18n.ts                           148854  c169df01c7dcfab1
src/theme.ts                          152654  77843703a1eb51ad
test/console.test.ts                   46975  a46ff76bcdefac2d
test/testing.test.ts                    8765  4b4374f20e8dcaa9
scripts/smoke.mjs                     528724  b2e866e8ad840b63
dash audit: 0 on every file above
secret grep: no matches; grep 453.59: one hit, the METRC comment in src/config.ts
```
