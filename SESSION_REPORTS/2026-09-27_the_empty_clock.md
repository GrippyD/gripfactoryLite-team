# 2026-09-27 The empty clock

Brief T, THE EMPTY CLOCK (canon 0.30.270). No migration. Not deployed. Nothing committed.

## What changed

A silo or a dry room with no open load counts up from the moment its last load left. That moment is the newest `ended_at` among the space's loads, the unload finish's press. A load that left by its lot's void, with no `ended_at`, counts from that load's `deleted_at`. The newer of the two wins. A space with an open load has no empty clock. A space no load has ever left has none. A load's effective date plays no part.

The line is `Empty since` with a clock in the load clock's shape (`0d 04:12:33`), under the state word, on an empty, filling, or loading tile. It ticks by the same `data-clock` runner as a load clock, from the origin, with no banked pause. A loaded tile keeps the line hidden so the refresh can show it when a load ends and hide it when one begins. `/silos/live.json` carries `emptySince`, the origin's ISO or null, beside the fields it had. A freezer's tile does not carry the line, and its `emptySince` stays null.

## Assumptions for his word

- Up from the unload, not down to a target.
- A void that took the last load counts from the void. Otherwise a silo emptied by a void would show no clock until its next unload.
- Filling and loading tiles carry it as the empty tile does.
- Freezers do not.
- The press, not the unload's effective day.

## Gates

- `npx tsc --noEmit`: exit 0.
- `npx vitest run`: 62 files, 943 tests passed. The same under `TZ=America/New_York`.
- `node --check scripts/smoke.mjs`: exit 0.
- From-zero smoke (`SMOKE_PORT=9191`, `WRANGLER_SEND_METRICS=false`): `About to apply 77 migration(s)`, `SMOKE PASS`, ` 500 ` lines: 0, exit 0.
- Dash audit: 0 on the files below (U+2014 and U+2013). No CR byte in those files.
- `METRC_INTEGRATOR_KEY = "`, `METRC_USER_KEY = "`, `MS_CLIENT_SECRET = "`, and `SENSORPUSH_PASSWORD = "` appear in no file under `src`, `test`, `scripts`, `migrations`, or `wrangler.toml`.

## Deploy

Not deployed from this session. Nothing committed. No migration.

## Sealed final check

```
npx tsc --noEmit                      exit 0
npx vitest run                        62 files, 943 tests passed
TZ=America/New_York npx vitest run    62 files, 943 tests passed
node --check scripts/smoke.mjs        exit 0
SMOKE_PORT=9191 WRANGLER_SEND_METRICS=false node scripts/smoke.mjs
                                      About to apply 77 migration(s); SMOKE PASS; " 500 " lines: 0; exit 0
```

```
scripts/smoke.mjs            617304  e2caec78ea4df264
TAIL });
src/db.ts                    185958  a0a5a479f04d8463
TAIL }
src/drying.ts                 34941  82805c1fa0b0be61
TAIL }
src/html.ts                  192537  7d4926882aba3dfa
TAIL }
src/i18n.ts                  179726  9e4e579aa8567e77
TAIL }
src/index.ts                 142814  181e50a6c9118b4d
TAIL export default worker;
src/silo.ts                   41677  242036796426a97c
TAIL }
test/console.test.ts          61769  30baeb3345d88972
TAIL });
test/silo.test.ts             36251  a04af21c22dc8cae
TAIL });
```
