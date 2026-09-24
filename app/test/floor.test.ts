import { describe, expect, it } from "vitest";
import { HttpError } from "../src/audit";
import { addToManifest, setManifestDestination } from "../src/actions";
import {
  deriveDestinationLocation,
  growLicenseForFarm,
  inheritedLotLicense,
  isInternalCsaToCsb,
  LICENSE_ARL_AU,
  LICENSE_ARL_MED,
  LICENSE_AU_GROW,
  LICENSE_AU_PROCESSOR,
  LICENSE_PNN_MED,
  LICENSE_PNS_AU,
  LICENSE_PNS_MED,
  licenseClassOf,
  LOC_ARL_BARN,
  LOC_BARN,
  LOC_CSA,
  LOC_CSB,
  LOC_PNS_BARN,
  ORIGIN_PAIR_ERROR,
  SITE_LICENSES,
  treeLicenseForPackage,
} from "../src/config";
import { intercoFloorPage, intercoMenuPage, stationPage } from "../src/html";
import { buildFloorWindows, roadChips } from "../src/interco";
import { planFinishMint } from "../src/ledger";
import { lookupSectionPage } from "../src/pages";
import { stationByKey } from "../src/pipeline";
import { themeStylesheet } from "../src/theme";

function actorForm(fields: Record<string, string>): FormData {
  const form = new FormData();
  form.set("person_id", "p1");
  for (const [k, v] of Object.entries(fields)) form.set(k, v);
  return form;
}

describe("license helpers", () => {
  it("classifies known AU and Med values and defaults unknown to au", () => {
    expect(licenseClassOf(LICENSE_ARL_AU)).toBe("au");
    expect(licenseClassOf(LICENSE_AU_PROCESSOR)).toBe("au");
    expect(licenseClassOf(LICENSE_PNN_MED)).toBe("med");
    expect(licenseClassOf(LICENSE_ARL_MED)).toBe("med");
    expect(licenseClassOf(LICENSE_PNS_MED)).toBe("med");
    // Canon 0.30.1 fork 5: GR-C-002600 IS the ARL Med line now; a value the
    // maps have never heard of stays the au default.
    expect(licenseClassOf("GR-C-002600")).toBe("med");
    expect(licenseClassOf("AU-NEVER-HEARD")).toBe("au");
  });

  it("lists site licenses in render order", () => {
    expect(SITE_LICENSES.ARL).toEqual([LICENSE_ARL_AU, LICENSE_ARL_MED]);
    expect(SITE_LICENSES.PNS).toEqual([LICENSE_PNS_AU, LICENSE_PNS_MED]);
    expect(SITE_LICENSES.PNN).toEqual([LICENSE_AU_GROW, LICENSE_AU_PROCESSOR, LICENSE_PNN_MED]);
  });

  it("derives dest barn except the door: 832 to 694 from any 832-side spot lands CSB (canon 0.30.26)", () => {
    expect(isInternalCsaToCsb(LICENSE_AU_GROW, LOC_CSA, LICENSE_AU_PROCESSOR)).toBe(true);
    expect(deriveDestinationLocation(LICENSE_AU_GROW, LOC_CSA, LICENSE_AU_PROCESSOR)).toBe(LOC_CSB);
    // Owner, 2026-09-09: "we've crossed the door" from the barn; the door no
    // longer hangs on CSA (his 0.30.19 word: dry spaces dropped in favor of barn).
    expect(isInternalCsaToCsb(LICENSE_AU_GROW, LOC_BARN, LICENSE_AU_PROCESSOR)).toBe(true);
    expect(isInternalCsaToCsb(LICENSE_AU_GROW, "Silo 2", LICENSE_AU_PROCESSOR)).toBe(true);
    expect(isInternalCsaToCsb(LICENSE_AU_GROW, "", LICENSE_AU_PROCESSOR)).toBe(true);
    expect(deriveDestinationLocation(LICENSE_AU_GROW, LOC_BARN, LICENSE_AU_PROCESSOR)).toBe(LOC_CSB);
    // Not the door: another farm's grow license to 694, or 832 to another farm.
    expect(isInternalCsaToCsb(LICENSE_ARL_AU, LOC_ARL_BARN, LICENSE_AU_PROCESSOR)).toBe(false);
    expect(isInternalCsaToCsb(LICENSE_AU_GROW, LOC_BARN, LICENSE_PNS_AU)).toBe(false);
    expect(deriveDestinationLocation(LICENSE_ARL_AU, LOC_ARL_BARN, LICENSE_AU_GROW)).toBe(LOC_BARN);
    expect(deriveDestinationLocation(LICENSE_AU_GROW, LOC_BARN, LICENSE_PNS_AU)).toBe(LOC_PNS_BARN);
    // Canon 0.30.1 fork 5: GR-C-002600 is the ARL Med line, so its dest barn
    // derives like any ARL license; a truly external value still derives none.
    expect(deriveDestinationLocation(LICENSE_AU_PROCESSOR, LOC_CSB, "GR-C-002600")).toBe(LOC_ARL_BARN);
    expect(deriveDestinationLocation(LICENSE_AU_PROCESSOR, LOC_CSB, "AU-EXTERNAL-XYZ")).toBe("");
  });

  it("inherits a lot license from the batch, else the farm AU grow", () => {
    expect(inheritedLotLicense(LICENSE_PNN_MED, "PNN")).toBe(LICENSE_PNN_MED);
    expect(inheritedLotLicense(null, "ARL")).toBe(LICENSE_ARL_AU);
    expect(inheritedLotLicense("", "PNS")).toBe(LICENSE_PNS_AU);
    expect(growLicenseForFarm("PNN")).toBe(LICENSE_AU_GROW);
  });

  it("places a package under a known license, else the location home", () => {
    expect(treeLicenseForPackage(LICENSE_AU_GROW, LOC_ARL_BARN)).toBe(LICENSE_AU_GROW);
    expect(treeLicenseForPackage("mystery", LOC_ARL_BARN)).toBe(LICENSE_ARL_AU);
    expect(treeLicenseForPackage("mystery", LOC_CSB)).toBe(LICENSE_AU_PROCESSOR);
  });
});

