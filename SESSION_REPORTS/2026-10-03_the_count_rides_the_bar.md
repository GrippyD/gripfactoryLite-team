# 2026-10-03 The count rides the bar, and the rooms read Silo Ops

BRIEF V28, THE COUNT RIDES THE BAR, AND THE ROOMS READ SILO OPS (canon 0.30.378), built in the worktree `branches/GFLiteOpsDashboard` under THE DISPATCH RULE (canon 0.30.155). No migration. The smoke pin stays 90. Not deployed. Nothing committed. Nothing pushed. No git was run.

## The tree as received

The brief pins `a6a9608eb68264ff` (283 files, migrations 0001 to 0090, worker `9a152b52`, main `bcdcf09`). The disk hashed exactly that before the first edit (Git Bash `sha256sum`, the binary marker read as the Linux two-space form).

The app tree after this session hashes `1ae17bb287a366ea` (283 files: none new, none deleted).

## The count sits on the bar

In `paneCard` (`src/cure.ts`). The name and the conditions line stay at the top of the tile. The `details.cure-lots` moves inside the shade. Its summary ("{pct}% full - {n} Lots", the same words and the same data attributes) is the first child of that details, and the details is the first child of the shade, so the summary sits at the shade's top edge just under the 2 px top border.

Folded, the shade is still an absolute layer from the tile's bottom. Its inline `height` is `cureShadeFill` and `data-cure-fill` is that same percent, as today. The clock script sets `--cure-fill` from that attribute so the HTML the tests read does not change.

Opened, `:has(.cure-lots[open])` puts the shade in flow: `height: auto`, `min-height: var(--cure-fill)`, `margin-top: auto`, bottom still the tile's bottom. The bar is the larger of the percent full and what the summary plus every lot row need. Each lot still folds on its number. Nothing scrolls inside the bar. When the list is taller than the folded tile, the tile grows with it. The drying row already stretches every tile to one height, so a short open bar (CSB with three lots) still sits on the row's bottom while CSA's twenty-one lots raise the row. Folding returns the shade to the percent full.

At 0 lots the shade keeps `data-cure-fill="0.0"`: no green, no top border, `min-height: min-content` so the bar is the summary line ("0% full - 0 Lots", fold "No lots.") at the tile's bottom. Over the cap the folded bar fills the tile and the summary keeps `cure-over`. A percent too low for the summary still shows the whole line (`min-height: min-content`). A fill so high the summary would sit under the name and the conditions line gets a padding-top from the clock script, folded only, so the letters stay below those two lines while the green still fills the tile.

`.inv-gauge.cure-pane` drops its bottom padding so an open shade's bottom is the tile's bottom. The open shade stretches the tile's width (`align-self: stretch`, `width: calc(100% + 1.6rem)`, side margins `-0.8rem`) so it does not shrink under the row's `align-items: center`.

## The look

The summary and the lot rows read in the theme's text colour on the green. Links keep the theme's link colour (not a light override). `pointer-events: auto` on the shade so the summary and the rows click. The height transition stays. Width stays 13.6rem. No change to the conditions line's own words, except the Silo Ops tag below.

## A test reading never shows

`latestReading` selects `source` and skips a row whose `source` is `test` (case-blind, trimmed). The stored row stays. With no other row the pane says "no sensor yet", as CSB already did.

## The source on the line

When the shown reading's `source` is `silo-ops` (case-blind, trimmed), `conditionsLine` ends "· Silo Ops". EN and ES use the same name. Any other source shows as today. The tile's `title` is the reading's Eastern wall clock plus ` ET · ` and the stored source (`readingTitle`).

## The contract

A comment above `storeSensorReadings` and a muted line on Admin, Environment (`data-env-silo-ops`) say, EN and ES: Silo Ops posts its Storage readings for CSA and CSB here with source "silo-ops", at most once a minute per room, `read_at` the unit's own sample time in UTC. No new route. No new secret. No change to the door's checks. The door already takes a `silo-ops` post under the service token.

## Files touched

Edited (8): `app/src/cure.ts`, `app/src/theme.ts`, `app/src/i18n.ts`, `app/src/environment.ts`, `app/test/curecaps.test.ts`, `app/test/cure.test.ts`, `app/test/environment.test.ts`, `app/scripts/smoke.mjs`.
New (2), in this report's folder: `SESSION_REPORTS/2026-10-03_cure_bar_folded.png`, `SESSION_REPORTS/2026-10-03_cure_bar_opened.png`.
None deleted from the 283. `migrations/`, `wrangler.toml`, `tsconfig.json`, `package.json` are the tree as received. `npm run typecheck` rewrote the git-ignored `worker-configuration.d.ts`; it is not in the 283.

