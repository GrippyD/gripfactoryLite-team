import { describe, expect, it } from "vitest";
import {
  GATE_TYPE_CODES_DEFAULT,
  GATE_UNIT_GRAMS_DEFAULT,
  parseGateTypeCodes,
  parseGateUnitGrams,
} from "../src/config";
import {
  buildTestingFigures,
  gateItemType,
  gatePackageGrams,
  isPasteurizedTag,
  loadTestingSection,
  sheetInSeason,
  testingSection,
} from "../src/console";
import { migratedDb, seedBatch } from "./migrated";

const T = "2026-09-29T12:00:00.000Z";

describe("THE TESTING GATE parsers (canon 0.30.293)", () => {
  it("reads the type list, blank, spaces, and lower case", () => {
    expect(parseGateTypeCodes(null)).toEqual([...GATE_TYPE_CODES_DEFAULT]);
    expect(parseGateTypeCodes("   ")).toEqual(["BUD", "WPR", "PRE", "MOB"]);
    expect(parseGateTypeCodes(" bud , wpr , bud ")).toEqual(["BUD", "WPR"]);
    expect(parseGateTypeCodes("pre")).toEqual(["PRE"]);
  });

  it("reads the unit grams, blank, spaces, lower case, and a bad number", () => {
    expect(parseGateUnitGrams(null)).toEqual({ ...GATE_UNIT_GRAMS_DEFAULT });
    expect(parseGateUnitGrams("  ")).toEqual({ PRE: 28, MOB: 70 });
    expect(parseGateUnitGrams(" pre = 28 , mob = 70 ")).toEqual({ PRE: 28, MOB: 70 });
    expect(parseGateUnitGrams("PRE=28, MOB=nope")).toEqual({ PRE: 28 });
    expect(parseGateUnitGrams("MOB=nope")).toEqual({ PRE: 28, MOB: 70 });
    expect(parseGateUnitGrams("PRE=0, MOB=-4")).toEqual({ PRE: 28, MOB: 70 });
  });

  it("names a package type from the item, and grams from g or each", () => {
    expect(gateItemType("BUD - Papaya Cake - PNN - O")).toBe("BUD");
    expect(gateItemType("  pre - Roll")).toBe("PRE");
    expect(gateItemType("")).toBe("");
    expect(gatePackageGrams("g", 10.4, "BUD", { PRE: 28, MOB: 70 })).toBe(10);
    expect(gatePackageGrams("EA", 2, "PRE", { PRE: 28, MOB: 70 })).toBe(56);
    expect(gatePackageGrams("ea", 1, "MOB", { PRE: 28 })).toBeNull();
    expect(gatePackageGrams("lb", 1, "BUD", {})).toBeNull();
  });

  it("lets the hbn prefix name the year, and the entered date fill in", () => {
    expect(sheetInSeason({ hbn: "26901-ARL-GH-001", entered_testing: "2025-01-01" }, 2026)).toBe(true);
    expect(sheetInSeason({ hbn: "25999-PNN-GH-001", entered_testing: "2026-06-01" }, 2026)).toBe(false);
    expect(sheetInSeason({ hbn: null, entered_testing: "2026-04-01" }, 2026)).toBe(true);
    expect(sheetInSeason({ hbn: "", entered_testing: "2025-12-01" }, 2026)).toBe(false);
    expect(isPasteurizedTag("1a4050300000000000000c01", new Set(["1A4050300000000000000C01"]))).toBe(true);
    expect(isPasteurizedTag("nope", new Set(["1A4050300000000000000C01"]))).toBe(false);
  });

  it("draws one failure mode as a full ring", () => {
    const figures = buildTestingFigures({
      year: 2026,
      gateTypes: ["BUD"],
      unitGrams: { PRE: 28, MOB: 70 },
      mirror: [],
      cryo: [],
      orders: [],
      sheet: [
        {
          strain: "Only",
          hbn: "26001-ARL",
          entered_testing: null,
          status: "Failed",
          failure_mode: "Yeast",
          batch_weight_grams: 10,
          attempt: 1,
        },
      ],
      marketByHbn: new Map(),
    });
    expect(figures.slices).toHaveLength(1);
    expect(figures.slices[0].d).toBe("M 50 8 A 42 42 0 1 1 49.99 8 Z M 50 24 A 26 26 0 1 0 50.01 24 Z");
    expect(figures.slices[0].dx).toBe("0.000");
    expect(figures.slices[0].dy).toBe("6.000");
    expect(figures.ftq).toBe("0.0");
  });
});

