# Cursor slice: the marketplace rework and the trim reconciliation gate (canon 0.22.0 rulings, cut at 0.24.0, 2026-09-05)

You are building one slice in the Gripfactory Lite repo (`app/`). The Scribe cut this prompt from ratified canon; canon wins over everything here if they ever disagree. Read `canon/_NOW.md`, `canon/MEMORY.md`, and `canon/CANON.md` first. The tree you start from is the deployed worker 505f3e4d (migrations 0001-0026 applied remotely).

## Rails that bind you (non-negotiable)

1. No git remotes, no pushes, no GitHub (G-1). Local commits only.
2. NO em dashes or en dashes in ANYTHING you write: code, comments, strings, docs, the session report. Plain hyphens, commas, colons (G-8). The gate greps bytes; vendored files are the only exemption.
3. Migrations are APPEND-ONLY. 0001 through 0026 are deployed and frozen. Your work starts at `0027_...`. Postgres-portable SQL only (no SQLite-only pragmas, no AUTOINCREMENT).
4. Never touch the TBD placeholder ids in wrangler.toml. Never deploy. Never run against the remote D1.
5. Never edit anything under `canon/` or `prompts/`, and never edit vendored files (the saleshelper pair, the T3 templates, the icons under `app/public/icons/`, `src/vendor/*`, the Continuum stylesheet).
6. DO NOT TOUCH THE INTERCO MODULE (`src/interco.ts`, the /interco routes, virtual move). Its rework is design-gated separately by the owner. This slice is Marketplace and Trim only, plus the shared seams they need.
7. Every display string goes through `src/i18n.ts` (EN and ES; EN fallback). Storage identifiers stay English.
8. Every edit, void, split, and state change demands a reason and lands in record_change_log (use the existing insertLog/logsForInsert seams and the SYSTEM_REASON map).
9. Grams are numeric with 2-decimal rounding; displayed grams go through formatGrams (thousands separators); machine surfaces (CSVs, inputs, logs) stay raw.
10. THE ONE-EXPORT-HOME LAW (canon 0.22.0, live): every METRC-bound CSV downloads and marks uploaded at `/admin/uploads` ONLY. No export or download buttons on any floor page. New CSV kinds join the existing sections there.
11. G-10: write `SESSION_REPORTS/2026-09-05_marketplace_trim_gate_slice.md` with a sealed final check (tsc, vitest counts, dash audit output, smoke result, byte sizes and sha256 of every file you touched) pasted verbatim. The last slice's builder skipped the report; the Scribe logged the miss. Do not repeat it.

## Part A: the Marketplace rework

The owner's rulings, verbatim, are the spec:

- "In Marketplace, the package tag field is referring to a human readable label, not a package tag"
- "Add a category field to the listings page and a config in Admin for the list it generates"
- "qty lbs should be a calculated field. The person adding a listing is going to be using grams. Either the flow is off, or the label needs to be changed. We also need to be able to split packages in this module which will make the package field a must-have for the internal team (it's practically a throwaway for the sales team)"

### A1. Label, not tag

Today `listings.package_tag` is a select of live inventory tags ("Tag from live inventory. Never typed."). That is wrong per the ruling. Split the concept in two:

- `package_label` TEXT: the human-readable sales-facing label, free text, what the sales sheet and the LeafLink lane show. Practically a throwaway for the sales team: optional.
- `package_item_id` TEXT: the INTERNAL link to a `local_inventory_items` row, picked from live inventory (a select of FG and WIP items showing the item display name, which since 0026 already resolves the market-strain override). Optional on a plain listing, REQUIRED when the listing points at split children (A4), and the must-have for the internal team.

Migration 0027 adds both columns (backfill `package_label` from the old `package_tag` values; leave the old column in place and stop writing it, with a comment saying so). The listing form replaces the tag select with the Label text input (help: sales-facing name, free text) and an Item picker (help: the internal package; required to split). The listings table renders Label; the internal item shows muted beside it when linked.

**Matching** (the reconciliation column) prefers the internal link when present: matching = the linked item exists, is not deleted, and its quantity covers the listing quantity. Fall back to the current name-based matching only when no link is set. Pin both branches in tests.

### A2. The category field

- `listings.category` TEXT (0027), lookup-backed, never a DDL enum.
- Seed a `listing_category` category in `lookup_values` (0027) with starter rows: Flower, Smalls, Trim, Fresh Frozen, Concentrate, Other. The owner corrects the list in Admin, Data Lookups (the existing lookup landing picks it up automatically if you register it like the other categories; give every new field help text ending in its Admin\Data Lookups path per the standing law).
- The listing form gains the Category select (optional, so the floor is never blocked); the listings table shows it; the sales order line view carries it through.

### A3. Grams in, lbs calculated

The flow is off exactly as the owner said: the form takes `qty_lbs` and stores grams. Reverse it:

- The listing form and the sales order line form take **Quantity grams** (step 0.01, min 0, required). Storage stays `qty_grams` (already the schema).
- Lbs becomes a CALCULATED display everywhere lbs shows: `qty_grams / 453.59237`, rendered to 2 decimals with the unit. Export the constant from ONE place (it already lives in the compliance module as the lbs-in-testing conversion; hoist it to a shared export rather than duplicating the number) and use it in both spots.
- The listings table shows grams (formatGrams) with calculated lbs muted beside it. No stored lbs anywhere.

### A4. Package splits

New in this module: split an internal package so part of it can be listed or sold separately.

