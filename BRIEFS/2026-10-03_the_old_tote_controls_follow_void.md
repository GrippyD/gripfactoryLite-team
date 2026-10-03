# BRIEF V27a: THE OLD TOTE CONTROLS FOLLOW VOID'S LAW (canon 0.30.375)

A mini-brief, built in the same session as BRIEF V27, A FARM WITH NO TRIMMED LOT BORROWS THE SEASON'S BTR (`BRIEFS/2026-10-03_arl_borrows_the_season_btr.md`), and shipped in V27's one commit and push: build V27 first, then this, one report for both. For the build session (Claude Code or Cursor) opened in the worktree `branches/GFLiteOpsDashboard` (its `app/` is the app), under THE DISPATCH RULE (canon 0.30.155). The tree pin is V27's (the Scribe writes it into V27 at the paste). No migration; the smoke pin stays 90.

## The sources (verbatim)

The owner, 2026-10-03, in chat: "Write a mini-brief that I can point the next code agent to, if it's possible to fold the fix in with v27's push that would be great".

The two gaps, from the V26 gate (`SESSION_REPORTS/2026-10-03_gate_finished_lots_found.md`, items 5 and 6) and V26's own report (`SESSION_REPORTS/2026-10-03_finished_lots_found.md`): "The existing tote pencil and × (`/record/wet_weights/:id/edit` and `/void`, on both weigh screens) still change a tote of a finished lot without the status check and without moving the package's `qty`"; and "a tote weighed after a Reopen is not yet in the package's `qty` (the Demote leaves the package as it was; the next finish sets it to the lot's total), so voiding that tote before the next finish lowers the package by grams it never held."

## The law

1. ONE RULE FOR EVERY TOTE CHANGE. A single function (in `src/finishedlots.ts`, beside `voidFinishedTote`) decides and batches every change to a tote's grams: V26's Void, the record void (`/record/wet_weights/:id/void`), the record edit of `weight_grams` (`/record/wet_weights/:id/edit`), and any restore of a voided tote the record layer offers (say in the report whether one exists). Each route calls it; none keeps its own path to `wet_weights` grams.
2. BY THE LOT'S STATUS.
   - `weighing`: the tote changes, the lot's total is recomputed and logged as today, and the lot's wet package is NOT touched (a weighing lot's package is set by the finish; this closes the second gap for V26's Void too).
   - `in_transit` or `drying`: the tote changes and, in the same batch, the lot's total and its one live wet package (SPR or WIP) move by the same grams (down on a void or a lower weight, up on a higher weight or a restore), each logged with the reason; V26's refusals all stand (more than one live package, a package with children, a package that has left its space, a package that would go below zero).
   - `unloaded`, `trimmed`, `frozen`: refused on every route in V26's words (the wet weight is closed; ask the Scribe for a repair).
3. THE REASON AND THE GATE. A void, an edit of grams and a restore each need a reason (the record edit's existing reason field if it has one, else a required one added) and run behind the gate the route has today; V26's Void keeps the Admin PIN. An edit that changes no grams (a field load, a note) is not this law's and passes as today.
4. WORDS: EN and ES for any new refusal or label.

## The tests and the smoke

- Unit: the record void and the record edit on a drying lot move the lot and its package by the grams in one batch, logged with the reason; on a weighing lot (a reopened one with a minted package) the package is untouched by a void, an edit or V26's Void, and the next finish sets its `qty` to the lot's live total; on unloaded, trimmed and frozen every route refuses; V26's refusals hold on the record routes; an edit of a field that is not grams passes untouched.
- Smoke: on Penn North Harvest, a drying lot's tote lowered by the pencil lowers the lot and its package; a reopened lot's tote voided leaves the package as it was, and finishing the lot sets the package to the lot's total.
- Gates as always, once for V27 and this together: typecheck 0; vitest under `TZ=UTC` and `TZ=America/New_York`; `node --check scripts/smoke.mjs`; the from-zero smoke (SMOKE PASS, no ` 500 `). Dash and CR audits by character; no personnel name in a tracked file. No git; nothing committed, pushed or deployed. One report to `SESSION_REPORTS/` for V27 and V27a with the tree hash and every file touched.
