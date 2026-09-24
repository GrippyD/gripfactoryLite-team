import { describe, expect, it } from "vitest";
import { app } from "../src/index";
import { ACCESS_EMAIL_HEADER, DEV_FALLBACK_EMAIL } from "../src/identity";
import {
  ACCESS_FRONTED_VAR,
  SERVICE_IDENTITY,
  SERVICE_REFUSAL,
  SERVICE_ROUTES,
  isAccessFronted,
  isServiceRoute,
  loginEmailOf,
} from "../src/service";

/** A D1 stand-in that knows one person (dev@local), the Admin PIN and nothing else;
 * every other read answers no rows, every write records that it happened. */
function makeDb() {
  const people = [{ id: "p-dev", display_name: "dev", email: "dev@local", is_active: 1, deleted_at: null as string | null }];
  const config: Record<string, string> = { admin_pin: "21319" };
  const writes: string[] = [];
  function norm(sql: string) {
    return sql.replace(/\s+/g, " ").trim().toLowerCase();
  }
  function exec(sql: string, args: unknown[]) {
    const q = norm(sql);
    if (q.startsWith("insert") || q.startsWith("update") || q.startsWith("delete")) {
      writes.push(q.slice(0, 60));
      return [];
    }
    if (q.includes("from people") && q.includes("lower(email)")) {
      const email = String(args[0] ?? "");
      return people.find((p) => p.email === email && !p.deleted_at) ?? null;
    }
    if (q.includes("from people") && q.includes("is_active = 1")) {
      return people.map((p) => ({ id: p.id, display_name: p.display_name, is_active: p.is_active }));
    }
    if (q.includes("from app_config") && q.includes("where key")) {
      const value = config[String(args[0])];
      return value != null ? { value } : null;
    }
    return [];
  }
  function stmt(sql: string) {
    const args: unknown[] = [];
    const self = {
      bind(...next: unknown[]) {
        args.push(...next);
        return self;
      },
      async first() {
        const r = exec(sql, args);
        return Array.isArray(r) ? (r[0] ?? null) : r;
      },
      async all() {
        const r = exec(sql, args);
        return { results: Array.isArray(r) ? r : r ? [r] : [] };
      },
      async run() {
        exec(sql, args);
        return { success: true };
      },
    };
    return self;
  }
  return {
    writes,
    people,
    prepare: (sql: string) => stmt(sql),
    async batch(stmts: { run: () => Promise<unknown> }[]) {
      for (const s of stmts) await s.run();
    },
  };
}

function envOf(db: ReturnType<typeof makeDb>, fronted: boolean): Env {
  const env = {
    DB: db as unknown as D1Database,
    THEME: "grip" as const,
    ASSETS: { fetch: () => Promise.resolve(new Response("ok", { status: 200 })) } as unknown as Env["ASSETS"],
  };
  if (fronted) (env as unknown as Record<string, string>)[ACCESS_FRONTED_VAR] = "1";
  return env as Env;
}

