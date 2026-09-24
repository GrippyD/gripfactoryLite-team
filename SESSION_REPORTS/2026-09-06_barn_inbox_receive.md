# Session report: the barn-inbox receive (canon 0.28.6), Scribe-direct, 2026-09-06

**Scribe:** Gripfactory Lite Scribe (Cowork), Scribe-direct under G-2. Owner correction of the just-shipped 0.28.4 receive, verbatim: "no need for the landing space.  We will do a location change when it lands.  The inbox is always barn, the only exception is CSA to CSB (a manifest to the processor, received to CSB) at PNN."

## What changed

1. **The receive is ONE BUTTON.** The space select left the truck lines; the form posts the lot id alone. Guards stand (wrong site refuses 400).
2. **THE INBOX LAW at receipt:** the mint fires at receipt INTO THE DESTINATION BARN under the arrival license, as SPR (wet whole material, the kind a hang finish mints). The lot goes drying, its space untouched (the truck sentinel keeps it off the drying sheet by that sheet's own rule until the crew places it). The CSA to CSB exception is untouched: that is the internal manifest lane at PNN, not the wet truck lane.
3. **The location change carries the item.** editRecord gains the sync half of his sentence: a Move To edit on a wet lot updates the lot's live minted item's location to the new space's name, same reason, one stroke. Without it the floor would show the item at the barn while the lot dried somewhere else, the split-brain class of the day. The 0.23.1 "silo assigns at receipt" reading is superseded by this ruling: barn at receipt, placement by the later location change.

## Sealed final check

```
cd /home/claude/deploy/app
npx tsc --noEmit                      -> exit 0
npx vitest run                        -> Test Files 16 passed (16), Tests 426 passed (426)
node --check scripts/smoke.mjs        -> ok
Dash audit (5 touched files)          -> 0
rm -rf .smoke-persist && SMOKE_PORT=9137 WRANGLER_SEND_METRICS=false timeout 280 npm run smoke
                                      -> SMOKE PASS, "About to apply 30 migration(s)" from zero
Smoke walks reworked: the receive form carries NO space select; wrong-site 400;
  one-button receive 303; the receipt mints SPR into the destination barn
  (PNN,BARN,SPR on the location report); the Move To edit then carries the item
  to Silo 4 (Silo 4,SPR on the report; Silo 4 on the floor).
Unit pin reworked: the receiving page renders the one-button receive and
  refuses to render a space select.

src/actions.ts       6783344f6bed5a7d    src/html.ts       5c749038a7934ce5
src/index.ts         e4f5e9f8da6ac804    test/routing.test.ts efd722cad4ecb39e
scripts/smoke.mjs    160e7d65ca703485
```

Worker only, no migration (0030 stays the head). Owner deploys by PS; the migrations step applies nothing and is safe. Never c10. TBD ids stay TBD.
