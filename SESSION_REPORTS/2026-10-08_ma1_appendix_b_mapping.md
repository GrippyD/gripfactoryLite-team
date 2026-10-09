> Appendix B of SESSION_REPORTS/2026-10-08_ma1_metrc_api_read_integration.md (brief MA1, Phase A, build session 2026-10-08). Code citations (file:line) hold on main app/ and branches/GFLiteOpsDashboard/app at the cut (tree 3f067013cbb9f39e); the MA1 worktree has moved since. Docs citations name files of the 2026-10-08 fetch of https://api-mi.metrc.com/Documentation/ (metrcdocs/endpoints/<VERB_path>.txt and page_*.txt, a scratch copy; see section 8 of the report for where to keep it). No em or en dash; curly apostrophes from quoted docs text were normalized to plain ones.

## Mapping tables (Law 2) and the harvests table (Law 6)

**These are the report's only Law 2 mapping tables.** Findings 6.1 keeps no column table of its own and points to Tables 1 to 3 here. This section's assumptions are numbered A35 upward, in one namespace with Findings A1 to A34; probes are the endpoint map's P0 to P14.

**Sources used below.** Docs files sit under `scratchpad/metrcdocs/`. Each citation is `file:line` with the example value quoted as printed.
- `veg` = endpoints/GET_plants_v2_vegetative.txt
- `flw` = endpoints/GET_plants_v2_flowering.txt. It has the same keys on the same lines as `veg`; only values differ.
- `plinact` = endpoints/GET_plants_v2_inactive.txt
- `onhold` = endpoints/GET_plants_v2_onhold.txt
- `pkonhold` = endpoints/GET_packages_v2_onhold.txt
- `hvonhold` = endpoints/GET_harvests_v2_onhold.txt
- `pkg` = endpoints/GET_packages_v2_active.txt
- `pkinact` = endpoints/GET_packages_v2_inactive.txt. Same keys and lines as `pkg`. A diff shows only the Quantity, IsFinished, FinishedDate and LastModified values differ.
- `pksh` = endpoints/GET_packages_v2_id_source_harvests.txt
- `hva` = endpoints/GET_harvests_v2_active.txt
- `hvi` = endpoints/GET_harvests_v2_inactive.txt. Same keys and lines as `hva`. Only PackageCount, FinishedDate, ArchivedDate and LastModified values differ.
- `hid` = endpoints/GET_harvests_v2_id.txt
- `hwaste` = endpoints/GET_harvests_v2_waste.txt
- `uom` = endpoints/GET_unitsofmeasure_v2_active.txt
- `lts` = endpoints/GET_labtests_v2_states.txt
- `pbx` = endpoints/GET_plantbatches_v2_active.txt
- `pbxi` = endpoints/GET_plantbatches_v2_inactive.txt
- `pbid` = endpoints/GET_plantbatches_v2_id.txt
- `proc` = endpoints/GET_processing_v2_active.txt
- `xfer` = endpoints/GET_packages_v2_transferred.txt
- `gs` = page_getting-started.txt
- `bp` = page_best-practices.txt
- `code_mirror` = `scratchpad/phaseA/raw/code_mirror.md`, Phase A's reading of today's mirror code, cited by its section number.

Code citations are on `branches/GFLiteOpsDashboard/app/src`. To confirm these files match main byte for byte, every cited file was hashed on main `app/` and on that tree (sha256, first 16 hex characters). The two match for each file, so every line number below holds on both. The MA1 worktree `branches/GFLiteMetrcAPI/app` matched at its cut (18:10:45). A session has been writing in it since about 19:13: its config.ts is now f1735c2404bd9dd7 (90,101 bytes), so config.ts line numbers do not hold there (Findings Conventions). On it, metrcQuantity sits at :868, parseMetrcReleaseStates at :969 and metrcLocationName at :1387 (main :712, :813, :1231). When this pass hashed it at 19:43, the other twelve files below still matched there. The hashes on main and GFLiteOpsDashboard:
- metrc.ts bc4a4ca51f4b9530
- mint.ts 9a2e94e5f8ac26a8
- labeldata.ts b7a0f2edba5379a4
- locations.ts 2c561f99c7961db1
- floormetrc.ts c5865c1c50cfd154
- config.ts f74745f4f7524f65
- csv.ts f68bfe268ee852ad
- xlsx.ts b7fdc01844fc86d0
- zohoinv.ts 8237e299eb1d200f
- rad.ts b56fc579641d7f77
- actions.ts 9962e0190dc4cda4
- sheetsync.ts d85ee62493b52d95
- migrations/0042_metrc_mirror.sql 20866e418ccf371c

"Snapshot" means the read-only profile of `db_backups/20261008-135926_post_dedupe/metrc_plants.json` (97,936 rows) and `metrc_packages.json` (14,488 rows). The counts include all rows, gone ones too. The newer snapshot `db_backups/20261008-184520_pre_r5` holds byte-identical copies of both files (sha256 ff941812bbfbd3b6 and a8da4616663b26de), so every snapshot figure below holds there too; the profile was re-run on both (`wf/fix_mapping/cons_prof.py`).

**Column counts check out against the code.**
- `METRC_PLANT_COLUMNS` (metrc.ts:46-57) has 10 headers: Tag plus the 9 in `PLANT_COLS` (metrc.ts:584-594).
- `METRC_PACKAGE_COLUMNS` (metrc.ts:60-83) has 22 headers: Tag plus the 21 in `PACKAGE_COLS` (metrc.ts:596-618).
- The brief's ten and twenty-two are correct.
- Each header cell in Tables 1 and 2 carries its own metrc.ts line.

**Status key**
- SAME: same name, value copied as is.
- RENAMED: same value under a different API name, possibly nested. It is copied through the existing `text()`, `num()`, `normalizeMetrcDate` or `normalizeMetrcBool`.
- DERIVED: needs a rule beyond a copy. That means a pick by endpoint, a pick between open candidate flags, the date part of a date-time, or a value taken from the call rather than the row.
- LACKING: no field in the docs example response carries the value.

**Getter contract (applies to every row).** The proposed `apiGetter` (code_mirror section 8) has to hand `shapePlantRow` and `shapePackageRow` one string per export header, following these rules:
- **JSON null, or a missing nested object, must become `""`, not `"null"`.** This matters for the text and date columns:
  - `text()` (metrc.ts:447-450) keeps the word "null";
  - `normalizeMetrcDate` returns unmatched input raw (metrc.ts:439);
  - so every such cell would differ from the CSV row under `same()` (metrc.ts:627-632) and churn `changed_at`.
  - Example nulls that hit this rule: `"SourceHarvestNames": null` (pkg:44), `"LocationName": null` (pkg:47), `"SublocationName": null` (pkg:49), `"ExpirationDate": null` (pkg:65).
  - For boolean and number columns the rule only keeps things tidy:
    - `normalizeMetrcBool` returns 1 only for true, yes, 1 or y (metrc.ts:444), so "null" and "" both give 0.
    - `num()` turns "null" into null, because Number gives NaN (metrc.ts:534-535).
    - So a null such as `"IsOnRecall": null` (pkg:105) cannot churn.
- **Booleans become "true" or "false".** `normalizeMetrcBool` reads "true" as 1 (metrc.ts:442-445).
- **Numbers go through `String(n)`.**

### Table 1. Plants: GET /plants/v2/vegetative and /plants/v2/flowering (10 export columns, plus 2 values the file door takes from the file name or the form)

