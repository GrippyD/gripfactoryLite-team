import { describe, expect, it } from "vitest";
import { internalCheckKind } from "../src/compliance";
import { etWallClock } from "../src/farmday";
import {
  earliestByDue,
  fulfillFromInstruments,
  fulfillLabSample,
  intervalHours,
  intervalPage,
  labSamplePage,
  nextCheckDue,
  requestLabSample,
  returnLabSample,
  saveSiloCheckInterval,
  scheduleLabSample,
  testedAfterRequest,
  testedDayOf,
  unscheduleLabSample,
} from "../src/labsample";
import { formOf, migratedDb, seedBatch, seedLot, seedPerson } from "./migrated";

const LOADED = "2026-09-01T00:00:00.000Z";

describe("THE MAINTENANCE NODE schedule (canon 0.30.293)", () => {
  it("is quiet with no list, and the first interval is from the start of the silo", () => {
    expect(nextCheckDue({ loadedAt: LOADED, requestedAts: [], hours: [] })).toBeNull();
    expect(nextCheckDue({ loadedAt: LOADED, requestedAts: [], hours: [0] })).toEqual({
      checkNumber: 1,
      dueAt: LOADED,
    });
    expect(intervalHours([{ id: "a", value: "0", sort_order: 2 }, { id: "b", value: "24", sort_order: 1 }])).toEqual([24, 0]);
  });

  it("walks three intervals and repeats the last, and a paused clock does not move the due", () => {
    const hours = [0, 24, 48];
    const first = nextCheckDue({ loadedAt: LOADED, requestedAts: [], hours, pausedAt: "2026-09-02T00:00:00.000Z" });
    expect(first).toEqual({ checkNumber: 1, dueAt: LOADED });
    expect(nextCheckDue({ loadedAt: LOADED, requestedAts: [], hours })).toEqual(first);
    const second = nextCheckDue({ loadedAt: LOADED, requestedAts: ["2026-09-01T06:00:00.000Z"], hours });
    expect(second).toEqual({ checkNumber: 2, dueAt: "2026-09-02T06:00:00.000Z" });
    const third = nextCheckDue({
      loadedAt: LOADED,
      requestedAts: ["2026-09-01T06:00:00.000Z", "2026-09-02T06:00:00.000Z"],
      hours,
    });
    expect(third).toEqual({ checkNumber: 3, dueAt: "2026-09-04T06:00:00.000Z" });
    const fourth = nextCheckDue({
      loadedAt: LOADED,
      requestedAts: ["2026-09-01T06:00:00.000Z", "2026-09-02T06:00:00.000Z", "2026-09-04T06:00:00.000Z"],
      hours,
    });
    expect(fourth).toEqual({ checkNumber: 4, dueAt: "2026-09-06T06:00:00.000Z" });
  });

  it("picks the shortest remaining due across two lots", () => {
    const soon = { dueAt: "2026-09-02T00:00:00.000Z", lot: "26070" };
    const later = { dueAt: "2026-09-03T00:00:00.000Z", lot: "26071" };
    expect(earliestByDue([later, soon])).toEqual(soon);
  });

  it("reads an instrument's day and asks for the request's farm day or later", () => {
    expect(testedDayOf("2026-09-29")).toBe("2026-09-29");
    expect(testedDayOf("2026-09-29 10:15:22")).toBe("2026-09-29");
    expect(testedDayOf("2026-09-29T02:30:00.000Z")).toBe("2026-09-28");
    expect(testedDayOf("9/29/2026")).toBe("2026-09-29");
    expect(testedDayOf("9/29/2026 10:15 PM")).toBe("2026-09-29");
    expect(testedDayOf("unknown")).toBeNull();
    expect(testedDayOf("")).toBeNull();
    const requested = "2026-09-29T14:02:00.000Z";
    expect(testedAfterRequest("2026-09-29", requested)).toBe(true);
    expect(testedAfterRequest("2026-09-29 10:15:00", requested)).toBe(true);
    expect(testedAfterRequest("2026-09-30", requested)).toBe(true);
    expect(testedAfterRequest("2026-09-28", requested)).toBe(false);
    expect(testedAfterRequest("2026-09-29T02:30:00.000Z", requested)).toBe(false);
    expect(testedAfterRequest("unknown", requested)).toBe(false);
    expect(testedAfterRequest(null, requested)).toBe(false);
  });

  it("reads water activity and moisture content", () => {
    expect(internalCheckKind("water_activity")).toBe("aw");
    expect(internalCheckKind("Water Activity")).toBe("aw");
    expect(internalCheckKind("MC%")).toBe("mc");
    expect(internalCheckKind("moisture content")).toBe("mc");
    expect(internalCheckKind("potency")).toBeNull();
  });
});

