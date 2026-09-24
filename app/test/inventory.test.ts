import { describe, expect, it } from "vitest";
import { projectedDryYieldPct } from "../src/config";
import {
  buildInventorySheet,
  emptyInventorySheet,
  firstTimeFailRatePct,
  formatElapsedNdNh,
  inventorySheetCsv,
  inventorySheetRows,
  NO_LAB_RECORDED,
  paretoFromOutcomes,
  parseFgMenu,
  projectedDryGrams,
  recallPrefillFromBatch,
  recallPrefillFromQuery,
  recallRedirectPath,
  type RecallableBatch,
} from "../src/inventory";
import { inventoryPage, inventoryReservedPage } from "../src/html";
import { shapeMetrcFg } from "../src/metrc";

const now = "2026-09-01T12:00:00.000Z";

const spaces = [
  { id: "s1", name: "Silo 1", kind: "silo" },
  { id: "s6", name: "Arlington Dry Room", kind: "hang" },
  { id: "s7", name: "Hang in Place", kind: "hang" },
];

function sheetFixture() {
  return buildInventorySheet({
    yieldPct: 22,
    nowIso: now,
    spaces,
    dryingLots: [
      {
        dry_space_id: "s1",
        short_id: "26001",
        strain_name: "Fruity Pebbles",
        weight_grams: 1234.56,
        updated_at: "2026-08-31T07:00:00.000Z",
      },
      {
        dry_space_id: "s1",
        short_id: "26002",
        strain_name: "Gelato",
        weight_grams: 200,
        updated_at: "2026-09-01T10:00:00.000Z",
      },
    ],
    unloadedLots: [
      {
        short_id: "26003",
        strain_name: "Fruity Pebbles",
        space_name: "Silo 2",
        dry_weight_grams: 751,
      },
    ],
    extractionPackages: [
      { package_code: "TRIM-1", short_id: "26003", strain_name: "Fruity Pebbles", weight_grams: 20.5 },
    ],
    livePackages: [
      { package_code: "TRIM-1", short_id: "26003", strain_name: "Fruity Pebbles", weight_grams: 20.5 },
      { package_code: "BUD-1", short_id: "26003", strain_name: "Fruity Pebbles", weight_grams: 100 },
      { package_code: "BUD-2", short_id: "26003", strain_name: "Fruity Pebbles", weight_grams: 50 },
    ],
    cryoPackages: [
      { package_code: "BUD-2", short_id: "26003", strain_name: "Fruity Pebbles", weight_grams: 50 },
    ],
    testingPackages: [
      { package_code: "BUD-1", short_id: "26003", strain_name: "Fruity Pebbles", weight_grams: 100 },
    ],
    outcomes: [{ test_outcome: "failed" }, { test_outcome: "passed" }, { test_outcome: "failed" }],
    // FG INVENTORY IN METRC (canon 0.30.43): the mirror's active packages,
    // grouped rows as the reader hands them, shaped by item kind.
    fg: shapeMetrcFg(
      [
        { license_value: "AU-G-C-000832", item: "PRE - Fruity Pebbles - PNS - O - 19%", category: "Buds (prepackaged)", uom: "ea", n: 1, q: 80, not_passed: 0 },
        { license_value: "AU-G-C-000832", item: "PRE - Fruity Pebbles - ARL - O - 18%", category: "Buds (prepackaged)", uom: "ea", n: 1, q: 80, not_passed: 0 },
        { license_value: "AU-G-C-000832", item: "BUD - Gelato - PNS - O", category: "Buds", uom: "g", n: 1, q: 12.5, not_passed: 1 },
        { license_value: "GR-C-001405", item: "MIX - Gelato - ARL - O", category: "Buds", uom: "g", n: 3, q: 1000, not_passed: 0 },
      ],
      [{ license_value: "AU-G-C-000832", newest: "2026-09-12T00:29:07.199Z" }]
    ),
  });
}

