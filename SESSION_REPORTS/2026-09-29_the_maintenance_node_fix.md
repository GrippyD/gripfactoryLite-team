# 2026-09-29 The maintenance node, the Scribe's fix (canon 0.30.297): PASSED, READY TO MERGE

Scribe direct, on his word ("you do it"), on V11 as received (`SESSION_REPORTS/2026-09-29_the_maintenance_node.md`, the tree `988c1c0a87a4fdbd`, HELD in `SESSION_REPORTS/2026-09-29_gate_the_maintenance_node.md`). Three files written into the worktree `branches/GFLiteOpsDashboard` after the three held hashes were read on the disk once more; the other fourteen files of the seal and the proofs sheet untouched. Nothing committed, nothing pushed, nothing deployed, no git run.

## The fix

- `src/labsample.ts`: the line's words in order (the countdown, then "Check n" through the dictionary's own key, then the lot when a space holds several); `etWallClock` on "requested at" and the completed time; `testedDayOf` and `testedAfterRequest` for the instrument's fulfillment (the farm day of a zoned instant, the date as the file wrote it when it carries no zone, null for "unknown"; the request's farm day or later); the return soft-deletes the hand's own `internal_test_results` row with the reason "returned", an instrument's row staying linked; the interval rows say "24 h" and the add form reads "Add a Time · Hours from last check"; a no-op ternary gone.
- `src/theme.ts`: `.hc-siren` in each sheet's alarm red, `var(--danger, var(--alert, #8b2e2e))`, flowing as text with the icon at 1.9 rem beside the words; the throb unchanged.
- `test/labsample.test.ts`: the day reader and the after-the-request rule on seven shapes, the return's soft delete and the re-fulfillment, an undated instrument row that must not answer, the farm-time words on the page.

The fix was written and gated in the Scribe's sandbox copy first, then written to the worktree; the tree on his disk after the write hashes `3f793c8248f5200b`, the gated tree, and the three files match byte for byte.

## Sealed final check (the Scribe's sandbox copy of the tree now on his disk)

```
rm worker-configuration.d.ts; npm run typecheck      exit 0
npx vitest run                        67 files, 965 tests passed
TZ=America/New_York npx vitest run    67 files, 965 tests passed
node --check scripts/smoke.mjs        ok
node --check scripts/icon-proofs.mjs  ok
npm run proofs:icons (twice)          85b22429de13e975, 105377 bytes, the bytes received
rm -rf .smoke-persist && CI=1 SMOKE_PORT=9209 WRANGLER_SEND_METRICS=false npm run smoke
                                      About to apply 80 migration(s); SMOKE PASS; " 500 " lines: 0
migration 0080 rehearsed              on the 9/28 floor at 0079: the table, both indexes, the partial unique proved
the schedule math by hand             10 of 10 open loads match nextCheckDue
the three files written, verified on his disk:
app/src/labsample.ts                 36338  e32577a332a24a5f
app/src/theme.ts                    165590  2a844d758add9512
app/test/labsample.test.ts           11015  f9b7eebcb3f42cfb
the rest of the seal as received (fourteen files and the proofs sheet), at the received hashes
the app tree on his disk: 3f793c8248f5200b (received 988c1c0a87a4fdbd)
dash audit: 0; CR audit: 0; secret grep: no values; personnel data: none
```

## The merge (his hands, four acts in order, the snapshot first and the block stopping on its failure)

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

If the snapshot answers 7403 on its first query (the first D1 call after idle, twice seen on 9/28), the block stops before the commit; run the snapshot line alone once more and then the three acts. The push runs the workflow: typecheck, the tests, `apply migrations` (0080, one to apply), the deploy. His paste back: the snapshot's last line, the push's output, the run's result and the Version ID from the deploy step's log; the Scribe reads main after the merge and folds LIVE. The pre snapshot's `app_config` will show the two gate keys of 0079 for the first time; the post snapshot after this deploy will show `lab_sample_requests: 0 rows`.
