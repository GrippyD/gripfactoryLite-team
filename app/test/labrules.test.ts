import { describe, expect, it } from "vitest";
import * as R from "../src/labrules";

// THE LAB STATION (canon 0.30.362): the package's 13 rule tests
// (lab_rules.test.mjs), ported to vitest with their names, inputs and
// expectations, plus the port's own laws.

const NOW = Date.parse("2026-10-02T20:00:00Z");

/** The row of an accepted answer; a refusal fails the test with its slug. */
function okRow<T>(v: R.Checked<T>): T {
  if (!v.ok) throw new Error(`refused: ${v.error}`);
  return v.row;
}

describe("lab rules (the package's 13)", () => {
  it("normalizeTag: a 5 digit serial expands with the license prefix, a full tag is kept, junk is refused", () => {
    expect(R.normalizeTag("56801", "AU-G-C-000832")).toStrictEqual({ ok: true, tag: "1A40503000311FB000056801" });
    expect(R.normalizeTag("01301", "AU-P-000694")).toStrictEqual({ ok: true, tag: "1A40503000617610000" + "01301" });
    const full = R.normalizeTag("1A4050300061761000001301", "AU-P-000694");
    expect(full.ok && full.tag?.length).toBe(24);
    expect(R.normalizeTag("1A40503000617610000", "AU-P-000694")).toStrictEqual({ ok: false, error: "tag-shape" }); // a bare prefix is neither a serial nor a tag
    expect(R.normalizeTag(" 1a4050300061761000001301 ", null)).toStrictEqual({ ok: true, tag: "1A4050300061761000001301" });
    expect(R.normalizeTag("56801", null)).toStrictEqual({ ok: false, error: "tag-serial-needs-license" });
    expect(R.normalizeTag("56801", "GR-C-001132")).toStrictEqual({ ok: false, error: "tag-serial-no-prefix-for-license" });
    expect(R.normalizeTag("B & F Infusion", null)).toStrictEqual({ ok: false, error: "tag-shape" });
    expect(R.normalizeTag("21", null)).toStrictEqual({ ok: false, error: "tag-shape" });
    expect(R.normalizeTag("", "AU-P-000694")).toStrictEqual({ ok: true, tag: null });
    expect(R.licenseForTag("1A4050300061761000001301")).toBe("AU-P-000694");
    expect(R.licenseForTag("1A40503000311FB000056801")).toBe("AU-G-C-000832");
    expect(R.licenseForTag("nope")).toBe(null);
    expect(R.tagSerial("1A40503000311FB000056801")).toBe("56801");
  });

  it("sheet values: percent formatted fractions rescale, water activity never does, rounding is at the right digit", () => {
    expect(R.sheetMoisture(0.417)).toBe(41.7); // a workbook cell stored 0.417 for 41.7%
    expect(R.sheetMoisture(0.14)).toBe(14); // 0.14 * 100 is 14.000000000000002 in floating point
    expect(R.sheetMoisture(41.7)).toBe(41.7); // a value typed as a plain percent
    expect(R.sheetMoisture("")).toBe(null);
    expect(R.sheetMoisture(" ")).toBe(null);
    expect(R.sheetMoisture(1.5)).toBe(1.5);
    expect(R.sheetMoisture(120)).toBe(undefined); // out of range is a refusal, never a clamp
    expect(R.sheetAw(0.94)).toBe(0.94);
    expect(R.sheetAw(0.6752)).toBe(0.6752);
    expect(R.sheetAw(67.52)).toBe(0.6752); // a percent formatted aw cell; 0.68 would flip a 0.65 limit
    expect(R.sheetAw(0.0049)).toBe(undefined); // a typo
    expect(R.sheetThc(0.14)).toBe(14);
    expect(R.sheetThc(14.9)).toBe(14.9);
  });

  it("validateInternalTest: percents as typed, one instrument required, auto stamp, future refused", () => {
    const base = { id: "lt_abcdefgh12", location: "Silo 3", reason: "During Silo", license: "AU-G-C-000832", metrc_tag: "56803", sample_type: "Flower" };
    const av = R.validateInternalTest({ ...base, moisture_pct: "12.4" }, NOW);
    expect(av.ok).toBe(true);
    const a = okRow(av);
    expect(a.moisture_pct).toBe(12.4);
    expect(a.water_activity).toBe(null);
    expect(a.metrc_tag).toBe("1A40503000311FB000056803");
    expect(a.tested_at).toBe(new Date(NOW).toISOString());
    expect(a.tested_at_source).toBe("auto");
    const b = okRow(R.validateInternalTest({ ...base, water_activity: "0.55", tested_at: "2026-10-02T14:05:00Z" }, NOW));
    expect(b.tested_at_source).toBe("typed");
    expect(b.water_activity).toBe(0.55);
    expect(R.validateInternalTest({ ...base }, NOW)).toStrictEqual({ ok: false, error: "no-instrument-result" });
    expect(R.validateInternalTest({ ...base, moisture_pct: "0.417" }, NOW)).toStrictEqual({ ok: false, error: "moisture_pct" }); // the station takes percents, a fraction is refused, not rescaled
    expect(R.validateInternalTest({ ...base, moisture_pct: "12", tested_at: "2026-10-05T00:00:00Z" }, NOW)).toStrictEqual({ ok: false, error: "tested_at" });
    expect(R.validateInternalTest({ ...base, moisture_pct: "12", metrc_tag: "abc" }, NOW)).toStrictEqual({ ok: false, error: "tag-shape" });
    expect(R.validateInternalTest({ ...base, moisture_pct: "12", license: null, metrc_tag: "56803" }, NOW)).toStrictEqual({ ok: false, error: "tag-serial-needs-license" });
    expect(R.validateInternalTest({ ...base, moisture_pct: "12", id: "bad id" }, NOW)).toStrictEqual({ ok: false, error: "id" });
    expect(R.validateInternalTest({ ...base, moisture_pct: "12", location: "" }, NOW)).toStrictEqual({ ok: false, error: "location" });
    // a full tag from the other license is kept as typed even with a different license picked
    const c = okRow(R.validateInternalTest({ ...base, moisture_pct: "12", metrc_tag: "1A4050300061761000001301" }, NOW));
    expect(c.metrc_tag).toBe("1A4050300061761000001301");
  });

  it("timeFromNotes reads the bench's own clock in NOTAS", () => {
    expect(R.timeFromNotes("3:44PM")).toStrictEqual({ h: 15, min: 44, sec: 0 });
    expect(R.timeFromNotes("9:45AM")).toStrictEqual({ h: 9, min: 45, sec: 0 });
    expect(R.timeFromNotes("12:05 am")).toStrictEqual({ h: 0, min: 5, sec: 0 });
    expect(R.timeFromNotes("7:15am sample taking")).toStrictEqual({ h: 7, min: 15, sec: 0 });
    expect(R.timeFromNotes("WPR")).toBe(null);
    expect(R.timeFromNotes("BATCH 039- CSA")).toBe(null);
  });

  it("validateComplianceSample: lifecycle guards", () => {
    const base = { id: "cs_abcdefgh12", license: "AU-P-000694", source_metrc_tag: "01301", required_test: "Full Compliance", net_weight_g: "114" };
    const av = R.validateComplianceSample(base, NOW);
    expect(av.ok).toBe(true);
    const a = okRow(av);
    expect(a.status).toBe("scheduled");
    expect(a.market).toBe("AU");
    expect(a.source_metrc_tag).toBe("1A4050300061761000001301");
    expect(a.sample_tag).toBe(null);
    expect(R.validateComplianceSample({ ...base, status: "In Testing" }, NOW)).toStrictEqual({ ok: false, error: "sample_tag-required" });
    const bv = R.validateComplianceSample({ ...base, status: "In Testing", sample_tag: "02310", testing_facility: "ACT", entered_testing_on: "2026-09-28" }, NOW);
    expect(bv.ok).toBe(true);
    const b = okRow(bv);
    expect(b.status).toBe("in_testing");
    expect(b.sample_tag).toBe("1A4050300061761000002310");
    expect(R.validateComplianceSample({ ...base, status: "Failed", sample_tag: "02310" }, NOW)).toStrictEqual({ ok: false, error: "fail_reason-required" });
    expect(R.validateComplianceSample({ ...base, status: "Failed", sample_tag: "02310", fail_reason: "Coliforms" }, NOW).ok).toBe(true);
    expect(R.validateComplianceSample({ ...base, sample_tag: "02310", status: "passed", entered_testing_on: "2026-09-28", finished_testing_on: "2026-09-27" }, NOW)).toStrictEqual({
      ok: false,
      error: "finished-before-entered",
    });
    expect(R.validateComplianceSample({ ...base, status: "bogus" }, NOW)).toStrictEqual({ ok: false, error: "status" });
    expect(R.validateComplianceSample({ ...base, license: "XX" }, NOW)).toStrictEqual({ ok: false, error: "license" });
    expect(R.validateComplianceSample({ ...base, source_metrc_tag: "" }, NOW)).toStrictEqual({ ok: false, error: "source_metrc_tag" });
    expect(okRow(R.validateComplianceSample({ ...base, program: "rnd", required_test: "Full Panel R&D" }, NOW)).program).toBe("rnd");
    // the sheet's own date spelling
    expect(okRow(R.validateComplianceSample({ ...base, sample_tag: "02310", status: "In Testing", entered_testing_on: "09-28-26" }, NOW)).entered_testing_on).toBe("2026-09-28");
  });

  it("turnaroundDays and readiness", () => {
    expect(R.turnaroundDays("2026-09-24", "2026-09-28", NOW)).toBe(4);
    expect(R.turnaroundDays("2026-09-28", null, NOW)).toBe(4); // to today, 2026-10-02
    expect(R.turnaroundDays(null, null, NOW)).toBe(null);
    const readings = [
      { reason: "After Cryo", water_activity: 0.72, tested_at: "2026-09-20T12:00:00Z" },
      { reason: "After Cryo", water_activity: 0.55, tested_at: "2026-09-22T12:00:00Z" },
      { reason: "During Silo", water_activity: 0.3, tested_at: "2026-09-23T12:00:00Z" },
    ];
    const r = R.readiness(readings);
    expect(r.ready).toBe(true); // the NEWEST After Cryo reading decides, not the first
    expect(r.water_activity).toBe(0.55);
    expect(R.readiness([readings[0]]).ready).toBe(false);
    expect(R.readiness([{ ...readings[1], voided_at: "2026-09-23T00:00:00Z" }, readings[0]]).ready).toBe(false); // a voided reading does not count
    expect(R.readiness([]).ready).toBe(false);
    expect(R.readiness([{ reason: "After Cryo", water_activity: 0.6, tested_at: "2026-09-22T12:00:00Z" }]).ready).toBe(true); // at the limit is ready
  });

  it("validateOpResult: a LightLab export row with ND, --, Low, and the instrument's own offset", () => {
    const row: Record<string, string> = Object.fromEntries(R.OP_HEADER.map((h) => [h, ""]));
    Object.assign(row, {
      "Test ID": "c1f72e12-b609-f6aa-b64e-4372b14528a1",
      "Serial Number": "LL030540",
      Date: "2025-10-06",
      Time: "09:04:31-04:00",
      "Sample ID": "27876",
      "Sample Type": "Plant",
      Weight: "0.297 g",
      "Solvent Volume": "30 ml",
      "Moisture Correction": "0",
      Temperature: "23.7 \u00B0C",
      Unit: "%",
      Notes: "KIEF",
      Confidence: "GOOD",
      "THC-A": "25.5",
      "\u03949-THC": "1",
      "CBD-A": "ND",
      CBD: "ND",
      "CBG-A": "1",
      "CBD/CBG": "n/a",
      CBG: "ND",
      "CBN-A": "0.54",
      CBN: "ND",
      "CBC-A": "1.6",
      CBC: "ND",
      "\u03948-THC*": "--",
      "\u039410-THC": "n/a",
      "THCV-A": "1.3",
      THCV: "ND",
      Terpenes: "Low",
      "Total THC": "23.4",
      "Total CBD": "ND",
      "Total Cannabinoids": "31",
    });
    const v = R.validateOpResult(row, NOW);
    expect(v.ok, JSON.stringify(v)).toBe(true);
    const o = okRow(v);
    expect(o.tested_at).toBe("2025-10-06T13:04:31.000Z");
    expect(o.tested_at_offset).toBe("-04:00");
    expect(o.material_class).toBe("Kief");
    expect(o.thca).toBe(25.5);
    expect(o.cbda).toBe(null);
    expect(o.d8_thc).toBe(null);
    expect(o.terpenes_level).toBe("Low");
    expect(o.total_thc).toBe(23.4);
    expect(o.weight_g).toBe(0.297);
    expect(o.temperature_c).toBe(23.7);
    expect(JSON.parse(o.nd_json)).toStrictEqual(["CBD-A", "CBD", "CBG", "CBN", "CBC", "THCV", "Total CBD"]);
    expect(R.validateOpResult({ ...row, Terpenes: "7" }, NOW)).toStrictEqual({ ok: false, error: "terpenes" });
    expect(R.validateOpResult({ ...row, "THC-A": "abc" }, NOW)).toStrictEqual({ ok: false, error: "analyte:THC-A" });
    expect(R.validateOpResult({ ...row, "Test ID": "" }, NOW)).toStrictEqual({ ok: false, error: "test_id" });
    expect(R.validateOpResult({ ...row, Time: "9am" }, NOW)).toStrictEqual({ ok: false, error: "time" });
    expect(R.opMaterialClass("flower")).toBe("Flower");
    expect(R.opMaterialClass("BIOMASS")).toBe("Biomass");
    expect(R.opMaterialClass("bud")).toBe("Flower");
    expect(R.opMaterialClass("whatever")).toBe(null);
  });

  it("validateScheduleCell: two silos in one cell, an unknown location refused", () => {
    expect(R.validateScheduleCell({ day: "2026-09-29", hour: 10, locations: "Silo 3/Silo 5" })).toStrictEqual({ ok: true, row: { day: "2026-09-29", hour: 10, locations: ["Silo 3", "Silo 5"] } });
    expect(okRow(R.validateScheduleCell({ day: "2026-09-29", hour: 10, locations: "" })).locations).toStrictEqual([]);
    expect(R.validateScheduleCell({ day: "2026-09-29", hour: 24, locations: "Silo 1" })).toStrictEqual({ ok: false, error: "hour" });
    expect(R.validateScheduleCell({ day: "2026-09-29", hour: 1, locations: "Silo 9" })).toStrictEqual({ ok: false, error: "location:Silo 9" });
    expect(R.validateScheduleCell({ day: "2026-13-01", hour: 1, locations: "Silo 1" })).toStrictEqual({ ok: false, error: "day" });
  });

  it("parseCsv handles quoted commas, doubled quotes, CRLF and a BOM", () => {
    const rows = R.parseCsv('\uFEFFa,b,c\r\n1,"x, y","say ""hi"""\r\n2,,\n');
    expect(rows).toStrictEqual([
      ["a", "b", "c"],
      ["1", "x, y", 'say "hi"'],
      ["2", "", ""],
    ]);
    const o = R.csvToObjects("Tag,Quantity\n1A4050300061761000000411,205692\n", ["Tag", "Quantity"]);
    expect(o.ok).toBe(true);
    expect(o.ok && o.rows[0].Tag).toBe("1A4050300061761000000411");
    expect(R.csvToObjects("x,y\n1,2\n", ["Tag"])).toStrictEqual({ ok: false, error: "header", missing: ["Tag"] });
  });

  it("validateMetrcPackage: a report row lands, a bad tag does not", () => {
    const v = R.validateMetrcPackage({
      Tag: "1A4050300061761000000411",
      "Source Harvest(s)": "26266-ARL-OD-009-0-01-26042",
      Item: "WBP - Blueberry Diesel - ARL - O",
      "Item Strain": "Blueberry Diesel",
      Quantity: "205692",
      "Unit Of Measure": "g",
      "Lab Test Status": "NotSubmitted",
      "Packaged Date": "2026-09-29",
    });
    expect(v.ok).toBe(true);
    const row = okRow(v);
    expect(row.quantity).toBe(205692);
    expect(row.packaged_on).toBe("2026-09-29");
    expect(R.validateMetrcPackage({ Tag: "12" })).toStrictEqual({ ok: false, error: "tag" });
  });

  it("parseDay and parseInstant", () => {
    expect(R.parseDay("2026-02-30")).toBe(undefined);
    expect(R.parseDay("9/28/2026")).toBe("2026-09-28");
    expect(R.parseDay("")).toBe(null);
    expect(R.parseInstant("2019-01-01T00:00:00Z", NOW)).toBe(undefined);
    expect(R.parseInstant("2026-10-03T19:00:00Z", NOW)).toBe("2026-10-03T19:00:00.000Z"); // inside the 24 h slack
    expect(R.parseInstant("2026-10-03T21:00:00Z", NOW)).toBe(undefined);
    expect(R.parseInstant(null, NOW)).toBe(null);
    expect(R.parseInstant("2026-10-02", NOW)).toBe(undefined); // a bare day would be UTC midnight, 8 PM the day before in Detroit
  });

  it("validateInternalTest options: a missing date can be kept, the device clock is the auto time", () => {
    const base = { id: "lt_abcdefgh12", location: "Silo 3", reason: "During Silo", sample_type: "Flower", moisture_pct: "12" };
    const keep = okRow(R.validateInternalTest(base, NOW, { allowMissingDate: true }));
    expect(keep.tested_at).toBe(null);
    expect(keep.tested_at_source).toBe("missing");
    const seen = okRow(R.validateInternalTest(base, NOW, { observedAt: "2026-10-02T19:55:00Z" }));
    expect(seen.tested_at).toBe("2026-10-02T19:55:00.000Z");
    expect(seen.tested_at_source).toBe("auto");
    expect(R.validateInternalTest(base, NOW, { observedAt: "2026-10-05T00:00:00Z" })).toStrictEqual({ ok: false, error: "observed_at" });
    expect(R.validateInternalTest({ ...base, moisture_pct: "8,5" }, NOW)).toStrictEqual({ ok: false, error: "moisture_pct" });
    expect(R.validateInternalTest({ ...base, notes: "n".repeat(2001) }, NOW)).toStrictEqual({ ok: false, error: "too-long" });
    expect(okRow(R.validateInternalTest({ ...base, thc_pct: "80.6" }, NOW)).thc_pct).toBe(80.6); // a kief range value
    expect(R.validateInternalTest({ ...base, thc_pct: "101" }, NOW)).toStrictEqual({ ok: false, error: "thc_pct" });
  });

  it("options carries every pick list the page needs", () => {
    const o = R.options();
    for (const k of ["locations", "reasons", "sample_types", "licenses", "required_tests", "facilities", "statuses", "fail_reasons", "tag_prefix_by_license", "ranges"] as const) {
      expect(o[k], k).toBeTruthy();
    }
    expect(o.ready_aw_limit).toBe(0.6);
  });
});

