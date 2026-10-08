import { describe, expect, it } from "vitest";
import {
  DRY_STRAIN_NOT_A_DATE,
  DRY_STRAIN_TO_BEFORE_FROM,
  DRY_STRAIN_TOO_LONG,
  dryStrainNames,
  dryStrainRefused,
  dryStrainView,
  filterDryStrainLots,
  listDryStrainLots,
  resolveDryStrainRange,
  unloadDateOf,
  type DryStrainLot,
} from "../src/drystrain";
import { reportCsv, REPORT_CARDS } from "../src/reports";
import { reportPage } from "../src/html";
import { migratedDb } from "./migrated";

const lot = (over: Partial<DryStrainLot>): DryStrainLot => ({
  lotId: over.lotId ?? "lot",
  harvestYear: 2026,
  lotSerial: 10,
  farm: "PNN",
  growMethod: "OD",
  strain: "Fruity Pebbles",
  marketStrain: "Fruity Pebbles",
  wetGrams: 448_000,
  dryGrams: 89_600,
  plantCount: 100,
  effectiveDate: null,
  finishedAt: "2026-09-20T15:00:00.000Z",
  ...over,
});

describe("DRY WEIGHT BY STRAIN (canon 0.30.427)", () => {
  it("counts a lot on its unload date: the typed Effective Date, else the Eastern date of the finish", () => {
    // 01:30 Eastern on 09-21 is 05:30Z: the lot is 09-21's, not 09-20's.
    expect(unloadDateOf({ effectiveDate: null, finishedAt: "2026-09-21T05:30:00.000Z" })).toBe("2026-09-21");
    expect(unloadDateOf({ effectiveDate: "2026-09-08", finishedAt: "2026-09-21T05:30:00.000Z" })).toBe("2026-09-08");
    expect(unloadDateOf({ effectiveDate: "  ", finishedAt: "2026-09-21T05:30:00.000Z" })).toBe("2026-09-21");
  });

  it("takes the range as typed, defaults blanks, and refuses a backwards or long one", () => {
    expect(resolveDryStrainRange("2026-09-01", "2026-10-08", "2026-10-08")).toEqual({ ok: true, from: "2026-09-01", to: "2026-10-08" });
    expect(resolveDryStrainRange("", "", "2026-10-08")).toEqual({ ok: true, from: "2026-09-08", to: "2026-10-08" });
    expect(resolveDryStrainRange("2026-10-09", "2026-10-08", "2026-10-08")).toEqual({ ok: false, message: DRY_STRAIN_TO_BEFORE_FROM });
    expect(resolveDryStrainRange("2025-10-07", "2026-10-08", "2026-10-08")).toEqual({ ok: false, message: DRY_STRAIN_TOO_LONG });
    expect(resolveDryStrainRange("2025-10-08", "2026-10-08", "2026-10-08").ok).toBe(true);
    expect(resolveDryStrainRange("soon", "2026-10-08", "2026-10-08")).toEqual({ ok: false, message: DRY_STRAIN_NOT_A_DATE });
    expect(dryStrainRefused(DRY_STRAIN_TOO_LONG).rows).toEqual([]);
  });

  it("filters by range, either strain name, grow method and farm", () => {
    const lots = [
      lot({ lotId: "a", finishedAt: "2026-09-20T15:00:00.000Z" }),
      lot({ lotId: "b", finishedAt: "2026-09-25T15:00:00.000Z", strain: "Bermuda Triangle", marketStrain: "Grip Cake", farm: "ARL", growMethod: "GH" }),
      lot({ lotId: "c", finishedAt: "2026-10-02T15:00:00.000Z", effectiveDate: "2026-08-30", farm: "PNS" }),
    ];
    const base = { from: "2026-09-01", to: "2026-09-30", strain: "", growMethod: "", farm: "" };
    expect(filterDryStrainLots(lots, base).map((l) => l.lotId)).toEqual(["a", "b"]);
    expect(filterDryStrainLots(lots, { ...base, strain: "grip cake" }).map((l) => l.lotId)).toEqual(["b"]);
    expect(filterDryStrainLots(lots, { ...base, strain: "Bermuda Triangle" }).map((l) => l.lotId)).toEqual(["b"]);
    expect(filterDryStrainLots(lots, { ...base, growMethod: "gh" }).map((l) => l.lotId)).toEqual(["b"]);
    expect(filterDryStrainLots(lots, { ...base, farm: "PNN" }).map((l) => l.lotId)).toEqual(["a"]);
    expect(filterDryStrainLots(lots, { ...base, from: "2026-08-01" }).map((l) => l.lotId)).toEqual(["a", "b", "c"]);
  });

  it("rows one pair of names each, dry first, per plant over counted lots only, then a Total", () => {
    const lots = [
      lot({ lotId: "a", lotSerial: 11, wetGrams: 100_000, dryGrams: 20_000, plantCount: 50 }),
      lot({ lotId: "b", lotSerial: 12, wetGrams: 100_000, dryGrams: 24_800, plantCount: null }),
      lot({ lotId: "c", lotSerial: 13, strain: "Bermuda Triangle", marketStrain: "Grip Cake", wetGrams: 448_000, dryGrams: 112_000, plantCount: 200 }),
      lot({ lotId: "d", lotSerial: 14, strain: "Bermuda Triangle", marketStrain: "bermuda triangle", wetGrams: 44_800, dryGrams: 4_480, plantCount: 10 }),
    ];
    const view = dryStrainView(lots, { from: "2026-09-01", to: "2026-09-30", strain: "", growMethod: "", farm: "" });
    expect(view.rows.map((r) => [r.strain, r.market_strain, r.lots, r.dry_lbs])).toEqual([
      ["Bermuda Triangle", "Grip Cake", 1, 112_000],
      ["Fruity Pebbles", "", 2, 44_800],
      ["Bermuda Triangle", "", 1, 4_480],
      ["Total", "", 4, 161_280],
    ]);
    const fp = view.rows[1];
    expect(fp.wet_lbs).toBe(200_000);
    expect(fp.dry_pct).toBe("22.4");
    // Only lot a carries a count: 20,000 g over 50 plants, 0.89 lb each; lot b stays out of the figure.
    expect(fp.plants).toBe(50);
    expect(fp.dry_per_plant).toBe("0.89");
    expect(fp.lot_ids).toBe("26011 26012");
    expect(fp._fold).toBe("2 lots, 44,800 g dry");
    expect(view.rows[0]._fold).toBe("1 lot, 112,000 g dry");
    const total = view.rows[3];
    expect(total._total).toBe("1");
    expect(total.plants).toBe(260);
    expect(total.dry_per_plant).toBe(((20_000 + 112_000 + 4_480) / 448 / 260).toFixed(2));
    // The Total row carries no fold and no lot list: every lot is under its strain.
    expect(total._fold).toBeUndefined();
    expect(total.lot_ids).toBe("");
    expect(view.heading).toBe("Unloaded 2026-09-01 to 2026-09-30");
    const csv = reportCsv(view);
    expect(csv).toContain("Strain,Market strain,Lots,Wet lb,Dry lb,Dry/Wet %,Plants,Dry lb/plant,Lot numbers");
    expect(csv).toContain("Fruity Pebbles,,2,446.43,100.00,22.4,50,0.89,26011 26012");
    expect(csv).toContain("Total,,4,");
    const page = reportPage(view, "", "");
    expect(page).toContain('<details class="report-fold"><summary>2 lots, 44,800 g dry</summary><span class="report-fold-body">26011 26012</span></details>');
    expect(page).not.toContain("<th>Lot numbers</th>");
    expect(page).toContain('<tr class="report-total">');
    const es = dryStrainView(lots, { from: "2026-09-01", to: "2026-09-30", strain: "Grip Cake", growMethod: "OD", farm: "PNN" }, "es");
    expect(es.heading).toBe("Descargado del 2026-09-01 al 2026-09-30 · cepa Grip Cake · Exterior · PNN");
    expect(es.rows).toHaveLength(2);
  });

  it("says so when nothing was unloaded in the range, and lists every name once for the pick list", () => {
    const lots = [lot({ lotId: "a" }), lot({ lotId: "b", strain: "Bermuda Triangle", marketStrain: "Grip Cake" }), lot({ lotId: "c", strain: "bermuda triangle" })];
    const view = dryStrainView(lots, { from: "2026-01-01", to: "2026-01-31", strain: "", growMethod: "", farm: "" });
    expect(view.rows).toEqual([]);
    expect(view.empty).toBe("No lot was unloaded in that range.");
    expect(reportPage(view, "", "")).toContain("No lot was unloaded in that range.");
    expect(dryStrainNames(lots)).toEqual(["Bermuda Triangle", "Fruity Pebbles", "Grip Cake"]);
    expect(REPORT_CARDS.some((c) => c.key === "dry_weight_by_strain" && c.title === "Dry Weight by Strain")).toBe(true);
  });

  it("reads live lots with a finished unload from the data, the newest session's dates, dry from the entry else its rows", async () => {
    const m = await migratedDb();
    const db = m.db;
    const ts = "2026-09-01T00:00:00.000Z";
    m.run(`INSERT INTO strains (id, name, hbn_code, created_at, updated_at) VALUES ('s1', 'Test Strain R5', '001', ?, ?)`, ts, ts);
    const batch = (id: string, serial: number, extra: Record<string, string | number> = {}) => {
      const cols = { id, entry_date: "2026-09-01", farm_code: "PNN", grow_method_code: "OD", strain_id: "s1", manicure: 0, hbn: `HBN-${id}-26${String(serial).padStart(3, "0")}`, lot_serial: serial, harvest_year: 2026, status: "open", market_strain: "Grip Cake", created_at: ts, updated_at: ts, ...extra };
      m.run(`INSERT INTO harvest_batches (${Object.keys(cols).join(", ")}) VALUES (${Object.keys(cols).map(() => "?").join(", ")})`, ...Object.values(cols));
    };
    const entry = (id: string, batchId: string, extra: Record<string, string | number | null> = {}) => {
      const cols = { id, harvest_batch_id: batchId, weight_grams: 1000, actual_dryspc: "silo", status: "unloaded", created_at: ts, updated_at: ts, ...extra };
      m.run(`INSERT INTO wet_weight_entries (${Object.keys(cols).join(", ")}) VALUES (${Object.keys(cols).map(() => "?").join(", ")})`, ...Object.values(cols));
    };
    const session = (id: string, lotId: string, finishedAt: string | null, effective: string | null, deleted: string | null = null) =>
      m.run(
        `INSERT INTO unload_sessions (id, wet_weight_entry_id, finished_at, effective_date, created_at, updated_at, deleted_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        id, lotId, finishedAt, effective, ts, ts, deleted
      );
    batch("b1", 11);
    entry("w1", "b1", { dry_weight_grams: 300, plant_count: 20 });
    session("u1", "w1", "2026-09-10T15:00:00.000Z", null);
    session("u2", "w1", "2026-09-12T15:00:00.000Z", "2026-09-05");
    session("u3", "w1", "2026-09-30T15:00:00.000Z", null, "2026-10-01T00:00:00.000Z");
    batch("b2", 12);
    entry("w2", "b2", { dry_weight_grams: null });
    m.run(`INSERT INTO dry_weights (id, wet_weight_entry_id, weight_grams, created_at, updated_at) VALUES ('d1', 'w2', 120, ?, ?)`, ts, ts);
    m.run(`INSERT INTO dry_weights (id, wet_weight_entry_id, weight_grams, created_at, updated_at, deleted_at) VALUES ('d2', 'w2', 999, ?, ?, ?)`, ts, ts, ts);
    session("u4", "w2", "2026-09-20T15:00:00.000Z", null);
    batch("b3", 13);
    entry("w3", "b3");
    session("u5", "w3", null, null);
    batch("b4", 90001, { is_test: 1 });
    entry("w4", "b4");
    session("u6", "w4", "2026-09-20T15:00:00.000Z", null);
    batch("b5", 15, { deleted_at: ts });
    entry("w5", "b5");
    session("u7", "w5", "2026-09-20T15:00:00.000Z", null);
    const lots = await listDryStrainLots(db);
    expect(lots.map((l) => l.lotId).sort()).toEqual(["w1", "w2"]);
    const w1 = lots.find((l) => l.lotId === "w1")!;
    expect(w1).toMatchObject({ harvestYear: 2026, lotSerial: 11, farm: "PNN", growMethod: "OD", strain: "Test Strain R5", marketStrain: "Grip Cake", wetGrams: 1000, dryGrams: 300, plantCount: 20, effectiveDate: "2026-09-05", finishedAt: "2026-09-12T15:00:00.000Z" });
    expect(unloadDateOf(w1)).toBe("2026-09-05");
    const w2 = lots.find((l) => l.lotId === "w2")!;
    expect(w2.dryGrams).toBe(120);
    expect(w2.plantCount).toBeNull();
  });
});
