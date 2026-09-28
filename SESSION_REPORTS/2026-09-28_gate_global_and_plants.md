# 2026-09-28 The gate on Global and Plants (canon 0.30.289): HELD for one word

Scribe session. The gate on V3, GLOBAL AND PLANTS (BRIEF V3, canon 0.30.288), on his Code session's `SESSION_REPORTS/2026-09-28_global_and_plants.md` in the worktree `branches/GFLiteOpsDashboard`. The report says "Not deployed. Nothing committed. No git was run."; the disk agrees. No Scribe change to the worktree. His hand-back, verbatim in part: "The console fold is stored per browser under `gf_hc_fold`. A first visit leaves Drying closed and Plants, Trimming, Testing, and Prepack open, with the Pasteurization stub closed."

VERDICT: HELD for one word. Every mechanical check is green, the migration rehearses clean, and the six laws of the brief are built as written. The hold is the Spanish Plants heading: the dictionary's `Harvest year` reads `Ano de cosecha` (a pre-existing entry, canon 0.30.88's era) and V3 lifts that string out of a footnote into the section's summary, where the crew reads it on every visit; in Spanish the word wants its tilde, `Año de cosecha` (the dictionary already carries `Tamaño`, so the letter is in house). The fix is that one word in three places (`src/i18n.ts` line 1254, `test/console.test.ts` line 341, `scripts/smoke.mjs` line 5181). The Scribe re-gates the fix; then the merge is his hands with the pre snapshot first.

## What was gated

