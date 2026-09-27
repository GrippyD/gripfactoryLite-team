# 2026-09-26 The gate on one harvest file per load (canon 0.30.254): HELD for one small fix

Scribe session. The gate on his Code session's `SESSION_REPORTS/2026-09-26_the_harvest_file_per_load.md` (brief R, ONE HARVEST FILE PER LOAD, canon 0.30.249; migration 0076). The report says "Not deployed. Nothing committed."; nothing was deployed before this gate. No Scribe change to `app/`. His hand-back, verbatim in part: "One harvest file per load is in `app/`, and the report is `SESSION_REPORTS/2026-09-26_the_harvest_file_per_load.md`. Nothing was committed or deployed."

VERDICT: HELD, for one small fix. Every gate passes, the law reads as briefed, and a rehearsal of 0076 on the floor's newest snapshot backfills cleanly. What holds it: 0076 adds the mark's grams as `REAL`, the only `REAL` in 76 migrations where every weight is `NUMERIC`, and a migration can only be corrected before it first reaches the remote; with that edit ride four lesser findings, each a line or two. The fix goes back to his Code session (the paste at the end); the gate re-runs on the fix.

## What was gated

1. The tree came over as one tarball, as before. It hashed identical on both sides: 222 files, listing sha256 97f03347c8a70d1a. Against the live tree (e227d152315a2368, worker 40c32af2) exactly the report's eighteen sealed files changed, two of them new (`migrations/0076_harvest_file_per_load.sql`, `test/harvestfile.test.ts`); the package files did not move. The seal covers every changed file (G-10).
2. The eighteen files match the seal byte for byte (size, sha256 and tail). No dash and no CR byte in any of the 200 files under `src`, `test`, `migrations` and `scripts/smoke.mjs`, nor in the build report.
3. Read against brief R's laws. THE NUMBER: `harvest_file_seq` set at the first finish on both finish paths (one more than the batch's highest, `COALESCE` keeping a held number through an unfinish), the truck split's parts numbered per HBN, the HBN pencil giving a moved load the next number there with a log line. ONE FILE PER LOAD: the route keys on the load and 404s a weighing one; the file is the load's rows only, by its tags, else its count, else its reads, the jitter seeded by the batch and the load; `<HBN>(n).csv`, a lone load (1); ActualDate from `effective_date`, else the farm day of `created_at`. THE PENDING LAW: per load, an existence kind, a batch-level mark covering the loads created before it; Mark uploaded, Mark the checked, Clear all and the sheet read it. TAGS PER LOAD: the box per load, a tag held by another live load refused by its file's name, the box closed once marked; the backfill gives a one-load batch's tags their load. CHANGED AFTER UPLOAD: the mark keeps `file_wet_grams` and `file_plant_count`; a load whose total or count differs from its latest mark is listed with then, now and the difference; Acknowledge writes a new baseline row with a logged reason and cuts no file. THE OTHER FILES carry `(n)`. The page has the Load and Plant count columns and the unassigned note.
4. THE REHEARSAL: the 2026-09-25 15:35Z snapshot (66 tables, 49 loads, 25,138 tags, 33 marks) loaded into a database built by migrations 0001 to 0075, then 0076 applied. Every load numbered, no batch with a repeated number, every batch numbered 1 to n, and every live load's number equal to its rank among its batch's live loads. Of 23,572 live tags, 21,921 took their load; the other 1,651 sit on two batches with no live load, so no row shows them; no tag points at another batch's load. The old law pends 34 batches; the new one pends 22 loads, and the 12 that drop off are all covered by their batch's mark, their later activity unloads, trims and the corrections of 0.30.180 (among them 26021, 26023, 26025, 26030, 26031, 26016, 26017, 26019). Changed after upload lists none.
5. THE SMOKE'S D1 after the walk: three batches with two or more loads, numbered 1 and 2, 1 and 2, and 1 to 3; no repeated number; the one unnumbered load still weighing; nine per-load marks, two of them acknowledgment baselines (grams 100 then 120, 1,235 then 1,240); a package adjustment and a location change named with `(n)`.

## The fix

- F3, THE MARK'S GRAMS ARE REAL (low, and it holds the tree): `ALTER TABLE metrc_uploads ADD COLUMN file_wet_grams REAL`. Every other weight in the schema is `NUMERIC` (68 columns); `REAL` is an eight byte double in D1 but a four byte float in Postgres, too coarse for a load of 6,092,589.01 g, and the SQL is to stay Postgres-portable. 0076 has reached no database but the smoke's throwaway one, so it is corrected in place: `NUMERIC`.
- F1, A LOAD WITH NO NUMBER READS TWO WAYS (low): the download, the mark and the tag refusal read a null number as the load's rank (`getHarvestLoad`, brief R law 1), but the pending list, the sheet's pending names and the location change and unload names read it as 1 (`seq ?? 1`, `hbnWithSeq`). Both finish paths number every load, so a null comes only from a load a repair writes, where the page could show `(1)` and download `(2)`. One reading everywhere: the rank.
- F2, UNASSIGNED TAGS ARE NEVER CLAIMED (low): law 4 keeps a batch's unassigned count on its rows until a hand pastes those tags on a load, but saving a load's tags inserts new rows and leaves the batch's unassigned rows standing, so the count never falls. Saving should claim the same tags from its batch's unassigned rows (take their load, or void them under the tags reason). On the rehearsal no batch with a live load has any, so today's floor would not show it.
- F4, THE PENDING LAW'S COMMENT IS THE OLD LAW (cosmetic): the comment on `PENDING_WET_UPLOADS_SQL` still describes the batch-level law and says "An edit after upload re-pends the file on purpose", the opposite of his "Flag it, no re-pend".
- F5, A FREEZER'S LOCATION CHANGE READS TWO NAMES (cosmetic): the Location change row builds its name from the space's `name`, the file from its METRC `location_name`; for the Blast Freezer (`Blast Freezer(s)`, location `Blast Freezer`) the page shows `..._Blast_Freezer_s_...` and the file downloads as `..._Blast_Freezer_...`.

