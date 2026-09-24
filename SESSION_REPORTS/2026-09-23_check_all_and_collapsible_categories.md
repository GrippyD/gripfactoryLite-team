# 2026-09-23 The check-all and the collapsible categories

Brief J, canon 0.30.212 and 0.30.215. Data Queues and Pending Data Uploads gain a checkbox on every actionable row, a check-all per section, one void or one mark for the checked rows, and a fold on every section heading. No migration. The head stays 0074. Not deployed.

## What landed

Every Data Queues row that can be voided has a leading checkbox named `id`. A Logistics Move that still has receipts keeps the box disabled, with the same words as before. Every Pending Data Uploads file row has a checkbox named `item`, valued `kind:id` the way that row's own Mark uploaded posts today (`manifest:<movement>`, `location_move:<group>`, `wet_weights:<batch>`, and the rest by their kind). Reconciliation notes have no box. They keep Acknowledge.

Each section head has a check-all that checks and unchecks the enabled boxes in that section only, and reads indeterminate when some are checked. A grouped queue has one check-all over all of its groups. Without the script the boxes still post.

Each queue section posts `Void checked (n)` with one typed reason to `POST /admin/queues/<key>/void-checked`. Logistics Moves post `POST /admin/queues/movement/void-checked`. Every id is checked through the same guards as today's void before anything is written. A refused row refuses the whole batch and the message names that row. The button is disabled at 0. The flash is `Voided n.` The per-row Edit, Void, and queue controls stay as they were.

Each uploads section posts `Mark checked uploaded (n)` to `POST /admin/uploads/uploaded-checked`. Each `kind:id` is resolved the same way as that row's own Mark uploaded, then written in one batch. The row is uploaded, never cleared. The flash is `Marked n uploaded.` Clear all pending stays a clear, in its own reveal.

Every section heading is the summary of a `details.queue-fold` that renders open. The count stays in the summary. The inline script reads `localStorage["gf_fold:" + pathname]`, closes those keys, and writes the list on every toggle. `data-pipeline-key` and `data-count` stay on the heading.

## Assumptions for your word

- A refused row stops the whole batch before any of the checked rows are written. The message is `{row} was not voided: {why}` or `{row} was not marked uploaded: {why}`, with the id and the words today's single void or mark already uses.
- The fold is remembered on the device, in that browser's localStorage, per page path. It is not stored on the person.
- Reconciliation notes are left out of the check-all. They have no file.
- Queue row controls (Demote and the rest) are not batched. Only Void is.
- The button count is filled by the script. With no script the button reads `(0)` and is disabled until a box is checked, and the boxes still post with the form.
- Location changes and location moves are two folds (`location_change` and `location_moves`). They used to share one heading. Both summaries still say Location changes.
- Package files of mixed kinds share one section and one check-all. Each box still carries its own kind.
- A pending file marked this way gets `cleared` 0, the same default as a single Mark uploaded.

## Gates

- `npx tsc --noEmit`: exit 0.
- `npx vitest run`: 50 files, 859 tests passed. The same under `TZ=America/New_York`.
- `node --check scripts/smoke.mjs`: exit 0.
- From-zero smoke (`SMOKE_PORT=9152`, `WRANGLER_SEND_METRICS=false`): `About to apply 74 migration(s)`, `SMOKE PASS`, ` 500 ` lines: 0, exit 0. Two pending files were marked uploaded and left the list, logged as marked uploaded. Two Data Queues rows were voided with one reason and the flash `Voided 2.` Both pages render the folds open.
- Dash audit: 0 on the files below (U+2014 and U+2013).
- `METRC_INTEGRATOR_KEY = "` and `METRC_USER_KEY = "` appear in no file under `src`, `test`, `scripts`, or `wrangler.toml`.

## Deploy

Not deployed from this session. The Scribe gates the report and hands the worker-only line. No migration rides.

## Sealed final check

```
npx tsc --noEmit                      exit 0
npx vitest run                        50 files, 859 tests passed
TZ=America/New_York npx vitest run    50 files, 859 tests passed
node --check scripts/smoke.mjs        exit 0
SMOKE_PORT=9152 WRANGLER_SEND_METRICS=false node scripts/smoke.mjs
                                      About to apply 74 migration(s); SMOKE PASS; " 500 " lines: 0; exit 0

app/src/html.ts                       186584  2a282774fe4afdfd  tail: }
app/src/index.ts                      134101  021c762b8ca28783  tail: export default worker;
app/src/actions.ts                    292926  367093d5d9478ac7  tail: export { MANIFEST_COLUMNS, buckedPackageCode };
app/src/theme.ts                      153779  f97595267082665d  tail: }
app/src/i18n.ts                       162032  dc7d48e40aa5dce3  tail: }
app/src/ledgerloc.ts                   27340  90fe3fb025307cc1  tail: }
app/test/surface.test.ts               79969  e82379072e4290e2  tail: });
app/test/batch.test.ts                  3224  faa802cb4f2057a1  tail: });
app/test/ledgerloc.test.ts             22282  91959681c4f68a38  tail: });
app/scripts/smoke.mjs                 574107  c0c92b9564d69d9c  tail: });
```
