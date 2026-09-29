import { describe, expect, it } from "vitest";
import { HttpError } from "../src/audit";
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
