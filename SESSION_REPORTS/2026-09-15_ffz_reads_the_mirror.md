# 2026-09-15 THE FFZ CUBE READS THE MIRROR (canon 0.30.75)

Scribe-direct under G-2. Owner report 2026-09-15, verbatim: "check FFZ, we have inventory but the FFZ cube is empty", with two pictures: the FG Inventory in METRC pane reading FFZ 129,259.00 g among the kinds (MIX, BUD, Mitten Extracts, Grip, FFZ, WIP, TRI, BIO), and the console's cube at 0% FULL, FFZ 0.00 lb.

## What was wrong

The 0.30.73 cube read only the local ledger (the Blast Freezer location and cryo'd packages). His FFZ lives in the state's picture: the METRC mirror's active packages whose Item name begins FFZ (the item kind law of canon 0.30.43), which the FG pane already counts and the cube did not.

## The law now ("Any FFZ", each package once)

1. The METRC mirror's active packages (gone_at NULL) whose item kind (the Item name, or its first " - " segment) is one of the fresh frozen kinds, in grams. The kinds are data: `app_config ffz_item_kinds`, a comma list, seeded `FFZ` by migration 0050, editable in Admin, Lookups, app_config.
2. The local ledger's frozen material the mirror does not already count: items at the Blast Freezer or born of a cryo'd package, unless their METRC tag is one of those mirror packages (no double count once a frozen package is uploaded and mounted).
3. The cryo weight of a cryo'd package still in the Testing Queue with no live ledger item.

The tile says where it read: "METRC 284.97 lb in 3 packages · ledger 4.41 lb" under the fullness word; `/silos/live.json` carries `ffz.mirrorGrams`, `mirrorLb`, `mirrorPackages`, `ledgerGrams`, `ledgerLb`, and the live script repaints the line.

## What changed

- `migrations/0050_ffz_item_kinds.sql`: `app_config ffz_item_kinds` = `FFZ`.
- `src/config.ts`: `CONFIG_KEYS.ffz_item_kinds`; `parseFfzItemKinds` (uppercased, deduped, FFZ when blank).
- `src/db.ts`: `listFfzGrams(db, kinds)` returns `{ grams, mirrorGrams, ledgerGrams, mirrorPackages }` from the three reads above (the mirror predicate binds each kind as the whole name and as `KIND - %`).
- `src/silo.ts`: `FfzVisual` carries the shares; `ffzVisual(grams, cap, shares)`; `ffzSourceLine`; `ffzTile` prints it; `FfzLiveEntry` widened; `loadFfzVisual` reads both config keys and returns the kinds; the live script repaints the source line.
- `src/i18n.ts`: METRC, in, ledger (EN/ES). `src/theme.ts` x3: `.ffz-source`.
- `test/silo.test.ts` (+1) and `test/routing.test.ts` (+1); `scripts/smoke.mjs`: 50 migrations; a fresh frozen package mounted for AU-P-000694 (Item `FFZ - Donny Burger - PNN - O`, 1,500 g) fills the cube from the mirror (mirrorGrams 1500, one package, "METRC 3.31 lb in 1 package · ledger 0.00 lb"), the FG pane gains the FFZ kind, and the Blast Freezer move later adds the ledger's grams once beside the mirror's (the moved tag stands in the mirror as WIP, so it is not double counted).

## Gates

- `npx tsc --noEmit`: 0 errors.
- `npx vitest run`: 26 files, 600 tests passed.
- From-zero smoke: "About to apply 50 migration(s)", SMOKE PASS.
- Dash audit: 0 on every changed file.

## Deploy (his hands, with the migration)

From `app/`:

```
npx wrangler d1 execute gripfactory-lite-grip-20260914 --env grip --remote --command "SELECT 1"
npx wrangler d1 migrations apply gripfactory-lite-grip-20260914 --env grip --remote
npm run deploy:grip
```

## Sealed final check

```
migrations/0050_ffz_item_kinds.sql          677  6c90be449ff57814
src/config.ts                             36844  83ac3bdff2778315
src/db.ts                                120932  761c1f25fcf23ca3
src/silo.ts                               26639  e0cc88e4e4e19357
src/i18n.ts                              106339  4d2598da8593868b
src/theme.ts                             127790  a9ab57ed17332b9f
test/silo.test.ts                         17370  aaece303b79b9212
test/routing.test.ts                      33611  b43bf2b5ebf01ac5
scripts/smoke.mjs                        353226  dd26810678efd261
tsc: 0 errors; vitest: 26 files, 600 tests passed
smoke: About to apply 50 migration(s); SMOKE PASS
dash audit: 0 on every file above
```
