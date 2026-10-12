# 2026-10-12 HB1: the harvest batch feed (BRIEF HB1): SEALED

BRIEF HB1 `BRIEFS/2026-10-10_harvest_batch_feed.md`, built in `branches/GFLiteMetrcAPI`. The pin was checked before any edit, with canon's hash command run in `app/` (Git Bash `sha256sum` binary marker read back to two spaces, `wrangler.toml` already LF): `9946b785e98d1be9`, 355 files, migrations 0001-0098. The brief header names the dispatch at canon 0.30.439. This worktree's `canon/CANON.md` last row is 0.30.429. The brief was built as written.

Worker only. No migration. No git, nothing committed, pushed, or deployed.

## What was built

`GET /feeds/harvest-batches.json` on the trim weighs door. The `/feeds/` prefix is already a service route, so the same token and the same guard answer it. The query is the trim feed's parser: `since` an ISO instant, strictly after `changed_at`; `limit` 1 to 2000, 500 by default; `live=1` drops voided lots; `site` a farm code. A bad query answers 400 in words as JSON. The body is JSON, `cache-control: no-store`. The envelope is `feed`, `generated_at`, `since`, `site`, `count`, `next_since`, `more`, `rows`. A page never ends inside one change instant (the tie rides along past the limit).

One row per wet lot (`wet_weight_entries.id` is the puller's key). A batch weighed as two lots is two rows.

The six defaults:

1. `grow_method` is `indoor`, `outdoor`, or `greenhouse` from the HBN grow code (ID, OD, GH). It is not the license.
2. `dry_weight_grams` is the live sum of non-voided dry rows while unloading, null until the first. `unload_finished_at` is the final signal: the newest finished unload's Effective Date when one was typed, else the Eastern date of that finish (the Dry Weight by Strain date). Null until Finish unload.
3. A voided lot rides with `voided_at` set. `live=1` drops it.
4. A lot whose HBN does not parse still rides. `farm` falls back to the stored farm. `short_id`, `grow_method`, `harvest_day`, `dry_method`, and `hbn_parts` are null.
5. `strain` is null when the batch has none. `market_strain` is the typed market label, else the strain's own name.
6. `?site=` filters by the HBN's farm segment, the stored farm when the HBN is not a seven-segment mint.

Test HBNs (`is_test` 1) never ride. `customer` is null for Grip's own lots. This tree has no `harvest_batches.customer` column (T1's migration is 0099, in the other worktree). The feed reads `PRAGMA table_info(harvest_batches)` and selects `b.customer` only when that column is there, so the same worker names a toll customer once the column is live.

`changed_at` is the latest of the lot, the batch, a wet read, a dry row, an unload session (including Finish unload), and a silo load. D1 refuses a compound SELECT past a few terms (five terms ran, eleven did not), and scalar `max()` goes null when any argument is null, so each stamp is coalesced to a blank, which sorts before every ISO instant. `created_at` is never null, so the result is always a real instant.

`wet_weight_grams` is the sum of the lot's non-voided wet reads, the header when that sum is empty. `dry_space` is the space name Move To or Load Silo last left, or `Truck N` when the lot sits on the truck sentinel. `hbn_parts` is the trim feed's reading of the HBN.

## Files (all under `app/`, plus this report)

| file | bytes | sha256 (16) | what |
|---|---|---|---|
| `src/feeds.ts` | 26,071 | `6ab09f9cb87ab559` | the harvest batch feed beside the trim feed |
| `src/index.ts` | 186,146 | `ab5e9aeef93e1c16` | `GET /feeds/harvest-batches.json` |
| `test/feeds.test.ts` | 26,260 | `942287132f22fa9e` | the query, the tie, the row, the customer column |
| `scripts/smoke.mjs` | 847,727 | `eb46cbdd8dbc6994` | the two smoke lots, live=1, since=, limit=1, the two 400s, JSON, no-store |

`src/service.ts` is unchanged. The guard is the `/feeds/` prefix.

## Sealed final check

```
THE TREE                              07e25225df06a03f (355 files, 0001-0098), on the pin 9946b785e98d1be9; disk the same
npm run typecheck                     exit 0
TZ=UTC npx vitest run                 102 files, 1503 tests passed
TZ=America/New_York npx vitest run    102 files, 1503 tests passed
node --check scripts/smoke.mjs        exit 0
CI=1 SMOKE_PORT=9473 npm run smoke    About to apply 98 migration(s); SMOKE PASS; exit 0; " 500 " lines: 0
dash audit (by character): 0; CR audit: 0; personnel names: none
```

## After the deploy (owed to the puller)

The URL `https://gripfactory-lite-grip.gflite.workers.dev/feeds/harvest-batches.json`. The same token that opens the trim weighs feed opens this one. The fields are the row above. Dry grams are partial until `unload_finished_at` is set. The count of lots whose `strain` is null is read on the first poll after deploy, so the 49 can be reconciled against the app's own rows. This session did not deploy and did not read the live database.
