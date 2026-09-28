# 2026-09-27 The environment flags, the gate's fix

The fix sitting on the gate `SESSION_REPORTS/2026-09-27_gate_the_environment_flags.md` (canon 0.30.264). Migration `0077` is unchanged. Not deployed. Nothing committed.

## What changed

F1. `saveEnvironmentRange` reads the live row's four bounds and logs one `record_change_log` row for each of `temp_low`, `temp_high`, `humidity_low`, and `humidity_high`. Each row carries that bound's old value and its new value, under the one reason. A first save logs null for the old value. This is the same shape `saveSensorBinding` uses for `space_name` and `role`.

F2. `listCurePanes` takes the shell locale and passes it to `listEnvironmentFlags`. The Harvest Console, the silo strip, and the drying schedule already have `s.locale` and now pass it. A Spanish shell words the cure pane's flag the way the strip and the Drying line already do. Callers that omit the locale still get English.

F3. A failed Re-read no longer writes `environment_pulls`. `refreshSensorCatalog` returns the HTTP code, and `/admin/environment` shows it as its own flash, `Re-read refused: HTTP {n}` (`data-env-refused`). The Last pull line still reads the newest `environment_pulls` row, and only the cron's pull writes that table.

## Gates

- `npx tsc --noEmit`: exit 0.
- `npx vitest run`: 62 files, 937 tests passed. The same under `TZ=America/New_York`.
- `node --check scripts/smoke.mjs`: exit 0.
- From-zero smoke (`SMOKE_PORT=9185`, `WRANGLER_SEND_METRICS=false`): `About to apply 77 migration(s)`, `SMOKE PASS`, ` 500 ` lines: 0, exit 0.
- Dash audit: 0 on the files below (U+2014 and U+2013). No CR byte in those files.
- `METRC_INTEGRATOR_KEY = "`, `METRC_USER_KEY = "`, `MS_CLIENT_SECRET = "`, and `SENSORPUSH_PASSWORD = "` appear in no file under `src`, `test`, `scripts`, `migrations`, or `wrangler.toml`.

## Deploy

Not deployed from this session. Nothing committed. Migration `0077` did not change (2582 bytes, sha256 `9a8d474fc2bd30d3`).

## Sealed final check

```
npx tsc --noEmit                      exit 0
npx vitest run                        62 files, 937 tests passed
TZ=America/New_York npx vitest run    62 files, 937 tests passed
node --check scripts/smoke.mjs        exit 0
SMOKE_PORT=9185 WRANGLER_SEND_METRICS=false node scripts/smoke.mjs
                                      About to apply 77 migration(s); SMOKE PASS; " 500 " lines: 0; exit 0
migrations/0077_environment.sql       unchanged  2582  9a8d474fc2bd30d3
```

```
src/cure.ts                    17694  0f5bf179820d4180
TAIL }
src/environment.ts             23191  3dd3fa461d9599f9
TAIL }
src/i18n.ts                   179666  c0b0a42afe11f968
TAIL }
src/index.ts                  142800  b9097e2dabd4f92c
TAIL export default worker;
src/sensorpush.ts              10166  344a3b356eb1235f
TAIL }
test/environment.test.ts       10469  8900e1596148006a
TAIL });
```
