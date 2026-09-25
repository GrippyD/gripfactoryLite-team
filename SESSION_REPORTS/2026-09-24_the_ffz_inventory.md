# 2026-09-24 The FFZ inventory

Brief L, canon 0.30.225. The FFZ inventory cube and the Reconcile Ledger Location picker entry leave. The Blast Freezer space tile stays the freezer reading. A packages mount lands fresh-frozen packages the ledger does not already bear as finished-goods items at the Blast Freezer. No migration. The head stays 0074. Not deployed. Nothing committed.

## What landed

The FFZ inventory tile is gone from the Harvest Console drying row, the Drying Operations strip, the Load Silo strip, and `/silos/live.json` (no `ffz` key). The live script no longer paints it. The cure panes follow the last space tile. The cube helpers left `src/silo.ts`. `CUBE_GEOMETRY`, the cube shape, and the `ffz-` CSS stay, because the Blast Freezer(s) tile still draws that cube in the freezer chrome. `CONFIG_KEYS.ffz_capacity_lbs` left the code. The `app_config` row stands and nothing reads it. `ffz_item_kinds` stays, read only when a mount lands packages.

The Reconcile Ledger Location picker offers drying locations and freezers. Blast Freezer still lists its live items with Purge and Edit, and it is still a move target. `FFZ inventory` is not offered. A URL that still names it reads as no pick.

After a packages mount lands whole, `landFfzFromMirror` reads every active mirror package in grams whose Item is a fresh-frozen kind and whose tag no ledger item bears, live or closed. Each one becomes an `FG` ledger item at `Blast Freezer`: the tag, whole grams (round half up), the license, the site of that license (PNN when the license is unknown), and the strain when exactly one live strain matches the mirror's strain name. The birth is logged under `fresh frozen from the mirror` with the mount's eight. The redirect carries `landed=<n>`. When n is above 0 the flash says `<n> fresh frozen packages landed at the Blast Freezer.` A second mount of the same file lands nothing. A later mount that marks the tag gone closes the item the same way any other ledger item closes.

## Assumptions for your word

- The landed kind is FG. The mirror's own FFZ kind still shows on the FG Inventory in METRC pane.
- Grams landing here are whole (round half up). METRC keeps its own precision on the mirror row.
- A tag a closed ledger item already bears does not land again.
- A later change to the package's quantity in METRC does not move the landed grams. No ledger item's grams follow the mirror today.
- The strain match is the live strain's name, case and trim aside, and only when exactly one matches. Otherwise the item has no strain.
- `ffz_capacity_lbs` stands in `app_config` and nothing reads it.
- A package in ounces, or with a blank quantity, is skipped.
- An unknown license lands at farm PNN.

## Gates

- `npx tsc --noEmit`: exit 0.
- `npx vitest run`: 52 files, 868 tests passed. The same under `TZ=America/New_York`.
- `node --check scripts/smoke.mjs`: exit 0.
- From-zero smoke (`SMOKE_PORT=9156`, `WRANGLER_SEND_METRICS=false`): `About to apply 74 migration(s)`, `SMOKE PASS`, ` 500 ` lines: 0, exit 0. The FFZ package mount redirected with `landed=1`, the Blast Freezer entry listed the tag at 1500 g, the picker had no FFZ inventory, and the second mount of that file redirected with `landed=0`.
- Dash audit: 0 on the files below (U+2014 and U+2013).
- `METRC_INTEGRATOR_KEY = "` and `METRC_USER_KEY = "` appear in no file under `src`, `test`, `scripts`, or `wrangler.toml`.

## Deploy

Not deployed from this session. No migration rides. The head stays 0074 and the next free number stays 0075. The Scribe hands the worker-only line.

## Sealed final check

```
npx tsc --noEmit                      exit 0
npx vitest run                        52 files, 868 tests passed
TZ=America/New_York npx vitest run    52 files, 868 tests passed
node --check scripts/smoke.mjs        exit 0
SMOKE_PORT=9156 WRANGLER_SEND_METRICS=false node scripts/smoke.mjs
                                      About to apply 74 migration(s); SMOKE PASS; " 500 " lines: 0; exit 0

src/silo.ts                       37070  8caed650cee93036  tail: }
src/console.ts                   100101  713625891cd05991  tail: }
src/index.ts                     135456  aa8dcf947181b27a  tail: export default worker;
src/db.ts                        162809  9d6fb24ed37257c8  tail: }
src/ledgerloc.ts                  24845  669d1293acb2e35c  tail: }
src/metrc.ts                      85766  1d79d9e6cab8a25c  tail: }
src/config.ts                     66804  c9bcb3ed13ac48ca  tail: }
src/i18n.ts                      164943  3285a71cfcb09a1d  tail: }
src/metrcpane.ts                  18906  83c94fce05e2a986  tail: }
test/silo.test.ts                 29234  4cfcf0c22741454c  tail: });
test/console.test.ts              55498  678a1caeedf2a48f  tail: });
test/farmday.test.ts              17326  997316ebb7b3d9c4  tail: });
test/ledgerloc.test.ts            14773  d7340a2deb3782d4  tail: });
test/ffzland.test.ts               7397  dd2f9d9da36dbf97  tail: });
scripts/smoke.mjs                573535  490e27cb277245dd  tail: });
```
