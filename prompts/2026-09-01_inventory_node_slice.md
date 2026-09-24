# Builder prompt: the Inventory node + Acquire HBN recall (comprehensive)

**Issued by the Scribe, 2026-09-01, canon v0.12.1. Owner order: "Be COMPREHENSIVE. We've learned a lot about the inventory flow from all these projects and I don't want a ton of tidy work."**

You are a builder agent in the Gripfactory Lite repo. Before anything: read `canon/_NOW.md`, `canon/MEMORY.md`, `canon/CANON.md`. Canon wins over this prompt where they disagree. The design source for the sheet is the owner's mock at `canon/inventory-sheet-mock.png`; open it and keep it beside you.

## Laws that bind this slice (from canon, do not relitigate)

- No em or en dashes in anything you write; byte-level audit must be 0 per touched file.
- Migrations are append-only; this slice's schema lands in NEW numbered files (0013+).
- Every displayed string through `t(locale, key)` (en + es); storage identifiers snake_case English.
- Grams numeric 2-decimal, cent-exact math via existing helpers; every displayed gram through `formatGrams`; machine CSVs raw.
- Audit law: every insert through `logsForInsert`, every void reasoned, actor injected server-side.
- Terms law (canon 1b): HBN = the METRC harvest name; Lot = YY###; Package ID = METRC package. Short lot id law: lots render as `shortLotId` downstream of unload.
- CSV interface law (owner, verbatim): "All modules that change a regulated inventory state are going to need a csv to interact with METRC and many will need them for Zoho. Give the setup our full attention, when it's time." This slice DOES NOT build those CSVs; every button page it stubs must name its future CSV in a muted line, and nothing you build may make those CSVs harder later.
- Both views (Cerberus default, Lite) must render every new surface correctly; test both.
- Verification bar: `npx tsc --noEmit` clean; `npx vitest run` all green; migrations 0001 through your head apply clean on a fresh persist dir; full smoke SMOKE PASS (`SMOKE_PORT=<fresh> WRANGLER_SEND_METRICS=false timeout 280 npm run smoke`, PASS read from the log, `pkill -x workerd` after, never a self-matching `pkill -f`); sealed final check (wc -c, sha256, tails) in a session report at `SESSION_REPORTS/`.

## Part 1: the Inventory sheet at /inventory (replaces the reserved stub)

The [Inventory] tile exists, PIN gated, landing on a stub. Replace the stub with the sheet. The tile drops its `tile-stub` styling. Layout per the mock, top to bottom.

### 1a. Buttons row (first, above everything)

`[Change Locations]` `[Upload Inventory to Zoho]` `[Physical Inventory Audit]` `[Location Audit]`

Each is a real button routing to its own PIN-gated reserved page (`/inventory/change-locations`, `/inventory/zoho-upload`, `/inventory/physical-audit`, `/inventory/location-audit`), styled like the Admin landing buttons. Each reserved page carries: its title, a muted "Reserved. Awaiting the owner's talk-through." line, and a second muted line naming its future data interface per the CSV law (Zoho upload: a Zoho items/adjustments CSV; the audits: reconciliation reports; Change Locations: METRC location-move CSV). Do not invent their workflows; each is its own future box.

### 1b. WIP Inventory, section Drying (default collapsed)

One circle (a styled tile; under Cerberus these read as gauge circles per the mock) per NON-TRUCK dry space (kinds silo, hang, plus rooms), rendered from `dry_spaces`, showing:
- the space name (SILO 1 ... ARL DRY ROOM per the mock),
- `[LOT]`: the short serial(s) of the lot(s) currently drying there (status `drying`, joined via `dry_space_id`), stacked when several,
- time since start per lot: now minus the lot's finish-into-drying time (its status flip timestamp; `updated_at` of the entry is acceptable, note the approximation), rendered as `Nd Nh`,
- projected dry weight: the lot's wet `weight_grams` times the projected yield ratio.

**Projected yield is a value in data (canon L-4):** new `app_config` row `projected_dry_yield_pct`, seeded `'22'` by your migration, read at render, flagged on the page with a muted `(x% of wet, editable in app_config)` note. THE SEED NUMBER NEEDS THE OWNER'S RATIFICATION; 22 is the Scribe's placeholder and the fold will flag it.

Below the circles, two collapsible totals (`<details>`, default collapsed, matching the pane-group pattern):
- **Total Wet Weight drying**: sum of `weight_grams` over all drying lots; expands into the lots and their contributions (short id, strain, space, wet grams).
- **Total Projected Dry Weight**: the same lots at the yield ratio; expands likewise.

Empty spaces render their circle with a muted "empty". Trucks never appear here (they are Inbound, not drying).

### 1c. WIP Inventory, section In Production (default collapsed)

Four collapsible totals per the mock. Honest data mappings; where the pipeline lacks the stage, render the row with a muted "awaiting pipeline stage" note rather than inventing data:

| Mock row | Data source | Status |
|---|---|---|
| Waiting to be Trimmed total weight | sum of `dry_weight_grams` over status `unloaded` lots (the Unloaded Queue); expands into lots | SOLID |
| Waiting to be pasteurized total weight | NO STAGE EXISTS YET in the pipeline | render with the muted note; OWNER MAPPING NEEDED |
| Waiting to be shipped for extraction total weight | non-bud wip_packages (package_types.is_bud = 0) in status `created`: the extraction-bound trim and shake | PROVISIONAL, flag in the fold |
| Total Dry weight in inventory | unloaded lots' dry totals plus all live (non-voided, non-released) wip_packages weights | SOLID, expands into both groups |

