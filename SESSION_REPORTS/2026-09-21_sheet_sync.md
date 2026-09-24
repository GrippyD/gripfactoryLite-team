# 2026-09-21 The Sheet Sync (canon 0.30.162)

Build session under THE DISPATCH RULE (canon 0.30.155), brief `BRIEFS/2026-09-21_sheet_sync.md`. Migration `0066`. From-zero smoke pin is 66. Not deployed. The Scribe gates this report, folds canon, and hands the owner the blocks.

Owner, 2026-09-21, verbatim: "on that topic, can we setup a cron job or something to regularly check the sheet?  It's not going anywhere."

His picks: the lane, "The worker pulls the sheet on its own cron"; the cadence, "Every hour"; a row that reads like a season total, "Take it as typed"; the Graph app registration, "I can, with your steps".

## The law, as built

1. THE SOURCE. On the grip env, Microsoft Graph with client credentials. `MS_TENANT_ID` and `MS_CLIENT_ID` are vars under `[env.grip.vars]`, written as `"TBD"` for the owner to fill. `MS_CLIENT_SECRET` is not in any file; it is a wrangler secret. The drive id, item id, and tab name are `app_config` keys `sheet_drive_id`, `sheet_item_id`, and `sheet_labor_tab`, seeded by migration 0066 (the ids from the brief, and `Labor`). Token: `POST https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token` with `grant_type=client_credentials` and `scope=https://graph.microsoft.com/.default`. Metadata first (`id,name,cTag,eTag,lastModifiedDateTime,size,webUrl`). When that `cTag` equals the newest ok or skipped run's `cTag`, the run records `skipped` and downloads nothing. Otherwise `GET .../content` (fetch follows the 302). The default env has no `MS_*` var. There the sync reads `SHEET_FIXTURE_URL` when set, and records `failed` with `no source configured` otherwise. A fixture URL is never read when `MS_TENANT_ID` is set, including while it still says `TBD`.
2. THE READER. `src/sheetsync.ts` reads the zip with no dependency: end-of-central-directory `0x06054b50` from the tail, central directory `0x02014b50`, local header `0x04034b50` (name and extra lengths honored). Method 0 is stored. Method 8 is inflated with `DecompressionStream("deflate-raw")`. Only `xl/workbook.xml`, `xl/_rels/workbook.xml.rels`, `xl/sharedStrings.xml`, and the Labor part are read. The part is resolved by name every run. A Target may be absolute `/xl/...` or relative to `xl/`. The sheet XML is parsed without DOMParser. Header row 3 must read `DATE`, `HARV FARM`, and `CUT/BCK # HRS` in C, D, and I, or the run fails in words. Column C is a 1900-system serial (`1899-12-30` plus the integer part; `date1904` is not read), including behind `<f t="array">` or `<f t="shared">`; the cached `<v>` rules. Column D is the farm (`t="str"`, `t="s"`, or `t="inlineStr"`), trimmed and uppercased. Column I is the hours number in `<v>`; a cell with no `<v>` is blank; `<f>` is ignored.
3. THE LANDING. A row lands when it has a real date, a farm in ARL, PNN, or PNS, and a numeric hours cell, and the date is not after the farm's today (`farmToday`, canon 0.30.151). Anything else is skipped. A blank never deletes. There is no cap: 2753 lands as typed. Upsert `harvest_labor_hours (farm_code, work_date)`: insert where missing (change log, old NULL, new hours), update where the stored hours differ (old and new logged), nothing where equal. Hours rounded to two decimals. `actor_person_id` and `created_by` are NULL. The reason is `SYSTEM_REASON.sheet_sync` = `hours from the sheet (sync)`. Every write of one run is one `db.batch` (the hour statements, the run row, the last-metadata upserts, and the prune).
4. THE RUN RECORD. `sheet_sync_runs` as specified, index on `started_at`. `rows_landed` is inserts, `rows_changed` is updates, `rows_skipped` is every row that did not land. `message` on `failed` is the status and a short body. A token, the client secret, and the request URL are not stored (a content redirect can carry a temporary token). The last 500 runs are kept.
5. THE CRON. `[env.grip.triggers] crons = ["15 * * * *"]`. The default and c10 envs have no cron. `src/index.ts` exports `{ fetch: app.fetch, scheduled }`. `scheduled` does `ctx.waitUntil(runSheetSync(env, "cron"))` and also awaits that promise, so a dev `/__scheduled` response means the run has finished. The cron is not a request. THE SERVICE ACTOR (0.30.140) is untouched.
6. THE FACE. Admin has a `[Sheet sync]` tile to `/admin/sheet-sync` (the Admin PIN, like the rest): the last ten runs, the sheet name and web URL from the last metadata, and `Run now` (`POST /admin/sheet-sync/run`, trigger `admin`, redirect `?ok=ran`, flash in words). Under the console's sheet hours line: `read from the sheet at <Eastern time> (<n> rows, <m> changed)` after `ok` (n is rows seen, m is rows changed), `sheet unchanged since <time>` after `skipped`, `sheet read failed at <time>: <message>` after `failed`, `sheet never read` before any run. `data-hc-sheet-sync="ok|skipped|failed|never"`. The Plants note and the Trimming footnote say the sheet is the source and replaces a typed number at the next hour.
7. STRINGS. Everything shown goes through `src/i18n.ts` (EN and ES).

