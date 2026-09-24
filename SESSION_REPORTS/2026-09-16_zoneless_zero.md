# 2026-09-16 The zoneless zero (canon 0.30.104)

Scribe sitting, built Scribe-direct under G-2. Owner, 2026-09-16, with a picture of Silo 4 (LOADED 2026-09-15 01:00 the clock's zero; CLOCK 1d 20:27:54 Running; his system clock 5:27 PM 9/16/2026), verbatim: "Look at the timestamp edit and the bottom left of the screenshot for my system time.  Is this a me thing or a system thing?" and then: "well, how do I fix it?  If I wanted to go into it, would I use the wrong date?  Why wouldn't it just match the system timezone?" Worker-only deploy; no migration.

## What was wrong

The Load Silo pencil (EDITABLE_FIELDS.silo_loads, loaded_at) was a free-text box labeled "ISO UTC" and editRecord stored whatever was typed. A date-time without a zone is two instants: the browser reads it as local time (so the LOADED line, rendered through localTimeScript, printed 2026-09-15 01:00 back as typed) and the Worker reads it as UTC (so clockZeroMs fed the clock a start four hours earlier in Eastern terms). The two readers of one column split by the Eastern offset and the clock ran four hours long. A label's format promise is not validation.

## The law, as built

1. A stored instant that a pencil takes is a FARM-TIME field (EditFieldDef.farmTime). It shows the stored instant as the Eastern wall clock (YYYY-MM-DD HH:MM) and takes the same shape back.
2. The server parses what is typed through farmInstantFromInput: a wall clock without a zone (YYYY-MM-DD HH:MM, a space or a T between, seconds ignored) is Eastern and resolves through etInstant; an instant carrying its zone (Z or an offset) stands as it is; any other shape refuses in words ("Loaded at must be a farm-time date and time, YYYY-MM-DD HH:MM."), as does a blank ("Loaded at is required.") and a time ahead of now by more than ten minutes ("Loaded at is ahead of now."). Nothing zoneless is ever stored again. The edit logs old and new instants under the typed reason like every other pencil.
3. The silo load pencil is the first farm-time field. Its label reads "Loaded at (farm time, YYYY-MM-DD HH:MM, the clock's zero)". A zoneless value already stored (Silo 4) shows in the box as the wall clock of the instant the Worker is actually running the clock from, so the box tells the truth about the zero and the owner types the wall clock he meant.
4. The Load Silo form itself was never wrong: its Start time already resolved in farm time through resolveLoadedAt and etInstant and stored the instant with its Z.

## What changed

- `src/farmday.ts`: `etWallClock(iso)` (the Eastern wall clock of an instant, "YYYY-MM-DD HH:MM") and `farmInstantFromInput(raw)` (the parser above, null on any shape the farm does not accept).
- `src/pipeline.ts`: `EditFieldDef.farmTime`; the silo_loads loaded_at field carries it with the new label.
- `src/pages.ts`: editInput renders a farm-time field with the Eastern wall clock as its value, the YYYY-MM-DD HH:MM placeholder and data-farm-time.
- `src/actions.ts`: editRecord's farm-time branch (required, parsed, ahead-of-now refused, the instant stored).
- `test/effective.test.ts`: THE ZONELESS ZERO block, five tests (the wall clock with a space or a T and seconds ignored, standard time in January; zoned instants stand; every bad shape null; the wall clock reads back and round-trips; the pencil field, its label, its value and no ISO UTC). The suite passes under TZ=UTC and TZ=America/New_York alike.
- `scripts/smoke.mjs`: after the Load Silo walk, the pencil page shows the clock's zero as farm time and never asks for ISO UTC; a farm-time post lands as the Eastern instant on the LOADED line and as the clock's data-started; the change log carries both instants; a non-time, a zero ahead of now and a blank refuse 400 in their words; an instant with its zone stores as it stands and restores the walk's zero.

## Owner's correction (his hands, after the deploy)

Open Silo 4's load, the pencil, and type the wall clock he meant in Eastern (1:00 AM on the 15th is `2026-09-15 01:00`; 9:00 PM on the 14th is `2026-09-14 21:00`), with a reason. The LOADED line and the clock will then agree. Silo 5 the same way if its zero went in through the old box.

## Gates

- `npx tsc --noEmit`: exit 0.
- `npx vitest run`: 31 files, 665 tests passed (and again under TZ=America/New_York).
- `node --check scripts/smoke.mjs`: ok.
- From-zero smoke (SMOKE_PORT=8987): `About to apply 56 migration(s)`, `SMOKE PASS`, the pencil walk inside it (GET 200, farm-time POST 303, three refusals 400, the restoring POST 303).
- Visual pass: the silo load pencil page through editPage and themeStylesheet in cerberus, the box reading 2026-09-15 01:00 for a stored 2026-09-15T05:00:00.000Z.
- Dash audit: 0 on every file below.

## Deploy (his hands, worker only)

From `app/`: `npm run deploy:grip`. No migration.

## Sealed final check

```
npx tsc --noEmit                      exit 0
npx vitest run                        31 files, 665 tests passed
TZ=America/New_York npx vitest run    31 files, 665 tests passed
node --check scripts/smoke.mjs        ok
rm -rf .smoke-persist && SMOKE_PORT=8987 WRANGLER_SEND_METRICS=false timeout 285 npm run smoke
                                      About to apply 56 migration(s); SMOKE PASS

src/farmday.ts                5511  f7aedeaac752a2cd
src/pipeline.ts              47543  456ffa93cd70a6b6
src/pages.ts                 21923  dc73b9be44649cd9
src/actions.ts              245255  bfe260587bb323d3
test/effective.test.ts       14049  a59a5b988474d796
scripts/smoke.mjs           410791  3009662b7b3170e9
dash audit: 0 on every file above
```
