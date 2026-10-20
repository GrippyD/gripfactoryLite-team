# DD S3c: % Complete (By Plant Count) (2026-10-19)

Worktree `branches/GFLiteMetrcAPI`. Tree received `14b04627b5cc68e6` (the S3b gated tree, 395 files). Tree left `0a3bfd792351f997`, 396 files. No git. Nothing is committed, pushed, or deployed. `canon/` and `prompts/` were not edited. `harvest.pct_complete` was not touched.

## What an operator sees

On the bizops wall, Shipments is gone. In its slot is `bizops.pct_finished_plants`, titled % Complete (By Plant Count) (ES % Completo (por conteo de plantas)), badge v1, no question mark. Two selects sit side by side: Grow Method (All, then Outdoor, Greenhouse, Indoor for each method that has a stored row) and Harvest Year (newest first, default the farm today's year). The picks are remembered in the browser. The face is one percentage for that pair, from today's stored row this year and from the last stored day of a past year. Under it: `1,557 of 1,818 plants` on the smoke floor, and for a past year `as of Oct 31, 2025`. A pair with no row says No data. A tap or hover on the number names the farm day and, for All, that it uses the Admin plant totals, or for one grow method that it counts lots and the mirror's live plants. Shipments remains on the sales wall.

The hourly cron (`15 * * * *`) and Admin, Director Dashboard, Recompute dashboard series write today's farm day only. Earlier days stay as they were written.

## Files

| file | bytes | sha256 |
| --- | ---: | --- |
| app/migrations/0108_dd_pct_finished.sql | 1531 | 06a9f3283dc8cae1 |
| app/src/ddsnapshot.ts | 57876 | cd2f7e35c09b7075 |
| app/src/directorregistry.ts | 107472 | 8730f39a0ecdb10a |
| app/src/director.ts | 95584 | e09f9ef567e7b5b4 |
| app/src/index.ts | 197385 | ac1f8a68b8cfbf49 |
| app/src/theme.ts | 234110 | 08317a5c0dc4c724 |
| app/src/i18n.ts | 370436 | 22b093aee106b20a |
| app/test/ddsnapshot.test.ts | 38969 | ea91dbeb5fc7342f |
| app/test/director.test.ts | 100731 | 6967bd7e22ae7f16 |
| app/scripts/smoke.mjs | 904928 | f25efa8e9c374085 |

Dash and CR scan of those ten files: U+2013 0, U+2014 0, CR 0. The new migration and the new series code name nobody. Name hits in the other files are text those files already carried.

`bizops.pct_finished_plants` uses `stale_after_hours` 30, the same window as the other daily app rows. The brief did not name a season, so the tile is in season all year.

Moved by destination site stays on bizops. Its parent left that wall, so it renders as its own tile. Its registry row was not otherwise changed.

## Gates

Typecheck: `npx tsc --noEmit` exit 0.

Vitest TZ=UTC:

```
Test Files  113 passed (113)
Tests  1636 passed | 6 skipped (1642)
```

Vitest TZ=America/New_York:

```
Test Files  113 passed (113)
Tests  1636 passed | 6 skipped (1642)
```

`node --check scripts/smoke.mjs` exit 0.

From-zero smoke: exit 0, about 133 s. `About to apply 107 migration(s)`. `SMOKE PASS`. Lines containing ` 500 `: 0. Lines containing ` 503 `: 1 (`POST /api/send`, the smoke's own step). The hourly passes logged `[pct finished] wrote 3 rows`, then `0`, then `2`, then `0`. The Recompute button logged `wrote 3 rows`. The bizops wall showed % Complete (By Plant Count), v1, and a percentage. Shipments was absent there and present on the sales wall.

Browser, on the smoke database, CO, Lite, and Cerberus. At 1920 and at 820 the page scroll width equals the client width and the two selects sit on one line. On the phone (390, `device-phone`) the same holds and the percentage button stays its own width. Grow Method was set to Outdoor (the face became 64.5%, 20 of 31 plants) and Harvest Year was set to 2026. A tap on the number showed `2026-10-19. Counts lots and the mirror's live plants.` Theme ink followed the sheet: Lite rgb(28, 25, 20) on rgb(243, 239, 230), Cerberus rgb(244, 244, 245) on rgb(12, 12, 14), CO rgb(233, 233, 234) on rgb(14, 15, 17).

## Declined

There is no live-data bench in this worktree, so there is no floor timing and no check of the stored All figure against the live `/harvest` Total box. The unit test drives `consoleBoxes` and `refreshPctFinished` on one fixture.

## Close

Tree left `0a3bfd792351f997`. Nothing is committed, pushed, or deployed. The Scribe gates. The owner merges. This slice carries migration 0108, so the merge block takes a snapshot first.
