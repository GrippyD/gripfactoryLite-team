# 2026-10-02 The Max Tote Weight (canon 0.30.350)

Scribe session, Scribe-direct under G-2 (a typo tote of 64,668,712 g sits on today's weighing lot; the floor needs the guard now). The owner's words, 2026-10-02, verbatim: "Can we add that to an Admin lookup? Seed 50lbs".

## What landed (the tree `b26531a8b30fd971`, eight files against the live `f59f86b3b0f48348`)

1. ADMIN, LOOKUPS: a new button after Trim Bogey, **Max Tote Weight**, opening `/admin/lookups/max_tote_lbs`: one box in pounds (1 to 500, up to two decimals, a trailing "lb" tolerated), a reason, Save; the page reads 50 until saved and says so. The value lives in `app_config` under `max_tote_lbs`; the save is logged like the Trim Bogey (the two now share one `saveConfigNumber`). No migration: the default 50 is in code (`MAX_TOTE_LBS_DEFAULT`).
2. THE GUARD: one weight above the limit (pounds times 448 g, the app's pound) refuses before anything is saved, in words: "64,668,712 g is over the Max Tote Weight (50 lb, 22,400 g). Check the scale reading and type it again." It stands on the field node (Penn South/Arlington Harvest, every "+") and on Penn North Harvest's wet weights. Trim, cryo, unload and the dry weights are untouched (their packages run past 50 lb by right).
3. EN and ES words for all of it; `test/maxtote.test.ts` (3 cases: the default, a saved limit, the refusal on both nodes); the smoke reads the page at 50, saves 500 (its freezer walk weighs 200 lb at once) and sees the 64,668,712 g tote refused.

## Not touched

The two typo totes already on 26087's lot (64,668,712 g at 10:16 and 112,032 g at 10:09) stay as they are: the guard stops new ones only. Their fix waits on his look; a repair file can void them once he says which.

## Gates

```
THE LANDED TREE (b26531a8b30fd971, 261 files with the dated repairs; sandbox and disk)
npm run typecheck                     exit 0
TZ=UTC npx vitest run                 75 files, 1044 tests passed
TZ=America/New_York npx vitest run    75 files, 1044 tests passed
node --check scripts/smoke.mjs        ok
CI=1 SMOKE_PORT=9303 ... npm run smoke   About to apply 87 migration(s); SMOKE PASS; " 500 " lines: 0
the worktree before landing           f59f86b3b0f48348 (the live tree)
changed against the live tree (8):
app/scripts/smoke.mjs                     717043  4c57cb9abd4bf2b6
app/src/actions.ts                        412627  e3ace08f1ef79bba
app/src/config.ts                          80390  4c623de47a458fda
app/src/i18n.ts                           197509  019237d08467a7f7
app/src/index.ts                          158543  3641bfeac4604374
app/src/lookups.ts                         10540  9e8b1d2709bcd61d
app/src/pages.ts                           31904  80194eb5bd67e588
app/test/maxtote.test.ts (new)              2967  66e7b11845597c97
dash audit: 0; CR audit: 0; secret grep: no values; personnel data: none
```

## His hands (no migration in this push)

```powershell
cd "C:\Users\DennisWallace\Documents\Claude\Projects\gripfactory Practical\app"
node scripts/db-snapshot.mjs pre_max_tote
if ($LASTEXITCODE -ne 0) { throw "snapshot failed, stop here" }
cd "C:\Users\DennisWallace\Documents\Claude\Projects\gripfactory Practical\branches\GFLiteOpsDashboard"
git add -A
git commit -m "Max Tote Weight" -m "A new Admin lookup, Max Tote Weight, seeded at 50 lb; one wet weight over it refuses before it is saved, on the field node and on Penn North Harvest. No migration. Canon 0.30.350.`n`nCo-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`nClaude-Session: https://claude.ai/code/session_01VDz7UdaTSkjq69GvDfDWd7"
cd "C:\Users\DennisWallace\Documents\Claude\Projects\gripfactory Practical"
git checkout -- canon
git merge --no-ff GFLiteOpsDashboard -m "Merge: Max Tote Weight"
git push
```

If the snapshot answers 7403 on its first query, run that line alone once more, then the rest. His paste back: the Version ID.