## Observations for his word (no hold)

- The Changed after upload flag reads the load's own wet total, the one the finish writes and the tag and count files split. A tote read edited after the finish changes a per-read file but not that total, so it is not flagged; that divergence is older than this brief.
- An acknowledgment is a `wet_weights` mark row, so the uploads history shows one more mark per acknowledgment (the report's assumption).
- A load voided between the page and the click refuses its mark (404), where the old batch mark tolerated a voided batch (canon 0.30.5); the pending list never shows a voided load.
- The farm day behind a load with no effective date uses the default start hour, 6, not the Admin setting.

## His word: the report's seven assumptions

They stand as the report states them: the number follows the first finish and is never cleared; the backfill by `created_at` then `id`, voided loads included (on the rehearsal no live load's number moves past its live rank); ActualDate from the effective date, else the farm day of `created_at`; tags on a batch that already has two or more loads unassigned; a load covered only by a batch-level mark never flagged; Acknowledge writes the new baseline and re-pends nothing; the sheet's names in number order, joined with a comma.

## Gates on the tree as received (the Scribe's sandbox)

- `npx tsc --noEmit`: exit 0.
- `npx vitest run`: 60 files, 926 tests passed; the same under `TZ=America/New_York`.
- `node --check scripts/smoke.mjs`: ok.
- From-zero smoke (`SMOKE_PORT=9174`): `About to apply 76 migration(s)`, `SMOKE PASS`, no ` 500 ` line; the dev server ended by the timeout after the pass.
- Dash audit: 0, and no CR byte, on the 200 files under `src`, `test`, `migrations` and `scripts/smoke.mjs`, and on the build report.
- Secret grep (`METRC_INTEGRATOR_KEY = "`, `METRC_USER_KEY = "`, `MS_CLIENT_SECRET = "`, `SENSORPUSH_PASSWORD = "`, `cfas[t]_`): no matches under `src`, `test`, `scripts`, `migrations` or `wrangler.toml`.

## The fix, for his Code session

```
Read canon/_NOW.md, then SESSION_REPORTS/2026-09-26_gate_the_harvest_file_per_load.md, and fix what it names in app/ under THE DISPATCH RULE (canon 0.30.155): F3 (0076 adds file_wet_grams as NUMERIC like every weight in the schema; 0076 has reached no database but the smoke's, so correct it in place), F1 (a load with no number reads as its rank by created_at then id everywhere: the pending list, the sheet's names, the location change and unload names, as the download and the mark already do), F2 (saving a load's tags claims the same tags from its batch's unassigned rows, so the unassigned count falls as a hand pastes them), F4 (the comment on PENDING_WET_UPLOADS_SQL states the new law) and F5 (a Location change row reads the file's own name, the METRC location name where the space has one). Tests beside them. Nothing else moves. Write SESSION_REPORTS/2026-09-26_the_harvest_file_per_load_fix.md with the sealed final check, every changed file in the seal. Commit nothing, push nothing, deploy nothing.
```

## Sealed final check

```
npx tsc --noEmit                      exit 0
npx vitest run                        60 files, 926 tests passed
TZ=America/New_York npx vitest run    60 files, 926 tests passed
node --check scripts/smoke.mjs        ok
rm -rf .smoke-persist && CI=1 SMOKE_PORT=9174 WRANGLER_SEND_METRICS=false npm run smoke
                                      About to apply 76 migration(s); SMOKE PASS; " 500 " lines: 0
the build session's seal (18 files) verified byte for byte, device and sandbox:
migrations/0076_harvest_file_per_load.sql       1242  84e4bc2d654df8a7
src/actions.ts                                347716  3808eae3fcb9a3ab
src/csv.ts                                     17641  f68bfe268ee852ad
src/db.ts                                     184571  edd44630c0cbdd67
src/html.ts                                   192379  1c241fb3daaa187d
src/i18n.ts                                   178034  9d68c192bec887ae
src/index.ts                                  139614  3e1f8540dc9ac222
src/interco.ts                                 20845  bebdbabd9f3005cb
src/sheetsync.ts                               79815  571f376938178175
scripts/smoke.mjs                             610514  907c39363fce42f8
test/batch.test.ts                              3283  b4faaae5dacb3663
test/csv.test.ts                               18100  780d43ac65ab4bc1
test/drying.test.ts                            14991  f002913436f473ed
test/harvestfile.test.ts                        9600  f4ceef3fe39134dc
test/metrc.test.ts                             63945  f27a8b9d0754e055
test/routing.test.ts                           37119  782233c59d027673
test/sheetsync.test.ts                         31692  ce4b67588c602dae
test/surface.test.ts                           80499  6500809896a1fb6c
changed, not in the seal: none
tree listing, device and sandbox: 222 files, sha256 97f03347c8a70d1a
the build report: SESSION_REPORTS/2026-09-26_the_harvest_file_per_load.md  6106  fbeb465b91baccfe
the rehearsal: the 2026-09-25 snapshot through 0001-0075, then 0076: 49 loads numbered, 0 repeats,
  21,921 of 23,572 live tags given their load, 22 loads pending (34 batches under the old law)
dash audit: 0; secret grep: no matches
```
