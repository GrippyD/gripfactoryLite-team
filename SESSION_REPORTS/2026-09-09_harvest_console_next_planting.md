# Session report: Harvest Console Lite v0.13, the Next Planting Date (canon 0.30.35), Scribe-direct, 2026-09-09

**Scribe:** Gripfactory Lite Scribe (Cowork), Scribe-direct under G-2. One owner message after the 26ae0cb0 deploy; one version of the Harvest Console Lite app in its own folder, re-vendored here; worker only, no migration.

## The message, verbatim

"Ok, now add "next planting date", adding the following seasons plantings to June removed them from current."

The seam he hit: v0.12 had one planting date, so entering the following season's June planting emptied this season's field.

## What v0.13 does

Built in the Harvest Console Lite folder (source `lite\harvest-console-lite.html`, `LITE_VERSION` v0.13, the v0.13 row in `LITE-CANON.md` with the probe numbers), then re-vendored here by copy.

- `Next Planting Date` under the rate in the PLANTING block; the readout gains "Next · N planting days · Next field at capacity <date>".
- THE SEASONS LAW: each farm keeps a per-season ledger (current, next; base is the v0.11 full field when no current date is set). A season plants each farm once, to the farm's capacity, and only onto ground not standing in plants, so the next season refills a harvested farm at the same Planting Rate/day while nothing ever stands above capacity. The current season is untouched by the next date. Harvest cuts standing plants and completes when everything the current season planted to capacity is cut.
- Flags: `Next planting starts`, `Next field at capacity`, and the hot `Next planting overlaps the harvest` when the next date lands inside the harvest window.
- The rail's end reaches the next refill plus seven days, within the same 365-day tail cap the station finishes use; the rail's start never moves, so the opening-inventory sell-down stays anchored to Days before harvest and the fulfillment numbers hold.
- Additive seed; ES strings.

Note for the owner: "planted" in Field Operations is cumulative across seasons (Farm 1 reads 102,408 planted on 2027-06-10 after two plantings); a per-season reading is one word away.

## Sealed final check

```
cd /home/claude/deploy/app
npx tsc --noEmit                      -> exit 0
npx vitest run                        -> Test Files 19 passed (19), Tests 492 passed (492)
Dash audit (LITE-CANON.md, this report) -> 0 each; the vendored app's own seven unchanged
SMOKE_PORT=9731 WRANGLER_SEND_METRICS=false timeout 285 npm run smoke
                                      -> SMOKE PASS, "About to apply 38 migration(s)" from zero
  (the 0.30.30/0.30.32 pins hold against v0.13: skin and crumb once, lifted out
  equals the vendored file, title regex, no external requests, /app 302)
Headless probes (chromium, file://), v0.13 against the committed v0.12:
  GOLDEN: no dates equal (rail 2026-08-24 to 2027-10-31, 434 days, 11 flags);
  current date alone (2026-08-20 at 5,000) equal on 08-24, 09-07, 09-09, 10-31
  and every flag, Harvest complete 2026-10-26 included. A first cut of the
  refill rule (room = capacity minus standing, one cumulative target) let the
  current season replant the ground the harvest had just cut and turned
  Harvest complete into incomplete; the per-season farm ledger fixed it and the
  golden run went equal.
  NEXT: current 2026-08-20, next 2027-06-01 at 5,000: field 0 from 2026-10-27
  through 2027-05-31; 4.93% on 2027-06-01 (Farm 1 5,000); 49.3% on 06-10; full
  101,411 on 06-21 in farm order; flags Next planting starts 2027-06-01, Next
  field at capacity 2027-06-21. Next date alone: this season full at the start,
  Harvest complete 2026-10-26, refill in June. Next 2026-10-01 inside the
  harvest: hot overlap flag, Harvest incomplete. Fast-production tail
  2026-10-31 reaches 2027-03-28 for a 2027-03-01 next planting; a 2029 one
  stays capped at 2027-10-31. Saves, reloads, seeds an old blob. ES label. No
  page errors.
Visual pass (wrangler dev on the smoke DB, hosted with skin and crumb): the
  Planting block shows the three rows and the two-part readout; Field
  Operations on 2027-06-10 reads 49%, Farm 1 at 50,000 standing, the Next
  planting flags on the rail.

public/harvest-console/harvest-console-lite.html d68c67b86e7dfcbcdcfa774b05d7c6c02467f21af87a3d66a7d13e5afa77108d (96,603 bytes, v0.13, equal to lite/)
Harvest Console Lite/LITE-CANON.md (v0.13 row)
No source change in app/src, test or scripts this slice.
```

Worker only, no migration; the apply step applies nothing. Live underneath: worker 26ae0cb0, migrations 0001-0038. The grant incident (two 7403s on the D1 query endpoint) is still open: if the probe still refuses, the fast lane (`npm run deploy:grip` alone) ships this. Owed from the owner: which token line printed; this deploy's version id; his re-walk; his planting dates and rate; the true-zero after-counts; the 0.30.19 R2 picture if the Load Silo pane still misleads; a real Zoho export mounted live; the Athena logo; T1 Transport vs T1 Logistics; the METRC templates.
