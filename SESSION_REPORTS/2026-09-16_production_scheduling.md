# 2026-09-16 Production Scheduling (canon 0.30.97)

Build hand. Owner ruling 2026-09-16, verbatim in the Cursor Slice. Production Operations gains [Production Scheduling] first; two shuttle stations, Trimming and Pasteurization, whose schedule is what exposes material to Trim Packages Entry and Cryo Weight Entry. Migrations 0053, 0054 and 0055 were already on the bench; this slice is 0056. The from-zero smoke pin is 56. Never deployed from this session.

## The law, as built

1. Production Operations (`OPS_GROUPS` key `production_ops`) carries `{ key: "production_scheduling", title: "Production Scheduling", href: "/production/scheduling" }` first. The landing is two tiles: [Trimming] `/production/scheduling/trim` and [Pasteurization] `/production/scheduling/cryo`. The station is titled Pasteurization; its material is the cryo queue.
2. Table `production_schedules` (migration 0056): one row per scheduled item per stage. Columns as specified. Exactly one of `wet_weight_entry_id` / `wip_package_id` is set, enforced in the action. At most one non-deleted row per (stage, item); a second `>>` refuses in words.
3. Trimming is fed by unloaded lots with no non-deleted trim schedule row. Pasteurization is fed by `cryo_queue` packages with no non-deleted cryo schedule row. Data Queues and every `/export` CSV stay unfiltered.
4. `.station-triple` in all three theme sheets (via `walkSliceChrome`): three columns, stack on `body.device-phone` and at the 480px floor. Left pane: collapsed HBN (`details/summary`), count badge, `>>` titled "Schedule trim" / "Schedule pasteurization"; item rows are read-only with no links. Working pane: Status word plus `<` unschedule and `>` complete. Right pane: local instant and PIN-gated `<` demote.
5. The left pane carries `effectiveDateField(null, ...)` once; `>>` posts `hbn_id`, `effective_date` and `effective_pin`. The resolved date is the row's `effective_date`. Complete and demote stamp `completed_at`.
6. `paneFilter` widens to `"no_finished_lot" | "trim_scheduled" | "cryo_scheduled"`. Trim Packages Entry lists only scheduled unloaded lots. Cryo Weight Entry's pane and the no-pick bulk form list only scheduled cryo-queue packages. `queue_pick` and the Data Queues stay unfiltered.
7. Automatic complete on `lot_trimmed_unloaded` and `cryo_weighed` (the standing batches gain the helper statements). Manual `>` completes without the work. Demote needs `demote_pin` against `app_config admin_pin` (seeded 21319); wrong or blank is 403 in words. Unschedule soft-deletes with no typed reason and no PIN. A completed item cannot be unscheduled. A demoted item whose work is already done shows muted "trimmed" / "cryo weighed" and does not reappear at the entry station if it has left that queue.

## What changed

- `migrations/0056_production_schedules.sql`: the table and the three indexes. Nothing else.
- `src/config.ts`: `SYSTEM_REASON.schedule`, `schedule_complete`, `schedule_demote`, `schedule_unscheduled`; `PRODUCTION_SCHEDULING_PATH`; `SCHEDULE_STAGES`; `SCHEDULE_STAGE_TITLES`; `SCHEDULE_STATUS`.
- `src/pipeline.ts`: the ops member first; the widened `paneFilter`; `trim_packages` and `cryo_weight` take their filters.
- `src/db.ts`: `TRIM_SCHEDULED_SQL`, `CRYO_SCHEDULED_SQL`; `listPaneRows` implements both; `listLotQueueRows` / `listPackageQueueRows` take a filter fragment so the Data Queues stay the unfiltered path; schedule loaders and `getScheduleRow` / `findOpenScheduleForLot` / `findOpenScheduleForPackage`.
- `src/scheduling.ts`: landing, three-pane page, stage parse, refusal wording, Status-word hook. Pure renderer.
- `src/actions.ts`: `scheduleHbn`, `unscheduleItem`, `completeScheduleItem`, `demoteScheduleItem`, plus `completeTrimScheduleForLot` / `completeCryoScheduleForPackage` wired into Remove from queue, trim reconcile `queue_adjust`, Mark trimmed on the Unloaded Queue, and `setCryoWeight`.
- `src/index.ts`: GET landing, GET `/:stage` (unknown stage 404), POST schedule / unschedule / complete / demote. Floor stations; only demote is PIN-gated. Flashes through `flashFromQuery`.
- `src/html.ts`: the no-pick bulk `cryo_weights` widget reads the pane-filtered rows.
- `src/i18n.ts`: the module strings, EN and ES.
- `src/theme.ts`: `.station-triple`, `.shuttle-btn`, the summary line, the item row, all three sheets.
- Tests: `test/scheduling.test.ts` (renderer, Status words, PIN box, EMPTY, ES, paneFilter compile); `test/surface.test.ts` (ops member and order, the two `paneFilter` values); `test/view.test.ts` (the triple layout in all three sheets).
- `scripts/smoke.mjs`: from-zero pin 56; Production Operations and the landing; the Trimming walk (empty pane, Data Queues still list the lot, `>>`, In queue, second `>>` refuses, unschedule, backdated `>>` plus the change-log marker, complete, demote PIN / Models PIN / Admin PIN, ES); the standing trim after schedule; auto-complete after Remove from queue; the Pasteurization walk (empty cryo pane and bulk form, `>>`, standing cryo, auto-complete, demote PIN); the extra HBN scheduled before the Harvest Console trim posts.

