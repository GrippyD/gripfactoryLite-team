# WL2: WIP Package Lineage under Reports (2026-10-20)

Worktree `branches/GFLiteMetrcAPI`. Tree received `43583f124452133d` (422 files, the tree WL1 left). Tree left `4496aa03aa378d12`, 424 files. No git. Nothing is committed, pushed, or deployed. `canon/` and `prompts/` were not edited. No screenshots and no browser renders, per the render law. The Scribe renders the page in Lite, CO and Cerberus at the gate. No migration.

## What a reader sees

Reports lists WIP Lineage (ES Linaje de paquetes WIP) with the other reports, behind the same sign-in. It is not a feed. The page reads `metrc_packages` and `metrc_transfers` for AU-P-000694. A license select appears only when more than one AU-P license has rows.

One row per tag. Transferred wins over Inactive over Active. A harvest is a family when it has a WIP that is not transferred. The root is the earliest packaged of those WIPs that was not made from another WIP. The other WIPs are the splits branch. The lab bar counts active packages under the root: passed, pending, failed, not submitted. Shipped for sale is a Sale transfer of BUD, PRE or SHA. Pounds are grams over 448, rounded the way her rules round. Pre-rolls stay in units.

The tiles include BUD, PRE and SHA side by side. Filters, branch chips, expand and collapse are a form and links. Values go through `esc`. There is no import pane and no client script on the page. Data as of prints the newest mount instant of Active, Inactive and Transferred.

## Files

| file | bytes | sha256 |
| --- | ---: | --- |
| app/src/wiplineage.ts | 29807 | 8455bbe0c6d47d31 |
| app/src/reports.ts | 37156 | ee722f8a011daa4f |
| app/src/index.ts | 206287 | f37603ba3cb6ae59 |
| app/src/i18n.ts | 392039 | 4802639923a0ff06 |
| app/src/theme.ts | 248995 | 2117037010bbb372 |
| app/test/wiplineage.test.ts | 8294 | d72030260c810c54 |
| app/test/console.test.ts | 98915 | 2da87f329d1a97d8 |
| app/test/fieldestimates.test.ts | 18330 | 5527a6df949d383e |
| app/scripts/smoke.mjs | 956850 | 9728d37fd3fb0905 |

Dash and CR scan of those nine files: U+2013 0, U+2014 0, CR 0. The new module and its test use invented names (Northwind Store, Cedar Laboratory, Sample). The other touched files still contain names that were already in them. `console.test.ts` and `fieldestimates.test.ts` changed only so the report list length is 17.

Tails (last lines):

- `wiplineage.ts`: the page return, then `}`
- `reports.ts`: `};` / `}`
- `index.ts`: `export { app };` / `export default worker;`
- `i18n.ts`: `refusalText` return, then `}`
- `theme.ts`: `` </style>`; `` / `}`
- `wiplineage.test.ts`, `console.test.ts`, `fieldestimates.test.ts`: `});` / `});`
- `smoke.mjs`: `process.exit(1);` / `});`

## Gates

Typecheck: `npx tsc --noEmit` exit 0.

Vitest TZ=UTC:

```
Test Files  122 passed (122)
Tests  1686 passed | 6 skipped (1692)
Duration  35.60s
```

Vitest TZ=America/New_York:

```
Test Files  122 passed (122)
Tests  1686 passed | 6 skipped (1692)
Duration  32.98s
```

`node --check scripts/smoke.mjs` exit 0.

From-zero smoke exited 0. It printed `About to apply 116 migration(s)`, `GET /reports/wip_lineage 200 OK`, `SMOKE PASS` and `SMOKE_EXIT 0`. No response in the log is a 500. The log lines:

```
About to apply 116 migration(s)
GET /reports/wip_lineage 200 OK (38ms)
SMOKE PASS
SMOKE_EXIT 0
```

## Decided

- Pounds use `Math.round(grams / 448)`. That is her rounding, with the app pound in place of 453.592.
- A tag in more than one transfer keeps the latest received date, then the later manifest. The file order is not stored.
- A gone package with no inactive state and no transfer is left off the page. It is not a row in the current three exports.
- A null quantity becomes 0 on the lineage row, matching her converter.
- The license select is omitted when only one AU-P license has rows. The page then uses AU-P-000694.
- Expand all and Collapse all are links. The page stays server rendered.
- There is no CSV of this page. Buyer names, licenses and manifests stay on the signed-in report.
- No index. The tables hold a few thousand rows.
- An empty location is blank. A dash character is not used for it.
- The branch chip Other uses the translation already in the app (Otros), so the console's Other label is unchanged.

## Declined

Her import pane is not built. Files go in through Admin, METRC. Her theme.css and d3 are not copied. The layout uses the app's tokens.

Tree left `4496aa03aa378d12`. Nothing is committed, pushed, or deployed. The Scribe gates. The owner merges. This slice has no migration.
