# PROCESS MAP: Harvest and Post-Harvest (the box registry)

**Source:** Dennis's Visio, delivered 2026-08-27. Image: `canon/harvest-process-map.png`.
**Doctrine:** canon §5. One box at a time, in map order. Talked through before any design. Every box lands as: a worker performs it, a manager audits it, a report or CSV comes out of it.
**Status legend:** queued → talking → sourced → spec'd → built → verified → adopted. ("sourced" = current tool in hand.)
**Source folder:** "Harvest 2026" (OneDrive, Grip Internal Site Operations) holds the 26H suite; the 25H opsdash came as a chat upload 2026-08-27.

## The registry

### Head of the flow

| Box | Owner | Action (from the map) | Current tool | Status |
|---|---|---|---|---|
| B00 | (event) | Harvest Start | | |
| B01 | Directors | Decide what zone to harvest | field map + morning discussion | **adopted (human)** |
| B02 | Patrick | Enter "red" data on ops dash to get HBN | opsdash "Harvest Details" (25H + 26H in hand) | **live in production; adoption pending floor use** |
| B03 | Harvest Leads | Deploy labor crews to selected zones, begin cutting | TBD | queued |
| B04 | (decision) | Hang or Silo? | TBD (rule + capacity) | queued |

### Hang path (map labels: ARL and SAT FARMS feed it; PNN receives)

| Box | Owner | Action | Current tool | Status |
|---|---|---|---|---|
| B05 | Ashley/Patrick | Wet weights / manifest | gflite wet weight station (slices 2-3) | **in build via break-in** |
| B06 | Rancho | Hang dry, buck, collect bucked weights | TBD | queued |
| B07 | Patrick | Enter weights in METRC, create manifest | TBD | queued |
| B08 | Ashley/Patrick | Receive METRC manifests, print harvest travelers (PNN) | opsdash traveler tabs (pointer) | queued |

### Silo path

| Box | Owner | Action | Current tool | Status |
|---|---|---|---|---|
| B09 | Harvest Leads | Buck material, transport to weigh area | TBD | queued |
| B10 | Plutarcho | Wet weights, give to Ashley | gflite wet weight station (slices 2-3) | **in build via break-in** |
| B11 | Ashley/Patrick | Wet weights into METRC using HBN, package, from ops dash, print travelers | opsdash traveler tabs (pointer) | queued |
| B12 | Luis | Load silos, attach package tag | TBD | queued |
| B13 | Les/Keith/Austin/Matt | Silo management | opsdash hidden tabs: Silo Schedule, Sequence Schedule (pointer) | queued |
| B14 | Luis, with David/Chucho | Unload silos, get dry weights | TBD | queued |
| B15 | David/Chucho | Attach travelers, organize CSA/CSB | TBD | queued |

### Converged: trim chain

| Box | Owner | Action | Current tool | Status |
|---|---|---|---|---|
| B16 | Kara | THC testing (trim, bio, silos) | TBD | queued |
| B17 | Corey | Determine next batch to trim, trim | Trim Room 2026.xlsx, Trim Room Reporting 2026.xlsx, 26H Trim Tracking.xlsx (in hand) | queued |
| B18 | David/Chucho | Load trim trailers | Trim Trailers 2026H.xlsx (in hand) | queued |
| B19 | Ashley | WIP packages, help organize trim room | TBD | queued |

### Cryo chain

| Box | Owner | Action | Current tool | Status |
|---|---|---|---|---|
| B20 | Directors | Pick next batch to cryo (ad hoc) | TBD | queued |
| B21 | Pablo/Anibal (? on the map) | Determine batch number; cryo that number of heavy bags through the 300% process; run that number x9 of light bags through the 200% process | Cryo Harvest 2026.xlsx (in hand) | queued |
| B22 | Kara/Karen | aW and moisture testing | TBD | queued |
| B23 | Pablo | Create cryo packages, communicate storage location | Cryo Harvest 2026.xlsx (in hand) | queued |
| B24 | Pablo/Anibal | Label bags; move the heavy box to the testing area; move 9 light boxes to 24 Building | TBD | queued |

### Compliance and out

| Box | Owner | Action | Current tool | Status |
|---|---|---|---|---|
| B25 | Kara | Compliance testing, Leaflink/Zoho | TBD | queued |
| B26 | Kara | Return test totes to their families in the 24 barn | TBD | queued |
| B27 | Karen | Prepack (ad hoc) | PrePack Harvest 2026.xlsx (in hand) | queued |
| B28 | Patrick | Manage METRC and Zoho inventory | opsdash LiveINV sheet (pointer) | queued |
| B29 | (terminal) | Sell, Sell, Sell | | |

## Registry notes

