# DD S3g: Testing Throughput on the Business Operations wall (2026-10-19)

Worktree `branches/GFLiteMetrcAPI`. Tree received `4496aa03aa378d12` (424 files, the tree WL2 left). Tree left `d2719df79350d5fe`, 427 files. No git. Nothing is committed, pushed, or deployed. `canon/` and `prompts/` were not edited. No screenshots and no browser renders, per the render law. The Scribe renders the Business Operations wall in Lite, CO and Cerberus at the gate. Migration 0118.

## What a reader sees

Business Operations keeps BTR. Testing Throughput sits directly after it, live, version 1, on that wall only. The head is Testing Throughput (ES Rendimiento de pruebas).

The tile reads `lab_samples`, grouped by day. The period select is 7 days, 14 days, 30 days, or HTD. The server paints 14 days. The browser remembers `dd.testing_throughput.period` and recomputes the three boxes, the count lines, and the test-type split for the chosen window.

AVG Tests/Day is samples by intake date over intake dates that have any sample. AVG COAs/Day is completed samples by the farm day of the COA, over days that have any COA. AVG TAT is the average stored `tat_days` of completed samples whose COA farm day is in the window, to one decimal. An empty window says No data. Under the boxes, TagLeaf last loaded prints the farm clock from `lab_samples_last_load`, in the warning token when that instant is missing or older than a day. Hover or tap lists First-time, Retest, and Internal QA.

## Files

| file | bytes | sha256 |
| --- | ---: | --- |
| app/migrations/0118_dd_testing_throughput.sql | 1517 | 2e70eccafb85bb56 |
| app/src/testingthroughput.ts | 19031 | ed6da984a21e59e5 |
| app/src/directorregistry.ts | 115036 | 2a39bebd95d61614 |
| app/src/director.ts | 106824 | d997c3a8db0f89ce |
| app/src/theme.ts | 249565 | b6b6d4958b0e7f91 |
| app/src/i18n.ts | 392717 | 204e4e462a4cc202 |
| app/test/director.test.ts | 118411 | c5ab4931bf61dead |
| app/test/testingthroughput.test.ts | 3515 | a3596f96d6bb4a01 |
| app/scripts/smoke.mjs | 958640 | cc97709d75fb2d96 |

Dash and CR scan of those nine files: U+2013 0, U+2014 0, CR 0. The smoke rows use invented lab codes (TT-SMOKE-001, TT-SMOKE-002, TT-SMOKE-003) and invented strains. No export row, buyer name, license, or manifest was copied. No TagLeaf, Access, or connector token is stored or logged.

Tails (last lines):

- `0118_dd_testing_throughput.sql`: the guarded INSERT, then the `WHERE NOT EXISTS` line
- `testingthroughput.ts`: `` </script>`; `` / `}`
- `directorregistry.ts`: the seed INSERT return, then `}`
- `director.ts`: the share return, then `}`
- `theme.ts`: `` </style>`; `` / `}`
- `i18n.ts`: `refusalText` return, then `}`
- `director.test.ts`, `testingthroughput.test.ts`: `});` / `});`
- `smoke.mjs`: `process.exit(1);` / `});`

## Gates

Typecheck: `npx tsc --noEmit` exit 0.

Vitest TZ=UTC:

```
Test Files  123 passed (123)
Tests  1690 passed | 6 skipped (1696)
Duration  35.68s
```

Vitest TZ=America/New_York:

```
Test Files  123 passed (123)
Tests  1690 passed | 6 skipped (1696)
Duration  35.05s
```

`node --check scripts/smoke.mjs` exit 0.

From-zero smoke exited 0. It printed `About to apply 117 migration(s)`, `SMOKE PASS` and `SMOKE_EXIT 0`. The Business Operations wall returned 200. No response in the log is a 500. The log lines:

```
About to apply 117 migration(s)
GET /admin/director/bizops 200 OK (61ms)
SMOKE PASS
SMOKE_EXIT 0
```

## Decided

- HTD is the harvest year from January 1 through today, the same year window the other S3 tiles use. The denominators are working days, so a year whose first intake is later has the same Tests/Day as a window that starts on that first intake.
- The three rates show one decimal, as the tile example "5.2 days" and the TAT law say. The bench figure 5.24 is the unrounded mean. The Scribe's check on the live export is still his.
- Test type names: a value that starts with first is First-time, retest or re-test is Retest, and a value that contains qa or internal is Internal QA. Anything else keeps its trimmed name, or Other when blank.
- The COA farm day is the America/New_York date of the hour bucket of `coa_posted_at`.
- The sort bump is guarded. Rows that sort after BTR move up by 10, and the new row takes BTR's sort plus 10, so it stays directly after BTR. `seedKpiList` omits the new key, so the 0105 seed text stays byte for byte.
- The count line keeps the English word "over", the same sentence the server paints. The nouns go through `i18n.ts`. Keys that already existed (7 days, days, No data, Period, HTD) were left as they were.
- The tile body is a grid of three boxes (`minmax(0, 1fr)`), not a `table.data`, so the phone theme does not put it in a sideways scroll. It is not a sparkline. The registry is 79 rows. The home spreads 75 tiles.

## Declined

Nothing in the brief was left out. There is no free from-to box. The period select is the four choices the brief names.

Tree left `d2719df79350d5fe`. Nothing is committed, pushed, or deployed. The Scribe gates. The owner merges. This slice carries migration 0118, so the merge block takes a snapshot first.
