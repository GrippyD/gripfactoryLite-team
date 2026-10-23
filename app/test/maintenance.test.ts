import { describe, expect, it } from "vitest";
import { ASSETS_FOR_SALE_COMPUTE } from "../src/directorregistry";
import { directorHomePage, directorWallPage, loadDirectorHome, loadDirectorWall } from "../src/director";
import {
  ASSET_FOR_SALE_REASON,
  countAssetsForSale,
  equipmentHomePage,
  listEquipmentAssets,
  saveEquipmentForSale,
} from "../src/equipment";
import { projectElapsed } from "../src/maintenance";
import {
  addProject,
  loadMaintenancePage,
  loadProjectsPage,
  MAINTENANCE_PATH,
  maintenancePage,
  PROJECTS_PATH,
  projectsPage,
  updateProject,
} from "../src/maintenance";
import { formOf, migratedDb, seedPerson } from "./migrated";

const DASH = new RegExp("[" + String.fromCharCode(0x2013, 0x2014) + "]");
const NOW = "2026-10-21T16:00:00.000Z";
const TODAY = "2026-10-21";
const A1 = "b3000001-0001-4000-8000-000000000001";
const A2 = "b3000001-0001-4000-8000-000000000002";
const A3 = "b3000001-0001-4000-8000-000000000003";

function reason(extra: Record<string, string> = {}): FormData {
  return formOf({ person_id: "person-1", reason: "project entered", ...extra });
}

describe("projects form", () => {
  it("adds, edits, hides done until show done, and draws the elapsed bar", async () => {
    const m = await migratedDb();
    seedPerson(m);
    expect(projectElapsed("2026-10-11", "2026-10-31", TODAY)).toBe(50);
    expect(projectElapsed("2026-10-25", "2026-10-31", TODAY)).toBe(0);
    expect(projectElapsed("2026-10-01", "2026-10-10", TODAY)).toBe(100);
    expect(projectElapsed(TODAY, TODAY, TODAY)).toBe(100);
    await expect(addProject(m.db, formOf({ person_id: "person-1" }), NOW)).rejects.toMatchObject({ status: 400 });
    const added = await addProject(
      m.db,
      reason({
        name: "Roof fans",
        owner_name: "crew lead",
        farm_code: "PNN",
        status: "active",
        started_on: "2026-10-11",
        expected_on: "2026-10-31",
        budget_usd: "1000",
      }),
      NOW
    );
    expect(added.redirect).toContain(`${PROJECTS_PATH}?ok=saved`);
    const id = String(m.get(`SELECT id FROM dd_projects WHERE deleted_at IS NULL`)?.id);
    expect(m.get(`SELECT name, owner_name, budget_usd, status, created_by FROM dd_projects WHERE id = ?`, id)).toMatchObject({
      name: "Roof fans",
      owner_name: "crew lead",
      budget_usd: 1000,
      status: "active",
      created_by: "person-1",
    });
    const open = projectsPage(await loadProjectsPage(m.db, NOW, false), "en");
    expect(open).toContain('data-dd-project-share="50"');
    expect(open).toContain('style="width:50%"');
    expect(open).not.toContain("data-dd-project-cost");
    expect(DASH.test(open)).toBe(false);
    const edited = await updateProject(
      m.db,
      id,
      formOf({
        person_id: "person-1",
        reason: "project updated",
        status: "active",
        expected_on: "2026-10-31",
        cost_to_date_usd: "400",
        note: "west bay",
      }),
      NOW
    );
    expect(edited.redirect).toContain("ok=saved");
    expect(m.get(`SELECT cost_to_date_usd, note FROM dd_projects WHERE id = ?`, id)).toMatchObject({ cost_to_date_usd: 400, note: "west bay" });
    expect(m.get(`SELECT reason FROM record_change_log WHERE record_id = ? AND field = 'cost_to_date_usd'`, id)?.reason).toBe("project updated");
    const withCost = projectsPage(await loadProjectsPage(m.db, NOW, false), "en");
    expect(withCost).toContain("$400 of $1,000");
    expect(withCost).toContain("west bay");
    const tab = maintenancePage(await loadMaintenancePage(m.db, NOW), "en");
    expect(tab).toContain('data-dd-maint-projects');
    expect(tab).toContain('data-dd-project-share="50"');
    expect(tab).toContain("$400 of $1,000");
    expect(DASH.test(tab)).toBe(false);
    await updateProject(
      m.db,
      id,
      formOf({ person_id: "person-1", reason: "project updated", status: "done", expected_on: "2026-10-31", cost_to_date_usd: "400", note: "west bay" }),
      NOW
    );
    const hidden = projectsPage(await loadProjectsPage(m.db, NOW, false), "en");
    expect(hidden).toContain('data-dd-projects-show-done');
    expect(hidden).not.toContain(`data-dd-project-id="${id}"`);
    const shown = projectsPage(await loadProjectsPage(m.db, NOW, true), "en");
    expect(shown).toContain('data-dd-projects-show-done="1"');
    expect(shown).toContain(`data-dd-project-id="${id}"`);
    expect(shown).toContain('data-dd-project-status="done"');
    const quiet = maintenancePage(await loadMaintenancePage(m.db, NOW), "en");
    expect(quiet).toContain("No projects entered");
    expect(quiet).toContain(`href="${PROJECTS_PATH}"`);
    expect(quiet).not.toContain("Roof fans");
  });
});

