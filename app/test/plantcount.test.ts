import { describe, expect, it } from "vitest";
import { HttpError } from "../src/audit";
import { saveFarmPlantCounts } from "../src/actions";
import { LOOKUP_LANDING } from "../src/lookups";
import { plantCountPage, plantCountYear } from "../src/pages";
import { formOf, migratedDb, seedPerson } from "./migrated";

describe("THE FARM PLANT COUNT (canon 0.30.288)", () => {
  it("defaults the harvest year to the farm day's year and lists one box per farm", () => {
    expect(plantCountYear(null, "2026-09-15")).toBe("2026");
    expect(plantCountYear("  ", "2027-01-02")).toBe("2027");
    expect(plantCountYear("2025", "2026-09-15")).toBe("2025");
    expect(plantCountYear("26", "2026-09-15")).toBe("2026");
    const harvest = LOOKUP_LANDING.find((s) => s.category === "Harvest Operations");
    const button = harvest?.buttons.find((b) => b.key === "plant_count");
    expect(button?.title).toBe("Farm Plant Count");
    expect(button?.href).toBe("/admin/lookups/plant_count");
    expect(button?.description).toBe(
      "One number per farm per harvest year: the denominator of Plants Remaining/Total on the console, never overridden by METRC."
    );
    const html = plantCountPage("2026", [
      { code: "PNN", name: "Penn North", count: 1000 },
      { code: "ARL", name: "Arlington", count: null },
    ]);
    expect(html).toContain("<h1>Farm Plant Count</h1>");
    expect(html).toContain('data-plant-count-year');
    expect(html).toContain('value="2026"');
    expect(html).toContain('data-plant-count-farm="PNN"');
    expect(html).toContain('name="count_PNN"');
    expect(html).toContain('value="1000"');
    expect(html).toContain('name="reason"');
  });

  it("saves a whole number, logs it, leaves a repeat alone, and soft-deletes a blank", async () => {
    const m = await migratedDb();
    const person = seedPerson(m);
    await expect(saveFarmPlantCounts(m.db, formOf({ person_id: person, reason: "count", harvest_year: "26", count_PNN: "1" }))).rejects.toThrow(
      "Harvest year must be a four-digit year."
    );
    await expect(saveFarmPlantCounts(m.db, formOf({ person_id: person, reason: "count", harvest_year: "2026", count_PNN: "1.5" }))).rejects.toThrow(
      "Plant count must be a whole number, zero or more."
    );
    await expect(saveFarmPlantCounts(m.db, formOf({ person_id: person, reason: "count", harvest_year: "2026", count_PNN: "-1" }))).rejects.toThrow(
      HttpError
    );
    const first = await saveFarmPlantCounts(
      m.db,
      formOf({ person_id: person, reason: "opening count", harvest_year: "2026", count_PNN: "1000", count_ARL: "300", count_PNS: "0" })
    );
    expect(first.redirect).toContain("/admin/lookups/plant_count?year=2026&ok=saved");
    const rows = m.all(
      `SELECT farm_code, plant_count FROM farm_plant_counts WHERE harvest_year = 2026 AND deleted_at IS NULL ORDER BY farm_code`
    );
    expect(rows).toEqual([
      { farm_code: "ARL", plant_count: 300 },
      { farm_code: "PNN", plant_count: 1000 },
      { farm_code: "PNS", plant_count: 0 },
    ]);
    const logs = () =>
      m.all(
        `SELECT record_table, field, old_value, new_value, reason FROM record_change_log WHERE record_table = 'farm_plant_counts' ORDER BY changed_at, record_id`
      );
    expect(logs()).toHaveLength(3);
    expect(logs().every((row) => row.field === "plant_count" && row.reason === "opening count" && row.old_value == null)).toBe(true);
    const before = m.get(`SELECT id, updated_at FROM farm_plant_counts WHERE farm_code = 'PNN' AND deleted_at IS NULL`) as {
      id: string;
      updated_at: string;
    };
    await saveFarmPlantCounts(
      m.db,
      formOf({ person_id: person, reason: "same count", harvest_year: "2026", count_PNN: "1000", count_ARL: "300", count_PNS: "0" })
    );
    expect(logs()).toHaveLength(3);
    const after = m.get(`SELECT id, updated_at FROM farm_plant_counts WHERE farm_code = 'PNN' AND deleted_at IS NULL`) as {
      id: string;
      updated_at: string;
    };
    expect(after).toEqual(before);
    await saveFarmPlantCounts(m.db, formOf({ person_id: person, reason: "farm left blank", harvest_year: "2026", count_PNN: "1000", count_PNS: "0" }));
    const gone = m.get(`SELECT deleted_at, delete_reason FROM farm_plant_counts WHERE farm_code = 'ARL' AND harvest_year = 2026`) as {
      deleted_at: string | null;
      delete_reason: string | null;
    };
    expect(gone.deleted_at).toBeTruthy();
    expect(gone.delete_reason).toBe("farm left blank");
    const blankLog = m.get(
      `SELECT old_value, new_value, reason FROM record_change_log WHERE record_table = 'farm_plant_counts' AND old_value = '300'`
    ) as { old_value: string; new_value: string | null; reason: string };
    expect(blankLog).toEqual({ old_value: "300", new_value: null, reason: "farm left blank" });
  });
});
