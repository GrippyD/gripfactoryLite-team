> Appendix D of SESSION_REPORTS/2026-10-08_ma1_metrc_api_read_integration.md (brief MA1, Phase A, build session 2026-10-08). Code citations (file:line) hold on main app/ and branches/GFLiteOpsDashboard/app at the cut (tree 3f067013cbb9f39e); the MA1 worktree has moved since. Docs citations name files of the 2026-10-08 fetch of https://api-mi.metrc.com/Documentation/ (metrcdocs/endpoints/<VERB_path>.txt and page_*.txt, a scratch copy; see section 8 of the report for where to keep it). No em or en dash; curly apostrophes from quoted docs text were normalized to plain ones.

## Docs findings, limits, arithmetic, corrections, design inputs, assumptions

**Phase reached.**
- Phase A ground: complete. The docs, limits, arithmetic, corrections, design inputs and assumptions are below; the endpoint map, the Law 2 mapping tables and the derived evaluation step list are in their own sections.
- Phase A handshake: pending. Dennis sets the sandbox secrets (section 9 steps 4 and 5), then presses Test connection once. That is one `GET /facilities/v2` that reports N facilities (metrcapi.ts:603-618, path at :609).
  - The newest snapshot, `db_backups/20261008-184520_pre_r5` (dumped 2026-10-08T22:45:38Z), holds 392 metrc_sweeps rows, all "skipped" with "The integrator key is absent. The user key is absent.", and 0 metrc_api_calls rows (correction 23).
- The brief's "Test connection per license" reads as that one call matched per license. The per-license reach (matching each lookup license's `License.Number`) is built in Phase B (6.5, A22, A33).
- Gates: none run, since Phase A wrote no code. Merge block: none for Phase A.
- Shared-file baseline: subsection 4b.
- Observed during this consolidation: from about 19:13 on 2026-10-08 a session was writing in the MA1 worktree W (src/metrcapi.ts with userKeyFor, resolveSweepMode and metrcHostKind; src/config.ts; src/i18n.ts; scripts/smoke.mjs; test/metrcapi.test.ts; a new migrations/0096_metrc_cursors.sql; a new src/metrcpager.ts and test/metrcpager.test.ts). This section describes W as cut, and cites code on M and B, which are unchanged.

Conventions.
- `metrcdocs/` is the local Metrc docs copy fetched 2026-10-08 from https://api-mi.metrc.com/Documentation/ (`C:/Users/DennisWallace/AppData/Local/Temp/claude/C--Program-Files-Git/00cfd496-5d13-46c5-846e-b0cd0e491616/scratchpad/metrcdocs`).
- Tree hashes use the canon recipe (sorted src, test, scripts, migrations, wrangler.toml, tsconfig.json, package.json, sha256 with the Git Bash marker fix) with **wrangler.toml read as LF**. Every hash below names that recipe.
- B is `branches/GFLiteOpsDashboard/app`: tree 3f067013cbb9f39e (LF recipe), 309 files, R5 sealed (canon 0.30.428).
- M is main `app/` as read on 2026-10-08 after 17:58, and re-hashed by this pass: tree **3f067013cbb9f39e (LF recipe)**, 309 files, the same file set as B. Main's wrangler.toml is CRLF, so the raw recipe gives c7239e07349d7b60; its LF content equals B's byte for byte. The R5 files reached main at 2026-10-08 17:58:17 (src/drystrain.ts 11,686 bytes, test/drystrain.test.ts, src/index.ts 346f1283ea715bb1 at 181,985 bytes). canon/, BRIEFS/2026-10-08_dry_weight_by_strain.md and both 26062 briefs were written in the same second.
  - The project's .git log files, read without running git (G-1), show main's merge of GFLiteOpsDashboard at 17:58:16 (06595c0 to e98a138) and its push to origin at 17:58:19. The deploy is unconfirmed: canon 0.30.429 records no Version ID.
