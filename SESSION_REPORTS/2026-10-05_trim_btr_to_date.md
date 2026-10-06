# 2026-10-05 Weighted BTR to date

MINI BRIEF R3, WEIGHTED BTR TO DATE ON THE TRIM TOTALS BAR (canon 0.30.407, re-pinned at 0.30.411). No migration. The smoke pin stays 94. Not deployed. Nothing committed. Nothing pushed. No git was run.

## The pin

The brief's command, run in `app/` with Git Bash's binary marker read as the Linux two-space form, hashed this working copy to `5f0ce5fa6fb80971` (299 files, migrations 0001 to 0094). `wrangler.toml` is the CRLF working copy canon already records (86 CR bytes, file sha256 `82e5cd2b1d151583`). Read as LF it is `edc3570cca51b401`, and that one change makes the same list `d5c56d6a8251056e`, the pin. The five files R4 sealed still matched that tree (`src/console.ts` 169,049 `d74d9852c5efacf1` before this edit, and the four beside it). The build went on from that tree.

## The figure

A fifth cell, key `btr_to_date`, at the far right of the trim totals bar. Label "Weighted BTR to date" (ES "BTR ponderado a la fecha"). The value is one percent to one decimal. Under it, "{n} lots, {lb} lb trimmed this season" (ES "{n} lotes, {lb} lb recortados esta temporada").

The pool is every live trim package of this season's lots: `wip_packages.source` null, not deleted, the lot and its harvest batch live, the batch's harvest year the farm day's year (today's year, the year the console already uses). Bud-type grams, from Admin's `btr_type_codes`, over the grams of every type. One pool. A lot still being trimmed counts what it has weighed. Today's packages count. No package yet: "no trim this season" (ES "sin recorte esta temporada").

The day's four cells stay on the day's own figures. The season BTR that a farm borrows stays finished lots only.

On `db_backups/20261005-194819_pre_r4`, read here with that rule: 2,715 packages, 39 lots, 48,021,086 g, bud types 15,596,703 g (BUD 8,930,615, SMALLS 6,100,631, SHAKE 565,457), 32.5 percent. No live source-null package sits on a deleted lot. The snapshot has no row whose source is the word trim.

## The page

On the smoke database, after the whole walk, today showed the day's Weighted BTR as "no packages on the day" and the new cell as 18.3 percent, "2 lots, 2.36 lb trimmed this season". Lite, CO, and Grip (the cerberus view) at 1920 wide all showed the fifth cell on the right of that bar. At phone width in Grip the bar wraps, and the fifth cell takes the next line. Spanish reads "BTR ponderado a la fecha" and "2 lotes, 2.36 lb recortados esta temporada".

## Gates

- `npx tsc --noEmit`: exit 0.
- `npx vitest run`: 91 files, 1226 tests passed under `TZ=UTC`, and 91 files, 1226 tests passed under `TZ=America/New_York`.
- `node --check scripts/smoke.mjs`: exit 0.
- From-zero smoke (`SMOKE_PORT=9434`, `WRANGLER_SEND_METRICS=false`, `CI=1`, `TZ=UTC`): About to apply 94 migration(s), SMOKE PASS, no ` 500 ` line, exit 0. The one ` 503 ` line is `POST /api/send`, the smoke's own asserted step.
- Dash (U+2013, U+2014), CR and BOM audits by character on the files touched and this report: 0. No personnel name in an added line.

## Deploy

Not deployed from this session. Nothing committed. Nothing pushed. No git was run. Say deploy when you want it on the grip worker.

## Sealed final check

```
the tree as received, wrangler.toml read as LF
                                      d5c56d6a8251056e (299 files, migrations 0001-0094)
the same list, wrangler.toml as stored (CRLF)
                                      5f0ce5fa6fb80971
npx tsc --noEmit                      exit 0
TZ=UTC npx vitest run                 91 files, 1226 tests passed
TZ=America/New_York npx vitest run    91 files, 1226 tests passed
node --check scripts/smoke.mjs        exit 0
SMOKE_PORT=9434 WRANGLER_SEND_METRICS=false CI=1 TZ=UTC npm run smoke
                                      About to apply 94 migration(s); SMOKE PASS; " 500 " lines: 0; " 503 " lines: 1 (POST /api/send); exit 0
dash audit: 0; CR audit: 0; BOM: 0; personnel data: none new
the app tree after the edits, wrangler.toml read as LF
                                      a3fc79a982c12ae8 (299 files, migrations 0001-0094)
the same list, wrangler.toml as stored (CRLF)
                                      83367c980de71663
```

The tree hash is sha256 of the text-mode `sha256sum` list (`<hash><two spaces><path>`, forward slashes, a final newline) over `src`, `test`, `scripts`, `migrations`, `wrangler.toml`, `tsconfig.json`, and `package.json`, sorted. The LF figure is that list with `wrangler.toml`'s CR bytes removed before its file hash. Git's `sha256sum` on this machine prints binary mode (`<hash> *<path>`).

```
app/src/console.ts                  172729  2b578c72a7cbd3e2
TAIL ay=${encodeURIComponent(workDate)}` : ""}` };\n}\n
app/src/i18n.ts                     265002  dd642f0afb2b15f1
TAIL ey, err.words.vars) : t(locale, err.message);\n}\n
app/test/console.test.ts             97575  dee54b2561b67a1a
TAIL _per_dlh")!.value).toContain("lb/h");\n  });\n});\n
app/scripts/smoke.mjs               799990  5a0060aaf88425bc
TAIL  {\n  console.error(err);\n  process.exit(1);\n});\n
```

Screenshots, beside this report (bytes, sha256 first 16). The three desktop shots are 1920 wide. The phone shot is Grip at 390 wide. The Grip desktop shot is the page after the boot card was hidden.

```
2026-10-05_trim_btr_to_date_lite-1920.png       89146  091215346db4ece8
2026-10-05_trim_btr_to_date_co-1920.png        148835  d88537680827a1bc
2026-10-05_trim_btr_to_date_cerberus-1920.png  222418  9269f729e540b1cd
2026-10-05_trim_btr_to_date_phone.png           95929  4101fe62bf920c03
```
