# 2026-10-07 Trim shifts by team lead

BRIEF S1, TRIM SHIFTS BY TEAM LEAD (canon 0.30.419). No migration. The smoke pin stays 94. Not deployed. Nothing committed. Nothing pushed. No git was run.

## The pin

Opened on `6d1167b5e2b8b094` (304 files, migrations 0001 to 0094, `wrangler.toml` read as LF). That is the tree PC1, V29, and A1 left. The tree this session leaves is `9c7639ac10df35ec` (305 files).

## What changed

Under the default Effective Date, a trim package's `trim_date` follows the operator's shift list. A second shift operator takes the Eastern calendar date of the entry less 12 hours, so an entry before noon belongs to the night before (06:30 and 05:40 both land on the evening's date; 12:30 stays on that day). A day shift operator takes the Eastern calendar date of the entry, so a late post at 19:00 stays on that day. An operator on neither list still takes the farm day. Case and spaces in the name are ignored. An Effective Date typed with the Admin PIN still wins. The station flash names the shift and the day the packages counted to (`Second Shift, 2026-10-06`).

The trim section no longer reads `trim_shift_day_hours` or `trim_shift_second_hours`. There is no on duty flag and no rule that lights a shift because the clock is in its window and the queue holds a lot. A shift reads Running while one of its own operators weighed a package in the last 30 minutes, otherwise Down, with the time since that lead's last entry. An operator on neither list still has the Unassigned line.

Shift figures, DLH, Weighted BTR, BTR to date, pasteurization (still on its windows), the Effective Date control, and Line packages are unchanged. No stored date was rewritten.

## Gates

- `npx tsc --noEmit`: exit 0.
- `npx vitest run`: 94 files, 1245 tests passed under `TZ=UTC`, and 94 files, 1245 tests passed under `TZ=America/New_York`.
- `node --check scripts/smoke.mjs`: exit 0.
- From-zero smoke (`SMOKE_PORT=9468`, `WRANGLER_SEND_METRICS=false`, `CI=1`, `TZ=UTC`): About to apply 94 migration(s), SMOKE PASS, no ` 500 ` line, exit 0. The `503` line is `POST /api/send`, the smoke's own asserted step.
- Dash (U+2013, U+2014), CR, and BOM audits by character on the files this brief touched and this report: 0. Tests use made-up names (Ada Day, Nia Night). The smoke uses the operators already seeded by migration 0052.

## Render

Harvest Console, Trimming, at 1920 in Lite, CO, and Grip. Right now has no on duty flag. Day shift and Second Shift of 2026-10-07 each read Running from their own lead's entry (80 g and 140 g). Shots beside this report.

## Deploy

Not deployed from this session. Nothing committed. Nothing pushed. No git was run. Say deploy when you want it on the grip worker. The 212 packages that sit a day late are not rewritten here. That repair waits on his word after this is live.

## Sealed final check

```
the tree as received, wrangler.toml read as LF
                                      6d1167b5e2b8b094 (304 files, migrations 0001-0094)
npx tsc --noEmit                      exit 0
TZ=UTC npx vitest run                 94 files, 1245 tests passed
TZ=America/New_York npx vitest run    94 files, 1245 tests passed
node --check scripts/smoke.mjs        exit 0
SMOKE_PORT=9468 WRANGLER_SEND_METRICS=false CI=1 TZ=UTC npm run smoke
                                      About to apply 94 migration(s); SMOKE PASS; " 500 " lines: 0; POST /api/send 503 (the smoke's own step); exit 0
dash audit: 0; CR audit: 0; BOM: 0; personnel data: none new
the app tree this session leaves, wrangler.toml read as LF
                                      9c7639ac10df35ec (305 files, migrations 0001-0094)
```

The tree hash is sha256 of the text-mode `sha256sum` list (`<hash><two spaces><path>`, forward slashes, a final newline) over `src`, `test`, `scripts`, `migrations`, `wrangler.toml`, `tsconfig.json`, and `package.json`, sorted. `wrangler.toml` is read as LF. File hashes below are the session's final bytes.

```
app/src/farmday.ts                   12516  5f03271a78459738
TAIL s(new Date(end)) * 60_000;\n  return { startIso: new Date(start).toISOString(), endIso: new Date(end).toISOString() };\n}\n
app/src/audit.ts                      3936  daad47733ebf3f7e
TAIL || n < 1) {\n    throw new HttpError(400, `${label} must be a whole number of plants, one or more.`);\n  }\n  return n;\n}\n\n
app/src/console.ts                  171093  df162ab2c70c99b7
TAIL _PATH}?ok=pasteurization_hours${textOrNull(form.get("day_picked")) ? `&day=${encodeURIComponent(workDate)}` : ""}` };\n}\n
app/src/actions.ts                  418764  f15abdd47e3e058b
TAIL  }),\n  ]);\n  return { redirect: radOperationRedirect("reopened") };\n}\n\nexport { MANIFEST_COLUMNS, buckedPackageCode };\n
app/src/index.ts                    179475  89bd8ebacd54343c
TAIL waitUntil(run);\n  return run;\n}\n\nconst worker = { fetch: app.fetch, scheduled };\nexport { app };\nexport default worker;\n
app/src/i18n.ts                     268210  3583a31ce1447b26
TAIL "en") return err.message;\n  return err.words ? tFill(locale, err.words.key, err.words.vars) : t(locale, err.message);\n}\n
app/src/node-async-hooks.d.ts          155  103005e9fbf37295
TAIL \n  export class AsyncLocalStorage<T> {\n    run<R>(store: T, callback: () => R): R;\n    getStore(): T | undefined;\n  }\n}\n
app/tsconfig.json                      460  ef71764bd533a853
TAIL /**/*.d.ts", "test/**/*.ts", "test/**/*.d.ts", "worker-configuration.d.ts"],\n  "exclude": ["src/vendor/qrcodegen.ts"]\n}\n
app/test/farmday.test.ts             18168  ae09fd4535fdcfd8
TAIL 5", hours: "6", day_picked: "1" }));\n    expect(trim.redirect).toBe("/harvest?ok=trim_hours&day=2026-09-15");\n  });\n});\n
app/test/console.test.ts             97617  a1a1a368648c7e87
TAIL n.find((b) => b.farm === "Total")!.metrics.find((m) => m.key === "weight_per_dlh")!.value).toContain("lb/h");\n  });\n});\n
app/test/gate.test.ts                30847  4fd664abab6b570d
TAIL        (l) => l.field === "trim_reconcile_choice" && l.new_value === "queue_adjust"\n      )\n    ).toBe(true);\n  });\n});\n
app/scripts/smoke.mjs               813546  0b2327c219f65650
TAIL  } finally {\n    await stopWrangler(child);\n  }\n}\n\nrun().catch((err) => {\n  console.error(err);\n  process.exit(1);\n});\n
```

Screenshots, beside this report (bytes, sha256 first 16). Each is 1920 by 1080.

```
2026-10-07_trim_shifts_by_team_lead_lite-1920.jpg          85323  edf2b3c156bba57a
2026-10-07_trim_shifts_by_team_lead_co-1920.jpg            96728  f484e21342517cec
2026-10-07_trim_shifts_by_team_lead_cerberus-1920.jpg     149275  fbff4fc21c80bf04
```
