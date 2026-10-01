# BRIEF V9.1: THE RAD AVAILABLE LAW, the gate's fix on V9 (canon 0.30.329)

For the build session (Claude Code or Cursor) opened in the worktree `branches/GFLiteOpsDashboard` (its `app/` is the app), under THE DISPATCH RULE (canon 0.30.155), the gate's fix on V9, THE RAD SCHEDULE AND RAD OPERATION (BRIEF V9, canon 0.30.327; the gate `SESSION_REPORTS/2026-10-01_gate_the_rad_schedule_and_rad_operation.md`, canon 0.30.328, HELD as received on one law, the fix gated), on the worktree exactly as it stands: V9 as received (the app tree `188c24fb60d59ea9`), not yet committed; the two repair files under `app/scripts/repairs/` ride untouched. This fix rides with V9's commit. The change below is already gated byte for byte in the Scribe's sandbox (typecheck, vitest both zones, the from-zero smoke at pin 85, the pages driven), so the build session reproduces it exactly, by the seven edits as written, and the gate holds without a second pass. Canon wins over this brief where they differ.

## The hold (the gate report, verbatim in part)

"The brief kept a package off Available only while it stood on a scheduled or running run, so a package whose run has completed comes straight back to the top of the left pane (its METRC state is unchanged until the Testing Desk moves it), where a second `>>` would irradiate it twice and the pane never shrinks as runs complete."

## The law

1. THE STATE A RUN RECORDED. `listRadCompletedStates` in `src/db.ts` reads, per tag, the lab state its newest completed run recorded (`rad_run_packages.lab_test_status`, joined to the runs in status `complete`, ordered oldest first so the newest completion wins in the map); a reopened run is not complete, so its tags leave the map.
2. AVAILABLE. `listRadAvailable` in `src/rad.ts` is the catalog minus the tags on a scheduled or running run (as received) minus the tags whose newest completed run recorded the lab state the mirror still shows. The package lists again when METRC moves its state (a TestFailed after the test, a RetestFailed after the retest: the Rad again).
3. THE TEST. `test/rad.test.ts` gains one case: off Available after Complete; `>>` refused ("That package is not available."); on again when the mirror reads TestFailed; off when it reads NotSubmitted again; the same through Reopen behind the PIN and a second Complete. 72 files, 1004 tests.
4. THE SMOKE. After the two solo runs complete, the two packages are off Available; a second mirror drop with those two rows as TestFailed lists them again and moves the gate's Ready count down by two (`readyMoved`); the later Ready assertions rebase on `readyMoved`. The pin stays 85.
5. NOTHING ELSE MOVES. The observations of the gate report (a `created` or `cryo_queue` row refusing Complete; a second pass before METRC moves; the grow type order; the doubled number on a package line) wait on his word and are not in this slice.

## The seven edits on four files, exact

