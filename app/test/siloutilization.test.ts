import { describe, expect, it } from "vitest";
import { directorWallPage, loadDirectorWall } from "../src/director";
import { refreshSiloUtilization } from "../src/ddsnapshot";
import { themeStylesheet } from "../src/theme";
import {
  isCountedSilo,
  SILO_LOADS_SQL,
  siloBarHeight,
  siloDetail,
  siloLoadOverlapsDay,
  siloPhoneDays,
  siloUtilizationBody,
  type SiloDayPoint,
  type SiloUtilizationModel,
} from "../src/siloutilization";
import { migratedDb, seedBatch } from "./migrated";

const DASH = new RegExp("[" + String.fromCharCode(0x2013, 0x2014) + "]");
const NOW = "2026-10-16T18:00:00.000Z";
const TODAY = "2026-10-16";
const TS = "2026-10-13T15:00:00.000Z";

type Db = Awaited<ReturnType<typeof migratedDb>>;

function load(
  m: Db,
  id: string,
  spaceId: string,
  entryId: string,
  loadedAt: string,
  endedAt: string | null,
  deletedAt: string | null = null
): void {
  m.run(
    `INSERT INTO silo_loads (
       id, dry_space_id, wet_weight_entry_id, loaded_at, ended_at, paused_seconds, created_at, updated_at, deleted_at
     ) VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?)`,
    id,
    spaceId,
    entryId,
    loadedAt,
    endedAt,
    TS,
    TS,
    deletedAt
  );
}

async function floor(): Promise<Db> {
  const m = await migratedDb();
  m.run(`UPDATE app_config SET value = '6' WHERE key = 'farm_day_start_hour'`);
  m.run(`INSERT INTO strains (id, name, hbn_code, created_at, updated_at) VALUES ('su-a', 'Alpha Cake', '931', ?, ?)`, TS, TS);
  m.run(`INSERT INTO strains (id, name, hbn_code, created_at, updated_at) VALUES ('su-b', 'Beta Cake', '932', ?, ?)`, TS, TS);
  m.run(`INSERT INTO strains (id, name, hbn_code, created_at, updated_at) VALUES ('su-c', 'Gamma Cake', '933', ?, ?)`, TS, TS);
  seedBatch(m, { id: "su-ba", hbn: "26286-PNN-OD-931-0-1-26021", serial: 931, farm: "PNN", strainId: "su-a" });
  seedBatch(m, { id: "su-bb", hbn: "26287-PNN-OD-932-0-2-26022", serial: 932, farm: "PNN", strainId: "su-b" });
  seedBatch(m, { id: "su-bc", hbn: "26289-PNN-OD-933-0-3-26023", serial: 933, farm: "PNN", strainId: "su-c" });
  m.run(`UPDATE harvest_batches SET market_strain = 'Alpha Cake' WHERE id = 'su-ba'`);
  m.run(`UPDATE harvest_batches SET market_strain = 'Beta Cake' WHERE id = 'su-bb'`);
  m.run(`UPDATE harvest_batches SET market_strain = NULL WHERE id = 'su-bc'`);
  const space = (name: string) => String(m.get(`SELECT id FROM dry_spaces WHERE name = ? AND deleted_at IS NULL`, name)?.id);
  const silo1 = space("Silo 1");
  const silo2 = space("Silo 2");
  const silo3 = space("Silo 3");
  const arlington = space("Arlington Dry Room");
  const freezer = space("Blast Freezer(s)");
  const truck = space("Truck");
  expect(silo1).not.toBe("undefined");
  const entry = (id: string, batch: string, grams: number, spaceId: string) =>
    m.run(
      `INSERT INTO wet_weight_entries (id, harvest_batch_id, weight_grams, actual_dryspc, status, created_at, updated_at) VALUES (?, ?, ?, ?, 'trimmed', ?, ?)`,
      id,
      batch,
      grams,
      spaceId,
      TS,
      TS
    );
  entry("su-e1", "su-ba", 4480, silo1);
  entry("su-e2", "su-bb", 2240, silo2);
  entry("su-e3", "su-bc", 8960, silo3);
  entry("su-e3x", "su-bc", 9000, silo3);
  entry("su-earl", "su-ba", 5000, arlington);
  entry("su-efz", "su-ba", 5000, freezer);
  entry("su-etr", "su-ba", 5000, truck);
  // Ends at 10 AM farm time on Oct 14: counts the 14th, not the 15th.
  load(m, "su-l1", silo1, "su-e1", "2026-10-13T15:00:00.000Z", "2026-10-14T14:00:00.000Z");
  // Loaded at 11 PM farm time on Oct 14, ended at 1 AM, still that farm day.
  load(m, "su-l2", silo2, "su-e2", "2026-10-15T03:00:00.000Z", "2026-10-15T05:00:00.000Z");
  load(m, "su-l3x", silo3, "su-e3x", "2026-10-13T15:00:00.000Z", null, TS);
  load(m, "su-l3", silo3, "su-e3", "2026-10-16T16:00:00.000Z", null);
  load(m, "su-larl", arlington, "su-earl", "2026-10-13T15:00:00.000Z", null);
  load(m, "su-lfz", freezer, "su-efz", "2026-10-13T15:00:00.000Z", null);
  load(m, "su-ltr", truck, "su-etr", "2026-10-13T15:00:00.000Z", null);
  return m;
}

