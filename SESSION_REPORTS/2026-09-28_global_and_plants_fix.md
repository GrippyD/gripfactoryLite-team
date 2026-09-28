# 2026-09-28 The fix to Global and Plants, Scribe direct, and its gate (canon 0.30.290): PASSED

Scribe session. The one-word fix the gate held V3 for (`SESSION_REPORTS/2026-09-28_gate_global_and_plants.md`, canon 0.30.289), made by the Scribe on the worktree `branches/GFLiteOpsDashboard` at his word, verbatim: "you do it" (G-2, the quiet tree). Not deployed. Nothing committed. No git was run. The pre snapshot is not taken from here.

## The change

`Harvest year` in Spanish reads `Año de cosecha`, with its tilde, in the three places the string lives: `src/i18n.ts` line 1254 (the dictionary entry), `test/console.test.ts` line 341 (the expected Plants summary), `scripts/smoke.mjs` line 5181 (the smoke's Spanish assert). One word, three files, one byte more in each (the tilde is two bytes in UTF-8 where the bare vowel was one). Nothing else in the tree moved: the worktree's app tree hashes `f91fefd5046c4b62`, the held tree `60db53e344f2ae48` plus these three edits and nothing else.

## How it was made and proved

1. The three edits were applied first in the Scribe's sandbox on a copy of the held tree, each by an exact single-occurrence replacement, and the sandbox tree was gated (below).
2. The same three replacements were then applied on the worktree through the bridge, in place, after the three files were confirmed at their held hashes (79d0b7685fdf4f6c, 94df3f900eaa8c91, bd50b65bf2f78f6b); the three files on the disk now hash exactly as the sandbox's (e5e9d8188f543b60, 3d356828b3b6ffdb, ffc0aaa1f91f203d), and the whole app tree on the disk hashes `f91fefd5046c4b62`, the same as the sandbox's, so the gates below ran on the bytes that will merge.

## Gates on the fixed tree (the Scribe's sandbox)

- `npm run typecheck` with the generated types file deleted first: exit 0.
- `npx vitest run`: 65 files, 953 tests passed; the same under `TZ=America/New_York`; `test/console.test.ts` alone: 36 passed.
- `node --check scripts/smoke.mjs`: ok.
- From-zero smoke (`SMOKE_PORT=9199`): `About to apply 78 migration(s)`, `SMOKE PASS`, no ` 500 ` line, the Spanish console assert among the steps passed.
- Dash audit: 0, and no CR byte, on the three files; the only byte above ASCII added is the tilde.
- The rest of V3's gate stands as reported (the seal of the other twelve files unchanged, migration 0078 rehearsed, the audits).

## The merge (his hands, in order)

```powershell
cd "C:\Users\DennisWallace\Documents\Claude\Projects\gripfactory Practical\app"
node scripts/db-snapshot.mjs pre_global_and_plants
cd "C:\Users\DennisWallace\Documents\Claude\Projects\gripfactory Practical\branches\GFLiteOpsDashboard"
git add -A
git commit -m "V3: global and plants" -m "The console fold remembered per browser, Today so far, Farm Plant Count (migration 0078) with its Admin page as the denominator, the two notes out, Weight Harvested on every Plants pane, the hours proved and a Labor hours report, the smoke pin at 78.`n`nCo-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`nClaude-Session: https://claude.ai/code/session_01VDz7UdaTSkjq69GvDfDWd7"
cd "C:\Users\DennisWallace\Documents\Claude\Projects\gripfactory Practical"
git merge --no-ff GFLiteOpsDashboard -m "Merge V3: global and plants"
git push
```

The push runs the workflow: typecheck, the tests, `apply migrations` (0078, one to apply), the deploy. His paste back: the snapshot's last line, the push's output, the run's result, and the Version ID from the deploy step's log; the Scribe reads main after the merge and folds LIVE.

## Sealed final check

```
rm worker-configuration.d.ts; npm run typecheck      exit 0
npx vitest run                        65 files, 953 tests passed
TZ=America/New_York npx vitest run    65 files, 953 tests passed
node --check scripts/smoke.mjs        ok
rm -rf .smoke-persist && CI=1 SMOKE_PORT=9199 WRANGLER_SEND_METRICS=false npm run smoke
                                      About to apply 78 migration(s); SMOKE PASS; " 500 " lines: 0
the three files, device and sandbox alike:
app/src/i18n.ts                                181323  e5e9d8188f543b60
TAIL r.words.vars) : t(locale, err.message);}
app/test/console.test.ts                        63637  3d356828b3b6ffdb
TAIL ch is not in the HBN Queue." });  });});
app/scripts/smoke.mjs                          617403  ffc0aaa1f91f203d
TAIL console.error(err);  process.exit(1);});
the app tree: f91fefd5046c4b62 (the held 60db53e344f2ae48 plus the three edits)
dash audit: 0; CR audit: 0
```
