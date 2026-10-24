# WL1: the METRC mirror takes the Inactive and Transferred package exports

Filed by the Scribe on 2026-10-20 (canon 0.30.527). The owner, sending the analyst's WIP Package Lineage dashboard (OCG Companies, Grip): "[the analyst] came up with this, can we add it to reports?" Her package is on the disk at `branches/GFLiteMetrcAPI/RESEARCH/wip-lineage-dashboard/` (README, index.html, src/metrc-normalize.js and its test, the d3 vendor file, and data/packages.csv). RESEARCH/ is never committed. data/packages.csv carries buyer names, licenses and manifest numbers: read it on the disk, never copy it into app/, a test fixture, a report or a log.

THE SOURCE (the Scribe named it; his pick, 2026-10-20): GripFactory already has a METRC mirror (Admin, METRC; `metrc_mounts`, `metrc_packages`), but it takes only the Active packages export. For AU-P-000694 it holds 2,084 packages (1,516 live, 568 gone), last mounted 2026-10-12, with no Inactive or Transferred data, so no destinations, buyers or manifests. Her Oct 17 data holds 4,186. His pick: extend the mirror so it takes the Inactive and Transferred exports, using her tested converter rules, and build her lineage view as a Reports page over the mirror (WL2, next). One place to drop METRC files, one copy of the data.

For the build session (Cursor, one plain session, no sub-agents): open in `C:\Users\DennisWallace\Documents\Claude\Projects\gripfactory Practical\branches\GFLiteMetrcAPI` (its `app\` is the app). If your working folder is not under `branches\GFLiteMetrcAPI`, stop and say so. Under THE DISPATCH RULE (canon 0.30.155).

Part of THE QUEUE (`BRIEFS/2026-10-23_queue_wl1_wl2_s3g.md`): read it first; its runner law and stop rules apply here. FIRST IN THE QUEUE. Pin: `9d751a5730ab2493` (the live tree, L1 to L4 pushed 2026-10-23). Verify with canon's hash command in `app/` and stop if it differs. No git; nothing committed, pushed or deployed. One migration, `0117`. LF only. Read big files by search and line range (`src/metrc.ts` is large; start at `parseMetrcFilename`, `detectMetrcKind`, the mount scope and the gone law).

## 1. Recognize the three package exports
- Today a packages file is one kind. Add the grid as the law: Active (today's behaviour, unchanged), Inactive, Transferred. Read it from the file name (`Packages-Active`, `Packages-Inactive`, `Packages-Transferred`, numbered copies included) and confirm it from the headers the way her `MetrcNormalize.detectKind` does (Transferred carries Package, Destination Facility, Manifest Number; Inactive carries Finished). A file whose name and headers disagree is refused in words.
- Read Metrc's xlsx the way her `sheetRows` does: Metrc's files declare a wrong sheet size, so read every row and column actually present. Check the app's own reader does this already for Active; if it does, reuse it.

## 2. THE GONE LAW STAYS ACTIVE ONLY
Only an Active mount may mark packages gone. An Inactive or a Transferred mount never marks anything gone. This is the one rule that, broken, would empty the mirror: state it in a code comment and hold it with a test.

## 3. Inactive
For each row: update the package's own row in `metrc_packages` (insert it if the mirror never saw it), with a new column `inactive_state` (Finished when Finished is true, else Discontinued) and its other columns as today. Mark it gone if it is not already, dated by the mount. The row change log follows the mount's existing law.

## 4. Transferred
A new table `metrc_transfers`, one row per package tag and manifest: tag, license_value, manifest, destination_facility, destination_license, shipped_quantity, uom (her assumption: ea for PRE, else g; say so in the column comment), lab_state, received_date, source_harvests, source_packages, item, category, item_strain, transfer_type (Lab sample when the destination name holds laboratory or laboratories, else Sale), mount_id, first_seen_at, changed_at. Upsert by tag and manifest; a row absent from a later file stays (transfers are history). The package's own `metrc_packages` row is marked gone if it is not already.
- Her rule for a tag in more than one export: Transferred over Inactive over Active. The lineage page (WL2) applies it when reading; the tables keep what each file said.

## 5. Admin, METRC
The same drop zone takes all three files; each mount line names its grid and counts (added, updated, unchanged, gone, and for Transferred the transfers new and updated). Nothing about the Active mount changes on the page.

## Tests
- File names and headers for all three; a mismatch refused.
- An Inactive mount marks nothing else gone; a Transferred mount marks nothing else gone; an Active mount still marks the missing ones gone.
- Inactive sets Finished or Discontinued; Transferred writes transfers keyed by tag and manifest, a second mount writes nothing, a changed received date updates one row.
- Lab sample against Sale by the destination name.
- No buyer names or licenses from her data in any fixture: build fixtures with invented names.
- No dash characters in any output.

## Smoke and gates
Smoke: `About to apply 116 migration(s)` (L4's read 115). Mount a three row Active, Inactive and Transferred file each (invented data), check the counts and that nothing went gone from the Inactive or Transferred mounts; keep every other check. Gates: typecheck 0; vitest under TZ=UTC and TZ=America/New_York with counts; `node --check scripts/smoke.mjs`; the from zero smoke run in the background by the runner law (SMOKE PASS, SMOKE_EXIT 0, no 500); dash, CR and name scans of every touched file. No renders (the Scribe renders Admin, METRC at the gate).

THE ACCEPTANCE (the Scribe runs it at the gate): the owner's three AU-P-000694 exports sit in the main folder's `DROPS\metrc_20261017\` (taken 2026-10-20, so newer than her Oct 17 data file). Mounting them must give, under her precedence rule, the same packages row for row as her converter (`RESEARCH/wip-lineage-dashboard/src/metrc-normalize.js`) gives on the same three files.

## Hand back
Report `SESSION_REPORTS/2026-10-20_wl1_metrc_inactive_transferred.md`, short: the tree received and left, files touched, gate results, anything declined and why. Close with the tree hash and that nothing is committed, pushed or deployed.
