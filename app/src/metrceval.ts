/**
 * MA1 Phase E1, Law 8 (THE EVALUATION RUNNER): the sandbox-only runner that
 * walks the evaluation workbook's GET steps for the facility types Grip is
 * (Grow and Processor) and keeps the verification items the workbook asks for
 * in a downloadable pack: one CSV per facility and tab, shaped to paste at
 * the workbook's anchors, and one JSON of everything.
 *
 * GET calls only. No POST, PUT or DELETE path exists in this file, and the
 * write door of metrcapi.ts is never called. Every call goes through metrcGet
 * (the Law 3 host guard, key scrubbing, redirect refusal, the call log) under
 * a run budget (metrc_eval_max_calls). The page and the run are active only
 * when metrcHostKind(env) is "sandbox"; any other host gets one plain
 * sentence and no call.
 *
 * Law 4 (THE LAW OF SECRETS): the pack never holds a key, an Authorization
 * header, a Basic token, License.EmployeeLicenseNumber or FacilityId. Every
 * text is scrubbed before storage, and a recursive key filter drops the two
 * person and id fields from every parsed response.
 *
 * Sources, never memory. The workbook dump (wf/workbook/tabNN_*.txt, from the
 * workbook whose sha256 prefix is d06d9a4bd4a404e7) gives every tab name,
 * row-4 header string (trailing spaces included) and paste anchor in the
 * table below, exactly. The local docs copy (metrcdocs/endpoints/*.txt,
 * fetched 2026-10-08) gives every path and parameter sent, cited by file
 * name beside each one. The derived step list is eval_steps.md sections 2 to
 * 8; the run order is its section 2.11 and the pack layout its section 7.
 */

import { nowIso } from "./audit";
import { ADMIN_METRC_EVAL_PATH, CONFIG_KEYS, metrcPageSizeOf, metrcWholeOf } from "./config";
import { csvCell } from "./csv";
import { t, tFill, type Locale } from "./i18n";
import {
  basicToken,
  keysPresent,
  metrcGet,
  metrcHost,
  metrcHostKind,
  metrcUrl,
  parseFacilities,
  scrubKeys,
  userKeyFor,
  type CallRow,
  type FacilityFacts,
  type MetrcEnv,
} from "./metrcapi";
import { isoSeconds } from "./metrcpager";
import { easternStamp } from "./sheetsync";
import { esc } from "./ui";

export const EVAL_PHASE = "E1";
export const EVAL_BRIEF = "MA1";
export const EVAL_SANDBOX_ONLY = "The evaluation runner works on a sandbox host only.";
/** The workbook's sha256 prefix (eval_steps.md Sources). */
export const EVAL_WORKBOOK_SHA = "d06d9a4bd4a404e7";
/** The docs copy: fetch date and the PrintableList sha256 prefix (eval_steps.md Sources). */
export const EVAL_DOCS_FETCHED = "2026-10-08";
export const EVAL_DOCS_LIST_SHA = "266a3a6162844c6f";
/** A stored response body (minified JSON, first page) is capped here. */
export const EVAL_BODY_CAP = 20_000;
/** The second cut of the steps_json cap truncates bodies to this length. */
export const EVAL_BODY_CUT = 2_000;
/** steps_json after scrubbing, under D1's 2,000,000 byte row limit. */
export const EVAL_STEPS_JSON_CAP = 1_500_000;
/** A response body the runner stops reading past this many bytes: the call
 * reads failed 0 with the reason, nothing of it is parsed, the run goes on. */
export const EVAL_RESPONSE_BYTES_CAP = 4_000_000;
/** A stored request path plus query is capped here (the license rides in it). */
export const EVAL_REQUEST_URL_CAP = 2_000;
/** One value read from a response row (an Id, a Label, a Name) is capped here. */
export const EVAL_FIELD_CAP = 200;
/** The license part of a pack file name is capped here, before the suffix that keeps names distinct. */
export const EVAL_FILE_LICENSE_CAP = 80;
export const EVAL_DEFAULT_MAX_CALLS = 150;
export const EVAL_DEFAULT_WINDOW_DAYS = 30;
export const EVAL_RUNS_LISTED = 10;
export const EVAL_E2_STATUS = "E2 not enabled";
export const EVAL_BUDGET_STATUS = "cannot run: budget";
export const EVAL_E2_REASON =
  "A write step. Phase E2 is built only on the owner's word after Metrc confirms the evaluation scope (F-A), behind METRC_EVAL_ENABLED and the Law 3 host guard.";
const PROBE_IDS_KEPT = 5;

// ---------------------------------------------------------------- config

export type MetrcEvalConfig = { maxCalls: number; windowDays: number; pageSize: number };

/** The two E1 budgets (seeded by 0098) and the shared page size (0096). */
export function metrcEvalConfigOf(read: (key: string) => string | null): MetrcEvalConfig {
  return {
    maxCalls: metrcWholeOf(read(CONFIG_KEYS.metrc_eval_max_calls), EVAL_DEFAULT_MAX_CALLS),
    windowDays: metrcWholeOf(read(CONFIG_KEYS.metrc_eval_window_days), EVAL_DEFAULT_WINDOW_DAYS),
    pageSize: metrcPageSizeOf(read(CONFIG_KEYS.metrc_page_size)),
  };
}

export async function loadMetrcEvalConfig(db: D1Database): Promise<MetrcEvalConfig> {
  const keys = [CONFIG_KEYS.metrc_eval_max_calls, CONFIG_KEYS.metrc_eval_window_days, CONFIG_KEYS.metrc_page_size];
  const rows = await db
    .prepare(`SELECT key, value FROM app_config WHERE deleted_at IS NULL AND key IN (?, ?, ?)`)
    .bind(...keys)
    .all<{ key: string; value: string }>();
  const byKey = new Map((rows.results ?? []).map((row) => [row.key, row.value]));
  return metrcEvalConfigOf((key) => byKey.get(key) ?? null);
}

// ---------------------------------------------------------------- the workbook

/** Row-4 header strings, exactly as the workbook cells hold them (the dump
 * files keep every leading and trailing space; _LAYOUT.txt strips them). */
export const H_RESULT = "Result code";
export const H_LICENSE = "License Facility";
export const H_ID = "ID Number ";
export const H_LAST_MODIFIED = "Last Modified Date";
export const H_TAG = "Tag Number  ";
export const H_PLANT_BATCH_TAG = "Plant Batch Name/Tag Number  ";
export const H_HARVEST_NAME = "Harvest Name";
export const H_REQUEST = "Request Sent";
/** Locations, Strains and Items say ((Minify please)) with double parentheses. */
export const H_JSON_DOUBLE = " JSON Body Or Response  ((Minify please))";
export const H_JSON = " JSON Body Or Response  (Minify please)";
export const H_LOCATION_NAME = "location Name Created  ";
export const H_STRAIN_NAME = "Strain Name Created  ";
export const H_ITEM_NAME = "Item Name Created  ";

export type EvalVerb = "GET" | "POST" | "PUT" | "DELETE";
export type EvalPhase = "E1" | "E2";
/** The 12 GET steps of eval_steps section 4. */
export type E1Key = "L3" | "S3" | "I3" | "T1" | "T2" | "T3" | "T4" | "T5" | "T6" | "TT2" | "TT3" | "X2";

export type EvalStepDef = {
  step: string;
  anchor: string;
  verb: EvalVerb;
  /** The path as the workbook cell holds it (surrounding spaces trimmed). */
  path_workbook: string;
  /** The documented v2 path template the runner sends (E1 only). */
  path_sent: string | null;
  docs_file: string;
  phase: EvalPhase;
  key: E1Key | null;
};

export type EvalTabDef = {
  nn: string;
  file: string;
  /** The exact tab name. */
  tab: string;
  /** The workbook dump file the headers and anchors were read from. */
  dump: string;
  applies_to: "grow" | "both";
  /** The "<X> Name Created" column on the three by-id tabs, else null. */
  name_column: string | null;
  headers: readonly string[];
  steps: readonly EvalStepDef[];
};

const BY_ID_HEADERS = (name: string): readonly string[] => [H_RESULT, H_LICENSE, H_ID, name, H_REQUEST, H_JSON_DOUBLE];
const PLANTS_HEADERS: readonly string[] = [H_RESULT, H_LICENSE, H_ID, H_LAST_MODIFIED, H_TAG, H_HARVEST_NAME, H_REQUEST, H_JSON];
const PACKAGES_HEADERS: readonly string[] = [H_RESULT, H_LICENSE, H_ID, H_LAST_MODIFIED, H_TAG, H_REQUEST, H_JSON];

function e2(step: string, anchor: string, verb: EvalVerb, path_workbook: string, docs_file: string): EvalStepDef {
  return { step, anchor, verb, path_workbook, path_sent: null, docs_file, phase: "E2", key: null };
}

function e1(step: string, anchor: string, path_workbook: string, path_sent: string, docs_file: string, key: E1Key): EvalStepDef {
  return { step, anchor, verb: "GET", path_workbook, path_sent, docs_file, phase: "E1", key };
}

/** The ten applicable step tabs in workbook order (eval_steps section 7), with
 * every step row, run or not. Tab names, headers and anchors come from the
 * named dump file; paths from the A cells it lists. */
