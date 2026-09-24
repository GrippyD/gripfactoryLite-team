# 2026-09-15 THE BLUE THROB (canon 0.30.79)

Scribe-direct under G-2. Owner report 2026-09-15 on the live 0.30.77 floor, verbatim: "looks good, but there's no blue throb".

## What was found

The blue fill and its throb class render and animate in a fresh Chromium (fill-opacity swinging 0.30 to 0.89 every 1.6 s), so the law was in the page. Two ways a floor can still show no throb, both now closed:

1. **A reduced-motion setting.** Every theme stilled the throb under `prefers-reduced-motion: reduce` (`animation: none`), which Windows sets when "Show animations" is off. The throb is a floor signal the owner ruled (filling green, drying red, unloading blue), and an opacity pulse is not movement, so a reduced-motion setting now slows the pulse (3.2 s for the silos, 8.4 s for the FFZ cube) instead of removing it.
2. **A fill drawn down to nothing.** An unloading silo's fill falls with the dry out and reaches zero height once all the expected dry is out, leaving nothing to throb. An unloading silo's wire now pulses blue with its fill (`.silo-shape[data-silo-state="unloading"] .silo-wire`, stroke-opacity 0.35 to 1 every 1.6 s), so the signal stands at any level.

## What changed

- `src/theme.ts` (all three themes): the reduced-motion rules for `.silo-throb` and `.ffz-throb` slow the animation instead of stilling it; the unloading wire rule and `@keyframes silo-wire-throb`, blue per theme.
- `test/silo.test.ts` (+1): every theme carries the wire pulse, the blue fill, and slows rather than stills under reduced motion.
- `scripts/smoke.mjs`: the "only Silo 4 reads unloading" pin counts tiles and shapes, not the stylesheet's own mention of the state.

No migration; no route change.

## Gates

- `npx tsc --noEmit`: 0 errors.
- `npx vitest run`: 26 files, 604 tests passed.
- From-zero smoke: "About to apply 50 migration(s)", SMOKE PASS.
- Dash audit: 0 on every changed file.
- Visual pass: Silo 2 unloading in Cerberus, the wire and fill both pulsing (computed opacities sampled 0.8 s apart: fill 0.30 to 0.89, wire 0.35 to 0.99; under reduced motion 0.30 to 0.63 and 0.35 to 0.71 at 3.2 s).

## Deploy (his hands, worker only)

From `app/`: `npm run deploy:grip`.

## Sealed final check

```
src/theme.ts           130886  6e2b84db6d982ff7
test/silo.test.ts       24371  a9b2b432bac16acb
scripts/smoke.mjs      357145  8cfa8d0ff3428a53
tsc: 0 errors; vitest: 26 files, 604 tests passed
smoke: About to apply 50 migration(s); SMOKE PASS
dash audit: 0 on every file above
```
