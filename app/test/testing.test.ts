import { describe, expect, it } from "vitest";
import { HttpError } from "../src/audit";
import { sortTestingTags, testingFigures, testingParentKey, testingParents, testingSection, type TestingHistoryRow, type TestingParentRow, type TestingTagRow } from "../src/console";
import { pendingUploadsPage } from "../src/html";
import {
  TEST_SAMPLE_CSV_HEADER,
  requireSampleTag,
  sampleGrams,
  testSampleCsv,
  testingDeskPage,
  testingLabsPage,
  type TestingDesk,
  type TestingLab,
} from "../src/testing";

const HEADER_COLS = TEST_SAMPLE_CSV_HEADER.split(",");

describe("sample size", () => {
  it("uses 0.5 percent, a 14 g floor, and the lab increment when known", () => {
    expect(sampleGrams(752, null)).toBe(14);
    expect(sampleGrams(2800, null)).toBe(14);
    expect(sampleGrams(2801, null)).toBe(15);
    expect(sampleGrams(10000, null)).toBe(50);
    expect(sampleGrams(10000, 7)).toBe(56);
    expect(sampleGrams(22400, null)).toBe(112);
    expect(sampleGrams(22534, null)).toBe(113);
    expect(sampleGrams(0, null)).toBe(14);
  });
});

describe("the test sample CSV", () => {
  it("keeps the Metrc header and writes grams at two decimals", () => {
    expect(HEADER_COLS).toHaveLength(19);
    expect(HEADER_COLS[0]).toBe("Tag Number");
    expect(HEADER_COLS[1]).toBe("Location Name");
    expect(HEADER_COLS[3]).toBe("Use Same Item");
    expect(HEADER_COLS[14]).toBe("Package Number");
    const csv = testSampleCsv([
      {
        sample_tag: "1A4F00000000000000000A01",
        item_name: "Fruity Pebbles",
        net_grams: 14,
        actual_date: "2026-09-22",
        source_package: "1A4F00000000000000000B01",
      },
    ]);
    expect(csv.startsWith(TEST_SAMPLE_CSV_HEADER + "\r\n")).toBe(true);
    expect(csv).toContain("1A4F00000000000000000A01,In Testing,Fruity Pebbles,true,14.00,Grams,");
    expect(csv).toContain(",1A4F00000000000000000B01,14.00,Grams,,");
    expect(csv).not.toContain("448");
  });

  it("refuses a tag that is not tag-shaped", () => {
    expect(requireSampleTag("1a4f00000000000000000a01")).toBe("1A4F00000000000000000A01");
    expect(() => requireSampleTag("NOTATAG")).toThrow(HttpError);
    try {
      requireSampleTag("NOTATAG");
    } catch (err) {
      expect(err).toBeInstanceOf(HttpError);
      expect((err as HttpError).message).toContain("METRC tag");
      expect((err as HttpError).status).toBe(400);
    }
  });
});

function desk(grams: number): TestingDesk {
  return {
    labs: [
      {
        id: "sc-labs-michigan",
        name: "SC Labs Michigan",
        portal_kind: "tagleaf",
        portal_url: "https://lims.tagleaf.com/login?affiliate=can-lab-llc",
        med_license: "SC-000035",
        au_license: "AU-SC-000129",
        turnaround_days: null,
        pickup_cutoff: null,
        sample_increment_grams: null,
        active: 1,
      },
    ],
    ready: [
      {
        lot_id: "lot-1",
        dry_grams: grams,
        harvest_batch_id: "hb-1",
        hbn: "26244-ARL-GH-027-0-NA-26002",
        farm_code: "ARL",
        license_value: "AU-G-C-000832",
        strain_name: "Fruity Pebbles",
        package_code: "PKG",
        metrc_tag: null,
        metrc_harvest_tag: null,
      },
    ],
    orders: [],
    manifests: [],
  };
}