describe("four-window grouping", () => {
  it("puts a 1132 batch lot under Penn North Med and a package under its license", () => {
    const windows = buildFloorWindows(
      [
        {
          id: "pkg1",
          package_code: "26011",
          qty: 1200,
          license_value: LICENSE_PNS_AU,
          location: LOC_PNS_BARN,
          strain_name: "Gelato",
          hbn: "26246-PNS-GH-027-0-NA-26011",
        },
      ],
      [
        {
          id: "lot1",
          truck_number: null,
          weight_grams: 4000,
          farm_code: "PNN",
          entry_date: "2026-09-06",
          strain_name: "Cake",
          hbn: "26246-PNN-GH-027-0-NA-26020",
          license_value: LICENSE_PNN_MED,
        },
      ]
    );
    expect(windows.map((w) => w.site)).toEqual(["ARL", "PNS", "PNN"]);
    const pnsAu = windows[1].licenses.find((l) => l.license === LICENSE_PNS_AU)!;
    expect(pnsAu.items[0]?.title).toBe("26011");
    expect(pnsAu.items[0]?.lotToken).toBe("26011");
    const pnnMed = windows[2].licenses.find((l) => l.license === LICENSE_PNN_MED)!;
    expect(pnnMed.items).toHaveLength(1);
    expect(pnnMed.items[0]?.kind).toBe("lot");
    expect(pnnMed.items[0]?.title).toContain("Cake");
  });
});

