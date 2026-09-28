# 2026-09-28 The gate on the deploy from the push (canon 0.30.278): HELD for one small fix

Scribe session. The gate on his Code session's `SESSION_REPORTS/2026-09-28_the_deploy_from_the_push.md`, in the worktree `branches/GFLiteOpsDashboard` (V1 of THE BRANCH PLAN, canon 0.30.277; no migration; nothing under `app/`). The report says "Not deployed. Nothing committed. No git was run."; the disk agrees. No Scribe change to the worktree. His hand-back, verbatim in part: "V1 is in the worktree `branches/GFLiteOpsDashboard`. The workflow file is the one the brief gives, `.gitignore` now ignores `branches/`, and `CLAUDE.md` has the two worktree sentences under the guardrails. Nothing under `app/` was edited."

VERDICT: HELD, for one small fix. Every gate passes and the three files are exactly the brief's. What holds it is the fact the build session found and reported without touching the workflow, and the Scribe reproduced: `npm run typecheck`, which the workflow calls, fails on a fresh `wrangler types` because that command's default strict vars type `MS_TENANT_ID` as the literal `"TBD"`, which the app's own `Env` declarations (`string`) refuse. The first proof would go red at its typecheck step and never reach the deploy. The fix is one line under `app/`, and the brief's "nothing under `app/`" is amended for that one line.

## What was gated

