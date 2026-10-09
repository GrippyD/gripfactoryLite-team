import { describe, expect, it } from "vitest";
import { METRC_SWEEP_DEFAULTS, metrcPageSizeOf, metrcShareOf, metrcWholeOf } from "../src/config";
import { KEY_CHARACTER_REFUSAL, METRC_HOST_REFUSAL, basicToken, recordMetrcCall } from "../src/metrcapi";
import {
  ABOVE_CAP_WORDS,
  CEILING_PASS_WORDS,
  CEILING_WINDOW_WORDS,
  METRC_MAX_PAGE_SIZE,
  METRC_TICK_D1,
  MetrcBudget,
  NEEDS_FULL_WORDS,
  SECOND_429_WORDS,
  SHORT_PASS_WORDS,
  SHORT_WINDOW_WORDS,
  WRITE_SCOPE_WORDS,
  callsThisMonth,
  ensureCursor,
  fullCadenceHours,
  halveWindow,
  isoSeconds,
  loadCursor,
  loadMetrcSweepConfig,
  needsFullPass,
  nextWindow,
  pacedTickCalls,
  parseEnvelope,
  readMetrcPage,
  runFullPass,
  runIncremental,
  seriesDone,
  shortBeforeLastPage,
  startTickBudget,
  ticksLeftInMonth,
  type BudgetLimits,
  type MetrcScope,
  type PageContext,
  type PagerDeps,
} from "../src/metrcpager";
import { migratedDb, type MigratedDb } from "./migrated";

const SANDBOX = "https://sandbox-api-mi.metrc.com";
const HOST = "sandbox-api-mi.metrc.com";
const ENV = { METRC_INTEGRATOR_KEY: "fake-vendor-key", METRC_USER_KEY: "fake-user-key", METRC_API_BASE: SANDBOX };
const PROD_HOST = "api-mi.metrc.com";
const PROD_ENV = { ...ENV, METRC_API_BASE: "https://api-mi.metrc.com" };
const NOW = "2026-10-08T10:00:00.000Z";
const ISO_SECONDS = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;

function scope(over: Partial<MetrcScope> = {}): MetrcScope {
  return { host: HOST, license: "AU-G-C-000832", endpoint: "/packages/v2/active", mode: "dry_run", kind: "packages", phase: null, ...over };
}

function labels(prefix: string, n: number): Array<{ Label: string }> {
  return Array.from({ length: n }, (_, i) => ({ Label: `${prefix}${String(i).padStart(4, "0")}` }));
}

type Call = { page: number; size: number; start: string | null; end: string | null; license: string | null; path: string; query: string };

function fakeMetrc(answer: (call: Call, n: number) => Response | Promise<Response>) {
  const calls: Call[] = [];
  const fetchImpl = (async (input: string) => {
    const url = new URL(String(input));
    const call: Call = {
      page: Number(url.searchParams.get("pageNumber")),
      size: Number(url.searchParams.get("pageSize")),
      start: url.searchParams.get("lastModifiedStart"),
      end: url.searchParams.get("lastModifiedEnd"),
      license: url.searchParams.get("licenseNumber"),
      path: url.pathname,
      query: url.search,
    };
    calls.push(call);
    return answer(call, calls.length);
  }) as typeof fetch;
  return { calls, fetchImpl };
}

function page(rows: unknown[], pageNumber: number, totalPages?: number, totalRecords?: number): Response {
  const body: Record<string, unknown> = { Data: rows, Page: pageNumber };
  if (totalPages != null) body.TotalPages = totalPages;
  if (totalRecords != null) body.TotalRecords = totalRecords;
  return new Response(JSON.stringify(body), { status: 200 });
}

function limits(over: Partial<BudgetLimits> = {}): BudgetLimits {
  return { calls: 60, licenseCalls: 20, rows: 3000, wallMs: 240000, d1: METRC_TICK_D1, ...over };
}

function deps(m: MigratedDb, over: Partial<PagerDeps> = {}): PagerDeps & { slept: number[]; pages: PageContext[] } {
  const slept: number[] = [];
  const pages: PageContext[] = [];
  return {
    db: m.db,
    env: ENV,
    budget: MetrcBudget.start(limits(), () => 0),
    config: METRC_SWEEP_DEFAULTS,
    now: () => NOW,
    clock: () => 0,
    sleep: async (ms) => {
      slept.push(ms);
    },
    onPage: async (_rows, ctx) => {
      pages.push(ctx);
    },
    ...over,
    slept,
    pages,
  };
}

async function seedMark(m: MigratedDb, s: MetrcScope, hwm: string): Promise<void> {
  await ensureCursor(m.db, s, "2026-10-01T00:00:00.000Z");
  m.run(`UPDATE metrc_cursors SET hwm_end = ? WHERE license_value = ? AND endpoint = ? AND mode = ?`, hwm, s.license, s.endpoint, s.mode);
}

