import { afterEach, describe, expect, it, vi } from "vitest";
import { METRC_SWEEP_DEFAULTS } from "../src/config";
import {
  KEY_CHARACTER_REFUSAL,
  METRC_HOST_REFUSAL,
  METRC_WRITE_ENABLED,
  PRODUCTION_BASE_RE,
  SANDBOX_BASE_RE,
  SANDBOX_DESK_NOTE,
  SEND_EVAL_OFF,
  SEND_METHOD_REFUSED,
  SEND_ON_PRODUCTION,
  SWEEP_MODE_UNKNOWN,
  SWEEP_ON_OTHER,
  SWEEP_WRITE_ON_OTHER,
  SWEEP_WRITE_ON_SANDBOX,
  basicToken,
  callPath,
  facilityLicense,
  facilityReach,
  loadMetrcAdmin,
  metrcApiPage,
  metrcBase,
  metrcGet,
  metrcHost,
  metrcHostKind,
  metrcSend,
  metrcStubBase,
  metrcUrl,
  mirrorChanges,
  modifiedWindow,
  parseFacilities,
  recordMetrcCall,
  resolveSweepMode,
  retryAfterAboveCap,
  retryAfterMs,
  runMetrcSweep,
  scrubKeys,
  sendRefusal,
  storedWords,
  testMetrcConnection,
  testingPackagePayload,
  testingPostRequest,
  userKeyFor,
  type CallRow,
} from "../src/metrcapi";
import { loadMetrcSweepConfig } from "../src/metrcpager";
import { migratedDb } from "./migrated";

afterEach(() => {
  vi.unstubAllGlobals();
});

const SANDBOX = "https://sandbox-api-mi.metrc.com";
const PRODUCTION = "https://api-mi.metrc.com";
const FAKE = { METRC_INTEGRATOR_KEY: "fake-vendor-key", METRC_USER_KEY: "fake-user-key" };

function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers });
}

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

describe("MA1 Law 3: the host guard", () => {
  it("names sandbox, production and other hosts from metrcBase, never the raw var", () => {
    expect(metrcHostKind({})).toBe("sandbox");
    expect(metrcHostKind({ METRC_API_BASE: SANDBOX })).toBe("sandbox");
    expect(metrcHostKind({ METRC_API_BASE: "https://sandbox-api-co.metrc.com/" })).toBe("sandbox");
    expect(metrcHostKind({ METRC_API_BASE: `${PRODUCTION}/Documentation/` })).toBe("production");
    expect(metrcHostKind({ METRC_API_BASE: "HTTPS://API-MI.METRC.COM" })).toBe("production");
    expect(metrcHostKind({ METRC_API_BASE: "http://api-mi.metrc.com" })).toBe("sandbox");
    expect(metrcHostKind({ METRC_API_BASE: "https://example.com" })).toBe("other");
    expect(metrcHostKind({ METRC_API_BASE: "https://api-mi.metrc.com.example.com" })).toBe("other");
    expect(metrcHostKind({ METRC_API_BASE: "https://api-mi.metrc.com:8443" })).toBe("other");
    expect(metrcHostKind({ METRC_API_BASE: "https://sandbox-api-mich.metrc.com" })).toBe("other");
  });

  it("refuses a GET on a host that is not a Metrc host: no fetch, no record, no key", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse([]));
    const record = vi.fn(async (_row: CallRow) => undefined);
    await expect(
      metrcGet({ env: { ...FAKE, METRC_API_BASE: "https://example.com" }, path: "/facilities/v2", fetchImpl: fetchImpl as unknown as typeof fetch, record })
    ).rejects.toThrow(METRC_HOST_REFUSAL);
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(record).not.toHaveBeenCalled();
  });

  for (const method of ["POST", "PUT", "DELETE"] as const) {
    it(`refuses ${method} on a production host, and on a sandbox host unless METRC_EVAL_ENABLED is "true"`, async () => {
      const fetchImpl = vi.fn(async () => jsonResponse({}));
      const record = vi.fn(async (_row: CallRow) => undefined);
      const base = { method, path: "/packages/v2/testing", query: { licenseNumber: "AU-G-C-000832" }, body: [{ Tag: "X" }], record };
      const production = await metrcSend({ ...base, env: { ...FAKE, METRC_API_BASE: PRODUCTION, METRC_EVAL_ENABLED: "true" }, fetchImpl: fetchImpl as unknown as typeof fetch });
      expect(production).toEqual({ sent: false, refusal: SEND_ON_PRODUCTION });
      const absent = await metrcSend({ ...base, env: { ...FAKE, METRC_API_BASE: SANDBOX }, fetchImpl: fetchImpl as unknown as typeof fetch });
      expect(absent).toEqual({ sent: false, refusal: SEND_EVAL_OFF });
      const off = await metrcSend({ ...base, env: { ...FAKE, METRC_API_BASE: SANDBOX, METRC_EVAL_ENABLED: "false" }, fetchImpl: fetchImpl as unknown as typeof fetch });
      expect(off).toEqual({ sent: false, refusal: SEND_EVAL_OFF });
      const loose = await metrcSend({ ...base, env: { ...FAKE, METRC_API_BASE: SANDBOX, METRC_EVAL_ENABLED: "TRUE" }, fetchImpl: fetchImpl as unknown as typeof fetch });
      expect(loose.sent).toBe(false);
      const other = await metrcSend({ ...base, env: { ...FAKE, METRC_API_BASE: "https://example.com", METRC_EVAL_ENABLED: "true" }, fetchImpl: fetchImpl as unknown as typeof fetch });
      expect(other).toEqual({ sent: false, refusal: METRC_HOST_REFUSAL });
      expect(fetchImpl).not.toHaveBeenCalled();
      expect(record).not.toHaveBeenCalled();

      const sent = await metrcSend({ ...base, env: { ...FAKE, METRC_API_BASE: SANDBOX, METRC_EVAL_ENABLED: "true" }, fetchImpl: fetchImpl as unknown as typeof fetch });
      expect(sent).toEqual({ sent: true, status: 200, body: {} });
      expect(fetchImpl).toHaveBeenCalledTimes(1);
      const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
      expect(url.startsWith(`${SANDBOX}/packages/v2/testing?`)).toBe(true);
      expect(init.method).toBe(method);
      expect(init.body).toBe(JSON.stringify([{ Tag: "X" }]));
      expect(new Headers(init.headers).get("Authorization")).toBe(`Basic ${basicToken("fake-vendor-key", "fake-user-key")}`);
      expect(record).toHaveBeenCalledTimes(1);
      expect(METRC_WRITE_ENABLED).toBe(false);
      expect(testingPostRequest("AU-G-C-000832", [])).toBeNull();
    });
  }

  it("resolves the sweep mode: write only on a production host, never self-promoted", () => {
    const sandbox = { METRC_API_BASE: SANDBOX };
    const production = { METRC_API_BASE: PRODUCTION };
    const other = { METRC_API_BASE: "https://example.com" };
    expect(resolveSweepMode(sandbox, null)).toEqual({ mode: "off", refusal: null });
    expect(resolveSweepMode(sandbox, "  ")).toEqual({ mode: "off", refusal: null });
    expect(resolveSweepMode(production, "off")).toEqual({ mode: "off", refusal: null });
    expect(resolveSweepMode(production, "mirror")).toEqual({ mode: "off", refusal: SWEEP_MODE_UNKNOWN });
    expect(resolveSweepMode(sandbox, "dry_run")).toEqual({ mode: "dry_run", refusal: null });
    expect(resolveSweepMode(production, "DRY_RUN")).toEqual({ mode: "dry_run", refusal: null });
    expect(resolveSweepMode(production, "write")).toEqual({ mode: "write", refusal: null });
    expect(resolveSweepMode(sandbox, "write")).toEqual({ mode: "dry_run", refusal: SWEEP_WRITE_ON_SANDBOX });
    expect(resolveSweepMode(other, "write")).toEqual({ mode: "off", refusal: SWEEP_WRITE_ON_OTHER });
    expect(resolveSweepMode(other, "dry_run")).toEqual({ mode: "off", refusal: SWEEP_ON_OTHER });
  });
});

