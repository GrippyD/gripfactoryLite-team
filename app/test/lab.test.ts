import { describe, expect, it } from "vitest";
import type { Identity } from "../src/identity";
import {
  AUTOFILL_MAX_IDS,
  autofillCsv,
  handleLab,
  LAB_API_PREFIX,
  LAB_FEED_PATHS,
  listLabComplianceSurface,
  metrcToday,
  type LabComplianceListRow,
  type LabComplianceRow,
  type LabInternalTestRow,
  type LabMetrcPackage,
  type LabOperatorName,
  type LabOpRow,
  type LabScheduleRow,
  type LabWho,
} from "../src/lab";
import * as R from "../src/labrules";
import { SERVICE_IDENTITY } from "../src/service";
import { migratedDb, seedMirror, seedPerson, type MigratedDb } from "./migrated";

// THE LAB STATION (canon 0.30.362): the package's 14 handler tests
// (lab_handlers.test.mjs) on the app's migrated database, with synthetic rows
// only (brief law 8: no seed). Each case names its adaptation. Then the
// brief's own cases: the change log, the typed fallback, the Metrc lookup on
// metrc_packages, grams, the import's statement count.

const BASE = "https://x";

type Fail = { ok: false; error: string; row?: unknown; missing?: string[]; max?: number; detail?: string };
type Created<T> = { ok: true; created: boolean; row: T };
type Patched<T> = { ok: true; row: T; unchanged?: boolean };
type Rows<T> = { ok: true; rows: T[] };
type FeedRow = { id?: string; test_id?: string; changed_at: string; voided_at?: string | null; raw?: Record<string, string> | null; raw_json?: string };
type Feed = { feed: string; since: string; count: number; next_since: string; more: boolean; run_completed: number; rows: FeedRow[] };
type Imported = { ok: true; rows: number; landed: number; already_there: number; duplicate_in_file: number; refused_count: number; refused: { line: number; error: string }[] };
type LogRow = { record_table: string; record_id: string; field: string; old_value: string | null; new_value: string | null; actor_person_id: string | null; reason: string; id: string };

type Station = {
  db: D1Database;
  raw: (method: string, path: string, body?: unknown, headers?: Record<string, string>) => Promise<Response>;
  call: <T>(method: string, path: string, body?: unknown, headers?: Record<string, string>) => Promise<{ status: number; body: T }>;
};

function must(res: Response | null): Response {
  if (!res) throw new Error("handleLab answered null");
  return res;
}

/** The package's call() helper: the page's headers, one actor (or none for the typed fallback). */
function station(db: D1Database, who: Identity | null): Station {
  const raw = async (method: string, path: string, body?: unknown, headers: Record<string, string> = {}): Promise<Response> =>
    must(
      await handleLab(
        new Request(BASE + path, {
          method,
          headers: { "content-type": typeof body === "string" ? "text/csv" : "application/json", "x-lab-client": "station", ...headers },
          body: body == null ? undefined : typeof body === "string" ? body : JSON.stringify(body),
        }),
        db,
        who
      )
    );
  const call = async <T>(method: string, path: string, body?: unknown, headers?: Record<string, string>) => {
    const res = await raw(method, path, body, headers);
    return { status: res.status, body: (await res.json()) as T };
  };
  return { db, raw, call };
}

async function setup(): Promise<{ m: MigratedDb; who: Identity; lab: Station }> {
  const m = await migratedDb();
  const who: Identity = { id: seedPerson(m), display_name: "Smoke Hand", email: "bench@example.test" };
  return { m, who, lab: station(m.db, who) };
}

const logsFor = (m: MigratedDb, table: string, id: string): LogRow[] =>
  m.all("SELECT * FROM record_change_log WHERE record_table = ? AND record_id = ? ORDER BY rowid", table, id) as LogRow[];

const logCount = (m: MigratedDb): number => Number(m.get("SELECT COUNT(*) AS n FROM record_change_log")?.n);

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

/** A bench row as a workbook load writes it (the shape the seed carries), straight into the table. */
function benchRow(m: MigratedDb, over: Partial<LabInternalTestRow> & { id: string }): void {
  const r = {
    tested_at: "2026-09-20T12:00:00.000Z",
    tested_at_source: "sheet",
    location: "Silo 1",
    reason: "During Silo",
    license: null,
    metrc_tag: null,
    metrc_tag_raw: null,
    sample_type: "Flower",
    moisture_pct: 12,
    notes: "",
    source: "workbook",
    created_at: "2026-09-20T12:00:00.000Z",
    updated_at: "2026-09-20T12:00:00.000Z",
    changed_at: "2026-09-20T12:00:00.000Z",
    ...over,
  };
  m.run(
    `INSERT INTO lab_internal_tests (id, tested_at, tested_at_source, location, reason, license, metrc_tag, metrc_tag_raw, sample_type, moisture_pct, notes, source, sheet_name, sheet_row, created_at, updated_at, changed_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'In Testing (2026)', 2, ?, ?, ?)`,
    r.id,
    r.tested_at,
    r.tested_at_source,
    r.location,
    r.reason,
    r.license,
    r.metrc_tag,
    r.metrc_tag_raw,
    r.sample_type,
    r.moisture_pct,
    r.notes,
    r.source,
    r.created_at,
    r.updated_at,
    r.changed_at
  );
}

const OP_HEADER_LINE = R.OP_HEADER.join(",");
/** One LightLab export line in OP_HEADER order. */
const opLine = (id: string, notes: string, thca: string, terp: string): string =>
  [id, "LL030540", "2026-10-02", "09:04:31-04:00", "27999", "", "", "Plant", "0.3 g", "30 ml", "0", "23.7 \u00B0C", "%", notes, "GOOD", thca, "1", "ND", "ND", "1", "n/a", "ND", "0.5", "ND", "1.6", "ND", "--", "n/a", "1.3", "ND", terp, "23.4", "ND", "31"].join(",");

