import { describe, expect, it } from "vitest";
import {
  NO_POTENCY_ROUTE,
  coverageOf,
  fillTable,
  harvestDateOf,
  thcOf,
  type ComplianceSample,
  type DataTable,
  type HarvestRow,
  type LabelFacts,
  type LocalPackage,
  type MirrorPackage,
  codedHarvestDate,
} from "../src/labeldata";

const TAG = "1A4050300000000000000E07";

function harvest(partial: Partial<HarvestRow> & Pick<HarvestRow, "id" | "hbn" | "entry_date">): HarvestRow {
  return {
    market_strain: null,
    strain_name: null,
    metrc_harvest_tag: null,
    farm_code: "PNN",
    farm_name: "Penn North",
    ...partial,
  };
}

function pkg(partial: Partial<MirrorPackage> & Pick<MirrorPackage, "tag">): MirrorPackage {
  return {
    license_value: null,
    source_harvests: null,
    source_packages: null,
    original_source_label: null,
    item: null,
    category: null,
    item_strain: null,
    quantity: null,
    uom: null,
    packaged_date: null,
    production_batch: null,
    lab_test_status: null,
    location: null,
    gone_at: null,
    ...partial,
  };
}

function local(partial: Partial<LocalPackage> & Pick<LocalPackage, "metrc_tag">): LocalPackage {
  return {
    harvest_batch_id: null,
    qty: null,
    uom: "g",
    license_value: null,
    location: null,
    farm_code: null,
    item_kind: null,
    ...partial,
  };
}

function sample(partial: Partial<ComplianceSample> & Pick<ComplianceSample, "source_metrc_tag" | "status">): ComplianceSample {
  return {
    sample_tag: null,
    harvest_batch: null,
    thc_potency_pct: null,
    program: "compliance",
    voided_at: null,
    finished_testing_on: "2026-09-01",
    testing_facility: "SC Labs",
    changed_at: "2026-09-01T00:00:00.000Z",
    ...partial,
  };
}

function facts(partial: Partial<LabelFacts> = {}): LabelFacts {
  return { packages: [], locals: [], harvests: [], samples: [], ...partial };
}

