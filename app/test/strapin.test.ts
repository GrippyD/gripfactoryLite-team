import { describe, expect, it } from "vitest";
import { LOOKUP_BACKED_FIELDS, LOOKUP_LANDING, LOOKUP_VALUE_SECTIONS, helpHasLookupPath } from "../src/lookups";
import { EDITABLE_FIELDS, PIPELINE, queueByKey, stationByKey } from "../src/pipeline";
import {
  computeTatGroups,
  inventoryFgEmptyCopy,
  reportCsv,
  salesOrdersEmptyCopy,
  statusLogsForSpans,
  TAT_METRICS,
  bodyColumns,
  inventoryByLocationView,
  reportPdfHtml,
} from "../src/reports";
import { MANIFEST_COLUMNS, T3_MANIFEST_HEADER, manifestCsv } from "../src/interco";
import {
  mintKindForSpace,
  receiveMintKind,
  outboundEligible,
  planFinishMint,
  planUnloadFinish,
  sortInventoryItems,
  virtualMoveLanding,
} from "../src/ledger";
import { buildXlsx, xlsxHasParts } from "../src/xlsx";
import { ITEM_KIND_WET, isTime24, materialAtNorth } from "../src/config";
import { foldWetLotsIntoLocationRows, siteForLocation } from "../src/db";
import { METRC_PACKAGE_ADJUSTMENTS_HEADER, METRC_PACKAGES_FROM_HARVESTS_HEADER } from "../src/csv";
import { lookupsLandingPage } from "../src/pages";
import { reportPage, reportsPage } from "../src/html";

describe("lookup_values seeds and landing", () => {
  it("declares the landing categories and generic value sections", () => {
    expect(LOOKUP_LANDING.map((s) => s.category)).toEqual([
      "Harvest Operations",
      "Production Operations",
      "Logistics",
      "People and System",
      "Business Operations",
      "Marketplace",
      // THE METRC MIRROR (canon 0.30.38, fork F1): the internal field registry.
      "Inventory",
    ]);
    expect(LOOKUP_VALUE_SECTIONS.internal_fields.category).toBe("internal_field");
    expect(LOOKUP_VALUE_SECTIONS.internal_fields.title).toBe("Internal fields");
    expect(LOOKUP_VALUE_SECTIONS.listing_categories.category).toBe("listing_category");
    expect(LOOKUP_VALUE_SECTIONS.listing_categories.title).toBe("Listing Categories");
    expect(LOOKUP_VALUE_SECTIONS.silo_number.category).toBe("silo_number");
    expect(LOOKUP_VALUE_SECTIONS.inventory_locations.category).toBe("inventory_location");
    expect(LOOKUP_VALUE_SECTIONS.licenses.category).toBe("license");
    const landing = lookupsLandingPage("en");
    expect(landing).toContain("Harvest Operations");
    expect(landing).toContain("/admin/lookups/silo_number");
    expect(landing).toContain("/admin/lookups/inventory_locations");
    expect(landing).toContain("/admin/lookups/licenses");
    expect(landing).toContain("/admin/lookups/listing_categories");
    expect(landing).toContain("Listing Categories");
    expect(landing).toContain("Barns are the inbox at every site. CSA is 832-side staging. CSB and unknown spots are processor under 694.");
  });
});

describe("field help registry walk", () => {
  it("requires help on every station field and lookup paths on lookup-backed fields", () => {
    for (const entry of PIPELINE) {
      if (entry.kind !== "station") continue;
      for (const field of entry.fields) {
        expect(field.help.en.trim().length, `${entry.key}.${field.name} missing en help`).toBeGreaterThan(0);
        expect(field.help.es.trim().length, `${entry.key}.${field.name} missing es help`).toBeGreaterThan(0);
        const path = LOOKUP_BACKED_FIELDS[field.name];
        if (path) {
          expect(helpHasLookupPath(field.help.en, path.category, path.fieldName)).toBe(true);
        }
      }
    }
  });
});

