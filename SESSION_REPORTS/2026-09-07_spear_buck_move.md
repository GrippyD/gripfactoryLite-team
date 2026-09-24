# Session report: the spear/buck toggle moves to wet weight entry (canon 0.29.3), Scribe-direct, 2026-09-07

**Scribe:** Gripfactory Lite Scribe (Cowork), Scribe-direct under G-2. Owner ruling 2026-09-07 (canon 0.29.1, verbatim): "we're just going to move the spear/buck toggle to the wet weight entry screen. Dry weight can keep the 'on site' question only for Spears that aren't at North".

## The law as built

1. **Migration 0032 (append-only):** `wet_weight_entries.material_form TEXT NOT NULL DEFAULT 'spear'`, backfilled to `bucked` for every lot whose actual space is a silo (the silo law has always minted WIP; history now says so on the record).
2. **The wet weight entry screen** carries the toggle: a new `radio` field kind in the pipeline registry (registry stays data), `material_form` on the wet_weight station with Spear checked, one tap. A silo Move To overrides to bucked at create, matching the backfill; a garbage value refuses "Pick Spear or Bucked."; an absent field takes the spear default. The lot panel shows a Material line; the reasoned pencil can fix the value (spear or bucked only; an edit posted WITHOUT the field leaves the column unchanged so older floor forms keep working across the deploy boundary).
3. **The truck receive stops asking.** The 0.28.8 radios left the arrivals line; the line now shows the lot's form beside the one Receive button, and the mint reads the lot: spear mints SPR, bucked mints WIP, into the destination barn under the arrival license (0.28.6 inbox law untouched).
4. **The unload (dry weight) station** derives its mode from the lot: the weigh radios, the 0.24.1 radio-lock law, and the mode-carry script all retired. A Material line rides the session header. The bucked-on-site question renders only for SPEAR material AWAY FROM NORTH: `materialAtNorth(itemLocation, batchFarm)` in config lets the minted item's location decide when it resolves to a grow site (a truck-received lot lives at its destination) and falls back to the batch farm; at North the answer is implied yes, the question never renders, and the finish never requires it. The no-path (bucked elsewhere, Truck # required) still stages its movement for spears away from North. Sessions store the derived mode at finish, so the downstream CSV reads (`weigh_mode = 'bucked'`) stay correct.

## Sealed final check

```
cd /home/claude/deploy/app
npx tsc --noEmit                      -> exit 0
npx vitest run                        -> Test Files 16 passed (16), Tests 430 passed (430)
node --check scripts/smoke.mjs        -> ok
Dash audit (13 touched files)         -> 0
rm -rf .smoke-persist && SMOKE_PORT=9301 WRANGLER_SEND_METRICS=false timeout 280 npm run smoke
                                      -> SMOKE PASS, "About to apply 32 migration(s)" from zero
Smoke walks: the wet header carries the toggle (spear checked) and refuses a
  garbage value; the arrivals lines read Spear and Bucked with NO radios; the
  receive posts no field and mints SPR (spear walk) and WIP (bucked walk) from
  the lot; the ARL spear unload asks bucked-on-site immediately and the no-path
  still stages its truck-77 movement; the bucked lot never asks; the silo lot
  never asks; a Move To edit without material_form stays 303 and a garbage
  material_form edit 400s before any write.
Unit pins: materialAtNorth matrix; the radio field render (spear checked); the
  unload panel Material line, no-radio, and ask-only-when-told laws; the
  arrivals line form text; the wet station field registry (radio, spear default).

migrations/0032_material_form.sql 869a9f34d71e29d0   src/actions.ts  2b6ce5eb8463980b
src/config.ts  b3da6d1dab6b2db5   src/db.ts       91d7781c348bdf70
src/html.ts    f0d35e3ee95274f7   src/index.ts    f4a68d4c5397371e
src/i18n.ts    cd91c73d6f023e69   src/pipeline.ts 59e5e71bcab40ad2
test/routing.test.ts 91b897905392c733  test/strapin.test.ts 13a107d9ab504af5
test/surface.test.ts 96b741061ff001d1  test/walk.test.ts    df23eaa3463347d9
scripts/smoke.mjs    d36c8aad4d586b5e
```

## Notes for the owner's red pen

The wet FINISH mint keeps the space law (hang mints SPR, silo mints WIP, truck mints nothing until receipt); the ruling moved the toggle, not that law. The deploy record for 0.29.0 (worker 090416aa) folded with one transient 7403 on the D1 query endpoint during the 0031 apply; the 0032 apply below re-runs the lane and applies whatever the blip left behind. Worker plus one append-only migration (0032). Never c10 deploy. TBD ids stay TBD.