function rows(m: Db, day: string): { dim: string; value: number }[] {
  return m
    .all(
      `SELECT dim_key AS dim, value FROM dd_kpi_values
       WHERE kpi_key = 'harvest.dry_space_utilization_pct' AND period_start = ? AND superseded_at IS NULL
       ORDER BY dim_key`,
      day
    )
    .map((row) => ({ dim: String(row.dim), value: Number(row.value) }));
}

describe("Silo Utilization", () => {
  it("counts a silo on the farm day a load covers, and skips a deleted load and the other spaces", async () => {
    const m = await floor();
    const arlington = m.get(`SELECT kind, space_type FROM dry_spaces WHERE name = 'Arlington Dry Room'`);
    expect(arlington).toMatchObject({ kind: "silo", space_type: "dry_room" });
    expect(isCountedSilo({ name: "Arlington Dry Room", kind: "silo", spaceType: "dry_room" })).toBe(false);
    expect(isCountedSilo({ name: "Blast Freezer(s)", kind: "silo", spaceType: "freezer" })).toBe(false);
    expect(isCountedSilo({ name: "Truck", kind: "truck", spaceType: "silo" })).toBe(false);
    expect(isCountedSilo({ name: "Silo 1", kind: "silo", spaceType: "silo" })).toBe(true);
    expect(siloLoadOverlapsDay("2026-10-14T14:00:00.000Z", "2026-10-14T14:00:00.000Z", "2026-10-14", 6)).toBe(true);
    expect(siloLoadOverlapsDay("2026-10-13T15:00:00.000Z", "2026-10-14T14:00:00.000Z", "2026-10-15", 6)).toBe(false);
    expect(siloLoadOverlapsDay("2026-10-15T03:00:00.000Z", "2026-10-15T05:00:00.000Z", "2026-10-14", 6)).toBe(true);
    expect(siloLoadOverlapsDay("2026-10-15T03:00:00.000Z", "2026-10-15T05:00:00.000Z", "2026-10-15", 6)).toBe(false);
    const first = await refreshSiloUtilization(m.db, NOW);
    expect(first.year).toBe(2026);
    expect(first.days).toBe(4);
    expect(first.written).toBe(4 * 6);
    const day13 = rows(m, "2026-10-13");
    const day14 = rows(m, "2026-10-14");
    const day15 = rows(m, "2026-10-15");
    const day16 = rows(m, "2026-10-16");
    expect(day13).toEqual([
      { dim: "all", value: 1 },
      { dim: "silo|Silo 1", value: 1 },
      { dim: "silo|Silo 2", value: 0 },
      { dim: "silo|Silo 3", value: 0 },
      { dim: "silo|Silo 4", value: 0 },
      { dim: "silo|Silo 5", value: 0 },
    ]);
    expect(day14).toEqual([
      { dim: "all", value: 2 },
      { dim: "silo|Silo 1", value: 1 },
      { dim: "silo|Silo 2", value: 1 },
      { dim: "silo|Silo 3", value: 0 },
      { dim: "silo|Silo 4", value: 0 },
      { dim: "silo|Silo 5", value: 0 },
    ]);
    for (const day of [day15, day13]) {
      const sum = day.filter((row) => row.dim.startsWith("silo|")).reduce((n, row) => n + row.value, 0);
      expect(day.find((row) => row.dim === "all")?.value).toBe(sum);
    }
    expect(day15.every((row) => row.value === 0)).toBe(true);
    expect(day15).toHaveLength(6);
    expect(day16.find((row) => row.dim === "silo|Silo 3")?.value).toBe(1);
    expect(day16.find((row) => row.dim === "all")?.value).toBe(1);
    const again = await refreshSiloUtilization(m.db, NOW);
    expect(again.written).toBe(0);
    expect(m.get(`SELECT COUNT(*) AS n FROM dd_kpi_values WHERE kpi_key = 'harvest.dry_space_utilization_pct' AND superseded_at IS NULL`)?.n).toBe(24);
  });

  it("draws the bars, the What ran rows, the drying link, and the phone toggle", async () => {
    const m = await floor();
    await refreshSiloUtilization(m.db, NOW);
    const html = directorWallPage(await loadDirectorWall(m.db, "farmops", TODAY, null, null, NOW), "en");
    expect(DASH.test(html)).toBe(false);
    const at = html.indexOf('data-dd-kpi="harvest.dry_space_utilization_pct"');
    const tile = html.slice(at, html.indexOf("</article>", at));
    expect(tile).toContain(">Silo Utilization<");
    expect(tile).toContain('data-dd-version="2"');
    expect(tile).toContain("Silos with material in them, each day of the harvest");
    expect(tile).toContain('href="/ops/drying_ops"');
    expect(tile).toContain(">Drying Operations<");
    expect(tile).toContain('data-dd-silo-whole');
    expect(tile).toContain('data-dd-silo-span="30"');
    expect(tile).toContain('data-dd-silo-span="all"');
    expect(tile).toContain('data-dd-silo-day="2026-10-13"');
    expect(tile).toContain('data-dd-silo-count="1"');
    expect(tile).toContain(`data-dd-silo-height="${siloBarHeight(1)}"`);
    expect(tile).toContain('data-dd-silo-day="2026-10-14"');
    expect(tile).toContain('data-dd-silo-count="2"');
    expect(tile).toContain(`data-dd-silo-height="${siloBarHeight(2)}"`);
    expect(tile).toContain('data-dd-silo-day="2026-10-15"');
    expect(tile).toContain('data-dd-silo-count="0"');
    expect(tile).toContain("2026-10-14. 2. Silo 1, Silo 2");
    expect(tile).not.toContain("Arlington Dry Room");
    expect(tile).not.toContain("Blast Freezer");
    expect(tile).not.toContain(">Truck<");
    const silo1 = tile.slice(tile.indexOf('data-dd-silo-silo="Silo 1"'), tile.indexOf('data-dd-silo-silo="Silo 2"'));
    expect(silo1).toContain("2026-10-13");
    expect(silo1).toContain("2026-10-14");
    expect(silo1).toContain("26021");
    expect(silo1).toContain("Alpha Cake");
    expect(silo1).toContain("10.00");
    const silo3 = tile.slice(tile.indexOf('data-dd-silo-silo="Silo 3"'), tile.indexOf('data-dd-silo-silo="Silo 4"'));
    expect(silo3).toContain("still in");
    expect(silo3).toContain("26023");
    expect(silo3).toContain("Gamma Cake");
    expect(silo3).toContain("20.00");
    expect(silo3).not.toContain("9000");
    const days: SiloDayPoint[] = Array.from({ length: 40 }, (_, i) => {
      const day = new Date(Date.UTC(2026, 8, 1 + i)).toISOString().slice(0, 10);
      return { day, count: i % 6, active: i % 2 === 0 ? ["Silo 1"] : [] };
    });
    const model: SiloUtilizationModel = {
      today: days[39]?.day ?? TODAY,
      days,
      ran: [],
    };
    const chart = siloUtilizationBody(model, "en");
    const recentAt = chart.indexOf('data-dd-silo-span="30"');
    const allAt = chart.indexOf('data-dd-silo-span="all"');
    const recent = chart.slice(recentAt, allAt);
    const whole = chart.slice(allAt, chart.indexOf("data-dd-silo-tip"));
    expect(recent.match(/data-dd-silo-day="/g)).toHaveLength(30);
    expect(whole.match(/data-dd-silo-day="/g)).toHaveLength(40);
    expect(siloPhoneDays(days)).toHaveLength(30);
    expect(chart).toContain('data-dd-silo-whole');
    expect(chart).toContain('removeAttribute("open")');
    expect(chart).toContain("device-phone");
    const monday = days.find((point) => new Date(`${point.day}T00:00:00.000Z`).getUTCDay() === 1);
    const tuesday = days.find((point) => new Date(`${point.day}T00:00:00.000Z`).getUTCDay() === 2);
    expect(monday).toBeTruthy();
    expect(chart).toContain(`data-dd-silo-monday="${monday?.day}"`);
    expect(chart).not.toContain(`data-dd-silo-monday="${tuesday?.day}"`);
    const detail = siloDetail({ day: "2026-10-14", count: 2, active: ["Silo 1", "Silo 2"] }, "en");
    expect(detail).toContain("2026-10-14");
    expect(detail).toContain("2");
    expect(detail).toContain("Silo 1, Silo 2");
    expect(DASH.test(detail)).toBe(false);
    for (const view of ["lite", "co", "cerberus"] as const) {
      const css = themeStylesheet(view);
      expect(css).toContain("body.device-phone .dd-silo-span-all");
      expect(css).toContain("data-dd-silo-whole");
      expect(DASH.test(css)).toBe(false);
    }
  });

  it("shows the Field Task Productivity empty line until a task row exists", async () => {
    const m = await floor();
    const empty = directorWallPage(await loadDirectorWall(m.db, "farmops", TODAY, null, null, NOW), "en");
    const at = empty.indexOf('data-dd-kpi="farmops.task_units_per_dlh"');
    const tile = empty.slice(at, empty.indexOf("</article>", at));
    expect(tile).toContain("No task data yet. Harvest, trim, pasteurization and prepack rates read from the console once their hours are typed; other tasks arrive with the labor task form.");
    expect(tile).toContain("data-dd-task-empty");
    expect(tile).not.toContain("data-dd-value");
    expect(tile).not.toContain("data-dd-spark");
    expect(DASH.test(tile)).toBe(false);
    const dailyAt = empty.indexOf('data-dd-group="daily"');
    const weeklyAt = empty.indexOf('data-dd-group="weekly"');
    const dailyKeys = [...empty.slice(dailyAt, weeklyAt).matchAll(/data-dd-kpi="([^"]+)"/g)].map((hit) => hit[1]);
    expect(dailyKeys[dailyKeys.length - 1]).toBe("farmops.task_units_per_dlh");
    m.run(
      `INSERT INTO dd_kpi_values (
         id, kpi_key, period_kind, period_start, dim_key, value, n, source, computed_at, def_version, created_at
       ) VALUES ('su-task', 'farmops.task_units_per_dlh', 'day', ?, '', 3.5, 1, 'hand', ?, 1, ?)`,
      TODAY,
      NOW,
      NOW
    );
    const filled = directorWallPage(await loadDirectorWall(m.db, "farmops", TODAY, null, null, NOW), "en");
    const againAt = filled.indexOf('data-dd-kpi="farmops.task_units_per_dlh"');
    const again = filled.slice(againAt, filled.indexOf("</article>", againAt));
    expect(again).not.toContain("data-dd-task-empty");
    expect(again).toContain("data-dd-value");
    expect(again).toContain("3.50");
  });

  it("omits a test batch from the count and from What ran, and still counts a real load beside it", async () => {
    expect(SILO_LOADS_SQL).toContain("is_test");
    expect(SILO_LOADS_SQL).toContain("COALESCE(b.is_test, 0) = 0");
    const m = await floor();
    m.run(`UPDATE harvest_batches SET is_test = 1 WHERE id = 'su-ba'`);
    await refreshSiloUtilization(m.db, NOW);
    const day13 = rows(m, "2026-10-13").find((row) => row.dim === "all")?.value ?? 0;
    const day14 = rows(m, "2026-10-14");
    expect(day13).toBe(0);
    expect(day14.find((row) => row.dim === "all")?.value).toBe(1);
    expect(day14.find((row) => row.dim === "silo|Silo 2")?.value).toBe(1);
    expect(day14.find((row) => row.dim === "silo|Silo 1")?.value ?? 0).toBe(0);
    const html = directorWallPage(await loadDirectorWall(m.db, "farmops", TODAY, null, null, NOW), "en");
    const at = html.indexOf('data-dd-kpi="harvest.dry_space_utilization_pct"');
    const tile = html.slice(at, html.indexOf("</article>", at));
    const silo1 = tile.slice(tile.indexOf('data-dd-silo-silo="Silo 1"'), tile.indexOf('data-dd-silo-silo="Silo 2"'));
    const silo2 = tile.slice(tile.indexOf('data-dd-silo-silo="Silo 2"'), tile.indexOf('data-dd-silo-silo="Silo 3"'));
    expect(silo1).not.toContain("Alpha Cake");
    expect(silo1).not.toContain("26021");
    expect(silo2).toContain("Beta Cake");
    expect(DASH.test(tile)).toBe(false);
  });
});
