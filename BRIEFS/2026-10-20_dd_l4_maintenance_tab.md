# DD L4: the Maintenance tab on the Farming Operations wall

Filed by the Scribe on 2026-10-20 (canon 0.30.531) from the Farming Operations director's change list, sent by the owner. Logan: add a Maintenance tab with active projects, upcoming work and a forecast; Equipment for Sale optional. The owner's picks (2026-10-20): the Maintenance node feeds it (open tickets and the PM schedules), a small projects form supplies the projects, the forecast is PM due dates over the next eight weeks against the GRIPCasting maintenance budget, and Equipment for Sale is in now: item, condition, asking price and status, typed on the asset.

For the build session (Cursor, one plain session, no sub-agents): open in `C:\Users\DennisWallace\Documents\Claude\Projects\gripfactory Practical\branches\GFLiteMetrcAPI` (its `app\` is the app). If your working folder is not under `branches\GFLiteMetrcAPI`, stop and say so. Under THE DISPATCH RULE (canon 0.30.155).

RUN AFTER L3. Pin: the L3 gated tree `e643371c9056a36c` (418 files, gated 2026-10-22 with the Scribe's projection fix). Verify with canon's hash command in `app/` and stop if it differs. No git; nothing committed, pushed or deployed. One migration, `0116`. LF only. Read big files by search and line range (`src/equipment.ts`: `listEquipmentAssets`, `listAllSchedules`, `nextDueFrom`, `isOverdue`, `listAssetTickets`, `equipmentAssetPage`; `src/gripcasting/model.ts` `buLines` and the maintenance GL set the registry names for `farmops.maintenance_spend_vs_budget_pct`; `src/director.ts` for the wall head and the department tabs).

## 1. Migration 0116 (guarded and idempotent; nothing seeded)
- `dd_projects`: id, name, owner_name (free text; a person's name typed by a director, never seeded), farm_code null, status (planned, active, paused, done), started_on, expected_on, cost_to_date_usd NUMERIC null, budget_usd NUMERIC null, note, the audit columns. Index on status.
- `equipment_assets` gains four columns: sale_status TEXT null (listed, under_offer, sold), sale_condition TEXT null, asking_price_usd NUMERIC null, sale_note TEXT null. Nothing else on the asset changes; the frozen seed rows keep their values.

## 2. The projects form (`/admin/director/projects`, behind the Admin PIN)
Add a project (name, owner, farm, status, started on, expected on, budget), edit in place (status, expected on, cost to date, note), with the actions law and a reason where the app asks one; done projects under a "show done" link. Listed on the Director Dashboard home beside the other forms.

## 3. Equipment for Sale on the asset (Maintenance, `/equipment/:id`)
A small "For sale" block on the asset page: status select (not for sale, listed, under offer, sold), condition (text, short), asking price (USD), note; one save, logged to record_change_log with reason "asset for sale". `/equipment` marks listed assets with a word in the list. `farmops.assets_for_sale_count` reads the count of assets with sale_status listed or under_offer; registry compute_key updated, status live, def_version 2 (in the 0116 migration and src/directorregistry.ts together; the registry test moves).

## 4. The tab (`/admin/director/maintenance`)
A page in the director pages' style, reached from a "Maintenance" tab in the Farming Operations wall's head (beside the wall itself; the other walls get no tab) and from the Director Dashboard home. Four sections, in this order:
- ACTIVE PROJECTS: one row per project with status planned, active or paused: name, owner, farm, started, expected, a horizontal bar of elapsed time against expected (the L2 bar law, with cost to date over budget printed when both are typed), the note. Sorted by expected date. Empty: "No projects entered" with the form link.
- UPCOMING WORK: the next eight weeks of PM due dates from the schedules (`nextDueFrom` per schedule, overdue first in the warning color, then by date), each with the asset, the task and the interval; and the open tickets (asset, title, age in days). Empty states in words.
- FORECAST: a bar per week for the next eight weeks of PM tasks due (count), with the overdue count as a first bar; under it one line: "Maintenance budget: $X spent of $Y this year (Z%)" from GRIPCasting's maintenance lines (the GL set the registry names, BU 11), or "Maintenance budget: not in GRIPCasting yet" when the build has none. Nothing is projected beyond what the schedules say.
- EQUIPMENT FOR SALE: assets with sale_status listed or under offer: name, serial, farm, condition, asking price, status; "Nothing listed for sale" when none.
Values as text through `esc`; theme tokens only; fits at 1920, 820 and the phone with no sideways scroll.

## Tests
- The projects form: add, edit, done, the bar law.
- The for sale block: save, the change log reason, the list word, the count the registry row reads.
- The tab: upcoming work from a fixture of three schedules (one overdue), two open tickets; the eight week forecast counts; the budget line from a GRIPCasting fixture and the "not in GRIPCasting yet" line without one; the for sale section.
- The tab appears on the farmops wall head only.
- No dash characters in any output; no person's name in any fixture.

## Smoke and gates
Smoke: `About to apply 115 migration(s)` (L3's read 114). Add a project, mark one seeded asset listed, load the tab and check the four sections; keep every other check. Gates: typecheck 0; vitest under both time zones with counts; `node --check scripts/smoke.mjs`; the from zero smoke (SMOKE PASS, no 500; keep the log's last lines so the pass line shows); dash, CR and name scans of every touched file. THE RENDER LAW (owner, 2026-10-22): no screenshots and no browser renders in this session; the Scribe renders the tab, the projects form and an asset page in the three themes at the three widths at the gate.

## Hand back
Report `SESSION_REPORTS/2026-10-20_dd_l4_maintenance_tab.md`, short: the tree received and left, files touched, gate results, anything declined and why. Close with the tree hash and that nothing is committed, pushed or deployed. The Scribe gates; the owner merges (L1 to L4 in one push; the block takes a snapshot, four migrations ride).
