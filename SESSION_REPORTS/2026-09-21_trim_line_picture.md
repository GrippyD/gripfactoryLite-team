# 2026-09-21 The Trim Line Picture (canon 0.30.154)

Scribe sitting, built Scribe-direct under G-2, on the LIVE floor of 0.30.150 (worker 234c4737, migrations 0001-0063). Migration 0065 rides behind the still-pending 0064, so one three-step block now carries both; from-zero pin becomes 65; next free migration 0066. Owner ruling 2026-09-21, with his machine picture (a circle TRIM above a box T-0, T-0 joined left to SORTER then to MARVEL by thick ruby flow bars, MARVEL fanning down to BIO, BUD and RETRIM), verbatim: "Look at the screenshot.  This is what I want to use for the "visual" aspect of the trimming panes on the harvest dashboard.  Follow our css for the lines and background color.  The ruby colored elements are "flow" bars (like our barber/candy poles in the harvest console for continuum) keep them that width but use the green candy striping at move at the same cadence as the drying locations I would like lines running from each endpoint that converge and show the shift total (I can format something in visio if it will help)" then "Trim + BIO + WIP (after a package is moved to finished on the trim line and there's still WIP in it) = Other", "Shake + BUD = Bulk Bud", "WPR = Prepack Bud", "Total Bud = Bulk + Prepack", "BTR = Total Bud/Total Dry weight of package", "Under that we can list the hours from the sheet for that same date", "Ender the hours we can take input lbs (total lbs ran through T-0)", "Use the same "RUNNING" flash you do on the silos while there's open lots running through the time weight entry node".

His picks on the question tool: "The endpoints carry the shift's grams (Recommended)"; RUNNING is "A package weighed in the last 30 minutes"; the BTR denominator is "Grams weighed that shift plus the WIP left in lots it finished (Recommended)"; the input lbs box is "Per shift, beside the DLH box (Recommended)".

## The law, as built

