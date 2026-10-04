# 2026-10-04 The gate on L5, anchors as the farm editor does them (canon 0.30.403): PASSED

Scribe session. BRIEF L5 (`BRIEFS/2026-10-04_labels_l5_anchors.md`, 7,139 bytes, `7ba3d0bfcae11b3d`), built by his Code session on the live tree `24b7982823f39aed`. Its report `SESSION_REPORTS/2026-10-04_labels_l5.md` with sixteen screenshots. Its hand-back, verbatim in part: "After this session it is `07115fdee6e847f7` (299 files, migrations 0001 to 0094). Nothing was committed, pushed, or deployed."

VERDICT: PASSED. No change by the Scribe. R2 (Line packages, last 6 of harvest package) was not built in this session; it goes next on this tree.

## What was gated

1. THE MAIN FOLDER: `src`, `test`, `scripts` and `migrations` of the main folder's `app/` equal HEAD `7b6b97e`. Clean for the merge.
2. THE TREE. Staged as `gateL5.tar` (13,219,840 bytes, `f670f9e259a0dcbe`). By the Scribe's tree hash (the command canon has always used) the tree is `3bdafe56c5701cae`, 299 files, on the disk and in the sandbox alike; the report's `07115fdee6e847f7` came from another way of hashing. Every file seal in the report matches the bytes on the disk (`src/labelgeom.ts` 17,639 `c49aa4c4a38f098c`, `src/labeleditor.ts` 97,496 `87f0a9ccd6566497`, `src/i18n.ts` 264,017 `381fbe69f55ffc47`, `test/labelgeom.test.ts` 13,609 `59fd769432b45ad7`, `test/labeleditor.test.ts` 13,564 `eb748970891124d9`, `scripts/smoke.mjs` 793,183 `976e2bad6c7e9ec3`), and against the live tree only those six files differ (2 new, 4 changed). No other file moved.
3. GATES: typecheck 0; 91 files, 1,222 tests UTC and New York; `node --check scripts/smoke.mjs` 0; the from-zero smoke `About to apply 94 migration(s)`, SMOKE PASS, no ` 500 `.
4. THE ANCHORS, measured by the Scribe in a real browser at 1920 wide on a saved 4 x 6 template: an upright 2 x 1 rectangle's eight handles sit on its corners and side midpoints to the pixel; a rectangle at 30 degrees, the same on its rotated corners and sides; a reshaped triangle's three joints on its three points, its eight handles on its box; dragging a rectangle beside the triangle drew the align guide and the lock rings. In Lite, CO and Cerberus. No page error.
5. THE SHAPES draw to their box (the rectangle `0 0 100 100`); a new triangle is dropped with its points on the box; an old triangle keeps its inset points until a joint is edited, as the brief says.

## For his word (no hold)

- A shape's outline is centered on its box edge and the half outside is clipped, so an outline now prints at about half its set thickness (a 2 reads like a 1). Drawing the outline fully inside the box would keep its thickness; a small touch if wanted.
- The build's tree hash differs from the Scribe's command; the next brief names the command.

## Sealed final check

```
THE MAIN FOLDER                       src, test, scripts, migrations = HEAD 7b6b97e
THE TREE (3bdafe56c5701cae by canon's command, 299 files; the report's 07115fdee6e847f7); six files changed, seals match
npm run typecheck                     exit 0
TZ=UTC npx vitest run                 91 files, 1222 tests passed
TZ=America/New_York npx vitest run    91 files, 1222 tests passed
CI=1 SMOKE_PORT=9446 npm run smoke    About to apply 94 migration(s); SMOKE PASS; " 500 " lines: 0
anchors measured at 1920 (upright, 30 degrees, triangle joints): 0 px off; guide and lock seen
dash audit (by character): 0; CR audit: 0; personnel data: none
```

Screenshots beside this report: `2026-10-04_gate_labels_l5_rotated.png` (42,492, `f1b7982dcb31c525`), `2026-10-04_gate_labels_l5_drag.png` (33,886, `d0985fbe3349b9a1`).

## The merge (his hands; no migration)

```powershell
cd "C:\Users\DennisWallace\Documents\Claude\Projects\gripfactory Practical\app"
node scripts/db-snapshot.mjs pre_l5
if ($LASTEXITCODE -ne 0) { throw "snapshot failed, stop here" }
cd "C:\Users\DennisWallace\Documents\Claude\Projects\gripfactory Practical\branches\GFLiteOpsDashboard"
git add -A
git commit -m "L5: anchors as the farm editor does them" -m "Shapes draw to their box; eight handles on the corners and side midpoints, rotation applied; triangle joints as box fractions; joint snap level, upright or square; move and resize snap to joints and the label corners, lock and align, over the grid; Alt turns snap off. No migration. Canon 0.30.399 to 0.30.404.`n`nCo-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`nClaude-Session: https://claude.ai/code/session_01VDz7UdaTSkjq69GvDfDWd7"
cd "C:\Users\DennisWallace\Documents\Claude\Projects\gripfactory Practical"
git checkout -- canon
git merge --no-ff GFLiteOpsDashboard -m "Merge L5: anchors"
git push
```

His paste back: the Version ID.
