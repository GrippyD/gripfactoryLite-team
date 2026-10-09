import { describe, expect, it } from "vitest";
import { parseCsv } from "../src/csv";
import { DICT } from "../src/i18n";
import {
  EVAL_BODY_CAP,
  EVAL_BODY_CUT,
  EVAL_BUDGET_STATUS,
  EVAL_E2_STATUS,
  EVAL_PAGE_STRINGS,
  EVAL_PROBES,
  EVAL_SANDBOX_ONLY,
  EVAL_STEPS_JSON_CAP,
  EVAL_TABS,
  capPack,
  dropNeverStoredKeys,
  evalCsvFile,
  evalJsonFile,
  evalPageActive,
  evalWindow,
  facilityRole,
  loadMetrcEvalAdmin,
  metrcEvalPage,
  packFileNames,
  packOf,
  runEval,
  scrubLong,
  type EvalPack,
  type StepRecord,
} from "../src/metrceval";
import { migratedDb, type MigratedDb } from "./migrated";

const SANDBOX = "https://sandbox-api-mi.metrc.com";
const PRODUCTION = "https://api-mi.metrc.com";
const FAKE = { METRC_INTEGRATOR_KEY: "fake-vendor-key", METRC_USER_KEY: "fake-user-key" };
const TOKEN = btoa("fake-vendor-key:fake-user-key");
const NOW = "2026-10-08T10:00:00.000Z";
const GROW = "403-X0001";
const PROCESSOR = "402-X0002";
const EMPLOYEE_SECRET = "EMP-SECRET-777";
const ISO_SECONDS = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;

type Fs = { readFileSync(path: URL, encoding: "utf8"): string; readdirSync(path: URL): string[] };

async function fsMod(): Promise<Fs> {
  return (await import("node:" + "fs")) as Fs;
}

const fixtureCache = new Map<string, unknown>();

/** A docs example response, copied from metrcdocs/endpoints/GET_*.txt. */
async function fixture(name: string): Promise<unknown> {
  if (!fixtureCache.has(name)) {
    const fs = await fsMod();
    fixtureCache.set(name, JSON.parse(fs.readFileSync(new URL(`./fixtures/metrc/${name}.json`, import.meta.url), "utf8")));
  }
  return JSON.parse(JSON.stringify(fixtureCache.get(name)));
}

/** The docs' two facilities with the flags the test needs: the first grows,
 * the second records processing jobs. The person field is given a value the
 * pack must never carry. */
async function facilitiesBody(): Promise<unknown[]> {
  const list = (await fixture("GET_facilities_v2")) as Array<{ FacilityType: Record<string, unknown>; License: Record<string, unknown> }>;
  list[0].FacilityType.CanGrowPlants = true;
  list[0].FacilityType.CanTrackVegetativePlants = true;
  list[0].FacilityType.CanTransferFromExternalFacilities = false;
  list[0].License.EmployeeLicenseNumber = EMPLOYEE_SECRET;
  list[1].FacilityType.CanRecordProcessingJobs = true;
  list[1].License.EmployeeLicenseNumber = EMPLOYEE_SECRET;
  return list;
}

type Call = { path: string; query: URLSearchParams; auth: string | null };

type SandboxOptions = {
  /** Paths that answer 200 with an empty Data array. */
  empty?: string[];
  /** Paths that answer the given status with a small JSON error body. */
  status?: Record<string, number>;
  /** Paths whose fetch throws (a network failure). */
  throwOn?: string[];
  /** Incoming and outgoing answer 400 to any window wider than one day. */
  narrowWindows?: boolean;
  /** The P0 facilities body. */
  facilities?: unknown;
  /** Rows that echo the Authorization header and the keys into bodies. */
  echoSecrets?: boolean;
};

const LIST_FIXTURES: Record<string, string> = {
  "/locations/v2/types": "GET_locations_v2_types",
  "/locations/v2/active": "GET_locations_v2_active",
  "/strains/v2/active": "GET_strains_v2_active",
  "/items/v2/active": "GET_items_v2_active",
  "/items/v2/categories": "GET_items_v2_categories",
  "/unitsofmeasure/v2/active": "GET_unitsofmeasure_v2_active",
  "/plantbatches/v2/active": "GET_plantbatches_v2_active",
  "/plants/v2/vegetative": "GET_plants_v2_vegetative",
  "/plants/v2/flowering": "GET_plants_v2_flowering",
  "/plants/v2/mother": "GET_plants_v2_mother",
  "/harvests/v2/active": "GET_harvests_v2_active",
  "/packages/v2/active": "GET_packages_v2_active",
  "/plants/v2/waste/reasons": "GET_plants_v2_waste_reasons",
  "/wastemethods/v2/": "GET_wastemethods_v2",
  "/plants/v2/waste/methods/all": "GET_plants_v2_waste_methods_all",
  "/harvests/v2/waste/types": "GET_harvests_v2_waste_types",
  "/packages/v2/adjust/reasons": "GET_packages_v2_adjust_reasons",
  "/transfers/v2/types": "GET_transfers_v2_types",
  "/transfers/v2/templates/outgoing": "GET_transfers_v2_templates_outgoing",
  "/sandbox/v2/tagtypes": "GET_sandbox_v2_tagtypes",
  "/transfers/v2/incoming": "GET_transfers_v2_incoming",
  "/transfers/v2/outgoing": "GET_transfers_v2_outgoing",
  "/transfers/v2/rejected": "GET_transfers_v2_rejected",
};

const BY_ID: Array<{ re: RegExp; name: string }> = [
  { re: /^\/locations\/v2\/\d+$/, name: "GET_locations_v2_id" },
  { re: /^\/strains\/v2\/\d+$/, name: "GET_strains_v2_id" },
  { re: /^\/items\/v2\/\d+$/, name: "GET_items_v2_id" },
  { re: /^\/transfers\/v2\/\d+\/deliveries$/, name: "GET_transfers_v2_id_deliveries" },
  { re: /^\/transfers\/v2\/deliveries\/\d+\/packages$/, name: "GET_transfers_v2_deliveries_id_packages" },
  { re: /^\/transfers\/v2\/deliveries\/\d+\/packages\/wholesale$/, name: "GET_transfers_v2_deliveries_id_packages_wholesale" },
  { re: /^\/transfers\/v2\/templates\/outgoing\/\d+\/deliveries$/, name: "GET_transfers_v2_templates_outgoing_id_deliveries" },
];

