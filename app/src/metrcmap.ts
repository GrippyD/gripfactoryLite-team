/**
 * MA1 Phase C, Law 2 (THE TRANSLATOR LAW, canon 0.30.390, TRANSLATION_MAP rule
 * R3): METRC's encodings are read in the METRC layer only. This module turns
 * one API JSON object into the same export-shaped cells the file door reads,
 * so shapePlantRow and shapePackageRow (metrc.ts) build the same rows for
 * both doors and nothing downstream changes. The mapping is the constant
 * tables below (the Mapping section's Tables 1, 2 and 3), one row per export
 * header or metrc_harvests column, so the report's table and the code cannot
 * drift; a test asserts the tables cover every header.
 *
 * The getter contract (Mapping section): a JSON null or a missing nested
 * object gives "" (never "null", which text() would keep and normalizeMetrcDate
 * would store raw); booleans give "true" or "false" (normalizeMetrcBool reads
 * "true" as 1); numbers go through String(n). The phase comes from the endpoint
 * called, never from the row. Date-only fields (A24) are untouched; date-time
 * fields (A25) are converted to the America/New_York calendar date first.
 *
 * Every API field named here appears in a docs example response; each row
 * cites its file and line under scratchpad/metrcdocs/endpoints/ (veg =
 * GET_plants_v2_vegetative.txt, flw = GET_plants_v2_flowering.txt, pkg =
 * GET_packages_v2_active.txt, hva = GET_harvests_v2_active.txt, hvi =
 * GET_harvests_v2_inactive.txt, plinact = GET_plants_v2_inactive.txt).
 * Rows the Mapping section marks UNRESOLVED take the candidate it lists first;
 * the parity dry run (Law 7, Law 9) can overturn each one.
 */

import { etDate } from "./farmday";
import {
  METRC_PACKAGE_COLUMNS,
  METRC_PLANT_COLUMNS,
  normalizeMetrcDate,
  phaseFromGrid,
  shapePackageRow,
  shapePlantRow,
  type MetrcHarvestRow,
  type MetrcKind,
  type MetrcPackageRow,
  type MetrcPlantRow,
} from "./metrc";

export type ApiObject = Record<string, unknown>;

export type ApiMapStatus = "SAME" | "RENAMED" | "DERIVED" | "LACKING";

/** One row of the mapping: the export header (or harvests column), the API
 * field as the docs example names it (nested as Parent.Child; blank when
 * LACKING), the transform, the status, the docs citation, and the reader. */
export type ApiMapRow = {
  header: string;
  field: string;
  transform: string;
  status: ApiMapStatus;
  docs: string;
  read: (obj: ApiObject, phase: string | null) => unknown;
};

/** The getter contract: null, undefined, a missing nested object, an object or
 * an array give ""; booleans "true" or "false"; numbers String(n). */
export function apiText(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "";
  if (typeof value === "string") return value;
  return "";
}

function field(obj: ApiObject, name: string): unknown {
  return obj[name];
}

/** A nested read: a null or missing parent gives undefined (so ""). */
function nested(obj: ApiObject, parent: string, name: string): unknown {
  const inner = obj[parent];
  if (!inner || typeof inner !== "object" || Array.isArray(inner)) return undefined;
  return (inner as ApiObject)[name];
}

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const ISO_DATETIME_RE = /^\d{4}-\d{2}-\d{2}T/;
const ZONE_RE = /(Z|[+-]\d{2}:?\d{2})$/i;

/** MA1 A25: a date-time field becomes the America/New_York calendar date
 * before normalizeMetrcDate, matching the floor's Eastern stamps (a UTC
 * instant after 20:00 Eastern would otherwise land on the next day). A
 * date-only value is untouched (A24). A date-time without a zone is read as
 * UTC (the docs show every date-time with an offset, gs:111), so the result
 * never depends on the process's own time zone. Anything else passes through
 * for normalizeMetrcDate to read. */
export function easternCalendarDate(value: unknown): string {
  if (typeof value !== "string") return apiText(value);
  const s = value.trim();
  if (!s || ISO_DATE_RE.test(s) || !ISO_DATETIME_RE.test(s)) return s;
  const iso = ZONE_RE.test(s) ? s : `${s}Z`;
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return s;
  return etDate(new Date(ms).toISOString());
}

