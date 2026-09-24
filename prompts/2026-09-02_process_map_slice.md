# Builder prompt: the process map home + Import Data queue (the mega slice)

**Issued by the Scribe, 2026-09-02, from owner rulings of the same day. Read this whole file before writing code.**

## Read first, obey always

1. Read `canon/_NOW.md`, then `canon/MEMORY.md`, then `canon/CANON.md`. Canon wins over this prompt where they disagree; flag any disagreement in your session report instead of resolving it silently.
2. Guardrails that bind you: no git remotes, no pushes, no GitHub (G-1). NO em dashes or en dashes in anything you write, code and comments and reports included (G-8; byte-level audit must read 0). Migrations are append-only: 0001 through 0014 are frozen; this slice adds exactly one new file, 0015. Ship-clean (G-9). Session report with the sealed final check pasted verbatim (G-10): byte sizes, sha256, tsc, tests, migrations-from-zero, SMOKE PASS.
3. House laws that touch this slice: every display string renders through `t()` in src/i18n.ts with an es value (storage identifiers stay English); the pipeline registry is data (src/pipeline.ts declares, renderers render); every state change logs reasoned into record_change_log; grams law untouched; the three view sheets (lite, cerberus, co in src/theme.ts) each style every new surface in their own idiom; the phone device mode must reflow everything new; the PIN gate stays exactly where it is (/admin*, /interco, /fulfillment*, /inventory*); the vendored saleshelper pair is never edited; never deploy c10; the TBD ids in wrangler.toml stay TBD.
4. The bottom-right Admin button (0.15.2) and [Demote] (0.15.3) are live; do not disturb them.

## Part 1: the home page becomes the operations map

**Owner ruling, verbatim:** "Acquire HBN behind an icon of the a field - label 'Harvest Operations', the new Harvest Operations / Draw an arrow from the field icon to a new icon of a semi truck - 'Interco Logistics' - another arrow to: 'Drying Operations': contains unload dry space and 'virtual move to processor'-orange barrelled - the icon can be a silo-an arrow pointing down to the row underneath and a new icon: 'Production Operations' - a factory - Trim, cryo, fulfillment, inventory / 'Marketplace' - orange Barrelled for now, will be our FG inventory and order placing surface.-left arrow / 'Business Operations' - Contains compliance console and purchasing - Piggy Bank"

**Scribe rulings folded with it (owner answered 2026-09-02):** Wet Weight Entry lives in Harvest Operations beside Acquire. Group icons navigate to subpages (/ops/<group>), not expand in place. The Compliance Console tile is an orange barrel for now (its URL comes later); Purchasing likewise. The old flat tile grid leaves home entirely; the Admin FAB and the Home/Log nav carry everything else.

### The map registry (data first)

Add an `OPS_GROUPS` registry to src/pipeline.ts, the single source the map and the subpages render from:

```
key: harvest_ops        label: "Harvest Operations"     icon: field       members: acquire_hbn, wet_weight
key: interco_logistics  label: "Interco Logistics"      icon: truck       members: the existing /interco page
key: drying_ops         label: "Drying Operations"      icon: silo        members: unload_dry_space, virtual_move_processor (reserved)
key: production_ops     label: "Production Operations"  icon: factory     members: trim_packages, cryo_weight, fulfillment, inventory
key: marketplace        label: "Marketplace"            icon: storefront  reserved group ("will be our FG inventory and order placing surface")
key: business_ops       label: "Business Operations"    icon: piggy_bank  members: compliance_console (reserved), purchasing (reserved)
```

Flow edges, also data: harvest_ops to interco_logistics, interco_logistics to drying_ops (row one, pointing right), drying_ops DOWN to production_ops (row two), production_ops LEFT to marketplace. business_ops carries no flow edge: it is the support island on row two. Tests must assert every home-surface station and page of today appears in exactly one group, and that the edge list is exactly these four.

### Rendering

- **Home** (`/`) renders the map: two rows of icon nodes with the four arrows, replacing the tile grid. Each node is one tap target (label under icon, contained-station count as a small tile-count) navigating to `/ops/<key>`. Interco's node may link straight to /interco (its page IS the operation). Reserved groups (marketplace) and reserved members render in the established orange-barrel idiom (the Mount SOs pattern: reserved page naming its future file).
- **Subpages** `/ops/<key>`: an h1 of the group label, the group's tiles in the existing tile grid pattern (same markup family as the old home so the tile CSS carries), a back link to the map. Unknown key: 404. No PIN on the group pages themselves; the gated routes stay gated when a tile is tapped.
- **Icons**: six inline currentColor SVGs, one consistent hand style (single stroke weight, simple geometry, viewBox, aria-hidden beside visible text labels), each under 2 KB, inlined via src/theme.ts or a small icons module: field (furrow rows to a horizon), semi truck (tractor and trailer), silo (cylinder and dome cap), factory (sawtooth roof and stack), storefront (awning), piggy bank. No emoji, no external images.
- **Arrows**: right, down, and left arrows drawn with CSS borders or tiny inline SVGs, colored per view (gold under cerberus, amber under co, accent under lite). On the phone device mode the map reflows to a single vertical chain in flow order (Harvest, Interco, Drying, Production, Marketplace, then Business Operations) with every arrow pointing down; nothing scrolls horizontally.
- **Three views**: style the map in all three sheets in their own idiom (cerberus: steel plates and gold ink, honeycomb untouched; co: paper cards, amber, Palatino labels, lift on hover; lite: the chunky 2px look). The h1 of home becomes "Operations" (i18n: es "Operaciones"). Keep the boot scrawl, bar, pills, and Admin FAB exactly as they are.
- The old homePage tiles function and its tests get replaced, not abandoned: update test/surface and view tests to the map (node count, hrefs, reserved styling, phone reflow class behavior, per-view token spot checks).

