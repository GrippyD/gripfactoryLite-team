import { describe, expect, it } from "vitest";
import {
  allocateTagCounts,
  METRC_WET_WEIGHTS_HEADER,
  queueRowsToCsv,
  splitPlantWeights,
  wetWeightsCsv,
  wetWeightsCsvWithCounts,
  wetWeightsCsvWithTags,
  wetWeightsFilename,
  anyPlantCount,
  type WetWeightsCsvRow,
  parseCsv,
} from "../src/csv";
import { parsePlantTags } from "../src/actions";
import { parsePlantCount, HttpError } from "../src/audit";

describe("metrc wet weights csv (owner ruling 2026-08-31)", () => {
  const base: WetWeightsCsvRow = {
    weight_grams: 500,
    dry_space_name: "Silo 1",
    truck_number: null,
    hbn: "26244-ARL-GH-027-0-NA-26002",
    entry_updated_at: "2026-09-01T14:30:00.000Z",
  };

  it("carries the exact METRC header, no spaces", () => {
    expect(METRC_WET_WEIGHTS_HEADER).toBe(
      "Plant,Weight,UnitOfWeight,DryingLocation,DryingSublocation,HarvestName,PatientLicenseNumber,ActualDate"
    );
    expect(wetWeightsCsv([]).startsWith(METRC_WET_WEIGHTS_HEADER + "\r\n")).toBe(true);
    expect(wetWeightsCsv([base]).split("\r\n")[0]).toBe(METRC_WET_WEIGHTS_HEADER);
  });

  it("renders one row per scale read: Plant empty, 2-decimal grams, Grams, the dry space, empty sublocation and patient, the HBN as the harvest name, the finish date", () => {
    const csv = wetWeightsCsv([base]);
    expect(csv.split("\r\n")[1]).toBe(
      ",500.00,Grams,Silo 1,,26244-ARL-GH-027-0-NA-26002,,2026-09-01"
    );
    expect(csv.endsWith("\r\n")).toBe(true);
  });

  it("keeps a read's stored 2-decimal grams exact", () => {
    const csv = wetWeightsCsv([{ ...base, weight_grams: 1000.06 }]);
    expect(csv.split("\r\n")[1].split(",")[1]).toBe("1000.06");
  });

  it("labels a truck lot's reads Truck <n> from the record-borne number, never the bare sentinel", () => {
    const csv = wetWeightsCsv([
      { ...base, dry_space_name: "Truck", truck_number: "3", weight_grams: 250.5 },
    ]);
    expect(csv.split("\r\n")[1]).toBe(
      ",250.50,Grams,Truck 3,,26244-ARL-GH-027-0-NA-26002,,2026-09-01"
    );
  });

  it("addresses every row to the barn when the caller passes it (canon 0.30.1 spine step 3), without the site prefix METRC never knew (canon 0.30.82)", () => {
    // THE LOCATION WITHOUT THE FARM (owner, 2026-09-15): "CSVs shouldn't contain
    // the farm name in the locations." ARL BARN is our screens' name; METRC's is BARN.
    const csv = wetWeightsCsv([base], "ARL BARN");
    expect(csv.split("\r\n")[1]).toBe(
      ",500.00,Grams,BARN,,26244-ARL-GH-027-0-NA-26002,,2026-09-01"
    );
    const truck = wetWeightsCsv([{ ...base, dry_space_name: "Truck", truck_number: "3" }], "ARL BARN");
    expect(truck.split("\r\n")[1].split(",")[3]).toBe("BARN");
    const tagged = wetWeightsCsvWithTags([base], ["1A4000000000001"], 0, "seed", "PNS BARN");
    expect(tagged.split("\r\n")[1].split(",")[3]).toBe("BARN");
    // A silo or a room passes through untouched.
    expect(wetWeightsCsv([base], "Silo 3").split("\r\n")[1].split(",")[3]).toBe("Silo 3");
    expect(wetWeightsCsv([{ ...base, dry_space_name: "Arlington Dry Room" }]).split("\r\n")[1].split(",")[3]).toBe("Arlington Dry Room");
  });

  it("escapes commas and quotes in values like the queue exports", () => {
    const csv = wetWeightsCsv([{ ...base, dry_space_name: 'Silo "A", North', weight_grams: 1 }]);
    expect(csv.split("\r\n")[1]).toBe(
      ',1.00,Grams,"Silo ""A"", North",,26244-ARL-GH-027-0-NA-26002,,2026-09-01'
    );
  });

  it("takes ActualDate as the date part of the lot's updated_at (provisional finish date)", () => {
    const csv = wetWeightsCsv([{ ...base, entry_updated_at: "2026-12-31T23:59:59.999Z" }]);
    expect(csv.split("\r\n")[1].split(",")[7]).toBe("2026-12-31");
  });

  it("names the file after the full HBN (owner ruling 2026-08-31: [HBN number].csv)", () => {
    expect(wetWeightsFilename("26244-ARL-GH-027-0-NA-26002", 1)).toBe(
      "26244-ARL-GH-027-0-NA-26002(1).csv"
    );
  });

  it("keeps weights raw with no comma grouping, even over a thousand (owner ruling 2026-08-31: commas are display only)", () => {
    const csv = wetWeightsCsv([
      { ...base, weight_grams: 1000 },
      { ...base, weight_grams: 1234567.89 },
    ]);
    const lines = csv.split("\r\n");
    expect(lines[1].split(",")[1]).toBe("1000.00");
    expect(lines[2].split(",")[1]).toBe("1234567.89");
    expect(csv).not.toContain("1,000.00");
    expect(csv).not.toContain("1,234,567.89");
    // A grouped weight would also force csvCell quoting; these rows carry none.
    expect(csv).not.toContain('"');
  });
});