describe("MA1 Law 5: pages", () => {
  it("parses an envelope and a bare array, and nothing else", () => {
    expect(parseEnvelope({ Data: [1, 2], Page: 2, TotalPages: 3, TotalRecords: 120 })).toEqual({ rows: [1, 2], page: 2, totalPages: 3, totalRecords: 120, bare: false });
    expect(parseEnvelope({ Data: [1] }, 4)).toEqual({ rows: [1], page: 4, totalPages: null, totalRecords: null, bare: false });
    expect(parseEnvelope([1, 2, 3])).toEqual({ rows: [1, 2, 3], page: 1, totalPages: 1, totalRecords: 3, bare: true });
    expect(parseEnvelope({})).toBeNull();
    expect(parseEnvelope(null)).toBeNull();
    expect(parseEnvelope("rows")).toBeNull();
    expect(seriesDone({ rows: labels("A", 50), page: 2, totalPages: 2, totalRecords: 100, bare: false }, 50)).toBe(true);
    expect(seriesDone({ rows: labels("A", 50), page: 1, totalPages: null, totalRecords: null, bare: false }, 50)).toBe(false);
    // Phase C ruling C2: TotalPages is authoritative, so a short page before it does not end the series; 0 rows does.
    expect(seriesDone({ rows: labels("A", 49), page: 1, totalPages: 9, totalRecords: null, bare: false }, 50)).toBe(false);
    expect(seriesDone({ rows: labels("A", 1), page: 8, totalPages: 9, totalRecords: null, bare: false }, 50)).toBe(false);
    expect(seriesDone({ rows: [], page: 3, totalPages: 9, totalRecords: null, bare: false }, 50)).toBe(true);
    expect(seriesDone({ rows: labels("A", 49), page: 1, totalPages: null, totalRecords: null, bare: false }, 50)).toBe(true);
    expect(seriesDone({ rows: labels("A", 49), page: 1, totalPages: 1, totalRecords: 49, bare: true }, 50)).toBe(true);
    expect(seriesDone({ rows: [], page: 1, totalPages: 0, totalRecords: 0, bare: false }, 50)).toBe(true);
  });

  it("reads a full pass to exhaustion: three pages of 50 and a short page, each naming its page and size", async () => {
    const m = await migratedDb();
    const { calls, fetchImpl } = fakeMetrc((call) => page(labels(`P${call.page}-`, call.page <= 3 ? 50 : 20), call.page));
    const d = deps(m, { fetchImpl });
    const result = await runFullPass(scope(), d);
    expect(result.complete).toBe(true);
    if (!result.complete) throw new Error("expected a complete pass");
    expect(calls.map((call) => [call.page, call.size])).toEqual([
      [1, 50],
      [2, 50],
      [3, 50],
      [4, 50],
    ]);
    expect(calls.every((call) => call.license === "AU-G-C-000832" && call.start == null && call.end == null)).toBe(true);
    expect(result.seenTags.size).toBe(170);
    expect(result.totalRecords).toBe(170);
    expect(d.pages.map((ctx) => [ctx.run, ctx.page, ctx.passId === result.passId])).toEqual([
      ["full", 1, true],
      ["full", 2, true],
      ["full", 3, true],
      ["full", 4, true],
    ]);
    expect(m.all(`SELECT * FROM metrc_api_calls`)).toHaveLength(4);
    expect(m.all(`SELECT * FROM metrc_pass_pages`)).toHaveLength(0);
  });

  it("stops at TotalPages even when the last page is full", async () => {
    const m = await migratedDb();
    const { calls, fetchImpl } = fakeMetrc((call) => page(labels(`P${call.page}-`, 50), call.page, 2, 100));
    const result = await runFullPass(scope(), deps(m, { fetchImpl }));
    expect(calls.map((call) => call.page)).toEqual([1, 2]);
    expect(result.complete && result.totalRecords).toBe(100);
  });

  it("records an incomplete result at the hard ceiling, never a silent stop, and drops the pass until its cadence", async () => {
    const m = await migratedDb();
    const { calls, fetchImpl } = fakeMetrc((call) => page(labels(`P${call.page}-`, 50), call.page, 99, 4950));
    const pass = await runFullPass(scope(), deps(m, { fetchImpl, pageCeiling: 3 }));
    expect(pass.complete).toBe(false);
    expect(pass).toMatchObject({ complete: false, status: "ceiling", message: CEILING_PASS_WORDS, pages: 3 });
    expect(calls).toHaveLength(3);
    const cursor = await loadCursor(m.db, scope());
    // The pass is closed, not left stuck one past the ceiling: its pages go,
    // no mark is set, and it is due again one cadence (24 h) from now.
    expect(cursor).toMatchObject({ last_status: "ceiling", full_pass_id: null, full_page: 0, full_completed_at: null, hwm_end: null, full_due_at: "2026-10-09T10:00:00Z" });
    expect(m.all(`SELECT * FROM metrc_pass_pages`)).toHaveLength(0);
    expect(needsFullPass(cursor, "2026-10-08T12:00:00Z")).toBe(false);
    expect(needsFullPass(cursor, "2026-10-09T10:00:00Z")).toBe(true);
    const again = await runFullPass(scope(), deps(m, { fetchImpl, pageCeiling: 3, now: () => "2026-10-09T10:00:00.000Z" }));
    expect(again).toMatchObject({ complete: false, status: "ceiling", pages: 3 });
    expect(calls.map((call) => call.page)).toEqual([1, 2, 3, 1, 2, 3]);

    // A window at the ceiling is halved down to its floor (the halved end must
    // still lie after the mark); only there is the ceiling recorded.
    const s = scope({ license: "AU-P-000694" });
    await seedMark(m, s, "2026-10-08T09:00:00Z");
    const win = fakeMetrc((call) => page(labels(`W${call.page}-`, 50), call.page, 99, 4950));
    const inc = await runIncremental(s, deps(m, { fetchImpl: win.fetchImpl, pageCeiling: 2 }));
    expect(inc).toMatchObject({ status: "ceiling", message: CEILING_WINDOW_WORDS, pages: 8, windows: 0 });
    expect(win.calls.map((call) => [call.end, call.page])).toEqual([
      ["2026-10-08T10:00:00Z", 1],
      ["2026-10-08T10:00:00Z", 2],
      ["2026-10-08T09:27:30Z", 1],
      ["2026-10-08T09:27:30Z", 2],
      ["2026-10-08T09:11:15Z", 1],
      ["2026-10-08T09:11:15Z", 2],
      ["2026-10-08T09:03:07Z", 1],
      ["2026-10-08T09:03:07Z", 2],
    ]);
    expect(win.calls.every((call) => call.start === "2026-10-08T08:55:00Z")).toBe(true);
    expect(await loadCursor(m.db, s)).toMatchObject({ hwm_end: "2026-10-08T09:00:00Z", win_end: "2026-10-08T09:03:07Z", last_status: "ceiling" });
  });

  it("halves a window that reaches the ceiling and reads on until the mark reaches now", async () => {
    const m = await migratedDb();
    const s = scope();
    await seedMark(m, s, "2026-10-08T09:00:00Z");
    // Full pages while a window spans more than 30 minutes, then a short page.
    const { calls, fetchImpl } = fakeMetrc((call) => {
      const span = Date.parse(String(call.end)) - Date.parse(String(call.start));
      return page(labels(`H${call.page}-`, span > 30 * 60_000 ? 50 : 3), call.page);
    });
    const result = await runIncremental(s, deps(m, { fetchImpl, pageCeiling: 2 }));
    expect(result).toMatchObject({ status: "ok", windows: 4, pages: 12 });
    expect(calls.map((call) => [call.start, call.end, call.page])).toEqual([
      ["2026-10-08T08:55:00Z", "2026-10-08T10:00:00Z", 1],
      ["2026-10-08T08:55:00Z", "2026-10-08T10:00:00Z", 2],
      ["2026-10-08T08:55:00Z", "2026-10-08T09:27:30Z", 1],
      ["2026-10-08T08:55:00Z", "2026-10-08T09:27:30Z", 2],
      ["2026-10-08T08:55:00Z", "2026-10-08T09:11:15Z", 1],
      ["2026-10-08T09:06:15Z", "2026-10-08T10:00:00Z", 1],
      ["2026-10-08T09:06:15Z", "2026-10-08T10:00:00Z", 2],
      ["2026-10-08T09:06:15Z", "2026-10-08T09:33:07Z", 1],
      ["2026-10-08T09:28:07Z", "2026-10-08T10:00:00Z", 1],
      ["2026-10-08T09:28:07Z", "2026-10-08T10:00:00Z", 2],
      ["2026-10-08T09:28:07Z", "2026-10-08T09:44:03Z", 1],
      ["2026-10-08T09:39:03Z", "2026-10-08T10:00:00Z", 1],
    ]);
    expect(await loadCursor(m.db, s)).toMatchObject({ hwm_end: "2026-10-08T10:00:00Z", win_start: null, win_end: null, last_status: "ok" });
  });

  it("takes a bare array as one complete page", async () => {
    const m = await migratedDb();
    const s = scope();
    await seedMark(m, s, "2026-10-08T09:00:00Z");
    const { calls, fetchImpl } = fakeMetrc(() => new Response(JSON.stringify(labels("B", 75)), { status: 200 }));
    const result = await runIncremental(s, deps(m, { fetchImpl }));
    expect(result).toMatchObject({ status: "ok", pages: 1, rows: 75, windows: 1 });
    expect(calls).toHaveLength(1);
    expect((await loadCursor(m.db, s))?.hwm_end).toBe("2026-10-08T10:00:00Z");
  });

  it("clamps the page size to 1..50 and always sends it", async () => {
    expect(METRC_MAX_PAGE_SIZE).toBe(50);
    expect(metrcPageSizeOf("80")).toBe(50);
    expect(metrcPageSizeOf("20")).toBe(20);
    expect(metrcPageSizeOf("0")).toBe(1);
    expect(metrcPageSizeOf("")).toBe(50);
    expect(metrcPageSizeOf(null)).toBe(50);
    expect(metrcPageSizeOf("many")).toBe(50);
    const m = await migratedDb();
    const { calls, fetchImpl } = fakeMetrc((call) => page([], call.page, 0, 0));
    const result = await runFullPass(scope(), deps(m, { fetchImpl, config: { ...METRC_SWEEP_DEFAULTS, pageSize: 80 } }));
    expect(result.complete).toBe(true);
    expect(calls[0].query).toContain("pageNumber=1");
    expect(calls[0].query).toContain("pageSize=50");
  });
});

