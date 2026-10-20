import { describe, expect, it } from "vitest";
import { format2, round2 } from "../src/config";
import { consoleBoxes, type HarvestConsoleInput } from "../src/console";
import { directorWallPage, loadDirectorWall } from "../src/director";
import { DD_KPIS, ddKpi, ddKpisForWall } from "../src/directorregistry";
import { buildStrainPerformance } from "../src/strainperformance";
import {
  emptyPlantWeight,
  plantWeightBody,
  plantWeightFigures,
  plantWeightSlices,
  type PlantWeightLot,
  type PlantWeightSlice,
} from "../src/plantweight";
import { migratedDb, seedBatch, seedLot } from "./migrated";

const DASH = new RegExp("[" + String.fromCharCode(0x2013, 0x2014) + "]");
const TODAY = "2026-10-19";
const NOW = "2026-10-19T16:00:00.000Z";
const T = "2026-10-19T12:00:00.000Z";
const AFTER = "98cf3164-344e-414a-9f1c-1526fde445ac";
const ALIEN = "bb271969-e132-445b-b97b-51f676c8e225";

const lots: PlantWeightLot[] = [
  { id: "a", day: "2026-10-19", farm: "PNN", strain: "Gelato", grow: "OD", plants: 10, grams: 4480 },
  { id: "b", day: "2026-09-01", farm: "PNS", strain: "Sherb", grow: "GH", plants: 10, grams: 8960 },
  { id: "c", day: "", farm: "ARL", strain: "Lemon", grow: "OD", plants: 4, grams: 2240 },
];

const slices: PlantWeightSlice[] = [
  { strain: "Gelato", farm: "PNN", grow: "OD", seasonLb: 100, plantsHarvested: 10, plantsRemaining: 10, estimateMissing: false },
  { strain: "Sherb", farm: "PNS", grow: "GH", seasonLb: 40, plantsHarvested: 10, plantsRemaining: 0, estimateMissing: false },
  { strain: "Lemon", farm: "ARL", grow: "OD", seasonLb: 10, plantsHarvested: 0, plantsRemaining: 5, estimateMissing: true },
];

function consoleInput(rows: PlantWeightLot[]): HarvestConsoleInput {
  return {
    today: TODAY,
    day: TODAY,
    dayPicked: false,
    year: 2026,
    remaining: [],
    seasonHarvested: [],
    seasonLots: rows.map((row) => ({ farm: row.farm, wet_grams: 0, dry_grams: row.grams, plant_count: row.plants })),
    dayWet: [],
    hours: { PNN: null, ARL: null, PNS: null },
    plantCounts: { PNN: null, ARL: null, PNS: null },
  };
}

function dryText(farm: string | null): string {
  const box = consoleBoxes(consoleInput(lots)).find((row) => row.farm === (farm ?? "Total"));
  return box?.metrics.find((metric) => metric.key === "dry_per_plant")?.value ?? "";
}

function addBatch(
  m: Awaited<ReturnType<typeof migratedDb>>,
  row: { batch: string; lot: string; hbn: string; serial: number; strain: string; farm: string; grow: string; dry: number | null; plants: number | null; status?: string; customer?: string | null; test?: number; unload?: string }
): void {
  seedBatch(m, { id: row.batch, hbn: row.hbn, serial: row.serial, strainId: row.strain, farm: row.farm });
  m.run(`UPDATE harvest_batches SET grow_method_code = ?, customer = ?, is_test = ? WHERE id = ?`, row.grow, row.customer ?? null, row.test ?? 0, row.batch);
  seedLot(m, row.lot, row.batch, row.status ?? "trimmed");
  m.run(`UPDATE wet_weight_entries SET dry_weight_grams = ?, plant_count = ?, weight_grams = 20000 WHERE id = ?`, row.dry, row.plants, row.lot);
  if (row.unload) {
    m.run(
      `INSERT INTO unload_sessions (id, wet_weight_entry_id, finished_at, effective_date, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`,
      `${row.lot}-u`,
      row.lot,
      NOW,
      row.unload,
      T,
      T
    );
  }
}

