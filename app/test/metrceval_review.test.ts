import { describe, expect, it } from "vitest";
import { parseCsv } from "../src/csv";
import { DICT } from "../src/i18n";
import { app } from "../src/index";
import { backLinkFor } from "../src/nav";
import {
  EVAL_BODY_CAP,
  EVAL_BODY_CUT,
  EVAL_FILE_LICENSE_CAP,
  EVAL_PAGE_STRINGS,
  EVAL_PROBES,
  EVAL_RUNS_LISTED,
  EVAL_TABS,
  capPack,
  evalCsvFile,
  loadMetrcEvalAdmin,
  metrcEvalPage,
  packFileNames,
  packOf,
  runEval,
  scrubLong,
  scrubSpellings,
  type EvalDeps,
  type EvalPack,
  type StepRecord,
} from "../src/metrceval";
import { migratedDb, type MigratedDb } from "./migrated";

// MA1 Phase E1 review tests. Part one (review_tests) kills the mutants that
// test/metrceval.test.ts let live: a second fake sandbox whose records carry
// DISTINCT Ids per kind (the docs examples all say Id 1), with more than one
// row per list, so a chained Id, a last-row Id or a swapped path shows. Part
// two (the fix pass) pins the fixes to the correctness, law and security
// findings: scrubbing fidelity, the JSON-safe Authorization blank, the encoded
// key spellings, the pack cap's third cut and final guard, distinct pack file
// names, the by-id path guard, the CSV formula guard, the bounded response
// read, the flash lookup, the title help on every element and the Law 9 path.

const SANDBOX = "https://sandbox-api-mi.metrc.com";
const PRODUCTION = "https://api-mi.metrc.com";
const FAKE = { METRC_INTEGRATOR_KEY: "fake-vendor-key", METRC_USER_KEY: "fake-user-key" };
const NOW = "2026-10-08T10:00:00.000Z";
const GROW = "403-X0001";
const PROCESSOR = "402-X0002";
const NEITHER = "404-X0003";
const EMPLOYEE_SECRET = "EMP-SECRET-777";
const PIN = { cookie: "gf_pin=21319" };
const E1_ORDER = ["T1", "T2", "T3", "T4", "T5", "T6", "L3", "S3", "I3", "X2", "TT2", "TT3"];
const ID = { location: 101, strain: 201, item: 301, template: 401, incoming: 501, outgoing: 601, rejected: 602, delivery: 701 };
/** Fake keys that hold a quote and a backslash, so their JSON-escaped and URL-encoded spellings differ from the raw one. */
const QUOTE_KEY = 'fake-vendor"quote-key';
const SLASH_KEY = "fake-user\\slash-key";
const TOKEN2 = btoa(`${QUOTE_KEY}:${SLASH_KEY}`);
const FORMULA_NAME = '=HYPERLINK("http://example.test","click")';
const LOOKUP_PATH = "Admin\\Data Lookups\\People and System\\App config";

type Fs = { readFileSync(path: URL, encoding: "utf8"): string };
const cache = new Map<string, unknown>();
async function fixture(name: string): Promise<unknown> {
  if (!cache.has(name)) {
    const fs = (await import("node:" + "fs")) as Fs;
    cache.set(name, JSON.parse(fs.readFileSync(new URL(`./fixtures/metrc/${name}.json`, import.meta.url), "utf8")));
  }
  return JSON.parse(JSON.stringify(cache.get(name)));
}

type Row = Record<string, unknown>;
function rowsOf(body: unknown): Row[] {
  if (Array.isArray(body)) return body as Row[];
  if (body && typeof body === "object" && Array.isArray((body as { Data?: unknown }).Data)) return (body as { Data: Row[] }).Data;
  return [];
}
/** Two rows per list (the docs give one), Ids base and base + 1. */
function twoRows(body: unknown, base: number): unknown {
  const rows = rowsOf(body);
  if (rows.length === 1) rows.push(JSON.parse(JSON.stringify(rows[0])) as Row);
  rows.forEach((row, i) => {
    row.Id = base + i;
  });
  if (body && typeof body === "object" && !Array.isArray(body)) {
    const page = body as Row;
    page.Total = rows.length;
    page.TotalRecords = rows.length;
    page.RecordsOnPage = rows.length;
  }
  return body;
}

async function facilitiesBody(extraNeither = false, licenses?: [string, string]): Promise<unknown[]> {
  const list = (await fixture("GET_facilities_v2")) as Array<{ FacilityType: Row; License: Row }>;
  list[0].FacilityType.CanGrowPlants = true;
  list[0].FacilityType.CanTrackVegetativePlants = true;
  list[0].License.EmployeeLicenseNumber = EMPLOYEE_SECRET;
  list[1].FacilityType.CanRecordProcessingJobs = true;
  if (licenses) {
    list[0].License.Number = licenses[0];
    list[1].License.Number = licenses[1];
    list[1].FacilityType.CanGrowPlants = true;
  }
  if (extraNeither) {
    const third = JSON.parse(JSON.stringify(list[1])) as { FacilityType: Row; License: Row };
    third.License.Number = NEITHER;
    third.FacilityType.CanGrowPlants = false;
    third.FacilityType.CanRecordProcessingJobs = false;
    list.push(third);
  }
  return list;
}

