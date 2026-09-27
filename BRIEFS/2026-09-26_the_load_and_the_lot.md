# BRIEF P: THE LOAD AND THE LOT, INTERNAL LOGISTICS, AND THE MENU LINES (canon 0.30.241)

For the build session (Claude Code or Cursor) in `app/`, under THE DISPATCH RULE (canon 0.30.155). Two parts, each its own sitting, report and gate, like brief M: part one first, part two after part one's gate. Canon wins over this brief where they differ; read `canon/_NOW.md` first. No migration is expected (the head stays 0075); if a part truly needs one it is 0076, and the report says why. Commit nothing, push nothing, deploy nothing.

## The ruling (owner, 2026-09-25, verbatim, his two en dashes set as hyphens under G-8)

“Main Menu (Operations)

On every top button, new text half as tall as the label
Harvest Operations:
“Lot [n]” (of the day(since 5am)-not the HBN)”…..in progress” or …..”ready to be moved”
use as many dots as to make it so Lot n and the status are left and right justified respectively and the gap between them is filled.

Interco Logistics: change name to Logistics Operations - buttons: [Internal Logistics, Processing Partners]
Truck n…..in-transit (time elapsed)

Drying:
Silo n…drying (time elapsed)

Finishing a wet weight entry shouldn’t say “finish lot”, maybe say “finish load”

