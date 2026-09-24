# Session report: the arrivals pane closes (canon 0.30.25) and THE LEDGER FOLLOWS THE TRIM with the door widened (canon 0.30.26), Scribe-direct, 2026-09-09

**Scribe:** Gripfactory Lite Scribe (Cowork), Scribe-direct under G-2. Three owner messages during his fresh walk on the live worker 34c62d80, all before the pending deploy; one slice, worker only, no migration.

## The messages, verbatim

- 0.30.25 (with the arrivals screenshot: MANIFEST NUMBER 82C77A90, AU-G-C-000832 PNN AU / AU-P-000694 PNN Processor, 26001 WIP Goji Excreeshunzz 225,000.00 Received, the two buttons): "I finished the receipt on this, it should dissappear from the list and if there's nothing selected, so should the buttons"
- (with the Trim Packages Entry and Cryo Weight Entry screenshots showing the Kieth / Les / Austin dropdown): "found our maintenance team again--should be an open txtbox field" and "Again". Both are the live worker; canon 0.30.21 already made them typed fields and rides the pending deploy. Nothing new built for these two.
- 0.30.26 (with the Local Inventory screenshot: WIP 26001 Goji Excreeshunzz 225,000.00 g, Penn North, Barn): "Local inventory: pictured  This is incorrect.  I've trimmed and cryo'd this material.  Right now it should be queued for testing but it doesn't look like it ever moved from the reception even though we've crossed the door."

## What was wrong

Two seams, both real, both older than this sitting.

1. **The door hung on CSA.** THE INBOX LAW routed an 832 to 694 manifest through the door (a completed virtual move, items to CSB under the processor license, no receive) only when the origin location was CSA. His material sat in BARN (the spine births there; the silo unload lands there; his 0.30.19 word was "We dropped all dry spaces in favor of barn"), so his 832/BARN to 694 manifest was treated as an outbound truck shipment: it landed in Arrivals, he received it, and Finish Receipt put the package back in the PNN BARN under 832, the site barn and arrival license it used for every receipt. The door did nothing.
2. **The trim never reached the ledger.** wip_packages (the WIP pipeline: trim, cryo, testing, release) and local_inventory_items (Local Inventory) never spoke. A trim cut wrote packages into the pipeline while the lot's harvest package kept its born weight in the ledger, so Local Inventory showed 225,000 g in the barn after the material had been trimmed and cryo'd into the Testing Queue.

## What shipped

1. **0.30.25, the arrivals pane.** The working pane opens only a manifest still on that site's arrivals list; a finished receipt's redirect drops `?movement=` so nothing stays selected; a stale URL naming a closed manifest opens nothing ("Pick a manifest."); [Receive all] renders only while an item is still open and [Finish Receipt] only while a received item awaits its receipt, so with nothing selected there are no buttons. The receipt's paper stays in the receipts table below.
2. **0.30.26, the door.** `isInternalCsaToCsb` is the door from ANY 832-side spot: origin 832, destination 694, origin location BARN, CSA, a silo or blank. Finish manifest on such a movement completes it as a virtual move and puts its items at CSB under 694 at once, as before for CSA. `finishReceipt` now lands where the manifest said (destination_location, else THE INBOX LAW's derivation, else the site barn) under the manifest's destination license (else the arrival license), instead of the site barn under the arrival license unconditionally.
3. **0.30.26, THE LEDGER FOLLOWS THE TRIM.** A trim package cut mints its own ledger item (kind WIP, the package's code and grams, the lot's batch and strain, the parent's farm, license and location, linked by `wip_package_id`, no `wet_weight_entry_id` so every one-item-per-lot reading of the parent stays true) and the lot's package gives up the same grams (never below zero; an overage is the adjustment lane's, fork 7). Cryo sets the child's grams to the cryo weight. The pencil on a trim package moves the difference between parent and child (a cryo weight edit sets the child; blank returns it to the trim weight). The x voids the child and hands the trim grams back to the parent. Reasons inv_trim_cut, inv_trim_edit, inv_trim_void, inv_cryo_weight; every move logged. Local Inventory now reads the trimmed packages where the material is (CSB after the door) with the harvest package's remainder beside them.

Forks left for the owner: release to FG (a passed test could flip the child's kind to FG in the ledger; untouched); the cryo weight as the ledger truth (built as the default: what came out of the cryo is what is on the shelf).

## Sealed final check

```
cd /home/claude/deploy/app
npx tsc --noEmit                      -> exit 0
npx vitest run                        -> Test Files 19 passed (19), Tests 484 passed (484)
Dash audit (7 touched text files)     -> 0
SMOKE_PORT=9596 WRANGLER_SEND_METRICS=false timeout 285 npm run smoke
                                      -> SMOKE PASS, "About to apply 38 migration(s)" from zero
Smoke pins added: Finish Receipt redirects to the bare arrivals list, the
  finished manifest is gone from the pane, nothing is selected and no buttons
  render, a stale ?movement= opens nothing (twice: the outbound walk and the
  WET-lot manifest); THE LEDGER FOLLOWS THE TRIM: BUD-SMOKE-1 and TRIM-SMOKE-1
  mint their ledger rows at 100.00 and 20.50, the ledger's WIP grams before
  and after the cut are equal to the cent, cryo sets BUD-SMOKE-1 to 88.25,
  the x on PLUS-SMOKE-1 removes its row and hands the grams back.
Unit pins: walk.test.ts (each button renders only while it has work; nothing
  selected shows none; Finish Receipt on an 832 to 694 manifest lands CSB
  under 694), floor.test.ts (the door from BARN, a silo and blank; not from
  another farm's license or to another farm).

src/config.ts c1cbed7aadf2c6c5     src/actions.ts f3bc593b9c88e07d
src/index.ts 71c17cbc0396d0c4      src/html.ts 5f4b3ea7be4bfc5a
test/walk.test.ts 16653afb2cd27a30   test/floor.test.ts a49fceb80b97cbc0
scripts/smoke.mjs dfaf3e7d8b155a99
```

Worker only; rides the pending deploy (worker plus migration 0038, now carrying 0.30.18 through 0.30.26). Never c10 deploy. Owed from the owner: the deploy run and its version id; the true-zero after-counts (his walk shows 26001 again, so the purge ran); the 0.30.19 R2 picture if the Load Silo pane still lists a lot he says is not in the barn after this deploy; a real Zoho export mounted live; the Athena logo; T1 Transport vs T1 Logistics; the METRC templates.