const LIST: Record<string, { name: string; base: number | null }> = {
  "/locations/v2/types": { name: "GET_locations_v2_types", base: null },
  "/locations/v2/active": { name: "GET_locations_v2_active", base: ID.location },
  "/strains/v2/active": { name: "GET_strains_v2_active", base: ID.strain },
  "/items/v2/active": { name: "GET_items_v2_active", base: ID.item },
  "/items/v2/categories": { name: "GET_items_v2_categories", base: null },
  "/unitsofmeasure/v2/active": { name: "GET_unitsofmeasure_v2_active", base: null },
  "/plantbatches/v2/active": { name: "GET_plantbatches_v2_active", base: null },
  "/plants/v2/vegetative": { name: "GET_plants_v2_vegetative", base: null },
  "/plants/v2/flowering": { name: "GET_plants_v2_flowering", base: null },
  "/plants/v2/mother": { name: "GET_plants_v2_mother", base: null },
  "/harvests/v2/active": { name: "GET_harvests_v2_active", base: null },
  "/packages/v2/active": { name: "GET_packages_v2_active", base: null },
  "/plants/v2/waste/reasons": { name: "GET_plants_v2_waste_reasons", base: null },
  "/wastemethods/v2/": { name: "GET_wastemethods_v2", base: null },
  "/plants/v2/waste/methods/all": { name: "GET_plants_v2_waste_methods_all", base: null },
  "/harvests/v2/waste/types": { name: "GET_harvests_v2_waste_types", base: null },
  "/packages/v2/adjust/reasons": { name: "GET_packages_v2_adjust_reasons", base: null },
  "/transfers/v2/types": { name: "GET_transfers_v2_types", base: null },
  "/transfers/v2/templates/outgoing": { name: "GET_transfers_v2_templates_outgoing", base: ID.template },
  "/sandbox/v2/tagtypes": { name: "GET_sandbox_v2_tagtypes", base: null },
  "/transfers/v2/incoming": { name: "GET_transfers_v2_incoming", base: ID.incoming },
  "/transfers/v2/outgoing": { name: "GET_transfers_v2_outgoing", base: ID.outgoing },
  "/transfers/v2/rejected": { name: "GET_transfers_v2_rejected", base: ID.rejected },
};

const BY_ID: Array<{ re: RegExp; name: string; id: number; list: number | null }> = [
  { re: /^\/locations\/v2\/(\d+)$/, name: "GET_locations_v2_id", id: ID.location, list: null },
  { re: /^\/strains\/v2\/(\d+)$/, name: "GET_strains_v2_id", id: ID.strain, list: null },
  { re: /^\/items\/v2\/(\d+)$/, name: "GET_items_v2_id", id: ID.item, list: null },
  { re: /^\/transfers\/v2\/(\d+)\/deliveries$/, name: "GET_transfers_v2_id_deliveries", id: ID.incoming, list: ID.delivery },
  { re: /^\/transfers\/v2\/deliveries\/(\d+)\/packages$/, name: "GET_transfers_v2_deliveries_id_packages", id: ID.delivery, list: null },
  { re: /^\/transfers\/v2\/deliveries\/(\d+)\/packages\/wholesale$/, name: "GET_transfers_v2_deliveries_id_packages_wholesale", id: ID.delivery, list: null },
  { re: /^\/transfers\/v2\/templates\/outgoing\/(\d+)\/deliveries$/, name: "GET_transfers_v2_templates_outgoing_id_deliveries", id: ID.template, list: null },
];

type Options = {
  status?: Record<string, number>;
  narrowWindows?: boolean;
  facilities?: unknown;
  /** The types probe row and the by-id location carry the two never-stored keys. */
  echoNeverStored?: boolean;
  /** The by-id location answers a 25,000 character Note. */
  bigLocation?: boolean;
  /** The types probe answers seven rows. */
  manyTypes?: boolean;
  /** Bodies and a 400 message echo the QUOTE_KEY and SLASH_KEY pair in raw, escaped and URL-encoded spellings. */
  echoEncoded?: boolean;
  /** List rows whose first Id is a dot segment, a slash path or a space, so the by-id steps must refuse it. */
  hostileIds?: boolean;
  /** Names and labels that start with a formula character. */
  formulaNames?: boolean;
  /** The types probe row is named Basic Extraction and carries an Authorization field. */
  basicNames?: boolean;
  /** T3 answers a body over the injected byte cap; the strains probe declares one in Content-Length. */
  huge?: number;
};

type Call = { path: string; query: URLSearchParams; method: string };

