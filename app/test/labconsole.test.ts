import { describe, expect, it } from "vitest";
import { loadComplianceKpis } from "../src/biz";
import { complianceMenuPage } from "../src/compliance";
import { loadTestingSection } from "../src/console";
import { LAB_ATTEMPT_SQL, LAB_OUTCOME_SQL, labAttempt, labOutcome } from "../src/labvocab";
import { migratedDb, seedBatch, type MigratedDb } from "./migrated";

// THE LAB STATION (canon 0.30.362), BRIEF V24 law 7: the Harvest Console's
// Testing section and the Compliance Console read lab_compliance_samples.

const T = "2026-10-02T12:00:00.000Z";
const LOT_26 = "46223-ARL-GH-015-0-NA-26001";
const LOT_25 = "46223-ARL-GH-015-0-NA-25999";

type Sample = {
  id: string;
  status: string;
  program?: "compliance" | "rnd";
  strain?: string | null;
  hbn?: string | null;
  entered?: string | null;
  reason?: string | null;
  grams?: number | null;
  voided?: string | null;
  sampleTag?: string | null;
  scheduledAt?: string;
};

let serial = 0;

function sample(m: MigratedDb, s: Sample): void {
  serial += 1;
  m.run(
    `INSERT INTO lab_compliance_samples (
       id, program, license, market, strain, source_metrc_tag, batch_weight_g, harvest_batch,
       sample_tag, required_test, entered_testing_on, status, fail_reason, notes, scheduled_at,
       created_at, updated_at, changed_at, voided_at
     ) VALUES (?, ?, 'AU-P-000694', 'AU', ?, ?, ?, ?, ?, 'Full Compliance', ?, ?, ?, '', ?, ?, ?, ?, ?)`,
    s.id,
    s.program ?? "compliance",
    s.strain === undefined ? "Bench Strain" : s.strain,
    `1A4050300000000000${String(100000 + serial)}`,
    s.grams ?? null,
    s.hbn === undefined ? LOT_26 : s.hbn,
    s.sampleTag === undefined ? `SMP-${s.id}` : s.sampleTag,
    s.entered === undefined ? "2026-08-10" : s.entered,
    s.status,
    s.reason ?? null,
    s.scheduledAt ?? T,
    T,
    T,
    T,
    s.voided ?? null
  );
}

describe("THE LAB STATION vocabulary in SQL agrees with labvocab", () => {
  it("maps all seven statuses the same way in TypeScript and in SQL", async () => {
    const m = await migratedDb();
    const statuses = ["scheduled", "not_submitted", "in_testing", "passed", "failed", "retest_passed", "retest_failed"];
    statuses.forEach((status, i) => sample(m, { id: `v${i}`, status }));
    const rows = m.all(`SELECT status, ${LAB_OUTCOME_SQL} AS outcome, ${LAB_ATTEMPT_SQL} AS attempt FROM lab_compliance_samples`);
    expect(rows).toHaveLength(7);
    for (const row of rows) {
      expect(row.outcome).toBe(labOutcome(String(row.status)));
      expect(Number(row.attempt)).toBe(labAttempt(String(row.status)));
    }
    expect(rows.filter((row) => row.outcome === "open").map((row) => row.status).sort()).toEqual(["in_testing", "not_submitted", "scheduled"]);
  });
});