export const EVAL_TABS: readonly EvalTabDef[] = [
  {
    nn: "05",
    file: "05_Locations",
    tab: "Locations",
    dump: "tab05_Locations.txt",
    applies_to: "grow",
    name_column: H_LOCATION_NAME,
    headers: BY_ID_HEADERS(H_LOCATION_NAME),
    steps: [
      e2("Step 1", "B5", "POST", "POST /locations/v2/", "POST_locations_v2.txt"),
      e2("Step 2", "B9", "PUT", "PUT/locations/v2/", "PUT_locations_v2.txt"),
      // GET /locations/v2/{id}, licenseNumber optional and sent (GET_locations_v2_id.txt lines 11 to 12).
      e1("Step 3", "B13", "GET /locations/v2/{id}", "/locations/v2/{id}", "GET_locations_v2_id.txt", "L3"),
    ],
  },
  {
    nn: "06",
    file: "06_Strains",
    tab: "Strains",
    dump: "tab06_Strains.txt",
    applies_to: "both",
    name_column: H_STRAIN_NAME,
    headers: BY_ID_HEADERS(H_STRAIN_NAME),
    steps: [
      e2("Step 1", "B5", "POST", "POST/strains/v2/", "POST_strains_v2.txt"),
      e2("Step 2", "B9", "PUT", "PUT/strains/v2/", "PUT_strains_v2.txt"),
      // GET /strains/v2/{id}, licenseNumber optional and sent (GET_strains_v2_id.txt lines 11 to 12).
      e1("Step 3", "B13", "GET/strains/v2/{id}", "/strains/v2/{id}", "GET_strains_v2_id.txt", "S3"),
    ],
  },
  {
    nn: "07",
    file: "07_Items",
    tab: "Items",
    dump: "tab07_Items.txt",
    applies_to: "both",
    name_column: H_ITEM_NAME,
    headers: BY_ID_HEADERS(H_ITEM_NAME),
    steps: [
      e2("Step 1", "B5", "POST", "POST/Items/v2/", "POST_items_v2.txt"),
      e2("Step 2", "B9", "PUT", "PUT/Items/v2/", "PUT_items_v2.txt"),
      // The workbook writes /Items/v2/; the docs path is lowercase /items/v2/{id}
      // (GET_items_v2_id.txt line 1), licenseNumber optional and sent (lines 11 to 12).
      e1("Step 3", "B13", "GET/Items/v2/{id}", "/items/v2/{id}", "GET_items_v2_id.txt", "I3"),
    ],
  },
  {
    nn: "09",
    file: "09_Closed_Loop_States_PlantBatches",
    tab: "Closed Loop States PlantBatches",
    dump: "tab09_Closed_Loop_States_PlantBatches.txt",
    applies_to: "grow",
    name_column: null,
    headers: [H_RESULT, H_LICENSE, H_ID, H_LAST_MODIFIED, H_PLANT_BATCH_TAG, H_REQUEST, H_JSON],
    steps: [
      // Step 1 has no path cell (A6 is the instruction); one of the Closed Loop routes (eval_steps section 3).
      e2("Step 1", "B5", "POST", "(no path cell: a Closed Loop Environment route)", "POST_plants_v2_plantings.txt | POST_packages_v2_plantings.txt | POST_plantbatches_v2_split.txt"),
      e2("Step 2", "B10", "POST", "POST/plantbatches/v2/packages/frommotherplant", "POST_plantbatches_v2_packages_frommotherplant.txt"),
      e2("Step 3", "B14", "POST", "POST /plantbatches/v2/packages", "POST_plantbatches_v2_packages.txt"),
      e2("Step 4", "B18", "POST", "POST/plantbatches/v2/growthphase", "POST_plantbatches_v2_growthphase.txt"),
      e2("Step 5", "B22", "DELETE", "DELETE/plantbatches/v2/", "DELETE_plantbatches_v2.txt"),
    ],
  },
  {
    nn: "11",
    file: "11_Plants",
    tab: "Plants",
    dump: "tab11_Plants.txt",
    applies_to: "grow",
    name_column: null,
    headers: PLANTS_HEADERS,
    steps: [
      e2("Step 1", "B6", "PUT", "PUT /plants/v2/location", "PUT_plants_v2_location.txt"),
      e2("Step 2", "B10", "POST", "POST/plants/v2/plantings", "POST_plants_v2_plantings.txt"),
      e2("Step 3", "B14", "POST", "POST/plants/v2/plantbatch/packages", "POST_plants_v2_plantbatch_packages.txt"),
      e2("Step 4", "B18", "DELETE", "DELETE /plants/v2/", "DELETE_plants_v2.txt"),
      e2("Step 5", "B22", "POST", "POST/plants/v2/manicure", "POST_plants_v2_manicure.txt"),
      e2("Step 6", "B26", "PUT", "PUT /plants/v2/harvest", "PUT_plants_v2_harvest.txt"),
    ],
  },
  {
    nn: "12",
    file: "12_Harvest",
    tab: "Harvest",
    dump: "tab12_Harvest.txt",
    applies_to: "grow",
    name_column: null,
    headers: PLANTS_HEADERS,
    steps: [
      e2("Step 1", "B5", "POST", "POST /harvests/v2/packages", "POST_harvests_v2_packages.txt"),
      e2("Step 2", "B9", "POST", "POST /harvests/v2/waste", "POST_harvests_v2_waste.txt"),
      e2("Step 3", "B13", "PUT", "PUT /harvests/v2/finish", "PUT_harvests_v2_finish.txt"),
      e2("Step 4", "B17", "PUT", "PUT /harvests/v2/unfinish", "PUT_harvests_v2_unfinish.txt"),
    ],
  },
  {
    nn: "13",
    file: "13_Packages",
    tab: "Packages",
    dump: "tab13_Packages.txt",
    applies_to: "both",
    name_column: null,
    headers: PACKAGES_HEADERS,
    steps: [
      e2("Step 1", "B5", "POST", "POST/packages/v2/", "POST_packages_v2.txt"),
      e2("Step 2", "B9", "PUT", "PUT/packages/v2/item", "PUT_packages_v2_item.txt"),
      e2("Step 3", "B13", "PUT", "PUT/packages/v2/adjust", "PUT_packages_v2_adjust.txt"),
      e2("Step 4", "B17", "PUT", "PUT/packages/v2/finish", "PUT_packages_v2_finish.txt"),
      e2("Step 5", "B21", "PUT", "PUT/packages/v2/unfinish", "PUT_packages_v2_unfinish.txt"),
    ],
  },
  {
    nn: "20",
    file: "20_GET_Transfers_and_Wholesale",
    tab: "GET Transfers and Wholesale",
    dump: "tab20_GET_Transfers_and_Wholesale.txt",
    applies_to: "both",
    name_column: null,
    headers: PACKAGES_HEADERS,
    steps: [
      // licenseNumber, pageNumber, pageSize, lastModifiedStart, lastModifiedEnd (GET_transfers_v2_incoming.txt lines 13 to 28).
      e1("Step 1", "B5", "GET/transfers/v2/incoming", "/transfers/v2/incoming", "GET_transfers_v2_incoming.txt", "T1"),
      // The same parameter block (GET_transfers_v2_outgoing.txt lines 13 to 28).
      e1("Step 2", "B9", "GET /transfers/v2/outgoing", "/transfers/v2/outgoing", "GET_transfers_v2_outgoing.txt", "T2"),
      // licenseNumber, pageNumber, pageSize; no lastModified (GET_transfers_v2_rejected.txt lines 11 to 22).
      e1("Step 3", "B13", "GET /transfers/v2/rejected", "/transfers/v2/rejected", "GET_transfers_v2_rejected.txt", "T3"),
      // {id} is a Transfer Id; pageNumber and pageSize only, no licenseNumber (GET_transfers_v2_id_deliveries.txt lines 11 to 19).
      e1("Step 4", "B17", "GET /transfers/v2/{id}/deliveries", "/transfers/v2/{id}/deliveries", "GET_transfers_v2_id_deliveries.txt", "T4"),
      // The workbook's singular "delivery" is undocumented; the docs path is plural (GET_transfers_v2_deliveries_id_packages.txt line 1; params lines 11 to 19).
      e1("Step 5", "B21", "GET /transfers/v2/delivery/{id}/packages", "/transfers/v2/deliveries/{id}/packages", "GET_transfers_v2_deliveries_id_packages.txt", "T5"),
      // Same plural form (GET_transfers_v2_deliveries_id_packages_wholesale.txt line 1; params lines 11 to 19).
      e1(
        "Step 6",
        "B25",
        "GET/transfers/v2/delivery/{id}/packages/wholesale",
        "/transfers/v2/deliveries/{id}/packages/wholesale",
        "GET_transfers_v2_deliveries_id_packages_wholesale.txt",
        "T6"
      ),
    ],
  },
  {
    nn: "21",
    file: "21_Transfer_Templates",
    tab: "Transfer Templates",
    dump: "tab21_Transfer_Templates.txt",
    applies_to: "both",
    name_column: null,
    headers: PACKAGES_HEADERS,
    steps: [
      e2("Step 1a", "B5", "POST", "POST/transfers/v2/templates/outgoing", "POST_transfers_v2_templates_outgoing.txt"),
      e2("Step 1b", "B9", "POST", "POST/transfers/v2/templates/outgoing", "POST_transfers_v2_templates_outgoing.txt"),
      // A15 reads only "GE" (truncated), kept as the cell holds it; the Metrc Use Only row A29 says
      // GET /transfers/v2/templates, a v1 shape (the step's note says so, TT2_NOTE below).
      // The documented v2 path takes licenseNumber, paging and lastModified (GET_transfers_v2_templates_outgoing.txt lines 13 to 28).
      e1("Step 2", "B13", "GE", "/transfers/v2/templates/outgoing", "GET_transfers_v2_templates_outgoing.txt", "TT2"),
      // The workbook omits /outgoing; the docs path takes pageNumber and pageSize only (GET_transfers_v2_templates_outgoing_id_deliveries.txt lines 11 to 19).
      e1(
        "Step 3",
        "B17",
        "GET /transfers/v2/templates/{id}/deliveries",
        "/transfers/v2/templates/outgoing/{id}/deliveries",
        "GET_transfers_v2_templates_outgoing_id_deliveries.txt",
        "TT3"
      ),
      e2("Step 4", "B21", "PUT", "PUT/transfers/v2/templates/outgoing", "PUT_transfers_v2_templates_outgoing.txt"),
    ],
  },
  {
    nn: "22",
    file: "22_Transfer_External_Incoming",
    tab: "Transfer External Incoming",
    dump: "tab22_Transfer_External_Incoming.txt",
    applies_to: "both",
    name_column: null,
    headers: PACKAGES_HEADERS,
    steps: [
      e2("Step 1a", "B5", "POST", "POST/transfers/v2/external/incoming", "POST_transfers_v2_external_incoming.txt"),
      e2("Step 1b", "B9", "POST", "POST/transfers/v2/external/incoming", "POST_transfers_v2_external_incoming.txt"),
      // The same call as T1 (GET_transfers_v2_incoming.txt), windowed.
      e1("Step 2", "B13", "GET/transfers/v2/incoming", "/transfers/v2/incoming", "GET_transfers_v2_incoming.txt", "X2"),
      e2("Step 3", "B17", "PUT", "PUT/transfers/v2/external/incoming", "PUT_transfers_v2_external_incoming.txt"),
      e2("Step 4", "B21", "DELETE", "DELETE/transfers/v2/external/incoming/{id}", "DELETE_transfers_v2_external_incoming_id.txt"),
    ],
  },
];