describe("MA1 Law 5: windows and cursors", () => {
  it("resumes a window across ticks at win_page; the mark moves only when the window ends", async () => {
    const m = await migratedDb();
    const s = scope();
    await seedMark(m, s, "2026-10-08T09:00:00Z");
    const { calls, fetchImpl } = fakeMetrc((call) => {
      if (call.start === "2026-10-08T08:55:00Z") return page(labels(`W${call.page}-`, call.page <= 3 ? 50 : 10), call.page);
      return page([], call.page, 0, 0);
    });
    const tick1 = await runIncremental(s, deps(m, { fetchImpl, budget: MetrcBudget.start(limits({ calls: 2 }), () => 0) }));
    expect(tick1).toMatchObject({ status: "budget", pages: 2, windows: 0 });
    expect(calls.map((call) => [call.start, call.end, call.page])).toEqual([
      ["2026-10-08T08:55:00Z", "2026-10-08T10:00:00Z", 1],
      ["2026-10-08T08:55:00Z", "2026-10-08T10:00:00Z", 2],
    ]);
    expect(await loadCursor(m.db, s)).toMatchObject({
      hwm_end: "2026-10-08T09:00:00Z",
      win_start: "2026-10-08T08:55:00Z",
      win_end: "2026-10-08T10:00:00Z",
      win_page: 3,
      last_status: "budget",
    });

    const tick2 = await runIncremental(
      s,
      deps(m, { fetchImpl, now: () => "2026-10-08T11:00:00.000Z", budget: MetrcBudget.start(limits({ calls: 3 }), () => 0) })
    );
    expect(tick2).toMatchObject({ status: "ok", pages: 3, windows: 2 });
    expect(calls.slice(2).map((call) => [call.start, call.end, call.page])).toEqual([
      ["2026-10-08T08:55:00Z", "2026-10-08T10:00:00Z", 3],
      ["2026-10-08T08:55:00Z", "2026-10-08T10:00:00Z", 4],
      ["2026-10-08T09:55:00Z", "2026-10-08T11:00:00Z", 1],
    ]);
    expect(await loadCursor(m.db, s)).toMatchObject({ hwm_end: "2026-10-08T11:00:00Z", win_start: null, win_end: null, win_page: 0, last_status: "ok" });
  });

  it("walks lastModified windows oldest first, in max-window chunks with the overlap, without milliseconds, capped at now", async () => {
    const m = await migratedDb();
    const s = scope();
    await seedMark(m, s, "2026-10-05T10:00:00Z");
    const { calls, fetchImpl } = fakeMetrc((call) => page([], call.page, 0, 0));
    const result = await runIncremental(s, deps(m, { fetchImpl, now: () => "2026-10-08T10:30:00.123Z" }));
    expect(result).toMatchObject({ status: "ok", windows: 4 });
    expect(calls.map((call) => [call.start, call.end])).toEqual([
      ["2026-10-05T09:55:00Z", "2026-10-06T09:55:00Z"],
      ["2026-10-06T09:50:00Z", "2026-10-07T09:50:00Z"],
      ["2026-10-07T09:45:00Z", "2026-10-08T09:45:00Z"],
      ["2026-10-08T09:40:00Z", "2026-10-08T10:30:00Z"],
    ]);
    expect(calls.every((call) => ISO_SECONDS.test(String(call.start)) && ISO_SECONDS.test(String(call.end)))).toBe(true);
    expect((await loadCursor(m.db, s))?.hwm_end).toBe("2026-10-08T10:30:00Z");
  });

  it("computes one window at a time from the mark", () => {
    expect(isoSeconds(Date.parse("2026-10-08T10:30:59.999Z"))).toBe("2026-10-08T10:30:59Z");
    expect(nextWindow({ hwmEnd: "2026-10-08T09:00:00Z", nowIso: "2026-10-08T10:00:00.500Z", overlapMinutes: 5, maxMinutes: 1440 })).toEqual({
      start: "2026-10-08T08:55:00Z",
      end: "2026-10-08T10:00:00Z",
    });
    expect(nextWindow({ hwmEnd: "2026-10-08T10:00:00Z", nowIso: "2026-10-08T10:00:00.900Z", overlapMinutes: 5, maxMinutes: 1440 })).toBeNull();
    expect(nextWindow({ hwmEnd: "2026-10-08T09:00:00Z", nowIso: "2026-10-08T10:00:00Z", overlapMinutes: 0, maxMinutes: 30 })).toEqual({
      start: "2026-10-08T09:00:00Z",
      end: "2026-10-08T09:30:00Z",
    });
    // A max window shorter than the overlap still moves the mark forward.
    const short = nextWindow({ hwmEnd: "2026-10-08T09:00:00Z", nowIso: "2026-10-08T10:00:00Z", overlapMinutes: 5, maxMinutes: 1 });
    expect(short).toEqual({ start: "2026-10-08T08:55:00Z", end: "2026-10-08T09:01:00Z" });
  });

  it("keeps a dry_run cursor apart from a write cursor; an empty write cursor needs a full pass first", async () => {
    const m = await migratedDb();
    const { calls, fetchImpl } = fakeMetrc((call) => page(labels("D", 10), call.page));
    // Write mode runs only on a production host (Law 3), so both cursors live there.
    const dry = scope({ host: PROD_HOST, mode: "dry_run" });
    const write = scope({ host: PROD_HOST, mode: "write" });
    const pass = await runFullPass(dry, deps(m, { fetchImpl, env: PROD_ENV }));
    expect(pass.complete).toBe(true);
    const dryCursor = await loadCursor(m.db, dry);
    expect(dryCursor?.hwm_end).toBe("2026-10-08T10:00:00Z");
    const before = calls.length;
    const inc = await runIncremental(write, deps(m, { fetchImpl, env: PROD_ENV }));
    expect(inc).toMatchObject({ status: "needs_full", message: NEEDS_FULL_WORDS, pages: 0 });
    expect(calls.length).toBe(before);
    const writeCursor = await loadCursor(m.db, write);
    expect(writeCursor?.hwm_end).toBeNull();
    expect(writeCursor?.id).not.toBe(dryCursor?.id);
    expect(needsFullPass(writeCursor, NOW)).toBe(true);
    expect(needsFullPass(dryCursor, NOW)).toBe(false);
    expect(needsFullPass(dryCursor, "2026-10-09T10:00:00Z")).toBe(true);
    expect(needsFullPass(null, NOW)).toBe(true);
    expect(needsFullPass({ hwm_end: "2026-10-08T10:00:00Z", full_pass_id: "p", full_due_at: "2026-10-30T00:00:00Z" }, NOW)).toBe(true);
    expect(m.all(`SELECT mode FROM metrc_cursors ORDER BY mode`).map((row) => row.mode)).toEqual(["dry_run", "write"]);
  });

  it("resumes a full pass across ticks at full_page and clears its pages on completion", async () => {
    const m = await migratedDb();
    const s = scope();
    const { calls, fetchImpl } = fakeMetrc((call) => page(labels(`F${call.page}-`, call.page < 3 ? 50 : 10), call.page, 3, 110));
    const tick1 = await runFullPass(s, deps(m, { fetchImpl, budget: MetrcBudget.start(limits({ calls: 2 }), () => 0) }));
    expect(tick1).toMatchObject({ complete: false, status: "budget", pages: 2 });
    const mid = await loadCursor(m.db, s);
    expect(mid).toMatchObject({ full_page: 3, full_started_at: "2026-10-08T10:00:00Z", full_total_pages: 3, full_rows_seen: 100, hwm_end: null });
    const passId = String(mid?.full_pass_id);
    expect(m.all(`SELECT page FROM metrc_pass_pages WHERE pass_id = ? ORDER BY page`, passId).map((row) => row.page)).toEqual([1, 2]);

    let pagesAtComplete = -1;
    const tick2 = await runFullPass(
      s,
      deps(m, {
        fetchImpl,
        now: () => "2026-10-08T11:00:00.000Z",
        onComplete: async () => {
          pagesAtComplete = m.all(`SELECT * FROM metrc_pass_pages WHERE pass_id = ?`, passId).length;
        },
      })
    );
    expect(calls.map((call) => call.page)).toEqual([1, 2, 3]);
    expect(tick2.complete).toBe(true);
    if (!tick2.complete) throw new Error("expected a complete pass");
    expect(pagesAtComplete).toBe(3);
    expect(tick2.passId).toBe(passId);
    expect(tick2.passStartedAt).toBe("2026-10-08T10:00:00Z");
    expect(tick2.seenTags.size).toBe(110);
    expect(tick2.seenTags.has("F1-0000") && tick2.seenTags.has("F3-0009")).toBe(true);
    expect(tick2.totalRecords).toBe(110);
    expect(m.all(`SELECT * FROM metrc_pass_pages`)).toHaveLength(0);
    // The next pass is due a day after this pass began (less five minutes),
    // not a day after it ended, so a daily pass stays daily.
    const finished = await loadCursor(m.db, s);
    expect(finished).toMatchObject({
      full_pass_id: null,
      full_page: 0,
      full_started_at: "2026-10-08T10:00:00Z",
      full_completed_at: "2026-10-08T11:00:00Z",
      full_due_at: "2026-10-09T09:55:00Z",
      full_rows_seen: 110,
      hwm_end: "2026-10-08T10:00:00Z",
    });
    expect(needsFullPass(finished, "2026-10-09T09:59:58Z")).toBe(true);
    expect(fullCadenceHours(METRC_SWEEP_DEFAULTS, "plants")).toBe(168);
    expect(fullCadenceHours(METRC_SWEEP_DEFAULTS, "harvests")).toBe(24);
  });

  it("refuses a host that is not a Metrc host and absent keys, with no call and no cursor", async () => {
    const m = await migratedDb();
    const { calls, fetchImpl } = fakeMetrc(() => page([], 1));
    const other = await runIncremental(scope({ host: "example.com" }), deps(m, { fetchImpl, env: { ...ENV, METRC_API_BASE: "https://example.com" } }));
    expect(other).toMatchObject({ status: "host_refused", message: METRC_HOST_REFUSAL });
    const absent = await runFullPass(scope(), deps(m, { fetchImpl, env: { METRC_API_BASE: SANDBOX, METRC_INTEGRATOR_KEY: "fake-vendor-key" } }));
    expect(absent).toMatchObject({ complete: false, status: "absent", message: "The user key is absent." });
    const mixed = await runIncremental(scope({ host: "api-mi.metrc.com" }), deps(m, { fetchImpl }));
    expect(mixed.status).toBe("failed");
    expect(calls).toHaveLength(0);
    expect(m.all(`SELECT * FROM metrc_cursors`)).toHaveLength(0);
    const page1 = await readMetrcPage({ env: { ...ENV, METRC_API_BASE: "https://example.com" }, path: "/packages/v2/active", query: {}, page: 1, pageSize: 50, fetchImpl });
    expect(page1).toEqual({ kind: "host_refused", status: 0, message: METRC_HOST_REFUSAL });
  });
});

