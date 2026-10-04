import { describe, expect, it } from "vitest";
import { formatGrams } from "../src/config";
import { formatLbs } from "../src/compliance";
import { dayAfter, etInstant, etWallClock } from "../src/farmday";
import { t } from "../src/i18n";
import {
  LINE_PACKAGES_NOT_A_DATE,
  LINE_PACKAGES_SWAPPED,
  LINE_PACKAGES_TOO_LONG,
  linePackagesView,
  productMixView,
  reportCsv,
  reportPdfHtml,
  reportXlsx,
  resolveLinePackageRange,
} from "../src/reports";

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

describe("LINE PACKAGES, A DATE RANGE (canon 0.30.398)", () => {
  const base = { today: "2026-10-04", fallbackStart: "06:00", date: null as string | null };

  it("treats From equal to To as the one day window today's code used", () => {
    const date = "2026-10-02";
    const start = "06:00";
    const range = resolveLinePackageRange({ ...base, from: date, to: date, start });
    expect(range.ok).toBe(true);
    if (!range.ok) return;
    expect(range.swapped).toBe(false);
    expect(range.startIso).toBe(etInstant(date, start));
    expect(range.endIso).toBe(etInstant(dayAfter(date), start));
    expect(etWallClock(range.startIso)).toBe(`${date} ${start}`);
    expect(etWallClock(range.endIso)).toBe(`${dayAfter(date)} ${start}`);
  });

  it("runs a three day range from From's start to the day after To", () => {
    const start = "07:30";
    const range = resolveLinePackageRange({ ...base, from: "2026-10-01", to: "2026-10-03", start });
    expect(range.ok).toBe(true);
    if (!range.ok) return;
    expect(range.startIso).toBe(etInstant("2026-10-01", start));
    expect(range.endIso).toBe(etInstant("2026-10-04", start));
  });

  it("keeps both ends on the wall clock when 2026-11-01 falls inside the range", () => {
    const start = "06:00";
    const range = resolveLinePackageRange({ ...base, from: "2026-10-31", to: "2026-11-01", start });
    expect(range.ok).toBe(true);
    if (!range.ok) return;
    expect(range.startIso).toBe(etInstant("2026-10-31", start));
    expect(range.endIso).toBe(etInstant("2026-11-02", start));
    expect(etWallClock(range.startIso)).toBe("2026-10-31 06:00");
    expect(etWallClock(range.endIso)).toBe("2026-11-02 06:00");
    expect(range.startIso.slice(11, 13)).not.toBe(range.endIso.slice(11, 13));
  });

  it("reads a bare date as From = To", () => {
    const range = resolveLinePackageRange({ ...base, from: null, to: null, date: "2026-08-15", start: "06:00", today: "2026-12-01" });
    expect(range.ok).toBe(true);
    if (!range.ok) return;
    expect(range.from).toBe("2026-08-15");
    expect(range.to).toBe("2026-08-15");
    expect(range.startIso).toBe(etInstant("2026-08-15", "06:00"));
    expect(range.endIso).toBe(etInstant("2026-08-16", "06:00"));
  });

  it("swaps To before From and says so", () => {
    const range = resolveLinePackageRange({ ...base, from: "2026-10-05", to: "2026-10-01", start: "06:00" });
    expect(range.ok).toBe(true);
    if (!range.ok) return;
    expect(range.swapped).toBe(true);
    expect(range.from).toBe("2026-10-01");
    expect(range.to).toBe("2026-10-05");
    expect(range.startIso).toBe(etInstant("2026-10-01", "06:00"));
    expect(range.endIso).toBe(etInstant("2026-10-06", "06:00"));
    const view = linePackagesView([], {
      budCodes: [],
      startWarned: false,
      startUsed: "06:00",
      swapped: true,
      windowStartIso: range.startIso,
      windowEndIso: range.endIso,
    });
    expect(view.footnote).toContain(LINE_PACKAGES_SWAPPED);
    expect(view.heading).toBe("2026-10-01 06:00 to 2026-10-06 06:00, Eastern");
  });

  it("refuses 93 days and allows 92", () => {
    let to = "2026-10-01";
    for (let i = 0; i < 91; i++) to = dayAfter(to);
    const allowed = resolveLinePackageRange({ ...base, from: "2026-10-01", to, start: "06:00" });
    expect(allowed.ok).toBe(true);
    const refused = resolveLinePackageRange({ ...base, from: "2026-10-01", to: dayAfter(to), start: "06:00" });
    expect(refused).toEqual({ ok: false, message: LINE_PACKAGES_TOO_LONG });
  });

  it("refuses a value that is not a date", () => {
    expect(resolveLinePackageRange({ ...base, from: "2026-02-31", to: "2026-02-31", start: "06:00" })).toEqual({
      ok: false,
      message: LINE_PACKAGES_NOT_A_DATE,
    });
    expect(resolveLinePackageRange({ ...base, from: null, to: null, date: "nope", start: "06:00" })).toEqual({
      ok: false,
      message: LINE_PACKAGES_NOT_A_DATE,
    });
  });

  it("carries the window line on the page heading, the CSV, the XLSX and the PDF, with the range totals", () => {
    const range = resolveLinePackageRange({ ...base, from: "2026-10-01", to: "2026-10-03", start: "06:00" });
    expect(range.ok).toBe(true);
    if (!range.ok) return;
    const view = linePackagesView(
      [
        {
          line: "Trim",
          enteredIso: "2026-10-02T15:00:00.000Z",
          lot: "26002",
          tag: "T1",
          type: "BUD",
          grams: 448,
          effective: "2026-10-01",
          operator: "Tester",
        },
      ],
      { budCodes: ["BUD"], startWarned: false, startUsed: "06:00", windowStartIso: range.startIso, windowEndIso: range.endIso }
    );
    expect(view.heading).toBe("2026-10-01 06:00 to 2026-10-04 06:00, Eastern");
    expect(view.footnote).toContain("Trim: 1 packages");
    expect(view.rows.find((row) => row.tag === "T1")?.entered).toBe(etWallClock("2026-10-02T15:00:00.000Z"));
    const csv = reportCsv(view).split("\r\n");
    expect(csv[0]).toBe('"2026-10-01 06:00 to 2026-10-04 06:00, Eastern"');
    expect(csv.join("\r\n")).toContain("Trim: 1 packages");
    const sheet = new TextDecoder("latin1").decode(reportXlsx(view));
    expect(sheet).toContain("2026-10-01 06:00 to 2026-10-04 06:00, Eastern");
    expect(sheet).toContain("Trim: 1 packages");
    const pdf = reportPdfHtml(view, view.footnote ?? "", "Gripfactory Lite", "2026-10-02");
    expect(pdf).toContain('class="report-window"');
    expect(pdf).toContain(view.heading);
    expect(pdf).toContain("Trim: 1 packages");
    const es = linePackagesView([], {
      budCodes: [],
      startWarned: false,
      startUsed: "06:00",
      locale: "es",
      windowStartIso: range.startIso,
      windowEndIso: etInstant("2026-10-02", "06:00"),
    });
    expect(es.heading).toBe("2026-10-01 06:00 a 2026-10-02 06:00, hora del Este");
    expect(t("es", "Pick 92 days or fewer.")).toBe("Elija 92 dias o menos.");
    expect(t("es", "That is not a date.")).toBe("Eso no es una fecha.");
    expect(t("es", LINE_PACKAGES_SWAPPED)).toBe("Hasta estaba antes de De, asi que el reporte los invirtio.");
    expect(t("es", "From the From date's start time to the day after To at the same time, Eastern. The default is Admin's farm day start hour.")).toContain(
      "dia siguiente a Hasta"
    );
  });
});
