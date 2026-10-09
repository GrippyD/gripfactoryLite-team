> Appendix A of SESSION_REPORTS/2026-10-08_ma1_metrc_api_read_integration.md (brief MA1, Phase A, build session 2026-10-08). Code citations (file:line) hold on main app/ and branches/GFLiteOpsDashboard/app at the cut (tree 3f067013cbb9f39e); the MA1 worktree has moved since. Docs citations name files of the 2026-10-08 fetch of https://api-mi.metrc.com/Documentation/ (metrcdocs/endpoints/<VERB_path>.txt and page_*.txt, a scratch copy; see section 8 of the report for where to keep it). No em or en dash; curly apostrophes from quoted docs text were normalized to plain ones.

## Phase A endpoint map (brief section 7)

**How to read the citations**
- Docs paths are relative to the scratchpad copy `metrcdocs/`, fetched 2026-10-08 from https://api-mi.metrc.com/Documentation/. Endpoint files are `metrcdocs/endpoints/<VERB_path>.txt`, and `:N` is a line in that file.
  - The copy holds four prose pages: `page_getting-started.txt`, `page_best-practices.txt`, `page_whats-new-in-v2.txt` and `page_helpful-resources.txt`.
  - `page_helpful-resources.txt` (and its .html) is byte-identical to the getting-started page. The server answers the Helpful Resources link with `302`, `location: /Documentation/getting-started` (run 2026-10-08, headers saved in `wf/critic/dl/h.txt`). No separate Helpful Resources page is served.
- Code line numbers are on main `app/` (M) and `branches/GFLiteOpsDashboard/app` (B), where every cited file is byte-identical (sha256 prefixes: src/metrcapi.ts e2ad026ecad07ac9, src/metrc.ts bc4a4ca51f4b9530, src/mint.ts 9a2e94e5f8ac26a8, src/labeldata.ts b7a0f2edba5379a4, test/metrcapi.test.ts aede7c67ced5b53a).
  - The MA1 worktree `branches/GFLiteMetrcAPI/app` (W, created 2026-10-08 18:10:45) matched them at the cut. A session has been writing in it since about 19:13 (Findings Conventions), so W's line numbers differ.
  - wrangler.toml is edc3570cca51b401 (LF) in both branches. Main's copy carries CR bytes and hashes the same once they are stripped, so its line numbers hold.
- Workbook citations refer to `RESEARCH/metrc_connect/Generic_Evaluation_for_All_States_MASTER_10.2025.xlsx`. The file name on disk uses underscores where the brief uses spaces.
  - A step is cited by its step-label cell and its path cell, in the form `Locations A13 (path A15)`: A13 holds "Step 3" and A15 holds the path. The paste anchor is the B cell of the label's row (B13; eval section 2 Anchors lines). This is the eval section's style.
  - Any other cell is cited by tab and cell, e.g. `Locations C1` or `Permissions B45`.
- `RESEARCH/...` and `canon/...` paths are relative to the project root. The RESEARCH notes are second-hand research. They are not the docs.
- Snapshot figures come from `db_backups/20261008-135926_post_dedupe`, which was only read.
  - The newer `db_backups/20261008-184520_pre_r5` holds byte-identical `metrc_plants`, `metrc_packages` and `metrc_mounts` tables (sha256 prefixes ff941812bbfbd3b6, a8da4616663b26de, 3baf21c3a8d8d679). Every mirror figure below holds in both: 48,168 live plants, 13,045 live packages.
  - Only `metrc_sweeps` differs: 392 rows against 387, all "skipped" with "The integrator key is absent. The user key is absent." `metrc_api_calls` has 0 rows in both.
- Probes are numbered P1 to P14 (the list at the end). P0 is the facilities call, `GET /facilities/v2/`. In the body they read "probe P3" and so on, to keep them apart from the eval section's Plants steps P1 to P6.
- A-numbers are the Findings section's assumptions (A1 to A34).

**Marks** (brief section 7 has three: needed by the mirror, needed by the evaluation only, not used)
- **MIRROR**: needed by the mirror.
  - **MIRROR (full-pass seen set only)**: read only during a complete full pass of its kind. Its tags (for harvests, its Ids) count as seen, so the pass does not mark them gone (A10). It is not an hourly read.
- **EVAL**: needed by the evaluation only.
  - E1 is a GET step the workbook names.
  - E2 is a write step, or a read that verifies one.
  - **E1 support** is a read the runner makes to find an existing Id for an E1 by-id step.
  - **E2 support** is a read the runner makes to fill a verification column (ID Number, Last Modified Date) after a write step, or to supply an input a write step needs (eval section 2, Prerequisites column).
  - **runner check** is a read the runner makes for its own safety or to report what inventory the sandbox holds (eval section 5).
  - E1 support, E2 support and runner check are not workbook steps. Law 8's derived step list must hold only steps the workbook names.
- **NOT USED**: not needed by either.
  - **NOT USED (candidate gone evidence, A12)**: a list that could become positive evidence of gone only through a MIRROR LAW change by the Scribe.
  - **NOT USED by MA1 (lab sweep, preserved)**: reads the existing lab sweep makes today. Law 5 preserves that sweep "exactly as it is" (ma1_brief.md:41). MA1 adds nothing to them. Do not count them as mirror reads.

**Forks and scope applied**
- F-D at its default: plants are read incrementally every hour, with a weekly full reconcile spread across ticks.
  - **The lag under F-D.** A harvested plant leaves /flowering, so it stays live in the mirror until the weekly full pass completes. That is up to the 7-day cadence plus the pass's own length (58 ticks at live counts, 110 at drop totals, at the default budget of 60; Findings 6.6). It is longer under the month pace, where the pass alone stretches to about 11.8 days at drop totals (Findings section 3). The docs' inactive example shows such a plant: State "Harvested" (GET_plants_v2_inactive.txt:39).
  - Today's CSV door marks plants gone every 1 to 5 days. The snapshot's plants drops fall on 09-20, 22, 24, 29, 10-01, 02, 05, 06 and 08, each marking 1,999 to 14,888 plants gone.
  - The documented alternative is reading /plants/v2/inactive hourly as gone evidence: about 4,320 calls a month (6 grow licenses by 720 ticks, Findings 6.6). It is a MIRROR LAW change for the Scribe, not a build default (A12).
- F-E at its default: harvests are persisted in `metrc_harvests`.
- Transfers and manifests are parked for the mirror (brief section 5), so they can only be EVAL or NOT USED.
- Licenses. `lookup_values` holds 7 active licenses (and 3 deleted rows).
  - The 6 grow licenses sweep plants and harvests: AU-G-C-000832, AU-G-C-001397, AU-G-C-001509, GR-C-001132, GR-C-001405 and GR-C-002600. The sweep is gated per license by `CanGrowPlants` (GET_facilities_v2.txt:42) from P0. The snapshot's plant rows sit on exactly these six.
  - The processor AU-P-000694 sweeps packages only.
  - So plants have 12 scopes (6 licenses by 2 phases), harvests 6 licenses, and packages 7 scopes.

**The workbook contradicts itself on a GET-only evaluation (F-A). This is a question for Metrc's reply, not a settled reading.**
- **For walking every tab:** "Request a GET only Evaluation - You will be required to complete all sections of all tabs" (Permissions A45:B45). The Scribe's reading in the brief's F-A note follows this cell.
- **Against it:** each write tab's own header limits that tab to write access. Locations C1 reads "This section is required if you have requested POST/PUT/DELETE access for locations." The same wording sits on:
  - Strains C1, Items C1, Closed Loop States PlantBatches C1 and PlantBatches C1;
  - Plants B1, Harvest C1, Packages C1 and LabResults C1.
- **Other headers:**
  - Only GET Transfers and Wholesale C1 asks for GET access.
  - Transfer Templates C1 and Transfer External Incoming C1 ask for "GET\POST\PUT|DELETE access for Transfers".
- This is reading (c) in the eval section's F-A analysis and its Q1. The merged email to Metrc is in Findings section 9.
- **E1 GET steps for Grow plus Processor** (dependencies at Permissions A37:B37 and A39:B39):
  - 3 by-id reads: Locations A13 (path A15) (Grow only), Strains A13 (path A15) and Items A13 (path A15).
  - 6 steps on GET Transfers and Wholesale: A5 (path A7), A9 (path A11), A13 (path A15), A17 (path A19), A21 (path A23) and A25 (path A27).
  - 3 optional reads that follow POST steps: Transfer Templates A13 (path A15) and A17 (path A19), and Transfer External Incoming A13 (path A15). They are optional per Permissions E32 and F32 "O".
  - Under the per-tab headers, the 3 by-id reads fall away with their tabs' write-access headers. What remains is the 6 steps on GET Transfers and Wholesale and the 3 reads on the two transfer tabs.
- **Tabs with zero GET steps:** Plants, PlantBatches, Closed Loop States PlantBatches, Harvest and Packages. A GET-only run produces nothing for them.
- **The by-id reads depend on writes.** They view the record "Created and Updated in Step 1 & 2" (Locations A14), which exists only after writes.

### Facts common to every paged v2 list (cited once, referred to as C1 to C8)

- **C1, paging parameters and cap.** The parameters are `pageNumber` and `pageSize`, both marked optional. The cap: "You can enable pagination on this query by specifying a value that does not exceed 50."
  - Source: GET_plants_v2_vegetative.txt:20. The same sentence sits at :20 in every list below, with these exceptions: :22 for transfers incoming and outgoing, :19 for delivery packages and :25 for lab results.
  - First occurrence in the full reference: PrintableList.txt:1455.
- **C2, the default when pageSize is absent: UNRESOLVED.** The docs contradict each other.
  - Endpoint files: "Pagination is currently disabled by default." (same lines as C1).
  - Prose: "The number of records to return per page. Default is 20." (page_whats-new-in-v2.txt:685, PrintableList.txt:1019).
  - pageNumber "Defaults to 1." (page_whats-new-in-v2.txt:683).
  - Build rule: always send pageSize=50 (A3).
