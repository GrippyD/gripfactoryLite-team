/** The finance tie-out. It skips until finance's fixtures are on disk.
 * With them, every difference must be $0.00. The ported model matches the
 * vendored bytes. */
import { beforeAll, describe, expect, it } from "vitest";
import type { Actuals, BuildDoc, Reference, Vol } from "../src/gripcasting/types";
import {
  allLines, buCode, buLines, buMonthly, buTable, compute, defaults, initReference, mergeDrivers, normGL, registerActualGLs, registerBuildGLs, registerGL,
  volumesFrom,
  type Model, type ModelState,
} from "../src/gripcasting/model";

describe("the ported model", () => {
  it("matches the vendored model and types byte for byte", () => {
    expect(fs.readFileSync("src/gripcasting/model.ts").equals(fs.readFileSync("vendor/gripcasting/src/shared/model.ts"))).toBe(true);
    expect(fs.readFileSync("src/gripcasting/types.ts").equals(fs.readFileSync("vendor/gripcasting/src/shared/types.ts"))).toBe(true);
  });
});

type NodeFs = {
  existsSync(path: string): boolean;
  readFileSync(path: string): { equals(other: unknown): boolean };
  readFileSync(path: string, encoding: "utf8"): string;
  readdirSync(path: string): string[];
};
const fs = (await import("node:" + "fs")) as NodeFs;
const has = fs.existsSync("src/const.json") && fs.existsSync("data/db/actuals/current.json");
const read = <T>(p: string) => JSON.parse(fs.readFileSync(p, "utf8")) as T;
const r2 = (x: number) => Math.round(x * 100) / 100;
const sum = <T>(xs: T[], f: (x: T) => number) => xs.reduce((s, x) => s + f(x), 0);

function reference(): Reference {
  const c = read<{ BUS: string[]; GLS: string[]; BUDGET: Record<string, Record<string, number>>; WAGES_BUDGET?: number; SEASON?: Record<string, number[]>; VOL_DEFAULT: Vol }>("src/const.json");
  const budget = Object.fromEntries(Object.entries(c.BUDGET).map(([g, row]) => [g, Object.fromEntries(Object.entries(row).map(([bu, v]) => [bu, r2(v)]))]));
  return { harvest: "2026H", bus: c.BUS, gls: c.GLS, budget, wagesBudget: c.WAGES_BUDGET ?? null, season: c.SEASON || {}, volDefault: c.VOL_DEFAULT };
}

function tieOut(M: Model): Record<string, number> {
  const bt = buTable(M), d: Record<string, number> = {};
  d["BU landing vs company"] = sum(bt, (r) => r.landing) - M.cost;
  d["BU budget vs company"] = sum(bt, (r) => r.b) - M.budget;
  d["BU actual vs company"] = sum(bt, (r) => r.a) - M.actual;
  d["max GL: BU pieces vs GL remaining"] = Math.max(0, ...M.lines.map((l) => Math.abs(sum(Object.values(M.buRem[l.g] || {}), (e) => e.rem) - l.rem)));
  let buL = 0, buB = 0, buA = 0, mon = 0;
  for (const row of bt) {
    const ls = buLines(M, row.bu);
    buL = Math.max(buL, Math.abs(sum(ls, (r) => r.landing) - row.landing));
    buB = Math.max(buB, Math.abs(sum(ls, (r) => r.b) - row.b));
    buA = Math.max(buA, Math.abs(sum(ls, (r) => r.a) - row.a));
    mon = Math.max(mon, Math.abs(sum(buMonthly(M, ls), (m) => m.v) - sum(ls, (r) => r.rem)));
  }
  Object.assign(d, { "max BU lines vs BU row: landing": buL, "max BU lines vs BU row: budget": buB, "max BU lines vs BU row: actual": buA, "max BU monthly vs BU remaining": mon });
  const all = allLines(M);
  d["All In landing vs company"] = sum(all.rows, (r) => r.landing) - M.cost;
  d["All In budget vs company"] = sum(all.rows, (r) => r.b) - M.budget;
  d["All In monthly vs remaining"] = sum(buMonthly(M, all.flat), (m) => m.v) - (M.cost - M.actual);
  d["revenue streams vs total"] = sum(M.streams, (s) => s.rev) - M.revenue;
  d["revenue - cost vs EBITDA"] = M.revenue - M.cost - M.ebitda;
  for (const k in d) d[k] = r2(d[k]) + 0;
  return d;
}
const zeros = (d: Record<string, number>) => Object.fromEntries(Object.keys(d).map((k) => [k, 0]));