describe("lab handlers (the package's 14)", () => {
  it("routes: the module owns only its paths and serves the page", async () => {
    // Adaptation: the page is the Internal tab (labpage.ts) and index.ts answers
    // /station/lab_tests with its redirect, so handleLab owns only the API and the feeds.
    const { m } = await setup();
    expect(await handleLab(new Request(BASE + "/station/trim_packages"), m.db, null)).toBe(null);
    expect(await handleLab(new Request(BASE + "/feeds/trim-weighs.json"), m.db, null)).toBe(null);
    expect(await handleLab(new Request(BASE + "/station/lab_tests"), m.db, null)).toBe(null);
    expect(LAB_API_PREFIX).toBe("/api/lab/");
    expect([...LAB_FEED_PATHS]).toStrictEqual(["/feeds/lab-internal-tests.json", "/feeds/lab-compliance.json", "/feeds/lab-op-results.json"]);
    const nf = await station(m.db, null).call<Fail>("GET", "/api/lab/nope");
    expect(nf.status).toBe(404);
    const nodb = must(await handleLab(new Request(BASE + "/api/lab/options"), null, null));
    expect(nodb.status).toBe(500);
    expect(((await nodb.json()) as Fail).error).toBe("db-not-bound");
  });

  it("options and me", async () => {
    // Adaptation: the operator is the actor's person id (CONTRACT 3), and /me
    // answers the name to show and whether it was typed.
    const { m, who, lab } = await setup();
    const o = await lab.call<R.LabOptions>("GET", "/api/lab/options");
    expect(o.status).toBe(200);
    expect(o.body.locations).toStrictEqual([...R.LOCATIONS]);
    const me = await lab.call<LabWho & { ok: true }>("GET", "/api/lab/me");
    expect(me.body).toStrictEqual({ ok: true, operator: who.id, name: "Smoke Hand", typed: false });
    const typed = await station(m.db, null).call<LabWho>("GET", "/api/lab/me", undefined, { "x-lab-operator": "Bench%20Tester" });
    expect(typed.body).toStrictEqual({ ok: true, operator: "typed:Bench Tester", name: "Bench Tester", typed: true });
    const service = await station(m.db, SERVICE_IDENTITY).call<LabWho>("GET", "/api/lab/me", undefined, { "x-lab-operator": "Bench Tester" });
    expect(service.body.operator).toBe("typed:Bench Tester");
    const nobody = await station(m.db, null).call<LabWho>("GET", "/api/lab/me");
    expect(nobody.body).toStrictEqual({ ok: true, operator: null, name: null, typed: false });
  });

  it("the seed is in: counts match the seed report", async () => {
    // Adaptation (law 8, no seed in tests): migration 0090 builds the package's
    // four tables (not lab_metrc_packages, not lab_writes), and a workbook row
    // as the seed writes it lands, each with its own changed_at.
    const { m } = await setup();
    const named = ["lab_compliance_samples", "lab_internal_tests", "lab_metrc_packages", "lab_op_results", "lab_sample_schedule", "lab_writes"];
    const tables = (m.all(`SELECT name FROM sqlite_master WHERE type = 'table' AND name IN (${named.map(() => "?").join(",")}) ORDER BY name`, ...named) as { name: string }[]).map((r) => r.name);
    expect(tables).toStrictEqual(["lab_compliance_samples", "lab_internal_tests", "lab_op_results", "lab_sample_schedule"]);
    for (let i = 0; i < 5; i++) benchRow(m, { id: `lt_wb00000000${i}`, changed_at: `2026-09-20T12:00:0${i}.000Z` });
    benchRow(m, { id: "lt_wbmissing001", tested_at: null, tested_at_source: "missing", changed_at: "2026-09-20T12:00:09.000Z" });
    const stamps = m.get("SELECT COUNT(*) AS n, COUNT(DISTINCT changed_at) AS d FROM lab_internal_tests");
    expect(stamps?.n).toBe(6);
    expect(stamps?.d).toBe(6);
    expect(() => benchRow(m, { id: "lt_wbbroken001", tested_at: null, tested_at_source: "sheet" })).toThrow();
  });

  it("bench: create is idempotent on the client id, PATCH re-validates, void is kept and fed", async () => {
    // Adaptation: the package read its lab_writes actions; the port reads record_change_log.
    const { m, who, lab } = await setup();
    const id = "lt_test0000000001";
    const body = { id, location: "Silo 3", reason: "During Silo", license: "AU-G-C-000832", metrc_tag: "56899", sample_type: "Flower", moisture_pct: "13.2", notes: "smoke" };
    const a = await lab.call<Created<LabInternalTestRow>>("POST", "/api/lab/internal-tests", body);
    expect(a.status, JSON.stringify(a.body)).toBe(201);
    expect(a.body.created).toBe(true);
    expect(a.body.row.metrc_tag).toBe("1A40503000311FB000056899");
    expect(a.body.row.operator).toBe(who.id);
    expect(a.body.row.tested_at_source).toBe("auto");
    const createLogs = logsFor(m, "lab_internal_tests", id);
    expect(createLogs.length).toBeGreaterThan(0);
    expect(createLogs.every((l) => l.old_value === null && l.actor_person_id === who.id && l.reason === "lab station")).toBe(true);
    expect(createLogs.every((l) => UUID_RE.test(l.id))).toBe(true);
    expect(createLogs.find((l) => l.field === "moisture_pct")?.new_value).toBe("13.2");
    expect(createLogs.find((l) => l.field === "operator")?.new_value).toBe(who.id);
    const b = await lab.call<Created<LabInternalTestRow>>("POST", "/api/lab/internal-tests", body); // the retry
    expect(b.status).toBe(200);
    expect(b.body.created).toBe(false);
    expect(m.get("SELECT COUNT(*) AS n FROM lab_internal_tests WHERE id = ?", id)?.n).toBe(1);
    expect(logsFor(m, "lab_internal_tests", id).length).toBe(createLogs.length); // a retry logs nothing

    const bad = await lab.call<Fail>("POST", "/api/lab/internal-tests", { ...body, id: "lt_test0000000002", moisture_pct: "" });
    expect(bad.status).toBe(400);
    expect(bad.body.error).toBe("no-instrument-result");

    const before = a.body.row.changed_at;
    await sleep(5);
    const p = await lab.call<Patched<LabInternalTestRow>>("PATCH", "/api/lab/internal-tests/" + id, { moisture_pct: "12.9", water_activity: "0.52" });
    expect(p.status, JSON.stringify(p.body)).toBe(200);
    expect(p.body.row.moisture_pct).toBe(12.9);
    expect(p.body.row.water_activity).toBe(0.52);
    expect(p.body.row.changed_at > before, "changed_at advances on a correction").toBe(true);
    const pbad = await lab.call<Fail>("PATCH", "/api/lab/internal-tests/" + id, { moisture_pct: "150" });
    expect(pbad.status).toBe(400);
    expect(pbad.body.error).toBe("moisture_pct");
    const pnone = await lab.call<Fail>("PATCH", "/api/lab/internal-tests/" + id, { bogus: 1 });
    expect(pnone.body.error).toBe("nothing-to-change");
    const p404 = await lab.call<Fail>("PATCH", "/api/lab/internal-tests/lt_nope00000000", { notes: "x" });
    expect(p404.status).toBe(404);

    const list = await lab.call<Rows<LabInternalTestRow>>("GET", "/api/lab/internal-tests?tag=56899");
    expect(list.body.rows.length).toBe(1);
    expect(list.body.rows[0].id).toBe(id);

    const vnoreason = await lab.call<Fail>("POST", `/api/lab/internal-tests/${id}/void`, {});
    expect(vnoreason.body.error).toBe("reason-required");
    const v = await lab.call<{ ok: true; voided_at: string }>("POST", `/api/lab/internal-tests/${id}/void`, { reason: "typed the wrong silo" });
    expect(v.status).toBe(200);
    const v2 = await lab.call<Fail>("POST", `/api/lab/internal-tests/${id}/void`, { reason: "again" });
    expect(v2.status).toBe(409);
    const pv = await lab.call<Fail>("PATCH", "/api/lab/internal-tests/" + id, { notes: "x" });
    expect(pv.status).toBe(409);
    const after = await lab.call<Rows<LabInternalTestRow>>("GET", "/api/lab/internal-tests?tag=56899");
    expect(after.body.rows.length, "a voided row leaves the live list").toBe(0);
    const withV = await lab.call<Rows<LabInternalTestRow>>("GET", "/api/lab/internal-tests?tag=56899&include_voided=1");
    expect(withV.body.rows.length).toBe(1);

    // The log: the create's fields, the correction's from and to, the void with its own reason.
    const logs = logsFor(m, "lab_internal_tests", id);
    const update = logs.filter((l) => l.field === "moisture_pct" && l.old_value !== null);
    expect(update.map((l) => [l.old_value, l.new_value])).toStrictEqual([["13.2", "12.9"]]);
    expect(logs.filter((l) => l.field === "water_activity").map((l) => [l.old_value, l.new_value])).toStrictEqual([[null, "0.52"]]);
    const voids = logs.filter((l) => l.field === "voided_at" || l.field === "void_reason");
    expect(voids.map((l) => [l.field, l.new_value, l.reason])).toStrictEqual([
      ["voided_at", v.body.voided_at, "typed the wrong silo"],
      ["void_reason", "typed the wrong silo", "typed the wrong silo"],
    ]);
    expect(logs.every((l) => l.actor_person_id === who.id)).toBe(true);
  });

  it("bench: a dateless workbook row keeps no date until one is typed, and needs_attention finds the blanks", async () => {
    // Adaptation: the seed's dateless, sheet and bad-tag rows are synthetic rows.
    const { m, lab } = await setup();
    benchRow(m, { id: "lt_missing000001", tested_at: null, tested_at_source: "missing" });
    benchRow(m, { id: "lt_sheetrow00001", tested_at: "2026-09-15T04:00:00.000Z", tested_at_source: "sheet" });
    benchRow(m, { id: "lt_badtagrow0001", metrc_tag: null, metrc_tag_raw: "x1" });
    const missing = m.get("SELECT * FROM lab_internal_tests WHERE id = 'lt_missing000001'") as LabInternalTestRow;
    const attn = await lab.call<Rows<LabInternalTestRow>>("GET", "/api/lab/internal-tests?needs_attention=1&limit=1000");
    expect(attn.body.rows.some((r) => r.id === missing.id)).toBe(true);
    expect(attn.body.rows.some((r) => r.id === "lt_badtagrow0001")).toBe(true);
    // a correction that does not mention the date leaves it missing
    const fill = { notes: "checked", location: missing.location || "Silo 1", reason: missing.reason || "During Silo", sample_type: missing.sample_type || "Flower" };
    const p0 = await lab.call<Patched<LabInternalTestRow>>("PATCH", "/api/lab/internal-tests/" + missing.id, fill);
    expect(p0.status, JSON.stringify(p0.body)).toBe(200);
    expect(p0.body.row.tested_at).toBe(null);
    expect(p0.body.row.tested_at_source).toBe("missing");
    const p = await lab.call<Patched<LabInternalTestRow>>("PATCH", "/api/lab/internal-tests/" + missing.id, { tested_at: "2026-09-22T14:30:00Z" });
    expect(p.status, JSON.stringify(p.body)).toBe(200);
    expect(p.body.row.tested_at).toBe("2026-09-22T14:30:00.000Z");
    expect(p.body.row.tested_at_source).toBe("typed");
    // a dated row cannot be blanked
    const blank = await lab.call<Fail>("PATCH", "/api/lab/internal-tests/" + missing.id, { tested_at: "" });
    expect(blank.status).toBe(400);
    expect(blank.body.error).toBe("tested_at-blank");
    // provenance survives a correction that does not touch the instant
    const p2 = await lab.call<Patched<LabInternalTestRow>>("PATCH", "/api/lab/internal-tests/lt_sheetrow00001", { notes: "still the sheet's time", tested_at: "2026-09-15T04:00:00.000Z" });
    expect(p2.status, JSON.stringify(p2.body)).toBe(200);
    expect(p2.body.row.tested_at_source).toBe("sheet");
    expect(p2.body.row.tested_at).toBe("2026-09-15T04:00:00.000Z");
    // the raw tag survives a correction that does not touch the tag
    const p3 = await lab.call<Patched<LabInternalTestRow>>("PATCH", "/api/lab/internal-tests/lt_badtagrow0001", { notes: "raw tag must survive" });
    expect(p3.status, JSON.stringify(p3.body)).toBe(200);
    expect(p3.body.row.metrc_tag_raw).toBe("x1");
    // optimistic concurrency: a stale correction answers 409 and logs nothing
    const cur = m.get("SELECT updated_at FROM lab_internal_tests WHERE id = ?", missing.id) as { updated_at: string };
    const logsBefore = logCount(m);
    const stale = await lab.call<Fail>("PATCH", "/api/lab/internal-tests/" + missing.id, { notes: "late", if_updated_at: "2020-01-01T00:00:00.000Z" });
    expect(stale.status).toBe(409);
    expect(stale.body.error).toBe("stale");
    expect(stale.body.row).toBeTruthy();
    expect(logCount(m)).toBe(logsBefore);
    const fresh = await lab.call<Patched<LabInternalTestRow>>("PATCH", "/api/lab/internal-tests/" + missing.id, { notes: "on time", if_updated_at: cur.updated_at });
    expect(fresh.status).toBe(200);
    const same = await lab.call<Patched<LabInternalTestRow>>("PATCH", "/api/lab/internal-tests/" + missing.id, { notes: "on time" });
    expect(same.body.unchanged).toBe(true);
    // the device clock at save lands as the auto time, not the arrival time
    const obs = await lab.call<Created<LabInternalTestRow>>("POST", "/api/lab/internal-tests", { id: "lt_test0000000021", location: "Silo 2", reason: "During Silo", sample_type: "Flower", moisture_pct: "15", observed_at: "2026-10-02T11:11:11Z" });
    expect(obs.status, JSON.stringify(obs.body)).toBe(201);
    expect(obs.body.row.tested_at).toBe("2026-10-02T11:11:11.000Z");
    expect(obs.body.row.tested_at_source).toBe("auto");
    const clockOff = await lab.call<Fail>("POST", "/api/lab/internal-tests", { id: "lt_test0000000022", location: "Silo 2", reason: "During Silo", sample_type: "Flower", moisture_pct: "15", observed_at: "2031-01-01T00:00:00Z" });
    expect(clockOff.body.error).toBe("observed_at");
  });

  it("doors: a write without the page's client header is refused, text that is too long is refused", async () => {
    const { m, who, lab } = await setup();
    const bare = (method: string, path: string, body: string) =>
      handleLab(new Request(BASE + path, { method, headers: { "content-type": "application/json" }, body }), m.db, who).then(must);
    const r = await bare("POST", "/api/lab/internal-tests", JSON.stringify({ id: "lt_test0000000031", location: "Silo 1", reason: "During Silo", sample_type: "Flower", moisture_pct: 10 }));
    expect(r.status).toBe(403);
    expect(((await r.json()) as Fail).error).toBe("client-header-required");
    // Port extra: every write door, not only the create.
    for (const [method, path] of [
      ["PUT", "/api/lab/schedule"],
      ["PATCH", "/api/lab/internal-tests/lt_test0000000031"],
      ["POST", "/api/lab/internal-tests/lt_test0000000031/void"],
      ["POST", "/api/lab/compliance"],
      ["POST", "/api/lab/op/import"],
    ]) {
      const res = await bare(method, path, "{}");
      expect(res.status, `${method} ${path}`).toBe(403);
    }
    expect(m.get("SELECT COUNT(*) AS n FROM lab_internal_tests")?.n).toBe(0);
    const long = await lab.call<Fail>("POST", "/api/lab/internal-tests", { id: "lt_test0000000032", location: "Silo 1", reason: "During Silo", sample_type: "Flower", moisture_pct: 10, notes: "x".repeat(2001) });
    expect(long.body.error).toBe("too-long");
    const comma = await lab.call<Fail>("POST", "/api/lab/internal-tests", { id: "lt_test0000000033", location: "Silo 1", reason: "During Silo", sample_type: "Flower", moisture_pct: "8,5" });
    expect(comma.body.error).toBe("moisture_pct");
  });

  it("feeds: a page never ends inside a run of equal changed_at", async () => {
    const { m, lab } = await setup();
    // seven rows sharing one stamp, later than everything else in the table
    const stamp = "2031-01-01T00:00:00.000Z";
    const stmts: D1PreparedStatement[] = [];
    for (let i = 0; i < 7; i++) {
      stmts.push(
        m.db
          .prepare("INSERT INTO lab_internal_tests (id,tested_at,tested_at_source,location,reason,sample_type,moisture_pct,notes,source,created_at,updated_at,changed_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)")
          .bind("lt_run000000000" + i, "2026-10-01T10:0" + i + ":00.000Z", "typed", "Silo 5", "During Silo", "Flower", 10 + i, "run", "station", stamp, stamp, stamp)
      );
    }
    await m.db.batch(stmts);
    benchRow(m, { id: "lt_earlier000001", changed_at: "2026-09-01T00:00:00.000Z" });
    const pg = await lab.call<Feed>("GET", "/feeds/lab-internal-tests.json?limit=3&since=2030-12-31T00:00:00Z");
    expect(pg.status).toBe(200);
    expect(pg.body.count, "the whole run is delivered on the page that reached it").toBe(7);
    expect(pg.body.run_completed).toBe(4);
    expect(pg.body.more).toBe(false);
    expect(pg.body.next_since).toBe(stamp);
    const after = await lab.call<Feed>("GET", "/feeds/lab-internal-tests.json?limit=3&since=" + encodeURIComponent(stamp));
    expect(after.body.count).toBe(0);
  });

  it("feeds: the trim-weighs envelope, strict after, paging, live=1 drops voided", async () => {
    // Adaptation: 230 synthetic bench rows (distinct changed_at) and one void
    // stand in for the seed; the op row comes from an import.
    const { m, lab } = await setup();
    const t0 = Date.parse("2026-09-01T00:00:00Z");
    for (let i = 0; i < 230; i++) {
      const at = new Date(t0 + i * 1000).toISOString();
      benchRow(m, { id: `lt_feed${String(i).padStart(8, "0")}`, created_at: at, updated_at: at, changed_at: at });
    }
    const v = await lab.call<{ ok: true }>("POST", "/api/lab/internal-tests/lt_feed00000007/void", { reason: "wrong silo" });
    expect(v.status).toBe(200);
    const f = await lab.call<Feed>("GET", "/feeds/lab-internal-tests.json?limit=2");
    expect(f.status).toBe(200);
    expect(f.body.feed).toBe("lab_internal_tests");
    expect(f.body.count).toBe(2);
    expect(f.body.more).toBe(true);
    expect(f.body.next_since >= f.body.rows[1].changed_at).toBe(true);
    const next = await lab.call<Feed>("GET", "/feeds/lab-internal-tests.json?since=" + encodeURIComponent(f.body.next_since) + "&limit=2000");
    expect(next.body.rows.every((r) => r.changed_at > f.body.next_since)).toBe(true);
    const total = Number(m.get("SELECT COUNT(*) AS n FROM lab_internal_tests")?.n);
    const voided = Number(m.get("SELECT COUNT(*) AS n FROM lab_internal_tests WHERE voided_at IS NOT NULL")?.n);
    expect(total >= 230 && voided >= 1).toBe(true);
    const all = await lab.call<Feed>("GET", "/feeds/lab-internal-tests.json?limit=2000");
    expect(all.body.rows.length).toBe(total); // every row, the voided one included
    expect(all.body.rows.some((r) => r.voided_at)).toBe(true);
    const live = await lab.call<Feed>("GET", "/feeds/lab-internal-tests.json?limit=2000&live=1");
    expect(live.body.rows.length).toBe(total - voided);
    // paging the whole table at a small limit delivers every row exactly once
    let cursor = "2000-01-01T00:00:00.000Z";
    const seen = new Set<string>();
    let pages = 0;
    for (;;) {
      const page = await lab.call<Feed>("GET", "/feeds/lab-internal-tests.json?limit=97&since=" + encodeURIComponent(cursor));
      pages++;
      for (const r of page.body.rows) {
        expect(seen.has(String(r.id)), "row fed twice: " + r.id).toBe(false);
        seen.add(String(r.id));
      }
      if (!page.body.more) break;
      cursor = page.body.next_since;
      expect(pages < 50).toBe(true);
    }
    expect(seen.size).toBe(total);
    const badSince = await lab.call<Fail>("GET", "/feeds/lab-internal-tests.json?since=yesterday");
    expect(badSince.status).toBe(400);
    const post = await lab.raw("POST", "/feeds/lab-internal-tests.json", {});
    expect(post.status).toBe(405);
    const head = await lab.raw("HEAD", "/feeds/lab-internal-tests.json");
    expect(head.status).toBe(405); // the package's law: the feeds are GET only
    const imp = await lab.call<Imported>("POST", "/api/lab/op/import", [OP_HEADER_LINE, opLine("cccccccc-0000-0000-0000-000000000001", "KIEF", "25.5", "Low")].join("\n"));
    expect(imp.body.landed).toBe(1);
    const op = await lab.call<Feed>("GET", "/feeds/lab-op-results.json?limit=1");
    expect(op.body.rows[0].raw?.Unit).toBe("%");
    expect(op.body.rows[0].raw_json).toBe(undefined);
    const cs = await lab.call<Feed>("GET", "/feeds/lab-compliance.json?limit=1");
    expect(cs.body.feed).toBe("lab_compliance_samples");
  });

  it("compliance: scheduled, readiness from the bench, the lifecycle, the autofill csv", async () => {
    const { m, who, lab } = await setup();
    const src = "1A4050300061761000009999";
    const create = await lab.call<Created<LabComplianceRow>>("POST", "/api/lab/compliance", { id: "cs_test0000000001", license: "AU-P-000694", source_metrc_tag: src, required_test: "Full Compliance", net_weight_g: 114, strain: "Test Strain" });
    expect(create.status, JSON.stringify(create.body)).toBe(201);
    expect(create.body.row.status).toBe("scheduled");
    expect(create.body.row.operator).toBe(who.id);
    const logsAfterCreate = logsFor(m, "lab_compliance_samples", "cs_test0000000001").length;
    expect(logsAfterCreate).toBeGreaterThan(0);
    const again = await lab.call<Created<LabComplianceRow>>("POST", "/api/lab/compliance", { id: "cs_test0000000001", license: "AU-P-000694", source_metrc_tag: src, required_test: "Full Compliance" });
    expect(again.body.created).toBe(false);
    expect(logsFor(m, "lab_compliance_samples", "cs_test0000000001").length).toBe(logsAfterCreate);

    let list = await lab.call<Rows<LabComplianceListRow>>("GET", "/api/lab/compliance?status=scheduled&tag=09999");
    expect(list.body.rows.length).toBe(1);
    expect(list.body.rows[0].readiness?.ready).toBe(false);
    expect(list.body.rows[0].readiness?.why).toMatch(/no cryo/);

    // the bench reads the cryo sample: aw 0.72 first, then 0.55 later; the newest decides
    const r1 = await lab.call<Created<LabInternalTestRow>>("POST", "/api/lab/internal-tests", { id: "lt_test0000000011", location: "Cryo Room", reason: "After Cryo", metrc_tag: src, sample_type: "Flower", water_activity: "0.72", tested_at: "2026-10-01T10:00:00Z" });
    expect(r1.status, JSON.stringify(r1.body)).toBe(201);
    list = await lab.call<Rows<LabComplianceListRow>>("GET", "/api/lab/compliance?status=scheduled&tag=09999");
    expect(list.body.rows[0].readiness?.ready).toBe(false);
    const r2 = await lab.call<Created<LabInternalTestRow>>("POST", "/api/lab/internal-tests", { id: "lt_test0000000012", location: "Cryo Room", reason: "After Cryo", metrc_tag: src, sample_type: "Flower", water_activity: "0.55", tested_at: "2026-10-02T10:00:00Z" });
    expect(r2.status).toBe(201);
    list = await lab.call<Rows<LabComplianceListRow>>("GET", "/api/lab/compliance?status=scheduled&tag=09999");
    expect(list.body.rows[0].readiness?.ready).toBe(true);
    expect(list.body.rows[0].readiness?.water_activity).toBe(0.55);

    // send it to the lab: needs a sample tag
    const noTag = await lab.call<Fail>("PATCH", "/api/lab/compliance/cs_test0000000001", { status: "in_testing" });
    expect(noTag.body.error).toBe("sample_tag-required");
    const sent = await lab.call<Patched<LabComplianceRow>>("PATCH", "/api/lab/compliance/cs_test0000000001", { status: "in_testing", sample_tag: "08888", testing_facility: "ACT", entered_testing_on: "2026-10-01" });
    expect(sent.status, JSON.stringify(sent.body)).toBe(200);
    expect(sent.body.row.sample_tag).toBe("1A4050300061761000008888");
    list = await lab.call<Rows<LabComplianceListRow>>("GET", "/api/lab/compliance?tag=09999");
    expect(list.body.rows[0].turnaround_days).toBe(Math.round((Math.floor(Date.now() / 86400e3) * 86400e3 - Date.parse("2026-10-01T00:00:00Z")) / 86400e3));
    expect(list.body.rows[0].readiness, "readiness is only computed while scheduled").toBe(undefined);

    // the result: failed needs a reason
    const failNoReason = await lab.call<Fail>("PATCH", "/api/lab/compliance/cs_test0000000001", { status: "failed", finished_testing_on: "2026-10-04", thc_potency_pct: 21.3 });
    expect(failNoReason.body.error).toBe("fail_reason-required");
    const failed = await lab.call<Patched<LabComplianceRow>>("PATCH", "/api/lab/compliance/cs_test0000000001", { status: "failed", finished_testing_on: "2026-10-04", thc_potency_pct: 21.3, fail_reason: "Coliforms" });
    expect(failed.status).toBe(200);
    expect(failed.body.row.status).toBe("failed");
    const statusLog = logsFor(m, "lab_compliance_samples", "cs_test0000000001").filter((l) => l.field === "status");
    expect(statusLog.map((l) => [l.old_value, l.new_value])).toStrictEqual([
      [null, "scheduled"],
      ["scheduled", "in_testing"],
      ["in_testing", "failed"],
    ]);

    // the autofill csv for a scheduled sample with a tag
    const sch = await lab.call<Created<LabComplianceRow>>("POST", "/api/lab/compliance", { id: "cs_test0000000002", license: "AU-P-000694", source_metrc_tag: "01301", sample_tag: "02310", required_test: "Full Compliance", net_weight_g: 114 });
    expect(sch.status, JSON.stringify(sch.body)).toBe(201);
    const csvRes = await lab.raw("GET", "/api/lab/compliance/metrc-autofill.csv?ids=cs_test0000000002,cs_test0000000001");
    expect(csvRes.status).toBe(200);
    const csv = await csvRes.text();
    const lines = csv.trim().split("\r\n");
    expect(lines.length).toBe(5); // three header rows and two samples
    expect(lines[0].split(",")[0]).toBe("line in repeaterLines");
    expect(lines[2].split(",")[0]).toBe("Tag Number");
    const data = lines.slice(3).map((l) => l.split(","));
    const row = data.find((d) => d[0] === "1A4050300061761000002310");
    expect(row).toBeTruthy();
    expect(row?.[1]).toBe("In Testing");
    expect(row?.[4]).toBe("114");
    expect(row?.[5]).toBe("Grams");
    expect(row?.[7]).toMatch(/^\d{1,2}\/\d{1,2}\/\d{2}$/); // the sheet's own m/d/yy, "10/2/26"
    expect(metrcToday(new Date("2026-10-02T18:00:00Z"))).toBe("10/2/26");
    expect(row?.[14]).toBe("1A4050300061761000001301");
    expect(row?.[16]).toBe("Grams");
    // the pure builder quotes a comma
    expect(autofillCsv([{ sample_tag: "x,y", source_metrc_tag: "s", net_weight_g: 1 }], "10-02-26")).toMatch(/"x,y"/);
    const noIds = await lab.call<Fail>("GET", "/api/lab/compliance/metrc-autofill.csv");
    expect(noIds.status).toBe(400);
    const many = await lab.call<Fail & { max: number }>("GET", "/api/lab/compliance/metrc-autofill.csv?ids=" + Array.from({ length: 91 }, (_, i) => "cs_test00000" + String(i).padStart(5, "0")).join(","));
    expect(many.status).toBe(400);
    expect(many.body.error).toBe("too-many-ids");
    expect(many.body.max).toBe(AUTOFILL_MAX_IDS);
  });

  it("metrc: lookup from the seeded report and an import that upserts", async () => {
    // Adaptation (law 5): the lookup reads the app's metrc_packages mirror
    // (seedMirror), and there is no import route.
    const { m, lab } = await setup();
    seedMirror(m, { tag: "1A4050300061761000000411", harvest: "26266-ARL-OD-009-0-01-26042", item: "WBP - Test Strain - ARL - O", strain: "Test Strain", grams: 750.5, status: "NotSubmitted", location: "Vault", packaged: "2026-09-29" });
    m.run("UPDATE metrc_packages SET category = 'Buds', source_packages = '1A4050300061761000000400' WHERE tag = '1A4050300061761000000411'");
    const logsBefore = logCount(m);
    const hit = await lab.call<{ ok: true; found: true; row: LabMetrcPackage }>("GET", "/api/lab/metrc/1A4050300061761000000411");
    expect(hit.status).toBe(200);
    expect(hit.body.found).toBe(true);
    expect(hit.body.row).toStrictEqual({
      tag: "1A4050300061761000000411",
      item: "WBP - Test Strain - ARL - O",
      category: "Buds",
      strain: "Test Strain",
      item_strain: "Test Strain",
      quantity: 750.5,
      unit: "g",
      quantity_g: 751,
      source_harvest: "26266-ARL-OD-009-0-01-26042",
      source_package: "1A4050300061761000000400",
      location: "Vault",
      lab_test_status: "NotSubmitted",
      packaged_date: "2026-09-29",
    });
    const miss = await lab.call<{ ok: true; found: false }>("GET", "/api/lab/metrc/1A4050300061761000000000");
    expect(miss.body).toStrictEqual({ ok: true, found: false });
    // a tag whose only row is gone is still found
    seedMirror(m, { tag: "1A4050300061761000000412", gone: "2026-09-30T00:00:00.000Z" });
    const gone = await lab.call<{ ok: true; found: boolean; row: LabMetrcPackage }>("GET", "/api/lab/metrc/1A4050300061761000000412");
    expect(gone.body.found).toBe(true);
    // an 'ea' package has no grams
    seedMirror(m, { tag: "1A4050300061761000000413", grams: 12 });
    m.run("UPDATE metrc_packages SET uom = ' EA ' WHERE tag = '1A4050300061761000000413'");
    const ea = await lab.call<{ ok: true; found: boolean; row: LabMetrcPackage }>("GET", "/api/lab/metrc/1A4050300061761000000413");
    expect(ea.body.row.quantity).toBe(12);
    expect(ea.body.row.quantity_g).toBe(null);
    // a bad tag and a malformed percent-escape answer 400, never 500
    expect((await lab.call<Fail>("GET", "/api/lab/metrc/abc")).body).toStrictEqual({ ok: false, error: "tag" });
    const escape = await lab.call<Fail>("GET", "/api/lab/metrc/%E0%A4%A");
    expect(escape.status).toBe(400);
    expect(escape.body.error).toBe("tag");
    // no import route
    const imp = await lab.call<Fail>("POST", "/api/lab/metrc/import", "Tag,Quantity\n1A4050300061761000000411,100\n");
    expect(imp.status).toBe(404);
    expect(imp.body.error).toBe("not-found");
    expect(logCount(m)).toBe(logsBefore); // reads never log
  });

  it("orange photonics: a LightLab export imports once, refuses what it cannot read, lists by class", async () => {
    const { m, who, lab } = await setup();
    const csv = [
      OP_HEADER_LINE,
      opLine("aaaaaaaa-0000-0000-0000-000000000001", "KIEF", "25.5", "Low"),
      opLine("aaaaaaaa-0000-0000-0000-000000000002", "trim", "8.2", "ND"),
      opLine("aaaaaaaa-0000-0000-0000-000000000002", "trim", "8.2", "ND"),
      opLine("aaaaaaaa-0000-0000-0000-000000000003", "flower", "x", "Low"),
    ].join("\n");
    const imp = await lab.call<Imported>("POST", "/api/lab/op/import", csv);
    expect(imp.status, JSON.stringify(imp.body)).toBe(200);
    expect(imp.body.rows).toBe(4);
    expect(imp.body.landed).toBe(2);
    expect(imp.body.duplicate_in_file).toBe(1);
    expect(imp.body.refused.length).toBe(1);
    expect(imp.body.refused_count).toBe(1);
    expect(imp.body.refused[0].error).toBe("analyte:THC-A");
    const big = [OP_HEADER_LINE].concat(Array.from({ length: 901 }, (_, i) => opLine("bbbbbbbb-0000-0000-0000-" + String(i).padStart(12, "0"), "KIEF", "20", "Low"))).join("\n");
    const tooMany = await lab.call<Fail>("POST", "/api/lab/op/import", big);
    expect(tooMany.status).toBe(413);
    expect(tooMany.body.error).toBe("too-many-rows");
    expect(tooMany.body.max).toBe(900);
    // Port extra: each landed result logs its fields; a re-post lands and logs nothing.
    const landedLogs = logsFor(m, "lab_op_results", "aaaaaaaa-0000-0000-0000-000000000001");
    expect(landedLogs.length).toBeGreaterThan(0);
    expect(landedLogs.every((l) => l.actor_person_id === who.id && l.old_value === null && UUID_RE.test(l.id))).toBe(true);
    const logsBefore = logCount(m);
    const again = await lab.call<Imported>("POST", "/api/lab/op/import", csv);
    expect(again.body.landed).toBe(0);
    expect(again.body.already_there).toBe(2);
    expect(logCount(m)).toBe(logsBefore);
    const kief = await lab.call<Rows<LabOpRow>>("GET", "/api/lab/op?class=Kief&limit=5");
    expect(kief.body.rows[0].test_id).toBe("aaaaaaaa-0000-0000-0000-000000000001");
    expect(kief.body.rows[0].terpenes_level).toBe("Low");
    expect(kief.body.rows[0].d8_thc).toBe(null);
    const wrong = await lab.call<Fail>("POST", "/api/lab/op/import", "Test ID,Date\nx,y\n");
    expect(wrong.status).toBe(400);
    expect(wrong.body.missing?.includes("Time")).toBe(true);
  });

  it("schedule: put replaces a cell, get reads a window", async () => {
    // Adaptation: the seed's seven cells on 2026-09-29 are synthetic rows.
    const { m, who, lab } = await setup();
    const put = await lab.call<{ ok: true; locations: string[] }>("PUT", "/api/lab/schedule", { day: "2026-10-03", hour: 10, locations: "Silo 3/Silo 5" });
    expect(put.status, JSON.stringify(put.body)).toBe(200);
    expect(put.body.locations).toStrictEqual(["Silo 3", "Silo 5"]);
    const put2 = await lab.call<{ ok: true; locations: string[] }>("PUT", "/api/lab/schedule", { day: "2026-10-03", hour: 10, locations: "Silo 4" });
    expect(put2.body.locations).toStrictEqual(["Silo 4"]);
    const get = await lab.call<{ ok: true; rows: LabScheduleRow[] }>("GET", "/api/lab/schedule?from=2026-10-03&days=1");
    expect(get.body.rows.map((r) => [r.hour, r.location])).toStrictEqual([[10, "Silo 4"]]);
    expect(get.body.rows[0].operator).toBe(who.id);
    const same = await lab.call<{ ok: true; locations: string[] }>("PUT", "/api/lab/schedule", { day: "2026-10-03", hour: 10, locations: "Silo 4" });
    expect(same.status).toBe(200);
    const clearCell = await lab.call<{ ok: true; locations: string[] }>("PUT", "/api/lab/schedule", { day: "2026-10-03", hour: 10, locations: "" });
    expect(clearCell.body.locations).toStrictEqual([]);
    for (let h = 7; h < 14; h++) m.run("INSERT INTO lab_sample_schedule (day, hour, location, operator, updated_at) VALUES ('2026-09-29', ?, 'Silo 1', NULL, '2026-09-28T12:00:00.000Z')", h);
    const seeded = await lab.call<{ ok: true; rows: LabScheduleRow[] }>("GET", "/api/lab/schedule?from=2026-09-29&days=1");
    expect(seeded.body.rows.length).toBe(7);
    const bad = await lab.call<Fail>("PUT", "/api/lab/schedule", { day: "2026-10-03", hour: 10, locations: "Silo 9" });
    expect(bad.status).toBe(400);
    // Port extra: one log row per change of the cell, none for an unchanged PUT.
    const logs = logsFor(m, "lab_sample_schedule", "2026-10-03T10");
    expect(logs.map((l) => [l.field, l.old_value, l.new_value, l.actor_person_id])).toStrictEqual([
      ["locations", null, "Silo 3/Silo 5", who.id],
      ["locations", "Silo 3/Silo 5", "Silo 4", who.id],
      ["locations", "Silo 4", null, who.id],
    ]);
  });

  it("summary answers with every section present", async () => {
    // Adaptation: the scheduled sample and the bench reading are made here.
    const { lab } = await setup();
    await lab.call("POST", "/api/lab/compliance", { id: "cs_test0000000002", license: "AU-P-000694", source_metrc_tag: "01301", sample_tag: "02310", required_test: "Full Compliance", net_weight_g: 114 });
    await lab.call("POST", "/api/lab/internal-tests", { id: "lt_test0000000041", location: "Silo 1", reason: "During Silo", sample_type: "Flower", moisture_pct: "12" });
    const s = await lab.call<{
      compliance: { by_status: unknown[]; scheduled: number };
      bench: { needs_attention: number; last_reading_at: string | null };
      orange_photonics: { last_7_days_by_class: unknown[] };
    }>("GET", "/api/lab/summary");
    expect(s.status, JSON.stringify(s.body)).toBe(200);
    expect(Array.isArray(s.body.compliance.by_status)).toBe(true);
    expect(s.body.compliance.scheduled >= 1).toBe(true);
    expect(typeof s.body.bench.needs_attention).toBe("number");
    expect(s.body.bench.last_reading_at).toBeTruthy();
    expect(Array.isArray(s.body.orange_photonics.last_7_days_by_class)).toBe(true);
  });

  it("a thrown D1 error is a named 500, never a blank one", async () => {
    const broken = {
      prepare: () => {
        throw new Error("D1_ERROR: boom");
      },
      batch: () => {
        throw new Error("boom");
      },
    } as unknown as D1Database;
    const r = must(await handleLab(new Request(BASE + "/api/lab/summary"), broken, null));
    expect(r.status).toBe(500);
    const b = (await r.json()) as Fail;
    expect(b.error).toBe("server-error");
    expect(b.detail).toMatch(/boom/);
  });
});

