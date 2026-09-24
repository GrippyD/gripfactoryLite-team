# 2026-09-21 The Deeper Bud (canon 0.30.160)

Scribe-direct under G-2 (a data change to the bud waffle's cell map, two files, no migration), on the LIVE floor of 0.30.156 (worker 90dd775a, migrations 0001-0065), over the pending 0.30.158 and 0.30.159. Worker-only deploy; from-zero pin stays 65; next free migration 0066. Owner, 2026-09-21, with his third bud drawing (white and black bands added inside the violet ring, around a dark green center of ten), verbatim: "Hang on, I added gradients, I was looking at the numerator, not the denominator when I answered your BTR question.  ROYGBIV, then White, then black please.  We'll have BTRs as low as 15% I imagine".

## The law, as built

THE DEEPER BUD: the bud's 100 cells are his third drawing, read by the Scribe's extractor (18 rows by 7 columns on a 28 px grid): ten bands of ten, consumed in his order: red, orange, yellow, light green, blue, indigo, violet, then white, then black, then the dark green center last; within a band top to bottom, left to right. Everything else of THE BUD WAFFLE (0.30.159) stands: one cell per percent of the shift total, bud green until consumed, the quiet grey after, outlines when nothing ran, the drawing's colors never rendering. A 15% BTR (85 consumed) now leaves the center and half the black band green; the bud reads down to 0%.

The extractor (`bud_map.py`, the Scribe's scratchpad) grew for this drawing: grid lines as thin dark peaks (a black cell's body never reads as a line), a cell exists where its center is not the page (the near-white region flooded from the image corners, which the drawn borders keep out of every cell, white cells included), white and black classified as bands. Read back against his first two drawings it gives the same 90 and 100 cells as before.

## What changed

- `src/console.ts`: `BUD_CELLS` replaced by the third drawing's map (BUD_ROWS 18, BUD_COLS 7 unchanged; the ten bands); the doc comments carry his words.
- `test/console.test.ts`: the map test reads ten bands of ten and pins white at index 70, black at 80, center at 90.
- `BRIEFS/2026-09-21_bud_waffle.md`: a note at the top that its map is superseded by the code's constants.
- `scripts/smoke.mjs` is untouched: the consumed counts (40, 69, 0) do not depend on the map.

## Scribe assumptions (his word owed if wrong)

- "ROYGBIV, then White, then black" names the consumption order of the new bands; the center (dark green) stays last, as before.
- His BTR denominator pick (grams weighed plus the WIP left, 0.30.154) stands; the words about the numerator explain the deeper drawing, not a change of the law.
- The drawing's white and black, like its other colors, never render; every cell is bud green or consumed grey.

## Gates

- `npx tsc --noEmit`: exit 0.
- `npx vitest run`: 42 files, 771 tests passed; the same under TZ=America/New_York.
- `node --check scripts/smoke.mjs`: ok.
- From-zero smoke (SMOKE_PORT=9065): `About to apply 65 migration(s)`, `SMOKE PASS`, no 500.
- A rendered look at 15.0% BTR: fifteen cells green (the center of ten and the last five black), the rest grey.
- Dash audit: 0 on every file below.

## Deploy (his hands; worker only; carries 0.30.158, 0.30.159 and this)

```powershell
cd "C:\Users\DennisWallace\Documents\Claude\Projects\gripfactory Practical\app"
npm run deploy:grip
```

## Sealed final check

```
npx tsc --noEmit                      exit 0
npx vitest run                        42 files, 771 tests passed
TZ=America/New_York npx vitest run    42 files, 771 tests passed
node --check scripts/smoke.mjs        ok
rm -rf .smoke-persist && SMOKE_PORT=9065 WRANGLER_SEND_METRICS=false timeout 285 npm run smoke
                                      About to apply 65 migration(s); SMOKE PASS; " 500 " lines: 0

src/console.ts              65734  f21ff4522684a91e
test/console.test.ts        39700  07ec91af2c7a9a67
dash audit: 0 on every file above
```
