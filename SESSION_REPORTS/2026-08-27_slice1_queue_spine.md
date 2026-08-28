# Slice 1 session report: queue spine

**Date:** 2026-08-28 (prompt filename kept as 2026-08-27)
**Builder:** Cursor
**Scope:** Gripfactory Lite slice 1, queue spine on Cloudflare Workers + D1
**Repo:** `Documents\Claude\Projects\gripfactory Practical` (local only, no remote)

## Scope recap

Stand up the app skeleton and the harvest queue spine as simple forms: four entry stations, four queues, manual queue controls, CSV exports. Pipeline order is data in `app/src/pipeline.ts`. Two wrangler environments (`grip`, `c10`), same behavior, separate D1 ids and CSS token blocks. No deploy. No in-app auth. No METRC or Zoho. No printing, dashboards, or PDF.

Owner chain covered:

1. Acquire HBN
2. HBN Queue
3. Wet Weight Entry (pick from HBN Queue)
4. Dry Space Queue (from wet weights)
5. Trim Packages Entry (pick lots from Dry Space Queue)
6. Cryo Queue (BUD packages)
7. Cryo Weight Entry (pick package ids from Cryo Queue)
8. Testing Queue
9. Manual Testing Queue release controls

## What was built

- TypeScript Worker at `app/`, Hono, server-rendered HTML, one inline stylesheet.
- D1 schema and idempotent seeds in `app/migrations/` (farms, grow methods, package types, Silo 1-5, 78 strains from `app/seed/strains.csv`). People are not seeded.
- HBN mint: YYDDD Julian, uniqueness rejected with a clear message, no suffixing.
- Generic station and queue pages from the pipeline registry. Home tiles follow registry order and show live queue counts.
- Edit and Void on records, reason required, `record_change_log` rows in the same `db.batch()`.
- Admin lookups: add/deactivate people, add strains, dry spaces, package types.
- CSV at `/export/<key>.csv` for each queue plus the four tables.
- Local commands from `app/` (Windows-safe npm scripts, no bash).
- Unit tests (mint math, uniqueness helper, reason rejection, is_bud routing, status transitions) and `npm run smoke` against `wrangler dev` + scratch local D1.

### Layout (app/)

- `src/pipeline.ts` : ordered registry
- `src/config.ts` : mint format, is_bud routing, outcomes, statuses (L-4 candidates)
- `src/mint.ts` : Julian math and HBN format
- `src/actions.ts` : mutations, station action map (new stations add a handler, existing ones stay)
- `src/index.ts` : routes
- `PORTABILITY.md` : D1 to Postgres type mapping

## Deviations

- Wrangler skill prefers `wrangler.jsonc`. The slice prompt named `wrangler.toml`, so the config is TOML with TBD database ids.
- `@cloudflare/workers-types` was installed then removed. `wrangler types` now emits runtime types into `worker-configuration.d.ts`. That generated file contains em dashes from Cloudflare, so it is gitignored (canon G-8). `npm run typecheck` regenerates it then runs `tsc`.
- Integration uniqueness and reasonless-edit checks run in HTTP smoke as well as unit tests of the helpers. Vitest uses the node environment, not the Workers pool (fewer moving parts on Windows).
- `nodejs_compat` is on in wrangler config (Workers best-practice default). Worker code does not import `node:` modules.
- `record_change_log` has a uuid `id` primary key so inserts have a stable key. The prompt listed log columns without `id`.
- `strains.name` and `dry_spaces.name` are UNIQUE so seed `INSERT OR IGNORE` is keyed on a natural key.
- Creates, queue controls, cryo-weight, and release log a system reason (`create`, `queue control`, `cryo weight entry`, `release: ...`) so the reason column is never empty. User-typed reason is demanded only for Edit, Void, and people Deactivate, matching the prompt's "logged, no reason needed" queue controls.
- HBN is not reminted on edit. Changing date/farm/strain after mint leaves the existing HBN.
- Queue row buttons use the remembered person cookie. The person picker is in the header on every page and on station, edit, void, and admin forms.
- Farm display names are the codes (ARL, PNN, PNS). Full names were not in the prompt.
- Grow method primary keys are GH, ID, OD (same as `hbn_code`).
- Cursor browser tools were not available in this session (`cursor-ide-browser` namespace missing). End-to-end checks are the HTTP smoke script, not a headed click-through.

## Proposed canon amendments

Do not apply these here. For the Scribe / owner:

