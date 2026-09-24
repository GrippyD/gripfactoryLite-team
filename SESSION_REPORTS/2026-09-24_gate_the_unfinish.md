# 2026-09-24 The gate on the unfinish (canon 0.30.221)

Scribe session. The gate on his Code session's `SESSION_REPORTS/2026-09-24_the_unfinish.md` (brief K, THE UNFINISH, canon 0.30.220; no migration, the head stays 0074). The report says "Not deployed from this session"; nothing was deployed before this gate. No Scribe change to `app/`. His hand-back, verbatim in part: "Brief K is in. Every Complete pane on trim, pasteurization, and prepack now has one PIN-gated Unfinish. It returns the row to Working only after it has read the next process, and it writes nothing if that next record was already worked. ... No migration. The head stays 0074. Not deployed. tsc is clean. Vitest is 51 files, 870 tests, in both time zones. The from-zero smoke passed at pin 74 with no 500. On that floor the trim Unfinish refused, because that HBN already has a finished pasteurization run. The empty-run success is in `test/unfinish.test.ts`."

## What was gated

1. The tree was hashed on the device after the build session went quiet (the last file under `app/` moved at 16:37 device time with the report; the hash at 16:40, after his hand-back) and compared with the Scribe's sandbox, which held the tree of canon 0.30.219 (45b21f74675c2f47, 209 files) byte for byte. Twelve files differed, exactly the twelve of the report's seal, one of them new (`test/unfinish.test.ts`); every other file hashes identical. After the copy the two trees hash identical (62db22f3fd63a879, 210 files). The migration head is 0074.
2. The twelve were staged, verified against the seal (size and sha256, all twelve), copied into the sandbox and verified again there.
3. Read against the brief's nine laws. ONE WORD, ONE CONTROL: `unfinishForm` on every Complete pane of the three stages (`name="unfinish_pin"`, `POST /production-scheduling/<stage>/unfinish/<id>`); the `/demote/:id` scheduling route is gone; the Data Queues' Demote stays; `SCHEDULE_REFUSAL.demotePin` reworded to Unfinishing; `SYSTEM_REASON.schedule_unfinish` on every row. CHECK EVERYTHING, THEN WRITE ONCE: `unfinishScheduleItem` reads the row and the PIN, then the stage branch reads every downstream record (`markedUpload`, `outputSample`, `markedTestSampleFile`, `assertOutputUntouched`, `unconsumeStmts`' item checks) before one `db.batch`; every refusal is a `refusal()` with the record's name in the words and is thrown before the batch. TRIM (`unfinishTrim`): the HBN's cryo runs read; a complete run refuses `The run on {hbn} is finished; unfinish it first.`; a run with outputs refuses with the count; a scheduled empty run is soft-deleted under the unfinish reason and the flash names the HBN; no run, the row alone. PASTEURIZATION, THE RUN (`unfinishCryoRun`): the New Packages mark checked first, every output checked (status testing_queue, no live sample, no marked test-sample file), every pasteurized input returned by `cryo_unconsumed` with its child item's grams restored (refused when the item is voided or not at 0 g), every output voided with its item, the run reopened, the flash counting both. ONE AT A TIME: `unfinishCryoContainer` (refused while the run is scheduled or its New Packages file is marked; the container unconsumed, its `cryo_run_inputs` row deleted with a log row on that table) and `unfinishCryoOutput` (source cryo only; the output and its item voided; refused when released, packed, gone, sampled or in a marked upload); on a finished run's page `consumedList` carries Unfinish per container (`data-cryo-input`) and each output's void link becomes Unfinish; finished runs now list on Cryo Weight Entry beside the working ones so the page can be opened again; the Testing Queue's Demote on a `source` cryo row (the queue now reads `p.source`) carries the PIN field and the unfinish warning and routes to `unfinishCryoOutput`; `demoteStep` ignores the two reverse transitions so a birth status stays one. PREPACK (`unfinishPrepack`): the job's `package_finish` and `new_packages` marks checked; the parent must read packed; its grams read from the finish's own qty log row (`reason LIKE 'prepack finish%'`, `old_value`), refused when absent; an untouched carry voided, a drawn carry refusing with the job that drew it; the job reopened, the parent to released by `prepack_unpacked`, the item's grams restored; the flash with the tag and grams. THE WORDS: twenty-six new strings with Spanish (Reabrir for Unfinish). THE TESTS: `test/unfinish.test.ts` (eleven cases: the trim unfinish with an empty run, with a run holding outputs, with a finished run; the run unfinish and its three refusals; one container and its refusal; one output and its refusals; the Testing Queue Demote routing; prepack with the carry and the two refusals; the wrong PIN on every act; the finished run's page markup), `test/scheduling.test.ts` and `test/cryo.test.ts` reworded to the new control, `scripts/smoke.mjs` walking a run unfinish (the Cryo Queue rising, the Testing Queue falling), one container of a second finished run (the pool's In shrinking), and a trim unfinish that either unschedules an empty run or refuses by name. NOTHING ELSE MOVES: `pipeline.ts`, `prepack.ts`, `metrc.ts`, `sheetsync.ts`, `theme.ts` did not move; the finish paths, Unschedule and `>>` are unchanged in the diff.
4. THE LANDING, READ IN THE DATABASE. The smoke's local D1 after the walk: six kinds of log rows under `schedule unfinish` (two `production_schedules` status rows: the trim row and the reopened run; three `wip_packages` status rows pasteurized to cryo_queue; one `wip_packages` and one `local_inventory_items` `deleted_at` row: the reopened run's output `...C91` and its item, 10 g; three item `qty` rows; one `cryo_run_inputs` row for the container unfinish). The container `SHK-OLGA-1` reads cryo_queue at 30 g with its item at 30 g (consumed by the first run, returned by the run unfinish, consumed again by the second run, returned by the container unfinish); `SML-VIC-1` stays pasteurized at 0 g inside the second run, which stays finished, as the one-at-a-time law says. The reopened run `a1249e8c` reads scheduled; the routes answered 403 twice (no PIN, the Models PIN), 303 on the trim unfinish, 303 on the run unfinish, 303 on the container unfinish, and 400 on the final trim unfinish (the HBN's other run finished), as the report says.

## Gates on the tree as received (the Scribe's sandbox)

- `npx tsc --noEmit`: exit 0.
- `npx vitest run`: 51 files, 870 tests passed; the same under `TZ=America/New_York`.
- `node --check scripts/smoke.mjs`: ok.
- From-zero smoke (`SMOKE_PORT=9098`): `About to apply 74 migration(s)`, `SMOKE PASS`, no 500; exit 0 once the dev server was ended by pid.
- Dash audit: 0 on the twelve files and the build report.
- Secret grep (`METRC_INTEGRATOR_KEY = "`, `METRC_USER_KEY = "`, `MS_CLIENT_SECRET = "`, `cfas[t]_`): no matches in the slice.

## His word: the report's ten assumptions and four the Scribe adds

The ten stand as the report states them. Four more, read in the code:

- A run input whose status is not pasteurized (gone, for one) is skipped by the run unfinish rather than refusing; the item checks (voided, or not at 0 g) do refuse. A container that left the license in METRC cannot return to the queue, so the skip reads right; it is not the refusal the brief's words asked.
- The Testing Queue's control on a cryo-born row still carries the label Demote while its warning and its act read Unfinish; one word on the button is a later slice if he wants it.
- The PIN reader also accepts a field named `pin` beside `unfinish_pin`; every form the slice renders posts `unfinish_pin`.
- The smoke's trim unfinish takes either branch (an empty run unscheduled, or a refusal by name); on the from-zero floor it refuses because the HBN's other run is finished, and the success is proven in the unit test alone.

## Deploy (his hands; worker-only, no migration rides)

```powershell
cd "C:\Users\DennisWallace\Documents\Claude\Projects\gripfactory Practical\app"
npm run deploy:grip
```

THE PROBE: a finished pasteurization run's page on Cryo Weight Entry listing its consumed containers with an Unfinish beside each. After LIVE, his hands: one unfinish on each surface with the Admin PIN, reading the next process's queue after each.

## Sealed final check

```
npx tsc --noEmit                      exit 0
npx vitest run                        51 files, 870 tests passed
TZ=America/New_York npx vitest run    51 files, 870 tests passed
node --check scripts/smoke.mjs        ok
rm -rf .smoke-persist && CI=1 SMOKE_PORT=9098 WRANGLER_SEND_METRICS=false npm run smoke
                                      About to apply 74 migration(s); SMOKE PASS; " 500 " lines: 0; exit 0
the build session's seal (12 files) verified byte for byte on the device and in the sandbox:
src/config.ts                                  66906  b7212ab64507db0f
src/scheduling.ts                              20929  016a9dda9d549e9b
src/cryo.ts                                    25305  c1b44fc08ba01cb7
src/actions.ts                                310690  8f91ec6b180a65fb
src/index.ts                                  136298  171202644f5b7d16
src/html.ts                                   187031  b10ffccc8d147872
src/db.ts                                     167077  c1fa473e46cb5d25
src/i18n.ts                                   166562  c1a144421ed38fb4
test/scheduling.test.ts                        21980  59de0188fd523033
test/cryo.test.ts                              29197  5d4946ea806ae682
test/unfinish.test.ts                          20227  4b2a628fb9e5b3d8
scripts/smoke.mjs                             580669  c394bc7dfe22305e
tree hash after the copy, device and sandbox: 62db22f3fd63a879 (210 files)
the build report: SESSION_REPORTS/2026-09-24_the_unfinish.md  6211  327cb4b1fdf03fa9
dash audit: 0 on every file above
secret grep: no matches
```
