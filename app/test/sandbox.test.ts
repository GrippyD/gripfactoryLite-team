import { afterEach, describe, expect, it, vi } from "vitest";
import { app } from "../src/index";
import {
  OFF_LIVE_STYLE,
  SANDBOX_REFRESH_PATH,
  SANDBOX_STATUS_PATH,
  VENDORED_HEADER,
  localRequest,
  newerCan,
  offLive,
  readStatus,
  sandboxControl,
  withOffLive,
} from "../src/sandbox";
import { DICT } from "../src/i18n";
import { MODEL_TOOLS, modelToolPath } from "../src/config";
import { migratedDb, type MigratedDb } from "./migrated";

const TOKEN = "0123456789abcdef0123456789abcdef";
const CONTROL = `http://127.0.0.1:9911/${TOKEN}`;
const EMAIL = "lead@example.com";

function envOf(m: MigratedDb, extra: Record<string, string> = {}): Env {
  const assets = { fetch: () => Promise.resolve(new Response("no", { status: 404 })) };
  return { DB: m.db, THEME: "grip", ASSETS: assets, ...extra } as unknown as Env;
}

function pinOf(m: MigratedDb): string {
  return String(m.get(`SELECT value FROM app_config WHERE key = 'admin_pin' AND deleted_at IS NULL`)?.value ?? "");
}

async function get(env: Env, path: string, cookie = "") {
  const res = await app.request(path, { headers: { "Cf-Access-Authenticated-User-Email": EMAIL, ...(cookie ? { cookie } : {}) } }, env);
  return { status: res.status, text: await res.text(), res };
}

const STATUS = {
  state: "idle",
  can: { name: "20261112-154026_sandbox_can", dumped_at: "2026-11-12T20:40:26.000Z" },
  newest: { name: "20261117-115853_pre_wb1_can", dumped_at: "2026-11-17T16:58:59.419Z" },
  target: null,
  error: null,
  at: "2026-11-19T15:00:00.000Z",
};

