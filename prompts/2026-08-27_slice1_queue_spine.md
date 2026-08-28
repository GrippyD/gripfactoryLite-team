gflite: slice 1, queue spine

# Cursor build prompt: Gripfactory Lite, Slice 1 (queue spine on Cloudflare)

**Repo:** this folder ("gripfactory Practical"). You are building in place. There is no remote and you never add one (canon G-1). Commit locally as you go.
**Read first, in this order:** `canon/CANON.md` (obey guardrails G-1 through G-10) and `canon/PROCESS_MAP.md` (the box registry this slice serves). Never edit anything under `canon/` or `prompts/`; propose canon amendments in your session report instead.

## Mission

Stand up the app skeleton and the harvest queue spine as **simple forms**: four entry stations, four queues, manual queue controls, CSV exports. This is the thin end-to-end spine; each station gets deepened later, box by box. Owner's chain, verbatim:

1. Acquire HBN
2. HBN Queue
3. Wet Weight Entry, pick from HBN Queue
4. Dry Space Queue (created from wet weights)
5. Trim Packages Entry, pick lots from Dry Space Queue
6. Cryo Queue (created from bud WIP packages)
7. Cryo Weight Entry, pick package IDs from Cryo Queue
8. Testing Queue
9. Manual controls for emptying the Testing Queue

Design so stations and queues can be rearranged and new ones inserted later: pipeline order is data, not structure.

## Stack and deployment shape (canon ADR-2 and ADR-5)

- **TypeScript on Cloudflare Workers, data in D1.** Server-rendered plain HTML (Hono is fine, or a plain fetch handler with template strings). No SPA framework, no React, no Tailwind, no client build step. Client-side JS only where a form genuinely needs it, vanilla and inline.
- **One codebase, two deployments:** wrangler environments `grip` and `c10`. Each env gets its own D1 binding (database ids are placeholders until deploy day) and its own CSS token block. The app reads a `THEME` var from the env and serves the matching token set. Structure and behavior identical in both.
- **CSS:** one inline stylesheet in the layout: a `:root` token block per theme (the Harvest Console TOKEN SLOTS pattern) above shared base styles. Slice 1 ships neutral, readable tokens for both themes; real Grip and C10 skins land later as token swaps. Readable at arm's length, large inputs.
- App code makes **zero external network calls** and loads nothing from CDNs. Access control is not in-app: Cloudflare Access gets configured at the edge later (owner step, flagged below).
- Local dev: `npx wrangler dev` (local D1, works offline). All commands run from `app/`. npm scripts must not assume bash (Windows host).
- **Do not deploy.** Build and verify locally. End the session report with the exact deploy commands for both envs (`npm run deploy:grip`, `npm run deploy:c10`) for the owner to run logged in.
- Keep dependencies minimal: wrangler, typescript, hono (optional), vitest (or the Workers vitest pool). Nothing else without a reason stated in the report.

## Schema law (canon G-5; inherited rules, follow exactly)

- Identifiers snake_case English. Enums are lookup tables, never DB enums or CHECK-encoded lists.
- Primary keys: uuid strings (crypto.randomUUID), TEXT columns.
- Every table carries audit columns: created_at, created_by, updated_at, updated_by, deleted_at, deleted_by. Timestamps are TEXT, ISO 8601, UTC, named `*_at`. Exception: record_change_log carries none (it is the audit).
- Soft delete only (deleted_at); hard deletes forbidden in app code.
- Every edit and every void requires a nonempty **reason**. Each changed field emits one row into record_change_log: record_table, record_id, field, old_value, new_value, actor_person_id, reason, changed_at. Missing reason rejects the mutation (HTTP 400). The mutation and its log rows go through one `db.batch()` so they land atomically.
- Mass is grams in a column named weight_grams (and cryo_weight_grams), numeric, two decimals, rounded app-side.
- **Postgres portability is law** (the Aurora someday-case): ANSI SQL only, no SQLite pragmas in schema, no AUTOINCREMENT, booleans as INTEGER 0/1 named `is_*` or `manicure`, and a short `app/PORTABILITY.md` documenting the D1-to-Postgres type mapping (TEXT uuid → uuid, TEXT *_at → timestamptz, INTEGER 0/1 → boolean, NUMERIC → numeric(12,2)).
- Migrations: numbered SQL files under `app/migrations/`, applied with wrangler d1 migrations. Seeds are idempotent (INSERT OR IGNORE keyed on natural keys) and live in migrations.

## Tables (slice 1, no more than this)

Lookups: farms(code pk, display_name) · grow_methods(code pk, display_name, hbn_code) · strains(id, name, abbr, hbn_code) · dry_spaces(id, name, kind) · package_types(code pk, display_name, is_bud) · people(id, display_name, is_active)

- harvest_batches: id, entry_date, farm_code, grow_method_code, strain_id, manicure (0/1), silo_number null, start_time null, zone null, rows_text null, metrc_harvest_tag null, hbn UNIQUE, status (open | complete), audit columns.
- wet_weight_entries (a row here = a lot in the Dry Space Queue): id, harvest_batch_id, weight_grams, dry_space_id, notes null, status (drying | trimmed), audit columns.
- wip_packages: id, wet_weight_entry_id, package_code, package_type_code, weight_grams, cryo_weight_grams null, status (created | cryo_queue | testing_queue | released), test_outcome null, audit columns.
- record_change_log.

## The mint (HBN)

Format: `<YYDDD>-<farm>-<grow_code>-<strain_code>-<manicure>-<silo>-<YY>`

