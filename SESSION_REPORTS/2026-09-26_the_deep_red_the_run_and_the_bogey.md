# 2026-09-26 The deep red, the run and the trim bogey (canon 0.30.252)

Scribe session, Scribe-direct under G-2 on the quiet tree: brief P part two with its fix, gated PASSED at canon 0.30.251 (tree 78a7cf36416cd4d0), no build session in it. No migration; the head stays 0075. Not deployed; the one deploy line below carries part two, its fix and this slice.

## The rulings

1. THE DEEP RED (canon 0.30.248). His question, verbatim: "how would the 40% consumed look in bright red?" A preview drawn by the live plume at 31% and 15% BTR showed bright red, a deep red and the live green, with the same rows simulated for red-green color blindness; bright red read 1.41 and 1.85 to 1 against the bud green (1.10 and 1.47 to a deuteranope). His pick on the question tool, verbatim: "Deep red (Recommended)".
2. THE RUN (canon 0.30.248). His question, verbatim: "is it possible to see on the "complete" pane in the silos screen to see how long they ran according to timestamps?" His picks, verbatim: "Unload finished (Recommended)" and "Yes, add the average".
3. THE TRIM BOGEY (canon 0.30.249). His words, verbatim: "Add a Admin Lookup Field: [Trim Bogey] expressed as a percentage" and "Determines number of dark red squares and the order based on our scheme (ROYGBIVWB-Aqua)".

## What changed