Finished loads form a new queue (whatever finish lot on wet weight entry currently feeds needs to be severed.  It now feeds the dry queue.

Interco logistics (logistics operations).  Strike the page again and replace with buttons above.
New internal logistics surface:
Left Pane: dry queue in lots (not loads)
Middle Pane Scheduled lots (different from loads, 1 load can contain many lots, 1 lot may contain parts of many loads.  The human scheduler’s job is to decide to pass them onto the middle when the lot’s complete, regardless of the load situation.  This is what makes the lots exposed to the left pane of the load silo screen - when the silos are loaded, they become “finished” on the scheduling (internal logistics) side.  Don’t worry about the csv for now.”

His picks on the question tool, verbatim: the farm day "Leave it tied to whatever is in the Admin setting (6AM)"; the trucks "Harvest loads, weigh-in to silo (Recommended)"; the lot status "Until scheduled / once scheduled (Recommended)"; the loading "Whole lot, one space (Recommended)".

## What the Scribe read in the code

1. A weigh-in is a `wet_weight_entries` row. `finishLot` (`src/actions.ts`) checks the weights, splits a truck whose totes name two or more HBNs into one entry per HBN (`splitTruckIfNeeded`, THE TRUCK RECORD, canon 0.30.232; every part keeps the header's Truck #), takes the plant count (canon 0.30.62), moves the entry from `weighing` to `drying` under `SYSTEM_REASON.finish_lot`, and the wet weights file pends. So today each entry is one load's share of one HBN.
2. Load Silo's pane is `listBarnWetLots` (`src/db.ts`, `BARN_WET_LOT_SELECT`): every entry in `drying` (or the truck-era `in_transit`) that no open `silo_loads` row holds, per canon 0.30.130 (owner, 2026-09-19: "assume it's elligible for dry space loading as soon as the "finish lot" routine runs in wet weight entry"). `loadSilo` loads one entry into one space. The drying schedule surfaces (Silos, Dry Rooms, Freezers, canon 0.30.226) list every entry Load Silo lists. That exposure is what the ruling severs.
3. `production_schedules` (migration 0056) takes a row per `harvest_batch_id` with the entry and package columns null, and `stage` carries no constraint; its only indexes are on (stage, status), the entry and the package.
4. The Operations map is `homePage` in `src/html.ts` over `OPS_GROUPS` (`src/pipeline.ts`): six `opsNode` buttons, icon and label alone (owner, 2026-09-02: "no numbers under the labels"). The Interco Logistics node goes straight to `/interco`, today the manifest builder (`manifestBuilderPage`); the floor has built no manifest since 9/16. THE BLANK SLATE (canon 0.30.108) is the pattern for striking a page: the renderers stay in the file, no route reaches them, and the old paths land elsewhere.
5. The console already says "Total Dry Queued" for dried material waiting for trim (`src/silo.ts`, canon 0.30.183). The owner's dry queue is the other end: wet lots waiting to go into a dry space.

## Part one: the load and the lot

1. FINISH LOAD. The Wet Weight Entry button reads `Finish load` (Spanish `Terminar carga`), and the words on that page that call the weigh-in a lot call it a load (the plant count prompt asks how many plants the load holds). What Finish load writes does not change: the truck split, the born packages, `drying`, the plant count and the pending wet weights file ("Don't worry about the csv for now"). What it no longer does is put anything on Load Silo. Canon 0.30.130's exposure at finish is repealed.
2. THE LOT. A lot is the HBN (`harvest_batches`). Its parts are the finished entries of every load that carried it (status `drying`, no open load). One load can carry many lots, and one lot can hold parts of many loads.
3. INTERNAL LOGISTICS, a new surface (a route of the build's choosing under the Logistics Operations group), three panes in the `.station-triple` shape of the scheduling surfaces:
   - Dry Queue (left): every lot with at least one part that no Scheduled row covers. One row per lot: its label as Load Silo reads a lot, the number of its parts and the trucks they came on, the total wet grams, the planned silo (the HBN's silo digit) and how long its oldest part has waited since its load was finished. `>>` passes the lot to Scheduled.
   - Scheduled (middle): the lots passed, oldest pass first, the same facts per row; `<<` returns a lot to the Dry Queue while none of it is loaded; `>` opens Load Silo with the lot picked.
   - Finished (right): the lots Load Silo has loaded, in the last seven farm days, with the space and the moment.
   - The scheduler's `>>` is the only way onto Load Silo, and nothing tests completeness ("regardless of the load situation"). A part finished after its lot was passed rides with it while nothing of the lot is loaded; a part finished after the lot is loaded brings the lot back to the Dry Queue with that part alone.
   - Storage: one `production_schedules` row per pass at a new stage (for example `internal_logistics`), `harvest_batch_id` set, entry and package null, completed when the lot is loaded; `<<` voids it with a reason like the lines' `<<`. Every write logs.
4. LOAD SILO LOADS THE WHOLE LOT. Its left pane lists the Scheduled lots, not entries. Picking a lot loads every part of it into one space in one press: one `silo_loads` row per part, each part's package moved as today's load moves it, the Scheduled row completed in the same batch. The lot's planned silo is preselected when free (as the planned space is preselected today); the space select, `kind` and `next` of canon 0.30.226 stay. The plant count re-prompt stays for any part without a count (report the shape chosen). The drying schedule surfaces' Available lists what Load Silo lists (the Scheduled lots), and its `>>` opens Load Silo with the lot picked. Everything after the load (the clocks, Unload Dry Space, THE JOINT UNLOAD, the freezer branch) does not change.
5. LOGISTICS OPERATIONS. The map's Interco Logistics node reads `Logistics Operations` (the group key may stay `interco_logistics`; storage identifiers stay English) and opens its group page with two buttons, `Internal Logistics` and `Processing Partners`. The manifest page is struck again as canon 0.30.108 struck the floor: its renderers stay in the file as the record, no route reaches them, every old path under `/interco` lands on the group page (GET 302, a stale POST 303 acting on nothing). Processing Partners is its title and `- EMPTY -` until the owner describes it. The crumbs follow (`src/nav.ts`).
6. ON DEPLOY nothing is written: the lots waiting at Load Silo that moment appear in the Dry Queue, and the scheduler passes them with `>>`.
7. TESTS: Finish load on a two-HBN truck leaves both parts off Load Silo and puts both lots in the Dry Queue; `>>`, `<<`, a late part before and after the load, the whole-lot load writing one load row per part and completing the row, a lot back in the Dry Queue after a late part, the drying surfaces listing Scheduled lots only, the struck paths' redirects, Processing Partners blank. `scripts/smoke.mjs` walks it: finish a load, pass the lot, load it whole from Load Silo, see it Finished.

## Part two: the menu lines

1. THE LINES. Under the label of three top buttons, lines of text half the label's height, each with its name at the left, its status at the right and dots filling the gap between (as many as the width allows). The other three buttons carry none until the owner names what they say. The 2026-09-02 map polish ("no numbers under the labels") gives way to these lines.
2. HARVEST OPERATIONS: one line per lot of the farm day, the day starting at the Admin setting `farm_day_start_hour` (6 today; "Leave it tied to whatever is in the Admin setting (6AM)"). `Lot n`, where n is the lot's place by its first load of the day (1, 2, 3; not the HBN). It reads `in progress` while it is on the scale or in the Dry Queue, `ready to be moved` once it is Scheduled, and it leaves the line once it is loaded.
3. LOGISTICS OPERATIONS: one line per truck from its Finish load until every part it carried is loaded into a dry space: `Truck n` (the header's Truck #), `in-transit` and the time since its Finish load.
4. DRYING OPERATIONS: one line per silo-kind space holding an open load (the silos and the Arlington Dry Room; the freezers do not dry): the space's name, `drying` and the load's clock as the silo strip reads it (paused reads paused; with two or more loads, the longest).
5. The times tick in the browser as the silo strip's clocks tick. Every new string with Spanish.
6. TESTS: the leader markup and its half-height class; the Harvest numbering by first load after the farm day start (a lot begun before it is not on the line); each status and the line leaving once loaded; a truck's line from Finish load until its last part loads; the Drying line per space. `scripts/smoke.mjs` reads the three buttons' lines on the map.

## Files

`src/actions.ts`, `src/db.ts`, `src/html.ts`, `src/pipeline.ts`, `src/nav.ts`, `src/scheduling.ts`, `src/drying.ts`, `src/index.ts`, `src/theme.ts`, `src/i18n.ts`, `src/config.ts` as needed, tests beside them, `scripts/smoke.mjs`.

## Gates and the hand-back

The usual, per part: tsc 0; vitest both zones; node --check; the from-zero smoke at the current pin with `SMOKE PASS` and no 500; dash audit 0; no key or secret in any file; no personnel data. Reports `SESSION_REPORTS/2026-09-26_the_load_and_the_lot.md` (part one) and `SESSION_REPORTS/2026-09-26_the_menu_lines.md` (part two), each with the sealed final check and the assumptions for the owner's word, among them: Processing Partners blank; the waiting lots to the Dry Queue on deploy; the late part rule; the plant count asked per load at Finish load; the Finished window of seven farm days; the pane named Dry Queue beside the console's Total Dry Queued; the three unnamed buttons blank; a lot begun on an earlier farm day not on the Harvest line; a truck with no Truck # (the line's name then); the freezers off the Drying line. Do not deploy; the Scribe hands the deploy line.
