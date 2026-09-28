# 2026-09-27 The gate on the environment flags (canon 0.30.264): HELD for one small fix

Scribe session. The gate on his Code session's `SESSION_REPORTS/2026-09-27_the_environment_flags.md` (brief Q, THE ENVIRONMENT FLAGS, canon 0.30.246; migration 0077). The report says "Not deployed. Nothing committed."; nothing was deployed before this gate. No Scribe change to `app/`. His hand-back, verbatim in part: "Environment flags are in `app/`, and the report is `SESSION_REPORTS/2026-09-27_the_environment_flags.md`. Nothing was committed or deployed. Migration `0077` adds the sensor bindings, the ranges, and the token row, and makes humidity optional."

VERDICT: HELD, for one small fix. Every gate passes, the law reads as briefed on all eight points, and a rehearsal of 0077 on the floor's newest snapshot rebuilds `sensor_readings` with its one row intact. What holds it: a range save writes one change log row, field `temp_high`, with the old value always null, so a change to the low temperature or either humidity bound leaves no log row and the old high is never recorded; law 3 has the ranges "edited on the same page with reasons logged", and the binding save in the same file logs both of its fields with their old values. With that edit ride two lesser findings, each a few lines. The fix goes back to his Code session (the paste at the end); the gate re-runs on the fix, and the deploy, the three-step path since 0077 rides, comes with that gate.

## What was gated

1. The tree came over as one tarball. It hashed identical on both sides: 227 files, listing sha256 b85521e83696e2fe. Against the live tree (28922204aa90ef05, worker a2d79a84) exactly the report's sixteen sealed files changed, four new (`migrations/0077_environment.sql`, `src/environment.ts`, `src/sensorpush.ts`, `test/environment.test.ts`); `package.json` and `tsconfig.json` did not move; `wrangler.toml` moved as the brief allows (the second cron and the base URL var, nothing else). The seal covers every changed file (G-10). One file sits in `app/` outside the listing and the seal: `wrangler.toml.bak-20260911-164020`, a copy of the pre-Testing-Desk `wrangler.toml` with the retired D1 id; git-ignored (`.gitignore` line 33), read by nothing, inert to the deploy.
2. The sixteen files match the seal byte for byte (size, sha256 and tail). No dash and no CR byte in any of the 205 files under `src`, `test`, `migrations` and `scripts/smoke.mjs`, nor in the build report.
3. Read against brief Q's eight laws. THE PULL: `wrangler.toml` carries `crons = ["15 * * * *", "*/5 * * * *"]` under `env.grip` and `SENSORPUSH_API_BASE` as a var, the default env and c10 untouched; `scheduled` in `src/index.ts` reads `event.cron` and runs `pullSensorPush` when it starts with `*/5`, the sheet, the sweep and In Testing otherwise; `pullSensorPush` returns skipped with no call unless both secrets are set, authorizes (24 h) and takes an access token (12 h) into `sensorpush_auth` row `current`, renewing thirty minutes before the twelve hours, asks `/samples` once for every bound sensor since the newest stored reading, keeps the newest sample per sensor, refuses a second row for the same (sensor, observed) both in code and by the partial unique index, and on a 429, a 401, any 4xx or 5xx or a thrown fetch writes one `environment_pulls` row (time, count 0, `HTTP n`) and returns; no loop. THE BINDINGS: `/admin/environment` under the `/admin/*` PIN gate lists `sensor_catalog` (name, id, battery, newest reading), a space select of every live `dry_spaces` name plus the cure rooms, a role select of room, bed, plenum, exhaust, a reason, and two log rows per save (`space_name`, `role`, old and new); Re-read posts to `/refresh`, which reads `/devices/sensors` into the catalog; the pull's own query takes only live bindings with a space and a role. THE RANGES: per space and role, four optional bounds, blank unchecked, a reason required; `environment_stale_minutes` seeded 60 by 0077 and edited on the page with its log row. THE FLAG: `environmentFlagLines` reads stale first (no reading, a reading from before `bound_at`, or older than the window), then each set bound, and words them as the brief's examples (`Plenum 104.2 F, above 100 F`, `Room humidity 71 %, above 62 %`, `Bed no reading for 1 h 40 m`). WHERE OPERATORS SEE IT: `siloTile` draws a `.silo-flags` line under the name on the silo and the freezer branches, `.silo-flags` in `var(--danger)`; `siloLiveEntry` adds `flags` after the fields it had, none changed, and the strip's refresh script paints it; the Harvest Console, the silo strip helper, Load Silo and the drying scheduling page all pass the flags; `menuLineMarkup` writes the flag after the status and its clock; `paneCard` adds the room's flags to the conditions line and turns it `cure-stale` red when out as when stale. THE FREEZER, EITHER WAY: 0077 rebuilds `sensor_readings` with `humidity_pct` nullable and `sensor_id`, `role` added; the door's room list is the cure rooms plus every live dry space, matched without case; a reading with no humidity is stored, one with humidity is still held to 0 to 100 and the temperature to `TEMP_MIN` -40 to `TEMP_MAX` 200; the flags read a space's newest door reading as its room reading where no bound room sensor has a fresher one. NOTHING ELSE MOVES: the door's token and path, the cure panes' reading of `sensor_readings`, the hourly jobs, every clock, load and unload law, the migrations before 0077, `package.json`; nothing reads or writes Silo Ops.
4. THE TESTS: `test/environment.test.ts` (new) words an out, a humidity break, a low, a stale by age, a stale since the bind, an in, and a temperature-only freezer break; the pull with no secrets makes no call; the first pull calls authorize, accesstoken and samples, stores the newer of two samples once with its room, role and source, and keeps the token; the second pull calls samples alone and stores nothing new; a 429 records `HTTP 429` and stores nothing; a binding and a range save and render in English and Spanish; `siloLiveEntry` carries the flags with the old fields; the catalog refresh files a sensor. `test/silo.test.ts` follows the entry's new field. The smoke opens Admin, Environment, re-reads the fixture list, binds `sp-silo3` to Silo 3 as plenum, sets a high of 100, fires the five-minute cron through `/__scheduled`, sees `Plenum 104.2 F, above 100 F` on the Drying Operations strip and in `/silos/live.json` with `state` and `wetGrams` still present, fires it again for an in-range 70 and sees the flag clear, posts a temperature-only 20 F for Blast Freezer(s) to the door, sets its high at 10 and sees `Room 20 F, above 10 F` on the freezer's tile.
5. THE SMOKE'S D1 after the walk: 77 migrations; one catalog row; one live binding; two live ranges; four readings (the cure pane's door test, the pull's 104.2 and 70 on Silo 3 with sensor and role, the freezer's 20 with humidity null); two pull rows, count 1 each, no error; one `sensorpush_auth` row with both tokens; `environment_stale_minutes` 60; the log rows exactly as the finding says: two for the binding, one `temp_high` row for each of the two range saves.
6. THE REHEARSAL of 0077 on the floor's newest snapshot (`20260926-223209_pre_harvest_file_per_load`): a database built from 0001 to 0076, the snapshot's `sensor_readings` (one row, the 2026-09-22 test reading) and `app_config` loaded, 0077 applied: the row survives unchanged; `humidity_pct` nullable; `sensor_id` and `role` present; the old index recreated and the new partial unique index beside it; the five new tables; the stale key seeded 60; no `__0077` table left; a temperature-only row accepted; a second (sensor, observed) refused; two door rows on the same second, no sensor id, both accepted. The rename rebuild is the shape 0070 and 0073 already took on the remote; nothing references `sensor_readings` by foreign key.

