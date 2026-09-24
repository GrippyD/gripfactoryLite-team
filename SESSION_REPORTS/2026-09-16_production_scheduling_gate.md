# 2026-09-16 Production Scheduling: the Scribe's gate (canon 0.30.100)

Scribe sitting. The build hand returned PRODUCTION SCHEDULING (canon 0.30.97, the Cursor slice at prompts/2026-09-16_production_scheduling_slice.md) with its own sealed report at SESSION_REPORTS/2026-09-16_production_scheduling.md. Verification never delegates to the builder, so every gate below was re-run by the Scribe from the device tree and in the Scribe's own sandbox before this slice was cleared for the worker. Nothing was deployed from this sitting.

## What was checked on the device (his tree, read only)

- All fourteen files named in the builder's sealed final check hash exactly as sealed (sha256 on the device, compared to the report).
- canon/CANON.md b93a597b705e32bf, canon/_NOW.md 2697846d0d2766d3, canon/MEMORY.md 01ee4c29ce6df6a3: untouched. prompts/2026-09-16_production_scheduling_slice.md 332de2ee5e5bccf5: untouched.
- `git remote` count 0 (G-1 held).
- migrations/ head is 0056_production_schedules.sql; 0001 through 0055 unchanged.
- The whole device tree diffed against the Scribe's mirror at 0.30.99: only the fourteen sealed files differ. Unlisted changes: none.

## What was re-run in the Scribe's sandbox (the fourteen files staged in, hashes matching)

- Dash audit (G-8): 0 on every staged file.
- `npx tsc --noEmit`: exit 0.
- `npx vitest run`: 31 files, 660 tests passed (the builder's numbers).
- `node --check scripts/smoke.mjs`: ok.
- From-zero smoke on a fresh persist (SMOKE_PORT=8981): `About to apply 56 migration(s)` and `SMOKE PASS`. The scheduling walk inside it: landing 200, unknown stage 404, `>>` 303, second `>>` 400 (refused in words), unschedule 303, backdated `>>` 303, complete 303, demote 403 on a wrong PIN, 403 on the Models PIN, 303 on the Admin PIN, the Pasteurization walk (schedule, refuse, demote 403 then 303), the auto-complete paths after the standing trim and cryo walks.
- The law read at the code: `TRIM_SCHEDULED_SQL` and `CRYO_SCHEDULED_SQL` are EXISTS predicates on a non-deleted scheduled row; `listPaneRows` routes them and the Data Queues stay on the unfiltered path; `scheduleHbn` resolves the Effective Date once through `resolveEffectiveDate`, refuses an empty HBN and a second schedule, binds 13 to 13 placeholders, and writes the override marker through `effectiveOverrideLog`; `demoteScheduleItem` reads `app_config admin_pin` and refuses with 403 when the PIN is missing or does not match; the four automatic-complete hooks stand at the lot_trimmed_unloaded paths, setCryoWeight and the Unloaded Queue's mark_trimmed.
- Dev servers swept and .smoke-persist removed after the run.

## Visual pass (the Scribe's own fixture through the pure renderer)

`schedulingPage` and `schedulingLanding` rendered with a fixture of two available HBNs (three lots and one), one scheduled HBN (two lots, one already trimmed), one complete lot, through `themeStylesheet` for lite, cerberus and co at 1280 wide; the phone stack at 420 with `body.device-phone`; the Pasteurization station with two available packages and one Pasteurizing; the empty station; the landing; the Spanish station.

- Three panes side by side in all three sheets: Available with the Effective Date summary reading today and "(today)", the HBN summaries with the count badge and one `>>` each, the lot rows read-only under an opened HBN; Scheduled with the HBN label, "In queue" in bold, `<` and `>` on each lot, "trimmed" muted on the lot whose work is done; Complete with the local instant, the Admin PIN box and the `<` demote.
- Pasteurization reads "Pasteurizing"; the empty panes read "- EMPTY -"; the landing is two Station tiles, Trimming and Pasteurization, with the Production Operations link above; Spanish reads "(hoy)".
- Phone: the three panes stack Available, Scheduled, Complete in one column; no horizontal scroll at 420 (scrollWidth equals the viewport in every shot).
- Dash audit on the rendered pages: 0.

## Findings

None that block. Two cosmetic notes for the owner's eye, not for the hand: the CO sheet wraps a long identity line so the trailing "g" sits alone (the fixture's identity strings were the Scribe's, the real lines come from db.ts and are shorter); the Complete pane's PIN box and `<` sit on one line at 1280 and wrap under the instant on the phone. Neither breaks the law.

## Canon amendments carried into 0.30.100

The four owner forks recorded as built (Status words In queue and Pasteurizing; unschedule with no reason and no PIN; pages open with only the demote PIN-gated; completion automatic as well as by the arrow), still awaiting his word. The builder's decisions the slice did not name recorded verbatim (the simple label farm_code / strain / entry_date; the available-row identity lines; the flash `Scheduled N.`; `>>` as a submit with `form=` and `name="hbn_id"`; voids drop through the non-deleted joins). Data Queues and `/export` stay the record table; only the two entry stations' left panes and the no-pick cryo bulk form narrow.

## Deploy (his hands, WITH migration 0056)

From `app/`:

```
npx wrangler d1 execute gripfactory-lite-grip-20260914 --env grip --remote --command "SELECT 1"
npx wrangler d1 migrations apply gripfactory-lite-grip-20260914 --env grip --remote
npm run deploy:grip
```

## Sealed final check (the Scribe's, on the staged fourteen)

```
npx tsc --noEmit                      exit 0
npx vitest run                        31 files, 660 tests passed
node --check scripts/smoke.mjs        ok
rm -rf .smoke-persist && SMOKE_PORT=8981 WRANGLER_SEND_METRICS=false timeout 285 npm run smoke
                                      About to apply 56 migration(s); SMOKE PASS

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
device hashes: all fourteen match the builder's seal; canon trio and the slice untouched; git remote count 0
dash audit: 0 on every file above and on the rendered visual-pass pages
```
