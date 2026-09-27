import { deflateRawSync } from "node:zlib";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SYSTEM_REASON } from "../src/config";
import { farmDay } from "../src/farmday";
import {
  excelSerialToIso,
  FIXTURE_ALIAS_METRC,
  FIXTURE_ALIAS_TAG,
  FIXTURE_KNOWN_HBN,
  FIXTURE_MARKET,
  FIXTURE_SKIP_STRAIN,
  FIXTURE_TYPED_HOURS,
  FIXTURE_YESTERDAY_HOURS,
  fixtureAgreeHbn,
  fixtureAliasSheetHbn,
  fixtureSkipHbn,
  isoToExcelSerial,
  joinSheetTarget,
  laborFixtureWorkbook,
  laborSheetPath,
  landHours,
  landSheetWorkbook,
  parseHarvestSheet,
  parseHarvestWorkbook,
  parseLaborRows,
  parseLaborWorkbook,
  parseSharedStrings,
  readZipEntryByName,
  runSheetSync,
  scrubSecrets,
  sheetSyncAdminPage,
  sheetSyncLineText,
  sheetSyncStatusLine,
  sheetWorkbook,
  smokeSheetWorkbook,
  translateSheetMessage,
  type HarvestFixtureRow,
  type LaborRow,
  type SheetSyncEnv,
  type SheetSyncRunRow,
} from "../src/sheetsync";
import { migratedDb, seedBatch, seedLot, seedMirror } from "./migrated";
import { crc32, writeStoreZip, type ZipFile } from "../src/xlsx";

afterEach(() => {
  vi.unstubAllGlobals();
});

const enc = new TextEncoder();
const dec = new TextDecoder();

function u16(n: number): number[] {
  return [n & 0xff, (n >>> 8) & 0xff];
}
function u32(n: number): number[] {
  return [n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff, (n >>> 24) & 0xff];
}

/** A deflate-raw zip, the shape the owner's workbook uses. */
function deflateZip(files: ZipFile[]): Uint8Array {
  const locals: number[] = [];
  const centrals: number[] = [];
  let offset = 0;
  for (const file of files) {
    const nameBytes = enc.encode(file.name);
    const raw = file.data;
    const data = deflateRawSync(raw);
    const crc = crc32(raw);
    const local = [
      ...u32(0x04034b50), ...u16(20), ...u16(0), ...u16(8), ...u16(0), ...u16(0),
      ...u32(crc), ...u32(data.length), ...u32(raw.length), ...u16(nameBytes.length), ...u16(0),
      ...nameBytes, ...data,
    ];
    centrals.push(
      ...u32(0x02014b50), ...u16(20), ...u16(20), ...u16(0), ...u16(8), ...u16(0), ...u16(0),
      ...u32(crc), ...u32(data.length), ...u32(raw.length), ...u16(nameBytes.length), ...u16(0), ...u16(0),
      ...u16(0), ...u16(0), ...u32(0), ...u32(offset), ...nameBytes
    );
    locals.push(...local);
    offset += local.length;
  }
  const end = [...u32(0x06054b50), ...u16(0), ...u16(0), ...u16(files.length), ...u16(files.length), ...u32(centrals.length), ...u32(offset), ...u16(0)];
  return new Uint8Array([...locals, ...centrals, ...end]);
}

const SHARED = ["DATE", "HARV FARM", "CUT/BCK # HRS", "PNN"];

function sheetXml(serial915: number): string {
  return `<worksheet><sheetData>
    <row r="3"><c r="C3" t="s"><v>0</v></c><c r="D3" t="s"><v>1</v></c><c r="I3" t="s"><v>2</v></c></row>
    <row r="4"><c r="C4"><f t="array" ref="C4">1</f><v>46223</v></c><c r="D4" t="str"><v>ARL</v></c><c r="I4"><v>133.5</v></c></row>
    <row r="5"><c r="C5"><f t="shared" si="15"/><v>46284</v></c><c r="D5" t="s"><v>3</v></c><c r="I5"><f>SUM(1)</f><v>2753</v></c></row>
    <row r="6"><c r="C6"><v>${serial915}</v></c><c r="D6" t="inlineStr"><is><t>pns</t></is></c><c r="I6"><v>3153</v></c></row>
    <row r="15"><c r="C15"><v>46223</v></c><c r="D15" t="str"><v> ARL </v></c><c r="I15" s="185"/></row>
  </sheetData></worksheet>`;
}

type Hour = { id: string; farm_code: string; work_date: string; hours: number };
type Run = {
  id: string;
  started_at: string;
  finished_at: string | null;
  status: string;
  trigger: string;
  workbook_ctag: string | null;
  rows_seen: number | null;
  rows_landed: number | null;
  rows_changed: number | null;
  rows_skipped: number | null;
  message: string | null;
};