describe("lab handlers (the brief's own cases)", () => {
  it("the typed fallback stores typed:<name> with a null actor on the row and the log", async () => {
    const { m } = await setup();
    const typed = station(m.db, null);
    const a = await typed.call<Created<LabInternalTestRow>>("POST", "/api/lab/internal-tests", { id: "lt_typed00000001", location: "Silo 2", reason: "During Silo", sample_type: "Flower", moisture_pct: "14" }, { "x-lab-operator": "Bench Tester" });
    expect(a.status).toBe(201);
    expect(a.body.row.operator).toBe("typed:Bench Tester");
    const logs = logsFor(m, "lab_internal_tests", "lt_typed00000001");
    expect(logs.length).toBeGreaterThan(0);
    expect(logs.every((l) => l.actor_person_id === null)).toBe(true);
    const service = station(m.db, SERVICE_IDENTITY);
    const b = await service.call<Created<LabInternalTestRow>>("POST", "/api/lab/internal-tests", { id: "lt_typed00000002", location: "Silo 2", reason: "During Silo", sample_type: "Flower", moisture_pct: "14" }, { "x-lab-operator": " Bench Tester " });
    expect(b.body.row.operator).toBe("typed:Bench Tester");
    expect(logsFor(m, "lab_internal_tests", "lt_typed00000002").every((l) => l.actor_person_id === null)).toBe(true);
    const c = await typed.call<Created<LabInternalTestRow>>("POST", "/api/lab/internal-tests", { id: "lt_typed00000003", location: "Silo 2", reason: "During Silo", sample_type: "Flower", moisture_pct: "14" });
    expect(c.body.row.operator).toBe(null);
  });

  it("a correction that loses the race answers 409 stale and logs nothing", async () => {
    const { m, who } = await setup();
    const lab = station(m.db, who);
    await lab.call("POST", "/api/lab/internal-tests", { id: "lt_race00000001", location: "Silo 2", reason: "During Silo", sample_type: "Flower", moisture_pct: "14" });
    const racy = {
      prepare: (sql: string) => m.db.prepare(sql),
      batch: (stmts: D1PreparedStatement[]) => {
        // another correction lands between this request's read and its write
        m.run("UPDATE lab_internal_tests SET updated_at = '2030-01-01T00:00:00.000Z' WHERE id = 'lt_race00000001'");
        return m.db.batch(stmts);
      },
    } as unknown as D1Database;
    const before = logCount(m);
    const p = await station(racy, who).call<Fail>("PATCH", "/api/lab/internal-tests/lt_race00000001", { moisture_pct: "15" });
    expect(p.status).toBe(409);
    expect(p.body.error).toBe("stale");
    expect(logCount(m)).toBe(before);
    expect(m.get("SELECT moisture_pct FROM lab_internal_tests WHERE id = 'lt_race00000001'")?.moisture_pct).toBe(14);
  });

  it("grams entering round half up; a stored gram value a correction does not name is kept", async () => {
    const { m, lab } = await setup();
    const a = await lab.call<Created<LabComplianceRow>>("POST", "/api/lab/compliance", { id: "cs_grams00000001", license: "AU-P-000694", source_metrc_tag: "01301", required_test: "Full Compliance", net_weight_g: "114.5", batch_weight_g: 2000.4 });
    expect(a.status, JSON.stringify(a.body)).toBe(201);
    expect(a.body.row.net_weight_g).toBe(115);
    expect(a.body.row.batch_weight_g).toBe(2000);
    // a workbook row carries a fractional weight; a notes correction leaves it as stored
    m.run(
      `INSERT INTO lab_compliance_samples (id, program, license, market, source_metrc_tag, batch_weight_g, required_test, net_weight_g, status, notes, scheduled_at, source, created_at, updated_at, changed_at)
       VALUES ('cs_grams00000002', 'compliance', 'AU-P-000694', 'AU', '1A4050300061761000001301', 1234.56, 'Full Compliance', 113.7, 'scheduled', '', '2026-09-20T12:00:00.000Z', 'workbook', '2026-09-20T12:00:00.000Z', '2026-09-20T12:00:00.000Z', '2026-09-20T12:00:00.000Z')`
    );
    const p = await lab.call<Patched<LabComplianceRow>>("PATCH", "/api/lab/compliance/cs_grams00000002", { notes: "checked" });
    expect(p.status, JSON.stringify(p.body)).toBe(200);
    expect(p.body.row.batch_weight_g).toBe(1234.56);
    expect(p.body.row.net_weight_g).toBe(113.7);
    expect(logsFor(m, "lab_compliance_samples", "cs_grams00000002").map((l) => l.field)).toStrictEqual(["notes"]);
    const p2 = await lab.call<Patched<LabComplianceRow>>("PATCH", "/api/lab/compliance/cs_grams00000002", { net_weight_g: "99.5" });
    expect(p2.body.row.net_weight_g).toBe(100);
    expect(p2.body.row.batch_weight_g).toBe(1234.56);
  });

  it("the op import of 900 rows stays near the package's statement count and lands its log rows", async () => {
    const { m, who } = await setup();
    const tally = { prepared: 0, batches: 0, batched: 0 };
    const counting = {
      prepare: (sql: string) => {
        tally.prepared++;
        return m.db.prepare(sql);
      },
      batch: (stmts: D1PreparedStatement[]) => {
        tally.batches++;
        tally.batched += stmts.length;
        return m.db.batch(stmts);
      },
    } as unknown as D1Database;
    const lab = station(counting, who);
    const lines = Array.from({ length: 900 }, (_, i) => opLine("dddddddd-0000-0000-0000-" + String(i).padStart(12, "0"), i % 2 ? "trim" : "KIEF", "20", "Low"));
    const imp = await lab.call<Imported>("POST", "/api/lab/op/import", [OP_HEADER_LINE, ...lines].join("\n"));
    expect(imp.status, JSON.stringify(imp.body)).toBe(200);
    expect(imp.body.landed).toBe(900);
    // 900 inserts and one log statement per 90-row batch: 910, under the 1,000 ceiling
    expect(tally.prepared).toBe(910);
    expect(tally.batches).toBe(10);
    expect(tally.batched).toBe(910);
    // every landed row logs each of its non-null, non-empty stored fields
    const first = m.get("SELECT * FROM lab_op_results WHERE test_id = 'dddddddd-0000-0000-0000-000000000000'") as Record<string, unknown>;
    const perRow = Object.values(first).filter((v) => v != null && v !== "").length;
    expect(logCount(m)).toBe(900 * perRow);
    const logs = logsFor(m, "lab_op_results", "dddddddd-0000-0000-0000-000000000000");
    expect(logs.length).toBe(perRow);
    expect(logs.find((l) => l.field === "thca")?.new_value).toBe("20");
    expect(logs.find((l) => l.field === "weight_g")?.new_value).toBe("0.3");
    expect(logs.find((l) => l.field === "material_class")?.new_value).toBe("Kief");
    expect(logs.every((l) => l.actor_person_id === who.id && l.reason === "lab station" && UUID_RE.test(l.id))).toBe(true);
    const tooMany = await station(m.db, who).call<Fail>("POST", "/api/lab/op/import", [OP_HEADER_LINE, ...lines, opLine("eeeeeeee-0000-0000-0000-000000000000", "KIEF", "20", "Low")].join("\n"));
    expect(tooMany.status).toBe(413);
    expect(tooMany.body.error).toBe("too-many-rows");
  });

  it("listLabComplianceSurface: the console set, a normalized status, a facility, newest first", async () => {
    const { m } = await setup();
    const add = (id: string, over: { program?: string; status?: string; facility?: string | null; scheduled?: string; voided?: string | null; failReason?: string | null }) =>
      m.run(
        `INSERT INTO lab_compliance_samples (id, program, license, market, source_metrc_tag, required_test, status, fail_reason, testing_facility, notes, scheduled_at, source, created_at, updated_at, changed_at, voided_at)
         VALUES (?, ?, 'AU-P-000694', 'AU', '1A4050300061761000001301', 'Full Compliance', ?, ?, ?, '', ?, 'station', '2026-09-20T12:00:00.000Z', '2026-09-20T12:00:00.000Z', '2026-09-20T12:00:00.000Z', ?)`,
        id,
        over.program ?? "compliance",
        over.status ?? "in_testing",
        over.failReason ?? null,
        over.facility ?? "ACT",
        over.scheduled ?? "2026-09-20T12:00:00.000Z",
        over.voided ?? null
      );
    add("cs_surface000001", { scheduled: "2026-09-21T12:00:00.000Z" });
    add("cs_surface000002", { scheduled: "2026-09-25T12:00:00.000Z", facility: "SC Labs", status: "failed", failReason: "Coliforms" });
    add("cs_surface000003", { program: "rnd" });
    add("cs_surface000004", { voided: "2026-09-22T00:00:00.000Z" });
    expect((await listLabComplianceSurface(m.db, {})).map((r) => r.id)).toStrictEqual(["cs_surface000002", "cs_surface000001"]);
    expect((await listLabComplianceSurface(m.db, { status: "In Testing" })).map((r) => r.id)).toStrictEqual(["cs_surface000001"]);
    expect(await listLabComplianceSurface(m.db, { status: "bogus" })).toStrictEqual([]);
    expect(await listLabComplianceSurface(m.db, { status: "constructor" })).toStrictEqual([]);
    expect((await listLabComplianceSurface(m.db, { facility: "SC Labs" })).map((r) => r.id)).toStrictEqual(["cs_surface000002"]);
    expect(await listLabComplianceSurface(m.db, { facility: "SC" })).toStrictEqual([]);
  });

  it("an absent limit or days takes the default, not one row (the README's feed law)", async () => {
    const { m, lab } = await setup();
    for (let i = 1; i <= 3; i++) {
      const at = `2026-09-2${i}T12:00:00.000Z`;
      benchRow(m, { id: `lt_default0000${i}`, tested_at: at, created_at: at, updated_at: at, changed_at: at });
    }
    const feed = await lab.call<Feed>("GET", "/feeds/lab-internal-tests.json");
    expect(feed.status).toBe(200);
    expect(feed.body.count).toBe(3);
    expect(feed.body.more).toBe(false);
    expect((await lab.call<Feed>("GET", "/feeds/lab-internal-tests.json?limit=")).body.count).toBe(3);
    expect((await lab.call<Feed>("GET", "/feeds/lab-internal-tests.json?limit=0")).body.count, "out of range still clamps").toBe(1);
    expect((await lab.call<Rows<{ id: string }>>("GET", "/api/lab/internal-tests")).body.rows).toHaveLength(3);
    const week = await lab.call<{ ok: true; from: string; to: string }>("GET", "/api/lab/schedule?from=2026-09-29");
    expect(week.body.to).toBe("2026-10-05");
  });

  it("the lists carry operator_name: the person's name, the typed name without its prefix, null for a workbook row", async () => {
    const { m, who, lab } = await setup();
    // a signed-in bench write
    const a = await lab.call<Created<LabInternalTestRow>>("POST", "/api/lab/internal-tests", { id: "lt_opname0000001", location: "Silo 2", reason: "During Silo", sample_type: "Flower", moisture_pct: "14", tested_at: "2026-10-01T10:00:00Z" });
    expect(a.status, JSON.stringify(a.body)).toBe(201);
    expect(a.body.row.operator).toBe(who.id);
    // a typed bench write
    const typed = station(m.db, null);
    const b = await typed.call<Created<LabInternalTestRow>>("POST", "/api/lab/internal-tests", { id: "lt_opname0000002", location: "Silo 2", reason: "During Silo", sample_type: "Flower", moisture_pct: "14", tested_at: "2026-09-30T10:00:00Z" }, { "x-lab-operator": "Bench Tester" });
    expect(b.status, JSON.stringify(b.body)).toBe(201);
    expect(b.body.row.operator).toBe("typed:Bench Tester");
    // a workbook row with no operator
    benchRow(m, { id: "lt_opname0000003" });
    const bench = await lab.call<Rows<LabInternalTestRow & LabOperatorName>>("GET", "/api/lab/internal-tests");
    expect(bench.status).toBe(200);
    const byId = new Map(bench.body.rows.map((r) => [r.id, r]));
    expect(byId.get("lt_opname0000001")?.operator).toBe(who.id);
    expect(byId.get("lt_opname0000001")?.operator_name).toBe("Smoke Hand");
    expect(byId.get("lt_opname0000002")?.operator).toBe("typed:Bench Tester");
    expect(byId.get("lt_opname0000002")?.operator_name).toBe("Bench Tester");
    expect(byId.get("lt_opname0000003")?.operator).toBe(null);
    expect(byId.get("lt_opname0000003")?.operator_name).toBe(null);
    // the list's filters and order still read the bench table's own columns
    const silo = await lab.call<Rows<LabInternalTestRow & LabOperatorName>>("GET", "/api/lab/internal-tests?location=Silo%202");
    expect(silo.body.rows.map((r) => r.id)).toStrictEqual(["lt_opname0000001", "lt_opname0000002"]);

    // a signed-in compliance write
    const cs = await lab.call<Created<LabComplianceRow>>("POST", "/api/lab/compliance", { id: "cs_opname0000001", license: "AU-P-000694", source_metrc_tag: "01301", required_test: "Full Compliance" });
    expect(cs.status, JSON.stringify(cs.body)).toBe(201);
    const comp = await lab.call<Rows<LabComplianceListRow>>("GET", "/api/lab/compliance?tag=01301");
    expect(comp.body.rows.map((r) => [r.id, r.operator, r.operator_name])).toStrictEqual([["cs_opname0000001", who.id, "Smoke Hand"]]);

    // Adaptation: an op result's operator is the LightLab export's own Operator
    // column (as in the package), not the station actor. A signed-in import and a
    // typed one both store the export's text, which lists with operator_name null
    // (the page falls back to the operator text). A person id or a typed: value in
    // that column lists the way the bench's does.
    const opWith = (id: string, operator: string): string => {
      const cells = opLine(id, "KIEF", "25.5", "Low").split(",");
      cells[R.OP_HEADER.indexOf("Operator")] = operator;
      return cells.join(",");
    };
    const signedCsv = [OP_HEADER_LINE, opWith("cccccccc-0000-0000-0000-000000000001", "Lab Device"), opWith("cccccccc-0000-0000-0000-000000000003", "")].join("\n");
    expect((await lab.call<Imported>("POST", "/api/lab/op/import", signedCsv)).body.landed).toBe(2);
    const typedCsv = [OP_HEADER_LINE, opWith("cccccccc-0000-0000-0000-000000000002", "Lab Device")].join("\n");
    expect((await typed.call<Imported>("POST", "/api/lab/op/import", typedCsv, { "x-lab-operator": "Bench Tester" })).body.landed).toBe(1);
    m.run("INSERT INTO lab_op_results (test_id, tested_at, tested_at_offset, serial_number, sample_id, operator, cultivar, sample_type, material_class, notes, weight_g, temperature_c, moisture_correction, confidence, thca, terpenes_level, nd_json, raw_json, source, imported_at, changed_at) SELECT 'cccccccc-0000-0000-0000-000000000004', tested_at, tested_at_offset, serial_number, sample_id, ?, cultivar, sample_type, material_class, notes, weight_g, temperature_c, moisture_correction, confidence, thca, terpenes_level, nd_json, raw_json, 'workbook', imported_at, changed_at FROM lab_op_results WHERE test_id = 'cccccccc-0000-0000-0000-000000000001'", who.id);
    m.run("INSERT INTO lab_op_results (test_id, tested_at, tested_at_offset, serial_number, sample_id, operator, cultivar, sample_type, material_class, notes, weight_g, temperature_c, moisture_correction, confidence, thca, terpenes_level, nd_json, raw_json, source, imported_at, changed_at) SELECT 'cccccccc-0000-0000-0000-000000000005', tested_at, tested_at_offset, serial_number, sample_id, 'typed:Bench Tester', cultivar, sample_type, material_class, notes, weight_g, temperature_c, moisture_correction, confidence, thca, terpenes_level, nd_json, raw_json, 'workbook', imported_at, changed_at FROM lab_op_results WHERE test_id = 'cccccccc-0000-0000-0000-000000000001'");
    const op = await lab.call<Rows<LabOpRow & LabOperatorName>>("GET", "/api/lab/op?class=Kief");
    expect(op.status).toBe(200);
    const opById = new Map(op.body.rows.map((r) => [r.test_id, r]));
    expect(opById.size).toBe(5);
    expect(opById.get("cccccccc-0000-0000-0000-000000000001")?.operator).toBe("Lab Device");
    expect(opById.get("cccccccc-0000-0000-0000-000000000001")?.operator_name).toBe(null);
    expect(opById.get("cccccccc-0000-0000-0000-000000000002")?.operator).toBe("Lab Device");
    expect(opById.get("cccccccc-0000-0000-0000-000000000002")?.operator_name).toBe(null);
    expect(opById.get("cccccccc-0000-0000-0000-000000000003")?.operator).toBe(null);
    expect(opById.get("cccccccc-0000-0000-0000-000000000003")?.operator_name).toBe(null);
    expect(opById.get("cccccccc-0000-0000-0000-000000000004")?.operator_name).toBe("Smoke Hand");
    expect(opById.get("cccccccc-0000-0000-0000-000000000005")?.operator_name).toBe("Bench Tester");

    // the feeds keep the package's columns
    const feed = await lab.call<Feed>("GET", "/feeds/lab-internal-tests.json");
    expect(feed.body.rows.length).toBe(3);
    expect(feed.body.rows.every((r) => !("operator_name" in r))).toBe(true);
  });

  it("grams outside the range are refused with the field's slug, not rounded into it", async () => {
    const { lab } = await setup();
    const base = { license: "AU-P-000694", source_metrc_tag: "01301", required_test: "Full Compliance" };
    const low = await lab.call<Fail>("POST", "/api/lab/compliance", { ...base, id: "cs_range00000001", batch_weight_g: -0.4 });
    expect(low.status, JSON.stringify(low.body)).toBe(400);
    expect(low.body.error).toBe("batch_weight_g");
    const high = await lab.call<Fail>("POST", "/api/lab/compliance", { ...base, id: "cs_range00000002", batch_weight_g: 1000000.4 });
    expect(high.status, JSON.stringify(high.body)).toBe(400);
    expect(high.body.error).toBe("batch_weight_g");
    const lowText = await lab.call<Fail>("POST", "/api/lab/compliance", { ...base, id: "cs_range00000003", net_weight_g: "-0.4" });
    expect(lowText.status, JSON.stringify(lowText.body)).toBe(400);
    expect(lowText.body.error).toBe("net_weight_g");
    const ok = await lab.call<Created<LabComplianceRow>>("POST", "/api/lab/compliance", { ...base, id: "cs_range00000004", batch_weight_g: 114.5, net_weight_g: 1000000 });
    expect(ok.status, JSON.stringify(ok.body)).toBe(201);
    expect(ok.body.row.batch_weight_g).toBe(115);
    expect(ok.body.row.net_weight_g).toBe(1000000);
    const patched = await lab.call<Fail>("PATCH", "/api/lab/compliance/cs_range00000004", { batch_weight_g: "-0.4" });
    expect(patched.status, JSON.stringify(patched.body)).toBe(400);
    expect(patched.body.error).toBe("batch_weight_g");
  });

  it("a long repeated status filter binds each status once and answers its rows", async () => {
    const { m, lab } = await setup();
    const add = (id: string, status: string, scheduled: string) =>
      m.run(
        `INSERT INTO lab_compliance_samples (id, program, license, market, source_metrc_tag, required_test, status, notes, scheduled_at, source, created_at, updated_at, changed_at)
         VALUES (?, 'compliance', 'AU-P-000694', 'AU', '1A4050300061761000001301', 'Full Compliance', ?, '', ?, 'station', '2026-09-20T12:00:00.000Z', '2026-09-20T12:00:00.000Z', '2026-09-20T12:00:00.000Z')`,
        id,
        status,
        scheduled
      );
    add("cs_statuses00001", "in_testing", "2026-09-21T12:00:00.000Z");
    add("cs_statuses00002", "scheduled", "2026-09-22T12:00:00.000Z");
    add("cs_statuses00003", "failed", "2026-09-23T12:00:00.000Z");
    const parts: string[] = Array.from({ length: 150 }, (_, i) => (i % 2 ? "scheduled" : "In Testing"));
    const list = await lab.call<Rows<LabComplianceListRow>>("GET", `/api/lab/compliance?status=${encodeURIComponent(parts.join(","))}`);
    expect(list.status, JSON.stringify(list.body)).toBe(200);
    expect(list.body.rows.map((r) => r.id)).toStrictEqual(["cs_statuses00002", "cs_statuses00001"]);
    const unknown = await lab.call<Fail>("GET", `/api/lab/compliance?status=${encodeURIComponent(parts.concat("bogus").join(","))}`);
    expect(unknown.status).toBe(400);
    expect(unknown.body.error).toBe("status");
  });
});

