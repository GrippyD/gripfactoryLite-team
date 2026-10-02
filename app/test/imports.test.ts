import { describe, expect, it } from "vitest";
import { HttpError } from "../src/audit";
import { voidRecord, queueImport } from "../src/actions";
import {
  IMPORT_MAX_BYTES,
  IMPORT_STATUS,
  XLSB_MAX_BYTES,
  XLSX_MIME,
  asStoredBytes,
  assertImportUpload,
  attachmentFilename,
  formatByteSize,
  importBasename,
  importContentType,
  importKindFromFilename,
} from "../src/imports";
import { t } from "../src/i18n";
import { smokeSheetWorkbook } from "../src/sheetsync";
import { app } from "../src/index";
import { migratedDb, seedPerson } from "./migrated";

type Row = Record<string, unknown>;

function makeMockDb() {
  const person = {
    id: "p-dev",
    display_name: "dev",
    email: "dev@local",
    is_active: 1,
    deleted_at: null as string | null,
  };
  const people = [person];
  const imports: Row[] = [];
  const logs: Row[] = [];
  const config: Record<string, string> = { admin_pin: "21319" };

  function norm(sql: string) {
    return sql.replace(/\s+/g, " ").trim().toLowerCase();
  }

  function exec(sql: string, args: unknown[]) {
    const q = norm(sql);
    if (q.includes("from people") && q.includes("lower(email)")) {
      const email = String(args[0] ?? "");
      return people.find((p) => p.email === email && !p.deleted_at) ?? null;
    }
    if (q.includes("from people") && q.includes("where id")) {
      const id = String(args[0] ?? "");
      const hit = people.find((p) => p.id === id && !p.deleted_at);
      return hit ? { id: hit.id, display_name: hit.display_name, is_active: hit.is_active } : null;
    }
    if (q.includes("from people") && q.includes("is_active = 1")) {
      return people
        .filter((p) => p.is_active === 1 && !p.deleted_at)
        .map((p) => ({ id: p.id, display_name: p.display_name, is_active: p.is_active }));
    }
    if (q.startsWith("insert into people")) {
      people.push({
        id: String(args[0]),
        display_name: String(args[1]),
        email: String(args[2]),
        is_active: 1,
        deleted_at: null,
      });
      return { success: true };
    }
    if (q.includes("from app_config") && q.includes("where key")) {
      const value = config[String(args[0])];
      return value != null ? { value } : null;
    }
    if (q.startsWith("insert into import_queue")) {
      imports.push({
        id: args[0],
        filename: args[1],
        kind: args[2],
        byte_size: args[3],
        content: args[4],
        status: args[5],
        notes: null,
        created_at: args[6],
        created_by: args[7],
        updated_at: args[8],
        updated_by: args[9],
        deleted_at: null,
        deleted_by: null,
        delete_reason: null,
      });
      return { success: true };
    }
    if (q.includes("from import_queue q")) {
      return imports
        .filter((r) => !r.deleted_at)
        .map((r) => ({
          id: r.id,
          filename: r.filename,
          kind: r.kind,
          byte_size: r.byte_size,
          status: r.status,
          created_at: r.created_at,
          created_by: r.created_by,
          uploaded_by: person.display_name,
        }));
    }
    if (q.includes("from import_queue") && q.includes("where id")) {
      return imports.find((r) => r.id === args[0]) ?? null;
    }
    if (q.startsWith("update import_queue")) {
      const row = imports.find((r) => r.id === args[args.length - 1]);
      if (row) {
        row.deleted_at = args[0];
        row.deleted_by = args[1];
        row.delete_reason = args[2];
        row.updated_at = args[3];
        row.updated_by = args[4];
      }
      return { success: true };
    }
    if (q.startsWith("insert into record_change_log")) {
      logs.push({
        id: args[0],
        record_table: args[1],
        record_id: args[2],
        field: args[3],
        old_value: args[4],
        new_value: args[5],
        actor_person_id: args[6],
        reason: args[7],
        changed_at: args[8],
      });
      return { success: true };
    }
    throw new Error(`unhandled sql: ${sql}`);
  }

  function stmt(sql: string) {
    const args: unknown[] = [];
    const self = {
      bind(...next: unknown[]) {
        args.push(...next);
        return self;
      },
      async first() {
        const r = exec(sql, args);
        return Array.isArray(r) ? (r[0] ?? null) : r;
      },
      async all() {
        const r = exec(sql, args);
        return { results: Array.isArray(r) ? r : r ? [r] : [] };
      },
      async run() {
        exec(sql, args);
        return { success: true };
      },
    };
    return self;
  }

  return {
    logs,
    imports,
    prepare: (sql: string) => stmt(sql),
    async batch(stmts: { run: () => Promise<unknown> }[]) {
      for (const s of stmts) await s.run();
    },
  };
}

function env(db: ReturnType<typeof makeMockDb>): Env {
  return {
    DB: db as unknown as D1Database,
    THEME: "grip",
    ASSETS: { fetch: () => Promise.resolve(new Response("no", { status: 404 })) } as unknown as Env["ASSETS"],
  };
}

