# 2026-10-02 Post Harvest Puzzles

BRIEF V21, POST HARVEST PUZZLES (canon 0.30.351), built in the worktree `branches/GFLiteOpsDashboard` under THE DISPATCH RULE (canon 0.30.155), on the app tree this session had just landed for V20 (`104299a21bfc1d06`, 265 files, migrations 0001 to 0088). The app tree after these edits hashes `0dc4b3ea3ae96927` (269 files). Migration 0089. The smoke pin is 89. Not deployed. Nothing committed. Nothing pushed. No git was run.

## What changed

- Reports key `post_harvest_puzzles`, title "Post Harvest Puzzles". Filters: Harvest year (years that have history rows or app lots, newest first, newest by default) and Farm (All, PNN, PNS, ARL; All by default). CSV, XLSX, and PDF go through the reports module. The HTML page is the same route, with the import pane, the per-row plan form, the new-strains block, and the highlight key.
- One row per strain. "R&D" is left out. Rows sort by $PP, highest first. A zero divisor shows "-". Pounds are two decimals with thousands commas. Percents are one decimal. $PP is dollars with two decimals. THC is two decimals. The harvest date is YYYY-MM-DD.
- The columns, in order: Strain, Plants, Wet lbs, Dry lbs, Dry %, Total Bud, Total Trim/Bio, Wet #s PP, Dry #s PP, BTR, BPP, TPP, $PP, Average THC, TYM Fails, # Tests, TYM% Failed, Harvest Date, "{Y+1} Allocation", TC or IH. Every pound is grams over 448. Shake counts in Total Bud. Kief is in Dry lbs and in neither Total Bud nor Total Trim/Bio.
- Totals under the table: Plants, Wet lbs, and Dry lbs summed; the per-plant wet and dry under those two; the allocation summed, and beside it the allocation plus the new strains.
- A test belongs to year Y when the last five characters of its HBN start with that year's two digits. Within the year, a strain's tests are those whose tested strain is one of the market strains of its lots (a blank market strain reads as the strain's own name). When that finds none, the tests whose HBN is one of the strain's lots. Live tests are `external_test_results` with `deleted_at IS NULL AND (source <> 'sheet' OR on_sheet = 1)`.
- The plan is per year and strain: allocation (whole plants) and TC or IH, saved with a reason and logged on `post_harvest_plan` under the actor. Below the table, new strains are plan rows whose strain has no lot in that year, plus an Add form. The farm filter does not filter the plan.
- The import pane takes an .xlsx. The `data` sheet lands history lots (headers matched with whitespace collapsed, so a line break in "Wet Spear Weight (grams)" still matches). `InTesting` goes through `rowsFromSheet` and `assignAttempts` into history tests, never into `external_test_results`. The `results` sheet's Allocation and TC or IH columns, and the T33:V42 block, land in the plan. The year is the lots' token year. A second import of that year replaces its history and its imported plan rows. Typed rows are replaced only when the confirm box is checked. The pane reports lots, tests, and plan rows.
- A year with history rows is read from history. Otherwise it is computed from the lots. A year never mixes the two. Live lots are `wet_weight_entries` joined to `harvest_batches` for that `harvest_year`, both not deleted. Plants are `plant_count` (null is zero). Wet is the lot's `wet_weights` sum. Products are the lot's trim packages (`NON_TRIM_SOURCE_SQL`): BUD bud, MIX mixed, SMALLS and WPR smalls, SHAKE and SHA shake, TRIM trim, BIO bio, KIEF kief. WASTE and any other code are left out.
- Admin, Lookups, after Max Tote Weight: "Bud $/lb" (`php_bud_price_per_lb`, default 150) and "Trim $/lb" (`php_trim_price_per_lb`, default 30), each 0 to 10,000 with two decimals and a reason, on `saveConfigNumber`. No migration for the prices.
- The ten highest Dry #s PP, BTR, $PP, and Average THC are shaded `#C6EFCE` with text `#006100`. The ten highest TYM% Failed are shaded `#FFC7CE` with text `#9C0006`. In dark mode those become the theme's success and danger tints. The key under the table reads "10 best", "10 worst", and "PP = per plant".
- `src/xlsx.ts` reads an .xlsx from the zip central directory. Deflated parts use `DecompressionStream("deflate-raw")`. Shared strings, sheet names, and cached cell values only. Dates stay Excel serials. The grid is the same shape `readXlsbSheets` yields.
- EN and ES for the new labels, headers, refusals, and help lines.
- The synthetic workbook `test/fixtures/post-harvest-synthetic.xlsx` is one Alpha lot, one test, and one plan row for 2025. No personnel names. The notes column of a real workbook is not stored.

## The synthetic import

The unit import and the smoke import of that fixture both reported 2025: 1 lot, 1 test, 1 plan row (allocation 100 in the unit workbook, 12 in the smoke fixture, TC). A typed save to 50 stayed 50 on a second import, and returned to the sheet's 100 only with the confirm box.

## Assumptions for his word

- $PP sorts the rows. A strain with no $PP (a zero plant count, or no bud and no trim) sorts after the ones that have a figure, by strain name.
- TYM Fails counts every test of the strain whose status reads failed and whose fail reason contains "yeast", not only attempt 1. # Tests is attempt 1. TYM% is the first over the second.
- "10 best" and "10 worst" are the ten highest numbers in that column. A dash is not in the ten. Fewer than ten numbers highlights all of them.
- The farm filter limits the lots in the table. It does not limit the plan or the new-strain block. The "with new strains" allocation adds every new strain's plants to the table's allocation.
- The page hides nothing the sheet shows except the workbook's notes column, which is not stored.

## Gates

Run in the worktree's `app/`.

- `npm run typecheck`: exit 0 (`npx tsc --noEmit` exit 0; the typecheck script also regenerates the git-ignored `worker-configuration.d.ts`).
- `npx vitest run`: 79 files, 1058 tests passed under `TZ=UTC`, and 79 files, 1058 tests passed under `TZ=America/New_York`.
- `node --check scripts/smoke.mjs`: exit 0.
- From-zero smoke (`SMOKE_PORT=9321`, `WRANGLER_SEND_METRICS=false`, `CI=1`, `TZ=UTC`): About to apply 89 migration(s), SMOKE PASS, no ` 500 ` line, exit 0 (18070 lines of log; the one ` 503 ` line is `POST /api/send`).
- Dash audit: 0 on the text files touched (U+2014 and U+2013). No CR byte on those text files. The synthetic xlsx is binary.
- No key, secret, or password value added. No personnel name in the fixture, the test, or this report.

## Deploy

Not deployed from this session. Nothing committed. Nothing pushed. No git was run.

## Sealed final check

```
the tree this slice opened on        104299a21bfc1d06 (265 files; V20, migrations 0001-0088)
npm run typecheck                     exit 0
TZ=UTC npx vitest run                 79 files, 1058 tests passed
TZ=America/New_York npx vitest run    79 files, 1058 tests passed
node --check scripts/smoke.mjs        exit 0
SMOKE_PORT=9321 WRANGLER_SEND_METRICS=false CI=1 TZ=UTC node scripts/smoke.mjs
                                      About to apply 89 migration(s); SMOKE PASS; " 500 " lines: 0; " 503 " lines: 1 (POST /api/send); exit 0
dash audit: 0; CR audit: 0 on the text files; secret values: none; personnel data: none
the app tree after the edits             0dc4b3ea3ae96927 (269 files)
```

```
app/migrations/0089_post_harvest_puzzles.sql   1944  d1217330a2dcfeec
TAIL CREATE INDEX post_harvest_plan_year ON post_harvest_plan (harvest_year);
app/src/config.ts                          82447  929bed18d6fc10c8
TAIL }
app/src/lookups.ts                         11761  5f41969835acf99d
TAIL };
app/src/theme.ts                          188980  1c96f21ca356eef9
TAIL }
app/src/reports.ts                         30654  aabda628806733da
TAIL }
app/src/xlsx.ts                            19707  e303cb6f35ebbf66
TAIL }
app/src/puzzles.ts                         44223  48dba0ae682f3c08
TAIL }
app/src/actions.ts                        415137  ab240505f50de5fa
TAIL export { MANIFEST_COLUMNS, buckedPackageCode };
app/src/pages.ts                           37349  534c151311e329f5
TAIL }
app/src/index.ts                          166029  cbd36d6250ba3a3f
TAIL export default worker;
app/src/i18n.ts                           209337  ec9f55dea4e1f767
TAIL }
app/scripts/smoke.mjs                     730841  ab1a246c4ccddad3
TAIL });
app/test/console.test.ts                   71009  d32f50fc6298ace2
TAIL });
app/test/puzzles.test.ts                   10808  49723e1586cf959b
TAIL });
app/test/fixtures/post-harvest-synthetic.xlsx  11438  de79c2f968c234f8
```
