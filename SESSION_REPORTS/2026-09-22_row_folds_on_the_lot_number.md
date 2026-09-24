# 2026-09-22 The Row Folds on the Lot Number (canon 0.30.173)

Scribe-direct under G-2 (a presentation change on a live surface, small, no migration), on the LIVE floor of 0.30.172 (worker 15078f3d, migrations 0001-0067), with the tree quiet and the owner still holding "continue" to his Code session (one hand in app/, canon 0.30.165). Worker-only deploy; from-zero pin stays 67. Owner, 2026-09-22, verbatim: "on sca and csb, make the time appear after the lot number on the same line, collapsable on lot numbers".

## The law, as built

1. THE ROW FOLDS ON THE LOT NUMBER: a lot's row on CSA and CSB is a `details` element (`.cure-row`, still `data-cure-lot`). Its summary line is the lot number (`.cure-id`, bold) with the ticking time in (`.cure-clock`, `data-cure-clock`) beside it on the same line; pressing the line opens the row. Under it, in `.cure-body`: the dry pounds with the live grams, Moisture at in-time, Latest moisture with its timestamp, and the link to the lot record (`Lot record`, `/record/wet_weight_entries/<id>/edit`), which used to be the lot number itself.
2. Folded by default, so a pane reads one line per lot until a lot number is pressed. A small triangle before the lot number turns when the row is open; the browser's own marker is hidden. The clock script is unchanged and keeps ticking inside the summary.
3. Spanish speaks on the new link (`Registro del lote`). CSA and CSB, the lot number and the clock do not translate.

## What changed

- `src/cure.ts`: `lotRow` renders the details element; the doc comment carries his words.
- `src/theme.ts` (shared chrome): `.cure-row` as a folding row, `.cure-head` flex line with the triangle, `.cure-body`, `.cure-link`.
- `src/i18n.ts`: `Lot record`, EN and ES.
- `test/cure.test.ts`: the details shape, the id before the clock on the summary, the weight and the link under it, folded by default, the Spanish link.
- `scripts/smoke.mjs`: the CSA row on the console is a folded details element with the id and the time on its summary and the weight and the lot record link under it.

## Scribe assumptions (his word owed if wrong)

- Folded by default (the tile shows one line per lot); if he wants the rows open by default, the `details` gains `open`.
- The lot number is the toggle, so the link to the lot record moved under the fold as its own line.
- The time in stays the silo clock shape with seconds, right of the lot number on the same line.

## Gates

- `npx tsc --noEmit`: exit 0.
- `npx vitest run`: 44 files, 790 tests passed; the same under `TZ=America/New_York`.
- `node --check scripts/smoke.mjs`: ok.
- From-zero smoke (`SMOKE_PORT=9073`): `About to apply 67 migration(s)`, `SMOKE PASS`, no 500.
- Dash audit: 0 on every file below.

## Deploy (his hands; worker only)

```powershell
cd "C:\Users\DennisWallace\Documents\Claude\Projects\gripfactory Practical\app"
npm run deploy:grip
```

## Sealed final check

```
npx tsc --noEmit                      exit 0
npx vitest run                        44 files, 790 tests passed
TZ=America/New_York npx vitest run    44 files, 790 tests passed
node --check scripts/smoke.mjs        ok
rm -rf .smoke-persist && SMOKE_PORT=9073 WRANGLER_SEND_METRICS=false timeout 285 npm run smoke
                                      About to apply 67 migration(s); SMOKE PASS; " 500 " lines: 0 (exit 124, the timeout's, as always)
src/cure.ts                 16677  314f01b9e8559fa0
src/theme.ts               152088  49fbc33ac35ff959
src/i18n.ts                140297  e1e41cc82c7c2fbc
test/cure.test.ts           10766  881134e0ec25cec5
scripts/smoke.mjs          515548  1e8f49f01c13c045
dash audit: 0 on every file above
```
