import { describe, expect, it } from "vitest";
import { cryoStationPage } from "../src/cryo";
import {
  isMetrcTag,
  lacksMetrcTag,
  metrcFacingTag,
  normalizeMetrcTag,
} from "../src/config";
import { pendingUploadsPage, stationPage, wetLotPanel, metrcTagInput } from "../src/html";
import { planFinishMint } from "../src/ledger";
import {
  columnIndex,
  detectMetrcKind,
  diffMount,
  excelSerialToIso,
  fieldAppliesTo,
  normalizeMetrcBool,
  normalizeMetrcDate,
  parseDateStyles,
  parseMetrcFilename,
  parseSharedStrings,
  parseSheetRow,
  phaseFromGrid,
  readCsvGrid,
  readMetrcGrid,
  rowsPerInsert,
  metrcItemKind,
  metrcUomKey,
  scanMetrcExport,
  shapeMetrcFg,
  shapePackageRow,
  shapePackages,
  listMetrcAdoptions,
  releaseTestedFromMirror,
  shapePlantRow,
  shapePlants,
  streamMetrcGrid,
  summarizePackages,
  summarizePlants,
  zipEntries,
  metrcIndexer,
  METRC_PACKAGE_COLUMNS,
  METRC_PLANT_COLUMNS,
  METRC_SLICE_ROWS,
} from "../src/metrc";
import { metrcPane, mountRowsDone } from "../src/metrcpane";
import { queueByKey, stationByKey, type QueueDef } from "../src/pipeline";
import type { PersonRow, QueueRow } from "../src/db";
import { adoptFromMetrc } from "../src/actions";
import { FIXTURE_ALIAS_METRC, FIXTURE_ALIAS_TAG, fixtureAliasSheetHbn, landSheetWorkbook, sheetWorkbook } from "../src/sheetsync";
import { refusalText } from "../src/i18n";
import { formOf, migratedDb, seedBatch, seedLot, seedMirror, seedPerson } from "./migrated";

/* ------------------------------------------------ a zip and xlsx builder */

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function le16(n: number): number[] {
  return [n & 0xff, (n >>> 8) & 0xff];
}
function le32(n: number): number[] {
  return [n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff, (n >>> 24) & 0xff];
}

