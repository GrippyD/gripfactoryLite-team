# Session report: the Logistics Moves data queue (canon 0.26.2), Scribe-direct, 2026-09-06

**Scribe:** Gripfactory Lite Scribe (Cowork), Scribe-direct under G-2. Owner ruling, verbatim: "I guess that it also demonstrates that logistics moves, like everything else, needs a place in the data queue in Admin as well. I purged all inventory transactions, but the logistics one seem to only exist on the interco node."

## What shipped (worker only, no migration)

Admin, Data Queues gains a **Logistics Moves** section: every non-deleted movement (interco, virtual, external), newest first, with when, kind, from, to, truck, status (with a received count when partial), and item count.

The reasoned void, one law shared by the renderer and the action (movementVoidBlock in src/interco.ts, pure): a movement with any received item REFUSES the void in words ("Un-receive its receipts first.", pointing at the existing receipt controls); otherwise the row carries a required-reason void form. voidLogisticsMove (src/actions.ts): a building movement simply dies (nothing was flipped); a completed movement's items return from IN-TRANSIT to the origin side (the origin farm's barn on an interco move per the barn pick basis law, CSB on an external one), each return reasoned through the existing setItemQtyLocationStmts seam (new SYSTEM_REASON.inv_move_voided); the movement and its item rows soft-delete with the typed reason (status voided), the void logged. The one-export-home stays consistent for free: the pending Manifests query already filters deleted movements, so a voided movement's unmarked manifest drops off /admin/uploads.

Files: src/interco.ts (the pure guard), src/db.ts (MovementQueueRow, listMovementQueueRows), src/html.ts (movementsQueueSection; dataQueuesPage gains the section), src/actions.ts (voidLogisticsMove), src/config.ts (the reason key), src/index.ts (the route and the queue page fetch), src/i18n.ts (seven EN/ES keys), test/walk.test.ts (guard and render pins), scripts/smoke.mjs (the queue walk).

## Sealed final check

```
cd /home/claude/deploy/app
npx tsc --noEmit                      -> exit 0
npx vitest run                        -> Test Files 15 passed (15), Tests 403 passed (403)
node --check scripts/smoke.mjs        -> ok
Dash audit (9 touched files)          -> 0
rm -rf .smoke-persist && SMOKE_PORT=9057 WRANGLER_SEND_METRICS=false timeout 280 npm run smoke
                                      -> SMOKE PASS, "About to apply 28 migration(s)" from zero
Smoke walks added: the received movement rides the queue and refuses the void in
  words AND by 400; a building movement voids reasoned (303), leaves the queue,
  and the change log carries the reason.

src/interco.ts   e948223d54fa2d34    src/db.ts       a2c04d3426ae87b0
src/html.ts      79e04b2420f04473    src/actions.ts  4942e7bb119002e0
src/config.ts    3180df0ff2470bfe    src/index.ts    2b8ec517be1716bc
src/i18n.ts      cbec637f51ffc301    test/walk.test.ts 1c91bf90f5c486df
scripts/smoke.mjs f86afe9675446061
```

Worker-only deploy (no new migration). Never c10. TBD ids stay TBD.
