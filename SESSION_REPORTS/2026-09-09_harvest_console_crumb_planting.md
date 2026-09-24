# Session report: the Continuum crumb on the Harvest Console screen (canon 0.30.32) and Harvest Console Lite v0.12 with Planting Date and Rate (canon 0.30.33), Scribe-direct, 2026-09-09

**Scribe:** Gripfactory Lite Scribe (Cowork), Scribe-direct under G-2. Two owner messages after the 97fa4060 deploy; one slice for our repo (worker only, no migration) plus one version of the Harvest Console Lite app in its own folder.

## The messages, verbatim

- 0.30.32: "Add "back to continuum" link to the harvest console lite screen"
- 0.30.33: "Add to the data model in the harvest console:  Planting Date  Planting Rate/day (plants)  Put these near the bottom and assume we plant to capacity (the field won't go over)."

## 0.30.32, the crumb on the app's screen

The page is the app alone since 0.30.30, so the crumb rides the app's own header bar: `&#8592; Back to the Continuum 10`, the same words, arrow and destination as the sibling Continuum pages, spliced at serve time right of the brand block and before the spacer that pushes the zoom and language pills to the far side, styled through the skin (muted, a hairline divider on its left, amber on hover). `skinHarvestConsole` now makes two splices, the skin before `</head>` and the crumb before the header's first spacer; a document without the header bar takes the skin alone. The vendored file on disk is untouched by this.

## 0.30.33, Harvest Console Lite v0.12

The change belongs to the app, and the app is the owner's other project (Harvest Console Lite, its own folder, its own constitution in `SCRIBE-BOOTSTRAP-LITE.md`, connected to this session). Its file had reached v0.11 with no canon in the folder, so the Scribe bootstrapped `LITE-CANON.md` there at this change and logged v0.11 as found and v0.12 as built. The vendored copy in our repo is then replaced by copy from `lite/` (vendored-pair law), never edited here.

What v0.12 does (the full ruling text and probe numbers stand in `LITE-CANON.md`):

- A PLANTING block at the bottom of the Data model, after Drying spaces: `Planting Date` (a date input) and `Planting Rate/day (plants)` (a number), with a readout: Plant to capacity, the capacity, the planting days, the day the field reaches capacity.
- THE PLANTING LAW: with a date set the field starts empty and fills by the day, farm by farm in list order, to `min(capacity, days x rate)`, never past any farm's plant count; rate 0 plants the whole field on the date; an empty date is v0.11 exactly (field full at the rail start). Harvest cuts standing plants only and completes only when every plant to capacity has been planted and cut. Flags: `Planting starts`, `Field at capacity`, and the hot `Field not at capacity at harvest` when planting finishes after the harvest starts. Field Operations shows planted per day and planted per farm. Storage seeds additively; ES strings for every new label.
- GOLDEN REGRESSION held: with no date set, v0.12 equals v0.11 on the rail (2026-08-24 to 2027-10-31, 434 days), the field at 100% at the rail start, and the identical eleven flags.

The rail itself was deliberately left alone: extending it back to the planting date would have re-based the opening inventory sell-down to the planting date and moved the fulfillment numbers. Planting done before the rail start is counted analytically on the first rail day instead.

## Sealed final check

```
cd /home/claude/deploy/app
npx tsc --noEmit                      -> exit 0
npx vitest run                        -> Test Files 19 passed (19), Tests 492 passed (492)
Dash audit (3 authored files, LITE-CANON.md, the report) -> 0 each
  (the vendored app carries seven of its own, unchanged in count from v0.11)
SMOKE_PORT=9711 WRANGLER_SEND_METRICS=false timeout 285 npm run smoke
                                      -> SMOKE PASS, "About to apply 38 migration(s)" from zero
Smoke pins: the crumb once in the app's header bar, after the brand, right before
  the spacer; the skin styles it; with the skin and the crumb lifted out the served
  page equals the vendored file byte for byte; the vendored bytes carry no external
  src, href, fetch or XMLHttpRequest, and the crumb is the screen's only outbound
  link; the v0.x title regex; /harvest-console/app 302.
  (Two of my own pins caught on the way: id= and class= both end in crumb", so the
  count pins name the id; and the crumb's own href tripped the no-external-requests
  law until that law was pointed at the lifted vendored bytes.)
Unit pins: routing.test.ts (the crumb string shares CONTINUUM_HOME_URL and the
  sibling pages' words; splice once inside the header before its spacer, the main's
  own spacer untouched, both splices lifted out give the original; no header, no
  crumb, skin still lands).
Headless probes of v0.12 (chromium, file://): golden regression equal to v0.11;
  5,000/day from 2026-06-01 fills 101,411 in 21 days (full 2026-06-21); from
  2026-08-20 the field stands 24.65% on 2026-08-24, 91.64% on the harvest start
  (95,000 planted, 2,069 cut), full 2026-09-09, hot flag 2026-09-07; rate 0 from
  2026-08-30 is 0% on the 29th and 100% on the 30th; 1,000/day from the harvest
  start never fires Harvest complete early and ends Harvest incomplete; 30,000/day
  fills Farm 1, Farm 2, Farm 3 in order to exactly 101,411; inputs save, reload,
  and an old blob seeds the two keys; ES label renders. No page errors.
Visual pass (wrangler dev on the smoke DB): the hosted v0.12 wears the skin with
  the crumb beside the brand; the Planting block sits at the bottom of the Data
  model with its readout; Field Operations on 2026-09-01 reads 65,000 planted,
  64%, Farm 1 full, Farm 2 filling, Farm 3 empty.

src/equipment.ts 485211dfe2e1be19     test/routing.test.ts 0e7fc40306f56797
scripts/smoke.mjs e55864493ab52f6a
public/harvest-console/harvest-console-lite.html cbe1b67f20483347a8ad5409c86c310b92e3ed69f96d002f7e58e6685a9fe3f3 (91,954 bytes, v0.12, equal to lite/)
Harvest Console Lite/LITE-CANON.md baa732fea2c6133d (new)
```

Worker only, no migration; the standing block's apply step applies nothing. Live underneath: worker 97fa4060, migrations 0001-0038. Owed from the owner: this deploy's version id; his re-walk; the true-zero after-counts; the 0.30.19 R2 picture if the Load Silo pane still misleads; a real Zoho export mounted live; the Athena logo; T1 Transport vs T1 Logistics; the METRC templates.
