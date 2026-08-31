# Gripfactory Lite: instructions for Claude Code sessions in this repo

You are working in the Gripfactory Lite repo. A persistent Scribe session (Cowork) governs this project; you are a build and operations hand. Obey the following.

## Read first, every session

1. `canon/_NOW.md` (the active line), then `canon/MEMORY.md`, then `canon/CANON.md`. Canon wins over chat, code, and this file. Never edit anything under `canon/` or `prompts/`; propose amendments in a session report instead.
2. Guardrails that bind you: no git remotes, no pushes, no GitHub (G-1). No em dashes or en dashes in anything you write (G-8). Migrations are append-only (never edit 0001 through the current head; new numbered files only). Ship-clean: no personnel or meeting content in anything that leaves this repo (G-9). Every substantive session writes `SESSION_REPORTS/YYYY-MM-DD_<slug>.md` with a sealed final check (byte size, sha256, tail, tsc, tests) pasted verbatim (G-10).

## Deploy (the usual voice command: "deploy")

All commands run from `app/`. Wrangler is already authorized on this machine.

1. `npx wrangler d1 migrations apply gripfactory-lite-grip --env grip --remote` (answer y; applies any new migrations)
2. `npm run deploy:grip`
3. Report the deployed version id and the URL (https://gripfactory-lite-grip.gflite.workers.dev).

Optional pre-deploy verification: `npx tsc --noEmit`, `npm test`, `npm run smoke` (smoke starts a local wrangler dev; it works on this machine).

Never deploy the c10 environment unless Dennis says so in the session. Never touch the TBD placeholder ids in wrangler.toml except to fill a real id Dennis approves.

## The app in one breath

Cloudflare Worker + D1, TypeScript, Hono, server-rendered HTML, no client framework. The pipeline registry (`app/src/pipeline.ts`) is data: stations and queues declare their surface, fields, panes, and controls there. Postgres-portable SQL only. Grams are numeric with 2-decimal rounding. Every edit and void demands a reason and lands in record_change_log. Display strings translate through `app/src/i18n.ts` (EN fallback); storage identifiers stay English.

## When Dennis asks for a change

Small and inside existing patterns: do it, verify (tsc, tests, smoke), write the session report, tell him to say "deploy" or run the deploy yourself if he asked. Structural or schema-shaped: stop and tell him to route it through the Scribe so it lands in canon first.
