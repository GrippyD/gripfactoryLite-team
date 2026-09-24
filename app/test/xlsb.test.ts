import { describe, expect, it } from "vitest";
import { decodeRk, encodeRk, excelSerialToIso, readXlsbSheets, writeXlsb } from "../src/xlsb";

describe("the xlsb reader", () => {
  it("decodes RK flags and a 1900 date serial", () => {
    expect(decodeRk(encodeRk(14, { asInt: true }))).toBe(14);
    expect(decodeRk(encodeRk(1.5, { div100: true, asInt: true }))).toBe(1.5);
    expect(decodeRk(encodeRk(1.5, { asInt: false }))).toBeCloseTo(1.5, 5);
    const serial = (Date.UTC(2026, 0, 1) - Date.UTC(1899, 11, 30)) / 86_400_000;
    expect(excelSerialToIso(serial)).toBe("2026-01-01");
  });

  it("reads every cell kind, shared strings, and formula caches", async () => {
    const bytes = writeXlsb([
      {
        name: "In Testing",
        rows: [
          ["License Number", "Sample Tag", "Batch", "Flag", "Note", "Cached", "Words", "Blank", "Bad"],
          ["AU-G-C-000832", "1A4F00000000000000000C11", 4480, true, "inline", 12.5, "cached words", null, "err"],
        ],
        kinds: [
          ["shared", "shared", "shared", "shared", "shared", "shared", "shared", "shared", "shared"],
          ["shared", "inline", "rk", "bool", "inline", "fmlaNum", "fmlaString", "blank", "error"],
        ],
      },
      {
        name: "R&D",
        rows: [["Sample Tag"], ["1A4F00000000000000000D11"]],
      },
    ]);
    const sheets = await readXlsbSheets(bytes);
    expect([...sheets.keys()]).toEqual(["In Testing", "R&D"]);
    const row = sheets.get("In Testing")?.find((line) => line.row === 1)?.cells ?? [];
    expect(row[0]).toBe("AU-G-C-000832");
    expect(row[1]).toBe("1A4F00000000000000000C11");
    expect(row[2]).toBe(4480);
    expect(row[3]).toBe(true);
    expect(row[4]).toBe("inline");
    expect(row[5]).toBeCloseTo(12.5, 5);
    expect(row[6]).toBe("cached words");
    expect(row[7]).toBeNull();
    expect(row[8]).toBeNull();
    expect(sheets.get("R&D")?.find((line) => line.row === 1)?.cells[0]).toBe("1A4F00000000000000000D11");
  });
});