function syncDb(config: Record<string, string>, existing: Hour[] = []) {
  const hours = existing.map((h) => ({ ...h }));
  const runs: Run[] = [];
  const logs: Array<{ old: unknown; neu: unknown; actor: unknown; reason: unknown }> = [];
  const batched: Array<{ sql: string; args: unknown[] }> = [];
  function apply(sql: string, args: unknown[]) {
    batched.push({ sql, args });
    if (sql.includes("INSERT INTO harvest_labor_hours")) {
      hours.push({ id: String(args[0]), farm_code: String(args[1]), work_date: String(args[2]), hours: Number(args[3]) });
    } else if (sql.includes("UPDATE harvest_labor_hours")) {
      const row = hours.find((h) => h.id === String(args[3]));
      if (row) row.hours = Number(args[0]);
    } else if (sql.includes("INSERT INTO record_change_log")) {
      logs.push({ old: args[4], neu: args[5], actor: args[6], reason: args[7] });
    } else if (sql.includes("INSERT INTO sheet_sync_runs")) {
      runs.push({
        id: String(args[0]),
        started_at: String(args[1]),
        finished_at: args[2] == null ? null : String(args[2]),
        status: String(args[3]),
        trigger: String(args[4]),
        workbook_ctag: args[6] == null ? null : String(args[6]),
        rows_seen: args[7] == null ? null : Number(args[7]),
        rows_landed: args[8] == null ? null : Number(args[8]),
        rows_changed: args[9] == null ? null : Number(args[9]),
        rows_skipped: args[10] == null ? null : Number(args[10]),
        message: args[11] == null ? null : String(args[11]),
      });
    } else if (sql.includes("INSERT INTO app_config")) {
      config[String(args[0])] = String(args[1]);
    } else if (sql.includes("DELETE FROM sheet_sync_runs")) {
      runs.sort((a, b) => b.started_at.localeCompare(a.started_at));
      runs.splice(500);
    }
  }
  function stmt(sql: string) {
    let args: unknown[] = [];
    const self = {
      bind(...next: unknown[]) {
        args = next;
        return self;
      },
      async first() {
        if (sql.includes("FROM app_config")) {
          const value = config[String(args[0])];
          return value == null ? null : { value };
        }
        if (sql.includes("workbook_ctag")) {
          const ok = runs.filter((r) => (r.status === "ok" || r.status === "skipped") && r.workbook_ctag);
          ok.sort((a, b) => b.started_at.localeCompare(a.started_at));
          return ok[0] ? { workbook_ctag: ok[0].workbook_ctag } : null;
        }
        if (sql.includes("COALESCE")) {
          const sorted = [...runs].sort((a, b) => b.started_at.localeCompare(a.started_at));
          const row = sorted[0];
          return row
            ? { status: row.status, at: row.finished_at ?? row.started_at, rows_seen: row.rows_seen, rows_changed: row.rows_changed, message: row.message }
            : null;
        }
        return null;
      },
      async all() {
        if (sql.includes("FROM harvest_labor_hours")) return { results: hours.map((h) => ({ ...h })) };
        return { results: [] };
      },
      async run() {
        apply(sql, args);
        return { success: true };
      },
    };
    return self;
  }
  const db = {
    hours,
    runs,
    logs,
    batched,
    config,
    prepare(sql: string) {
      return stmt(sql);
    },
    async batch(stmts: Array<{ run: () => Promise<unknown> }>) {
      for (const s of stmts) await s.run();
    },
  };
  return db;
}

const MORNING = "2026-09-21T15:00:00.000Z";
const SMALL_HOURS = "2026-09-21T05:30:00.000Z";

function row(partial: Partial<LaborRow> & Pick<LaborRow, "date" | "farm" | "hours">): LaborRow {
  return { raw: { row: 4, date: null, farm: partial.farm, hours: partial.hours == null ? null : String(partial.hours) }, ...partial };
}

