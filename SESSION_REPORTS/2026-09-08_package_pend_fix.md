# Session report: the stale package pends (canon 0.30.5), Scribe-direct, 2026-09-08

**Scribe:** Gripfactory Lite Scribe (Cowork). Owner bug report 2026-09-08 (verbatim): "Marking these uploaded results in an 'unknown upload' error.  I'mguessing because they are living in the inventory slice", with a screenshot of two pending Package Files rows for lot 26001 (Package Adjustments and Package finish, same last activity).

## Diagnosis

The error text is not in the code; the message behind it is "Unknown batch." from `markUploaded`. The pending package list joined `wet_weight_entries` and `harvest_batches` with no `deleted_at` filter while the mark refused a voided batch, so a test batch voided during cleanup kept its package rows on the page and every Mark uploaded on them failed. The purged inventory items were not the trigger: the CSV builders already fall back to the lot's short id when no item exists. The second row in the screenshot was its own wrong: a "Package finish" file still pending from a queue_finish choice made before fork 7 removed that tool.

## Fix

- `listPendingPackageUploads` (db.ts): every arm now requires `w.deleted_at IS NULL` and `b.deleted_at IS NULL`; the list and the mark read one predicate. The two package_finish arms are removed (canon 0.30.1 fork 7: the tool is gone, so a legacy queue_finish log pends no file).
- `markUploaded` (actions.ts): tolerates a batch voided between the page render and the click (a mark is history keeping); the list itself never shows voided rows.
- The package_finish download and mark lanes (index.ts) answer 404.

## Sealed final check

```
cd /home/claude/deploy/app
npx tsc --noEmit                      -> exit 0
npx vitest run                        -> Test Files 16 passed (16), Tests 433 passed (433)
Dash audit (4 touched files)          -> 0
SMOKE_PORT=9487 WRANGLER_SEND_METRICS=false timeout 285 npm run smoke
                                      -> SMOKE PASS, "About to apply 34 migration(s)" from zero
Smoke walks added: Mark uploaded on a pending package_adjust row lands 303 and
  the row leaves the list; the package_finish lane answers 404; voiding a lot
  with a pending package file never adds rows and the page renders clean.

src/db.ts be97fc657475c0f8   src/actions.ts 0f342a51b6880ab6
src/index.ts d90d89b0ba854dbe  scripts/smoke.mjs b2304d2396735522
```

Worker only, no migration. On the live floor the two stale rows for 26001 clear the moment this deploys: the Package finish row vanishes by law, and the Package Adjustments row vanishes if its batch was voided or marks cleanly if it was not.
