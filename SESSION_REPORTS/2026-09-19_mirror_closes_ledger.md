# 2026-09-19 The Mirror Closes the Ledger, and the Ledger Folds (canon 0.30.128 and 0.30.129)

Scribe sitting, built Scribe-direct under G-2, on the LIVE floor of 0.30.123 (worker d469fd3d, migrations 0001-0060) with THE MANIFEST BUILDER (0061) and THE PHONE LOGIN (0062) pending at his hands. Two owner rulings 2026-09-19, verbatim.

The first: "How do I empty my FFZ inventory.  I passed a METRC Mirror for the licenses that material was in, now METRC is showing 0 and the ledger is full". His picks on the question tool: what happened to the material, "Sold or transferred out" (the packages were active in METRC and left the license; the re-mount marked them gone; the ledger never heard); how the ledger empties, "The mirror closes the ledger".

The second, mid-turn: "on the inventory page, make "local inventory" collapsable and make the loading defaul collapsed".

Worker-only; no migration (the new package status is a text value). From-zero pin stays 62; next free migration 0063.

## Why the ledger was full

The FFZ cube (canon 0.30.75) reads three sources: the mirror's live FFZ packages; the ledger's frozen material the mirror does not already count (items at the Blast Freezer or born of a cryo'd package, unless their tag is a live mirror FFZ package); and cryo'd packages still in the Testing Queue with no ledger item. When METRC's export no longer lists a package, the mount marks the mirror row gone, but nothing told the ledger: the cryo outputs (a ledger item each, born of a cryo'd package) kept counting, and so did any package sitting at the Blast Freezer. METRC read 0; the ledger read everything it had ever been handed.

## The law, as built

### THE MIRROR CLOSES THE LEDGER (0.30.128)

1. AFTER EVERY PACKAGES MOUNT LANDS (the one-request drop or the last round of a sliced drop), every live ledger item whose METRC tag the mirror marks gone closes: deleted_at, deleted_by (the hand that mounted), delete_reason "gone in METRC (mount <short id>)", and a record_change_log row under that reason. Every Testing Queue package whose tag the mirror marks gone leaves the queue as the new status gone (no test outcome: METRC's word, not a lab's), logged the same way.
2. WHAT IT DOES NOT TOUCH: a tag the mirror has never seen (METRC cannot speak for it); an item without a tag; a package in any status but the Testing Queue; a tag that comes back later (nothing reopens by itself).
3. THE FLASH SAYS SO: the mount flash gains "N ledger items and M queue packages closed as gone in METRC." when either count is above zero (EN, ES); the redirect carries closed and closed_packages; a round's JSON carries them too.
4. THE CUBE COUNTS A GONE TAG NOWHERE: the ledger and orphan sources exclude any tag the mirror marks gone, so the cube reads right even before a sweep runs; the live-package lists exclude the gone status like released and pasteurized.
5. THE ACT FOR HIS FLOOR: no repair. After the deploy, drop the same packages export again for each license that held the material; the mount closes every gone-tag row and the flash counts them.

### THE LEDGER FOLDS (0.30.129)

The Local inventory section on /inventory is a collapsible block like the WIP blocks (details.inv-section, data-inv-section="local"), closed when the page loads, its summary reading "Local inventory" with the item count; the empty state folds the same way. Nothing inside changed.

## What changed

- `src/config.ts`: WIP_STATUS.gone; SYSTEM_REASON.gone_in_metrc.
- `src/metrc.ts`: closeLedgerForGoneTags; the one-request mount and the last round call it for packages; mountedRedirect carries closed and closed_packages; MountRound carries them.
- `src/metrcpane.ts`: the flash's closing words with data-metrc-closed and data-metrc-closed-packages.
- `src/index.ts`: the mirror page reads the two counts from the query.
- `src/db.ts`: listFfzGrams excludes gone tags from the ledger and orphan sources; listLiveWipPackages excludes the gone status.
- `src/html.ts`: localInventorySection as a closed details block with the count.
- `src/i18n.ts`: ledger item(s), queue package(s), "closed as gone in METRC.", "and".
- Tests: `test/gone.test.ts` (new; the sweep against a D1 stand-in: two items and one queue package closed with the mount's reason and three log rows, the item close guarded on deleted_at, the package close guarded on its status; nothing written when nothing is gone; the gone status; the folded ledger block in EN and ES).
- `scripts/smoke.mjs`: the folded ledger pins on /inventory; the closing walk at the tail (the truck package's ledger item, 500 g at the Blast Freezer, live in 832's mirror; a drop of 832's packages without it: gone=1, closed=1, closed_packages=0, the flash's words and counts, the ledger page without the row, the cube's ledger side down 500 g and its mirror side unmoved, the change log under the mount's reason; a re-drop closing nothing more with an empty closing note; the mirror row kept with its gone date).

## Rehearsal

Headless on the smoke's state, /inventory in lite and cerberus: the Local inventory block loads closed with "Local inventory 19" in its summary, styled like WIP Inventory, and opens on a click.

## Scribe assumptions (his word owed if wrong)

- A package the mirror marks gone leaves the Testing Queue as gone, not as released; the other statuses are untouched.
- A tag METRC has never seen is left alone; those rows, if any, are his to void by hand or to name for a repair.
- A tag that reappears in a later mount reopens nothing by itself.
- The sweep runs on packages mounts only (a plants mount speaks for no package).

## Gates

- `npx tsc --noEmit`: exit 0.
- `npx vitest run`: 36 files, 721 tests passed; the same under TZ=America/New_York.
- `node --check scripts/smoke.mjs`: ok.
- From-zero smoke (SMOKE_PORT=9037): `About to apply 62 migration(s)`, `SMOKE PASS`, no 500 in the log.
- Visual pass: /inventory folded and unfolded in lite and cerberus.
- Dash audit: 0 on every file below.

## Deploy (his hands; the pending 0061 and 0062 ride the same block)

```powershell
cd "C:\Users\DennisWallace\Documents\Claude\Projects\gripfactory Practical\app"
npx wrangler d1 execute gripfactory-lite-grip-20260914 --env grip --remote --command "SELECT 1"
npx wrangler d1 migrations apply gripfactory-lite-grip-20260914 --env grip --remote
npm run deploy:grip
```

## Sealed final check

```
npx tsc --noEmit                      exit 0
npx vitest run                        36 files, 721 tests passed
TZ=America/New_York npx vitest run    36 files, 721 tests passed
node --check scripts/smoke.mjs        ok
rm -rf .smoke-persist && SMOKE_PORT=9037 WRANGLER_SEND_METRICS=false timeout 285 npm run smoke
                                      About to apply 62 migration(s); SMOKE PASS

src/config.ts               52062  2668cb732c0155d8
src/metrc.ts                72599  ef941f1753058276
src/metrcpane.ts            18013  af18ff120b792bb2
src/index.ts               113490  82cd7fe1465fc79a
src/db.ts                  156896  17bc75ebe98220f1
src/html.ts                173496  f32bbc4763f2d594
src/i18n.ts                122339  7e300a532d9bc7a3
test/gone.test.ts            5553  2c6b933f98eb4408
scripts/smoke.mjs          454903  0dc9de525e27676b
dash audit: 0 on every file above
```