The smoke fixture is a synthetic Labor workbook (ARL 12.5, PNN 8.25, PNS 4 on yesterday; PNN 2753 on the day before; a future row, a non-farm, a blank farm, and a blank hours cell). It is served at `/__sheet-fixture` only when `SHEET_FIXTURE_URL` is set and `MS_TENANT_ID` is not. `?meta=1` is the metadata. Never the owner's file, never a name.

## What changed

- `migrations/0066_sheet_sync.sql`: the table, the index, the three `app_config` seeds. The header comment carries his words.
- `wrangler.toml`: `MS_TENANT_ID = "TBD"` and `MS_CLIENT_ID = "TBD"` under `[env.grip.vars]`; `[env.grip.triggers] crons = ["15 * * * *"]`. Nothing added on the default or c10 env.
- `src/sheetsync.ts` (new): Graph token and download, the zip reader, `parseLaborRows`, `landHours`, `runSheetSync`, `sheetSyncStatusLine`, the Admin page, the fixture workbook.
- `src/config.ts`: `CONFIG_KEYS.sheet_drive_id`, `sheet_item_id`, `sheet_labor_tab`, plus `sheet_last_name` and `sheet_last_web_url` (see assumptions); `SYSTEM_REASON.sheet_sync`; `ADMIN_SHEET_SYNC_PATH`.
- `src/index.ts`: `Env` gains the four optional fields; the fixture route; the Admin page and `Run now`; `export default { fetch: app.fetch, scheduled }` and a named `app` export.
- `src/console.ts`: `loadHarvestConsole` reads the last run; `trimSheetHoursLine` renders the second line.
- `src/html.ts`: the `[Sheet sync]` tile.
- `src/i18n.ts`: the strings, EN and ES.
- `test/sheetsync.test.ts` (new): store and deflate zip readers; the Labor shapes and the date arithmetic (46223 is 2026-07-20, 46284 is 2026-09-19); a moved column; the landing rules; ok, skipped, and a Graph 401 whose message carries no token; the fixture refused when `MS_TENANT_ID` is set; the console line in four states, EN and ES.
- `test/console.test.ts`: the sheet hours line with and without a last run.
- `test/walk.test.ts`, `test/imports.test.ts`, `test/service.test.ts`, `test/business_ops.test.ts`: import the named `app` now that the default export is the worker.
- `test/node-zlib.d.ts` and `tsconfig.json`: an ambient `node:zlib` so the deflate test can call `deflateRawSync` (this repo does not load `@types/node`).
- `scripts/smoke.mjs`: pin 66; `wrangler dev --test-scheduled --var SHEET_FIXTURE_URL:http://127.0.0.1:<port>/__sheet-fixture`; the scheduled walk, the landed hours, the skip, and the Run now flash.

## Assumptions for the owner's word

