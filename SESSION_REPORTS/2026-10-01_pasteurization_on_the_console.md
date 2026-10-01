# 2026-10-01 Pasteurization on the console

BRIEF V10, PASTEURIZATION ON THE CONSOLE (canon 0.30.334, re-based 0.30.335), built in the worktree `branches/GFLiteOpsDashboard` under THE DISPATCH RULE (canon 0.30.155), in its `app/`, on the worktree exactly as it stood after the three floor fixes were merged and pushed: the app tree `55f02728b52dd7e8` (254 files by the brief's recipe, read on the disk before the first edit), migrations 0001 to 0085, the brief at 23,067 bytes `a6d1916724e8c253`. One migration, `0086`. The smoke pin is 86. Ten files touched (eight changed, two new), listed in the seal; the app tree now hashes `4a1633f310b4d01d` (256 files). Not deployed. Nothing committed. Nothing pushed. No git was run.

## What changed

- `migrations/0086_pasteurization_shifts.sql` (new): `pasteurization_labor_hours` as `trim_labor_hours` is (id, work_date, shift, hours NUMERIC, the audit columns, UNIQUE (work_date, shift)) with its index on work_date; four `INSERT OR IGNORE` rows into app_config: `pasteurization_shift_day_operators` and `pasteurization_shift_second_operators` blank (the names are typed in Admin, Lookups, app_config; nothing copied from trim's), `pasteurization_shift_day_hours` `06:00-18:00` and `pasteurization_shift_second_hours` `18:00-06:00`. Postgres-portable in the shape of 0052; nothing before 0086 edited.
- `src/config.ts`: the four keys in `CONFIG_KEYS` beside trim's; `HARVEST_PASTEURIZATION_HOURS_PATH` (`/harvest/pasteurization-hours`); `PASTEURIZATION_SHIFTS` ("Day shift", "Second Shift", each bound to its own operator key); `PASTEURIZATION_SHIFT_HOURS_DEFAULT` (the code's fallback when a row is missing or off, the same hours the migration seeds); `PASTEURIZATION_RUNNING_MINUTES` (30).
- `src/rad.ts`: `radLotNumber(tag, row, hbnById)`, pure: the app batch's hbn where the catalog's lineage names one (`hbnId`), else the HBN the METRC harvest name yields through `hbnFromMetrcName`, else the tag's last five; `runViews` reads `listRadBatchGrows` beside the catalog and puts `lot` on every `RadRunPackageView` (an optional field, so a hand-built view still typechecks); `loadRadRunning(db)` reads the run records first and answers null at once when no run is running (an empty Rad costs the console no catalog read), else returns the running run from the same views the Rad pages read, with its lot numbers distinct in position order. The Rad pages' markup and behavior are unchanged; their loader runs one more small query (the batches) to name the lots.
- `src/console.ts`: the types (`PasteurizationInput`, `PasteurizationOutputRow`, `CryoFinishedRun`, `CryoOpenRun`, `CryoRecentRow`, `PasteurizationShiftFigures`, `PasteurizationFigures`, `PasteurizationLive`); `cryoRunLeft` (inputs less outputs above zero: a finished run's waste by his pick, an open run's weight not yet entered out); `pasteurizationFigures` and `livePasteurization`, pure; `pasteurizationDuty` by the shifts' own windows; `cryoLinePicture` (his picture: the metering box with no label and no number, CRYO, AMAPS, UV, three burgundy flows moving toward the next machine while the line runs); the Rad half (`data-hc-rad`, `data-hc-rad-state` running or empty, the icon with `hc-rad-throb` while running, the lots, the package count, the grey, the `silo-clock` span from `started_at` that the page's clock script ticks); the Cryo half with the list BUD, WPR, SHA, WASTE, TOTAL "since 06:00" and the open-runs line; the Right now head as trim's (Right now, today, the shift on duty or "no shift on duty", RUNNING or DOWN with the timer from the last output ever entered); the two shift panes `data-hc-past-shift="day|second"` for the day picked (the five icons Bulk Bud, Prepack, Shake, Waste, Total with lbs and grams under, as the Testing gate panes draw them; the Total Hours box `data-hc-past-hours` posting shift, work_date, day_picked and hours; Lbs/DLH); the unassigned notes; `pasteurizationSection` in place of the stub (the stub helper, with no caller left, removed); the flash key `pasteurization_hours`; the loader's queries in `loadHarvestConsole`'s parallel read (the day's outputs and today's by cryo date or entry instant, the runs Finish run closed in each window with their sums and last operator, the open runs' remainders, the outputs of the last 30 minutes, the last output ever entered, the four config values, the hours rows, the running Rad view); `savePasteurizationHours` as `saveTrimHours` is; the input's four new fields. The fold script forgets, once, a fold remembered against the stub (the stub rendered closed, and the script wrote every section's state on any toggle, so every console browser that ever folded a section held pasteurization closed), so the built section opens on its first visit and is remembered from the next toggle on.
- `src/index.ts`: the route `POST /harvest/pasteurization-hours` beside the trim hours route; the imports.
- `src/theme.ts`, in the three sheets (lite, co, cerberus): the two halves side by side and stacked on the phone; the Rad's green throb (the strokes' opacity pulsing at the silo throb's 1.6 s, 3.2 s under reduced motion, never stilled); the cryo picture's nodes, text and flows (the plume's deep red `#7c1b1b` with the darker band `#4a0f0f` on Lite and Continuum; Cerberus's deep red `#ba2929` with `#6e1414`, canon 0.30.248); the list; the five-figure row, whose panes shrink with the card and whose icons shrink with the panes so the five hold one row on the console at its width.
- `src/i18n.ts`: ASCII, EN and ES: "Rad", "Cryo", "Rad empty" / "Rad vacio", "since {time}" / "desde {time}", the open-runs line singular and plural, "Waste" / "Desperdicio", "WASTE" / "DESPERDICIO", "on the day by operators on neither shift" / "en el dia de operadores sin turno", the unassigned RUNNING note. "Right now", "Grey (Gy)", "RUNNING", "DOWN", "Save", "Total Hours", "Lbs/DLH", "no shift on duty", "no operators named", "type hours", "packages", "package", "Bulk Bud", "Prepack", "Shake", "Total", "TOTAL", "BUD" already stood and are read as they stand.
- `scripts/smoke.mjs`: the pin reads `About to apply 86 migration(s)`; the walk below.
- `test/pasteurization.test.ts` (new, sixteen cases) and `test/console.test.ts` (grown where the sections and their order are asserted; the stub expectations replaced; the date-span count grown by the two panes).

