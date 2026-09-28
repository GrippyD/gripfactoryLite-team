# 2026-09-27 The gate on the throbbing waste (canon 0.30.267): PASSED

Scribe session. The gate on his Code session's `SESSION_REPORTS/2026-09-27_the_throbbing_waste.md` (brief S, THE THROBBING WASTE, canon 0.30.266; no migration). The report says "Not deployed. Nothing committed."; the disk says the tree it sits on was deployed at 18:18:17Z (2:18 PM), ten minutes before this gate began, as worker d2aad6d9 (his paste, 0.30.268): the gate stands on the tree the deploy carried, byte for byte, so its verdict covers what is live. No Scribe change to `app/`. His hand-back, verbatim in part: "The deep-red waste cells on the BTR graph now pulse in all three skins. The legend swatch stays still, and the plume markup is unchanged. Nothing was committed or deployed."

VERDICT: PASSED. Every gate passes and the law reads as briefed on all six points. Nothing to deploy from this gate: the tree is live.

## What was gated

1. The tree came over as one tarball. It hashed identical on both sides: 227 files, listing sha256 1090afcb185953ad. Against the tree of the environment flags fix gate (85f43019d7a697e2, canon 0.30.265) exactly the report's two sealed files changed, `src/theme.ts` and `test/console.test.ts`; nothing else, no migration (the head stays 0077). The seal covers every changed file (G-10).
2. The two files match the seal byte for byte (size, sha256 and tail). No dash and no CR byte in any of the 205 files under `src`, `test`, `migrations` and `scripts/smoke.mjs`, nor in the build report.
3. Read against brief S's six laws. THE WASTE THROBS: in each of the three sheets (Lite, Continuum, Cerberus), after the skin's own `.hc-bud-consumed[data-hc-bud-waste] { fill: ... }`, the rule `animation: hc-waste-throb 1.6s ease-in-out infinite` and `@keyframes hc-waste-throb { 0%, 100% { fill-opacity: 0.55; } 50% { fill-opacity: 1; } }`; the reds unchanged (#7c1b1b, #7c1b1b, #ba2929). WHEN: the rule reads the attribute alone, so a drawn waste cell pulses on a finished shift as on a running one; the RUNNING flash untouched. THE LEGEND STANDS STILL: `.hc-swatch-waste` unchanged in all three sheets. REDUCED MOTION: `@media (prefers-reduced-motion: reduce) { .hc-bud-consumed[data-hc-bud-waste] { animation-duration: 3.2s; } }` in each sheet, never `animation: none` (THE BLUE THROB, 0.30.79). NOTHING ELSE MOVES: `src/console.ts` untouched, the plume's markup byte for byte what it was; the silo, FFZ and RUNNING throbs, the bogey, the byproduct grey, the bud green, the stem, every other card, `wrangler.toml`, `package.json`.
4. THE TESTS: one new case in `test/console.test.ts` reads the rule, the keyframes and the slowing in each of the three sheets, the slowing carrying no `animation: none`, the swatch rule carrying no animation, the trough and crest as exactly 0.55 and 1, and a low-BTR plume carrying no throb class with its waste attribute where it was. The existing deep red and bogey cases stand unchanged.
5. THE SMOKE walks the console as before; the plume's markup is what the smoke already reads.

## His word: the report's three assumptions

They stand as the report states them, and as the brief set them: always on while waste is drawn; the trough at 0.55, the silos' 0.3 kept for the silos, whose red has no grey neighbor; the same 1.6 s beat as the silos, one pulse on the floor.

## Gates on the tree as received (the Scribe's sandbox)

- `npx tsc --noEmit`: exit 0.
- `npx vitest run`: 62 files, 938 tests passed; the same under `TZ=America/New_York`.
- `node --check scripts/smoke.mjs`: ok.
- From-zero smoke (`SMOKE_PORT=9187`): `About to apply 77 migration(s)`, `SMOKE PASS`, no ` 500 ` line; the dev server ended by the timeout after the pass.
- Dash audit: 0, and no CR byte, on the 205 files under `src`, `test`, `migrations` and `scripts/smoke.mjs`, and on the build report.
- Secret grep (`METRC_INTEGRATOR_KEY = "`, `METRC_USER_KEY = "`, `MS_CLIENT_SECRET = "`, `SENSORPUSH_PASSWORD = "`, `cfas[t]_`): no matches under `src`, `test`, `scripts`, `migrations` or `wrangler.toml`.

## The order of things, for the record (no hold)

Brief S was written to follow the environment flags deploy so its build would start from the live tree. The disk reads the other order: the pre snapshot `20260927-140925_pre_environment_flags` (complete, 67 tables, 18:09 to 18:12Z), the S build's two files at 18:10Z, its smoke at 18:12Z, and the deploy's build at 18:18:17Z. So worker d2aad6d9 carries brief Q with its fix (gated 0.30.265) and brief S (this gate) in one deploy, and S rode before its gate by ten minutes. The gate now stands on that exact tree and passes; nothing on the floor needs a second deploy. The rule stands as it was: a slice deploys after its gate.

## Sealed final check

```
npx tsc --noEmit                      exit 0
npx vitest run                        62 files, 938 tests passed
TZ=America/New_York npx vitest run    62 files, 938 tests passed
node --check scripts/smoke.mjs        ok
rm -rf .smoke-persist && CI=1 SMOKE_PORT=9187 WRANGLER_SEND_METRICS=false npm run smoke
                                      About to apply 77 migration(s); SMOKE PASS; " 500 " lines: 0
the build report's seal (2 files) verified byte for byte, device and sandbox:
src/theme.ts                                  158415  5121d69d7b719d27
test/console.test.ts                           61733  6d6a018d7f1c337f
changed against the environment flags fix tree, not in the seal: none
tree listing, device and sandbox: 227 files, sha256 1090afcb185953ad (the fix tree: 85f43019d7a697e2; the deploy of 18:18:17Z carried this tree)
the build report: SESSION_REPORTS/2026-09-27_the_throbbing_waste.md  2194  15b1e93ca8dd88ed
dash audit: 0; CR audit: 0; secret grep: no matches
```