describe("MA1 Law 4: keys", () => {
  it("returns METRC_USER_KEY for every license, null when absent, and never reads METRC_USER_KEYS", () => {
    const touched: string[] = [];
    const env = new Proxy({ METRC_USER_KEY: "  fake-user-key  ", METRC_USER_KEYS: '{"AU-G-C-000832":"fake-other-key"}' } as Record<string, string>, {
      get(target, prop) {
        touched.push(String(prop));
        return target[String(prop)];
      },
    });
    for (const license of ["AU-G-C-000832", "AU-P-000694", "GR-C-001132", "NOT-IN-LOOKUP"]) {
      expect(userKeyFor(env, license)).toBe("fake-user-key");
    }
    expect(touched).not.toContain("METRC_USER_KEYS");
    expect(userKeyFor({}, "AU-G-C-000832")).toBeNull();
    expect(userKeyFor({ METRC_USER_KEY: "   " }, "AU-G-C-000832")).toBeNull();
  });

  it("sends the given user key in the Basic header", async () => {
    let auth: string | null = null;
    const fetchImpl = (async (_url: string, init?: RequestInit) => {
      auth = new Headers(init?.headers).get("Authorization");
      return jsonResponse([]);
    }) as typeof fetch;
    await metrcGet({ env: { ...FAKE, METRC_API_BASE: SANDBOX }, path: "/facilities/v2", userKey: "fake-license-key", fetchImpl });
    expect(auth).toBe(`Basic ${btoa("fake-vendor-key:fake-license-key")}`);
  });

  it("scrubs raw keys, the base64 token and the Basic token form", () => {
    const token = basicToken("fake-vendor-key", "fake-user-key");
    const text = `failed: Authorization: Basic ${token}; raw ${token}; vendor fake-vendor-key; user fake-user-key.`;
    const out = scrubKeys(text, ["fake-vendor-key", "fake-user-key", token]);
    expect(out).not.toContain(token);
    expect(out).not.toContain("fake-vendor-key");
    expect(out).not.toContain("fake-user-key");
    expect(out).not.toContain("Basic ");
    expect(out).toBe("failed: Authorization: [key]; raw [key]; vendor [key]; user [key].");
  });

  it("scrubs a thrown fetch error of every key and the token", async () => {
    const token = basicToken("fake-vendor-key", "fake-user-key");
    const fetchImpl = (async () => {
      throw new Error(`socket closed after Basic ${token} with fake-vendor-key and fake-user-key`);
    }) as typeof fetch;
    const err = (await metrcGet({ env: { ...FAKE, METRC_API_BASE: SANDBOX }, path: "/facilities/v2", fetchImpl }).catch((e) => e)) as Error;
    expect(err.message).not.toContain(token);
    expect(err.message).not.toContain("fake-vendor-key");
    expect(err.message).not.toContain("fake-user-key");
  });

  it("drops every key-bearing query parameter from the logged path, so a userKey never reaches metrc_api_calls", async () => {
    expect(callPath(`${SANDBOX}/sandbox/v2/integrator/setup?userKey=fake-user-key&licenseNumber=AU-P-000694`)).toBe(
      "/sandbox/v2/integrator/setup?licenseNumber=AU-P-000694"
    );
    expect(callPath(`${SANDBOX}/x?apiKey=a&KEYS=b&monkey=c&pageNumber=1`)).toBe("/x?pageNumber=1");
    expect(callPath(`${SANDBOX}/packages/v2/active?licenseNumber=AU-P-000694&pageNumber=1`)).toBe("/packages/v2/active?licenseNumber=AU-P-000694&pageNumber=1");
    const m = await migratedDb();
    let sentUrl = "";
    const fetchImpl = (async (url: string) => {
      sentUrl = String(url);
      return jsonResponse([]);
    }) as typeof fetch;
    await metrcGet({
      env: { ...FAKE, METRC_API_BASE: SANDBOX },
      path: "/facilities/v2",
      query: { userKey: "fake-user-key", licenseNumber: "AU-P-000694" },
      fetchImpl,
      record: (row) => recordMetrcCall(m.db, row),
    });
    expect(sentUrl).toContain("userKey=fake-user-key");
    const rows = m.all(`SELECT path FROM metrc_api_calls`);
    expect(rows).toHaveLength(1);
    expect(String(rows[0].path)).toBe("/facilities/v2?licenseNumber=AU-P-000694");
    expect(JSON.stringify(rows)).not.toContain("fake-user-key");
    expect(JSON.stringify(rows)).not.toContain("userKey");
  });
});