function distinctSandbox(options: Options = {}) {
  const calls: Call[] = [];
  const fetchImpl = (async (input: string, init?: RequestInit) => {
    const url = new URL(String(input));
    calls.push({ path: url.pathname, query: url.searchParams, method: init?.method ?? "GET" });
    const path = url.pathname;
    const forced = options.status?.[path];
    if (forced != null) return new Response(JSON.stringify({ Message: `forced ${forced}` }), { status: forced });
    if (path === "/facilities/v2") return new Response(JSON.stringify(options.facilities ?? (await facilitiesBody())), { status: 200 });
    if (options.narrowWindows && (path === "/transfers/v2/incoming" || path === "/transfers/v2/outgoing")) {
      const start = Date.parse(url.searchParams.get("lastModifiedStart") ?? "");
      const end = Date.parse(url.searchParams.get("lastModifiedEnd") ?? "");
      if (end - start > 86_400_000) return new Response(JSON.stringify([{ row: 0, message: "The window is too wide." }]), { status: 400 });
    }
    if (options.echoEncoded && path === "/transfers/v2/rejected") {
      const message = `bad ${QUOTE_KEY} ${SLASH_KEY} ${encodeURIComponent(TOKEN2)} ${encodeURIComponent(`Basic ${TOKEN2}`)}`;
      return new Response(JSON.stringify([{ row: 0, message }]), { status: 400 });
    }
    if (options.huge && path === "/transfers/v2/rejected") {
      return new Response(JSON.stringify({ Data: [{ Id: ID.rejected, Note: "x".repeat(options.huge + 1) }], TotalRecords: 1 }), { status: 200 });
    }
    const list = LIST[path];
    if (list) {
      let body = await fixture(list.name);
      if (list.base != null) body = twoRows(body, list.base);
      if (options.manyTypes && path === "/locations/v2/types") {
        const rows = rowsOf(body);
        const first = rows[0];
        rows.length = 0;
        for (let i = 1; i <= 7; i++) rows.push({ ...first, Id: i, Name: `Type ${i}` });
        (body as Row).TotalRecords = 7;
      }
      if (options.echoNeverStored && path === "/locations/v2/types") {
        rowsOf(body).unshift({ Id: 9, Name: "echo", FacilityId: 4242, License: { Number: GROW, EmployeeLicenseNumber: EMPLOYEE_SECRET } });
      }
      if (options.echoEncoded && path === "/locations/v2/types") {
        rowsOf(body).unshift({
          Id: 9,
          Name: "echo",
          Quote: QUOTE_KEY,
          Slash: SLASH_KEY,
          Tok: TOKEN2,
          Enc: encodeURIComponent(TOKEN2),
          Header: encodeURIComponent(`Basic ${TOKEN2}`),
        });
      }
      if (options.basicNames && path === "/locations/v2/types") {
        rowsOf(body).unshift({ Id: 9, Name: "Basic Extraction", Type: "Basic Trimming", Authorization: "Basic abcdefghijkl", Next: 1 });
      }
      if (options.hostileIds) {
        const first = rowsOf(body)[0];
        if (path === "/locations/v2/active") first.Id = "..";
        if (path === "/strains/v2/active") first.Id = ".";
        if (path === "/items/v2/active") first.Id = "1/../../facilities";
        if (path === "/transfers/v2/incoming") first.Id = "../../facilities";
        if (path === "/transfers/v2/outgoing") first.Id = "a b";
      }
      const headers: Record<string, string> = {};
      if (options.huge && path === "/strains/v2/active") headers["content-length"] = String(options.huge * 10);
      return new Response(JSON.stringify(body), { status: 200, headers });
    }
    const hit = BY_ID.find((entry) => entry.re.test(path));
    if (!hit) return new Response(JSON.stringify({ Message: "no such path" }), { status: 404 });
    const asked = Number((path.match(hit.re) as RegExpMatchArray)[1]);
    // With hostile Ids the rejected transfer is the only usable one, so its deliveries answer too.
    const known = asked === hit.id || (options.hostileIds === true && hit.name === "GET_transfers_v2_id_deliveries" && asked === ID.rejected);
    if (!known) return new Response(JSON.stringify({ Message: `no record ${asked}` }), { status: 404 });
    let body = await fixture(hit.name);
    if (hit.list != null) body = twoRows(body, hit.list);
    else (body as Row).Id = hit.id;
    if (options.bigLocation && hit.name === "GET_locations_v2_id") (body as Row).Note = "x".repeat(25_000);
    if (options.echoNeverStored && hit.name === "GET_locations_v2_id") {
      (body as Row).FacilityId = 4242;
      (body as Row).License = { Number: GROW, EmployeeLicenseNumber: EMPLOYEE_SECRET };
    }
    if (options.echoEncoded && hit.name === "GET_locations_v2_id") {
      (body as Row).Note = `${QUOTE_KEY} ${SLASH_KEY} ${TOKEN2} ${encodeURIComponent(TOKEN2)}`;
    }
    if (options.hostileIds && hit.name === "GET_transfers_v2_id_deliveries") rowsOf(body)[0].Id = "..";
    if (options.formulaNames) {
      if (hit.name === "GET_locations_v2_id") (body as Row).Name = FORMULA_NAME;
      if (hit.name === "GET_strains_v2_id") (body as Row).Name = "-OG Kush";
      if (hit.name === "GET_items_v2_id") (body as Row).Name = "@home";
      if (hit.name === "GET_transfers_v2_deliveries_id_packages") rowsOf(body)[0].PackageLabel = "+1+1";
    }
    return new Response(JSON.stringify(body), { status: 200 });
  }) as typeof fetch;
  return { calls, fetchImpl };
}

async function runWith(m: MigratedDb, options: Options = {}, over: Record<string, string> = {}, deps: EvalDeps = {}) {
  const sandbox = distinctSandbox(options);
  const result = await runEval(
    { DB: m.db, ...FAKE, METRC_API_BASE: SANDBOX, ...over },
    { fetchImpl: sandbox.fetchImpl, now: () => NOW, sleep: async () => undefined, ...deps }
  );
  return { ...sandbox, result, pack: result.run ? packOf(result.run) : null };
}

function step(pack: EvalPack, license: string, nn: string, name: string): StepRecord {
  const tab = pack.tabs.find((entry) => entry.license === license && entry.nn === nn);
  const hit = tab?.steps.find((entry) => entry.step === name);
  if (!hit) throw new Error(`no ${name} on tab ${nn} for ${license}`);
  return hit;
}

function envOf(m: MigratedDb, extra: Record<string, string> = {}): Env {
  return {
    DB: m.db,
    THEME: "grip",
    ASSETS: { fetch: () => Promise.resolve(new Response("no", { status: 404 })) },
    METRC_API_BASE: SANDBOX,
    ...extra,
  } as unknown as Env;
}

const WINDOW = "lastModifiedStart=2026-09-08T10%3A00%3A00Z&lastModifiedEnd=2026-10-08T10%3A00%3A00Z";

