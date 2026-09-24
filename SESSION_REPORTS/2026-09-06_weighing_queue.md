# Session report: the Weighing Queue closes the in-app removal gap (canon 0.27.5), Scribe-direct, 2026-09-06

**Scribe:** Gripfactory Lite Scribe (Cowork), Scribe-direct under G-2 and the ratified 0.26.0 principle (every layer has its Data Queues place). Owner word, verbatim, answering the true-zero fork: "runbook, and confirm that we have the tools to remove them from the app."

## The audit (checked against the code)

Every removal runs through the one reasoned record framework (`/record/<table>/<id>/void`, reason required, change-logged). What surfaces a button:

1. **Harvest batches:** the HBN Queue on Admin Data Queues carries Edit and the reasoned Void. COVERED.
2. **In-transit lots (trucks):** the Inbound Queue on the same page, same controls. COVERED.
3. **Scale reads:** per-read Edit and Void on the lot page's weights table; a voided weight leaves the lot total by the recompute law. COVERED.
4. **Weighing lots:** NO SURFACE ANYWHERE. No queue listed them and the lot page carries no lot-level Void, so the only path was typing the raw record URL by hand. THE GAP.

One caveat now written into the registry comment: removal order is lot first, then batch. The floor's lot queries do not consult the batch's deleted state, so a voided batch with a live lot still shows on the floor.

## What shipped

**The Weighing Queue** (pipeline.ts): a new Data Queues section right after the Inbound Queue, entity wet_weight_entries, predicate status = weighing, columns HBN / Total (g) / Notes / Created, the standard reasoned Edit and Void, no extra controls (demote from weighing would step back to nothing). Registry-only change plus one i18n title (es: Cola de pesaje); no schema, no migration, no route.

With it, every record class on the floor removes in-app: batch (HBN Queue), weighing lot (Weighing Queue), in-transit lot (Inbound Queue), drying lot (Dry Space Queue), unloaded lot (Unloaded Queue), package (Cryo/Testing queues and the inventory surfaces), inventory item, logistics move (0.26.x), scale read (lot page). The true-zero runbook handed this sitting covers the bulk case; the queues cover the day-to-day one.

## Sealed final check

```
cd /home/claude/deploy/app
npx tsc --noEmit                      -> exit 0
npx vitest run                        -> Test Files 15 passed (15), Tests 411 passed (411)
node --check scripts/smoke.mjs        -> ok
Dash audit (4 touched files)          -> 0
rm -rf .smoke-persist && SMOKE_PORT=9083 WRANGLER_SEND_METRICS=false timeout 280 npm run smoke
                                      -> SMOKE PASS, "About to apply 29 migration(s)" from zero
Smoke walk added: /admin/queues carries the Weighing Queue section and the
  walk's weighing lot rides it with the reasoned Void link.
Unit pin added: the queue def (surface admin, predicate weighing, empty
  rowControls, column order, position right after the Inbound Queue).

src/pipeline.ts      82851e7e2f12fbee    src/i18n.ts       a57a289ac9002be9
test/surface.test.ts d94b7764db443308    scripts/smoke.mjs 16d2681053350851
```

Worker only, no migration (0029 stays the head). Owner deploys by PS; the migrations step applies nothing and is safe. Never c10. TBD ids stay TBD.
