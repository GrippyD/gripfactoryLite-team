# Gripfactory Lite, Grip internal edition: deployment instructions for the receiving agent

You are an AI agent deploying **Gripfactory Lite** (harvest and post-harvest operations, Grip internal edition) to the **Grip Cloudflare account**. This zip contains everything you need: `app/` (a Cloudflare Worker with a D1 database, TypeScript) and this README. Follow it exactly. Where it says stop and report, stop and report.

## Ground rules

1. Deploy **only the `grip` environment**. Do not create, configure, or deploy the `c10` environment; it belongs to a different recipient.
2. Change **nothing** in the code. The only edit you are permitted is one line in `app/wrangler.toml`: replacing the placeholder `TBD-grip-d1-id` with a real database id (step 4).
3. No git remotes, no pushes, no publishing the source anywhere.
4. If any step fails, stop and report the full error output verbatim. Do not improvise fixes.
5. Do not use em dashes or en dashes in anything you write back or into any file.

## Prerequisites

- Node 20 or newer, npm.
- Cloudflare authentication for the Grip account, either of:
  - a person present to complete `npx wrangler login` in a browser, or
  - a scoped API token in the environment: `CLOUDFLARE_API_TOKEN` (Workers Scripts: Edit, D1: Edit, Account: Read).

## Steps

Run everything from the unzipped `app/` directory.

1. `npm ci`
2. Verify the package before touching the cloud: `npx tsc --noEmit` must be clean, and `npm test` must show 25 tests passing. On any failure: stop and report.
3. Create the database: `npx wrangler d1 create gripfactory-lite-grip`. Copy the `database_id` it prints.
4. Open `app/wrangler.toml`, find the `[[env.grip.d1_databases]]` block, and replace `TBD-grip-d1-id` with that id. Touch nothing else.
5. Apply migrations to the real database: `npx wrangler d1 migrations apply gripfactory-lite-grip --env grip --remote`. Expect 3 migrations applied.
6. Deploy: `npx wrangler deploy --env grip`. If the account has never used workers.dev, wrangler may ask to register a subdomain: accept a sensible one and note it in your report.
7. Verify the live site: fetch the deployed URL; expect the Gripfactory Lite home page with pipeline tiles and zero queue counts. Fetch `<url>/export/harvest_batches.csv`; expect a CSV header row.
8. Protect it: in the Cloudflare dashboard, Zero Trust, Access, create an Access application covering this worker's URL and allow only Grip email addresses. The app has **no in-app login by design**; Cloudflare Access is the lock. This must be in place **before real harvest data is entered**.
9. People are never shipped in the package. The first user adds names in the app under Admin, Lookups.

## Report back (to Dennis, wallace@gripcannabis.com)

- The live URL.
- The D1 `database_id` you created.
- Whether Cloudflare Access is configured, and for which emails.
- The verbatim output of steps 2, 5, and 6, plus any deviations.

## What this app is (one paragraph, for your context)

Simple forms over a shared queue chain for harvest operations: Acquire HBN (mints the batch name, e.g. `26244-ARL-GH-027-0-NA-26001`), HBN Queue, Wet Weight Entry, Dry Space Queue, Trim Packages Entry, Cryo Queue, Cryo Weight Entry, Testing Queue with manual release. Every record edit requires a reason and lands in an audit log; every queue exports CSV. Data lives in the site's own D1 database. It is one codebase serving two separately deployed editions; this zip's job is the Grip internal one only.