describe("MA1 Phase E1 review: the chain, the paths and the parameters", () => {
  it("chains distinct Ids: T4 from T1's first row, T5 and T6 from T4's first delivery, TT3 from the templates probe, each by-id step from its own probe", async () => {
    const m = await migratedDb();
    const { pack, result } = await runWith(m);
    expect(result.code).toBe("ok");
    const p = pack as EvalPack;
    expect(step(p, GROW, "05", "Step 3").request_url).toBe(`/locations/v2/${ID.location}?licenseNumber=${GROW}`);
    expect(step(p, GROW, "06", "Step 3").request_url).toBe(`/strains/v2/${ID.strain}?licenseNumber=${GROW}`);
    expect(step(p, GROW, "07", "Step 3").request_url).toBe(`/items/v2/${ID.item}?licenseNumber=${GROW}`);
    expect(step(p, GROW, "20", "Step 1").columns["ID Number "]).toBe(String(ID.incoming));
    expect(step(p, GROW, "20", "Step 4").request_url).toBe(`/transfers/v2/${ID.incoming}/deliveries?pageNumber=1&pageSize=50`);
    expect(step(p, GROW, "20", "Step 4").columns["ID Number "]).toBe(String(ID.delivery));
    expect(step(p, GROW, "20", "Step 5").request_url).toBe(`/transfers/v2/deliveries/${ID.delivery}/packages?pageNumber=1&pageSize=50`);
    expect(step(p, GROW, "20", "Step 6").request_url).toBe(`/transfers/v2/deliveries/${ID.delivery}/packages/wholesale?pageNumber=1&pageSize=50`);
    expect(step(p, GROW, "21", "Step 3").request_url).toBe(`/transfers/v2/templates/outgoing/${ID.template}/deliveries?pageNumber=1&pageSize=50`);
    for (const key of ["Step 4", "Step 5", "Step 6"]) expect(step(p, GROW, "20", key).status).toMatch(/^done 200/);
    expect(step(p, GROW, "21", "Step 3").status).toBe("done 200 (docs path; existing record, Q6)");
  });

  it("sends each list step to its own documented path with only the parameters its docs file lists", async () => {
    const m = await migratedDb();
    const { pack, calls } = await runWith(m);
    const p = pack as EvalPack;
    expect(step(p, GROW, "20", "Step 1").request_url).toBe(`/transfers/v2/incoming?licenseNumber=${GROW}&${WINDOW}&pageNumber=1&pageSize=50`);
    expect(step(p, GROW, "20", "Step 2").request_url).toBe(`/transfers/v2/outgoing?licenseNumber=${GROW}&${WINDOW}&pageNumber=1&pageSize=50`);
    expect(step(p, GROW, "20", "Step 3").request_url).toBe(`/transfers/v2/rejected?licenseNumber=${GROW}&pageNumber=1&pageSize=50`);
    expect(step(p, GROW, "21", "Step 2").request_url).toBe(`/transfers/v2/templates/outgoing?licenseNumber=${GROW}&${WINDOW}&pageNumber=1&pageSize=50`);
    expect(step(p, GROW, "22", "Step 2").request_url).toBe(`/transfers/v2/incoming?licenseNumber=${GROW}&${WINDOW}&pageNumber=1&pageSize=50`);
    // The documented parameter set per path: probes from EVAL_PROBES, steps from their docs files.
    const allowed = new Map<string, Set<string>>();
    for (const probe of EVAL_PROBES) {
      allowed.set(probe.path, new Set([...(probe.license ? ["licenseNumber"] : []), ...(probe.paged ? ["pageNumber", "pageSize"] : [])]));
    }
    const windowed = new Set(["licenseNumber", "lastModifiedStart", "lastModifiedEnd", "pageNumber", "pageSize"]);
    allowed.set("/transfers/v2/incoming", windowed);
    allowed.set("/transfers/v2/outgoing", windowed);
    allowed.set("/transfers/v2/templates/outgoing", windowed);
    allowed.set("/transfers/v2/rejected", new Set(["licenseNumber", "pageNumber", "pageSize"]));
    allowed.set("/facilities/v2", new Set());
    const paged = new Set(["pageNumber", "pageSize"]);
    const byId = new Set(["licenseNumber"]);
    for (const call of calls) {
      expect(call.method).toBe("GET");
      let set = allowed.get(call.path);
      if (!set) set = /\/(deliveries|packages|wholesale)$/.test(call.path) ? paged : byId;
      for (const key of call.query.keys()) expect(set.has(key), `${call.path} sent ${key}`).toBe(true);
    }
    // Every E1 step's path_sent is a documented path: it is the row's docs file in lowercase path form.
    for (const tab of EVAL_TABS) for (const def of tab.steps) if (def.phase === "E1") expect(def.path_sent, def.step).toMatch(/^\/[a-z]/);
  });

  it("runs the probes before the steps and the steps in the eval_steps 2.11 order", async () => {
    const m = await migratedDb();
    const { pack } = await runWith(m);
    const p = pack as EvalPack;
    expect(p.run_order[0]).toBe("P0");
    const firstProcessor = p.run_order.findIndex((entry) => entry.endsWith(` ${PROCESSOR}`));
    const grow = p.run_order.slice(1, firstProcessor);
    const probes = grow.filter((entry) => entry.startsWith("probe "));
    const steps = grow.filter((entry) => !entry.startsWith("probe "));
    expect(probes.length).toBe(EVAL_PROBES.length);
    expect(grow.slice(0, probes.length)).toEqual(probes);
    expect(steps).toEqual(E1_ORDER.map((key) => `${key} ${GROW}`));
  });

  it("keeps TT2's workbook path as the cell holds it and explains the A29 reading in the note", async () => {
    const m = await migratedDb();
    const { pack } = await runWith(m);
    const tt2 = step(pack as EvalPack, GROW, "21", "Step 2");
    expect(tt2.path_workbook).toBe("GE");
    expect(tt2.status).toBe("done 200 (docs path)");
    expect(tt2.reason).toContain("A15 reads GE");
    expect(tt2.reason).toContain("A29 reads GET /transfers/v2/templates");
    expect(EVAL_TABS.find((tab) => tab.nn === "21")?.steps.find((def) => def.key === "TT2")?.path_workbook).toBe("GE");
  });
});