describe("plant tag allocation (owner ruling 2026-08-31: the Plant fill rule)", () => {
  it("spreads tags proportional to entry weight and the counts sum to N", () => {
    // 500 / 1000 / 500 grams, 8 tags: quotas 2 / 4 / 2 exactly.
    expect(allocateTagCounts([500, 1000, 500], 8)).toEqual([2, 4, 2]);
  });

  it("hands leftover tags to the largest remainders, earlier entries winning ties", () => {
    // 100 / 100 / 100, 4 tags: quotas 1.33 each; the leftover tag goes first.
    expect(allocateTagCounts([100, 100, 100], 4)).toEqual([2, 1, 1]);
    // 1 / 2, 4 tags: quotas 1.33 / 2.67; the leftover follows the .67.
    expect(allocateTagCounts([1, 2], 4)).toEqual([1, 3]);
  });

  it("gives every entry with weight at least one tag when N covers them", () => {
    // 1 / 10000, 2 tags: the tiny entry's quota floors to 0 and remainder
    // rounding leaves it empty, so one tag steals over from the big holder.
    expect(allocateTagCounts([0.01, 10000], 2)).toEqual([1, 1]);
    expect(allocateTagCounts([0.01, 0.02, 10000], 3)).toEqual([1, 1, 1]);
  });

  it("may leave the smallest entries with none when N is under the entry count", () => {
    const counts = allocateTagCounts([0.01, 5000, 5000], 2);
    expect(counts.reduce((a, b) => a + b, 0)).toBe(2);
    expect(counts[0]).toBe(0);
  });

  it("gives zero-weight entries nothing and survives N=0 and empty input", () => {
    expect(allocateTagCounts([0, 100], 3)).toEqual([0, 3]);
    expect(allocateTagCounts([100, 200], 0)).toEqual([0, 0]);
    expect(allocateTagCounts([], 3)).toEqual([]);
  });
});

