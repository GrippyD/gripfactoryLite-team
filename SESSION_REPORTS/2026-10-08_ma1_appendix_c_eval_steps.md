> Appendix C of SESSION_REPORTS/2026-10-08_ma1_metrc_api_read_integration.md (brief MA1, Phase A, build session 2026-10-08). Code citations (file:line) hold on main app/ and branches/GFLiteOpsDashboard/app at the cut (tree 3f067013cbb9f39e); the MA1 worktree has moved since. Docs citations name files of the 2026-10-08 fetch of https://api-mi.metrc.com/Documentation/ (metrcdocs/endpoints/<VERB_path>.txt and page_*.txt, a scratch copy; see section 8 of the report for where to keep it). No em or en dash; curly apostrophes from quoted docs text were normalized to plain ones.

## Derived evaluation step list (Law 8)

For Dennis to check against Metrc's reply. Derived from the workbook and the docs only. Nothing here is from memory.

**Sources**
- Workbook: `RESEARCH/metrc_connect/Generic_Evaluation_for_All_States_MASTER_10.2025.xlsx` (99,735 bytes, sha256 prefix d06d9a4bd4a404e7). The file on disk uses an underscore; brief section 0 step 4 (ma1_brief.md line 9) writes "MASTER 10.2025" with a space. Cells were read with openpyxl into session scratch `wf/workbook/`. That folder is session-local; any cell cited here can be re-read from the workbook, whose hash is above.
- Docs: a copy of https://api-mi.metrc.com/Documentation/ fetched 2026-10-08 into session scratch `metrcdocs/`. It is also session-local, so the copy is pinned by hash:
  - `PrintableList.txt`, the whole reference (v2 and v1), from https://api-mi.metrc.com/Documentation/PrintableList: 937,805 bytes, sha256 prefix 266a3a6162844c6f.
  - `endpoints/_INDEX.txt` (verb, path, file, bytes per endpoint): sha256 prefix ffc013035bd7dbe9.
  - `page_getting-started.txt` f77d159dd6171f83; `page_best-practices.txt` 8283eda8f9cb3c58; `page_whats-new-in-v2.txt` 2b352af7d8eccddc.
  - Hand-off item for Dennis or the Scribe: save this copy to `RESEARCH/metrc_connect/docs/`, the folder brief line 10 names, so the citations outlive the session.
- "Docs file" below means `metrcdocs/endpoints/<file>`. Line numbers are that file's.
- Quote rule. In the section 2 tables, each docs quote is the opening sentence of the file's description (line 3), unless the row marks it "second sentence". Quotes outside the tables cite their own line. Curly apostrophes (') are kept as the docs print them. A claim that a call takes no licenseNumber or no lastModified parameter cites the file's Parameters block by line range.
- Workbook citation form: a step is cited as "Tab A13 (path A15)": the step-label cell, then the cell that holds the call's path. The paste anchor is in each tab's "Anchors" line.
- Canon: `canon/CANON.md` line 526 (row `| 0.30.168 |`).
- The thread file: `RESEARCH/2026-09-21_metrc_connect_thread.md` (brief section 0 step 4, line 9), the Scribe's notes of the Metrc Connect mails. Cited by line (lines 11, 21 and 37).
- Not read (UNRESOLVED):
  - The Postman collection. `page_getting-started.html` links it as `href="/Documentation/postman-json"`; the text copy shows only the label "Postman JSON" (`page_getting-started.txt` line 173). It was not fetched. It may carry a host variable.
  - `GET /employees/v2/permissions` was not called. Its docs file says it "Retrieves the permissions of a specified Employee" (`GET_employees_v2_permissions.txt` line 3; permission "Manage Employees", line 7). It could show the key holder's permissions per facility, but it takes `employeeLicenseNumber` (line 14), a person's license number. The runner does not call it, and that number is never stored, logged or put in the pack (G-9).
  - The premium "Dedicated Sandbox". `RESEARCH/2026-09-21_metrc_api_lab_testing.md` line 9 lists "a Dedicated Sandbox" among the Connect plan's premium options and says nothing more. What it changes for resets and for the facility set is folded into Q13 and Q17.

**Conventions**
- E1 means a GET step. E2 means a write step (POST, PUT or DELETE). E2 is built only on Dennis's word after Metrc confirms the evaluation scope (F-A), behind `METRC_EVAL_ENABLED` and the Law 3 host guard (ma1_brief.md lines 33 and 44).
- Host. The runner, E1 included, refuses any host that fails the Law 3 sandbox check `^https://sandbox-api-[a-z]{2}\.metrc\.com$` (brief line 33), and says so in plain words. Law 8 makes the page "active only when the host is a sandbox host" (line 44). Production GETs belong to the sweep (Law 3, line 35), never to the evaluation.
- licenseNumber. Every call takes `?licenseNumber=` unless the row or this list says otherwise.
  - No licenseNumber: `GET /facilities/v2/`, `GET /unitsofmeasure/v2/active` and `GET /wastemethods/v2/` (each prints "| No parameters |" at line 11). `GET /plants/v2/waste/methods/all` and `GET /harvests/v2/waste/types` (Parameters lines 9 to 17: pageNumber and pageSize only). The T4, T5, T6 and TT3 GETs (Parameters lines 11 to 19: pageNumber and pageSize only).
  - licenseNumber optional: `GET /items/v2/categories` (lines 19 to 20: "If not specified, all item categories will be returned."), and the {id} GETs of L3, S3 and I3 (lines 11 to 12). The runner sends it on these.
  - Calls without a license are rate-limited by key: `page_whats-new-in-v2.txt` line 9, "these requests will be on an individual API key basis".
- Path sent. The runner sends the documented v2 path. Where the workbook's path differs (Items `/Items/v2/`; T5, T6, TT2, TT3), it keeps both paths in the JSON (`path_workbook`, `path_sent`) and sets the status `done 200 (docs path)`. Law 8 asks for "the documented call" (brief line 44). Metrc confirms (Q9).
- A read-back is the GET a runner makes after a write whose docs response is "No response", to capture the Id and LastModified.
- UNRESOLVED means neither the workbook nor the docs settle the point.

### 1. Which tabs apply: all 22, with the workbook's words

Grip is Grow plus Processor (brief Law 8). The facility columns come from the Permissions tab table (B21:H32), where E is Grow, F is Processor, G is Labs, H is Sales. "D" means dependent, required. "O" means optional (legend at E20: "Dependences / Optional").

| # | Tab (exact name) | Applies to | Workbook words |
|---|---|---|---|
| 1 | `CompanyInformation` | Both. Administrative, no steps. | B6 "The following information must be completed to receive a production API key" |
| 2 | `Instructions ` (trailing space) | Both. Rules, no steps. | B6 "Each sheet groups tasks by the permissions required to access the necessary endpoints" |
| 3 | `Permissions` | Both. The request table. | B19 "Please indicate below which permissions you are seeking access to"; E19 "All sections marked with a "D" MUST be completed per Facility" |
| 4 | `States` | Both. Reference. | Headers in row 1, MI in row 10. Every MI column reads YES except two that read NO: C10, under C1 "Open Loop States - See Closed Loop Tab for direction", and L10, under L1 "Retailer Deliveries". YES: Plant Batches, Vegetative, Mother Plants, Flowering, Harvests, Packages, Labs, Sales, Sales Deliveries, Patients Tab, Get Wholesale & Transfers, EXTERNAL INCOMING TRANSFERS, Transfer Templates. The Labs and Sales YES values matter under reading (b) of section 6. |
| 5 | `Locations` | Grow only | E22 "D", F22 blank. A37:B37: "Grow:" "Locations, Strains, Plant Batches, Plants, Harvests, Items, Packages, Get Transfers and Wholesale with Transfer Templates as an option." |
| 6 | `Strains` | Both | E23 D, F23 D. A39:B39: "Processor:" "Strains, Items, Packages, Get Transfers and Wholesale with Transfer Templates as an option." |
| 7 | `Items` | Both | E26 D, F26 D |
| 8 | `Closed Loop Environment ` (trailing space) | Grow. Governs opening inventory; no steps of its own. | B6 "To start your beginning inventory for testing and the evaluation you have 2 options" (section 3 below) |
| 9 | `Closed Loop States PlantBatches` | Grow (MI is closed loop: States C10 NO) | Row 24 "Plant Batches / Plants": E24 D only |
| 10 | `PlantBatches` | Neither for MI. This is the open-loop variant. | Its step 1 is `POST /plantbatches/v2/plantings` (PlantBatches A5 (path A7)). Closed Loop B16 says that request "is used in other sandboxes that create Plant Batches from "thin air"". Usable in MI only if `GET /facilities/v2/` shows `CanCreateOpeningBalancePlantBatches` true: UNRESOLVED. |
| 11 | `Plants` | Grow | E24 D |
| 12 | `Harvest` | Grow | E25 D |
| 13 | `Packages` | Both | E27 D, F27 D |
| 14 | `CA ONLY Labs` | Neither | California and Labs only. A17 "Email api-info@metrc.com for access to a Lab facility for the evaluation." |
| 15 | `LabResults` | Neither | G30 D only (Labs). C1 "This section is required if you have requested POST/PUT/DELETE access for Labs." |
| 16 | `Sales` | Neither | H28 D only (Sales) |
| 17 | `Sales with Patient Look Up` | Neither | Sales only. C1 "required if you have requested POST/PUT/DELETE access for Sales." |
| 18 | `Sales Deliveries (NOT CA)` | Neither | Sales list (A43:B43). Row 29 "Sales Deliveries" has no mark in any column. |
| 19 | `CA- SalesRetailDeliveries` | Neither | California only; MI L10 "Retailer Deliveries" NO |
| 20 | `GET Transfers and Wholesale` | Both | E31 D, F31 D; C1 "This section is required if you have requested GET access for Transfers And Wholesale." |
| 21 | `Transfer Templates` | Both. Optional per Permissions, required per its own C1: UNRESOLVED. | E32 O, F32 O, and A37:B37, A39:B39 "with Transfer Templates as an option". But C1: "This section and the section Transfer External Incoming  are required if you have requested GET\POST\PUT\|DELETE access for Transfers." |
| 22 | `Transfer External Incoming` | Both. Optional per Permissions, required per its own C1: UNRESOLVED. | Same row 32 "O". C1: "This section and the section Transfer Templates are required if you have requested GET\POST\PUT\|DELETE access for Transfers." |

