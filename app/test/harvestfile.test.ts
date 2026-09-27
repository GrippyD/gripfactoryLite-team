import { describe, expect, it } from "vitest";
import { acknowledgeChangedUpload, editRecord, finishLot, markUploaded, savePlantTags } from "../src/actions";
import { METRC_UPLOAD_KINDS } from "../src/config";
import { listChangedAfterUpload, listLoadPlantTags, listPendingLocationChangeUploads, listPendingPackageUploads, listPendingUploads, listWetWeightUploadReads } from "../src/db";
import { wetWeightsCsv, wetWeightsFilename } from "../src/csv";
import { pendingHarvestFile } from "../src/sheetsync";
import { locationChangeFilename } from "../src/interco";
import { pendingUploadsPage } from "../src/html";
import { stationByKey } from "../src/pipeline";
import { formOf, migratedDb, seedBatch, seedPerson, type MigratedDb } from "./migrated";

const SILO = "a1000001-0001-4000-8000-000000000001";
const FREEZER = "a1000001-0000-4000-8000-0000000000bf";
const HBN = "26244-ARL-GH-027-0-NA-26101";

function seedLoad(m: MigratedDb, id: string, batchId: string, at: string, grams = 1000, status = "weighing"): void {
  m.run(
    `INSERT INTO wet_weight_entries (
       id, harvest_batch_id, weight_grams, actual_dryspc, truck_number, status, effective_date, created_at, updated_at
     ) VALUES (?, ?, ?, ?, '4', ?, '2026-09-20', ?, ?)`,
    id,
    batchId,
    grams,
    SILO,
    status,
    at,
    at
  );
  m.run(
    `INSERT INTO wet_weights (id, wet_weight_entry_id, weight_grams, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`,
    `read-${id}`,
    id,
    grams,
    at,
    at
  );
}