describe("MA1 Law 5: 429 and Retry-After", () => {
  it("retries a first 429 after its Retry-After, one recorded call per attempt", async () => {
    const m = await migratedDb();
    const s = scope();
    await seedMark(m, s, "2026-10-08T09:00:00Z");
    const { fetchImpl } = fakeMetrc((call, n) => (n === 1 ? new Response("", { status: 429, headers: { "Retry-After": "2" } }) : page([], call.page, 0, 0)));
    const d = deps(m, { fetchImpl });
    const result = await runIncremental(s, d);
    expect(result.status).toBe("ok");
    expect(d.slept).toEqual([2000]);
    expect(m.all(`SELECT status FROM metrc_api_calls ORDER BY rowid`).map((row) => row.status)).toEqual([429, 200]);
  });

  it("a second 429 ends that scope with its cursor saved, and the next license carries on", async () => {
    const m = await migratedDb();
    const a = scope({ license: "AU-G-C-000832" });
    const b = scope({ license: "AU-P-000694" });
    await seedMark(m, a, "2026-10-08T09:00:00Z");
    await seedMark(m, b, "2026-10-08T09:00:00Z");
    const { calls, fetchImpl } = fakeMetrc((call) =>
      call.license === a.license ? new Response("", { status: 429, headers: { "Retry-After": "1" } }) : page(labels("B", 3), call.page)
    );
    const budget = MetrcBudget.start(limits(), () => 0);
    const d = deps(m, { fetchImpl, budget });
    const ra = await runIncremental(a, d);
    expect(ra).toMatchObject({ status: "rate_limited", message: SECOND_429_WORDS, pages: 0 });
    expect(d.slept).toEqual([1000]);
    expect(calls.filter((call) => call.license === a.license)).toHaveLength(2);
    expect(await loadCursor(m.db, a)).toMatchObject({
      hwm_end: "2026-10-08T09:00:00Z",
      win_start: "2026-10-08T08:55:00Z",
      win_end: "2026-10-08T10:00:00Z",
      win_page: 1,
      last_status: "retry_after",
      last_http: 429,
    });
    const rb = await runIncremental(b, d);
    expect(rb).toMatchObject({ status: "ok", rows: 3, windows: 1 });
    expect((await loadCursor(m.db, b))?.hwm_end).toBe("2026-10-08T10:00:00Z");
  });

  it("a blank Retry-After waits one second before the retry", async () => {
    const m = await migratedDb();
    const s = scope();
    await seedMark(m, s, "2026-10-08T09:00:00Z");
    const { fetchImpl } = fakeMetrc((call, n) => (n === 1 ? new Response("", { status: 429, headers: { "Retry-After": "" } }) : page([], call.page, 0, 0)));
    const d = deps(m, { fetchImpl });
    expect((await runIncremental(s, d)).status).toBe("ok");
    expect(d.slept).toEqual([1000]);
  });

  it("a Retry-After above the cap ends the scope at once, without waiting", async () => {
    const m = await migratedDb();
    const s = scope();
    await seedMark(m, s, "2026-10-08T09:00:00Z");
    const { calls, fetchImpl } = fakeMetrc(() => new Response("", { status: 429, headers: { "Retry-After": "30" } }));
    const d = deps(m, { fetchImpl });
    const result = await runIncremental(s, d);
    expect(result).toMatchObject({ status: "rate_limited", message: ABOVE_CAP_WORDS });
    expect(d.slept).toEqual([]);
    expect(calls).toHaveLength(1);
    expect(await loadCursor(m.db, s)).toMatchObject({ hwm_end: "2026-10-08T09:00:00Z", win_page: 1, last_status: "retry_after" });
    const direct = await readMetrcPage({ env: ENV, path: "/packages/v2/active", query: { licenseNumber: s.license }, page: 1, pageSize: 50, fetchImpl, sleep: async () => undefined });
    expect(direct).toMatchObject({ kind: "rate_limited", reason: "retry_after_above_cap" });
  });

  it("ends a refused license and scrubs keys and the Basic token from a failed page", async () => {
    const m = await migratedDb();
    const refusedScope = scope({ license: "GR-C-001132" });
    await seedMark(m, refusedScope, "2026-10-08T09:00:00Z");
    const refused = fakeMetrc(() => new Response("", { status: 401 }));
    const r = await runIncremental(refusedScope, deps(m, { fetchImpl: refused.fetchImpl }));
    expect(r.status).toBe("refused");
    expect(await loadCursor(m.db, refusedScope)).toMatchObject({ last_status: "refused", last_http: 401, failures: 1 });

    const s = scope();
    await seedMark(m, s, "2026-10-08T09:00:00Z");
    const token = basicToken("fake-vendor-key", "fake-user-key");
    const broken = (async () => {
      throw new Error(`socket reset; Authorization: Basic ${token}; raw ${token}; fake-vendor-key; fake-user-key`);
    }) as typeof fetch;
    const f = await runIncremental(s, deps(m, { fetchImpl: broken }));
    expect(f.status).toBe("failed");
    expect(f.message).not.toContain(token);
    expect(f.message).not.toContain("fake-vendor-key");
    expect(f.message).not.toContain("fake-user-key");
    expect(f.message).toContain("[key]");
    expect(await loadCursor(m.db, s)).toMatchObject({ last_status: "failed", failures: 1, hwm_end: "2026-10-08T09:00:00Z" });
    expect(JSON.stringify(m.all(`SELECT * FROM metrc_api_calls`))).not.toContain("fake-");
  });
});

