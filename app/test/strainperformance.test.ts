import { describe, expect, it } from "vitest";
import { weightedBtrToDate, TRIM_SEASON_SQL, type TrimSeasonRow } from "../src/console";
import { GRAMS_PER_LB, parseBtrTypeCodes } from "../src/config";
import { DICT, t } from "../src/i18n";
import {
  STRAIN_PERFORMANCE_LOTS_SQL,
  STRAIN_PERFORMANCE_METHOD,
  STRAIN_PERFORMANCE_PLANTS_SQL,
  buildStrainPerformance,
  estimateInForce,
  formatWhole,
  loadStrainPerformance,
  strainPerformanceName,
  strainPerformanceSection,
  wholePoundsFromGrams,
  type StrainPerformanceEstimate,
  type StrainPerformanceLot,
  type StrainPerformancePlants,
} from "../src/strainperformance";
import { migratedDb } from "./migrated";

const LB = GRAMS_PER_LB;

const lot = (over: Partial<StrainPerformanceLot> = {}): StrainPerformanceLot => ({
  id: "",
  farm: "PNN",
  strain: "Gelato",
  marketStrain: "",
  wetGrams: 100 * LB,
  dryGrams: 50 * LB,
  plantCount: 10,
  unloaded: true,
  ...over,
});

const plants = (over: Partial<StrainPerformancePlants> = {}): StrainPerformancePlants => ({
  farm: "PNN",
  strain: "Gelato",
  plants: 4,
  ...over,
});

const estimate = (over: Partial<StrainPerformanceEstimate> = {}): StrainPerformanceEstimate => ({
  strainName: "Gelato",
  farm: "PNN",
  effectiveDate: "2026-09-01",
  dryLbPerPlant: 4,
  ...over,
});

const DAY = "2026-10-13";

function row(model: ReturnType<typeof buildStrainPerformance>, strain: string, farm: string) {
  const found = model.rows.find((item) => !item.total && item.strain === strain && item.farm === farm);
  if (!found) throw new Error(`missing ${strain} ${farm}`);
  return found;
}