- W is `branches/GFLiteMetrcAPI/app`, branch GFLiteMetrcAPI, the MA1 worktree. It was created 2026-10-08 18:10:45 ("Created from main" at e98a138 in the branch's .git log). At the cut its tree was 3f067013cbb9f39e (LF recipe, 309 files), identical to M, and `npm ci` was done (node_modules present).
  - W has changed since about 19:13. By 19:18, src/metrcapi.ts (45,488 bytes), src/config.ts, src/i18n.ts and scripts/smoke.mjs carried new times, migrations/0096_metrc_cursors.sql was new, and the tree hashed 6498dfd1ba63a3af (310 files). By 19:23, test/metrcapi.test.ts was 27,116 bytes, efeda974ab2ce700 (5,810, aede7c67ced5b53a at the cut), and by 19:26 src/metrcpager.ts and test/metrcpager.test.ts were new. W's byte counts are readings at a moment while that session works. Every line number below is on M and B.
- LIVE per canon 0.30.429 (_NOW.md:8) is still worker 8c27a28d, main 06595c0, tree cda101da0e86ff96 (canon's figure), 307 files, 0001-0095. The R5 entry there reads "the Version ID awaited". Main is not LIVE at 3f067013cbb9f39e until a Version ID is recorded.
- 308 of the 309 hashed files are byte-identical in B and M (and in W at the cut). Only wrangler.toml differs, and only by CR bytes. Every line number below, index.ts included, therefore holds in both trees.
- Canon is at **0.30.429** (CANON.md:3). Rows 0.30.428 (R5 and the 26062 prompt) and 0.30.429 (the 26062 setup guide) do not touch the METRC API or the mirror code. 0.30.428's prompt asks the investigator for METRC data ("METRC's 737,135 g SPR", CANON.md:786).
- Brief section 0's canon reads: 0.30.37 (CANON.md:395) and 0.30.186 (:544) add nothing to Phase A; 0.30.390 (:748) is cited in 6.1's harvests leg.
- Probes are P1 to P14 of the endpoint map; P0 is the facilities call. Assumptions A1 to A34 are this section's; the Mapping section's own assumptions are A35 to A38, in the same namespace.

### 1. What the Metrc docs say

**Authentication.** One HTTP Basic header per call: username = integrator key, password = user key, HTTPS only.
- metrcdocs/page_getting-started.txt:45: "For our API, the username is equivalent to the software integrator's API key and the password is equivalent to the user's API key."
- :55: "encoded using RFC2045-MIME Base64 without the 76 char/line limit." :69: "The API endpoints will only establish communication over the HTTP Secure (HTTPS) communication protocol."
- The code already matches. `authHeader` returns `Basic ${btoa(`${integrator}:${user}`)}` (metrcapi.ts:308-310), built per request in `metrcGet` (:318-319, :337).

**Integrator key scope.** One per company and software, used for every customer, location and user, and generated per deployment.
- page_getting-started.txt:35: "to be used by every instance of your software at all times, regardless of which customer, location, or user is using it".
- Sandbox and production keys are separate keys, one per deployment.
  - Keys guide (`RESEARCH/metrc_connect/Metrc_Connect_-_How_to_Generate_keys_in_Connect.docx`, 363,623 bytes, sha256 9d8b234426edc1ef; text extracted to `scratchpad/wf/workbook/keys_guide.txt`), line 7: "you can Name your key, choose the State Deployment for Production or Sandbox Environment."
  - PrintableList.txt:1247 (webhooks): "It can be any API key for your organization that is valid for that deployment."
  - RESEARCH/2026-09-21_metrc_connect_thread.md:11 records that "the user key and vendor key for each environment survive the reset".
- Keys carry an expiration date. The Keys table's columns are "Key Name, Deployment, Expiration Date" (keys_guide.txt:17, the workbook reader's transcription of the screenshot). What an expired key returns: UNRESOLVED.
- The guide never uses the words integrator key or user key (keys_guide.txt:19).

**User key scope.** The key belongs to a Metrc user, not to a company or facility, and is bounded by that user's permissions.
- page_getting-started.txt:39: "The user API key is tied directly to the user's account (not the company or facility)" and "Your software will be limited by the permissions granted to the user within Metrc."
- :65: "Authorizations and permissions are solely dependent on the validated user's permissions."
- endpoints/GET_facilities_v2.txt:3: "This endpoint provides a list of facilities for which the authenticated user has access." It takes no parameters (:11) and needs no permission (:7).
- endpoints/GET_packages_v2_id.txt:12: "If not specified, the Package will be validated against all of the User's current Facilities."
  - The same wording, with Plant or Harvest, is on the plants by-id and by-label routes (GET_plants_v2_id.txt:12, GET_plants_v2_label.txt:12) and on the harvests by-id route (GET_harvests_v2_id.txt:12).
  - Harvests have no by-label GET (_INDEX.txt:13-18).

**Permissions Required, exactly as each file lists them** (line 7, and line 9 where a second is listed):
- View Packages: /packages/v2/active, /inactive, /onhold, /labsamples, /packages/v2/{id} (e.g. GET_packages_v2_active.txt:7).
- View Veg/Flower Plants: /plants/v2/vegetative, /flowering, /inactive, /onhold (GET_plants_v2_vegetative.txt:7).
- View Harvests: /harvests/v2/active, /inactive, /onhold, /{id} (GET_harvests_v2_active.txt:7).
- Manage Locations: /locations/v2/active (GET_locations_v2_active.txt:7 "| Manage Locations").
- Manage Items: /items/v2/active (GET_items_v2_active.txt:7 "| Manage Items").
- Manage Strains: /strains/v2/active (GET_strains_v2_active.txt:7 "| Manage Strains").
- View Packages and Manage Packages Inventory: /labtests/v2/results (GET_labtests_v2_results.txt:7 "| View Packages", :9 "| Manage Packages Inventory"). This is the existing lab sweep's results call.
- Manage Transfers and View Transfers: /transfers/v2/incoming, /outgoing, /{id}/deliveries, /deliveries/{id}/packages (each file :7 and :9).
- None: /facilities/v2/ (GET_facilities_v2.txt:7).
- View Mother Plants, View Immature Plants, View Plants Waste and View Package Source Harvests on their routes.
- Whether two listed permissions mean both or either: not in the docs, UNRESOLVED.

**Law 4, answered plainly.** Yes: one user key covers every license of the company. The condition is that the Metrc user who owns the key is on each facility with the permissions each read lists:
- the View permissions for the mirror reads;
- Manage Locations, Manage Items, Manage Strains, Manage Transfers and Manage Packages Inventory for the evaluation's list reads and the lab sweep's results call.

Per-license keys are not needed by the API's design.
- The fallback `METRC_USER_KEY` is the path and `METRC_USER_KEYS` stays unused. It would only matter if Grip chose different Metrc users for different licenses.
- The one check is a single `GET /facilities/v2/` whose `License.Number` values include all 7 lookup licenses. GET_facilities_v2.txt:138-139 show `"License": {` then `"Number": "403-X0001",`, one `License` object per facility.
- What a list call returns for a license the user cannot reach is not documented. It is an inference to settle by sandbox probe (P14).
  - The Server Responses table is generic: page_getting-started.txt:155 "401 Unauthorized | Invalid or no authentication provided." and :157 "403 Forbidden | The authenticated user does not have access to the requested resource."
  - The only license-specific 401 in the docs is on the by-id and by-label routes (GET_packages_v2_id.txt:12).
  - Logging a refusal per license and carrying on stays a design choice, not a documented behavior.

**How the license is selected on each call.** By the `licenseNumber` query parameter on every list call, with the same two keys.
- GET_packages_v2_active.txt:11-12: "The License Number of the Facility for which to return the list of active packages." The same applies to plants, harvests, locations, items, strains, transfers incoming and outgoing, the onhold lists, labsamples and labtests results. Each file has a `| licenseNumber` parameter (checked).
- By-id and by-label routes take `licenseNumber` optionally, for validation only. A wrong license there returns 401, which means "not this license", not "bad key". GET_packages_v2_id.txt:12: "if the Package is not valid for the specified License Number, a 401 Unauthorized status will be returned".
- These routes have no `licenseNumber` (no `| licenseNumber` line in the file, per endpoints/_INDEX.txt):
  - `/facilities/v2/`;
  - the transfer delivery children: `/transfers/v2/{id}/deliveries`, `/transfers/v2/deliveries/{id}/packages`, `/transporters`, `/transporters/details`, `/packages/wholesale`, `/deliveries/package/{id}/requiredlabtestbatches`, `/deliveries/packages/states`, and the outgoing template delivery routes;
  - these lookups: `/packages/v2/types`, `/packages/v2/labsamplesizes`, `/plantbatches/v2/types`, `/harvests/v2/waste/types`, `/labtests/v2/types`, `/labtests/v2/states`, `/labtests/v2/batches`, `/plants/v2/additives/types`, `/plants/v2/waste/methods/all`, `/unitsofmeasure/v2/active`, `/unitsofmeasure/v2/inactive`, `/wastemethods/v2/`, `/sales/v2/customertypes`, `/sales/v2/counties`, `/sales/v2/patientregistration/locations`, `/patient-checkins/v2/locations`.
- Other lookups do take `licenseNumber`, among them `/locations/v2/types`, `/items/v2/categories`, `/transfers/v2/types`, `/plants/v2/growthphases`, `/plants/v2/waste/reasons`, `/packages/v2/adjust/reasons` and `/sandbox/v2/tagtypes`.

**Page size, default paging, page cap.**
- Maximum page size is **50** on every paged endpoint (78 files, identical text). The line is line 20 in GET_packages_v2_active.txt, GET_plants_v2_vegetative.txt, GET_plants_v2_flowering.txt, GET_harvests_v2_active.txt, GET_harvests_v2_inactive.txt, GET_packages_v2_inactive.txt and GET_packages_v2_onhold.txt: "Pagination is currently disabled by default. You can enable pagination on this query by specifying a value that does not exceed 50."
- The prose page contradicts the default. page_whats-new-in-v2.txt:685: "The number of records to return per page. Default is 20." :683: pageNumber "Defaults to 1."
- UNRESOLVED (P1, P2):
  - what an unpaged call returns (all rows, 20 rows, an envelope or a bare array);
  - whether a pageSize above 50 is rejected or clamped;
  - any page-count cap or row cap, since none is documented anywhere.
- No v1 endpoint documents pageNumber or pageSize. Stay on v2.
- Envelope: `Data`, `Total`, `TotalRecords`, `PageSize`, `RecordsOnPage`, `Page`, `CurrentPage`, `TotalPages` (GET_packages_v2_active.txt:363-369).
  - page_whats-new-in-v2.txt (PrintableList.txt:1032): "the TotalPages attribute identifies the total number of pages in the response."
  - Only `Page` and `TotalPages` are defined.
- Sort order, and whether pages stay stable while rows change: not documented, UNRESOLVED (P8).
- `/plants/v2/waste` and `/plantbatches/v2/waste` carry pageSize but are missing from the prose "Paginated endpoints" list (GET_plants_v2_waste.txt:18, GET_plantbatches_v2_waste.txt:18; the list starts at page_whats-new-in-v2.txt:719, PrintableList.txt:1053).

**lastModifiedStart and lastModifiedEnd coverage.** Each file was tested for `| lastModifiedStart`, `| licenseNumber` and "does not exceed 50". The last column carries the mark of brief section 7, as the endpoint map sets it.

| Endpoint | licenseNumber | Paged, max 50 | lastModified | Brief's use |
|---|---|---|---|---|
| GET /plants/v2/vegetative | yes | yes | yes | MIRROR |
| GET /plants/v2/flowering | yes | yes | yes | MIRROR |
| GET /plants/v2/inactive | yes | yes | yes | NOT USED (candidate gone evidence, A12); reading it hourly is the F-D alternative of 6.6 |
| GET /plants/v2/onhold | yes | yes | yes | MIRROR (full-pass seen set only, A10), while the overlap is UNRESOLVED |
| GET /harvests/v2/active | yes | yes | yes | MIRROR (Law 6) |
| GET /harvests/v2/inactive | yes | yes | yes | MIRROR (Law 6) |
| GET /harvests/v2/onhold | yes | yes | yes | MIRROR (full-pass seen set only, A10) |
| GET /packages/v2/active | yes | yes | yes | MIRROR; the lab sweep also reads it (second call per license, metrcapi.ts:525) |
| GET /packages/v2/labsamples | yes | yes | yes | NOT USED by MA1 (lab sweep, preserved; first call per license, metrcapi.ts:525) |
| GET /packages/v2/onhold | yes | yes | yes | MIRROR (full-pass seen set only, A10) |
| GET /packages/v2/inactive | yes | yes | yes | NOT USED (candidate gone evidence, A12) |
| GET /locations/v2/active | yes | yes | yes | EVAL (E1 support) |
| GET /items/v2/active | yes | yes | yes | EVAL (E1 support) |
| GET /strains/v2/active | yes | yes | yes | EVAL (E1 support) |
| GET /transfers/v2/incoming, /outgoing | yes | yes | yes | EVAL (E1) |
| GET /transfers/v2/{id}/deliveries, /transfers/v2/deliveries/{id}/packages | no | yes | no | EVAL (E1); one call per transfer or delivery, key-level rate budget |
| GET /labtests/v2/results | yes (plus packageId) | yes | no | NOT USED by MA1 (lab sweep, preserved); one call series per package |
| GET /facilities/v2/ | no | no (bare array) | no | MIRROR (Test connection and the daily facilities refresh, A33; the evaluation's P0) |

- Both bounds are marked "optional" separately. The example sends both as UTC Z (GET_packages_v2_active.txt:30). Whether one bound alone works: UNRESOLVED (P3).
  - Illustrative evidence, not proof: page_getting-started.txt:117 describes a call that returns active packages "that have been modified since 2023-11-01T08:00:00+02:00", and :123 shows it as `GET /packages/v2/active?licenseNumber=123-ABC&lastModifiedStart=2023-11-01T08:00:00%2B02:00`. That is a start-only "modified since" call with no pageSize.
  - It matches :133's "requesting the last run time plus 5 minutes should cover all changes". If Metrc accepts a start-only call, a catch-up after a gap would need no maximum window (an inference for P3).
- A '+' offset in a query string must be sent as %2B (page_getting-started.txt:115). `metrcGet` uses `URLSearchParams.set` (metrcapi.ts:326), which encodes it.
- **Path form.** The docs write `GET /facilities/v2/` with a trailing slash (GET_facilities_v2.txt:1, :15; _INDEX.txt:11). The code calls `/facilities/v2` (metrcapi.ts:609). Whether both forms answer alike is UNRESOLVED, for the probe (P11).
- **On-hold overlap.** Whether on-hold rows also appear in the active, vegetative, flowering and harvests-active lists is not documented: UNRESOLVED (P4).
  - GET_packages_v2_onhold.txt:3: "Retrieves a list of packages on hold for a specified Facility." GET_packages_v2_active.txt:3: "Retrieves a list of active packages for a specified Facility."
  - The CSV grids carry Hold (plants) and Administrative Hold (packages) columns (metrc.ts:51, :77), so the export includes held rows.
  - The 2026-10-08 snapshots hold 0 live held plants and 0 live held packages, so the risk is latent.

**Window limit.** No maximum window length appears in any page (searched for hours, maximum, range). Best Practices implies a filter rule anyway. page_best-practices.txt:35: "Due to the existing Last Modified filter requirement, a single call cannot be made to request a large amount of data." That conflicts with the endpoint pages, which mark both bounds optional.
- Maximum window: UNRESOLVED (P3).
- Whether a v2 list call with no lastModified filter (a full reconcile) is accepted: UNRESOLVED. Phase C's full reconcile depends on it (A11).
- History limit, from outside the docs: RESEARCH/2026-09-21_metrc_api_lab_testing.md:9 lists "Expanded lookback access" as a premium option, and :50 reads it as implying "a Standard-plan history limit". UNRESOLVED.
- The documented cadence. page_getting-started.txt:133: "requests all changes made within the last 1-hour and 5-minutes (5 min buffer, because of potential clock drift between systems)". The same line continues: "requesting the last run time plus 5 minutes should cover all changes".
- Order. page_best-practices.txt:37: "the requests must be done in chronological order - start with older Last Modified date/times and move to more recent ones."
- How packages leave active inventory. page_best-practices.txt:9: "Packages can only leave a Facility's active inventory via Finishing, Discontinuing, and Outgoing Transfers." Line 31 adds that some state-sanctioned exits cannot be tracked by the API.

**Rate limits.** Limits are per facility; the license-less endpoints are limited per API key. No numbers are published.
- page_whats-new-in-v2.txt:9: "Rate limiting is on a per facility basis."
- :13: "For the few endpoints that do not require a facility license number, these will be rate-limited on an API key basis." Whether that means the integrator key or the user key: UNRESOLVED (P12).
- :11: "The exact rate limits depend on your agreement with Metrc and the tier of services you use."
- :13: "In certain cases, the 429 response will include a "Retry-After" header. This header provides a number of seconds to wait". The header can be absent.
- :9 also says a 429 "will be returned with the time window in the header of the message". Which header carries that time window, and whether it is the Retry-After of :13, is UNRESOLVED (asked in section 9).
- From outside the docs (not usable as a docs claim):
  - RESEARCH/2026-09-21_metrc_api_lab_testing.md:9 and :12, and canon 0.30.164, record an unverified 2021 PDF and a Metrc Connect "Standard Plan (under 50,000 monthly calls)".
  - Grip's case opened as a "Free Plan" request (RESEARCH/2026-09-21_metrc_connect_thread.md:7, canon 0.30.168).
  - Grip's quota, and the period it runs over, are unrecorded: UNRESOLVED.

**Hosts.** The docs name one server on all 456 sections. PrintableList.txt: "### Server: https://api-mi.metrc.com" (456 occurrences, the Sandbox section included).
- The sandbox host is not in the docs and not in Metrc's quoted words. It is the research note's own annotation of Metrc's Sandbox Status mail: RESEARCH/2026-09-21_metrc_connect_thread.md:11 "(the state list did not survive the plain-text export; the base URL shape is https://sandbox-api-XX.metrc.com, Michigan's sandbox-api-mi.metrc.com)".
  - It also appears at RESEARCH/2026-09-21_metrc_api_lab_testing.md:45 and in canon 0.30.168.
  - The regex and `METRC_SANDBOX_BASE` rest on that note.
- Because the mail's state list was lost, a Michigan Sandbox deployment on Grip's Connect account is itself unconfirmed. Dennis can see it on the Generate Key screen (section 9 step 4).
- "Closed loop" does not appear in the API docs. It is in the workbook tab "Closed Loop Environment " and in RESEARCH/2026-09-21_metrc_connect_thread.md:37, :44.

**The sandbox user key: two routes, one key.**
- Route 1, the setup call. endpoints/POST_sandbox_v2_integrator_setup.txt:3: "Call without userKey to create a new sandbox user; the resulting key will be sent to the contact email on file."
  - Its Permissions Required is None (:7), and the file documents no auth header.
  - Its example sends the key in the query string: `POST /sandbox/v2/integrator/setup?userKey=123-ABC` (:16).
- How the setup call authenticates comes only from Metrc's mail, as the research note records it: an `x-metrc-key` header carrying the vendor key from Connect.
  - thread:11: "the auth is an API Key header, `x-metrc-key: <vendor key generated in Connect>`".
  - thread:21: "only the setup call uses the `x-metrc-key` header". Canon 0.30.168 (CANON.md:526) says the same.
  - `x-metrc-key` appears nowhere in metrcdocs. The only special header there is X-Metrc-Auth for webhooks (PrintableList.txt:1247).
- The note's reading is that the setup call "builds a generic set of sandbox facilities for the integrator" (thread:21). That is plural, so the sandbox may expose several license numbers.
- Route 2: a licensee's Sandbox Industry User Key, paired through api-info (thread:11, :21). Grip is its own licensee. Canon 0.30.168 left "pairing a licensee sandbox user key or the setup call's generic facilities" open.
- Either route gives one user key for the sandbox, not one per license.
- Sandbox inventory. endpoints/POST_sandbox_v2_packages_create.txt:3: "Creates opening balance packages for the sandbox integrator's facility." Whether the MI sandbox carries Grip's 7 license numbers is UNRESOLVED (canon 0.30.168: a question for api-info).
- Origin check. Three sandbox files list "HTTP 401: Invalid or unauthorized API key. or Request origin is not permitted.": POST_sandbox_v2_packages_create.txt:36, POST_sandbox_v2_facility_tags.txt:14 and GET_sandbox_v2_tagtypes.txt:10.
  - The setup endpoint documents no 401 and no 403. Its codes are 200, 201, 202 and 204 (POST_sandbox_v2_integrator_setup.txt:20-36).
  - One of the three is a GET, so the egress question touches E1 reads too.
  - Whether Cloudflare egress is refused: UNRESOLVED (P10).

**Object limit (E2 only).** page_whats-new-in-v2.txt:19: "If you attempt to make a call with more than 10 objects, you will receive a HTTP 413 error code". It applies to calls that "accept an array of objects within the request body" (same line). GETs send no such body.

**Helpful Resources.** page_helpful-resources.txt is byte-identical to page_getting-started.txt (cmp). That is not a capture gap: the server answers the Helpful Resources link with a 302 to `/Documentation/getting-started` (the critic's request of 2026-10-08, headers saved at `scratchpad/wf/critic/dl/h.txt`: "HTTP/1.1 302 Found", "location: /Documentation/getting-started"). No separate Helpful Resources page is served.

**Sources not read: UNRESOLVED.**
- The Postman collection. page_getting-started.txt:173 reads "Postman JSON", linked in page_getting-started.html as `href="/Documentation/postman-json"`. It was not fetched. It may carry a host variable.
- `GET /employees/v2/permissions`: "Retrieves the permissions of a specified Employee, identified by their Employee License Number, for a given Facility." (GET_employees_v2_permissions.txt:3). Permission "Manage Employees" (:7); it takes `employeeLicenseNumber` (:14). It could confirm the key holder's View permissions per license. G-9: an employee license number is a person's, and must never be stored or logged.
- The premium "Dedicated Sandbox" listed at RESEARCH/2026-09-21_metrc_api_lab_testing.md:9. It bears on sandbox resets and on generic facilities, so it is asked in section 9's email.

### 2. Workers and D1 limits

**Plan on record: Workers Paid.**
- CANON.md:415 (0.30.57), the owner verbatim: "account is paid". Same line: "mounted in under 30 seconds in rounds of 5,000 on the paid plan".
- MEMORY.md:9 (status at 0.30.429): "Workers Paid."
- CANON.md:412 (0.30.54): "Workers Paid has no daily cap (50 million rows written a month included, then $1.00 per million)".
- MEMORY.md:87 ("the Cloudflare account is on Workers Free") is the stale note from before the upgrade.
- wrangler.toml has no `[limits]` block (B and M), so plan defaults apply.

Sources, fetched 2026-10-08. Local copies are in `scratchpad/wf/limits/`.
- (W) https://developers.cloudflare.com/workers/platform/limits/ (Last updated Oct 8, 2026)
- (C) https://developers.cloudflare.com/workers/configuration/cron-triggers/
- (D) https://developers.cloudflare.com/d1/platform/limits/
- (DP) https://developers.cloudflare.com/d1/platform/pricing/
- (WR) https://developers.cloudflare.com/workers/wrangler/configuration/
- (WP) https://developers.cloudflare.com/workers/platform/pricing/

| Limit | Workers Paid (on record) | Workers Free (comparison) | Source, verbatim |
|---|---|---|---|
| Subrequests per invocation | 10,000 default, up to 10M | 50 | W:188 "Subrequests per invocation \| 50 \| 10,000 (up to 10M)" |
| Subrequests to internal services | matches configured limit | 1,000 | W:189 "Subrequests to internal services \| 1,000 \| Matches configured limit (default 10,000)" |
| What a subrequest is | | | W:184 "any request a Worker makes using the Fetch API or to Cloudflare services like R2, KV, or D1" |
| D1 queries per Worker invocation | **1,000** (conservative; conflicts with W:189 on Paid) | 50 | D:24 "1000 (Workers Paid) / 50 (Free)" |
| CPU per HTTP request | 30 s default, up to 5 min | 10 ms | W:71 "CPU time per HTTP request \| 10 ms \| 5 min (default: 30 seconds)" |
| CPU per Cron Trigger | 30 s (interval under 1 h), 15 min (interval 1 h or more) | 10 ms | W:72 "30 seconds (< 1 hour interval) <br> 15 min (>= 1 hour interval)" |
| What CPU counts | | | W:67 "Waiting on network requests (such as `fetch()` calls, KV reads, or database queries) does **not** count toward CPU time." |
| Wall time per cron invocation | 15 min | 15 min | W:423 "Scheduled Workers have a maximum wall time of 15 minutes per invocation." |
| waitUntil after an HTTP response | 30 s | 30 s | W:193 "which can extend execution for up to 30 seconds" |
| Simultaneous outgoing connections | 6 | 6 | W:25 |
| Daily requests | no limit | 100,000 | W:171 "daily request limit of 100,000 requests, resetting at midnight UTC" |
| Cron Triggers per account | 250 | 5 | W:31 |
| Subrequest setting | default 10,000, max 10,000,000 | max 50 | WR:511 "defaults to 50 for free accounts and 10,000 for paid accounts" |
| D1 bound parameters per query | 100 | 100 | D:29 |
| D1 batch | per-statement limits | same | D:38 "Limits for individual queries (listed above) apply to each individual statement contained within a batch statement." Whether a batch counts as 1 or N queries: UNRESOLVED (canon evidence 0.30.42/0.30.43 suggests 1) |
| D1 query duration | 30 s, the whole batch included | same | D:102 "this duration limit also applies to the entire batch call" |
| D1 rows written | 50M/month included, then $1.00/M | 100,000/day | DP:28 "Rows written \| 100,000 / day \| First 50 million / month included + $1.00 / million rows" |
| D1 rows read | 25B/month included | 5M/day | DP:27 |
| At the Free daily limit | n/a | queries refused until 00:00 UTC | DP:58 "you will not be able to run queries against D1"; DP:44 "Free limits reset daily at 00:00 UTC." |
| Index cost | | | DP:42 "Indexes will add an additional written row when writes include the indexed column" |

- **Which limit binds on Paid: D1 queries per invocation.**
  - D:24 gives "1000 (Workers Paid) / 50 (Free)" and points to the subrequest limits.
  - W:189 gives internal-service subrequests on Paid as "Matches configured limit (default 10,000)".
  - The two pages conflict on Paid as well as on Free; 1,000 is the conservative reading.
  - Subrequests (10,000) and CPU do not bind first.
- The hourly `15 * * * *` trigger runs runSheetSync, runMetrcSweep and runInTestingSync one after another in one invocation (index.ts:4401-4412, both trees; the three calls at :4406-4408).
- Each cron string is its own invocation. The handler tells `*/5 * * * *` apart by `event.cron` (index.ts:4403-4404; wrangler.toml:53-56 "The handler tells the two apart by event.cron."). A third cron string would give the mirror sweep its own 1,000 D1 queries, its own CPU and its own 15 min wall (6.1, A28).
- W:72 states CPU per Cron Trigger by interval. Whether an hourly trigger gets 15 min while `*/5 * * * *` sits on the same Worker: UNRESOLVED. Assume 30 s.
- Free's 10 ms CPU cap is the same for HTTP requests (W:71) and cron (W:72). It already produced Error 1102 here, on an HTTP mount request, not a cron.
  - Canon 0.30.42 (CANON.md:400) records the owner's words "On the third export mounting".
  - 0.30.54 ties it to the 10 ms cap (CANON.md:412 "the 10 ms CPU cap behind the 1102 of 2026-09-11").
  - W:80 names 1102 as the CPU-limit error.
- Subrequest limits in canon: zero hits in CANON.md, MEMORY.md and _NOW.md.

### 3. The arithmetic (documented P = 50, against the brief's P = 20)

Inputs and model:
- Plant rows per license and phase are the 2026-09-14 drops (CANON.md:395, :415). Live rows are the 2026-10-08 snapshot `db_backups/20261008-135926_post_dedupe`, read only. The newer `db_backups/20261008-184520_pre_r5` (dumped 2026-10-08T22:45:38Z) holds the same mirror figures: 97,936 plant rows, 48,168 live; 14,488 package rows, 13,045 live; 70 mounts.
- Six grow licenses times 2 phases make 12 pairs. The six sweep plants and harvests, gated by `CanGrowPlants` from `/facilities/v2` (P0); the processor AU-P-000694 sweeps packages only. Every empty pair or license still costs 1 call per pass. The 7 licenses are seeded in 0016:63-64 and 0020:19-23.
- Hourly incrementals are one page each: plants 12, packages active 7, harvests active plus inactive 12. That is **31 calls per tick, a floor**: a bulk move, or a phase change across a room, makes more pages in one window.
- The harvest daily reconcile is estimated at **12 calls, which is a floor**.
  - It assumes at most 50 harvests per license per list.
  - GET_harvests_v2_inactive.txt documents only licenseNumber, paging and lastModified (:11-26), with no FinishedDate filter.
  - An unfiltered daily inactive pull therefore reads all inactive history and grows with it: UNRESOLVED until counted.
- The existing lab sweep makes **14 calls per tick when each of the 7 licenses answers one page per path** (metrcapi.ts:524-530).
  - Fewer when a license is refused: a labsamples refusal breaks out and skips active (:531-534), so 7 calls when every license is refused.
  - More with paging (up to 20 pages per path, :404), a 429 retry (:357-361) and results calls (one paged series per matched sample package, :545-556).
  - Code ceiling: 7 x 2 x 20 x 2 = 560 attempts before results.
- Scripts: `scratchpad/wf/synth_findings/arith.py`, plus `scratchpad/wf/fix_findings/arith2.py` for the brake, the write factors and logging.

**Full-pull calls**

| Basis | Plants (aggregate / per pair plus empty checks) | Packages (aggregate / plus empty checks) |
|---|---|---|
| Brief, P = 20, totals 97,936 and 11,742 | 4,897 / 4,904 | 588 / 594 |
| **P = 50, same totals** | **1,959 / 1,965** | **235 / 241** |
| P = 50, live 48,168 and 13,045 | 964 / 973 | 261 / 267 |

- Largest single scope: GR-C-001132 flowering, 48,149 rows, 963 calls (599 at the live 29,938).
- Per pair at P = 50: 963, 689, 200, 40, 33, 30 and 5, which sum to 1,960, plus 5 empty pairs.

**METRC calls available per hourly tick**

| Bound | Calls per tick | Basis |
|---|---|---|
| Cloudflare Paid, mirror on its own cron (6.1, A28) | about 200 | A code cap of 700 D1 queries of that invocation's 1,000 (D:24), minus 100 for cursors, run logs and mounts, at 3 D1 queries per page (call log insert, existing-tag lookup batch, write batch). 300 queries stay as headroom. If a batch counted as N statements: about 54 |
| Cloudflare Paid, mirror inside the shared 15-past invocation | about 100, and no fixed reserve is safe | A 400 cap minus 100, at 3 per page. The lab sweep alone can issue 560 call-log inserts in its worst case before any results calls (record runs in `finally`, metrcapi.ts:354; one `recordCall` query per attempt, :387-392; 20 pages, :404; 2 attempts, :357-361). The sheet sync and In Testing are uncounted |
| Cloudflare Free | 3 to 25 | 50 subrequests and 50 D1 queries (the D1 page), or 1,000 internal (the Workers page). 10 ms CPU makes Free unworkable either way |
| Metrc, if the Standard figure applies | about 69 average (about 55 after the lab sweep's 14) | 50,000 / 720 ticks; per-facility limits unpublished |
| 15 min cron wall | 200 calls need 4.5 s or less each, D1 included | Metrc latency UNRESOLVED |

**Ticks for the weekly plants reconcile.** Plants calls per tick = the budget, minus the 31 incrementals (the floor, so these tick counts are best cases), minus the tick's share of the daily packages and harvests reconcile (253/24, rounded up to 11; at live counts 279/24, rounded up to 12).

| Basis | Tick budget 200 (Paid ceiling, own invocation) | Tick budget 60 (recommended default) |
|---|---|---|
| P = 20, totals (brief) | 143 per tick, 35 ticks (20.8% of the week's 168) | 3 per tick, 1,635 ticks: **never completes in a week** |
| **P = 50, totals** | 158 per tick, **13 ticks (7.7%)** | 18 per tick, **110 ticks (65.5%)** |
| P = 50, live | 157 per tick, 7 ticks (4.2%) | 17 per tick, 58 ticks (34.5%) |

**Metrc calls per 30-day month, for the brief's cadence**

| Item | Calls |
|---|---|
| lab sweep (one page per path) | 14 x 720 = 10,080 |
| incrementals (floor) | 31 x 720 = 22,320 |
| packages daily | 241 x 30 = 7,230 |
| harvests daily (floor) | 12 x 30 = 360 |
| plants weekly | 1,965 x 30/7 = 8,421 |
| **Total at P = 50** | **48,411 (96.8% of 50,000)** |

- That total leaves out:
  - results calls and 429 retries;
  - Test connection and Sweep now;
  - the onhold reads of A10, about 420 a month (packages 7 x 30, harvests 6 x 30, plants 6 x 30/7);
  - the daily facilities refresh of A33 (30 a month);
  - the evaluation runner.
- At live counts the month is 44,940 calls (89.9%).
- At P = 20 it is 71,597, over the Standard figure. **The Metrc monthly quota binds before Cloudflare does.**
- **A hard stop at 45,000 would stall the mirror at the end of each month.**
  - metrc_api_calls counts every attempt, the lab sweep's included (metrcapi.ts:354, :520).
  - It counts over the UTC calendar month (`loadMetrcAdmin`, :630-632, `started_at >= ${month}-01`).
  - At 48,411 a month (1,614 a day), a 45,000 stop trips on day 27.9 and stalls the mirror for the last 2 or 3 days.
  - At live counts (44,940, 1,498 a day) it trips on day 30.04, so on day 31 of a 31-day month.
  - 6.3 therefore paces instead of stopping (A17).
- Under a 45,000 pace:
  - The fixed work is 39,990 (lab 10,080, incrementals 22,320, packages daily 7,230, harvests daily 360). That leaves 5,010 for plants, so at drop totals the plants full pass stretches from 7 days to about 11.8.
  - At live counts the fixed work is 40,770, leaving 4,230 for a 973-call pass. It takes about 6.9 days and fits.
- Saving option (A31). The lab sweep already reads /packages/v2/active for every license each hour over the same 65 minutes (metrcapi.ts:525-530).
  - Sharing that read with the mirror's packages incremental saves 7 x 720 = 5,040 calls a month: 43,371 (86.7% of 50,000) at drop totals, 39,900 (79.8%) live.
  - The plants pass then fits inside a week under 45,000 (about 5.9 days).
  - It changes the lab sweep, which Law 5 preserves exactly, so it is not the default.

**D1 rows written per day** (the plan on record has no daily cap)

Write factors (DP:42, CANON.md:412):
- **Insert:** 4 rows per plant and 5 per package, counting the TEXT primary key's autoindex as canon does.
  - CANON.md:412 (0.30.54): "metrc_plants: a TEXT primary key and two indexes, four writes per row; metrc_packages five".
  - Canon's observation backs it: the three sliced mounts (49,787 plants, 11,742 packages) were "about 260,000 row writes", against 257,858 computed.
  - Whether D1's rows_written counts the autoindex beyond that one observation: unverified.
- **Update:** 3 rows per plant. plantUpdateStmt (metrc.ts:921-942) sets license, phase, gone_at, strain and location, which sit in both indexes (0042:60-61), and never changes the key.
- **Update:** 4 rows per package. packageUpdateStmt (:965-978) touches all 3 indexes (0042:94-96).
- **Gone mark:** 2 rows.

| Scenario | Rows/day | Share of Free's 100,000 |
|---|---|---|
| Every row inserted (a first pull into an empty mirror, and any tag new to the mirror), 97,936 x 4 + 11,742 x 5 | 450,454 | 450.5% (canon's "about 450,000 row writes with indexes", CANON.md:412) |
| Every row rewritten as updates (97,936 x 3 + 11,742 x 4) | 340,776 | 340.8% |
| Brief: packages rewritten daily (11,742 x 4) | 46,968 | 47.0% |
| Brief: plants rewritten on the weekly day (97,936 x 3) | 293,808 | 293.8% |
| Changed rows only, 1% / 5% / 10% / 25% churn (update factors) | 3,408 / 17,039 / 34,078 / 85,194 | 3.4% / 17.0% / 34.1% / 85.2% |
| Break-even churn | about 29.3% per day | 100% |
| Logging at 48,411 calls a month (derived below) | about 7,900 (about 5,500 without the autoindex) | about 7.9% |
| API mounts, one per changed pass (worst case, derived below) | about 37,900 | about 37.9% |
| API mounts, one per license, kind and phase per UTC day (6.1, A30) | about 1,400 | about 1.4% |

- **Logging derivation** (total about 7,889 rows a day):
  - metrc_api_calls: 48,411 / 30 = 1,614 calls a day, times 3 rows per insert (row, TEXT primary key autoindex, started_at index; 0069:7-15) = 4,841.
  - metrc_sweeps: 24 x 3 = 72.
  - metrc_sweep_runs: about 31 a tick x 24 x 3 = 2,232.
  - Cursor updates: 744 x 1 = 744, since no indexed column changes.
- **Mount derivation** (about 51 rows per plants mount):
  - A mount row writes 3 rows: the row, the key autoindex and the created_at index (0042:16-38).
  - Its insert logs (`logsForInsert`, db.ts:3737-3762, metrc.ts:1385) write one change-log row per non-null field of the record (metrc.ts:1351-1361). With a null actor that is 8 for plants and 7 for packages.
  - A pass that completes adds 4 count logs (:1473-1493).
  - Each change-log row writes 4 rows (record_change_log has a TEXT key and two indexes, 0001:133-153).
- **One mount per changed pass**, at 31 passes a tick, gives 744 mounts a day: about 37,900 rows and 8,928 change-log rows a day. That is about 268,000 change-log rows a month into a table that already holds about 806,000 rows and whose unpaged read hit 7500 (canon 0.30.353, CANON.md:711).
- **One mount per license, kind and phase per UTC day** gives at most 19 mounts (12 plant pairs and 7 package licenses). Each tick reuses its mount and updates the counts in place, as the CSV rounds do (metrc.ts:1456-1472). That is 19 x 51 + 19 x 23 = about 1,400 rows a day.
- The reconcile already writes changed rows only: diffMount (metrc.ts:648-688) issues no statement for unchanged rows.
- So on Paid a steady day is about 17,000 (5% churn) + 7,900 + 1,400 = about 26,300 rows. That is about 790,000 a month, 1.6% of the 50M included.

### 4. Corrections to the brief

1. **Canon pin.** The brief says 0.30.427; canon is at 0.30.429 (CANON.md:3). The two new rows (R5 sealed with the 26062 prompt, and the 26062 setup guide) do not touch the METRC API or the mirror code. 0.30.428's prompt only asks for METRC data (CANON.md:786).
2. **metrcapi.ts seal.** The brief says 25,366 bytes, ce55b905b181bd4e (the 0.30.185 seal).
   - The file is 25,891 bytes, e2ad026ecad07ac9, in both trees (and in W at the cut). Brief F changed it at 0.30.193 (SESSION_REPORTS/2026-09-22_mirror_releases_and_adopts.md:58).
   - test/metrcapi.test.ts (5,810, aede7c67ced5b53a) and 0069 (876, 28571968cc3b1fb5) are unchanged.
3. **Page size.** P is 50, not 20 (GET_*_v2_*.txt:20).
   - Full pulls are 1,959 plants calls and 235 packages calls, not 4,897 and 588.
   - Canon's "pageSize 20" (MEMORY.md:191, canon 0.30.164) came from RESEARCH/2026-09-21_metrc_api_lab_testing.md:49 ("enabled by a pageSize not above 20"). Today's docs supersede it.
   - The code still hardcodes 20 rows x 20 pages (metrcapi.ts:27-28).
4. **Default paging.** The brief assumes paging. The endpoint pages say "Pagination is currently disabled by default", while the prose says "Default is 20". The client must always send pageSize.
5. **Counts.** 97,936 plants and 11,742 packages are the 2026-09-14 drop totals (CANON.md:415, _NOW.md:14).
   - The 11,742 is the 2026-09-14 drop of AU-G-C-000832's active packages only (CANON.md:415 "AU-G-C-000832 packages 11,742"; _NOW.md:14 gives only the total, "97,936 plants, 11,742 packages").
   - The 2026-10-08 snapshots (13:59 and 18:45) hold 97,936 plant rows but only **48,168 live**.
   - Packages are 14,488 rows, **13,045 live**: AU-G-C-000832 11,844 and AU-P-000694 1,201.
6. **"fills only blank mirror columns".** The phrase is ambiguous with the plants and packages mirror rather than wrong: 0069's own header calls the desk columns "The mirror columns on test_orders and test_samples" (migrations/0069_metrc_mirror.sql:4-5). The sweep fills those desk columns on `test_samples` and `test_orders` (0068:48-49, :102-114) through `mirrorChanges` (metrcapi.ts:209-275).
   - It never writes `metrc_plants`, `metrc_packages` or `metrc_mounts`.
   - Blank-only is enforced in memory only: the UPDATE at metrcapi.ts:473 has no null guard.
   - It also calls `/labtests/v2/results` once per matched sample package (:545-556), which the brief does not mention.
7. **"Handle Retry-After and 429s as 0069 already does".** 0069 holds two tables only. The logic is in `metrcGet` (metrcapi.ts:357-361): one retry and a 10 s cap (:33).
   - `retryAfterMs` (:136-140) waits as follows. A missing or blank header waits **0 ms**, because `Number("")` is 0 at :137. An HTTP-date or other text waits 1 s (:138; test/metrcapi.test.ts:50). A number waits that many seconds, capped at 10 s (:139).
   - The 0 ms case contradicts the comment at :135 and 0.30.185 assumption 6 ("an unparseable header one second"). It is a bug (A9). No test covers a blank header.
   - A second 429, or any status of 400 or more other than 401 and 403, throws in `readPaged` (:407). That aborts every license.
8. **`METRC_WRITE_ENABLED`** is a TypeScript const (metrcapi.ts:32), not a var or binding. `METRC_EVAL_ENABLED` does not exist yet (it is new, as the brief says).
9. **Sandbox host source.** The docs never name a sandbox host: all 456 sections print "### Server: https://api-mi.metrc.com".
   - The regex and `METRC_SANDBOX_BASE` (metrcapi.ts:26) rest on the research note's annotation of Metrc's Sandbox Status mail (RESEARCH/2026-09-21_metrc_connect_thread.md:11, the parenthetical, not Metrc's quoted words; canon 0.30.168). Cite that.
   - "Closed loop" is in the workbook and the thread notes, not in the docs.
10. **No host guard exists.** `metrcBase` (metrcapi.ts:102-112) accepts any https origin and sends the keys there. A test asserts that production is accepted (test/metrcapi.test.ts:120).
11. **Workbook and keys guide.**
    - The workbook is `RESEARCH/metrc_connect/Generic_Evaluation_for_All_States_MASTER_10.2025.xlsx`, with an underscore and not a space: 99,735 bytes, d06d9a4bd4a404e7, 22 tabs. The brief and canon 0.30.168 write a space.
    - The tabs include "Closed Loop Environment " (trailing space), "Closed Loop States PlantBatches", "Harvest", "LabResults", "GET Transfers and Wholesale", "Transfer Templates" and "Transfer External Incoming".
    - The keys guide is `RESEARCH/metrc_connect/Metrc_Connect_-_How_to_Generate_keys_in_Connect.docx` (363,623 bytes, sha256 9d8b234426edc1ef). Phase A's workbook reader extracted it to `scratchpad/wf/workbook/keys_guide.txt` (2,020 bytes, via `wf/workbook/_scripts/docx2txt.py`).
    - It covers only generating keys in Connect: Keys, Generate Key, a name, the Deployment (Production or Sandbox) and an expiration date. The eye icon shows a key and the copy icon copies it (keys_guide.txt:3-9, :16-18).
    - It never mentions the setup call, a user key or a header.
12. **"Test connection per license" and "sandbox secrets per license".**
    - The existing Test connection is one license-less call that reports a count (metrcapi.ts:603-618). `/facilities/v2/` takes no parameters, so "per license" means matching `License.Number` within one response (Phase reached; built in Phase B, 6.5).
    - The setup call makes one sandbox user (POST_sandbox_v2_integrator_setup.txt:3 "Call without userKey to create a new sandbox user"). There is one sandbox user key, not one per license.
    - The words "for the sandbox integrator's facility" belong to the packages/create endpoint (POST_sandbox_v2_packages_create.txt:3), not to the setup endpoint.
    - The research note reads the setup call as building "a generic set of sandbox facilities for the integrator" (thread:21), so the sandbox may expose several license numbers. Whether it carries Grip's 7 is UNRESOLVED.
13. **F-B is settled by the docs.** The user key is the user's, not the facility's (page_getting-started.txt:39). Per-license keys are not needed. See section 1.
14. **Migrations needed beyond the brief's plan.**
    - `metrc_mounts` has no `source` column (0042:16-36). Law 1's stamp needs an ALTER.
    - `metrc_sweeps` and `metrc_api_calls` have no license, endpoint or host columns (0069:7-29). Law 1's "one log row per sweep per license per endpoint" and Law 7's samples therefore need a new table: 0098 is required, not "if needed".
    - The cross-tick seen set of a full pass, the facility flags and the cursor mode need storage too (6.2).
15. **Decoder location.** The brief says the harvest name's coded date "stays decoded in the METRC layer". Today `codedHarvestDate` lives in `src/labeldata.ts:308`, outside the METRC layer (TRANSLATION_MAP gap 4). Law 6 must move or wrap it, not "keep" it, or demote it as the default below does.
    - Default, for Dennis's word (this folds in the Mapping section's former A2): MA1 does not move it. MA1 lands `HarvestStartDate` in metrc_harvests, so the decoder becomes the fallback (TRANSLATION_MAP gap 2, :35), and the move is gap 4 work.
    - Fork: move it in MA1, which touches the label reads at labeldata.ts:343.
16. **The binding Cloudflare limit** on Paid is D1 queries per invocation: 1,000 by D:24, the conservative reading where D:24 and W:189 conflict. It is not subrequests (10,000) or CPU. The hourly cron also shares its invocation with the sheet sync and In Testing, so the mirror sweep should get its own cron string (A28).
17. **Monthly Metrc quota.** Canon 0.30.164 records the Standard plan's under-50,000 figure.
    - At the brief's P = 20 cadence the month is about 71,600 calls, over that figure.
    - At P = 50 it is about 48,400, just under. A stop at 45,000 would trip on day 27.9 (section 3).
    - Grip's own quota is unrecorded.
18. **A full reconcile without a filter may be refused.** page_best-practices.txt:35 speaks of an "existing Last Modified filter requirement", and no maximum window is documented. Law 5's daily and weekly full reconciles assume an unfiltered paged list works; that is UNRESOLVED. A11 gives one fallback per kind.
19. **Docs folder.** The brief names `RESEARCH/metrc_connect/docs/` as the fallback; Phase A used the scratchpad copy instead. RESEARCH/ never rides (G-1), so any repo copy is the Scribe's or Dennis's hand. No separate Helpful Resources page exists: the server redirects it to getting-started (section 1).
20. **Field help.** Law 9's help text must ride as native `title` tooltips, never on screen (THE HOVER HELP LAW 0.26.0, CANON.md:327; emitters ui.ts:18-27 and html.ts:387-399). The existing page has no `title=` help at all (metrcapi.ts:641-673).
21. **Smoke.** scripts/smoke.mjs:443 hardcodes "About to apply 95 migration(s)". It must move to 98 with the new migrations.
22. **Log rows per mount.** Canon 0.30.38 says "one log row per mount, never per plant".
    - The CSV door actually writes `logsForInsert` rows for the mount record (metrc.ts:1385): one per non-null field, up to 9 with an actor and 8 with a null actor (db.ts:3737-3762).
    - It adds 4 count logs (:1473-1493). There are still none per plant.
    - Law 1 should say "a bounded handful per mount", and the API door should write one mount per license, kind and phase per UTC day (A30).
23. **The Phase A handshake is unmet.** The brief lists the secrets under "What already exists". They are typed (metrcapi.ts:18-24) but not set.
    - The newest snapshot (db_backups/20261008-184520_pre_r5, dumped 2026-10-08T22:45:38Z) holds 392 metrc_sweeps rows (387 in the 13:59 snapshot db_backups/20261008-135926_post_dedupe). All are "skipped" with "The integrator key is absent. The user key is absent."
    - It holds 0 metrc_api_calls rows.
    - Today's Test connection is one license-less call returning a count (metrcapi.ts:603-618), so a per-license check needs the 6.5 work.

### 4b. Shared-file baseline (Law 0)

sha256 (first 16 hex characters) and bytes, from the critic's run and re-run by this pass, with equal results. These are the "before" hashes for MA1's report and the Scribe's hand merge.

| File | M: main `app/` | B: `GFLiteOpsDashboard/app` | W: `GFLiteMetrcAPI/app` at the cut |
|---|---|---|---|
| src/index.ts | 346f1283ea715bb1/181985 | same | same |
| src/config.ts | f74745f4f7524f65/82570 | same | same |
| src/html.ts | 478948a7e47def4f/197717 | same | same |
| src/i18n.ts | a4494169d3afd815/270984 | same | same |
| scripts/smoke.mjs | dfff1721f003a168/824862 | same | same |
| wrangler.toml | 82e5cd2b1d151583/2903 (CRLF) | edc3570cca51b401/2817 (LF) | edc3570cca51b401/2817 (LF) |
| src/metrcapi.ts | e2ad026ecad07ac9/25891 | same | same |
| src/metrc.ts | bc4a4ca51f4b9530/87588 | same | same |
| test/metrcapi.test.ts | aede7c67ced5b53a/5810 | same | same |
| migrations/0069_metrc_mirror.sql | 28571968cc3b1fb5/876 | same | same |

- The first six rows are Law 0's shared files (brief section 3). The last four are the METRC files MA1 changes.
- Main's wrangler.toml carries 86 CR bytes. With them removed it is 2,817 bytes and edc3570cca51b401, equal to B and W; the LF recipe (Conventions) reads it that way.
- W column: the state at the cut (2026-10-08 18:10:45), as the critic hashed it and as this pass hashed it before 19:13. W has changed since: at 19:13:35 src/metrcapi.ts was 30,030 bytes (fc5b68e0a3131ca3), and by 19:18 src/metrcapi.ts, src/config.ts, src/i18n.ts and scripts/smoke.mjs carried new times and migrations/0096_metrc_cursors.sql was new; by 19:23, test/metrcapi.test.ts was 27,116 bytes, efeda974ab2ce700; by 19:26 src/metrcpager.ts and test/metrcpager.test.ts were new (Conventions).
- No 0096 or later reference turned up in BRIEFS (main, B or W) or `_NOW.md` (rechecked by this pass), so 0096 to 0098 still look free for MA1 (section 7).

### 5. Existing code against the brief's claims

| Brief claim | On the tree | Where |
|---|---|---|
| Dark read-only client | Exists. 673 lines; GET only (`method: "GET"` hardcoded at :336) | src/metrcapi.ts |
| `/admin/metrc-api`: keys, host, calls this month, last sweep, Test connection | Exists, with gaps: "Base: <host>" shows any host; Test connection is one call reporting a count; the sweep message renders raw English; there is no hover help; there is no per-license, mode, Sweep now or parity view | index.ts:1636-1648 (both trees); metrcapi.ts:603-618, :628-639, :641-673; tile html.ts:2052; ADMIN_METRC_API_PATH config.ts:1247 |
| Migration 0069 | `metrc_api_calls(id, started_at, path, status, ms)`, one row per HTTP attempt; `metrc_sweeps`, one row per run; no license, endpoint or host | 0069:7-15, 17-29; recordCall metrcapi.ts:387-392 |
| Hourly sweep at 15 past | Exists; one invocation with runSheetSync and runInTestingSync | wrangler.toml:55-56; index.ts:4401-4412 (both trees) |
| Reads lab samples and active packages for the last 65 min | Yes. The window is now minus 65 min, never derived from the last success (no cursor, no catch-up) | metrcapi.ts:126-128, :516, :524-530 |
| Paging | 20 rows x 20 pages, silent truncation at 400 rows per license per path | metrcapi.ts:27-28, readPaged :401-415 |
| Fills blank mirror columns | Fills desk columns on test_samples and test_orders only (0069's header calls them mirror columns) | mirrorChanges :209-275; applyChanges :459-491 (UPDATE :473) |
| 429 handling | One retry, 10 s cap, blank header 0 ms, second 429 throws | :33, :136-140, :357-361, :407 |
| Secrets typed | Two secrets (`METRC_INTEGRATOR_KEY`, `METRC_USER_KEY`) and one var (`METRC_API_BASE`, a wrangler.toml var, not a secret) typed in the Env block. The secrets are not set (correction 23) | metrcapi.ts:18-24; read :318-319; var wrangler.toml:14, :49 |
| `METRC_API_BASE` sandbox on default and grip | Yes | wrangler.toml:14, :49; env.c10 has none and no cron |
| `METRC_WRITE_ENABLED` false, `testingPostRequest` null | Yes (a const) | metrcapi.ts:32, :299-306 |
| Key scrubbing | Raw keys of 4 or more chars only, not the base64 token; applied at :352 and :582. `callPath` logs path plus query on every attempt (:130-133, :327, :354), so a key in a query string would reach a log row | metrcapi.ts:142-150 |
| Release on lab state from the sweep | Dead branch (`change.table === "metrc_packages"` can never be true) | metrcapi.ts:565-567 |
| Mirror reconcile (one door to factor) | CSV/xlsx only. `diffMount` is pure, but gone is computed outside it | metrc.ts:648-688; writeMountWindow :1411-1499; gone :1450-1455; loadExistingByTags :872; loadLiveTags :889; goneStmts :980; runChunked :990; mountRowInsert :1343; mountMetrcRound :1514; mountMetrcExport :1571 |
| Shapers for 10 and 22 columns | Exist and take a getter, so API JSON can reuse them | shapePlantRow metrc.ts:502-517; shapePackageRow :539-566; METRC_PLANT_COLUMNS :46-57; METRC_PACKAGE_COLUMNS :60-83 |
| After a packages mount | closeLedgerForGoneTags (actorId string), landFfzFromMirror (string), releaseTestedFromMirror (string or null) | metrc.ts:1098, :1168, :1247; called :1541-1543, :1581-1583 |
| internal_field_values never touched | Only `setInternalField` writes it | metrc.ts:2221-2285 |
| A second mirror writer | Crew location moves update the mirror's location and changed_at ahead of Metrc | locations.ts:355, :397 |
| Licenses | 7 active from `lookup_values` category `license`; a second hardcoded copy in config | metrcapi.ts:512-515; config.ts:1099-1133 |
| app_config | Table, keys, reader and seed pattern exist | 0008:12-21; CONFIG_KEYS config.ts:403-548; getConfigValue db.ts:1747-1753; seeds `INSERT OR IGNORE` (0088) |
| PIN gate covers /admin/* | Yes | index.ts:577-585 (both trees) |
| i18n | DICT keyed by English; Metrc strings in place | i18n.ts:14, :2698-2713 |
| Not on the tree | API mirror pull, metrc_harvests, METRC_USER_KEYS, METRC_EVAL_ENABLED, host guard, cursors, evaluation runner, `metrc_mounts.source` | |
| Tests | 5 tests in test/metrcapi.test.ts. Untested: runMetrcSweep, readPaged, testMetrcConnection, scrubKeys, pageData, a blank Retry-After, a second 429. The smoke walks the page with keys absent only | test/metrcapi.test.ts:17, :53, :99, :117, :128; smoke :7452, :7457-7468 |

### 6. Design inputs for Phase B and C

**6.1 Law 1 factoring plan (one pure core, both doors)**

Mapping:
- Keep `shapePlantRow` and `shapePackageRow` unchanged. Add `apiGetter(obj, kind): Getter`, which returns each export header's value from the API JSON as a string (JSON booleans as "true"/"false", numbers via String, and a JSON null or a missing nested object as "", per the Mapping section's getter contract).
- API rows then run through the same `text`, `num`, `normalizeMetrcDate` (metrc.ts:431-440, ISO prefix to YYYY-MM-DD) and `normalizeMetrcBool` (:442-445).
- **The Law 2 mapping table lives only in the Mapping section:** Table 1 (plants), Table 2 (packages) and Table 3 (the proposed `metrc_harvests`). This section keeps no column table of its own. Where this section's earlier draft disagreed, the Mapping section's verified readings stand:
  - Unit Of Measure is RENAMED to `UnitOfMeasureAbbreviation`; the snapshot's uom holds only g and ea. Taking the Name would make every one of the 14,488 package rows differ under `same()`.
  - Harvested's candidates are HarvestedDate or HarvestId, never HarvestCount.
  - The Original Source Package Label pairing is UNRESOLVED.
  - Administrative Hold and Administrative Recall carry three candidates each.
  - Lab Test Status is RENAMED, with all 8 snapshot words found in GET /labtests/v2/states.
- The parity fixture settles each UNRESOLVED row of those tables.

- **The datetime risk.**
  - The docs' datetimes carry an offset (GET_packages_v2_active.txt:114 `"LastModified": "2026-10-08T09:45:03.3818493+00:00"`), and `normalizeMetrcDate` keeps the ISO prefix (metrc.ts:434-435).
  - A UTC timestamp after 20:00 Eastern therefore lands on the next calendar date.
  - That is exactly the door-to-door mismatch that 6.6 warns becomes a rewrite loop. A25 sets the rule until the parity fixture settles it (Mapping Table 2, rows 20 and 22).

New pure core in metrc.ts: `planMirrorPass({scope:{kind,license,phase}, incoming, existing, complete, sampleCap=25})` returns `{add, update, unchanged, gone, samples, labStateChanged}`.
- Add and update follow diffMount 659-680 exactly.
- `gone = complete ? live minus seen : []`, moved in from 1451-1452. An optional `passStartedAt` skips rows changed or first seen after the pass started. The seen set includes the tags from the matching onhold list (A10).
- **Mass-gone guard (A29).** `gone` is held (left empty) and the result carries `goneHeld` when either:
  - the pass's TotalRecords is 0 while the scope has live rows; or
  - the would-gone count exceeds `metrc_gone_hold_share` of live rows.

  The CSV door has already done this: 0-row plants exports marked 1,500 (GR-C-002600), 635 (AU-G-C-001509) and 580 (AU-G-C-000832) plants gone (snapshot metrc_mounts, rows_total 0). Whether those were real harvests or empty exports is unknown.
- Keep `diffMount` as a thin wrapper so test/metrc.test.ts:344-389 stay green.

I/O helpers:
- Export `loadExistingByTags`, `loadLiveTags` and `runChunked`.
- `mirrorPlanStmts` wraps plantInsertStmts, plantUpdateStmt, packageInsertStmts, packageUpdateStmt and goneStmts (metrc.ts:899-988) unchanged.
- `mountRowStmts({source:"file"|"api", filename, fileFormat, ...})` generalizes mountRowInsert (1343-1387).
- `writeMirrorPass` is the tail of writeMountWindow (1423, 1444-1497).
- `afterPackagesPass` covers 1541-1543 and 1581-1583. It runs close and FFZ only after a complete packages pass whose gone was not held, and runs release when `labStateChanged > 0`.
- `writeMountWindow` shrinks to about 15 lines. CSV behavior is unchanged: `complete = {live, seen: scan.seen}` on the last round only.

API door, `runMirrorSweep(env, trigger)`:
- A separate function with its own try/catch, modeled on metrcapi.ts:581-598.
- **Default (A28): its own cron string on env.grip**, for example `45 * * * *` added at wrangler.toml:56 (a shared file), routed in `scheduled` by `event.cron` as `*/5` already is (index.ts:4403-4404).
  - It then gets its own invocation's 1,000 D1 queries (D:24), CPU and 15 min wall (W:423).
  - A mirror failure never marks the lab sweep failed.
- **Fallback, if Dennis declines a third trigger:** call it last in the 15-past block, after `runInTestingSync` (index.ts:4408), inside its own catch, so it never delays In Testing. Its D1 cap then drops to 400 (about 100 calls), and the lab sweep's worst case must be capped (section 3).
- It runs its own paged reader. It never reuses `readPaged`, because of the silent 400-row cap.
- Plants and harvests are swept only for licenses whose `CanGrowPlants` is true in `metrc_facilities` (6.2); packages for all 7.
- Incremental passes use `complete = null`, so they never mark anything gone. Only a complete full pass marks gone: within license plus phase for plants, within license for packages, and only when the guard does not hold it.
- dry_run writes nothing to the mirror. It logs counts and up to 25 samples.
- write runs on the production host only: `mountRowStmts` with source "api", filename the endpoint path and fileFormat "json", then `writeMirrorPass`, then `afterPackagesPass`.
- The actor is null. That requires widening closeLedgerForGoneTags and landFfzFromMirror to `string | null`. Check that their target columns accept NULL.
- **Mounts (A30):** one API mount row per license, kind and phase per UTC day, reused by every tick that day, with its counts updated in place (metrc.ts:1456-1472).
  - Its insert logs are written once, at creation. The 4 count logs are written only when a full pass completes.
  - That is at most 19 mounts a day, so hourly passes do not push CSV mounts out of the pane's 40 newest (metrc.ts:1605-1615). The pane filters by source.
- **Harvests (0097, A19):**
  - The table is Mapping Table 3. Harvests carry the dates the mirror has lacked: canon 0.30.390 (CANON.md:748) records that METRC "keeps no harvest date on a package (a harvest carries its dates".
  - A harvest's state is the list it was last seen in: active, onhold or inactive. `/harvests/v2/onhold` is read only into a full pass's seen set (A10).
  - "Finished in the last 30 days" means an inactive row whose `"FinishedDate"` is within 30 days, falling back to `"ArchivedDate"` when FinishedDate is null. GET_harvests_v2_inactive.txt:96-97 shows `"FinishedDate": null` beside `"ArchivedDate": "2015-02-01"`. Whether such an archived but unfinished harvest belongs in the scope is P9.
  - Gone follows the one harvest gone rule, stated in Mapping Table 3: `gone_at` is set only when a complete active pass misses a harvest and no inactive or onhold read has seen it since the pass began. A move from active to inactive is a state change, and aging past 30 days is a view filter; neither is gone.
  - The inactive read is bounded by a lastModified window reaching at least 30 days back, if Metrc allows a window that wide (UNRESOLVED, P3). Otherwise it walks back in `metrc_window_max_minutes` chunks.

**6.2 Migration 0096: the cursor table and its companions**

`metrc_cursors` holds one row per host, license, endpoint and mode:

| Column | Type | Purpose |
|---|---|---|
| id | TEXT PK | |
| host | TEXT NOT NULL | metrcHost; sandbox and production cursors never mix |
| license_value | TEXT NOT NULL | |
| endpoint | TEXT NOT NULL | e.g. `/plants/v2/flowering` |
| mode | TEXT NOT NULL | dry_run or write; a dry_run cursor never moves a write cursor (A26) |
| kind | TEXT NOT NULL | plants, packages or harvests |
| phase | TEXT | vegetative or flowering for plants; null otherwise |
| hwm_end | TEXT | last completed lastModifiedEnd, ISO UTC Z; the next window starts at hwm_end minus 5 min |
| win_start, win_end | TEXT | the window in progress (resumed whole, never skipped) |
| win_page | INTEGER NOT NULL DEFAULT 0 | next pageNumber inside that window |
| full_pass_id | TEXT | the full pass in progress, null when none |
| full_started_at | TEXT | the pass's start; rows changed after it are never marked gone |
| full_page | INTEGER NOT NULL DEFAULT 0 | next pageNumber of the full pass |
| full_total_pages, full_total_records | INTEGER | TotalPages and TotalRecords as last read (expected vs received for Law 9) |
| full_rows_seen | INTEGER NOT NULL DEFAULT 0 | |
| full_completed_at | TEXT | last complete full pass |
| full_due_at | TEXT | next due, by cadence |
| gone_override | INTEGER NOT NULL DEFAULT 0 | 1 after Dennis confirms a held gone; the next complete pass marks gone without the guard, then resets it |
| last_status | TEXT | ok, refused, failed, budget, retry_after, window_too_wide, gone_held |
| last_http | INTEGER | |
| last_run_at | TEXT | |
| failures | INTEGER NOT NULL DEFAULT 0 | consecutive |
| created_at, created_by, updated_at, updated_by, deleted_at, deleted_by | | G-5 audit columns, actor null for machine rows |

The unique key is `(host, license_value, endpoint, mode)`.

Also in 0096:
- **`metrc_pass_pages(pass_id TEXT, page INTEGER, tags_json TEXT NOT NULL, PRIMARY KEY(pass_id, page))`** holds the cross-tick seen set as one row per page (50 tags of about 24 chars, about 1.2 KB).
  - That is about 1,965 rows written per weekly plants pass, against about 98,000 for one row per tag.
  - The rows are loaded once, at completion: about 2.4 MB, inside 128 MB.
  - They are deleted when the pass completes.
- **`metrc_facilities(host TEXT, license_value TEXT, license_type TEXT, reached INTEGER, can_grow_plants INTEGER, can_record_processing_jobs INTEGER, can_track_vegetative_plants INTEGER, checked_at TEXT, PRIMARY KEY(host, license_value))`** (A33).
  - Filled from `GET /facilities/v2/` by Test connection and once a UTC day by the sweep (30 license-less calls a month on the key-level budget).
  - **The one keep-list:** `License.Number` (GET_facilities_v2.txt:139, stored as license_value), `License.LicenseType` (:143), and inside `"FacilityType": {` (:34) the flags `"CanGrowPlants": false,` (:42), `"CanRecordProcessingJobs": false,` (:74) and `"CanTrackVegetativePlants": false,` (:50). Nothing else from the response is stored.
  - Never stored: `License.EmployeeLicenseNumber` (:140, a person's license number, G-9) and `FacilityId` (:21).
  - CanGrowPlants gates the plants and harvests sweeps (6.1); the flags choose which endpoints a license sweeps. CanTrackVegetativePlants appears only in the facilities examples (GET_facilities_v1.txt, GET_facilities_v2.txt); what it changes for `/plants/v2/vegetative` is not documented, UNRESOLVED.
- **`ALTER TABLE metrc_mounts ADD COLUMN source TEXT NOT NULL DEFAULT 'file'`**, which backfills the 70 existing mounts.
- **The app_config seeds of 6.3**, as `INSERT OR IGNORE` (the 0088 pattern), plus CONFIG_KEYS entries in config.ts (a shared file).

Rules:
- The high-water mark moves only after every page of a window is read, oldest window first (page_best-practices.txt:37).
- A tick that runs out of budget mid-window keeps the old mark and resumes at `win_page`.
- An empty write cursor runs a complete full pass for its scope first. That covers the first write tick, and the first tick after promotion from dry_run. The pass sets `hwm_end` to its own start time, and incrementals write only after it (A26).
- Within a full pass, dedupe by tag. Tags seen during the pass by an incremental read of the same license and phase count as seen, and so do tags on the matching onhold list.
- Stop the page loop on `Page >= TotalPages`, on `rows < pageSize`, or at a hard ceiling, and record an incomplete result. Never stop silently.
- A held gone (`gone_held`) marks nothing and skips `afterPackagesPass`. Dennis confirms on the Admin page (PIN), which sets `gone_override`.

0097 is `metrc_harvests`, per the brief, with the columns of Mapping Table 3 and the state and gone rules of 6.1.

0098 holds:
- `metrc_sweep_runs`: one row per sweep per license per endpoint, with host, mode, incremental or full, window, pages, rows, TotalRecords, calls, failures, would_add, would_update, would_gone, gone_held, status and message.
- `metrc_sweep_samples`: at most 25 rows per run, holding tag, column, mirror value and API value.
- `ALTER TABLE metrc_api_calls ADD COLUMN host TEXT`.
- `metrc_eval_runs`, the evaluation pack's store (the eval section, section 7, holds the design): one row per run with id, host, started_at, finished_at, steps_json TEXT capped at 1.5 MB after scrubbing (under D1's 2,000,000-byte row limit, D:27), status and the G-5 audit columns. Each CSV and the JSON are served as separate download links built from that row. No zip, no dependency.
- **Retention (A30).**
  - The sweep prunes metrc_api_calls, metrc_sweeps and metrc_sweep_runs older than `metrc_log_keep_days`, with samples going with their runs. It prunes in pages, never in one statement.
  - At about 1,614 calls a day, 90 days is about 145,000 metrc_api_calls rows. That covers the current month for "Calls this month" and for the pace.
  - The API mounts' change-log rows are audit rows and are not pruned.

**6.3 Conservative budget defaults (app_config, seeded by 0096, retunable in Admin Lookups)**

| Key | Default | Reasoning |
|---|---|---|
| metrc_sweep_mode | off | Law 7 |
| metrc_page_size | 50 | Docs maximum; the code clamps to 1..50 and always sends it |
| metrc_tick_calls | 60 | Mirror sweep, all licenses, per tick: 31 incrementals (a floor, section 3), 11 for the daily reconcile share and 18 plants pages. Before the month's pace, the weekly plants pass then finishes in 110 of 168 ticks (58 at live counts). It sits well under the mirror's own-invocation D1 cap (60 x 3 = 180 of 700 queries) |
| metrc_tick_license_calls | 20 | Rate limits are per facility and unpublished; no license takes the whole tick |
| metrc_tick_wall_ms | 240000 | 4 of the 15 cron minutes. Conservative even in its own invocation, and required if the fallback shares the 15-past invocation with the sheet sync, lab sweep and In Testing |
| metrc_tick_rows | 3000 | CPU proxy (60 pages x 50 rows); keeps reconcile CPU far under 30 s even if the hourly trigger gets only 30 s |
| metrc_month_calls | 45000 | A pace, not a stop (A17). It counts every metrc_api_calls row of the current host in the UTC calendar month, the lab sweep's included, because Metrc's quota covers Grip's whole account. Each tick's mirror budget is the smaller of metrc_tick_calls and (metrc_month_calls minus calls so far) / ticks left in the month. Incrementals and the daily reconciles come first; the weekly plants pass absorbs any shortfall (about 11.8 days at drop totals, 6.9 live). It never stops the lab sweep. 90% of the Standard figure, until Metrc names Grip's quota and its period |
| metrc_window_overlap_minutes | 5 | page_getting-started.txt:133 |
| metrc_window_max_minutes | 1440 | Catch-up chunk; halve and retry on a 400; the probe (P3) settles the real cap |
| metrc_full_packages_hours / metrc_full_harvests_hours / metrc_full_plants_hours | 24 / 24 / 168 | Law 5 and F-D (the plants gone lag, 168 hours plus the pass's own length, is weighed in 6.6) |
| metrc_harvest_finished_days | 30 | Law 5 |
| metrc_sample_cap | 25 | Law 7 |
| metrc_gone_hold_share | 0.5 | A29: a complete pass marks nothing gone until Dennis confirms when its would-gone exceeds half the scope's live rows, or when it reads 0 rows against live rows |
| metrc_log_keep_days | 90 | A30 retention |
| metrc_sweep_now_calls | 10 | Sweep now runs inline in the Admin POST (W:193, waitUntil only 30 s after a response; W:71, 30 s CPU per HTTP request by default) |

Two budget values stay code constants, not config. Law 5 puts budget constants in app_config, so this is assumption A27:
- the mirror sweep's D1 queries per tick: 700 of its own invocation's 1,000, or 400 under the shared-invocation fallback;
- the Retry-After cap of 10,000 ms.

A Retry-After above the cap, or a second 429, ends that license's work for the tick and saves the cursor.

**6.4 Host guard**

```ts
const SANDBOX_BASE_RE = /^https:\/\/sandbox-api-[a-z]{2}\.metrc\.com$/;
const PRODUCTION_BASE_RE = /^https:\/\/api-[a-z]{2}\.metrc\.com$/; // docs show only https://api-mi.metrc.com
```

- Test both regexes against `metrcBase(env)` (metrcapi.ts:102-112), never the raw var. `metrcBase` returns `url.origin`, which lowercases the host and drops any path; a non-default port fails the regex. Its fallback for a blank or non-https value is the sandbox, so a missing var stays safe.
- **Plug-in 1:** a new `metrcSend(method, ...)`, for E2 only. It refuses POST, PUT and DELETE unless `env.METRC_EVAL_ENABLED === "true"` (a new wrangler var) and `SANDBOX_BASE_RE` matches. `testingPostRequest` stays null and `METRC_WRITE_ENABLED` stays false.
- **Plug-in 2:** sweep mode resolution. `write` is refused in plain words unless `PRODUCTION_BASE_RE` matches; a sandbox host runs dry_run or nothing.
- **Plug-in 3:** the `/admin/metrc-eval` handler answers a plain "sandbox only" page unless `SANDBOX_BASE_RE` matches.
- **Plug-in 4 (A8):** `metrcGet` refuses to attach keys when neither regex matches, except for the test stub of A32.
- **Plug-in 5 (A34):** `callPath` (metrcapi.ts:130-133) drops every query parameter whose name contains "key" (case-insensitive) before the path reaches metrc_api_calls (:327, :354).
  - No code path calls `/sandbox/v2/integrator/setup`, whose example sends `?userKey=` (POST_sandbox_v2_integrator_setup.txt:16).
  - A test asserts that a `userKey` query never reaches a log row.
- **Test seam (A32).**
  - Unit tests inject `fetchImpl` (GetOpts already takes it, metrcapi.ts:320) and need no host exception.
  - The from-zero smoke (brief section 6, "fake keys against a stubbed host") runs under wrangler dev. There, `metrcBase` turns any non-https base into the real sandbox (metrcapi.ts:107), and Plug-in 4 would refuse a local stub.
  - Proposed: a var `METRC_STUB_BASE`, honored only when it is an `http://127.0.0.1` or `http://localhost` origin and `METRC_STUB_ENABLED === "1"`. Both are set only by the smoke's dev run and never in wrangler.toml.
  - A test asserts that env.grip's block carries neither, and Plug-in 2 refuses write on the stub.
  - The builder confirms the wrangler mechanism for passing them.

**6.5 Per-license key resolution**
- `userKeyFor(env, license)` returns `env.METRC_USER_KEY` trimmed, or null.
- Add a `userKey` option to `GetOpts`. Today `metrcGet` reads `env.METRC_USER_KEY` directly at :319.
- Per-license presence on the page reads "key present" or "absent" from the same function.
- Do not parse `METRC_USER_KEYS` (the docs answer Law 4; G-3). The seam allows a map later if `/facilities/v2/` ever shows a license the key cannot reach.
- Under A4, brief section 6's "per-license key selection and the fallback" test becomes: `userKeyFor` returns `METRC_USER_KEY` for every license, returns null when it is absent, and never reads `METRC_USER_KEYS`.
- Test connection per license (Phase B; Phase A's handshake is the one call that reports N):
  - Make one `GET /facilities/v2/` call (the trailing slash is UNRESOLVED, section 1, P11).
  - For each lookup license, show "reached" when `License.Number` matches (GET_facilities_v2.txt:139 `"Number": "403-X0001",`), else "not reached by this key".
  - Store the result and the keep-list fields in `metrc_facilities` (6.2).
- `scrubKeys` receives the integrator key, the user key and the base64 Basic token.

**6.6 Risks**
- **D1 daily write limit on Free.** The plan on record is Paid, so there is no daily cap. If the account were ever on Free:
  - One first pull is 450,454 rows at the insert factors, and one full rewrite is 340,776 at the update factors. Either trips 7500 "exceeded D1's free tier daily row write limit" and freezes writes until 00:00 UTC (canon 0.30.54).
  - A mapping mismatch between the CSV and API doors would make each door rewrite the rows the other wrote, on every pass. That is the full-rewrite case on a loop. It also churns `changed_at`, which FM1's "METRC as of" reads (floormetrc.ts:667).
  - Mitigation: dry_run parity first (Law 7 and Law 9). The parity fixture must prove identical strings per column, the datetime columns included (A25).
- **CPU per cron invocation.**
  - Paid gives 15 min to an hourly trigger and 30 s to one under an hour (W:72). Which applies while the `*/5` trigger is present is UNRESOLVED.
  - Free gives 10 ms to HTTP and cron alike (W:71, W:72). It produced Error 1102 here on an HTTP mount (canon 0.30.42).
  - Wall time is 15 min per invocation (W:423). In its own invocation the mirror sweep runs alone; under the fallback it shares with three other jobs. The rows and wall budgets bound it.
  - Sweep now cannot lean on waitUntil past 30 s.
- **D1 queries in a shared invocation.** The lab sweep can issue 560 call-log inserts in its worst case before any results calls (section 3). A mirror sweep sharing the 15-past invocation therefore cannot rely on a fixed reserve. Its own cron string (A28) removes the problem.
- **Rate limits per facility.**
  - The numbers are unpublished. The license-less calls (facilities, the transfer delivery children and the license-less lookups of section 1) share one key-level budget.
  - Retry-After may be absent; today that means a 0 ms retry.
  - Mitigation: a per-license cap per tick, stopping a license on its second 429, and tuning from the 429 counts in metrc_api_calls.
- **Metrc monthly quota.**
  - The brief's cadence is about 48,400 calls a month at P = 50, right under the Standard figure. A stop at 45,000 would stall the mirror from about day 28, so `metrc_month_calls` paces instead (A17).
  - Any added endpoint pushes the month up: inactive packages hourly would add 5,040 calls, inactive plants 4,320.
  - Sharing the lab sweep's active read would save 5,040 (A31).
- **F-D gone lag.** Under F-D a harvested plant leaves `/flowering` and never appears in an incremental read. It stays live in the mirror until a later weekly full pass completes.
  - That is up to the 7-day cadence plus the length of the pass itself (section 3, at the default budget of 60: 58 ticks at live counts, 110 at drop totals), and longer under the month pace (the plants pass stretches to about 11.8 days at drop totals).
  - Today's CSV door marks plants gone every 1 to 5 days: the snapshot's plants drops with gone marks fall on 09-20, 09-22, 09-24, 09-29, 10-01, 10-02, 10-05, 10-06 and 10-08, each marking 1,999 to 14,888 plants gone (db_backups/20261008-184520_pre_r5, metrc_mounts).
  - The documented alternative is reading `/plants/v2/inactive` hourly as gone evidence, about 4,320 calls a month (6 grow licenses x 720 ticks). That is a MIRROR LAW change for the Scribe (A12), not a build default.
- **A full reconcile may need a filter.** If an unfiltered paged list is refused, the fallback is per kind (A11):
  - plants go to the weekly CSV drop;
  - packages keep the CSV drop as their gone door;
  - harvests walk lastModified windows, bounded by a possible Standard-plan history limit (UNRESOLVED).
- **Page drift.** The sort order and stability of pages are undocumented, so rows can be skipped or repeated across ticks (P8). Gone is marked only after a clean, complete pass, and the passStartedAt guard protects rows changed during the pass.
- **Mass gone.**
  - A complete pass that reads 0 rows, or far fewer than live, would mark the whole scope gone. Causes include a permissions change, a refused license, a sandbox license or a glitch at Metrc.
  - For packages it would also close ledger items, and "nothing reopens by itself" (0.30.128).
  - The CSV door already marked 1,500, 635 and 580 plants gone from 0-row exports. The guard (A29) holds such a pass.
- **On-hold rows.** If the API lists leave held rows out, a complete pass marks them gone. Reading the onhold lists into the seen set (A10) covers this until Metrc answers.
- **Silent truncation.** `readPaged` truncates silently at 400 rows. Any reuse for a reconcile would mark every row past 400 gone.
- **Sandbox data on the live database.** env.grip carries the sandbox base (wrangler.toml:49). With both secrets set:
  - The live lab sweep reads the sandbox hourly and may fill blank desk columns if labels collide.
  - If the sandbox lacks Grip's licenses, it records "failed" with "Metrc refused the keys." every hour (A6).
  - metrc_api_calls has no host column, so "Calls this month" mixes hosts.
- **Keys in log rows.** `callPath` logs path plus query on every attempt, so a key in a query string would land in metrc_api_calls (Plug-in 5).
- **Change-log growth.** One API mount per changed pass would add about 268,000 change-log rows a month to a table of about 806,000 whose unpaged read already hit 7500 (canon 0.30.353). One mount per license, kind and phase per UTC day (A30) keeps it to about 19 mounts a day.
- **Sandbox origin.**
  - POST_sandbox_v2_packages_create.txt:36, POST_sandbox_v2_facility_tags.txt:14 and GET_sandbox_v2_tagtypes.txt:10 list a 401 "Request origin is not permitted". The setup endpoint lists none.
  - One of the three is a GET, so E1 reads may be refused too.
  - Whether Cloudflare egress is refused is UNRESOLVED (P10).
- **Key expiry.** Connect keys carry an expiration date (keys_guide.txt:17). What an expired key returns is UNRESOLVED, and the Admin page cannot see the date.
- **Parity noise.**
  - A dry_run on a sandbox host compares sandbox rows with the live mirror.
  - Crew location moves write the mirror ahead of Metrc (locations.ts:355, :397).
  - The Parity pane reads production-host runs only. It labels a location difference as a crew move when the tag's `changed_at` is later than the `created_at` of its `mount_id`.
- **Possible export cap.** The 1509 flowering export was exactly 10,000 rows (canon 0.30.42). Parity will show whether the CSV door was truncating.

### 7. Migration numbering

- Both trees have 95 `.sql` files, with head `0095_manual_hbn_phantom_order.sql` (taken by H1, canon 0.30.420).
- No brief in `BRIEFS/`, `branches/GFLiteOpsDashboard/BRIEFS/` or `branches/GFLiteMetrcAPI/BRIEFS/` references 0096 or above (grep, rechecked by this pass).
- CANON.md, _NOW.md and MEMORY.md reserve none.
- Open slices take no migration:
  - R5: sealed, no migration. Its files are on main's disk since 17:58:17, the Version ID awaited.
  - The 26062 investigation: read only, in the investigator's own clone.
- **0096 to 0098 are free.** Proposed:
  - 0096: cursors (with mode), pass pages, facilities, `metrc_mounts.source`, app_config seeds.
  - 0097: `metrc_harvests`.
  - 0098: sweep runs and samples, `metrc_api_calls.host`, `metrc_eval_runs`.
- Name them relatively in the brief, "the next three free numbers after 0095", per canon 0.30.188 and MEMORY:214. Renumber if another slice lands first.
- smoke.mjs:443 moves from 95 to 98.

### 8. Assumptions for Dennis's word

- **A1.** The paste is taken as the dispatch with fork defaults (F-A to F-F), since MA1 is not in canon yet: there is no row, it is not ratified under 0.30.155, and "Acolyte" is not a canon role. The Scribe logs the ruling verbatim before the build starts.
- **A2.** MA1 builds in `branches/GFLiteMetrcAPI` (branch GFLiteMetrcAPI), never in `branches/GFLiteOpsDashboard`. The worktree was cut from main after R5's files landed: created 2026-10-08 18:10:45, tree 3f067013cbb9f39e at the cut (LF recipe, 309 files, identical to main), `npm ci` done. Dennis confirms that the base commit carries R5, and hands the pre_r5 deploy Version ID to the Scribe (canon 0.30.429 records none).
  - The .git log files, read without running git, point that way: main's merge of GFLiteOpsDashboard at 17:58:16 (e98a138), pushed at 17:58:19, and the branch "Created from main" at e98a138 at 18:10:45.
- **A3.** Every paged call sends pageSize=50 explicitly and never relies on a default, until a sandbox probe (P1: no pageSize, 20, 50, 51) settles the conflict.
- **A4.** The single `METRC_USER_KEY` is the path for every license, since the docs show the key belongs to the user. `METRC_USER_KEYS` is not built unless Test connection shows a lookup license missing from `/facilities/v2/`.
- **A5.** The sandbox handshake uses one sandbox user key, from the setup call or from a paired licensee key. In the sandbox, the sweep and the runner use the license numbers `/facilities/v2/` returns rather than the 7 lookup licenses, since the MI sandbox may expose only generic facilities (thread:21 reads the setup call as building "a generic set of sandbox facilities").
- **A6.** The sandbox keys go on env.grip (the only env with a cron, wrangler.toml:55-56), as canon 0.30.185 wrote the commands, for one Test connection. Then `METRC_USER_KEY` is deleted until Phase B's sandbox guard (A7) is merged and deployed. The integrator key alone is harmless and may stay: with the user key absent, the sweep records "skipped" without a call (metrcapi.ts:498-505) and Test connection reads absent without a call (:605). The wrangler commands carry `--config` with main's wrangler.toml so they run from any folder (section 9).
  - With both keys set, the live cron's lab sweep calls the sandbox hourly: 14 calls a tick when every license answers one page per path, 7 if every license is refused, and up to 560 plus results.
  - If the sandbox lacks Grip's licenses, every hour records "failed" with "Metrc refused the keys." (metrcapi.ts:531-534, :568-574), even while Test connection reads "Connected. N facilities."
  - Alternatives: keep both keys and accept that line hourly; or take canon 0.30.168's "sandbox keys as wrangler secrets in a sandbox-facing env ... the production pair later under env.grip alone" (CANON.md:526), which needs a new env and database.
- **A7.** The lab sweep stays as it is except for one guard: on a sandbox host it writes nothing to test_samples or test_orders. This bends Law 5's "preserved exactly" to honor Law 3.
- **A8.** GET calls go only to hosts matching the sandbox regex or `^https://api-[a-z]{2}\.metrc\.com$`. This narrows Law 3's "whichever host METRC_API_BASE names" so the keys never reach an arbitrary origin.
- **A9.** The blank Retry-After bug is fixed in the shared `retryAfterMs` to wait 1,000 ms, as the code comment and 0.30.185 assumption 6 intend. A second 429, or a wait above 10 s, ends that license's tick and saves the cursor instead of aborting every license. `metrcGet` is shared with the lab sweep (via readPaged, metrcapi.ts:526, :549), so this also bends Law 5's "preserved exactly", as A7 does.
- **A10.** Plants reconcile from `/plants/v2/vegetative` and `/plants/v2/flowering`.
  - Until Metrc states the overlap, a complete plants, packages or harvests full pass also reads that kind's onhold list and counts its tags as seen. The three onhold lists carry the mark "MIRROR (full-pass seen set only)". For plants, a tag counts within the phase its `"GrowthPhase"` names (GET_plants_v2_flowering.txt:40). This costs about 420 calls a month.
  - Mother lists are not read.
  - Gone is marked by absence after a complete pass, as the CSV door does.
- **A11.** A full reconcile is attempted as an unfiltered paged list. If Metrc refuses it, the fallback is per kind:
  - plants fall back to the weekly CSV drop (F-D's alternative);
  - packages keep the CSV drop as their gone door, since only a complete pass may fire closeLedgerForGoneTags and FFZ, while API incrementals still update in place;
  - harvests walk lastModified windows as far back as Metrc allows, and no harvest is marked gone until a walk completes.
- **A12.** Gone stays absence-only (THE MIRROR LAW). Positive evidence from `/packages/v2/inactive`, or from `/plants/v2/inactive` read hourly (6.6, F-D gone lag), is left to a later law change by the Scribe.
  - `/packages/v2/inactive` is never read as incoming rows. diffMount treats a gone row that comes back as moved (metrc.ts:667) and packageUpdateStmt clears `gone_at` (:971-972), so finished and discontinued packages would return as live (Mapping section, Table 2's note). This folds in the Mapping section's former A6.
- **A13.** The full-pass seen set is stored as one row per page (tags as JSON) in a 0096 table and deleted when the pass completes.
- **A14.** `metrc_mounts.source` is added in 0096 with default 'file'.
- **A15.** The API door writes with actor null. `closeLedgerForGoneTags` and `landFfzFromMirror` are widened to `string | null`, and the change-log reason names the sweep (the word owed since 0.30.194).
- **A16.** The budget defaults of 6.3 are seeded by 0096 and declared in CONFIG_KEYS.
- **A17.** `metrc_month_calls` = 45,000 is a pace over every call of the current host in the UTC calendar month. It assumes the Standard plan's under-50,000 figure applies to Grip until Metrc's reply names the real quota and its period. It slows the weekly plants pass first and never stops the lab sweep.
- **A18.** `metrc_api_calls` gains a host column in 0098, and "Calls this month" counts the current host only.
- **A19.** Harvests read `/harvests/v2/active` and `/harvests/v2/inactive` by lastModified, and `/harvests/v2/onhold` into a full pass's seen set (A10).
  - State is the list a harvest was last seen in: active, onhold or inactive.
  - "Finished in the last 30 days" means an inactive row whose `"FinishedDate"` (GET_harvests_v2_inactive.txt:64) is within 30 days, falling back to `"ArchivedDate"` when FinishedDate is null (:96-97). Whether an archived but unfinished harvest belongs in that scope is P9.
  - Gone follows the one harvest gone rule in Mapping Table 3 (6.1). A move from active to inactive is a state change, and aging past 30 days is a view filter; neither is gone.
  - The 12-call daily reconcile is a floor.
- **A20.** Sweep now runs inline in the Admin POST with a 10-call budget, because waitUntil extends only 30 s past a response.
- **A21.** The plan on record is Workers Paid (CANON.md:415, MEMORY.md:9). MEMORY.md:87's "Workers Free" is treated as stale history.
- **A22.** Per-license Test connection is one `/facilities/v2/` call matched on `License.Number`, not one call per license. Phase A's handshake is that one call reporting N; the per-license match is built in Phase B (6.5).
- **A23.** The help path wording stays "Admin\Data Lookups\<Category>\<Field>" after brief A1's regroup into Admin Settings (CANON.md:776, 0.30.418), since no ruling changed it.
- **A24.** Date-only API fields (PackagedDate, ExpirationDate) stay plain YYYY-MM-DD strings through `normalizeMetrcDate`. Their time zone (UNRESOLVED in the docs) is not converted.
- **A25.** Datetime API fields (ReceivedDateTime, LabTestResultExpirationDateTime) are converted to the America/New_York calendar date before `normalizeMetrcDate`, matching the floor's Eastern stamps, unless the parity fixture shows the export prints the UTC date.
- **A26.** Cursors are kept per mode. A dry_run never advances a write cursor. An empty write cursor, including the first after promotion, runs a complete full pass for its scope before any incremental writes.
- **A27.** Two budget values stay code constants despite Law 5's app_config rule: the mirror's D1 query cap (700 in its own invocation, 400 under the fallback) and the 10,000 ms Retry-After cap.
- **A28.** The mirror sweep gets its own hourly cron string on env.grip, for example `45 * * * *`: a one-line edit to the shared wrangler.toml plus a branch in `scheduled`. If Dennis declines, it runs last in the 15-past block, after runInTestingSync.
- **A29.** A complete pass marks nothing gone, and skips `afterPackagesPass`, until Dennis confirms on the Admin page, when either it reads 0 rows against live rows or its would-gone exceeds `metrc_gone_hold_share` (0.5) of live rows.
- **A30.** The API door writes one mount row per license, kind and phase per UTC day. It logs the insert once, and writes its 4 count logs only on a completed full pass. metrc_api_calls, metrc_sweeps and metrc_sweep_runs are pruned after `metrc_log_keep_days` (90), in pages.
- **A31.** The lab sweep's packages-active read is not shared with the mirror's incremental in MA1 (Law 5). Sharing is the first saving (5,040 calls a month) if the quota binds.
- **A32.** The smoke reaches a local stub only through `METRC_STUB_BASE` together with `METRC_STUB_ENABLED`. Both are absent from wrangler.toml, and the stub is refused on any non-local origin.
- **A33.** The facility keep-list of 6.2 (License.Number, License.LicenseType, CanGrowPlants, CanRecordProcessingJobs, CanTrackVegetativePlants) and per-license reach are stored in `metrc_facilities` (0096), refreshed by Test connection and once a UTC day by the sweep. `License.EmployeeLicenseNumber` and `FacilityId` are never stored.
- **A34.** `callPath` drops any key-bearing query parameter before logging, and no code path calls the sandbox setup endpoint.

### 9. What Dennis's hands must do

1. Rule the forks, or say "defaults", on the question tool: A1 to A34 here, A35 to A38 in the Mapping section, the default of correction 15, the eval section's Q14 and Q15 (his word, not Metrc's), and the nine 0.30.185 assumptions still owed his word (CANON.md:543; no later row rules them). The Scribe then logs MA1 in canon before dispatch (0.30.155).
2. Confirm that the worktree's base commit carries R5, and finish the pre_r5 merge block.
   - The .git log files, read without running git, show main's merge of GFLiteOpsDashboard at 2026-10-08 17:58:16 (06595c0 to e98a138), its push at 17:58:19, and branch GFLiteMetrcAPI "Created from main" at e98a138 at 18:10:45.
   - The block's pre snapshot exists: db_backups/20261008-184520_pre_r5 (dumped 22:45:38Z).
   - Canon 0.30.429 records no Version ID. Deploy if that has not run, then hand the Version ID to the Scribe.
3. The worktree already exists; there is nothing to create or install. `branches/GFLiteMetrcAPI`, branch GFLiteMetrcAPI, was created 2026-10-08 18:10:45 with tree 3f067013cbb9f39e (LF recipe, 309 files), identical to main, and `npm ci` was done there (node_modules present). From about 19:13 a session was writing in it (Conventions).
4. Get the sandbox keys.
   - The sandbox integrator key, per the keys guide (`RESEARCH/metrc_connect/Metrc_Connect_-_How_to_Generate_keys_in_Connect.docx`): in Metrc Connect, go to Keys, then Generate Key, and give a name, the Deployment (the Michigan Sandbox; this is a separate key from any production key) and an expiration date.
   - On that screen, confirm that a Michigan Sandbox deployment is listed, since the mail's state list did not survive (thread:11).
   - The sandbox user key, by one of two routes (thread:21, canon 0.30.168):
     - Route 1, the setup call `POST /sandbox/v2/integrator/setup` (endpoints/POST_sandbox_v2_integrator_setup.txt:3). The docs say the new sandbox user's key "will be sent to the contact email on file". Its authentication is not in the docs: Metrc's mail, as the note records it, says to use an `x-metrc-key` header carrying the vendor key from Connect (thread:11, :21). Run it from a tool like Postman, never from the app.
     - Route 2: ask api-info to pair a licensee Sandbox Industry User Key.
   - Either way, the result is one user key for the sandbox, not one per license.
5. Set the two secrets on env.grip. Each command names main's wrangler.toml with `--config`, so it runs from any folder (run outside `app/` without it, wrangler stops with "Required Worker name missing"; wrangler 4.127.0's global `--config` is "Path to Wrangler configuration file"). Wrangler prompts for each value; type or paste it at that terminal prompt only, never into chat or a file. Do not create `METRC_USER_KEYS`.

```bash
npx wrangler secret put METRC_INTEGRATOR_KEY --env grip --config "C:/Users/DennisWallace/Documents/Claude/Projects/gripfactory Practical/app/wrangler.toml"
```

```bash
npx wrangler secret put METRC_USER_KEY --env grip --config "C:/Users/DennisWallace/Documents/Claude/Projects/gripfactory Practical/app/wrangler.toml"
```

```bash
npx wrangler secret list --env grip --config "C:/Users/DennisWallace/Documents/Claude/Projects/gripfactory Practical/app/wrangler.toml"
```

   Hand the Scribe the lines wrangler prints after each put (a new Version ID, if any, per MEMORY:210), after checking they hold no key value. The list command should show METRC_INTEGRATOR_KEY and METRC_USER_KEY among the names, and no values.

6. Run the Test connection: Admin, Data Connections, METRC API (`/admin/metrc-api`, behind the Admin PIN), then press Test connection. Report only the flash words: "Connected. N facilities.", "Metrc refused the keys." or "Metrc did not answer." Then, by A6's default, delete the user key until Phase B's sandbox guard (A7) is merged and deployed. The integrator key may stay.

```bash
npx wrangler secret delete METRC_USER_KEY --env grip --config "C:/Users/DennisWallace/Documents/Claude/Projects/gripfactory Practical/app/wrangler.toml"
```

   If Dennis rules A6 the other way and keeps both keys, the Admin page's Last sweep will read "failed" with "Metrc refused the keys." every hour while the sandbox lacks Grip's licenses. That is expected, not a fault.

7. Send Metrc one email with these questions. This is the one merged list: this section's questions plus the evaluation section's open questions for Metrc (eval Q numbers in brackets); the eval section keeps its Q list and points here. The reply decides F-A and several UNRESOLVED items. Put no keys and no personnel in the email.
   - Which evaluation (F-A): Grow plus Processor, GET only, and what a GET-only evaluation covers (eval Q1). Three readings fit the workbook:
     - (a) every tab, GET steps only (the brief's F-A note);
     - (b) every step of every tab, writes included, from Permissions B45 "Request a GET only Evaluation - You will be required to complete all sections of all tabs";
     - (c) by each tab's own header, tabs 20, 21 and 22 only. Locations C1, Strains C1, Items C1, Closed Loop States PlantBatches C1, PlantBatches C1, Plants B1, Harvest C1, Packages C1 and LabResults C1 each make the tab required only "if you have requested POST/PUT/DELETE access". GET Transfers and Wholesale C1 asks for "GET access for Transfers And Wholesale", and Transfer Templates C1 and Transfer External Incoming C1 for "GET\POST\PUT|DELETE access for Transfers". That is 16 steps: 9 GET (T1 to T6, TT2, TT3, X2) and 7 writes, all on the two transfer tabs (TT1a, TT1b, TT4, X1a, X1b, X3, X4). If tabs 21 and 22 are optional (eval Q16 below), it is tab 20 alone: 6 GET steps and no writes. Reading (c) conflicts with Permissions B45.
   - Grip's Connect plan, its monthly call quota, and the quota's period (calendar month or billing cycle).
   - Per-facility and per-key rate limits, and which key "an API key basis" means.
   - Which header of a 429 carries "the time window" (page_whats-new-in-v2.txt:9: "429 (Too many requests) will be returned with the time window in the header of the message"), and whether it is the Retry-After header that :13 says comes only "In certain cases".
   - The maximum lastModified window, whether an unfiltered v2 list call is allowed, and the Standard plan's history (lookback) limit (RESEARCH/2026-09-21_metrc_api_lab_testing.md:9, :50).
   - What an unpaged call returns, whether a pageSize above 50 is rejected or clamped, and the sort order of pages and whether they stay stable while rows change.
   - Whether on-hold plants, packages and harvests also appear in the active, vegetative, flowering and harvests-active lists.
   - The time zone of date-only fields and of datetime fields (ReceivedDateTime, LabTestResultExpirationDateTime), compared with the CSV export.
   - Whether the MI sandbox carries Grip's licenses or only generic sandbox facilities, and whether a licensee Sandbox Industry User Key can be paired instead. Which sandbox facilities Metrc directs the runner to (Instructions B20: "You should only modify data in the facilities that we direct you to"), and whether one of them can be the TT1 recipient (eval Q17).
   - How the setup call authenticates (the mail's `x-metrc-key` header is not in the docs).
   - What the sandbox 401 "Request origin is not permitted" means for Cloudflare Workers egress, sandbox GETs included.
   - Whether webhooks are in Grip's tier.
   - Whether "All sections marked with a "D" MUST be completed per Facility" (Permissions E19) means each sandbox facility, each license or each facility type (eval Q2).
   - The date range the closed-loop writes accept: "A date parameter WILL be needed for these calls. You may need to contact api support for a date range" (Closed Loop Environment B19) (eval Q4).
   - Whether a GET step may read an existing record in place of the one its tab's writes create: Locations A13 (path A15), Strains A13 (path A15), Items A13 (path A15), Transfer Templates A13 (path A15) and Transfer External Incoming A13 (path A15). Transfer Templates A17 (path A19) reads any template (eval Q6).
   - What "the plants split in Step 2" (Closed Loop States PlantBatches A18, path A20) and "the batch that was split" (A22, path A24) refer to, since Step 2 (A10, path A12) packages clones and splits nothing (eval Q7).
   - The Plants Step 6 shortfall (the eval's step P6, not probe P6): Plants A26 (path A28) harvests "the 2 remaining Plants", but Closed Loop States PlantBatches A18 (path A20) moves 2 plants to flowering and Plants A18 (path A20) destroys one, so 1 remains. May Closed Loop States PlantBatches Step 4 move 3 plants, or may Plants Step 6 use other plants (eval Q8)?
   - Confirm the documented v2 paths the runner sends where the workbook's differ (eval Q9):
     - GET Transfers and Wholesale A21 (path A23) and A25 (path A27) write `/transfers/v2/delivery/{id}/packages` and `.../packages/wholesale`; the docs have `/transfers/v2/deliveries/{id}/packages` and `/transfers/v2/deliveries/{id}/packages/wholesale` (_INDEX.txt:400-401).
     - Transfer Templates A13 (path A15 reads only "GE"; A29 `GET /transfers/v2/templates`) and A17 (path A19 `GET /transfers/v2/templates/{id}/deliveries`); the docs have `/transfers/v2/templates/outgoing` and `/transfers/v2/templates/outgoing/{id}/deliveries` (_INDEX.txt:404-405).
     - Items A13 (path A15 `GET/Items/v2/{id}`); the docs have lowercase `/items/v2/{id}` (_INDEX.txt:40).
   - GET Transfers and Wholesale A17 (path A19) says "Find a Transfer by the Manifest ID number", while the docs say "The {id} parameter above represents a Transfer Id." (GET_transfers_v2_id_deliveries.txt:3). The runner records both; is that what Metrc checks (eval Q10)?
   - The "Last Modified Date" column (E4 on the step tabs): the run date, as Instructions B15 says ("the date in which the test or actions were ran"), or the record's LastModified? The pack fills the run date and keeps LastModified in the JSON (eval Q11).
   - CompanyInformation B22 "Vendor Key Used" and B23 "User Key Used" (value cells C22 and C23): the key names or the key strings? Law 4 forbids key strings in any file; Dennis fills the cells by hand (eval Q12).
   - Whether the sandbox reset cadence leaves time between the E2 writes and submission (eval Q13). The keys survive a reset (thread:11). What the premium "Dedicated Sandbox" (RESEARCH/2026-09-21_metrc_api_lab_testing.md:9) changes for resets and for generic facilities is UNRESOLVED.
   - Whether tabs 21 and 22 are optional (Permissions E32 and F32 "O"; A37:B37 and A39:B39 "with Transfer Templates as an option") or required (their own C1) once GET Transfers is requested (Permissions E31 and F31 "D") (eval Q16).
   - Under reading (b), whether tab 10 (PlantBatches, the "thin air" route of Closed Loop Environment B16) counts for MI, given that it is the alternative to tab 9 (eval Q19).
   - The TT1 and X1 bodies (eval Q20). The docs examples carry transporter, driver, vehicle and estimated-time fields and mark no body field required (POST_transfers_v2_templates_outgoing.txt:34-65; POST_transfers_v2_external_incoming.txt:41-42, :45-73). Which are required? Must `TransporterFacilityLicenseNumber` (templates :39) be a facility in the sandbox? On X1, is the recipient the license in the query (the example sends `?licenseNumber=123-ABC` with `"ShipperLicenseNumber": "123-ABC"` and `"RecipientLicenseNumber": "123-XYZ"`, :16, :18, :37), and what goes in the shipper fields?
8. Paste the dispatch into a Code session opened in `branches/GFLiteMetrcAPI` after the Scribe's canon row lands (one agent per worktree). A session was already writing in W from about 19:13 on 2026-10-08 (Conventions), so no second session opens there while it holds the worktree.

### Consolidation notes

1. Phase reached block added at the top: ground complete, handshake pending one Test connection reporting N, per-license reach built in Phase B, no gates and no merge block (D7; critic 1).
2. 6.1's column table dropped. 6.1 now points to the Mapping section's Tables 1 to 3 and names the readings that stand (UnitOfMeasureAbbreviation; HarvestedDate or HarvestId; Original Source Package Label UNRESOLVED; three hold and recall candidates; Lab Test Status RENAMED). The getter's null rule was added to match the Mapping contract (D2; critic 2).
3. One assumption namespace. A1 to A34 kept; step 1 names A35 to A38 in the Mapping section; the Mapping section's former A6 is folded into A12 and its former A2 into correction 15, which now carries that default for Dennis's word. Probes are cited as P1 to P14 and P0 (D1; critic 3).
4. The three onhold lists are marked "MIRROR (full-pass seen set only)" in the coverage table and A10; the 420 calls a month stand (D3; critic 7).
5. Harvests: state set active, onhold, inactive; the 30-day scope falls back to ArchivedDate (GET_harvests_v2_inactive.txt:96-97, re-read); the one gone rule is referenced to Mapping Table 3 in its words; A19 amended with P9; canon 0.30.390 (CANON.md:748) cited in 6.1 (D4; critic 6, 20).
6. Licenses: the six grow licenses are gated by CanGrowPlants from P0 and the processor AU-P-000694 sweeps packages only; 12 pairs, 12 harvest calls, 973 and 1,965 unchanged (D5; critic 15).
7. Retry-After restated in correction 7: blank or missing 0 ms, HTTP-date or text 1 s, a number capped at 10 s (metrcapi.ts:136-140 and test :50, re-read) (D6; critic 4).
8. Stale hand-back replaced: W added to Conventions, A2 restated, section 9 steps 2 and 3 rewritten (no worktree creation), and the newer snapshot cited in Phase reached, section 3 and correction 23. Its figures were re-profiled: 392 skipped sweeps, 0 calls, 48,168 and 13,045 live (D10; critic 5). New in this pass: the .git log files (read only) give the merge commit e98a138 at 17:58:16 and its push at 17:58:19, and W began changing at about 19:13 (src/metrcapi.ts, config.ts, i18n.ts, smoke.mjs, a new 0096), so W no longer matches the cut. Code line numbers stay on M and B.
9. Subsection 4b added with the critic's baseline table; this pass re-hashed all 30 cells and every one matches (D11; critic 10).
10. Start-only filter evidence (page_getting-started.txt:117, :123, matching :133) added to section 1 as illustrative, not proof (D12; critic 12).
11. F-D gone lag added to 6.6 and pointed to from 6.3 and A12, with the drop dates re-read from the pre_r5 snapshot and 4,320 = 6 x 720 (D13; critic 13). The ruling's "up to 7 days" is refined to "up to the 7-day cadence plus the pass's own length (58 or 110 ticks at the default budget)", because a plant harvested just after its page is read stays live until the next pass completes.
12. Marks: both inactive lists "NOT USED (candidate gone evidence, A12)"; the lab sweep's reads "NOT USED by MA1 (lab sweep, preserved)"; "31 calls per tick" is a floor in section 3 and 6.3 (D14; critic 14, 25).
13. Correction 5 names the 11,742 as the 2026-09-14 drop of AU-G-C-000832's active packages (CANON.md:415, with the total at _NOW.md:14) (D14; critic 16).
14. Helpful Resources: the 302 to getting-started replaces "needs a re-fetch" in section 1 and correction 19 (wf/critic/dl/h.txt read) (D14; critic 17).
15. Sources not read (the Postman collection, GET /employees/v2/permissions with its G-9 caveat, the Dedicated Sandbox) listed as UNRESOLVED, each line re-read (D14; critic 18).
16. One facility keep-list in 6.2 and A33, with EmployeeLicenseNumber (:140) and FacilityId (:21) never stored; CanTrackVegetativePlants (:50) is documented only in examples (D14; critic 19).
17. Correction 6 softened to "ambiguous with the plants and packages mirror" (0069:4-5); the missing null guard at metrcapi.ts:473 stands (D14; critic 21).
18. Section 9 step 7 is the one merged email list: the 11 questions plus eval Q1, Q2, Q4, Q6 to Q13, Q16, Q17, Q19, Q20 and the 429 time-window header question (D15; critic 8, 9). Workbook cells are cited as "Tab A13 (path A15)" and were re-read from wf/workbook (D14; critic 22). Reading (c) counts 16 steps, 9 GET (T1 to T6, TT2, TT3, X2) and 7 transfer-tab writes, from the workbook rows, as the eval section's final does; the "about 12 GET steps" of D8 would include L3, S3 and I3, whose tabs are write-only by their C1.
19. A6 restated (user key deleted until A7 is merged and deployed; the integrator key may stay, metrcapi.ts:498-505, :605). Every wrangler command carries `--config` with main's wrangler.toml; the global flag and the "Required Worker name missing" error were found in main's node_modules wrangler 4.127.0 (D16).
20. 0098 gains `metrc_eval_runs` in 6.2 and section 7, under D1's 2 MB row limit (D:27) (D9; critic 11).
21. The prior pass's "Verification notes" block (50 items, all fixed or kept) is dropped as these rulings require.
22. FIXED (cross-check): correction 5's quote "AU-G-C-000832 packages 11,742" moved to CANON.md:415, where it stands; _NOW.md:14, re-read, names no license and gives only the total "97,936 plants, 11,742 packages". Note 13 now reads "(CANON.md:415, with the total at _NOW.md:14)". D14 cites both lines, so the pair stays.
23. FIXED (cross-check): the 6.3 row for metrc_full_plants_hours no longer calls the plants gone lag 168 hours. It reads "168 hours plus the pass's own length", matching 6.6 and note 11.
24. FIXED (cross-check): section 9 step 1 now puts the eval section's Q14 and Q15 to Dennis. eval_steps.md:446 calls both his word, and Q15 (:463) ends "Dennis confirms the list"; D15's email list leaves both out, so step 1 was the only place left for Q15.
25. FIXED (cross-check): the email bullet on the shortfall now names it "the Plants Step 6 shortfall (the eval's step P6, not probe P6)", since Conventions reserve P1 to P14 for the endpoint map's probes (probe P6 is the LastModified placeholder check, endpoint_map.md:506). The workbook layout (wf/workbook/_LAYOUT.txt) gives Plants Step 6 at A26. Closed Loop States PlantBatches A18 now carries its path cell, A20 (tab09 dump: A18 "Step 4", A20 the growthphase path), in D14's form.
26. FIXED (cross-check): the coverage table's last column now carries the endpoint map's marks in full: "EVAL (E1 support)" for the locations, items and strains active lists (endpoint_map.md:139-141), "EVAL (E1)" for incoming and outgoing transfers (rows 10, 11) and for the delivery children (row 12 and :468).
27. FIXED (cross-check): A23 now writes "brief A1's regroup into Admin Settings (CANON.md:776, 0.30.418)", so it cannot be read as assumption A1 under D1's one namespace. The row, re-read, is "BRIEF A1, ADMIN CLEANUP" and its ask makes [Admin Settings] a new button.
28. FIXED (cross-check): the waste pagination claim now carries its citations: GET_plants_v2_waste.txt:18 and GET_plantbatches_v2_waste.txt:18 each read "| pageSize", and the list starts at page_whats-new-in-v2.txt:719 (PrintableList.txt:1053). One refinement of the cross-checker's evidence, re-read: the list does name four plants waste sub-routes (/plants/v2/waste/reasons, /waste/methods/all, /waste/{id}/plant, /waste/{id}/package, page_whats-new-in-v2.txt:819-825), but not /plants/v2/waste itself, and its Plant Batches group (:793-799) has no waste route, so the sentence stands as written.
29. FIXED (cross-check, widened by this pass): W's change lists (Phase reached, Conventions, 4b) now include test/metrcapi.test.ts, 27,116 bytes, efeda974ab2ce700 (mtime 19:22:51), against aede7c67ced5b53a/5,810 on M and B. Hashed again at 19:44 (read only), W also carries two new files the cross-checker did not name: src/metrcpager.ts (33,160 bytes, 9122f1b9b3a09824, 19:20:33) and test/metrcpager.test.ts (27,874 bytes, f2f76397884927bb, 19:25:48), both absent from M; they are added to the same lists. Conventions now say W's byte counts are readings at a moment while that session works (src/metrcapi.ts read 45,502 bytes at 19:26:50 and src/config.ts 90,101 at 19:26:35). The 4b table's W column is labelled "at the cut" and is unchanged.
