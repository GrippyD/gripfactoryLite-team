# WL2: WIP Package Lineage under Reports

Filed by the Scribe on 2026-10-20 (canon 0.30.527) from the owner's word: "[the analyst] came up with this, can we add it to reports?" Her dashboard is the design and the rules: `branches/GFLiteMetrcAPI/RESEARCH/wip-lineage-dashboard/` (README, index.html, src/metrc-normalize.js). Read it on the disk; do not copy her data file anywhere. His picks: the page reads the METRC mirror (WL1 makes it take Inactive and Transferred), not a separate upload; pounds are the app pound, grams over 448.

For the build session (Cursor, one plain session, no sub-agents): open in `C:\Users\DennisWallace\Documents\Claude\Projects\gripfactory Practical\branches\GFLiteMetrcAPI` (its `app\` is the app). If your working folder is not under `branches\GFLiteMetrcAPI`, stop and say so. Under THE DISPATCH RULE (canon 0.30.155).

Part of THE QUEUE (`BRIEFS/2026-10-23_queue_wl1_wl2_s3g.md`): read it first; its runner law and stop rules apply here. SECOND IN THE QUEUE. Pin: the tree WL1 left, as WL1's report states. No migration (if a read wants an index, write it under Decided and read without one: the tables hold a few thousand rows). No git; nothing committed, pushed or deployed. LF only. Read big files by search and line range (`src/reports.ts`, `src/nav.ts`, `src/metrc.ts`).

## 1. Where it lives
A new page under Reports, "WIP Lineage" (ES "Linaje de paquetes WIP"), listed with the other reports and behind the same sign-in. It carries buyer names, licenses and manifest numbers: never expose it on a public route, a feed, or a page without the Reports gate.

## 2. The data
Read on the page load from `metrc_packages` and `metrc_transfers` for license AU-P-000694 (a license select if more than one processor license has packages), grouped reads only.
- One row per tag with her columns (tag, status, source_harvest, source_package, item, category, strain, quantity, uom, location, lab_status, packaged_date, destination, destination_license, manifest, shipped_date, transfer_type). Status: Active for a live package, Finished or Discontinued from `inactive_state`, Transferred from a transfer row; a tag in more than one takes Transferred over Inactive over Active (her rule 6).
- Port her four derived calculations (wip_families, wip_branches, family_lab, wip_totals) and her business rules 1 to 5 from her README and index.html into a TypeScript module with tests. Shipped pounds: grams over 448 (the app pound; her file used 453.592), pre-rolls in units.
- "Data as of": the newest mount instant of each grid (Active, Inactive, Transferred), each printed, so a stale grid shows.

## 3. The page
Her layout and features, in the app's own page style and theme tokens (Lite, CO, Cerberus), not her theme.css: the totals tiles (BUD, PRE and SHA side by side, as her live version now has them), the filters and branch chips, the family cards with the root WIP, the WIP splits branch, the lab bar (passed, pending, failed, not submitted), shipped for sale. Values as text only (the app's `esc`), never raw HTML. No d3: format numbers with the app's helpers; if her trees need layout math, write it plainly. Fits at 1920, 820 and the phone with no sideways scroll. Her import pane is not built: the files go in through Admin, METRC (WL1).

## Tests
- Her rules on a small invented fixture (no names from her data): the family is a source harvest with a non transferred WIP; the root is the earliest packaged WIP not made from a WIP; splits branch; the lab bar groups; Sale against Lab sample; the precedence rule; pounds at 448.
- The page renders the "data as of" line per grid.
- No dash characters in any output.

## Gates and the acceptance
Typecheck; vitest under both time zones; `node --check scripts/smoke.mjs`; the from zero smoke run in the background by the runner law, with a lineage check on invented mounts (SMOKE PASS, SMOKE_EXIT 0, no 500); dash, CR and name scans. No renders (the Scribe renders the page in the three themes at the three widths at the gate). THE ACCEPTANCE (the Scribe runs it at the gate): with the owner's three exports from the main folder's `DROPS\metrc_20261017\` mounted on the live-data bench through WL1, the page's totals, families, active and inactive WIPs, traced counts, failed packages and shipped for sale pounds (grams over 448) equal what her rules compute on the same three files. For scale, her Oct 17 data file gave 4,186 packages, 78 WIP families and 912 packages shipped for sale (1,413 lb at 453.592, 1,430.6 at 448); the Oct 20 files are larger.

## Hand back
Report `SESSION_REPORTS/2026-10-20_wl2_wip_lineage_report.md`, short: the tree received and left, files touched, gate results, anything declined and why. Close with the tree hash and that nothing is committed, pushed or deployed.