describe("harvest date routes", () => {
  it("uses the app's own harvest first", () => {
    const resolved = harvestDateOf(
      facts({
        locals: [local({ metrc_tag: TAG, harvest_batch_id: "h1" })],
        harvests: [harvest({ id: "h1", hbn: "26267-PNS", entry_date: "2026-08-01" })],
        packages: [pkg({ tag: TAG, source_harvests: "26200-OTHER" })],
      }),
      TAG
    );
    expect(resolved).toEqual({ value: "2026-08-01", route: "the app's harvest" });
  });

  it("matches a source harvest to the app's harvest", () => {
    const resolved = harvestDateOf(
      facts({
        packages: [pkg({ tag: TAG, source_harvests: "26267-PNS-OD-009-0-02-26050" })],
        harvests: [harvest({ id: "h1", hbn: "26267-PNS-OD-009-0-02-26050", entry_date: "2026-09-24T12:00:00.000Z" })],
      }),
      TAG
    );
    expect(resolved).toEqual({ value: "2026-09-24", route: "a matched source harvest" });
  });

  it("reads the date coded in the harvest name and refuses day 366 of a common year", () => {
    const coded = harvestDateOf(
      facts({ packages: [pkg({ tag: TAG, source_harvests: "26267-PNS-OD" })] }),
      TAG
    );
    expect(coded).toEqual({ value: "2026-09-24", route: "the date coded in the harvest name" });
    const leap = harvestDateOf(facts({ packages: [pkg({ tag: TAG, source_harvests: "24366-PNS" })] }), TAG);
    expect(leap.value).toBe("2024-12-31");
    const refused = harvestDateOf(facts({ packages: [pkg({ tag: TAG, source_harvests: "25366-PNS" })] }), TAG);
    expect(refused.value).toBe("");
  });

  it("walks the lineage, stops on a loop, and stops after six steps", () => {
    const parent = "1A4050300000000000000E08";
    const walked = harvestDateOf(
      facts({
        packages: [
          pkg({ tag: TAG, source_packages: parent }),
          pkg({ tag: parent }),
        ],
        locals: [local({ metrc_tag: parent, harvest_batch_id: "h1" })],
        harvests: [harvest({ id: "h1", hbn: "H", entry_date: "2026-07-04" })],
      }),
      TAG
    );
    expect(walked).toEqual({ value: "2026-07-04", route: "through the lineage, the app's harvest" });

    const loop = harvestDateOf(
      facts({
        packages: [
          pkg({ tag: TAG, source_packages: parent }),
          pkg({ tag: parent, source_packages: TAG }),
        ],
      }),
      TAG
    );
    expect(loop.value).toBe("");

    const chain = ["p0", "p1", "p2", "p3", "p4", "p5", "p6", "p7"];
    const packages = chain.slice(0, -1).map((tag, index) => pkg({ tag, source_packages: chain[index + 1] }));
    packages.push(pkg({ tag: "p7" }));
    const tooFar = harvestDateOf(
      facts({
        packages,
        locals: [local({ metrc_tag: "p7", harvest_batch_id: "hfar" })],
        harvests: [harvest({ id: "hfar", hbn: "FAR", entry_date: "2026-01-02" })],
      }),
      "p0"
    );
    expect(tooFar.value).toBe("");
    const atCap = harvestDateOf(
      facts({
        packages,
        locals: [local({ metrc_tag: "p6", harvest_batch_id: "hcap" })],
        harvests: [harvest({ id: "hcap", hbn: "CAP", entry_date: "2026-01-03" })],
      }),
      "p0"
    );
    expect(atCap.value).toBe("2026-01-03");
  });

  it("uses the earliest date when a package names several harvests", () => {
    const resolved = harvestDateOf(
      facts({
        packages: [pkg({ tag: TAG, source_harvests: "H-LATE, H-EARLY" })],
        harvests: [
          harvest({ id: "a", hbn: "H-LATE", entry_date: "2026-09-02" }),
          harvest({ id: "b", hbn: "H-EARLY", entry_date: "2026-08-15" }),
        ],
      }),
      TAG
    );
    expect(resolved).toEqual({ value: "2026-08-15", route: "the earliest of several harvests" });
  });
});

describe("THC percent routes", () => {
  it("uses the package's own passed sample and skips a newer one with no potency", () => {
    const resolved = thcOf(
      facts({
        samples: [
          sample({ source_metrc_tag: TAG, status: "passed", thc_potency_pct: null, finished_testing_on: "2026-09-02" }),
          sample({ source_metrc_tag: TAG, status: "passed", thc_potency_pct: 18, finished_testing_on: "2026-09-01" }),
        ],
      }),
      TAG
    );
    expect(resolved).toEqual({ value: "18", route: "the package's own passed sample" });
  });

  it("follows the lineage", () => {
    const parent = "1A4050300000000000000E08";
    const resolved = thcOf(
      facts({
        packages: [pkg({ tag: TAG, original_source_label: parent })],
        samples: [sample({ source_metrc_tag: parent, status: "retest_passed", thc_potency_pct: 21.5 })],
      }),
      TAG
    );
    expect(resolved).toEqual({ value: "21.5", route: "a passed sample on the lineage" });
  });

  it("uses the harvest's one passed potency and blanks when two differ", () => {
    const one = thcOf(
      facts({
        locals: [local({ metrc_tag: TAG, harvest_batch_id: "h1" })],
        harvests: [harvest({ id: "h1", hbn: "26267-PNS", entry_date: "2026-09-24" })],
        samples: [sample({ source_metrc_tag: "OTHER", status: "passed", thc_potency_pct: 22.4, harvest_batch: "26267-PNS" })],
      }),
      TAG
    );
    expect(one).toEqual({ value: "22.4", route: "the harvest's one passed potency" });
    const two = thcOf(
      facts({
        locals: [local({ metrc_tag: TAG, harvest_batch_id: "h1" })],
        harvests: [harvest({ id: "h1", hbn: "26267-PNS", entry_date: "2026-09-24" })],
        samples: [
          sample({ source_metrc_tag: "A", status: "passed", thc_potency_pct: 20, harvest_batch: "26267-PNS" }),
          sample({ source_metrc_tag: "B", status: "passed", thc_potency_pct: 21, harvest_batch: "26267-PNS", finished_testing_on: "2026-09-03" }),
        ],
      }),
      TAG
    );
    expect(two.value).toBe("");
  });

  it("never takes a failed sample", () => {
    const resolved = thcOf(
      facts({
        samples: [sample({ source_metrc_tag: TAG, status: "failed", thc_potency_pct: 30 })],
      }),
      TAG
    );
    expect(resolved).toEqual({ value: "", route: NO_POTENCY_ROUTE });
  });
});