describe("plant weight split (owner ruling 2026-08-31: the Plant fill rule)", () => {
  // The ruling, verbatim: "We use randbetween in excel right now where the
  // weight per plant is nominally the same, but the data looks organic. The
  // total of each randbetween value must combine to the actual total wet
  // grams weighed."
  const cents = (g: number) => Math.round(g * 100);
  const sumCents = (list: number[]) => list.reduce((a, g) => a + cents(g), 0);

  it("sums cent-exact per entry and in the grand total", () => {
    const entries = [500, 1234.56, 250.5];
    const splits = splitPlantWeights(entries, 12, 10, "batch-a");
    expect(splits).toHaveLength(3);
    splits.forEach((group, i) => {
      expect(sumCents(group)).toBe(cents(entries[i]));
    });
    const grand = splits.flat();
    expect(grand.length).toBe(12);
    expect(sumCents(grand)).toBe(cents(500 + 1234.56 + 250.5));
  });

  it("keeps every weight inside the jitter band of its equal base, one cent of slack", () => {
    const entries = [500, 1234.56, 250.5];
    const counts = allocateTagCounts(entries, 12);
    const splits = splitPlantWeights(entries, 12, 10, "batch-a");
    splits.forEach((group, i) => {
      const base = cents(entries[i]) / counts[i];
      for (const g of group) {
        expect(cents(g)).toBeGreaterThanOrEqual(Math.floor(base * 0.9) - 1);
        expect(cents(g)).toBeLessThanOrEqual(Math.ceil(base * 1.1) + 1);
        expect(g).toBeGreaterThanOrEqual(0.01);
      }
    });
  });

  it("is deterministic for a fixed batch id", () => {
    const entries = [500, 1234.56, 250.5];
    const a = splitPlantWeights(entries, 12, 10, "batch-a");
    const b = splitPlantWeights(entries, 12, 10, "batch-a");
    expect(a).toEqual(b);
  });

  it("hands a single tag the whole entry (N=1)", () => {
    expect(splitPlantWeights([1234.56], 1, 10, "batch-a")).toEqual([[1234.56]]);
  });

  it("wins the exact-sum law over the band on pathological tiny totals (N greater than cents)", () => {
    // 0.05 grams over 10 tags: fewer cents than tags, so the 0.01 floor cannot
    // hold; the documented behavior is that some tags render 0.00 and the
    // group still sums exactly.
    const [group] = splitPlantWeights([0.05], 10, 10, "batch-a");
    expect(group).toHaveLength(10);
    expect(sumCents(group)).toBe(5);
    expect(group.some((g) => g === 0)).toBe(true);
    expect(group.every((g) => g >= 0)).toBe(true);
  });

  it("jitters organically: a healthy split is not all-equal", () => {
    // 1000 grams over 10 tags at 10 percent: the band is 90.00 to 110.00 and
    // the seeded draws spread inside it.
    const [group] = splitPlantWeights([1000], 10, 10, "batch-a");
    expect(new Set(group).size).toBeGreaterThan(1);
    expect(sumCents(group)).toBe(100000);
  });
});

describe("plant tag parsing (owner ruling 2026-08-31: the Plant fill rule)", () => {
  it("splits lines, trims, and drops blanks", () => {
    expect(parsePlantTags("  1A4A \r\n\n1A4B\n   \n1A4C\n")).toEqual([
      "1A4A",
      "1A4B",
      "1A4C",
    ]);
  });

  it("dedupes case-sensitive as pasted, first occurrence winning", () => {
    expect(parsePlantTags("1A4A\n1A4a\n1A4A\n1A4B")).toEqual(["1A4A", "1A4a", "1A4B"]);
  });

  it("returns empty for an empty or blank paste (clears the set)", () => {
    expect(parsePlantTags("")).toEqual([]);
    expect(parsePlantTags("   \n \n")).toEqual([]);
    expect(parsePlantTags(null)).toEqual([]);
  });
});