### 1d. WIP Inventory, section In Testing (default collapsed)

Per the mock, "representative weight" is NOT the sample weight; it is the weight of the package the sample represents.
- **Total representative weight scheduled for testing**: wip_packages in status `cryo_queue` (weighed, awaiting the testing chain), sum of package `weight_grams`; expands into packages (package code, short id, strain, weight).
- **Total representative weight in testing**: wip_packages in status `testing_queue`, same shape.
- **First Time Fail Rate pareto by lab**: the release flow records outcomes (`TEST_OUTCOMES`: passed, failed, other) but NO LAB and, verify this in the schema, possibly no per-package outcome persistence. Read the release flow (`runQueueControl` release) first. If outcomes persist per package: render the pareto from real data grouped as "(no lab recorded)" until a lab exists. If they do not persist: your migration adds outcome persistence (a column on wip_packages set at release). EITHER WAY do NOT add a labs lookup or a lab picker in this slice; that changes the release station and is OWNER-GATED. Render the pareto shell per the mock (bars, descending) from whatever real outcome data exists, with a muted "lab capture awaits the owner" note. No fabricated bars.

### 1e. FG Inventory (default EXPANDED, per the mock)

"A graphical representation of the inventory in Zoho (aka ready to be sold)." The Zoho data ALREADY LIVES IN THIS WORKER: the vendored SalesHelper `menu.json` served through the ASSETS binding (see the /fulfillment routes). Fetch it server-side via `c.env.ASSETS.fetch`, parse, and render:
- a graphical breakdown by type (PRE, BUD, MIX, SHA, MOB, NUG, TRI, WBP, VAPE, IPR; the SalesHelper naming convention, its canon is read-only law) as horizontal bars or tiles sized by stock,
- clicking a type expands the item list matching that criteria (name, stock) per the mock's "whatever is used as a graphical representation when clicked will uncover a list of items that fit that criteria",
- the data-age line from the file's `dataAsOf`/`builtAt` rendered honestly (this file is the 2026-08-11 static until the refresh lane exists; say so in a muted note).
Handle a missing or unparseable menu.json with a muted "Zoho data unavailable" row, never a crash.

### 1f. Sheet plumbing

- All sections server-rendered, one GET /inventory handler; no client framework; `<details>` for collapse (matching pane-group), the mock's default states respected (everything collapsed except FG).
- A CSV export of the sheet's flat numbers (`/export/inventory.csv` through the existing export path or a dedicated route): section, row, grams. The Box Contract demands a report out.
- Every total through `formatGrams`; counts plain.
- i18n every label (en + es).

## Part 2: Acquire HBN recall pane (owner ruling, verbatim)

"Right pane (to the right of the working pane) in Acquire HBN should show HBN numbers that have been deployed but not yet had any weights attached. A button next to each entry with an icon, helptext: 'recall HBN'. This removes it from the list and exposes the field values as they were stored in the form. If there is partial information entered, a warning will appear prompting the user that unsaved HBN data will be lost."

- Acquire HBN keeps its plain mint form (ADR-8's standing exception) and gains a RIGHT pane beside it: minted batches (status open) with ZERO non-voided wet_weight_entries, newest first, each row showing the HBN and a recall button (an icon, a curved back arrow character is fine, with `title` helptext "recall HBN", i18n).
- Recall semantics (Scribe's reading of the mint law, FLAGGED FOR THE OWNER in the fold): recall soft-deletes the batch with reason "recalled" (audited), which removes it from the pane AND from the HBN Queue; the form repopulates with the batch's stored field values (date, farm, grow method, strain, manicure, silo, start time, zone, rows, METRC tag) via redirect query params or a server-rendered prefill; saving mints a NEW HBN and the voided serial stays a gap, because serials are never reused (ADR-6).
- The unsaved-data warning is client-side: intercept the recall click with a small inline script; if any form field carries user input, `confirm()` with the i18n text "Unsaved HBN data will be lost."; proceed on OK, abort on cancel. (Note: `confirm()` is fine on floor browsers.)
- The pane renders under both views and collapses gracefully on narrow screens below the form.

## Migrations for this slice (0013+, append-only)

One migration file covering: the `projected_dry_yield_pct` app_config seed; outcome persistence on wip_packages IF your reading of the release flow shows outcomes are not persisted (verify first); NOTHING for labs. Comment blocks cite the owner rulings and this prompt.

## Tests and smoke

Unit and surface tests in the existing suites' idioms for: every sheet section's mapping (fixture-driven), the yield ratio config fallback, collapse defaults, FG parse and click-through render, empty and missing-data states, the recall pane query (only weightless open batches), recall action (void + audit + prefill), the confirm-guard markup. Smoke: walk the sheet after the existing walk has data in every solid section (drying, unloaded, packages, cryo, testing), assert each total against the walk's own numbers cent-exact, expand one details group, FG section renders with the data-age line, all four button pages 200 behind the PIN; mint a batch, recall it from the pane, assert it left the HBN Queue, the form prefilled, and the change log carries the reasoned void; re-mint and assert the new serial is one past the recalled one.

## Definition of done

tsc clean; all tests green; migrations apply clean from zero; SMOKE PASS; dash audit zero; both views rendered correctly (screenshot if you can, describe if you cannot); session report with the sealed final check; a list of every PROVISIONAL and OWNER MAPPING NEEDED marker you shipped, verbatim, for the Scribe's fold.
