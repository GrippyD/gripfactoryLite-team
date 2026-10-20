# TL1: the lab samples door (2026-10-19)

Worktree `branches/GFLiteMetrcAPI`. Tree received `0a7d248251529ea9` (the S3f gated tree, 405 files). Tree left `1c1672f779290674`, 408 files. No git. Nothing is committed, pushed, or deployed. `canon/` and `prompts/` were not edited.

## What an operator sees

Admin Settings has a Lab Samples tile, behind the Admin PIN. The page is the upload, the last load line, and the counts (samples, completed, in process, newest intake, newest COA). Rows are not edited here.

The upload reads the TagLeaf workbook's Samples sheet by header name. The other sheets are ignored. `POST /feeds/lab-samples.json` takes `{ "rows": [ ... ] }` with those same header names, at most 2,000 rows. It sits under `/feeds/`, so Cloudflare Access fronts it. The worker holds no new secret and does not print, log, or store a token. On the Access-fronted worker a service actor may POST this path. The owner adds the tagleaf-pusher service token by his hands before the script runs.

Both doors upsert by lab code. An unchanged row writes nothing. A changed row updates its fields and `changed_at` and logs the changed fields to `record_change_log` with reason `lab samples upload` or `lab samples feed`. A new lab code inserts. Rows missing from a later file stay. A row with no lab code, or an unreadable intake date, is refused and named (first 20). The others still land. The answer is the page banner, or JSON for the feed: received, inserted, updated, unchanged, refused. `app_config` key `lab_samples_last_load` keeps the newest load's instant, source, and counts.

His export's Samples sheet has no lab name column, so `lab_name` stays blank unless a row carries `Lab Name`. `Total THC %` in that workbook is an Excel percent (cached 0.1612 to 0.333). A number at or under 1 is stored as the percent a person reads (0.2743 becomes 27.43). A number already over 1 is kept. Eastern COA times become ISO instants. Intake dates become YYYY-MM-DD. Grams and CFU counts are whole numbers, round half up.

## Files

| file | bytes | sha256 |
| --- | ---: | --- |
| app/migrations/0112_lab_samples.sql | 889 | 00caa880a6c92828 |
| app/src/labsamples.ts | 25606 | e84928869151cc53 |
| app/src/service.ts | 3372 | b29ed533b7fe5224 |
| app/src/html.ts | 199474 | 8ba54f900750b843 |
| app/src/nav.ts | 6374 | 73e76e4d5eca88a4 |
| app/src/theme.ts | 239471 | 3ae155b0575f1ecd |
| app/src/i18n.ts | 378766 | 2764c63773565a4c |
| app/src/index.ts | 199858 | ee6126ca0f597ea0 |
| app/test/labsamples.test.ts | 16649 | f9f0de8350dd709d |
| app/test/service.test.ts | 9083 | c4ccea09e57a1a63 |
| app/test/admincleanup.test.ts | 5006 | 4cdda6185abdb25b |
| app/scripts/smoke.mjs | 925802 | 558fc7d700272bf3 |

Dash and CR scan of those twelve files: U+2013 0, U+2014 0, CR 0. The new migration, the new door, and its test name nobody. Name hits in the edited files are lines that were already there.

## Gates

Typecheck: `npx tsc --noEmit` exit 0.

Vitest TZ=UTC:

```
Test Files  117 passed (117)
Tests  1658 passed | 6 skipped (1664)
Duration  10.65s
```

Vitest TZ=America/New_York:

```
Test Files  117 passed (117)
Tests  1658 passed | 6 skipped (1664)
Duration  10.26s
```

`node --check scripts/smoke.mjs` exit 0.

From-zero smoke: exit 0. `About to apply 111 migration(s)`. `SMOKE PASS`. Lines containing ` 500 `: 0. The smoke uploaded a three row workbook (a Notes sheet beside it was ignored): 3 samples, 2 completed, 1 in process, newest intake 2026-10-19, newest COA 2026-10-04 09:00. The same three rows posted to the feed wrote 0.

His export, read on this machine and not put in the repo: 1,096 samples, 814 completed, 282 in process, 0 refused.

Browser, on the smoke database. Admin Settings lists Lab Samples. The page shows the upload, the last load, and the counts. Scroll width equals client width, and the section fits inside it:

| view | 1920 | 820 | phone (390, device-phone) |
| --- | --- | --- | --- |
| Lite | 1920 = 1920 | 820 = 820 | 390 = 390 |
| CO | 1920 = 1920 | 820 = 820 | 390 = 390 |
| Cerberus (Grip) | 1920 = 1920 | 820 = 820 | 390 = 390 |

Lite is the light theme. CO and Cerberus are the dark themes.

## Declined

Nothing. The export is not in the repo. Its Read Me names a person, so it stays on the bench.

## Close

Tree left `1c1672f779290674`. Nothing is committed, pushed, or deployed. The Scribe gates. The owner merges with the rest. This slice carries migration 0112. He adds the tagleaf-pusher service token on Cloudflare Access by his hands before the script runs.