- `src/theme.ts`: the waste cell `.hc-bud-consumed[data-hc-bud-waste]` and its swatch `.hc-swatch-waste` draw `#7c1b1b` in Lite and Continuum and `#ba2929` in Cerberus (3.02 and 3.01 to 1 against each skin's bud green); the comment carries the ruling. Applied by the patcher kept at `RESEARCH/scribe/pending/plume_deep_red.py`, which asserts every count before it writes.
- `src/console.ts`: `budWaffle(btr, locale, bogeyPct = BUD_PRODUCT_CELLS)`: the last `bogeyPct` cells of the order (red, orange, yellow, green, blue, indigo, violet, white, black, then the aqua core) are product, clamped 0 to 100, and a consumed one carries `data-hc-bud-waste`; the svg carries `data-hc-bud-product`. `TrimInput.bogeyPct`, read by `loadHarvestConsole` from app_config `trim_bogey_pct`; `trimShiftCard` passes it. The comments carry the rulings.
- `src/config.ts`: `CONFIG_KEYS.trim_bogey_pct`; `TRIM_BOGEY_DEFAULT` (40); `trimBogeyOf` (a whole percent 0 to 100, a trailing % allowed, else null); `parseTrimBogey` (the default when missing or unreadable).
- `src/lookups.ts`, `src/pages.ts`, `src/index.ts`, `src/actions.ts`: Admin, Lookups, Production Operations carries a Trim Bogey button; `/admin/lookups/trim_bogey` shows the value, says when it is still the default, and posts the percent with a reason; `saveTrimBogey` inserts the app_config row on the first save and updates it after, each change in `record_change_log`, refusing anything but a whole percent 0 to 100 ("Trim Bogey is a whole percent from 0 to 100.") and a blank reason. No migration: the default lives in the code until the first save.
- `src/db.ts`: `listDryingComplete` joins the lot's latest ended load and carries its `loaded_at`, `started_at`, `paused_at`, `paused_seconds` and `ended_at` (`run_*` on `DryingCompleteRow`).
- `src/drying.ts`: `formatRunClock` (days, then hours and minutes).
- `src/scheduling.ts`: `dryingRunSeconds` (the load's clock read at its end: the loaded time to the unload's finish less the banked pauses, frozen at `paused_at` when it ended paused, exactly `siloClockSeconds` at `ended_at`), `dryingRunAverage` (the mean over the rows that have a run); each Complete row reads `Ran 1d 02:14` (`data-run-seconds`), each space's heading `average 1d 06:12` (`data-run-average`), on all three drying surfaces.
- `src/i18n.ts`: `Ran {t}` (Duró), `average {t}` (promedio), the Trim Bogey words (Meta de recorte) and its refusal.
- `test/console.test.ts`: the deep red pinned in every skin; the plume's tag with its product count; a new case for the bogey at 40, 35 (four waste cells at 31% BTR, from the 66th, inside violet), 0, 100, out of range and not a number, and the parse.
- `test/trimbogey.test.ts` (new): the landing button, the page, the save (insert, update, the log, the same value writing nothing, the refusals) and the console reading the saved value.
- `test/dryingrun.test.ts` (new): the run's clock, the paused end, no run without a time, the average, the Complete pane's markup in English and Spanish, and `listDryingComplete` carrying the latest ended load.
- `scripts/smoke.mjs`: on the harvest console, the Second plume at 31% BTR reads product 40 and nine waste cells; the Trim Bogey page reads the default; 140 refuses in words; 35 saves, flashes and reads back, the console then reads product 35 and four waste cells; 40 is saved back. On the Dry Rooms surface after the joint unload, each Complete row reads its run and the room's heading its average.

The legend's words, the cells' order and counts, the clocks, the unload law, the seven day window, `/silos/live.json` and Silo Ops are as they were.

## Gates

- `npx tsc --noEmit`: exit 0.
- `npx vitest run`: 59 files, 921 tests passed; the same under `TZ=America/New_York`.
- `node --check scripts/smoke.mjs`: ok.
- From-zero smoke (`SMOKE_PORT=9173`): `About to apply 75 migration(s)`, `SMOKE PASS`, no ` 500 ` line. Its D1 after the walk: app_config `trim_bogey_pct` reads 40, inserted at 35 under "smoke: a tighter goal" and updated to 40 under "smoke: back to the default", both logged.
- Dash audit 0 and no CR byte on the 123 files under `src`, `test` and `scripts/smoke.mjs`; secret grep: no matches.
- Every file was read on the device at its pre-edit bytes (the gated tree's) before the commit, and all fifteen are identical both sides after.
- Previews from the slice's own code: `RESEARCH/scribe/pending/slice_plume.png` (the deep red at bogeys 40 and 35, Lite and Cerberus) and `RESEARCH/scribe/pending/slice_complete_bogey.png` (the Complete pane's runs and averages, and the Trim Bogey page).

## Assumptions for his word

- The run is the lot's latest ended load's clock, so a lot moved between spaces reads the run of its last space.
- Runs read days, hours and minutes, no seconds; the average is the plain mean of the space's rows that have a run, over the pane's seven days.
- A dry room and a freezer read their runs the same way on their own surfaces.
- One Trim Bogey for both shifts' plumes; whole percents only; 0 turns the dark red off and 100 makes every consumed square dark red.
- The bogey shows on the console only through the plume; its value lives on Admin, Lookups.

## Deploy (his hands; worker-only, no migration rides; it carries part two, its fix and this slice)

```powershell
cd "C:\Users\DennisWallace\Documents\Claude\Projects\gripfactory Practical\app"
npm run deploy:grip
```

## Sealed final check

```
npx tsc --noEmit                      exit 0
npx vitest run                        59 files, 921 tests passed
TZ=America/New_York npx vitest run    59 files, 921 tests passed
node --check scripts/smoke.mjs        ok
rm -rf .smoke-persist && CI=1 SMOKE_PORT=9173 WRANGLER_SEND_METRICS=false npm run smoke
                                      About to apply 75 migration(s); SMOKE PASS; " 500 " lines: 0
scripts/smoke.mjs                             602076  4185e4b7c77f0d7e  tail: });
src/actions.ts                                342431  78c377b081eb62f3  tail: export { MANIFEST_COLUMNS, buckedPackageCode };
src/config.ts                                  70407  e740f42904fcd41d  tail: }
src/console.ts                                102761  4089c9c38604e7ef  tail: }
src/db.ts                                     178910  4a5ba4593594e105  tail: }
src/drying.ts                                  34480  a0c14bad42792652  tail: }
src/i18n.ts                                   177776  1337e81990da37aa  tail: }
src/index.ts                                  139702  7dc57041b77c5cc3  tail: export default worker;
src/lookups.ts                                  8706  8c5651b2152c9530  tail: };
src/pages.ts                                   26769  24d20ff1b9ee2ad0  tail: }
src/scheduling.ts                              46784  7d34bb295b349ff2  tail: }
src/theme.ts                                  156872  3e746b5d50aeb240  tail: }
test/console.test.ts                           60326  96312ecc89f4b51f  tail: });
test/dryingrun.test.ts                          6545  dc507b70cf66b065  tail: });
test/trimbogey.test.ts                          4956  dec7238d598106a0  tail: });
tree listing after the change: 220 files, sha256 e227d152315a2368 (before: 78a7cf36416cd4d0)
dash audit: 0; secret grep: no matches
```
