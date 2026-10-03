/**
 * THE LAB STATION (canon 0.30.362). The lab package's rules (lab_rules.js),
 * in TypeScript: what a bench reading, a compliance sample, an Orange
 * Photonics result and a sampling schedule cell must look like before they
 * land, plus the pick lists every form offers.
 *
 * WHY ONE MODULE. The workbook this replaces ("In Testing (2026)") kept its
 * rules in four places that drifted: a VBA macro that expanded a 5 digit serial
 * into a Metrc tag and stamped the time, data validation lists that differed
 * between row ranges of the same column, a LET formula that decided "Ready" off
 * another sheet, and percent formatted cells that stored 0.417 for 41.7. The
 * station page, the API and the feeds all import THIS file, so there is
 * exactly one answer to "is this a valid reading".
 *
 * Every validate* function returns { ok: true, row } or { ok: false, error }
 * and never throws. Values are never silently fixed: a moisture of 120 is
 * refused, not clamped, and the refusal names the field.
 *
 * Departures from the package, named: REASONS carries no personnel name
 * ("Named request" stands in); pick-list and alias lookups read own properties
 * only, so "constructor" is not a status; an over-long text that the package
 * would have thrown on or stored as a symbol is refused with its slug.
 */

import { isRetestTest } from "./labvocab";

// ---------------------------------------------------------------- types

/** An inclusive [low, high] bound. */
export type Range = readonly [number, number];

/** A refusal: the slug names the field or the rule. */
export type Refusal = { ok: false; error: string };

/** A validator's answer. */
export type Checked<T> = { ok: true; row: T } | Refusal;

const hasOwn = (o: object, key: string): boolean => Object.prototype.hasOwnProperty.call(o, key);

const isOneOf = <T extends string>(list: readonly T[], v: unknown): v is T => (list as readonly unknown[]).includes(v);

// ---------------------------------------------------------------- pick lists

// Internal Testing, column B. "Cold Storage B" is on the sheet's dropdown but
// has never been used; kept because the dropdown had it.
export const LOCATIONS = ["Silo 1", "Silo 2", "Silo 3", "Silo 4", "Silo 5", "Trim Room", "Cryo Room", "Cold Storage A", "Cold Storage B"] as const;
export type LabLocation = (typeof LOCATIONS)[number];

/** The form's one entry for a request made by a named person. A tracked file
 * carries no personnel name, so the package's per-person entries are this. */
export const NAMED_REQUEST = "Named request";
/** A stored "<Word> Request" reason from the workbook. */
export const NAMED_REQUEST_RE = /^[A-Z][a-z]+ Request$/;

// Internal Testing, column C. The sheet's two dropdown ranges disagreed ("After
// Silo" on one, not the other) and the bench typed outside both ("Ready for
// silo", "CRYO", "BATCH"). The dropdown union, plus the typed values that recur.
// reason is free text up to MAX_TEXT: REASONS is what the form offers, not a
// membership rule, so a workbook value is kept as stored and stays correctable.
export const REASONS: readonly string[] = ["Before Cryo", "After Cryo", "During Silo", "After Silo", "Ready for silo", "During Trim", NAMED_REQUEST, "Retest"];

/** The group a reason counts under: a stored "<Word> Request" groups with NAMED_REQUEST. */
export function reasonGroup(reason: string): string {
  const r = reason.trim();
  return NAMED_REQUEST_RE.test(r) ? NAMED_REQUEST : r;
}

// Internal Testing, column E. "Dust" was typed four times outside the list.
export const SAMPLE_TYPES = ["Flower", "Trim", "Biomass", "Kief", "Dust"] as const;

export const MARKETS = ["AU", "Med"] as const;
export type Market = (typeof MARKETS)[number];

export type LabLicense = "AU-P-000694" | "AU-G-C-000832" | "GR-C-001132";

// Scheduled for Testing / In Testing / R&D, columns A and B.
export const LICENSES: readonly { license: LabLicense; market: Market; label: string }[] = [
  { license: "AU-P-000694", market: "AU", label: "AU-P-000694 (processor)" },
  { license: "AU-G-C-000832", market: "AU", label: "AU-G-C-000832 (grower, PNN trim room)" },
  { license: "GR-C-001132", market: "Med", label: "GR-C-001132 (medical)" },
];

const isLicense = (v: unknown): v is LabLicense => LICENSES.some((l) => l.license === v);

// The 19 character Metrc tag prefix per license, measured off the sheet: 393
// of 461 full tags on the 2026 sheet open 1A40503000617610000 (the processor
// license), 68 open 1A40503000311FB0000 (the grower license, the only prefix
// the old macro knew). A typed 5 digit serial gets the prefix for the license
// in play; a typed full tag is kept as typed.
export const TAG_PREFIX_BY_LICENSE: Readonly<Record<LabLicense, string | null>> = {
  "AU-P-000694": "1A40503000617610000",
  "AU-G-C-000832": "1A40503000311FB0000",
  "GR-C-001132": null, // never seen on the sheet; the form asks for the full tag
};
export const TAG_LENGTH = 24;
export const SERIAL_LENGTH = 5;

// Union of the three "Required Test" dropdowns on the compliance sheets plus
// the R&D ones, deduplicated.
export const REQUIRED_TESTS = [
  "Full Compliance",
  "Retest (Coliforms)",
  "Retest (Metals)",
  "Retest (Total Yeast & Mold)",
  "Retest (Coliforms & TYM)",
  "Retest (Aspergillus)",
  "Retest (Water Activity)",
  "Retest (Microbial)",
  "Retest (Microbial & Metals)",
  "Full Panel R&D",
  "R&D Testing Microbials",
] as const;

// In Testing column K (two ranges, one with ACT, one without) plus R&D's list.
export const FACILITIES = ["Reassure", "ACT", "LabLink", "SC Labs", "Viridis"] as const;

