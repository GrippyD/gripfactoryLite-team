# PS2: the pasteurization label reads trim's 5 digit package codes; Add Shake moves up

Filed by the Scribe on 2026-10-17 (canon 0.30.508) from the owner's word on PS1 live: "Everything that says "no tag" likely inherited its tag from trim and trim likely only put 5 digits in. Take a look." And on the follow-up: "queue up PS2. Don't worry about METRC just yet. We're running METRC manually comparing against gripfactory."

THE FINDING (Scribe, on the live-data bench):
- The app's harvest package record for an HBN (`listHbnHarvestPackages`, local_inventory_items) has no METRC tag. Its code is the lot serial, so PS1's label reads "no tag" everywhere.
- The trim containers in each run carry a 5 digit code (for example 56802 on 26011). That code is the last 5 of the harvest's METRC WIP package in the mirror: `metrc_packages` where `source_harvests` is the HBN, here `1A40503000311FB000056802`.
- 43 of 45 container codes match.
  - One is a stray backtick ("56801`" on 26010). The Scribe's repair below fixes it.
  - One is a 26055 container keyed 56833, which is 26053's package code. It waits on the floor.

For the build session (Cursor, one plain session, no sub-agents): open in `C:\Users\DennisWallace\Documents\Claude\Projects\gripfactory Practical\branches\GFLiteMetrcAPI` (its `app\` is the app). If your working folder is not under `branches\GFLiteMetrcAPI`, stop and say so. Under THE DISPATCH RULE (canon 0.30.155).

Pinned to `d609c739a3bc303d`: the live tree `cd8c80a934b76e68` (PS1 live, worker 0a460c43) plus the Scribe's repair file `scripts/repairs/2026-10-17_56801_backtick.sql`, which is the owner's to run and not yours. Verify with canon's hash command in `app/` (`(find src test scripts migrations -type f; echo wrangler.toml; echo tsconfig.json; echo package.json) | LC_ALL=C sort | xargs sha256sum | sha256sum | cut -c1-16`, `wrangler.toml` read as LF) and stop if it differs. No git; nothing committed, pushed or deployed. No migration. LF only. Read big files by search and line range.

## Out of scope (the owner's word)
METRC files. The New Packages ingredient still prints the lot serial where METRC wants the full tag. The owner runs METRC by hand against the app for now, so do not change `buildNewPackagesXlsx`, `buildShakeNewPackagesXlsx`, `allocateIngredients` or `metrcFacingTag`. Parked as MI1 in canon.

## 1. The label's middle part is trim's codes
`pasteurizationRunLabel` (src/cryo.ts) keeps its shape; only the middle part's source changes.
- Line 1: `[lot code] - [codes] - [N containers]`.
- The codes are the distinct 5 digit package codes on the run's containers (the trim containers in `cryo_run_inputs`, joined to `wip_packages.package_code`), in ascending order, comma separated. For an Available HBN on the scheduling page, they are the codes on the containers that group lists.
- Stop reading `listHbnHarvestPackages` metrc_tag for the label.
- A run whose containers carry no code shows "no code" (EN and ES, replacing "no tag").
- The check against the mirror:
  - A code that matches the last 5 of a METRC package in `metrc_packages` whose `source_harvests` equals the run's HBN exactly and whose item starts with `WIP` shows plain.
  - A code that does not match shows with a trailing `?`. Its `title` reads "Not a METRC package from this harvest" (EN and ES).
  - With no mirror rows at all for the HBN (the mirror not mounted yet), every code shows plain; the check only marks a code when the mirror knows the harvest.
- Example: `26011 - 56802 - 36 containers`; `26055 - 56833?, 56834 - 38 containers`.
- Read the codes and the mirror match for every listed run in the same round trip the lists already make (grouped queries or joins, never one per run). At most 100 binds per statement. `metrc_packages` holds about 14,500 rows on the bench, so the cryo station and the scheduling page must stay under 1 s. If the join needs an index, say so and stop rather than add a migration.

## 2. Add Shake moves up
On a finished, picked run, the Add Shake button and its form sit directly under the pool table, above the consumed containers list. Nothing else on the page moves.

## Tests
- The label:
  - one code that matches the mirror;
  - two codes (ascending, comma separated);
  - a code with no mirror match (trailing `?` and the title);
  - an HBN the mirror does not know (plain);
  - no code ("no code" EN and ES);
  - no dash characters.
- The cryo station and the scheduling page read codes from the containers. A fixture run with a container code and a METRC WIP package in the mirror shows the code. The old harvest package metrc_tag path is gone from the label.
- Add Shake renders above the consumed containers list on a finished run.

## Smoke and gates
Adjust the PS1 smoke checks for the new middle part and keep every other check. Gates: typecheck 0; vitest under TZ=UTC and TZ=America/New_York with counts; `node --check scripts/smoke.mjs`; the from zero smoke (`About to apply 104 migration(s)`, SMOKE PASS, no 500); renders of the cryo station (working and finished with Add Shake) and the scheduling page at 1920 and 820 in Lite, CO and Cerberus, no sideways scroll; dash, CR and name scans of every touched file. Do not edit the repair file.

## Hand back
Report `SESSION_REPORTS/2026-10-17_ps2_trim_package_codes.md`, short: the tree received and left, files touched, gate results, the page times on a live-sized bench if you have one, anything declined and why. Close with the tree hash and that nothing is committed, pushed or deployed. The Scribe gates; the owner merges.