| # | METRC CSV header | Mirror column | API JSON field(s) (docs example) | Transform in the METRC layer | Status | Notes, parity evidence |
|---|---|---|---|---|---|---|
| 1 | Tag (metrc.ts:47) | tag | `Label` (veg:38 "ABCDEF012345670000000024") | trim, upper-case (shapePlantRow, metrc.ts:503) | RENAMED | `Id` (veg:37 24) is a numeric id beside it. The mirror keys on Label. |
| 2 | Strain (metrc.ts:48) | strain | `StrainName` (veg:48 "Spring Hill Kush") | text() | RENAMED | `StrainId` (veg:47) is an id; use the name. |
| 3 | Location (metrc.ts:49) | location | `LocationName` (veg:50 "Plants Location") | text(), stored verbatim as METRC words it. No location-word decoding at mount; no inbound decoder exists. | RENAMED | `LocationId` (veg:49) is an id. `LocationTypeName` (veg:51) is an extra. Crew moves write this column directly (locations.ts:397, `UPDATE metrc_plants SET location = ?`). An incremental pass re-asserts only rows METRC modified. |
| 4 | Sublocation (metrc.ts:50) | sublocation | `SublocationName` (veg:53 null) | text() | RENAMED | `SublocationId` (veg:52) is an id. Snapshot: null in 97,936 of 97,936. |
| 5 | Hold (metrc.ts:51) | hold | `IsOnHold` (veg:60 false). Candidate to OR in: `IsOnInvestigationHold` (veg:62 false). | boolean string, then normalizeMetrcBool | DERIVED. Which flags the export's Hold combines is UNRESOLVED. | Snapshot: 0 in all 97,936, so no fixture from today's data can settle it. A separate list exists, GET /plants/v2/onhold: "Retrieves plants that are currently on hold at a specified Facility." (onhold:3). Whether held plants also appear in /vegetative or /flowering is undocumented (probe P4).<br>Until Metrc says, a complete plants full pass also reads /plants/v2/onhold and counts its tags as seen within the phase their `GrowthPhase` names (onhold:40 "Flowering"), so a held plant missing from /vegetative or /flowering is not marked gone (Findings A10). The onhold rows feed the seen set only, never this column. |
| 6 | Plant Batch (metrc.ts:52) | plant_batch | `PlantBatchName` (veg:44 "Demo Plant Batch") | text() | RENAMED | `PlantBatchId` (veg:43) is an id. Snapshot: 85,133 values are 24-character tag-shaped labels; the rest are names. |
| 7 | Plant Batch Type (metrc.ts:53) | plant_batch_type | `PlantBatchTypeName` (veg:46 "Seed"; flw:46 "Clone") | text() | RENAMED | `PlantBatchTypeId` (veg:45) is an id. Snapshot words are Seed (81,618) and Clone (16,318), matching the docs' words. |
| 8 | Plant Batch Date (metrc.ts:54) | plant_batch_date | The plant object has no field named for its batch's date.<br>Candidate (a): the plant's `PlantedDate` (veg:64 "2014-10-10").<br>Candidate (b): the batch's own `PlantedDate` from the paged lists GET /plantbatches/v2/active and /plantbatches/v2/inactive (pbx:60 and pbxi:60 "PlantedDate": "2014-10-10"; both take `lastModifiedStart`, pbx:22 and pbxi:22), joined on `PlantBatchId`.<br>Fallback for (b): GET /plantbatches/v2/{id}, "Retrieves a Plant Batch by Id." (pbid:3), one call per batch. | normalizeMetrcDate (ISO prefix kept, metrc.ts:434-435) | DERIVED, UNRESOLVED | Snapshot: 1,288 distinct plant_batch values (698 among live rows). Every batch carries exactly one plant_batch_date across all its plants (0 batches with more than one). That supports a batch-level value. It does not separate (a) from (b), since the plants of one batch may share one PlantedDate.<br>The examples give the plant and the batch the same "2014-10-10", but example values are illustrative, not proof.<br>Cost for the Law 5 budget: the per-id route is up to 1,288 calls (698 for live batches). The list route is one call per 50 batches per license per list (pageSize "a value that does not exceed 50", pbx:20), then incremental by lastModified. The size of each license's inactive batch list is unknown.<br>Permission: "View Immature Plants" (pbx:7), not the plants' "View Veg/Flower Plants" (veg:7).<br>A parity read settles the pairing. |
| 9 | Phase Date (metrc.ts:55) | phase_date | `VegetativeDate` (veg:65 "2014-10-20") when the call was /vegetative; `FloweringDate` (flw:66 "2014-11-09") when it was /flowering | pick by endpoint, then normalizeMetrcDate | DERIVED | A flowering row carries both dates (flw:65-66), so the pick must follow the endpoint. Snapshot: phase_date is on or after plant_batch_date in every row. |
| 10 | Harvested (metrc.ts:56) | harvested | No boolean named Harvested. Candidates: `HarvestedDate` (plinact:67 "2014-11-19") or `HarvestId` (plinact:55 2). Beside them: `State` (plinact:39 "Harvested"; veg:39 "Tracked"). Never `HarvestCount`. | Rule to 0 or 1. Proposed: 1 when HarvestedDate or HarvestId is not null. | DERIVED, UNRESOLVED | **Never HarvestCount**, which code_mirror section 2 offered as a candidate: it is 0 on the harvested plant in the example (plinact:59), so "HarvestCount > 0" would read it as not harvested. Example values are illustrative, so this is a reason to test, not proof.<br>The non-null HarvestId and HarvestedDate appear only in the /plants/v2/inactive example, and the mirror does not read that list (NOT USED, candidate gone evidence, A12). Whether a /vegetative or /flowering row ever carries them is undocumented.<br>Snapshot: 0 in all 97,936.<br>**TRANSLATION_MAP row 1's proof moves to `metrc_harvests`.** Row 1 names "`metrc_plants.harvested` and `phase` per tag" as the mirror's proof (TRANSLATION_MAP.md:15). That column is 0 on all 97,936 snapshot rows, and a harvested plant leaves the vegetative and flowering lists for /plants/v2/inactive (plinact:39 "Harvested"; an inference from example values), so neither door is likely to set it. The harvest's own name, wet weight, drying location and plant count (Table 3) carry row 1's proof instead. |
| + | (not a column: the file name grid or the form) | phase | The endpoint path. Cross-check: `GrowthPhase` (veg:40 "Vegetative", flw:40 "Flowering"). | phaseFromGrid (metrc.ts:125-131) maps "Flowering" to flowering and "Vegetative" to vegetative. | DERIVED | The gone scope is license plus phase (loadLiveTags, metrc.ts:889-897), so phase comes from the call. Log any disagreement with GrowthPhase. |
| + | (not a column: the file name or the form) | license_value | The `licenseNumber` query parameter: "The License Number of the Facility for which to return the list of vegetating plants." (veg:12) | Must pass isKnownSiteLicense (metrc.ts:1067), as the file door does. | DERIVED | The row carries no facility license. `PatientLicenseNumber` (veg:54) is a patient's, not the facility's. |

Plants tally: 6 RENAMED, 4 DERIVED, 0 SAME, 0 LACKING. Two of the DERIVED columns, Plant Batch Date and Harvested, have no API field named for them and rest on unproven candidates.

### Table 2. Packages: GET /packages/v2/active only (22 export columns)

**/packages/v2/inactive never feeds the reconcile as incoming rows.**
- The export grid is the active grid: "METRC's packages grid, byte for byte (PackagesActive)." (metrc.ts:59).
- Inactive means finished or discontinued: "Packages can only reach this status by being Finished or Discontinued." (bp:15). The inactive example carries `"IsFinished": true` and `"FinishedDate": "2014-12-15"` (pkinact:108-109).
- Suppose inactive rows entered planMirrorPass as incoming rows:
  - diffMount would add the unseen ones and treat every gone one as moved (`let moved = was.gone_at != null;`, metrc.ts:667);
  - packageUpdateStmt would then clear `gone_at = NULL` and `gone_mount_id = NULL` (metrc.ts:971-972);
  - every finished or discontinued package would be added or brought back as live;
  - closeLedgerForGoneTags selects only `m.gone_at IS NOT NULL` (metrc.ts:1110), so it would miss them.
- Rule (Findings A12): /inactive is not read by the mirror (NOT USED, candidate gone evidence). Reading it only as positive gone evidence for tags the mirror already holds is the later law change that A12 leaves to the Scribe, and that code_mirror section 10 leaves UNRESOLVED.
- The docs name /inactive as a sync source: "Packages can only leave a Facility's active inventory via Finishing, Discontinuing, and Outgoing Transfers." (bp:9). /active and /inactive are listed at bp:13-15.
- If an inactive row is read as evidence, the mapping below still applies to it, since the keys match (pkinact).
- **/packages/v2/onhold feeds the seen set only.** A complete packages full pass also reads it and counts its tags as seen, so a held package missing from /active is not marked gone (Findings A10). Its rows never enter as incoming rows. Whether held packages also appear on /active is undocumented (probe P4).

