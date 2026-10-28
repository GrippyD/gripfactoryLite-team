# Gate: the silo weights repairs (26145/26146, and 26180 to 26185)

Gated by the Scribe on 2026-10-28 (canon 0.30.556). The wet split passes as received. The re-cut passes with three Scribe fixes. Nothing has run against the live database.

## Received
From the investigator's agent, written 10-26 and 10-27 to the Operations library (`Grip Internal Site - SQL Server`, the folder for the owner), and copied on his word into the sandbox's ideas folder:
- `2026-10-26_26145_26146_wet_split.sql`: 9,046 bytes, sha256 `574960d7f31d079b19e0ebbb1c0271357b457bdfaeaf3794a8c2e24ded398d65`, as its report seals it; 9 statements.
- `2026-10-27_26180_26185_recut.sql`: 30,124 bytes, sha256 `412215575067388b06d6ec9ed15698f9320c19fb9f8ccbc59dd8dd3b1e1fb12c`, as its report seals it; 33 statements.
- Their two reports and a README, plus a proposal for the Scribe (MT1, built the same day; it has its own report).

## Read
- Both files keep the repair lane's rules:
  - no double quote, no percent sign, no CR, ASCII only;
  - every statement guarded, the owner's id on every log row;
  - fixed stamps (2026-10-26T20:00Z, 2026-10-27T16:00Z), as the house repairs use.
