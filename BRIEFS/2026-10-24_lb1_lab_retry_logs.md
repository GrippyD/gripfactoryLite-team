# LB1: a lab create's retry logs nothing, even in the same millisecond

Filed by the Scribe on 2026-10-24 (canon 0.30.540).

THE DEFECT (canon 0.30.488): GitHub's vitest once failed `test/lab.test.ts` in the compliance test (28 log rows where 15 were expected), and the deploy did not run until the job was re-run. The cause is in `src/lab.ts`:
- A lab create is `INSERT OR IGNORE` on the client's id.
- Its change log rows are guarded by `SELECT 1 ... WHERE id = ? AND created_at = ?`, bound to the request's own `now`.
- A retry of the same id that lands in the same millisecond as the create carries a `now` equal to the stored `created_at`. Its 13 log rows pass the guard: 15 plus 13.
- The import of op results has the same shape: its log selects rows by `imported_at = ? AND changed_at = ?`.

On the floor this is a double tap or a resend in the same millisecond, which double logs a record that was written once. In CI it is a red run that blocks the deploy.

Part of THE QUEUE, TWO (`BRIEFS/2026-10-24_queue2_lb1_ph1_rg1.md`): read it first; its runner law and stop rules apply here. FIRST IN THE QUEUE. Pin: `86b80eda966f0d2d`. Verify with canon's hash command in `app/` and stop if it differs. No git; nothing committed, pushed or deployed. One migration, `0119`. LF only. Read `src/lab.ts` by search and line range: `guardedLogs`, `createInternal`, `createCompliance`, `opImport` and `OP_LOG_SQL`.

## THE LAW
A lab write's change log rows land only for the row that this request inserted. A retry that finds its row already there writes no row and no log, whatever the clock says.

## 1. Migration 0119
`write_id TEXT` (null for every existing row) on `lab_internal_tests`, `lab_compliance_samples` and `lab_op_results`. Nothing else changes. Say in a comment that the column is the write's own key for the log guard.

## 2. The writes
- `createInternal` and `createCompliance`:
  - mint one write id per request (`crypto.randomUUID()`) and store it in the insert;
  - guard the log rows on `id = ? AND write_id = ?` in place of `created_at = ?`;
  - keep the 201 and 200 answers and the `insert-refused-by-schema` check exactly as they are.
- `opImport`:
  - mint one write id per request and store it on every row the request inserts;
  - make `OP_LOG_SQL` select by `r.write_id = ?` (keeping `r.source = 'station'`), so a second import in the same millisecond logs only what it inserted;
  - keep the counts it answers (`landed`, `already_there`) as they are.
- The patch and void paths are untouched: their guards read `updated_at` after an update that happened.
- `write_id` never leaves the server. Every feed and API row leaves it out. Where a row is read with `SELECT *`, drop the field before the JSON goes out, and check the lab feeds and `src/labclient.ts`.

## Tests
- In each of the three paths, freeze `Date.now` so the create and its retry share one millisecond.
  - The first write's log count stands after the retry.
  - The retry answers `created: false` (for op results, `already_there`).
  - Each test fails on the pinned tree's code and passes on the fix. Write that in the report.
- Make the compliance test at `test/lab.test.ts` (the create, the retry, `logsFor`) deterministic the same way, so CI cannot meet the race again.
- `write_id` is absent from the API rows and the lab feeds.
- No dash characters in any output.

## Smoke and gates
- Smoke: `About to apply 118 migration(s)` (the live tree reads 117). Post one internal test twice with the same id and check that the change log rows for it do not grow. Keep every other check.
- Gates:
  - typecheck 0;
  - vitest under TZ=UTC and TZ=America/New_York, with counts;
  - `node --check scripts/smoke.mjs`;
  - the from zero smoke in the background by the runner law (SMOKE PASS, SMOKE_EXIT 0, no 500);
  - dash, CR and name scans of every touched file.
- No renders.

## Hand back
Report `SESSION_REPORTS/2026-10-24_lb1_lab_retry_logs.md`, short. Give the tree received and left, the files touched and the gate results, and say whether each new test fails on the pinned code. Cover anything decided or declined and why. Close with the tree hash and that nothing is committed, pushed or deployed. Then go straight on to PH1.
