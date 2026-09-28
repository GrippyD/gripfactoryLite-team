# 2026-09-27 The throbbing waste

Brief S, THE THROBBING WASTE (canon 0.30.266). No migration. Not deployed. Nothing committed.

## What changed

A consumed waste cell of the plume, `.hc-bud-consumed[data-hc-bud-waste]`, throbs in the deep red each skin already uses. The animation is `hc-waste-throb`, 1.6 s ease-in-out infinite, on `fill-opacity`: trough 0.55, crest 1. It is in the Lite, Continuum, and Cerberus sheets. The cell pulses whenever it is drawn, running shift or finished. The RUNNING flash is unchanged. The legend swatch `.hc-swatch-waste` does not pulse. Under `prefers-reduced-motion: reduce` the pulse slows to 3.2 s and is not stilled. The plume markup in `src/console.ts` is unchanged.

## Assumptions for his word

- Always on while waste is drawn, not only while the line runs.
- The trough at 0.55. The silos pulse to 0.3, and a silo's red has no grey neighbor to be mistaken for.
- The same 1.6 s beat as the silos, so the floor has one pulse.

## Gates

- `npx tsc --noEmit`: exit 0.
- `npx vitest run`: 62 files, 938 tests passed. The same under `TZ=America/New_York`.
- `node --check scripts/smoke.mjs`: exit 0.
- From-zero smoke (`SMOKE_PORT=9186`, `WRANGLER_SEND_METRICS=false`): `About to apply 77 migration(s)`, `SMOKE PASS`, ` 500 ` lines: 0, exit 0.
- Dash audit: 0 on the files below (U+2014 and U+2013). No CR byte in those files.
- `METRC_INTEGRATOR_KEY = "`, `METRC_USER_KEY = "`, `MS_CLIENT_SECRET = "`, and `SENSORPUSH_PASSWORD = "` appear in no file under `src`, `test`, `scripts`, `migrations`, or `wrangler.toml`.

## Deploy

Not deployed from this session. Nothing committed. No migration.

## Sealed final check

```
npx tsc --noEmit                      exit 0
npx vitest run                        62 files, 938 tests passed
TZ=America/New_York npx vitest run    62 files, 938 tests passed
node --check scripts/smoke.mjs        exit 0
SMOKE_PORT=9186 WRANGLER_SEND_METRICS=false node scripts/smoke.mjs
                                      About to apply 77 migration(s); SMOKE PASS; " 500 " lines: 0; exit 0
```

```
src/theme.ts                 158415  5121d69d7b719d27
TAIL }
test/console.test.ts          61733  6d6a018d7f1c337f
TAIL });
```
