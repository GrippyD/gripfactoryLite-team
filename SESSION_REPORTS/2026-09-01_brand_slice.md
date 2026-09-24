# Session report: the brand slice (slice 17), 2026-09-01

**Sitting:** cloud Scribe; build by a Scribe-directed code agent plus a composition fix pass; asset vectorization and all verification by the Scribe, including rendered screenshots of the running worker.
**Canon:** folded at 0.14.0. **Deploy: PENDING, worker only** (brand assets ride the upload; no migrations).

## Rulings (owner, 2026-09-01)

Scrawl: PLATO becomes the Continuum lockup; the reveal becomes the GRIP mark over the bolted FACTORY plate with "lite" spray-painted across its bottom-right quarter, spilling onto the background. Universal bar: the text brand becomes the same lockup. Fulfillment becomes a menu: [SalesHelper] functional, [Mount SOs] and [Pick Orders] orange barrelled. Our theme and universal bar wrap the hosted SalesHelper. A computer/phone device pill joins the bar (layout reflows). The view pill reads Grip / Lite / CO (CO mark as the segment; the CO stylesheet is owner-pending and renders the Grip look for now).

## Assets (Scribe-prepared)

public/brand/: grip.svg (vectorized from the owner's 891px raster, currentColor), co-mark.svg (vectorized from the wordmark screenshot's mark, currentColor, owner expects touch-up), factory-plate.png (the owner's photo, 320KB, served via /brand/* with cache headers). The uploaded SVG files did not survive the upload; the Scribe traced the rasters with potrace and verified the marks by rendering them.

## What changed

- Scrawl: Continuum lockup on screen one (CO mark + CONTINUUM, chassis header follows); the reveal composition per the ruling; a hidden-swap bug fixed after the Scribe's screenshot pass caught screen one bleeding into the reveal, the plate clipping, and the spray missing (author flex rules were overriding [hidden]; display none is now absolute inside the scrawl slots).
- Universal bar: GRIP mark + CSS-embossed FACTORY steel chip with corner studs + spray lite, both views (the universal-bar ruling supersedes Lite byte-preservation for the brand block only).
- /brand/:file routes (three files, no PIN, cache-control public max-age 3600).
- Fulfillment menu at /fulfillment with the three buttons; reserved pages name their future files per the CSV law; the form lives at /fulfillment/saleshelper/ in our chrome with the form in a flush iframe; /fulfillment/saleshelper/app serves the vendored bytes with a serve-time Cerberus skin injected before </head> when the view is not lite (runtime decoration; the vendored pair is untouched on disk, sizes verified 651831 and 607296); menu.json at both the new path and the old for compatibility.
- Device pill (computer/phone, gf_device, POST /device): phone reflows both stylesheets (panes stack, full-width touch targets, tables scroll in place).
- View pill: Grip label (cookie value stays cerberus), Lite, CO segment carrying the CO mark; gf_view co renders the Grip look until the owner's CO CSS lands (seam kept).

## Scribe verification

npx tsc --noEmit clean; vitest 287/287; node --check smoke; full smoke SMOKE PASS in the Scribe's hands; byte-level dash audit 0 on all touched files; vendored pair size-verified untouched; rendered screenshots read by the Scribe: the scrawl reveal (GRIP leading, plate legible, gold spray lite spilling correctly), the bar lockup in Cerberus, the fulfillment menu, the SalesHelper wrapper, phone mode, and the three-segment pill.

## Owner-owed touch-ups on record

The Continuum lockup refinement (traced from a low-res screenshot); the CO view stylesheet (pill segment live, renders Grip look until the CSS arrives).

## Sealed final check

```
14251 src/config.ts
80a81d059bf7570892698bca4127da1bf33f5edec243e6254fbc079325f59114  src/config.ts
15490 src/i18n.ts
3298385721d8f44ea07f7cc2aec8a456ed52f85eef759999157efdeae659d4cd  src/i18n.ts
65276 src/theme.ts
2e805b36db1552857a7886a90f5859eabfc6de1d98b0bb371c40168c7930be4b  src/theme.ts
57835 src/html.ts
cabc6410ec3757430f14d26b1addfdcb774d658e168f85b9614e1faeab042691  src/html.ts
34608 src/index.ts
382fbd799c11a975ed1b0e54068bf4405224ec1a933680b9df641462e08cee0f  src/index.ts
17229 test/view.test.ts
e6e7694f89b1a9583f5d5411664d8f62629d21e6b25c45e7d128eff295fc3ee7  test/view.test.ts
57508 test/surface.test.ts
a745323534688a4f521074c3bd80453d218ed5451da0341d68c6dd65c6a36f60  test/surface.test.ts
14793 test/i18n.test.ts
f9a34259f5c31462b4f0ee180cf3aa156e1459f6fa01b4476c09ea7c46759253  test/i18n.test.ts
84613 scripts/smoke.mjs
8e274cbf96bd3265540be997dcfa8051ea0ffda82eeabd07960379dbbb639a47  scripts/smoke.mjs
6889 public/brand/grip.svg
2e52225946d899c9bdad84a1d126f8f6c361640df158ae38e86e0b93e1f71953  public/brand/grip.svg
2844 public/brand/co-mark.svg
20f216eb3a1977f1ccb494f29397e4a807703d5f283cd9dc178087c3d6bb8821  public/brand/co-mark.svg
320550 public/brand/factory-plate.png
af7c96553a9b40715ddfdeaea5c4962136cdb4ec4f42b6e5a562808f1cf9eac1  public/brand/factory-plate.png
60514 /home/claude/canon/CANON.md
16ff2cf2522d8f6f33e2f098d8b4a61c2f1ba1b1e42f7759daedef427114c9e1  /home/claude/canon/CANON.md
4422 /home/claude/canon/_NOW.md
615ddd9a61938054e480668b89a98e5ce0118662bbdd70a6496f69a46cec09c3  /home/claude/canon/_NOW.md
13566 /home/claude/canon/MEMORY.md
6da7fb91fe475970299db8aba762a228841ef2302df8bf380ff0244cded4fd70  /home/claude/canon/MEMORY.md
```
