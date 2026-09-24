import { describe, expect, it } from "vitest";
import { assignAttempts, landInTestingRows, outcomeOf, panelOf, parseAliasList, rowsFromSheet, runInTestingSync, type InTestingRow } from "../src/intesting";
import { readXlsbSheets, writeXlsb } from "../src/xlsb";

const HEADER = [
  "License Number",
  "Med/AU",
  "Strain",
  "Item Name",
  "Source Metrc Tag",
  "Batch Weight (grams)",
  "Harvest Batch Name",
  "Sample Tag",
  "Required Test",
  "Net Weight (grams)",
  "Testing Facility",
  "Entered Testing",
  "Finished testing",
  "THC Potency %",
  "Testing Status",
  "Fail Reason",
  "Notes",
];

function row(partial: Partial<InTestingRow> & Pick<InTestingRow, "rowNumber">): InTestingRow {
  return {
    tab: "In Testing",
    license_number: null,
    med_au: "AU",
    strain: "Chem",
    item_name: "BUD",
    source_metrc_tag: "1A40503000311FB000041597",
    batch_weight_grams: 100,
    hbn: "26001-ARL-GH-001-0-NA-26001",
    sample_tag: `1A40503000311FB0000${String(partial.rowNumber).padStart(5, "0")}`,
    required_test: "Full Compliance",
    net_weight_grams: 14,
    testing_facility: "ACT",
    entered_testing: "2026-09-01",
    finished_testing: "2026-09-02",
    potency: 10,
    status: "Passed",
    failure_mode: null,
    notes: null,
    panel: "full_compliance",
    attempt: 1,
    sheetKey: "",
    ...partial,
  };
}