- **YYDDD: 2-digit year + 3-digit day of year, zero padded (2026-09-01 → 26244). Owner ruling 2026-08-27: this replaces the Excel-serial date segment that 25H/26H used.**
- farm: ARL, PNN, or PNS. grow_code: GH, ID, or OD from grow_methods.hbn_code. strain_code: strains.hbn_code, three digits. manicure: 1 or 0. silo: silo_number as entered, or NA when blank. YY: 2-digit year.
- Example: `26244-ARL-GH-027-0-NA-26`.
- Mint server-side on create. Enforce uniqueness; on collision reject with a clear message (no silent suffixing). Unit-test the Julian math including Jan 1, Dec 31, and a leap year.

## Stations and queues are data

`app/src/pipeline.ts` exports one typed array defining the pipeline in order: each entry has key, kind (station | queue), title, entity, and for stations the field list and transition, for queues the predicate and row controls. Forms and queue pages render generically from this registry. Reordering the array reorders the home page; inserting a new station must not require touching existing ones.

Stations:
1. **Acquire HBN**: fields Date, Farm, Grow Method, Strain, Manicure?, Silo #, Start Time, Zone, Rows, optional METRC Harvest Tag. Creates harvest_batches (status open); show the minted HBN big and copyable.
2. **Wet Weight Entry**: pick an open batch from the HBN Queue, enter weight_grams, dry space, notes. Creates wet_weight_entries (status drying). Multiple wet weights per batch are normal; the batch stays queued until manually marked complete.
3. **Trim Packages Entry**: pick a lot (status drying) from the Dry Space Queue, add one or more packages: package_code, package_type, weight_grams. Types with is_bud = 1 land in status cryo_queue; all others in status created. The lot stays available until manually marked trimmed.
4. **Cryo Weight Entry**: pick package(s) from the Cryo Queue by package_code, enter cryo_weight_grams. Transition to testing_queue.

Queues (each a page: live rows, newest first, row controls, a CSV export link):
- **HBN Queue**: harvest_batches status open. Control: Mark complete (logged, no reason needed).
- **Dry Space Queue**: wet_weight_entries status drying, grouped by dry space. Control: Mark trimmed.
- **Cryo Queue**: wip_packages status cryo_queue.
- **Testing Queue**: wip_packages status testing_queue. Controls (owner item 9): Release with an outcome from a small editable list (passed, failed, other) plus an optional note; sets status released and logs the event.

Every record row everywhere also gets Edit and Void controls that demand a reason (schema law).

## Pages

- `/` home: pipeline tiles in registry order with live queue counts.
- `/station/<key>` and `/queue/<key>` per the registry.
- `/export/<key>.csv` for every queue plus harvest_batches, wet_weight_entries, wip_packages, record_change_log.
- `/admin/lookups`: minimal add/deactivate for people, strains, dry_spaces, package_types (audited like everything else).
- `/log`: read-only change log, newest first.
- Every form has a person picker (from people) remembered per browser via cookie; created_by comes from it.

## Seeds (idempotent, in migrations)

- farms: ARL, PNN, PNS.
- grow_methods: Greenhouse GH, Indoor ID, Outdoor OD.
- package_types: BUD (is_bud 1), MIX, SMALLS, TRIM, BIO, KIEF, WASTE (is_bud 0).
- strains: generate the INSERT migration from `app/seed/strains.csv` (committed in this repo, 78 rows, real codes).
- dry_spaces: Silo 1 through Silo 5 (kind silo). More get added in-app.
- people: EMPTY. Never seed names into the repo (canon G-9); they are entered in-app and live only in each site's database.

## Style and hygiene

- **No em dashes or en dashes anywhere**: UI strings, comments, docs, commit messages (canon G-8).
- No hardcoded machine paths, drive letters, account ids, or hostnames in code; env placeholders in wrangler.toml are labeled TBD.
- Values that translate raw to displayed (mint format, is_bud routing, outcome list) live in one `app/src/config.ts` marked as future config-table candidates (canon L-4).
- git: init if absent, `.gitignore` (node_modules, .wrangler, dist), `.gitattributes` with `* text=auto`. Local commits only.

## Scope fence (hard)

No auth in-app. No real theme skins beyond the neutral token blocks. No METRC or Zoho calls. No printing or travelers. No dashboards or charts. No PDF. Simple forms that work beat anything clever (canon G-3).

## Verification (canon G-10, not optional)

1. Unit tests: HBN mint (YYDDD math, boundaries, leap year), uniqueness rejection, edit-without-reason rejected, is_bud routing, status transitions.
2. HTTP smoke (`npm run smoke`): against wrangler dev with a scratch local D1: create batch → wet weight → trim two packages (one BUD, one TRIM) → cryo weight the BUD → release from testing; assert each queue count before and after; assert change-log rows for one reasoned edit and one rejected reasonless edit.
3. Sealed final check, run last: for every file this session touched print `wc -c`, sha256, and the last 80 bytes with newlines visualized; run `tsc --noEmit`; run tests and smoke. Paste the entire output verbatim into the session report.

## Session report (required)

Write `SESSION_REPORTS/2026-08-27_slice1_queue_spine.md`: scope recap, what was built, deviations, proposed canon amendments, open questions, the full verification output, and the exact deploy commands for both envs. Print as the very last stdout line: `Session report: <absolute path>`.

## Flags for the owner (surface in the report, do not resolve yourself)

- Batch and lot queue-exit is manual (Mark complete, Mark trimmed). Confirm that matches floor reality.
- The trailing YY segment now repeats the year already in YYDDD. Keep for continuity or drop: owner's call.
- Wet weight is a single weight_grams field; 25H carried wet spear and bucked wet separately. Deepening decision for the wet weights box.
- Dry space seed is Silo 1 to 5 only; hang locations get added in-app until ruled otherwise.
- Cloudflare Access must be configured on the Grip site before real crew data goes in (owner/Corey step, not code).