// ---------------------------------------------------------------- probes

export type ProbeDef = {
  path: string;
  docs_file: string;
  /** Whether licenseNumber is sent (optional ones are sent too). */
  license: boolean;
  /** Whether pageNumber and pageSize are documented and sent. */
  paged: boolean;
};

/** The supporting reads of eval_steps section 5 that are GET. Each is one
 * call, first page only. /tags/v2/* (premium, UNRESOLVED) and
 * /plantbatches/v2/waste/reasons (no documented response shape) are skipped. */
export const EVAL_PROBES: readonly ProbeDef[] = [
  // licenseNumber, pageNumber, pageSize (GET_locations_v2_types.txt lines 11 to 20).
  { path: "/locations/v2/types", docs_file: "GET_locations_v2_types.txt", license: true, paged: true },
  // licenseNumber, paging, lastModified optional and not sent (GET_locations_v2_active.txt lines 11 to 26).
  { path: "/locations/v2/active", docs_file: "GET_locations_v2_active.txt", license: true, paged: true },
  // Each licensed, paged probe below with no comment of its own sends licenseNumber, pageNumber and
  // pageSize, documented at lines 11 to 20 of its file (strains, items, plantbatches, the three
  // plants lists, harvests, packages, plants waste reasons, packages adjust reasons, transfers
  // types); where the file also lists lastModifiedStart and lastModifiedEnd they are optional and not sent.
  { path: "/strains/v2/active", docs_file: "GET_strains_v2_active.txt", license: true, paged: true },
  { path: "/items/v2/active", docs_file: "GET_items_v2_active.txt", license: true, paged: true },
  // licenseNumber optional, sent (GET_items_v2_categories.txt lines 19 to 20).
  { path: "/items/v2/categories", docs_file: "GET_items_v2_categories.txt", license: true, paged: true },
  // No parameters (GET_unitsofmeasure_v2_active.txt line 11): once per run.
  { path: "/unitsofmeasure/v2/active", docs_file: "GET_unitsofmeasure_v2_active.txt", license: false, paged: false },
  { path: "/plantbatches/v2/active", docs_file: "GET_plantbatches_v2_active.txt", license: true, paged: true },
  { path: "/plants/v2/vegetative", docs_file: "GET_plants_v2_vegetative.txt", license: true, paged: true },
  { path: "/plants/v2/flowering", docs_file: "GET_plants_v2_flowering.txt", license: true, paged: true },
  { path: "/plants/v2/mother", docs_file: "GET_plants_v2_mother.txt", license: true, paged: true },
  { path: "/harvests/v2/active", docs_file: "GET_harvests_v2_active.txt", license: true, paged: true },
  { path: "/packages/v2/active", docs_file: "GET_packages_v2_active.txt", license: true, paged: true },
  { path: "/plants/v2/waste/reasons", docs_file: "GET_plants_v2_waste_reasons.txt", license: true, paged: true },
  // No parameters (GET_wastemethods_v2.txt line 11): once per run.
  { path: "/wastemethods/v2/", docs_file: "GET_wastemethods_v2.txt", license: false, paged: false },
  // pageNumber and pageSize only (GET_plants_v2_waste_methods_all.txt lines 9 to 17): once per run.
  { path: "/plants/v2/waste/methods/all", docs_file: "GET_plants_v2_waste_methods_all.txt", license: false, paged: true },
  // pageNumber and pageSize only (GET_harvests_v2_waste_types.txt lines 9 to 17): once per run.
  { path: "/harvests/v2/waste/types", docs_file: "GET_harvests_v2_waste_types.txt", license: false, paged: true },
  { path: "/packages/v2/adjust/reasons", docs_file: "GET_packages_v2_adjust_reasons.txt", license: true, paged: true },
  { path: "/transfers/v2/types", docs_file: "GET_transfers_v2_types.txt", license: true, paged: true },
  // licenseNumber, paging, lastModified optional and not sent here (GET_transfers_v2_templates_outgoing.txt lines 13 to 28).
  { path: "/transfers/v2/templates/outgoing", docs_file: "GET_transfers_v2_templates_outgoing.txt", license: true, paged: true },
  // licenseNumber only, not paged (GET_sandbox_v2_tagtypes.txt line 20); 403 off a sandbox host.
  { path: "/sandbox/v2/tagtypes", docs_file: "GET_sandbox_v2_tagtypes.txt", license: true, paged: false },
];

// ---------------------------------------------------------------- pack types

export type FacilityRole = "grow" | "processor" | "grow_processor" | "none";

export type FacilityRecord = {
  license: string;
  license_type: string | null;
  can_grow_plants: number | null;
  can_record_processing_jobs: number | null;
  can_track_vegetative_plants: number | null;
  role: FacilityRole;
};

export type P0Record = {
  step: "P0";
  verb: "GET";
  path_sent: string;
  docs_file: string;
  request_url: string | null;
  response_status: number | null;
  status: string;
  reason: string | null;
  count: number;
};

export type ProbeRecord = {
  path: string;
  docs_file: string;
  license: string | null;
  request_url: string | null;
  response_status: number | null;
  status: string;
  reason: string | null;
  count: number;
  total_records: number | null;
  ids: string[];
  labels: string[];
  /** The first row, minified and scrubbed; the first thing the cap drops. */
  sample: string | null;
};

export type EvalWindow = { lastModifiedStart: string; lastModifiedEnd: string };

export type StepRecord = {
  step: string;
  anchor: string;
  tab: string;
  verb: EvalVerb;
  path_workbook: string;
  path_sent: string | null;
  docs_file: string;
  phase: EvalPhase;
  status: string;
  reason: string | null;
  request_url: string | null;
  response_status: number | null;
  response_body: string | null;
  truncated: boolean;
  license_source: string | null;
  window: EvalWindow | null;
  attempts: Array<{ window: EvalWindow; response_status: number }> | null;
  ran_at: string | null;
  columns: Record<string, string>;
};

export type TabRecord = {
  nn: string;
  file: string;
  tab: string;
  applies_to: "grow" | "both";
  license: string;
  steps: StepRecord[];
};

export type EvalPack = {
  meta: {
    generated_at: string;
    host: string;
    phase: string;
    brief: string;
    workbook_sha256_prefix: string;
    docs_fetch_date: string;
    docs_printable_list_sha256_prefix: string;
    config: MetrcEvalConfig;
    calls: number;
    status: string;
    cuts: string[];
    files: string[];
  };
  facilities: FacilityRecord[];
  p0: P0Record;
  probes: ProbeRecord[];
  run_order: string[];
  writes_outside_workbook: unknown[];
  tabs: TabRecord[];
};

export type EvalRunRow = {
  id: string;
  host: string;
  phase: string;
  started_at: string;
  finished_at: string | null;
  status: string;
  calls: number;
  steps_json: string;
  bytes: number;
};

export type EvalRunCode = "absent" | "host" | "ok" | "partial" | "refused" | "failed";
export type EvalRunResult = { code: EvalRunCode; run: EvalRunRow | null };

export type EvalDeps = {
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  now?: () => string;
  clock?: () => number;
  /** The steps_json cap, for tests; the constant otherwise. */
  stepsJsonCap?: number;
  /** The response byte cap, for tests; the constant otherwise. */
  responseBytesCap?: number;
};

// ---------------------------------------------------------------- scrubbing

/** Law 4, for long text: the same replacement scrubKeys makes (each key of 4
 * or more characters, the Basic token first in its "Basic <token>" form),
 * without scrubKeys' 400-character slice, which is sized for a failed-call
 * message and would cut a response body. Any Authorization header text that
 * reaches a body is blanked too: the name and the value both become
 * [authorization], with the quotes and the colon kept, so a JSON body stays
 * JSON and a field named AuthorizationNumber is left alone. A Basic token of
 * some other key pair (base64, 40 characters or more) is blanked as well;
 * vendor text that merely starts with Basic, such as a type named Basic
 * Extraction, is kept as Metrc sent it. Short messages go through scrubKeys. */