describe("four-window floor markup", () => {
  const licenses = [
    { value: LICENSE_ARL_AU, label: "ARL AU" },
    { value: LICENSE_ARL_MED, label: "ARL Med (placeholder)" },
    { value: LICENSE_PNS_AU, label: "PNS AU" },
    { value: LICENSE_PNS_MED, label: "PNS Med (placeholder)" },
    { value: LICENSE_AU_GROW, label: "PNN AU" },
    { value: LICENSE_AU_PROCESSOR, label: "PNN Processor" },
    { value: LICENSE_PNN_MED, label: "PNN Med (1132 stack)" },
  ];

  it("renders windows left to right and colors license lines by class", () => {
    const html = intercoMenuPage("en", {
      sites: buildFloorWindows(
        [
          {
            id: "pkg1",
            package_code: "26011",
            qty: 1200,
            license_value: LICENSE_PNS_AU,
            location: LOC_PNS_BARN,
            strain_name: "Gelato",
            hbn: "26246-PNS-GH-027-0-NA-26011",
          },
        ],
        [
          {
            id: "lot1",
            truck_number: null,
            weight_grams: 4000,
            farm_code: "PNN",
            entry_date: "2026-09-06",
            strain_name: "Cake",
            hbn: "26246-PNN-GH-027-0-NA-26020",
            license_value: LICENSE_PNN_MED,
          },
        ]
      ),
      licenses,
      road: [],
      destLocation: "",
      destIsExternal: false,
    });
    const arl = html.indexOf("Arlington");
    const pns = html.indexOf(">PNS<") === -1 ? html.indexOf("PNS") : html.indexOf(">PNS<");
    const penn = html.indexOf("Penn North");
    const work = html.indexOf("Working pane");
    expect(arl).toBeGreaterThan(-1);
    expect(pns).toBeGreaterThan(arl);
    expect(penn).toBeGreaterThan(pns);
    expect(work).toBeGreaterThan(penn);
    expect(html).toContain("lic-au");
    expect(html).toContain("lic-med");
    expect(html).toContain("pkg-sub");
    expect(html).toContain("Weight (g)");
    expect(html).toContain("26011");
    expect(html).toContain("Add to new manifest");
    expect(html).toContain("- EMPTY -");
    expect(html).toContain('href="/interco/arrivals/arl"');
    expect(html).toContain("On the road");
    expect(html).not.toContain('href="/interco/send/');
    expect(html).not.toContain('href="/interco/door"');
  });

  it("focus law keeps the origin license open and dims the others", () => {
    const html = intercoFloorPage("en", {
      sites: buildFloorWindows(
        [
          {
            id: "pkg1",
            package_code: "SHIP1",
            qty: 80,
            license_value: LICENSE_PNS_AU,
            location: LOC_PNS_BARN,
            strain_name: "Gelato",
            hbn: "26246-PNS-GH-027-0-NA-26011",
          },
        ],
        []
      ),
      licenses,
      road: [],
      destLocation: LOC_BARN,
      destIsExternal: false,
      active: {
        movement: {
          id: "mv1",
          movement_kind: "interco",
          origin_farm: "PNS",
          destination_farm: "PNN",
          origin_license: LICENSE_PNS_AU,
          destination_license: LICENSE_AU_GROW,
          truck_number: null,
          driver: null,
          planned_route: null,
          transfer_type: null,
          invoice_number: null,
          payment_term_days: null,
          planned_departure: null,
          planned_arrival: null,
          gross_weight: null,
          gross_weight_uom: null,
          transporter_license: null,
          transporter_phone: null,
          driver_occupational_license: null,
          driver_license_number: null,
          vehicle_make: null,
          vehicle_model: null,
          vehicle_plate: null,
          metrc_manifest_number: null,
          status: "building",
          exported_at: null,
          completed_at: null,
          created_at: "2026-09-06T00:00:00.000Z",
          origin_location: LOC_PNS_BARN,
          destination_location: LOC_BARN,
        },
        items: [
          {
            id: "row1",
            movement_id: "mv1",
            local_inventory_item_id: "pkg1",
            qty: 80,
            uom: "g",
            received_qty: null,
            received_at: null,
            received_by: null,
            receipt_id: null,
            rejected_at: null,
            rejected_by: null,
            reject_reason: null,
            package_code: "SHIP1",
            item_kind: "WIP",
            strain_name: "Gelato",
            location: LOC_PNS_BARN,
            farm_code: "PNS",
            harvest_batch_id: "hb1",
            hbn: "26246-PNS-GH-027-0-NA-26011",
            is_wet_lot: 0,
          },
        ],
      },
    });
    expect(html).toContain("lic-dim");
    expect(html).toContain("Add to existing manifest");
    expect(html).toContain("Finish manifest");
    expect(html).toContain(`${LICENSE_PNS_AU} / ${LOC_PNS_BARN}`);
    expect(html).toContain("BARN");
  });
});

