import { describe, expect, it } from "vitest";
import { loadComplianceKpis } from "../src/biz";
import { externalRowFromLab, labStatusText, testingPage } from "../src/compliance";
import { loadTestingSection } from "../src/console";
import { ACCESS_EMAIL_HEADER } from "../src/identity";
import { app } from "../src/index";
import { migratedDb, type MigratedDb } from "./migrated";

// THE LAB STATION (canon 0.30.362), BRIEF V24 laws 3 and 7: the Internal tab is
// the station, the package's link redirects to it, the External tab points to
// it and lists its compliance samples, and the consoles read them.

const T = "2026-10-02T12:00:00.000Z";
const PIN = "gf_pin=21319";
const EMAIL = "bench@example.test";
const LOT_26 = "46223-ARL-GH-015-0-NA-26001";
const LOT_25 = "46223-ARL-GH-015-0-NA-25999";
const PROC = "1A40503000617610000";

function envOf(m: MigratedDb): Env {
  return {
    DB: m.db,
    THEME: "grip",
    ASSETS: { fetch: () => Promise.resolve(new Response("ok", { status: 200 })) },
  } as unknown as Env;
}

async function benchDb(): Promise<MigratedDb> {
  const m = await migratedDb();
  m.run(
    `INSERT INTO people (id, display_name, email, is_active, created_at, updated_at) VALUES ('person-bench', 'Bench Tester', ?, 1, ?, ?)`,
    EMAIL,
    T,
    T
  );
  return m;
}

function headers(extra: Record<string, string> = {}): Record<string, string> {
  return { Cookie: PIN, [ACCESS_EMAIL_HEADER]: EMAIL, ...extra };
}

const station = { "content-type": "application/json", "x-lab-client": "station" };

async function api(m: MigratedDb, path: string, method: string, body?: unknown, extra: Record<string, string> = station) {
  const res = await app.request(
    path,
    { method, headers: headers(extra), body: body === undefined ? undefined : JSON.stringify(body) },
    envOf(m)
  );
  const text = await res.text();
  let json: Record<string, unknown> | null = null;
  try {
    json = JSON.parse(text) as Record<string, unknown>;
  } catch {
    json = null;
  }
  return { status: res.status, type: res.headers.get("content-type") ?? "", json, text };
}

