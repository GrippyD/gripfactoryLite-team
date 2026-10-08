import { describe, expect, it } from "vitest";
import { createHarvestBatch, manualHbn } from "../src/actions";
import { loadHarvestConsole } from "../src/console";
import { listQueueRows } from "../src/db";
import { queueSection } from "../src/html";
import { t } from "../src/i18n";
import { manualHbnPage } from "../src/pages";
import { listUncountedLots } from "../src/plantcounts";
import { queueByKey } from "../src/pipeline";
import { formOf, migratedDb, seedBatch, seedLot, seedPerson } from "./migrated";

/** MANUAL HBNS IN PHANTOM ORDER, AND TEST HBNS (canon 0.30.420). */

const STRAIN = "98cf3164-344e-414a-9f1c-1526fde445ac";
const OWNER = "7b59cf6b-04b6-4742-bb1b-78a28b593fe8";

function manualForm(person: string, over: Record<string, string> = {}): FormData {
  return formOf({
    person_id: person,
    hbn: "26280-PNN-GH-027-0-01-26998",
    entry_date: "2026-10-07",
    farm_code: "PNN",
    grow_method_code: "GH",
    strain_id: STRAIN,
    planned_dryspc: "1",
    material_form: "bucked",
    reason: "the system failed",
    ...over,
  });
}

function acquire(person: string): FormData {
  return formOf({
    person_id: person,
    entry_date: "2026-10-07",
    farm_code: "PNN",
    grow_method_code: "GH",
    strain_id: STRAIN,
    planned_dryspc: "1",
    material_form: "bucked",
  });
}

