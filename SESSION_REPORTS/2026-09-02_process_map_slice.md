# Session report: process map home + Import Data queue, 2026-09-02

**Builder:** Cursor sitting, Scribe-issued mega slice from `prompts/2026-09-02_process_map_slice.md` (canon 0.15.5).
**Owner rulings (verbatim, 2026-09-02):** the Harvest / Interco / Drying / Production / Marketplace / Business Operations map; Admin [Import Data] as a multipurpose csv/xlsx queue; Reports button left of Admin, orange barrelled, no PIN.

Canon 0.15.5 and the prompt agree. This sitting did not edit `canon/` or `prompts/`. No remotes, no push, no deploy.

## What shipped

### Part 1: home is the operations map

`OPS_GROUPS` and `OPS_FLOW_EDGES` live in `app/src/pipeline.ts`. Six groups: harvest_ops (field; Acquire HBN, Wet Weight Entry), interco_logistics (truck; node href is `/interco`), drying_ops (silo; Unload Dry Space plus reserved virtual move to processor), production_ops (factory; Trim, Cryo, Fulfillment, Inventory), marketplace (storefront; reserved group, no members), business_ops (piggy bank; reserved Compliance Console and Purchasing). Exactly four flow edges: harvest to interco right, interco to drying right, drying to production down, production to marketplace left. business_ops is the support island and carries none.

`/` renders two rows of icon nodes plus the four arrows, not the old tile grid. Each node is one tap to `/ops/<key>` except Interco, which goes straight to `/interco`. Reserved groups and reserved members wear the orange-barrel stub idiom. `/ops/<key>` is the old home tile grid for one group, with a back link to Operations. Unknown key: 404. No PIN on `/ops` itself; gated tiles stay gated when tapped.

Six inline currentColor stroke SVGs in `app/src/icons.ts` (field, truck, silo, factory, storefront, piggy_bank), each under 2 KB, aria-hidden beside the visible labels. Desktop map uses a five-column grid so the down arrow sits under Drying and Production sits under it, Marketplace to its left, Business as the island. Phone device mode hides the desktop map and shows a single vertical chain in `OPS_PHONE_ORDER` with every arrow down. All three sheets style the map in their own idiom (lite 2px, CO paper/Palatino/amber lift, Cerberus steel/gold; honeycomb untouched). Home h1 is Operations / Operaciones. Boot scrawl, bar, pills, Admin FAB look, and Demote are untouched.

### Part 2: Admin [Import Data]

Migration `0015_import_queue.sql` only (0001-0014 frozen). `import_queue` stores filename, kind (csv or xlsx), byte_size, content BLOB, status seeded at `queued`, notes, and the house audit/void columns including `delete_reason`. Admin landing gains [Import Data] after Pending Data Uploads, to `/admin/imports` inside the existing PIN. The page is a multipart upload (`accept=".csv,.xlsx"`) above a queue table (file, kind, size, status, uploaded by, uploaded at, Download, Void). Empty: "Nothing queued." Extension decides kind; anything else 400 naming csv and xlsx. Over 1,048,576 bytes 400 with the 1 MB cap line. Raw bytes store as BLOB; logsForInsert skips the blob; flash "File queued." Download is byte-identical with the original filename. Void is reasoned through `/record/import_queue/:id/void` (no Edit). No parsing, no mapping, no METRC or Zoho calls. D1 reads BLOB back as a number array; `asStoredBytes` accepts that so the round trip works.

### Part 3: Reports

Layout renders `<a class="reports-fab" href="/reports">` immediately left of Admin in a `.fab-cluster` (fixed bottom-right, small gap). Reports wears `#d97706` orange-barrel in each sheet. `/reports` is the Mount SOs reserved page (`src/reports.ts`), no PIN, back link Home.

## Files written or updated this sitting

- `app/src/pipeline.ts`: OPS_GROUPS, edges, phone order, home-surface keys, helpers
- `app/src/icons.ts`: six map icons
- `app/src/imports.ts`: kind/size/cap helpers and the D1 blob readback
- `app/src/html.ts`: map, `/ops` pages, Reports FAB, import queue page, admin Import Data tile
- `app/src/theme.ts`: map + Reports in lite, co, cerberus
- `app/src/i18n.ts`: Operations, group labels, Reports, Import Data, queue chrome (each with es)
- `app/src/index.ts`: `/`, `/ops/:key`, `/reports`, `/admin/imports` GET/POST/download
- `app/src/actions.ts`: `queueImport`; void sets `delete_reason` on `import_queue`
- `app/src/db.ts`: `listImportQueue`, ALLOWED_TABLES
- `app/src/config.ts`: `SYSTEM_REASON.import_queued`
- `app/migrations/0015_import_queue.sql`
- `app/test/ops.test.ts`, `app/test/imports.test.ts`
- `app/test/surface.test.ts`, `app/test/i18n.test.ts`, `app/test/view.test.ts`
- `app/scripts/smoke.mjs`: map, `/ops` walk, Reports, import queue walk