describe("THE SHEET SYNC zip reader (canon 0.30.162)", () => {
  it("reads a store-method workbook built with writeStoreZip and a deflated one", async () => {
    const hello = writeStoreZip([{ name: "xl/hello.txt", data: enc.encode("hello") }]);
    expect(dec.decode(await readZipEntryByName(hello, "xl/hello.txt"))).toBe("hello");
    const store = laborFixtureWorkbook("2026-09-21");
    const names = ["xl/workbook.xml", "xl/_rels/workbook.xml.rels", "xl/sharedStrings.xml", "xl/worksheets/sheet10.xml"];
    const files: ZipFile[] = [];
    for (const name of names) files.push({ name, data: await readZipEntryByName(store, name) });
    const deflated = deflateZip(files);
    expect(dec.decode(await readZipEntryByName(deflated, "xl/worksheets/sheet10.xml"))).toBe(dec.decode(files[3].data));
    const fromStore = await parseLaborWorkbook(store, "Labor");
    const fromDeflate = await parseLaborWorkbook(deflated, "Labor");
    expect(fromDeflate).toEqual(fromStore);
    expect(fromStore.filter((r) => r.farm === "PNN" && r.hours === FIXTURE_TYPED_HOURS)).toHaveLength(1);
  });

  it("resolves a Labor part that is absolute or relative to xl/", () => {
    expect(joinSheetTarget("worksheets/sheet10.xml")).toBe("xl/worksheets/sheet10.xml");
    expect(joinSheetTarget("/xl/worksheets/sheet10.xml")).toBe("xl/worksheets/sheet10.xml");
    const workbook = `<workbook xmlns:r="urn:r"><sheets><sheet name="Labor" sheetId="10" r:id="rId10"/></sheets></workbook>`;
    expect(laborSheetPath(workbook, `<Relationships><Relationship Id="rId10" Target="worksheets/sheet10.xml"/></Relationships>`, "Labor")).toBe(
      "xl/worksheets/sheet10.xml"
    );
    expect(laborSheetPath(workbook, `<Relationships><Relationship Id="rId10" Target="/xl/worksheets/sheet10.xml"/></Relationships>`, "Labor")).toBe(
      "xl/worksheets/sheet10.xml"
    );
    expect(() => laborSheetPath(workbook, `<Relationships></Relationships>`, "Missing")).toThrow(/not in the workbook/);
  });
});

describe("THE SHEET SYNC Labor parser (canon 0.30.162)", () => {
  it("reads the real cell shapes and the 1900 date system", () => {
    expect(excelSerialToIso(46223)).toBe("2026-07-20");
    expect(excelSerialToIso(46284)).toBe("2026-09-19");
    expect(isoToExcelSerial("2026-07-20")).toBe(46223);
    expect(parseSharedStrings(`<sst><si><t>DATE</t></si><si><r><t>HARV </t></r><r><t>FARM</t></r></si></sst>`)).toEqual(["DATE", "HARV FARM"]);
    const serial = isoToExcelSerial("2026-09-15");
    expect(serial).toBeTruthy();
    const rows = parseLaborRows(sheetXml(serial ?? 0), SHARED);
    expect(rows[0]).toMatchObject({ date: "2026-07-20", farm: "ARL", hours: 133.5, raw: { date: "46223", farm: "ARL", hours: "133.5" } });
    expect(rows[1]).toMatchObject({ date: "2026-09-19", farm: "PNN", hours: 2753, raw: { date: "46284", farm: "PNN" } });
    expect(rows[2]).toMatchObject({ date: "2026-09-15", farm: "PNS", hours: 3153, raw: { farm: "pns" } });
    expect(rows[3]).toMatchObject({ date: "2026-07-20", farm: "ARL", hours: null, raw: { hours: null } });
  });

  it("refuses a moved column in words", () => {
    const moved = sheetXml(46223).replace('<c r="I3" t="s"><v>2</v></c>', '<c r="I3" t="s"><v>0</v></c>');
    let thrown = "";
    try {
      parseLaborRows(moved, SHARED);
    } catch (err) {
      thrown = err instanceof Error ? err.message : String(err);
    }
    expect(thrown).toContain("Labor header moved");
    expect(thrown).toContain('column I reads "DATE", expected CUT/BCK # HRS');
  });
});

