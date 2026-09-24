# Build slice: Production Scheduling, the Trimming and Pasteurization schedules (canon 0.30.97)

You are a build hand in the Gripfactory Lite repo. Read `canon/_NOW.md`, then `canon/MEMORY.md`, then `canon/CANON.md` before touching anything. Canon wins over this prompt where they disagree. Guardrails bind: no remotes (G-1), no em or en dashes in anything you write (G-8), migrations append-only, ship-clean (G-9), sealed session report (G-10). Never deploy; the owner deploys by PS. Never edit `canon/` or `prompts/`.

This slice ADDS a Production Scheduling module to Production Operations: two shuttle-style scheduling stations, Trimming and Pasteurization, whose schedule is what exposes material to the Trim Packages Entry and Cryo Weight Entry panes. **Migrations start at 0056** (0053 effective_date, 0054 upload_cleared and 0055 blast_freezer are cut and ahead of you; if any of them has not landed on your bench, they still come first, append-only as ever). The from-zero smoke pin becomes 56.

## The owner's ruling (2026-09-16, verbatim; these are the laws)

> Cursor Slice: Production Operations Revamp
>
> Add a new button to Production Operations: [Production Scheduling]
>
> [Trimming]:
>
> Fed by unload queue completing its loop.  In other words, an employee scheduling these lots is what exposes them to the trim queue.
>
> Left Pane: collapsable HBN list only those that have been unloaded>>>
>
> *click on an HBN exposes a "schedule trim button" (maybe schedule trim is just the helptext on hover and the button is more like those ">>" MSOffice options use to mean "include"--clicking on individual package records does nothing, the list only exposes them if the HBN carrot is clicked
>
> Working Pane:
>
> 1. List of packages added by adding the HBN - Status: ("Pasteurizing", "In queue")
>
> Right pane: arrows all the way to the right means the package is complete. and can no longer be scheduled unless it's demoted by left arrow (which on the right pane should be PIN gated)
>
> [Pasteurization](Cryo)
> Fed by Trim packages - essentially same idea as the Trimming one, scheduled items are in the working pane.  Arrows to add to or remove from the schedule.

## The law, as the Scribe reads it (Scribe assumptions are marked; the owner corrects them before or during the build and canon records his word)

1. **The button.** Production Operations (`OPS_GROUPS` key `production_ops` in `src/pipeline.ts`) gains a member `{ key: "production_scheduling", title: "Production Scheduling", href: "/production/scheduling" }`, placed FIRST in the group (scheduling comes before the entry stations it feeds). `/production/scheduling` is a small landing with two tiles in the ops idiom: [Trimming] to `/production/scheduling/trim` and [Pasteurization] to `/production/scheduling/cryo` (the owner's own parenthetical "(Cryo)": the station is titled Pasteurization; its material is the cryo queue).

2. **The schedule is a record.** A new table (migration 0056) `production_schedules`: one row per scheduled item per stage. Columns: `id`, `stage` ('trim' | 'cryo'), `wet_weight_entry_id` (the trim stage schedules the unloaded LOT; its born WIP package is what trims), `wip_package_id` (the cryo stage schedules the trim PACKAGE in the cryo queue), `harvest_batch_id`, `status` ('scheduled' | 'complete'), `effective_date` (see 5), `scheduled_at`, `scheduled_by`, `completed_at`, `completed_by`, and the standing audit columns (`created_at`, `created_by`, `updated_at`, `updated_by`, `deleted_at`, `deleted_by`, `delete_reason`). Indexes on `(stage, status)`, `wet_weight_entry_id`, `wip_package_id`. Exactly one of the two foreign columns is set per row (enforce in the action, not a CHECK; Postgres-portable). At most one non-deleted row per (stage, item); the schedule action refuses a second in words.

3. **What feeds each station.**
   - **Trimming** is fed by the Unloaded Queue: HBNs (non-voided) that carry at least one lot with status `unloaded` and no non-deleted trim schedule row (scheduled or complete). "An employee scheduling these lots is what exposes them to the trim queue."
   - **Pasteurization** is fed by Trim's packages: HBNs that carry at least one `wip_packages` row with status `cryo_queue` and no non-deleted cryo schedule row.
   - The Admin Data Queues (Unloaded Queue, Cryo Queue) and every `/export` CSV STAY UNFILTERED: they list the record table. Only the two entry stations' left panes narrow (see 6).

4. **The three panes (one layout, two stations).** A new `.station-triple` layout in all three theme sheets (`src/theme.ts`, the three blocks; reuse the `.station-split` idiom; three columns that stack on `body.device-phone` and at the 480px floor; the wire box, sub-line and muted idioms as everywhere).
   - **Left pane: available.** A collapsible HBN list (`details/summary` per HBN, the pane-group idiom, collapsed by default, count badge on the summary). The summary line carries the HBN's simple label (Farm / Strain / Date, the standing simple row) and ONE control on the right of the line: a `>>` button whose hover title reads "Schedule trim" (Trimming) or "Schedule pasteurization" (Pasteurization). Opening the caret lists that HBN's available items beneath, read-only: for Trimming the unloaded lots (short lot id, strain, dry total in grams, the born package code); for Pasteurization the cryo-queue packages (package code, type, weight). Individual item rows carry NO control and are not links: "clicking on individual package records does nothing, the list only exposes them if the HBN carrot is clicked". Pressing `>>` schedules EVERY available item of that HBN for the stage in one post. An empty pane reads "- EMPTY -" (the 0.27.6 law, one i18n key).
   - **Working pane: scheduled.** The scheduled items, newest first, grouped under their HBN line (the same simple label), each item row with its identity and a **Status** word, and two controls: `<` (unschedule: back to available) and `>` (complete: to the right pane). Status words (Scribe assumption, cosmetic, his eye owed): on the Trimming station a scheduled item reads **"In queue"**; on the Pasteurization station a scheduled item reads **"Pasteurizing"**. The owner listed both words under Trimming; if he wants Trimming to show "Pasteurizing" for a lot whose trim is done and whose packages have gone on to the cryo queue, that is a one-line CASE in the loader, so ask him and leave the hook.
   - **Right pane: complete.** Items whose stage work is done ("arrows all the way to the right means the package is complete"), grouped the same way, each with its completion instant (`time[data-local]`, the 0.30.89 idiom) and ONE control: `<` (demote: back to scheduled), **PIN-gated**. A complete item "can no longer be scheduled unless it's demoted by left arrow".

5. **Every scheduling station carries the Effective Date (canon 0.30.94, THE EFFECTIVE DATE PER STATION).** The `>>` schedule post carries `effective_date` and `effective_pin` (the `effectiveDateField(null, locale, hint)` component from `src/effective.ts`, rendered once at the top of the left pane above the HBN list, client-defaulted to today; `resolveEffectiveDate` in the action; `effectiveOverrideLog` on every row written under another day). The resolved date is the schedule row's `effective_date` (the day the scheduling is effective). Complete and demote stamp `completed_at` with the instant.

6. **The gate on the entry stations (the point of the ruling).** `src/pipeline.ts` `StationDef.leftPane.paneFilter` widens from `"no_finished_lot"` to `"no_finished_lot" | "trim_scheduled" | "cryo_scheduled"`; `listPaneRows` in `src/db.ts` implements the two new filters:
   - `trim_packages` gets `paneFilter: "trim_scheduled"`: its Unloaded Queue pane lists only lots with a non-deleted trim schedule row in status `scheduled`. An unloaded lot that nobody has scheduled does NOT appear at Trim Packages Entry.
   - `cryo_weight` gets `paneFilter: "cryo_scheduled"`: its Cryo Queue pane, AND the no-pick bulk cryo form (the `cryo_weights` widget lists queue rows), list only packages with a non-deleted cryo schedule row in status `scheduled`.
   - The `queue_pick` select fallback and the Data Queues stay unfiltered (the standing law in `listPaneRows`' doc comment).

7. **Completion is automatic where the floor already finishes the work, and manual by the arrow.**
   - Trimming: when a lot leaves the Unloaded Queue (the trim reconcile's Remove from queue, Mark trimmed on the queue: every path through `lot_trimmed_unloaded` in `src/actions.ts`), its `scheduled` trim row completes (status `complete`, `completed_at`, `completed_by`, logged under a new `SYSTEM_REASON.schedule_complete`). A lot whose trim schedule row is already `complete` is untouched.
   - Pasteurization: when a package's cryo weight lands (`setCryoWeight`, the `cryo_weighed` transition out of `cryo_queue`), its `scheduled` cryo row completes the same way.
   - Manual `>` on the working pane completes without the work (a supervisor's call), logged under `schedule_complete` with the actor.
   - **Demote** (`<` on the right pane): status `complete` back to `scheduled`, logged under `SYSTEM_REASON.schedule_demote`, and **PIN-gated**: the row's `<` form carries a PIN box (`effective_pin` is NOT reused; name it `demote_pin`), checked in the action against `app_config admin_pin` exactly the way `resolveEffectiveDate` checks (canon 0.30.92: a PIN box on a form checks the value, never the cookie; a missing admin_pin opens nothing). Wrong or blank PIN: 403 in words ("Demoting a completed item needs the Admin PIN."). The Admin PIN is 21319 in the seeded floor.
   - **Unschedule** (`<` on the working pane) soft-deletes the schedule row (`deleted_at`, `deleted_by`, `delete_reason` = the system reason "unscheduled from the working pane"; Scribe assumption: a scheduling act, no typed reason, no PIN; the owner's word if he wants either). The item returns to the available pane. A completed item cannot be unscheduled; it must be demoted first (the ruling's order).
   - Demote after the work is done is allowed (the ruling wants it possible); the loader then shows the item scheduled again with its Status word, and the entry station's pane shows it again only if the underlying record is still in that queue (a trimmed lot is no longer `unloaded`, so it will not reappear at Trim Packages Entry; say so in a muted line on the working row: "trimmed" / "cryo weighed" beside a demoted item whose work is done). Do not invent a way to un-trim or un-cryo; those are the standing Demote controls on the Data Queues.

8. **Voids follow the record.** A voided lot or package (or its HBN) drops from every pane by the standing predicates; its schedule rows are left as they are (history), never shown. The schedule loader joins through non-voided records only, one predicate for the pane and the counts (the 0.30.5 one-predicate law).

## Code shape

- `migrations/0056_production_schedules.sql`: the table and indexes above; nothing else.
- `src/config.ts`: `SYSTEM_REASON.schedule`, `schedule_complete`, `schedule_demote`, `schedule_unscheduled`; `PRODUCTION_SCHEDULING_PATH = "/production/scheduling"`; the stage constants `SCHEDULE_STAGES = { trim: "trim", cryo: "cryo" }` and their titles.
- `src/pipeline.ts`: the ops member; the widened `paneFilter` union; `trim_packages` and `cryo_weight` take their filters.
- `src/db.ts`: `listPaneRows` implements `trim_scheduled` (wet_weight_entries, `AND EXISTS (SELECT 1 FROM production_schedules ps WHERE ps.wet_weight_entry_id = w.id AND ps.stage = 'trim' AND ps.status = 'scheduled' AND ps.deleted_at IS NULL)`) and `cryo_scheduled` (wip_packages, the same shape on `wip_package_id`, stage `cryo`); the schedule loaders: `listScheduleAvailable(db, stage)`, `listScheduleWorking(db, stage)`, `listScheduleComplete(db, stage)`, each returning HBN-grouped rows with the simple label fields; `getScheduleRow`.
- `src/scheduling.ts` (new): the three-pane page renderer `schedulingPage(stage, panes, locale, nowIso, ok?)`, the landing `schedulingLanding(locale)`, the per-row controls, the i18n strings' use. Keep the renderer pure (input in, HTML out) so `test/scheduling.test.ts` pins it without a database.
- `src/actions.ts`: `scheduleHbn(db, stage, hbnId, form)` (every available item of the HBN, the Effective Date resolved once, one db.batch, refuses an HBN with nothing available in words), `unscheduleItem(db, stage, rowId, form)`, `completeScheduleItem(db, stage, rowId, form)`, `demoteScheduleItem(db, stage, rowId, form)` (the PIN check), plus the two automatic completion hooks wired into the trimmed and cryo-weighed paths (small helpers `completeTrimScheduleForLot(db, lotId, actorId, ts)` and `completeCryoScheduleForPackage(db, packageId, actorId, ts)` that return the statements to push into the existing batches).
- `src/index.ts`: GET `/production/scheduling`, GET `/production/scheduling/:stage`, POST `/production/scheduling/:stage/schedule` (form `hbn_id`, `effective_date`, `effective_pin`), POST `/production/scheduling/:stage/unschedule/:id`, POST `/production/scheduling/:stage/complete/:id`, POST `/production/scheduling/:stage/demote/:id` (form `demote_pin`). Unknown stage 404. The pages are floor stations (no /admin PIN gate on the pages themselves; the demote carries its own PIN, per the ruling: "on the right pane should be PIN gated"). Flashes through `flashFromQuery` (`ok=scheduled&n=N`, `ok=unscheduled`, `ok=completed`, `ok=demoted`).
- `src/i18n.ts`: every display string EN and ES ("Production Scheduling", "Trimming", "Pasteurization", "Schedule trim", "Schedule pasteurization", "In queue", "Pasteurizing", "Complete", "Available", "Scheduled", "Unschedule", "Complete" (the verb), "Demote", "Demoting a completed item needs the Admin PIN.", "Nothing available to schedule on this HBN.", the flashes).
- `src/theme.ts`: `.station-triple`, the arrow buttons (`.shuttle-btn`, compact, the standing button tokens; `>>` reads as one glyph pair, never an em dash), the Status word muted, all three sheets.
- Tests: `test/scheduling.test.ts` (the renderer: three panes, the collapsed HBN with its count and the `>>` control with its title, read-only item rows with no links, Status words per stage, the right pane's PIN box, "- EMPTY -" per empty pane, ES); `test/surface.test.ts` (the Production Operations member and order); the paneFilter union compiles; the action helpers' pure parts (stage parsing, the one-row-per-item refusal wording) where they can be pulled pure.
- `scripts/smoke.mjs` (the from-zero pin is 56; EVERY EXISTING TRIM AND CRYO WALK MUST NOW SCHEDULE FIRST, or the panes are empty and the walks break; this is the ripple of the ruling, do it deliberately, walk by walk):
  - Production Operations carries [Production Scheduling] first; the landing shows the two tiles.
  - Trimming: with an unloaded lot on the floor and nothing scheduled, Trim Packages Entry's pane is EMPTY while the Data Queues Unloaded Queue still lists the lot; the Trimming station's left pane lists the HBN collapsed with a count; the item rows carry no links; `>>` with a blank Effective Date schedules every unloaded lot of the HBN (303, `ok=scheduled&n=`), the working pane shows them with "In queue", the left pane no longer lists the HBN, and Trim Packages Entry's pane now lists the lot; a second `>>` on the same HBN refuses in words; `<` unschedules one back to available; `>` completes one to the right pane with its local instant; `<` on the right pane without the PIN is 403 in words, with the Models PIN 403, with the Admin PIN 303 and the item is scheduled again; a real trim (the standing walk, now after scheduling) auto-completes the lot's schedule row (the right pane shows it, the working pane does not); a backdated `>>` (yesterday + the Admin PIN) writes the schedule rows with that effective_date and the effective_date change-log marker.
  - Pasteurization: the same shape on the cryo queue: nothing scheduled means the Cryo Weight Entry pane and the bulk cryo form list nothing; `>>` schedules the HBN's cryo-queue packages ("Pasteurizing"); the cryo weight (the standing walk, now after scheduling) auto-completes the package's row; demote needs the PIN.
  - Spanish speaks on the landing and one station.

## Gate (all green before you write the report)

```
npx tsc --noEmit
npx vitest run
node --check scripts/smoke.mjs
Dash audit on every touched file: LC_ALL=C grep -c $'\xe2\x80\x94\|\xe2\x80\x93' <file> = 0
rm -rf .smoke-persist && SMOKE_PORT=<fresh> WRANGLER_SEND_METRICS=false timeout 280 npm run smoke
  (exit 124 expected; require SMOKE PASS and "About to apply 56 migration(s)" from zero)
```

Visual pass: the Trimming station in Lite, Continuum and Cerberus with one HBN available (collapsed and opened), two items scheduled and one complete; the phone stack at 480px.

Write `SESSION_REPORTS/2026-09-16_production_scheduling.md` with the sealed final check (G-10): commands verbatim, test counts, dash audit, the from-zero pin, and sha256 first-16 for every touched file. List every Scribe assumption above that you built as written and anything you had to decide that this slice did not; propose canon amendments there; never edit canon yourself. Tell the owner to say deploy when he wants it on the worker; this slice ships worker plus migration 0056 (the three-step block: probe, migrations apply, deploy:grip).

## Open for the owner (the Scribe's forks, recorded in canon 0.30.97; his word lands as an addendum here)

1. The Status words: "In queue" on Trimming and "Pasteurizing" on Pasteurization (built so), or "Pasteurizing" also on a Trimming lot whose packages have moved on to the cryo queue.
2. Unschedule (working pane `<`) with no typed reason and no PIN (built so), or reasoned, or PIN-gated like demote.
3. The pages open like the other floor stations, only the demote PIN-gated (built so), or the whole module behind the Admin PIN.
4. Completion also automatic when the entry station finishes the work (built so), or only ever by the arrow.