describe("the in testing sheet", () => {
  it("maps headers, status words, labs, and fail types", async () => {
    expect(panelOf("In Testing", "Full Compliance", "R&D")).toBe("full_compliance");
    expect(panelOf("In Testing", "Potency", "R&D")).toBe("potency");
    expect(panelOf("R&D", "Full Panel R&D", "R&D")).toBe("rnd");
    expect(panelOf("In Testing", "Terpenes", "R&D")).toBeNull();
    expect(outcomeOf("Passed - Retest")).toBe("passed");
    expect(outcomeOf("Fail")).toBe("failed");
    expect(outcomeOf("In Testing")).toBe("open");
    const labs = parseAliasList("ACT=act-laboratories; SC Labs=sc-labs-michigan");
    expect(labs.get("act")).toBe("act-laboratories");
    const fails = parseAliasList("Coliforms=microbials; Mystery=other");
    expect(fails.get("coliforms")).toBe("microbials");
    const bytes = writeXlsb([{ name: "In Testing", rows: [HEADER, ["AU-G-C-000832", "AU", "Chem 51", "BUD", "1A40503000311FB000041597", 114.08, "46223-ARL-GH-015-0-NA-26001", "1A40503000311FB000051239", "Full Compliance", 14, "ACT", 46244, "2026-09-05", 18.65, "Passed", "", ""]] }]);
    const grid = (await readXlsbSheets(bytes)).get("In Testing") ?? [];
    const parsed = rowsFromSheet("In Testing", grid, "R&D");
    expect(parsed.missing).toBeNull();
    expect(parsed.rows[0]).toMatchObject({
      strain: "Chem 51",
      batch_weight_grams: 114,
      sample_tag: "1A40503000311FB000051239",
      panel: "full_compliance",
      entered_testing: "2026-08-10",
    });
    const broken = rowsFromSheet("In Testing", [{ row: 0, cells: ["Strain"] }], "R&D");
    expect(broken.missing).toBe("License Number");
  });

  it("numbers attempts by source tag and panel, and keeps a dropped key", () => {
    const first = row({ rowNumber: 2, entered_testing: "2026-09-02", sample_tag: "1A40503000311FB0000000A2" });
    const earlier = row({ rowNumber: 3, entered_testing: "2026-09-01", sample_tag: "1A40503000311FB0000000A1" });
    const potency = row({ rowNumber: 4, required_test: "Potency", panel: "potency", sample_tag: "1A40503000311FB0000000A3" });
    const alone = row({ rowNumber: 5, source_metrc_tag: null, sample_tag: "1A40503000311FB0000000A4" });
    assignAttempts([first, earlier, potency, alone]);
    expect(earlier.attempt).toBe(1);
    expect(first.attempt).toBe(2);
    expect(potency.attempt).toBe(1);
    expect(alone.attempt).toBe(1);
    expect(first.sheetKey).toBe("In Testing|1A40503000311FB0000000A2|2");
    expect(alone.sheetKey).toBe("In Testing|1A40503000311FB0000000A4|1");
  });

  it("lets the sheet win, leaves a manual row, and marks a dropped row", async () => {
    const { db, read } = await memoryDb();
    const keep = row({ rowNumber: 2, strain: "Chem", sample_tag: "1A40503000311FB0000000A1" });
    const drop = row({ rowNumber: 3, strain: "Drop Me", sample_tag: "1A40503000311FB0000000A2", source_metrc_tag: "1A40503000311FB0000000B1" });
    assignAttempts([keep, drop]);
    const first = await landInTestingRows(db, [keep, drop], "2026-09-22T12:00:00.000Z");
    expect(first).toMatchObject({ rows_seen: 2, rows_landed: 2, rows_changed: 0, rows_skipped: 0 });
    keep.strain = "Chem Again";
    assignAttempts([keep]);
    const second = await landInTestingRows(db, [keep], "2026-09-22T13:00:00.000Z");
    expect(second.rows_changed).toBe(1);
    const sheet = read("SELECT strain, on_sheet, source FROM external_test_results WHERE sheet_key = ?", keep.sheetKey) as { strain: string; on_sheet: number; source: string };
    const dropped = read("SELECT on_sheet FROM external_test_results WHERE sheet_key = ?", drop.sheetKey) as { on_sheet: number };
    const manual = read("SELECT strain, source FROM external_test_results WHERE id = 'manual-1'") as { strain: string; source: string };
    const order = read("SELECT on_sheet FROM test_orders WHERE sheet_key = ?", drop.sheetKey) as { on_sheet: number };
    expect(sheet).toMatchObject({ strain: "Chem Again", on_sheet: 1, source: "sheet" });
    expect(dropped.on_sheet).toBe(0);
    expect(order.on_sheet).toBe(0);
    expect(manual).toEqual({ strain: "Typed By Hand", source: "manual" });
    const reason = read("SELECT reason, actor_person_id FROM record_change_log WHERE field = 'strain'") as { reason: string; actor_person_id: string | null };
    expect(reason).toEqual({ reason: "in testing sheet", actor_person_id: null });
  });

  it("counts a blank sample tag, an unknown test, and an unknown lab", async () => {
    const { db, read } = await memoryDb();
    const blank = row({ rowNumber: 2, sample_tag: null });
    const unknownTest = row({ rowNumber: 3, required_test: "Terpenes", panel: null, sample_tag: "1A40503000311FB0000000C1" });
    const unknownLab = row({ rowNumber: 4, testing_facility: "Reassure", sample_tag: "1A40503000311FB0000000C2", source_metrc_tag: "1A40503000311FB0000000C3" });
    assignAttempts([blank, unknownTest, unknownLab]);
    const counts = await landInTestingRows(db, [blank, unknownTest, unknownLab], "2026-09-22T12:00:00.000Z");
    expect(counts.rows_seen).toBe(3);
    expect(counts.rows_skipped).toBe(3);
    expect(counts.message).toContain("blank Sample Tag");
    expect(counts.message).toContain("unknown Required Test");
    expect(counts.message).toContain("unknown lab Reassure");
    const external = read("SELECT COUNT(*) AS n FROM external_test_results WHERE source = 'sheet'") as { n: number };
    const orders = read("SELECT COUNT(*) AS n FROM test_orders") as { n: number };
    expect(external.n).toBe(3);
    expect(orders.n).toBe(0);
  });

  it("skips the Graph pull while the grip credentials are placeholders", async () => {
    const { db, read } = await memoryDb();
    const result = await runInTestingSync({ DB: db, MS_TENANT_ID: "TBD", MS_CLIENT_ID: "TBD" }, "cron");
    expect(result.status).toBe("skipped");
    expect(result.message).toBe("no source configured");
    const run = read("SELECT status, source, message FROM sheet_sync_runs") as { status: string; source: string; message: string };
    expect(run).toEqual({ status: "skipped", source: "in_testing", message: "no source configured" });
  });

  it("does not open a Driver Info sheet when the two tabs are named", async () => {
    const bytes = writeXlsb([
      { name: "In Testing", rows: [HEADER, ["AU-G-C-000832", "AU", "Chem", "BUD", "1A40503000311FB0000000A1", 10, "26001-ARL-GH-001-0-NA-26001", "1A40503000311FB0000000A2", "Full Compliance", 14, "ACT", "2026-09-01", "2026-09-02", 18, "Passed", "", ""]] },
      { name: "Driver Info", rows: [["Name", "Phone"], ["not-a-person", "000-000-0000"]] },
    ]);
    const sheets = await readXlsbSheets(bytes, ["In Testing", "R&D"]);
    expect([...sheets.keys()]).toEqual(["In Testing"]);
    expect(JSON.stringify([...sheets.values()])).not.toContain("000-000-0000");
  });
});