Nothing else moves: the Trimming section and its totals, the cryo station, the Rad pages, the Testing gate, the Prepack and Fulfillment sections, the icons' drawings, the sheet sync, migrations 0001 to 0085. Nothing to METRC.

## The smoke's walk (pin 86)

After the cryo walk enters its lines and finishes its run: GET `/harvest` carries `data-hc-section="pasteurization"` open with the Right now pane above the two shift cards, the Rad half empty (`data-hc-rad-state="empty"`, "Rad empty", no throb) and the Right now head RUNNING with the cryo line running (`data-hc-cryoline-running="1"`, the flows animated); the list reads BUD, WPR and SHA 0 g (the smoke's lines carry 2026-09-08 as their cryo date, so they are not today's), WASTE 12 g and 0.03 lb (the run finished that second, 100 g in less 88 g out), TOTAL 12 g; the CRYO node 0.03 lb with "12 g, 0 packages", AMAPS and UV 0.00 lb; the metering box with no label and no number; the three flows; "since 06:00"; no open-runs line (no scheduled run holds weight there). The day operators are set to the smoke's own cryo operator through `/record/app_config/pasteurization_shift_day_operators/edit`; GET `/harvest?day=2026-09-08`: the Day shift card names its operator, carries the five icons, Bulk Bud 88 g and 0.20 lb, Prepack, Shake and Waste 0 g, Total 88 g, the Second Shift card zeros with "no operators named", no unassigned note; the hours box carries the picked day; `/harvest/pasteurization-hours` refuses an unknown shift ("Pick a shift.") and word hours, answers 303 to `/harvest?ok=pasteurization_hours&day=2026-09-08` on 7.5, the page then reading 7.5 in the box, Lbs/DLH 0.03 lb/h with 12 g/h, the flash "Hours saved.", the change log carrying `pasteurization_labor_hours`; a blank post clears the row (the box empty, "type hours"). In the prepack feed walk: the run just scheduled holds its pool with nothing entered yet, so the Right now pane's open-runs line names one run with the pool's grams and pounds; the walk adds one SHA line of 5 g beside its four WPR lines (all dated today, no Effective Date typed) and finishes the run; GET `/harvest` then reads WPR 53 g and 0.12 lb, SHA 5 g and 0.01 lb, the AMAPS node 0.12 lb over 53 g, the UV node 0.01 lb over 5 g, the CRYO node counting 5 packages, the line RUNNING, TOTAL the four summed from the page's own numbers, WASTE carrying at least the feed run's inputs less its 58 g out, and the open-runs line gone. In the Rad walk, after Start and the Start Time edits: GET `/harvest` carries `data-hc-rad-state="running"`, the throb class, the run's lot number (the HBN its harvest name yields), "1 package", "Grey (Gy) 1500" and the `data-clock` span with `data-started` equal to the saved start; after unstart: `data-hc-rad-state="empty"` and "Rad empty". The console walk's stub count reads 0 and the picked day carries eight work_date boxes (the two pasteurization boxes among them).

