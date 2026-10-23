import { describe, expect, it } from "vitest";
import { GRAMS_PER_LB } from "../src/config";
import { directorWallPage, loadDirectorWall } from "../src/director";
import { ddKpi, ddSeedSql, YIELD_SEASONS_COMPUTE } from "../src/directorregistry";
import { buildStrainPerformance, type StrainPerformanceEstimate, type StrainPerformanceLot } from "../src/strainperformance";
import { buildXlsx } from "../src/xlsx";
import {
  buildYieldSeasons,
  commitSeasonYields,
  deleteSeasonYield,
  loadPastSeasonsPage,
  PAST_SEASONS_REASON,
  pastSeasonsPage,
  previewSeasonYields,
  PROJECTED_NOTE,
  refreshYieldSeasons,
  SHEET_SHAPE,
  yieldSeasonsBody,
  type SeasonYieldInput,
} from "../src/yieldseasons";
import { formOf, migratedDb, seedBatch, seedPerson } from "./migrated";

const DASH = new RegExp("[" + String.fromCharCode(0x2013, 0x2014) + "]");
const NOW = "2026-10-21T16:00:00.000Z";
const DAY = "2026-10-21";
const YEAR = 2026;

function grams(plants: number, lbEach: number): number {
  return plants * lbEach * GRAMS_PER_LB;
}

function lot(over: Partial<StrainPerformanceLot> & Pick<StrainPerformanceLot, "id" | "strain">): StrainPerformanceLot {
  return {
    id: over.id,
    farm: over.farm ?? "PNN",
    strain: over.strain,
    marketStrain: over.marketStrain ?? over.strain,
    wetGrams: over.wetGrams ?? 1000,
    dryGrams: over.dryGrams === undefined ? null : over.dryGrams,
    plantCount: over.plantCount === undefined ? null : over.plantCount,
    unloaded: over.unloaded ?? false,
  };
}

function rowOf(html: string, strain: string): string {
  const at = html.indexOf(`data-dd-yield-strain="${strain}"`);
  expect(at, strain).toBeGreaterThanOrEqual(0);
  return html.slice(at, html.indexOf("</tr>", at));
}