// The lifecycle of a compliance sample, in order. "scheduled" is the sheet's
// "Scheduled for Testing" tab (no sample tag cut yet, or cut and not sent);
// everything after it is the "In Testing" tab's status column.
export const STATUSES = ["scheduled", "not_submitted", "in_testing", "passed", "failed", "retest_passed", "retest_failed"] as const;
export type LabStatus = (typeof STATUSES)[number];
export const STATUS_LABELS: Readonly<Record<LabStatus, string>> = {
  scheduled: "Scheduled",
  not_submitted: "Not submitted",
  in_testing: "In testing",
  passed: "Passed",
  failed: "Failed",
  retest_passed: "Retest passed",
  retest_failed: "Retest failed",
};
// THE STATUS AGREES WITH THE TEST (canon 0.30.365, BRIEF V25 law 1a): a plain
// passed or failed is a first test, so a sample whose required test names a
// retest (labvocab isRetestTest) takes only these.
export const RETEST_TEST_STATUSES: readonly LabStatus[] = ["scheduled", "not_submitted", "in_testing", "retest_passed", "retest_failed"];
// The sheet's own spellings, so a seeded row and a typed row mean the same thing.
export const STATUS_ALIASES: Readonly<Record<string, LabStatus>> = {
  "not submitted": "not_submitted",
  "in testing": "in_testing",
  passed: "passed",
  failed: "failed",
  "retest passed": "retest_passed",
  "retest failed": "retest_failed",
  scheduled: "scheduled",
};

export const PROGRAMS = ["compliance", "rnd"] as const;
export type Program = (typeof PROGRAMS)[number];

// The "Data" sheet's Failure Modes table, verbatim.
export const FAIL_REASONS = [
  "Coliforms",
  "Total Yeast & Mold",
  "Heavy Metals",
  "Foreign Matter",
  "Water Activity",
  "Aspergillus",
  "Coliforms, Heavy Metals",
  "Total Yeast & Mold, Heavy Metals",
  "Coliforms, Total Yeast & Mold",
  "Total Yeast & Mold, Coliforms, Heavy Metals",
  "Total Yeast & Mold, Foreign Matter",
  "Coliforms, Foreign Matter",
  "Water Activity, Total Yeast & Mold",
  "Water Activity, Total Yeast & Mold, Coliforms",
  "Aspergillus, Total Yeast & Mold",
] as const;

// The sheet's "Ready" rule (Scheduled for Testing, column K): a compliance
// sample is ready to send when the source package's cryo reading came back at
// or under this water activity.
export const READY_AW_LIMIT = 0.6;

// ------------------------------------------------------------------- bounds

// Percent moisture outside this is an instrument fault or a typo, not flower:
// fresh cut runs about 80 and the driest thing the bench sees is single digits.
export const MC_RANGE: Range = [0.5, 95];
export const AW_RANGE: Range = [0.05, 1];
// 100, not 60: the Orange Photonics tab holds kief at total THC 99.9 and the
// bench's own sheet carried an 80.6 (row 194). The instrument's ceiling is the bound.
export const THC_RANGE: Range = [0, 100];
export const GRAMS_RANGE: Range = [0, 1000000];
// 2020-01-01 is comfortably before any Grip record; a stamp before it is a
// parse fault, not history. The forward bound catches a device clock running
// fast: a reading cannot be from tomorrow.
export const AT_MIN_MS = Date.UTC(2020, 0, 1);
export const AT_FUTURE_SLACK_MS = 24 * 3600e3;
export const MAX_TEXT = 300;
export const MAX_NOTES = 2000;
export const ID_RE = /^[a-z]{2,4}_[a-z0-9]{8,40}$/;

// ------------------------------------------------------------------ helpers

// Over-length text is refused by the validators (TOO_LONG), never cut: a
// truncated note is a note nobody wrote.
const TOO_LONG: unique symbol = Symbol("too-long");
type TooLong = typeof TOO_LONG;
const str = (v: unknown, cap?: number): string | TooLong => {
  if (v == null) return "";
  const s = String(v).trim();
  return s.length > (cap || MAX_TEXT) ? TOO_LONG : s;
};
const tooLong = (...vals: ReadonlyArray<string | TooLong>): boolean => vals.some((v) => v === TOO_LONG);
/** The text, once tooLong has been checked for it. */
const text = (v: string | TooLong): string => (v === TOO_LONG ? "" : v);
const tooLongRefusal: Refusal = { ok: false, error: "too-long" };

// A number, null for blank, undefined for unreadable or out of range. The
// three states matter: blank is a normal half-filled row, unreadable is a
// refusal, and the caller must be able to tell them apart.
const numOrNull = (v: unknown, range: Range | null): number | null | undefined => {
  if (v == null || v === "") return null;
  // A comma is refused, not stripped: "8,5" from a European keyboard must not
  // become 85. The sheet readers below strip nothing either; their cells are numbers.
  const s = typeof v === "string" ? v.trim().replace(/%/g, "") : v;
  if (s === "") return null;
  const n = Number(s);
  if (!Number.isFinite(n)) return undefined;
  if (range && (n < range[0] || n > range[1])) return undefined;
  return n;
};

export const round2 = (n: number): number => Math.round(n * 100) / 100;
export const round4 = (n: number): number => Math.round(n * 10000) / 10000;

/** An ISO instant or null for blank, undefined for unreadable or out of range. */
export function parseInstant(v: unknown, nowMs?: number | null): string | null | undefined {
  if (v == null || v === "") return null;
  // A bare day ("2026-10-02") is refused: it would read as UTC midnight, which
  // is 8 PM the day before in Detroit, and nothing here can know which was meant.
  if (typeof v === "string" && !/[T ]\d{1,2}:\d{2}/.test(v)) return undefined;
  const ms = v instanceof Date ? v.getTime() : typeof v === "number" ? v : Date.parse(String(v));
  if (!Number.isFinite(ms)) return undefined;
  if (ms < AT_MIN_MS) return undefined;
  if (nowMs != null && ms > nowMs + AT_FUTURE_SLACK_MS) return undefined;
  return new Date(ms).toISOString();
}