describe("THE SHEET SYNC landing (canon 0.30.162; his pick Take it as typed)", () => {
  it("inserts, updates with old and new logged, leaves an equal row, and never clears a blank", async () => {
    const db = syncDb({ farm_day_start_hour: "6" }, [
      { id: "keep", farm_code: "ARL", work_date: "2026-07-20", hours: 100 },
      { id: "same", farm_code: "PNS", work_date: "2026-09-15", hours: 4 },
      { id: "typed", farm_code: "PNN", work_date: "2026-09-14", hours: 8 },
    ]);
    const counts = await landHours(
      db as unknown as D1Database,
      [
        row({ date: "2026-07-20", farm: "ARL", hours: 133.5 }),
        row({ date: "2026-09-15", farm: "PNS", hours: 4 }),
        row({ date: "2026-09-14", farm: "PNN", hours: 2753 }),
        row({ date: "2026-09-14", farm: "PNN", hours: null }),
        row({ date: "2026-09-18", farm: null, hours: 5 }),
      ],
      MORNING
    );
    expect(counts).toEqual({ rows_seen: 5, rows_landed: 0, rows_changed: 2, rows_skipped: 2 });
    expect(db.hours.find((h) => h.id === "keep")?.hours).toBe(133.5);
    expect(db.hours.find((h) => h.id === "same")?.hours).toBe(4);
    expect(db.hours.find((h) => h.id === "typed")?.hours).toBe(2753);
    expect(db.batched.some((b) => b.sql.includes("DELETE FROM harvest_labor_hours"))).toBe(false);
    const updates = db.logs.filter((l) => l.reason === SYSTEM_REASON.sheet_sync);
    expect(updates).toEqual([
      { old: "100", neu: "133.5", actor: null, reason: SYSTEM_REASON.sheet_sync },
      { old: "8", neu: "2753", actor: null, reason: SYSTEM_REASON.sheet_sync },
    ]);
    expect(db.batched.filter((b) => b.sql.includes("UPDATE harvest_labor_hours"))).toHaveLength(2);
  });

  it("births a missing farm-day, skips a future date and a farm outside ARL/PNN/PNS, and skips the next calendar day before 6 AM", async () => {
    const db = syncDb({ farm_day_start_hour: "6" });
    const counts = await landHours(
      db as unknown as D1Database,
      [
        row({ date: "2026-09-20", farm: "ARL", hours: 12.5 }),
        row({ date: "2026-09-22", farm: "PNN", hours: 99 }),
        row({ date: "2026-09-20", farm: "XYZ", hours: 6 }),
        row({ date: "2026-09-21", farm: "PNS", hours: 3 }),
      ],
      SMALL_HOURS
    );
    expect(counts).toEqual({ rows_seen: 4, rows_landed: 1, rows_changed: 0, rows_skipped: 3 });
    expect(db.hours).toEqual([expect.objectContaining({ farm_code: "ARL", work_date: "2026-09-20", hours: 12.5 })]);
    expect(db.logs[0]).toEqual({ old: null, neu: "12.5", actor: null, reason: SYSTEM_REASON.sheet_sync });
  });
});

