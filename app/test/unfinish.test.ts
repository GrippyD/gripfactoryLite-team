import { describe, expect, it } from "vitest";
import { adoptFromMetrc, addCryoOutput, finishCryoRun, runQueueControl, unfinishCryoContainer, unfinishCryoOutput, unfinishScheduleItem } from "../src/actions";
import { cryoStationPage } from "../src/cryo";
import { listCryoRunPool } from "../src/db";
import { queueSection } from "../src/html";
import { queueByKey } from "../src/pipeline";
import { formOf, migratedDb, seedBatch, seedLot, seedMirror, seedPerson, type MigratedDb } from "./migrated";
import { addPrepackLine, finishPrepack } from "../src/prepack";

const T0 = "2026-09-24T12:00:00.000Z";
const PIN = "21319";
const TAG = "1A4050300000000000000C11";

async function cryoFloor(m: MigratedDb): Promise<string> {
  const person = seedPerson(m);
  seedBatch(m, { id: "hb-1", hbn: "26244-ARL-GH-027-0-NA-26011", serial: 11 });
  seedLot(m, "lot-1", "hb-1");
  m.run(
    `INSERT INTO wip_packages (id, wet_weight_entry_id, harvest_batch_id, package_code, package_type_code, weight_grams, status, source, created_at, updated_at)
     VALUES ('c1', 'lot-1', 'hb-1', 'BUD-1', 'BUD', 100, 'cryo_queue', 'trim', ?, ?)`,
    T0,
    T0
  );
  m.run(
    `INSERT INTO local_inventory_items (id, item_kind, package_code, harvest_batch_id, wip_package_id, qty, uom, farm_code, license_value, location, created_at, updated_at)
     VALUES ('li-1', 'WIP', 'BUD-1', 'hb-1', 'c1', 100, 'g', 'ARL', 'AU-G-C-000832', 'Cryo Room', ?, ?)`,
    T0,
    T0
  );
  m.run(
    `INSERT INTO production_schedules (id, stage, harvest_batch_id, status, scheduled_at, created_at, updated_at)
     VALUES ('run-1', 'cryo', 'hb-1', 'scheduled', ?, ?, ?)`,
    T0,
    T0,
    T0
  );
  m.run(
    `INSERT INTO cryo_run_inputs (id, run_id, wip_package_id, package_type_code, weight_grams, created_at) VALUES ('in-1', 'run-1', 'c1', 'BUD', 100, ?)`,
    T0
  );
  await addCryoOutput(m.db, "run-1", formOf({ package_code: TAG, package_type_code: "BUD", weight_grams: "40", cryo_operator: "Austin", person_id: person }));
  await finishCryoRun(m.db, "run-1", formOf({ person_id: person }));
  return person;
}