/** A calendar day "YYYY-MM-DD" or null for blank, undefined for unreadable. */
export function parseDay(v: unknown): string | null | undefined {
  if (v == null || v === "") return null;
  const s = String(v).trim();
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) {
    const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
    return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3] ? `${m[1]}-${m[2]}-${m[3]}` : undefined;
  }
  const us = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})$/);
  if (us) {
    const y = us[3].length === 2 ? 2000 + Number(us[3]) : Number(us[3]);
    const mo = Number(us[1]);
    const d = Number(us[2]);
    const dt = new Date(Date.UTC(y, mo - 1, d));
    if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return undefined;
    return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }
  return undefined;
}

// ------------------------------------------------------------- metrc tags

export type TagRefusal = "tag-shape" | "tag-serial-needs-license" | "tag-serial-no-prefix-for-license";
export type TagResult = { ok: true; tag: string | null } | { ok: false; error: TagRefusal };

/** What the old Worksheet_Change macro did, generalised: a typed 5 digit serial
 * becomes the full 24 character tag for the license in play. A full 24
 * character tag is kept exactly as typed (upper cased, no spaces). Anything
 * else is refused with a reason rather than stored as a half tag, which the
 * sheet did 8 times (tags of length 1, 2, and 15 that can never join anything). */
export function normalizeTag(raw: unknown, license?: string | null): TagResult {
  const s = String(raw == null ? "" : raw).replace(/\s+/g, "").toUpperCase();
  if (!s) return { ok: true, tag: null };
  if (/^[0-9A-Z]{24}$/.test(s)) return { ok: true, tag: s };
  if (new RegExp(`^\\d{${SERIAL_LENGTH}}$`).test(s)) {
    const known = !!license && hasOwn(TAG_PREFIX_BY_LICENSE, license);
    const prefix = known ? TAG_PREFIX_BY_LICENSE[license as LabLicense] : null;
    if (!prefix) return { ok: false, error: known ? "tag-serial-no-prefix-for-license" : "tag-serial-needs-license" };
    return { ok: true, tag: prefix + s };
  }
  return { ok: false, error: "tag-shape" };
}

/** Which license a full tag belongs to, by its prefix, or null. */
export function licenseForTag(tag: unknown): LabLicense | null {
  const t = String(tag || "");
  for (const [license, prefix] of Object.entries(TAG_PREFIX_BY_LICENSE)) {
    if (prefix && t.startsWith(prefix)) return license as LabLicense;
  }
  return null;
}

/** The last five digits, what the crew reads off the printed tag. */
export const tagSerial = (tag: string | null | undefined): string | null => (tag && tag.length === TAG_LENGTH ? tag.slice(-SERIAL_LENGTH) : null);

// ---------------------------------------------------------- internal tests

export type TestedAtSource = "auto" | "typed" | "missing";

/** One validated bench reading. */
export type InternalTestRow = {
  id: string;
  tested_at: string | null;
  tested_at_source: TestedAtSource;
  location: string;
  reason: string;
  license: LabLicense | null;
  metrc_tag: string | null;
  metrc_tag_raw: string | null;
  sample_type: string;
  moisture_pct: number | null;
  water_activity: number | null;
  thc_pct: number | null;
  notes: string;
};

export type InternalTestOpts = { allowMissingDate?: boolean; observedAt?: unknown };

/** One bench reading as the station sends it. `tested_at` may be absent (the
 * server stamps now, source "auto") or an instant (source "typed"). At least
 * one instrument result is required: a row with none is a placeholder, not a
 * measurement, and the sheet carried 26 of those that could never be used.
 * opts.allowMissingDate (a correction to a workbook row that never had a date
 * keeps NULL rather than being handed today's date); opts.observedAt (the
 * device clock at the moment the operator tapped Save, so a reading queued
 * through an outage lands with the time it was made, not the time it arrived).
 * reason is free text up to MAX_TEXT; REASONS is what the form offers, not a
 * membership rule, so a workbook value is kept as stored. */