describe("projected dry yield (canon L-4, seed 22 needs owner ratification)", () => {
  it("reads the stored percent", () => {
    expect(projectedDryYieldPct("22")).toBe(22);
    expect(projectedDryYieldPct("18.5")).toBe(18.5);
    expect(projectedDryYieldPct("0")).toBe(0);
  });

  it("falls back to 22 on a missing, blank, or malformed value", () => {
    expect(projectedDryYieldPct(null)).toBe(22);
    expect(projectedDryYieldPct("")).toBe(22);
    expect(projectedDryYieldPct("   ")).toBe(22);
    expect(projectedDryYieldPct("abc")).toBe(22);
    expect(projectedDryYieldPct("-5")).toBe(22);
  });

  it("projects wet grams times the ratio, cent-exact", () => {
    expect(projectedDryGrams(1234.56, 22)).toBe(271.6);
    expect(projectedDryGrams(200, 22)).toBe(44);
    expect(projectedDryGrams(100, 0)).toBe(0);
  });
});

describe("elapsed Nd Nh (status-flip approximation)", () => {
  it("renders days and leftover hours", () => {
    expect(formatElapsedNdNh("2026-08-31T07:00:00.000Z", "2026-09-01T12:00:00.000Z")).toBe("1d 5h");
    expect(formatElapsedNdNh("2026-09-01T10:00:00.000Z", "2026-09-01T12:00:00.000Z")).toBe("0d 2h");
    expect(formatElapsedNdNh("2026-09-01T12:00:00.000Z", "2026-09-01T12:00:00.000Z")).toBe("0d 0h");
  });

  it("returns 0d 0h on a bad or inverted clock", () => {
    expect(formatElapsedNdNh("nope", now)).toBe("0d 0h");
    expect(formatElapsedNdNh(now, "2026-08-01T00:00:00.000Z")).toBe("0d 0h");
  });
});

describe("sheet mappings (fixture-driven)", () => {
  const sheet = sheetFixture();

  it("stacks two lots on Silo 1 and leaves hang rooms empty", () => {
    expect(sheet.dryingSpaces).toHaveLength(3);
    expect(sheet.dryingSpaces[0].name).toBe("Silo 1");
    expect(sheet.dryingSpaces[0].lots).toHaveLength(2);
    expect(sheet.dryingSpaces[0].lots[0].short_id).toBe("26001");
    expect(sheet.dryingSpaces[0].lots[0].elapsed).toBe("1d 5h");
    expect(sheet.dryingSpaces[0].lots[0].projected_grams).toBe(271.6);
    expect(sheet.dryingSpaces[1].lots).toEqual([]);
    expect(sheet.dryingSpaces[2].lots).toEqual([]);
  });

  it("sums wet drying and projected drying from the same lots", () => {
    expect(sheet.wetDrying.grams).toBe(1434.56);
    expect(sheet.projectedDrying.grams).toBe(315.6);
    expect(sheet.wetDrying.lotLines).toHaveLength(2);
  });

  it("maps waiting to trim from unloaded dry totals", () => {
    expect(sheet.waitingTrim.grams).toBe(751);
    expect(sheet.waitingTrim.lotLines[0].short_id).toBe("26003");
  });

  it("flags pasteurization as awaiting, with no invented grams", () => {
    expect(sheet.waitingPasteurize.awaiting).toBe(true);
    expect(sheet.waitingPasteurize.grams).toBe(0);
    expect(sheet.waitingPasteurize.lotLines).toEqual([]);
    expect(sheet.waitingPasteurize.note).toBe("OWNER MAPPING NEEDED");
  });

  it("maps extraction from the ruled codes with no provisional note (owner ruling 2026-09-01)", () => {
    expect(sheet.waitingExtraction.grams).toBe(20.5);
    expect(sheet.waitingExtraction.note).toBeUndefined();
    expect(sheet.waitingExtraction.pkgLines[0].package_code).toBe("TRIM-1");
  });

  it("sums total dry as unloaded plus live packages", () => {
    expect(sheet.totalDry.grams).toBe(921.5);
    expect(sheet.totalDry.lotLines).toHaveLength(1);
    expect(sheet.totalDry.pkgLines).toHaveLength(3);
  });

  it("maps representative testing weights from cryo and testing queues", () => {
    expect(sheet.scheduledTesting.grams).toBe(50);
    expect(sheet.inTesting.grams).toBe(100);
  });

  it("builds the pareto from real outcomes, grouped as (no lab recorded)", () => {
    expect(sheet.pareto.map((b) => [b.outcome, b.count])).toEqual([
      ["failed", 2],
      ["passed", 1],
    ]);
    expect(sheet.pareto[0].label).toContain(NO_LAB_RECORDED);
    expect(sheet.failRatePct).toBe(66.67);
  });
});

