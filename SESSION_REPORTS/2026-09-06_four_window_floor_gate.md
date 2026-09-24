# Session report: the Scribe gate on the four-window floor (canon 0.28.2), 2026-09-06

**Scribe:** Gripfactory Lite Scribe (Cowork). Independent re-verify of Cursor's four-window floor slice (canon 0.28.0 + 0.28.1, prompts/2026-09-06_four_window_floor_slice.md with its addendum). Tree hash-synced from the owner's machine (18 files staged, every sha256 matched both sides before the gate ran).

## Gate one: the tree as delivered

tsc 0; 425 tests in 16 files; smoke syntax ok; dash audit 0 on all 17 builder-touched files; from-zero smoke SMOKE PASS with "About to apply 30 migration(s)". Cursor's sealed check reproduced exactly.

## Five fixes at the gate (Scribe-direct, from the builder's own amendments)

1. **Bucked-child license inheritance** (actions.ts): the unload's bucked child minted `license_value` hardcoded to 832, so a future ARL or PNS bucked unload would land its product under Penn North's yellow line. It now inherits the batch license like the finish mint (fallback: the farm's AU grow). The builder's amendment 1 read this as historical only; the mint path was live.
2. **Spear staging origin_location** (actions.ts, amendment 3 closed): the spear-staged building movement binds `origin_location` (the staged item's location), so the pane's origin line reads the whole pair instead of `832 / / Truck N`. Verified on screen: `AU-G-C-000832 / Arlington Dry Room / Truck 77`.
3. **Minting scope** (actions.ts + html.ts, amendment 4 resolved structurally): HBNs mint only under FARM-ASSIGNED licenses. The Acquire picker filters to rows carrying a farm, and createHarvestBatch refuses a farm-less license in words. The 0020 GR-C trio (GR-C-001132, GR-C-001405, GR-C-002600) therefore leaves Acquire but stays fully pickable as destinations (the external walk still ships to GR-C-002600).
4. **No lot invisible** (config.ts): `inheritedLotLicense` falls back to the farm's AU grow line when the batch license is not a site line, so no wet lot can ever vanish from the floor; the stored value stays on the record. Before this, a batch minted under GR-C-001132 produced a floor-invisible lot, the exact absurdity class the owner has hammered all day.
5. **The active manifest carries items** (db.ts, amendment 2 closed): the pane and the focus law key on the newest building movement WITH at least one live item. A header-only save (an empty building row) never steals focus again; it stays voidable in the Admin logistics queue.

## Gate two: the tree with the fixes

```
cd /home/claude/deploy/app
npx tsc --noEmit                      -> exit 0
npx vitest run                        -> Test Files 16 passed (16), Tests 425 passed (425)
Dash audit (4 gate-fix files)         -> 0
rm -rf .smoke-persist && SMOKE_PORT=9113 WRANGLER_SEND_METRICS=false timeout 280 npm run smoke
                                      -> SMOKE PASS, "About to apply 30 migration(s)" from zero
Visual pass (walked smoke DB served, playwright): the four windows in order
  (Arlington, PNS, Penn North, MANIFEST); AU yellow, Med blue with the
  placeholder labels; the focus law holding on the spear manifest (832 open,
  every other license line collapsed); - EMPTY - rendering; the road strip
  below with three entries; Acquire's required License select with the farm
  chip.

src/actions.ts  ded77e7ddd0dfa18    src/html.ts  dee88a99fb56ee68
src/config.ts   0cf44de00fc9203d    src/db.ts    77afbcfd720c2a68
```

## Amendment dispositions (for the canon row)

Closed at the gate: 2, 3, and the live half of 1 (the bucked mint). Resolved structurally: 4 (minting = farm-assigned only). Accepted as noted: 5 (three view sheets, not four). STANDING FOR THE OWNER: (a) the 0020 GR-C trio look like the real Med license numbers from his own license map; one word swaps the placeholders for them and retires the TBDs; (b) historical items minted to 832 keep sitting under Penn North until reminted or received (self-heals through the arrival conversion); (c) the Arrivals-and-road-stay assumption from 0.28.0 still stands unflipped.

One PS run ships everything pending: the worker (0.27.5 Weighing Queue, 0.27.6 EMPTY law, the four-window floor, the gate fixes) plus migration 0030. Never c10. TBD ids stay TBD.
