import { describe, expect, it } from "vitest";
import { addLotWeight, createWetWeight, editRecord, finishLot } from "../src/actions";
import { nowIso } from "../src/audit";
import { nextTruckNumber, shortLotId, SYSTEM_REASON } from "../src/config";
import { listFarmDayTruckNumbers, listOpenFarmHbns, listPaneRows, listWetWeightUploadReads } from "../src/db";
import { farmDay, FARM_DAY_START_HOUR_DEFAULT } from "../src/farmday";
import { wetLotPanel } from "../src/html";
import { queueByKey, stationByKey } from "../src/pipeline";
import { formOf, migratedDb, seedBatch, seedPerson, type MigratedDb } from "./migrated";

const SILO = "a1000001-0001-4000-8000-000000000001";
const T0 = "2026-09-24T16:00:00.000Z";

function shiftDay(day: string, n: number): string {
  const d = new Date(`${day}T12:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function seedWeighing(m: MigratedDb, id: string, batchId: string, truck: string | null, day: string): void {
  m.run(
    `INSERT INTO wet_weight_entries (
       id, harvest_batch_id, weight_grams, actual_dryspc, truck_number, material_form, team_lead, status, effective_date, created_at, updated_at
     ) VALUES (?, ?, 0, ?, ?, 'bucked', 'Lead', 'weighing', ?, ?, ?)`,
    id,
    batchId,
    SILO,
    truck,
    day,
    T0,
    T0
  );
}

function seedTote(m: MigratedDb, id: string, lotId: string, grams: number, hbnId: string | null, at: string): void {
  m.run(
    `INSERT INTO wet_weights (id, wet_weight_entry_id, weight_grams, harvest_batch_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    id,
    lotId,
    grams,
    hbnId,
    at,
    at
  );
}

describe("THE TRUCK RECORD (canon 0.30.226)", () => {
  it("the next Truck # is one past this farm's numbers on this farm day", async () => {
    const m = await migratedDb();
    const today = farmDay(nowIso(), FARM_DAY_START_HOUR_DEFAULT);
    const yesterday = shiftDay(today, -1);
    seedBatch(m, { id: "hb-a", hbn: "26244-ARL-GH-027-0-NA-26041", serial: 141, farm: "ARL" });
    seedBatch(m, { id: "hb-b", hbn: "26244-PNN-GH-001-0-NA-26051", serial: 151, farm: "PNN" });
    seedWeighing(m, "lot-a", "hb-a", "2", today);
    seedWeighing(m, "lot-b", "hb-a", "4", today);
    seedWeighing(m, "lot-c", "hb-a", "9", yesterday);
    seedWeighing(m, "lot-d", "hb-a", "note", today);
    seedWeighing(m, "lot-e", "hb-b", "8", today);
    const taken = await listFarmDayTruckNumbers(m.db, "ARL", today);
    expect(nextTruckNumber(taken)).toBe(5);
    expect(nextTruckNumber(await listFarmDayTruckNumbers(m.db, "PNN", today))).toBe(9);
  });

  it("a lot's tote list is the farm's open HBNs, header first, and a foreign HBN is refused", async () => {
    const m = await migratedDb();
    const person = seedPerson(m);
    seedBatch(m, { id: "hb-1", hbn: "26244-ARL-GH-027-0-NA-26041", serial: 241 });
    seedBatch(m, { id: "hb-2", hbn: "26244-ARL-GH-027-0-NA-26042", serial: 242 });
    seedBatch(m, { id: "hb-3", hbn: "26244-ARL-GH-027-0-NA-26043", serial: 243 });
    seedBatch(m, { id: "hb-old", hbn: "26244-ARL-GH-027-0-NA-26040", serial: 240 });
    seedBatch(m, { id: "hb-done", hbn: "26244-ARL-GH-027-0-NA-26039", serial: 239, status: "complete" });
    seedBatch(m, { id: "hb-metrc", hbn: "26244-ARL-GH-027-0-NA-26038", serial: 238, born: "metrc" });
    seedBatch(m, { id: "hb-pnn", hbn: "26244-PNN-GH-001-0-NA-26041", serial: 251, farm: "PNN" });
    m.run(`UPDATE harvest_batches SET entry_date = '2026-09-01', created_at = '2026-09-01T00:00:00.000Z' WHERE id = 'hb-old'`);
    m.run(`UPDATE harvest_batches SET entry_date = '2026-09-20', created_at = '2026-09-20T00:00:00.000Z' WHERE id = 'hb-2'`);
    m.run(`UPDATE harvest_batches SET entry_date = '2026-09-10', created_at = '2026-09-10T00:00:00.000Z' WHERE id = 'hb-3'`);
    seedWeighing(m, "lot-1", "hb-1", "1", "2026-09-24");
    const options = await listOpenFarmHbns(m.db, "ARL", "hb-1");
    expect(options.map((row) => row.id)).toEqual(["hb-1", "hb-2", "hb-3", "hb-old"]);
    expect(options[0].label).toContain("ARL");
    const station = stationByKey("wet_weight");
    if (!station) throw new Error("wet station missing");
    seedTote(m, "w1", "lot-1", 100, null, "2026-09-24T12:00:00.000Z");
    seedTote(m, "w2", "lot-1", 50, "hb-2", "2026-09-24T13:00:00.000Z");
    seedTote(m, "w3", "lot-1", 25, "hb-3", "2026-09-24T14:00:00.000Z");
    const html = wetLotPanel(
      station,
      {
        id: "lot-1",
        hbn: "26244-ARL-GH-027-0-NA-26041",
        harvest_batch_id: "hb-1",
        notes: null,
        dry_space_name: "Silo 1",
        truck_number: "1",
        lead_name: "Lead",
      },
      [
        { id: "w3", weight_grams: 25, created_at: "2026-09-24T14:00:00.000Z", harvest_batch_id: "hb-3", hbn: "26244-ARL-GH-027-0-NA-26043" },
        { id: "w2", weight_grams: 50, created_at: "2026-09-24T13:00:00.000Z", harvest_batch_id: "hb-2", hbn: "26244-ARL-GH-027-0-NA-26042" },
        { id: "w1", weight_grams: 100, created_at: "2026-09-24T12:00:00.000Z", harvest_batch_id: null, hbn: null },
      ],
      "Arlington",
      175,
      "en",
      options
    );
    expect(html).toContain('value="hb-3" selected');
    expect(html.indexOf('value="hb-1"')).toBeLessThan(html.indexOf('value="hb-2"'));
    expect(html).toContain("HBNs on this lot");
    expect(html).toContain("data-truck-number");
    expect(html).toContain("Truck 1 - 26244-ARL-GH-027-0-NA-26041");
    await expect(
      addLotWeight(m.db, station, "lot-1", formOf({ person_id: person, weight_grams: "10", harvest_batch_id: "hb-3" }))
    ).rejects.toMatchObject({ message: "That HBN is not on this lot's list." });
    const kept = await addLotWeight(m.db, station, "lot-1", formOf({ person_id: person, weight_grams: "10", harvest_batch_id: "hb-pnn" }));
    expect(kept.redirect).toContain("lot-1");
    expect(m.get(`SELECT harvest_batch_id FROM wet_weights WHERE weight_grams = 10`)?.harvest_batch_id).toBe("hb-pnn");
  });

  it("Finish lot splits a truck into one lot per HBN, one package each", async () => {
    const m = await migratedDb();
    const person = seedPerson(m);
    const station = stationByKey("wet_weight");
    if (!station) throw new Error("wet station missing");
    seedBatch(m, { id: "hb-1", hbn: "26244-ARL-GH-027-0-NA-26041", serial: 41 });
    seedBatch(m, { id: "hb-2", hbn: "26244-ARL-GH-027-0-NA-26042", serial: 42 });
    seedBatch(m, { id: "hb-3", hbn: "26244-ARL-GH-027-0-NA-26043", serial: 43 });
    seedWeighing(m, "lot-1", "hb-1", "3", "2026-09-24");
    seedTote(m, "w1", "lot-1", 1000, null, "2026-09-24T12:00:00.000Z");
    seedTote(m, "w2", "lot-1", 234, "hb-1", "2026-09-24T12:01:00.000Z");
    seedTote(m, "w3", "lot-1", 310, "hb-2", "2026-09-24T12:02:00.000Z");
    seedTote(m, "w4", "lot-1", 40, "hb-3", "2026-09-24T12:03:00.000Z");
    const form = new FormData();
    form.set("person_id", person);
    form.set("plant_count[hb-1]", "12");
    form.set("plant_count[hb-2]", "3");
    form.set("plant_count[hb-3]", "1");
    form.set("metrc_tag[hb-1]", "1A4060300002EE1000000001");
    form.set("metrc_tag[hb-2]", "1A4060300002EE1000000002");
    form.set("metrc_tag[hb-3]", "1A4060300002EE1000000003");
    const out = await finishLot(m.db, station, "lot-1", form);
    expect(out.redirect).toContain("ok=truck_split");
    expect(out.redirect).toContain("truck=3");
    expect(decodeURIComponent(out.redirect)).toContain("26041|2|1,234");
    expect(decodeURIComponent(out.redirect)).toContain("26042|1|310");
    const lots = m.all(
      `SELECT id, harvest_batch_id, truck_number, status, weight_grams, plant_count FROM wet_weight_entries WHERE deleted_at IS NULL ORDER BY harvest_batch_id`
    );
    expect(lots).toEqual([
      { id: "lot-1", harvest_batch_id: "hb-1", truck_number: "3", status: "drying", weight_grams: 1234, plant_count: 12 },
      expect.objectContaining({ harvest_batch_id: "hb-2", truck_number: "3", status: "drying", weight_grams: 310, plant_count: 3 }),
      expect.objectContaining({ harvest_batch_id: "hb-3", truck_number: "3", status: "drying", weight_grams: 40, plant_count: 1 }),
    ]);
    expect(m.get(`SELECT wet_weight_entry_id FROM wet_weights WHERE id = 'w1'`)?.wet_weight_entry_id).toBe("lot-1");
    const moved = m.get(`SELECT wet_weight_entry_id FROM wet_weights WHERE id = 'w3'`);
    expect(moved?.wet_weight_entry_id).not.toBe("lot-1");
    const moveLog = m.all(`SELECT reason FROM record_change_log WHERE record_table = 'wet_weights' AND field = 'wet_weight_entry_id'`);
    expect(moveLog).toHaveLength(2);
    expect(moveLog.every((row) => row.reason === SYSTEM_REASON.truck_split)).toBe(true);
    const packages = m.all(`SELECT package_code, metrc_tag, qty, location FROM local_inventory_items WHERE deleted_at IS NULL ORDER BY package_code`);
    expect(packages.map((row) => row.package_code)).toEqual(["26041-T3", "26042-T3", "26043-T3"]);
    expect(packages.every((row) => row.location === "BARN")).toBe(true);
    expect(packages.map((row) => row.metrc_tag)).toEqual([
      "1A4060300002EE1000000001",
      "1A4060300002EE1000000002",
      "1A4060300002EE1000000003",
    ]);
    const csv1 = (await listWetWeightUploadReads(m.db, "hb-1")).map((row) => row.hbn);
    const csv2 = (await listWetWeightUploadReads(m.db, "hb-2")).map((row) => Number(row.weight_grams));
    expect(csv1.every((hbn) => hbn === "26244-ARL-GH-027-0-NA-26041")).toBe(true);
    expect(csv1).toHaveLength(2);
    expect(csv2).toEqual([310]);
  });

  it("a single HBN finishes as one lot, with -T only when the lot has a truck number", async () => {
    const m = await migratedDb();
    const person = seedPerson(m);
    const station = stationByKey("wet_weight");
    if (!station) throw new Error("wet station missing");
    seedBatch(m, { id: "hb-1", hbn: "26244-ARL-GH-027-0-NA-26041", serial: 441 });
    seedWeighing(m, "lot-plain", "hb-1", null, "2026-09-24");
    seedTote(m, "wp", "lot-plain", 500, null, T0);
    const plain = await finishLot(m.db, station, "lot-plain", formOf({ person_id: person, plant_count: "8" }));
    expect(plain.redirect).not.toContain("truck_split");
    expect(m.all(`SELECT id FROM wet_weight_entries`)).toHaveLength(1);
    expect(m.get(`SELECT package_code FROM local_inventory_items`)?.package_code).toBe(shortLotId("26244-ARL-GH-027-0-NA-26041", null));
    seedBatch(m, { id: "hb-2", hbn: "26244-ARL-GH-027-0-NA-26042", serial: 42 });
    seedWeighing(m, "lot-truck", "hb-2", "1", "2026-09-24");
    seedTote(m, "wt", "lot-truck", 200, "hb-2", T0);
    const truck = await finishLot(m.db, station, "lot-truck", formOf({ person_id: person }));
    expect(truck.redirect).not.toContain("truck_split");
    expect(m.get(`SELECT package_code FROM local_inventory_items WHERE wet_weight_entry_id = 'lot-truck'`)?.package_code).toBe("26042-T1");
  });

  it("the pane keeps a batch finished today and hides one finished yesterday", async () => {
    const m = await migratedDb();
    const today = farmDay(nowIso(), FARM_DAY_START_HOUR_DEFAULT);
    const yesterday = shiftDay(today, -1);
    seedBatch(m, { id: "hb-today", hbn: "26244-ARL-GH-027-0-NA-26041", serial: 541 });
    seedBatch(m, { id: "hb-yest", hbn: "26244-ARL-GH-027-0-NA-26042", serial: 542 });
    seedBatch(m, { id: "hb-open", hbn: "26244-ARL-GH-027-0-NA-26043", serial: 543 });
    m.run(
      `INSERT INTO wet_weight_entries (id, harvest_batch_id, weight_grams, actual_dryspc, status, effective_date, created_at, updated_at)
       VALUES ('lot-today', 'hb-today', 100, ?, 'drying', ?, ?, ?)`,
      SILO,
      today,
      T0,
      T0
    );
    m.run(
      `INSERT INTO wet_weight_entries (id, harvest_batch_id, weight_grams, actual_dryspc, status, effective_date, created_at, updated_at)
       VALUES ('lot-yest', 'hb-yest', 100, ?, 'drying', ?, ?, ?)`,
      SILO,
      yesterday,
      T0,
      T0
    );
    const queue = queueByKey("hbn_queue");
    if (!queue) throw new Error("hbn queue missing");
    const rows = await listPaneRows(m.db, queue, "no_finished_lot");
    const ids = rows.map((row) => row.id);
    expect(ids).toContain("hb-today");
    expect(ids).toContain("hb-open");
    expect(ids).not.toContain("hb-yest");
    m.run(
      `INSERT INTO wet_weight_entries (id, harvest_batch_id, weight_grams, actual_dryspc, status, effective_date, created_at, updated_at)
       VALUES ('lot-weigh', 'hb-yest', 0, ?, 'weighing', ?, ?, ?)`,
      SILO,
      yesterday,
      T0,
      T0
    );
    const again = await listPaneRows(m.db, queue, "no_finished_lot");
    expect(again.map((row) => row.id)).toContain("hb-yest");
  });

  it("the tote pencil refuses a finished lot, and the lot pencil moves totes that carry the old header", async () => {
    const m = await migratedDb();
    const person = seedPerson(m);
    seedBatch(m, { id: "hb-1", hbn: "26244-ARL-GH-027-0-NA-26041", serial: 41 });
    seedBatch(m, { id: "hb-2", hbn: "26244-ARL-GH-027-0-NA-26042", serial: 42 });
    seedBatch(m, { id: "hb-3", hbn: "26244-ARL-GH-027-0-NA-26043", serial: 43 });
    m.run(
      `INSERT INTO wet_weight_entries (id, harvest_batch_id, weight_grams, actual_dryspc, status, created_at, updated_at)
       VALUES ('lot-dry', 'hb-1', 100, ?, 'drying', ?, ?)`,
      SILO,
      T0,
      T0
    );
    seedTote(m, "w-dry", "lot-dry", 100, null, T0);
    await expect(
      editRecord(m.db, "wet_weights", "w-dry", formOf({ person_id: person, harvest_batch_id: "hb-2", reason: "too late" }))
    ).rejects.toMatchObject({ message: "Only a weighing lot's totes can change HBN; this lot has finished." });
    seedWeighing(m, "lot-w", "hb-1", null, "2026-09-24");
    seedTote(m, "w-null", "lot-w", 10, null, T0);
    seedTote(m, "w-own", "lot-w", 20, "hb-1", T0);
    seedTote(m, "w-other", "lot-w", 30, "hb-2", T0);
    await editRecord(
      m.db,
      "wet_weight_entries",
      "lot-w",
      formOf({ person_id: person, harvest_batch_id: "hb-3", reason: "wrong header" })
    );
    expect(m.get(`SELECT harvest_batch_id FROM wet_weights WHERE id = 'w-null'`)?.harvest_batch_id).toBe("hb-3");
    expect(m.get(`SELECT harvest_batch_id FROM wet_weights WHERE id = 'w-own'`)?.harvest_batch_id).toBe("hb-3");
    expect(m.get(`SELECT harvest_batch_id FROM wet_weights WHERE id = 'w-other'`)?.harvest_batch_id).toBe("hb-2");
  });
});

describe("Penn North Harvest (canon 0.30.317)", () => {
  const HANG = "a1000001-0001-4000-8000-000000000007";

  it("the pane lists PNN batches only, and an ARL batch cannot start a lot here", async () => {
    const m = await migratedDb();
    const person = seedPerson(m);
    seedBatch(m, { id: "hb-arl", hbn: "26244-ARL-GH-027-0-NA-26101", serial: 6101, farm: "ARL" });
    seedBatch(m, { id: "hb-pns", hbn: "26244-PNS-GH-027-0-NA-26102", serial: 6102, farm: "PNS" });
    seedBatch(m, { id: "hb-pnn", hbn: "26244-PNN-GH-027-0-NA-26103", serial: 6103, farm: "PNN" });
    const queue = queueByKey("hbn_queue");
    if (!queue) throw new Error("hbn queue missing");
    const rows = await listPaneRows(m.db, queue, "no_finished_lot", ["PNN"]);
    expect(rows.map((row) => row.id)).toEqual(["hb-pnn"]);
    const station = stationByKey("wet_weight");
    if (!station) throw new Error("wet station missing");
    await expect(
      createWetWeight(m.db, formOf({ person_id: person, team_lead: "Lead", harvest_batch_id: "hb-arl", actual_dryspc: HANG }))
    ).rejects.toMatchObject({ message: "Penn North Harvest takes Penn North batches only." });
    const started = await createWetWeight(
      m.db,
      formOf({ person_id: person, team_lead: "Lead", harvest_batch_id: "hb-pnn", actual_dryspc: HANG })
    );
    expect(started.redirect).toContain("lot=");
  });

  it("a finish writes one Internal Logistics pass, and a later part of that HBN writes none", async () => {
    const m = await migratedDb();
    const person = seedPerson(m);
    const station = stationByKey("wet_weight");
    if (!station) throw new Error("wet station missing");
    seedBatch(m, { id: "hb-pnn", hbn: "26244-PNN-GH-027-0-NA-26111", serial: 6111, farm: "PNN" });
    seedWeighing(m, "lot-1", "hb-pnn", null, "2026-09-24");
    seedTote(m, "w1", "lot-1", 400, "hb-pnn", T0);
    await finishLot(m.db, station, "lot-1", formOf({ person_id: person, plant_prompt: "skip" }));
    const passes = m.all(
      `SELECT harvest_batch_id, stage, status FROM production_schedules WHERE deleted_at IS NULL`
    );
    expect(passes).toEqual([{ harvest_batch_id: "hb-pnn", stage: "internal_logistics", status: "scheduled" }]);
    expect(m.get(`SELECT reason FROM record_change_log WHERE record_table = 'production_schedules' AND field = 'status'`)?.reason).toBe(
      "finish lot"
    );
    seedWeighing(m, "lot-2", "hb-pnn", null, "2026-09-24");
    seedTote(m, "w2", "lot-2", 50, "hb-pnn", T0);
    await finishLot(m.db, station, "lot-2", formOf({ person_id: person, plant_prompt: "skip" }));
    expect(m.all(`SELECT id FROM production_schedules WHERE deleted_at IS NULL`)).toHaveLength(1);
    expect(m.get(`SELECT status FROM wet_weight_entries WHERE id = 'lot-2'`)?.status).toBe("drying");
  });
});
