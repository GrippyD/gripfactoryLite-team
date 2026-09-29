# 2026-09-29 The maintenance node

V11 of THE BRANCH PLAN (canon 0.30.293), built in the worktree `branches/GFLiteOpsDashboard` under THE DISPATCH RULE (canon 0.30.155). Migration 0080. Not deployed. Nothing committed. No git was run.

## What changed

The app bar gains Maintenance, to the left of Reports, on every page and every view. No PIN. `/maintenance` is the landing: the drying pane as the console draws it (the silo strip, the cure tiles, the flags, the clock and the live script), then three buttons: Load Silo (`/station/load_silo`), Lab Sample (`/maintenance/lab_sample`), and Trouble Tickets (`/maintenance/trouble_tickets`). Trouble Tickets is the console stub sentence and nothing else. The Home operations map is unchanged.

Admin, Lookups, Harvest Operations gains Internal Silo Testing Interval (`/admin/lookups/silo_check_intervals`). Two lists side by side, `lookup_values` categories `silo_check_interval_aw` and `silo_check_interval_mc`. The top of each list is Add a Time, one field, Hours from last check, and a + button. The value is a whole number of hours, zero allowed. On read, the first row says "from the start of the silo" and every later row "from the last check", labeled Check 1, Check 2, and so on. Remove soft-deletes with the reason "removed" and does not rewrite the other rows. An empty list means that check is off and the tiles draw no line for it. Both lists start empty.

`nextCheckDue` in `src/labsample.ts` is the schedule. With `n` requests already stamped and hours `h[0..k]`, the next check is number `n + 1`. Its due instant is `loaded_at` plus `h[0]` when `n` is 0, else the last stamp plus `h[min(n, k)]`. Past the end of the list, the last interval repeats. A paused drying clock is not an input.

On every tile drawn from `silo_loads` (the silos, the Arlington Dry Room, the freezers), each open load gains "Next aW check in" and "Next MC check in" under its clock when that kind has a list. The countdown is `0d 04:12:33`, ticked once a second. When the space holds several loads, the tile also shows the earliest due of each kind and names that lot. When the due instant is now or past, the line is the siren: the fifteenth line-art icon, a beacon on a base with three rays, the lamp marked `data-icon-siren-lamp`, in the waste red and on the waste throb, with "aW check due" or "MC check due" and the check number. The countdown script swaps the line to the siren at zero without a reload. A request moves the due instant forward, so the countdown returns. `/silos/live.json` carries `checks` on every space (`kind`, `lot`, `checkNumber`, `dueAt`, `loadId`) and the live paint writes the new due every 30 seconds. The cure panes do not get the lines.

Lab Sample is three panes. Left, Drying: one row per open load and kind that has a list, "Silo 3 / Lot 26070", the strain, the kind, the next check, the countdown or the siren, and `>>`. The row leaves the left pane while that check is scheduled or requested. Middle, Schedule Silo/Lot Check #: a scheduled row has Sample requested (stamps `requested_at` and `requested_by`, status `requested`) and `<<` (soft delete, reason "unscheduled"). A requested row reads "requested at" the time and `>>`, with an optional result (aW from 0 to 1, MC a percent from 0 to 100), which fulfills it. A lab hand's result writes `internal_test_results` (`source` `lab_sample`, the analyte `water activity` or `moisture content`, the value, the unit, the HBN, `tested_at` now). Right, Completed: fulfilled rows newest first, the value and the time, and `<<` to return one to requested. An instrument row for the lot's HBN and the kind's analyte, with `tested_at` after `requested_at`, fulfills the request on the next load of the page or the tiles. `moisture content`, `mc`, `moisture`, and `mc%` are the moisture aliases. Every move is logged on `lab_sample_requests`, field `status`.

`migrations/0080_maintenance_node.sql` creates `lab_sample_requests` with the index on `(silo_load_id, kind, requested_at)` and the partial unique index on `(silo_load_id, kind, check_number)` where `deleted_at` is null. The proofs sheet is `SESSION_REPORTS/2026-09-29_icon_proofs.html`, written twice to the same bytes. `wrangler.toml` is untouched. Nothing under `public/`.