describe("crew feedback laws (canon 0.22.0)", () => {
  it("acquire carries the market strain override, optional and text", () => {
    const acquire = stationByKey("acquire_hbn")!;
    const ms = acquire.fields.find((f) => f.name === "market_strain");
    expect(ms).toBeDefined();
    expect(ms).toMatchObject({ label: "Market Strain (optional)", input: "text" });
    expect(ms && "required" in ms && ms.required).toBeFalsy();
    expect(ms?.help.en).toContain("never changes the HBN");
    // The reasoned pencil can correct it later.
    expect(EDITABLE_FIELDS.harvest_batches.some((f) => f.name === "market_strain")).toBe(true);
  });

  it("wet weight captures the actual start time, a 24h data field", () => {
    const wet = stationByKey("wet_weight")!;
    const ast = wet.fields.find((f) => f.name === "actual_start_time");
    expect(ast).toMatchObject({ input: "text", pattern: "([01][0-9]|2[0-3]):[0-5][0-9]" });
    expect(ast && "required" in ast && ast.required).toBeFalsy();
    expect(EDITABLE_FIELDS.wet_weight_entries.some((f) => f.name === "actual_start_time")).toBe(true);
  });

  it("the wet queue item is a sequence number then Farm/Strain/Date, never the HBN", () => {
    const q = queueByKey("hbn_queue")!;
    expect(q.optionFields).toEqual(["farm_code", "strain_name", "entry_date"]);
    expect(q.sequenceRows).toBe(true);
  });
});

describe("planned_dryspc and 24h start", () => {
  it("stores Silo # as planned_dryspc lookup and Start Time as 24h text", () => {
    const acquire = stationByKey("acquire_hbn")!;
    const silo = acquire.fields.find((f) => f.name === "planned_dryspc");
    expect(silo).toMatchObject({ label: "Silo # (planned, optional)", input: "lookup", lookup: "silo_number" });
    const start = acquire.fields.find((f) => f.name === "start_time");
    expect(start).toMatchObject({
      label: "Start Time (planned, optional, 24h)",
      input: "text",
      pattern: "([01][0-9]|2[0-3]):[0-5][0-9]",
      placeholder: "HH:MM",
    });
    expect(isTime24("07:30")).toBe(true);
    expect(isTime24("24:00")).toBe(false);
    expect(isTime24("7:30")).toBe(false);
    const wet = stationByKey("wet_weight")!;
    expect(wet.fields.find((f) => f.name === "actual_dryspc")?.input).toBe("move_to");
    expect(wet.fields.find((f) => f.name === "dry_space_id")).toBeUndefined();
  });
});