describe("SP1 strain performance", () => {
  it("names a row by the market strain when one is typed, otherwise the real strain", () => {
    expect(strainPerformanceName("Gelato", "Ice Cream")).toBe("Ice Cream");
    expect(strainPerformanceName("Gelato", "  ")).toBe("Gelato");
    expect(strainPerformanceName("Gelato", "")).toBe("Gelato");
    expect(strainPerformanceName("Gelato", null)).toBe("Gelato");
    expect(strainPerformanceName("  Gelato  ", "Ice Cream")).toBe("Ice Cream");
    const model = buildStrainPerformance({
      day: DAY,
      lots: [
        lot({ strain: "Gelato", marketStrain: "Ice Cream", farm: "PNN" }),
        lot({ strain: "Gelato", marketStrain: "", farm: "PNS" }),
        lot({ strain: "Gelato", marketStrain: "   ", farm: "ARL" }),
      ],
      plants: [plants({ strain: "ice cream", farm: "PNN", plants: 3 })],
      estimates: [],
    });
    expect(model.rows.filter((item) => !item.total).map((item) => [item.strain, item.farm, item.plantsRemaining])).toEqual([
      ["Gelato", "ARL", 0],
      ["Gelato", "PNS", 0],
      ["Ice Cream", "PNN", 3],
    ]);
  });

  it("is one row per strain and farm, sorted by strain then farm, with a Total", () => {
    const model = buildStrainPerformance({
      day: DAY,
      lots: [
        lot({ strain: "Banana", farm: "PNS", marketStrain: "" }),
        lot({ strain: "Apple", farm: "PNN", marketStrain: "" }),
      ],
      plants: [plants({ strain: "Apple", farm: "arl", plants: 9 }), plants({ strain: "Only Plants", farm: "PNN", plants: 2 })],
      estimates: [],
    });
    expect(model.rows.map((item) => [item.strain, item.farm])).toEqual([
      ["Apple", "ARL"],
      ["Apple", "PNN"],
      ["Banana", "PNS"],
      ["Only Plants", "PNN"],
      ["Total", ""],
    ]);
    expect(model.rows.at(-1)?.total).toBe(true);
    expect(model.rows.at(-1)?.lots).toBe(2);
    expect(model.rows.at(-1)?.plantsRemaining).toBe(11);
  });

  it("pools the drying forecast by weight, then the strain, then the season", () => {
    const own = buildStrainPerformance({
      day: DAY,
      lots: [
        lot({ farm: "PNN", wetGrams: 100 * LB, dryGrams: 50 * LB, unloaded: true, plantCount: null }),
        lot({ farm: "PNN", wetGrams: 200 * LB, dryGrams: null, unloaded: false, plantCount: null }),
        lot({ farm: "PNS", wetGrams: 100 * LB, dryGrams: 10 * LB, unloaded: true, plantCount: null }),
      ],
      plants: [],
      estimates: [],
    });
    const pnn = row(own, "Gelato", "PNN");
    expect(pnn.forecastSource).toBe("strain_farm");
    expect(pnn.forecastGrams).toBe(100 * LB);
    expect(pnn.forecastLb).toBe(100);
    expect(pnn.dryLb).toBe(50);
    expect(pnn.harvestedDryLb).toBe(150);

    const weighted = buildStrainPerformance({
      day: DAY,
      lots: [
        lot({ wetGrams: 100 * LB, dryGrams: 10 * LB, unloaded: true, plantCount: null }),
        lot({ wetGrams: 300 * LB, dryGrams: 150 * LB, unloaded: true, plantCount: null }),
        lot({ wetGrams: 100 * LB, dryGrams: null, unloaded: false, plantCount: null }),
      ],
      plants: [],
      estimates: [],
    });
    // 160 dry over 400 wet is 0.4, not the unweighted mean of 0.1 and 0.5.
    expect(row(weighted, "Gelato", "PNN").forecastGrams).toBe(40 * LB);

    const across = buildStrainPerformance({
      day: DAY,
      lots: [
        lot({ farm: "ARL", wetGrams: 200 * LB, dryGrams: null, unloaded: false, plantCount: null }),
        lot({ farm: "PNN", wetGrams: 100 * LB, dryGrams: 25 * LB, unloaded: true, plantCount: null }),
      ],
      plants: [],
      estimates: [],
    });
    const arl = row(across, "Gelato", "ARL");
    expect(arl.forecastSource).toBe("strain");
    expect(arl.forecastLb).toBe(50);

    const season = buildStrainPerformance({
      day: DAY,
      lots: [
        lot({ strain: "Brand New", farm: "PNN", wetGrams: 100 * LB, dryGrams: null, unloaded: false, plantCount: null }),
        lot({ strain: "Other", farm: "PNS", wetGrams: 100 * LB, dryGrams: 20 * LB, unloaded: true, plantCount: null }),
      ],
      plants: [],
      estimates: [],
    });
    const fresh = row(season, "Brand New", "PNN");
    expect(fresh.forecastSource).toBe("season");
    expect(fresh.forecastLb).toBe(20);
    expect(row(season, "Brand New", "PNN").harvestedDryLb).toBe(20);
  });

  it("uses the estimate in force on the day and leaves a row with none out of the remaining total", () => {
    expect(
      estimateInForce(
        [estimate({ effectiveDate: "2026-09-01", dryLbPerPlant: 4 }), estimate({ effectiveDate: "2026-11-01", dryLbPerPlant: 9 })],
        "gelato",
        "pnn",
        DAY
      )?.dryLbPerPlant
    ).toBe(4);
    expect(estimateInForce([estimate({ effectiveDate: "2026-10-14", dryLbPerPlant: 9 })], "Gelato", "PNN", DAY)).toBeNull();
    expect(estimateInForce([estimate({ effectiveDate: DAY, dryLbPerPlant: 6 })], "Gelato", "PNN", DAY)?.dryLbPerPlant).toBe(6);

    const model = buildStrainPerformance({
      day: DAY,
      lots: [],
      plants: [plants({ plants: 10 }), plants({ strain: "Lemon", plants: 7 }), plants({ strain: "Quiet", plants: 0 })],
      estimates: [
        estimate({ effectiveDate: "2026-09-01", dryLbPerPlant: 4 }),
        estimate({ effectiveDate: "2026-11-01", dryLbPerPlant: 9 }),
      ],
    });
    const gelato = row(model, "Gelato", "PNN");
    expect(gelato.estimatePerPlant).toBe("4.00");
    expect(gelato.estimateDate).toBe("2026-09-01");
    expect(gelato.remainingLb).toBe(40);
    expect(gelato.estimateMissing).toBe(false);
    const lemon = row(model, "Lemon", "PNN");
    expect(lemon.estimateMissing).toBe(true);
    expect(lemon.estimatePerPlant).toBe("");
    expect(lemon.remainingLb).toBeNull();
    expect(lemon.seasonLb).toBe(0);
    expect(model.missingStrains).toBe(1);
    expect(model.missingPlants).toBe(7);
    const total = model.rows.at(-1)!;
    expect(total.remainingLb).toBe(40);
    expect(total.plantsRemaining).toBe(17);
    expect(total.seasonLb).toBe(40);

    const half = buildStrainPerformance({
      day: DAY,
      lots: [],
      plants: [plants({ plants: 3 })],
      estimates: [estimate({ dryLbPerPlant: 2.5 })],
    });
    expect(row(half, "Gelato", "PNN").remainingLb).toBe(8);
  });

  it("counts harvested plants and wet on every finished lot, dry and per plant only on unloaded lots", () => {
    const model = buildStrainPerformance({
      day: DAY,
      lots: [
        lot({ wetGrams: 100 * LB, dryGrams: 40 * LB, plantCount: 8, unloaded: true }),
        lot({ wetGrams: 50 * LB, dryGrams: 50 * LB, plantCount: null, unloaded: true }),
        lot({ wetGrams: 20 * LB, dryGrams: null, plantCount: 5, unloaded: false }),
        lot({ wetGrams: 10 * LB, dryGrams: null, plantCount: 0, unloaded: false }),
      ],
      plants: [],
      estimates: [],
    });
    const gelato = row(model, "Gelato", "PNN");
    expect(gelato.lots).toBe(4);
    expect(gelato.plantsHarvested).toBe(13);
    expect(gelato.wetLb).toBe(180);
    expect(gelato.dryLb).toBe(90);
    // The second unloaded lot has dry and no count, so per plant is 40 lb over 8 plants.
    expect(gelato.dryLbPerPlant).toBe("5.00");
    expect(wholePoundsFromGrams(224)).toBe(1);
    expect(formatWhole(1500)).toBe("1,500");
    const blank = buildStrainPerformance({
      day: DAY,
      lots: [lot({ plantCount: null, dryGrams: 10 * LB })],
      plants: [],
      estimates: [],
    });
    expect(row(blank, "Gelato", "PNN").dryLbPerPlant).toBe("");
  });

  it("renders the section closed, with the year, the method, and the no-estimate line", () => {
    const model = buildStrainPerformance({
      day: DAY,
      lots: [lot({ wetGrams: 1500 * LB, dryGrams: 100 * LB, plantCount: 20 })],
      plants: [plants({ strain: "Lemon", plants: 7 }), plants({ strain: "Mango", farm: "PNS", plants: 1 })],
      estimates: [],
    });
    const html = strainPerformanceSection(model, 2026, "en");
    expect(html.startsWith('<details class="hc-section" id="strain-performance" data-hc-section="strain_performance">')).toBe(true);
    expect(html).not.toContain('data-hc-section="strain_performance" open');
    expect(html).toContain('<summary>Strain performance <span class="muted hc-year">Harvest year 2026</span></summary>');
    expect(html).toContain('class="report-scroll" data-sp-scroll');
    expect(html.indexOf("data-sp-scroll")).toBeLessThan(html.indexOf("data-sp-table"));
    expect(html).toContain("1,500");
    expect(html).toContain("no estimate");
    expect(html).toContain("2 strains with plants and no estimate: 8 plants");
    expect(html).toContain(STRAIN_PERFORMANCE_METHOD);
    const es = strainPerformanceSection(model, 2026, "es");
    expect(es).toContain("Rendimiento por variedad");
    expect(es).toContain("Año de cosecha 2026");
    expect(es).toContain("sin estimación");
    expect(es).toContain("2 variedades con plantas y sin estimación: 8 plantas");
    expect(es).toContain("Cosechado");
    expect(es).toContain("Sin cosechar");
    const one = strainPerformanceSection(
      buildStrainPerformance({ day: DAY, lots: [], plants: [plants({ plants: 1 })], estimates: [] }),
      2026,
      "en"
    );
    expect(one).toContain("1 strain with plants and no estimate: 1 plant");
    const empty = strainPerformanceSection({ rows: [], missingStrains: 0, missingPlants: 0 }, 2026, "en");
    expect(empty).toContain("No strains this harvest year.");
    expect(empty).not.toContain("data-sp-missing");
    expect(empty).not.toContain('data-sp-total="1"');
  });

  it("keeps English and Spanish for the section and the field estimate label", () => {
    const keys = [
      "Strain performance",
      "Plants harvested",
      "Drying lb forecast",
      "Harvested dry lb",
      "Dry lb per plant",
      "Plants remaining",
      "Est. dry lb per plant",
      "Est. date",
      "Remaining dry lb",
      "Season dry lb",
      "Harvested",
      "Unharvested",
      "no estimate",
      "{n} strain with plants and no estimate: {p} plant",
      "{n} strain with plants and no estimate: {p} plants",
      "{n} strains with plants and no estimate: {p} plant",
      "{n} strains with plants and no estimate: {p} plants",
      STRAIN_PERFORMANCE_METHOD,
      "No strains this harvest year.",
      "dry lb per plant (448 g)",
      "Hand entered dry pounds per plant at 448 g. The number is stored as typed.",
    ];
    for (const key of keys) {
      expect(DICT[key]?.en).toBe(key);
      expect(DICT[key]?.es.length).toBeGreaterThan(0);
    }
    expect(t("es", "dry lb per plant (448 g)")).toBe("dry lb per plant (448 g)");
    expect(t("es", "Hand entered dry pounds per plant at 448 g. The number is stored as typed.")).not.toBe(
      "Hand entered dry pounds per plant at 448 g. The number is stored as typed."
    );
    expect(t("es", "Strain performance")).not.toBe("Strain performance");
  });

  it("reads the year's lots in one statement and the live plants in one grouped read", () => {
    expect(STRAIN_PERFORMANCE_LOTS_SQL).toContain("COALESCE(b.is_test, 0) = 0");
    expect(STRAIN_PERFORMANCE_LOTS_SQL).toContain("b.customer IS NULL");
    expect(STRAIN_PERFORMANCE_LOTS_SQL).toContain("w.status <> 'weighing'");
    expect(STRAIN_PERFORMANCE_LOTS_SQL).toContain("b.harvest_year = ?");
    expect(STRAIN_PERFORMANCE_LOTS_SQL).toContain("w.dry_weight_grams IS NOT NULL");
    expect(STRAIN_PERFORMANCE_LOTS_SQL).toContain("dry_weights");
    expect(STRAIN_PERFORMANCE_LOTS_SQL).toContain("u.finished_at IS NOT NULL");
    expect(STRAIN_PERFORMANCE_PLANTS_SQL).toContain("p.gone_at IS NULL AND p.harvested = 0");
    expect(STRAIN_PERFORMANCE_PLANTS_SQL).toContain("GROUP BY p.license_value, p.strain");
    expect((STRAIN_PERFORMANCE_LOTS_SQL.match(/\?/g) ?? []).length).toBeLessThanOrEqual(100);
    expect(STRAIN_PERFORMANCE_PLANTS_SQL.includes("?")).toBe(false);
    expect(STRAIN_PERFORMANCE_LOTS_SQL.includes("sensor_readings")).toBe(false);
    expect(STRAIN_PERFORMANCE_PLANTS_SQL.includes("sensor_readings")).toBe(false);
    expect(STRAIN_PERFORMANCE_LOTS_SQL).toContain("w.id AS lot_id");
    expect(TRIM_SEASON_SQL).toContain("p.source IS NULL");
    expect(TRIM_SEASON_SQL).toContain("COALESCE(b.is_test, 0) = 0");
    expect(TRIM_SEASON_SQL).toContain("b.customer IS NULL");
  });

  it("loads the grain from the tables: market name, dry rows, live plants, and the estimate in force", async () => {
    const m = await migratedDb();
    const ts = "2026-10-01T00:00:00.000Z";
    const strain = (id: string, name: string, code: string) =>
      m.run(`INSERT INTO strains (id, name, hbn_code, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`, id, name, code, ts, ts);
    strain("s-real", "Real Name", "R1");
    strain("s-grip", "Grip Cake", "R2");
    strain("s-rows", "Rows Only", "R3");
    const batch = (id: string, serial: number, strainId: string, extra: Record<string, string | number> = {}) => {
      const cols = {
        id,
        entry_date: "2026-09-01",
        farm_code: "PNN",
        grow_method_code: "OD",
        strain_id: strainId,
        manicure: 0,
        hbn: `HBN-${id}-26${String(serial).padStart(3, "0")}`,
        lot_serial: serial,
        harvest_year: 2026,
        status: "open",
        market_strain: "",
        created_at: ts,
        updated_at: ts,
        ...extra,
      };
      m.run(`INSERT INTO harvest_batches (${Object.keys(cols).join(", ")}) VALUES (${Object.keys(cols).map(() => "?").join(", ")})`, ...Object.values(cols));
    };
    const entry = (id: string, batchId: string, extra: Record<string, string | number | null> = {}) => {
      const cols = { id, harvest_batch_id: batchId, weight_grams: 0, actual_dryspc: "silo", status: "unloaded", created_at: ts, updated_at: ts, ...extra };
      m.run(`INSERT INTO wet_weight_entries (${Object.keys(cols).join(", ")}) VALUES (${Object.keys(cols).map(() => "?").join(", ")})`, ...Object.values(cols));
    };
    batch("b1", 8801, "s-real", { market_strain: "Grip Cake" });
    entry("w1", "b1", { weight_grams: 100 * LB, dry_weight_grams: 50 * LB, plant_count: 20, status: "unloaded" });
    m.run(
      `INSERT INTO unload_sessions (id, wet_weight_entry_id, finished_at, effective_date, created_at, updated_at) VALUES ('u1', 'w1', ?, NULL, ?, ?)`,
      ts,
      ts,
      ts
    );
    batch("b2", 8802, "s-real", { market_strain: "Grip Cake" });
    entry("w2", "b2", { weight_grams: 200 * LB, dry_weight_grams: null, plant_count: 10, status: "drying" });
    m.run(
      `INSERT INTO unload_sessions (id, wet_weight_entry_id, finished_at, effective_date, created_at, updated_at) VALUES ('u2', 'w2', NULL, NULL, ?, ?)`,
      ts,
      ts
    );
    batch("b3", 8803, "s-real", { market_strain: "Grip Cake" });
    entry("w3", "b3", { weight_grams: 999 * LB, status: "weighing" });
    batch("b4", 8804, "s-real", { market_strain: "Grip Cake", harvest_year: 2025 });
    entry("w4", "b4", { weight_grams: 999 * LB, dry_weight_grams: 999 * LB, status: "unloaded" });
    m.run(
      `INSERT INTO unload_sessions (id, wet_weight_entry_id, finished_at, effective_date, created_at, updated_at) VALUES ('u4', 'w4', ?, NULL, ?, ?)`,
      ts,
      ts,
      ts
    );
    batch("b5", 8805, "s-real", { market_strain: "Grip Cake", is_test: 1 });
    entry("w5", "b5", { weight_grams: 999 * LB, dry_weight_grams: 999 * LB, status: "unloaded" });
    m.run(
      `INSERT INTO unload_sessions (id, wet_weight_entry_id, finished_at, effective_date, created_at, updated_at) VALUES ('u5', 'w5', ?, NULL, ?, ?)`,
      ts,
      ts,
      ts
    );
    batch("b6", 8806, "s-rows");
    entry("w6", "b6", { weight_grams: 10 * LB, dry_weight_grams: null, plant_count: null, status: "unloaded" });
    m.run(`INSERT INTO dry_weights (id, wet_weight_entry_id, weight_grams, created_at, updated_at) VALUES ('d1', 'w6', ?, ?, ?)`, 10 * LB, ts, ts);
    m.run(
      `INSERT INTO dry_weights (id, wet_weight_entry_id, weight_grams, created_at, updated_at, deleted_at) VALUES ('d2', 'w6', ?, ?, ?, ?)`,
      999 * LB,
      ts,
      ts,
      ts
    );
    m.run(
      `INSERT INTO unload_sessions (id, wet_weight_entry_id, finished_at, effective_date, created_at, updated_at) VALUES ('u6', 'w6', ?, NULL, ?, ?)`,
      ts,
      ts,
      ts
    );
    const plant = (tag: string, strainName: string, harvested: number, gone: string | null) =>
      m.run(
        `INSERT INTO metrc_plants (tag, license_value, phase, strain, harvested, mount_id, first_seen_at, changed_at, gone_at) VALUES (?, 'GR-C-001132', 'flowering', ?, ?, 'sp1', ?, ?, ?)`,
        tag,
        strainName,
        harvested,
        ts,
        ts,
        gone
      );
    for (let i = 1; i <= 4; i++) plant(`live-${i}`, "grip cake", 0, null);
    plant("cut", "grip cake", 1, null);
    plant("gone", "grip cake", 0, ts);
    for (let i = 1; i <= 7; i++) plant(`lemon-${i}`, "Lemon", 0, null);
    m.run(
      `INSERT INTO field_estimates (id, strain_id, farm_code, effective_date, est_dry_weight, reason, created_at) VALUES ('e-old', 's-grip', 'PNN', '2026-09-01', 4, NULL, ?)`,
      ts
    );
    m.run(
      `INSERT INTO field_estimates (id, strain_id, farm_code, effective_date, est_dry_weight, reason, created_at) VALUES ('e-later', 's-grip', 'PNN', '2026-11-01', 9, NULL, ?)`,
      ts
    );

    const model = await loadStrainPerformance(m.db, 2026, DAY);
    const grip = row(model, "Grip Cake", "PNN");
    expect(grip.lots).toBe(2);
    expect(grip.plantsHarvested).toBe(30);
    expect(grip.wetLb).toBe(300);
    expect(grip.dryLb).toBe(50);
    expect(grip.forecastLb).toBe(100);
    expect(grip.harvestedDryLb).toBe(150);
    expect(grip.dryLbPerPlant).toBe("2.50");
    expect(grip.plantsRemaining).toBe(4);
    expect(grip.estimatePerPlant).toBe("4.00");
    expect(grip.estimateDate).toBe("2026-09-01");
    expect(grip.remainingLb).toBe(16);
    expect(grip.seasonLb).toBe(166);
    expect(row(model, "Rows Only", "PNN").dryLb).toBe(10);
    expect(row(model, "Lemon", "PNN").estimateMissing).toBe(true);
    expect(row(model, "Lemon", "PNN").remainingLb).toBeNull();
    expect(model.missingStrains).toBe(1);
    expect(model.missingPlants).toBe(7);
    expect(model.rows.at(-1)?.remainingLb).toBe(16);
    expect(model.rows.at(-1)?.seasonLb).toBe(176);
    expect(model.rows.map((item) => item.strain)).toEqual(["Grip Cake", "Lemon", "Rows Only", "Total"]);
  });

  it("puts BTR after Dry lb per plant and pools the console's weighted BTR", () => {
    const pack = (over: Partial<TrimSeasonRow> = {}): TrimSeasonRow => ({
      lot_id: "w1",
      harvest_year: 2026,
      type_code: "BUD",
      weight_grams: 0,
      source: null,
      deleted: false,
      lot_deleted: false,
      ...over,
    });
    const packages: TrimSeasonRow[] = [
      pack({ lot_id: "w1", type_code: "BUD", weight_grams: 300 }),
      pack({ lot_id: "w1", type_code: "TRIM", weight_grams: 100 }),
      pack({ lot_id: "w3", type_code: "TRIM", weight_grams: 100 }),
      pack({ lot_id: "open", type_code: "BUD", weight_grams: 100 }),
      pack({ lot_id: "w1", type_code: "BUD", weight_grams: 900, source: "cryo" }),
      pack({ lot_id: "w1", type_code: "BUD", weight_grams: 900, deleted: true }),
      pack({ lot_id: "w1", type_code: "BUD", weight_grams: 900, harvest_year: 2025 }),
    ];
    const model = buildStrainPerformance({
      day: DAY,
      year: 2026,
      lots: [
        lot({ id: "w1", strain: "Gelato", farm: "PNN" }),
        lot({ id: "w3", strain: "Only Trim", farm: "PNN" }),
        lot({ id: "bare", strain: "Bare", farm: "PNS" }),
      ],
      plants: [],
      estimates: [],
      trim: packages,
      budCodes: parseBtrTypeCodes(null),
    });
    expect(row(model, "Gelato", "PNN").btr).toBe("75.0%");
    expect(row(model, "Only Trim", "PNN").btr).toBe("0.0%");
    expect(row(model, "Bare", "PNS").btr).toBe("");
    const toDate = weightedBtrToDate(packages, 2026, parseBtrTypeCodes(null));
    expect(model.rows.at(-1)?.btr).toBe(`${((toDate.btr ?? 0) * 100).toFixed(1)}%`);
    expect(model.rows.at(-1)?.btr).toBe("66.7%");

    const pooled = buildStrainPerformance({
      day: DAY,
      year: 2026,
      lots: [lot({ id: "a" }), lot({ id: "b" })],
      plants: [],
      estimates: [],
      trim: [
        pack({ lot_id: "a", type_code: "BUD", weight_grams: 100 }),
        pack({ lot_id: "b", type_code: "TRIM", weight_grams: 300 }),
      ],
      budCodes: parseBtrTypeCodes(null),
    });
    expect(row(pooled, "Gelato", "PNN").btr).toBe("25.0%");

    const codes = parseBtrTypeCodes("TRIM");
    expect(codes).toEqual(["TRIM"]);
    const narrowed = buildStrainPerformance({
      day: DAY,
      year: 2026,
      lots: [
        lot({ id: "w1", strain: "Gelato", farm: "PNN" }),
        lot({ id: "w3", strain: "Only Trim", farm: "PNN" }),
        lot({ id: "bare", strain: "Bare", farm: "PNS" }),
      ],
      plants: [],
      estimates: [],
      trim: packages,
      budCodes: codes,
    });
    expect(row(narrowed, "Gelato", "PNN").btr).toBe("25.0%");
    expect(row(narrowed, "Only Trim", "PNN").btr).toBe("100.0%");
    expect(row(narrowed, "Bare", "PNS").btr).toBe("");
    const narrowDate = weightedBtrToDate(packages, 2026, codes);
    expect(narrowed.rows.at(-1)?.btr).toBe(`${((narrowDate.btr ?? 0) * 100).toFixed(1)}%`);

    const html = strainPerformanceSection(model, 2026, "en");
    const head = html.slice(html.indexOf("<thead>"), html.indexOf("</thead>"));
    expect(head.indexOf("Dry lb per plant")).toBeLessThan(head.indexOf(">BTR<"));
    expect(head.indexOf(">BTR<")).toBeLessThan(head.indexOf("Plants remaining"));
    expect(head).toContain('colspan="8"');
    const gelato = html.slice(html.indexOf('data-sp-strain="Gelato"'));
    expect(gelato.indexOf('data-sp="dry_per_plant"')).toBeLessThan(gelato.indexOf('data-sp="btr">75.0%'));
    expect(gelato.indexOf('data-sp="btr">75.0%')).toBeLessThan(gelato.indexOf('data-sp="plants_remaining"'));
    expect(html).toContain('data-sp-strain="Bare" data-sp-farm="PNS"');
    expect(html.slice(html.indexOf('data-sp-strain="Bare"'))).toContain('data-sp="btr"></td>');
    const es = strainPerformanceSection(model, 2026, "es");
    expect(es).toContain(">BTR<");
    expect(DICT.BTR.en).toBe("BTR");
    expect(DICT.BTR.es).toBe("BTR");
  });

  it("keeps toll lots and test lots out of the season BTR", async () => {
    const m = await migratedDb();
    const ts = "2026-10-01T00:00:00.000Z";
    const strain = (id: string, name: string, code: string) =>
      m.run(`INSERT INTO strains (id, name, hbn_code, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`, id, name, code, ts, ts);
    strain("s-btr", "Btr Gelato", "BT1");
    strain("s-bare", "Btr Bare", "BT2");
    strain("s-toll", "Toll Only", "BT3");
    strain("s-test", "Test Only", "BT4");
    const batch = (id: string, serial: number, strainId: string, extra: Record<string, string | number> = {}) => {
      const cols = {
        id,
        entry_date: "2026-09-01",
        farm_code: "PNN",
        grow_method_code: "OD",
        strain_id: strainId,
        manicure: 0,
        hbn: `HBN-${id}`,
        lot_serial: serial,
        harvest_year: 2026,
        status: "open",
        market_strain: "",
        created_at: ts,
        updated_at: ts,
        ...extra,
      };
      m.run(`INSERT INTO harvest_batches (${Object.keys(cols).join(", ")}) VALUES (${Object.keys(cols).map(() => "?").join(", ")})`, ...Object.values(cols));
    };
    const entry = (id: string, batchId: string, extra: Record<string, string | number | null> = {}) => {
      const cols = { id, harvest_batch_id: batchId, weight_grams: 10 * LB, actual_dryspc: "silo", status: "unloaded", created_at: ts, updated_at: ts, ...extra };
      m.run(`INSERT INTO wet_weight_entries (${Object.keys(cols).join(", ")}) VALUES (${Object.keys(cols).map(() => "?").join(", ")})`, ...Object.values(cols));
    };
    const finish = (id: string, lotId: string) =>
      m.run(
        `INSERT INTO unload_sessions (id, wet_weight_entry_id, finished_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`,
        id,
        lotId,
        ts,
        ts,
        ts
      );
    const pack = (id: string, lotId: string, type: string, grams: number, source: string | null, deleted: string | null) =>
      m.run(
        `INSERT INTO wip_packages (id, wet_weight_entry_id, package_code, package_type_code, weight_grams, status, source, created_at, updated_at, deleted_at) VALUES (?, ?, ?, ?, ?, 'created', ?, ?, ?, ?)`,
        id,
        lotId,
        id,
        type,
        grams,
        source,
        ts,
        ts,
        deleted
      );
    batch("bb-own", 7701, "s-btr");
    entry("bw-own", "bb-own", { dry_weight_grams: 5 * LB, plant_count: 4, status: "unloaded" });
    finish("bu-own", "bw-own");
    pack("bp-bud", "bw-own", "BUD", 300, null, null);
    pack("bp-trim", "bw-own", "TRIM", 100, null, null);
    pack("bp-cryo", "bw-own", "BUD", 900, "cryo", null);
    pack("bp-dead", "bw-own", "BUD", 900, null, ts);
    batch("bb-bare", 7702, "s-bare");
    entry("bw-bare", "bb-bare");
    finish("bu-bare", "bw-bare");
    batch("bb-toll", 7703, "s-toll", { customer: "Other Co" });
    entry("bw-toll", "bb-toll");
    finish("bu-toll", "bw-toll");
    pack("bp-toll", "bw-toll", "BUD", 1000, null, null);
    batch("bb-test", 7704, "s-test", { is_test: 1 });
    entry("bw-test", "bb-test");
    finish("bu-test", "bw-test");
    pack("bp-test", "bw-test", "BUD", 1000, null, null);
    batch("bb-open", 7705, "s-btr");
    entry("bw-open", "bb-open", { status: "weighing" });
    pack("bp-open", "bw-open", "BUD", 100, null, null);

    const model = await loadStrainPerformance(m.db, 2026, DAY);
    expect(row(model, "Btr Gelato", "PNN").btr).toBe("75.0%");
    expect(row(model, "Btr Bare", "PNN").btr).toBe("");
    expect(model.rows.map((item) => item.strain)).not.toContain("Toll Only");
    expect(model.rows.map((item) => item.strain)).not.toContain("Test Only");
    const season = await m.db.prepare(TRIM_SEASON_SQL).bind(2026).all<{ lot_id: string; harvest_year: number; type_code: string | null; weight_grams: number }>();
    const seasonRows: TrimSeasonRow[] = (season.results ?? []).map((item) => ({
      lot_id: String(item.lot_id),
      harvest_year: Number(item.harvest_year),
      type_code: item.type_code,
      weight_grams: Number(item.weight_grams ?? 0),
      source: null,
      deleted: false,
      lot_deleted: false,
    }));
    const toDate = weightedBtrToDate(seasonRows, 2026, parseBtrTypeCodes(null));
    expect(model.rows.at(-1)?.btr).toBe(`${((toDate.btr ?? 0) * 100).toFixed(1)}%`);
    expect(model.rows.at(-1)?.btr).toBe("80.0%");
    expect(seasonRows.map((item) => item.lot_id).sort()).toEqual(["bw-open", "bw-own", "bw-own"]);

    m.run(`UPDATE app_config SET value = 'TRIM', updated_at = ? WHERE key = 'btr_type_codes'`, ts);
    const narrowed = await loadStrainPerformance(m.db, 2026, DAY);
    expect(row(narrowed, "Btr Gelato", "PNN").btr).toBe("25.0%");
    expect(narrowed.rows.at(-1)?.btr).toBe("20.0%");
  });
});