describe("MA1 A9: Retry-After", () => {
  it("waits one second for a blank, missing or dated header, the seconds for a number, capped at ten", () => {
    expect(retryAfterMs(null)).toBe(1000);
    expect(retryAfterMs("")).toBe(1000);
    expect(retryAfterMs("   ")).toBe(1000);
    expect(retryAfterMs("Wed, 21 Oct 2015 07:28:00 GMT")).toBe(1000);
    expect(retryAfterMs("soon")).toBe(1000);
    expect(retryAfterMs("-3")).toBe(1000);
    expect(retryAfterMs("3")).toBe(3000);
    expect(retryAfterMs("0.5")).toBe(500);
    expect(retryAfterMs("10")).toBe(10000);
    expect(retryAfterMs("999")).toBe(10000);
    expect(retryAfterAboveCap("10")).toBe(false);
    expect(retryAfterAboveCap("11")).toBe(true);
    expect(retryAfterAboveCap("")).toBe(false);
    expect(retryAfterAboveCap(null)).toBe(false);
    expect(retryAfterAboveCap("Wed, 21 Oct 2015 07:28:00 GMT")).toBe(false);
  });

  it("retries a 429 with a blank header after one second, not at once", async () => {
    const slept: number[] = [];
    let n = 0;
    const fetchImpl = (async () => {
      n += 1;
      return n === 1 ? new Response("", { status: 429, headers: { "Retry-After": "" } }) : jsonResponse([]);
    }) as typeof fetch;
    const res = await metrcGet({ env: { ...FAKE, METRC_API_BASE: SANDBOX }, path: "/facilities/v2", fetchImpl, sleep: async (ms) => void slept.push(ms) });
    expect(res.status).toBe(200);
    expect(res.attempts).toBe(2);
    expect(slept).toEqual([1000]);
  });

  it("keeps the lab sweep's wait on a header above the cap (capped, then one retry)", async () => {
    const slept: number[] = [];
    let n = 0;
    const fetchImpl = (async () => {
      n += 1;
      return n === 1 ? new Response("", { status: 429, headers: { "Retry-After": "60" } }) : jsonResponse([]);
    }) as typeof fetch;
    const res = await metrcGet({ env: { ...FAKE, METRC_API_BASE: SANDBOX }, path: "/facilities/v2", fetchImpl, sleep: async (ms) => void slept.push(ms) });
    expect(res.status).toBe(200);
    expect(slept).toEqual([10000]);
  });
});

const FACILITIES = [
  {
    FacilityId: 11,
    Name: "PNN AU",
    FacilityType: { CanGrowPlants: true, CanRecordProcessingJobs: false, CanTrackVegetativePlants: true },
    License: { Number: "AU-G-C-000832", EmployeeLicenseNumber: "EMP-SECRET-1", LicenseType: "Adult-Use Grower C" },
  },
  {
    FacilityId: 12,
    Name: "PNN Processor",
    FacilityType: { CanGrowPlants: false, CanRecordProcessingJobs: true, CanTrackVegetativePlants: false },
    License: { Number: "au-p-000694", EmployeeLicenseNumber: "EMP-SECRET-2", LicenseType: "Adult-Use Processor" },
  },
  {
    FacilityId: 13,
    Name: "Sandbox Grow",
    FacilityType: { CanGrowPlants: true },
    License: { Number: "SF-SBX-MI-1-0001", EmployeeLicenseNumber: "EMP-SECRET-3", LicenseType: "Sandbox" },
  },
];

