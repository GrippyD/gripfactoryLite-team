# 2026-09-30 The in-transit rule

BRIEF V15.1, THE IN-TRANSIT RULE (canon 0.30.320), built in the worktree `branches/GFLiteOpsDashboard` under THE DISPATCH RULE (canon 0.30.155), on V15 with the gate's fix as the brief named it (the app tree `05517224a9053b77`). One migration, `0083`. The smoke pin is 83. The two repair files under `app/scripts/repairs/` and the memo of canon 0.30.315 were not edited. Not deployed. Nothing committed. No git was run.

## What changed

Migration `0083_field_in_transit.sql` adds `harvest_batches.field_closed_at`, `harvest_batches.field_closed_by`, `field_loads.received_at`, and `field_loads.received_by`. Null on every row already stored.

A weighing lot of an ARL or PNS HBN that carries a live tote on an in-transit load is a Dry Queue line (`listDryQueueLots`: the finished lots of `listBarnWetLots`, plus those weighing lots). `truck_number` is null on that lot. `finished_at` is the earliest `sent_at` of the loads its totes ride, so the wait starts at the first send. Internal Logistics and `listLotParts` read that list. `listBarnWetLots` and Load Silo do not: a weighing lot is never loadable. A row whose parts include a weighing lot carries `data-logistics-in-transit` and, where the trucks read, "in transit, 1 load" or "in transit, {n} loads" (ES "en transito, 1 carga" / "en transito, {n} cargas"). Its grams are the lot's total. A later load sent while that weighing lot stands adds its totes to the same lot, and the loads count rises.

`>>` on an HBN whose parts include a weighing lot finishes that lot first, in the pass's own batch, the way YES finishes one (`singleLotFinishStmts`, plant count skipped: weighing to drying, `harvest_file_seq`, the born package, reason `finish lot`), then writes the pass. The HBN stays open to field weight. The next "+" mints a new weighing lot. A weighing line stays on the Dry Queue even while an earlier pass of that HBN is still open, so the new lot is its own line at its send. `>>` while a pass is already open still refuses, as today.

After the pass is written, every in-transit load carrying a live tote of that HBN is received when none of its live totes sits on a weighing lot and every HBN on it has a live Internal Logistics pass (`scheduled` or `complete`, not deleted) with `scheduled_at` at or after the load's `sent_at`. The load becomes `received`, with `received_at`, `received_by`, and reason `field load received`. `listInTransitFieldLoads` lists status `in_transit` alone, newest first, however old. A received load is off the Loads sent pane, so it has no `<<`. `<<` on a load still in transit reopens it as today. Returning a pass does not un-receive a load.

Finish Load YES, besides finishing the checked lots, writes `field_closed_at` and `field_closed_by` on each checked batch (reason `field hbn closed`). The field select is `field_closed_at IS NULL`: an ARL or PNS open batch stays listed until YES closes it, whatever its lots. "+" and the tote change still refuse a closed HBN ("That HBN is not on this list."). The Demote of a lot back to weighing clears `field_closed_at` and `field_closed_by` (reason `demoted`). A lot finished by the pass closes nothing. Penn North's node and its auto pass are unchanged, and a `>>` on a Penn North HBN does not set `field_closed_at`.

The harvest-batch CSV export follows the table, so each line now ends with `field_closed_at,field_closed_by` after `born_from`. Those two cells are empty until YES. The smoke reads that ending.

## Assumptions for his word

- "The in-transit list" is the Loads sent pane. A load leaves it at the pass of the last HBN it carries; a load carrying one HBN closed by YES and one still open stays until both are passed.
- The pass finishes a weighing lot the way YES does: the plant count skipped (Load Silo asks), the born package minted as V15 mints it.
- A line's grams are the lot's total, so the totes of a load still open count on it once any load carrying the HBN is in transit; the loads count names the sent loads only.
- The wait on an in-transit line counts from the first send.
- The two-day window on the Loads sent pane goes; an in-transit load shows until received, however old, which is the truth of the floor.
- Load Silo never lists a weighing lot; on the field node the pass and YES are the only doors from weighing to drying.
- A pass returned with `<<` after a load was received leaves the load received; the lot stays finished on the Dry Queue as today.
- Penn North is untouched: its HBNs never carry `field_closed_at`.

## Gates

Run in the worktree's `app/`.

- `npm run typecheck`: exit 0.
- `npx vitest run`: 70 files, 994 tests passed under `TZ=UTC`, and the same under `TZ=America/New_York`.
- `node --check scripts/smoke.mjs`: exit 0.
- From-zero smoke (`SMOKE_PORT=9245`, `WRANGLER_SEND_METRICS=false`): `About to apply 83 migration(s)`, `SMOKE PASS`, ` 500 ` lines: 0, exit 0. After Finish Load NO on the first load (an ARL HBN and a PNS HBN, both weighing), the Dry Queue lists each as a line marked in transit and Load Silo lists neither. A second load with the ARL HBN, sent, is one ARL line with both loads' grams and "2 loads". `>>` on the ARL HBN: the lot is drying with a born package, the row is Scheduled, the second load is received and off the pane, the first load stays in transit. `>>` on the PNS HBN: the first load is received and the pane is empty. A third load with the ARL HBN: "+" mints a new lot while the HBN is still on the select. Finish Load YES closes it and takes it off the select, and "+" is refused. The Demote of that lot on the Admin queues puts the HBN back on the select. Reopen, an HBN change, a pencil, and a void still run on a load that is in transit.
- Dash audit: 0 on every file below (U+2014 and U+2013). No CR byte in those files.
- `METRC_INTEGRATOR_KEY = "`, `METRC_USER_KEY = "`, `MS_CLIENT_SECRET = "`, `SENSORPUSH_PASSWORD = "`, `CLOUDFLARE_API_TOKEN=`, and `CLOUDFLARE_API_TOKEN: "` do not appear in those files. No personnel data.

## Deploy

Not deployed from this session. Nothing committed. No git was run.

## Sealed final check

```
npm run typecheck                     exit 0
npx vitest run (TZ=UTC)               70 files, 994 tests passed
TZ=America/New_York npx vitest run    70 files, 994 tests passed
node --check scripts/smoke.mjs        exit 0
SMOKE_PORT=9245 WRANGLER_SEND_METRICS=false node scripts/smoke.mjs
                                      About to apply 83 migration(s); SMOKE PASS; " 500 " lines: 0; exit 0
dash audit: 0; CR audit: 0; secret grep: no values; personnel data: none
```

```
app/migrations/0083_field_in_transit.sql    432  354dc89a1fd26666
TAIL ALTER TABLE field_loads ADD COLUMN received_by TEXT;
app/src/db.ts                            197317  2bb793a46f2247ae
TAIL }
app/src/actions.ts                       375975  7ca39536d98656ca
TAIL export { MANIFEST_COLUMNS, buckedPackageCode };
app/src/scheduling.ts                     46793  f7792a8daf53796b
TAIL }
app/src/fieldharvest.ts                   13456  a52b591b0b35131d
TAIL }
app/src/index.ts                         152223  9955ff02c7ef4835
TAIL export default worker;
app/src/config.ts                         74657  d02a66f555c93205
TAIL }
app/src/i18n.ts                          189875  fa93379997823269
TAIL }
app/scripts/smoke.mjs                    650279  3dc5f9a4503b71e9
TAIL });
app/test/fieldharvest.test.ts             29118  4f2331717d367ac3
TAIL });
app/test/logistics.test.ts                11296  fa72010767590268
TAIL });
```
