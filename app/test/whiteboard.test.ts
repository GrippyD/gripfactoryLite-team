import { describe, expect, it } from "vitest";
import { app } from "../src/index";
import { adminHomePage } from "../src/html";
import { backLinkFor } from "../src/nav";
import { directorHomePage, loadDirectorHome } from "../src/director";
import {
  WB_EXPORT_HEADERS,
  WB_HEIC_PATH,
  WB_MANY_LINES,
  WB_OCR_MODEL_DEFAULT,
  WB_OCR_PROMPT,
  WB_PATH,
  checkPictureDataUrl,
  cleanBody,
  createWbNotes,
  linesFromModel,
  readingOrder,
  safeJson,
  screenLine,
  wbExportFilename,
  wbModelInput,
  wbModelText,
  type WbNote,
} from "../src/whiteboard";
import { DICT } from "../src/i18n";
import { readXlsxSheets } from "../src/xlsx";
import { migratedDb, type MigratedDb } from "./migrated";

const LEAD = "Lead.Person@Example.com";
const OTHER = "other@example.com";
const JPEG = "data:image/jpeg;base64," + btoa("not really a jpeg, the stub never looks");

type Calls = Array<{ model: string; input: Record<string, unknown> }>;

function envOf(m: MigratedDb, opts: { ai?: (model: string, input: Record<string, unknown>) => Promise<unknown>; calls?: Calls; model?: string } = {}): Env {
  const assets = {
    fetch: (req: Request) =>
      Promise.resolve(
        new URL(req.url).pathname === "/vendor/heic-to/heic-to.js" ? new Response("var HeicTo = function () {};", { status: 200 }) : new Response("no", { status: 404 })
      ),
  };
  const env: Record<string, unknown> = { DB: m.db, THEME: "grip", ASSETS: assets };
  if (opts.model) env.WB_OCR_MODEL = opts.model;
  if (opts.ai) {
    const run = opts.ai;
    env.AI = {
      run: (model: string, input: Record<string, unknown>) => {
        opts.calls?.push({ model, input });
        return run(model, input);
      },
    };
  }
  return env as unknown as Env;
}

function pinOf(m: MigratedDb): string {
  return String(m.get(`SELECT value FROM app_config WHERE key = 'admin_pin' AND deleted_at IS NULL`)?.value ?? "");
}

function headers(m: MigratedDb, email = LEAD, json = true): Record<string, string> {
  return {
    "Cf-Access-Authenticated-User-Email": email,
    cookie: `gf_pin=${pinOf(m)}`,
    ...(json ? { "content-type": "application/json" } : {}),
  };
}

async function call(m: MigratedDb, env: Env, method: string, path: string, body?: unknown, email = LEAD) {
  const res = await app.request(path, { method, headers: headers(m, email, body !== undefined), body: body === undefined ? undefined : JSON.stringify(body) }, env);
  const text = await res.text();
  let data: Record<string, unknown> = {};
  try {
    data = JSON.parse(text) as Record<string, unknown>;
  } catch {
    data = { text };
  }
  return { status: res.status, data, text, res };
}

