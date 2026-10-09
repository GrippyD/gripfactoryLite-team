import { describe, expect, it } from "vitest";
import { METRC_PACKAGE_COLUMNS, METRC_PLANT_COLUMNS, metrcIndexer, shapePackageRow, shapePlantRow } from "../src/metrc";
import {
  HARVEST_API_MAP,
  PACKAGE_API_MAP,
  PLANT_API_MAP,
  apiGetter,
  apiText,
  easternCalendarDate,
  harvestInScope,
  packageApiRow,
  plantApiRow,
  plantGrowthPhase,
  shapeHarvestRow,
  type ApiObject,
} from "../src/metrcmap";

type Fs = { readFileSync(path: URL, encoding: "utf8"): string };

/** The docs example responses (never production rows), as the eval tests read them. */
async function fixture(name: string): Promise<ApiObject[]> {
  const fs = (await import("node:" + "fs")) as Fs;
  return (JSON.parse(fs.readFileSync(new URL(`./fixtures/metrc/${name}.json`, import.meta.url), "utf8")) as { Data: ApiObject[] }).Data;
}

const VEG = await fixture("GET_plants_v2_vegetative");
const FLW = await fixture("GET_plants_v2_flowering");
const PKG = await fixture("GET_packages_v2_active");
const HVA = await fixture("GET_harvests_v2_active");
const HVI = await fixture("GET_harvests_v2_inactive");

/** The field path names a key of the docs example object (nested as Parent.Child). */
function fieldPresent(obj: ApiObject, path: string): boolean {
  const [parent, child] = path.split(".");
  if (!child) return Object.prototype.hasOwnProperty.call(obj, parent);
  const inner = obj[parent];
  return !!inner && typeof inner === "object" && Object.prototype.hasOwnProperty.call(inner, child);
}

describe("MA1 Law 2: the mapping constant", () => {
  it("covers every plant and package header, in the export's order, and every harvests column", () => {
    expect(PLANT_API_MAP.map((row) => row.header)).toEqual([...METRC_PLANT_COLUMNS]);
    expect(PACKAGE_API_MAP.map((row) => row.header)).toEqual([...METRC_PACKAGE_COLUMNS]);
    expect(PLANT_API_MAP).toHaveLength(10);
    expect(PACKAGE_API_MAP).toHaveLength(22);
    expect(HARVEST_API_MAP.map((row) => row.header)).toEqual([
      "harvest_id",
      "name",
      "license_value",
      "harvest_start_date",
      "finished_date",
      "archived_date",
      "total_wet_weight",
      "unit_of_weight",
      "location",
      "sublocation",
      "state",
      "plant_count",
    ]);
    for (const row of [...PLANT_API_MAP, ...PACKAGE_API_MAP, ...HARVEST_API_MAP]) {
      expect(row.docs).toMatch(/^[a-z]+:\d+/);
      expect(["SAME", "RENAMED", "DERIVED", "LACKING"]).toContain(row.status);
      if (row.status === "LACKING") expect(row.field).toBe("");
    }
  });

  it("names only fields that appear in the docs example responses", () => {
    for (const row of PLANT_API_MAP) {
      for (const field of row.field.split(" | ")) if (field) expect(fieldPresent(VEG[0], field), `${row.header} <- ${field}`).toBe(true);
    }
    for (const row of PACKAGE_API_MAP) {
      if (row.field) expect(fieldPresent(PKG[0], row.field), `${row.header} <- ${row.field}`).toBe(true);
    }
    for (const row of HARVEST_API_MAP) {
      if (row.field) expect(fieldPresent(HVA[0], row.field), `${row.header} <- ${row.field}`).toBe(true);
    }
    // The Mapping section's tally: plants 6 RENAMED and 4 DERIVED; packages
    // 1 SAME, 16 RENAMED, 4 DERIVED, 1 LACKING.
    const tally = (map: readonly { status: string }[]) => map.reduce<Record<string, number>>((acc, row) => ({ ...acc, [row.status]: (acc[row.status] ?? 0) + 1 }), {});
    expect(tally(PLANT_API_MAP)).toEqual({ RENAMED: 6, DERIVED: 4 });
    expect(tally(PACKAGE_API_MAP)).toEqual({ SAME: 1, RENAMED: 16, DERIVED: 4, LACKING: 1 });
    // Table 3's required rows: ten RENAMED, and license_value (the call) and state (the list) DERIVED with no row field.
    expect(tally(HARVEST_API_MAP)).toEqual({ RENAMED: 10, DERIVED: 2 });
    expect(HARVEST_API_MAP.filter((row) => row.status === "DERIVED").map((row) => [row.header, row.field])).toEqual([
      ["license_value", ""],
      ["state", ""],
    ]);
  });

  it("keeps the getter contract: null and missing objects give blank, booleans true/false, numbers via String", () => {
    expect(apiText(null)).toBe("");
    expect(apiText(undefined)).toBe("");
    expect(apiText(true)).toBe("true");
    expect(apiText(false)).toBe("false");
    expect(apiText(1.0)).toBe("1");
    expect(apiText(1234.5)).toBe("1234.5");
    expect(apiText("oz")).toBe("oz");
    expect(apiText({ Name: "x" })).toBe("");
    expect(apiText([1])).toBe("");
    const get = apiGetter({ Label: "abc", Item: null, ProductLabel: { OriginalSourcePackageLabel: null }, IsOnHold: null }, "packages", null);
    expect(get([], "Item")).toBe("");
    expect(get([], "Category")).toBe("");
    expect(get([], "Original Source Package Label")).toBe("");
    expect(get([], "Administrative Hold")).toBe("");
    expect(get([], "Source Processing Job(s)")).toBe("");
    expect(get([], "No Such Header")).toBe("");
    expect(get([], "tag")).toBe("abc");
  });
});

