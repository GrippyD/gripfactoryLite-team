# 2026-10-01 The Rad Available law, the gate's fix on V9

BRIEF V9.1, THE RAD AVAILABLE LAW (canon 0.30.329), the gate's fix on V9 (BRIEF V9, canon 0.30.327; the gate `SESSION_REPORTS/2026-10-01_gate_the_rad_schedule_and_rad_operation.md`, canon 0.30.328), built in the worktree `branches/GFLiteOpsDashboard` under THE DISPATCH RULE (canon 0.30.155), on the worktree exactly as it stood: V9 as received, not yet committed, the app tree `188c24fb60d59ea9`. Seven find-once and replace edits on four files, applied as written, nothing else in the files touched. The app tree now hashes `516bc3f2b239e24a`, the gated tree. No migration; the smoke pin stays 85. Not deployed. Nothing committed. No git was run.

## The check first

The brief on disk is the one canon recorded: 12,580 bytes, `3c7062f1edf46c60`, LF, no CR. The four files as received hashed as the brief said before anything moved: `src/db.ts` 205,901 `6d8ccc429e6787bb`; `src/rad.ts` 26,157 `b2c9426486df1ff1`; `test/rad.test.ts` 11,476 `828a18bcc3a9452d`; `scripts/smoke.mjs` 672,274 `ead0d7ba67a1d146`; no CR byte and no BOM in any of them. Each of the seven find texts occurred exactly once in its file. The repair files under `app/scripts/repairs/` (twelve, the two of 2026-09-30 the brief names among them) were not touched.

One note for the Scribe's re-hash on this disk: Git Bash's `sha256sum` prints `hash *file` (the binary marker), so the brief's tree pipeline read `698da69153ecae47` as received until the marker was read as the Linux two-space form (`sed 's/ \*/  /'` before the final `sha256sum`); with that, the tree as received read `188c24fb60d59ea9` and the tree after the edits reads `516bc3f2b239e24a`, both the brief's numbers. The per-file hashes are the same either way.

## What changed

The edits were parsed out of the brief's own fences and applied by a script that checked the received hash of each file, found each text once, replaced it once, and wrote the file only after all four results matched the brief's hashes in memory (latin1 round trip, so every other byte is as it was; LF, no CR, no BOM, the last byte unchanged).

- `src/db.ts` (edit 1): `listRadCompletedStates` before `RadRunRecord`: per tag, the lab state its newest completed run recorded (`rad_run_packages.lab_test_status` joined to `rad_runs` in status `complete`, ordered oldest first so the newest completion wins in the map); a reopened run is not complete, so its tags leave the map.
- `src/rad.ts` (edits 2 and 3): the import of `listRadCompletedStates`; `listRadAvailable` is the catalog minus the tags on a scheduled or running run minus the tags whose newest completed run recorded the lab state the mirror still shows, so a radded package stays off Available until METRC moves its state and lists again when it does (a TestFailed after the test, a RetestFailed after the retest).
- `test/rad.test.ts` (edit 4): one new case before the run-of-ten case: off Available after Complete; `>>` refused with "That package is not available."; on again when the mirror reads TestFailed; off when it reads NotSubmitted again; the same through Reopen behind the PIN and a second Complete.
- `scripts/smoke.mjs` (edits 5, 6 and 7): after the two solo runs complete, the two packages are off Available; a second mirror drop with those two rows as TestFailed lists them again and moves the gate's Ready count down by two (`readyMoved`); the later Ready assertions (`ready1`, `ready2`) rebase on `readyMoved`.

Nothing else moves. The gate report's observations (a `created` or `cryo_queue` row refusing Complete; a second pass before METRC moves; the grow type order; the doubled number on a package line) wait on his word and are not in this slice.

## Gates

Run in the worktree's `app/`.

- `npm run typecheck`: exit 0 (it regenerates the git-ignored `worker-configuration.d.ts` first).
- `npx vitest run`: 72 files, 1004 tests passed under `TZ=UTC`, and the same under `TZ=America/New_York`.
- `node --check scripts/smoke.mjs`: exit 0.
- From-zero smoke (`SMOKE_PORT=9255`, `WRANGLER_SEND_METRICS=false`, `TZ=UTC`): About to apply 85 migration(s), SMOKE PASS, no ` 500 ` line, exit 0. After the two solo runs complete, the two packages are off Available; the second mirror drop with them as TestFailed lists them again and Ready moves down by two; the stranger's and Reopen's Ready assertions hold on `readyMoved`. Run twice from zero on this disk, 16589 and 16589 lines of log, the two logs the same once request timings and the generated run ids are set aside; the apply line, SMOKE PASS and no ` 500 ` line both times (each run carries 1 line with ` 503 `, the smoke's own asserted no-key step on `/api/send`); the second run's stderr empty and its exit code 0, the first started detached with its exit code not captured.
- Dash audit: 0 on the four files (U+2014 and U+2013). No CR byte in them. No BOM.
- `METRC_INTEGRATOR_KEY = "`, `METRC_USER_KEY = "`, `MS_CLIENT_SECRET = "`, `SENSORPUSH_PASSWORD = "`, `CLOUDFLARE_API_TOKEN=`, and `CLOUDFLARE_API_TOKEN: "` do not appear in the four files. No personnel data: the edits carry only tags, item names and lab states of the test fixtures.
- Changed against the tree as received, not in the four: none (`find -newer` the brief lists exactly the four files under `src`, `test`, `scripts` and `migrations`, plus nothing among `wrangler.toml`, `tsconfig.json`, `package.json`).

## Deploy

Not deployed from this session. Nothing committed. Nothing pushed. No git was run. The fix rides with V9's commit; the merge block stands in the gate report for his hands.

## Sealed final check

```
the four files as received, checked first (the brief's hashes):
app/src/db.ts                            205901  6d8ccc429e6787bb
app/src/rad.ts                            26157  b2c9426486df1ff1
app/test/rad.test.ts                      11476  828a18bcc3a9452d
app/scripts/smoke.mjs                    672274  ead0d7ba67a1d146
the app tree as received                 188c24fb60d59ea9 (the brief's)
the brief                                 12580  3c7062f1edf46c60
the seven edits applied once each, by script, nothing else touched

npm run typecheck                     exit 0
TZ=UTC npx vitest run                 72 files, 1004 tests passed
TZ=America/New_York npx vitest run    72 files, 1004 tests passed
node --check scripts/smoke.mjs        exit 0
SMOKE_PORT=9255 WRANGLER_SEND_METRICS=false TZ=UTC node scripts/smoke.mjs
                                      About to apply 85 migration(s); SMOKE PASS; " 500 " lines: 0; exit 0
dash audit: 0; CR audit: 0; BOM: none; secret grep: no values; personnel data: none
changed against the tree as received, not in the four: none
the app tree after the edits             516bc3f2b239e24a (the brief's gated tree)
```

```
app/src/db.ts                            206843  771231ada4912288
TAIL }
app/src/rad.ts                            26492  3027824f158d6c1f
TAIL }
app/test/rad.test.ts                      13123  21a080e88e7e0f0a
TAIL });
app/scripts/smoke.mjs                    674156  233af51816708362
TAIL });
```
