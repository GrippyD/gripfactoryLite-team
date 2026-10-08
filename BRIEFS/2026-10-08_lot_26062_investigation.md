# INVESTIGATION 26062: ONE HBN, TWO WET LOADS, A DEMOTION (canon 0.30.427)

For a Claude agent (Claude Code or Cursor) opened by the investigator in HIS OWN clone of the gripfactory Practical repo, on a branch of his own named `investigate-26062`. Not the owner's main folder, not the owner's `branches\GFLiteOpsDashboard` worktree (one agent per worktree; those are the build's). If your working folder is one of those, stop and say so. READ ONLY on the data: this task writes exactly one file, a report. No migration, no repair run, no app change, no `wrangler` command against the remote database, no credential of any kind. No git but the commit of the report on this branch; never push to main, never merge; the investigator pushes the branch with his own hands and the owner merges it.

## The question (the owner, 2026-10-08, verbatim)

"we're missing the lot 26062. There was two loads for wet weights, a demotion was involved. There's a 062 in the unload queue that contains weight from two different lots, both declared 062."

The owner's picture shows a wet weight entry on HBN `2bd1602a-9e9f-47a3-9c75-b1ba828c4fee`: Total wet weight 1,903,423 g, Dry space Hang in Place, Spear, Truck 2. Earlier canon holds 26062 as voided on the floor while live METRC carries an SPR of 737,135 g for it; that is open for the owner's word and is part of this picture.

## What to read

The data is the snapshot folder the owner hands you (a copy of `app/db_backups/<stamp>_<label>/`, git ignored, never committed): one JSON file per table, each an array of row objects, and `_manifest.json`. Read it with a short Python or Node script of your own; never type rows in by hand from a picture. The schema is `app/migrations/0001` to `0095` (read them, they are the truth about every column); the app's reading of them is in `app/src/db.ts`, `app/src/actions.ts` (the demote control, near "control === "demote"") and `app/src/pipeline.ts`.

The tables that matter: `harvest_batches` (the HBN; `hbn`, `farm_code`, `strain_id`, `market_strain`, `is_test`, `status`, `deleted_at`), `wet_weight_entries` (one row per wet load: `harvest_batch_id`, `weight_grams`, `wet_spear_weight_grams`, `dry_space_id`, `truck_number`, `material_form`, `plant_count`, `dry_weight_grams`, `status`, `created_at`, `updated_at`, `deleted_at`), `unload_sessions` (`wet_weight_entry_id`, `truck_number`, `finished_at`, `effective_date`, `deleted_at`), `dry_weights` (the unload's packages: `wet_weight_entry_id`, `weight_grams`, `created_at`, `deleted_at`), `record_change_log` (`record_table`, `record_id`, `field`, `old_value`, `new_value`, `actor_person_id`, `reason`, `changed_at`; a demotion writes `reason = 'demoted'` on `field = 'status'`), `metrc_uploads` (`kind`, `harvest_batch_id`, `filename`, `uploaded_at`) and any METRC package or ledger table the migrations name.

## What to establish, in this order

1. EVERY ROW THAT SAYS 062. All `harvest_batches` rows whose `hbn` ends in 062 (live, deleted, test), by id, with farm, strain, status, created and deleted stamps. All `wet_weight_entries` on each of them, by id, with weight, truck, dry space, plant count, dry weight, created and deleted stamps. All `unload_sessions` and `dry_weights` on each entry, with their stamps and gram totals.
2. THE TIMELINE. Every `record_change_log` row on those batch and entry ids, in time order: who changed what from what to what, with the reason. Mark the demotion and what it undid.
3. THE TWO LOADS. Which two wet loads exist, their weights and trucks, and which HBN row each sits on now. Whether the 1,903,423 g entry is one load, or two loads already added into one number (the sum of the two, if two weights can be found in the log or on a second entry).
4. THE UNLOAD QUEUE ROW. The entry the queue shows as 062: which `dry_weights` rows hang off it, their grams, their stamps, and whether their stamps or their log rows tie them to the other lot's unload.
5. METRC. What the snapshot's METRC tables hold for 26062 (the 737,135 g SPR among them) and for any sibling HBN the second load may truly belong to.
6. THE RECONSTRUCTION. From the above, say what the floor should hold: which HBN each wet load belongs to, which unload and which packages belong to which, and what 26062's wet, dry and plant figures should be. Where the data cannot settle it, say exactly which question only a person can answer (and which person: the one who weighed, the one who unloaded).

## The report

One file, `SESSION_REPORTS/2026-10-08_lot_26062_investigation.md`, committed on the branch. Its parts: the owner's words (verbatim, above); every row found, as tables with ids and stamps; the timeline; the reconstruction; the open questions; and a PROPOSED REPAIR written as SQL for the owner to read, NOT to run: guarded and idempotent (every UPDATE carries its precondition in its WHERE, every log INSERT guards on that same precondition), no double quotes, no percent signs, no LIKE, each statement under 5,000 characters, logged into `record_change_log` under `actor_person_id` the owner id `7b59cf6b-04b6-4742-bb1b-78a28b593fe8` with a reason that names this report. The repair file itself is not committed; it goes beside the report only as text inside the report.

Rules on the file: no em or en dashes anywhere (audit by character), no CR line endings, no person's name (write "the day shift lead", "the investigator", "the owner"), no credential, no account id, no database id. If the repo has a `canon/` folder, do not touch it.

## Hand back

Say in one paragraph: the branch name, the commit, the report path, the two or three facts the owner must read first, and every question that needs a person. Do not merge. Do not push to main. Do not say "deploy".