- The parenthetical on the console line is rows seen and rows changed. Inserts are `rows_landed` on the Admin page.
- The sheet name and web URL from the last metadata are kept in `app_config` `sheet_last_name` and `sheet_last_web_url`, written by a run, so the page does not call Graph just to render. They are editable in Lookups, app_config, like the three seeded keys.
- While `MS_TENANT_ID` is still `TBD`, the grip cron calls Graph and records `failed`. It does not fall back to a fixture.
- Every parsed row that does not land is skipped: no real date, blank hours, blank farm, a farm outside ARL/PNN/PNS, or a date after the farm's today. A blank never deletes. A numeric cell is taken as typed, including a large number and including zero.
- The header check is the trimmed text of columns C, D, and I on row 3.
- `date1904` is not read. The serial is `1899-12-30` plus the integer part.
- "Unchanged" compares the cTag to the newest `ok` or `skipped` run that stored one.
- Times are Eastern, 12-hour, labeled ET.
- `scheduled` awaits the run as well as registering it with `waitUntil`. The cron is still not a request.
- A failed message is the status and a short body, never the request URL. A bearer token or the client secret in a body is replaced before it is stored.
- A missing `sheet_labor_tab` falls back to `Labor`.
- The footnote stands on the Plants section (where the hours boxes are) and on the Trimming section (where the sheet line is).
- The Spanish status word `skipped` uses the dictionary entry that was already there (`omitidos`). The flash is a full sentence (`The sheet was unchanged.` / `La hoja no cambio.`).

The Labor columns named for a later ruling (trim input pounds, trim hours, cryo, prepack) are not read.

## Gates

- `npx tsc --noEmit`: exit 0.
- `npx vitest run`: 43 files, 781 tests passed. The same under `TZ=America/New_York`.
- `node --check scripts/smoke.mjs`: exit 0.
- From-zero smoke (`SMOKE_PORT=9106`, `WRANGLER_SEND_METRICS=false`): `About to apply 66 migration(s)`, `SMOKE PASS`, ` 500 ` lines: 0, exit 0 (about 80 seconds, so the 285 second timeout was not needed).
- Dash audit: 0 on every file below (U+2014 and U+2013).
- `cfast_` and `MS_CLIENT_SECRET = "` : no matches under `src`, `wrangler.toml`, `test`, `scripts`.

## Deploy

Not deployed from this session. The Scribe gates the report, folds the row, and hands the blocks (the Entra steps in the brief, then the toml ids, the secret at the wrangler prompt, the three-step block with migration 0066, then Admin, Sheet sync, Run now).

## Sealed final check

```
npx tsc --noEmit                      exit 0
npx vitest run                        43 files, 781 tests passed
TZ=America/New_York npx vitest run    43 files, 781 tests passed
node --check scripts/smoke.mjs        exit 0
rm -rf .smoke-persist && SMOKE_PORT=9106 WRANGLER_SEND_METRICS=false npm run smoke
                                      About to apply 66 migration(s); SMOKE PASS; " 500 " lines: 0; exit 0

migrations/0066_sheet_sync.sql           1817  fbf1e985ec0b4edf
wrangler.toml                            2379  8011067df23e65f0
src/sheetsync.ts                        37127  1694ca2d30bf204e
src/config.ts                           54788  460740480429b5b3
src/console.ts                          66618  d96ba8ecccdd65e7
src/i18n.ts                            135878  373fb84b19c3f2c2
src/html.ts                            175254  a4b17759950c8773
src/index.ts                           119892  366e4dd4b2a468cf
test/sheetsync.test.ts                  21515  c33ee29658a46f96
test/console.test.ts                    40699  e077f174df4d0c4a
test/node-zlib.d.ts                        95  077c3838db5dcb40
test/walk.test.ts                       44329  e57a786497012f88
test/imports.test.ts                    11736  93c1b966053f4d7a
test/service.test.ts                     7871  e0e35ab9ae5d96a3
test/business_ops.test.ts               37465  848aa7c472b9738e
scripts/smoke.mjs                      508787  c8ea0baeb82b3dd7
tsconfig.json                             443  7eae264bafadf130
dash audit: 0 on every file above
secret grep: no matches
```
