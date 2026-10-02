import { describe, expect, it } from "vitest";
import { savePostHarvestPlan, importPostHarvest, loadPuzzlePage } from "../src/puzzles";
import {
  lotTokenYear,
  productBucket,
  puzzleNumbers,
  testsForStrain,
  topIndexes,
  type PuzzleLot,
  type PuzzleTest,
} from "../src/puzzles";
import { buildXlsx, buildXlsxBook, deflateZipPart, readXlsxSheets, writeStoreZip } from "../src/xlsx";
import { formOf, migratedDb, seedPerson } from "./migrated";

const HEADERS = [
  "License Number",
  "Med/AU",
  "Strain",
  "Item Name",
  "Source Metrc Tag",
  "Batch Weight (grams)",
  "Harvest Batch Name",
  "Sample Tag",
  "Required Test",
  "Net Weight (grams)",
  "Testing Facility",
  "Entered Testing",
  "Finished testing",
  "THC Potency %",
  "Testing Status",
  "Fail Reason",
  "Notes",
];

function lot(over: Partial<PuzzleLot> & { strain: string }): PuzzleLot {
  return {
    market: over.strain,
    farm: "PNN",
    hbn: "25001-ARL-GH-001-0-NA-25001",
    plants: 10,
    spear: 0,
    bucked: 0,
    bud: 0,
    mixed: 0,
    smalls: 0,
    trim: 0,
    shake: 0,
    bio: 0,
    kief: 0,
    entryDate: "2025-10-10",
    ...over,
  };
}

