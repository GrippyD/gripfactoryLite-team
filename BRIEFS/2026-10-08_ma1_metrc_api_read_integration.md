# BRIEF MA1: THE METRC API READ INTEGRATION

Filed by the Scribe on 2026-10-09 (canon 0.30.433), after the fact: this brief was drafted by the Scribe Acolyte on 2026-10-08 at canon 0.30.427 and pasted by the owner straight into a build session in `branches/GFLiteMetrcAPI` without passing through canon. The build (tree `56ef7350c9db9a3c`, report `SESSION_REPORTS/2026-10-08_ma1_metrc_api_read_integration.md` with four appendices) and the Scribe's gate (`SESSION_REPORTS/2026-10-09_gate_ma1.md`, the tree `58fc5c6ddc2afb28`) were judged against the text below, kept verbatim as the owner pasted it. Where the build departed from it, the build's report says so (appendix d's 23 corrections; page size 50 not 20; one user key for every license, so `METRC_USER_KEYS` was never built; `write` impossible on a sandbox host; E1 never writes). The name MA1 stands.

---

BRIEF MA1: THE METRC API READ INTEGRATION
Drafted: 2026-10-08 by the Scribe Acolyte (METRC API integration), pinned at canon v0.30.427, for the Scribe to rename, ratify and dispatch under THE DISPATCH RULE. Repo home: `BRIEFS/2026-10-08_ma1_metrc_api_read_integration.md` Builder: Claude Code, in its own worktree (see Law 0). Co-Authored-By trailer per the live convention. Status: PROPOSED. The code name MA1 is the Acolyte's; the Scribe may rename it. Forks marked FORK are Dennis's to rule before the paste; each carries a recommended default so the brief builds as written if he says "defaults".

## 0. Read this first (the build session's ritual)

1. Read `CLAUDE.md`, then `canon/_NOW.md`, `canon/MEMORY.md`, and `canon/CANON.md` (re-pin the version; the Acolyte drafted this at 0.30.427).
2. Read these canon entries in full before touching code: 0.30.168 (the Metrc Connect thread and the three gates), 0.30.185 and 0.30.186 (Part 3, the dark read-only client, migration 0069), 0.30.37 and 0.30.38 (THE MIRROR LAW, the tag law, the mount format), 0.30.390 (REAL LIFE IN, METRC OUT), and `canon/TRANSLATION_MAP.md` (the three kinds: floor, translator, mirror; gaps 1 to 5; rules R1 to R4).
3. Read the existing code before designing: `src/metrcapi.ts` (25,366 bytes at the 0.30.185 seal, ce55b905b181bd4e; it may have changed since, read what is on the tree), `test/metrcapi.test.ts`, `migrations/0069_metrc_mirror.sql`, the Admin `/admin/metrc-api` page, the hourly sweep in the cron path, and the mirror's mount code (grep `metrc_mounts`, `metrc_plants`, `metrc_packages`).
4. Read the evaluation workbook the Scribe kept: `RESEARCH/metrc_connect/Generic_Evaluation_for_All_States_MASTER 10.2025.xlsx` (22 tabs) and the keys guide beside it, plus `RESEARCH/2026-09-21_metrc_connect_thread.md`.
5. Read Metrc's Michigan documentation at https://api-mi.metrc.com/Documentation/ . If the build session cannot reach it, stop and ask Dennis to save the pages to `RESEARCH/metrc_connect/docs/`; never write an endpoint, parameter, page size or rate limit from memory.

One hand in `app/`. If another build session holds `app/` or the same worktree, this brief waits for that report and gate (canon 0.30.165). A build session never runs git on the tree (G-1); it works the worktree and hands back.

## 1. The ruling and the goal

Dennis, 2026-10-08, verbatim: "Remembering to run a csv every hour for all of our active licenses is a full time job." and "I'm to the sandbox/assessment phase. It just looks like more busy-work while the world burns around me" and "Let's get cooking on it now then."

Goal in one line: replace the hourly CSV drops with a live, read-only METRC API mirror for every active license, and remove the busy-work of the sandbox evaluation by automating its calls. Reads only. The write switch stays off.

What already exists (do not rebuild it): a dark read-only client (`src/metrcapi.ts`), `/admin/metrc-api` (keys present or absent, sandbox host, calls this month, last sweep, Test connection on `GET /facilities/v2`), migration 0069 (`metrc_api_calls`, `metrc_sweeps`), an hourly sweep at 15 past that reads lab samples and active packages for the last hour plus five minutes and fills only blank mirror columns, secrets `METRC_INTEGRATOR_KEY` and `METRC_USER_KEY`, `METRC_API_BASE` set to `https://sandbox-api-mi.metrc.com` in `wrangler.toml` on the default env and `env.grip`, `METRC_WRITE_ENABLED` false. This brief extends that client.

What does not exist: a plants or packages pull by API into the mirror; a harvests mirror (TRANSLATION_MAP gap 2); per-license user keys; an evaluation runner; any production key.

## 2. Order of work (stop cleanly at any phase boundary and report)

* Phase A, ground and handshake. Reads from section 0. Write the endpoint map (section 7). Confirm the sandbox handshake with Test connection per license once Dennis has set the sandbox secrets. Report what the docs say about page size, page cap, rate limits, `lastModifiedStart` and `lastModifiedEnd` coverage per endpoint, and how the license is selected on each call.
* Phase B, the client. Laws 3, 4 and 5 (host guard, per-license keys, resumable cursors).
* Phase E, the evaluation runner (GET first). Law 8. This comes before the mirror because the evaluation is the gate to the production key; the mirror pays off only after that key exists.
* Phase C, the mirror by API. Laws 1, 2, 6 and 7 (one door, the translator law, the harvests leg, dry run).
* Phase D, the Admin surface and the parity report. Law 9.

## 3. The laws

Law 0, ISOLATION. Own worktree and branch (Dennis's hands create it; suggested `branches/GFLiteMetrcAPI`). Migrations reserved for this brief: the next three free numbers after the tree's current pin (0095 at canon 0.30.427, so 0096 to 0098; confirm against the tree and the Scribe's other open slices before numbering, per canon 0.30.188). Shared files that other slices also touch (`src/index.ts`, `src/config.ts`, `src/html.ts`, `src/i18n.ts`, `scripts/smoke.mjs`, `wrangler.toml`): keep edits in them minimal, name each in the report with before and after hashes so the Scribe can merge by hand.

Law 1, ONE DOOR, TWO PATHS. The CSV drop and the API sweep reach the same mirror reconcile (THE MIRROR LAW, 0.30.38: unseen tags add; moved, returned or re-phased rows update in place; rows the pass no longer carries are marked gone, only within the pass's own license and phase). Do not write a second reconcile. Factor the existing one so both doors call it. Stamp the mount row with its source (`file` or `api`). One log row per sweep per license per endpoint, never per row. `internal_field_values` (keyed by tag) is never touched by a sweep. D1's 100 bound-parameter limit and the chunking of 0.30.38 stand (multi-row inserts, chunks of 400, the mount row leads the batch).

Law 2, THE TRANSLATOR LAW (0.30.390, rule R3 of the map). METRC's encodings are read in the METRC layer only. Map each API JSON object into the same column names the export mounts already use (ten plants columns, twenty-two packages columns) so nothing downstream changes. Write the mapping as a table in the report, field by field, marking every field the API names differently or lacks. No floor record gains a METRC-shaped field. Decoders (harvest name dates, location words) stay in the METRC layer.

Law 3, THE SWITCH AND HOST LAW.

* Any POST, PUT or DELETE is refused in code unless BOTH `METRC_EVAL_ENABLED` is true (new, false by default, a var) AND the host matches `^https://sandbox-api-[a-z]{2}\.metrc\.com$`. A production host can never receive a write from this code. `METRC_WRITE_ENABLED` stays false and `testingPostRequest` stays null.
* Sandbox data never enters the live mirror. When the host is a sandbox host, sweeps run in `dry_run` or evaluation only; `write` mode is refused on a sandbox host with a plain-words message.
* GET sweeps are allowed on whichever host `METRC_API_BASE` names.

Law 4, THE LAW OF SECRETS (0.30.185, extended). Keys are wrangler secrets, never vars, never in a file, a log row, a page or chat. Vendor key: `METRC_INTEGRATOR_KEY`. User keys: `METRC_USER_KEYS` (a secret holding a JSON object keyed by license number) with `METRC_USER_KEY` as the fallback for any license without an entry. Basic header built in memory; failed-call messages scrubbed of every key; the Admin page shows presence per license only. If the documentation shows one user key covers every license of the company, the fallback is the path and `METRC_USER_KEYS` stays unused; report which it is. Tests use obviously fake keys, and the secret grep must stay at zero.

Law 5, THE CADENCE AND CURSOR LAW. Sweeps are resumable and bounded. A cursor table (migration 0096) holds, per license and endpoint: the last completed `lastModified` high-water mark, the current full-reconcile page cursor, and the last full-reconcile completion time. Each cron tick spends a configured budget of calls and CPU (constants in `app_config`, defaults conservative; confirm the Workers plan's current subrequest and CPU limits from Cloudflare's documentation and cite them in the report) and stops where it is. Defaults, all in `app_config` so Dennis can retune without a deploy:

* packages active: incremental hourly by `lastModified`; full reconcile daily (this is what marks `gone`).
* harvests (active plus finished in the last 30 days): incremental hourly; full reconcile daily.
* plants (vegetative and flowering): incremental hourly by `lastModified`; full reconcile weekly, spread across ticks.
* the existing lab sample and results sweep is preserved exactly as it is. Arithmetic for the report, to be checked against the documented page size P: at the mirror's last count (97,936 plants, 11,742 packages) a full pull costs about rows divided by P calls, so 4,897 plants calls and 588 packages calls if P is 20. A weekly plants reconcile on that basis is the reason the cursor and budget exist. Handle `Retry-After` and 429s as 0069 already does; never loop without a ceiling.

Law 6, THE HARVESTS LEG (TRANSLATION_MAP gap 2). New table `metrc_harvests` (migration 0097): the harvest id and name (HBN), license, the dates and wet weight the API returns, current location, state, plant count if returned, first seen, changed, gone. Read-only, API door only (no export exists for it). The harvest name's coded date stays decoded in the METRC layer. No new floor surface beyond the Admin pane of Law 9; the Floor vs METRC report (FM1) may consume it in a later brief. FORK F-E: persist harvests (recommended yes, it closes rows 1, 2 and 5 of the map).

Law 7, DRY RUN BEFORE WRITE. `app_config.metrc_sweep_mode` is `off` (default), `dry_run` or `write`. In `dry_run` the sweep reads everything it would read, runs the reconcile in memory against the current mirror, and writes nothing to the mirror tables; it logs, per license and endpoint, the would-add, would-update and would-gone counts and up to 25 sample differences (tag, column, mirror value, API value) into `metrc_sweeps` (or a child table, migration 0098 if needed). `write` is allowed only on a production host. Moving `dry_run` to `write` is Dennis's word after he reads a parity report (Law 9); the code never self-promotes.

Law 8, THE EVALUATION RUNNER (sandbox only). An Admin page `/admin/metrc-eval` behind the Admin PIN, active only when the host is a sandbox host. It walks the evaluation workbook's tabs for the facility types Grip is (Grow and Processor) and, per step, performs the documented call, then records the verification items the workbook asks for (result code, facility, id, last-modified, tag, request, minified JSON) into a downloadable pack (CSV per tab, plus one JSON of everything) shaped to paste into the workbook's columns. Phase E1 is GET steps only. Writes (any tab step that creates or changes data) are Phase E2 and are built only on Dennis's word after Metrc confirms the evaluation scope (see FORK F-A), behind `METRC_EVAL_ENABLED` and the host guard of Law 3. Do not guess any step; derive the step list from the workbook and the docs, and put the derived list in the report for Dennis to check against Metrc's reply. MI's sandbox is closed loop; the workbook's Closed Loop Environment tab governs how opening inventory is created, and the runner must report plainly when a step cannot run because the sandbox lacks the inventory it needs. Filling the workbook's own cells (an `.xlsx` edit) is out of scope for E1; the repo's zero-dependency law applies if it is ever taken up.

Law 9, THE ADMIN SURFACE (G-3, no flubdubs). Extend `/admin/metrc-api` only: per license, key present or absent; the mode (`off`, `dry_run`, `write`); per endpoint, last sweep, rows read, calls, failures; calls this month; Test connection per license; Sweep now for one license and endpoint (PIN gated, honors the budget); and a Parity pane that, per license, shows the last dry-run counts and sample differences next to the age of the latest CSV mount, with the single sentence "Parity reads clean" or "Parity differs" and the numbers behind it. Every new string in EN and ES, every field with help text per the canon's field-help law (what it impacts and its lookup path). No key material on any page.

## 4. Forks for Dennis (recommended defaults in bold; the brief builds the default if he says "defaults")

* F-A, evaluation scope. Which evaluation to request: a Grow plus Processor evaluation, GET steps only (v1); the same with writes; GET only for Grow and nothing for Processor. The Acolyte's email to Metrc asks the question; Metrc's reply decides. Note for the reader: the Scribe's reading in 0.30.168 is that a GET-only evaluation still walks every tab, so the saving is steps per tab, not tabs.
* F-B, keys. One vendor key, user keys per license in `METRC_USER_KEYS` with the single-key fallback. Metrc's reply decides whether per-license keys are needed.
* F-C, runner output. A pack of CSVs and JSON to paste (E1). Alternative: also fill the workbook's cells (a later brief).
* F-D, plants cadence. Incremental hourly plus a weekly spread reconcile. Alternative: plants stay on the CSV drop (weekly) and only packages and harvests go live.
* F-E, harvests table. Yes (Law 6).
* F-F, cutover. dry_run for a full harvest week or until Dennis rules, then `write` on his word.

## 5. Do not (the walls)

No writes to METRC except the evaluation runner under Law 3. No production keys in any file. No deploy and no migration applied to any remote database (the Scribe's three-step block does that, pre snapshot first). No git on the tree. No transfers or manifests table, no COA document endpoint, no processing model (all parked). No new floor-facing surface. No edits to `internal_field_values` by a sweep. No em dashes or en dashes anywhere (G-8: chat, comments, strings, files). Nothing from the support thread's personnel (G-9).

## 6. Tests and gates (G-10)

* Unit tests with a fake `fetch`: pagination to exhaustion and to the page cap, cursor resume across ticks, `lastModified` windows, `Retry-After` and 429 with the ceiling, key scrubbing in errors, the host guard refusing POST, PUT and DELETE on a production host and on a sandbox host with `METRC_EVAL_ENABLED` false, refusing `write` mode on a sandbox host, per-license key selection and the fallback, the mapping of recorded sandbox JSON fixtures into export-shaped rows for plants, packages and harvests (fixtures recorded from the sandbox with keys and tags that are sandbox-only; none from production), and the dry-run counts matching a known mirror state.
* A parity fixture: one mount's CSV rows and the same rows as API JSON reconcile to identical mirror rows.
* From-zero smoke at the new pin: the Admin pages walked with keys absent (no call made, plain words) and with fake keys against a stubbed host; the dash audit; the secret grep; `tsc`; vitest in both time zones; `node --check`.
* The sealed final check (byte size, sha256, parse test, tail inspection per touched file, verbatim) and the session report at `SESSION_REPORTS/2026-10-08_ma1_metrc_api_read_integration.md` containing: the docs findings of Phase A, the mapping tables, the derived evaluation step list, the Workers limits cited, the shared-file hashes, any assumption made (each numbered, for Dennis's word), and the merge block with the pre snapshot first.

## 7. Phase A deliverable: the endpoint map (fill from the documentation, never from memory)

For each of plants (vegetative, flowering), harvests (active, inactive), packages (active, inactive), locations, items, strains, transfers (incoming, outgoing, delivery) and lab results: the exact path, the license parameter, the paging parameters and caps, whether `lastModifiedStart` and `lastModifiedEnd` apply, the fields returned that map to the existing export columns, and the fields with no export equivalent. Mark each as "needed by the mirror", "needed by the evaluation only", or "not used".

## 8. Hand-back

Report the phase reached, the gates, the assumptions, the shared-file hashes, and the exact things Dennis's hands must do (sandbox secrets, the worktree, the merge block). Do not ask Dennis to re-explain the project; the canon is the source.
