import { Hono } from "hono";
import { afterAll, describe, expect, it } from "vitest";
import type { Identity } from "../src/identity";
import { gripcastingApi, handleGripcasting } from "../src/gripcasting/routes";
import { insertStmts } from "../src/gripcasting/queries";
import type { Vol } from "../src/gripcasting/types";
import { migratedDb, type MigratedDb } from "./migrated";

const NOW = "2026-10-13T15:00:00.000Z";
const VOL: Vol = {
  plants: 10, wetPerPlant: 2, dryDown: 0.25, ffWet: 0, shrink: 0, btr: 0.5,
  prepackPct: 0, prepackPrice: 1, bulkPrice: 1,
  lbsPerLiter: 1, carts: 0, gPerCart: 1, cartPrice: 1, literPrice: 1,
  resinYield: 0, resinSplit: 0, resinPrice: 1,
  premLbs: 0, premPrice: 1, premOn: false,
  ghLbs: 0, ghPrice: 1, ghOn: false,
  iprUnits: 0, iprPrice: 1, iprOn: false,
  ibLbs: 0, ibPrice: 1, ibOn: false,
  tps: 0, tpsOn: false,
};

function seedFloor(m: MigratedDb, users: Array<{ email: string; name: string; role: string; active?: number }>) {
  m.run(
    `INSERT INTO gc_harvests (id, code, starts_on, is_current, wages_budget, season, vol_default, created_at, created_by)
     VALUES ('h1', '2026H', '2026-04-01', 1, NULL, '{}', ?, ?, 'test')`,
    JSON.stringify(VOL), NOW
  );
  m.run(
    `INSERT INTO gc_business_units (id, harvest_id, code, name, sort, created_at, created_by)
     VALUES ('bu1', 'h1', '01', '01 Outdoor Grow', 0, ?, 'test')`,
    NOW
  );
  m.run(
    `INSERT INTO gc_gl_accounts (id, harvest_id, name, created_at, created_by)
     VALUES ('gl1', 'h1', '5120 · Nutrients', ?, 'test')`,
    NOW
  );
  m.run(
    `INSERT INTO gc_budget_lines (id, harvest_id, gl, bu, amount, created_at, created_by)
     VALUES ('b1', 'h1', '5120 · Nutrients', '01 Outdoor Grow', 10000, ?, 'test')`,
    NOW
  );
  for (const user of users) {
    m.run(
      `INSERT INTO gc_app_users (id, email, name, role, is_active, created_at, created_by)
       VALUES (?, ?, ?, ?, ?, ?, 'test')`,
      user.email, user.email, user.name, user.role, user.active ?? 1, NOW
    );
  }
}

async function call(m: MigratedDb, email: string, method: string, path: string, body?: unknown) {
  const res = await handleGripcasting(m.db, email, method, path.split("/").filter(Boolean), body);
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null, cache: res.headers.get("cache-control") };
}

const driversBody = { drivers: { vol: VOL, gl: {} }, version: null };
const buildBody = {
  doc: {
    bu: "01 Outdoor Grow",
    lines: { "5120 · Nutrients": { status: "inprogress", reason: "", items: [{ id: "i1", qty: 2, cost: 0.045, unit: "tag" }] } },
  },
  version: null,
};
const actualsBody = {
  closeDate: "2026-08-31",
  fileName: "synth.xlsx",
  rows: [["PNN", "01 Outdoor Grow", "5120 · Nutrients", 10.25]],
  monthly: { "5120 · Nutrients": { "2026-08": 10.25 } },
  transactions: Array.from({ length: 20 }, (_, i) => ({
    bu: "01",
    r: ["2026-08-15", "Bill", String(i + 1), "Vendor", "memo", "5120 · Nutrients", "PNN", 10.25],
  })),
};

