/* WB1, THE TEAM WHITEBOARD (the owner, 2026-11-17): "I need a team whiteboard in Admin."
 * His four, in his words:
 *   1. "Double click anywhere. You type on it, text is stored wherever it is typed. Drops a moveable textbox
 *      around the text; when the box is active, the [DEL] key deletes the text box after an are you sure prompt."
 *   2. "An export to clean list button (the user email is stored with the text as originator); a spreadsheet is
 *      made and downloaded."
 *   3. "A clear all button, PIN gated."
 *   4. "An import pane (jpeg, png, gif, some picture format), text screened and applied to the board."
 * His picks: Cloudflare Workers AI reads the picture; HEIC and WebP besides JPEG, PNG and GIF; every line he
 * reviews first, the lines that look like a PIN, a password, an email or a phone number flagged and unchecked.
 *
 * The board lives at /admin/whiteboard behind Access and the Admin PIN (the /admin/* gate). One board, notes
 * at fixed board coordinates on a 3200 by 2000 surface that scrolls inside its own frame, so no page ever
 * scrolls sideways. Every content change and every delete is logged; a move is not (position is not content).
 * Clear all asks for the Admin PIN again and soft deletes, so a clear can be recovered in the database. */
import { HttpError } from "./audit";
import { CONFIG_KEYS } from "./config";
import { getConfigValue, insertLog } from "./db";
import { etWallClock } from "./farmday";
import { t, tFill, type Locale } from "./i18n";
import { esc } from "./ui";
import { buildXlsx, type XlsxCell } from "./xlsx";

declare global {
  interface Env {
    /** WB1: the Workers AI model that reads a picture. Unset uses WB_OCR_MODEL_DEFAULT; a var changes it without code. */
    WB_OCR_MODEL?: string;
  }
}

export const WB_PATH = "/admin/whiteboard";
export const WB_BOARD = "team";
export const WB_W = 3200;
export const WB_H = 2000;
export const WB_MAX_BODY = 2000;
export const WB_MAX_IMPORT_LINES = 60;
/** The picture as it reaches the server: the page shrinks it to WB_IMAGE_EDGE px on its long side, as JPEG. */
export const WB_IMAGE_EDGE = 1600;
export const WB_IMAGE_MAX_BYTES = 6 * 1024 * 1024;
export const WB_OCR_MODEL_DEFAULT = "@cf/meta/llama-4-scout-17b-16e-instruct";
export const WB_HEIC_PATH = `${WB_PATH}/heic-to-1.6.7.js`;
export const WB_HEIC_ASSET = "/vendor/heic-to/heic-to.js";
export const WB_POLL_MS = 10000;

const REASON_CREATE = "WB1: note written on the team whiteboard";
const REASON_IMPORT = "WB1: note placed from a picture after review";
const REASON_EDIT = "WB1: note text changed on the team whiteboard";
const REASON_DELETE = "WB1: note deleted from the team whiteboard";
const REASON_CLEAR = "WB1: Clear all, the Admin PIN entered again";

export type WbSource = "typed" | "import";
export type WbNote = {
  id: string;
  body: string;
  x: number;
  y: number;
  source: WbSource;
  originator: string;
  originatorName: string;
  createdAt: string;
  updatedAt: string;
  updatedBy: string;
};
export type WbActor = { id: string; email: string };
export type WbFlag = "pin" | "password" | "email" | "phone";
export type WbLine = { text: string; flags: WbFlag[] };

type NoteRow = {
  id: string;
  body: string;
  x: number;
  y: number;
  source: WbSource;
  originator_email: string;
  originator_name: string | null;
  created_at: string;
  updated_at: string;
  updated_by_email: string;
};

const NOTE_SELECT = `SELECT n.id, n.body, n.x, n.y, n.source, n.originator_email, p.display_name AS originator_name,
  n.created_at, n.updated_at, n.updated_by_email
  FROM wb_notes n LEFT JOIN people p ON p.id = n.originator_person_id`;

function toNote(r: NoteRow): WbNote {
  return {
    id: r.id,
    body: r.body,
    x: Number(r.x),
    y: Number(r.y),
    source: r.source,
    originator: r.originator_email,
    originatorName: r.originator_name || r.originator_email.split("@")[0],
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    updatedBy: r.updated_by_email,
  };
}

/** The board's live notes, oldest first, so a later note draws over an earlier one. */
export async function listWbNotes(db: D1Database): Promise<WbNote[]> {
  const rows = await db
    .prepare(`${NOTE_SELECT} WHERE n.board_key = ? AND n.deleted_at IS NULL ORDER BY n.created_at, n.id`)
    .bind(WB_BOARD)
    .all<NoteRow>();
  return (rows.results ?? []).map(toNote);
}

async function noteById(db: D1Database, id: string): Promise<WbNote | null> {
  const row = await db
    .prepare(`${NOTE_SELECT} WHERE n.id = ? AND n.board_key = ? AND n.deleted_at IS NULL`)
    .bind(id, WB_BOARD)
    .first<NoteRow>();
  return row ? toNote(row) : null;
}

/** A position on the board: whole pixels, inside the surface. */
export function clampPoint(x: unknown, y: unknown): { x: number; y: number } {
  const nx = Number(x);
  const ny = Number(y);
  if (!Number.isFinite(nx) || !Number.isFinite(ny)) throw new HttpError(400, "A note needs a place on the board.");
  return { x: Math.min(WB_W, Math.max(0, Math.round(nx))), y: Math.min(WB_H, Math.max(0, Math.round(ny))) };
}

/** A note's text: line ends made plain, trailing space dropped, 1 to WB_MAX_BODY characters. */
export function cleanBody(raw: unknown): string {
  const text = String(raw ?? "")
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.replace(/\s+$/u, ""))
    .join("\n")
    .replace(/^\n+|\n+$/g, "");
  if (!text.trim()) throw new HttpError(400, "A note needs some text.");
  if ([...text].length > WB_MAX_BODY) throw new HttpError(400, "A note holds up to 2000 characters.");
  return text;
}

function emailOf(actor: WbActor): string {
  return String(actor.email || "").trim().toLowerCase() || "unknown@local";
}

export async function createWbNote(
  db: D1Database,
  input: { body: unknown; x: unknown; y: unknown },
  actor: WbActor,
  now: string,
  source: WbSource = "typed"
): Promise<WbNote> {
  const [note] = await createWbNotes(db, [input], actor, now, source);
  return note;
}

