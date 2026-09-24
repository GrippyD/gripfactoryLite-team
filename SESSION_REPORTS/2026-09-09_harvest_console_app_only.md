# Session report: the Harvest Console node is the app alone, wearing the inverted Continuum (canon 0.30.30), Scribe-direct, 2026-09-09

**Scribe:** Gripfactory Lite Scribe (Cowork), Scribe-direct under G-2. Two owner messages minutes after the 01fe6f99 deploy, each with a picture of the live /harvest-console page; one slice, worker only, no migration.

## The messages, verbatim

- With a picture of the page's top (the crumb, the HC masthead with "Harvest Console / Owner: Dennis", the rule, the lede paragraph): "Remove all of this, make the CSS match the inverted continuum"
- With a picture of the page's foot (the Tools heading and the "Harvest Console Lite [LIVE] ->" pill): "Remove this"

Together they leave the app and nothing else. The 0.30.27 shell page is retired; the words "make the CSS match the inverted continuum" read as the app's own CSS, since in his first picture the warm ink of the shell met the cooler ink of the app's chrome at a visible seam.

## What shipped

1. **The page is the app.** `/harvest-console` streams the vendored Harvest Console Lite itself (text/html, no-store). No crumb, no masthead, no rule, no lede, no Tools pill, no iframe. `/harvest-console/app` (the 0.30.27 frame target) redirects to `/harvest-console` with a 302, so the node has one URL. The Admin tile is unchanged.
2. **The inverted Continuum skin, at serve time.** The vendored file never changes on disk (vendored-pair law; sha256 still `e03d73a63fb3cdd266bce20ffdac10f2e3da7a230e11852d94e019277e5bddd3`, 86,430 bytes). A `<style id="gf-c10-inverted-skin">` block splices in before the document's closing head tag as it is served, the SalesHelper skin's precedent. The app declares its own `:root` as the re-skin seam ("Nothing else in this file needs to change to re-skin the app"), and its CONTINUUM10-THEME mapping names each slot, so the skin fills those slots with `C10_INVERTED_TOKENS` slot for slot: bg #14120e, panel #1e1b16, panel-2 #27231c, accent #d19a4e, accent-2 and accent-3 #e5b673, text #f1ede4, text-mute #a79f8f, alert #e0785c and its soft, accent-soft, radius, shadow. The three derived slots derive from the inverted values the same way the originals derived from Christine's (panel-3 #312c24, text-dim #ccc6ba, line #3b3833). The app's operational status colors (amber, danger, ok, the year palette) stay its own, exactly as its mapping doc keeps them. The body gains the shell's diagonal rule so the ground reads as the sibling pages do.
3. **Closed forks.** Both 0.30.27 forks fall with the shell: no badge to letter, and one URL for the Continuum site to link (`/harvest-console`).

Code: `equipment.ts` loses `harvestConsolePage` and the `.node-embed/.node-frame` rules and gains `HARVEST_CONSOLE_PATH`, `HARVEST_CONSOLE_LEGACY_APP_PATH`, `HARVEST_CONSOLE_INVERTED_SKIN`, `skinHarvestConsole(html)` (splice once before `</head>`, byte-identical otherwise, a headless document streams unchanged); `index.ts` routes the two paths and `vendoredHtml` takes an optional serve-time decorator.

Noted for the owner, not built: the app's DATA MODEL button opens the app's own PIN dialog. That PIN is the Harvest Console's, inside the vendored file, nothing of ours.

## Sealed final check

```
cd /home/claude/deploy/app
npx tsc --noEmit                      -> exit 0
npx vitest run                        -> Test Files 19 passed (19), Tests 491 passed (491)
Dash audit (4 authored files)         -> 0 each
SMOKE_PORT=9651 WRANGLER_SEND_METRICS=false timeout 285 npm run smoke
                                      -> SMOKE PASS, "About to apply 38 migration(s)" from zero
Smoke pins: /harvest-console 200, text/html, no-store, the Harvest Console Lite
  title; the skin present exactly once, closing right before </head>; with the
  skin lifted out the body equals the vendored file byte for byte; the skin
  carries the inverted tokens and the diagonal rule; none of the old shell
  (crumb, masthead, lede, Tools, the pill anchor, the frame) remains; no app
  shell; no external src, href, fetch or XMLHttpRequest; /harvest-console/app
  302 to /harvest-console; the Admin tile still points at /harvest-console.
  (First run caught my own pin: the app's zoom and language pills are
  class="pill" too; the shell's pill is pinned by its anchor now.)
Unit pins: routing.test.ts (no harvestConsolePage export; the two paths; every
  skin slot paired with its C10_INVERTED_TOKENS value; status slots untouched;
  the splice once before </head>, dollar patterns inert, headless unchanged).
Visual pass (playwright, 1280x900 @1.5, wrangler dev on the smoke DB): the app
  fills the page in the warm inverted ink with the diagonal rule, amber accents,
  cream text, its own red and green status; computed --bg #14120e, --panel
  #1e1b16, --accent #d19a4e, body background rgb(20, 18, 14) with the
  repeating-linear-gradient; one skin node; no failed requests; the old /app
  path answers 302 to /harvest-console.

src/equipment.ts aa68883d7800340e     src/index.ts 6ec2e4cf3ff5821e
test/routing.test.ts a2c1f32d6d7e2412 scripts/smoke.mjs 31afdb8f2d688a2c
public/harvest-console/harvest-console-lite.html e03d73a63fb3cdd2 (unchanged, as supplied)
```

Worker only, no migration; the migrations step of the standing block applies nothing. Live underneath: worker 01fe6f99, migrations 0001-0038. Owed from the owner: this deploy's version id; the true-zero after-counts; the 0.30.19 R2 picture if the Load Silo pane still misleads; a real Zoho export mounted live; the Athena logo; T1 Transport vs T1 Logistics; the METRC templates.
