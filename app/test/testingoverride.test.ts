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

  it("keeps manual rows in the picture and leaves off-sheet and R&D rows out", async () => {
    const m = await migratedDb();
    const row = (
      id: string,
      sample: string,
      status: string,
      mode: string | null,
      source: string,
      onSheet: number,
      sheetKey: string | null,
      finished: string | null,
      grams: number | null
    ) => {
      m.run(
        `INSERT INTO external_test_results (
          id, hbn, sample_tag, entered_testing, status, failure_mode, attempt, source, on_sheet, sheet_key,
          net_weight_grams, finished_testing, created_at, updated_at
        ) VALUES (?, ?, ?, '2026-08-10', ?, ?, 1, ?, ?, ?, ?, ?, ?, ?)`,
        id,
        HBN,
        sample,
        status,
        mode,
        source,
        onSheet,
        sheetKey,
        grams,
        finished,
        T,
        T
      );
    };
    row("m1", "M1", "Failed", "Coliforms", "manual", 0, null, "2026-08-12", null);
    row("s1", "S1", "Passed", null, "sheet", 1, "In Testing|S1|1", "2026-08-12", null);
    row("s0", "S0", "Failed", "Yeast", "sheet", 0, "In Testing|S0|1", null, 4480);
    row("s2", "S2", "Failed", "Pesticides", "sheet", 1, "R&D|S2|1", "2026-08-12", null);
    row("s3", "S3", "Failed", "Metals", "sheet", 1, "In Testing|S3|1", "2026-08-12", null);
    row("open", "OPEN", "In Progress", null, "manual", 0, null, null, null);
    row("s4", "S4", "fail", "Heavy Metals", "manual", 0, null, "2026-08-12", null);
    row("live", "LIVE", "Failed", "Coliforms", "sheet", 1, "In Testing|LIVE|1", null, 448);
    m.run(
      `INSERT INTO test_orders (
        id, lot_id, market, lab_id, panel, required_lab_test_batch, batch_grams, sample_grams, status,
        created_at, updated_at, source, sheet_key
      ) VALUES ('ord-rnd', 'lot-x', 'AU', 'sc-labs-michigan', 'rnd', 'batch', 1, 1, 'sent', ?, ?, 'sheet', 'In Testing|S3|1')`,
      T,
      T
    );
    const kpis = await loadComplianceKpis(m.db);
    expect(kpis.ftq).toEqual({ n: 4, passed: 1, rate: 25 });
    expect(kpis.pareto.map((bar) => bar.mode).sort()).toEqual(["Coliforms", "Heavy Metals"]);
    expect(kpis.lbs.grams).toBe(448);
    const figures = await loadTestingSection(m.db, 2026);
    expect(figures.tests).toBe(4);
    expect(figures.fails).toBe(3);
    expect(figures.ftq).toBe("25.0");
    expect(figures.slices.map((slice) => slice.mode).sort()).toEqual(["Coliforms", "Heavy Metals"]);
  });
});
