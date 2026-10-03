import { describe, expect, it } from "vitest";
import { overrideTesting } from "../src/actions";
import { HttpError } from "../src/audit";
import { loadComplianceKpis } from "../src/biz";
import { ftqRate } from "../src/compliance";
import { loadTestingSection, sheetInSeason } from "../src/console";
import { testingOverridePage } from "../src/pages";
import { formOf, migratedDb } from "./migrated";

const T = "2026-10-02T16:00:00.000Z";
const HBN = "46223-ARL-GH-015-0-NA-26001";

describe("THE TESTING OVERRIDE (canon 0.30.341)", () => {
  it("renders the drop pane, the links, and never before a run", () => {
    const empty = testingOverridePage({ last: null });
    expect(empty).toContain("Last run: never");
    expect(empty).toContain('action="/admin/testing-override"');
    expect(empty).toContain('accept=".xlsb"');
    expect(empty).toContain("dragover");
    expect(empty).toContain('href="/harvest#testing"');
    expect(empty).toContain('href="/compliance"');
    expect(empty).toContain("Override testing from this sheet");
    const ran = testingOverridePage({
      last: { time: "2026-10-02 12:00 PM ET", trigger: "override", seen: 2, landed: 2, changed: 0, skipped: 1 },
      flash: "In testing sheet: 2 seen, 2 landed, 0 changed, 1 skipped.",
      skips: "no lab",
    });
    expect(ran).toContain("data-testing-override-flash");
    expect(ran).toContain("Skipped: no lab");
    expect(ran).toContain("2026-10-02 12:00 PM ET, override, 2 seen, 2 landed, 0 changed, 1 skipped.");
    expect(testingOverridePage({ last: null, locale: "es" })).toContain("Ultima corrida: nunca");
    expect(empty).toContain("The consoles read the lab station.");
    expect(testingOverridePage({ last: null, locale: "es" })).toContain("Las consolas leen la estacion de laboratorio.");
  });

  it("refuses a file that is not an .xlsb", async () => {
    const m = await migratedDb();
    const form = formOf({});
    form.set("file", new File(["a,b"], "notes.csv", { type: "text/csv" }));
    const err = await overrideTesting(m.db, form).catch((e) => e);
    expect(err).toBeInstanceOf(HttpError);
    expect((err as HttpError).message).toBe("Drop the In Testing workbook, an .xlsb file.");
  });

  it("counts the sheet's word list and leaves open rows out of FTQ", () => {
    expect(
      ftqRate([
        { sample_tag: "A", attempt: 1, status: "Passed - Retest" },
        { sample_tag: "B", attempt: 1, status: "fail" },
        { sample_tag: "C", attempt: 1, status: "In Progress" },
        { sample_tag: "D", attempt: 2, status: "Passed" },
      ])
    ).toEqual({ n: 2, passed: 1, rate: 50 });
    expect(sheetInSeason({ hbn: HBN, entered_testing: "2026-08-10" }, 2026)).toBe(true);
    expect(sheetInSeason({ hbn: "46223-ARL-GH-015-0-NA-25001", entered_testing: "2026-08-10" }, 2026)).toBe(false);
    expect(sheetInSeason({ hbn: "26only", entered_testing: "2025-01-01" }, 2026)).toBe(true);
    expect(sheetInSeason({ hbn: "no-digits", entered_testing: "2026-04-01" }, 2026)).toBe(true);
    expect(sheetInSeason({ hbn: "no-digits", entered_testing: null }, 2026)).toBe(false);
  });

  // THE LAB STATION (canon 0.30.362): V19's off-sheet row is now a voided sample,
  // its R&D rows are program 'rnd'. Same numbers as V19.
  it("reads compliance samples: voided and R&D rows leave every figure, an open first test stays out of the denominator", async () => {
    const m = await migratedDb();
    const row = (
      id: string,
      sample: string,
      status: string,
      mode: string | null,
      program: string,
      voided: string | null,
      batch: number | null
    ) => {
      m.run(
        `INSERT INTO lab_compliance_samples (
          id, program, license, market, source_metrc_tag, harvest_batch, sample_tag, required_test,
          entered_testing_on, status, fail_reason, batch_weight_g, notes, scheduled_at,
          created_at, updated_at, changed_at, voided_at
        ) VALUES (?, ?, 'AU-P-000694', 'AU', ?, ?, ?, 'Full Compliance', '2026-08-10', ?, ?, ?, '', ?, ?, ?, ?, ?)`,
        id,
        program,
        `1A405030000000000000${sample}`,
        HBN,
        sample,
        status,
        mode,
        batch,
        T,
        T,
        T,
        T,
        voided
      );
    };
    row("m1", "M1", "failed", "Coliforms", "compliance", null, null);
    row("s1", "S1", "passed", null, "compliance", null, null);
    row("s0", "S0", "failed", "Yeast", "compliance", T, 4480);
    row("s0b", "S0B", "in_testing", null, "compliance", T, 4480);
    row("rndopen", "RO", "in_testing", null, "rnd", null, 896);
    row("s2", "S2", "failed", "Pesticides", "rnd", null, null);
    row("s3", "S3", "failed", "Metals", "rnd", null, null);
    row("open", "OPEN", "in_testing", null, "compliance", null, 448);
    row("s4", "S4", "failed", "Heavy Metals", "compliance", null, null);
    row("live", "LIVE", "failed", "Coliforms", "compliance", null, null);
    const kpis = await loadComplianceKpis(m.db);
    expect(kpis.ftq).toEqual({ n: 4, passed: 1, rate: 25 });
    expect(kpis.pareto.map((bar) => bar.mode).sort()).toEqual(["Coliforms", "Heavy Metals"]);
    // Only the live compliance in_testing sample (448 g): the voided 4,480 g and the R&D 896 g are out.
    expect(kpis.lbs.grams).toBe(448);
    const figures = await loadTestingSection(m.db, 2026);
    expect(figures.tests).toBe(4);
    expect(figures.fails).toBe(3);
    expect(figures.ftq).toBe("25.0");
    expect(figures.slices.map((slice) => slice.mode).sort()).toEqual(["Coliforms", "Heavy Metals"]);
  });
});
