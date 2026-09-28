# 2026-09-27 The gate on the fix to the environment flags (canon 0.30.265): PASSED

Scribe session. The re-gate of brief Q, THE ENVIRONMENT FLAGS (canon 0.30.246; migration 0077), on his Code session's `SESSION_REPORTS/2026-09-27_the_environment_flags_fix.md`, the fix the first gate held for (`SESSION_REPORTS/2026-09-27_gate_the_environment_flags.md`, canon 0.30.264). The report says "Not deployed. Nothing committed."; nothing was deployed before this gate. No Scribe change to `app/`. His hand-back, verbatim in part: "The three holds from the environment-flags gate are fixed in `app/`. Migration `0077` is unchanged. Nothing was committed or deployed."

VERDICT: PASSED. Every gate passes, each of the three findings reads as fixed with a test on it, and 0077 is byte for byte the file the first gate rehearsed on the floor's newest snapshot. The deploy is his: the three-step block with a pre snapshot, at the end; then the four things only his hands can do before a flag can show.

## What was gated

1. The tree came over as one tarball. It hashed identical on both sides: 227 files, listing sha256 85f43019d7a697e2. Against the held tree (b85521e83696e2fe, the first gate) exactly the report's six sealed files changed; against the live tree (28922204aa90ef05, worker a2d79a84) the same sixteen files as the first gate, no more, the other ten at their first-gate hashes. `migrations/0077_environment.sql` is unchanged: 2582 bytes, sha256 9a8d474fc2bd30d3, the file rehearsed at 0.30.264 (the floor's one reading through the rename rebuild, humidity nullable, both indexes, the five tables, the stale key 60). The seal covers every changed file (G-10).
2. The six files match the seal byte for byte (size, sha256 and tail). No dash and no CR byte in any of the 205 files under `src`, `test`, `migrations` and `scripts/smoke.mjs`, nor in the fix report.
3. F1, THE RANGE LOG READS ONE BOUND, fixed: `saveEnvironmentRange` reads the live row's `temp_low`, `temp_high`, `humidity_low` and `humidity_high` and writes one `insertLog` row per bound with that bound's old value (null on a first save) and its new value, under the one reason; the shape `saveSensorBinding` uses. The test saves a high alone and reads four rows (three null to null, `temp_high` null to 100), then saves all four and reads `temp_high` 100 to 110 with the three others null to their values; the smoke's D1 after the walk holds four rows per range save, the plenum's high and the freezer's high with their three blanks.
4. F2, THE CURE PANES' FLAG SPEAKS ENGLISH ONLY, fixed: `listCurePanes` takes the shell locale (English when omitted) and hands it to `listEnvironmentFlags`; its three callers (the Harvest Console, the silo strip helper, the drying scheduling page) pass `s.locale`, and no other caller exists. The test reads a CSA room reading of 104.2 F against a high of 100 through a Spanish shell as `Sala 104.2 F, sobre 100 F` on the pane, red.
5. F3, A FAILED RE-READ WEARS THE PULL'S CLOTHES, fixed: `refreshSensorCatalog` no longer writes `environment_pulls` when it fails; it returns the code, and `/admin/environment/refresh` redirects to `?ok=refused&n=<code>`, which the page words as `Re-read refused: HTTP {n}` in a `banner warn` (`data-env-refused`), escaped, in English and Spanish. Only the five-minute pull writes `environment_pulls`, so the Last pull line reads the cron alone. The test refuses a Re-read with a 429 and reads the pulls count unchanged and both flashes.
6. Nothing else moved: the pull, the bindings, the flags, the strip, `live.json`, the Drying line, the door, the smoke walk and `wrangler.toml` stand as gated at 0.30.264.

## Observations for his word (no hold)

- A range save logs all four bounds every time, changed or not (as the binding save logs both of its fields); a reader of the log sees the reason on every bound, which is the point.
- The observations of 0.30.264 stand: one `/samples` call per poll with one start; the renewal before twelve hours coded, not tested; `scripts/db-snapshot.mjs` carries `sensorpush_auth` into `db_backups` (tokens that die within a day, never the password); the flags computed twice on pages with the strip and the panes; a re-saved binding resets `bound_at`.

