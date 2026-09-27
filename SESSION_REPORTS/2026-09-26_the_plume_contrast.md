# 2026-09-26 The plume's contrast (canon 0.30.245)

Scribe session, Scribe-direct under G-2 on the quiet tree (the fix gate's tree b540c42a8d9d403a, LIVE at 99d0c693 and again at e9882719; no build session in it). No migration; the head stays 0075. Not deployed.

## The ruling

His word on the product line once it was live, verbatim: "Okay, I like it but now there's not enough contrast between goal and actual, thoughts?" The Scribe's reading: the waste green sat too close to the bud green of the product left (1.90 to 1 in Lite, 1.77 to 1 in Cerberus, under the 3 to 1 a graphic needs to read), and the legend named only bud and consumed. Three looks went to him in a preview at 25% BTR (as live, A a deeper green, B hollow squares); his pick on the question tool, verbatim: "A: deeper green".

## What changed

- `src/theme.ts`: the waste cell `.hc-bud-consumed[data-hc-bud-waste]` draws `#0f3d1f` in Lite and Continuum (3.58 to 1 against the bud green, 6.23 against the byproduct grey) and `#166534` in Cerberus (3.51 against its bud green); a `.hc-swatch-waste` in each skin in the same color.
- `src/console.ts`: the plume's legend reads bud, byproduct, waste (the grey swatch was "consumed"); the comment on `budWaffle` carries the ruling.
- `src/i18n.ts`: `byproduct` (Spanish `subproducto`) and `waste` (`desperdicio`); `consumed` stays in the table.
- `test/console.test.ts`: the three legend expectations (English twice, Spanish once) and the product line test's colors, with the waste swatch pinned in every skin.
- `scripts/smoke.mjs`: the Spanish legend check reads `subproducto` and `desperdicio` where it read `consumido` (the first smoke run failed on exactly that line and nothing else).

The cells, their order, the counts, the labels and every other rule are as they were.

## Gates

- `npx tsc --noEmit`: exit 0.
- `npx vitest run`: 56 files, 907 tests passed; the same under `TZ=America/New_York`.
- `node --check scripts/smoke.mjs`: ok.
- From-zero smoke (`SMOKE_PORT=9170`): `About to apply 75 migration(s)`, `SMOKE PASS`, no ` 500 ` line; exit 0 once the dev server was ended by pid.
- Dash audit 0 and no CR byte on the five files; secret grep: no matches.
- Preview of the final look (Lite and Cerberus at 40%, 31% and 15% BTR, with the legend): `RESEARCH/scribe/pending/plume_contrast_final.png` (gitignored).

## Deploy (his hands; worker-only, no migration rides)

```powershell
cd "C:\Users\DennisWallace\Documents\Claude\Projects\gripfactory Practical\app"
npm run deploy:grip
```

## Sealed final check

```
npx tsc --noEmit                      exit 0
npx vitest run                        56 files, 907 tests passed
TZ=America/New_York npx vitest run    56 files, 907 tests passed
node --check scripts/smoke.mjs        ok
rm -rf .smoke-persist && CI=1 SMOKE_PORT=9170 WRANGLER_SEND_METRICS=false npm run smoke
                                      About to apply 75 migration(s); SMOKE PASS; " 500 " lines: 0; exit 0
src/console.ts                                101103  61a2ba38f5cd4e8d  tail: }
src/theme.ts                                  154350  1c52c797702f7c8a  tail: }
src/i18n.ts                                   175794  986e8098bec7a16c  tail: }
test/console.test.ts                           57942  ccb2f07d92982de5  tail: });
scripts/smoke.mjs                             596084  605cb23d019ddfd6  tail: });
tree listing after the change: 217 files, sha256 a688b16f08bcdaee
dash audit: 0; secret grep: no matches
```
