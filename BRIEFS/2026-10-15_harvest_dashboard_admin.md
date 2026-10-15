# AD1: Harvest Dashboard settings in Admin, with the three icon swaps

Filed by the Scribe on 2026-10-15 (canon 0.30.490) from the owner's word: "an Admin lookup node for anything that loads on the harvest dashboard, including these items which I made explicit but might want or need to change later" (the FG3 caps, truck size and THC bands), and "cue up the icon swaps with it".

For the build session (Claude Code or Cursor): open in `C:\Users\DennisWallace\Documents\Claude\Projects\gripfactory Practical\branches\GFLiteMetrcAPI` (its `app\` is the app). If your working folder is not under `branches\GFLiteMetrcAPI`, stop and say so. Under THE DISPATCH RULE (canon 0.30.155). Pinned to `538a482d575b322f`: the live tree (FG4) plus the Scribe's three icon swaps already on disk. Verify with canon's hash command in `app/` (`(find src test scripts migrations -type f; echo wrangler.toml; echo tsconfig.json; echo package.json) | LC_ALL=C sort | xargs sha256sum | sha256sum | cut -c1-16`, `wrangler.toml` read as LF) and stop if it differs. No git; nothing committed, pushed or deployed. One migration, `0104`. LF only.

## Already in the tree (do not redo; keep them passing)
The owner's three Fulfillment drawings, traced by the Scribe into `src/consoleicons.ts`: Shipping today (tractor trailer, viewBox 0 0 160 37, TRAILER_CARGO moved onto the trailer's inner panel so the stacked bar still lands inside it), Submitted (phone in hand, wrist cropped), Accepted (handshake). Each is one filled path; the two traced 100 by 100 icons and the trailer carry an 8,000 byte budget in the icon test, the drawn ones keep 5,000. `src/theme.ts` sizes the trailer in its pane.

## The law
1. ONE PLACE. A new Admin lookup section "Harvest Dashboard" (`/admin/lookups/harvest_dashboard`, its button on the Lookups landing under Harvest Operations, behind the Admin PIN like the rest of /admin). It lists every value in data that changes what /harvest shows, grouped by the pane it drives, each with its label, its current value, its unit and one line on what it does.
2. WHAT MOVES INTO DATA (migration 0104 seeds each as an app_config row with today's value, INSERT OR IGNORE):
   - FG inventory caps: Trim/Bio 40000 lb, Shake 5000 lb, Distillate 2000 L, Isolate 68000 g, Infused Bud 20000 g.
   - Truck size: 8000 lb.
   - Bud THC bands: the two inner edges and the top edge, 20, 25, 30 (percent; below 20 is the first band, 30 and up the last, no THC stays its own band).
   - The prefixes that are not finished goods: WBP, WIP, WPR, Biomass, FFZ (Zoho), and for METRC the same less Biomass.
   - The folded prefixes and their sizes: MIX to Bud, NUG to Bud, MOB to Ounces at 70 g each; an Ounces each without a size is 28 g.
   Code keeps the same values as fallbacks, so a missing or bad row never blanks the page; the page reads them in the read it already makes for app_config (no new round trip).
3. WHAT IS ALREADY IN DATA AND BELONGS ON THE SAME PAGE (listed, linked or editable in place, not moved): survey every `CONFIG_KEYS` value and every `lookup_values` category the /harvest handler and its panes read (for example btr_type_codes, silo_capacity_wet_lbs, projected_dry_yield_pct, extraction_type_codes, the farm plant counts, field estimates) and list them under their pane. Report the full list in the session report.
4. EDITING. Numbers take a number and refuse anything else (and refuse a cap at or below 0); lists are comma separated codes, trimmed and upper cased; the bands must stay increasing. Each save writes the change log the way the App config editor does today. A bad value is refused with a plain message, never stored.
5. NOTHING ELSE MOVES. Same rows, same colors, same rules on /harvest; only where the numbers come from changes. The current App config page keeps working.

## Performance
/harvest stays under 1 s on the live-data bench; the change adds no D1 round trip.

## Tests and the smoke
- Unit: each seeded key read back; a changed cap moves the red line (Trim/Bio at 30000 with 35000 lb is red and names 4 trucks); a changed truck size changes the count; a changed band edge moves a listing; a missing row falls back; each bad input refused (text, 0, negative, bands out of order); the change log row on a save.
- Smoke: /admin/lookups/harvest_dashboard answers 200 with every seeded key; a save of a cap shows on /harvest; the icon smoke checks stay green. One more check than main's.
- Gates: typecheck 0; vitest under TZ=UTC and TZ=America/New_York; node --check scripts/smoke.mjs; from-zero smoke, `About to apply 103 migration(s)`, SMOKE PASS, no 500. Dash and CR audits by character. Render /harvest (FG inventory and Fulfillment open) and the new Admin page at 1920 and 820 in Lite, CO and Cerberus. Report `SESSION_REPORTS/2026-10-15_harvest_dashboard_admin.md` with the tree hash, every file touched and the surveyed key list.