- **C3, limits on page count, rows, or pageSize above 50: UNRESOLVED.**
  - No limit on page count or total rows is documented anywhere in the copy.
  - The docs do not say whether a pageSize of 51 is rejected or clamped.
- **C4, the response envelope.**
  - Keys: `Data, Total, TotalRecords, PageSize, RecordsOnPage, Page, CurrentPage, TotalPages` (GET_plants_v2_vegetative.txt:35, :119-125).
  - "the TotalPages attribute identifies the total number of pages" (page_whats-new-in-v2.txt:698).
  - The client should stop on `Page >= TotalPages`, not on a short page.
- **C5, the lastModified window.**
  - Each file marks `lastModifiedStart` and `lastModifiedEnd` optional, separately (e.g. GET_plants_v2_vegetative.txt:22-26).
  - **No maximum window is stated anywhere: UNRESOLVED.**
  - **Local signals that the filter may be required in practice:**
    - "Due to the existing Last Modified filter requirement, a single call cannot be made to request a large amount of data." (page_best-practices.txt:35)
    - The next sentence on the same line: "This restriction is enforced using a date range filter applied to the date and time of last modification." (:35)
    - The workbook: "The Parameters required for Step 1 and Step 2 are lastModifiedStart and lastModifiedEnd" (GET Transfers and Wholesale A38:A39). That note covers the incoming and outgoing lists, whose files mark both bounds optional (GET_transfers_v2_incoming.txt:24-28).
    - "A date parameter WILL be needed for these calls." (Closed Loop Environment B19). Which calls it means is unclear, because that tab lists POST routes (B8:B13).
  - **Illustrative evidence for a start-only filter (not proof).**
    - page_getting-started.txt:117 describes a call that returns the active packages of license 123-ABC "that have been modified since" a given time.
    - :123 shows it: `GET /packages/v2/active?licenseNumber=123-ABC&lastModifiedStart=2023-11-01T08:00:00%2B02:00`. It sends lastModifiedStart alone, with no lastModifiedEnd and no pageSize.
    - It matches :133's catch-up advice: "simply requesting the last run time plus 5 minutes should cover all changes".
    - If Metrc accepts that shape, a start-only catch-up needs no maximum window. The example exists to show the %2B rule, so it does not settle probe P3.
  - Recommended cadence: "requests all changes made within the last 1-hour and 5-minutes" (page_getting-started.txt:133).
  - Order: "start with older Last Modified date/times and move to more recent ones" (page_best-practices.txt:37).
  - Encode `+` as %2B (page_getting-started.txt:115-123).
  - **UNRESOLVED:** whether a v2 list call with no lastModified filter is accepted, and whether one bound alone is accepted (start-only is illustrated above, not confirmed). Every full reconcile below depends on this (probe P3).
- **C6, license selection and rate limits.**
  - **Which endpoints take a license.** Every facility-scoped list in rows 1 to 11 and row 13 takes `licenseNumber` as a query parameter, with no "optional" marker (e.g. GET_packages_v2_active.txt:11-12).
    - These take no license: row 12 (GET_transfers_v2_deliveries_id_packages.txt:13-19), GET /transfers/v2/{id}/deliveries, /labtests/v2/batches, /labtests/v2/types and /labtests/v2/states.
    - "Required" is an inference. The docs print only the word "optional", and a parameter without it is read as required.
  - **The value to send.**
    - The parameter text is "The License Number of the Facility..." (GET_packages_v2_active.txt:12).
    - The facility object holds `"Number": "403-X0001"` under `License` (GET_facilities_v2.txt:138-139).
    - That `licenseNumber` equals `License.Number` is an inference. Probe P14 confirms it: a list call per license that sends License.Number and gets a 200.
    - That per-license reach is Phase B work (A22, A33). Phase A's Test connection is one `GET /facilities/v2` that reports N facilities (src/metrcapi.ts:603-618, path at :609).
  - **Rate limits.**
    - "Rate limiting is on a per facility basis." Calls without a license are limited "on an individual API key basis" (page_whats-new-in-v2.txt:9).
    - Which key counts for that limit (integrator or user) is not named: UNRESOLVED (probe P12).
    - No rate numbers are published: "The exact rate limits depend on your agreement with Metrc" (page_whats-new-in-v2.txt:11).
  - **429 and Retry-After.**
    - "If you exceed the rate limit, you will receive a 429 status code" (page_whats-new-in-v2.txt:13).
    - "In certain cases, the 429 response will include a "Retry-After" header" (:13), so the header is optional. The same line says it "provides a number of seconds to wait".
    - :9 says the 429 "will be returned with the time window in the header of the message". Which header that is, and its format, is UNRESOLVED. It is a question in the merged email (Findings section 9).
    - The existing client retries a 429 once (src/metrcapi.ts:316, :358-359).
    - What retryAfterMs waits today (src/metrcapi.ts:136-140):
      - A blank or missing header waits **0 ms**. :137 computes `Number(String(header ?? "").trim())`, and `Number("")` is 0, which is finite and not below 0 (:138), so :139 returns 0. That is a bug (A9): the comment at :135 says a blank header waits one second. No test covers a blank header.
      - An HTTP-date or other text waits 1 s (:138; test/metrcapi.test.ts:50).
      - A number waits that many seconds, capped at 10 s (:139, RETRY_CAP_MS at :33; test/metrcapi.test.ts:49).
    - Law 5's ceiling applies.
- **C7, stay on v2.**
  - Docs: no v1 file carries pageNumber or pageSize, and v1 lists return bare arrays (e.g. GET_plants_v1_vegetative.txt).
  - Research, not docs: "v1 sunset for integrators April 1, 2025 (MI_IB_0094): build v2 only." (RESEARCH/2026-09-21_metrc_api_lab_testing.md:45). The docs copy itself states no v1 deprecation (0 hits for "sunset" or "deprecat").
- **C8, page order and stability: UNRESOLVED.**
  - The docs never state the sort order of a paged list, or whether a page sequence stays consistent while rows change between calls.
  - pageNumber is described only as "The number of the data page from which to return data." (GET_packages_v2_active.txt:14-16). The prose pages hold no ordering text.
  - Risk: a reconcile spread across ticks (F-D) can skip or repeat rows if the order shifts.
  - Build rule: mark rows gone only after a full pass that finished cleanly (probe P8).

### Compact map

| # | Endpoint (v2) | License param | Paging | lastModified | Mark | Target |
|---|---|---|---|---|---|---|
| 1 | GET /plants/v2/vegetative | licenseNumber, no optional marker (C6) | C1 to C3 (:20), C8 | yes, both optional; no window cap documented (C5) | **MIRROR** | `metrc_plants`, phase vegetative, on the 6 grow licenses. Hourly incremental, weekly full (F-D) |
| 2 | GET /plants/v2/flowering | licenseNumber | C1 to C3 (:20), C8 | yes (C5) | **MIRROR** | `metrc_plants`, phase flowering, on the 6 grow licenses. Same cadence |
| 3 | GET /harvests/v2/active | licenseNumber | C1 to C3 (:20) | yes (C5) | **MIRROR** | `metrc_harvests` (new, 0097, F-E), on the 6 grow licenses. Hourly incremental, daily full |
| 4 | GET /harvests/v2/inactive | licenseNumber | C1 to C3 (:20) | yes (C5) | **MIRROR** | `metrc_harvests`. Finished in the last 30 days, filtered on our side by FinishedDate, falling back to ArchivedDate when FinishedDate is null (A19; probe P9) |
| 5 | GET /packages/v2/active | licenseNumber | C1 to C3 (:20), C8 | yes (C5) | **MIRROR** | `metrc_packages`, on all 7 licenses. Hourly incremental; the daily full pass marks gone |
| 6 | GET /packages/v2/inactive | licenseNumber | C1 to C3 (:20) | yes (C5) | **NOT USED** (candidate gone evidence, A12) | Read by neither the mirror nor the evaluation. As gone evidence it would be partial only, since it misses outgoing transfers (Detail 5 and 6) |
| 7 | GET /locations/v2/active | licenseNumber | C1 to C3 (:20) | accepted (:22-26), but rows carry no LastModified | **EVAL (E1 support)** | Supplies an existing Id for Locations A13 (path A15) `GET /locations/v2/{id}`. Not a workbook step |
| 8 | GET /items/v2/active | licenseNumber | C1 to C3 (:20) | accepted, but rows carry no LastModified | **EVAL (E1 support)** | Supplies an existing Id for Items A13 (path A15). Not a workbook step |
| 9 | GET /strains/v2/active | licenseNumber | C1 to C3 (:20) | accepted, but rows carry no LastModified | **EVAL (E1 support)** | Supplies an existing Id for Strains A13 (path A15). Not a workbook step |
| 10 | GET /transfers/v2/incoming | licenseNumber | C1 to C3 (:22) | yes; the workbook calls both bounds required (GET Transfers and Wholesale A38:A39) | **EVAL (E1)** | GET Transfers and Wholesale A5 (path A7); Transfer External Incoming A13 (path A15) |
| 11 | GET /transfers/v2/outgoing | licenseNumber | C1 to C3 (:22) | same as row 10 | **EVAL (E1)** | GET Transfers and Wholesale A9 (path A11) |
| 12 | GET /transfers/v2/deliveries/{id}/packages | **none**; rate-limited per key (C6) | C1 to C3 (:13-19) | **no** | **EVAL (E1)** | GET Transfers and Wholesale A21 (path A23) (the workbook misspells the path) |
| 13 | GET /labtests/v2/results | licenseNumber plus `packageId`; neither has an optional marker, so both are required by inference (C6) | C1 to C3 (:19-25) | **no** | **NOT USED by MA1 (lab sweep, preserved)** | `test_samples` columns. Kept byte-identical; MA1 adds nothing |

