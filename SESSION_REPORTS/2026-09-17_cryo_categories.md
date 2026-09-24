# 2026-09-17 The Cryo Categories (canon 0.30.112)

Scribe sitting, built Scribe-direct under G-2, on the LIVE floor of 0.30.111 (worker 3f50d7aa, migrations 0001-0058). Owner rulings 2026-09-17, verbatim, in the order they landed:

"in cryo weight entry, add the product categories:

1. WPR
2. BUD
3. SHA"

"Cryo weights should be listed beneath the entry surface (just like trim), the plus line should ratify what's in the entry fields and reset the fields to null.  Keep the running package total and how much is left in the parent at the top (same as trim
)"

Then, of the totals: "sorry, looks like totals are already correct".

"When a hard entered (under the entry surface) tag number is scanned into the entry surface a warning (in the language selected at the pill) warns the user of a duplicate tag and doesn't allow it to proceed."

His pick at the one fork put to him (the New Packages file's Item Name and Same Item per category): "Same Item yes, as built".

This slice ships WITH migration 0059. From-zero pin 59; next free migration 0060.

## The law, as built

1. THE CATEGORIES. A cryo line is entered under a product category, not a trim package type. The categories are a value in data (canon L-4): app_config `cryo_product_categories`, seeded `WPR,BUD,SHA` by migration 0059 in his order, editable in Admin, Lookups, app_config; blank falls back to the same three. The line's Category box lists them in that order with a blank first choice and requires a pick; the server refuses a blank ("Pick the product category.") and a code off the list ("That product category is not on the cryo list."), case folded on the way in (wpr lands as WPR). The category is stored as the output package's type code, so the Testing queue, the entered list, the Inventory sheet and the ledger read WPR, BUD or SHA on the new package. Only is_bud trim types reach the Cryo Queue, so the pool is bud trim; a line of any category draws from the run's pool as a whole, and the per-type Out of 0.30.110 is gone.
2. THE POOL AT THE TOP. The pool table stays first in the working pane and keeps his totals: in by trim type on the left, out by product category on the right, row for row; a Total under each side; Remaining (in minus out) as the last line. The over-issue line reads the pool's total remaining: past half a cent it asks in words ("This weight over issues the pool. Record it anyway?") and never refuses.
3. THE PLUS. The plus posts the line and the page comes back with the tag, the category and the weight blank (the Operator stays filled from the last line, the Effective Date stays where it was set); the entered packages list beneath the entry surface, newest first, with the reasoned pencil and void behind the PIN, the Category column in place of Type.
4. THE DUPLICATE TAG. Every entered row carries its tag (data-entered-tag, upper-cased). As a tag is typed or scanned into the line, the box is read against those rows, case folded: a match shows the warning line in the pill's language ("That tag is already entered beneath. Scan a different package." / "Esa etiqueta ya esta ingresada abajo. Escanee otro paquete."), marks the box invalid, and the plus does not post (a scanner's Enter clicks the same button; the guard runs in the capture phase ahead of the over-issue confirm); focus returns to the tag box with its text selected so the next scan overwrites. A fresh tag clears the warning and the plus posts. The server's own refusal ("That package tag is already in use.") stays behind it. The same guard rides the Trim Packages Entry line, whose entered rows carry the same attribute (the trim line is the idiom cryo replicates).
5. THE VOID OF A CRYO OUTPUT. Found while pinning the WPR line in the smoke: voiding a cryo output returned its grams to the HBN's harvest package, grams the output never drew (its grams came out of the run's pool). The void now returns nothing to the harvest package for a package whose source is cryo; the output's ledger row is voided as before and the pool's Out drops with it.
6. THE FILE. The New Packages file is unchanged by his pick: Same Item yes on every row, Item Name blank; the category lives in the app.

## What changed