- The map's connective tissue (solid vs dashed arrows, box shapes) gets confirmed box by box during talk-throughs, not modeled up front.
- The "?" on B21's owner comes from the map itself.
- Both branch heads (B05, B09) open only after B04's rule is talked through.
- "In hand" and "pointer" mark where the current tool already sits; the box still gets its own talk-through when the walk reaches it. No designing ahead.
- Crew names in this registry are internal working data and never ship in a package (canon G-9).
- **Slice 1, the queue spine (2026-08-27):** thin simple forms laid across B02 (Acquire HBN), the wet weight boxes (B05/B10), trim packaging (B17/B19), cryo weights (B21/B23), and the testing queues (B16/B22/B25 exit controls). Each of those boxes still gets its deepening talk-through in map order. Prompt: `prompts/2026-08-27_slice1_queue_spine.md`.
- **Wet-weight pair ruling (Dennis, 2026-08-27), for the B05/B10 deepening:** bucked wet weight required on every entry; wet spear weight optional ("spearing is only done in certain cases, it needs to be there"). Lands as migration 0004 in slice 2.

## Box record template

When a box opens, its talk-through produces a record appended below (or a per-box file under `canon/boxes/` if it outgrows this doc):

- What happens today, in Dennis's words
- Current tool: the OpsHelpers object or spreadsheet, captured into `canon/reference/`
- Who performs, who audits, what the report or CSV must show
- Replacement spec pointer (the Cursor prompt file)
- Verification evidence pointer

## Box records

### B01: Directors decide what zone to harvest (opened 2026-08-27, adopted 2026-08-27 as human)

- What happens today: morning sit-down over the field map; the answers go to Ashley or Patrick as the day's red-field entries in the opsdash.
- **Ruling (Dennis, 2026-08-27): B01 stays human.** No tool. The platform starts at B02, and the zone decision gets recorded on the B02 batch record (zone and rows restored there; 26H had dropped them).
- Box Contract disposition: performed by the Directors; audited through the batch records it produces; reporting rides B02.

### B02: Enter "red" data on ops dash to get HBN (opened 2026-08-27, sourced)

**Current tool, both versions in hand:** tab "Harvest Details" in `Operations Dashboard 25H.xlsm` (chat upload, 2026-08-27) and `26H.Operations Dashboard .xlsm` (Harvest 2026 folder).

**The red fields** (identical set in both versions, red headers on the tab): Date, Farm, Grow Method, Strain, Manicure?, Silo #, Start Time.
**Confirmed rule (Dennis, 2026-08-27):** red = required at cut time to mint the HBN; everything else fills in as the batch moves.

**The mint:** Harvest Batch Name concatenates date serial, farm, grow-method code, 3-digit strain code, manicure flag (1 or 0), silo segment, year. Example from 25H: `45833-ARL-GH-027-0-NA-25`. Code tables: strain codes on `Abbr` (73 strains), grow-method codes on `Data`. METRC Harvest Tag is its own column beside the HBN.

**Also on the batch row:** ABC, Market Strain, Associated Batch, Cuts, Plants, a plants-per-farm burndown, silo sequence and sequence date, then the downstream weights, times, moisture and aW, THC averages, and on-hand rollups.

**26H deltas vs 25H:** adds Terp and "Is Bio/FFZ?" columns plus Strain Key, LiveINV, Hold Tag, Trim Room Data, and Trim Query sheets; drops Irrigation Zone, Rows, Photo Archive, and the per-method trim weight blocks (trim moved out to the trim workbooks).
**Ruling (Dennis, 2026-08-27):** zone and rows come back on the batch record in the replacement.

**Rulings (Dennis, 2026-08-27):** date segment becomes **YYDDD Julian**; zone and rows ride the form; trailing segment is **YY### = year + 3-digit year-wide lot serial** (the floor's primary identifier, the largest number on the traveler); numeric silos zero-pad to 2 digits. Full corrected mint: `26244-ARL-GH-027-0-05-26001` shape (canon ADR-6). Built in slice 1 (`prompts/2026-08-27_slice1_queue_spine.md`), corrected by slice 1.1 (`prompts/2026-08-27_slice1p1_mint_serial.md`).

**Verified (Scribe, 2026-08-27):** slice 1 session report checked: sealed check intact, smoke walked acquire → wet → trim → cryo → release with queue counts asserted, reasonless edit rejected, no git remote, canon untouched. Slice 1.1 verified same day in code: lot_serial + harvest_year with UNIQUE(harvest_year, lot_serial), YY### token guarded, silo zero-pad, Blue Andeez 078 in seed and migration; smoke minted 26001 then 26002.

**Box Contract standing:** worker performs (station form) ✓ · manager audits (edit-with-reason change log, /log view) ✓ · report or CSV out (/export) ✓. Adoption lands when the floor uses it and the riding flags get ruled.

**Still open:** ABC column meaning; when Cuts and Plants land during the day; audit and report shape beyond the CSV export.