describe("import helpers (owner ruling 2026-09-02)", () => {
  it("reads kind from the extension, case-insensitive, basename only", () => {
    expect(importBasename("C:\\\\tmp\\\\Lots.CSV")).toBe("Lots.CSV");
    expect(importKindFromFilename("Lots.CSV")).toBe("csv");
    expect(importKindFromFilename("book.XLSX")).toBe("xlsx");
    expect(importKindFromFilename("dash.XLSM")).toBe("xlsm");
    expect(importKindFromFilename("notes.pdf")).toBeNull();
    expect(importKindFromFilename("noext")).toBeNull();
    expect(importContentType("csv")).toBe("text/csv");
    expect(importContentType("xlsx")).toBe(XLSX_MIME);
    expect(IMPORT_STATUS.queued).toBe("queued");
  });

  it("formats byte sizes for display only", () => {
    expect(formatByteSize(42)).toBe("42 B");
    expect(formatByteSize(1024)).toBe("1 KB");
    expect(formatByteSize(1048576)).toBe("1,024 KB");
    expect(attachmentFilename('bad\r\nname".csv')).toBe("bad__name_.csv");
  });

  it("refuses a wrong kind and an oversize file, accepts a small csv", () => {
    expect(assertImportUpload("ok.csv", 12)).toBe("csv");
    expect(assertImportUpload("ok.xlsx", IMPORT_MAX_BYTES)).toBe("xlsx");
    try {
      assertImportUpload("notes.pdf", 12);
      throw new Error("expected refuse");
    } catch (err) {
      expect(err).toBeInstanceOf(HttpError);
      expect((err as HttpError).status).toBe(400);
      expect((err as HttpError).message).toBe("Only csv, xlsx, xlsb, and xlsm files can be queued.");
    }
    try {
      assertImportUpload("big.csv", IMPORT_MAX_BYTES + 1);
      throw new Error("expected refuse");
    } catch (err) {
      expect(err).toBeInstanceOf(HttpError);
      expect((err as HttpError).status).toBe(400);
      expect((err as HttpError).message).toContain("1 MB cap");
    }
    expect(assertImportUpload("book.xlsm", XLSB_MAX_BYTES)).toBe("xlsm");
    try {
      assertImportUpload("big.xlsm", XLSB_MAX_BYTES + 1);
      throw new Error("expected refuse");
    } catch (err) {
      expect(err).toBeInstanceOf(HttpError);
      expect((err as HttpError).message).toBe("That file is over the 8 MB cap.");
    }
    expect(t("es", "That file is over the 8 MB cap.")).toBe("Ese archivo supera el tope de 8 MB.");
    expect(t("es", "Only csv, xlsx, xlsb, and xlsm files can be queued.")).toContain("xlsm");
  });

  it("round-trips stored bytes, including D1's number-array BLOB readback", () => {
    const raw = new Uint8Array([1, 2, 3, 9]);
    expect([...asStoredBytes(raw)]).toEqual([1, 2, 3, 9]);
    expect([...asStoredBytes(raw.buffer)]).toEqual([1, 2, 3, 9]);
    expect([...asStoredBytes([1, 2, 3, 9])]).toEqual([1, 2, 3, 9]);
  });
});