1. **Duplicate strain HBN code 071.** `app/seed/strains.csv` has both Blue Andeez and Gelato 41 as `071`. Same-day mint on the same farm/grow/manicure/silo would collide. Confirm the live 25H/26H codes.
2. **HBN immutability.** Slice 1 treats the minted HBN as identity. Say so in canon if that is the rule.
3. **`record_change_log.id`.** Uuid primary key on the log table, for insert identity and Postgres portability.
4. **Seed UNIQUE names.** `strains.name` and `dry_spaces.name` unique. Confirm before other boxes add duplicate display names.
5. **Generated Worker types.** Ignore `worker-configuration.d.ts` in git so G-8 is not broken by Cloudflare's generated comments.
6. **First person.** With people empty, the first admin add sets `created_by` to the new person's own id.
7. **SQL `||` concatenation** in strain dropdown labels is valid in both SQLite and Postgres. Call that out in PORTABILITY if desired.

## Open questions (also the owner flags; not resolved here)

- Batch and lot queue-exit is manual (Mark complete, Mark trimmed). Confirm that matches floor reality.
- The trailing YY segment now repeats the year already in YYDDD. Keep for continuity or drop: owner's call.
- Wet weight is a single `weight_grams` field; 25H carried wet spear and bucked wet separately. Deepening decision for the wet weights box.
- Dry space seed is Silo 1 to 5 only; hang locations get added in-app until ruled otherwise.
- Cloudflare Access must be configured on the Grip site before real crew data goes in (owner/Corey step, not code).
- Duplicate `hbn_code` 071 in the strain seed (see amendments).

## Dependencies and why

| Package | Role |
|---|---|
| hono | HTML routes and cookies, no client build |
| wrangler | dev, D1 migrations, deploy |
| typescript | `tsc --noEmit` |
| vitest | unit tests |

No other runtime or test-pool packages.

## Local run (owner)

From `app/`:

```
npm install
npm run db:migrate:local
npm run dev
```

`npm run dev` applies local migrations then starts wrangler. First apply may ask to confirm.

## Deploy commands (owner, logged in; do not run in this session)

Replace `TBD-grip-d1-id` and `TBD-c10-d1-id` in `app/wrangler.toml` after `wrangler d1 create`. Then from `app/`:

```
npx wrangler d1 migrations apply gripfactory-lite-grip --env grip --remote
npx wrangler d1 migrations apply gripfactory-lite-c10 --env c10 --remote
npm run deploy:grip
npm run deploy:c10
```

## Verification output (verbatim)

Sealed file list excludes `canon/`, `prompts/`, `node_modules/`, `.wrangler/`, `.smoke-persist/`, and generated `worker-configuration.d.ts`. This report file was written after that sealed pass.

```
===== node app/scripts/sealed-check.mjs =====
.gitattributes
  wc -c: 12
  sha256: e753774a5c6c845d5b43db5e4e133c8b7308c233f036517be1e2ae01cb068790
  tail80: * text=auto\n
.gitignore
  wc -c: 109
  sha256: cd67bb3245d5ebb3009f82e04730f6074130d3604982f1af317246112f62cee7
  tail80: /\n.smoke-persist/\n.dev.vars\n*.log\n.DS_Store\nThumbs.db\nworker-configuration.d.ts\n
app/migrations/0001_schema.sql
  wc -c: 3537
  sha256: af768aa379074a30ddd7df92e7db2f8361e72d1fa271895acdc302b5d1785b20
  tail80:  INDEX record_change_log_record ON record_change_log (record_table, record_id);\n
app/migrations/0002_lookup_seeds.sql
  wc -c: 2613
  sha256: 06afe00ca993a9e4c221f7c40ae2593f6cdca8076f0b8383812259a3ca9022cd
  tail80: 2026-08-27T00:00:00.000Z', NULL, '2026-08-27T00:00:00.000Z', NULL, NULL, NULL);\n
app/migrations/0003_strains.sql
  wc -c: 12175
  sha256: c19c23259a7993c978e1e8c92b8f392d7b0e8109ad9d522dbde355e4fff4ebd3
  tail80: 2026-08-27T00:00:00.000Z', NULL, '2026-08-27T00:00:00.000Z', NULL, NULL, NULL);\n
app/package-lock.json
  wc -c: 100243
  sha256: fcd3a5474eb43afffd4969817991f40ee3f1873a1a5ea30ee8b3c3ef4fe1e300
  tail80: ption": "^1.2.2",\n        "error-stack-parser-es": "^1.0.5"\n      }\n    }\n  }\n}\n
app/package.json
  wc -c: 688
  sha256: ca7e43da6b4938b35bbd448d336cdc2cbe79086bcdd9da39fdfbcc69a10f6be8
  tail80: ypescript": "^7.0.2",\n    "vitest": "^4.1.11",\n    "wrangler": "^4.127.0"\n  }\n}\n
app/PORTABILITY.md
  wc -c: 1594
  sha256: dc2e56633357db8094a59fcbc7880dcdc7d78910f9e7ec2fb764c596b92a3391
  tail80:  on the database to catch missing lookups; the app loads lookups before insert.\n
app/scripts/generate-strains.mjs
  wc -c: 1616
  sha256: 7848a60d47a73acf406c0d99aec053c09b9f262acfad82176f1016d284657cd4
  tail80:  "utf8");\nprocess.stdout.write(`Wrote ${rows.length} strains to ${outPath}\n`);\n
app/scripts/sealed-check.mjs
  wc -c: 1460
  sha256: d05b2a771714e5f27551f871e0baa66e33c1c06cccfffded5aeec352298a1d5d
  tail80:  tail80: ${visualized}\n`);\n}\nprocess.stdout.write(`files: ${files.length}\n`);\n