**Full-reconcile arithmetic at P = 50 (C1).** This counts page calls only, and assumes an unfiltered call is allowed (C5).
- **Brief figures:** 97,936 / 50 = 1,959 plants calls; 11,742 / 50 = 235 packages calls.
  - Both are the 2026-09-14 drop totals (CANON.md:415, _NOW.md:14). The 11,742 is that drop of AU-G-C-000832's active packages.
  - Taken per scope, the drop costs 1,965 plants calls. The per-pair ceilings are 963, 689, 200, 40, 33, 30 and 5, which sum to 1,960 on 7 populated pairs, plus 1 call for each of the 5 empty pairs of the 12. Packages cost 241: 235 on AU-G-C-000832 plus 1 call for each of the 6 empty license scopes.
  - The snapshot still holds 97,936 plant rows, gone ones included, but only 48,168 are live.
  - The snapshot holds 14,488 packages rows, 13,045 of them live: AU-G-C-000832 11,844 and AU-P-000694 1,201.
- **Live figures in the 2026-10-08 snapshot, summed per license and phase scope:**

| | Live rows | Calls at P = 50 | Calls at P = 20 | Largest scope |
|---|---|---|---|---|
| Plants | 48,168 | 965 | 2,410 | GR-C-001132 flowering, 599 calls |
| Packages | 13,045 | 262 | 654 | AU-G-C-000832, 237 calls |

- **Rounding.** The ceiling is taken per scope. A single ceiling over each live total gives 964, 2,409, 261 and 653.
- **Floor for empty scopes.** Every license costs at least one call per endpoint scope, even when the scope is empty.
  - `lookup_values` holds 7 active license rows. All 7 pass facilityLicense (src/metrcapi.ts:119-124), and the lab sweep reads them at :512-515.
  - Plants: 12 scopes (6 grow licenses by 2 phases), 4 of them populated, so the floor adds 8 calls: **973 at P = 50**. The four populated scopes are all on grow licenses.
  - Packages: 7 scopes, 2 of them populated, so the floor adds 5 calls: 267.
  - `CanGrowPlants` (GET_facilities_v2.txt:42) gates the plants and harvests sweeps per license (Forks and scope applied).
- **Hourly incrementals: 31 calls per tick is a floor.** Each scope costs at least one page per tick: plants 12, packages 7, harvests 12 (active and inactive, by 6 grow licenses) (Findings section 3). A bulk move, or a phase change across a room, makes more pages.
- **Onhold reads (A10).** A complete full pass also reads its kind's onhold list, at least one call per license: plants 6 per weekly pass, packages 7 and harvests 6 per daily pass. That is about 420 calls a month (Findings section 3).
- **Harvests: full-pass cost UNRESOLVED.** No harvest row count exists locally.
  - Floor: 12 calls per daily pass (active and inactive, by 6 grow licenses), plus the 6 onhold calls above.
  - The daily inactive pass can be bounded by a lastModifiedStart 30 days back, if the window cap allows it. Otherwise it walks back 30 days in `metrc_window_max_minutes` chunks (Findings 6.1, A11). An unfiltered daily pull, if Metrc allows one, reads the whole inactive history and grows with it (Findings section 3).
  - The 30-day bound is an inference: LastModified changes on any change (page_getting-started.txt:131), so finishing a harvest should move it.
- **If windows are forced (C5).** If a full pass must walk lastModified windows of width W, and W is UNRESOLVED, the pass costs at least one call per window per license per endpoint. The walk must reach back to the oldest live record, whatever the row count.
  - The snapshot's oldest live plant batch date is 2026-05-18, 143 days back.
  - Its oldest live packaged date is 2025-07-07, 458 days back.
  - At a 24 h window, that is at least 143 calls per plants scope and 458 per packages scope, before any paging.

**The current client would truncate a full pull.** It sends `pageSize=20` for at most 20 pages (src/metrcapi.ts:27-28, :404-410), so it stops silently at 400 rows.

### Detail 1 and 2: GET /plants/v2/vegetative and GET /plants/v2/flowering (MIRROR)

- **Source:** endpoints/GET_plants_v2_vegetative.txt. Params are at :11-26, the example request at :30 and the first row at :37-75.
  - GET_plants_v2_flowering.txt has the same fields at the same line numbers.
  - Only the example values differ: Id and Label (:37-38), GrowthPhase "Flowering" (:40), PlantBatchId (:43), PlantBatchTypeId and PlantBatchTypeName "Clone" (:45-46), and FloweringDate (:66). The second example row differs the same way.
- **Permission:** View Veg/Flower Plants (:7).
- **v1:** /plants/v1/vegetative and /plants/v1/flowering take licenseNumber plus lastModifiedStart and lastModifiedEnd. They have no paging and return bare arrays.
- **Reconcile scope:** license plus phase (THE MIRROR LAW), on the 6 grow licenses.
  - A plant that moves from vegetative to flowering shows up in the flowering window and is updated in place, because diffMount treats a phase change as a move (src/metrc.ts:668).
  - LastModified changes on any change to a record (page_getting-started.txt:131).
  - A harvested plant leaves both lists and stays live until the weekly full pass (the F-D lag, Forks and scope applied).

Fields that map to export columns (`metrc_plants`). The Mapping section's Table 1 is the Law 2 table; this one agrees with it.

| Export column | Mirror column | API field | Status |
|---|---|---|---|
| Tag | tag | Label (:38) | direct; upper-cased as shapePlantRow does (src/metrc.ts:503) |
| Strain | strain | StrainName (:48) | direct |
| Location | location | LocationName (:50) | direct |
| Sublocation | sublocation | SublocationName (:53) | direct |
| Hold | hold | IsOnHold (:60) | candidate. UNRESOLVED whether the export also folds in IsOnInvestigationHold (:62). 0 on all 97,936 snapshot rows, so production cannot settle it; it needs a sandbox fixture or a Metrc answer |
| Plant Batch | plant_batch | PlantBatchName (:44) | direct |
| Plant Batch Type | plant_batch_type | PlantBatchTypeName (:46) | direct. The examples show Seed (vegetative :46) and Clone (flowering :46); the snapshot holds Seed 81,618 and Clone 16,318 |
| Plant Batch Date | plant_batch_date | PlantedDate (:64) | UNRESOLVED, two candidates: the plant's PlantedDate (:64), or the batch's PlantedDate from /plantbatches/v2/active and /inactive (GET_plantbatches_v2_active.txt:60) joined on PlantBatchId (Mapping Table 1 row 8). The plant row has no batch-date field of its own. Populated dates on all 97,936 snapshot rows, so the first production dry-run parity report settles it |
| Phase Date | phase_date | VegetativeDate (:65) on vegetative; FloweringDate (flowering :66) | derived: picked by endpoint (Mapping Table 1 row 9). Populated on all 97,936 snapshot rows, so the parity report confirms it |
| Harvested | harvested | none. Candidates: HarvestedDate (:67) or HarvestId (:55), never HarvestCount (:59) | **no API equivalent**, would be derived; UNRESOLVED. HarvestCount is 0 on the harvested plant in the inactive example (GET_plants_v2_inactive.txt:39 "Harvested", :59 0), so "HarvestCount > 0" would read it as not harvested. On these two lists the example has HarvestId and HarvestedDate null (:55, :67); non-null values appear only on /plants/v2/inactive (:55, :67). 0 on all 97,936 snapshot rows, so TRANSLATION_MAP row 1's plant-level proof (canon/TRANSLATION_MAP.md:15) moves to `metrc_harvests` (Mapping Table 1). It needs a sandbox fixture or a Metrc answer |
| (phase) | phase | the endpoint path; GrowthPhase (:40) as a cross-check | |
| (license) | license_value | the licenseNumber sent | |

**Fields with no export equivalent:**
- Ids and tag limits: Id (:37), GroupTagTypeMax and TagTypeMax (:41-42), PlantBatchId (:43), PlantBatchTypeId (:45), StrainId (:47), LocationId (:49), SublocationId (:52).
- State (:39), and GrowthPhase (:40), which is folded into phase.
- LocationTypeName (:51), PatientLicenseNumber (:54).
- HarvestId (:55), also a Harvested candidate above. It links a plant to its harvest (TRANSLATION_MAP gap 2) and is worth keeping in view.
- HarvestedUnitOfWeightName, HarvestedUnitOfWeightAbbreviation and HarvestedWetWeight (:56-58).
- HarvestCount (:59). It is not a Harvested candidate (see the table).
- IsOnInvestigation, IsOnInvestigationHold and IsOnInvestigationRecall (:61-63). IsOnInvestigationHold is the open Hold candidate.
- DestroyedDate and DestroyedNote (:68-69). DestroyedByUserName (:70) is a person's name and should never be stored.
- MotherPlantDate (:71); ClonedCount, SurvivedCount and DescendedCount (:72-74).
- LastModified (:75), used by the cursor only.

**Placeholder timestamps in the examples.** The example LastModified is "0001-01-01T00:00:00+00:00" (:75). The high-water mark should come from the request window, not from row values, until the sandbox shows real ones.

### Detail 3 and 4: GET /harvests/v2/active and GET /harvests/v2/inactive (MIRROR, F-E)

- **Source:** endpoints/GET_harvests_v2_active.txt, params :11-26, first row :37-66.
  - The inactive file has the same shape. Its first example row has FinishedDate "2015-01-10" (GET_harvests_v2_inactive.txt:64).
  - Its second row has `"FinishedDate": null` (:96) and `"ArchivedDate": "2015-02-01"` (:97).
- **Permission:** View Harvests (:7).
- **v1:** /harvests/v1/active and /harvests/v1/inactive take licenseNumber and the lastModified pair. No paging, bare arrays.
- **Licenses:** the 6 grow licenses, gated by CanGrowPlants from P0.
- **No export exists.** The targets below are the Law 6 columns proposed for migration 0097. The Mapping section's Table 3 is the full table.
- **Why this leg carries the dates.** Canon 0.30.390 (CANON.md:748): METRC "keeps no harvest date on a package (a harvest carries its dates". So a harvest's real date comes from this leg, not from the package rows.

