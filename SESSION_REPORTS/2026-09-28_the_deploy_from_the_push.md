# 2026-09-28 The deploy from the push

V1 of THE BRANCH PLAN (canon 0.30.277), built in the worktree `branches/GFLiteOpsDashboard`. No migration. Nothing under `app/` was edited. Not deployed. Nothing committed. No git was run.

## What changed

`.github/workflows/deploy.yml` is the file the brief gives, unchanged. It runs on a push to `main` only, one deploy at a time, and does not cancel a run already going. From `app/` it runs `npm ci`, `npm run typecheck`, `npx vitest run`, then the migrations apply, then `npx wrangler deploy --env grip`. The two wrangler steps read `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` from the repository secrets.

`.gitignore` gains the branch-folder section and the line `branches/`.

`CLAUDE.md` gains two sentences under the guardrails: a build session for the branch opens in `branches/GFLiteOpsDashboard` and its `app/`; `npm run deploy:grip` is never run from `branches/`, the worker deploys from `main` alone, by the workflow.

## What wrangler 4.127.0 said

Migrations apply. The installed command's help, and the D1 command page (https://developers.cloudflare.com/workers/wrangler/commands/d1/#d1-migrations-apply), both say the apply command prompts on an interactive line, and that in a CI/CD environment or another non-interactive command line the confirmation is skipped and the backup is still captured. This version's `d1 migrations apply` has no `--yes` flag (that flag is on `d1 execute` and `d1 delete`, not on apply). GitHub Actions is non-interactive and sets `CI=true`. No flag was added. The workflow line stays as the brief wrote it.

`wrangler types`. The TypeScript page (https://developers.cloudflare.com/workers/languages/typescript/#generate-types) says the command generates types from the Worker configuration: compatibility date, flags, and the bindings in the Wrangler file. The installed help lists no account and no token. Run here with no `CLOUDFLARE_API_TOKEN` in the environment, it read `wrangler.toml` and wrote `worker-configuration.d.ts` (gitignored, the same file `npm run typecheck` generates). It needs no account token. No change to the workflow for that.

One more fact from that same run, not one of the two checks, so the workflow was not edited for it. `wrangler types` defaults `--strict-vars` to true. The generated `Env` then types `MS_TENANT_ID` as the literal `"TBD"` from `wrangler.toml`, and `tsc` refuses it because `sheetsync.ts` declares `MS_TENANT_ID` as `string`. `npm run typecheck`, which is `wrangler types && tsc --noEmit`, fails on a fresh generation. `npx wrangler types --no-strict-vars` then `npx tsc --noEmit` exits 0, and that is the tsc in the seal below. The first proof's typecheck step, as the workflow is written, will hit the strict-vars failure and will not reach the deploy.

## Assumptions for his word

- Node 22 in the workflow (the bridge's Node; the app has no engines field). His laptop runs Node 24; the app runs on either.
- The workflow runs typecheck and the unit tests as a backstop, not the smoke (five minutes; the gate's).
- One deploy at a time; a second push while one runs waits its turn, never cancels it.
- The migrations step runs on every deploy and answers no migrations to apply when none rides.

## Gates

Run in the worktree's `app/`.

- `npx wrangler types --no-strict-vars` then `npx tsc --noEmit`: exit 0.
- `npx vitest run`: 62 files, 943 tests passed. The same under `TZ=America/New_York`.
- `node --check scripts/smoke.mjs`: exit 0.
- From-zero smoke (`SMOKE_PORT=9193`, `WRANGLER_SEND_METRICS=false`): `About to apply 77 migration(s)`, `SMOKE PASS`, ` 500 ` lines: 0, exit 0.
- Dash audit: 0 on the three files below (U+2014 and U+2013). No CR byte in those files.
- `CLOUDFLARE_API_TOKEN=` and `CLOUDFLARE_API_TOKEN: "` with a literal value do not appear. The workflow uses `${{ secrets.CLOUDFLARE_API_TOKEN }}` and `${{ secrets.CLOUDFLARE_ACCOUNT_ID }}`. `METRC_INTEGRATOR_KEY = "`, `METRC_USER_KEY = "`, `MS_CLIENT_SECRET = "`, and `SENSORPUSH_PASSWORD = "` do not appear in the workflow, `.gitignore`, or `CLAUDE.md`.

## Deploy

Not deployed from this session. Nothing committed. No git was run. The merge and the push are his hands after the gate.

## Sealed final check

```
npx wrangler types --no-strict-vars
npx tsc --noEmit                      exit 0
npx vitest run                        62 files, 943 tests passed
TZ=America/New_York npx vitest run    62 files, 943 tests passed
node --check scripts/smoke.mjs        exit 0
SMOKE_PORT=9193 WRANGLER_SEND_METRICS=false node scripts/smoke.mjs
                                      About to apply 77 migration(s); SMOKE PASS; " 500 " lines: 0; exit 0
npm run typecheck (wrangler types && tsc --noEmit), strict-vars default true: tsc fails, MS_TENANT_ID literal "TBD"
```

```
.github/workflows/deploy.yml    998  023682d8845cc361
TAIL           CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
.gitignore                     1109  b456fe4c3851051f
TAIL branches/
CLAUDE.md                      4711  f5b1430df05898fc
TAIL Small and inside existing patterns: do it, verify (tsc, tests, smoke), write the session report, tell him to say "deploy" or run the deploy yourself if he asked. Structural or schema-shaped: stop and tell him to route it through the Scribe so it lands in canon first.
```
