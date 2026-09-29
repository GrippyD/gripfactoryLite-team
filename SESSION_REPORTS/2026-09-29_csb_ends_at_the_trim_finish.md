# 2026-09-29 CSB ends at the trim finish

V13 of THE BRANCH PLAN (canon 0.30.303), built in the worktree `branches/GFLiteOpsDashboard` under THE DISPATCH RULE (canon 0.30.155), on THE CURE PANES (canon 0.30.164). No migration. The smoke pin stays at 80. Not deployed. Nothing committed. No git was run.

## What changed

CSB is the trim queue. A lot is on CSB when its status is `unloaded` and its newest live trim row (stage `trim`, not deleted, latest `scheduled_at`, then `id`) has status `scheduled`. The moment that row is `complete`, the lot leaves CSB and sits on neither pane. A deleted trim row leaves no live row, so an unloaded lot returns to CSA. A `trimmed` lot is off both panes. Frozen and voided lots stay off both.

The cryo exit of 9/21 retires. `in_cryo` is gone from `LOTS_SQL`. `cureMembership` no longer takes `cryoLive`. A container taken into a cryo run does not move the lot. The two trim subqueries share one order (`scheduled_at` descending, then `id`) so the in-time and the status are the same row.

CSA's in-time is still the unload finish. CSB's in-time is still that trim row's `scheduled_at`. Moisture readings, the conditions line, and the tile marks are untouched. The console's drying totals count the same lots the panes show, so the cure figures follow the pane. The panes' place, the sensor door, the rooms list, and the flags are untouched.

## Assumptions for his word

- "Finished in trimming" is the trim schedule row completing, the finish the scheduling page and the trim station both record. The lot's own `trimmed` status, which the reconcile sets later or never, is not the signal. This build followed that reading.
- The 9/21 cryo exit retires: a lot whose container reached a cryo run before its trim finished stays on CSB until the finish. On the floor today this changes no lot. This build followed that reading.
- The four he counts are 26042, 26043, 26045 and 26048. The seven that leave are 26016, 26034, 26037, 26038, 26039, 26041 and 26047. No data repair; the law alone moves them.

## Gates

Run in the worktree's `app/`.

- `npm run typecheck`: exit 0.
- `npx vitest run`: 67 files, 968 tests passed under `TZ=UTC`, and the same under `TZ=America/New_York`.
- `node --check scripts/smoke.mjs`: exit 0.
- From-zero smoke (`SMOKE_PORT=9213`, `WRANGLER_SEND_METRICS=false`): `About to apply 80 migration(s)`, `SMOKE PASS`, ` 500 ` lines: 0, exit 0. The walk that schedules trim still sees the lot on CSB. Completing that row takes it off CSB and does not put it on CSA. The walk then unfinishes the row, so it is scheduled again; the later cryo run leaves the lot on CSB.
- Dash audit: 0 on every file below (U+2014 and U+2013). No CR byte in those files.
- `METRC_INTEGRATOR_KEY = "`, `METRC_USER_KEY = "`, `MS_CLIENT_SECRET = "`, `SENSORPUSH_PASSWORD = "`, `CLOUDFLARE_API_TOKEN=`, and `CLOUDFLARE_API_TOKEN: "` do not appear in those files. No personnel data.

## Deploy

Not deployed from this session. Nothing committed. No git was run.

## Sealed final check

```
npm run typecheck                     exit 0
npx vitest run (TZ=UTC)               67 files, 968 tests passed
TZ=America/New_York npx vitest run    67 files, 968 tests passed
node --check scripts/smoke.mjs        exit 0
SMOKE_PORT=9213 WRANGLER_SEND_METRICS=false node scripts/smoke.mjs
                                      About to apply 80 migration(s); SMOKE PASS; " 500 " lines: 0; exit 0
dash audit: 0; CR audit: 0; secret grep: no values; personnel data: none
```

```
app/src/cure.ts                    17813  368f409635aec29f
TAIL }
app/test/cure.test.ts              11119  7f8cee438c64b5c4
TAIL });
app/scripts/smoke.mjs             624827  540820cb3383fe13
TAIL });
```
