# 2026-09-24 The unfinish

Brief K, canon 0.30.220. One PIN-gated Unfinish on every Complete pane of trim, pasteurization, and prepack. It returns the row to Working and removes the next process's next-in-line record when that record is still waiting. On a finished pasteurization run's page, one container or one output can be unfinished at a time. The Testing Queue's Demote on a cryo-born output is that output unfinish. No migration. The head stays 0074. Not deployed.

## What landed

Every completed row on the three scheduling Complete panes posts `POST /production-scheduling/<stage>/unfinish/<id>` with `unfinish_pin`. The scheduling `/demote/<id>` route is gone. The Data Queues Demote stays. A wrong PIN refuses with `Unfinishing a completed item needs the Admin PIN.` and writes nothing.

Trim: an empty scheduled pasteurization run on the same HBN is soft-deleted under `schedule unfinish`, and the flash names the HBN. A run with outputs, or a finished run, refuses by name and nothing is written. No run: the row alone returns to Working.

Pasteurization, the run: consumed containers go pasteurized to cryo_queue by `cryo_unconsumed`, and each child ledger item's grams return to the container's `weight_grams`. Every output the run bore is voided with its ledger item. The run returns to Working. The flash counts the containers and the outputs. A released, packed, or gone output, a sample, a marked test-sample file, a marked New Packages file, or a container whose ledger item moved or was voided refuses by name.

Pasteurization, one at a time: on the finished run's page each consumed container has Unfinish (back to the Cryo Queue, its `cryo_run_inputs` row removed, so the pool's In shrinks). Each output has Unfinish in place of the void link (both rows voided, grams back to the pool). A working run still voids an output with the void link. Unschedule still frees a working run's containers; container Unfinish refuses while the run is scheduled. A marked New Packages file refuses both. Finished runs stay listed on Cryo Weight Entry so the page can be opened again.

Testing Queue: Demote on a package whose `source` is cryo asks for the Admin PIN and voids that output. A trim container's Demote is unchanged. `demoteStep` ignores `cryo_unconsumed` and `prepack_unpacked`, so the Cryo Queue stays a birth status and a released package still steps back to the Testing Queue.

Prepack: the job returns to Working, the parent goes packed to released by `prepack_unpacked`, and the parent's grams are restored from the finish's own qty log (`prepack finish...`, `old_value`). An untouched carry is voided. A drawn carry or a marked `package_finish` or `new_packages` file refuses by name. The lines and their finished-goods items stay.

## Assumptions for your word

- The run unfinish voids every output the run bore. It does not keep the lines.
- Unfinishing one container removes it from a finished run's pool. The run stays finished. The over-issue flag reads the new remaining and does not block.
- Unfinishing one output voids it and leaves the run finished.
- Testing Queue Demote on a cryo-born package voids the output. It does not step the status to cryo_queue.
- Prepack grams come from the finish's qty log row, the `old_value` under a reason that starts `prepack finish`.
- A refusal does not cascade. The named record has to be unfinished or voided first.
- A sample is a live `test_samples` row whose order's source package tag is the output. A marked test-sample file is a live `metrc_uploads` row of kind `test_sample` whose manifest holds that sample.
- Finished runs are listed on Cryo Weight Entry beside the working runs, so a container or an output can be unfinished after leaving the page.
- Spanish uses Reabrir for Unfinish.
- On the from-zero smoke floor the trim HBN already has a finished pasteurization run, so that trim Unfinish refuses by name (`is finished`). The empty-run success (the run soft-deleted, the trim row back to Working) is in `test/unfinish.test.ts`.

## Gates

- `npx tsc --noEmit`: exit 0.
- `npx vitest run`: 51 files, 870 tests passed. The same under `TZ=America/New_York`.
- `node --check scripts/smoke.mjs`: exit 0.
- From-zero smoke (`SMOKE_PORT=9154`, `WRANGLER_SEND_METRICS=false`): `About to apply 74 migration(s)`, `SMOKE PASS`, ` 500 ` lines: 0, exit 0. A finished run's Unfinish raised the Cryo Queue and lowered the Testing Queue. One container of a second finished run shrank that run's pool In. The trim Unfinish on that floor refused because the HBN's other run is finished.
- Dash audit: 0 on the files below (U+2014 and U+2013).
- `METRC_INTEGRATOR_KEY = "` and `METRC_USER_KEY = "` appear in no file under `src`, `test`, `scripts`, or `wrangler.toml`.

## Deploy

Not deployed from this session. No migration rides. The head stays 0074 and the next free number stays 0075. The Scribe hands the worker-only line.

## Sealed final check

```
npx tsc --noEmit                      exit 0
npx vitest run                        51 files, 870 tests passed
TZ=America/New_York npx vitest run    51 files, 870 tests passed
node --check scripts/smoke.mjs        exit 0
SMOKE_PORT=9154 WRANGLER_SEND_METRICS=false node scripts/smoke.mjs
                                      About to apply 74 migration(s); SMOKE PASS; " 500 " lines: 0; exit 0

src/config.ts                     66906  b7212ab64507db0f  tail: }
src/scheduling.ts                 20929  016a9dda9d549e9b  tail: }
src/cryo.ts                       25305  c1b44fc08ba01cb7  tail: }
src/actions.ts                   310690  8f91ec6b180a65fb  tail: export { MANIFEST_COLUMNS, buckedPackageCode };
src/index.ts                     136298  171202644f5b7d16  tail: export default worker;
src/html.ts                      187031  b10ffccc8d147872  tail: }
src/db.ts                        167077  c1fa473e46cb5d25  tail: }
src/i18n.ts                      166562  c1a144421ed38fb4  tail: }
test/scheduling.test.ts           21980  59de0188fd523033  tail: });
test/cryo.test.ts                 29197  5d4946ea806ae682  tail: });
test/unfinish.test.ts             20227  4b2a628fb9e5b3d8  tail: });
scripts/smoke.mjs                580669  c394bc7dfe22305e  tail: });
```