describe("MA1 Phase E1 review: P0, the facilities and the budget", () => {
  it("treats a 403 at P0 as refused, like a 401", async () => {
    const m = await migratedDb();
    const { result, pack, calls } = await runWith(m, { status: { "/facilities/v2": 403 } });
    expect(result.code).toBe("refused");
    expect(calls.length).toBe(1);
    expect((pack as EvalPack).p0.status).toBe("refused 403");
    expect(m.get(`SELECT status FROM metrc_eval_runs`)).toEqual({ status: "refused" });
  });

  it("lists a facility with neither flag and runs nothing for it", async () => {
    const m = await migratedDb();
    const { result, pack, calls } = await runWith(m, { facilities: await facilitiesBody(true) });
    expect(result.code).toBe("ok");
    const p = pack as EvalPack;
    expect(p.facilities.map((f) => [f.license, f.role])).toEqual([
      [GROW, "grow"],
      [PROCESSOR, "processor"],
      [NEITHER, "none"],
    ]);
    expect(p.probes.some((probe) => probe.license === NEITHER)).toBe(false);
    expect(p.tabs.some((tab) => tab.license === NEITHER)).toBe(false);
    expect(p.run_order.some((entry) => entry.endsWith(NEITHER))).toBe(false);
    expect(calls.length).toBe(60);
  });

  it("does not spend the 400 retry past the budget", async () => {
    const m = await migratedDb();
    // P0 and the 20 probes of the first facility spend 21; T1's first attempt is the 22nd and last.
    m.run(`UPDATE app_config SET value = '22' WHERE key = 'metrc_eval_max_calls'`);
    const { pack, calls } = await runWith(m, { narrowWindows: true });
    expect(calls.length).toBe(22);
    expect(m.get(`SELECT COUNT(*) AS n FROM metrc_api_calls`)).toEqual({ n: 22 });
    const t1 = step(pack as EvalPack, GROW, "20", "Step 1");
    expect(t1.status).toBe("failed 400");
    expect(t1.attempts?.length).toBe(1);
    expect(step(pack as EvalPack, GROW, "20", "Step 2").status).toBe("cannot run: budget");
  });

  it("reads metrc_eval_window_days and metrc_page_size from app_config", async () => {
    const m = await migratedDb();
    m.run(`UPDATE app_config SET value = '7' WHERE key = 'metrc_eval_window_days'`);
    m.run(`UPDATE app_config SET value = '25' WHERE key = 'metrc_page_size'`);
    const { pack } = await runWith(m);
    const p = pack as EvalPack;
    expect(p.meta.config).toEqual({ maxCalls: 150, windowDays: 7, pageSize: 25 });
    expect(step(p, GROW, "20", "Step 1").window).toEqual({ lastModifiedStart: "2026-10-01T10:00:00Z", lastModifiedEnd: "2026-10-08T10:00:00Z" });
    expect(p.probes.find((probe) => probe.path === "/locations/v2/types")?.request_url).toBe(`/locations/v2/types?licenseNumber=${GROW}&pageNumber=1&pageSize=25`);
    expect(step(p, GROW, "20", "Step 3").request_url).toBe(`/transfers/v2/rejected?licenseNumber=${GROW}&pageNumber=1&pageSize=25`);
  });

  it("refuses a list Id that is not usable as a path segment, so no by-id call leaves its documented route", async () => {
    const m = await migratedDb();
    const { pack, calls, result } = await runWith(m, { hostileIds: true });
    expect(result.code).toBe("partial");
    const p = pack as EvalPack;
    // Nothing was sent to a normalised or shortened path.
    for (const call of calls) {
      expect(call.path, call.path).toMatch(/^\/[a-z]+\/v2(\/|$)/);
      expect(call.path).not.toBe("/locations/");
      expect(call.path).not.toBe("/strains/v2/");
      expect(call.path).not.toMatch(/\/facilities\/v2.+/);
    }
    expect(calls.filter((call) => call.path === "/facilities/v2").length).toBe(1);
    const l3 = step(p, GROW, "05", "Step 3");
    expect(l3.status).toBe("cannot run: needs location from Step 1 (POST /locations/v2/)");
    expect(l3.reason).toContain("not usable in a path");
    expect(l3.request_url).toBeNull();
    expect(step(p, GROW, "06", "Step 3").reason).toContain("not usable in a path");
    expect(step(p, GROW, "07", "Step 3").reason).toContain("not usable in a path");
    // T1 and T2 keep their evidence (the Id Metrc answered is in the ID Number cell), T4 takes T3's usable Id.
    expect(step(p, GROW, "20", "Step 1").status).toBe("done 200");
    expect(step(p, GROW, "20", "Step 1").columns["ID Number "]).toBe("../../facilities");
    const t4 = step(p, GROW, "20", "Step 4");
    expect(t4.request_url).toBe(`/transfers/v2/${ID.rejected}/deliveries?pageNumber=1&pageSize=50`);
    expect(t4.license_source).toBe("parent call Step 3");
    const t5 = step(p, GROW, "20", "Step 5");
    expect(t5.status).toBe("cannot run: needs delivery Id from Step 4");
    expect(t5.reason).toContain("not usable in a path");
    expect(step(p, GROW, "20", "Step 6").request_url).toBeNull();
  });
});

