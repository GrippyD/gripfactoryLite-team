# 2026-09-27 The gate on the prepack available pane reads one list (canon 0.30.262): PASSED

Scribe session. The gate on his Code session's `SESSION_REPORTS/2026-09-27_prepack_one_list.md` (brief O, THE PREPACK AVAILABLE PANE READS ONE LIST, canon 0.30.238; no migration). The report says "Not deployed. Nothing committed."; nothing was deployed before this gate. No Scribe change to `app/`. His hand-back, verbatim in part: "The prepack Available pane now reads as one list, and the report is `SESSION_REPORTS/2026-09-27_prepack_one_list.md`. Nothing was committed or deployed. No migration; the head stays 0076."

VERDICT: PASSED. Every gate passes and the law reads as briefed. The deploy is his: the worker-only line at the end.

## What was gated

1. The tree came over as one tarball. It hashed identical on both sides: 223 files, listing sha256 28922204aa90ef05. Against the live tree (e1168563d2f37813, worker 23679293) exactly the report's eight sealed files changed, one new (`test/prepackonelist.test.ts`); the package files and `wrangler.toml` did not move. The seal covers every changed file (G-10).
2. The eight files match the seal byte for byte (size, sha256 and tail). No dash and no CR byte in any of the 201 files under `src`, `test`, `migrations` and `scripts/smoke.mjs`, nor in the build report.
3. Read against brief O's seven laws. THE TRIANGLE AND THE TEXT: the `theme.ts` rule now inlines an `h3` in a fold summary beside the `h2`, no markup change to `queueFold`. FROM METRC RETIRES: `adoptSection` is gone with its heading, its `Nothing to adopt.` line and the `known` and `new from METRC` markers; a stranger's HBN line is the HBN alone; a stranger with no harvest keeps its muted line and carries no `>>`. THE STRANGERS FILE UNDER THE GROW HEADINGS: `listMetrcAdoptions` now carries `growMethod` per stranger by `adoptGrowMethod`, the batch's grow method when `hbnId` names one, else the live method whose `hbn_code` matches the grow code `parseHbn` reads (ID, OD, GH on the floor), else null for Unknown; `availableByMethod` buckets app rows and strangers under one heading map, a heading filled by strangers alone drawn like any other with its `grow:<name>` fold key. ONE LIST: app rows first in their order, strangers after by tag, every row a `.schedule-item` with `data-schedule-tag` and `data-schedule-hbn` (the stranger keeping `data-adopt-tag`), so the heading count, the Available count and the filter take them in with no new script; the stranger's `>>` still posts its tag to the pane's schedule form. THE WORDS: the four retired strings gone from `i18n.ts`, nothing new. NOTHING ELSE MOVES: `adoptFromMetrc`, which packages list, the other panes, the mirror laws, the migrations, `wrangler.toml` and `package.json` untouched.
4. THE TESTS: the old From METRC case retired from `test/scheduling.test.ts`; `test/prepackonelist.test.ts` (new) files the strangers under Indoor, Outdoor and Greenhouse after the app rows, a known one under its batch's method, the no-harvest and refused-HBN rows under Unknown, the filter hiding a stranger by its last six and a heading when every row hides, `adoptGrowMethod` from the batch else the code, and the `h3` rule in every sheet; `test/metrc.test.ts` follows the row's new field. The smoke walks the stranger under Greenhouse with the heading count including it, its `>>` adopting and scheduling, no From METRC section served, and Spanish without `Desde METRC`.
5. THE SMOKE'S D1 after the walk: 76 migrations; three live grow methods; 37 adoptions logged; the prepack schedules six scheduled and one complete.

## Observations for his word (no hold)

- Four comments still say `From METRC` (in `src/index.ts`, `src/metrc.ts`, `src/prepack.ts` and `src/theme.ts`); they name a section that no longer exists. Words in comments only; nothing served.
- The report's four assumptions stand: app rows before strangers, strangers by tag; `known` and `new from METRC` retired; Unknown for a missing, unreadable or codeless harvest; a stranger on a batch the app has uses that batch's method even when its HBN's code would say otherwise.

## Gates on the tree as received (the Scribe's sandbox)

- `npx tsc --noEmit`: exit 0.
- `npx vitest run`: 61 files, 932 tests passed; the same under `TZ=America/New_York`.
- `node --check scripts/smoke.mjs`: ok.
- From-zero smoke (`SMOKE_PORT=9178`): `About to apply 76 migration(s)`, `SMOKE PASS`, no ` 500 ` line; the dev server ended by the timeout after the pass.
- Dash audit: 0, and no CR byte, on the 201 files and the build report.
- Secret grep (`METRC_INTEGRATOR_KEY = "`, `METRC_USER_KEY = "`, `MS_CLIENT_SECRET = "`, `SENSORPUSH_PASSWORD = "`, `cfas[t]_`): no matches under `src`, `test`, `scripts`, `migrations` or `wrangler.toml`.

## Deploy (his hands; worker-only, no migration rides)

```powershell
cd "C:\Users\DennisWallace\Documents\Claude\Projects\gripfactory Practical\app"
npm run deploy:grip
```

His paste back: the Version ID. THE PROBE: Prepack scheduling, the Available pane: the fold triangle and its heading on one line; no From METRC section; a stranger from METRC under Indoor, Outdoor or Greenhouse after the app's rows, its HBN line the HBN alone, its `>>` adopting and scheduling.

## Sealed final check

```
npx tsc --noEmit                      exit 0
npx vitest run                        61 files, 932 tests passed
TZ=America/New_York npx vitest run    61 files, 932 tests passed
node --check scripts/smoke.mjs        ok
rm -rf .smoke-persist && CI=1 SMOKE_PORT=9178 WRANGLER_SEND_METRICS=false npm run smoke
                                      About to apply 76 migration(s); SMOKE PASS; " 500 " lines: 0
the build report's seal (8 files) verified byte for byte, device and sandbox:
src/i18n.ts                                   177784  b70e3fde8c7371c8
src/metrc.ts                                   87588  bc4a4ca51f4b9530
src/scheduling.ts                              45973  e2d843abe0d476d1
src/theme.ts                                  156898  2912de0e4808c560
scripts/smoke.mjs                             611452  427739d9d7953de4
test/metrc.test.ts                             64074  86cb14deb70e96d0
test/prepackonelist.test.ts                     6548  2c77ae9faeae7212
test/scheduling.test.ts                        21411  0a9b49402684683b
changed against the live tree, not in the seal: none
tree listing, device and sandbox: 223 files, sha256 28922204aa90ef05 (live: e1168563d2f37813)
the build report: SESSION_REPORTS/2026-09-27_prepack_one_list.md  3545  9e6d7cb91bd7a598
dash audit: 0; secret grep: no matches
```
