# 2026-09-24 The gate on the check-all and the collapsible categories (canon 0.30.216)

Scribe session. The gate on his Code session's `SESSION_REPORTS/2026-09-23_check_all_and_collapsible_categories.md` (brief J, THE CHECK-ALL AND THE COLLAPSIBLE CATEGORIES, canon 0.30.212 and 0.30.215; no migration, the head stays 0074). The report says "Not deployed from this session"; nothing was deployed before this gate. No Scribe change to `app/`. His hand-back, verbatim: "Brief J is in. Data Queues and Pending Data Uploads now have a checkbox on every actionable row, a check-all on each section, and a fold on every section heading. The folds start open and stay folded on that device after a reload. No migration. Not deployed. Void checked (n) sends one reason through the same void path as the row button. Every checked row is tested first. If one row refuses, nothing in that batch is written, and the message names the row. Mark checked uploaded (n) records the files as uploaded to METRC, the same way each row's own button does. Clear all pending is still a clear, not an upload. Reconciliation notes have no checkbox. From-zero smoke passed at pin 74."

## What was gated

1. The tree was hashed on the device after the build session went quiet (the last file under `app/` moved at 01:35 device time, the report at 01:38; the hash at 02:06) and compared with the Scribe's sandbox, which held the tree of canon 0.30.214 (23d9ac08768b38b1, 207 files) byte for byte. Ten files differed, exactly the ten of the report's seal, one of them new (`test/batch.test.ts`); every other file hashes identical. After the copy the two trees hash identical (c8ac969b74aa61cb, 208 files). The migration head is 0074.
2. The ten were staged, verified against the seal (size and sha256, all ten), copied into the sandbox and verified again there.
3. Read against the brief's eight laws. THE BOX ON EVERY ROW: `checkCell` on every Data Queues row (`name="id"`, the row id, `form=` the section's batch form) and every Pending Data Uploads file row (`name="item"`, `kind:id` as the per-row form posts it: `manifest:<movement>`, `location_move:<group>`, `wet_weights:<batch>`, `receive_manifest:`, `package_split:`, `location_change:`, `new_packages:`, `test_sample:`, the package and prepack rows by their own kind); no box on a reconcile note (`ledgerloc.ts`, its fold and its test); a Logistics Move with receipts renders its box disabled with today's words. THE CHECK-ALL: `checkHead` in every section head, `data-check-all=<form>`, the script checking only that form's enabled boxes and painting indeterminate; one per queue section across its groups. VOID THE CHECKED, ONE REASON: one `batch-bar` form per section (`qf-<key>`, `POST /admin/queues/<key>/void-checked`; the moves `qf-logistics_moves`, `POST /admin/queues/movement/void-checked`) with the required reason and `Void checked (n)`; `voidCheckedQueueRows` finds the queue in `queues()`, dedupes the ids, plans every row through `planVoidRecord` (the body of today's `voidRecord`, now returning its statements) before any write, a refusal naming the row (`{row} was not voided: {why}`) and nothing written; `voidCheckedMovements` the same through `planVoidLogisticsMove`; the redirect `?ok=voided&n=` and the flash `Voided {n}.`; the per-row Edit, Void and row controls untouched, the row controls not batched. MARK THE CHECKED UPLOADED: one form per uploads section (`up-<type>`, `POST /admin/uploads/uploaded-checked`, `Mark checked uploaded (n)`); `markCheckedUploaded` plans each `kind:id` through `planUploadMark`, the same kind constants, batch ids and ref ids as the per-row route and its four dedicated marks (manifest, receive manifest, split, location move read line for line the same), one write in `db.batch`, `cleared` left at its default 0, `SYSTEM_REASON.upload_marked` on the log rows; `Clear all pending` untouched in its own reveal. THE FOLD: `queueFold` wraps every section heading on both pages in `details.queue-fold[data-fold][open]` with the count in the summary; `QUEUE_FOLD_SCRIPT`, emitted once per page, reads `localStorage["gf_fold:" + location.pathname]`, closes the listed keys on load and writes the closed keys on every toggle; `data-pipeline-key` and `data-count` stay on the h2. THE WORDS: eight new strings with Spanish. THE TESTS: `test/batch.test.ts` (two rows under one reason with two log rows; a refused row refusing the whole batch with nothing written; an empty selection refused; two files of different kinds marked with `cleared` 0), `test/surface.test.ts` (the fold, the box, the check-all and the form action on both pages), `test/ledgerloc.test.ts` (the notes fold with no box), `scripts/smoke.mjs` (two pending files marked and gone with the flash and the log row; two queue rows voided with one reason and gone with the flash; the folds open on both pages). NOTHING ELSE MOVES: `db.ts`, `pipeline.ts`, `pages.ts`, `locations.ts`, `console.ts`, `metrc.ts`, `prepack.ts`, `sheetsync.ts` did not move; `theme.ts` gained seven layout rules with no color (one block serves every skin).
4. THE LANDING, READ IN THE DATABASE. The smoke's local D1 after the walk: the two files the smoke checked and marked landed as two `metrc_uploads` rows at one instant (02:14:24.594Z), kind `wet_weights`, the HBN-named files, `cleared` 0, 18 log rows between them under the marked-uploaded reason; the clear-all of 0.30.96 still writes its own rows with `cleared` 1 (12 at 02:14:24.720Z); the two HBN Queue rows the smoke checked and voided under `smoke check-all` read `deleted_at` set with one log row each carrying that reason; the routes answered `303` once each (`/admin/uploads/uploaded-checked`, `/admin/queues/hbn_queue/void-checked`); both pages rendered their folds open.

## Gates on the tree as received (the Scribe's sandbox)

- `npx tsc --noEmit`: exit 0.
- `npx vitest run`: 50 files, 859 tests passed; the same under `TZ=America/New_York`.
- `node --check scripts/smoke.mjs`: ok.
- From-zero smoke (`SMOKE_PORT=9096`, the DROPS copy of the In Testing workbook present): `About to apply 74 migration(s)`, `SMOKE PASS`, no 500; exit 0 once the dev server was ended by pid. The two `Request was cancelled` lines are wrangler's own `Request.cf` fetch in the sandbox, present in the gates of briefs H and I alike.
- Dash audit: 0 on the ten files and the build report.
- Secret grep (`METRC_INTEGRATOR_KEY = "`, `METRC_USER_KEY = "`, `MS_CLIENT_SECRET = "`, `cfas[t]_`): no matches in the slice.

## His word: the report's eight assumptions and four the Scribe adds

The eight stand as the report states them (the refusal that stops the whole batch; the fold per device, not per person; the notes left out; the row controls not batched; the no-script button; the two Location folds; the mixed package section; `cleared` 0). Four more, read in the code:

- The recorded filename differs for six kinds. A single `Mark uploaded` on a test sample, a prepack or cryo New Packages file, a package finish, a location change, or a packages-from-harvest or adjustment file records `markUploaded`'s HBN-derived name (`test_sample_<hbn>.csv`, `location_change_<hbn>.csv`, `packages_from_harvests_<hbn>.csv` and the like); the batch mark records the download's own name from the CSV builders (`testSampleFilename`, `locationChangeFilename`, `finishFilename`, the stamped prepack names). Wet weights, manifests, receive manifests, splits and location moves record the same name both ways. Every pending predicate reads `kind` and `ref_id` (or the batch id), never the name, so the floor reads the same; the difference is history in `metrc_uploads.filename` and the change log.
- Without script the batch cannot be sent. The button renders disabled at `(0)` and only the script enables it, so the brief's "without it the boxes still post" holds for the boxes and not for the press; the app already leans on inline script for the license chrome and the loaded-at clock, and the floor's browsers run it.
- Each row of a batch void carries its own instant. `planVoidRecord` stamps `nowIso()` per row, so two rows voided by one press read `deleted_at` a few milliseconds apart with the one reason on both; a batch mark stamps its rows at one instant.
- A large selection writes in chunks of 80 statements. The plan phase runs every guard before the first write, so a refusal never leaves a partial batch; a failure of the store itself between chunks would, and the per-row paths have the same exposure one row at a time.

Two words, not gates: the two Location folds both read `Location changes` (the moves fold could read `Location moves`); the Spanish `no se anulo` and `no se marco` carry no accent where the file's other strings are mixed.

## Deploy (his hands; worker-only, no migration rides)

```powershell
cd "C:\Users\DennisWallace\Documents\Claude\Projects\gripfactory Practical\app"
npm run deploy:grip
```

THE PROBE: Data Queues (`/admin/queues`) rendering its sections as folds with a check-all in each head proves the worker landed. After LIVE, his hands: fold a section, reload and find it folded; check two test rows and void them with one reason; on Pending Data Uploads check two files and mark them uploaded.

## Sealed final check

```
npx tsc --noEmit                      exit 0
npx vitest run                        50 files, 859 tests passed
TZ=America/New_York npx vitest run    50 files, 859 tests passed
node --check scripts/smoke.mjs        ok
rm -rf .smoke-persist && CI=1 SMOKE_PORT=9096 WRANGLER_SEND_METRICS=false npm run smoke
                                      About to apply 74 migration(s); SMOKE PASS; " 500 " lines: 0; exit 0
the build session's seal (10 files) verified byte for byte on the device and in the sandbox:
src/html.ts                                   186584  2a282774fe4afdfd
src/index.ts                                  134101  021c762b8ca28783
src/actions.ts                                292926  367093d5d9478ac7
src/theme.ts                                  153779  f97595267082665d
src/i18n.ts                                   162032  dc7d48e40aa5dce3
src/ledgerloc.ts                               27340  90fe3fb025307cc1
test/surface.test.ts                           79969  e82379072e4290e2
test/batch.test.ts                              3224  faa802cb4f2057a1
test/ledgerloc.test.ts                         22282  91959681c4f68a38
scripts/smoke.mjs                             574107  c0c92b9564d69d9c
tree hash after the copy, device and sandbox: c8ac969b74aa61cb (208 files)
the build report: SESSION_REPORTS/2026-09-23_check_all_and_collapsible_categories.md  5217  116aef64d791aa12
dash audit: 0 on every file above
secret grep: no matches
```