describe("MA1 Phase E1 review: what is stored", () => {
  it("drops EmployeeLicenseNumber and FacilityId from every stored body, probe samples included", async () => {
    const m = await migratedDb();
    const { result, pack } = await runWith(m, { echoNeverStored: true });
    const json = result.run?.steps_json as string;
    for (const secret of ["EmployeeLicenseNumber", EMPLOYEE_SECRET, "FacilityId", "4242"]) expect(json.includes(secret), secret).toBe(false);
    const p = pack as EvalPack;
    // The echoed row and the by-id body were stored (minus the two keys), so the filter ran on real content.
    expect(p.probes.find((probe) => probe.license === GROW && probe.path === "/locations/v2/types")?.sample).toContain('"Name":"echo"');
    expect(step(p, GROW, "05", "Step 3").response_body).toContain(`"Number":"${GROW}"`);
  });

  it("caps a stored body at 20,000 characters and flags it truncated, in the row and in the JSON column", async () => {
    const m = await migratedDb();
    const { pack } = await runWith(m, { bigLocation: true });
    const l3 = step(pack as EvalPack, GROW, "05", "Step 3");
    expect(l3.status).toBe("done 200 (existing record, Q6)");
    expect(l3.response_body?.length).toBe(EVAL_BODY_CAP);
    expect(l3.truncated).toBe(true);
    expect(l3.columns[" JSON Body Or Response  ((Minify please))"].length).toBe(EVAL_BODY_CAP);
  });

  it("keeps the first five Ids of a probe and only its first row as the sample", async () => {
    const m = await migratedDb();
    const { pack } = await runWith(m, { manyTypes: true });
    const types = (pack as EvalPack).probes.find((probe) => probe.license === GROW && probe.path === "/locations/v2/types");
    expect(types?.count).toBe(7);
    expect(types?.total_records).toBe(7);
    expect(types?.ids).toEqual(["1", "2", "3", "4", "5"]);
    const sample = JSON.parse(types?.sample as string) as Row;
    expect(sample.Name).toBe("Type 1");
    expect(sample.Data).toBeUndefined();
    expect(JSON.stringify(sample)).not.toContain("Type 2");
  });

  it("measures the steps_json cap in bytes, not characters", async () => {
    const m = await migratedDb();
    const { pack } = await runWith(m);
    const p = pack as EvalPack;
    p.probes[0].sample = "é".repeat(4000);
    const chars = JSON.stringify(p).length;
    const out = capPack(p, chars + 2000);
    expect(p.meta.cuts).toEqual(["probe_bodies"]);
    expect(out.bytes).toBeLessThanOrEqual(chars + 2000);
  });

  it("ends every CSV row with CRLF", async () => {
    const m = await migratedDb();
    const { pack } = await runWith(m);
    const p = pack as EvalPack;
    const name = packFileNames(p)[0];
    const body = evalCsvFile(p, name)?.body as string;
    expect(body.endsWith("\r\n")).toBe(true);
    expect(body.replace(/\r\n/g, "").includes("\n")).toBe(false);
    expect(body.split("\r\n").length).toBe(1 + 3 + 1);
  });

  it("keeps vendor text that merely starts with Basic, and blanks an Authorization value while the body stays JSON", async () => {
    expect(scrubLong('{"Name":"Basic Extraction","Type":"Basic Trimming"}', ["fake-vendor-key"])).toBe('{"Name":"Basic Extraction","Type":"Basic Trimming"}');
    const token = `${"QWJj".repeat(12)}==`;
    expect(scrubLong(`x Basic ${token} y`, [])).toBe("x Basic [key] y");
    const blanked = scrubLong('{"Id":9,"Authorization":"Basic abcdefghijkl","Next":1}', []);
    expect(blanked).not.toContain("Authorization");
    expect(blanked).not.toContain("abcdefghijkl");
    expect(JSON.parse(blanked)).toMatchObject({ Id: 9, Next: 1 });
    expect(scrubLong("Authorization: Basic abcdefghijkl end", [])).toBe("[authorization]: [authorization] end");
    expect(JSON.parse(scrubLong(JSON.stringify({ Note: "Authorization: Basic abcdefghijkl" }), []))).toEqual({ Note: "[authorization]: [authorization]" });
    expect(scrubLong('{"AuthorizationNumber":"12"}', [])).toBe('{"AuthorizationNumber":"12"}');
    // Through the run: the stored sample is the vendor's text, and the JSON column of a row holding such a field still parses.
    const m = await migratedDb();
    const { pack, result } = await runWith(m, { basicNames: true });
    const types = (pack as EvalPack).probes.find((probe) => probe.license === GROW && probe.path === "/locations/v2/types");
    expect(JSON.parse(types?.sample as string)).toMatchObject({ Id: 9, Name: "Basic Extraction", Type: "Basic Trimming", Next: 1 });
    expect(result.run?.steps_json).not.toContain("Authorization");
    expect(result.run?.steps_json).not.toContain("abcdefghijkl");
  });

  it("scrubs the JSON-escaped and URL-encoded spellings of a key and of the Basic header", async () => {
    const spellings = scrubSpellings([QUOTE_KEY, SLASH_KEY, TOKEN2]);
    expect(spellings).toContain('fake-vendor\\"quote-key');
    expect(spellings).toContain("fake-user\\\\slash-key");
    expect(spellings).toContain("fake-vendor%22quote-key");
    expect(spellings).toContain(encodeURIComponent(TOKEN2));
    expect(spellings).toContain(encodeURIComponent(`Basic ${TOKEN2}`));
    expect(scrubSpellings(["", "ab"])).toEqual([]);
    const m = await migratedDb();
    const { result, pack } = await runWith(m, { echoEncoded: true }, { METRC_INTEGRATOR_KEY: QUOTE_KEY, METRC_USER_KEY: SLASH_KEY });
    const json = result.run?.steps_json as string;
    for (const secret of ["quote-key", "slash-key", TOKEN2, encodeURIComponent(TOKEN2), "Basic%20"]) expect(json.includes(secret), secret).toBe(false);
    const p = pack as EvalPack;
    expect(p.probes.find((probe) => probe.license === GROW && probe.path === "/locations/v2/types")?.sample).toContain('"Name":"echo"');
    expect(step(p, GROW, "05", "Step 3").response_body).toContain("[key]");
    const t3 = step(p, GROW, "20", "Step 3");
    expect(t3.status).toBe("failed 400");
    expect(t3.reason).toContain("bad [key]");
  });

  it("stops reading a response past the byte cap and records the call as failed 0, the run going on", async () => {
    const m = await migratedDb();
    // 20,000 bytes: every docs fixture minifies below it, the forced T3 body and the strains Content-Length do not.
    const { pack, result } = await runWith(m, { huge: 20_000 }, {}, { responseBytesCap: 20_000 });
    expect(result.code).toBe("partial");
    const p = pack as EvalPack;
    const t3 = step(p, GROW, "20", "Step 3");
    expect(t3.status).toBe("failed 0");
    expect(t3.reason).toContain("over 20000 bytes");
    expect(t3.response_body).toBeNull();
    const strains = p.probes.find((probe) => probe.license === GROW && probe.path === "/strains/v2/active");
    expect(strains?.status).toBe("failed 0");
    expect(step(p, GROW, "06", "Step 3").status).toBe("cannot run: needs strain from Step 1 (POST /strains/v2/)");
    expect(step(p, GROW, "20", "Step 4").request_url).toBe(`/transfers/v2/${ID.incoming}/deliveries?pageNumber=1&pageSize=50`);
    expect(step(p, PROCESSOR, "20", "Step 3").status).toBe("failed 0");
    expect(m.get(`SELECT COUNT(*) AS n FROM metrc_api_calls WHERE status = 0`)).toEqual({ n: 4 });
  });

  it("caps the pack with a third cut that blanks every body, then drops the pack and reads failed when that is not enough", async () => {
    const m = await migratedDb();
    const { pack } = await runWith(m);
    const base = JSON.stringify(pack);
    const encoder = new TextEncoder();
    // The size after the three cuts, measured by hand.
    const bare = JSON.parse(base) as EvalPack;
    for (const probe of bare.probes) probe.sample = null;
    for (const tab of bare.tabs) {
      for (const entry of tab.steps) {
        if (entry.response_body) {
          entry.response_body = "";
          entry.truncated = true;
        }
        for (const header of [" JSON Body Or Response  (Minify please)", " JSON Body Or Response  ((Minify please))"]) if (entry.columns[header]) entry.columns[header] = "";
      }
    }
    bare.meta.cuts = ["probe_bodies", `response_bodies_${EVAL_BODY_CUT}`, "response_bodies_0"];
    const bareBytes = encoder.encode(JSON.stringify(bare)).length;
    const three = JSON.parse(base) as EvalPack;
    const out = capPack(three, bareBytes + 10);
    expect(three.meta.cuts).toEqual(["probe_bodies", `response_bodies_${EVAL_BODY_CUT}`, "response_bodies_0"]);
    expect(out.bytes).toBeLessThanOrEqual(bareBytes + 10);
    expect(three.tabs.length).toBe(16);
    expect(three.tabs.flatMap((tab) => tab.steps).filter((entry) => entry.phase === "E1").every((entry) => entry.response_body === "" && entry.truncated)).toBe(true);
    expect(three.tabs.flatMap((tab) => tab.steps).every((entry) => Object.values(entry.columns).every((cell) => cell.length <= 400))).toBe(true);
    expect(three.meta.status).toBe("ok");
    const four = JSON.parse(base) as EvalPack;
    const dropped = capPack(four, 10);
    expect(four.meta.cuts).toEqual(["probe_bodies", `response_bodies_${EVAL_BODY_CUT}`, "response_bodies_0", "pack_dropped"]);
    expect(four.meta.status).toBe("failed");
    expect(four.tabs).toEqual([]);
    expect(four.probes).toEqual([]);
    expect(four.run_order).toEqual([]);
    expect(four.meta.files).toEqual(["metrc_eval_20261008T1000Z.json"]);
    expect(four.facilities.length).toBe(2);
    expect(four.p0.status).toBe("done 200");
    expect(dropped.bytes).toBeLessThan(2000);
    // Through the run: an injected cap no pack can meet stores a failed run instead of losing it.
    const m2 = await migratedDb();
    const { result } = await runWith(m2, {}, {}, { stepsJsonCap: 2000 });
    expect(result.code).toBe("failed");
    expect(result.run?.bytes).toBeLessThanOrEqual(2000);
    expect(m2.get(`SELECT status, bytes FROM metrc_eval_runs`)).toEqual({ status: "failed", bytes: result.run?.bytes });
    const stored = packOf(result.run as NonNullable<typeof result.run>);
    expect(stored.meta.cuts).toContain("pack_dropped");
    expect(stored.meta.calls).toBe(60);
    expect(evalCsvFile(stored, "metrc_eval_20261008T1000Z_403-X0001_05_Locations.csv")).toBeNull();
  });
});

