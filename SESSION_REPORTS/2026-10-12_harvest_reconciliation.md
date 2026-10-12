# 2026-10-12 HR1: harvest weight reconciliation (BRIEF HR1): SEALED

BRIEF HR1 `BRIEFS/2026-10-12_harvest_reconciliation.md`, built in `branches/GFLiteMetrcAPI`. The pin was checked before the slice. Three files were stored as CR LF copies of the pinned bytes (`migrations/0100_sensor_hourly.sql`, `src/sensorhistory.ts`, `test/sensorhistory.test.ts`). Restored to LF, they match the gate hashes, and canon's hash command in `app/` (Git Bash `sha256sum`, the binary marker read as two spaces, `wrangler.toml` already LF) read `785104eee78a1c6e`, 358 files, migrations 0001-0098 plus 0100. The brief header names the dispatch at canon 0.30.449. This worktree's `canon/CANON.md` last row is 0.30.429. The brief was built as written.

No migration. No git, nothing committed, pushed, or deployed.

## What was built

`/reports/harvest_reconciliation` is on the Reports menu in English and Spanish. From and To follow Dry Weight by Strain: blank From is 30 days before today, blank To is today, cap 366. Farm is blank, PNN, PNS, or ARL. Grow method is blank, indoor, outdoor, or greenhouse. The range is `harvest_batches.entry_date`, named in the footnote. Read only.

One row per live wet lot (not a test HBN). The short id is the last 5 of the HBN. Strain and market strain follow Dry Weight by Strain: the market name is blank when it is the real strain. Wet grams are the live sum of the lot's wet reads, or the header when that sum is empty. Dry grams are the live sum of dry rows, blank when the lot has none. Pounds are shown at 448 g and at 453.59237 g, with the difference. A lot with no live mirror harvest is flagged "No METRC harvest". A mirror harvest whose start falls in the window, and whose name is not a live lot's HBN, is listed under the table as "METRC only". The mirror weight is converted from the unit the row carried (grams, pounds, kilograms, ounces) into the standard pound, and the unit is shown. An unknown unit leaves the pound blank.

The wet total and the dry total sit under the lot lines. The dry total sums only lots that have a dry weight. The ratio line is computed, not stored: (453.59237 - 448) / 448 is 1.2483 percent. The brief's 1.2494 was not written in.

Harvest hours live on `harvest_labor_hours` (work date and farm). Under the totals, wet pounds per hour are stated at both pounds from that table, for the same dates, and for the chosen farm when one is set. A grow filter does not divide: the table has no grow method, and the line says so. Trim, prepack, and pasteurization hours are not used. The reads bind their dates, the mirror name lookup is chunks of 90, and nothing reads `sensor_readings`.

`scripts/smoke.mjs` `localD1All` retries a Windows disk I/O error for 20 seconds, the same handoff `localD1WhenFree` already covers for a write. The first two smoke runs died on that error at the METRC stub handoff, before this report's checks. The third run passed.

## Files (all under `app/`, plus this report)

| file | bytes | sha256 (16) | what |
|---|---|---|---|
| `src/harvestreconciliation.ts` | 23,706 | `1b9200ffb6009e6c` | the reads, the view, the CSV |
| `src/index.ts` | 187,568 | `481e41d80739a7d1` | the report route |
| `src/i18n.ts` | 323,723 | `5c1a3de74e38b474` | the report's words, EN and ES |
| `src/reports.ts` | 36,413 | `4a6739c5e6eecca4` | the report key, the menu card, the slot under the table |
| `src/html.ts` | 197,875 | `3640337d727c5a2d` | that slot, between the table and the footnote |
| `test/harvestreconciliation.test.ts` | 15,245 | `68eb6f69715881fe` | the pounds, the filters, the mirror, the hours, the SQL |
| `test/console.test.ts` | 97,740 | `6523ce619b9838a0` | the report list length, 15 to 16 |
| `scripts/smoke.mjs` | 854,502 | `5bad5547eaa939a0` | the report and its CSV, the read retry |

`npm run typecheck` rewrote `worker-configuration.d.ts`. It is not part of this slice and it is not in the tree hash.

## Sealed final check

```
THE TREE                              352ccfe1408a1888 (360 files, 0001-0098 plus 0100), on the pin 785104eee78a1c6e
npm run typecheck                     exit 0
TZ=UTC npx vitest run                 104 files, 1516 tests passed
TZ=America/New_York npx vitest run    104 files, 1516 tests passed
node --check scripts/smoke.mjs        exit 0
CI=1 SMOKE_PORT=9493 npm run smoke    About to apply 99 migration(s); SMOKE PASS; exit 0; " 500 " lines: 0
dash audit (by character): 0; CR audit: 0; personnel names: none
```

The UTC and Eastern vitest lines, both:

```
 Test Files  104 passed (104)
      Tests  1516 passed (1516)
```

The passing smoke's apply line and pass line: `About to apply 99 migration(s)` and `SMOKE PASS`. `GET /reports/harvest_reconciliation` answered 200, and the CSV on the same dates answered 200.

## After the deploy (owed to no one outside)

Nothing to anyone outside. The owner reads the two totals against the 10/9 figures. The pounds-per-hour line is `harvest_labor_hours` for the report's dates. This session did not deploy.