/** Rows per multi row INSERT, so no statement carries more than 100 binds (D1). */
const NOTE_ROWS_PER_INSERT = 9;
const LOG_ROWS_PER_INSERT = 11;

type LogRow = { record_id: string; field: string; old_value: string | null; new_value: string | null; reason: string };

/** The change log rows in multi row INSERTs, the same columns insertLog writes. */
function logStatements(db: D1Database, rows: LogRow[], actorId: string | null, now: string): D1PreparedStatement[] {
  const out: D1PreparedStatement[] = [];
  for (let i = 0; i < rows.length; i += LOG_ROWS_PER_INSERT) {
    const part = rows.slice(i, i + LOG_ROWS_PER_INSERT);
    out.push(
      db
        .prepare(
          `INSERT INTO record_change_log (id, record_table, record_id, field, old_value, new_value, actor_person_id, reason, changed_at) VALUES ${part
            .map(() => "(?, ?, ?, ?, ?, ?, ?, ?, ?)")
            .join(", ")}`
        )
        .bind(...part.flatMap((r) => [crypto.randomUUID(), "wb_notes", r.record_id, r.field, r.old_value, r.new_value, actorId, r.reason, now]))
    );
  }
  return out;
}

async function notesByIds(db: D1Database, ids: string[]): Promise<WbNote[]> {
  if (ids.length === 0) return [];
  const rows = await db
    .prepare(`${NOTE_SELECT} WHERE n.board_key = ? AND n.deleted_at IS NULL AND n.id IN (${ids.map(() => "?").join(", ")})`)
    .bind(WB_BOARD, ...ids)
    .all<NoteRow>();
  const byId = new Map((rows.results ?? []).map((r) => [r.id, toNote(r)]));
  return ids.map((id) => byId.get(id)).filter((n): n is WbNote => Boolean(n));
}

/** One batch for any number of notes: the rows and their log lines land together or not at all. A 60 line
 * import is seven note INSERTs and six log INSERTs, well inside a Worker's query budget. */
export async function createWbNotes(
  db: D1Database,
  inputs: Array<{ body: unknown; x: unknown; y: unknown }>,
  actor: WbActor,
  now: string,
  source: WbSource
): Promise<WbNote[]> {
  if (inputs.length === 0) throw new HttpError(400, "Nothing to put on the board.");
  if (inputs.length > WB_MAX_IMPORT_LINES) throw new HttpError(400, "Up to 60 notes go on the board at once.");
  const email = emailOf(actor);
  const actorId = actor.id || null;
  const made = inputs.map((input) => ({ id: crypto.randomUUID(), body: cleanBody(input.body), ...clampPoint(input.x, input.y) }));
  const stmts: D1PreparedStatement[] = [];
  for (let i = 0; i < made.length; i += NOTE_ROWS_PER_INSERT) {
    const part = made.slice(i, i + NOTE_ROWS_PER_INSERT);
    stmts.push(
      db
        .prepare(
          `INSERT INTO wb_notes (id, board_key, body, x, y, source, originator_email, originator_person_id, created_at, updated_at, updated_by_email) VALUES ${part
            .map(() => "(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
            .join(", ")}`
        )
        .bind(...part.flatMap((m) => [m.id, WB_BOARD, m.body, m.x, m.y, source, email, actorId, now, now, email]))
    );
  }
  stmts.push(
    ...logStatements(
      db,
      made.map((m) => ({ record_id: m.id, field: "body", old_value: null, new_value: m.body, reason: source === "import" ? REASON_IMPORT : REASON_CREATE })),
      actorId,
      now
    )
  );
  await db.batch(stmts);
  return notesByIds(db, made.map((m) => m.id));
}

export type WbUpdateResult = { status: "ok"; note: WbNote } | { status: "conflict"; note: WbNote } | { status: "gone" };

/** A text change, a move, or both. The version is the note's updated_at as the page last saw it. */
export async function updateWbNote(
  db: D1Database,
  id: string,
  patch: { body?: unknown; x?: unknown; y?: unknown; version?: unknown },
  actor: WbActor,
  now: string
): Promise<WbUpdateResult> {
  const current = await noteById(db, id);
  if (!current) return { status: "gone" };
  if (String(patch.version ?? "") !== current.updatedAt) return { status: "conflict", note: current };
  const body = patch.body === undefined ? current.body : cleanBody(patch.body);
  const point = patch.x === undefined && patch.y === undefined ? { x: current.x, y: current.y } : clampPoint(patch.x ?? current.x, patch.y ?? current.y);
  if (body === current.body && point.x === current.x && point.y === current.y) return { status: "ok", note: current };
  const email = emailOf(actor);
  const stmts: D1PreparedStatement[] = [
    db
      .prepare(
        `UPDATE wb_notes SET body = ?, x = ?, y = ?, updated_at = ?, updated_by_email = ?
         WHERE id = ? AND board_key = ? AND deleted_at IS NULL AND updated_at = ?`
      )
      .bind(body, point.x, point.y, now, email, id, WB_BOARD, current.updatedAt),
  ];
  if (body !== current.body) {
    stmts.push(
      insertLog(db, {
        record_table: "wb_notes",
        record_id: id,
        field: "body",
        old_value: current.body,
        new_value: body,
        actor_person_id: actor.id || null,
        reason: REASON_EDIT,
        changed_at: now,
      })
    );
  }
  const results = await db.batch(stmts);
  if (Number(results[0]?.meta?.changes ?? 0) === 0) {
    const fresh = await noteById(db, id);
    return fresh ? { status: "conflict", note: fresh } : { status: "gone" };
  }
  const note = await noteById(db, id);
  return note ? { status: "ok", note } : { status: "gone" };
}

export async function deleteWbNote(db: D1Database, id: string, actor: WbActor, now: string): Promise<boolean> {
  const current = await noteById(db, id);
  if (!current) return false;
  const email = emailOf(actor);
  const results = await db.batch([
    db
      .prepare(
        `UPDATE wb_notes SET deleted_at = ?, deleted_by_email = ?, delete_kind = 'one', updated_at = ?, updated_by_email = ?
         WHERE id = ? AND board_key = ? AND deleted_at IS NULL`
      )
      .bind(now, email, now, email, id, WB_BOARD),
    insertLog(db, {
      record_table: "wb_notes",
      record_id: id,
      field: "deleted_at",
      old_value: null,
      new_value: now,
      actor_person_id: actor.id || null,
      reason: REASON_DELETE,
      changed_at: now,
    }),
  ]);
  return Number(results[0]?.meta?.changes ?? 0) > 0;
}

