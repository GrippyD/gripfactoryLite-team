# 2026-10-02 Fresh frozen dry equivalent and Estimated Dry Total

BRIEF V23, THE FRESH FROZEN DRY EQUIVALENT AND ESTIMATED DRY TOTAL (canon 0.30.359), built in the worktree `branches/GFLiteOpsDashboard` under THE DISPATCH RULE (canon 0.30.155). The paste left the tree line for the Scribe to fill, so no hash was named to match. The app tree on disk before the first edit hashed `44d5aa43a1903380` (269 files), the V22 hand-back. The app tree after these edits hashes `7c508a9687242287` (269 files). No migration. The smoke pin stays 89. Not deployed. Nothing committed. Nothing pushed. No git was run.

## What changed

- On the Total box only, after Estimated Bud: Dry Equiv. Wt of Fresh Frozen (`ff_dry_equiv`) and Estimated Dry Total (`estimated_dry_total`). Pounds at 448 g, two decimals, thousands commas. No grams line. No farm box carries either key.
- The factor is one weighted dry-down for the season: dry grams over wet grams of every unloaded or trimmed lot of the harvest year with a dry weight above zero, the three farms pooled, frozen and freezer lots left out of the factor. With no such lot, both figures are a dash and the line is "no dry-down yet".
- Dry Equiv. Wt of Fresh Frozen is the factor times the wet weight of the lots V22 leaves out (status `frozen`, or a freezer space). The line is "{wet} lb frozen at {pct}% dry-down".
- The remaining-plants part is the Total box's Plants Remaining times its Wet Weight/Plant Avg in grams times the factor. With no average, that part is zero and the line is "no wet weight per plant".
- Estimated Dry Total is that part plus the Total box's Assumed Dry plus the fresh frozen equivalent. The line is "{n} plants left at {lb} lb each + Assumed Dry + fresh frozen". The look-back does not change them.
- EN and ES for the two labels and the lines.

## The floor, db_backups/20261002-171419_pre_cure_bar

The newest snapshot. Harvest year 2026. The factor is 22.9% over 55 unloaded or trimmed lots.

| | |
| --- | --- |
| Fresh frozen lots | 3, all PNN, in Blast Freezer(s): two status frozen, one still drying |
| Fresh frozen wet | 909,098 g, 2,029.24 lb |
| Dry equivalent | 208,523.25 g, 465.45 lb |
| Plants Remaining on Total | 56,413 (PNN 36,137, ARL 0, PNS 20,276) |
| Wet Weight/Plant Avg | 7,545.37 g, 16.84 lb, over 16,279 plants on 21 lots |
| Dry per remaining plant | 3.86 lb |
| Remaining plants in pounds | 97,634,561.19 g, 217,934.29 lb |
| Assumed Dry | 93,227,916.16 g, 208,098.03 lb |
| Estimated Dry Total | 191,071,000.61 g, 426,497.77 lb |

The Total lines would read "2,029.24 lb frozen at 22.9% dry-down" and "56,413 plants left at 3.86 lb each + Assumed Dry + fresh frozen". Admin's typed totals are 52,174, 11,748 and 36,445. Plants Remaining is those totals less the harvested the box shows.

## Assumptions for his word

- The paste named no tree hash. This slice stands on the V22 hand-back that was already on the disk.
- A freezer is `dry_spaces.space_type` or `kind` reading freezer, the same reading as V22. Blast Freezer(s) is `space_type` freezer and `kind` silo.
- The Wet Weight/Plant Avg used in the multiplication is the gram average the Total metric is built from. The gram sub-line rounds that average to a whole gram (7,545 g).
- Trimmed lots are in the factor with unloaded lots. A season with neither reads the dash.

## Gates

Run in the worktree's `app/`.

- `npm run typecheck`: exit 0.
- `npx vitest run`: 79 files, 1061 tests passed under `TZ=UTC`, and 79 files, 1061 tests passed under `TZ=America/New_York`.
- `node --check scripts/smoke.mjs`: exit 0.
- From-zero smoke (`SMOKE_PORT=9371`, `WRANGLER_SEND_METRICS=false`, `CI=1`, `TZ=UTC`): About to apply 89 migration(s), SMOKE PASS, no ` 500 ` line, exit 0 (18070 lines of log; the one ` 503 ` line is `POST /api/send`).
- Dash audit: 0 on the four files (U+2014 and U+2013). No CR byte on them. No key, secret, or password value. No personnel name.

## Deploy

Not deployed from this session. Nothing committed. Nothing pushed. No git was run.

## Sealed final check

```
the tree this slice opened on        44d5aa43a1903380 (269 files; the V22 hand-back; the paste named no hash)
npm run typecheck                     exit 0
TZ=UTC npx vitest run                 79 files, 1061 tests passed
TZ=America/New_York npx vitest run    79 files, 1061 tests passed
node --check scripts/smoke.mjs        exit 0
SMOKE_PORT=9371 WRANGLER_SEND_METRICS=false CI=1 TZ=UTC node scripts/smoke.mjs
                                      About to apply 89 migration(s); SMOKE PASS; " 500 " lines: 0; " 503 " lines: 1 (POST /api/send); exit 0
dash audit: 0; CR audit: 0; secret values: none; personnel data: none
the app tree after the edits             7c508a9687242287 (269 files)
```

```
app/src/console.ts                        163499  5b0e224ff1a8a92d
TAIL }
app/src/i18n.ts                           210811  fb5925a1d85808af
TAIL }
app/test/console.test.ts                   85413  17788e9caa085456
TAIL });
app/scripts/smoke.mjs                     734502  0e32252c886598a8
TAIL });
```
