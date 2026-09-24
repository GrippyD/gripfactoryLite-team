# Session report: [Demote] on the Data Queues, 2026-09-02

**Scribe:** Gripfactory Lite Scribe (Cowork), Scribe-direct build under G-2.
**Ruling (owner, verbatim):** "Add a [Demote] button on the data queues menu for each record. Clicking it prompts the user with a warning and kicks the record back down to the last process it was at"

## The law shipped

Demote is the transition graph run backward, one step, derived rather than hand-written: `demoteStep(entity, status)` in src/config.ts inverts STATUS_TRANSITIONS, so any future transition is covered automatically. A status with no inbound transition is a birth status (open, weighing, created, cryo_queue): nothing to demote to, so its queues carry no button and a forced POST refuses with a clear 400. trimmed alone has two inbound edges (the Dry Space Queue's manual exit and the Unloaded Queue's trim), so its target resolves from the record's own status history at demote time (its previous demote rows excluded, so repeated demotes walk down and never bounce), defaulting to unloaded, the standard flow since 2026-08-31; no queue lists trimmed rows today, so this path is law-in-waiting.

The button rides rowControls on exactly the queues whose status can step back: Dry Space (drying to weighing), Unloaded (unloaded to drying), Inbound (in_transit to weighing), Testing (testing_queue to cryo_queue). The HBN and Cryo queues are birth-status queues and carry none; a routing test asserts the control list and the graph agree queue by queue, so they can never drift apart. The warning is a client confirm on the form ("Demote kicks this record back to the last process it was at. Continue?", es "Degradar regresa este registro al proceso anterior en el que estuvo. Continuar?"); the step itself logs to record_change_log (field status, old and new values, reason "demoted") like every state change, and flashes "Record demoted." back on the Data Queues. Side effects follow from status by construction: a demoted drying lot rejoins the wet station's resume list and its batch re-enters the wet pane; a finished lot's METRC file un-pends and re-pends on re-finish, the existing re-pend law. The entity name reaches SQL only through an allowlist (harvest_batches, wet_weight_entries, wip_packages).

## Files changed

- `src/config.ts`: SYSTEM_REASON.demoted; demoteStep() derived from STATUS_TRANSITIONS.
- `src/pipeline.ts`: QueueControlDef gains the demote variant; the four demotable queues declare it.
- `src/actions.ts`: runQueueControl takes the queue's entity; the demote branch (graph step, history resolver for trimmed, reasoned log, allowlisted SQL).
- `src/index.ts`: the control route passes queue.entity; the "demoted" flash.
- `src/html.ts`: controlForm's demote branch with the confirm warning, secondary-styled beside the queue's own exits.
- `src/i18n.ts`: Demote / Degradar, the warning, the flash.
- Tests: routing (graph inversions, birth nulls, trimmed candidates, controls-match-graph invariant), surface (the rendered confirm form on a demotable queue, none on a birth queue, updated rowControls fixtures).
- `scripts/smoke.mjs`: end-to-end walk on the guard batch: finish a lot into the Dry Space Queue, see the Demote control with its warning (and its absence on HBN rows), demote, watch the lot leave the queue and stand at the wet station as weighing again, find the reasoned log row, and refuse the second demote 400.

No screenshots this slice: the button renders through the existing row-actions pattern already proven visually; the markup is pinned by tests and the flow by smoke.

## Also logged this sitting (owner, mid-build, verbatim, HELD pending his naming conventions doc)

"Tags are assigned during the wet weight process, they're merely adopted by dry weight. The wet weight tag is always the same type: 'WIP' for wet going into silos and 'WSP' for wet spears being hung then DSP (dried spears) then WIP itself at the dry weight station. WIP Packages become: BUD NUG TRI SHA BIO in the trim room. Their storage in Cryo Queue and not in the warehouse is how we determine the WIP inventory, when it graduates to the warehouse but doesn't have a test pass testing status in metrc, we say it's 'in testing'. And everything that makes it past that gate goes on Zoho as a FG." Followed by: "Sorry, let me send you the naming conventions. Regs make everything harder than it needs to be. Words like 'package type' and even just 'package' carry extra water than normal." Nothing built on this; the TRI-vs-TRIM and NUG/SHA lookup questions wait on the document.

## Sealed final check

```
cd /home/claude/deploy/app
npx tsc --noEmit                      -> exit 0
npx vitest run                        -> Test Files 9 passed (9), Tests 300 passed (300)
node --check scripts/smoke.mjs        -> ok
LC_ALL=C grep -c dashes               -> 0 on every written file
rm -rf .smoke-persist && SMOKE_PORT=8969 WRANGLER_SEND_METRICS=false timeout 280 npm run smoke
                                      -> SMOKE PASS (exit 124 is the expected dev-server timeout kill)

src/config.ts         15533 bytes  sha256:9e504a61c26ff4b2
src/pipeline.ts       19404 bytes  sha256:6e438a7e3d276fcd
src/actions.ts        44473 bytes  sha256:1cec243a2121be8b
src/index.ts          36064 bytes  sha256:b795ef7ce058ce2f
src/html.ts           60160 bytes  sha256:a2e3097d54f502c5
src/i18n.ts           16169 bytes  sha256:bab2bc2a9180c863
test/routing.test.ts  18681 bytes  sha256:cd18e56551b2b8fd
test/surface.test.ts  61373 bytes  sha256:f347c9f4f25fe1ef
scripts/smoke.mjs     94163 bytes  sha256:5380cec0d5c02289
```

No migrations. Worker-only deploy; rides with the still-undeployed 0.15.2 Admin button lock in one PS run.
