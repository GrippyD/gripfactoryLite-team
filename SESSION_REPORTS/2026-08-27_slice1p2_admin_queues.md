# Session report: 2026-08-27, slice 1.2, queues move under Admin as listed records

**Builder:** the Scribe, in-session (per owner ruling 2026-08-27 amending G-2: small slices apply directly now that the bones are proven; Cursor remains the lane for structural work).
**Spec:** `prompts/2026-08-27_slice1p2_admin_queues.md`. Migrations untouched (frozen post-deploy). wrangler.toml untouched.

## Scope recap

Home shows stations only plus an Admin tile. Admin becomes a landing whose first button is Data Queues. Data Queues lists all four queues as inline record tables with their controls and CSV links. Old /queue routes redirect.

## What was built

- `src/pipeline.ts`: new `Surface` type; every entry now declares `surface` ("home" for the 4 stations, "admin" for the 4 queues); `homeEntries()` helper; registry comment documents the ruling. Placement stays data.
- `src/html.ts`: `homePage` renders surface=home tiles plus one Admin tile (no counts, no queue tiles); new `adminHomePage()` (Data Queues, Lookups, Change log, in that order); `queuePage` refactored into `queueSection` (heading carries `data-pipeline-key` and `data-count`, count badge, CSV link, grouped tables, row controls) and new `dataQueuesPage()` stacking every admin-surface queue; nav Admin link now points at `/admin`.
- `src/index.ts`: `/` drops per-queue count queries; new `GET /admin` (landing) and `GET /admin/queues` (stacked sections); `GET /queue/:key` now 302-redirects to `/admin/queues` (unknown keys still 404); `POST /queue/:key/control` unchanged, forms on Data Queues post to it as before.
- `scripts/smoke.mjs`: counts now read from `/admin/queues`; new assertions: home carries no queue tiles and does carry the Admin tile; `/admin` lists Data Queues before Lookups; `/queue/hbn_queue` redirects 302 to `/admin/queues`; release-form id extraction scoped to the release control.
- `test/surface.test.ts`: new: home output contains no queue links or counts and contains the Admin tile; all queues are surface=admin, all four home entries are stations; Admin landing lists Data Queues first.

## Deviations

- **The end-to-end smoke did not run in the Scribe sandbox**: wrangler's local runtime (workerd) cannot start in this container (background process killed by the sandbox; log empty; local D1 migrations alone run fine). The smoke script is updated and runs on the owner's machine (`npm run smoke` from app/) or is superseded by live verification in the browser immediately after deploy, which the Scribe performs. Unit tests and typecheck ran here.

## What was verified (verbatim)

```
npx tsc --noEmit
TSC_CLEAN

npx vitest run
 Test Files  4 passed (4)
      Tests  28 passed (28)

Sealed final check (wc -c, sha256, tail 80 with newlines as |):
10045 src/pipeline.ts
3ce58294290964dc12910eac9f51f98168789af51a920f9196c882f58394e15e  src/pipeline.ts
tail80: s(): PipelineEntry[] {|  return PIPELINE.filter((e) => e.surface === "home");|}|
12142 src/html.ts
3fa7f2b92e7647aef6e111f7fa42464b74e52f272071532d4b2c24792e7e22e3  src/html.ts
tail80: r">${esc(message)}</div><p><a href="javascript:history.back()">Back</a></p>`;|}|
9843 src/index.ts
8d068336e113fab7e1fdff4489b7a9c35050762dc3b85d015f13d828a2ef16fb  src/index.ts
tail80: out[key] = await listQueueRows(db, q);|  }|  return out;|}||export default app;|
12811 scripts/smoke.mjs
a268781def3ffa3634071fb8ae913c5427f4c1bd43348e154e0f3af3729fd5ba  scripts/smoke.mjs
tail80: ld);|  }|}||run().catch((err) => {|  console.error(err);|  process.exit(1);|});|
1187 test/surface.test.ts
c2506237bc9becbeb9cafe3b677f9ade611535cc292e92444ff89288e15328cc  test/surface.test.ts
tail80: toBeLessThan(lk);|    expect(html).toContain('href="/admin/queues"');|  });|});|

Em/en dash audit across src, scripts, test: 0 files
```

## Deploy

From `app/` on the owner's machine (wrangler login session): `npm run deploy:grip`. Optional pre-deploy: `npm run smoke`. The Scribe verifies live pages immediately after deploy (home, /admin, /admin/queues, a /queue redirect) in the owner's browser.

## Proposed canon amendments

Folded already by the owner's ruling: G-2 amended (Scribe may apply small slices directly; sealed check and session report remain mandatory). No further amendments proposed.

## Open questions

None new. Break-in continues.
