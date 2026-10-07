# 2026-10-06 Dashboard drying as it was

BRIEF V29, THE DASHBOARD DRAWS DRYING AS IT WAS (canon 0.30.417). Built second, on the tree Assign Plant Counts left, then the admin cleanup brief. No migration. The smoke pin stays 94. Not deployed. Nothing committed. Nothing pushed. No git was run.

## The pin

The session opened on `cba603e2aee6dc4b` (301 files, migrations 0001 to 0094, `wrangler.toml` LF). No hash was taken between briefs. The tree this session leaves, after all three briefs, is `1b82a63ba065e37e` (304 files).

## The strip

The dashboard draws one flat strip in live order: the silos, then the dry rooms, then the freezers, then CSA and CSB. Each tile is the open tile (gauge drawn, lots and clocks on the face, wet weight under it). Cure panes on the dashboard are the bar: name, conditions, and the shade with "{pct}% full - {n} Lots" inside the shade. No row totals, arrows, collapsed heads, or head icons. The live script still paints `[data-silo]`.

Every other surface keeps the rows: totals, arrows, and collapsed tiles. The freezer row keeps its space tiles and has no total panel. The cube is gone: no FFZ Inventory tile, no `ffz` member of `/silos/live.json`, no `[data-ffz]` paint. Blast Freezer stays a space tile under that name. Dry Equiv. Wt of Fresh Frozen stays on the Total box.

On the smoke database, Lite at 1920, the drying section shows six open silo tiles, then Arlington Dry Room, Blast Freezer(s), CSA, and CSB, gauges drawn, no collapsed heads. Drying Operations in the same browser still has the rows (silo, freezer, cure, dry room), collapsed heads, the Blast Freezer tile, and no Fresh Frozen total and no FFZ Inventory. That operations page was checked in the browser and was not saved as a picture.

## Gates

Run once, after all three briefs.

- `npx tsc --noEmit`: exit 0.
- `npx vitest run`: 94 files, 1241 tests passed under `TZ=UTC`, and 94 files, 1241 tests passed under `TZ=America/New_York`. `test/unfinish.test.ts` keeps the same assertions; its timeout is 20 seconds so the three migration applies finish under the full suite.
- `node --check scripts/smoke.mjs`: exit 0.
- From-zero smoke (`SMOKE_PORT=9450`, `WRANGLER_SEND_METRICS=false`, `CI=1`, `TZ=UTC`): About to apply 94 migration(s), SMOKE PASS, no ` 500 ` line, exit 0. The one ` 503 ` line is `POST /api/send`, the smoke's own asserted step. The live JSON has `ffz` null.
- Dash (U+2013, U+2014), CR and BOM audits by character on the files this brief touched and this report: 0. No personnel name in an added line.

## Deploy

Not deployed from this session. Nothing committed. Nothing pushed. No git was run. Say deploy when you want it on the grip worker.

## Sealed final check

```
the tree as received, wrangler.toml read as LF
                                      cba603e2aee6dc4b (301 files, migrations 0001-0094)
npx tsc --noEmit                      exit 0
TZ=UTC npx vitest run                 94 files, 1241 tests passed
TZ=America/New_York npx vitest run    94 files, 1241 tests passed
node --check scripts/smoke.mjs        exit 0
SMOKE_PORT=9450 WRANGLER_SEND_METRICS=false CI=1 TZ=UTC npm run smoke
                                      About to apply 94 migration(s); SMOKE PASS; " 500 " lines: 0; " 503 " lines: 1 (POST /api/send); exit 0
dash audit: 0; CR audit: 0; BOM: 0; personnel data: none new
the app tree after the three briefs, wrangler.toml read as LF
                                      1b82a63ba065e37e (304 files, migrations 0001-0094)
```

The tree hash is sha256 of the text-mode `sha256sum` list (`<hash><two spaces><path>`, forward slashes, a final newline) over `src`, `test`, `scripts`, `migrations`, `wrangler.toml`, `tsconfig.json`, and `package.json`, sorted. `wrangler.toml` is LF, so the stored copy and the LF reading are the same hash. File hashes below are the session's final bytes. `i18n.ts`, `theme.ts`, `index.ts`, and `smoke.mjs` also carry the other two briefs.

```
app/src/silo.ts                      46106  f5138744090feec8
TAIL Grams, capacityGrams, dryYieldPct, departures), capacityGrams, dryYieldPct };\n}\n
app/src/drying.ts                    41813  8c6d5aecdb11490a
TAIL ps: opsMenuHtml(dryingMenuLines(drying, nowIso, locale, flags), locale),\n  };\n}\n
app/src/cure.ts                      24723  57beb07911aaed34
TAIL owIso,\n    locale,\n    flags.CSB ?? [],\n    layout\n  )}${cureClockScript()}`;\n}\n
app/src/console.ts                  172636  009a24155c185436
TAIL ll(form.get("day_picked")) ? `&day=${encodeURIComponent(workDate)}` : ""}` };\n}\n
app/src/db.ts                       223311  c6d2232f18af0514
TAIL  harvest ? operated.filter((row) => row.harvestLast6 === harvest) : operated;\n}\n
app/src/i18n.ts                     268085  415c28d59995337c
TAIL ords ? tFill(locale, err.words.key, err.words.vars) : t(locale, err.message);\n}\n
app/src/theme.ts                    200013  e8545503d10c0adb
TAIL kground:#1c1e24; color:#f4f4f5; }\n#proposal{ background:#15161a; }\n</style>`;\n}\n
app/src/index.ts                    178580  5c511caecf6091b2
TAIL orker = { fetch: app.fetch, scheduled };\nexport { app };\nexport default worker;\n
app/test/dryingrows.test.ts           8341  27d80f40688952bf
TAIL 12:00:00.000Z");\n    expect(panes.caps).toEqual({ CSA: 36, CSB: 8 });\n  });\n});\n
app/test/console.test.ts             97511  045c89d99588e51d
TAIL cs.find((m) => m.key === "weight_per_dlh")!.value).toContain("lb/h");\n  });\n});\n
app/test/silo.test.ts                36440  3162de05b9c6baf2
TAIL n.live.find((row) => row.silo.id === "sp-e")?.emptySince).toBeNull();\n  });\n});\n
app/test/unfinish.test.ts            20234  3d1df1a8b8488f3d
TAIL expect(html).not.toContain('href="/record/wip_packages/out-1/void"');\n  });\n});\n
app/scripts/smoke.mjs               809830  62409e0f2bf639ca
TAIL ld);\n  }\n}\n\nrun().catch((err) => {\n  console.error(err);\n  process.exit(1);\n});\n
```

Screenshot, beside this report (bytes, sha256 first 16). Lite at 1920, scrolled to the drying strip.

```
2026-10-06_dashboard_drying_lite-1920.jpg  75730  899bd7aad99cbb83
```