describe("MA1 A22, A33: Test connection per license", () => {
  it("parses the facility keep-list and matches License.Number against the lookup", () => {
    const facts = parseFacilities(FACILITIES);
    expect(facts).toEqual([
      { license: "AU-G-C-000832", licenseType: "Adult-Use Grower C", canGrowPlants: 1, canRecordProcessingJobs: 0, canTrackVegetativePlants: 1 },
      { license: "au-p-000694", licenseType: "Adult-Use Processor", canGrowPlants: 0, canRecordProcessingJobs: 1, canTrackVegetativePlants: 0 },
      { license: "SF-SBX-MI-1-0001", licenseType: "Sandbox", canGrowPlants: 1, canRecordProcessingJobs: null, canTrackVegetativePlants: null },
    ]);
    const rows = facilityReach(["AU-G-C-000832", "AU-P-000694", "GR-C-001132"], facts, "sandbox-api-mi.metrc.com", "2026-10-08T12:00:00.000Z");
    expect(rows.map((row) => [row.license_value, row.in_lookup, row.reached])).toEqual([
      ["AU-G-C-000832", 1, 1],
      ["AU-P-000694", 1, 1],
      ["GR-C-001132", 1, 0],
      ["SF-SBX-MI-1-0001", 0, 1],
    ]);
    expect(JSON.stringify(rows)).not.toContain("EMP-SECRET");
  });

  it("writes reach rows for the current host and the page reads them per license", async () => {
    const m = await migratedDb();
    const urls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        urls.push(String(url));
        return jsonResponse(FACILITIES);
      })
    );
    const env = { DB: m.db, ...FAKE, METRC_API_BASE: SANDBOX };
    const before = metrcApiPage(await loadMetrcAdmin(env), "en", null, 0);
    expect(before).toContain('data-metrc-license="AU-G-C-000832" data-metrc-reach="unchecked"');
    expect(before).toContain("Not checked yet");

    const result = await testMetrcConnection(env);
    expect(result).toEqual({ code: "connected", n: 3, reached: 2, of: 7 });
    expect(urls).toEqual([`${SANDBOX}/facilities/v2`]);
    const rows = m.all(`SELECT * FROM metrc_facilities ORDER BY in_lookup DESC, license_value`);
    expect(rows).toHaveLength(8);
    expect(rows.every((row) => row.host === "sandbox-api-mi.metrc.com")).toBe(true);
    const byLicense = new Map(rows.map((row) => [String(row.license_value), row]));
    expect(byLicense.get("AU-G-C-000832")).toMatchObject({ in_lookup: 1, reached: 1, can_grow_plants: 1, can_record_processing_jobs: 0, can_track_vegetative_plants: 1, license_type: "Adult-Use Grower C" });
    expect(byLicense.get("AU-P-000694")).toMatchObject({ in_lookup: 1, reached: 1, can_record_processing_jobs: 1 });
    expect(byLicense.get("GR-C-002600")).toMatchObject({ in_lookup: 1, reached: 0, can_grow_plants: null });
    expect(byLicense.get("SF-SBX-MI-1-0001")).toMatchObject({ in_lookup: 0, reached: 1 });
    expect(JSON.stringify(rows)).not.toContain("EMP-SECRET");
    expect(m.all(`SELECT path FROM metrc_api_calls`).map((row) => row.path)).toEqual(["/facilities/v2"]);

    const html = metrcApiPage(await loadMetrcAdmin(env), "en", "connected", result.n);
    expect(html).toContain("Connected. 3 facilities. 2 of 7 licenses reached.");
    expect(html).toContain('data-metrc-license="AU-G-C-000832" data-metrc-reach="reached"');
    expect(html).toContain('data-metrc-license="GR-C-001132" data-metrc-reach="not_reached"');
    expect(html).toContain("GR-C-001132: Not reached by this key");
    expect(html).toContain("AU-P-000694: Reached by this key");
    expect(html).toContain('data-metrc-other-facilities="1"');
    expect(html).toContain("Other facilities this key reaches: 1");
    expect(html).toContain("Admin\\Data Lookups\\Logistics\\Licenses");
    expect(html).not.toContain("fake-vendor-key");
    expect(html).not.toContain("fake-user-key");
    expect(html).not.toContain("SF-SBX-MI-1-0001");

    const es = metrcApiPage(await loadMetrcAdmin(env), "es", "connected", result.n);
    expect(es).toContain("Conectado. 3 instalaciones. 2 de 7 licencias alcanzadas.");
    expect(es).toContain("Alcanzada por esta clave");
    expect(es).toContain("No alcanzada por esta clave");

    // A second check where the key reaches less: the earlier reach is not kept.
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse([FACILITIES[0]])));
    const again = await testMetrcConnection(env);
    expect(again).toEqual({ code: "connected", n: 1, reached: 1, of: 7 });
    const after = await loadMetrcAdmin(env);
    expect(after.licenses?.find((row) => row.license === "AU-P-000694")?.reach).toBe("not_reached");
    expect(after.otherFacilities).toBe(0);
  });

  it("makes no call and says so plainly on a host that is not a Metrc host", async () => {
    const m = await migratedDb();
    const fetchSpy = vi.fn(async () => jsonResponse(FACILITIES));
    vi.stubGlobal("fetch", fetchSpy);
    const env = { DB: m.db, ...FAKE, METRC_API_BASE: "https://example.com" };
    expect(await testMetrcConnection(env)).toEqual({ code: "host", n: 0, reached: 0, of: 0 });
    expect(fetchSpy).not.toHaveBeenCalled();
    const html = metrcApiPage(await loadMetrcAdmin(env), "en", "host", 0);
    expect(html).toContain('data-metrc-flash="host"');
    expect(html).toContain(METRC_HOST_REFUSAL);
    expect(m.all(`SELECT * FROM metrc_api_calls`)).toHaveLength(0);
  });
});

