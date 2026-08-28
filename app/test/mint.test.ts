import { describe, expect, it } from "vitest";
import {
  assertHbnAvailable,
  dayOfYearUtc,
  formatLotToken,
  formatSiloSegment,
  HbnCollisionError,
  harvestYearFromEntryDate,
  maxSerialForYear,
  mintHbn,
  nextLotSerial,
  tryClaimSerial,
  yyddd,
  type SerialClaim,
} from "../src/mint";

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
});

describe("lot serial allocation", () => {
  it("increments within a year", () => {
    expect(nextLotSerial(null)).toBe(1);
    expect(nextLotSerial(1)).toBe(2);
    expect(nextLotSerial(41)).toBe(42);
    const existing: SerialClaim[] = [
      { harvestYear: 2026, lotSerial: 1 },
      { harvestYear: 2026, lotSerial: 2 },
    ];
    expect(nextLotSerial(maxSerialForYear(existing, 2026))).toBe(3);
    expect(formatLotToken(2026, 3)).toBe("26003");
  });

  it("starts a new sequence at 001 on year rollover", () => {
    const existing: SerialClaim[] = [{ harvestYear: 2026, lotSerial: 87 }];
    expect(maxSerialForYear(existing, 2027)).toBeNull();
    expect(nextLotSerial(maxSerialForYear(existing, 2027))).toBe(1);
    expect(formatLotToken(2027, 1)).toBe("27001");
    expect(harvestYearFromEntryDate("2027-01-01")).toBe(2027);
  });

  it("does not reuse a serial that remains claimed (void does not free)", () => {
    const existing: SerialClaim[] = [{ harvestYear: 2026, lotSerial: 1 }];
    expect(nextLotSerial(maxSerialForYear(existing, 2026))).toBe(2);
  });
});

describe("silo segment", () => {
  it("zero-pads numeric silo numbers to two digits", () => {
    expect(formatSiloSegment("5")).toBe("05");
    expect(formatSiloSegment("05")).toBe("05");
    expect(formatSiloSegment("12")).toBe("12");
  });

  it("uses NA when blank", () => {
    expect(formatSiloSegment(null)).toBe("NA");
    expect(formatSiloSegment("")).toBe("NA");
    expect(formatSiloSegment("  ")).toBe("NA");
  });

  it("passes non-numeric text through", () => {
    expect(formatSiloSegment("NA")).toBe("NA");
    expect(formatSiloSegment("West")).toBe("West");
  });
});

describe("full mint string", () => {
  it("mints the owner example with silo 5 and serial 1", () => {
    expect(
      mintHbn({
        entryDate: "2026-09-01",
        farmCode: "ARL",
        growHbnCode: "GH",
        strainHbnCode: "027",
        manicure: 0,
        siloNumber: "5",
        lotSerial: 1,
      })
    ).toBe("26244-ARL-GH-027-0-05-26001");
  });

  it("mints NA silo with serial 1", () => {
    expect(
      mintHbn({
        entryDate: "2026-09-01",
        farmCode: "ARL",
        growHbnCode: "GH",
        strainHbnCode: "027",
        manicure: 0,
        siloNumber: null,
        lotSerial: 1,
      })
    ).toBe("26244-ARL-GH-027-0-NA-26001");
  });
});

describe("concurrent-ish serial claims", () => {
  it("rejects a second claim of the same year and serial", () => {
    const store: SerialClaim[] = [];
    const seenMax = maxSerialForYear(store, 2026);
    const first = nextLotSerial(seenMax);
    const second = nextLotSerial(seenMax);
    expect(first).toBe(1);
    expect(second).toBe(1);
    expect(tryClaimSerial(store, 2026, first)).toBe(true);
    expect(tryClaimSerial(store, 2026, second)).toBe(false);
    const retry = nextLotSerial(maxSerialForYear(store, 2026));
    expect(retry).toBe(2);
    expect(tryClaimSerial(store, 2026, retry)).toBe(true);
  });
});

describe("HBN uniqueness", () => {
  it("rejects a collision and does not invent a suffix", () => {
    const hbn = "26244-ARL-GH-027-0-NA-26001";
    expect(() => assertHbnAvailable({ id: "already" }, hbn)).toThrow(HbnCollisionError);
    expect(() => assertHbnAvailable({ id: "already" }, hbn)).toThrow(/already exists/);
    expect(() => assertHbnAvailable({ id: "already" }, hbn)).toThrow(/not changed/);
    expect(() => assertHbnAvailable(null, hbn)).not.toThrow();
  });
});
