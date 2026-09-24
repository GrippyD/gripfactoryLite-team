# 2026-09-15 THE MODELS BUTTON (canon 0.30.86)

Scribe-direct under G-2. Owner ruling 2026-09-15, with the upload grip-harvest-menu-hosting.zip, verbatim: "New button in Admin: [Models] - pin gated: 17853" and beneath it "1. [Harvest Menu Tool 2026]".

## The law

1. Admin carries a new tile, [Models], after [Harvest Console] and before the Continuum tiles. It opens /models, a tiles page with one tile per model tool; his list starts with [Harvest Menu Tool 2026].
2. /models and everything under it sit behind a second PIN, not Admin's. The PIN is a value in data (app_config `models_pin`, seeded 17853 by migration 0051, editable in Admin, Lookups, app_config like admin_pin). The gate has its own cookie (`gf_models_pin`, scoped to /models, a shift long like Admin's) and its own PIN page posting to /pin/models, outside the gated prefix the way /pin sits outside /admin. The Admin PIN does not open Models; typed at the Models gate it reads Wrong PIN. An off-site `next` falls back to /models.
3. Each model tool is a vendored static app: his zip's index.html and data.json land untouched under public/models/harvest-menu-2026/ (sha256 1b5a8798e8417aca and 979881ee7f395397, pinned in the smoke) and stream through the ASSETS binding with cache-control no-store, so a replaced file lands on the next load and the gate stays in front (run_worker_first). The tool serves at /models/harvest-menu-2026/ with the trailing slash so its relative `fetch('data.json')` resolves beside it; the slash-less path redirects there. data.json streams as application/json.
4. The registry is data (canon L-4): `MODEL_TOOLS` in src/config.ts, one entry per tool (slug, title, the files its page fetches); the routes and the tiles derive from it, so the next tool on his list is one line and one folder.
5. The zip's README.md and refresh_data.py (the data lineage: shmerblez.xlsx, sheet PNN, and the regeneration script) are kept beside the repo under app/vendor/harvest-menu-2026/, not served.

## What changed

- `migrations/0051_models_pin.sql`: app_config models_pin 17853 (INSERT OR IGNORE).
- `src/config.ts`: CONFIG_KEYS.models_pin; MODELS_PATH, MODELS_PIN_PATH, ModelTool, MODEL_TOOLS, modelToolPath.
- `src/index.ts`: modelsPinGate and its cookie; POST /pin/models; GET /models; per tool the redirect, the page and the data routes; `vendoredAsset` (a typed no-store stream for a vendored app's data file).
- `src/html.ts`: the Admin tile; `modelsPage`; `pinPage` takes the form's action (default /pin).
- `src/identity.ts`: `safeNextPath` takes the gate's fallback (default /admin).
- `src/i18n.ts`: Models / Modelos, Model / Modelo.
- `public/models/harvest-menu-2026/index.html`, `data.json`: his bytes. `vendor/harvest-menu-2026/README.md`, `refresh_data.py`: his bytes, unserved.
- `test/models.test.ts` (+7): the key, the paths, the registry, the Admin tile and its order, the Models page, the PIN page action, safeNextPath's fallback.
- `scripts/smoke.mjs`: the from-zero pin is 51 migrations; the Models walk (tile in Admin; 401 with the Admin cookie alone; the PIN page posts to /pin/models with next=/models; the Admin PIN refused there; the tool 401 without the Models PIN; an off-site next falls back; the tiles page; the redirect; the tool page and its bytes; data.json as JSON, no-store, its bytes; models_pin listed in app_config).

The vendored files are his bytes and stream untouched; the dash audit covers what the Scribe wrote. The tool makes two external requests of its own (Google Fonts; cdnjs for the SheetJS reader behind its Load newer workbook button) and keeps a viewer's edits in that browser's localStorage, per its README.

## Open for the owner

- Skin: the tool streams raw, in its own light and dark theme, with no Continuum chrome or back link. THE HARVEST CONSOLE LITE got the inverted Continuum skin by his ruling (0.30.27 and 0.30.30); his word if the Models tools should wear it too.
- The Models PIN is the only lock on /models: a device that holds it reaches the tools without the Admin PIN. Reaching the tile still takes Admin.

## Gates

- `npx tsc --noEmit`: 0 errors.
- `npx vitest run`: 28 files, 621 tests passed.
- From-zero smoke: "About to apply 51 migration(s)", SMOKE PASS.
- Dash audit: 0 on every file the Scribe wrote.
- Visual pass: Admin with the [Models] tile in place, and the Models page with its one tile, Lite and Cerberus.

## Deploy (his hands, WITH the migration)

From `app/`:

```
npx wrangler d1 execute gripfactory-lite-grip-20260914 --env grip --remote --command "SELECT 1"
npx wrangler d1 migrations apply gripfactory-lite-grip-20260914 --env grip --remote
npm run deploy:grip
```

## Sealed final check

```
migrations/0051_models_pin.sql                 519  e7b830964fc329f8
src/config.ts                                39157  1f724eb931dbe4ed
src/html.ts                                 165821  f5d5cec9bd125e17
src/i18n.ts                                 106887  de8581b56a47d205
src/index.ts                                112097  d4cca6edbd0c80c5
src/identity.ts                               3551  73831b0dba298f9a
test/models.test.ts                           3546  4bd31a0c91decc07
scripts/smoke.mjs                           368836  78393bce99292d3e
public/models/harvest-menu-2026/index.html   42416  1b5a8798e8417aca  (his bytes)
public/models/harvest-menu-2026/data.json     7429  979881ee7f395397  (his bytes)
vendor/harvest-menu-2026/README.md            4621  80ac1b017e00ddee  (his bytes)
vendor/harvest-menu-2026/refresh_data.py      5231  03f9735ebd089e26  (his bytes)
tsc: 0 errors; vitest: 28 files, 621 tests passed
smoke: About to apply 51 migration(s); SMOKE PASS
dash audit: 0 on every file the Scribe wrote
```
