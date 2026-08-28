import { describe, expect, it } from "vitest";
import { assertHbnAvailable, dayOfYearUtc, HbnCollisionError, mintHbn, yyddd } from "../src/mint";

describe("YYDDD Julian mint", () => {
  it("maps 2026-09-01 to 26244", () => {
    expect(yyddd("2026-09-01")).toBe("26244");
    expect(dayOfYearUtc("2026-09-01")).toBe(244);
  });

  it("maps January 1", () => {
    expect(yyddd("2026-01-01")).toBe("26001");
    expect(dayOfYearUtc("2026-01-01")).toBe(1);
  });

  it("maps December 31 in a non-leap year", () => {
    expect(yyddd("2026-12-31")).toBe("26365");
    expect(dayOfYearUtc("2026-12-31")).toBe(365);
  });

  it("maps leap year January 1, February 29, and December 31", () => {
    expect(yyddd("2024-01-01")).toBe("24001");
    expect(yyddd("2024-02-29")).toBe("24060");
    expect(dayOfYearUtc("2024-02-29")).toBe(60);
    expect(yyddd("2024-12-31")).toBe("24366");
    expect(dayOfYearUtc("2024-12-31")).toBe(366);
  });

  it("rejects a non-leap February 29", () => {
    expect(() => yyddd("2026-02-29")).toThrow(/Invalid calendar date/);
  });

  it("mints the owner example", () => {
    expect(
      mintHbn({
        entryDate: "2026-09-01",
        farmCode: "ARL",
        growHbnCode: "GH",
        strainHbnCode: "027",
        manicure: 0,
        siloNumber: null,
      })
    ).toBe("26244-ARL-GH-027-0-NA-26");
  });

  it("uses the silo number when present", () => {
    expect(
      mintHbn({
        entryDate: "2026-09-01",
        farmCode: "PNN",
        growHbnCode: "ID",
        strainHbnCode: "7",
        manicure: 1,
        siloNumber: "3",
      })
    ).toBe("26244-PNN-ID-007-1-3-26");
  });
});

describe("HBN uniqueness", () => {
  it("rejects a collision and does not invent a suffix", () => {
    const hbn = "26244-ARL-GH-027-0-NA-26";
    expect(() => assertHbnAvailable({ id: "already" }, hbn)).toThrow(HbnCollisionError);
    expect(() => assertHbnAvailable({ id: "already" }, hbn)).toThrow(/already exists/);
    expect(() => assertHbnAvailable({ id: "already" }, hbn)).toThrow(/not changed/);
    expect(() => assertHbnAvailable(null, hbn)).not.toThrow();
  });
});