| Law 6 column | API field | Status |
|---|---|---|
| harvest id | Id (:37) | direct; the key |
| name (HBN) | Name (:38) | direct. Match it without case: "When using the name to reference an object, the comparison is case-insensitive." (page_getting-started.txt:127). It joins to `metrc_packages.source_harvests`. Decoder placement is open work; see the note below the table |
| license | the licenseNumber sent | |
| dates | HarvestStartDate (:63), FinishedDate (:64), ArchivedDate (:65) | direct, date-only strings. Under gap 2, HarvestStartDate is the likely source of a harvest's real date (an inference about which field) |
| wet weight | TotalWetWeight (:52), with its unit in UnitOfWeightName (:56, example "Ounces") | direct |
| current location | DryingLocationName (:44), DryingSublocationName (:46) | direct |
| state | **no State field** | DERIVED: the list the harvest was last seen in, one of active, onhold or inactive (A19, Mapping Table 3). IsOnHold (:59) sits on the row but is not the source |
| plant count | PlantCount (:51) | direct |
| changed / first seen / gone | LastModified (:66) feeds the cursor; the rest are set on the mirror side | gone follows the harvest gone rule below |

**Decoder placement for the harvest name (open work).**
- Today two functions decode the harvest-name date: parseHbn (src/mint.ts:92) and codedHarvestDate (src/labeldata.ts:308).
- codedHarvestDate sits outside the METRC layer. TRANSLATION_MAP row 13 reads "GAP 4: the harvest name decoder sits in `labeldata.ts`" (canon/TRANSLATION_MAP.md:27). Gap 4 is "DECODERS BELONG TO THE METRC LAYER" (:37). The map does not say which layer mint.ts belongs to.
- Law 2 and Law 6 keep decoders in the METRC layer. So the harvests leg can either move codedHarvestDate into the METRC layer or reach it only through that layer. The default for Dennis's word is Findings correction 15 (Mapping, decoder fork): MA1 does not move it. HarvestStartDate becomes the date source and codedHarvestDate the fallback, and the move is gap 4 work.
- Gap 2 adds: "it is also where a harvest's real date comes from, so the name decoder of gap 4 becomes the fallback, not the source." (:35)

**Fields with no Law 6 column:**
- HarvestType (:39), SourceStrainCount (:40).
- Strains[] (:42); its element shape is undocumented.
- DryingLocationId (:43), DryingSublocationId (:45), DryingLocationTypeName (:47), PatientLicenseNumber (:48).
- TotalRestoredWeight (:53).
- LabTestingState and LabTestingStateDate (:57-58).
- The IsOnInvestigation flags (:60-62).
- Candidates for the Scribe to add: CurrentWeight (:49), TotalWasteWeight (:50), PackageCount (:54), TotalPackagedWeight (:55), SourceStrainNames (:41).

**The 30-day window is applied on our side.**
- The inactive list's only server filters are licenseNumber, the paging pair and the lastModified pair (:11-26).
- So "finished in the last 30 days" means an inactive row whose FinishedDate is within 30 days, falling back to ArchivedDate when FinishedDate is null (A19). The example's second row (:96-97) shows an inactive harvest with no FinishedDate, which a FinishedDate-only filter would drop.
- The build default includes an archived but unfinished harvest through that fallback. What ArchivedDate means is still undocumented: UNRESOLVED (probe P9).
- **UNRESOLVED:** the cost of the first inactive load (all history).

**The harvest gone rule (stated in Mapping Table 3; A19).**
- gone_at is set only when a complete active pass misses a harvest and no inactive or onhold read has seen it since the pass began.
- A move from active to inactive is a state change, and aging past 30 days is a view filter. Neither is gone.
- The onhold list feeds this rule as a full-pass read (EXTRAS, /harvests/v2/onhold).

### Detail 5 and 6: GET /packages/v2/active (MIRROR) and GET /packages/v2/inactive (NOT USED, candidate gone evidence)

- **Source:** endpoints/GET_packages_v2_active.txt, params :11-26, first row :37-197. The inactive file has the same shape (IsFinished true at :108, FinishedDate at :109).
- **Permission:** View Packages (:7).
- **Licenses:** all 7, the processor AU-P-000694 included.
- **Meaning of each list:**
  - Active: "Packages can only leave a Facility's active inventory via Finishing, Discontinuing, and Outgoing Transfers." (page_best-practices.txt:9).
  - Inactive: "Packages can only reach this status by being Finished or Discontinued." (page_best-practices.txt:15).
- **v1:** /packages/v1/active and /packages/v1/inactive take licenseNumber and the lastModified pair. No paging, bare arrays.

**The two marks**
- **Active (MIRROR):** the hourly incremental pass never marks rows gone; the daily full pass does (Law 5). That pass also reads /packages/v2/onhold into its seen set (A10).
- **Inactive (NOT USED, candidate gone evidence, A12):**
  - No workbook GET step names it. Packages A17 (path A19) finishes a package, but the eval reads that package back with `GET /packages/v2/{label}` (eval section 2.7), not with this list.
  - **Inactive is incomplete evidence of gone.** It misses packages that leave by outgoing transfer. The docs trace those through /transfers/{version}/outgoing, then {id}/deliveries, then deliveries/{id}/packages, with one call per object (page_best-practices.txt:17-29).
  - Some exits cannot be tracked at all: "there is no way for the API to track those" (page_best-practices.txt:31).
  - So the daily full pass stays mandatory. Gone stays absence-only (A12). Reading inactive hourly as positive evidence of gone is a MIRROR LAW change for the Scribe, at about 5,040 calls a month (Findings 6.6). Any such change must also weigh GET /packages/v2/transferred (EXTRAS) or the outgoing chain.
  - Without that change, finished packages stay live in the mirror until the next daily full pass.

Fields that map to export columns (`metrc_packages`). Line numbers are in GET_packages_v2_active.txt. The Mapping section's Table 2 is the Law 2 table; this one agrees with it.

| Export column | Mirror column | API field | Status |
|---|---|---|---|
| Tag | tag | Label (:38) | direct |
| Source Harvest(s) | source_harvests | SourceHarvestNames (:44) | direct. The separator is UNRESOLVED (null in the example); the mirror holds lists joined with ", " (12,384 of 14,488 snapshot rows contain a comma) |
| Source Package(s) | source_packages | SourcePackageLabels (:45) | same separator question |
| Original Source Package Label | original_source_label | ProductLabel.OriginalSourcePackageLabel (:192) | nested; the pairing is UNRESOLVED. It is a name match only, and the example value is null |
| Source Processing Job(s) | source_processing_jobs | none; only SourceProcessingJobCount (:43) | **no API equivalent**. Null on all 14,488 snapshot rows, so nothing is lost today |
| Location | location | LocationName (:47) | direct |
| Sublocation | sublocation | SublocationName (:49) | direct |
| Item | item | Item.Name (:117) | nested |
| Category | category | Item.ProductCategoryName (:120) | nested |
| Item Strain | item_strain | Item.StrainName (:134) | nested |
| Quantity | quantity | Quantity (:51) | number |
| Unit Of Measure | uom | UnitOfMeasureAbbreviation (:59) | direct, the abbreviation. The docs pair "Grams" with "g" and "Each" with "ea" (GET_unitsofmeasure_v2_active.txt:22-23, :37-38); the snapshot holds only ea (12,901) and g (1,587). UnitOfMeasureName (:58) is not used: it would make every one of the 14,488 rows differ under `same()` (Mapping section, units flag) |
| Production Batch Number | production_batch | ProductionBatchNumber (:77) | direct |
| Source Production Batch | source_production_batch | SourceProductionBatchNumbers (:78) | the API name is plural |
| Lab Test Status | lab_test_status | LabTestingState (:69) | direct. The snapshot's 8 values all appear in GET /labtests/v2/states (GET_labtests_v2_states.txt:20-27; EXTRAS) |
| Finished Goods | finished_goods | IsFinishedGood (:110) | boolean. 0 on all 14,488 snapshot rows: unprovable from production today |
| Administrative Hold | admin_hold | IsOnHold (:100), IsOnHoldCombined (:101) or IsOnInvestigationHold (:103) | UNRESOLVED, three candidates; 0 on all snapshot rows |
| Administrative Recall | admin_recall | IsOnRecall (:105, null in the example), IsOnRecallCombined (:106) or IsOnInvestigationRecall (:104) | UNRESOLVED, three candidates; 0 on all snapshot rows; null must fold to 0, as normalizeMetrcBool does |
| Packaged Date | packaged_date | PackagedDate (:64) | date-only |
| Received | received_date | ReceivedDateTime (:96) | date part; which time zone the date part is in is UNRESOLVED |
| Expiration Date | expiration_date | ExpirationDate (:65) | direct. NULL on all 14,488 snapshot rows: unprovable from production today |
| Lab Test Expiration | lab_test_expiration | LabTestResultExpirationDateTime (:72) | candidate. NULL on all 14,488 snapshot rows: unprovable from production today |
| (license) | license_value | the licenseNumber sent | |