describe("acquire and licenses admin", () => {
  it("Acquire HBN carries a required license select", () => {
    const acquire = stationByKey("acquire_hbn")!;
    const field = acquire.fields.find((f) => f.name === "license_value");
    expect(field).toMatchObject({ label: "License", input: "lookup", lookup: "license", required: true });
    const html = stationPage(
      acquire,
      [],
      "",
      {
        farms: [{ value: "ARL", label: "Arlington" }],
        grow_methods: [],
        strains: [],
        silo_number: [],
        license: [{ value: LICENSE_ARL_AU, label: "ARL AU", farm_code: "ARL" }],
      },
      {},
      {},
      undefined,
      undefined,
      undefined,
      "en"
    );
    expect(html).toContain('name="license_value"');
    expect(html).toContain("required");
    expect(html).toContain('data-farm="ARL"');
  });

  it("licenses admin carries the Farm column and add-form farm select", () => {
    const html = lookupSectionPage(
      "licenses",
      {
        people: [],
        farms: [{ code: "PNN" }],
        grow_methods: [],
        strains: [],
        dry_spaces: [],
        package_types: [],
        app_config: [],
      },
      [{ id: "l1", value: LICENSE_PNN_MED, label: "PNN Med (1132 stack)", farm_code: "PNN", sort_order: 2 }],
      "en"
    );
    expect(html).toContain("farm_code");
    expect(html).toContain('name="farm_code"');
    expect(html).toContain("PNN");
  });
});

describe("finish mint writes the batch license", () => {
  it("THE BLANK SLATE (canon 0.30.108): every birth lands in PNN's barn under PNN's grow license, whatever the batch carries", () => {
    const base = {
      wetWeightEntryId: "lot1",
      harvestBatchId: "hb1",
      strainId: "st1",
      farmCode: "ARL",
      spaceName: "Arlington Dry Room",
      wetTotal: 1234.5,
      hbn: "26246-ARL-GH-027-0-NA-26011",
      metrcHarvestTag: null,
      spaceKind: "hang",
    };
    // The med license and the ARL fallback both land 832 at BARN now (his pick: 832 at birth).
    const withLic = planFinishMint({ ...base, licenseValue: LICENSE_PNN_MED }, null);
    expect(withLic).toMatchObject({ action: "insert", license_value: LICENSE_AU_GROW, location: "BARN", farm_code: "ARL" });
    const fallback = planFinishMint({ ...base, licenseValue: null }, null);
    expect(fallback).toMatchObject({ action: "insert", license_value: LICENSE_AU_GROW, location: "BARN" });
    expect(LICENSE_ARL_AU).not.toBe(LICENSE_AU_GROW);
  });
});

describe("theme license colors", () => {
  it("ships lic-au and lic-med on every view sheet", () => {
    for (const view of ["lite", "co", "cerberus"] as const) {
      const sheet = themeStylesheet(view);
      expect(sheet).toContain(".lic-au");
      expect(sheet).toContain(".lic-med");
      expect(sheet).toContain(".lic-dim");
    }
    expect(themeStylesheet("lite")).toContain("color: #a16207");
    expect(themeStylesheet("cerberus")).toContain("color: #e6c35c");
  });
});