**Note on tab scope.**
- The C1 cell (B1 on Plants) ties tabs 5 to 7 and 9 to 19 to "POST/PUT/DELETE access".
- Tab 20's C1 ties it to "GET access for Transfers And Wholesale".
- The C1 cells of tabs 21 and 22 tie them to "GET\POST\PUT|DELETE access for Transfers", so they also tie to GET.
- GET Transfers is a dependent permission for Grow and Processor (E31 and F31 are "D"), so a Grip request includes it. The workbook then contradicts itself on tabs 21 and 22: Permissions row 32 and A37:B37 and A39:B39 make them optional, while their own C1 makes them required. UNRESOLVED (Q16). Section 4 shows the counts both ways.
- For a GET-only request, Permissions B45 ("complete all sections of all tabs") and these per-tab headers disagree. Section 6 sets out three readings, (a) to (c).

### 2. Step tables for the 10 applicable step tabs

**Shared recording rules**, from Instructions B10:B17 and example row 29:
- Result code: the HTTP status. B24 "ALL Actions are to return a Result of 200."
- License Facility: the licenseNumber sent (example D29 "CML17-0000001"). T4, T5, T6 and TT3 send no licenseNumber, so the runner fills the license of the parent call (T1 to T3, or TT1) and says so in `Runner note`.
- ID Number: from the response `Ids` on a POST. Docs, `page_whats-new-in-v2.txt` line 23: "When making a successful POST request, you will now receive back the newly created object's ID in the response". From the read-back on a write with "No response", and from the returned object on a GET. Example E29 "53806 <You will need to GET>".
- Last Modified Date: B15 says "this is the date in which the test or actions were ran". Example F29 "2019-07-12 00:00:00".
- Request Sent: the full URL with its query (example H29 `https://sandbox-api-ca.metrc.com/plants/v2/plantings?licenseNumber=...`).
- JSON: B17 "JSON body or the Response: Please Minify so it will fit in one cell". Example I29 holds the request body.

**Pre-step P-1 (hands only, before E1; not in the workbook):**
- Dennis obtains the sandbox user key outside the runner, and sets the sandbox secrets.
- This is not the Phase A handshake. By Findings A6 (as restated), the sandbox keys go on env.grip for one Test connection, and then `METRC_USER_KEY` is deleted until Phase B's sandbox guard (Findings A7) is merged and deployed. P-1 sets the user key again after that, before the runner's first call.
- The key is a licensee partner's sandbox key, or the vendor's own from `POST /sandbox/v2/integrator/setup`. `POST_sandbox_v2_integrator_setup.txt` line 3: "Call without userKey to create a new sandbox user; the resulting key will be sent to the contact email on file."
- The runner never calls integrator/setup, for two reasons. It is a POST. And its `userKey` query parameter (line 11) would put key material into the logged path: `callPath` keeps the query string (`app/src/metrcapi.ts:130-133` on main, byte-identical in GFLiteOpsDashboard, sha256 prefix e2ad026ecad07ac9; the MA1 worktree matched at its cut and has changed since about 19:13, Findings Conventions).

**Pre-step P0** (not numbered in the workbook):
- Call: `GET /facilities/v2/`. Docs file `GET_facilities_v2.txt`: "This endpoint provides a list of facilities for which the authenticated user has access." It takes no parameters (line 11, "| No parameters |"). The workbook writes it without the trailing slash.
- Workbook: Instructions B19 "One of the first things you should do with any API User Key is to run the request GET /facilities/v2".
- Phase E1. It runs on an empty sandbox.
- It is the same call as the Admin page's Test connection (`testMetrcConnection`, `metrcapi.ts:603-618` on main, path `/facilities/v2` at :609), which today reports only a count. The Phase A handshake is that one call showing N facilities. Matching each `License.Number` is built in Phase B (Findings A22, A33).
- It returns `License.Number` and `License.LicenseType` (lines 139 and 143). It also returns the FacilityType flags the runner needs: `CanGrowPlants`, `CanCreateOpeningBalancePlantBatches`, `PlantBatchesCanContainMotherPlants`, `CanCreateOpeningBalancePackages`, `CanTransferFromExternalFacilities` (lines 42, 43, 48, 58, 79).
- What the pack keeps from P0, per facility: the facility keep-list that 0096's `metrc_facilities` uses (`License.Number`, `License.LicenseType`, `FacilityType.CanGrowPlants`, `CanRecordProcessingJobs`, `CanTrackVegetativePlants`; lines 139, 143, 42, 74, 50). The runner reads CanCreateOpeningBalancePlantBatches, PlantBatchesCanContainMotherPlants, CanCreateOpeningBalancePackages and CanTransferFromExternalFacilities in memory to branch, and names a flag only in the `Runner note` of a step it stops. Nothing else is kept. Never `License.EmployeeLicenseNumber` (line 140, a person's license number) and never `FacilityId` (line 21).
- The values in the docs example are illustrative only. The MI sandbox values are UNRESOLVED until P0 runs.
- P0 also lists the sandbox facilities the run will use. Whether they are Grip's own licenses or generic sandbox facilities is UNRESOLVED (Q17).

#### 2.1 Locations (Grow only)
- Columns (row 4): `Result code` | `License Facility` | `ID Number ` | `location Name Created  ` | `Request Sent` | ` JSON Body Or Response  ((Minify please))`
- Anchors: B5, B9, B13.

| Step | Instruction | Verb, path, docs file and quote | Phase | Record | Prerequisites (made by) |
|---|---|---|---|---|---|
| L1, Locations A5 (path A7) | "Create a new location" | `POST /locations/v2/`; `POST_locations_v2.txt`: "Creates new locations for a specified Facility." | E2 | Id from `Ids`; Name; URL; body | `LocationTypeName` from `GET /locations/v2/types` (`GET_locations_v2_types.txt`). Pick a type with ForPlants, ForPlantBatches, ForHarvests and ForPackages true, so later tabs can use the location. This is a runner choice, not a workbook instruction. |
| L2, Locations A9 (path A11) | "Update the name of the location created in Step 1" | `PUT /locations/v2/`; `PUT_locations_v2.txt`: "Updates existing locations for a specified Facility." Docs response: "No response". | E2 | Id (L1); new Name; URL; body | L1 Id |
| L3, Locations A13 (path A15) | "View the location Created and Updated in Step 1 & 2 by the ID number" | `GET /locations/v2/{id}` (licenseNumber optional, sent); `GET_locations_v2_id.txt`: "Retrieves a Location by its Id." | E1 | Id; Name; URL; response | L1 and L2 (E2). No sandbox setup call creates locations. |

#### 2.2 Strains (Grow and Processor)
- Columns: as Locations, with E = `Strain Name Created  `.
- Anchors: B5, B9, B13.

| Step | Instruction | Verb, path, docs file and quote | Phase | Record | Prerequisites (made by) |
|---|---|---|---|---|---|
| S1, Strains A5 (path A7) | "Create a new Strain" | `POST /strains/v2/`; `POST_strains_v2.txt`: "Creates new strain records for a specified Facility." | E2 | Id from `Ids`; Name; URL; body | none |
| S2, Strains A9 (path A11) | "Update the Strain by changing the Indica and Sativa Percentage" | `PUT /strains/v2/`; `PUT_strains_v2.txt`: "Updates existing strain records for a specified Facility." "No response". | E2 | Id; Name; URL; body | S1 Id |
| S3, Strains A13 (path A15) | "View the Strain Created and Updated in Step 1 & 2 by the ID number" | `GET /strains/v2/{id}` (licenseNumber optional, sent); `GET_strains_v2_id.txt`: "Retrieves a Strain record by its Id, with an optional license number." | E1 | Id; Name; URL; response | S1 and S2 (E2) |

#### 2.3 Items (Grow and Processor)
- Columns: as Locations, with E = `Item Name Created  `.
- Anchors: B5, B9, B13.
- The workbook writes `/Items/v2/`; the docs path is lowercase `/items/v2/`. The runner sends the docs path (status `done 200 (docs path)`).

| Step | Instruction | Verb, path, docs file and quote | Phase | Record | Prerequisites (made by) |
|---|---|---|---|---|---|
| I1, Items A5 (path A7) | "Create a new Item" | `POST /items/v2/`; `POST_items_v2.txt`: "Creates one or more new products for the specified Facility." | E2 | Id from `Ids`; Name; URL; body | `ItemCategory` from `GET /items/v2/categories` (licenseNumber optional, sent). `UnitOfMeasure` from `GET /unitsofmeasure/v2/active` (no licenseNumber). `Strain` (S1) when the category has RequiresStrain. |
| I2, Items A9 (path A11) | "Change the Unit of Measure Type" | `PUT /items/v2/`; `PUT_items_v2.txt`: "Updates one or more existing products for the specified Facility." "No response". | E2 | Id; Name; URL; body | I1 Id |
| I3, Items A13 (path A15) | "View the Item Created and Updated in Step 1 & 2 by the ID number" | `GET /items/v2/{id}` (licenseNumber optional, sent); `GET_items_v2_id.txt`: "Retrieves detailed information about a specific Item by Id." | E1 | Id; Name; URL; response | I1 and I2 (E2) |

#### 2.4 Closed Loop States PlantBatches (Grow, MI)
- Columns: `Result code` | `License Facility` | `ID Number ` | `Last Modified Date` | `Plant Batch Name/Tag Number  ` | `Request Sent` | ` JSON Body Or Response  (Minify please)`
- Anchors: B5, B10, B14, B18, B22.
- A4 is a California-only note on batch names.

