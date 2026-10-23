import { describe, expect, it } from "vitest";
import { directorHomePage, directorWallPage, loadDirectorHome, loadDirectorWall } from "../src/director";
import {
  HARVEST_PLAN_PATH,
  addHarvestPlan,
  deleteHarvestPlan,
  doneHarvestPlan,
  harvestCutDate,
  harvestPlanPage,
  harvestScheduleBody,
  loadHarvestPlanPage,
  planFootLine,
  updateHarvestPlan,
} from "../src/harvestschedule";
import {
  LABOR_TASKS_PATH,
  addLaborTask,
  closeLaborTask,
  elapsedShare,
  laborState,
  laborTasksBody,
  laborTasksPage,
  loadLaborTasksPage,
  onTrackShare,
  refreshLaborShare,
  saveLaborPercent,
} from "../src/labortasks";
import { formOf, migratedDb, seedBatch, seedPerson } from "./migrated";

const DASH = new RegExp("[" + String.fromCharCode(0x2013, 0x2014) + "]");
const NOW = "2026-10-21T16:00:00.000Z";
const TODAY = "2026-10-21";

function strain(m: Awaited<ReturnType<typeof migratedDb>>, id: string, name: string, code: string): void {
  m.run(`INSERT INTO strains (id, name, hbn_code, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`, id, name, code, NOW, NOW);
}

function reason(extra: Record<string, string> = {}): FormData {
  return formOf({ person_id: "person-1", reason: "Weekly check-in", ...extra });
}