function emptyLike(body: unknown): unknown {
  if (Array.isArray(body)) return [];
  if (body && typeof body === "object" && "Data" in (body as object)) return { ...(body as object), Data: [], Total: 0, TotalRecords: 0, RecordsOnPage: 0, TotalPages: 0 };
  return body;
}

/** A fake sandbox that answers by path from the docs examples. */
function fakeSandbox(options: SandboxOptions = {}) {
  const calls: Call[] = [];
  const fetchImpl = (async (input: string, init?: RequestInit) => {
    const url = new URL(String(input));
    const auth = new Headers(init?.headers).get("Authorization");
    calls.push({ path: url.pathname, query: url.searchParams, auth });
    expect(init?.method ?? "GET").toBe("GET");
    expect(auth).toBe(`Basic ${TOKEN}`);
    const path = url.pathname;
    if (options.throwOn?.includes(path)) throw new TypeError(`fetch failed for ${path} with Authorization Basic ${TOKEN} fake-user-key`);
    const forced = options.status?.[path];
    if (forced != null) return new Response(JSON.stringify({ Message: `forced ${forced}` }), { status: forced });
    if (path === "/facilities/v2") return new Response(JSON.stringify(options.facilities ?? (await facilitiesBody())), { status: 200 });
    if (options.narrowWindows && (path === "/transfers/v2/incoming" || path === "/transfers/v2/outgoing")) {
      const start = Date.parse(url.searchParams.get("lastModifiedStart") ?? "");
      const end = Date.parse(url.searchParams.get("lastModifiedEnd") ?? "");
      if (end - start > 86_400_000) return new Response(JSON.stringify([{ row: 0, message: "The window is too wide." }]), { status: 400 });
    }
    let body: unknown = null;
    const listName = LIST_FIXTURES[path];
    if (listName) body = await fixture(listName);
    else {
      const hit = BY_ID.find((entry) => entry.re.test(path));
      if (!hit) return new Response(JSON.stringify({ Message: "no such path" }), { status: 404 });
      body = await fixture(hit.name);
    }
    if (options.empty?.includes(path)) body = emptyLike(body);
    if (options.echoSecrets && path === "/locations/v2/types") {
      (body as { Data: unknown[] }).Data.unshift({ Id: 9, Name: "echo", Authorization: `Basic ${TOKEN}`, Note: "fake-vendor-key and fake-user-key" });
    }
    if (options.echoSecrets && /^\/locations\/v2\/\d+$/.test(path)) {
      (body as Record<string, unknown>).Note = `Authorization: Basic ${TOKEN} fake-vendor-key fake-user-key`;
    }
    return new Response(JSON.stringify(body), { status: 200 });
  }) as typeof fetch;
  return { calls, fetchImpl };
}

async function runWith(m: MigratedDb, options: SandboxOptions = {}, over: Record<string, string> = {}) {
  const sandbox = fakeSandbox(options);
  const result = await runEval({ DB: m.db, ...FAKE, METRC_API_BASE: SANDBOX, ...over }, { fetchImpl: sandbox.fetchImpl, now: () => NOW, sleep: async () => undefined });
  return { ...sandbox, result, pack: result.run ? packOf(result.run) : null };
}

function stepsOf(pack: EvalPack, license: string, nn: string): StepRecord[] {
  const tab = pack.tabs.find((entry) => entry.license === license && entry.nn === nn);
  if (!tab) throw new Error(`no tab ${nn} for ${license}`);
  return tab.steps;
}

function step(pack: EvalPack, license: string, nn: string, name: string): StepRecord {
  const hit = stepsOf(pack, license, nn).find((entry) => entry.step === name);
  if (!hit) throw new Error(`no ${name} on tab ${nn} for ${license}`);
  return hit;
}

/** The row-4 headers and anchors, typed a second time from the workbook dump
 * (wf/workbook/tabNN_*.txt), trailing spaces included; the code's constant
 * must equal them exactly. */
const WORKBOOK_HEADERS: Record<string, string[]> = {
  "05": ["Result code", "License Facility", "ID Number ", "location Name Created  ", "Request Sent", " JSON Body Or Response  ((Minify please))"],
  "06": ["Result code", "License Facility", "ID Number ", "Strain Name Created  ", "Request Sent", " JSON Body Or Response  ((Minify please))"],
  "07": ["Result code", "License Facility", "ID Number ", "Item Name Created  ", "Request Sent", " JSON Body Or Response  ((Minify please))"],
  "09": ["Result code", "License Facility", "ID Number ", "Last Modified Date", "Plant Batch Name/Tag Number  ", "Request Sent", " JSON Body Or Response  (Minify please)"],
  "11": ["Result code", "License Facility", "ID Number ", "Last Modified Date", "Tag Number  ", "Harvest Name", "Request Sent", " JSON Body Or Response  (Minify please)"],
  "12": ["Result code", "License Facility", "ID Number ", "Last Modified Date", "Tag Number  ", "Harvest Name", "Request Sent", " JSON Body Or Response  (Minify please)"],
  "13": ["Result code", "License Facility", "ID Number ", "Last Modified Date", "Tag Number  ", "Request Sent", " JSON Body Or Response  (Minify please)"],
  "20": ["Result code", "License Facility", "ID Number ", "Last Modified Date", "Tag Number  ", "Request Sent", " JSON Body Or Response  (Minify please)"],
  "21": ["Result code", "License Facility", "ID Number ", "Last Modified Date", "Tag Number  ", "Request Sent", " JSON Body Or Response  (Minify please)"],
  "22": ["Result code", "License Facility", "ID Number ", "Last Modified Date", "Tag Number  ", "Request Sent", " JSON Body Or Response  (Minify please)"],
};
const WORKBOOK_ANCHORS: Record<string, string[]> = {
  "05": ["B5", "B9", "B13"],
  "06": ["B5", "B9", "B13"],
  "07": ["B5", "B9", "B13"],
  "09": ["B5", "B10", "B14", "B18", "B22"],
  "11": ["B6", "B10", "B14", "B18", "B22", "B26"],
  "12": ["B5", "B9", "B13", "B17"],
  "13": ["B5", "B9", "B13", "B17", "B21"],
  "20": ["B5", "B9", "B13", "B17", "B21", "B25"],
  "21": ["B5", "B9", "B13", "B17", "B21"],
  "22": ["B5", "B9", "B13", "B17", "B21"],
};
const WORKBOOK_TABS: Record<string, string> = {
  "05": "Locations",
  "06": "Strains",
  "07": "Items",
  "09": "Closed Loop States PlantBatches",
  "11": "Plants",
  "12": "Harvest",
  "13": "Packages",
  "20": "GET Transfers and Wholesale",
  "21": "Transfer Templates",
  "22": "Transfer External Incoming",
};
/** eval_steps section 7: the tab files in workbook order, and rows per file. */
const TAB_ORDER = ["05", "06", "07", "09", "11", "12", "13", "20", "21", "22"];
const ROWS_PER_TAB = [3, 3, 3, 5, 6, 4, 5, 6, 5, 5];

