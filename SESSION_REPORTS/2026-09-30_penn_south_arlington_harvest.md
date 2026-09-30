# 2026-09-30 Penn South/Arlington Harvest

Part two of BRIEF V15, THE TWO HARVEST NODES (canon 0.30.317), built in the worktree `branches/GFLiteOpsDashboard` under THE DISPATCH RULE (canon 0.30.155), on part one. Migration `0082`. The smoke pin is 82. Not deployed. Nothing committed. No git was run.

## What changed

Migration `0082_field_loads.sql` adds `field_loads` (status `open` or `in_transit`, index on status) and `wet_weights.field_load_id` (null on every tote already stored, index on the column).

The station `field_harvest` is titled Penn South/Arlington Harvest (Spanish: Cosecha Penn South/Arlington) at `/station/field_harvest`, on Harvest Operations beside Penn North Harvest. The page is three panes in the shared sheet chrome, so Lite, Continuum, and Cerberus all get them.

Left: "Start a new load" opens an empty header. Under it, the open loads, each a link, so a load survives a reload. Middle, with no load picked: Operator (text), Destination (farms that have a dry space of their own, display name, none picked), START. A post without a destination is refused. Penn South is not in the list. With a load open the header is text: Operator, Destination, started at in farm time. Entry, left to right: Weight (whole grams, `min="0"`, `step="1"`), HBN (open ARL and PNS batches under the farm-day rule, blank on load, and after "+" the newest live tote's HBN selected), "+", Finish Load. The first "+" for an HBN with no weighing lot mints one: spear, the operator as team lead, truck null, Move To the destination's holding space (Hang in Place at Penn North, the Arlington Dry Room at Arlington), the load's effective date. A later "+" for that HBN lands on that lot while it is weighing. The tote carries `harvest_batch_id` and `field_load_id`, and the lot total is recomputed.

Finish Load asks, in the page's locale, "Would you like to finish any HBNs on this load?" NO sends the load (`in_transit`, `sent_at` now) and returns the empty header. YES shows the HBNs on the load, each with its grams on this load and in all. Confirm asks the second warning, with the HBN list filled in. Go Back changes nothing. Confirm finishes each checked HBN's weighing lot the way Finish lot finishes a single-HBN lot (drying, file sequence, born package) and skips the plant count, then sends the load, all in one batch. No Internal Logistics pass is written. A load with no tote cannot be sent.

A finish today stays on the entry select. The farm-day rule named in the brief (`NO_FINISHED_LOT_SQL`) hides an HBN only once its finished lot is from before the farm's today and it has no weighing lot. The brief's walk line that the HBN is gone the same day is that rule's other half. This build followed the SQL.

Content pane, newest first: Number (from one, oldest first, within this load), Weight, Lot (`shortLotId` of the HBN), HBN (the same ARL and PNS options, a change asks the Admin PIN and moves the tote onto the new HBN's weighing lot, minted if none, both totals recomputed, one log on the tote and one on each lot), pencil (the weight edit, returning to this load), X (the void, returning here).

Right: Loads sent. In-transit loads whose sent instant falls on today or yesterday (farm days), newest first, with operator, destination, sent time in farm time, tote count, grams, and the HBNs with their grams. "<<" asks the Admin PIN and reopens the load only. An HBN finished with it stays finished.

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
- From-zero smoke (`SMOKE_PORT=9233`, `WRANGLER_SEND_METRICS=false`): `About to apply 82 migration(s)`, `SMOKE PASS`, ` 500 ` lines: 0, exit 0. The walk starts a load for Penn North, two totes on one Arlington HBN and one on a Penn South HBN, the select carrying the last pick, Finish Load NO (in transit, both HBNs still open), a second load with Finish Load YES on the Arlington HBN (drying, on the Dry Queue, not scheduled, and still on the select because the finish is today), "<<" with the PIN, an HBN change with the PIN, a pencil, and a void.
- Dash audit: 0 on every file below (U+2014 and U+2013). No CR byte in those files.
- `METRC_INTEGRATOR_KEY = "`, `METRC_USER_KEY = "`, `MS_CLIENT_SECRET = "`, `SENSORPUSH_PASSWORD = "`, `CLOUDFLARE_API_TOKEN=`, and `CLOUDFLARE_API_TOKEN: "` do not appear in those files. No personnel data.

The lab-sample status log in `test/labsample.test.ts` is ordered by insert. Two acts in the same millisecond no longer sort by the status word. That query is the only change in that file. The two repair files under `app/scripts/repairs/` and the memo in `SESSION_REPORTS` were not edited.

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
app/migrations/0082_field_loads.sql     727  e01042217df167bf
TAIL CREATE INDEX wet_weights_field_load ON wet_weights (field_load_id);
app/src/fieldharvest.ts               12449  e01df968df2021cc
TAIL }
app/src/theme.ts                     174301  d33117d41afc1f11
TAIL }
app/src/pages.ts                      28634  4b3e49f11e771dfd
TAIL }
app/src/pipeline.ts                   51493  56a908b0905152fe
TAIL }
app/src/db.ts                        194264  74b2511b88bfc29e
TAIL }
app/src/actions.ts                   368333  4a144dac9aef42ac
TAIL export { MANIFEST_COLUMNS, buckedPackageCode };
app/src/index.ts                     151748  dd8857882c7b63a8
TAIL export default worker;
app/src/config.ts                     74411  027b201698719d6a
TAIL }
app/src/i18n.ts                      189637  bfc132a8ee77ce84
TAIL }
app/scripts/smoke.mjs                642135  1b0ea366bc541458
TAIL });
app/test/fieldharvest.test.ts         15040  6f88c1c3233e381c
TAIL });
app/test/labsample.test.ts            14802  2e36c60214403fd2
TAIL });
```