export function validateInternalTest(input: unknown, nowMs: number, opts?: InternalTestOpts): Checked<InternalTestRow> {
  const o = opts || {};
  if (!input || typeof input !== "object") return { ok: false, error: "not-an-object" };
  const i = input as Record<string, unknown>;
  const id = str(i.id, 64);
  if (id === TOO_LONG || !ID_RE.test(id)) return { ok: false, error: "id" };
  const location = str(i.location);
  const reason = str(i.reason);
  const sample_type = str(i.sample_type);
  const notes = str(i.notes, MAX_NOTES);
  const tagRaw = str(i.metrc_tag, 64);
  if (tooLong(location, reason, sample_type, notes, tagRaw)) return tooLongRefusal;
  if (!location) return { ok: false, error: "location" };
  if (!reason) return { ok: false, error: "reason" };
  if (!sample_type) return { ok: false, error: "sample_type" };
  const license = i.license == null || i.license === "" ? null : str(i.license, 32);
  if (license !== null && !isLicense(license)) return { ok: false, error: "license" };
  const tagRes = normalizeTag(i.metrc_tag, license || licenseForTag(i.metrc_tag));
  if (!tagRes.ok) return { ok: false, error: tagRes.error };

  const moisture_pct = numOrNull(i.moisture_pct, MC_RANGE);
  if (moisture_pct === undefined) return { ok: false, error: "moisture_pct" };
  const water_activity = numOrNull(i.water_activity, AW_RANGE);
  if (water_activity === undefined) return { ok: false, error: "water_activity" };
  const thc_pct = numOrNull(i.thc_pct, THC_RANGE);
  if (thc_pct === undefined) return { ok: false, error: "thc_pct" };
  if (moisture_pct === null && water_activity === null && thc_pct === null) return { ok: false, error: "no-instrument-result" };

  let tested_at: string | null = null;
  let tested_at_source: TestedAtSource = "auto";
  if (i.tested_at != null && i.tested_at !== "") {
    const typed = parseInstant(i.tested_at, nowMs);
    if (typed === undefined) return { ok: false, error: "tested_at" };
    tested_at = typed;
    tested_at_source = "typed";
  } else if (o.allowMissingDate) {
    tested_at = null;
    tested_at_source = "missing";
  } else if (o.observedAt != null && o.observedAt !== "") {
    // The device's own clock at save. Bounded like any instant; a clock that
    // is wildly off is refused, named as such.
    const seen = parseInstant(o.observedAt, nowMs);
    if (seen === undefined) return { ok: false, error: "observed_at" };
    tested_at = seen;
    tested_at_source = "auto";
  } else {
    tested_at = new Date(nowMs).toISOString();
  }
  return {
    ok: true,
    row: {
      id,
      tested_at,
      tested_at_source,
      location: text(location),
      reason: text(reason),
      license,
      metrc_tag: tagRes.tag,
      metrc_tag_raw: text(tagRaw) || null,
      sample_type: text(sample_type),
      moisture_pct: moisture_pct === null ? null : round2(moisture_pct),
      water_activity: water_activity === null ? null : round4(water_activity),
      thc_pct: thc_pct === null ? null : round2(thc_pct),
      notes: text(notes),
    },
  };
}

/** The fields a correction may change. Identity (id) and the audit columns never. */
export const INTERNAL_TEST_EDITABLE = [
  "tested_at",
  "location",
  "reason",
  "license",
  "metrc_tag",
  "sample_type",
  "moisture_pct",
  "water_activity",
  "thc_pct",
  "notes",
] as const satisfies readonly (keyof InternalTestRow)[];

// ---------------------------------------------------- the workbook's values

// The sheet stored percent formatted cells as fractions: 135 of 136 OHAUS
// values sit at or under 1 (0.417 for 41.7 percent) and 98 of 99 THC values do
// the same, with exactly one of each typed as a plain percent. Water activity
// lives under 1 by definition and is NEVER rescaled. For workbook values only;
// the station takes percents as typed.
export function sheetMoisture(raw: unknown): number | null | undefined {
  const n = numOrNull(raw, null);
  if (n == null) return n;
  const pct = n > 0 && n <= 1 ? n * 100 : n;
  return numOrNull(round2(pct), MC_RANGE);
}
export function sheetThc(raw: unknown): number | null | undefined {
  const n = numOrNull(raw, null);
  if (n == null) return n;
  const pct = n > 0 && n <= 1 ? n * 100 : n;
  return numOrNull(round2(pct), THC_RANGE);
}
export function sheetAw(raw: unknown): number | null | undefined {
  const n = numOrNull(raw, null);
  if (n == null) return n;
  // A percent formatted aw cell can arrive as 67.52 for 0.6752. Rounded at the
  // fourth decimal, never the integer: 0.6752 against a 0.65 limit must not
  // become 0.68.
  return numOrNull(round4(n > 1 ? n / 100 : n), AW_RANGE);
}

/** A time the bench wrote into NOTAS ("3:44PM", "9:45AM") with no date cell. */
export const NOTES_TIME_RE = /^\s*(\d{1,2})\s*[:;]\s*(\d{2})\s*(?::\s*(\d{2}))?\s*([AaPp])\.?[Mm]\.?/;
export function timeFromNotes(raw: unknown): { h: number; min: number; sec: number } | null {
  const m = String(raw == null ? "" : raw).match(NOTES_TIME_RE);
  if (!m) return null;
  let h = Number(m[1]);
  const min = Number(m[2]);
  const sec = m[3] ? Number(m[3]) : 0;
  if (!(h >= 1 && h <= 12) || min > 59 || sec > 59) return null;
  const pm = m[4].toLowerCase() === "p";
  if (h === 12) h = 0;
  return { h: pm ? h + 12 : h, min, sec };
}

// ------------------------------------------------------ compliance samples

/** A status word to the lifecycle's value: null for blank, undefined for a word
 * the lifecycle does not know (own aliases only, so "constructor" is unknown). */
export function normalizeStatus(raw: unknown): LabStatus | null | undefined {
  const s = String(raw == null ? "" : raw).trim().toLowerCase().replace(/_/g, " ");
  if (!s) return null;
  return hasOwn(STATUS_ALIASES, s) ? STATUS_ALIASES[s] : undefined;
}

/** One validated compliance or R&D sample. */
export type ComplianceSampleRow = {
  id: string;
  program: Program;
  license: LabLicense;
  market: Market;
  strain: string | null;
  item_name: string | null;
  source_metrc_tag: string;
  batch_weight_g: number | null;
  harvest_batch: string | null;
  sample_tag: string | null;
  required_test: string;
  net_weight_g: number | null;
  testing_facility: string | null;
  entered_testing_on: string | null;
  finished_testing_on: string | null;
  thc_potency_pct: number | null;
  status: LabStatus;
  fail_reason: string | null;
  notes: string;
  scheduled_at: string;
};

/** One compliance or R&D sample. The status machine is loose on purpose: the
 * sheet let a sample be typed at any stage, and a lab result arriving before
 * the "entered testing" date was filled is real life, not an error. What is
 * enforced: a source tag always, a license always, a sample tag before any
 * status past scheduled, a fail reason on a failed status, and no plain passed
 * or failed on a "Retest" required test (BRIEF V25 law 1a). `stored` is the row a
 * correction changes (its status and required test as stored); a create has none. */
