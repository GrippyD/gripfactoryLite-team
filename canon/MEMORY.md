# MEMORY: Gripfactory Lite Scribe

**Project:** Gripfactory Lite (working title), repo folder "gripfactory Practical"
**Owner:** Dennis (OCG Companies / Grip Cannabis)
**Last session:** 2026-08-31 (local Claude Code Scribe sitting): wet weight rebuild deployed and live-verified; Cloudflare Access stood up; Penn North confirmed; identity law (login email = actor) and PIN gate (21319 on Admin/Interco) ruled, built as slice 4, deployed (worker a2416f32, migration 0008); baton cleanup commit; wipe armed on "wipe it". Same day (cloud Scribe sitting): Fulfillment surface built per owner ruling, folded at 0.7.1, deploy pending.

## Pinned state

- **Canon version: 0.7.3** (folded 2026-08-31: void return law on top of the Fulfillment deploy; live worker 76e714ec-fb63-4ba2-8760-add03d440dac)
- Hosting facts: Dennis's personal Cloudflare account (wallacedennis1985@gmail.com), workers.dev subdomain **gflite**, worker name gripfactory-lite-grip, D1 gripfactory-lite-grip id 2a70ba1f-3cc0-4eea-b9dd-54c42afd1789 (**this id dies at the wipe; re-pin after**). No API tokens on the account.
- **Access facts:** Zero Trust org **gflite** (free plan), Worker Access on gripfactory-lite-grip, scope All traffic, policy Allow emails ending @gripcannabis.com, One-time PIN, 24 hour sessions. Login page shows auto-generated label aged-snowflake-24fc (rename parked). Unauthenticated verification browsers stop at the wall: post-Access live checks = wrangler remote D1 queries + Dennis's authenticated browser.
- **ADR-7 auth surface (2026-08-31):** actor = Access login email via Cf-Access-Authenticated-User-Email, people auto-create on first login (unique email, migration 0008), actor injected server-side, Lead stays a picker (lead_person_id on the lot), dev/smoke act as dev@local. PIN 21319 gates /admin*, /interco, and /fulfillment* (0.7.1), stored in app_config, 12 h cookie. Parked: JWT/AUD verification, PIN editable in Admin.
- **Fulfillment surface (0.7.1):** home tile [Fulfillment] (es Despacho) lands on our vendored copy of the SalesHelper node: app/public/saleshelper/{index.html, menu.json} served worker-first at /fulfillment/ with no-store (wrangler [assets] + per-env blocks: directory public, binding ASSETS, run_worker_first true, html_handling none). /fulfillment redirects to the trailing slash so the form's relative menu.json fetch resolves. The form's /api/send is unrouted here and falls back to CSV/JSON download plus mailto. **Vendored-pair law: never edit those two files in place, only replace by copy from the SalesHelper repo.** Deployed 2026-08-31 (worker dcb4791c).
- **Deploy lanes:** the LOCAL Scribe sitting (Dennis's machine) runs wrangler itself: from `app/`, `npx wrangler d1 migrations apply gripfactory-lite-grip --env grip --remote` then `npm run deploy:grip`, read back version id + URL. The CLOUD Scribe shells stay proxy-blocked from api.cloudflare.com (their lanes: Chrome dashboard + Dennis's terminal). Never deploy c10 without Dennis's say-so.
- **Go-live: 2026-09-01** (Grip harvest). C10 Compliance Console hard need: 2026-09-09.
- Repo: `Documents\Claude\Projects\gripfactory Practical` (ratified home). Local git, commits only, no remotes (G-1).
- **Active line: go-live hardening.** Wipe armed, fires only on Dennis's words "wipe it" (recreate grip D1, remigrate, new id into wrangler.toml, redeploy, verify empty, commit toml). All current DB content is test data (mints 26001-26007).

## Open threads

- Dennis's production visual check of slice 4 plus Fulfillment (chrome email, PIN gate on all three surfaces, Lead picker, auto-created person row, order form loads with honest data-age badge)
- Fulfillment follow-ups parked: menu refresh lane, /api/send order capture, Corey's pages.dev copy's fate
- Wipe on the words, then re-pin the new D1 id here and in _NOW
- 26H workbook Abbr one-cell edit (Blue Andeez 071 → 078): Dennis, tonight
- After go-live hardening: B05/B10 deepening talk-through, then B03/B04 in map order (`canon/PROCESS_MAP.md`)
- B02 leftovers (ABC meaning, Cuts/Plants timing, audit shape); console incorporation shape when the walk reaches console-shaped boxes
- c10 deploy for Christine; C10 exposure model; theme token sets; product name
- Server-side Move To enforcement awaits a ruling (UI-filtered only today)

## Project gotchas (hard-won)

- **Style law: NO em or en dashes in anything, chat included.** Plain hyphens, commas, colons. (Owner directive 2026-08-11, carried in as G-8.)
- **Rulings go through AskUserQuestion, never chat lists.** A stranded list in an hours-old conversation hinders (Dennis, 2026-08-27).
- Dennis works the live site in parallel with the Scribe's verification; unexplained rows are usually his (confirmed 2026-08-31: "I was running those lots"). Check timestamps before suspecting a bug.
- Connected-folder mounts block unlink and rename on the cloud side; local git on Windows is fine; repos travel as zips.
- Write repo text via verified writes: wc -c plus tail; sha256 when views disagree; the side that wrote last is authoritative.
- opsHelpers architecture = Plato Bible §4/§5/§6. The Access .accdb backups do not parse; the Bible is the usable source.
- When sampling sheet values, print untruncated; the formula is the truth, read it to the end.
- Local dev gotcha: `app/.wrangler` can hold an already-applied local schema; delete once after in-place migration edits. Smoke uses its own persist dir and is immune.
- Assets gotcha: `html_handling = "none"` is required or the ASSETS binding answers /saleshelper/index.html with a 307 instead of the file; run_worker_first keeps the PIN in front of every asset byte. worker-configuration.d.ts regenerates via `npx wrangler types` and carries vendor doc-comment dashes (generated file, exempt from the G-8 audit like the vendored saleshelper pair).
- Never save the live 26H .xlsm from openpyxl (slicers and validations would break). The Scribe only reads it.
- Browser-pane automation quirk (local sitting, 2026-08-31): ref-based clicks can miss after flash banners shift layout; click by screenshot coordinate after a fresh screenshot, and re-read the page after each 303. A focused select swallows keyboard input (End changed a strain once); re-set via form_input.
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