| Step | Instruction | Verb, path, docs file and quote | Phase | Record | Prerequisites (made by) |
|---|---|---|---|---|---|
| C1, Closed Loop States PlantBatches A5 (no path cell; instruction A6) | "Create a Immature Plant Batch Containing a quantity of 6 Plants. See the Tab Closed Loop Environment" | No path in the cell. One of the Closed Loop routes (section 3). `POST /plants/v2/plantings` (`POST_plants_v2_plantings.txt`: "Creates new plant batches at a specified Facility from existing plant data."). Or `POST /packages/v2/plantings` (`POST_packages_v2_plantings.txt`: "Creates new plantings from packages for a specified Facility."). Or `POST /plantbatches/v2/split` (`POST_plantbatches_v2_split.txt`: "Splits an existing Plant Batch into multiple groups at the specified Facility."). | E2 | Id from `Ids`; date run; batch name; URL; body. A6 also asks to "document here how it was done". | **UNRESOLVED.** Needs one source that already exists: a plant (`PlantLabel`), a clone or seed package (`PackageLabel`), or a batch (`PlantBatch`). Also a strain (S1), a plant location (L1), and a date inside the accepted range (Closed Loop B19). Whether the MI sandbox holds any source is unknown. A package seeded by `POST /sandbox/v2/packages/create` defaults to weight-based items: `POST_sandbox_v2_packages_create.txt` line 3, "By default, items are selected randomly from weight-based items only." Whether its Category filter can yield a plantable package is UNRESOLVED. Read-back: `GET /plantbatches/v2/active` or `/{id}`. |
| C2, Closed Loop States PlantBatches A10 (path A12) | "Create a package with 3 clones from the remaining Original Plant batch. This action will not decrease the Plant batch quantity." | `POST /plantbatches/v2/packages/frommotherplant`; `POST_plantbatches_v2_packages_frommotherplant.txt`: "Creates packages from mother plants at the specified Facility." | E2 | Id; date; batch name or package tag; URL; body | C1 batch; a package `Tag` (W1, section 2.12); an immature-plant `Item` (existing, or W5). Docs evidence on how C2 and C3 differ: C3's endpoint takes an optional `isFromMotherPlant` (`POST_plantbatches_v2_packages.txt` lines 20 to 21: "Whether the Package contains a Plant Batch from a mother plant - Boolean. Reference v2/packages/frommotherplant"). **UNRESOLVED:** whether C1's batch must hold a mother plant, and whether MI's `PlantBatchesCanContainMotherPlants` gates this. |
| C3, Closed Loop States PlantBatches A14 (path A16) | "Create a package containing 3 clones ... This action will decrease the plant batch quantity" | `POST /plantbatches/v2/packages`; `POST_plantbatches_v2_packages.txt`: "Creates packages from plant batches at a Facility, with optional support for packaging from mother plants." | E2 | Id; date; tag; URL; body | C1 batch; package tag (W1); immature-plant item. The runner leaves `isFromMotherPlant` unset here. That is a runner choice: the workbook says this step "will decrease the plant batch quantity". |
| C4, Closed Loop States PlantBatches A18 (path A20) | "Change the growth phase of 2 of the plants split in Step 2 to the Flowering Stage" | `POST /plantbatches/v2/growthphase`; `POST_plantbatches_v2_growthphase.txt`: "Updates the growth phase of plants at a specified Facility based on tracking information." | E2 | Id; date; `StartingTag`; URL; body | C1 batch; `NewLocation` (L1); `GrowthDate`. Plant tags for `StartingTag` are UNRESOLVED until probed. W1 supplies them only if `GET /sandbox/v2/tagtypes` lists a plant tag type; its docs example shows "Marijuana Plant" with TagInventoryType "Plant", but that is illustrative. The other source is unused tags from `GET /tags/v2/plant/available`, which line 3 calls "a premium endpoint". **UNRESOLVED:** Step 2 is a packaging step, not a split, so "split in Step 2" has no clear referent. |
| C5, Closed Loop States PlantBatches A22 (path A24) | "Destroy 1 of the plants in the batch that was split" | `DELETE /plantbatches/v2/`; `DELETE_plantbatches_v2.txt`: "Completes the destruction of plant batches based on the provided input data." | E2 | Id; date; batch name; URL; body | The C1 batch needs at least 1 plant left. The workbook says C2 "will not decrease" and C3 "will decrease" the batch (A11, A15); neither the workbook (A19) nor the growthphase docs (line 3) say whether C4 does. If C4's 2 plants leave the batch, 6 - 3 - 2 = 1 remains; that is an inference. `WasteReasonName` from `GET /plantbatches/v2/waste/reasons`, whose Example Response reads "No response" (line 20). The field holding the name is therefore UNRESOLVED until the probe runs; the DELETE example sends free text ("Mater Theft"). `WasteMethodName` from `GET /wastemethods/v2/` (no licenseNumber). **UNRESOLVED:** same "split" wording as C4. Instructions B22 limits deletion to data the runner created. |

#### 2.5 Plants (Grow)
- Columns: `Result code` | `License Facility` | `ID Number ` | `Last Modified Date` | `Tag Number  ` | `Harvest Name` | `Request Sent` | ` JSON Body Or Response  (Minify please)`
- Anchors: B6, B10, B14, B18, B22, B26.

| Step | Instruction | Verb, path, docs file and quote | Phase | Record | Prerequisites (made by) |
|---|---|---|---|---|---|
| P1, Plants A6 (path A8) | "Move 1 of the Flowering Plants to a Different location" | `PUT /plants/v2/location`; `PUT_plants_v2_location.txt`: "Moves plant batches to new locations within a specified Facility." "No response". | E2 | Id (read-back `GET /plants/v2/{label}`); date; plant tag; URL; body | A flowering plant (C4); a second plant location (one that exists, or W3) |
| P2, Plants A10 (path A12) | "Create an Immature Plant Batch from one of the Plants" | `POST /plants/v2/plantings`; `POST_plants_v2_plantings.txt` (quote at C1) | E2 | Id; date; source plant tag; URL; body | A plant (C4); strain; location |
| P3, Plants A14 (path A16) | "Create a Package of Seeds or Clones from one of the Plants" | `POST /plants/v2/plantbatch/packages`; `POST_plants_v2_plantbatch_packages.txt`: "Creates packages from plant batches at a specified Facility." | E2 | Id; date; package tag; URL; body | Plant label; `PackageTag` (W1); a clone or seed item (existing, or W5) |
| P4, Plants A18 (path A20) | "Destroy one of the plants" | `DELETE /plants/v2/`. Metrc row A36 writes "DESTROY/plants/v2/". `DELETE_plants_v2.txt`: "Removes plants from a Facility's inventory while recording the reason for their disposal." | E2 | Id; date; plant tag; URL; body | A mature plant (C4); `GET /plants/v2/waste/reasons`; `GET /plants/v2/waste/methods/all` (no licenseNumber) |
| P5, Plants A22 (path A24) | "Manicure a portion of a Plant" | `POST /plants/v2/manicure`; `POST_plants_v2_manicure.txt`: "Creates harvest product records from plant batches at a specified Facility." | E2 | Id; date; plant tag; HarvestName; URL; body | A mature plant; a harvest-capable `DryingLocation` |
| P6, Plants A26 (path A28) | "Using the 2 remaining Plants create a Harvest" (same name, same calendar day to join) | `PUT /plants/v2/harvest`; `PUT_plants_v2_harvest.txt`: "Processes whole plant Harvest data for a specific Facility." "No response". | E2 | Id (read-back `GET /harvests/v2/active`); date; tags; HarvestName; URL; body | **UNRESOLVED shortfall.** C4 makes 2 flowering plants and P4 destroys 1, so only 1 remains, not 2. Either C4 moves 3 plants or other plants are used (W6); the runner must say which. |

#### 2.6 Harvest (Grow)
- Columns: as Plants.
- Anchors: B5, B9, B13, B17.

| Step | Instruction | Verb, path, docs file and quote | Phase | Record | Prerequisites (made by) |
|---|---|---|---|---|---|
| H1, Harvest A5 (path A7) | "Using the Harvest Created in Step 6 from Plants, create a package" | `POST /harvests/v2/packages`; `POST_harvests_v2_packages.txt`: "Creates packages from harvested products for a specified Facility." | E2 | Id; date; package tag; HarvestName; URL; body | P6 harvest; package tag (W1); a weight-based item (existing, or I1 if still weight-based after I2) |
| H2, Harvest A9 (path A11) | "Remove the remaining weight as Waste. (MOISTURE LOSS IS NOT REMOVED AS WASTE)" | `POST /harvests/v2/waste`; `POST_harvests_v2_waste.txt`: "Records Waste from harvests for a specified Facility." | E2 | Id; date; HarvestName; URL; body | Harvest Id; `GET /harvests/v2/waste/types` (no licenseNumber); remaining weight from `GET /harvests/v2/{id}` |
| H3, Harvest A13 (path A15) | "Finish that Harvest" | `PUT /harvests/v2/finish`; `PUT_harvests_v2_finish.txt`: "Marks one or more harvests as finished for the specified Facility." | E2 | Id; date; HarvestName; URL; body | H2 |
| H4, Harvest A17 (path A19) | "Unfinish that Harvest" | `PUT /harvests/v2/unfinish`; `PUT_harvests_v2_unfinish.txt`: "Reopens one or more previously finished harvests for the specified Facility." | E2 | Id; date; HarvestName; URL; body | H3 |

#### 2.7 Packages (Grow and Processor)
- Columns: `Result code` | `License Facility` | `ID Number ` | `Last Modified Date` | `Tag Number  ` | `Request Sent` | ` JSON Body Or Response  (Minify please)`
- Anchors: B5, B9, B13, B17, B21.