describe("MA1 A7: the lab sweep on a sandbox host", () => {
  const TAG = "1A4F00000000000000000A01";
  const ORDER_TAG = "1A4F00000000000000000B01";

  async function sweepOn(base: string) {
    const m = await migratedDb();
    m.run(
      `INSERT INTO test_samples (id, order_id, sample_tag, net_grams, sampled_at, attempt, created_at, updated_at)
       VALUES ('s1', 'o1', ?, 14, '2026-10-08T12:00:00.000Z', 1, '2026-10-08T12:00:00.000Z', '2026-10-08T12:00:00.000Z')`,
      TAG
    );
    // A desk order whose source package Metrc reports: A7 covers test_orders too.
    m.run(
      `INSERT INTO test_orders (id, source_package_tag, market, lab_id, panel, required_lab_test_batch, batch_grams, sample_grams, status, created_at, updated_at)
       VALUES ('o2', ?, 'AU', 'lab', 'full', 'Raw Plant Material', 1000, 14, 'ordered', '2026-10-08T12:00:00.000Z', '2026-10-08T12:00:00.000Z')`,
      ORDER_TAG
    );
    const fetchSpy = vi.fn(async (url: string) => {
      const path = new URL(String(url)).pathname;
      if (path === "/packages/v2/labsamples") {
        return jsonResponse({ Data: [{ Id: 9, Label: TAG, LabTestingState: "TestPassed", LabTestingStateDate: "2026-10-08" }], TotalPages: 1 });
      }
      if (path === "/packages/v2/active") {
        return jsonResponse({ Data: [{ Id: 8, Label: ORDER_TAG, LabTestingState: "SubmittedForTesting", LabTestingStateDate: "2026-10-07" }], TotalPages: 1 });
      }
      if (path === "/labtests/v2/results") {
        return jsonResponse({ Data: [{ LabTestResultId: 44, OverallPassed: true, TestTypeName: "THC Total", TestResultLevel: 21.5 }], TotalPages: 1 });
      }
      return jsonResponse({ Data: [], TotalPages: 1 });
    });
    vi.stubGlobal("fetch", fetchSpy);
    await runMetrcSweep({ DB: m.db, ...FAKE, METRC_API_BASE: base }, "cron");
    return { m, fetchSpy };
  }

  it("reads as before and writes nothing to the desk, and says so", async () => {
    const { m, fetchSpy } = await sweepOn(SANDBOX);
    expect(fetchSpy).toHaveBeenCalled();
    const sample = m.get(`SELECT metrc_lab_testing_state, metrc_result_id, thc_total_pct, overall_passed FROM test_samples WHERE id = 's1'`);
    expect(sample).toEqual({ metrc_lab_testing_state: null, metrc_result_id: null, thc_total_pct: null, overall_passed: null });
    expect(m.get(`SELECT metrc_lab_testing_state, metrc_state_date FROM test_orders WHERE id = 'o2'`)).toEqual({ metrc_lab_testing_state: null, metrc_state_date: null });
    const sweep = m.get(`SELECT status, message, packages_seen, fields_written FROM metrc_sweeps`);
    expect(sweep?.status).toBe("ok");
    expect(String(sweep?.message)).toContain(SANDBOX_DESK_NOTE);
    expect(sweep?.packages_seen).toBe(2);
    expect(sweep?.fields_written).toBe(0);
    expect(m.all(`SELECT * FROM record_change_log WHERE record_table IN ('test_samples', 'test_orders')`)).toHaveLength(0);
  });

  it("still fills the desk on a production host (the guard is the sandbox's alone)", async () => {
    const { m } = await sweepOn(PRODUCTION);
    const sample = m.get(`SELECT metrc_lab_testing_state, metrc_result_id FROM test_samples WHERE id = 's1'`);
    expect(sample).toEqual({ metrc_lab_testing_state: "TestPassed", metrc_result_id: "44" });
    expect(m.get(`SELECT metrc_lab_testing_state, metrc_state_date FROM test_orders WHERE id = 'o2'`)).toEqual({
      metrc_lab_testing_state: "SubmittedForTesting",
      metrc_state_date: "2026-10-07",
    });
    const sweep = m.get(`SELECT message, fields_written FROM metrc_sweeps`);
    expect(String(sweep?.message)).not.toContain(SANDBOX_DESK_NOTE);
    expect(Number(sweep?.fields_written)).toBeGreaterThan(0);
  });

  it("records a failed sweep and makes no call on a host that is not a Metrc host", async () => {
    const m = await migratedDb();
    const fetchSpy = vi.fn(async () => jsonResponse([]));
    vi.stubGlobal("fetch", fetchSpy);
    await runMetrcSweep({ DB: m.db, ...FAKE, METRC_API_BASE: "https://example.com" }, "cron");
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(m.get(`SELECT status, message FROM metrc_sweeps`)).toEqual({ status: "failed", message: METRC_HOST_REFUSAL });
    expect(m.all(`SELECT * FROM metrc_api_calls`)).toHaveLength(0);
  });

  it("records zero counts for a sweep refused on a host that is not a Metrc host", async () => {
    const m = await migratedDb();
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse([])));
    await runMetrcSweep({ DB: m.db, ...FAKE, METRC_API_BASE: "https://example.com" }, "cron");
    expect(m.get(`SELECT status, message, packages_seen, results_read, fields_written FROM metrc_sweeps`)).toEqual({
      status: "failed",
      message: METRC_HOST_REFUSAL,
      packages_seen: 0,
      results_read: 0,
      fields_written: 0,
    });
  });
});

describe("MA1 Phase B fixes: the request stays on the METRC origin (Law 3, A8)", () => {
  const ESCAPES = ["//evil.example/x", "https://evil.example/x", "\\\\evil.example\\x", "/\\evil.example/x", "https:\\\\evil.example/x", "https://api-mi.metrc.com/packages/v2/active"];

  it("refuses a GET whose path leaves the METRC origin: no fetch, no record, no key", async () => {
    for (const path of ESCAPES) {
      const fetchImpl = vi.fn(async () => jsonResponse([]));
      const record = vi.fn(async (_row: CallRow) => undefined);
      await expect(
        metrcGet({ env: { ...FAKE, METRC_API_BASE: SANDBOX }, path, fetchImpl: fetchImpl as unknown as typeof fetch, record })
      ).rejects.toThrow(METRC_HOST_REFUSAL);
      expect(fetchImpl).not.toHaveBeenCalled();
      expect(record).not.toHaveBeenCalled();
    }
    expect(metrcUrl({ METRC_API_BASE: SANDBOX }, "/packages/v2/active", { licenseNumber: "AU-P-000694" }).toString()).toBe(
      `${SANDBOX}/packages/v2/active?licenseNumber=AU-P-000694`
    );
  });

  it("never sends a write to a path that leaves the sandbox origin, production included", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({}));
    const env = { ...FAKE, METRC_API_BASE: SANDBOX, METRC_EVAL_ENABLED: "true" };
    const tries = [
      ["POST", "https://api-mi.metrc.com/packages/v2/testing"],
      ["DELETE", "//evil.example/packages/v2/x"],
      ["PUT", "\\\\evil.example\\x"],
    ] as const;
    for (const [method, path] of tries) {
      expect(await metrcSend({ env, method, path, body: [{ Tag: "X" }], fetchImpl: fetchImpl as unknown as typeof fetch })).toEqual({
        sent: false,
        refusal: METRC_HOST_REFUSAL,
      });
    }
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe("MA1 Phase B fixes: a key the Basic header cannot carry", () => {
  const ODD = { METRC_INTEGRATOR_KEY: "fake-vendor-key", METRC_USER_KEY: "fake-user-key​" };

  it("is refused plainly before any fetch or record", async () => {
    expect(basicToken("fake-vendor-key", "fake-user-key​")).toBe("");
    const fetchImpl = vi.fn(async () => jsonResponse([]));
    const record = vi.fn(async (_row: CallRow) => undefined);
    await expect(
      metrcGet({ env: { ...ODD, METRC_API_BASE: SANDBOX }, path: "/facilities/v2", fetchImpl: fetchImpl as unknown as typeof fetch, record })
    ).rejects.toThrow(KEY_CHARACTER_REFUSAL);
    const send = await metrcSend({
      env: { ...ODD, METRC_API_BASE: SANDBOX, METRC_EVAL_ENABLED: "true" },
      method: "POST",
      path: "/packages/v2/testing",
      fetchImpl: fetchImpl as unknown as typeof fetch,
      record,
    });
    expect(send).toEqual({ sent: false, refusal: KEY_CHARACTER_REFUSAL });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(record).not.toHaveBeenCalled();
  });

  it("records a failed lab sweep, so the cron carries on to the next job", async () => {
    const m = await migratedDb();
    const fetchSpy = vi.fn(async () => jsonResponse({ Data: [], TotalPages: 1 }));
    vi.stubGlobal("fetch", fetchSpy);
    const env = { DB: m.db, ...ODD, METRC_API_BASE: SANDBOX };
    await expect(runMetrcSweep(env, "cron")).resolves.toBeUndefined();
    expect(m.get(`SELECT status, message FROM metrc_sweeps`)).toEqual({ status: "failed", message: KEY_CHARACTER_REFUSAL });
    expect(await testMetrcConnection(env)).toEqual({ code: "failed", n: 0, reached: 0, of: 0 });
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(m.all(`SELECT * FROM metrc_api_calls`)).toHaveLength(0);
  });
});

describe("MA1 Phase B fixes: redirects are not followed", () => {
  it("passes redirect manual on both doors", async () => {
    const modes: Array<string | undefined> = [];
    const fetchImpl = (async (_url: string, init?: RequestInit) => {
      modes.push(init?.redirect);
      return jsonResponse({});
    }) as typeof fetch;
    await metrcGet({ env: { ...FAKE, METRC_API_BASE: SANDBOX }, path: "/facilities/v2", fetchImpl });
    await metrcSend({ env: { ...FAKE, METRC_API_BASE: SANDBOX, METRC_EVAL_ENABLED: "true" }, method: "POST", path: "/packages/v2/testing", fetchImpl });
    expect(modes).toEqual(["manual", "manual"]);
  });

  it("reads a 3xx as a failure in the lab sweep and in Test connection", async () => {
    const m = await migratedDb();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ Data: [], TotalPages: 1 }), { status: 302, headers: { Location: "https://evil.example/" } }))
    );
    const env = { DB: m.db, ...FAKE, METRC_API_BASE: SANDBOX };
    await runMetrcSweep(env, "cron");
    expect(m.get(`SELECT status, message FROM metrc_sweeps`)).toEqual({ status: "failed", message: "Metrc answered 302." });
    expect(await testMetrcConnection(env)).toEqual({ code: "failed", n: 0, reached: 0, of: 0 });
    expect(m.all(`SELECT * FROM metrc_facilities`)).toHaveLength(0);
  });
});

