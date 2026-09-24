# Session report: the weigh-mode radio trap fix (canon 0.24.1), Scribe-direct, 2026-09-05

**Scribe:** Gripfactory Lite Scribe (Cowork), Scribe-direct under G-2. Live floor bug reported by the owner with a screenshot (lot 26027 - CHEM 51, Arlington Dry Room, one 250,000.00 g dry weight, both radios unselected and dead): "When I ran this as bucked, it said could not save without selecting an option. When I try to go back in, the Spear/Bucked toggles don't work."

## Diagnosis (reproduced in code)

Two defects compounding on the unload session surface (src/html.ts, unloadLotPanel):

1. **The pick never traveled.** The Spear/Bucked radios belong to the Save session form only. A crew member who picks Bucked and goes straight to Add a weight or Finish unload never transmits the pick: the weights form carries no weigh_mode field, and the finish form's hidden weigh_mode renders only from the SAVED session mode. Finish then 400s ("Choose Spear or Bucked before finishing the unload"), which is the owner's "could not save without selecting an option."
2. **The lock caged nothing.** The first weight locked the radios (locked = sessionWeightCount > 0) even when no mode was ever captured, so the page re-rendered with radios disabled AND unchecked: the owner's dead toggles. The server plumbing was already right (ensureUnloadSession adopts a form-carried mode onto an open modeless session from both the weights and finish posts); only the page never sent it.

## The fix (both halves, page-side only, no migrations)

1. **The lock only locks a stored mode:** `locked = sessionWeightCount > 0 && currentMode !== ""`. A modeless session with weights keeps its radios live, so the owner's stuck lot recovers by itself: open it, pick the mode, carry on. Dead modeLocked variable removed.
2. **The live pick rides every submit:** the page's existing inline sync script (house idiom, tiny inline scripts) gains a carry: on submit of any form posting to .../weights or .../finish, the checked weigh_mode is stamped into a hidden input in that form (created if absent). The server adopts it on the open session, so weighing or finishing without Save session lands the mode, and the mode locks at first weight exactly as the 0.17.0 law intended: because the first weight carries it. The script now renders for all non-silo lots (it previously skipped stored-bucked sessions; the sync half no-ops without the bucked-on-site block, and the carry half is idempotent against the existing hidden inputs).

## Files touched (3)

- src/html.ts: the lock law, the carry script, dead code removed.
- test/walk.test.ts: new pin "a modeless session with weights keeps the radios live and the page carries the pick" (radios not disabled with weights and no mode; carry selector present; stored mode still locks checked disabled with the hidden carry input).
- scripts/smoke.mjs: the hang-lot walk now adds its first weight BEFORE any session save (the trap arm), asserts the radios stay live and the carry marker renders, then saves the mode and asserts the lock engages with the hidden carry input. Downstream totals unchanged (same 80.00 weight, reordered).

## Sealed final check

```
cd /home/claude/deploy/app
npx tsc --noEmit                      -> exit 0
npx vitest run                        -> Test Files 15 passed (15), Tests 392 passed (392)
node --check scripts/smoke.mjs        -> ok
Dash audit (3 touched files)          -> 0
rm -rf .smoke-persist && SMOKE_PORT=9012 WRANGLER_SEND_METRICS=false timeout 280 npm run smoke
                                      -> SMOKE PASS, "About to apply 26 migration(s)" from zero
                                         (exit 124 is the dev-server timeout kill)
Cleanup: pkill -9 -f wrangler-dist, pkill -9 -x workerd; 7.4 GB free after.

src/html.ts          114975 bytes   sha256:760ab77e05d3e2bb
test/walk.test.ts     37200 bytes   sha256:57ea8a5cb0b2f611
scripts/smoke.mjs    150704 bytes   sha256:73641dca1090da91
```

Worker-only deploy: NO new migrations (0026 stays the head; the standing PS block's migrations step applies nothing and is safe to run). Never c10. TBD ids stay TBD.

Note for the queued Cursor slice: this fix commits ahead of prompts/2026-09-05_marketplace_trim_gate_slice.md, so the builder starts from the fixed tree (html.ts and smoke.mjs both move; the slice touches neither's unload surfaces).