/** The sandbox tool's control server, stubbed: it records each call and answers as the tool does. */
function stubControl(answers: { status?: unknown; refresh?: { status: number; body: unknown } } = {}) {
  const calls: Array<{ url: string; method: string }> = [];
  vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input);
    const method = (init?.method ?? "GET").toUpperCase();
    calls.push({ url, method });
    if (url === `${CONTROL}/status`) return new Response(JSON.stringify(answers.status ?? STATUS), { status: 200 });
    if (url === `${CONTROL}/refresh` && method === "POST") {
      const r = answers.refresh ?? { status: 202, body: { target: STATUS.newest } };
      return new Response(JSON.stringify(r.body), { status: r.status });
    }
    return new Response("not the control", { status: 404 });
  });
  return calls;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("TS2, the team copy", () => {
  it("knows off live only by the default env's OFF_LIVE, and takes the tool's address only in its exact local shape", () => {
    expect(offLive({ OFF_LIVE: "1" })).toBe(true);
    expect(offLive({})).toBe(false);
    expect(offLive({ OFF_LIVE: "0" })).toBe(false);
    expect(sandboxControl({ OFF_LIVE: "1", SANDBOX_CONTROL: CONTROL })).toBe(CONTROL);
    // Live never takes it, whatever is passed.
    expect(sandboxControl({ SANDBOX_CONTROL: CONTROL })).toBeNull();
    for (const bad of [
      `http://localhost:9911/${TOKEN}`,
      `https://127.0.0.1:9911/${TOKEN}`,
      `http://127.0.0.1:9911/short`,
      `http://10.0.0.5:9911/${TOKEN}`,
      `http://127.0.0.1:9911/${TOKEN}/extra`,
      `http://127.0.0.1.evil.example:9911/${TOKEN}`,
    ]) {
      expect(sandboxControl({ OFF_LIVE: "1", SANDBOX_CONTROL: bad }), bad).toBeNull();
    }
  });

  it("puts the off live block last in the head, once, and leaves a page without a head alone", () => {
    const page = "<!DOCTYPE html><html><head><style>x</style></head><body>b</body></html>";
    const once = withOffLive(page);
    expect(once.indexOf(OFF_LIVE_STYLE)).toBe(page.indexOf("</head>"));
    expect(withOffLive(once)).toBe(once);
    expect(withOffLive("<p>fragment</p>")).toBe("<p>fragment</p>");
    expect(OFF_LIVE_STYLE).toContain("#cc5500");
    expect(OFF_LIVE_STYLE).toContain("@media print");
  });

  it("wears the burnt orange ground on every HTML page off live, and never on live or on a non HTML answer", async () => {
    const m = await migratedDb();
    const off = await get(envOf(m, { OFF_LIVE: "1" }), "/");
    expect(off.status).toBe(200);
    expect(off.text).toContain("data-off-live");
    expect(off.text.indexOf("data-off-live")).toBeLessThan(off.text.indexOf("</head>"));
    expect(off.res.headers.get("cache-control")).toBe("no-store");
    expect(off.text).not.toContain("data-sbx-strip");
    const live = await get(envOf(m), "/");
    expect(live.text).not.toContain("data-off-live");
    // A page that is not found still says so, and wears the ground off live.
    const missing = await get(envOf(m, { OFF_LIVE: "1" }), "/no/such/page");
    expect(missing.status).toBe(404);
    // JSON passes through untouched.
    const json = await get(envOf(m, { OFF_LIVE: "1" }), "/admin/whiteboard/notes.json", `gf_pin=${pinOf(m)}`);
    expect(json.res.headers.get("content-type")).toContain("application/json");
    expect(JSON.parse(json.text)).toHaveProperty("notes");
  });

  it("shows the strip and Refresh D1 on the home page only when the sandbox tool runs the copy", async () => {
    const m = await migratedDb();
    const calls = stubControl();
    const home = await get(envOf(m, { OFF_LIVE: "1", SANDBOX_CONTROL: CONTROL }), "/");
    expect(home.text).toContain("data-sbx-strip");
    expect(home.text).toContain(`href="${SANDBOX_REFRESH_PATH}" data-sbx-refresh`);
    expect(home.text).toContain("20261112-154026_sandbox_can (dumped 2026-11-12 20:40 UTC)");
    expect(home.text).toContain("A newer can is in the shared folder: 20261117-115853_pre_wb1_can.");
    expect(calls).toEqual([{ url: `${CONTROL}/status`, method: "GET" }]);
    const es = await get(envOf(m, { OFF_LIVE: "1", SANDBOX_CONTROL: CONTROL }), "/", "gf_locale=es");
    expect(es.text).toContain("Actualizar D1");
    expect(es.text).toContain("Copia local, no es la versión en vivo");
    // On live the address is ignored: no strip, no call out.
    const before = calls.length;
    const live = await get(envOf(m, { SANDBOX_CONTROL: CONTROL }), "/");
    expect(live.text).not.toContain("data-sbx-strip");
    expect(calls.length).toBe(before);
  });

  it("says so in words when the tool does not answer", async () => {
    const m = await migratedDb();
    vi.stubGlobal("fetch", async () => {
      throw new Error("connection refused");
    });
    const home = await get(envOf(m, { OFF_LIVE: "1", SANDBOX_CONTROL: CONTROL }), "/");
    expect(home.text).toContain("The sandbox tool isn't answering.");
    const page = await get(envOf(m, { OFF_LIVE: "1", SANDBOX_CONTROL: CONTROL }), SANDBOX_REFRESH_PATH);
    expect(page.text).toContain("data-sbx-down");
  });

  it("asks before it refreshes, starts the tool's refresh on a JSON post only, and passes the status through", async () => {
    const m = await migratedDb();
    const env = envOf(m, { OFF_LIVE: "1", SANDBOX_CONTROL: CONTROL });
    const calls = stubControl();
    const page = await get(env, SANDBOX_REFRESH_PATH);
    expect(page.status).toBe(200);
    for (const bit of ["data-sbx-page", "data-sbx-go", "data-sbx-now", "data-sbx-newest", "20261117-115853_pre_wb1_can"]) expect(page.text).toContain(bit);
    expect(page.text).not.toContain("data-sbx-same");
    expect(calls.filter((c) => c.method === "POST")).toEqual([]);

    const form = await app.request(SANDBOX_REFRESH_PATH, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: "x=1" }, env);
    expect(form.status).toBe(415);
    expect(calls.filter((c) => c.method === "POST")).toEqual([]);

    const go = await app.request(SANDBOX_REFRESH_PATH, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" }, env);
    expect(go.status).toBe(202);
    expect(await go.json()).toEqual({ ok: true, target: STATUS.newest });
    expect(calls.filter((c) => c.method === "POST")).toEqual([{ url: `${CONTROL}/refresh`, method: "POST" }]);

    const status = await app.request(SANDBOX_STATUS_PATH, {}, env);
    expect(await status.json()).toEqual(STATUS);
  });

  it("answers a refresh already running in the reader's language, and shows a failed one", async () => {
    const m = await migratedDb();
    const env = envOf(m, { OFF_LIVE: "1", SANDBOX_CONTROL: CONTROL });
    stubControl({ refresh: { status: 409, body: { state: "building" } }, status: { ...STATUS, state: "failed", error: "The can is incomplete." } });
    const busy = await app.request(SANDBOX_REFRESH_PATH, { method: "POST", headers: { "content-type": "application/json", cookie: "gf_locale=es" }, body: "{}" }, env);
    expect(busy.status).toBe(409);
    expect(await busy.json()).toEqual({ ok: false, error: "Ya hay una actualización en curso." });
    const page = await get(env, SANDBOX_REFRESH_PATH);
    expect(page.text).toContain("The refresh failed: The can is incomplete. Your data was not changed.");
  });

  it("has no Refresh D1 routes on live, in the smoke or on a plain wrangler dev", async () => {
    const m = await migratedDb();
    stubControl();
    for (const env of [envOf(m), envOf(m, { OFF_LIVE: "1" }), envOf(m, { SANDBOX_CONTROL: CONTROL })]) {
      expect((await get(env, SANDBOX_REFRESH_PATH)).status).toBe(404);
      expect((await get(env, SANDBOX_STATUS_PATH)).status).toBe(404);
      const post = await app.request(SANDBOX_REFRESH_PATH, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" }, env);
      expect(post.status).toBe(404);
    }
  });

  it("answers Refresh D1 only to this copy's own pages: another host or origin (DNS rebinding) is turned away", async () => {
    const m = await migratedDb();
    const env = envOf(m, { OFF_LIVE: "1", SANDBOX_CONTROL: CONTROL });
    const calls = stubControl();
    expect(localRequest("http://localhost:8787/sandbox/refresh-d1", undefined)).toBe(true);
    expect(localRequest("http://127.0.0.1:8787/x", "http://localhost:8787")).toBe(true);
    expect(localRequest("http://[::1]:8787/x", undefined)).toBe(true);
    expect(localRequest("http://evil.example:8787/x", undefined)).toBe(false);
    expect(localRequest("http://localhost:8787/x", "http://evil.example:8787")).toBe(false);
    expect(localRequest("not a url", undefined)).toBe(false);
    const rebound = await app.request("http://evil.example:8787/sandbox/refresh-d1", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" }, env);
    expect(rebound.status).toBe(404);
    const foreign = await app.request(SANDBOX_REFRESH_PATH, { method: "POST", headers: { "content-type": "application/json", origin: "http://evil.example" }, body: "{}" }, env);
    expect(foreign.status).toBe(404);
    expect((await app.request("http://evil.example:8787/sandbox/refresh-d1/status.json", {}, env)).status).toBe(404);
    expect(calls.filter((c) => c.method === "POST")).toEqual([]);
    const own = await app.request(SANDBOX_REFRESH_PATH, { method: "POST", headers: { "content-type": "application/json", origin: "http://localhost:8787" }, body: "{}" }, env);
    expect(own.status).toBe(202);
  });

  it("leaves a vendored page's bytes untouched off live (the vendored pair law), as on live", async () => {
    const m = await migratedDb();
    const tool = MODEL_TOOLS[0];
    const dir = modelToolPath(tool);
    const page = "<!DOCTYPE html><html><head><title>Vendored</title></head><body>v</body></html>";
    const assets = {
      fetch: (req: Request) =>
        Promise.resolve(new URL(req.url).pathname === `${dir}index.html` ? new Response(page, { headers: { "content-type": "text/html" } }) : new Response("no", { status: 404 })),
    };
    const env = { DB: m.db, THEME: "grip", ASSETS: assets, OFF_LIVE: "1" } as unknown as Env;
    const models = String(m.get(`SELECT value FROM app_config WHERE key = 'models_pin' AND deleted_at IS NULL`)?.value ?? "");
    const res = await app.request(dir, { headers: { "Cf-Access-Authenticated-User-Email": EMAIL, cookie: `gf_models_pin=${models}` } }, env);
    expect(res.status).toBe(200);
    expect(res.headers.get(VENDORED_HEADER)).toBe("1");
    expect(await res.text()).toBe(page);
  });

  it("calls a can newer only by when its snapshot was taken, and says so when the folder's newest is older", async () => {
    expect(newerCan({ name: "b", dumped_at: "2026-11-18T12:00:00.000Z" }, { name: "a", dumped_at: "2026-11-12T20:40:26.000Z" })).toBe(true);
    expect(newerCan({ name: "a", dumped_at: "2026-11-12T20:40:26.000Z" }, { name: "b", dumped_at: "2026-11-18T12:00:00.000Z" })).toBe(false);
    expect(newerCan({ name: "a", dumped_at: null }, { name: "b", dumped_at: null })).toBe(true);
    expect(newerCan({ name: "a", dumped_at: "x" }, { name: "a", dumped_at: "x" })).toBe(false);
    const m = await migratedDb();
    const env = envOf(m, { OFF_LIVE: "1", SANDBOX_CONTROL: CONTROL });
    stubControl({ status: { ...STATUS, can: STATUS.newest, newest: STATUS.can } });
    const home = await get(env, "/");
    expect(home.text).not.toContain("A newer can is in the shared folder");
    const page = await get(env, SANDBOX_REFRESH_PATH);
    expect(page.text).toContain("data-sbx-older");
  });

  it("keeps only the status fields the pages use", () => {
    expect(readStatus({ state: "nope" })).toBeNull();
    expect(readStatus(null)).toBeNull();
    const s = readStatus({ ...STATUS, extra: "x", can: { name: "a".repeat(300), dumped_at: null, path: "C:\\Users\\x" } });
    expect(s?.can).toEqual({ name: "a".repeat(200), dumped_at: null });
    expect(s).not.toHaveProperty("extra");
  });

  it("has every word it shows in Spanish, and no dash in either language or in its source", async () => {
    const fs = (await import("node:" + "fs")) as { readFileSync(path: URL, encoding: "utf8"): string };
    const src = fs.readFileSync(new URL("../src/sandbox.ts", import.meta.url), "utf8");
    const keys = new Set<string>([
      ...[...src.matchAll(/\btr\("([^"]+)"\)/g)].map((hit) => hit[1]),
      ...[...src.matchAll(/\bt\(locale, "([^"]+)"\)/g)].map((hit) => hit[1]),
      ...[...src.matchAll(/tFill\(locale, "([^"]+)"/g)].map((hit) => hit[1]),
      ...[...src.slice(src.indexOf("const REFRESH_WORD_KEYS"), src.indexOf("function wordsJson")).matchAll(/^  "([^"]+)",$/gm)].map((hit) => hit[1]),
      "Refresh D1",
      "This button only takes its own requests.",
    ]);
    expect(keys.size).toBeGreaterThan(18);
    const missing = [...keys].filter((k) => !DICT[k] || !DICT[k].es.trim() || DICT[k].es === k);
    expect(missing).toEqual([]);
    const dash = new RegExp("[" + String.fromCharCode(0x2013, 0x2014) + "]");
    for (const k of keys) {
      expect(dash.test(DICT[k].en), k).toBe(false);
      expect(dash.test(DICT[k].es), k).toBe(false);
    }
    expect(dash.test(src)).toBe(false);
  });
});