describe("MA1 Phase B fixes: the page", () => {
  it("keeps a license reached when an older row of it in another letter case reads not reached", async () => {
    const m = await migratedDb();
    const env = { DB: m.db, ...FAKE, METRC_API_BASE: SANDBOX };
    // The first check runs while the lookup row is deleted; the key names the license in lower case.
    m.run(`UPDATE lookup_values SET deleted_at = '2026-10-01T00:00:00.000Z' WHERE category = 'license' AND value = 'AU-G-C-000832'`);
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse([{ License: { Number: "au-g-c-000832" }, FacilityType: {} }])));
    expect(await testMetrcConnection(env)).toMatchObject({ code: "connected", reached: 0, of: 6 });
    // The lookup row comes back and the key still reaches the license.
    m.run(`UPDATE lookup_values SET deleted_at = NULL WHERE category = 'license' AND value = 'AU-G-C-000832'`);
    expect(await testMetrcConnection(env)).toMatchObject({ code: "connected", reached: 1, of: 7 });
    expect(m.all(`SELECT license_value, reached FROM metrc_facilities WHERE upper(license_value) = 'AU-G-C-000832' ORDER BY license_value`)).toEqual([
      { license_value: "AU-G-C-000832", reached: 1 },
      { license_value: "au-g-c-000832", reached: 0 },
    ]);
    const admin = await loadMetrcAdmin(env);
    expect(admin.licenses?.find((row) => row.license === "AU-G-C-000832")?.reach).toBe("reached");
    expect(admin.otherFacilities).toBe(0);
  });

  it("shows a stored sweep message in the page's language, sentence by sentence", async () => {
    const m = await migratedDb();
    m.run(
      `INSERT INTO metrc_sweeps (id, started_at, finished_at, status, trigger, message, packages_seen, results_read, fields_written)
       VALUES ('w1', '2026-10-08T12:00:00.000Z', '2026-10-08T12:00:05.000Z', 'ok', 'cron', ?, 1, 0, 0)`,
      `Metrc answered 503. ${SANDBOX_DESK_NOTE}`
    );
    const env = { DB: m.db, ...FAKE, METRC_API_BASE: SANDBOX };
    // Phase D fix pass: the counted sentence reads through its template too.
    expect(metrcApiPage(await loadMetrcAdmin(env), "es", null, 0)).toContain("Metrc respondio 503. Host de sandbox: no se escribio nada en el escritorio.");
    expect(metrcApiPage(await loadMetrcAdmin(env), "es", null, 0)).not.toContain("Metrc answered 503.");
    expect(metrcApiPage(await loadMetrcAdmin(env), "en", null, 0)).toContain(`Metrc answered 503. ${SANDBOX_DESK_NOTE}`);
    expect(storedWords("es", `${KEY_CHARACTER_REFUSAL} ${METRC_HOST_REFUSAL}`)).toBe(
      "Una clave de METRC tiene un caracter que un encabezado Basic no puede llevar. El host de METRC no es un host de Metrc."
    );
    expect(storedWords("en", `${KEY_CHARACTER_REFUSAL} ${METRC_HOST_REFUSAL}`)).toBe(`${KEY_CHARACTER_REFUSAL} ${METRC_HOST_REFUSAL}`);
  });

  it("gives every reach list item its title help", async () => {
    const m = await migratedDb();
    const html = metrcApiPage(await loadMetrcAdmin({ DB: m.db, ...FAKE, METRC_API_BASE: SANDBOX }), "en", null, 0);
    const items = html.match(/<li data-metrc-license[^>]*>/g) ?? [];
    expect(items).toHaveLength(7);
    for (const item of items) expect(item).toContain('title="');
  });

  it("neither shows nor clears another host's reach", async () => {
    const m = await migratedDb();
    m.run(
      `INSERT INTO metrc_facilities (host, license_value, in_lookup, reached, checked_at) VALUES
       ('api-mi.metrc.com', 'AU-G-C-000832', 1, 1, '2026-10-01T00:00:00.000Z'),
       ('api-mi.metrc.com', 'PROD-ONLY-1', 0, 1, '2026-10-01T00:00:00.000Z')`
    );
    const env = { DB: m.db, ...FAKE, METRC_API_BASE: SANDBOX };
    const admin = await loadMetrcAdmin(env);
    expect(admin.licenses?.find((row) => row.license === "AU-G-C-000832")?.reach).toBe("unchecked");
    expect(admin.otherFacilities).toBe(0);
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse([])));
    expect(await testMetrcConnection(env)).toMatchObject({ code: "connected", n: 0, reached: 0 });
    expect(m.all(`SELECT license_value, reached FROM metrc_facilities WHERE host = 'api-mi.metrc.com' ORDER BY license_value`)).toEqual([
      { license_value: "AU-G-C-000832", reached: 1 },
      { license_value: "PROD-ONLY-1", reached: 1 },
    ]);
  });

  it("writes every facility past the tenth (the upsert chunks by ten)", async () => {
    const m = await migratedDb();
    const many = Array.from({ length: 12 }, (_, i) => ({ License: { Number: `SF-SBX-MI-1-${String(i).padStart(4, "0")}`, LicenseType: "Sandbox" }, FacilityType: {} }));
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(many)));
    const env = { DB: m.db, ...FAKE, METRC_API_BASE: SANDBOX };
    expect(await testMetrcConnection(env)).toEqual({ code: "connected", n: 12, reached: 0, of: 7 });
    expect(m.all(`SELECT * FROM metrc_facilities`)).toHaveLength(19);
    expect((await loadMetrcAdmin(env)).otherFacilities).toBe(12);
  });
});

