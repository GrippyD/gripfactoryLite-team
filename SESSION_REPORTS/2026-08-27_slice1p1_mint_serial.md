# Slice 1.1 session report: mint serial and seed fix

**Date:** 2026-08-28
**Builder:** Cursor
**Scope:** Corrected HBN mint law (trailing YY### lot serial) and Blue Andeez seed 078
**Repo:** `Documents\Claude\Projects\gripfactory Practical` (local only, no remote)

## Scope recap

No deploy has happened (wrangler.toml still TBD ids), so migrations 0001 and 0003 were edited in place this one time. Comments at the top of those files say that after the first deploy, changes ride new numbered migrations only.

Ruling 1: trailing mint segment is a year-wide lot serial (`YY###`), not a repeated year. Silo numbers that are numeric render two-digit zero-padded. Serial is allocated server-side, UNIQUE(harvest_year, lot_serial), void does not free a serial.

Ruling 2: Blue Andeez moves to 078; Gelato 41 keeps 071. CSV and migration 0003 updated. The matching one-cell edit on the 26H workbook Abbr tab is the owner's side, not this session.

Stations, queues, pages, and styling were not otherwise changed.

## What changed

- `harvest_batches` gained `lot_serial INTEGER NOT NULL` and `harvest_year INTEGER NOT NULL`, plus `UNIQUE (harvest_year, lot_serial)`.
- Mint format: `<YYDDD>-<farm>-<grow_code>-<strain_code>-<manicure>-<silo>-<YY###>`. Example: `26244-ARL-GH-027-0-05-26001`.
- Serial: `1 + MAX(lot_serial)` for that `harvest_year` from `entry_date`. MAX does not filter `deleted_at`. Insert plus change-log rows still go through one `db.batch()`.
- Silo: `5` -> `05`; blank -> `NA`; non-numeric text passes through.
- `app/src/config.ts` mint format string updated (L-4 candidate).
- Smoke: first mint `26244-ARL-GH-027-0-NA-26001`, second same day `26002`. Prior walk still passes.

## Deviations

- D1 cannot bind a later batch statement from an earlier statement's SELECT result, so the MAX read happens immediately before the insert batch, not as a statement inside it. Double-allocate is stopped by `UNIQUE (harvest_year, lot_serial)` plus retry on unique errors (D1 also processes writes one at a time per database).
- Concurrent-ish coverage is a unit test of claim-then-conflict-then-retry, not two live Workers racing.

## Proposed canon amendments

1. Fold the mint law: trailing segment is `YY###` lot serial (year-wide, resets each year, void does not reuse). Example `26244-ARL-GH-027-0-05-26001`. ADR-5 / PROCESS_MAP B02 mint notes should drop the "trailing YY redundancy" open item.
2. Silo segment: numeric values two-digit zero-padded; blank `NA`; other text unchanged.
3. Strain 071/078: Blue Andeez `078`, Gelato 41 `071`. Strike the slice 1 duplicate-071 amendment.
4. After first Cloudflare deploy, never edit applied migrations in place.

## Open / owner notes

- Wipe `app/.wrangler` (local D1) if it already applied the old 0001, or `npm run dev` will see the old schema. Smoke uses a fresh `.smoke-persist` and does not need that wipe.
- 26H Abbr tab: one cell, Blue Andeez code `078`, is for the owner to change in the workbook.

## Verification output (verbatim)

Sealed list is the files this slice touched. This report was written after that pass.

```
app/migrations/0001_schema.sql
  wc -c: 3805
  sha256: 1b6e0dfee7201fd795af0a73b0f311633db09d53ce0c967768ef9b1934a55f56
  tail80:  INDEX record_change_log_record ON record_change_log (record_table, record_id);\n
app/migrations/0003_strains.sql
  wc -c: 12402
  sha256: 74f81f2a2b451e65e873a5d4294731c447c31b7913f968870a47b3e4749cb75f
  tail80: 2026-08-27T00:00:00.000Z', NULL, '2026-08-27T00:00:00.000Z', NULL, NULL, NULL);\n
app/seed/strains.csv
  wc -c: 1691
  sha256: 842152c2d5a377e8f9558b0ee62444d73774ca908f6eb962219ebd0b3f2342de
  tail80: erry Sherbet,LCS,074\r\nApplescotti,AS,075\r\nGush Mintz,GM,076\r\nHeir Heads,HH,077\r\n
app/src/mint.ts
  wc -c: 3876
  sha256: d679a42c1525d58654dfb1a8f07393ea53ea2d58756e558d82a0950bfe1eeb79
  tail80: ed,\n  hbn: string\n): void {\n  if (existing) throw new HbnCollisionError(hbn);\n}\n
app/src/config.ts
  wc -c: 2695
  sha256: 4fcbcf3bd3907bcb65543b93f10cba2e720e00786d775e722b530396c969910d
  tail80:  TestOutcome {\n  return (TEST_OUTCOMES as readonly string[]).includes(value);\n}\n
app/src/actions.ts
  wc -c: 24761
  sha256: ecbdfcdc51ba6eb6160b0af8280c6860b796f6d1071dde643af9fbcbdae8f285
  tail80: reate,\n      ts\n    ),\n  ]);\n  return { redirect: "/admin/lookups?ok=type" };\n}\n
app/test/mint.test.ts
  wc -c: 4687
  sha256: 3c13eae33768effd40a23de96ee162acead26336a4b4fa8eafd02eeb22faa2c5
  tail80: ged/);\n    expect(() => assertHbnAvailable(null, hbn)).not.toThrow();\n  });\n});\n
app/scripts/smoke.mjs
  wc -c: 11680
  sha256: 84096f31165d04c22850d5f18eb36e51e05760dd5b940afa00dad4ba6a998978
  tail80: ld);\n  }\n}\n\nrun().catch((err) => {\n  console.error(err);\n  process.exit(1);\n});\n
files: 8
===== npx tsc --noEmit =====
===== npx vitest run =====

 RUN  v4.1.11 C:/Users/DennisWallace/Documents/Claude/Projects/gripfactory Practical/app


 Test Files  3 passed (3)
      Tests  25 passed (25)
   Start at  10:05:27
   Duration  226ms (transform 111ms, setup 0ms, import 160ms, tests 15ms, environment 0ms)

===== node scripts/smoke.mjs =====

 ⛅️ wrangler 4.127.0
────────────────────
Resource location: local 

Use --remote if you want to access the remote instance.

Migrations to be applied:
┌───────────────────────┐
│ name                  │
├───────────────────────┤
│ 0001_schema.sql       │
├───────────────────────┤
│ 0002_lookup_seeds.sql │
├───────────────────────┤
│ 0003_strains.sql      │
└───────────────────────┘
? About to apply 3 migration(s)
Your database may not be available to serve requests during the migration, continue?
🤖 Using fallback value in non-interactive context: yes
🌀 Executing on local database gripfactory-lite-local (TBD-local-d1-id) from .smoke-persist\v3\d1:
🌀 To execute on your remote database, add a --remote flag to your wrangler command.
🚣 20 commands executed successfully.
┌───────────────────────┬────────┐
│ name                  │ status │
├───────────────────────┼────────┤
│ 0001_schema.sql       │ ✅     │
├───────────────────────┼────────┤
│ 0002_lookup_seeds.sql │ 🕒️    │
├───────────────────────┼────────┤
│ 0003_strains.sql      │ 🕒️    │
└───────────────────────┴────────┘
🌀 Executing on local database gripfactory-lite-local (TBD-local-d1-id) from .smoke-persist\v3\d1:
🌀 To execute on your remote database, add a --remote flag to your wrangler command.
🚣 5 commands executed successfully.
┌───────────────────────┬────────┐
│ name                  │ status │
├───────────────────────┼────────┤
│ 0001_schema.sql       │ ✅     │
├───────────────────────┼────────┤
│ 0002_lookup_seeds.sql │ ✅     │
├───────────────────────┼────────┤
│ 0003_strains.sql      │ 🕒️    │
└───────────────────────┴────────┘
🌀 Executing on local database gripfactory-lite-local (TBD-local-d1-id) from .smoke-persist\v3\d1:
🌀 To execute on your remote database, add a --remote flag to your wrangler command.
🚣 2 commands executed successfully.
┌───────────────────────┬────────┐
│ name                  │ status │
├───────────────────────┼────────┤
│ 0001_schema.sql       │ ✅     │
├───────────────────────┼────────┤
│ 0002_lookup_seeds.sql │ ✅     │
├───────────────────────┼────────┤
│ 0003_strains.sql      │ ✅     │
└───────────────────────┴────────┘

 ⛅️ wrangler 4.127.0
────────────────────
Your Worker has access to the following bindings:
Binding                                 Resource                  Mode
env.DB (gripfactory-lite-local)         D1 Database               local
env.THEME ("grip")                      Environment Variable      local

⎔ Starting local server...
[wrangler:info] Ready on http://127.0.0.1:8788
[wrangler:info] GET / 200 OK (57ms)
[wrangler:info] POST /admin/lookups/people 303 See Other (7ms)
[wrangler:info] POST /person 303 See Other (4ms)
[wrangler:info] GET /station/acquire_hbn 200 OK (10ms)
[wrangler:info] POST /station/acquire_hbn 303 See Other (14ms)
[wrangler:info] GET / 200 OK (9ms)
[wrangler:info] POST /station/acquire_hbn 303 See Other (13ms)
[wrangler:info] GET / 200 OK (10ms)
[wrangler:info] GET /station/wet_weight 200 OK (8ms)
[wrangler:info] POST /station/wet_weight 303 See Other (11ms)
[wrangler:info] GET / 200 OK (10ms)
[wrangler:info] GET /station/trim_packages 200 OK (8ms)
[wrangler:info] POST /station/trim_packages 303 See Other (12ms)
[wrangler:info] GET / 200 OK (8ms)
[wrangler:info] GET /station/cryo_weight 200 OK (7ms)
[wrangler:info] POST /station/cryo_weight 303 See Other (9ms)
[wrangler:info] GET / 200 OK (9ms)
[wrangler:info] GET /queue/testing_queue 200 OK (6ms)
[wrangler:info] POST /queue/testing_queue/control 303 See Other (7ms)
[wrangler:info] GET / 200 OK (10ms)
[wrangler:info] POST /record/wip_packages/54782b82-e9e2-494c-a0a6-4bb2e1742b17/edit 303 See Other (9ms)
[wrangler:info] GET /log 200 OK (6ms)
[wrangler:info] POST /record/wip_packages/54782b82-e9e2-494c-a0a6-4bb2e1742b17/edit 400 Bad Request (7ms)
SMOKE PASS
[wrangler:info] GET /export/record_change_log.csv 200 OK (4ms)
```