describe("BRIEF V25 law 1a: the status agrees with the test", () => {
  const retest = { license: "AU-P-000694", source_metrc_tag: "01401", sample_tag: "02401", required_test: "Retest (Coliforms)", entered_testing_on: "2026-10-01" };

  it("a Retest (Coliforms) sample refuses passed and failed (status-retest) and takes retest_passed", async () => {
    const { m, lab } = await setup();
    const logsBefore = logCount(m);
    const passed = await lab.call<Fail>("POST", "/api/lab/compliance", { ...retest, id: "cs_retest00000001", status: "passed" });
    expect(passed.status, JSON.stringify(passed.body)).toBe(400);
    expect(passed.body.error).toBe("status-retest");
    const failed = await lab.call<Fail>("POST", "/api/lab/compliance", { ...retest, id: "cs_retest00000001", status: "Failed", fail_reason: "Coliforms" });
    expect(failed.body.error).toBe("status-retest");
    // Case-blind, after trimming.
    const shouted = await lab.call<Fail>("POST", "/api/lab/compliance", { ...retest, id: "cs_retest00000001", required_test: "  RETEST (Metals) ", status: "passed" });
    expect(shouted.body.error).toBe("status-retest");
    expect(m.get("SELECT COUNT(*) AS n FROM lab_compliance_samples")?.n).toBe(0);
    expect(logCount(m)).toBe(logsBefore);

    const made = await lab.call<Created<LabComplianceRow>>("POST", "/api/lab/compliance", { ...retest, id: "cs_retest00000001", status: "in_testing" });
    expect(made.status, JSON.stringify(made.body)).toBe(201);
    let at = made.body.row.updated_at;
    const toPassed = await lab.call<Fail>("PATCH", "/api/lab/compliance/cs_retest00000001", { status: "passed", if_updated_at: at });
    expect(toPassed.status).toBe(400);
    expect(toPassed.body.error).toBe("status-retest");
    const toFailed = await lab.call<Fail>("PATCH", "/api/lab/compliance/cs_retest00000001", { status: "failed", fail_reason: "Coliforms", if_updated_at: at });
    expect(toFailed.body.error).toBe("status-retest");
    const took = await lab.call<Patched<LabComplianceRow>>("PATCH", "/api/lab/compliance/cs_retest00000001", { status: "retest_passed", finished_testing_on: "2026-10-03", thc_potency_pct: 22.1, if_updated_at: at });
    expect(took.status, JSON.stringify(took.body)).toBe(200);
    expect(took.body.row.status).toBe("retest_passed");
    at = took.body.row.updated_at;
    const retestFailed = await lab.call<Patched<LabComplianceRow>>("PATCH", "/api/lab/compliance/cs_retest00000001", { status: "retest_failed", fail_reason: "Coliforms", if_updated_at: at });
    expect(retestFailed.status, JSON.stringify(retestFailed.body)).toBe(200);
    expect(logsFor(m, "lab_compliance_samples", "cs_retest00000001").filter((l) => l.field === "status").map((l) => [l.old_value, l.new_value])).toStrictEqual([
      [null, "in_testing"],
      ["in_testing", "retest_passed"],
      ["retest_passed", "retest_failed"],
    ]);

    // A first test that turns into a retest while passed is refused too; one with a retest status is fine.
    const first = await lab.call<Created<LabComplianceRow>>("POST", "/api/lab/compliance", { ...retest, id: "cs_retest00000002", required_test: "Full Compliance", status: "passed" });
    expect(first.status, JSON.stringify(first.body)).toBe(201);
    const turned = await lab.call<Fail>("PATCH", "/api/lab/compliance/cs_retest00000002", { required_test: "Retest (Coliforms)" });
    expect(turned.body.error).toBe("status-retest");
    const turnedRight = await lab.call<Patched<LabComplianceRow>>("PATCH", "/api/lab/compliance/cs_retest00000002", { required_test: "Retest (Coliforms)", status: "retest_passed" });
    expect(turnedRight.status, JSON.stringify(turnedRight.body)).toBe(200);

    const o = await lab.call<R.LabOptions>("GET", "/api/lab/options");
    expect(o.body.retest_test_statuses).toStrictEqual(["scheduled", "not_submitted", "in_testing", "retest_passed", "retest_failed"]);
  });

  it("a stored Retest row with a plain passed is never rewritten: a correction that keeps the status lands, a new plain status is refused", async () => {
    const { m, lab } = await setup();
    m.run(
      `INSERT INTO lab_compliance_samples (id, program, license, market, source_metrc_tag, sample_tag, required_test, status, notes, scheduled_at, source, created_at, updated_at, changed_at)
       VALUES ('cs_stored0000001', 'compliance', 'AU-P-000694', 'AU', '1A4050300061761000001402', '1A4050300061761000002402', 'Retest (Coliforms)', 'passed', '', '2026-09-20T12:00:00.000Z', 'workbook', '2026-09-20T12:00:00.000Z', '2026-09-20T12:00:00.000Z', '2026-09-20T12:00:00.000Z')`
    );
    const noted = await lab.call<Patched<LabComplianceRow>>("PATCH", "/api/lab/compliance/cs_stored0000001", { notes: "read by the one retest rule", status: "passed" });
    expect(noted.status, JSON.stringify(noted.body)).toBe(200);
    expect(noted.body.row.status).toBe("passed");
    expect(noted.body.row.required_test).toBe("Retest (Coliforms)");
    expect(logsFor(m, "lab_compliance_samples", "cs_stored0000001").map((l) => l.field)).toStrictEqual(["notes"]);
    const plainFail = await lab.call<Fail>("PATCH", "/api/lab/compliance/cs_stored0000001", { status: "failed", fail_reason: "Coliforms" });
    expect(plainFail.body.error).toBe("status-retest");
    const corrected = await lab.call<Patched<LabComplianceRow>>("PATCH", "/api/lab/compliance/cs_stored0000001", { status: "retest_passed" });
    expect(corrected.status, JSON.stringify(corrected.body)).toBe(200);
    expect(corrected.body.row.status).toBe("retest_passed");
  });
});