describe("import queue HTTP (owner ruling 2026-09-02)", () => {
  it("serves /reports 200 with no PIN cookie", async () => {
    const db = makeMockDb();
    const res = await app.request("/reports", {}, env(db));
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain("<h1>Reports</h1>");
    expect(body).toContain("/reports/inventory");
    expect(body).toContain('class="reports-link"');
    expect(body).not.toContain("Enter PIN");
  });

  it("serves /ops group pages and 404s an unknown key, with no PIN", async () => {
    const db = makeMockDb();
    const harvest = await app.request("/ops/harvest_ops", {}, env(db));
    expect(harvest.status).toBe(200);
    expect(await harvest.text()).toContain("Harvest Operations</h1>");
    const market = await app.request("/ops/marketplace", {}, env(db));
    expect(market.status).toBe(200);
    const marketHtml = await market.text();
    expect(marketHtml).toContain("Marketplace");
    expect(marketHtml).toContain('href="/marketplace"');
    expect(marketHtml).not.toContain("Enter PIN");
    const ghost = await app.request("/ops/not_a_group", {}, env(db));
    expect(ghost.status).toBe(404);
    expect(await ghost.text()).toContain("Not found");
  });

  it("PIN-gates /admin/imports and accepts a small csv once unlocked", async () => {
    const db = makeMockDb();
    const locked = await app.request("/admin/imports", {}, env(db));
    expect(locked.status).toBe(401);
    expect(await locked.text()).toContain("Enter PIN");

    const headers = { cookie: "gf_pin=21319" };
    const empty = await app.request("/admin/imports", { headers }, env(db));
    expect(empty.status).toBe(200);
    expect(await empty.text()).toContain("Nothing queued.");

    const payload = new TextEncoder().encode("hbn,grams\nA,1.00\n");
    const body = new FormData();
    body.set("file", new File([payload], "lots.csv", { type: "text/csv" }));
    const post = await app.request("/admin/imports", { method: "POST", headers, body }, env(db));
    expect(post.status).toBe(303);
    expect(post.headers.get("location")).toContain("/admin/imports?ok=file_queued");
    expect(db.imports).toHaveLength(1);
    expect(db.imports[0]?.filename).toBe("lots.csv");
    expect(db.imports[0]?.kind).toBe("csv");
    expect(db.imports[0]?.status).toBe("queued");
    expect(db.logs.some((l) => l.reason === "file queued")).toBe(true);

    const listed = await app.request("/admin/imports?ok=file_queued", { headers }, env(db));
    const html = await listed.text();
    expect(html).toContain("lots.csv");
    expect(html).toContain("File queued.");

    const id = String(db.imports[0]?.id);
    const dl = await app.request(`/admin/imports/${id}/download`, { headers }, env(db));
    expect(dl.status).toBe(200);
    expect(dl.headers.get("content-type")).toContain("text/csv");
    expect(dl.headers.get("content-disposition")).toContain("lots.csv");
    const bytes = new Uint8Array(await dl.arrayBuffer());
    expect([...bytes]).toEqual([...payload]);
  });

  it("refuses an oversize file and a wrong kind", async () => {
    const db = makeMockDb();
    const headers = { cookie: "gf_pin=21319" };
    const huge = new FormData();
    huge.set("file", new File([new Uint8Array(IMPORT_MAX_BYTES + 1)], "big.csv", { type: "text/csv" }));
    const over = await app.request("/admin/imports", { method: "POST", headers, body: huge }, env(db));
    expect(over.status).toBe(400);
    expect(await over.text()).toContain("1 MB cap");

    const pdf = new FormData();
    pdf.set("file", new File([new Uint8Array([1, 2, 3])], "notes.pdf", { type: "application/pdf" }));
    const wrong = await app.request("/admin/imports", { method: "POST", headers, body: pdf }, env(db));
    expect(wrong.status).toBe(400);
    expect(await wrong.text()).toContain("Only csv, xlsx, xlsb, and xlsm files can be queued.");
    expect(db.imports).toHaveLength(0);
  });

  it("voids a queued file with a reason through the record path", async () => {
    const db = makeMockDb();
    const form = new FormData();
    form.set("file", new File([new Uint8Array([9, 8, 7])], "keep.csv", { type: "text/csv" }));
    form.set("person_id", "p-dev");
    await queueImport(db as unknown as D1Database, form);
    const id = String(db.imports[0]?.id);
    const voidForm = new FormData();
    voidForm.set("person_id", "p-dev");
    voidForm.set("reason", "wrong file");
    voidForm.set("back", "/admin/imports");
    const result = await voidRecord(db as unknown as D1Database, "import_queue", id, voidForm);
    expect(result.redirect).toBe("/admin/imports?ok=voided");
    expect(db.imports[0]?.deleted_at).toBeTruthy();
    expect(db.imports[0]?.delete_reason).toBe("wrong file");
    expect(db.logs.some((l) => l.field === "deleted_at" && l.reason === "wrong file")).toBe(true);
  });

  it("lands an xlsm on the spot, still queues an xlsx, and refuses over the cap", async () => {
    const m = await migratedDb();
    const person = seedPerson(m);
    const bytes = smokeSheetWorkbook("2026-09-21");
    const xlsm = new FormData();
    xlsm.set("person_id", person);
    xlsm.set("file", new File([bytes], "dash.xlsm"));
    const landed = await queueImport(m.db, xlsm);
    expect(landed.redirect).toContain("ok=harvest_details");
    expect(landed.redirect).toContain("hseen=4");
    expect(landed.redirect).toContain("lseen=");
    expect(m.get(`SELECT trigger, source FROM sheet_sync_runs ORDER BY started_at DESC LIMIT 1`)).toEqual({ trigger: "upload", source: "labor" });
    expect(m.get(`SELECT COUNT(*) AS n FROM import_queue`)).toEqual({ n: 0 });
    const headers = { cookie: "gf_pin=21319" };
    const page = await app.request(landed.redirect, { headers }, env(m.db as unknown as ReturnType<typeof makeMockDb>));
    expect(page.status).toBe(200);
    expect(await page.text()).toContain("Harvest Details:");
    const xlsx = new FormData();
    xlsx.set("person_id", person);
    xlsx.set("file", new File([bytes], "dash.xlsx"));
    const queued = await queueImport(m.db, xlsx);
    expect(queued.redirect).toContain("ok=file_queued");
    expect(m.get(`SELECT kind FROM import_queue WHERE deleted_at IS NULL`)).toEqual({ kind: "xlsx" });
    const huge = new FormData();
    huge.set("person_id", person);
    huge.set("file", new File([new Uint8Array(XLSB_MAX_BYTES + 1)], "too-big.xlsm"));
    await expect(queueImport(m.db, huge)).rejects.toMatchObject({ message: "That file is over the 8 MB cap." });
  });
});
