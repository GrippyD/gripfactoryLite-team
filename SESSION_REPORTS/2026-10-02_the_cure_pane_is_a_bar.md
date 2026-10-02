# 2026-10-02 The cure pane is a bar (canon 0.30.355)

Scribe session, Scribe-direct under G-2 (a small change to three things on a live surface). His words, 2026-10-02, verbatim, with a picture of the drying row (CSA 18 of 36, CSB 9 of 8, both tiles narrower than the silo tiles above):

"CSA/CSB:

1.  match width of the columns above.
2. Sorry, I didn't mean increase the saturation level of green, I meant if it's 50% full, saturate with green from the bottom to 50% of the way up--in other words make the whole pane into a bar on a graph.  The graph's one datapoint is "how full?"
3. Say "how full" in text.  Collapse all the lots into the text containing the fullness" "% full - n Lots".  Expanding shows the lots as they are now, and the lots themselves should still expand."

## What changed (on the live tree `b21e74a97758648a`)

1. THE WIDTH. `src/theme.ts`: `.cure-pane` is 13.6rem, the `.silo-gauge` width, its children the full width (they were 11.2rem, so the pane came out narrower). On a local worker, every tile in the row measures the same 218 px: the eight space tiles, CSA and CSB.
2. THE BAR. `src/cure.ts`: `cureShadeFill(n, cap)` is the percent full (lots over the cap) to one decimal, capped at 100.0 (`cureShadeOpacity` is gone). The shade sits at the tile's bottom with that inline height, a steady green (`rgba(46, 158, 79, 0.6)`, a 2 px top edge; in the Grip chrome `rgba(62, 207, 107, 0.5)` with a `#3ecf6b` edge), rising as lots arrive. At 18 of 36 it fills half the tile; past the cap it fills the tile, and the line letters in red as before.
3. THE FULLNESS LINE FOLDS THE LOTS. The pane reads: the name; the conditions line; then one `<details class="cure-lots">` whose summary is "{pct}% full - {n} Lots" ("1 Lot" for one; ES "{pct}% lleno - {n} lotes"), with "{n} of {cap} lots, {pct}% full" as its hover title. Folded, the pane is those three lines over its bar. Open, the lots appear exactly as they were, each still folding on its lot number. The fold stays as the tablet left it across a reload (localStorage per pane, `gf_cure_open:`).
4. `test/curecaps.test.ts` follows the new law (0, 18, 1 and 40 lots of 36: the fill 0.0, 50.0 and 100.0, the summary words, the order name, conditions, lots, the lot rows inside the fold, the ES words). `scripts/smoke.mjs`: the fill in place of the opacity, the fullness summary over the folded lots, the over-cap pane on a full bar.

## Gates

```
THE LANDED TREE (4047f0ef84ba0ae2, 269 files; sandbox and disk)
npm run typecheck                     exit 0
TZ=UTC npx vitest run                 79 files, 1058 tests passed
TZ=America/New_York npx vitest run    79 files, 1058 tests passed
node --check scripts/smoke.mjs        ok
CI=1 SMOKE_PORT=9341 ... npm run smoke   About to apply 89 migration(s); SMOKE PASS; " 500 " lines: 0
the page on a local worker (Grip view)   every tile 218 px wide; CSA at 4 of 8 a bar half the tile high, "50% full - 4 Lots"; CSB at 1 of 8 "13% full - 1 Lot"
the worktree before landing           b21e74a97758648a (the live tree)
changed against the live tree (5):
app/scripts/smoke.mjs                     731241  137bb979e24dcf92
app/src/cure.ts                            20234  530688325299c4d7
app/src/i18n.ts                           209516  887ed026d821dddb
app/src/theme.ts                          189538  e750d37e992e201e
app/test/curecaps.test.ts                   6200  41cdc9978e3a5bbf
dash audit (by character): 0; CR audit: 0; secret grep: no values; personnel data: none
```

## His hands (no migration in this push)

```powershell
cd "C:\Users\DennisWallace\Documents\Claude\Projects\gripfactory Practical\app"
node scripts/db-snapshot.mjs pre_cure_bar
if ($LASTEXITCODE -ne 0) { throw "snapshot failed, stop here" }
cd "C:\Users\DennisWallace\Documents\Claude\Projects\gripfactory Practical\branches\GFLiteOpsDashboard"
git add -A
git commit -m "The cure pane is a bar" -m "CSA and CSB take the silo tiles' width; the green rises from the bottom to the percent full; the lots fold under one line, % full - n Lots, each lot still folding on its number. No migration. Canon 0.30.355.`n`nCo-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`nClaude-Session: https://claude.ai/code/session_01VDz7UdaTSkjq69GvDfDWd7"
cd "C:\Users\DennisWallace\Documents\Claude\Projects\gripfactory Practical"
git checkout -- canon
git merge --no-ff GFLiteOpsDashboard -m "Merge: the cure pane is a bar"
git push
```

The main folder's snapshot script now reads in pages (merged in V18 to V21), so the snapshot runs from the main folder again. His paste back: the Version ID.
