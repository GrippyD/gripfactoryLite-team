import { describe, expect, it } from "vitest";
import { loadSilo, scheduleLogisticsLot, unscheduleLogisticsLot } from "../src/actions";
import { listBarnWetLots, listDryQueueLots, listLotParts, listOpenLogisticsSchedules, listScheduledLotsForLoad, type BarnWetLotRow } from "../src/db";
import { app } from "../src/index";
import { internalLogisticsPage, logisticsLotView, processingPartnersPage } from "../src/scheduling";
import { formOf, migratedDb, seedBatch, seedPerson, type MigratedDb } from "./migrated";

const SILO = "a1000001-0001-4000-8000-000000000001";
const T0 = "2026-09-26T14:00:00.000Z";

function seedPart(m: MigratedDb, id: string, batchId: string, grams: number, truck: string | null): void {
  m.run(
    `INSERT INTO wet_weight_entries (id, harvest_batch_id, weight_grams, material_form, status, truck_number, actual_dryspc, created_at, updated_at)
     VALUES (?, ?, ?, 'bucked', 'drying', ?, ?, ?, ?)`,
    id,
    batchId,
    grams,
    truck,
    SILO,
    T0,
    T0
  );
  m.run(
    `INSERT INTO local_inventory_items (id, item_kind, package_code, harvest_batch_id, wet_weight_entry_id, qty, uom, farm_code, license_value, location, created_at, updated_at)
     VALUES (?, 'WIP', ?, ?, ?, ?, 'g', 'ARL', 'AU-G-C-000832', 'BARN', ?, ?)`,
    `li-${id}`,
    `PKG-${id}`,
    batchId,
    id,
    grams,
    T0,
    T0
  );
}

