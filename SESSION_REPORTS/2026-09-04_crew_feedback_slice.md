# Session report: the crew-feedback slice (canon 0.22.0), Scribe-direct, 2026-09-04

**Scribe:** Gripfactory Lite Scribe (Cowork), Scribe-direct under G-2, built live during the owner's walk of worker b37b75c9. Seven rulings and reports landed across the sitting; everything below shipped as ONE slice with one migration, 0026.

## What shipped (each ruling verbatim in canon 0.22.0)

1. **The market strain law**: `harvest_batches.market_strain` (0026); an optional Market Strain textbox on Acquire (with the reasoned pencil in EDITABLE_FIELDS); every local-inventory-item query resolves strain display as `COALESCE(batch market_strain, strain name)`, so minted items, the Interco panes, Virtual Move, the inventory report, the marketplace tag picker, and the label package source all show the sales name while the HBN, the strain linkage, and lot surfaces keep the true cultivar.
2. **The planned fields law**: Acquire's Silo # and Start Time relabel "(planned, optional)" with rewritten help (no TAT claim); `wet_weight_entries.actual_start_time` (0026) captures the ACTUAL start at Wet Weight (24-hour law, optional, the colon mask generalized to both time inputs); help copy states the HBN ratifies at wet weight.
3. **The wet queue item law**: hbn_queue optionFields become farm_code, strain_name, entry_date with sequenceRows numbering ("1. ARL / Fruity Pebbles / 2026-09-01"); the picked heading and the lot panel take the simple form with the full HBN muted beneath; the pane never prints an HBN.
4. **The inbound trucks fix** (owner bug: "no inbound record... the header should say 'truck 1'"): /interco/receiving gains an Inbound trucks section listing in_transit wet truck lots, each line headed **Truck N** with Farm/Strain/Date and the weight, linking to the lot (the reasoned Move To pencil is the assign-on-arrival).
5. **The compliance metrics pane**: the four KPI tiles ride a tinted, bordered kpi-pane labeled Metrics, visually apart from the menu cards (accent-tinted per view).
6. **The one-export-home law**: every METRC-bound CSV downloads and marks uploaded at /admin/uploads ONLY. A new Manifests section lists completed movements (interco and virtual) pending until a metrc_uploads stamp (kind manifest, ref_id = movement; markManifestUploaded); the Export/Download buttons left the Virtual Moves log, the outbound finished list, and the finish done page (each now points at the one home); the old routes 302 to /admin/uploads.
7. **The trim exchange, the now-half**: the [+] rapid-add replaces Add package (one blank unrequired entry line; plus commits through the same create action with plus_one=1 and lands back on the pick with clear boxes; blank rows skip, partial rows refuse; Save stays); the live overissue confirm rides the [+] (reads data-balance-remaining); a standing OVER ISSUED banner renders whenever a picked balance is negative. **Deferred to the next Cursor slice by the Scribe (canon states it):** the reconciliation-gate interstitial on trim Save and the finish-choice completing the lot out of the queue, plus the whole marketplace rework (label-not-tag, category lookup, grams-in lbs-calculated, package splits).

## Sealed final check

```
cd /home/claude/deploy/app
npx tsc --noEmit                      -> exit 0
npx vitest run                        -> Test Files 15 passed (15), Tests 391 passed (391)
node --check scripts/smoke.mjs        -> ok
Dash audit (all 14 touched files)     -> 0
rm -rf .smoke-persist && SMOKE_PORT=9002 WRANGLER_SEND_METRICS=false timeout 280 npm run smoke
                                      -> SMOKE PASS, "About to apply 26 migration(s)" from zero
                                         (exit 124 is the dev-server timeout kill; proxy noise is
                                          wrangler telemetry blocked by the org egress policy)
Visual pass (Scribe-rendered, seeded dev on 8882, read back): the Metrics pane
  distinct over the menu cards; the trim page with the blank entry line, the
  compact [+], Save, and the balance; uploads, wet queue, acquire, receiving
  title-verified; earlier same-day shots cover the sibling surfaces.
Sitting hazards logged: five zombie wrangler dev processes from prior smoke
  runs had pinned 6.6 of 8 GB and stalled the shell; pkill -9 -f wrangler-dist
  reclaimed it (MEMORY gotcha updated: kill the wrangler PARENT, not workerd).

migrations/0026_market_strain_actuals.sql   sha256:052dd166654aac82
src/pipeline.ts    sha256:ba1b5474763012fe    src/actions.ts  sha256:1d646fa186b8d10d
src/db.ts          sha256:5e13fb96a1d9d959    src/html.ts     sha256:d0cae8e1cc1a41e9
src/i18n.ts        sha256:97508350d002bcc2    src/index.ts    sha256:a1ad1edf22550a06
src/compliance.ts  sha256:6904afc64337e2f2    src/theme.ts    sha256:af0fb1e5a542af3f
scripts/smoke.mjs  sha256:42465dc42e042236
test/strapin.test.ts sha256:708cec0f0d6d0f2c  test/routing.test.ts sha256:bc85dc1d975b17a9
test/surface.test.ts sha256:5e825fa9a711fda1  test/i18n.test.ts    sha256:319be220409159fb
```

Worker plus one append-only migration (0026). Owner deploys by PS. Never c10. TBD ids stay TBD.