describe("MA1 Phase E1: the workbook constants", () => {
  it("holds the ten tabs' exact names, row-4 headers and anchors from the dump", () => {
    expect(EVAL_TABS.map((tab) => tab.nn)).toEqual(TAB_ORDER);
    for (const tab of EVAL_TABS) {
      expect(tab.tab).toBe(WORKBOOK_TABS[tab.nn]);
      expect([...tab.headers]).toEqual(WORKBOOK_HEADERS[tab.nn]);
      expect(tab.steps.map((entry) => entry.anchor)).toEqual(WORKBOOK_ANCHORS[tab.nn]);
    }
    expect(EVAL_TABS.map((tab) => tab.steps.length)).toEqual(ROWS_PER_TAB);
    const e1 = EVAL_TABS.flatMap((tab) => tab.steps.filter((entry) => entry.phase === "E1"));
    expect(e1.length).toBe(12);
    expect(e1.every((entry) => entry.verb === "GET" && entry.path_sent && entry.docs_file.startsWith("GET_"))).toBe(true);
    const e2 = EVAL_TABS.flatMap((tab) => tab.steps.filter((entry) => entry.phase === "E2"));
    expect(e2.length).toBe(33);
    expect(e2.every((entry) => entry.path_sent === null)).toBe(true);
  });

  it("names a docs file for every probe and never the premium tags or the plant batch waste reasons", async () => {
    const fs = await fsMod();
    const names = new Set(fs.readdirSync(new URL("./fixtures/metrc/", import.meta.url)));
    for (const probe of EVAL_PROBES) {
      expect(names.has(`${probe.docs_file.replace(/\.txt$/, "")}.json`), probe.path).toBe(true);
      expect(probe.path.startsWith("/tags/")).toBe(false);
      expect(probe.path).not.toBe("/plantbatches/v2/waste/reasons");
    }
    expect(EVAL_PROBES.length).toBe(20);
  });

  it("never references the write door: no metrcSend and no write method in metrceval.ts", async () => {
    const fs = await fsMod();
    const src = fs.readFileSync(new URL("../src/metrceval.ts", import.meta.url), "utf8");
    expect(src.includes("metrcSend")).toBe(false);
    expect(/method:\s*"(POST|PUT|DELETE)"/.test(src)).toBe(false);
    expect(src.includes("sendRefusal")).toBe(false);
  });

  it("has an EN and ES dictionary line for every page string", () => {
    for (const key of EVAL_PAGE_STRINGS) {
      expect(DICT[key], key).toBeDefined();
      expect(DICT[key].es.length, key).toBeGreaterThan(0);
    }
  });
});

