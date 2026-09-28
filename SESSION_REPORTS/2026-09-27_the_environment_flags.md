# 2026-09-27 The environment flags

Brief Q, THE ENVIRONMENT FLAGS (canon 0.30.246). One migration, `0077`. Not deployed. Nothing committed.

## What changed

A second cron, every five minutes, pulls SensorPush when `SENSORPUSH_EMAIL` and `SENSORPUSH_PASSWORD` are set. The hourly jobs stay on the quarter-hour cron. The handler tells the two apart by `event.cron`. The access token is kept in `sensorpush_auth` and renewed before its twelve hours. No page, export, or log reads it. Each poll stores the newest sample per bound sensor. The same sensor and observed time is not stored twice. A 429, a 401, or a network failure records one line (time, count, error) and waits for the next cron.

Admin, Environment, behind the Admin PIN, lists the account's sensors, binds each to a dry space or a cure room and one of four roles (room, bed, plenum, exhaust), and edits the optional temperature and humidity bounds for that space and role. An unbound sensor is not pulled. The stale window is `environment_stale_minutes`, seeded at 60.

A bound sensor is out when its newest reading breaks a set bound, stale when that reading is older than the window or none has arrived since the bind, and in otherwise. The silo strip shows the flag in the danger color, and `/silos/live.json` adds `flags` beside the fields it already had. The Drying line on the Operations map reads a flagged space's flag after its clock. The cure panes' conditions line turns red when the room is out, as it does when the reading is stale. A temperature with no humidity is valid, from the pull and from `POST /sensors/readings`. The door accepts every live dry space as well as the cure rooms, so a freezer temperature posted to the door is flagged like a bound sensor.

## Assumptions for your word

- The four roles are room, bed, plenum, and exhaust.
- Each poll keeps the newest sample for each bound sensor, not every sample in the response.
- The pull runs every five minutes. The sheet, the mirror, and In Testing stay on the quarter-hour cron.
- The stale window starts at 60 minutes.
- The access token is the row `current` in `sensorpush_auth`. It is not shown, exported, or written to the change log.
- A reading from before the bind does not count. The sensor is stale until a reading arrives after the bind.
- A door reading with no role is a room reading for that space.

## Gates

- `npx tsc --noEmit`: exit 0.
- `npx vitest run`: 62 files, 936 tests passed. The same under `TZ=America/New_York`.
- `node --check scripts/smoke.mjs`: exit 0.
- From-zero smoke (`SMOKE_PORT=9183`, `WRANGLER_SEND_METRICS=false`): `About to apply 77 migration(s)`, `SMOKE PASS`, ` 500 ` lines: 0, exit 0. A fixture sensor bound to Silo 3 as plenum flagged on the strip and on live.json, an in-range reading cleared it, and a temperature-only freezer reading flagged the freezer tile.
- Dash audit: 0 on the files below (U+2014 and U+2013).
- `METRC_INTEGRATOR_KEY = "`, `METRC_USER_KEY = "`, and `SENSORPUSH_PASSWORD = "` appear in no file under `src`, `test`, `scripts`, `migrations`, or `wrangler.toml`.

## Deploy

Not deployed from this session. Nothing committed. The migration is `0077`, so a deploy of this tree is the three-step path.

## Sealed final check

```
npx tsc --noEmit                      exit 0
npx vitest run                        62 files, 936 tests passed
TZ=America/New_York npx vitest run    62 files, 936 tests passed
node --check scripts/smoke.mjs        exit 0
SMOKE_PORT=9183 WRANGLER_SEND_METRICS=false node scripts/smoke.mjs
                                      About to apply 77 migration(s); SMOKE PASS; " 500 " lines: 0; exit 0
```

```
migrations/0077_environment.sql   2582  9a8d474fc2bd30d3
TAIL   ('environment_stale_minutes', '60', '2026-09-27T00:00:00.000Z', NULL, '2026-09-27T00:00:00.000Z', NULL, NULL, NULL);
scripts/smoke.mjs               614719  6c43d8e71f2577dd
TAIL });
src/config.ts                    70769  1d5e7748d9323b95
TAIL }
src/console.ts                  102821  9d9bb731f1bedc97
TAIL }
src/cure.ts                      17663  a4b24e09088a9be6
TAIL }
src/drying.ts                    34889  2eb7127e04d4f0b7
TAIL }
src/environment.ts               22480  b706797aadd33f34
TAIL }
src/html.ts                     192489  9d949693fd54d7e4
TAIL }
src/i18n.ts                     179561  95112d7ae80aeb7f
TAIL }
src/index.ts                    142551  27bf4122f1c7dd02
TAIL export default worker;
src/sensorpush.ts                10209  f22dd712ff1c172f
TAIL }
src/silo.ts                      37445  2d872f9fe3012a23
TAIL }
src/theme.ts                    156963  656f989970bdb37c
TAIL }
test/environment.test.ts          7362  5f6c7683d6ddbfe7
TAIL });
test/silo.test.ts                29251  7b402d5806bd9633
TAIL });
wrangler.toml                     2903  82e5cd2b1d151583
TAIL migrations_dir = "migrations"
```