describe("lab rules (the port's own laws)", () => {
  it("REASONS offers no named-request shape, and a stored one stays valid and correctable", () => {
    for (const r of R.REASONS) expect(R.NAMED_REQUEST_RE.test(r), r).toBe(false);
    expect(R.REASONS).toContain(R.NAMED_REQUEST);
    const stored = { id: "lt_abcdefgh12", tested_at: "2026-03-04T15:00:00.000Z", location: "Cryo Room", reason: "Bench Request", sample_type: "Flower", moisture_pct: 12.4 };
    expect(okRow(R.validateInternalTest(stored, NOW, { allowMissingDate: true })).reason).toBe("Bench Request");
    expect(R.reasonGroup(" Bench Request ")).toBe(R.NAMED_REQUEST);
    expect(R.reasonGroup("After Cryo")).toBe("After Cryo");
  });

  it("pick-list lookups read own properties only: constructor is no status and no license", () => {
    expect(R.normalizeStatus("constructor")).toBe(undefined);
    expect(R.normalizeStatus("toString")).toBe(undefined);
    const base = { id: "cs_abcdefgh12", license: "AU-P-000694", source_metrc_tag: "01301", required_test: "Full Compliance", sample_tag: "02310" };
    expect(R.validateComplianceSample({ ...base, status: "constructor" }, NOW)).toStrictEqual({ ok: false, error: "status" });
    expect(R.normalizeTag("12345", "toString")).toStrictEqual({ ok: false, error: "tag-serial-needs-license" });
  });

  it("an over-long text is refused with its slug, never thrown", () => {
    expect(R.validateInternalTest({ id: "lt_" + "a".repeat(70), location: "Silo 1", reason: "During Silo", sample_type: "Flower", moisture_pct: "12" }, NOW)).toStrictEqual({ ok: false, error: "id" });
    expect(R.validateScheduleCell({ day: "2026-09-29", hour: 1, locations: "x".repeat(65) })).toStrictEqual({ ok: false, error: "too-long" });
    expect(R.validateOpResult({ "Test ID": "a".repeat(65) }, NOW)).toStrictEqual({ ok: false, error: "too-long" });
  });

  it("the brief's smoke reading: Silo 3, During Silo, the grower license, tag 56899, moisture 13.2", () => {
    const row = okRow(R.validateInternalTest({ id: "lt_smoke0000001", location: "Silo 3", reason: "During Silo", license: "AU-G-C-000832", metrc_tag: "56899", sample_type: "Flower", moisture_pct: "13.2" }, NOW));
    expect(row.metrc_tag).toBe("1A40503000311FB000056899");
    expect(row.moisture_pct).toBe(13.2);
  });
});