1. The worktree came over as one tarball. `.github/workflows/deploy.yml` (998 bytes, sha256 023682d8845cc361) equals the brief's YAML block byte for byte. `.gitignore` (1109, b456fe4c3851051f) is the live file plus the branch-folder section and `branches/`. `CLAUDE.md` (4711, f5b1430df05898fc) is the live file plus the two sentences under the guardrails. Under `app/` nothing differs from the live tree (591677e363bd75a2, worker 0d0af61d) in content; two files differ in line endings only, `wrangler.toml` and `seed/strains.csv`, LF in the worktree as the repository keeps them, CRLF in the main folder's working copies (canon 0.30.276). No migration; the head stays 0077. The seal covers every changed file (G-10).
2. The three files match the seal byte for byte (size, sha256 and tail). No dash and no CR byte in them or in the build report.
3. Read against brief V1's five laws. THE WORKFLOW: on push to `main` only; the concurrency group `deploy-grip`, no cancel; `working-directory: app`; checkout v4, setup-node v4 at Node 22 with the npm cache keyed on `app/package-lock.json`; `npm ci`, `npm run typecheck`, `npx vitest run`; the migrations apply on `gripfactory-lite-grip-20260914 --env grip --remote`; `npx wrangler deploy --env grip`; both wrangler steps reading `${{ secrets.CLOUDFLARE_API_TOKEN }}` and `${{ secrets.CLOUDFLARE_ACCOUNT_ID }}`; no literal anywhere. THE IGNORE: the section in the file's voice with its canon line, then `branches/`. THE INSTRUCTIONS: the two sentences, nothing else moved in `CLAUDE.md`. NOTHING ELSE MOVES: confirmed under `app/`. THE TESTS: the sealed check ran in the worktree's `app/`, as required.
4. THE TWO WRANGLER POINTS, as the report states them and as the Scribe read them: `d1 migrations apply` on wrangler 4.127.0 has no `--yes` flag and skips its confirmation on a non-interactive line (`isNonInteractiveOrCI()` in the installed cli guards the prompt; the smoke's own local apply runs that way every gate); `wrangler types` reads `wrangler.toml` alone and needs no token (run in the sandbox with the token variables unset, it wrote the file).
5. THE FINDING, reproduced in the Scribe's sandbox on the worktree's `app/`: `npx wrangler types` with the default strict vars writes `MS_TENANT_ID?: "TBD"`, `MS_CLIENT_ID?: "TBD"`, `THEME: "grip" | "c10"` and the like; `npx tsc --noEmit` then exits 1 with two TS2430 errors, `src/sensorpush.ts(15)` and `src/sheetsync.ts(38)`, each an `Env` declaration that types `MS_TENANT_ID` as `string`. `npx wrangler types --no-strict-vars` writes `MS_TENANT_ID?: string` and `tsc` exits 0. The laptop and every gate sandbox so far carried a `worker-configuration.d.ts` generated on 2026-08-31 (git-ignored, before the sheet sync vars existed), so `npx tsc --noEmit` run alone never met the literal; the workflow's clean checkout would.

## The fix

- F1, THE TYPECHECK SCRIPT MEETS STRICT VARS (low, and it holds the tree): `app/package.json`'s `typecheck` becomes `wrangler types --no-strict-vars && tsc --noEmit`. One line, one flag. The workflow stays as written (it calls the script), and every laptop and gate runs the same command the workflow runs. The alternative, the flag in the workflow alone, would leave `npm run typecheck` broken everywhere else; declined. Brief V1's "nothing under `app/`" is amended for this one line.

## Observations for his word (no hold)

- The gate's own typecheck now regenerates the types first: `npx wrangler types --no-strict-vars` then `npx tsc --noEmit`, in every gate from here, so the sandbox never again leans on a stale generated file. The canon gotcha is folded with this report.
- `THEME` under strict vars types as `"grip" | "c10"`, which the code accepts today; `--no-strict-vars` makes it `string`, which the code also accepts. No behavior changes either way; the types only loosen to what the code already declares.
- The report's four assumptions stand: Node 22; typecheck and tests in the workflow, the smoke in the gate; one deploy at a time; the migrations step on every deploy.

## Gates on the tree as received (the Scribe's sandbox, the worktree's `app/`)

- `npx wrangler types --no-strict-vars` then `npx tsc --noEmit`: exit 0. `npx wrangler types` (default) then `npx tsc --noEmit`: exit 1, the finding.
- `npx vitest run`: 62 files, 943 tests passed; the same under `TZ=America/New_York`.
- `node --check scripts/smoke.mjs`: ok.
- From-zero smoke (`SMOKE_PORT=9190`): `About to apply 77 migration(s)`, `SMOKE PASS`, no ` 500 ` line; the dev server ended by the timeout after the pass.
- Dash audit: 0, and no CR byte, on the three files and the build report.
- Secret grep (`CLOUDFLARE_API_TOKEN=`, `CLOUDFLARE_API_TOKEN: "`, `METRC_INTEGRATOR_KEY = "`, `METRC_USER_KEY = "`, `MS_CLIENT_SECRET = "`, `SENSORPUSH_PASSWORD = "`, `cfas[t]_`): no matches in `.github`, `.gitignore`, `CLAUDE.md` or under `app/src`, `app/test`, `app/scripts`, `app/migrations`, `app/wrangler.toml`.

## The fix, for his Code session (in the worktree)

```
Read canon/_NOW.md, then SESSION_REPORTS/2026-09-28_gate_the_deploy_from_the_push.md, and fix what it names in this worktree under THE DISPATCH RULE (canon 0.30.155): F1 (app/package.json, the typecheck script becomes "wrangler types --no-strict-vars && tsc --noEmit"; the workflow stays as it is). Nothing else moves. Write SESSION_REPORTS/2026-09-28_the_deploy_from_the_push_fix.md with the sealed final check, its typecheck line being npm run typecheck itself, exit 0. Commit nothing, push nothing, deploy nothing, run no git.
```

## Sealed final check

```
npx wrangler types --no-strict-vars; npx tsc --noEmit     exit 0
npx wrangler types; npx tsc --noEmit                      exit 1 (TS2430 in sensorpush.ts and sheetsync.ts): the finding
npx vitest run                        62 files, 943 tests passed
TZ=America/New_York npx vitest run    62 files, 943 tests passed
node --check scripts/smoke.mjs        ok
rm -rf .smoke-persist && CI=1 SMOKE_PORT=9190 WRANGLER_SEND_METRICS=false npm run smoke
                                      About to apply 77 migration(s); SMOKE PASS; " 500 " lines: 0
the build report's seal (3 files) verified byte for byte, device and sandbox:
.github/workflows/deploy.yml                     998  023682d8845cc361  (equals the brief's block)
.gitignore                                      1109  b456fe4c3851051f
CLAUDE.md                                       4711  f5b1430df05898fc
app/ against the live tree 591677e363bd75a2: no content change; wrangler.toml and seed/strains.csv LF here, CRLF in the main folder's working copies
the build report: SESSION_REPORTS/2026-09-28_the_deploy_from_the_push.md  5321  03987671908ff372
dash audit: 0; CR audit: 0; secret grep: no matches
```
