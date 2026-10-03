# 2026-10-03 A farm with no trimmed lot borrows the season's BTR

BRIEF V27, A FARM WITH NO TRIMMED LOT BORROWS THE SEASON'S BTR (canon 0.30.376), then BRIEF V27a, THE OLD TOTE CONTROLS FOLLOW VOID'S LAW (canon 0.30.375), built in one session in the worktree `branches/GFLiteOpsDashboard` under THE DISPATCH RULE (canon 0.30.155). No migration. The smoke pin stays 90. Not deployed. Nothing committed. Nothing pushed. No git was run.

## The tree as received

The brief pins `b333d595286a8b10` (283 files, migrations 0001 to 0090, worker `2c220c44`, main `0e21362`). The disk hashed exactly that before the first edit (Git Bash `sha256sum`, the binary marker read as the Linux two-space form).

The app tree after this session hashes `a6a9608eb68264ff` (283 files: none new, none deleted).

## V27: the season BTR

In `consoleYields` (`src/console.ts`). A frozen lot and a lot in a freezer stay out, as they did. Each farm still keeps its own BTR: bud-type grams over all trim grams on its own trimmed lots, weighted by weight. Null when that farm has no trimmed lot with trim grams.

The season BTR is those same lots pooled across the three farms: one sum of bud-type grams over one sum of trim grams. It is not the mean of the farms' percents. Null when no farm has a trimmed lot with trim grams.

A farm whose own BTR is null and which has no trimmed lot projects Estimated Bud with the season rate: bud packages so far, plus the season BTR times (projected dry plus unloaded remainder). A farm with its own rate keeps it. The first trimmed lot ends the borrow, including a trimmed lot that has no trim grams yet (its own ratio is still null, and it does not borrow). Assumed Dry and the dry-down are the same numbers as before. The Total is the sum of the three farms' grams.

`FarmYield` carries `btr` (the farm's own ratio, null when it has none), `btrSource` (`own`, `season`, or `none`), and `btrRate` (the rate Estimated Bud used). The page reads those fields.

The line, EN and ES:

- own: "at {pct}% BTR" / "al {pct}% BTR"
- season: "at {pct}% BTR, the season's (no lot trimmed here yet)" / "al {pct}% BTR, el de la temporada (ningun lote podado aqui aun)"
- none: "no BTR yet" / "sin BTR aun", as before

## V27a: one rule for a tote's grams

`changeToteGrams` in `src/finishedlots.ts`, beside `voidFinishedTote`. It decides the statements. The caller runs them in its batch. V26's Void calls it and batches. The record void (`planVoidRecord` for `wet_weights`) returns its statements and `voidRecord` batches them. The record edit skips `weight_grams` in the generic update and, when the posted grams differ, appends this function's statements to the same `db.batch`. No other path writes a tote's grams.

By status:

- `weighing`: the tote changes, the lot total is recomputed and logged with the reason, and the wet package is not touched. This includes V26's Void. A weighing lot's package is set by the next finish.
- `in_transit` or `drying`: the tote, the lot total, and the one live wet package (SPR or WIP) move by the same grams in that batch, each logged with the reason. Down on a void or a lower weight, up on a higher weight or a restore. V26's refusals stand: more than one live package, a package with children, a package that has left its space (the barn it was born in, the lot's space, or that space's METRC location), a package that is not SPR or WIP, and a package that would go below zero. The below-zero refusal uses V26's sentence, "The lot's wet package holds less than this tote."
- `unloaded`, `trimmed`, `frozen`: refused on the record void, the record gram edit, V26's Void, and a restore, in V26's words (the wet weight is closed; ask the Scribe for a repair).

A void and a gram edit already required a reason, and they still do. V26's Void still takes the Admin PIN. The record routes stay on the gate they had (a reason, no PIN). An edit that does not change grams (the tote's HBN, posted with the same weight) does not call this rule. The package and the lot total stay as they were.

The record layer has no restore of a voided tote. The edit page 404s a voided row, and the void page only voids. `changeToteGrams` still accepts `op: "restore"` so a later route would not grow a second path. The unit test calls it. A new line, EN and ES: "That tote is not voided." / "Ese tote no esta anulado."

