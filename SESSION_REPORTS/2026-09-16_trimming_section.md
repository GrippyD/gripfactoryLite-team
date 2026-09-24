# 2026-09-16 THE TRIMMING SECTION (canon 0.30.88)

Scribe-direct under G-2. Owner ruling 2026-09-16, verbatim:

> in the harvest console (not the continuum one) let's work on Trimming:
>
> Day shift:
>
> Lbs Produced Yesterday
> DLH Yesterday: [numbox]
> Lbs/DLH
> BTR (BTR=(BUD+WPR+SHA)/All weight ran that shift) shown as a percentage
> BUD = [BUD+WPR+SHA]
> OTHER = All other
>
> Second Shift
> Same
>
> Display them in a visual way (graphed or something, a pictograph of some kind maybe)

His picks on the two forks (AskUserQuestion): the shifts are the operators, "Olga = Days, Victor = Afternoons"; and "WPR means SMALLS" (SHA is the app's SHAKE).

## The law

1. The Trimming section of the Harvest Console (/harvest) is built and opens by default; Pasteurization and Testing stay stubs. Two cards in his order, Day shift and Second Shift, each for yesterday (the farm's day, Eastern).
2. Yesterday's material is the trim room's packages (Trim Packages Entry, wip_packages) dated yesterday by their typed trim date (a row without one by its entry instant), non-voided. A package lands on the shift whose operator list names its typed trim operator, case-insensitive. The lists are values in data: app_config `trim_shift_day_operators` (seeded Olga) and `trim_shift_second_operators` (seeded Victor), editable in Admin, Lookups, app_config. Grams by an operator on neither list are never dropped in silence: a line under the cards names the grams and the operators.
3. His six lines per shift: Lbs Produced Yesterday (all weight ran, pounds first, grams and the package count under); DLH Yesterday, the numbox (one number per shift per day, saved on change into `trim_labor_hours`, migration 0052, logged in record_change_log; a blank clears); Lbs/DLH (pounds per direct labor hour, "type hours" until typed); BTR as a percentage; BUD; OTHER. BUD is the weight of the package types in app_config `btr_type_codes`, seeded BUD,SMALLS,SHAKE (his BUD+WPR+SHA with his mapping); OTHER is all other; BTR is BUD over all weight ran.
4. The pictograph: a waffle of 100 cells, one per percent of the weight ran, the BUD share filled from the bottom row up in the silo green, the rest in a quiet gray, outlines when nothing ran; the BTR reads beneath it with a BUD/OTHER legend. Colors per theme were run through the dataviz palette validator against each surface (Lite #2e9e4f on #b5bab3; Continuum #2e9e4f on #7a8088; Cerberus #3ecf6b on #6f7680); the gray is the de-emphasis, so identity rides the legend, the numbers and the 2-unit gaps, never color alone.

## What changed

- `migrations/0052_trim_shifts.sql`: `trim_labor_hours` (work_date, shift, hours; unique per day and shift); app_config btr_type_codes, trim_shift_day_operators, trim_shift_second_operators.
- `src/config.ts`: the three CONFIG_KEYS; HARVEST_TRIM_HOURS_PATH (/harvest/trim-hours); `parseBtrTypeCodes`, `parseNameList`.
- `src/console.ts`: TRIM_SHIFTS, TrimInput, `trimFigures` (pure), `trimWaffle`, `trimmingSection`, the loader's trim queries, `saveTrimHours`; the page renders the built section and flashes trim hours saved.
- `src/index.ts`: POST /harvest/trim-hours behind the console's PIN.
- `src/theme.ts` x3: `.hc-shift*`, `.hc-waffle*`, `.hc-legend`, `.hc-swatch*`.
- `src/i18n.ts`: the section's strings, EN and ES.
- `test/console.test.ts` (+8): the shifts and config keys, the parsers, the figures (case-blind operators, BUD set, BTR, Lbs/DLH, the unassigned grams), the empty case, the waffle (100 cells, bottom-up fill, clamps, outlines), the section markup, the empty and Spanish renders, the page. Two pins repinned: two stubs now, and the yesterday date appears ten times.
- `scripts/smoke.mjs`: the from-zero pin is 52 migrations; Trimming opens; both cards empty before any package dated yesterday, the seeded operators named; three trim entries dated yesterday against the unloaded ARL lot (Olga SHAKE 30 + TRIM 20; victor SMALLS 9 + WASTE 20; Les WASTE 1); Day 50 g, BTR 60.0%, BUD 30, OTHER 20, 60 cells; Second 29 g, BTR 31.0%, 31 cells; the unassigned line names Les; the DLH numbox refuses an unknown shift and word hours, saves 5 (Lbs/DLH 10.00 g/h), flashes, logs under trim_labor_hours, clears; Spanish speaks.

## Open for the owner

- WPR: the app has no package type of that name; his pick maps it to SMALLS. If the trim room ever gets a WPR type, one edit to btr_type_codes counts it.
- The day is the typed trim date, not the clock: a Second Shift entry typed after midnight lands on the next day. His word if he wants a cutover hour instead.
- The pictograph is the waffle; his eye on it, and his word if he pictured a bar or something else.

## Gates

- `npx tsc --noEmit`: 0 errors.
- `npx vitest run`: 29 files, 635 tests passed (with THE FOUR START TAPS, 0.30.89, built in the same pass).
- From-zero smoke: "About to apply 52 migration(s)", SMOKE PASS.
- Dash audit: 0 on every changed file.
- Visual pass: the section in Lite, Cerberus and Continuum with a 67.9% Day shift, a 44.4% Second Shift without hours, and the unassigned line.

## Deploy (his hands, WITH the migration)

From `app/`:

```
npx wrangler d1 execute gripfactory-lite-grip-20260914 --env grip --remote --command "SELECT 1"
npx wrangler d1 migrations apply gripfactory-lite-grip-20260914 --env grip --remote
npm run deploy:grip
```

Ships together with THE FOUR START TAPS (0.30.89), which shares src/config.ts, src/index.ts, src/i18n.ts and scripts/smoke.mjs; the hashes below are the shipped files.

## Sealed final check

```
migrations/0052_trim_shifts.sql     2027  948829c2e5e0a992
src/config.ts                      41630  23383e284fd35d80
src/console.ts                     36743  37fd13fb979ff136
src/index.ts                      112748  7ca2ec852ce65796
src/i18n.ts                       109297  dda70a65f2d90c37
src/theme.ts                      136145  a8aceaf41a06b03d
test/console.test.ts               23513  52783e85306a2aca
scripts/smoke.mjs                 379860  63f26eaef3f0014f
tsc: 0 errors; vitest: 29 files, 635 tests passed
smoke: About to apply 52 migration(s); SMOKE PASS
dash audit: 0 on every file above
```
