# Session report: the receive asks Spear or Bucked (canon 0.28.8), Scribe-direct, 2026-09-07

**Scribe:** Gripfactory Lite Scribe (Cowork), Scribe-direct under G-2. Owner exchange: "Why did the spear/buck dynamic go away?  Was that me?" Scribe verified against the tree: the unload fork never went anywhere (radios, bucked-on-site, silo hides Spear, the -B child, the spear+truck staging; every pin green). The one flat assumption was mine: the 0.28.6 barn-inbox receive minted every arrival as SPR without asking. Offered the fork; his word: "do it".

## What shipped

1. **The receive asks.** Every truck line's receive form carries Spear / Bucked radios, Spear checked as the one-tap common case, beside the one Receive button. No landing space, unchanged.
2. **The kind law** (`receiveMintKind`, ledger.ts, pure): spear mints SPR, bucked mints WIP, anything else refuses in words ("Pick Spear or Bucked."). Same vocabulary and same kind law as the unload fork; the package code stays the plain lot token either way (the -B suffix remains the unload's bucked-split child mark).
3. Everything else about the receive stands: barn inbox, arrival license, one button, wrong site refuses, the Move To edit carries the item at placement.

## Sealed final check

```
cd /home/claude/deploy/app
npx tsc --noEmit                      -> exit 0
npx vitest run                        -> Test Files 16 passed (16), Tests 427 passed (427)
node --check scripts/smoke.mjs        -> ok
Dash audit (6 touched files)          -> 0
rm -rf .smoke-persist && SMOKE_PORT=9143 WRANGLER_SEND_METRICS=false timeout 280 npm run smoke
                                      -> SMOKE PASS, "About to apply 30 migration(s)" from zero
Smoke walks: the receive form offers Spear (checked) and Bucked; a receive
  without the choice refuses 400; the spear receive rides the standing walk;
  the walk's second truck receives BUCKED at the end (303, leaves Arrivals)
  after every earlier walk that needs a truck on the road has run.
Unit pins: receiveMintKind (SPR / WIP / null) in strapin; the receive form
  radios in routing.

src/ledger.ts        0a1e975e8ebd898c    src/actions.ts    3b7f12b70cf192f3
src/html.ts          64a9aae7b6dc706a    test/routing.test.ts 98cb372c14912c79
test/strapin.test.ts ced3c53101e85b9c    scripts/smoke.mjs e5911a72f2b00315
```

Worker only, no migration (0030 stays the head). Owner deploys by PS; the migrations step applies nothing and is safe. Never c10. TBD ids stay TBD.