## Scribe assumptions, built as written

1. Status words: "In queue" on Trimming, "Pasteurizing" on Pasteurization. `scheduleStatusWord` ignores the item so a later CASE can show "Pasteurizing" on a Trimming lot whose packages have moved on (owner fork 1).
2. Unschedule (working pane `<`) has no typed reason and no PIN. `delete_reason` is the system reason "unscheduled from the working pane".
3. The pages open like the other floor stations. Only the right-pane demote is PIN-gated.
4. Completion is automatic when the entry station finishes the work, and also by the arrow.

## Decisions this slice did not name

- The HBN simple label is `farm_code / strain / entry_date` (the standing Farm / Strain / Date line, farm code not the display name).
- A Trimming available row reads short lot id / strain / dry total g / born package code (first non-deleted `local_inventory_items` row for the lot, else the short id). A Pasteurization row reads package code / type / weight g.
- The schedule flash is `Scheduled N.` (`ok=scheduled&n=`).
- `>>` is a submit button with `form=` pointing at the left-pane Effective Date form and `name="hbn_id"`.
- Voids drop because the loaders join only non-deleted lots, packages and HBNs; schedule rows of a voided record stay in the table and are never shown.

## Proposed canon amendments (do not edit canon from here)

- Record the four owner forks as built (Status words; unschedule with no reason and no PIN; pages open; auto-complete plus the arrow).
- Record the simple-label and identity lines above if he wants them pinned.
- Record that Data Queues and `/export` stay the record table, and that only the two entry stations' left panes (and the no-pick cryo bulk form) narrow.

## Visual pass

Trimming station on the smoke persist plus a local fixture (one available ARL HBN, two PNN lots scheduled, one complete): Lite (collapsed and opened), Continuum, Cerberus. Phone stack at 480px (`body.device-phone` plus the 480px floor): Available, then Scheduled, then Complete, one column.

## Errors found and fixed in the build

- `scripts/smoke.mjs` reused `const completed` (already used by the pick-orders walk); renamed to `schedCompleted`.
- The first available-pane "HBN dropped" assert used a 4000-character window that also saw the working pane's `data-schedule-hbn`; replaced with a pane-bounded extract.

## Gates

- `npx tsc --noEmit`: 0 errors.
- `npx vitest run`: 31 files, 660 tests passed.
- `node --check scripts/smoke.mjs`: 0 errors.
- From-zero smoke: `About to apply 56 migration(s)`, `SMOKE PASS` (SMOKE_PORT=8796).
- Dash audit: 0 on every file below.

## Deploy (his hands, WITH the migration)

This slice ships worker plus migration 0056. From `app/`:

```
npx wrangler d1 execute gripfactory-lite-grip-20260914 --env grip --remote --command "SELECT 1"
npx wrangler d1 migrations apply gripfactory-lite-grip-20260914 --env grip --remote
npm run deploy:grip
```

Say deploy when he wants it on the worker.

## Sealed final check

```
npx tsc --noEmit
npx vitest run
node --check scripts/smoke.mjs
rm -rf .smoke-persist && SMOKE_PORT=8796 WRANGLER_SEND_METRICS=false npm run smoke

migrations/0056_production_schedules.sql    1431  a120a69f9a20c43f
src/config.ts                              43032  38b48ae2fa52167a
src/pipeline.ts                            46973  42f97a7c67daaa91
src/i18n.ts                               114076  d287dd78a748a9ef
src/theme.ts                              138729  fc002b9ef28fd440
src/db.ts                                 139440  b716803fd57f8ec5
src/scheduling.ts                           8337  66a08f4172bb9f93
src/actions.ts                            244248  62820934018580a4
src/index.ts                              116373  71a71dea14629e99
src/html.ts                               169785  617ca0a5b9ea0f82
test/scheduling.test.ts                     8653  4213fc81390de886
test/surface.test.ts                       83288  9409cd400dbf310f
test/view.test.ts                          24125  5ed656f3fc46b0cd
scripts/smoke.mjs                         406003  0e0b2d2c8ee6538a
tsc: 0 errors; vitest: 31 files, 660 tests passed
smoke: About to apply 56 migration(s); SMOKE PASS
dash audit: 0 on every file above
```
