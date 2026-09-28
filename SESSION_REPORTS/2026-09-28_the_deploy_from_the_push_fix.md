# 2026-09-28 The deploy from the push, the gate's fix

The fix sitting on the gate `SESSION_REPORTS/2026-09-28_gate_the_deploy_from_the_push.md` (canon 0.30.278), in the worktree `branches/GFLiteOpsDashboard`. No migration. Not deployed. Nothing committed. No git was run.

## What changed

F1. `app/package.json`'s `typecheck` script is `wrangler types --no-strict-vars && tsc --noEmit`. The workflow is unchanged and still calls `npm run typecheck`.

## Gates

Run in the worktree's `app/`.

- `npm run typecheck`: exit 0.
- `npx vitest run`: 62 files, 943 tests passed. The same under `TZ=America/New_York`.
- `node --check scripts/smoke.mjs`: exit 0.
- From-zero smoke (`SMOKE_PORT=9194`, `WRANGLER_SEND_METRICS=false`): `About to apply 77 migration(s)`, `SMOKE PASS`, ` 500 ` lines: 0, exit 0.
- Dash audit: 0 on `app/package.json` (U+2014 and U+2013). No CR byte in that file.
- `CLOUDFLARE_API_TOKEN=`, `CLOUDFLARE_API_TOKEN: "`, `METRC_INTEGRATOR_KEY = "`, `METRC_USER_KEY = "`, `MS_CLIENT_SECRET = "`, and `SENSORPUSH_PASSWORD = "` do not appear in `app/package.json`. The workflow is unchanged and still uses `${{ secrets.CLOUDFLARE_API_TOKEN }}` and `${{ secrets.CLOUDFLARE_ACCOUNT_ID }}`.

## Deploy

Not deployed from this session. Nothing committed. No git was run. The merge and the push are his hands after the gate.

## Sealed final check

```
npm run typecheck                     exit 0
npx vitest run                        62 files, 943 tests passed
TZ=America/New_York npx vitest run    62 files, 943 tests passed
node --check scripts/smoke.mjs        exit 0
SMOKE_PORT=9194 WRANGLER_SEND_METRICS=false node scripts/smoke.mjs
                                      About to apply 77 migration(s); SMOKE PASS; " 500 " lines: 0; exit 0
.github/workflows/deploy.yml          unchanged  998  023682d8845cc361
```

```
app/package.json    705  4854364c4c801bf0
TAIL }
```
