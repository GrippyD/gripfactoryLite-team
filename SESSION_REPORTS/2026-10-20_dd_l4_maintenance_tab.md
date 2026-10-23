# DD L4: the Maintenance tab (2026-10-20)

Worktree `branches/GFLiteMetrcAPI`. Tree received `e643371c9056a36c` (418 files, the L3 gated tree). Tree left `8a5d0c5eecf36d92`, 421 files. No git. Nothing is committed, pushed, or deployed. `canon/` and `prompts/` were not edited. No screenshots and no browser renders, per the render law. The Scribe renders the tab, the projects form, and an asset page.

## What a director sees

Admin, Director Dashboard, Projects (behind the Admin PIN) adds a project (name, owner, farm, status, started on, expected on, budget) and edits it in place (status, expected on, cost to date, note). Add logs reason "project entered". Edit logs reason "project updated". A save that changes nothing writes nothing. Done projects wait under "show done". The bar is the L2 elapsed share: 0 at the start date, 100 at the expected date. When cost to date and budget are both typed, the row prints the dollars, for example "$400 of $1,000".

The asset page (`/equipment/:id`) has a For sale block: not for sale, listed, under offer, or sold, plus condition, asking price, and a note. One save logs reason "asset for sale". `/equipment` marks a listed asset with the word "listed" (under offer and sold get their own words). `farmops.assets_for_sale_count` is live at definition version 2. Its compute key is the count of live assets whose sale status is listed or under offer. Sold and blank stay out. The quarterly tile does not store a `dd_kpi_values` series. The tab reads that same count.

`/admin/director/maintenance` is linked from the Director Dashboard home and from a Maintenance tab in the Farming Operations wall head, beside the wall. The other walls have no such tab. The page has four sections, in order: active projects (planned, active, paused, by expected date; empty text "No projects entered" with the form link), upcoming work (the next eight ISO weeks of PM due dates, overdue first in the warning color, then open tickets with age in days), the forecast (overdue, then one bar per week for eight weeks, counts only, nothing past the next due date) with the GRIPCasting line for BU 11 and GL 5320, 5330, 5350, 5360, 5370, and 5380, or "Maintenance budget: not in GRIPCasting yet", and equipment for sale (listed or under offer), or "Nothing listed for sale".

## Files

| file | bytes | sha256 |
| --- | ---: | --- |
| app/migrations/0116_dd_maintenance.sql | 1690 | 51c4b201811822f5 |
| app/src/maintenance.ts | 28543 | d014de7ea1fae9c4 |
| app/src/directorregistry.ts | 114201 | 16ceaef466182a0a |
| app/src/equipment.ts | 45948 | 602ec0f96c008056 |
| app/src/director.ts | 104256 | c783198a1b38440d |
| app/src/index.ts | 206057 | 65400c39ad73817b |
| app/src/i18n.ts | 389694 | 595b7034fc00f3b3 |
| app/src/theme.ts | 247493 | dc1dbce877a48eef |
| app/test/director.test.ts | 117562 | c69d722c36c50cf2 |
| app/test/maintenance.test.ts | 13778 | 2c5f945586b72238 |
| app/scripts/smoke.mjs | 946699 | 562d0a5ce3ca41fd |

Dash and CR scan of those eleven files: U+2013 0, U+2014 0, CR 0. The new migration, `src/maintenance.ts`, and `test/maintenance.test.ts` name nobody. The other touched files still contain names that were already in them.

Tails (last lines):

- `0116_dd_maintenance.sql`: `AND def_version = 2` / `);`
- `maintenance.ts`: the done redirect, then `}`
- `directorregistry.ts`: the `ddConfigSeedSql` return, then `}`
- `equipment.ts`: `return c10Shell(...)` then `}`
- `director.ts`: the phased share return, then `}`
- `index.ts`: `export { app };` / `export default worker;`
- `i18n.ts`: `refusalText` return, then `}`
- `theme.ts`: `` </style>`; `` / `}`
- `director.test.ts` and `maintenance.test.ts`: `});` / `});`
- `smoke.mjs`: `process.exit(1);` / `});`

`npx tsc --noEmit` exit 0. `node --check scripts/smoke.mjs` exit 0.

## Gates

Typecheck: `npx tsc --noEmit` exit 0.

Vitest TZ=UTC:

```
Test Files  121 passed (121)
Tests  1677 passed | 6 skipped (1683)
Duration  16.17s
```

Vitest TZ=America/New_York:

```
Test Files  121 passed (121)
Tests  1677 passed | 6 skipped (1683)
Duration  17.08s
```

`node --check scripts/smoke.mjs` exit 0.

From-zero smoke exited 0. It printed `About to apply 115 migration(s)` and `SMOKE PASS`. The maintenance checks posted a project (303), marked T-Zero listed (303), and loaded the tab (200). No response in the log is a 500. The log's last lines:

```
[wrangler:info] POST /admin/director/projects 303 See Other (27ms)
[wrangler:info] POST /equipment/b3000001-0001-4000-8000-000000000001/for-sale 303 See Other (25ms)
[wrangler:info] GET /equipment 200 OK (18ms)
[wrangler:info] GET /admin/director/maintenance 200 OK (80ms)
[wrangler:info] GET /admin/director/farmops 200 OK (36ms)
[wrangler:info] GET /admin/director/bizops 200 OK (47ms)
SMOKE PASS
```

## Declined

Nothing in the build was declined. The four `equipment_assets` column adds are `ALTER TABLE`, the same shape as the other column adds in this repo, so wrangler runs that file once. The new `dd_projects` table and the KPI update are safe to run again.

## Close

Tree left `8a5d0c5eecf36d92`. Nothing is committed, pushed, or deployed. The Scribe gates. The owner merges. This slice carries migration 0116, so the merge block takes a snapshot first. L1 to L4 ride in one push.