describe("extraction pool (owner ruling 2026-09-01: Trim and BIO only)", () => {
  // The SQL filter (extractionBoundSql) keys on package_type_code IN the
  // configured list, so only TRIM and BIO rows reach the builder's
  // extractionPackages input; SMALLS and WASTE stay out even though their
  // is_bud = 0, while every created package still counts as live.
  const trim = { package_code: "TRIM-9", short_id: "26009", strain_name: "Gelato", weight_grams: 10 };
  const bio = { package_code: "BIO-9", short_id: "26009", strain_name: "Gelato", weight_grams: 5.5 };
  const smalls = { package_code: "SMALLS-9", short_id: "26009", strain_name: "Gelato", weight_grams: 7 };
  const waste = { package_code: "WASTE-9", short_id: "26009", strain_name: "Gelato", weight_grams: 3 };

  it("counts TRIM and BIO; SMALLS and WASTE stay live but never extraction-bound", () => {
    const sheet = buildInventorySheet({
      yieldPct: 22,
      nowIso: now,
      spaces: [],
      dryingLots: [],
      unloadedLots: [],
      extractionPackages: [trim, bio],
      livePackages: [trim, bio, smalls, waste],
      cryoPackages: [],
      testingPackages: [],
      outcomes: [],
      fg: null,
    });
    expect(sheet.waitingExtraction.grams).toBe(15.5);
    expect(sheet.waitingExtraction.pkgLines.map((p) => p.package_code)).toEqual([
      "TRIM-9",
      "BIO-9",
    ]);
    expect(sheet.waitingExtraction.note).toBeUndefined();
    expect(sheet.totalDry.grams).toBe(25.5);
  });
});

describe("empty and missing-data states", () => {
  it("an empty sheet carries zero totals and a null FG", () => {
    const empty = emptyInventorySheet(22);
    expect(empty.wetDrying.grams).toBe(0);
    expect(empty.fg).toBeNull();
    expect(empty.pareto).toEqual([]);
    expect(empty.failRatePct).toBeNull();
    expect(empty.waitingPasteurize.awaiting).toBe(true);
    // Owner ruling 2026-09-01: the ruled extraction row carries no note.
    expect(empty.waitingExtraction.note).toBeUndefined();
  });

  it("parseFgMenu returns null on garbage and missing objects", () => {
    expect(parseFgMenu("not-json")).toBeNull();
    expect(parseFgMenu("null")).toBeNull();
    expect(parseFgMenu("[]")).toBeNull();
  });

  it("parseFgMenu still returns ages when lines are missing", () => {
    const fg = parseFgMenu(
      JSON.stringify({ dataAsOf: "2026-08-06T00:00:00.000Z", builtAt: "2026-08-11T17:58:11.229Z" })
    );
    expect(fg?.dataAsOf).toBe("2026-08-06T00:00:00.000Z");
    expect(fg?.builtAt).toBe("2026-08-11T17:58:11.229Z");
    expect(fg?.types).toHaveLength(10);
    expect(fg?.types.every((row) => row.stock === 0 && row.items.length === 0)).toBe(true);
  });

  it("keeps TRI in the type list even when the snapshot has none", () => {
    const fg = parseFgMenu(
      JSON.stringify({
        dataAsOf: "x",
        builtAt: "y",
        lines: [{ type: "PRE", label: "A", available: 1, pkgs: [{ name: "A", stock: 1 }] }],
      })
    );
    expect(fg?.types.map((row) => row.type)).toEqual([
      "PRE",
      "BUD",
      "MIX",
      "SHA",
      "MOB",
      "NUG",
      "TRI",
      "WBP",
      "VAPE",
      "IPR",
    ]);
    expect(fg?.types.find((row) => row.type === "TRI")?.stock).toBe(0);
  });
});

describe("pareto and fail rate", () => {
  it("drops blank outcomes and fabricates no bars", () => {
    expect(paretoFromOutcomes([])).toEqual([]);
    expect(paretoFromOutcomes([{ test_outcome: "" }, { test_outcome: "   " }])).toEqual([]);
    expect(firstTimeFailRatePct([])).toBeNull();
  });
});

