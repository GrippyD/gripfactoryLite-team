# 2026-10-13 GC1: GRIPCasting inside GFLite: SEALED

BRIEF GC1 `BRIEFS/2026-10-13_gripcasting.md`, built in `branches/GFLiteOpsDashboard`. The pin was checked before any edit. Canon's hash command in `app/` read `d489baaab0595394`, 366 files, the tree canon 0.30.469 names after T1 (version `e4544c1d-b364-4221-b1b7-0a7c64788336`).

No git. Nothing committed, pushed, or deployed. `canon/` was not edited. Migration `0103` is new. `0101` is not in this tree.

## What was built

A GRIPCasting tile on `/models`. The page is `/models/gripcasting/` and the API is `/models/gripcasting/api/*`, both behind the Models PIN. `MODEL_TOOLS` keeps the Harvest Menu Tool as `kind: "vendored"` and adds GRIPCasting as `kind: "app"`.

The finance model in `src/gripcasting/model.ts` and `types.ts` is the vendored file byte for byte. The tie-out test skips until `src/const.json` and `data/db/actuals/current.json` are present. With them, every difference must be $0.00.

Migration `0103_gripcasting.sql` creates the 15 `gc_` tables and writes no business row. Money is integer cents. Unit rates and quantities at four decimals are integer ten thousandths. Share is integer millionths. The query edge converts both ways. Ids are text. Instants, dates, and JSON are text. `updated_at` is the version the API checks.

The nine endpoints are Hono routes. Identity is the Access email GFLite already trusts. Role is an active `gc_app_users` row (admin or director). No row, or an inactive row, is 403 on every call. Admin loads actuals, changes drivers, and makes the final submission. A director reads everything and edits and submits BU builds. Authors come from the identity. Writes use `db.batch`. Each statement stays at or under 100 binds.

The browser app is bundled with the esbuild wrangler already brings (`scripts/build-gripcasting.mjs`) into `public/models/gripcasting/` (`index.html`, `app.js`, `styles.css`). Fetch base is `/models/gripcasting/api/`. SheetJS loads on demand from cdnjs the first time a workbook is read or exported. No business figure is baked into the served files.

`scripts/gripcasting-import.mjs` reads `const.json` and `data/` from `../db_backups/_imports/gripcasting/` unless `--dir` is set. It takes `--admin email=Name` and `--director email=Name`. Local D1 unless `--remote`. `--dry-run` counts rows and writes nothing. It stops at the first failure and reports what loaded. It does not print figures.

## Files (all under `app/`, plus this report)

| file | bytes | sha256 (16) | what |
|---|---|---|---|
| `migrations/0103_gripcasting.sql` | 6,855 | `a4d9d5497223e4bc` | the 15 tables, no rows |
| `src/gripcasting/model.ts` | 24,515 | `901cf3e5d0281653` | the finance model, vendored bytes |
| `src/gripcasting/types.ts` | 4,754 | `c2962c6d7f2c1f68` | the shared shapes, vendored bytes |
| `src/gripcasting/http.ts` | 377 | `b3dd79d666b74d6f` | the JSON error |
| `src/gripcasting/money.ts` | 927 | `6114dfd6739aecf2` | cents, ten thousandths, millionths |
| `src/gripcasting/validate.ts` | 5,541 | `17e70643ca5daeee` | the request checks |
| `src/gripcasting/queries.ts` | 24,536 | `bb8d963cb04d0fcc` | the D1 reads and batched writes |
| `src/gripcasting/routes.ts` | 6,456 | `45aca22e9cefbfce` | the nine endpoints and the role gate |
| `src/config.ts` | 91,461 | `f8fd5969def556de` | the app kind and the tile |
| `src/index.ts` | 188,644 | `5e2653cf2c4e3aa1` | the mount beside the Models gate |
| `test/models.test.ts` | 3,896 | `82c7125ee64b46b6` | the tile beside the menu tool |
| `test/gripcasting-model.test.ts` | 7,231 | `48c3e73118a9448a` | the byte match, the tie-out, bud shrink |
| `test/gripcasting.test.ts` | 15,011 | `cbbfc92a5fed899e` | roles, the stale version, cents, the dry run, the static files |
| `scripts/build-gripcasting.mjs` | 3,559 | `181c715864fde141` | the esbuild bundle |
| `scripts/gripcasting-import.mjs` | 17,928 | `8a79f9b420f95ef3` | the owner load |
| `scripts/smoke.mjs` | 867,274 | `637930f7cd7e6e66` | 102 migrations, the tile, the API round trip |
| `public/models/gripcasting/index.html` | 1,935 | `ac4bc6e139b878eb` | the page |
| `public/models/gripcasting/app.js` | 112,966 | `90d857382e0557b9` | the bundle |
| `public/models/gripcasting/styles.css` | 12,908 | `1d9ed1d54d047b58` | the sheet |

`npm run typecheck` rewrote `worker-configuration.d.ts`. It is not part of this slice and it is not in the tree hash. The vendored reference under `vendor/gripcasting/` was already in the worktree and was not edited.

## Sealed final check

```
THE TREE                              48f9f36051e0a871 (378 files, 0001-0100 plus 0102 and 0103), on the pin d489baaab0595394
npm run typecheck                     exit 0
TZ=UTC npx vitest run                 108 files, 1538 passed, 6 skipped
TZ=America/New_York npx vitest run    108 files, 1538 passed, 6 skipped
node --check scripts/smoke.mjs        exit 0
CI=1 SMOKE_PORT=9514 node scripts/smoke.mjs
                                      About to apply 102 migration(s); SMOKE PASS; exit 0; 500 lines: 0
dash audit (by character): 0; CR audit: 0; personnel names: none
```

The UTC and Eastern vitest lines, both:

```
 Test Files  108 passed (108)
      Tests  1538 passed | 6 skipped (1544)
```

The six skipped tests are the finance tie-out. The fixtures are not in the tree.

The passing smoke's apply line and pass line: `About to apply 102 migration(s)` and `SMOKE PASS`. `/models/gripcasting/` answered 401 without the PIN and 200 with it. `GET /models/gripcasting/api/me` answered 403 with no row and 200 after a synthetic admin. `PUT /models/gripcasting/api/drivers` answered 200. `POST /models/gripcasting/api/submissions` answered 200 and the synthetic budget came back as 100 dollars.

Rendered at 1920 and 820. GRIPCasting keeps its own look. Every tab opened (Overview, Revenue drivers, Build forecast, Transactions, Submissions, Actuals). The header meets the page and does not cover it. At 820 the tabs do not overflow the page. On `/models`, Lite is the paper page (`rgb(243, 239, 230)`), Grip is the dark page (`rgb(12, 12, 14)`), and CO is the other dark page (`rgb(14, 15, 17)`). All three show the GRIPCasting tile beside Harvest Menu Tool 2026. At 820 in Lite the two tiles sit side by side and do not cover each other.

## Open for the owner

Who the first admin and directors are. When finance's `const.json` and `data/` arrive. Whether GRIPCasting later wears the Continuum chrome. The default shipped here is its own look, as the menu tool.

## After the deploy (owed to no one outside)

Nothing to anyone outside. This session did not deploy. Say deploy when the slice is committed and merged.