app/scripts/smoke.mjs
  wc -c: 11484
  sha256: 8308b6ef834a6aee1d6e6e3e4151437555f57fb5ac5033f4cdec44afd3ec086c
  tail80: ld);\n  }\n}\n\nrun().catch((err) => {\n  console.error(err);\n  process.exit(1);\n});\n
app/scripts/verify-final.mjs
  wc -c: 968
  sha256: e8fb2dd8737db87b7a95ad4b5cf619ecc9c051992a59eed9e4c85c6517174626
  tail80: pRoot);\n}\n\nmain().catch((err) => {\n  console.error(err);\n  process.exit(1);\n});\n
app/seed/strains.csv
  wc -c: 1691
  sha256: 40bb71aeb627b408edd8efa610cca1d42209e003874296f7677b0481bdf03361
  tail80: erry Sherbet,LCS,074\r\nApplescotti,AS,075\r\nGush Mintz,GM,076\r\nHeir Heads,HH,077\r\n
app/src/actions.ts
  wc -c: 23497
  sha256: a2fe25fc6a6d7c2eaaad447eeff131c2be36758370a2992f54ca4cf0ffecae70
  tail80: reate,\n      ts\n    ),\n  ]);\n  return { redirect: "/admin/lookups?ok=type" };\n}\n
app/src/audit.ts
  wc -c: 1159
  sha256: deea16c66a7b55bdc0d6f3d181a3ad8969020cd03854c52f6a01f128625fbe86
  tail80: number of grams, zero or greater.`);\n  }\n  return Math.round(n * 100) / 100;\n}\n\n
app/src/config.ts
  wc -c: 2689
  sha256: f4074fd1c9d09223a37568fc79b0df227a29100407de71f367e02aaefa148b24
  tail80:  TestOutcome {\n  return (TEST_OUTCOMES as readonly string[]).includes(value);\n}\n
app/src/csv.ts
  wc -c: 888
  sha256: 1885c9364689c2864d1e7654b712c92e3752f4d066aee4d177d7a4b36a42e4bc
  tail80: = row.values[col.field] ?? "";\n    return rec;\n  });\n  return toCsv(records);\n}\n
app/src/db.ts
  wc -c: 10143
  sha256: 9f47864b7d5111063ab520d1865449ad80c0f7ec1cbdaca355d1e7637c0203f5
  tail80:    reason,\n        changed_at: changedAt,\n      })\n    );\n  }\n  return stmts;\n}\n
app/src/html.ts
  wc -c: 11379
  sha256: c46a9017f424a19067f48b451b46c2f64820412503ce9b75685e5d12be77cab7
  tail80: r">${esc(message)}</div><p><a href="javascript:history.back()">Back</a></p>`;\n}\n
app/src/index.ts
  wc -c: 9684
  sha256: ed7b054e19653c6e9844a11733e77aac1f04643f411b0c260c112436ea53e576
  tail80: out[key] = await listQueueRows(db, q);\n  }\n  return out;\n}\n\nexport default app;\n
app/src/mint.ts
  wc -c: 2147
  sha256: 6064ead19f6707b28fc15cacb4b87813b3080b9c7b8bb907c50ee6438065c74b
  tail80: ed,\n  hbn: string\n): void {\n  if (existing) throw new HbnCollisionError(hbn);\n}\n
app/src/pages.ts
  wc -c: 7650
  sha256: c90406dbded3f16271c7fe397fa2e037d1977188407078006605167de0e9cd32
  tail80: label>\n      <button type="submit" class="danger">Void</button>\n    </form>`;\n}\n
app/src/pipeline.ts
  wc -c: 9375
  sha256: c1927f465ee45cd9d76d77519d2356089b96bf39c7321a2bfb1874fd0e47aa19
  tail80: ueDef[] {\n  return PIPELINE.filter((e): e is QueueDef => e.kind === "queue");\n}\n
app/src/theme.ts
  wc -c: 4841
  sha256: e17a701eb401c986538fc538c8df01b24cb9159abd8298d5cb248238d11cfb47
  tail80:  }\n.pkg-table { max-width: none; width: 100%; }\n.wide { max-width: none; }\n`;\n}\n