describe("finish lot mint plan", () => {
  const base = {
    wetWeightEntryId: "lot1",
    harvestBatchId: "hb1",
    strainId: "st1",
    farmCode: "ARL",
    spaceName: "Arlington Dry Room",
    wetTotal: 1234.5,
    hbn: "26246-ARL-GH-027-0-NA-26011",
    metrcHarvestTag: null,
  };

  it("THE BIRTH LAW (canon 0.30.1) under THE BLANK SLATE (canon 0.30.108): every kind mints at Finish lot, in PNN's barn under 832, by material form", () => {
    // The old space map survives for the unload paths that still read it.
    expect(mintKindForSpace("hang")).toBe("SPR");
    expect(mintKindForSpace("silo")).toBe("WIP");
    expect(mintKindForSpace("truck")).toBeNull();
    // Owner, 2026-09-17: "assume everything that get's entered into wet weights
    // is landing in PNN's barn location." An ARL batch's package is born at BARN
    // under PNN's grow license; the HBN's farm rides on farm_code alone.
    const hang = planFinishMint({ ...base, spaceKind: "hang" }, null);
    expect(hang).toMatchObject({
      action: "insert",
      item_kind: "SPR",
      package_code: "26011",
      qty: 1235,
      location: "BARN",
      license_value: "AU-G-C-000832",
      farm_code: "ARL",
    });
    const silo = planFinishMint({ ...base, spaceKind: "silo", spaceName: "Silo 3", materialForm: "bucked" }, null);
    expect(silo).toMatchObject({ action: "insert", item_kind: "WIP", location: "BARN" });
    // A truck-kind lot (an older record's Move To) mints the same way.
    const truck = planFinishMint({ ...base, spaceKind: "truck", materialForm: "spear" }, null);
    expect(truck).toMatchObject({ action: "insert", item_kind: "SPR", location: "BARN" });
    // The batch license no longer rides the birth (his pick: 832 at birth); METRC carries the med paper.
    const med = planFinishMint({ ...base, spaceKind: "hang", licenseValue: "GR-C-002600" }, null);
    expect(med).toMatchObject({ action: "insert", license_value: "AU-G-C-000832", location: "BARN" });
  });

  it("re-finish updates the existing item instead of inserting", () => {
    const plan = planFinishMint({ ...base, spaceKind: "hang", wetTotal: 2000 }, { id: "inv1" });
    expect(plan).toEqual({ action: "update", itemId: "inv1", qty: 2000 });
  });
});

describe("inventory order", () => {
  it("orders WIP then SPR then FG, newest first inside each kind", () => {
    const rows = sortInventoryItems([
      { item_kind: "SPR", created_at: "2026-09-01T00:00:00.000Z" },
      { item_kind: "FG", created_at: "2026-09-03T00:00:00.000Z" },
      { item_kind: "WIP", created_at: "2026-09-01T00:00:00.000Z" },
      { item_kind: "WIP", created_at: "2026-09-02T00:00:00.000Z" },
    ]);
    expect(rows.map((r) => `${r.item_kind}:${r.created_at.slice(8, 10)}`)).toEqual([
      "WIP:02",
      "WIP:01",
      "SPR:01",
      "FG:03",
    ]);
  });
});

describe("reports", () => {
  it("lists the report cards and sales-order empty copy", () => {
    const page = reportsPage("en");
    expect(page).toContain("/reports/inventory");
    expect(page).toContain("/reports/sales_orders");
    expect(page).toContain("/reports/tats");
    expect(page).toContain("/reports/harvests");
    expect(page).toContain("/reports/product_mix");
    expect(page).toContain("/reports/external_audits");
    expect(page).toContain("/reports/rf");
    expect(page).toContain("/reports/internal_testing");
    expect(salesOrdersEmptyCopy()).toContain("Marketplace is the receiver");
    expect(inventoryFgEmptyCopy()).toContain("Zoho FG surface stays");
  });

  it("CSV starts with the header row and XLSX is a real zip", () => {
    const view = {
      key: "harvests" as const,
      title: "Harvests by year",
      columns: [
        { key: "harvest_year", label: "Harvest year" },
        { key: "wet_grams", label: "Wet grams", grams: true },
      ],
      rows: [{ harvest_year: 2026, wet_grams: 1000 }],
    };
    const csv = reportCsv(view);
    expect(csv.startsWith("Harvest year,Wet grams\r\n")).toBe(true);
    expect(csv).toContain('"1,000"');
    const xlsx = buildXlsx({
      headers: view.columns.map((c) => c.label),
      rows: [[{ text: "2026" }, { number: 1000, grams: true }]],
      gramColumns: [1],
    });
    expect(xlsx[0]).toBe(0x50);
    expect(xlsx[1]).toBe(0x4b);
    expect(xlsxHasParts(xlsx)).toBe(true);
  });

  it("excludes demoted status rows from TAT spans", () => {
    const logs = [
      {
        record_table: "wet_weight_entries",
        record_id: "lot1",
        old_value: "weighing",
        new_value: "drying",
        reason: "finish lot",
        changed_at: "2026-09-02T00:00:00.000Z",
        farm_code: "ARL",
        strain_name: "A",
        grow_method_code: "GH",
        harvest_batch_id: "hb1",
        wet_weight_entry_id: "lot1",
        entry_date: "2026-09-01",
        package_created_at: null,
      },
      {
        record_table: "wet_weight_entries",
        record_id: "lot1",
        old_value: "drying",
        new_value: "weighing",
        reason: "demoted",
        changed_at: "2026-09-03T00:00:00.000Z",
        farm_code: "ARL",
        strain_name: "A",
        grow_method_code: "GH",
        harvest_batch_id: "hb1",
        wet_weight_entry_id: "lot1",
        entry_date: "2026-09-01",
        package_created_at: null,
      },
      {
        record_table: "wet_weight_entries",
        record_id: "lot1",
        old_value: "weighing",
        new_value: "drying",
        reason: "finish lot",
        changed_at: "2026-09-04T00:00:00.000Z",
        farm_code: "ARL",
        strain_name: "A",
        grow_method_code: "GH",
        harvest_batch_id: "hb1",
        wet_weight_entry_id: "lot1",
        entry_date: "2026-09-01",
        package_created_at: null,
      },
    ];
    expect(statusLogsForSpans(logs)).toHaveLength(2);
    const groups = computeTatGroups(logs, "field_to_wet", "farm", {});
    expect(groups.get("ARL")).toHaveLength(2);
    expect(TAT_METRICS).toHaveLength(5);
  });
});

