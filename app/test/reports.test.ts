import { describe, expect, it } from "vitest";
import { formatGrams } from "../src/config";
import { formatLbs } from "../src/compliance";
import { linePackagesView, productMixView, reportCsv, reportPdfHtml, reportXlsx } from "../src/reports";

const SHOT = [
  ["BIO", 314583],
  ["BUD", 8608166],
  ["SHAKE", 385740],
  ["SMALLS", 3765001],
  ["TRIM", 21664700],
  ["WPR", 2463984],
].map(([code, grams]) => ({ package_type_code: String(code), display_name: String(code), total_grams: Number(grams) }));

describe("PRODUCT MIX TOTALS AND POUNDS (canon 0.30.307)", () => {
  it("carries Lbs between Grams and Percent, and a Total row from the year's grams", () => {
    const view = productMixView(SHOT, 2026);
    expect(view.columns.map((c) => c.label)).toEqual(["Package type", "Grams", "Lbs", "Percent"]);
    expect(view.columns.find((c) => c.key === "lbs")?.lbs).toBe(true);
    const bud = view.rows.find((row) => row.package_type === "BUD");
    const trim = view.rows.find((row) => row.package_type === "TRIM");
    expect(formatLbs(Number(bud?.lbs))).toBe("19,214.66");
    expect(formatLbs(Number(trim?.lbs))).toBe("48,358.71");
    expect(bud?.percent).toBe("23.14");
    expect(trim?.percent).toBe("58.24");
    const total = view.rows[view.rows.length - 1];
    expect(total).toMatchObject({ package_type: "Total", percent: "100.00", _total: 1 });
    expect(formatGrams(total.grams)).toBe("37,202,174");
    expect(formatLbs(Number(total.lbs))).toBe("83,040.57");
    expect(view.footnote).toBe("Year 2026.");
  });

  it("puts the Total on the last CSV line, as numbers in the XLSX, and as a ruled row in the PDF", () => {
    const view = productMixView(SHOT, 2026);
    const lines = reportCsv(view).replace(/\r\n$/, "").split("\r\n");
    expect(lines[0]).toBe("Package type,Grams,Lbs,Percent");
    expect(lines[lines.length - 1]).toBe('Total,"37,202,174","83,040.57",100.00');
    const sheet = new TextDecoder("latin1").decode(reportXlsx(view));
    expect(sheet).toContain('t="n" s="3"');
    expect(sheet).toContain(">19214.66<");
    expect(sheet).toContain(">48358.71<");
    expect(sheet).toContain(">83040.57<");
    const pdf = reportPdfHtml(view, "Year 2026.", "Gripfactory Lite", "2026-09-29");
    expect(pdf).toContain('class="report-total"');
    expect(pdf).toContain("83,040.57");
    expect(pdf).toContain("font-weight: 700");
  });

  it("draws no Total row for an empty year", () => {
    const view = productMixView([], 2026);
    expect(view.rows).toEqual([]);
    expect(reportCsv(view)).toBe("Package type,Grams,Lbs,Percent\r\n");
    expect(reportPdfHtml(view, "", "Gripfactory Lite", "2026-09-29")).not.toContain('class="report-total"');
  });
});

describe("THE LINE PACKAGES REPORT (canon 0.30.344)", () => {
  const budCodes = ["BUD", "SMALLS", "SHAKE"];
  const row = (over: Partial<{ line: string; enteredIso: string; lot: string; tag: string; type: string; grams: number; effective: string; operator: string }>) => ({
    line: "Trim",
    enteredIso: "2026-10-02T15:00:00.000Z",
    lot: "26002",
    tag: "T1",
    type: "BUD",
    grams: 448,
    effective: "2026-10-01",
    operator: "Tester",
    ...over,
  });

  it("sorts the four lines, totals Trim by the console's bud law, and hides nothing from the CSV", () => {
    const view = linePackagesView(
      [
        row({ line: "Rad", tag: "R1", type: "WPR, 1500 Gy", grams: 100, enteredIso: "2026-10-02T16:00:00.000Z" }),
        row({ line: "Cryo", tag: "C1", type: "BUD", grams: 200, enteredIso: "2026-10-02T15:30:00.000Z" }),
        row({ line: "Prepack", tag: "P1", type: "28 g x 2", grams: 56, enteredIso: "2026-10-02T15:10:00.000Z" }),
        row({ line: "Trim", tag: "BUD-1", type: "BUD", grams: 332518 }),
        row({ line: "Trim", tag: "SHAKE-1", type: "SHAKE", grams: 16666, enteredIso: "2026-10-02T15:01:00.000Z" }),
        row({ line: "Trim", tag: "SMALLS-1", type: "SMALLS", grams: 225294, enteredIso: "2026-10-02T15:02:00.000Z" }),
        row({ line: "Trim", tag: "TRIM-1", type: "TRIM", grams: 930950, enteredIso: "2026-10-02T15:03:00.000Z" }),
      ],
      { budCodes, startWarned: false, startUsed: "06:00" }
    );
    const data = view.rows.filter((item) => item._total !== "1");
    expect(data.map((item) => item.line)).toEqual(["Trim", "Trim", "Trim", "Trim", "Prepack", "Cryo", "Rad"]);
    expect(data.map((item) => item.tag)).toEqual(["BUD-1", "SHAKE-1", "SMALLS-1", "TRIM-1", "P1", "C1", "R1"]);
    expect(view.groupBy).toBe("line");
    expect(view.columns.map((c) => c.label)).toEqual(["Line", "Entered", "Lot", "Package tag", "Type", "Weight (g)", "Weight (lb)", "Effective date", "Operator"]);
    expect(view.columns.find((c) => c.key === "lbs")?.lbs).toBe(true);
    const trimGrams = 332518 + 16666 + 225294 + 930950;
    const budGrams = 332518 + 16666 + 225294;
    expect(view.footnote).toContain(`Trim: 4 packages, ${formatGrams(trimGrams)} g (${formatLbs(trimGrams)} lb)`);
    expect(view.footnote).toContain(`bud ${((budGrams / trimGrams) * 100).toFixed(1)}% by the console's law`);
    expect(view.rows.filter((item) => item._total === "1").map((item) => item.line)).toEqual(["Trim", "Prepack", "Cryo", "Rad"]);
    const csv = reportCsv(view);
    expect(csv).toContain("Trim: 4 packages");
    const pdf = reportPdfHtml(view, view.footnote ?? "", "Gripfactory Lite", "2026-10-02");
    expect(pdf).toContain('class="report-total"');
    const one = linePackagesView([row({ grams: 448 })], { budCodes, startWarned: false, startUsed: "06:00" });
    expect(one.footnote).toContain("1.00 lb");
    expect(reportPdfHtml(one, one.footnote ?? "", "Gripfactory Lite", "2026-10-02")).toContain("1.00");
    const empty = linePackagesView([], { budCodes, startWarned: true, startUsed: "06:00" });
    expect(empty.rows).toEqual([]);
    expect(empty.empty).toBe("No packages on this line in this window.");
    expect(empty.footnote).toContain("Date start was not HH:MM, so the report used 06:00.");
  });
});
