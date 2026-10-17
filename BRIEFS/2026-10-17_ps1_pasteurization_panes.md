# PS1: Pasteurization runs read by lot, finished runs leave the list, [Add Shake]

Filed by the Scribe on 2026-10-17 (canon 0.30.505) from the owner's word:

> Menu. 1. Change the Pasteurization Runs Left Pane. a. [Lot Code] - [Last 5 of the package ID] - [Container Count]. i. Order by Lot (lowest to highest). b. [grams] - [lbs (448)] - Market Strain. 2. When the operator Finishes a lot, it should go to the right pane (like it does on the other menus) but add a new button: [Add Shake]. It allows a package to be softly "reopened" so that weight can be made from what's left but the operators are still able to finish. Adding a shake package can happen right on the right pane. No indication needs to be left, it can be redone any time. Pasteurization Scheduling. 1. Match all the looks the same as they are in item 1 above.

His picks at the three forks (2026-10-17):
- The lot code is the last 5 of the HBN (the lot code law, `shortLotId`). The package ID is the HBN's METRC harvest package tag.
- A finished run leaves the working list. When picked, it stays in the right (working) pane with [Add Shake] under its packages. Finished runs are reached from a Finished list under the left pane.
- Each Add Shake makes its own small New Packages file (just that shake line), pending at the export home. The run's own file is never touched.