describe("MA1 Phase E1: the run on a fake sandbox", () => {
  it("makes P0 first, chooses Grow and Processor by the flags, and walks every probe and step", async () => {
    const m = await migratedDb();
    const { calls, result, pack } = await runWith(m);
    expect(result.code).toBe("ok");
    expect(pack).not.toBeNull();
    const p = pack as EvalPack;
    expect(calls[0].path).toBe("/facilities/v2");
    expect(calls[0].query.toString()).toBe("");
    expect(p.p0.status).toBe("done 200");
    expect(p.run_order[0]).toBe("P0");
    expect(p.facilities.map((f) => [f.license, f.role])).toEqual([
      [GROW, "grow"],
      [PROCESSOR, "processor"],
    ]);
    expect(p.facilities[0]).toEqual({
      license: GROW,
      license_type: "Medical Cultivation",
      can_grow_plants: 1,
      can_record_processing_jobs: 0,
      can_track_vegetative_plants: 1,
      role: "grow",
    });
    // The Grow facility walks all ten tabs; the Processor the six of its type.
    expect(p.tabs.filter((tab) => tab.license === GROW).map((tab) => tab.nn)).toEqual(["05", "06", "07", "09", "11", "12", "13", "20", "21", "22"]);
    expect(p.tabs.filter((tab) => tab.license === PROCESSOR).map((tab) => tab.nn)).toEqual(["06", "07", "13", "20", "21", "22"]);
    expect(p.tabs.filter((tab) => tab.license === GROW).map((tab) => tab.steps.length)).toEqual(ROWS_PER_TAB);
    // Every probe ran for the Grow facility; the license-less four ran once per run.
    const growProbes = p.probes.filter((probe) => probe.license === GROW);
    expect(growProbes.map((probe) => probe.path)).toEqual(EVAL_PROBES.filter((probe) => probe.license).map((probe) => probe.path));
    expect(p.probes.filter((probe) => probe.license === null).map((probe) => probe.path)).toEqual(EVAL_PROBES.filter((probe) => !probe.license).map((probe) => probe.path));
    expect(p.probes.every((probe) => probe.status === "done 200" && probe.count > 0)).toBe(true);
    expect(p.probes.every((probe) => probe.ids.length <= 5 && probe.labels.length <= 5)).toBe(true);
    const types = growProbes.find((probe) => probe.path === "/locations/v2/types");
    expect(types?.request_url).toBe(`/locations/v2/types?licenseNumber=${GROW}&pageNumber=1&pageSize=50`);
    expect(types?.total_records).toBe(3);
    expect(types?.sample).toContain('"Name":"Default"');
    const uom = p.probes.find((probe) => probe.path === "/unitsofmeasure/v2/active");
    expect(uom?.request_url).toBe("/unitsofmeasure/v2/active");
    const tagtypes = growProbes.find((probe) => probe.path === "/sandbox/v2/tagtypes");
    expect(tagtypes?.request_url).toBe(`/sandbox/v2/tagtypes?licenseNumber=${GROW}`);
    // The 12 GET steps all answered; every write step reads E2 not enabled with blank cells.
    for (const license of [GROW, PROCESSOR]) {
      for (const tab of p.tabs.filter((entry) => entry.license === license)) {
        for (const entry of tab.steps) {
          if (entry.phase === "E2") {
            expect(entry.status).toBe(EVAL_E2_STATUS);
            expect(entry.columns).toEqual({});
            expect(entry.request_url).toBeNull();
          } else {
            expect(entry.status.startsWith("done 200"), `${license} ${tab.nn} ${entry.step}: ${entry.status}`).toBe(true);
          }
        }
      }
    }
    expect(step(p, GROW, "05", "Step 3").status).toBe("done 200 (existing record, Q6)");
    expect(step(p, GROW, "06", "Step 3").status).toBe("done 200 (existing record, Q6)");
    expect(step(p, GROW, "07", "Step 3").status).toBe("done 200 (docs path; existing record, Q6)");
    expect(step(p, GROW, "20", "Step 1").status).toBe("done 200");
    expect(step(p, GROW, "20", "Step 5").status).toBe("done 200 (docs path)");
    expect(step(p, GROW, "20", "Step 6").status).toBe("done 200 (docs path)");
    expect(step(p, GROW, "21", "Step 2").status).toBe("done 200 (docs path)");
    expect(step(p, GROW, "21", "Step 3").status).toBe("done 200 (docs path; existing record, Q6)");
    expect(step(p, GROW, "22", "Step 2").status).toBe("done 200");
    // P0, 20 probes plus 16, 12 Grow steps plus 11 Processor steps: 60 calls, each logged with the host.
    expect(result.run?.calls).toBe(60);
    expect(calls.length).toBe(60);
    const logged = m.all(`SELECT path, status, host FROM metrc_api_calls`);
    expect(logged.length).toBe(60);
    expect(logged.every((row) => row.host === "sandbox-api-mi.metrc.com" && row.status === 200)).toBe(true);
    expect(m.get(`SELECT status, calls, bytes FROM metrc_eval_runs`)).toEqual({ status: "ok", calls: 60, bytes: result.run?.bytes });
    expect(p.meta).toMatchObject({
      host: "sandbox-api-mi.metrc.com",
      phase: "E1",
      brief: "MA1",
      workbook_sha256_prefix: "d06d9a4bd4a404e7",
      docs_fetch_date: "2026-10-08",
      config: { maxCalls: 150, windowDays: 30, pageSize: 50 },
      calls: 60,
      status: "ok",
      cuts: [],
    });
    expect(p.writes_outside_workbook).toEqual([]);
  });

  it("fills the by-id rows from existing records and the list rows from the first row", async () => {
    const m = await migratedDb();
    const { pack } = await runWith(m);
    const p = pack as EvalPack;
    const l3 = step(p, GROW, "05", "Step 3");
    expect(l3.path_workbook).toBe("GET /locations/v2/{id}");
    expect(l3.path_sent).toBe("/locations/v2/{id}");
    expect(l3.request_url).toBe(`/locations/v2/1?licenseNumber=${GROW}`);
    expect(l3.license_source).toBe("sent");
    expect(l3.docs_file).toBe("GET_locations_v2_id.txt");
    expect(l3.columns).toEqual({
      "Result code": "200",
      "License Facility": GROW,
      "ID Number ": "1",
      "location Name Created  ": "Harvest Location",
      "Request Sent": `GET /locations/v2/1?licenseNumber=${GROW}`,
      " JSON Body Or Response  ((Minify please))": l3.response_body,
    });
    expect(l3.response_body).toContain('"Name":"Harvest Location"');
    expect(step(p, GROW, "06", "Step 3").request_url).toBe(`/strains/v2/201?licenseNumber=${GROW}`);
    expect(step(p, PROCESSOR, "07", "Step 3").request_url).toBe(`/items/v2/1?licenseNumber=${PROCESSOR}`);
    const t1 = step(p, GROW, "20", "Step 1");
    expect(t1.columns["ID Number "]).toBe("1");
    expect(t1.columns["Last Modified Date"]).toBe("2026-10-08");
    expect(t1.columns["Tag Number  "]).toBe("");
    expect(t1.columns["Request Sent"]).toBe(`GET ${t1.request_url}`);
    const t5 = step(p, GROW, "20", "Step 5");
    expect(t5.columns["ID Number "]).toBe("1");
    expect(t5.columns["Tag Number  "]).toBe("ABCDEF012345670000010026");
    expect(t5.columns["License Facility"]).toBe(GROW);
  });

  it("chains T4 to T6 on the Ids T1 and T4 found, with the parent call's license", async () => {
    const m = await migratedDb();
    const { pack } = await runWith(m);
    const p = pack as EvalPack;
    const t4 = step(p, GROW, "20", "Step 4");
    expect(t4.request_url).toBe("/transfers/v2/1/deliveries?pageNumber=1&pageSize=50");
    expect(t4.license_source).toBe("parent call Step 1");
    expect(t4.reason).toContain("{id} is the Transfer Id 1 (Q10)");
    expect(t4.reason).toContain("ManifestNumber 0000000001 rides in Step 1's JSON");
    expect(t4.reason).toContain("License Facility is the parent call Step 1's license");
    const t5 = step(p, GROW, "20", "Step 5");
    expect(t5.request_url).toBe("/transfers/v2/deliveries/1/packages?pageNumber=1&pageSize=50");
    expect(t5.path_workbook).toBe("GET /transfers/v2/delivery/{id}/packages");
    expect(t5.license_source).toBe("parent call Step 4");
    const t6 = step(p, GROW, "20", "Step 6");
    expect(t6.request_url).toBe("/transfers/v2/deliveries/1/packages/wholesale?pageNumber=1&pageSize=50");
    const tt3 = step(p, GROW, "21", "Step 3");
    expect(tt3.request_url).toBe("/transfers/v2/templates/outgoing/1/deliveries?pageNumber=1&pageSize=50");
    expect(tt3.license_source).toBe("parent probe /transfers/v2/templates/outgoing");
    // T4 takes T2's Id when T1 is empty, and T3's when both are.
    const m2 = await migratedDb();
    const second = await runWith(m2, { empty: ["/transfers/v2/incoming", "/transfers/v2/outgoing"] });
    const t4b = step(second.pack as EvalPack, GROW, "20", "Step 4");
    expect(t4b.request_url).toBe("/transfers/v2/2/deliveries?pageNumber=1&pageSize=50");
    expect(t4b.license_source).toBe("parent call Step 3");
  });

  it("reports cannot run when a probe or a parent step found nothing, with the cells blank", async () => {
    const m = await migratedDb();
    const { pack, result } = await runWith(m, {
      empty: ["/locations/v2/active", "/strains/v2/active", "/items/v2/active", "/transfers/v2/templates/outgoing", "/transfers/v2/incoming", "/transfers/v2/outgoing", "/transfers/v2/rejected"],
    });
    expect(result.code).toBe("partial");
    const p = pack as EvalPack;
    const l3 = step(p, GROW, "05", "Step 3");
    expect(l3.status).toBe("cannot run: needs location from Step 1 (POST /locations/v2/)");
    expect(l3.columns).toEqual({});
    expect(l3.request_url).toBeNull();
    expect(step(p, GROW, "06", "Step 3").status).toBe("cannot run: needs strain from Step 1 (POST /strains/v2/)");
    expect(step(p, GROW, "07", "Step 3").status).toBe("cannot run: needs item from Step 1 (POST /items/v2/)");
    const t1 = step(p, GROW, "20", "Step 1");
    expect(t1.status).toBe("cannot run: sandbox lacks incoming transfer; fix: none documented, ask Metrc");
    expect(t1.response_status).toBe(200);
    expect(t1.columns["Result code"]).toBe("200");
    expect(step(p, GROW, "20", "Step 2").status).toBe("cannot run: sandbox lacks outgoing transfer; fix: none documented, ask Metrc");
    expect(step(p, GROW, "20", "Step 3").status).toBe("cannot run: sandbox lacks rejected transfer; fix: none documented, ask Metrc");
    expect(step(p, GROW, "20", "Step 4").status).toBe("cannot run: needs transfer Id from Step 1, 2 or 3");
    expect(step(p, GROW, "20", "Step 4").columns).toEqual({});
    expect(step(p, GROW, "20", "Step 5").status).toBe("cannot run: needs delivery Id from Step 4");
    expect(step(p, GROW, "20", "Step 6").status).toBe("cannot run: needs delivery Id from Step 4");
    expect(step(p, GROW, "21", "Step 2").status).toBe("cannot run: needs templates from Step 1a and 1b (POST /transfers/v2/templates/outgoing)");
    expect(step(p, GROW, "21", "Step 3").status).toBe("cannot run: needs template from Step 1a or 1b (POST /transfers/v2/templates/outgoing)");
    const x2 = step(p, GROW, "22", "Step 2");
    expect(x2.status).toBe("cannot run: needs external incoming transfers from Step 1a and 1b (POST /transfers/v2/external/incoming)");
    expect(x2.reason).toContain("CanTransferFromExternalFacilities reads false");
    // The flags the runner read in memory reach only the notes of the rows they stop, never a field.
    expect(JSON.stringify(p.facilities)).not.toContain("CanTransferFromExternalFacilities");
    expect(step(p, GROW, "22", "Step 1a").reason).toContain("CanTransferFromExternalFacilities reads false");
    expect(step(p, GROW, "09", "Step 1").reason).toContain("CanCreateOpeningBalancePlantBatches true; P0 reads false");
    // Every row is present, run or not.
    expect(p.tabs.filter((tab) => tab.license === GROW).map((tab) => tab.steps.length)).toEqual(ROWS_PER_TAB);
  });

  it("sends UTC windows without milliseconds and narrows a 400 to one day, recording both attempts", async () => {
    const m = await migratedDb();
    const { pack, calls } = await runWith(m, { narrowWindows: true });
    const p = pack as EvalPack;
    const t1 = step(p, GROW, "20", "Step 1");
    expect(t1.status).toBe("done 200");
    expect(t1.attempts?.length).toBe(2);
    const [wide, narrow] = t1.attempts as NonNullable<StepRecord["attempts"]>;
    expect(wide.response_status).toBe(400);
    expect(wide.window).toEqual({ lastModifiedStart: "2026-09-08T10:00:00Z", lastModifiedEnd: "2026-10-08T10:00:00Z" });
    expect(narrow.response_status).toBe(200);
    expect(narrow.window).toEqual({ lastModifiedStart: "2026-10-07T10:00:00Z", lastModifiedEnd: "2026-10-08T10:00:00Z" });
    expect(t1.window).toEqual(narrow.window);
    expect(t1.request_url).toBe(`/transfers/v2/incoming?licenseNumber=${GROW}&lastModifiedStart=2026-10-07T10%3A00%3A00Z&lastModifiedEnd=2026-10-08T10%3A00%3A00Z&pageNumber=1&pageSize=50`);
    for (const call of calls.filter((entry) => entry.query.has("lastModifiedStart"))) {
      expect(call.query.get("lastModifiedStart")).toMatch(ISO_SECONDS);
      expect(call.query.get("lastModifiedEnd")).toMatch(ISO_SECONDS);
    }
    // T3 and the probes carry no window; TT2 and X2 carry the configured one.
    expect(step(p, GROW, "20", "Step 3").window).toBeNull();
    expect(step(p, GROW, "21", "Step 2").window).toEqual({ lastModifiedStart: "2026-09-08T10:00:00Z", lastModifiedEnd: "2026-10-08T10:00:00Z" });
    expect(step(p, GROW, "22", "Step 2").attempts?.length).toBe(2);
    expect(p.probes.find((probe) => probe.path === "/transfers/v2/templates/outgoing")?.request_url).not.toContain("lastModified");
    expect(evalWindow(Date.parse("2026-10-08T10:00:00.750Z"), 30)).toEqual({ lastModifiedStart: "2026-09-08T10:00:00Z", lastModifiedEnd: "2026-10-08T10:00:00Z" });
  });

  it("stops at the run budget with cannot run: budget on every step past it", async () => {
    const m = await migratedDb();
    m.run(`UPDATE app_config SET value = '3' WHERE key = 'metrc_eval_max_calls'`);
    const { pack, calls, result } = await runWith(m);
    expect(calls.length).toBe(3);
    expect(result.code).toBe("partial");
    const p = pack as EvalPack;
    expect(p.meta.config.maxCalls).toBe(3);
    expect(p.probes.slice(0, 2).every((probe) => probe.status === "done 200")).toBe(true);
    expect(p.probes.slice(2).every((probe) => probe.status === EVAL_BUDGET_STATUS)).toBe(true);
    const e1 = p.tabs.flatMap((tab) => tab.steps.filter((entry) => entry.phase === "E1"));
    expect(e1.length).toBe(12 + 11);
    expect(e1.every((entry) => entry.status === EVAL_BUDGET_STATUS && entry.columns && Object.keys(entry.columns).length === 0)).toBe(true);
    expect(m.get(`SELECT COUNT(*) AS n FROM metrc_api_calls`)).toEqual({ n: 3 });
  });

  it("ends the run as refused on a 401 at P0, and as failed when Metrc does not answer it", async () => {
    const m = await migratedDb();
    const refused = await runWith(m, { status: { "/facilities/v2": 401 } });
    expect(refused.result.code).toBe("refused");
    expect(refused.calls.length).toBe(1);
    const p = refused.pack as EvalPack;
    expect(p.p0.status).toBe("refused 401");
    expect(p.tabs).toEqual([]);
    expect(p.probes).toEqual([]);
    expect(m.get(`SELECT status, calls FROM metrc_eval_runs`)).toEqual({ status: "refused", calls: 1 });
    const m2 = await migratedDb();
    const failed = await runWith(m2, { throwOn: ["/facilities/v2"] });
    expect(failed.result.code).toBe("failed");
    expect((failed.pack as EvalPack).p0.status).toBe("failed 0");
    expect((failed.pack as EvalPack).p0.reason).not.toContain("fake-user-key");
    expect((failed.pack as EvalPack).p0.reason).not.toContain(TOKEN);
  });

  it("records a network failure on a step as failed 0 and carries on", async () => {
    const m = await migratedDb();
    const { pack, result } = await runWith(m, { throwOn: ["/transfers/v2/rejected"], status: { "/strains/v2/active": 500 } });
    expect(result.code).toBe("partial");
    const p = pack as EvalPack;
    const t3 = step(p, GROW, "20", "Step 3");
    expect(t3.status).toBe("failed 0");
    expect(t3.reason).toContain("fetch failed");
    expect(t3.reason).not.toContain("fake-user-key");
    expect(t3.reason).not.toContain(TOKEN);
    expect(step(p, GROW, "20", "Step 4").status).toBe("done 200");
    expect(step(p, GROW, "20", "Step 6").status).toBe("done 200 (docs path)");
    const strains = p.probes.find((probe) => probe.license === GROW && probe.path === "/strains/v2/active");
    expect(strains?.status).toBe("failed 500");
    const s3 = step(p, GROW, "06", "Step 3");
    expect(s3.status).toBe("cannot run: needs strain from Step 1 (POST /strains/v2/)");
    expect(s3.reason).toBe("the probe /strains/v2/active read failed 500");
  });

  it("keeps no key, token, Authorization text, EmployeeLicenseNumber or FacilityId anywhere in the stored row", async () => {
    const m = await migratedDb();
    const { result } = await runWith(m, { echoSecrets: true });
    const json = result.run?.steps_json as string;
    expect(json.length).toBeGreaterThan(10_000);
    for (const secret of ["fake-vendor-key", "fake-user-key", TOKEN, "Authorization", "EmployeeLicenseNumber", EMPLOYEE_SECRET, "FacilityId"]) {
      expect(json.includes(secret), secret).toBe(false);
    }
    expect(json).toContain("[key]");
    expect(json).toContain("[authorization]");
    const files = evalJsonFile(packOf(result.run as NonNullable<typeof result.run>));
    expect(files.name).toBe("metrc_eval_20261008T1000Z.json");
    expect(files.body.includes(TOKEN)).toBe(false);
  });

  it("scrubs and drops the never-stored keys as the helpers promise", () => {
    expect(scrubLong(`x ${TOKEN} y fake-user-key z Basic ${TOKEN}`, ["fake-vendor-key", "fake-user-key", TOKEN])).toBe("x [key] y [key] z [key]");
    expect(scrubLong("a".repeat(900), [])).toHaveLength(900);
    expect(scrubLong('{"Authorization":"Basic abcdefghijkl"}', [])).not.toContain("Authorization");
    expect(dropNeverStoredKeys({ FacilityId: 1, License: { Number: "1", EmployeeLicenseNumber: "x" }, List: [{ FacilityId: 2, Keep: true }] })).toEqual({
      License: { Number: "1" },
      List: [{ Keep: true }],
    });
  });

  it("caps steps_json by dropping probe bodies first, then truncating response bodies to 2,000 characters", async () => {
    const m = await migratedDb();
    const { pack } = await runWith(m);
    const base = JSON.stringify(pack);
    const big = "x".repeat(EVAL_BODY_CAP);
    // Scenario 1: probe samples alone push the pack over the cap; dropping them is enough.
    const one = JSON.parse(base) as EvalPack;
    for (let i = 0; i < 100; i++) one.probes.push({ ...one.probes[0], sample: big });
    const first = capPack(one);
    expect(first.bytes).toBeLessThanOrEqual(EVAL_STEPS_JSON_CAP);
    expect(one.meta.cuts).toEqual(["probe_bodies"]);
    expect(one.probes.every((probe) => probe.sample === null)).toBe(true);
    expect(one.tabs.flatMap((tab) => tab.steps).every((entry) => !entry.truncated)).toBe(true);
    expect(one.tabs.flatMap((tab) => tab.steps).some((entry) => entry.response_body && entry.response_body.length > EVAL_BODY_CUT)).toBe(true);
    // Scenario 2: step bodies push it over; both cuts apply, in order.
    const two = JSON.parse(base) as EvalPack;
    const tab = two.tabs[0];
    for (let i = 0; i < 100; i++) {
      tab.steps.push({ ...tab.steps[2], response_body: big, columns: { ...tab.steps[2].columns, " JSON Body Or Response  ((Minify please))": big } });
    }
    const second = capPack(two);
    expect(second.bytes).toBeLessThanOrEqual(EVAL_STEPS_JSON_CAP);
    expect(two.meta.cuts).toEqual(["probe_bodies", `response_bodies_${EVAL_BODY_CUT}`]);
    const last = tab.steps[tab.steps.length - 1];
    expect(last.response_body?.length).toBe(EVAL_BODY_CUT);
    expect(last.truncated).toBe(true);
    expect(last.columns[" JSON Body Or Response  ((Minify please))"].length).toBe(EVAL_BODY_CUT);
    // Under the cap nothing is cut.
    const three = JSON.parse(base) as EvalPack;
    capPack(three);
    expect(three.meta.cuts).toEqual([]);
    // The run itself honours an injected cap and names every cut it needed, in order; a cap no
    // pack can meet drops the pack to its meta, facilities and P0 and stores the run as failed.
    const m2 = await migratedDb();
    const sandbox = fakeSandbox();
    const result = await runEval({ DB: m2.db, ...FAKE, METRC_API_BASE: SANDBOX }, { fetchImpl: sandbox.fetchImpl, now: () => NOW, stepsJsonCap: 2000 });
    expect(packOf(result.run as NonNullable<typeof result.run>).meta.cuts).toEqual(["probe_bodies", `response_bodies_${EVAL_BODY_CUT}`, "response_bodies_0", "pack_dropped"]);
    expect(result.code).toBe("failed");
    expect(result.run?.bytes).toBeLessThanOrEqual(2000);
    expect(m2.get(`SELECT status FROM metrc_eval_runs`)).toEqual({ status: "failed" });
  });
});

