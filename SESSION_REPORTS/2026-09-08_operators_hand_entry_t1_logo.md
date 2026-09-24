# Session report: operators back to hand entry (canon 0.30.21) and the T1 mark (canon 0.30.22), Scribe-direct, 2026-09-08

**Scribe:** Gripfactory Lite Scribe (Cowork), Scribe-direct under G-2. Two owner messages, one slice, worker only, no migration.

## The rulings, verbatim

- 0.30.21 "The operator dropdowns don't need to have the maintenance crew on every single one, that was just for the PM portion"
- 0.30.22 "For T1" (with the T1 Transport logo file)

## What shipped

1. **The sign-off names are the PM system's alone.** The 0.30.12 reading ("Replace all the hand sign offs...") swept every operator field into a dropdown of Kieth, Les and Austin. The owner scopes it: that was for the Preventive Maintenance portion only. So the Trim operator and the Cryo operator (station fields and the record pencil), the Unload Dry Space session operator, and the pick's Picked by and Fulfilled by are hand entry again, exactly as 0.30.9 R7 asked ("the hand entry of the operator filling in the data"). Trim, Cryo, Picked by and Fulfilled by stay required; the unload session operator stays optional. Any typed name saves; the server no longer checks a list on those fields. The Preventive Maintenance signatures (PM done, ticket open, ticket close) keep the sign-off names with Kieth preselected on the RTUs, and Admin, Data Lookups, People and System, Sign-off names stays as their home. `requireSignOff` and `optionalSignOff` remain for the PM; the 0.30.12 comment on them carries the scope.
2. **The T1 mark.** `public/continuum/logo-t1-logistics.png` (1569x629 PNG, 504,652 bytes, sha256 3606d1c9a8a17847, byte-identical to the file supplied) leads the T1 card on the Strategic Partners page through `PARTNERS[].logo`; Athena's wordmark is the last one holding. One note for the owner: the mark reads T1 Transport and the card is named T1 Logistics (alt text and copy); the card's name follows on his word.

## Sealed final check

```
cd /home/claude/deploy/app
npx tsc --noEmit                      -> exit 0
npx vitest run                        -> Test Files 19 passed (19), Tests 482 passed (482)
Dash audit (11 touched text files)    -> 0
SMOKE_PORT=9587 WRANGLER_SEND_METRICS=false timeout 285 npm run smoke
                                      -> SMOKE PASS, "About to apply 38 migration(s)" from zero
Smoke pins changed: the Trim operator is a typed required field, not a select;
  the pencil carries the saved operator as a typed value; the cryo record too;
  the unload session operator is a typed field and "Smoke Op" saves and shows;
  the pick's Picked by is a typed field, a blank signer 400s, Les and Austin
  still type in and show; the PM asset page still signs with the select and
  the RTU still starts on Kieth (unchanged pins); the T1 card carries its logo,
  /continuum/logo-t1-logistics.png serves 200 as image/png, one wordmark left.
Unit pins: trim.test.ts (the fields are text with no lookup; the Trim form is
  a typed input; the PM pins unchanged), gate.test.ts (any typed operator
  saves; the blank still refuses), fulfillment.test.ts (typed signed_by),
  routing.test.ts (the T1 img, one wordmark).
Visual pass (wrangler dev on the smoke database): the inverted Strategic
  Partners grid with VIST, Twister and T1 marks leading their cards and Athena
  as the wordmark.

src/actions.ts 8e8cf5540d6a0c6e      src/pipeline.ts e8d3f08085da7a49
src/html.ts 337e7add1e8295c7         src/index.ts 8da532c8579f14a4
src/fulfillment.ts 75dc421152dea05c  src/equipment.ts 1ac5f3bfe5f2110f
test/trim.test.ts 1ace1de27ec857ab   test/gate.test.ts 53499e3acc369dae
test/fulfillment.test.ts 9c55029f91ac2e1d   test/routing.test.ts bd52828b3c2221a0
scripts/smoke.mjs f32c062d134b7e4d
public/continuum/logo-t1-logistics.png 3606d1c9a8a17847 (as supplied)
```

Worker only; rides the pending deploy (worker plus migration 0038 from 0.30.18). Never c10 deploy. Owed from the owner: the 0.30.19 R2 picture or word (the barn pane); his deploy id; a real Zoho export mounted live; the Athena logo file; the word on T1 Transport versus T1 Logistics; the METRC templates; the harvest purge counts or the narrowing word.
