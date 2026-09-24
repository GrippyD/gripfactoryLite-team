# Session report: map softkeys, mock icons, and the METRC template pull, 2026-09-02

**Scribe:** Gripfactory Lite Scribe (Cowork), Scribe-direct under G-2.

## Rulings built (owner, verbatim)

"I like these icons from Claude design better than cursor's. Also, let's remove the numbers underneath, raise them slightly (make them look like rounded softkeys--slight shine) make the icons fit the buttons better."

- **Icons**: all six redrawn in src/icons.ts to the owner's Claude-design mock, one hand (stroke 3, currentColor, viewBox 64, each under 2 KB): the sprout-over-furrow-rays field, the panelled box truck, the ribbed bell silo with finial, the rising-bars-into-stack factory, the scalloped-awning storefront with a mini chart, and **balance scales replacing the piggy bank** for Business Operations (the mock's icon; the registry key renames piggy_bank to scales in icons, pipeline, and tests).
- **Numbers gone**: opsNode renders icon and label alone; the tile-count span left the map.
- **Softkeys**: all three sheets restyle .ops-node as a raised rounded key (radius 16-18) with a top sheen gradient, an inset top highlight, a hard under-edge plus drop shadow at rest, and a pressed :active state. The CO sheet's sheen rides a --key-sheen token that dims under her dark variant; Cerberus keys are steel with the gold hover ring; Lite keys keep the chunky 2px border. Icons step up to 3.4rem so they fill the keys.
- The row-two law from the gate fix stands: the down arrow drops on Production, Business Operations is the left island (the mock inherited the pre-fix live build's defect; the owner's original ruling governs).

## Also this sitting: the METRC data templates, pulled at the owner's direction

"use chrome while I'm signed into METRC and let's pull the data templates" / "That's the most direct route." All 19 Data Import (legacy) formats captured from the owner's authenticated Michigan METRC session and written to `prompts/2026-09-02_metrc_import_templates.md`: column lists and exact header rows per type. Confirmations that matter: Harvest Plants matches our shipped wet weights CSV header byte for byte; Manicure Plants adds PlantCount; Packages from Harvests is the trim lane; **no transfer or manifest CSV import exists**, so the Interco manifest export will be shaped to the Licensed Transfers form, whose field list the owner confirms before that build. The Interco deepening ruling is logged verbatim in canon (0.16.1) with its open forks.

## Sealed final check

```
cd /home/claude/deploy/app
npx tsc --noEmit                      -> exit 0
npx vitest run                        -> Test Files 11 passed (11), Tests 326 passed (326)
node --check scripts/smoke.mjs        -> ok
LC_ALL=C grep -c dashes               -> 0 on every written file
rm -rf .smoke-persist && SMOKE_PORT=8981 WRANGLER_SEND_METRICS=false timeout 280 npm run smoke
                                      -> SMOKE PASS (exit 124 is the expected dev-server timeout kill)
Visual pass: map re-rendered and read back in Cerberus, CO, Lite, and phone mode.

src/icons.ts           2856 bytes  sha256:5043fb5e82731334
src/theme.ts          95971 bytes  sha256:d87f6f4884ca71ce
src/html.ts           64508 bytes  sha256:fa210c7746d55a42
src/pipeline.ts       23614 bytes  sha256:5d175ecd91ddf5a0
test/ops.test.ts       5332 bytes  sha256:145630e3d2620ab7
prompts/2026-09-02_metrc_import_templates.md  7064 bytes  sha256:d554668c8cfaf357
```

No migrations. Worker-only deploy; ships the row-two fix and the polish together.

## Addendum, same sitting: the exact icon strip and the Business Operations swap

Two more owner rulings landed and built:

1. **"use these exact icons"** (the six-tile strip: FIELD, TRUCK, SILO, MARKET STALL, FACTORY, BALANCE SCALE). Each tile was cropped, zoomed, and redrawn faithfully in src/icons.ts: the sun-over-horizon field with five furrow rays, the plain box truck with the slanted windshield, the bell silo with finial and left-face ladder, the market stall with the wavy canopy hem, the sawtooth-into-tower factory with its small door, and the balance scale with ring finial, hanging bowls, and trumpet foot.
2. **"Also swap marketplace and business ops and add the arrow in between."** Business Operations joins the flow: row two runs Production to Business Operations to Marketplace, right to left, with a left arrow in each gap; the island and its spacer are retired; OPS_FLOW_EDGES carries five edges; the phone chain reorders Business before Marketplace. Tests updated (edges, phone order, row-two order with both arrows).

Re-gate: tsc clean, 326 tests, SMOKE PASS, dash 0, map re-rendered and read back (exact icons on the softkeys, serpentine flow correct).

```
src/icons.ts           3186 bytes  sha256:8a44dd72e1b63a4d
src/pipeline.ts       23885 bytes  sha256:c50c1b303098eef7
src/html.ts           64430 bytes  sha256:0f26b5d5fb9bb83d
test/ops.test.ts       5507 bytes  sha256:b37eb3da09923852
test/surface.test.ts  68370 bytes  sha256:204554aef934b480
```
