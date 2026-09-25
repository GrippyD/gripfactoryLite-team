# 2026-09-25 The gate on the drying schedule (canon 0.30.235)

Scribe session. The gate on his Code session's `SESSION_REPORTS/2026-09-25_the_drying_schedule.md` (brief M part two, THE DRYING SCHEDULE, canon 0.30.226; no migration, the head stays 0075). The report says "Not deployed. Nothing committed."; nothing was deployed before this gate. No Scribe change to `app/`. His hand-back, verbatim in part: "Part two is built, nothing is deployed or committed, and there is no migration (the head stays 0075). ... Only 12 files changed: 9 in `src/`, 2 tests, and the smoke script."

## What was gated

1. The tree was hashed on the device after the build went quiet (the report at 19:08 UTC, the hash at 19:20) and compared with the Scribe's sandbox, which held the tree of canon 0.30.234 (f267390bce5eedd1, 211 files) byte for byte. Twelve files differed, exactly the twelve of the report's seal, one of them new (`test/dryingschedule.test.ts`); across the whole repo the only other files newer than the last gate are the canon trio the Scribe folded and the report itself, so the build touched nothing outside `app/`. After the copy the two trees hash identical (a175f5e845d8e041, 212 files). The migration head is 0075 (75 files).
2. The twelve were staged, verified against the seal (size and sha256, all twelve), copied into the sandbox and verified again there. No dash and no CR byte in any of them.
3. Read against the brief's four laws of part two. THE THREE SURFACES: `SCHEDULE_STAGES` gains `silos`, `dry_rooms` and `freezers` served at `/production/scheduling/<stage>`, each mapped to one space type; `parseScheduleStage` still takes the three lines alone and a new `parseDryingStage` the three surfaces, so the schedule, unschedule, complete and unfinish routes answer 404 on a drying stage and no `production_schedules` row is written for one; no new table (the surfaces read `listBarnWetLots`, `loadSiloVisuals` and a new `listDryingComplete`); the silo strip above each surface; three tiles on the Drying Operations landing. Available lists every lot Load Silo lists, grouped by HBN, with its label, wet grams and planned space (`planned here` when it is of this type); `>>` opens Load Silo with `kind` (the select limited to the type, the planned space preselected when free, the Load button disabled when the type has no space) and `next` (the post returns to the surface). Working lists the open loads under each space with the tile clock, Start and Pause returning to the surface, and `>` to Unload Dry Space; a space whose open loads hold two or more lots carries Unload together, a freezer never. Complete lists the type's lots unloaded in the last seven farm days with dry grams, yield and the day. THE JOINT UNLOAD: `?together=<space>` opens the form (the lots in share order, the total dry, the operator, the day with the PIN for another day, the gate's choice once); the POST refuses in words, writing no dry weight and unloading no lot, on fewer than two lots, a freezer, a space of another type, a changed group (409), a lot with dry weights, not drying or moved after loading, a total not above zero, a missing choice, no wet grams or a negative share, a backdated day without the PIN, or a repeated post (409); otherwise `jointUnloadShares` gives each lot the total times its wet over the group's wet, whole grams half up, the last-loaded lot taking the remainder, and one batch writes each lot's share row, recomputes its total and runs the finish statements. THE REFACTOR: `finishUnload` split into `readUnloadLot`, `resolveUnloadFinish` and `unloadFinishStmts` with the single-lot path's order of reads, refusals, gate, writes, log reasons and redirects read line for line against the prior file: the lot read, the freezer branch, the dry-weight count, `ensureUnloadSession`, the parent, the weigh mode and the on-site answer, the plan, the gate with `back` and the saved answers, the batch under `finish unload`, the redirect to `/admin/uploads?ok=adjust_queued` or `ok=unloaded`; the freezer branch untouched. NOTHING ELSE MOVES: the three lines, THE UNFINISH, the prepack headings, the tiles' fill laws, the Harvest CSV and the unload files, the mirror, the sheet sync, the repair scripts, the migrations, `wrangler.toml`, `package.json` and `src/vendor/`.
4. THE JOINT UNLOAD, READ IN THE DATABASE. The smoke's local D1 after the walk: two lots in the Arlington Dry Room (26014, wet 1,500 g, loaded first; 26905, wet 900 g, loaded second) unloaded together with 602 g: 26014's share 376 g (602 x 1500 / 2400 = 376.25, half up) and 26905's 226 g (the remainder; pro rata 225.75), summing to 602; one `dry_weights` row each, keyed by its load's id; both lots drying to unloaded, both loads ended, both sessions finished (operator, bucked, reconcile choice `nothing`); both packages at ARL BARN with their shares; twenty log rows under `joint unload: Arlington Dry Room (26014, 26905)` (the share rows' fields, the two reconcile choices, the two status rows) and the package qty and location rows under `inv_unload_adjust`, as the adjustment file needs; the repeated post answered 409.

## Gates on the tree as received (the Scribe's sandbox)

- `npx tsc --noEmit`: exit 0.
- `npx vitest run`: 55 files, 903 tests passed; the same under `TZ=America/New_York`.
- `node --check scripts/smoke.mjs`: ok.
- From-zero smoke (`SMOKE_PORT=9167`): `About to apply 75 migration(s)`, `SMOKE PASS`, no 500; exit 0 once the dev server was ended by pid.
- Dash audit: 0 on the twelve files and the build report.
- Secret grep (`METRC_INTEGRATOR_KEY = "`, `METRC_USER_KEY = "`, `MS_CLIENT_SECRET = "`, `cfas[t]_`): no matches under `src`, `test`, `scripts`, `migrations` or `wrangler.toml`.

## His word: the report's ten assumptions and two the Scribe adds

The ten stand as the report states them. The first is the one to look at on the floor: Available shows every waiting lot on all three surfaces, marked `planned here` where its planned space is of that type, rather than hiding a lot planned for another kind (canon 0.30.226 reads "any lot to any space"; the brief's test line could be read as a filter). The others: the seven-farm-day Complete window keyed on the unload; the remainder on the last-loaded lot; the gate's choice once for every lot, `back` not offered; no joint unload on a freezer; the package rows keeping `inv_unload_adjust`; a lot with dry weights refused; a rolled-back joint unload possibly leaving an empty open session or the form's operator and day on a lot's open session; yield dry over wet to one decimal; the middle pane headed Working and the tiles on the Drying Operations landing alone. Two more, read in the code and the database:

- A joint share row takes its load's id as its own id (`dry_weights.id` equal to `silo_loads.id`), which is how a repeated post collides and rolls back; the two tables never share a key otherwise, so nothing reads the pair as a join, but a person reading the ids will see the same uuid in both.
- The joint unload writes a `dry_weights` row per lot with no tote-level history: the lot's dry total is one share, where Unload Dry Space keeps each scale read. That is the ruling (one typed total, pro rata); the dry totes of a joint unload are not recoverable from the app.

## Deploy (his hands; worker-only, no migration rides)

```powershell
cd "C:\Users\DennisWallace\Documents\Claude\Projects\gripfactory Practical\app"
npm run deploy:grip
```

THE PROBE, read only: the Drying Operations landing with its three new tiles; the Silos surface's Working pane showing the five PNS lots of 9/24 under their silos with the clocks from the repair (26052 in Silo 1, 26053 in Silo 2, 26051 in Silo 3, 26050 in Silo 4, 26049 in Silo 5), or on Complete for any the floor has unloaded since; the Dry Rooms surface's Working pane showing the Arlington Dry Room's two open loads of 9/19 (26027, 26029) with Unload together on the room; Available listing the waiting lots with their planned spaces. The first joint unload is a floor act for the day a room or silo with two or more lots actually comes out.

## Sealed final check

```
npx tsc --noEmit                      exit 0
npx vitest run                        55 files, 903 tests passed
TZ=America/New_York npx vitest run    55 files, 903 tests passed
node --check scripts/smoke.mjs        ok
rm -rf .smoke-persist && CI=1 SMOKE_PORT=9167 WRANGLER_SEND_METRICS=false npm run smoke
                                      About to apply 75 migration(s); SMOKE PASS; " 500 " lines: 0; exit 0
the build session's seal (12 files) verified byte for byte on the device and in the sandbox:
src/config.ts                                  68858  198d61b3b30e9834
src/ledger.ts                                   9841  aa3b477d9fa26ce1
src/db.ts                                     170687  241ec7b2ad39137e
src/drying.ts                                  26877  bc8f8f366507ce9a
src/scheduling.ts                              38157  1bde3a36cf853951
src/actions.ts                                334933  03c1b0ec380eda8d
src/index.ts                                  138889  92f81f70fb5b7eb5
src/pipeline.ts                                50734  beb966a2169b1a4b
src/i18n.ts                                   173215  b16ec18d2a0527e5
test/dryingschedule.test.ts                    42637  dc81c6590e41f26f
test/scheduling.test.ts                        24374  6c3a85648b146504
scripts/smoke.mjs                             603049  ce6875f241243d05
tree hash after the copy, device and sandbox: a175f5e845d8e041 (212 files)
the build report: SESSION_REPORTS/2026-09-25_the_drying_schedule.md  13162  232b993aa92c1fb8
dash audit: 0 on every file above
secret grep: no matches
```
