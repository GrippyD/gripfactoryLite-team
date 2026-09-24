# 2026-09-16 THE PENDING QUEUE CLEAR (canon 0.30.96)

Scribe-direct under G-2. Owner ruling 2026-09-16, verbatim:

> CAN WE REMOVE ALL THE DOCS that are parked on pending data uploads?

His picks on the two forks (AskUserQuestion): the clear records the files as "cleared, NOT uploaded to METRC" (an honest disposition, never a false upload claim), and it is a reusable "Clear all" button on the page (the queue refills as harvest lands and as data changes), not a one-time SQL.

The picture, read from the beta floor: the queue was the whole harvest so far because nothing had ever been marked uploaded (metrc_uploads held only two package_adjust marks). Every batch with a finished lot, every silo load, every manifest and receipt pends its file. So "remove all" means clearing the entire derived queue.

## The law

1. A "Clear all pending" control sits at the top of the Pending Data Uploads page, revealed behind a summary (so a stray click cannot fire it), carrying the total count across all seven lists. The whole /admin tree is already behind the Admin PIN, so the clear is PIN-gated by that gate.
2. Clearing disposes every pending file across the seven lists (wet weights, package files, receive manifests, manifests, splits, location changes, location moves) by inserting one metrc_uploads row per file. The row carries cleared = 1 and a change-log reason "cleared, not uploaded to METRC," so the disposition is honest: it is never recorded as a METRC upload.
3. The clear reuses the existing disposition path: the pending predicates already read any metrc_uploads row of a file's kind and ref as disposing it, so a cleared row clears the queue exactly as an upload mark does. No pending query changed. A future "uploaded to METRC" report filters cleared = 0.
4. No CSV is built (the bounded Worker room, canon 0.30.42): a cleared row needs only the file's kind, its batch and its ref, which the pending lists already carry. The filename is a plain "cleared_<kind>_<name>.csv".
5. Reversibility matches the existing per-item Mark uploaded: a time-based kind (wet weights, splits) re-pends on new activity as ever; an existence kind (manifests, receives, location changes and moves, package files) stays cleared until its metrc_uploads row is voided. The underlying harvest data is untouched; only clear-marks are written.

## What changed

- `migrations/0054_upload_cleared.sql`: `cleared INTEGER NOT NULL DEFAULT 0` on metrc_uploads. The default keeps every existing mark as a real upload (cleared = 0); no existing INSERT changed.
- `src/config.ts`: `SYSTEM_REASON.upload_cleared` ("cleared, not uploaded to METRC").
- `src/actions.ts`: `clearAllUploads` gathers the seven pending lists and inserts a cleared metrc_uploads row per file with the right kind, batch and ref, one db.batch, under the upload_cleared reason.
- `src/index.ts`: POST /admin/uploads/clear-all; the `flashFromQuery` case for ok=cleared.
- `src/html.ts`: the Clear all reveal and button on `pendingUploadsPage`, with the total count; the empty case unchanged.
- `src/i18n.ts`: the button, the note and the flash, EN and ES.
- `test/surface.test.ts`: the Clear all control renders with the summed count and posts to the clear route; none when the queue is empty.
- `scripts/smoke.mjs`: the from-zero pin is 54; at the end of the walk, with a pile pending, the Clear all button carries a count, one post disposes every kind, the page then reads "Nothing pending", the flash says not-uploaded, and the change log carries the cleared reason.

## Gates

- `npx tsc --noEmit`: 0 errors.
- `npx vitest run`: 30 files, 646 tests passed.
- From-zero smoke: "About to apply 54 migration(s)", SMOKE PASS; the clear-all walk verifies "Nothing pending" after (every kind disposes).
- Dash audit: 0 on every changed file.
- Visual pass: the Clear all reveal on the Pending Data Uploads page (Lite), the count, the not-uploaded note, the danger-styled button above the pending tables.

## Deploy (his hands, WITH the migration)

From `app/`:

```
npx wrangler d1 execute gripfactory-lite-grip-20260914 --env grip --remote --command "SELECT 1"
npx wrangler d1 migrations apply gripfactory-lite-grip-20260914 --env grip --remote
npm run deploy:grip
```

## Sealed final check

```
migrations/0054_upload_cleared.sql    836  c74db8aee7c958ae
src/config.ts                       42026  31b7f4e1ecf8a8de
src/actions.ts                     236075  75e09076479ac082
src/index.ts                       113462  7d595ff06ad8008d
src/html.ts                        169625  d70f56b8f16eb54f
src/i18n.ts                        112129  0c820e5440c36af9
test/surface.test.ts                82317  d124ec831319b6dd
scripts/smoke.mjs                  392279  500fd8b17a64f573
tsc: 0 errors; vitest: 30 files, 646 tests passed
smoke: About to apply 54 migration(s); SMOKE PASS (Nothing pending after Clear all)
dash audit: 0 on every file above; sha256 identical on the device for all eight
```