describe("outbound listing and virtual move", () => {
  it("excludes IN-TRANSIT and on-building items from outbound", () => {
    expect(outboundEligible({ item_kind: "SPR", location: "BARN", onBuildingMovement: false })).toBe(true);
    expect(outboundEligible({ item_kind: "SPR", location: "IN-TRANSIT", onBuildingMovement: false })).toBe(false);
    expect(outboundEligible({ item_kind: "SPR", location: "BARN", onBuildingMovement: true })).toBe(false);
    expect(outboundEligible({ item_kind: "FG", location: "BARN", onBuildingMovement: false })).toBe(false);
  });

  it("virtual move lands the picked processor location and always BARN back to 832", () => {
    expect(virtualMoveLanding("to_processor")).toEqual({ license: "AU-P-000694", location: "CSB" });
    expect(virtualMoveLanding("to_processor", "CSB")).toEqual({ license: "AU-P-000694", location: "CSB" });
    expect(virtualMoveLanding("to_grow")).toEqual({ license: "AU-G-C-000832", location: "BARN" });
  });

  it("emits the T3 three-row header and a quoted multi-line PlannedRoute", () => {
    expect(MANIFEST_COLUMNS[0]).toBe("destination.RecipientId");
    expect(MANIFEST_COLUMNS).toHaveLength(26);
    expect(T3_MANIFEST_HEADER.startsWith("destination in line.Destinations,")).toBe(true);
    expect(T3_MANIFEST_HEADER).toContain("\r\n");
    const header = {
      recipientId: "AU-P-000694",
      plannedRoute: "East on 51, North on 94\nWest on 12",
      transferType: "Wholesale Transfer",
      invoiceNumber: "",
      paymentTermDays: "",
      estimatedDeparture: "9/3/2026",
      estimatedArrival: "9/3/2026",
      grossWeight: "30",
      grossWeightUom: "Pounds",
      transporterId: "AU-ST-000146",
      transporterPhone: "2698459513",
      driverName: "Pat",
      driverOccupationalLicense: "",
      driverLicenseNumber: "",
      vehicleMake: "Mercedes",
      vehicleModel: "Sprinter",
      vehiclePlate: "DF32241",
    };
    const csv = manifestCsv(header, ["PKG1", "PKG2"]);
    const lines = csv.split("\r\n");
    expect(lines[0].startsWith("destination in line.Destinations")).toBe(true);
    expect(lines[1]).toBe(MANIFEST_COLUMNS.join(","));
    expect(lines[2]).toContain('"Vehicle Make, Model, Or License Plate"');
    expect(csv).toContain('"East on 51, North on 94\nWest on 12"');
    expect(lines[4].startsWith(",,,,,,,,,,,,,,,,,,,,,,PKG2,")).toBe(true);
    const virtual = manifestCsv(header, ["PKG1"], { includeTransporter: false });
    expect(virtual).toContain("AU-P-000694");
    expect(virtual).not.toContain("AU-ST-000146");
  });
});

