# 2026-09-17 The Duplicate Tag Is Cryo Only (canon 0.30.114)

Scribe sitting, built Scribe-direct under G-2, on the LIVE floor of 0.30.113 (worker ae0fa48f, migrations 0001-0059). Owner rulings 2026-09-17, verbatim:

"The go/no-go package dupe check needs to be removed from Trim, that's a cryo phenomenon.  A package is Id'd by its HBN until the cryo step."

"leave it how it was, that's what I mean.  It didn't need anything"

This corrects the third of the four 0.30.112 Scribe assumptions (that the duplicate guard also rides the Trim Packages Entry line). Worker-only; no migration. From-zero pin stays 59; next free migration 0060.

## The law, as built

1. THE TRIM LINE IS AS IT WAS. Trim Packages Entry renders exactly as it did at 0.30.111: no duplicate-tag warning line, no guard script on the plus, no `data-entered-tag` on its entered rows, and its over-issue confirm as before. The trim server never refused a duplicate code (THE TAG LAW keeps a typed code as typed and marks it); nothing on the server changed.
2. THE GUARD IS CRYO'S. The duplicate-tag warning and the go/no-go on the plus ride the Cryo Weight Entry line alone, where the scanned tag IS the METRC package. The cryo page is unchanged from 0.30.112 in markup and behavior.
3. THE WORD. A package is identified by its HBN until the cryo step; the trim containers are the HBN's weight by type, not identities of their own.

## What changed

- `src/html.ts`: the trim `package_rows` renderer drops `duplicateTagGuard` and the `defaultPrevented` line (its script is the 0.30.111 script); `trimEnteredList` rows drop `data-entered-tag`; the guard's doc names the cryo-only ruling.
- `src/cryo.ts`: the header records the ruling; no code change.
- `test/metrc.test.ts`: the trim pins restored (rows as `data-package="pk1">` and `data-package="pk2" data-tag-shape="off"`) with two negatives (no `data-dup-tag-warning`, no `data-entered-tag` on the trim page).
- `scripts/smoke.mjs`: the trim cluster's guard pins replaced by the negative; the cryo cluster's guard pins stand.

## Gates

- `npx tsc --noEmit`: exit 0.
- `npx vitest run`: 34 files, 697 tests passed; the same under TZ=America/New_York.
- `node --check scripts/smoke.mjs`: ok.
- From-zero smoke (SMOKE_PORT=9016): `About to apply 59 migration(s)`, `SMOKE PASS`, no 500 in the log.
- Visual: a removal of a hidden line and a script from the trim page; the trim markup is byte-identical in shape to 0.30.111 and the cryo page is untouched, so no new screenshots were taken.
- Dash audit: 0 on every file below.

## Deploy (his hands, worker only)

```powershell
cd "C:\Users\DennisWallace\Documents\Claude\Projects\gripfactory Practical\app"
npm run deploy:grip
```

## Sealed final check

```
npx tsc --noEmit                      exit 0
npx vitest run                        34 files, 697 tests passed
TZ=America/New_York npx vitest run    34 files, 697 tests passed
node --check scripts/smoke.mjs        ok
rm -rf .smoke-persist && SMOKE_PORT=9016 WRANGLER_SEND_METRICS=false timeout 285 npm run smoke
                                      About to apply 59 migration(s); SMOKE PASS

src/html.ts             173015  0c151eb861d254a8
src/cryo.ts              21299  3df6d69804134812
test/metrc.test.ts       38812  169ba650e70b8261
scripts/smoke.mjs       413076  bceba8486a1ac63c
dash audit: 0 on every file above
```