describe("yield per plant seasons", () => {
  it("puts two seasons beside this year, and the farm wide row is the sums", () => {
    const seasons: SeasonYieldInput[] = [
      { season: 2024, strain: "Both", farm: "PNN", plants: 100, dryLb: 400 },
      { season: 2025, strain: "Both", farm: "PNN", plants: 100, dryLb: 200 },
      { season: 2025, strain: "One", farm: "PNN", plants: 50, dryLb: 150 },
      { season: 2023, strain: "Old", farm: null, plants: 10, dryLb: 10 },
    ];
    const lots: StrainPerformanceLot[] = [
      lot({ id: "both-dry", strain: "Both", plantCount: 10, dryGrams: grams(10, 4), unloaded: true }),
      lot({ id: "both-hang-a", strain: "Both", plantCount: 10, unloaded: false }),
      lot({ id: "both-hang-b", strain: "Both", plantCount: 10, unloaded: false }),
      lot({ id: "one-dry", strain: "One", plantCount: 20, dryGrams: grams(20, 2), unloaded: true }),
      lot({ id: "new-dry", strain: "New", plantCount: 5, dryGrams: grams(5, 4), unloaded: true }),
      lot({ id: "new-blank", strain: "New", plantCount: null, dryGrams: 448, unloaded: true }),
    ];
    const estimates: StrainPerformanceEstimate[] = [{ strainName: "Both", farm: "PNN", effectiveDate: "2026-01-01", dryLbPerPlant: 5 }];
    const model = buildYieldSeasons({ seasons, lots, estimates, day: DAY, year: YEAR });
    const html = yieldSeasonsBody(model, "en");
    const perf = buildStrainPerformance({ lots, plants: [], estimates, day: DAY, year: YEAR });
    expect(perf.rows.find((row) => row.strain === "Both" && !row.total)?.dryLbPerPlant).toBe("4.00");
    expect(perf.rows.find((row) => row.total)?.dryLbPerPlant).toBe("2.86");
    expect(rowOf(html, "Both")).toContain('data-dd-yield-todate="4.00"');
    expect(rowOf(html, "One")).toContain('data-dd-yield-todate="2.00"');
    expect(rowOf(html, "New")).toContain('data-dd-yield-todate="4.00"');
    const both = rowOf(html, "Both");
    expect(both).toContain('data-dd-yield-s0="4.00"');
    expect(both).toContain('data-dd-yield-s1="2.00"');
    expect(both).toContain('data-dd-yield-avg="3.00"');
    expect(both).toContain('data-dd-yield-projected="4.67"');
    expect(both).toContain('data-dd-yield-state="projected"');
    expect(both).toContain(">projected<");
    const one = rowOf(html, "One");
    expect(one).toContain('data-dd-yield-s0="not grown"');
    expect(one).toContain('data-dd-yield-s1="3.00"');
    expect(one).toContain('data-dd-yield-avg="3.00"');
    expect(one).toContain('data-dd-yield-state="final"');
    expect(one).toContain('data-dd-yield-projected="2.00"');
    const fresh = rowOf(html, "New");
    expect(fresh).toContain('data-dd-yield-s0="not grown"');
    expect(fresh).toContain('data-dd-yield-s1="not grown"');
    expect(fresh).toContain('data-dd-yield-avg="new"');
    expect(fresh).toContain('data-dd-yield-state="final"');
    const order = [...html.matchAll(/data-dd-yield-strain="([^"]+)"/g)].map((hit) => hit[1]);
    expect(order).toEqual(["Both", "New", "One"]);
    const wideAt = html.indexOf('data-dd-yield-farm="1"');
    const wide = html.slice(wideAt, html.indexOf("</tr>", wideAt));
    expect(wideAt).toBeGreaterThan(html.lastIndexOf('data-dd-yield-strain="'));
    expect(wide).toContain('data-dd-yield-s0="4.00"');
    expect(wide).toContain('data-dd-yield-s1="2.33"');
    expect(wide).toContain('data-dd-yield-avg="3.17"');
    expect(wide).toContain('data-dd-yield-todate="2.86"');
    expect(wide).toContain('data-dd-yield-projected="3.64"');
    expect(wide).toContain('data-dd-yield-state="projected"');
    expect(html).toContain("2024");
    expect(html).toContain("2025");
    expect(html).not.toContain(">2023<");
    expect(html).toContain("2026 to date");
    expect(html).toContain("2026 projected");
    expect(html).toContain("Avg (2 seasons)");
    expect(html).toContain(PROJECTED_NOTE);
    expect(html).toContain("3 strains; to date over 3 dried lots with plant counts; 2 lots still drying; 1 lot with no plant count");
    expect(html).toContain("10 plants");
    expect(DASH.test(html)).toBe(false);

    const done = lots.map((row) =>
      row.id.startsWith("both-hang") ? { ...row, unloaded: true, dryGrams: grams(10, 5) } : row
    );
    const after = yieldSeasonsBody(buildYieldSeasons({ seasons, lots: done, estimates, day: DAY, year: YEAR }), "en");
    const bothDone = rowOf(after, "Both");
    expect(bothDone).toContain('data-dd-yield-state="final"');
    expect(bothDone).toContain('data-dd-yield-todate="4.67"');
    expect(bothDone).toContain('data-dd-yield-projected="4.67"');
    expect(bothDone).toContain(">final<");
    const wideDone = after.slice(after.indexOf('data-dd-yield-farm="1"'));
    expect(wideDone).toContain('data-dd-yield-state="final"');
    expect(wideDone).toContain('data-dd-yield-todate="3.64"');
    expect(wideDone).toContain('data-dd-yield-projected="3.64"');
  });

  it("leaves drying lots with no estimate out of projected, totals the whole season farm wide, and shows no word without a number", () => {
    const seasons: SeasonYieldInput[] = [
      { season: 2024, strain: "Kept", farm: "PNN", plants: 40, dryLb: 120 },
      { season: 2025, strain: "Kept", farm: "PNN", plants: 50, dryLb: 200 },
      { season: 2025, strain: "Gone", farm: "PNN", plants: 50, dryLb: 50 },
    ];
    const lots: StrainPerformanceLot[] = [
      lot({ id: "kept-dry", strain: "Kept", plantCount: 10, dryGrams: grams(10, 4), unloaded: true }),
      lot({ id: "kept-hang", strain: "Kept", plantCount: 10, unloaded: false }),
      lot({ id: "noest-hang", strain: "NoEst", plantCount: 10, unloaded: false }),
      lot({ id: "blank-dry", strain: "Blank", plantCount: null, dryGrams: grams(1, 3), unloaded: true }),
    ];
    const model = buildYieldSeasons({ seasons, lots, estimates: [], day: DAY, year: YEAR });
    const html = yieldSeasonsBody(model, "en");
    const kept = rowOf(html, "Kept");
    expect(kept).toContain('data-dd-yield-todate="4.00"');
    expect(kept).toContain('data-dd-yield-projected="4.00"');
    expect(kept).toContain('data-dd-yield-state="projected"');
    expect(kept).toContain("2026 projected: 10 plants, 40.00 lb");
    const noEst = rowOf(html, "NoEst");
    expect(noEst).not.toContain(">projected<");
    expect(noEst).not.toContain(">final<");
    expect(noEst).not.toContain('data-dd-yield-projected="0.00"');
    const blank = rowOf(html, "Blank");
    expect(blank).not.toContain(">final<");
    expect(blank).not.toContain('data-dd-yield-state="final"');
    expect(html).not.toContain('data-dd-yield-strain="Gone"');
    const wideAt = html.indexOf('data-dd-yield-farm="1"');
    const wide = html.slice(wideAt, html.indexOf("</tr>", wideAt));
    expect(wide).toContain('data-dd-yield-s0="3.00"');
    expect(wide).toContain('data-dd-yield-s1="2.50"');
    expect(wide).toContain('data-dd-yield-projected="4.00"');
    expect(model.noEstimateLots).toBe(2);
    expect(html).toContain("2 lots still drying with no field estimate, left out of projected.");
    expect(DASH.test(html)).toBe(false);
    const withEstimate = buildYieldSeasons({
      seasons,
      lots,
      estimates: [{ strainName: "Kept", farm: "PNN", effectiveDate: "2026-01-01", dryLbPerPlant: 6 }],
      day: DAY,
      year: YEAR,
    });
    const keptEst = rowOf(yieldSeasonsBody(withEstimate, "en"), "Kept");
    expect(keptEst).toContain('data-dd-yield-projected="5.00"');
    expect(withEstimate.noEstimateLots).toBe(1);
  });

  it("previews, commits, names a refusal, matches a strain, and logs a change", async () => {
    const m = await migratedDb();
    seedPerson(m);
    m.run(`INSERT INTO strains (id, name, hbn_code, created_at, updated_at) VALUES ('yy-gelato', 'Yy Gelato', 'yy41', ?, ?)`, NOW, NOW);
    const csv = [
      "Season,Strain,Farm,Plants,Dry lb",
      "2024,yy  gelato,PNN,10,50",
      "2024,yy  gelato,PNN,10,50",
      "2025,Yy Mystery,,8,20",
      "2025,Yy Nope,,",
      " , , , , ",
    ].join("\n");
    const bytes = new TextEncoder().encode(csv);
    const preview = await previewSeasonYields(m.db, bytes);
    expect(preview.matched).toEqual(["Yy Gelato"]);
    expect(preview.unmatched).toContain("Yy Mystery");
    expect(preview.duplicates.some((line) => line.includes("yy  gelato") && line.includes("duplicate"))).toBe(true);
    expect(preview.refused.some((line) => line.includes("Yy Nope") && line.includes("no plants"))).toBe(true);
    expect(preview.landing).toBe(2);
    const first = await commitSeasonYields(m.db, bytes, "person-1", NOW);
    expect(first.added).toBe(2);
    expect(first.updated).toBe(0);
    expect(m.all(`SELECT strain, strain_id, farm_code, plants, dry_lb FROM dd_season_yields WHERE deleted_at IS NULL ORDER BY strain, season`)).toEqual([
      { strain: "Yy Mystery", strain_id: null, farm_code: null, plants: 8, dry_lb: 20 },
      { strain: "yy  gelato", strain_id: "yy-gelato", farm_code: "PNN", plants: 10, dry_lb: 50 },
    ]);
    const logs = Number(m.get(`SELECT COUNT(*) AS n FROM record_change_log WHERE record_table = 'dd_season_yields'`)?.n);
    const again = await commitSeasonYields(m.db, bytes, "person-1", NOW);
    expect(again.added).toBe(0);
    expect(again.updated).toBe(0);
    expect(again.unchanged).toBe(2);
    expect(Number(m.get(`SELECT COUNT(*) AS n FROM record_change_log WHERE record_table = 'dd_season_yields'`)?.n)).toBe(logs);
    const changed = new TextEncoder().encode(["Season,Strain,Farm,Plants,Dry lb", "2024,yy  gelato,PNN,12,60", "2025,Yy Mystery,,8,20"].join("\n"));
    const updated = await commitSeasonYields(m.db, changed, "person-1", "2026-10-21T17:00:00.000Z");
    expect(updated.updated).toBe(1);
    expect(updated.unchanged).toBe(1);
    expect(m.get(`SELECT plants, dry_lb FROM dd_season_yields WHERE strain_id = 'yy-gelato'`)).toMatchObject({ plants: 12, dry_lb: 60 });
    expect(m.get(`SELECT reason, field, old_value, new_value FROM record_change_log WHERE record_table = 'dd_season_yields' AND field = 'dry_lb' AND old_value = '50' AND reason = ?`, PAST_SEASONS_REASON)).toMatchObject({
      reason: PAST_SEASONS_REASON,
      field: "dry_lb",
      old_value: "50",
      new_value: "60",
    });
    const book = buildXlsx({
      headers: ["Season", "Strain", "Farm", "Plants", "Dry lb"],
      rows: [[{ number: 2024 }, { text: "Sheet Only" }, { text: "" }, { number: 4 }, { number: 8 }]],
    });
    const fromBook = await commitSeasonYields(m.db, book, "person-1", NOW);
    expect(fromBook.added).toBe(1);
    expect(m.get(`SELECT plants, dry_lb, farm_code FROM dd_season_yields WHERE strain = 'Sheet Only'`)).toMatchObject({ plants: 4, dry_lb: 8, farm_code: null });
    const page = pastSeasonsPage(await loadPastSeasonsPage(m.db), "en");
    expect(page).toContain(SHEET_SHAPE);
    expect(page).toContain('data-dd-season="2024"');
    expect(page).toContain("Farm wide");
    expect(page).toContain("yy  gelato");
    expect(DASH.test(page)).toBe(false);
    const id = String(m.get(`SELECT id FROM dd_season_yields WHERE strain = 'Yy Mystery'`)?.id);
    await expect(deleteSeasonYield(m.db, id, formOf({ person_id: "person-1" }), NOW)).rejects.toMatchObject({ status: 400 });
    await deleteSeasonYield(m.db, id, formOf({ person_id: "person-1", reason: "wrong row" }), NOW);
    expect(m.get(`SELECT delete_reason FROM dd_season_yields WHERE id = ?`, id)?.delete_reason).toBe("wrong row");
    expect(pastSeasonsPage(await loadPastSeasonsPage(m.db), "en")).not.toContain('data-dd-season-row="' + id + '"');
    await expect(previewSeasonYields(m.db, new TextEncoder().encode("Hello,There\n1,2\n"))).rejects.toMatchObject({ status: 400 });
  });

  it("reads the tile live and stores the farm wide numbers", async () => {
    const m = await migratedDb();
    seedPerson(m);
    m.run(`INSERT INTO strains (id, name, hbn_code, created_at, updated_at) VALUES ('both', 'Both', 'yy51', ?, ?)`, NOW, NOW);
    seedBatch(m, { id: "yy-batch", hbn: "SMOKEYIELD", serial: 8801, strainId: "both", farm: "PNN" });
    m.run(
      `INSERT INTO wet_weight_entries (id, harvest_batch_id, weight_grams, dry_weight_grams, actual_dryspc, status, plant_count, created_at, updated_at) VALUES ('yy-dry', 'yy-batch', 1000, ?, 'silo', 'trimmed', 10, ?, ?)`,
      grams(10, 4),
      NOW,
      NOW
    );
    m.run(
      `INSERT INTO unload_sessions (id, wet_weight_entry_id, finished_at, effective_date, created_at, updated_at) VALUES ('yy-unload', 'yy-dry', ?, ?, ?, ?)`,
      NOW,
      DAY,
      NOW,
      NOW
    );
    m.run(
      `INSERT INTO wet_weight_entries (id, harvest_batch_id, weight_grams, actual_dryspc, status, plant_count, created_at, updated_at) VALUES ('yy-hang', 'yy-batch', 1000, 'silo', 'drying', 10, ?, ?)`,
      NOW,
      NOW
    );
    m.run(
      `INSERT INTO field_estimates (id, strain_id, farm_code, effective_date, est_dry_weight, created_at) VALUES ('yy-est', 'both', 'PNN', '2026-01-01', 5, ?)`,
      NOW
    );
    await commitSeasonYields(
      m.db,
      new TextEncoder().encode(["Season,Strain,Farm,Plants,Dry lb", "2024,Both,PNN,100,400", "2025,Both,PNN,100,200"].join("\n")),
      "person-1",
      NOW
    );
    const wall = directorWallPage(await loadDirectorWall(m.db, "farmops", DAY, null, null, NOW), "en");
    const both = rowOf(wall, "Both");
    expect(wall).toContain("Yield per Plant: seasons");
    expect(both).toContain('data-dd-yield-todate="4.00"');
    expect(both).toContain('data-dd-yield-projected="4.50"');
    expect(both).toContain('data-dd-yield-state="projected"');
    expect(wall).toContain(PROJECTED_NOTE);
    expect(DASH.test(wall)).toBe(false);
    const stored = await refreshYieldSeasons(m.db, NOW);
    expect(stored.toDate).toBe(4);
    expect(stored.projected).toBe(4.5);
    expect(stored.written).toBe(3);
    const dims = m.all(
      `SELECT dim_key, value FROM dd_kpi_values WHERE kpi_key = 'harvest.dry_lb_per_plant_vs_plan_pct' AND superseded_at IS NULL ORDER BY dim_key`
    );
    expect(dims).toEqual([
      { dim_key: "", value: 4 },
      { dim_key: "projected", value: 4.5 },
      { dim_key: "todate", value: 4 },
    ]);
    const quiet = await refreshYieldSeasons(m.db, NOW);
    expect(quiet.written).toBe(0);
  });

  it("keeps the registry title and the 0105 seed", async () => {
    const row = ddKpi("harvest.dry_lb_per_plant_vs_plan_pct");
    expect(row?.title_en).toBe("Yield per Plant: seasons");
    expect(row?.title_es).toBe("Rendimiento por planta: temporadas");
    expect(row?.unit).toBe("lb448");
    expect(row?.goal_kind).toBe("none");
    expect(row?.def_version).toBe(2);
    expect(row?.status).toBe("live");
    expect(row?.compute_key).toBe(YIELD_SEASONS_COMPUTE);
    const fs = (await import("node:" + "fs")) as { readFileSync(path: URL, encoding: "utf8"): string };
    const sql = fs.readFileSync(new URL("../migrations/0115_dd_season_yields.sql", import.meta.url), "utf8");
    const seed = fs.readFileSync(new URL("../migrations/0105_director_dashboard.sql", import.meta.url), "utf8");
    expect(sql.includes("\r")).toBe(false);
    expect(DASH.test(sql)).toBe(false);
    expect(sql).toContain("Yield per Plant: seasons");
    expect(sql).toContain(YIELD_SEASONS_COMPUTE.replace(/'/g, "''"));
    expect(seed).toContain(ddSeedSql());
    expect(DASH.test(YIELD_SEASONS_COMPUTE)).toBe(false);
  });
});