export function validateComplianceSample(
  input: unknown,
  nowMs: number,
  stored: { status: string; required_test: string } | null = null
): Checked<ComplianceSampleRow> {
  if (!input || typeof input !== "object") return { ok: false, error: "not-an-object" };
  const i = input as Record<string, unknown>;
  const id = str(i.id, 64);
  if (id === TOO_LONG || !ID_RE.test(id)) return { ok: false, error: "id" };
  const strain = str(i.strain);
  const itemName = str(i.item_name);
  const harvestBatch = str(i.harvest_batch);
  const requiredTest = str(i.required_test);
  const failReason = str(i.fail_reason);
  const facilityText = str(i.testing_facility, 64);
  const notes = str(i.notes, MAX_NOTES);
  if (tooLong(strain, itemName, harvestBatch, requiredTest, failReason, facilityText, notes, str(i.source_metrc_tag, 64), str(i.sample_tag, 64))) {
    return tooLongRefusal;
  }
  const program = str(i.program, 16) || "compliance";
  if (!isOneOf(PROGRAMS, program)) return { ok: false, error: "program" };
  const license = str(i.license, 32);
  if (!isLicense(license)) return { ok: false, error: "license" };
  const known = LICENSES.find((l) => l.license === license);
  const market = str(i.market, 8) || (known ? known.market : "");
  if (!isOneOf(MARKETS, market)) return { ok: false, error: "market" };
  const src = normalizeTag(i.source_metrc_tag, license);
  if (!src.ok) return { ok: false, error: "source_metrc_tag:" + src.error };
  if (!src.tag) return { ok: false, error: "source_metrc_tag" };
  const smp = normalizeTag(i.sample_tag, license);
  if (!smp.ok) return { ok: false, error: "sample_tag:" + smp.error };
  // null is a blank status (a new sample, so scheduled); undefined is a word
  // the lifecycle does not know, which is a refusal, never a quiet default.
  const ns = normalizeStatus(i.status);
  if (ns === undefined) return { ok: false, error: "status" };
  const status: LabStatus = ns || "scheduled";
  if (status !== "scheduled" && !smp.tag) return { ok: false, error: "sample_tag-required" };
  const required_test = text(requiredTest);
  if (!required_test) return { ok: false, error: "required_test" };
  // THE STATUS AGREES WITH THE TEST (BRIEF V25 law 1a): a plain passed or
  // failed is a first test, so a sample whose required test names a retest is
  // refused one. A stored row that already disagrees is never rewritten by this
  // rule: a correction that leaves its status as stored (its test still a
  // retest) is not refused, and the one retest rule reads it as a retest.
  if (!RETEST_TEST_STATUSES.includes(status) && isRetestTest(required_test)) {
    const kept = stored != null && stored.status === status && isRetestTest(stored.required_test);
    if (!kept) return { ok: false, error: "status-retest" };
  }
  const facility = text(facilityText) || null;
  const batch_weight_g = numOrNull(i.batch_weight_g, GRAMS_RANGE);
  if (batch_weight_g === undefined) return { ok: false, error: "batch_weight_g" };
  const net_weight_g = numOrNull(i.net_weight_g, GRAMS_RANGE);
  if (net_weight_g === undefined) return { ok: false, error: "net_weight_g" };
  const thc_potency_pct = numOrNull(i.thc_potency_pct, THC_RANGE);
  if (thc_potency_pct === undefined) return { ok: false, error: "thc_potency_pct" };
  const entered = parseDay(i.entered_testing_on);
  if (entered === undefined) return { ok: false, error: "entered_testing_on" };
  const finished = parseDay(i.finished_testing_on);
  if (finished === undefined) return { ok: false, error: "finished_testing_on" };
  if (entered && finished && finished < entered) return { ok: false, error: "finished-before-entered" };
  const fail_reason = text(failReason) || null;
  if ((status === "failed" || status === "retest_failed") && !fail_reason) return { ok: false, error: "fail_reason-required" };
  let scheduled_at: string;
  if (i.scheduled_at != null && i.scheduled_at !== "") {
    const at = parseInstant(i.scheduled_at, nowMs);
    if (at == null) return { ok: false, error: "scheduled_at" };
    scheduled_at = at;
  } else scheduled_at = new Date(nowMs).toISOString();
  return {
    ok: true,
    row: {
      id,
      program,
      license,
      market,
      strain: text(strain) || null,
      item_name: text(itemName) || null,
      source_metrc_tag: src.tag,
      batch_weight_g,
      harvest_batch: text(harvestBatch) || null,
      sample_tag: smp.tag,
      required_test,
      net_weight_g,
      testing_facility: facility,
      entered_testing_on: entered,
      finished_testing_on: finished,
      thc_potency_pct: thc_potency_pct === null ? null : round4(thc_potency_pct),
      status,
      fail_reason,
      notes: text(notes),
      scheduled_at,
    },
  };
}

/** The fields a correction may change. */
export const COMPLIANCE_EDITABLE = [
  "program",
  "license",
  "market",
  "strain",
  "item_name",
  "source_metrc_tag",
  "batch_weight_g",
  "harvest_batch",
  "sample_tag",
  "required_test",
  "net_weight_g",
  "testing_facility",
  "entered_testing_on",
  "finished_testing_on",
  "thc_potency_pct",
  "status",
  "fail_reason",
  "notes",
  "scheduled_at",
] as const satisfies readonly (keyof ComplianceSampleRow)[];