app/test/audit.test.ts
  wc -c: 721
  sha256: 1fb2e811a63269d8f4e56c2e4295048c8cbb286344a896cafd9fbbc8a414df40
  tail80:  => {\n    expect(requireReason("typo in zone")).toBe("typo in zone");\n  });\n});\n
app/test/mint.test.ts
  wc -c: 2124
  sha256: 99676dd0491a08e9e2ec1b007ddc45ecd06edb7eca01a97872cc127b30702ee5
  tail80: ged/);\n    expect(() => assertHbnAvailable(null, hbn)).not.toThrow();\n  });\n});\n
app/test/routing.test.ts
  wc -c: 1297
  sha256: b2f9e36fe6b17101aadd15f763b3b3e25ac25045e58d53e6885f0e1ab75e4b55
  tail80: nsition("released", "cryo_queue")).toThrow(/expected testing_queue/);\n  });\n});\n
app/tsconfig.json
  wc -c: 383
  sha256: 167aa5d340d3459e92c92a5d86c1ae63196b4f9b879e4f65c6fc7db43662cc62
  tail80:  },\n  "include": ["src/**/*.ts", "test/**/*.ts", "worker-configuration.d.ts"]\n}\n
app/vitest.config.ts
  wc -c: 157
  sha256: ef29635ea0d2ad7a34dc3817103abfde6592a014f1fdd1f7aeb8295dc378aca3
  tail80:   test: {\n    environment: "node",\n    include: ["test/**/*.test.ts"],\n  },\n});\n
app/wrangler.toml
  wc -c: 939
  sha256: 09fae2967584f66dde1c4f2d30e89207731da4a48e49ecd102376cf1902207b4
  tail80: ipfactory-lite-c10"\ndatabase_id = "TBD-c10-d1-id"\nmigrations_dir = "migrations"\n
files: 30

===== npx tsc --noEmit =====

===== npx vitest run =====

 RUN  v4.1.11 C:/Users/DennisWallace/Documents/Claude/Projects/gripfactory Practical/app


 Test Files  3 passed (3)
      Tests  18 passed (18)
   Start at  08:56:52
   Duration  192ms (transform 98ms, setup 0ms, import 137ms, tests 11ms, environment 0ms)


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
[wrangler:info] GET / 200 OK (76ms)
[wrangler:info] POST /admin/lookups/people 303 See Other (9ms)
[wrangler:info] POST /person 303 See Other (5ms)
[wrangler:info] GET /station/acquire_hbn 200 OK (18ms)
[wrangler:info] POST /station/acquire_hbn 303 See Other (22ms)
[wrangler:info] GET / 200 OK (19ms)
[wrangler:info] POST /station/acquire_hbn 409 Conflict (20ms)
[wrangler:info] GET /station/wet_weight 200 OK (15ms)
[wrangler:info] POST /station/wet_weight 303 See Other (17ms)
[wrangler:info] GET / 200 OK (21ms)
[wrangler:info] GET /station/trim_packages 200 OK (16ms)
[wrangler:info] POST /station/trim_packages 303 See Other (22ms)
[wrangler:info] GET / 200 OK (20ms)
[wrangler:info] GET /station/cryo_weight 200 OK (11ms)
[wrangler:info] POST /station/cryo_weight 303 See Other (14ms)
[wrangler:info] GET / 200 OK (19ms)
[wrangler:info] GET /queue/testing_queue 200 OK (11ms)
[wrangler:info] POST /queue/testing_queue/control 303 See Other (14ms)
[wrangler:info] GET / 200 OK (20ms)
[wrangler:info] POST /record/wip_packages/6b07a89f-3938-450c-a496-d8c8097a6a49/edit 303 See Other (12ms)
[wrangler:info] GET /log 200 OK (12ms)
[wrangler:info] POST /record/wip_packages/6b07a89f-3938-450c-a496-d8c8097a6a49/edit 400 Bad Request (10ms)
SMOKE PASS
[wrangler:info] GET /export/record_change_log.csv 200 OK (7ms)
```

Smoke asserted: empty queues; acquire mints `26244-ARL-GH-027-0-NA-26`; duplicate mint returns 409; HBN queue 1 after acquire and still 1 after wet weight; Dry Space 1 after wet; Cryo 1 after BUD+TRIM trim (BUD only); Testing 1 after cryo weight and 0 after release; change log contains the reasoned edit; reasonless edit returns 400.
