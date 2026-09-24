# 2026-09-16 THE BLAST FREEZER (canon 0.30.98)

Scribe-direct under G-2. Owner ruling 2026-09-16, verbatim:

> add the Blast Freezer to the dry operations page and allow us to use it like a "silo"

## The law

1. The Blast Freezer is a dry space of kind silo at Penn North, drawn as the 3D wire box like the Arlington Dry Room (0049). By canon 0.30.73 (a shape is data and a bridge is a law) a silo is a `dry_spaces` row, so it appears on the drying strip (Drying Operations, the console's Drying section, Inventory, live.json), in Load Silo's select for lots waiting in the PNN barn, in PNN's wet weight Move To, and at Unload, and it runs the silo clock, with no code change.
2. Its site is PNN (Scribe assumption, his word owed if it stands elsewhere): the Blast Freezer is already the PNN inventory location of canon 0.30.40 (`LOC_BLAST_FREEZER`, the 0043 lookup "the Blast Freezer is PNN at every license"), and a lot loaded into it takes that location, which is the METRC location name the location-change file carries.
3. A consequence worth naming: the FFZ cube (0.30.75) counts the Blast Freezer's ledger grams as fresh frozen, so a lot loaded into the Blast Freezer as a silo reads on the cube. That is the correct meaning (material in the blast freezer is being frozen), not a bug.
4. Its fill scales to `silo_capacity_wet_lbs` like every silo; a per-space capacity is a later row if he wants one.

## What changed

- `migrations/0055_blast_freezer.sql`: one `INSERT OR IGNORE` into dry_spaces (name Blast Freezer, kind silo, farm PNN, shape box; idempotent on the UNIQUE name). Append-only.
- `scripts/smoke.mjs`: the from-zero pin is 55; the silo census moves from six to seven (live.json seven silos, six empty, two boxes and five cylinders, the Blast Freezer named as a box; the Drying Operations strip seven gauges naming the Blast Freezer; the inventory screen two wire boxes; the console two wire boxes). The cylinder counts, the "box follows the cylinders" order and the FFZ cube's place after the silos all held as written.

No code change; no route change.

## Gates

- `npx tsc --noEmit`: 0 errors.
- `npx vitest run`: 30 files, 646 tests passed.
- From-zero smoke: "About to apply 55 migration(s)", SMOKE PASS.
- Dash audit: 0 on both files.

## Deploy (his hands, WITH the migrations)

Rides the next three-step deploy with 0054 (the pending queue clear): from `app/`, the probe, `npx wrangler d1 migrations apply gripfactory-lite-grip-20260914 --env grip --remote`, `npm run deploy:grip`.

## Sealed final check

```
migrations/0055_blast_freezer.sql     1129  70e2ab2151a9d9e7
scripts/smoke.mjs                  392906  d7a966d834f46929
tsc: 0 errors; vitest: 30 files, 646 tests passed
smoke: About to apply 55 migration(s); SMOKE PASS
dash audit: 0 on both files; sha256 identical on the device for both
```