describe("THE SHEET SYNC run record (canon 0.30.162)", () => {
  function env(extra: Partial<SheetSyncEnv> = {}, config: Record<string, string> = { farm_day_start_hour: "6", sheet_labor_tab: "Labor" }): SheetSyncEnv & { DB: ReturnType<typeof syncDb> } {
    const db = syncDb(config);
    return { DB: db, ...extra } as SheetSyncEnv & { DB: ReturnType<typeof syncDb> };
  }

  it("records failed with no source configured, and refuses the fixture when MS_TENANT_ID is set", async () => {
    const bare = env();
    vi.stubGlobal("fetch", () => {
      throw new Error("fetch should not run");
    });
    const none = await runSheetSync(bare, "cron");
    expect(none.status).toBe("failed");
    expect(none.message).toBe("no source configured");
    expect(none.trigger).toBe("cron");

    const guarded = env(
      { MS_TENANT_ID: "tenant-id", MS_CLIENT_ID: "client-id", MS_CLIENT_SECRET: "sec-VALUE-99", SHEET_FIXTURE_URL: "http://fixture.invalid/labor" },
      { farm_day_start_hour: "6", sheet_drive_id: "drive-1", sheet_item_id: "item-1", sheet_labor_tab: "Labor" }
    );
    let fixtureHits = 0;
    vi.stubGlobal("fetch", async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("fixture.invalid")) {
        fixtureHits += 1;
        return new Response("no", { status: 500 });
      }
      if (url.includes("oauth2/v2.0/token")) {
        return new Response(JSON.stringify({ access_token: "TOK_abc.def" }), { status: 200, headers: { "content-type": "application/json" } });
      }
      return new Response(`{"error":"invalid_client","access_token":"TOK_abc.def","note":"sec-VALUE-99"}`, { status: 401 });
    });
    const failed = await runSheetSync(guarded, "cron");
    expect(fixtureHits).toBe(0);
    expect(failed.status).toBe("failed");
    expect(failed.message).toContain("Graph 401");
    expect(failed.message).not.toContain("TOK_abc.def");
    expect(failed.message).not.toContain("sec-VALUE-99");
    expect(scrubSecrets("Bearer TOK_abc.def", "sec-VALUE-99")).not.toContain("TOK_abc.def");
  });

  it("records ok, then skipped when the cTag is unchanged, and failed when the header moved", async () => {
    const today = farmDay(new Date().toISOString(), 6);
    const bytes = laborFixtureWorkbook(today);
    const dbEnv = env(
      { MS_TENANT_ID: "tenant-id", MS_CLIENT_ID: "client-id", MS_CLIENT_SECRET: "sec-VALUE-99" },
      { farm_day_start_hour: "6", sheet_drive_id: "drive-1", sheet_item_id: "item-1", sheet_labor_tab: "Labor" }
    );
    let contentHits = 0;
    vi.stubGlobal("fetch", async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("oauth2/v2.0/token")) {
        return new Response(JSON.stringify({ access_token: "TOK_abc.def" }), { status: 200, headers: { "content-type": "application/json" } });
      }
      if (url.includes("/content")) {
        contentHits += 1;
        return new Response(bytes);
      }
      return new Response(
        JSON.stringify({ name: "smoke-labor.xlsx", cTag: "ctag-1", webUrl: "https://example.invalid/sheet", lastModifiedDateTime: "2026-09-21T13:55:55Z" }),
        { status: 200, headers: { "content-type": "application/json" } }
      );
    });
    const ok = await runSheetSync(dbEnv, "cron");
    expect(ok.status).toBe("ok");
    expect(ok.rows_seen).toBe(8);
    expect(ok.rows_landed).toBe(4);
    expect(ok.rows_changed).toBe(0);
    expect(ok.rows_skipped).toBe(4);
    expect(ok.message).toBeNull();
    expect(contentHits).toBe(1);
    expect(dbEnv.DB.hours.find((h) => h.hours === FIXTURE_TYPED_HOURS)?.farm_code).toBe("PNN");
    expect(dbEnv.DB.hours.find((h) => h.farm_code === "ARL" && h.hours === FIXTURE_YESTERDAY_HOURS.ARL)).toBeTruthy();
    expect(dbEnv.DB.config.sheet_last_name).toBe("smoke-labor.xlsx");
    expect(dbEnv.DB.logs.every((l) => l.actor == null && l.reason === SYSTEM_REASON.sheet_sync)).toBe(true);
    expect(dbEnv.DB.batched.some((b) => b.sql.includes("DELETE FROM sheet_sync_runs"))).toBe(true);

    const skipped = await runSheetSync(dbEnv, "admin");
    expect(skipped.status).toBe("skipped");
    expect(skipped.trigger).toBe("admin");
    expect(skipped.workbook_ctag).toBe("ctag-1");
    expect(contentHits).toBe(1);

    const bad = writeStoreZip([
      { name: "xl/workbook.xml", data: enc.encode(`<workbook xmlns:r="urn:r"><sheets><sheet name="Labor" r:id="rId10"/></sheets></workbook>`) },
      { name: "xl/_rels/workbook.xml.rels", data: enc.encode(`<Relationships><Relationship Id="rId10" Target="worksheets/sheet1.xml"/></Relationships>`) },
      { name: "xl/sharedStrings.xml", data: enc.encode(`<sst><si><t>DATE</t></si><si><t>HARV FARM</t></si><si><t>NOPE</t></si></sst>`) },
      {
        name: "xl/worksheets/sheet1.xml",
        data: enc.encode(`<worksheet><sheetData><row r="3"><c r="C3" t="s"><v>0</v></c><c r="D3" t="s"><v>1</v></c><c r="I3" t="s"><v>2</v></c></row></sheetData></worksheet>`),
      },
    ]);
    vi.stubGlobal("fetch", async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("oauth2")) return new Response(JSON.stringify({ access_token: "TOK_abc.def" }), { status: 200 });
      if (url.includes("/content")) return new Response(bad);
      return new Response(JSON.stringify({ name: "moved.xlsx", cTag: "ctag-2", webUrl: "https://example.invalid/moved", lastModifiedDateTime: "2026-09-21T14:00:00Z" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });
    const moved = await runSheetSync(dbEnv, "cron");
    expect(moved.status).toBe("failed");
    expect(moved.message).toContain("Labor header moved");
    expect(moved.message).not.toContain("TOK_abc.def");
  });
});