describe("THE UNFINISH (canon 0.30.220)", () => {
  it("trim unfinish unschedules an empty pasteurization run and returns the row", async () => {
    const m = await migratedDb();
    const person = seedPerson(m);
    seedBatch(m, { id: "hb-1", hbn: "26244-ARL-GH-027-0-NA-26011", serial: 11 });
    seedLot(m, "lot-1", "hb-1", "unloaded");
    m.run(
      `INSERT INTO production_schedules (id, stage, wet_weight_entry_id, harvest_batch_id, status, completed_at, scheduled_at, created_at, updated_at)
       VALUES ('trim-1', 'trim', 'lot-1', 'hb-1', 'complete', ?, ?, ?, ?)`,
      T0,
      T0,
      T0,
      T0
    );
    m.run(
      `INSERT INTO production_schedules (id, stage, harvest_batch_id, status, scheduled_at, created_at, updated_at)
       VALUES ('run-1', 'cryo', 'hb-1', 'scheduled', ?, ?, ?)`,
      T0,
      T0,
      T0
    );
    const out = await unfinishScheduleItem(m.db, "trim", "trim-1", formOf({ person_id: person, unfinish_pin: PIN }));
    expect(out.redirect).toContain("ok=unfinished");
    expect(out.redirect).toContain("hbn=");
    expect(m.get(`SELECT status, completed_at FROM production_schedules WHERE id = 'trim-1'`)).toMatchObject({ status: "scheduled", completed_at: null });
    expect(m.get(`SELECT deleted_at FROM production_schedules WHERE id = 'run-1'`)?.deleted_at).toBeTruthy();
  });

  it("trim unfinish refuses a run with outputs and a finished run, and writes nothing", async () => {
    const m = await migratedDb();
    const person = await cryoFloor(m);
    m.run(
      `INSERT INTO production_schedules (id, stage, wet_weight_entry_id, harvest_batch_id, status, completed_at, scheduled_at, created_at, updated_at)
       VALUES ('trim-1', 'trim', 'lot-1', 'hb-1', 'complete', ?, ?, ?, ?)`,
      T0,
      T0,
      T0,
      T0
    );
    await expect(unfinishScheduleItem(m.db, "trim", "trim-1", formOf({ person_id: person, unfinish_pin: PIN }))).rejects.toThrow(/is finished/);
    expect(m.get(`SELECT status FROM production_schedules WHERE id = 'trim-1'`)).toEqual({ status: "complete" });
    expect(m.get(`SELECT status FROM production_schedules WHERE id = 'run-1'`)).toEqual({ status: "complete" });
  });

  it("a scheduled run with outputs refuses the trim unfinish", async () => {
    const m = await migratedDb();
    const person = seedPerson(m);
    seedBatch(m, { id: "hb-1", hbn: "26244-ARL-GH-027-0-NA-26011", serial: 11 });
    seedLot(m, "lot-1", "hb-1");
    m.run(
      `INSERT INTO production_schedules (id, stage, wet_weight_entry_id, harvest_batch_id, status, completed_at, scheduled_at, created_at, updated_at)
       VALUES ('trim-1', 'trim', 'lot-1', 'hb-1', 'complete', ?, ?, ?, ?)`,
      T0,
      T0,
      T0,
      T0
    );
    m.run(
      `INSERT INTO production_schedules (id, stage, harvest_batch_id, status, scheduled_at, created_at, updated_at)
       VALUES ('run-1', 'cryo', 'hb-1', 'scheduled', ?, ?, ?)`,
      T0,
      T0,
      T0
    );
    m.run(
      `INSERT INTO wip_packages (id, wet_weight_entry_id, harvest_batch_id, package_code, package_type_code, weight_grams, status, source, cryo_run_id, created_at, updated_at)
       VALUES ('out-1', 'lot-1', 'hb-1', '${TAG}', 'BUD', 10, 'testing_queue', 'cryo', 'run-1', ?, ?)`,
      T0,
      T0
    );
    await expect(unfinishScheduleItem(m.db, "trim", "trim-1", formOf({ person_id: person, unfinish_pin: PIN }))).rejects.toThrow(/1 outputs entered/);
    expect(m.get(`SELECT deleted_at FROM production_schedules WHERE id = 'run-1'`)).toEqual({ deleted_at: null });
    expect(m.get(`SELECT status FROM production_schedules WHERE id = 'trim-1'`)).toEqual({ status: "complete" });
  });

  it("the run unfinish returns containers with their grams, voids the outputs, and reopens the run", async () => {
    const m = await migratedDb();
    const person = await cryoFloor(m);
    const out = await unfinishScheduleItem(m.db, "cryo", "run-1", formOf({ person_id: person, unfinish_pin: PIN }));
    expect(out.redirect).toContain("ok=run_unfinished");
    expect(out.redirect).toContain("n=1");
    expect(out.redirect).toContain("m=1");
    expect(m.get(`SELECT status, qty FROM wip_packages p JOIN local_inventory_items i ON i.wip_package_id = p.id WHERE p.id = 'c1'`)).toMatchObject({
      status: "cryo_queue",
      qty: 100,
    });
    expect(m.get(`SELECT deleted_at FROM wip_packages WHERE package_code = ?`, TAG)?.deleted_at).toBeTruthy();
    expect(m.get(`SELECT deleted_at FROM local_inventory_items WHERE metrc_tag = ?`, TAG)?.deleted_at).toBeTruthy();
    expect(m.get(`SELECT status, completed_at FROM production_schedules WHERE id = 'run-1'`)).toMatchObject({ status: "scheduled", completed_at: null });
  });

  it("the run unfinish refuses a released output, a sampled output, and a marked New Packages file", async () => {
    const released = await migratedDb();
    const person = await cryoFloor(released);
    const outputId = String(released.get(`SELECT id FROM wip_packages WHERE package_code = ?`, TAG)?.id);
    released.run(`UPDATE wip_packages SET status = 'released' WHERE id = ?`, outputId);
    await expect(unfinishScheduleItem(released.db, "cryo", "run-1", formOf({ person_id: person, unfinish_pin: PIN }))).rejects.toThrow(/is released/);
    expect(released.get(`SELECT status FROM wip_packages WHERE id = 'c1'`)).toEqual({ status: "pasteurized" });

    const sampled = await migratedDb();
    const person2 = await cryoFloor(sampled);
    sampled.run(
      `INSERT INTO testing_labs (id, name, portal_kind, active, created_at, updated_at) VALUES ('lab-1', 'Lab', 'portal', 1, ?, ?)`,
      T0,
      T0
    );
    sampled.run(
      `INSERT INTO test_orders (id, lot_id, source_package_tag, market, lab_id, panel, required_lab_test_batch, batch_grams, sample_grams, status, created_at, updated_at)
       VALUES ('ord-1', 'lot-1', ?, 'au', 'lab-1', 'full', 'full', 40, 14, 'sampled', ?, ?)`,
      TAG,
      T0,
      T0
    );
    sampled.run(
      `INSERT INTO test_samples (id, order_id, sample_tag, net_grams, sampled_at, attempt, created_at, updated_at)
       VALUES ('sam-1', 'ord-1', '1A4050300000000000000S01', 14, ?, 1, ?, ?)`,
      T0,
      T0,
      T0
    );
    await expect(unfinishScheduleItem(sampled.db, "cryo", "run-1", formOf({ person_id: person2, unfinish_pin: PIN }))).rejects.toThrow(/has a sample/);
    expect(sampled.get(`SELECT status FROM production_schedules WHERE id = 'run-1'`)).toEqual({ status: "complete" });

    const marked = await migratedDb();
    const person3 = await cryoFloor(marked);
    marked.run(
      `INSERT INTO metrc_uploads (id, kind, harvest_batch_id, filename, uploaded_at, ref_id, created_at, updated_at)
       VALUES ('up-1', 'new_packages', 'hb-1', 'new_packages_26244.xlsx', ?, 'run-1', ?, ?)`,
      T0,
      T0,
      T0
    );
    await expect(unfinishScheduleItem(marked.db, "cryo", "run-1", formOf({ person_id: person3, unfinish_pin: PIN }))).rejects.toThrow(/new_packages_26244.xlsx/);
    expect(marked.get(`SELECT status FROM wip_packages WHERE id = 'c1'`)).toEqual({ status: "pasteurized" });
  }, 20000);

  it("one container returns to the Cryo Queue and leaves the pool; a marked file refuses", async () => {
    const m = await migratedDb();
    const person = await cryoFloor(m);
    const before = await listCryoRunPool(m.db, "run-1");
    const inBefore = before.lines.reduce((n, line) => n + line.in_grams, 0);
    const out = await unfinishCryoContainer(m.db, "run-1", "in-1", formOf({ person_id: person, unfinish_pin: PIN }));
    expect(out.redirect).toContain("ok=container_unfinished");
    expect(m.get(`SELECT status FROM wip_packages WHERE id = 'c1'`)).toEqual({ status: "cryo_queue" });
    expect(m.get(`SELECT qty FROM local_inventory_items WHERE id = 'li-1'`)).toEqual({ qty: 100 });
    expect(m.get(`SELECT id FROM cryo_run_inputs WHERE id = 'in-1'`)).toBeUndefined();
    const after = await listCryoRunPool(m.db, "run-1");
    expect(after.lines.reduce((n, line) => n + line.in_grams, 0)).toBeLessThan(inBefore);

    const blocked = await migratedDb();
    const person2 = await cryoFloor(blocked);
    blocked.run(
      `INSERT INTO metrc_uploads (id, kind, harvest_batch_id, filename, uploaded_at, ref_id, created_at, updated_at)
       VALUES ('up-1', 'new_packages', 'hb-1', 'new_packages_marked.xlsx', ?, 'run-1', ?, ?)`,
      T0,
      T0,
      T0
    );
    await expect(unfinishCryoContainer(blocked.db, "run-1", "in-1", formOf({ person_id: person2, unfinish_pin: PIN }))).rejects.toThrow(/new_packages_marked.xlsx/);
    expect(blocked.get(`SELECT id FROM cryo_run_inputs WHERE id = 'in-1'`)).toEqual({ id: "in-1" });
  });

  it("one output voids both rows and the pool reads whole; released or sampled refuses", async () => {
    const m = await migratedDb();
    const person = await cryoFloor(m);
    const outputId = String(m.get(`SELECT id FROM wip_packages WHERE package_code = ?`, TAG)?.id);
    const out = await unfinishCryoOutput(m.db, outputId, formOf({ person_id: person, unfinish_pin: PIN }));
    expect(out.redirect).toContain("ok=output_unfinished");
    expect(m.get(`SELECT deleted_at FROM wip_packages WHERE id = ?`, outputId)?.deleted_at).toBeTruthy();
    const pool = await listCryoRunPool(m.db, "run-1");
    expect(pool.lines.reduce((n, line) => n + line.out_grams, 0)).toBe(0);

    const released = await migratedDb();
    const person2 = await cryoFloor(released);
    const releasedId = String(released.get(`SELECT id FROM wip_packages WHERE package_code = ?`, TAG)?.id);
    released.run(`UPDATE wip_packages SET status = 'released' WHERE id = ?`, releasedId);
    await expect(unfinishCryoOutput(released.db, releasedId, formOf({ person_id: person2, unfinish_pin: PIN }))).rejects.toThrow(/is released/);
    expect(released.get(`SELECT deleted_at FROM wip_packages WHERE id = ?`, releasedId)).toEqual({ deleted_at: null });
  });

  it("Testing Queue Demote on a cryo output is the output unfinish", async () => {
    const m = await migratedDb();
    const person = await cryoFloor(m);
    const outputId = String(m.get(`SELECT id FROM wip_packages WHERE package_code = ?`, TAG)?.id);
    const html = queueSection(queueByKey("testing_queue")!, [{ id: outputId, values: { source: "cryo", package_code: TAG } }]);
    expect(html).toContain('name="unfinish_pin"');
    expect(html).toContain('name="control" value="demote"');
    const out = await runQueueControl(m.db, "demote", formOf({ id: outputId, person_id: person, unfinish_pin: PIN }), "wip_packages");
    expect(out.redirect).toContain("ok=output_unfinished");
    expect(m.get(`SELECT deleted_at FROM wip_packages WHERE id = ?`, outputId)?.deleted_at).toBeTruthy();
  });

  it("prepack unfinish restores the parent and voids an untouched carry; a drawn carry and a marked file refuse", async () => {
    const m = await migratedDb();
    const person = seedPerson(m);
    const hbn = "46258-PNN-ID-062-0-NA-26007";
    const parent = "1A4050300000000000000F41";
    const other = "1A4050300000000000000F42";
    seedMirror(m, { tag: parent, harvest: hbn, grams: 100 });
    seedMirror(m, { tag: other, harvest: hbn, grams: 80 });
    await adoptFromMetrc(m.db, formOf({ tag: parent, person_id: person }));
    await adoptFromMetrc(m.db, formOf({ tag: other, person_id: person }));
    const job = String(m.get(`SELECT id FROM production_schedules WHERE wip_package_id = (SELECT id FROM wip_packages WHERE package_code = ?)`, parent)?.id);
    await addPrepackLine(m.db, job, formOf({ person_id: person, unit_grams: "3.5", bags: "2", tag: "1A4050300000000000000B41" }));
    await finishPrepack(m.db, job, formOf({ person_id: person, push: "yes" }));
    const out = await unfinishScheduleItem(m.db, "prepack", job, formOf({ person_id: person, unfinish_pin: PIN }));
    expect(out.redirect).toContain("ok=pack_unfinished");
    expect(out.redirect).toContain("g=93");
    expect(m.get(`SELECT status FROM wip_packages WHERE package_code = ?`, parent)).toEqual({ status: "released" });
    expect(m.get(`SELECT qty FROM local_inventory_items WHERE metrc_tag = ?`, parent)).toEqual({ qty: 93 });
    expect(m.get(`SELECT status, completed_at FROM production_schedules WHERE id = ?`, job)).toMatchObject({ status: "scheduled", completed_at: null });
    expect(m.get(`SELECT deleted_at FROM prepack_carries WHERE from_job_id = ?`, job)?.deleted_at).toBeTruthy();

    const drawn = await migratedDb();
    const person2 = seedPerson(drawn);
    seedMirror(drawn, { tag: parent, harvest: hbn, grams: 100 });
    seedMirror(drawn, { tag: other, harvest: hbn, grams: 80 });
    await adoptFromMetrc(drawn.db, formOf({ tag: parent, person_id: person2 }));
    await adoptFromMetrc(drawn.db, formOf({ tag: other, person_id: person2 }));
    const job2 = String(drawn.get(`SELECT id FROM production_schedules WHERE wip_package_id = (SELECT id FROM wip_packages WHERE package_code = ?)`, parent)?.id);
    const otherJob = String(drawn.get(`SELECT id FROM production_schedules WHERE wip_package_id = (SELECT id FROM wip_packages WHERE package_code = ?)`, other)?.id);
    await addPrepackLine(drawn.db, job2, formOf({ person_id: person2, unit_grams: "3.5", bags: "2", tag: "1A4050300000000000000B41" }));
    await finishPrepack(drawn.db, job2, formOf({ person_id: person2, push: "yes" }));
    const carry = drawn.get(`SELECT id, grams FROM prepack_carries WHERE from_job_id = ?`, job2) as { id: string; grams: number };
    drawn.run(`UPDATE prepack_carries SET remaining = remaining - 1 WHERE id = ?`, carry.id);
    drawn.run(
      `INSERT INTO prepack_lines (id, job_id, parent_package_id, unit_grams, bags, grams, tag, carried_grams, carry_id, work_date, created_at, updated_at)
       VALUES ('line-draw', ?, (SELECT id FROM wip_packages WHERE package_code = ?), 3.5, 1, 4, '1A4050300000000000000B42', 1, ?, '2026-09-24', ?, ?)`,
      otherJob,
      other,
      carry.id,
      T0,
      T0
    );
    await expect(unfinishScheduleItem(drawn.db, "prepack", job2, formOf({ person_id: person2, unfinish_pin: PIN }))).rejects.toThrow(new RegExp(other));
    expect(drawn.get(`SELECT status FROM production_schedules WHERE id = ?`, job2)).toEqual({ status: "complete" });

    const marked = await migratedDb();
    const person3 = seedPerson(marked);
    seedMirror(marked, { tag: parent, harvest: hbn, grams: 100 });
    await adoptFromMetrc(marked.db, formOf({ tag: parent, person_id: person3 }));
    const job3 = String(marked.get(`SELECT ps.id, ps.harvest_batch_id FROM production_schedules ps JOIN wip_packages p ON p.id = ps.wip_package_id WHERE p.package_code = ?`, parent)?.id);
    const batchId = String(marked.get(`SELECT harvest_batch_id FROM production_schedules WHERE id = ?`, job3)?.harvest_batch_id);
    await addPrepackLine(marked.db, job3, formOf({ person_id: person3, unit_grams: "3.5", bags: "2", tag: "1A4050300000000000000B41" }));
    await finishPrepack(marked.db, job3, formOf({ person_id: person3, push: "no" }));
    marked.run(
      `INSERT INTO metrc_uploads (id, kind, harvest_batch_id, filename, uploaded_at, ref_id, created_at, updated_at)
       VALUES ('up-p', 'package_finish', ?, 'package_finish_marked.csv', ?, ?, ?, ?)`,
      batchId,
      T0,
      job3,
      T0,
      T0
    );
    await expect(unfinishScheduleItem(marked.db, "prepack", job3, formOf({ person_id: person3, unfinish_pin: PIN }))).rejects.toThrow(/package_finish_marked.csv/);
    expect(marked.get(`SELECT status FROM wip_packages WHERE package_code = ?`, parent)).toEqual({ status: "packed" });
  });

  it("a wrong PIN refuses every unfinish and writes nothing", async () => {
    const m = await migratedDb();
    const person = await cryoFloor(m);
    await expect(unfinishScheduleItem(m.db, "cryo", "run-1", formOf({ person_id: person, unfinish_pin: "00000" }))).rejects.toThrow(/Admin PIN/);
    await expect(unfinishCryoContainer(m.db, "run-1", "in-1", formOf({ person_id: person }))).rejects.toThrow(/Admin PIN/);
    const outputId = String(m.get(`SELECT id FROM wip_packages WHERE package_code = ?`, TAG)?.id);
    await expect(unfinishCryoOutput(m.db, outputId, formOf({ person_id: person, unfinish_pin: "1" }))).rejects.toThrow(/Admin PIN/);
    expect(m.get(`SELECT status FROM production_schedules WHERE id = 'run-1'`)).toEqual({ status: "complete" });
    expect(m.get(`SELECT status FROM wip_packages WHERE id = 'c1'`)).toEqual({ status: "pasteurized" });
    expect(m.get(`SELECT deleted_at FROM wip_packages WHERE id = ?`, outputId)).toEqual({ deleted_at: null });
  });

  it("a finished run's page carries Unfinish on each consumed container and each output", () => {
    const html = cryoStationPage({
      runs: [],
      picked: {
        run: {
          id: "run-1",
          status: "complete",
          scheduled_at: T0,
          completed_at: T0,
          effective_date: null,
          harvest_batch_id: "hb-1",
          hbn: "26244-ARL-GH-027-0-NA-26011",
          entry_date: "2026-09-24",
          farm_code: "ARL",
          strain_name: "Fruity",
          containers: 1,
          in_grams: 100,
          outputs: 1,
          out_grams: 40,
        },
        pool: { lines: [] },
        outputs: [
          {
            id: "out-1",
            package_code: TAG,
            package_type_code: "BUD",
            weight_grams: 40,
            cryo_date: "2026-09-24",
            cryo_operator: "Austin",
            status: "testing_queue",
            created_at: T0,
          },
        ],
        inputs: [
          {
            id: "in-1",
            wip_package_id: "c1",
            package_type_code: "BUD",
            weight_grams: 100,
            wet_weight_entry_id: "lot-1",
            package_code: "BUD-1",
            status: "pasteurized",
          },
        ],
        categories: ["BUD"],
      },
      nowIso: T0,
    });
    expect(html).toContain('action="/station/cryo_weight/run/run-1/unfinish-container/in-1"');
    expect(html).toContain('action="/station/cryo_weight/run/run-1/unfinish-output/out-1"');
    expect(html).toContain('name="unfinish_pin"');
    expect(html).not.toContain('href="/record/wip_packages/out-1/void"');
  });
});
