# BRIEF S: THE THROBBING WASTE (canon 0.30.266)

For the build session (Claude Code or Cursor) in `app/`, under THE DISPATCH RULE (canon 0.30.155), in its own sitting after the environment flags deploy (0.30.265) so the tree it starts from is the live one. Canon wins over this brief where they differ; read `canon/_NOW.md` first. No migration. Commit nothing, push nothing, deploy nothing.

## The ruling (owner, 2026-09-27, verbatim)

"dumb addition, but it's still bothering me. Can you make the dark red throb on the btr graph?"

## What the Scribe read

1. THE BTR GRAPH is THE PLUME (canon 0.30.207) on each trim shift card of the Harvest Console (`src/console.ts`): 102 cells, consumed in ROYGBIVWB order as the shift's BTR falls, the two dark green cells permanent. THE PRODUCT LINE and THE TRIM BOGEY (canon 0.30.243, 0.30.249): the last bogeyPct cells of the order are the product; a consumed cell among them carries `data-hc-bud-waste`. THE DEEP RED (canon 0.30.248): that cell draws `.hc-bud-consumed[data-hc-bud-waste] { fill: #7c1b1b; }` in Lite and Continuum and `#ba2929` in Cerberus, the lightest red at 3 to 1 against the skin's bud green so red-green color blindness still reads the dig into product apart from the bud (`src/theme.ts`, three sheets; `test/console.test.ts` reads the rule on all three). The legend's `.hc-swatch-waste` carries the same red.
2. THE THROB the floor already has: `.silo-throb { animation: silo-throb 1.6s ease-in-out infinite; }` with `@keyframes silo-throb { 0%, 100% { fill-opacity: 0.3; } 50% { fill-opacity: 0.9; } }`, and THE BLUE THROB law (canon 0.30.79): a throb is a floor signal the owner ruled, so `prefers-reduced-motion: reduce` slows it (`animation-duration: 3.2s`) instead of stilling it. The trim card's RUNNING flash (`.hc-running`, `hc-running` keyframes) follows the same law.

## The law to build

1. THE WASTE THROBS. Every consumed waste cell of the plume, `.hc-bud-consumed[data-hc-bud-waste]`, throbs in its deep red: a `hc-waste-throb` keyframes on `fill-opacity` beside the silo throb's shape, 1.6 s ease-in-out infinite, in each of the three sheets, the red of each skin unchanged. The trough stays legible: no lower than 0.55, so the cell never reads as the grey byproduct beside it at the bottom of the pulse (the deep red's 3 to 1 contrast was the reason for its shade; the throb must not spend it). The crest is 1.
2. WHEN. Whenever a waste cell is drawn, running shift or not: the dig into product is the alarm, and the card of a finished shift still shows it. The RUNNING flash keeps its own rule.
3. THE LEGEND STANDS STILL. `.hc-swatch-waste` does not throb; it names the color.
4. REDUCED MOTION, THE BLUE THROB LAW: `@media (prefers-reduced-motion: reduce) { .hc-bud-consumed[data-hc-bud-waste] { animation-duration: 3.2s; } }` in each sheet; never `animation: none`.
5. NOTHING ELSE MOVES. The plume's markup (`src/console.ts`) does not change: no new class, no new attribute; the CSS reads the attribute the cells already carry. The order, the bogey, the byproduct grey, the bud green, the stem, the silo and FFZ throbs, every other card.
6. THE TESTS. `test/console.test.ts` (or beside it): each of the three sheets carries the waste rule with the animation, its keyframes with a trough of 0.55 or higher and a crest of 1, and the reduced-motion slowing; the legend swatch rule carries no animation; the markup of a low BTR card is byte for byte what it was (the existing waste assertions stand unchanged).

## Assumptions for his word

- Always on while waste is drawn, not only while the line runs (law 2).
- The trough at 0.55 (law 1); the silos pulse to 0.3, but a silo's red has no grey neighbor to be mistaken for.
- The same 1.6 s beat as the silos, so the floor has one pulse.

## Files

`src/theme.ts` (three sheets), `test/console.test.ts`. Nothing else.

## Gates and the hand-back

The usual: tsc 0; vitest both zones; node --check; the from-zero smoke at pin 77 with `SMOKE PASS` and no 500; dash audit 0; no key, secret or password in any file; no personnel data. Report `SESSION_REPORTS/<date>_the_throbbing_waste.md` with the sealed final check and the assumptions above. Do not deploy; the worker-only line is the Scribe's to hand after the gate.
