# 2026-10-03 The gate on V28, the count rides the bar, and the rooms read Silo Ops (canon 0.30.379): PASSED

Scribe session. BRIEF V28 (`BRIEFS/2026-10-03_the_count_rides_the_bar.md`, 6,984 bytes, `efc39a21c07273a8`), built by his Code session on the live tree `a6a9608eb68264ff`. Its report `SESSION_REPORTS/2026-10-03_the_count_rides_the_bar.md` (8,864 bytes) with two screenshots beside it. His hand-back, verbatim in part: "The app tree after the edits is `1ae17bb287a366ea` (283 files, migrations 0001-0090). No migration. Nothing committed, pushed, or deployed."

VERDICT: PASSED. Nothing held, nothing changed by the Scribe.

## What was gated

1. THE MAIN FOLDER: `src`, `test`, `scripts` and `migrations` of the main folder's `app/` equal HEAD `bcdcf09`. Clean for the merge.
2. THE TREE. Staged as `gateV28.tar` (11,345,920 bytes, `fb3b674f9741efa6`, the report and both screenshots in it), unpacked; `1ae17bb287a366ea` both sides, 283 files; against the live tree 8 files changed, none added: `src/cure.ts`, `src/environment.ts`, `src/i18n.ts`, `src/theme.ts`, `test/cure.test.ts`, `test/curecaps.test.ts`, `test/environment.test.ts`, `scripts/smoke.mjs`.
3. GATES: typecheck 0; 85 files, 1,159 tests under `TZ=UTC` and `TZ=America/New_York`; `node --check` ok; the from-zero smoke `About to apply 90 migration(s)`, SMOKE PASS, no ` 500 `; dash, CR and BOM audits 0 on the eight files, by character.
4. THE PICTURES, read by the Scribe: folded, CSA's green starts at 58% of the tile with "58% full - 21 Lots" its first line at the top edge, CSB's at 38% with "38% full - 3 Lots"; opened, CSA's green holds all 21 rows from the tile's bottom, the tile and the drying row taller, nothing clipped; CSB's green holds its 3 rows at 38% of the taller row. Both lines read "no sensor yet" (the test row passed over).
5. THE READING DOOR: `latestReading` passes over `source` test (case-blind, trimmed) in SQL; the door is unchanged.

## For his word (no hold)

- In the opened rows the clock ("no time" in the pictures) runs to the tile's right edge with no padding. A cosmetic touch for a later pass, if wanted.
- A Scribe's slip: one read-only command of this gate carried a `git status` with its output discarded; nothing was changed by it. The gate's law is never to run it; it will not recur.

## Sealed final check

```
THE MAIN FOLDER                       src, test, scripts, migrations = HEAD bcdcf09
THE TREE AS RECEIVED AND GATED (1ae17bb287a366ea, 283 files; the live tree a6a9608eb68264ff)
npm run typecheck                     exit 0
TZ=UTC npx vitest run                 85 files, 1159 tests passed
TZ=America/New_York npx vitest run    85 files, 1159 tests passed
node --check scripts/smoke.mjs        ok
CI=1 SMOKE_PORT=9428 npm run smoke    About to apply 90 migration(s); SMOKE PASS; " 500 " lines: 0
the screenshots                       folded and opened, CSA 58% / 21 lots, CSB 38% / 3 lots, as the law reads
changed (8): src/cure.ts, src/environment.ts, src/i18n.ts, src/theme.ts, test/cure.test.ts, test/curecaps.test.ts, test/environment.test.ts, scripts/smoke.mjs
dash audit (by character): 0; CR audit: 0; BOM: 0; personnel data: none
```

## The merge (his hands; no migration)

```powershell
cd "C:\Users\DennisWallace\Documents\Claude\Projects\gripfactory Practical\app"
node scripts/db-snapshot.mjs pre_v28
if ($LASTEXITCODE -ne 0) { throw "snapshot failed, stop here" }
cd "C:\Users\DennisWallace\Documents\Claude\Projects\gripfactory Practical\branches\GFLiteOpsDashboard"
git add -A
git commit -m "V28: the count rides the bar, and the rooms read Silo Ops" -m "On CSA and CSB the fullness line is the first line inside the green; opened, the bar grows from the tile's bottom to hold every lot. A test reading never shows; a silo-ops reading names its source; the contract for Silo Ops' push is in the code and on Admin, Environment. No migration. Canon 0.30.378 to 0.30.379.`n`nCo-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`nClaude-Session: https://claude.ai/code/session_01VDz7UdaTSkjq69GvDfDWd7"
cd "C:\Users\DennisWallace\Documents\Claude\Projects\gripfactory Practical"
git checkout -- canon
git merge --no-ff GFLiteOpsDashboard -m "Merge V28: the count rides the bar, and the rooms read Silo Ops"
git push
```

His paste back: the Version ID.