/** Table 1. Plants: GET /plants/v2/vegetative and /flowering, the 10 export headers. */
export const PLANT_API_MAP: readonly ApiMapRow[] = [
  { header: "Tag", field: "Label", transform: "trim, upper-case (shapePlantRow)", status: "RENAMED", docs: "veg:38", read: (o) => field(o, "Label") },
  { header: "Strain", field: "StrainName", transform: "text()", status: "RENAMED", docs: "veg:48", read: (o) => field(o, "StrainName") },
  { header: "Location", field: "LocationName", transform: "text(), verbatim METRC words", status: "RENAMED", docs: "veg:50", read: (o) => field(o, "LocationName") },
  { header: "Sublocation", field: "SublocationName", transform: "text()", status: "RENAMED", docs: "veg:53", read: (o) => field(o, "SublocationName") },
  // Table 1 row 5, UNRESOLVED: which flags the export's Hold combines. First
  // candidate IsOnHold (veg:60); IsOnInvestigationHold (veg:62) is not ORed in.
  { header: "Hold", field: "IsOnHold", transform: "boolean to true/false, then normalizeMetrcBool", status: "DERIVED", docs: "veg:60", read: (o) => field(o, "IsOnHold") },
  { header: "Plant Batch", field: "PlantBatchName", transform: "text()", status: "RENAMED", docs: "veg:44", read: (o) => field(o, "PlantBatchName") },
  { header: "Plant Batch Type", field: "PlantBatchTypeName", transform: "text()", status: "RENAMED", docs: "veg:46", read: (o) => field(o, "PlantBatchTypeName") },
  // Table 1 row 8, UNRESOLVED: candidate (a), the plant's own PlantedDate
  // (veg:64), not the batch's PlantedDate from /plantbatches (no extra call).
  { header: "Plant Batch Date", field: "PlantedDate", transform: "normalizeMetrcDate (date-only, A24)", status: "DERIVED", docs: "veg:64", read: (o) => field(o, "PlantedDate") },
  // Table 1 row 9: the pick follows the endpoint, never the row (a flowering
  // row carries both dates, flw:65-66).
  {
    header: "Phase Date",
    field: "VegetativeDate | FloweringDate",
    transform: "VegetativeDate on the vegetative list, FloweringDate on the flowering list; normalizeMetrcDate",
    status: "DERIVED",
    docs: "veg:65, flw:66",
    read: (o, phase) => (phase === "flowering" ? field(o, "FloweringDate") : field(o, "VegetativeDate")),
  },
  // Table 1 row 10, UNRESOLVED: no boolean named Harvested. First candidate
  // HarvestedDate (veg:67 null; plinact:67 "2014-11-19"): "true" when
  // non-null, else "false". Never HarvestCount.
  {
    header: "Harvested",
    field: "HarvestedDate",
    transform: "true when HarvestedDate is non-null, else false; normalizeMetrcBool",
    status: "DERIVED",
    docs: "veg:67, plinact:67",
    read: (o) => field(o, "HarvestedDate") != null,
  },
];

