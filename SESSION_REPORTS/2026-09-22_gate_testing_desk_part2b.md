# 2026-09-22 The gate on the testing desk, part 2b (canon 0.30.182)

Scribe session. The gate on his Code session's `SESSION_REPORTS/2026-09-22_testing_desk_part2b.md` (brief C Part 2b, BRIEFS/2026-09-22_first_time_rate_by_weight.md; THE FIRST TIME PASS RATE IS BY WEIGHT OF THE PARENT PACKAGE, 0.30.178, and THE FIFTY POUNDS IS NOT A GATE, 0.30.179; no migration). Nothing deployed from here; no Scribe change to `app/`.

## What was gated

1. The tree was hashed on the device after the build session went quiet (the last file under `app/` moved at 13:06Z, the report at 13:13Z) and compared with the Scribe's sandbox, which held the tree of canon 0.30.177 plus the two 0.30.180 repair files byte for byte. Six files differed, exactly the six of the report's seal; after the copy the two trees hash identical (189 files, tree hash c06a1fbcf6b3702e). Nothing else under `app/src`, `app/test`, `app/scripts`, `app/migrations`, `wrangler.toml`, `tsconfig.json`, `package.json` or `CLAUDE.md` had moved. No stray `-1` file under `app/` (the `ct-1`, `gf-1`, `pm-1` PNGs under `public/continuum/` are the numbered Continuum assets of 09-07 and 09-08, not chat-card copies). The migration head is still 0068.
2. The six were staged, verified against the seal (size and sha256, all six), copied into the sandbox and verified again there.
3. Read against the brief: `testingParents` groups every full compliance order by the parent key (`source_package_tag` when tag-shaped, else `source_package_code`, else the lot), takes the earliest by `created_at` then id, enters the parent only when that first panel's sample carries `overall_passed`, weighs it by that order's `batch_grams`, and keeps the failed types of a failed first panel; `rateText` renders the percent over grams with the pounds at 448 and the package counts under it; the COA and THC rows carry `attempt {n}`; `batchOverLimit`, `batchLimitGrams`, `BATCH_MAX_POUNDS`, `BATCH_LIMIT_WORDS` and the R 420.304 refusal string are gone from `src`, the only mentions left are the two negative assertions in the test and the smoke; `sampleGrams` still reads 0.5 percent with the 14 g floor and the lab increment. No Metrc key name in any file; nothing calls Metrc.

## Gates on the tree as received (the Scribe's sandbox)

- `npx tsc --noEmit`: exit 0.
- `npx vitest run`: 45 files, 800 tests passed; the same under `TZ=America/New_York`.
- `node --check scripts/smoke.mjs`: ok.
- From-zero smoke (`SMOKE_PORT=9077`): `About to apply 68 migration(s)`, `SMOKE PASS`, no 500.
- Dash audit: 0 on all six.
- Secret grep (`cfast_`, `MS_CLIENT_SECRET = "`, the two Metrc key names): no matches. `grep -rn "453.59" src scripts test`: the one METRC comment.

## Deploy (his hands; worker only, 0068 already on the grip database)

```powershell
cd "C:\Users\DennisWallace\Documents\Claude\Projects\gripfactory Practical\app"
npm run deploy:grip
```

## Owner section (the build session's, handed on)

Part 2b adds no secret, no migration and no Metrc call. Its seven assumptions for his word: two orders sharing a parent key are one package even across lots; earliest is `created_at` then the order id; the earliest resulted sample of the first order is the result; each gram sum converts to pounds on its own (30,000 g passed and 10,000 g failed reads 75.0%, 66.96 of 89.29 lb, 1 of 2 packages); failure types of equal weight sort by name; the COA and THC lists keep every resulted sample of the season (later attempts, potency and R&D included) while the rate does not; the three lot counts are Part 2's. The Part 1 hand still stands: the CRA license check, the May 2026 guide, the lab tech on the Admin PIN, the Metrc Connect gate before any key.

## Sealed final check

```
npx tsc --noEmit                      exit 0
npx vitest run                        45 files, 800 tests passed
TZ=America/New_York npx vitest run    45 files, 800 tests passed
node --check scripts/smoke.mjs        ok
rm -rf .smoke-persist && SMOKE_PORT=9077 WRANGLER_SEND_METRICS=false timeout 285 npm run smoke
                                      About to apply 68 migration(s); SMOKE PASS; " 500 " lines: 0 (exit 124, the timeout's, as always)
the build session's seal (6 files) verified byte for byte on the device and in the sandbox:
src/console.ts                         90998  b57d67cbf0243038
src/config.ts                          60279  b5887192947dbf55
src/testing.ts                         63396  160c8cfa2f2f2bd6
src/i18n.ts                           148752  a2093ae49b02dab6
test/testing.test.ts                   12937  b979b15d32eec2ae
scripts/smoke.mjs                     529634  dc0e34fd6cf08870
tree hash after the copy, device and sandbox: c06a1fbcf6b3702e (189 files)
dash audit: 0 on every file above
secret grep: no matches; grep 453.59: one hit, the METRC comment in src/config.ts
```