/** In Testing column N: days in the lab, counted to the finish date or to today. */
export function turnaroundDays(entered_testing_on: string | null | undefined, finished_testing_on: string | null | undefined, nowMs: number): number | null {
  const a = entered_testing_on ? Date.parse(entered_testing_on + "T00:00:00Z") : NaN;
  if (!Number.isFinite(a)) return null;
  const b = finished_testing_on ? Date.parse(finished_testing_on + "T00:00:00Z") : Math.floor(nowMs / 86400e3) * 86400e3;
  if (!Number.isFinite(b)) return null;
  return Math.round((b - a) / 86400e3);
}

/** A bench reading as readiness reads it. */
export type ReadinessReading = {
  id?: string | null;
  reason?: string | null;
  water_activity?: number | null;
  tested_at?: string | null;
  voided_at?: string | null;
};

export type Readiness = { ready: boolean; why: string; water_activity: number | null; tested_at: string | null | undefined };

/** Scheduled for Testing column K, in code. The sheet's MATCH took the FIRST
 * (oldest) Internal Testing row for the tag; this takes the NEWEST "After
 * Cryo" reading that carries a water activity, because a package re-tested
 * after a longer cryo hold is judged on the later number. That is the one
 * deliberate change from the sheet. `readings` are internal_tests rows for the
 * source tag, any order. */
export function readiness(readings: readonly (ReadinessReading | null | undefined)[] | null | undefined): Readiness {
  const cryo = (readings || [])
    .filter((r): r is ReadinessReading & { water_activity: number } => !!r && r.water_activity != null && /^\s*after\s*cryo\s*$/i.test(r.reason || "") && !r.voided_at)
    .sort((a, b) => String(b.tested_at || "").localeCompare(String(a.tested_at || "")) || String(b.id || "").localeCompare(String(a.id || "")));
  if (!cryo.length) return { ready: false, why: "no cryo water activity on the source tag", water_activity: null, tested_at: null };
  const r = cryo[0];
  const ready = r.water_activity <= READY_AW_LIMIT;
  return {
    ready,
    why: ready ? `cryo aw ${r.water_activity} at or under ${READY_AW_LIMIT}` : `cryo aw ${r.water_activity} over ${READY_AW_LIMIT}`,
    water_activity: r.water_activity,
    tested_at: r.tested_at,
  };
}

// ------------------------------------------------------ Orange Photonics

// The LightLab export's own header, verbatim, so an export from a different
// firmware fails the header check loudly instead of landing shifted columns.
export const OP_HEADER = [
  "Test ID",
  "Serial Number",
  "Date",
  "Time",
  "Sample ID",
  "Operator",
  "Cultivar",
  "Sample Type",
  "Weight",
  "Solvent Volume",
  "Moisture Correction",
  "Temperature",
  "Unit",
  "Notes",
  "Confidence",
  "THC-A",
  "Δ9-THC",
  "CBD-A",
  "CBD",
  "CBG-A",
  "CBD/CBG",
  "CBG",
  "CBN-A",
  "CBN",
  "CBC-A",
  "CBC",
  "Δ8-THC*",
  "Δ10-THC",
  "THCV-A",
  "THCV",
  "Terpenes",
  "Total THC",
  "Total CBD",
  "Total Cannabinoids",
] as const;

export type OpAnalyteKey =
  | "thca"
  | "d9_thc"
  | "cbda"
  | "cbd"
  | "cbga"
  | "cbg"
  | "cbna"
  | "cbn"
  | "cbca"
  | "cbc"
  | "d8_thc"
  | "d10_thc"
  | "thcva"
  | "thcv"
  | "total_thc"
  | "total_cbd"
  | "total_cannabinoids";

// Columns 34 onward ("per serving", "per pkg") are the same analytes scaled by
// a package weight the instrument does not know; kept in raw_json only.
// Terpenes is NOT here: the LightLab reports it as a level ("Low", "Medium",
// "High", "ND"), 2,621 of 2,621 rows on the sheet, never a number. It lands
// in terpenes_level as text.
export const OP_ANALYTES: Readonly<Record<OpAnalyteKey, string>> = {
  thca: "THC-A",
  d9_thc: "Δ9-THC",
  cbda: "CBD-A",
  cbd: "CBD",
  cbga: "CBG-A",
  cbg: "CBG",
  cbna: "CBN-A",
  cbn: "CBN",
  cbca: "CBC-A",
  cbc: "CBC",
  d8_thc: "Δ8-THC*",
  d10_thc: "Δ10-THC",
  thcva: "THCV-A",
  thcv: "THCV",
  total_thc: "Total THC",
  total_cbd: "Total CBD",
  total_cannabinoids: "Total Cannabinoids",
};
export const OP_ND = "ND"; // the instrument's "not detected"; stored as NULL with nd_json naming it
export const OP_TERPENE_LEVELS = ["ND", "Low", "Medium", "High"] as const;
export type TerpeneLevel = (typeof OP_TERPENE_LEVELS)[number];

export type MaterialClass = "Kief" | "Trim" | "Biomass" | "Flower" | "Shake";

/** The Notes column is where the bench typed the material class, in whatever
 * case ("Kief", "KIEF", "flower", "Shake"). Folded to one spelling for the
 * class column; the typed value stays in raw_json. */
export function opMaterialClass(notes: unknown): MaterialClass | null {
  const s = String(notes == null ? "" : notes).trim().toLowerCase();
  if (!s) return null;
  if (s.startsWith("kief")) return "Kief";
  if (s.startsWith("trim")) return "Trim";
  if (s.startsWith("bio")) return "Biomass";
  if (s.startsWith("flower") || s.startsWith("bud")) return "Flower";
  if (s.startsWith("shake")) return "Shake";
  return null;
}