/** Table 2. Packages: GET /packages/v2/active, the 22 export headers. */
export const PACKAGE_API_MAP: readonly ApiMapRow[] = [
  { header: "Tag", field: "Label", transform: "trim, upper-case (shapePackageRow)", status: "RENAMED", docs: "pkg:38", read: (o) => field(o, "Label") },
  // Table 2 row 2: the list separator is UNRESOLVED; the API string is kept
  // verbatim (comma-separated per the docs example xfer:44).
  { header: "Source Harvest(s)", field: "SourceHarvestNames", transform: "text(), the list verbatim", status: "RENAMED", docs: "pkg:44", read: (o) => field(o, "SourceHarvestNames") },
  { header: "Source Package(s)", field: "SourcePackageLabels", transform: "text(), the list verbatim", status: "RENAMED", docs: "pkg:45", read: (o) => field(o, "SourcePackageLabels") },
  // Table 2 row 4: the pairing is UNRESOLVED (a name match); nested, a null
  // ProductLabel gives "".
  {
    header: "Original Source Package Label",
    field: "ProductLabel.OriginalSourcePackageLabel",
    transform: "nested text()",
    status: "RENAMED",
    docs: "pkg:192",
    read: (o) => nested(o, "ProductLabel", "OriginalSourcePackageLabel"),
  },
  // Table 2 row 5, LACKING: the package object carries only
  // SourceProcessingJobCount (pkg:43), a count, never the names.
  { header: "Source Processing Job(s)", field: "", transform: "always blank (no API field)", status: "LACKING", docs: "pkg:43", read: () => "" },
  { header: "Location", field: "LocationName", transform: "text(), verbatim METRC words", status: "RENAMED", docs: "pkg:47", read: (o) => field(o, "LocationName") },
  { header: "Sublocation", field: "SublocationName", transform: "text()", status: "RENAMED", docs: "pkg:49", read: (o) => field(o, "SublocationName") },
  { header: "Item", field: "Item.Name", transform: "nested text()", status: "RENAMED", docs: "pkg:117", read: (o) => nested(o, "Item", "Name") },
  { header: "Category", field: "Item.ProductCategoryName", transform: "nested text() (never ProductCategoryType, a code)", status: "RENAMED", docs: "pkg:120", read: (o) => nested(o, "Item", "ProductCategoryName") },
  { header: "Item Strain", field: "Item.StrainName", transform: "nested text()", status: "RENAMED", docs: "pkg:134", read: (o) => nested(o, "Item", "StrainName") },
  { header: "Quantity", field: "Quantity", transform: "String(n), then num(); no rounding, no unit conversion", status: "SAME", docs: "pkg:51", read: (o) => field(o, "Quantity") },
  // Table 2 row 12: the Abbreviation (pkg:59 "oz"), never the Name (pkg:58):
  // the snapshot's uom holds only g and ea.
  { header: "Unit Of Measure", field: "UnitOfMeasureAbbreviation", transform: "text()", status: "RENAMED", docs: "pkg:59", read: (o) => field(o, "UnitOfMeasureAbbreviation") },
  { header: "Production Batch Number", field: "ProductionBatchNumber", transform: "text()", status: "RENAMED", docs: "pkg:77", read: (o) => field(o, "ProductionBatchNumber") },
  { header: "Source Production Batch", field: "SourceProductionBatchNumbers", transform: "text(), the list verbatim", status: "RENAMED", docs: "pkg:78", read: (o) => field(o, "SourceProductionBatchNumbers") },
  { header: "Lab Test Status", field: "LabTestingState", transform: "text() (the shared vocabulary of GET /labtests/v2/states)", status: "RENAMED", docs: "pkg:69", read: (o) => field(o, "LabTestingState") },
  { header: "Finished Goods", field: "IsFinishedGood", transform: "boolean to true/false, then normalizeMetrcBool (never IsFinished)", status: "RENAMED", docs: "pkg:110", read: (o) => field(o, "IsFinishedGood") },
  // Table 2 row 17, UNRESOLVED: IsOnHold (pkg:100), IsOnHoldCombined (pkg:101)
  // or IsOnInvestigationHold (pkg:103). First candidate IsOnHold.
  { header: "Administrative Hold", field: "IsOnHold", transform: "boolean to true/false, then normalizeMetrcBool", status: "DERIVED", docs: "pkg:100", read: (o) => field(o, "IsOnHold") },
  // Table 2 row 18, UNRESOLVED: IsOnRecall (pkg:105, null in the example),
  // IsOnRecallCombined (pkg:106) or IsOnInvestigationRecall (pkg:104). First
  // candidate IsOnRecall; a null gives "" and so 0.
  { header: "Administrative Recall", field: "IsOnRecall", transform: "boolean to true/false, then normalizeMetrcBool; null gives 0", status: "DERIVED", docs: "pkg:105", read: (o) => field(o, "IsOnRecall") },
  { header: "Packaged Date", field: "PackagedDate", transform: "normalizeMetrcDate; date-only, no zone conversion (A24)", status: "RENAMED", docs: "pkg:64", read: (o) => field(o, "PackagedDate") },
  // Table 2 row 20, UNRESOLVED zone: a date-time, converted to the
  // America/New_York calendar date first (A25), then normalizeMetrcDate.
  { header: "Received", field: "ReceivedDateTime", transform: "America/New_York calendar date (A25), then normalizeMetrcDate", status: "DERIVED", docs: "pkg:96", read: (o) => easternCalendarDate(field(o, "ReceivedDateTime")) },
  { header: "Expiration Date", field: "ExpirationDate", transform: "normalizeMetrcDate; date-only, no zone conversion (A24)", status: "RENAMED", docs: "pkg:65", read: (o) => field(o, "ExpirationDate") },
  // Table 2 row 22, UNRESOLVED pairing and zone: the only lab expiration
  // field in the example; the same conversion as row 20.
  {
    header: "Lab Test Expiration",
    field: "LabTestResultExpirationDateTime",
    transform: "America/New_York calendar date (A25), then normalizeMetrcDate",
    status: "DERIVED",
    docs: "pkg:72",
    read: (o) => easternCalendarDate(field(o, "LabTestResultExpirationDateTime")),
  },
];

