import { describe, expect, it } from "vitest";
import { formatGrams } from "../src/config";
import { formatLbs } from "../src/compliance";
import { productMixView, reportCsv, reportPdfHtml, reportXlsx } from "../src/reports";

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