## The fix

- F1, THE RANGE LOG READS ONE BOUND (low, and it holds the tree): `saveEnvironmentRange` in `src/environment.ts` writes one `insertLog` row, field `temp_high`, `old_value` null, `new_value` the high. A save that changes `temp_low`, `humidity_low` or `humidity_high` leaves no log row, and the old high is never recorded; the smoke's D1 shows it (two range saves, two `temp_high` rows, old null). Law 3 has the ranges edited "with reasons logged"; `saveSensorBinding` just above it logs `space_name` and `role` with their old values. The fix: read the existing row's four bounds and log one row per bound, old and new (as the binding does), under the one reason.
- F2, THE CURE PANES' FLAG SPEAKS ENGLISH ONLY (low): `listCurePanes` in `src/cure.ts` calls `listEnvironmentFlags(db, nowIso)` without the locale, so a Spanish shell reads the pane's flag in English while the strip and the Drying line read it in Spanish. The fix: carry the locale into `listCurePanes` (its callers have `s.locale`) or word the pane's flags where the pane is drawn.
- F3, A FAILED RE-READ WEARS THE PULL'S CLOTHES (low): `refreshSensorCatalog` writes an `environment_pulls` row when it fails and none when it succeeds, so after a Re-read refused by the one-request-per-minute limit the Admin page's `Last pull` line shows the button's `HTTP 429` as if the cron had failed, until the next cron overwrites it. The fix: carry the Re-read's result back to the page as its own flash (`?ok=refused`, say, with the code) and leave `environment_pulls` to the pull.

## Observations for his word (no hold)

- One `/samples` call per poll with one `startTime`, the newest stored reading across the bound sensors. One call is the right shape for SensorPush's one request per minute; a sensor whose newest stored reading trails the others has any sample older than that shared start skipped, and reads stale until it reports again, which it would have anyway.
- The renewal thirty minutes before the twelve hours is coded and read; the test covers the token kept on the second pull, not the renewal. A first pull makes three requests in a second (authorize, accesstoken, samples); if SensorPush counts that against its minute, the pull records the 429 and the next cron carries it, so nothing is lost.
- `scripts/db-snapshot.mjs` dumps every table, so a snapshot after this deploy carries `sensorpush_auth` (a 24-hour authorization and a 12-hour access token; never the password, which is a wrangler secret) into `db_backups` on his disk, git-ignored. The app's pages, exports and logs do not read the table (`ALLOWED_TABLES` in `src/db.ts` excludes it, so `/record` cannot open it). His word whether the snapshot script should skip it.
- The pages that carry the strip and the cure panes compute the flags twice per request (once for the strip, once inside `listCurePanes`): ten small queries, not five.
- Saving a binding again, even unchanged, resets `bound_at`, so that sensor reads stale until the next pull, five minutes at most.
- A door reading for a space with no range for its room role flags nothing, by design: nothing set, nothing checked.