export function scrubLong(text: string, keys: Array<string | null | undefined>): string {
  let out = text;
  const list = keys
    .map((key) => (key ?? "").trim())
    .filter((key) => key.length >= 4)
    .sort((a, b) => b.length - a.length);
  for (const k of list) out = out.split(`Basic ${k}`).join("[key]");
  for (const k of list) out = out.split(k).join("[key]");
  out = out.replace(/(\\?["']?)\bAuthorization(\\?["']?\s*[:=]\s*\\?["']?)(?:Basic\s+)?[^"',}\s]*/gi, "$1[authorization]$2[authorization]");
  out = out.replace(/\bBasic [A-Za-z0-9+/]{40,}={0,2}/g, "Basic [key]");
  return out;
}

/** Each secret in every spelling a body or a message could echo it in: raw,
 * JSON-escaped (a quote or backslash inside it), URL-encoded, and the Basic
 * header URL-encoded (Basic%20<token>). The runner scrubs with all of them, so
 * an encoded echo cannot decode back to a key. Blank and short values drop. */
export function scrubSpellings(secrets: Array<string | null | undefined>): string[] {
  const out = new Set<string>();
  for (const raw of secrets) {
    const secret = (raw ?? "").trim();
    if (secret.length < 4) continue;
    out.add(secret);
    out.add(JSON.stringify(secret).slice(1, -1));
    out.add(encodeURIComponent(secret));
    out.add(encodeURIComponent(`Basic ${secret}`));
  }
  return [...out];
}

/** The recursive key filter: License.EmployeeLicenseNumber (a person's
 * license, GET_facilities_v2.txt line 140; G-9) and FacilityId (line 21) are
 * dropped wherever they appear before anything is minified. */
export function dropNeverStoredKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(dropNeverStoredKeys);
  if (!value || typeof value !== "object") return value;
  const out: Record<string, unknown> = {};
  for (const [key, inner] of Object.entries(value as Record<string, unknown>)) {
    if (key === "EmployeeLicenseNumber" || key === "FacilityId") continue;
    out[key] = dropNeverStoredKeys(inner);
  }
  return out;
}

function minified(body: unknown, keys: string[]): { text: string; truncated: boolean } {
  const full = scrubLong(JSON.stringify(dropNeverStoredKeys(body) ?? null), keys);
  if (full.length <= EVAL_BODY_CAP) return { text: full, truncated: false };
  return { text: full.slice(0, EVAL_BODY_CAP), truncated: true };
}

// ---------------------------------------------------------------- the run

type Session = {
  env: MetrcEnv;
  host: string;
  keys: string[];
  config: MetrcEvalConfig;
  fetchImpl: typeof fetch | undefined;
  sleep: ((ms: number) => Promise<void>) | undefined;
  now: () => string;
  clock: (() => number) | undefined;
  calls: number;
  runOrder: string[];
};

type CallOut = { status: number; body: unknown; request_url: string; reason: string | null };

function rowsOf(body: unknown): unknown[] {
  if (Array.isArray(body)) return body;
  if (body && typeof body === "object" && Array.isArray((body as { Data?: unknown }).Data)) return (body as { Data: unknown[] }).Data;
  return [];
}

function totalRecordsOf(body: unknown): number | null {
  if (Array.isArray(body)) return body.length;
  if (!body || typeof body !== "object") return null;
  const n = Number((body as { TotalRecords?: unknown }).TotalRecords);
  return Number.isFinite(n) ? n : null;
}

/** One value of a response row as text, capped (a runaway value never swells a column or a path). */
function field(row: unknown, name: string): string | null {
  if (!row || typeof row !== "object") return null;
  const value = (row as Record<string, unknown>)[name];
  if (value == null) return null;
  const s = String(value).trim().slice(0, EVAL_FIELD_CAP);
  return s ? s : null;
}

/** A record Id the runner may put in a path: Metrc Ids are integers, so only
 * letters, digits, underscore and hyphen pass. A dot segment, a slash, a
 * space or an empty string would let a list row steer the by-id call off its
 * documented route (new URL normalises ".." and "."), so such an Id is not
 * sent and the step reads cannot run with the reason. */
export function usableId(id: string | null): string | null {
  return id != null && /^[A-Za-z0-9_-]{1,64}$/.test(id) ? id : null;
}

function firstId(rows: unknown[]): string | null {
  const first = rows[0];
  return field(first, "Id") ?? field(first, "PackageId");
}

function firstTag(rows: unknown[]): string | null {
  const first = rows[0];
  return field(first, "Label") ?? field(first, "PackageLabel");
}

function reasonOf(status: number, body: unknown, keys: string[]): string | null {
  if (status === 200) return null;
  if (status === 0) return "Metrc did not answer.";
  const text = body == null ? "" : typeof body === "string" ? body : JSON.stringify(dropNeverStoredKeys(body));
  return scrubKeys(`Metrc answered ${status}. ${text}`.trim(), keys);
}

/** One GET through metrcGet, within the budget. A throw (network failure, or
 * a key the Basic header cannot carry) comes back as status 0 with a scrubbed
 * reason, never as an exception, so the run carries on. */
async function callOnce(s: Session, path: string, query: Record<string, string>, license: string | null): Promise<CallOut> {
  const url = metrcUrl(s.env, path, query);
  const request_url = (url.pathname + url.search).slice(0, EVAL_REQUEST_URL_CAP);
  const userKey = userKeyFor(s.env, license ?? "") ?? undefined;
  const record = async (row: CallRow): Promise<void> => {
    s.calls += 1;
    await recordEvalCall(s.env.DB, s.host, row);
  };
  try {
    const res = await metrcGet({
      env: s.env,
      path,
      query,
      userKey,
      fetchImpl: s.fetchImpl,
      sleep: s.sleep,
      now: s.now,
      clock: s.clock,
      record,
    });
    return { status: res.status, body: res.body, request_url, reason: reasonOf(res.status, res.body, s.keys) };
  } catch (err) {
    const text = err instanceof Error ? err.message : String(err);
    return { status: 0, body: null, request_url, reason: scrubKeys(text, s.keys) || "Metrc did not answer." };
  }
}

function budgetLeft(s: Session): boolean {
  return s.calls < s.config.maxCalls;
}

/** The fetch the runner hands to metrcGet, bounded: a body over maxBytes is
 * not read to the end (Content-Length first, then the stream as it comes),
 * the call throws, and callOnce records it as failed 0 with the reason, so a
 * runaway page is never parsed, stringified or scrubbed whole. Phase B's
 * metrcGet is untouched; it sees a Response of the same status and headers. */
export function boundedFetch(fetchImpl: typeof fetch, maxBytes: number): typeof fetch {
  const over = (): Error => new Error(`Metrc answered with a body over ${maxBytes} bytes; the call was not read.`);
  return (async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const res = await fetchImpl(input, init);
    const declared = Number(res.headers.get("content-length"));
    if (Number.isFinite(declared) && declared > maxBytes) {
      await res.body?.cancel();
      throw over();
    }
    if (!res.body) return res;
    const reader = res.body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        throw over();
      }
      chunks.push(value);
    }
    const joined = new Uint8Array(total);
    let at = 0;
    for (const chunk of chunks) {
      joined.set(chunk, at);
      at += chunk.byteLength;
    }
    return new Response(joined, { status: res.status, statusText: res.statusText, headers: res.headers });
  }) as typeof fetch;
}

/** One metrc_api_calls row per HTTP attempt, with the host of 0098. */
export async function recordEvalCall(db: D1Database, host: string, row: CallRow): Promise<void> {
  await db
    .prepare(`INSERT INTO metrc_api_calls (id, started_at, path, status, ms, host) VALUES (?, ?, ?, ?, ?, ?)`)
    .bind(crypto.randomUUID(), row.started_at, row.path, row.status, row.ms, host)
    .run();
}

export function evalPageActive(env: Pick<MetrcEnv, "METRC_API_BASE">): boolean {
  return metrcHostKind(env) === "sandbox";
}

export function facilityRole(f: Pick<FacilityFacts, "canGrowPlants" | "canRecordProcessingJobs">): FacilityRole {
  const grow = f.canGrowPlants === 1;
  const processor = f.canRecordProcessingJobs === 1;
  if (grow && processor) return "grow_processor";
  if (grow) return "grow";
  if (processor) return "processor";
  return "none";
}

/** The run date, UTC, as the workbook's Last Modified Date column takes it (Q11). */
function runDate(iso: string): string {
  return iso.slice(0, 10);
}

/** lastModifiedStart and lastModifiedEnd: UTC without milliseconds, ending at
 * now (page_getting-started.txt line 115 on encoding; metrcGet's
 * URLSearchParams encodes the Z form as is). */
export function evalWindow(nowMs: number, days: number): EvalWindow {
  const end = Math.floor(nowMs / 1000) * 1000;
  return { lastModifiedStart: isoSeconds(end - days * 86_400_000), lastModifiedEnd: isoSeconds(end) };
}

function blankStep(def: EvalStepDef, tab: string, status: string, reason: string | null): StepRecord {
  return {
    step: def.step,
    anchor: def.anchor,
    tab,
    verb: def.verb,
    path_workbook: def.path_workbook,
    path_sent: def.path_sent,
    docs_file: def.docs_file,
    phase: def.phase,
    status,
    reason,
    request_url: null,
    response_status: null,
    response_body: null,
    truncated: false,
    license_source: null,
    window: null,
    attempts: null,
    ran_at: null,
    columns: {},
  };
}

type Found = {
  locationId: string | null;
  strainId: string | null;
  itemId: string | null;
  templateId: string | null;
  probeStatus: Map<string, string>;
  transferId: { id: string; from: string; manifest: string | null } | null;
  deliveryId: string | null;
  /** Probe paths and step names whose first Id was answered but is not usable in a path. */
  unusable: Set<string>;
  flags: { openingBalance: boolean | null; motherPlants: boolean | null; externalIncoming: boolean | null };
};

/** The first Id of a list as a path segment, or null; an Id that is not
 * usable is remembered under its source so the dependent step can say why. */
function takeId(found: Found, source: string, id: string | null): string | null {
  const ok = usableId(id);
  if (id != null && ok == null) found.unusable.add(source);
  return ok;
}

const TT2_NOTE =
  "the workbook cell A15 reads GE (truncated) and the Metrc Use Only row A29 reads GET /transfers/v2/templates, a v1 shape; the documented v2 path is sent (Q9)";

function flagOf(raw: unknown, license: string, name: string): boolean | null {
  for (const item of rowsOf(raw)) {
    if (!item || typeof item !== "object") continue;
    const lic = (item as { License?: { Number?: unknown } }).License;
    if (!lic || typeof lic !== "object" || String(lic.Number ?? "").trim().toUpperCase() !== license.toUpperCase()) continue;
    const type = (item as { FacilityType?: Record<string, unknown> }).FacilityType;
    const value = type && typeof type === "object" ? type[name] : null;
    return typeof value === "boolean" ? value : null;
  }
  return null;
}

