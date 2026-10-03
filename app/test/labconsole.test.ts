import { describe, expect, it } from "vitest";
import { loadComplianceKpis } from "../src/biz";
import { complianceMenuPage, externalRowFromLab } from "../src/compliance";
import { loadTestingSection } from "../src/console";
import { latestFinalizedPotency, listLabelPackages } from "../src/db";
import { LAB_ATTEMPT_SQL, LAB_OUTCOME_SQL, isLabRetest, isRetestTest, labAttempt, labInTestingGrams, labOutcome } from "../src/labvocab";
import { loadPuzzlePage } from "../src/puzzles";
import { migratedDb, seedBatch, seedLot, type MigratedDb } from "./migrated";

// THE LAB STATION (canon 0.30.362), BRIEF V24 law 7: the Harvest Console's
// Testing section and the Compliance Console read lab_compliance_samples.
// THE STATION IS THE TEST RECORD (canon 0.30.365), BRIEF V25: the one retest
// rule, Lbs in testing by package, Post Harvest Puzzles and Labels.

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
  /** BRIEF V25: the required test (Full Compliance by default), the source tag, the change stamp,
   * and what Puzzles and Labels read (potency, finish date, item, net weight, facility). */
  test?: string;
  source?: string;
  changedAt?: string;
  potency?: number | null;
  finished?: string | null;
  item?: string | null;
  net?: number | null;
  facility?: string | null;
};

let serial = 0;

