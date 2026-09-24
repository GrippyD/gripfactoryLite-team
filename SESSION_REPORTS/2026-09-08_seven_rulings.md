# Session report: seven rulings in one sitting (canon 0.30.9 intake, 0.30.10 build), Scribe-direct, 2026-09-08

**Scribe:** Gripfactory Lite Scribe (Cowork), Scribe-direct under G-2. The owner fired seven rulings in the minutes after the 0.30.8 deploy; all seven are logged verbatim in the 0.30.9 canon row and built here as one slice. Worker plus one append-only migration (0036).

## The rulings, in the order they landed

- R1 "589af120 is an orphan" (the ON THE ROAD strip showing a truck row and a bare "ARL - PNN - 589af120" row).
- R2 "Start time in Load Silo needs the time input mask"
- R3 "The "LOADED" time is when the clock should start"
- R4 "Null Market Strains should automatically inherit the real strain, the market strain should be what's listed from Trim Packages entry forward (The picture should say "[Last 6 of Tag Number]/26001/TEST MOOKY/250,000(drop the decimals)."
- R5 "Trim packages entry should show the entered packages below the working pane, ordered by latest to oldest, pencil and "x" PIN gated"
- R6 "when I go over in trim packages entry, I need to be prompted that I'm at 0 and the option provided to remove it from queue."
- R7 "Cryo and Trim need the dates saved to each record, along with the hand entry of the operator filling in the data"

## What shipped