// "ND" is null (with the analyte named in nd), "n/a" and "--" (the firmware
// did not report the analyte: 1,348 of 2,621 delta-8 THC cells) are null, a
// number is a percent. Anything else is a refusal naming the column.
function opValue(v: unknown, col: string, nd: string[]): number | null | undefined {
  if (v == null || v === "") return null;
  const s = String(v).trim();
  if (/^nd$/i.test(s)) {
    nd.push(col);
    return null;
  }
  if (/^n\/a$/i.test(s) || /^-+$/.test(s)) return null;
  const n = Number(s.replace(/%/g, ""));
  if (!Number.isFinite(n) || n < 0 || n > 100) return undefined;
  return n;
}
function opTerpenes(v: unknown): TerpeneLevel | null | undefined {
  if (v == null || v === "") return null;
  const s = String(v).trim();
  const hit = OP_TERPENE_LEVELS.find((l) => l.toLowerCase() === s.toLowerCase());
  return hit === undefined ? undefined : hit;
}

/** One validated LightLab result. */
export type OpResultRow = {
  test_id: string;
  tested_at: string;
  tested_at_offset: string | null;
  serial_number: string | null;
  sample_id: string | null;
  operator: string | null;
  cultivar: string | null;
  sample_type: string | null;
  material_class: MaterialClass | null;
  notes: string;
  weight_g: number | null;
  temperature_c: number | null;
  moisture_correction: number | null;
  confidence: string | null;
  terpenes_level: TerpeneLevel | null;
  nd_json: string;
  raw_json: string;
} & Record<OpAnalyteKey, number | null>;

/** One LightLab export row (an object keyed by the header) to one typed result. */
export function validateOpResult(obj: unknown, nowMs: number): Checked<OpResultRow> {
  if (!obj || typeof obj !== "object") return { ok: false, error: "not-an-object" };
  const o = obj as Record<string, unknown>;
  const testIdText = str(o["Test ID"], 64);
  if (testIdText === TOO_LONG) return tooLongRefusal;
  const test_id = testIdText.toLowerCase();
  if (!/^[0-9a-f-]{20,40}$/.test(test_id)) return { ok: false, error: "test_id" };
  const day = parseDay(o["Date"]);
  if (!day) return { ok: false, error: "date" };
  // Time arrives as "09:04:31-04:00": the instrument's own clock with its UTC
  // offset, which is the one honest instant in the whole workbook.
  const timeRaw = str(o["Time"], 32);
  if (timeRaw === TOO_LONG) return tooLongRefusal;
  const tm = timeRaw.match(/^(\d{2}):(\d{2}):(\d{2})([+-]\d{2}:\d{2})?$/);
  if (!tm) return { ok: false, error: "time" };
  const tested_at = parseInstant(`${day}T${tm[1]}:${tm[2]}:${tm[3]}${tm[4] || "Z"}`, nowMs);
  if (!tested_at) return { ok: false, error: "tested_at" };
  const nd: string[] = [];
  const out = {} as Record<OpAnalyteKey, number | null>;
  for (const [key, col] of Object.entries(OP_ANALYTES) as [OpAnalyteKey, string][]) {
    const v = opValue(o[col], col, nd);
    if (v === undefined) return { ok: false, error: "analyte:" + col };
    out[key] = v;
  }
  const terpenes_level = opTerpenes(o["Terpenes"]);
  if (terpenes_level === undefined) return { ok: false, error: "terpenes" };
  const weight = str(o["Weight"], 32);
  const temperature = str(o["Temperature"], 32);
  const serial = str(o["Serial Number"], 32);
  const sampleId = str(o["Sample ID"], 64);
  const operator = str(o["Operator"], 64);
  const cultivar = str(o["Cultivar"], 128);
  const sampleType = str(o["Sample Type"], 32);
  const notes = str(o["Notes"], MAX_NOTES);
  const confidence = str(o["Confidence"], 16);
  if (tooLong(weight, temperature, serial, sampleId, operator, cultivar, sampleType, notes, confidence)) return tooLongRefusal;
  const weightM = text(weight).match(/([\d.]+)/);
  const tempM = text(temperature).match(/([\d.]+)/);
  const moistureCorrection = numOrNull(o["Moisture Correction"], [0, 100]);
  return {
    ok: true,
    row: {
      test_id,
      tested_at,
      tested_at_offset: tm[4] || null,
      serial_number: text(serial) || null,
      sample_id: text(sampleId) || null,
      operator: text(operator) || null,
      cultivar: text(cultivar) || null,
      sample_type: text(sampleType) || null,
      material_class: opMaterialClass(o["Notes"]),
      notes: text(notes),
      weight_g: weightM ? Number(weightM[1]) : null,
      temperature_c: tempM ? Number(tempM[1]) : null,
      moisture_correction: moistureCorrection === undefined ? null : moistureCorrection,
      confidence: text(confidence) || null,
      ...out,
      terpenes_level,
      nd_json: JSON.stringify(nd),
      raw_json: JSON.stringify(obj),
    },
  };
}

// -------------------------------------------------------------- schedule

export type ScheduleCell = { day: string; hour: number; locations: LabLocation[] };

/** Internal Testing Schedule: one cell per (day, hour) naming the silos to pull
 * that hour, "Silo 3/Silo 5" when two. Stored one row per silo per hour. */
export function validateScheduleCell(input: unknown): Checked<ScheduleCell> {
  if (!input || typeof input !== "object") return { ok: false, error: "not-an-object" };
  const i = input as Record<string, unknown>;
  const day = parseDay(i.day);
  if (!day) return { ok: false, error: "day" };
  const hour = Number(i.hour);
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) return { ok: false, error: "hour" };
  const raw: readonly unknown[] = Array.isArray(i.locations) ? i.locations : String(i.locations == null ? "" : i.locations).split(/[\/,;]/);
  const locations: LabLocation[] = [];
  for (const l of raw) {
    const s = str(l, 64);
    if (s === TOO_LONG) return tooLongRefusal;
    if (!s) continue;
    if (!isOneOf(LOCATIONS, s)) return { ok: false, error: "location:" + s };
    if (!locations.includes(s)) locations.push(s);
  }
  return { ok: true, row: { day, hour, locations } };
}