**Fields with no export equivalent:**
- Id (:37). It is the `packageId` for lab results (#13).
- ExternalId (:39), PackageType (:40).
- SourceHarvestCount, SourcePackageCount and SourceProcessingJobCount (:41-43).
- LocationId (:46), SublocationId (:48), LocationTypeName (:50).
- Quantities and units: OriginalPackageQuantity (:52), CreatedQuantity and its unit (:53-54), ReceivedQuantity and its unit (:55-56), QuantityReturnedToSource (:57), UnitOfMeasureName (:58).
- PatientLicenseNumber (:60), ItemFromFacilityLicenseNumber and ItemFromFacilityName (:61-62), Note (:63).
- SellByDate and UseByDate (:66-67).
- Lab state fields:
  - InitialLabTestingState (:68).
  - LabTestingStateDate (:70). The lab sweep already reads it into `test_samples.metrc_state_date` (src/metrcapi.ts:218).
  - LabTestingPerformedDate (:71), LabTestingRecordedDate (:73), LabTestStageId and LabTestStage (:74-75).
- IsProductionBatch (:76).
- The trade sample, donation, testing sample and process validation flags (:79-87).
- The remediation, decontamination and pre-treatment fields (:88-95).
- ReceivedFromManifestNumber, ReceivedFromFacilityLicenseNumber and ReceivedFromFacilityName (:97-99).
- The IsOnInvestigation flags (:102-104). IsOnInvestigationHold (:103) and IsOnInvestigationRecall (:104) are open candidates above.
- ArchivedDate (:107), IsFinished and FinishedDate (:108-109), IsOnRetailerDelivery (:111), PackageForProductDestruction (:112), LabelsLastGeneratedDateTime (:113).
- LastModified (:114, a real 7-digit fraction in the example), used by the cursor.
- Every Item field except Name, ProductCategoryName and StrainName (:116-186), and every ProductLabel field except OriginalSourcePackageLabel (:189-196).

**The existing lab sweep's packages read is not reusable.** It already reads this endpoint hourly (src/metrcapi.ts:525) through the 400-row cap, so the mirror must run its own paged read.

### Detail 7: GET /locations/v2/active (EVAL, E1 support)

- **Source:** endpoints/GET_locations_v2_active.txt, params :11-26, first row :37-44.
- **Permission:** Manage Locations (:7); GET /locations/v2/{id} needs the same (GET_locations_v2_id.txt:7). This is a Manage permission, so whether the user key holds it at each license is UNRESOLVED.
- **Fields:** Id, Name, LocationTypeId, LocationTypeName, ForPlantBatches, ForPlants, ForHarvests, ForPackages. The rows carry no LastModified (0 occurrences in the file), though the filter is accepted.
- **Export columns:** none of its own.
  - Name carries the same text that `metrc_plants.location` and `metrc_packages.location` take from LocationName on each row, so it is a cross-check only.
  - All other fields have no export equivalent.
- **Evaluation:** Locations A13 (path A15) `GET /locations/v2/{id}` (Step 3). In a GET-only run, this list supplies an existing Id (an inference). It is an E1 support read for the eval section's supporting reads (eval section 5), not a workbook step.
- **v1:** /locations/v1/active takes licenseNumber only, with no lastModified and no paging. There is no v1 inactive.

### Detail 8: GET /items/v2/active (EVAL, E1 support)

- **Source:** endpoints/GET_items_v2_active.txt, params :11-26.
- **Permission:** Manage Items (:7); GET /items/v2/{id} needs the same. As with Manage Locations, whether the user key holds it at each license is UNRESOLVED.
- **Fields:** Id (:37), Name (:38), ProductCategoryName (:41), ProductCategoryType (:42), QuantityType (:49), DefaultLabTestingState (:50), UnitOfMeasureName (:51), ApprovalStatus (:52), StrainId (:54), StrainName (:55), ItemBrandName (:57), IsUsed (:102), plus the potency and image fields. There is no row LastModified.
- **Export columns:** none of its own. Each package row already embeds Item.Name, ProductCategoryName and StrainName, which become `item`, `category` and `item_strain` (GET_packages_v2_active.txt:115-186).
- **Evaluation:** Items A13 (path A15) writes `GET/Items/v2/{id}` with a capital I. The documented path is /items/v2/{id} (_INDEX.txt:40). This list supplies an existing Id for it (E1 support, eval section 5).
- **v1:** /items/v1/active takes licenseNumber only.

### Detail 9: GET /strains/v2/active (EVAL, E1 support)

- **Source:** endpoints/GET_strains_v2_active.txt, params :11-26, row :37-45.
- **Permission:** Manage Strains (:7); GET /strains/v2/{id} needs the same. Whether the user key holds it at each license is UNRESOLVED.
- **Fields:** Id, Name, TestingStatus, ThcLevel, CbdLevel, IndicaPercentage, SativaPercentage, IsUsed, Genetics. There is no row LastModified.
- **Export columns:** none of its own. Name equals the `metrc_plants.strain` text, which comes from StrainName on plant rows.
- **Evaluation:** Strains A13 (path A15) `GET/strains/v2/{id}`. This list supplies an existing Id for it (E1 support, eval section 5).
- **v1:** /strains/v1/active takes licenseNumber only, with no lastModified. There is no v1 inactive.

### Detail 10 and 11: GET /transfers/v2/incoming and GET /transfers/v2/outgoing (EVAL E1; parked for the mirror)

- **Source:** endpoints/GET_transfers_v2_incoming.txt, params :13-28, example :32. Outgoing has the same params and the same 49-field rows (:39-87).
- **Permission:** Manage Transfers; View Transfers (:7-9). Whether both are required or either one suffices is not stated.
- **The workbook's verification columns** are Result code, License Facility, ID Number, Last Modified Date, Tag Number, Request Sent and JSON (GET Transfers and Wholesale B4:H4). They map as follows:
  - Result code: the HTTP status.
  - License Facility: the licenseNumber sent.
  - ID Number: Id (:39). This is the {id} for /transfers/v2/{id}/deliveries.
  - Last Modified Date: LastModified (:70, a placeholder in the example).
  - Tag Number: none on this row. Use PackageLabel from step 5 (GET_transfers_v2_deliveries_id_packages.txt:31).
  - Also used: ManifestNumber (:40) and DeliveryId (:71).
- **Fields that must never be stored (personal data):** DriverName (:48), DriverOccupationalLicenseNumber and DriverVehicleLicenseNumber (:49-50), the vehicle fields (:51-54), and CreatedByUserName (:69).
- **All other fields at :41-87 have no export equivalent:**
  - InvoiceNumber (:41), ShipmentLicenseType (:42), ShipperFacilityLicenseNumber and ShipperFacilityName (:43-44), Name (:45), TransporterFacilityLicenseNumber and TransporterFacilityName (:46-47).
  - The delivery and package counts (:55-58), the Contains flags (:59-66), IsVoided (:67), CreatedDateTime (:68).
  - RecipientFacilityLicenseNumber and RecipientFacilityName (:72-73), ShipmentTypeName (:74), ShipmentTransactionType (:75).
  - The departure and arrival times (:76-79), DeliveryPackageCount and DeliveryReceivedPackageCount (:80-81), ReceivedDateTime (:82), the return times (:83-86), and OriginatingTemplateId (:87).
- **Mirror:** none. `metrc_packages.received_date` comes from the package row instead.
- **Evaluation:**
  - The workbook's own note: "The Parameters required for Step 1 and Step 2 are lastModifiedStart and lastModifiedEnd" (GET Transfers and Wholesale A38:A39). See C5.
  - The steps are GET Transfers and Wholesale A5 (path A7) and A9 (path A11), and Transfer External Incoming A13 (path A15) (a read after an E2 POST).
- **v1:** /transfers/v1/incoming and /transfers/v1/outgoing take licenseNumber and the lastModified pair. No paging.

### Detail 12: GET /transfers/v2/deliveries/{id}/packages (EVAL E1; parked)

- **Source:** endpoints/GET_transfers_v2_deliveries_id_packages.txt. The {id} "represents a Transfer Delivery Id, not a Manifest Number" (:3). Params are pageNumber and pageSize only (:13-19).
- **No license parameter and no lastModified filter.** So there is one call per delivery, rate-limited per key (C6).
- **Where the ids come from.**
  - The delivery Id comes from GET /transfers/v2/{id}/deliveries (GET Transfers and Wholesale A17 (path A19)). The docs say: "use the Id field from the deliveries objects as the {id} parameter" (page_best-practices.txt:25).
  - The DeliveryId on the incoming or outgoing row (GET_transfers_v2_incoming.txt:71) may also feed this step. That is an inference from the field name.
- **Workbook discrepancy 1: Manifest ID against Transfer Id.**
  - Step 4 (GET Transfers and Wholesale A17 (path A19)) reads "Find a Transfer by the Manifest ID number" (GET Transfers and Wholesale A18).
  - The docs say "The {id} parameter above represents a Transfer Id." (GET_transfers_v2_id_deliveries.txt:3) and "Use the Id field from the returned objects as the {id} parameter" (page_best-practices.txt:21).
  - The runner passes the transfer row's Id (GET_transfers_v2_incoming.txt:39), not ManifestNumber (:40), and records the workbook's wording beside it.
- **Workbook discrepancy 2: the path is misspelled.**
  - GET Transfers and Wholesale A21 (path A23) writes `/transfers/v2/delivery/{id}/packages`, and A25 (path A27) does the same for wholesale.
  - The documented path is `/transfers/v2/deliveries/{id}/packages` (_INDEX.txt:400). "transfers/v2/delivery/" occurs 0 times in PrintableList.txt.
  - The runner calls the documented path and records the workbook's spelling beside it.
- **Fields that look like export columns** (a cross-check only, since transfers are parked):
  - PackageLabel (:31) for tag; SourceHarvestNames (:33); SourcePackageLabels (:34).
  - ItemName (:36) for item; ItemCategoryName (:37) for category; ItemStrainName (:38) for item_strain.
  - LabTestingState (:68), ProductionBatchNumber (:69), PackagedDate (:84), ExpirationDate (:85), ProductLabel.OriginalSourcePackageLabel (:95), SourceProductionBatchNumbers (:101), IsFinishedGood (:103).
- **Fields with no equivalent:** PackageId (:30), PackageType (:32), ShipmentPackageState (:81), ShippedQuantity and ShippedUnitOfMeasureName (:82-83), ReceivedQuantity and ReceivedUnitOfMeasureName (:89-90), the item potency fields and flags, TagId (:106).
- **v1:** /transfers/v1/deliveries/{id}/packages takes no parameters and still carries the obsolete ProductName and ProductCategoryName.

### Detail 13: GET /labtests/v2/results (NOT USED by MA1; lab sweep, preserved)

- **Source:** endpoints/GET_labtests_v2_results.txt.
  - `packageId` and `licenseNumber` are both listed with blank text and no optional marker (:13-17), so both are required by inference (C6).
  - Paging is at :19-25.
- **Permission:** View Packages; Manage Packages Inventory (:7-9). Whether both are required or either one suffices is not stated. GET_labtests_v1_results.txt lists View Packages only.
- **No lastModified filter,** so there is one call per package Id (GET_packages_v2_active.txt:37).
- **Today:** called at src/metrcapi.ts:549.

Fields that map to existing columns (`test_samples`, migration 0068):

| API field | Column | Code |
|---|---|---|
| LabTestResultId (:37) | metrc_result_id | src/metrcapi.ts:248 |
| LabTestResultDocumentFileId (:46) | coa_file_id (the id only; the COA document endpoint is parked) | :255 |
| OverallPassed (:44) | overall_passed | :261 |
| TestTypeName (:50) plus TestResultLevel (:52) | thc_total_pct, through thcFromResults | :185, :267 |

`metrc_lab_testing_state` and `metrc_state_date` are filled from the package rows (src/metrcapi.ts:217-218), not from this endpoint.

**Fields with no equivalent:** PackageId (:36), LabFacilityLicenseNumber and LabFacilityName (:38-39), SourcePackageLabel (:40), ProductName and ProductCategoryName (:41-42), TestPerformedDate (:43), RevokedDate (:45), ResultReleased and ResultReleaseDateTime (:47-48), ExpirationDateTime (:49), TestPassed (:51), TestResultQualifier (:53), TestComment (:54), TestInformationalOnly (:55), LabTestDetailRevokedDate (:56), LabTestBatchName (:57), TestingGroupName (:58).

**Not in the Grow or Processor evaluation.**
- LabResults A5 (path A7) names only POST /labtests/v2/record.
- Labs is a dependency of the Labs facility type (Permissions A41:B41), not of Grow (A37:B37) or Processor (A39:B39).

**v1:** /labtests/v1/results takes packageId and licenseNumber, with no paging.

### EXTRAS

| Endpoint | License | Paging / lastModified | Mark | Why (source) |
|---|---|---|---|---|
| GET /plants/v2/inactive | licenseNumber | C1 (:20) / yes | **NOT USED** (candidate gone evidence, A12) | Plants A18 (path A20) destroys and Plants A26 (path A28) harvests move plants here; example State "Harvested" (GET_plants_v2_inactive.txt:39), HarvestedDate (:67). The eval's Plants steps do not read it back (eval section 2.5). Not a mirror read: under F-D a harvested plant stays live until the weekly full pass completes (up to the 7-day cadence plus the pass's own length, longer under the month pace; Findings 6.6), against today's CSV gone cadence of 1 to 5 days (Forks and scope applied). Reading it hourly as gone evidence costs about 4,320 calls a month (Findings 6.6) and is a MIRROR LAW change for the Scribe, not a build default |
| GET /plants/v2/onhold | licenseNumber (GET_plants_v2_onhold.txt:11-12) | C1 (:20) / yes (:22-26) | **MIRROR (full-pass seen set only)** | Read in each complete weekly plants pass. A tag counts as seen within the phase its GrowthPhase names (GET_plants_v2_flowering.txt:40; A10). Whether held plants also appear in vegetative and flowering is undocumented (probe P4); if they do not, a pass without this read would mark held plants gone. At least 6 calls per pass (one per grow license). Permission View Veg/Flower Plants (:7). Snapshot hold is 0 on all rows |
| GET /plants/v2/mother (also /inactive, /onhold) | licenseNumber | C1 / yes | **NOT USED by the mirror** (watch); **EVAL (runner check)** as an eval section 5 probe (GET /plants/v2/mother only) | Permission is "View Mother Plants" (GET_plants_v2_mother.txt:7). Its example rows carry `"GrowthPhase": "Mother"` (:40). MI lists mother plants (States E10 "YES" under E1 "Mother Plants"). The facility flag CanTrackMotherPlantsAsGrowthPhase exists (GET_facilities_v2.txt:133), but no doc text says how it affects the lists. Whether mother plants also appear in vegetative or flowering is UNRESOLVED; if they do not, they are missing from the mirror (an inference). A10 does not read the mother lists. Probe P4. The snapshot has only flowering and vegetative |
| GET /harvests/v2/onhold | licenseNumber (GET_harvests_v2_onhold.txt:11-12) | C1 (:20) / yes (:22-26) | **MIRROR (full-pass seen set only)** | Read in each complete daily harvests pass (A10). A harvest last seen there carries state onhold, and an onhold read since the pass began keeps it from gone (the harvest gone rule, Detail 3 and 4; Mapping Table 3). Whether on-hold harvests also appear in active is undocumented (probe P4). At least 6 calls per pass. Permission View Harvests (:7) |
| GET /packages/v2/onhold | licenseNumber (GET_packages_v2_onhold.txt:11-12) | C1 (:20) / yes (:22-26) | **MIRROR (full-pass seen set only)** | Read in each complete daily packages pass; its tags count as seen (A10). Whether held packages also appear in active is undocumented (probe P4); if they do not, a pass without this read would mark them gone. At least 7 calls per pass. Permission View Packages (:7). Snapshot admin_hold is 0 on all 14,488 rows |
| GET /packages/v2/intransit | licenseNumber | C1 (:20) / yes | **NOT USED** | The docs do not say incoming, outgoing or both; transfers are parked |
| GET /packages/v2/transferred | licenseNumber (GET_packages_v2_transferred.txt:11-12) | C1 (:20) / yes (:22-26), but the example row carries no LastModified | **NOT USED** (watch) | Permission View Packages (:7). Packages that leave by outgoing transfer never reach inactive (page_best-practices.txt:9, :15). Any positive-gone law change must weigh this list or the outgoing chain. Example row carries PackageId (:38), ManifestNumber (:41), PackageLabel (:42). The Scribe rules whether it becomes EVAL or MIRROR |
| GET /packages/v2/labsamples | licenseNumber | C1 / yes | **NOT USED by MA1 (lab sweep, preserved)** | src/metrcapi.ts:525; v2 only; preserved as it is |
| GET /facilities/v2/ | none ("No parameters", GET_facilities_v2.txt:11) | not paged, bare array / no | **MIRROR** (and the workbook's first call; P0) | Lists the licenses (License.Number :139, LicenseType :143). CanGrowPlants (:42) gates the plants and harvests sweeps per license: the 6 grow licenses sweep them, the processor AU-P-000694 sweeps packages only. Instructions B19, Permissions B11. **Test connection (Law 9):** in Phase A it is this one call, reporting N facilities (src/metrcapi.ts:603-618). Matching each lookup license's License.Number is Phase B work (A22, A33). **One keep-list,** stored in 0096's `metrc_facilities` (A33): License.Number, License.LicenseType, FacilityType.CanGrowPlants (:42), CanRecordProcessingJobs (:74) and CanTrackVegetativePlants (:50). Nothing else on the object is kept. **Never store** License.EmployeeLicenseNumber (:140, a person's license), FacilityId (:21), or the key user's own fields: HireDate (:22), IsOwner, IsManager and IsFinancialContact (:23-25), Email (:26), Occupations (:27). The docs write a trailing slash; the code calls /facilities/v2 (src/metrcapi.ts:609); whether that matters is UNRESOLVED (probe P11) |
| GET /employees/v2/permissions | licenseNumber (GET_employees_v2_permissions.txt:11-12) plus `employeeLicenseNumber` (:14-15) | not read | **NOT USED**; UNRESOLVED (not evaluated) | "Retrieves the permissions of a specified Employee" (:3); permission "Manage Employees" (:7). It could confirm the key holder's View permissions per license. G-9 caveat: the employee license number is a person's license and must never be stored. Whether to use it, and whether the key holds Manage Employees, is UNRESOLVED |
| POST /sandbox/v2/integrator/setup | none; optional `userKey` query (POST_sandbox_v2_integrator_setup.txt:11-12) | n/a | **NOT USED** by code (done once, by Dennis's hands) | A write (Law 3). Without userKey, the key "will be sent to the contact email on file" (:3). With userKey, the 200 "Returns the industry user key as a plain string" (:36). callPath logs the path plus the query (src/metrcapi.ts:130-133), so a call from code would log key material |
| GET /sandbox/v2/tagtypes | licenseNumber (:20) | not paged / no | **EVAL (runner check)**; not a workbook step | No workbook tab names it. "HTTP 403: This endpoint is only available in sandbox environments." (:12), so it doubles as a sandbox-host check. Its "HTTP 401: Invalid or unauthorized API key. or Request origin is not permitted." (:10) makes it the origin probe too (probe P10) |
| POST /sandbox/v2/packages/create, POST /sandbox/v2/facility/tags | licenseNumber | n/a | **EVAL (E2 runner setup)**; not workbook steps | Closed-loop opening inventory. Count "defaults to 10. The maximum allowed value is 100" (POST_sandbox_v2_packages_create.txt:11). Tags: "maximum allowed count per request is 1,000" (POST_sandbox_v2_facility_tags.txt:3). The workbook's Closed Loop Environment B8:B13 names other routes (POST /plants/v2/plantings and others) |
| GET /labtests/v2/batches | none | C1 (:11-17) / no | **NOT USED** | No Grow or Processor tab names it |
| GET /labtests/v2/types | none | C1 (:11-17) / no | **NOT USED** (one-off reference) | Named only on the "CA ONLY Labs" tab (CA ONLY Labs A19). Useful once to confirm the THC test type names thcFromResults keys on (src/metrcapi.ts:185) |
| GET /labtests/v2/states | none ("No parameters", GET_labtests_v2_states.txt:11); rate-limited per key (C6) | not paged, bare array of strings / no | **NOT USED** (one-off reference) | The Lab Test Status mapping row checks the snapshot's 8 values against this list (:20-27) |
| GET /tags/v2/plant/available, /tags/v2/package/available, /tags/v2/staged | licenseNumber (:11; :13 on staged) | not paged / no | /tags/v2/plant/available and /tags/v2/package/available: **EVAL (runner check)**; not workbook steps. /tags/v2/staged: **NOT USED** | "NOTE: This is a premium endpoint." (GET_tags_v2_plant_available.txt:3). Permission is "WebApi Tags Read Write State (All or WriteOnly)" (:7). /tags/v2/staged also requires "RetailId.AllowPackageStaging Key Value enabled" (GET_tags_v2_staged.txt:9). Eval section 5 probes the two available lists for unused tags before W1, and C4 names the plant list as a plant-tag source; whether the sandbox key may call a premium endpoint is UNRESOLVED. When the probes show no unused tags, sandbox tags for E2 come from POST /sandbox/v2/facility/tags (eval W1) |
| GET /unitsofmeasure/v2/active, /unitsofmeasure/v2/inactive | none ("No parameters", :11) | bare array / no | /unitsofmeasure/v2/active: **EVAL (E2 support)**; also a one-off reference. /unitsofmeasure/v2/inactive: **NOT USED** (one-off reference) | Confirms the export's `uom` is the abbreviation: Grams/g, Each/ea (GET_unitsofmeasure_v2_active.txt:22-23, :37-38). The active list supplies I1's UnitOfMeasure (eval section 2.3) and is an eval section 5 probe |
| GET /locations/v2/{id}, /strains/v2/{id}, /items/v2/{id} | licenseNumber optional; it only validates, and a mismatch gives 401 (GET_locations_v2_id.txt:12) | single object / no | **EVAL (E1)** | The workbook's Step 3: Locations A13 (path A15), Strains A13 (path A15) and Items A13 (path A15). Manage permissions (Details 7 to 9) |
| GET /plantbatches/v2/active, /plantbatches/v2/inactive | licenseNumber (GET_plantbatches_v2_active.txt:11-12) | C1 (:20) / yes (:22-26) | **EVAL (E2 support)**; not workbook steps. /plantbatches/v2/active is also an eval section 5 probe. **MIRROR** only if the parity read picks the batch's PlantedDate for Plant Batch Date (Mapping Table 1 row 8, candidate b) | Fill ID Number and Last Modified Date (D4:E4 on Closed Loop States PlantBatches and on PlantBatches) after the plant-batch writes. Basis: "ID, this is typically a 5 digit number generated by the software and not visible until a GET is done returning the information created." (Instructions B11). Also: "You may view or GET any Information you want in the sandboxes." (Instructions B20). MI is closed loop (States C10 "NO" under C1 "Open Loop States"). Permission View Immature Plants (:7) |
| GET /packages/v2/{label}, /plants/v2/{label}, /harvests/v2/{id} | licenseNumber optional; validates only (GET_packages_v2_label.txt:11-12) | single object / no | **EVAL (E2 support)**; not workbook steps | Id and LastModified lookups for the verification columns D4:E4 on the Packages, Plants and Harvest tabs, same basis (Instructions B11, B20). A harvest created by name is found first in GET /harvests/v2/active (row 3). Permissions: View Packages, View Veg/Flower Plants (GET_plants_v2_label.txt:7), View Harvests |
| GET /transfers/v2/rejected, /transfers/v2/{id}/deliveries, /transfers/v2/deliveries/{id}/packages/wholesale | rejected: licenseNumber; the other two: none | C1 / no | **EVAL (E1)** | GET Transfers and Wholesale A13 (path A15), A17 (path A19) and A25 (path A27). For A17 (path A19), pass the transfer Id, not the Manifest number (Detail 12) |
| GET /transfers/v2/templates/outgoing and /transfers/v2/templates/outgoing/{id}/deliveries | first: licenseNumber with lastModified; second: none | C1 / first only | **EVAL (E1 reads after E2 POSTs)** | See the note below |

**Note on the transfer template paths.** The workbook's template paths are not documented in v2.
- Step 2's path cell (Transfer Templates A13 (path A15)) holds only "GE", truncated in the workbook itself. Its path therefore comes from the Metrc Use Only list: "GET /transfers/v2/templates" (A29).
- Step 3's path "GET /transfers/v2/templates/{id}/deliveries" is at Transfer Templates A17 (path A19) and again at A30.
- Both workbook paths omit `/outgoing`. The documented v2 paths are `/transfers/v2/templates/outgoing` and `/transfers/v2/templates/outgoing/{id}/deliveries` (_INDEX.txt:404-405). The workbook's shapes match v1: /transfers/v1/templates and /transfers/v1/templates/{id}/deliveries (_INDEX.txt:434-435).
- The runner calls the documented paths and records the workbook's spelling beside them.
- Scope: the tab is optional per Permissions E32 and F32 ("O"). Its header (Transfer Templates C1) ties it to GET\POST\PUT|DELETE access for Transfers, and Permissions B45 would require it in a GET-only run.

**Sandbox host evidence.** P0, the Phase A handshake, is the first call to answer on the sandbox host.
- **The docs.** The only API server the docs print is `https://api-mi.metrc.com`, 456 times. The webhook management host `https://services-connect.metrc.com/` (page_whats-new-in-v2.txt:911, PrintableList.txt:1245) is the only other host. No sandbox host appears anywhere in the docs copy.
- **The workbook.** It gives only a California example: `https://sandbox-api-ca.metrc.com/plants/v2/plantings` (Instructions H29).
- **The research notes** record the Michigan host sandbox-api-mi.metrc.com second-hand:
  - RESEARCH/2026-09-21_metrc_connect_thread.md:11, the note's gloss on a Metrc Connect sandbox status message: "Michigan's sandbox-api-mi.metrc.com".
  - RESEARCH/2026-09-21_metrc_api_lab_testing.md:11 ("Sandbox: https://sandbox-api-mi.metrc.com.") and :45.
- **The code** already uses that host: wrangler.toml:14 and :49, and src/metrcapi.ts:26 (`METRC_SANDBOX_BASE`).
- Treat it as unconfirmed until a sandbox call answers (probe P13).
- **Sources not read (UNRESOLVED):**
  - The Postman collection that getting-started links as "Postman JSON" (page_getting-started.txt:173; `href="/Documentation/postman-json"` at page_getting-started.html:200). It was not fetched, so whether it names a host or other settings is UNRESOLVED.
  - A premium "Dedicated Sandbox" listed among Metrc Connect's premium options (RESEARCH/2026-09-21_metrc_api_lab_testing.md:9; research, not docs). How it differs from the standard sandbox (resets, facilities) is UNRESOLVED; it bears on the eval section's Q13 and Q17.
  - GET /employees/v2/permissions (EXTRAS), with its G-9 caveat.

### Probe list (P0 to P14; P1 to P14 are each UNRESOLVED in the docs)

P0 is the facilities call. In Phase A it is the handshake: one `GET /facilities/v2` (Test connection) that today reports only N facilities (src/metrcapi.ts:603-618). Reading each facility's License.Number, License.LicenseType and FacilityType flags comes with Phase B's match (A22, A33) and with the runner's Pre-step P0 (eval section 2). Phase A's ground is complete; the handshake waits on Dennis setting the sandbox secrets.

P1 to P14 need more than that one call. Under A6 the user key is deleted after the one Test connection, until Phase B's sandbox guard (A7) is merged and deployed, so P1 to P14 run after that. Several are also questions in the merged email (Findings section 9).

1. **P1 (C2):** what each list returns with no pageSize, with pageSize 20, with pageSize 50, and with pageSize 51.
2. **P2 (C3):** whether any limit on page count or total rows exists.
3. **P3 (C5): the lastModified filter.**
   - Whether a call with no lastModified filter is accepted.
   - Whether one bound alone (start only, then end only) is accepted. Try the docs' own start-only shape first (page_getting-started.txt:117, :123: lastModifiedStart alone, no pageSize). It is illustrative evidence, not proof.
   - The largest window that is accepted: try 1 h, 24 h, 25 h, and 30 days for harvests inactive.
4. **P4: overlap between lists.**
   - Whether onhold plants, packages and harvests also appear in the vegetative, flowering and active lists. Until this is answered, A10 reads the onhold lists into each full pass.
   - Whether mother plants (GrowthPhase "Mother") also appear in vegetative or flowering, and how CanTrackMotherPlantsAsGrowthPhase changes that.
5. **P5:** the separator in SourceHarvestNames and SourcePackageLabels.
6. **P6:** whether row LastModified values are real or the "0001-01-01" placeholder.
7. **P7: which API fields match the export's columns, in two parts.**
   - (a) A sandbox fixture or a Metrc answer must settle these:
     - the booleans Hold, Harvested, Administrative Hold, Administrative Recall and Finished Goods, which are all 0 in production;
     - Expiration Date and Lab Test Expiration, which are NULL on all 14,488 package rows.
   - (b) The first production dry-run parity report (Law 9) settles Plant Batch Date and confirms the Phase Date pick once a production key exists. Both are populated dates on all 97,936 snapshot rows.
8. **P8 (C8):** page order and stability. Read the same scope twice, once in page order and once in reverse page order, then compare the tag sets.
9. **P9:** what ArchivedDate means on an inactive harvest, and whether an archived but unfinished harvest (FinishedDate null, ArchivedDate set) belongs in the 30-day scope. The build default (A19) includes it through the ArchivedDate fallback.
10. **P10:** call GET /sandbox/v2/tagtypes from the Worker, to see whether "Request origin is not permitted." (GET_sandbox_v2_tagtypes.txt:10) appears for Worker egress.
11. **P11:** call /facilities/v2 both with and without the trailing slash.
12. **P12:** ask Metrc which key the per-key rate limit counts for license-less calls: the integrator key or the user key (C6).
13. **P13:** whether sandbox-api-mi.metrc.com answers at all (Sandbox host evidence). A 200 from P0 on that host answers it.
14. **P14:** whether sending License.Number as licenseNumber returns a 200 for every license (C6). This per-license reach is Phase B work (A22, A33).

### Consolidation notes

1. Retry-After (D6; critic 4): C6 now says a blank or missing header waits 0 ms (`Number("")` is 0 at src/metrcapi.ts:137; the A9 bug), an HTTP-date or text waits 1 s, and a number waits that many seconds capped at 10 s. Re-read at :135-140 and test/metrcapi.test.ts:49-50. Added the docs' "number of seconds" (page_whats-new-in-v2.txt:13) and the uncited "time window in the header" (:9) as UNRESOLVED (critic 9, D15).
2. Marks (D14; critic 14): /packages/v2/inactive and /plants/v2/inactive are now "NOT USED (candidate gone evidence, A12)". The eval's read-backs use the by-label and harvests-active reads, not these lists. KEPT is now "NOT USED by MA1 (lab sweep, preserved)" on row 13, Detail 13 and labsamples. Rows 7 to 9 are "EVAL (E1 support)", a mark defined in the legend, because none is a workbook step. /locations/v2/active is kept as E1 support, so per D14 the eval fixer adds it to eval section 5.
3. Onhold lists (D3; critic 7): /plants/v2/onhold, /packages/v2/onhold and /harvests/v2/onhold are now "MIRROR (full-pass seen set only)" under A10. Their params were re-read at :11-12, :20 and :22-26 in each file. Their floor cost (about 420 calls a month) is in the arithmetic.
4. Licenses (D5; critic 15): the license count is now 7 active, with 6 grow licenses for plants and harvests, gated by CanGrowPlants from P0, and the processor packages only. That gives 12 plant scopes, a 973-call plants floor at live counts, 1,965 at drop totals and a 12-call harvest floor. Re-checked against the snapshot: the 4 populated plant scopes all sit on grow licenses, and the per-pair drop ceilings from CANON.md:415 sum to 1,960 on 7 of 12 pairs.
5. The 11,742 (D14; critic 16): it is now sourced as the 2026-09-14 drop of AU-G-C-000832's active packages (CANON.md:415, _NOW.md:14), replacing "matches neither figure". Added the drop-total floors 1,965 and 241.
6. Harvests (D4; critic 6, 20):
   - The state is now derived as active, onhold or inactive, by the list last seen in.
   - The 30-day scope uses FinishedDate with an ArchivedDate fallback (A19). Probe P9 now asks only what ArchivedDate means.
   - The open "gone" question is replaced by the one gone rule, with a pointer to Mapping Table 3.
   - Cited canon 0.30.390 (CANON.md:748).
7. Start-only filter (D12; critic 12): page_getting-started.txt:117 and :123 are added to C5 and P3 as illustrative evidence, tied to :133's "last run time plus 5 minutes".
8. F-D lag (D13; critic 13): the lag against today's 1 to 5 day CSV cadence, and the 4,320-call alternative, are stated beside F-D and in the /plants/v2/inactive row. Drop dates and gone counts were re-read from metrc_mounts in both snapshots.
9. Facilities (D14, D7; critic 1, 19):
   - There is now one keep-list: License.Number, LicenseType, CanGrowPlants, CanRecordProcessingJobs and CanTrackVegetativePlants. EndDate is dropped from it.
   - EmployeeLicenseNumber (:140) and FacilityId (:21) are on the never-store list.
   - "Test connection per license" now reads as one call reporting N, with per-license matching in Phase B (A22, A33). C6 and P14 were changed to match.
10. Helpful Resources (D14; critic 17): page_helpful-resources is noted as byte-identical to getting-started (cmp run on both .txt and .html) because of the 302. Unread sources are listed as UNRESOLVED: the Postman collection, GET /employees/v2/permissions (now an EXTRAS row with its G-9 caveat; lines :3, :7, :11-15 re-read) and the Dedicated Sandbox (critic 18).
11. Mapping consistency (D2; critic 2, 24):
    - Harvested candidates are now HarvestedDate or HarvestId, never HarvestCount. GET_plants_v2_inactive.txt:59 is 0 on a harvested plant. A note says row 1's proof moves to metrc_harvests.
    - Unit Of Measure is now direct (the abbreviation), not "strong candidate".
    - Original Source Package Label's pairing is UNRESOLVED.
    - Administrative Hold and Recall carry three candidates each (pkg:103, :104).
    - Lab Test Status cites lts:20-27.
    - HarvestCount was added to the plants no-export list, so no field was dropped.
12. Workbook citations (D14; critic 22): every `Tab!row` citation is now `Tab A13 (path A15)` for steps, or `Tab Cell` for other cells. Each was re-read in `wf/workbook/`. Permissions!45 became A45:B45, !37 and !39 became A37:B37 and A39:B39, !32 became E32 and F32, the column headers became D4:E4 or B4:H4, and the rest likewise.
13. Numbering (D1; critic 3): the probes are now P1 to P14, with P0 the facilities call, and the list heading is no longer "for the Phase A handshake" (D7). Probes are written "probe P3" in the body to stay apart from the eval's Plants steps P1 to P6. A-numbers cited here are Findings' only.
14. Stale tree (D10; critic 5): code line numbers hold on M and B; W matched at the cut and has changed since about 19:13. The pre_r5 snapshot is cited: its mirror tables are byte-identical to the 13:59 snapshot, with 392 sweeps against 387, all skipped with keys absent, and 0 calls.
15. Incrementals floor (critic 25): "31 calls per tick is a floor" is added to the arithmetic.
16. F-A (D8; critic 8): added a pointer to reading (c) and Q1, and the count of what remains under it.
17. Durable file (critic 23): this file is the endpoint map's saved copy. The old Verification notes block is dropped. Check script: `wf/fix_endpoint_map/final/snapcheck.py`. Nothing under the project tree was written, and no git was run.
18. FIXED (cross-check 1, code tree): the citation note now anchors code line numbers on M and B, not W. Re-hashed read only: M and B hold src/metrcapi.ts e2ad026ecad07ac9 (25,891 bytes) and test/metrcapi.test.ts aede7c67ced5b53a (5,810), while W now holds 74b18498c19fd725 (45,502, 19:26:50) and efeda974ab2ce700 (27,116, 19:22:51); W's src/metrc.ts, src/mint.ts, src/labeldata.ts and wrangler.toml still match. On M, callPath is at :130, retryAfterMs at :136, RETRY_CAP_MS at :33, testMetrcConnection at :603 with its path at :609, and the retry tests at test/metrcapi.test.ts:49-50, so every cited line holds there. Note 14 was reworded to match.
19. FIXED (cross-check 2, F-D lag): "up to 7 days" now reads "up to the 7-day cadence plus the pass's own length" beside F-D and in the /plants/v2/inactive row, matching Findings 6.6 and its note 11 (a plant harvested just after its page is read stays live until the next pass completes). The 58 and 110 ticks are Findings section 3's tick table at budget 60; the 11.8 days is the pass length under the 45,000 pace (Findings section 3).
20. FIXED (cross-check 3, P0): the probe list's opening now says the Phase A Test connection reports only N facilities (main src/metrcapi.ts:603-618 returns `{ code, n: facilityCount(res.body) }`), and puts the per-facility fields with Phase B (A22, A33) and the runner's Pre-step P0, as C6, D7 and the eval section say.
21. FIXED (cross-check 4, harvests inactive fallback): the fallback is now the walk back in `metrc_window_max_minutes` chunks (Findings 6.1, A11), with the unfiltered pull's growing history kept as Findings section 3 states it.
22. FIXED (cross-check 5, marks): the two available-tags lists are EVAL (runner check) and /tags/v2/staged stays NOT USED; /unitsofmeasure/v2/active is EVAL (E2 support) and /inactive stays NOT USED; /plants/v2/mother is NOT USED by the mirror and EVAL (runner check) as a probe; the plant batch lists note the eval section 5 probe (active only, as eval section 5 lists it) and the conditional MIRROR mark (Mapping Table 1 row 8, candidate b; GET_plantbatches_v2_active.txt:60 and GET_plantbatches_v2_inactive.txt:60 re-read). The legend widens runner check as asked, and also widens E2 support to a read that supplies a write step's input, since I1's UnitOfMeasure is such a read and the old definition covered only verification columns. The premium note (GET_tags_v2_plant_available.txt:3, GET_tags_v2_package_available.txt:3) was re-read.
23. FIXED (cross-check 6, plants table against Mapping Table 1): Phase Date is now derived by endpoint (row 9, DERIVED with no UNRESOLVED), and Plant Batch Date carries both candidates of row 8. P7(b) now settles Plant Batch Date and confirms the Phase Date pick.
24. FIXED (cross-check 7, "anchor"): the citation note now calls A13 the step-label cell and B13 the paste anchor, as the eval section's Anchors lines do (workbook Locations: A13 "Step 3", A15 the path, B13:B15 merged). Detail 12's "Step 4 (anchor A17)" now reads GET Transfers and Wholesale A17 (path A19) (A17 "Step 4", A19 `GET /transfers/v2/{id}/deliveries`, re-read).
25. FIXED (cross-check 8, decoder placement): "must either" is now "can either", and the default from Findings correction 15 and the Mapping decoder fork is stated: MA1 does not move codedHarvestDate; HarvestStartDate is the source and the decoder the fallback; the move is gap 4 work.
26. FIXED (cross-check 9, P1): pageSize 20 is added, matching Findings A3 (no pageSize, 20, 50, 51) and the prose default of 20 in C2.