describe("unload session plans", () => {
  it("bucked mints a -B WIP and reduces the parent", () => {
    const plan = planUnloadFinish({
      spaceKind: "hang",
      weighMode: "bucked",
      buckedOnSite: null,
      parentQty: 1000,
      dryTotal: 400,
      shortId: "26011",
    });
    expect(plan).toMatchObject({
      mode: "bucked",
      mintChild: true,
      childPackageCode: "26011-B",
      parentQty: 600,
      childQty: 400,
      pendKind: "package_from_harvest",
    });
  });

  it("spear yes lands BARN; spear no stages interco and demands a truck", () => {
    const yes = planUnloadFinish({
      spaceKind: "hang",
      weighMode: "spear",
      buckedOnSite: "yes",
      parentQty: 1000,
      dryTotal: 800,
      shortId: "26011",
    });
    expect(yes).toMatchObject({ mode: "spear", location: "BARN", requireTruck: false, pendKind: "package_adjust" });
    const no = planUnloadFinish({
      spaceKind: "hang",
      weighMode: "spear",
      buckedOnSite: "no",
      parentQty: 1000,
      dryTotal: 800,
      shortId: "26011",
    });
    expect(no).toMatchObject({ mode: "spear", location: "stage_interco", requireTruck: true });
  });

  it("silo unloads to BARN without minting a second item", () => {
    const plan = planUnloadFinish({
      spaceKind: "silo",
      weighMode: "bucked",
      buckedOnSite: null,
      parentQty: 2000,
      dryTotal: 1500,
      shortId: "26011",
    });
    expect(plan).toMatchObject({
      mode: "silo",
      location: "BARN",
      mintChild: false,
      parentQty: 1500,
      pendKind: "package_adjust",
    });
  });
});

describe("vendored METRC headers", () => {
  it("keeps Packages from Harvests and Package Adjustments byte for byte", () => {
    expect(METRC_PACKAGES_FROM_HARVESTS_HEADER).toBe(
      "Tag,Location,Sublocation,Item,UnitOfWeight,PatientLicenseNumber,Note,ProductionBatchNumber,IsTradeSample,IsDonation,ActualDate,IngredientHarvestName,IngredientWeight,IngredientUnitOfWeight"
    );
    expect(METRC_PACKAGE_ADJUSTMENTS_HEADER).toBe(
      "Label,Quantity,UnitOfMeasure,AdjustmentReason,ReasonNote,AdjustmentDate,EmployeeLicenseNumber"
    );
  });
});