## Tests

1 new case (1,158 to 1,159; 85 files), and the existing pane and reading cases now pin the new law:

- `paneCard`: `details.cure-lots` inside the shade, the summary its first child; name and conditions before the shade; folded `height` and `data-cure-fill` as today; 0 lots, the summary in the shade and no `cure-over`; over the cap, `cure-over` on the summary.
- `latestReading` passes over `test` (CSA with only that row reads "no sensor yet"; the row stays). A newer or older `silo-ops` row shows; a later `TEST` row does not take its place.
- A `silo-ops` line ends "· Silo Ops" in EN and ES; `SILO-OPS` matches; `sensorpush` does not. The CSA tile title is the Eastern time and the source.
- The door stores `source` "silo-ops" as it did.
- Admin, Environment help, EN and ES, with `source &quot;silo-ops&quot;` (the page runs the line through `esc`).

## Render check

Node's Playwright module is not installed. The check used Python Playwright and the machine's pre-installed Chromium 1223. Fixture: CSA 21 of 36 (58% full) and CSB 3 of 8 (38% full), Grip view.

Folded: CSA summary top 101.4 px, shade top plus the 2 px border. CSB summary top 140.9 px, the same 2 px. Both shade bottoms equal the tile bottoms.

Opened: the shade's box contains every lot row's box (21 and 3). Both shade bottoms still equal the tile bottoms. CSA's tile 705.5 px, taller than the folded 192 px, nothing clipped. The drying row's tiles share 705.5 px. The shade's left and right match the tile.

Screenshots: `SESSION_REPORTS/2026-10-03_cure_bar_folded.png` and `SESSION_REPORTS/2026-10-03_cure_bar_opened.png`.

## The smoke

Both panes render the fullness summary inside the shade (`<div class="cure-shade"...>` then `<details class="cure-lots">`).

A CSA post with `source` "silo-ops" shows "68.2 F" and "· Silo Ops" on CSA's line. A CSB post through the service token (`noIdentity: true`) with `source` "silo-ops" returns 200 and shows "70.5 F" and "· Silo Ops" on CSB's line.

## Gates

Run in the worktree's `app/`.

- `npm run typecheck`: exit 0.
- `npx vitest run`: 85 files, 1159 tests passed under `TZ=UTC`, and 85 files, 1159 tests passed under `TZ=America/New_York`.
- `node --check scripts/smoke.mjs`: exit 0.
- From-zero smoke (`SMOKE_PORT=9261`, `WRANGLER_SEND_METRICS=false`, `CI=1`, `TZ=UTC`) on the final tree: About to apply 90 migration(s), Ready on http://127.0.0.1:9261, SMOKE PASS, no ` 500 ` line, exit 0 (18,518 counted lines; the one ` 503 ` line is `POST /api/send`, the smoke's own asserted step).
- Dash (U+2013, U+2014), CR and BOM audits by character on all 8 touched app files and this report: 0. No personnel name in an added line.

## Deploy

Not deployed from this session. Nothing committed. Nothing pushed. No git was run.

## Sealed final check

```
the tree as received                  a6a9608eb68264ff (283 files, migrations 0001-0090)
npm run typecheck                     exit 0
TZ=UTC npx vitest run                 85 files, 1159 tests passed
TZ=America/New_York npx vitest run    85 files, 1159 tests passed
node --check scripts/smoke.mjs        exit 0
SMOKE_PORT=9261 WRANGLER_SEND_METRICS=false CI=1 TZ=UTC npm run smoke
                                      About to apply 90 migration(s); SMOKE PASS; " 500 " lines: 0; " 503 " lines: 1 (POST /api/send); exit 0
dash audit: 0; CR audit: 0; BOM: 0; personnel data: none new
the app tree after the edits          1ae17bb287a366ea (283 files)
```

```
app/scripts/smoke.mjs                771454  31ab95b7aa90664c
TAIL });
app/src/cure.ts                       22564  73f7648b5a5734e4
TAIL }
app/src/environment.ts                23413  92ef2cfc3e000971
TAIL }
app/src/i18n.ts                      248110  f0c444097adb3977
TAIL }
app/src/theme.ts                     190420  d0f51aa48312f947
TAIL }
app/test/cure.test.ts                 14912  a847ed103c32ec91
TAIL });
app/test/curecaps.test.ts              7178  73e81c2a086ef8e2
TAIL });
app/test/environment.test.ts          10950  9a0e93b7a394a770
TAIL });
SESSION_REPORTS/2026-10-03_cure_bar_folded.png   82508  882608067f109f6d
SESSION_REPORTS/2026-10-03_cure_bar_opened.png  205930  49524beaaeb3f390
```
