import { describe, expect, it } from "vitest";
import {
  assertHbnAvailable,
  dayOfYearUtc,
  formatLotToken,
  formatSiloSegment,
  HbnCollisionError,
  harvestYearFromEntryDate,
  hbnFromMetrcName,
  maxSerialForYear,
  mintHbn,
  nextLotSerial,
  tryClaimSerial,
  yyddd,
  type SerialClaim,
} from "../src/mint";
import { lotSerialFloor } from "../src/config";
import { adoptFromMetrc } from "../src/actions";
import { formOf, migratedDb, seedBatch, seedMirror, seedPerson } from "./migrated";

describe("THE HBN INHERITED (canon 0.30.196): reading METRC's harvest name", () => {
  it("reads the seven segments, the year and serial from the seventh, and the day from the first", () => {
    const read = hbnFromMetrcName("26260-pnn-gh-001-1-02-26011 ", null, "2026-09-23");
    expect(read).toEqual({
      ok: true,
      mint: {
        hbn: "26260-PNN-GH-001-1-02-26011",
        farm_code: "PNN",
        grow_code: "GH",
        strain_code: "001",
        manicure: 1,
        planned_dryspc: "2",
        harvest_year: 2026,
        lot_serial: 11,
        entry_date: "2026-09-17",
      },
    });
  });

  it("falls to the packaged date when the first segment is not a day of that year, then to the farm day", () => {
    const early = hbnFromMetrcName("46258-PNN-ID-062-0-NA-26007", "2026-09-15", "2026-09-23");
    expect(early.ok && early.mint).toMatchObject({ harvest_year: 2026, lot_serial: 7, planned_dryspc: null, manicure: 0, entry_date: "2026-09-15" });
    const bare = hbnFromMetrcName("46258-PNN-ID-062-0-NA-26007", null, "2026-09-23");
    expect(bare.ok && bare.mint.entry_date).toBe("2026-09-23");
    const junkDate = hbnFromMetrcName("46258-PNN-ID-062-0-NA-26007", "9/15/2026", "2026-09-23");
    expect(junkDate.ok && junkDate.mint.entry_date).toBe("2026-09-23");
  });

  it("refuses a six-part name and a seventh segment that is not a lot token, naming the harvest", () => {
    expect(hbnFromMetrcName("46258-PNN-ID-062-0-26007", null, "2026-09-23")).toEqual({
      ok: false,
      refusal: { key: "{hbn} is not a seven-part HBN, so nothing was minted.", vars: { hbn: "46258-PNN-ID-062-0-26007" } },
    });
    const noToken = hbnFromMetrcName("46258-PNN-ID-062-0-NA-LOT7", null, "2026-09-23");
    expect(noToken.ok).toBe(false);
    expect(!noToken.ok && noToken.refusal.key).toBe("{hbn} does not end in a YY### lot token, so nothing was minted.");
    expect(hbnFromMetrcName("46258-PNN-ID-062-0-NA-26000", null, "2026-09-23").ok).toBe(false);
  });

  it("refuses a year and serial that already belong to another HBN, and mints nothing", async () => {
    const m = await migratedDb();
    const person = seedPerson(m);
    seedBatch(m, { id: "hb-app", hbn: "26250-ARL-GH-027-0-NA-26007", serial: 7 });
    seedMirror(m, { tag: "1A4050300000000000000F01", harvest: "46258-PNN-ID-062-0-NA-26007" });
    await expect(adoptFromMetrc(m.db, formOf({ tag: "1A4050300000000000000F01", person_id: person }))).rejects.toMatchObject({
      status: 409,
      message: "46258-PNN-ID-062-0-NA-26007 cannot be minted: lot 26007 already belongs to 26250-ARL-GH-027-0-NA-26007.",
    });
    expect(m.get(`SELECT COUNT(*) AS n FROM harvest_batches`)).toEqual({ n: 1 });
    expect(m.get(`SELECT COUNT(*) AS n FROM wip_packages`)).toEqual({ n: 0 });
    expect(m.get(`SELECT COUNT(*) AS n FROM strains WHERE name = 'Zebra Cake'`)).toEqual({ n: 0 });
  });
});

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

// Owner ruling 2026-09-14 (canon 0.30.55, verbatim): "Set things up so that the
// first number added today ends in 26010 (we're on the tenth lot this year, we
// just haven't inputted the historical data yet".
describe("the first lot token (the year's serial floor)", () => {
  it("lifts an empty ledger to the floor: the first 2026 mint is 26010", () => {
    const floor = lotSerialFloor("26010", 2026);
    expect(floor).toBe(10);
    expect(nextLotSerial(null, floor)).toBe(10);
    expect(formatLotToken(2026, nextLotSerial(null, floor))).toBe("26010");
    expect(
      mintHbn({
        entryDate: "2026-09-14",
        farmCode: "ARL",
        growHbnCode: "GH",
        strainHbnCode: "27",
        manicure: 0,
        siloNumber: null,
        lotSerial: nextLotSerial(null, floor),
      })
    ).toBe("26257-ARL-GH-027-0-NA-26010");
  });

  it("keeps counting past the floor once the ledger is above it", () => {
    const floor = lotSerialFloor("26010", 2026);
    expect(nextLotSerial(10, floor)).toBe(11);
    expect(nextLotSerial(41, floor)).toBe(42);
  });

  it("leaves the historical serials below the floor to the manual mint", () => {
    // 26001 to 26009 entered later through Admin's Manual HBN: the ledger's max
    // stays under the floor and the auto mint still answers the floor.
    const existing: SerialClaim[] = [
      { harvestYear: 2026, lotSerial: 1 },
      { harvestYear: 2026, lotSerial: 9 },
    ];
    expect(nextLotSerial(maxSerialForYear(existing, 2026), lotSerialFloor("26010", 2026))).toBe(10);
  });

  it("applies to its own year only", () => {
    expect(lotSerialFloor("26010", 2027)).toBeNull();
    expect(nextLotSerial(null, lotSerialFloor("26010", 2027))).toBe(1);
    expect(formatLotToken(2027, 1)).toBe("27001");
  });

  it("reads a blank, malformed or zero token as no floor", () => {
    expect(lotSerialFloor(null, 2026)).toBeNull();
    expect(lotSerialFloor("", 2026)).toBeNull();
    expect(lotSerialFloor("  ", 2026)).toBeNull();
    expect(lotSerialFloor("10", 2026)).toBeNull();
    expect(lotSerialFloor("26-010", 2026)).toBeNull();
    expect(lotSerialFloor("2026010", 2026)).toBeNull();
    expect(lotSerialFloor("26000", 2026)).toBeNull();
    expect(lotSerialFloor(" 26010 ", 2026)).toBe(10);
    expect(nextLotSerial(3, null)).toBe(4);
  });

  it("refuses a floor that is not a positive integer", () => {
    expect(() => nextLotSerial(null, 0)).toThrow(/floor/);
    expect(() => nextLotSerial(null, 2.5)).toThrow(/floor/);
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