const SCHEMA = `
CREATE TABLE app_config (key TEXT PRIMARY KEY, value TEXT NOT NULL, deleted_at TEXT);
INSERT INTO app_config (key, value) VALUES
  ('in_testing_lab_aliases', 'ACT=act-laboratories; SC Labs=sc-labs-michigan'),
  ('in_testing_fail_types', 'Coliforms=microbials'),
  ('in_testing_tab', 'In Testing'),
  ('in_testing_rnd_tab', 'R&D');
CREATE TABLE external_test_results (
  id TEXT PRIMARY KEY, license_number TEXT, med_au TEXT, strain TEXT, item_name TEXT, source_metrc_tag TEXT,
  batch_weight_grams NUMERIC, hbn TEXT, sample_tag TEXT, required_test TEXT, net_weight_grams NUMERIC,
  testing_facility TEXT, entered_testing TEXT, finished_testing TEXT, attempt INTEGER, potency_result NUMERIC,
  status TEXT, failure_mode TEXT, notes TEXT, source TEXT, sheet_key TEXT, sheet_seen_at TEXT, on_sheet INTEGER,
  created_at TEXT, created_by TEXT, updated_at TEXT, updated_by TEXT, deleted_at TEXT, deleted_by TEXT
);
INSERT INTO external_test_results (id, strain, source, on_sheet, sample_tag, status, created_at, updated_at)
VALUES ('manual-1', 'Typed By Hand', 'manual', 0, '1A40503000311FB0000000M1', 'Passed', '2026-09-01T00:00:00.000Z', '2026-09-01T00:00:00.000Z');
CREATE TABLE test_orders (
  id TEXT PRIMARY KEY, lot_id TEXT, source_package_tag TEXT, source_package_code TEXT, item_name TEXT, license_value TEXT,
  market TEXT, lab_id TEXT, panel TEXT, required_lab_test_batch TEXT, batch_grams NUMERIC, sample_grams INTEGER,
  status TEXT, pickup_date TEXT, notes TEXT, created_at TEXT, created_by TEXT, updated_at TEXT, updated_by TEXT,
  deleted_at TEXT, deleted_by TEXT, source TEXT, sheet_key TEXT, sheet_seen_at TEXT, on_sheet INTEGER
);
CREATE TABLE test_samples (
  id TEXT PRIMARY KEY, order_id TEXT, sample_tag TEXT, net_grams INTEGER, sampled_at TEXT, attempt INTEGER,
  overall_passed INTEGER, thc_total_pct NUMERIC, results_at TEXT, created_at TEXT, created_by TEXT, updated_at TEXT,
  updated_by TEXT, deleted_at TEXT, deleted_by TEXT, source TEXT, sheet_key TEXT, sheet_seen_at TEXT, on_sheet INTEGER
);
CREATE TABLE test_results (
  id TEXT PRIMARY KEY, sample_id TEXT, test_type TEXT, passed INTEGER, notes TEXT, result_date TEXT,
  created_at TEXT, created_by TEXT, updated_at TEXT, updated_by TEXT, deleted_at TEXT, deleted_by TEXT
);
CREATE TABLE record_change_log (
  id TEXT PRIMARY KEY, record_table TEXT, record_id TEXT, field TEXT, old_value TEXT, new_value TEXT,
  actor_person_id TEXT, reason TEXT, changed_at TEXT
);
CREATE TABLE harvest_batches (id TEXT PRIMARY KEY, hbn TEXT, deleted_at TEXT);
CREATE TABLE wet_weight_entries (id TEXT PRIMARY KEY, harvest_batch_id TEXT, status TEXT, created_at TEXT, deleted_at TEXT);
CREATE TABLE sheet_sync_runs (
  id TEXT PRIMARY KEY, started_at TEXT NOT NULL, finished_at TEXT, status TEXT NOT NULL, trigger TEXT NOT NULL,
  workbook_modified_at TEXT, workbook_ctag TEXT, rows_seen INTEGER, rows_landed INTEGER, rows_changed INTEGER,
  rows_skipped INTEGER, message TEXT, source TEXT
);
`;

type SqliteDb = {
  exec(sql: string): void;
  prepare(sql: string): {
    run(...args: Array<string | number | null>): unknown;
    get(...args: Array<string | number | null>): unknown;
    all(...args: Array<string | number | null>): unknown[];
  };
};

async function memoryDb(): Promise<{ db: D1Database; read: (sql: string, ...args: unknown[]) => unknown }> {
  const mod = (await import("node:" + "sqlite")) as { DatabaseSync: new (path: string) => SqliteDb };
  const sqlite = new mod.DatabaseSync(":memory:");
  sqlite.exec(SCHEMA);
  const prepare = (sql: string) => {
    let args: unknown[] = [];
    const stmt = {
      bind(...next: unknown[]) {
        args = next;
        return stmt;
      },
      async run() {
        sqlite.prepare(sql).run(...(args as (string | number | null)[]));
        return { success: true };
      },
      async first<T>() {
        return (sqlite.prepare(sql).get(...(args as (string | number | null)[])) as T | undefined) ?? null;
      },
      async all<T>() {
        return { results: sqlite.prepare(sql).all(...(args as (string | number | null)[])) as T[] };
      },
    };
    return stmt;
  };
  const db = {
    prepare,
    async batch(stmts: Array<{ run: () => Promise<unknown> }>) {
      sqlite.exec("BEGIN");
      try {
        const out = [];
        for (const stmt of stmts) out.push(await stmt.run());
        sqlite.exec("COMMIT");
        return out;
      } catch (err) {
        sqlite.exec("ROLLBACK");
        throw err;
      }
    },
  };
  return {
    db: db as unknown as D1Database,
    read: (sql: string, ...args: unknown[]) => sqlite.prepare(sql).get(...(args as (string | number | null)[])),
  };
}
