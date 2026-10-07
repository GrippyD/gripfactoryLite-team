import { describe, expect, it } from "vitest";
import { finishLot } from "../src/actions";
import { t } from "../src/i18n";
import {
  ASSIGN_PLANT_COUNTS_REASON,
  assignPlantCount,
  listAssignedLots,
  listUncountedLots,
  plantCountFieldValue,
  plantCountPage,
  plantCountState,
  shownPlantCounts,
} from "../src/plantcounts";
import { opsGroupByKey, stationByKey } from "../src/pipeline";
import { themeStylesheet } from "../src/theme";
import { formOf, migratedDb, seedBatch, seedPerson } from "./migrated";

const SILO = "a1000001-0001-4000-8000-000000000001";
const YEAR = 2026;

function seedEntry(
  m: Awaited<ReturnType<typeof migratedDb>>,
  id: string,
  batchId: string,
  status: string,
  day: string,
  at: string
): void {
  m.run(
    `INSERT INTO wet_weight_entries (id, harvest_batch_id, weight_grams, actual_dryspc, status, effective_date, created_at, updated_at)
     VALUES (?, ?, 1000, ?, ?, ?, ?, ?)`,
    id,
    batchId,
    SILO,
    status,
    day,
    at,
    at
  );
  m.run(
    `INSERT INTO wet_weights (id, wet_weight_entry_id, weight_grams, created_at, updated_at) VALUES (?, ?, 1000, ?, ?)`,
    `read-${id}`,
    id,
    at,
    at
  );
}