| # | METRC CSV header | Mirror column | API JSON field(s) (docs example) | Transform in the METRC layer | Status | Notes, parity evidence |
|---|---|---|---|---|---|---|
| 1 | Tag (metrc.ts:61) | tag | `Label` (pkg:38 "ABCDEF012345670000010042") | trim, upper-case (metrc.ts:540) | RENAMED | `Id` (pkg:37) is an id. |
| 2 | Source Harvest(s) (metrc.ts:62) | source_harvests | `SourceHarvestNames` (pkg:44 null). A filled value appears only in another endpoint's example, a single name: xfer:44 "2025-01-18-Harvest Location-H". | text(); the list is kept raw. Readers split it with harvestTokens on `,` or `;` (metrc.ts:1719-1724). | RENAMED; the separator is UNRESOLVED; **truncation flag** | Snapshot: 12,384 of 14,488 rows hold a comma-separated list; none uses a semicolon.<br>**Truncation:** 7,253 rows (6,740 live, all on license AU-G-C-000832) hold exactly 1,000 characters ending in "...". A sample tail reads `..., 45930-ARL-OD-009-0-01-25067, 4593...`, so the last name is cut mid-name. No truncating code was found in metrc.ts (text() only, metrc.ts:544), csv.ts or xlsx.ts. The cut most likely comes from METRC's export. No local doc mentions a length cap.<br>If the API returns the full list, about half the package table reads as would-update. The parity fixture must either compare truncated values or expect those would-updates.<br>`SourceHarvestCount` (pkg:41) gives a count to check the split against, but not on the truncated CSV rows.<br>If the API joins names another way, or a token is cut, lineage silently breaks wherever harvestTokens reads this column. Among them: inheritedHarvest (metrc.ts:1729-1747), listMetrcAdoptions (metrc.ts:1828-1829, 1843), labeldata.ts:335, 343, 354, 407, 462, 841 and rad.ts:248-302.<br>Per-package alternative: GET /packages/v2/{id}/source/harvests, "Retrieves the source harvests for a Package by its Id." (pksh:3). It returns one object per harvest with its own `"Name"` (pksh:24), so there is no separator. It costs one call per package and needs a different permission, "View Package Source Harvests" (pksh:7). |
| 3 | Source Package(s) (metrc.ts:63) | source_packages | `SourcePackageLabels` (pkg:45 null) | text() | RENAMED; the separator is UNRESOLVED | Snapshot: 72 rows hold a comma list. `SourcePackageCount` (pkg:42) is the check. |
| 4 | Original Source Package Label (metrc.ts:64) | original_source_label | `ProductLabel.OriginalSourcePackageLabel` (pkg:192 null), nested | The getter reads the nested object; a null object gives "". | RENAMED (nested); the pairing is UNRESOLVED | The pairing is a name match only. The example value is null. `ProductLabel` is a QR-label object (`QrCount` pkg:189, `LabelSource` pkg:193, `QrCodeRanges` pkg:194, `LastLabelGenerationDate` pkg:195), and no prose in the local docs defines the field. `ProductLabel.OriginalSourcePackageId` (pkg:191) is an id.<br>Snapshot: 4,286 rows are set, holding only 2 distinct values, all on AU-G-C-000832; one row is lower-case. If the API returns a different case, that row reads as a would-update. |
| 5 | Source Processing Job(s) (metrc.ts:65) | source_processing_jobs | None on the package object. The example has only `SourceProcessingJobCount` (pkg:43 0), a count. | Stays null from the API door. | **LACKING** (on the package object) | Snapshot: null in all 14,488, so there is no churn today.<br>Whether the names can be joined in from elsewhere is UNRESOLVED. GET /processing/v2/active returns each job's `"Name": "brownies"` (proc:38) and a `"Packages": []` array (proc:67) whose element shape is undocumented. That list needs the "Manage Processing Job" permission (proc:7). Processing is parked (brief section 5; map gap 3). |
| 6 | Location (metrc.ts:66) | location | `LocationName` (pkg:47 null) | text(), verbatim | RENAMED | `LocationId` (pkg:46) is an id. `LocationTypeName` (pkg:50) is an extra. Snapshot: 138 distinct words; "Barn" on 12,264 rows.<br>Crew moves write this column directly (locations.ts:355, `UPDATE metrc_packages SET location = ?`).<br>The adoption path copies this raw word into the floor ledger (metrc.ts:1849 into actions.ts:2888); see the location-words decoder row. |
| 7 | Sublocation (metrc.ts:67) | sublocation | `SublocationName` (pkg:49 null) | text() | RENAMED | `SublocationId` (pkg:48) is an id. Snapshot: null in all. |
| 8 | Item (metrc.ts:68) | item | `Item.Name` (pkg:117 "Buds") | nested read | RENAMED (nested) | `Item.Id` (pkg:116) is an id. |
| 9 | Category (metrc.ts:69) | category | `Item.ProductCategoryName` (pkg:120 "Buds") | nested read | RENAMED (nested) | `Item.ProductCategoryType` (pkg:121 0) is a numeric code, not the name; never use it here. |
| 10 | Item Strain (metrc.ts:70) | item_strain | `Item.StrainName` (pkg:134 null) | nested read | RENAMED (nested) | `Item.StrainId` (pkg:133) is an id. |
| 11 | Quantity (metrc.ts:71) | quantity | `Quantity` (pkg:51 1.0) | `String(n)` then num() (metrc.ts:531-536). No rounding and no unit conversion. same() compares as numbers. | SAME | The unit lives in column 12; never convert here (the CSV door does not either). |
| 12 | Unit Of Measure (metrc.ts:72) | uom | `UnitOfMeasureAbbreviation` (pkg:59 "oz"), **not** `UnitOfMeasureName` (pkg:58 "Ounces") | text() | RENAMED | See the units flag below. The docs pair the words: `"Name": "Grams"`, `"Abbreviation": "g"` (uom:37-38), and "Each" with "ea" (uom:22-23). Snapshot uom holds only g (1,587) and ea (12,901), which are the abbreviations. |
| 13 | Production Batch Number (metrc.ts:73) | production_batch | `ProductionBatchNumber` (pkg:77 null) | text() | RENAMED | `IsProductionBatch` (pkg:76) is a flag beside it. |
| 14 | Source Production Batch (metrc.ts:74) | source_production_batch | `SourceProductionBatchNumbers` (pkg:78 null), plural | text(); the list is kept raw | RENAMED; the separator is UNRESOLVED | Snapshot: 134 distinct non-null values across 12,346 non-null rows. Only 1 row holds a comma list, so the separator for this column is nearly untestable from today's data. |
| 15 | Lab Test Status (metrc.ts:75) | lab_test_status | `LabTestingState` (pkg:69 "NotSubmitted") | text() | RENAMED | The vocabulary reads as shared. All eight snapshot words appear verbatim in GET /labtests/v2/states (lts:20-27): TestPassed 13,243, NotSubmitted 761, RetestPassed 233, SubmittedForTesting 181, TestFailed 30, RetestFailed 23, TestingInProgress 16, AwaitingConfirmation 1.<br>releaseTestedFromMirror and `metrc_release_states` (parseMetrcReleaseStates, config.ts:813-825) depend on these words.<br>`InitialLabTestingState` (pkg:68) is a different field. |
| 16 | Finished Goods (metrc.ts:76) | finished_goods | `IsFinishedGood` (pkg:110 false) | boolean string, normalizeMetrcBool | RENAMED | Do not confuse it with `IsFinished` (pkg:108). That flag is true with `"FinishedDate": "2014-12-15"` on the inactive list (pkinact:108-109) and means the package itself was finished. Snapshot: 0 in all. |
| 17 | Administrative Hold (metrc.ts:77) | admin_hold | `IsOnHold` (pkg:100 false), `IsOnHoldCombined` (pkg:101 false) or `IsOnInvestigationHold` (pkg:103 false) | boolean string, normalizeMetrcBool | DERIVED; which flag or flags is UNRESOLVED | The third candidate is listed to match plants row 5, which raises the same-named flag (veg:62). Snapshot: 0 in all 14,488, so today's data cannot settle it. |
| 18 | Administrative Recall (metrc.ts:78) | admin_recall | `IsOnRecall` (pkg:105 null), `IsOnRecallCombined` (pkg:106 false) or `IsOnInvestigationRecall` (pkg:104 false) | boolean string, normalizeMetrcBool; a null gives 0 either way | DERIVED; which flag or flags is UNRESOLVED | In the example the plain flag is null while the Combined flag is false. Snapshot: 0 in all. |
| 19 | Packaged Date (metrc.ts:79) | packaged_date | `PackagedDate` (pkg:64 "2014-11-29") | normalizeMetrcDate; no zone conversion (Findings A24) | RENAMED | Date only: "The only ISO 8601 date format supported is YYYY-MM-DD." (gs:97) |
| 20 | Received (metrc.ts:80) | received_date | `ReceivedDateTime` (pkg:96 null), a date-time | Take the date part. Today that is the ISO prefix (metrc.ts:434-435). Default until the parity read: convert to the America/New_York calendar date first (Findings A25). | DERIVED; the zone is UNRESOLVED | "The API will accept any time zone offset specified, and convert it to UTC for storage." (gs:111)<br>If the value comes back in UTC, the prefix falls a day after the facility day for receipts late in the evening, and each such row differs from the CSV date.<br>Snapshot: 12,511 rows carry a received date.<br>The parity read decides between converting to the farm zone first and taking the prefix as returned. |
| 21 | Expiration Date (metrc.ts:81) | expiration_date | `ExpirationDate` (pkg:65 null) | normalizeMetrcDate; no zone conversion (Findings A24) | RENAMED | Snapshot: null in all. |
| 22 | Lab Test Expiration (metrc.ts:82) | lab_test_expiration | `LabTestResultExpirationDateTime` (pkg:72 null), a date-time | date part; same zone question and same default as row 20 (Findings A25) | DERIVED; the pairing is UNRESOLVED (it is the only lab expiration field in the example) | Snapshot: null in all. |
| + | (not a column) | license_value | The `licenseNumber` query parameter (pkg:12) | isKnownSiteLicense | DERIVED | The mirror law's license hop by tag alone still applies. |

