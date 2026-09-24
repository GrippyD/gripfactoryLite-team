# Session report: the duplicate-lot guard (wet station), 2026-09-01

**Scribe:** Gripfactory Lite Scribe (Cowork), Scribe-direct build under G-2.
**Trigger:** Dennis's live report during team alphas, verbatim: "on the weightless HBNs, the queue shows two, but the page shows the same header data regardless of which one I choose. The weightless HBNs cited on the Acquire page only lists one. So I'm assuming there's weight recorded but the sequence demands the header before it shows that. Meaning that if what the user was fixing was a weight, they might screw up re-entering the header data on the second pass and create an unforced failure mode."

## Reproduction verdict (before any edit)

Seeded a dev server and walked the exact scenario: two batches in the pane, one carrying a weighing lot with weights. Pick switching itself was sound in the deployed build: the two pane links carry distinct hrefs, each pick renders its own HBN heading, and the in-progress lot renders as a resume link above the form. The reported "same header data regardless of which one I choose" could not be produced from the server; the most likely culprit is browser caching, since our HTML went out with no cache-control at all and a floor tablet re-showing a cached pick page would look exactly like this. The failure mode Dennis named is real regardless: a picked batch with an in-progress lot still led with a blank Start-lot header, so a crew member returning to fix a weight was invited to re-enter header data and mint a duplicate lot.

## The law shipped

1. **No stale pages.** Every HTML response now goes out `cache-control: no-store` (the html() helper in src/index.ts). Brand assets keep their public hour; the SalesHelper app page already sent no-store.
2. **A pick lands on the work in progress.** GET `/station/wet_weight?pick=<batch>` with exactly one weighing lot 302-redirects to `?lot=<that lot>`. The blank header returns only on purpose: `?new=1` (the Start another lot path) or a staged `?truck=` (the add-truck flow), which both set `newFormOpen` and render the form open.
3. **The header form hides behind intent.** On a pick view with any lots in progress and no `newFormOpen`, the header form (and its add-truck sibling) collapses into `<details class="start-another">` labeled **Start another lot**; the resume list leads. Zero lots renders the plain form byte for byte as before.
4. **The lot panel carries the one deliberate way back.** wetLotPanel now takes the lot's `harvest_batch_id` (getLot already selected it) and renders `<a class="secondary" href="/station/wet_weight?pick=<batch>&new=1">Start another lot</a>` under the weights section.
5. **i18n:** "Start another lot" / "Iniciar otro lote".

## Files changed

- `app/src/index.ts`: no-store on html(); the single-lot 302 and `newFormOpen` in the wet pick branch.
- `app/src/html.ts`: `StationLedgerCtx.newFormOpen?`; the collapsed details form block in stationPage; the Start another lot link in wetLotPanel (+ `harvest_batch_id?` on its lot param).
- `app/src/i18n.ts`: the "Start another lot" entry.
- `app/test/surface.test.ts`: five new tests: collapse at 2 lots, open at `newFormOpen`, plain at zero, the panel link with `new=1`, the panel without a batch id.
- `app/scripts/smoke.mjs`: a guard section appended before PASS on the reminted 26004 batch: fresh pick 200 with no-store header and no collapse; start lot; re-pick 302 onto `?lot=`; lot panel carries the link; `?new=1` renders the open form with the resume list; a staged `?truck=` does not bounce and preselects Truck 1; a second lot renders 200 with the collapsed details and both resume links.

No migrations. No schema change. Worker-only deploy.

## Sealed final check

```
cd /home/claude/deploy/app
npx tsc --noEmit                      -> exit 0
npx vitest run                        -> Test Files 9 passed (9), Tests 292 passed (292)
node --check scripts/smoke.mjs        -> ok
LC_ALL=C grep -c $'\xe2\x80\x94\|\xe2\x80\x93' src/html.ts src/index.ts src/i18n.ts test/surface.test.ts scripts/smoke.mjs
                                      -> 0 0 0 0 0
rm -rf .smoke-persist && SMOKE_PORT=8951 WRANGLER_SEND_METRICS=false timeout 280 npm run smoke
                                      -> SMOKE PASS (exit 124 is the expected dev-server timeout kill)

src/index.ts          35727 bytes  sha256:76640c1411868012
src/html.ts           59214 bytes  sha256:96e7c5e3419fe9c8
src/i18n.ts           15725 bytes  sha256:fb357fe6e6ca054e
test/surface.test.ts  59926 bytes  sha256:95141174a8c8d4c3
scripts/smoke.mjs     89908 bytes  sha256:c1e670e475543673
```
