# 2026-10-08 The sensor door keeps each unit

BRIEF SD1, THE SENSOR DOOR KEEPS EACH UNIT (canon 0.30.422). No migration of its own. H1's 0095 is the pin. Not deployed. Nothing committed. Nothing pushed. No git was run.

## The pin

Built on the tree H1 leaves. The app tree this session leaves, both briefs together, is `c63769980fe87554` (307 files, migrations 0001 to 0095, `wrangler.toml` read as LF).

## What changed

A reading may carry `sensor_id`, trimmed, 1 to 80 characters. Longer than 80 is refused with that reading's number, and the batch writes nothing. The id is stored on `sensor_readings.sensor_id`. A reading without one is stored as before.

A reading whose sensor id and `read_at` already stand, or, with no sensor id, whose room, `read_at` and source already stand on a row with a null sensor id, is not stored again and does not fail the batch. The answer stays 200 `{"ok":true,"stored":n,"skipped":m}`. Readings are checked first, then written.

A cure pane's conditions line reads each unit's newest reading within 15 minutes of the room's newest reading and shows the mean temperature and mean humidity, rounded as before, with "{n} units" when n is more than one (ES "{n} unidades"). The hover names the newest read time and the source. Door rows with no sensor id count as one unit by room. A "test" source stays ignored.

The Environment page reads those door rows the same way, by room, with no sensor binding. The SensorPush pull and its bindings are unchanged.

## Gates

Same run as H1, on the tree both briefs leave.

- `npx tsc --noEmit`: exit 0.
- `npx vitest run`: 95 files, 1256 tests passed under `TZ=UTC`, and 95 files, 1256 tests passed under `TZ=America/New_York`.
- `node --check scripts/smoke.mjs`: exit 0.
- From-zero smoke (`SMOKE_PORT=9484`, `WRANGLER_SEND_METRICS=false`, `CI=1`, `TZ=UTC`): About to apply 95 migration(s), SMOKE PASS, no ` 500 ` line, exit 0. The `503` line is `POST /api/send`, the smoke's own asserted step. Four CSA units store 4, the resend stores 0 and skips 4, the CSA pane shows 71.5 F and "4 units", and one CSB unit shows alone.
- Dash (U+2013, U+2014), CR, and BOM audits by character on the files this brief touched: 0.

## Deploy

Not deployed from this session. Nothing committed. Nothing pushed. No git was run. Say deploy when you want it on the grip worker.

## Sealed final check

```
the tree H1 left, and this brief leaves, wrangler.toml read as LF
                                      c63769980fe87554 (307 files, migrations 0001-0095)
npx tsc --noEmit                      exit 0
TZ=UTC npx vitest run                 95 files, 1256 tests passed
TZ=America/New_York npx vitest run    95 files, 1256 tests passed
node --check scripts/smoke.mjs        exit 0
SMOKE_PORT=9484 WRANGLER_SEND_METRICS=false CI=1 TZ=UTC node scripts/smoke.mjs
                                      About to apply 95 migration(s); SMOKE PASS; " 500 " lines: 0; POST /api/send 503 (the smoke's own step); exit 0
dash audit: 0; CR audit: 0; BOM: 0
```

File hashes below are the session's final bytes (sha256, first 16).

```
app/src/cure.ts                         26067  8bddbb6c907fa741
TAIL }
app/src/environment.ts                  29103  6a12f325e3c4b561
TAIL }
app/src/index.ts                       179515  9038875750c0f8c9
TAIL export default worker;
app/src/i18n.ts                        268573  cfafa49ba09bcce4
TAIL }
app/scripts/smoke.mjs                  821974  23dfa3f23410f50a
TAIL });
app/test/cure.test.ts                   20138  ab3fc44ae3814467
TAIL });
app/test/environment.test.ts            12702  eeb524a1750ce3b9
TAIL });
```