describe("add-to-manifest origin pair", () => {
  function makeFloorDb() {
    const people = [{ id: "p1", display_name: "TL", email: "tl@local", is_active: 1, deleted_at: null as string | null }];
    const inventory = [
      {
        id: "pkg-pns",
        qty: 80,
        uom: "g",
        location: LOC_PNS_BARN,
        license_value: LICENSE_PNS_AU,
        deleted_at: null as string | null,
      },
      {
        id: "pkg-arl",
        qty: 40,
        uom: "g",
        location: LOC_ARL_BARN,
        license_value: LICENSE_ARL_AU,
        deleted_at: null as string | null,
      },
    ];
    const movements: Array<{
      id: string;
      origin_license: string;
      origin_location: string;
      destination_license: string;
      destination_location: string;
      status: string;
      created_at: string;
      deleted_at: string | null;
    }> = [];
    const items: Array<{ id: string; movement_id: string; local_inventory_item_id: string; deleted_at: string | null }> =
      [];
    function norm(sql: string) {
      return sql.replace(/\s+/g, " ").trim().toLowerCase();
    }
    function exec(sql: string, args: unknown[]) {
      const q = norm(sql);
      if (q.includes("from people") && q.includes("where id")) {
        return people.find((p) => p.id === args[0] && !p.deleted_at) ?? null;
      }
      if (q.includes("from local_inventory_items") && q.includes("where id")) {
        return inventory.find((i) => i.id === args[0] && !i.deleted_at) ?? null;
      }
      if (q.startsWith("insert into interco_movements")) {
        movements.push({
          id: String(args[0]),
          origin_license: String(args[3]),
          origin_location: String(args[10]),
          destination_license: String(args[4]),
          destination_location: String(args[11] ?? ""),
          status: String(args[5]),
          created_at: String(args[6]),
          deleted_at: null,
        });
        return { success: true };
      }
      if (q.startsWith("insert into interco_movement_items")) {
        items.push({
          id: String(args[0]),
          movement_id: String(args[1]),
          local_inventory_item_id: String(args[2]),
          deleted_at: null,
        });
        return { success: true };
      }
      if (q.startsWith("insert into record_change_log")) return { success: true };
      if (q.includes("from interco_movements") && q.includes("status = 'building'")) {
        return movements
          .filter((m) => !m.deleted_at && m.status === "building")
          .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
      }
      if (q.includes("from interco_movements") && q.includes("where id")) {
        const hit = movements.find((m) => m.id === args[0] && !m.deleted_at);
        return hit
          ? {
              ...hit,
              movement_kind: "interco",
              origin_farm: "PNS",
              destination_farm: null,
              truck_number: null,
              driver: null,
              planned_route: null,
              transfer_type: null,
              invoice_number: null,
              payment_term_days: null,
              planned_departure: null,
              planned_arrival: null,
              gross_weight: null,
              gross_weight_uom: null,
              transporter_license: null,
              transporter_phone: null,
              driver_occupational_license: null,
              driver_license_number: null,
              vehicle_make: null,
              vehicle_model: null,
              vehicle_plate: null,
              metrc_manifest_number: null,
              exported_at: null,
              completed_at: null,
            }
          : null;
      }
      if (q.startsWith("update interco_movements")) {
        const id = String(args[args.length - 1]);
        const row = movements.find((m) => m.id === id);
        if (row && q.includes("destination_license")) {
          row.destination_license = String(args[0]);
          row.destination_location = String(args[1]);
        }
        return { success: true };
      }
      return [];
    }
    function stmt(sql: string) {
      const args: unknown[] = [];
      const self = {
        bind(...next: unknown[]) {
          args.push(...next);
          return self;
        },
        async first() {
          const r = exec(sql, args);
          return Array.isArray(r) ? (r[0] ?? null) : r;
        },
        async all() {
          const r = exec(sql, args);
          return { results: Array.isArray(r) ? r : r ? [r] : [] };
        },
        async run() {
          exec(sql, args);
          return { success: true };
        },
      };
      return self;
    }
    return {
      movements,
      items,
      prepare: (sql: string) => stmt(sql),
      async batch(stmts: { run: () => Promise<unknown> }[]) {
        for (const s of stmts) await s.run();
      },
    };
  }

  it("add to new locks the origin pair and a mismatch refuses 400 in words", async () => {
    const db = makeFloorDb();
    await addToManifest(
      db as unknown as D1Database,
      actorForm({
        add_mode: "new",
        origin_license: LICENSE_PNS_AU,
        origin_location: LOC_PNS_BARN,
        item_id: "pkg-pns",
      })
    );
    expect(db.movements).toHaveLength(1);
    expect(db.movements[0]?.origin_license).toBe(LICENSE_PNS_AU);
    expect(db.movements[0]?.origin_location).toBe(LOC_PNS_BARN);
    await expect(
      addToManifest(
        db as unknown as D1Database,
        actorForm({
          add_mode: "existing",
          origin_license: LICENSE_ARL_AU,
          origin_location: LOC_ARL_BARN,
          item_id: "pkg-arl",
        })
      )
    ).rejects.toMatchObject({ status: 400, message: ORIGIN_PAIR_ERROR });
    await expect(
      addToManifest(
        db as unknown as D1Database,
        actorForm({
          add_mode: "existing",
          origin_license: LICENSE_AU_GROW,
          origin_location: LOC_CSA,
          item_id: "pkg-pns",
        })
      )
    ).rejects.toBeInstanceOf(HttpError);
  });

  it("destination 694 from a CSA origin derives CSB", async () => {
    const db = makeFloorDb();
    db.movements.push({
      id: "mv-csa",
      origin_license: LICENSE_AU_GROW,
      origin_location: LOC_CSA,
      destination_license: "",
      destination_location: "",
      status: "building",
      created_at: "2026-09-06T00:00:00.000Z",
      deleted_at: null,
    });
    await setManifestDestination(
      db as unknown as D1Database,
      actorForm({
        movement_id: "mv-csa",
        destination_license: LICENSE_AU_PROCESSOR,
      })
    );
    expect(db.movements[0]?.destination_location).toBe(LOC_CSB);
  });
});