## Gates on the tree as received (the Scribe's sandbox)

- `npx tsc --noEmit`: exit 0.
- `npx vitest run`: 62 files, 937 tests passed; the same under `TZ=America/New_York`.
- `node --check scripts/smoke.mjs`: ok.
- From-zero smoke (`SMOKE_PORT=9186`): `About to apply 77 migration(s)`, `SMOKE PASS`, no ` 500 ` line; the dev server ended by the timeout after the pass.
- Dash audit: 0, and no CR byte, on the 205 files under `src`, `test`, `migrations` and `scripts/smoke.mjs`, and on the fix report.
- Secret grep (`METRC_INTEGRATOR_KEY = "`, `METRC_USER_KEY = "`, `MS_CLIENT_SECRET = "`, `SENSORPUSH_PASSWORD = "`, `cfas[t]_`): no matches under `src`, `test`, `scripts`, `migrations` or `wrangler.toml`.
- The smoke's D1 after the walk: 77 migrations; the plenum and the freezer ranges with four log rows each; two pulls of one sample; the four readings of the first gate.

## Deploy (his hands; migration 0077 rides, so the snapshot, the probe and the apply lead)

```powershell
cd "C:\Users\DennisWallace\Documents\Claude\Projects\gripfactory Practical\app"
node scripts/db-snapshot.mjs pre_environment_flags
npx wrangler d1 execute gripfactory-lite-grip-20260914 --env grip --remote --command "SELECT 1"
npx wrangler d1 migrations apply gripfactory-lite-grip-20260914 --env grip --remote
npm run deploy:grip
```

The apply asks once; answer y. One 7403 on the probe is the blip: run it again. His paste back: the apply's last lines and the Version ID. THE PROBE after: Admin, Environment opens behind the PIN with `No pull yet.`, an empty sensor list and the stale window at 60; the silo strip and `/silos/live.json` carry a `flags` field, empty; the cure panes read as before.

## His hands, before a flag can show (the brief's list)

1. Log into the SensorPush Gateway Cloud dashboard and accept the API terms; better, a user of GripFactory Lite's own on the account, so its polls never crowd Silo Ops'.
2. At his keyboard, never in chat: `npx wrangler secret put SENSORPUSH_EMAIL --env grip` and `npx wrangler secret put SENSORPUSH_PASSWORD --env grip`. The five-minute cron starts pulling on its own once both exist.
3. Admin, Environment: Re-read sensors, bind each to its space and role, enter the bounds per space and role. An unbound sensor is never pulled.
4. The freezer: one SensorPush unit inside it for a day first; if its readings do not arrive, the PLC's temperature reaches the door through a small bridge on the farm network, a slice of its own once the PLC's make, model and network connection are known.

## Sealed final check

```
npx tsc --noEmit                      exit 0
npx vitest run                        62 files, 937 tests passed
TZ=America/New_York npx vitest run    62 files, 937 tests passed
node --check scripts/smoke.mjs        ok
rm -rf .smoke-persist && CI=1 SMOKE_PORT=9186 WRANGLER_SEND_METRICS=false npm run smoke
                                      About to apply 77 migration(s); SMOKE PASS; " 500 " lines: 0
the fix report's seal (6 files) verified byte for byte, device and sandbox:
src/cure.ts                                    17694  0f5bf179820d4180
src/environment.ts                             23191  3dd3fa461d9599f9
src/i18n.ts                                   179666  c0b0a42afe11f968
src/index.ts                                  142800  b9097e2dabd4f92c
src/sensorpush.ts                              10166  344a3b356eb1235f
test/environment.test.ts                       10469  8900e1596148006a
migrations/0077_environment.sql unchanged       2582  9a8d474fc2bd30d3 (rehearsed at 0.30.264)
changed against the held tree, not in the seal: none
changed against the live tree: the first gate's sixteen, no more
tree listing, device and sandbox: 227 files, sha256 85f43019d7a697e2 (held: b85521e83696e2fe; live: 28922204aa90ef05)
the fix report: SESSION_REPORTS/2026-09-27_the_environment_flags_fix.md  2883  9cb35a2dbf4081fe
dash audit: 0; CR audit: 0; secret grep: no matches
```
