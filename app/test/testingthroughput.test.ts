import { describe, expect, it } from "vitest";
import { DD_KPIS, ddKpi, ddKpisForWall } from "../src/directorregistry";
import { loadIsStale, testingThroughputBody, testingWindowOf, type TestingModel } from "../src/testingthroughput";

function model(over: Partial<TestingModel> = {}): TestingModel {
  return {
    today: "2026-10-05",
    nowIso: "2026-10-05T16:00:00.000Z",
    lastLoadAt: "2026-10-05T15:00:00.000Z",
    intake: [
      { day: "2026-10-01", type: "First-time", n: 2 },
      { day: "2026-10-01", type: "Retest", n: 1 },
      { day: "2026-10-02", type: "Internal QA", n: 1 },
      { day: "2026-10-03", type: "First-time", n: 1 },
    ],
    coas: [
      { day: "2026-10-04", type: "First-time", n: 2 },
      { day: "2026-10-05", type: "Retest", n: 1 },
    ],
    tat: [
      { day: "2026-10-04", type: "First-time", n: 2, sum: 10 },
      { day: "2026-10-05", type: "Retest", n: 1, sum: 4 },
    ],
    ...over,
  };
}

describe("S3g: Testing Throughput", () => {
  it("averages over working days and splits by test type", () => {
    const view = testingWindowOf(model(), "htd");
    expect(view.tests).toBe(5);
    expect(view.testDays).toBe(3);
    expect(view.testsPerDay).toBe(1.7);
    expect(view.coas).toBe(3);
    expect(view.coaDays).toBe(2);
    expect(view.coasPerDay).toBe(1.5);
    expect(view.tat).toBe(4.7);
    expect(view.splits.find((row) => row.type === "First-time")).toMatchObject({ tests: 3, testDays: 2, coas: 2, tatN: 2, tatSum: 10 });
    expect(view.splits.find((row) => row.type === "Retest")).toMatchObject({ tests: 1, coas: 1, tatSum: 4 });
    expect(view.splits.find((row) => row.type === "Internal QA")).toMatchObject({ tests: 1, coas: 0 });
  });

  it("a window with tests and no COAs, and an empty window", () => {
    const testsOnly = testingWindowOf(model({ coas: [], tat: [], today: "2026-10-03" }), "7");
    expect(testsOnly.testsPerDay).toBe(1.7);
    expect(testsOnly.coasPerDay).toBeNull();
    expect(testsOnly.tat).toBeNull();
    expect(testsOnly.empty).toBe(false);
    const empty = testingWindowOf(model({ intake: [], coas: [], tat: [], today: "2026-01-15" }), "7");
    expect(empty.empty).toBe(true);
    expect(empty.testsPerDay).toBeNull();
  });

  it("shows the split in the one line under the boxes, and the count words follow the locale", () => {
    const html = testingThroughputBody(model(), "en");
    const markup = html.split("<script>")[0];
    expect((markup.match(/data-dd-test-detail/g) ?? []).length).toBe(1);
    expect((markup.match(/data-dd-test-split=/g) ?? []).length).toBe(3);
    expect(markup).toContain('data-dd-test-split="First-time 1.5 (3 over 2); Retest 1.0 (1 over 1); Internal QA 1.0 (1 over 1)"');
    expect(html).toContain('root.querySelector("p[data-dd-test-detail]")');
    expect(html).toContain('box.getAttribute("data-dd-test-split")');
    const es = testingThroughputBody(model(), "es");
    expect(es).toContain("5 pruebas en 3 dias de ingreso");
    expect(es).toContain("First-time 1.5 (3 en 2)");
    expect(es).toContain('"over":"en"');
  });

  it("warns when the last load is older than a day", () => {
    expect(loadIsStale("2026-10-03T16:00:00.000Z", "2026-10-05T16:00:00.000Z")).toBe(true);
    expect(loadIsStale("2026-10-05T15:00:00.000Z", "2026-10-05T16:00:00.000Z")).toBe(false);
    expect(loadIsStale(null, "2026-10-05T16:00:00.000Z")).toBe(true);
  });

  it("keeps BTR on bizops and culttech and puts Testing Throughput on bizops only, right after BTR", () => {
    expect(ddKpi("harvest.btr_pct")?.wall_keys).toBe("bizops,culttech");
    const biz = ddKpisForWall(DD_KPIS, "bizops").map((row) => row.kpi_key);
    const at = biz.indexOf("harvest.btr_pct");
    expect(biz[at + 1]).toBe("bizops.testing_throughput");
    expect(ddKpisForWall(DD_KPIS, "culttech").map((row) => row.kpi_key)).not.toContain("bizops.testing_throughput");
    expect(ddKpisForWall(DD_KPIS, "farmops").map((row) => row.kpi_key)).not.toContain("bizops.testing_throughput");
    expect(ddKpi("bizops.testing_throughput")).toMatchObject({
      title_en: "Testing Throughput",
      title_es: "Rendimiento de pruebas",
      unit: "ratio",
      cadence: "daily",
      dims: "test_type",
      goal_kind: "none",
      source_kind: "connector",
      status: "live",
      def_version: 1,
      open_question_en: null,
      wall_keys: "bizops",
    });
  });
});