describe("metrc wet weights csv with tags (owner ruling 2026-08-31: the Plant fill rule)", () => {
  const entries: WetWeightsCsvRow[] = [
    {
      weight_grams: 500,
      dry_space_name: "Truck",
      truck_number: "1",
      hbn: "26244-ARL-GH-027-0-NA-26002",
      entry_updated_at: "2026-09-01T14:30:00.000Z",
    },
    {
      weight_grams: 1234.56,
      dry_space_name: "Silo 1",
      truck_number: null,
      hbn: "26244-ARL-GH-027-0-NA-26002",
      entry_updated_at: "2026-09-02T10:00:00.000Z",
    },
  ];
  const tags = ["1A4PLANT0001", "1A4PLANT0002", "1A4PLANT0003"];

  it("carries one row per tag, Plant filled, riding each entry's location and date", () => {
    const csv = wetWeightsCsvWithTags(entries, tags, 10, "batch-a");
    const lines = csv.split("\r\n").filter((line) => line.length > 0);
    expect(lines[0]).toBe(METRC_WET_WEIGHTS_HEADER);
    expect(lines).toHaveLength(1 + tags.length);
    const plants = lines.slice(1).map((line) => line.split(",")[0]);
    expect([...plants].sort()).toEqual([...tags].sort());
    for (const line of lines.slice(1)) {
      const cells = line.split(",");
      expect(cells[2]).toBe("Grams");
      expect(cells[4]).toBe("");
      expect(cells[5]).toBe("26244-ARL-GH-027-0-NA-26002");
      expect(cells[6]).toBe("");
      expect(["Truck 1", "Silo 1"]).toContain(cells[3]);
      expect(["2026-09-01", "2026-09-02"]).toContain(cells[7]);
      // A tag row rides its own entry's location and date together.
      if (cells[3] === "Truck 1") expect(cells[7]).toBe("2026-09-01");
      else expect(cells[7]).toBe("2026-09-02");
    }
  });

  it("keeps weights raw 2-decimal with no comma grouping and sums cent-exact to the wet total", () => {
    const csv = wetWeightsCsvWithTags(entries, tags, 10, "batch-a");
    const lines = csv.split("\r\n").filter((line) => line.length > 0).slice(1);
    let centsTotal = 0;
    for (const line of lines) {
      const cells = line.split(",");
      // A comma-grouped weight would split into a ninth cell; raw stays 8.
      expect(cells).toHaveLength(8);
      expect(cells[1]).toMatch(/^\d+\.\d{2}$/);
      centsTotal += Math.round(Number(cells[1]) * 100);
    }
    expect(centsTotal).toBe(Math.round((500 + 1234.56) * 100));
  });

  it("reproduces the identical file for the same batch id (determinism)", () => {
    expect(wetWeightsCsvWithTags(entries, tags, 10, "batch-a")).toBe(
      wetWeightsCsvWithTags(entries, tags, 10, "batch-a")
    );
  });

  it("leaves the tagless per-read file untouched: Plant stays empty there", () => {
    const readsCsv = wetWeightsCsv([
      {
        weight_grams: 500,
        dry_space_name: "Silo 1",
        truck_number: null,
        hbn: "26244-ARL-GH-027-0-NA-26002",
        entry_updated_at: "2026-09-01T14:30:00.000Z",
      },
    ]);
    expect(readsCsv.split("\r\n")[1].startsWith(",500.00,Grams,")).toBe(true);
  });
});