async function runProbe(s: Session, def: ProbeDef, license: string | null): Promise<{ record: ProbeRecord; rows: unknown[] }> {
  const base: ProbeRecord = {
    path: def.path,
    docs_file: def.docs_file,
    license,
    request_url: null,
    response_status: null,
    status: "",
    reason: null,
    count: 0,
    total_records: null,
    ids: [],
    labels: [],
    sample: null,
  };
  s.runOrder.push(`probe ${def.path}${license ? ` ${license}` : ""}`);
  if (!budgetLeft(s)) return { record: { ...base, status: EVAL_BUDGET_STATUS }, rows: [] };
  const query: Record<string, string> = {};
  if (def.license && license) query.licenseNumber = license;
  if (def.paged) {
    query.pageNumber = "1";
    query.pageSize = String(s.config.pageSize);
  }
  const out = await callOnce(s, def.path, query, license);
  const rows = out.status === 200 ? rowsOf(out.body) : [];
  const head = rows.slice(0, PROBE_IDS_KEPT);
  const ids = head.map((row) => field(row, "Id") ?? field(row, "PackageId")).filter((v): v is string => v != null);
  const labels = head.map((row) => field(row, "Label") ?? field(row, "PackageLabel")).filter((v): v is string => v != null);
  const sample = rows.length > 0 ? minified(rows[0], s.keys).text : null;
  return {
    record: {
      ...base,
      request_url: out.request_url,
      response_status: out.status,
      status: out.status === 200 ? "done 200" : `failed ${out.status}`,
      reason: out.reason,
      count: rows.length,
      total_records: out.status === 200 ? totalRecordsOf(out.body) : null,
      ids: ids.slice(0, PROBE_IDS_KEPT),
      labels: labels.slice(0, PROBE_IDS_KEPT),
      sample,
    },
    rows,
  };
}

type StepCall = {
  path: string;
  query: Record<string, string>;
  license: string | null;
  license_source: string;
  window: EvalWindow | null;
  /** On a 400, retry once with a 1-day window (T1, T2, X2, TT2). */
  retryNarrow: boolean;
};

async function stepCall(s: Session, call: StepCall): Promise<{ out: CallOut; window: EvalWindow | null; attempts: StepRecord["attempts"] }> {
  let window = call.window;
  let query = call.query;
  let out = await callOnce(s, call.path, query, call.license);
  const attempts: NonNullable<StepRecord["attempts"]> = [];
  if (window) attempts.push({ window, response_status: out.status });
  if (out.status === 400 && call.retryNarrow && window && budgetLeft(s)) {
    window = evalWindow(Date.parse(window.lastModifiedEnd), 1);
    query = { ...query, lastModifiedStart: window.lastModifiedStart, lastModifiedEnd: window.lastModifiedEnd };
    out = await callOnce(s, call.path, query, call.license);
    attempts.push({ window, response_status: out.status });
  }
  return { out, window, attempts: window ? attempts : null };
}

/** The tab's row-4 columns (eval_steps section 7): the status, the license
 * sent or the parent's, the record Id (the first row's on a list), the run
 * date (Q11), the Label where present, the request, the minified JSON. */
function fillColumns(tab: EvalTabDef, record: StepRecord, license: string, rows: unknown[], one: unknown): void {
  const columns: Record<string, string> = {};
  const id = one != null ? field(one, "Id") : firstId(rows);
  const tag = one != null ? field(one, "Label") : firstTag(rows);
  const name = one != null ? field(one, "Name") : null;
  for (const header of tab.headers) {
    if (header === H_RESULT) columns[header] = String(record.response_status ?? "");
    else if (header === H_LICENSE) columns[header] = license;
    else if (header === H_ID) columns[header] = id ?? "";
    else if (header === H_LAST_MODIFIED) columns[header] = record.ran_at ? runDate(record.ran_at) : "";
    else if (header === H_TAG || header === H_PLANT_BATCH_TAG) columns[header] = tag ?? "";
    else if (header === H_HARVEST_NAME) columns[header] = "";
    else if (header === H_REQUEST) columns[header] = record.request_url ? `GET ${record.request_url}` : "";
    else if (header === H_JSON || header === H_JSON_DOUBLE) columns[header] = record.response_body ?? "";
    else if (tab.name_column && header === tab.name_column) columns[header] = name ?? "";
    else columns[header] = "";
  }
  record.columns = columns;
}

function doneStatus(status: number, notes: string[]): string {
  return notes.length ? `done ${status} (${notes.join("; ")})` : `done ${status}`;
}

/** One E1 step for one facility (eval_steps sections 2.1 to 2.10). */
async function runStep(s: Session, tab: EvalTabDef, def: EvalStepDef, license: string, found: Found): Promise<StepRecord> {
  const key = def.key as E1Key;
  s.runOrder.push(`${key} ${license}`);
  const record = blankStep(def, tab.tab, "", null);
  if (!budgetLeft(s)) {
    record.status = EVAL_BUDGET_STATUS;
    record.reason = `the run budget of ${s.config.maxCalls} calls is spent`;
    return record;
  }
  const paging = { pageNumber: "1", pageSize: String(s.config.pageSize) };
  let call: StepCall | null = null;
  let notes: string[] = [];
  let one = false;
  let cannot: { status: string; reason: string | null } | null = null;
  const probeNote = (path: string): string | null => {
    if (found.unusable.has(path)) return `the probe ${path} answered a first Id that is not usable in a path, so it was not sent`;
    const status = found.probeStatus.get(path);
    return status && status !== "done 200" ? `the probe ${path} read ${status}` : null;
  };
  const byId = (path: string, id: string | null, probe: string, record_name: string, from: string, extra: string[]): void => {
    if (!id) {
      cannot = { status: `cannot run: needs ${record_name} from ${from}`, reason: probeNote(probe) ?? `the probe ${probe} found no ${record_name} on this facility` };
      return;
    }
    // licenseNumber is optional on the by-id routes and sent (lines 11 to 12 of each docs file).
    call = { path: path.replace("{id}", encodeURIComponent(id)), query: { licenseNumber: license }, license, license_source: "sent", window: null, retryNarrow: false };
    notes = [...extra, "existing record, Q6"];
    one = true;
  };
  switch (key) {
    case "L3":
      byId("/locations/v2/{id}", found.locationId, "/locations/v2/active", "location", "Step 1 (POST /locations/v2/)", []);
      break;
    case "S3":
      byId("/strains/v2/{id}", found.strainId, "/strains/v2/active", "strain", "Step 1 (POST /strains/v2/)", []);
      break;
    case "I3":
      byId("/items/v2/{id}", found.itemId, "/items/v2/active", "item", "Step 1 (POST /items/v2/)", ["docs path"]);
      break;
    case "T1":
    case "T2":
    case "X2":
    case "TT2": {
      const window = evalWindow(Date.parse(s.now()), s.config.windowDays);
      call = {
        path: def.path_sent as string,
        query: { licenseNumber: license, lastModifiedStart: window.lastModifiedStart, lastModifiedEnd: window.lastModifiedEnd, ...paging },
        license,
        license_source: "sent",
        window,
        retryNarrow: true,
      };
      if (key === "TT2") {
        notes = ["docs path"];
        record.reason = TT2_NOTE;
      }
      break;
    }
    case "T3":
      call = { path: def.path_sent as string, query: { licenseNumber: license, ...paging }, license, license_source: "sent", window: null, retryNarrow: false };
      break;
    case "T4": {
      if (!found.transferId) {
        const unusable = ["Step 1", "Step 2", "Step 3"].filter((name) => found.unusable.has(name));
        cannot = {
          status: "cannot run: needs transfer Id from Step 1, 2 or 3",
          reason: unusable.length
            ? `${unusable.join(", ")} answered a first Id that is not usable in a path, so it was not sent; no other step found a transfer on this facility`
            : "Steps 1 to 3 found no transfer on this facility",
        };
        break;
      }
      call = {
        path: `/transfers/v2/${encodeURIComponent(found.transferId.id)}/deliveries`,
        query: { ...paging },
        license: null,
        license_source: `parent call ${found.transferId.from}`,
        window: null,
        retryNarrow: false,
      };
      break;
    }
    case "T5":
    case "T6": {
      if (!found.deliveryId) {
        cannot = {
          status: "cannot run: needs delivery Id from Step 4",
          reason: found.unusable.has("Step 4") ? "Step 4 answered a first delivery Id that is not usable in a path, so it was not sent" : "Step 4 found no delivery",
        };
        break;
      }
      const tail = key === "T5" ? "packages" : "packages/wholesale";
      call = {
        path: `/transfers/v2/deliveries/${encodeURIComponent(found.deliveryId)}/${tail}`,
        query: { ...paging },
        license: null,
        license_source: "parent call Step 4",
        window: null,
        retryNarrow: false,
      };
      notes = ["docs path"];
      break;
    }
    case "TT3": {
      if (!found.templateId) {
        cannot = {
          status: "cannot run: needs template from Step 1a or 1b (POST /transfers/v2/templates/outgoing)",
          reason: probeNote("/transfers/v2/templates/outgoing") ?? "the probe /transfers/v2/templates/outgoing found no template on this facility",
        };
        break;
      }
      call = {
        path: `/transfers/v2/templates/outgoing/${encodeURIComponent(found.templateId)}/deliveries`,
        query: { ...paging },
        license: null,
        license_source: "parent probe /transfers/v2/templates/outgoing",
        window: null,
        retryNarrow: false,
      };
      notes = ["docs path", "existing record, Q6"];
      break;
    }
  }
  if (cannot) {
    const c = cannot as { status: string; reason: string | null };
    record.status = c.status;
    record.reason = c.reason;
    if (key === "X2" && found.flags.externalIncoming === false) {
      record.reason = [record.reason, "CanTransferFromExternalFacilities reads false on this facility, so Step 1a cannot create one (eval_steps 2.10)"].filter(Boolean).join("; ");
    }
    return record;
  }
  if (!call) return record;
  const c = call as StepCall;
  record.ran_at = s.now();
  const { out, window, attempts } = await stepCall(s, c);
  record.request_url = out.request_url;
  record.response_status = out.status;
  record.license_source = c.license_source;
  record.window = window;
  record.attempts = attempts;
  if (c.license_source !== "sent") {
    record.reason = `licenseNumber is not a parameter of this path (${def.docs_file}); License Facility is the ${c.license_source}'s license`;
  }
  if (out.status !== 200) {
    record.status = `failed ${out.status}`;
    record.reason = [record.reason, out.reason].filter(Boolean).join("; ") || null;
    if (out.body != null) {
      const body = minified(out.body, s.keys);
      record.response_body = body.text;
      record.truncated = body.truncated;
    }
    fillColumns(tab, record, license, [], null);
    return record;
  }
  const body = minified(out.body, s.keys);
  record.response_body = body.text;
  record.truncated = body.truncated;
  const rows = one ? [] : rowsOf(out.body);
  fillColumns(tab, record, license, rows, one ? out.body : null);
  if (key === "T4") {
    const transfer = found.transferId as NonNullable<Found["transferId"]>;
    found.deliveryId = takeId(found, def.step, firstId(rows));
    record.reason = [
      record.reason,
      `{id} is the Transfer Id ${transfer.id} (Q10)${transfer.manifest ? `; its ManifestNumber ${transfer.manifest} rides in ${transfer.from}'s JSON` : ""}`,
    ]
      .filter(Boolean)
      .join("; ");
  }
  if (!one && rows.length === 0) {
    if (key === "T1" || key === "T2" || key === "T3") {
      const what = key === "T1" ? "incoming transfer" : key === "T2" ? "outgoing transfer" : "rejected transfer";
      record.status = `cannot run: sandbox lacks ${what}; fix: none documented, ask Metrc`;
      record.reason = [record.reason, "the call answered 200 with no record, so the step is not verifiable (Instructions B26)"].filter(Boolean).join("; ");
      return record;
    }
    if (key === "X2") {
      record.status = "cannot run: needs external incoming transfers from Step 1a and 1b (POST /transfers/v2/external/incoming)";
      record.reason = [
        record.reason,
        "the windowed call answered 200 with no record",
        found.flags.externalIncoming === false ? "CanTransferFromExternalFacilities reads false on this facility (eval_steps 2.10)" : null,
      ]
        .filter(Boolean)
        .join("; ");
      return record;
    }
    if (key === "TT2") {
      record.status = "cannot run: needs templates from Step 1a and 1b (POST /transfers/v2/templates/outgoing)";
      record.reason = [record.reason, "the windowed call answered 200 with no record"].filter(Boolean).join("; ");
      return record;
    }
  }
  if ((key === "T1" || key === "T2" || key === "T3") && !found.transferId) {
    const id = takeId(found, def.step, firstId(rows));
    if (id) found.transferId = { id, from: def.step, manifest: field(rows[0], "ManifestNumber") };
  }
  record.status = doneStatus(out.status, notes);
  return record;
}