Packages tally: 1 SAME (Quantity), 16 RENAMED, 4 DERIVED (Administrative Hold, Administrative Recall, Received, Lab Test Expiration), 1 LACKING (Source Processing Job(s)).

**Columns a parity read of today's data cannot test**, because the snapshot holds only one value in them:
- plants: hold, harvested, sublocation;
- packages: finished_goods, admin_hold, admin_recall, sublocation, source_processing_jobs, expiration_date, lab_test_expiration.
- Nearly untestable: the separator of source_production_batch (1 comma row).
- Testable only with the truncation in mind: source_harvests on the 7,253 cut rows.

### Table 3. Proposed `metrc_harvests` (Law 6, migration 0097; reads GET /harvests/v2/active and /harvests/v2/inactive, plus /harvests/v2/onhold in a complete full pass)

Modeled on 0042's `metrc_plants` (0042:40-58). The harvest object has 30 fields (hva:37-66).

**Why the harvest leg carries the dates.** Canon 0.30.390, REAL LIFE IN, METRC OUT (CANON.md:748), records that METRC "keeps no harvest date on a package (a harvest carries its dates; ... the source harvest list is derived)". So a harvest's real date can be read back only from the harvest itself, never from the packages made from it. That is what `harvest_start_date`, `finished_date` and `archived_date` below hold.

| Proposed column | Type | API source (docs example) | Transform in the METRC layer | TRANSLATION_MAP row or gap it closes | Status |
|---|---|---|---|---|---|
| harvest_id | INTEGER PRIMARY KEY (assumption A36) | `Id` (hva:37 1) | none | A prerequisite, not a closure. It is the key for GET /harvests/v2/{id} (hid), /harvests/v2/waste?harvestId= (hwaste:14-15), and plants' `HarvestId` (plinact:55). | RENAMED.<br>Evidence for Id as the key: "The harvestId is the unique identifier for each harvest." (hwaste:15). Metrc lets you reference Harvests "using either their unique ID or their name" (gs:127). Without a license, GET /harvests/v2/{id} "will be validated against all of the User's current Facilities" (hid:12).<br>None of these says the Id is unique across licenses: UNRESOLVED.<br>Default (A36): harvest_id alone. The dry run logs any incoming Id already stored under another license instead of moving it. Fallback key: (license_value, harvest_id). |
| name | TEXT NOT NULL | `Name` (hva:38 "2014-11-19-Harvest Location-M") | Trim and store verbatim. Match the HBN upper-cased (hbnFromMetrcName upper-cases, mint.ts:139): "When using the name to reference an object, the comparison is case-insensitive." (gs:127) | Row 1: the wet weights CSV sends HarvestName as the HBN (csv.ts:108-109, 385). Row 4: packages' source_harvests name the harvest. Row 13 and gap 4: the lot token. | RENAMED.<br>The docs name is METRC's own date-location shape. Grip's METRC harvest names are mostly HBNs, but not all. Splitting snapshot source_harvests on commas gives:<br>- 243 distinct seven-part HBNs (such as `26257-PNN-OD-070-0-01-26010`);<br>- 90 bare five-digit 2024 lot tokens (24010, 24011, and so on);<br>- 96 free-text names (such as "#112 Sunset Squeeze GH 6 3/11/24");<br>- 12 tokens cut by the 1,000-character truncation.<br>1,410 package rows carry no seven-part HBN at all.<br>hbnFromMetrcName refuses any name that is not seven parts (mint.ts:140-141). codedHarvestDate returns null unless the first dash segment is five digits (labeldata.ts:309-312), so it also returns null on the docs shape.<br>Matching by HBN and the name decoders therefore cover only part of metrc_harvests.name. The rest match by case-insensitive name only. |
| license_value | TEXT NOT NULL | The `licenseNumber` parameter (hva:12) | Taken from the call; must pass isKnownSiteLicense. `PatientLicenseNumber` (hva:48) is not the facility license. | Row 1: the harvest lives in BARN at the plant-tag license (csv.ts:370-372). | DERIVED. Only the 6 grow licenses read the harvest lists, gated by `CanGrowPlants` from /facilities/v2 (P0); the processor AU-P-000694 does not (see the endpoints below). |
| harvest_start_date | TEXT | `HarvestStartDate` (hva:63 "2014-11-19") | normalizeMetrcDate | Row 1 (ActualDate, csv.ts:387). Row 13 and gap 4: this becomes the date source, and codedHarvestDate (labeldata.ts:308-324) becomes the fallback used only when this is null (see the decoder fork below, Findings correction 15). Gap 2's "where a harvest's real date comes from". | RENAMED.<br>The floor's ActualDate is wetActualDate: "ActualDate is the load's effective date, else the farm day of its created_at" (csv.ts:355-361). It is called at csv.ts:377 and 422. The older comment at csv.ts:375-376 still calls it the lot's finish date.<br>Pairing HarvestStartDate with it is a comparison, not an identity: UNRESOLVED. |
| finished_date | TEXT | `FinishedDate` (hva:64 null; hvi:64 "2015-01-10"; hvi:96 null) | normalizeMetrcDate | Row 4, partial: shows the harvest closed after unload. | RENAMED. Its meaning is inferred from example values only (see the lifecycle note under the gone rule). It sets the 30-day scope (below). |
| archived_date | TEXT | `ArchivedDate` (hva:65 null; hvi:97 "2015-02-01") | normalizeMetrcDate | Feeds the 30-day scope as the fallback when finished_date is null (hvi:96-97), and may tell which kind of inactive. | RENAMED. Meaning inferred, as above. |
| total_wet_weight | NUMERIC | `TotalWetWeight` (hva:52 40.0) | num(); stored raw in the API's unit | Row 1 (Weight) | RENAMED |
| unit_of_weight | TEXT | `UnitOfWeightName` (hva:56 "Ounces") | text(), verbatim. It is a **Name**, not an abbreviation; harvests carry no abbreviation field. | Row 1 (UnitOfWeight). The translator sends "Grams" (csv.ts:382, 423). | RENAMED; UNITS FLAG |
| total_wet_weight_g | NUMERIC. **Optional, under the same G-3 flag as the optional columns below.** Law 6 asks only for "the dates and wet weight the API returns"; G-3 (CANON.md:67) bars "invented fields". | Derived from the two columns above | Factors, one per weight unit name in uom:27-48 (Ounces, Pounds, Grams, Milligrams, Kilograms):<br>- Grams: 1.<br>- Pounds: 453.59237, "METRC's own factor" (config.ts:708-711, canon 0.30.164). **Never** GRAMS_PER_LB = 448 (config.ts:706).<br>- Ounces: 453.59237 / 16, not the house 28 (zohoinv.ts:34).<br>- Kilograms: 1000; Milligrams: 0.001.<br>The Metrc docs give no factors, so this is assumption A38. Any other unit leaves the column null and is named in the sweep log. Round with metrcQuantity (config.ts:712-715). Without the column, the same conversion runs at read time in the METRC layer. | Row 1: the comparison against floor grams. | DERIVED, proposed for the Scribe's word.<br>The harvest object has five weights: `CurrentWeight` (hva:49), `TotalWasteWeight` (hva:50), `TotalWetWeight` (hva:52), `TotalRestoredWeight` (hva:53), `TotalPackagedWeight` (hva:55).<br>Whether all five share the single `UnitOfWeightName` (hva:56) is not documented: UNRESOLVED. |
| location | TEXT | `DryingLocationName` (hva:44 "Harvest Location") | text(), the verbatim METRC word. Compare by applying metrcLocationName (config.ts:1231-1235) to the floor's side. Never decode it into floor words. | Row 1 (DryingLocation). Row 2 (Load a silo, today "none (no harvest mirror)"). Row 3, harvest half (today "none for harvests"). Row 5, the proof leg only; GAP 1 itself stays open because nothing pends. | RENAMED. `DryingLocationId` (hva:43) is an id. |
| sublocation | TEXT | `DryingSublocationName` (hva:46 null) | text() | Rows 1 and 2. The translator sends it empty (csv.ts:368, 384). | RENAMED. Map the name, never the id.<br>`DryingSublocationId` (hva:45) is 0 beside a null name in the example, but the docs define no sentinel. Plants and packages use null for an absent SublocationId (veg:52, pkg:48). The meaning of 0 is UNRESOLVED. |
| state | TEXT NOT NULL | No State field on a harvest | The list the harvest was last seen in: 'active' from /harvests/v2/active, 'onhold' from /harvests/v2/onhold (read in a complete full pass), 'inactive' from /harvests/v2/inactive. finished_date or archived_date may tell which kind of inactive (inferred, see below). | Rows 1 and 4 | DERIVED. Whether on-hold harvests also appear on /active is undocumented (probe P4). |
| plant_count | INTEGER | `PlantCount` (hva:51 70) | num() | Row 1: the plant count split (canon 0.30.62, csv.ts:402-410) | RENAMED. Whether METRC counts plants when the translator leaves Plant empty (csv.ts:366-367) is UNRESOLVED. |
| mount_id, gone_mount_id | TEXT | The sweep's mount row (source 'api') | Same as 0042 | Bookkeeping. Not in the brief's list; it lets harvests share the one reconcile (see below). No reader reads mount_id today (code_mirror section 7). | Proposed |
| first_seen_at | TEXT NOT NULL | Set on insert | THE MIRROR LAW | Bookkeeping | Proposed |
| changed_at | TEXT NOT NULL | Set when any column above differs under same() | THE MIRROR LAW | Bookkeeping | Proposed |
| gone_at | TEXT | Set only by the gone rule below | | Bookkeeping | Proposed rule (Findings A19); the lifecycle it rests on is inferred |