// THE PLANT COUNT (owner ruling 2026-09-14, canon 0.30.62), verbatim: "The
// total divided by the number of plants with each record weight randomized but
// totalling the correct total is what we need for the CSV that goes into METRC."
describe("metrc wet weights csv with plant counts (owner ruling 2026-09-14: the plant count)", () => {
  const counted: WetWeightsCsvRow = {
    weight_grams: 1234.56,
    dry_space_name: "Silo 1",
    truck_number: null,
    hbn: "26257-ARL-GH-027-0-NA-26010",
    entry_updated_at: "2026-09-14T13:00:00.000Z",
    entry_id: "lot-a",
    plant_count: 7,
  };
  const uncounted: WetWeightsCsvRow = {
    weight_grams: 500,
    dry_space_name: "Truck",
    truck_number: "1",
    hbn: "26257-ARL-GH-027-0-NA-26010",
    entry_updated_at: "2026-09-14T09:00:00.000Z",
    created_at: "2026-09-14T13:00:00.000Z",
    entry_id: "lot-b",
    plant_count: null,
  };
  const reads: WetWeightsCsvRow[] = [
    { ...uncounted, weight_grams: 200 },
    { ...uncounted, weight_grams: 300 },
    { ...counted, weight_grams: 1000, plant_count: null },
    { ...counted, weight_grams: 234.56, plant_count: null },
  ];

  it("writes one row per plant for a counted lot, Plant empty, summing cent-exact to the lot total", () => {
    const csv = wetWeightsCsvWithCounts([counted], reads, 10, "batch-a", "ARL BARN");
    const lines = csv.split("\r\n").filter((line) => line.length > 0);
    expect(lines[0]).toBe(METRC_WET_WEIGHTS_HEADER);
    expect(lines).toHaveLength(1 + 7);
    let cents = 0;
    for (const line of lines.slice(1)) {
      const cells = line.split(",");
      expect(cells).toHaveLength(8);
      expect(cells[0]).toBe("");
      expect(cells[1]).toMatch(/^\d+\.\d{2}$/);
      expect(cells[2]).toBe("Grams");
      expect(cells[3]).toBe("BARN");
      expect(cells[5]).toBe("26257-ARL-GH-027-0-NA-26010");
      expect(cells[7]).toBe("2026-09-14");
      cents += Math.round(Number(cells[1]) * 100);
    }
    expect(cents).toBe(123456);
    // Randomized around the equal share (176.37) within the 10 percent band, not all equal.
    const weights = lines.slice(1).map((line) => Number(line.split(",")[1]));
    expect(new Set(weights).size).toBeGreaterThan(1);
    for (const w of weights) {
      expect(w).toBeGreaterThanOrEqual(158.7);
      expect(w).toBeLessThanOrEqual(194.1);
    }
  });

  it("keeps an uncounted lot on its scale reads while the counted lot splits, in entry order", () => {
    const csv = wetWeightsCsvWithCounts([uncounted, counted], reads, 10, "batch-a", "PNN BARN");
    const lines = csv.split("\r\n").filter((line) => line.length > 0).slice(1);
    expect(lines).toHaveLength(2 + 7);
    expect(lines[0].startsWith(",200.00,Grams,BARN,,")).toBe(true);
    expect(lines[1].startsWith(",300.00,Grams,BARN,,")).toBe(true);
    expect(lines[0].endsWith(",2026-09-14")).toBe(true);
    const cents = lines.reduce((n, line) => n + Math.round(Number(line.split(",")[1]) * 100), 0);
    expect(cents).toBe(Math.round((500 + 1234.56) * 100));
  });

  it("reproduces the identical file for the same batch id, and a different lot id draws a different split", () => {
    expect(wetWeightsCsvWithCounts([counted], reads, 10, "batch-a")).toBe(wetWeightsCsvWithCounts([counted], reads, 10, "batch-a"));
    const other = wetWeightsCsvWithCounts([{ ...counted, entry_id: "lot-z" }], reads, 10, "batch-a");
    expect(other).not.toBe(wetWeightsCsvWithCounts([counted], reads, 10, "batch-a"));
  });

  it("falls back to the physical space when no barn is passed, Truck n for a truck lot", () => {
    const csv = wetWeightsCsvWithCounts([{ ...counted, plant_count: 2, dry_space_name: "Truck", truck_number: "3" }], [], 0, "batch-a");
    const lines = csv.split("\r\n").filter((line) => line.length > 0).slice(1);
    expect(lines).toHaveLength(2);
    for (const line of lines) expect(line.split(",")[3]).toBe("Truck 3");
    // Zero jitter: the two rows read the equal halves, 617.28 and 617.28.
    expect(lines.map((line) => line.split(",")[1])).toEqual(["617.28", "617.28"]);
  });

  it("anyPlantCount reads the batch: any counted finished lot switches the file to the count split", () => {
    expect(anyPlantCount([uncounted])).toBe(false);
    expect(anyPlantCount([uncounted, counted])).toBe(true);
    expect(anyPlantCount([{ ...counted, plant_count: 0 }])).toBe(false);
  });

  it("parsePlantCount: blank is the skip, a grouped whole number reads, fractions and zero refuse", () => {
    expect(parsePlantCount(null)).toBeNull();
    expect(parsePlantCount("")).toBeNull();
    expect(parsePlantCount("  ")).toBeNull();
    expect(parsePlantCount("120")).toBe(120);
    expect(parsePlantCount(" 1,200 ")).toBe(1200);
    for (const bad of ["0", "-3", "12.5", "abc", "1e3"]) {
      expect(() => parsePlantCount(bad)).toThrow(HttpError);
    }
  });
});

