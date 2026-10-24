# PC1: the prepack plan (MRP on the prepack scheduler)

Filed by the Scribe on 2026-10-24 (canon 0.30.544). The owner's four picks, verbatim:
1. "Zoho is the source for now, it's the book of record.  We need to be cognizant of the fact that the three months after harvest are devoted to replacing Zoho and Tradogram"
2. "a" (the Zoho sales orders mounted at Fulfillment, Mount SOs: what shipped and what is still open)
3. "b-target lbs" (a target per strain, in pounds)
4. "a-the scheduler is the source of truth for the prepack line, the entry info from MOH in step 3 informs demand for the scheduler, test-passed WPR informs supply for the scheduler.  Real MRP stuff"

This is a planning view on the prepack scheduler, not a director tile: the director dashboard pause (canon 0.30.528) stands, and the MOH tile on the bizops wall is untouched.

Its own slice, after THE QUEUE, TWO is gated and merged. Pin: the tree the Scribe names in the paste. No git; nothing committed, pushed or deployed. One migration, `0121`. LF only. Read `src/fginventory.ts`, `src/fulfillment.ts`, `src/db.ts` (`listPrepackPanes` and its feed) and `src/scheduling.ts` (`prepackSchedulingPage`) by search and line range.

What today's data holds (the 2026-10-24 snapshot, for scale; never copy rows into fixtures):
- Zoho prepack: 16,001 bags, 1,000 lb, in 7 strains. The last Zoho inventory mount was 10-23.
- The Scheduled pane: 11 jobs, 429 lb, in 3 strains.
- The Available pane (test-passed WPR): 128 packages, 6,115 lb, in 13 strains.
- Sales orders mounted: none yet.

## 1. The plan
On `/production/scheduling/prepack`, above the three panes, a fold titled Plan (open by default). One row per market strain, in app pounds (448 g):
- **Target**: the strain's target, typed in Admin (section 2). Blank when none.
- **On hand**: Zoho's prepack stock (section 3).
- **Open**: prepack on Zoho sales orders not yet shipped.
- **Free**: On hand minus Open. It may go below zero; that is an oversold strain.
- **Scheduled**: the Scheduled pane's packages for the strain (the grams their ledger items hold).
- **Need**: Target minus Free minus Scheduled, never below zero. A blank Target counts as zero, so open orders past the stock still show a Need.
- **Ready**: the Available pane's packages for the strain (test-passed WPR).
- **Short**: Need minus Ready, never below zero.
- **Pace** (context, outside the netting): shipped prepack per month over the trailing `dd_moh_window_months` (3), and the months of Free at that pace. Blank when nothing shipped in the window.

The netting in one line: Need = Target - (On hand - Open) - Scheduled. That is the order-up-to rule with today as the one period. Weeks by expected ship date are a later slice (PC2), once sales orders are mounted.

The plan's picks: for a strain whose Need is above zero, the plan marks the Available packages that cover it. It takes the oldest lot first (`harvest_batches.entry_date`, then the package's `created_at`), whole packages only, and stops at the first package that covers the Need. Each marked row on the Available pane carries `data-plan-pick` and a "Plan" badge. The plan never schedules anything: the `>>` stays the only way a job is made, because the scheduler is the source of truth.

Rows are the union of strains with any of these: a target, Zoho prepack on hand or open, packages Scheduled, packages Ready. Sort by Short descending, then Need descending, then name, with a totals row.

The header carries two as-of stamps:
- "Zoho stock as of {time}": the newest `zoho_mounted_at` on the prepack listings.
- "Orders as of {time}": the newest `so_mounts` row. With no sales orders mounted, the header reads "No sales orders mounted yet", Open and Pace read blank, and Need leaves Open out.

The header also has a Targets link to `/admin/prepack-targets`.

The strain key: lowercase, trimmed, inner spaces single.
- Zoho's strain is the item name's second segment (`fginventory.itemStrain`).
- The app's strain is `COALESCE(harvest_batches.market_strain, strains.name)`, as the panes read it.
- A name on one side only still gets its own row, so a spelling mismatch shows as two rows instead of vanishing.

## 2. Targets (migration 0121)
- Table `prepack_targets`: `id`, `strain` (as shown), `strain_key`, `target_grams REAL NOT NULL CHECK (target_grams >= 0)`, `note`, plus the audit columns: `created_at`, `created_by`, `updated_at`, `updated_by`, `deleted_at`, `deleted_by`, `delete_reason`.
- A unique index on `strain_key` among live rows (`WHERE deleted_at IS NULL`).
- The migration is guarded (`IF NOT EXISTS`) and idempotent.