describe("WB1, the team whiteboard", () => {
  it("0127 lays wb_notes: text 1 to 2000, a place on the surface, the originator lower case, a delete with its kind", async () => {
    const m = await migratedDb();
    const T = "2026-11-17T15:00:00.000Z";
    const ins = (id: string, body: string, x: number, y: number, email = "a@x.com", source = "typed") =>
      m.run(
        `INSERT INTO wb_notes (id, body, x, y, source, originator_email, created_at, updated_at, updated_by_email) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        id, body, x, y, source, email, T, T, email
      );
    ins("a", "hello", 0, 0);
    expect(m.get(`SELECT board_key FROM wb_notes WHERE id = 'a'`)).toEqual({ board_key: "team" });
    expect(() => ins("b", "   ", 10, 10)).toThrow(/CHECK/);
    expect(() => ins("c", "x".repeat(2001), 10, 10)).toThrow(/CHECK/);
    ins("c2", "x".repeat(2000), 3200, 2000);
    expect(() => ins("d", "x", 3201, 10)).toThrow(/CHECK/);
    expect(() => ins("e", "x", 10, -1)).toThrow(/CHECK/);
    expect(() => ins("f", "x", 10, 10, "A@x.com")).toThrow(/CHECK/);
    expect(() => ins("g", "x", 10, 10, "a@x.com", "photo")).toThrow(/CHECK/);
    expect(() => m.run(`UPDATE wb_notes SET deleted_at = ? WHERE id = 'a'`, T)).toThrow(/CHECK/);
    expect(() => m.run(`UPDATE wb_notes SET deleted_at = ?, delete_kind = 'clear_all' WHERE id = 'a'`, T)).toThrow(/CHECK/);
    m.run(`UPDATE wb_notes SET deleted_at = ?, delete_kind = 'one' WHERE id = 'a'`, T);
    m.run(`UPDATE wb_notes SET deleted_at = ?, delete_kind = 'clear_all', clear_batch = 'b1' WHERE id = 'c2'`, T);
  });

  it("screens a line: a PIN, a password, an email and a phone number are flagged; plain notes are not", () => {
    expect(screenLine("Order more totes for Silo 3")).toEqual([]);
    expect(screenLine("Meet at 10:30 by the dry room")).toEqual([]);
    expect(screenLine("Harvest 26 lots 26193 to 26198")).toEqual([]);
    expect(screenLine("Admin PIN 4417")).toEqual(["pin"]);
    expect(screenLine("gate code: 2580")).toEqual(["pin"]);
    expect(screenLine("clave 9911")).toEqual(["pin"]);
    expect(screenLine("  44172 ")).toEqual(["pin"]);
    expect(screenLine("wifi password is grow4ever")).toEqual(["password"]);
    expect(screenLine("Contraseña del portal")).toEqual(["password"]);
    expect(screenLine("ask jo.smith@grip.example about tags")).toEqual(["email"]);
    expect(screenLine("Call (734) 555-0199 for parts")).toEqual(["phone"]);
    expect(screenLine("734.555.0199")).toEqual(["phone"]);
    expect(screenLine("pin 1234, call 734-555-0199")).toEqual(["pin", "phone"]);
  });

  it("reads the model's answer as the note's lines, kept as written: numbers and bullets stay, every dash a hyphen, fences and NONE go, 60 lines at most, 500 characters each", () => {
    expect(linesFromModel("```\nBusiness Team\n- Order totes\n2) Fix the scale\n\u2022 Ask about labels\n* Count bags\n\n \"Quoted note\" \n```")).toEqual([
      "Business Team",
      "- Order totes",
      "2) Fix the scale",
      "- Ask about labels",
      "- Count bags",
      "Quoted note",
    ]);
    expect(linesFromModel("NONE")).toEqual([]);
    expect(linesFromModel("none.")).toEqual([]);
    expect(linesFromModel("\u2013 dash bullet\n\u2014 another\n11/12 \u2013 11/14\n*starred")).toEqual(["- dash bullet", "- another", "11/12 - 11/14", "*starred"]);
    expect(linesFromModel(Array.from({ length: 80 }, (_, i) => `line ${i}`).join("\n"))).toHaveLength(60);
    expect(linesFromModel("y".repeat(900))[0]).toHaveLength(500);
    expect(linesFromModel("26193 Gelato\n12 trays")).toEqual(["26193 Gelato", "12 trays"]);
  });

  it("asks the model in its own shape and reads whichever shape answers", () => {
    const now = wbModelInput(WB_OCR_MODEL_DEFAULT, JPEG) as { messages: Array<{ content: Array<{ type: string; text?: string; image_url?: { url: string } }> }> };
    expect(now.messages[0].content[0]).toEqual({ type: "text", text: WB_OCR_PROMPT });
    expect(now.messages[0].content[1]).toEqual({ type: "image_url", image_url: { url: JPEG } });
    const old = wbModelInput("@cf/meta/llama-3.2-11b-vision-instruct", JPEG) as { image: string; messages: Array<{ content: string }> };
    expect(old.image).toBe(JPEG);
    expect(old.messages[0].content).toBe(WB_OCR_PROMPT);
    expect(wbModelText("plain")).toBe("plain");
    expect(wbModelText({ response: "a\nb" })).toBe("a\nb");
    expect(wbModelText({ result: { response: "c" } })).toBe("c");
    expect(wbModelText({ choices: [{ message: { content: "d" } }] })).toBe("d");
    expect(wbModelText({ choices: [{ message: { content: [{ type: "text", text: "e" }, { type: "text", text: "f" }] } }] })).toBe("e\nf");
    expect(wbModelText(null)).toBe("");
  });

  it("takes only a JPEG or PNG picture the page shrank, and keeps a note's text tidy", () => {
    expect(checkPictureDataUrl(JPEG)).toBe(JPEG);
    expect(checkPictureDataUrl("data:image/png;base64,AAAA")).toBe("data:image/png;base64,AAAA");
    expect(() => checkPictureDataUrl("data:image/heic;base64,AAAA")).toThrow(/didn't come through/);
    expect(() => checkPictureDataUrl("https://example.com/a.jpg")).toThrow(/didn't come through/);
    expect(() => checkPictureDataUrl("data:image/jpeg;base64," + "A".repeat(9 * 1024 * 1024))).toThrow(/too large/);
    expect(cleanBody("  keep the indent\r\nsecond line   \n\n")).toBe("  keep the indent\nsecond line");
    expect(() => cleanBody(" \n ")).toThrow(/needs some text/);
    expect(() => cleanBody("z".repeat(2001))).toThrow(/2000 characters/);
    expect(safeJson({ a: "</script><b>&" })).toBe('{"a":"\\u003c/script\\u003e\\u003cb\\u003e\\u0026"}');
  });

  it("sits on Admin as a tile behind the Admin PIN, its crumb climbing to Admin, in both languages", async () => {
    const m = await migratedDb();
    const env = envOf(m);
    expect(adminHomePage("en")).toContain('data-admin-group="whiteboard"');
    expect(adminHomePage("en")).toContain('href="/admin/whiteboard"');
    expect(adminHomePage("es")).toContain("Pizarra del equipo");
    expect(backLinkFor(WB_PATH)).toEqual({ href: "/admin", label: "Admin" });
    const locked = await app.request(WB_PATH, { headers: { "Cf-Access-Authenticated-User-Email": LEAD } }, env);
    expect(locked.status).toBe(401);
    expect(await locked.text()).toContain("Enter PIN");
    const lockedJson = await app.request(`${WB_PATH}/notes.json`, { headers: { "Cf-Access-Authenticated-User-Email": LEAD } }, env);
    expect(lockedJson.status).toBe(401);
    const page = await call(m, env, "GET", WB_PATH);
    expect(page.status).toBe(200);
    for (const bit of ["Team Whiteboard", "data-wb-surface", "Export to clean list", "Import a picture", "Clear all", "data-wb-confirm", "data-wb-clear", "image/heic", "image/webp", "image/gif"]) {
      expect(page.text).toContain(bit);
    }
    // WB2: the pane checks one note, not a list of lines.
    for (const bit of ["One picture is one note", "data-wb-import-note", "data-wb-held-list", "data-wb-many", `data-wb-many-lines="${WB_MANY_LINES}"`, "Put this note on the board"]) {
      expect(page.text).toContain(bit);
    }
    expect(page.text).not.toContain("data-wb-line-check");
    expect(page.text).not.toMatch(/[\u2013\u2014]/);
    const es = await app.request(WB_PATH, { headers: { ...headers(m), cookie: `gf_pin=${pinOf(m)}; gf_locale=es` } }, env);
    const esText = await es.text();
    expect(esText).toContain("Pizarra del equipo");
    expect(esText).toContain("Exportar a lista limpia");
    expect(esText).toContain("¿Borrar toda la pizarra?");
    expect(esText).toContain("Una imagen es una nota");
    expect(esText).toContain("Poner esta nota en la pizarra");
  });

  it("writes a note where it lands with its originator, moves it, edits it under the version lock, and logs content, not moves", async () => {
    const m = await migratedDb();
    const env = envOf(m);
    const made = await call(m, env, "POST", `${WB_PATH}/notes`, { body: "Order more totes", x: 120.4, y: 80.6 });
    expect(made.status).toBe(201);
    const note = made.data.note as WbNote;
    expect(note).toMatchObject({ body: "Order more totes", x: 120, y: 81, source: "typed", originator: "lead.person@example.com" });
    const stored = m.get(`SELECT originator_email, originator_person_id, board_key FROM wb_notes WHERE id = ?`, note.id);
    expect(stored?.originator_email).toBe("lead.person@example.com");
    expect(stored?.originator_person_id).toBeTruthy();

    const far = await call(m, env, "POST", `${WB_PATH}/notes`, { body: "Off the edge", x: 99999, y: -50 });
    expect(far.data.note).toMatchObject({ x: 3200, y: 0 });
    const blank = await call(m, env, "POST", `${WB_PATH}/notes`, { body: "   ", x: 1, y: 1 });
    expect(blank.status).toBe(400);
    expect(blank.data.error).toBe("A note needs some text.");
    const formPost = await app.request(`${WB_PATH}/notes`, { method: "POST", headers: { ...headers(m, LEAD, false), "content-type": "application/x-www-form-urlencoded" }, body: "body=x&x=1&y=1" }, env);
    expect(formPost.status).toBe(415);

    const moved = await call(m, env, "POST", `${WB_PATH}/notes/${note.id}`, { x: 400, y: 300, version: note.updatedAt });
    expect(moved.status).toBe(200);
    const afterMove = moved.data.note as WbNote;
    expect(afterMove).toMatchObject({ x: 400, y: 300, body: "Order more totes" });
    const stale = await call(m, env, "POST", `${WB_PATH}/notes/${note.id}`, { body: "Lost edit", version: note.updatedAt }, OTHER);
    expect(stale.status).toBe(409);
    expect((stale.data.note as WbNote).x).toBe(400);
    const edited = await call(m, env, "POST", `${WB_PATH}/notes/${note.id}`, { body: "Order more totes, 40 of them", version: afterMove.updatedAt }, OTHER);
    expect(edited.status).toBe(200);
    expect(edited.data.note).toMatchObject({ body: "Order more totes, 40 of them", originator: "lead.person@example.com", updatedBy: OTHER });

    const logs = m.all(`SELECT field, old_value, new_value FROM record_change_log WHERE record_table = 'wb_notes' AND record_id = ? ORDER BY changed_at, field`, note.id);
    expect(logs).toEqual([
      { field: "body", old_value: null, new_value: "Order more totes" },
      { field: "body", old_value: "Order more totes", new_value: "Order more totes, 40 of them" },
    ]);

    const list = await call(m, env, "GET", `${WB_PATH}/notes.json`);
    expect((list.data.notes as WbNote[]).map((n) => n.body).sort()).toEqual(["Off the edge", "Order more totes, 40 of them"]);
  });

  it("deletes one note softly and logs it; a second delete or an edit of it answers that it's gone", async () => {
    const m = await migratedDb();
    const env = envOf(m);
    const note = (await call(m, env, "POST", `${WB_PATH}/notes`, { body: "Temporary", x: 5, y: 5 })).data.note as WbNote;
    const gone = await call(m, env, "POST", `${WB_PATH}/notes/${note.id}/delete`, { version: note.updatedAt });
    expect(gone.status).toBe(200);
    expect(m.get(`SELECT delete_kind, deleted_by_email FROM wb_notes WHERE id = ?`, note.id)).toEqual({ delete_kind: "one", deleted_by_email: "lead.person@example.com" });
    expect(m.get(`SELECT count(*) AS n FROM record_change_log WHERE record_id = ? AND field = 'deleted_at'`, note.id)).toEqual({ n: 1 });
    expect((await call(m, env, "POST", `${WB_PATH}/notes/${note.id}/delete`, {})).status).toBe(404);
    expect((await call(m, env, "POST", `${WB_PATH}/notes/${note.id}`, { body: "x", version: note.updatedAt })).status).toBe(404);
    expect(((await call(m, env, "GET", `${WB_PATH}/notes.json`)).data.notes as WbNote[]).length).toBe(0);
  });

  it("exports the clean list in reading order with each note's originator, as a real spreadsheet", async () => {
    const m = await migratedDb();
    const env = envOf(m);
    await call(m, env, "POST", `${WB_PATH}/notes`, { body: "Bottom right", x: 900, y: 600 });
    await call(m, env, "POST", `${WB_PATH}/notes`, { body: "Top left", x: 10, y: 10 }, OTHER);
    await call(m, env, "POST", `${WB_PATH}/notes`, { body: "Top right\nsecond line", x: 800, y: 10 });
    const res = await app.request(`${WB_PATH}/export.xlsx`, { headers: headers(m, LEAD, false) }, env);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    expect(res.headers.get("content-disposition")).toMatch(/^attachment; filename="team-whiteboard-\d{4}-\d{2}-\d{2}\.xlsx"$/);
    const grid = (await readXlsxSheets(new Uint8Array(await res.arrayBuffer()))).get("Whiteboard");
    expect(grid?.[0].cells).toEqual(WB_EXPORT_HEADERS);
    expect(grid?.slice(1).map((row) => [row.cells[0], row.cells[1], row.cells[2], row.cells[6]])).toEqual([
      [1, "Top left", OTHER, "Typed"],
      [2, "Top right\nsecond line", "lead.person@example.com", "Typed"],
      [3, "Bottom right", "lead.person@example.com", "Typed"],
    ]);
    expect(wbExportFilename("2026-11-18T03:30:00.000Z")).toBe("team-whiteboard-2026-11-17.xlsx");
    const order = readingOrder([
      { y: 5, x: 50, createdAt: "b" },
      { y: 5, x: 10, createdAt: "c" },
      { y: 1, x: 900, createdAt: "a" },
    ] as WbNote[]);
    expect(order.map((n) => n.x)).toEqual([900, 10, 50]);
  });

  it("clears the board only on the Admin PIN entered again, softly under one batch, with one log line", async () => {
    const m = await migratedDb();
    const env = envOf(m);
    for (const [i, body] of ["one", "two", "three"].entries()) await call(m, env, "POST", `${WB_PATH}/notes`, { body, x: i * 10, y: 0 });
    const wrong = await call(m, env, "POST", `${WB_PATH}/clear`, { pin: "0" });
    expect(wrong.status).toBe(403);
    expect(wrong.data.error).toBe("That PIN isn't right. Nothing was cleared.");
    expect(m.get(`SELECT count(*) AS n FROM wb_notes WHERE deleted_at IS NULL`)).toEqual({ n: 3 });
    const missing = await call(m, env, "POST", `${WB_PATH}/clear`, {});
    expect(missing.status).toBe(403);
    const right = await call(m, env, "POST", `${WB_PATH}/clear`, { pin: pinOf(m) });
    expect(right.status).toBe(200);
    expect(right.data.cleared).toBe(3);
    const rows = m.all(`SELECT delete_kind, clear_batch FROM wb_notes`);
    expect(new Set(rows.map((r) => r.delete_kind))).toEqual(new Set(["clear_all"]));
    expect(new Set(rows.map((r) => r.clear_batch)).size).toBe(1);
    const log = m.all(`SELECT record_id, old_value, new_value FROM record_change_log WHERE field = 'clear_all'`);
    expect(log).toEqual([{ record_id: rows[0].clear_batch, old_value: "3", new_value: "0" }]);
    const again = await call(m, env, "POST", `${WB_PATH}/clear`, { pin: pinOf(m) });
    expect(again.data.cleared).toBe(0);
    const es = await app.request(`${WB_PATH}/clear`, { method: "POST", headers: { ...headers(m), cookie: `gf_pin=${pinOf(m)}; gf_locale=es` }, body: JSON.stringify({ pin: "1" }) }, env);
    expect(((await es.json()) as { error: string }).error).toBe("Ese PIN no es correcto. No se borró nada.");
  });

  it("reads a picture through Workers AI, flags what looks private, and places it as one note (WB2: one picture, one note)", async () => {
    const m = await migratedDb();
    const none = await call(m, envOf(m), "POST", `${WB_PATH}/import/read`, { image: JPEG });
    expect(none.status).toBe(200);
    expect(none.data).toMatchObject({ ok: false, reason: "not_set_up", model: WB_OCR_MODEL_DEFAULT });

    const calls: Calls = [];
    const env = envOf(m, { calls, ai: async () => ({ response: "Gate list\n1) Order totes\n2) Gate code 4417\n3) jo@grip.example\n4) Fix the scale" }) });
    const read = await call(m, env, "POST", `${WB_PATH}/import/read`, { image: JPEG });
    expect(read.status).toBe(200);
    expect(read.data.lines).toEqual([
      { text: "Gate list", flags: [] },
      { text: "1) Order totes", flags: [] },
      { text: "2) Gate code 4417", flags: ["pin"] },
      { text: "3) jo@grip.example", flags: ["email"] },
      { text: "4) Fix the scale", flags: [] },
    ]);
    expect(calls[0].model).toBe(WB_OCR_MODEL_DEFAULT);
    expect(JSON.stringify(calls[0].input)).toContain(JPEG);
    expect(JSON.stringify(calls[0].input)).toContain("one note");
    expect((await call(m, env, "POST", `${WB_PATH}/import/read`, { image: "data:image/gif;base64,AAAA" })).status).toBe(400);

    const two = await call(m, env, "POST", `${WB_PATH}/import/apply`, { notes: [{ body: "Order totes", x: 24, y: 24 }, { body: "Fix the scale", x: 24, y: 96 }] });
    expect(two.status).toBe(400);
    expect(two.data.error).toBe("One picture is one note.");
    expect(m.get(`SELECT count(*) AS n FROM wb_notes`)).toEqual({ n: 0 });
    const es = await app.request(`${WB_PATH}/import/apply`, {
      method: "POST",
      headers: { ...headers(m), cookie: `gf_pin=${pinOf(m)}; gf_locale=es` },
      body: JSON.stringify({ notes: [{ body: "a", x: 0, y: 0 }, { body: "b", x: 0, y: 0 }] }),
    }, env);
    expect(((await es.json()) as { error: string }).error).toBe("Una imagen es una sola nota.");
    const empty = await call(m, env, "POST", `${WB_PATH}/import/apply`, { notes: [] });
    expect(empty.status).toBe(400);

    const body = "Gate list\n1) Order totes\n4) Fix the scale";
    const applied = await call(m, env, "POST", `${WB_PATH}/import/apply`, { notes: [{ body, x: 24, y: 24 }] });
    expect(applied.status).toBe(201);
    expect((applied.data.notes as WbNote[]).map((n) => [n.body, n.source, n.originator, n.x, n.y])).toEqual([[body, "import", "lead.person@example.com", 24, 24]]);
    expect(m.get(`SELECT count(*) AS n FROM record_change_log WHERE reason LIKE 'WB1: note placed from a picture%'`)).toEqual({ n: 1 });

    // A typed batch keeps its own cap of 60 (the function is general; only a picture is held to one).
    const actor = { id: "", email: LEAD };
    await expect(createWbNotes(m.db, Array.from({ length: 61 }, (_, i) => ({ body: `n${i}`, x: 0, y: 0 })), actor, "2026-11-17T15:00:00.000Z", "typed")).rejects.toThrow("Up to 60 notes go on the board at once.");
    const sixty = await createWbNotes(m.db, Array.from({ length: 60 }, (_, i) => ({ body: `note ${i}`, x: i, y: i })), actor, "2026-11-17T15:00:00.000Z", "typed");
    expect(sixty.map((n) => n.body)).toEqual(Array.from({ length: 60 }, (_, i) => `note ${i}`));
  });

  it("WB2: the count reads 1 note, and 2 notes, in both languages", async () => {
    const m = await migratedDb();
    const env = envOf(m);
    await call(m, env, "POST", `${WB_PATH}/notes`, { body: "One", x: 10, y: 10 });
    const one = await call(m, env, "GET", WB_PATH);
    expect(one.text).toContain('data-wb-count>1 note</span>');
    const es = await app.request(WB_PATH, { headers: { ...headers(m), cookie: `gf_pin=${pinOf(m)}; gf_locale=es` } }, env);
    expect(await es.text()).toContain('data-wb-count>1 nota</span>');
    await call(m, env, "POST", `${WB_PATH}/notes`, { body: "Two", x: 10, y: 90 });
    expect((await call(m, env, "GET", WB_PATH)).text).toContain('data-wb-count>2 notes</span>');
  });

  it("WB2: the Director home links the board, in both languages", async () => {
    const m = await migratedDb();
    const en = directorHomePage(await loadDirectorHome(m.db, "2026-11-17", "2026-11-17T15:00:00.000Z"), "en");
    expect(en).toContain(`<a href="${WB_PATH}" data-dd-whiteboard>Team Whiteboard</a>`);
    const es = directorHomePage(await loadDirectorHome(m.db, "2026-11-17", "2026-11-17T15:00:00.000Z"), "es");
    expect(es).toContain(`<a href="${WB_PATH}" data-dd-whiteboard>Pizarra del equipo</a>`);
  });

  it("hands a license refusal to the owner's button, which sends agree through the worker's binding; other failures say so", async () => {
    const m = await migratedDb();
    const calls: Calls = [];
    let agreed = false;
    const env = envOf(m, {
      calls,
      model: "@cf/meta/llama-3.2-11b-vision-instruct",
      ai: async (_model, input) => {
        if (input.prompt === "agree") {
          agreed = true;
          return { response: "Thank you for agreeing" };
        }
        if (!agreed) throw new Error("5016: Prior to using this model, you must submit the prompt 'agree'");
        return { response: "Line one" };
      },
    });
    const first = await call(m, env, "POST", `${WB_PATH}/import/read`, { image: JPEG });
    expect(first.data).toMatchObject({ ok: false, reason: "license" });
    const ok = await call(m, env, "POST", `${WB_PATH}/import/agree`, {});
    expect(ok.data).toEqual({ ok: true });
    expect(calls.find((c) => c.input.prompt === "agree")?.model).toBe("@cf/meta/llama-3.2-11b-vision-instruct");
    const second = await call(m, env, "POST", `${WB_PATH}/import/read`, { image: JPEG });
    expect(second.data).toMatchObject({ ok: true, lines: [{ text: "Line one", flags: [] }] });
    expect(calls.filter((c) => c.input.image === JPEG)).toHaveLength(2);

    const broken = envOf(m, { ai: async () => { throw new Error("upstream timeout"); } });
    const failed = await call(m, broken, "POST", `${WB_PATH}/import/read`, { image: JPEG });
    expect(failed.data).toMatchObject({ ok: false, reason: "failed" });
  });

  it("has every word it shows in Spanish, and no dash in either language or in its source", async () => {
    const fs = (await import("node:" + "fs")) as { readFileSync(path: URL, encoding: "utf8"): string };
    const src = fs.readFileSync(new URL("../src/whiteboard.ts", import.meta.url), "utf8");
    const routes = fs.readFileSync(new URL("../src/index.ts", import.meta.url), "utf8");
    const keys = new Set<string>([
      ...[...src.matchAll(/\btr\("([^"]+)"\)/g)].map((hit) => hit[1]),
      ...[...src.matchAll(/HttpError\(\d+, "([^"]+)"\)/g)].map((hit) => hit[1]),
      ...[...src.slice(src.indexOf("const WB_WORD_KEYS"), src.indexOf("function wordsJson")).matchAll(/^  "([^"]+)",$/gm)].map((hit) => hit[1]),
      ...[...routes.slice(routes.indexOf("// WB1, THE TEAM WHITEBOARD"), routes.indexOf("// THE SHEET SYNC (canon 0.30.162)")).matchAll(/t\(locale, "([^"]+)"\)/g)].map((hit) => hit[1]),
      "Team Whiteboard",
      "{n} notes",
    ]);
    expect(keys.size).toBeGreaterThan(50);
    const missing = [...keys].filter((k) => !DICT[k] || !DICT[k].es.trim() || DICT[k].es === k);
    expect(missing).toEqual([]);
    const dash = new RegExp("[" + String.fromCharCode(0x2013, 0x2014) + "]");
    for (const k of keys) {
      expect(dash.test(DICT[k].en), k).toBe(false);
      expect(dash.test(DICT[k].es), k).toBe(false);
    }
    expect(dash.test(src)).toBe(false);
    expect(src.includes("\r")).toBe(false);
  });

  it("serves the HEIC converter behind the PIN as a script, only from its vendored copy", async () => {
    const m = await migratedDb();
    const env = envOf(m);
    const res = await app.request(WB_HEIC_PATH, { headers: headers(m, LEAD, false) }, env);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/javascript; charset=utf-8");
    expect(await res.text()).toContain("HeicTo");
    const locked = await app.request(WB_HEIC_PATH, { headers: { "Cf-Access-Authenticated-User-Email": LEAD } }, env);
    expect(locked.status).toBe(401);
  });
});