- Surface: a [Split package] control on the Marketplace page (PIN side, like the rest of /marketplace). Pick the parent from live local inventory (FG and WIP), see its current quantity and remaining balance, then a rapid-add exchange in the [+] idiom (one blank line: child quantity grams + optional child label note; the plus commits the row below and clears the boxes; blank rows skip, partial rows refuse 400; Save stays).
- Semantics: children are NEW `local_inventory_items` rows. Migration 0027 adds `parent_item_id` TEXT to `local_inventory_items`. Each child inherits the parent's kind, location, license side, harvest_batch linkage, and display name resolution; quantities are gram-exact 2-decimal; the parent decrements by the sum of the children; a remainder simply stays on the parent. The parent NEVER goes negative silently: crossing zero raises the live overissue confirm (the data-balance-remaining pattern from trim), and an over-split is FLAGGED, never blocked (the standing overissue law).
- Child package codes: PROVISIONAL pending the owner's naming conventions doc. Generate `<parent package_code>-S1`, `-S2`, ... in ONE function (`splitChildCode(parentCode, n)`) with a law comment saying the naming doc lands here in one edit.
- Audit: every split is reasoned. Add `SYSTEM_REASON.inv_split` to the existing inv_* family; log parent and each child (insertLog seams).
- METRC consequence: a split pends an upload row, kind `package_split`, at `/admin/uploads` under a new Splits section following the Manifests section pattern exactly (download plus mark-uploaded, one home, nothing anywhere else). The CSV shape is PROVISIONAL: no METRC split import template exists in the vendored set, so emit one constant `SPLIT_CSV_HEADER = "ParentLabel,ChildLabel,Quantity,UnitOfWeight,Date"` in one place with a comment that the owner's T3 split template (if one exists) lands as a single edit. RFC 4180 quoting via the existing csv helpers.
- Listings and splits: a listing whose item link points at a split child behaves like any listing; splitting FROM the marketplace pre-fills the parent when the user came from a listing row. The package link is REQUIRED on a listing created from a split child (the internal-team must-have).

## Part B: the trim reconciliation gate

The owner's walk report, verbatim: "Also, I over issued, no warning and the package is still in the trim queue." The live overissue confirm and the OVER ISSUED banner shipped in 0026. This slice ships the other half, deferred by the Scribe in canon 0.22.1:

- On trim **Save** (not the [+]: the plus keeps its live confirm), when the picked lot's balance shows a nonzero remaining (over OR under), render the reconciliation interstitial through the EXISTING `reconcileGate` helper (`src/reconcile.ts`, built 0021 for unload finish, reusable by design). Same choices, same semantics: **queue an adjustment** (pends a package adjustment CSV row for the parent WIP package), **queue a package finish** (pends a package_finish row, FINISH_CSV_HEADER, the existing provisional), **nothing** (proceed, the standing banner keeps shouting), or **back** (return to the trim sheet untouched).
- THE FINISH CHOICE COMPLETES THE LOT OUT OF THE TRIM QUEUE. That closes the owner's bug: a lot whose parent is finished in METRC stops lingering in the trim pane. Use the existing status transition seams (the same law that lets unload finish clear the dry space); the completion is reasoned and logged like every state change.
- Adjustment and finish CSVs surface at `/admin/uploads` only (they already do; do not add buttons anywhere else).
- A zero-remaining Save behaves exactly as today (no interstitial).

## Migrations

One migration unless you truly need two: `0027_marketplace_rework_splits.sql`: listings ADD package_label, package_item_id, category (backfill label from package_tag); local_inventory_items ADD parent_item_id; lookup_values seed listing_category rows. Comment every law the file embodies. From-zero apply must stay clean (the smoke proves it: expect "About to apply 27 migration(s)").

## Tests and smoke (pin the new laws, never delete old pins)

- vitest describes: the label-vs-link matching branches; category lookup seed present; grams-in form fields (lbs input absent, grams input required); the lbs calculation from the shared constant; splitChildCode; split creates children with parent_item_id and decrements the parent; split pends kind package_split; SYSTEM_REASON.inv_split logs; trim Save with nonzero remaining renders the gate choices; the finish choice removes the lot from the trim queue and pends package_finish; zero remaining skips the gate; /admin/uploads shows the Splits section.
- smoke additions: walk a listing with grams and category and an item link (assert calculated lbs in the page), run a split end to end (children visible in inventory, upload row pending, mark-uploaded clears it), then the trim walk: overissue a lot, Save, take queue-an-adjustment; second pass take the finish choice and assert the lot leaves the trim pane and the CSV pends at the one home.
- The full gate you run and paste into the report: `npx tsc --noEmit`, `npx vitest run`, the dash audit (`LC_ALL=C grep` for the two byte sequences over every file you touched, expect 0), `rm -rf .smoke-persist && SMOKE_PORT=<fresh> WRANGLER_SEND_METRICS=false timeout 280 npm run smoke` (read SMOKE PASS from the log; exit 124 is the expected timeout kill). Kill leftovers with `pkill -9 -f "wrangler-dist"` then `pkill -9 -x workerd`.

## Out of scope (do not touch)

Interco and virtual move (design-gated), the held trim rework (Finish Parent, TRI NUG SHA, waits on the naming doc), the marketplace order-fulfillment inventory consequence (owner-owed talk-through), anything under canon/ or prompts/, all vendored files, wrangler.toml, package.json dependencies (zero new deps).

The Scribe re-verifies the entire gate on your return, hash-syncs the tree, and reads your session report. Leave the tree clean.