describe("harvest plan", () => {
  it("adds, edits, deletes with a reason, and stamps Done", async () => {
    const m = await migratedDb();
    seedPerson(m);
    strain(m, "plan-gelato", "Plan Gelato", "971");
    const added = await addHarvestPlan(m.db, reason({ strain: "Plan Gelato", farm_code: "PNN", planned_date: "2026-10-22", plants: "120", note: "morning" }), NOW);
    expect(added.redirect).toContain("ok=saved");
    const id = String(m.get(`SELECT id FROM dd_harvest_plan WHERE deleted_at IS NULL`)?.id);
    expect(m.get(`SELECT plants, note, created_by FROM dd_harvest_plan WHERE id = ?`, id)).toMatchObject({
      plants: 120,
      note: "morning",
      created_by: "person-1",
    });
    expect(m.get(`SELECT COUNT(*) AS n FROM record_change_log WHERE record_table = 'dd_harvest_plan' AND record_id = ?`, id)?.n).toBeGreaterThan(0);
    await updateHarvestPlan(m.db, id, reason({ strain: "Plan Gelato", farm_code: "PNS", planned_date: "2026-10-23", plants: "80", note: "moved" }), NOW);
    expect(m.get(`SELECT farm_code, planned_date, plants, note FROM dd_harvest_plan WHERE id = ?`, id)).toMatchObject({
      farm_code: "PNS",
      planned_date: "2026-10-23",
      plants: 80,
      note: "moved",
    });
    const page = harvestPlanPage(await loadHarvestPlanPage(m.db, NOW, false), "en");
    expect(page).toContain('data-dd-plan-id="' + id + '"');
    expect(page).toContain('value="80"');
    await expect(deleteHarvestPlan(m.db, id, formOf({ person_id: "person-1" }), NOW)).rejects.toMatchObject({ status: 400 });
    await deleteHarvestPlan(m.db, id, formOf({ person_id: "person-1", reason: "wrong day" }), NOW);
    expect(m.get(`SELECT delete_reason FROM dd_harvest_plan WHERE id = ?`, id)?.delete_reason).toBe("wrong day");
    expect(m.get(`SELECT deleted_at FROM dd_harvest_plan WHERE id = ?`, id)?.deleted_at).toBe(NOW);
    expect(m.get(`SELECT reason FROM record_change_log WHERE record_id = ? AND field = 'deleted_at'`, id)?.reason).toBe("wrong day");
    expect(harvestPlanPage(await loadHarvestPlanPage(m.db, NOW, true), "en")).not.toContain('data-dd-plan-id="' + id + '"');
    const again = await addHarvestPlan(m.db, reason({ strain: "Plan Gelato", farm_code: "PNN", planned_date: "2026-10-24", plants: "10" }), NOW);
    expect(again.redirect).toContain("ok=saved");
    const live = String(m.get(`SELECT id FROM dd_harvest_plan WHERE deleted_at IS NULL`)?.id);
    await doneHarvestPlan(m.db, live, reason(), NOW);
    expect(m.get(`SELECT done_at FROM dd_harvest_plan WHERE id = ?`, live)?.done_at).toBe(NOW);
    const donePage = harvestPlanPage(await loadHarvestPlanPage(m.db, NOW, false), "en");
    expect(donePage).toContain('data-dd-plan-done="1"');
    expect(DASH.test(donePage)).toBe(false);
  });

  it("reads a row done from a harvest batch on the date and after it, not before, and drops rows done more than 14 days ago", async () => {
    const m = await migratedDb();
    seedPerson(m);
    strain(m, "plan-gelato", "Plan Gelato", "971");
    strain(m, "plan-sherb", "Plan Sherb", "972");
    const add = (date: string, farm: string, name = "Plan Gelato") =>
      addHarvestPlan(m.db, reason({ strain: name, farm_code: farm, planned_date: date, plants: "4" }), NOW);
    await add("2026-10-22", "PNN");
    await add("2026-10-20", "PNN");
    await add("2026-10-22", "PNS");
    await add("2026-10-22", "PNN", "Plan Sherb");
    const idOf = (date: string, farm: string, name: string) =>
      String(m.get(`SELECT id FROM dd_harvest_plan WHERE planned_date = ? AND farm_code = ? AND strain = ? AND deleted_at IS NULL`, date, farm, name)?.id);
    const before = idOf("2026-10-22", "PNN", "Plan Gelato");
    seedBatch(m, { id: "cut-before", hbn: "26293-PNN-GH-971-0-1-26101", serial: 26101, farm: "PNN", strainId: "plan-gelato" });
    m.run(`UPDATE harvest_batches SET entry_date = '2026-10-21', market_strain = 'Plan Gelato' WHERE id = 'cut-before'`);
    let page = await loadHarvestPlanPage(m.db, NOW, false);
    expect(page.rows.find((row) => row.id === before)?.doneOn).toBeNull();
    m.run(`UPDATE harvest_batches SET entry_date = '2026-10-22' WHERE id = 'cut-before'`);
    page = await loadHarvestPlanPage(m.db, NOW, false);
    const onDate = page.rows.find((row) => row.id === before);
    expect(onDate?.doneOn).toBe("2026-10-22");
    expect(onDate?.cut?.hbn).toBe("26293-PNN-GH-971-0-1-26101");
    const html = harvestPlanPage(page, "en");
    expect(html).toContain("cut Oct 22, HBN 26293-PNN-GH-971-0-1-26101");
    expect(page.rows.find((row) => row.id === idOf("2026-10-22", "PNS", "Plan Gelato"))?.doneOn).toBeNull();
    expect(page.rows.find((row) => row.id === idOf("2026-10-22", "PNN", "Plan Sherb"))?.doneOn).toBeNull();
    m.run(`UPDATE harvest_batches SET entry_date = '2026-10-25' WHERE id = 'cut-before'`);
    page = await loadHarvestPlanPage(m.db, NOW, false);
    expect(page.rows.find((row) => row.id === before)?.doneOn).toBe("2026-10-25");
    expect(page.rows.find((row) => row.id === idOf("2026-10-20", "PNN", "Plan Gelato"))?.doneOn).toBe("2026-10-25");
    m.run(`UPDATE harvest_batches SET market_strain = NULL WHERE id = 'cut-before'`);
    m.run(`UPDATE strains SET name = 'Plan Gelato' WHERE id = 'plan-gelato'`);
    page = await loadHarvestPlanPage(m.db, NOW, false);
    expect(page.rows.find((row) => row.id === before)?.cut?.date).toBe("2026-10-25");
    seedBatch(m, { id: "cut-market", hbn: "26296-PNN-GH-972-0-1-26102", serial: 26102, farm: "PNN", strainId: "plan-sherb" });
    m.run(`UPDATE harvest_batches SET entry_date = '2026-10-22', market_strain = 'Plan Gelato' WHERE id = 'cut-market'`);
    m.run(`UPDATE harvest_batches SET deleted_at = ? WHERE id = 'cut-before'`, NOW);
    page = await loadHarvestPlanPage(m.db, NOW, false);
    expect(page.rows.find((row) => row.id === before)?.cut?.hbn).toBe("26296-PNN-GH-972-0-1-26102");
    m.run(`UPDATE harvest_batches SET is_test = 1 WHERE id = 'cut-market'`);
    page = await loadHarvestPlanPage(m.db, NOW, false);
    expect(page.rows.find((row) => row.id === before)?.cut).toBeNull();
    expect(page.rows.find((row) => row.id === before)?.doneOn).toBeNull();
    m.run(`UPDATE harvest_batches SET is_test = 0 WHERE id = 'cut-market'`);
    const hbnDay = harvestCutDate("", "26294-PNN-GH-971-0-1-26103");
    expect(hbnDay && hbnDay >= "2026-01-01").toBe(true);
    expect(harvestCutDate("2026-10-22", "26294-PNN-GH-971-0-1-26103")).toBe("2026-10-22");
    const old = await addHarvestPlan(m.db, reason({ strain: "Plan Sherb", farm_code: "ARL", planned_date: "2026-09-01", plants: "1" }), NOW);
    expect(old.redirect).toContain("ok=saved");
    const oldId = String(m.get(`SELECT id FROM dd_harvest_plan WHERE farm_code = 'ARL' AND deleted_at IS NULL`)?.id);
    await doneHarvestPlan(m.db, oldId, reason(), "2026-10-06T16:00:00.000Z");
    const hidden = harvestPlanPage(await loadHarvestPlanPage(m.db, NOW, false), "en");
    const shown = harvestPlanPage(await loadHarvestPlanPage(m.db, NOW, true), "en");
    expect(hidden).not.toContain('data-dd-plan-id="' + oldId + '"');
    expect(shown).toContain('data-dd-plan-id="' + oldId + '"');
    expect(hidden).toContain("show done");
    await doneHarvestPlan(m.db, idOf("2026-10-22", "PNS", "Plan Gelato"), reason(), "2026-10-07T16:00:00.000Z");
    const kept = harvestPlanPage(await loadHarvestPlanPage(m.db, NOW, false), "en");
    expect(kept).toContain('data-dd-plan-id="' + idOf("2026-10-22", "PNS", "Plan Gelato") + '"');
    expect(DASH.test(shown + kept)).toBe(false);
  });

  it("sorts the tile by planned date, marks overdue, and leaves done rows off the list", async () => {
    const m = await migratedDb();
    seedPerson(m);
    strain(m, "plan-gelato", "Plan Gelato", "971");
    strain(m, "plan-sherb", "Plan Sherb", "972");
    const add = (date: string, farm: string, name: string, plants: string) =>
      addHarvestPlan(m.db, reason({ strain: name, farm_code: farm, planned_date: date, plants }), NOW);
    await add("2026-10-28", "PNN", "Plan Sherb", "40");
    await add("2026-10-19", "ARL", "Plan Sherb", "10");
    await add("2026-10-22", "PNS", "Plan Gelato", "20");
    await add("2026-11-20", "ARL", "Plan Gelato", "5");
    await add("2026-10-18", "PNS", "Plan Gelato", "7");
    const doneId = String(m.get(`SELECT id FROM dd_harvest_plan WHERE planned_date = '2026-10-18'`)?.id);
    await doneHarvestPlan(m.db, doneId, reason(), NOW);
    seedBatch(m, { id: "cut-tile", hbn: "26290-PNN-GH-971-0-1-26109", serial: 26109, farm: "PNN", strainId: "plan-gelato" });
    m.run(`UPDATE harvest_batches SET entry_date = '2026-10-19', market_strain = 'Plan Gelato' WHERE id = 'cut-tile'`);
    const wall = directorWallPage(await loadDirectorWall(m.db, "farmops", TODAY, null, null, NOW), "en");
    const at = wall.indexOf('data-dd-kpi="harvest.harvest_schedule"');
    const tile = wall.slice(at, wall.indexOf("</article>", at));
    const near = tile.slice(tile.indexOf('data-dd-plan-span="21"'), tile.indexOf('data-dd-plan-span="all"'));
    const all = tile.slice(tile.indexOf('data-dd-plan-span="all"'));
    const dates = [...near.matchAll(/data-dd-plan-date="([^"]+)"/g)].map((hit) => hit[1]);
    expect(dates).toEqual(["2026-10-19", "2026-10-22", "2026-10-28"]);
    expect(near).toContain('data-dd-plan-date="2026-10-19" data-dd-plan-strain="Plan Sherb"');
    expect(near).not.toContain("2026-11-20");
    expect(all).toContain("2026-11-20");
    expect(near).toContain('data-dd-plan-overdue="1"');
    expect(near).toContain(">overdue<");
    expect(near).toContain("Thu, Oct 22");
    expect(near).not.toContain("2026-10-18");
    expect(tile).toContain(planFootLine(2, 60, "en"));
    expect(tile).toContain(`href="${HARVEST_PLAN_PATH}"`);
    expect(tile).toContain("Add or update");
    expect(DASH.test(tile)).toBe(false);
    const empty = harvestScheduleBody({ today: TODAY, rows: [] }, "en");
    expect(empty).toContain("No upcoming harvests entered");
    expect(empty).toContain(`href="${HARVEST_PLAN_PATH}"`);
    const home = directorHomePage(await loadDirectorHome(m.db, TODAY, NOW), "en");
    expect(home).toContain('data-dd-checkin="farmops"');
    expect(home).toContain('href="/admin/director/farmops/enter"');
    expect(home).toContain(`href="${HARVEST_PLAN_PATH}"`);
    expect(home).toContain(`href="${LABOR_TASKS_PATH}"`);
    const es = directorHomePage(await loadDirectorHome(m.db, TODAY, NOW), "es");
    expect(es).toContain("Calendario de cosecha");
    expect(es).toContain("chequeo");
    expect(es).not.toContain(">Harvest Schedule<");
  });
});