describe("MA1 Law 2: plants through the getter (both phases)", () => {
  it("maps the vegetative docs example into the export's shape, the phase date from the endpoint", () => {
    const row = plantApiRow(VEG[0], "vegetative");
    expect(row).toEqual({
      tag: "ABCDEF012345670000000024",
      strain: "Spring Hill Kush",
      location: "Plants Location",
      sublocation: null,
      hold: 0,
      plant_batch: "Demo Plant Batch",
      plant_batch_type: "Seed",
      plant_batch_date: "2014-10-10",
      phase_date: "2014-10-20",
      harvested: 0,
    });
    expect(plantGrowthPhase(VEG[0])).toBe("vegetative");
  });

  it("maps the flowering docs example, taking FloweringDate although the row carries both dates", () => {
    const row = plantApiRow(FLW[0], "flowering");
    expect(row).toMatchObject({ tag: "ABCDEF012345670000010011", plant_batch_type: "Clone", plant_batch_date: "2014-10-10", phase_date: "2014-11-09", hold: 0, harvested: 0 });
    expect(FLW[0].VegetativeDate).toBe("2014-10-20");
    expect(plantGrowthPhase(FLW[0])).toBe("flowering");
    // The same row read as the vegetative list's would take VegetativeDate: the endpoint decides.
    expect(plantApiRow(FLW[0], "vegetative")?.phase_date).toBe("2014-10-20");
  });

  it("derives Hold from IsOnHold and Harvested from HarvestedDate, as the CSV's words", () => {
    const held = plantApiRow({ ...VEG[0], IsOnHold: true, HarvestedDate: "2014-11-19" }, "vegetative");
    expect(held).toMatchObject({ hold: 1, harvested: 1 });
    const get = apiGetter({ ...VEG[0], IsOnHold: true, HarvestedDate: "2014-11-19" }, "plants", "vegetative");
    expect(get([], "Hold")).toBe("true");
    expect(get([], "Harvested")).toBe("true");
    expect(apiGetter(VEG[0], "plants", "vegetative")([], "Harvested")).toBe("false");
    expect(plantApiRow({ ...VEG[0], Label: "  " }, "vegetative")).toBeNull();
    expect(plantApiRow("not an object", "vegetative")).toBeNull();
    // Lower-case labels upper-case, as the file door does.
    expect(plantApiRow({ ...VEG[0], Label: "abcdef012345670000000024" }, "vegetative")?.tag).toBe("ABCDEF012345670000000024");
  });
});