describe("MA1 Phase E1: the pack files", () => {
  it("names one CSV per facility and tab plus one JSON, and builds each CSV with the workbook's headers exactly", async () => {
    const m = await migratedDb();
    const { pack } = await runWith(m);
    const p = pack as EvalPack;
    const names = packFileNames(p);
    expect(names.length).toBe(16 + 1);
    expect(names[0]).toBe("metrc_eval_20261008T1000Z_403-X0001_05_Locations.csv");
    expect(names[10]).toBe("metrc_eval_20261008T1000Z_402-X0002_06_Strains.csv");
    expect(names[16]).toBe("metrc_eval_20261008T1000Z.json");
    expect(p.meta.files).toEqual(names);
    const rowsSeen: number[] = [];
    for (const name of names.slice(0, 10)) {
      const file = evalCsvFile(p, name);
      expect(file?.name).toBe(name);
      const rows = parseCsv(file?.body as string);
      const nn = name.split("_")[4];
      expect(rows[0]).toEqual(["Step", "Paste at", ...WORKBOOK_HEADERS[nn], "Runner status", "Runner note"]);
      rowsSeen.push(rows.length - 1);
      expect(rows.slice(1).map((row) => row[1])).toEqual(WORKBOOK_ANCHORS[nn]);
      expect(rows.slice(1).every((row) => row.length === rows[0].length)).toBe(true);
    }
    expect(rowsSeen).toEqual(ROWS_PER_TAB);
    const locations = parseCsv(evalCsvFile(p, names[0])?.body as string);
    expect(locations[1]).toEqual(["Step 1", "B5", "", "", "", "", "", "", EVAL_E2_STATUS, expect.stringContaining("A write step.")]);
    expect(locations[3].slice(0, 6)).toEqual(["Step 3", "B13", "200", GROW, "1", "Harvest Location"]);
    expect(locations[3][6]).toBe(`GET /locations/v2/1?licenseNumber=${GROW}`);
    expect(JSON.parse(locations[3][7])).toMatchObject({ Id: 1, Name: "Harvest Location" });
    expect(locations[3][8]).toBe("done 200 (existing record, Q6)");
    expect(evalCsvFile(p, "metrc_eval_20261008T1000Z.json")).toBeNull();
    expect(evalCsvFile(p, "../etc/passwd")).toBeNull();
    const transfers = parseCsv(evalCsvFile(p, names[7])?.body as string);
    expect(transfers[0].length).toBe(2 + 7 + 2);
    expect(transfers[5].slice(0, 5)).toEqual(["Step 5", "B21", "200", GROW, "1"]);
    expect(transfers[5][6]).toBe("ABCDEF012345670000010026");
    expect(transfers[5][9]).toBe("done 200 (docs path)");
  });
});