function sample(m: MigratedDb, s: Sample): void {
  serial += 1;
  m.run(
    `INSERT INTO lab_compliance_samples (
       id, program, license, market, strain, source_metrc_tag, batch_weight_g, harvest_batch,
       sample_tag, required_test, entered_testing_on, status, fail_reason, notes, scheduled_at,
       created_at, updated_at, changed_at, voided_at,
       thc_potency_pct, finished_testing_on, item_name, net_weight_g, testing_facility
     ) VALUES (?, ?, 'AU-P-000694', 'AU', ?, ?, ?, ?, ?, ?, ?, ?, ?, '', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    s.id,
    s.program ?? "compliance",
    s.strain === undefined ? "Bench Strain" : s.strain,
    s.source ?? `1A4050300000000000${String(100000 + serial)}`,
    s.grams ?? null,
    s.hbn === undefined ? LOT_26 : s.hbn,
    s.sampleTag === undefined ? `SMP-${s.id}` : s.sampleTag,
    s.test ?? "Full Compliance",
    s.entered === undefined ? "2026-08-10" : s.entered,
    s.status,
    s.reason ?? null,
    s.scheduledAt ?? T,
    T,
    T,
    s.changedAt ?? T,
    s.voided ?? null,
    s.potency ?? null,
    s.finished ?? null,
    s.item ?? null,
    s.net ?? null,
    s.facility ?? null
  );
}

describe("THE LAB STATION vocabulary in SQL agrees with labvocab", () => {
  it("maps all seven statuses the same way in TypeScript and in SQL", async () => {
    const m = await migratedDb();
    const statuses = ["scheduled", "not_submitted", "in_testing", "passed", "failed", "retest_passed", "retest_failed"];
    statuses.forEach((status, i) => sample(m, { id: `v${i}`, status }));
    const rows = m.all(`SELECT status, required_test, ${LAB_OUTCOME_SQL} AS outcome, ${LAB_ATTEMPT_SQL} AS attempt FROM lab_compliance_samples`);
    expect(rows).toHaveLength(7);
    for (const row of rows) {
      expect(row.outcome).toBe(labOutcome(String(row.status)));
      expect(Number(row.attempt)).toBe(labAttempt(String(row.status), String(row.required_test)));
    }
    expect(rows.filter((row) => row.outcome === "open").map((row) => row.status).sort()).toEqual(["in_testing", "not_submitted", "scheduled"]);
  });

  it("BRIEF V25 law 1: a required test that begins with Retest (case-blind, trimmed) is a retest in TypeScript and in SQL alike", async () => {
    const m = await migratedDb();
    // LIKE as Postgres reads it (case-sensitive), so the SQL's own LOWER carries the case blindness.
    m.run("PRAGMA case_sensitive_like = ON");
    const tests = ["Retest (Coliforms)", "  retest (metals) ", "RETEST (Total Yeast & Mold)", "Retest", "Full Compliance", "Re-test (Coliforms)", "Full Compliance Retest", ""];
    const retests = new Set(["Retest (Coliforms)", "  retest (metals) ", "RETEST (Total Yeast & Mold)", "Retest"]);
    for (const status of ["passed", "failed", "in_testing", "retest_passed"]) {
      tests.forEach((test, i) => sample(m, { id: `${status}-${i}`, status, test }));
    }
    const rows = m.all(`SELECT id, status, required_test, ${LAB_ATTEMPT_SQL} AS attempt FROM lab_compliance_samples`);
    expect(rows).toHaveLength(32);
    for (const row of rows) {
      const test = String(row.required_test);
      expect(isRetestTest(test), test).toBe(retests.has(test));
      expect(isLabRetest(String(row.status), test), String(row.id)).toBe(retests.has(test) || row.status === "retest_passed");
      expect(Number(row.attempt), String(row.id)).toBe(labAttempt(String(row.status), test));
    }
    expect(labAttempt("passed", "Retest (Coliforms)")).toBe(2);
    expect(labAttempt("passed", "Full Compliance")).toBe(1);
    expect(labAttempt("retest_failed", "Full Compliance")).toBe(2);
    expect(labAttempt("passed", null)).toBe(1);
    expect(labOutcome("passed")).toBe("passed");
  });
});

describe("BRIEF V25: a Retest required test is never a first test", () => {
  it("a stored Retest (Coliforms) row with status passed or failed leaves First Time Tests, the FTQ and the pie as they were", async () => {
    const m = await migratedDb();
    sample(m, { id: "p1", status: "passed" });
    sample(m, { id: "p2", status: "passed" });
    sample(m, { id: "f1", status: "failed", reason: "Coliforms" });
    const consoleBefore = await loadTestingSection(m.db, 2026);
    const kpisBefore = await loadComplianceKpis(m.db);
    expect(consoleBefore).toMatchObject({ tests: 3, fails: 1, ftq: "66.7" });
    expect(kpisBefore.ftq).toEqual({ n: 3, passed: 2, rate: 66.7 });
    sample(m, { id: "rt-pass", status: "passed", test: "Retest (Coliforms)" });
    sample(m, { id: "rt-fail", status: "failed", reason: "Total Yeast & Mold", test: "retest (total yeast & mold)" });
    sample(m, { id: "rt-open", status: "in_testing", test: "Retest (Coliforms)" });
    const consoleAfter = await loadTestingSection(m.db, 2026);
    const kpisAfter = await loadComplianceKpis(m.db);
    expect(consoleAfter.tests).toBe(consoleBefore.tests);
    expect(consoleAfter.fails).toBe(consoleBefore.fails);
    expect(consoleAfter.ftq).toBe(consoleBefore.ftq);
    expect(consoleAfter.slices.map((slice) => slice.mode)).toEqual(["Coliforms"]);
    expect(kpisAfter.ftq).toEqual(kpisBefore.ftq);
    // The retest's outcome stays by status: its failure still reads on the pareto.
    expect(kpisAfter.pareto.map((row) => row.mode)).toEqual(["Coliforms", "Total Yeast & Mold"]);
  });

  it("a Retest sample is attempt 2 on the External tab", () => {
    const base = { id: "x", status: "passed", required_test: "Full Compliance" };
    expect(externalRowFromLab(base).attempt).toBe(1);
    expect(externalRowFromLab({ ...base, required_test: "Retest (Coliforms)" }).attempt).toBe(2);
    expect(externalRowFromLab({ ...base, status: "retest_passed" }).attempt).toBe(2);
  });
});

describe("BRIEF V25 law 2: Lbs in testing counts a package once", () => {
  it("two in_testing samples on one source tag count one batch weight, the newest's", async () => {
    const m = await migratedDb();
    const tag = "1A4050300061761000001001";
    sample(m, { id: "first", status: "in_testing", source: tag, grams: 10969.7, test: "Retest (Coliforms)", scheduledAt: "2026-09-28T12:00:00.000Z" });
    sample(m, { id: "second", status: "in_testing", source: tag, grams: 10969.7, test: "Retest (Coliforms)", scheduledAt: "2026-09-28T12:00:00.000Z" });
    let kpis = await loadComplianceKpis(m.db);
    expect(kpis.lbs).toMatchObject({ grams: 10970 });
    // The newest by scheduled_at carries the weight; a sample of another package adds its own.
    sample(m, { id: "newer", status: "in_testing", source: ` ${tag.toLowerCase()} `, grams: 448, scheduledAt: "2026-09-29T12:00:00.000Z" });
    sample(m, { id: "other", status: "in_testing", grams: 224 });
    kpis = await loadComplianceKpis(m.db);
    expect(kpis.lbs).toMatchObject({ grams: 672, lbs: 1.5 });
    // Not in testing, R&D, or voided: none of them counts, on the tag or off it.
    sample(m, { id: "passed", status: "passed", source: tag, grams: 99999, scheduledAt: "2026-10-01T12:00:00.000Z" });
    sample(m, { id: "rnd", status: "in_testing", source: tag, grams: 88888, program: "rnd", scheduledAt: "2026-10-01T12:00:00.000Z" });
    sample(m, { id: "void", status: "in_testing", source: tag, grams: 77777, voided: T, scheduledAt: "2026-10-01T12:00:00.000Z" });
    kpis = await loadComplianceKpis(m.db);
    expect(kpis.lbs).toMatchObject({ grams: 672, lbs: 1.5 });
    expect(complianceMenuPage(kpis)).toContain("1.50 lbs");
  });

  it("a sample with no source tag counts on its own; a tie on scheduled_at falls to changed_at, then the id", async () => {
    const m = await migratedDb();
    sample(m, { id: "blank-a", status: "in_testing", source: "", grams: 100 });
    sample(m, { id: "blank-b", status: "in_testing", source: "  ", grams: 200 });
    const kpis = await loadComplianceKpis(m.db);
    expect(kpis.lbs.grams).toBe(300);
    const at = "2026-09-28T12:00:00.000Z";
    const row = (id: string, grams: number, changed: string) => ({ id, source_metrc_tag: "TAG-1", batch_weight_g: grams, scheduled_at: at, changed_at: changed });
    expect(labInTestingGrams([row("a", 10, "2026-09-29T00:00:00.000Z"), row("b", 20, "2026-09-28T00:00:00.000Z")])).toBe(10);
    expect(labInTestingGrams([row("a", 10, at), row("b", 20, at)])).toBe(20);
    expect(labInTestingGrams([row("b", 20, at), row("a", 10, at)])).toBe(20);
    expect(labInTestingGrams([{ ...row("a", 10, at), batch_weight_g: null }, { ...row("z", 5, at), source_metrc_tag: null }])).toBe(5);
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

describe("BRIEF V25 law 3: Post Harvest Puzzles' live year reads the station", () => {
  it("potency, the TYM rule and the attempt by the one retest rule, the year by the lot token, R&D and voided out", async () => {
    const m = await migratedDb();
    seedBatch(m, { id: "hb-php", hbn: LOT_26, serial: 1, farm: "ARL" });
    m.run(`UPDATE harvest_batches SET market_strain = 'Bench Strain' WHERE id = 'hb-php'`);
    seedLot(m, "lot-php", "hb-php");
    const empty = await loadPuzzlePage(m.db, "2026", "All");
    expect(empty.source).toBe("live");
    expect(empty.rows[0]).toMatchObject({ strain: "After Party", tests: 0, tymFails: 0, thc: null });
    sample(m, { id: "p1", status: "passed", potency: 20 });
    sample(m, { id: "f1", status: "failed", reason: "Total Yeast & Mold", potency: 18 });
    sample(m, { id: "f2", status: "failed", reason: "Coliforms" });
    sample(m, { id: "open", status: "in_testing" });
    // Retests: a stored "Retest (...)" row with a plain passed, and a retest_failed naming yeast.
    sample(m, { id: "rt", status: "passed", test: "Retest (Total Yeast & Mold)", potency: 22 });
    sample(m, { id: "rf", status: "retest_failed", reason: "Total Yeast & Mold" });
    // Out: R&D, voided, another year's lot token, another strain off the lot's HBN.
    sample(m, { id: "rnd", status: "failed", reason: "Total Yeast & Mold", program: "rnd", potency: 99 });
    sample(m, { id: "void", status: "failed", reason: "Total Yeast & Mold", voided: T, potency: 99 });
    sample(m, { id: "y25", status: "failed", reason: "Total Yeast & Mold", hbn: LOT_25, potency: 99 });
    sample(m, { id: "else", status: "failed", reason: "Total Yeast & Mold", strain: "Other Strain", hbn: "46223-PNN-GH-016-0-NA-26002", potency: 99 });
    const page = await loadPuzzlePage(m.db, "2026", "All");
    expect(page.rows).toHaveLength(1);
    const row = page.rows[0];
    // # Tests: first tests (attempt 1) only, the open one included as V21 counts it; the two retests are out.
    expect(row.tests).toBe(4);
    // TYM Fails: failed (failed or retest_failed) naming yeast, any attempt, as V21 counts it.
    expect(row.tymFails).toBe(2);
    expect(row.tymPct).toBe(0.5);
    // Average THC: every potency of the strain's tests, the retest's included.
    expect(row.thc).toBe(20);
  });
});

describe("BRIEF V25 law 4: Labels read the station", () => {
  const TAG_A = "1A4050300061761000005001";
  const TAG_B = "1A4050300061761000005002";

  it("lists a station sample with its tag, item, net weight, packaged date, license and facility; R&D and voided out", async () => {
    const m = await migratedDb();
    sample(m, { id: "lbl-a", status: "passed", source: TAG_A, item: "Label Bud", net: 114, entered: "2026-08-20", facility: "SC Labs", sampleTag: "1A4050300061761000006001" });
    sample(m, { id: "lbl-b", status: "scheduled", source: TAG_B, item: null, strain: "Label Strain", net: null, entered: null, sampleTag: null, scheduledAt: "2026-09-05T14:00:00.000Z" });
    sample(m, { id: "lbl-rnd", status: "passed", source: "1A4050300061761000005003", program: "rnd" });
    sample(m, { id: "lbl-void", status: "passed", source: "1A4050300061761000005004", voided: T });
    const pkgs = await listLabelPackages(m.db);
    const a = pkgs.find((p) => p.id === "lbl-a");
    expect(a).toMatchObject({ tag: TAG_A, item_or_strain: "Label Bud", net_weight_grams: 114, packaged_date: "2026-08-20", license_number: "AU-P-000694", facility_name: "SC Labs" });
    const b = pkgs.find((p) => p.id === "lbl-b");
    expect(b).toMatchObject({ tag: TAG_B, item_or_strain: "Label Strain", net_weight_grams: null, packaged_date: "2026-09-05T14:00:00.000Z" });
    expect(pkgs.some((p) => p.id === "lbl-rnd" || p.id === "lbl-void")).toBe(false);
  });

  it("takes the newest passed potency; a newer failed sample, R&D and voided rows are never taken", async () => {
    const m = await migratedDb();
    sample(m, { id: "old-pass", status: "passed", source: TAG_A, potency: 21.5, finished: "2026-09-01", sampleTag: "1A4050300061761000006011" });
    sample(m, { id: "new-pass", status: "retest_passed", source: TAG_A, potency: 23.25, finished: "2026-09-10", sampleTag: "1A4050300061761000006012" });
    sample(m, { id: "newer-fail", status: "failed", reason: "Coliforms", source: TAG_A, potency: 30, finished: "2026-09-20" });
    sample(m, { id: "rnd-pass", status: "passed", source: TAG_A, potency: 40, finished: "2026-09-30", program: "rnd" });
    sample(m, { id: "void-pass", status: "passed", source: TAG_A, potency: 50, finished: "2026-09-30", voided: T });
    sample(m, { id: "unfinished", status: "passed", source: TAG_A, potency: 60, finished: null, changedAt: "2026-10-03T00:00:00.000Z" });
    expect(await latestFinalizedPotency(m.db, TAG_A)).toBe("23.25");
    // The sample tag finds its own sample.
    expect(await latestFinalizedPotency(m.db, "1A4050300061761000006011")).toBe("21.5");
    // A tie on the finish date falls to changed_at.
    sample(m, { id: "tie-1", status: "passed", source: TAG_B, potency: 19, finished: "2026-09-15", changedAt: "2026-09-16T00:00:00.000Z" });
    sample(m, { id: "tie-2", status: "passed", source: TAG_B, potency: 24, finished: "2026-09-15", changedAt: "2026-09-17T00:00:00.000Z" });
    expect(await latestFinalizedPotency(m.db, TAG_B)).toBe("24");
    // None passed, blank.
    sample(m, { id: "only-fail", status: "failed", reason: "Coliforms", source: "1A4050300061761000005009", potency: 25, finished: "2026-09-15" });
    expect(await latestFinalizedPotency(m.db, "1A4050300061761000005009")).toBe("");
    expect(await latestFinalizedPotency(m.db, "1A4050300061761000005999")).toBe("");
    // A newer passed sample with no potency (a retest of the failed analyte only) is skipped: the older passed figure stands.
    sample(m, { id: "np-old", status: "passed", source: "1A4050300061761000005010", potency: 21, finished: "2026-09-01" });
    sample(m, { id: "np-new", status: "retest_passed", source: "1A4050300061761000005010", potency: null, finished: "2026-09-10" });
    expect(await latestFinalizedPotency(m.db, "1A4050300061761000005010")).toBe("21");
    // Only passed samples with no potency: blank.
    sample(m, { id: "np-only", status: "passed", source: "1A4050300061761000005011", potency: null, finished: "2026-09-10" });
    expect(await latestFinalizedPotency(m.db, "1A4050300061761000005011")).toBe("");
  });
});
