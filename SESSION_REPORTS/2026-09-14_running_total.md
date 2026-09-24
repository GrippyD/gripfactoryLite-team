# Session report: THE RUNNING TOTAL UNDER NOTES (canon 0.30.60), Scribe-direct, 2026-09-14

**Scribe:** Gripfactory Lite Scribe (Cowork), Scribe-direct under G-2. A worker-only slice, no migration, the third of the beta floor's first day.

## The owner, verbatim

"Add the running total weight under "NOTES" in wet weight entry"

then, mid-build: "in grams and lbs"

## The law

On the Wet Weight lot panel the running total of the lot's live weights reads in the lot's own meta list, directly under Notes, as `Running total: <grams> g · <pounds> lb`, pounds at 453.59237 g per pound (the compliance module's `formatLbs`, the same conversion METRC-facing weights use; not the Zoho market convention of 448). It updates with every weight added, edited or voided, like the total at the bottom, which stays where the ruling of 2026-08-28 put it (outside the weights pane, under the list). The value is display only, with commas and two decimals (the 2026-08-31 law), and no raw number rides a data attribute.

## What shipped

- `src/html.ts`: `wetLotPanel` adds `<dt>Running total</dt><dd class="lot-running-total" data-lot-running-total><strong>g</strong> g · <strong>lb</strong> lb</dd>` after Notes; imports `formatLbs` from `./compliance`.
- `src/i18n.ts`: "Running total" (ES "Total acumulado").
- `test/surface.test.ts`: the new case (6,000 g reads 13.23 lb; 1,000.06 g reads 2.20 lb; an empty lot 0.00 and 0.00; the bottom total still present) and the 2026-08-28 case now names the bottom line (`Total: <strong>1,234.56`) when it checks that the total sits after the pane, since the running total now reads above it as well.

## Sealed final check

```
npx tsc --noEmit -> 0
npx vitest run -> 23 files, 561 tests passed (560 + 1)
rm -rf .smoke-persist && SMOKE_PORT=8831 WRANGLER_SEND_METRICS=false timeout 285 npm run smoke
  -> "About to apply 44 migration(s)", SMOKE PASS (exit 124 is the teardown hang)
Visual pass (static render of wetLotPanel with the Grip stylesheet, chromium screenshot of
  .working-pane): RUNNING TOTAL 16,912.75 g · 37.29 lb under NOTES; the numbered weights
  and the bottom Total 16,912.75 g unchanged.
Dash audit (html.ts, i18n.ts, surface.test.ts, this report) -> 0 each
Committed, staged back, sha256 equal both sides:
  src/html.ts             39c3caca11a86444  158,590 bytes
  src/i18n.ts             7d49bffd1b5ebba0  101,366 bytes
  test/surface.test.ts    a5b70c85d8f87f8f   77,233 bytes
Migrations 0001-0044 unchanged; smoke pin 44; next is 0045.
Deploy: worker only (npm run deploy:grip) at the owner's hands; the version id lands in the
  LIVE row that follows. Live underneath at writing: worker fadf01f1.
```

## Flags

The first test of the slice carried the raw total in a data attribute and tripped the display-only commas law of 2026-08-31 (`not.toContain("1234.56")`): the attribute is now a bare marker. A middle dot separates grams from pounds; it is not a dash.