describe("equipment for sale", () => {
  it("saves, logs the reason, marks the list, and the registry row reads the count", async () => {
    const m = await migratedDb();
    seedPerson(m);
    const row = m.get(`SELECT compute_key, status, def_version FROM dd_kpis WHERE kpi_key = 'farmops.assets_for_sale_count'`);
    expect(row).toMatchObject({ compute_key: ASSETS_FOR_SALE_COMPUTE, status: "live", def_version: 2 });
    expect(await countAssetsForSale(m.db)).toBe(0);
    const saved = await saveEquipmentForSale(
      m.db,
      A1,
      formOf({ person_id: "person-1", sale_status: "listed", sale_condition: "used", asking_price_usd: "500", sale_note: "ready" })
    );
    expect(saved.redirect).toContain("ok=sale");
    expect(m.get(`SELECT sale_status, sale_condition, asking_price_usd, sale_note FROM equipment_assets WHERE id = ?`, A1)).toMatchObject({
      sale_status: "listed",
      sale_condition: "used",
      asking_price_usd: 500,
      sale_note: "ready",
    });
    const reasons = m.all(`SELECT reason, field FROM record_change_log WHERE record_table = 'equipment_assets' AND record_id = ?`, A1);
    expect(reasons.length).toBeGreaterThan(0);
    expect(reasons.every((line) => line.reason === ASSET_FOR_SALE_REASON)).toBe(true);
    expect(reasons.map((line) => line.field)).toContain("sale_status");
    const home = equipmentHomePage(await listEquipmentAssets(m.db), [], TODAY);
    expect(home).toContain('data-eq-sale="listed"');
    expect(home).toContain(">listed<");
    expect(DASH.test(home)).toBe(false);
    expect(await countAssetsForSale(m.db)).toBe(1);
    await saveEquipmentForSale(m.db, A2, formOf({ person_id: "person-1", sale_status: "under_offer", asking_price_usd: "200" }));
    await saveEquipmentForSale(m.db, A3, formOf({ person_id: "person-1", sale_status: "sold", asking_price_usd: "50" }));
    expect(await countAssetsForSale(m.db)).toBe(2);
    const wall = directorWallPage(await loadDirectorWall(m.db, "farmops", TODAY, null, null, NOW), "en");
    const at = wall.indexOf('data-dd-kpi="farmops.assets_for_sale_count"');
    expect(at).toBeGreaterThanOrEqual(0);
    const tile = wall.slice(at, wall.indexOf("</article>", at));
    expect(tile).toContain('data-dd-forsale="2"');
    expect(tile).toContain('<span class="dd-tile-value">2</span> assets listed or under offer');
    expect(tile).toContain(`href="${MAINTENANCE_PATH}"`);
    expect(tile).not.toContain("No data yet");
    const before = m.get(`SELECT COUNT(*) AS n FROM record_change_log`)?.n;
    await saveEquipmentForSale(m.db, A1, formOf({ person_id: "person-1", sale_status: "listed", sale_condition: "used", asking_price_usd: "500", sale_note: "ready" }));
    expect(m.get(`SELECT COUNT(*) AS n FROM record_change_log`)?.n).toBe(before);
  });
});