describe("inventory by location report (canon 0.27.0; site-headed since canon 0.30.23)", () => {
  // Owner ruling 2026-09-09, verbatim: "the origin farm is listed as farm in
  // the report.  The current farm should be the header the list is sitting
  // under.  I'm good with the farm of origin on the report"
  it("rows read site, location, origin farm, product type, total; the site heads the run", () => {
    const view = inventoryByLocationView([
      { site: "PNN", farm: "ARL", location: "Silo 1", item_kind: "WIP", uom: "g", total: 2000000 },
      { site: "PNN", farm: "PNN", location: "BARN", item_kind: "WIP", uom: "g", total: 90 },
    ]);
    expect(view.key).toBe("inventory_by_location");
    expect(view.groupBy).toBe("site");
    expect(view.columns.map((c) => c.label)).toEqual(["Site", "Location", "Origin farm", "Product type", "Total", "UOM"]);
    expect(view.rows[0]).toEqual({ site: "PNN", location: "Silo 1", farm: "ARL", kind: "WIP", total: 2000000, uom: "g" });
    expect(bodyColumns(view).map((c) => c.key)).toEqual(["location", "farm", "kind", "total", "uom"]);
    expect(view.footnote).toContain("Site is where it sits now; origin farm is where it came from.");
    const empty = inventoryByLocationView([]);
    expect(empty.empty).toBe("No material anywhere. The floor is clean.");
    const unassigned = inventoryByLocationView([{ site: "", farm: "", location: "Mystery Room", item_kind: "WIP", uom: "g", total: 5 }]);
    expect(unassigned.rows[0].site).toBe("(unassigned)");
    expect(unassigned.rows[0].farm).toBe("(unassigned)");
  });

  it("the page and the PDF head each site once and keep the site out of the row cells; the CSV keeps it as a column", () => {
    const view = inventoryByLocationView([
      { site: "PNN", farm: "ARL", location: "Silo 1", item_kind: "WIP", uom: "g", total: 2000000 },
      { site: "PNN", farm: "PNN", location: "BARN", item_kind: "WIP", uom: "g", total: 492000 },
      { site: "PNS", farm: "PNS", location: "PNS BARN", item_kind: "WET", uom: "g", total: 777.25 },
    ]);
    const page = reportPage(view, "", "");
    expect(page).toContain('<tr class="report-group" data-report-group="PNN"><th colspan="5">PNN</th></tr>');
    expect(page).toContain('<tr class="report-group" data-report-group="PNS"><th colspan="5">PNS</th></tr>');
    expect((page.match(/data-report-group=/g) || []).length).toBe(2);
    expect(page).toContain("<tr><td>Silo 1</td><td>ARL</td><td>WIP</td><td>2,000,000</td><td>g</td></tr>");
    expect(page).toContain("<tr><td>BARN</td><td>PNN</td><td>WIP</td><td>492,000</td><td>g</td></tr>");
    expect(page).not.toContain("<td>PNN</td><td>Silo 1</td>");
    expect(page).toContain("<th>Location</th><th>Origin farm</th>");
    expect(page).not.toContain("<th>Site</th>");
    const pdf = reportPdfHtml(view, "", "Grip", "20260909");
    expect(pdf).toContain('data-report-group="PNN"');
    expect(pdf).toContain("<tr><td>Silo 1</td><td>ARL</td><td>WIP</td><td>2,000,000</td><td>g</td></tr>");
    const csv = reportCsv(view);
    expect(csv.split("\r\n")[0]).toBe("Site,Location,Origin farm,Product type,Total,UOM");
    expect(csv).toContain('PNN,Silo 1,ARL,WIP,"2,000,000",g');
    expect(csv).toContain("PNS,PNS BARN,PNS,WET,777,g");
  });
});

describe("siteForLocation (canon 0.30.23)", () => {
  it("places a location by the side convention, then Admin, then the dry space's farm, then the road", () => {
    const lookup = new Map([["Cold Room", "PNS"]]);
    const dry = new Map([["Arlington Dry Room", "ARL"]]);
    expect(siteForLocation("Silo 1", new Map())).toBe("PNN");
    expect(siteForLocation("BARN", new Map())).toBe("PNN");
    expect(siteForLocation("ARL BARN", new Map())).toBe("ARL");
    expect(siteForLocation("CSB", new Map())).toBe("PROCESSOR");
    expect(siteForLocation("Cold Room", lookup, dry)).toBe("PNS");
    expect(siteForLocation("Arlington Dry Room", lookup, dry)).toBe("ARL");
    expect(siteForLocation("IN-TRANSIT", lookup, dry)).toBe("IN-TRANSIT");
    expect(siteForLocation("Mystery Room", lookup, dry)).toBe("");
  });
});