/** Table 3. Harvests: GET /harvests/v2/active and /inactive (and /onhold in a
 * complete full pass) into the metrc_harvests columns of 0097, the required
 * rows in the table's order. The header column names the mirror column here;
 * license_value and state are DERIVED from the call and the list, so their
 * readers give "" and the sweep binds them (reconcileRows, shapeHarvestRow). */
export const HARVEST_API_MAP: readonly ApiMapRow[] = [
  { header: "harvest_id", field: "Id", transform: "whole number (A36: the key alone)", status: "RENAMED", docs: "hva:37", read: (o) => field(o, "Id") },
  { header: "name", field: "Name", transform: "trim, verbatim (matched case-insensitively, gs:127)", status: "RENAMED", docs: "hva:38", read: (o) => field(o, "Name") },
  // Table 3 row 3: the licenseNumber parameter of the call (hva:12), never a
  // row field (PatientLicenseNumber, hva:48, is a patient's); isKnownSiteLicense.
  { header: "license_value", field: "", transform: "the licenseNumber parameter of the call (isKnownSiteLicense), bound at write time", status: "DERIVED", docs: "hva:12", read: () => "" },
  { header: "harvest_start_date", field: "HarvestStartDate", transform: "normalizeMetrcDate (date-only, A24)", status: "RENAMED", docs: "hva:63", read: (o) => field(o, "HarvestStartDate") },
  { header: "finished_date", field: "FinishedDate", transform: "normalizeMetrcDate (date-only, A24); sets the 30-day scope", status: "RENAMED", docs: "hva:64, hvi:64", read: (o) => field(o, "FinishedDate") },
  { header: "archived_date", field: "ArchivedDate", transform: "normalizeMetrcDate (date-only, A24); the scope's fallback", status: "RENAMED", docs: "hva:65, hvi:97", read: (o) => field(o, "ArchivedDate") },
  { header: "total_wet_weight", field: "TotalWetWeight", transform: "num(), raw in the API's unit", status: "RENAMED", docs: "hva:52", read: (o) => field(o, "TotalWetWeight") },
  { header: "unit_of_weight", field: "UnitOfWeightName", transform: "text(), a Name verbatim (no abbreviation exists; no gram column, G-3)", status: "RENAMED", docs: "hva:56", read: (o) => field(o, "UnitOfWeightName") },
  { header: "location", field: "DryingLocationName", transform: "text(), verbatim METRC words", status: "RENAMED", docs: "hva:44", read: (o) => field(o, "DryingLocationName") },
  { header: "sublocation", field: "DryingSublocationName", transform: "text() (the name, never the id)", status: "RENAMED", docs: "hva:46", read: (o) => field(o, "DryingSublocationName") },
  { header: "state", field: "", transform: "the list the row came from: active, inactive or onhold", status: "DERIVED", docs: "hva:1, hvi:1", read: () => "" },
  { header: "plant_count", field: "PlantCount", transform: "num()", status: "RENAMED", docs: "hva:51", read: (o) => field(o, "PlantCount") },
];