describe("labor tasks", () => {
  it("adds a task, writes a log for each percent, and closes at 100", async () => {
    const m = await migratedDb();
    seedPerson(m);
    await addLaborTask(m.db, reason({ task: "Defoliate", farm_code: "PNN", started_on: "2026-10-01", expected_on: "2026-10-31" }), NOW);
    const id = String(m.get(`SELECT id FROM dd_labor_tasks WHERE deleted_at IS NULL`)?.id);
    expect(m.get(`SELECT pct_complete, closed_at FROM dd_labor_tasks WHERE id = ?`, id)).toMatchObject({ pct_complete: 0, closed_at: null });
    await saveLaborPercent(m.db, id, reason({ pct_complete: "40", pct_as_of: "2026-10-19" }), "2026-10-19T16:00:00.000Z");
    await saveLaborPercent(m.db, id, reason({ pct_complete: "60", pct_as_of: "2026-10-21" }), NOW);
    const logs = m.all(`SELECT pct_complete, as_of FROM dd_labor_task_log WHERE task_id = ? ORDER BY created_at`, id);
    expect(logs).toEqual([
      { pct_complete: 40, as_of: "2026-10-19" },
      { pct_complete: 60, as_of: "2026-10-21" },
    ]);
    const open = laborTasksPage(await loadLaborTasksPage(m.db, NOW, false), "en");
    expect(open).toContain("60%, as of Oct 21");
    expect(open).toContain("Oct 21, 60%");
    expect(open).toContain("Oct 19, 40%");
    await saveLaborPercent(m.db, id, reason({ pct_complete: "100", pct_as_of: TODAY }), NOW);
    expect(m.get(`SELECT closed_at, pct_complete FROM dd_labor_tasks WHERE id = ?`, id)?.pct_complete).toBe(100);
    expect(m.get(`SELECT closed_at FROM dd_labor_tasks WHERE id = ?`, id)?.closed_at).toBe(NOW);
    const after = await loadLaborTasksPage(m.db, NOW, false);
    expect(after.tasks.filter((task) => !task.closedAt)).toHaveLength(0);
    const closed = laborTasksPage(await loadLaborTasksPage(m.db, NOW, true), "en");
    expect(closed).toContain('data-dd-labor-closed="1"');
    expect(closed).toContain("Open tasks");
    expect(closed).not.toContain("show closed");
    expect(DASH.test(open + closed)).toBe(false);
    await addLaborTask(m.db, reason({ task: "Irrigate", farm_code: "", started_on: "2026-10-01", expected_on: "2026-10-31" }), NOW);
    const other = String(m.get(`SELECT id FROM dd_labor_tasks WHERE task = 'Irrigate'`)?.id);
    await closeLaborTask(m.db, other, reason(), NOW);
    expect(m.get(`SELECT closed_at, pct_complete FROM dd_labor_tasks WHERE id = ?`, other)).toMatchObject({ closed_at: NOW, pct_complete: 0 });
  });

  it("colors the bar at the five points, sorts overdue then behind then on track, and stores the share", async () => {
    const started = "2026-10-01";
    const expected = "2026-10-11";
    const today = "2026-10-06";
    expect(elapsedShare(started, expected, today)).toBe(50);
    expect(laborState(60, started, expected, today)).toBe("track");
    expect(laborState(50, started, expected, today)).toBe("track");
    expect(laborState(45, started, expected, today)).toBe("track");
    expect(laborState(44, started, expected, today)).toBe("behind");
    expect(laborState(90, started, expected, "2026-10-12")).toBe("overdue");
    expect(onTrackShare(1, 2)).toBe(50);
    expect(onTrackShare(0, 0)).toBeNull();
    const m = await migratedDb();
    seedPerson(m);
    const add = (task: string, start: string, due: string) =>
      addLaborTask(m.db, reason({ task, farm_code: "PNN", started_on: start, expected_on: due }), NOW);
    await add("Later", "2026-10-01", "2026-10-31");
    await add("Behind", "2026-10-01", "2026-10-31");
    await add("Late", "2026-10-01", "2026-10-20");
    const idOf = (task: string) => String(m.get(`SELECT id FROM dd_labor_tasks WHERE task = ?`, task)?.id);
    await saveLaborPercent(m.db, idOf("Later"), reason({ pct_complete: "80", pct_as_of: "2026-10-20" }), "2026-10-20T16:00:00.000Z");
    await saveLaborPercent(m.db, idOf("Behind"), reason({ pct_complete: "10", pct_as_of: TODAY }), NOW);
    await saveLaborPercent(m.db, idOf("Late"), reason({ pct_complete: "40", pct_as_of: TODAY }), NOW);
    for (let i = 0; i < 5; i += 1) {
      await saveLaborPercent(m.db, idOf("Later"), reason({ pct_complete: String(90 + i), pct_as_of: TODAY }), `2026-10-21T17:0${i}:00.000Z`);
    }
    const wall = directorWallPage(await loadDirectorWall(m.db, "farmops", TODAY, null, null, NOW), "en");
    const at = wall.indexOf('data-dd-kpi="farmops.labor_tasks_done_pct"');
    const tile = wall.slice(at, wall.indexOf("</article>", at));
    const states = [...tile.matchAll(/data-dd-task-state="([^"]+)"/g)].map((hit) => hit[1]);
    const names = [...tile.matchAll(/class="dd-task-name">([^<]+)</g)].map((hit) => hit[1]);
    expect(states).toEqual(["overdue", "behind", "track"]);
    expect(names).toEqual(["Late", "Behind", "Later"]);
    expect(tile).toContain("1 of 3 on track");
    expect(tile).toContain("94%, as of Oct 21");
    const later = tile.slice(tile.indexOf(">Later<"));
    const history = [...later.matchAll(/data-dd-task-log>([^<]+)</g)].map((hit) => hit[1]);
    expect(history).toHaveLength(5);
    expect(history[0]).toContain("94%");
    expect(history.join(" ")).not.toContain("80%");
    expect(tile).toContain(`href="${LABOR_TASKS_PATH}"`);
    expect(DASH.test(tile)).toBe(false);
    const first = await refreshLaborShare(m.db, NOW);
    expect(first.value).toBe(onTrackShare(1, 3));
    expect(m.get(`SELECT value, dim_key, period_kind, period_start FROM dd_kpi_values WHERE kpi_key = 'farmops.labor_tasks_done_pct' AND superseded_at IS NULL`)).toMatchObject({
      value: first.value,
      dim_key: "all",
      period_kind: "day",
      period_start: TODAY,
    });
    const same = await refreshLaborShare(m.db, NOW);
    expect(same.written).toBe(0);
    await closeLaborTask(m.db, idOf("Late"), reason(), NOW);
    await closeLaborTask(m.db, idOf("Behind"), reason(), NOW);
    const left = await refreshLaborShare(m.db, NOW);
    expect(left.value).toBe(100);
    await closeLaborTask(m.db, idOf("Later"), reason(), NOW);
    const none = await refreshLaborShare(m.db, NOW);
    expect(none.value).toBeNull();
    expect(m.get(`SELECT COUNT(*) AS n FROM dd_kpi_values WHERE kpi_key = 'farmops.labor_tasks_done_pct' AND superseded_at IS NULL`)?.n).toBe(0);
    const empty = laborTasksBody({ today: TODAY, tasks: [] }, "en");
    expect(empty).toContain("No budgeted tasks entered");
    expect(empty).toContain(`href="${LABOR_TASKS_PATH}"`);
  });
});
