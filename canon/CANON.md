# GRIPFACTORY LITE, CANON

**Version:** 0.6.0
**Status:** Active, Source of Truth
**Owner (final authority):** Dennis, sole ratifier
**Scribe:** persistent Claude session attached to the **gripfactoryPractical** project
**Home:** `canon/` in the repo at `Documents\Claude\Projects\gripfactory Practical` (canonical); the Claude Project docs are the Scribe's synced mirror
**Last updated:** 2026-08-31

---

## 0. How to read this document

This file is the single source of truth for Gripfactory Lite. If a chat, a file, or a piece of code disagrees with this file, **this file wins** until it is amended through the Loop.

1. **Nothing is canon until it appears in this file.** Verbal agreements and prior chats do not count.
2. **Names listed here are exact:** no casing changes, no synonyms, no close enough.
3. **No drive-by edits.** Changes land through the Loop: decide, ratify, fold, version bump.

---

## 1. Identity

**Gripfactory Lite** (working title; repo folder "gripfactory Practical") is a lite rebuild of Gripfactory: the **opsHelpers database architecture** as the base, the **end state of Gripfactory as the design compass**, the **harvest console** incorporated. One job: **run harvest and post-harvest operations without interruptions.**

"C-Drive based" means the **repo lives on Dennis's disk**, outside corporate git (clarified 2026-08-27). The product itself is hosted.

It is also the **upstream canon for the node consoles.** Compliance Console canon already names "gripFactory canon, upstream and read-only" as its base: nodes may extend upstream canon and may never contradict it.

One codebase, two Cloudflare deployments, same behavior, different CSS tokens, each storing its own data on-site:

- **Grip internal site**: runs the actual 2026 harvest at Grip. Recipient: **Corey**.
- **C10 site**: the standalone product on The Continuum 10. Recipient: **Christine**.

## 2. Success criteria

1. The Grip harvest runs on it from **2026-09-01** without interruption.
2. A **hosting package** ships to both recipients: a **zip of the repo plus a README addressed to the recipient's Claude agent**, which deploys it to that recipient's Cloudflare (Corey: Grip internal; Christine: C10). (The Harvest Console `handoff/` pattern is the proven precedent.)
3. Related hard date: the C10 Compliance Console surface has a hard need of **2026-09-09** (its own canon, §2).

## 3. Roles and the Loop (Tier 1)

| Role | Who | Holds |
|---|---|---|
| Owner | Dennis | Final authority; sole ratifier of canon |
| Scribe | this session | Canon, the process map, Cursor prompts, design-agent engagements; writes no code |
| Builder | Claude Code (ruled 2026-08-27: "switch from cursor to code") | Code agents deployed by the Scribe in its workspace for autonomous slices; Dennis's own Claude Code sessions (voice-driven) for interactive work, fed by Scribe-written briefs in prompts/. Cursor remains a fallback lane. |
| Design agents | independent agents | Design assistance, engaged by the Scribe |
| Recipients | Corey (Grip ops), Christine (C10) | Receive the package; testers, not approvers |

**The Loop:** Dennis states the goal; the Scribe grounds against canon, then directs the work; the Scribe surfaces results and proposed amendments; Dennis ratifies, overrides, or defers; the Scribe folds, bumps the version, updates MEMORY and _NOW.

**Rulings interface (ratified 2026-08-27):** decisions are put to Dennis through AskUserQuestion pickers, never as lists stranded in chat. Durable state lives in canon files, not in the conversation.

## 4. Standing rules (guardrails)