describe("GRIPCasting API", () => {
  it("refuses every endpoint without a row, and an inactive row", async () => {
    const m = await migratedDb();
    seedFloor(m, [
      { email: "admin@example.com", name: "Admin", role: "admin" },
      { email: "director@example.com", name: "Director", role: "director" },
      { email: "old@example.com", name: "Old", role: "director", active: 0 },
    ]);
    const paths: Array<[string, string, unknown?]> = [
      ["GET", "me"],
      ["GET", "reference"],
      ["GET", "state"],
      ["GET", "actuals/2026-08-31"],
      ["GET", "transactions"],
      ["GET", "submissions/00000000-0000-4000-8000-000000000000/snapshot"],
      ["PUT", "drivers", driversBody],
      ["PUT", "builds/01", buildBody],
      ["POST", "actuals", actualsBody],
      ["POST", "submissions", { kind: "bu", code: "01" }],
      ["POST", "submissions", { kind: "final", code: null }],
    ];
    for (const [method, path, body] of paths) {
      const none = await call(m, "nobody@example.com", method, path, body);
      expect(none.status, `${method} ${path}`).toBe(403);
      expect(none.body.error).toContain("doesn't have access");
      const inactive = await call(m, "old@example.com", method, path, body);
      expect(inactive.status, `inactive ${method} ${path}`).toBe(403);
    }
  });

  it("lets a director read and build, and keeps finance-only doors shut", async () => {
    const m = await migratedDb();
    seedFloor(m, [
      { email: "admin@example.com", name: "Admin", role: "admin" },
      { email: "director@example.com", name: "Director", role: "director" },
    ]);
    const director = (method: string, path: string, body?: unknown) => call(m, "director@example.com", method, path, body);
    expect((await director("GET", "me")).body).toMatchObject({ email: "director@example.com", role: "director" });
    expect((await director("GET", "reference")).status).toBe(200);
    expect((await director("GET", "state")).status).toBe(200);
    expect((await director("GET", "actuals/2026-08-31")).body).toBeNull();
    expect((await director("GET", "transactions")).body).toEqual({ meta: null, rows: [] });
    expect((await director("GET", "submissions/00000000-0000-4000-8000-000000000000/snapshot")).status).toBe(404);
    expect((await director("PUT", "drivers", driversBody)).status).toBe(403);
    expect((await director("POST", "actuals", actualsBody)).status).toBe(403);
    expect((await director("POST", "submissions", { kind: "final", code: null })).status).toBe(403);
    const built = await director("PUT", "builds/01", buildBody);
    expect(built.status).toBe(200);
    expect(built.body.doc.lines["5120 · Nutrients"].items[0].cost).toBe(0.045);
    const submitted = await director("POST", "submissions", { kind: "bu", code: "01" });
    expect(submitted.status).toBe(200);
    expect(submitted.body.kind).toBe("bu");
    expect(submitted.body.submittedBy).toBe("director@example.com");
  });

  it("lets finance load actuals, set drivers, and submit, and refuses a stale version", async () => {
    const m = await migratedDb();
    seedFloor(m, [{ email: "admin@example.com", name: "Admin", role: "admin" }]);
    const admin = (method: string, path: string, body?: unknown) => call(m, "admin@example.com", method, path, body);
    expect((await admin("GET", "me")).body.role).toBe("admin");
    const first = await admin("PUT", "drivers", driversBody);
    expect(first.status).toBe(200);
    const version = first.body.version as string;
    await new Promise((resolve) => setTimeout(resolve, 20));
    const second = await admin("PUT", "drivers", { drivers: { vol: { ...VOL, plants: 11 }, gl: {} }, version });
    expect(second.status).toBe(200);
    const stale = await admin("PUT", "drivers", { drivers: { vol: { ...VOL, plants: 99 }, gl: {} }, version });
    expect(stale.status).toBe(409);
    const stored = m.get(`SELECT vol FROM gc_drivers`) as { vol: string };
    expect(JSON.parse(stored.vol).plants).toBe(11);

    const loaded = await admin("POST", "actuals", actualsBody);
    expect(loaded.status).toBe(200);
    expect(loaded.body.actuals.rows[0][3]).toBe(10.25);
    expect(loaded.body.actuals.monthly["5120 · Nutrients"]["2026-08"]).toBe(10.25);
    expect(loaded.body.upload.transactions).toBe(20);
    const line = m.get(`SELECT amount FROM gc_actual_lines`) as { amount: number };
    expect(line.amount).toBe(1025);
    const tx = m.all(`SELECT amount FROM gc_transactions`) as Array<{ amount: number }>;
    expect(tx).toHaveLength(20);
    expect(tx.every((row) => row.amount === 1025)).toBe(true);

    const built = await admin("PUT", "builds/01", buildBody);
    expect(built.status).toBe(200);
    const item = m.get(`SELECT qty, unit_cost FROM gc_build_items`) as { qty: number; unit_cost: number };
    expect(item).toEqual({ qty: 20000, unit_cost: 450 });
    const again = await admin("PUT", "builds/01", { ...buildBody, version: "2000-01-01T00:00:00.000Z" });
    expect(again.status).toBe(409);
    expect((m.get(`SELECT unit_cost FROM gc_build_items`) as { unit_cost: number }).unit_cost).toBe(450);

    const finalSub = await admin("POST", "submissions", { kind: "final", code: null });
    expect(finalSub.status).toBe(200);
    expect(finalSub.body.kind).toBe("final");
    expect(finalSub.body.submittedBy).toBe("admin@example.com");
    expect(finalSub.body.totals.b).toBe(100);
    const snap = await admin("GET", `submissions/${finalSub.body.id}/snapshot`);
    expect(snap.status).toBe(200);
    expect(snap.body.drivers.vol.plants).toBe(11);
    const centsRow = m.get(`SELECT budget, actual FROM gc_submissions WHERE kind = 'final'`) as { budget: number; actual: number };
    expect(centsRow.budget).toBe(10000);
    expect(Number.isInteger(centsRow.actual)).toBe(true);
  });

  it("answers 503 until a current harvest exists, and 200 for me", async () => {
    const m = await migratedDb();
    m.run(
      `INSERT INTO gc_app_users (id, email, name, role, is_active, created_at, created_by)
       VALUES ('u', 'admin@example.com', 'Admin', 'admin', 1, ?, 'test')`,
      NOW
    );
    expect((await call(m, "admin@example.com", "GET", "me")).status).toBe(200);
    expect((await call(m, "admin@example.com", "GET", "state")).status).toBe(503);
  });

  it("keeps each insert at or under 100 binds", async () => {
    const m = await migratedDb();
    const cols = ["id", "close_id", "entity", "bu", "gl", "amount", "created_at", "updated_at", "created_by"];
    const rows = Array.from({ length: 30 }, (_, i) => [String(i), "c", "PNN", "01", "5120", i, NOW, null, "t"]);
    const stmts = insertStmts(m.db, "gc_actual_lines", cols, rows);
    expect(stmts.length).toBe(3);
    for (const stmt of stmts) {
      const marks = ((stmt as unknown as { sql: string }).sql.match(/\?/g) || []).length;
      expect(marks).toBeLessThanOrEqual(100);
      expect(marks % cols.length).toBe(0);
    }
  });

  it("serves the API as JSON through the mounted routes", async () => {
    const m = await migratedDb();
    seedFloor(m, [{ email: "admin@example.com", name: "Admin", role: "admin" }]);
    const app = new Hono<{ Bindings: { DB: D1Database }; Variables: { actor: Identity } }>();
    app.use("*", async (c, next) => {
      c.set("actor", { id: "p", display_name: "Admin", email: "admin@example.com" });
      await next();
    });
    app.route("/models/gripcasting/api", gripcastingApi());
    const res = await app.request("http://local/models/gripcasting/api/me", { method: "GET" }, { DB: m.db });
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.json()).toMatchObject({ role: "admin" });
    const missing = await app.request("http://local/models/gripcasting/api/nope", { method: "GET" }, { DB: m.db });
    expect(missing.status).toBe(404);
    expect(await missing.json()).toEqual({ error: "Not found." });
  });
});