**Harvests and the one reconcile (Law 1).** Law 1 says: "Do not write a second reconcile." Today the reconcile cannot take harvests as it stands:
- It is keyed on tag throughout. diffMount builds `byTag` and calls `seen.add(row.tag)` and `byTag.get(row.tag)` (metrc.ts:654, 660-661, 683).
- loadExistingByTags and loadLiveTags read only `metrc_plants` or `metrc_packages` (metrc.ts:872-897).
- code_mirror's proposed core is typed for plant and package rows.
- A harvest row has no tag; its key is `Id` (hva:37).

The two ways forward:
- Option (a), recommended (assumption A37): generalize the core's key from `tag` to a key accessor: `tag` for plants and packages, `String(harvest_id)` for harvests.
  - Add a harvest loader by key and a harvest insert and update statement pair.
  - Give harvests their own gone rule (below) in place of absence alone.
  - The core treats a gone row that comes back as moved (metrc.ts:667). That is safe for harvests, because an inactive harvest is a state on the row, not gone.
- Option (b): a separate harvest planner. That would be a second reconcile, against Law 1, so it needs Dennis's word.

**Scope, state and gone for harvests. This is the one statement of the rule; Findings 6.1 and A19 refer to it.**
- **Scope.** Law 5 reads "harvests (active plus finished in the last 30 days)". "Finished in the last 30 days" means an /inactive row whose `FinishedDate` is within 30 days, falling back to `ArchivedDate` when FinishedDate is null.
  - The second inactive example shows why the fallback is needed: `"FinishedDate": null` (hvi:96) with `"ArchivedDate": "2015-02-01"` (hvi:97).
  - The list's only server filters are licenseNumber, the paging pair and the lastModified pair (hvi:11-26), so the 30 days are applied on our side.
  - Whether an archived but unfinished harvest belongs in scope, and what ArchivedDate means, is probe P9.
  - How far back the inactive read reaches (a lastModified window of at least 30 days, if Metrc allows one that wide) is Findings 6.1 and probe P3.
- **State** is the list the harvest was last seen in: 'active', 'onhold' or 'inactive'.
- **Not gone.** A move from active to inactive is a state change, an in-place update. Aging past 30 days is a view filter. Neither is gone.
- **Gone.** `gone_at` is set only when a complete active pass misses a harvest and no inactive or onhold read has seen it since the pass began.
- The lifecycle is inferred from example values only.
  - The hvi example shows two inactive harvests: one with `"FinishedDate": "2015-01-10"` (hvi:64) and one with `"ArchivedDate": "2015-02-01"` (hvi:97).
  - No doc text says how harvests move between the lists, or what Finished versus Archived means. The only lifecycle prose is about packages (bp:9, bp:15).
  - So "a harvest that leaves /active shows up on /inactive" is an inference.
- THE MIRROR LAW today marks gone by absence only. This rule is Findings A19 for Dennis's word, and a law note for the Scribe.

**Indexes.** Keep two: `(license_value, state, gone_at)` and `(name COLLATE NOCASE)`. Every index adds a written row per insert (canon 0.30.54).

**Optional columns, not in the brief's list (G-3, the Scribe's word):**
- `total_wet_weight_g` (above).
- `CurrentWeight` (hva:49), `PackageCount` (hva:54), `TotalPackagedWeight` (hva:55), `TotalWasteWeight` (hva:50), `TotalRestoredWeight` (hva:53). These give row 4 its proof (unload: what was packaged and what remains). The units flag applies to the four weights.
- `HarvestType` (hva:39 "Product"; hva:71 "WholePlant"). A possible cross-check against the HBN's manicure segment (parseHbn, mint.ts:101); the pairing is UNRESOLVED.
- `IsOnHold` (hva:59), `LabTestingState` (hva:57), `LabTestingStateDate` (hva:58).
- `LastModified` (hva:66) belongs in the Law 5 cursor table, not on the row.

**What this closes in TRANSLATION_MAP.md:**
- **Closes:** gap 2 for rows 1 and 2.
- **Moves:** row 1's proof from `metrc_plants.harvested` (0 on all 97,936 snapshot rows) to metrc_harvests (Table 1 row 10).
- **Gives proof to:** row 3's harvest half, and row 5's proof leg (GAP 1 stays open).
- **Demotes:** gap 4's date decoder to a fallback (row 13).
- **Partly proves:** row 4, and only with the optional weights.
- **Feeds later:** gap 5 (FM1).
- **Leaves open:** row 15 (GAP 3, processing) and row 16 (plant waste and moves).

### Decoders the API door relies on, and where they live today

**What "the METRC layer" means here (assumption A35).**
- What the sources say:
  - Law 2: "Decoders (harvest name dates, location words) stay in the METRC layer."
  - Law 6: "The harvest name's coded date stays decoded in the METRC layer."
  - Gap 4 (TRANSLATION_MAP.md:37): METRC's encodings "are read in one module".
- Today the decoders live in four files.
- This section takes the METRC layer to be:
  - metrc.ts and the API client module(s);
  - the METRC-reading helpers in mint.ts (dateFromYyddd, parseHbn, hbnFromMetrcName);
  - the METRC-reading helpers in config.ts (metrcQuantity, parseMetrcReleaseStates, metrcLocationName).
- metrc.ts already imports parseHbn (metrc.ts:36), and metrcQuantity and parseMetrcReleaseStates (metrc.ts:34).
- On that reading, labeldata.ts's codedHarvestDate is the one decoder outside the layer.

**Whether MA1 moves codedHarvestDate (Findings correction 15, a fork for Dennis).**
- Laws 2 and 6 read as if the coded date already sits in the METRC layer. It does not. That is Findings correction 15; this section's fork folds into it and carries no number of its own.
- Recommended default: MA1 does not move it. MA1 lands `HarvestStartDate` in metrc_harvests, so the decoder becomes the fallback. The move itself is left to a gap 4 brief.
- The alternative is to move it in MA1, which touches the label reads at labeldata.ts:343.

| Decoder | Lives at | In the METRC layer (A35)? | API door use |
|---|---|---|---|
| Harvest name date, three shapes | labeldata.ts:308-324 `codedHarvestDate`; called at labeldata.ts:343 (map row 13, GAP 4) | **No** | Becomes the fallback behind `HarvestStartDate`. Moving it is the correction 15 fork. |
| YYDDD to date | mint.ts:66-75 `dateFromYyddd` | Yes, by A35 | unchanged |
| Seven-part HBN read | mint.ts:92-105 `parseHbn` | Yes, by A35 | unchanged |
| Batch from METRC's harvest name | mint.ts:138-163 `hbnFromMetrcName`. Callers outside the layer: actions.ts:2729, rad.ts:190 and 337, sheetsync.ts:840. | Yes, by A35 | Reads `Name` the same way it reads source_harvests tokens. Refuses names that are not seven parts (mint.ts:140-141). |
| Harvest list split | metrc.ts:1719-1724 `harvestTokens` | Yes | Must match the API's separator (UNRESOLVED). Breaks on the truncated CSV rows (Table 2 row 2). |
| Lineage harvest | metrc.ts:1729-1747 `inheritedHarvest` | Yes | unchanged |
| Grow heading from the HBN code | metrc.ts:1753-1769 `adoptGrowMethod` | Yes | unchanged |
| Item kind; strain from item | metrc.ts:1692-1697 `metrcItemKind`; 1771-1775 `adoptStrain` | Yes | unchanged |
| Units fold | metrc.ts:1865-1870 `metrcUomKey` | Yes | It folds "grams" and "each" too, but storing the Name would still churn `same()`. |
| Location words | config.ts:1231-1235 `metrcLocationName`, **outbound only**: it strips a leading ARL, PNN or PNS. | Yes, by A35 | **No inbound decoder exists.** METRC's "Barn" (12,264 package rows) cannot be turned back into a floor location without the license. FM1 shows the raw word (floormetrc.ts:280, 335).<br>The adoption path already writes the raw METRC word into the floor ledger. listMetrcAdoptions reads `location: String(row.location ?? "").trim()` (metrc.ts:1849), and adoptFromMetrc inserts it into `local_inventory_items.location` (actions.ts:2882-2888). An API door feeds that path the same word.<br>This bears on R3 ("The floor's records never hold a METRC encoding", TRANSLATION_MAP.md:44) and on any later inbound decoder (gap 4). Not needed for the mirror. |
| Dates, booleans, text, numbers | metrc.ts:431-440, 442-445, 447-450, 531-536 | Yes | Shared by both doors through the getter. |
| Phase words | metrc.ts:125-131 `phaseFromGrid` | Yes | Fed by the endpoint path. |
| Release vocabulary | config.ts:813-825 `parseMetrcReleaseStates` | Yes, by A35 | unchanged |
| File door mainly | metrc.ts:111-123 `parseMetrcFilename`, 258-261 `excelSerialToIso`, 421-427 `detectMetrcKind` | Yes | parseMetrcFilename and detectMetrcKind are not used by the API door.<br>excelSerialToIso is reachable from it through normalizeMetrcDate, which calls it for any 4 to 6 digit string (metrc.ts:438). No documented API date field takes that shape. |

