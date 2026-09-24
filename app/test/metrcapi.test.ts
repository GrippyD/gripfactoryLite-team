import { describe, expect, it } from "vitest";
import {
  METRC_WRITE_ENABLED,
  facilityLicense,
  metrcApiPage,
  metrcGet,
  metrcHost,
  mirrorChanges,
  modifiedWindow,
  retryAfterMs,
  testingPackagePayload,
  testingPostRequest,
  type CallRow,
} from "../src/metrcapi";

describe("the Metrc client", () => {
  it("sends basic auth, pages at 20, and retries a 429 after Retry-After", async () => {
    const calls: CallRow[] = [];
    const slept: number[] = [];
    let n = 0;
    const fetchImpl = (async (url: string, init?: RequestInit) => {
      n += 1;
      const auth = new Headers(init?.headers).get("Authorization");
      expect(auth).toBe(`Basic ${btoa("vendor-key:user-key")}`);
      expect(String(url)).toContain("pageSize=20");
      expect(String(url)).not.toContain("vendor-key");
      expect(String(url)).not.toContain("user-key");
      if (n === 1) return new Response("{}", { status: 429, headers: { "Retry-After": "2" } });
      return new Response(JSON.stringify({ Data: [{ Name: "AU" }], TotalPages: 1 }), { status: 200 });
    }) as typeof fetch;
    const res = await metrcGet({
      env: { METRC_INTEGRATOR_KEY: "vendor-key", METRC_USER_KEY: "user-key", METRC_API_BASE: "https://sandbox-api-mi.metrc.com" },
      path: "/packages/v2/active",
      query: { licenseNumber: "AU-G-C-000832", pageNumber: "1", pageSize: "20" },
      fetchImpl,
      sleep: async (ms) => {
        slept.push(ms);
      },
      record: async (row) => {
        calls.push(row);
      },
      now: () => "2026-09-22T12:00:00.000Z",
      clock: () => 1000,
    });
    expect(res.status).toBe(200);
    expect(slept).toEqual([2000]);
    expect(calls.map((row) => row.status)).toEqual([429, 200]);
    expect(calls[0].path.startsWith("/packages/v2/active")).toBe(true);
    expect(retryAfterMs("999")).toBe(10000);
    expect(retryAfterMs("Wed, 21 Oct 2015 07:28:00 GMT")).toBe(1000);
  });

  it("fills blank mirror columns and leaves a THC the desk already typed", () => {
    const changes = mirrorChanges({
      samples: [
        {
          id: "s1",
          sample_tag: "1A4F00000000000000000A01",
          metrc_lab_testing_state: null,
          metrc_state_date: null,
          metrc_result_id: null,
          coa_file_id: null,
          overall_passed: null,
          thc_total_pct: 20.1,
        },
      ],
      orders: [
        {
          id: "o1",
          source_package_tag: "1A4F00000000000000000B01",
          metrc_lab_testing_state: "SubmittedForTesting",
          metrc_state_date: null,
        },
      ],
      packages: [
        { Label: "1A4F00000000000000000A01", Id: 9, LabTestingState: "TestPassed", LabTestingStateDate: "2026-09-22" },
        { Label: "1A4F00000000000000000B01", Id: 8, LabTestingState: "TestPassed", LabTestingStateDate: "2026-09-22" },
      ],
      resultsByLabel: new Map([
        [
          "1A4F00000000000000000A01",
          [{ LabTestResultId: 44, LabTestResultDocumentFileId: 90, OverallPassed: true, TestTypeName: "THC Total", TestResultLevel: 18.2 }],
        ],
      ]),
    });
    expect(changes.find((row) => row.field === "thc_total_pct")).toBeUndefined();
    expect(changes.find((row) => row.table === "test_orders" && row.field === "metrc_lab_testing_state")).toBeUndefined();
    expect(changes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ table: "test_samples", field: "metrc_lab_testing_state", new_value: "TestPassed" }),
        expect.objectContaining({ field: "metrc_result_id", new_value: "44" }),
        expect.objectContaining({ field: "coa_file_id", new_value: "90" }),
        expect.objectContaining({ field: "overall_passed", new_value: "1" }),
        expect.objectContaining({ table: "test_orders", field: "metrc_state_date", new_value: "2026-09-22" }),
      ])
    );
  });

  it("shapes the testing post and does not send it", () => {
    const body = testingPackagePayload({
      tag: "1A4F00000000000000000A01",
      item: "Fruity Pebbles",
      grams: 14,
      actualDate: "2026-09-22",
      sourceTag: "1A4F00000000000000000B01",
      sourceGrams: 14,
      batches: ["Raw Plant Material"],
    });
    expect(body.UseSameItem).toBe(true);
    expect(body.UnitOfMeasure).toBe("Grams");
    expect(body.Ingredients[0]).toEqual({ Package: "1A4F00000000000000000B01", Quantity: 14, UnitOfMeasure: "Grams" });
    expect(body.RequiredLabTestBatches).toEqual(["Raw Plant Material"]);
    expect(testingPostRequest("AU-G-C-000832", [body])).toBeNull();
    expect(METRC_WRITE_ENABLED).toBe(false);
  });

  it("stays on the sandbox and skips safety-compliance licenses", () => {
    expect(metrcHost({})).toBe("sandbox-api-mi.metrc.com");
    expect(metrcHost({ METRC_API_BASE: "http://api-mi.metrc.com" })).toBe("sandbox-api-mi.metrc.com");
    expect(metrcHost({ METRC_API_BASE: "https://api-mi.metrc.com" })).toBe("api-mi.metrc.com");
    expect(facilityLicense("AU-G-C-000832")).toBe(true);
    expect(facilityLicense("AU-SC-000129")).toBe(false);
    expect(facilityLicense("SC-000035")).toBe(false);
    const window = modifiedWindow(Date.parse("2026-09-22T17:00:00.000Z"));
    expect(window).toEqual({ start: "2026-09-22T15:55:00.000Z", end: "2026-09-22T17:00:00.000Z" });
  });

  it("shows absent keys and the off switch without a key value", () => {
    const html = metrcApiPage({ integrator: false, user: false, host: "sandbox-api-mi.metrc.com", calls: 0, sweep: null }, "en", "absent", 0);
    expect(html).toContain('data-metrc-integrator="absent"');
    expect(html).toContain('data-metrc-user="absent"');
    expect(html).toContain('data-metrc-write="off"');
    expect(html).toContain('data-metrc-calls="0"');
    expect(html).toContain("The integrator key is absent.");
    expect(html).not.toContain("vendor-key");
  });
});
