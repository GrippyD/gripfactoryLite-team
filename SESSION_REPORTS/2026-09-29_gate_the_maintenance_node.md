# 2026-09-29 The gate on the maintenance node (canon 0.30.296): HELD as received, the fix gated

Scribe session. The gate on V11, THE MAINTENANCE NODE (BRIEF V11, canon 0.30.293), on his Code session's `SESSION_REPORTS/2026-09-29_the_maintenance_node.md` in the worktree `branches/GFLiteOpsDashboard`. The report says "Not deployed. Nothing committed. No git was run."; the disk agrees. His hand-back, verbatim in part: "Maintenance sits to the left of Reports. The landing shows the drying pane, with Load Silo, Lab Sample, and a Trouble Tickets stub. Admin has the two interval lists. Open silo, room, and freezer loads count down to the next aW and MC check, and a siren stays up until Lab Sample requests that check. Migration `0080` adds `lab_sample_requests`."

VERDICT: HELD as received, on five lines of `src/labsample.ts` and one rule of `src/theme.ts`; every mechanical check is green, the migration rehearses clean, and the schedule math is right on the floor's ten open loads. The Scribe's fix is written and gated in the sandbox (three files, the tree `3f793c8248f5200b`) and waits on his word to land in the worktree; then the four acts.

## What was gated

