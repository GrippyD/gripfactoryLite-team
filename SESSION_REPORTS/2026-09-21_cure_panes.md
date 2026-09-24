# 2026-09-21 The cure panes and the sensor door (canon 0.30.164, brief B)

Build session under THE DISPATCH RULE (canon 0.30.155), brief `BRIEFS/2026-09-21_cure_panes_and_the_sensor_door.md`. Migration `0067`. From-zero smoke pin is 67. Not deployed. Lands on brief A (whole grams, the 448 pound). The Scribe gates this report, folds canon, and hands the block.

Owner, 2026-09-21, verbatim (his dashes rendered as hyphens): "Add to all drying screens AND THE DASHBOARD, next to FFZ Inventory two new panes: CSA ... CSB ... Current Conditions (read from Corey's app ... or we setup a sensor push API-whatever's clever); Empty on lot scheduled for trim ... Empty on lot scheduled for cryo"

His pick: Current Conditions come through "A push door we own".

## The law, as built

1. THE TWO PANES. `CSA` and `CSB` (his names, not expanded) render on every Drying Operations page under the silo strip, and on the Harvest Console in the Drying section beside the FFZ tile. A row is the lot's short id, linked to the lot record, the dry weight in pounds at 448 grams (two decimals) with the ledger package's live grams beside it, the time in as the silo clock (`1d 03:24:00`, ticking once a second), moisture at in-time, and the latest moisture with its timestamp.
2. CSA holds a lot in status `unloaded` with no live trim schedule. The in-time is the latest finished unload session, or the change-log row that set the status to unloaded when there is no finish. A trim schedule row removes it.
3. CSB holds a lot in status `unloaded` or `trimmed` with a live trim schedule, until any of its trim containers is an input of a live cryo run (`scheduled` or `complete`). The in-time is that trim row's `scheduled_at`. A voided lot and a frozen lot sit on neither pane.
4. Moisture comes from `internal_test_results`, matched on the lot's HBN or on `package_tag` equal to the harvest package tag. Moisture wins over water activity when both exist. At in-time is the newest of those at or before the in-time. Latest is the newest overall. Water activity shows as `0.62 aw`, moisture as `11.4 %`, and the word says which. None reads `no reading`.
5. THE SENSOR DOOR. `sensor_readings` and `POST /sensors/readings`. One JSON object or an array of up to 100. Room must be on `app_config` `cure_rooms` (seeded `CSA,CSB`). Temperature is -40 to 200 F. Humidity is 0 to 100. `read_at` must parse. A bad post is refused in words and stores nothing. A good post answers `{ ok: true, stored: n }`. The conditions line is the newest reading for that pane's room: `68.2 F · 58 % · 4 min ago`, in red (`cure-stale`) when the reading is older than an hour, and `no sensor yet` before the first. Nothing pulls from another app.
6. THE SERVICE ACTOR. On the Access-fronted worker, a request with no login email may `POST /sensors/readings` and still may only read the doors it already had. Every other write stays refused. A logged-in person may post the same door (the smoke does). Spanish speaks on the labels. CSA and CSB do not translate.

## What changed

- `migrations/0067_cure_panes.sql`: `sensor_readings` and the index on `(room, read_at)`; the `cure_rooms` seed.
- `src/cure.ts`: `listCurePanes`, `storeSensorReadings`, `latestReading`, `curePanes`, the clock script.
- `src/service.ts`: `SERVICE_ROUTES.post` is `POST /sensors/readings` alone. The refusal names that door.
- `src/index.ts`: the route; the console and `siloStripFor` (every drying page) render the panes.
- `src/console.ts`: `cureHtml` in the Drying section, after the strip.
- `src/config.ts`: `CONFIG_KEYS.cure_rooms`.
- `src/theme.ts`: `.cure-panes`, `.cure-pane`, `.cure-row`, `.cure-stale`, in the shared chrome of the three themes.
- `src/i18n.ts`: the labels, EN and ES.
- `test/cure.test.ts`, `test/service.test.ts`.
- `scripts/smoke.mjs`: pin 67; the unloaded lot on CSA (console and a drying page); trim schedule moves it to CSB; a cryo run empties CSB; a posted reading shows; a bad room refuses.

## Assumptions for the owner's word

- The clock uses the silo shape with seconds (`0d 04:00:00`), not hours and minutes alone.
- One conditions line per pane, for the room the pane is named (CSA reads room CSA).
- "Moisture where present" means: in the rows being considered, a moisture row wins over water activity even when the water activity is newer.
- The lot link is the lot record's pencil (`/record/wet_weight_entries/<id>/edit`).
- Live grams are the oldest non-voided ledger package on the lot. Blank when there is none.
- A service token's post is not tied to a people row. `source` defaults to `manual` when omitted, and is stored, not shown.
- Temperature outside -40 to 200 F, or humidity outside 0 to 100, is refused. The whole array is refused when any row is bad.

## Owner section (for the Scribe to hand)

The Access service token `sensor-bridge`, beside `silo-ops-cron` and `trimatron-puller`. Its Service Auth policy line is the same runbook as canon 0.30.13x, admitting `POST /sensors/readings` only. Hand the token id and secret to Corey over a password-grade channel. Do not put either value in the repo. The block is three-step because migration 0067 rides: probe, migrations apply, deploy.

## Gates

- `npx tsc --noEmit`: exit 0.
- `npx vitest run`: 44 files, 789 tests passed. The same under `TZ=America/New_York`.
- `node --check scripts/smoke.mjs`: exit 0.
- From-zero smoke (`SMOKE_PORT=9124`, `WRANGLER_SEND_METRICS=false`): `About to apply 67 migration(s)`, `SMOKE PASS`, ` 500 ` lines: 0, exit 0.
- Dash audit: 0 on every file below (U+2014 and U+2013).
- No token value in the migration, the source, the tests, or the smoke.

## Deploy

Not deployed from this session. The Scribe gates the report, folds the row, and hands the three-step block.

## Sealed final check

```
npx tsc --noEmit                      exit 0
npx vitest run                        44 files, 789 tests passed
TZ=America/New_York npx vitest run    44 files, 789 tests passed
node --check scripts/smoke.mjs        exit 0
rm -rf .smoke-persist && SMOKE_PORT=9124 WRANGLER_SEND_METRICS=false npm run smoke
                                      About to apply 67 migration(s); SMOKE PASS; " 500 " lines: 0; exit 0

app/migrations/0067_cure_panes.sql        1087  384554a578643966
app/src/cure.ts                          15710  5001f74f69b9a931
app/src/service.ts                        3236  724db8c72e9b2aff
app/src/index.ts                        120789  7f425a8ccf120fd6
app/src/console.ts                       69622  4a685d7763237c2a
app/src/config.ts                        58069  84f6a04232ae2834
app/src/theme.ts                        151096  201beb578d761047
app/src/i18n.ts                         140142  eed938b630600cd9
app/test/cure.test.ts                     9411  5f0ecaca7ea03143
app/test/service.test.ts                  8794  64f1bee33221ca22
app/scripts/smoke.mjs                   513553  09b15689bb9e20bc
```