describe("custom label data", () => {
  const table: DataTable = {
    id: "t1",
    name: "Notes",
    mode: "keyed",
    key_field: "strain",
    columns: [
      { key: "c0", label: "Strain", type: "text" },
      { key: "c1", label: "Note", type: "text" },
    ],
    rows: [
      ["Jokerz", "Room 4"],
      ["Gelato", "Room 1"],
    ],
  };

  it("fills a keyed row and leaves a missing key blank", () => {
    const known = facts({
      locals: [local({ metrc_tag: TAG, harvest_batch_id: "h1" })],
      harvests: [harvest({ id: "h1", hbn: "H", entry_date: "2026-08-01", market_strain: "Jokerz" })],
    });
    expect(fillTable(known, TAG, table)).toEqual({ values: { c0: "Jokerz", c1: "Room 4" }, route: "the keyed row" });
    const missing = facts({
      locals: [local({ metrc_tag: TAG, harvest_batch_id: "h1" })],
      harvests: [harvest({ id: "h1", hbn: "H", entry_date: "2026-08-01", market_strain: "Other" })],
    });
    expect(fillTable(missing, TAG, table).route).toBe("no matching row");
    expect(fillTable(missing, TAG, table).values.c1).toBe("");
  });

  it("fills a static table from its first row", () => {
    const filled = fillTable(facts(), TAG, { ...table, mode: "static", key_field: null });
    expect(filled).toEqual({ values: { c0: "Jokerz", c1: "Room 4" }, route: "the table's first row" });
  });
});

describe("coverage", () => {
  it("counts live packages by route and the ones that resolve neither", () => {
    const report = coverageOf(
      facts({
        packages: [
          pkg({ tag: "LIVE", source_harvests: "26267-PNS" }),
          pkg({ tag: "GONE", gone_at: "2026-09-01", source_harvests: "26267-PNS" }),
          pkg({ tag: "NONE" }),
        ],
        samples: [sample({ source_metrc_tag: "LIVE", status: "passed", thc_potency_pct: 19 })],
      })
    );
    expect(report.live).toBe(2);
    expect(report.harvest["the date coded in the harvest name"]).toBe(1);
    expect(report.thc["the package's own passed sample"]).toBe(1);
    expect(report.thc[NO_POTENCY_ROUTE]).toBe(1);
    expect(report.neither).toBe(1);
  });
});

describe("THE L2 GATE: the date a METRC harvest name carries", () => {
  it("reads 2026 day of year, 2025 spreadsheet days, and never a bare lot token", () => {
    expect(codedHarvestDate("26267-PNS-OD-009-0-02-26050")).toBe("2026-09-24");
    expect(codedHarvestDate("45922-PNN-OD-071-0-02-25030")).toBe("2025-09-22");
    expect(codedHarvestDate("45951-PNN-OD-051-0-02-25162")).toBe("2025-10-21");
    expect(codedHarvestDate("46024-PNN-OD-071-0-02-26001")).toBe("2026-01-02");
    expect(codedHarvestDate("24089")).toBeNull();
    expect(codedHarvestDate("26267-PNS-OD-009-0-02-24050")).toBeNull();
    expect(codedHarvestDate("26267-PNS")).toBe("2026-09-24");
  });
});
