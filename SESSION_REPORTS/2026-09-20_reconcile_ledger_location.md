# 2026-09-20 The Reconcile Ledger Location (canon 0.30.135, migration 0063)

Scribe sitting, built Scribe-direct under G-2, on the LIVE floor of 0.30.133 (worker b3f4d3e6, migrations 0001-0062). One owner ruling 2026-09-20, verbatim, his line breaks kept:

"add a new button to Admin: [Reconcile Ledger Location]

1. Select Farm: (inert for now--we're all one farm as long as interco is out of the chain)
2. Select Location - Start with just the drying locations/freezers
   1. Purge
      1. Reason
      2. Admin PIN
   2. Edit
      1. All the data that's in the location becomes editable plus a note before saving changes - reflect all on the changelog - No changes to the original CSV, but add something to the data queue that's more like a note that can be aknowe=ledged that the change occurred."

Migration 0063 `reconcile_notes` (the note that rides the queue). From-zero pin moves to 63; next free migration 0064. Deploy is the three-step block.

## The law, as built

### THE RECONCILE LEDGER LOCATION (0.30.135)

1. THE BUTTON: Admin carries [Reconcile Ledger Location] after Import Data; the page is /admin/reconcile-location, behind the Admin PIN gate like every Admin page.
2. THE FARM STANDS INERT: the farm select lists the farms with the landing farm (PNN) picked and is disabled, under the words "One farm while Interco Logistics is out of the chain."
3. THE LOCATION IS A DRYING LOCATION: the select lists every dry space but the truck sentinel (the silos, the Arlington Dry Room, the Blast Freezer(s), Hang in Place) by the METRC location it stands over (location_name, else its name; the freezer reads "Blast Freezer(s) (Blast Freezer)"), each once; picking one reloads the page and lists the live ledger packages there with their count and grams.
4. PURGE: a reason and the typed Admin PIN; every live ledger package at the location is voided (deleted_at, deleted_by, delete_reason the reason) with a change-log line each under "reconcile purge: <reason>"; a wrong PIN refuses 403 "Purging needs the Admin PIN.", no reason refuses, an empty location refuses "Nothing at that location to purge.". Lots, loads and the METRC mirror are untouched.
5. EDIT: every package's kind (WIP, SPR, FG), package code, METRC tag, grams, farm and location are boxes in one table with one Note; Save writes each changed field as its own UPDATE and change-log line under "reconcile edit: <note>" (a field absent from the post is unchanged; a tag lands upper-cased; a package may move only to another drying location); a save that changes nothing refuses "Nothing changed; the ledger stands as it was."; no note refuses.
6. THE NOTE ON THE QUEUE, NO FILE: each Purge and each saved Edit writes one reconcile_notes row (kind, location, the reason or note, a summary such as "2 fields on 1 package edited at Silo 4" or "1 package voided, 1,131.50 g, at Silo 6", the detail as JSON). Pending Data Uploads gains a "Reconciliation notes" section, one row per open note with [Acknowledge]; acknowledging stamps acknowledged_at/by with a change-log line and the row leaves the queue; the notes are not counted by, and not disposed by, Clear all pending; no CSV is cut or changed.

## What changed

- `migrations/0063_reconcile_notes.sql`: the table and its open-notes index.
- `src/ledgerloc.ts` (new): the paths, the drying locations, the notes, purgeLocation, saveLocationEdits, acknowledgeReconcileNote, the page, the queue section.
- `src/config.ts`: SYSTEM_REASON reconcile_purge, reconcile_edit, reconcile_note, reconcile_acknowledged.
- `src/index.ts`: GET /admin/reconcile-location; POST .../purge and .../edit; POST /admin/uploads/reconcile_note/:id/acknowledge; the uploads page reads the open notes and the acknowledged flash.
- `src/html.ts`: the Admin tile; pendingUploadsPage takes the notes and the flash, renders the section, and shows it even when no file pends.
- `src/theme.ts`: the editable table's boxes; `src/i18n.ts`: the words (EN, ES).
- Tests: `test/ledgerloc.test.ts` (new): the locations by METRC word, freezers last, each once, the truck never; the page (inert farm, pick, rows, note, PIN-gated purge, open-notes line, empty and unpicked states, ES); the purge (two voids, two logs under the reason, one note with its summary and detail); the four purge refusals writing nothing; the edit (three fields as three updates and three logs, the unchanged skipped, one note); the four edit refusals; the acknowledge once with its log, and the queue section (EN, ES).
- `scripts/smoke.mjs`: pin 63; the walk at the tail: the tile; the page with the inert farm and the locations; Silo 4 holding two packages; the unchanged and noteless saves refused; a two-field edit on the med lot's package (grams and tag) with its flash, its log lines old to new, and its note on the queue; a move to BARN refused, a move to Silo 6 landing (Silo 4 one fewer, Silo 6 one); the purge of Silo 6 refused without the PIN, without a reason, and at an empty location (Hang in Place), then landing under the reason with its flash, its log line, the package gone from the ledger, and its note counting the grams; three notes on the queue, the purge note acknowledged (flash, row gone, two edit notes still waiting, the acknowledgement on the log).

## Rehearsal

Headless on the smoke's state, /admin/reconcile-location?location=Silo 4 in lite and cerberus: the inert farm select on Penn North, the location select on Silo 4, "Silo 4 2" with 2,632.00 g, the Edit table with a row per package (kind, code, tag, strain, HBN, grams, farm, location), the Note box and Save changes, the Purge fold closed beneath; the Admin tiles carry the button.

## Scribe assumptions (his word owed if wrong)

- The reconcile notes are their own section on Pending Data Uploads, uncounted by and untouched by Clear all pending; they leave only by Acknowledge.
- Purge voids ledger packages alone; lots, silo loads and the METRC mirror stand (a purged package's lot keeps its load and its status).
- Edit does not touch the METRC mirror row of a package whose location changes here; the next drop re-asserts METRC's word (the Change Location setup remains the lane that writes the mirror and cuts the file).
- Every dry space but the truck counts as a drying location, Hang in Place included; the barn and the trim rooms are not offered yet ("Start with just the drying locations/freezers").
- The Admin PIN gate on /admin covers Edit; only Purge asks the PIN again, as ruled.

## Gates

- `npx tsc --noEmit`: exit 0.
- `npx vitest run`: 39 files, 738 tests passed; the same under TZ=America/New_York.
- `node --check scripts/smoke.mjs`: ok.
- From-zero smoke (SMOKE_PORT=9050): `About to apply 63 migration(s)`, `SMOKE PASS`, no 500 in the log.
- Visual pass: the page in lite and cerberus; the Admin tiles.
- Dash audit: 0 on every file below.

## Deploy (his hands; migration 0063 rides, so the three-step block)

```powershell
cd "C:\Users\DennisWallace\Documents\Claude\Projects\gripfactory Practical\app"
npx wrangler d1 execute gripfactory-lite-grip-20260914 --env grip --remote --command "SELECT 1"
npx wrangler d1 migrations apply gripfactory-lite-grip-20260914 --env grip --remote
npm run deploy:grip
```

## Sealed final check

```
npx tsc --noEmit                      exit 0
npx vitest run                        39 files, 738 tests passed
TZ=America/New_York npx vitest run    39 files, 738 tests passed
node --check scripts/smoke.mjs        ok
rm -rf .smoke-persist && SMOKE_PORT=9050 WRANGLER_SEND_METRICS=false timeout 285 npm run smoke
                                      About to apply 63 migration(s); SMOKE PASS

migrations/0063_reconcile_notes.sql   1376  698a315bc727a3b0
src/ledgerloc.ts                     23983  74361a58404880ca
src/config.ts                        53073  446c83d543987c6c
src/i18n.ts                         127624  64a6ef220627af08
src/index.ts                        115620  9e0893aed9b417a8
src/html.ts                         174310  a883179ca476dc42
src/theme.ts                        144590  d34681efef2ac44f
test/ledgerloc.test.ts               14416  21ac3cb17dbfc13b
scripts/smoke.mjs                   478244  94bef9038428fc52
dash audit: 0 on every file above
```