| Step | Instruction | Verb, path, docs file and quote | Phase | Record | Prerequisites (made by) |
|---|---|---|---|---|---|
| K1, Packages A5 (path A7) | "Using the Package created in Harvest Step 1 OR create a package from an existing package that you have found" | `POST /packages/v2/`; `POST_packages_v2.txt`: "Creates new packages for a specified Facility." | E2 | Id; date; new tag; URL; body | Grow: the H1 package as source. Processor: a source package found by `GET /packages/v2/active` (E1) or seeded by W2. Also a package tag (W1) and an item. |
| K2, Packages A9 (path A11) | "Change the item of a package" | `PUT /packages/v2/item`; `PUT_packages_v2_item.txt`: "Updates the associated Item for one or more packages at the specified Facility." "No response". | E2 | Id (read-back `GET /packages/v2/{label}`); date; tag; URL; body | K1; a second item of a compatible type (existing, or W4) |
| K3, Packages A13 (path A15) | "Adjust The weight or quantity to 0" | `PUT /packages/v2/adjust` (the workbook names PUT; the docs also hold `POST /packages/v2/adjust`); `PUT_packages_v2_adjust.txt`: "Set the final quantity for a Package." "No response". | E2 | Id (read-back); date; tag; URL; body | K2; `GET /packages/v2/adjust/reasons` |
| K4, Packages A17 (path A19) | "Finish that package" | `PUT /packages/v2/finish`; `PUT_packages_v2_finish.txt`: "Updates a list of packages as finished for a specific Facility." "No response". | E2 | Id (read-back); date; tag; URL; body | K3 |
| K5, Packages A21 (path A23) | "Using the new package created in Packages Step 1 ... Unfinish a package" | `PUT /packages/v2/unfinish`; `PUT_packages_v2_unfinish.txt`: "Updates a list of packages as unfinished for a specific Facility." "No response". | E2 | Id (read-back); date; tag; URL; body | K4. The K1 package ends at quantity 0 (K3). |

#### 2.8 GET Transfers and Wholesale (Grow and Processor)
- Columns: as Packages.
- Anchors: B5, B9, B13, B17, B21, B25.

**The lastModified parameters, and the window per step:**
- Workbook A38:A39: "The Parameters required for Step 1 and Step 2 are" "lastModifiedStart and lastModifiedEnd".
- The endpoint pages mark both "optional" (`GET_transfers_v2_incoming.txt` lines 24 to 28; the same block in `GET_transfers_v2_outgoing.txt`).
- `page_best-practices.txt` line 35 conflicts with them: "Due to the existing Last Modified filter requirement, a single call cannot be made to request a large amount of data."
- Whether the filter is required, and its maximum window, is UNRESOLVED; no maximum appears in the local docs (Q18). The runner sends both anyway.
- Window rule per step:
  - T1, T2: the window that finds transfers already in the sandbox is unknown. The runner sends a window that ends at run time; its length is a runner constant, reported in the JSON. An empty result is reported as `cannot run: sandbox lacks <transfer>`, not as a failure. When T1 reads a transfer that X1 created, the window brackets the X1 create times.
  - T3 takes no window (Parameters lines 11 to 22 of `GET_transfers_v2_rejected.txt`: licenseNumber, pageNumber, pageSize).
  - TT2 and X2 bracket their own creates. lastModifiedStart is just before TT1a or X1a, and lastModifiedEnd just after TT1b or X1b.
  - Encoding: `page_getting-started.txt` line 115, "when a plus sign (+) is used in a time zone offset, it must be correctly encoded as %2B."

| Step | Instruction | Verb, path, docs file and quote | Phase | Record | Prerequisites (made by) |
|---|---|---|---|---|---|
| T1, GET Transfers and Wholesale A5 (path A7) | "Find a Incoming Transfer" | `GET /transfers/v2/incoming`; `GET_transfers_v2_incoming.txt`: "Retrieves a list of incoming shipments for a Facility, optionally filtered by last modified date range." | E1 | Transfer Id; run date; a package tag if shown; URL; the chosen transfer object | An incoming transfer must exist. X1a and X1b (E2, tab 22) can create one; otherwise it depends on the sandbox's generic data: **UNRESOLVED**. Window per the rule above (UNRESOLVED cap). |
| T2, GET Transfers and Wholesale A9 (path A11) | "Find a Outgoing  Transfer" | `GET /transfers/v2/outgoing`; `GET_transfers_v2_outgoing.txt`: "Retrieves a list of outgoing shipments for a Facility, optionally filtered by last modified date range." | E1 | as T1 | **UNRESOLVED.** No v2 write in `_INDEX.txt` creates a licensed outgoing transfer. The transfer writes are templates, external incoming and hub only, so the record must already exist in the sandbox. Window cap UNRESOLVED. |
| T3, GET Transfers and Wholesale A13 (path A15) | "Find a Rejected  Transfer" | `GET /transfers/v2/rejected`; `GET_transfers_v2_rejected.txt`: "Retrieves a list of shipments with rejected packages for a Facility." No lastModified parameters (lines 11 to 22). | E1 | as T1 | **UNRESOLVED.** No documented write rejects a package, so this also depends on existing sandbox data. |
| T4, GET Transfers and Wholesale A17 (path A19) | "Find a Transfer by the Manifest ID number" | `GET /transfers/v2/{id}/deliveries`; `GET_transfers_v2_id_deliveries.txt`: "Retrieves a list of shipment deliveries for a given Transfer Id." Second sentence: "Please note: The {id} parameter above represents a Transfer Id." No licenseNumber (lines 11 to 19). | E1 | Delivery Id; the ManifestNumber in JSON; URL; License Facility from the parent call | Transfer Id from T1, T2 or T3. The docs settle {id} as the Transfer Id, not the manifest number; record both. |
| T5, GET Transfers and Wholesale A21 (path A23) | "Find The Packages Using the Delivery ID number" | The workbook path `GET /transfers/v2/delivery/{id}/packages` is in neither the v1 nor the v2 docs: **UNRESOLVED as written**. Documented path, sent: `GET /transfers/v2/deliveries/{id}/packages`. `GET_transfers_v2_deliveries_id_packages.txt`: "Retrieves a list of packages associated with a given Transfer Delivery Id." Second sentence: "represents a Transfer Delivery Id, not a Manifest Number." `page_best-practices.txt` line 25 uses the plural `/transfers/{version}/deliveries/{id}/packages`. No licenseNumber (lines 11 to 19). | E1 | PackageId; PackageLabel as tag; URL; License Facility from the parent call | Delivery Id from T4 |
| T6, GET Transfers and Wholesale A25 (path A27) | "Transfers Wholesale Find Packages Wholesale Pricing Using the Delivery ID" | The workbook path `.../delivery/{id}/packages/wholesale` is not in the docs: **UNRESOLVED as written**. Documented, sent: `GET /transfers/v2/deliveries/{id}/packages/wholesale`. `GET_transfers_v2_deliveries_id_packages_wholesale.txt`: "Retrieves a list of wholesale shipment packages for a given Transfer Delivery Id." No licenseNumber (lines 11 to 19). | E1 | PackageId; PackageLabel; URL; License Facility from the parent call | Delivery Id from T4 |

#### 2.9 Transfer Templates (Grow and Processor; optional or required, section 1 row 21)
- Columns: as Packages.
- Anchors: B5 (1a), B9 (1b), B13, B17, B21.

| Step | Instruction | Verb, path, docs file and quote | Phase | Record | Prerequisites (made by) |
|---|---|---|---|---|---|
| TT1a, Transfer Templates A5 (path A7) | "Set up a Template A" | `POST /transfers/v2/templates/outgoing`; `POST_transfers_v2_templates_outgoing.txt`: "Creates new transfer templates for a Facility." | E2 | Id from `Ids`; date; PackageLabel; URL; body | `TransferTypeName` from `GET /transfers/v2/types`: a type with ForLicensedShipments true (field at `GET_transfers_v2_types.txt` line 33; runner choice). A live `PackageLabel`: the H1 source package if quantity remains, or one seeded by W2. Not K1's new package, which K3 takes "to 0" (Packages A14). **UNRESOLVED:** `RecipientLicenseNumber` needs a second sandbox facility (a generic multi-facility sandbox may supply one; Q17). The docs example body also carries transporter, driver and vehicle fields and estimated times: `EstimatedDepartureDateTime` and `EstimatedArrivalDateTime` on the destination (lines 34 to 35), and a `Transporters[]` block (lines 37 to 65) with `TransporterFacilityLicenseNumber`, `DriverName`, `DriverOccupationalLicenseNumber`, `DriverLicenseNumber`, `VehicleMake`, `VehicleModel`, `VehicleLicensePlateNumber` and its own estimated times. The docs mark no body field required. **UNRESOLVED:** which of these are required, and whether the transporter license must be a facility in the sandbox (Q20). |
| TT1b, Transfer Templates A9 (path A11) | "Set up a Template B" | same as TT1a | E2 | as TT1a | as TT1a (UNRESOLVED recipient and transporter) |
| TT2, Transfer Templates A13 (path A15) | "Find the two Templates created in Step 1a and 1b  using the date search" | The cell reads only "GE" (truncated). Metrc row A29 says `GET /transfers/v2/templates`, which is not in the v2 docs: **UNRESOLVED as written**. Documented v2 equivalent, sent: `GET /transfers/v2/templates/outgoing` (`GET_transfers_v2_templates_outgoing.txt`: "Retrieves a list of transfer templates for a Facility, optionally filtered by last modified date range."). `page_whats-new-in-v2.txt` line 603 maps it from `GET /transfers/v1/templates`. | E1 | Ids of both; run date; URL; response | TT1a and TT1b (E2). Window brackets their creates (section 2.8). |
| TT3, Transfer Templates A17 (path A19) | "Find a Template by the Template ID number" | The workbook path `GET /transfers/v2/templates/{id}/deliveries` is not in the v2 docs: **UNRESOLVED as written**. Documented, sent: `GET /transfers/v2/templates/outgoing/{id}/deliveries` (`GET_transfers_v2_templates_outgoing_id_deliveries.txt`: "Retrieves a list of deliveries associated with a specific transfer template."), mapped at whats-new line 605. No licenseNumber (lines 11 to 19). | E1 | template Id; URL; response; License Facility from TT1 | Any template Id. Transfer Templates A18 does not name Step 1, so TT1's Id is the natural one but not the only one. |
| TT4, Transfer Templates A21 (path A23) | "Update one of the Templates created in Step 1" | `PUT /transfers/v2/templates/outgoing`; `PUT_transfers_v2_templates_outgoing.txt`: "Updates existing transfer templates for a Facility." "No response". | E2 | Id (read-back by the TT2 path); date; URL; body | TT1 Id |