describe("MA1 Law 2: packages through the getter", () => {
  it("maps the active docs example into the 22 export columns", () => {
    const row = packageApiRow(PKG[0]);
    expect(row).toEqual({
      tag: "ABCDEF012345670000010042",
      source_harvests: null,
      source_packages: null,
      original_source_label: null,
      source_processing_jobs: null,
      location: null,
      sublocation: null,
      item: "Buds",
      category: "Buds",
      item_strain: null,
      quantity: 1,
      uom: "oz",
      production_batch: null,
      source_production_batch: null,
      lab_test_status: "NotSubmitted",
      finished_goods: 0,
      admin_hold: 0,
      admin_recall: 0,
      packaged_date: "2014-11-29",
      received_date: null,
      expiration_date: null,
      lab_test_expiration: null,
    });
  });

  it("keeps lists verbatim, reads nested names, and never the unit's Name or a numeric code", () => {
    const obj: ApiObject = {
      ...PKG[0],
      SourceHarvestNames: "46258-PNN-ID-062-0-NA-26007, 46258-PNN-ID-062-0-NA-26008",
      SourcePackageLabels: "1A4050100000000000000B01",
      SourceProductionBatchNumbers: "PB-1, PB-2",
      Quantity: 1234.5,
      UnitOfMeasureName: "Grams",
      UnitOfMeasureAbbreviation: "g",
      IsFinishedGood: true,
      IsOnHold: true,
      IsOnRecall: null,
      Item: { ...(PKG[0].Item as ApiObject), Name: "WIP - Placeholder - PNN - I", ProductCategoryName: "Buds", ProductCategoryType: 7, StrainName: "Placeholder" },
      ProductLabel: { ...(PKG[0].ProductLabel as ApiObject), OriginalSourcePackageLabel: "1A4050100000000000000C01" },
    };
    expect(packageApiRow(obj)).toMatchObject({
      source_harvests: "46258-PNN-ID-062-0-NA-26007, 46258-PNN-ID-062-0-NA-26008",
      source_packages: "1A4050100000000000000B01",
      source_production_batch: "PB-1, PB-2",
      original_source_label: "1A4050100000000000000C01",
      quantity: 1234.5,
      uom: "g",
      item: "WIP - Placeholder - PNN - I",
      category: "Buds",
      item_strain: "Placeholder",
      finished_goods: 1,
      admin_hold: 1,
      admin_recall: 0,
    });
    expect(packageApiRow({ ...PKG[0], Item: null, ProductLabel: null })).toMatchObject({ item: null, category: null, item_strain: null, original_source_label: null });
  });

  it("A24 and A25: date-only fields untouched; date-time fields become the Eastern calendar date, across the 20:00 boundary, whatever TZ runs", () => {
    expect(easternCalendarDate("2026-10-08")).toBe("2026-10-08");
    expect(easternCalendarDate(null)).toBe("");
    expect(easternCalendarDate("")).toBe("");
    // 00:30 UTC on the 9th is 20:30 Eastern on the 8th (EDT).
    expect(easternCalendarDate("2026-10-09T00:30:00+00:00")).toBe("2026-10-08");
    expect(easternCalendarDate("2026-10-09T00:30:00Z")).toBe("2026-10-08");
    // 23:59 UTC on the 8th is 19:59 Eastern on the 8th: before the boundary, the same day.
    expect(easternCalendarDate("2026-10-08T23:59:59+00:00")).toBe("2026-10-08");
    // 04:00 UTC on the 9th is 00:00 Eastern on the 9th.
    expect(easternCalendarDate("2026-10-09T04:00:00+00:00")).toBe("2026-10-09");
    // In winter (EST) the boundary is 05:00 UTC.
    expect(easternCalendarDate("2026-01-10T04:59:00+00:00")).toBe("2026-01-09");
    expect(easternCalendarDate("2026-01-10T05:00:00+00:00")).toBe("2026-01-10");
    // An offset other than zero is honored; a value without a zone reads as UTC.
    expect(easternCalendarDate("2026-10-08T22:30:00-05:00")).toBe("2026-10-08");
    expect(easternCalendarDate("2026-10-09T00:30:00")).toBe("2026-10-08");
    // The docs' seven fractional digits parse.
    expect(easternCalendarDate("2026-10-08T09:45:03.3818493+00:00")).toBe("2026-10-08");
    expect(easternCalendarDate("9/1/2026 12:00:00 AM")).toBe("9/1/2026 12:00:00 AM");
    const row = packageApiRow({ ...PKG[0], ReceivedDateTime: "2026-10-09T00:30:00+00:00", LabTestResultExpirationDateTime: "2026-10-09T04:00:00+00:00", PackagedDate: "2026-10-09", ExpirationDate: "2026-10-09" });
    expect(row).toMatchObject({ received_date: "2026-10-08", lab_test_expiration: "2026-10-09", packaged_date: "2026-10-09", expiration_date: "2026-10-09" });
  });

  it("A25 on Lab Test Expiration crosses the 20:00 Eastern boundary like Received, in summer and in winter", () => {
    const summer = packageApiRow({ ...PKG[0], LabTestResultExpirationDateTime: "2026-10-09T00:30:00+00:00", ReceivedDateTime: "2026-10-09T00:30:00+00:00" });
    expect(summer).toMatchObject({ lab_test_expiration: "2026-10-08", received_date: "2026-10-08" });
    expect(packageApiRow({ ...PKG[0], LabTestResultExpirationDateTime: "2026-01-10T04:59:00+00:00" })?.lab_test_expiration).toBe("2026-01-09");
    expect(packageApiRow({ ...PKG[0], LabTestResultExpirationDateTime: "2026-01-10T05:00:00+00:00" })?.lab_test_expiration).toBe("2026-01-10");
  });

  it("parity of the shapers: the same cells through the file indexer and the API getter give one row", () => {
    const pget = metrcIndexer([...METRC_PACKAGE_COLUMNS]);
    const fromFile = shapePackageRow(pget, ["1A4050300000000000000A01", "", "", "", "", "Barn", "", "BUD - Placeholder", "Buds", "Placeholder", "1,234.5", "g", "", "", "TestPassed", "True", "False", "False", "9/1/2026 12:00:00 AM", "9/2/2026 12:00:00 AM", "", ""]);
    const fromApi = packageApiRow({
      Label: "1a4050300000000000000a01",
      LocationName: "Barn",
      Item: { Name: "BUD - Placeholder", ProductCategoryName: "Buds", StrainName: "Placeholder" },
      Quantity: 1234.5,
      UnitOfMeasureAbbreviation: "g",
      LabTestingState: "TestPassed",
      IsFinishedGood: true,
      IsOnHold: false,
      IsOnRecall: false,
      PackagedDate: "2026-09-01",
      ReceivedDateTime: "2026-09-02T14:00:00+00:00",
      ExpirationDate: null,
      LabTestResultExpirationDateTime: null,
    });
    expect(fromApi).toEqual(fromFile);
    const get = metrcIndexer([...METRC_PLANT_COLUMNS]);
    const plantFile = shapePlantRow(get, ["1A4050000000000000000001", "Bermuda Triangle", "West 3", "", "False", "Bermuda Triangle 5/27/2026 & Co", "Seed", "2026-05-27", "2026-08-03", "0"]);
    const plantApi = plantApiRow(
      {
        Label: "1A4050000000000000000001",
        StrainName: "Bermuda Triangle",
        LocationName: "West 3",
        SublocationName: null,
        IsOnHold: false,
        PlantBatchName: "Bermuda Triangle 5/27/2026 & Co",
        PlantBatchTypeName: "Seed",
        PlantedDate: "2026-05-27",
        VegetativeDate: "2026-06-10",
        FloweringDate: "2026-08-03",
        HarvestedDate: null,
      },
      "flowering"
    );
    expect(plantApi).toEqual(plantFile);
  });
});