function roleTabs(role: FacilityRole): EvalTabDef[] {
  if (role === "none") return [];
  const grow = role === "grow" || role === "grow_processor";
  return EVAL_TABS.filter((tab) => tab.applies_to === "both" || grow);
}

const E1_ORDER: E1Key[] = ["T1", "T2", "T3", "T4", "T5", "T6", "L3", "S3", "I3", "X2", "TT2", "TT3"];

async function runFacility(s: Session, facility: FacilityRecord, rawFacilities: unknown, probes: ProbeRecord[], onceDone: Set<string>): Promise<TabRecord[]> {
  const license = facility.license;
  const found: Found = {
    locationId: null,
    strainId: null,
    itemId: null,
    templateId: null,
    probeStatus: new Map(),
    transferId: null,
    deliveryId: null,
    unusable: new Set(),
    flags: {
      openingBalance: flagOf(rawFacilities, license, "CanCreateOpeningBalancePlantBatches"),
      motherPlants: flagOf(rawFacilities, license, "PlantBatchesCanContainMotherPlants"),
      externalIncoming: flagOf(rawFacilities, license, "CanTransferFromExternalFacilities"),
    },
  };
  for (const def of EVAL_PROBES) {
    if (!def.license) {
      if (onceDone.has(def.path)) continue;
      onceDone.add(def.path);
    }
    const { record, rows } = await runProbe(s, def, def.license ? license : null);
    probes.push(record);
    found.probeStatus.set(def.path, record.status);
    if (def.path === "/locations/v2/active") found.locationId = takeId(found, def.path, firstId(rows));
    if (def.path === "/strains/v2/active") found.strainId = takeId(found, def.path, firstId(rows));
    if (def.path === "/items/v2/active") found.itemId = takeId(found, def.path, firstId(rows));
    if (def.path === "/transfers/v2/templates/outgoing") found.templateId = takeId(found, def.path, firstId(rows));
  }
  const tabs = roleTabs(facility.role);
  const byKey = new Map<E1Key, { tab: EvalTabDef; def: EvalStepDef }>();
  for (const tab of tabs) for (const def of tab.steps) if (def.key) byKey.set(def.key, { tab, def });
  const results = new Map<E1Key, StepRecord>();
  for (const key of E1_ORDER) {
    const hit = byKey.get(key);
    if (!hit) continue;
    results.set(key, await runStep(s, hit.tab, hit.def, license, found));
  }
  return tabs.map((tab) => ({
    nn: tab.nn,
    file: tab.file,
    tab: tab.tab,
    applies_to: tab.applies_to,
    license,
    steps: tab.steps.map((def) => {
      if (def.key) return results.get(def.key) ?? blankStep(def, tab.tab, EVAL_BUDGET_STATUS, null);
      const row = blankStep(def, tab.tab, EVAL_E2_STATUS, EVAL_E2_REASON);
      if (tab.nn === "09" && def.step === "Step 1" && found.flags.openingBalance != null) {
        row.reason = `${row.reason} The thin-air route POST /plantbatches/v2/plantings needs CanCreateOpeningBalancePlantBatches true; P0 reads ${found.flags.openingBalance} on this facility (eval_steps section 3).`;
      }
      if (tab.nn === "09" && def.step === "Step 2" && found.flags.motherPlants != null) {
        row.reason = `${row.reason} PlantBatchesCanContainMotherPlants reads ${found.flags.motherPlants} on this facility (eval_steps 2.4, C2).`;
      }
      if (tab.nn === "22" && (def.step === "Step 1a" || def.step === "Step 1b") && found.flags.externalIncoming != null) {
        row.reason = `${row.reason} CanTransferFromExternalFacilities reads ${found.flags.externalIncoming} on this facility (eval_steps 2.10).`;
      }
      return row;
    }),
  }));
}

/** The pack's file names: one CSV per facility and tab, one JSON. Two
 * licenses that differ only in punctuation (123/ABC and 123 ABC) would share
 * a safe name, and the CSV route finds a tab by its name's position, so the
 * second and later such licenses carry a -2, -3 suffix; the names stay one to
 * one with the tabs, in order. */
export function packFileNames(pack: Pick<EvalPack, "meta" | "tabs">): string[] {
  const stamp = packStamp(pack.meta.generated_at);
  const safeByLicense = new Map<string, string>();
  const taken = new Set<string>();
  for (const tab of pack.tabs) {
    if (safeByLicense.has(tab.license)) continue;
    const base = safeName(tab.license);
    let candidate = base;
    for (let n = 2; taken.has(candidate); n++) candidate = `${base}-${n}`;
    taken.add(candidate);
    safeByLicense.set(tab.license, candidate);
  }
  const names = pack.tabs.map((tab) => `metrc_eval_${stamp}_${safeByLicense.get(tab.license)}_${tab.file}.csv`);
  names.push(`metrc_eval_${stamp}.json`);
  return names;
}

export function packStamp(iso: string): string {
  return `${iso.slice(0, 10).replace(/-/g, "")}T${iso.slice(11, 16).replace(":", "")}Z`;
}

function safeName(text: string): string {
  return text.replace(/[^A-Za-z0-9-]+/g, "_").slice(0, EVAL_FILE_LICENSE_CAP);
}

/** The steps_json cap (eval_steps section 7, Phase E choice): over the limit,
 * drop the probe samples first, then truncate every response body (the
 * step's and its JSON column's) to 2,000 characters, in that order, naming
 * each cut in meta.cuts. Two more cuts stand behind those so the row can
 * always be stored (D1 refuses a row over 2,000,000 bytes, and a refused
 * INSERT would lose every call the run made): the third blanks every body
 * and JSON cell (response_bodies_0; statuses, requests and the other columns
 * stay), and if the pack is still over the limit it is dropped to its meta,
 * facilities and P0 (pack_dropped), with the run's status set to failed. */
export function capPack(pack: EvalPack, limit = EVAL_STEPS_JSON_CAP): { json: string; bytes: number } {
  const encoder = new TextEncoder();
  const measure = (): { json: string; bytes: number } => {
    const json = JSON.stringify(pack);
    return { json, bytes: encoder.encode(json).length };
  };
  let out = measure();
  if (out.bytes <= limit) return out;
  for (const probe of pack.probes) probe.sample = null;
  pack.meta.cuts.push("probe_bodies");
  out = measure();
  if (out.bytes <= limit) return out;
  for (const tab of pack.tabs) {
    for (const step of tab.steps) {
      if (step.response_body && step.response_body.length > EVAL_BODY_CUT) {
        step.response_body = step.response_body.slice(0, EVAL_BODY_CUT);
        step.truncated = true;
      }
      for (const header of [H_JSON, H_JSON_DOUBLE]) {
        const cell = step.columns[header];
        if (cell && cell.length > EVAL_BODY_CUT) step.columns[header] = cell.slice(0, EVAL_BODY_CUT);
      }
    }
  }
  pack.meta.cuts.push(`response_bodies_${EVAL_BODY_CUT}`);
  out = measure();
  if (out.bytes <= limit) return out;
  for (const tab of pack.tabs) {
    for (const step of tab.steps) {
      if (step.response_body) {
        step.response_body = "";
        step.truncated = true;
      }
      for (const header of [H_JSON, H_JSON_DOUBLE]) if (step.columns[header]) step.columns[header] = "";
    }
  }
  pack.meta.cuts.push("response_bodies_0");
  out = measure();
  if (out.bytes <= limit) return out;
  pack.probes = [];
  pack.tabs = [];
  pack.run_order = [];
  pack.meta.cuts.push("pack_dropped");
  pack.meta.status = "failed";
  pack.meta.files = packFileNames(pack);
  return measure();
}

