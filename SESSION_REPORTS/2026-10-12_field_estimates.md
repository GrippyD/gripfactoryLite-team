# 2026-10-12 FE1: field estimates lookup (effective dated): SEALED

BRIEF FE1 `BRIEFS/2026-10-12_field_estimates.md`, built in `branches/GFLiteMetrcAPI`. The pin was checked before any edit, with canon's hash command run in `app/` (Git Bash `sha256sum`, the binary marker read as two spaces, `wrangler.toml` already LF): `352ccfe1408a1888`, 360 files, migrations 0001-0098 plus 0100. The brief was built as written.

One migration, `0102_field_estimates.sql`. 0099 and 0101 are not in this worktree. No git, nothing committed, pushed, or deployed.

## What was built

`/admin/field_estimates` sits on Admin Settings beside Lookups. The back link returns to Admin Settings. The Admin PIN already on `/admin/*` fronts the page and both posts.

The form asks for a live strain, a live farm, an effective date, a dry weight, and a memo. The date opens on the farm's today (`farmToday`). The weight is labeled "dry lb (448 g)" in English and in Spanish. The number is stored as typed. It is not multiplied by `GRAMS_PER_LB`.

For a strain, a farm, and a date D, `estimateFor` returns the live row with the greatest `effective_date` on or before D. A later row leaves earlier dates reading the older row. Saving the same date updates that row and logs the change. A blank memo is kept as null. Removing a row sets `deleted_at` and writes one change log row; the read then falls back to the older live row. `estimatesAsOf` returns one live row per strain and farm pair in force on a date. The list shows each pair's rows newest first and marks the row in force today.

The resolution read searches `field_estimates_lookup`:

```
SEARCH field_estimates USING INDEX field_estimates_lookup (strain_id=? AND farm_code=? AND effective_date<?)
```

`estimatesAsOf` scans `field_estimates_live` and searches `field_estimates_lookup` for the winning date of each pair.

## Files (all under `app/`, plus this report)

| file | bytes | sha256 (16) | what |
|---|---|---|---|
| `migrations/0102_field_estimates.sql` | 855 | `491010d1f110456a` | the table, the live unique index, the lookup index |
| `src/fieldestimates.ts` | 14,448 | `e8fca57e848de912` | the resolution reads, the save, the remove, the page |
| `src/index.ts` | 188,407 | `73b8e082e0a4ac72` | the page and the two posts |
| `src/i18n.ts` | 326,049 | `3ac80a345bbf3677` | the page's words, EN and ES, the weight label the same in both |
| `src/html.ts` | 197,958 | `45d0e01f993dd9c8` | the Admin Settings tile beside Lookups |
| `src/nav.ts` | 6,142 | `95fca25200406efb` | the back link to Admin Settings |
| `test/fieldestimates.test.ts` | 18,210 | `e3cb2be965f423da` | resolution, validation, the date default, i18n, the guard, the report count, the plan |
| `test/admincleanup.test.ts` | 4,676 | `ff8bdba2b29840ee` | the settings tile order |
| `test/nav.test.ts` | 9,096 | `481f3d46d331dfdc` | the back link |
| `scripts/smoke.mjs` | 856,920 | `3165c09238186f25` | 100 migrations, the page, one posted row |

`npm run typecheck` rewrote `worker-configuration.d.ts`. It is not part of this slice and it is not in the tree hash.

## Sealed final check

```
THE TREE                              e7bd19cbcad90250 (363 files, 0001-0098 plus 0100 and 0102), on the pin 352ccfe1408a1888
npm run typecheck                     exit 0
TZ=UTC npx vitest run                 105 files, 1521 tests passed
TZ=America/New_York npx vitest run    105 files, 1521 tests passed
node --check scripts/smoke.mjs        exit 0
CI=1 SMOKE_PORT=9494 npm run smoke    About to apply 100 migration(s); SMOKE PASS; exit 0; " 500 " lines: 0
dash audit (by character): 0; CR audit: 0; personnel names: none
```

The UTC and Eastern vitest lines, both:

```
 Test Files  105 passed (105)
      Tests  1521 passed (1521)
```

The passing smoke's apply line and pass line: `About to apply 100 migration(s)` and `SMOKE PASS`. `GET /admin/field_estimates` answered 200, the post answered 303, and the stored weight was 2.5.

The page was also opened in a browser on the local worker. The PIN gate stood first. After unlock, the date field read 2026-10-12, and the smoke row (2.5, today) was marked in force. Saving the same strain and farm on 2026-11-01 at 4 listed that row first and left 2.5 in force. In Spanish the heading was Estimaciones de campo, the in-force mark was En vigor, and the weight label stayed dry lb (448 g). Admin Settings lists Estimaciones de campo beside Consultas.

## After the deploy (owed to no one outside)

Nothing to anyone outside. This session did not deploy.