describe("Assign Plant Counts (canon 0.30.416)", () => {
  it("sits in Harvest Operations after Penn South/Arlington Harvest, in both languages", () => {
    const members = opsGroupByKey("harvest_ops")?.members.map((member) => member.key) ?? [];
    expect(members).toEqual(["acquire_hbn", "wet_weight", "field_harvest", "assign_plant_counts"]);
    expect(opsGroupByKey("harvest_ops")?.members.at(-1)?.href).toBe("/station/assign_plant_counts");
    expect(t("es", "Assign Plant Counts")).toBe("Asignar conteo de plantas");
  });

  it("lists only live lots of the year with no count, both entries of one batch, a weighing lot marked", async () => {
    const m = await migratedDb();
    seedBatch(m, { id: "hb-two", hbn: "26260-PNS-GH-027-0-NA-26091", serial: 91, farm: "PNS" });
    seedBatch(m, { id: "hb-old", hbn: "26240-ARL-GH-027-0-NA-26010", serial: 10, farm: "ARL" });
    seedBatch(m, { id: "hb-other", hbn: "25200-PNN-GH-027-0-NA-25001", serial: 1, farm: "PNN" });
    seedBatch(m, { id: "hb-gone", hbn: "26250-PNS-GH-027-0-NA-26020", serial: 20, farm: "PNS" });
    seedEntry(m, "dry", "hb-two", "drying", "2026-09-08", "2026-09-08T16:00:00.000Z");
    seedEntry(m, "weigh", "hb-two", "weighing", "2026-09-08", "2026-09-08T18:00:00.000Z");
    seedEntry(m, "older", "hb-old", "drying", "2026-09-01", "2026-09-01T12:00:00.000Z");
    seedEntry(m, "last-year", "hb-other", "drying", "2025-09-01", "2025-09-01T12:00:00.000Z");
    m.run(`UPDATE harvest_batches SET harvest_year = 2025 WHERE id = 'hb-other'`);
    seedEntry(m, "voided", "hb-gone", "drying", "2026-09-02", "2026-09-02T12:00:00.000Z");
    m.run(`UPDATE wet_weight_entries SET deleted_at = '2026-09-03T12:00:00.000Z' WHERE id = 'voided'`);
    seedEntry(m, "batch-void", "hb-gone", "drying", "2026-09-02", "2026-09-02T13:00:00.000Z");
    m.run(`UPDATE harvest_batches SET deleted_at = '2026-09-03T12:00:00.000Z' WHERE id = 'hb-gone'`);
    const rows = await listUncountedLots(m.db, YEAR);
    expect(rows.map((row) => row.id)).toEqual(["older", "dry", "weigh"]);
    expect(rows.filter((row) => row.lot === "26091").map((row) => row.id)).toEqual(["dry", "weigh"]);
    expect(plantCountState("weighing")).toBe("still weighing");
    const page = plantCountPage({ locale: "en", uncounted: rows, assigned: [], editId: "", typed: null });
    expect(page).toContain('data-plant-state="still weighing"');
    expect(page).toContain('data-plant-state="drying"');
    expect(page).not.toContain("last-year");
    expect(page).not.toContain("voided");
  });

  it(">> writes and logs, a bad count writes nothing, << fills the field and a resave logs old and new", async () => {
    const m = await migratedDb();
    const person = seedPerson(m);
    seedBatch(m, { id: "hb", hbn: "26260-PNS-GH-027-0-NA-26091", serial: 91, farm: "PNS" });
    seedEntry(m, "lot", "hb", "drying", "2026-09-08", "2026-09-08T16:00:00.000Z");
    await expect(assignPlantCount(m.db, formOf({ person_id: person, entry_id: "lot", plant_count: "abc" }), YEAR)).rejects.toMatchObject({
      message: "Plant count must be a whole number of plants, one or more.",
    });
    expect(m.get(`SELECT plant_count FROM wet_weight_entries WHERE id = 'lot'`)?.plant_count).toBeNull();
    expect(m.all(`SELECT id FROM record_change_log WHERE record_id = 'lot' AND field = 'plant_count'`)).toEqual([]);
    const saved = await assignPlantCount(m.db, formOf({ person_id: person, entry_id: "lot", plant_count: "1,412" }), YEAR);
    expect(saved.redirect).toBe("/station/assign_plant_counts");
    expect(m.get(`SELECT plant_count FROM wet_weight_entries WHERE id = 'lot'`)?.plant_count).toBe(1412);
    const first = m.get(
      `SELECT field, old_value, new_value, reason FROM record_change_log WHERE record_id = 'lot' AND field = 'plant_count'`
    );
    expect(first).toMatchObject({ field: "plant_count", old_value: null, new_value: "1412", reason: ASSIGN_PLANT_COUNTS_REASON });
    const assigned = await listAssignedLots(m.db);
    expect(assigned.map((row) => row.id)).toEqual(["lot"]);
    expect(await listUncountedLots(m.db, YEAR)).toEqual([]);
    const pulled = shownPlantCounts([], assigned, "lot");
    expect(pulled.left.map((row) => row.id)).toEqual(["lot"]);
    expect(pulled.right).toEqual([]);
    expect(plantCountFieldValue(pulled.left, "lot", null)).toBe("1412");
    expect(m.get(`SELECT plant_count FROM wet_weight_entries WHERE id = 'lot'`)?.plant_count).toBe(1412);
    const page = plantCountPage({ locale: "en", uncounted: [], assigned, editId: "lot", typed: null });
    expect(page).toContain('value="1412"');
    expect(page).toContain('data-plant-pane="none"');
    expect(page).not.toContain("data-plant-assigned");
    await assignPlantCount(m.db, formOf({ person_id: person, entry_id: "lot", plant_count: "415" }), YEAR);
    const logs = m.all(
      `SELECT old_value, new_value, reason FROM record_change_log WHERE record_id = 'lot' AND field = 'plant_count'`
    );
    expect(logs).toEqual(
      expect.arrayContaining([
        { old_value: null, new_value: "1412", reason: ASSIGN_PLANT_COUNTS_REASON },
        { old_value: "1412", new_value: "415", reason: ASSIGN_PLANT_COUNTS_REASON },
      ])
    );
    expect(logs).toHaveLength(2);
    const again = await listAssignedLots(m.db);
    expect(again.map((row) => row.plantCount)).toEqual([415]);
    expect(again[0].who).toBe("Smoke Hand");
    const right = plantCountPage({ locale: "en", uncounted: [], assigned: again, editId: "", typed: null });
    expect(right).toContain('data-plant-assigned="lot"');
    expect(right).toContain("415");
    expect(right).toContain("Smoke Hand");
    const refused = plantCountPage({ locale: "en", uncounted: [], assigned: again, editId: "lot", typed: "abc" });
    expect(refused).toContain('value="abc"');
  });

  it("the right pane is only lots given a count here, and a count typed at finish leaves the left pane", async () => {
    const m = await migratedDb();
    const person = seedPerson(m);
    const station = stationByKey("wet_weight");
    if (!station) throw new Error("wet station missing");
    seedBatch(m, { id: "hb-here", hbn: "26260-PNS-GH-027-0-NA-26030", serial: 30, farm: "PNS" });
    seedBatch(m, { id: "hb-finish", hbn: "26260-ARL-GH-027-0-NA-26031", serial: 31, farm: "ARL" });
    seedBatch(m, { id: "hb-skip", hbn: "26260-ARL-GH-027-0-NA-26032", serial: 32, farm: "ARL" });
    seedEntry(m, "here", "hb-here", "drying", "2026-09-04", "2026-09-04T12:00:00.000Z");
    seedEntry(m, "finished", "hb-finish", "weighing", "2026-09-05", "2026-09-05T12:00:00.000Z");
    seedEntry(m, "skipped", "hb-skip", "weighing", "2026-09-06", "2026-09-06T12:00:00.000Z");
    await assignPlantCount(m.db, formOf({ person_id: person, entry_id: "here", plant_count: "20" }), YEAR);
    await finishLot(m.db, station, "finished", formOf({ person_id: person, plant_count: "9" }));
    await finishLot(m.db, station, "skipped", formOf({ person_id: person, plant_prompt: "skip" }));
    expect((await listUncountedLots(m.db, YEAR)).map((row) => row.id)).toEqual(["skipped"]);
    expect((await listAssignedLots(m.db)).map((row) => row.id)).toEqual(["here"]);
    const page = plantCountPage({
      locale: "es",
      uncounted: await listUncountedLots(m.db, YEAR),
      assigned: await listAssignedLots(m.db),
      editId: "",
      typed: null,
    });
    expect(page).toContain("Asignar conteo de plantas");
    expect(page).toContain("Sin conteo de plantas");
    expect(page).toContain("Asignados");
    expect(page).toContain('data-plant-entry="skipped"');
    expect(page).not.toContain('data-plant-entry="finished"');
  });

  it("stacks the panes on a phone and makes the buttons full width, in every view", () => {
    for (const view of ["lite", "co", "cerberus"] as const) {
      const css = themeStylesheet(view);
      expect(css).toContain("body.device-phone .plant-panes { flex-direction: column; }");
      expect(css).toContain("body.device-phone .plant-panes .plant-count-btn { width: 100%;");
    }
  });
});
