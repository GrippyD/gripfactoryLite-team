# Cursor slice: the Interco Logistics rework, the map is the module (canon 0.23.0 through 0.25.0, cut 2026-09-05)

You are building the ratified Interco rework in the Gripfactory Lite repo (`app/`). The Scribe cut this prompt from canon; canon wins over everything here. Read `canon/_NOW.md`, `canon/MEMORY.md`, and `canon/CANON.md` first, especially the 0.23.0 map decode, the 0.23.1 Med collapse law, the 0.24.2 silo law, the 0.24.3 barn pick basis, and the 0.25.0 ratification. The owner's flow diagram is vendored at `canon/interco-flow-map.png`.

**SEQUENCING: this slice STACKS ON the marketplace and trim-gate slice (prompts/2026-09-05_marketplace_trim_gate_slice.md). Run that one first; this slice's migrations start at 0028 (0027 belongs to the marketplace slice). If you are somehow running this first, STOP and tell the owner.**

## Rails that bind you (non-negotiable)

1. No git remotes, no pushes, no GitHub (G-1). Local commits only.
2. NO em dashes or en dashes in ANYTHING you write: code, comments, strings, docs, the session report (G-8). Plain hyphens, commas, colons. The gate greps bytes; vendored files are the only exemption.
3. Migrations are APPEND-ONLY: 0001-0026 are deployed and frozen, 0027 is the marketplace slice's. Yours start at `0028_...`. Postgres-portable SQL only.
4. Never touch the TBD ids in wrangler.toml. Never deploy. Never touch the marketplace or trim surfaces this slice.
5. Never edit anything under `canon/` or `prompts/`, never edit vendored files (saleshelper pair, T3 templates, icons, src/vendor/*, the Continuum stylesheet).
6. Every display string through `src/i18n.ts` (EN and ES). Every state change reasoned into record_change_log (insertLog seams, SYSTEM_REASON). Grams 2-decimal, formatGrams for display.
7. THE ONE-EXPORT-HOME LAW stands absolute: every METRC-bound CSV downloads and marks uploaded at `/admin/uploads` ONLY. The new surfaces pend rows there and carry NO export or download buttons.
8. The PIN (21319 in app_config) keeps gating /interco* exactly as today.
9. G-10: write `SESSION_REPORTS/2026-09-05_interco_rework_slice.md` with the sealed final check (tsc, vitest counts, dash audit, smoke, byte sizes and sha256 of every touched file) pasted verbatim.
10. Zero new dependencies.

## The design in one sentence

The map is the module: /interco opens to the floor (three sites, their barns, the trucks on the road, PNN's two rooms and the door), the crew picks PLACES and never picks a license, geography decides the paperwork, and every Finish pends its CSV at the one export home.

## The laws this slice embodies (owner verbatim in canon; build to these)

- Barns are the universal inbox and outbox: "barn" in METRC means it is here, at every site (0.23.0).
- "Get's converted to 832 on arrival regardless": anything arriving at PNN becomes 832 (0.23.0).
- Building 23 is the processor: "Everything in this building must be under 694"; externals ship from Building 23 only (0.23.0).
- The 832 side is Building 24, the silos, and CSA; METRC sees one word, barn. "Silos are inherently from PNN"; "832 should include the silos" (0.23.1, 0.24.2).
- CSA is the post-dry staging and late-season flexible storage that STAYS 832 (0.23.1).
- The CSA to CSB crossing fires at trim readiness and is a virtual manifest; coming back always lands the Barn (0.23.1, 0.19.0).
- "in interco logistics, we need to remove dry spaces. I think it's barn. It's always barn. At all sites" (0.24.3): interco sends pick from the barn ONLY; dry spaces leave every interco surface.
- Map-as-home ratified: "I think that's fine, let's play with it and see what we think" (0.25.0). Build it clean; the owner adapts on sight.

## Migration 0028: per-site barns and the side convention v2

- lookup_values inventory_location gains `ARL BARN` and `PNS BARN` (labels the owner can retone in Admin). REACTIVATE the soft-retired CSA row (clear its deleted fields with a reasoned comment in the migration: the 0.24.2 silo law restores CSA as the 832-side post-dry staging; the 0021 cutover note stands as history).
- DATA CUTOVER: local_inventory_items sitting in BARN whose harvest batch's farm is ARL move to ARL BARN; PNS likewise (join through the item's harvest_batch_id to the batch's farm; items with no batch linkage stay put). PNN items stay in BARN. IN-TRANSIT rows untouched.
- Side convention v2 lands as DATA IN CODE, not schema: a `SITE_OF_LOCATION` map in src/config.ts beside the existing helpers: BARN, CSA, and the silo dry spaces are PNN 832-side; ARL BARN is ARL (AU-G-C-001509 side); PNS BARN is PNS (AU-G-C-001397 side); CSB and every unknown location default PROCESSOR side under 694 (the owner adds Building 23 spots in Admin freely; the fallback must hold). Rewrite isPickableProcessorDestination and its kin on top of this map; pin the fallback in a test. Comment the law lines verbatim.

## The surfaces

### 1. /interco is the floor (map-as-home)

Replace the Interco menu page with the floor: three site panels in a row (ARL, PNN wide in the middle, PNS), phone stacks them vertically.

- Each site panel: site name, its license chips (blue AU, yellow Med per the existing tone classes), and its BARN contents: ledger items at that site's barn location plus wet lots physically at that site (numbered simple rows per the 0.22.0 wet queue law where lots render). ARL's panel carries the law line that everything there ends in ARL's AU license.
- PNN's panel is two rooms with the door between: the 832 side (BARN with its items, a CSA group, and the note that arrivals become 832 regardless and that silos ride this side) and BUILDING 23 (its locations with item counts, everything under 694, and the external strip: "All external destinations ship from here" with [Ship external]).
- The door column between PNN's rooms: [Cross the door] linking the door page, with the CSA-to-CSB-at-trim-readiness note.
- ON THE ROAD: a strip listing everything in transit: wet truck lots (status in_transit, Truck N labels, the 0.22.0 inbound-trucks law generalized) and manifested interco movements not yet received, each chip naming origin, destination, contents, weight, with [Receive at <site>] linking that site's arrivals page.
- Per-site [Send material] and [Arrivals] buttons. The one-export-home footer note.
- The old /interco/outbound and /interco/receiving GET routes 302: outbound to the new external-ship surface (below), receiving to /interco/arrivals/pnn. Nothing 404s.

### 2. /interco/send/<site>: sends pick from the barn, only

Two panes (ADR-8). Left: the site's sendable material, BARN ONLY (fork C law): the barn-located ledger items and the site's barn-resident wet lots, checkboxes, numbered simple rows. NO dry spaces anywhere on this page. Right: the picked summary (count, total grams), then WHERE TO as lane cards (radio cards, one per lane FROM this site per the map: ARL to PNN; PNS to PNN; PNS to ARL; PNN to ARL), each card stating its consequence in words: destination barn, the license it becomes on arrival (PNN lanes: becomes 832 on arrival, regardless; ARL lanes: lands ARL's AU), and the lane's purpose line from the map (mostly ships north; wet comes back to hang). NO license picker exists on this page; a muted line says so ("No license picker. The lane knows."). Truck staging (next number, becomes real at Finish). T3 header details ride a collapsed block, recalled from the last manifest (existing recall seams). [Finish Outbound Shipment]: one action, flips picked items to IN-TRANSIT, creates the movement with origin and destination licenses DERIVED from the lane, stages the truck, pends the T3 manifest at /admin/uploads (kind manifest, existing plumbing). 

### 3. /interco/arrivals/<site>: every site receives

Two panes. Left: everything on the road TO this site: wet truck lots and manifested movements, Truck N headers. Right, on pick: the truck's lines with the manifest quantity and an overridable weight-to-receive (existing receiving idiom), per-line receive and reject, [Receive all], the consequence banner stated plainly ("Everything on this truck lands <SITE> BARN and becomes <license> on arrival"), and [Finish Receipt]: lands material at the site's barn location with the license side derived from SITE_OF_LOCATION, pends the receiving CSV (kind receive_manifest, RECEIVE_CSV_HEADER provisional as ever) at the one home. At PNN the reasoned Move To pencil on the received lot stays the silo-assign-on-receipt (0.23.1: receipt is the moment of identity and location). ARL receives wet for hang dry (the map law); PNS receives symmetrically.

### 4. /interco/door: the Building 23 door (the virtual move, reframed)

PNN only. Left pane: the 832 side (BARN and CSA items, checkboxes). Right pane: Building 23 locations with counts. Center: two direction cards: INTO BUILDING 23 (pick a landing spot from the processor locations, CSB first; the consequence line: crossing becomes 694, a separate business; fires at trim readiness) and BACK OUT (no pick to make: always lands the Barn). [Finish move] records the virtual movement (existing virtual-move plumbing) and pends its manifest at the one home. /virtual-move and its subroutes 302 here; the existing logic transplants, it does not rewrite.

### 5. Ship external: the T3 outbound builder, scoped to Building 23

The existing outbound surface survives as the EXTERNAL lane only, reached from the Building 23 strip: picks are Building 23-side items (never barns, never dry spaces), the full T3 header form stays (destination, transporter, driver, vehicle, route), Finish Outbound Shipment semantics unchanged. Route it at /interco/ship-external (the old /interco/outbound 302s to it).

## Explicitly OUT of this slice

- The Med paper door's MANIFEST EMISSION (1132 to 832 at the barn): the map draws it and the panels may carry its law line, but emitting that manifest waits on tag-level modeling and the owner's naming conventions doc (the same gate holding the trim rework). Do not model Med tags.
- The marketplace and trim surfaces (the other slice owns them).
- Dry space management itself (unload, drying) is untouched; only INTERCO stops picking dry spaces.
- Anything under canon/, prompts/, vendored files, wrangler.toml, dependencies.

## Tests and smoke (pin the new laws; update stale pins, never delete history)

- vitest: SITE_OF_LOCATION pins (BARN and CSA and silos PNN-side, ARL BARN and PNS BARN their sites, unknown defaults processor); the floor page renders three site panels and the road strip; send pane contains NO dry space and no license select; lane cards carry the consequence lines; finish outbound derives licenses from the lane; arrivals lists both truck kinds; finish receipt lands the site barn; door back-out always lands BARN; 302 pins for /interco/outbound, /interco/receiving, /virtual-move; PIN still gates every /interco route; i18n EN and ES for every new string.
- The 0028 cutover: a test or smoke assertion that an ARL-batch item lands ARL BARN after migration (smoke's from-zero apply plus a walk covers it).
- smoke: walk the whole floor: send from PNS to PNN (barn pick, lane card, finish, truck appears on the road), receive at PNN (overridable weight, finish receipt, item in BARN), cross the door both ways (into CSB, back to BARN), ship external from Building 23, every CSV pending at /admin/uploads and NOWHERE else, old routes 302. Expect "About to apply 28 migration(s)" from zero (or 29 if the marketplace slice added two; read the actual count and pin what is true).
- The full gate you run and paste: `npx tsc --noEmit`, `npx vitest run`, the dash audit over every touched file (expect 0), `rm -rf .smoke-persist && SMOKE_PORT=<fresh> WRANGLER_SEND_METRICS=false timeout 280 npm run smoke` (SMOKE PASS from the log; exit 124 expected). Kill leftovers: `pkill -9 -f "wrangler-dist"` then `pkill -9 -x workerd`.

The Scribe re-verifies the entire gate on your return, hash-syncs the tree, and reads your session report. The owner plays with the floor and adapts; build it exactly to canon and leave the tree clean.
