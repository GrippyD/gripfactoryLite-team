# 2026-10-05 Harvest hours to date

MINI BRIEF R4, HARVEST HOURS TO DATE ON THE TOTAL PANE (canon 0.30.409). R3 was not on this worktree (no session report, and `src/console.ts` had no `btr_to_date`), so this session built R4 alone on the live pin. The text-mode tree hash at the start was `335dfa13121944d5` (299 files, migrations 0001 to 0094). No migration. The smoke pin stays 94. Not deployed. Nothing committed. Nothing pushed. No git was run.

## The figure

On the Plants Total pane, right after Harvest Hours, a metric "Harvest Hours to date" (ES "Horas de cosecha a la fecha"). It sums every work date of the harvest year through the day under view. Each date uses the day's rule: the ALL row when one stands, otherwise the sum of that date's farm rows. A later date stays out. Another year's rows stay out. Clicking a day shows the total through that day.

Under the number, in small type, "since {date}" (ES "desde {date}"), the earliest work date in the sum. With no rows, the line says "type hours", the same words Harvest Hours uses when the day is empty. The farm panes are unchanged. Harvest Hours and Weight/DLH stay the day's figures.

Through 2026-09-28 the unit sum of the farm days in the brief's check is 25,631.84. Through 2026-10-02, with the ALL days added and an ALL row preferred over farm rows on the same date, it is 32,166.84.

## The page

On the smoke database, today (2026-10-05) showed 2,777.75 since 2026-10-03: the sheet's 2,753 on 2026-10-03 and 24.75 on 2026-10-04. Today's Harvest Hours box was empty, and Weight/DLH still said "type hours". The figure is on Total only. Lite, CO, and Cerberus at 1920 wide, and phone width in CO, all showed it in that place. Spanish reads "Horas de cosecha a la fecha" and "desde 2026-10-03".

## Gates

- `npx tsc --noEmit`: exit 0.
- `npx vitest run`: 91 files, 1225 tests passed under `TZ=UTC`, and 91 files, 1225 tests passed under `TZ=America/New_York`.
- `node --check scripts/smoke.mjs`: exit 0.
- From-zero smoke (`SMOKE_PORT=9421`, `WRANGLER_SEND_METRICS=false`, `CI=1`, `TZ=UTC`): About to apply 94 migration(s), SMOKE PASS, no ` 500 ` line, exit 0. The one ` 503 ` line is `POST /api/send`, the smoke's own asserted step. A first attempt on port 9420 died on a headers timeout as the server became ready, before any assertion; the retry passed.
- Dash (U+2013, U+2014), CR and BOM audits by character on the files touched and this report: 0. No personnel name in an added line.

## Deploy

Not deployed from this session. Nothing committed. Nothing pushed. No git was run. Say deploy when you want it on the grip worker. R3 was not in this tree, so this push is R4 alone.

## Sealed final check

```
the tree as received, text-mode sha256sum list
                                      335dfa13121944d5 (299 files, migrations 0001-0094)
npx tsc --noEmit                      exit 0
TZ=UTC npx vitest run                 91 files, 1225 tests passed
TZ=America/New_York npx vitest run    91 files, 1225 tests passed
node --check scripts/smoke.mjs        exit 0
SMOKE_PORT=9421 WRANGLER_SEND_METRICS=false CI=1 TZ=UTC npm run smoke
                                      About to apply 94 migration(s); SMOKE PASS; " 500 " lines: 0; " 503 " lines: 1 (POST /api/send); exit 0
dash audit: 0; CR audit: 0; BOM: 0; personnel data: none new
the app tree after the edits          d5c56d6a8251056e (299 files, migrations 0001-0094)
```

The tree hash is sha256 of the text-mode `sha256sum` list (`<hash><two spaces><path>`, forward slashes, a final newline) over `src`, `test`, `scripts`, `migrations`, `wrangler.toml`, `tsconfig.json`, and `package.json`, sorted. Git's `sha256sum` on this machine prints binary mode (`<hash> *<path>`) and hashes that list to `5faad5ea1d418f6c`.

```
app/src/console.ts                  169049  d74d9852c5efacf1
TAIL ay=${encodeURIComponent(workDate)}` : ""}` };\n}\n
app/src/i18n.ts                     264584  bbae41b84b20bbde
TAIL ey, err.words.vars) : t(locale, err.message);\n}\n
app/test/console.test.ts             93528  4402285de57fbda9
TAIL _per_dlh")!.value).toContain("lb/h");\n  });\n});\n
app/test/farmday.test.ts             16465  22c1c290fdd36b61
TAIL rvest?ok=trim_hours&day=2026-09-15");\n  });\n});\n
app/scripts/smoke.mjs               797413  9da1d473add3c394
TAIL  {\n  console.error(err);\n  process.exit(1);\n});\n
```

Screenshots, beside this report (bytes, sha256 first 16). The three desktop shots are 1920 wide. The phone shot is CO at 390 wide.

```
2026-10-05_harvest_hours_to_date_lite.png       122380  b1c61788259d937e
2026-10-05_harvest_hours_to_date_co.png         197077  bef64915a2d85b7c
2026-10-05_harvest_hours_to_date_cerberus.png   261942  fe68698fb35b89cc
2026-10-05_harvest_hours_to_date_phone.png       61215  8be1d489cf311507
```
