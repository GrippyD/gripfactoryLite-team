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


## THE TYPICAL HARVEST: the logistics spine (Dennis, 2026-09-07, VERBATIM)

Intake with Patrick's punch list, 2026-09-07. His framing, verbatim: "We need to strike the menu and take a look at what actually happens in a typical harvest, then back in the exceptions.  Somewhere, we've gotten wires crossed.  I don't want to change the surfaces unless necessary, but I need to give you the sequence of events for most of the logistics process:"

1. "Acquire HBN"
2. "Wet weights are collected by TLs"
3. "Wet weights + HBN + Plant Tags + Barn(at whatever license the plant tags are at) + New Package Tag ID = METRC Harvest CSV"
4. "If the harvest was on a med license at any farm, the new package ID is put on a manifest to that farm's AU license, then virtually received in 'Barn'.  If it's on an AU license already, the new Package ID is created in 'Barn'."
5. "If this is a harvest at ARL or PNS, the new package ID is added to a manifest to deliver to PNN/832 'Barn' - note: 832 is an AU license, so we make sure the equivalent transfer is done beforehand."
6. "When the truck arrives, it's received into PNN/832/Barn in METRC."
7. "Whether the lot came from North or was shipped there, the wet weight begins its life in 832 Barn.  It gets transferred to 832 Silo #n immediately upon receipt/harvest tag creation."

Closing, verbatim: "Try not to conflate terms here.  This is what happens to the material in real life, but I'm also describing the METRC processes that need to occur at the same time.  Keep the same methodology on the working panes, but consider the flow of data in our process, and really stretch here."

### The reconciliation (Scribe, 2026-09-07): step against app

| Step | The METRC lane (his words) | The app today | Verdict |
|---|---|---|---|
| 1 | Acquire HBN | Acquire station mints the HBN on a farm-assigned license | MATCH |
| 2 | TLs collect wet weights | Wet weight station: lots per HBN, weights per read, Lead, Move To, Spear or Bucked (0.29.1) | MATCH |
| 3 | Harvest CSV: plants + weights + HBN + BARN at the plant-tag license + NEW PACKAGE TAG | Wet Weights CSV pends per batch with plant-tag fill; DryingLocation emits the PHYSICAL space (silo, hang room, Truck N); the package paper cuts at UNLOAD, the internal item mints at finish or receive | CROSSED (W1, W2) |
| 4 | Med harvest: manifest to the farm's AU license, virtually received in Barn; AU harvest: package born in Barn | The Virtual Move surface exists but is not wired to the flow; the mint silently writes an AU license (the arrival conversion law) with no equivalent-transfer paperwork | CROSSED (W3) |
| 5 | ARL and PNS: the package rides a manifest to PNN/832 Barn, equivalent transfer done beforehand | The wet truck lane moves the LOT physically with no manifest, because the item does not exist until receipt | CROSSED (W4) |
| 6 | The truck is received into PNN/832/Barn in METRC | The one-button receive lands the internal item in the barn under the arrival license; the METRC receive side is manual (T3 templates owed) | HALF |
| 7 | Life begins in 832 Barn; transferred to 832 Silo #n immediately | The barn inbox law plus the Move To edit carrying the item | MATCH internally; no METRC location-move artifact (W5) |

### The crossed wires, named

- **W1, package birth timing:** METRC births the harvest package at step 3; the app births its paper at unload and its internal item at finish or receive. Everything downstream inherits this lag.
- **W2, the harvest CSV location:** we emit the physical drying space into DryingLocation; the spine says the harvest lives in BARN at the plant-tag license, and the silo is a LATER location move (step 7).
- **W3, the silent med hop:** the arrival conversion law converts med to AU inside the mint with no manifest and no virtual receive; the spine demands the equivalent transfer as real paperwork at the origin farm, before anything ships.
- **W4, the paperless truck:** the physical wet truck rides with no manifest; the spine puts the harvest package on a real manifest (origin AU to 832 Barn) so the arrival receive closes paper, not just moves material.
- **W5, the silent silo move:** Barn to Silo #n is right internally but leaves no METRC location-move artifact.

### The direction (surfaces kept, per his words; awaiting his forks)

One structural move untangles all five wires: **the harvest package is born at Finish lot (step 3), as the internal item AND the pended METRC paper, in BARN at the plant-tag license.** Every later step becomes a MOVE of that one package, each leaving its paperwork: the med-to-AU equivalent transfer (manifest plus virtual receive, the existing Virtual Move lane wired in), the ARL/PNS-to-832 manifest (the wet lot's package rides the SAME four-window manifest floor as everything else), the arrival receive that closes the manifest (the one button stays), and the Barn-to-Silo location move (the Move To edit, now also pending its METRC artifact). The arrival conversion law retires in favor of explicit hops. The working panes keep their methodology; only the data flow beneath them straightens. Status: TALKING; the forks ride the 2026-09-07 reply for his rapid fire.