describe("MA1 Phase B fixes: keys, hosts, the write door and config", () => {
  it("reads METRC_USER_KEYS nowhere in src, and the lab sweep sends METRC_USER_KEY for every license", async () => {
    const fs = (await import("node:" + "fs")) as { readdirSync(path: URL): string[]; readFileSync(path: URL, encoding: "utf8"): string };
    const dir = new URL("../src/", import.meta.url);
    for (const name of fs.readdirSync(dir).filter((n) => n.endsWith(".ts"))) {
      expect(fs.readFileSync(new URL(name, dir), "utf8").includes("METRC_USER_KEYS"), name).toBe(false);
    }
    const m = await migratedDb();
    const auths = new Set<string>();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) => {
        auths.add(String(new Headers(init?.headers).get("Authorization")));
        return jsonResponse({ Data: [], TotalPages: 1 });
      })
    );
    await runMetrcSweep({ DB: m.db, ...FAKE, METRC_API_BASE: SANDBOX, METRC_USER_KEYS: '{"AU-G-C-000832":"fake-other-key"}' } as never, "cron");
    expect([...auths]).toEqual([`Basic ${btoa("fake-vendor-key:fake-user-key")}`]);
  });

  it("names look-alike hosts other hosts", () => {
    expect(metrcHostKind({ METRC_API_BASE: "https://api-mich.metrc.com" })).toBe("other");
    expect(metrcHostKind({ METRC_API_BASE: "https://api-mi-metrc.com" })).toBe("other");
    expect(metrcHostKind({ METRC_API_BASE: "https://sandbox-api-mi-metrc.com" })).toBe("other");
  });

  it("never repeats a write, a 429 included", async () => {
    const fetchImpl = vi.fn(async () => new Response("", { status: 429, headers: { "Retry-After": "1" } }));
    const record = vi.fn(async (_row: CallRow) => undefined);
    const r = await metrcSend({
      env: { ...FAKE, METRC_API_BASE: SANDBOX, METRC_EVAL_ENABLED: "true" },
      method: "POST",
      path: "/packages/v2/testing",
      body: [],
      fetchImpl: fetchImpl as unknown as typeof fetch,
      record,
    });
    expect(r).toEqual({ sent: true, status: 429, body: null });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(record).toHaveBeenCalledTimes(1);
  });

  it("refuses absent keys and a method outside the write door, with no fetch", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({}));
    const absent = await metrcSend({
      env: { METRC_INTEGRATOR_KEY: "fake-vendor-key", METRC_API_BASE: SANDBOX, METRC_EVAL_ENABLED: "true" },
      method: "POST",
      path: "/packages/v2/testing",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(absent).toEqual({ sent: false, refusal: "The user key is absent." });
    const get = await metrcSend({
      env: { ...FAKE, METRC_API_BASE: SANDBOX, METRC_EVAL_ENABLED: "true" },
      method: "GET" as unknown as "POST",
      path: "/packages/v2/active",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(get).toEqual({ sent: false, refusal: SEND_METHOD_REFUSED });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("falls back to the seed for a deleted config row even when its value differs", async () => {
    const m = await migratedDb();
    m.run(`UPDATE app_config SET value = '99', deleted_at = '2026-10-08T00:00:00.000Z' WHERE key = 'metrc_full_plants_hours'`);
    expect((await loadMetrcSweepConfig(m.db)).fullPlantsHours).toBe(METRC_SWEEP_DEFAULTS.fullPlantsHours);
  });
});

describe("MA1 Phase D, A32: the smoke's stub seam", () => {
  const STUB = { METRC_STUB_BASE: "http://127.0.0.1:4567", METRC_STUB_ENABLED: "1" };

  it("honours a local http origin only with the enabling var, and reads it as a sandbox host", async () => {
    expect(metrcStubBase(STUB)).toBe("http://127.0.0.1:4567");
    expect(metrcStubBase({ METRC_STUB_BASE: "http://localhost:8080/some/path?x=1", METRC_STUB_ENABLED: "1" })).toBe("http://localhost:8080");
    expect(metrcBase({ ...STUB, METRC_API_BASE: PRODUCTION })).toBe("http://127.0.0.1:4567");
    expect(metrcHost({ ...STUB, METRC_API_BASE: PRODUCTION })).toBe("127.0.0.1:4567");
    expect(metrcHostKind({ ...STUB, METRC_API_BASE: PRODUCTION })).toBe("sandbox");
    expect(metrcHostKind({ ...STUB, METRC_API_BASE: "https://example.com" })).toBe("sandbox");
    // The mode law treats the stub as a sandbox: write is impossible against it.
    expect(resolveSweepMode({ ...STUB, METRC_API_BASE: PRODUCTION }, "write")).toEqual({ mode: "dry_run", refusal: SWEEP_WRITE_ON_SANDBOX });
    expect(resolveSweepMode(STUB, "dry_run")).toEqual({ mode: "dry_run", refusal: null });
    expect(metrcUrl(STUB, "/facilities/v2").toString()).toBe("http://127.0.0.1:4567/facilities/v2");
    expect(() => metrcUrl(STUB, "https://sandbox-api-mi.metrc.com/facilities/v2")).toThrow(METRC_HOST_REFUSAL);
    let sent = "";
    const fetchImpl = (async (url: string) => {
      sent = String(url);
      return jsonResponse([]);
    }) as typeof fetch;
    await metrcGet({ env: { ...FAKE, ...STUB, METRC_API_BASE: PRODUCTION }, path: "/facilities/v2", fetchImpl });
    expect(sent).toBe("http://127.0.0.1:4567/facilities/v2");
    // The two host regexes are unchanged: the stub is not a production host anywhere.
    expect(PRODUCTION_BASE_RE.test("http://127.0.0.1:4567")).toBe(false);
    expect(SANDBOX_BASE_RE.test("http://127.0.0.1:4567")).toBe(false);
    // Law 3: the stub is a sandbox for the page and the mode law only; the write door never opens to it.
    expect(sendRefusal({ ...STUB, METRC_API_BASE: SANDBOX, METRC_EVAL_ENABLED: "true" })).toBe(METRC_HOST_REFUSAL);
    expect(sendRefusal({ ...STUB, METRC_API_BASE: PRODUCTION, METRC_EVAL_ENABLED: "true" })).toBe(METRC_HOST_REFUSAL);
    expect(sendRefusal({ METRC_API_BASE: SANDBOX, METRC_EVAL_ENABLED: "true" })).toBeNull();
    const postSpy = vi.fn(async () => jsonResponse({}));
    const stubbed = await metrcSend({
      env: { ...FAKE, ...STUB, METRC_API_BASE: SANDBOX, METRC_EVAL_ENABLED: "true" },
      method: "POST",
      path: "/packages/v2/testing",
      body: {},
      fetchImpl: postSpy as unknown as typeof fetch,
    });
    expect(stubbed).toEqual({ sent: false, refusal: METRC_HOST_REFUSAL });
    expect(postSpy).not.toHaveBeenCalled();
  });

  it("is refused on any other origin, and without the enabling var, so the real base applies", () => {
    const refused = [
      { METRC_STUB_BASE: "http://127.0.0.1:4567" },
      { METRC_STUB_BASE: "http://127.0.0.1:4567", METRC_STUB_ENABLED: "true" },
      { METRC_STUB_BASE: "http://127.0.0.1:4567", METRC_STUB_ENABLED: "0" },
      { METRC_STUB_BASE: "http://127.0.0.1:4567", METRC_STUB_ENABLED: " 1" },
      { METRC_STUB_BASE: "https://127.0.0.1:4567", METRC_STUB_ENABLED: "1" },
      { METRC_STUB_BASE: "http://127.0.0.1", METRC_STUB_ENABLED: "1" },
      { METRC_STUB_BASE: "http://localhost", METRC_STUB_ENABLED: "1" },
      { METRC_STUB_BASE: "http://example.com:4567", METRC_STUB_ENABLED: "1" },
      { METRC_STUB_BASE: "http://127.0.0.1.example.com:4567", METRC_STUB_ENABLED: "1" },
      { METRC_STUB_BASE: "http://[::1]:4567", METRC_STUB_ENABLED: "1" },
      { METRC_STUB_BASE: "http://10.0.0.5:4567", METRC_STUB_ENABLED: "1" },
      { METRC_STUB_BASE: "https://sandbox-api-mi.metrc.com", METRC_STUB_ENABLED: "1" },
      { METRC_STUB_BASE: "not a url", METRC_STUB_ENABLED: "1" },
      { METRC_STUB_BASE: "", METRC_STUB_ENABLED: "1" },
      { METRC_STUB_ENABLED: "1" },
    ];
    for (const env of refused) {
      expect(metrcStubBase(env), JSON.stringify(env)).toBeNull();
      expect(metrcBase({ ...env, METRC_API_BASE: PRODUCTION }), JSON.stringify(env)).toBe(PRODUCTION);
      expect(metrcHostKind({ ...env, METRC_API_BASE: PRODUCTION }), JSON.stringify(env)).toBe("production");
      expect(metrcHostKind({ ...env, METRC_API_BASE: "https://example.com" }), JSON.stringify(env)).toBe("other");
      expect(metrcBase(env), JSON.stringify(env)).toBe(SANDBOX);
    }
  });

  it("is never set in wrangler.toml, on any env", async () => {
    const fs = (await import("node:" + "fs")) as { readFileSync(path: URL, encoding: "utf8"): string };
    const toml = fs.readFileSync(new URL("../wrangler.toml", import.meta.url), "utf8");
    expect(toml).not.toContain("METRC_STUB_BASE");
    expect(toml).not.toContain("METRC_STUB_ENABLED");
    expect(toml).not.toContain("METRC_EVAL_ENABLED");
  });
});

describe("MA1 Phase C fix pass: the lab sweep's host (A18)", () => {
  it("records every call of the lab sweep with the host it called, so the month pace counts it", async () => {
    const m = await migratedDb();
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ Data: [], TotalPages: 1 })));
    await runMetrcSweep({ DB: m.db, ...FAKE, METRC_API_BASE: PRODUCTION }, "cron");
    const hosts = m.all(`SELECT host, COUNT(*) AS n FROM metrc_api_calls GROUP BY host`);
    expect(hosts).toHaveLength(1);
    expect(hosts[0]).toMatchObject({ host: "api-mi.metrc.com" });
    expect(Number(hosts[0].n)).toBeGreaterThan(0);
  });
});
