# 2026-09-30 Penn North Harvest

Part one of BRIEF V15, THE TWO HARVEST NODES (canon 0.30.317), built in the worktree `branches/GFLiteOpsDashboard` under THE DISPATCH RULE (canon 0.30.155). No migration. Not deployed. Nothing committed. No git was run.

## What changed

The station `wet_weight` is titled Penn North Harvest (Spanish: Cosecha Penn North) on the home tile, the page heading, and the Harvest Operations group. The key and the path `/station/wet_weight` stay.

The left pane and the header HBN pick list only batches whose `farm_code` is PNN, with the farm-day rule as it stood. The HBN select on a lot's add form lists PNN batches only. A batch that carries a farm other than PNN is refused at Start lot with "Penn North Harvest takes Penn North batches only." A row with no farm, the start-taps double, is left to the older checks.

When a lot finishes on this station, each lot the finish produces, including each lot of a truck split, the finish also writes the Internal Logistics pass for that HBN when none is open. The row is the one `scheduleLogisticsLot` writes (stage `internal_logistics`, status scheduled, entry and package null), in the finish's own batch, reason `finish lot`. The lot then reads Scheduled, not loaded. A later part of an HBN that already has an open pass writes nothing and rides with that pass. `<<` returns the pass as any other.

The header form, the truck split, the plant prompt, and the files are unchanged.

The from-zero smoke now starts the wet walk on two Penn North batches, because Arlington and Penn South batches are not on this pane and cannot start a lot here. A finish of the picked lot is asserted on Scheduled and off the Dry Queue. Walks that used to pick an Arlington or Penn South batch off this pane now pick a Penn North batch. The two Penn North mints take serials 26012 and 26013, so the recall mint is 26014 and the remint is 26015, and the med package the Silo 4 reconcile edits is 26018.

## Assumptions for his word

- The order: V15 goes next, before V7 (whose brief waits on his walk of CSA and CSB). His word on the order stands.
- Destination lists the farms that have a dry space (Penn North and Arlington). Penn South as a destination is a line to add if he wants it.
- The lot a field HBN gets at its first tote takes the destination farm's holding space as its Move To (Hang in Place for Penn North, the Arlington Dry Room for Arlington), spear form, the operator as team lead. Load Silo and the scheduler set the real space later as today.
- Finishing an HBN from Finish Load skips the plant count. Load Silo asks it, as Skip does today.
- A load in transit is a field record. Nothing at the destination receives it. The HBNs on it reach the silo scheduler only when finished.
- "<<" on a sent load reopens the load only. An HBN finished with that load stays finished until an admin demotes its lot.
- The Loads sent pane shows the loads sent today and yesterday (farm days). The rest are in the record and its log.
- Penn North's auto-pass writes nothing when the HBN already has an open pass.
- The Number in the content pane counts within the load. The lot's own tote count still shows on Penn North's list as today.

## Gates

Run in the worktree's `app/`.

- `npm run typecheck`: exit 0.
- `npx vitest run`: 70 files, 989 tests passed under `TZ=UTC`, and the same under `TZ=America/New_York`.
- `node --check scripts/smoke.mjs`: exit 0.
- From-zero smoke (`SMOKE_PORT=9233`, `WRANGLER_SEND_METRICS=false`): `About to apply 82 migration(s)`, `SMOKE PASS`, ` 500 ` lines: 0, exit 0. The pin move and the field walk are part two. This part's finish is inside that same run.
- Dash audit: 0 on every file below (U+2014 and U+2013). No CR byte in those files.
- `METRC_INTEGRATOR_KEY = "`, `METRC_USER_KEY = "`, `MS_CLIENT_SECRET = "`, `SENSORPUSH_PASSWORD = "`, `CLOUDFLARE_API_TOKEN=`, and `CLOUDFLARE_API_TOKEN: "` do not appear in those files. No personnel data.

The lab-sample status log in `test/labsample.test.ts` is ordered by insert. Two acts in the same millisecond no longer sort by the status word. That query is the only change in that file.

## Deploy

Not deployed from this session. Nothing committed. No git was run.

## Sealed final check

```
npm run typecheck                     exit 0
npx vitest run (TZ=UTC)               70 files, 989 tests passed
TZ=America/New_York npx vitest run    70 files, 989 tests passed
node --check scripts/smoke.mjs        exit 0
SMOKE_PORT=9233 WRANGLER_SEND_METRICS=false node scripts/smoke.mjs
                                      About to apply 82 migration(s); SMOKE PASS; " 500 " lines: 0; exit 0
dash audit: 0; CR audit: 0; secret grep: no values; personnel data: none
```

```
app/src/pipeline.ts               51493  56a908b0905152fe
TAIL }
app/src/db.ts                    194264  74b2511b88bfc29e
TAIL }
app/src/actions.ts               368333  4a144dac9aef42ac
TAIL export { MANIFEST_COLUMNS, buckedPackageCode };
app/src/index.ts                 151748  dd8857882c7b63a8
TAIL export default worker;
app/src/config.ts                 74411  027b201698719d6a
TAIL }
app/src/i18n.ts                  189637  bfc132a8ee77ce84
TAIL }
app/scripts/smoke.mjs            642135  1b0ea366bc541458
TAIL });
app/test/truck.test.ts            17096  4bc2ece563f5e34c
TAIL });
app/test/surface.test.ts          80610  0bfa68b20ae2e723
TAIL });
app/test/ops.test.ts               9191  1ed8a005ef200ead
TAIL });
app/test/i18n.test.ts             17644  18a41862ab1bc61a
TAIL });
```