// Owner bug report 2026-09-08 (canon 0.30.9, "589af120 is an orphan"): THE
// TRUCK CARRIES ITS PAPER. The road names a truck's manifest on the truck row
// and names every other manifest's contents; a bare id never rides alone.
describe("road chips (canon 0.30.9)", () => {
  const words = { truck: "Truck", manifest: "Manifest", packages: "packages" };
  const grams = (n: number) => n.toFixed(2).replace(/\B(?=(\d{3})+\.)/g, ",");

  it("a truck row carries its riding manifest number", () => {
    const chips = roadChips(
      [
        {
          id: "lot1",
          truck_number: "1",
          weight_grams: 1000000,
          farm_code: "ARL",
          strain_name: "TEST MOOKY",
          manifest_id: "589af120-aaaa-4bbb-8ccc-000000000001",
          metrc_manifest_number: null,
        },
      ],
      [],
      {},
      words,
      grams
    );
    expect(chips).toHaveLength(1);
    expect(chips[0]?.label).toBe("Truck 1 - ARL / TEST MOOKY - 1,000,000.00 g - Manifest 589af120");
    expect(chips[0]?.href).toBe("/interco/arrivals/pnn");
  });

  it("a typed METRC manifest number wins over the short id", () => {
    const chips = roadChips(
      [
        {
          id: "lot1",
          truck_number: null,
          weight_grams: 500,
          farm_code: "PNS",
          strain_name: "Zuava",
          manifest_id: "589af120-aaaa-4bbb-8ccc-000000000001",
          metrc_manifest_number: "0001234567",
        },
      ],
      [],
      {},
      words,
      grams
    );
    expect(chips[0]?.label).toBe("PNS / Zuava - 500.00 g - Manifest 0001234567");
  });

  it("a manifest chip names its one package, never a bare id", () => {
    const chips = roadChips(
      [],
      [{ id: "9f1c2d3e-0000-4000-8000-000000000002", origin_farm: "ARL", destination_farm: "PNN", metrc_manifest_number: null }],
      { "9f1c2d3e-0000-4000-8000-000000000002": [{ package_code: "1A4FF0100000022000000123", strain_name: "Zuava", qty: 1500 }] },
      words,
      grams
    );
    expect(chips[0]?.label).toBe("ARL - PNN - 9f1c2d3e - 1A4FF0100000022000000123 / Zuava - 1,500.00 g");
    expect(chips[0]?.href).toBe("/interco/arrivals/pnn?movement=9f1c2d3e-0000-4000-8000-000000000002");
  });

  it("a manifest chip with several packages counts them and totals", () => {
    const chips = roadChips(
      [],
      [{ id: "9f1c2d3e-0000-4000-8000-000000000002", origin_farm: "PNN", destination_farm: "ARL", metrc_manifest_number: null }],
      {
        "9f1c2d3e-0000-4000-8000-000000000002": [
          { package_code: "A", strain_name: null, qty: 100 },
          { package_code: "B", strain_name: null, qty: 250.5 },
        ],
      },
      words,
      grams
    );
    expect(chips[0]?.label).toBe("PNN - ARL - 9f1c2d3e - 2 packages - 350.50 g");
    expect(chips[0]?.destSite).toBe("arl");
  });
});
