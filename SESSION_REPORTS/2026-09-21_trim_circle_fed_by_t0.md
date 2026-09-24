# 2026-09-21 The Circle Is Fed by T-0 (canon 0.30.158)

Scribe-direct under G-2 (a correction to a live surface, small: four files, no migration), on the LIVE floor of 0.30.156 (worker 90dd775a, migrations 0001-0065). Worker-only deploy; from-zero pin stays 65; next free migration 0066. Owner, 2026-09-21, verbatim: "on the dashboard, I misunderstood your question.  The "trim circle" is being fed by the T-0, not feeding it.  The "other" weight is "trim", not retrim.  I don't know how to handle retrim yet".

## The law, as corrected (THE TRIM LINE PICTURE, canon 0.30.154)

1. THE CIRCLE IS FED BY T-0: the bar between T-0 and the TRIM circle flows up, out of T-0 (a third stripe pattern, `hc-flow-up-<shift>`, animating y from 0 to -20 at the same 900 ms while the line runs); the bar is `data-hc-flow="t0-trim"`.
2. THE CIRCLE CARRIES THE REST OF OTHER: the TRIM stream, the WIP left in the packages the shift finished, and every other type (MIX, KIEF, WASTE, unknown), the figure RETRIM carried before. BIO keeps the BIO stream; BUD keeps the Total Bud.
3. RETRIM CARRIES NO FIGURE: the label alone, centered, until he says how retrim is handled.
4. T-0 CARRIES THE INPUT: under the grams weighed and the package count, "input 12.50 lb" once typed (muted "input lbs" until then), as the total run through T-0.
5. THE LINES CONVERGE FROM BIO, BUD AND TRIM: the TRIM circle's line leaves its right edge, runs down the right margin and joins the horizontal at the bottom; the junction and the shift total sit under the middle of the picture (x 520). RETRIM's line is gone with its figure.

## What changed

- `src/console.ts`: `trimLinePicture` (the up pattern, the `t0-trim` bar, the circle's figure, T-0's input line, RETRIM's label alone, the converging lines and the total's place); the doc comment carries his correction verbatim.
- `src/i18n.ts`: "input" (EN, ES "entrada").
- `test/console.test.ts` and `scripts/smoke.mjs`: the pins follow (the up bar and its animate element, the circle's grams, `t0-input`, no `retrim` value, the new line points, the total at x 520).

## Scribe assumptions (his word owed if wrong)

- The input pounds belong on T-0 (the machine they ran through) now that the circle is an output.
- The TRIM circle's figure includes the WIP left and the other types beside the TRIM stream (the whole rest of Other, so Total Bud + BIO + TRIM = the shift total the lines hang).
- The circle's converging line runs down the picture's right margin rather than through T-0.

## Gates

- `npx tsc --noEmit`: exit 0.
- `npx vitest run`: 42 files, 769 tests passed; the same under TZ=America/New_York.
- `node --check scripts/smoke.mjs`: ok.
- From-zero smoke (SMOKE_PORT=9063): `About to apply 65 migration(s)`, `SMOKE PASS`, no 500.
- A rendered look (headless Chromium, the continuum stylesheet): the circle reads its grams over the up-flowing bar, T-0 its three lines, RETRIM its label alone, the three lines meeting under the middle.
- Dash audit: 0 on every file below.

## Deploy (his hands; worker only)

```powershell
cd "C:\Users\DennisWallace\Documents\Claude\Projects\gripfactory Practical\app"
npm run deploy:grip
```

## Sealed final check

```
npx tsc --noEmit                      exit 0
npx vitest run                        42 files, 769 tests passed
TZ=America/New_York npx vitest run    42 files, 769 tests passed
node --check scripts/smoke.mjs        ok
rm -rf .smoke-persist && SMOKE_PORT=9063 WRANGLER_SEND_METRICS=false timeout 285 npm run smoke
                                      About to apply 65 migration(s); SMOKE PASS; " 500 " lines: 0

src/console.ts                  61035  86c8ad844a24e552
src/i18n.ts                    133083  de536f9b0addfe39
test/console.test.ts            34448  c3aab0be98a9f95e
scripts/smoke.mjs              503503  6d9c155e5040e63a
dash audit: 0 on every file above
```