describe("MA1 Law 6: harvests through the translator", () => {
  it("maps the active and inactive docs examples into the metrc_harvests columns, the state from the list", () => {
    expect(shapeHarvestRow(HVA[0], "active")).toEqual({
      harvest_id: 1,
      name: "2014-11-19-Harvest Location-M",
      harvest_start_date: "2014-11-19",
      finished_date: null,
      archived_date: null,
      total_wet_weight: 40,
      unit_of_weight: "Ounces",
      location: "Harvest Location",
      sublocation: null,
      state: "active",
      plant_count: 70,
    });
    expect(shapeHarvestRow(HVI[0], "inactive")).toMatchObject({ harvest_id: 1, finished_date: "2015-01-10", archived_date: null, state: "inactive" });
    expect(shapeHarvestRow(HVI[1], "inactive")).toMatchObject({ harvest_id: 2, finished_date: null, archived_date: "2015-02-01", state: "inactive" });
    expect(shapeHarvestRow(HVA[1], "onhold")?.state).toBe("onhold");
    expect(shapeHarvestRow({ ...HVA[0], Id: "x" }, "active")).toBeNull();
    expect(shapeHarvestRow({ ...HVA[0], Name: " " }, "active")).toBeNull();
    expect(shapeHarvestRow(null, "active")).toBeNull();
    // The name is trimmed, never re-cased; the unit stays a Name; no gram column.
    const trimmed = shapeHarvestRow({ ...HVA[0], Name: "  26257-PNN-OD-070-0-01-26010  ", UnitOfWeightName: "Pounds", TotalWetWeight: 12.25 }, "active");
    expect(trimmed).toMatchObject({ name: "26257-PNN-OD-070-0-01-26010", unit_of_weight: "Pounds", total_wet_weight: 12.25 });
    expect(Object.keys(trimmed ?? {})).not.toContain("total_wet_weight_g");
  });

  it("keeps an inactive harvest in scope for 30 days by FinishedDate, falling back to ArchivedDate", () => {
    const now = "2026-10-08T12:00:00.000Z";
    expect(harvestInScope({ state: "inactive", finished_date: "2026-09-20", archived_date: null }, now, 30)).toBe(true);
    expect(harvestInScope({ state: "inactive", finished_date: "2026-09-08", archived_date: null }, now, 30)).toBe(true);
    expect(harvestInScope({ state: "inactive", finished_date: "2026-09-07", archived_date: null }, now, 30)).toBe(false);
    expect(harvestInScope({ state: "inactive", finished_date: null, archived_date: "2026-10-01" }, now, 30)).toBe(true);
    expect(harvestInScope({ state: "inactive", finished_date: null, archived_date: "2015-02-01" }, now, 30)).toBe(false);
    // FinishedDate wins over ArchivedDate when both are set.
    expect(harvestInScope({ state: "inactive", finished_date: "2026-01-01", archived_date: "2026-10-07" }, now, 30)).toBe(false);
    expect(harvestInScope({ state: "inactive", finished_date: null, archived_date: null }, now, 30)).toBe(false);
    expect(harvestInScope({ state: "active", finished_date: null, archived_date: null }, now, 30)).toBe(true);
    expect(harvestInScope({ state: "onhold", finished_date: "2015-01-10", archived_date: null }, now, 30)).toBe(true);
  });
});