## His word: the report's seven assumptions

They stand as the report states them: the four roles room, bed, plenum and exhaust; the newest sample per sensor per poll, not every sample; the pull every five minutes with the sheet, the mirror and In Testing on the quarter hour; the stale window at 60 minutes; the token as the row `current` in `sensorpush_auth`, shown, exported and logged nowhere; a reading from before the bind not counting; a door reading with no role read as the room's.

## Gates on the tree as received (the Scribe's sandbox)

- `npx tsc --noEmit`: exit 0.
- `npx vitest run`: 62 files, 936 tests passed; the same under `TZ=America/New_York`.
- `node --check scripts/smoke.mjs`: ok.
- From-zero smoke (`SMOKE_PORT=9184`): `About to apply 77 migration(s)`, `SMOKE PASS`, no ` 500 ` line; the dev server ended by the timeout after the pass.
- Dash audit: 0, and no CR byte, on the 205 files under `src`, `test`, `migrations` and `scripts/smoke.mjs`, and on the build report.
- Secret grep (`METRC_INTEGRATOR_KEY = "`, `METRC_USER_KEY = "`, `MS_CLIENT_SECRET = "`, `SENSORPUSH_PASSWORD = "`, `cfas[t]_`): no matches under `src`, `test`, `scripts`, `migrations` or `wrangler.toml`. The smoke's fixture email and password ride the `wrangler dev` command line, not a file.
- Rehearsal of 0077 on the newest snapshot: as item 6 above.

## The fix, for his Code session

```
Read canon/_NOW.md, then SESSION_REPORTS/2026-09-27_gate_the_environment_flags.md, and fix what it names in app/ under THE DISPATCH RULE (canon 0.30.155): F1 (saveEnvironmentRange logs one row per bound, temp_low, temp_high, humidity_low and humidity_high, each with its old value from the existing row and its new value, under the one reason, as saveSensorBinding logs its two fields), F2 (the cure panes' flag lines are worded in the shell's locale: carry the locale into listCurePanes or word the flags where the pane is drawn), F3 (a Re-read's failure comes back to Admin, Environment as its own flash with the HTTP code and writes no environment_pulls row; the Last pull line reads the cron's pulls alone). Tests beside them. Migration 0077 does not change. Nothing else moves. Write SESSION_REPORTS/2026-09-27_the_environment_flags_fix.md with the sealed final check. Commit nothing, push nothing, deploy nothing.
```

## Sealed final check

```
npx tsc --noEmit                      exit 0
npx vitest run                        62 files, 936 tests passed
TZ=America/New_York npx vitest run    62 files, 936 tests passed
node --check scripts/smoke.mjs        ok
rm -rf .smoke-persist && CI=1 SMOKE_PORT=9184 WRANGLER_SEND_METRICS=false npm run smoke
                                      About to apply 77 migration(s); SMOKE PASS; " 500 " lines: 0
the build report's seal (16 files) verified byte for byte, device and sandbox:
migrations/0077_environment.sql                 2582  9a8d474fc2bd30d3
scripts/smoke.mjs                             614719  6c43d8e71f2577dd
src/config.ts                                  70769  1d5e7748d9323b95
src/console.ts                                102821  9d9bb731f1bedc97
src/cure.ts                                    17663  a4b24e09088a9be6
src/drying.ts                                  34889  2eb7127e04d4f0b7
src/environment.ts                             22480  b706797aadd33f34
src/html.ts                                   192489  9d949693fd54d7e4
src/i18n.ts                                   179561  95112d7ae80aeb7f
src/index.ts                                  142551  27bf4122f1c7dd02
src/sensorpush.ts                              10209  f22dd712ff1c172f
src/silo.ts                                    37445  2d872f9fe3012a23
src/theme.ts                                  156963  656f989970bdb37c
test/environment.test.ts                        7362  5f6c7683d6ddbfe7
test/silo.test.ts                              29251  7b402d5806bd9633
wrangler.toml                                   2903  82e5cd2b1d151583
changed against the live tree, not in the seal: none (wrangler.toml.bak-20260911-164020 is outside the listing, git-ignored)
tree listing, device and sandbox: 227 files, sha256 b85521e83696e2fe (live: 28922204aa90ef05)
the build report: SESSION_REPORTS/2026-09-27_the_environment_flags.md  4841  5c7d0d40f39b6cb4
rehearsal of 0077 on 20260926-223209_pre_harvest_file_per_load: 1 row in, 1 row out unchanged; humidity nullable; both indexes; stale 60
dash audit: 0; CR audit: 0; secret grep: no matches
```