Each `find` text occurs exactly once in the file as received; replace it once with the `replace` text, nothing else in the file touched (LF line ends, no CR, no BOM, the file's last byte as it was). The files as received, on the worktree: `src/db.ts` 205,901 bytes `6d8ccc429e6787bb`; `src/rad.ts` 26,157 `b2c9426486df1ff1`; `test/rad.test.ts` 11,476 `828a18bcc3a9452d`; `scripts/smoke.mjs` 672,274 `ead0d7ba67a1d146`. Check them first; a different hash means the worktree is not V9 as received, stop and report.

### Edit 1: `src/db.ts` (db listRadCompletedStates)

find, once:

````
export type RadRunRecord = {
````

replace with:

````
/** THE RAD, the gate's fix (canon 0.30.328): the lab state each tag carried
 * onto its newest completed run. While the mirror still shows that state the
 * package has not moved on, so it stays off Available; a reopened run is not
 * complete and drops out of this map. */
export async function listRadCompletedStates(db: D1Database): Promise<Map<string, string>> {
  const result = await db
    .prepare(
      `SELECT UPPER(p.tag) AS tag, p.lab_test_status AS lab, r.completed_at
       FROM rad_run_packages p
       JOIN rad_runs r ON r.id = p.run_id
       WHERE p.deleted_at IS NULL AND r.deleted_at IS NULL AND r.status = 'complete'
       ORDER BY r.completed_at ASC, r.id ASC, p.position ASC`
    )
    .all<{ tag: string; lab: string | null; completed_at: string | null }>();
  const byTag = new Map<string, string>();
  for (const row of result.results ?? []) byTag.set(row.tag, String(row.lab ?? "").trim());
  return byTag;
}

export type RadRunRecord = {
````

### Edit 2: `src/rad.ts` (rad import)

find, once:

````
  listRadBatchGrows,
  listRadGrowMethods,
  listRadMirrorRows,
  listRadOpenTags,
````

replace with:

````
  listRadBatchGrows,
  listRadCompletedStates,
  listRadGrowMethods,
  listRadMirrorRows,
  listRadOpenTags,
````

### Edit 3: `src/rad.ts` (rad listRadAvailable)

find, once:

````
/** The Available pane: the catalog minus tags on a scheduled or running run. */
export async function listRadAvailable(db: D1Database): Promise<RadAvailableRow[]> {
  const [catalog, open] = await Promise.all([listRadCatalog(db), listRadOpenTags(db)]);
  const held = new Set(open);
  return catalog.filter((row) => !held.has(row.tag));
}
````

replace with:

````
/** The Available pane: the catalog minus tags on a scheduled or running run,
 * minus tags whose newest completed run recorded the lab state the mirror
 * still shows (the gate's fix, canon 0.30.328: a radded package is done until
 * METRC moves it; a changed state, a fail after a test say, lists it again). */
export async function listRadAvailable(db: D1Database): Promise<RadAvailableRow[]> {
  const [catalog, open, completed] = await Promise.all([listRadCatalog(db), listRadOpenTags(db), listRadCompletedStates(db)]);
  const held = new Set(open);
  return catalog.filter((row) => !held.has(row.tag) && completed.get(row.tag) !== row.lab);
}
````

### Edit 4: `test/rad.test.ts` (rad test)

find, once:

````
  it("fills the newest open run to ten, refuses the eleventh, and carries the grey", async () => {
````

replace with:

````
  it("a completed package leaves Available until its lab state moves, and a reopened run lists it again", async () => {
    const m = await migratedDb();
    const person = seedPerson(m);
    const done = seedRad(m, "40001", "BUD - Fruity Pebbles - PNN - O", "NotSubmitted", "GH", "27301");
    const other = seedRad(m, "40002", "WPR - Fruity Pebbles - PNN - O", "NotSubmitted", "GH", "27302");
    await scheduleRadPackage(m.db, formOf({ person_id: person, tag: done }));
    const run = (await loadRadBoard(m.db)).scheduled[0];
    if (!run) throw new Error("no run");
    await startRadRun(m.db, run.id, formOf({ person_id: person }));
    await completeRadRun(m.db, run.id, formOf({ person_id: person }));
    expect((await listRadAvailable(m.db)).map((row) => row.tag)).toEqual([other]);
    await expect(scheduleRadPackage(m.db, formOf({ person_id: person, tag: done }))).rejects.toMatchObject({
      message: "That package is not available.",
    });
    m.run(`UPDATE metrc_packages SET lab_test_status = 'TestFailed' WHERE tag = ?`, done);
    expect((await listRadAvailable(m.db)).map((row) => row.tag)).toEqual([other, done]);
    m.run(`UPDATE metrc_packages SET lab_test_status = 'NotSubmitted' WHERE tag = ?`, done);
    expect((await listRadAvailable(m.db)).map((row) => row.tag)).toEqual([other]);
    await reopenRadRun(m.db, run.id, formOf({ person_id: person, unfinish_pin: PIN }));
    expect((await listRadAvailable(m.db)).map((row) => row.tag)).toEqual([other]);
    await completeRadRun(m.db, run.id, formOf({ person_id: person }));
    expect((await listRadAvailable(m.db)).map((row) => row.tag)).toEqual([other]);
  });

  it("fills the newest open run to ten, refuses the eleventh, and carries the grey", async () => {
````

### Edit 5: `scripts/smoke.mjs` (smoke after solo)

find, once:

````
    const readyMid = readyCount((await text("/harvest")).body);
    assert(readyMid === ready0 + 2, `the two solo completes must add two Ready packages, ${ready0} to ${readyMid}`);
````

replace with:

````
    const readyMid = readyCount((await text("/harvest")).body);
    assert(readyMid === ready0 + 2, `the two solo completes must add two Ready packages, ${ready0} to ${readyMid}`);
    // THE RAD, the gate's fix (canon 0.30.328): a completed package leaves Available while METRC still
    // shows the state the run recorded; a changed state (the two re-mounted as TestFailed) lists it again.
    const radAfterSolo = (await text("/compliance/rad_schedule")).body;
    const radAvailAfterSolo = radAfterSolo.slice(radAfterSolo.indexOf('data-rad-pane="available"'), radAfterSolo.indexOf('data-rad-pane="scheduled"'));
    assert(!radAvailAfterSolo.includes(`data-rad-tag="${radHeld}"`) && !radAvailAfterSolo.includes(`data-rad-tag="${radBack}"`), "a completed package must leave Available while its lab state stands");
    const radMovedRows = radRows.map((row) => (row.startsWith(radHeld) || row.startsWith(radBack) ? row.replace(",NotSubmitted,", ",TestFailed,") : row));
    const radMovedForm = new FormData();
    radMovedForm.append("file", new File([new TextEncoder().encode(`${radHead}\r\n${radMovedRows.join("\r\n")}\r\n`)], "MetrcMichiganGRC001132PackagesActive_rad2.csv", { type: "text/csv" }));
    const radMovedMount = await req("/inventory/metrc/mount", { method: "POST", body: radMovedForm });
    assert(radMovedMount.status === 303, `the moved mirror drop expected 303 got ${radMovedMount.status} ${await radMovedMount.text()}`);
    const radAfterMove = (await text("/compliance/rad_schedule")).body;
    const radAvailAfterMove = radAfterMove.slice(radAfterMove.indexOf('data-rad-pane="available"'), radAfterMove.indexOf('data-rad-pane="scheduled"'));
    assert(radAvailAfterMove.includes(`data-rad-tag="${radHeld}"`) && radAvailAfterMove.includes(`data-rad-tag="${radBack}"`), "a completed package must return to Available once its lab state moves");
    const readyMoved = readyCount((await text("/harvest")).body);
    assert(readyMoved === readyMid - 2, `the two moved to TestFailed must leave Ready, ${readyMid} to ${readyMoved}`);
````

### Edit 6: `scripts/smoke.mjs` (smoke ready1)

find, once:

````
    const ready1 = readyCount((await text("/harvest")).body);
    assert(ready1 === readyMid + 1, `Ready must gain the stranger, ${readyMid} to ${ready1}`);
````

replace with:

````
    const ready1 = readyCount((await text("/harvest")).body);
    assert(ready1 === readyMoved + 1, `Ready must gain the stranger, ${readyMoved} to ${ready1}`);
````

### Edit 7: `scripts/smoke.mjs` (smoke ready2)

find, once:

````
    assert(ready2 === readyMid, `Reopen must lift the effect run's pasteurized mark, Ready ${ready1} back to ${ready2}`);
````

replace with:

````
    assert(ready2 === readyMoved, `Reopen must lift the effect run's pasteurized mark, Ready ${ready1} back to ${ready2}`);
````

## The result, byte for byte

After the four files are edited they hash to the gated files (sha256, the first sixteen hex): `src/db.ts` 206,843 bytes `771231ada4912288`, tail `}`; `src/rad.ts` 26,492 `3027824f158d6c1f`, tail `}`; `test/rad.test.ts` 13,123 `21a080e88e7e0f0a`, tail `});`; `scripts/smoke.mjs` 674,156 `233af51816708362`, tail `});`. The app tree (from `app/`: `(find src test scripts migrations -type f; echo wrangler.toml; echo tsconfig.json; echo package.json) | LC_ALL=C sort | xargs sha256sum | sha256sum | cut -c1-16`) reads `516bc3f2b239e24a`; the Scribe re-hashes it on the disk at the hand-back. A hash that differs is not reshaped into agreement: write the difference in the report and stop.

## Gates and the hand-back

`npm run typecheck` 0; `npx vitest run` under `TZ=UTC` and under `TZ=America/New_York`, 72 files, 1004 tests; `node --check scripts/smoke.mjs`; the from-zero smoke at pin 85 (`About to apply 85 migration(s)`, `SMOKE PASS`, no ` 500 ` line); dash audit 0 (U+2014, U+2013) and no CR byte on the four files; no personnel data; no key, secret or password. Report `SESSION_REPORTS/2026-10-01_the_rad_available_law.md` in the worktree with the sealed final check (the four files' sizes, hashes and tails; the typecheck, the two vitest lines, the node check, the smoke line). Commit nothing, push nothing, deploy nothing, run no git. Hand back in chat: one paragraph (the worktree, the four files, the gates, "nothing committed, no git run") and the seal. The Scribe verifies the tree on the disk, folds canon, and the merge block of the gate report carries V9 and this fix in one commit.