### API fields with no export equivalent

- **Plants.** Of 39 fields, 15 feed the columns, phase or the open candidates: Label, State, GrowthPhase, PlantBatchName, PlantBatchTypeName, StrainName, LocationName, SublocationName, HarvestId, IsOnHold, IsOnInvestigationHold, PlantedDate, VegetativeDate, FloweringDate, HarvestedDate. The other 24 have no export column:
  - Id, GroupTagTypeMax, TagTypeMax, PlantBatchId, PlantBatchTypeId, StrainId, LocationId, LocationTypeName, SublocationId, PatientLicenseNumber;
  - HarvestedUnitOfWeightName, HarvestedUnitOfWeightAbbreviation, HarvestedWetWeight, HarvestCount;
  - IsOnInvestigation, IsOnInvestigationRecall;
  - DestroyedDate, DestroyedNote, DestroyedByUserName, MotherPlantDate, ClonedCount, SurvivedCount, DescendedCount, LastModified.
  - **G-9:** `DestroyedByUserName` (veg:70) carries a METRC user's name. Never mirror it, log it or put it in dry-run samples.
- **Packages.** There are 80 top-level fields: 21 that feed columns or open candidates, the Item and ProductLabel objects, and 57 with no export column.
  - The 21 that feed: Label, SourceHarvestNames, SourcePackageLabels, LocationName, SublocationName, Quantity, UnitOfMeasureAbbreviation, ProductionBatchNumber, SourceProductionBatchNumbers, LabTestingState, IsFinishedGood, IsOnHold, IsOnHoldCombined, IsOnInvestigationHold, IsOnRecall, IsOnRecallCombined, IsOnInvestigationRecall, PackagedDate, ExpirationDate, LabTestResultExpirationDateTime, ReceivedDateTime.
  - The 57 with no export column:
    - Id, ExternalId, PackageType, SourceHarvestCount, SourcePackageCount, SourceProcessingJobCount, LocationId, SublocationId, LocationTypeName;
    - OriginalPackageQuantity, CreatedQuantity, CreatedQuantityUnitOfMeasureAbbreviation, ReceivedQuantity, ReceivedUnitOfMeasureAbbreviation, QuantityReturnedToSource, UnitOfMeasureName;
    - PatientLicenseNumber, ItemFromFacilityLicenseNumber, ItemFromFacilityName, Note, SellByDate, UseByDate;
    - InitialLabTestingState, LabTestingStateDate, LabTestingPerformedDate, LabTestingRecordedDate, LabTestStageId, LabTestStage;
    - IsProductionBatch, IsTradeSample, IsTradeSamplePersistent, SourcePackageIsTradeSample, IsDonation, IsDonationPersistent, SourcePackageIsDonation, IsTestingSample, SubmittedProcessingMethod, IsProcessValidationTestingSample;
    - ProductRequiresRemediation, ContainsRemediatedProduct, RemediationDate, ProductRequiresDecontamination, ContainsDecontaminatedProduct, DecontaminationDate, ContainsPreTreatedProduct, PreTreatmentDate;
    - ReceivedFromManifestNumber, ReceivedFromFacilityLicenseNumber, ReceivedFromFacilityName;
    - IsOnInvestigation, ArchivedDate, IsFinished, FinishedDate, IsOnRetailerDelivery, PackageForProductDestruction, LabelsLastGeneratedDateTime, LastModified.
  - **Item:** 71 fields; 3 used (Name, ProductCategoryName, StrainName), 68 unmapped (Id, the potency, dose and unit fields, images, brand and the rest).
  - **ProductLabel:** 8 fields; 1 used (OriginalSourcePackageLabel, pairing UNRESOLVED), 7 unmapped (QrCount, IsChildFromParentWithLabel, OriginalSourcePackageId, LabelSource, QrCodeRanges, LastLabelGenerationDate, IsActive).
- **Harvests.**
  - The app's file door has no harvests kind: `export type MetrcKind = "plants" | "packages";` (metrc.ts:43), and detectMetrcKind returns only those two (metrc.ts:421-427). So the API door is the only door into metrc_harvests.
  - No local source shows whether METRC itself offers a harvests export. The brief's "no export exists for it" (Law 6) carries no citation.
  - Of the 30 fields, the proposed table uses Id, Name, HarvestStartDate, FinishedDate, ArchivedDate, TotalWetWeight, UnitOfWeightName, DryingLocationName, DryingSublocationName and PlantCount.
  - Left out: HarvestType, SourceStrainCount, SourceStrainNames, Strains, DryingLocationId, DryingSublocationId, DryingLocationTypeName, PatientLicenseNumber, CurrentWeight, TotalWasteWeight, TotalRestoredWeight, PackageCount, TotalPackagedWeight, LabTestingState, LabTestingStateDate, IsOnHold, IsOnInvestigation, IsOnInvestigationHold, IsOnInvestigationRecall, LastModified.

### Endpoints this section names, with their mark (brief section 7)

The six mapped lists share one shape. They are plants vegetative and flowering, packages active and inactive, and harvests active and inactive. Each takes:
- a required `licenseNumber`;
- `pageNumber` and `pageSize` ("a value that does not exceed 50", veg:20, pkg:20, hva:20);
- optional `lastModifiedStart` and `lastModifiedEnd` (veg:22-26, pkg:22-26, hva:22-26).

The endpoint map section holds their full paging and lastModified facts. Costs below are per call, for the Law 5 budget. The Mark column uses brief section 7's words: "needed by the mirror" is the endpoint map's MIRROR and "not used" its NOT USED. The onhold and inactive rows carry, word for word, the labels ruled for this section and the endpoint map alike.