- **G-1, No GitHub.** Work stays in the local repo. No pushes, no remotes.
- **G-2, Build lanes (amended 2026-08-27: "the bones all seem to work").** The Scribe may apply small slices directly from its session; Cursor remains the lane for large or structural work. Either lane owes the same discipline: sealed final check, session report, migrations frozen post-deploy.
- **G-3, No flubdubs.** No speculative features, invented fields, or decorative complexity. The screens fill with real operations; lean beats clever. (Dennis, 2026-08-27)
- **G-4, Repo on disk, app in the cloud (amended 2026-08-27).** The repo lives on Dennis's disk, never corporate git. The app runs as two Cloudflare sites (Grip internal, C10): same code and behavior, different CSS tokens, each storing its own data on-site. SQL stays Postgres-portable for the possible future Plato-on-Aurora integration.
- **G-5, opsHelpers is the db base**, defined as Plato Bible §4 standing rules, §5 naming conventions, and §6 canonical schema: snake_case English identifiers, grams canonical, UTC storage, audit columns on every row, soft delete plus edit-with-reason into `record_change_log`, lookup-table enums, configurable utilities as data not code, repository-layer storage abstraction. The Plato governance apparatus is **not** carried.
- **G-6, Canon home and mirror.** `canon/` in the repo is the canonical home; the Claude Project holds the Scribe's synced mirror. Every fold updates both. Repo home ratified at `Documents\Claude\Projects\gripfactory Practical` (2026-08-27).
- **G-7, The Box Doctrine is the build law.** See §5.
- **G-8, Style law: no em dashes or en dashes anywhere**: chat, documents, UI strings, code comments, generated files. Commas, colons, semicolons, periods, or a plain spaced hyphen instead. (Owner directive, global, 2026-08-11.)
- **G-9, Ship clean.** Shipped packages carry no personnel or internal-meeting content. (Harvest Console v0.94 scrub is precedent; crew names in working data stay internal.)
- **G-10, Build verification.** Every Cursor prompt requires a session report plus the sealed final check: byte size, sha256, parse test, and tail inspection for every touched file, output pasted verbatim into the report.

## 5. The Box Doctrine (ratified 2026-08-27)

