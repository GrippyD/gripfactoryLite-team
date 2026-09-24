import { describe, expect, it } from "vitest";
import { LICENSE_AU_GROW, LICENSE_AU_PROCESSOR, LICENSE_ARL_AU, LICENSE_ARL_MED, LICENSE_PNN_MED } from "../src/config";
import { pendingUploadsPage } from "../src/html";
import {
  LOCATION_CATEGORY,
  licensesForChange,
  locationMoveFilename,
  locationOptionsFor,
  normalizeMoveDate,
  parseFarm,
  parseLocationKind,
  PLANT_LOCATION_CHANGE_CSV_HEADER,
  plantLocationChangeCsv,
} from "../src/locations";
import { changeLocationPage, type ChangeLocationData } from "../src/locationpane";
import { LOOKUP_LANDING, LOOKUP_VALUE_SECTIONS } from "../src/lookups";

const base: ChangeLocationData = {
  kind: "packages",
  farm: "PNN",
  license: LICENSE_AU_PROCESSOR,
  licenseLabels: new Map([[LICENSE_AU_PROCESSOR, "PNN Processor"], [LICENSE_AU_GROW, "PNN AU"]]),
  destinations: [
    { value: "CSB", label: "CSB", farm_code: "PNN", license_value: LICENSE_AU_PROCESSOR },
    { value: "Trim Room 1", label: "Trim Room 1", farm_code: "PNN", license_value: LICENSE_AU_PROCESSOR },
    { value: "1.3.c", label: "1.3.c", farm_code: "PNN", license_value: LICENSE_AU_PROCESSOR },
  ],
  ledger: [
    { id: "i1", package_code: "26007", metrc_tag: "1A4050300000000000000E07", item_kind: "SPR", qty: 1000, uom: "g", location: "CSB", strain_name: "Placeholder" },
  ],
  pick: "",
  found: null,
  plantLocations: [],
  fromLocation: "",
  plants: [],
  plant: null,
  recent: [],
  today: "2026-09-11",
};

describe("THE CHANGE LOCATION SETUP: scope and seeds (canon 0.30.40)", () => {
  it("parses the toggle and the farm, and keeps plants off the processor", () => {
    expect(parseLocationKind("plants")).toBe("plants");
    expect(parseLocationKind("packages")).toBe("packages");
    expect(parseLocationKind(null)).toBe("packages");
    expect(parseFarm("pnn")).toBe("PNN");
    expect(parseFarm("ARL")).toBe("ARL");
    expect(parseFarm("MARS")).toBeNull();
    expect(licensesForChange("PNN", "packages")).toEqual([LICENSE_AU_GROW, LICENSE_AU_PROCESSOR, LICENSE_PNN_MED]);
    expect(licensesForChange("PNN", "plants")).toEqual([LICENSE_AU_GROW, LICENSE_PNN_MED]);
    expect(licensesForChange("ARL", "plants")).toEqual([LICENSE_ARL_AU, LICENSE_ARL_MED]);
    expect(LOCATION_CATEGORY.plants).toBe("field_location");
    expect(LOCATION_CATEGORY.packages).toBe("inventory_location");
  });

  it("offers a location to its farm, scoped to one license or every license at the farm", () => {
    const options = [
      { value: "BARN", label: "Barn", farm_code: "PNN", license_value: null },
      { value: "Blast Freezer", label: "Blast Freezer", farm_code: "PNN", license_value: null },
      { value: "CSB", label: "CSB", farm_code: "PNN", license_value: LICENSE_AU_PROCESSOR },
      { value: "Trim Room 1", label: "Trim Room 1", farm_code: "PNN", license_value: LICENSE_AU_PROCESSOR },
      { value: "ARL BARN", label: "ARL Barn", farm_code: "ARL", license_value: null },
    ];
    expect(locationOptionsFor(options, "PNN", LICENSE_AU_GROW).map((o) => o.value)).toEqual(["BARN", "Blast Freezer"]);
    expect(locationOptionsFor(options, "PNN", LICENSE_AU_PROCESSOR).map((o) => o.value)).toEqual(["BARN", "Blast Freezer", "CSB", "Trim Room 1"]);
    expect(locationOptionsFor(options, "ARL", LICENSE_ARL_AU).map((o) => o.value)).toEqual(["ARL BARN"]);
  });

  it("registers Field Locations in Admin beside Inventory Locations", () => {
    expect(LOOKUP_VALUE_SECTIONS.field_locations).toEqual({ category: "field_location", title: "Field Locations" });
    const logistics = LOOKUP_LANDING.find((s) => s.category === "Logistics")!;
    expect(logistics.buttons.map((b) => b.key)).toEqual(["inventory_locations", "field_locations", "licenses"]);
  });

  it("dates default to today and refuse other shapes; the plants file has its own shape", () => {
    expect(normalizeMoveDate("2026-09-11")).toBe("2026-09-11");
    expect(normalizeMoveDate("")).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(() => normalizeMoveDate("9/11/2026")).toThrow(/YYYY-MM-DD/);
    expect(PLANT_LOCATION_CHANGE_CSV_HEADER).toBe("Plant,Location,Sublocation,ChangeDate");
    expect(plantLocationChangeCsv([{ tag: "1A1", location: "West 4", changeDate: "2026-09-11" }])).toBe(
      "Plant,Location,Sublocation,ChangeDate\r\n1A1,West 4,,2026-09-11\r\n"
    );
    expect(locationMoveFilename("plants", "GR-C-002600", "2026-09-11", "0828ef29-2597-45d9")).toBe(
      "location_change_plants_GRC002600_20260911_0828ef29.csv"
    );
  });
});

