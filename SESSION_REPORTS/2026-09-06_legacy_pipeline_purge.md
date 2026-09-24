# Session report: the legacy pipeline purge (canon 0.27.4), owner-run runbook, 2026-09-06

**Scribe:** Gripfactory Lite Scribe (Cowork). Ops session, no code change, no migration, no deploy.

## What prompted it

The owner sent two uncaptioned screenshots of the inventory dash: WAITING TO BE SHIPPED FOR EXTRACTION and TOTAL DRY WEIGHT IN INVENTORY both reading 416,826.00 g over seven packages (lots 26010 through 26025: TEST123, 321321321321327, 321321321321326, test321, 72700, TEST1234, 123123123123123).

Diagnosis, two parts. First, no double count: total dry = every live package plus unloaded-lot dry weight; waiting for extraction = created packages whose type is on the extraction list (Trim and BIO only, the 2026-09-01 ruling); on that data every live package was a created Trim/BIO package and nothing sat unloaded, so the sections coincided. Second, the real thing: the dash reads the WIP pipeline tables (wip_packages, dry_weights, the lot lineage), which the 0.26.x scoped purge deliberately left alone, so the dash was the last surface still showing the old test build while the floor and the Inventory by Location report showed only the fresh run. A detail worth keeping: the legacy LOTS were already soft-deleted; the dash kept rendering their packages because the live-packages query does not join lots. The fork went to the owner; his word: **Purge them by runbook.**

## What ran

The guarded runbook (per the destructive runbook law): seven per-table backups first (wrangler d1 export fails under OAuth; dumps ride `d1 execute --remote --json`), then scoped deletes (stale metrc_uploads marks and legacy harvest_batches by finished-lot lineage, wet_weights of finished lots), table clears for the purely-downstream tables (wip_packages, dry_weights, unload_sessions), and the finished-status lot delete (which matched zero rows, the legacy lots being already soft-deleted; voided lot rows stay as history). record_change_log untouched, as always.

**First run halted on line one: the D1 query endpoint answered a transient 7403 on the first backup while a deploy seconds earlier had run green.** The throw guards held: zero deletes ran, nothing ran unbacked. The law hardened: every destructive block now leads with a warm-up probe (`SELECT 1` against the remote) so a flake dies before even the backups. The re-run with the probe went green end to end.

## Verification (owner's terminal, pasted verbatim)

```
Count before (deleted_at IS NULL):    in_transit 1, weighing 2
After all deletes:
  wip 0, dry 0, sess 0
  statuses (deleted_at IS NULL):      in_transit 1, weighing 2
```

The lot table reads exactly the new run before and after: Chem 51 weighing at ARL, BCC x Jealousy weighing at PNN, Bermuda Triangle in transit. The dash now reads 0.00 dry and 0.00 extraction; the floor and the report did not move. Backups live in `SESSION_REPORTS/db_dumps_<stamp>/` (seven json dumps). The earlier halted run left one artifact: its own `db_dumps_<stamp>` folder holding a wip_packages.json that contains the 7403 error body; harmless, delete at will.
