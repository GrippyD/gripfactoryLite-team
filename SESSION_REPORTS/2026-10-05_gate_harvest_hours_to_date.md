# 2026-10-05 The gate on R4, Harvest Hours to date (canon 0.30.410): PASSED

Scribe session. MINI BRIEF R4 (`BRIEFS/2026-10-05_harvest_hours_to_date.md`), built ALONE by his Code session on the live tree `335dfa13121944d5` (R3 was never built in the worktree, so R4 does not ride it). Its report `SESSION_REPORTS/2026-10-05_harvest_hours_to_date.md`. Its hand-back, verbatim in part: "R3 was not on this worktree, so Harvest Hours to date was built on the live tree by itself."

VERDICT: PASSED. No change by the Scribe. R3 (Weighted BTR to date) stays unbuilt; it is re-pinned to this tree once R4 is live.

## What was gated

1. THE MAIN FOLDER: `src`, `test`, `scripts` and `migrations` of the main folder's `app/` equal HEAD `2bd6f36` (L5 and R2 live); origin/main at `2bd6f36`. Clean for the merge.
2. THE TREE. Staged as `gateR4.tar` (23,531,520 bytes); canon's tree hash `d5c56d6a8251056e`, 299 files, on the disk and in the sandbox, the same figure the report gives. Against the live tree only five files differ, all R4's, every seal matching the report: `src/console.ts` 169,049 `d74d9852c5efacf1`, `src/i18n.ts` 264,584 `bbae41b84b20bbde`, `test/console.test.ts` 93,528 `4402285de57fbda9`, `test/farmday.test.ts` 16,465 `22c1c290fdd36b61`, `scripts/smoke.mjs` 797,413 `9da1d473add3c394`. Every line read.
3. GATES: typecheck 0; 91 files, 1,225 tests UTC and New York; `node --check scripts/smoke.mjs` 0; the from-zero smoke `About to apply 94 migration(s)`, SMOKE PASS, no ` 500 `.
4. THE CODE (`harvestHoursThrough`): one read of the year's `harvest_labor_hours` from Jan 1 through the day under view; each date takes its ALL row when one stands, else the sum of its PNN, ARL and PNS rows, the same rule and the same farm list the day uses; later dates and other years out; summed in cents; no rows gives "type hours". (farm_code, work_date) is unique in the table, so a date cannot double count.
5. RECOMPUTED by the Scribe from the snapshots, by its own script: on `20261004-205213_wip_template`, 25,631.84 through 2026-09-28 and 32,166.84 through 2026-10-02 (the brief's figures); on the newest snapshot `20261005-121446_post_26028` (the 2026-10-03 ALL row of 1,610 added), today reads 33,776.84 since 2026-07-20.
6. RENDERED by the Scribe on the smoke's own data at 1920 and 1366 wide in Lite, CO and Cerberus: "Harvest Hours to date 2777.75 since 2026-10-03" on the Total pane only, between Harvest Hours and Weight/DLH; no overflow, no page error. Clicking days: 2026-10-02 "type hours", 2026-10-03 2,753, 2026-10-04 and today 2,777.75.

## For his word (no hold)

- The figure prints as typed, without a thousands comma (`32166.84`), as Harvest Hours does. A comma is a one line touch if wanted.
- The year summed is today's year, as every other figure on the dashboard uses; a day picked in last year would read "type hours".
- The smoke held its worker open after SMOKE PASS; the Scribe rendered against it and then stopped it, and the run closed exit 0.

## Also verified: the 26028 restore he ran

Snapshots `20261005-115029_pre_26028` and `20261005-121446_post_26028` (one more pair in between, idempotent). On the post snapshot: 27 wet 1,623,541 g (351 rows), dry 371,595, trim scheduled 10-04, its 24 trim packages (227,917 g, all code 58008, 10-04) kept; 28 live, Grip Cake, wet 7,082,401 g (982 rows), dry 1,307,677, the 450 dry rows on it, load ede97313 ended 2026-09-29T21:22:11.562Z, trim scheduled 10-05; the three pending METRC files of each lot cleared; 29 stays deleted. No trim for 28 yet logged under 27. The lot dry figures hold METRC's numbers, while the moved dry rows sum to 302,510 (27) and 1,244,555 (28), the same 1,547,065 g as before.

## Sealed final check

```
THE MAIN FOLDER                       src, test, scripts, migrations = HEAD 2bd6f36
THE TREE (d5c56d6a8251056e by canon's command, 299 files); five files changed, seals match
npm run typecheck                     exit 0
TZ=UTC npx vitest run                 91 files, 1225 tests passed
TZ=America/New_York npx vitest run    91 files, 1225 tests passed
CI=1 SMOKE_PORT=9450 npm run smoke    About to apply 94 migration(s); SMOKE PASS; " 500 " lines: 0
recompute (wip_template)              25631.84 through 09-28; 32166.84 through 10-02
render 1920 and 1366, three views     after hours, before weight_per_dlh; Total only; no error
dash audit (by character): 0; CR audit: 0; personnel data: none
```

## The merge (his hands; no migration)

```powershell
cd "C:\Users\DennisWallace\Documents\Claude\Projects\gripfactory Practical\app"
node scripts/db-snapshot.mjs pre_r4
if ($LASTEXITCODE -ne 0) { throw "snapshot failed, stop here" }
cd "C:\Users\DennisWallace\Documents\Claude\Projects\gripfactory Practical\branches\GFLiteOpsDashboard"
git add -A
git commit -m "R4: Harvest Hours to date on the Total pane" -m "The Total pane shows the harvest year's hours through the day under view, each date by the day's rule (the ALL row, else the farm rows), with the first work date under it. Farm panes, Harvest Hours and Weight/DLH unchanged. No migration. Canon 0.30.409 to 0.30.410.`n`nCo-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`nClaude-Session: https://claude.ai/code/session_01VDz7UdaTSkjq69GvDfDWd7"
cd "C:\Users\DennisWallace\Documents\Claude\Projects\gripfactory Practical"
git checkout -- canon
git merge --no-ff GFLiteOpsDashboard -m "Merge R4: Harvest Hours to date"
git push
```

His paste back: the Version ID.