describe("inventory CSV (Box Contract report out)", () => {
  it("emits section, row, raw grams; pasteurization grams stay blank", () => {
    const rows = inventorySheetRows(sheetFixture());
    expect(rows[0]).toEqual({
      section: "drying",
      row: "Total Wet Weight drying",
      grams: "1,435",
    });
    expect(rows.find((r) => r.row.startsWith("Waiting to be pasteurized"))?.grams).toBe("");
    expect(rows.find((r) => r.row === "Total Dry weight in inventory")?.grams).toBe("922");
    // FG INVENTORY IN METRC: grams kinds under fg, eaches under fg_each.
    expect(rows.find((r) => r.section === "fg" && r.row === "MIX")?.grams).toBe("1,000");
    expect(rows.find((r) => r.section === "fg" && r.row === "BUD")?.grams).toBe("13");
    expect(rows.find((r) => r.section === "fg_each" && r.row === "PRE")?.grams).toBe("160");
    expect(rows.find((r) => r.section === "fg" && r.row === "PRE")).toBeUndefined();
    const csv = inventorySheetCsv(sheetFixture());
    expect(csv.startsWith("section,row,grams\r\n")).toBe(true);
    expect(csv).not.toContain("1,434.56");
  });
});

describe("inventory page render", () => {
  it("puts the four buttons first and respects collapse defaults", () => {
    const html = inventoryPage(sheetFixture());
    expect(html.indexOf("Change Locations")).toBeLessThan(html.indexOf("WIP Inventory"));
    expect(html).toContain('href="/inventory/change-locations"');
    expect(html).toContain('href="/inventory/zoho-upload"');
    expect(html).toContain('href="/inventory/physical-audit"');
    expect(html).toContain('href="/inventory/location-audit"');
    expect(html).toContain('data-inv-section="wip">');
    expect(html).not.toContain('data-inv-section="wip" open');
    expect(html).toContain('data-inv-section="drying">');
    expect(html).not.toContain('data-inv-section="drying" open');
    expect(html).toContain('data-inv-section="fg" open');
  });

  it("renders gauges, formatGrams totals, empty hang rooms, and the yield note", () => {
    const html = inventoryPage(sheetFixture());
    expect(html).toContain("Silo 1");
    expect(html).toContain("26001");
    expect(html).toContain("1d 5h");
    expect(html).toContain("272");
    expect(html).toContain("Arlington Dry Room");
    expect(html).toContain("empty");
    expect(html).toContain('class="inv-gauge inv-gauge-hang"');
    expect(html).toContain('data-grams="1,434.56"'.replace("1,434.56", "1434.56"));
    expect(html).toContain(">1,435</span>");
    expect(html).toContain("(22%");
    // Owner ruling 2026-09-01: the yield's home is Admin, Lookups now.
    expect(html).toContain("of wet, editable in Admin, Lookups");
    expect(html).not.toContain("app_config");
    expect(html).toContain("OWNER MAPPING NEEDED");
    expect(html).toContain("awaiting pipeline stage");
    // Owner ruling 2026-09-01: the extraction mapping is ruled, note gone.
    expect(html).not.toContain("PROVISIONAL");
    expect(html).toContain("lab capture awaits the owner");
    // FG INVENTORY IN METRC (canon 0.30.43): the pane is the mirror's, by kind.
    expect(html).toContain("FG Inventory in METRC");
    expect(html).toContain('data-fg-type="PRE" data-fg-uom="ea"');
    expect(html).toContain('data-fg-type="MIX" data-fg-uom="g"');
    expect(html).toContain("PRE - Fruity Pebbles - PNS - O - 19%");
    expect(html).toContain("From the METRC mirror: 6 active packages. Newest packages mount 2026-09-12T00:29:07.199Z.");
    expect(html).toContain('data-inv-fg-license="AU-G-C-000832"><code>AU-G-C-000832</code> 3 packages, mounted 2026-09-12T00:29:07.199Z');
    expect(html).toContain('data-inv-fg-license="GR-C-001405"><code>GR-C-001405</code> 3 packages</span>');
    expect(html).toContain("By weight");
    expect(html).toContain("By count");
    expect(html).not.toContain("Other units");
    // Grams scale against grams: MIX is the full bar, BUD the 2% floor.
    expect(html).toMatch(/data-fg-type="MIX"[\s\S]*?style="width:100%"/);
    expect(html).toMatch(/data-fg-type="BUD"[\s\S]*?style="width:2%"/);
    expect(html).toContain('<span class="inv-fg-stock">1,000 <span class="muted inv-fg-unit">g</span></span>');
    expect(html).toContain('<span class="inv-fg-stock">160 <span class="muted inv-fg-unit">ea</span></span>');
    expect(html).toContain("1 package; Buds; 1 not test-passed");
    expect(html).toContain("2 packages; Buds (prepackaged)");
    expect(html).not.toContain("inventory in Zoho");
    expect(html).not.toContain("2026-08-11 static");
    expect(html).toContain('href="/export/inventory.csv"');
  });

  it("says so when no packages export has been mounted, with the way to the mirror", () => {
    const html = inventoryPage(emptyInventorySheet());
    expect(html).toContain("No METRC packages export mounted yet.");
    expect(html).toContain('data-inv-fg="missing"');
    expect(html).toContain('<a href="/inventory/metrc">Drop the Packages export on the METRC Mirror.</a>');
    expect(html).not.toContain("Zoho data unavailable");
    expect(html).toContain("No rows.");
  });

  it("an empty mirror after a mount says the mirror holds no active packages", () => {
    const sheet = { ...emptyInventorySheet(), fg: shapeMetrcFg([], [{ license_value: "AU-G-C-000832", newest: "2026-09-12T01:00:00.000Z" }]) };
    const html = inventoryPage(sheet);
    expect(html).toContain('data-inv-fg="empty"');
    expect(html).toContain("From the METRC mirror: 0 active packages. Newest packages mount 2026-09-12T01:00:00.000Z.");
  });

  it("translates the chrome in es and keeps stored ids untouched", () => {
    const es = inventoryPage(sheetFixture(), "es");
    expect(es).toContain("Inventario");
    expect(es).toContain("Inventario en proceso");
    expect(es).toContain("Inventario de producto terminado");
    expect(es).toContain("Silo 1");
    expect(es).toContain("26001");
    expect(es).toContain("Fruity Pebbles");
  });
});