## Assumptions for his word

- The Rad half shows the running run alone; scheduled runs stay on the Rad Schedule page (a muted "n runs scheduled" line is one more if he wants it).
- "Lot numbers" are HBN codes: the app batch's hbn through the lineage, else the harvest name's HBN, else the tag's last five; distinct, in position order, joined by commas.
- "Since 6AM" is the farm day's start hour in data (6 today); the Right now window runs from the day's start to now, and the shift panes read the farm day picked (yesterday by default).
- Waste follows his pick: inputs less outputs, counted on the day and shift the run is finished, by the operator of the run's last output; a run whose outputs exceed its inputs reads 0; the open runs' remainders are shown as a muted line and never counted as waste; Finish run on the cryo station is what moves them. A finished run with no live output left (every output voided after the finish) has no operator; its waste counts in the unassigned note's grams with no name, so nothing is lost; if he wants that case worded apart, that is one line.
- The shift panes carry the five icon figures and no bud diagram or machine picture; Total includes Waste; Lbs/DLH divides Total by the typed Total Hours. An output whose category is off the three (not BUD, WPR or SHA) counts among the packages and in none of the four.
- The pasteurization shifts' operator lists start blank and are named in Admin; their windows are seeded 06:00-18:00 and 18:00-06:00 like trim's defaults; the shift on the clock is read from them.
- The section opens by default on a first visit and the fold is remembered per browser (Global 1); a fold remembered against the stub is forgotten once, as the stub rendered closed and the fold script snapshots every section on any toggle.
- The cryo picture's burgundy is the plume's deep red with a darker band; on Cerberus the deep red is the canon's `#ba2929` (canon 0.30.248) with `#6e1414`; the metering box carries no label and no number; the flows run from CRYO to the box, the box to AMAPS, and CRYO to UV.
- No totals line under the shift panes; one line if he wants it.
- The RUNNING clause is the last 30 minutes of outputs only; the trim's queue clause has no pasteurization twin.
- The ES icon labels read the dictionary's existing keys "Prepack" (Preempacado) and "Shake" (Picadillo): the keys already stood (a duplicate key would not compile), and changing them would move the Prepack section and other surfaces that read them; "Preempaque" and "Shake" are two pane-only keys if he wants the brief's words.
- `runViews` in `src/rad.ts`, which the Rad Schedule and Rad Operation pages read, now also reads the batches to name the lots (one more query on those pages; their markup unchanged), so the console and the pages tell one truth, as the brief asks; the console itself reads the run records first and skips the catalog while the Rad is empty.
- The smoke's first cryo lines carry 2026-09-08 as their cryo date, so the brief's "the cryo list's BUD, WPR and SHA read the grams the smoke entered on the farm day" is proved on the prepack feed's lines, which take today's date (four WPR and one SHA line, the SHA line added by this slice), and the first check proves the other half of the law (a line dated another day is not today's, while the run finished today is); the open-runs line is proved on the feed run between its scheduling and its first line. A WASTE or WPR read at the second the farm day rolls (06:00 Eastern) would read 0; the existing smoke carries the same exposure.
- The reduced-motion rule slows the cryo flows and the Rad throb to twice their cadence and never stills them (canon 0.30.79).
- The build's own: `src/console.ts` now imports `loadRadRunning` from `src/rad.ts`, which imports `gateItemType` from `src/console.ts`; neither module uses the other at load, so the cycle is harmless, and the typecheck, the tests and the smoke pass through it.

## Gates

Run in the worktree's `app/`, on the final tree.

- `npm run typecheck`: exit 0 (it regenerates the git-ignored `worker-configuration.d.ts` first; the file was deleted before each run).
- `npx vitest run`: 73 files, 1024 tests passed under `TZ=UTC`, and 73 files, 1024 tests passed under `TZ=America/New_York` (1008 before, plus the sixteen new cases).
- `node --check scripts/smoke.mjs`: exit 0.
- From-zero smoke (`SMOKE_PORT=9255`, `WRANGLER_SEND_METRICS=false`, `TZ=UTC`, `CI=1`): `About to apply 86 migration(s)`, `SMOKE PASS`, no ` 500 ` line, exit 0 (16,965 lines of log; the one ` 503 ` line is the smoke's own asserted no-key step on `/api/send`).
- Dash audit: 0 on the ten files (U+2014 and U+2013). No CR byte in them. No BOM. The one non-ASCII glyph the slice adds to markup is the middle dot between the grams and the package count under the CRYO node, the trim line picture's own manner; the dictionary's new words are ASCII.
- `METRC_INTEGRATOR_KEY = "`, `METRC_USER_KEY = "`, `MS_CLIENT_SECRET = "`, `SENSORPUSH_PASSWORD = "`, `CLOUDFLARE_API_TOKEN=`, and `CLOUDFLARE_API_TOKEN: "` do not appear in the ten files. No personnel data: the new fixtures name hands as "Hand One", "Hand Two", "Hand Three"; the smoke reads its own pre-existing cryo operator name and no other; the migration seeds the operator lists blank; no name from the floor enters a fixture, a test or this report.
- Changed against the tree as received, not in the ten: none (every file under `src`, `test`, `scripts` and `migrations` with `wrangler.toml`, `tsconfig.json` and `package.json` hashed against the tree as received, unpacked from a stage tarball taken before the first edit; the eight changed and the two new are the ten).
- The section rendered from a fixture (a running Rad run with two lots, a cryo day, an open run) in the three skins and read in a browser: the Rad half green with its lots, count, grey and ticking clock; the burgundy flows moving; the list beside the picture; the five figures in one row; the empty state DOWN with its timer. The render probe was removed and the tree hashed again.
- Reviewed by five independent readers (the brief clause by clause, correctness, canon and guardrails, the tests' and the smoke's honesty, the markup and the sheets), every finding then put to two refuters; the two that stood are recorded above (the ES labels, the unit test gaps, the latter closed); the fold remembered against the stub, the five-figure row, the open-runs line never proved, the zero reads on the first check and the loose matches were fixed before the refuters read the tree.

## Deploy

Not deployed from this session. Nothing committed. Nothing pushed. No git was run. The Scribe gates it (the tree, the gates, 0086 rehearsed on the snapshot, the pane for his eye), folds, and hands the merge block.

## Sealed final check

```
the tree as received                 55f02728b52dd7e8 (254 files; checked on the disk before the first edit)
the brief                                 23067  a6d1916724e8c253

rm worker-configuration.d.ts; npm run typecheck      exit 0
TZ=UTC npx vitest run                 73 files, 1024 tests passed
TZ=America/New_York npx vitest run    73 files, 1024 tests passed
node --check scripts/smoke.mjs        exit 0
rm -rf .smoke-persist && CI=1 SMOKE_PORT=9255 WRANGLER_SEND_METRICS=false TZ=UTC npm run smoke
                                      About to apply 86 migration(s); SMOKE PASS; " 500 " lines: 0; exit 0
dash audit: 0; CR audit: 0; BOM: none; secret grep: no values; personnel data: none added
changed against the tree as received, not in the ten: none
the app tree after the edits             4a1633f310b4d01d (256 files)
```

```
app/migrations/0086_pasteurization_shifts.sql      2089  f0a60ebec3fba4e4
TAIL   ('pasteurization_shift_second_hours', '18:00-06:00', '2026-10-01T00:00:00.000Z', NULL, '2026-10-01T00:00:00.000Z', NULL, NULL, NULL);
app/src/config.ts                                 78475  032e4dbf71e7f011
TAIL }
app/src/console.ts                               153417  380728452effcc92
TAIL }
app/src/rad.ts                                    30061  e83cbf1c3d8740af
TAIL }
app/src/index.ts                                 157209  bcaed181fcd11653
TAIL export default worker;
app/src/theme.ts                                 186520  2c724b2dac512493
TAIL }
app/src/i18n.ts                                  197759  2fed1c3f581023af
TAIL }
app/scripts/smoke.mjs                            697398  a799eca7d1e8839f
TAIL });
app/test/console.test.ts                          71545  9facde80690b2b89
TAIL });
app/test/pasteurization.test.ts                   35390  4a6f2d27ae3bb971
TAIL });
```