1. THE PICTURE: each shift card of the Harvest Console's Trimming section carries his picture in place of the waffle: TRIM (circle), T-0, SORTER, MARVEL, BIO (the tilted square), BUD, RETRIM, in his layout, the nodes in our panel and line colors and our text color through CSS. Six flow bars of his width (44 of 1000) join them; they carry the continuum tubes' green candy stripes (the same two greens, 7-wide stripes at 135 degrees on 20 by 20 tiles) and move toward the next machine at the drying locations' calm cadence, 900 ms a tile, only while the line runs; still otherwise. Lines drop from the three endpoints, meet under the picture, and hang the shift total (pounds and grams).
2. THE FIGURES ON THE MACHINES (his pick): BIO carries the BIO stream's grams; BUD the Total Bud with bulk and prepack named under it; RETRIM the rest of Other (TRIM, the WIP left in finished packages, every other type); T-0 the grams weighed and the package count; the TRIM circle the typed input pounds (or "input lbs" until typed).
3. HIS MATH, in his order under the picture: Other = TRIM + BIO + WIP left (+ MIX, KIEF, WASTE and any other type, so the total stays honest); Bulk Bud = SHAKE + BUD; Prepack Bud = WPR, which is SMALLS by his 0.30.88 pick, read from the cryo category map (app_config cryo_type_categories: the BTR-set types whose category is WPR); Total Bud = Bulk + Prepack (the BTR set, app_config btr_type_codes); BTR = Total Bud over the shift total. Then the weight ran (Lbs Produced Yesterday, the package count, and the shift total when WIP left is in it), the DLH box, Lbs/DLH.
4. THE WIP LEFT (his pick): a lot finished on the trim line within the day's window (its status log to trimmed, by Remove from queue or the adjustment choice) with its dry weight above the grams its trim containers recorded leaves the difference as WIP; it lands on Other for the shift whose operator cut the lot's last package. The shift total is the grams weighed plus the WIP left, so Total Bud + Other equals it and the converging lines add up; a lot finished over (recorded above dry) or without a dry weight leaves nothing.
5. THE HOURS FROM THE SHEET: under the lines, the day's Cutting and Bucking hours per farm (PNN, ARL, PNS; harvest_labor_hours, where THE HOURS COME BY HAND land them), "none" where nothing stands.
6. INPUT LBS (his pick): under the hours, one box per shift, "total lbs run through T-0", saved to trim_line_inputs (migration 0065) by day and shift, two decimals, a blank clearing, every change in record_change_log under `input lbs typed`; the save flashes "Input lbs saved." and returns to the day shown (the picked day rides home like the hours).
7. RUNNING (his pick): a package weighed at the trim weight entry node in the last 30 minutes (its entry instant, not its trim date, cryo outputs aside) lights the card of the shift its operator is named on: the word RUNNING pulses in the card head (the silo throb's 1.6 s ease, slowed under reduced motion, never stilled) and the picture's stripes move. A recent package by an operator on neither shift lights a RUNNING note under the cards. The flash reads the present whatever day the console shows.

## What changed

- `migrations/0065_trim_line_inputs.sql`: trim_line_inputs (id, work_date, shift, lbs, the stamps; UNIQUE (work_date, shift)) and its date index.
- `src/config.ts`: HARVEST_TRIM_INPUT_PATH (/harvest/trim-input); SYSTEM_REASON.trim_input_lbs.
- `src/console.ts`: TrimInput gains prepackCodes, finishedLots, inputLbs, recent; TrimShiftFigures gains bulkGrams, prepackGrams, bioGrams, trimGrams, restGrams, wipLeftGrams, finishedLots, totalGrams, inputLbs, running; TrimFigures gains unassignedRunning; prepackCodesOf; trimFigures does his math; trimLinePicture (the SVG, patterns with SMIL animate elements only while running), TRIM_LINE_BAR_WIDTH 44, TRIM_LINE_FLOW_MS 900, TRIM_RUNNING_MINUTES 30; trimShiftCard rebuilt (picture, his lines, the sheet hours line, the input box); trimInputBox, trimSheetHoursLine, trimLineScript (reduced motion doubles the stripes' period); the section's running note and its new footnote; the loader's four new reads (the finished lots in the window with recorded grams and last operator, the input lbs, the recent packages, the type categories) and the day's trim packages no longer counting cryo outputs; parseInputLbs, saveTrimInputLbs; the trim_input flash. trimWaffle is gone.
- `src/index.ts`: POST /harvest/trim-input behind the console's PIN.
- `src/theme.ts`: the trim line rules in the three themes (the nodes on the panel and line variables, the stripe greens #43c07a and #2a7d4f, the converging lines, the total, the RUNNING pulse and its reduced-motion slowing, the stacked card body); the waffle rules retired.
- `src/i18n.ts`: the picture's and the lines' strings, EN and ES.
- Tests: `test/console.test.ts` (his math with finished lots, over and without a dry weight; RUNNING by operator; the picture's machines, bars, widths, stripes still and moving, endpoint figures, converging total, Spanish; parseInputLbs; the section's order, lines, sheet hours, input box, running note; the flashes); `test/farmday.test.ts` (the loader's new reads on the day and the 30-minute window; the input lbs save's redirects and refusals).
- `scripts/smoke.mjs`: pin 65; the trimming pins moved from the waffle to the picture (seven machines, twelve bars, the width, the still stripes and the RUNNING note before any shift operator weighs; the endpoint figures, the total, the moving stripes and the RUNNING word once Olga and victor weigh); the input lbs walk (unknown shift 400, word 400, save 303 with its flash and the TRIM circle carrying 12.50 lb, the blank Second box, the change log under trim_line_inputs, the clear); the picked-day form count 7; Spanish on the picture.

## Scribe assumptions (his word owed if wrong)

- The picture replaces the waffle in each shift card (the waffle was the pictograph the picture now is).
- Other gathers MIX, KIEF, WASTE and any unknown type beside TRIM, BIO and the WIP left, so Total Bud + Other = the shift total.
- The stripes move only while the line runs (a package in the last 30 minutes) and stand still otherwise; the RUNNING word pulses beside the shift's name rather than inside the picture.
- The recorded grams of a finished lot count its trim containers alone (cryo outputs born later on the same lot do not shrink the WIP left).
- The WIP left lands on the shift whose operator cut the lot's last package; a lot whose last operator is on neither shift lands nowhere (named in no card), as the unassigned grams law already has it.
- The sheet hours line reads the same day's Cutting and Bucking hours per farm in both cards (they are the day's, not a shift's).
- The input lbs are stored as typed, in pounds, two decimals (the console speaks pounds there; the ledger's grams law is untouched).
- A fix found on the way: the day's trim packages exclude cryo outputs (source cryo), which carried no trim operator and would have read as unassigned grams on the console.
- The smoke exercises no under-gate finish (no lot in the run finishes with Recorded short of its dry weight), so the WIP-left share is proven in the unit tests alone; the smoke proves the rest of the picture live.

## Gates

- `npx tsc --noEmit`: exit 0.
- `npx vitest run`: 42 files, 769 tests passed; the same under TZ=America/New_York.
- `node --check scripts/smoke.mjs`: ok.
- From-zero smoke (SMOKE_PORT=9062): `About to apply 65 migration(s)`, `SMOKE PASS`, no 500 in the log.
- A rendered look (headless Chromium on the continuum stylesheet): the picture reads as his drawing with the green stripes, the endpoint figures and the converging total; the RETRIM label and value and the MARVEL label were spaced to fit after the first render.
- Dash audit: 0 on every file below.

## Deploy (his hands; migrations 0064 and 0065 ride, so the three-step block)

```powershell
cd "C:\Users\DennisWallace\Documents\Claude\Projects\gripfactory Practical\app"
npx wrangler d1 execute gripfactory-lite-grip-20260914 --env grip --remote --command "SELECT 1"
npx wrangler d1 migrations apply gripfactory-lite-grip-20260914 --env grip --remote
npm run deploy:grip
```

## Sealed final check

```
npx tsc --noEmit                      exit 0
npx vitest run                        42 files, 769 tests passed
TZ=America/New_York npx vitest run    42 files, 769 tests passed
node --check scripts/smoke.mjs        ok
rm -rf .smoke-persist && SMOKE_PORT=9062 WRANGLER_SEND_METRICS=false timeout 285 npm run smoke
                                      About to apply 65 migration(s); SMOKE PASS; " 500 " lines: 0

migrations/0065_trim_line_inputs.sql     1444  82f380891511e5b9
src/config.ts                           53864  d31560b91a2d415e
src/console.ts                          60462  387c9ffbd943718c
src/index.ts                           118355  67046ec3e34028df
src/i18n.ts                            133040  10378b9ad110c934
src/theme.ts                           148094  1552541c36105bd1
test/console.test.ts                    33666  34242a66efd356d1
test/farmday.test.ts                    17002  4d95671edf6ba075
scripts/smoke.mjs                      503075  99b8fe4e6e8e79ac
dash audit: 0 on every file above
```