describe("MA1 Phase E1: hosts, keys and the Admin page", () => {
  it("is active on a sandbox host only", () => {
    expect(evalPageActive({ METRC_API_BASE: SANDBOX })).toBe(true);
    expect(evalPageActive({})).toBe(true);
    expect(evalPageActive({ METRC_API_BASE: PRODUCTION })).toBe(false);
    expect(evalPageActive({ METRC_API_BASE: "https://example.com" })).toBe(false);
    expect(facilityRole({ canGrowPlants: 1, canRecordProcessingJobs: 1 })).toBe("grow_processor");
    expect(facilityRole({ canGrowPlants: null, canRecordProcessingJobs: 0 })).toBe("none");
  });

  it("renders the inactive page on a production host and the POST makes no call", async () => {
    const m = await migratedDb();
    const env = { DB: m.db, ...FAKE, METRC_API_BASE: PRODUCTION };
    const data = await loadMetrcEvalAdmin(env);
    expect(data.active).toBe(false);
    const html = metrcEvalPage(data, "en", null);
    expect(html).toContain('data-metrc-eval-active="no"');
    expect(html).toContain(EVAL_SANDBOX_ONLY);
    expect(html).not.toContain("<form");
    expect(html).not.toContain("data-metrc-eval-run");
    expect(metrcEvalPage(data, "es", null)).toContain("El ejecutor de la evaluacion funciona solo en un host de sandbox.");
    const sandbox = fakeSandbox();
    const result = await runEval(env, { fetchImpl: sandbox.fetchImpl });
    expect(result).toEqual({ code: "host", run: null });
    expect(sandbox.calls.length).toBe(0);
    expect(m.get(`SELECT COUNT(*) AS n FROM metrc_eval_runs`)).toEqual({ n: 0 });
    expect(m.get(`SELECT COUNT(*) AS n FROM metrc_api_calls`)).toEqual({ n: 0 });
  });

  it("makes no call and stores no run when a key is absent", async () => {
    const m = await migratedDb();
    const sandbox = fakeSandbox();
    for (const env of [
      { DB: m.db, METRC_API_BASE: SANDBOX },
      { DB: m.db, METRC_INTEGRATOR_KEY: "fake-vendor-key", METRC_API_BASE: SANDBOX },
      { DB: m.db, METRC_USER_KEY: "fake-user-key", METRC_API_BASE: SANDBOX },
    ]) {
      expect(await runEval(env, { fetchImpl: sandbox.fetchImpl })).toEqual({ code: "absent", run: null });
    }
    expect(sandbox.calls.length).toBe(0);
    expect(m.get(`SELECT COUNT(*) AS n FROM metrc_api_calls`)).toEqual({ n: 0 });
    const data = await loadMetrcEvalAdmin({ DB: m.db, METRC_API_BASE: SANDBOX });
    const html = metrcEvalPage(data, "en", "absent");
    expect(html).toContain('data-metrc-eval-active="yes"');
    expect(html).toContain('data-metrc-eval-integrator="absent"');
    expect(html).toContain('data-metrc-eval-user="absent"');
    expect(html).toContain("data-metrc-eval-run disabled");
    expect(html).toContain("The keys are absent, so no call is made.");
    expect(html).toContain('data-metrc-eval-flash="absent"');
    expect(html).toContain("The integrator key is absent. The user key is absent.");
    expect(html).toContain('data-metrc-eval-facilities="none"');
    expect(html).toContain('data-metrc-eval-runs="none"');
    expect(html).toContain("12 GET steps across the applicable tabs");
  });

  it("lists the facilities and runs with their pack links, every element with title help, in EN and ES", async () => {
    const m = await migratedDb();
    const { result } = await runWith(m);
    const env = { DB: m.db, ...FAKE, METRC_API_BASE: SANDBOX };
    const data = await loadMetrcEvalAdmin(env);
    expect(data.active).toBe(true);
    expect(data.config).toEqual({ maxCalls: 150, windowDays: 30, pageSize: 50 });
    expect(data.facilities.map((f) => [f.license, f.role])).toEqual([
      [GROW, "grow"],
      [PROCESSOR, "processor"],
    ]);
    expect(data.runs.length).toBe(1);
    expect(data.runs[0]).toMatchObject({ id: result.run?.id, status: "ok", calls: 60, bytes: result.run?.bytes });
    expect(data.runs[0].files.length).toBe(17);
    const html = metrcEvalPage(data, "en", "ok");
    expect(html).toContain(`data-metrc-eval-facility="${GROW}" data-metrc-eval-role="grow"`);
    expect(html).toContain(`${GROW} (Medical Cultivation): Grow [CanGrowPlants 1, CanRecordProcessingJobs 0, CanTrackVegetativePlants 1]`);
    expect(html).toContain(`${PROCESSOR} (Medical Dispensary): Processor [CanGrowPlants 0, CanRecordProcessingJobs 1, CanTrackVegetativePlants 0]`);
    expect(html).toContain(`data-metrc-eval-run-id="${result.run?.id}"`);
    expect(html).toContain(`href="/admin/metrc-eval/runs/${result.run?.id}/json"`);
    expect(html).toContain(`href="/admin/metrc-eval/runs/${result.run?.id}/csv/metrc_eval_20261008T1000Z_403-X0001_05_Locations.csv"`);
    expect(html).toContain('data-metrc-eval-config="150,30,50"');
    expect(html).toContain('data-metrc-eval-flash="ok"');
    expect(html).toContain("<button type=\"submit\" data-metrc-eval-run title=");
    expect(html).not.toContain("disabled");
    expect(html).not.toContain("fake-");
    expect(html).not.toContain(TOKEN);
    // Every element the page adds carries a native title (G-3 field help), the pack links included.
    const tags = html.match(/<([a-z][a-z0-9]*)\b[^>]*>/g) ?? [];
    expect(tags.length).toBeGreaterThan(30);
    for (const tag of tags) expect(tag, tag).toContain(' title="');
    expect((html.match(/<a\b[^>]*>/g) ?? []).length).toBe(17);
    const es = metrcEvalPage(data, "es", "ok");
    expect(es).toContain("Evaluacion de Metrc");
    expect(es).toContain("Correr E1 ahora");
    expect(es).toContain("Instalaciones de la ultima corrida");
    expect(es).toContain("La corrida termino: todos los pasos GET respondieron.");
    expect(es).toContain("Admin\\Data Lookups\\People and System\\App config");
  });
});