describe("the receive mint map (canon 0.28.8; input lot-borne since canon 0.29.1)", () => {
  it("spear mints SPR, bucked mints WIP, anything else refuses", () => {
    expect(receiveMintKind("spear")).toBe("SPR");
    expect(receiveMintKind("bucked")).toBe("WIP");
    expect(receiveMintKind("")).toBeNull();
    expect(receiveMintKind("silo")).toBeNull();
  });
});

describe("Spears that aren't at North (owner ruling 2026-09-07, canon 0.29.1)", () => {
  it("the item location wins when it resolves; the batch farm backstops", () => {
    // A resolvable location decides: the barn and silos are Penn North.
    expect(materialAtNorth("BARN", "ARL")).toBe(true);
    expect(materialAtNorth("Silo 4", "ARL")).toBe(true);
    expect(materialAtNorth("ARL BARN", "PNN")).toBe(false);
    expect(materialAtNorth("PNS BARN", "PNN")).toBe(false);
    // An unmapped hang room says nothing: the batch farm decides.
    expect(materialAtNorth("Arlington Dry Room", "ARL")).toBe(false);
    expect(materialAtNorth("Hang Room 1", "PNN")).toBe(true);
    expect(materialAtNorth(null, "PNN")).toBe(true);
    expect(materialAtNorth(null, "ARL")).toBe(false);
    expect(materialAtNorth(null, null)).toBe(false);
  });
});

