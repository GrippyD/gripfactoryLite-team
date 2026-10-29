# _NOW: the single active line

**Updated:** 2026-10-29 (canon 0.30.564: FB1 ruled and briefed; the 08c2617 push done)
**Rule:** ONE box at a time. Read this, then MEMORY, then canon/CANON.md (re-pin the version). Not chat history.

## One-line status

Canon v0.30.564. OWNER RULINGS 2026-10-29 ON FB1, THE FULFILLMENT BOARD IN POUNDS (his own words, relayed by The Schmerblez King): R1: 448 g per lb. R2: option (c), Prepack is split by bag size (3.5, 7, 14, 28 g); one append-only migration and the bigger build. R5: lbs only, no original unit beside it. SCOPE: the Shipping Today, Submitted and Accepted cards everywhere they render, not only the Harvest Console view. PROPOSED DEFAULTS STANDING, OWNER MAY OVERRULE (proposed by The Schmerblez King, not overruled, not his words, not owner rulings): R3 two decimals, rounded half up, thousands grouped; R4 the label lbs; R6 the other eight rows keep their METRC units; R7 the existing public/brand/grip.svg (the GRIP mark of canon 0.14.0) as an outline on the Shipping Today trailer, centered at full panel height, in the icon's own stroke color and weight; R7d the outline always shown, empty days included. THE BRIEF: BRIEFS/2026-10-29_fulfillment_board_lbs.md (FB1), base main 08c2617, branch fb1-fulfillment-lbs, PR into main; one migration 0125_fulfillment_prepack_bags.sql (ALTER TABLE fulfillment_overrides ADD COLUMN bag_grams NUMERIC; 0124 is held by LD1 on GFLiteOpsDashboard); Prepack cells by bag size as row_key prepack@<size> with bag_grams written at save, sizes from prepack_units; lbs = sum(count x bag grams) / 448 and Bulk Bud grams / 448; the bar on real grams; legacy unsplit Prepack rows kept, never split by guessing, visibly flagged, not converted to lbs. OPEN FOR HIS WORD: R8 the legacy Prepack rows; R9 the deploy order of LD1 (0124) and FB1 (0125); R10 whether the flat fulfillment_unit_grams prepack=28 is retired; R11 whether an unsplit Prepack count may still be typed. THE PUSH: 08c2617 (canon 0.30.563) on origin main, verified read only: main equals origin/main at 08c2617426b407f6fdf6ca5f3455dbcc7fd2b930. HELD: the LD1 opening-balance repair still waits on the LD1 deploy (GFLiteOpsDashboard into main, the owner's call), the Master Disti export and Patrick's BowHouse steer; it runs at the owner's keyboard after a pre_ld1_open snapshot. The Ops worktree (GFLiteOpsDashboard at 4b4e926) is untouched by this fold. NEXT, in order: (1) the FB1 dispatch by The Schmerblez King after this push; (2) the opening-balance repair, held; (3) A4 after the LD1 deploy. ADVISORY, OPEN: A1 and A3. Open: AR1's four rulings; the investigator's two answers; CT1's Version ID and KPI_FEED_TOKEN. The 0.30.563 status line and Updated line are in canon/_NOW_ARCHIVE.md, verbatim.

## Open box: go-live hardening

- **Owner-parked (his words, waits on weights landing first):** traveler printing per dry weight, and the METRC Package ID flow (Package ID + container weight + x of n per traveler, reduced to a dry total of a package ID). Do not design these until Dennis rules.
- Owed tonight (Dennis): the 26H workbook Abbr one-cell edit (Blue Andeez 071 → 078).
- Vendored-pair law: app/public/saleshelper/{index.html, menu.json} are never edited in place, only replaced by copy from the SalesHelper repo; the same for app/public/harvest-console/harvest-console-lite.html (canon 0.30.27), replaced by copy from Projects\Harvest Console Lite\lite\. The Lite app's own changes are built in THAT folder (LITE-CANON.md there, version bump in the file), then re-vendored here (canon 0.30.33).

## Next

Wipe on the words, then B05/B10 deepening talk-through (who weighs where, manifests, hang vs silo differences) after go-live hardening, then B03/B04 in map order.

## Parked / future

Theme token sets (Grip, C10) · c10 deploy for Christine · console incorporation shape · product name · ABC column meaning · Zero Trust org label rename · server-side Move To enforcement · Access JWT (AUD) hardening · PIN editable in Admin · Fulfillment follow-ups (menu refresh lane, /api/send capture, Corey's pages.dev copy)

---
*Resume: read this, MEMORY, canon (re-pin version), acknowledge, wait for Dennis.*