describe("MA1 Law 5: the budget and the month pace", () => {
  it("holds a per-license cap inside the tick, and the rows, D1 and wall caps", () => {
    let t = 0;
    const tick = MetrcBudget.start({ calls: 5, licenseCalls: 2, rows: 100, wallMs: 1000, d1: 10 }, () => t);
    const a = tick.forLicense("A");
    a.spendCall();
    a.spendCall();
    expect(a.stop()).toBe("license_calls");
    const b = tick.forLicense("B");
    expect(b.exhausted()).toBe(false);
    b.spendCall();
    b.spendCall();
    expect(b.stop()).toBe("license_calls");
    tick.forLicense("C").spendCall();
    expect(tick.calls).toBe(5);
    expect(tick.stop()).toBe("calls");
    expect(tick.forLicense("D").stop()).toBe("calls");

    const rows = MetrcBudget.start({ calls: 9, licenseCalls: 9, rows: 100, wallMs: 1000, d1: 10 }, () => 0);
    rows.spendRows(100);
    expect(rows.stop()).toBe("rows");
    const d1 = MetrcBudget.start({ calls: 9, licenseCalls: 9, rows: 100, wallMs: 1000, d1: 10 }, () => 0);
    d1.spendD1(10);
    expect(d1.stop()).toBe("d1");
    t = 0;
    const wall = MetrcBudget.start({ calls: 9, licenseCalls: 9, rows: 100, wallMs: 1000, d1: 10 }, () => t);
    expect(wall.exhausted()).toBe(false);
    t = 1000;
    expect(wall.stop()).toBe("wall");
  });

  it("stops a license at its own cap while the next license still reads", async () => {
    const m = await migratedDb();
    const { calls, fetchImpl } = fakeMetrc((call) => page(labels(`${call.license}-${call.page}-`, 50), call.page, 9));
    const budget = MetrcBudget.start(limits({ licenseCalls: 2 }), () => 0);
    const a = await runFullPass(scope({ license: "AU-G-C-000832" }), deps(m, { fetchImpl, budget }));
    expect(a).toMatchObject({ complete: false, status: "budget", pages: 2 });
    const b = await runFullPass(scope({ license: "AU-P-000694" }), deps(m, { fetchImpl, budget }));
    expect(b).toMatchObject({ complete: false, status: "budget", pages: 2 });
    expect(calls.map((call) => call.license)).toEqual(["AU-G-C-000832", "AU-G-C-000832", "AU-P-000694", "AU-P-000694"]);
    expect(budget.calls).toBe(4);
    expect(budget.d1).toBeGreaterThan(0);
  });

  it("paces the month without ever stopping the incrementals", () => {
    expect(ticksLeftInMonth("2026-10-08T10:30:00.000Z")).toBe(566);
    expect(ticksLeftInMonth("2026-10-31T23:30:00.000Z")).toBe(1);
    expect(ticksLeftInMonth("2026-02-01T00:00:00.000Z")).toBe(672);
    const base = { tickCalls: 60, monthCalls: 45000, ticksLeft: 566, scopes: 31 };
    expect(pacedTickCalls({ ...base, usedThisMonth: 0 })).toBe(60);
    expect(pacedTickCalls({ ...base, usedThisMonth: 20000 })).toBe(44);
    expect(pacedTickCalls({ ...base, usedThisMonth: 44000 })).toBe(31);
    expect(pacedTickCalls({ ...base, usedThisMonth: 50000 })).toBe(31);
    expect(pacedTickCalls({ ...base, usedThisMonth: 44990, ticksLeft: 1 })).toBe(31);
    expect(pacedTickCalls({ ...base, usedThisMonth: 44000, ticksLeft: 1 })).toBe(60);
  });

  it("counts this UTC month's calls and starts the tick on the paced budget", async () => {
    const m = await migratedDb();
    await recordMetrcCall(m.db, { started_at: "2026-09-30T23:59:59.000Z", path: "/x", status: 200, ms: 1 });
    await recordMetrcCall(m.db, { started_at: "2026-10-01T00:00:00.000Z", path: "/x", status: 200, ms: 1 });
    await recordMetrcCall(m.db, { started_at: "2026-10-08T09:00:00.000Z", path: "/x", status: 429, ms: 1 });
    expect(await callsThisMonth(m.db, "2026-10-08T10:30:00.000Z")).toBe(2);
    // A18: the month pace counts one host; rows written before 0098 (host null) count on every host.
    await recordMetrcCall(m.db, { started_at: "2026-10-08T09:10:00.000Z", path: "/x", status: 200, ms: 1 }, "api-mi.metrc.com");
    await recordMetrcCall(m.db, { started_at: "2026-10-08T09:20:00.000Z", path: "/x", status: 200, ms: 1 }, "sandbox-api-mi.metrc.com");
    expect(m.all(`SELECT host FROM metrc_api_calls WHERE host IS NOT NULL ORDER BY host`).map((row) => row.host)).toEqual(["api-mi.metrc.com", "sandbox-api-mi.metrc.com"]);
    expect(await callsThisMonth(m.db, "2026-10-08T10:30:00.000Z", "api-mi.metrc.com")).toBe(3);
    expect(await callsThisMonth(m.db, "2026-10-08T10:30:00.000Z", "sandbox-api-mi.metrc.com")).toBe(3);
    expect(await callsThisMonth(m.db, "2026-10-08T10:30:00.000Z", "other.example")).toBe(2);
    expect(await callsThisMonth(m.db, "2026-10-08T10:30:00.000Z")).toBe(4);
    expect((await startTickBudget(m.db, { ...METRC_SWEEP_DEFAULTS, monthCalls: 5662 }, "2026-10-08T10:30:00.000Z", 3, () => 0, "other.example")).usedThisMonth).toBe(2);
    m.run(`DELETE FROM metrc_api_calls WHERE host IS NOT NULL`);
    const config = await loadMetrcSweepConfig(m.db);
    const started = await startTickBudget(m.db, { ...config, monthCalls: 5662 }, "2026-10-08T10:30:00.000Z", 3, () => 0);
    expect(started.usedThisMonth).toBe(2);
    expect(started.calls).toBe(10);
    expect(started.budget.limits).toEqual({ calls: 10, licenseCalls: 20, rows: 3000, wallMs: 240000, d1: 700 });
  });

  it("reads the Law 5 keys from the 0096 seeds and falls back on a bad value", async () => {
    const m = await migratedDb();
    expect(await loadMetrcSweepConfig(m.db)).toEqual(METRC_SWEEP_DEFAULTS);
    m.run(`UPDATE app_config SET value = '80' WHERE key = 'metrc_page_size'`);
    m.run(`UPDATE app_config SET value = 'lots' WHERE key = 'metrc_tick_calls'`);
    m.run(`UPDATE app_config SET value = '2' WHERE key = 'metrc_gone_hold_share'`);
    m.run(`UPDATE app_config SET value = '0' WHERE key = 'metrc_window_overlap_minutes'`);
    m.run(`UPDATE app_config SET value = 'write' WHERE key = 'metrc_sweep_mode'`);
    m.run(`UPDATE app_config SET deleted_at = '2026-10-08T00:00:00.000Z' WHERE key = 'metrc_full_plants_hours'`);
    const config = await loadMetrcSweepConfig(m.db);
    expect(config).toMatchObject({ pageSize: 50, tickCalls: 60, goneHoldShare: 0.5, windowOverlapMinutes: 0, sweepMode: "write", fullPlantsHours: 168 });
    expect(metrcWholeOf("2.5", 7)).toBe(7);
    expect(metrcWholeOf("0", 7)).toBe(7);
    expect(metrcWholeOf("0", 7, 0)).toBe(0);
    expect(metrcShareOf("0.25", 0.5)).toBe(0.25);
    expect(metrcShareOf("-0.1", 0.5)).toBe(0.5);
    // 17 Law 5 seeds from 0096, plus the two Law 8 seeds of 0098 (metrc_eval_max_calls, metrc_eval_window_days).
    const seeded = m.all(`SELECT key FROM app_config WHERE key LIKE 'metrc\\_%' ESCAPE '\\' AND key != 'metrc_release_states' ORDER BY key`);
    expect(seeded).toHaveLength(19);
    expect(seeded.map((row) => row.key)).toEqual(expect.arrayContaining(["metrc_eval_max_calls", "metrc_eval_window_days"]));
    expect(m.all(`PRAGMA table_info(metrc_mounts)`).find((col) => col.name === "source")).toMatchObject({ dflt_value: "'file'", notnull: 1 });
  });
});

