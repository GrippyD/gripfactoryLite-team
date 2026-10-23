import { describe, expect, it } from "vitest";
import { formatLbs } from "../src/compliance";
import { format2, GRAMS_PER_LB, round2 } from "../src/config";
import { trimFigures } from "../src/console";
import { directorWallPage, loadDirectorWall } from "../src/director";
import {
  consoleShiftLbPerDlh,
  refreshTrimThroughput,
  trimDryMethod,
  trimThroughputBody,
  trimWindow,
  type TrimThroughputModel,
} from "../src/trimthroughput";
import { migratedDb, seedBatch } from "./migrated";

const DASH = new RegExp("[" + String.fromCharCode(0x2013, 0x2014) + "]");
const NOW = "2026-10-19T18:00:00.000Z";
const WORK = "2026-10-18";
const BARE = "2026-10-17";
const TS = "2026-10-18T16:00:00.000Z";

type Db = Awaited<ReturnType<typeof migratedDb>>;

function pkg(
  m: Db,
  id: string,
  entryId: string,
  grams: number,
  operator: string,
  day: string,
  source: string | null,
  deletedAt: string | null = null
): void {
  m.run(
    `INSERT INTO wip_packages (
       id, wet_weight_entry_id, package_code, package_type_code, weight_grams, status, source,
       trim_date, trim_operator, created_at, updated_at, deleted_at
     ) VALUES (?, ?, ?, 'BUD', ?, 'created', ?, ?, ?, ?, ?, ?)`,
    id,
    entryId,
    id,
    grams,
    source,
    day,
    operator,
    TS,
    TS,
    deletedAt
  );
}

async function floor(): Promise<{ m: Db; model: TrimThroughputModel }> {
  const m = await migratedDb();
  m.run(`UPDATE app_config SET value = '6' WHERE key = 'farm_day_start_hour'`);
  m.run(`UPDATE app_config SET value = 'Olga' WHERE key = 'trim_shift_day_operators'`);
  m.run(`UPDATE app_config SET value = 'Victor' WHERE key = 'trim_shift_second_operators'`);
  const silo = String(m.get(`SELECT id FROM dry_spaces WHERE name = 'Silo 1' AND deleted_at IS NULL`)?.id);
  const hang = String(m.get(`SELECT id FROM dry_spaces WHERE name = 'Hang in Place' AND deleted_at IS NULL`)?.id);
  expect(silo).not.toBe("undefined");
  expect(hang).not.toBe("undefined");
  m.run(`INSERT INTO strains (id, name, hbn_code, created_at, updated_at) VALUES ('st-a', 'Alpha Cake', '901', ?, ?)`, TS, TS);
  m.run(`INSERT INTO strains (id, name, hbn_code, created_at, updated_at) VALUES ('st-b', 'Beta Cake', '902', ?, ?)`, TS, TS);
  m.run(`INSERT INTO strains (id, name, hbn_code, created_at, updated_at) VALUES ('st-r', 'Real Leaf', '903', ?, ?)`, TS, TS);
  seedBatch(m, { id: "b-a", hbn: "26011-PNN-GH-901", serial: 901, farm: "PNN", strainId: "st-a" });
  seedBatch(m, { id: "b-b", hbn: "26012-PNN-GH-902", serial: 902, farm: "PNN", strainId: "st-b" });
  seedBatch(m, { id: "b-r", hbn: "26013-ARL-GH-903", serial: 903, farm: "ARL", strainId: "st-r" });
  m.run(`UPDATE harvest_batches SET market_strain = 'Alpha Cake', customer = 'GreenCo' WHERE id = 'b-a'`);
  m.run(`UPDATE harvest_batches SET market_strain = 'Beta Cake' WHERE id = 'b-b'`);
  m.run(`UPDATE harvest_batches SET market_strain = '' WHERE id = 'b-r'`);
  const entry = (id: string, batch: string, space: string) =>
    m.run(
      `INSERT INTO wet_weight_entries (id, harvest_batch_id, weight_grams, actual_dryspc, status, created_at, updated_at) VALUES (?, ?, 1000, ?, 'trimmed', ?, ?)`,
      id,
      batch,
      space,
      TS,
      TS
    );
  entry("e-a", "b-a", silo);
  entry("e-b", "b-b", hang);
  entry("e-r", "b-r", silo);
  pkg(m, "p-a", "e-a", 4480, "olga", WORK, "trim");
  pkg(m, "p-b", "e-b", 2240, "Olga", WORK, "trim");
  pkg(m, "p-r", "e-r", 448, "Olga", WORK, "trim");
  pkg(m, "p-none", "e-a", 1000, "Nobody", WORK, "trim");
  pkg(m, "p-cryo", "e-a", 5000, "Olga", WORK, "cryo");
  pkg(m, "p-void", "e-a", 9000, "Olga", WORK, "trim", TS);
  pkg(m, "p-night", "e-a", 8960, "Victor", WORK, "trim");
  pkg(m, "p-bare", "e-a", 4480, "Olga", BARE, "trim");
  m.run(
    `INSERT INTO trim_labor_hours (id, work_date, shift, hours, created_at, updated_at) VALUES ('th-day', ?, 'day', 8, ?, ?)`,
    WORK,
    TS,
    TS
  );
  m.run(
    `INSERT INTO trim_labor_hours (id, work_date, shift, hours, created_at, updated_at) VALUES ('th-night', ?, 'second', 4, ?, ?)`,
    WORK,
    TS,
    TS
  );
  const first = await refreshTrimThroughput(m.db, NOW);
  expect(first.written).toBeGreaterThan(0);
  expect(first.year).toBe(2026);
  const rows = m.all(
    `SELECT period_start, dim_key, value, n FROM dd_kpi_values
     WHERE kpi_key = 'bizops.trim_throughput' AND superseded_at IS NULL AND value > 0`
  );
  const model = {
    today: "2026-10-19",
    points: rows
      .filter((row) => !String(row.dim_key).startsWith("hours|"))
      .map((row) => {
        const dim = String(row.dim_key);
        const shift = dim.startsWith("second|") ? "second" : "day";
        const rest = dim.slice(shift.length + 1);
        const method = rest.endsWith("|Hang in Place") ? "Hang in Place" : rest.endsWith("|Dry Room") ? "Dry Room" : rest.endsWith("|Silo") ? "Silo" : "";
        const strain = rest.slice(0, rest.length - method.length - 1);
        return { day: String(row.period_start), shift: shift as "day" | "second", strain, method, lbs: Number(row.value), packages: Number(row.n) };
      }),
    hours: rows
      .filter((row) => String(row.dim_key).startsWith("hours|"))
      .map((row) => ({
        day: String(row.period_start),
        shift: String(row.dim_key).slice("hours|".length) as "day" | "second",
        hours: Number(row.value),
      })),
  };
  return { m, model };
}