describe("THE LAB STATION surface through the app", () => {
  it("renders the station on the Internal tab, with no instrument drops", async () => {
    const m = await benchDb();
    const res = await app.request("/compliance/testing?tab=internal", { headers: headers() }, envOf(m));
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("data-lab-station");
    expect(html).not.toContain('action="/compliance/testing/internal"');
    expect(html).not.toContain('value="orange_photonics"');
    expect(html).not.toContain('value="aqualab"');
    // The signed-in person's display name, so the name box is not asked for.
    expect(html).toContain("Bench Tester");
    expect(html).not.toContain('id="lab-operator"');
  });

  it("redirects the package's link to the Internal tab", async () => {
    const m = await benchDb();
    const res = await app.request("/station/lab_tests", { headers: headers() }, envOf(m));
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("/compliance/testing?tab=internal");
  });

  it("refuses a write without the station header, and lands a bench reading with the full tag", async () => {
    const m = await benchDb();
    const reading = {
      id: "lt_surface0001",
      location: "Silo 3",
      reason: "During Silo",
      license: "AU-G-C-000832",
      metrc_tag: "56899",
      sample_type: "Flower",
      moisture_pct: 13.2,
    };
    const refused = await api(m, "/api/lab/internal-tests", "POST", reading, { "content-type": "application/json" });
    expect(refused.status).toBe(403);
    expect(refused.type).toContain("application/json");
    expect(refused.json?.error).toBe("client-header-required");
    expect(m.get("SELECT COUNT(*) AS n FROM lab_internal_tests")?.n).toBe(0);

    const saved = await api(m, "/api/lab/internal-tests", "POST", reading);
    expect(saved.status).toBe(201);
    const row = saved.json?.row as Record<string, unknown>;
    expect(row.metrc_tag).toBe("1A40503000311FB000056899");
    expect(row.moisture_pct).toBe(13.2);

    const list = await api(m, "/api/lab/internal-tests", "GET", undefined, {});
    expect(list.status).toBe(200);
    const rows = list.json?.rows as Array<Record<string, unknown>>;
    expect(rows.map((r) => r.metrc_tag)).toContain("1A40503000311FB000056899");

    const feed = await app.request("/feeds/lab-internal-tests.json", {}, envOf(m));
    expect(feed.status).toBe(200);
    const body = (await feed.json()) as { rows: Array<Record<string, unknown>> };
    expect(body.rows.map((r) => r.metrc_tag)).toContain("1A40503000311FB000056899");
  });

  it("points the External tab to the station and lists compliance samples, not R&D", async () => {
    const m = await benchDb();
    const base = {
      license: "AU-P-000694",
      market: "AU",
      required_test: "Full Compliance",
      testing_facility: "SC Labs",
      harvest_batch: LOT_26,
      entered_testing_on: "2026-09-20",
      status: "in_testing",
    };
    const comp = await api(m, "/api/lab/compliance", "POST", {
      ...base,
      id: "cs_surface0001",
      program: "compliance",
      source_metrc_tag: `${PROC}11111`,
      sample_tag: `${PROC}22222`,
      item_name: "Station Compliance Item",
    });
    expect(comp.status).toBe(201);
    const rnd = await api(m, "/api/lab/compliance", "POST", {
      ...base,
      id: "cs_surface0002",
      program: "rnd",
      source_metrc_tag: `${PROC}33333`,
      sample_tag: `${PROC}44444`,
      item_name: "Station Rnd Item",
    });
    expect(rnd.status).toBe(201);

    const res = await app.request("/compliance/testing?tab=external", { headers: headers() }, envOf(m));
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("data-lab-station-pointer");
    expect(html).toContain('href="/compliance/testing?tab=internal"');
    expect(html).not.toContain('action="/compliance/testing/external"');
    expect(html).not.toContain("Add external result");
    expect(html).toContain(`${PROC}22222`);
    expect(html).toContain("In testing");
    expect(html).not.toContain(`${PROC}44444`);
    expect(html).not.toContain("/record/external_test_results/");
  });

  it("filters the External tab's season by the lot token", async () => {
    const m = await benchDb();
    const sample = (id: string, tag: string, hbn: string, entered: string) =>
      m.run(
        `INSERT INTO lab_compliance_samples (
           id, program, license, market, source_metrc_tag, harvest_batch, sample_tag, required_test,
           entered_testing_on, status, notes, scheduled_at, created_at, updated_at, changed_at
         ) VALUES (?, 'compliance', 'AU-P-000694', 'AU', ?, ?, ?, 'Full Compliance', ?, 'in_testing', '', ?, ?, ?, ?)`,
        id,
        `${PROC}${tag}`,
        hbn,
        `${PROC}9${tag.slice(1)}`,
        entered,
        T,
        T,
        T,
        T
      );
    sample("cs_season0001", "10001", LOT_26, "2025-12-01");
    sample("cs_season0002", "10002", LOT_25, "2026-06-01");
    const res = await app.request("/compliance/testing?tab=external&year=2026", { headers: headers() }, envOf(m));
    const html = await res.text();
    expect(html).toContain(`${PROC}90001`);
    expect(html).not.toContain(`${PROC}90002`);
    const all = await (await app.request("/compliance/testing?tab=external", { headers: headers() }, envOf(m))).text();
    expect(all).toContain(`${PROC}90002`);
  });

  it("offers the External tab's Status filter as a select of the seven station statuses, and filters by it", async () => {
    const m = await benchDb();
    const sample = (id: string, tag: string, status: string) =>
      m.run(
        `INSERT INTO lab_compliance_samples (
           id, program, license, market, source_metrc_tag, harvest_batch, sample_tag, required_test,
           entered_testing_on, status, fail_reason, notes, scheduled_at, created_at, updated_at, changed_at
         ) VALUES (?, 'compliance', 'AU-P-000694', 'AU', ?, ?, ?, 'Full Compliance', '2026-09-20', ?, ?, '', ?, ?, ?, ?)`,
        id,
        `${PROC}${tag}`,
        LOT_26,
        `${PROC}8${tag.slice(1)}`,
        status,
        status === "failed" ? "Coliforms" : null,
        T,
        T,
        T,
        T
      );
    sample("cs_filter0001", "20001", "failed");
    sample("cs_filter0002", "20002", "in_testing");

    const all = await (await app.request("/compliance/testing?tab=external", { headers: headers() }, envOf(m))).text();
    const select = all.match(/<select name="status">[\s\S]*?<\/select>/)?.[0] ?? "";
    expect(select).not.toBe("");
    expect(all).not.toContain('<input type="text" name="status"');
    const values = [...select.matchAll(/<option value="([^"]*)"/g)].map((x) => x[1]);
    expect(values).toEqual(["", "scheduled", "not_submitted", "in_testing", "passed", "failed", "retest_passed", "retest_failed"]);
    expect(select).toContain('<option value="in_testing">In testing</option>');
    expect(select).toContain('<option value="" selected></option>');
    expect(all).toContain(`${PROC}80001`);
    expect(all).toContain(`${PROC}80002`);

    const failed = await (await app.request("/compliance/testing?tab=external&status=failed", { headers: headers() }, envOf(m))).text();
    expect(failed).toContain('<option value="failed" selected>Failed</option>');
    expect(failed).toContain(`${PROC}80001`);
    expect(failed).not.toContain(`${PROC}80002`);

    const es = testingPage("external", [], { facility: "", status: "retest_passed", year: "" }, "es");
    expect(es).toContain('<option value="retest_passed" selected>Reprueba aprobada</option>');
    const stale = testingPage("external", [], { facility: "", status: "Pending", year: "" });
    expect(stale).toContain('<option value="Pending" selected>Pending</option>');
  });

  it("shows a compliance sample moved to failed on the Harvest Console's Testing figures and the Compliance FTQ", async () => {
    const m = await benchDb();
    const created = await api(m, "/api/lab/compliance", "POST", {
      id: "cs_surface0003",
      program: "compliance",
      license: "AU-P-000694",
      market: "AU",
      required_test: "Full Compliance",
      source_metrc_tag: `${PROC}55555`,
      sample_tag: `${PROC}66666`,
      harvest_batch: LOT_26,
      entered_testing_on: "2026-09-20",
      status: "in_testing",
      batch_weight_g: 448,
    });
    expect(created.status).toBe(201);
    const before = await loadComplianceKpis(m.db);
    expect(before.ftq.n).toBe(0);
    expect(before.lbs.grams).toBe(448);

    const moved = await api(m, "/api/lab/compliance/cs_surface0003", "PATCH", { status: "failed", fail_reason: "Coliforms" });
    expect(moved.status).toBe(200);

    const figures = await loadTestingSection(m.db, 2026);
    expect(figures.tests).toBe(1);
    expect(figures.fails).toBe(1);
    expect(figures.ftq).toBe("0.0");
    expect(figures.slices.map((slice) => slice.mode)).toEqual(["Coliforms"]);
    const kpis = await loadComplianceKpis(m.db);
    expect(kpis.ftq).toEqual({ n: 1, passed: 0, rate: 0 });
    expect(kpis.pareto.map((bar) => bar.mode)).toEqual(["Coliforms"]);
    expect(kpis.lbs.grams).toBe(0);
  });
});

