import { describe, expect, it } from "vitest";
import { etInstant } from "../src/farmday";
import { adminGroupPage } from "../src/html";
import { app } from "../src/index";
import {
  LAB_SAMPLES_FEED_PATH,
  LAB_SAMPLES_LAST_LOAD_KEY,
  LAB_SAMPLES_PATH,
  LAB_SAMPLES_REASON_FEED,
  LAB_SAMPLES_REASON_UPLOAD,
  SAMPLE_HEADERS,
  coaInstant,
  feedLabSamples,
  intakeDate,
  labSamplesPage,
  landLabSamples,
  loadLabSamplesPage,
  rawRowsFromObjects,
  uploadLabSamples,
  type LabSample,
} from "../src/labsamples";
import { backLinkFor } from "../src/nav";
import { buildXlsxBook, type XlsxCell } from "../src/xlsx";
import { migratedDb } from "./migrated";

const T1 = "2026-10-19T06:00:00.000Z";
const T2 = "2026-10-20T10:00:00.000Z";
const REAL_COA = 46290.6076388889;

function serial(date: string, hhmm: string): number {
  const [year, month, day] = date.split("-").map(Number);
  const [hh, mm] = hhmm.split(":").map(Number);
  const days = (Date.UTC(year, month - 1, day) - Date.UTC(1899, 11, 30)) / 86_400_000;
  return days + (hh * 60 + mm) / 1440;
}

const FIVE: Array<Record<string, string | number | null>> = [
  {
    "Lab Code": "RAS-260921-031",
    "Intake Date": 46286,
    "Product Code": "BUD",
    Product: "Bulk",
    Strain: "Sample Alpha",
    Farm: "PNS",
    "Metrc Tag": "1A4050300061761000001032",
    "Test Type": "First-time",
    Status: "Completed",
    Result: "Fail",
    "Failure Mode": "Coliform",
    "Coliforms (CFU/g)": 11000.5,
    "Total THC %": 0.2743,
    "COA Posted (ET)": REAL_COA,
    "TAT (days)": 4.607638888897782,
    "Batch Qty (g)": 10.5,
    "Freed Lbs": 50,
  },
  {
    "Lab Code": "RAS-260921-032",
    "Intake Date": "2026-10-01",
    "Product Code": "BUD",
    Product: "Bulk",
    Strain: "Sample Beta",
    Farm: "PNN",
    "Test Type": "First-time",
    Status: "Completed",
    Result: "Pass",
    "Failure Mode": "Pass",
    "Total THC %": 27.43,
    "COA Posted (ET)": "2026-10-31 12:00",
    "TAT (days)": 2.5,
    "Batch Qty (g)": 1000,
  },
  {
    "Lab Code": "RAS-261019-001",
    "Intake Date": "10/19/2026",
    "Test Type": "First-time",
    Status: "In Process",
    Strain: "Sample Gamma",
    Farm: "ARL",
  },
  {
    "Lab Code": "RAS-261101-001",
    "Intake Date": "2026-11-01",
    "Test Type": "Retest",
    Status: "Completed",
    Result: "Pass",
    "COA Posted (ET)": serial("2026-11-01", "00:30"),
    "Batch Qty (g)": 448,
  },
  {
    "Lab Code": "RAS-261101-002",
    "Intake Date": "2026-11-01",
    "Test Type": "Internal QA",
    Status: "Completed",
    Result: "Fail",
    "Failure Mode": "Yeast",
    "Yeast & Mold (CFU/g)": 400,
    "COA Posted (ET)": "11/1/2026 3:00 AM",
    "Other Failed Analyte": "Foreign matter",
  },
];

function book(records: Array<Record<string, string | number | null>>, headers: readonly string[] = [...SAMPLE_HEADERS].reverse()): Uint8Array {
  const rows = records.map((record) =>
    headers.map((header): XlsxCell => {
      const value = record[header];
      if (typeof value === "number") return { number: value };
      if (value) return { text: value };
      return {};
    })
  );
  return buildXlsxBook([
    { sheetName: "Notes", headers: ["Lab Code"], rows: [[{ text: "RAS-IGNORE-ME" }]], plainNumbers: true },
    { sheetName: "Samples", headers: [...headers], rows, plainNumbers: true },
  ]);
}

