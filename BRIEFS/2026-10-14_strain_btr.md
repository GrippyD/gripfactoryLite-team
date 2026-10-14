# SP2: BTR in the Strain performance pane

Filed by the Scribe on 2026-10-14 (canon 0.30.475) from the owner's word: "add BTR to the strain performance pane".

For the build session (Claude Code or Cursor): open in `C:\Users\DennisWallace\Documents\Claude\Projects\gripfactory Practical\branches\GFLiteMetrcAPI` (its `app\` is the app). If your working folder is not under `branches\GFLiteMetrcAPI`, stop and say so. Under THE DISPATCH RULE (canon 0.30.155). Built on the worktree as it stands with FG1's build in it (tree `6e8ea44ae71f43ec`, FG1 not yet merged, held on one question that does not touch these files). Verify with canon's hash command in `app/` (`(find src test scripts migrations -type f; echo wrangler.toml; echo tsconfig.json; echo package.json) | LC_ALL=C sort | xargs sha256sum | sha256sum | cut -c1-16`, `wrangler.toml` read as LF) and stop if it differs. Do not touch `src/fginventory.ts` or its test. No git; nothing committed, pushed or deployed. No migration. LF only.

## The law
1. THE COLUMN. A "BTR" column in the Harvested group of the Strain performance table (src/strainperformance.ts), right after Dry lb per plant, one decimal with a percent sign, EN and ES words in i18n (the label stays BTR in both).
2. THE SAME BTR AS THE CONSOLE. It is the console's Weighted BTR to date, cut by strain and farm: for the row's lots, the grams of live trim packages whose type is in app_config `btr_type_codes` (read through `parseBtrTypeCodes` exactly as console.ts does; BUD, SMALLS, SHAKE when unset) over the grams of all live trim packages, weighted by grams. Trim packages are `wip_packages` with `source IS NULL` and `deleted_at IS NULL`, joined to the lot by `wet_weight_entry_id`, the lot's batch Grip's own (`ownLotSql`, so tests and toll lots stay out) and in the console's harvest year. Reuse the console's `TRIM_SEASON_SQL` (export it from console.ts) so the two can never drift.
3. THE GRAIN. Each strain and farm row pools the trim packages of its own lots (the lots the row already counts, by the same naming rule). A row with no trim package reads blank, not 0.0%. The Total row pools every row and must equal the console's Weighted BTR to date figure for the same year (a test holds them equal).
4. NOTHING ELSE MOVES. The other columns, the Remaining logic, the estimate line, the section's place and its closed default stay as they are. One more grouped read at most (or reuse the rows the console already loads for Weighted BTR to date); no per strain query.

## Performance
/harvest stays under 1 s on the live-data bench and the column adds no more than 0.05 s.

## Tests and the smoke
- Unit: BTR per row from seeded trim packages (bud types over all), a row with no packages blank, a non default `btr_type_codes`, a toll lot and a test lot left out, the Total equal to weightedBtrToDate for the same rows, the column's place and format.
- Smoke: /harvest answers 200 and the Strain performance table carries the BTR header; with seeded trim packages a row shows the expected percent.
- Gates: typecheck 0; vitest under TZ=UTC and TZ=America/New_York; node --check scripts/smoke.mjs; from-zero smoke, `About to apply 102 migration(s)`, SMOKE PASS, no 500. Dash and CR audits by character. Render at 1920 and 820 in Lite, CO and Cerberus with the section open. Report `SESSION_REPORTS/2026-10-14_strain_btr.md` with the tree hash and every file touched (keep it short; the Scribe's gate report carries the detail).