/** Clear all: the Admin PIN entered again, every live note soft deleted under one batch id, one log line. */
export async function clearWbBoard(db: D1Database, pin: unknown, actor: WbActor, now: string): Promise<{ cleared: number; batch: string }> {
  const adminPin = await getConfigValue(db, CONFIG_KEYS.admin_pin);
  if (adminPin && String(pin ?? "").trim() !== adminPin) throw new HttpError(403, "That PIN isn't right. Nothing was cleared.");
  const batch = crypto.randomUUID();
  const email = emailOf(actor);
  const live = await db
    .prepare(`SELECT count(*) AS n FROM wb_notes WHERE board_key = ? AND deleted_at IS NULL`)
    .bind(WB_BOARD)
    .first<{ n: number }>();
  const count = Number(live?.n ?? 0);
  if (count === 0) return { cleared: 0, batch };
  const results = await db.batch([
    db
      .prepare(
        `UPDATE wb_notes SET deleted_at = ?, deleted_by_email = ?, delete_kind = 'clear_all', clear_batch = ?, updated_at = ?, updated_by_email = ?
         WHERE board_key = ? AND deleted_at IS NULL`
      )
      .bind(now, email, batch, now, email, WB_BOARD),
    insertLog(db, {
      record_table: "wb_notes",
      record_id: batch,
      field: "clear_all",
      old_value: String(count),
      new_value: "0",
      actor_person_id: actor.id || null,
      reason: REASON_CLEAR,
      changed_at: now,
    }),
  ]);
  return { cleared: Number(results[0]?.meta?.changes ?? count), batch };
}

/* ---------- The clean list ---------- */

/** Reading order: top to bottom, then left to right. */
export function readingOrder(notes: WbNote[]): WbNote[] {
  return [...notes].sort((a, b) => a.y - b.y || a.x - b.x || a.createdAt.localeCompare(b.createdAt));
}

export const WB_EXPORT_HEADERS = ["#", "Note", "Originator", "Written (farm time)", "Last changed (farm time)", "Changed by", "From"];

export function wbExportXlsx(notes: WbNote[]): Uint8Array {
  const rows: XlsxCell[][] = readingOrder(notes).map((n, i) => [
    { number: i + 1 },
    { text: n.body },
    { text: n.originator },
    { text: etWallClock(n.createdAt) },
    { text: etWallClock(n.updatedAt) },
    { text: n.updatedBy },
    { text: n.source === "import" ? "Picture" : "Typed" },
  ]);
  return buildXlsx({
    sheetName: "Whiteboard",
    headers: [...WB_EXPORT_HEADERS],
    rows,
    plainNumbers: true,
    colWidths: [6, 60, 30, 20, 20, 30, 10],
    autoFilter: rows.length + 1,
  });
}

export function wbExportFilename(now: string): string {
  const day = etWallClock(now).slice(0, 10) || now.slice(0, 10);
  return `team-whiteboard-${day}.xlsx`;
}

/* ---------- Reading a picture ---------- */