For the build session (Cursor, one plain session, no sub-agents): open in `C:\Users\DennisWallace\Documents\Claude\Projects\gripfactory Practical\branches\GFLiteMetrcAPI` (its `app\` is the app). If your working folder is not under `branches\GFLiteMetrcAPI`, stop and say so. Under THE DISPATCH RULE (canon 0.30.155).

Pinned to the live tree `2894924330f68f15` (DD S2c live, worker b508182b). Verify with canon's hash command in `app/` (`(find src test scripts migrations -type f; echo wrangler.toml; echo tsconfig.json; echo package.json) | LC_ALL=C sort | xargs sha256sum | sha256sum | cut -c1-16`, `wrangler.toml` read as LF) and stop if it differs. No git; nothing committed, pushed or deployed. No migration expected (metrc_uploads.kind is free text); if you find you need one, stop and say why. LF only. Read big files by search and line range.

Where things are: `src/cryo.ts` (the Cryo Weight Entry page, `paneItem`, `runLabel`, `cryoStationPage`), `src/db.ts` (`CRYO_RUN_SELECT`, `listCryoRuns`, `listHbnHarvestPackages`, `listPendingNewPackagesUploads`), `src/actions.ts` (the cryo add, finish and `buildNewPackagesXlsx`), `src/index.ts` (`/station/cryo_weight` routes, the `/admin/uploads` new_packages routes), `src/scheduling.ts` (`availableGroup`, `workingItem`, `completeItem`, `groupHeading` for the Pasteurization scheduling page), `src/html.ts` (the export home New Packages table).

## 1. One run label, used everywhere a pasteurization run is listed
A pure helper in src/cryo.ts, `pasteurizationRunLabel(run, tags)`, renders two lines:
- Line 1: `[lot code] - [tag last 5] - [N containers]`. Example: `26072 - 4F2A1 - 23 containers`.
  - Lot code is `shortLotId(hbn)`.
  - Tag last 5 is the last 5 characters of each METRC harvest package tag the HBN carries (`listHbnHarvestPackages`, metrc_tag only, never package_code). Two or more show joined with a comma; none shows "no tag" (EN and ES).
  - "1 container" when N is 1.
- Line 2: `[grams] g - [lbs] lb - [market strain]`. Example: `180,085 g - 401.98 lb - Gelato 41`.
  - lbs is grams over 448 (the app pound, `formatGrams` style grouping, 2 decimals).
  - The market strain is the run's strain_name (COALESCE of market_strain and the strain), or "no strain".
- The separator is a spaced hyphen. No en or em dash anywhere.
- The full HBN stays available as the link's `title` (hover), not on screen.
- Read the tags for every listed run in the same round trip the list already makes (a join or one grouped query, never one query per run). At most 100 binds per statement.

## 2. The Cryo Weight Entry left pane (`/station/cryo_weight`)
- The pane heading stays "Pasteurization runs" with its count of working runs.
- Working runs (status scheduled) only, each with the two line label, ordered by lot serial ascending (harvest_batches.lot_serial, then scheduled_at). Two runs on one HBN both show; the second sorts after the first by scheduled_at.
- Below them, a closed "Finished" list (details, with its count) of finished runs with the same label, newest finished first. A link picks the run as today.
- The working pane heading for the picked run uses the same two line label (line 1 as the heading, line 2 muted under it) with the full HBN muted below.

## 3. Finishing, and [Add Shake] on a finished run
- Finish works as today. After Finish, the run leaves the working list, moves to the Finished list, and stays picked in the right pane, showing its packages as today.
- On a finished, picked run, under its packages: an [Add Shake] button. It opens a small form right there: package tag (the same tag field, shape check and duplicate tag guard as the cryo plus line), weight (g), operator, and Add.
- Add Shake writes one output package exactly as the plus line does today: category SHA, the run's cryo_run_id, into the Testing queue, with the same change log. It works on a finished run without reopening it: the run's status, completed_at and the run's own New Packages file are untouched, and nothing on the page marks the run as reopened. It can be done again at any time; each add is its own package.
- The weight is drawn from what is left of the run's pool, using the run's current In minus Out. Over the SHA remaining flags with the same overissue warning the plus line gives (flag, never block), as today.
- A shake package added this way can be removed with the same unfinish output control the run's packages have (owner PIN, as today). Removing it also removes its pending shake file if not yet marked uploaded; if already uploaded, refuse in words.
- Refusals (EN and ES): a bad tag, a used tag, a weight not above zero, a missing operator, and Add Shake on a run that is not finished ("Add Shake is for a finished run; use the plus line while it is working.").

## 4. The shake New Packages file
- One file per Add Shake: the same T3 template as the run's file (`newPackagesSheet`), one line, the shake tag, its grams, its date, Location Name Cryo Room, Same Item yes.
- Ingredients are the HBN's harvest package tags, allocated by the same `allocateIngredients` rule over the run's sources.
- It pends at the export home in the New Packages table with the HBN and "Shake" in the Type column, downloads, and has Mark uploaded, like the run files.
  - Track it with a metrc_uploads row of its own kind (add `new_packages_shake` to METRC_UPLOAD_KINDS) keyed by the shake output's id (ref_id), so a shake file pending never makes the run's own file pend again, and the run's file being uploaded never hides a shake file.
- Filename: the run file's name with `_shake_<tag last 5>` before the extension.

## 5. Pasteurization Scheduling (`/production/scheduling/cryo`)
- Available, Scheduled and Complete each show the same two line label as item 1 (lot code, tag last 5, containers; grams, lbs, market strain), in place of today's HBN plus "N containers / g in" line.
- Each column ordered by lot serial ascending.
- The Scheduled column keeps its out line ("N out, g") under the label, and its terp recipe, dose and shuttle controls exactly as today.
- Complete keeps its date and Admin PIN unschedule controls exactly as today.
- Same full HBN on hover. The Effective Date control and the shuttle buttons are untouched.

## Tests
- `pasteurizationRunLabel`: one tag, two tags, no tag; 1 container and many; grams to lbs at 448 (180,085 g reads 401.98 lb); no strain; no dash characters in the output.
- Left pane order by lot serial; a finished run not in the working list but in Finished; the count.
- Add Shake on a finished run:
  - writes one SHA output with the run's cryo_run_id and leaves the run complete with its completed_at unchanged;
  - leaves the run's own New Packages file not pending again (its upload state unchanged) and pends one shake file;
  - a second Add Shake pends a second file;
  - every refusal above;
  - the overissue flag over SHA remaining;
  - removing a shake output whose file is pending removes the file; one already uploaded refuses.
- The shake file's T3 rows: one line, the right tag, grams and ingredients.
- Scheduling: each column renders the label and sorts by lot serial; the Scheduled controls and Complete controls still present.

## Smoke and gates
Add to the smoke: the cryo station lists working runs with the label and lot order; finish a run, it shows under Finished and stays picked; Add Shake on it answers 303 and the Testing queue gains one SHA package; the export home lists one shake file; Mark uploaded clears it; the scheduling page shows the label in all three columns. One more check than main's.

Gates: typecheck 0; vitest under TZ=UTC and TZ=America/New_York with counts; `node --check scripts/smoke.mjs`; the from zero smoke (`About to apply 104 migration(s)`, SMOKE PASS, no 500); renders of the cryo station (working, finished picked with Add Shake open) and the scheduling page at 1920 and 820 in Lite, CO and Cerberus, no sideways scroll; dash, CR and name scans of every touched file.

## Hand back
Report `SESSION_REPORTS/2026-10-17_ps1_pasteurization_panes.md`, short: the tree received and left, files touched, gate results, anything declined and why. Close with the tree hash and that nothing is committed, pushed or deployed. The Scribe gates; the owner merges.