describe("GRIPCasting static app", () => {
  it("the served files call the API and carry no baked figures", async () => {
    const fs = (await import("node:" + "fs")) as { readFileSync(path: string, encoding: "utf8"): string };
    const html = fs.readFileSync("public/models/gripcasting/index.html", "utf8");
    const js = fs.readFileSync("public/models/gripcasting/app.js", "utf8");
    const css = fs.readFileSync("public/models/gripcasting/styles.css", "utf8");
    for (const text of [html, js, css]) {
      expect(text.includes("\u2013") || text.includes("\u2014") || text.includes("\r")).toBe(false);
      expect(text).not.toMatch(/\$\d[\d,]*\.\d{2}/);
    }
    expect(html).toContain('src="app.js"');
    expect(html).toContain('href="styles.css"');
    expect(js).toContain('"/models/gripcasting/api/"');
    expect(js).toContain("https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js");
    expect(js).not.toContain("WAGES_BUDGET");
  });
});

describe("GRIPCasting import dry run", () => {
  let dir = "";
  afterAll(async () => {
    if (!dir) return;
    const fs = (await import("node:" + "fs")) as { rmSync(path: string, options: { recursive: boolean; force: boolean }): void };
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("counts a synthetic pack and writes nothing", async () => {
    const fs = (await import("node:" + "fs")) as {
      mkdirSync(path: string, options: { recursive: boolean }): void;
      mkdtempSync(path: string): string;
      writeFileSync(path: string, data: string): void;
    };
    const os = (await import("node:" + "os")) as { tmpdir(): string };
    const path = (await import("node:" + "path")) as { join(...parts: string[]): string };
    const child = (await import("node:" + "child_process")) as {
      spawnSync(cmd: string, args: string[], options: { encoding: "utf8" }): { status: number | null; stdout: string };
    };
    const proc = (await import("node:" + "process")) as { execPath: string };
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "gc-import-"));
    fs.writeFileSync(path.join(dir, "const.json"), JSON.stringify({
      BUS: ["01 Outdoor Grow", "12 SG&A"],
      GLS: ["5120 · Nutrients"],
      BUDGET: { "5120 · Nutrients": { "01 Outdoor Grow": 12.5, "12 SG&A": 1 } },
      WAGES_BUDGET: 3,
      SEASON: {},
      VOL_DEFAULT: VOL,
    }));
    const data = path.join(dir, "data", "db");
    fs.mkdirSync(path.join(data, "model"), { recursive: true });
    fs.mkdirSync(path.join(data, "actuals"), { recursive: true });
    fs.mkdirSync(path.join(data, "builds"), { recursive: true });
    fs.writeFileSync(path.join(data, "model", "drivers.json"), JSON.stringify({ data: { vol: VOL, gl: {} } }));
    fs.writeFileSync(path.join(data, "actuals", "current.json"), JSON.stringify({
      closeDate: "2026-08-31", fileName: "synth.xlsx", uploadedAt: NOW,
      rows: [["PNN", "01 Outdoor Grow", "5120 · Nutrients", 1.5]],
      monthly: { "5120 · Nutrients": { "2026-08": 1.5 } },
    }));
    fs.writeFileSync(path.join(data, "builds", "01.json"), JSON.stringify({
      bu: "01 Outdoor Grow",
      lines: { "5120 · Nutrients": { status: "inprogress", items: [{ id: "i1", qty: 1, cost: 0.045 }] } },
    }));
    const run = child.spawnSync(proc.execPath, [
      "scripts/gripcasting-import.mjs", "--dry-run", "--dir", dir, "--admin", "a@example.com=Admin",
    ], { encoding: "utf8" });
    expect(run.status).toBe(0);
    expect(run.stdout).toContain("dry-run: no rows written.");
    expect(run.stdout).toContain("harvests: 1");
    expect(run.stdout).toContain("business_units: 2");
    expect(run.stdout).toContain("gl_accounts: 1");
    expect(run.stdout).toContain("budget_lines: 2");
    expect(run.stdout).toContain("drivers: 1");
    expect(run.stdout).toContain("actual_lines: 1");
    expect(run.stdout).toContain("build_items: 1");
    expect(run.stdout).toContain("users: 1");
    expect(run.stdout).not.toMatch(/\$\d/);
    expect(run.stdout).not.toContain("12.5");
    expect(run.stdout).not.toContain("Admin");
  });
});