const EMAIL_RE = /[A-Z0-9._+-]+@[A-Z0-9-]+(?:\.[A-Z0-9-]+)*\.[A-Z]{2,}/i;
const PHONE_RE = /(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}(?!\d)/;
const PIN_WORD_RE = /\b(?:pin|passcode|code|c[oó]digo|clave)\b\s*(?:is|es|#|:|=|-)?\s*\d{3,8}\b/i;
const PIN_ALONE_RE = /^\s*\d{4,6}\s*$/;
const PASSWORD_RE = /\b(?:password|passwd|pwd|pass\s*word|contrase(?:n|ñ)a|login)\b/i;

/** The screen: what a line looks like it carries. A flagged line comes to the review unchecked. */
export function screenLine(text: string): WbFlag[] {
  const flags: WbFlag[] = [];
  if (PIN_WORD_RE.test(text) || PIN_ALONE_RE.test(text)) flags.push("pin");
  if (PASSWORD_RE.test(text)) flags.push("password");
  if (EMAIL_RE.test(text)) flags.push("email");
  if (PHONE_RE.test(text)) flags.push("phone");
  return flags;
}

/** The model's answer as lines: fences, bullets and numbering dropped, blanks and NONE gone, capped. */
export function linesFromModel(raw: string): string[] {
  const out: string[] = [];
  for (const piece of String(raw ?? "").replace(/\r\n?/g, "\n").split("\n")) {
    let line = piece.trim();
    if (!line || /^```/.test(line)) continue;
    line = line
      .replace(/^(?:[-*\u2013\u2014\u2022\u25CF\u25AA]+\s+)/u, "")
      .replace(/^(?:\(?\d{1,3}[.)]\s+)/, "")
      .replace(/^"(.*)"$/, "$1")
      .trim();
    if (!line || /^none\.?$/i.test(line)) continue;
    out.push([...line].slice(0, 500).join(""));
    if (out.length >= WB_MAX_IMPORT_LINES) break;
  }
  return out;
}

export const WB_OCR_PROMPT =
  "This is a photo or screenshot of handwritten or printed notes, such as a whiteboard, sticky notes or a page. " +
  "Transcribe every separate note or line of text exactly as written, in its own language, in reading order " +
  "(top to bottom, left to right). Put each note on its own line. Do not add numbering, bullets, headings, " +
  "commentary or any description of the picture. If you cannot read any text, answer with exactly: NONE";

const DATA_URL_RE = /^data:image\/(jpeg|png);base64,([A-Za-z0-9+/]+={0,2})$/;

/** The picture the page sends: a JPEG or PNG data URL, at most WB_IMAGE_MAX_BYTES once decoded. */
export function checkPictureDataUrl(raw: unknown): string {
  const value = String(raw ?? "");
  const hit = DATA_URL_RE.exec(value);
  if (!hit) throw new HttpError(400, "The picture didn't come through. Pick it again.");
  const bytes = Math.floor((hit[2].length * 3) / 4);
  if (bytes > WB_IMAGE_MAX_BYTES) throw new HttpError(413, "That picture is too large to read. Try a smaller one.");
  return value;
}

export type WbReadResult =
  | { ok: true; lines: WbLine[]; model: string }
  | { ok: false; reason: "not_set_up" | "license" | "failed"; detail?: string; model: string };

function modelOf(env: Env): string {
  const m = String(env.WB_OCR_MODEL ?? "").trim();
  return m || WB_OCR_MODEL_DEFAULT;
}

/** Older Workers AI vision models take the picture in an image field; the newer ones in the chat content. */
export function wbModelInput(model: string, dataUrl: string): Record<string, unknown> {
  if (/llama-3\.2-11b-vision/.test(model)) {
    return { messages: [{ role: "user", content: WB_OCR_PROMPT }], image: dataUrl, max_tokens: 1024, temperature: 0 };
  }
  return {
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: WB_OCR_PROMPT },
          { type: "image_url", image_url: { url: dataUrl } },
        ],
      },
    ],
    max_tokens: 1024,
    temperature: 0,
  };
}

/** The text in whatever shape the model answered: a string, response, or a chat choice. */
export function wbModelText(res: unknown): string {
  if (typeof res === "string") return res;
  if (!res || typeof res !== "object") return "";
  const r = res as Record<string, unknown>;
  if (typeof r.response === "string") return r.response;
  if (typeof r.description === "string") return r.description;
  const inner = r.result as Record<string, unknown> | undefined;
  if (inner && typeof inner.response === "string") return inner.response;
  const choices = r.choices as Array<{ message?: { content?: unknown } }> | undefined;
  const content = choices?.[0]?.message?.content;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => (part && typeof part === "object" && typeof (part as { text?: unknown }).text === "string" ? (part as { text: string }).text : ""))
      .join("\n");
  }
  return "";
}

type AiRunner = { run: (model: string, input: Record<string, unknown>) => Promise<unknown> };

function aiOf(env: Env): AiRunner | null {
  const ai = (env as unknown as { AI?: AiRunner }).AI;
  return ai && typeof ai.run === "function" ? ai : null;
}

export async function readPictureText(env: Env, dataUrl: string): Promise<WbReadResult> {
  const model = modelOf(env);
  const ai = aiOf(env);
  if (!ai) return { ok: false, reason: "not_set_up", model };
  let res: unknown;
  try {
    res = await ai.run(model, wbModelInput(model, dataUrl));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (/agree|licen[cs]e|5016/i.test(message)) return { ok: false, reason: "license", model, detail: message.slice(0, 300) };
    return { ok: false, reason: "failed", model, detail: message.slice(0, 300) };
  }
  const lines = linesFromModel(wbModelText(res)).map((text) => ({ text, flags: screenLine(text) }));
  return { ok: true, lines, model };
}

/** The owner's one time acceptance of a model's license, sent through the worker's own binding. */
export async function acceptModelLicense(env: Env): Promise<{ ok: boolean; model: string; detail?: string }> {
  const model = modelOf(env);
  const ai = aiOf(env);
  if (!ai) return { ok: false, model, detail: "not set up" };
  try {
    await ai.run(model, { prompt: "agree" });
    return { ok: true, model };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, model, detail: message.slice(0, 300) };
  }
}

/* ---------- The page ---------- */

const WB_WORD_KEYS = [
  "Saved.",
  "Saving...",
  "Couldn't save the note. Try again.",
  "Someone else changed this note. Showing their version.",
  "Someone else deleted that note.",
  "Note deleted.",
  "Board cleared: {n} notes.",
  "Reading the picture...",
  "No text found in that picture.",
  "Picture reading isn't set up on this copy of the app.",
  "The picture reader needs its license accepted once.",
  "The picture reader couldn't read that. Try a clearer picture.",
  "That file isn't a picture this board takes. Use JPEG, PNG, GIF, WebP or HEIC.",
  "Converting the HEIC picture...",
  "That HEIC picture couldn't be opened. Save it as JPEG and try again.",
  "Placed {n} notes on the board.",
  "Pick at least one line to place.",
  "Looks like a PIN",
  "Looks like a password",
  "Looks like an email",
  "Looks like a phone number",
  "That PIN isn't right. Nothing was cleared.",
  "License accepted. Reading again...",
  "Couldn't accept the license.",
  "Type a note. Click outside it to save; Esc cancels.",
  "Note",
  "{n} notes",
  "Your Admin PIN timed out. Reload the page and enter it again.",
  "Delete this note?",
];

function wordsJson(locale: Locale): string {
  const words: Record<string, string> = {};
  for (const key of WB_WORD_KEYS) words[key] = t(locale, key);
  return safeJson(words);
}

/** JSON for a script tag: nothing in it can close the tag. */
export function safeJson(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
}

function noteHtml(n: WbNote): string {
  return `<div class="wb-note" data-wb-note="${esc(n.id)}" data-wb-source="${esc(n.source)}" style="left:${n.x}px;top:${n.y}px" tabindex="0"><div class="wb-note-text">${esc(n.body)}</div><div class="wb-note-who">${esc(n.originatorName)}</div></div>`;
}

export function whiteboardPage(notes: WbNote[], locale: Locale): string {
  const tr = (key: string) => esc(t(locale, key));
  return `<section class="wb" data-wb data-wb-w="${WB_W}" data-wb-h="${WB_H}" data-wb-path="${WB_PATH}" data-wb-heic="${WB_HEIC_PATH}" data-wb-edge="${WB_IMAGE_EDGE}" data-wb-poll="${WB_POLL_MS}">
  <h1>${tr("Team Whiteboard")}</h1>
  <p class="wb-help">${tr("Double click anywhere on the board to write a note. Drag a note to move it. Click a note, then press Delete to remove it.")}</p>
  <div class="wb-tools">
    <button type="button" data-wb-add>${tr("Add a note")}</button>
    <a class="btn" href="${WB_PATH}/export.xlsx" download data-wb-export>${tr("Export to clean list")}</a>
    <button type="button" data-wb-import-open aria-expanded="false">${tr("Import a picture")}</button>
    <button type="button" class="secondary wb-danger" data-wb-clear-open>${tr("Clear all")}</button>
    <span class="wb-count" data-wb-count>${esc(tFill(locale, "{n} notes", { n: String(notes.length) }))}</span>
  </div>
  <p class="wb-status" data-wb-status role="status" aria-live="polite"></p>
  <div class="wb-import" data-wb-import hidden>
    <h2>${tr("Import a picture")}</h2>
    <p class="wb-help">${tr("JPEG, PNG, GIF, WebP or HEIC. The text is read, then you check each line before anything goes on the board.")}</p>
    <div class="wb-import-pick">
      <label for="wb-file">${tr("Choose a picture")}</label>
      <input id="wb-file" type="file" accept="image/jpeg,image/png,image/gif,image/webp,image/heic,image/heif,.heic,.heif,.jpg,.jpeg,.png,.gif,.webp" data-wb-file>
      <span class="wb-file-name" data-wb-file-name></span>
    </div>
    <img class="wb-preview" data-wb-preview alt="${tr("The picture to read")}" hidden>
    <div class="wb-license" data-wb-license hidden>
      <p>${tr("The picture reader's model asks its owner to accept its license once.")}</p>
      <button type="button" data-wb-agree>${tr("Accept the model's license")}</button>
    </div>
    <div class="wb-review" data-wb-review hidden>
      <h3>${tr("Check each line")}</h3>
      <p class="wb-help">${tr("Unchecked lines stay off the board. Lines flagged as a PIN, password, email or phone number start unchecked.")}</p>
      <ol class="wb-lines" data-wb-lines></ol>
      <div class="wb-tools">
        <button type="button" data-wb-apply>${tr("Put the checked lines on the board")}</button>
        <button type="button" class="secondary" data-wb-import-cancel>${tr("Cancel")}</button>
      </div>
    </div>
  </div>
  <div class="wb-frame" data-wb-frame aria-label="${tr("Team Whiteboard")}">
    <div class="wb-surface" data-wb-surface style="width:${WB_W}px;height:${WB_H}px">${notes.map(noteHtml).join("")}</div>
  </div>
  <dialog class="wb-dialog" data-wb-confirm>
    <h2>${tr("Delete this note?")}</h2>
    <p class="wb-confirm-text" data-wb-confirm-text></p>
    <div class="wb-tools">
      <button type="button" class="secondary wb-danger" data-wb-confirm-yes>${tr("Delete")}</button>
      <button type="button" data-wb-confirm-no>${tr("Keep it")}</button>
    </div>
  </dialog>
  <dialog class="wb-dialog" data-wb-clear>
    <form data-wb-clear-form>
      <h2>${tr("Clear the whole board?")}</h2>
      <p>${tr("Every note comes off the board for everyone. Enter the Admin PIN to clear it.")}</p>
      <label>${tr("Admin PIN")} <input type="password" inputmode="numeric" autocomplete="off" name="pin" data-wb-clear-pin required></label>
      <p class="wb-error" data-wb-clear-error hidden></p>
      <div class="wb-tools">
        <button type="submit" class="secondary wb-danger">${tr("Clear the board")}</button>
        <button type="button" class="secondary" data-wb-clear-no>${tr("Cancel")}</button>
      </div>
    </form>
  </dialog>
  <script type="application/json" data-wb-words>${wordsJson(locale)}</script>
  <script type="application/json" data-wb-notes>${safeJson(notes)}</script>
  <script>${WB_CLIENT}</script>
</section>`;
}

/* The board in the browser. Plain script, no template holes: it reads its settings from data attributes and
 * its words from the JSON above, so the server never splices values into code. */
const WB_CLIENT = String.raw`
(function () {
  var root = document.querySelector('[data-wb]');
  if (!root || root.getAttribute('data-wb-ready')) return;
  root.setAttribute('data-wb-ready', '1');
  var W = Number(root.getAttribute('data-wb-w'));
  var H = Number(root.getAttribute('data-wb-h'));
  var PATH = root.getAttribute('data-wb-path');
  var HEIC = root.getAttribute('data-wb-heic');
  var EDGE = Number(root.getAttribute('data-wb-edge'));
  var POLL = Number(root.getAttribute('data-wb-poll'));
  var words = JSON.parse(root.querySelector('[data-wb-words]').textContent || '{}');
  var initial = JSON.parse(root.querySelector('[data-wb-notes]').textContent || '[]');
  var frame = root.querySelector('[data-wb-frame]');
  var surface = root.querySelector('[data-wb-surface]');
  var statusEl = root.querySelector('[data-wb-status]');
  var countEl = root.querySelector('[data-wb-count]');
  var notes = {};
  var selected = null;
  var editing = null;
  var dragging = null;
  var pending = {};
  var statusTimer = 0;

  function w(key, vars) {
    var s = words[key] || key;
    if (vars) Object.keys(vars).forEach(function (k) { s = s.split('{' + k + '}').join(String(vars[k])); });
    return s;
  }
  function say(text, keep) {
    statusEl.textContent = text || '';
    clearTimeout(statusTimer);
    if (text && !keep) statusTimer = setTimeout(function () { statusEl.textContent = ''; }, 4000);
  }
  function api(method, url, body) {
    return fetch(url, {
      method: method,
      credentials: 'same-origin',
      headers: body === undefined ? { accept: 'application/json' } : { 'content-type': 'application/json', accept: 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body)
    }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (data) {
        if (res.status === 401) data = { error: w('Your Admin PIN timed out. Reload the page and enter it again.') };
        return { status: res.status, data: data };
      });
    });
  }
  function clampX(x) { return Math.max(0, Math.min(W, Math.round(x))); }
  function clampY(y) { return Math.max(0, Math.min(H, Math.round(y))); }
  function updateCount() {
    var n = Object.keys(notes).length;
    countEl.textContent = (words['{n} notes'] || '{n} notes').split('{n}').join(String(n));
  }

  function render(note) {
    var rec = notes[note.id];
    var el = rec ? rec.el : document.createElement('div');
    if (!rec) {
      el.className = 'wb-note';
      el.tabIndex = 0;
      el.setAttribute('data-wb-note', note.id);
      el.innerHTML = '<div class="wb-note-text"></div><div class="wb-note-who"></div><button type="button" class="wb-note-del" data-wb-note-del aria-label="' + w('Delete this note?') + '">&times;</button>';
      surface.appendChild(el);
      wire(el);
    }
    el.setAttribute('data-wb-source', note.source);
    el.style.left = note.x + 'px';
    el.style.top = note.y + 'px';
    if (editing !== note.id) el.querySelector('.wb-note-text').textContent = note.body;
    el.querySelector('.wb-note-who').textContent = note.originatorName;
    el.title = note.originator;
    notes[note.id] = { note: note, el: el };
    updateCount();
    return el;
  }
  function drop(id) {
    var rec = notes[id];
    if (!rec) return;
    rec.el.remove();
    delete notes[id];
    if (selected === id) selected = null;
    updateCount();
  }
  function select(id) {
    if (selected && notes[selected]) notes[selected].el.classList.remove('wb-active');
    selected = id;
    if (id && notes[id]) {
      notes[id].el.classList.add('wb-active');
      notes[id].el.focus({ preventScroll: true });
    }
  }

  surface.innerHTML = '';
  initial.forEach(render);

  // A press anywhere outside the note being typed saves it, mouse or finger alike.
  document.addEventListener('pointerdown', function (e) {
    var area = root.querySelector('.wb-edit');
    if (!area) return;
    var host = area.closest('.wb-note');
    if (host && host.contains(e.target)) return;
    area.blur();
  }, true);

  function editor(el, text, onDone) {
    var box = el.querySelector('.wb-note-text');
    var area = document.createElement('textarea');
    area.className = 'wb-edit';
    area.value = text;
    area.setAttribute('aria-label', w('Note'));
    area.placeholder = w('Type a note. Click outside it to save; Esc cancels.');
    area.rows = Math.max(2, text.split('\n').length);
    box.textContent = '';
    box.appendChild(area);
    el.classList.add('wb-editing');
    var finished = false;
    function finish(save) {
      if (finished) return;
      finished = true;
      el.classList.remove('wb-editing');
      var value = area.value;
      area.remove();
      onDone(save, value);
    }
    area.addEventListener('input', function () { area.rows = Math.max(2, area.value.split('\n').length); });
    area.addEventListener('keydown', function (e) {
      e.stopPropagation();
      if (e.key === 'Escape') { e.preventDefault(); finish(false); }
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); finish(true); }
    });
    area.addEventListener('blur', function () { finish(true); });
    area.addEventListener('pointerdown', function (e) { e.stopPropagation(); });
    area.addEventListener('dblclick', function (e) { e.stopPropagation(); });
    setTimeout(function () { area.focus(); }, 0);
  }

  function startDraft(x, y) {
    var el = document.createElement('div');
    el.className = 'wb-note wb-draft';
    el.style.left = clampX(x) + 'px';
    el.style.top = clampY(y) + 'px';
    el.innerHTML = '<div class="wb-note-text"></div>';
    surface.appendChild(el);
    editing = 'draft';
    editor(el, '', function (save, value) {
      editing = null;
      if (!save || !value.trim()) { el.remove(); return; }
      say(w('Saving...'), true);
      api('POST', PATH + '/notes', { body: value, x: clampX(x), y: clampY(y) }).then(function (r) {
        el.remove();
        if (r.status === 201 && r.data.note) { render(r.data.note); select(r.data.note.id); say(w('Saved.')); }
        else say(r.data.error || w("Couldn't save the note. Try again."), true);
      }, function () { el.remove(); say(w("Couldn't save the note. Try again."), true); });
    });
  }

  function editNote(id) {
    var rec = notes[id];
    if (!rec) return;
    editing = id;
    editor(rec.el, rec.note.body, function (save, value) {
      editing = null;
      var note = notes[id] && notes[id].note;
      if (!note) return;
      if (!save || value === note.body || !value.trim()) { render(note); return; }
      rec.el.querySelector('.wb-note-text').textContent = value;
      saveNote(id, { body: value });
    });
  }

  function saveNote(id, patch) {
    var rec = notes[id];
    if (!rec) return;
    patch.version = rec.note.updatedAt;
    say(w('Saving...'), true);
    pending[id] = true;
    api('POST', PATH + '/notes/' + encodeURIComponent(id), patch).then(function (r) {
      delete pending[id];
      if (r.status === 200 && r.data.note) { render(r.data.note); say(w('Saved.')); }
      else if (r.status === 409 && r.data.note) { render(r.data.note); say(w('Someone else changed this note. Showing their version.'), true); }
      else if (r.status === 404) { drop(id); say(w('Someone else deleted that note.'), true); }
      else { render(rec.note); say(r.data.error || w("Couldn't save the note. Try again."), true); }
    }, function () { delete pending[id]; render(rec.note); say(w("Couldn't save the note. Try again."), true); });
  }

  function wire(el) {
    el.querySelector('[data-wb-note-del]').addEventListener('pointerdown', function (e) { e.stopPropagation(); });
    el.querySelector('[data-wb-note-del]').addEventListener('click', function (e) {
      e.stopPropagation();
      var id = el.getAttribute('data-wb-note');
      if (id) askDelete(id);
    });
    var lastNoteTap = 0;
    el.addEventListener('pointerdown', function (e) {
      var id = el.getAttribute('data-wb-note');
      if (!id || editing === id || e.button > 0) return;
      select(id);
      var rec = notes[id];
      dragging = { id: id, startX: e.clientX, startY: e.clientY, x: rec.note.x, y: rec.note.y, moved: false, pointer: e.pointerId };
      el.setPointerCapture(e.pointerId);
    });
    el.addEventListener('pointermove', function (e) {
      if (!dragging || dragging.pointer !== e.pointerId) return;
      var dx = e.clientX - dragging.startX;
      var dy = e.clientY - dragging.startY;
      if (!dragging.moved && Math.abs(dx) + Math.abs(dy) < 5) return;
      dragging.moved = true;
      el.classList.add('wb-moving');
      el.style.left = clampX(dragging.x + dx) + 'px';
      el.style.top = clampY(dragging.y + dy) + 'px';
    });
    function endDrag(e) {
      if (!dragging || dragging.pointer !== e.pointerId) return;
      var d = dragging;
      dragging = null;
      el.classList.remove('wb-moving');
      if (!d.moved) {
        if (e.type === 'pointerup' && e.pointerType === 'touch') {
          var now = Date.now();
          if (now - lastNoteTap < 350) { lastNoteTap = 0; editNote(d.id); } else lastNoteTap = now;
        }
        return;
      }
      saveNote(d.id, { x: clampX(parseFloat(el.style.left)), y: clampY(parseFloat(el.style.top)) });
    }
    el.addEventListener('pointerup', endDrag);
    el.addEventListener('pointercancel', endDrag);
    el.addEventListener('dblclick', function (e) {
      e.stopPropagation();
      var id = el.getAttribute('data-wb-note');
      if (id && editing !== id) editNote(id);
    });
    el.addEventListener('focus', function () {
      var id = el.getAttribute('data-wb-note');
      if (id && selected !== id && notes[id]) { if (selected && notes[selected]) notes[selected].el.classList.remove('wb-active'); selected = id; el.classList.add('wb-active'); }
    });
  }

  function pointOf(e) {
    var r = surface.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }
  surface.addEventListener('dblclick', function (e) {
    if (e.target !== surface || editing) return;
    var p = pointOf(e);
    startDraft(p.x, p.y);
  });
  var lastTap = null;
  surface.addEventListener('pointerup', function (e) {
    if (e.pointerType !== 'touch' || e.target !== surface || editing) return;
    var now = Date.now();
    var p = pointOf(e);
    if (lastTap && now - lastTap.t < 350 && Math.abs(p.x - lastTap.x) + Math.abs(p.y - lastTap.y) < 30) {
      lastTap = null;
      e.preventDefault();
      startDraft(p.x, p.y);
      return;
    }
    lastTap = { t: now, x: p.x, y: p.y };
  });
  surface.addEventListener('pointerdown', function (e) {
    if (e.target === surface) select(null);
  });

  function visibleOrigin() {
    return { x: frame.scrollLeft + 24, y: frame.scrollTop + 24 };
  }
  root.querySelector('[data-wb-add]').addEventListener('click', function () {
    if (editing) return;
    var o = visibleOrigin();
    startDraft(o.x + Math.min(240, frame.clientWidth / 3), o.y + Math.min(120, frame.clientHeight / 3));
  });

  var confirmDlg = root.querySelector('[data-wb-confirm]');
  var pendingDelete = null;
  function askDelete(id) {
    if (!notes[id] || confirmDlg.open) return;
    pendingDelete = id;
    root.querySelector('[data-wb-confirm-text]').textContent = notes[id].note.body;
    confirmDlg.showModal();
    root.querySelector('[data-wb-confirm-no]').focus();
  }
  document.addEventListener('keydown', function (e) {
    if (editing || !selected || !notes[selected]) return;
    if (document.activeElement && /^(INPUT|TEXTAREA|SELECT|BUTTON)$/.test(document.activeElement.tagName)) return;
    if (confirmDlg.open || clearDlg.open) return;
    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      askDelete(selected);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      editNote(selected);
    }
  });
  root.querySelector('[data-wb-confirm-no]').addEventListener('click', function () {
    pendingDelete = null;
    confirmDlg.close();
  });
  root.querySelector('[data-wb-confirm-yes]').addEventListener('click', function () {
    var id = pendingDelete;
    pendingDelete = null;
    confirmDlg.close();
    if (!id || !notes[id]) return;
    api('POST', PATH + '/notes/' + encodeURIComponent(id) + '/delete', { version: notes[id].note.updatedAt }).then(function (r) {
      if (r.status === 200 || r.status === 404) { drop(id); say(r.status === 200 ? w('Note deleted.') : w('Someone else deleted that note.')); }
      else say(r.data.error || w("Couldn't save the note. Try again."), true);
    }, function () { say(w("Couldn't save the note. Try again."), true); });
  });

  var clearDlg = root.querySelector('[data-wb-clear]');
  var clearErr = root.querySelector('[data-wb-clear-error]');
  root.querySelector('[data-wb-clear-open]').addEventListener('click', function () {
    clearErr.hidden = true;
    root.querySelector('[data-wb-clear-pin]').value = '';
    clearDlg.showModal();
    root.querySelector('[data-wb-clear-pin]').focus();
  });
  root.querySelector('[data-wb-clear-no]').addEventListener('click', function () { clearDlg.close(); });
  root.querySelector('[data-wb-clear-form]').addEventListener('submit', function (e) {
    e.preventDefault();
    var pin = root.querySelector('[data-wb-clear-pin]').value;
    api('POST', PATH + '/clear', { pin: pin }).then(function (r) {
      root.querySelector('[data-wb-clear-pin]').value = '';
      if (r.status === 200) {
        clearDlg.close();
        Object.keys(notes).forEach(drop);
        say(w('Board cleared: {n} notes.', { n: r.data.cleared || 0 }), true);
      } else {
        clearErr.textContent = r.data.error || w("That PIN isn't right. Nothing was cleared.");
        clearErr.hidden = false;
      }
    }, function () { clearErr.textContent = w("Couldn't save the note. Try again."); clearErr.hidden = false; });
  });

  function refresh() {
    if (document.hidden || dragging || confirmDlg.open || clearDlg.open) return;
    api('GET', PATH + '/notes.json').then(function (r) {
      if (r.status !== 200 || !r.data.notes) return;
      var seen = {};
      r.data.notes.forEach(function (n) {
        seen[n.id] = true;
        if (editing === n.id || pending[n.id] || (dragging && dragging.id === n.id)) return;
        var rec = notes[n.id];
        if (!rec || rec.note.updatedAt !== n.updatedAt) render(n);
      });
      Object.keys(notes).forEach(function (id) { if (!seen[id] && editing !== id && !pending[id]) drop(id); });
    }, function () {});
  }
  setInterval(refresh, POLL);
  document.addEventListener('visibilitychange', function () { if (!document.hidden) refresh(); });

  /* The import pane. */
  var pane = root.querySelector('[data-wb-import]');
  var openBtn = root.querySelector('[data-wb-import-open]');
  var fileInput = root.querySelector('[data-wb-file]');
  var preview = root.querySelector('[data-wb-preview]');
  var review = root.querySelector('[data-wb-review]');
  var list = root.querySelector('[data-wb-lines]');
  var license = root.querySelector('[data-wb-license]');
  var lastPicture = null;
  function resetPane() {
    fileInput.value = '';
    root.querySelector('[data-wb-file-name]').textContent = '';
    preview.hidden = true;
    preview.removeAttribute('src');
    review.hidden = true;
    license.hidden = true;
    list.innerHTML = '';
    lastPicture = null;
  }
  openBtn.addEventListener('click', function () {
    pane.hidden = !pane.hidden;
    openBtn.setAttribute('aria-expanded', pane.hidden ? 'false' : 'true');
    if (pane.hidden) resetPane();
  });
  root.querySelector('[data-wb-import-cancel]').addEventListener('click', function () {
    resetPane();
    pane.hidden = true;
    openBtn.setAttribute('aria-expanded', 'false');
  });

  function isHeicFile(file) {
    var name = (file.name || '').toLowerCase();
    return /heic|heif/.test(file.type || '') || /\.(heic|heif)$/.test(name);
  }
  function loadHeicLib() {
    if (window.HeicTo) return Promise.resolve(window.HeicTo);
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = HEIC;
      s.onload = function () { window.HeicTo ? resolve(window.HeicTo) : reject(new Error('heic')); };
      s.onerror = function () { reject(new Error('heic')); };
      document.head.appendChild(s);
    });
  }
  function decodable(file) {
    if (!isHeicFile(file)) return Promise.resolve(file);
    return createImageBitmap(file).then(function (bmp) { bmp.close && bmp.close(); return file; }, function () {
      say(w('Converting the HEIC picture...'), true);
      return loadHeicLib().then(function (HeicTo) { return HeicTo({ blob: file, type: 'image/jpeg', quality: 0.9 }); });
    });
  }
  function shrink(blob) {
    return createImageBitmap(blob).then(function (bmp) {
      var scale = Math.min(1, EDGE / Math.max(bmp.width, bmp.height));
      var c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(bmp.width * scale));
      c.height = Math.max(1, Math.round(bmp.height * scale));
      var g = c.getContext('2d');
      g.fillStyle = '#ffffff';
      g.fillRect(0, 0, c.width, c.height);
      g.drawImage(bmp, 0, 0, c.width, c.height);
      bmp.close && bmp.close();
      return c.toDataURL('image/jpeg', 0.85);
    });
  }
  function flagWord(f) {
    return w({ pin: 'Looks like a PIN', password: 'Looks like a password', email: 'Looks like an email', phone: 'Looks like a phone number' }[f] || f);
  }
  function showLines(lines) {
    list.innerHTML = '';
    lines.forEach(function (line, i) {
      var li = document.createElement('li');
      li.className = 'wb-line' + (line.flags.length ? ' wb-flagged' : '');
      var box = document.createElement('input');
      box.type = 'checkbox';
      box.checked = line.flags.length === 0;
      box.id = 'wb-line-' + i;
      box.setAttribute('data-wb-line-check', String(i));
      var text = document.createElement('input');
      text.type = 'text';
      text.value = line.text;
      text.maxLength = 2000;
      text.setAttribute('data-wb-line-text', String(i));
      text.setAttribute('aria-label', w('Note') + ' ' + (i + 1));
      li.appendChild(box);
      li.appendChild(text);
      line.flags.forEach(function (f) {
        var tag = document.createElement('span');
        tag.className = 'wb-flag';
        tag.textContent = flagWord(f);
        li.appendChild(tag);
      });
      list.appendChild(li);
    });
    review.hidden = false;
  }
  function readPicture() {
    if (!lastPicture) return;
    license.hidden = true;
    review.hidden = true;
    say(w('Reading the picture...'), true);
    api('POST', PATH + '/import/read', { image: lastPicture }).then(function (r) {
      var d = r.data || {};
      if (r.status === 200 && d.ok) {
        if (!d.lines.length) { say(w('No text found in that picture.'), true); return; }
        say('');
        showLines(d.lines);
      } else if (d.reason === 'license') {
        license.hidden = false;
        say(w('The picture reader needs its license accepted once.'), true);
      } else if (d.reason === 'not_set_up') {
        say(w("Picture reading isn't set up on this copy of the app."), true);
      } else {
        say(d.error || w("The picture reader couldn't read that. Try a clearer picture."), true);
      }
    }, function () { say(w("The picture reader couldn't read that. Try a clearer picture."), true); });
  }
  fileInput.addEventListener('change', function () {
    var file = fileInput.files && fileInput.files[0];
    if (!file) return;
    root.querySelector('[data-wb-file-name]').textContent = file.name;
    var okType = /^image\/(jpeg|png|gif|webp|heic|heif)$/.test(file.type || '') || /\.(jpe?g|png|gif|webp|heic|heif)$/i.test(file.name || '');
    if (!okType) { say(w("That file isn't a picture this board takes. Use JPEG, PNG, GIF, WebP or HEIC."), true); return; }
    decodable(file).then(shrink).then(function (dataUrl) {
      lastPicture = dataUrl;
      preview.src = dataUrl;
      preview.hidden = false;
      readPicture();
    }, function () {
      say(isHeicFile(file) ? w("That HEIC picture couldn't be opened. Save it as JPEG and try again.") : w("That file isn't a picture this board takes. Use JPEG, PNG, GIF, WebP or HEIC."), true);
    });
  });
  root.querySelector('[data-wb-agree]').addEventListener('click', function () {
    api('POST', PATH + '/import/agree', {}).then(function (r) {
      if (r.status === 200 && r.data.ok) { say(w('License accepted. Reading again...'), true); readPicture(); }
      else say(w("Couldn't accept the license."), true);
    }, function () { say(w("Couldn't accept the license."), true); });
  });
  root.querySelector('[data-wb-apply]').addEventListener('click', function () {
    var picked = [];
    list.querySelectorAll('[data-wb-line-check]').forEach(function (box) {
      var i = box.getAttribute('data-wb-line-check');
      var text = list.querySelector('[data-wb-line-text="' + i + '"]').value;
      if (box.checked && text.trim()) picked.push(text);
    });
    if (!picked.length) { say(w('Pick at least one line to place.'), true); return; }
    var o = visibleOrigin();
    var col = 0;
    var row = 0;
    var rows = Math.max(1, Math.floor((Math.min(frame.clientHeight, H) - 48) / 72));
    var placed = picked.map(function (body) {
      var p = { body: body, x: clampX(o.x + col * 260), y: clampY(o.y + row * 72) };
      row += 1;
      if (row >= rows) { row = 0; col += 1; }
      return p;
    });
    api('POST', PATH + '/import/apply', { notes: placed }).then(function (r) {
      if (r.status === 201 && r.data.notes) {
        r.data.notes.forEach(render);
        resetPane();
        pane.hidden = true;
        openBtn.setAttribute('aria-expanded', 'false');
        say(w('Placed {n} notes on the board.', { n: r.data.notes.length }), true);
      } else say(r.data.error || w("Couldn't save the note. Try again."), true);
    }, function () { say(w("Couldn't save the note. Try again."), true); });
  });
})();
`;