describe("THE CHANGE LOCATION SETUP: the page", () => {
  it("renders the toggle, the scope selects and the ledger pick before anything is picked", () => {
    const html = changeLocationPage(base, "en");
    expect(html).toContain("Change Locations");
    expect(html).toContain('data-tab="plants"');
    expect(html).toContain('data-tab="packages"');
    expect(html).toContain('aria-current="page"');
    expect(html).toContain('<option value="PNN" selected>PNN</option>');
    expect(html).toContain(`<option value="${LICENSE_AU_PROCESSOR}" selected>PNN Processor ${LICENSE_AU_PROCESSOR}</option>`);
    expect(html).toContain('name="pick"');
    expect(html).toContain("1A4050300000000000000E07 / Placeholder / 1,000 g / CSB");
    expect(html).not.toContain("data-change-execute");
  });

  it("shows the found package with From, the To pick without its own spot, the warning and Execute", () => {
    const html = changeLocationPage(
      {
        ...base,
        pick: "1A4050300000000000000E07",
        found: {
          source: "ledger",
          item_id: "i1",
          tag: "1A4050300000000000000E07",
          package_code: "26007",
          label: "1A4050300000000000000E07",
          location: "CSB",
          strain: "Placeholder",
          item: "SPR",
          qty: 1000,
          uom: "g",
        },
      },
      "en"
    );
    expect(html).toContain('data-pick-found="ledger"');
    expect(html).toContain('<dd data-from-location>CSB</dd>');
    expect(html).toContain('data-change-execute');
    expect(html).toContain('<input type="hidden" name="pick" value="1A4050300000000000000E07">');
    expect(html).toContain('<option value="Trim Room 1">Trim Room 1</option>');
    expect(html).toContain('<option value="1.3.c">1.3.c</option>');
    expect(html).not.toContain('<option value="CSB">CSB</option>');
    expect(html).toContain("data-change-warning");
    expect(html).toContain(`<code>${LICENSE_AU_PROCESSOR}</code>: 1 package.`);
    expect(html).toContain('<button type="submit" class="danger" data-execute>Execute</button>');
    expect(html).toContain('name="move_date" value="2026-09-11"');
    expect(html).toContain("METRC changes only when that file is uploaded");
  });

  it("marks an untagged ledger package and says when nothing resolves", () => {
    const untagged = changeLocationPage(
      {
        ...base,
        pick: "26007",
        found: { source: "ledger", item_id: "i1", tag: null, package_code: "26007", label: "26007", location: "CSB", strain: null, item: "SPR", qty: 1000, uom: "g" },
      },
      "en"
    );
    expect(untagged).toContain("no METRC tag yet");
    const none = changeLocationPage({ ...base, pick: "nope", found: null }, "en");
    expect(none).toContain("data-pick-unknown");
  });

  it("plants: every plant at a location moves as one act, with the count in the warning", () => {
    const html = changeLocationPage(
      {
        ...base,
        kind: "plants",
        farm: "ARL",
        license: LICENSE_ARL_MED,
        licenseLabels: new Map([[LICENSE_ARL_MED, "ARL Med"]]),
        destinations: [
          { value: "West 3", label: "West 3", farm_code: "ARL", license_value: LICENSE_ARL_MED },
          { value: "West 4", label: "West 4", farm_code: "ARL", license_value: LICENSE_ARL_MED },
          { value: "West 22", label: "West 22", farm_code: "ARL", license_value: LICENSE_ARL_MED, tone: "metrc" },
        ],
        plantLocations: [
          { location: "West 3", n: 2, strains: 1 },
          { location: "West 4", n: 1, strains: 1 },
        ],
        fromLocation: "West 3",
        plants: [
          { tag: "1A4050000000000000000101", strain: "Bermuda Triangle", location: "West 3", phase: "flowering" },
          { tag: "1A4050000000000000000102", strain: "Bermuda Triangle", location: "West 3", phase: "flowering" },
        ],
      },
      "en"
    );
    expect(html).toContain('<option value="West 3" selected>West 3 (2)</option>');
    expect(html).toContain('data-pick-found="plants" data-plant-count="2"');
    expect(html).toContain("Bermuda Triangle 2");
    expect(html).toContain('<input type="hidden" name="from_location" value="West 3">');
    expect(html).not.toContain('<option value="West 3">West 3</option>');
    expect(html).toContain('<option value="West 4">West 4</option>');
    expect(html).toContain('<option value="West 22">West 22 (from METRC)</option>');
    expect(html).toContain(`<code>${LICENSE_ARL_MED}</code>: 2 plants.`);
    // The toggle drops a license the other kind cannot hold (the processor).
    const proc = changeLocationPage({ ...base, kind: "packages", license: LICENSE_AU_PROCESSOR }, "en");
    expect(proc).toContain('href="/inventory/change-locations?kind=plants&amp;farm=PNN"');
    expect(proc).toContain(`href="/inventory/change-locations?kind=packages&amp;farm=PNN&amp;license=${encodeURIComponent(LICENSE_AU_PROCESSOR)}"`);
  });

  it("flashes the move and lists recent groups with their files", () => {
    const html = changeLocationPage(
      {
        ...base,
        ok: "moved",
        moved: { n: 1, to: "Trim Room 1", group: "g1" },
        recent: [
          { group_id: "g1", kind: "packages", farm_code: "PNN", license_value: LICENSE_AU_PROCESSOR, moved: 1, from_summary: "CSB", to_location: "Trim Room 1", move_date: "2026-09-11", newest_activity: "2026-09-11T22:00:00.000Z", untagged: 0 },
          { group_id: "g2", kind: "packages", farm_code: "PNN", license_value: LICENSE_AU_GROW, moved: 1, from_summary: "BARN", to_location: "Blast Freezer", move_date: "2026-09-11", newest_activity: "2026-09-11T21:00:00.000Z", untagged: 1 },
        ],
      },
      "en"
    );
    expect(html).toContain("data-move-flash");
    expect(html).toContain("Moved 1 package to Trim Room 1.");
    expect(html).toContain('href="/admin/uploads"');
    expect(html).toContain('data-move-group="g1"');
    expect(html).toContain('href="/admin/uploads/location_move/g1.csv"');
    expect(html).toContain("1 no METRC tag yet");
  });

  it("the export home lists an Execute beside the silo loads and marks untagged groups", () => {
    const html = pendingUploadsPage(
      [],
      "en",
      [],
      [],
      [],
      [],
      [],
      { movements: new Set(), batches: new Set(), parents: new Set() },
      [
        { group_id: "g1", kind: "plants", farm_code: "ARL", license_value: LICENSE_ARL_MED, moved: 2, from_summary: "West 3", to_location: "West 4", move_date: "2026-09-11", newest_activity: "2026-09-11T22:00:00.000Z", untagged: 0 },
        { group_id: "g2", kind: "packages", farm_code: "PNN", license_value: LICENSE_AU_GROW, moved: 1, from_summary: "BARN", to_location: "Blast Freezer", move_date: "2026-09-11", newest_activity: "2026-09-11T21:00:00.000Z", untagged: 1 },
      ]
    );
    expect(html).toContain("Location moves");
    expect(html).toContain('data-fold="location_moves" open');
    expect(html).toContain('data-location-move="g1"');
    expect(html).toContain("Plant location change");
    expect(html).toContain("2 plants");
    expect(html).toContain("West 3 &#8594; West 4");
    expect(html).toContain('href="/admin/uploads/location_move/g1.csv"');
    expect(html).toContain('action="/admin/uploads/location_move/g1/uploaded"');
    expect(html).toContain("Package location change");
    const g2 = html.indexOf('data-location-move="g2"');
    expect(html.slice(g2, g2 + 400)).toContain("data-tag-missing");
    const g1 = html.indexOf('data-location-move="g1"');
    expect(html.slice(g1, g2)).not.toContain("data-tag-missing");
  });
});