#### 2.10 Transfer External Incoming (Grow and Processor; optional or required, section 1 row 22)
- Columns: as Packages.
- Anchors: B5 (1a), B9 (1b), B13, B17, B21.

| Step | Instruction | Verb, path, docs file and quote | Phase | Record | Prerequisites (made by) |
|---|---|---|---|---|---|
| X1a, Transfer External Incoming A5 (path A7) | "Set up an external Incoming transfer" | `POST /transfers/v2/external/incoming`; `POST_transfers_v2_external_incoming.txt`: "Creates external incoming shipment plans for a Facility." | E2 | Id from `Ids`; date; URL; body | Shipper fields (`ShipperLicenseNumber`, `ShipperName`, address; lines 18 to 25). `TransferTypeName` from `GET /transfers/v2/types`: a type with ForExternalIncomingShipments true (`GET_transfers_v2_types.txt` line 34; runner choice). Package `ItemName` (an existing item or I1). The recipient is presumably the license in the query. That is a runner inference: the docs example sends `?licenseNumber=123-ABC` with "ShipperLicenseNumber": "123-ABC" and "RecipientLicenseNumber": "123-XYZ" (lines 16, 18, 37). **UNRESOLVED** (Q20). The body also carries the destination estimated times (lines 41 to 42) and the same `Transporters[]` driver and vehicle block as TT1 (lines 45 to 73); which fields are required is **UNRESOLVED**. **UNRESOLVED:** whether MI's `CanTransferFromExternalFacilities` permits this step (P0 will show). |
| X1b, Transfer External Incoming A9 (path A11) | "Set up an external Incoming transfer" | same | E2 | as X1a | as X1a (same UNRESOLVED points) |
| X2, Transfer External Incoming A13 (path A15) | "Find the two Transfers created in Step 1a and 1b by using the date parameter search" | `GET /transfers/v2/incoming` (as T1) | E1 | Ids; run date; URL; response | X1a and X1b (E2). Window brackets their creates (section 2.8). |
| X3, Transfer External Incoming A17 (path A19) | "Update one of the Transfers created in Step 1" | `PUT /transfers/v2/external/incoming`; `PUT_transfers_v2_external_incoming.txt`: "Updates external incoming shipment plans for a Facility." "No response". | E2 | Id (read-back by the X2 path); date; URL; body | X1 Id |
| X4, Transfer External Incoming A21 (path A23) | "Delete the Transfer not updated in Step 3" | `DELETE /transfers/v2/external/incoming/{id}`; `DELETE_transfers_v2_external_incoming_id.txt`: "Voids an external incoming shipment plan for a Facility." "No response" (line 20). | E2 | Id (the path {id}); date; URL; read-back by the X2 path confirms the void | The other X1 Id. B22: delete only what the runner created. |

**Workbook against docs, for the record**
- Plants Metrc row A36 reads "DESTROY/plants/v2/".
- Closed Loop PB Metrc rows A28:A32 list "Start inventory" and `POST/plantbatches/v2/plantings` (the route tab 8 B16 says "will not work in California"). They omit Step 3's `POST /plantbatches/v2/packages`.
- Some "Metrc Use Only" labels are copy errors: PlantBatches A22 and Packages A26 read "Transfer Template", and Harvest A22 reads "Plants".
- Instructions B11 says the ID is "not visible until a GET is done"; v2 POSTs return `Ids`.

#### 2.11 Run order (the pack rows keep workbook order)

The runner runs in dependency order. The pack lists rows in workbook tab and step order whatever the run order; each row's JSON carries its run time.

| Order | What | Phase | Why here |
|---|---|---|---|
| 1 | P-1 (hands): sandbox user key and secrets | none | Nothing runs without them |
| 2 | P0 `GET /facilities/v2/` | E1 | Licenses, FacilityType flags |
| 3 | Lookups and probes (section 5 list) | E1 | Names, types, reasons, and what inventory the sandbox already holds |
| 4 | T1, T2, T3 against existing sandbox data; then T4 to T6 from what they find | E1 | Completes tab 20 only if generic transfers exist |
| 5 | S1, S2; L1, L2; I1, I2; then S3, L3, I3. W3, W4 and W5 if the probes show none. | E2 (S3, L3, I3 are GETs on E2 records) | Strain, location and items feed every later tab |
| 6 | W1 tags; W2 seeded packages | E2 | Tags feed C2, C3, C4, P3, H1 and K1; seeded packages feed Processor K1, TT1 and possibly C1 |
| 7 | Tab 9: C1 to C5 (Grow) | E2 | Opening inventory, flowering plants |
| 8 | Tab 11: P1 to P6 (W6 if the P6 shortfall needs it) | E2 | Needs C4 plants |
| 9 | Tab 12: H1 to H4 | E2 | Needs the P6 harvest |
| 10 | Tab 13: K1 to K5 | E2 | Grow from H1; Processor from a found or seeded package |
| 11 | Tab 22: X1a, X1b, X2, X3, X4 | E2 | Creates incoming transfers |
| 12 | Tab 20 again, T1 to T6, if order 4 found no incoming transfer. T1 reads the X3-updated transfer, the one X4 leaves. | E1 | Needs X1 |
| 13 | Tab 21: TT1a, TT1b, TT2, TT3, TT4 | E2 | Needs a live package (H1 source or W2) and a recipient |

#### 2.12 Writes outside the workbook

These writes are not workbook steps, but the rows above need them. Each one is E2: it needs Dennis's word, `METRC_EVAL_ENABLED` and the host guard. Each is logged in the pack JSON (`writes_outside_workbook[]`: endpoint, why, status, request, response), so Dennis sees every write the runner made.

| # | Call | Docs file | Why | When |
|---|---|---|---|---|
| W1 | `POST /sandbox/v2/facility/tags` | `POST_sandbox_v2_facility_tags.txt` | Package tags for C2, C3, P3, H1, K1. Plant tags for C4 only if a plant tag type exists (C4 row). | When the probes show no unused tags of the type needed |
| W2 | `POST /sandbox/v2/packages/create` | `POST_sandbox_v2_packages_create.txt` | Processor K1 source; TT1 package; possibly C1 source (UNRESOLVED) | When `GET /packages/v2/active` shows no usable package |
| W3 | `POST /locations/v2/` (a second location) | `POST_locations_v2.txt` | P1 "to a Different location"; a harvest-capable drying location for P5 if L1's type is not | When none exists |
| W4 | `POST /items/v2/` (a second item) | `POST_items_v2.txt` | K2 "Change the item of a package" | When no compatible item exists |
| W5 | `POST /items/v2/` (an immature-plant, clone or seed item) | `POST_items_v2.txt` | C2, C3, P3 | When none exists |
| W6 | A second `POST /plantbatches/v2/growthphase`, or C4 sent with Count 3 | `POST_plantbatches_v2_growthphase.txt` | The P6 shortfall | Only on Metrc's or Dennis's answer to Q8 |

That is up to 6 kinds of write; the pack counts each call.

### 3. Closed Loop Environment rules

**The tab, verbatim (B6:B19):**
- B6: "To start your beginning inventory for testing and the evaluation you have 2 options for starting your Inventory:"
- B8: "Using a Plant to create an immature plant batch using POST/plants/v2/plantings."
- B10: "Using POST/packages/v2/plantings to create a Plant Batch from a Package."
- B11: "The packages can be created with the request POST/plantbatches/v2/packages/frommotherplant and POST/plants/v2/plantbatch/packages"
- B13: "Another option is to use POST/plantbatches/v2/split."
- B16 (merged B16:B17): "Note: The request POST/plantbatches/v2/plantings will not work in California due to "CanCreateOpeningBalancePlantBatches": false, this request is used in other sandboxes that create Plant Batches from "thin air"."
- B19: "A date parameter WILL be needed for these calls. You may need to contact api support for a date range"