describe("queue csv exports (owner ruling 2026-08-31: commas are display only)", () => {
  it("writes gram columns exactly as the rows carry them, never comma grouped", () => {
    const csv = queueRowsToCsv(
      [
        { field: "hbn", label: "HBN" },
        { field: "weight_grams", label: "Bucked (g)" },
        { field: "dry_weight_grams", label: "Dry total (g)" },
      ],
      [
        {
          id: "w1",
          values: {
            hbn: "26244-ARL-GH-027-0-NA-26002",
            weight_grams: "1234.56",
            dry_weight_grams: "1000000",
          },
        },
      ]
    );
    expect(csv).toContain("1234.56");
    expect(csv).toContain("1000000");
    expect(csv).not.toContain("1,234.56");
    expect(csv).not.toContain("1,000,000");
  });
});

/* SM1 (canon 0.30.554): the sliced reader against the char by char reader it
 * replaced, kept here word for word as the reference. */
function parseCsvReference(text: string): string[][] {
  const rows: string[][] = [];
  let cell = "";
  let row: string[] = [];
  let i = 0;
  let quoted = false;
  const src = text.replace(/^\uFEFF/, "");
  while (i < src.length) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i += 2;
          continue;
        }
        quoted = false;
        i += 1;
        continue;
      }
      cell += ch;
      i += 1;
      continue;
    }
    if (ch === '"') {
      quoted = true;
      i += 1;
      continue;
    }
    if (ch === ",") {
      row.push(cell);
      cell = "";
      i += 1;
      continue;
    }
    if (ch === "\n") {
      row.push(cell);
      if (row.length > 1 || row[0] !== "") rows.push(row);
      row = [];
      cell = "";
      i += 1;
      continue;
    }
    if (ch === "\r") {
      i += 1;
      continue;
    }
    cell += ch;
    i += 1;
  }
  if (quoted) throw new Error("CSV quote was not closed.");
  if (cell !== "" || row.length > 0) {
    row.push(cell);
    if (row.length > 1 || row[0] !== "") rows.push(row);
  }
  return rows;
}

function readBoth(text: string): [string, string] {
  const run = (f: (s: string) => string[][]) => {
    try {
      return JSON.stringify(f(text));
    } catch (err) {
      return `THROW ${(err as Error).message}`;
    }
  };
  return [run(parseCsv), run(parseCsvReference)];
}

describe("parseCsv, the sliced reader (SM1)", () => {
  it("reads every edge the old reader read, the same way", () => {
    const cases = [
      "", "\n", "a", "a,b\nc,d", "a,b\r\nc,d\r\n", "\uFEFFx,y\n1,2", '"a,b",c\n', '"he said ""hi""",x', 'a"b,c"d,e',
      '"x\r\ny",z', "a\rb,c", ",,\n,", "a,\n\n\nb", '""', '"",""\n', "x,y\n\n", 'a""b', '"a"b"c"', "\r\n\r\n", "a\n\r\nb",
      '"unterminated', 'ok,"bad',
    ];
    for (const text of cases) {
      const [now, before] = readBoth(text);
      expect(now, JSON.stringify(text)).toBe(before);
    }
  });

  it("matches the old reader on 20,000 random texts", () => {
    const alphabet = ["a", "b", ",", '"', "\n", "\r", " ", '""', "\uFEFF"];
    let seed = 20261027;
    const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
    for (let k = 0; k < 20000; k++) {
      let text = "";
      const length = Math.floor(rnd() * 16);
      for (let j = 0; j < length; j++) text += alphabet[Math.floor(rnd() * alphabet.length)];
      const [now, before] = readBoth(text);
      if (now !== before) expect(now, JSON.stringify(text)).toBe(before);
    }
  });

  it("reads a wide quoted export the same way", () => {
    const head = Array.from({ length: 60 }, (_, c) => `Column ${c}`);
    const lines = [head.join(",")];
    for (let r = 0; r < 800; r++) {
      lines.push(head.map((_, c) => (c % 7 === 0 ? `"note ${r}, with ""quotes""\nand a break"` : c % 5 === 0 ? "" : `v${r}.${c}`)).join(","));
    }
    const text = "\uFEFF" + lines.join("\r\n") + "\r\n";
    const [now, before] = readBoth(text);
    expect(now).toBe(before);
    expect(parseCsv(text)).toHaveLength(801);
  });
});