/** Phase E1: P0, the probes, then the workbook's GET steps per chosen
 * facility, each call through metrcGet within the run budget; the pack is
 * scrubbed, capped and stored as one metrc_eval_runs row. Keys absent or a
 * host that is not a sandbox: no call, no row. */
export async function runEval(env: MetrcEnv, deps: EvalDeps = {}): Promise<EvalRunResult> {
  const present = keysPresent(env);
  if (!present.integrator || !present.user) return { code: "absent", run: null };
  if (!evalPageActive(env)) return { code: "host", run: null };
  const now = deps.now ?? nowIso;
  const integrator = (env.METRC_INTEGRATOR_KEY ?? "").trim();
  const user = (env.METRC_USER_KEY ?? "").trim();
  const config = await loadMetrcEvalConfig(env.DB);
  const s: Session = {
    env,
    host: metrcHost(env),
    keys: scrubSpellings([integrator, user, basicToken(integrator, user)]),
    config,
    fetchImpl: boundedFetch(deps.fetchImpl ?? fetch, deps.responseBytesCap ?? EVAL_RESPONSE_BYTES_CAP),
    sleep: deps.sleep,
    now,
    clock: deps.clock,
    calls: 0,
    runOrder: [],
  };
  const started = now();
  const id = crypto.randomUUID();
  const pack: EvalPack = {
    meta: {
      generated_at: started,
      host: s.host,
      phase: EVAL_PHASE,
      brief: EVAL_BRIEF,
      workbook_sha256_prefix: EVAL_WORKBOOK_SHA,
      docs_fetch_date: EVAL_DOCS_FETCHED,
      docs_printable_list_sha256_prefix: EVAL_DOCS_LIST_SHA,
      config,
      calls: 0,
      status: "",
      cuts: [],
      files: [],
    },
    facilities: [],
    // P0: GET /facilities/v2, the path form Test connection already uses; no
    // parameters (GET_facilities_v2.txt line 11); the docs write a trailing slash (P11).
    p0: { step: "P0", verb: "GET", path_sent: "/facilities/v2", docs_file: "GET_facilities_v2.txt", request_url: null, response_status: null, status: "", reason: null, count: 0 },
    probes: [],
    run_order: s.runOrder,
    writes_outside_workbook: [],
    tabs: [],
  };
  s.runOrder.push("P0");
  const p0 = await callOnce(s, "/facilities/v2", {}, null);
  pack.p0.request_url = p0.request_url;
  pack.p0.response_status = p0.status;
  pack.p0.reason = p0.reason;
  let status: EvalRunCode;
  if (p0.status === 401 || p0.status === 403) {
    pack.p0.status = `refused ${p0.status}`;
    status = "refused";
  } else if (p0.status !== 200) {
    pack.p0.status = `failed ${p0.status}`;
    status = "failed";
  } else {
    pack.p0.status = "done 200";
    const facts = parseFacilities(p0.body);
    pack.p0.count = facts.length;
    pack.facilities = facts.map((f) => ({
      license: f.license,
      license_type: f.licenseType,
      can_grow_plants: f.canGrowPlants,
      can_record_processing_jobs: f.canRecordProcessingJobs,
      can_track_vegetative_plants: f.canTrackVegetativePlants,
      role: facilityRole(f),
    }));
    const onceDone = new Set<string>();
    for (const facility of pack.facilities) {
      if (facility.role === "none") continue;
      pack.tabs.push(...(await runFacility(s, facility, p0.body, pack.probes, onceDone)));
    }
    const e1Rows = pack.tabs.flatMap((tab) => tab.steps.filter((step) => step.phase === "E1"));
    status = e1Rows.length > 0 && e1Rows.every((step) => step.status.startsWith("done ")) ? "ok" : "partial";
  }
  pack.meta.calls = s.calls;
  pack.meta.status = status;
  pack.meta.files = packFileNames(pack);
  const capped = capPack(pack, deps.stepsJsonCap ?? EVAL_STEPS_JSON_CAP);
  if (pack.meta.cuts.includes("pack_dropped")) status = "failed";
  const finished = now();
  const run: EvalRunRow = {
    id,
    host: s.host,
    phase: EVAL_PHASE,
    started_at: started,
    finished_at: finished,
    status,
    calls: s.calls,
    steps_json: capped.json,
    bytes: capped.bytes,
  };
  await env.DB.prepare(
    `INSERT INTO metrc_eval_runs (id, host, phase, started_at, finished_at, status, calls, steps_json, bytes, created_at, created_by, updated_at, updated_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, NULL)`
  )
    .bind(run.id, run.host, run.phase, run.started_at, run.finished_at, run.status, run.calls, run.steps_json, run.bytes, finished, finished)
    .run();
  return { code: status, run };
}

// ---------------------------------------------------------------- the pack files

export async function loadEvalRun(db: D1Database, id: string): Promise<EvalRunRow | null> {
  const row = await db
    .prepare(`SELECT id, host, phase, started_at, finished_at, status, calls, steps_json, bytes FROM metrc_eval_runs WHERE id = ? AND deleted_at IS NULL`)
    .bind(id)
    .first<EvalRunRow>();
  return row ?? null;
}

export function packOf(run: Pick<EvalRunRow, "steps_json">): EvalPack {
  return JSON.parse(run.steps_json) as EvalPack;
}

/** The JSON file, pretty-printed from the stored (minified, scrubbed) row. */
export function evalJsonFile(pack: EvalPack): { name: string; body: string } {
  return { name: `metrc_eval_${packStamp(pack.meta.generated_at)}.json`, body: JSON.stringify(pack, null, 2) };
}

/** Excel reads a cell that starts with =, +, - or @ (or a tab or CR) as a
 * formula, and the CSVs are made to be opened there. Such a cell gets a
 * leading apostrophe, which Excel shows as text. Only vendor text can start
 * so (a Name, a Label): the runner's own cells start with a word, a digit, a
 * cell address, "GET " or the JSON's { or [, so nothing else is touched; the
 * JSON column still holds the value as Metrc sent it. */