describe("ONE HARVEST FILE PER LOAD (canon 0.30.249)", () => {
  it("numbers two loads of one HBN, pends each file alone, and flags a change after the mark", async () => {
    const m = await migratedDb();
    const person = seedPerson(m);
    const station = stationByKey("wet_weight");
    if (!station) throw new Error("wet station missing");
    seedBatch(m, { id: "hb", hbn: HBN, serial: 101 });
    seedLoad(m, "load-1", "hb", "2026-09-20T12:00:00.000Z", 1000);
    seedLoad(m, "load-2", "hb", "2026-09-20T13:00:00.000Z", 400);
    await finishLot(m.db, station, "load-1", formOf({ person_id: person, plant_count: "10" }));
    expect(m.get(`SELECT harvest_file_seq FROM wet_weight_entries WHERE id = 'load-1'`)?.harvest_file_seq).toBe(1);
    let pending = await listPendingUploads(m.db);
    expect(pending.map((row) => row.id)).toEqual(["load-1"]);
    expect(wetWeightsFilename(pending[0].hbn, pending[0].seq)).toBe(`${HBN}(1).csv`);
    await markUploaded(m.db, METRC_UPLOAD_KINDS.wet_weights, "load-1", formOf({ person_id: person }));
    await finishLot(m.db, station, "load-2", formOf({ person_id: person, plant_count: "4" }));
    expect(m.get(`SELECT harvest_file_seq FROM wet_weight_entries WHERE id = 'load-2'`)?.harvest_file_seq).toBe(2);
    pending = await listPendingUploads(m.db);
    expect(pending.map((row) => wetWeightsFilename(row.hbn, row.seq))).toEqual([`${HBN}(2).csv`]);
    m.run(`UPDATE wet_weight_entries SET weight_grams = 1100, updated_at = '2026-09-21T12:00:00.000Z' WHERE id = 'load-1'`);
    pending = await listPendingUploads(m.db);
    expect(pending.map((row) => row.id)).toEqual(["load-2"]);
    const changed = await listChangedAfterUpload(m.db);
    expect(changed).toHaveLength(1);
    expect(changed[0].then_grams).toBe(1000);
    expect(changed[0].now_grams).toBe(1100);
    await acknowledgeChangedUpload(m.db, "load-1", formOf({ person_id: person, reason: "fixed in METRC" }));
    expect(await listChangedAfterUpload(m.db)).toEqual([]);
    const ack = m.get(`SELECT reason FROM record_change_log WHERE record_id = 'load-1' AND field = 'harvest_file_ack'`);
    expect(ack?.reason).toBe("fixed in METRC");
    expect(await pendingHarvestFile(m.db, "hb", HBN)).toBe(`${HBN}(2).csv`);
  });

  it("a lone load is (1), tags stay on their load, and a marked file closes its box", async () => {
    const m = await migratedDb();
    const person = seedPerson(m);
    const station = stationByKey("wet_weight");
    if (!station) throw new Error("wet station missing");
    seedBatch(m, { id: "hb", hbn: HBN, serial: 102 });
    seedLoad(m, "only", "hb", "2026-09-20T12:00:00.000Z");
    await finishLot(m.db, station, "only", formOf({ person_id: person, plant_count: "2" }));
    expect(wetWeightsFilename(HBN, Number(m.get(`SELECT harvest_file_seq FROM wet_weight_entries WHERE id = 'only'`)?.harvest_file_seq))).toBe(`${HBN}(1).csv`);
    await savePlantTags(m.db, "only", formOf({ person_id: person, plant_tags: "TAG-A\nTAG-B" }));
    expect(await listLoadPlantTags(m.db, "only")).toEqual(["TAG-A", "TAG-B"]);
    seedLoad(m, "other", "hb", "2026-09-20T14:00:00.000Z", 200);
    await finishLot(m.db, station, "other", formOf({ person_id: person }));
    await expect(savePlantTags(m.db, "other", formOf({ person_id: person, plant_tags: "TAG-A" }))).rejects.toMatchObject({
      message: `That tag is already on ${HBN}(1).csv.`,
    });
    await markUploaded(m.db, METRC_UPLOAD_KINDS.wet_weights, "only", formOf({ person_id: person }));
    await expect(savePlantTags(m.db, "only", formOf({ person_id: person, plant_tags: "TAG-C" }))).rejects.toMatchObject({
      message: "That file is marked uploaded. Its tags are closed.",
    });
    const reads = await listWetWeightUploadReads(m.db, "hb", "only");
    const csv = wetWeightsCsv(reads);
    expect(csv).toContain("2026-09-20");
    m.run(`UPDATE wet_weight_entries SET updated_at = '2026-09-25T12:00:00.000Z' WHERE id = 'only'`);
    const again = wetWeightsCsv(await listWetWeightUploadReads(m.db, "hb", "only"));
    expect(again).toContain("2026-09-20");
    expect(again).not.toContain("2026-09-25");
  });

  it("keeps the number through a return to weighing, and takes the next number on another HBN", async () => {
    const m = await migratedDb();
    const person = seedPerson(m);
    const station = stationByKey("wet_weight");
    if (!station) throw new Error("wet station missing");
    seedBatch(m, { id: "hb", hbn: HBN, serial: 103 });
    seedBatch(m, { id: "hb2", hbn: "26244-ARL-GH-027-0-NA-26102", serial: 104 });
    seedLoad(m, "load-1", "hb", "2026-09-20T12:00:00.000Z");
    await finishLot(m.db, station, "load-1", formOf({ person_id: person }));
    m.run(`UPDATE wet_weight_entries SET status = 'weighing' WHERE id = 'load-1'`);
    await finishLot(m.db, station, "load-1", formOf({ person_id: person }));
    expect(m.get(`SELECT harvest_file_seq FROM wet_weight_entries WHERE id = 'load-1'`)?.harvest_file_seq).toBe(1);
    m.run(`UPDATE wet_weight_entries SET status = 'weighing' WHERE id = 'load-1'`);
    await editRecord(m.db, "wet_weight_entries", "load-1", formOf({ person_id: person, reason: "moved", harvest_batch_id: "hb2" }));
    expect(m.get(`SELECT harvest_batch_id, harvest_file_seq FROM wet_weight_entries WHERE id = 'load-1'`)).toMatchObject({
      harvest_batch_id: "hb2",
      harvest_file_seq: 1,
    });
  });

  it("a batch-level mark covers the loads that existed before it", async () => {
    const m = await migratedDb();
    seedBatch(m, { id: "hb", hbn: HBN, serial: 105 });
    seedLoad(m, "old", "hb", "2026-09-01T12:00:00.000Z", 500, "drying");
    m.run(
      `INSERT INTO metrc_uploads (
         id, kind, harvest_batch_id, filename, uploaded_at, ref_id, created_at, updated_at
       ) VALUES ('mark-old', 'wet_weights', 'hb', ?, '2026-09-10T00:00:00.000Z', NULL, '2026-09-10T00:00:00.000Z', '2026-09-10T00:00:00.000Z')`,
      `${HBN}.csv`
    );
    expect(await listPendingUploads(m.db)).toEqual([]);
    expect(await listChangedAfterUpload(m.db)).toEqual([]);
    seedLoad(m, "later", "hb", "2026-09-20T12:00:00.000Z", 200, "drying");
    const pending = await listPendingUploads(m.db);
    expect(pending.map((row) => row.id)).toEqual(["later"]);
  });

  it("backfills numbers in created order, tags on a one-load batch, and none on a two-load batch", async () => {
    const m = await migratedDb({ until: "0076" });
    seedBatch(m, { id: "one", hbn: HBN, serial: 106 });
    seedBatch(m, { id: "two", hbn: "26244-ARL-GH-027-0-NA-26103", serial: 107 });
    m.run(
      `INSERT INTO wet_weight_entries (id, harvest_batch_id, weight_grams, actual_dryspc, status, created_at, updated_at)
       VALUES ('a', 'one', 1, ?, 'drying', '2026-09-01T00:00:00.000Z', '2026-09-01T00:00:00.000Z'),
              ('b', 'two', 1, ?, 'drying', '2026-09-02T00:00:00.000Z', '2026-09-02T00:00:00.000Z'),
              ('c', 'two', 1, ?, 'drying', '2026-09-03T00:00:00.000Z', '2026-09-03T00:00:00.000Z')`,
      SILO,
      SILO,
      SILO
    );
    m.run(
      `INSERT INTO harvest_plant_tags (id, harvest_batch_id, tag, created_at, updated_at)
       VALUES ('t1', 'one', 'ONLY', '2026-09-01T00:00:00.000Z', '2026-09-01T00:00:00.000Z'),
              ('t2', 'two', 'SPLIT', '2026-09-02T00:00:00.000Z', '2026-09-02T00:00:00.000Z')`
    );
    await m.applyRest();
    expect(m.get(`SELECT harvest_file_seq FROM wet_weight_entries WHERE id = 'a'`)?.harvest_file_seq).toBe(1);
    expect(m.get(`SELECT harvest_file_seq FROM wet_weight_entries WHERE id = 'b'`)?.harvest_file_seq).toBe(1);
    expect(m.get(`SELECT harvest_file_seq FROM wet_weight_entries WHERE id = 'c'`)?.harvest_file_seq).toBe(2);
    expect(m.get(`SELECT wet_weight_entry_id FROM harvest_plant_tags WHERE id = 't1'`)?.wet_weight_entry_id).toBe("a");
    expect(m.get(`SELECT wet_weight_entry_id FROM harvest_plant_tags WHERE id = 't2'`)?.wet_weight_entry_id).toBeNull();
  });

  it("a load with no number reads as its rank, and a location row uses the METRC place", async () => {
    const m = await migratedDb();
    seedBatch(m, { id: "hb", hbn: HBN, serial: 108 });
    m.run(
      `INSERT INTO wet_weight_entries (id, harvest_batch_id, weight_grams, actual_dryspc, status, created_at, updated_at, deleted_at)
       VALUES ('gone', 'hb', 1, ?, 'drying', '2026-09-01T00:00:00.000Z', '2026-09-01T00:00:00.000Z', '2026-09-02T00:00:00.000Z'),
              ('live', 'hb', 10, ?, 'drying', '2026-09-03T00:00:00.000Z', '2026-09-03T00:00:00.000Z', NULL)`,
      SILO,
      FREEZER
    );
    const pending = await listPendingUploads(m.db);
    expect(pending.map((row) => row.seq)).toEqual([2]);
    expect(await pendingHarvestFile(m.db, "hb", HBN)).toBe(`${HBN}(2).csv`);
    m.run(
      `INSERT INTO silo_loads (id, dry_space_id, wet_weight_entry_id, loaded_at, paused_seconds, created_at, updated_at)
       VALUES ('sl', ?, 'live', '2026-09-20T12:00:00.000Z', 0, '2026-09-20T12:00:00.000Z', '2026-09-20T12:00:00.000Z')`,
      FREEZER
    );
    const loc = await listPendingLocationChangeUploads(m.db);
    expect(loc.map((row) => row.seq)).toEqual([2]);
    const page = pendingUploadsPage([], "en", [], [], [], [], loc);
    expect(page).toContain(`location_change_${HBN}(2)_Blast_Freezer_20260920.csv`);
    expect(page).not.toContain("Blast_Freezer_s");
    m.run(
      `INSERT INTO unload_sessions (id, wet_weight_entry_id, weigh_mode, finished_at, created_at, updated_at)
       VALUES ('us', 'live', 'bucked', '2026-09-21T12:00:00.000Z', '2026-09-21T12:00:00.000Z', '2026-09-21T12:00:00.000Z')`
    );
    const files = await listPendingPackageUploads(m.db);
    expect(files.map((row) => row.seq)).toEqual([2]);
    expect(pendingUploadsPage([], "en", files)).toContain(`package_adjustments_${HBN}(2).csv`);
  });

  it("saving a load's tags claims the same tags from the batch's unassigned rows", async () => {
    const m = await migratedDb();
    const person = seedPerson(m);
    seedBatch(m, { id: "hb", hbn: HBN, serial: 109 });
    seedLoad(m, "load-1", "hb", "2026-09-20T12:00:00.000Z", 100, "drying");
    m.run(
      `INSERT INTO harvest_plant_tags (id, harvest_batch_id, tag, created_at, updated_at)
       VALUES ('loose-a', 'hb', 'TAG-A', '2026-09-01T00:00:00.000Z', '2026-09-01T00:00:00.000Z'),
              ('loose-b', 'hb', 'TAG-B', '2026-09-01T00:00:00.000Z', '2026-09-01T00:00:00.000Z')`
    );
    await savePlantTags(m.db, "load-1", formOf({ person_id: person, plant_tags: "TAG-A" }));
    expect(m.get(`SELECT wet_weight_entry_id, deleted_at FROM harvest_plant_tags WHERE id = 'loose-a'`)).toMatchObject({
      wet_weight_entry_id: "load-1",
      deleted_at: null,
    });
    expect(m.get(`SELECT wet_weight_entry_id FROM harvest_plant_tags WHERE id = 'loose-b'`)?.wet_weight_entry_id).toBeNull();
    expect(m.get(`SELECT COUNT(*) AS n FROM harvest_plant_tags WHERE tag = 'TAG-A' AND deleted_at IS NULL`)?.n).toBe(1);
    const pending = await listPendingUploads(m.db);
    expect(pending[0].unassigned).toBe(1);
    expect(pending[0].tag_count).toBe(1);
  });

  it("names the location change and the unload files with the load number", () => {
    expect(locationChangeFilename(HBN, "Silo 1", "20260920", 2)).toBe(`location_change_${HBN}(2)_Silo_1_20260920.csv`);
    expect(`packages_from_harvests_${HBN}(2).csv`).toContain("(2)");
    expect(`package_adjustments_${HBN}(2).csv`).toContain("(2)");
  });
});