describe("MA1 Phase B fixes: cursors, passes and windows", () => {
  it("an incremental that loaded its copy before a full pass finished never brings the pass back or undoes gone_override", async () => {
    const m = await migratedDb();
    const s = scope();
    const full = fakeMetrc((call) => page(labels(`F${call.page}-`, call.page < 3 ? 50 : 10), call.page, 3, 110));
    const tick1 = await runFullPass(s, deps(m, { fetchImpl: full.fetchImpl, budget: MetrcBudget.start(limits({ calls: 2 }), () => 0) }));
    expect(tick1).toMatchObject({ complete: false, status: "budget" });
    m.run(`UPDATE metrc_cursors SET hwm_end = '2026-10-08T09:00:00Z'`);
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let waiting = false;
    const slow = (async () => {
      waiting = true;
      await gate;
      return page([], 1, 0, 0);
    }) as typeof fetch;
    const inc = runIncremental(s, deps(m, { fetchImpl: slow }));
    for (let i = 0; i < 200 && !waiting; i++) await new Promise((resolve) => setTimeout(resolve, 1));
    expect(waiting).toBe(true);
    // While the incremental waits on Metrc, the pass finishes and the Admin page sets gone_override.
    const done = await runFullPass(s, deps(m, { fetchImpl: full.fetchImpl, now: () => "2026-10-08T11:00:00.000Z" }));
    expect(done.complete).toBe(true);
    m.run(`UPDATE metrc_cursors SET gone_override = 1`);
    release();
    expect((await inc).status).toBe("ok");
    expect(await loadCursor(m.db, s)).toMatchObject({
      full_pass_id: null,
      full_page: 0,
      full_completed_at: "2026-10-08T11:00:00Z",
      hwm_end: "2026-10-08T10:00:00Z",
      gone_override: 1,
    });
    expect(m.all(`SELECT * FROM metrc_pass_pages`)).toHaveLength(0);
    const next = await runFullPass(s, deps(m, { fetchImpl: full.fetchImpl, now: () => "2026-10-09T10:00:00.000Z" }));
    expect(next.complete && next.seenTags.size).toBe(110);
    expect((await loadCursor(m.db, s))?.gone_override).toBe(1);

    // The other order: a pass that loaded the old mark finishes after an
    // incremental moved it, and the mark stays where the incremental left it.
    const s2 = scope({ license: "AU-P-000694" });
    await seedMark(m, s2, "2026-10-08T09:00:00Z");
    let releasePass: () => void = () => undefined;
    const passGate = new Promise<void>((resolve) => {
      releasePass = resolve;
    });
    let passWaiting = false;
    const slowPass = (async () => {
      passWaiting = true;
      await passGate;
      return page(labels("Q", 5), 1);
    }) as typeof fetch;
    const pass = runFullPass(s2, deps(m, { fetchImpl: slowPass }));
    for (let i = 0; i < 200 && !passWaiting; i++) await new Promise((resolve) => setTimeout(resolve, 1));
    expect(passWaiting).toBe(true);
    const quick = fakeMetrc((call) => page([], call.page, 0, 0));
    expect(await runIncremental(s2, deps(m, { fetchImpl: quick.fetchImpl, now: () => "2026-10-08T10:30:00.000Z" }))).toMatchObject({ status: "ok", windows: 1 });
    releasePass();
    expect((await pass).complete).toBe(true);
    expect((await loadCursor(m.db, s2))?.hwm_end).toBe("2026-10-08T10:30:00Z");
  });

  it("a dry_run read never moves the write cursor of the same scope (A26)", async () => {
    const m = await migratedDb();
    const write = scope({ host: PROD_HOST, mode: "write" });
    const dry = scope({ host: PROD_HOST, mode: "dry_run" });
    await seedMark(m, write, "2026-10-08T09:00:00Z");
    await seedMark(m, dry, "2026-10-08T09:00:00Z");
    const before = await loadCursor(m.db, write);
    const { fetchImpl } = fakeMetrc((call) => page(labels("D", 3), call.page));
    expect((await runIncremental(dry, deps(m, { fetchImpl, env: PROD_ENV }))).status).toBe("ok");
    expect((await runFullPass(dry, deps(m, { fetchImpl, env: PROD_ENV }))).complete).toBe(true);
    expect(await loadCursor(m.db, write)).toEqual(before);
    expect((await loadCursor(m.db, dry))?.hwm_end).toBe("2026-10-08T10:00:00Z");
  });

  it("Phase C ruling C2: TotalPages is authoritative, so short pages read on to the last page and only 0 rows before it is short", async () => {
    const m = await migratedDb();
    // A server that pages by 20 although 50 was asked: 13 pages are read, every row kept.
    const { calls, fetchImpl } = fakeMetrc((call) => page(labels(`S${call.page}-`, 20), call.page, 13, 260));
    const pass = await runFullPass(scope(), deps(m, { fetchImpl }));
    expect(pass).toMatchObject({ complete: true, pages: 13, rows: 260 });
    expect(calls.map((call) => call.page)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]);
    if (pass.complete) expect(pass.seenTags.size).toBe(260);
    expect(m.all(`SELECT * FROM metrc_pass_pages`)).toHaveLength(0);
    // A 5-page series whose pages carry 49 rows each completes with all 245 rows.
    const s = scope({ license: "AU-P-000694" });
    const p49 = fakeMetrc((call) => page(labels(`T${call.page}-`, 49), call.page, 5, 245));
    const five = await runFullPass(s, deps(m, { fetchImpl: p49.fetchImpl }));
    expect(five).toMatchObject({ complete: true, pages: 5, rows: 245 });
    if (five.complete) expect(five.seenTags.size).toBe(245);
    expect(p49.calls.map((call) => call.page)).toEqual([1, 2, 3, 4, 5]);
    // A page of 0 rows while TotalPages names more is "short": the pass is dropped and due again at its cadence.
    const s3 = scope({ license: "GR-C-001132" });
    const p0 = fakeMetrc((call) => page(labels(`Z${call.page}-`, call.page === 2 ? 0 : 50), call.page, 5, 249));
    const short = await runFullPass(s3, deps(m, { fetchImpl: p0.fetchImpl }));
    expect(short).toMatchObject({ complete: false, status: "short", message: SHORT_PASS_WORDS, pages: 2 });
    expect(p0.calls).toHaveLength(2);
    expect(await loadCursor(m.db, s3)).toMatchObject({ full_pass_id: null, full_page: 0, hwm_end: null, last_status: "short", full_due_at: "2026-10-09T10:00:00Z" });
    expect(m.all(`SELECT * FROM metrc_pass_pages`)).toHaveLength(0);
    // The same rule in an incremental: short pages read on to TotalPages, and the mark moves only then.
    const s4 = scope({ license: "GR-C-001405" });
    await seedMark(m, s4, "2026-10-08T09:00:00Z");
    const inc = fakeMetrc((call) => page(labels(`I${call.page}-`, 20), call.page, 3, 60));
    expect(await runIncremental(s4, deps(m, { fetchImpl: inc.fetchImpl }))).toMatchObject({ status: "ok", pages: 3, rows: 60, windows: 1 });
    expect(inc.calls.map((call) => call.page)).toEqual([1, 2, 3]);
    expect((await loadCursor(m.db, s4))?.hwm_end).toBe("2026-10-08T10:00:00Z");
    // A bare-array short page still stops; an envelope without TotalPages keeps the short-page stop.
    const s5 = scope({ license: "AU-G-C-001397" });
    await seedMark(m, s5, "2026-10-08T09:00:00Z");
    const bare = fakeMetrc(() => new Response(JSON.stringify(labels("B", 7)), { status: 200 }));
    expect(await runIncremental(s5, deps(m, { fetchImpl: bare.fetchImpl }))).toMatchObject({ status: "ok", pages: 1, rows: 7, windows: 1 });
    expect(bare.calls).toHaveLength(1);
    expect(shortBeforeLastPage({ rows: labels("A", 49), page: 5, totalPages: 5, totalRecords: 249, bare: false }, 50)).toBe(false);
    expect(shortBeforeLastPage({ rows: labels("A", 20), page: 1, totalPages: null, totalRecords: null, bare: false }, 50)).toBe(false);
    expect(shortBeforeLastPage({ rows: labels("A", 20), page: 1, totalPages: 13, totalRecords: 249, bare: false }, 50)).toBe(false);
    expect(shortBeforeLastPage({ rows: [], page: 1, totalPages: 13, totalRecords: 249, bare: false }, 50)).toBe(true);
    expect(shortBeforeLastPage({ rows: [], page: 13, totalPages: 13, totalRecords: 249, bare: false }, 50)).toBe(false);
  });

  it("Phase C ruling C2 in an incremental: 0 rows before TotalPages keeps the mark and the page, says short, and the next tick re-reads that page", async () => {
    const m = await migratedDb();
    const s = scope({ license: "GR-C-002600" });
    await seedMark(m, s, "2026-10-08T09:00:00Z");
    // Page 2 of 3 answers 0 rows once; page 3 carries 50 rows the mark must not pass.
    let glitch = true;
    const { calls, fetchImpl } = fakeMetrc((call) => page(labels(`G${call.page}-`, call.page === 2 && glitch ? 0 : 50), call.page, 3, 150));
    const first = await runIncremental(s, deps(m, { fetchImpl }));
    expect(first).toMatchObject({ status: "short", message: SHORT_WINDOW_WORDS, pages: 2, rows: 50, windows: 0 });
    expect(await loadCursor(m.db, s)).toMatchObject({
      hwm_end: "2026-10-08T09:00:00Z",
      win_start: "2026-10-08T08:55:00Z",
      win_end: "2026-10-08T10:00:00Z",
      win_page: 2,
      last_status: "short",
      failures: 1,
    });
    glitch = false;
    const second = await runIncremental(s, deps(m, { fetchImpl }));
    expect(second).toMatchObject({ status: "ok", pages: 2, rows: 100, windows: 1 });
    expect(calls.map((call) => call.page)).toEqual([1, 2, 2, 3]);
    expect(await loadCursor(m.db, s)).toMatchObject({ hwm_end: "2026-10-08T10:00:00Z", win_start: null, win_end: null, win_page: 0, last_status: "ok", failures: 0 });
    // 0 rows on the last page TotalPages names is a window read whole: the mark moves.
    const s2 = scope({ license: "AU-G-C-001509" });
    await seedMark(m, s2, "2026-10-08T09:00:00Z");
    const lastEmpty = fakeMetrc((call) => page(labels(`L${call.page}-`, call.page === 3 ? 0 : 50), call.page, 3, 100));
    expect(await runIncremental(s2, deps(m, { fetchImpl: lastEmpty.fetchImpl }))).toMatchObject({ status: "ok", pages: 3, rows: 100, windows: 1 });
    expect((await loadCursor(m.db, s2))?.hwm_end).toBe("2026-10-08T10:00:00Z");
  });

  it("keeps a pass's seen keys upper-cased like the mirror's tags, and the Id as text where a row has no Label", async () => {
    const m = await migratedDb();
    const { fetchImpl } = fakeMetrc(() => page([{ Label: "abcdef012345670000000024" }, { Label: " ABCDEF012345670000000025 " }, { Id: 7 }, { Id: 8, Label: null }, { Name: "no key" }], 1, 1, 5));
    const pass = await runFullPass(scope({ kind: "harvests", endpoint: "/harvests/v2/active" }), deps(m, { fetchImpl }));
    expect(pass.complete && [...pass.seenTags].sort()).toEqual(["7", "8", "ABCDEF012345670000000024", "ABCDEF012345670000000025"]);
  });

  it("stops at TotalPages when the server echoes Page 1 on every page", async () => {
    expect(parseEnvelope({ Data: [1], Page: 1, TotalPages: 3 }, 3)).toMatchObject({ page: 3, totalPages: 3 });
    const m = await migratedDb();
    const { calls, fetchImpl } = fakeMetrc((_call, n) => page(labels(`E${n}-`, 50), 1, 3, 150));
    const pass = await runFullPass(scope(), deps(m, { fetchImpl, pageCeiling: 8 }));
    expect(pass.complete && pass.seenTags.size).toBe(150);
    expect(calls.map((call) => call.page)).toEqual([1, 2, 3]);
  });

  it("halves a window to a floor that still moves the mark", () => {
    expect(halveWindow("2026-10-08T08:55:00Z", "2026-10-08T10:00:00Z", "2026-10-08T09:00:00Z")).toBe("2026-10-08T09:27:30Z");
    expect(halveWindow("2026-10-08T08:55:00Z", "2026-10-08T09:03:07Z", "2026-10-08T09:00:00Z")).toBeNull();
    expect(halveWindow("2026-10-08T10:00:00Z", "2026-10-08T10:00:00Z", null)).toBeNull();
  });

  it("replaces a soft-deleted cursor with a fresh one, and a D1 error ends the scope as failed without throwing", async () => {
    const m = await migratedDb();
    const s = scope();
    await seedMark(m, s, "2026-10-08T09:00:00Z");
    m.run(`UPDATE metrc_cursors SET deleted_at = '2026-10-08T09:30:00Z'`);
    const { calls, fetchImpl } = fakeMetrc((call) => page([], call.page, 0, 0));
    expect(await runIncremental(s, deps(m, { fetchImpl }))).toMatchObject({ status: "needs_full", message: NEEDS_FULL_WORDS });
    expect(m.all(`SELECT deleted_at FROM metrc_cursors ORDER BY created_at`).map((row) => row.deleted_at)).toEqual(["2026-10-08T09:30:00Z", null]);
    expect((await runFullPass(s, deps(m, { fetchImpl }))).complete).toBe(true);
    expect(calls).toHaveLength(1);

    const failingBatch = {
      prepare: (sql: string) => m.db.prepare(sql),
      batch: async () => {
        throw new Error("D1_ERROR: the batch failed near fake-user-key");
      },
    } as unknown as D1Database;
    const s2 = scope({ license: "AU-P-000694" });
    const pages = fakeMetrc((call) => page(labels("X", 50), call.page, 3));
    const full = await runFullPass(s2, deps(m, { db: failingBatch, fetchImpl: pages.fetchImpl }));
    expect(full).toMatchObject({ complete: false, status: "failed", pages: 1 });
    expect(full.complete ? "" : full.message).toContain("D1_ERROR");
    expect(full.complete ? "" : full.message).not.toContain("fake-user-key");

    const failingUpdate = {
      prepare: (sql: string) => {
        if (sql.includes("UPDATE metrc_cursors")) throw new Error("D1_ERROR: the cursor could not be saved");
        return m.db.prepare(sql);
      },
      batch: m.db.batch,
    } as unknown as D1Database;
    const s3 = scope({ license: "GR-C-001132" });
    await seedMark(m, s3, "2026-10-08T09:00:00Z");
    const inc = await runIncremental(s3, deps(m, { db: failingUpdate, fetchImpl }));
    expect(inc).toMatchObject({ status: "failed", message: "D1_ERROR: the cursor could not be saved" });
  });

  it("keeps a pass at its last page when onComplete fails, and the next tick re-reads that page, never one past it", async () => {
    const m = await migratedDb();
    const s = scope();
    const { calls, fetchImpl } = fakeMetrc((call) =>
      call.page > 3 ? new Response("", { status: 400 }) : page(labels(`F${call.page}-`, call.page < 3 ? 50 : 10), call.page, 3, 110)
    );
    let fail = true;
    const onComplete = async (): Promise<void> => {
      if (fail) throw new Error("gone marking failed");
    };
    const r1 = await runFullPass(s, deps(m, { fetchImpl, onComplete }));
    expect(r1).toMatchObject({ complete: false, status: "failed" });
    const mid = await loadCursor(m.db, s);
    expect(mid).toMatchObject({ full_page: 3, last_status: "failed", failures: 1, full_completed_at: null, full_due_at: null });
    expect(mid?.full_pass_id).toBeTruthy();
    expect(m.all(`SELECT page FROM metrc_pass_pages ORDER BY page`).map((row) => row.page)).toEqual([1, 2, 3]);
    fail = false;
    const r2 = await runFullPass(s, deps(m, { fetchImpl, onComplete }));
    expect(r2.complete).toBe(true);
    if (!r2.complete) throw new Error("expected a complete pass");
    expect(r2.passId).toBe(mid?.full_pass_id);
    expect(r2.seenTags.size).toBe(110);
    expect(calls.map((call) => call.page)).toEqual([1, 2, 3, 3]);
  });

  it("refuses a write scope on a sandbox host: no call, no cursor (Law 3)", async () => {
    const m = await migratedDb();
    const { calls, fetchImpl } = fakeMetrc((call) => page([], call.page, 0, 0));
    const write = scope({ mode: "write" });
    expect(await runIncremental(write, deps(m, { fetchImpl }))).toMatchObject({ status: "mode_refused", message: WRITE_SCOPE_WORDS });
    expect(await runFullPass(write, deps(m, { fetchImpl }))).toMatchObject({ complete: false, status: "mode_refused", message: WRITE_SCOPE_WORDS });
    expect(calls).toHaveLength(0);
    expect(m.all(`SELECT * FROM metrc_cursors`)).toHaveLength(0);
    expect((await runFullPass(scope({ host: PROD_HOST, mode: "write" }), deps(m, { fetchImpl, env: PROD_ENV }))).complete).toBe(true);
  });

  it("refuses a scope endpoint that leaves the METRC origin: no call, no record", async () => {
    const m = await migratedDb();
    const { calls, fetchImpl } = fakeMetrc(() => page([], 1));
    for (const endpoint of ["//evil.example/packages/v2/active", "https://api-mi.metrc.com/packages/v2/active", "\\\\evil.example\\x"]) {
      expect(await runFullPass(scope({ endpoint }), deps(m, { fetchImpl }))).toMatchObject({ complete: false, status: "host_refused", message: METRC_HOST_REFUSAL });
    }
    expect(calls).toHaveLength(0);
    expect(m.all(`SELECT * FROM metrc_api_calls`)).toHaveLength(0);
  });

  it("fails a 3xx page and a key the Basic header cannot carry, the key with no call", async () => {
    const modes: Array<string | undefined> = [];
    const redirect = (async (_url: string, init?: RequestInit) => {
      modes.push(init?.redirect);
      return new Response(JSON.stringify({ Data: [], TotalPages: 1 }), { status: 302, headers: { Location: "https://evil.example/" } });
    }) as typeof fetch;
    const r = await readMetrcPage({ env: ENV, path: "/packages/v2/active", query: {}, page: 1, pageSize: 50, fetchImpl: redirect });
    expect(r).toMatchObject({ kind: "failed", status: 302 });
    expect(modes).toEqual(["manual"]);
    const odd = fakeMetrc(() => page([], 1));
    const k = await readMetrcPage({ env: { ...ENV, METRC_USER_KEY: "fake-user-key​" }, path: "/packages/v2/active", query: {}, page: 1, pageSize: 50, fetchImpl: odd.fetchImpl });
    expect(k).toEqual({ kind: "failed", status: 0, message: KEY_CHARACTER_REFUSAL });
    expect(odd.calls).toHaveLength(0);
  });
});