function csvSafe(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

/** One CSV per facility and tab (RFC 4180 quoting through csvCell, CRLF
 * rows): Step, Paste at, the tab's row-4 headers in order, Runner status,
 * Runner note. A step not run keeps its row with blank cells. */
export function evalCsvFile(pack: EvalPack, name: string): { name: string; body: string } | null {
  const names = packFileNames(pack);
  const at = names.indexOf(name);
  if (at < 0 || at >= pack.tabs.length) return null;
  const tab = pack.tabs[at];
  const def = EVAL_TABS.find((d) => d.nn === tab.nn);
  if (!def) return null;
  const headers = ["Step", "Paste at", ...def.headers, "Runner status", "Runner note"];
  const lines = [headers.map(csvCell).join(",")];
  for (const step of tab.steps) {
    const cells = [step.step, step.anchor, ...def.headers.map((h) => step.columns[h] ?? ""), step.status, step.reason ?? ""];
    lines.push(cells.map((cell) => csvCell(csvSafe(cell))).join(","));
  }
  return { name, body: `${lines.join("\r\n")}\r\n` };
}

// ---------------------------------------------------------------- the Admin page

export type EvalRunListed = { id: string; started_at: string; finished_at: string | null; status: string; calls: number; bytes: number; files: string[] };

export type MetrcEvalAdmin = {
  integrator: boolean;
  user: boolean;
  host: string;
  active: boolean;
  config: MetrcEvalConfig;
  facilities: FacilityRecord[];
  runs: EvalRunListed[];
};

function parseList<T>(text: unknown): T[] {
  if (text == null) return [];
  try {
    const value = JSON.parse(String(text)) as unknown;
    return Array.isArray(value) ? (value as T[]) : [];
  } catch {
    return [];
  }
}

export async function loadMetrcEvalAdmin(env: MetrcEnv): Promise<MetrcEvalAdmin> {
  const keys = keysPresent(env);
  const host = metrcHost(env);
  const [config, runs, latest] = await Promise.all([
    loadMetrcEvalConfig(env.DB),
    env.DB.prepare(
      `SELECT id, started_at, finished_at, status, calls, bytes, json_extract(steps_json, '$.meta.files') AS files
       FROM metrc_eval_runs WHERE deleted_at IS NULL ORDER BY started_at DESC LIMIT ${EVAL_RUNS_LISTED}`
    ).all<{ id: string; started_at: string; finished_at: string | null; status: string; calls: number; bytes: number; files: unknown }>(),
    env.DB.prepare(
      `SELECT json_extract(steps_json, '$.facilities') AS facilities FROM metrc_eval_runs WHERE deleted_at IS NULL AND host = ? ORDER BY started_at DESC LIMIT 1`
    )
      .bind(host)
      .first<{ facilities: unknown }>(),
  ]);
  return {
    integrator: keys.integrator,
    user: keys.user,
    host,
    active: evalPageActive(env),
    config,
    facilities: parseList<FacilityRecord>(latest?.facilities),
    runs: (runs.results ?? []).map((row) => ({
      id: row.id,
      started_at: row.started_at,
      finished_at: row.finished_at,
      status: row.status,
      calls: Number(row.calls),
      bytes: Number(row.bytes),
      files: parseList<string>(row.files),
    })),
  };
}

const HELP_ACTIVE =
  "Whether the runner may call Metrc at all. It is active only when METRC_API_BASE in wrangler.toml names a sandbox host; on a production host nothing is sent and no form is shown.";
const HELP_KEY = "Whether this wrangler secret is set, presence only; the value never reaches a page. With a key absent the run button makes no call.";
/** Law 9: the lookup path in the canon form Admin\Data Lookups\<Category>\<LookupFieldName> (src/lookups.ts). */
const HELP_CONFIG =
  "The run budget (metrc_eval_max_calls), the lastModified window in days for the transfer and template searches (metrc_eval_window_days) and the page size (metrc_page_size). Admin\\Data Lookups\\People and System\\App config";
const HELP_FACILITIES =
  "The facilities GET /facilities/v2 returned on the last run, with the two flags that choose the tabs: CanGrowPlants runs the Grow tabs and CanRecordProcessingJobs the Processor tabs (Q15: confirm the list). A facility with neither is listed and not run.";
const HELP_RUN =
  "Runs Phase E1 now: GET /facilities/v2, the supporting reads, then the workbook's GET steps per facility, within the run budget. Nothing is written to Metrc.";
const HELP_RUNS = "Each run with its pack: the JSON of everything, and one CSV per facility and tab shaped to paste one row at its workbook anchor.";
const HELP_COVERS = "What Phase E1 covers, from the derived step list (eval_steps section 4). Write steps read E2 not enabled until the owner's word.";
const HELP_FLASH = "The outcome of the last Run E1 now: ok, partial (the pack says which steps could not run), refused (Metrc refused the keys at GET /facilities/v2), failed, absent (a key is not set) or host (not a sandbox host).";
const HELP_JSON_LINK =
  "The JSON of this run: meta, the facility keep-list, P0, the probe summaries and every step row with its minified response, scrubbed of every key and Authorization text and capped at 1.5 MB.";
const HELP_CSV_LINK =
  "One CSV for this facility and tab: one row per workbook step, to paste one at a time at its Paste at cell; the Step, Paste at, Runner status and Runner note columns are the runner's and are not pasted.";

/** A word from a plain-object table, own keys only (a code such as
 * "constructor" from the query string must not read the prototype). */
function own<T>(table: Record<string, T>, key: string): T | undefined {
  return Object.prototype.hasOwnProperty.call(table, key) ? table[key] : undefined;
}
const COVERS =
  "What E1 covers: 12 GET steps across the applicable tabs (Locations Step 3, Strains Step 3, Items Step 3, GET Transfers and Wholesale Steps 1 to 6, Transfer Templates Steps 2 and 3, Transfer External Incoming Step 2). A by-id step runs only when the sandbox already holds a record; the other steps read E2 not enabled.";
const ROLE_WORDS: Record<FacilityRole, string> = {
  grow: "Grow",
  processor: "Processor",
  grow_processor: "Grow and Processor",
  none: "neither, not run",
};
const RUN_WORDS: Record<string, string> = {
  ok: "The run finished: every GET step answered.",
  partial: "The run finished with steps that could not run; the pack says why.",
  refused: "Metrc refused the keys.",
  failed: "Metrc did not answer.",
};

export function metrcEvalPage(data: MetrcEvalAdmin, locale: Locale, ok: string | null): string {
  const keyLine = (name: "integrator" | "user", present: boolean) =>
    `<p data-metrc-eval-${name}="${present ? "present" : "absent"}" title="${esc(t(locale, HELP_KEY))}">${esc(t(locale, name === "integrator" ? "Integrator key" : "User key"))}: ${esc(
      t(locale, present ? "present" : "absent")
    )}</p>`;
  const absentFlash = [data.integrator ? "" : t(locale, "The integrator key is absent."), data.user ? "" : t(locale, "The user key is absent.")].filter(Boolean).join(" ");
  const flashHelp = esc(t(locale, HELP_FLASH));
  const runWord = ok ? own(RUN_WORDS, ok) : undefined;
  const flash =
    ok === "absent"
      ? `<p class="banner err" data-metrc-eval-flash="absent" title="${flashHelp}">${esc(absentFlash)}</p>`
      : ok === "host"
        ? `<p class="banner err" data-metrc-eval-flash="host" title="${flashHelp}">${esc(t(locale, EVAL_SANDBOX_ONLY))}</p>`
        : ok && runWord
          ? `<p class="banner ${ok === "ok" ? "ok" : "err"}" data-metrc-eval-flash="${esc(ok)}" title="${flashHelp}">${esc(t(locale, runWord))}</p>`
          : "";
  const head = `<h1 title="${esc(t(locale, HELP_COVERS))}">${esc(t(locale, "Metrc evaluation"))}</h1>
    ${flash}
    <p data-metrc-eval-host="${esc(data.host)}" title="${esc(t(locale, HELP_ACTIVE))}">${esc(t(locale, "Base"))}: ${esc(data.host)}</p>`;
  if (!data.active) {
    return `${head}
    <p data-metrc-eval-active="no" title="${esc(t(locale, HELP_ACTIVE))}">${esc(t(locale, EVAL_SANDBOX_ONLY))}</p>`;
  }
  // The three keep-list flags ride as Metrc's own field names with their stored 0 or 1 (null reads as a dash-free blank).
  const flagText = (f: FacilityRecord): string =>
    `[CanGrowPlants ${f.can_grow_plants ?? ""}, CanRecordProcessingJobs ${f.can_record_processing_jobs ?? ""}, CanTrackVegetativePlants ${f.can_track_vegetative_plants ?? ""}]`;
  const facilitiesHelp = esc(t(locale, HELP_FACILITIES));
  const facilities = data.facilities.length
    ? `<ul title="${facilitiesHelp}">${data.facilities
        .map(
          (f) =>
            `<li data-metrc-eval-facility="${esc(f.license)}" data-metrc-eval-role="${esc(f.role)}" title="${facilitiesHelp}">${esc(f.license)}${
              f.license_type ? ` (${esc(f.license_type)})` : ""
            }: ${esc(t(locale, own(ROLE_WORDS, f.role) ?? ROLE_WORDS.none))} ${esc(flagText(f))}</li>`
        )
        .join("")}</ul>`
    : `<p class="muted" data-metrc-eval-facilities="none" title="${facilitiesHelp}">${esc(t(locale, "No run yet, so no facilities are known."))}</p>`;
  const keysOk = data.integrator && data.user;
  const button = `<form method="post" action="${ADMIN_METRC_EVAL_PATH}/run" title="${esc(t(locale, HELP_RUN))}">
      <button type="submit" data-metrc-eval-run${keysOk ? "" : " disabled"} title="${esc(t(locale, HELP_RUN))}">${esc(t(locale, "Run E1 now"))}</button>
      ${keysOk ? "" : `<p class="muted" data-metrc-eval-absent title="${esc(t(locale, HELP_KEY))}">${esc(t(locale, "The keys are absent, so no call is made."))}</p>`}
    </form>`;
  const runsHelp = esc(t(locale, HELP_RUNS));
  const jsonHelp = esc(t(locale, HELP_JSON_LINK));
  const csvHelp = esc(t(locale, HELP_CSV_LINK));
  const runs = data.runs.length
    ? `<ul title="${runsHelp}">${data.runs
        .map((run) => {
          const csvs = run.files.filter((name) => name.endsWith(".csv"));
          const links = [
            `<a href="${ADMIN_METRC_EVAL_PATH}/runs/${esc(run.id)}/json" data-metrc-eval-json="${esc(run.id)}" title="${jsonHelp}">JSON</a>`,
            ...csvs.map(
              (name) => `<a href="${ADMIN_METRC_EVAL_PATH}/runs/${esc(run.id)}/csv/${esc(name)}" data-metrc-eval-csv="${esc(name)}" title="${csvHelp}">${esc(name)}</a>`
            ),
          ].join(" ");
          return `<li data-metrc-eval-run-id="${esc(run.id)}" data-metrc-eval-status="${esc(run.status)}" title="${runsHelp}">${esc(
            tFill(locale, "{started}: {status}, {calls} calls, {bytes} bytes", {
              started: easternStamp(run.started_at),
              status: run.status,
              calls: String(run.calls),
              bytes: String(run.bytes),
            })
          )} ${links}</li>`;
        })
        .join("")}</ul>`
    : `<p class="muted" data-metrc-eval-runs="none" title="${runsHelp}">${esc(t(locale, "No runs yet."))}</p>`;
  return `${head}
    <p data-metrc-eval-active="yes" title="${esc(t(locale, HELP_ACTIVE))}">${esc(t(locale, "Runner: active on this sandbox host."))}</p>
    ${keyLine("integrator", data.integrator)}
    ${keyLine("user", data.user)}
    <p data-metrc-eval-config="${data.config.maxCalls},${data.config.windowDays},${data.config.pageSize}" title="${esc(t(locale, HELP_CONFIG))}">${esc(
      tFill(locale, "Budget: {calls} calls per run; window: {days} days; page size: {size}.", {
        calls: String(data.config.maxCalls),
        days: String(data.config.windowDays),
        size: String(data.config.pageSize),
      })
    )}</p>
    <section data-metrc-eval-facilities-list title="${facilitiesHelp}">
      <h2 title="${facilitiesHelp}">${esc(t(locale, "Facilities from the last run"))}</h2>
      ${facilities}
    </section>
    ${button}
    <section data-metrc-eval-runs-list title="${runsHelp}">
      <h2 title="${runsHelp}">${esc(t(locale, "Runs"))}</h2>
      ${runs}
    </section>
    <p data-metrc-eval-covers title="${esc(t(locale, HELP_COVERS))}">${esc(t(locale, COVERS))}</p>`;
}

/** Every page string, EN keys, for the dictionary and its test. */
export const EVAL_PAGE_STRINGS: readonly string[] = [
  "Metrc evaluation",
  EVAL_SANDBOX_ONLY,
  "Runner: active on this sandbox host.",
  "Budget: {calls} calls per run; window: {days} days; page size: {size}.",
  "Facilities from the last run",
  "No run yet, so no facilities are known.",
  "Run E1 now",
  "The keys are absent, so no call is made.",
  "Runs",
  "No runs yet.",
  "{started}: {status}, {calls} calls, {bytes} bytes",
  COVERS,
  HELP_ACTIVE,
  HELP_KEY,
  HELP_CONFIG,
  HELP_FACILITIES,
  HELP_RUN,
  HELP_RUNS,
  HELP_COVERS,
  HELP_FLASH,
  HELP_JSON_LINK,
  HELP_CSV_LINK,
  ...Object.values(ROLE_WORDS),
  ...Object.values(RUN_WORDS),
];
