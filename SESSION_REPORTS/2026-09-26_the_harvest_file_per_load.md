# 2026-09-26 One harvest file per load

Brief R, ONE HARVEST FILE PER LOAD (canon 0.30.249), built from the tree as it stood (`e227d152315a2368`). One migration, `0076`. Brief Q is not in this sitting. Not deployed. Nothing committed.

## What changed

Each finished load of an HBN has its own harvest file, `<HBN>(n).csv`, a lone load included. The number is `wet_weight_entries.harvest_file_seq`. It is set the first time the load leaves weighing, to one more than the highest number already on that batch, voided loads included. A later finish keeps the same number. A weighing load that already has a number and is penciled onto another open HBN takes the next number there.

The download, the tag box, Mark uploaded, Mark the checked, and Clear all key on the load. A finished, non-voided load pends until its own `wet_weights` mark (`ref_id` = the load). A later load, an edit, an unload, or a trim does not re-pend it. A batch-level mark (`ref_id` null, the marks made before this brief) covers each load of that batch created before the mark.

Tags paste onto one load. A tag already held by another live load is refused, and the refusal names that load's file. After the load's file is marked, the box is closed. The migration assigns existing tags only when the batch has exactly one non-voided load. A batch with two or more loads keeps those tags unassigned, and each of its pending rows says how many are unassigned.

A per-load mark stores the wet grams and the plant count the file carried. If the load's current grams or plant count differ from its latest mark, Pending Data Uploads shows it under Changed after upload. Acknowledge, with a reason, writes those current values as the new baseline and cuts no file. A load covered only by a batch-level mark has no baseline and is not flagged.

ActualDate is the load's effective date, otherwise the farm day of `created_at`. The jitter seed is the batch and the load, so a re-download of one load reproduces. Location-change, packages-from-harvests, and package-adjustments names carry `(n)`. Package-file and location-change rows show that file name. The sheet sync's pending harvest file is every pending `<HBN>(n).csv` of the batch, joined with `, `.

## Assumptions for your word

- The number follows the first time the load leaves weighing. A return to weighing and a later finish keep it. It is not cleared.
- The backfill orders a batch's loads by `created_at`, then `id`, voided loads included. The earliest is 1. A null number at read time uses that same rank.
- ActualDate uses the effective date when the load has one. Otherwise it is the farm day of `created_at` at the standing start hour of 6 (the seeded default). An unload that moves `updated_at` does not move the date.
- Tags on a batch that already has two or more non-voided loads stay unassigned. They ride no file until a hand pastes them onto a load.
- A load covered only by a batch-level mark is never listed under Changed after upload.
- Acknowledge writes a new mark row with the current grams and plant count. That row is the baseline. The typed reason is logged on the load. No CSV is cut, and the file does not re-pend.
- The sheet names every still-pending load of the batch, in number order, joined with a comma and a space.

## Gates

- `npx tsc --noEmit`: exit 0.
- `npx vitest run`: 60 files, 926 tests passed. The same under `TZ=America/New_York`.
- `node --check scripts/smoke.mjs`: exit 0.
- From-zero smoke (`SMOKE_PORT=9166`, `WRANGLER_SEND_METRICS=false`): `About to apply 76 migration(s)`, `SMOKE PASS`, ` 500 ` lines: 0, exit 0. Two truck loads of one HBN pended `(1)` and `(2)` with their own rows and tags. `(1)` was marked, its grams were edited, it showed under Changed after upload, and acknowledge cleared it. The two loads' location-change files and unload files were named apart.
- Dash audit: 0 on the files below (U+2014 and U+2013).
- `METRC_INTEGRATOR_KEY = "` and `METRC_USER_KEY = "` appear in no file under `src`, `test`, `scripts`, or `wrangler.toml`.

## Deploy

Not deployed from this session. Nothing committed. The migration is `0076`. A deploy of this tree is the three-step path, because the migration rides.

## Sealed final check

```
npx tsc --noEmit                      exit 0
npx vitest run                        60 files, 926 tests passed
TZ=America/New_York npx vitest run    60 files, 926 tests passed
node --check scripts/smoke.mjs        exit 0
SMOKE_PORT=9166 WRANGLER_SEND_METRICS=false node scripts/smoke.mjs
                                      About to apply 76 migration(s); SMOKE PASS; " 500 " lines: 0; exit 0
```

```
migrations/0076_harvest_file_per_load.sql  1242  84e4bc2d654df8a7
TAIL ALTER TABLE metrc_uploads ADD COLUMN file_plant_count INTEGER;
src/actions.ts                             347716  3808eae3fcb9a3ab
TAIL export { MANIFEST_COLUMNS, buckedPackageCode };
src/csv.ts                                 17641  f68bfe268ee852ad
TAIL }
src/db.ts                                  184571  edd44630c0cbdd67
TAIL }
src/html.ts                                192379  1c241fb3daaa187d
TAIL }
src/i18n.ts                                178034  9d68c192bec887ae
TAIL }
src/index.ts                               139614  3e1f8540dc9ac222
TAIL export default worker;
src/interco.ts                             20845  bebdbabd9f3005cb
TAIL }
src/sheetsync.ts                           79815  571f376938178175
TAIL }
scripts/smoke.mjs                          610514  907c39363fce42f8
TAIL });
test/batch.test.ts                         3283  b4faaae5dacb3663
TAIL });
test/csv.test.ts                           18100  780d43ac65ab4bc1
TAIL });
test/drying.test.ts                        14991  f002913436f473ed
TAIL });
test/harvestfile.test.ts                   9600  f4ceef3fe39134dc
TAIL });
test/metrc.test.ts                         63945  f27a8b9d0754e055
TAIL });
test/routing.test.ts                       37119  782233c59d027673
TAIL });
test/sheetsync.test.ts                     31692  ce4b67588c602dae
TAIL });
test/surface.test.ts                       80499  6500809896a1fb6c
TAIL });
```
