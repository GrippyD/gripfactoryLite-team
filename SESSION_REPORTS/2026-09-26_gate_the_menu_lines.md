# 2026-09-26 The gate on the menu lines (canon 0.30.250): HELD for one fix

Scribe session. The gate on his Code session's `SESSION_REPORTS/2026-09-26_the_menu_lines.md` (brief P part two, THE MENU LINES, canon 0.30.241; no migration, the head stays 0075). The report says "Not deployed. Nothing committed."; nothing was deployed before this gate. No Scribe change to `app/`. His hand-back, verbatim in part: "Part two is in ... Nothing was deployed, committed, or pushed. No migration; the head stays 0075."

VERDICT: HELD. Every gate passes and the Harvest and Drying lines read as briefed, but the Logistics line is not one line per truck: it lines every finished load that is not yet in a dry space, so an on-site lot waiting for its silo, and an old row that was never loaded, each read as a truck in transit. On the 2026-09-25 snapshot that is seven standing lines, none of them a truck. The fix goes back to his Code session (the paste at the end); the gate re-runs on the fix.

## What was gated

1. The tree came over as one tarball of `app/` (no `node_modules`, `.wrangler`, persist folders or `db_backups`) with `canon/`, `BRIEFS/`, `SESSION_REPORTS/` and `CLAUDE.md`. It hashed identical on both sides: 218 files by the listing of `src`, `test`, `scripts` and `migrations` with `wrangler.toml`, `tsconfig.json` and `package.json`, listing sha256 e35c0044bd4d2738. Against the live tree (a688b16f08bcdaee, worker a3ea5da6) exactly the report's eight files changed, one of them new (`test/menulines.test.ts`); the package files did not move.
2. The eight sealed files match the seal byte for byte (size, sha256 and tail). No dash and no CR byte in any file under `src`, `test` or `scripts/smoke.mjs`, nor in the build report.
3. Read against part two's law. THE LINES: `menuLineMarkup` draws the name, the dots and the status inside the button's anchor, at half the label's size in every skin (Lite 0.88 to 0.44rem, Continuum 0.95 to 0.475rem, Cerberus 0.72 to 0.36rem); Production, Business and Marketplace carry none. HARVEST: `harvestMenuLines` numbers the lots whose first load began on this farm day (`farmDayBounds` at `farm_day_start_hour`), keeps a lot's number when an earlier lot leaves, reads `in progress` while a part is on the scale or waiting, `ready to be moved` once passed with nothing on the scale, and drops a loaded lot. DRYING: `dryingMenuLines` lines each silo and dry room with an open load by its longest clock, paused when that load is paused, freezers off; the ticking script skips a paused clock, so an empty `data-paused-at` is harmless. The Spanish is in.
4. A render on a copy of the tree (a throwaway test, deleted with the copy's use): five seeded lots through `app.request("/")`, the map drawn by Playwright at 1280 and 390 pixels. It shows the lines as built and the defect below: `RESEARCH/scribe/pending/menu_lines_map.png` and `RESEARCH/scribe/pending/menu_lines_phone.png`.

## The defect

- D1, THE LOGISTICS LINE IS NOT PER TRUCK (medium): `truckMenuLines` takes every entry that is past weighing and has never had a silo load (`listMenuEntries`' second arm). Nothing asks whether the load rode a truck. A load finished to a silo on site goes `weighing` to `drying` (`lot_finished_drying`), never `in_transit`, and it reads `Truck ... in-transit` from its Finish load until Load Silo. An old row that reached `unloaded` or `trimmed` without a silo load reads as a truck in transit forever. The 2026-09-25 snapshot holds seven such loads, none with a Truck #, none in transit: one trimmed and two unloaded in Silo 1 and Silo 3, one unloaded and one drying in Hang in Place, one drying in each of Silo 1 and Silo 2. On those rows the Logistics button would carry seven `Truck` lines with clocks from one to five days, the four unloaded or trimmed ones for good. The smoke's own check passes on it: the two-part lot it reads as `>Truck<` and `in-transit` was weighed to Silo 1 with no Truck #, and its status log reads `weighing` (create) then `drying` (finish lot). The render reads `Truck in-transit 0d 03:00:11` for an on-site lot and `Truck in-transit 2d 22:00:11` for an old unloaded row, beside the real `Truck 4`.
- THE LAW IT MISSES: part two's law 3, "one line per truck from its Finish load until every part it carried is loaded into a dry space". The status that says exactly that is already in the code: `in_transit` is set at the Finish load to the truck sentinel (`lot_finished_in_transit`) and at an interco move out, it stands through the receive at the destination barn, and Load Silo turns it to `drying`. A part belongs on the Logistics line while its status is `in_transit`, and only then.

## For the same fix sitting

- D2, THE TRUCK CLOCK STARTS AT `updated_at` (low): the report's assumption says the clock starts at the Finish load, but `truckMenuLines` reads the parts' `updated_at`, which any later edit of the entry moves, so an edit to a part on the road restarts its truck's clock. The instant of the part's latest change-log row setting it `in_transit` is the Finish load (or the move out); `updated_at` only when there is none.
- F3, THE LINES CLIP ON A PHONE (low): at 390 pixels the map keeps its six buttons, the dots shrink to their minimum and the status runs past the button's edge and is cut (`Truck..in-transit 0d 03:00:3`, `Silo 2..drying 0d 20`, in the phone render). The status needs to stay whole at phone width: let the line wrap the status under the name, or drop the clock's seconds under a width, whichever reads better in all three skins.

## His word: the report's nine assumptions

They stand as the report states them, D2 making the sixth true: the three unnamed buttons blank; a lot begun before this farm day's start off the Harvest line; `Lot n` by the first load of the farm day, a loaded lot keeping its number; `in progress` while anything is on the scale, `ready to be moved` once passed; a truck load with no Truck # its own line named `Truck` (with D1, only a load that rode a truck); the truck clock from the earliest Finish load of the parts still out; freezers off and the Arlington Dry Room on; the longer clock of two loads, paused with it; the dots clipped to the width. One more for his word: parts of one Truck # still in transit from different trips share one line under the oldest clock.

## Gates on the tree as received (the Scribe's sandbox)

- `npx tsc --noEmit`: exit 0.
- `npx vitest run`: 57 files, 911 tests passed; the same under `TZ=America/New_York`.
- `node --check scripts/smoke.mjs`: ok.
- From-zero smoke (`SMOKE_PORT=9171`): `About to apply 75 migration(s)`, `SMOKE PASS`, no ` 500 ` line; the dev server lingered after the pass and was ended by the timeout (exit 124 after `SMOKE PASS`).
- The smoke's D1 after the walk: the two-part lot's parts, both `drying`, no Truck #, status log `weighing` then `drying`; no load in transit at the end; three finished loads never in a silo load.
- Dash audit: 0, and no CR byte, on the 121 files under `src`, `test` and `scripts/smoke.mjs`, and on the build report.
- Secret grep (`METRC_INTEGRATOR_KEY = "`, `METRC_USER_KEY = "`, `MS_CLIENT_SECRET = "`, `SENSORPUSH_PASSWORD = "`, `cfas[t]_`): no matches under `src`, `test`, `scripts`, `migrations` or `wrangler.toml`.

## The fix, for his Code session

```
Read canon/_NOW.md, then SESSION_REPORTS/2026-09-26_gate_the_menu_lines.md, and fix what it names in app/ under THE DISPATCH RULE (canon 0.30.155): D1 (a part rides the Logistics line only while its status is in_transit, so an on-site lot waiting for its silo and an old row never loaded are off it), D2 (a truck's clock starts at its parts' latest change-log row setting them in_transit, updated_at only when there is none) and F3 (every line keeps its status whole at 390 pixels in Lite, Continuum and Cerberus). Tests beside them: an on-site finished lot and an unloaded row with no silo load are off the Logistics line; a truck lot is on it from its Finish load until its load; an edit to a part on the road leaves its clock where it was. In scripts/smoke.mjs, read the Logistics line while a truck lot is on the road (its Truck # and in-transit), and see the on-site two-part lot off it. No migration. Write SESSION_REPORTS/2026-09-26_the_menu_lines_fix.md with the sealed final check, every changed file in the seal. Commit nothing, push nothing, deploy nothing.
```

## Sealed final check

```
npx tsc --noEmit                      exit 0
npx vitest run                        57 files, 911 tests passed
TZ=America/New_York npx vitest run    57 files, 911 tests passed
node --check scripts/smoke.mjs        ok
rm -rf .smoke-persist && CI=1 SMOKE_PORT=9171 WRANGLER_SEND_METRICS=false npm run smoke
                                      About to apply 75 migration(s); SMOKE PASS; " 500 " lines: 0
the build session's seal (8 files) verified byte for byte, device and sandbox:
src/db.ts                                     177973  314ba5e347720350  tail: }
src/html.ts                                   190241  3fe4fa1d2e41c626  tail: }
src/drying.ts                                  33962  3ea878a3c727758d  tail: }
src/index.ts                                  139218  1fee6cdfc33a603f  tail: export default worker;
src/i18n.ts                                   176125  b3da31c46f43b530  tail: }
src/theme.ts                                  155796  a0a9ee13e1f0e9c9  tail: }
test/menulines.test.ts                          5406  af68ee12b6df9b17  tail: });
scripts/smoke.mjs                             597532  6953ec2d8713ab01  tail: });
changed, not in the seal: none
tree listing, device and sandbox: 218 files, sha256 e35c0044bd4d2738
the build report: SESSION_REPORTS/2026-09-26_the_menu_lines.md  4244  7c38a571a289db83
dash audit: 0; secret grep: no matches
```