describe("MANUAL HBNS IN PHANTOM ORDER (canon 0.30.420)", () => {
  it("a manual HBN ending -26998 with the line at 105 holds 106, and the next auto is 107", async () => {
    const m = await migratedDb();
    const person = seedPerson(m);
    seedBatch(m, { id: "hb-105", hbn: "26280-PNN-GH-027-0-02-26105", serial: 105, farm: "PNN" });
    await manualHbn(m.db, manualForm(person));
    expect(m.get(`SELECT hbn, lot_serial, is_test, harvest_year FROM harvest_batches WHERE hbn = '26280-PNN-GH-027-0-01-26998'`)).toEqual({
      hbn: "26280-PNN-GH-027-0-01-26998",
      lot_serial: 106,
      is_test: 0,
      harvest_year: 2026,
    });
    await createHarvestBatch(m.db, acquire(person));
    expect(m.get(`SELECT lot_serial FROM harvest_batches WHERE hbn LIKE '%-26107'`)).toEqual({ lot_serial: 107 });
  });

  it("refuses a tail already used as another HBN's text, and accepts that number alone", async () => {
    const m = await migratedDb();
    const person = seedPerson(m);
    seedBatch(m, { id: "hb-105", hbn: "26280-PNN-GH-027-0-02-26105", serial: 105, farm: "PNN" });
    await expect(manualHbn(m.db, manualForm(person, { hbn: "26280-PNN-GH-027-0-02-26105" }))).rejects.toMatchObject({
      status: 409,
    });
    await manualHbn(m.db, manualForm(person, { hbn: "OtherBag-26105" }));
    expect(m.get(`SELECT lot_serial, is_test FROM harvest_batches WHERE hbn = 'OtherBag-26105'`)).toEqual({
      lot_serial: 106,
      is_test: 0,
    });
  });

  it("accepts a YY other than the entry year, and refuses a tail without -YY###", async () => {
    const m = await migratedDb();
    const person = seedPerson(m);
    await manualHbn(m.db, manualForm(person, { hbn: "OtherYear-25998" }));
    expect(m.get(`SELECT lot_serial, harvest_year FROM harvest_batches WHERE hbn = 'OtherYear-25998'`)).toEqual({
      lot_serial: 10,
      harvest_year: 2026,
    });
    await expect(manualHbn(m.db, manualForm(person, { hbn: "NoTail" }))).rejects.toMatchObject({ status: 400 });
    await expect(manualHbn(m.db, manualForm(person, { hbn: "TooLong-261000" }))).rejects.toMatchObject({ status: 400 });
  });

  it("a test holds 90001 and the next auto is unchanged; the auto mint ignores tests", async () => {
    const m = await migratedDb();
    const person = seedPerson(m);
    seedBatch(m, { id: "hb-105", hbn: "26280-PNN-GH-027-0-02-26105", serial: 105, farm: "PNN" });
    seedBatch(m, { id: "hb-old-test", hbn: "OldTest-26999", serial: 999, farm: "PNN" });
    m.run(`UPDATE harvest_batches SET is_test = 1, lot_serial = 90005 WHERE id = 'hb-old-test'`);
    await manualHbn(m.db, manualForm(person, { hbn: "SmokeTest-25901", is_test: "1" }));
    expect(m.get(`SELECT lot_serial, is_test, harvest_year FROM harvest_batches WHERE hbn = 'SmokeTest-25901'`)).toEqual({
      lot_serial: 90006,
      is_test: 1,
      harvest_year: 2026,
    });
    await createHarvestBatch(m.db, acquire(person));
    expect(m.get(`SELECT COUNT(*) AS n FROM harvest_batches WHERE harvest_year = 2026 AND is_test = 0 AND lot_serial = 106`)?.n).toBe(1);
    const fresh = await migratedDb();
    const who = seedPerson(fresh, "person-2");
    await manualHbn(fresh.db, manualForm(who, { hbn: "FirstTest-25001", is_test: "1" }));
    expect(fresh.get(`SELECT lot_serial FROM harvest_batches WHERE hbn = 'FirstTest-25001'`)).toEqual({ lot_serial: 90001 });
    await createHarvestBatch(fresh.db, acquire(who));
    expect(fresh.get(`SELECT lot_serial FROM harvest_batches WHERE is_test = 0`)).toEqual({ lot_serial: 10 });
  });

  it("refuses 999 with the words", async () => {
    const m = await migratedDb();
    const person = seedPerson(m);
    seedBatch(m, { id: "hb-999", hbn: "26280-PNN-GH-027-0-01-26999", serial: 999, farm: "PNN" });
    await expect(createHarvestBatch(m.db, acquire(person))).rejects.toMatchObject({
      status: 400,
      message: "The year's lot numbers have reached 999.",
    });
    await expect(manualHbn(m.db, manualForm(person))).rejects.toMatchObject({
      message: "The year's lot numbers have reached 999.",
    });
    await manualHbn(m.db, manualForm(person, { hbn: "CapTest-25001", is_test: "1" }));
    expect(m.get(`SELECT lot_serial, is_test FROM harvest_batches WHERE hbn = 'CapTest-25001'`)).toEqual({
      lot_serial: 90001,
      is_test: 1,
    });
    expect(t("es", "The year's lot numbers have reached 999.")).toBe("Los numeros de lote del ano han llegado a 999.");
  });

  it("the manual form offers the test box in both languages, and the queue says Test beside a test HBN", async () => {
    const m = await migratedDb();
    seedBatch(m, { id: "hb-live", hbn: "26280-PNN-GH-027-0-02-26105", serial: 105, farm: "PNN" });
    seedBatch(m, { id: "hb-test", hbn: "SmokeTest-25901", serial: 90001, farm: "PNN" });
    m.run(`UPDATE harvest_batches SET is_test = 1 WHERE id = 'hb-test'`);
    const page = manualHbnPage({ farms: [], licenses: [], grow_methods: [], strains: [] }, "en");
    expect(page).toContain('name="is_test" value="1"');
    expect(page).toContain("Test HBN (holds no place in line)");
    expect(manualHbnPage({ farms: [], licenses: [], grow_methods: [], strains: [] }, "es")).toContain(
      "HBN de prueba (no ocupa lugar en la fila)"
    );
    const queue = queueByKey("hbn_queue")!;
    const rows = await listQueueRows(m.db, queue);
    const html = queueSection(queue, rows, "en");
    expect(html).toContain("SmokeTest-25901 Test");
    expect(html).toContain('data-hbn-test="1"');
    expect(html).toContain("26280-PNN-GH-027-0-02-26105");
    expect(html).not.toContain("26280-PNN-GH-027-0-02-26105 Test");
    expect(queueSection(queue, rows, "es")).toContain("SmokeTest-25901 Prueba");
  });

  it("leaves a test out of the season figures and off the plant counts left pane", async () => {
    const m = await migratedDb();
    seedBatch(m, { id: "hb-live", hbn: "26280-PNN-GH-027-0-02-26105", serial: 105, farm: "PNN" });
    seedBatch(m, { id: "hb-test", hbn: "SmokeTest-25901", serial: 90001, farm: "PNN" });
    m.run(`UPDATE harvest_batches SET is_test = 1 WHERE id = 'hb-test'`);
    seedLot(m, "lot-live", "hb-live", "drying");
    seedLot(m, "lot-test", "hb-test", "drying");
    m.run(`UPDATE wet_weight_entries SET plant_count = 10 WHERE id = 'lot-live'`);
    m.run(`UPDATE wet_weight_entries SET plant_count = 77 WHERE id = 'lot-test'`);
    const at = "2026-10-07T16:00:00.000Z";
    m.run(
      `INSERT INTO wet_weights (id, wet_weight_entry_id, weight_grams, created_at, updated_at) VALUES ('w-live', 'lot-live', 448, ?, ?)`,
      at,
      at
    );
    m.run(
      `INSERT INTO wet_weights (id, wet_weight_entry_id, weight_grams, created_at, updated_at) VALUES ('w-test', 'lot-test', 896, ?, ?)`,
      at,
      at
    );
    m.run(
      `INSERT INTO wip_packages (id, wet_weight_entry_id, package_code, package_type_code, weight_grams, status, created_at, updated_at)
       VALUES ('pkg-live', 'lot-live', 'BUD-LIVE', 'BUD', 100, 'created', ?, ?)`,
      at,
      at
    );
    m.run(
      `INSERT INTO wip_packages (id, wet_weight_entry_id, package_code, package_type_code, weight_grams, status, created_at, updated_at)
       VALUES ('pkg-test', 'lot-test', 'BUD-TEST', 'BUD', 200, 'created', ?, ?)`,
      at,
      at
    );
    const loaded = await loadHarvestConsole(m.db, at);
    expect(loaded.seasonHarvested.reduce((n, row) => n + row.plants, 0)).toBe(10);
    expect(loaded.seasonLots).toHaveLength(1);
    expect(loaded.yearWet?.reduce((n, row) => n + row.wet_grams, 0)).toBe(448);
    expect(loaded.dayWet.reduce((n, row) => n + row.wet_grams, 0)).toBe(1344);
    expect(loaded.yieldLots).toHaveLength(1);
    expect(loaded.trimSeason?.map((row) => row.lot_id)).toEqual(["lot-live"]);
    seedLot(m, "lot-open", "hb-test", "weighing");
    const left = await listUncountedLots(m.db, 2026);
    expect(left.map((row) => row.id)).not.toContain("lot-open");
  });

  it("0095 marks a year 2000 row as a 2026 test, and a row already marked is left", async () => {
    const m = await migratedDb({ until: "0095" });
    const insert = (id: string, hbn: string, serial: number, year: number, at: string) =>
      m.run(
        `INSERT INTO harvest_batches (
           id, entry_date, farm_code, grow_method_code, strain_id, manicure, hbn, lot_serial, harvest_year, status,
           license_value, born_from, planned_dryspc, material_form, created_at, updated_at
         ) VALUES (?, '2026-10-07', 'PNN', 'GH', ?, 0, ?, ?, ?, 'open', 'AU-G-C-000832', 'app', '1', 'bucked', ?, ?)`,
        id,
        STRAIN,
        hbn,
        serial,
        year,
        at,
        at
      );
    insert("early", "ParkedEarly-26999", 999, 2000, "2026-10-07T15:00:00.000Z");
    insert("later", "ParkedLater-26998", 998, 2000, "2026-10-07T17:00:00.000Z");
    insert("line", "26280-PNN-GH-027-0-02-26105", 105, 2026, "2026-10-07T18:00:00.000Z");
    await m.applyRest();
    expect(m.get(`SELECT harvest_year, lot_serial, is_test, hbn FROM harvest_batches WHERE id = 'early'`)).toEqual({
      harvest_year: 2026,
      lot_serial: 90001,
      is_test: 1,
      hbn: "ParkedEarly-26999",
    });
    expect(m.get(`SELECT harvest_year, lot_serial, is_test FROM harvest_batches WHERE id = 'later'`)).toEqual({
      harvest_year: 2026,
      lot_serial: 90002,
      is_test: 1,
    });
    expect(m.get(`SELECT harvest_year, lot_serial, is_test FROM harvest_batches WHERE id = 'line'`)).toEqual({
      harvest_year: 2026,
      lot_serial: 105,
      is_test: 0,
    });
    const logs = m.all(
      `SELECT field, old_value, new_value, actor_person_id FROM record_change_log WHERE record_id = 'early' ORDER BY field`
    );
    expect(logs).toEqual([
      { field: "harvest_year", old_value: "2000", new_value: "2026", actor_person_id: OWNER },
      { field: "is_test", old_value: "0", new_value: "1", actor_person_id: OWNER },
      { field: "lot_serial", old_value: "999", new_value: "90001", actor_person_id: OWNER },
    ]);
    insert("kept", "AlreadyMarked-25001", 50, 2000, "2026-10-07T19:00:00.000Z");
    m.run(`UPDATE harvest_batches SET is_test = 1 WHERE id = 'kept'`);
    const fs = (await import("node:" + "fs")) as { readFileSync(path: URL, encoding: "utf8"): string };
    const sql = fs.readFileSync(new URL("../migrations/0095_manual_hbn_phantom_order.sql", import.meta.url), "utf8");
    const statements = sql
      .split(";")
      .map((part) => part.trim())
      .filter((part) => part.length > 0 && !part.includes("ALTER TABLE"));
    for (const statement of statements) m.run(statement);
    expect(m.get(`SELECT harvest_year, lot_serial, is_test FROM harvest_batches WHERE id = 'kept'`)).toEqual({
      harvest_year: 2000,
      lot_serial: 50,
      is_test: 1,
    });
    expect(m.get(`SELECT lot_serial FROM harvest_batches WHERE id = 'early'`)?.lot_serial).toBe(90001);
  });
});