describe("THE LAB STATION on the Harvest Console's Testing section (loadTestingSection)", () => {
  it("reads only compliance samples that are not voided", async () => {
    const m = await migratedDb();
    sample(m, { id: "p1", status: "passed" });
    sample(m, { id: "f1", status: "failed", reason: "Coliforms" });
    sample(m, { id: "rnd", status: "failed", reason: "Pesticides", program: "rnd" });
    sample(m, { id: "void", status: "failed", reason: "Heavy Metals", voided: T });
    const figures = await loadTestingSection(m.db, 2026);
    expect(figures.tests).toBe(2);
    expect(figures.fails).toBe(1);
    expect(figures.ftq).toBe("50.0");
    expect(figures.slices.map((slice) => slice.mode)).toEqual(["Coliforms"]);
  });

  it("does not count retests as first tests", async () => {
    const m = await migratedDb();
    sample(m, { id: "p1", status: "passed", strain: "Alpha" });
    sample(m, { id: "f1", status: "failed", reason: "Coliforms", strain: "Alpha" });
    const before = await loadTestingSection(m.db, 2026);
    sample(m, { id: "rp", status: "retest_passed", strain: "Alpha" });
    sample(m, { id: "rf", status: "retest_failed", reason: "Yeast", strain: "Alpha" });
    const after = await loadTestingSection(m.db, 2026);
    expect(after.tests).toBe(before.tests);
    expect(after.fails).toBe(before.fails);
    expect(after.ftq).toBe(before.ftq);
    expect(after.slices.map((slice) => slice.mode)).toEqual(["Coliforms"]);
  });

  it("leaves an open first test out of the denominator", async () => {
    const m = await migratedDb();
    sample(m, { id: "p1", status: "passed" });
    sample(m, { id: "f1", status: "failed", reason: "Coliforms" });
    const before = await loadTestingSection(m.db, 2026);
    const kpisBefore = await loadComplianceKpis(m.db);
    sample(m, { id: "o1", status: "scheduled", sampleTag: null });
    sample(m, { id: "o2", status: "not_submitted" });
    sample(m, { id: "o3", status: "in_testing" });
    const after = await loadTestingSection(m.db, 2026);
    const kpisAfter = await loadComplianceKpis(m.db);
    expect(after.tests).toBe(2);
    expect(after.tests).toBe(before.tests);
    expect(after.ftq).toBe(before.ftq);
    expect(kpisAfter.ftq).toEqual(kpisBefore.ftq);
    expect(kpisAfter.ftq.n).toBe(2);
  });

  it("names the season by the lot token: seventh segment, else first segment, else the entered year", async () => {
    const m = await migratedDb();
    sample(m, { id: "seventh", status: "passed", hbn: LOT_26, entered: "2025-12-01" });
    sample(m, { id: "first", status: "passed", hbn: "26xyz-ARL", entered: "2025-01-01" });
    sample(m, { id: "old", status: "failed", reason: "Coliforms", hbn: LOT_25, entered: "2026-06-01" });
    sample(m, { id: "entered", status: "failed", reason: "Yeast", hbn: null, entered: "2026-04-01" });
    sample(m, { id: "nothing", status: "failed", reason: "Heavy Metals", hbn: null, entered: null });
    const figures = await loadTestingSection(m.db, 2026);
    expect(figures.tests).toBe(3);
    expect(figures.fails).toBe(1);
    expect(figures.slices.map((slice) => slice.mode)).toEqual(["Yeast"]);
    const lastYear = await loadTestingSection(m.db, 2025);
    expect(lastYear.tests).toBe(1);
    expect(lastYear.slices.map((slice) => slice.mode)).toEqual(["Coliforms"]);
  });

  it("slices the pie by the whole fail_reason, with strain and market labels and whole grams", async () => {
    const m = await migratedDb();
    seedBatch(m, { id: "hb-pie", hbn: LOT_26, serial: 1, farm: "ARL" });
    m.run(`UPDATE harvest_batches SET market_strain = 'Market Name' WHERE id = 'hb-pie'`);
    sample(m, { id: "c1", status: "failed", reason: "Coliforms", strain: "Bench Strain", grams: 100.4 });
    sample(m, { id: "c2", status: "failed", reason: "Coliforms", strain: "Market Name", grams: 200.5 });
    sample(m, { id: "combo", status: "failed", reason: "Coliforms, Total Yeast & Mold", strain: "Bench Strain", grams: 50 });
    const figures = await loadTestingSection(m.db, 2026);
    expect(figures.fails).toBe(3);
    expect(figures.slices.map((slice) => slice.mode)).toEqual(["Coliforms", "Coliforms, Total Yeast & Mold"]);
    const coli = figures.slices[0];
    expect(coli).toMatchObject({ count: 2, pct: "66.7", grams: 301 });
    expect(coli.strains.map((strain) => strain.label).sort()).toEqual(["Bench Strain / Market Name", "Market Name"]);
    expect(figures.slices[1]).toMatchObject({ count: 1, pct: "33.3", grams: 50 });
  });
});

describe("THE LAB STATION on the Compliance Console (loadComplianceKpis)", () => {
  it("splits each failed sample's fail_reason on commas for the pareto", async () => {
    const m = await migratedDb();
    sample(m, { id: "a", status: "failed", reason: "Coliforms" });
    sample(m, { id: "b", status: "failed", reason: "Coliforms" });
    sample(m, { id: "c", status: "failed", reason: "Coliforms, Total Yeast & Mold" });
    sample(m, { id: "d", status: "retest_failed", reason: "Heavy Metals" });
    sample(m, { id: "e", status: "failed", reason: "Pesticides", program: "rnd" });
    sample(m, { id: "f", status: "failed", reason: "Yeast", voided: T });
    sample(m, { id: "g", status: "passed", reason: "Mycotoxins" });
    const kpis = await loadComplianceKpis(m.db);
    expect(kpis.pareto).toEqual([
      { mode: "Coliforms", count: 3, pct: 60 },
      { mode: "Heavy Metals", count: 1, pct: 20 },
      { mode: "Total Yeast & Mold", count: 1, pct: 20 },
    ]);
  });

  it("counts first tests only, over all seasons, for the FTQ", async () => {
    const m = await migratedDb();
    sample(m, { id: "p25", status: "passed", hbn: LOT_25 });
    sample(m, { id: "f26", status: "failed", reason: "Coliforms", hbn: LOT_26 });
    sample(m, { id: "open", status: "in_testing" });
    sample(m, { id: "retest", status: "retest_passed" });
    sample(m, { id: "rnd", status: "passed", program: "rnd" });
    sample(m, { id: "void", status: "passed", voided: T });
    const kpis = await loadComplianceKpis(m.db);
    expect(kpis.ftq).toEqual({ n: 2, passed: 1, rate: 50 });
  });

  it("sums the batch weight of the samples in_testing for Lbs in testing", async () => {
    const m = await migratedDb();
    sample(m, { id: "w1", status: "in_testing", grams: 448 });
    sample(m, { id: "w2", status: "in_testing", grams: null });
    sample(m, { id: "w3", status: "in_testing", grams: 224 });
    sample(m, { id: "rnd", status: "in_testing", grams: 896, program: "rnd" });
    sample(m, { id: "void", status: "in_testing", grams: 4480, voided: T });
    sample(m, { id: "done", status: "passed", grams: 1000 });
    const kpis = await loadComplianceKpis(m.db);
    expect(kpis.lbs).toMatchObject({ grams: 672, lbs: 1.5 });
    const page = complianceMenuPage(kpis);
    expect(page).toContain("1.50 lbs");
    expect(page).toContain("No failed external tests yet.");
  });
});