## Assumptions for his word

- Drying panes this slice are the tiles drawn from `silo_loads`: the silos, the Arlington Dry Room, the freezers. The cure panes take the lines in V7.
- The check clock runs from the load's `loaded_at` and from each request's stamp. A paused drying clock does not pause it.
- Past the end of an interval list, the last interval repeats until the load ends.
- A request clears the siren. A fulfillment is the lab's, by hand on the right or by an instrument file landing after the request. A result already tied to a request does not fulfill that request again after it is returned.
- The siren is the fifteenth icon, on the proofs sheet, for his eye.
- The two interval lists start empty. Nothing counts down until he adds hours.

## Gates

Run in the worktree's `app/`.

- `npm run typecheck`: exit 0.
- `npx vitest run`: 67 files, 964 tests passed under `TZ=UTC`, and the same under `TZ=America/New_York`.
- `node --check scripts/smoke.mjs`: exit 0. `node --check scripts/icon-proofs.mjs`: exit 0.
- `npm run proofs:icons` twice: the same bytes (`85b22429de13e975`, 105377 bytes).
- From-zero smoke (`SMOKE_PORT=9206`, `WRANGLER_SEND_METRICS=false`): `About to apply 80 migration(s)`, `SMOKE PASS`, ` 500 ` lines: 0, exit 0.
- Dash audit: 0 on every file below (U+2014 and U+2013). No CR byte in those files.
- `METRC_INTEGRATOR_KEY = "`, `METRC_USER_KEY = "`, `MS_CLIENT_SECRET = "`, `SENSORPUSH_PASSWORD = "`, `CLOUDFLARE_API_TOKEN=`, and `CLOUDFLARE_API_TOKEN: "` do not appear in those files.

## Deploy

Not deployed from this session. Nothing committed. No git was run.

## Sealed final check

```
npm run typecheck                     exit 0
npx vitest run (TZ=UTC)               67 files, 964 tests passed
TZ=America/New_York npx vitest run    67 files, 964 tests passed
node --check scripts/smoke.mjs        exit 0
node --check scripts/icon-proofs.mjs  exit 0
npm run proofs:icons (twice)          same bytes 85b22429de13e975, 105377 bytes
SMOKE_PORT=9206 WRANGLER_SEND_METRICS=false node scripts/smoke.mjs
                                      About to apply 80 migration(s); SMOKE PASS; " 500 " lines: 0; exit 0
```

```
app/migrations/0080_maintenance_node.sql       1033  ad01ed4c1325c4dd
TAIL CREATE UNIQUE INDEX lab_sample_requests_check ON lab_sample_requests (silo_load_id, kind, check_number) WHERE deleted_at IS NULL;
app/src/labsample.ts                         34241  384bee82534888f8
TAIL }
app/src/consoleicons.ts                      10126  de6d9c91887ead8d
TAIL }
app/src/compliance.ts                        26607  047ec7ba27189cec
TAIL }
app/src/drying.ts                            35315  3ed280aa5fa96972
TAIL }
app/src/silo.ts                              42714  f2d9eddc2db92f28
TAIL }
app/src/html.ts                             192628  65c200c1ca092522
TAIL }
app/src/lookups.ts                            9389  e2f4062bc081548d
TAIL };
app/src/theme.ts                            165571  d1d1c0581a846f50
TAIL }
app/src/i18n.ts                             184209  4b229fafc4284065
TAIL }
app/src/index.ts                            147398  201056b256d655cf
TAIL export default worker;
app/scripts/smoke.mjs                       622648  8af0c80d4e46efda
TAIL });
app/scripts/icon-proofs.mjs                   5297  18a0547aaa6c1110
TAIL console.log(moduleBytes.length, moduleSha);
app/test/labsample.test.ts                    8717  60548efb3b45fc69
TAIL });
app/test/console.test.ts                     64684  18ff25fef6edd15a
TAIL });
app/test/consoleicons.test.ts                 5613  620430be8e693b76
TAIL });
app/test/silo.test.ts                        36364  237dcf62a98d1577
TAIL });
SESSION_REPORTS/2026-09-29_icon_proofs.html 105377  85b22429de13e975
TAIL </html>
```