describe("DD S3d plant weight", () => {
  it("AVG with every select All equals the console Total, and a farm pick equals that farm", () => {
    const all = plantWeightFigures({ today: TODAY, lots, slices: [] }, { period: "htd", strain: "", farm: "", grow: "" });
    expect(`${format2(all.avg.lb)} lb`).toBe(dryText(null));
    for (const farm of ["PNN", "PNS", "ARL"] as const) {
      const picked = plantWeightFigures({ today: TODAY, lots, slices: [] }, { period: "htd", strain: "", farm, grow: "" });
      expect(`${format2(picked.avg.lb)} lb`, farm).toBe(dryText(farm));
    }
  });

  it("HTD counts a dried lot with no unload day on record, so HTD equals AVG (Scribe gate fix)", () => {
    const noDay = { ...lots[0], day: "" };
    const model = { today: TODAY, lots: [...lots, noDay], slices: [] };
    const htd = plantWeightFigures(model, { period: "htd", strain: "", farm: "", grow: "" });
    expect(htd.period).toEqual(htd.avg);
    const fourteen = plantWeightFigures(model, { period: "14", strain: "", farm: "", grow: "" });
    expect(fourteen.period.lots).toBeLessThan(htd.period.lots);
  });

  it("the period box counts lots by unload day, and strain, farm, and grow method narrow all three boxes", () => {
    const all = plantWeightFigures({ today: TODAY, lots, slices }, { period: "14", strain: "", farm: "", grow: "" });
    expect(all.period.lots).toBe(1);
    expect(all.period.plants).toBe(10);
    expect(all.period.lb).toBe(1);
    expect(all.avg.lots).toBe(3);
    expect(all.avg.plants).toBe(24);
    expect(format2(all.avg.lb)).toBe("1.46");
    const gelato = plantWeightFigures({ today: TODAY, lots, slices }, { period: "14", strain: "Gelato", farm: "", grow: "" });
    const pns = plantWeightFigures({ today: TODAY, lots, slices }, { period: "14", strain: "", farm: "PNS", grow: "" });
    const gh = plantWeightFigures({ today: TODAY, lots, slices }, { period: "htd", strain: "", farm: "", grow: "GH" });
    expect(gelato.period.lb).toBe(1);
    expect(gelato.avg.lots).toBe(1);
    expect(gelato.projected.lb).toBe(5);
    expect(gelato.projected.missing).toBe(0);
    expect(pns.period.lb).toBeNull();
    expect(pns.avg.lb).toBe(2);
    expect(pns.projected.lb).toBe(4);
    expect(gh.period.lots).toBe(1);
    expect(gh.avg.lb).toBe(2);
    expect(gh.projected.lb).toBe(4);
    expect(gh.projected.missing).toBe(0);
    expect(all.projected.lb).not.toBe(gelato.projected.lb);
    expect(all.projected.missing).toBe(1);
    const empty = plantWeightFigures({ today: TODAY, lots, slices }, { period: "14", strain: "Nope", farm: "", grow: "" });
    expect(empty.period.lb).toBeNull();
    expect(empty.avg.lb).toBeNull();
    expect(empty.projected.lb).toBeNull();
  });

  it("projected equals strain performance for one strain and farm, and flags a missing estimate", () => {
    const model = buildStrainPerformance({
      day: TODAY,
      year: 2026,
      lots: [
        { id: "l1", farm: "PNN", strain: "Gelato", marketStrain: "", wetGrams: 20000, dryGrams: 4480, plantCount: 10, unloaded: true },
      ],
      plants: [{ farm: "PNN", strain: "Gelato", plants: 4 }],
      estimates: [{ strainName: "Gelato", farm: "PNN", effectiveDate: "2026-10-01", dryLbPerPlant: 4.25 }],
    });
    const row = model.rows.find((item) => !item.total);
    expect(row).toBeTruthy();
    if (!row) return;
    const built = plantWeightSlices(
      model.rows,
      [{ strain: "Gelato", farm: "PNN", grow: "OD", plantCount: 10, dryGrams: 4480, wetGrams: 20000, unloaded: true }],
      [{ strain: "Gelato", farm: "PNN", grow: "OD", plants: 4 }]
    );
    expect(built.mixed).toEqual([]);
    expect(built.slices).toHaveLength(1);
    expect(built.slices[0]?.seasonLb).toBe(row.seasonLb);
    expect((built.slices[0]?.plantsHarvested ?? 0) + (built.slices[0]?.plantsRemaining ?? 0)).toBe(row.plantsHarvested + row.plantsRemaining);
    const fig = plantWeightFigures({ today: TODAY, lots: [], slices: built.slices }, { period: "14", strain: "Gelato", farm: "PNN", grow: "OD" });
    expect(fig.projected.lb).toBe(round2(row.seasonLb / (row.plantsHarvested + row.plantsRemaining)));
    expect(fig.projected.missing).toBe(0);

    const missing = buildStrainPerformance({
      day: TODAY,
      year: 2026,
      lots: [{ id: "l2", farm: "PNS", strain: "Sherb", marketStrain: "", wetGrams: 10000, dryGrams: 4480, plantCount: 5, unloaded: true }],
      plants: [{ farm: "PNS", strain: "Sherb", plants: 3 }],
      estimates: [],
    });
    const missRow = missing.rows.find((item) => !item.total);
    expect(missRow?.estimateMissing).toBe(true);
    const missSlices = plantWeightSlices(
      missing.rows,
      [{ strain: "Sherb", farm: "PNS", grow: "GH", plantCount: 5, dryGrams: 4480, wetGrams: 10000, unloaded: true }],
      [{ strain: "Sherb", farm: "PNS", grow: "GH", plants: 3 }]
    );
    const missFig = plantWeightFigures({ today: TODAY, lots: [], slices: missSlices.slices }, { period: "14", strain: "Sherb", farm: "PNS", grow: "" });
    expect(missFig.projected.missing).toBe(1);
    expect(missFig.projected.lb).toBe(round2((missRow?.seasonLb ?? 0) / ((missRow?.plantsHarvested ?? 0) + (missRow?.plantsRemaining ?? 0))));

    const mixedLots = [
      { strain: "Gelato", farm: "PNN", grow: "OD", plantCount: 10, dryGrams: 4480, wetGrams: 9000, unloaded: true },
      { strain: "Gelato", farm: "PNN", grow: "GH", plantCount: 10, dryGrams: 4480, wetGrams: 9000, unloaded: true },
    ];
    const mixedModel = buildStrainPerformance({
      day: TODAY,
      year: 2026,
      lots: mixedLots.map((lot, i) => ({
        id: `m${i}`,
        farm: "PNN",
        strain: "Gelato",
        marketStrain: "",
        wetGrams: lot.wetGrams,
        dryGrams: lot.dryGrams,
        plantCount: lot.plantCount,
        unloaded: true,
      })),
      plants: [
        { farm: "PNN", strain: "Gelato", plants: 4 },
        { farm: "PNN", strain: "Gelato", plants: 2 },
      ],
      estimates: [{ strainName: "Gelato", farm: "PNN", effectiveDate: "2026-10-01", dryLbPerPlant: 4 }],
    });
    const mixedRow = mixedModel.rows.find((item) => !item.total);
    const mixed = plantWeightSlices(mixedModel.rows, mixedLots, [
      { strain: "Gelato", farm: "PNN", grow: "GH", plants: 4 },
      { strain: "Gelato", farm: "PNN", grow: "OD", plants: 2 },
    ]);
    expect(mixed.mixed).toEqual(["Gelato at PNN"]);
    const season = mixed.slices.reduce((n, item) => n + item.seasonLb, 0);
    const plants = mixed.slices.reduce((n, item) => n + item.plantsHarvested + item.plantsRemaining, 0);
    expect(season).toBe(mixedRow?.seasonLb);
    expect(plants).toBe((mixedRow?.plantsHarvested ?? 0) + (mixedRow?.plantsRemaining ?? 0));
  });

  it("an empty selection reads No data, and the wall leaves toll, test, and undried lots out", async () => {
    const blank = plantWeightBody(emptyPlantWeight(TODAY, 2026), "en");
    expect(blank.match(/>No data</g)).toHaveLength(3);
    expect(blank.match(/data-dd-pw-lb=""/g)).toHaveLength(3);
    expect(blank).not.toContain('data-dd-pw-lb="0.00"');
    expect(DASH.test(blank)).toBe(false);

    const m = await migratedDb();
    addBatch(m, { batch: "pw-a", lot: "pw-la", hbn: "PW-A", serial: 9101, strain: AFTER, farm: "PNN", grow: "OD", dry: 4480, plants: 10, unload: TODAY });
    addBatch(m, { batch: "pw-b", lot: "pw-lb", hbn: "PW-B", serial: 9102, strain: ALIEN, farm: "PNS", grow: "GH", dry: 8960, plants: 8, unload: "2026-09-20" });
    addBatch(m, { batch: "pw-toll", lot: "pw-lt", hbn: "PW-T", serial: 9103, strain: AFTER, farm: "PNN", grow: "OD", dry: 4480, plants: 10, unload: TODAY, customer: "Other Co" });
    addBatch(m, { batch: "pw-test", lot: "pw-lx", hbn: "PW-X", serial: 9104, strain: AFTER, farm: "PNN", grow: "OD", dry: 4480, plants: 10, unload: TODAY, test: 1 });
    addBatch(m, { batch: "pw-wet", lot: "pw-lw", hbn: "PW-W", serial: 9105, strain: AFTER, farm: "PNN", grow: "OD", dry: 0, plants: 10, status: "drying" });
    addBatch(m, { batch: "pw-scale", lot: "pw-ls", hbn: "PW-S", serial: 9106, strain: AFTER, farm: "PNN", grow: "OD", dry: 4480, plants: 10, status: "weighing", unload: TODAY });
    addBatch(m, { batch: "pw-none", lot: "pw-ln", hbn: "PW-N", serial: 9107, strain: AFTER, farm: "ARL", grow: "OD", dry: 4480, plants: null, unload: TODAY });
    m.run(
      `INSERT INTO field_estimates (id, strain_id, farm_code, effective_date, est_dry_weight, created_at) VALUES ('pw-est', ?, 'PNN', '2026-10-01', 4.5, ?)`,
      AFTER,
      T
    );
    for (let i = 0; i < 4; i += 1) {
      m.run(
        `INSERT INTO metrc_plants (tag, license_value, phase, strain, location, hold, harvested, mount_id, first_seen_at, changed_at)
         VALUES (?, 'AU-G-C-000832', 'flowering', 'After Party', 'Field 1', 0, 0, 'pw', ?, ?)`,
        `PW-A-${i}`,
        T,
        T
      );
    }
    m.run(
      `INSERT INTO metrc_plants (tag, license_value, phase, strain, location, hold, harvested, mount_id, first_seen_at, changed_at)
       VALUES ('PW-M-1', 'AU-G-C-000832', 'flowering', 'Amnesia Haze', 'Field 2', 0, 0, 'pw', ?, ?)`,
      T,
      T
    );
    const html = directorWallPage(await loadDirectorWall(m.db, "bizops", TODAY, null, null, NOW), "en");
    const at = html.indexOf('data-dd-kpi="bizops.plant_weight"');
    const tile = html.slice(html.lastIndexOf("<article", at), html.indexOf("</article>", at));
    expect(tile).toContain(">Plant Weight<");
    expect(tile).toContain('data-dd-version="1"');
    expect(tile).toContain('data-dd-pw-value="period"');
    expect(tile).toContain(">1.00<");
    expect(tile).toContain("1 lot, 10 plants");
    expect(tile).toContain(">1.67<");
    expect(tile).toContain("2 lots, 18 plants");
    expect(tile).toContain("Field estimate missing for 1 strain");
    const strainSelect = tile.slice(tile.indexOf("data-dd-pw-strain"), tile.indexOf("</select>", tile.indexOf("data-dd-pw-strain")));
    expect(strainSelect).toContain("After Party");
    expect(strainSelect).toContain("Alien Dawg");
    expect(strainSelect).not.toContain("Amnesia Haze");
    expect(html).not.toContain("Testing turnaround");
    expect(html).not.toContain('data-dd-kpi="bizops.lab_turnaround_days"');
    expect(DASH.test(tile)).toBe(false);
    expect(ddKpi("bizops.lab_turnaround_days")?.active).toBe(0);
    expect(ddKpisForWall(DD_KPIS, "bizops").map((row) => row.kpi_key)).toContain("bizops.plant_weight");
    const total = consoleBoxes({
      today: TODAY,
      day: TODAY,
      dayPicked: false,
      year: 2026,
      remaining: [],
      seasonHarvested: [],
      seasonLots: [
        { farm: "PNN", wet_grams: 20000, dry_grams: 4480, plant_count: 10 },
        { farm: "PNS", wet_grams: 20000, dry_grams: 8960, plant_count: 8 },
      ],
      dayWet: [],
      hours: { PNN: null, ARL: null, PNS: null },
      plantCounts: { PNN: null, ARL: null, PNS: null },
    })
      .find((row) => row.farm === "Total")
      ?.metrics.find((metric) => metric.key === "dry_per_plant")?.value;
    expect(tile).toContain(`>${(total ?? "").replace(" lb", "")}<`);
  });
});
