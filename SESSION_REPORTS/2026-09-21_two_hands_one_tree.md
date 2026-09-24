# 2026-09-21 Two Hands in One Tree (canon 0.30.165): the clobber, the repair, and the sheet sync gated

Scribe session. Two things in one report because they are one event: the gating of THE SHEET SYNC build (canon 0.30.162, his Code session's report `SESSION_REPORTS/2026-09-21_sheet_sync.md`, sealed 19:16), and the repair of the Scribe's own mistake that broke the deploy at 21:17.

## What happened

1. 19:04 to 19:16: the owner's Claude Code session built THE SHEET SYNC in `app/` under THE DISPATCH RULE and sealed its report: migration `0066_sheet_sync.sql`, `wrangler.toml` (the two `TBD` vars and the cron under env.grip), `src/sheetsync.ts` (new), edits to `src/config.ts`, `src/console.ts`, `src/i18n.ts`, `src/html.ts`, `src/index.ts`, `tsconfig.json`, six test files and `scripts/smoke.mjs`. The report was not handed to the Scribe in chat; it sat on disk.
2. 20:56: the Scribe, building THE LINE RUNS ON THE CLOCK (canon 0.30.163) Scribe-direct on sandbox copies taken before the build session began, committed `src/config.ts`, `src/console.ts`, `src/farmday.ts`, `src/i18n.ts`, `test/console.test.ts`, `test/farmday.test.ts` and `scripts/smoke.mjs` to the device with `force: true`. Five of those seven files had been changed by the build session in the meantime; the force overwrote its edits. The other twelve files of its seal were untouched and still match it byte for byte.
3. 21:17: `npm run deploy:grip` failed in the bundle: `src/html.ts`, `src/index.ts` and `src/sheetsync.ts` import `ADMIN_SHEET_SYNC_PATH` from `src/config.ts`, and the Scribe's `config.ts` never had it. Nothing was deployed; LIVE stayed at worker 4da7640c.

## The repair

The build session's versions of the five clobbered files were not on disk any more and the repo has no commits since 0.7.3, but its from-zero smoke had left its bundle at `app/.wrangler/tmp/dev-tXpp59/index.js` (19:14, 1,465,794 bytes). The Scribe bundled its own tree the same way (esbuild, esm, es2022), split both bundles by esbuild's `// src/<file>` markers and diffed module by module. The build session's changes to `config.ts`, `console.ts` and `i18n.ts` came back exactly (strings included; `farmday.ts` it had not touched), and were re-applied by hand onto the Scribe's clock-rule files:

- `src/config.ts`: `SYSTEM_REASON.sheet_sync` (`hours from the sheet (sync)`), `CONFIG_KEYS.sheet_drive_id`, `sheet_item_id`, `sheet_labor_tab`, `sheet_last_name`, `sheet_last_web_url`, `ADMIN_SHEET_SYNC_PATH = "/admin/sheet-sync"`, with the build session's comments.
- `src/console.ts`: the import of `latestSheetSync`, `sheetSyncLineText` and `SheetSyncView`; `HarvestConsoleInput.sheetSync`; the sheet hours line gains `data-hc-sheet-sync="ok|skipped|failed|never"` and the second line `<dd class="hc-sheet-sync muted" data-hc-sheet-sync-line>`; the loader reads `latestSheetSync(db)` with the rest and passes `sheetSync`; the Trimming footnote and the Plants note gain the build session's sentence ("The sheet is the source of the cutting and bucking hours and replaces a typed number at the next hour.") after the Scribe's clock-rule sentence, so both hands speak.
- `src/i18n.ts`: the build session's twenty-four strings (the four status lines, the Admin page words, the flashes, the footnote sentence), EN and ES as it wrote them; the two footnote keys carry both hands' sentences in both languages.
- `test/console.test.ts`: the lost test rewritten from the report's description: the sheet hours line in the four states, EN and ES, with the Eastern stamp, the rows seen and changed, the failure's message, and the footnote sentence.
- `scripts/smoke.mjs`: the pin `About to apply 66 migration(s)`; `wrangler dev --test-scheduled --var SHEET_FIXTURE_URL:http://127.0.0.1:<port>/__sheet-fixture`; the walk rewritten from the report: never read on the console, the Admin tile and the empty page, the cron through `/__scheduled`, the landed hours on the console (ARL 12.5, PNN 8.25, PNS 4 yesterday; PNN 2753 the day before, as typed, his pick), the ok run on the Admin page with 8 rows seen and the fixture's name, no token on the page, the second cron skipping an unchanged sheet, Run now flashing "The sheet was unchanged." with the three runs and their triggers.

The twelve untouched files of the build session's seal were copied into the sandbox and verified against it before any gate ran: `migrations/0066_sheet_sync.sql` fbf1e985ec0b4edf, `wrangler.toml` 8011067df23e65f0, `src/sheetsync.ts` 1694ca2d30bf204e, `src/html.ts` a4b17759950c8773, `src/index.ts` 366e4dd4b2a468cf, `test/sheetsync.test.ts` c33ee29658a46f96, `test/node-zlib.d.ts` 077c3838db5dcb40, `test/walk.test.ts` e57a786497012f88, `test/imports.test.ts` 93c1b966053f4d7a, `test/service.test.ts` e0e35ab9ae5d96a3, `test/business_ops.test.ts` 848aa7c472b9738e, `tsconfig.json` 7eae264bafadf130.

## The law this teaches (folded as canon 0.30.165)

1. The Scribe never commits to `app/` with force. Every commit carries the mtime guard from the staging that preceded it; a refusal means another hand has been in the file, and the Scribe stages, reads and merges before it writes.
2. Before the Scribe commits any file under `app/`, it stages the device's current copy and compares it to the sha it last committed or gated. Drift means a build session has been there: read `SESSION_REPORTS/` for a report newer than the last gated one first, gate it, then merge.
3. One hand in `app/` at a time. While a brief is out to a build session, the Scribe's own Scribe-direct work waits, or is built on a fresh stage of the device tree taken after the build session's report lands, never on copies taken before the brief went out.
4. The clobber's cost: the build session's own tests and smoke steps for the five files are gone; the ones here are the Scribe's rewrite from its report, and the report's description is what they pin.

## Deploy (WITHDRAWN at 21:40, see the postscript; the block below is the shape of the next one, not a block to run)

```powershell
cd "C:\Users\DennisWallace\Documents\Claude\Projects\gripfactory Practical\app"
npx wrangler d1 execute gripfactory-lite-grip-20260914 --env grip --remote --command "SELECT 1"
npx wrangler d1 migrations apply gripfactory-lite-grip-20260914 --env grip --remote
npm run deploy:grip
```

Until the Entra ids and the secret land, the grip cron calls Graph with `TBD` and records `failed` at a quarter past every hour; the console's sheet line says so in words and no hours change. The Entra steps are the owner section of `BRIEFS/2026-09-21_sheet_sync.md`; the ids come to the Scribe for the toml, the secret goes to `npx wrangler secret put MS_CLIENT_SECRET --env grip` alone.

## Gates (the merged tree, in the Scribe's sandbox)

- `npx tsc --noEmit`: exit 0.
- `npx vitest run`: 43 files, 782 tests passed (the build session's 781 plus the rewritten console test); the same under `TZ=America/New_York`.
- `node --check scripts/smoke.mjs`: ok.
- From-zero smoke (`SMOKE_PORT=9069`): `About to apply 66 migration(s)`, `SMOKE PASS`, no 500; the sync walk visible in the log (`/__sheet-fixture` twice then `/__scheduled` for the first run, once each for the skip, `POST /admin/sheet-sync/run` 303).
- Dash audit: 0 on every file below.
- Secret grep (`cfast_`, `MS_CLIENT_SECRET = "`): no matches under `src`, `wrangler.toml`, `test`, `scripts`.

## Sealed final check

```
npx tsc --noEmit                      exit 0
npx vitest run                        43 files, 782 tests passed
TZ=America/New_York npx vitest run    43 files, 782 tests passed
node --check scripts/smoke.mjs        ok
rm -rf .smoke-persist && SMOKE_PORT=9069 WRANGLER_SEND_METRICS=false timeout 285 npm run smoke
                                      About to apply 66 migration(s); SMOKE PASS; " 500 " lines: 0 (exit 124, the timeout's, as always)
the five merged files (both hands):
src/config.ts                          56922  25c95412f9d2d6be
src/console.ts                         69497  a8be09ca32c651bb
src/i18n.ts                           136400  b97328fc5e578a99
test/console.test.ts                   45047  1cafc78d5d62b22b
scripts/smoke.mjs                     511533  bed61c7b1ba84298
the build session's files, unchanged, as its seal lists them:
src/sheetsync.ts                       37127  1694ca2d30bf204e
src/index.ts                          119892  366e4dd4b2a468cf
src/html.ts                           175254  a4b17759950c8773
wrangler.toml                           2379  8011067df23e65f0
migrations/0066_sheet_sync.sql          1817  fbf1e985ec0b4edf
test/sheetsync.test.ts                 21515  c33ee29658a46f96
tsconfig.json                            443  7eae264bafadf130
dash audit: 0 on every file above
secret grep (cfast_, MS_CLIENT_SECRET = "): no matches under src, wrangler.toml, test, scripts
```

## Postscript, 21:40: the guard spoke, and a third hand is in the tree

The commit of the five merged files ran with the mtime guard and no force, and the guard refused three of them: `src/config.ts` (device mtime 21:31:07Z, 57,913 bytes), `src/i18n.ts` (21:33:51Z, 135,457 bytes) and `test/console.test.ts` (21:37:03Z, 42,711 bytes) had changed on the device after the Scribe staged them at 21:19. `src/console.ts` (69,497, a8be09ca32c651bb) and `scripts/smoke.mjs` (511,533, bed61c7b1ba84298) had not changed since the staging and were written at 21:38:48, together with this report. A fresh stage of the three refused files shows the third hand: the owner's Code session is building BRIEF A (THE WHOLE GRAM AND THE 448 POUND) in `app/` right now (`GRAMS_PER_LB = 448`, `metrcQuantity`, `roundGrams` to whole grams, gram pins in `test/console.test.ts` already whole: `500 g`, `25.31 lb/h`), and on its way it re-added the sheet sync's exports to `config.ts` and the sync's strings to `i18n.ts` in its own words (its Spanish differs from the sync build's in three words: `Sincronizacion de hoja`, `Cargadas`, `deshoje`; the four status lines the sync test pins are identical).

So the tree on the device is that session's until its report lands. The Scribe's three refused files stay unwritten (their content is in this report's seal and in the Scribe's sandbox for the merge that follows). What the Scribe did write, that session now inherits: `src/console.ts` carries the clock rule and the sheet sync line (`data-hc-sheet-sync`, the second `<dd>`, the `latestSheetSync` read, the two footnotes with both hands' sentences), and `scripts/smoke.mjs` carries the 66 pin, `--test-scheduled`, the fixture var and the sync walk. Two things that session needs to know: `console.ts` translates its two footnotes through keys that end with the sheet sentence, so `i18n.ts` must carry those merged keys (EN and ES) or the Spanish console falls back to English; and the gram pins in `scripts/smoke.mjs` are still two-decimal, brief A's to move. The Scribe gates that session's report when it lands, together with the sheet sync, folds, and hands one three-step block for everything: the clock rule (0.30.163), the sheet sync (0.30.162, migration 0066), the whole gram and the 448 pound (brief A). Nothing deploys before that.

The law gains a fifth line: before a brief goes out, the Scribe's own hands are out of `app/` (everything it holds committed and gated), and while a build session holds the tree the Scribe's writes to `app/` stop entirely, guard or no guard.