| Endpoint (docs) | Mark | License parameter | Paging, lastModified | Permission | Cost |
|---|---|---|---|---|---|
| GET /plants/v2/vegetative, /flowering (veg, flw) | needed by the mirror | required (veg:12) | paged; lastModified yes | "View Veg/Flower Plants" (veg:7) | one call per 50 rows |
| GET /packages/v2/active (pkg) | needed by the mirror | required (pkg:12) | paged; lastModified yes | "View Packages" (pkg:7) | one call per 50 rows |
| GET /packages/v2/inactive (pkinact) | **NOT USED (candidate gone evidence, A12)**. Never incoming rows (Table 2). Positive gone evidence is a later law change for the Scribe. | required (pkinact:12) | paged; lastModified yes | "View Packages" (pkinact:7) | one call per 50 rows in the window |
| GET /harvests/v2/active, /inactive (hva, hvi) | needed by the mirror (Law 6) | required (hva:12, hvi:12) | paged; lastModified yes | "View Harvests" (hva:7) | one call per 50 rows |
| GET /plants/v2/onhold (onhold) | **MIRROR (full-pass seen set only)**: a complete plants full pass reads it and counts its tags as seen within the phase their `GrowthPhase` names (onhold:40); its rows never feed the columns (Findings A10) | required (onhold:12) | paged; lastModified yes (onhold:20-26) | "View Veg/Flower Plants" (onhold:7) | one call per 50 rows. The three onhold lists cost about 420 calls a month together (Findings section 3) |
| GET /packages/v2/onhold (pkonhold) | **MIRROR (full-pass seen set only)**: "Retrieves a list of packages on hold for a specified Facility." (pkonhold:3). A complete packages full pass counts its tags as seen; never incoming rows (Findings A10) | required (pkonhold:12) | paged (pkonhold:20); lastModified yes (pkonhold:22-26) | "View Packages" (pkonhold:7) | one call per 50 rows |
| GET /harvests/v2/onhold (hvonhold) | **MIRROR (full-pass seen set only)**: "Retrieves a list of harvests on hold for a specified Facility." (hvonhold:3). A complete harvests full pass counts its ids as seen, and a harvest last seen there has state 'onhold' (Table 3; Findings A10, A19) | required (hvonhold:12) | paged (hvonhold:20); lastModified yes (hvonhold:22-26) | "View Harvests" (hvonhold:7) | one call per 50 rows |
| GET /plantbatches/v2/active, /inactive (pbx, pbxi) | needed by the mirror only if the parity read picks the batch's PlantedDate for Plant Batch Date; otherwise not used by the mirror (the endpoint map marks it EVAL, E2 support, for the evaluation) | required (pbx:12) | paged (pbx:20); lastModified yes (pbx:22-26) | "View Immature Plants" (pbx:7), a different permission from plants | one call per 50 batches |
| GET /plantbatches/v2/{id} (pbid) | fallback for the same, else not used | optional (pbid:12) | single object | "View Immature Plants" (pbid:7) | one call per batch (up to 1,288) |
| GET /plants/v2/inactive (plinact) | **NOT USED (candidate gone evidence, A12)**; cited here for its example values. Reading it hourly as gone evidence (about 4,320 calls a month) is a MIRROR LAW change for the Scribe, not a build default (Findings 6.6, F-D gone lag) | required (plinact:12) | paged; lastModified yes (plinact:20-26) | "View Veg/Flower Plants" (plinact:7) | one call per 50 rows |
| GET /packages/v2/{id}/source/harvests (pksh) | not used by the mirror; a probe for the separator question | optional (pksh:12) | single list per package | "View Package Source Harvests" (pksh:7), a different permission | one call per package |
| GET /harvests/v2/{id} (hid) | not used by the mirror (the lists carry the same object) | optional (hid:12) | single object | "View Harvests" (hid:7) | one call per harvest |
| GET /harvests/v2/waste (hwaste) | not used by the mirror (would feed the optional row 4 proof) | required, plus `harvestId` (hwaste:11-15) | paged (hwaste:21-23); **no** lastModified | "View Harvests" (hwaste:7) | at least one call per harvest |
| GET /labtests/v2/states (lts) | not used by the mirror; a vocabulary check | none: "No parameters" (lts:11) | none | "None" (lts:7) | one call |
| GET /unitsofmeasure/v2/active (uom) | not used by the mirror; a vocabulary check | none: "No parameters" (uom:11) | none | "None" (uom:7) | one call |
| GET /processing/v2/active (proc) | not used (processing parked) | required (proc:12) | paged; lastModified yes (proc:18-26) | "Manage Processing Job" (proc:7), a manage permission | one call per 50 jobs |
| GET /packages/v2/transferred (xfer) | not used by the mirror (cited for an example value only) | required (xfer:12) | paged; lastModified yes (xfer:18-26) | "View Packages" (xfer:7) | one call per 50 rows |

**Which licenses call which list.**
- The 7 active lookup licenses all read packages.
- The 6 grow licenses also read plants and harvests, gated by `CanGrowPlants` from /facilities/v2 (P0). The processor AU-P-000694 reads packages only.
- Plants therefore run 12 license and phase pairs.
- Floors at P = 50 (Findings section 3), counting 1 call for each empty pair or list:
  - harvests: 12 calls a day (6 licenses, active and inactive);
  - a plants full pass: 973 calls at live counts, 1,965 at the 2026-09-14 drop totals.

Whether the evaluation needs any of the not-used endpoints is decided by the derived evaluation step list, not here.

### Flags

**Units differ.**
1. **Packages.** The export's Unit Of Measure is the abbreviation: the snapshot holds only `g` and `ea`, matching uom:23 and uom:38. The API offers both `UnitOfMeasureName` (pkg:58 "Ounces") and `UnitOfMeasureAbbreviation` (pkg:59 "oz"). **Map the Abbreviation.** Taking the Name would cause two failures:
   - every one of the 14,488 rows would differ under `same()` and update;
   - FM1's `sameUom` (floormetrc.ts:136-140, exact lower-cased match) would report units differ on every package against the floor's `g`.
2. **Harvests.** The API gives the unit only as a Name, `UnitOfWeightName` (hva:56 "Ounces"), and has one unit field for five weights:
   - the five weights are `CurrentWeight` (hva:49), `TotalWasteWeight` (hva:50), `TotalWetWeight` (hva:52), `TotalRestoredWeight` (hva:53) and `TotalPackagedWeight` (hva:55);
   - `PlantCount` (hva:51) and `PackageCount` (hva:54) are counts, not weights;
   - the floor and the translator speak grams (csv.ts:382);
   - convert in the METRC layer at 453.59237 grams per pound (config.ts:708-711), never the house 448 (config.ts:706) or 28 grams per ounce (zohoinv.ts:34).
3. **Plants** carry their own harvest weight unit: `HarvestedUnitOfWeightName` "Ounces" and `HarvestedUnitOfWeightAbbreviation` "oz" (plinact:56-57) beside `HarvestedWetWeight` 1.0 (plinact:58). These are not mirrored.
4. **Packages also carry separate unit fields** for CreatedQuantity (pkg:54), ReceivedQuantity (pkg:56) and `Item.UnitOfMeasureName` (pkg:130). ReceivedQuantity may sit in a different unit from Quantity. None is mirrored.

**Ids and codes instead of names.**
- Every name the 32 export columns carry has its name field beside its id in the example, so the mapping needs no lookup call. The one exception is Plant Batch Date, if the batch route wins. The ids beside names are:
  - plants: StrainId, LocationId, SublocationId, PlantBatchId, PlantBatchTypeId;
  - packages: LocationId, SublocationId, Item.Id, Item.StrainId, Item.ItemBrandId, Item.AdministrationMethodId, LabTestStageId, ProductLabel.OriginalSourcePackageId;
  - harvests: DryingLocationId, DryingSublocationId. The example has DryingSublocationId 0 beside a null name (hva:45-46). The meaning of 0 is UNRESOLVED, so map the name.
- **An id with no name beside it:** the plant's `HarvestId` (plinact:55). The plant object carries no harvest name, so tying a harvested plant to its HBN needs `metrc_harvests` by id or GET /harvests/v2/{id} (hid). `metrc_plants` has no column for it.
- **Numeric codes where a word might be expected:**
  - `Item.ProductCategoryType` (pkg:121 0): use ProductCategoryName instead.
  - `Item.QuantityType` (pkg:128 0), `Item.DefaultLabTestingState` (pkg:129 0), `Item.ApprovalStatus` (pkg:131 0). The package's own `LabTestingState` is a word.
- Harvest `Strains` (hva:42 []) has no documented element shape. `SourceStrainNames` (hva:41) is the text form.

**What the CSV carries that the API does not give as a plain field.**
- *No field (LACKING):* Source Processing Job(s) names on the package object, which has only a count (pkg:43). A join through /processing/v2/active `Packages` (proc:67) is UNRESOLVED and parked.
- *Needs an unproven rule (DERIVED):*
  - Plant Batch Date: the plant object has no batch date field.
  - Harvested: there is no boolean; it has to be derived from candidates.
  - Received as a facility-day date: the API gives a date-time, and the docs say offsets are converted "to UTC for storage" (gs:111).
- *Properties of the file, not of a field:*
  - Completeness. A CSV is meant to be a whole snapshot of one license, and for plants one phase. Two things about that are unverified:
    - Canon 0.30.42 (CANON.md:400): "The 1509 flowering export carries exactly 10,000 rows, a round number to check against METRC's grid before its gone marks are trusted."
    - The export cuts Source Harvest(s) at 1,000 characters (Table 2 row 2).
  - A lastModified page is not complete either, so only a finished full pass may mark rows gone.
  - The file-name grid that sets phase: the API's equivalent is the endpoint path.
  - The ", " list separator the export uses in Source Harvest(s), Source Package(s) and Source Production Batch: the API's separator is undocumented.

### Assumptions for Dennis's word (A35 upward, one namespace with Findings A1 to A34)

- A35. "The METRC layer" is metrc.ts and the API client module(s), plus the METRC-reading helpers in mint.ts (dateFromYyddd, parseHbn, hbnFromMetrcName) and config.ts (metrcQuantity, parseMetrcReleaseStates, metrcLocationName).
- A36. metrc_harvests keys on harvest_id alone. Fallback: (license_value, harvest_id) if a collision shows.
- A37. Harvests reach the one reconcile by generalizing its key (option a), not through a second planner.
- A38. The gram factors for total_wet_weight_g (Pounds 453.59237, Ounces 453.59237 / 16, Kilograms 1000, Milligrams 0.001), and whether the column exists at all (G-3).
- Folded into Findings by reference, with no number here:
  - The codedHarvestDate fork is Findings correction 15. This section's default: MA1 does not move it; it lands HarvestStartDate so the decoder becomes the fallback, and the move is gap 4 work. (Fork: move it in MA1 instead.)
  - "/packages/v2/inactive is never read as incoming rows" is Findings A12: gone stays absence-only, and positive evidence from /packages/v2/inactive is left to a later law change by the Scribe. Table 2's lead gives the code reason it can never be incoming rows.
