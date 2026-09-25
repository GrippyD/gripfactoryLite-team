# 2026-09-25 Prepack grow method headings

Brief N, canon 0.30.229. The prepack Available pane, grouped by grow method. No migration. The head stays 0075. Not deployed. Nothing committed.

## What landed

Available on Prepack scheduling groups its packages under one collapsible heading per grow method. The heading is the Data Queues fold (`queueFold`, `QUEUE_FOLD_SCRIPT`): a `details.queue-fold` that starts open and remembers a closed heading in `localStorage` under `gf_fold:` plus the page path, by `data-fold`. The keys are `grow:Indoor`, `grow:Outdoor`, `grow:Greenhouse`, `grow:` plus any other display name, and `grow:unknown`.

The order is Indoor, Outdoor, Greenhouse, then any other live display name alphabetically, then Unknown. A method with no available packages draws no heading. Unknown is a package whose HBN has no live grow method display name. Each heading is an `h3` with the display name and a `tile-count` of the rows still showing. Inside a heading the rows keep today's order and markup: `packageIdentityMarkup`, the `>>` button, and `data-schedule-*`.

The `q` filter still hides rows by HBN or last six. A heading whose rows are all hidden hides with them, and its count reads the visible rows. The pane header count stays the visible total. `FILTER_SCRIPT` updates those counts and that hiding without a page load. Scheduled and Complete stay flat lists. The adopt section, the effective date form, trim, pasteurization, and the drying surfaces are unchanged.

`PREPACK_PARENT_SQL` left-joins `grow_methods` on the batch code, live rows only, and carries `display_name` as `grow_method`. `PrepackFeed` and `ScheduleItemRow` carry that name, or null. `prepackAvailableRow` passes it through. `Unknown` is translated. The method names are the lookup's stored display names and are not translated.

## Assumptions for your word

- The fixed order matches the stored display names Indoor, Outdoor, and Greenhouse exactly. A method Admin has renamed sorts after those three, by its new display name. The code (ID, OD, GH) does not hold the slot once the name changes.
- Unknown is a batch with no method, a blank name, or a code whose `grow_methods` row is deleted. It is last.
- Headings start open. A tap closes one, and that closed key is remembered for `/production/scheduling/prepack`.
- Scheduled and Complete stay flat. Only Available is grouped.
- A method with no packages in Available draws no heading. A heading whose filter hides every row stays in the page, hidden, so clearing the filter shows it again without a reload.
- Within a heading, the rows stay in today's order (batch created, newest first, then package created).

## Gates

- `npx tsc --noEmit`: exit 0.
- `npx vitest run`: 54 files, 880 tests passed. The same under `TZ=America/New_York`.
- `node --check scripts/smoke.mjs`: exit 0.
- From-zero smoke (`SMOKE_PORT=9160`, `WRANGLER_SEND_METRICS=false`): `About to apply 75 migration(s)`, `SMOKE PASS`, ` 500 ` lines: 0, exit 0. The Available pane headed the fixture's Greenhouse packages with that count, using the Data Queues fold markup, and `?q=` by last six still found the package under that heading.
- Dash audit: 0 on the files below (U+2014 and U+2013).
- `METRC_INTEGRATOR_KEY = "` and `METRC_USER_KEY = "` appear in no file under `src`, `test`, `scripts`, or `wrangler.toml`.

## Deploy

Not deployed from this session. Nothing committed. The head is 0075. The Scribe hands the worker-only deploy line.

## Sealed final check

```
npx tsc --noEmit                      exit 0
npx vitest run                        54 files, 880 tests passed
TZ=America/New_York npx vitest run    54 files, 880 tests passed
node --check scripts/smoke.mjs        exit 0
SMOKE_PORT=9160 WRANGLER_SEND_METRICS=false node scripts/smoke.mjs
                                      About to apply 75 migration(s); SMOKE PASS; " 500 " lines: 0; exit 0

src/scheduling.ts                 24045  a3d584333720d7fb  tail: }
src/db.ts                        166705  c255b09e6d8da65c  tail: }
src/html.ts                      189994  bc28a1373adc973c  tail: }
src/i18n.ts                      166475  e7fb005bdad81105  tail: }
src/theme.ts                     153812  fd3e6907b8b07b3b  tail: }
test/prepackheadings.test.ts       6191  85bc4cb0518f5dcf  tail: });
scripts/smoke.mjs                579963  a2020e4291f4629f  tail: });
```
