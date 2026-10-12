# BRIEF HB1: THE HARVEST BATCH FEED (Corey's agent, third read-only ask)

Filed by the Scribe on 2026-10-12 (canon 0.30.436) from the owner's paste, verbatim below but for the dash audit (G-8) and this header. QUEUED, not yet dispatched: the Scribe pins it to the live tree at dispatch and names the worktree then (Worker only, no migration, so it can ride `branches/GFLiteMetrcAPI` beside T1's build in the Ops Dashboard worktree; one agent per worktree). The six Scribe assumptions below stand as defaults until the owner rules otherwise.

For the build session (Claude Code or Cursor): open in the worktree the Scribe names at dispatch, NOT the main folder `gripfactory Practical\app`; if your working folder is not under `branches\`, stop and say so. Under THE DISPATCH RULE (canon 0.30.155). Verify the pinned tree with canon's hash command before touching anything (run in `app/`, `wrangler.toml` read as LF): `(find src test scripts migrations -type f; echo wrangler.toml; echo tsconfig.json; echo package.json) | LC_ALL=C sort | xargs sha256sum | sha256sum | cut -c1-16`. No git; nothing committed, pushed or deployed.

---

## The ask, verbatim (Teams, Saturday 2026-10-10, 11:35 AM and 4:12 PM)

"Field Ops now records which strains are fully harvested at each farm. Right now GripFactory only tells us a lot's strain at trim or at the lab, so this season 49 of 76 lots in your dry spaces carry no strain on our side until they hit the trim line. Could you add a harvest batch feed on the same pattern as trim-weighs? GET /feeds/harvest-batches.json?since=<ISO>&limit=500. Same trimatron-puller token, read only, same envelope (next_since, more, rows). One row per harvest batch: id (stable), hbn (full batch number), short_id (the 26xxx serial), strain, farm (ARL, PNN, or PNS), facility (outdoor, greenhouse, or indoor), harvest_day, plant count if you track it, wet weight in grams, dry method (silo or hang), the space it went into, created_at, changed_at, and voided_at. With that, every strain on the brief shows its lots and wet pounds from the day it is cut, not the day it is trimmed. Nothing writes back to your side."

Follow-up: "An independent calc off GripFactory data puts Cereal Milk at 5.8 lb a plant, and I want the board register to run that same math every morning instead of waiting weeks for trim. The plant count on each batch makes that possible. If you can also add the dry grams for each batch at silo unload, the register can calculate pounds per plant for every strain the day after it is cut."

## The owner's disposition

Grant it. Read-only, same door, same pattern. No new token, no bypass, no write path.

## The pattern it rides (existing law)

- 0.30.137 THE TRIM WEIGHS FEED: /feeds not /api; outside the Admin PIN; Access alone fronts it; JSON, no-store; ?since= strictly after changed_at; ?limit= 1 to 2000 (500 default); ?live=1 drops voided rows; envelope feed, generated_at, since, count, next_since, more; a bad query answers 400 in words as JSON.
- 0.30.139 / 0.30.140: the trimatron-puller service token and the service actor guard. The new route goes under the same Service Auth policy; the token value never enters the repo or the canon (G-9).
- 0.30.141: the HBN is read back for farm, harvest_day, grow_code, silo, dry_method. ?site= filter on the same reading.
- 0.30.149: tie-safe paging (every package in one entry shares one change instant). The batch feed inherits the fix, not the bug. Real strain first, market strain beside it.
- 0.30.238: grow code in the HBN's 11th and 12th characters: ID indoor, OD outdoor, GH greenhouse.

## The row (one per harvest batch = one wet_weight_entries lot)

id (the lot's stable id, the puller's key); hbn; short_id (the lot serial, last 5 of the HBN); strain (the real strain) and market_strain beside it; farm (the HBN's second segment; the stored farm when the HBN is not a seven-segment mint); grow_method (indoor | outdoor | greenhouse from the grow code; null when the HBN does not read); ship it as grow_method, since "facility" already means the license on the trim feed, and the two must not collide; harvest_day (YYYY-MM-DD from YYDDD); plant_count (wet_weight_entries.plant_count, null until typed at Finish lot, Load Silo, or the pencil, 0.30.4x); wet_weight_grams (the live total of the lot's non-voided reads); dry_method (silo | hang from the HBN's silo segment, 0.30.141); dry_space (the space the lot went into: the silo, the hang room, or Truck N, as Move To / Load Silo last left it); dry_weight_grams (the live total of non-voided dry_weights rows from Unload Dry Space, 0.30.77; null until the first dry row); unload_finished_at (null until Finish unload; the R5 effective_date reading); status; created_at; changed_at; voided_at (null while live). hbn_parts rides as on the trim feed.

## changed_at, the widest reading

Any of: a wet read added, edited, or voided; the plant count typed or changed; a Move To; a Load Silo; a dry row added or voided; Finish unload; a reasoned edit to the lot record; the void. The puller must see a lot again whenever its wet, dry, count, strain, or space moved.

## Corey's math, what it buys him

Wet lb per plant the morning after the cut (wet_weight_grams / plant_count). Dry lb per plant once dry rows land, partial while unloading, final at unload_finished_at. Corey's register should read unload_finished_at before calling a dry figure final; the field is there so he can.

## Scribe assumptions for the owner's word

1. Field name grow_method, not facility (the collision above). If Corey insists on "facility", ship both names on the row, same value.
2. dry_weight_grams rides live while unloading (partial), with unload_finished_at as the "final" signal. Alternative: null until Finish unload. The owner picks.
3. Voided lots ride with voided_at set; ?live=1 drops them, as on trim-weighs.
4. A lot with no parsed HBN (Manual HBN, historical) rides with nulls where the HBN would have answered, never dropped.
5. Strain null when the batch has none; the puller displays whatever it has. Corey's "49 of 76 without strain" is his side's gap, not the app's, unless the owner says batches were minted without a strain.
6. ?site= filter as on the trim feed.

Scribe's addition, 2026-10-12: test HBNs (0.30.423, `is_test` 1) never ride; a toll lot (T1, once live, `customer` set) rides with its customer named in a `customer` field, null for Grip's own, so the register can keep GreenCo's material out of Grip's pounds per plant.

## Build shape

Worker only, no migration. src/feeds.ts gains the second feed on the same helpers; src/index.ts the route under the same guard; test/feeds.test.ts; scripts/smoke.mjs (the smoke lots keyed by id, a voided row's voided_at, live=1, since=, limit=1 with more and next_since, the two 400s, content type and no-store). Gates as standing: tsc 0, vitest both zones, node --check, from-zero smoke, dash audit 0. Session report under SESSION_REPORTS/.

## Owed to Corey after deploy

The URL; the word that the same token opens it; the field list as shipped; the note that dry grams are partial until unload_finished_at is set; the strain-null count on the first poll so his 49 can be reconciled against the app's own.
