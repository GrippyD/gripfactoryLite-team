import { describe, expect, it } from "vitest";
import { DRY_STRAIN_NOT_A_DATE, DRY_STRAIN_TO_BEFORE_FROM, DRY_STRAIN_TOO_LONG } from "../src/drystrain";
import {
  HARVEST_RECONCILE_DATE_COLUMN,
  HARVEST_RECONCILE_EMPTY,
  HARVEST_RECONCILE_KEY,
  HARVEST_RECONCILE_LIVE_HBN_SQL,
  HARVEST_RECONCILE_METRC_RANGE_SQL,
  HARVEST_RECONCILE_NO_HOURS,
  HARVEST_RECONCILE_NO_METRC,
  HARVEST_RECONCILE_POUND_LAW,
  chunkList,
  fixedPlaces,
  harvestReconcileCsv,
  harvestReconcileHoursSql,
  harvestReconcileLotsSql,
  harvestReconcileMetrcNamesSql,
  harvestReconcileRefused,
  harvestReconcileView,
  loadHarvestReconciliation,
  metrcToStandardPounds,
  poundGapPercent,
  poundGapPercentText,
  poundsAt,
  resolveHarvestReconcileRange,
  STANDARD_GRAMS_PER_LB,
  type HarvestReconcileModel,
} from "../src/harvestreconciliation";
import { reportPage } from "../src/html";
import { isReportKey, REPORT_CARDS, REPORT_KEYS } from "../src/reports";
import { migratedDb } from "./migrated";

const GRAMS = 448_000;

function model(over: Partial<HarvestReconcileModel> = {}): HarvestReconcileModel {
  return {
    from: "2026-09-01",
    to: "2026-09-30",
    farm: "",
    grow: "",
    lots: [
      {
        lotId: "w1",
        hbn: "26263-PNN-OD-001-0-NA-26010",
        entryDate: "2026-09-20",
        farm: "PNN",
        growMethod: "OD",
        strain: "Test Strain",
        marketStrain: "Test Strain",
        wetGrams: GRAMS,
        dryGrams: null,
        metrcPounds: null,
        metrcUom: "",
        metrcMatched: false,
      },
    ],
    metrcOnly: [],
    hours: 0,
    ...over,
  };
}

