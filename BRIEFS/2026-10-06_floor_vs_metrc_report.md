# BRIEF FM1: THE FLOOR VS METRC REPORT, FIRST SLICE (canon 0.30.415, rides PC1 0.30.416)

For the build session (Claude Code or Cursor) opened in the worktree `C:\Users\DennisWallace\Documents\Claude\Projects\gripfactory Practical\branches\GFLiteOpsDashboard` (its `app\` is the app). NOT the main folder `gripfactory Practical\app`: if your working folder is not under `branches\GFLiteOpsDashboard`, stop and say so. Under THE DISPATCH RULE (canon 0.30.155). Built SECOND in the session, after BRIEF PC1 (`BRIEFS/2026-10-06_assign_plant_counts.md`), on the tree PC1 leaves; PC1 starts from the LIVE tree after R3 (`a3fc79a982c12ae8`, 299 files, migrations 0001-0094), and both are gated and pushed together. The tree hash is canon's command, run in `app/` with `wrangler.toml` read as LF: `(find src test scripts migrations -type f; echo wrangler.toml; echo tsconfig.json; echo package.json) | LC_ALL=C sort | xargs sha256sum | sha256sum | cut -c1-16`; at the start of PC1, if the disk differs, stop and say so. One build agent in this worktree at a time. No migration.

## The source (verbatim)

The owner, 2026-10-04 (canon 0.30.390): "I want it to translate real life into METRC and give us real life back--METRC is a state-mandated obstacle." On the translation map (canon 0.30.391, `canon/TRANSLATION_MAP.md`), verbatim: "Sounds good". The map's gap 5: no screen compares what the floor says with what the mirror says. The owner, 2026-10-06: "start the next brief".

## What the data holds (read by the Scribe on `db_backups/20261005-203534_post_plants`)

- The floor's packages are `local_inventory_items` (item_kind WIP, FG, SPR; qty, uom, location, license_value, metrc_tag, wet_weight_entry_id). A `metrc_tag` of 24 characters is the package's own tag (671 live rows). A `metrc_tag` of 5 digits is a trim output naming the harvest package it was cut from (2,714 rows): it is NOT that package and stays out of this slice.
- The mirror is `metrc_packages` (tag, quantity, uom, location, license_value, item, source_harvests, gone_at, changed_at); the newest `changed_at` is how fresh it is.
- Pending Data Uploads are `metrc_uploads` (kind, harvest_batch_id, cleared, uploaded_at).
- A lot's dry package on the floor is its live SPR item; in the mirror it is the live package whose item starts `SPR - ` and whose `source_harvests` is the lot's HBN.

## The law

1. THE PAGE. Reports gains "Floor vs METRC" (ES "Piso vs METRC"), read only. At the top: "METRC as of {time}" (the mirror's newest `changed_at`, Eastern) and the counts of each section's findings.
2. SECTION A, PACKAGES BY TAG. Every live floor item with a 24 character `metrc_tag`, matched to the mirror by the exact tag. Each row: tag (last 6 and full on hover), item kind, floor qty and uom, floor location and license; METRC quantity and uom, location and license; and one finding:
   - "Same" (same uom, quantities within 1);
   - "Weight differs by {n}" (same uom);
   - "Units differ" (shown, not compared: FG is grams on the floor, each in METRC);
   - "Gone in METRC" (the floor holds it live);
   - "Not in METRC" (no mirror row);
   - "License differs" (added to any of the above).
   Locations are shown side by side and never flagged in this slice (the floor names rooms, METRC names shelves).
3. SECTION B, LOT PACKAGES. Every live lot of the harvest year with a live SPR item on the floor or a live SPR package in the mirror. Each row: lot (last 5), HBN, state; floor SPR qty and location; METRC SPR tag, quantity and location; and a finding: "Same", "Weight differs by {n}", "No floor package", "No METRC package". A live mirror SPR package whose HBN names a lot voided on the floor is listed too, with "Lot voided on the floor".
4. WHAT CLEARS IT. Every finding other than Same names the lot's open (not cleared, not deleted) Pending Data Uploads by kind, or "nothing pending". A WIP or FG row finds its lot by `wet_weight_entry_id`, then the batch.
5. FILTERS: finding (all, differences only, by finding), item kind, lot last 5. Default: differences only. A CSV of the rows shown.
6. NOTHING ELSE MOVES. No write anywhere: not the floor, not the mirror, not the uploads. Lite, CO and Cerberus; on a phone the tables scroll inside their box, not the page.

On the snapshot, for the check: Section A, 671 rows: WIP 95 same, 308 weight differs, 1 not in METRC; FG 2 same, 225 units differ, 40 not in METRC; no license differs. Section B, 11 lots with a live SPR on the floor, four of them with one in the mirror: 26027 floor 1,319,148 against METRC 335,435; 26028 983,833 against 1,159,097; 26061 3,422,505 against 661,908; 26063 1,504,582 against 205,929. Plus 26062, voided on the floor 2026-09-27, with a live METRC SPR of 737,135 g (Lot voided on the floor). (26027's floor package is a known error with a repair in his hands; the report is how such errors are found.)

## The tests and the smoke

- Unit: each finding of A and B from rows built in the test; a 5 digit `metrc_tag` stays out of A; units differ is never compared; the mirror's freshness line; what clears it names open kinds and skips cleared ones; differences only hides Same; the CSV holds the rows shown.
- Smoke: seed a floor item with a full tag equal to a smoke mirror package and one with a different quantity: the page lists the second under Weight differs and not the first by default; Same appears with the filter; the CSV answers 200.
- Render check at 1920 in Lite, CO and Cerberus, and phone width in one view.
- Gates with PC1's: typecheck 0; vitest under `TZ=UTC` and `TZ=America/New_York`; `node --check scripts/smoke.mjs`; the from-zero smoke (`About to apply 94 migration(s)`), SMOKE PASS, no ` 500 `. Dash and CR audits by character; no personnel name in a tracked file. No git; nothing committed, pushed or deployed. Report to the worktree's `SESSION_REPORTS/` with canon's tree hash and every file touched.
