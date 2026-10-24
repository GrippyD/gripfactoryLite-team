# LB1: a lab create's retry logs nothing

Worktree `branches/GFLiteMetrcAPI`. One plain session. No git. Nothing is committed, pushed, or deployed.

## Tree

- Received: `86b80eda966f0d2d` (427 files, 117 migrations). Canon hash in `app/`, `wrangler.toml` read as LF. That is the pin.
- Left: `e0bc9cca7aa64bd2` (428 files, 118 migrations).

## Files

- `app/migrations/0119_lab_write_id.sql`: `write_id TEXT` on `lab_internal_tests`, `lab_compliance_samples`, and `lab_op_results`. Null on every row that already exists. The comment says the column is the write's own key for the log guard.
- `app/src/lab.ts`: each create and each op import mints one `crypto.randomUUID()` and stores it on the rows that request inserts. Create logs are guarded by `id` and `write_id`. Op logs select `r.write_id = ?` and still require `r.source = 'station'`. `write_id` is not a logged field. Every `SELECT *` row drops it before JSON leaves (the three feeds, the lists, the create and patch answers, and `listLabComplianceSurface`). Patch and void guards are unchanged.
- `app/test/lab.test.ts`: the compliance create and retry share one frozen millisecond. Three new cases do the same for the bench, compliance, and op import.
- `app/scripts/smoke.mjs`: from zero applies 118 migrations. The bench reading is posted twice and the change log hits for that id do not grow. The API row and the feed row do not carry `write_id`.

## Pinned code

The new cases and the frozen compliance retry were run on `86b80eda966f0d2d` before the fix. Each failed:

- compliance create then retry (`logsFor`): expected 15, received 28.
- bench, same millisecond: expected 15, received 30. The retry had already answered `created: false`.
- compliance, same body, same millisecond: expected 15, received 30. The retry had already answered `created: false`.
- op import, same millisecond: expected 26, received 52. The retry had already answered `already_there: 1`.

They pass on this tree.

## Decided

- `write_id` is stored and is not written into `record_change_log`. The change log page would show it, and the key stays on the server. The 900 row import test counts stored fields except `write_id`.
- `src/labclient.ts` was read and not edited. It prints named fields. Its outbox stores the request body the page sent, which never includes `write_id`.

## Gates

- `npx tsc --noEmit`: exit 0.
- vitest `TZ=UTC`: Test Files 123 passed (123). Tests 1699 passed, 6 skipped (1705). VITEST_EXIT 0.
- vitest `TZ=America/New_York`: Test Files 123 passed (123). Tests 1699 passed, 6 skipped (1705). VITEST_EXIT 0.
- `node --check scripts/smoke.mjs`: exit 0.
- From zero smoke, background: `About to apply 118 migration(s)`. `SMOKE PASS`. `SMOKE_EXIT 0`. No 500 in the log.
- Dash and CR scan of the four files: U+2013 0, U+2014 0, CR 0. The migration and the new test names name nobody.

Left tree `e0bc9cca7aa64bd2`. Nothing is committed, pushed, or deployed.
