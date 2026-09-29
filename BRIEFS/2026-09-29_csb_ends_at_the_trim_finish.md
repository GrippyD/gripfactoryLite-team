# BRIEF V13: CSB ENDS AT THE TRIM FINISH (canon 0.30.303)

For the build session (Claude Code or Cursor) opened in the worktree `branches/GFLiteOpsDashboard` (its `app/` is the app), under THE DISPATCH RULE (canon 0.30.155), the slice his ruling of 2026-09-29 adds to THE BRANCH PLAN (`BRIEFS/2026-09-28_the_branch_plan.md`) on THE CURE PANES (canon 0.30.164), built before V5 unless he says otherwise. Canon wins over this brief where they differ; read `canon/_NOW.md` first. No migration; the smoke pin stays at 80. Commit nothing, push nothing, deploy nothing, run no git.

## The ruling (owner, 2026-09-29, verbatim)

"Right now there should only be 4 lots in CSB, the system shows more. I'm guessing nothing gets them off the pane. CSB is over when the lot is finished in trimming."

## What the Scribe read (main `0d5b502`, the tree `5e2160baab072768`; the floor from the 9/29 snapshot `20260929-072133_pre_silos_only`)

1. THE LAW OF 9/21 (`src/cure.ts`, `cureMembership`): CSA holds a lot with status `unloaded` and no live trim row; CSB holds a lot with status `unloaded` or `trimmed` and a live trim row (any `production_schedules` row of stage `trim` not deleted, scheduled or complete) until one of its containers is taken into a cryo run (`in_cryo`). Frozen, voided and cryo-taken lots sit on neither.
2. THE FINISH IN DATA. A lot's trimming finishes when its trim schedule row completes: `production_schedules.status` becomes `complete` with `completed_at` and `completed_by` (`completeScheduleStmts`, reason `schedule_complete`), from the scheduling page's Complete and from the trim packages station's reconcile (`completeTrimScheduleForLot`). The lot's own status moves to `trimmed` only through the station's remove or adjust choice, which the floor often leaves undone: 21 lots today are `unloaded` with a complete trim row.
3. THE FLOOR, worked by hand on the snapshot: 40 live lots are `unloaded` or `trimmed`. The 9/21 law puts 13 in CSA and 11 in CSB. Of the 11, seven have a trim row completed between 9/23 and 9/28 and no cryo container (26016, 26034, 26037, 26038, 26039, 26041, 26047), so nothing ever takes them off the pane; four have a trim row still scheduled (26042, 26043, 26045, 26048). His count is those four. No lot on the pane has a container in a cryo run, so the cryo exit never fired.
4. THE READERS: `listCurePanes` feeds the cure tiles on the console, `/ops/drying_ops` and the scheduling pages, and `cureLots: [...csa, ...csb]` feeds the console's drying totals (the cure grams and lots). `test/cure.test.ts` pins the membership and the panes.

## The law to build

1. CSB IS THE TRIM QUEUE. A lot is on CSB when its status is `unloaded` and its newest live trim row (stage `trim`, not deleted, the latest `scheduled_at`) has status `scheduled`. It leaves CSB the moment that row completes (`status` `complete`), and sits on neither pane after. A lot whose trim row is deleted (unscheduled) returns to CSA, as today. A `trimmed` lot is off both panes.
2. THE CRYO EXIT RETIRES. A container taken into a cryo run no longer moves a lot off CSB; the lot stays until its trimming finishes (the assumption below). `in_cryo` leaves `LOTS_SQL` and `cureMembership` loses `cryoLive`; frozen and voided lots still sit on neither.
3. THE IN-TIME. CSB's in-time stays the trim row's `scheduled_at`; CSA's stays the unload finish. The moisture readings, the conditions line, the tile marks: untouched.
4. THE TOTALS FOLLOW. The console's drying totals count the same lots the panes show, so the cure figures drop with the pane.
5. NOTHING ELSE MOVES. The panes' place on the strip, the sensor door, the rooms list, the flags: untouched. No migration; no data repair, the law alone brings CSB to his four.
6. THE PROOFS. `test/cure.test.ts`: `cureMembership` with a scheduled trim row is CSB; with a complete trim row is neither pane; `trimmed` with any row is neither; a deleted row is CSA; frozen and voided are neither; the fixture of `listCurePanes` gains a lot with a complete trim row that must not be listed and a lot with a scheduled row that must. `scripts/smoke.mjs`: the walk that schedules a lot for trim sees it on CSB, completes the trim row and sees it gone from CSB and not on CSA.

## Assumptions for his word

- "Finished in trimming" is the trim schedule row completing, the finish the scheduling page and the trim station both record. The lot's own `trimmed` status, which the reconcile sets later or never, is not the signal.
- The 9/21 cryo exit retires: a lot whose container reached a cryo run before its trim finished stays on CSB until the finish. On the floor today this changes no lot.
- The four he counts are 26042, 26043, 26045 and 26048; the seven that leave are the finished ones above.

## Files

`src/cure.ts` (`LOTS_SQL`, `cureMembership`, `listCurePanes`); `test/cure.test.ts`; `scripts/smoke.mjs`; `src/i18n.ts` only if a display string changes (none expected).

## Gates and the hand-back

`npm run typecheck` 0; vitest both zones; `node --check scripts/smoke.mjs`; the from-zero smoke at pin 80 with `SMOKE PASS` and no 500; dash audit 0 on every file touched; no personnel data; no key, secret or password. Report `SESSION_REPORTS/<date>_csb_ends_at_the_trim_finish.md` in the worktree with the sealed final check and the assumptions above. Commit nothing, push nothing, deploy nothing, run no git. His hands after the gate: the pre snapshot from the main folder's `app` with the block stopping on its failure, `git checkout -- canon` in the main folder before the merge, then the three acts.
