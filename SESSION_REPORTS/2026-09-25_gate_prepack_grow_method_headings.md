# 2026-09-25 The gate on the prepack grow method headings (canon 0.30.233)

Scribe session. The gate on his Code session's `SESSION_REPORTS/2026-09-25_prepack_grow_method_headings.md` (brief N, canon 0.30.229; no migration, the head stays 0075). The report says "Not deployed. Nothing committed."; nothing was deployed before this gate. No Scribe change to `app/` but the two repair files of 0.30.230, already in both trees. His hand-back, verbatim in part: "Prepack scheduling's Available pane now groups packages under collapsible Indoor, Outdoor, and Greenhouse headings (then any other live method, then Unknown), using the same Data Queues fold. Scheduled and Complete stay flat lists. The head is still migration 0075."

## What was gated

1. The tree was hashed on the device after the build went quiet (the report at 16:48 UTC, the hash at 17:16) and compared with the Scribe's sandbox, which held the tree of canon 0.30.232 with the two repair files (b4a8e0fb8ecee6a7) byte for byte. Seven files differed, exactly the seven of the report's seal, one of them new (`test/prepackheadings.test.ts`); the only other files newer than the brief on the disk are the two repair files the Scribe committed there. After the copy the two trees hash identical (f267390bce5eedd1, 211 files). The migration head is 0075.
2. The seven were staged, verified against the seal (size and sha256, all seven), copied into the sandbox and verified again there.
3. Read against the brief's six laws. THE HEADINGS: `availableByMethod` in `src/scheduling.ts` groups the rows by the batch's grow method display name, orders them by `growHeadingRank` (the fixed list Indoor, Outdoor, Greenhouse, then any other name by its lower-cased name, then the nameless group last), draws one `queueFold` per group (`data-fold="grow:<name>"`, `grow:unknown` for the nameless, `data-schedule-heading` on the details, open by default, the closed state remembered under `gf_fold:/production/scheduling/prepack` by the shared `QUEUE_FOLD_SCRIPT`), the heading an `h3` with the name and a `tile-count` of the visible rows, the rows inside unchanged (`packageIdentityMarkup`, the `>>` button, `data-schedule-*`); a method with no rows draws nothing. THE FILTER STAYS: a heading whose rows are all hidden carries `hidden` and its count reads the visible rows; the pane's count is the visible total; `FILTER_SCRIPT` keeps the heading counts and their hiding without a page load. THE READ: `PREPACK_PARENT_SQL` left-joins `grow_methods` on the batch's code, live rows only, carrying `display_name` as `grow_method`; `PrepackFeed` and `ScheduleItemRow` carry it; `prepackAvailableRow` passes it. THE WORDS: `Unknown` with Spanish (`Desconocido`); the method names are the lookup's stored display names. NOTHING ELSE MOVES: the trim and pasteurization surfaces, the Scheduled and Complete panes, the adopt section, the effective date form, THE UNFINISH, the Data Queues folds; `src/theme.ts` gained the heading's chrome alone. THE TESTS: `test/prepackheadings.test.ts` (five cases: the order with Unknown last; no heading for an empty method; a heading hidden by the filter while the other stays; the `>>` button and the attributes inside a heading; Unknown in Spanish); `scripts/smoke.mjs` pins the Greenhouse heading with its count in the Data Queues fold markup on the prepack page and the last-six filter finding a package under it.

## Gates on the tree as received (the Scribe's sandbox)

- `npx tsc --noEmit`: exit 0.
- `npx vitest run`: 54 files, 880 tests passed; the same under `TZ=America/New_York`.
- `node --check scripts/smoke.mjs`: ok.
- From-zero smoke (`SMOKE_PORT=9165`): `About to apply 75 migration(s)`, `SMOKE PASS`, no 500; exit 0 once the dev server was ended by pid.
- Dash audit: 0 on the seven files and the build report.
- Secret grep (`METRC_INTEGRATOR_KEY = "`, `METRC_USER_KEY = "`, `MS_CLIENT_SECRET = "`, `cfas[t]_`): no matches under `src`, `test`, `scripts`, `migrations` or `wrangler.toml`.

## His word: the report's six assumptions and one the Scribe adds

The six stand as the report states them (the fixed order by the stored display names, a renamed method sorting after the three; Unknown for a batch with no method, a blank name or a deleted method row; headings open by default, a closed one remembered per page; Scheduled and Complete flat; no heading for an empty method, a filtered-out heading kept hidden in the page; the rows' order inside a heading). One more, read in the code:

- The fixed order keys on the display names Indoor, Outdoor and Greenhouse, not on the codes ID, OD and GH; if Admin renames Outdoor to Outdoors, that heading drops to the alphabetical tail. Keying on the code would hold the slot through a rename; a later slice if he wants it.

## Deploy (his hands; worker-only, no migration rides)

```powershell
cd "C:\Users\DennisWallace\Documents\Claude\Projects\gripfactory Practical\app"
npm run deploy:grip
```

THE PROBE: the prepack scheduling page's Available pane under its grow method headings, one folded by a tap and found folded on reload.

## Sealed final check

```
npx tsc --noEmit                      exit 0
npx vitest run                        54 files, 880 tests passed
TZ=America/New_York npx vitest run    54 files, 880 tests passed
node --check scripts/smoke.mjs        ok
rm -rf .smoke-persist && CI=1 SMOKE_PORT=9165 WRANGLER_SEND_METRICS=false npm run smoke
                                      About to apply 75 migration(s); SMOKE PASS; " 500 " lines: 0; exit 0
the build session's seal (7 files) verified byte for byte on the device and in the sandbox:
src/scheduling.ts                              24045  a3d584333720d7fb
src/db.ts                                     166705  c255b09e6d8da65c
src/html.ts                                   189994  bc28a1373adc973c
src/i18n.ts                                   166475  e7fb005bdad81105
src/theme.ts                                  153812  fd3e6907b8b07b3b
test/prepackheadings.test.ts                    6191  85bc4cb0518f5dcf
scripts/smoke.mjs                             579963  a2020e4291f4629f
tree hash after the copy, device and sandbox: f267390bce5eedd1 (211 files)
the build report: SESSION_REPORTS/2026-09-25_prepack_grow_method_headings.md  4365  9834877e358806db
dash audit: 0 on every file above
secret grep: no matches
```
