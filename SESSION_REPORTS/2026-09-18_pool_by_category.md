# 2026-09-18 The Pool By Category (canon 0.30.121)

Scribe sitting, built Scribe-direct under G-2, on the LIVE floor of 0.30.120 (worker 6f3e3476, migrations 0001-0060). Owner ruling 2026-09-18, with a screenshot of the 26011 run's pool table (BUD 194,385.00 in, BUD 192,457.00 out, Total 194,385.00 / 192,457.00, Remaining 1,928.00), verbatim:

"here is the surface that should show the available weight in each category, so the TL in cryo knows they're not over-issuing one particular product category."

This answers the first of the 0.30.112 Scribe assumptions (one pool, in by type and out by category): the pool is per category. Worker-only; no migration. From-zero pin stays 60; next free migration 0061.

## The law, as built

1. ONE ROW PER CATEGORY. The pool table at the top of Cryo Weight Entry reads Category, In (g), Out (g), Remaining (g): one row per product category in the type list's order (BUD, WPR, SHA), the category named with the trim types that read as it muted beside it where they differ (WPR SMALLS; SHA SHAKE), In the grams the run took in under those types, Out the grams entered under the category, Remaining the difference, the category's available weight. A category entered with no type behind it (a line off the list) lists after them with 0 in and a negative remaining; two types reading as one category share its row. The Total row closes the table (In, Out, Remaining summed); a run with no containers reads "No containers in the pool.".
2. THE PLUS ASKS PER CATEGORY. The over-issue guard on the plus reads the picked category's row (data-pool-remaining) and asks in words ("This weight over issues the pool for its category. Record it anyway?" / "Este peso sobregira el pool de su categoria. Registrarlo de todos modos?") past half a cent over that category's remaining; a category with no row has nothing to draw on and asks at any weight. THE OVERISSUE LINE IS STRICT stands: flag, never block; the server refuses nothing on weight.
3. THE PHONE. On a phone the pool table keeps its four columns inside the frame at a tighter size, the type note dropping under its category, so Remaining is never off the edge.

## What changed

- `src/db.ts`: CryoPool is `{ lines }` of `{ category_code, type_codes, in_grams, out_grams }`; `foldCryoPool` (pure) folds the run's inputs by type and outputs by category into the lines in the type list's order; listCryoRunPool reads the two sums and folds.
- `src/cryo.ts`: `poolView` (remaining per line), `poolTotals` over the lines; `poolTable` renders the four-column table with `data-pool-category`, `data-pool-types`, `data-pool-in`, `data-pool-out`, `data-pool-remaining` on each row and the Total row; the plus guard reads the picked category's row.
- `src/theme.ts`: the phone rules for `.cryo-pool`.
- `src/i18n.ts`: the category over-issue question (EN, ES); "No containers in the pool.".
- Tests: `test/cryo.test.ts` (poolView and poolTotals; foldCryoPool on his 26011 numbers with a WPR out, on two types sharing a category, on a category with no type and a type off the list; the table markup, order, Total row and the guard; the Spanish header); `test/metrc.test.ts`, `test/trim.test.ts` (the fixture shape).
- `scripts/smoke.mjs`: the pool pins read the rows (BUD 100 in / 0 out / 100 remaining; BUD 88.25 out / 11.75 remaining; a WPR line with no SMALLS in the run reading 0 in, 5 out, -5 remaining and listing after BUD; the type-pool run's BUD 50 and WPR SMALLS 5 rows; the Total row; the Spanish header; the guard's selector and words).

## Rehearsal on his floor

A local D1 built with all 60 migrations, the 17th's snapshot loaded and brought to this morning's floor (the Silo 1 repair and 0060's move), a dev server on the copy: the live 26011 BUD run read one row (BUD 194,385.00 in; the copy predates today's outs); a >> on 26018 made a run reading BUD 47,606.00, WPR SMALLS 43,309.00, SHA SHAKE 2,149.00, Total 93,064.00; three lines entered on it (BUD 40,000, WPR 41,000, SHA 2,149) read BUD 7,606.00, WPR 2,309.00 and SHA 0.00 remaining with the Total row 93,064.00 / 83,149.00 / 9,915.00, in lite and cerberus; the phone view at 420 kept all four columns in the frame (the table 382 wide in a 420 frame, no horizontal scroll). The server was killed and the persist directory removed.

## Scribe assumptions (his word owed if wrong)

- A category with no containers of its type in the run still lists once a line is entered under it, with 0 in and a negative remaining (the guard asked first).
- The rows follow the type list's order (BUD, WPR, SHA); a category off the list lists after them.
- The Total row stays as the closing line under the per-category rows.

## Gates

- `npx tsc --noEmit`: exit 0.
- `npx vitest run`: 34 files, 698 tests passed; the same under TZ=America/New_York.
- `node --check scripts/smoke.mjs`: ok.
- From-zero smoke (SMOKE_PORT=9027): `About to apply 60 migration(s)`, `SMOKE PASS`, no 500 in the log.
- Visual pass: the 26018 run with three categories and their outs in lite and cerberus; the phone at 420 with all four columns in the frame.
- Dash audit: 0 on every file below.

## Deploy (his hands, worker only)

```powershell
cd "C:\Users\DennisWallace\Documents\Claude\Projects\gripfactory Practical\app"
npm run deploy:grip
```

## Sealed final check

```
npx tsc --noEmit                      exit 0
npx vitest run                        34 files, 698 tests passed
TZ=America/New_York npx vitest run    34 files, 698 tests passed
node --check scripts/smoke.mjs        ok
rm -rf .smoke-persist && SMOKE_PORT=9027 WRANGLER_SEND_METRICS=false timeout 285 npm run smoke
                                      About to apply 60 migration(s); SMOKE PASS

src/db.ts                 152913  8898a3765d1b00f4
src/cryo.ts                23347  2116fa4798433316
src/theme.ts              141663  7293f38c95f5c7e8
src/i18n.ts               119882  e343349e5bf964b0
test/cryo.test.ts          25549  ae5bec9d0a0e299d
test/metrc.test.ts         38833  9549364dc7c3d580
test/trim.test.ts          14013  8bfe5e870be3aebb
scripts/smoke.mjs         424785  a41b0963325138a7
dash audit: 0 on every file above
```
