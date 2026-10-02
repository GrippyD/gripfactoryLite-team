import { describe, expect, it } from "vitest";
import { listLinePackages } from "../src/db";
import { migratedDb, seedBatch, seedPerson } from "./migrated";

const EARLY = "2026-10-02T09:30:00.000Z";
const ON_DAY = "2026-10-02T14:00:00.000Z";

describe("THE LINE PACKAGES WINDOW (canon 0.30.344)", () => {
  it("reads the day from the start time, the operator case-blind, and leaves an unstarted Rad run off", async () => {
    const m = await migratedDb();
    const person = seedPerson(m, "person-line");
    seedBatch(m, { id: "hb-line", hbn: "26202-ARL-GH-001-0-NA-26002", serial: 26002 });
    m.run(
      `INSERT INTO wip_packages (
        id, package_code, package_type_code, weight_grams, status, created_at, updated_at,
        trim_date, trim_operator, source, harvest_batch_id
      ) VALUES ('pkg-early', 'BUD-EARLY', 'BUD', 448, 'testing_queue', ?, ?, '2026-10-01', 'Les', 'trim', 'hb-line')`,
      EARLY,
      EARLY
    );
    m.run(
      `INSERT INTO wip_packages (
        id, package_code, package_type_code, weight_grams, status, created_at, updated_at,
        trim_date, trim_operator, source, harvest_batch_id
      ) VALUES ('pkg-day', 'TRIM-DAY', 'TRIM', 100, 'testing_queue', ?, ?, '2026-10-02', 'Other', 'trim', 'hb-line')`,
      ON_DAY,
      ON_DAY
    );
    m.run(
      `INSERT INTO prepack_lines (
        id, job_id, parent_package_id, unit_grams, bags, grams, tag, work_date, created_at, created_by, updated_at
      ) VALUES ('line-1', 'job-1', 'pkg-day', 28, 2, 56, 'BAG-1', '2026-10-02', ?, ?, ?)`,
      ON_DAY,
      person,
      ON_DAY
    );
    m.run(
      `INSERT INTO rad_runs (id, status, grey, scheduled_at, started_at, started_by, created_at, updated_at)
       VALUES ('run-off', 'scheduled', 1500, ?, NULL, NULL, ?, ?),
              ('run-on', 'running', 1500, ?, ?, ?, ?, ?)`,
      ON_DAY,
      ON_DAY,
      ON_DAY,
      ON_DAY,
      ON_DAY,
      person,
      ON_DAY,
      ON_DAY
    );
    m.run(
      `INSERT INTO rad_run_packages (id, run_id, tag, item_type, grams, position, created_at)
       VALUES ('rad-off', 'run-off', '1A4000000000000000000AAA', 'WPR', 10, 1, ?),
              ('rad-on', 'run-on', '1A4000000000000000000BBB', 'WPR', 20, 1, ?)`,
      ON_DAY,
      ON_DAY
    );

    const before = await listLinePackages(m.db, { startIso: "2026-10-02T10:00:00.000Z", endIso: "2026-10-03T10:00:00.000Z", line: "all", operator: "" });
    expect(before.map((row) => row.tag).sort()).toEqual(["1A4000000000000000000BBB", "BAG-1", "TRIM-DAY"]);
    expect(before.find((row) => row.tag === "BUD-EARLY")).toBeUndefined();
    const dayBefore = await listLinePackages(m.db, { startIso: "2026-10-01T10:00:00.000Z", endIso: "2026-10-02T10:00:00.000Z", line: "trim", operator: "" });
    expect(dayBefore.map((row) => row.tag)).toEqual(["BUD-EARLY"]);
    expect(dayBefore[0]?.lot).toBe("26002");
    const earlyStart = await listLinePackages(m.db, { startIso: "2026-10-02T09:00:00.000Z", endIso: "2026-10-03T09:00:00.000Z", line: "trim", operator: "les" });
    expect(earlyStart.map((row) => row.tag)).toEqual(["BUD-EARLY"]);
    const prepack = before.find((row) => row.tag === "BAG-1");
    expect(prepack?.line).toBe("Prepack");
    expect(prepack?.type).toBe("28 g x 2");
    expect(prepack?.operator).toBe("Smoke Hand");
    const rad = before.find((row) => row.tag === "1A4000000000000000000BBB");
    expect(rad?.line).toBe("Rad");
    expect(rad?.type).toBe("WPR, 1500 Gy");
    expect(rad?.operator).toBe("Smoke Hand");
    expect(before.some((row) => row.tag.endsWith("AAA"))).toBe(false);
  });
});