describe("THE SHEET SYNC console line (canon 0.30.162)", () => {
  const at = "2026-09-21T13:55:55.000Z";

  it("speaks the four states in English and Spanish", async () => {
    expect(sheetSyncLineText(null, "en")).toBe("sheet never read");
    expect(sheetSyncLineText(null, "es")).toBe("la hoja nunca se leyo");
    expect(sheetSyncLineText({ status: "ok", at, rowsSeen: 8, rowsChanged: 2, message: null }, "en")).toBe(
      "read from the sheet at 2026-09-21 9:55 AM ET (8 rows, 2 changed)"
    );
    expect(sheetSyncLineText({ status: "ok", at, rowsSeen: 8, rowsChanged: 2, message: null }, "es")).toBe(
      "leido de la hoja a las 2026-09-21 9:55 AM ET (8 filas, 2 cambiadas)"
    );
    expect(sheetSyncLineText({ status: "skipped", at, rowsSeen: null, rowsChanged: null, message: null }, "en")).toBe(
      "sheet unchanged since 2026-09-21 9:55 AM ET"
    );
    expect(sheetSyncLineText({ status: "skipped", at, rowsSeen: null, rowsChanged: null, message: null }, "es")).toBe(
      "la hoja no cambio desde 2026-09-21 9:55 AM ET"
    );
    expect(sheetSyncLineText({ status: "failed", at, rowsSeen: null, rowsChanged: null, message: "Graph 401: no" }, "en")).toBe(
      "sheet read failed at 2026-09-21 9:55 AM ET: Graph 401: no"
    );
    expect(sheetSyncLineText({ status: "failed", at, rowsSeen: null, rowsChanged: null, message: "Graph 401: no" }, "es")).toBe(
      "la lectura de la hoja fallo a las 2026-09-21 9:55 AM ET: Graph 401: no"
    );

    const db = syncDb({ farm_day_start_hour: "6" });
    db.runs.push({
      id: "r1",
      started_at: at,
      finished_at: at,
      status: "ok",
      trigger: "cron",
      workbook_ctag: "ctag-1",
      rows_seen: 8,
      rows_landed: 4,
      rows_changed: 2,
      rows_skipped: 4,
      message: null,
    });
    expect(await sheetSyncStatusLine(db as unknown as D1Database, "en")).toBe("read from the sheet at 2026-09-21 9:55 AM ET (8 rows, 2 changed)");
    const pageRun: SheetSyncRunRow = {
      id: "r1",
      started_at: at,
      finished_at: at,
      status: "ok",
      trigger: "cron",
      workbook_modified_at: at,
      workbook_ctag: "ctag-1",
      rows_seen: 8,
      rows_landed: 4,
      rows_changed: 2,
      rows_skipped: 4,
      message: null,
    };
    const page = sheetSyncAdminPage({ runs: [pageRun], name: "smoke-labor.xlsx", webUrl: "https://example.invalid/sheet" }, "es", "ran");
    expect(page).toContain("Ejecutar ahora");
    expect(page).toContain("La hoja se leyo.");
    expect(page).toContain('data-sheet-sync-flash="ok"');
    expect(page).toContain("smoke-labor.xlsx");
    expect(page).toContain("Vistas de cosecha");
  });
});

const FP = "c96d7e99-49a3-4813-9654-4f02796d8020";

function harvestRow(over: HarvestFixtureRow): HarvestFixtureRow {
  return {
    Date: "2026-08-24",
    Farm: "PNN",
    "Grow Method": "Greenhouse",
    Strain: "After Party",
    "Manicure?": "No",
    ...over,
  };
}

