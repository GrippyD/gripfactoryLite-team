# 2026-10-06 Floor vs METRC

BRIEF FM1, THE FLOOR VS METRC REPORT, FIRST SLICE (canon 0.30.415). No migration. The smoke pin stays 94. Not deployed. Nothing committed. Nothing pushed. No git was run.

## The pin

The brief's command, run in `app/` with Git Bash's binary marker read as the Linux two-space form, hashed this working copy to `a3fc79a982c12ae8` (299 files, migrations 0001 to 0094). `wrangler.toml` is LF on this worktree (0 CR). The build went on from that tree.

## The page

Reports gains Floor vs METRC (ES "Piso vs METRC"), read only, at `/reports/floor_vs_metrc`. No PIN. The line under the title is "METRC as of {time}", the mirror's newest `changed_at` in Eastern wall clock. Each section states the counts of the findings in the rows on screen.

Section A, Packages by tag, is every live floor item whose `metrc_tag` is 24 characters, matched to `metrc_packages` by that exact tag. A 5 digit tag stays out. The row shows the tag's last 6, the full tag on hover, the item kind, floor qty, uom, location and license, and the mirror's quantity, uom, location and license. The finding is Same when the uom matches and the quantities are within 1, Weight differs by {n} when the uom matches and they are further apart ({n} is the whole-gram difference, round half up), Units differ when the units are not the same (the quantities are shown and not subtracted), Gone in METRC when the mirror row is gone, Not in METRC when there is no mirror row. License differs is added, with a semicolon, to whichever of those applies. Locations are side by side and are not a finding.

Section B, Lot packages, is every live lot of the farm day's harvest year that has a live SPR item on the floor or a live mirror package whose item starts `SPR - ` and whose `source_harvests` is the lot's HBN. The row shows the lot's last 5, the HBN, the lot state, the floor SPR qty and location, and the METRC SPR tag, quantity and location. The finding is Same, Weight differs by {n}, No floor package, or No METRC package. A live mirror SPR package whose HBN names a voided batch is listed too, with Lot voided on the floor, and the weights are not compared. Two live SPR items on one batch are summed.

Every finding other than Same names that lot's open Pending Data Uploads by kind (not cleared, not deleted), or "nothing pending". A package row finds the lot by `wet_weight_entry_id`, then the batch.

Filters: finding (differences only by default, all, or one finding), item kind, lot last 5. A CSV of the rows on screen. Nothing is written: not the floor, not the mirror, not the uploads. On a phone the two tables scroll inside their box. At 1920 in Grip the page's scroll width equaled its client width (1905) while the package table's box scrolled (1951 inside 1386). At phone width in Grip the box was 352 wide and the table 1954, and the page stayed at the phone width (393 on a 390 frame).

On `db_backups/20261005-203534_post_plants`, the built function, harvest year 2026: Section A, 671 rows: WIP 95 Same, 308 Weight differs, 1 Not in METRC; FG 2 Same, 225 Units differ, 40 Not in METRC; no License differs. Section B: 26015, 26017, 26085, 26086, 26087, 26091, 26092 No METRC package; 26027 floor 1,319,148 against METRC 335,435; 26028 983,833 against 1,159,097; 26061 3,422,505 against 661,908; 26063 1,504,582 against 205,929. 26062, voided on the floor, Lot voided on the floor, METRC SPR 737,135 g. The mirror line for that snapshot is "METRC as of 2026-10-04 21:28".

## Gates

- `npx tsc --noEmit`: exit 0.
- `npx vitest run`: 92 files, 1232 tests passed under `TZ=UTC` (one earlier UTC run timed out `unfinish.test.ts` at 5000 ms; the rerun passed), and 92 files, 1232 tests passed under `TZ=America/New_York`.
- `node --check scripts/smoke.mjs`: exit 0.
- From-zero smoke (`SMOKE_PORT=9436`, `WRANGLER_SEND_METRICS=false`, `CI=1`, `TZ=UTC`): About to apply 94 migration(s), SMOKE PASS, no ` 500 ` line, exit 0. The one ` 503 ` line is `POST /api/send`, the smoke's own asserted step.
- Dash (U+2013, U+2014), CR and BOM audits by character on the files touched and this report: 0. No personnel name in an added line.

## Deploy

Not deployed from this session. Nothing committed. Nothing pushed. No git was run. Say deploy when you want it on the grip worker.

## Sealed final check

```
the tree as received, wrangler.toml read as LF
                                      a3fc79a982c12ae8 (299 files, migrations 0001-0094)
npx tsc --noEmit                      exit 0
TZ=UTC npx vitest run                 92 files, 1232 tests passed
TZ=America/New_York npx vitest run    92 files, 1232 tests passed
node --check scripts/smoke.mjs        exit 0
SMOKE_PORT=9436 WRANGLER_SEND_METRICS=false CI=1 TZ=UTC npm run smoke
                                      About to apply 94 migration(s); SMOKE PASS; " 500 " lines: 0; " 503 " lines: 1 (POST /api/send); exit 0
dash audit: 0; CR audit: 0; BOM: 0; personnel data: none new
the app tree after the edits, wrangler.toml read as LF
                                      cba603e2aee6dc4b (301 files, migrations 0001-0094)
```

The tree hash is sha256 of the text-mode `sha256sum` list (`<hash><two spaces><path>`, forward slashes, a final newline) over `src`, `test`, `scripts`, `migrations`, `wrangler.toml`, `tsconfig.json`, and `package.json`, sorted. `wrangler.toml` is LF, so the stored copy and the LF reading are the same hash.

```
app/src/floormetrc.ts               27224  c5865c1c50cfd154
TAIL cleared: Number(row.cleared),\n      deletedAt: row.deleted_at,\n    })),\n  });\n}\n
app/src/reports.ts                  35653  cd1622b215131d55
TAIL abel: "Percent" },\n    ],\n    rows: body,\n    footnote: `Year ${year}.`,\n  };\n}\n
app/src/index.ts                   176598  e465c4ee1b1fa22f
TAIL orker = { fetch: app.fetch, scheduled };\nexport { app };\nexport default worker;\n
app/src/i18n.ts                    267257  f6bfb3cebec03e00
TAIL ords ? tFill(locale, err.words.key, err.words.vars) : t(locale, err.message);\n}\n
app/src/theme.ts                   198876  23127cb30f32cadc
TAIL kground:#1c1e24; color:#f4f4f5; }\n#proposal{ background:#15161a; }\n</style>`;\n}\n
app/test/floormetrc.test.ts         12219  6ebd67e125d8b0be
TAIL ights");\n    expect(t("es", NOTHING_PENDING)).toBe("nada pendiente");\n  });\n});\n
app/test/console.test.ts            97628  85399f0778d9573c
TAIL cs.find((m) => m.key === "weight_per_dlh")!.value).toContain("lb/h");\n  });\n});\n
app/scripts/smoke.mjs              802353  7062b05b70b07d75
TAIL ld);\n  }\n}\n\nrun().catch((err) => {\n  console.error(err);\n  process.exit(1);\n});\n
```

Screenshots, beside this report (bytes, sha256 first 16). The three desktop shots are 1920 wide. The phone shot is Grip at 390 wide, scrolled to the tables.

```
2026-10-06_floor_vs_metrc_lite-1920.png       47857  40e3cb33d4548072
2026-10-06_floor_vs_metrc_co-1920.png        166645  1188980155b31d09
2026-10-06_floor_vs_metrc_cerberus-1920.png  195668  a9f08f2a33c55a8e
2026-10-06_floor_vs_metrc_phone.png           66884  ed0fe41ed25ff800
```