## Verification

tsc clean; **325 tests** passing (11 files); migrations 0001-0015 apply clean into a fresh local persist dir; full smoke **SMOKE PASS**; dash audit 0 on every written file. Browser screenshots of the map in Cerberus, Lite, CO, and phone, plus the Import Data page (PIN 21319). No deploy.

## OWNER-flag (needs a Dennis ruling or a Scribe fold, not resolved here)

- `canon/MEMORY.md` is still pinned at 0.14.1 and `canon/_NOW.md` still leads with 0.15.4 while CANON is 0.15.5. Prompt said flag the lag, do not edit canon.
- `import_queue.content` is SQLite BLOB. A later Postgres port spells this BYTEA.
- Parsing, column mapping, and any METRC or Zoho call wait on the owner. Status stays `queued` until then.
- Marketplace, Reports, Compliance Console, Purchasing, and virtual move to processor stay reserved (their future files are named on the pages).
- The Interco Logistics *page* h1 is still the hardcoded English stub from 2026-08-28; the map node label translates through `t()` (es value in i18n.ts).
- `/record` stays outside the PIN (existing law). Import Void rides that path after the operator has already unlocked Admin.

## Sealed final check

```
cd app
npx tsc --noEmit                      -> exit 0
npx vitest run                        -> Test Files 11 passed (11), Tests 325 passed (325)
node --check scripts/smoke.mjs        -> ok
npx wrangler d1 migrations apply gripfactory-lite-local --local --persist-to .mig-zero-persist
                                      -> 0001 through 0015 applied clean
node dash-audit (UTF-8 E2 80 93 / E2 80 94) on every file this slice touched
                                      -> 0 on each
SMOKE_PORT=8788 WRANGLER_SEND_METRICS=false BROWSER=none CI=1 npm run smoke
                                      -> SMOKE PASS

app/scripts/smoke.mjs                 104364 bytes  sha256:0b2a523a81dd2960
app/src/actions.ts                     46266 bytes  sha256:9895872d9a149e0e
app/src/config.ts                      15621 bytes  sha256:845a83ff1fff5bb2
app/src/db.ts                          34191 bytes  sha256:d293b4350cd6474e
app/src/html.ts                        64030 bytes  sha256:f92c02b5d4df2c77
app/src/i18n.ts                        17909 bytes  sha256:26f1a372ed165d60
app/src/index.ts                       38680 bytes  sha256:a88fbc712d29fe01
app/src/pipeline.ts                    23618 bytes  sha256:3d64e939cc373b24
app/src/theme.ts                       94113 bytes  sha256:0a55d0be0aab751b
app/src/icons.ts                        2484 bytes  sha256:046291948e6eff36
app/src/imports.ts                      3273 bytes  sha256:bbebcb27f894b863
app/migrations/0015_import_queue.sql     896 bytes  sha256:5bdc3a6d275c2704
app/test/i18n.test.ts                  15370 bytes  sha256:87fb561e09c3fa0e
app/test/surface.test.ts               68250 bytes  sha256:6a8c0f54115cd36d
app/test/view.test.ts                  20714 bytes  sha256:b43842dde1366350
app/test/ops.test.ts                    3973 bytes  sha256:7a5a5bb8d9c4c517
app/test/imports.test.ts               11596 bytes  sha256:9863283897d2de91
```

Worker-only plus one append-only migration (0015). Owner deploys by PS after the Scribe's gate. Never c10. TBD ids in wrangler.toml stay TBD.

## Scribe gate addendum (2026-09-02 19:46 UTC, independent re-verification)

The Scribe re-ran the whole gate in its own workspace on the staged tree: tsc clean, 325 tests green, dash audit 0 on every touched file, migrations 0001-0015 from zero, full SMOKE PASS, and its own rendered screenshots (map in Cerberus, CO, Lite, phone chain, /ops/harvest_ops, /admin/imports).

**One defect found and fixed by the Scribe:** row two of the desktop map rendered Marketplace, Production, Business Operations in that order, which put Business Operations in grid column five, so the down arrow from Drying Operations landed on the piggy bank instead of the factory. The law is the owner's ruling: the down arrow drops onto Production Operations; Business Operations is the far-left support island. Fixed in homePage's row-two markup (src/html.ts) with a pinning test (test/ops.test.ts: Production is the row's last node, the left arrow sits between Marketplace and Production, Business leads the row). Re-gate after the fix: tsc clean, 326 tests, SMOKE PASS, re-rendered screenshots read back correct in every view.

The owner deployed the pre-fix tree for live testing before this gate completed; that build carries the row-two defect on home. The fix is committed; a worker-only redeploy ships it (migration 0015 is already applied remotely by the first deploy).

Scribe seals for the two fixed files:

```
src/html.ts       64441 bytes  sha256:b4ee2f9c87b10585
test/ops.test.ts   5340 bytes  sha256:6c79d0460a128e61
```