describe("the desk page", () => {
  it("schedules a 50.3 lb batch and shows its weight", () => {
    const heavy = testingDeskPage(desk(22534), "en");
    expect(heavy).toContain('action="/testing/schedule"');
    expect(heavy).toContain("22,534");
    expect(heavy).toContain('data-sample-grams="113"');
    expect(heavy).not.toContain("over 50 lb");
    expect(heavy).not.toContain("R 420.304");
    expect(heavy).not.toContain('data-over="1"');
    const light = testingDeskPage(desk(752), "en");
    expect(light).toContain('action="/testing/schedule"');
    expect(light).toContain('data-sample-grams="14"');
    expect(light).toContain("Book the pickup in the lab portal.");
    expect(light).not.toContain("R 420.306");
  });

  it("lists the labs, including a closed one, without a driver field", () => {
    const labs: TestingLab[] = [
      {
        id: "viridis",
        name: "Viridis",
        portal_kind: "other",
        portal_url: null,
        med_license: "SC-000009",
        au_license: "AU-SC-000113",
        turnaround_days: null,
        pickup_cutoff: null,
        sample_increment_grams: null,
        active: 0,
      },
    ];
    const html = testingLabsPage(labs, "en");
    expect(html).toContain('data-lab-row="viridis"');
    expect(html).toContain('data-active="0"');
    expect(html).toContain("SC-000009");
    expect(html).not.toContain('name="driver_name"');
  });

  it("puts a test-sample file on Pending Data Uploads", () => {
    const html = pendingUploadsPage(
      [],
      "en",
      [],
      [],
      [],
      [],
      [],
      { movements: new Set(), batches: new Set(), parents: new Set() },
      [],
      [],
      [],
      [
        {
          id: "man-1",
          manifest_date: "2026-09-22",
          lab_name: "SC Labs Michigan",
          license_value: "AU-SC-000129",
          hbn: "26244-ARL-GH-027-0-NA-26002",
          harvest_batch_id: "hb-1",
          samples: 1,
          untagged: 1,
          filename: "test_sample_2026-09-22_man-1.csv",
        },
      ]
    );
    expect(html).toContain('data-test-sample="man-1"');
    expect(html).toContain("/admin/uploads/test_sample/man-1.csv");
    expect(html).toContain("no METRC tag yet");
    expect(html).toContain("Clear all pending (1)");
  });
});