The unit of build is **the box**. The harvest process map (Dennis's Visio, transcribed in `canon/PROCESS_MAP.md`, image at `canon/harvest-process-map.png`) is the territory. **The map is walked in order.**

**The Box Contract**, all three or it is not done:

1. A **worker** can perform the process.
2. A **manager** can audit it.
3. A **report or CSV** comes out of it.

The working method per box:

1. Dennis supplies the current tool: the OpsHelpers equivalent or the spreadsheet the box runs on today.
2. The Scribe and Dennis **talk the box through before any design.** No designing ahead of the current box.
3. Then spec, then Cursor builds, then verification, then the box is adopted and the walk moves on.

**Standing duty:** the Scribe holds the map and reminds Dennis when work drifts off the current box. The Scribe polices itself the same way: design sprawl is drift.

## 6. Architecture and key decisions

- **ADR-1 (2026-08-27):** opsHelpers db architecture per G-5 is the foundation. Proven in operation; a 5-day runway forbids novel architecture.
- **ADR-2 (2026-08-27, amended same day):** **TypeScript** backbone per the cross-project standard (Dennis 2026-07-22; SalesHelper canon §2). Store of record on Cloudflare is **D1**: a documented exception to the Postgres law, accepted by owner delegation (2026-08-27: limited resources, no appetite for another server). All SQL is written ANSI-portable so a Postgres/Aurora port is a dialect change, not a rewrite. PGlite remains the option for a future local edition.
- **ADR-3 (2026-08-27):** Gripfactory end state is the design compass; the harvest console is incorporated, not reinvented. The new-farm edition is the live console lineage (promoted 2026-08-06); the exact incorporation shape gets decided when the walk reaches console-shaped boxes.
- **ADR-4 (2026-08-27):** Single-file static deliverables for the C10 host contract (one self-contained HTML file, no server, no network calls) apply to console-type nodes hosted on the existing C10 static path; the Gripfactory Lite app itself deploys per ADR-5.
- **ADR-5 (2026-08-27):** **The queue spine.** The build follows Dennis's nine-step chain (Acquire HBN → HBN Queue → Wet Weight Entry → Dry Space Queue → Trim Packages Entry → Cryo Queue → Cryo Weight Entry → Testing Queue → manual testing-queue controls) as simple forms on **Cloudflare Workers + D1**, two wrangler environments (grip, c10), stations and queues defined in one typed registry so pipeline order is data and new stations insert without rework. HBN date segment: **YYDDD Julian** (owner ruling 2026-08-27), replacing the 25H Excel serial.
- **ADR-6 (2026-08-27):** **The mint law, corrected against the 25H formula and owner ruling.** `<YYDDD>-<farm>-<grow_code>-<strain_code>-<manicure>-<silo>-<YY###>`. The trailing segment is **YY + a 3-digit year-wide lot serial** in mint order (26001, 26002, ...), resetting each year: the floor's primary identifier and the largest number on the traveler. Numeric silo numbers render 2-digit zero-padded (5 → 05); blank → NA. Serials are never reused; voids leave auditable gaps.

**Reference map** (read-only sources, sibling folders): `gripfactory/PLATO_BIBLE.md` (the opsHelpers schema and rules) · `gripfactory/SCRIBE_NOTES_V4.md` (verification discipline, failure patterns) · `Harvest Console/harvest-console-CANON.md` and `Harvest Console/new-farm/NEW-FARM-CANON.md` (console lineage) · `Harvest Console/handoff/HOSTING.md` (hosting package precedent) · `SalesHelper/CANON.md` (stack law, style law) · `Compliance Console/ComplianceConsole_CANON.md` (node contract, C10/GF split).

## 7. Lessons register (the compass, ratified 2026-08-27)

- **L-1** Ceremony dies, schema survives. Plato's Tier 3 governance was retired within weeks; its schema and naming rules outlived everything. Govern light, keep the schema strict.
- **L-2** Cloud lanes go dormant, offline-first wins. v4_v2 on Cloudflare stalled; the single-file offline console shipped and got hosted. (History stands; the 2026-08-27 hosting ruling reverses course deliberately, hedged by the zip + README package and Postgres-portable SQL.)
- **L-3** The proven build loop: Scribe writes the spec, Cursor builds, headless verification, owner sees it working. Honor it per box.
- **L-4** Values live in data, not code. The 448 g/lb buried-formula lesson (Plato §4.10): any raw-to-displayed transformation is user-editable configuration.
- **L-5** Truncation is real. Every write gets the sealed final check; mount views can lie; sha256 from both sides settles it.
- **L-6** OneDrive and folder mounts bite: a live .git will not run on the mounted folders from the Scribe's side; Cursor's native git is fine; repos travel as zips.

## 8. Decisions log

| Date | Decision | Version |
|---|---|---|
| 2026-08-27 | Project chartered: identity, mission, dual deployment (Grip internal / C10) | 0.1.0 |
| 2026-08-27 | Governance Tier 1: Dennis sole ratifier; Scribe / Cursor / design-agent division of labor | 0.1.0 |
| 2026-08-27 | V1 scope: all four operational areas, end to end | 0.1.0 |
| 2026-08-27 | Go-live: 2026-09-01 (Grip harvest) | 0.1.0 |
| 2026-08-27 | Hosting package = repo zip + README written for the recipient's Claude agent (current intent) | 0.1.0 |
| 2026-08-27 | Box Doctrine ratified as the build law; the map is walked in order starting at B01 | 0.2.0 |
| 2026-08-27 | Grounding fold ratified: G-5 definition, stack law ADR-2, style law G-8, ship-clean G-9, sealed check G-10 | 0.2.0 |
| 2026-08-27 | Repo home stays at `Documents\Claude\Projects\gripfactory Practical` | 0.2.0 |
| 2026-08-27 | Rulings via AskUserQuestion; no stranded chat lists | 0.2.0 |
| 2026-08-27 | B01 (Directors zone decision) stays human: no tool; the decision lands on the B02 batch record | 0.2.1 |
| 2026-08-27 | B02 red-field rule confirmed: red = required at cut time to mint the HBN; the rest fills as the batch moves | 0.2.1 |
| 2026-08-27 | Zone and rows restored to the batch record in the replacement (26H had dropped them) | 0.2.1 |
| 2026-08-27 | Hosting ruled: two Cloudflare sites (Grip internal for Corey, C10 for Christine), same code, different CSS, data stored on-site; "C Drive based" = the repo on disk, outside corporate git | 0.3.0 |
| 2026-08-27 | D1 as the store with Postgres-portable SQL (Scribe recommendation, accepted by owner delegation); Aurora/Plato integration kept open, hence TS and portable SQL | 0.3.0 |
| 2026-08-27 | HBN date segment: YYDDD Julian replaces the Excel serial | 0.3.0 |
| 2026-08-27 | Slice 1 = the queue spine as simple forms, stations rearrangeable; prompt at prompts/2026-08-27_slice1_queue_spine.md | 0.3.0 |
| 2026-08-27 | Slice 1 built by Cursor and Scribe-verified: sealed check intact, smoke chain end to end, no remote, dash-clean; deviations accepted (vitest node env, HTTP smoke as the end-to-end) | 0.3.1 |
| 2026-08-27 | Mint law corrected (ADR-6): trailing segment is YY + 3-digit year-wide lot serial, the floor's primary identifier; numeric silos zero-padded | 0.3.1 |
| 2026-08-27 | Strain code 071 dup: Blue Andeez moves to 078 ("shouldn't have any plants stored in it"); Gelato 41 keeps 071; matching one-cell edit owed in the 26H workbook Abbr tab | 0.3.1 |
| 2026-08-27 | Slice 1.1 fix prompted: prompts/2026-08-27_slice1p1_mint_serial.md (migrations editable in place, no deploy has happened) | 0.3.1 |
| 2026-08-27 | Slice 1.1 built and Scribe-verified: ADR-6 mint live (YY### serial with UNIQUE(harvest_year, lot_serial), silo zero-pad), Blue Andeez 078 seeded; migrations 0001/0003 edited in place pre-deploy, new numbered migrations only from here | 0.3.2 |
| 2026-08-27 | Queue exits confirmed manual (Mark complete, Mark trimmed): someone owns closing each batch and each lot | 0.3.3 |
| 2026-08-27 | Wet weights ruled a pair: bucked wet weight required, wet spear weight optional ("spearing is only done in certain cases, it needs to be there"); lands with the wet-weights deepening slice as migration 0004 | 0.3.3 |
| 2026-08-27 | Dry-space seed grew "Arlington Dry Room" (kind hang); data row added by the Scribe in the pre-deploy window, verified in place | 0.3.3 |
| 2026-08-27 | Deploy delegated to the Scribe via a scoped Cloudflare API token (Workers + D1 edit), revoked by Dennis after; app staged to the Scribe's workspace and re-verified there (tsc clean, 25/25 tests) | 0.3.3 |
| 2026-08-27 | Deploy path superseded: the Grip internal edition ships as the first real hosting package, deployed by Corey's agent. Package `handoff/gflite-grip-hostpkg-v0.1.zip` (app + README-FOR-AGENT, grip env only, ship-clean: no canon, no crew data) built and verified by the Scribe. No token needed, nothing to revoke. | 0.3.4 |
| 2026-08-27 | Deploy path superseded again: Dennis self-hosted. Scribe drove the dashboard to mint a scoped token, Dennis ran one wrangler block in his terminal (both Scribe shells are proxy-blocked from api.cloudflare.com), Scribe deleted the token after (zero tokens remain). | 0.4.0 |
| 2026-08-27 | **GRIP EDITION IS LIVE**: https://gripfactory-lite-grip.gflite.workers.dev on the gflite workers.dev subdomain, D1 id 2a70ba1f-3cc0-4eea-b9dd-54c42afd1789, hosted on Dennis's personal Cloudflare account (wallacedennis1985@gmail.com) | 0.4.0 |
| 2026-08-27 | First live mint verified in production: 26240-ARL-GH-027-0-05-26001 (ADR-6 exact: Julian day 240, silo zero-pad, lot serial 26001); person picker, cookie, seeds (incl. Blue Andeez 078) all confirmed live | 0.4.0 |
| 2026-08-27 | Break-in phase open on test data; the grip D1 gets wiped before the first real mint; Cloudflare Access still pending and required before crew data | 0.4.0 |
| 2026-08-27 | Break-in ruling 1: home shows stations only; queue tiles removed; Admin button on home; Admin landing's first button is Data Queues, a page listing all four queues as inline record tables (records listed, never just a button). Slice 1.2 prompted: prompts/2026-08-27_slice1p2_admin_queues.md | 0.4.1 |
| 2026-08-27 | G-2 amended by owner ("the bones all seem to work"): the Scribe applies small slices directly; Cursor stays the lane for structural work; sealed check and session report bind both lanes | 0.4.2 |
| 2026-08-27 | Slice 1.2 applied by the Scribe: surfaces in the registry, stations-only home, /admin landing, /admin/queues inline records, /queue redirects. tsc clean, 28 unit tests; workerd cannot run in the Scribe sandbox so the e2e smoke defers to live verification post-deploy (disclosed in the session report) | 0.4.2 |
| 2026-08-27 | Builder lane switched from Cursor to Claude Code (Dennis wants voice; "talking functionality"). Scribe deploys code agents for autonomous slices and still verifies everything itself; Dennis's interactive Claude Code sessions use the briefs in prompts/; Cursor stays as fallback. Verification never delegates to the builder | 0.4.3 |
| 2026-08-27 | Slice 2a built by the first Scribe-deployed code agent and independently Scribe-verified: migration 0004 (wet_spear_weight_grams, nullable), bucked weight required and relabeled, spear optional on form/edit/queue/CSV, 30 tests, migration applies clean. Ships with 1.2 on the next deploy | 0.4.4 |
| 2026-08-28 | Slices 1.2 + 2a deployed (worker version 8d81d31a; migration 0004 applied remotely) and live-verified by the Scribe: stations-only home, Admin landing, Data Queues inline records, spear field, /queue redirect. Dennis's own live mint 26240-PNN-OD-013-0-05-26002 confirms ADR-6 in production | 0.4.5 |
| 2026-08-28 | **Left-pane law, corrected reading:** the queues that feed a station are visible ON that station's page as a left pane, records listed; clicking one reveals the form in the working pane. (The 0.4.1 home-tile reading was the Scribe's misinterpretation; Data Queues stays as the manager surface.) Built generic (leftPane { queue, pickField, groupBy? }), wired for wet_weight first | 0.4.6 |
| 2026-08-28 | Pane lists collapse by farm (native details groups, collapsed by default, picked row's group open) | 0.4.6 |
| 2026-08-28 | **Truck number law:** truck_number rides wet_weight_entries (migration 0005, optional text). ARL and PNS truck bucked material to PNN; it later identifies what lot went into what silo. Internal only: it never rides a METRC export | 0.4.6 |
| 2026-08-28 | Working mode: Dennis rapid-fires rulings while agents run; every ruling folds into canon on arrival and agents burn the queue in slice order | 0.4.6 |
| 2026-08-28 | Slices 2b + 2c built by sequential code agents, Scribe-verified (41 tests, tsc clean, migrations 0001-0005 apply clean), committed; deploy pending (migration 0005 + worker) | 0.4.6 |
| 2026-08-28 | **Wet weight station law (Dennis's full spec):** header (Lead label, non-editable HBN with the farm spelled out after a plain spaced hyphen, Move To, single-line note) + a Weights ledger (Start lot; Add a weight events in the new wet_weights table, migration 0006; reasoned pencil/x per weight; total outside the pane; the lot's weight_grams is the live total). Finish lot routes by destination kind: truck to the new Inbound Queue (in_transit), anything else to the Dry Space Queue (drying) | 0.5.0 |
| 2026-08-28 | **Trucks are destinations:** dry_spaces rows of kind truck, minted inline by Add a truck (Truck N). Farm rules in config (values-in-data): ARL moves to hang or truck; PNS truck only; PNN silo or truck. UI-filtered only for now; server-side enforcement awaits a ruling | 0.5.0 |
| 2026-08-28 | Farm display names spelled out (migration 0006): ARL Arlington, PNS Penn South, PNN **Penn North (Scribe guess, editable in Lookups, confirm)**. Farms became editable in Admin, Lookups | 0.5.0 |
| 2026-08-28 | **i18n law:** universal EN/ES pill on every page; storage identifiers stay English; display strings translate via src/i18n.ts with silent English fallback; chrome and operator surfaces covered first, admin tables later on request | 0.5.0 |
| 2026-08-28 | Interco Logistics: orange-barreled tile on home + stub page; not built (parking lot) | 0.5.0 |
| 2026-08-28 | Slices 3a + 3b built by sequential code agents, Scribe-verified: 73 tests, tsc clean, migrations 0001-0006 apply clean, dash-free; committed; deploy pending (migration 0006 + worker) | 0.5.0 |
| 2026-08-28 | Hang in Place added to PNN's Move To (slice 3c). Destinations gained an optional farm scope (migration 0007: dry_spaces.farm_code, NULL = shared): Arlington Dry Room scoped ARL, Hang in Place scoped PNN, silos and trucks shared. Filter = kind allowed AND farm match-or-shared. Agent also fixed a latent Add-dry-space bind bug. 76 tests, Scribe-verified, committed | 0.5.1 |
| 2026-08-28 | Finishing a lot removes that HBN from the wet weight station's pane (slice 3d, pane only: the batch stays in the Data Queues HBN table until Mark complete, per the manual-exits ruling; a weighing lot keeps the batch visible for resume; hidden batches cannot be picked). 80 tests, Scribe-verified, committed | 0.5.2 |
| 2026-08-28 | Deploy execution clarified: the Scribe's two shells are proxy-blocked from the Cloudflare API (infrastructure, not canon). Deploys run on Dennis's machine: his terminal, or his local Claude Code by voice. Repo `CLAUDE.md` added so any local Claude Code session knows the canon rules and the deploy playbook ("deploy" = remote migrations + deploy:grip + report version and URL) | 0.5.2 |
| 2026-08-31 | Pointer refresh ratified: _NOW and MEMORY refolded at current canon. They had lagged at 0.4.5 and 0.4.0 while canon reached 0.5.3, a cloud-Scribe sitting miss; logged, not dwelt on | 0.6.0 |
| 2026-08-31 | Pending stack deployed from the local Scribe sitting (first proof the local lane runs wrangler itself): migrations 0005 through 0007 were found already applied remotely (an unlogged prior application, harmless); worker version 92a0a590-4dde-43e3-a1e5-76ec26f3ef06 live at https://gripfactory-lite-grip.gflite.workers.dev. Local gate first: tsc clean, 80/80 tests, smoke pass with 0001 through 0007 applying clean | 0.6.0 |
| 2026-08-31 | Wet weight rebuild live-verified in production end to end: farm-grouped pane (collapsed by default; weighing lot keeps the batch visible; finished lot removes it), header with the farm spelled out, Move To filters exact per farm (ARL = Arlington Dry Room + trucks; PNS = trucks only; PNN = silos + trucks + Hang in Place), Add a truck mints Truck 1 inline, full lot with two weights and a reasoned pencil edit (blank reason refused; reason lands in record_change_log; total recomputes), truck finish routes to the Inbound Queue, silo finish to the Dry Space Queue, ES pill covers the chrome, Interco stub in both languages. Test mints 26003 through 26007 | 0.6.0 |
| 2026-08-31 | Penn North confirmed correct by owner ruling; the migration 0006 guess stands | 0.6.0 |
| 2026-08-31 | **CLOUDFLARE ACCESS IS LIVE** on the production workers.dev URL: Zero Trust org **gflite** (free plan), Worker Access scope All traffic, policy Allow for emails ending in @gripcannabis.com, One-time PIN login, 24 hour sessions. Verified enforcing from an unauthenticated browser (redirect to gflite.cloudflareaccess.com). The Access-before-crew-data requirement is satisfied for the Grip site | 0.6.0 |
| 2026-08-31 | Post-Access verification lanes: the Scribe's unauthenticated browser now stops at the wall; live checks run through remote D1 queries via wrangler plus Dennis's authenticated browser. Cosmetic parking-lot item: the login page shows an auto-generated org label (aged-snowflake-24fc); rename lives in Zero Trust settings | 0.6.0 |
| 2026-08-31 | Go-live reset stays armed and fires only on Dennis's words "wipe it": recreate the grip D1, remigrate, new id into wrangler.toml, redeploy, verify empty queues, commit the toml change locally | 0.6.0 |

## 9. Open items / parking lot

1. **Slice 2 remainder**: the spear field is built (slice 2a); the B05/B10 deepening talk-through remains (who weighs where, manifest shape, hang vs silo differences).
1b. **26H workbook edit owed** (Dennis/team, one cell): Abbr tab, Blue Andeez strain code 071 → 078, so the workbook and the app agree.
2. **Cloudflare Access on the Grip site: DONE 2026-08-31** (Zero Trust org gflite, All traffic, One-time PIN, emails ending @gripcannabis.com). Remaining: exposure model for the C10 site; optional rename of the auto-generated org label (aged-snowflake-24fc) in Zero Trust settings.
2b. **Post-break-in reset**: Dennis and the Scribe will break the deployed site in on test data; before the first real mint, the grip D1 gets wiped clean (drop and recreate the database, reapply migrations, swap the new id into wrangler.toml, redeploy).
3. **Theme tokens**: real Grip and C10 CSS token sets (C10 tokens already extracted in Harvest Console).
4. **B02 leftovers**: ABC column meaning; when Cuts and Plants land; audit and report shape beyond CSV.
5. **Console incorporation shape**: decided when the walk reaches console-shaped boxes.
6. **Real product name**: "Gripfactory Lite" is a working title.
7. **9/1 day-one minimum**: which boxes must be live falls out of the walk.
8. **Lessons register additions** in Dennis's own words, whenever he wants to add them.

## 10. Change log

| Version | Date | Change |
|---|---|---|
| 0.1.0 | 2026-08-27 | Canon established from Dennis's charter brief plus interrogation round 1. |
| 0.2.0 | 2026-08-27 | Grounding fold plus Box Doctrine. Sources: five-folder archaeology, Dennis's Visio, three AskUserQuestion rulings. Style law applied to the document itself. |
| 0.2.1 | 2026-08-27 | B01 adopted as human, no tool. B02 opened and sourced from the 25H and 26H opsdash workbooks; zone and rows restored to the batch record. |
| 0.3.0 | 2026-08-27 | Hosting pivot folded: two Cloudflare sites, D1 with portable SQL; G-4 rewritten; ADR-2 amended; ADR-5 queue spine; YYDDD mint; slice 1 prompt issued. |
| 0.3.1 | 2026-08-27 | Slice 1 verified. Mint law corrected (ADR-6: YY### lot serial, silo zero-pad). Blue Andeez 071 → 078 ruled. Slice 1.1 fix prompt issued. |
| 0.3.2 | 2026-08-27 | Slice 1.1 verified. Mint law is live in code. Deploy day is next; migration files frozen (append-only) from the first deploy onward. |
| 0.3.3 | 2026-08-27 | Floor verdicts folded: manual queue exits, wet-weight pair (spear optional, slice 2), Arlington Dry Room seeded. Deploy delegated to Scribe via scoped token. |
| 0.3.4 | 2026-08-27 | First hosting package shipped: gflite-grip-hostpkg-v0.1.zip for Corey's agent (grip env only). Token path retired. Post-break-in reset added to open items. |
| 0.4.0 | 2026-08-27 | Grip edition deployed and live; first mint verified in production; token lifecycle completed and closed. Break-in phase opens. |
| 0.4.1 | 2026-08-27 | Break-in ruling 1 folded: stations-only home, queues under Admin as Data Queues with inline records. Slice 1.2 prompt issued (UI only, migrations frozen). |
| 0.4.2 | 2026-08-27 | G-2 amended (Scribe applies small slices). Slice 1.2 applied and committed; deploy pending, live verification follows. |
| 0.4.3 | 2026-08-27 | Builder lane: Claude Code replaces Cursor (voice). Scribe-deployed code agents become the autonomous build lane. |
| 0.4.4 | 2026-08-27 | Slice 2a (wet weight pair) built by code agent, Scribe-verified, committed. Pending deploy alongside 1.2. |
| 0.4.5 | 2026-08-28 | Slices 1.2 + 2a live and verified in production. Break-in continues. |
| 0.4.6 | 2026-08-28 | Left-pane law corrected and built (wet_weight, farm groups); truck number law (migration 0005). Slices 2b + 2c verified, deploy pending. |
| 0.5.0 | 2026-08-28 | Wet weight station law (header + weights ledger, Finish lot routing), trucks as destinations, Inbound Queue, farm names, i18n law, Interco stub. Slices 3a + 3b verified; one deploy ships 0.4.6 + 0.5.0 work. |
| 0.5.1 | 2026-08-28 | Hang in Place at PNN via destination farm scoping (migration 0007). One pending deploy now carries migrations 0005 through 0007. |
| 0.5.2 | 2026-08-28 | Pane hides finished HBNs (slice 3d). Repo CLAUDE.md: local Claude Code deploys by voice. |
| 0.5.3 | 2026-08-28 | Scribe role made portable: prompts/SCRIBE_SEED_CODE.md spawns a Code-side Scribe sitting. One Scribe at a time; canon carries the baton; no private state outside canon files and session reports. |
| 0.6.0 | 2026-08-31 | Wet weight rebuild deployed (worker 92a0a590) and live-verified in production; Cloudflare Access live on the Grip site (gflite org, One-time PIN, @gripcannabis.com, all traffic); Penn North confirmed; pointers refolded at current canon; go-live reset armed awaiting "wipe it". |
