# 2026-10-04 Line packages, last 6 of harvest package

MINI BRIEF R2, LINE PACKAGES, LAST 6 OF HARVEST PACKAGE (canon 0.30.403). L5 was already handed back (`SESSION_REPORTS/2026-10-04_labels_l5.md`, tree `07115fdee6e847f7` in that seal). This session built R2 on the worktree as L5 left it. The six files in L5's seal that this session did not edit still match that seal (`src/labelgeom.ts` `c49aa4c4a38f098c`, `src/labeleditor.ts` `87f0a9ccd6566497`, `test/labelgeom.test.ts` `59fd769432b45ad7`, `test/labeleditor.test.ts` `eb748970891124d9`). No migration. The smoke pin stays 94. Not deployed. Nothing committed. Nothing pushed. No git was run.

## The field

Reports, Line packages, gains "Last 6 of Harvest Package" (ES "Ultimos 6 del paquete de cosecha"), a free text box beside Operator. The query name is `harvest_last6`. Blank shows every row in the window.

Each row's harvest package is the full METRC tag from the mirror, live or gone:

- Trim: the one `metrc_packages.tag` whose last five characters are the row's five digit `package_code`. A code of any other length, or a code that ends no tag or more than one, has none.
- Prepack: the same lookup on the parent `wip_packages.package_code`.
- Cryo and Rad: none.

The page, CSV, XLSX, and PDF gain a column "Harvest package" (ES "Paquete de cosecha") after Package tag. The cell is that tag's last 6, blank when there is none.

With text typed, a row stays only when its harvest package's last 6 equals the typed text: the same six characters, the same case, outer spaces trimmed. Five digits match nothing. A row with no harvest package never matches. When nothing matches, the table says "No harvest package ends in {text}. Type all six characters." (ES "Ningun paquete de cosecha termina en {text}. Escriba los seis caracteres.").

The match sits inside From, To, the start time, Line, and Operator. The footnote totals count the rows shown.

## The page

On the smoke database, `?harvest_last6=094731` lists the smoke trim entry `94731` alone (40 g, harvest package `094731`) and leaves BUD-SMOKE-1, Prepack, Cryo, and Rad off. `?harvest_last6=94731` lists no package and says to type all six characters, in EN and in ES. A blank box lists `94731` and BUD-SMOKE-1 with Trim, Prepack, Cryo, and Rad. The CSV header carries Harvest package.

## Gates

- `npx tsc --noEmit`: exit 0.
- `npx vitest run`: 91 files, 1224 tests passed under `TZ=UTC`, and 91 files, 1224 tests passed under `TZ=America/New_York`.
- `node --check scripts/smoke.mjs`: exit 0.
- From-zero smoke (`SMOKE_PORT=9416`, `WRANGLER_SEND_METRICS=false`, `CI=1`, `TZ=UTC`): About to apply 94 migration(s), SMOKE PASS, no ` 500 ` line, exit 0. The one ` 503 ` line is `POST /api/send`, the smoke's own asserted step.
- Dash (U+2013, U+2014), CR and BOM audits by character on the files touched and this report: 0. No personnel name in an added line.

## Deploy

Not deployed from this session. Nothing committed. Nothing pushed. No git was run. Say deploy when you want it on the grip worker. R2 rides L5's push.

## Sealed final check

```
L5's sealed tree, as that report states   07115fdee6e847f7 (299 files, migrations 0001-0094)
npx tsc --noEmit                      exit 0
TZ=UTC npx vitest run                 91 files, 1224 tests passed
TZ=America/New_York npx vitest run    91 files, 1224 tests passed
node --check scripts/smoke.mjs        exit 0
SMOKE_PORT=9416 WRANGLER_SEND_METRICS=false CI=1 TZ=UTC npm run smoke
                                      About to apply 94 migration(s); SMOKE PASS; " 500 " lines: 0; " 503 " lines: 1 (POST /api/send); exit 0
dash audit: 0; CR audit: 0; BOM: 0; personnel data: none new
the app tree after the edits          335dfa13121944d5 (299 files, migrations 0001-0094)
```

The tree hash is sha256 of the text-mode `sha256sum` list (`<hash><two spaces><path>`, forward slashes, a final newline) over `src`, `test`, `scripts`, `migrations`, `wrangler.toml`, `tsconfig.json`, and `package.json`, sorted. Git's `sha256sum` on this machine prints binary mode (`<hash> *<path>`) and hashes that list to `498d32189d26e8c3`.

```
app/src/db.ts                       224078  9521ebe00b4886f5
TAIL  => row.harvestLast6 === harvest) : operated;\n}\n
app/src/reports.ts                   35489  c57fc820e5455179
TAIL ws: body,\n    footnote: `Year ${year}.`,\n  };\n}\n
app/src/index.ts                    175365  32d2b1614ec6bf5c
TAIL duled };\nexport { app };\nexport default worker;\n
app/src/i18n.ts                     264427  f3fd4fc0a66bd2d6
TAIL ey, err.words.vars) : t(locale, err.message);\n}\n
app/test/linepackages.test.ts         9917  c55c7d155ecc7e07
TAIL xpect(none.footnote).toBeUndefined();\n  });\n});\n
app/test/reports.test.ts             15066  a3dc041e8e9cfef9
TAIL ext}. Escriba los seis caracteres.");\n  });\n});\n
app/scripts/smoke.mjs               795710  80e413d358aefad3
TAIL  {\n  console.error(err);\n  process.exit(1);\n});\n
```
