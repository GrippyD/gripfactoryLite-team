# Builder prompt: the reconciliation gate, Virtual Move done properly, CO inverted, device-pill icons

**Issued by the Scribe, 2026-09-04, from the owner's next dictation (canon 0.19.0). Read this whole file before writing code.**

## Sequencing: this slice STACKS ON THE WALK SLICE

`prompts/2026-09-04_interco_menu_walk_slice.md` (migration 0020, the Interco menu, the seven licenses, the exact icons) must be fully landed in this tree before you start. If it is not, STOP and run that prompt first. This slice's only migration is **0021**; migrations 0001 through 0019 are frozen (deployed), and 0020 belongs to the walk slice: never edit it here.

## Read first, obey always

1. `canon/_NOW.md`, then `canon/MEMORY.md`, then `canon/CANON.md`. Canon wins; flag disagreements in the session report.
2. Guardrails: G-1 (no remotes), G-8 (NO em or en dashes anywhere you write; byte audit 0; vendored files exempt), G-9 ship-clean, G-10 sealed report. One new migration file: 0021.
3. House laws: t() with es for every display string; reasoned audit on every state change; display grams comma-grouped, machine surfaces RAW; three view sheets plus phone for every new surface; PIN map unchanged; /reports unPINned; vendored files never edited (saleshelper pair, T3 CSV pair, the icon set); overissue law: FLAG, NEVER BLOCK (0.16.3, extended by this slice); never deploy c10; TBD wrangler ids stay TBD.

## Part 1: device pill becomes icons (owner: "Instead of 'Computer/Phone' make them icons")

The Computer/Phone view pill segments render small inline SVG glyphs instead of the words: a monitor (rounded rect on a stand) for computer, a phone (tall rounded rect with a home dot) for phone. House stroke style (currentColor, stroke 2 to 2.5, viewBox 24, aria-hidden), sized to the pill text height (about 1.1em). Accessibility keeps the words: aria-label and title carry the existing i18n strings in both locales. These are chrome glyphs, NOT the operations map set; the exact-files law does not govern them, and the map's vendored icons are untouched. All three sheets and phone mode render the pill correctly; the active-segment styling carries over.

## Part 2: the Continuum view inverts (owner: "Make the continuum theme inverted (dark colors on background, light colors to foreground)")

coStylesheet() flips: Christine Selden's DARK variant (her own tokens: dark ground, light foreground, the amber holding) becomes the CO look in BOTH color schemes; the paper-light rendering retires from the pill. The vendored stylesheet at prompts/2026-08-17_continuum_styles.css is NEVER edited; this is a translation-layer change only, and her light tokens stay in the file for the day the owner flips back.