## Readings

1. A trimmed lot with no trim packages ends the borrow. Its own BTR stays null, the line stays "no BTR yet", and a farm with no trimmed lot does not borrow a season rate that cannot be divided. The law's "first trimmed lot ends the borrow" is this case.
2. A drying or in-transit lot with no live package still changes the tote and the lot total and does not refuse. There is nothing to move. V26 already did this for a weighing lot that had never been finished.
3. The record void still says "Record not found." for a missing row and "Record is already voided." for a second void. Those checks run before `changeToteGrams`. The function's own missing-tote words are "Unknown tote."
4. If a closed lot's pencil also posts a different HBN, the older HBN sentence fires first ("Only a weighing lot's totes can change HBN; this lot has finished."). A gram change that leaves the HBN as it is refuses in the wet-closed words. The real pencil posts the current HBN unchanged, so the floor hears the wet-closed sentence.
5. V26's Void on a weighing lot used to lower the package. It does not, as of this slice. That is the second gap in the V26 gate.
6. The from-zero smoke used to reweigh a tote of an unloaded lot (235 g to 240 g) so the harvest file would show under Changed after upload. That edit now refuses, the file stays marked, and that tote stays 235 g. The year's wet total in the smoke is 5 g lower because of that. Changed after upload is not reached by that step anymore. A gram edit the law allows still goes through the same record update the upload hook already watched.

## The snapshot

Newest snapshot in the main folder's `db_backups/`: `20261003-111633_pre_v26` (a `20261003-111630_pre_v26` sits beside it; 111633 is the later name). Harvest year 2026, 71 lots, BTR codes BUD, SMALLS, SHAKE. Frozen and freezer lots are out. Trimmed lots in the pool: PNN 4, PNS 2, ARL 0.

Season BTR: 1,880,698 / 5,817,718 = 0.32327073948926366, shown as 32.3%. PNN's own trimmed grams are 814,227 / 2,861,697 (28.5%). PNS's are 1,066,471 / 2,956,021 (36.1%). The mean of those two percents is 0.32265258328870566. It also rounds to 32.3% on the line, and it is not the rate used. Using the mean on ARL's same base would be 1,391.11 g less.

ARL's bud so far is 5,274,425 g. Its projected dry plus unloaded remainder is 2,250,418 g. After: 5,274,425 + (1,880,698 / 5,817,718) * 2,250,418 = 6,001,919.29101995 g.

| Farm | Before | Before line | After | After line |
| --- | --- | --- | --- | --- |
| PNN | 17,991.01 lb | at 28.5% BTR | 17,991.01 lb | at 28.5% BTR |
| ARL | 11,773.27 lb | no BTR yet | 13,397.14 lb | at 32.3% BTR, the season's (no lot trimmed here yet) |
| PNS | 26,016.50 lb | at 36.1% BTR | 26,016.50 lb | at 36.1% BTR |
| Total | 55,780.78 lb | the three farms | 57,404.65 lb | the three farms |

Assumed Dry is unchanged on each farm (PNN 63,300.84 lb, ARL 41,396.15 lb, PNS 74,267.94 lb). The ARL before figure is the 11,773.27 lb the V22 and V23 gate named.

## Files touched

Edited (7): `app/src/console.ts`, `app/src/i18n.ts`, `app/src/finishedlots.ts`, `app/src/actions.ts`, `app/test/console.test.ts`, `app/test/finishedlots.test.ts`, `app/scripts/smoke.mjs`.
None new. None deleted. `migrations/`, `wrangler.toml`, `tsconfig.json`, `package.json` are the tree as received. A throwaway snapshot probe (`test/zz_yield_snapshot.test.ts`) was deleted before the tree was hashed. `npm run typecheck` rewrote the git-ignored `worker-configuration.d.ts`; it is not in the 283.

## Tests

5 new cases (1,153 to 1,158; 85 files):