describe("reserved button pages", () => {
  it("names each future CSV and does not invent a workflow", () => {
    // Canon 0.30.40: Change Locations is built (locationpane.ts); the other
    // three stay reserved.
    const zoho = inventoryReservedPage("zoho-upload");
    expect(zoho).toContain("Upload Inventory to Zoho");
    expect(zoho).toContain("Reserved. Awaiting the owner's talk-through.");
    expect(inventoryReservedPage("zoho-upload")).toContain(
      "Future interface: a Zoho items/adjustments CSV."
    );
    expect(inventoryReservedPage("physical-audit")).toContain(
      "Future interface: a reconciliation report."
    );
    expect(inventoryReservedPage("location-audit")).toContain(
      "Future interface: a reconciliation report."
    );
  });
});

describe("recall prefill", () => {
  const batch: RecallableBatch = {
    id: "hb9",
    hbn: "26244-ARL-GH-027-0-NA-26003",
    entry_date: "2026-09-01",
    farm_code: "ARL",
    grow_method_code: "GH",
    strain_id: "st1",
    manicure: 1,
    planned_dryspc: "5",
    start_time: "07:00",
    zone: "A",
    rows_text: "1-4",
    metrc_harvest_tag: "1A4TAG",
  };

  it("restores the stored field values and builds the redirect", () => {
    const prefill = recallPrefillFromBatch(batch);
    expect(prefill.entry_date).toBe("2026-09-01");
    expect(prefill.farm_code).toBe("ARL");
    expect(prefill.manicure).toBe("1");
    expect(prefill.metrc_harvest_tag).toBe("1A4TAG");
    const path = recallRedirectPath(prefill);
    expect(path.startsWith("/station/acquire_hbn?")).toBe(true);
    expect(path).toContain("ok=recalled");
    expect(path).toContain("entry_date=2026-09-01");
    const back = recallPrefillFromQuery(new URL("https://x.example" + path).searchParams);
    expect(back.strain_id).toBe("st1");
    expect(back.zone).toBe("A");
  });

  it("omits blank optional fields", () => {
    const prefill = recallPrefillFromBatch({
      ...batch,
      planned_dryspc: null,
      start_time: null,
      zone: null,
      rows_text: null,
      metrc_harvest_tag: null,
      manicure: 0,
    });
    expect(prefill.planned_dryspc).toBeUndefined();
    expect(prefill.manicure).toBe("0");
  });
});
