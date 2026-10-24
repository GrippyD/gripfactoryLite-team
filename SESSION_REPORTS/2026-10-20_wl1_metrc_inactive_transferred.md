# WL1: the METRC mirror takes Inactive and Transferred (2026-10-20)

Worktree `branches/GFLiteMetrcAPI`. Tree received `9d751a5730ab2493` (421 files, the L4 gated tree). Tree left `43583f124452133d`, 422 files. No git. Nothing is committed, pushed, or deployed. `canon/` and `prompts/` were not edited. No screenshots and no browser renders, per the render law. The Scribe renders Admin, METRC at the gate.

## What a drop does

The same drop zone takes Packages Active, Inactive, and Transferred. The file name carries the grid (`PackagesActive`, `Packages-Active`, `Packages-Inactive`, `Packages-Transferred`, and a trailing copy number such as `_12` or ` (18)`). The headers must agree. Transferred headers carry Package, Destination Facility, and Manifest Number. Inactive headers carry Finished. A name and a header that disagree are refused in words.

THE GONE LAW STAYS ACTIVE ONLY. Only an Active packages mount marks packages gone because the file does not carry them. An Inactive mount and a Transferred mount never do that. An Inactive row updates the package (or inserts it) with `inactive_state` and marks that package gone when it is not already. A Transferred row upserts `metrc_transfers` by tag and manifest. A row a later transfer file does not carry stays. An existing live package named in the transfer file is marked gone.

The Active mount line is unchanged: no grid word, and the redirect has no `grid` parameter. An Inactive line reads `packages / Inactive`. A Transferred line reads `packages / Transferred` and `transfers new N, updated M`.

METRC's xlsx declares a wrong sheet size (these files say column A only). The app's reader already walks every row and cell that is present and does not trust that dimension. It is reused. The plants fixture already declares `dimension ref="A1"` and still returns every column.

## Files

| file | bytes | sha256 |
| --- | ---: | --- |
| app/migrations/0117_metrc_inactive_transferred.sql | 1307 | 1236f45fecceb1d7 |
| app/src/metrc.ts | 123055 | da611e398d798d86 |
| app/src/metrcpane.ts | 20012 | 81a877cdb717e68d |
| app/src/i18n.ts | 390331 | 2628580a0ca2581c |
| app/src/index.ts | 206107 | 5b191163901c30e2 |
| app/test/metrc.test.ts | 81380 | 5956eb0a5142e866 |
| app/scripts/smoke.mjs | 953307 | 1b47fa97551f0181 |

Dash and CR scan of those seven files: U+2013 0, U+2014 0, CR 0. The new migration names nobody. Test fixtures use invented destinations (Northwind Store, Cedar Laboratory, Pine Laboratories) and invented manifests. The other touched files still contain names that were already in them.

Tails (last lines):

- `0117_metrc_inactive_transferred.sql`: `CREATE INDEX IF NOT EXISTS metrc_transfers_license ON metrc_transfers (license_value);`
- `metrc.ts`: the field redirect, then `}`
- `metrcpane.ts`: the mounts table, then `}`
- `i18n.ts`: `refusalText` return, then `}`
- `index.ts`: `export { app };` / `export default worker;`
- `metrc.test.ts`: `};` / `}`
- `smoke.mjs`: `process.exit(1);` / `});`

## Gates

Typecheck: `npx tsc --noEmit` exit 0.

Vitest TZ=UTC:

```
Test Files  121 passed (121)
Tests  1682 passed | 6 skipped (1688)
Duration  33.85s
```

Vitest TZ=America/New_York:

```
Test Files  121 passed (121)
Tests  1682 passed | 6 skipped (1688)
Duration  35.68s
```

`node --check scripts/smoke.mjs` exit 0.

From-zero smoke exited 0. It printed `About to apply 116 migration(s)` and `SMOKE PASS` and `SMOKE_EXIT 0`. No response in the log is a 500. The log lines:

```
About to apply 116 migration(s)
SMOKE PASS
SMOKE_EXIT 0
```

## Decided

- `inactive_state` is Finished when Finished is true, else Discontinued. Her converter also has a third word, Inactive, when neither flag is true. The brief names the two values, so a false Finished cell is Discontinued.
- A Transferred mount does not insert a `metrc_packages` row for a tag the mirror has never seen. It marks an existing live package gone. `metrc_transfers` keeps that file's columns.
- A blank shipped quantity is stored null, the same as a blank package quantity. Her converter stores 0.
- The unit is ea when the item prefix is exactly PRE, else g. That is her assumption, and it is the column comment in 0117.
- The drop help text now names all three package grids and says only an Active export marks absent rows gone. The old sentence said every drop did that.
- When the file name does not name a package grid, the headers decide, so a header-only Active file still mounts. When the name and the headers both name a grid and they differ, the mount is refused.
- A later Active mount does not clear `inactive_state`. Each table keeps what its file said. Precedence is WL2's read.
- Package fields are not logged one by one. The mount row's insert logs and the four count logs are the mount's existing law. Inactive and Transferred use those same statements.

## Declined

Nothing was declined. The third Inactive status in her converter was not stored, because the brief names Finished and Discontinued only.

Tree left `43583f124452133d`. Nothing is committed, pushed, or deployed. The Scribe gates. The owner merges. This slice carries migration 0117, so the merge block takes a snapshot first.