## Part 2: Admin [Import Data], the multipurpose upload queue

**Owner ruling, verbatim:** "Add Admin button: Import Data - Need a multipurpose parser pane that can accept csv and xlsx files - for now we can build the queueing for it and decide how the data gets parsed once the guts exist"

**Scribe ruling folded with it (owner answered 2026-09-02):** files store in D1 behind a 1 MB per-file cap; we move to R2 when the parser lands if bigger files show up.

- **Migration 0015_import_queue.sql** (the slice's only migration, Postgres-portable): `import_queue` with id (uuid pk), filename, kind (text, csv or xlsx), byte_size (integer), content (blob), status (text, seeded lifecycle value 'queued' only; parsing states come later), notes (text null), created_at, created_by, updated_at, updated_by, deleted_at, deleted_by, delete_reason following the house columns.
- **Admin page** gains an [Import Data] button beside the existing admin buttons, to `/admin/imports` (already inside the PIN gate).
- **/admin/imports**: an upload form (file input, `accept=".csv,.xlsx"`, multipart POST) above the queue table: filename, kind, size (comma-grouped bytes or KB, display only), status, uploaded by, uploaded at, and per-row controls Download and Void (reasoned void through the existing /record pattern; no Edit). Empty state: "Nothing queued."
- **Upload rules**: extension decides kind (.csv or .xlsx, case-insensitive); anything else refuses 400 naming the two accepted kinds. Over 1,048,576 bytes refuses 400 with a clear line about the 1 MB cap until the parser lands. Store the raw bytes as a blob; logsForInsert on the insert; redirect back with an ok flash ("File queued.").
- **Download**: serves the stored bytes back with the original filename (content-disposition attachment, text/csv or the xlsx mime), so nothing is ever trapped in the queue. Byte-identical round trip is a smoke assertion.
- **No parsing, no mapping, no METRC or Zoho calls in this slice.** The owner decides parsing when the guts exist; leave one clean seam (a status column and a place a parser will hang) and nothing more.

## Part 3: the Reports button

**Owner ruling, verbatim (2026-09-02, mid-dispatch):** "Add a Reports button to the left of the Admin button too-orange barrelled, no PIN gate"

- The layout renders a second fixed button immediately LEFT of the bottom-right Admin button, in every view and both device modes: `<a class="reports-fab" href="/reports">Reports</a>` (i18n: es "Informes"). The two sit as one bottom-right cluster with a small gap; on the phone they stay separately tappable and never overlap or cover content (the existing main clearance already reserves the strip).
- The Reports button wears the reserved orange-barrel idiom (the #d97706 accent the stub tiles use) in each sheet's own language, so the floor reads it as coming-soon at a glance; the Admin button keeps its current look untouched.
- `/reports` is a reserved page in the established Mount SOs pattern, naming its future file, with NO PIN gate (the owner's words: "no PIN gate"). It renders in the normal chrome with a back link home.

## Verification you owe (the Scribe re-verifies everything)

- `npx tsc --noEmit` clean; `npx vitest run` green with the new tests (registry membership and edges, /ops pages, map render per view, phone reflow, import upload happy path, oversize refusal, wrong-kind refusal, download round trip, void reasoned, the Reports button left of Admin in every view and /reports serving 200 with no PIN cookie).
- Migrations from zero: 0001 through 0015 apply clean into a fresh local persist dir.
- Full smoke (`npm run smoke`) PASS with new sections: the map on home (nodes, arrows, reserved styling, all three views spot-checked), /ops subpage walk, the import queue walk (upload a small csv, see the row, download it back byte-identical, refuse an oversize file and a .pdf, void with reason). Keep every existing assertion green; the old home-tile assertions must be updated to the map, not deleted.
- Byte-level dash audit 0 on every file you touch.
- Rendered screenshots of the map in all three views plus phone mode and the import page (the Scribe will re-render independently; visual defects bounce the slice).
- SESSION_REPORTS/2026-09-02_process_map_slice.md with the sealed final check verbatim and any OWNER-flag markers (things needing a Dennis ruling) quoted plainly.

## Do not

Do not touch canon/ or prompts/. Do not edit migrations 0001-0014. Do not add npm dependencies. Do not parse spreadsheet contents. Do not rename existing routes or break bookmarked station URLs. Do not touch the vendored saleshelper pair, the brand assets, the boot scrawl, the Admin FAB, or Demote. Do not deploy; the owner deploys by PS after the Scribe's gate.