describe("the console Testing section", () => {
  const tag = "1A4F00000000000000000B01";
  const order = (row: Partial<TestingHistoryRow> & Pick<TestingHistoryRow, "id" | "parentKey" | "created_at" | "panel">): TestingHistoryRow => ({
    grams: 0,
    overall_passed: null,
    lab: "SC Labs Michigan",
    strain: "Fruity Pebbles",
    farm: "ARL",
    failed_types: [],
    ...row,
  });

  it("names the parent by its tag, then its package code, then the lot", () => {
    expect(testingParentKey({ source_package_tag: "1a4f00000000000000000b01", source_package_code: "PKG", lot_id: "lot-1" })).toBe(tag);
    expect(testingParentKey({ source_package_tag: "NOTATAG", source_package_code: "PKG", lot_id: "lot-1" })).toBe("PKG");
    expect(testingParentKey({ source_package_tag: null, source_package_code: "  ", lot_id: "lot-1" })).toBe("lot-1");
  });

  it("rates the first full panel by weight and leaves potency, pending, and a later pass out", () => {
    const parents = testingParents([
      order({ id: "pass-1", parentKey: "PARENT-A", created_at: "2026-09-01T00:00:00.000Z", panel: "full_compliance", grams: 30000, overall_passed: 1, lab: "SC Labs Michigan", strain: "Fruity Pebbles", farm: "ARL" }),
      order({ id: "fail-1", parentKey: "PARENT-B", created_at: "2026-09-02T00:00:00.000Z", panel: "full_compliance", grams: 10000, overall_passed: 0, lab: "ACT Laboratories", strain: "Gelato", farm: "PNN", failed_types: ["pesticides", "microbials"] }),
      order({ id: "fail-retest", parentKey: "PARENT-B", created_at: "2026-09-03T00:00:00.000Z", panel: "full_compliance", grams: 12000, overall_passed: 1, lab: "SC Labs Michigan", strain: "Gelato", farm: "PNN" }),
      order({ id: "potency", parentKey: "PARENT-C", created_at: "2026-09-01T00:00:00.000Z", panel: "potency", grams: 50000, overall_passed: 1 }),
      order({ id: "pending", parentKey: "PARENT-D", created_at: "2026-09-01T00:00:00.000Z", panel: "full_compliance", grams: 8000, overall_passed: null }),
      order({ id: "pending-later", parentKey: "PARENT-D", created_at: "2026-09-04T00:00:00.000Z", panel: "full_compliance", grams: 8000, overall_passed: 1 }),
      order({ id: "rnd-first", parentKey: "PARENT-E", created_at: "2026-09-01T00:00:00.000Z", panel: "rnd", grams: 4000, overall_passed: 0 }),
      order({ id: "full-after-rnd", parentKey: "PARENT-E", created_at: "2026-09-02T00:00:00.000Z", panel: "full_compliance", grams: 4000, overall_passed: 1, lab: "Lab Link", strain: "OG", farm: "PNS" }),
    ]);
    const byKey = new Map(parents.map((row) => [row.parentKey, row]));
    expect([...byKey.keys()].sort()).toEqual(["PARENT-A", "PARENT-B", "PARENT-E"]);
    expect(byKey.get("PARENT-B")).toMatchObject({ grams: 10000, passedFirst: 0, lab: "ACT Laboratories", strain: "Gelato", farm: "PNN", failed_types: ["pesticides", "microbials"] });
    expect(byKey.get("PARENT-E")).toMatchObject({ grams: 4000, passedFirst: 1, lab: "Lab Link" });
    const rated = parents.filter((row) => row.parentKey === "PARENT-A" || row.parentKey === "PARENT-B");
    const figures = testingFigures({ ready: 1, scheduled: 0, waiting: 0, parents: rated, tags: [] });
    expect(figures.first).toEqual({ passed: 1, all: 2, passedGrams: 30000, allGrams: 40000 });
    const act = figures.labs.find((lab) => lab.lab === "ACT Laboratories");
    const sc = figures.labs.find((lab) => lab.lab === "SC Labs Michigan");
    expect(act?.failures).toEqual([
      { test_type: "microbials", grams: 10000, count: 1 },
      { test_type: "pesticides", grams: 10000, count: 1 },
    ]);
    expect(sc).toMatchObject({ passed: 1, all: 1, passedGrams: 30000, allGrams: 30000, failures: [] });
    expect(figures.strains.find((row) => row.strain === "Gelato")?.farms[0]).toEqual({
      farm: "PNN",
      passed: 0,
      all: 1,
      passedGrams: 0,
      allGrams: 10000,
    });
    expect(figures.strains.find((row) => row.strain === "Fruity Pebbles")?.farms[0]).toMatchObject({ farm: "ARL", passedGrams: 30000 });
  });

  const passedParent: TestingParentRow = {
    parentKey: "PARENT-A",
    grams: 30000,
    passedFirst: 1,
    lab: "SC Labs Michigan",
    strain: "Fruity Pebbles",
    farm: "ARL",
    failed_types: [],
  };
  const failedParent: TestingParentRow = {
    parentKey: "PARENT-B",
    grams: 10000,
    passedFirst: 0,
    lab: "ACT Laboratories",
    strain: "Gelato",
    farm: "PNN",
    failed_types: ["microbials", "pesticides"],
  };
  const tags: TestingTagRow[] = [
    {
      source_tag: null,
      package_code: "PKG",
      hbn: "26244-ARL-GH-027-0-NA-26002",
      lab: "SC Labs Michigan",
      results_at: "2026-09-22T12:00:00.000Z",
      attempt: 1,
      coa_url: "https://lims.tagleaf.com/coa_/smoke",
      thc_total_pct: 20.1,
    },
    {
      source_tag: tag,
      package_code: null,
      hbn: "26244-ARL-GH-027-0-NA-26002",
      lab: "ACT Laboratories",
      results_at: "2026-09-23T12:00:00.000Z",
      attempt: 2,
      coa_url: null,
      thc_total_pct: 10,
    },
  ];

  it("sorts THC and keeps a blank last", () => {
    const sorted = sortTestingTags(tags, "asc");
    expect(sorted.map((row) => row.thc_total_pct)).toEqual([10, 20.1]);
    expect(sortTestingTags([{ ...tags[0], thc_total_pct: null }, tags[1]], "desc").map((row) => row.thc_total_pct)).toEqual([10, null]);
  });

  it("renders the weight, the package counts, and the attempt beside the date", () => {
    const figures = testingFigures({ ready: 3, scheduled: 2, waiting: 1, parents: [failedParent, passedParent], tags });
    const html = testingSection(figures, { year: 2026, day: "2026-09-01", dayPicked: true, thcSort: "asc" });
    expect(html).toContain('data-hc-section="testing"');
    expect(html).not.toContain("hc-stub");
    expect(html).toContain('data-hc="lots_ready">3<');
    expect(html).toContain('data-hc="first_pass">75.0%<');
    expect(html).not.toContain("50.0%");
    expect(html).toContain('data-hc="first_pass_lb">66.96 of 89.29 lb<');
    expect(html).toContain('data-hc="first_pass_packages">1 of 2 packages<');
    expect(html).toContain("harvest year 2026");
    expect(html).toContain("does not change these numbers");
    expect(html).toContain('data-hc-thc-sort="asc"');
    expect(html).toContain("day=2026-09-01");
    expect(html).toContain('data-hc-lab="ACT Laboratories"');
    expect(html).toContain('data-hc-lab="SC Labs Michigan"');
    expect(html).toContain('data-hc-failure="microbials"');
    expect(html).toContain('data-hc-failure="pesticides"');
    expect(html).toContain('data-hc="failure_lb">22.32 lb<');
    expect(html.indexOf('data-hc-failure="microbials"')).toBeLessThan(html.indexOf('data-hc-failure="pesticides"'));
    expect(html).toContain('data-hc-strain="Gelato"');
    expect(html).toContain('data-hc-farm="PNN"');
    expect(html).toContain('data-hc-strain="Fruity Pebbles"');
    expect(html).toContain('data-hc-farm="ARL"');
    expect(html).toContain('data-hc="attempt">attempt 1<');
    expect(html).toContain('data-hc="attempt">attempt 2<');
    expect(html).toContain("2026-09-23");
    expect(html).toContain(tag);
    expect(html).not.toContain("1A4F00000000000000000A01");
    const empty = testingSection(testingFigures({ ready: 0, scheduled: 0, waiting: 0, parents: [], tags: [] }), { year: 2026 });
    expect(empty).toContain('data-hc="first_pass">no results<');
    expect(empty).toContain("No COAs yet.");
  });
});