describe("THE MAINTENANCE NODE panes (canon 0.30.293)", () => {
  it("schedules, requests, fulfills, returns, and logs each status", async () => {
    const m = await migratedDb();
    const person = seedPerson(m);
    seedBatch(m, { id: "hb-lab", hbn: "26260-PNN-GH-001-0-NA-26070", serial: 70, farm: "PNN" });
    seedLot(m, "lot-lab", "hb-lab", "drying");
    const space = m.get(`SELECT id FROM dry_spaces WHERE deleted_at IS NULL ORDER BY name LIMIT 1`);
    expect(space?.id).toBeTruthy();
    m.run(
      `INSERT INTO silo_loads (id, dry_space_id, wet_weight_entry_id, loaded_at, paused_seconds, created_at, updated_at)
       VALUES ('load-lab', ?, 'lot-lab', ?, 0, ?, ?)`,
      String(space?.id),
      LOADED,
      LOADED,
      LOADED
    );
    await saveSiloCheckInterval(m.db, formOf({ person_id: person, action: "add", kind: "aw", hours: "0" }));
    await saveSiloCheckInterval(m.db, formOf({ person_id: person, action: "add", kind: "aw", hours: "24" }));
    const page = await labSamplePage(m.db, "2026-09-02T00:00:00.000Z");
    expect(page).toContain('data-lab-pane="drying"');
    expect(page).toContain('data-kind="aw"');
    expect(page).toContain("aW check due");
    await scheduleLabSample(m.db, formOf({ person_id: person, silo_load_id: "load-lab", kind: "aw" }));
    const scheduled = await labSamplePage(m.db, "2026-09-02T00:00:00.000Z");
    expect(scheduled).toContain('data-lab-row="scheduled"');
    expect(scheduled).not.toContain('data-lab-row="drying" data-load="load-lab"');
    const id = m.get(`SELECT id FROM lab_sample_requests WHERE silo_load_id = 'load-lab' AND deleted_at IS NULL`)?.id;
    expect(id).toBeTruthy();
    await requestLabSample(m.db, formOf({ person_id: person, id: String(id) }));
    const requested = await labSamplePage(m.db, "2026-09-02T12:00:00.000Z");
    expect(requested).toContain('data-lab-row="requested"');
    expect(requested).toContain("requested at");
    const stampRow = m.get(`SELECT requested_at FROM lab_sample_requests WHERE id = ?`, String(id));
    const stamp = String(stampRow?.requested_at);
    expect(requested).toContain(`requested at ${etWallClock(stamp)}`);
    expect(requested).not.toContain(`requested at ${stamp.slice(0, 16).replace("T", " ")}`);
    await fulfillLabSample(m.db, formOf({ person_id: person, id: String(id), result_value: "0.55" }));
    const done = await labSamplePage(m.db, "2026-09-03T00:00:00.000Z");
    expect(done).toContain('data-lab-row="completed"');
    expect(done).toContain("0.55");
    const result = m.get(`SELECT source, analyte, value, hbn FROM internal_test_results WHERE source = 'lab_sample'`);
    expect(result).toMatchObject({ source: "lab_sample", analyte: "water activity", value: 0.55, hbn: "26260-PNN-GH-001-0-NA-26070" });
    const log = m.all(`SELECT new_value, reason FROM record_change_log WHERE record_table = 'lab_sample_requests' ORDER BY changed_at, new_value`);
    expect(log.map((row) => row.new_value)).toEqual(["scheduled", "requested", "fulfilled"]);
    await returnLabSample(m.db, formOf({ person_id: person, id: String(id) }));
    const back = await labSamplePage(m.db, "2026-09-03T00:00:00.000Z");
    expect(back).toContain('data-lab-row="requested"');
    expect(back).not.toContain('data-lab-row="completed"');
    const handRow = m.get(`SELECT deleted_at, delete_reason FROM internal_test_results WHERE source = 'lab_sample'`);
    expect(handRow?.delete_reason).toBe("returned");
    expect(handRow?.deleted_at).toBeTruthy();
    expect(await fulfillFromInstruments(m.db, "2026-09-03T00:00:00.000Z")).toBe(0);
    await fulfillLabSample(m.db, formOf({ person_id: person, id: String(id), result_value: "0.61" }));
    const live = m.all(`SELECT value FROM internal_test_results WHERE source = 'lab_sample' AND deleted_at IS NULL`);
    expect(live.map((row) => row.value)).toEqual([0.61]);
    await expect(unscheduleLabSample(m.db, formOf({ person_id: person, id: String(id) }))).rejects.toMatchObject({ status: 400 });
  });

  it("fulfills a request when an instrument result for the HBN lands after the stamp", async () => {
    const m = await migratedDb();
    const person = seedPerson(m);
    seedBatch(m, { id: "hb-lab2", hbn: "26261-PNN-GH-001-0-NA-26071", serial: 71, farm: "PNN" });
    seedLot(m, "lot-lab2", "hb-lab2", "drying");
    const space = m.get(`SELECT id FROM dry_spaces WHERE deleted_at IS NULL ORDER BY name LIMIT 1`);
    m.run(
      `INSERT INTO silo_loads (id, dry_space_id, wet_weight_entry_id, loaded_at, paused_seconds, created_at, updated_at)
       VALUES ('load-lab2', ?, 'lot-lab2', ?, 0, ?, ?)`,
      String(space?.id),
      LOADED,
      LOADED,
      LOADED
    );
    await saveSiloCheckInterval(m.db, formOf({ person_id: person, action: "add", kind: "mc", hours: "12" }));
    await scheduleLabSample(m.db, formOf({ person_id: person, silo_load_id: "load-lab2", kind: "mc" }));
    const id = String(m.get(`SELECT id FROM lab_sample_requests WHERE silo_load_id = 'load-lab2'`)?.id);
    await requestLabSample(m.db, formOf({ person_id: person, id }));
    const stamp = String(m.get(`SELECT requested_at FROM lab_sample_requests WHERE id = ?`, id)?.requested_at);
    const later = new Date(Date.parse(stamp) + 60_000).toISOString();
    m.run(
      `INSERT INTO internal_test_results (id, source, hbn, tested_at, analyte, value, unit, created_at, updated_at)
       VALUES ('inst-1', 'aqualab', '26261-PNN-GH-001-0-NA-26071', ?, 'moisture content', 11.5, '%', ?, ?)`,
      later,
      LOADED,
      LOADED
    );
    m.run(
      `INSERT INTO internal_test_results (id, source, hbn, tested_at, analyte, value, unit, created_at, updated_at)
       VALUES ('inst-0', 'aqualab', '26261-PNN-GH-001-0-NA-26071', 'unknown', 'moisture content', 9.5, '%', ?, ?)`,
      LOADED,
      LOADED
    );
    const n = await fulfillFromInstruments(m.db, "2026-09-03T01:00:00.000Z");
    expect(n).toBe(1);
    const row = m.get(`SELECT status, result_value, internal_test_result_id FROM lab_sample_requests WHERE id = ?`, id);
    expect(row).toMatchObject({ status: "fulfilled", result_value: 11.5, internal_test_result_id: "inst-1" });
  });

  it("renumbers an interval list on read and soft-deletes with removed", async () => {
    const m = await migratedDb();
    const person = seedPerson(m);
    await saveSiloCheckInterval(m.db, formOf({ person_id: person, action: "add", kind: "aw", hours: "0" }));
    await saveSiloCheckInterval(m.db, formOf({ person_id: person, action: "add", kind: "aw", hours: "48" }));
    const first = String(m.get(`SELECT id FROM lookup_values WHERE category = 'silo_check_interval_aw' AND value = '0'`)?.id);
    await saveSiloCheckInterval(m.db, formOf({ person_id: person, action: "remove", id: first }));
    const html = await intervalPage(m.db);
    expect(html).toContain("from the start of the silo");
    expect(html).toContain("Check 1");
    expect(html).toContain('data-interval-hours>48<');
    expect(html).not.toContain('data-interval-hours>0<');
    const gone = m.get(`SELECT delete_reason FROM lookup_values WHERE id = ?`, first);
    expect(gone?.delete_reason).toBe("removed");
  });
});