- Findings assumptions this section applies: A10 (onhold lists in the full-pass seen set), A12 (gone stays absence-only; the inactive lists are candidate gone evidence, not read), A19 (harvest scope and gone rule, stated in Table 3), A24 and A25 (date and date-time columns, Table 2 rows 19 to 22).

### UNRESOLVED items, by what can settle each

The settlers:
- (a) A sandbox GET fixture (E1).
- (b) A sandbox write in E2. Sandbox inventory comes only from POSTs such as POST /sandbox/v2/packages/create, and the local docs list no sandbox endpoint that creates plants, plant batches or harvests.
- (c) A production `dry_run` parity read under Laws 7 and 9. Brief section 6 keeps production data out of fixtures.
- (d) Metrc's written answer.

Few items can be settled by (a) alone, because an E1 sandbox may hold no inventory.

1. Plant Batch Date pairing (the plant's PlantedDate, or the batch's PlantedDate): (c).
2. The Harvested rule (HarvestedDate or HarvestId, versus State), and whether a /vegetative or /flowering row ever carries them: (b) or (d). (c) cannot settle it, since the snapshot is 0 everywhere.
3. Which flags the plants Hold column combines: (b) or (d).
4. Administrative Hold: IsOnHold, IsOnHoldCombined or IsOnInvestigationHold: (b) or (d).
5. Administrative Recall: IsOnRecall, IsOnRecallCombined or IsOnInvestigationRecall: (d), or (b) if a recall can be made in the sandbox.
6. The list separators (probe P5 for the first two):
   - SourceHarvestNames (12,384 comma rows) and SourcePackageLabels (72): (c).
   - SourceProductionBatchNumbers (1 comma row): (c) only by luck, else (d).
7. Source Harvest(s) truncation at 1,000 characters: (c) shows whether the API returns the full list. The fixture must expect or mask those rows.
8. Date-time fields:
   - ReceivedDateTime zone and which date part to take: (c) (12,511 rows).
   - LabTestResultExpirationDateTime zone, and its pairing with Lab Test Expiration: (d) or (b), since the snapshot is null everywhere.
9. OriginalSourcePackageLabel, its pairing with the export column and its case: (c) only (the one lower-case row is production data).
10. Whether one UnitOfWeightName covers all five harvest weights: (d), or (b) with a harvest that carries waste.
11. Harvest Id uniqueness across licenses: (d). (c) can show collisions across Grip's own licenses but cannot prove uniqueness.
12. The harvest lifecycle (active to inactive, Finished versus Archived; probe P9 for an archived but unfinished harvest): (d), plus (c) observed over time. The gone rule is set as Findings A19 (Table 3); it rests on this inferred lifecycle and stays a law note for the Scribe.
13. Whether PlantCount reflects untagged wet-weight rows: (b) (needs a create-harvest write) or (d).
14. Whether on-hold plants, packages and harvests also appear on the active, vegetative and flowering lists (probe P4): (d) or (b). Until then the full pass reads the onhold lists into its seen set (Findings A10).
15. The meaning of DryingSublocationId 0: (c) on Grip's own harvests, or (d).
16. Pairing HarvestStartDate with the floor's ActualDate: (c), as a comparison for FM1.
17. Pairing HarvestType with the HBN's manicure segment: (c).
18. A join from processing jobs to packages through `Packages` (proc:67): (d); parked.
19. The role of /packages/v2/inactive (not read, or gone-only evidence; Findings A12): a law change for the Scribe, informed by (d).

The snapshot profiles came from scripts in the scratch folders `wf/synth_mapping/` (prof.py, prof2.py, cnt.py, un.py) and `wf/fix_mapping/` (fp.py, fp2.py, fk.py, cons_prof.py). Nothing under the project tree was written.

### Consolidation notes

1. Assumption numbers (D1, critic 3). This section's former A1 became A35, its A3 became A36, its A4 became A37 and its A5 became A38, with every in-text reference updated. Its former A2 (codedHarvestDate) folds into Findings correction 15 and its former A6 (/packages/v2/inactive never incoming) folds into Findings A12, both by reference. Probe references use P numbers (P0, P3, P4, P5, P9).
2. One Law 2 table (D2, critic 2). The lead now says Tables 1 to 3 are the only mapping tables. Row 10 now says never HarvestCount (plinact:59 is 0 on the harvested plant). So that nothing correct is lost when Findings 6.1's table goes, each header cell carries its metrc.ts line (:47 to :56, :61 to :82, re-read on the MA1 worktree), and rows 19 to 22 carry A24 and A25. The other readings D2 names (UOM, Original Source Package Label, the three-candidate holds and recalls, Lab Test Status) were already this section's and were re-verified on the snapshot.
3. Onhold lists (D3, critic 7). /plants/v2/onhold is now "MIRROR (full-pass seen set only)". Rows were added for /packages/v2/onhold and /harvests/v2/onhold, each citation checked in the docs (:3, :7, :12, :20, :22-26). Plants row 5 and Table 2's lead point to A10. The cost of about 420 calls a month is cited to Findings section 3.
4. Harvests (D4, critic 6 and 20). The state set is active, onhold and inactive. The 30-day scope uses FinishedDate, falling back to ArchivedDate (hvi:96-97 re-read). The one gone rule is stated in Table 3 in D4's words and tied to A19. archived_date no longer "feeds state only". Canon 0.30.390 is cited from CANON.md:748, quote verified.
5. Licenses (D5, critic 15). A license-scope note was added. 973 and 1,965 were re-derived from the snapshot: 965 calls on 4 live pairs plus 8 empty pairs, and 1,960 calls on 7 drop pairs plus 5 empty pairs. lookup_values holds 7 active licenses, AU-P-000694 among them.
6. Harvested row (D14, critic 24). TRANSLATION_MAP row 1's proof moves to metrc_harvests (TRANSLATION_MAP.md:15 re-read; harvested is 0 on 97,936 of 97,936 rows). The "What this closes" list gains a Moves line.
7. Inactive marks (D14, critic 14). /plants/v2/inactive and /packages/v2/inactive now read "NOT USED (candidate gone evidence, A12)". The plants row also names D13's hourly alternative (about 4,320 calls a month, 6 licenses x 720 ticks) as a MIRROR LAW change.
8. Tree and snapshot (D10, critic 5). Every cited code file hashes the same on main and GFLiteOpsDashboard, and did on GFLiteMetrcAPI at its cut; W's config.ts has changed since about 19:13. xlsx.ts, which was cited but not hashed, was added. The pre_r5 snapshot's metrc_plants.json and metrc_packages.json are byte-identical to the 13:59 ones, and every figure was re-run on both.
9. Self-verified fixes. `code_mirror` is now defined in the sources. The plant-batch endpoint row notes the endpoint map's EVAL (E2 support) mark. More than 150 docs line citations in this section were re-read in `metrcdocs`, and all held.
10. Checked, nothing for this section: D6 to D9, D11, D12, D15 and D16; critic 1, 4, 8 to 13, 16 to 19, 21 to 23 and 25. This section cites no workbook cells, so D14's citation form does not apply.
11. The old 39-item "Verification notes" block is dropped. It logged the pre-critic fix pass, and its results stand in the body above.
12. Open for the Findings fixer: correction 15 is a correction, not a numbered assumption. Dennis's "defaults" answer covers the codedHarvestDate fork only if Findings carries that default. The default stated here is that MA1 does not move it.
13. FIXED (cross-check): the sources line no longer says every cited file matches on the MA1 worktree. Re-hashed at 19:43: all 13 files match on main and GFLiteOpsDashboard; on W, config.ts is f1735c2404bd9dd7 (90,101 bytes, mtime 19:26:35) against f74745f4f7524f65 (82,570), and the other twelve still match. W's config.ts shifts metrcQuantity to :868, parseMetrcReleaseStates to :969 and metrcLocationName to :1387 (main :712, :813, :1231, re-grepped), so config.ts:706-715, :813-825 and :1231-1235 hold on main and GFLiteOpsDashboard only. The line now says so, points to Findings Conventions, and note 8 is narrowed to match. metrc.ts is unchanged on W, so note 2's header lines still hold there.
14. FIXED (cross-check): the /plants/v2/inactive row pointed to "Findings, beside F-D", a place Findings does not have. The lag and the 4,320-call alternative sit in Findings 6.6 under "F-D gone lag" (findings.md:673-676), which is how the endpoint map cites it; the pointer now reads "(Findings 6.6, F-D gone lag)".