describe("MA1 Phase E1 review: the pack files", () => {
  it("keeps pack file names distinct across facilities whose licenses differ only in punctuation, and caps a long license", async () => {
    const m = await migratedDb();
    const long = `9${"A".repeat(EVAL_FILE_LICENSE_CAP + 40)}`;
    const { pack } = await runWith(m, { facilities: await facilitiesBody(false, ["123/ABC", "123 ABC"]) });
    const p = pack as EvalPack;
    expect(p.facilities.map((f) => [f.license, f.role])).toEqual([
      ["123/ABC", "grow"],
      ["123 ABC", "grow_processor"],
    ]);
    const names = packFileNames(p);
    expect(names.length).toBe(20 + 1);
    expect(new Set(names).size).toBe(names.length);
    expect(names[0]).toBe("metrc_eval_20261008T1000Z_123_ABC_05_Locations.csv");
    expect(names[10]).toBe("metrc_eval_20261008T1000Z_123_ABC-2_05_Locations.csv");
    expect(p.meta.files).toEqual(names);
    const second = parseCsv(evalCsvFile(p, names[10])?.body as string);
    expect(second[3].slice(0, 4)).toEqual(["Step 3", "B13", "200", "123 ABC"]);
    const first = parseCsv(evalCsvFile(p, names[0])?.body as string);
    expect(first[3][3]).toBe("123/ABC");
    const m2 = await migratedDb();
    const longRun = await runWith(m2, { facilities: await facilitiesBody(false, [long, GROW]) });
    const longNames = packFileNames(longRun.pack as EvalPack);
    expect(longNames[0]).toBe(`metrc_eval_20261008T1000Z_${long.slice(0, EVAL_FILE_LICENSE_CAP)}_05_Locations.csv`);
    expect(new Set(longNames).size).toBe(longNames.length);
  });

  it("guards a CSV cell that starts with a formula character and leaves every other cell as it is", async () => {
    const m = await migratedDb();
    const { pack } = await runWith(m, { formulaNames: true });
    const p = pack as EvalPack;
    const names = packFileNames(p);
    const locations = parseCsv(evalCsvFile(p, names[0])?.body as string);
    expect(locations[3][5]).toBe(`'${FORMULA_NAME}`);
    expect(locations[3][7].startsWith("{")).toBe(true);
    expect(JSON.parse(locations[3][7])).toMatchObject({ Name: FORMULA_NAME });
    const strains = parseCsv(evalCsvFile(p, names[1])?.body as string);
    expect(strains[3][5]).toBe("'-OG Kush");
    const items = parseCsv(evalCsvFile(p, names[2])?.body as string);
    expect(items[3][5]).toBe("'@home");
    const transfers = parseCsv(evalCsvFile(p, names[7])?.body as string);
    expect(transfers[5][6]).toBe("'+1+1");
    expect(transfers[5].slice(0, 4)).toEqual(["Step 5", "B21", "200", GROW]);
    for (const row of [...locations, ...transfers]) for (const cell of row) expect(cell).not.toMatch(/^[=+\-@]/);
    expect(step(p, GROW, "05", "Step 3").columns["location Name Created  "]).toBe(FORMULA_NAME);
  });
});