- An unloaded lot's wet weight is closed to the floor (`TOTE_VOIDABLE_STATUSES`). The repairs change it on his word, carried by the investigator: only the wet weight records change.
- The findings, checked against the `20261026-224148_pre_sm1` tables (dumped 2026-10-27T02:41:50Z, after the run's last tote at 02:17Z):
  - **26145 and 26146:** 618 and 656 live totes, 4,573,008 and 4,834,604 g. All 656 of 26146's totes still carry 26145's batch.
  - **26180 to 26185:**
    - One run per truck: 750, 750, 750, 730, 750 and 726 live totes.
    - Each HBN was closed at its truck's send (12:34, 15:06, 19:07 and 22:08Z on 10-26; 00:46 and 02:23Z on 10-27).
    - Nothing in `src/` cuts a lot at 750; 750 is a full truck.
  - **The investigator's cut times:**
    - The five lots land exactly on the sheet: 939, 928, 998, 865 and 726 totes before the adjustments.
    - Both sides total 30,741,983 g, and the four adjustments net zero.
    - The cuts were also read tote by tote. Each cut falls inside a tote; the adjustment carries the difference, always less than one tote.
  - **26184's name:** the sheet's header names 26184 as `26299-PNS-OD-074-0-04-26184` on Silo 5, the name the app already holds, so nothing changes.

## The rehearsal
- **The bench:** a local D1 at 0122 from the migrations, holding the twelve tables the repairs read, taken from `20261026-224148_pre_sm1`.
  - The tables: `wet_weights`, `harvest_plant_tags`, `wet_weight_entries`, `harvest_batches`, `silo_loads`, `unload_sessions`, `dry_weights`, `local_inventory_items`, `production_schedules`, `metrc_uploads`, `dry_spaces`, `field_loads`.
  - Every run went through `repair-apply.mjs --local`, each file twice.
- **The wet split as received:**
  - 9 of 9 statements ran.
  - 26145 holds 4,570,404 g on 619 totes and 26146 holds 4,837,208 g on 657, with no stray batch. 5 log rows.
  - The second run changes nothing. PASS AS RECEIVED.
- **The re-cut as received:** the five lots land on the sheet, with three defects.
  1. **26185 is half voided.**
     - 26185 holds 547 live plant tags (truck 6's, pasted 2026-10-27T02:24:49Z).
     - Section D's lot void declines on them, while the voids of its silo load and package go through.
     - 26185 is left with no totes, its stale 4,863,741 g, no package, and its batch standing.
  2. **The packages keep the truck weights.**
     - The five drying lots' WIP packages stay at the truck weights: 26180's reads 5,101,763 g against the lot's 6,426,653.
     - This breaks ONE RULE FOR EVERY TOTE CHANGE (canon 0.30.375): a tote change on a lot in transit or drying moves its one live wet package by the same grams.
  3. **The check fails on D1.** Section F is a compound SELECT of six terms, which D1 refuses ("too many terms in compound SELECT"). The run ends red at statement 33, after every change has landed.

## The Scribe's fixes
- **The house lane:** `db_backups/_repairs/2026-10-27_26180_26185_recut.sql`, 42,816 bytes, sha256 `31642b32f206b1089294cc59a999cb397e5da3e5817d0de75cab64f47fc8b792`, 39 statements, the longest 2,258 characters. The investigator's statements stand word for word, and the header says what changed.
- **B2, before C:**
  - Each lot in transit or drying with one live WIP or SPR package (no children, at the barn or its own space) moves that package to the lot's new weight from its live totes.
  - It does so only while the package still equals the lot's old weight.
  - Logged first, old and new.
- **C2, before D:** a whole truck's plant tags follow its totes.
  - Truck 5's 588 tags (on 26184, pasted 00:46:53.858Z) go to 26183.
  - Truck 6's 547 tags (on 26185, pasted 02:24:49.330Z) go to 26184.
  - The moves are keyed on the lot and the paste instant. They run only once the truck's totes sit on the new lot, and never while either lot or batch carries a wet weights upload mark (a marked file's tags are read only, canon 0.30.249).
  - Truck 6's tags also stay put while 26185 has dry weights.
  - The tags of trucks 2, 3 and 4, each split between two silos, stay where they were pasted.
- **F:** one SELECT with no compound terms, and each lot's package and tag counts added.
- **The wet split** goes into the house lane as received: `db_backups/_repairs/2026-10-26_26145_26146_wet_split.sql`, 9,046 bytes, `574960d7f31d079b`.

## The rehearsal of the fixed re-cut
- **On the 10-26 tables:**
  - 39 of 39, then 39 of 39.
  - The five lots land on the sheet (940, 929, 999, 866 and 726 totes with the adjustments), each package equal to its lot.
  - 26183 holds 1,237 tags and 26184 holds 547.
  - 26185 is voided with its package and its batch. 24 log rows.
  - The second run changes nothing (state hash `e73f38866618254c` both times).
- **The floor moved on:**
  - The setup:
    - 26180 and 26181 unloaded, with dry packages of 900,000 and 950,000 g;
    - 26184 in Silo 5, and 26185 waiting on an open Silo 5 load;
    - a tote voided inside A3's window, another voided on 26182, and a late tote on 26181.
  - The result:
    - The unloaded lots' packages stand.
    - 26181 reads the sheet plus the late tote. 26182 reads the sheet less the two voided totes, and its package follows.
    - 26185's open load is voided.
    - A second run changes nothing.
- **Dry weights on 26185 before the run:**
  - 26185 stands with its tags, its package and its open load, and F reads "left standing: has dry weights".
  - The five real lots land.
- **A run cut short after B2, then the whole file:** the same end state as one clean run (`e73f38866618254c`).
- **Both files in a row:** 29 log rows, and every lot as above.

## For the investigator, through the owner
- **Plant tags:** which plants of trucks 2, 3 and 4 went to which silo.
- **METRC:**
  - The sheet lists the five harvests with their package tags (`1A40503000311FB000056935` to `...56939`).
  - If METRC already carries them at the sheet's weights, the app's pending wet weight files for 26180 to 26184 (and for 26145 and 26146) are marked done at Admin, Uploads, not uploaded.

## His hands, from the main folder's `app/`
    node scripts/db-snapshot.mjs pre_silo_weights
    node scripts/repair-apply.mjs ../db_backups/_repairs/2026-10-26_26145_26146_wet_split.sql
    node scripts/repair-apply.mjs ../db_backups/_repairs/2026-10-27_26180_26185_recut.sql
    node scripts/db-snapshot.mjs post_silo_weights

- **Expected:** 9 of 9, then 39 of 39.
- **If a statement fails**, the run stops; the same command again finishes it.
- **If a snapshot's folder comes out empty**, run that snapshot again before going on.
- **Afterward**, the Scribe reads the post snapshot against the pre, lot by lot.