describe("THE LAB STATION External tab rows", () => {
  it("maps a sample to a row: the station's status through its label, labvocab's attempt, no pencil", () => {
    const row = externalRowFromLab({
      id: "cs_unit00001",
      license: "AU-P-000694",
      market: "AU",
      sample_tag: "SMP-1",
      item_name: "Unit Item",
      testing_facility: "SC Labs",
      status: "retest_passed",
      fail_reason: null,
      net_weight_g: 14,
      batch_weight_g: null,
    });
    expect(row).toMatchObject({ id: "cs_unit00001", attempt: 2, status: "retest_passed", source: "lab", net_weight_grams: 14, batch_weight_grams: null });
    expect(externalRowFromLab({ id: "x", status: "failed" }).attempt).toBe(1);
    expect(labStatusText("retest_passed", "en")).toBe("Retest passed");
    expect(labStatusText("retest_passed", "es")).toBe("Reprueba aprobada");
    expect(labStatusText("in_testing", "en")).toBe("In testing");
    expect(labStatusText("Pending", "en")).toBe("Pending");
    const html = testingPage("external", [row], { facility: "", status: "", year: "" });
    expect(html).toContain('class="report-scroll"><table class="data"');
    expect(html).toContain("Retest passed");
    // The row shows the label; the station word rides only the Status filter's option values.
    const tbody = html.slice(html.indexOf("<tbody>"), html.indexOf("</tbody>"));
    expect(tbody).toContain("Retest passed");
    expect(tbody).not.toContain("retest_passed");
    expect(html).not.toContain("Edit result");
    expect(html).toContain("data-lab-station-pointer");
    expect(html).toContain("Compliance samples are entered at the lab station, on the Internal tab.");
    expect(html).not.toContain('action="/compliance/testing/external"');
  });
});
