# 2026-10-06 Admin cleanup

BRIEF A1, ADMIN CLEANUP (canon 0.30.418). Built third, on the tree the dashboard drying brief left. No migration. The smoke pin stays 94. Not deployed. Nothing committed. Nothing pushed. No git was run.

## The pin

The session opened on `cba603e2aee6dc4b` (301 files, migrations 0001 to 0094, `wrangler.toml` LF). No hash was taken between briefs. The tree this session leaves, after all three briefs, is `1b82a63ba065e37e` (304 files).

## The pages

Admin holds three tiles, in order: Data Connections (ES "Conexiones de datos") at `/admin/data-connections`, Admin Settings (ES "Ajustes de administracion") at `/admin/settings`, Continuum10 at `/admin/continuum10`. The group pages sit behind the Admin PIN.

Data Connections holds Data Queues, Pending Data Uploads, Import Data, and Metrc API, at the URLs they already had. Admin Settings holds Lookups, Change log, Manual HBN, and Reconcile Ledger Location. Continuum10 holds the vendors, ERP, compliance, and harvest-console tiles. Testing Override, Environment, Sheet sync, and the Testing desk leave the Admin buttons. Their routes still answer.

The bar is Models, Harvest Console, Maintenance, Reports, Admin. Harvest Console stays behind the Admin PIN. Models stays behind its own PIN. On a phone the bar wraps onto its own line. Back from a data-connection member goes to Data Connections. Back from a settings member, including the change log, goes to Admin Settings. Back from a group page goes to Admin. Back from Harvest Console and Models goes to Home. No route was renamed or removed.

## Gates

Run once, after all three briefs.

- `npx tsc --noEmit`: exit 0.
- `npx vitest run`: 94 files, 1241 tests passed under `TZ=UTC`, and 94 files, 1241 tests passed under `TZ=America/New_York`.
- `node --check scripts/smoke.mjs`: exit 0.
- From-zero smoke (`SMOKE_PORT=9450`, `WRANGLER_SEND_METRICS=false`, `CI=1`, `TZ=UTC`): About to apply 94 migration(s), SMOKE PASS, no ` 500 ` line, exit 0. The one ` 503 ` line is `POST /api/send`, the smoke's own asserted step. `/admin` shows the three tiles and none of the four removed titles. The four old routes still answer 200. The bar on `/` is Models, then Harvest Console, then Maintenance.
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

The tree hash is sha256 of the text-mode `sha256sum` list (`<hash><two spaces><path>`, forward slashes, a final newline) over `src`, `test`, `scripts`, `migrations`, `wrangler.toml`, `tsconfig.json`, and `package.json`, sorted. `wrangler.toml` is LF, so the stored copy and the LF reading are the same hash. File hashes below are the session's final bytes. `i18n.ts`, `theme.ts`, `index.ts`, and `smoke.mjs` also carry the earlier two briefs.

```
app/src/html.ts                     197011  6cbb37c61d1ad4ec
TAIL change",save);b.addEventListener("input",save);});}catch(e){}})();</script>`;\n}\n
app/src/nav.ts                        5973  77a8d4f399a50fd0
TAIL k.href\n  )}" data-back-link>&#8592; ${esc(t(locale, link.label))}</a></nav>`;\n}\n
app/src/i18n.ts                     268085  415c28d59995337c
TAIL ords ? tFill(locale, err.words.key, err.words.vars) : t(locale, err.message);\n}\n
app/src/theme.ts                    200013  e8545503d10c0adb
TAIL kground:#1c1e24; color:#f4f4f5; }\n#proposal{ background:#15161a; }\n</style>`;\n}\n
app/src/index.ts                    178580  5c511caecf6091b2
TAIL orker = { fetch: app.fetch, scheduled };\nexport { app };\nexport default worker;\n
app/test/admincleanup.test.ts         4417  374e1dd8012960f2
TAIL  1 100%; flex-wrap: wrap; margin-left: 0; max-width: 100%; }");\n    }\n  });\n});\n
app/test/nav.test.ts                  8983  48bf04b74fafa85b
TAIL t(base);\n    expect(legacy).not.toContain('<nav class="back-crumb"');\n  });\n});\n
app/test/surface.test.ts             81947  514960ee6789374d
TAIL ml).not.toContain("/edit");\n    expect(html).not.toContain(">Edit<");\n  });\n});\n
app/test/models.test.ts               3463  2a8a7c21eabb9065
TAIL ls")).toBe("/models");\n    expect(safeNextPath(null)).toBe("/admin");\n  });\n});\n
app/test/routing.test.ts             36716  a89baca3ecdb5913
TAIL 6-09-15" }])).toContain("1A4050000000000000000101,BARN,,2026-09-15");\n  });\n});\n
app/scripts/smoke.mjs               809830  62409e0f2bf639ca
TAIL ld);\n  }\n}\n\nrun().catch((err) => {\n  console.error(err);\n  process.exit(1);\n});\n
```

Screenshots, beside this report (bytes, sha256 first 16). The three Admin shots are 1920 wide, Lite, CO, and Grip. The fourth is Lite Data Connections at the same width. The phone bar wrap is on the Assign Plant Counts phone shot.

```
2026-10-06_admin_cleanup_lite-1920.jpg                 32097  a94486a9b7544238
2026-10-06_admin_cleanup_co-1920.jpg                   30598  a6a6264bae236d67
2026-10-06_admin_cleanup_cerberus-1920.jpg             50796  0b0f7fcc71bdcf6f
2026-10-06_admin_cleanup_lite-data-connections.jpg     35357  b7fe6fbb74cf7f89
```