describe("MA1 Phase E1 review: the Admin page, its routes, its words", () => {
  it("shows the facilities of this host's latest run and lists at most ten runs", async () => {
    const m = await migratedDb();
    const { result } = await runWith(m);
    const other = JSON.stringify({ meta: { files: [] }, facilities: [{ license: "999-OTHER", license_type: null, can_grow_plants: 1, can_record_processing_jobs: 0, can_track_vegetative_plants: 0, role: "grow" }] });
    const insert = (id: string, host: string, started: string) =>
      m.run(
        `INSERT INTO metrc_eval_runs (id, host, phase, started_at, finished_at, status, calls, steps_json, bytes, created_at, updated_at) VALUES (?, ?, 'E1', ?, ?, 'ok', 0, ?, ?, ?, ?)`,
        id,
        host,
        started,
        started,
        other,
        other.length,
        started,
        started
      );
    insert("later-production", "api-mi.metrc.com", "2026-10-09T10:00:00.000Z");
    const data = await loadMetrcEvalAdmin({ DB: m.db, ...FAKE, METRC_API_BASE: SANDBOX });
    expect(data.facilities.map((f) => f.license)).toEqual([GROW, PROCESSOR]);
    expect(data.runs.length).toBe(2);
    expect(data.runs[1].id).toBe(result.run?.id);
    for (let i = 0; i < 12; i++) insert(`more-${i}`, "sandbox-api-mi.metrc.com", `2026-10-10T10:${String(i).padStart(2, "0")}:00.000Z`);
    const again = await loadMetrcEvalAdmin({ DB: m.db, ...FAKE, METRC_API_BASE: SANDBOX });
    expect(again.runs.length).toBe(EVAL_RUNS_LISTED);
    expect(again.runs[0].id).toBe("more-11");
  });

  it("serves the page, the run and the pack files through the Admin routes behind the PIN", async () => {
    const m = await migratedDb();
    expect((await app.request("/admin/metrc-eval", {}, envOf(m))).status).toBe(401);
    const page = await app.request("/admin/metrc-eval", { headers: PIN }, envOf(m));
    expect(page.status).toBe(200);
    const text = await page.text();
    expect(text).toContain('data-metrc-eval-active="yes"');
    expect(text).toContain("data-metrc-eval-run disabled");
    // Keys absent: the POST answers absent and makes no call.
    const absent = await app.request("/admin/metrc-eval/run", { method: "POST", headers: PIN }, envOf(m));
    expect(absent.status).toBe(303);
    expect(absent.headers.get("location")).toBe("/admin/metrc-eval?ok=absent");
    // A production host with keys present: the POST answers host and makes no call.
    const host = await app.request("/admin/metrc-eval/run", { method: "POST", headers: PIN }, envOf(m, { ...FAKE, METRC_API_BASE: PRODUCTION }));
    expect(host.status).toBe(303);
    expect(host.headers.get("location")).toBe("/admin/metrc-eval?ok=host");
    expect(m.get(`SELECT COUNT(*) AS n FROM metrc_api_calls`)).toEqual({ n: 0 });
    expect(m.get(`SELECT COUNT(*) AS n FROM metrc_eval_runs`)).toEqual({ n: 0 });
    // A run made on the fake sandbox, then its files through the routes.
    const { result, pack } = await runWith(m);
    const id = result.run?.id as string;
    const names = packFileNames(pack as EvalPack);
    const json = await app.request(`/admin/metrc-eval/runs/${id}/json`, { headers: PIN }, envOf(m));
    expect(json.status).toBe(200);
    expect(json.headers.get("content-type")).toContain("application/json");
    expect(json.headers.get("content-disposition")).toBe('attachment; filename="metrc_eval_20261008T1000Z.json"');
    expect((JSON.parse(await json.text()) as EvalPack).meta.phase).toBe("E1");
    expect((await app.request(`/admin/metrc-eval/runs/${id}/json`, {}, envOf(m))).status).toBe(401);
    const strains = await app.request(`/admin/metrc-eval/runs/${id}/csv/${names[1]}`, { headers: PIN }, envOf(m));
    expect(strains.status).toBe(200);
    expect(strains.headers.get("content-type")).toContain("text/csv");
    expect(strains.headers.get("content-disposition")).toBe(`attachment; filename="${names[1]}"`);
    expect((await strains.text()).split("\r\n")[0]).toContain("Strain Name Created  ");
    expect((await app.request(`/admin/metrc-eval/runs/${id}/csv/nope.csv`, { headers: PIN }, envOf(m))).status).toBe(404);
    expect((await app.request(`/admin/metrc-eval/runs/${id}/csv/${names[16]}`, { headers: PIN }, envOf(m))).status).toBe(404);
    expect((await app.request(`/admin/metrc-eval/runs/no-such-run/json`, { headers: PIN }, envOf(m))).status).toBe(404);
    const listed = await app.request("/admin/metrc-eval?ok=ok", { headers: PIN }, envOf(m));
    expect(await listed.text()).toContain(`href="/admin/metrc-eval/runs/${id}/csv/${names[1]}"`);
  });

  it("renders no flash for an ?ok= value that is not a run code, prototype members included", async () => {
    const m = await migratedDb();
    const data = await loadMetrcEvalAdmin({ DB: m.db, ...FAKE, METRC_API_BASE: SANDBOX });
    for (const code of ["constructor", "__proto__", "toString", "hasOwnProperty", "valueOf", "nope"]) {
      const html = metrcEvalPage(data, "en", code);
      expect(html, code).not.toContain("data-metrc-eval-flash");
      expect(html, code).not.toContain("native code");
      expect(html, code).not.toContain("[object Object]");
    }
    expect(metrcEvalPage(data, "en", "partial")).toContain('data-metrc-eval-flash="partial"');
    const page = await app.request("/admin/metrc-eval?ok=constructor", { headers: PIN }, envOf(m));
    expect(await page.text()).not.toContain("native code");
  });

  it("gives every element of the page a native title, the pack links included, and names the Law 9 lookup path", async () => {
    const m = await migratedDb();
    await runWith(m);
    const data = await loadMetrcEvalAdmin({ DB: m.db, ...FAKE, METRC_API_BASE: SANDBOX });
    for (const locale of ["en", "es"] as const) {
      const html = metrcEvalPage(data, locale, "ok");
      const tags = html.match(/<([a-z][a-z0-9]*)\b[^>]*>/g) ?? [];
      expect(tags.length).toBeGreaterThan(30);
      for (const tag of tags) expect(tag, tag).toContain(' title="');
      const links = html.match(/<a\b[^>]*>/g) ?? [];
      expect(links.length).toBe(17);
      expect(html).toContain(LOOKUP_PATH);
      expect(html).not.toContain("Admin Settings");
    }
    const inactive = metrcEvalPage({ ...data, active: false }, "en", null);
    for (const tag of inactive.match(/<([a-z][a-z0-9]*)\b[^>]*>/g) ?? []) expect(tag, tag).toContain(' title="');
  });

  it("keeps the Data Connections back link and translates every page sentence", () => {
    expect(backLinkFor("/admin/metrc-eval")).toEqual({ href: "/admin/data-connections", label: "Data Connections" });
    for (const key of EVAL_PAGE_STRINGS) {
      if (key === "Grow" || key === "Processor") continue;
      expect(DICT[key], key).toBeDefined();
      expect(DICT[key].es, key).not.toBe(DICT[key].en);
    }
  });
});