describe("Trim Throughput", () => {
  it("names silo, dry room, and hang", () => {
    expect(trimDryMethod("silo", "silo")).toBe("Silo");
    expect(trimDryMethod("dry_room", "silo")).toBe("Dry Room");
    expect(trimDryMethod("dry_room", "hang")).toBe("Hang in Place");
    expect(trimDryMethod("hang", "silo")).toBe("Hang in Place");
  });

  it("All on one day and shift equals the console Lbs/DLH, and weighted is not the mean", async () => {
    const { m, model } = await floor();
    const figures = trimFigures({
      packages: [
        { type_code: "BUD", weight_grams: 4480, trim_operator: "olga" },
        { type_code: "BUD", weight_grams: 2240, trim_operator: "Olga" },
        { type_code: "BUD", weight_grams: 448, trim_operator: "Olga" },
        { type_code: "BUD", weight_grams: 1000, trim_operator: "Nobody" },
        { type_code: "BUD", weight_grams: 8960, trim_operator: "Victor" },
      ],
      budCodes: ["BUD"],
      operators: { day: ["Olga"], second: ["Victor"] },
      hours: { day: 8, second: 4 },
    });
    const dayShift = figures.shifts.find((shift) => shift.key === "day");
    const nightShift = figures.shifts.find((shift) => shift.key === "second");
    expect(dayShift?.grams).toBe(7168);
    expect(nightShift?.grams).toBe(8960);
    const dayRows = m.all(
      `SELECT value FROM dd_kpi_values
       WHERE kpi_key = 'bizops.trim_throughput' AND period_start = ? AND dim_key LIKE 'day|%' AND superseded_at IS NULL AND value > 0`,
      WORK
    );
    const dayLbs = dayRows.reduce((sum, row) => sum + Number(row.value), 0);
    const dayHours = Number(
      m.get(
        `SELECT value FROM dd_kpi_values
         WHERE kpi_key = 'bizops.trim_throughput' AND period_start = ? AND dim_key = 'hours|day' AND superseded_at IS NULL`,
        WORK
      )?.value
    );
    expect(dayHours).toBe(8);
    expect(round2(dayLbs / dayHours)).toBe(consoleShiftLbPerDlh(dayShift?.grams ?? 0, 8));
    expect(format2(round2(dayLbs / dayHours))).toBe(formatLbs(dayShift?.gramsPerDlh ?? 0));
    const nightLbs = Number(
      m.all(
        `SELECT value FROM dd_kpi_values
         WHERE kpi_key = 'bizops.trim_throughput' AND period_start = ? AND dim_key LIKE 'second|%' AND superseded_at IS NULL AND value > 0`,
        WORK
      ).reduce((sum, row) => sum + Number(row.value), 0)
    );
    expect(format2(round2(nightLbs / 4))).toBe(formatLbs(nightShift?.gramsPerDlh ?? 0));
    const view = trimWindow(model, "14", "", "");
    expect(view.shared).toBe(false);
    expect(view.day.ratio).toBe(2);
    expect(view.night.ratio).toBe(5);
    expect(view.weighted.ratio).toBe(3);
    expect(view.weighted.ratio).not.toBe(round2(((view.day.ratio ?? 0) + (view.night.ratio ?? 0)) / 2));
    expect(view.day.missingDays).toBe(1);
    expect(view.day.lbs).toBe(16);
    expect(Math.abs(dayLbs - 7168 / GRAMS_PER_LB)).toBeLessThan(0.001);
    const again = await refreshTrimThroughput(m.db, NOW);
    expect(again.written).toBe(0);
  });

  it("a strain shares hours by pounds and a dry method by its space, and a shift day without hours is left out", async () => {
    const { model } = await floor();
    const all = trimWindow(model, "14", "", "");
    const alpha = trimWindow(model, "14", "Alpha Cake", "");
    expect(alpha.shared).toBe(true);
    expect(alpha.day.ratio).toBe(all.day.ratio);
    expect(alpha.day.hours).toBeCloseTo(8 * (10 / 16), 6);
    expect(alpha.day.hours).not.toBe(all.day.hours);
    expect(alpha.day.missingDays).toBe(1);
    expect(alpha.day.lbs).toBe(10);
    const hang = trimWindow(model, "14", "", "Hang in Place");
    expect(hang.shared).toBe(true);
    expect(hang.day.lbs).toBe(5);
    expect(hang.day.hours).toBeCloseTo(8 * (5 / 16), 6);
    expect(hang.day.ratio).toBe(2);
    expect(hang.night.shiftDays).toBe(0);
    const silo = trimWindow(model, "14", "", "Silo");
    expect(silo.day.lbs).toBe(11);
    expect(silo.day.hours).toBeCloseTo(8 * (11 / 16), 6);
    const real = trimWindow(model, "14", "Real Leaf", "");
    expect(real.day.lbs).toBe(1);
    expect(real.hasOutput).toBe(true);
    const html = trimThroughputBody(model, "en");
    expect(DASH.test(html)).toBe(false);
    expect(html).toContain("Trim TP Days");
    expect(html).toContain("Trim TP Nights");
    expect(html).toContain("Weighted TP");
    expect(html).toContain("Real Leaf");
    expect(html).toContain("Hang in Place");
    const dayAt = html.indexOf('data-dd-tp-box="day"');
    const nightAt = html.indexOf('data-dd-tp-box="second"');
    const dayBox = html.slice(dayAt, nightAt);
    expect(dayBox).toContain("2.00");
    expect(dayBox).toContain("1 shift day without hours");
    expect(dayBox).not.toContain("hours shared by lbs");
    const weightedAt = html.indexOf('data-dd-tp-box="weighted"');
    expect(html.slice(weightedAt, html.indexOf("</div>", weightedAt))).toContain("3.00");
    const es = trimThroughputBody(model, "es");
    expect(DASH.test(es)).toBe(false);
    expect(es).toContain("TP de recorte, dia");
    expect(es).toContain("horas compartidas por libras");
    const esAlpha = trimWindow(model, "14", "Alpha Cake", "");
    expect(esAlpha.shared).toBe(true);
  });

  it("the bizops and farmops walls show the tile and drop Percent finished (plants)", async () => {
    const { m } = await floor();
    const biz = directorWallPage(await loadDirectorWall(m.db, "bizops", "2026-10-19", null, null, NOW), "en");
    const farm = directorWallPage(await loadDirectorWall(m.db, "farmops", "2026-10-19", null, null, NOW), "en");
    expect(biz).toContain('data-dd-kpi="bizops.trim_throughput"');
    expect(biz).toContain(">Trim Throughput<");
    expect(biz).toContain('data-dd-version="1"');
    expect(biz).toContain("2.00");
    expect(biz).not.toContain("Percent finished (plants)");
    expect(biz).not.toContain('data-dd-kpi="harvest.pct_complete"');
    expect(biz).toContain('data-dd-kpi="harvest.trim_lb_per_dlh"');
    expect(farm).not.toContain('data-dd-kpi="bizops.trim_throughput"');
    expect(farm).not.toContain('data-dd-kpi="harvest.btr_pct"');
    expect(farm).not.toContain('data-dd-kpi="harvest.trim_lb_per_dlh"');
    expect(biz).toContain('data-dd-kpi="harvest.btr_pct"');
    expect(farm).not.toContain("Percent finished (plants)");
    const tileAt = biz.indexOf('data-dd-kpi="bizops.trim_throughput"');
    expect(DASH.test(biz.slice(tileAt, biz.indexOf("</article>", tileAt)))).toBe(false);
  });
});