1. **R1, THE TRUCK CARRIES ITS PAPER.** Diagnosis: the road and the Arrivals pane read two sources (in-transit truck lots, and completed manifests with an open item); since the spine every truck lot cuts a manifest at finish, and a floor manifest built on a weighing lot (a WET item) puts the same lot in transit, so one truck yielded two rows, the second labeled origin - destination - short id and nothing else. By the screenshot 589af120 is TEST MOOKY's own manifest. Two real defects sat behind it: the manifest-pane receive moved the package but never flipped the lot (a stranded truck row), and Finish Receipt skipped WET items entirely (a manifest that never closes). Built: `listInboundTruckLots` carries the riding manifest (matched through the born package's `wet_weight_entry_id` or the WET item that IS the lot id); `listInboundMovements` excludes manifests riding an in-transit lot; the truck row names its manifest on the road and at Arrivals (`data-riding-manifest`); every other road chip names its contents through `roadChips` (one package: code / strain / grams; more: the count and total); `receiveTruckLot` closes the open manifest row whichever way the lot rode, through a shared `lotArrivalStmts`; `finishReceipt` now receipts WET items and lands any in-transit lot the manifest carries (status to drying, the fallback mint for a pre-ledger lot). Legacy orphans heal from the UI: a stranded truck row takes the one-button; a WET-item manifest closes at Finish Receipt.
2. **R2/R3, Load Silo.** The Start time carries the app's HH:MM colon mask (`data-time24-mask`, the Acquire idiom) and the browser resolves the typed wall-clock time to an instant (`loaded_at_iso`) at submit; `resolveLoadedAt` checks the shape, refuses a time ahead of now beyond ten minutes or more than two days back, and loads now when the field is blank or no script ran. THE LOADED TIME IS THE CLOCK'S ZERO: `loaded_at` drives every clock (`clockZeroMs`), `started_at` mirrors it at the load, the load view shows Loaded (rendered local by the ticker, once) and the clock, Start is greyed from the load (a load is started the moment it exists; a Start on a pre-law load records the loaded time), Pause/Resume unchanged, the pencil edits `loaded_at`.
3. **R4, the market strain.** `inheritMarketStrain`: a blank market strain is the strain's name, stored on the batch at Acquire and at the manual HBN mint; 0036 backfills the blanks. From Trim Packages Entry forward the strain shown is the MARKET strain (queue rows, the WIP sheet select), and the Unloaded Queue rows and the Trim heading read `lotTagLabel`: last-6-of-tag / serial / market strain / grams with no decimals (`formatGramsWhole`; a blank tag drops its token; the app's spaced slash stays). Before Trim nothing changes.
4. **R5, the entered list.** The Trim working pane lists the lot's live packages beneath the entry form, newest first (`listLotTrimPackages`), with package, type, weight, date, operator, and the pencil and the x leading to `/record/wip_packages/:id/edit` and `/void`, which now sit behind the PIN gate.
5. **R6, REMAINING 0.** When Recorded reaches or passes Original the pane prompts "Remaining 0." (naming the overage when there is one and promising the adjustment CSV) with [Remove from queue] (`gate_choice=remove`, `applyTrimRemove`): the lot trims and leaves the Unloaded Queue; when over, the log carries `queue_adjust` so the adjustment CSV pends at the export home (fork 7's corrective lane, papered automatically) and the flash says so; short of the parent the button is never offered and a stale post refuses in words. The under gate (short of the parent) is unchanged; the old over gate and over-issue banner step aside for the prompt. A Save that lands at or past zero returns to the picked page (the prompt) instead of the gate.
6. **R7, dates and operators.** 0036 adds `wip_packages.trim_date, trim_operator, cryo_date, cryo_operator`. The Trim form carries Date (the crew's today by default, `data-default-today`) and Operator (typed, required) above the package rows; every package saved stores them. The Cryo form carries its own Date and Operator; every cryo weight stores them (logged). The pencil's field set gains all four. Boundary law generalized from 0.29.1: a field ABSENT from a reasoned-edit post means unchanged (a present blank still clears; checkboxes keep absent-is-off), so older forms never wipe the new columns.

## Sealed final check

```
cd /home/claude/deploy/app
npx tsc --noEmit                      -> exit 0
npx vitest run                        -> Test Files 18 passed (18), Tests 457 passed (457)
Dash audit (16 touched files)         -> 0
SMOKE_PORT=9541 WRANGLER_SEND_METRICS=false timeout 285 npm run smoke
                                      -> SMOKE PASS, "About to apply 36 migration(s)" from zero
Smoke walks added or changed: the truck finish leaves ONE road chip naming its
  manifest and no bare id (Arrivals line carries data-riding-manifest, the
  manifests pane omits it); the one-button receive clears the manifest from the
  road; a WEIGHING lot added to a floor manifest as a WET item rides the truck
  row, the one-button closes its WET item (Received), and a second such lot
  closes through Receive all + Finish Receipt by URL with the truck landing
  (drying, in the Dry Space Queue, minted into the PNN barn); Load Silo: the
  mask on Start time, loaded_at_iso on the form, a future time 400s, a load two
  hours back runs from that instant with data-started equal to it, Start greyed,
  no "Not started"; Trim: the heading and pane read the Trim-forward label with
  no decimals, Date and Operator on the form, no operator 400s, the entered list
  beneath the form with both packages, operator and date, pencil and x, the PIN
  page without the cookie and the record edit with it, a plus row landing first
  then voided; the under gate still asks on a short Save; an over Save lands on
  the picked page with the REMAINING 0 prompt (overage named, adjustment
  promised, Remove from queue offered, no old gate), the remove lands with the
  adjustment flash, the adjustment pends, the lot leaves the pane, a stale
  remove 400s; Cryo: Date and Operator on the form, no operator 400s, the saved
  record carries both.
Unit pins: floor.test.ts road chips (4); drying.test.ts (8: clock from the
  loaded time, resolveLoadedAt, the mask and the resolver on the form, Start
  greyed from load, the pencil on loaded_at); gate.test.ts (19: dates and
  operators on the entries, the operator refusal, Remove from queue at zero /
  over / short); surface.test.ts (108: the Trim-forward label, the prompt at
  zero and over, the under gate unchanged); trim.test.ts NEW (10: lotTagLabel,
  formatGramsWhole, inheritMarketStrain, the queue declarations, the entered
  list newest-first with PIN-titled controls, the Cryo fields, the pencil set).
Visual pass (wrangler dev on the smoke database, 1280x900 @1.5, dev@local):
  Trim Packages Entry with "REMAINING 0." and [Remove from queue], Date defaulted,
  Operator, the entered list (two rows, newest first, operator and date, pencil
  and x); Load Silo with Silo 1 running 0d 02:01:23 from a load two hours back,
  Loaded rendered local with "the clock's zero", Start greyed; the Start time
  field turning typed 0715 into 07:15 with "The clock runs from this loaded time."

migrations/0036_market_strain_trim_cryo.sql c34d03684ad3219d
src/actions.ts 7fa999a8bdd20716  src/config.ts 9e7ef3b7611071ed  src/db.ts e2e1970d2a7220e3
src/drying.ts 9dda8eb2254e44fc  src/html.ts 4830f8bf28f5b274  src/i18n.ts 2a69eeb2ded30928
src/index.ts c4ddb5df9f27f0dd  src/interco.ts 9cc4c0fa9ae2cf79  src/pipeline.ts 8dfcd2f9f1aa2b05
test/drying.test.ts 1ab49ec2b33eaa66  test/floor.test.ts f8e5f1497185f80d
test/gate.test.ts f62780c408cdf561  test/surface.test.ts 3f610bb558636180
test/trim.test.ts 252b75e04b84dfc6  scripts/smoke.mjs b3d72ce16aeb692e
```

Worker plus one append-only migration (0036: a data backfill of blank market strains, four nullable columns on wip_packages). Never c10 deploy. Still owed on the METRC side: the real location-change template and the T3 receive/finish templates. Still owed from the owner: the harvest purge after-counts paste (or the word to narrow it).