1. THE TREE. Against V4's tree (`db2315fd48319e69`): three files new (`0080_maintenance_node.sql`, `src/labsample.ts`, `test/labsample.test.ts`), fourteen changed (compliance, consoleicons, drying, html, i18n, index, lookups, silo, theme, smoke, icon-proofs, console.test, consoleicons.test, silo.test), all seventeen in the seal and nothing outside it; `wrangler.toml`, `package.json`, `tsconfig.json` and `public/` untouched. The app tree as received hashes `988c1c0a87a4fdbd`. The seal matches byte for byte (size, sha256, tail) on his disk and in the Scribe's sandbox, the proofs sheet and the build report included.
2. THE SCHEDULE (law 3), `nextCheckDue` read line by line: `n` stamped requests and hours `h[0..k]` give check `n + 1`, due at `loaded_at + h[0]` when `n` is 0, else the last stamp plus `h[min(n, k)]`; the paused clock is accepted and ignored; an empty list is silent. Worked by hand on the floor's ten open loads (the 9/28 snapshot) with the lists [24, 48] and [72], no stamp, one stamp and three stamps: 10 of 10 match the code. THE FLOOR NOTE: the first time he types an aW or MC interval, every load older than that first interval sirens at once (the Arlington loads of 9/19 and 9/26, the freezer's of 9/23) until a request is made for each; the 9/28 loads count down.
3. THE TILES (law 3): each open load's block carries the two lines under its clock; a space holding several loads carries the earliest due per kind above them, naming the lot; the countdown script swaps a line to its siren at zero without a reload; `/silos/live.json` carries `checks` per space and the live paint rewrites `data-due` and the check number every 30 seconds. Rendered from a fixture (Silo 3 with one load 30 hours in and an aW check six hours overdue; the Arlington Dry Room with two loads, one of them past a request) in the CO, Lite and Spanish views, at 1100 px and 390 px.
4. LAB SAMPLE (law 4): the three panes and every move (schedule, request, unschedule, fulfill by hand with the range checks, return, the instrument's fulfillment) read and exercised in the fixture; every move logs on `lab_sample_requests`, field `status`. THE INTERVALS (law 2): the two lists, the add form, the renumbering on read, the soft delete with "removed". THE BAR, THE LANDING, THE STUB (laws 1 and 6). THE ALIASES (law 5): `moisture content`, `mc`, `moisture`, `mc%`, and `water_activity` reads as water activity through the header normalizer.
5. THE MIGRATION rehearsed on the 9/28 snapshot's floor at 0079 (the six tables that matter loaded: 48 loads, 10 open, 1,652 lookup rows, 36 config rows): 0080 creates the table with its 24 columns, the index and the partial unique index; a duplicate live (load, kind, check) is refused; the same check number is accepted again after a soft delete; a second run refuses (the table exists), as the workflow never re-applies; nothing else moves.

## The hold (five lines of law, one rule of the sheet)

1. THE WORDS ON THE LINE. As received the check number sat between "in" and the countdown: "Next aW check in 1 0d 13:59:25 Lot 26071", and the siren "aW check due 1". The fix puts the countdown first and the check after it through the dictionary's own "Check {n}": "Next aW check in 0d 13:59:25 · Check 1 · Lot 26071" and "aW check due · Check 1", in EN and ES.
2. THE SIREN'S COLOR. The brief said the waste red (`#7c1b1b`); on the two dark sheets that is a dim wine on near black and the alarm did not shout. The fix gives the siren each sheet's alarm red (`var(--danger, var(--alert, #8b2e2e))`: Cerberus's `#e05757`, the CO `--alert` `#ef8a6f`, Lite's `#8b2e2e` on paper) and lets the line flow as text with the icon at 1.9 rem beside the words; the throb is unchanged. A Scribe amendment to the brief's color, for his eye.
3. THE CREW READS FARM TIME (THE ZONELESS ZERO, canon 0.30.102/104). Lab Sample showed "requested at" and the completed time as the UTC stamp cut to sixteen characters (23:37 Eastern read as 03:37). The fix shows both through `etWallClock`.
4. THE INSTRUMENT'S DAY. The auto-fulfillment took an instrument row when `tested_at > requested_at` as strings; the imports store `tested_at` as the file wrote it ("2026-09-04", "9/29/2026 10:15 AM", or "unknown"), so a same-day reading never matched an ISO stamp and an undated row matched everything. The fix reads the row's day (`testedDayOf`: the farm day of a zoned instant, the date as written when the file carries none, null for "unknown") and asks for the request's farm day or later; a result already tied to a request still never answers twice.
5. THE RETURN'S STRAY ROW. A `<<` from Completed left the hand's own `internal_test_results` row in the lab's table, so a corrected value kept its wrong twin. The fix soft-deletes that row (reason "returned") when the request's linked result is a `lab_sample` row; an instrument's row stays the lab's and stays linked, so it cannot answer the request again.

Also in the fix, no law: the interval rows name their unit ("24 h"), the add form reads "Add a Time · Hours from last check", and a no-op ternary on the schedule button is gone. Tests added: the day reader and the after-the-request rule (seven shapes), the return's soft delete and the re-fulfillment, an undated instrument row that must not answer, and the farm-time words on the page.

## Observations for his word (no hold)

- The summary line on a shared space keeps the load it was drawn for until a reload; the live paint moves its due instant but not its lot when a request makes another load the earliest. A reload sets it right; the per-load lines are always right.
- A scheduled or requested check whose load has since ended stays in the middle pane until fulfilled or unscheduled.
- The CO sheet's hover lift and focus ring name `.admin-link` and `.reports-link` only; the Maintenance pill takes the base rule without them. Cosmetic.
- `src/consoleicons.ts` still opens with "Nothing in the served worker imports this module"; the gate and now the tiles import it. A comment, for a later tidy, since touching the module regenerates the proofs sheet.
- The live script spells `data-load` as `"data-" + "load"`. Harmless.
- The Blast Freezer's loads take the lines too, as the brief assumed; his word if the freezer should not.

## Gates on the tree as received (the Scribe's sandbox, the worktree's `app/`)

- `npm run typecheck` with the generated types file deleted first: exit 0.
- `npx vitest run`: 67 files, 964 tests passed; the same under `TZ=America/New_York`.
- `node --check scripts/smoke.mjs` and `node --check scripts/icon-proofs.mjs`: ok.
- `npm run proofs:icons` twice: `85b22429de13e975`, 105,377 bytes, the bytes received.
- From-zero smoke (`SMOKE_PORT=9207`): `About to apply 80 migration(s)`, `SMOKE PASS`, no ` 500 ` line; the dev server ended by the timeout after the pass.
- Dash audit: 0 (em and en), and no CR byte, on the nineteen files of the seal, `wrangler.toml`, `tsconfig.json` and `package.json`. Secret grep (six patterns): no value anywhere. No personnel data in the diff; the fixture's person is the smoke's.

## Gates on the fixed tree (the Scribe's sandbox copy)

```
rm worker-configuration.d.ts; npm run typecheck      exit 0
npx vitest run                        67 files, 965 tests passed
TZ=America/New_York npx vitest run    67 files, 965 tests passed
node --check scripts/smoke.mjs        ok
node --check scripts/icon-proofs.mjs  ok
npm run proofs:icons (twice)          85b22429de13e975, 105377 bytes, unchanged
rm -rf .smoke-persist && CI=1 SMOKE_PORT=9209 WRANGLER_SEND_METRICS=false npm run smoke
                                      About to apply 80 migration(s); SMOKE PASS; " 500 " lines: 0
migration 0080 rehearsed              the table, both indexes, the partial unique proved; a second run refuses
the schedule math by hand             10 of 10 open loads match the code
the fix's three files (the rest of the seal as received):
app/src/labsample.ts                 36338  e32577a332a24a5f
app/src/theme.ts                    165590  2a844d758add9512
app/test/labsample.test.ts           11015  f9b7eebcb3f42cfb
the app tree as received: 988c1c0a87a4fdbd; fixed: 3f793c8248f5200b
dash audit: 0; CR audit: 0; secret grep: no values; personnel data: none
```

## The merge (his hands, after the fix lands in the worktree at his word)

The Scribe writes the three files into the worktree only on his word, verifying the held hashes on disk first, and then a short fix report with the final seal. The four acts follow, the snapshot first and the block stopping on its failure:

```powershell
cd "C:\Users\DennisWallace\Documents\Claude\Projects\gripfactory Practical\app"
node scripts/db-snapshot.mjs pre_maintenance_node
if ($LASTEXITCODE -ne 0) { throw "snapshot failed, stop here" }
cd "C:\Users\DennisWallace\Documents\Claude\Projects\gripfactory Practical\branches\GFLiteOpsDashboard"
git add -A
git commit -m "V11: the maintenance node" -m "The Maintenance button before Reports, the landing with the drying pane and its three buttons, the two interval lists in Admin, the aW and MC countdowns and the siren on every load drawn from silo_loads, Lab Sample's three panes, the Trouble Tickets stub, migration 0080 with lab_sample_requests, the smoke pin at 80; the Scribe's fix on the line's words, the siren's red, farm time on Lab Sample, the instrument's day and the return's row.`n`nCo-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`nClaude-Session: https://claude.ai/code/session_01VDz7UdaTSkjq69GvDfDWd7"
cd "C:\Users\DennisWallace\Documents\Claude\Projects\gripfactory Practical"
git merge --no-ff GFLiteOpsDashboard -m "Merge V11: the maintenance node"
git push
```

The push runs the workflow: typecheck, the tests, `apply migrations` (0080, one to apply), the deploy. His paste back: the snapshot's last line, the push's output, the run's result and the Version ID from the deploy step's log; the Scribe reads main after the merge and folds LIVE.
