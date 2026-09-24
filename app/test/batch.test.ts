import { describe, expect, it } from "vitest";
import { markCheckedUploaded, voidCheckedQueueRows } from "../src/actions";
import { formOf, migratedDb, seedBatch, seedPerson } from "./migrated";

describe("THE CHECK-ALL (canon 0.30.212)", () => {
  it("voids two rows under one reason and refuses the whole batch when one row is refused", async () => {
    const m = await migratedDb();
    const person = seedPerson(m);
    seedBatch(m, { id: "hb-a", hbn: "26260-PNN-GH-001-0-NA-26010", serial: 10 });
    seedBatch(m, { id: "hb-b", hbn: "26261-PNN-GH-001-0-NA-26011", serial: 11 });
    const form = new FormData();
    form.set("person_id", person);
    form.set("reason", "one reason");
    form.append("id", "hb-a");
    form.append("id", "hb-b");
    const both = await voidCheckedQueueRows(m.db, "hbn_queue", form);
    expect(both.redirect).toBe("/admin/queues?ok=voided&n=2");
    expect(m.get(`SELECT deleted_at IS NOT NULL AS gone FROM harvest_batches WHERE id = 'hb-a'`)).toEqual({ gone: 1 });
    expect(m.get(`SELECT deleted_at IS NOT NULL AS gone FROM harvest_batches WHERE id = 'hb-b'`)).toEqual({ gone: 1 });
    const logs = m.all(`SELECT record_id, reason FROM record_change_log WHERE field = 'deleted_at' AND record_id IN ('hb-a', 'hb-b') ORDER BY record_id`);
    expect(logs).toEqual([
      { record_id: "hb-a", reason: "one reason" },
      { record_id: "hb-b", reason: "one reason" },
    ]);
    seedBatch(m, { id: "hb-c", hbn: "26262-PNN-GH-001-0-NA-26012", serial: 12 });
    const bad = new FormData();
    bad.set("person_id", person);
    bad.set("reason", "should not land");
    bad.append("id", "hb-c");
    bad.append("id", "missing-row");
    await expect(voidCheckedQueueRows(m.db, "hbn_queue", bad)).rejects.toMatchObject({ message: expect.stringContaining("missing-row") });
    expect(m.get(`SELECT deleted_at FROM harvest_batches WHERE id = 'hb-c'`)).toEqual({ deleted_at: null });
    await expect(voidCheckedQueueRows(m.db, "hbn_queue", formOf({ person_id: person, reason: "none" }))).rejects.toMatchObject({
      message: "Nothing checked.",
    });
  });

  it("marks two files of different kinds uploaded and never sets cleared", async () => {
    const m = await migratedDb();
    const person = seedPerson(m);
    seedBatch(m, { id: "hb-w", hbn: "26260-PNN-GH-001-0-NA-26020", serial: 20 });
    m.run(
      `INSERT INTO local_inventory_items (
         id, package_code, qty, location, license_value, harvest_batch_id, item_kind, farm_code, created_at, updated_at
       ) VALUES ('item-1', '1A4050300000000000000B01', 10, 'Vault', 'AU-G-C-000832', 'hb-w', 'WIP', 'PNN', '2026-09-23T00:00:00.000Z', '2026-09-23T00:00:00.000Z')`
    );
    const form = new FormData();
    form.set("person_id", person);
    form.append("item", "wet_weights:hb-w");
    form.append("item", "package_split:item-1");
    const done = await markCheckedUploaded(m.db, form);
    expect(done.redirect).toBe("/admin/uploads?ok=uploaded&n=2");
    const rows = m.all(`SELECT kind, ref_id, cleared FROM metrc_uploads ORDER BY kind`);
    expect(rows).toEqual([
      { kind: "package_split", ref_id: "item-1", cleared: 0 },
      { kind: "wet_weights", ref_id: null, cleared: 0 },
    ]);
  });
});