describe("maintenance tab", () => {
  it("lists upcoming work, the eight week counts, an empty budget, and equipment for sale", async () => {
    const m = await migratedDb();
    seedPerson(m);
    m.run(`UPDATE equipment_pm_schedules SET deleted_at = ? WHERE deleted_at IS NULL`, NOW);
    m.run(`UPDATE equipment_tickets SET deleted_at = ? WHERE deleted_at IS NULL`, NOW);
    const schedule = (id: string, asset: string, task: string, interval: number, lastDone: string) => {
      m.run(
        `INSERT INTO equipment_pm_schedules (id, asset_id, task, interval_days, last_done, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        id,
        asset,
        task,
        interval,
        lastDone,
        NOW,
        NOW
      );
    };
    schedule("pm-late", A1, "belt check", 30, "2026-09-01");
    schedule("pm-now", A2, "filter wash", 14, "2026-10-07");
    schedule("pm-next", A3, "blade look", 7, "2026-10-26");
    m.run(
      `INSERT INTO equipment_tickets (id, asset_id, title, status, created_at, updated_at) VALUES ('tk-old', ?, 'belt noise', 'open', '2026-10-18T15:00:00.000Z', ?)`,
      A1,
      NOW
    );
    m.run(
      `INSERT INTO equipment_tickets (id, asset_id, title, status, created_at, updated_at) VALUES ('tk-new', ?, 'filter clog', 'open', '2026-10-21T15:00:00.000Z', ?)`,
      A2,
      NOW
    );
    await saveEquipmentForSale(m.db, A1, formOf({ person_id: "person-1", sale_status: "listed", sale_condition: "used", asking_price_usd: "500" }));
    const page = maintenancePage(await loadMaintenancePage(m.db, NOW), "en");
    const dues = [...page.matchAll(/data-dd-pm-due="([^"]+)" data-dd-pm-overdue="([^"]+)"/g)].map((hit) => `${hit[1]}:${hit[2]}`);
    expect(dues).toEqual(["2026-10-01:1", "2026-10-21:0", "2026-11-02:0"]);
    expect(page).toContain("belt check");
    expect(page).toContain("every 30 days");
    expect(page).toContain('class="dd-maint-row dd-maint-overdue" data-dd-pm data-dd-pm-due="2026-10-01"');
    const ages = [...page.matchAll(/data-dd-ticket-age="([^"]+)"/g)].map((hit) => hit[1]);
    expect(ages).toEqual(["3", "0"]);
    expect(page).toContain("belt noise");
    expect(page).toContain("filter clog");
    const bars = [...page.matchAll(/data-dd-forecast-week="([^"]+)" data-dd-forecast-count="([^"]+)"/g)].map((hit) => `${hit[1]}:${hit[2]}`);
    expect(bars).toEqual([
      "overdue:1",
      "2026-10-19:1",
      "2026-10-26:0",
      "2026-11-02:1",
      "2026-11-09:0",
      "2026-11-16:0",
      "2026-11-23:0",
      "2026-11-30:0",
      "2026-12-07:0",
    ]);
    expect(page).toContain("Maintenance budget: not in GRIPCasting yet");
    expect(page).toContain('data-dd-sale-status="listed"');
    expect(page).toContain("GF-EQ-0001");
    expect(page).toContain("used");
    expect(page).toContain("$500");
    expect(page).toContain('data-dd-for-sale-count="1"');
    expect(page).not.toContain("Nothing listed for sale");
    expect(DASH.test(page)).toBe(false);
    const emptySale = maintenancePage(
      { ...(await loadMaintenancePage(m.db, NOW)), sales: [], forSaleCount: 0 },
      "en"
    );
    expect(emptySale).toContain("Nothing listed for sale");
  });

  it("reads the maintenance budget from a GRIPCasting fixture and says so when there is none", async () => {
    const bare = await migratedDb();
    const none = maintenancePage(await loadMaintenancePage(bare.db, NOW), "en");
    expect(none).toContain("Maintenance budget: not in GRIPCasting yet");
    expect(none).not.toContain("spent of");
    const m = await migratedDb();
    const vol = JSON.stringify({
      plants: 1, wetPerPlant: 1, dryDown: 0.2, ffWet: 0, shrink: 0, btr: 0.4,
      prepackPct: 0, prepackPrice: 1, bulkPrice: 1,
      lbsPerLiter: 1, carts: 0, gPerCart: 1, cartPrice: 1, literPrice: 1,
      resinYield: 0, resinSplit: 0, resinPrice: 1,
      premLbs: 0, premPrice: 1, premOn: false,
      ghLbs: 0, ghPrice: 1, ghOn: false,
      iprUnits: 0, iprPrice: 1, iprOn: false,
      ibLbs: 0, ibPrice: 1, ibOn: false,
      tps: 0, tpsOn: false,
    });
    m.run(
      `INSERT INTO gc_harvests (id, code, starts_on, is_current, wages_budget, season, vol_default, created_at, created_by)
       VALUES ('h-maint', '2026H', '2026-04-01', 1, NULL, '{}', ?, ?, 'test')`,
      vol,
      NOW
    );
    m.run(
      `INSERT INTO gc_business_units (id, harvest_id, code, name, sort, created_at, created_by)
       VALUES ('bu-11', 'h-maint', '11', '11 Indirect Grow / Maintenance', 11, ?, 'test')`,
      NOW
    );
    m.run(
      `INSERT INTO gc_gl_accounts (id, harvest_id, name, created_at, created_by) VALUES
       ('gl-5320', 'h-maint', '5320 Small tools', ?, 'test'),
       ('gl-5120', 'h-maint', '5120 Nutrients', ?, 'test')`,
      NOW,
      NOW
    );
    m.run(
      `INSERT INTO gc_budget_lines (id, harvest_id, gl, bu, amount, created_at, created_by) VALUES
       ('b-5320', 'h-maint', '5320 Small tools', '11 Indirect Grow / Maintenance', 100000, ?, 'test'),
       ('b-5120', 'h-maint', '5120 Nutrients', '11 Indirect Grow / Maintenance', 999900, ?, 'test')`,
      NOW,
      NOW
    );
    m.run(
      `INSERT INTO gc_actual_closes (id, harvest_id, close_date, file_name, uploaded_at, is_current, created_at, created_by)
       VALUES ('c-maint', 'h-maint', '2026-08-31', 'close.csv', ?, 1, ?, 'test')`,
      NOW,
      NOW
    );
    m.run(
      `INSERT INTO gc_actual_lines (id, close_id, entity, bu, gl, amount, created_at, created_by)
       VALUES ('a-5320', 'c-maint', 'shop', '11 Indirect Grow / Maintenance', '5320 Small tools', 25000, ?, 'test')`,
      NOW
    );
    const page = maintenancePage(await loadMaintenancePage(m.db, NOW), "en");
    expect(page).toContain("Maintenance budget: $250 spent of $1,000 this year (25%)");
    expect(page).not.toContain("$9,999");
    expect(page).not.toContain("$10,999");
    expect(DASH.test(page)).toBe(false);
  });

  it("puts the Maintenance tab on the farmops wall head only", async () => {
    const m = await migratedDb();
    const farm = directorWallPage(await loadDirectorWall(m.db, "farmops", TODAY, null, null, NOW), "en");
    expect(farm).toContain('data-dd-wall-tabs="farmops"');
    expect(farm).toContain(`href="${MAINTENANCE_PATH}"`);
    expect(farm).toContain(">Maintenance<");
    const home = directorHomePage(await loadDirectorHome(m.db, TODAY, NOW), "en");
    expect(home).toContain(`href="${PROJECTS_PATH}"`);
    expect(home).toContain(`href="${MAINTENANCE_PATH}"`);
    expect(DASH.test(farm)).toBe(false);
    for (const dept of ["bizops", "sales", "finance", "culttech"] as const) {
      const wall = directorWallPage(await loadDirectorWall(m.db, dept, TODAY, null, null, NOW), "en");
      expect(wall, dept).not.toContain("data-dd-wall-tabs");
      expect(wall, dept).not.toContain(MAINTENANCE_PATH);
    }
  });
});