describe("THE TESTING GATE on a migrated database (canon 0.30.293)", () => {
  it("seeds the two config rows", async () => {
    const m = await migratedDb();
    const rows = m.all(`SELECT key, value FROM app_config WHERE key IN ('gate_type_codes', 'gate_unit_grams') ORDER BY key`);
    expect(rows).toEqual([
      { key: "gate_type_codes", value: "BUD, WPR, PRE, MOB" },
      { key: "gate_unit_grams", value: "PRE=28, MOB=70" },
    ]);
  });

  it("reads empty as zeros, NA, and the two empty lines", async () => {
    const m = await migratedDb();
    const figures = await loadTestingSection(m.db, 2026);
    expect(figures.panes.map((pane) => pane.packages)).toEqual([0, 0, 0, 0]);
    expect(figures.fails).toBe(0);
    expect(figures.tests).toBe(0);
    expect(figures.ftq).toBeNull();
    expect(figures.slices).toEqual([]);
    const html = testingSection(figures, { year: 2026 });
    expect(html).toContain('data-hc="ftq">NA<');
    expect(html).toContain("No first-time tests on the sheet this season.");
    expect(html).toContain("No failed first-time tests on the sheet this season.");
    expect(html).toContain('data-hc-pie-empty');
    expect(html).not.toContain('class="hc-pie"');
  });

  it("pins the four panes, the six-row stats, and the strain list A / B", async () => {
    const m = await migratedDb();
    m.run(`UPDATE app_config SET value = 'PRE=28' WHERE key = 'gate_unit_grams'`);
    m.run(
      `INSERT INTO testing_labs (id, name, portal_kind, created_at, updated_at) VALUES ('lab-gate', 'SC', 'sc', ?, ?)`,
      T,
      T
    );
    const mirror = (row: { tag: string; item: string; qty: number; uom?: string; status: string; license?: string; gone?: string | null }) => {
      m.run(
        `INSERT INTO metrc_packages (tag, license_value, item, quantity, uom, lab_test_status, mount_id, first_seen_at, changed_at, gone_at)
         VALUES (?, ?, ?, ?, ?, ?, 'mount-gate', ?, ?, ?)`,
        row.tag,
        row.license ?? "AU-G-C-000832",
        row.item,
        row.qty,
        row.uom ?? "g",
        row.status,
        T,
        T,
        row.gone ?? null
      );
    };
    const cryo = (row: { id: string; tag: string; type: string; weight: number; cryo: number | null; deleted?: string | null }) => {
      m.run(
        `INSERT INTO wip_packages (id, package_code, package_type_code, weight_grams, cryo_weight_grams, status, source, created_at, updated_at, deleted_at)
         VALUES (?, ?, ?, ?, ?, 'testing_queue', 'cryo', ?, ?, ?)`,
        row.id,
        row.tag,
        row.type,
        row.weight,
        row.cryo,
        T,
        T,
        row.deleted ?? null
      );
    };
    const order = (row: { id: string; tag: string; status: string; grams: number }) => {
      m.run(
        `INSERT INTO test_orders (id, source_package_tag, market, lab_id, panel, required_lab_test_batch, batch_grams, sample_grams, status, created_at, updated_at)
         VALUES (?, ?, 'adult-use', 'lab-gate', 'full_compliance', 'Raw Plant Material', ?, 14, ?, ?, ?)`,
        row.id,
        row.tag,
        row.grams,
        row.status,
        T,
        T
      );
    };
    mirror({ tag: "1A4050300000000000000A01", item: "BUD - Papaya - PNN - O", qty: 448, status: "NotSubmitted" });
    cryo({ id: "cryo-a01", tag: "1A4050300000000000000A01", type: "BUD", weight: 448, cryo: 448 });
    mirror({ tag: "1A4050300000000000000A02", item: "BUD - Sched - PNN - O", qty: 224, status: "NotSubmitted" });
    cryo({ id: "cryo-a02", tag: "1A4050300000000000000A02", type: "BUD", weight: 224, cryo: 224 });
    order({ id: "ord-a02", tag: "1A4050300000000000000A02", status: "scheduled", grams: 999 });
    order({ id: "ord-a02b", tag: "1A4050300000000000000A02", status: "sampled", grams: 999 });
    mirror({ tag: "1A4050300000000000000A03", item: "BUD - In - PNN - O", qty: 100, status: "SubmittedForTesting" });
    cryo({ id: "cryo-a03", tag: "1A4050300000000000000A03", type: "BUD", weight: 5000, cryo: 5000 });
    order({ id: "ord-a03", tag: "1A4050300000000000000A03", status: "at_lab", grams: 100 });
    mirror({ tag: "1A4050300000000000000A04", item: "BUD - Pass - PNN - O", qty: 200, status: "TestPassed" });
    mirror({ tag: "1A4050300000000000000A05", item: "WPR - Retest - PNN - O", qty: 50, status: "RetestPassed" });
    mirror({ tag: "1A4050300000000000000A06", item: "PRE - Roll - PNN - O", qty: 2, uom: "ea", status: "TestPassed" });
    mirror({ tag: "1A4050300000000000000A07", item: "MOB - Cart - PNN - O", qty: 1, uom: "ea", status: "NotSubmitted" });
    cryo({ id: "cryo-a07", tag: "1A4050300000000000000A07", type: "MOB", weight: 70, cryo: 70 });
    mirror({ tag: "1A4050300000000000000A08", item: "BUD - Fail - PNN - O", qty: 80, status: "TestFailed" });
    mirror({ tag: "1A4050300000000000000A09", item: "WIP - Hide - PNN - O", qty: 1000, status: "NotSubmitted" });
    cryo({ id: "cryo-a09", tag: "1A4050300000000000000A09", type: "WIP", weight: 1000, cryo: 1000 });
    mirror({ tag: "1A4050300000000000000A10", item: "BUD - Gone - PNN - O", qty: 1000, status: "TestPassed", gone: T });
    mirror({ tag: "1A4050300000000000000A11", item: "SHA - Shake - PNN - O", qty: 999, status: "TestPassed" });
    mirror({ tag: "1A4050300000000000000A12", item: "BUD - Other - PNN - O", qty: 1000, status: "TestPassed", license: "ZZ-NO-FARM" });
    mirror({ tag: "1A4050300000000000000A13", item: "BUD - Raw - PNN - O", qty: 999, status: "NotSubmitted" });
    mirror({ tag: "1A4050300000000000000A14", item: "BUD - Results - PNN - O", qty: 77, status: "NotSubmitted" });
    cryo({ id: "cryo-a14", tag: "1A4050300000000000000A14", type: "BUD", weight: 77, cryo: 77 });
    order({ id: "ord-a14", tag: "1A4050300000000000000A14", status: "results_in", grams: 77 });
    cryo({ id: "cryo-only", tag: "1A4050300000000000000B01", type: "BUD", weight: 1, cryo: 88 });
    cryo({ id: "cryo-fall", tag: "1A4050300000000000000B02", type: "WPR", weight: 10, cryo: null });
    cryo({ id: "cryo-ord", tag: "1A4050300000000000000B03", type: "WPR", weight: 40, cryo: 40 });
    order({ id: "ord-b03", tag: "1A4050300000000000000B03", status: "in_transit", grams: 30 });
    order({ id: "ord-notag", tag: "", status: "scheduled", grams: 16 });
    cryo({ id: "cryo-dead", tag: "1A4050300000000000000B04", type: "BUD", weight: 500, cryo: 500, deleted: T });
    cryo({ id: "cryo-sha", tag: "1A4050300000000000000B05", type: "SHA", weight: 500, cryo: 500 });

    seedBatch(m, { id: "hb-26903", hbn: "26903-ARL-GH-001-0-NA-26903", serial: 903, farm: "ARL" });
    seedBatch(m, { id: "hb-26904", hbn: "26904-ARL-GH-001-0-NA-26904", serial: 904, farm: "ARL" });
    m.run(`UPDATE harvest_batches SET market_strain = 'Beta' WHERE id = 'hb-26903'`);
    m.run(`UPDATE harvest_batches SET market_strain = 'Alpha' WHERE id = 'hb-26904'`);

    const sheet = (row: {
      id: string;
      strain?: string | null;
      hbn?: string | null;
      entered?: string | null;
      status: string;
      mode?: string | null;
      grams?: number | null;
      attempt?: number;
      deleted?: string | null;
    }) => {
      m.run(
        `INSERT INTO external_test_results (id, strain, hbn, entered_testing, status, failure_mode, batch_weight_grams, attempt, created_at, updated_at, deleted_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        row.id,
        row.strain ?? null,
        row.hbn ?? null,
        row.entered ?? null,
        row.status,
        row.mode ?? null,
        row.grams ?? null,
        row.attempt ?? 1,
        T,
        T,
        row.deleted ?? null
      );
    };
    sheet({ id: "s1", strain: "SheetA", hbn: "26901-ARL-GH-001-0-NA-26901", status: "pass", grams: 100 });
    sheet({ id: "s2", strain: "SheetB", hbn: "26902-ARL-GH-001-0-NA-26902", status: "Passed - Retest", grams: 100 });
    sheet({ id: "s3", strain: "Alpha", hbn: "26903-ARL-GH-001-0-NA-26903", status: "Failed", mode: "Coliforms", grams: 448 });
    sheet({ id: "s4", strain: "Alpha", hbn: "26904-ARL-GH-001-0-NA-26904", status: "Failed", mode: "Coliforms", grams: 224 });
    sheet({ id: "s5", strain: "Gamma", entered: "2026-04-01", status: "fail", mode: "Yeast", grams: 112 });
    sheet({ id: "s6", entered: "2026-05-01", status: "Failed", grams: 50 });
    sheet({ id: "s7", strain: "Alpha", hbn: "26903-ARL-GH-001-0-NA-26903", status: "Failed", mode: "Coliforms", grams: 10, attempt: 2 });
    sheet({ id: "s8", strain: "Open", hbn: "26903-ARL-GH-001-0-NA-26903", status: "In Progress", grams: 10 });
    sheet({ id: "s9", strain: "Old", hbn: "25999-PNN-GH-001-0-NA-25999", entered: "2026-06-01", status: "Failed", mode: "Coliforms", grams: 10 });
    sheet({ id: "s10", strain: "Gone", hbn: "26903-ARL-GH-001-0-NA-26903", status: "Failed", mode: "Coliforms", grams: 10, deleted: T });
    sheet({ id: "s11", strain: "LastYear", entered: "2025-12-01", status: "Failed", mode: "Yeast", grams: 10 });

    const figures = await loadTestingSection(m.db, 2026);
    const by = (gate: string) => figures.panes.find((pane) => pane.gate === gate)!;
    expect(by("ready")).toMatchObject({ packages: 4, grams: 546, unweighed: 1 });
    expect(by("scheduled")).toMatchObject({ packages: 3, grams: 270, unweighed: 0 });
    expect(by("in-testing")).toMatchObject({ packages: 1, grams: 100, unweighed: 0 });
    expect(by("passed")).toMatchObject({ packages: 3, grams: 306, unweighed: 0 });
    expect(figures.tests).toBe(6);
    expect(figures.fails).toBe(4);
    expect(figures.ftq).toBe("33.3");
    const coli = figures.slices.find((slice) => slice.mode === "Coliforms");
    expect(coli).toMatchObject({ count: 2, pct: "50.0", dx: "6.000", dy: "0.000", color: 1 });
    expect(coli?.strains.map((strain) => strain.label).sort()).toEqual(["Alpha", "Alpha / Beta"]);
    expect(coli?.strains.find((strain) => strain.label === "Alpha / Beta")).toMatchObject({ pct: "50.0", grams: 448 });
    expect(coli?.strains.find((strain) => strain.label === "Alpha")).toMatchObject({ pct: "50.0", grams: 224 });

    const html = testingSection(figures, { year: 2026 });
    expect(html).toContain('data-hc="ready_lb">1.22 lb<');
    expect(html).toContain('data-hc="ready_g">546 g<');
    expect(html).toContain('data-hc="ready_unweighed">1 packages without a unit weight<');
    expect(html).toContain('data-hc="scheduled_lb">0.60 lb<');
    expect(html).toContain('data-hc="in_testing_packages">1<');
    expect(html).toContain('data-hc="passed_packages">3<');
    expect(html).toContain('data-hc="first_fails">4<');
    expect(html).toContain('data-hc="first_tests">6<');
    expect(html).toContain('data-hc="ftq">33.3%<');
    expect(html).toContain('data-hc="ftq_n">6 first-time tests<');
    expect(html).toContain('data-hc-pie-mode="Coliforms" data-hc-pie-dx="6.000" data-hc-pie-dy="0.000"');
    expect(html).toContain('data-hc-pie-strains="Coliforms" hidden');
    expect(html).toContain('data-hc-pie-strain="Alpha / Beta"');
    expect(html).not.toContain("Alpha / Alpha");
    expect(html).toContain("open === mode ? null : mode");
    expect(html).toContain('data-hc-icon="ready"');
    expect(html.indexOf('data-hc-gate="ready"')).toBeLessThan(html.indexOf('data-hc-gate="scheduled"'));
    expect(html.indexOf('data-hc-gate="scheduled"')).toBeLessThan(html.indexOf('data-hc-gate="in-testing"'));
    expect(html.indexOf('data-hc-gate="in-testing"')).toBeLessThan(html.indexOf('data-hc-gate="passed"'));

    const es = testingSection(figures, { year: 2026, locale: "es" });
    expect(es).toContain("Año de cosecha 2026");
    expect(es).toContain("Listo para pruebas");
    expect(es).toContain("Fallos al primer intento");
    expect(es).toContain("sin nombre");
    expect(es).toContain("Alpha / Beta");
  });
});
