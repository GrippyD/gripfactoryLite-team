// GripFactory Lite, TL2: tests for the pure part. Run with: node --test
import test from "node:test";
import assert from "node:assert/strict";
import { coaUrlOf, feedRow, intakeFromLabCode, listingPath, parseCoa, parseSampleName, tatDays, testType } from "./lib.mjs";

const table = (rows) => "<table>" + rows.map((r) => "<tr>" + r.map((c) => "<td>" + c + "</td>").join("") + "</tr>").join("") + "</table>";

const PASS_COA =
  "<h1>CERTIFICATE OF ANALYSIS</h1><p>PRODUCED: OCT 20, 2026</p><p>BATCH RESULT: <span>PASS</span></p>" +
  table([
    ["ANALYTE", "LABELED AMOUNT", "LIMIT", "DETECTED", "DETECTED", "LOD", "LOQ", "PASS/FAIL"],
    ["THCA", "", "", "20.213 %", "202.13 mg/g", "0.213 mg/g", "0.529 mg/g", "N/A"],
    ["TOTAL THC", "", "", "18.93 %", "189.3 mg/g", "", "", "N/A"],
  ]) +
  table([
    ["ANALYTE", "LIMIT", "DETECTED", "PASS/FAIL"],
    ["COLIFORMS", "1000 CFU/g", "ND", "PASS"],
    ["YEAST &amp; MOLD", "100000 CFU/g", "2800 CFU/g", "PASS"],
  ]);

const FAIL_COA =
  "<p>PRODUCED: SEP 25, 2026</p><p>BATCH RESULT: FAIL</p>" +
  table([
    ["ANALYTE", "LIMIT", "DETECTED", "PASS/FAIL"],
    ["COLIFORMS", "1000 CFU/g", "11000 CFU/g", "FAIL"],
    ["YEAST &amp; MOLD", "100000 CFU/g", "ND", "PASS"],
  ]) +
  table([
    ["ANALYTE", "LIMIT", "DETECTED", "PASS/FAIL"],
    ["INORGANIC MATTER", "Any amount", "ND", "PASS"],
    ["STEMS", "5 %", "6.5 %", "FAIL"],
  ]);

const row = (over = {}) => ({
  lab_code: "RAS-261015-028",
  name: "WPR - Chrome Dome - PNN - O",
  batch_code: "1A4050300061761000001771",
  received_at: "2026-10-15T19:06:51.000000Z",
  status_updated_at: "2026-10-20T14:40:46.000000Z",
  client_display_status: "Completed",
  latest_published_coa_passed: "Pass",
  batch_quantity: "22565",
  properties: { tests_info: { kind: ["compliance"], tests: { microbial_test: [{}], cannabinoid_test: [{}], pesticide_test: [{}] } } },
  extra_action_items: [{ name: "View COA", url: "https://lims.tagleaf.com/coas/abc" }],
  ...over,
});

test("the intake date reads from the lab code", () => {
  assert.equal(intakeFromLabCode("RAS-261015-028"), "2026-10-15");
  assert.equal(intakeFromLabCode("CL-150926-003"), "2026-09-15");
  assert.equal(intakeFromLabCode("RAS-261345-001"), null);
  assert.equal(intakeFromLabCode(""), null);
});

test("the sample name splits into code, product, strain and farm", () => {
  assert.deepEqual(parseSampleName("WPR - Chrome Dome - PNN - O"), { productCode: "WPR", product: "Prepack", strain: "Chrome Dome", farm: "PNN" });
  assert.deepEqual(parseSampleName("BUD - Death Star - PNS - O"), { productCode: "BUD", product: "Bulk", strain: "Death Star", farm: "PNS" });
  assert.deepEqual(parseSampleName("Mystery item"), { productCode: "?", product: "Unknown", strain: null, farm: null });
});

test("the test type follows the tests ordered", () => {
  assert.equal(testType({ kind: ["compliance"], tests: { microbial_test: [], cannabinoid_test: [] } }), "First-time");
  assert.equal(testType({ kind: ["compliance"], tests: { microbial_test: [] } }), "Retest");
  assert.equal(testType({ kind: ["qa"], tests: { microbial_test: [] } }), "Internal QA");
});

test("TAT is the Eastern COA clock over the intake midnight", () => {
  assert.equal(tatDays("2026-09-21", "2026-09-25T18:35:00.000Z"), 4.607639);
  assert.equal(tatDays("2026-11-02", "2026-11-03T15:00:00.000Z"), 1.416667);
  assert.equal(tatDays(null, "2026-09-25T18:35:00.000Z"), null);
});