- `migrations/0059_cryo_product_categories.sql` (new): app_config cryo_product_categories = WPR,BUD,SHA.
- `src/config.ts`: CONFIG_KEYS.cryo_product_categories; CRYO_CATEGORIES_DEFAULT; parseCryoCategories.
- `src/db.ts`: CryoPool { types: in by type; outs: out by category }; listCryoRunPool reshaped; listCryoCategories.
- `src/cryo.ts`: CRYO_REFUSAL.category and categoryOutsideList (typeOutsidePool retired); poolTotals; the paired pool table with Total and Remaining; the category box (blank first, required, data-cryo-category); the over-issue guard on the pool's total; the entered list's Category column and data-entered-tag rows; the duplicate-tag guard on the line.
- `src/html.ts`: duplicateTagGuard(locale) (the warning line and the script, DOMContentLoaded-safe, capture phase); the trim line carries it, its over-issue confirm stands down when the default is prevented; trim's entered rows carry data-entered-tag.
- `src/actions.ts`: addCryoOutput validates the category against the list (no pool-type check); voidRecord returns nothing to the harvest package for a cryo output.
- `src/index.ts`: the cryo page receives the categories.
- `src/i18n.ts`: the line's words, the over-issue and duplicate warnings, the two refusals (EN, ES).
- Tests: `test/cryo.test.ts` (the parser and its default, the pool totals with a WPR line drawing from the bud pool, the paired table markup, the category box in his order, the guard markup in EN and ES, the entered list beneath the entry surface, the refusals); `test/metrc.test.ts` and `test/trim.test.ts` repointed (the pool shape, the entered rows' tags, the trim line's warning).
- `scripts/smoke.mjs`: pin 59; the cryo cluster reads the paired pool (100 in, 0 out, 100 remaining; BUD 88.25 out, 11.75 remaining), the category box, the guard markup in EN and in the pill's Spanish, the two category refusals, a WPR line (5.00 g, typed lower case) drawing from the bud pool to 93.25 out and 6.75 remaining and voided back out with a reason to 88.25, the entered rows' tags and their place beneath the entry surface; the trim cluster pins the same guard and the rows' tags.

## Scribe assumptions (his word owed if wrong)

- Every category draws from the pool as one pool (the pool is bud trim by the is_bud routing law); the pool table shows in by type and out by category rather than a per-type Out.
- The Operator keeps its value from the last line after the plus; "the entry fields" that reset are the line's tag, category and weight.
- The duplicate guard also rides the Trim Packages Entry line (the idiom cryo replicates), reading the entered rows on that page.
- WPR, BUD, SHA are stored as the output's type code as typed (upper-cased), not mapped onto trim types (his 0.30.88 "WPR means SMALLS" was the BTR's reading of trim types, not this).

## Gates

- `npx tsc --noEmit`: exit 0.
- `npx vitest run`: 34 files, 697 tests passed; the same under TZ=America/New_York.
- `node --check scripts/smoke.mjs`: ok.
- From-zero smoke (SMOKE_PORT=9015): `About to apply 59 migration(s)`, `SMOKE PASS`, no 500 in the log.
- Visual pass: the Cryo Weight Entry page with a picked run carrying BUD, WPR and SHA lines (the paired pool, the blank category box, the entered packages beneath, Finish run) in lite, cerberus and co; the phone at 420px with no horizontal scroll; the Pasteurization station in cerberus.
- Browser probe of the guard (chromium, the lite page): a duplicate typed lower case shows the warning, marks the box invalid, the plus click and the Enter key do not post, the plus stays enabled, focus returns to the tag box; a fresh tag hides the warning and the plus posts.
- Dash audit: 0 on every file below.

## Deploy (his hands, WITH migration 0059)

```powershell
cd "C:\Users\DennisWallace\Documents\Claude\Projects\gripfactory Practical\app"
npx wrangler d1 execute gripfactory-lite-grip-20260914 --env grip --remote --command "SELECT 1"
npx wrangler d1 migrations apply gripfactory-lite-grip-20260914 --env grip --remote
npm run deploy:grip
```

## Sealed final check

```
npx tsc --noEmit                      exit 0
npx vitest run                        34 files, 697 tests passed
TZ=America/New_York npx vitest run    34 files, 697 tests passed
node --check scripts/smoke.mjs        ok
rm -rf .smoke-persist && SMOKE_PORT=9015 WRANGLER_SEND_METRICS=false timeout 285 npm run smoke
                                      About to apply 59 migration(s); SMOKE PASS

migrations/0059_cryo_product_categories.sql      889  32c503174f63e86e
src/config.ts                                  48610  d0977b5d5e0d5c8a
src/db.ts                                     150196  ee43960f5c5be216
src/cryo.ts                                    21077  966e31d3b088e123
src/html.ts                                   172769  9aba9f95a7ef122f
src/actions.ts                                254251  f1e0694ef89622c4
src/index.ts                                  110227  f0000e4f12b19021
src/i18n.ts                                   119484  e796f5cb3599381c
test/cryo.test.ts                              22546  644e701e60f5bd16
test/metrc.test.ts                             38746  0cb2eda363e34df5
test/trim.test.ts                              13992  a585f537f0c746e8
scripts/smoke.mjs                             413167  b025cbe751ae8a5f
dash audit: 0 on every file above
```