- Re-check every CO-specific decision against the dark ground: --key-sheen (the dim value is now the always value), the softkey shadows, tone chips (blue, yellow, green must read on dark), .field-help contrast, table stripes, the Admin and Reports fabs, the boot bar and lockup (CO never had the Cerberus scrawl; keep it that way).
- **Icon variant amendment (supersedes the walk slice's CO rule):** CO now uses /icons/white/ ALWAYS, same as Cerberus and Lite. The dark set stays vendored and unused for now. Update the walk slice's variant toggle and its tests accordingly.
- Grip and Lite stay byte-untouched in look; only the CO sheet changes.

## Part 3: Unload Dry Space, the live overissue warning and the reconciliation gate

**3a. Warn at the weight, not after (owner: "When you go to or over the feeding package's inventory when adding weight on the right hand screen, you should be warned that you're about to over issue the parent package").** The ledger add row knows the parent item's current inventory qty and the session's running total (data attributes on the form). A tiny inline script warns BEFORE submit when the typed weight would make the total reach or pass the parent qty: an inline warning line plus a confirm on that submission ("This weight over issues the parent package. Record it anyway?" EN and ES). The server never blocks (flag law); after such an add the page renders a standing internal warning banner on the session (over issue amount, comma-grouped) as the source of truth. Both the [Add] button and the new [+] lane (3d) get the same guard.

**3b. The METRC reconciliation gate on Finish unload (owner, verbatim in canon 0.19.0: over issues are allowed but they need to be immediately addressed in METRC with an internal warning and either an adjustment, package finish, or nothing gate).** When [Finish unload] is clicked and the session's recorded total differs from the parent package's inventory qty, the finish confirm becomes THE GATE, one screen stating the delta plainly:

- Over issue (recorded > parent qty): headline internal warning ("Over issued by X g. METRC needs this addressed now."). Choices: **[Queue an adjustment CSV]** (pends the vendored Package Adjustments template for the delta, kind package_adjust), **[Queue a package finish CSV]** (pends the new kind package_finish), **[Nothing, just finish]** (proceeds bare; the warning logs), and **[Back to weighing]** (cancels the finish entirely, the owner's "anything else to weigh" escape).
- Material remains (recorded < parent qty): the ask is the owner's words, should the package be finished in METRC or is there anything else to weigh: **[Finish package in METRC]** (pends package_finish), **[Nothing, just finish]**, **[Back to weighing]**.
- Exact match: no gate, finish flows as today.
- **Spear-mode dedup:** a spear finish already pends the automatic Package Adjustments moisture CSV (0.17.0 law). In spear mode the gate's adjustment choice shows as already queued (the automatic one IS the adjustment); do not pend a duplicate. Bucked and silo sessions offer the full gate.
- **The package_finish CSV (PROVISIONAL SHAPE, flagged):** no vendored template exists for finishing a package. One constant `FINISH_CSV_HEADER` in src/interco.ts or a shared csv module: `Label,FinishDate`. One row per finished package, RAW, RFC 4180. Pend through metrc_uploads (kind package_finish, ref_id = the session id), listed on /admin/uploads with download and mark-uploaded. When the owner supplies a T3 finish template it lands as a one-constant edit.
- The gate generalizes (the owner: "this is basically always true"): build it as a reusable helper (delta in, gate choices out) so the trim rework's Finish Parent picks it up later; note the seam in the session report.

**3c. Finishing unload removes the package from the queue (owner's words).** On finish, the parent item's location leaves the dry space: it becomes **BARN** (see Part 4; the 832-side "it is here" location) for hang and silo sessions alike, unless the bucked-on-site "no" path already staged it onto an interco movement (that path wins). The dry space's resident list, the Outbound dry-space pane, and the Dry Space Queue all stop showing it immediately. The lot's queue walk (drying to unloaded) stays as it is.

**3d. The [+] rapid add (owner: "a plus sign next to the package adding button. It doesn't add a line, it adds the information to the next line and deletes what's in the text boxes. Save stays the same").** Beside the existing add button, a compact **[+]** control: submits the typed values through the same POST, and the page comes back with the entry appended to the list and the text boxes EMPTY, focus on the first box, ready for the next read (the plain add lane and Save keep their exact behavior). Server-side this is the same insert; the + variant just signals clear-and-refocus (a form flag). The 3a overissue guard rides both lanes.

## Part 4: Virtual Move done properly, and the BARN

**The owner's model (verbatim in canon): PNN Processor is the home for selling things and post harvest processing; PNN grow is just like another satellite farm; 832 to processor moves land in the processor's many inventory locations; processor to 832 moves land in ONE location, "barn", which is where material from all the sister farms lands as well, bucked or unbucked, wet and dry. The barn fork was delegated ("Do whatever is clever and we'll adapt"); the Scribe's ruling binds this build:**

**Migration 0021_barn_cutover.sql** (this slice's only migration, Postgres-portable):

1. INSERT the inventory_location row BARN (value BARN, label "Barn", sort 0, seed-style a2 uuid).
2. `UPDATE local_inventory_items SET location = 'BARN' WHERE location = 'CSA';` (schema-era cutover, commented; migration-lane data moves follow the 0009/0014 precedent).
3. Soft-delete the CSA lookup row (deleted_at stamped, delete_reason 'superseded by Barn, owner delegation 2026-09-04').

**Location side convention (zero schema, document it in code):** BARN is the ONLY 832-side location; every other inventory_location row (CSB and whatever the owner adds in Admin) is processor-side. The lookup pane's help text states the convention.

**Law updates across the code (replace every CSA reference):** silo unloads land BARN; hang unload finishes land BARN (3c); interco [Finish Receipt] lands material at farm PNN, location BARN; the reverse virtual move ALWAYS lands BARN. The T3 emission and receiving CSV, where a location rides, say Barn for the 832 side (their live METRC usage: barn means it is here).

**/virtual-move rebuilt on the walk-slice tools:**

- LEFT pane: every item at license AU-G-C-000832, grouped by location (the barn, mostly), checkboxes. RIGHT pane: every item at AU-P-000694 grouped by its processor location, checkboxes.
- **[Move to processor]**: requires a destination location pick (a select of the processor-side locations, CSB preselected as first by sort; the owner adds more spots in Admin and they appear here). Flips license to AU-P-000694, location to the picked value, reason inv_virtual_move, confirm names the count and the Building 23 crossing as today.
- **[Move to 832]**: no location pick, ALWAYS lands BARN. Same audit and confirm.
- Movement records and per-move manifest exports stay exactly as the strap-in slice built them (movement_kind virtual, T3 emission without transporter). The license tone chips from the walk slice render on both pane headings.
- "PNN grow is just like another satellite farm": no special-casing 832 anywhere in Interco; it lists and ships like ARL and PNS, and its physical inbound landings are the barn.

## Verification you owe (the Scribe re-verifies everything)

- tsc clean; vitest green with new tests: the pill glyph markup with aria-labels; CO dark-always tokens (both schemes) and the CO white-icon amendment; the overissue warning data attributes and the standing banner; every gate branch (over, under, exact, spear dedup, back-to-weighing canceling, nothing proceeding bare, each CSV pend landing its kind); finish clearing the item off its space (and the interco-staged exception); the [+] clear-and-refocus flag; migration 0021's cutover (a CSA item reads BARN after; the lookup row soft-deleted); the destination-location select on move-to-processor and BARN on the reverse; the side convention (barn excluded from the processor select).
- Migrations 0001-0021 from zero; full smoke PASS with new walks: an unload that over issues (warning banner, gate, adjustment pend), an under-issue finish (finish-package pend), the [+] lane, a virtual move to a picked processor location and back to the barn, and the receiving landing BARN. Keep every existing assertion green (many CSA assertions become BARN; update them, never delete them).
- Dash audit 0 on every file you write.
- Rendered pass read back: the inverted CO home and one CO station page (plus CO on phone), the pill icons in all three views, the unload gate on screen in both directions, Virtual Move with the location select open, and the barn showing in the inventory list.
- SESSION_REPORTS/2026-09-04_unload_gate_virtual_move_slice.md with the sealed check verbatim and OWNER flags: the package_finish CSV shape (T3 template wanted), the gate-helper seam for the trim rework, the location side convention, and anything the CO inversion forced you to decide.

## Do not

Do not touch canon/ or prompts/. Do not edit migrations 0001-0020. Do not add npm dependencies. Do not edit the vendored Continuum stylesheet, the T3 CSV pair, the saleshelper pair, or the icon files. Do not block an overissue anywhere. Do not deploy; the owner deploys by PS after the Scribe's gate.
