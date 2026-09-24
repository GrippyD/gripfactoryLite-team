# 2026-09-20 The FFZ Inventory Location (canon 0.30.145)

Scribe sitting, built Scribe-direct under G-2, on the LIVE floor of 0.30.142 (worker 106d056c, migrations 0001-0063). Worker-only; no migration; from-zero pin stays 63; next free migration 0064. Owner ruling 2026-09-20, verbatim: "include FFZ inventory as one of the purge-able ledger locations".

## The law, as built

### THE FFZ INVENTORY LOCATION (0.30.145)

1. THE ENTRY: the Reconcile Ledger Location picker ends with "FFZ inventory (Blast Freezer and every cryo'd package)". It is not a METRC location but a reading: the ledger's fresh frozen set exactly as the FFZ cube reads it out of the ledger (canon 0.30.75's ledger share, the mirror aside): every live ledger package at the Blast Freezer, and every live ledger package born of a cryo'd package (a wip_packages row carrying a cryo weight: a trim container that went through cryo, or a cryo run's output), wherever it sits.
2. THE PAGE: picking it shows the set with a line saying what it gathers; each row shows its own location in its location select. Purge voids every package in the set under a typed reason and the Admin PIN, each with its change-log line, and writes one note ("N packages voided, X g, at FFZ inventory") that stands on Pending Data Uploads until acknowledged. Edit works per package as at any location under one note.
3. THE ONE REFUSAL: a package can never be moved to FFZ inventory (it is a reading, not a place): the move targets in every row's select are the drying locations and freezers alone, and a hand-built post answers "A package can only move to a drying location."
4. THE CUBE FOLLOWS: a purged package leaves the FFZ cube's ledger share. For that to hold for cryo'd packages still in the Testing Queue, the cube's third clause (the cryo weight of a cryo'd package with no live ledger item, meant for the packages from before the ledger followed the trim) now reads "never had a ledger item" rather than "has no live ledger item", so a voided or purged item does not bring its package back as an orphan. The mirror's share is METRC's word and stands through any ledger purge.

## What changed

- `src/db.ts`: FFZ_LEDGER_CLAUSE and the `ffz` filter on listLocalInventory; listFfzGrams' orphan clause reads any ledger item, live or voided.
- `src/ledgerloc.ts`: FFZ_INVENTORY_LOCATION, FFZ_LOCATION_KIND, isFfzInventory, ffzInventoryLocation, listReconcileLocations (the drying locations then the FFZ entry), listReconcileItems; purge and edit read through them; the page's explanation line, its empty-set words, its purge words and the move targets without the FFZ entry.
- `src/index.ts`: the page handler reads listReconcileLocations and listReconcileItems.
- `src/i18n.ts`: the four new strings, EN and ES.
- Tests: `test/ledgerloc.test.ts` (4 new tests: the entry and the reading; the purge of the set wherever it sits and its note; the edit and the refused move into the reading; the page in EN and ES).
- `scripts/smoke.mjs`: at the tail: the picker's last entry; the FFZ reading gathers every Blast Freezer package; no row offers FFZ inventory as a move target; a move into it answers 400 in words; the purge voids the set with its count, the reading and the Blast Freezer read empty, the cube's ledger share reads 0 while the mirror's share stands, the note names FFZ inventory, the change log carries the reason.

## Scribe assumptions (his word owed if wrong)

- FFZ inventory is the ledger's set as the cube reads it (Blast Freezer plus cryo-born), not the METRC mirror's FFZ packages; the mirror is METRC's word and no ledger act touches it.
- A cryo'd package whose ledger item is purged leaves the cube for good (the orphan clause change); a legacy cryo'd package that never had a ledger item still counts, as before.
- The purge voids ledger items only: the lots, the loads, the cryo runs and the wip_packages rows stand as records.
- The entry stands last on the picker and its value is the words "FFZ inventory"; a real METRC location of that exact name would be read as the set (none exists).
- At the smoke's tail every cryo-born package already sits in the freezer or has left the ledger, so the reading equals the freezer's set there; the unit tests pin the cryo-born gathering.

## Gates

- `npx tsc --noEmit`: exit 0.
- `npx vitest run`: 41 files, 752 tests passed; the same under TZ=America/New_York.
- `node --check scripts/smoke.mjs`: ok.
- From-zero smoke (SMOKE_PORT=9057): `About to apply 63 migration(s)`, `SMOKE PASS`, no 500 in the log.
- Dash audit: 0 on every file below.

## Deploy (his hands; worker only, no new migration, the apply is idempotent)

```powershell
cd "C:\Users\DennisWallace\Documents\Claude\Projects\gripfactory Practical\app"
npx wrangler d1 execute gripfactory-lite-grip-20260914 --env grip --remote --command "SELECT 1"
npx wrangler d1 migrations apply gripfactory-lite-grip-20260914 --env grip --remote
npm run deploy:grip
```

## Sealed final check

```
npx tsc --noEmit                      exit 0
npx vitest run                        41 files, 752 tests passed
TZ=America/New_York npx vitest run    41 files, 752 tests passed
node --check scripts/smoke.mjs        ok
rm -rf .smoke-persist && SMOKE_PORT=9057 WRANGLER_SEND_METRICS=false timeout 285 npm run smoke
                                      About to apply 63 migration(s); SMOKE PASS; " 500 " lines: 0

src/db.ts                  158607  0c6a80e9a1cd8243
src/ledgerloc.ts            27175  541b0a44a9c827ef
src/index.ts               117482  97e3c56f2462fc53
src/i18n.ts                129351  6e6f678a60aee912
test/ledgerloc.test.ts      22179  6caa84171389dd3e
scripts/smoke.mjs          489779  271b366e1ae20331
dash audit: 0 on every file above
```