The page `/admin/prepack-targets` sits behind the Admin PIN, as every `/admin` page does, on the pattern of `/admin/field_estimates`:
- One row for every strain the plan knows, plus a way to add a strain by name.
- The target is typed in pounds (two decimals) and stored as grams (times 448).
- Every change takes a reason (`requireReason`). Clearing a target is a soft delete with a reason.
- Every change is logged to `record_change_log` the house way.

## 3. THE SWAP SEAM (Zoho behind two functions)
`src/prepackplan.ts` holds the only two functions in this slice that read Zoho's tables:
- **`zohoPrepackStock(db)`**:
  - Reads `listings` with FG Inventory's own rules: `FG_LISTINGS_SQL`, then `classifyListing(...) === "pre"`, then `itemStrain`.
  - Converts bags to grams by FG's each-grams rule (`prepackEach`, exported from `src/fginventory.ts` for this), so MOB reads 70 g and a PRE with no each grams reads `fg_pre_each_grams`.
  - Returns grams per strain key, and the newest `zoho_mounted_at`.
- **`zohoPrepackOrders(db, today, windowMonths)`**:
  - Reads `mounted_sales_orders` and `mounted_sales_order_lines` with `readout_category = 'PREPACK'`, deleted rows out.
  - Open: `quantity_ordered - quantity_invoiced`, never below zero, on orders whose `effectiveStatus` (`src/fulfillment.ts`) is not `shipped`.
  - Shipped: `quantity_invoiced` on `shipped` orders whose `order_date` falls in the trailing window.
  - Converts bags to grams by the listing's each grams, found by SKU, then by item name, then by FG's rule on the item's prefix.
  - The strain comes from `itemStrain(item_name)`.
  - Returns grams per strain key, and the newest `so_mounts` time.

Nothing else in PC1 names a Zoho table. The planner itself (`planRows`) is pure: inputs in, rows out, no database. When Zoho's replacement lands in the three months after harvest, these two functions are what change. Tradogram is out of scope: no packaging materials in PC1.

## 4. What a reader sees
- The plan table is `table.data` inside the app's report-scroll box (PH1's pattern), so it never scrolls sideways at 1920, 820 or the phone, in Lite, Continuum and Grip.
- Short above zero reads in the warn tone. Every new word goes through `t()` with a Spanish line, and no dash characters appear anywhere.
- The three panes, their `>>`, `<<` and `>` controls, the filter and the METRC adoption rows are unchanged, apart from the Plan badge on the picked Available rows.

## Tests
- `planRows`: fixtures for Target, On hand, Open, Scheduled and Ready give Free (including below zero), Need and Short with their zero floors, Need from open orders with no target, Pace and months (blank at zero pace), the sort and the totals.
- The strain key: case and spacing join; one-sided strains get their own rows.
- The picks:
  - oldest lot first, whole packages only;
  - stop at the first package that covers the Need;
  - none when the Need is zero;
  - the Available pane marks exactly those rows with `data-plan-pick`.
- `zohoPrepackStock`: PRE and MOB classification (MOB at 70 g), a PRE without each grams at `fg_pre_each_grams`, gone and inactive listings out.
- `zohoPrepackOrders`:
  - open against shipped by `effectiveStatus`, with `pick_status` overlaying Zoho's status;
  - a partly invoiced line;
  - the trailing window by `order_date`;
  - each grams by SKU, then name, then the rule;
  - the PREPACK category gate, deleted rows out;
  - no mounts at all gives the "No sales orders mounted yet" header and a Need without Open.
- Targets:
  - 401 without the PIN;
  - a change without a reason is refused;
  - one live row per strain key;
  - pounds in, grams stored;
  - the soft delete;
  - the change log rows.
- The scheduler page renders the plan above the panes, and the pane controls render as before.
- No dash characters in any output.

## Smoke and gates
- Smoke:
  - `About to apply 120 migration(s)` (THE QUEUE, TWO leaves 119).
  - Load `/production/scheduling/prepack` and check the Plan fold.
  - Set a target through `/admin/prepack-targets` with the PIN and a reason, and check the plan shows it.
  - Keep every other check.
- Gates:
  - typecheck 0;
  - vitest under TZ=UTC and TZ=America/New_York, with counts;
  - `node --check scripts/smoke.mjs`;
  - the from zero smoke in the background by the runner law (SMOKE PASS, SMOKE_EXIT 0, no 500);
  - dash, CR and name scans of every touched file.
- No renders (THE RENDER LAW): the Scribe renders and runs THE SIDEWAYS SWEEP at the gate.

## Hand back
Report `SESSION_REPORTS/<date>_pc1_the_prepack_plan.md`, short:
- the tree received and the tree left;
- the files touched;
- the gate results;
- anything decided or declined, and why.

Close with the tree hash and a line that nothing is committed, pushed or deployed.