1. THE TREE. Against the gated V2 tree (`d8bfa92b4bd4ccbd`): one migration new (`0078_farm_plant_counts.sql`, 639, 8df6ebacb13e51b7), two tests new (`plantcount.test.ts` 4833, 29ff4fa4c6a51a40; `laborhours.test.ts` 5625, 44f81ac3ee9c0ef5), twelve files changed (console, lookups, pages, actions, db, index, reports, i18n, theme, smoke, console.test, farmday.test), all fifteen in the seal and nothing outside it; V1's three files at their gated hashes; `wrangler.toml`, `package.json`, `src/consoleicons.ts` and `public/` untouched. The app tree hashes `60db53e344f2ae48`. The seal matches byte for byte (size, sha256, tail) on his disk and in the Scribe's sandbox.
2. THE FOLD (law 1). `foldScript` after `hoursScript`: one key `gf_hc_fold`, an object of section key to `"1"` or `"0"`, a stored key winning over the server attribute on load, every section rewritten on any toggle, every read and write in try/catch; `drying` rendered without `open`, the rest as before. Read line by line; no other change to the sections.
3. TODAY SO FAR (law 2). The link `data-hc-day-today` to `?day=<today>` whenever the day under view is not today; the state text for today; `consoleDayOf(today, today)` picked; a migrated-database test proves a tote weighed at 15:00Z on the picked day counts and one at 09:00Z (before the six o'clock start) does not.
4. FARM PLANT COUNT (law 3). The migration as the brief spelled it, with the partial unique index; `saveFarmPlantCounts` requires the actor and a reason, refuses a bad year or count with a 400, inserts, updates only on a changed count, soft-deletes a blank with the reason, and logs every change under `farm_plant_counts`; the page lists every live farm with its count and a `?year=` override; the console reads the year's counts into `plantCounts`, a farm with a count uses it as the denominator with Remaining still METRC's live count, a stale count reads over 100% (250.0% in the test), a farm without a count reads as before, the Total column sums the three farms.
5. THE NOTES OUT (law 4), WEIGHT HARVESTED (law 5), THE HOURS (law 6): as the brief says; the report card, the view, the 30-day window and the From and To filter present; `listLaborHours` unions the four tables; the two new tests read as described.

## Observations for his word (no hold)

- THE TOTAL COLUMN sums the three farms now; before, its Remaining and Total also counted live plants under a license with no farm. On the floor this changes nothing today: in the newest snapshot (9/27) every live plant sits under a mapped license (PNN 45,027; PNS 32,253; ARL 0; none unassigned). A test comment still says "plus the plants under a license with no farm (the 9)"; stale wording, no effect.
- THE TRIM INPUT LBS log reason moved from "input lbs typed" to "labor hours typed" so the four savers share one reason; `SYSTEM_REASON.trim_input_lbs` stays defined and unused. One line back if he prefers the old words in the log.
- THE REPORT'S OPERATION names are English in both languages ("Cutting and bucking, PNN"); they are row data from SQL, not dictionary strings.

## Gates on the tree as received (the Scribe's sandbox, the worktree's `app/`)

- `npm run typecheck` with the generated types file deleted first: exit 0.
- `npx vitest run`: 65 files, 953 tests passed; the same under `TZ=America/New_York`.
- `node --check scripts/smoke.mjs`: ok.
- From-zero smoke (`SMOKE_PORT=9198`): `About to apply 78 migration(s)`, `SMOKE PASS`, no ` 500 ` line; the dev server ended by the timeout after the pass.
- THE MIGRATION REHEARSED: all 78 migrations applied in order in plain SQLite; `farm_plant_counts` with its eleven columns and the index `farm_plant_counts_farm_year`; a second live row for the same farm and year refused, a new live row accepted after a soft delete. The newest snapshot (`20260927-140925_pre_environment_flags`, 66 tables) holds no `farm_plant_counts`, so the create cannot collide; 0078 touches no existing table.
- Dash audit: 0 (em and en), and no CR byte, on the fifteen files, the build report, `wrangler.toml`, `tsconfig.json` and `package.json`.
- Secret grep (six patterns): no value anywhere; the build report names the patterns as patterns.
- No personnel data: no name, phone or email in the diff; the report's `updated_by` is not a column.

## The fix (his Code session in the worktree, or the Scribe direct at his word)

`src/i18n.ts` line 1254: `"Harvest year": { en: "Harvest year", es: "Año de cosecha" }`; `test/console.test.ts` line 341 and `scripts/smoke.mjs` line 5181: the same word in the expected strings. Nothing else. Then `npm run typecheck`, vitest both zones, the smoke at pin 78, and a fix report `SESSION_REPORTS/2026-09-28_global_and_plants_fix.md` with the three files sealed.

## After the fix passes (his hands)

1. From the main folder's `app/`: `node scripts/db-snapshot.mjs pre_global_and_plants`.
2. In the worktree: `git add -A`; `git commit -m "V3: global and plants"`. In the main folder: `git merge --no-ff GFLiteOpsDashboard -m "Merge V3: global and plants"`; `git push`. The workflow applies 0078 and deploys; his paste the run's result and the Version ID.

## Sealed final check

```
rm worker-configuration.d.ts; npm run typecheck      exit 0
npx vitest run                        65 files, 953 tests passed
TZ=America/New_York npx vitest run    65 files, 953 tests passed
node --check scripts/smoke.mjs        ok
rm -rf .smoke-persist && CI=1 SMOKE_PORT=9198 WRANGLER_SEND_METRICS=false npm run smoke
                                      About to apply 78 migration(s); SMOKE PASS; " 500 " lines: 0
migration 0078 rehearsed              78 applied in order in SQLite; the partial unique index proved; no collision with the snapshot's 66 tables
the build report's seal (15 files) verified byte for byte, device and sandbox:
app/migrations/0078_farm_plant_counts.sql         639  8df6ebacb13e51b7
app/src/console.ts                             101838  3e21a9f11956ec36
app/src/lookups.ts                               9022  669683dcde836d90
app/src/pages.ts                                28466  20a3ab4a1c757bbf
app/src/actions.ts                             352929  8503715593069f94
app/src/db.ts                                  187417  1ad909b0a6ad1842
app/src/index.ts                               144691  375af4b41c946ae2
app/src/reports.ts                              25783  ec469e8bc79bde79
app/src/i18n.ts                                181322  79d0b7685fdf4f6c
app/src/theme.ts                               158697  4996e8d16a88c32d
app/scripts/smoke.mjs                          617402  bd50b65bf2f78f6b
app/test/console.test.ts                        63636  94df3f900eaa8c91
app/test/farmday.test.ts                        17378  8613c9a1837e98df
app/test/plantcount.test.ts                      4833  29ff4fa4c6a51a40
app/test/laborhours.test.ts                      5625  44f81ac3ee9c0ef5
changed against the V2 gated tree, not in the seal: none
the app tree: 60db53e344f2ae48 (V2's d8bfa92b4bd4ccbd plus the fifteen)
the build report: SESSION_REPORTS/2026-09-28_global_and_plants.md  7853  f225207f468db1ee
dash audit: 0; CR audit: 0; secret grep: no values; personnel data: none
```