describe("HARVEST WEIGHT RECONCILIATION (BRIEF HR1)", () => {
  it("reads 448,000 g as 1,000.00 lb at 448 and 987.67 lb at 453.59237, and computes the gap", () => {
    const at448 = poundsAt(GRAMS, 448);
    const atStandard = poundsAt(GRAMS, STANDARD_GRAMS_PER_LB);
    expect(at448).toBe(1000);
    expect(fixedPlaces(atStandard, 2)).toBe("987.67");
    expect(fixedPlaces(atStandard, 4)).toBe("987.6709");
    expect(fixedPlaces(at448 - atStandard, 2)).toBe("12.33");
    expect(fixedPlaces(at448 - atStandard, 4)).toBe("12.3291");
    expect(poundGapPercentText()).toBe(fixedPlaces(poundGapPercent(), 4));
    expect(poundGapPercentText()).toBe("1.2483");
    const view = harvestReconcileView(model());
    expect(reportPage(view, "", "")).toContain('class="report-scroll"><table class="data"');
    const lot = view.rows[0];
    expect(lot.short_id).toBe("26010");
    expect(lot.market_strain).toBe("");
    expect(lot.wet_grams).toBe("448,000");
    expect(lot.wet_lb_448).toBe("1,000.00");
    expect(lot.wet_lb_standard).toBe("987.67");
    expect(lot.wet_diff).toBe("12.33");
    expect(lot.dry_grams).toBe("");
    expect(lot.dry_lb_448).toBe("");
    expect(lot.flag).toBe(HARVEST_RECONCILE_NO_METRC);
    expect(view.rows[1].short_id).toBe("Wet total");
    expect(view.rows[1]._total).toBe("1");
    expect(view.rows[1].wet_lb_448).toBe("1,000.00");
    expect(view.rows[2].short_id).toBe("Dry total");
    expect(view.rows[2].dry_grams).toBe("");
    expect(view.belowTable).toContain("448 g against 453.59237 g, 1.2483 percent");
    expect(view.footnote).toContain(HARVEST_RECONCILE_POUND_LAW);
    expect(view.footnote).toContain(HARVEST_RECONCILE_DATE_COLUMN);
    expect(view.belowTable).toContain(HARVEST_RECONCILE_NO_HOURS);
    const csv = harvestReconcileCsv(model());
    expect(csv).toContain("448000,1000.0000,987.6709,12.3291,,,,,,,No METRC harvest");
    expect(csv).not.toContain("448,000");
    expect(csv).not.toContain("1,000.00");
    expect(csv).toContain("1.2483 percent");
    const page = reportPage(view, "", "");
    expect(page).toContain("1,000.00");
    expect(page).toContain("987.67");
    expect(page).toContain('class="report-total"');
    expect(page).toContain("448 g against 453.59237 g, 1.2483 percent");
  });

  it("converts the mirror unit, keeps an unknown unit blank, and lists a harvest with no lot", () => {
    expect(metrcToStandardPounds(GRAMS, "Grams")).toBeCloseTo(poundsAt(GRAMS, STANDARD_GRAMS_PER_LB), 9);
    expect(metrcToStandardPounds(2.5, "Pounds")).toBe(2.5);
    expect(metrcToStandardPounds(40, "Ounces")).toBe(2.5);
    expect(metrcToStandardPounds(1, "Kilograms")).toBeCloseTo(1000 / STANDARD_GRAMS_PER_LB, 9);
    expect(metrcToStandardPounds(10, "Stone")).toBeNull();
    const view = harvestReconcileView(
      model({
        lots: [
          {
            ...model().lots[0],
            dryGrams: 224_000,
            metrcPounds: 2.5,
            metrcUom: "Ounces",
            metrcMatched: true,
          },
        ],
        metrcOnly: [{ name: "26270-ARL-ID-001-0-NA-26999", harvestStart: "2026-09-22", pounds: 1, uom: "Pounds" }],
        tollLots: [{ ...model().lots[0], lotId: "toll-1", hbn: "00000-PNN-GH-001-0-NA-26990", customer: "Northwind Store" }],
        hours: 10,
      })
    );
    expect(view.belowTable).toContain('class="report-scroll"><table class="data metrc-only"');
    expect(view.belowTable).toContain('class="report-scroll"><table class="data toll-lots"');
    expect(view.rows[0].flag).toBe("");
    expect(view.rows[0].metrc_lb).toBe("2.50");
    expect(view.rows[0].metrc_uom).toBe("Ounces");
    expect(view.rows[0].dry_lb_448).toBe("500.00");
    expect(view.belowTable).toContain("METRC only");
    expect(view.belowTable).toContain("26270-ARL-ID-001-0-NA-26999");
    expect(view.belowTable).toContain("100.00 at 448 g");
    expect(view.belowTable).toContain("harvest_labor_hours");
    const grow = harvestReconcileView(model({ grow: "GH", hours: 15 }));
    expect(grow.belowTable).toContain("no grow method");
    expect(grow.belowTable).not.toContain("Wet pounds per hour");
  });

  it("takes the range as typed, defaults blanks, and refuses a backwards or long one", () => {
    expect(resolveHarvestReconcileRange("2026-09-01", "2026-09-30", "2026-10-12")).toEqual({ ok: true, from: "2026-09-01", to: "2026-09-30" });
    expect(resolveHarvestReconcileRange("", "", "2026-10-08")).toEqual({ ok: true, from: "2026-09-08", to: "2026-10-08" });
    expect(resolveHarvestReconcileRange("2026-10-09", "2026-10-08", "2026-10-08")).toEqual({ ok: false, message: DRY_STRAIN_TO_BEFORE_FROM });
    expect(resolveHarvestReconcileRange("2025-10-07", "2026-10-08", "2026-10-08")).toEqual({ ok: false, message: DRY_STRAIN_TOO_LONG });
    expect(resolveHarvestReconcileRange("soon", "2026-10-08", "2026-10-08")).toEqual({ ok: false, message: DRY_STRAIN_NOT_A_DATE });
    const refused = harvestReconcileRefused(DRY_STRAIN_TOO_LONG);
    expect(refused.rows).toEqual([]);
    expect(refused.empty).toBe(DRY_STRAIN_TOO_LONG);
  });

  it("chunks the METRC name lookup by 90 and never reads sensor_readings", () => {
    expect(chunkList(new Array(95).fill("n")).map((part) => part.length)).toEqual([90, 5]);
    expect(harvestReconcileMetrcNamesSql(90).split("?").length - 1).toBe(90);
    const sql = [
      harvestReconcileLotsSql(true, true),
      harvestReconcileMetrcNamesSql(3),
      HARVEST_RECONCILE_METRC_RANGE_SQL,
      HARVEST_RECONCILE_LIVE_HBN_SQL,
      harvestReconcileHoursSql(true),
    ].join("\n");
    expect(sql.toLowerCase()).not.toContain("sensor_readings");
    expect(harvestReconcileLotsSql(false, false)).toContain("b.entry_date >= ?");
    expect(harvestReconcileLotsSql(false, false)).toContain("b.entry_date <= ?");
    expect(HARVEST_RECONCILE_METRC_RANGE_SQL).toContain("harvest_start_date >= ?");
    expect(harvestReconcileHoursSql(false)).toContain("work_date >= ?");
    expect(isReportKey(HARVEST_RECONCILE_KEY)).toBe(true);
    expect(REPORT_KEYS).toContain(HARVEST_RECONCILE_KEY);
    expect(REPORT_CARDS.some((card) => card.key === HARVEST_RECONCILE_KEY && card.title === "Harvest weight reconciliation")).toBe(true);
  });

  it("filters by harvest date, farm and grow, flags a missing mirror row, and lists METRC only", async () => {
    const m = await migratedDb();
    const db = m.db;
    const ts = "2026-09-01T00:00:00.000Z";
    m.run(`INSERT INTO strains (id, name, hbn_code, created_at, updated_at) VALUES ('s1', 'Test Strain', '001', ?, ?)`, ts, ts);
    const batch = (id: string, serial: number, hbn: string, extra: Record<string, string | number | null> = {}) => {
      const cols = {
        id,
        entry_date: "2026-09-20",
        farm_code: "PNN",
        grow_method_code: "OD",
        strain_id: "s1",
        manicure: 0,
        hbn,
        lot_serial: serial,
        harvest_year: 2026,
        status: "open",
        market_strain: "Test Strain",
        created_at: ts,
        updated_at: ts,
        ...extra,
      };
      m.run(`INSERT INTO harvest_batches (${Object.keys(cols).join(", ")}) VALUES (${Object.keys(cols).map(() => "?").join(", ")})`, ...Object.values(cols));
    };
    const entry = (id: string, batchId: string, grams: number) => {
      m.run(
        `INSERT INTO wet_weight_entries (id, harvest_batch_id, weight_grams, actual_dryspc, status, created_at, updated_at) VALUES (?, ?, ?, 'silo', 'drying', ?, ?)`,
        id,
        batchId,
        grams,
        ts,
        ts
      );
    };
    batch("b1", 10, "26263-PNN-OD-001-0-NA-26010");
    entry("w1", "b1", 1);
    m.run(`INSERT INTO wet_weights (id, wet_weight_entry_id, weight_grams, created_at, updated_at) VALUES ('ww1', 'w1', ?, ?, ?)`, GRAMS, ts, ts);
    m.run(
      `INSERT INTO wet_weights (id, wet_weight_entry_id, weight_grams, created_at, updated_at, deleted_at) VALUES ('ww2', 'w1', 9, ?, ?, ?)`,
      ts,
      ts,
      ts
    );
    batch("b2", 11, "26264-PNS-GH-001-0-NA-26011", { entry_date: "2026-09-21", farm_code: "PNS", grow_method_code: "GH", market_strain: "Grip Cake" });
    entry("w2", "b2", GRAMS);
    m.run(`INSERT INTO dry_weights (id, wet_weight_entry_id, weight_grams, created_at, updated_at) VALUES ('d1', 'w2', 224000, ?, ?)`, ts, ts);
    m.run(
      `INSERT INTO dry_weights (id, wet_weight_entry_id, weight_grams, created_at, updated_at, deleted_at) VALUES ('d2', 'w2', 999, ?, ?, ?)`,
      ts,
      ts,
      ts
    );
    batch("b3", 12, "26255-PNN-OD-001-0-NA-26012", { entry_date: "2026-08-01" });
    entry("w3", "b3", 100);
    batch("b4", 13, "26263-PNN-OD-001-0-NA-26013", { is_test: 1 });
    entry("w4", "b4", GRAMS);
    batch("b5", 14, "26263-PNN-OD-001-0-NA-26014", { deleted_at: ts });
    entry("w5", "b5", GRAMS);
    const mirror = (id: number, name: string, weight: number, uom: string, start: string, changed: string, gone: string | null = null) => {
      m.run(
        `INSERT INTO metrc_harvests (harvest_id, name, license_value, harvest_start_date, total_wet_weight, unit_of_weight, state, first_seen_at, changed_at, gone_at)
         VALUES (?, ?, 'GR-C-000001', ?, ?, ?, 'active', ?, ?, ?)`,
        id,
        name,
        start,
        weight,
        uom,
        ts,
        changed,
        gone
      );
    };
    mirror(1, "26263-PNN-OD-001-0-NA-26010", 50, "Grams", "2026-09-20", ts, ts);
    mirror(2, "26264-PNS-GH-001-0-NA-26011", 100, "Grams", "2026-09-21", "2026-09-21T00:00:00.000Z");
    mirror(3, "26264-PNS-GH-001-0-NA-26011", GRAMS, "Grams", "2026-09-21", "2026-09-22T00:00:00.000Z");
    mirror(4, "26270-ARL-ID-001-0-NA-26999", 1, "Pounds", "2026-09-22", ts);
    mirror(5, "26201-PNN-OD-001-0-NA-26998", 9, "Pounds", "2026-01-10", ts);
    m.run(
      `INSERT INTO harvest_labor_hours (id, farm_code, work_date, hours, created_at, updated_at) VALUES ('h1', 'PNN', '2026-09-20', 10, ?, ?)`,
      ts,
      ts
    );
    m.run(
      `INSERT INTO harvest_labor_hours (id, farm_code, work_date, hours, created_at, updated_at) VALUES ('h2', 'PNS', '2026-09-21', 5, ?, ?)`,
      ts,
      ts
    );

    const calls: { sql: string; binds: unknown[] }[] = [];
    const orig = db.prepare.bind(db);
    db.prepare = ((sql: string) => {
      const stmt = orig(sql);
      const bind = stmt.bind.bind(stmt);
      stmt.bind = ((...args: unknown[]) => {
        calls.push({ sql, binds: args });
        return bind(...args);
      }) as typeof stmt.bind;
      return stmt;
    }) as typeof db.prepare;

    const params = new URLSearchParams({ from: "2026-09-01", to: "2026-09-30" });
    const loaded = await loadHarvestReconciliation(db, params, "2026-10-12", "en");
    expect(loaded.ok).toBe(true);
    expect(calls.some((call) => call.sql.toLowerCase().includes("sensor_readings"))).toBe(false);
    expect(calls.some((call) => call.binds.includes("2026-09-01") && call.binds.includes("2026-09-30"))).toBe(true);
    const ids = loaded.view.rows.filter((row) => row._total !== "1").map((row) => row.short_id);
    expect(ids).toEqual(["26010", "26011"]);
    const first = loaded.view.rows[0];
    expect(first.wet_grams).toBe("448,000");
    expect(first.flag).toBe("No METRC harvest");
    expect(first.dry_grams).toBe("");
    const second = loaded.view.rows[1];
    expect(second.market_strain).toBe("Grip Cake");
    expect(second.farm).toBe("PNS");
    expect(second.flag).toBe("");
    expect(second.metrc_lb).toBe("987.67");
    expect(second.metrc_uom).toBe("Grams");
    expect(second.dry_grams).toBe("224,000");
    expect(loaded.view.rows[2].short_id).toBe("Wet total");
    expect(loaded.view.rows[2].wet_lb_448).toBe("2,000.00");
    expect(loaded.view.rows[3].short_id).toBe("Dry total");
    expect(loaded.view.rows[3].dry_lb_448).toBe("500.00");
    expect(loaded.view.belowTable).toContain("26270-ARL-ID-001-0-NA-26999");
    expect(loaded.view.belowTable).not.toContain("26998");
    expect(loaded.view.belowTable).toContain("133.33 at 448 g");
    expect(loaded.csv).toContain("448000,1000.0000,987.6709,12.3291,,,,,,,No METRC harvest");
    expect(loaded.csv.split("\r\n").find((line) => line.startsWith("26011,"))?.split(",")).toHaveLength(15);

    const farm = await loadHarvestReconciliation(db, new URLSearchParams({ from: "2026-09-01", to: "2026-09-30", farm: "pnn" }), "2026-10-12");
    expect(farm.view.rows.filter((row) => row._total !== "1").map((row) => row.short_id)).toEqual(["26010"]);
    expect(farm.view.belowTable).not.toContain("26999");
    expect(farm.view.belowTable).toContain("100.00 at 448 g");

    const grow = await loadHarvestReconciliation(db, new URLSearchParams({ from: "2026-09-01", to: "2026-09-30", grow_method: "gh" }), "2026-10-12");
    expect(grow.view.rows.filter((row) => row._total !== "1").map((row) => row.short_id)).toEqual(["26011"]);
    expect(grow.view.belowTable).toContain("no grow method");

    const day = await loadHarvestReconciliation(db, new URLSearchParams({ from: "2026-09-21", to: "2026-09-21" }), "2026-10-12");
    expect(day.view.rows.filter((row) => row._total !== "1").map((row) => row.short_id)).toEqual(["26011"]);

    const empty = await loadHarvestReconciliation(db, new URLSearchParams({ from: "2026-01-01", to: "2026-01-15" }), "2026-10-12");
    expect(empty.view.rows).toEqual([]);
    expect(empty.view.empty).toBe(HARVEST_RECONCILE_EMPTY);
    expect(reportPage(empty.view, "", "")).toContain(HARVEST_RECONCILE_EMPTY);
    expect(empty.view.belowTable).toContain("26201-PNN-OD-001-0-NA-26998");
    expect(empty.view.belowTable).not.toContain("26999");

    const es = await loadHarvestReconciliation(db, params, "2026-10-12", "es");
    const page = reportPage(es.view, es.filterHtml, "", "es");
    expect(page).toContain("Conciliacion del peso de cosecha");
    expect(page).toContain("Sin cosecha METRC");
    expect(page).toContain("La libra de la aplicacion es 448 g");
    expect(page).toContain("1.2483 por ciento");
    expect(page).toContain("Cosechado del 2026-09-01 al 2026-09-30");
    expect(page).toContain("harvest_batches.entry_date");
  });
});
