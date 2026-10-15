# DD S2a: Director Dashboard hand entry (the entry grid, the KPI detail with its history and change log)

Filed by the Scribe on 2026-10-15 (canon 0.30.497) from the owner's word: build S2 in Cursor as one plain session, split in two. S2a is the entry grid and the change log; S2b (targets and phasing, the questions page, CSV import) follows after the gate.

For the build session (Cursor): open in `C:\Users\DennisWallace\Documents\Claude\Projects\gripfactory Practical\branches\GFLiteMetrcAPI` (its `app\` is the app). If your working folder is not under `branches\GFLiteMetrcAPI`, stop and say so. Under THE DISPATCH RULE (canon 0.30.155). Pinned to the live tree `5f1135c4f2b22757` (DD S1 and FG5 live, worker 3b9a58ea, migrations through 0105). Verify with canon's hash command in `app/` (`(find src test scripts migrations -type f; echo wrangler.toml; echo tsconfig.json; echo package.json) | LC_ALL=C sort | xargs sha256sum | sha256sum | cut -c1-16`, `wrangler.toml` read as LF) and stop if it differs. No git; nothing committed, pushed or deployed. No migration: every table S2a writes exists from 0105. LF only.

## How to work (keep it lean)
One session, no sub-agents, no research. Read what this brief names, by line range or by search, not whole files: `src/html.ts`, `src/i18n.ts`, `src/index.ts` and `src/actions.ts` are each 190 to 350 KB, so find your spot and read around it. Start from the S1 code: `src/director.ts`, `src/directorregistry.ts`, `migrations/0105_director_dashboard.sql`, `test/director.test.ts`, the DD block in `scripts/smoke.mjs`. `SESSION_REPORTS/2026-10-15_dd_tranche1_stop.md` (its appendix) is the full S2 spec the ultracode session wrote; S2a is its items 1, 2 (without targets) and 5 (the links for these pages only), restated here.

## The house rules (as S1)
No personnel names in any file. No em dash or en dash (audit by character). Values in data with code fallbacks. Every write takes the person and a reason and lands in record_change_log; a save that changes nothing writes nothing. At most 100 binds per statement; one db.batch per GET and per POST. EN and ES for every word (one DD2 block in i18n). Three themes (Lite, CO, Cerberus) through theme tokens; no sideways scroll at 820. No public/ files. Do not touch canon/, prompts/, or migrations 0001 to 0105.

The person is the login actor, as the stations do it: POST handlers wrap the form with `actorForm(c, form)` (src/index.ts:592) and the action calls `requireActor(db, personIdFrom(form))` (src/db.ts:91; personIdFrom at src/actions.ts:208), so a login with no active people row is refused with "Select a person." No person picker. The reason is a required field (`requireReason`, src/audit.ts:32), defaulting on the grid to "Weekly entry" (through t()), editable. Log rows through `insertLog` (src/db.ts:3745).

## 1. The entry grid
`GET /admin/director/:dept/enter?cadence=...&period=YYYY-MM-DD` (behind the /admin PIN gate; register the literal routes before the `:dept` wall route). The period defaults to the current one for the cadence from the farm today through the S1 period helpers in src/farmday.ts; previous and next period links and a cadence tab row like the wall's.

One db.batch: the wall's active registry rows for the cadence (wall_keys holds the dept), the live dd_kpi_values rows for this period and the previous one (all sources; dim '' and, for rows whose dims list farm, PNN, ARL and PNS; other dims are not entered in S2a and the row says so), and the dd_ app_config map.

One row per KPI: title in the locale, unit, the open question marker.
- source_kind `hand` or `mixed`: an input per cell (the total; the three farm cells when the dims include farm), the previous period's value as the placeholder, the current live hand value as the value. A text unit gets a short text input.
- source_kind `app`, `mount`, `gc` or `connector`: the live value shown locked with its source badge, or "no snapshot yet"; no input. (These fill from S3 on.)
- A reason field, the Supervisor line, Save. Markers: `data-dd-grid`, `data-dd-cell="<kpi_key>|<dim_key>"`, `data-dd-locked` on locked cells.

`POST` the same path. Cells arrive as `cell:<kpi_key>|<dim_key>`.
- Refuse (400, naming the KPI title) a value that is not a plain number, a pct outside 0 to 100, a count that is not whole.
- Compare each cell with the live hand row for (kpi_key, period_kind, period_start, dim_key): blank with no hand row, skip; equal to the live hand value, skip; anything else is a change. A posted locked cell is ignored.
- Nothing changed: no write at all; redirect with `?ok=nochange` ("Nothing changed, nothing written.").
- Otherwise one db.batch, per changed cell: supersede the old live hand row (superseded_at now) if any; insert the new dd_kpi_values row (id crypto.randomUUID(), source 'hand', entered_by the actor, reason, computed_at now, def_version from the registry row); one record_change_log row (record_table dd_kpi_values, record_id the new row, or the superseded row when a blank clears a value; field value; old and new values; actor; reason). A blank cell over a hand value supersedes without inserting (clears it). Statements one row each, never a multi row insert. Redirect `?ok=saved&n=<count>` ("Saved N values.").

## 2. The KPI detail (history and change log; targets come in S2b)
`GET /admin/director/kpi/:key` (404 on an unknown key). One db.batch: the registry row; its dd_kpi_questions row by config_key (if any) with the current app_config value; the live and superseded dd_kpi_values rows for the last dd_history_periods periods (all sources and dims); the record_change_log rows on dd_kpi_values whose record_id belongs to this key (a subselect by kpi_key), newest first, at most 100.

Render the definition block (titles, unit, cadence, season window, dims, goal kind and ref, source kind, status, definition version, config key with its value and the ruling), the history table (one row per period, a column per source present, superseded values struck through in a collapsible row), and the change log table. Markers: `data-dd-detail`, `data-dd-history-row`, `data-dd-log-row`.

## 3. Links
Each wall cadence tab gets "Enter this period" to the grid (only where the wall has a hand or mixed row for that cadence); each tile title links to its KPI detail. The home card count now says what it counts: "N own KPIs" (the wall also shows the shared harvest family). Grid theme: a table on desktop that stacks to one cell per line under body.device-phone, inputs at full width when stacked.

## Tests
- Grid: a save of 120 changed cells builds statements none above 100 binds (wrap the test db to record binds per statement); one log row per changed cell, none for unchanged; a second identical save writes nothing (row counts equal); a missing reason answers 400 "Reason is required."; a non numeric value answers 400 naming the KPI; a posted locked cell is ignored; a blank clears a hand value and logs it; a farm row saves its three dims.
- Detail: 404 on an unknown key; history shows a superseded value; the log lists the save.
- Links: the wall's enter link appears only for cadences with a hand or mixed row; the home card text.

## Smoke and gates
Append to the DD smoke block (PIN cookie in the jar): GET the bizops grid 200 with `data-dd-grid` and a `data-dd-cell`; POST with nothing changed answers 303 and adds no log row; POST one value answers 303 and the KPI detail shows it with one log row; GET the detail 200 with `data-dd-detail`. One assert message naming the statuses. The migration pin stays at 104.

Gates: typecheck 0; vitest under TZ=UTC and TZ=America/New_York with counts; `node --check scripts/smoke.mjs`; the from zero smoke (`About to apply 104 migration(s)`, SMOKE PASS, no 500); renders of the grid and the detail at 1920 and 820 in Lite, CO and Cerberus (no sideways scroll); dash, CR and name scans of every touched file.

## Hand back
Report `SESSION_REPORTS/2026-10-15_dd_s2a.md`, short: the tree received and left, files touched, gate results, anything declined and why. Close with the tree hash and that nothing is committed, pushed or deployed. The Scribe gates; the owner merges.
