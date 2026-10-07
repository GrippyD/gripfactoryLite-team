# BRIEF PC1: ASSIGN PLANT COUNTS (canon 0.30.416, re-pinned 0.30.417)

For the build session (Claude Code or Cursor) opened in the worktree `C:\Users\DennisWallace\Documents\Claude\Projects\gripfactory Practical\branches\GFLiteOpsDashboard` (its `app\` is the app). NOT the main folder `gripfactory Practical\app`: if your working folder is not under `branches\GFLiteOpsDashboard`, stop and say so. Under THE DISPATCH RULE (canon 0.30.155). Built FIRST in the session, on the worktree exactly as it stands LIVE after FM1 (the app tree `cba603e2aee6dc4b`, 301 files, migrations 0001-0094); then the same session builds BRIEF V29 (`BRIEFS/2026-10-06_dashboard_drying_as_it_was.md`) on the tree PC1 leaves, then BRIEF A1 (`BRIEFS/2026-10-06_admin_cleanup.md`) on the tree V29 leaves, and all three are gated and pushed together. The tree hash is canon's command, run in `app/` with `wrangler.toml` read as LF: `(find src test scripts migrations -type f; echo wrangler.toml; echo tsconfig.json; echo package.json) | LC_ALL=C sort | xargs sha256sum | sha256sum | cut -c1-16`; if the disk differs, stop and say so. One build agent in this worktree at a time. No migration.

## The source (verbatim)

The owner, 2026-10-06: "New button in field operations: [Assign Plant Counts] Left Pane: List of all HBNs without a plant count assigned (this is our optional field, remember?) Plant count field underneath \">>\" Delivers to right pane \"<<\" in the right pane allows a re-edit in the left."

What the code holds (the live tree): "field operations" is the Harvest Operations group (`OPS_GROUPS` in `src/pipeline.ts`, key `harvest_ops`, members Acquire HBN, Penn North Harvest, Penn South/Arlington Harvest). The plant count is `wet_weight_entries.plant_count`, optional, typed at a lot's finish (`plant_prompt` may skip it) or at Load Silo; `parsePlantCount` in `src/audit.ts` takes a whole number, one or more, commas allowed. Dry Weight/plant on the dashboard counts only lots with a count (canon 0.30.409). Pending Data Uploads compares a lot's count with the one its wet weights file carried (`listChangedAfterUpload`).

## The law

1. THE BUTTON. Harvest Operations gains "Assign Plant Counts" (ES "Asignar conteo de plantas"), after Penn South/Arlington Harvest, at `/station/assign_plant_counts`, the same roles as the harvest stations.
2. THE LEFT PANE, "No plant count". Every live lot (entry and batch not deleted) of the harvest year with no plant count, oldest farm day first: HBN, lot last 5, farm, state (a lot still weighing says so). A batch with two entries shows both, each with its lot token, so each gets its own count. Pick one row; under the list, "Plant count" and the ">>" button.
3. ">>" SAVES. It writes the count to that lot (`parsePlantCount`; a bad number refused in place, nothing written), logged in `record_change_log` (field plant_count, old value null, reason "assign plant counts"), and the lot moves to the right pane. No second Save button.
4. THE RIGHT PANE, "Assigned". The lots given a count on this screen (their log reason), newest first, with the count, who and when; a lot already in the left pane never shows here.
5. "<<" RE-EDITS. On a right pane row it brings the lot back to the left pane with its count filled in the field, selected; the stored count stays as it is until ">>" saves the new one (logged with the old value). Nothing is cleared by "<<".
6. LEAVING THE SCREEN with a lot pulled back by "<<" and not resaved changes nothing: the lot keeps its count and returns to the right pane on the next visit.
7. NOTHING ELSE MOVES. The finish and Load Silo prompts stay as they are; a count typed there removes the lot from the left pane. Lite, CO and Cerberus; on a phone the panes stack, left over right, the buttons full width.

On `db_backups/20261005-203534_post_plants`, for the check: after the workbook repair, the left pane holds lot 26091's two entries (one drying, one still weighing); every other live 2026 lot has a count.

## The tests and the smoke

- Unit: the left pane lists only live lots of the year with no count, both entries of a two entry batch, a weighing lot marked; ">>" writes and logs; a bad count is refused with nothing written; "<<" fills the field and leaves the stored count; a resave logs old and new; the right pane shows only lots given a count here; a count typed at finish takes a lot off the left pane.
- Smoke: a smoke lot finished with the plant prompt skipped appears on the left; ">>" with 412 moves it right and the dashboard counts it; "<<" then ">>" with 415 logs 412 to 415; a bad count "abc" answers with the words and writes nothing.
- Render check at 1920 in Lite, CO and Cerberus, and phone width in one view.
- Gates with V29's and A1's: typecheck 0; vitest under `TZ=UTC` and `TZ=America/New_York`; `node --check scripts/smoke.mjs`; the from-zero smoke (`About to apply 94 migration(s)`), SMOKE PASS, no ` 500 `. Dash and CR audits by character; no personnel name in a tracked file. No git; nothing committed, pushed or deployed. One report per brief to the worktree's `SESSION_REPORTS/`, each with canon's tree hash and every file touched.
