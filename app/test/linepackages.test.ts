import { describe, expect, it } from "vitest";
import { listLinePackages } from "../src/db";
import { linePackagesView } from "../src/reports";
import { migratedDb, seedBatch, seedMirror, seedPerson } from "./migrated";

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
    expect(before.every((row) => row.harvestLast6 === "")).toBe(true);
  });
});

describe("LINE PACKAGES, LAST 6 OF HARVEST PACKAGE (canon 0.30.403)", () => {
  const START = "2026-10-02T10:00:00.000Z";
  const END = "2026-10-03T10:00:00.000Z";
  const ON = "2026-10-02T14:00:00.000Z";
  const BEFORE = "2026-10-02T09:30:00.000Z";

  function trimPkg(m: Awaited<ReturnType<typeof migratedDb>>, id: string, code: string, operator: string, at: string): void {
    m.run(
      `INSERT INTO wip_packages (
        id, package_code, package_type_code, weight_grams, status, created_at, updated_at,
        trim_date, trim_operator, source, harvest_batch_id
      ) VALUES (?, ?, 'TRIM', 100, 'testing_queue', ?, ?, '2026-10-02', ?, 'trim', 'hb-h6')`,
      id,
      code,
      at,
      at,
      operator
    );
  }

  async function listed(
    m: Awaited<ReturnType<typeof migratedDb>>,
    over: { startIso?: string; endIso?: string; line?: string; operator?: string; harvestLast6?: string } = {}
  ) {
    return listLinePackages(m.db, {
      startIso: over.startIso ?? START,
      endIso: over.endIso ?? END,
      line: over.line ?? "all",
      operator: over.operator ?? "",
      harvestLast6: over.harvestLast6 ?? "",
    });
  }

  it("finds a trim row from its code and a prepack row from its parent, and leaves Cryo, Rad, a doubled tail and a miss with none", async () => {
    const m = await migratedDb();
    const person = seedPerson(m, "person-h6");
    seedBatch(m, { id: "hb-h6", hbn: "26202-ARL-GH-001-0-NA-26102", serial: 26102 });
    seedMirror(m, { tag: "1A40503000311FB000056838", gone: "2026-10-01T00:00:00.000Z" });
    seedMirror(m, { tag: "1A40503000311FB000011111" });
    seedMirror(m, { tag: "1A40503000311FB000A11111" });
    seedMirror(m, { tag: "1A40503000311FB000A56839" });
    seedMirror(m, { tag: "1A40503000311FB000044444" });
    seedMirror(m, { tag: "1A40503000311FB000077777" });
    seedMirror(m, { tag: "1A40503000311FB000088888" });
    seedMirror(m, { tag: "1A40503000311FB000099999" });
    seedMirror(m, { tag: "1A40503000311FB000012121" });
    trimPkg(m, "pkg-56838", "56838", "Les", ON);
    trimPkg(m, "pkg-11111", "11111", "Les", ON);
    trimPkg(m, "pkg-22222", "22222", "Les", ON);
    trimPkg(m, "pkg-six", "056838", "Les", ON);
    trimPkg(m, "pkg-letter", "56839", "Les", ON);
    trimPkg(m, "pkg-other", "44444", "Other", ON);
    trimPkg(m, "pkg-parent", "77777", "Les", BEFORE);
    trimPkg(m, "pkg-early", "12121", "Les", BEFORE);
    m.run(
      `INSERT INTO wip_packages (
        id, package_code, package_type_code, weight_grams, status, created_at, updated_at, source, harvest_batch_id
      ) VALUES ('pkg-cryo-h', '88888', 'BUD', 30, 'testing_queue', ?, ?, 'cryo', 'hb-h6')`,
      ON,
      ON
    );
    m.run(
      `INSERT INTO prepack_lines (
        id, job_id, parent_package_id, unit_grams, bags, grams, tag, work_date, created_at, created_by, updated_at
      ) VALUES ('line-h', 'job-h', 'pkg-parent', 28, 2, 56, 'BAG-H', '2026-10-02', ?, ?, ?)`,
      ON,
      person,
      ON
    );
    m.run(
      `INSERT INTO rad_runs (id, status, grey, scheduled_at, started_at, started_by, created_at, updated_at)
       VALUES ('run-h', 'running', 1500, ?, ?, ?, ?, ?)`,
      ON,
      ON,
      person,
      ON,
      ON
    );
    m.run(
      `INSERT INTO rad_run_packages (id, run_id, tag, item_type, grams, position, created_at)
       VALUES ('rad-h', 'run-h', '1A40503000311FB000099999', 'WPR', 20, 1, ?)`,
      ON
    );

    const all = await listed(m);
    const harvest = new Map(all.map((row) => [row.tag, row.harvestLast6]));
    expect(harvest.get("56838")).toBe("056838");
    expect(harvest.get("BAG-H")).toBe("077777");
    expect(harvest.get("88888")).toBe("");
    expect(harvest.get("1A40503000311FB000099999")).toBe("");
    expect(harvest.get("11111")).toBe("");
    expect(harvest.get("22222")).toBe("");
    expect(harvest.get("056838")).toBe("");
    expect(harvest.get("56839")).toBe("A56839");
    expect(all.map((row) => row.tag).sort()).toEqual(
      ["056838", "11111", "1A40503000311FB000099999", "22222", "44444", "56838", "56839", "88888", "BAG-H"].sort()
    );
    expect(all.some((row) => row.tag === "12121" || row.tag === "77777")).toBe(false);

    const spaced = await listed(m, { harvestLast6: " 056838 " });
    expect(spaced.map((row) => row.tag)).toEqual(["56838"]);
    const exact = await listed(m, { harvestLast6: "056838" });
    expect(exact.map((row) => row.tag)).toEqual(["56838"]);
    for (const text of ["56838", "0568380", "O56838", "a56839"]) {
      expect(await listed(m, { harvestLast6: text }), text).toEqual([]);
    }
    expect((await listed(m, { harvestLast6: "A56839" })).map((row) => row.tag)).toEqual(["56839"]);
    expect(await listed(m, { operator: "other", harvestLast6: "056838" })).toEqual([]);
    expect((await listed(m, { operator: "les", harvestLast6: "056838" })).map((row) => row.tag)).toEqual(["56838"]);
    expect(await listed(m, { line: "cryo_rad", harvestLast6: "056838" })).toEqual([]);
    expect((await listed(m, { line: "prepack", harvestLast6: "077777" })).map((row) => row.tag)).toEqual(["BAG-H"]);
    const early = await listed(m, { startIso: "2026-10-02T09:00:00.000Z", endIso: START, harvestLast6: "012121" });
    expect(early.map((row) => row.tag)).toEqual(["12121"]);

    const matched = linePackagesView(exact, { budCodes: ["BUD"], startWarned: false, startUsed: "06:00" });
    expect(matched.footnote).toContain("Trim: 1 packages");
    expect(matched.footnote).not.toContain("Prepack:");
    expect(matched.rows.find((row) => row.tag === "56838")?.harvest).toBe("056838");
    const open = linePackagesView(all, { budCodes: ["BUD"], startWarned: false, startUsed: "06:00" });
    expect(open.footnote).toContain("Trim: 6 packages");
    expect(open.footnote).toContain("Prepack: 1 packages");
    expect(open.footnote).toContain("Cryo: 1 packages");
    expect(open.footnote).toContain("Rad: 1 packages");
    const none = linePackagesView([], {
      budCodes: [],
      startWarned: false,
      startUsed: "06:00",
      harvestLast6: "56838",
    });
    expect(none.empty).toBe("No harvest package ends in 56838. Type all six characters.");
    expect(none.footnote).toBeUndefined();
  });
});