- V27 (1): two farms of unequal trim weight, the pool is not the mean of their percents, the farm with no trimmed lot takes that pool on bud so far plus the rate times projected dry plus remainder, its line names the season, a farm with its own trimmed lot keeps its rate, no trimmed lot anywhere leaves "no BTR yet" and Estimated Bud as bud so far, frozen and freezer lots stay out, the Total is the sum. EN and ES.
- V27a, drying (1): the record void and the record edit move the lot and the package by the grams, logged with the reason; a higher weight moves both up; a restore through `changeToteGrams` (no route offers it) puts the voided grams back on the lot and the package; V26's Void on that drying lot still drops both.
- V27a, weighing (1): after Reopen, the record void, the record edit, and V26's Void leave the minted package at its old qty; the next finish sets that qty to the lot's live total.
- V27a, refusals (1): unloaded, trimmed, and frozen refuse on the record void, the record edit, V26's Void, and a restore, with nothing written; children, a package that has left its space, two live packages, and a package that would go below zero refuse on the record routes in V26's words.
- V27a, not grams (1): an HBN change posted with the same weight does not move the package or the lot total and writes no qty log.

## The smoke

V27, on the console once the walk has trimmed lots on one farm only: that farm's Estimated Bud line is "at {pct}% BTR", and the other two are "at {pct}% BTR, the season's (no lot trimmed here yet)" with the same pct.

V27a, on Penn North Harvest: the pencil lowers a drying lot's 300 g tote to 250 g, the lot goes to 450 g, and the package log goes 500 g to 450 g; the pencil puts it back to 300 g so the rest of the walk still starts at 500 g. The screen Void of that drying lot then takes the package from 500 g to 200 g. After Reopen, voiding the remaining 200 g tote through the record x leaves the package unmoved and the lot at 150 g. Finish sets the package to 150 g (`inv_minted`).

The unloaded lot's old reweigh (235 g to 240 g, then Changed after upload) now refuses in the wet-closed words. The tote stays 235 g.

## Gates

Run in the worktree's `app/`.

- `npm run typecheck`: exit 0.
- `npx vitest run`: 85 files, 1158 tests passed under `TZ=UTC`, and 85 files, 1158 tests passed under `TZ=America/New_York`.
- `node --check scripts/smoke.mjs`: exit 0.
- From-zero smoke (`SMOKE_PORT=9255`, `WRANGLER_SEND_METRICS=false`, `CI=1`, `TZ=UTC`) on the final tree: About to apply 90 migration(s), SMOKE PASS, no ` 500 ` line, exit 0 (18,523 lines of log; the one ` 503 ` line is `POST /api/send`, the smoke's own asserted step). A first run, before the unloaded-lot pencil was taught to refuse, failed at that old reweigh with status 400. The passing run is the one above.
- Dash (U+2013, U+2014), CR and BOM audits by character on all 7 touched files and this report: 0. No personnel name in an added line.

## Deploy

Not deployed from this session. Nothing committed. Nothing pushed. No git was run.

## Sealed final check

```
the tree as received                  b333d595286a8b10 (283 files, migrations 0001-0090)
npm run typecheck                     exit 0
TZ=UTC npx vitest run                 85 files, 1158 tests passed
TZ=America/New_York npx vitest run    85 files, 1158 tests passed
node --check scripts/smoke.mjs        exit 0
SMOKE_PORT=9255 WRANGLER_SEND_METRICS=false CI=1 TZ=UTC npm run smoke
                                      About to apply 90 migration(s); SMOKE PASS; " 500 " lines: 0; " 503 " lines: 1 (POST /api/send); exit 0
dash audit: 0; CR audit: 0; BOM: 0; personnel data: none new
the app tree after the edits          a6a9608eb68264ff (283 files)
```

```
app/scripts/smoke.mjs                770578  bfcaa58218225ee9
TAIL });
app/src/actions.ts                   416124  a81e46a855d49b85
TAIL export { MANIFEST_COLUMNS, buckedPackageCode };
app/src/console.ts                   166111  f1feb3bd8f0d3e70
TAIL }
app/src/finishedlots.ts               28250  69473548feddacd9
TAIL }
app/src/i18n.ts                      247537  9ea51c50608c0e6c
TAIL }
app/test/console.test.ts              89814  3a7ccb72db0c4f18
TAIL });
app/test/finishedlots.test.ts         35247  b50bbd61cd08335a
TAIL });
```