describe.skipIf(!has)("tie-out", () => {
  let actuals: Actuals, drivers: ReturnType<typeof mergeDrivers>, builds: Record<string, BuildDoc>;
  beforeAll(() => {
    initReference(reference());
    actuals = read<Actuals>("data/db/actuals/current.json");
    registerActualGLs(actuals);
    drivers = mergeDrivers(read<{ data: { vol: Vol } }>("data/db/model/drivers.json").data);
    builds = {};
    for (const f of fs.readdirSync("data/db/builds")) {
      const b = read<BuildDoc>(`data/db/builds/${f}`);
      builds[buCode(b.bu)] = b;
    }
    registerBuildGLs(builds);
  });

  it("defaults, no actuals", () => { const d = tieOut(compute({ drivers: defaults(), actuals: null, builds: {} })); expect(d).toEqual(zeros(d)); });
  it("actuals, default drivers, no builds", () => { const d = tieOut(compute({ drivers: defaults(), actuals, builds: {} })); expect(d).toEqual(zeros(d)); });
  it("live state (actuals + drivers + builds)", () => {
    const M = compute({ drivers, actuals, builds }), d = tieOut(M);
    expect(d).toEqual(zeros(d));
    if (fs.existsSync("data/expected.json")) {
      const want = read<{ cost: number; budget: number }>("data/expected.json");
      expect(Math.abs(r2(M.cost) - want.cost)).toBeLessThan(0.1);
      expect(Math.abs(r2(M.budget) - want.budget)).toBeLessThan(0.1);
    }
  });
  it("entity ties to Net Income (seed upload)", () => {
    const seed = read<{ rows: [string, string, string, number][]; checks: Record<string, number> }>("data/seed_actuals_2026-08-31.json"), ent: Record<string, number> = {};
    for (const [e, , g, a] of seed.rows) ent[e] = (ent[e] || 0) + (+g.slice(0, 4) < 5000 ? a : -a);
    for (const [e, ni] of Object.entries(seed.checks)) expect(r2(ent[e] - ni) + 0).toBe(0);
  });
  it("a submission snapshot recalculates to the live numbers", () => {
    const st: ModelState = { drivers, actuals, builds }, live = compute(st);
    const again = compute(JSON.parse(JSON.stringify(st)) as ModelState);
    for (const k of ["cost", "budget", "actual", "revenue", "ebitda"] as const) expect(r2(again[k] - live[k]) + 0).toBe(0);
  });
  it("stress: shrink, custom GL, closed line, out-of-window item", () => {
    const b = JSON.parse(JSON.stringify(builds)) as Record<string, BuildDoc>;
    b["05"] = b["05"] || { bu: "05 Post Harvest", lines: {} };
    Object.assign(b["05"].lines, {
      "5250 · Packaging": { status: "inprogress", items: [{ id: "a", qty: 100000, cost: 0.45, start: "2026-10-01", end: "2026-10-31" }, { id: "b", qty: 2, cost: 5000 }] },
      "5330 · Equipment Rental": { status: "closed", items: [] },
      "5585 · Irrigation Supplies": { status: "inprogress", custom: true, items: [{ id: "c", qty: 3, cost: 1000, start: "2026-06-01", end: "2026-06-30" }] },
    });
    registerGL(normGL("5585 · Irrigation Supplies"));
    const d = tieOut(compute({ drivers: { ...drivers, vol: { ...drivers.vol, shrink: 0.05 } }, actuals, builds: b }));
    expect(d).toEqual(zeros(d));
  });
});

describe("bud shrink to biomass", () => {
  const v = { plants: 1000, wetPerPlant: 10, dryDown: 0.2, ffWet: 1000, btr: 0.3, shrink: 0.1 } as unknown as Vol;
  it("moves lbs from bud to biomass without losing any", () => {
    const a = volumesFrom({ ...v, shrink: 0 }), b = volumesFrom(v);
    expect(b.netDry).toBe(1800);
    expect(b.adjDry).toBe(b.netDry);
    expect(b.grossBud).toBeCloseTo(540);
    expect(b.shrinkLbs).toBeCloseTo(54);
    expect(b.bud).toBeCloseTo(486);
    expect(b.other).toBeCloseTo(1260 + 54);
    expect(b.bud + b.other).toBeCloseTo(a.bud + a.other);
  });
});