// --------------------------------------------------------------- csv

/** A small RFC 4180 reader: quoted fields, doubled quotes, CRLF or LF. Returns
 * rows of strings. Enough for a LightLab export or a Metrc inventory report.
 * An unclosed quote reads to the end and an all-blank row is dropped. */
export function parseCsv(input: unknown): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let q = false;
  const s = String(input == null ? "" : input).replace(/^\uFEFF/, "");
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) {
      if (c === '"') {
        if (s[i + 1] === '"') {
          field += '"';
          i++;
        } else q = false;
      } else field += c;
    } else if (c === '"') q = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && s[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((v) => v !== ""));
}

export type CsvObjects =
  | { ok: true; header: string[]; rows: Record<string, string>[] }
  | { ok: false; error: "empty" }
  | { ok: false; error: "header"; missing: string[] };

/** The CSV's rows as objects keyed by its header, the header checked when one is expected. */
export function csvToObjects(input: unknown, expectedHeader?: readonly string[] | null): CsvObjects {
  const rows = parseCsv(input);
  if (!rows.length) return { ok: false, error: "empty" };
  const header = rows[0].map((h) => h.trim());
  if (expectedHeader) {
    const miss = expectedHeader.filter((h) => !header.includes(h));
    if (miss.length) return { ok: false, error: "header", missing: miss };
  }
  const out: Record<string, string>[] = [];
  for (let i = 1; i < rows.length; i++) {
    const o: Record<string, string> = {};
    header.forEach((h, j) => {
      o[h] = rows[i][j] == null ? "" : rows[i][j];
    });
    out.push(o);
  }
  return { ok: true, header, rows: out };
}

// Metrc's own package report, the sheet's "Metrc Inventory Report" tab. No
// route reads it now (the lookup reads the app's metrc_packages mirror); kept
// because every rule of the package is kept.
export const METRC_HEADER = [
  "Tag",
  "Source Harvest(s)",
  "Source Package(s)",
  "Location",
  "Item",
  "Category",
  "Item Strain",
  "Quantity",
  "Unit Of Measure",
  "Lab Test Status",
  "Packaged Date",
] as const;

/** One validated row of Metrc's package report. */
export type MetrcPackageRow = {
  tag: string;
  source_harvest: string | null;
  source_package: string | null;
  location: string | null;
  item: string | null;
  category: string | null;
  strain: string | null;
  quantity: number | null;
  unit: string | null;
  lab_test_status: string | null;
  packaged_on: string | null;
};

export function validateMetrcPackage(obj: unknown): Checked<MetrcPackageRow> {
  if (!obj || typeof obj !== "object") return { ok: false, error: "not-an-object" };
  const o = obj as Record<string, unknown>;
  const t = normalizeTag(o["Tag"], null);
  if (!t.ok || !t.tag) return { ok: false, error: "tag" };
  const qty = numOrNull(o["Quantity"], null);
  if (qty === undefined) return { ok: false, error: "quantity" };
  const packaged = o["Packaged Date"] == null || o["Packaged Date"] === "" ? null : parseDay(o["Packaged Date"]);
  const sourceHarvest = str(o["Source Harvest(s)"]);
  const sourcePackage = str(o["Source Package(s)"]);
  const location = str(o["Location"]);
  const item = str(o["Item"]);
  const category = str(o["Category"]);
  const strain = str(o["Item Strain"]);
  const unit = str(o["Unit Of Measure"], 16);
  const labTestStatus = str(o["Lab Test Status"], 64);
  if (tooLong(sourceHarvest, sourcePackage, location, item, category, strain, unit, labTestStatus)) return tooLongRefusal;
  return {
    ok: true,
    row: {
      tag: t.tag,
      source_harvest: text(sourceHarvest) || null,
      source_package: text(sourcePackage) || null,
      location: text(location) || null,
      item: text(item) || null,
      category: text(category) || null,
      strain: text(strain) || null,
      quantity: qty,
      unit: text(unit) || null,
      lab_test_status: text(labTestStatus) || null,
      packaged_on: packaged === undefined ? null : packaged,
    },
  };
}

/** The pick lists as one object, for GET /api/lab/options. */
export type LabOptions = {
  locations: typeof LOCATIONS;
  reasons: typeof REASONS;
  sample_types: typeof SAMPLE_TYPES;
  licenses: typeof LICENSES;
  markets: typeof MARKETS;
  tag_prefix_by_license: typeof TAG_PREFIX_BY_LICENSE;
  required_tests: typeof REQUIRED_TESTS;
  facilities: typeof FACILITIES;
  statuses: { value: LabStatus; label: string }[];
  /** The statuses a "Retest" required test takes (BRIEF V25 law 1a). */
  retest_test_statuses: readonly LabStatus[];
  programs: typeof PROGRAMS;
  fail_reasons: typeof FAIL_REASONS;
  ready_aw_limit: number;
  ranges: { moisture_pct: Range; water_activity: Range; thc_pct: Range };
};

export function options(): LabOptions {
  return {
    locations: LOCATIONS,
    reasons: REASONS,
    sample_types: SAMPLE_TYPES,
    licenses: LICENSES,
    markets: MARKETS,
    tag_prefix_by_license: TAG_PREFIX_BY_LICENSE,
    required_tests: REQUIRED_TESTS,
    facilities: FACILITIES,
    statuses: STATUSES.map((s) => ({ value: s, label: STATUS_LABELS[s] })),
    retest_test_statuses: RETEST_TEST_STATUSES,
    programs: PROGRAMS,
    fail_reasons: FAIL_REASONS,
    ready_aw_limit: READY_AW_LIMIT,
    ranges: { moisture_pct: MC_RANGE, water_activity: AW_RANGE, thc_pct: THC_RANGE },
  };
}