describe("THE HARVEST DETAILS IMPORT (canon 0.30.205)", () => {
  it("reads columns by header text, the newline header, a date serial, a cached value, and a text dry weight", async () => {
    const serial = isoToExcelSerial("2026-08-24");
    const xml = `<worksheet><sheetData>
      <row r="4">
        <c r="A4" t="inlineStr"><is><t>Date</t></is></c>
        <c r="C4" t="inlineStr"><is><t>Harvest Batch Name</t></is></c>
        <c r="D4" t="inlineStr"><is><t>Wet Spear Weight</t><t>\n(grams)</t></is></c>
      </row>
      <row r="7"><c r="C7" t="inlineStr"><is><t>not a name</t></is></c></row>
      <row r="8"><c r="A8"><f t="array" ref="A8">1</f><v>${serial}</v></c><c r="C8" t="inlineStr"><is><t>${fixtureAliasSheetHbn()}</t></is></c><c r="D8"><v>1000.5</v></c></row>
    </sheetData></worksheet>`;
    const parsed = parseHarvestSheet(xml, []);
    expect(parsed.skipped).toBe(1);
    expect(parsed.rows).toHaveLength(1);
    expect(parsed.rows[0]).toMatchObject({ sheet_date: "2026-08-24", sheet_hbn: fixtureAliasSheetHbn(), wet_spear_g: 1000.5 });
    expect(parsed.missing).toContain("Farm");
    expect(parsed.missing.filter((header) => header === "Farm")).toHaveLength(1);
    expect(parsed.missing).not.toContain("Wet Spear Weight (grams)");
    const book = await parseHarvestWorkbook(smokeSheetWorkbook("2026-09-21"), "Harvest Details");
    expect(book.missing).toEqual([]);
    expect(book.rows.map((row) => row.sheet_hbn)).toEqual([fixtureAliasSheetHbn(), fixtureAgreeHbn(), FIXTURE_KNOWN_HBN, fixtureSkipHbn()]);
    expect(book.rows[2]?.dry_weight_g).toBeNull();
    expect(book.rows[0]?.plants).toBe(10);
  });

  it("mints from the sheet under METRC's text, reconciles, and refuses in words", async () => {
    const m = await migratedDb();
    seedBatch(m, { id: "hb-known", hbn: FIXTURE_KNOWN_HBN, serial: 10, farm: "ARL", strainId: FP });
    seedMirror(m, { tag: "1A4050300000000000000F80", harvest: FIXTURE_ALIAS_METRC, item: "BUD - Fruity Pebbles - PNN - O" });
    const first = await landSheetWorkbook(m.db, smokeSheetWorkbook("2026-09-21"), "upload");
    expect(first.status).toBe("ok");
    expect(first.harvest_rows_seen).toBe(4);
    expect(first.harvest_rows_landed).toBe(3);
    expect(first.harvest_rows_changed).toBe(0);
    expect(first.harvest_rows_skipped).toBe(1);
    expect(first.message).toContain(`${fixtureAliasSheetHbn()} follows METRC ${FIXTURE_ALIAS_METRC}`);
    expect(first.message).toContain(FIXTURE_SKIP_STRAIN);
    expect(first.message).toContain("disagrees on entry_date");
    const alias = m.get(`SELECT * FROM harvest_batches WHERE hbn = ?`, FIXTURE_ALIAS_METRC);
    expect(alias).toMatchObject({
      born_from: "sheet",
      entry_date: "2026-08-24",
      farm_code: "PNN",
      grow_method_code: "ID",
      strain_id: FP,
      market_strain: "Sheet Apple",
      manicure: 0,
      metrc_harvest_tag: FIXTURE_ALIAS_TAG,
      lot_serial: 80,
      harvest_year: 2026,
      status: "open",
      license_value: "AU-G-C-000832",
      planned_dryspc: null,
    });
    expect(m.get(`SELECT hbn FROM harvest_batches WHERE hbn = ?`, fixtureAliasSheetHbn())).toBeUndefined();
    const agree = m.get(`SELECT manicure, market_strain, born_from FROM harvest_batches WHERE hbn = ?`, fixtureAgreeHbn());
    expect(agree).toMatchObject({ manicure: 1, market_strain: "After Party", born_from: "sheet" });
    expect(m.get(`SELECT market_strain, entry_date, born_from FROM harvest_batches WHERE id = 'hb-known'`)).toEqual({
      market_strain: FIXTURE_MARKET,
      entry_date: "2026-09-08",
      born_from: "app",
    });
    expect(m.get(`SELECT sheet_hbn, dry_weight_g, harvest_batch_id FROM harvest_sheet_rows WHERE sheet_hbn = ?`, fixtureAliasSheetHbn())).toMatchObject({
      dry_weight_g: 400,
      harvest_batch_id: alias?.id,
    });
    expect(m.get(`SELECT COUNT(*) AS n FROM harvest_batches WHERE hbn LIKE '%26082'`)).toEqual({ n: 0 });
    const reason = m.get(
      `SELECT old_value, new_value, reason, actor_person_id FROM record_change_log WHERE record_id = 'hb-known' AND field = 'market_strain'`
    );
    expect(reason).toMatchObject({ old_value: null, new_value: FIXTURE_MARKET, reason: SYSTEM_REASON.harvest_details, actor_person_id: null });
    const again = await landSheetWorkbook(m.db, smokeSheetWorkbook("2026-09-21"), "upload");
    expect(again.harvest_rows_landed).toBe(0);
    expect(again.harvest_rows_changed).toBe(0);
    expect(again.harvest_rows_skipped).toBe(1);
    expect(translateSheetMessage(first.message ?? "", "es")).toContain("ninguna variedad viva se llama");
  });

  it("keeps both tags of one lot, the first tag on the batch, and refuses the four misses", async () => {
    const m = await migratedDb();
    const shared = `${isoToExcelSerial("2026-08-20")}-PNN-GH-001-0-NA-26070`;
    const rows: HarvestFixtureRow[] = [
      harvestRow({ Date: "2026-08-20", "Harvest Batch Name": shared, "METRC Harvest Tag": "TAGAAA", "Manicure?": "No" }),
      harvestRow({ Date: "2026-08-20", "Harvest Batch Name": shared, "METRC Harvest Tag": "TAGBBB", "Manicure?": "No" }),
      harvestRow({ "Harvest Batch Name": `${isoToExcelSerial("2025-08-24")}-PNN-GH-001-0-NA-26071`, Date: "2025-08-24" }),
      harvestRow({ "Harvest Batch Name": `${isoToExcelSerial("2026-08-24")}-PNN-GH-001-0-NA-26072`, Strain: "No Such Herb" }),
      harvestRow({ "Harvest Batch Name": `${isoToExcelSerial("2026-08-24")}-ZZZ-GH-001-0-NA-26073`, Farm: "ZZZ" }),
      harvestRow({ "Harvest Batch Name": `${isoToExcelSerial("2026-08-24")}-PNN-GH-001-0-NA-26074`, "Grow Method": "Hydro" }),
    ];
    seedBatch(m, { id: "hb-name", hbn: `${isoToExcelSerial("2026-08-24")}-PNN-GH-001-0-NA-26075`, serial: 4, farm: "PNN" });
    seedBatch(m, { id: "hb-serial", hbn: "26200-PNN-GH-001-0-NA-26076", serial: 75, farm: "PNN" });
    rows.push(harvestRow({ "Harvest Batch Name": `${isoToExcelSerial("2026-08-24")}-PNN-GH-001-0-NA-26075` }));
    const run = await landSheetWorkbook(m.db, sheetWorkbook("2026-09-21", rows), "cron");
    expect(m.get(`SELECT metrc_harvest_tag, manicure FROM harvest_batches WHERE lot_serial = 70`)).toEqual({ metrc_harvest_tag: "TAGAAA", manicure: 0 });
    expect(m.all(`SELECT metrc_harvest_tag FROM harvest_sheet_rows WHERE sheet_hbn = ? ORDER BY metrc_harvest_tag`, shared).map((row) => row.metrc_harvest_tag)).toEqual(["TAGAAA", "TAGBBB"]);
    expect(m.get(`SELECT COUNT(*) AS n FROM harvest_batches WHERE lot_serial IN (71, 72, 73, 74, 75) AND id NOT IN ('hb-serial')`)).toEqual({ n: 0 });
    expect(run.message).toContain("is not the date's year");
    expect(run.message).toContain("no live strain named No Such Herb");
    expect(run.message).toContain("farm ZZZ is unknown");
    expect(run.message).toContain("grow method Hydro is unknown");
    expect(run.message).toContain("already belongs to");
    expect(m.get(`SELECT COUNT(*) AS n FROM harvest_sheet_rows WHERE sheet_hbn LIKE '%26075'`)).toEqual({ n: 0 });
  });

  it("renames an app batch to METRC's text, follows the internal results, and refuses when a file is pending", async () => {
    const m = await migratedDb();
    const sheet = "46210-PNN-GH-001-0-NA-26040";
    const metrc = "45999-PNN-GH-001-1-NA-26040";
    seedBatch(m, { id: "hb-old", hbn: sheet, serial: 40, farm: "PNN" });
    seedMirror(m, { tag: "1A4050300000000000000F40", harvest: metrc, item: "BUD - After Party - PNN - O" });
    m.run(
      `INSERT INTO internal_test_results (id, source, hbn, tested_at, analyte, value, unit, created_at, updated_at)
       VALUES ('itr-1', 'orange', ?, '2026-09-01', 'THC', 1, '%', '2026-09-01T00:00:00.000Z', '2026-09-01T00:00:00.000Z')`,
      sheet
    );
    const open = await landSheetWorkbook(
      m.db,
      sheetWorkbook("2026-09-21", [harvestRow({ "Harvest Batch Name": sheet, "Market Strain": "New Market", "Manicure?": "Yes", "METRC Harvest Tag": "1A4050300000000000000EEE" })]),
      "admin"
    );
    expect(m.get(`SELECT hbn, market_strain, manicure, metrc_harvest_tag FROM harvest_batches WHERE id = 'hb-old'`)).toEqual({
      hbn: metrc,
      market_strain: "New Market",
      manicure: 1,
      metrc_harvest_tag: "1A4050300000000000000EEE",
    });
    expect(m.get(`SELECT hbn FROM internal_test_results WHERE id = 'itr-1'`)).toEqual({ hbn: metrc });
    expect(m.get(`SELECT old_value, new_value, reason FROM record_change_log WHERE record_id = 'hb-old' AND field = 'hbn'`)).toEqual({
      old_value: sheet,
      new_value: metrc,
      reason: SYSTEM_REASON.hbn_follows_metrc,
    });
    expect(open.message).toContain(`${sheet} follows METRC ${metrc}`);

    const held = "46211-PNN-GH-001-0-NA-26041";
    const heldMetrc = "45998-PNN-GH-001-1-NA-26041";
    seedBatch(m, { id: "hb-held", hbn: held, serial: 41, farm: "PNN" });
    seedLot(m, "lot-held", "hb-held", "drying");
    seedMirror(m, { tag: "1A4050300000000000000F41", harvest: heldMetrc, item: "BUD - After Party - PNN - O" });
    const blocked = await landSheetWorkbook(
      m.db,
      sheetWorkbook("2026-09-21", [harvestRow({ "Harvest Batch Name": held, "Market Strain": "Held Market" })]),
      "upload"
    );
    expect(m.get(`SELECT hbn, market_strain FROM harvest_batches WHERE id = 'hb-held'`)).toEqual({ hbn: held, market_strain: "Held Market" });
    expect(blocked.message).toContain(`${held}(1).csv`);
    expect(m.get(`SELECT COUNT(*) AS n FROM record_change_log WHERE record_id = 'hb-held' AND field = 'hbn'`)).toEqual({ n: 0 });
  });
});