describe("POST HARVEST PUZZLES (canon 0.30.351)", () => {
  it("maps package types and reads the lot token year", () => {
    expect(productBucket("WPR")).toBe("smalls");
    expect(productBucket("SHA")).toBe("shake");
    expect(productBucket("WASTE")).toBeNull();
    expect(productBucket("MIX")).toBe("mixed");
    expect(lotTokenYear("46223-ARL-GH-015-0-NA-26001")).toBe(2026);
    expect(lotTokenYear("25001")).toBe(2025);
    expect(lotTokenYear("short")).toBeNull();
  });

  it("computes the sheet's columns, leaves R&D out, and dashes a zero plant or a zero divisor", () => {
    const rows = puzzleNumbers(
      [
        lot({ strain: "Alpha", plants: 10, spear: 4480, bud: 448, trim: 448, hbn: "25001-ARL-GH-001-0-NA-25001" }),
        lot({ strain: "Alpha", plants: 0, spear: 448, hbn: "25002-ARL-GH-001-0-NA-25002", entryDate: "2025-10-12" }),
        lot({ strain: "Beta", plants: 0, spear: 448, bucked: 448, hbn: "25003-ARL-GH-001-0-NA-25003" }),
        lot({ strain: "Gamma", plants: 5, hbn: "25004-ARL-GH-001-0-NA-25004" }),
        lot({ strain: "R&D", plants: 99, spear: 4480, bud: 448 }),
      ],
      [],
      [],
      150,
      30
    );
    expect(rows.map((row) => row.strain)).toEqual(["Alpha", "Beta", "Gamma"]);
    const alpha = rows[0];
    expect(alpha.plants).toBe(10);
    expect(alpha.wetLbs).toBeCloseTo(11, 5);
    expect(alpha.dryLbs).toBeCloseTo(2, 5);
    expect(alpha.dryPct).toBeCloseTo(2 / 11, 5);
    expect(alpha.totalBud).toBeCloseTo(1, 5);
    expect(alpha.totalTrimBio).toBeCloseTo(1, 5);
    expect(alpha.wetPp).toBeCloseTo(1.1, 5);
    expect(alpha.dryPp).toBeCloseTo(0.2, 5);
    expect(alpha.btr).toBeCloseTo(0.5, 5);
    expect(alpha.bpp).toBeCloseTo(0.1, 5);
    expect(alpha.tpp).toBeCloseTo(0.1, 5);
    expect(alpha.dollarPp).toBeCloseTo(18, 5);
    expect(alpha.harvestDate).toBe("2025-10-10");
    expect(rows.find((row) => row.strain === "Beta")?.wetPp).toBeNull();
    expect(rows.find((row) => row.strain === "Gamma")?.dryPct).toBeNull();
    expect(rows.find((row) => row.strain === "Gamma")?.btr).toBeNull();
    expect(rows.find((row) => row.strain === "Gamma")?.dollarPp).toBeNull();
  });

  it("matches tests by market strain, then by HBN, and only inside the year token", () => {
    const lots = [lot({ strain: "Alpha", market: "Market A", hbn: "25001-ARL-GH-001-0-NA-25001" })];
    const tests: PuzzleTest[] = [
      { strain: "Market A", hbn: "other", potency: 20, status: "Passed", failureMode: null, attempt: 1 },
      { strain: "Nope", hbn: "25001-ARL-GH-001-0-NA-25001", potency: 10, status: "Failed", failureMode: "Total Yeast & Mold", attempt: 1 },
    ];
    const matched = testsForStrain(lots, tests);
    expect(matched).toHaveLength(1);
    expect(matched[0]?.potency).toBe(20);
    const byHbn = testsForStrain(lots, [tests[1]]);
    expect(byHbn).toHaveLength(1);
    const yearTests = tests.filter((test) => lotTokenYear(test.hbn) === 2025 || lotTokenYear("25001-ARL-GH-001-0-NA-25001") === 2025);
    expect(yearTests.length).toBeGreaterThan(0);
    const numbered = puzzleNumbers(lots, tests, [], 150, 30);
    expect(numbered[0]?.thc).toBe(20);
    expect(numbered[0]?.tymFails).toBe(0);
    const yeast = puzzleNumbers(lots, [tests[1]], [], 150, 30);
    expect(yeast[0]?.tymFails).toBe(1);
    expect(yeast[0]?.tests).toBe(1);
    expect(yeast[0]?.tymPct).toBe(1);
    expect(topIndexes([1, 5, null, 4, 9, 2, 8, 3, 7, 6, 0, 10], 10).size).toBe(10);
    expect(topIndexes([1, 5, null, 4, 9, 2, 8, 3, 7, 6, 0, 10], 10).has(11)).toBe(true);
    expect(topIndexes([1, 5, null, 4, 9, 2, 8, 3, 7, 6, 0, 10], 10).has(10)).toBe(false);
  });

  it("reads an xlsx, including a deflated part and a shared string", async () => {
    const book = buildXlsx({
      sheetName: "data",
      headers: ["Strain", "Wet Spear Weight\n(grams)"],
      rows: [[{ text: "Alpha" }, { number: 448 }]],
      plainNumbers: true,
    });
    const stored = await readXlsxSheets(book);
    expect(stored.get("data")?.[0].cells[1]).toBe("Wet Spear Weight\n(grams)");
    expect(stored.get("data")?.[1].cells[0]).toBe("Alpha");
    expect(stored.get("data")?.[1].cells[1]).toBe(448);
    const deflated = await deflateZipPart(book, "xl/worksheets/sheet1.xml");
    const mixed = await readXlsxSheets(deflated);
    expect(mixed.get("data")?.[1].cells).toEqual(stored.get("data")?.[1].cells);
    const shared = writeStoreZip([
      {
        name: "xl/workbook.xml",
        data: new TextEncoder().encode(
          `<?xml version="1.0"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="data" sheetId="1" r:id="rId1"/></sheets></workbook>`
        ),
      },
      {
        name: "xl/_rels/workbook.xml.rels",
        data: new TextEncoder().encode(
          `<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>`
        ),
      },
      {
        name: "xl/sharedStrings.xml",
        data: new TextEncoder().encode(`<?xml version="1.0"?><sst><si><t>Shared Strain</t></si></sst>`),
      },
      {
        name: "xl/worksheets/sheet1.xml",
        data: new TextEncoder().encode(`<?xml version="1.0"?><worksheet><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c></row></sheetData></worksheet>`),
      },
    ]);
    expect((await readXlsxSheets(shared)).get("data")?.[0].cells[0]).toBe("Shared Strain");
  });

  it("imports a year, keeps a typed plan until confirm, and refuses a plan save without a reason", async () => {
    const m = await migratedDb();
    const person = seedPerson(m);
    const dataHeaders = [
      "Date",
      "METRC Harvest Tag",
      "Harvest Batch Name",
      "Farm",
      "Grow Method",
      "Strain",
      "Market Strain",
      "Associated Batch",
      "Is Bio/FFZ?",
      "Plants",
      "Wet Spear Weight\n(grams)",
      "Bucked Wet Weight (grams)",
      "Dry Weight (grams)",
      "Bud Weight (grams)",
      "Mixed Weight (grams)",
      "Smalls Weight (grams)",
      "Trim Weight (grams)",
      "shake",
      "Bio Weight (grams)",
      "Kief Weight (grams)",
    ];
    const lotRow = dataHeaders.map(() => ({ text: undefined as string | undefined, number: undefined as number | undefined }));
    const put = (name: string, text?: string, number?: number) => {
      const at = dataHeaders.indexOf(name);
      lotRow[at] = { text, number };
    };
    put("Harvest Batch Name", "25010-ARL-GH-001-0-NA-25001");
    put("Strain", "Alpha");
    put("Farm", "PNN");
    put("Plants", undefined, 10);
    put("Wet Spear Weight\n(grams)", undefined, 4480);
    const testingRow = HEADERS.map((name) => {
      if (name === "Strain") return { text: "Alpha" };
      if (name === "Harvest Batch Name") return { text: "25010-ARL-GH-001-0-NA-25001" };
      if (name === "Source Metrc Tag") return { text: "TAG1" };
      if (name === "Required Test") return { text: "Full Compliance" };
      if (name === "Entered Testing") return { text: "2025-10-10" };
      if (name === "THC Potency %") return { number: 22.5 };
      if (name === "Testing Status") return { text: "Failed" };
      if (name === "Fail Reason") return { text: "Total Yeast & Mold" };
      return { text: "x" };
    });
    const book = () =>
      buildXlsxBook([
        { sheetName: "data", headers: dataHeaders, rows: [lotRow], plainNumbers: true },
        { sheetName: "InTesting", headers: HEADERS, rows: [testingRow], plainNumbers: true },
        {
          sheetName: "results",
          headers: ["Strain", "26 Allocation", "TC or IH"],
          rows: [[{ text: "Alpha" }, { number: 100 }, { text: "TC" }]],
          plainNumbers: true,
        },
      ]);
    // One batch name over two harvest tags: both rows land, the plants typed once (gate 0.30.352).
    put("METRC Harvest Tag", "TAG-A");
    const tagRow = lotRow.map((cell) => ({ ...cell }));
    tagRow[dataHeaders.indexOf("METRC Harvest Tag")] = { text: "TAG-B", number: undefined };
    tagRow[dataHeaders.indexOf("Plants")] = { text: undefined, number: undefined };
    const twoTags = formOf({ person_id: person, reason: "two tags" });
    twoTags.set(
      "file",
      new File(
        [
          buildXlsxBook([
            { sheetName: "data", headers: dataHeaders, rows: [lotRow, tagRow], plainNumbers: true },
            { sheetName: "InTesting", headers: HEADERS, rows: [testingRow], plainNumbers: true },
          ]),
        ],
        "puzzles.xlsx"
      )
    );
    expect((await importPostHarvest(m.db, twoTags)).redirect).toContain("lots=2");
    const twoPage = await loadPuzzlePage(m.db, "2025", "All");
    expect(twoPage.rows.map((row) => [row.strain, row.plants, row.wetLbs])).toEqual([["Alpha", 10, 20]]);
    const fileForm = formOf({ person_id: person, reason: "load 2025" });
    fileForm.set("file", new File([book()], "puzzles.xlsx"));
    const imported = await importPostHarvest(m.db, fileForm);
    expect(imported.redirect).toContain("imported_year=2025");
    expect(imported.redirect).toContain("lots=1");
    expect(imported.redirect).toContain("tests=1");
    expect(imported.redirect).toContain("plan=1");
    expect(m.get(`SELECT allocation_plants, tc_ih, source FROM post_harvest_plan WHERE harvest_year = 2025 AND strain_name = 'Alpha'`)).toEqual({
      allocation_plants: 100,
      tc_ih: "TC",
      source: "import",
    });
    await savePostHarvestPlan(m.db, formOf({ person_id: person, harvest_year: "2025", strain_name: "Alpha", allocation: "50", tc_ih: "IH", reason: "typed" }));
    const again = formOf({ person_id: person, reason: "reload" });
    again.set("file", new File([book()], "puzzles.xlsx"));
    await importPostHarvest(m.db, again);
    expect(m.get(`SELECT allocation_plants, source FROM post_harvest_plan WHERE harvest_year = 2025 AND strain_name = 'Alpha'`)).toEqual({
      allocation_plants: 50,
      source: "typed",
    });
    const confirmed = formOf({ person_id: person, reason: "replace typed", replace_typed: "1" });
    confirmed.set("file", new File([book()], "puzzles.xlsx"));
    await importPostHarvest(m.db, confirmed);
    expect(m.get(`SELECT allocation_plants, source FROM post_harvest_plan WHERE harvest_year = 2025 AND strain_name = 'Alpha'`)).toEqual({
      allocation_plants: 100,
      source: "import",
    });
    const refused = await savePostHarvestPlan(
      m.db,
      formOf({ person_id: person, harvest_year: "2025", strain_name: "Alpha", allocation: "1", reason: "" })
    ).catch((err) => err);
    expect((refused as Error).message).toBe("Reason is required.");
  });
});
