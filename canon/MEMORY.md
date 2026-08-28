# MEMORY: Gripfactory Lite Scribe

**Project:** Gripfactory Lite (working title), repo folder "gripfactory Practical"
**Owner:** Dennis (OCG Companies / Grip Cannabis)
**Last session:** 2026-08-27: canon stood up and grounded (v0.1.0 → v0.3.0); B01 adopted as human; B02 sourced from both opsdash versions; hosting pivot folded (two Cloudflare sites, D1, portable SQL); slice 1 queue-spine prompt issued to Cursor.

## Pinned state

- **Canon version: 0.3.0** (folded 2026-08-27: hosting pivot, ADR-5 queue spine, YYDDD mint, G-4 rewritten)
- **Go-live: 2026-09-01** (Grip harvest). C10 Compliance Console hard need: 2026-09-09.
- Repo: `Documents\Claude\Projects\gripfactory Practical` (ratified home). `canon/`, `prompts/`, `app/seed/strains.csv` emplaced 2026-08-27.
- **Active line: slice 1 build.** Prompt at `prompts/2026-08-27_slice1_queue_spine.md`; Cursor builds, no deploy; session report + sealed check come back for Scribe verification.
- Deployment shape: Cloudflare Workers + D1, wrangler envs `grip` (Corey) and `c10` (Christine), same behavior, different CSS tokens, data on-site per env. SQL Postgres-portable (Aurora someday-case). Source workbooks: 25H (chat upload), 26H suite ("Harvest 2026" connected folder).

## Open threads

- Verify the slice 1 session report when it lands (sealed check verbatim, smoke chain end to end), then surface the five owner flags: queue-exit rules, trailing YY, wet weight split, dry space seed, Cloudflare Access
- Deploy day: wrangler login is Dennis's; real D1 ids per env; Access on the Grip site before crew data
- Then the walk resumes in map order (`canon/PROCESS_MAP.md`): B02 leftovers (ABC meaning, Cuts/Plants timing, audit shape), wet weights deepening, B03/B04
- The "Harvest 2026" folder holds the 26H suite (trim, trim trailers, cryo, prepack workbooks mapped in the registry)
- Console incorporation shape: decide when the walk reaches console-shaped boxes
- Product name, 9/1 day-one minimum, HBN spec confirm at B02
- Repo skeleton Cursor prompt lands with the first built box (stack per ADR-2)

## Project gotchas (hard-won)

- **Style law: NO em or en dashes in anything, chat included.** Plain hyphens, commas, colons. (Owner directive 2026-08-11, carried in as G-8.)
- **Rulings go through AskUserQuestion, never chat lists.** A stranded list in an hours-old conversation hinders (Dennis, 2026-08-27).
- Connected-folder mounts block unlink and rename: a live .git cannot run on them from this side (lock files become undeletable); Cursor's native git on Windows is fine; repos travel as zips (Harvest Console precedent).
- Write repo text via device_bash heredoc or device_commit_files and **verify every write**: wc -c plus tail; sha256 from both sides when views disagree; the side that wrote last is authoritative (SCRIBE_NOTES pattern).
- opsHelpers architecture = Plato Bible §4/§5/§6. The Access .accdb backups do not parse with access-parser; the Bible is the usable source.
- Sibling canons (read-only sources): `gripfactory/PLATO_BIBLE.md`, `gripfactory/SCRIBE_NOTES_V4.md`, `Harvest Console/harvest-console-CANON.md`, `Harvest Console/new-farm/NEW-FARM-CANON.md`, `Harvest Console/handoff/HOSTING.md`, `SalesHelper/CANON.md`, `Compliance Console/ComplianceConsole_CANON.md`.
- Claude Project mirror paths: `canon/CANON.md`, `canon/PROCESS_MAP.md`, `canon/MEMORY.md`, `canon/_NOW.md`.

## Cast (from the map and the sibling canons)

- Dennis: owner. Corey: trim batching on the map, internal package recipient. Christine: C10 recipient. Rich: GF rollout owner per Compliance Console canon.
- Map crew: Directors, Patrick (ops dash, METRC, Zoho), Ashley, Harvest Leads, Rancho (hang site), Plutarcho, Luis, Les/Keith/Austin/Matt (silo mgmt), David/Chucho, Kara, Karen, Pablo, Anibal.
- Crew names are internal working data only (G-9 ship-clean).

## How the owner likes to work

- Terse, no recaps, reads diffs. Address by name.
- He answers pickers in free text when the options miss; parse the text as the ruling and fold it. He also delegates ("make a recommendation") and expects the Scribe to pick and own it.
- Focused questions through AskUserQuestion get rich answers; he answers partially and lets the rest ride; proceed on what is answered.
- He supplies the current tool per box. The Scribe never designs ahead of the open box and calls out drift, his or its own. "Stop and talk through every box."
- "Orange barrel that" = defer and track. Operator vocabulary (HBN, CSA/CSB, aW, MOB): ask, do not guess.
- No flubdubs. Screens fill with real operations.
