# 2026-10-07 Manual HBNs in phantom order, and test HBNs

BRIEF H1, MANUAL HBNS IN PHANTOM ORDER, AND TEST HBNS (canon 0.30.420). Migration 0095. Not deployed. Nothing committed. Nothing pushed. No git was run.

## The pin

Opened on `9c7639ac10df35ec` (305 files, migrations 0001 to 0094, `wrangler.toml` read as LF). That is the live tree after PC1, V29, A1 and S1. The tree this session leaves is `c63769980fe87554` (307 files, migrations 0001 to 0095). BRIEF SD1 is in that same tree and has its own report.

## What changed

A manual HBN is accepted when it ends in `-YY###` and that exact text is new, live or voided. The YY need not match the entry date, and the typed ### need not be free. Its `lot_serial` is the next place in line for the entry date's harvest year: `1 + MAX(lot_serial)` over rows that are not tests, voided rows included, never below `first_lot_token`. The auto mint takes the next one after that. The lot still reads by the HBN's own last five (`shortLotId`).

The manual form has a box "Test HBN (holds no place in line)" (ES "HBN de prueba (no ocupa lugar en la fila)"). A test is stored with `is_test = 1`, the harvest year of its entry date, and a serial from 90001 up (one past that year's highest test serial). It stays in the HBN Queue, with "Test" beside the HBN (ES "Prueba"), and it does not move the line. The auto mint counts only `is_test = 0`. At a next serial past 999 it refuses with "The year's lot numbers have reached 999."

Tests are left out of the dashboard figures that read the harvest year: Plants harvested and the per-plant lots, Harvest Year Total, the yield lots and their packages, and Weighted BTR to date. They are left off the Assign Plant Counts left pane. The day's wet grams still count a tote weighed that day. Harvest Hours to date still reads the typed labor rows.

Migration 0095 adds `harvest_batches.is_test INTEGER NOT NULL DEFAULT 0`. Every row with `harvest_year = 2000` becomes a 2026 test, serials 90001 and 90002 by `created_at`, logged in `record_change_log` under the owner's id. A row already marked is left. Rehearsed on `db_backups/20261007-172458_pre_pc1_s1` (the newest snapshot on disk): the earlier row took 90001, the later 90002, both `is_test = 1` and harvest year 2026, HBN text unchanged, the 2026 line still max 105, six log rows, and a second run of the data statements changed nothing.

The trim tests and the smoke that typed the two team leads' first names now use Ada and Nia. The smoke writes those names into its own `app_config` seed before the trim cards are read. Shift behavior is unchanged. Migration 0052 is append-only and still holds the original seed.

## Gates

- `npx tsc --noEmit`: exit 0.
- `npx vitest run`: 95 files, 1256 tests passed under `TZ=UTC`, and 95 files, 1256 tests passed under `TZ=America/New_York`.
- `node --check scripts/smoke.mjs`: exit 0.
- From-zero smoke (`SMOKE_PORT=9484`, `WRANGLER_SEND_METRICS=false`, `CI=1`, `TZ=UTC`): About to apply 95 migration(s), SMOKE PASS, no ` 500 ` line, exit 0. The `503` line is `POST /api/send`, the smoke's own asserted step.
- Dash (U+2013, U+2014), CR, and BOM audits by character on the files this brief touched: 0.

## Deploy

Not deployed from this session. Nothing committed. Nothing pushed. No git was run. Say deploy when you want it on the grip worker.

## Sealed final check

```
the tree as received, wrangler.toml read as LF
                                      9c7639ac10df35ec (305 files, migrations 0001-0094)
npx tsc --noEmit                      exit 0
TZ=UTC npx vitest run                 95 files, 1256 tests passed
TZ=America/New_York npx vitest run    95 files, 1256 tests passed
node --check scripts/smoke.mjs        exit 0
SMOKE_PORT=9484 WRANGLER_SEND_METRICS=false CI=1 TZ=UTC node scripts/smoke.mjs
                                      About to apply 95 migration(s); SMOKE PASS; " 500 " lines: 0; POST /api/send 503 (the smoke's own step); exit 0
0095 on db_backups/20261007-172458_pre_pc1_s1
                                      two year-2000 rows to 2026 tests 90001 and 90002 by created_at; line max 105; six log rows; second run unchanged
dash audit: 0; CR audit: 0; BOM: 0
the app tree this session leaves, wrangler.toml read as LF
                                      c63769980fe87554 (307 files, migrations 0001-0095)
```

The tree hash is sha256 of the text-mode `sha256sum` list (`<hash><two spaces><path>`, forward slashes, a final newline) over `src`, `test`, `scripts`, `migrations`, `wrangler.toml`, `tsconfig.json`, and `package.json`, sorted. `wrangler.toml` is read as LF. File hashes below are the session's final bytes.

```
app/migrations/0095_manual_hbn_phantom_order.sql   2556  8d46409ac19db251
TAIL WHERE harvest_batches.id = marked.id;
app/src/actions.ts                               420883  9962e0190dc4cda4
TAIL export { MANIFEST_COLUMNS, buckedPackageCode };
app/src/config.ts                                 82570  f74745f4f7524f65
TAIL }
app/src/console.ts                               171165  c47b6251ca642be4
TAIL }
app/src/db.ts                                    223322  ecdf231a9d7f007f
TAIL }
app/src/html.ts                                  197173  54301950b2c86502
TAIL }
app/src/i18n.ts                                  268573  cfafa49ba09bcce4
TAIL }
app/src/pages.ts                                  37362  353c7eb5c0ba2644
TAIL }
app/src/plantcounts.ts                             9589  b37e2376c8eca4b4
TAIL }
app/scripts/smoke.mjs                            821974  23dfa3f23410f50a
TAIL });
app/test/console.test.ts                          97562  893b2d5abeb02031
TAIL });
app/test/hbnentry.test.ts                         23922  7323c33c3b46e825
TAIL });
app/test/phantomhbn.test.ts                       12158  2f553af95509c998
TAIL });
```