describe("THE SERVICE ACTOR (canon 0.30.140; Corey's agent: \"read only. A GET route only, no write scope anywhere\"; his pick: build the guard)", () => {
  it("names the var, the fixed identity, the doors and the refusal", () => {
    expect(ACCESS_FRONTED_VAR).toBe("ACCESS_FRONTED");
    expect(SERVICE_IDENTITY).toEqual({ id: "service-token", display_name: "Service token", email: "service@access" });
    expect(SERVICE_ROUTES.exact).toEqual(["/ops/drying_ops", "/silos/live.json"]);
    expect(SERVICE_ROUTES.prefixes).toEqual(["/feeds/"]);
    expect(SERVICE_ROUTES.post).toEqual(["/sensors/readings"]);
    expect(SERVICE_REFUSAL).toBe(
      "This service token reads /ops/drying_ops, /feeds and /silos/live.json, and may POST /sensors/readings; nothing else answers it."
    );
    expect(isAccessFronted({ ACCESS_FRONTED: "1" })).toBe(true);
    expect(isAccessFronted({ ACCESS_FRONTED: "true" })).toBe(true);
    expect(isAccessFronted({ ACCESS_FRONTED: "0" })).toBe(false);
    expect(isAccessFronted({})).toBe(false);
    expect(isAccessFronted(undefined)).toBe(false);
    expect(loginEmailOf("wallace@gripcannabis.com")).toBe("wallace@gripcannabis.com");
    expect(loginEmailOf("  ")).toBeNull();
    expect(loginEmailOf("")).toBeNull();
    expect(loginEmailOf(undefined)).toBeNull();
  });

  it("opens the doors to GET and HEAD alone: the Drying Operations menu, everything under /feeds/, the silo strip's JSON", () => {
    expect(isServiceRoute("GET", "/ops/drying_ops")).toBe(true);
    expect(isServiceRoute("GET", "/ops/drying_ops/")).toBe(true);
    expect(isServiceRoute("HEAD", "/ops/drying_ops")).toBe(true);
    expect(isServiceRoute("GET", "/feeds/trim-weighs.json")).toBe(true);
    expect(isServiceRoute("get", "/silos/live.json")).toBe(true);
    expect(isServiceRoute("POST", "/feeds/trim-weighs.json")).toBe(false);
    expect(isServiceRoute("POST", "/sensors/readings")).toBe(true);
    expect(isServiceRoute("GET", "/sensors/readings")).toBe(false);
    expect(isServiceRoute("GET", "/feeds")).toBe(false);
    expect(isServiceRoute("GET", "/feeds/")).toBe(false);
    expect(isServiceRoute("GET", "/ops/harvest_ops")).toBe(false);
    expect(isServiceRoute("GET", "/ops")).toBe(false);
    expect(isServiceRoute("GET", "/")).toBe(false);
    expect(isServiceRoute("GET", "/admin")).toBe(false);
    expect(isServiceRoute("GET", "/station/trim_packages")).toBe(false);
    expect(isServiceRoute("POST", "/pin")).toBe(false);
    expect(isServiceRoute("GET", "/silos")).toBe(false);
  });

  it("on the Access-fronted worker a request with no login email reads the doors under the fixed identity and births no people row", async () => {
    const db = makeDb();
    const env = envOf(db, true);
    const feed = await app.request("/feeds/trim-weighs.json?limit=5", {}, env);
    expect(feed.status).toBe(200);
    expect(feed.headers.get("content-type") ?? "").toContain("application/json");
    const body = (await feed.json()) as { feed: string; count: number };
    expect(body.feed).toBe("trim_weighs");
    expect(body.count).toBe(0);
    const live = await app.request("/silos/live.json", {}, env);
    expect(live.status).toBe(200);
    const menu = await app.request("/ops/drying_ops", {}, env);
    expect(menu.status).toBe(200);
    expect(await menu.text()).toContain("service@access");
    // An empty email header (the token's JWT carries no email) is no email at all.
    const blank = await app.request("/feeds/trim-weighs.json", { headers: { [ACCESS_EMAIL_HEADER]: "" } }, env);
    expect(blank.status).toBe(200);
    expect(db.writes).toEqual([]);
    expect(db.people).toHaveLength(1);
  });

  it("on the Access-fronted worker a service actor's request for anything else answers 403 in words as JSON, writes included", async () => {
    const db = makeDb();
    const env = envOf(db, true);
    for (const path of ["/", "/admin", "/station/trim_packages", "/ops/harvest_ops", "/reports", "/harvest-console", "/record/wip_packages/x/edit"]) {
      const res = await app.request(path, {}, env);
      expect(res.status, path).toBe(403);
      expect(res.headers.get("cache-control"), path).toBe("no-store");
      expect(await res.json(), path).toEqual({ error: SERVICE_REFUSAL });
    }
    for (const path of ["/pin", "/feeds/trim-weighs.json", "/silos/live.json", "/station/trim_packages"]) {
      const res = await app.request(path, { method: "POST", body: new URLSearchParams({ pin: "21319" }) }, env);
      expect(res.status, path).toBe(403);
      expect(await res.json(), path).toEqual({ error: SERVICE_REFUSAL });
    }
    expect(db.writes).toEqual([]);
  });

  it("admits POST /sensors/readings and still refuses every other write", async () => {
    const db = makeDb();
    const env = envOf(db, true);
    const ok = await app.request(
      "/sensors/readings",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ room: "CSA", temperature_f: 68.2, humidity_pct: 58, read_at: "2026-09-21T15:00:00Z", source: "silo-ops" }),
      },
      env
    );
    expect(ok.status).toBe(200);
    expect(await ok.json()).toEqual({ ok: true, stored: 1 });
    const refused = await app.request("/sensors/readings", { method: "GET" }, env);
    expect(refused.status).toBe(403);
  });

  it("a person's request on the fronted worker, and every request off it, resolve the login identity as before", async () => {
    const db = makeDb();
    const fronted = envOf(db, true);
    const person = await app.request("/", { headers: { [ACCESS_EMAIL_HEADER]: DEV_FALLBACK_EMAIL } }, fronted);
    expect(person.status).toBe(200);
    expect(await person.text()).toContain("dev@local");
    const dev = envOf(db, false);
    const home = await app.request("/", {}, dev);
    expect(home.status).toBe(200);
    expect(await home.text()).toContain("dev@local");
    const gated = await app.request("/admin", {}, dev);
    expect(gated.status).toBe(401);
    const feed = await app.request("/feeds/trim-weighs.json", {}, dev);
    expect(feed.status).toBe(200);
  });
});