describe("wet lots fold into the location report (canon 0.27.2, owner report 2026-09-06)", () => {
  const lookup = new Map([
    ["BARN", "PNN"],
    ["ARL BARN", "ARL"],
    ["PNS BARN", "PNS"],
  ]);

  it("a weighing lot sits in its site barn as a WET row under the barn's site, its farm the origin", () => {
    const rows = foldWetLotsIntoLocationRows(
      [],
      [{ status: "weighing", farm_code: "ARL", weight_grams: 1000000 }],
      lookup
    );
    expect(rows).toEqual([
      { site: "ARL", farm: "ARL", location: "ARL BARN", item_kind: ITEM_KIND_WET, uom: "g", total: 1000000 },
    ]);
  });

  it("an in-transit lot rides IN-TRANSIT as its own site, its origin farm kept", () => {
    const rows = foldWetLotsIntoLocationRows(
      [],
      [{ status: "in_transit", farm_code: "ARL", weight_grams: 1500 }],
      lookup
    );
    expect(rows).toEqual([
      { site: "IN-TRANSIT", farm: "ARL", location: "IN-TRANSIT", item_kind: ITEM_KIND_WET, uom: "g", total: 1500 },
    ]);
  });

  it("a lot with no weights yet totals zero and stays off the report (visibility law)", () => {
    expect(
      foldWetLotsIntoLocationRows([], [{ status: "weighing", farm_code: "PNN", weight_grams: 0 }], lookup)
    ).toEqual([]);
  });

  it("same-barn lots sum with 2-decimal rounding; an unknown batch farm lands BARN, the universal inbox", () => {
    const rows = foldWetLotsIntoLocationRows(
      [],
      [
        { status: "weighing", farm_code: "PNS", weight_grams: 700.004 },
        { status: "weighing", farm_code: "PNS", weight_grams: 77.244 },
        { status: "weighing", farm_code: "XX", weight_grams: 5 },
        { status: "weighing", farm_code: null, weight_grams: 6 },
      ],
      lookup
    );
    // Two origins land the universal inbox; each keeps its own origin row under PNN.
    expect(rows).toEqual([
      { site: "PNN", farm: "", location: "BARN", item_kind: ITEM_KIND_WET, uom: "g", total: 6 },
      { site: "PNN", farm: "XX", location: "BARN", item_kind: ITEM_KIND_WET, uom: "g", total: 5 },
      { site: "PNS", farm: "PNS", location: "PNS BARN", item_kind: ITEM_KIND_WET, uom: "g", total: 777 },
    ]);
  });

  it("wet rows merge with ledger rows and the whole report sorts site, location, origin farm, kind", () => {
    const rows = foldWetLotsIntoLocationRows(
      [
        { site: "ARL", farm: "ARL", location: "ARL BARN", item_kind: "SPR", uom: "g", total: 12 },
        { site: "PNN", farm: "ARL", location: "Silo 1", item_kind: "WIP", uom: "g", total: 2000000 },
        { site: "PNN", farm: "PNN", location: "CSA", item_kind: "WIP", uom: "g", total: 4 },
      ],
      [
        { status: "in_transit", farm_code: "ARL", weight_grams: 1500 },
        { status: "weighing", farm_code: "ARL", weight_grams: 9 },
      ],
      lookup
    );
    expect(rows.map((r) => `${r.site}/${r.location}/${r.farm}/${r.item_kind}`)).toEqual([
      "ARL/ARL BARN/ARL/SPR",
      "ARL/ARL BARN/ARL/WET",
      "IN-TRANSIT/IN-TRANSIT/ARL/WET",
      "PNN/CSA/PNN/WIP",
      "PNN/Silo 1/ARL/WIP",
    ]);
  });

  // THE SILO SHAPE AND THE LIVE WET WEIGHT (canon 0.30.69; owner: "Live inventory on
  // all screens, including the Inventory by Location report").
  it("a lot weighing into a silo reads under that silo as it fills, and every silo closes with a Wet total row", () => {
    const silos = new Set(["Silo 1", "Silo 2"]);
    const rows = foldWetLotsIntoLocationRows(
      [
        { site: "PNN", farm: "ARL", location: "Silo 1", item_kind: "WIP", uom: "g", total: 2000000 },
        { site: "PNN", farm: "PNN", location: "Silo 1", item_kind: "WIP", uom: "g", total: 500.5 },
        { site: "PNN", farm: "PNN", location: "CSA", item_kind: "WIP", uom: "g", total: 4 },
      ],
      [
        { status: "weighing", farm_code: "ARL", weight_grams: 1234.56, dry_space_name: "Silo 2", dry_space_kind: "silo" },
        { status: "weighing", farm_code: "ARL", weight_grams: 9, dry_space_name: "Arlington Dry Room", dry_space_kind: "hang" },
      ],
      lookup,
      new Map(),
      silos
    );
    expect(rows.map((r) => `${r.site}/${r.location}/${r.farm}/${r.item_kind}/${r.total}`)).toEqual([
      "ARL/ARL BARN/ARL/WET/9",
      "PNN/CSA/PNN/WIP/4",
      "PNN/Silo 1/ARL/WIP/2000000",
      "PNN/Silo 1/PNN/WIP/500.5",
      "PNN/Silo 1//Wet total/2000501",
      "PNN/Silo 2/ARL/WET/1235",
      "PNN/Silo 2//Wet total/1235",
    ]);
    // Without the silo names (the older callers) nothing changes.
    expect(foldWetLotsIntoLocationRows([], [{ status: "weighing", farm_code: "ARL", weight_grams: 9 }], lookup)).toEqual([
      { site: "ARL", farm: "ARL", location: "ARL BARN", item_kind: ITEM_KIND_WET, uom: "g", total: 9 },
    ]);
  });

  it("an in-transit lot with no batch farm keeps a blank origin under the road", () => {
    const rows = foldWetLotsIntoLocationRows(
      [],
      [{ status: "in_transit", farm_code: null, weight_grams: 3 }],
      lookup
    );
    expect(rows[0].site).toBe("IN-TRANSIT");
    expect(rows[0].farm).toBe("");
    expect(rows[0].location).toBe("IN-TRANSIT");
  });
});