test("a passing COA gives Pass, no counts, and the potency", () => {
  const coa = parseCoa(PASS_COA);
  assert.equal(coa.result, "Pass");
  assert.equal(coa.failureMode, "Pass");
  assert.equal(coa.coliformsCfu, null);
  assert.equal(coa.yeastMoldCfu, null);
  assert.equal(coa.totalThcPct, 18.93);
  assert.equal(coa.producedOn, "OCT 20, 2026");
  assert.deepEqual(coa.otherFailed, []);
});

test("a failing COA names the mode and the counts", () => {
  const coa = parseCoa(FAIL_COA);
  assert.equal(coa.result, "Fail");
  assert.equal(coa.failureMode, "Coliform");
  assert.equal(coa.coliformsCfu, 11000);
  assert.equal(coa.yeastMoldCfu, null);
  assert.deepEqual(coa.otherFailed, ["Stems 6.5 %"]);
  assert.equal(coa.totalThcPct, null);
});

test("both microbial fails read Both; a foreign matter fail alone reads Foreign Matter", () => {
  const both = parseCoa("BATCH RESULT: FAIL" + table([["COLIFORMS", "1000 CFU/g", "2000 CFU/g", "FAIL"], ["YEAST & MOLD", "100000 CFU/g", "250000 CFU/g", "FAIL"]]));
  assert.equal(both.failureMode, "Both");
  assert.equal(both.yeastMoldCfu, 250000);
  const foreign = parseCoa("BATCH RESULT: FAIL" + table([["INORGANIC MATTER", "Any amount", "1 %", "FAIL"]]));
  assert.equal(foreign.failureMode, "Foreign Matter");
  assert.deepEqual(foreign.otherFailed, ["Inorganic Matter 1 %"]);
});

test("a completed listing row becomes a feed row with the sheet's header names", () => {
  const r = feedRow(row(), parseCoa(PASS_COA));
  assert.equal(r["Lab Code"], "RAS-261015-028");
  assert.equal(r["Lab Name"], "Reassure");
  assert.equal(r["Intake Date"], "2026-10-15");
  assert.equal(r["Product Code"], "WPR");
  assert.equal(r.Product, "Prepack");
  assert.equal(r.Strain, "Chrome Dome");
  assert.equal(r.Farm, "PNN");
  assert.equal(r["Metrc Tag"], "1A4050300061761000001771");
  assert.equal(r["Test Type"], "First-time");
  assert.equal(r.Status, "Completed");
  assert.equal(r.Result, "Pass");
  assert.equal(r["Failure Mode"], "Pass");
  assert.equal(r["Total THC %"], "18.93%");
  assert.equal(r["COA Posted (ET)"], "2026-10-20T14:40:46.000Z");
  assert.equal(r["TAT (days)"], tatDays("2026-10-15", "2026-10-20T14:40:46.000Z"));
  assert.equal(r["Batch Qty (g)"], 22565);
});

test("an in process row carries no result, no COA and no TAT; one not yet at the lab is skipped", () => {
  const r = feedRow(row({ client_display_status: "In Process", latest_published_coa_passed: null }), null);
  assert.equal(r.Status, "In Process");
  assert.equal(r.Result, null);
  assert.equal(r["COA Posted (ET)"], null);
  assert.equal(r["TAT (days)"], null);
  assert.equal(r["Failure Mode"], null);
  assert.equal(feedRow(row({ client_display_status: "Pending Arrival", received_at: null }), null), null);
  assert.equal(feedRow({ lab_code: "" }, null), null);
});

test("a completed fail without its COA read yet keeps the result and waits for the mode", () => {
  const r = feedRow(row({ latest_published_coa_passed: "Fail" }), null);
  assert.equal(r.Result, "Fail");
  assert.equal(r["Failure Mode"], null);
  assert.equal(r["Total THC %"], null);
});

test("the COA link and the listing path", () => {
  assert.equal(coaUrlOf(row()), "https://lims.tagleaf.com/coas/abc");
  assert.equal(coaUrlOf({ extra_action_items: { a: { name: "COA PDF", url: "x" } } }), null);
  assert.equal(listingPath("2026-09-29", "2026-10-21", 2), "/client/sampleSubmissions/api?sort=&page=2&per_page=500&search=&filters=received_at%3A2026-09-29%2C2026-10-21");
});
