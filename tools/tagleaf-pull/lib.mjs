// GripFactory Lite, TL2: the TagLeaf pull. The pure part: no network, no files.
// Turns TagLeaf's sample listing rows and COA pages into the rows the lab samples
// feed takes (the Samples sheet's header names, TL1).

export const LAB_NAMES = { RAS: "Reassure", CL: "Orion" };
export const PRODUCTS = { BUD: "Bulk", WPR: "Prepack", SHA: "Shake" };
export const FARMS = new Set(["ARL", "PNS", "PNN"]);
const ET = "America/New_York";

/** The intake date from the lab code: RAS-YYMMDD-NNN (Reassure), CL-DDMMYY-NNN (Orion). */
export function intakeFromLabCode(labCode) {
  const m = /^([A-Z]+)-(\d{2})(\d{2})(\d{2})\b/.exec(String(labCode || "").trim());
  if (!m) return null;
  const iso = m[1] === "CL" ? `20${m[4]}-${m[3]}-${m[2]}` : `20${m[2]}-${m[3]}-${m[4]}`;
  return isCalendarDate(iso) ? iso : null;
}

export function isCalendarDate(iso) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

/** An ISO instant with three decimals (TagLeaf writes six), or null. */
export function isoInstant(value) {
  if (!value) return null;
  const ms = Date.parse(String(value).replace(" ", "T"));
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
}

/** The Eastern calendar date and wall clock of an instant. */
export function easternParts(iso) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: ET,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(iso));
  const pick = (type) => parts.find((p) => p.type === type)?.value ?? "";
  return { date: `${pick("year")}-${pick("month")}-${pick("day")}`, hh: Number(pick("hour")), mm: Number(pick("minute")) };
}

/** TAT the workbook's way: the COA posting (Eastern wall clock) minus the intake date at midnight, in days. */
export function tatDays(intakeDate, coaIso) {
  if (!intakeDate || !coaIso) return null;
  const coa = easternParts(coaIso);
  const days = (Date.parse(coa.date + "T00:00:00Z") - Date.parse(intakeDate + "T00:00:00Z")) / 86400000;
  const tat = days + (coa.hh * 60 + coa.mm) / 1440;
  return Math.round(tat * 1e6) / 1e6;
}