/** The getter shapePlantRow and shapePackageRow take: one string per export
 * header, from the API object, the phase from the endpoint called. The row
 * argument is unused (the file door's cells); pass []. */
export function apiGetter(obj: ApiObject, kind: MetrcKind, phase: string | null): (row: string[], column: string) => string {
  const map = kind === "plants" ? PLANT_API_MAP : PACKAGE_API_MAP;
  const byHeader = new Map(map.map((row) => [row.header.toLowerCase(), row.read]));
  return (_row, column) => {
    const read = byHeader.get(column.toLowerCase());
    return read ? apiText(read(obj, phase)) : "";
  };
}

function isObject(value: unknown): value is ApiObject {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

/** One plant of the vegetative or flowering list as the export shapes it;
 * null when the object carries no Label. */
export function plantApiRow(value: unknown, phase: string | null): MetrcPlantRow | null {
  if (!isObject(value)) return null;
  return shapePlantRow(apiGetter(value, "plants", phase), []);
}

/** The phase the row itself names (GrowthPhase, veg:40 "Vegetative",
 * flw:40 "Flowering"), for the cross-check against the endpoint's phase. */
export function plantGrowthPhase(value: unknown): string | null {
  if (!isObject(value)) return null;
  return phaseFromGrid(apiText(value.GrowthPhase));
}

/** One package of the active list as the export shapes it; null without a Label. */
export function packageApiRow(value: unknown): MetrcPackageRow | null {
  if (!isObject(value)) return null;
  return shapePackageRow(apiGetter(value, "packages", null), []);
}

export type HarvestState = "active" | "inactive" | "onhold";

function textOrNull(value: unknown): string | null {
  const s = apiText(value).trim();
  return s ? s : null;
}

function numOrNull(value: unknown): number | null {
  const s = apiText(value).trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function dateOrNull(value: unknown): string | null {
  return normalizeMetrcDate(apiText(value));
}

/** MA1 Law 6: one harvest of the active, inactive or onhold list into the
 * metrc_harvests columns (Table 3). Null when the Id is not a whole number or
 * the Name is blank. The state is the list the row came from. */
export function shapeHarvestRow(value: unknown, state: HarvestState): MetrcHarvestRow | null {
  if (!isObject(value)) return null;
  const id = Number(apiText(value.Id));
  if (!Number.isInteger(id) || id < 0) return null;
  const name = apiText(value.Name).trim();
  if (!name) return null;
  return {
    harvest_id: id,
    name,
    harvest_start_date: dateOrNull(value.HarvestStartDate),
    finished_date: dateOrNull(value.FinishedDate),
    archived_date: dateOrNull(value.ArchivedDate),
    total_wet_weight: numOrNull(value.TotalWetWeight),
    unit_of_weight: textOrNull(value.UnitOfWeightName),
    location: textOrNull(value.DryingLocationName),
    sublocation: textOrNull(value.DryingSublocationName),
    state,
    plant_count: numOrNull(value.PlantCount),
  };
}

/** Law 5's "finished in the last N days" (A19): an inactive harvest is in
 * scope when its FinishedDate, falling back to ArchivedDate when that is null
 * (hvi:96-97), is at most N calendar days before today's UTC date. A row with
 * neither date cannot be placed and is out of scope (probe P9). Active and
 * onhold rows are always in scope. */
export function harvestInScope(row: Pick<MetrcHarvestRow, "state" | "finished_date" | "archived_date">, nowIso: string, days: number): boolean {
  if (row.state !== "inactive") return true;
  const date = row.finished_date ?? row.archived_date;
  if (!date) return false;
  const ms = Date.parse(`${date}T00:00:00.000Z`);
  const today = Date.parse(`${String(nowIso).slice(0, 10)}T00:00:00.000Z`);
  if (!Number.isFinite(ms) || !Number.isFinite(today)) return false;
  return today - ms <= Math.max(0, days) * 86_400_000;
}

/** The headers the plant and package tables must cover, for the drift test. */
export const PLANT_HEADERS: readonly string[] = METRC_PLANT_COLUMNS;
export const PACKAGE_HEADERS: readonly string[] = METRC_PACKAGE_COLUMNS;
