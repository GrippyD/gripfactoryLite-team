# GRIPFACTORY LITE, CANON

**Version:** 0.3.0
**Status:** Active, Source of Truth
**Owner (final authority):** Dennis, sole ratifier
**Scribe:** persistent Claude session attached to the **gripfactoryPractical** project
**Home:** `canon/` in the repo at `Documents\Claude\Projects\gripfactory Practical` (canonical); the Claude Project docs are the Scribe's synced mirror
**Last updated:** 2026-08-27

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
| Builder | Cursor | All code, in the local repo, from Scribe-written prompts |
| Design agents | independent agents | Design assistance, engaged by the Scribe |
| Recipients | Corey (Grip ops), Christine (C10) | Receive the package; testers, not approvers |

**The Loop:** Dennis states the goal; the Scribe grounds against canon, then directs the work; the Scribe surfaces results and proposed amendments; Dennis ratifies, overrides, or defers; the Scribe folds, bumps the version, updates MEMORY and _NOW.

**Rulings interface (ratified 2026-08-27):** decisions are put to Dennis through AskUserQuestion pickers, never as lists stranded in chat. Durable state lives in canon files, not in the conversation.

## 4. Standing rules (guardrails)

- **G-1, No GitHub.** Work stays in the local repo. No pushes, no remotes.
- **G-2, The Scribe writes no code.** Cursor builds; the Scribe writes the prompts.
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

## 9. Open items / parking lot

1. **Slice 1 review confirmations**: manual queue-exit rules (Mark complete, Mark trimmed); trailing YY redundancy in the mint; single wet weight field vs 25H's spear + bucked pair; dry space seed list.
2. **Cloudflare Access on the Grip site** before real crew data goes in (Dennis/Corey step); exposure model for the C10 site.
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
