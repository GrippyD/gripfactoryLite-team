# 2026-09-15 THE HBN THAT CAME BACK (canon 0.30.84)

Scribe-direct under G-2. Owner report 2026-09-15 on the live 0.30.83 floor, with two screenshots of the wet weight station at PNS, verbatim: "This one is interesting.  For some reason, they're weighing an HBN from yesterday at PNS.  Wrong HBN, wrong farm, wrong everything.  This was the actual first lot yesterday.  The issue started when they unloaded the silo." His pick on the repair fork: "HBN pencil on the lot".

## What was found

The wet weight pane hides an HBN once it has a finished lot (owner ruling 2026-08-28: "weighing lot keeps the batch visible; finished lot removes it"). The finished statuses were spelled out that day as drying, in_transit and trimmed. The Unloaded Queue and its status `unloaded` arrived on 2026-08-31 and the list was never widened, so Finish unload on yesterday's first lot (26010, PNN) moved it drying to unloaded and the HBN walked back into the pane. At PNS the pane showed one HBN, the crew picked it, the blank header opened (no weighing lot on it), and today's PNS harvest went onto yesterday's PNN HBN: 1,560,596.00 g, Truck 4, bucked, on a lot no one meant to start.

## The law

1. Finished means every lot status but weighing. The pane hides a batch that has a finished lot and no weighing lot; a weighing lot keeps the batch in the pane for its resume, finished lot beside it or not (the 2026-08-28 words, and the 2026-09-01 guard that an in-progress lot must never hide). Before this the batch hid the moment any lot finished, even while a new lot weighed on it.
2. The lot record carries a reasoned pencil field HBN, first on the edit page: a select over every harvest batch (open ones first, newest first, labeled farm / strain / date with the HBN, a complete one marked), the lot's own batch selected. A weighing lot moves to an open HBN with a reason, weights and all; the change lands in record_change_log as field harvest_batch_id.
3. Refusals in words: a lot that has finished ("Only a weighing lot can move to another HBN; this lot has finished against its HBN.", since Finish lot minted its package and pended its CSV under the HBN it had); a complete HBN ("Pick an open HBN."); an unknown one (404); a blank ("Pick an HBN."). An absent field (an older form) leaves the HBN alone.
4. The canon 0.30.9 boundary law now covers gram fields on the pencil: a gram field absent from the posted form is unchanged, never NULL (a partial post used to fail on the lot's NOT NULL weight_grams).

## What changed

- `src/db.ts`: `NO_FINISHED_LOT_SQL` rewritten (`w.status <> 'weighing'`, with the weighing-lot clause); lookup `harvest_batches`.
- `src/pipeline.ts`: `LookupName` harvest_batches; `EDITABLE_FIELDS.wet_weight_entries` gains HBN first.
- `src/actions.ts`: `editRecord` guards the HBN move; gram fields honor absent-is-unchanged.
- `src/index.ts`: the edit page loads the HBN options for a lot.
- `test/routing.test.ts`: the pane filter describe rewritten for the two clauses; `test/hbn_pencil.test.ts` (+6): the field, the move and its log row, the four finished refusals, the complete and unknown HBN, the unchanged and absent cases.
- `scripts/smoke.mjs`: after Finish unload the unloaded lot's batch stays out of the pane and the pane's open batch is the second HBN; the edit page offers the HBN select with the lot's batch selected and the HBN printed; the weighing lot moves to the unloaded batch (its panel shows the new HBN, keeps 200.00), which brings that batch back into the pane; a finished lot's move is refused 400; the lot moves back and the batch hides again; the change log carries the reason and the field. The wet lot view pin flipped: a weighing lot's batch is now marked in the pane beside a finished lot.

No migration; no route change.

## The floor repair (his hands, after the deploy)

1. Acquire HBN: mint today's PNS HBN (PNS / the strain / 2026-09-15).
2. Admin, Data Queues, Weighing Queue: the wrong lot's row (1,560,596.00 g, Truck 4), Edit.
3. HBN: pick the new PNS HBN; Reason: what happened; Save. The weights ride along; the lot's panel and CSV read the PNS HBN from then on.
4. The pane at PNN stops showing 26010 as soon as the lot has moved (a finished lot and no weighing lot).

## Lesson from the gate

The diagnostic dev servers I start on a smoke's leftover database must be killed when done: three orphaned `wrangler dev` trees (one at a 4.5 GB heap) starved the sandbox until even `echo` hung. Start with a recorded PID and kill it, or `timeout` it.

## Gates

- `npx tsc --noEmit`: 0 errors.
- `npx vitest run`: 27 files, 614 tests passed.
- From-zero smoke: "About to apply 50 migration(s)", SMOKE PASS.
- Dash audit: 0 on every changed file.
- Visual pass: the lot edit page in Lite and Cerberus with HBN first and the current batch selected.

## Deploy (his hands, worker only)

From `app/`: `npm run deploy:grip`.

## Sealed final check

```
src/db.ts                  124895  a8f421a9cec1045a
src/pipeline.ts             44642  38879b83d70c647e
src/actions.ts             226944  7e202f72065bc273
src/index.ts               109164  3288423c200ef9d9
test/routing.test.ts        35986  679b63111d2417e8
test/hbn_pencil.test.ts      7787  c8eaf627dfb41f1e
scripts/smoke.mjs          364068  66f33866145139f0
tsc: 0 errors; vitest: 27 files, 614 tests passed
smoke: About to apply 50 migration(s); SMOKE PASS
dash audit: 0 on every file above
```
