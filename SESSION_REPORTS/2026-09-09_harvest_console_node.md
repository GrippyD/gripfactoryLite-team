# Session report: the Harvest Console node (canon 0.30.27), Scribe-direct, 2026-09-09

**Scribe:** Gripfactory Lite Scribe (Cowork), Scribe-direct under G-2. One owner message during his walk, with a new folder connected; one slice, worker only, no migration.

## The message, verbatim

"I need this entire app hosted on a button in Admin with the dark (inverted) continuum theme and the "back to continuum" link (exactly the same format as the other pages)"

Alongside it he connected the folder `C:\Users\DennisWallace\Documents\Claude\Projects\Harvest Console Lite`. Its top-level content is one file, `lite\harvest-console-lite.html` (Harvest Console Lite v0.11: a single self-contained offline HTML app, Continuum 10 tokens, data in the browser's localStorage, no external requests); everything else sits under `REFERENCES ONLY` (the full Harvest Console repo clone with its handoff docs, HOSTING.md, CONTINUUM10-THEME.md, CONTINUUM10-INTAKE.md). "This entire app" read as that file, and the reference material was read, not vendored.

## What shipped

1. **The vendored app.** `app/public/harvest-console/harvest-console-lite.html`, copied byte for byte from the connected folder: 86,430 bytes, sha256 `e03d73a63fb3cdd266bce20ffdac10f2e3da7a230e11852d94e019277e5bddd3`, verified equal on both sides. Vendored-pair law: never edited in place; the update procedure in its own hosting guide is "replace the one file", and that is the only way it changes here. (It carries seven typographic dashes of its own; the G-8 audit covers what the Scribe writes, and this file is the owner's, so they stand.)
2. **The raw lane.** `/harvest-console/app` streams the file whole through the assets binding as `text/html; charset=utf-8`, `cache-control: no-store`, so a replaced file lands on the next load. A small `vendoredHtml(c, path)` helper beside `salesHelperAsset`; the `/continuum/:file` lane stays png and jpg only.
3. **The page.** `/harvest-console`, the fourth Continuum page, built in `equipment.ts` on the same `c10Shell` as its three siblings: the identical crumb (`&#8592; Back to the Continuum 10` to `https://gripcontinuum.gripcannabis.com/#/`), the masthead with the round badge (HC), `<h1>Harvest Console</h1>`, `Owner: Dennis`, the rule; then a one-paragraph lede in the app's own words from its intake sheet plus the localStorage note from its hosting guide; then the whole app framed full-bleed (`.node-embed` / `.node-frame`, height `max(560px, calc(100vh - 15rem))`, the app's own ink ground behind it); then Tools with the pill `Harvest Console Lite [Live]` opening the raw lane on its own. Dark (inverted) tokens, `color-scheme: dark`, Palatino display, exactly as the siblings. UnPINned like the siblings (they are Continuum documents); the app holds no PII and makes no requests.
4. **The Admin button.** `{ href: "/harvest-console", kind: "Continuum", title: "Harvest Console" }` right after Compliance Testing in `adminHomePage`; the title is a proper noun in both tongues in i18n.

Forks left for the owner: whether the node should sit behind the PIN (one line: `app.use("/harvest-console/*", pinGate)` plus the page); whether the badge should read something other than HC; whether the Continuum site's own node link should point at `/harvest-console` (the framed page) or `/harvest-console/app` (the bare app).

## Sealed final check

```
cd /home/claude/deploy/app
npx tsc --noEmit                      -> exit 0
npx vitest run                        -> Test Files 19 passed (19), Tests 485 passed (485)
Dash audit (6 authored files)         -> 0 each
SMOKE_PORT=9601 WRANGLER_SEND_METRICS=false timeout 285 npm run smoke
                                      -> SMOKE PASS, "About to apply 38 migration(s)" from zero
Smoke pins added: Admin carries the Harvest Console tile; /harvest-console is
  200 with the Back to the Continuum 10 crumb, the masthead title, the owner
  line, the inverted tokens and the iframe at /harvest-console/app; the app
  route is 200, text/html, no-store, its body equal to the vendored file on
  disk character for character, no app shell around it, and free of any
  external src, href, fetch or XMLHttpRequest.
Unit pins: routing.test.ts (the four Continuum tiles; the page carries the same
  crumb string as the Compliance Testing page, the HC badge, the h1, the owner
  line, the rule, the iframe, the Tools pill, Palatino, the inverted tokens,
  color-scheme dark, the title).
Visual pass (playwright, 1280x900 @1.5, wrangler dev on the smoke DB):
  /harvest-console renders the crumb, masthead, rule, lede, the app full-bleed
  with its own chrome (frame title "Harvest Console Lite v0.11", #lt-chrome
  58px), the Tools pill; /admin shows the Continuum / HARVEST CONSOLE tile;
  /harvest-console/app stands alone. No failed requests on either new route.
  Served bytes of /harvest-console/app hash e03d73a6...5bddd3, equal to disk.

src/equipment.ts 0c061ea151eb761e     src/index.ts 97144efb70ce3004
src/html.ts 15c267939b185573          src/i18n.ts 86cac5b847ada73d
test/routing.test.ts 9329f42121bd0815 scripts/smoke.mjs 1023fed47629c04b
public/harvest-console/harvest-console-lite.html e03d73a63fb3cdd2 (86,430 bytes, as supplied)
```

Worker only; rides the pending deploy (worker plus migration 0038, now carrying 0.30.18 through 0.30.27). Never c10 deploy. Owed from the owner: the deploy run and its version id; the true-zero after-counts; the 0.30.19 R2 picture if the Load Silo pane still misleads after deploy; a real Zoho export mounted live; the Athena logo; T1 Transport vs T1 Logistics; the METRC templates; the three forks above.
