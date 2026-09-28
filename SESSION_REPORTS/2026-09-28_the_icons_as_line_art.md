# 2026-09-28 The icons as line art

V2 of THE BRANCH PLAN (canon 0.30.282), built in the worktree `branches/GFLiteOpsDashboard`. No migration. Nothing the app serves imports the new module. Not deployed. Nothing committed. No git was run.

## What changed

`src/consoleicons.ts` draws the fourteen icons as inline SVG in one stroke (`CONSOLE_ICON_STROKE` is 3), in the view's ink (`currentColor`). `consoleIconSvg` returns the string. Nothing in `src/index.ts`, `src/console.ts`, or any other served module imports it, so the worker bundle does not change.

`test/consoleicons.test.ts` checks the shape of every string. `scripts/icon-proofs.mjs` writes `SESSION_REPORTS/2026-09-28_icon_proofs.html`. `package.json` gains `"proofs:icons"` and nothing else.

`TRAILER_CARGO` is `{ x: 60, y: 24, width: 84, height: 30 }` in the shipping icon's 160 by 100 frame. The trailer outline runs from x 54, y 20 to x 150, y 58, so the cargo rect sits inside it with a margin for the stroke.

Byte count of each icon string: rad 603, cryo 1207, bulk-bud 509, prepack 538, shake 527, waste 501, total 505, ready 1027, scheduled 818, in-testing 549, passed 585, shipping 709, submitted 802, accepted 484. The module is 9781 bytes.

## Simplifications

The doc's rounded frames around the testing and fulfillment icons are not part of the icon. The pane is the frame.

- Rad: the cabinet is the silo box's cuboid, hidden back edges dashed. The front opening, the right column and its screen, the tray, and a small panel on the top face stay. The photo's extra interior lines are gone.
- Cryo: four outline boxes, three bars in the ink at fill-opacity 0.35, and the words CRYO, AMAPS, and UV. The small top-left box has no word (the metering conveyor).
- Bulk Bud: an open carton with flaps and a heap of circles for the buds. The printed pouches in the doc's carton are that heap, so the shape reads at 28 px.
- Prepack: a stand-up pouch, a zip, a window, and three buds. The leaf on the zip is gone.
- Shake: a bag on its side, open, with a small heap. The leaf mark is gone.
- Waste: a hand and a bag over two logs and a flame. The printed leaf on the bag and the extra flame tongues are gone.
- Total: a pallet, two tiers, one strap on each tier, and a small handle. The wrap wrinkles and the box labels are gone.
- Ready and Scheduled: the spiral, the page, the corner curl, and the words stay. Ready keeps three ticked boxes. Scheduled keeps a flask.
- In Testing: a microscope with a head and shoulders behind it. The lab coat, the hands, and the glasses are gone.
- Passed Testing: a thumb-up hand beside the COA sheet. The face, the coat, and the hand holding the sheet are gone.
- Shipping: the truck faces left and the trailer runs to the right. Two wheels under the cab and two under the trailer. The grille, the stacks, and the doc's row of axles are the cab silhouette and those four wheels.
- Submitted: a hand around the phone, the word PLUG, and a person mark. The Ignore and Answer slider is gone.
- Accepted: two arms and a clasp drawn as three finger bars. The nails are gone.

## Assumptions for his word

- The stroke weight: 3 on a 100 frame (a hair over 2 px at 64 px, near 5 px at 160 px). Judged on the sheet; one constant moves them all.
- The figures simplified where 28 px demands it, as named above.
- The words in the five icons stay as drawn (English labels inside pictures, like CRYO and COA); the aria-labels are the panes' to translate.
- The Cryo's bars stay in the ink at a lighter tone until V10 colors and moves them. The Rad stays in the ink until V10 greens it. The trailer stays empty until V5 fills it. The hooks panel of the sheet previews the three with plain CSS so the hooks are proved, not to set V10's or V5's colors.
- One icon per key. No white and dark variants. The ink does that.

## Gates

Run in the worktree's `app/`.

- `npm run typecheck`: exit 0.
- `npx vitest run`: 63 files, 947 tests passed. The same under `TZ=America/New_York`.
- `node --check scripts/icon-proofs.mjs`: exit 0. `node --check scripts/smoke.mjs`: exit 0.
- `npm run proofs:icons` twice: the same bytes both times (sha256 `2e00903903f391ae7d2f775783e75b4241b38aebc6fc38af030efdd3abb741fd`).
- From-zero smoke (`SMOKE_PORT=9195`, `WRANGLER_SEND_METRICS=false`): `About to apply 77 migration(s)`, `SMOKE PASS`, ` 500 ` lines: 0, exit 0.
- Dash audit: 0 on the five files below (U+2014 and U+2013). No CR byte in those files.
- No `#` color and no `rgb(` in `src/consoleicons.ts`. `METRC_INTEGRATOR_KEY = "`, `METRC_USER_KEY = "`, `MS_CLIENT_SECRET = "`, and `SENSORPUSH_PASSWORD = "` do not appear in that file.

## Deploy

Not deployed from this session. Nothing committed. No git was run. The sheet goes to his eye through the Scribe. The commit and the merge wait for his word on all fourteen.

## Sealed final check

```
npm run typecheck                     exit 0
npx vitest run                        63 files, 947 tests passed
TZ=America/New_York npx vitest run    63 files, 947 tests passed
node --check scripts/icon-proofs.mjs  exit 0
node --check scripts/smoke.mjs        exit 0
npm run proofs:icons                  same bytes on the second run
SMOKE_PORT=9195 WRANGLER_SEND_METRICS=false node scripts/smoke.mjs
                                      About to apply 77 migration(s); SMOKE PASS; " 500 " lines: 0; exit 0
```

```
app/src/consoleicons.ts                         9781  9c418dbceba69665
TAIL }
app/test/consoleicons.test.ts                   5359  3a539e01e616d717
TAIL });
app/scripts/icon-proofs.mjs                     5069  fb94846962324cb8
TAIL console.log(moduleBytes.length, moduleSha);
app/package.json                                 784  c81bb77050fe2461
TAIL }
SESSION_REPORTS/2026-09-28_icon_proofs.html   100113  2e00903903f391ae
TAIL </html>
```