describe("MA1 Phase B fixes: the budget inside the runs", () => {
  it("an incremental stops at its license cap while the next license still reads", async () => {
    const m = await migratedDb();
    const a = scope({ license: "AU-G-C-000832" });
    const b = scope({ license: "AU-P-000694" });
    await seedMark(m, a, "2026-10-05T10:00:00Z");
    await seedMark(m, b, "2026-10-05T10:00:00Z");
    const { calls, fetchImpl } = fakeMetrc((call) => page([], call.page, 0, 0));
    const budget = MetrcBudget.start(limits({ licenseCalls: 2 }), () => 0);
    const ra = await runIncremental(a, deps(m, { fetchImpl, budget }));
    expect(ra).toMatchObject({ status: "budget", windows: 2 });
    expect(ra.message).toContain("license_calls");
    expect(await runIncremental(b, deps(m, { fetchImpl, budget }))).toMatchObject({ status: "budget", windows: 2 });
    expect(calls.map((call) => call.license)).toEqual(["AU-G-C-000832", "AU-G-C-000832", "AU-P-000694", "AU-P-000694"]);
  });

  it("both runs stop on the tick's rows cap, and a full pass on its D1 cap", async () => {
    const m = await migratedDb();
    const { fetchImpl } = fakeMetrc((call) => page(labels(`R${call.page}-`, 50), call.page, 9, 450));
    const full = await runFullPass(scope(), deps(m, { fetchImpl, budget: MetrcBudget.start(limits({ rows: 100 }), () => 0) }));
    expect(full).toMatchObject({ complete: false, status: "budget", pages: 2 });
    expect(full.complete ? "" : full.message).toContain("(rows)");
    const s = scope({ license: "AU-P-000694" });
    await seedMark(m, s, "2026-10-08T09:00:00Z");
    const inc = await runIncremental(s, deps(m, { fetchImpl, budget: MetrcBudget.start(limits({ rows: 100 }), () => 0) }));
    expect(inc).toMatchObject({ status: "budget", pages: 2, windows: 0 });
    expect(inc.message).toContain("(rows)");
    const d1 = await runFullPass(scope({ license: "GR-C-001132" }), deps(m, { fetchImpl, budget: MetrcBudget.start(limits({ d1: 9 }), () => 0) }));
    expect(d1).toMatchObject({ complete: false, status: "budget", pages: 2 });
    expect(d1.complete ? "" : d1.message).toContain("(d1)");
  });

  it("starts the tick on one call per scope when the month is spent", async () => {
    const m = await migratedDb();
    const config = await loadMetrcSweepConfig(m.db);
    const started = await startTickBudget(m.db, { ...config, monthCalls: 3 }, "2026-10-08T10:30:00.000Z", 5, () => 0);
    expect(started.calls).toBe(5);
    expect(started.budget.limits.calls).toBe(5);
  });

  it("a complete pass over a cursor that has a mark leaves the mark where it was", async () => {
    const m = await migratedDb();
    const s = scope();
    await seedMark(m, s, "2026-10-08T09:30:00Z");
    const { fetchImpl } = fakeMetrc((call) => page(labels("K", 10), call.page));
    expect((await runFullPass(s, deps(m, { fetchImpl }))).complete).toBe(true);
    expect((await loadCursor(m.db, s))?.hwm_end).toBe("2026-10-08T09:30:00Z");
  });

  it("dues each kind on its own cadence, counted from the pass's start", async () => {
    const cfg = { ...METRC_SWEEP_DEFAULTS, fullPackagesHours: 1, fullHarvestsHours: 2, fullPlantsHours: 3 };
    expect((["packages", "harvests", "plants"] as const).map((kind) => fullCadenceHours(cfg, kind))).toEqual([1, 2, 3]);
    const m = await migratedDb();
    const plants = scope({ kind: "plants", endpoint: "/plants/v2/vegetative", phase: "vegetative" });
    const { fetchImpl } = fakeMetrc((call) => page(labels("PL", 5), call.page));
    expect((await runFullPass(plants, deps(m, { fetchImpl }))).complete).toBe(true);
    expect((await loadCursor(m.db, plants))?.full_due_at).toBe("2026-10-15T09:55:00Z");
  });

  it("needs a full pass for a mark with no due date, and at a due time equal to now", () => {
    expect(needsFullPass({ hwm_end: "2026-10-08T09:00:00Z", full_pass_id: null, full_due_at: null }, NOW)).toBe(true);
    expect(needsFullPass({ hwm_end: "2026-10-08T09:00:00Z", full_pass_id: null, full_due_at: "2026-10-08T10:00:00Z" }, "2026-10-08T10:00:00Z")).toBe(true);
    expect(needsFullPass({ hwm_end: null, full_pass_id: null, full_due_at: null }, NOW)).toBe(true);
  });

  it("a consumer failure in an incremental keeps the page and the mark, scrubbed, and the next tick retries that page", async () => {
    const m = await migratedDb();
    const s = scope();
    await seedMark(m, s, "2026-10-08T09:00:00Z");
    const { calls, fetchImpl } = fakeMetrc((call) => page(labels(`W${call.page}-`, call.page <= 2 ? 50 : 10), call.page));
    const failing = deps(m, {
      fetchImpl,
      onPage: async (_rows, ctx) => {
        if (ctx.page === 2) throw new Error("consumer failed near fake-user-key");
      },
    });
    const r1 = await runIncremental(s, failing);
    expect(r1).toMatchObject({ status: "failed", pages: 2, windows: 0 });
    expect(r1.message).not.toContain("fake-user-key");
    expect(await loadCursor(m.db, s)).toMatchObject({
      hwm_end: "2026-10-08T09:00:00Z",
      win_start: "2026-10-08T08:55:00Z",
      win_end: "2026-10-08T10:00:00Z",
      win_page: 2,
      last_status: "failed",
      failures: 1,
    });
    expect(await runIncremental(s, deps(m, { fetchImpl }))).toMatchObject({ status: "ok", windows: 1 });
    expect(calls.map((call) => call.page)).toEqual([1, 2, 2, 3]);
  });

  it("a consumer failure in a full pass keeps the pass at its page", async () => {
    const m = await migratedDb();
    const s = scope();
    const { calls, fetchImpl } = fakeMetrc((call) => page(labels(`F${call.page}-`, call.page < 3 ? 50 : 10), call.page, 3, 110));
    const r1 = await runFullPass(
      s,
      deps(m, {
        fetchImpl,
        onPage: async (_rows, ctx) => {
          if (ctx.page === 2) throw new Error("consumer failed");
        },
      })
    );
    expect(r1).toMatchObject({ complete: false, status: "failed", pages: 2 });
    const mid = await loadCursor(m.db, s);
    expect(mid).toMatchObject({ full_page: 2, last_status: "failed", failures: 1, full_completed_at: null });
    expect(mid?.full_pass_id).toBeTruthy();
    const r2 = await runFullPass(s, deps(m, { fetchImpl }));
    expect(r2.complete).toBe(true);
    if (!r2.complete) throw new Error("expected a complete pass");
    expect(r2.passId).toBe(mid?.full_pass_id);
    expect(r2.seenTags.size).toBe(110);
    expect(calls.map((call) => call.page)).toEqual([1, 2, 2, 3]);
  });

  it("a 429 in the middle of a full pass keeps the pass and resumes it at that page", async () => {
    const m = await migratedDb();
    const s = scope();
    let blocked = true;
    const { calls, fetchImpl } = fakeMetrc((call) => {
      if (call.page === 2 && blocked) return new Response("", { status: 429, headers: { "Retry-After": "1" } });
      return page(labels(`F${call.page}-`, call.page < 3 ? 50 : 10), call.page, 3, 110);
    });
    expect(await runFullPass(s, deps(m, { fetchImpl }))).toMatchObject({ complete: false, status: "rate_limited", pages: 1 });
    const mid = await loadCursor(m.db, s);
    expect(mid).toMatchObject({ full_page: 2, last_status: "retry_after" });
    expect(mid?.full_pass_id).toBeTruthy();
    blocked = false;
    const r2 = await runFullPass(s, deps(m, { fetchImpl }));
    expect(r2.complete).toBe(true);
    if (!r2.complete) throw new Error("expected a complete pass");
    expect(r2.passId).toBe(mid?.full_pass_id);
    expect(r2.seenTags.has("F1-0000")).toBe(true);
    expect(calls.map((call) => call.page)).toEqual([1, 2, 2, 2, 3]);
  });

  it("a second 429 on page 2 of a window keeps win_page 2", async () => {
    const m = await migratedDb();
    const s = scope();
    await seedMark(m, s, "2026-10-08T09:00:00Z");
    const { fetchImpl } = fakeMetrc((call) => (call.page === 2 ? new Response("", { status: 429, headers: { "Retry-After": "1" } }) : page(labels("W", 50), call.page)));
    expect(await runIncremental(s, deps(m, { fetchImpl }))).toMatchObject({ status: "rate_limited", pages: 1 });
    expect(await loadCursor(m.db, s)).toMatchObject({ hwm_end: "2026-10-08T09:00:00Z", win_page: 2, last_status: "retry_after", failures: 0 });
  });

  it("reads a 403 as a refusal like a 401", async () => {
    const { fetchImpl } = fakeMetrc(() => new Response("", { status: 403 }));
    expect(await readMetrcPage({ env: ENV, path: "/packages/v2/active", query: {}, page: 1, pageSize: 50, fetchImpl })).toMatchObject({ kind: "refused", status: 403 });
  });
});
