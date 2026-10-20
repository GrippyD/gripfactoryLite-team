# DD S3f: Trim Throughput (2026-10-19)

Worktree `branches/GFLiteMetrcAPI`. Tree received `7cea680de7fb19e3` (the S3e gated tree, 402 files). Tree left `9fe0de4758e872de`, 405 files. No git. Nothing is committed, pushed, or deployed. `canon/` and `prompts/` were not edited. `harvest.trim_lb_per_dlh` was not touched.

## What an operator sees

On the bizops and farmops walls, Percent finished (plants) is gone. In its slot is `bizops.trim_throughput`, titled Trim Throughput (ES Rendimiento de recorte), badge v1, no question mark. The row `harvest.pct_complete` stays, with active 0. S3c's % Complete (By Plant Count) stays where it is.

The tile has Period (7 days, 14 days, 30 days, HTD; default 14), Strain, and Dry Method. Three boxes: Trim TP Days, Trim TP Nights (the second shift), and Weighted TP. Each shows lb/DLH to two decimals, with the pounds and hours under it. A strain or dry method says "hours shared by lbs". A shift day with pounds and no hours is left out of that box and counted ("N shift days without hours"). No output in the selection says "No data". A tap or hover on a box states the formula and the counts.

Hours are typed per shift per day. With a strain or dry method picked, that shift day's hours are shared by the selection's share of the shift's pounds, so the rate on that shift day stays the shift's own rate. Across days a filtered box differs from All by which shift days the selection ran on, and by how much of each mixed shift day it takes. It is not a per strain speed.

Hang in Place is `dry_spaces.kind` hang. Migration 0057 stored that room as `space_type` dry_room, so kind hang is what separates it from a dry room. A `space_type` of hang maps the same way. Arlington Dry Room is kind silo and space_type dry_room, so it is Dry Room. A silo is Silo.

## Files

| file | bytes | sha256 |
| --- | ---: | --- |
| app/migrations/0111_dd_trim_throughput.sql | 1540 | f5ac7702a554db69 |
| app/src/trimthroughput.ts | 33778 | 95d1f9546175e00b |
| app/src/ddsnapshot.ts | 58091 | d5f2fe205a82358f |
| app/src/directorregistry.ts | 110386 | 34a21a90dc9f5fe8 |
| app/src/director.ts | 98315 | 024361dde49e8b0e |
| app/src/index.ts | 197784 | 4988f2486d6c424d |
| app/src/i18n.ts | 376690 | 19396da0bb3ca7d9 |
| app/src/theme.ts | 239014 | e1b6ade8e9d93a14 |
| app/test/director.test.ts | 110632 | 16bbc26d3881a43d |
| app/test/trimthroughput.test.ts | 11604 | 37567056a055aedf |
| app/scripts/smoke.mjs | 918870 | a7c598a91edc90cd |

Dash and CR scan of those eleven files: U+2013 0, U+2014 0, CR 0. The new migration and the new tile code name nobody. The test and the smoke use the seeded shift lists Olga and Victor.

## Gates

Typecheck: `npx tsc --noEmit` exit 0.

Vitest TZ=UTC:

```
Test Files  116 passed (116)
Tests  1652 passed | 6 skipped (1658)
Duration  37.87s
```

Vitest TZ=America/New_York:

```
Test Files  116 passed (116)
Tests  1652 passed | 6 skipped (1658)
Duration  39.14s
```

`node --check scripts/smoke.mjs` exit 0.

From-zero smoke: exit 0. `About to apply 110 migration(s)`. `SMOKE PASS`. The recompute log includes `[trim throughput] wrote 9 rows`. Lines containing ` 500 `: 0. The bizops wall showed Trim Throughput, v1, Days 1.88 lb/DLH (15.00 lb, 8.00 h), Nights 2.00 (20.00 lb, 10.00 h), Weighted 1.94 (35.00 lb, 18.00 h). Percent finished (plants) was absent. The planned Trim throughput and lbs per DLH tile was still on the wall. The smoke's from-zero count check moved from 109 to 110 with this migration.

Browser, on the smoke database. Continuum at about 1920: page scroll width equals the client width (1905). A strain pick (Tp Alpha) kept the day rate at 1.88 and changed the hours to 5.33 with "hours shared by lbs". Weighted moved to 1.96, which is the summed pounds over the summed hours, not the mean of the two boxes. Hang in Place showed 5.00 lb over 2.67 h at the same 1.88 rate, and Nights said No data. A tap on Days showed: "Day shift pounds over hours shared by the selection's share of that shift's pounds. 5.00 lb over 2.67 h 1 package 1 shift day". At 820 the document, the bar, and the tile each have scroll width equal to client width. On the phone (390, device-phone) the same holds and the three boxes stack. Lite is the light theme. Grip (Cerberus) at 1920 is the dark theme, scroll width 1905 equals client width, and the three boxes sit in one row.

## Declined

There is no live-data bench in this worktree, so there is no floor timing and no check of two days against /harvest's Trimming section.

## Close

Tree left `9fe0de4758e872de`. Nothing is committed, pushed, or deployed. The Scribe gates. The owner merges. This slice carries migration 0111, so the merge block takes a snapshot first. All of S3a to S3f go out in one push.
