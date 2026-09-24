# Session report: occupied silos refuse more product (canon 0.30.19 intake, 0.30.20 build), Scribe-direct, 2026-09-08

**Scribe:** Gripfactory Lite Scribe (Cowork), Scribe-direct under G-2. Two rulings landed in one message after the 0.30.18 slice; both are logged verbatim in the 0.30.19 row. The first is built here. The second is held as a fork with a question back to the owner (below). Worker only; no migration.

## The rulings, verbatim

- R1 "occupied silos should not accept more product"
- R2 "Also, these aren't in barn so they shouldn't be on this screen.  We dropped all dry spaces in favor of barn"

## What shipped (R1)

1. **One load per silo.** `getOpenSiloLoadForSilo` (db.ts) finds the open load occupying a silo (not ended, not voided). `loadSilo` refuses an occupied silo in words: "Silo 4 is occupied by lot 26009. Unload it first." (400). The unload finish still ends the load, which frees the silo, as 0.30.6 built it.
2. **The form offers only empty silos.** On the Load Silo working pane the silo select lists every silo, but an occupied one is greyed (`disabled data-occupied`) and names its occupant: "Silo 4 (occupied: 26009)". The lot's planned silo preselects only when it is empty. When every silo is occupied the pane says so ("Every silo is occupied. Unload one first.", `data-silos-full`) and the Load silo button waits.

## R2, held: the Scribe's finding and the question

By the code, the Load Silo left pane lists exactly the drying lots whose born package sits at BARN (the PNN barn) in the ledger, and nothing else: `listBarnWetLots` joins the lot's live inventory item on `location = 'BARN'` and filters `status = 'drying'`. A rolling truck lot is `in_transit` and absent; a loaded lot's item moves to the silo name and leaves the pane; a Hang in Place lot moves to that location at finish and never appears; a lot whose unload finished is `unloaded` and absent. In the smoke database the pane holds three lots, all ARL truck lots received at PNN (two of them spear material), plus any PNN silo lot waiting for its load. So if lots are showing that are not in the barn, the ledger has them at BARN, and the Scribe needs to see which lots to find the path that put them there (the receive lanes are the likely one) or to learn the rule the owner means by "dropped all dry spaces in favor of barn" (the Move To catalog: hang rooms and Hang in Place retire, every lot lands in its farm barn; silos are chosen at Load Silo; trucks stay). Nothing builds on R2 until his screenshot or word.

## Sealed final check

```
cd /home/claude/deploy/app
npx tsc --noEmit                      -> exit 0
npx vitest run                        -> Test Files 19 passed (19), Tests 482 passed (482)
Dash audit (7 touched text files)     -> 0
SMOKE_PORT=9584 WRANGLER_SEND_METRICS=false timeout 285 npm run smoke
                                      -> SMOKE PASS, "About to apply 38 migration(s)" from zero
Smoke walk added: a second PNN lot (AU-G-C-000832, planned Silo 4) finishes into
  the barn; its load form greys Silo 4 with the occupant and does not preselect
  it; a hand-built post at Silo 4 400s "Silo 4 is occupied by lot"; Silo 1
  takes it; the strip shows two loads in two silos.
Unit pins: drying.test.ts (the greyed option with its occupant, no preselect on
  an occupied planned silo, an ended load frees its silo, all five occupied
  greys every option with the banner and a waiting button).

src/db.ts 5b10044124c6ac5a        src/actions.ts d6aacb8939646875
src/drying.ts a588f9f8dfd8ed7a    src/i18n.ts 0017c5ccbc9871c3
src/theme.ts adeef39b4312fc49     test/drying.test.ts d21cc06c435a940c
scripts/smoke.mjs f9391ad98ccb4d75
```

Worker only (rides the pending 0.30.18 deploy: worker plus migration 0038). Never c10 deploy. Owed from the owner: the R2 screenshot or word; his deploy id; a real Zoho export mounted live; the Athena and T1 Logistics logo files; the METRC templates; the harvest purge counts or the narrowing word.
