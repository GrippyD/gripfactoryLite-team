# 2026-10-02 The console day is today

BRIEF V17, THE CONSOLE DAY IS TODAY (canon 0.30.341), built in the worktree `branches/GFLiteOpsDashboard` under THE DISPATCH RULE (canon 0.30.155). Before the first edit the app tree, by the V16 recipe with the untracked repair file left out, hashed `c58c00ba506b1906` (258 files). The same recipe with `scripts/repairs/2026-10-02_silos_26080_26084.sql` included hashed `6feeb6cd34916741` (259 files). That repair file was not edited (26,511 bytes). Nine files touched, listed in the seal. No migration. The smoke pin stays 87. Not deployed. Nothing committed. Nothing pushed. No git was run.

## What changed

- The console opens on the farm's today. `consoleDayOf` returns today with `dayPicked: false` for a blank, invalid, future, or equal-to-today pick, and `{ day, dayPicked: true }` for any real day before today. The field `yesterday` is `day` on `HarvestConsoleInput`, the loader, the renderers, and the tests. Every per-day query and every hours form reads `day`. The two Right now panes still read today up to now. `consoleDayQuery` still adds `&day=` only when `dayPicked` is set.
- The day control on the default reads "today so far; the panes below read today up to now". A pick reads "picked; the panes below read this day", shows `data-hc-day-reset` as "Back to today", and the trailing line is "Today is {today}; the hours you type land on the day shown." The "Today so far" link is gone. The date input's max stays today.
- The labels are Harvest Hours, Weight/DLH, Lbs Produced, and DLH. "no packages yesterday" is "no packages on the day" on the bud, the BTR read, and the Weighted BTR cell. The Right now bar still says "no packages today". The trim unassigned note uses the existing "on the day by operators on neither shift". The date chip still names the day. New dictionary keys carry EN and ES, including "Harvest Year Total" / "Total del año de cosecha" and "Back to today" / "Volver a hoy". The old Yesterday keys, "Today so far", and the two uncalled Yesterday footnotes are out of `src/i18n.ts`.
- Under Weight Harvested, every box (each farm and Total) has Harvest Year Total: the harvest year's wet grams from `wet_weights`, weighing lots included, chipped with `input.year`. `yearWet` is optional on the type.
- Trim input lbs is gone from the picture, the card, the figures, the loader, `parseInputLbs`, `saveTrimInputLbs`, the route, the path constant, and the flash. `trim_line_inputs` stays in the schema and in data. Lbs Produced, the DLH box, and Lbs/DLH are unchanged.
- The sheet read line is gone from the console (`sheetSyncLine`, `sheetSync`, `latestSheetSync`, the import). `sheetSyncLineText`, the cron, and the Admin sync page stand.
- Pasteurization outputs, finished runs, and recent rows carry `created_at` or `completed_at`. An unlisted operator is counted on the shift whose window holds that Eastern instant (Day first when both hold). A listed operator wins over the clock. `clockGrams` and `clockOperators` are the grams placed by the clock and the unlisted operators they came from. What no clock could place stays unassigned. The clock note is `data-hc-past-clock`. A recent row with no instant is what lights `unassignedRunning`. `livePasteurization` is unchanged.

## Assumptions for his word

- "Remove all Yesterdays" is the day itself and the words: the console opens on today, the look-back stays, and no rendered string says Yesterday. The old default's finished day at dawn is one tap on the date control.
- The year total counts every tote weighed in the harvest year, including lots still weighing, per farm and in Total, in lb with grams under it, chipped with the year.
- The clock fallback uses the shifts' own windows (06:00-18:00 and 18:00-06:00 by default). A named operator always wins over the clock.
- Input lbs leaves the console (the box, the picture's text, the route, the flash). The table and its rows stay in data. The labor hours report still lists those rows.
- The sheet read line leaves the console. The sync itself is untouched and keeps recording.
- The rename of `yesterday` to `day` is mechanical. `yesterdayWet` was renamed `dayWet` as well, so `src/console.ts` has no identifier carrying the word. `grep -n -i yesterday src/console.ts src/i18n.ts` returns only the historical owner quotes in the console header.
- A blank or unparseable instant stays unassigned. An instant that falls in neither window does not light `unassignedRunning`.
- `app_config` refuses a blank value ("Value is required."), so the smoke takes the cryo operator off the day list by writing a stand-in name, then writes the operator back. The Day or Second card then carries the line by the entry hour, and the clock note names the operator. Restoring the list makes the operator rule win again.
- The two long trim footnotes that mentioned input lbs inside the sentence now say DLH is typed here. They stay in the dictionary and are not rendered.
- The tree check used the V16 recipe. With the untracked repair file included it was not `c58c00ba506b1906`. Excluding that one file, it was. The file was left as it stood.

## Gates

Run in the worktree's `app/`.

- `npm run typecheck`: exit 0.
- `npx vitest run`: 74 files, 1041 tests passed under `TZ=UTC`, and 74 files, 1041 tests passed under `TZ=America/New_York`.
- `node --check scripts/smoke.mjs`: exit 0.
- From-zero smoke (`SMOKE_PORT=9256`, `WRANGLER_SEND_METRICS=false`, `CI=1`, `TZ=UTC`): About to apply 87 migration(s), SMOKE PASS, no ` 500 ` line, exit 0.
- Dash audit: 0 on the nine files (U+2014 and U+2013). No CR byte. No BOM.
- `grep -n -i yesterday src/console.ts src/i18n.ts`: five comment lines in `src/console.ts`, the historical owner quotes. No rendered string.
- No key, secret, or password value was added. The words that already stood in `src/config.ts`, `src/index.ts`, and the smoke's own no-key step are unchanged. No floor name in any fixture, test, or this report.

## Deploy

Not deployed from this session. Nothing committed. Nothing pushed. No git was run.

## Sealed final check

```
the tree as received, repair file excluded   c58c00ba506b1906 (258 files; checked before the first edit)
the same recipe with the repair file         6feeb6cd34916741 (259 files; file left untouched, 26511 bytes)
the brief                                 (BRIEFS/2026-10-02_the_console_day_is_today.md)

npm run typecheck                     exit 0
TZ=UTC npx vitest run                 74 files, 1041 tests passed
TZ=America/New_York npx vitest run    74 files, 1041 tests passed
node --check scripts/smoke.mjs        exit 0
SMOKE_PORT=9256 WRANGLER_SEND_METRICS=false CI=1 TZ=UTC node scripts/smoke.mjs
                                      About to apply 87 migration(s); SMOKE PASS; " 500 " lines: 0; exit 0
dash audit: 0; CR audit: 0; BOM: none
grep -n -i yesterday src/console.ts src/i18n.ts
                                      five historical comment lines in src/console.ts; no rendered string
the app tree after the edits, repair file excluded   33835444f99e43d1 (258 files)
the same recipe with the repair file                 d563d9946fadbbea (259 files)
```

```
app/scripts/smoke.mjs                     714140  b536ddad08ecd860
TAIL });
app/src/config.ts                          79417  1673625c230eb691
TAIL }
app/src/console.ts                        150827  545dbf156c089570
TAIL }
app/src/i18n.ts                           195741  94786bbc06f9c8fb
TAIL }
app/src/index.ts                          157968  953e2f8be3924d3d
TAIL export default worker;
app/test/console.test.ts                   69616  93cf19e306e3bce6
TAIL });
app/test/farmday.test.ts                   16201  c743be528aa988d3
TAIL });
app/test/laborhours.test.ts                 5376  c1452057b3c7e74c
TAIL });
app/test/pasteurization.test.ts            40295  3218a3bc4e3dc706
TAIL });
```