/** "WPR - Chrome Dome - PNN - O" into code, product, strain, farm. */
export function parseSampleName(name) {
  const parts = String(name || "")
    .split(/\s+-\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const code = (parts[0] || "").toUpperCase();
  const known = Object.prototype.hasOwnProperty.call(PRODUCTS, code);
  const farmPart = (parts[2] || "").toUpperCase();
  return {
    productCode: known ? code : "?",
    product: known ? PRODUCTS[code] : "Unknown",
    strain: parts[1] || null,
    farm: FARMS.has(farmPart) ? farmPart : null,
  };
}

/** First-time, Retest or Internal QA from the tests ordered. */
export function testType(testsInfo) {
  const kinds = Array.isArray(testsInfo?.kind) ? testsInfo.kind.map(String) : [];
  const tests = testsInfo?.tests && typeof testsInfo.tests === "object" ? Object.keys(testsInfo.tests) : [];
  if (kinds.includes("qa") && !kinds.includes("compliance")) return "Internal QA";
  return tests.includes("cannabinoid_test") ? "First-time" : "Retest";
}

export function labName(labCode) {
  const prefix = String(labCode || "").split("-")[0];
  return LAB_NAMES[prefix] || null;
}

const stripTags = (html) =>
  html
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();

/** Every table row of a COA page as its cell texts. */
export function coaRows(html) {
  const rows = [];
  const trs = String(html).match(/<tr\b[\s\S]*?<\/tr>/gi) || [];
  for (const tr of trs) {
    const cells = (tr.match(/<t[dh]\b[\s\S]*?<\/t[dh]>/gi) || []).map(stripTags);
    if (cells.length) rows.push(cells);
  }
  return rows;
}

const number = (text) => {
  const m = /-?\d+(?:,\d{3})*(?:\.\d+)?/.exec(String(text || ""));
  return m ? Number(m[0].replace(/,/g, "")) : null;
};

const FOREIGN = /INORGANIC MATTER|ORGANIC MATTER|STEMS|FOREIGN/i;

/** What a COA page says: the batch result, the two microbial counts when that
 * analyte failed (the workbook's convention), every other failed analyte, and
 * total THC. Counts of "ND" are blank. */
export function parseCoa(html) {
  const rows = coaRows(html);
  const out = { result: null, coliformsCfu: null, yeastMoldCfu: null, failureMode: null, otherFailed: [], totalThcPct: null, producedOn: null };
  const text = stripTags(String(html));
  const result = /BATCH RESULT:\s*(PASS|FAIL)/i.exec(text);
  if (result) out.result = result[1][0].toUpperCase() + result[1].slice(1).toLowerCase();
  const produced = /PRODUCED:\s*([A-Z]{3} \d{1,2}, \d{4})/i.exec(text);
  if (produced) out.producedOn = produced[1];
  let coliformFail = false;
  let ymFail = false;
  let foreignFail = false;
  for (const cells of rows) {
    if (cells.length < 3 || cells.length > 9) continue;
    const analyte = cells[0].toUpperCase();
    const verdict = cells[cells.length - 1].toUpperCase();
    if (analyte === "TOTAL THC") {
      const pct = cells.slice(1).find((c) => /%/.test(c));
      if (pct) out.totalThcPct = number(pct);
      continue;
    }
    if (verdict !== "FAIL") continue;
    const detected = cells[2];
    if (/^COLIFORM/.test(analyte)) {
      coliformFail = true;
      out.coliformsCfu = /ND/i.test(detected) ? null : number(detected);
    } else if (/^YEAST/.test(analyte)) {
      ymFail = true;
      out.yeastMoldCfu = /ND/i.test(detected) ? null : number(detected);
    } else if (FOREIGN.test(analyte)) {
      foreignFail = true;
      out.otherFailed.push(titleCase(cells[0]) + " " + detected);
    } else {
      out.otherFailed.push(titleCase(cells[0]) + " " + detected);
    }
  }
  if (out.result === "Pass") out.failureMode = "Pass";
  else if (coliformFail && ymFail) out.failureMode = "Both";
  else if (coliformFail) out.failureMode = "Coliform";
  else if (ymFail) out.failureMode = "Yeast & Mold";
  else if (foreignFail) out.failureMode = "Foreign Matter";
  else if (out.result === "Fail") out.failureMode = "Other";
  return out;
}

function titleCase(s) {
  return String(s)
    .toLowerCase()
    .replace(/\b[a-z]/g, (c) => c.toUpperCase());
}

/** The COA page link of a listing row, or null. */
export function coaUrlOf(row) {
  const items = Array.isArray(row?.extra_action_items) ? row.extra_action_items : Object.values(row?.extra_action_items || {});
  const hit = items.find((a) => a && a.name === "View COA" && typeof a.url === "string");
  return hit ? hit.url : null;
}

/** A listing row that the lab received, mapped to the feed's header names.
 * Returns null for a sample not yet at the lab. coa is parseCoa's answer or null. */
export function feedRow(row, coa) {
  const labCode = String(row?.lab_code || "").trim();
  if (!labCode) return null;
  const status = String(row?.client_display_status || "");
  if (/pending arrival|pending order/i.test(status)) return null;
  const intake = intakeFromLabCode(labCode) || (row?.received_at ? easternParts(isoInstant(row.received_at)).date : null);
  if (!intake) return null;
  const name = parseSampleName(row?.name);
  const completed = /^completed$/i.test(status);
  const coaIso = completed ? isoInstant(row?.status_updated_at) : null;
  const result = completed ? (row?.latest_published_coa_passed === "Fail" ? "Fail" : row?.latest_published_coa_passed === "Pass" ? "Pass" : coa?.result || null) : null;
  const qty = number(row?.batch_quantity);
  return {
    "Lab Code": labCode,
    "Lab Name": labName(labCode),
    "Intake Date": intake,
    "Product Code": name.productCode,
    Product: name.product,
    Strain: name.strain,
    Farm: name.farm,
    "Metrc Tag": row?.batch_code || null,
    "Test Type": testType(row?.properties?.tests_info),
    Status: completed ? "Completed" : "In Process",
    Result: result,
    "Failure Mode": completed ? (coa?.failureMode ?? (result === "Pass" ? "Pass" : null)) : null,
    "Coliforms (CFU/g)": coa?.coliformsCfu ?? null,
    "Yeast & Mold (CFU/g)": coa?.yeastMoldCfu ?? null,
    "Other Failed Analyte": coa?.otherFailed?.length ? coa.otherFailed.join("; ") : null,
    "Total THC %": coa?.totalThcPct != null ? `${coa.totalThcPct}%` : null,
    "COA Posted (ET)": coaIso,
    "TAT (days)": tatDays(intake, coaIso),
    "Batch Qty (g)": qty != null ? Math.round(qty) : null,
  };
}

/** The listing filter for intakes from one date to another (inclusive, ISO dates). */
export function listingPath(fromDate, toDate, page, perPage = 500) {
  const filters = encodeURIComponent(`received_at:${fromDate},${toDate}`);
  return `/client/sampleSubmissions/api?sort=&page=${page}&per_page=${perPage}&search=&filters=${filters}`;
}

export function isoDate(d) {
  return d.toISOString().slice(0, 10);
}

export function daysAgo(n, now = new Date()) {
  return isoDate(new Date(now.getTime() - n * 86400000));
}
