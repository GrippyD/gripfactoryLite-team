# Gripfactory Lite: instructions for build sessions in this repo

You are working in the Gripfactory Lite repo. A persistent Scribe (the Grok Bot "Gripfactory Lite Scribe", canon 0.30.559) governs this project; you are a build hand, usually a Cursor cloud agent dispatched by The Schmerblez King on a Scribe brief, working on the branch the brief names. Obey the following.

## Read first, every session

1. `canon/_NOW.md` (the active line), then `canon/MEMORY.md`, then `canon/CANON.md`. Canon wins over chat, code, and this file. Never edit anything under `canon/` or `prompts/`; propose amendments in a session report instead.
2. Guardrails that bind you: the repo has one remote, a private GitHub repository; Dennis's hands push to it, or the Scribe by his word for that one push, asked through The Schmerblez King as a card (Owner 2026-10-28); a build session never pushes, never adds a remote, never makes a branch and never runs git on the tree at all (G-1 as amended 2026-09-27, canon 0.30.261). No em dashes or en dashes in anything you write (G-8). Migrations are append-only (never edit 0001 through the current head; new numbered files only). Ship-clean: no personnel or meeting content in anything that leaves this repo (G-9). Every substantive session writes `SESSION_REPORTS/YYYY-MM-DD_<slug>.md` with a sealed final check (byte size, sha256, tail, tsc, tests) pasted verbatim (G-10).

A build session for the branch opens in `branches/GFLiteOpsDashboard` and its `app/`. `npm run deploy:grip` is never run from `branches/`, the worker deploys from `main` alone, by the workflow.

## Deploy (on Dennis's laptop only)

A build session does not deploy. The worker deploys from `main` by the workflow. A manual deploy on Dennis's laptop is run by Dennis, or by the Scribe by approved command (Owner 2026-10-28). All commands run from `app/`. Wrangler is authorized on that machine.

1. Probe first: `npx wrangler d1 execute <D> --env grip --remote --command "SELECT 1"` where `<D>` is the `database_name` in the `[[env.grip.d1_databases]]` block of `app/wrangler.toml` (the grip database was rolled on 2026-09-14 to `gripfactory-lite-grip-20260914`, the beta floor; never type an old name, read the toml). One 7403 is a blip, re-run; two spaced minutes apart is a stale grant. A code 10000 on a path ending in a database NAME means the name is not in the toml.
2. `npx wrangler d1 migrations apply <D> --env grip --remote` (answer y; applies any new migrations)
3. `npm run deploy:grip`
4. Report the deployed version id and the URL (https://gripfactory-lite-grip.gflite.workers.dev).

Optional pre-deploy verification: `npx tsc --noEmit`, `npm test`, `npm run smoke` (smoke starts a local wrangler dev; it works on this machine).

Never deploy the c10 environment unless Dennis says so in the session. Never touch the TBD placeholder ids in wrangler.toml except to fill a real id Dennis approves.

A DATABASE ROLL (canon 0.30.53) is `node scripts/roll-beta.mjs` from `app/`, at Dennis's keyboard only (Owner 2026-10-28): it snapshots the current database to `db_backups/`, creates the dated database beside it, patches the env.grip d1 block, migrates from zero, deploys, carries the seed tables (Admin's settings) from the snapshot, and snapshots the new floor. `node scripts/db-snapshot.mjs [label]` dumps every table without rolling; the Scribe runs snapshot, merge and repair blocks by approved command (Owner 2026-10-28). Never run either from a build session. If wrangler answers `[code: 7500]` ("exceeded D1's free tier daily row write limit"), the whole account is write-frozen until midnight UTC (8:00 PM Eastern) on the Workers Free plan; nothing is broken, the roll re-runs with the same command and reuses the database it created (canon 0.30.54).

THE ROAD LANE (canon 0.30.51): when Dennis is away, `app/scripts/deploy-watch.ps1` runs in his own terminal and deploys whatever `DEPLOY/request.json` asks for (tsc, tests, then the deploy; `mode: migrate` adds the probe and the migrations apply). The Scribe writes those requests and reads `DEPLOY/result.json` back by approved command (Owner 2026-10-28). Do not start the watcher, write requests, or touch `DEPLOY/` from a build session; `DEPLOY/` is gitignored.

## The app in one breath

Cloudflare Worker + D1, TypeScript, Hono, server-rendered HTML, no client framework. The pipeline registry (`app/src/pipeline.ts`) is data: stations and queues declare their surface, fields, panes, and controls there. Postgres-portable SQL only. Grams a person sees, and grams that enter through a form, import, feed, or action, are whole numbers (round half up). One pound is 448 grams. METRC-facing weights stay in grams at METRC's own precision and are not converted at 448. Every edit and void demands a reason and lands in record_change_log. Display strings translate through `app/src/i18n.ts` (EN fallback); storage identifiers stay English.

## When Dennis asks for a change

Small and inside existing patterns: do it on your branch, verify (tsc, tests, smoke), write the session report; the Scribe gates it and the merge and deploy follow the canon lanes. Structural or schema-shaped: stop and route it through the Scribe so it lands in canon first.