function stored(m: Awaited<ReturnType<typeof migratedDb>>, code: string): LabSample {
  return m.get(`SELECT * FROM lab_samples WHERE lab_code = ?`, code) as unknown as LabSample;
}

describe("TL1 lab samples door", () => {
  it("turns Eastern COA times into ISO instants across the November change", () => {
    expect(intakeDate(46286)).toBe("2026-09-21");
    expect(intakeDate("10/19/2026")).toBe("2026-10-19");
    expect(intakeDate("not a date")).toBeNull();
    expect(coaInstant(REAL_COA)).toBe("2026-09-25T18:35:00.000Z");
    expect(coaInstant(REAL_COA)).toBe(etInstant("2026-09-25", "14:35"));
    expect(coaInstant(serial("2026-10-31", "12:00"))).toBe("2026-10-31T16:00:00.000Z");
    expect(coaInstant("2026-10-31 12:00")).toBe("2026-10-31T16:00:00.000Z");
    expect(coaInstant(serial("2026-11-01", "00:30"))).toBe("2026-11-01T04:30:00.000Z");
    expect(coaInstant("11/1/2026 12:30 AM")).toBe("2026-11-01T04:30:00.000Z");
    expect(coaInstant(serial("2026-11-01", "03:00"))).toBe("2026-11-01T08:00:00.000Z");
    expect(coaInstant("11/1/2026 3:00 AM")).toBe("2026-11-01T08:00:00.000Z");
    expect(coaInstant("2026-11-02 12:00")).toBe("2026-11-02T17:00:00.000Z");
    expect(coaInstant("")).toBeNull();
  });

  it("uploads five rows from the Samples sheet, writes nothing the second time, and logs one status change", async () => {
    expect(SAMPLE_HEADERS).toHaveLength(30);
    const m = await migratedDb();
    expect(m.get(`SELECT COUNT(*) AS n FROM lab_samples`)).toEqual({ n: 0 });
    const indexes = m.all(`SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'lab_samples'`).map((row) => row.name);
    expect(indexes).toEqual(expect.arrayContaining(["lab_samples_intake_date", "lab_samples_coa_posted_at"]));

    const first = await uploadLabSamples(m.db, book(FIVE), "person-1", T1);
    expect(first).toMatchObject({ received: 5, inserted: 5, updated: 0, unchanged: 0, refused: 0, refusals: [] });
    expect(m.get(`SELECT COUNT(*) AS n FROM lab_samples`)).toEqual({ n: 5 });
    expect(m.get(`SELECT lab_code FROM lab_samples WHERE lab_code = 'RAS-IGNORE-ME'`)).toBeUndefined();
    const row = stored(m, "RAS-260921-031");
    expect(row).toMatchObject({
      lab_name: null,
      intake_date: "2026-09-21",
      status: "Completed",
      result: "Fail",
      coliforms_cfu: 11001,
      total_thc_pct: 27.43,
      coa_posted_at: "2026-09-25T18:35:00.000Z",
      batch_qty_g: 11,
      source: "upload",
      first_seen_at: T1,
    });
    expect(row.tat_days).toBeCloseTo(4.607639, 6);
    expect(stored(m, "RAS-260921-032").coa_posted_at).toBe("2026-10-31T16:00:00.000Z");
    expect(stored(m, "RAS-260921-032").total_thc_pct).toBe(27.43);
    expect(stored(m, "RAS-261019-001")).toMatchObject({ status: "In Process", result: null, coa_posted_at: null, intake_date: "2026-10-19" });
    expect(stored(m, "RAS-261101-001").coa_posted_at).toBe("2026-11-01T04:30:00.000Z");
    expect(stored(m, "RAS-261101-002").coa_posted_at).toBe("2026-11-01T08:00:00.000Z");
    expect(m.all(`SELECT record_id FROM record_change_log WHERE record_table = 'lab_samples'`)).toHaveLength(0);

    const again = await uploadLabSamples(m.db, book(FIVE), "person-1", T2);
    expect(again).toMatchObject({ received: 5, inserted: 0, updated: 0, unchanged: 5, refused: 0 });
    const againRow = m.get(`SELECT first_seen_at, changed_at FROM lab_samples WHERE lab_code = 'RAS-260921-031'`) as { first_seen_at: string; changed_at: string };
    expect(againRow).toEqual({ first_seen_at: T1, changed_at: T1 });

    const freed = FIVE.map((record, index) => (index === 0 ? { ...record, "Freed Lbs": 0 } : record));
    const ignored = await uploadLabSamples(m.db, book(freed), "person-1", T2);
    expect(ignored).toMatchObject({ inserted: 0, updated: 0, unchanged: 5 });

    const changed = FIVE.map((record, index) => (index === 0 ? { ...record, Status: "In Process" } : record));
    const third = await uploadLabSamples(m.db, book(changed), "person-1", T2);
    expect(third).toMatchObject({ received: 5, inserted: 0, updated: 1, unchanged: 4, refused: 0 });
    expect(stored(m, "RAS-260921-031")).toMatchObject({ status: "In Process", changed_at: T2, first_seen_at: T1, source: "upload" });
    const logs = m.all(
      `SELECT field, old_value, new_value, reason, actor_person_id FROM record_change_log WHERE record_table = 'lab_samples' ORDER BY field`
    );
    expect(logs).toEqual([
      { field: "status", old_value: "Completed", new_value: "In Process", reason: LAB_SAMPLES_REASON_UPLOAD, actor_person_id: "person-1" },
    ]);

    const kept = await uploadLabSamples(m.db, book(FIVE.slice(1)), "person-1", T2);
    expect(kept).toMatchObject({ received: 4, inserted: 0, updated: 0, unchanged: 4 });
    expect(stored(m, "RAS-260921-031").status).toBe("In Process");
  });

  it("takes the same rows as JSON, refuses a post over 2,000, and lands the rest when one row has no lab code", async () => {
    const m = await migratedDb();
    const first = await feedLabSamples(m.db, { rows: FIVE }, null, T1);
    expect(first).toMatchObject({ received: 5, inserted: 5, updated: 0, unchanged: 0, refused: 0 });
    expect(stored(m, "RAS-260921-031")).toMatchObject({
      total_thc_pct: 27.43,
      coa_posted_at: "2026-09-25T18:35:00.000Z",
      batch_qty_g: 11,
      source: "feed",
    });
    const again = await feedLabSamples(m.db, { rows: FIVE }, null, T2);
    expect(again).toMatchObject({ inserted: 0, updated: 0, unchanged: 5, refused: 0 });
    const changed = FIVE.map((record, index) => (index === 0 ? { ...record, Status: "In Process" } : record));
    const third = await feedLabSamples(m.db, { rows: changed }, "person-2", T2);
    expect(third).toMatchObject({ updated: 1, unchanged: 4 });
    expect(
      m.get(`SELECT reason, field, old_value, new_value FROM record_change_log WHERE record_table = 'lab_samples' AND record_id = 'RAS-260921-031'`)
    ).toEqual({ reason: LAB_SAMPLES_REASON_FEED, field: "status", old_value: "Completed", new_value: "In Process" });

    const fresh = await migratedDb();
    const rows = Array.from({ length: 2001 }, (_, index) => ({ "Lab Code": `RAS-${index}`, "Intake Date": "2026-09-21" }));
    await expect(feedLabSamples(fresh.db, { rows }, null, T1)).rejects.toMatchObject({
      status: 400,
      message: "A lab samples post takes at most 2,000 rows.",
    });
    expect(fresh.get(`SELECT COUNT(*) AS n FROM lab_samples`)).toEqual({ n: 0 });
    expect(fresh.get(`SELECT value FROM app_config WHERE key = ?`, LAB_SAMPLES_LAST_LOAD_KEY)).toBeUndefined();
    await expect(feedLabSamples(fresh.db, { samples: [] }, null, T1)).rejects.toMatchObject({ status: 400 });

    const mixed = await feedLabSamples(
      fresh.db,
      {
        rows: [
          { "Lab Code": "", "Intake Date": "2026-09-21" },
          { "Lab Code": "RAS-OK", "Intake Date": "2026-09-21", Status: "Completed" },
          { "Intake Date": "nope" },
          { "Lab Code": "RAS-BAD", "Intake Date": "nope" },
        ],
      },
      null,
      T1
    );
    expect(mixed).toMatchObject({ received: 4, inserted: 1, updated: 0, unchanged: 0, refused: 3 });
    expect(mixed.refusals).toEqual([
      "Row 1 has no lab code.",
      "Row 3 has no lab code.",
      "Row 4 has an unreadable intake date.",
    ]);
    expect(fresh.all(`SELECT lab_code FROM lab_samples`)).toEqual([{ lab_code: "RAS-OK" }]);

    const sheet = await uploadLabSamples(
      fresh.db,
      book([
        { "Lab Code": "RAS-OK-2", "Intake Date": "2026-09-22", Status: "Completed" },
        { "Lab Code": "", "Intake Date": "2026-09-22" },
      ]),
      null,
      T2
    );
    expect(sheet.refusals).toEqual(["Row 3 has no lab code."]);
    expect(fresh.get(`SELECT lab_code FROM lab_samples WHERE lab_code = 'RAS-OK-2'`)).toEqual({ lab_code: "RAS-OK-2" });
  });

  it("keeps the newest load on the last load key", async () => {
    const m = await migratedDb();
    await landLabSamples(m.db, rawRowsFromObjects(FIVE, 1), "upload", "person-1", T1);
    await landLabSamples(m.db, rawRowsFromObjects(FIVE, 1), "feed", null, T2);
    const page = await loadLabSamplesPage(m.db);
    expect(page.last).toMatchObject({ at: T2, source: "feed", received: 5, inserted: 0, updated: 0, unchanged: 5, refused: 0 });
    expect(page.counts).toMatchObject({ samples: 5, completed: 4, inProcess: 1, newestIntake: "2026-11-01" });
    expect(page.counts.newestCoa).toBe("2026-11-01T08:00:00.000Z");
    const html = labSamplesPage(page, "en", { banner: page.last });
    expect(html).toContain("Received 5. Inserted 0. Updated 0. Unchanged 5. Refused 0.");
    expect(html).toContain("5 samples. 4 completed. 1 in process.");
    expect(html).toContain("2026-11-01 03:00");
    expect(html).not.toMatch(/[\u2013\u2014]/);
    expect(JSON.stringify(page.last)).not.toMatch(/[\u2013\u2014]/);
    const spanish = labSamplesPage(page, "es", { banner: page.last });
    expect(spanish).toContain("Muestras de laboratorio");
    expect(spanish).toContain("Recibidas 5.");
    expect(spanish).not.toMatch(/[\u2013\u2014]/);
  });

  it("serves the upload behind the PIN and the feed on the service door", async () => {
    const m = await migratedDb();
    const env = {
      DB: m.db,
      THEME: "grip",
      GF_ALLOW_FIXTURE_NOW: "1",
      ASSETS: { fetch: () => Promise.resolve(new Response("no", { status: 404 })) },
    } as unknown as Env;
    const locked = await app.request(LAB_SAMPLES_PATH, {}, env);
    expect(locked.status).toBe(401);
    const open = await app.request(LAB_SAMPLES_PATH, { headers: { cookie: "gf_pin=21319" } }, env);
    expect(open.status).toBe(200);
    const body = await open.text();
    expect(body).toContain("Lab Samples");
    expect(body).toContain('name="file"');
    expect(body).toContain("No lab samples load yet.");
    expect(body).toContain("0 samples. 0 completed. 0 in process.");
    expect(body).not.toMatch(/[\u2013\u2014]/);
    expect(adminGroupPage("settings", "en")).toContain(`href="${LAB_SAMPLES_PATH}"`);
    expect(backLinkFor(LAB_SAMPLES_PATH)).toEqual({ href: "/admin/settings", label: "Admin Settings" });

    const form = new FormData();
    form.set("file", new File([book(FIVE)], "samples.xlsx"));
    const posted = await app.request(
      LAB_SAMPLES_PATH,
      { method: "POST", body: form, headers: { cookie: "gf_pin=21319", "x-gf-now": T1 } },
      env
    );
    expect(posted.status).toBe(303);
    expect(posted.headers.get("location") ?? "").toContain(`${LAB_SAMPLES_PATH}?loaded=1`);
    const loaded = await app.request(`${LAB_SAMPLES_PATH}?loaded=1`, { headers: { cookie: "gf_pin=21319" } }, env);
    const loadedBody = await loaded.text();
    expect(loadedBody).toContain("Inserted 5.");
    expect(loadedBody).toContain('data-samples="5"');
    expect(loadedBody).toContain('data-completed="4"');
    expect(loadedBody).toContain('data-in-process="1"');

    const fed = await app.request(
      LAB_SAMPLES_FEED_PATH,
      {
        method: "POST",
        headers: { "content-type": "application/json", "x-gf-now": T2 },
        body: JSON.stringify({ rows: FIVE }),
      },
      env
    );
    expect(fed.status).toBe(200);
    expect(await fed.json()).toMatchObject({ ok: true, inserted: 0, updated: 0, unchanged: 5, refused: 0 });

    const fronted = { ...env, ACCESS_FRONTED: "1" } as unknown as Env;
    const beforeService = m.all(`SELECT id FROM people`).length;
    const service = await app.request(
      LAB_SAMPLES_FEED_PATH,
      {
        method: "POST",
        headers: { "content-type": "application/json", "x-gf-now": T2 },
        body: JSON.stringify({ rows: [{ ...FIVE[0], Status: "In Process" }] }),
      },
      fronted
    );
    expect(service.status).toBe(200);
    expect(await service.json()).toMatchObject({ ok: true, updated: 1 });
    expect(m.get(`SELECT actor_person_id, reason FROM record_change_log WHERE record_table = 'lab_samples' AND reason = ?`, LAB_SAMPLES_REASON_FEED)).toMatchObject({
      actor_person_id: null,
      reason: LAB_SAMPLES_REASON_FEED,
    });
    expect(m.all(`SELECT id FROM people`)).toHaveLength(beforeService);
    const other = await app.request("/feeds/trim-weighs.json", { method: "POST", body: "{}" }, fronted);
    expect(other.status).toBe(403);
  });

  it("applies migration 0112 twice without changing the table", async () => {
    const fs = (await import("node:" + "fs")) as { readFileSync(path: URL, encoding: "utf8"): string };
    const sql = fs.readFileSync(new URL("../migrations/0112_lab_samples.sql", import.meta.url), "utf8");
    expect(sql).not.toMatch(/\r/);
    expect(sql.toLowerCase()).not.toContain("insert into lab_samples");
    const sqliteMod = (await import("node:" + "sqlite")) as {
      DatabaseSync: new (path: string) => {
        exec(sql: string): void;
        prepare(sql: string): { run(): void; get(): unknown };
      };
    };
    const sqlite = new sqliteMod.DatabaseSync(":memory:");
    sqlite.exec(sql);
    sqlite.exec(sql);
    sqlite.prepare(`INSERT INTO lab_samples (lab_code, intake_date, source, first_seen_at, changed_at, received_at) VALUES ('RAS-1', '2026-09-21', 'upload', 't', 't', 't')`).run();
    sqlite.exec(sql);
    expect(sqlite.prepare(`SELECT COUNT(*) AS n FROM lab_samples`).get()).toEqual({ n: 1 });
  });
});
