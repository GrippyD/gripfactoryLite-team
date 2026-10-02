# 2026-10-02 The Cure Caps

BRIEF V18, THE CURE CAPS (canon 0.30.341), built in the worktree `branches/GFLiteOpsDashboard` under THE DISPATCH RULE (canon 0.30.155). The paste named the tree after V17. The disk this session opened on was the Max Tote tree after that: migrations 0001 to 0087, newest worktree report `2026-10-02_max_tote_weight.md`, the live app tree canon names `b26531a8b30fd971` (261 files). The owner said to start at 18 on that disk. The app tree after these edits hashes `941892df1d14406f` (263 files). Migration 0088; the smoke pin is 88. Not deployed. Nothing committed. Nothing pushed. No git was run.

## What changed

- `migrations/0088_the_cure_caps.sql`: `INSERT OR IGNORE` of `csa_lot_cap` `'36'` and `csb_lot_cap` `'8'` in the eight-column `app_config` shape of 0086. Nothing before 0088 edited.
- `src/config.ts`: the two keys on `CONFIG_KEYS`; `CSA_LOT_CAP_DEFAULT = 36`, `CSB_LOT_CAP_DEFAULT = 8`; `lotCapOf` (a whole number 1 to 999, else null); `parseLotCap(raw, fallback)` (a whole number above 0, else the fallback, so the cure tests' `"CSA,CSB"` read stays the default).
- `src/lookups.ts`: two buttons on the Harvest Operations landing, CSA Lot Cap and CSB Lot Cap.
- `src/pages.ts`: `lotCapPage(room, value, stored, locale, ok)` for both rooms. The sentence is "The number of lots {room} holds; the tile on the Harvest Console fills green by lots over this cap." A number box, Reason, Save. The flash is "Lot cap saved."
- `src/actions.ts`: `saveLotCap(db, form, key)` updates, revives, or inserts the `app_config` row through `saveConfigNumber` and logs `record_table` `app_config`. A value outside 1 to 999 refuses "Lot cap must be a whole number of lots, 1 to 999." A blank reason refuses "Reason is required."
- `src/index.ts`: GET and POST for `/admin/lookups/csa_lot_cap` and `/admin/lookups/csb_lot_cap`, beside the Trim Bogey routes.
- `src/cure.ts`: `listCurePanes` reads both caps with `getConfigValue` and `parseLotCap` into `caps`. Each pane opens with `<div class="cure-shade" ... data-cure-shade>`, then the name, then `<p class="cure-count" data-cure-count data-cure-cap data-cure-pct>`. Shade opacity is `0.000` at zero lots and `0.15 + 0.7 * min(n/cap, 1)` otherwise (three decimals). Past the cap the count takes `cure-over`. The lot rows are unchanged. The same `curePanes` draws the console, `/ops/drying_ops`, unload dry space, and the drying schedule. Nothing is live-painted.
- `src/theme.ts`: in `walkSliceChrome`, the pane is `position: relative; overflow: hidden`; the shade is absolute, `#2e9e4f`, `pointer-events: none`, width auto so the 11.2rem child rule does not size it; content other than the shade is `position: relative`; `.cure-over` is `#7c1b1b`. After the cerberus chrome, the shade is `#3ecf6b` and `.cure-over` is `#ba2929`.
- `src/i18n.ts`: EN and ES for the titles, the two landing lines, the page sentence, the refusal, the count line ("{n} de {cap} lotes, {pct}% lleno"), the flash, the field label, and the unsaved-default line.
- `scripts/smoke.mjs`: pin 88. On the first unloaded `/harvest`, each pane has `data-cure-shade` and a count equal to the lots in that pane, CSA against 36. `/ops/drying_ops` carries the same CSA count line. After trim is scheduled, CSA drops by one and CSB rises by one. GET `/admin/lookups/csb_lot_cap` shows 8; POST 1 with a reason flashes "Lot cap saved."; `/log` carries `app_config` `csb_lot_cap` `value` from 8 to 1; `/harvest` then reads 100% on a solid shade when CSB holds one lot, or `cure-over` with opacity `0.850` when it holds more. POST 0 refuses in the words above. POST 8 restores. The landing still has no cure tile (the existing assertion).
- `test/curecaps.test.ts` (new): `lotCapOf` and `parseLotCap`; the tile at 0, 12, and 40 of 36 (opacities `0.000`, `0.383`, `0.850`, the count lines in EN and ES, `cure-over` only past the cap); the Admin page and `saveLotCap` on a migrated DB with the change-log row 8 to 1.
- `test/cure.test.ts`: the listed panes read caps 36 and 8 off the fake `"CSA,CSB"` answer; the empty-pane fixture carries caps. The three pinned assertions (the opening tag, no `cure-panes` wrapper, the summary markup) still hold.

## Assumptions for his word

- "Percentage full" is lots over the cap (one lot is one wet weight entry sitting unloaded in the room), not pounds. The caps are 36 and 8 and live in `app_config` under the two Admin buttons.
- The green goes from a light tint at the first lot (`0.150` plus the fraction) to near-solid at the cap (`0.850`). Over the cap the shade stays `0.850` and the count letters take the waste red. At the cap exactly, the shade is solid and the letters are not red. The figures keep the theme's own text color.
- The tiles shade on every surface that draws them, not only the console.
- The caps do not gate Load Silo, Finish lot, or the unload. They color and count.
- The two buttons sit on Harvest Operations, the landing the brief names (that section is not pinned). Trim Bogey lives under Production Operations, and Max Tote Weight now sits directly after it, so they were not placed between those two.
- The page has the number and a Reason. The person is the session actor, injected the way the Trim Bogey save is. There is no Person box on the page.
- A missing config row says "Not saved yet: the tile reads the default, {n} lots." Migration 0088 seeds both rows, so a from-zero floor does not show that line.

## Gates

Run in the worktree's `app/`.

- `npm run typecheck`: exit 0 (it regenerates the git-ignored `worker-configuration.d.ts` first).
- `npx vitest run`: 76 files, 1047 tests passed under `TZ=UTC`, and 76 files, 1047 tests passed under `TZ=America/New_York`.
- `node --check scripts/smoke.mjs`: exit 0.
- From-zero smoke (`SMOKE_PORT=9318`, `WRANGLER_SEND_METRICS=false`, `CI=1`): About to apply 88 migration(s), SMOKE PASS, no ` 500 ` line, exit 0 (17693 lines of log; the one ` 503 ` line is the smoke's own asserted no-key step, `POST /api/send`).
- The migration on a migrated test database reads `csa_lot_cap` 36 and `csb_lot_cap` 8, and the save logs 8 to 1. The remote snapshot rehearsal is the Scribe's.
- Dash audit: 0 on the twelve files (U+2014 and U+2013). No CR byte. No BOM.
- No key, secret, or password value in the twelve files. No personnel name in the new test or this report.

## Deploy

Not deployed from this session. Nothing committed. Nothing pushed. No git was run.

## Sealed final check

```
the tree this session opened on     b26531a8b30fd971 (canon 0.30.351; 261 files; migrations 0001-0087)
npm run typecheck                     exit 0
TZ=UTC npx vitest run                 76 files, 1047 tests passed
TZ=America/New_York npx vitest run    76 files, 1047 tests passed
node --check scripts/smoke.mjs        exit 0
SMOKE_PORT=9318 WRANGLER_SEND_METRICS=false CI=1 node scripts/smoke.mjs
                                      About to apply 88 migration(s); SMOKE PASS; " 500 " lines: 0; " 503 " lines: 1 (POST /api/send); exit 0
dash audit: 0; CR audit: 0; BOM: none; secret values: none; personnel data: none
the app tree after the edits             941892df1d14406f (263 files)
```

```
app/migrations/0088_the_cure_caps.sql        567  ddf4f8a9726d5db5
TAIL   ('csb_lot_cap', '8', '2026-10-02T00:00:00.000Z', NULL, '2026-10-02T00:00:00.000Z', NULL, NULL, NULL);
app/src/config.ts                          81518  9d391b446e5ebff0
TAIL }
app/src/cure.ts                            19020  341769a8e5986315
TAIL }
app/src/index.ts                          159283  c72ee4db85f38323
TAIL export default worker;
app/src/lookups.ts                         11183  3efce74ebd315e7d
TAIL };
app/src/pages.ts                           33264  6ec8bb6de89a5ed4
TAIL }
app/src/actions.ts                        413237  846a847a0b15eb78
TAIL export { MANIFEST_COLUMNS, buckedPackageCode };
app/src/theme.ts                          188168  b5571d8040f5c02d
TAIL }
app/src/i18n.ts                           199371  b3cc21ab28812fda
TAIL }
app/scripts/smoke.mjs                     721412  0b88a1a48e1c6764
TAIL });
app/test/curecaps.test.ts                   5662  430c4e3ed779fc0e
TAIL });
app/test/cure.test.ts                      11206  99c9dc8d94a46c37
TAIL });
```
