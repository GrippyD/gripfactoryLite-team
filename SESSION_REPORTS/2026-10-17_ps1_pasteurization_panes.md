# PS1: pasteurization panes (2026-10-17)

Worktree branches/GFLiteMetrcAPI. Pin as received, the recipe's hash in app/ (Linux two-space sha256sum, wrangler.toml read as LF): 2894924330f68f15, 390 files (DD S2c live). Final tree d33061eb5f399ae4, 390 files. No git. Nothing is committed, pushed, or deployed. No migration. canon/ and prompts/ were not edited.

## What an operator sees

A pasteurization run reads as two lines everywhere it is listed. Line 1 is the lot code (last 5 of the HBN), the last 5 of each METRC harvest package tag, and the container count. Line 2 is grams, pounds at 448, and the market strain. The full HBN is the hover title.

On Cryo Weight Entry the left pane lists working runs by lot serial, lowest first. Finished runs sit in a closed Finished list under that, newest first. Finish still completes the run. The run leaves the working list, stays picked, and shows [Add Shake] under its packages. Add Shake writes one SHA package into Testing without reopening the run. Each shake pends its own New Packages file (type Shake) at the export home. The run's own file is not touched.

Pasteurization Scheduling uses the same two lines in Available, Scheduled, and Complete, ordered by lot serial. Scheduled keeps the out line and the terp, dose, and shuttle controls. Complete keeps its date and Admin PIN unfinish.

## Files

| file | bytes | sha256 | state |
| --- | ---: | --- | --- |
| app/src/cryo.ts | 31105 | 24f161eb66e6765f | edited |
| app/src/db.ts | 229634 | 36e7ae888ad417dc | edited |
| app/src/actions.ts | 427762 | 198e61c9e1c26462 | edited |
| app/src/index.ts | 195991 | 0ed9fa9027cc13f2 | edited |
| app/src/scheduling.ts | 48375 | 604fbdf2bf5146ed | edited |
| app/src/html.ts | 199399 | e4b1624a55b8a2c5 | edited |
| app/src/config.ts | 92213 | 974953aedf478378 | edited |
| app/src/i18n.ts | 368247 | 233043f69d08e0b8 | edited |
| app/src/theme.ts | 229670 | eb3ac24c88acacc7 | edited |
| app/test/cryo.test.ts | 48720 | 6cf84a15e3fce14e | edited |
| app/scripts/smoke.mjs | 898057 | ac5e531e3a57178e | edited |

Dash and CR scan of those eleven files: U+2013 0, U+2014 0, CR 0. The new lines add no personnel names. i18n.ts, theme.ts, smoke.mjs, and actions.ts still contain names that were already in those files. The new tests use the existing cryo operator fixture.

A shake package is an output whose created_at is after the run's completed_at. The upload mark is kind new_packages_shake, ref_id the output id. metrc_uploads.kind is already free text, so no migration.

At 820px the cryo station's two panes stack so the package table does not widen the page.

## Gates

Typecheck: `npx tsc --noEmit` exit 0.

Vitest TZ=UTC (default workers):

```
Test Files  112 passed (112)
Tests  1620 passed | 6 skipped (1626)
```

Vitest TZ=America/New_York (`--maxWorkers=4`):

```
Test Files  112 passed (112)
Tests  1620 passed | 6 skipped (1626)
```

A default-worker New York run timed out two migratedDb tests at 5 seconds (the prepack unfinish test, and one metrceval test). Those two files pass when run on their own. The UTC default run passed.

`node --check scripts/smoke.mjs` exit 0. Smoke assert count 3381, one more than the pin's 3380.

From-zero smoke: exit 0. `About to apply 104 migration(s)`. `SMOKE PASS`. Lines containing ` 500 `: 0. Lines containing ` 503 `: 1 (`POST /api/send`, the smoke's own step).

In the browser, on static renders with each view's stylesheet: the cryo station working, the cryo station with a finished run picked and Add Shake open, and Pasteurization Scheduling, in Lite, CO, and Cerberus at 1920 and at 820. Scroll width equaled client width on each.

Final tree d33061eb5f399ae4. Nothing is committed, pushed, or deployed. The Scribe gates; the owner merges.