**What the runner takes from it:**
1. MI is closed loop. The source is the States tab: column C is headed "Open Loop States - See Closed Loop Tab for direction" (C1), and MI's C10 reads "NO". The brief says the same (ma1_brief.md line 44, "MI's sandbox is closed loop"). The thread file line 37 ("Michigan is a closed-loop state") restates the States tab. Neither is an independent Metrc statement. Opening inventory comes from a plant, from a package, or from a split of an existing batch.
2. Each route needs a source that already exists in the sandbox:
   - `POST /plants/v2/plantings` needs `PlantLabel`.
   - `POST /packages/v2/plantings` needs `PackageLabel`.
   - `POST /plantbatches/v2/split` needs `PlantBatch` (field names from each docs file's example request).
3. The B11 package routes are circular on an empty sandbox: both need an existing batch or plant.
4. The thin-air route `POST /plantbatches/v2/plantings` is not a closed-loop route. Use it only if P0 shows `CanCreateOpeningBalancePlantBatches` true for the MI license (UNRESOLVED).
5. The "date parameter" is each write's body date:
   - `ActualDate`: plants/plantings, plantbatches split, plantbatches packages and frommotherplant, plantbatches destroy.
   - `PlantedDate` and `UnpackagedDate`: packages/plantings (`POST_packages_v2_plantings.txt` example request).
   - `GrowthDate`: growthphase.
   - The accepted MI range is UNRESOLVED; ask api-info.
6. Sandbox setup calls are documented but not named by the workbook. All need `licenseNumber`, and all return "HTTP 403: This endpoint is only available in sandbox environments" elsewhere.
   - `POST /sandbox/v2/facility/tags` (line 3): "Tags are created, shipped, and received in a single synchronous operation". It says they are "immediately available for use in packages and plant batches", and "The maximum allowed count per request is 1,000."
   - `POST /sandbox/v2/packages/create` (lines 3 and 11): "Creates opening balance packages for the sandbox integrator's facility." "If Count is omitted, it defaults to 10. The maximum allowed value is 100."
   - `GET /sandbox/v2/tagtypes` (line 3): "Use this endpoint to discover valid TagType values before calling POST /sandbox/v2/facility/tags." It is a GET, so E1 may run it.
   - The two POSTs are writes (W1, W2). They come under Law 3 (`METRC_EVAL_ENABLED` plus the sandbox host) and Dennis's word, or Dennis's hands.
   - No sandbox endpoint creates plants, plant batches, harvests, locations, strains, items or transfers.
7. Instructions rules that bind every E2 step:
   - B20: "You should only modify data in the facilities that we direct you to and that you have created."
   - B22: "Please do not delete any data that you have not created".
   - B24: every action returns 200.
   - B26: "Do not submit unless all results have returned a 200 and results are verifiable."
8. Object limit: `page_whats-new-in-v2.txt` line 19. It applies to every call whose request body holds an array: "this is typically POST and PUT calls but can include some DELETE calls". The limit is "no more than 10 objects", and above it the call returns HTTP 413. Here that covers C5 and P4, whose DELETE bodies are arrays (`DELETE_plantbatches_v2.txt`, `DELETE_plants_v2.txt` example requests).
9. Resets. The thread file line 11 is its account of the sandbox email. It says "the sandbox's generic data is reset periodically but the user key and vendor key for each environment survive the reset".
   - Inventory made in E2 can vanish before the workbook is sent.
   - The runner must re-check inventory at start, and re-seed only on Dennis's word.
   - Whether the premium "Dedicated Sandbox" (Sources, not read) resets on another cadence is UNRESOLVED (Q13).

### 4. Counts

| Measure | Value |
|---|---|
| Tabs total | 22 |
| Tabs that apply to Grip | 15. Governing or reference: 1 to 4 and 8 (5). Required step tabs: 5, 6, 7, 9, 11, 12, 13, 20 (8). Tabs 21 and 22 (2): optional per Permissions, required per their own C1 (UNRESOLVED, Q16). |
| Tabs that do not apply | 7: 10 (open loop), 14, 15, 16, 17, 18, 19 |
| Steps on the applicable step tabs | 45: 35 on the required tabs plus 10 on tabs 21 and 22, plus the hands-only P-1 and the unnumbered P0 |
| GET steps (E1) | 12: 9 on the required tabs (L3, S3, I3, T1 to T6) plus 3 on tabs 21 and 22 (TT2, TT3, X2) |
| Write steps (E2) | 33 workbook steps: 26 on the required tabs plus 7 on tabs 21 and 22. Also up to 6 kinds of write outside the workbook (W1 to W6, section 2.12). |
| Grow, required | If tabs 21 and 22 are optional: 35 steps (9 GET, 26 write). If they are required: 45 steps (12 GET, 33 write). |
| Processor, required | If optional: 17 steps (Strains, Items, Packages, GET Transfers): 8 GET (S3, I3, T1 to T6), 9 write. If required: 27 steps (11 GET, 16 write). |
| Whole workbook (17 step tabs) | 66 steps: 13 GET (the 12 above plus Sales with Patient Look Up step 4, `GET /patients/v2/statuses/{patientLicenseNumber}`) and 53 write |
| GET-only under reading (c) (section 6) | Tabs 20, 21 and 22: 16 steps, 9 GET (T1 to T6, TT2, TT3, X2) and 7 write (TT1a, TT1b, TT4, X1a, X1b, X3, X4), all 7 writes on tabs 21 and 22. If tabs 21 and 22 are optional (Q16): tab 20 alone, 6 GET and no write. |
| Steps carrying an UNRESOLVED mark | 16: C1, C2, C4, C5, P6, T1, T2, T3, T5, T6 (required tabs, 10); TT1a, TT1b, TT2, TT3, X1a, X1b (tabs 21 and 22, 6) |
| Of those, paths unresolved as written | 4: T5, T6, TT2, TT3. The runner sends the documented v2 equivalent cited above (status `done 200 (docs path)`); Metrc confirms (Q9). |
| Open questions for Metrc or Dennis | 20, Q1 to Q20 (section 8) |

Multiplier: Permissions E19, "All sections marked with a "D" MUST be completed per Facility". If "Facility" means each sandbox facility the runner is directed to (Instructions B20), the required runs are the counts above per Grow sandbox facility plus per Processor sandbox facility, chosen by FacilityType from P0 (the grow gate is `CanGrowPlants`, as for the sweep). Grip's production license list decides it only if Metrc means each of Grip's licenses and the sandbox carries them (Q17). Grip has 7 active lookup licenses: 6 grow licenses and the processor AU-P-000694 (Findings section 3). Under that reading the Grow counts run 6 times and the Processor counts once. UNRESOLVED (Q2 and Q17).

### 5. E1 on an empty sandbox, and what needs inventory first

| E1 step | Runs on an empty sandbox? | Needs first | Made by |
|---|---|---|---|
| P0 `GET /facilities/v2/` | Yes, and completes | the P-1 key | n/a |
| T1 incoming | The call can be sent. It completes only if a record exists (B26 "verifiable"). Window cap UNRESOLVED. | an incoming transfer | E2 X1a/X1b, or sandbox generic data (UNRESOLVED) |
| T2 outgoing | Same as T1 | an outgoing transfer | generic data only; no documented write (UNRESOLVED) |
| T3 rejected | Same as T1 (no window) | a rejected transfer | generic data only; no documented write (UNRESOLVED) |
| T4 | No | Transfer Id | T1, T2 or T3 |
| T5, T6 | No | Delivery Id | T4 |
| L3 | No | location Id | E2 L1 and L2 (no setup call makes locations) |
| S3 | No | strain Id | E2 S1 and S2 |
| I3 | No | item Id | E2 I1 and I2 (I1 may need S1) |
| TT2 | No | template Ids | E2 TT1a and TT1b. These need a live package (H1 source, or W2) and a recipient license (UNRESOLVED). |
| TT3 | No | any template Id (Transfer Templates A18 does not name Step 1) | most naturally TT1 (E2); a template already in the sandbox would also do, if Metrc accepts it (Q6) |
| X2 | No | external incoming Ids | E2 X1a and X1b |

**The plain finding.** On an empty sandbox, E1 completes P0 and nothing else. T1 to T6 complete only if the MI sandbox's generic data already holds transfers. No sandbox setup call unlocks any other E1 step by itself. L3, S3, I3, TT2 and X2 each read a record that an E2 write of the same tab creates. TT3 reads any template, most naturally TT1's. The runner reports each such step as a "cannot run" status (section 7), never as a failure.

**Supporting reads E1 may make.** These are not workbook steps; they go to the JSON only. They report what the sandbox holds and name the missing inventory. All are in `_INDEX.txt` as GET, and all take licenseNumber unless marked.
- `GET /locations/v2/types`, `/locations/v2/active`, `/strains/v2/active`, `/items/v2/active`, `/items/v2/categories` (licenseNumber optional, sent), `/unitsofmeasure/v2/active` (no licenseNumber). `/locations/v2/active` (`GET_locations_v2_active.txt`: "Retrieves a list of active locations for a specified Facility."; licenseNumber at line 11) shows any location already in the sandbox. Like the strains and items active lists, it supplies an existing Id that L3 could read if Metrc accepts that (Q6).
- `/plantbatches/v2/active`, `/plants/v2/vegetative`, `/plants/v2/flowering`, `/plants/v2/mother`, `/harvests/v2/active`, `/packages/v2/active`
- `/plantbatches/v2/waste/reasons` (no documented response shape), `/plants/v2/waste/reasons`, `/wastemethods/v2/` (no licenseNumber), `/plants/v2/waste/methods/all` (no licenseNumber), `/harvests/v2/waste/types` (no licenseNumber), `/packages/v2/adjust/reasons`
- `/transfers/v2/incoming`, `/transfers/v2/outgoing` (window per section 2.8; these are T1 and T2), `/transfers/v2/rejected` (T3), `/transfers/v2/templates/outgoing`, `/transfers/v2/types`
- `/sandbox/v2/tagtypes`; `/tags/v2/package/available` and `/tags/v2/plant/available`. The tags files' line 3 reads "NOTE: This is a premium endpoint."; whether the sandbox key may call them is UNRESOLVED.

### 6. A GET-only evaluation: the 0.30.168 reading and the per-tab headers

`canon/CANON.md` line 526 (0.30.168) reads "a GET-only evaluation still walks every tab". The source is Permissions A45:B45: "GET only:" "Request a GET only Evaluation - You will be required to complete all sections of all tabs". Two readings fit that sentence, (a) and (b), and both walk every tab. A third reading, (c), comes from the tabs' own headers. It does not walk every tab, and it conflicts with B45.

**(a) The brief's reading (F-A note): every tab, GET steps only.**
- The work is the 13 GET steps of the whole workbook plus P0.
- Tabs 21 and 22 tie to GET access in their own C1 (section 1), so TT2, TT3 and X2 belong in a GET-only walk under this reading.
- Five of the GET steps (L3, S3, I3, TT2, X2) read records that their tab's write steps create, and TT3 reads any template. Without E2 they could only read records that already exist in the sandbox. Whether Metrc accepts that substitution is UNRESOLVED.
- The 13th, `GET /patients/v2/statuses/{patientLicenseNumber}` (permission "Lookup Patients"), needs a patient license number. It sits on a Sales tab: UNRESOLVED for Grip.

**(b) The literal reading.** Instructions B6 and B7 describe each section as holding "a table of actions to perform". "Complete all sections of all tabs" would then mean every step, writes included:
- 66 steps on 17 step tabs, 53 of them writes.
- That includes the California-only tabs 14 and 19, and the Sales and Labs tabs (MI's States row reads YES for Labs, Sales, Sales Deliveries and Patients Tab).
- It also includes tab 10, PlantBatches. Its step 1 is the thin-air route. B16 says that route fails where `CanCreateOpeningBalancePlantBatches` is false, and States C10 sends MI to the Closed Loop tab. In MI, tab 10 may therefore be impossible, and it is the alternative to tab 9, not an addition. Whether it counts is UNRESOLVED (Q19).
- Under this reading GET-only names the production key Grip asks for. It does not shrink the evaluation; it enlarges it.

**(c) The per-tab headers.** Each step tab's own header says which access request makes it required:
- Write access only: Locations C1 reads "This section is required if you have requested POST/PUT/DELETE access for locations." Strains C1, Items C1, Closed Loop States PlantBatches C1, PlantBatches C1, Harvest C1, Packages C1 and LabResults C1 say the same for their own area, and so does Plants B1 for Plants. The remaining step tabs (14 and 16 to 19) say it in C1 for Labs or Sales (section 1 note).
- GET access: only tab 20's C1 ("required if you have requested GET access for Transfers And Wholesale") and the C1 of tabs 21 and 22 ("GET\POST\PUT|DELETE access for Transfers") name GET.
- The request table itself asks for GET and for writes separately: Permissions C21 reads "GET" and D21 "POST/ PUT/ DELETE".
- So a GET-only request makes tabs 20, 21 and 22 required, and no other step tab. Those tabs hold 16 steps: 9 GET (T1 to T6, TT2, TT3, X2) and 7 writes (TT1a, TT1b, TT4, X1a, X1b, X3, X4). No write falls outside the transfer tabs. The 7 writes are E2 even under a GET-only request, since tabs 21 and 22 tie themselves to GET access.
- If Metrc rules tabs 21 and 22 optional (Q16), reading (c) is tab 20 alone: 6 GET steps and no writes. T1 to T3 then need transfers that already exist in the sandbox (section 5), since X1 would not run.
- This conflicts with Permissions B45, "You will be required to complete all sections of all tabs". The workbook does not say which governs.

Under (a) and (b) the GET-only path is not smaller in tabs than Grow plus Processor, and under (b) it is larger in steps. Under (c) it is much smaller: 3 tabs and 16 steps, or tab 20's 6 GET steps. This is the F-A question for Metrc (Q1), and Metrc's reply decides.

### 7. Proposed pack layout

**Delivery.** The Admin page `/admin/metrc-eval` offers flat downloads, one link per file. It builds no folder tree and no archive; a ZIP would need an archive writer in the Worker, which this does not propose. (The brief's zero-dependency note, line 44, is about `.xlsx` filling, but the same caution applies.) The files:
- One CSV per sandbox facility and applicable step tab: `metrc_eval_<UTC yyyymmddThhmmZ>_<license>_<NN>_<Tab>.csv`. The facilities are the ones Metrc directs the runner to (Instructions B20), chosen by FacilityType from P0 ("per Facility", E19).
- One JSON of everything: `metrc_eval_<UTC yyyymmddThhmmZ>.json`. The host goes in its `meta`.
- Under reading (b) there are also CSVs for the 7 other step tabs. Under reading (c) there are CSVs for tabs 20, 21 and 22 only, or for tab 20 alone if tabs 21 and 22 are optional (section 6).

**Storage (Phase E design input).** Nothing else holds a run between the run and the download, so migration 0098 adds one table:
- `metrc_eval_runs`, one row per run: `id`, `host`, `started_at`, `finished_at`, `steps_json` (TEXT), `status`, and the G-5 audit columns (`created_at`, `created_by`, `updated_at`, `updated_by`, `deleted_at`, `deleted_by`, as Findings section 6 lists them for 0096).
- `steps_json` holds the run as the JSON file below describes it, after scrubbing. Scrubbing follows Law 4 (brief line 36): no Authorization header and no key, and failed-call messages scrubbed of every key. It also keeps only the P0 keep-list (section 2, P0), so no `License.EmployeeLicenseNumber` and no `FacilityId` reach the row.
- `steps_json` is capped at 1.5 MB after scrubbing. That sits under D1's row limit, "Maximum string, `BLOB` or table row size | 2,000,000 bytes (2 MB)" (https://developers.cloudflare.com/d1/platform/limits/, local copy `wf/limits/d1_platform_limits.md` line 27). How a run that would pass the cap is cut is a Phase E choice.
- Each CSV and the JSON are separate download links, each built from that row when it is asked for. No zip, and no dependency.
- Findings section 7's 0098 list (sweep runs, samples, `metrc_api_calls.host`) gains this table.

**Tab files, in workbook tab order:**
- `05_Locations` (Grow facilities only), `06_Strains`, `07_Items`
- `09_Closed_Loop_States_PlantBatches`, `11_Plants`, `12_Harvest` (Grow only)
- `13_Packages`, `20_GET_Transfers_and_Wholesale`, `21_Transfer_Templates`, `22_Transfer_External_Incoming`

**Rows:** one per workbook step, in workbook order whatever the run order (section 2.11), including steps not run (cells blank, status says why). That gives 3, 3, 3, 5, 6, 4, 5, 6, 5 and 5 rows.

**Columns.** First come two pack columns that are not pasted: `Step` (the A-column text, e.g. `Step 1a`) and `Paste at` (the anchor cell, e.g. `B5`). Then the tab's row-4 headers in order, exactly as the cells hold them (quoted CSV keeps the spaces). Then two more pack columns that are not pasted: `Runner status` and `Runner note`.

| Tab | Workbook columns (exact strings, B onward) | Anchors |
|---|---|---|
| Locations | `Result code`, `License Facility`, `ID Number `, `location Name Created  `, `Request Sent`, ` JSON Body Or Response  ((Minify please))` | B5, B9, B13 |
| Strains | same, with `Strain Name Created  ` | B5, B9, B13 |
| Items | same, with `Item Name Created  ` | B5, B9, B13 |
| Closed Loop States PlantBatches | `Result code`, `License Facility`, `ID Number `, `Last Modified Date`, `Plant Batch Name/Tag Number  `, `Request Sent`, ` JSON Body Or Response  (Minify please)` | B5, B10, B14, B18, B22 |
| Plants, Harvest | `Result code`, `License Facility`, `ID Number `, `Last Modified Date`, `Tag Number  `, `Harvest Name`, `Request Sent`, ` JSON Body Or Response  (Minify please)` | Plants B6, B10, B14, B18, B22, B26; Harvest B5, B9, B13, B17 |
| Packages, GET Transfers and Wholesale, Transfer Templates, Transfer External Incoming | `Result code`, `License Facility`, `ID Number `, `Last Modified Date`, `Tag Number  `, `Request Sent`, ` JSON Body Or Response  (Minify please)` | B5, B9, B13, B17, B21 (GET Transfers adds B25) |

**Notes on the columns:**
- Locations, Strains and Items say "((Minify please))" with double parentheses, as does the Instructions example header I28. Every other step tab says "(Minify please)".
- Merges. On every step tab, B to F of each step block are merged over 3 rows. The rest varies:
  - Locations, Strains, Items: H and I are merged and have no header; G, the JSON column, is not merged. Paste only B to G.
  - Closed Loop States PlantBatches (and PlantBatches): H (JSON) is merged; G (Request Sent) is not.
  - Plants: H and I are merged; G (Harvest Name) is merged only on steps 4 to 6 (G18:G20, G22:G24, G26:G28).
  - Harvest: H and I are merged; G (Harvest Name) is not.
  - Packages and the three Transfers tabs: B to H are all merged.
  - A multi-row paste across blocks will not line up, so Dennis pastes one row at its anchor.

**Status values:**
- `done 200`
- `done 200 (docs path)`: the documented path was sent in place of the workbook's (Items, T5, T6, TT2, TT3).
- `failed <code>`, with the scrubbed 400 `{row, message}` text.
- `cannot run: needs <record> from <step>`: a record that a workbook step makes.
- `cannot run: sandbox lacks <record>; fix: <remedy>`: a record no workbook step makes. The remedy is `POST /sandbox/v2/packages/create` (packages), `POST /sandbox/v2/facility/tags` (tags), or "none documented, ask Metrc" (transfers for T1 to T3; plants, batches or plantable packages for C1).
- `E2 not enabled`
- `UNRESOLVED path`: reserved for a workbook path with no documented equivalent. No applicable step uses it today.
- A host that fails the sandbox check stops the whole run with a plain-words message. That is a run-level message, not a row status.

**JSON:** the file `metrc_eval_<UTC yyyymmddThhmmZ>.json`, with:
- `meta`: generated time; host; phase E1 or E2; workbook sha256 prefix d06d9a4bd4a404e7; docs fetch date 2026-10-08 and the PrintableList sha256 prefix 266a3a6162844c6f; brief MA1.
- `facilities`: from the P0 response, per facility, the keep-list only.
- `probes`: the supporting reads of section 5.
- `run_order`: the order actually run (section 2.11).
- `writes_outside_workbook[]`: each W call (section 2.12).
- `tabs[]`, each with `tab`, `applies_to`, `license`, and `steps[]`. Each step holds: `step`, `anchor`, `verb`, `path_workbook`, `path_sent`, `docs_file`, `phase`, `status`, `reason`, `request_url`, `request_body`, `response_status`, `response_body`, `license_source` (sent, or parent call), `window` (lastModifiedStart and lastModifiedEnd where sent), and `columns` (header string to cell value).

**What the pack leaves out:**
- No Authorization header and no key, anywhere (Law 4).
- No `License.EmployeeLicenseNumber` (`GET_facilities_v2.txt` line 140, a person's license number; G-9) and no `FacilityId` (line 21).
- CompanyInformation and Permissions are filled by hand. They hold Dennis's facts and his F-A choice.
- C22 (the value cell beside B22 "Vendor Key Used ") and C23 (beside B23 "User Key Used ") stay blank (Q12).

### 8. Open questions for Metrc's reply or Dennis's word

**The email to Metrc.** There is one merged list of questions for Metrc, and it lives in Findings section 9 (its step 7 list). That list carries Findings' own bullets plus Q1 (with reading (c)), Q2, Q4, Q6 to Q13, Q16, Q17, Q19 and Q20 below, and the 429 question: `page_whats-new-in-v2.txt` line 9 says "429 (Too many requests) will be returned with the time window in the header of the message", without naming the header. This section keeps the Q list and does not repeat the email.
- Q3, Q14 and Q15 are not questions for Metrc: P0 answers Q3, and Q14 and Q15 are Dennis's word.
- Q5 and Q18 end "Ask Metrc", but the merged list leaves them out. The E1 probes (section 5) answer part of Q5. Findings section 9's bullet on the maximum lastModified window covers part of Q18. Adding the rest of either to the email is left open.

- **Q1.** F-A scope: which reading of a GET-only request holds (section 6)? (a) every tab, GET steps only; (b) every step of every tab, writes included; or (c) the per-tab C1 and B1 headers, under which GET-only means tabs 20, 21 and 22 only (16 steps: 9 GET and 7 writes, all on tabs 21 and 22), or tab 20 alone if tabs 21 and 22 are optional (Q16). Reading (c) conflicts with Permissions B45, "complete all sections of all tabs". Ask Metrc; the reply decides F-A.
- **Q2.** Permissions E19 "per Facility": each sandbox facility, each license, or each facility type? Per license, Grip has 7 active lookup licenses: 6 grow licenses and the processor AU-P-000694 (section 4, multiplier). Ask Metrc.
- **Q3.** MI sandbox flags from P0: `CanCreateOpeningBalancePlantBatches` (decides whether the PlantBatches tab or the thin-air route is usable), `PlantBatchesCanContainMotherPlants` (C2), `CanTransferFromExternalFacilities` (X1). These are read, not asked, once Dennis sets the sandbox secrets (P-1).
- **Q4.** The date range the closed-loop writes accept (Closed Loop B19). Ask api-info.
- **Q5.** What the MI sandbox's generic data holds: plants, batches, clone or seed packages, locations, strains, items, and unused plant or package tags. Also any incoming, outgoing or rejected transfers for T1 to T3, and a second facility to receive templates (TT1). Ask Metrc; the E1 probes will show part of it.
- **Q6.** Whether a GET step may read an existing record in place of the one its tab's writes create (L3, S3, I3, TT2, X2; TT3 reads any template). Ask Metrc.
- **Q7.** What "the plants split in Step 2" (C4) and "the batch that was split" (C5) refer to. Ask Metrc.
- **Q8.** P6 shortfall: may C4 move 3 plants, or may P6 use other plants (W6)? Ask Metrc.
- **Q9.** Confirm the v2 paths the runner sends for T5 and T6 (`deliveries`), TT2 (`/templates/outgoing`) and TT3 (`/templates/outgoing/{id}/deliveries`), and the lowercase `/items/v2/`. Ask Metrc.
- **Q10.** T4: the docs call {id} a Transfer Id, while the workbook says "Manifest ID number". The runner records both. Ask Metrc whether that is what they check.
- **Q11.** The "Last Modified Date" column: the run date (B15) or the record's `LastModified`? The pack fills the run date and keeps `LastModified` in the JSON. Ask Metrc.
- **Q12.** CompanyInformation C22 and C23, the value cells beside B22 "Vendor Key Used" and B23 "User Key Used": the key strings or the key names? Law 4 forbids key strings in any file. Ask Metrc; Dennis fills it by hand.
- **Q13.** Whether the sandbox reset cadence leaves time between E2 and submission. Does the premium "Dedicated Sandbox" (`RESEARCH/2026-09-21_metrc_api_lab_testing.md` line 9) reset on another cadence? Ask Metrc.
- **Q14.** Metrc response text can carry em dashes (the sandbox endpoint docs do). G-8 conflicts with keeping evidence verbatim in the pack. Dennis's word.
- **Q15.** Which sandbox facilities are Grow and which are Processor, for tab selection. Read from P0 `License.LicenseType` and the FacilityType flags of the sandbox facilities, not from Grip's production license list. Dennis confirms the list; the runner never branches on the docs example's flag values.
- **Q16.** Tabs 21 and 22: optional (Permissions row 32 "O"; A37:B37 and A39:B39 "as an option") or required (their own C1, "required if you have requested GET\POST\PUT|DELETE access for Transfers") when GET Transfers is requested (E31, F31 "D")? Ask Metrc.
- **Q17.** Does the MI sandbox hold Grip's own licenses, or only a generic set of sandbox facilities? The thread file line 21 calls this "a question for api-info", and its reading of the setup call is that it "builds a generic set of sandbox facilities for the integrator". Which facilities does Metrc direct the runner to (Instructions B20)? Can one of them be the TT1 recipient? Would the premium "Dedicated Sandbox" (`RESEARCH/2026-09-21_metrc_api_lab_testing.md` line 9) change that facility set? Ask Metrc.
- **Q18.** The lastModified filter on T1, T2, TT2 and X2. The endpoint pages say "optional", but best practices line 35 says "requirement". Is it required, what is the maximum window, and which window finds the sandbox's existing transfers? Ask Metrc.
- **Q19.** Under reading (b), does tab 10 (PlantBatches, the thin-air route) count for MI, given that it is the alternative to tab 9? Ask Metrc.
- **Q20.** The TT1 and X1 bodies. Which transporter, driver, vehicle and estimated-time fields are required? Must `TransporterFacilityLicenseNumber` be a facility in the sandbox? On X1, is the recipient the license in the query, and what goes in the shipper fields? Ask Metrc.

### Consolidation notes

1. Reading (c) (D8, critic 8). Added to section 6, Q1, the section 1 note, section 4 (new row) and section 7. The headers were re-read in `wf/workbook/` (tabs 5 to 7 and 9 to 19 tie to POST/PUT/DELETE; tabs 20 to 22 name GET), together with Permissions C21 and D21. One count differs from the ruling: D8 and critic 8 say "about 12 GET steps", but tabs 20 to 22 hold 9 GET steps and 7 writes (16 steps). The 12 is this section's count for all applicable tabs, and it includes L3, S3 and I3, whose tabs reading (c) drops. The section uses 9.
2. The email (D15, critic 9). Section 8 now points to the merged list in Findings section 9 and cites `page_whats-new-in-v2.txt` line 9 for the 429 header question. Q5 and Q18 end "Ask Metrc" but are not in D15's list, so section 8 says so.
3. Q numbering (D1, critic 3). Section 8 items are labelled Q1 to Q20, and references in the text read "Q9" and so on. No new question was needed: the new points fold into Q1, Q2, Q13 and Q17, all of which are in D15's email list.
4. Pack storage (D9, critic 11). Section 7 adds `metrc_eval_runs` in 0098: one row per run, `steps_json` capped at 1.5 MB after scrubbing (under D1's 2,000,000-byte row limit, cited), and separate download links. No zip and no dependency. Findings section 7's 0098 list needs the same table; that is outside this section.
5. Facility fields (D14, critic 19). P0 and the pack keep the one keep-list only. The runner reads the four flags it branches on in memory, and names a flag only in the `Runner note` of a step it stops. They never keep `License.EmployeeLicenseNumber` (`GET_facilities_v2.txt` line 140) or `FacilityId` (line 21). The JSON `facilities` entry, the scrubbing rule and "What the pack leaves out" say so.
6. Locations probe and inactive lists (D14, critic 14). `/locations/v2/active` is added to the section 5 probe list (`GET_locations_v2_active.txt` lines 3 and 11). No eval step reads `/packages/v2/inactive` or `/plants/v2/inactive`, which fits their D14 mark, NOT USED. K4 reads back through `GET /packages/v2/{label}`. P4's DELETE returns `Ids` (`DELETE_plants_v2.txt` example response, lines 45 to 48). P6 reads back through `/harvests/v2/active`.
7. Citation style (D14, critic 22). Step cells now read "Tab A13 (path A15)", with the path cells taken from the `wf/workbook/` dumps. C1 has no path cell, since its instruction fills A6:A7. Anchors stay in each tab's Anchors line.
8. Unread sources (D14, critic 18). The Sources block lists the Postman collection, `GET /employees/v2/permissions` (with the G-9 caveat) and the Dedicated Sandbox as UNRESOLVED. The Dedicated Sandbox also appears in section 3 item 9, Q13 and Q17.
9. Licenses (D5, critic 15). The section 4 multiplier and Q2 give 7 active lookup licenses: 6 grow and the processor AU-P-000694, with `CanGrowPlants` as the grow gate.
10. Handshake and keys (D7, D16, critic 1). P0 is identified as the Test connection call (`metrcapi.ts:603-618`, :609), and per-license matching is left to Phase B (Findings A22, A33). P-1 is now kept apart from the Phase A handshake under the restated Findings A6.
11. Stale tree (D10, critic 5). The callPath citation names main's file (byte-identical in GFLiteOpsDashboard, e2ad026ecad07ac9); W's copy has changed since about 19:13.
12. The thread file, cited at lines 11, 21 and 37, is now defined in Sources; those lines were re-read. The old "Verification notes" block is dropped, and its fixes stand in the text.
13. Checked and not applicable here: D2, D3, D4, D6, D11, D12, D13 and critic 2, 4, 6, 7, 10, 12, 13, 16, 17, 20, 21, 23 to 25. This section makes no claim about Retry-After, onhold lists, the harvest window, the Law 2 mapping, the baseline hashes or the start-only filter.
14. Cross-check, callPath tree: FIXED. The P-1 citation named `branches/GFLiteMetrcAPI/app/src/metrcapi.ts:130-133` as byte-identical, but W's file is now 74b18498c19fd725 (45,502 bytes, callPath at W :206). Re-hashed: main and GFLiteOpsDashboard are both e2ad026ecad07ac9 (25,891 bytes), and main :130-133 is callPath. The citation now names main, and note 11 is restated. The P0 bullet's `testMetrcConnection` citation (:603-618, :609) now says "on main" too, since W has it at :947.
15. Cross-check, facility keep-list: FIXED, by D14 as written. The P0 bullet, the JSON `facilities` entry, the scrubbing rule and note 5 kept four more flags than the one keep-list, against endpoint map 455 ("Nothing else on the object is kept") and Findings 6.2 ("Nothing else from the response is stored"). The four flags are now read in memory only and named only in the `Runner note` of a step they stop. Flag line numbers re-checked in `GET_facilities_v2.txt` (42, 43, 48, 50, 58, 74, 79, 139, 140, 143, 21).