describe("THE LOAD AND THE LOT (canon 0.30.241)", () => {
  it("a finished two-HBN truck stays off Load Silo until each lot is passed, then one press loads every part", async () => {
    const m = await migratedDb();
    const person = seedPerson(m);
    seedBatch(m, { id: "hb-a", hbn: "26269-ARL-GH-001-0-NA-26081", serial: 481 });
    seedBatch(m, { id: "hb-b", hbn: "26269-ARL-GH-001-0-NA-26082", serial: 482 });
    m.run(`UPDATE harvest_batches SET planned_dryspc = '1' WHERE id = 'hb-a'`);
    seedPart(m, "part-a1", "hb-a", 1000, "4");
    seedPart(m, "part-a2", "hb-a", 500, "4");
    seedPart(m, "part-b", "hb-b", 800, "4");
    expect((await listDryQueueLots(m.db)).map((row) => row.id).sort()).toEqual((await listBarnWetLots(m.db)).map((row) => row.id).sort());
    expect(await listScheduledLotsForLoad(m.db)).toEqual([]);
    const queue = [logisticsLotView(await listLotParts(m.db, "hb-a")), logisticsLotView(await listLotParts(m.db, "hb-b"))];
    const page = internalLogisticsPage({ queue: queue.filter((row) => row != null), scheduled: [], finished: [], nowIso: T0 });
    expect(page).toContain('data-schedule-pane="available"');
    expect(page).toContain("Dry Queue");
    expect(page).toContain('data-logistics-lot="hb-a"');
    expect(page).toContain('data-logistics-parts="part-a1 part-a2"');
    expect(page).toContain("2 parts");
    expect(page).toContain("Trucks 4");
    expect(page).toContain("Planned silo: Silo 1");
    expect(page).toContain("&gt;&gt;");
    const passed = await scheduleLogisticsLot(m.db, formOf({ person_id: person, harvest_batch_id: "hb-a" }));
    expect(passed.redirect).toContain("ok=passed");
    expect((await listScheduledLotsForLoad(m.db)).map((row) => row.id)).toEqual(["hb-a"]);
    expect((await listScheduledLotsForLoad(m.db))[0]?.weight_grams).toBe(1500);
    const back = await unscheduleLogisticsLot(m.db, (await listOpenLogisticsSchedules(m.db))[0].id, formOf({ person_id: person }));
    expect(back.redirect).toContain("ok=returned");
    expect(await listScheduledLotsForLoad(m.db)).toEqual([]);
    await scheduleLogisticsLot(m.db, formOf({ person_id: person, harvest_batch_id: "hb-a" }));
    seedPart(m, "part-a3", "hb-a", 200, "9");
    expect((await listLotParts(m.db, "hb-a")).map((part) => part.id).sort()).toEqual(["part-a1", "part-a2", "part-a3"]);
    expect((await listOpenLogisticsSchedules(m.db)).filter((row) => row.harvest_batch_id === "hb-a")).toHaveLength(1);
    const loaded = await loadSilo(m.db, formOf({ person_id: person, lot_id: "hb-a", dry_space_id: SILO, start_time: "", loaded_at_iso: "" }));
    expect(loaded.redirect).toMatch(/ok=loaded/);
    expect(m.all(`SELECT wet_weight_entry_id FROM silo_loads WHERE ended_at IS NULL ORDER BY wet_weight_entry_id`).map((row) => row.wet_weight_entry_id)).toEqual([
      "part-a1",
      "part-a2",
      "part-a3",
    ]);
    expect(m.get(`SELECT status FROM production_schedules WHERE harvest_batch_id = 'hb-a' AND deleted_at IS NULL`)?.status).toBe("complete");
    expect(await listScheduledLotsForLoad(m.db)).toEqual([]);
    seedPart(m, "part-a4", "hb-a", 50, "4");
    expect((await listLotParts(m.db, "hb-a")).map((part) => part.id)).toEqual(["part-a4"]);
    expect(await listScheduledLotsForLoad(m.db)).toEqual([]);
    const late = logisticsLotView(await listLotParts(m.db, "hb-a"));
    expect(late?.partIds).toEqual(["part-a4"]);
    expect(processingPartnersPage("en")).toContain("- EMPTY -");
    expect(processingPartnersPage("es")).toContain("Socios de proceso");
  });

  it("the Scheduled > opens Load Silo on the batch and a two-part load keeps each typed count", async () => {
    const m = await migratedDb();
    seedBatch(m, { id: "hb-a", hbn: "26269-ARL-GH-001-0-NA-26091", serial: 491 });
    seedPart(m, "part-a1", "hb-a", 1000, "2");
    seedPart(m, "part-a2", "hb-a", 500, "2");
    const env = {
      DB: m.db,
      THEME: "grip",
      ASSETS: { fetch: () => Promise.resolve(new Response("no", { status: 404 })) },
    } as unknown as Env;
    const headers = { cookie: "gf_pin=21319" };
    const passed = await app.request(
      "/logistics/internal/schedule",
      { method: "POST", headers, body: new URLSearchParams({ harvest_batch_id: "hb-a" }) },
      env
    );
    expect(passed.status).toBe(303);
    const desk = await app.request("/logistics/internal", { headers }, env);
    expect(desk.status).toBe(200);
    const deskHtml = await desk.text();
    const href = (deskHtml.match(/href="(\/station\/load_silo\?pick=hb-a)"/) || [])[1];
    expect(href).toBe("/station/load_silo?pick=hb-a");
    const picked = await app.request(href, { headers }, env);
    expect(picked.status).toBe(200);
    const form = await picked.text();
    expect(form).toContain('name="lot_id" value="hb-a"');
    expect(form).toContain('name="plant_count[part-a1]"');
    expect(form).toContain('name="plant_count[part-a2]"');
    const loaded = await app.request(
      "/station/load_silo/load",
      {
        method: "POST",
        headers,
        body: new URLSearchParams({
          lot_id: "hb-a",
          dry_space_id: SILO,
          start_time: "",
          loaded_at_iso: "",
          "plant_count[part-a1]": "11",
          "plant_count[part-a2]": "7",
        }),
      },
      env
    );
    expect(loaded.status).toBe(303);
    expect(m.get(`SELECT plant_count FROM wet_weight_entries WHERE id = 'part-a1'`)?.plant_count).toBe(11);
    expect(m.get(`SELECT plant_count FROM wet_weight_entries WHERE id = 'part-a2'`)?.plant_count).toBe(7);
    expect(m.all(`SELECT wet_weight_entry_id FROM silo_loads WHERE ended_at IS NULL ORDER BY wet_weight_entry_id`).map((row) => row.wet_weight_entry_id)).toEqual([
      "part-a1",
      "part-a2",
    ]);
  });

  it("a second pass can return while an earlier load of the HBN is still open, and an empty pass stays on Scheduled", async () => {
    const m = await migratedDb();
    const person = seedPerson(m);
    seedBatch(m, { id: "hb-a", hbn: "26269-ARL-GH-001-0-NA-26092", serial: 492 });
    seedPart(m, "part-a1", "hb-a", 400, null);
    m.run(`UPDATE wet_weight_entries SET plant_count = 3 WHERE id = 'part-a1'`);
    await scheduleLogisticsLot(m.db, formOf({ person_id: person, harvest_batch_id: "hb-a" }));
    await loadSilo(m.db, formOf({ person_id: person, lot_id: "hb-a", dry_space_id: SILO, start_time: "", loaded_at_iso: "" }));
    seedPart(m, "part-a2", "hb-a", 100, null);
    await scheduleLogisticsLot(m.db, formOf({ person_id: person, harvest_batch_id: "hb-a" }));
    const second = (await listOpenLogisticsSchedules(m.db)).find((row) => row.harvest_batch_id === "hb-a");
    expect(second).toBeTruthy();
    const back = await unscheduleLogisticsLot(m.db, String(second?.id), formOf({ person_id: person }));
    expect(back.redirect).toContain("ok=returned");
    await scheduleLogisticsLot(m.db, formOf({ person_id: person, harvest_batch_id: "hb-a" }));
    m.run(`UPDATE wet_weight_entries SET deleted_at = '2026-09-26T16:00:00.000Z' WHERE id = 'part-a2'`);
    const env = {
      DB: m.db,
      THEME: "grip",
      ASSETS: { fetch: () => Promise.resolve(new Response("no", { status: 404 })) },
    } as unknown as Env;
    const desk = await app.request("/logistics/internal", { headers: { cookie: "gf_pin=21319" } }, env);
    const html = await desk.text();
    const scheduled = html.slice(html.indexOf('data-schedule-pane="working"'), html.indexOf('data-schedule-pane="complete"'));
    expect(scheduled).toContain('data-logistics-lot="hb-a"');
    expect(scheduled).toContain("0 parts");
    expect(scheduled).toContain("&lt;&lt;");
    expect(scheduled).not.toContain('href="/station/load_silo?pick=hb-a"');
    const counted = await (async () => {
      seedBatch(m, { id: "hb-c", hbn: "26269-ARL-GH-001-0-NA-26093", serial: 493 });
      seedPart(m, "part-c1", "hb-c", 10, null);
      seedPart(m, "part-c2", "hb-c", 10, null);
      m.run(`UPDATE wet_weight_entries SET plant_count = 4 WHERE id = 'part-c1'`);
      m.run(`UPDATE wet_weight_entries SET plant_count = 6 WHERE id = 'part-c2'`);
      await scheduleLogisticsLot(m.db, formOf({ person_id: person, harvest_batch_id: "hb-c" }));
      return (await listScheduledLotsForLoad(m.db)).find((row) => row.id === "hb-c");
    })();
    expect(counted?.plant_count).toBe(10);
  });

  it("an in-transit row names its loads where the trucks read, in both locales", () => {
    const weighing = {
      id: "w1",
      status: "weighing",
      harvest_batch_id: "hb-a",
      hbn: "26269-ARL-GH-001-0-NA-26081",
      farm_code: "ARL",
      strain_label: "Fruity",
      metrc_harvest_tag: null,
      package_code: null,
      truck_number: null,
      weight_grams: 146,
      finished_at: T0,
      in_transit_loads: 2,
      planned_silo_name: null,
      planned_dryspc: null,
    } as BarnWetLotRow;
    const view = logisticsLotView([weighing]);
    expect(view?.in_transit).toBe(true);
    expect(view?.oldest_finished_at).toBe(T0);
    const page = internalLogisticsPage({ queue: view ? [view] : [], scheduled: [], finished: [], nowIso: T0 });
    expect(page).toContain("data-logistics-in-transit");
    expect(page).toContain("in transit, 2 loads");
    expect(page).toContain('data-wet-grams="146"');
    expect(page).toContain(`data-waited="${T0}"`);
    expect(page).not.toContain("Trucks");
    const one = logisticsLotView([{ ...weighing, in_transit_loads: 1 }]);
    const es = internalLogisticsPage({ queue: one ? [one] : [], scheduled: [], finished: [], nowIso: T0, locale: "es" });
    expect(es).toContain("en transito, 1 carga");
    const drying = logisticsLotView([{ ...weighing, status: "drying", in_transit_loads: 0, truck_number: "4" }]);
    const finishedPage = internalLogisticsPage({ queue: drying ? [drying] : [], scheduled: [], finished: [], nowIso: T0 });
    expect(finishedPage).toContain("Trucks 4");
    expect(finishedPage).not.toContain("data-logistics-in-transit");
  });
});
