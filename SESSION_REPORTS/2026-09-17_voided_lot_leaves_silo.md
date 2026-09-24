# 2026-09-17 The Voided Lot Leaves Its Silo (canon 0.30.116)

Scribe sitting, built Scribe-direct under G-2, on the LIVE floor of 0.30.115 (worker 6bc6afd9, migrations 0001-0059). Owner report 2026-09-17, verbatim, with a screenshot of the Silo 1 card (PAUSED, Lot 26024, 0d 06:16:19 Paused, Wet 0.00 lb 1.00 g):

"Can you remove this lot from the silo?  I think I stranded it by deleting its record in data queue"

His picks at the two forks: the repair voids the whole trail (the load, the lot's born package, any pending CSV rows), and the law going forward is "Take the load with it".

Worker-only; no migration. From-zero pin stays 59; next free migration 0060. The record repair for the live Silo 1 load is a separate act under the 0.30.91 law (a fresh snapshot, one guarded SQL file, rehearsed here, applied by his hands) and follows in its own row.

## What was found

The silo card reads the open `silo_loads` row (deleted_at null, ended_at null) and LEFT JOINs the lot for its label and grams. Voiding a lot in Data Queues (`/record/wet_weight_entries/:id/void`) set deleted_at on the lot row alone: its load kept Silo 1 occupied with no lot for Unload Dry Space to find, Load Silo refused Silo 1 as occupied by a lot that no longer exists, and the lot's born package (1.00 g) stayed live on the ledger at Silo 1. The pending Wet Weights and Location Change rows need no repair: both are derived from live lot rows and dropped with the void.

## The law, as built

1. THE VOID TAKES THE LOAD. Voiding a lot in Data Queues also voids the lot's open silo loads (deleted_at, deleted_by, delete_reason the typed reason) and every live ledger item born to the lot (the harvest package), each with a record_change_log row under the lot's reason ("the lot was voided; its load leaves the silo: <reason>" and "the lot was voided; its package leaves the ledger: <reason>"). The silo empties in the same act and nothing of the lot stays live. Ended loads stand as history.
2. A VOIDED LOT NEVER OCCUPIES. The tile reader (listOpenSiloLoads) and the occupancy rule (getOpenSiloLoadForSilo) ignore a load whose lot is voided, so an orphan can never hold a silo again whatever its load row says; the Silo 1 card clears on this deploy even before the repair closes the row.
3. Nothing else about the void changed: the reasoned void, the PIN, the Data Queues surface and the return to the page it started from.

## What changed

- `src/config.ts`: SYSTEM_REASON.lot_void_load, lot_void_item.
- `src/db.ts`: listOpenSiloLoads and getOpenSiloLoadForSilo add `w.deleted_at IS NULL`.
- `src/actions.ts`: voidRecord's wet_weight_entries branch voids the lot's open loads and live ledger items with log rows.
- `scripts/smoke.mjs`: a tail cluster adds Silo 6 in Admin, mints a PNN HBN, weighs a 1.00 g stray, finishes it, loads Silo 6, reads the package under Silo 6 on the Inventory by Location CSV, voids the lot in Data Queues, then pins: the strip and live.json read Silo 6 empty, the package leaves the CSV, the change log carries both reasons, the voided load's record is gone, the Dry Space Queue and Unload Dry Space do not list the lot.

## Scribe assumptions (his word owed if wrong)

- Ended loads of a voided lot stand as history; only open loads are voided with the lot.
- Every live ledger item born to the lot goes with it (the harvest package; a lot has one).

## Gates

- `npx tsc --noEmit`: exit 0.
- `npx vitest run`: 34 files, 697 tests passed; the same under TZ=America/New_York.
- `node --check scripts/smoke.mjs`: ok.
- From-zero smoke (SMOKE_PORT=9018): `About to apply 59 migration(s)`, `SMOKE PASS`, no 500 in the log.
- Visual: no markup changed; no screenshots owed.
- Dash audit: 0 on every file below.

## Deploy (his hands, worker only)

```powershell
cd "C:\Users\DennisWallace\Documents\Claude\Projects\gripfactory Practical\app"
npm run deploy:grip
```

## Sealed final check

```
npx tsc --noEmit                      exit 0
npx vitest run                        34 files, 697 tests passed
TZ=America/New_York npx vitest run    34 files, 697 tests passed
node --check scripts/smoke.mjs        ok
rm -rf .smoke-persist && SMOKE_PORT=9018 WRANGLER_SEND_METRICS=false timeout 285 npm run smoke
                                      About to apply 59 migration(s); SMOKE PASS

src/config.ts            49054  c74ab821509f6c24
src/db.ts               150495  15a653e9c073e88f
src/actions.ts          256633  05a8d0399596125c
scripts/smoke.mjs       419860  e1f25a5eb60e7ade
dash audit: 0 on every file above
```