async function deflateRaw(bytes: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** A minimal zip: stored (method 0) or deflated (method 8) entries. */
async function buildZip(files: Record<string, string>, method: 0 | 8): Promise<Uint8Array> {
  const enc = new TextEncoder();
  const locals: number[] = [];
  const centrals: number[] = [];
  let offset = 0;
  for (const [name, text] of Object.entries(files)) {
    const nameBytes = enc.encode(name);
    const raw = enc.encode(text);
    const data = method === 8 ? await deflateRaw(raw) : raw;
    const crc = crc32(raw);
    const local = [
      ...le32(0x04034b50), ...le16(20), ...le16(0), ...le16(method), ...le16(0), ...le16(0),
      ...le32(crc), ...le32(data.length), ...le32(raw.length), ...le16(nameBytes.length), ...le16(0),
      ...nameBytes, ...data,
    ];
    centrals.push(
      ...le32(0x02014b50), ...le16(20), ...le16(20), ...le16(0), ...le16(method), ...le16(0), ...le16(0),
      ...le32(crc), ...le32(data.length), ...le32(raw.length), ...le16(nameBytes.length), ...le16(0), ...le16(0),
      ...le16(0), ...le16(0), ...le32(0), ...le32(offset), ...nameBytes
    );
    locals.push(...local);
    offset += local.length;
  }
  const count = Object.keys(files).length;
  const eocd = [
    ...le32(0x06054b50), ...le16(0), ...le16(0), ...le16(count), ...le16(count),
    ...le32(centrals.length), ...le32(locals.length), ...le16(0),
  ];
  return new Uint8Array([...locals, ...centrals, ...eocd]);
}

const STYLES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <numFmts count="1"><numFmt numFmtId="164" formatCode="m/d/yyyy h:mm"/></numFmts>
  <cellXfs count="4">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" />
    <xf xfId="0" fontId="1" applyFont="1" fillId="2" applyFill="1"></xf>
    <xf xfId="0" numFmtId="14" applyNumberFormat="1"></xf>
    <xf xfId="0" numFmtId="164" applyNumberFormat="1"></xf>
  </cellXfs>
</styleSheet>`;

function sst(strings: string[]): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${strings.length}" uniqueCount="${strings.length}">
${strings.map((s) => `<si><t xml:space="preserve">${s.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</t></si>`).join("\n")}
</sst>`;
}

type Cell = { t?: "s" | "b" | "n"; s?: number; v?: string | number; empty?: boolean };

function sheet(rows: Cell[][]): string {
  const cols = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const body = rows
    .map((cells, r) => {
      const inner = cells
        .map((c, i) => {
          const ref = `${cols[i]}${r + 1}`;
          if (c.empty) return `<c r="${ref}"  >\n\n</c>`;
          const attrs = `${c.s != null ? ` s="${c.s}"` : ""}${c.t ? ` t="${c.t}"` : ""}`;
          return `<c r="${ref}"${attrs}>\n  <v>${c.v}</v>\n</c>`;
        })
        .join("\n");
      return `<row r="${r + 1}" x14ac:dyDescent="0.25"\n>\n${inner}\n</row>`;
    })
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:x14ac="http://schemas.microsoft.com/office/spreadsheetml/2009/9/ac">
<dimension ref="A1"/><sheetData>
${body}
</sheetData></worksheet>`;
}

/** Two flowering plants and one with an empty sublocation, METRC's shape. */
async function plantsXlsx(method: 0 | 8): Promise<Uint8Array> {
  const strings = [
    ...METRC_PLANT_COLUMNS,
    "1A4050000000000000000001",
    "Bermuda Triangle",
    "West 3",
    "Bermuda Triangle 5/27/2026 & Co",
    "Seed",
    "1A4050000000000000000002",
    "West 4",
  ];
  const s = (text: string) => ({ t: "s" as const, v: strings.indexOf(text) });
  const rows: Cell[][] = [
    METRC_PLANT_COLUMNS.map((h) => ({ t: "s" as const, s: 1, v: strings.indexOf(h) })),
    [s("1A4050000000000000000001"), s("Bermuda Triangle"), s("West 3"), { empty: true }, { t: "b", v: 0 }, s("Bermuda Triangle 5/27/2026 & Co"), s("Seed"), { s: 2, v: 46169 }, { s: 2, v: 46237 }, { t: "n", v: 0 }],
    [s("1A4050000000000000000002"), s("Bermuda Triangle"), s("West 4"), { empty: true }, { t: "b", v: 1 }, s("Bermuda Triangle 5/27/2026 & Co"), s("Seed"), { s: 3, v: 46169.5 }, { s: 2, v: 46237 }, { t: "n", v: 1 }],
  ];
  return buildZip(
    {
      "[Content_Types].xml": `<?xml version="1.0"?><Types/>`,
      "xl/workbook.xml": `<?xml version="1.0"?><workbook><sheets><sheet name="Sheet1" sheetId="1" r:id="rId1"/></sheets></workbook>`,
      "xl/styles.xml": STYLES_XML,
      "xl/sharedStrings.xml": sst(strings),
      "xl/worksheets/sheet1.xml": sheet(rows),
    },
    method
  );
}

const PACKAGES_CSV = `${METRC_PACKAGE_COLUMNS.join(",")}\r
1A4050300000000000000A01,"46258-PNN-ID-062-0-NA-26007, 46258-PNN-ID-062-0-NA-26008",1A4050100000000000000B01,,,Trim Room,,WIP - Placeholder - PNN - I,Buds,Placeholder,29220,g,,,NotSubmitted,False,False,False,9/1/2026 12:00:00 AM,,,\r
1a4050300000000000000a02,45951-PNN-OD-051-0-02-25162,,,,Barn,,GRIP Vape - Elsewhere - 2g,Vape Cart,,"1,234",ea,,,TestPassed,False,False,False,2025-12-01,2025-12-02,,\r
1A4050300000000000000A02,45951-PNN-OD-051-0-02-25162,,,,Barn,,GRIP Vape - Elsewhere - 2g,Vape Cart,,1235,ea,,,TestPassed,False,False,False,2025-12-01,2025-12-02,,\r
`;

/* ------------------------------------------------------------ the tests */

describe("THE METRC MIRROR: the file name (canon 0.30.38, fork F2)", () => {
  it("reads license, kind and grid from METRC's own file names", () => {
    expect(parseMetrcFilename("MetrcMichiganAUGC000832PackagesActive_12.xlsx")).toEqual({
      license: "AU-G-C-000832",
      kind: "packages",
      grid: "Active",
    });
    expect(parseMetrcFilename("MetrcMichiganGRC001132PlantsVegetative_6.xlsx")).toEqual({
      license: "GR-C-001132",
      kind: "plants",
      grid: "Vegetative",
    });
    expect(parseMetrcFilename("C:\\Downloads\\MetrcMichiganGRC002600PlantsFlowering.csv").license).toBe("GR-C-002600");
    expect(parseMetrcFilename("MetrcMichiganAUP000694PackagesActive.xlsx").license).toBe("AU-P-000694");
    expect(parseMetrcFilename("Item 2.csv")).toEqual({ license: null, kind: null, grid: null });
    expect(phaseFromGrid("Flowering")).toBe("flowering");
    expect(phaseFromGrid("Vegetative")).toBe("vegetative");
    expect(phaseFromGrid("Active")).toBe("active");
    expect(phaseFromGrid(null)).toBeNull();
  });
});

describe("THE METRC MIRROR: the xlsx reader", () => {
  it("walks the zip, decodes shared strings, booleans, dates and blanks (stored and deflated)", async () => {
    for (const method of [0, 8] as const) {
      const bytes = await plantsXlsx(method);
      const names = zipEntries(bytes).map((e) => e.name);
      expect(names).toContain("xl/worksheets/sheet1.xml");
      const grid = await readMetrcGrid(bytes);
      expect(grid.format).toBe("xlsx");
      expect(grid.header).toEqual([...METRC_PLANT_COLUMNS]);
      expect(grid.rows).toHaveLength(2);
      expect(grid.rows[0]).toEqual([
        "1A4050000000000000000001",
        "Bermuda Triangle",
        "West 3",
        "",
        "False",
        "Bermuda Triangle 5/27/2026 & Co",
        "Seed",
        "2026-05-27",
        "2026-08-03",
        "0",
      ]);
      // A custom m/d/yyyy h:mm style reads as a date too; the time drops.
      expect(grid.rows[1][7]).toBe("2026-05-27");
      expect(grid.rows[1][4]).toBe("True");
      expect(grid.rows[1][9]).toBe("1");
    }
  });

  it("reads the pieces on their own", () => {
    expect(columnIndex("A")).toBe(0);
    expect(columnIndex("J")).toBe(9);
    expect(columnIndex("V")).toBe(21);
    expect(columnIndex("AA")).toBe(26);
    expect(excelSerialToIso(46169)).toBe("2026-05-27");
    expect(excelSerialToIso(46237)).toBe("2026-08-03");
    expect(excelSerialToIso(46023)).toBe("2026-01-01");
    expect(parseSharedStrings(sst(["Tag", "A & B", "x<y"]))).toEqual(["Tag", "A & B", "x<y"]);
    const styles = parseDateStyles(STYLES_XML);
    expect([...styles].sort()).toEqual([2, 3]);
    const row = parseSheetRow(
      `<row r="2"><c r="A2" t="s"><v>0</v></c><c r="C2" s="2"><v>46169</v></c><c r="D2" t="inlineStr"><is><t>inline &amp; here</t></is></c><c r="E2"/></row>`,
      ["Shared"],
      styles
    );
    // The self-closed E2 registers as a blank cell in its place.
    expect(row).toEqual(["Shared", "", "2026-05-27", "inline & here", ""]);
  });

  it("refuses a file that is not a zip as a CSV and a zip without a sheet in words", async () => {
    const csv = readCsvGrid("Tag,Strain\r\n1A1,Gelato\r\n");
    expect(csv.header).toEqual(["Tag", "Strain"]);
    expect(csv.rows).toEqual([["1A1", "Gelato"]]);
    const noSheet = await buildZip({ "xl/workbook.xml": "<workbook/>" }, 0);
    await expect(readMetrcGrid(noSheet)).rejects.toThrow(/no worksheet/);
  });
});

describe("THE METRC MIRROR: kinds, shaping and the mount diff", () => {
  it("tells plants from packages by the header, refuses the rest", () => {
    expect(detectMetrcKind([...METRC_PLANT_COLUMNS])).toBe("plants");
    expect(detectMetrcKind([...METRC_PACKAGE_COLUMNS])).toBe("packages");
    expect(detectMetrcKind(["Item ID", "SKU", "Stock On Hand"])).toBeNull();
    expect(detectMetrcKind(["Tag", "Weight"])).toBeNull();
  });

  it("shapes packages from METRC's CSV: US dates, quoted lists, thousands, upper-cased tags, last row wins", async () => {
    const grid = await readMetrcGrid(new TextEncoder().encode(PACKAGES_CSV));
    expect(grid.format).toBe("csv");
    expect(detectMetrcKind(grid.header)).toBe("packages");
    const rows = shapePackages(grid);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      tag: "1A4050300000000000000A01",
      source_harvests: "46258-PNN-ID-062-0-NA-26007, 46258-PNN-ID-062-0-NA-26008",
      source_packages: "1A4050100000000000000B01",
      location: "Trim Room",
      item: "WIP - Placeholder - PNN - I",
      category: "Buds",
      quantity: 29220,
      uom: "g",
      lab_test_status: "NotSubmitted",
      finished_goods: 0,
      packaged_date: "2026-09-01",
      received_date: null,
    });
    // The lower-cased duplicate folds into the last row for that tag.
    expect(rows[1].tag).toBe("1A4050300000000000000A02");
    expect(rows[1].quantity).toBe(1235);
    expect(rows[1].received_date).toBe("2025-12-02");
    const summary = summarizePackages(rows);
    expect(summary.packages).toBe(2);
    expect((summary.by_category as Record<string, { count: number; quantity: number; uom: string }>)["Vape Cart"]).toEqual({ count: 1, quantity: 1235, uom: "ea" });
  });

  it("shapes plants and summarizes them", async () => {
    const rows = shapePlants(await readMetrcGrid(await plantsXlsx(0)));
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({
      tag: "1A4050000000000000000001",
      strain: "Bermuda Triangle",
      location: "West 3",
      sublocation: null,
      hold: 0,
      plant_batch: "Bermuda Triangle 5/27/2026 & Co",
      plant_batch_type: "Seed",
      plant_batch_date: "2026-05-27",
      phase_date: "2026-08-03",
      harvested: 0,
    });
    expect(rows[1].hold).toBe(1);
    const summary = summarizePlants(rows);
    expect(summary).toMatchObject({ plants: 2, strains: 1, locations: 2, holds: 1, harvested: 1 });
  });

  it("normalizes dates and booleans in every spelling", () => {
    expect(normalizeMetrcDate("9/1/2026 12:00:00 AM")).toBe("2026-09-01");
    expect(normalizeMetrcDate("2026-09-01T00:00:00")).toBe("2026-09-01");
    expect(normalizeMetrcDate("46169")).toBe("2026-05-27");
    expect(normalizeMetrcDate("")).toBeNull();
    expect(normalizeMetrcBool("True")).toBe(1);
    expect(normalizeMetrcBool("yes")).toBe(1);
    expect(normalizeMetrcBool("False")).toBe(0);
    expect(normalizeMetrcBool("")).toBe(0);
  });

  it("THE MIRROR LAW: added, updated (moved columns, gone returning, phase changed), unchanged, gone in the drop's own phase", () => {
    const cols = ["strain", "location"] as const;
    const incoming = [
      { tag: "T1", strain: "A", location: "Row 1" },
      { tag: "T2", strain: "A", location: "Row 9" },
      { tag: "T3", strain: "B", location: "GH 1" },
      { tag: "T5", strain: "C", location: "Barn" },
      { tag: "T6", strain: "C", location: "Barn" },
    ];
    const existing = [
      { tag: "T1", strain: "A", location: "Row 1", phase: "flowering", gone_at: null },
      { tag: "T2", strain: "A", location: "Row 2", phase: "flowering", gone_at: null },
      { tag: "T4", strain: "B", location: "GH 2", phase: "flowering", gone_at: null },
      { tag: "T5", strain: "C", location: "Barn", phase: "flowering", gone_at: "2026-09-01T00:00:00.000Z" },
      { tag: "T6", strain: "C", location: "Barn", phase: "vegetative", gone_at: null },
      { tag: "T7", strain: "D", location: "Barn", phase: "vegetative", gone_at: null },
    ];
    const diff = diffMount(incoming, existing, cols, { phase: "flowering" });
    expect(diff.added.map((r) => r.tag)).toEqual(["T3"]);
    expect(diff.updated.map((r) => r.tag).sort()).toEqual(["T2", "T5", "T6"]);
    expect(diff.unchanged).toBe(1);
    // T4 left the flowering file; T7 is vegetative and not this drop's to lose.
    expect(diff.gone).toEqual(["T4"]);
    const pkgDiff = diffMount(incoming.slice(0, 2), existing.slice(0, 3), cols, {});
    expect(pkgDiff.gone).toEqual(["T4"]);
    expect(pkgDiff.updated.map((r) => r.tag)).toEqual(["T2"]);
  });

  it("keeps every insert under D1's 100 bound parameters", () => {
    expect(rowsPerInsert(15)).toBe(6);
    expect(rowsPerInsert(26)).toBe(3);
    expect(rowsPerInsert(200)).toBe(1);
  });

  it("THE MIRROR LAW across our own licenses: a tag known under another license updates in place, never collides", () => {
    const cols = ["item", "location"] as const;
    const incoming = [{ tag: "P1", item: "BUD - Placeholder", location: "Barn" }];
    const existing = [{ tag: "P1", item: "BUD - Placeholder", location: "Barn", license_value: "AU-G-C-001509", gone_at: null }];
    const moved = diffMount(incoming, existing, cols, { license: "AU-G-C-000832" });
    expect(moved.added).toEqual([]);
    expect(moved.updated.map((r) => r.tag)).toEqual(["P1"]);
    const same = diffMount(incoming, existing, cols, { license: "AU-G-C-001509" });
    expect(same.unchanged).toBe(1);
  });
});

describe("THE SLICED MOUNT (canon 0.30.42): the streaming scan", () => {
  it("streams the grid header first and every row with its index, both formats", async () => {
    const seenHeaders: string[][] = [];
    const seenRows: Array<[number, string]> = [];
    const xlsx = await streamMetrcGrid(
      await plantsXlsx(8),
      (h) => seenHeaders.push(h),
      (cells, i) => seenRows.push([i, cells[0]])
    );
    expect(xlsx).toEqual({ header: [...METRC_PLANT_COLUMNS], format: "xlsx", total: 2 });
    expect(seenHeaders).toHaveLength(1);
    expect(seenRows).toEqual([
      [0, "1A4050000000000000000001"],
      [1, "1A4050000000000000000002"],
    ]);
    const csvRows: number[] = [];
    const csv = await streamMetrcGrid(new TextEncoder().encode(PACKAGES_CSV), () => undefined, (_cells, i) => csvRows.push(i));
    expect(csv.format).toBe("csv");
    expect(csv.total).toBe(3);
    expect(csvRows).toEqual([0, 1, 2]);
  });

  it("shapes one row at a time through the header's indexer", () => {
    const get = metrcIndexer(["tag", "Strain", "Location", "Hold", "Plant Batch", "Plant Batch Date", "Harvested"]);
    const row = shapePlantRow(get, ["1a4050000000000000000009", "Gelato", "GH 1", "true", "Gelato 8/3/2026", "8/3/2026", "False"]);
    expect(row).toMatchObject({ tag: "1A4050000000000000000009", strain: "Gelato", location: "GH 1", hold: 1, plant_batch_date: "2026-08-03", harvested: 0, sublocation: null });
    expect(shapePlantRow(get, ["", "Gelato", "GH 1", "", "", "", ""])).toBeNull();
    const pget = metrcIndexer([...METRC_PACKAGE_COLUMNS]);
    const pkg = shapePackageRow(pget, ["1A4050300000000000000A01", "", "", "", "", "Barn", "", "BUD - Placeholder", "Buds", "Placeholder", "1,234.5", "g", "", "", "TestPassed", "True", "False", "False", "9/1/2026 12:00:00 AM", "", "", ""]);
    expect(pkg).toMatchObject({ tag: "1A4050300000000000000A01", quantity: 1234.5, uom: "g", finished_goods: 1, admin_hold: 0, packaged_date: "2026-09-01" });
    expect(shapePackageRow(pget, new Array(22).fill(""))).toBeNull();
  });

  it("keeps only the window's rows, sees every tag and totals the whole file", async () => {
    const bytes = new TextEncoder().encode(PACKAGES_CSV);
    const first = await scanMetrcExport(bytes, 0, 1);
    expect(first.kind).toBe("packages");
    expect(first.format).toBe("csv");
    expect(first.total).toBe(3);
    expect([...first.seen].sort()).toEqual(["1A4050300000000000000A01", "1A4050300000000000000A02"]);
    expect(first.packages.map((r) => r.tag)).toEqual(["1A4050300000000000000A01"]);
    expect(first.plants).toEqual([]);
    // The summary totals every row, each tag once (the vape tag is listed twice).
    expect(first.summary).toMatchObject({ packages: 2, locations: 2 });
    const last = await scanMetrcExport(bytes, 1, 3);
    // Rows 1 and 2 share a tag; the window keeps the later row's quantity.
    expect(last.packages).toHaveLength(1);
    expect(last.packages[0]).toMatchObject({ tag: "1A4050300000000000000A02", quantity: 1235 });
    const beyond = await scanMetrcExport(bytes, 3, 5);
    expect(beyond.packages).toEqual([]);
    expect(beyond.total).toBe(3);
    const plants = await scanMetrcExport(await plantsXlsx(0), 1, 2);
    expect(plants.kind).toBe("plants");
    expect(plants.plants.map((r) => r.tag)).toEqual(["1A4050000000000000000002"]);
    expect(plants.seen.size).toBe(2);
    expect(plants.summary).toMatchObject({ plants: 2, holds: 1, harvested: 1 });
    await expect(scanMetrcExport(new TextEncoder().encode("Item ID,SKU\r\n1,x\r\n"), 0, 10)).rejects.toThrow(/not METRC's plants or packages export/);
  });

  it("the drop page carries the round size and the words the script speaks; an unfinished mount says so", () => {
    expect(METRC_SLICE_ROWS).toBe(5000);
    const html = metrcPane(
      {
        lines: [],
        mounts: [
          {
            id: "m2",
            kind: "plants",
            phase: "flowering",
            license_value: "GR-C-001132",
            filename: "MetrcMichiganGRC001132PlantsFlowering_2.xlsx",
            file_format: "xlsx",
            rows_total: 48149,
            rows_added: 15000,
            rows_updated: 0,
            rows_unchanged: 0,
            rows_gone: 0,
            summary: JSON.stringify({ mounting: true, rows_done: 15000 }),
            created_at: "2026-09-11T23:50:00.000Z",
          },
        ],
        cross: {
          ledger_tagged: 0,
          ledger_in_metrc: 0,
          ledger_gone_in_metrc: 0,
          ledger_unknown_to_metrc: 0,
          ledger_untagged: 0,
          metrc_active: 0,
          metrc_unclaimed: 0,
          zoho_tagged: 0,
          zoho_in_metrc: 0,
          zoho_not_in_metrc: 0,
          samples: { ledger_unknown: [], zoho_not_in_metrc: [] },
        },
        licenses: [],
        defs: [],
      },
      "en"
    );
    expect(html).toContain('data-slice-size="5000"');
    expect(html).toContain('data-text-progress="Mounting: {done} of {total} rows so far."');
    expect(html).toContain("data-metrc-progress");
    expect(html).toContain('body.set("slice", String(slice))');
    expect(html).toContain('body.set("mount_id", mountId)');
    expect(html).toContain("rounds of 5,000 rows");
    expect(html).toContain('data-metrc-unfinished>unfinished, 15,000 of 48,149 rows</span>');
    expect(mountRowsDone({ summary: "{}" })).toBeNull();
    expect(mountRowsDone({ summary: JSON.stringify({ plants: 3 }) })).toBeNull();
    expect(mountRowsDone({ summary: "not json" })).toBeNull();
    expect(mountRowsDone({ summary: JSON.stringify({ mounting: true, rows_done: 5000 }) })).toBe(5000);
    const es = metrcPane({ lines: [], mounts: [], cross: { ledger_tagged: 0, ledger_in_metrc: 0, ledger_gone_in_metrc: 0, ledger_unknown_to_metrc: 0, ledger_untagged: 0, metrc_active: 0, metrc_unclaimed: 0, zoho_tagged: 0, zoho_in_metrc: 0, zoho_not_in_metrc: 0, samples: { ledger_unknown: [], zoho_not_in_metrc: [] } }, licenses: [], defs: [] }, "es");
    expect(es).toContain('data-text-fail="El montaje se detuvo:"');
  });

  it("scopes internal fields by their Tone", () => {
    expect(fieldAppliesTo({ key: "quality", label: "Quality", applies_to: "packages", sort_order: 1 }, "package")).toBe(true);
    expect(fieldAppliesTo({ key: "quality", label: "Quality", applies_to: "packages", sort_order: 1 }, "plant")).toBe(false);
    expect(fieldAppliesTo({ key: "notes", label: "Notes", applies_to: null, sort_order: 1 }, "plant")).toBe(true);
    expect(fieldAppliesTo({ key: "notes", label: "Notes", applies_to: "both", sort_order: 1 }, "package")).toBe(true);
  });
});

describe("THE METRC MIRROR pane", () => {
  const base = {
    lines: [],
    mounts: [],
    cross: {
      ledger_tagged: 3,
      ledger_in_metrc: 2,
      ledger_gone_in_metrc: 0,
      ledger_unknown_to_metrc: 1,
      ledger_untagged: 7,
      metrc_active: 11742,
      metrc_unclaimed: 11740,
      zoho_tagged: 1015,
      zoho_in_metrc: 257,
      zoho_not_in_metrc: 758,
      samples: { ledger_unknown: ["1A4050300000000000000A09"], zoho_not_in_metrc: [] },
    },
    licenses: [{ value: "AU-G-C-000832", label: "PNN AU" }],
    defs: [
      { key: "quality", label: "Quality grade", applies_to: "packages", sort_order: 20 },
      { key: "notes", label: "Notes", applies_to: null, sort_order: 60 },
    ],
  };

  it("renders the empty state, the drop form and the three pictures", () => {
    const html = metrcPane(base, "en");
    expect(html).toContain("METRC Mirror");
    expect(html).toContain("data-metrc-empty");
    expect(html).toContain('data-metrc-mount-form');
    expect(html).toContain('enctype="multipart/form-data"');
    expect(html).toContain('name="file"');
    expect(html).toContain('<option value="AU-G-C-000832">PNN AU AU-G-C-000832</option>');
    expect(html).toContain('<option value="flowering">Flowering</option>');
    expect(html).toContain('data-cross="zoho_tagged">1015 (257 in METRC, 758 not in METRC)');
    expect(html).toContain('data-cross="metrc_active">11742 (11740 not claimed by the ledger)');
    expect(html).toContain("1A4050300000000000000A09");
  });

  it("renders the license lines, the mounts and the flash", () => {
    const html = metrcPane(
      {
        ...base,
        lines: [
          {
            license_value: "GR-C-001132",
            plants_flowering: 48149,
            plants_vegetative: 204,
            plants_other: 0,
            packages: 0,
            package_grams: 0,
            package_eaches: 0,
            newest_mount: "2026-09-11T20:00:00.000Z",
          },
        ],
        mounts: [
          {
            id: "m1",
            kind: "plants",
            phase: "flowering",
            license_value: "GR-C-001132",
            filename: "MetrcMichiganGRC001132PlantsFlowering_2.xlsx",
            file_format: "xlsx",
            rows_total: 48149,
            rows_added: 48149,
            rows_updated: 0,
            rows_unchanged: 0,
            rows_gone: 0,
            summary: "{}",
            created_at: "2026-09-11T20:00:00.000Z",
          },
        ],
        ok: "mounted",
        mounted: { kind: "plants", added: 48149, updated: 0, gone: 0 },
      },
      "en"
    );
    expect(html).toContain('data-metrc-license="GR-C-001132"');
    expect(html).toContain("<td>48,149</td>");
    expect(html).toContain('data-metrc-mount="m1"');
    expect(html).toContain("plants / Flowering");
    expect(html).toContain("48149 / 0 / 0 / 0");
    expect(html).toContain("Mounted: plants, 48149 added, 0 updated, 0 gone.");
  });

  it("renders a package record with METRC's own column names and our fields scoped to packages", () => {
    const html = metrcPane(
      {
        ...base,
        tag: "1A4050300000000000000A01",
        record: {
          kind: "package",
          row: {
            tag: "1A4050300000000000000A01",
            license_value: "AU-G-C-000832",
            source_harvests: "46258-PNN-ID-062-0-NA-26007",
            item: "WIP - Placeholder - PNN - I",
            category: "Buds",
            quantity: 29220,
            uom: "g",
            finished_goods: 0,
            admin_hold: 1,
            packaged_date: "2026-09-01",
            gone_at: null,
          },
        },
        values: [{ id: "v1", tag: "1A4050300000000000000A01", field_key: "quality", value: "A", updated_at: "2026-09-11T20:00:00.000Z" }],
      },
      "en"
    );
    expect(html).toContain('data-metrc-record="package"');
    expect(html).toContain("<dt>Source Harvest(s)</dt>");
    expect(html).toContain('data-metrc-field="quantity">29,220</dd>');
    expect(html).toContain('data-metrc-field="admin_hold">Yes</dd>');
    expect(html).toContain('data-metrc-field="finished_goods">No</dd>');
    expect(html).toContain('data-internal-field="quality"');
    expect(html).toContain('data-internal-field="notes"');
    expect(html).toContain('action="/inventory/metrc/field"');
    expect(html).toContain('name="value" value="A"');
    expect(html).toContain('name="reason" placeholder="reason" required');
    const plant = metrcPane({ ...base, tag: "1A1", record: { kind: "plant", row: { tag: "1A1", phase: "flowering", hold: 0 } } }, "en");
    expect(plant).toContain('data-metrc-record="plant"');
    expect(plant).toContain("<dt>Plant Batch</dt>");
    // Quality applies to packages only; notes applies to both.
    expect(plant).not.toContain('data-internal-field="quality"');
    expect(plant).toContain('data-internal-field="notes"');
    const unknown = metrcPane({ ...base, tag: "1A9", record: null }, "en");
    expect(unknown).toContain("data-metrc-unknown");
  });
});

describe("FG INVENTORY IN METRC (canon 0.30.43): the kinds", () => {
  it("reads the kind as the Item name's first word and folds METRC's units", () => {
    expect(metrcItemKind("BUD - Donny Burger - PNS - O")).toBe("BUD");
    expect(metrcItemKind("GRIP Vape - Elsewhere - 2g")).toBe("GRIP Vape");
    expect(metrcItemKind("Infused Pre-Rolls - Elsewhere - 1g x 5")).toBe("Infused Pre-Rolls");
    expect(metrcItemKind("Biomass")).toBe("Biomass");
    expect(metrcItemKind("  ")).toBe("(no item)");
    expect(metrcItemKind(null)).toBe("(no item)");
    expect(metrcUomKey("g")).toBe("g");
    expect(metrcUomKey("Grams")).toBe("g");
    expect(metrcUomKey("ea")).toBe("ea");
    expect(metrcUomKey("Each")).toBe("ea");
    expect(metrcUomKey("lb")).toBe("lb");
    expect(metrcUomKey(null)).toBe("(none)");
  });

  it("shapes grouped rows into kinds by unit, largest first, items under each, licenses and the newest mount", () => {
    const fg = shapeMetrcFg(
      [
        { license_value: "AU-G-C-000832", item: "GRIP Vape - Elsewhere - 2g", category: "Vape Cart", uom: "ea", n: 10595, q: 528439, not_passed: 13 },
        { license_value: "AU-G-C-000832", item: "MIX - Placeholder - PNS - O", category: "Buds", uom: "g", n: 100, q: 1000000.5, not_passed: 0 },
        { license_value: "GR-C-001405", item: "MIX - Placeholder - ARL - O", category: "Buds", uom: "g", n: 26, q: 686041.26, not_passed: 0 },
        { license_value: "AU-G-C-000832", item: "BUD - Placeholder - PNS - O", category: "Buds", uom: "g", n: 103, q: 707533.64, not_passed: 2 },
        { license_value: "AU-G-C-000832", item: "WIP - Placeholder - PNN - I", category: "Buds", uom: "g", n: 4, q: 123886, not_passed: 4 },
        { license_value: "AU-G-C-000832", item: "Mitten Extracts - Elsewhere", category: "Concentrate", uom: "lb", n: 1, q: 2, not_passed: 0 },
      ],
      [
        { license_value: "AU-G-C-000832", newest: "2026-09-12T00:29:07.199Z" },
        { license_value: "GR-C-001405", newest: "2026-09-12T00:28:07.379Z" },
        { license_value: "AU-P-000694", newest: "2026-09-11T20:00:00.000Z" },
      ]
    );
    expect(fg.packages).toBe(10829);
    expect(fg.grams.map((k) => k.kind)).toEqual(["MIX", "BUD", "WIP"]);
    expect(fg.grams[0]).toMatchObject({ kind: "MIX", uom: "g", packages: 126, quantity: 1686041.76, not_passed: 0, categories: ["Buds"] });
    expect(fg.grams[0].items.map((i) => i.item)).toEqual(["MIX - Placeholder - PNS - O", "MIX - Placeholder - ARL - O"]);
    expect(fg.grams[1]).toMatchObject({ kind: "BUD", packages: 103, not_passed: 2 });
    expect(fg.eaches).toHaveLength(1);
    expect(fg.eaches[0]).toMatchObject({ kind: "GRIP Vape", uom: "ea", packages: 10595, quantity: 528439, not_passed: 13, categories: ["Vape Cart"] });
    expect(fg.other).toHaveLength(1);
    expect(fg.other[0]).toMatchObject({ kind: "Mitten Extracts", uom: "lb", quantity: 2 });
    // Every license with packages or a mount, alphabetical; the processor has a mount and nothing held.
    expect(fg.licenses).toEqual([
      { license_value: "AU-G-C-000832", packages: 10803, newest_mount: "2026-09-12T00:29:07.199Z" },
      { license_value: "AU-P-000694", packages: 0, newest_mount: "2026-09-11T20:00:00.000Z" },
      { license_value: "GR-C-001405", packages: 26, newest_mount: "2026-09-12T00:28:07.379Z" },
    ]);
    expect(fg.newest_mount).toBe("2026-09-12T00:29:07.199Z");
    const bare = shapeMetrcFg([], []);
    expect(bare).toMatchObject({ grams: [], eaches: [], other: [], packages: 0, licenses: [], newest_mount: null });
  });
});

describe("THE TAG LAW (canon 0.30.38, forks F4 and F5)", () => {
  it("knows a tag's shape, normalizes it, and prints it in place of the internal code", () => {
    expect(isMetrcTag("1A4050300000000000000A01")).toBe(true);
    expect(isMetrcTag("1a4050300000000000000a01")).toBe(true);
    expect(isMetrcTag("26002")).toBe(false);
    expect(isMetrcTag("")).toBe(false);
    expect(isMetrcTag(null)).toBe(false);
    expect(normalizeMetrcTag(" 1a4050300000000000000a01 ")).toBe("1A4050300000000000000A01");
    expect(normalizeMetrcTag("tote 4")).toBe("tote 4");
    expect(normalizeMetrcTag("  ")).toBeNull();
    expect(metrcFacingTag({ metrc_tag: "1A4050300000000000000A01", package_code: "26002" })).toBe("1A4050300000000000000A01");
    expect(metrcFacingTag({ metrc_tag: null, package_code: "26002" })).toBe("26002");
    expect(metrcFacingTag({ package_code: "26002-B" })).toBe("26002-B");
    expect(lacksMetrcTag({ metrc_tag: null })).toBe(true);
    expect(lacksMetrcTag({ metrc_tag: "tote 4" })).toBe(true);
    expect(lacksMetrcTag({ metrc_tag: "1A4050300000000000000A01" })).toBe(false);
  });

  it("the finish mint carries the typed tag; a re-finish sets it only when typed", () => {
    const input = {
      wetWeightEntryId: "lot1",
      harvestBatchId: "b1",
      strainId: "s1",
      farmCode: "ARL",
      spaceKind: "hang",
      spaceName: "Room",
      wetTotal: 1000,
      hbn: "46258-ARL-GH-062-0-NA-26007",
      metrcHarvestTag: null,
      licenseValue: "GR-C-002600",
      materialForm: "spear",
    };
    const born = planFinishMint({ ...input, metrcTag: "1A4050300000000000000A01" }, null);
    expect(born).toMatchObject({ action: "insert", package_code: "26007", metrc_tag: "1A4050300000000000000A01" });
    const bare = planFinishMint(input, null);
    expect(bare).toMatchObject({ action: "insert", metrc_tag: null });
    expect(planFinishMint({ ...input, metrcTag: "1A4050300000000000000A02" }, { id: "i1" })).toEqual({
      action: "update",
      itemId: "i1",
      qty: 1000,
      metrc_tag: "1A4050300000000000000A02",
    });
    expect(planFinishMint(input, { id: "i1" })).toEqual({ action: "update", itemId: "i1", qty: 1000 });
  });

  it("the wet lot panel carries the optional tag box beside Finish lot", () => {
    const station = stationByKey("wet_weight")!;
    const html = wetLotPanel(
      station,
      { id: "lot1", hbn: "46258-ARL-GH-062-0-NA-26007", farm_code: "ARL", notes: null, dry_space_name: "Room", truck_number: null, lead_name: null },
      [],
      "Arlington",
      0,
      "en"
    );
    expect(html).toContain(metrcTagInput("en"));
    expect(html).toContain('name="metrc_tag"');
    expect(html).toContain("METRC package tag (optional)");
    expect(html.indexOf('name="metrc_tag"')).toBeLessThan(html.indexOf("Finish load</button>"));
  });

  it("the trim room says Package tag and marks a code that is not a tag; the cryo line IS the tag (THE CRYO RUN, canon 0.30.110)", () => {
    const people: PersonRow[] = [{ id: "p1", display_name: "Pat", is_active: 1 }];
    const trim = stationByKey("trim_packages")!;
    const queuesByKey: Record<string, QueueDef> = { unloaded_queue: queueByKey("unloaded_queue")! };
    const rows: QueueRow[] = [{ id: "lot1", values: { short_id: "26001", strain_name: "Placeholder", dry_weight_grams: "1000" } }];
    const html = stationPage(
      trim,
      people,
      "p1",
      { package_types: [{ value: "BUD", label: "BUD" }] },
      { unloaded_queue: rows },
      queuesByKey,
      "lot1",
      undefined,
      rows,
      "en",
      undefined,
      { original: 1000, recorded: 0, remaining: 1000 },
      undefined,
      false,
      {
        entered: [
          { id: "pk1", package_code: "1A4050300000000000000A01", package_type_code: "BUD", weight_grams: 500, status: "cryo_queue", trim_date: "2026-09-11", trim_operator: "Dana", created_at: "2026-09-11T00:00:00.000Z" },
          { id: "pk2", package_code: "tote 4", package_type_code: "BUD", weight_grams: 400, status: "cryo_queue", trim_date: "2026-09-11", trim_operator: "Dana", created_at: "2026-09-11T00:00:00.000Z" },
        ],
      }
    );
    expect(html).toContain("<th>Package tag</th>");
    expect(html).not.toContain("<th>Package code</th>");
    expect(html).toContain('name="package_code" class="metrc-tag-input"');
    // CRYO ONLY (canon 0.30.114; owner: "The go/no-go package dupe check needs
    // to be removed from Trim, that's a cryo phenomenon.  A package is Id'd by
    // its HBN until the cryo step."): the trim line carries no duplicate-tag
    // guard and its rows no data-entered-tag; the trim room is as it was.
    expect(html).toContain('data-package="pk1">');
    expect(html).toContain('data-package="pk2" data-tag-shape="off"');
    expect(html).not.toContain("data-dup-tag-warning");
    expect(html).not.toContain("data-entered-tag");
    expect(html).toContain("tag-shape-note");

    // THE CRYO RUN (canon 0.30.110; owner: "They scan a tag that attaches to
    // the weight"): a cryo line's package tag IS the new METRC package ID, so
    // the page carries no optional tag box; the line's tag input is required.
    const run = {
      id: "run-1",
      status: "scheduled",
      scheduled_at: "2026-09-17T12:00:00.000Z",
      completed_at: null,
      effective_date: "2026-09-17",
      harvest_batch_id: "hb1",
      hbn: "26260-PNN-GH-027-0-NA-26011",
      entry_date: "2026-09-17",
      farm_code: "PNN",
      strain_name: "Placeholder",
      containers: 2,
      in_grams: 900,
      outputs: 0,
      out_grams: 0,
    };
    const cryo = cryoStationPage({
      runs: [run],
      picked: { run, pool: { lines: [{ category_code: "BUD", type_codes: ["BUD"], in_grams: 900, out_grams: 0 }] }, outputs: [], categories: ["WPR", "BUD", "SHA"] },
      nowIso: "2026-09-17T12:00:00.000Z",
    });
    expect(cryo).not.toContain('name="metrc_tag"');
    expect(cryo).toContain('name="package_code" class="metrc-tag-input" placeholder="1A..."');
    expect(cryo).toContain("required data-metrc-tag");
  });

  it("the export home marks the files that would print an internal code", () => {
    const html = pendingUploadsPage(
      [],
      "en",
      [{ id: "s1", kind: "package_from_harvest", harvest_batch_id: "b1", hbn: "46258-PNN-ID-062-0-NA-26007", lot: "26007", seq: 1, newest_activity: "2026-09-11" }],
      [{ id: "r1", movement_id: "m1", filename: "receive.csv", newest_activity: "2026-09-11", harvest_batch_id: "b1" }],
      [
        { id: "m1", movement_kind: "interco", origin_license: "GR-C-002600", destination_license: "AU-G-C-001509", metrc_manifest_number: null, newest_activity: "2026-09-11", filename: "manifest_m1.csv" },
        { id: "m2", movement_kind: "interco", origin_license: "AU-G-C-001509", destination_license: "AU-G-C-000832", metrc_manifest_number: "0001234", newest_activity: "2026-09-11", filename: "manifest_m2.csv" },
      ],
      [],
      [],
      { movements: new Set(["m1"]), batches: new Set(["b1"]), parents: new Set() }
    );
    expect((html.match(/data-tag-missing/g) ?? []).length).toBe(3);
    expect(html).toContain("no METRC tag yet");
    const m2 = html.indexOf("0001234");
    expect(html.slice(m2, m2 + 200)).not.toContain("data-tag-missing");
  });
});

const EMPTY_CROSS = {
  ledger_tagged: 0,
  ledger_in_metrc: 0,
  ledger_gone_in_metrc: 0,
  ledger_unknown_to_metrc: 0,
  ledger_untagged: 0,
  metrc_active: 0,
  metrc_unclaimed: 0,
  zoho_tagged: 0,
  zoho_in_metrc: 0,
  zoho_not_in_metrc: 0,
  samples: { ledger_unknown: [] as string[], zoho_not_in_metrc: [] as string[] },
};

describe("THE MIRROR RELEASES THE QUEUE (canon 0.30.193)", () => {
  it("says the release on a packages flash, including zero, and not on plants", () => {
    const mounted = { kind: "packages", added: 3, updated: 0, gone: 0, released: 1, releasedPassed: 1, releasedFailed: 0 };
    const html = metrcPane({ lines: [], mounts: [], cross: EMPTY_CROSS, licenses: [], defs: [], ok: "mounted", mounted }, "en");
    expect(html).toContain("1 released from the Testing Queue by METRC (1 passed, 0 failed).");
    expect(html).toContain('data-metrc-released="1"');
    const zero = metrcPane(
      { lines: [], mounts: [], cross: EMPTY_CROSS, licenses: [], defs: [], ok: "mounted", mounted: { ...mounted, released: 0, releasedPassed: 0, releasedFailed: 0 } },
      "en"
    );
    expect(zero).toContain("0 released from the Testing Queue by METRC (0 passed, 0 failed).");
    const plants = metrcPane(
      { lines: [], mounts: [], cross: EMPTY_CROSS, licenses: [], defs: [], ok: "mounted", mounted: { kind: "plants", added: 1, updated: 0, gone: 0, released: 0, releasedPassed: 0, releasedFailed: 0 } },
      "en"
    );
    expect(plants).not.toContain("released from the Testing Queue");
    const es = metrcPane({ lines: [], mounts: [], cross: EMPTY_CROSS, licenses: [], defs: [], ok: "mounted", mounted }, "es");
    expect(es).toContain("1 liberados de la cola de pruebas por METRC (1 aprobados, 0 fallidos).");
  });

  it("releases the vocabulary, leaves the rest, and writes the actor and the reason", async () => {
    const { db, read, all } = await releaseMemory();
    const counts = await releaseTestedFromMirror(db, "person-1", "abcdef12-0000-4000-8000-000000000001", "2026-09-22T18:00:00.000Z");
    expect(counts).toEqual({ total: 5, passed: 3, failed: 2 });
    expect(read(`SELECT status, test_outcome FROM wip_packages WHERE id = 'p-pass'`)).toMatchObject({ status: "released", test_outcome: "passed" });
    expect(read(`SELECT status, test_outcome FROM wip_packages WHERE id = 'p-retest'`)).toMatchObject({ status: "released", test_outcome: "passed" });
    expect(read(`SELECT status, test_outcome FROM wip_packages WHERE id = 'p-fail'`)).toMatchObject({ status: "released", test_outcome: "failed" });
    expect(read(`SELECT status, test_outcome FROM wip_packages WHERE id = 'p-retest-fail'`)).toMatchObject({ status: "released", test_outcome: "failed" });
    expect(read(`SELECT status FROM wip_packages WHERE id = 'p-open'`)).toMatchObject({ status: "testing_queue" });
    expect(read(`SELECT status FROM wip_packages WHERE id = 'p-unknown'`)).toMatchObject({ status: "testing_queue" });
    expect(read(`SELECT status FROM wip_packages WHERE id = 'p-gone'`)).toMatchObject({ status: "testing_queue" });
    expect(read(`SELECT status, test_outcome FROM wip_packages WHERE id = 'p-already'`)).toMatchObject({ status: "released", test_outcome: "passed" });
    expect(read(`SELECT status, test_outcome FROM wip_packages WHERE id = 'p-ledger'`)).toMatchObject({ status: "released", test_outcome: "passed" });
    const logs = all(`SELECT field, old_value, new_value, actor_person_id, reason FROM record_change_log WHERE record_id = 'p-pass' ORDER BY field`);
    expect(logs).toEqual([
      { field: "status", old_value: "testing_queue", new_value: "released", actor_person_id: "person-1", reason: "metrc mirror: TestPassed (mount abcdef12)" },
      { field: "test_outcome", old_value: null, new_value: "passed", actor_person_id: "person-1", reason: "metrc mirror: TestPassed (mount abcdef12)" },
    ]);
    const again = await releaseTestedFromMirror(db, "person-1", "abcdef12-0000-4000-8000-000000000001", "2026-09-22T18:01:00.000Z");
    expect(again).toEqual({ total: 0, passed: 0, failed: 0 });
    expect(all(`SELECT id FROM record_change_log WHERE record_id = 'p-pass'`)).toHaveLength(2);
  });

  it("lists a passed WPR with no app row, by kind or by the category map, and resolves one hop", async () => {
    const { db } = await releaseMemory();
    const pane = await listMetrcAdoptions(db);
    const tags = pane.rows.map((row) => row.tag);
    expect(tags).toEqual(["1A4050300000000000000E02", "1A4050300000000000000E11"]);
    const direct = pane.rows.find((row) => row.tag === "1A4050300000000000000E11");
    expect(direct).toMatchObject({ kind: "WPR", grams: 40, harvest: "26260-PNN-GH-001-0-NA-26001", hbnId: "hb-1", strain: "Fruity Pebbles" });
    const mapped = pane.rows.find((row) => row.tag === "1A4050300000000000000E02");
    expect(mapped).toMatchObject({ kind: "SMALLS", grams: 1, harvest: "26260-PNN-GH-001-0-NA-26001", hbnId: "hb-1" });
    expect(tags).not.toContain("1A4050300000000000000E03");
    expect(tags).not.toContain("1A4050300000000000000E04");
    expect(tags).not.toContain("1A4050300000000000000E05");
    expect(tags).not.toContain("1A4050300000000000000E06");
    expect(tags).not.toContain("1A4050300000000000000E07");
    expect(tags).not.toContain("1A4050300000000000000E08");
    expect(tags).not.toContain("1A4050300000000000000E09");
    expect(tags).not.toContain("1A4050300000000000000E10");
  });
});

describe("THE HBN INHERITED (canon 0.30.196): Adopt mints from METRC's name", () => {
  const NEW = "46258-PNN-ID-062-0-NA-26007";

  it("mints a METRC-born batch and its strain, and the package inherits it with no lot", async () => {
    const m = await migratedDb();
    const person = seedPerson(m);
    seedMirror(m, { tag: "1A4050300000000000000F11", harvest: NEW });
    seedMirror(m, { tag: "1A4050300000000000000F12", harvest: NEW, grams: 200 });
    const before = await listMetrcAdoptions(m.db);
    expect(before.rows.map((row) => [row.tag, row.harvest, row.hbnId])).toEqual([
      ["1A4050300000000000000F11", NEW, null],
      ["1A4050300000000000000F12", NEW, null],
    ]);
    const done = await adoptFromMetrc(m.db, formOf({ tag: "1A4050300000000000000F11", person_id: person, q: "F11", effective_date: "2026-09-21", effective_pin: "21319" }));
    expect(done.redirect).toBe("/production/scheduling/prepack?ok=adopted&n=1&q=F11");
    const batch = m.get(`SELECT * FROM harvest_batches WHERE hbn = ?`, NEW);
    expect(batch).toMatchObject({
      born_from: "metrc",
      status: "open",
      farm_code: "PNN",
      grow_method_code: "ID",
      manicure: 0,
      planned_dryspc: null,
      harvest_year: 2026,
      lot_serial: 7,
      entry_date: "2026-09-15",
      license_value: "AU-P-000694",
      strain_id: "c62936c3-8401-4489-911d-316104d11bf5",
      market_strain: "Zebra Cake",
    });
    expect(m.get(`SELECT name, hbn_code FROM strains WHERE id = ?`, String(batch?.strain_id))).toEqual({ name: "Super Boof", hbn_code: "062" });
    expect(m.get(`SELECT COUNT(*) AS n FROM strains WHERE name = 'Zebra Cake'`)).toEqual({ n: 0 });
    const pkg = m.get(`SELECT * FROM wip_packages WHERE package_code = '1A4050300000000000000F11'`);
    expect(pkg).toMatchObject({
      harvest_batch_id: batch?.id,
      wet_weight_entry_id: null,
      source: "metrc",
      status: "released",
      test_outcome: "passed",
      weight_grams: 751,
      cryo_weight_grams: 751,
      package_type_code: "WPR",
    });
    expect(m.get(`SELECT harvest_batch_id, wet_weight_entry_id, strain_id, location, license_value, farm_code FROM local_inventory_items WHERE wip_package_id = ?`, String(pkg?.id))).toEqual({
      harvest_batch_id: batch?.id,
      wet_weight_entry_id: null,
      strain_id: batch?.strain_id,
      location: "Cryo 1",
      license_value: "AU-P-000694",
      farm_code: "PNN",
    });
    const reasons = m.all(`SELECT DISTINCT record_table FROM record_change_log WHERE reason = 'adopted from METRC' ORDER BY record_table`).map((row) => row.record_table);
    expect(reasons).toEqual(["harvest_batches", "local_inventory_items", "wip_packages"]);
    const scheduled = m.get(`SELECT stage, harvest_batch_id, status, effective_date, wip_package_id FROM production_schedules WHERE wip_package_id = ?`, String(pkg?.id));
    expect(scheduled).toMatchObject({ stage: "prepack", harvest_batch_id: batch?.id, status: "scheduled", effective_date: "2026-09-21", wip_package_id: pkg?.id });
    expect(m.get(`SELECT reason FROM record_change_log WHERE record_table = 'production_schedules' AND record_id = (SELECT id FROM production_schedules WHERE wip_package_id = ?) AND field = 'status'`, String(pkg?.id))?.reason).toBe("schedule");
    expect(m.all(`SELECT record_table FROM record_change_log WHERE reason = 'adopted from METRC' OR reason = 'scheduled' OR field = 'effective_date'`).map((row) => row.record_table).sort()).toEqual(
      expect.arrayContaining(["harvest_batches", "local_inventory_items", "production_schedules", "wip_packages"])
    );
    // The next stranger of that harvest inherits the batch now known; nothing new is minted.
    const after = await listMetrcAdoptions(m.db);
    expect(after.rows.map((row) => [row.tag, row.hbnId])).toEqual([["1A4050300000000000000F12", batch?.id]]);
    await adoptFromMetrc(m.db, formOf({ tag: "1A4050300000000000000F12", person_id: person }));
    expect(m.get(`SELECT COUNT(*) AS n FROM harvest_batches WHERE hbn = ?`, NEW)).toEqual({ n: 1 });
    expect(m.get(`SELECT COUNT(*) AS n FROM strains WHERE name = 'Zebra Cake'`)).toEqual({ n: 0 });
    expect(m.get(`SELECT strain_id FROM local_inventory_items WHERE metrc_tag = '1A4050300000000000000F12'`)).toEqual({ strain_id: "c62936c3-8401-4489-911d-316104d11bf5" });
    expect(m.get(`SELECT harvest_batch_id FROM wip_packages WHERE package_code = '1A4050300000000000000F12'`)).toEqual({ harvest_batch_id: batch?.id });
  });

  it("an HBN the app has keeps its strain and hangs the package on its trimmed lot", async () => {
    const m = await migratedDb();
    const person = seedPerson(m);
    seedBatch(m, { id: "hb-app", hbn: "26260-PNN-GH-001-0-NA-26011", serial: 11 });
    seedLot(m, "lot-drying", "hb-app", "drying");
    seedLot(m, "lot-trimmed", "hb-app", "trimmed");
    seedMirror(m, { tag: "1A4050300000000000000F21", harvest: "other-name, 26260-PNN-GH-001-0-NA-26011", strain: "Fruity Pebbles" });
    const pane = await listMetrcAdoptions(m.db);
    expect(pane.rows[0]).toMatchObject({ harvest: "26260-PNN-GH-001-0-NA-26011", hbnId: "hb-app" });
    await adoptFromMetrc(m.db, formOf({ tag: "1A4050300000000000000F21", person_id: person }));
    expect(m.get(`SELECT harvest_batch_id, wet_weight_entry_id FROM wip_packages WHERE package_code = '1A4050300000000000000F21'`)).toEqual({
      harvest_batch_id: "hb-app",
      wet_weight_entry_id: "lot-trimmed",
    });
    expect(m.get(`SELECT strain_id, market_strain FROM harvest_batches WHERE id = 'hb-app'`)).toEqual({
      strain_id: "98cf3164-344e-414a-9f1c-1526fde445ac",
      market_strain: null,
    });
    expect(m.get(`SELECT strain_id FROM local_inventory_items WHERE metrc_tag = '1A4050300000000000000F21'`)).toEqual({
      strain_id: "98cf3164-344e-414a-9f1c-1526fde445ac",
    });
    expect(m.get(`SELECT COUNT(*) AS n FROM harvest_batches`)).toEqual({ n: 1 });
  });

  it("refuses a code no live strain carries, and a code two strains carry, and inserts nothing", async () => {
    const m = await migratedDb();
    const person = seedPerson(m);
    const missing = "46299-PNN-ID-099-0-NA-26099";
    seedMirror(m, { tag: "1A4050300000000000000F91", harvest: missing, strain: "Mystery Market" });
    await expect(adoptFromMetrc(m.db, formOf({ tag: "1A4050300000000000000F91", person_id: person }))).rejects.toMatchObject({
      status: 400,
      message: `${missing} cannot be adopted: no strain carries code 099; add it in Admin, Lookups, Strains.`,
    });
    expect(m.get(`SELECT COUNT(*) AS n FROM harvest_batches`)).toEqual({ n: 0 });
    expect(m.get(`SELECT COUNT(*) AS n FROM wip_packages`)).toEqual({ n: 0 });
    expect(m.get(`SELECT COUNT(*) AS n FROM strains WHERE name = 'Mystery Market'`)).toEqual({ n: 0 });
    m.run(
      `INSERT INTO strains (id, name, abbr, hbn_code, created_at, updated_at) VALUES ('strain-twin', 'Twin Boof', 'TB', '062', '2026-09-23T00:00:00.000Z', '2026-09-23T00:00:00.000Z')`
    );
    seedMirror(m, { tag: "1A4050300000000000000F92", harvest: "46258-PNN-ID-062-0-NA-26008" });
    await expect(adoptFromMetrc(m.db, formOf({ tag: "1A4050300000000000000F92", person_id: person }))).rejects.toMatchObject({
      message: "46258-PNN-ID-062-0-NA-26008 cannot be adopted: code 062 belongs to Super Boof, Twin Boof; fix the codes in Admin, Lookups, Strains.",
    });
    expect(m.get(`SELECT COUNT(*) AS n FROM harvest_batches`)).toEqual({ n: 0 });
  });

  it("a blank METRC strain name inherits the real strain's name as the market strain", async () => {
    const m = await migratedDb();
    const person = seedPerson(m);
    seedMirror(m, { tag: "1A4050300000000000000F93", harvest: "46258-PNN-ID-062-0-NA-26006", strain: null, item: "WPR" });
    await adoptFromMetrc(m.db, formOf({ tag: "1A4050300000000000000F93", person_id: person }));
    expect(m.get(`SELECT strain_id, market_strain FROM harvest_batches WHERE hbn = '46258-PNN-ID-062-0-NA-26006'`)).toEqual({
      strain_id: "c62936c3-8401-4489-911d-316104d11bf5",
      market_strain: "Super Boof",
    });
  });

  it("a six-part name refuses in words and mints nothing; a lineage with no harvest has no Adopt", async () => {
    const m = await migratedDb();
    const person = seedPerson(m);
    seedMirror(m, { tag: "1A4050300000000000000F31", harvest: "46258-PNN-ID-062-0-26007" });
    seedMirror(m, { tag: "1A4050300000000000000F32", harvest: null });
    await expect(adoptFromMetrc(m.db, formOf({ tag: "1A4050300000000000000F31", person_id: person }))).rejects.toMatchObject({
      status: 400,
      message: "46258-PNN-ID-062-0-26007 is not a seven-part HBN, so nothing was minted.",
      words: { key: "{hbn} is not a seven-part HBN, so nothing was minted.", vars: { hbn: "46258-PNN-ID-062-0-26007" } },
    });
    const pane = await listMetrcAdoptions(m.db);
    expect(pane.rows.find((row) => row.tag === "1A4050300000000000000F32")).toMatchObject({ harvest: null, hbnId: null });
    await expect(adoptFromMetrc(m.db, formOf({ tag: "1A4050300000000000000F32", person_id: person }))).rejects.toMatchObject({
      status: 400,
      message: "No harvest in METRC's lineage, so that package cannot be adopted.",
    });
    expect(m.get(`SELECT COUNT(*) AS n FROM harvest_batches`)).toEqual({ n: 0 });
    expect(m.get(`SELECT COUNT(*) AS n FROM wip_packages`)).toEqual({ n: 0 });
  });

  it("the Spanish error page reads the refusal's own line with the harvest filled in", () => {
    const err = { message: "x", words: { key: "{hbn} is not a seven-part HBN, so nothing was minted.", vars: { hbn: "46258-PNN" } } };
    expect(refusalText("es", err)).toBe("46258-PNN no es un HBN de siete partes, asi que no se acuno nada.");
    expect(refusalText("en", err)).toBe("x");
    expect(refusalText("es", { message: "That package is not waiting to be adopted." })).toBe("Ese paquete no espera ser adoptado.");
  });
});

type ReleaseSqlite = {
  exec(sql: string): void;
  prepare(sql: string): {
    run(...args: Array<string | number | null>): unknown;
    get(...args: Array<string | number | null>): unknown;
    all(...args: Array<string | number | null>): unknown[];
  };
};

async function releaseMemory(): Promise<{
  db: D1Database;
  read: (sql: string, ...args: unknown[]) => unknown;
  all: (sql: string, ...args: unknown[]) => unknown[];
}> {
  const mod = (await import("node:" + "sqlite")) as { DatabaseSync: new (path: string) => ReleaseSqlite };
  const sqlite = new mod.DatabaseSync(":memory:");
  sqlite.exec(`
    CREATE TABLE app_config (key TEXT PRIMARY KEY, value TEXT NOT NULL, deleted_at TEXT);
    CREATE TABLE wip_packages (
      id TEXT PRIMARY KEY, wet_weight_entry_id TEXT, package_code TEXT, package_type_code TEXT,
      weight_grams NUMERIC, status TEXT, test_outcome TEXT, created_at TEXT, updated_at TEXT, updated_by TEXT, deleted_at TEXT
    );
    CREATE TABLE metrc_packages (
      tag TEXT PRIMARY KEY, license_value TEXT, source_harvests TEXT, source_packages TEXT, location TEXT,
      item TEXT, item_strain TEXT, quantity NUMERIC, uom TEXT, lab_test_status TEXT, packaged_date TEXT, gone_at TEXT
    );
    CREATE TABLE local_inventory_items (
      id TEXT PRIMARY KEY, metrc_tag TEXT, wip_package_id TEXT, deleted_at TEXT
    );
    CREATE TABLE record_change_log (
      id TEXT PRIMARY KEY, record_table TEXT, record_id TEXT, field TEXT, old_value TEXT, new_value TEXT,
      actor_person_id TEXT, reason TEXT, changed_at TEXT
    );
    CREATE TABLE harvest_batches (id TEXT PRIMARY KEY, hbn TEXT, deleted_at TEXT, created_at TEXT);
  `);
  const vocab = "TestPassed=passed;RetestPassed=passed;TestFailed=failed;RetestFailed=failed";
  sqlite.prepare(`INSERT INTO app_config (key, value, deleted_at) VALUES ('metrc_release_states', ?, NULL)`).run(vocab);
  sqlite.prepare(`INSERT INTO harvest_batches (id, hbn, deleted_at, created_at) VALUES ('hb-1', '26260-PNN-GH-001-0-NA-26001', NULL, '2026-09-22T00:00:00.000Z')`).run();
  const addPkg = (id: string, code: string, status: string, outcome: string | null) => {
    sqlite.prepare(`INSERT INTO wip_packages (id, wet_weight_entry_id, package_code, package_type_code, weight_grams, status, test_outcome, created_at, updated_at, deleted_at) VALUES (?, 'lot-1', ?, 'WPR', 10, ?, ?, '2026-09-22T00:00:00.000Z', '2026-09-22T00:00:00.000Z', NULL)`).run(id, code, status, outcome);
  };
  const addMirror = (tag: string, status: string, item: string, grams: number, uom: string, gone: string | null, harvest: string | null, sourcePkg: string | null) => {
    sqlite.prepare(`INSERT INTO metrc_packages (tag, license_value, source_harvests, source_packages, location, item, item_strain, quantity, uom, lab_test_status, gone_at) VALUES (?, 'AU-G-C-000832', ?, ?, 'Trim Room', ?, 'Fruity Pebbles', ?, ?, ?, ?)`).run(tag, harvest, sourcePkg, item, grams, uom, status, gone);
  };
  addPkg("p-pass", "1A4050300000000000000E01", "testing_queue", null);
  addMirror("1A4050300000000000000E01", "TestPassed", "WPR - Fruity Pebbles - ARL - O", 15, "g", null, "26260-PNN-GH-001-0-NA-26001", null);
  addPkg("p-retest", "1A4050300000000000000E12", "testing_queue", null);
  addMirror("1A4050300000000000000E12", "RetestPassed", "WPR - Fruity Pebbles - ARL - O", 8, "g", null, null, null);
  addPkg("p-fail", "1A4050300000000000000E13", "testing_queue", null);
  addMirror("1A4050300000000000000E13", "TestFailed", "WPR - Fruity Pebbles - ARL - O", 8, "g", null, null, null);
  addPkg("p-retest-fail", "1A4050300000000000000E14", "testing_queue", null);
  addMirror("1A4050300000000000000E14", "RetestFailed", "WPR - Fruity Pebbles - ARL - O", 8, "g", null, null, null);
  addPkg("p-open", "1A4050300000000000000E04", "testing_queue", null);
  addMirror("1A4050300000000000000E04", "NotSubmitted", "WPR - Fruity Pebbles - ARL - O", 8, "g", null, "26260-PNN-GH-001-0-NA-26001", null);
  addPkg("p-unknown", "1A4050300000000000000E05", "testing_queue", null);
  addMirror("1A4050300000000000000E05", "SubmittedForTesting", "WPR - Fruity Pebbles - ARL - O", 8, "g", null, null, null);
  addPkg("p-gone", "1A4050300000000000000E09", "testing_queue", null);
  addMirror("1A4050300000000000000E09", "TestPassed", "WPR - Fruity Pebbles - ARL - O", 8, "g", "2026-09-22T12:00:00.000Z", null, null);
  addPkg("p-already", "1A4050300000000000000E10", "released", "passed");
  addMirror("1A4050300000000000000E10", "TestPassed", "WPR - Fruity Pebbles - ARL - O", 8, "g", null, null, null);
  addPkg("p-ledger", "INTERNAL-CODE", "testing_queue", null);
  addMirror("1A4050300000000000000E15", "TestPassed", "WPR - Fruity Pebbles - ARL - O", 8, "g", null, null, null);
  sqlite.prepare(`INSERT INTO local_inventory_items (id, metrc_tag, wip_package_id, deleted_at) VALUES ('li-ledger', '1A4050300000000000000E15', 'p-ledger', NULL)`).run();
  addMirror("1A4050300000000000000E11", "TestPassed", "WPR - Fruity Pebbles - ARL - O", 40, "g", null, "26260-PNN-GH-001-0-NA-26001", null);
  addMirror("1A4050300000000000000E02", "TestPassed", "SMALLS - Fruity Pebbles - ARL - O", 0.5, "g", null, null, "1A4050300000000000000E01");
  addMirror("1A4050300000000000000E03", "TestPassed", "BUD - Fruity Pebbles - ARL - O", 10, "g", null, "26260-PNN-GH-001-0-NA-26001", null);
  addMirror("1A4050300000000000000E06", "TestPassed", "WPR - Fruity Pebbles - ARL - O", 0, "g", null, "26260-PNN-GH-001-0-NA-26001", null);
  addMirror("1A4050300000000000000E07", "TestPassed", "WPR - Fruity Pebbles - ARL - O", 10, "ea", null, "26260-PNN-GH-001-0-NA-26001", null);
  addMirror("1A4050300000000000000E08", "TestFailed", "WPR - Fruity Pebbles - ARL - O", 10, "g", null, "26260-PNN-GH-001-0-NA-26001", null);
  addPkg("p-taken", "1A4050300000000000000E16", "voided", null);
  addMirror("1A4050300000000000000E16", "TestPassed", "WPR - Fruity Pebbles - ARL - O", 10, "g", null, "26260-PNN-GH-001-0-NA-26001", null);
  const prepare = (sql: string) => {
    let args: unknown[] = [];
    const stmt = {
      bind(...next: unknown[]) {
        args = next;
        return stmt;
      },
      async run() {
        sqlite.prepare(sql).run(...(args as (string | number | null)[]));
        return { success: true };
      },
      async first<T>() {
        return (sqlite.prepare(sql).get(...(args as (string | number | null)[])) as T | undefined) ?? null;
      },
      async all<T>() {
        return { results: sqlite.prepare(sql).all(...(args as (string | number | null)[])) as T[] };
      },
    };
    return stmt;
  };
  const db = {
    prepare,
    async batch(stmts: Array<{ run: () => Promise<unknown> }>) {
      sqlite.exec("BEGIN");
      try {
        const out = [];
        for (const stmt of stmts) out.push(await stmt.run());
        sqlite.exec("COMMIT");
        return out;
      } catch (err) {
        sqlite.exec("ROLLBACK");
        throw err;
      }
    },
  };
  return {
    db: db as unknown as D1Database,
    read: (sql: string, ...args: unknown[]) => sqlite.prepare(sql).get(...(args as (string | number | null)[])),
    all: (sql: string, ...args: unknown[]) => sqlite.prepare(sql).all(...(args as (string | number | null)[])),
  };
}

describe("THE TWO BOOKS (canon 0.30.205): a historical lot is known, and >> inherits it", () => {
  it("mints nothing on >> and keeps the sheet's strain and market strain", async () => {
    const m = await migratedDb();
    const person = seedPerson(m);
    seedMirror(m, { tag: FIXTURE_ALIAS_TAG, harvest: FIXTURE_ALIAS_METRC, grams: 33, strain: "Sheet Apple" });
    const run = await landSheetWorkbook(
      m.db,
      sheetWorkbook("2026-09-21", [
        {
          Date: "2026-08-24",
          "METRC Harvest Tag": "1A4050300000000000000537",
          "Harvest Batch Name": fixtureAliasSheetHbn(),
          Farm: "PNN",
          "Grow Method": "Indoor",
          Strain: "Fruity Pebbles",
          "Market Strain": "Sheet Apple",
          "Manicure?": "No",
        },
      ]),
      "upload"
    );
    expect(run.status).toBe("ok");
    const before = await listMetrcAdoptions(m.db);
    const row = before.rows.find((item) => item.tag === FIXTURE_ALIAS_TAG);
    expect(row).toMatchObject({ harvest: FIXTURE_ALIAS_METRC, strain: "Sheet Apple" });
    expect(row?.hbnId).toBeTruthy();
    const count = m.get(`SELECT COUNT(*) AS n FROM harvest_batches`);
    const done = await adoptFromMetrc(m.db, formOf({ tag: FIXTURE_ALIAS_TAG, person_id: person, effective_date: "2026-09-21", effective_pin: "21319" }));
    expect(done.redirect).toContain("ok=adopted");
    expect(m.get(`SELECT COUNT(*) AS n FROM harvest_batches`)).toEqual(count);
    const batch = m.get(`SELECT id, strain_id, market_strain, born_from FROM harvest_batches WHERE hbn = ?`, FIXTURE_ALIAS_METRC);
    expect(batch).toMatchObject({
      strain_id: "c96d7e99-49a3-4813-9654-4f02796d8020",
      market_strain: "Sheet Apple",
      born_from: "sheet",
    });
    const pkg = m.get(`SELECT id, harvest_batch_id FROM wip_packages WHERE package_code = ?`, FIXTURE_ALIAS_TAG);
    expect(pkg).toMatchObject({ harvest_batch_id: batch?.id });
    expect(m.get(`SELECT strain_id FROM local_inventory_items WHERE wip_package_id = ?`, String(pkg?.id))).toEqual({
      strain_id: "c96d7e99-49a3-4813-9654-4f02796d8020",
    });
    expect(m.get(`SELECT COUNT(*) AS n FROM harvest_batches WHERE hbn = ?`, fixtureAliasSheetHbn())).toEqual({ n: 0 });
  });
});
